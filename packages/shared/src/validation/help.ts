import { z } from 'zod';
import {
  HelpKind,
  HelpStatus,
  HelpType,
  HelpType2,
  Phase,
  VerificationLevel,
} from '../enums/generated.js';
import {
  cursorQuerySchema,
  DEFAULT_PAGE_LIMIT,
  handleSchema,
  MAX_PAGE_LIMIT,
  pageSchema,
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

// ── Schémas de RÉPONSE (§5) ─────────────────────────────────────────────────
//
// ILS SONT ÉCRITS SUR LA CHARGE RÉELLE, pas sur la lecture du service.
//
// Chaque champ ci-dessous a été relevé en appelant l'API qui tourne, avec deux
// membres réellement créés, une demande réellement publiée et une réponse
// réellement écrite. La leçon vient de `connections.ts` et elle y est écrite : un
// schéma lu sur le SERVICE décrit une liste nue que le CONTRÔLEUR enveloppe, et
// c'est l'écran qui reste sur son état d'attente.
//
// Ici le contrôleur n'enveloppe rien — il rend `this.help.list(…)` tel quel — mais
// DEUX formes auraient été fausses si on les avait devinées, et les deux ont été
// MESURÉES :
//
//   · `POST /help` ne rend PAS `{ id }`. Il rend le DÉTAIL complet
//     (`{ request, journeyContext, responses, meta }`), parce que `create()`
//     termine par `return this.detail(…)`. Un client qui lirait `corps.id` aurait
//     `undefined`, et l'écran suivant chargerait `/help/undefined` — ce qui est
//     exactement arrivé au script de relève, en `400 VALIDATION_FAILED` sur un
//     chemin, c'est-à-dire un message qui n'accuse pas la bonne chose ;
//   · `dueDate` est une colonne `@db.Date`, et elle se sérialise malgré tout en
//     HORODATAGE COMPLET — `"2026-10-09T00:00:00.000Z"`. Un `z.string().date()`,
//     qui est le réflexe quand on lit `@db.Date` dans le schéma Prisma, REFUSE
//     cette valeur. Relevé, pas supposé.

/**
 * Un membre tel que ce module le montre — `HelpService.summary()`, T4 §6.
 *
 * `.strict()` PARCE QUE C'EST DE L'IDENTITÉ. Sans lui, zod dépouille en silence :
 * si l'API se mettait un jour à joindre un `phone`, un `email` ou une date de
 * naissance à l'auteur d'une demande, la donnée AURAIT TRANSITÉ par le navigateur
 * du membre, et personne ne le saurait — le champ serait simplement absent de
 * l'objet validé. Avec `.strict()`, la réponse est refusée à la frontière et
 * l'incident se voit. C'est la règle dure 01 §2.1 rendue exécutable à l'endroit où
 * elle peut encore être tenue : la maquette `05 Entraide` n'écrit AUCUN numéro —
 * compté, zéro occurrence sur ses vingt cadres — donc le dessin ne protège rien
 * ici, et le rempart est ce schéma.
 */
export const helpMemberSchema = z
  .object({
    id: uuidSchema,
    handle: handleSchema,
    displayName: z.string(),
    /** `/media/<clé>` composé par le service, ou `null` sans avatar. */
    avatarUrl: z.string().nullable(),
    /** AFFICHÉ, jamais employé pour autoriser (00 §7.3). */
    level: z.enum(VerificationLevel),
    phase: z.enum(Phase),
    cityName: z.string().nullable(),
    countryIso2: z.string().length(2),
    isMentor: z.boolean(),
  })
  .strict();

export type HelpMember = z.infer<typeof helpMemberSchema>;

/**
 * La carte de liste — `HelpService.card()`, §5.
 *
 * `.strict()` : c'est du CONTENU de membre. `excerpt` est le corps TRONQUÉ à 280
 * caractères par le serveur ; le champ `body` entier n'existe que sur le détail, et
 * laisser une clé greffée le faire apparaître en liste reviendrait à publier ce que
 * §5 a décidé de tronquer.
 */
export const helpCardSchema = z
  .object({
    id: uuidSchema,
    kind: z.enum(HelpKind),
    type: z.enum(HelpType2),
    title: z.string(),
    excerpt: z.string(),
    status: z.enum(HelpStatus),
    city: z.object({ id: uuidSchema, name: z.string() }).strict(),
    /** Horodatage complet, mesuré — voir l'en-tête de cette section. */
    dueDate: z.string().datetime().nullable(),
    responseCount: z.number().int().min(0),
    createdAt: z.string().datetime(),
    resolvedAt: z.string().datetime().nullable(),
    resolvedByResponseId: uuidSchema.nullable(),
    /** Pastille « Depuis un parcours » (§2.5) — sans rien dire du parcours. */
    fromJourney: z.boolean(),
    author: helpMemberSchema,
    isAuthor: z.boolean(),
  })
  .strict();

export type HelpCard = z.infer<typeof helpCardSchema>;

/**
 * Le `meta` que TOUTE réponse de ce module porte.
 *
 * `safetyBanner` est la règle dure de §2.7 — « chaque page de la section l'affiche
 * en permanence » — et elle voyage avec la réponse plutôt qu'en dur dans un
 * composant. Le schéma l'EXIGE donc : une API qui cesserait de l'envoyer verrait sa
 * réponse refusée, au lieu de produire des écrans sans leur avertissement.
 *
 * `reason` n'apparaît que sur « Vous pouvez aider » sans critère (`NO_CRITERIA`) ;
 * `open` et `resolvedThisMonth` ne sont comptés que par `GET /help`. Les trois sont
 * donc facultatifs ici et resserrés là où ils sont attendus.
 */
export const helpMetaSchema = z
  .object({
    safetyBanner: z.string().min(1),
    useServicesHint: z.string().min(1),
    reason: z.literal('NO_CRITERIA').optional(),
    open: z.number().int().min(0).optional(),
    resolvedThisMonth: z.number().int().min(0).optional(),
  })
  .strict();

/** `GET /help` (§4) — le fil, avec ses deux compteurs de ville. */
export const helpListResponseSchema = pageSchema(helpCardSchema).extend({
  meta: helpMetaSchema,
});

export type HelpListResponse = z.infer<typeof helpListResponseSchema>;

/**
 * `GET /help/can-help` (§2.6).
 *
 * `nextCursor` EST PRÉSENT ET TOUJOURS NUL : le service le rend explicitement
 * (`nextCursor: null`), parce que c'est une suggestion calculée et non une archive
 * à parcourir. On décrit ce que l'API envoie, pas ce qu'on aurait aimé.
 */
export const helpCanHelpResponseSchema = pageSchema(helpCardSchema).extend({
  meta: helpMetaSchema,
});

export type HelpCanHelpResponse = z.infer<typeof helpCanHelpResponseSchema>;

/** `GET /help/mine` (§4) — mes demandes, archivées comprises. */
export const helpMineResponseSchema = pageSchema(helpCardSchema).extend({
  meta: helpMetaSchema,
});

export type HelpMineResponse = z.infer<typeof helpMineResponseSchema>;

/** `GET /help/my-responses` (§4) — ma réponse, et la demande qui la porte. */
export const helpMyResponsesResponseSchema = pageSchema(
  z
    .object({
      id: uuidSchema,
      body: z.string(),
      createdAt: z.string().datetime(),
      markedHelpful: z.boolean(),
      markedAt: z.string().datetime().nullable(),
      request: helpCardSchema,
    })
    .strict(),
).extend({ meta: helpMetaSchema });

export type HelpMyResponsesResponse = z.infer<typeof helpMyResponsesResponseSchema>;

/**
 * La ligne de contexte de §2.5.
 *
 * RÈGLE DURE (§2.5 et 04 §2) : le TYPE de parcours, JAMAIS son titre personnel.
 * `.strict()` est donc ici le garde-fou de cette règle précise : un `journeyTitle`
 * greffé serait REFUSÉ au lieu d'être dépouillé en silence — et dépouillé en
 * silence, il aurait quand même traversé le réseau.
 *
 * NON RELEVÉE SUR UNE CHARGE RÉELLE, et il faut le dire : produire un
 * `journeyContext` non nul demande une demande issue d'une étape de parcours, que
 * ce lot n'a pas construite. La forme est donc celle de `journeyContext()` dans le
 * service. Les deux moitiés du contrôle ne sont pas tenues pour ce seul objet.
 */
export const helpJourneyContextSchema = z
  .object({
    stepName: z.string(),
    journeyTypeName: z.string(),
    dueDate: z.string().datetime().nullable(),
    dueInDays: z.number().int().nullable(),
  })
  .strict();

/**
 * `GET /help/:id` (§4) — ET AUSSI la réponse de `POST /help` et de `PATCH /help/:id`.
 *
 * Les trois routes rendent la même forme, parce que `create()` et `update()`
 * terminent par `return this.detail(…)`. C'est mesuré, et c'est le piège décrit en
 * tête de section.
 */
export const helpDetailResponseSchema = z
  .object({
    request: helpCardSchema.extend({
      /** Le corps ENTIER, que la carte tronque. */
      body: z.string(),
      updatedAt: z.string().datetime(),
    }),
    journeyContext: helpJourneyContextSchema.nullable(),
    responses: z.array(
      z
        .object({
          id: uuidSchema,
          body: z.string(),
          createdAt: z.string().datetime(),
          markedHelpful: z.boolean(),
          markedAt: z.string().datetime().nullable(),
          author: helpMemberSchema,
          /** §2.4 : l'auteur marque UNE réponse, et seulement tant qu'elle est ouverte. */
          canMarkHelpful: z.boolean(),
        })
        .strict(),
    ),
    meta: helpMetaSchema,
  })
  .strict();

export type HelpDetailResponse = z.infer<typeof helpDetailResponseSchema>;

/** `POST /help/:id/responses` (§2.3) : l'identifiant de la réponse créée. */
export const helpResponseCreatedSchema = z
  .object({ id: uuidSchema, meta: helpMetaSchema })
  .strict();

export type HelpResponseCreated = z.infer<typeof helpResponseCreatedSchema>;

/**
 * `POST /help/:id/private-reply` (§2.3) : la conversation directe avec l'auteur.
 *
 * `created` distingue l'ouverture de la reprise. `.strict()` : c'est une MISE EN
 * RELATION, et la règle dure du module veut qu'aucune n'échappe à un blocage — un
 * champ greffé ici serait une fuite au sens le plus strict du terme.
 */
export const helpPrivateReplyResponseSchema = z
  .object({ conversationId: uuidSchema, created: z.boolean() })
  .strict();

export type HelpPrivateReplyResponse = z.infer<typeof helpPrivateReplyResponseSchema>;
