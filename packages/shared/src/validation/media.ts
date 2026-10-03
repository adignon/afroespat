import { z } from 'zod';
import type { Capability } from '../capabilities/capabilities.js';
import type { MediaKind } from '../enums/generated.js';

/**
 * ENVOI DE MÉDIA — 00-fondations.md §8.1, §8.2, §8.3 et 01-identite.md §4.2.
 *
 * ═══ POURQUOI CE FICHIER EXISTE ════════════════════════════════════════════
 *
 * AUCUNE ROUTE D'ENVOI DE FICHIER N'EXISTAIT DANS TOUTE L'API. Pas un
 * contrôleur ne mentionnait `media_assets`, pas un ne contenait « upload », et
 * la file `media` de §9.2 n'avait aucun consommateur. Trois écrans entiers
 * s'arrêtaient là :
 *
 *   · `POST /housing` exige au moins une photo pour une annonce d'OFFRE
 *     (10 §2.1) — donc AUCUNE annonce d'offre n'était publiable par l'API ;
 *   · `PUT /me/pro-profile` exige un `proofAssetId` à la création (10 §4.1) —
 *     donc AUCUNE fiche pro n'était créable ;
 *   · `PUT /me/avatar` (01 §4.2) n'existait pas, et rien d'autre n'écrivait
 *     `users.avatar_asset_id` : aucun membre ne pouvait avoir de portrait.
 *
 * Les charges d'essai ne se produisaient qu'en INSÉRANT les médias en base. Un
 * navigateur ne peut pas faire cela.
 *
 * ═══ LA DÉCISION DE FORME : PAR L'API, PAS PAR URL SIGNÉE ══════════════════
 *
 * `StorageProvider` offre les deux voies — `createUploadUrl` (le navigateur
 * dépose dans le seau) et `put` (le serveur dépose). C'est `put` qui est
 * employé, et ce n'est pas un choix de confort :
 *
 *  1. **La spec nomme multipart.** 01 §4.2 écrit `PUT /me/avatar` →
 *     « multipart → `media_assets` ». C'est la seule route d'envoi que les
 *     spécifications décrivent, et elle décrit un envoi À L'API.
 *
 *  2. **§8.3 exige le TYPE RÉEL, « vérifié (octets magiques) ».** Une URL signée
 *     ne donne jamais les octets à l'API : le contrôle devrait attendre qu'un
 *     travailleur retélécharge l'objet, donc APRÈS qu'un fichier non vérifié
 *     s'est posé dans le seau, à une clé que le client connaît déjà. Vérifier
 *     avant d'écrire demande de tenir les octets, donc de les recevoir.
 *
 *  3. **§8.1 exige la suppression des EXIF « à l'import ».** Retirer des
 *     métadonnées, c'est RÉÉCRIRE le fichier. Une URL signée stocke les octets
 *     du membre tels quels : l'original — avec ses coordonnées GPS — a donc
 *     existé à une clé stable avant tout nettoyage. 09 pose comme règle dure
 *     qu'aucune position individuelle ne sort de la plateforme ; on ne la tient
 *     pas en publiant d'abord et en nettoyant ensuite.
 *
 *  4. **`storage_key` est UNIQUE et les consommateurs lisent `/media/<clé>`
 *     directement.** Avec une URL signée, la ligne `media_assets` doit naître
 *     AVANT les octets : chaque envoi abandonné laisse alors une ligne qui
 *     affirme un fichier inexistant. C'est exactement la famille de défauts que
 *     ce dépôt a déjà payée — une valeur écrite que personne ne relit.
 *
 *  5. **Rien n'est volumineux.** Le plafond ci-dessous est de quelques mébioctets.
 *     L'URL signée paie son prix sur des objets lourds ; ici elle ne l'aurait pas.
 *
 * COÛT ASSUMÉ ET À CONNAÎTRE : les octets traversent le processus de l'API, et
 * l'analyse antivirus est faite dans la requête, donc l'appelant l'attend. Le
 * jour où le volume l'exige, la sortie n'est pas l'URL signée mais le découplage
 * de l'ANALYSE (statut `SCANNING` → file `media` → `READY`), le contrôle de type
 * et le nettoyage EXIF restant synchrones puisqu'ils décident de ce qu'on écrit.
 *
 * ═══ CE QUE LA SPEC NE DIT PAS, ET QUI EST REMONTÉ ═════════════════════════
 *
 * §8.3 écrit « taille maximale » SANS CHIFFRE, et aucune des quinze autres
 * spécifications n'en donne un. Les valeurs ci-dessous sont donc des valeurs
 * PROVISOIRES, posées en un seul endroit pour qu'un arbitrage du propriétaire se
 * fasse en une ligne. Elles ne sont pas une interprétation de la spec : la spec
 * est muette.
 */

// ── Taille maximale (§8.3 — chiffre ABSENT de la spec, valeur provisoire) ────

