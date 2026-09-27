import { z } from 'zod';
import { HelpType, HelpType2 } from '../enums/generated.js';
import {
  cursorQuerySchema,
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
  uuidSchema,
} from './pagination.js';

/**
 * Fil d'entraide — 06-entraide.md §2 et §4.
 *
 * SOURCE UNIQUE (00 §4) : ces schémas valident l'API ET le composeur du front.
 * Les bornes de §2.2 (titre 10–120, corps 20–2 000) ne sont donc écrites qu'une
 * fois : un composeur qui compterait autrement laisserait le membre rédiger un
 * texte que l'API refuse ensuite.
 */

// ── Vocabulaire ─────────────────────────────────────────────────────────────

export const helpKindSchema = z.enum(['REQUEST', 'OFFER']);

/** Les cinq types de §2.1. Ni logement ni emploi : ils vivent dans Services. */
export const helpTypeSchema = z.enum(HelpType2);

/**
 * Ce que le composeur peut ENVOYER : les cinq types, plus les deux qui doivent
 * être refusés par un message clair.
 *
 * Pourquoi accepter `HOUSING` et `JOB` au lieu de les laisser tomber sur
 * l'énumération : §4 exige `USE_SERVICES` — « Pour un logement ou un emploi,
 * utilisez Services. » Un simple `VALIDATION_FAILED` sur le champ `type` dirait
 * au membre que sa saisie est mal formée, alors qu'elle est comprise et qu'on
 * sait exactement où l'envoyer.
 */
export const helpTypeInputSchema = z.enum([...HelpType2, 'HOUSING', 'JOB']);

export type HelpTypeInput = z.infer<typeof helpTypeInputSchema>;

/** Les deux types qui relèvent de Services (module 10) et non de l'entraide. */
export const HELP_TYPES_IN_SERVICES: readonly HelpTypeInput[] = ['HOUSING', 'JOB'];

/**
 * Correspondance entre les types d'aide DÉCLARÉS au profil (`user_profiles.
 * help_types`, énumération `HelpType` du module 01) et les types de DEMANDE
 * (`HelpType2` du module 06). Sert à « Vous pouvez aider » (§2.6).
 *
 * Les deux énumérations ne coïncident pas — c'est une divergence du schéma, pas
 * un choix de ce module : `HelpType` porte `HOUSING`, `JOB` et `WELCOME`, que
 * §2.1 exclut ou ne nomme pas, et ignore `SERVICE`, `RIDE`, `MATERIAL`.
 *
 *   · `HOUSING` et `JOB` ne correspondent à RIEN ici : §2.1 les renvoie à
 *     Services. Un membre qui ne déclare que ceux-là n'a donc aucune suggestion
 *     d'entraide — et c'est la bonne réponse, pas un trou.
 *   · `WELCOME` (« aider à l'arrivée ») couvre les trois formes concrètes que
 *     prend l'accueil dans §2.1 : rendre un service, emmener quelqu'un, prêter
 *     du matériel.
 */
export const HELP_TYPES_FROM_PROFILE: Record<
  (typeof HelpType)[number],
  readonly (typeof HelpType2)[number][]
> = {
  PAPERWORK: ['PAPERWORK'],
  WELCOME: ['SERVICE', 'RIDE', 'MATERIAL'],
  OTHER: ['OTHER'],
  HOUSING: [],
  JOB: [],
};

// ── Textes imposés (T2 §6) ──────────────────────────────────────────────────

/**
 * RÈGLE DURE (§2.7) : « Chaque page de la section affiche en permanence [cette
 * phrase]. » Elle est renvoyée par l'API dans le `meta` de chaque réponse
 * (T4 §4), et non codée en dur dans le front : une règle de sécurité qui vit
 * dans un composant disparaît au premier écran qu'on oublie de brancher.
 */
export const HELP_SAFETY_BANNER =
  'Aucun versement entre membres pour une démarche administrative. ' +
  'Si on vous demande de l’argent, signalez.';

/** Rappel du composeur (§2.1), et message de l'erreur `USE_SERVICES`. */
export const HELP_USE_SERVICES_HINT = 'Pour un logement ou un emploi, utilisez Services.';

// ── Bornes et limites ───────────────────────────────────────────────────────

/**
 * Les nombres de §2.2, §2.3, §4 et §7, à un seul endroit. Le front en a besoin
 * pour compter les caractères et griser un bouton avant l'appel.
 */
export const HELP_LIMITS = {
  titleMin: 10,
  titleMax: 120,
  bodyMin: 20,
  bodyMax: 2_000,
  /** Une réponse est plus courte qu'une demande (§2.3). */
  responseBodyMin: 10,
  responseBodyMax: 2_000,
  /** §4 : 5 demandes par jour. */
  requestsPerDay: 5,
  /** §2.3 et §4 : 30 réponses par heure. */
  responsesPerHour: 30,
  /** §2.2 : l'auteur peut rouvrir dans les 7 jours (erreur de clic). */
  reopenWindowDays: 7,
  /** §2.2 et §7 : OPEN sans réponse depuis 45 jours. */
  archiveOpenDays: 45,
  /** §2.2 et §7 : RESOLVED depuis 90 jours. */
  archiveResolvedDays: 90,
  /** §4 : rayon par défaut de la recherche par ville. */
  defaultRadiusKm: 30,
  maxRadiusKm: 200,
} as const;

// ── Codes d'erreur propres au module (§4) ───────────────────────────────────

