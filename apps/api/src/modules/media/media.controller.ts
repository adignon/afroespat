import { Body, Controller, HttpCode, Post, Put, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  MEDIA_MAX_DOCUMENT_BYTES,
  MEDIA_MEMBER_UPLOADABLE_KINDS,
  mediaUploadBodySchema,
  type MediaKind,
} from '@app/shared';
import { Auth, type AuthContext } from '../../common/auth.guard';
import { RateLimit, RequiresCapability } from '../../common/capability.decorator';
import { zodPipe } from '../../common/zod.pipe';
import { MediaService, type UploadedFile as MediaFile } from './media.service';

/**
 * ENVOI DE MÉDIA — 00-fondations.md §8.1 à §8.3, 01-identite.md §4.2.
 *
 * ═══ LES DEUX ROUTES, ET POURQUOI ELLES SONT DEUX ══════════════════════════
 *
 * `PUT /me/avatar` existe parce que 01 §4.2 l'écrit — « multipart →
 * `media_assets` » — et parce qu'elle fait plus qu'envoyer : elle REMPLACE le
 * portrait du membre, donc écrit `users.avatar_asset_id` et retire l'ancien.
 * Elle est ouverte à `content.read` (L0) : un portrait n'attend pas la
 * vérification d'un numéro.
 *
 * `POST /media` porte tous les autres genres. Elle déclare `post.create` (L1),
 * qui est le PLANCHER HONNÊTE des genres qu'elle accepte — et pas leur maximum :
 * `HOUSING` demande L2 « sans exception » (10 §2.1) et `PROOF` demande L2
 * (10 §4.1), et c'est le SERVICE qui l'applique, genre par genre.
 *
 * POURQUOI LE PLANCHER EST DANS LE DÉCORATEUR ET LE RESTE DANS LE SERVICE. Un
 * décorateur ne porte qu'une capacité ; une route qui accepte six genres ne peut
 * donc déclarer que le plus permissif. Déclarer L2 fermerait l'envoi d'une image
 * de message à un membre L1 qui en a le droit ; déclarer L1 et s'arrêter là
 * laisserait un L1 déposer une photo de logement — refusée ensuite par
 * `POST /housing`, mais déjà écrite dans le seau. Les deux contrôles sont donc
 * nécessaires, et aucun ne remplace l'autre.
 *
 * ═══ LE PLAFOND DUR DU MULTIPART ══════════════════════════════════════════
 *
 * `limits.fileSize` arrête la LECTURE du corps. Sans lui, un envoi de plusieurs
 * gibioctets serait entièrement mis en mémoire avant que le service ne puisse
 * dire qu'il est trop lourd — le contrôle de taille du service arriverait après
 * le mal qu'il devait empêcher.
 *
 * Il est posé au plafond le PLUS HAUT des genres (le justificatif, 10 Mio) et non
 * au plafond du genre demandé : le `kind` est un champ du même corps multipart,
 * donc il n'est pas encore lu quand multer décide de s'arrêter. Entre les deux,
 * c'est le service qui refuse avec `MEDIA_TOO_LARGE` et le plafond exact du genre
 * dans les détails ; au-delà, multer coupe et le filtre d'erreurs rend 413.
 *
 * `files: 1` est la seconde moitié : sans elle, un corps multipart portant mille
 * champs « file » passerait mille fois sous le plafond unitaire.
 *
 * ═══ LA LIMITE DE DÉBIT ═══════════════════════════════════════════════════
 *
 * `@RateLimit(60, 'hour')`, et l'HEURE est la bonne période : une annonce de
 * logement demande jusqu'à huit photos (10 §2.1), un album en demande plus, et un
 * plafond par minute refuserait un geste légitime. Ce qu'il faut borner, c'est le
 * VOLUME déposé dans le seau sur la durée — soixante fichiers par heure et par
 * membre, au plus 600 Mio, là où une minute n'aurait rien protégé. Le budget
 * global de 30 écritures/min (§5.5) continue de s'appliquer par-dessus.
 */
@ApiTags('media')
@Controller()
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post('media')
  @HttpCode(201)
  @RequiresCapability('post.create')
  @RateLimit(60, 'hour')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MEDIA_MAX_DOCUMENT_BYTES, files: 1 } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'kind'],
      properties: {
        file: { type: 'string', format: 'binary' },
        kind: { type: 'string', enum: [...MEDIA_MEMBER_UPLOADABLE_KINDS] },
      },
    },
  })
  @ApiOperation({
    summary:
      'Envoie un fichier et rend un media_asset prêt à être attaché (type réel vérifié, antivirus, EXIF retirées)',
  })
  async upload(
    @Auth() auth: AuthContext,
    /**
     * Le corps multipart est validé par le MÊME schéma Zod que partout ailleurs.
     *
     * Multer rend des champs TEXTE : `kind` arrive en chaîne, ce qui convient à
     * un `z.enum`. Le schéma est `.strict()`, donc un champ de formulaire
     * inattendu est refusé au lieu d'être ignoré — c'est ce qui fait qu'une faute
     * de frappe sur `kind` ne se traduit pas par un envoi au mauvais genre.
     */
    @Body(zodPipe(mediaUploadBodySchema)) body: { kind: string },
    @UploadedFile() file: MediaFile | undefined,
  ) {
    return this.media.upload(auth.userId, body.kind as MediaKind, file);
  }

  @Put('me/avatar')
  @RequiresCapability('content.read')
  @RateLimit(20, 'hour')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MEDIA_MAX_DOCUMENT_BYTES, files: 1 } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({ summary: 'Remplace son portrait (01 §4.2) — l’ancien est retiré, octets compris' })
  async avatar(@Auth() auth: AuthContext, @UploadedFile() file: MediaFile | undefined) {
    return this.media.putAvatar(auth.userId, file);
  }
}