/**
 * 5 MiB pour une image.
 *
 * Repère : une photo de téléphone en 12 Mpx pèse 3 à 5 Mio en JPEG. Monter plus
 * haut ferait surtout passer des captures d'écran non recompressées ; descendre
 * refuserait des photos ordinaires, et l'API n'a pas de recompression à offrir
 * en échange (la file `media` de §9.2 n'a pas de consommateur).
 */
export const MEDIA_MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/**
 * 10 MiB pour un justificatif d'activité (10 §4.1 : « image ou PDF »).
 *
 * Un extrait SIRENE ou une attestation URSSAF scannés en plusieurs pages
 * dépassent facilement la borne des images.
 */
export const MEDIA_MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

// ── Types acceptés (§8.3 : « type réel vérifié (octets magiques) ») ─────────

/**
 * Les types d'IMAGE acceptés, et seulement eux.
 *
 * Pas de GIF : il porte l'animation, que rien dans les écrans ne demande, et sa
 * décompression est une surface d'attaque pour une valeur nulle. Pas de SVG
 * SURTOUT : un SVG est un document XML qui exécute du script dans le navigateur
 * qui l'affiche — servi depuis le domaine des médias, il vaut une faille XSS, et
 * aucun « octet magique » ne le distingue d'un fichier texte quelconque.
 */
export const MEDIA_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type MediaImageMime = (typeof MEDIA_IMAGE_MIMES)[number];

export const MEDIA_DOCUMENT_MIMES = ['application/pdf'] as const;

/** L'extension d'une clé de stockage, déduite du type RÉEL et jamais du nom reçu. */
export const MEDIA_MIME_EXTENSIONS: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

// ── La politique, par nature de média ──────────────────────────────────────

export interface MediaKindPolicy {
  /**
   * La capacité qu'il faut POUR CE GENRE DE MÉDIA.
   *
   * Elle est vérifiée DANS LE SERVICE, et non par le décorateur de route : une
   * route unique ne peut déclarer qu'une capacité, et le plancher d'une route
   * qui accepte sept genres serait le plus permissif des sept. Déclarer `L1` et
   * laisser passer une photo de logement — `housing.publish`, L2 « sans
   * exception » (10 §2.1) — reviendrait à ouvrir la porte de côté : le membre
   * déposerait la photo, la route `POST /housing` refuserait, et il aurait tout
   * de même écrit dans le seau.
   */
  readonly capability: Capability;
  readonly mimes: readonly string[];
  readonly maxBytes: number;
  /** Faux pour les genres que seul le SERVEUR produit (archive RGPD, facture). */
  readonly memberUploadable: boolean;
}

/**
 * La table complète des dix genres de `MediaKind`, y compris les deux qu'un
 * membre ne peut pas envoyer.
 *
 * ELLE EST COMPLÈTE EXPRÈS : `Record<MediaKind, …>` fait que l'ajout d'un genre
 * à l'énumération Prisma CASSE la compilation ici, donc oblige à venir dire quel
 * plafond et quelle capacité il demande. Une table partielle laisserait un genre
 * nouveau sans politique, c'est-à-dire sans limite.
 */
