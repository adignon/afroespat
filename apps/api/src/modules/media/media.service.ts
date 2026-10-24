import { randomBytes } from 'node:crypto';
import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { newId } from '@app/db';
import {
  MEDIA_ERROR_CODES,
  MEDIA_ERROR_MESSAGES,
  MEDIA_KIND_POLICIES,
  MEDIA_MIME_EXTENSIONS,
  levelSatisfies,
  type MediaAssetView,
  type MediaErrorCode,
  type MediaKind,
} from '@app/shared';
import { ApiError } from '../../common/api-error';
import { PrismaService } from '../../common/prisma.service';
import { MEDIA_QUEUE, THUMB_SUFFIX, type MediaQueuePort } from './media.consumer';
import {
  ANTIVIRUS_PROVIDER,
  type AntivirusProvider,
  STORAGE_PROVIDER,
  type StorageProvider,
} from '../../providers/providers';
import { sniffType, stripMetadata } from './media-bytes';

/**
 * LES TROIS GENRES QUI NE SORTENT QUE POUR LEUR PROPRIÉTAIRE.
 *
 * La clé de stockage porte seize octets d'aléa (voir `keyFor`), donc la posséder
 * vaut autorisation pour un avatar ou la photo d'une annonce — ils sont de toute
 * façon rendus dans des réponses que le lecteur avait le droit de recevoir.
 *
 * Pour ces trois-là, non : une adresse qui fuit — un journal, un presse-papiers,
 * un historique de navigateur — ne doit pas suffire à ouvrir le justificatif
 * d'identité de quelqu'un, l'archive de TOUTES ses données, ou une facture qui
 * porte son nom et un montant. Le contrôle de propriétaire coûte une comparaison.
 *
 * `AVATAR` n'y est PAS, et c'est délibéré : un portrait est montré à tout membre
 * dans chaque liste du produit. L'y mettre casserait toutes les listes sans rien
 * protéger.
 */
const PRIVATE_MEDIA_KINDS: ReadonlySet<MediaKind> = new Set(['PROOF', 'EXPORT', 'INVOICE']);

/** Ce qu'un champ de fichier multipart apporte. */
export interface UploadedFile {
  /**
   * Multer rend un `Buffer` en mémoire (`memoryStorage`), et c'est VOULU : §8.3
   * exige de vérifier le type réel, d'analyser l'antivirus et de retirer les EXIF
   * AVANT publication. Un fichier posé sur le disque de l'API serait un fichier
   * non vérifié hors du fournisseur de stockage — donc, en production,
   * potentiellement hors de la région UE qu'impose la règle dure §8.2.
   */
  readonly buffer: Buffer;
  /** Le type ANNONCÉ. Conservé pour le journal, jamais cru (§8.3). */
  readonly mimetype?: string;
  readonly originalname?: string;
  readonly size?: number;
}

/**
 * ENVOI DE MÉDIA — 00-fondations.md §8.1 à §8.3, 01-identite.md §4.2.
 *
 * Le raisonnement de forme (par l'API et non par URL signée), les plafonds et la
 * politique par genre vivent dans `@app/shared/validation/media.ts`, où le front
 * les lit aussi. Ici : l'ordre des contrôles, et pourquoi il est celui-là.
 *
 * ═══ L'ORDRE DES CONTRÔLES EST LA SÉCURITÉ ════════════════════════════════
 *
 *   1. **la capacité du GENRE.** Le décorateur de route déclare le plancher ; le
 *      genre demandé peut exiger plus (10 §2.1 : logement L2 « sans exception »).
 *      Vérifié d'abord, parce qu'un refus doit coûter zéro octet écrit.
 *   2. **la taille.** Avant tout travail sur les octets.
 *   3. **le TYPE RÉEL** (§8.3, « octets magiques »). L'extension et le
 *      `Content-Type` du multipart viennent du client : les deux mentent dès
 *      qu'on le lui demande.
 *   4. **l'ANTIVIRUS, avant toute écriture** (§8.3, « avant publication »). Un
 *      fichier refusé ne touche JAMAIS le stockage ; il laisse une ligne
 *      `REJECTED` — `media_assets.status` est fait pour cela — et aucun octet.
 *   5. **le nettoyage des métadonnées** (§8.1), puis le dépôt, puis la ligne.
 *
 * LA LIGNE NAÎT APRÈS LES OCTETS, et jamais avant. `storage_key` est `@unique` et
 * les consommateurs (`feed`, `housing`, `communities`, `users`) construisent
 * `/media/<clé>` directement : une ligne créée avant le dépôt affirmerait un
 * fichier qui n'existe pas encore, et qui n'existerait jamais si l'envoi échouait.
 */
