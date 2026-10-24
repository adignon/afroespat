import { z } from 'zod';
import { JobKind, JobStatus } from '../enums/generated.js';
import {
  cursorQuerySchema,
  handleSchema,
  pageSchema,
  slugSchema,
  uuidSchema,
} from './pagination.js';

/**
 * Emploi — 10-services.md §3.
 *
 * Deux règles structurent tout ce fichier :
 *
 *   · une offre PARTAGÉE par un membre est gratuite et affichée comme telle
 *     (§3.1). Il n'y a donc pas de notion d'« annonceur » : l'auteur est un
 *     membre, et `companyName` est une simple information ;
 *
 *   · la mise en avant est PAYANTE mais toujours SIGNALÉE (§3.1, règle dure du
 *     §11 : « une offre sponsorisée porte toujours la pastille et n'occupe jamais
 *     plus de 2 emplacements de tête »). D'où `JOB_SPONSORED_HEAD_SLOTS`, qui est
 *     une borne de produit, pas un réglage d'affichage.
 */

// ── Bornes du §3.1 ───────────────────────────────────────────────────────────

/** §3.1 : « Durée 45 jours, renouvelable ». */
export const JOB_LIFETIME_DAYS = 45;
/**
 * Le §3.1 dit « renouvelable » sans intervalle. On reprend celui du logement :
 * une offre renouvelable à volonté remonterait indéfiniment en tête de liste, ce
 * que §3.1 réserve explicitement à la mise en avant payante.
 */
export const JOB_RENEW_INTERVAL_DAYS = 30;
/** §3.1 : « mise en avant en tête des listes pendant 14 jours ». */
export const JOB_SPONSORED_DAYS = 14;
/** §3.1 : « Au plus 5 offres sponsorisées par membre et par mois ». */
export const FREE_SPONSORED_JOBS_PER_MONTH = 5;
/**
 * RÈGLE DURE (§11) : « n'occupe jamais plus de 2 emplacements de tête ».
 *
 * La même borne que les fiches pro mises en avant (§4.2) : deux emplacements, pas
 * une page. Au-delà, le classement naturel reprend — et une offre sponsorisée qui
 * y figure garde sa pastille.
 */
export const JOB_SPONSORED_HEAD_SLOTS = 2;
/** §3.1 : la pastille, toujours visible. Le texte vient du serveur. */
export const JOB_SPONSORED_LABEL = 'Sponsorisée';

/** §3.1 : « Une offre partagée par un membre est gratuite et affichée comme telle. » */
export function sharedByLabel(displayName: string): string {
  return `Partagée par ${displayName}`;
}

/**
 * §3.1 : « arnaques à l'emploi : frais d'inscription, formation payante
 * obligatoire → MONEY_REQUEST ».
 *
 * Termes NOMMÉS par la spec : ils s'appliquent sans dépendre du fournisseur IA,
 * qui passe en plus par l'événement `job.published`.
 */