export const HELP_ERROR_CODES = {
  /** Type logement ou emploi : la demande relève de Services (module 10). */
  USE_SERVICES: 422,
  /** Règle locale de modération : coordonnées bancaires, demande de paiement. */
  CONTENT_BLOCKED: 422,
  /** Demande résolue ou archivée : plus de nouvelles réponses (§2.2). */
  REQUEST_CLOSED: 409,
  /** L'auteur ne répond pas à sa propre demande (§2.3). */
  OWN_REQUEST: 422,
  /** Seul l'auteur de la demande marque « ça m'a aidé » (§2.4). */
  NOT_AUTHOR: 403,
  /** Au-delà de 7 jours, la réouverture n'est plus une erreur de clic (§2.2). */
  REOPEN_WINDOW_CLOSED: 422,
} as const;

export type HelpErrorCode = keyof typeof HELP_ERROR_CODES;

export const HELP_ERROR_MESSAGES: Record<HelpErrorCode, string> = {
  USE_SERVICES: HELP_USE_SERVICES_HINT,
  // Motif GÉNÉRIQUE (13 §2) : détailler la règle déclenchée apprendrait à la
  // contourner à qui cherche justement à la contourner.
  CONTENT_BLOCKED: 'Ce texte ne peut pas être publié en l’état.',
  REQUEST_CLOSED: 'Cette demande est clôturée. Elle n’accepte plus de réponses.',
  OWN_REQUEST: 'Vous ne pouvez pas répondre à votre propre demande.',
  NOT_AUTHOR: 'Seule la personne qui a publié la demande peut faire cela.',
  REOPEN_WINDOW_CLOSED: 'Le délai de réouverture de 7 jours est dépassé.',
};

// ── Schémas d'écriture ──────────────────────────────────────────────────────

const titleSchema = z.string().trim().min(HELP_LIMITS.titleMin).max(HELP_LIMITS.titleMax);
const bodySchema = z.string().trim().min(HELP_LIMITS.bodyMin).max(HELP_LIMITS.bodyMax);

export const createHelpSchema = z
  .object({
    kind: helpKindSchema,
    type: helpTypeInputSchema,
    title: titleSchema,
    body: bodySchema,
    /** Obligatoire (§2.2) : une demande d'entraide sans ville n'atteint personne. */
    cityId: uuidSchema,
    dueDate: z.string().date().optional(),
    /**
     * Demande issue d'un parcours (§2.5). L'étape doit appartenir à un parcours
     * du membre : le service le vérifie, et renvoie 404 sinon.
     */
    originJourneyStepId: uuidSchema.optional(),
  })
  .strict();

export type CreateHelp = z.infer<typeof createHelpSchema>;

export const updateHelpSchema = z
  .object({
    type: helpTypeInputSchema.optional(),
    title: titleSchema.optional(),
    body: bodySchema.optional(),
    cityId: uuidSchema.optional(),
    /** `null` efface l'échéance ; absent la laisse telle quelle. */
    dueDate: z.string().date().nullable().optional(),
  })
  .strict();

export type UpdateHelp = z.infer<typeof updateHelpSchema>;

export const createHelpResponseSchema = z
  .object({
    body: z
      .string()
      .trim()
      .min(HELP_LIMITS.responseBodyMin)
      .max(HELP_LIMITS.responseBodyMax),
  })
  .strict();

export type CreateHelpResponse = z.infer<typeof createHelpResponseSchema>;

// ── Schémas de lecture ──────────────────────────────────────────────────────

/**
 * Filtres de `GET /help` (§4).
 *
 * `status` n'accepte QUE `OPEN` et `RESOLVED` : §2.2 dit qu'une demande archivée
 * est « invisible dans les listes, accessible par lien direct et recherche ».
 * Offrir `status=ARCHIVED` ici rouvrirait par la porte du filtre ce que la règle
 * ferme — c'est donc l'énumération, et non le service, qui l'interdit.
 */
export const helpListQuerySchema = cursorQuerySchema.extend({
  kind: helpKindSchema.optional(),
  type: helpTypeSchema.optional(),
  cityId: uuidSchema.optional(),
  radiusKm: z.coerce
    .number()
    .int()
    .min(0)
    .max(HELP_LIMITS.maxRadiusKm)
    .default(HELP_LIMITS.defaultRadiusKm),
  status: z.enum(['OPEN', 'RESOLVED']).default('OPEN'),
  /** Phase de l'AUTEUR : cibler les pré-départ, ou au contraire les installés. */
  phase: z.enum(['PRE_DEPARTURE', 'RECENT_ARRIVAL', 'SETTLED']).optional(),
  fromJourney: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
});

export type HelpListQuery = z.infer<typeof helpListQuerySchema>;

/**
 * « Vous pouvez aider » (§2.6). PAS de curseur, volontairement : la liste est
 * calculée depuis le profil et les étapes franchies du membre, triée par échéance
 * la plus proche. C'est un encadré de suggestions, pas une archive à parcourir —
 * et paginer par curseur un tri sur une date nullable demanderait un curseur
 * composite pour une colonne de droite.
 */
export const helpCanHelpQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_LIMIT).default(DEFAULT_PAGE_LIMIT),
  radiusKm: z.coerce
    .number()
    .int()
    .min(0)
    .max(HELP_LIMITS.maxRadiusKm)
    .default(HELP_LIMITS.defaultRadiusKm),
});

export type HelpCanHelpQuery = z.infer<typeof helpCanHelpQuerySchema>;

export const helpMineQuerySchema = cursorQuerySchema.extend({
  /** Mes demandes archivées m'appartiennent : je dois pouvoir les retrouver. */
  status: z.enum(['OPEN', 'RESOLVED', 'ARCHIVED']).optional(),
});

export type HelpMineQuery = z.infer<typeof helpMineQuerySchema>;

/** `GET /help/my-responses` : mes réponses, sans filtre d'état. */
export const helpMyResponsesQuerySchema = cursorQuerySchema;

export type HelpMyResponsesQuery = z.infer<typeof helpMyResponsesQuerySchema>;