@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
    @Inject(ANTIVIRUS_PROVIDER) private readonly antivirus: AntivirusProvider,
    @Optional() @Inject(MEDIA_QUEUE) private readonly queue: MediaQueuePort | null = null,
  ) {}

  private fail(code: MediaErrorCode, details?: Record<string, unknown>): never {
    throw new ApiError(code, MEDIA_ERROR_MESSAGES[code], MEDIA_ERROR_CODES[code], details);
  }

  /**
   * `POST /media` — un fichier, un genre, un `MediaAsset` prêt à être attaché.
   *
   * `kind` est un `MediaKind` validé par Zod à la frontière, donc la politique
   * existe toujours : `MEDIA_KIND_POLICIES` est un `Record` complet des dix
   * genres, et un genre ajouté à l'énumération casse la compilation plutôt que de
   * passer sans plafond.
   */
  async upload(userId: string, kind: MediaKind, file: UploadedFile | undefined): Promise<MediaAssetView> {
    const policy = MEDIA_KIND_POLICIES[kind];
    if (!policy.memberUploadable) {
      // `LOGO` (équipe), `EXPORT` et `INVOICE` (produits par le serveur). Le
      // schéma de route les exclut déjà ; ce second refus tient si un autre
      // appelant arrive, ce qui est la seule façon qu'une règle survive.
      throw ApiError.transverse('FORBIDDEN', { reason: 'genre de média non envoyable' });
    }

    // 1. LA CAPACITÉ DU GENRE, lue en base et non dans le jeton.
    //
    // Le garde a déjà vérifié le plancher de la route avec le niveau porté par le
    // jeton (et `assertTokenFresh` garantit qu'il n'est pas périmé). Relire la
    // base ici n'est pas un doublon : c'est ce qui fait que la règle « une photo
    // de logement demande L2 » tient même appelée depuis ailleurs que la route.
    const member = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { verificationLevel: true },
    });
    if (!levelSatisfies(member.verificationLevel, policy.capability)) {
      throw ApiError.levelRequired(policy.capability, member.verificationLevel);
    }

    // 2. LA TAILLE. `MEDIA_EMPTY` distingue « aucun fichier reçu » de « fichier
    //    vide » : le premier est presque toujours un mauvais nom de champ côté
    //    client, et un 422 muet enverrait chercher au mauvais endroit.
    if (file === undefined || file.buffer.length === 0) this.fail('MEDIA_EMPTY');
    if (file.buffer.length > policy.maxBytes) {
      this.fail('MEDIA_TOO_LARGE', { maxBytes: policy.maxBytes, sizeBytes: file.buffer.length });
    }

    // 3. LE TYPE RÉEL (§8.3).
    const sniffed = sniffType(file.buffer);
    if (sniffed === null || !policy.mimes.includes(sniffed.mime)) {
      this.fail('MEDIA_TYPE_REJECTED', {
        // Le type DÉCLARÉ est rendu à côté du type TROUVÉ : c'est ce qui permet au
        // front de dire « ce fichier dit être une image mais n'en est pas une »
        // plutôt qu'un refus que le membre ne peut pas comprendre.
        declaredMime: file.mimetype ?? null,
        detectedMime: sniffed?.mime ?? null,
        accepted: policy.mimes,
      });
    }

    const extension = MEDIA_MIME_EXTENSIONS[sniffed.mime] ?? 'bin';
    const assetId = newId();
    const storageKey = this.keyFor(kind, assetId, extension);

    // 4. L'ANTIVIRUS, AVANT TOUTE ÉCRITURE (§8.3).
    const verdict = await this.antivirus.scan(file.buffer);
    if (!verdict.clean) {
      /**
       * La trace existe, les octets non.
       *
       * `media_assets.status = REJECTED` est exactement ce que §8.3 attache à
       * l'analyse ; la ligne permet à la modération de savoir qu'un membre a tenté
       * un envoi infecté. La clé y est INSCRITE mais rien n'est déposé dessus :
       * c'est une clé réservée, et `status` est le seul champ à lire avant de
       * servir un média — ce que `communities.service.ts` fait déjà
       * (`status === 'READY' ? url : null`).
       */
      await this.prisma.mediaAsset.create({
        data: {
          id: assetId,
          ownerUserId: userId,
          kind,
          storageKey,
          mime: sniffed.mime,
          sizeBytes: BigInt(file.buffer.length),
          status: 'REJECTED',
          exifStripped: false,
        },
      });
      this.logger.warn(
        `Envoi refusé par l'antivirus — membre ${userId}, genre ${kind}, ` +
          `signature ${verdict.signature ?? 'inconnue'}`,
      );
      this.fail('MEDIA_INFECTED', { signature: verdict.signature ?? null });
    }

    // 5. LES MÉTADONNÉES (§8.1), puis le dépôt, puis la ligne.
    const { body, stripped } = stripMetadata(file.buffer, sniffed.mime);
    await this.storage.put(storageKey, body, sniffed.mime);

    const asset = await this.prisma.mediaAsset.create({
      data: {
        id: assetId,
        ownerUserId: userId,
        kind,
        storageKey,
        mime: sniffed.mime,
        // La taille ÉCRITE est celle des octets DÉPOSÉS, pas celle des octets
        // reçus : le nettoyage en retire, et une taille qui ne correspond pas au
        // fichier servi est une valeur que personne ne peut relire pour vérifier.
        sizeBytes: BigInt(body.length),
        width: sniffed.width,
        height: sniffed.height,
        /**
         * `READY` directement, parce que tout ce que §8.3 met « avant
         * publication » est déjà fait : type vérifié, antivirus passé, EXIF
         * retirés. `PENDING`/`SCANNING` resteraient vrais si l'analyse partait
         * dans la file `media` (§9.2) — elle n'a aucun consommateur, et un asset
         * bloqué en `PENDING` serait un asset qu'aucune route ne peut attacher
         * (`feed.service.ts` exige `READY`). C'est REMONTÉ : le jour où la file
         * `media` existe, c'est l'ANALYSE qui s'y déplace, pas le contrôle de type.
         */
        status: 'READY',
        exifStripped: stripped,
      },
      select: MEDIA_VIEW_SELECT,
    });

    // La vignette est un confort, jamais une condition : un échec de mise en file
    // est journalisé, le média reste servi en pleine taille.
    if (this.queue !== null && sniffed.mime.startsWith('image/')) {
      this.queue.enqueueThumbnail({ assetId }).catch((error: unknown) => {
        this.logger.warn(`vignette non planifiée : ${error instanceof Error ? error.message : String(error)}`);
      });
    }

    return this.view(asset);
  }

  /**
   * `PUT /me/avatar` — 01 §4.2, « multipart → `media_assets` ».
   *
   * CETTE ROUTE N'EXISTAIT PAS, et rien d'autre n'écrivait `users.avatar_asset_id` :
   * `PATCH /me` ne l'accepte pas (01 §4.2 en donne la liste close), et aucun
   * service ne le posait. La colonne était lue partout — `users.service.ts`,
   * `housing.service.ts`, `connections.service.ts`, `pros.service.ts` et
   * `communities.service.ts` construisent tous `/media/<clé>` à partir d'elle — et
   * écrite par personne. Aucun membre ne pouvait donc avoir de portrait.
   *
   * L'ANCIEN AVATAR EST RETIRÉ, octets compris. Le laisser ferait s'accumuler
   * dans le seau une photo de chaque membre à chaque changement, sans que rien ne
   * la référence : §8.1 impose la minimisation, et un fichier que plus aucune
   * ligne ne désigne est un fichier qu'aucune suppression de compte n'atteindra.
   */
  async putAvatar(userId: string, file: UploadedFile | undefined): Promise<MediaAssetView> {
    const previous = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { avatarAssetId: true },
    });

    const asset = await this.upload(userId, 'AVATAR', file);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { avatarAssetId: asset.id } });
      if (previous.avatarAssetId !== null) {
        await tx.mediaAsset.update({
          where: { id: previous.avatarAssetId },
          data: { deletedAt: new Date() },
        });
      }
    });

    if (previous.avatarAssetId !== null) {
      // HORS TRANSACTION, et après elle : la suppression distante ne peut pas être
      // annulée par un retour arrière de la base. Si elle échoue, la ligne est
      // déjà `deleted_at` — donc invisible — et `retention.purge` reste le filet.
      const old = await this.prisma.mediaAsset.findUnique({
        where: { id: previous.avatarAssetId },
        select: { storageKey: true },
      });
      if (old !== null) {
        try {
          await this.storage.delete(old.storageKey);
          await this.storage.delete(`${old.storageKey}${THUMB_SUFFIX}`); // la vignette suit l’original
        } catch (error) {
          this.logger.error(
            `Ancien avatar ${previous.avatarAssetId} : suppression du stockage impossible — ` +
              `${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    }

    return asset;
  }

  /**
   * LA CLÉ DE STOCKAGE PORTE UN SEGMENT ALÉATOIRE, et c'est le point entier.
   *
   * L'adresse publique d'un média est `/media/<storage_key>` : c'est ce que
   * `users.service.ts`, `housing.service.ts`, `feed.service.ts` et
   * `communities.service.ts` construisent, donc ce que le navigateur reçoit. La
   * clé est l'autorisation de lecture — il n'y a pas de second contrôle derrière
   * un objet servi par le stockage.
   *
   * Une clé déduite de l'identifiant seul serait DEVINABLE : `newId()` rend un
   * UUID v7, dont les 48 premiers bits sont l'horodatage. Connaissant l'adresse de
   * la photo d'une annonce, on énumérerait les clés voisines à la milliseconde et
   * on lirait les justificatifs d'activité déposés au même moment — ceux dont §8.1
   * dit « accès équipe uniquement ». Les 128 bits aléatoires ferment cette porte,
   * et l'identifiant reste dans la clé pour qu'un objet du seau se relie à sa ligne.
   *
   * Le chemin porte l'année et le mois : une arborescence plate de plusieurs
   * centaines de milliers d'objets est impraticable au débogage, et ce découpage
   * ne révèle rien de plus que `created_at`, déjà rendu par l'API.
   */
  private keyFor(kind: MediaKind, assetId: string, extension: string): string {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const secret = randomBytes(16).toString('hex');
    /**
     * PAS de préfixe `media/` : l'adresse rendue est déjà `/media/<clé>`, et le
     * mettre donnait `/media/media/housing/…` — mesuré au curl, pas relu.
     */
    return `${kind.toLowerCase()}/${year}/${month}/${assetId}-${secret}.${extension}`;
  }

  /**
   * ╔════════════════════════════════════════════════════════════════════════════╗
   * ║ `GET /media/<clé>` — LES OCTETS. AUCUNE ROUTE NE LES SERVAIT.             ║
   * ╚════════════════════════════════════════════════════════════════════════════╝
   *
   * ── CE QUI MANQUAIT, ET DEPUIS QUAND ──────────────────────────────────────
   *
   * Neuf endroits, dans six modules, composent `/media/<clé>` à la main : les
   * avatars du fil, des villes, des réseaux et des fiches pro, les images de
   * publication, les photos de logement, les albums de réseau. `view()`
   * ci-dessous en fait autant. Et AUCUN `@Get` du dépôt ne répondait à cette
   * adresse — vérifié sur l'ensemble de `apps/api/src`, et aucun service statique
   * n'était monté dans `main.ts`.
   *
   * Autrement dit TOUTE IMAGE DU PRODUIT POINTAIT VERS UNE ROUTE INEXISTANTE.
   * Le défaut ne se voyait pas dans les tests parce qu'ils vérifient la FORME de
   * l'adresse, jamais qu'elle réponde.
   *
   * ── POURQUOI SERVIR LES OCTETS PLUTÔT QU'UNE URL SIGNÉE ───────────────────
   *
   * `StorageProvider.createDownloadUrl` existe et reste la bonne réponse pour
   * l'archive RGPD : un fichier téléchargé une fois, dont l'adresse expire. Mais
   * le dépôt a déjà choisi `/media/<clé>` partout ailleurs, et `view()` écrit
   * lui-même pourquoi : « une seule convention d'adresse de média, sinon le front
   * en apprend deux ». On sert donc cette adresse-là.
   *
   * ── L'AUTORISATION, GENRE PAR GENRE ───────────────────────────────────────
   *
   * La clé porte DÉJÀ seize octets d'aléa en plus d'un UUID (voir `keyFor`) :
   * elle est indevinable, et la posséder est en soi une autorisation. Ce n'est
   * PAS suffisant pour tout, et la raison est écrite dans le chemin lui-même —
   * `proof/2026/01/…` annonce son genre et sa date, ce que le dépôt sait déjà
   * (`feed.int.test.ts` : « le chemin `/media/proof/…` daterait même son dépôt »).
   *
   * Trois genres ne sont servis QU'À LEUR PROPRIÉTAIRE, parce qu'une adresse qui
   * fuit ne doit pas suffire à les ouvrir :
   *
   *   · `PROOF`   — le justificatif d'un professionnel ou d'une vérification ;
   *   · `EXPORT`  — l'archive RGPD, c'est-à-dire TOUTES les données d'un membre ;
   *   · `INVOICE` — une facture, qui porte un nom et un montant.
   *
   * Les autres sont servis à tout membre authentifié. Ce ne sont pas des secrets :
   * ils sont rendus DANS des réponses que le lecteur avait le droit de recevoir
   * (un avatar dans une liste de membres, une photo dans une annonce). Refaire ici
   * le contrôle de visibilité de chaque conteneur demanderait de rejouer six
   * modules, et le ferait DIVERGER d'eux au premier changement — ce qui serait
   * moins sûr, pas plus.
   *
   * CE QUI RESTE À FAIRE, et je le marque plutôt que de le masquer : un média
   * `POST` dont la publication est supprimée reste lisible par qui tient
   * l'adresse. Le lier à la visibilité de son conteneur demande le travail
   * ci-dessus. REMONTÉ.
   *
   * ── LES AUTRES REFUS ──────────────────────────────────────────────────────
   *
   * `status` doit valoir `READY` et `exifStripped` être vrai : exactement la barre
   * de `resolveMedia`, pour qu'un fichier refusé par l'antivirus ou dont les
   * métadonnées GPS n'ont pas été retirées ne puisse jamais sortir. Un média
   * supprimé (`deletedAt`) ne sort pas non plus.
   *
   * Tous les refus rendent le MÊME 404. Distinguer « inconnu », « pas prêt » et
   * « pas à vous » dirait à qui tâtonne lesquels existent.
   */
  async bytes(userId: string | null, requestedKey: string) {
    // `<clé>.thumb.webp` : la vignette hérite EXACTEMENT des contrôles de l'original.
    const wantsThumb = requestedKey.endsWith(THUMB_SUFFIX);
    const storageKey = wantsThumb ? requestedKey.slice(0, -THUMB_SUFFIX.length) : requestedKey;
    const asset = await this.prisma.mediaAsset.findFirst({
      where: { storageKey, deletedAt: null },
      select: { kind: true, mime: true, status: true, exifStripped: true, ownerUserId: true },
    });

    const introuvable = (): never => {
      throw ApiError.notFound();
    };

    if (asset === null) return introuvable();
    if (asset.status !== 'READY' || !asset.exifStripped) return introuvable();
    /**
     * `userId` peut être `null` : la route est `@PublicRead()`, parce qu'un
     * navigateur ne porte aucun jeton sur une image. Un appelant anonyme n'est
     * donc propriétaire de rien, et les trois genres privés lui sont fermés — la
     * comparaison le dit d'elle-même, sans cas particulier à écrire.
     */
    if (PRIVATE_MEDIA_KINDS.has(asset.kind) && (userId === null || asset.ownerUserId !== userId)) {
      return introuvable();
    }

    if (wantsThumb) {
      const thumb = await this.storage.get(requestedKey);
      // Pas (encore) de vignette : l'original, pour qu'aucun écran n'attende le worker.
      if (thumb !== null) return { body: thumb.body, mime: 'image/webp' };
    }
    const octets = await this.storage.get(storageKey);
    // La ligne peut survivre à ses octets : purge de rétention, reprise de tâche.
    if (octets === null) return introuvable();

    // Le type vient de `media_assets.mime`, établi par les OCTETS MAGIQUES à
    // l'import (§8.3). Jamais de l'extension, jamais du fournisseur.
    return { body: octets.body, mime: asset.mime };
  }

  /**
   * Le justificatif d'une fiche pro, LU PAR L'ÉQUIPE (15 §2.2 : « Valider les fiches pro (justificatif) »).
   *
   * Les genres privés ne se servent qu'à leur propriétaire (`bytes`) : un justificatif est donc
   * invisible de la personne qui doit le valider. Cette lecture est réservée à la route d'équipe de la
   * fiche (`GET /admin/pro-profiles/:id/proof`, rôles `proReview`), ne rend QUE le genre `PROOF`, prêt et
   * sans EXIF, et la route journalise la consultation. Même 404 pour tout refus.
   */
  async proofBytesForStaff(proofAssetId: string): Promise<{ body: Buffer; mime: string }> {
    const asset = await this.prisma.mediaAsset.findFirst({
      where: { id: proofAssetId, kind: 'PROOF', deletedAt: null },
      select: { storageKey: true, mime: true, status: true, exifStripped: true },
    });
    if (asset === null || asset.status !== 'READY' || !asset.exifStripped) throw ApiError.notFound();
    const octets = await this.storage.get(asset.storageKey);
    if (octets === null) throw ApiError.notFound();
    return { body: octets.body, mime: asset.mime };
  }

  private view(row: MediaViewRow): MediaAssetView {
    return {
      id: row.id,
      kind: row.kind,
      mime: row.mime,
      sizeBytes: Number(row.sizeBytes),
      width: row.width,
      height: row.height,
      status: row.status,
      exifStripped: row.exifStripped,
      // La même forme que partout ailleurs dans le dépôt : une seule convention
      // d'adresse de média, sinon le front en apprend deux.
      url: `/media/${row.storageKey}`,
    };
  }
}

const MEDIA_VIEW_SELECT = {
  id: true,
  kind: true,
  mime: true,
  sizeBytes: true,
  width: true,
  height: true,
  status: true,
  exifStripped: true,
  storageKey: true,
} as const;

interface MediaViewRow {
  readonly id: string;
  readonly kind: string;
  readonly mime: string;
  readonly sizeBytes: bigint;
  readonly width: number | null;
  readonly height: number | null;
  readonly status: string;
  readonly exifStripped: boolean;
  readonly storageKey: string;
}