export const MEDIA_KIND_POLICIES: Readonly<Record<MediaKind, MediaKindPolicy>> = {
  /** 01 §4.2 `PUT /me/avatar`. L0 : un portrait n'attend pas la vérification. */
  AVATAR: {
    capability: 'content.read',
    mimes: MEDIA_IMAGE_MIMES,
    maxBytes: MEDIA_MAX_IMAGE_BYTES,
    memberUploadable: true,
  },
  /** 04 §2.1 : « jusqu'à 4 images », capacité `post.create` (L1). */
  POST: {
    capability: 'post.create',
    mimes: MEDIA_IMAGE_MIMES,
    maxBytes: MEDIA_MAX_IMAGE_BYTES,
    memberUploadable: true,
  },
  /** 10 §2.1 : « 1 à 8 photos », capacité `housing.publish` (L2 SANS EXCEPTION). */
  HOUSING: {
    capability: 'housing.publish',
    mimes: MEDIA_IMAGE_MIMES,
    maxBytes: MEDIA_MAX_IMAGE_BYTES,
    memberUploadable: true,
  },
  /** 09 : couverture d'événement, capacité `event.create` (L1). */
  EVENT_COVER: {
    capability: 'event.create',
    mimes: MEDIA_IMAGE_MIMES,
    maxBytes: MEDIA_MAX_IMAGE_BYTES,
    memberUploadable: true,
  },
  /** 07 : photo d'album de réseau — la route qui l'attache exige `post.create`. */
  ALBUM: {
    capability: 'post.create',
    mimes: MEDIA_IMAGE_MIMES,
    maxBytes: MEDIA_MAX_IMAGE_BYTES,
    memberUploadable: true,
  },
  /** 08 §5.3 : « une image facultative », capacité `message.send` (L1). */
  MESSAGE: {
    capability: 'message.send',
    mimes: MEDIA_IMAGE_MIMES,
    maxBytes: MEDIA_MAX_IMAGE_BYTES,
    memberUploadable: true,
  },
  /** 10 §4.1 : justificatif d'activité, « image ou PDF », `pro.register` (L2). */
  PROOF: {
    capability: 'pro.register',
    mimes: [...MEDIA_IMAGE_MIMES, ...MEDIA_DOCUMENT_MIMES],
    maxBytes: MEDIA_MAX_DOCUMENT_BYTES,
    memberUploadable: true,
  },
  /**
   * 14 §5 : logo de partenaire. Posé par l'ÉQUIPE (CONTENT_ADMIN) avec la fiche
   * partenaire — donc hors du domaine membre, que 00 §7.4 et 15 §2.1 déclarent
   * hermétique. Aucune route d'équipe ne l'envoie encore : c'est REMONTÉ, et non
   * glissé dans la route membre, qui serait la passerelle que la règle interdit.
   */
  LOGO: {
    capability: 'content.read',
    mimes: MEDIA_IMAGE_MIMES,
    maxBytes: MEDIA_MAX_IMAGE_BYTES,
    memberUploadable: false,
  },
  /** 01 §2.8 : archive RGPD, produite par le travailleur. Jamais envoyée. */
  EXPORT: {
    capability: 'content.read',
    mimes: ['application/json'],
    maxBytes: MEDIA_MAX_DOCUMENT_BYTES,
    memberUploadable: false,
  },
  /** 14 §4.4 : facture, rendue par le serveur. Jamais envoyée. */
  INVOICE: {
    capability: 'content.read',
    mimes: MEDIA_DOCUMENT_MIMES,
    maxBytes: MEDIA_MAX_DOCUMENT_BYTES,
    memberUploadable: false,
  },
};

/** Les genres qu'un membre peut envoyer — dérivés de la table, jamais recopiés. */
export const MEDIA_MEMBER_UPLOADABLE_KINDS = (
  Object.keys(MEDIA_KIND_POLICIES) as MediaKind[]
).filter((kind) => MEDIA_KIND_POLICIES[kind].memberUploadable);

/**
 * Le `kind` reçu en champ de formulaire.
 *
 * `AVATAR` en est ABSENT : il a sa propre route, `PUT /me/avatar` (01 §4.2), qui
 * remplace le portrait du membre. L'accepter ici créerait un avatar que rien
 * n'attache — un fichier payé et jamais affiché.
 */
export const mediaUploadKindSchema = z.enum(
  MEDIA_MEMBER_UPLOADABLE_KINDS.filter((kind) => kind !== 'AVATAR') as [string, ...string[]],
);

export const mediaUploadBodySchema = z.object({ kind: mediaUploadKindSchema }).strict();
export type MediaUploadBody = z.infer<typeof mediaUploadBodySchema>;

/**
 * La réponse d'un envoi.
 *
 * `url` est la SEULE adresse rendue, et elle porte la clé de stockage, non
 * l'identifiant : la clé contient un segment aléatoire (voir `media.service.ts`)
 * de sorte que connaître une adresse n'en laisse deviner aucune autre.
 */
export const mediaAssetSchema = z
  .object({
    id: z.string().uuid(),
    kind: z.string(),
    mime: z.string(),
    sizeBytes: z.number().int().nonnegative(),
    width: z.number().int().positive().nullable(),
    height: z.number().int().positive().nullable(),
    status: z.string(),
    exifStripped: z.boolean(),
    url: z.string(),
  })
  .strict();
export type MediaAssetView = z.infer<typeof mediaAssetSchema>;

// ── Codes d'erreur (§5.2) ───────────────────────────────────────────────────

/**
 * `MEDIA_TYPE_REJECTED` distingue DEUX refus que §8.3 ne confond pas :
 * l'extension annoncée est ignorée, seuls les octets magiques comptent. Un
 * fichier `.jpg` qui commence par `%PDF` est refusé avec ce code, et le détail
 * dit le type réel trouvé.
 */
export const MEDIA_ERROR_CODES = {
  MEDIA_TOO_LARGE: 413,
  MEDIA_TYPE_REJECTED: 415,
  MEDIA_INFECTED: 422,
  MEDIA_EMPTY: 422,
} as const;

export type MediaErrorCode = keyof typeof MEDIA_ERROR_CODES;

export const MEDIA_ERROR_MESSAGES: Readonly<Record<MediaErrorCode, string>> = {
  MEDIA_TOO_LARGE: 'Ce fichier est trop lourd.',
  MEDIA_TYPE_REJECTED: 'Ce format de fichier n’est pas accepté.',
  MEDIA_INFECTED: 'Ce fichier a été refusé par l’analyse antivirus.',
  MEDIA_EMPTY: 'Aucun fichier n’a été reçu.',
};