export const JOB_SCAM_TERM_PATTERN =
  /frais\s+d[e’']?\s*inscription|frais\s+de\s+dossier|formation\s+(?:payante|obligatoire)|caution|acompte|western\s*union/i;

// ── Codes d'erreur (§6.2) ────────────────────────────────────────────────────

export const JOB_ERROR_CODES = {
  SPONSORED_LIMIT: 422,
  RENEW_TOO_SOON: 422,
  ALREADY_SPONSORED: 409,
  ALREADY_RECOMMENDED: 409,
  SELF_RECOMMENDATION: 422,
} as const;

export type JobErrorCode = keyof typeof JOB_ERROR_CODES;

export const JOB_ERROR_MESSAGES: Record<JobErrorCode, string> = {
  SPONSORED_LIMIT: `Vous avez déjà mis en avant ${FREE_SPONSORED_JOBS_PER_MONTH} offres ce mois-ci.`,
  RENEW_TOO_SOON: `Une offre se renouvelle au plus une fois tous les ${JOB_RENEW_INTERVAL_DAYS} jours.`,
  ALREADY_SPONSORED: 'Cette offre est déjà mise en avant.',
  ALREADY_RECOMMENDED: 'Vous avez déjà recommandé ce membre pour cette offre.',
  SELF_RECOMMENDATION: 'On ne se recommande pas soi-même.',
};

// ── Offres (§3.1) ────────────────────────────────────────────────────────────

const jobFields = {
  kind: z.enum(JobKind),
  title: z.string().trim().min(5).max(140),
  description: z.string().trim().min(30).max(5000),
  companyName: z.string().trim().min(2).max(160).optional(),
  /** §3.1 : « ville (facultative = national/télétravail) ». */
  cityId: uuidSchema.nullable().optional(),
  contractType: z.string().trim().min(2).max(80).optional(),
  sector: z.string().trim().min(2).max(80).optional(),
  educationLevel: z.string().trim().min(2).max(80).optional(),
  externalUrl: z.string().url().max(500).optional(),
};

export const createJobSchema = z.object(jobFields).strict();
export type CreateJob = z.infer<typeof createJobSchema>;

export const updateJobSchema = z
  .object({
    title: jobFields.title.optional(),
    description: jobFields.description.optional(),
    companyName: jobFields.companyName,
    cityId: jobFields.cityId,
    contractType: jobFields.contractType,
    sector: jobFields.sector,
    educationLevel: jobFields.educationLevel,
    externalUrl: jobFields.externalUrl,
  })
  .strict()
  .refine((v) => Object.values(v).some((field) => field !== undefined), {
    message: 'Aucune modification.',
  });

export type UpdateJob = z.infer<typeof updateJobSchema>;

export const jobsQuerySchema = cursorQuerySchema
  .extend({
    kind: z.enum(JobKind).optional(),
    cityId: uuidSchema.optional(),
    sector: z.string().trim().min(1).max(80).optional(),
    contractType: z.string().trim().min(1).max(80).optional(),
    /** Recherche plein texte simple sur le titre et l'entreprise. */
    q: z.string().trim().min(2).max(120).optional(),
    /** `mine` : l'écran « Mes annonces », offres expirées comprises. */
    scope: z.enum(['all', 'mine']).default('all'),
  })
  .strict();

export type JobsQuery = z.infer<typeof jobsQuerySchema>;

// ── Profil de recherche (§3.2) ───────────────────────────────────────────────

/**
 * §3.2 : « Aucun CV stocké en V1 ; le membre l'envoie lui-même en message. »
 *
 * Le schéma ne porte donc AUCUN champ de fichier, et c'est volontaire : un champ
 * `cvAssetId` optionnel aurait suffi à faire naître la fonction par accident.
 */
export const jobSeekerProfileSchema = z
  .object({
    headline: z.string().trim().min(5).max(140),
    sectors: z.array(z.string().trim().min(2).max(80)).max(10).default([]),
    contractTypes: z.array(z.string().trim().min(2).max(80)).max(10).default([]),
    isVisible: z.boolean().default(true),
  })
  .strict();

export type JobSeekerProfileInput = z.infer<typeof jobSeekerProfileSchema>;

export const jobSeekersQuerySchema = cursorQuerySchema
  .extend({
    cityId: uuidSchema.optional(),
    sector: z.string().trim().min(1).max(80).optional(),
  })
  .strict();

export type JobSeekersQuery = z.infer<typeof jobSeekersQuerySchema>;

// ── Recommander un membre (§3.3) ─────────────────────────────────────────────

/**
 * §3.3 : « depuis le profil d'un membre ou depuis une offre ».
 *
 * `toHandle` et non `toUserId` : c'est le geste de l'écran (« Recommander
 * @sandra »), et le handle est l'identifiant public du membre (01 §2.6).
 */
export const createMemberRecommendationSchema = z
  .object({
    toHandle: handleSchema,
    jobId: uuidSchema.optional(),
    comment: z.string().trim().min(5).max(500).optional(),
  })
  .strict();

export type CreateMemberRecommendation = z.infer<typeof createMemberRecommendationSchema>;

// ── Lecture : LES SCHÉMAS DE RÉPONSE (§6.2) ──────────────────────────────────

/**
 * Relevés sur l'API qui tourne (`src/__tests__/fixtures/services_job*.json`), et
 * non déduits du service : voir l'en-tête du même bloc dans `housing.ts` pour la
 * raison, qui a déjà coûté un écran bloqué au lot précédent.
 *
 * `.strict()` PARTOUT, et ici la fuite redoutée a un nom : une offre d'emploi est
 * la deuxième surface d'arnaque du module (§3.1, « frais d'inscription, formation
 * payante obligatoire »). Un champ de contact direct greffé sur une offre —
 * téléphone, adresse d'un recruteur — contournerait la messagerie de la
 * plateforme, et sans `.strict()` zod le dépouillerait en silence.
 */
const jobCityRefSchema = z.object({ id: uuidSchema, name: z.string(), slug: slugSchema }).strict();

const jobAuthorSchema = z
  .object({ handle: handleSchema, displayName: z.string(), avatarUrl: z.string().nullable() })
  .strict();

/**
 * Une offre, telle que `GET /jobs` et `GET /jobs/:id` la rendent.
 *
 * `isSponsored` ET `sponsoredLabel` arrivent ENSEMBLE, et c'est la règle dure du
 * §11 : « une offre sponsorisée porte TOUJOURS la pastille ». Le libellé vient du
 * serveur — un front qui le posséderait pourrait l'« oublier », et la mise en avant
 * cesserait d'être signalée sans que rien ne le dise.
 *
 * `city` est NULLABLE (§3.1 : « ville facultative = national/télétravail »), ce que
 * la planche S04 écrit « Studio Kora · Télétravail ».
 *
 * Les trois dates sont des CHAÎNES ISO : le service tient des `Date`, JSON n'en
 * garde que la forme textuelle. Un schéma déduit du code aurait écrit `z.date()` et
 * refusé la vraie réponse.
 */
export const jobCardSchema = z
  .object({
    id: uuidSchema,
    kind: z.enum(JobKind),
    title: z.string(),
    description: z.string(),
    companyName: z.string().nullable(),
    city: jobCityRefSchema.nullable(),
    contractType: z.string().nullable(),
    sector: z.string().nullable(),
    educationLevel: z.string().nullable(),
    externalUrl: z.string().nullable(),
    status: z.enum(JobStatus),
    createdAt: z.string().datetime(),
    expiresAt: z.string().datetime(),
    isSponsored: z.boolean(),
    sponsoredLabel: z.string().nullable(),
    sponsoredUntil: z.string().datetime().nullable(),
    author: jobAuthorSchema,
    /** §3.1 : « Partagée par Sandra M. » — composée par le SERVEUR, pas par l'écran. */
    sharedBy: z.string(),
    isMine: z.boolean(),
    canRenew: z.boolean().nullable(),
    recommendationCount: z.number().int(),
  })
  .strict();

export type JobCardView = z.infer<typeof jobCardSchema>;

/**
 * `GET /jobs` — et sa TÊTE SPONSORISÉE est un champ À PART de `items`.
 *
 * C'est le fait que seule une charge relevée pouvait apprendre : le service rend
 * `{ ...page, sponsored, meta }`, et `items` EXCLUT les offres de la tête. Un
 * schéma qui n'aurait décrit que `items` aurait fait disparaître la tête de
 * l'écran — donc la pastille « Sponsorisée », donc la règle dure du §11 — sans un
 * mot.
 *
 * `meta.sponsoredHeadSlots` voyage avec la liste (T4 §4) : la borne de deux
 * emplacements est une règle de produit, et un front qui la coderait en dur
 * afficherait un jour trois emplacements sans le savoir.
 *
 * `meta.total` (ajouté par le lot E2) est le nombre d'offres de la RECHERCHE, tête
 * sponsorisée comprise, comme `GET /housing` en porte un. Il alimente « N offres »
 * sous le titre de S04 et le compteur « Bourses et emploi » du panneau de gauche des
 * dix cadres d'ordinateur : l'écart que ce commentaire signalait est comblé.
 */
export const jobsListResponseSchema = pageSchema(jobCardSchema).extend({
  sponsored: z.array(jobCardSchema),
  meta: z
    .object({
      sponsoredLabel: z.string(),
      sponsoredHeadSlots: z.number().int(),
      total: z.number().int().nonnegative(),
    })
    .strict(),
});

export type JobsListResponse = z.infer<typeof jobsListResponseSchema>;

/** `GET /jobs/:id` — la MÊME carte, sans enveloppe : le contrôleur la rend nue. */
export const jobDetailResponseSchema = jobCardSchema;

export type JobDetailResponse = z.infer<typeof jobDetailResponseSchema>;

/**
 * Un profil de recherche publié (§3.2), tel que `GET /job-seekers` le rend.
 *
 * §3.2 : « Aucun CV stocké en V1 ». Le `.strict()` le rend exécutable à la
 * frontière : un champ de CV qui apparaîtrait un jour dans la réponse ferait
 * REFUSER la charge, au lieu d'être dépouillé en silence et de laisser la fonction
 * naître côté serveur sans que le front l'apprenne.
 */
export const jobSeekerCardSchema = z
  .object({
    id: uuidSchema,
    headline: z.string(),
    sectors: z.array(z.string()),
    contractTypes: z.array(z.string()),
    updatedAt: z.string().datetime(),
    member: z
      .object({
        handle: handleSchema,
        displayName: z.string(),
        avatarUrl: z.string().nullable(),
        city: jobCityRefSchema.nullable(),
      })
      .strict(),
  })
  .strict();

export type JobSeekerCardView = z.infer<typeof jobSeekerCardSchema>;

/**
 * `GET /job-seekers`.
 *
 * AUCUN `meta` : relevé, pas supposé. `pageSchema` le laisse facultatif, donc la
 * charge réelle passe — et un `meta` qui apparaîtrait un jour ne casserait rien.
 */
export const jobSeekersListResponseSchema = pageSchema(jobSeekerCardSchema);

export type JobSeekersListResponse = z.infer<typeof jobSeekersListResponseSchema>;

/** `GET /me/job-seeker-profile` — l'objet, ou `null` quand le membre n'en a pas. */
export const myJobSeekerProfileResponseSchema = z
  .object({
    headline: z.string(),
    sectors: z.array(z.string()),
    contractTypes: z.array(z.string()),
    isVisible: z.boolean(),
    updatedAt: z.string().datetime(),
  })
  .strict()
  .nullable();

export type MyJobSeekerProfileResponse = z.infer<typeof myJobSeekerProfileResponseSchema>;
