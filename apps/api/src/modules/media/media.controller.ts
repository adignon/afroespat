import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  Post,
  Put,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { StreamableFile } from '@nestjs/common';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  MEDIA_MAX_DOCUMENT_BYTES,
  MEDIA_MEMBER_UPLOADABLE_KINDS,
  mediaUploadBodySchema,
  type MediaKind,
} from '@app/shared';
import { Auth, MaybeAuth, type AuthContext } from '../../common/auth.guard';
import { PublicRead, RateLimit, RequiresCapability } from '../../common/capability.decorator';
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

  /**
   * LES OCTETS D'UN MÉDIA. Aucune route ne les servait — voir `MediaService.bytes`.
   *
   * ── LE CHEMIN PORTE DES « / », ET C'EST POURQUOI IL EST JOKER ─────────────
   *
   * Une clé vaut `post/2026/01/<uuid>-<16 octets>.webp` : quatre segments. Un
   * `:key` ordinaire s'arrêterait au premier « / » et ne trouverait jamais rien.
   * Le joker les rassemble, et le service refuse tout ce qui n'est pas une ligne
   * connue, prête et autorisée — donc un « .. » glissé ici ne désigne aucune
   * ligne et sort en 404 avant d'atteindre le disque. Le fournisseur de stockage
   * pose la MÊME garde une seconde fois, par `pathFor`.
   *
   * `'media/*'` ET `@Param('0')`, ET NON `'media/*key'` : ce dépôt est sur
   * EXPRESS 4 (4.22.1, avec Nest 10). Le joker NOMMÉ est de la syntaxe Express 5 ;
   * en 4, il s'écrit `*` et le segment capturé s'appelle `0`. Écrit à la mode
   * Express 5, le chemin ne correspond À RIEN — mesuré : la route valide rendait
   * 404, et un appel SANS JETON rendait 404 au lieu de 401, ce qui est le signe
   * que la requête n'atteignait jamais la route. Un 404 sur un contrôle d'accès
   * est précisément le genre de symptôme qu'on lit de travers.
   *
   * ── `@PublicRead()`, PARCE QU'UN NAVIGATEUR NE SAIT PAS PORTER DE JETON ───
   *
   * J'ai posé cette route DEUX FOIS de travers avant de comprendre, et les deux
   * erreurs valent d'être écrites.
   *
   * D'ABORD sans capacité du tout, en raisonnant qu'une image déjà reçue dans une
   * réponse n'en demande pas une de plus. Le serveur a répondu
   * `403 FORBIDDEN { reason: "route sans capacité déclarée" }` sur TOUTES les
   * requêtes, jeton ou non. Ce dépôt refuse par défaut toute route qui n'en
   * déclare pas — bonne conception : l'oubli ferme la porte au lieu de l'ouvrir.
   *
   * ENSUITE avec `@RequiresCapability('content.read')`, ce qui marchait au `curl`
   * et NE PEUT PAS MARCHER DANS UN NAVIGATEUR. Mesuré : la page peignait bien
   * `background-image: url(…/media/…)`, et le navigateur ne demandait JAMAIS
   * l'image. La raison est structurelle — UN `<img>` ET UN `background-image`
   * N'ENVOIENT AUCUN EN-TÊTE `Authorization`. Seuls les cookies voyagent tout
   * seuls. Une route de média protégée par jeton porteur est donc lisible par
   * `curl` et invisible à l'écran, ce qui est le pire des deux mondes : verte aux
   * tests d'API, noire pour le membre.
   *
   * `@PublicRead()` est la déclaration que ce dépôt a prévue pour cela, et elle ne
   * rend pas la route ouverte à tout : `AuthGuard` écrit lui-même qu'« un jeton
   * présent est toujours lu, même sur une route publique ». L'identité arrive donc
   * quand elle existe, et le service s'en sert — les genres privés
   * (`PROOF`, `EXPORT`, `INVOICE`) restent fermés à qui n'est pas leur
   * propriétaire, y compris et surtout à un appelant anonyme.
   *
   * CE QUI PROTÈGE LE RESTE, ce sont les SEIZE OCTETS D'ALÉA de la clé (voir
   * `keyFor`) : l'adresse est indevinable, et c'est la posséder qui vaut
   * autorisation. C'est le choix que ce dépôt avait déjà fait en mettant ce secret
   * dans le chemin ; la route ne fait que s'y conformer.
   *
   * ET `@MaybeAuth()`, PAS `@Auth()`. Troisième faux pas sur la même route, et le
   * même enseignement que les deux autres : l'outil existait déjà. `@Auth()` LÈVE
   * `UNAUTHENTICATED` quand il n'y a pas de jeton — il annulait donc tout l'effet
   * de `@PublicRead()`, et la route rendait 401 alors que le garde l'avait
   * laissée passer. `@MaybeAuth()` rend « le contexte s'il existe, pour une
   * lecture publique personnalisée » : c'est sa phrase, et c'est ce cas.
   *
   * ── LE CACHE EST PRIVÉ, ET IMMUABLE ───────────────────────────────────────
   *
   * `private` : un média peut être réservé à son propriétaire, et un cache
   * partagé le servirait au suivant. `immutable` : la clé porte seize octets
   * d'aléa, donc une adresse donnée désigne un contenu qui ne changera jamais —
   * un remplacement de portrait crée une NOUVELLE clé. Sans cela chaque avatar
   * de chaque liste repartirait au serveur à chaque affichage.
   */
  @Get('media/*')
  @PublicRead()
  @Header('Cache-Control', 'private, max-age=31536000, immutable')
  @ApiOperation({ summary: 'Les octets d’un média, selon son genre et son propriétaire' })
  async bytes(@MaybeAuth() auth: AuthContext | null, @Param('0') key: string) {
    const { body, mime } = await this.media.bytes(auth?.userId ?? null, key);
    return new StreamableFile(body, { type: mime });
  }

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
