import { z } from 'zod';
import {
  BlockerStatus,
  BlockerTarget,
  JourneyMemberRole,
  JourneyStatus,
  JourneyVisibility,
  Phase,
} from '../enums/generated.js';
import { cursorQuerySchema, handleSchema, uuidSchema } from './pagination.js';

/**
 * Parcours — 03-parcours.md et T3 partie A.
 *
 * SOURCE UNIQUE (00 §4) : ces schémas valident l'API ET les formulaires du front.
 * Trois choses valent d'être dites avant de lire :
 *
 * 1. LE TITRE PERSONNEL NE SORT JAMAIS DU PARCOURS (03 §3.7, 04 §2, 06 §2.5).
 *    C'est pourquoi les gabarits de « Je suis bloqué » ci-dessous portent la
 *    variable `{parcours}` — et que le service la remplit avec le NOM DU TYPE,
 *    jamais avec `journeys.title`. Le gabarit vit ici pour qu'une seule
 *    définition serve à l'aperçu du front et au pré-remplissage du serveur.
 *
 * 2. AUCUN ÉTAT D'ÉCHEC (03 §3.2, règle dure). L'énumération des états d'étape
 *    vient du schéma PostgreSQL, qui n'en porte pas ; mais la TRANSITION
 *    acceptable, elle, est décrite ici — et le vocabulaire est « mise en pause »,
 *    jamais un abandon d'étape.
 *
 * 3. RIEN N'EST PUBLIÉ SANS UN APPEL EXPLICITE (03 §1.2 et §3.5). D'où deux
 *    schémas distincts : le brouillon de blocage n'a PAS de corps — il est créé
 *    par un clic — et la publication exige le texte, la portée, et les champs de
 *    la cible. Un seul schéma pour les deux étapes aurait permis de publier en
 *    une requête, ce que la règle dure interdit.
 */

// ── Bornes (§3, T3 partie C) ────────────────────────────────────────────────

/** `journeys.title` — proposé = nom du type, librement modifiable (§3.1). */
export const JOURNEY_TITLE_MIN = 2;
export const JOURNEY_TITLE_MAX = 120;

export const JOURNEY_STEP_TITLE_MIN = 2;
export const JOURNEY_STEP_TITLE_MAX = 160;
export const JOURNEY_STEP_DESCRIPTION_MAX = 4_000;

/** Notes personnelles d'étape, chiffrées au repos (§8.1). */
export const JOURNEY_NOTES_MAX = 4_000;

/** §3.3 : des libellés cochables, et AUCUN fichier. */
export const CHECKLIST_LABEL_MAX = 200;
export const CHECKLIST_MAX_ITEMS = 50;

/** §3.4 : « Maximum 10 membres par parcours. » */
export const JOURNEY_MAX_MEMBERS = 10;

/** T3 partie C : `journey.inactivity_days` et `journey.reminder_days`. */
export const JOURNEY_INACTIVITY_DAYS = 60;
export const JOURNEY_REMINDER_DAYS: readonly number[] = [14, 7, 1];

/** §3.1 : un seul parcours ACTIVE ou PAUSED en gratuit. */
export const JOURNEY_FREE_ACTIVE_LIMIT = 1;

/** §3.5 : le texte du blocage, écrit par le membre. */
export const BLOCKER_TEXT_MIN = 20;
export const BLOCKER_TEXT_MAX = 2_000;

/** §3.6 : le champ de partage est VIDE au départ — aucun texte pré-rédigé. */
export const MILESTONE_TEXT_MIN = 1;
export const MILESTONE_TEXT_MAX = 3_000;

export const TEMPLATE_ERROR_MESSAGE_MIN = 10;
export const TEMPLATE_ERROR_MESSAGE_MAX = 2_000;

/** §3.7 : la liste du panneau en montre cinq. */
export const PUBLIC_JOURNEYS_PANEL_LIMIT = 5;
export const PUBLIC_JOURNEYS_MAX_LIMIT = 50;

// ── Gabarits de « Je suis bloqué » (T3 A.1) ─────────────────────────────────

/**
 * Les quatre gabarits de T3, par cible.
 *
 * Variables : `{etape}`, `{parcours}`, `{ville}`, `{echeance}`. `{parcours}` est
 * le NOM DU TYPE (« Études »), jamais le titre que le membre a donné à son
 * parcours — c'est la règle dure de 03 §3.7 et de 06 §2.5, et c'est la raison
 * d'être de cette table : un gabarit écrit dans le service finirait par
 * interpoler ce qui traîne à portée de main.
 *
 * `NONE` n'a pas de gabarit : l'étape ne propose pas de bouton (T3 A.1).
 */
export const BLOCKER_TEMPLATES: Record<Exclude<BlockerTarget, 'NONE'>, string> = {
  HELP:
    'Je suis bloqué·e à l’étape {etape} de mon parcours {parcours} ({ville}, échéance {echeance}). ' +
    'Voici où j’en suis : ',
  HOUSING:
    'Je cherche un logement à {ville} pour {echeance}, dans le cadre de mon parcours {parcours}. ' +
    'Budget, durée, quartiers souhaités : ',
  JOBS:
    'Je cherche une offre pour l’étape {etape} de mon parcours {parcours} à {ville}. ' +
    'Domaine, disponibilité, type de contrat : ',
  MENTORSHIP:
    'J’aimerais être accompagné·e pour {etape} ({parcours}, {ville}). ' +
    'Ce que j’attends d’un parrain : ',
};

/** T3 A.1 : le message d'une étape à risque, affiché avant de commencer. */
export const STEP_RISK_MESSAGE =
  'Beaucoup de membres ont eu besoin d’aide ici. Regardez les guides les plus utiles avant de ' +
  'commencer, et n’hésitez pas à demander.';

/**
 * §3.3, texte imposé : il voyage avec la checklist plutôt que d'être codé dans le
 * front, comme les autres bandeaux obligatoires (T4 §4).
 */
export const CHECKLIST_NOTICE =
  'Cochez ce que vous avez réuni. Les documents restent chez vous.';

/**
 * Rend un gabarit. Les variables absentes de `values` restent telles quelles —
 * un gabarit administré en back-office peut porter une variable que ce code ne
 * connaît pas, et la faire disparaître serait pire que la laisser voir.
 *
 * `split`/`join` et non une expression rationnelle globale : un `RegExp` avec le
 * drapeau `g` conserve son `lastIndex` entre deux appels, et un gabarit sur deux
 * ressortait alors non remplacé.
 */
export function renderBlockerTemplate(
  template: string,
  values: Readonly<Record<string, string>>,
): string {
  let out = template;
  for (const [key, value] of Object.entries(values)) {
    out = out.split(`{${key}}`).join(value);
  }
  return out;
}

// ── Codes d'erreur (§5.1) ───────────────────────────────────────────────────

export const JOURNEY_ERROR_CODES = {
  /** §2.1 : « Un type sans version publiée n'est pas proposé. » */
  TEMPLATE_UNAVAILABLE: 422,
  /** §3.2 : la transition demandée n'existe pas dans le tableau des états. */
  INVALID_TRANSITION: 409,
  /** §3.4 : dix membres au maximum. */
  MAX_MEMBERS: 422,
  /** §3.5 : le brouillon a déjà donné un contenu. */
  BLOCKER_ALREADY_PUBLISHED: 409,
  /** §3.5 : brouillon annulé — il n'est plus publiable. */
  BLOCKER_CANCELLED: 409,
  /**
   * L'étape ne propose pas de blocage (`blocker_target = NONE`, T3 A.1).
   *
   * §3.5 ne nomme pas ce refus : il part du principe que le bouton n'existe pas à
   * l'écran. Le serveur ne peut pas s'y fier — un client peut toujours appeler la
   * route — et un `VALIDATION_FAILED` sur un champ absent du corps ne dirait rien.
   */
  BLOCKER_NOT_AVAILABLE: 409,
  /**
   * Cible dont la publication publique n'est pas livrée (HOUSING, JOBS,
   * MENTORSHIP). Le brouillon reste publiable en PRIVÉ.
   */
  BLOCKER_TARGET_UNSUPPORTED: 409,
  /** §3.6 : le partage de victoire ne concerne que les jalons majeurs. */
  NOT_A_MILESTONE: 422,
  /** §3.6 : on ne partage pas une étape qu'on n'a pas franchie. */
  STEP_NOT_DONE: 422,
  /** §3.2 : le parcours doit être ACTIVE pour avancer. */
  JOURNEY_STATE: 409,
  /**
   * §3.1 suppose la ville et le pays connus (écran 3 de l'onboarding les pose).
   * `journeys.destination_city_id` est NOT NULL : sans ville, aucun parcours ne
   * peut exister, et le dire vaut mieux qu'un échec de contrainte.
   */
  LOCATION_REQUIRED: 409,
} as const;

export type JourneyErrorCode = keyof typeof JOURNEY_ERROR_CODES;

export const JOURNEY_ERROR_MESSAGES: Record<JourneyErrorCode, string> = {
  TEMPLATE_UNAVAILABLE: 'Ce type de parcours n’est pas encore disponible.',
  INVALID_TRANSITION: 'Cette étape ne peut pas passer directement dans cet état.',
  MAX_MEMBERS: `Un parcours accompagne au maximum ${JOURNEY_MAX_MEMBERS} personnes.`,
  BLOCKER_ALREADY_PUBLISHED: 'Cette demande a déjà été publiée.',
  BLOCKER_CANCELLED: 'Cette demande a été annulée. Recommencez depuis l’étape.',
  BLOCKER_NOT_AVAILABLE: 'Cette étape ne propose pas de demande d’aide.',
  BLOCKER_TARGET_UNSUPPORTED:
    'La publication publique n’est pas encore disponible pour cette section. ' +
    'Vous pouvez envoyer votre demande à votre équipe.',
  NOT_A_MILESTONE: 'Cette étape n’est pas un jalon majeur.',
  STEP_NOT_DONE: 'Marquez l’étape comme franchie avant de la partager.',
  JOURNEY_STATE: 'Ce parcours n’est pas actif.',
  LOCATION_REQUIRED: 'Indiquez votre ville d’arrivée avant de créer un parcours.',
};

// ── Écritures — parcours ────────────────────────────────────────────────────

const titleSchema = z.string().trim().min(JOURNEY_TITLE_MIN).max(JOURNEY_TITLE_MAX);

/** §5.1 : `templateId`, `title`, `targetArrivalDate?`. */
export const createJourneySchema = z
  .object({
    templateId: uuidSchema,
    /** Absent = le nom du type (§3.1). */
    title: titleSchema.optional(),
    targetArrivalDate: z.string().date().optional(),
  })
  .strict();

export type CreateJourney = z.infer<typeof createJourneySchema>;

/**
 * §5.1 : `status` n'accepte que les trois valeurs qu'un MEMBRE peut poser.
 * `COMPLETED` passe par la clôture de la dernière étape (§3.2) ou par la réponse
 * à la relance d'inactivité (§3.9) — l'offrir ici permettrait de déclarer un
 * parcours terminé sans qu'aucune étape le soit, et les durées réelles des
 * parcours publics en seraient faussées. `ARCHIVED` est réservé au système.
 */
export const journeyMemberStatusPatchSchema = z.enum(['ACTIVE', 'PAUSED', 'ABANDONED']);

export const updateJourneySchema = z
  .object({
    title: titleSchema.optional(),
    /** `null` efface la date cible et, avec elle, le rétro-planning (§2.3). */
    targetArrivalDate: z.string().date().nullable().optional(),
    status: journeyMemberStatusPatchSchema.optional(),
    visibility: z.enum(JourneyVisibility).optional(),
  })
  .strict()
  .refine((v) => Object.values(v).some((field) => field !== undefined), {
    message: 'Aucune modification.',
  });

export type UpdateJourney = z.infer<typeof updateJourneySchema>;

// ── Écritures — étapes ──────────────────────────────────────────────────────

export const createJourneyStepSchema = z
  .object({
    title: z.string().trim().min(JOURNEY_STEP_TITLE_MIN).max(JOURNEY_STEP_TITLE_MAX),
    description: z.string().trim().max(JOURNEY_STEP_DESCRIPTION_MAX).optional(),
    dueDate: z.string().date().optional(),
    /** Absent = en fin de liste. */
    position: z.number().int().min(1).max(500).optional(),
  })
  .strict();

export type CreateJourneyStep = z.infer<typeof createJourneyStepSchema>;

/**
 * §5.1 : `title`, `description`, `status`, `dueDate`, `notes`.
 *
 * `PAUSED` figure dans l'énumération et c'est une MISE EN PAUSE, pas un échec
 * (règle dure §3.2) : aucun état d'échec n'existe, ni ici ni en base.
 */
export const journeyStepStatusPatchSchema = z.enum(['TODO', 'IN_PROGRESS', 'DONE', 'PAUSED']);

export const updateJourneyStepSchema = z
  .object({
    title: z.string().trim().min(JOURNEY_STEP_TITLE_MIN).max(JOURNEY_STEP_TITLE_MAX).optional(),
    description: z.string().trim().max(JOURNEY_STEP_DESCRIPTION_MAX).nullable().optional(),
    status: journeyStepStatusPatchSchema.optional(),
    /**
     * Une échéance saisie ici est MANUELLE : le rétro-planning ne l'écrasera plus
     * (§2.3, colonne `due_date_manual`). `null` la rend au rétro-planning.
     */
    dueDate: z.string().date().nullable().optional(),
    /** Notes personnelles, chiffrées au repos. `null` les effface. */
    notes: z.string().trim().max(JOURNEY_NOTES_MAX).nullable().optional(),
  })
  .strict()
  .refine((v) => Object.values(v).some((field) => field !== undefined), {
    message: 'Aucune modification.',
  });

export type UpdateJourneyStep = z.infer<typeof updateJourneyStepSchema>;

/** §5.1 : « Liste ordonnée d'identifiants ». */
export const reorderStepsSchema = z
  .object({ stepIds: z.array(uuidSchema).min(1).max(500) })
  .strict();

export type ReorderSteps = z.infer<typeof reorderStepsSchema>;

/** §5.1 : la liste COMPLÈTE remplace la précédente. */
export const replaceChecklistSchema = z
  .object({
    items: z
      .array(
        z
          .object({
            label: z.string().trim().min(1).max(CHECKLIST_LABEL_MAX),
            isChecked: z.boolean().default(false),
          })
          .strict(),
      )
      .max(CHECKLIST_MAX_ITEMS),
  })
  .strict();

export type ReplaceChecklist = z.infer<typeof replaceChecklistSchema>;

// ── Écritures — équipe (§3.4) ───────────────────────────────────────────────

export const addJourneyMemberSchema = z
  .object({ userHandle: handleSchema, role: z.enum(JourneyMemberRole) })
  .strict();

export type AddJourneyMember = z.infer<typeof addJourneyMemberSchema>;

// ── Écritures — « Je suis bloqué » (§3.5) ───────────────────────────────────

/**
 * La publication d'un blocage.
 *
 * `text` est OBLIGATOIRE et c'est lui qui est publié, tel quel (règle dure
 * §3.5) : le serveur ne republie jamais son gabarit. Les champs propres à la
 * cible ne sont demandés que pour une publication publique — un envoi privé part
 * dans la discussion du parcours et n'a besoin de rien d'autre.
 */
export const publishBlockerSchema = z
  .object({
    text: z.string().trim().min(BLOCKER_TEXT_MIN).max(BLOCKER_TEXT_MAX),
    /** §3.5 : privé = accompagnants et parrain seulement, rien de public. */
    isPrivate: z.boolean(),
    /** Cible HELP : le titre de la demande d'entraide (06 §2.2). */
    title: z.string().trim().min(10).max(120).optional(),
    /** Cible HELP : le type de demande. Défaut `PAPERWORK` (06 §2.1). */
    helpType: z.enum(['PAPERWORK', 'SERVICE', 'RIDE', 'MATERIAL', 'OTHER']).optional(),
    /** Cible HELP : la ville. Défaut = ville de destination du parcours. */
    cityId: uuidSchema.optional(),
  })
  .strict()
  .refine((v) => v.isPrivate || v.title !== undefined, {
    path: ['title'],
    message: 'Une publication publique demande un titre.',
  });

export type PublishBlocker = z.infer<typeof publishBlockerSchema>;

// ── Écritures — partage de jalon (§3.6) ─────────────────────────────────────

/** Le champ est VIDE à l'écran : c'est le membre qui écrit, jamais un gabarit. */
export const shareMilestoneSchema = z
  .object({ text: z.string().trim().min(MILESTONE_TEXT_MIN).max(MILESTONE_TEXT_MAX) })
  .strict();

export type ShareMilestone = z.infer<typeof shareMilestoneSchema>;

// ── Écritures — relance d'inactivité et corrections (§3.9, §2.4) ────────────

/** §3.9 : quatre réponses à « Où en êtes-vous ? ». */
export const inactivityResponseSchema = z
  .object({ answer: z.enum(['CONTINUE', 'PAUSED', 'COMPLETED', 'ABANDONED']) })
  .strict();

export type InactivityResponse = z.infer<typeof inactivityResponseSchema>;

export const reportTemplateErrorSchema = z
  .object({
    stepId: uuidSchema.optional(),
    message: z.string().trim().min(TEMPLATE_ERROR_MESSAGE_MIN).max(TEMPLATE_ERROR_MESSAGE_MAX),
  })
  .strict();

export type ReportTemplateError = z.infer<typeof reportTemplateErrorSchema>;

// ── Lectures ────────────────────────────────────────────────────────────────

/**
 * `GET /journeys/public` (§3.7 et §5.1).
 *
 * Pas de curseur : la route rend au plus cinquante lignes triées par PROXIMITÉ
 * d'avancement, un ordre qui n'est pas stable dans le temps et sur lequel un
 * curseur signé mentirait. §5.1 ne nomme d'ailleurs que `limit`.
 */
export const publicJourneysQuerySchema = z
  .object({
    templateCode: z.string().trim().min(2).max(60).optional(),
    cityId: uuidSchema.optional(),
    /** Avancement de référence pour le tri « proche du mien » (0–100). */
    progressNear: z.coerce.number().int().min(0).max(100).optional(),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(PUBLIC_JOURNEYS_MAX_LIMIT)
      .default(PUBLIC_JOURNEYS_PANEL_LIMIT),
  })
  .strict();

export type PublicJourneysQuery = z.infer<typeof publicJourneysQuerySchema>;

/** `GET /journeys/:id/activities` (§3.8) : journal paginé par curseur. */
export const journeyActivitiesQuerySchema = cursorQuerySchema;

export type JourneyActivitiesQuery = z.infer<typeof journeyActivitiesQuerySchema>;

// ── Réponses ────────────────────────────────────────────────────────────────

/**
 * LES SCHÉMAS DE RÉPONSE VIVENT ICI, PAS DANS LE FRONT.
 *
 * `00` §4 fait de ce paquet la source unique, et le socle d'appel du front
 * (`apps/web/src/lib/api/index.ts` §2) exige un schéma sur chaque appel. Un
 * schéma recopié dans un fichier du front serait une deuxième définition de la
 * même chose : elle divergerait, et c'est le front qui se tairait.
 *
 * ILS SONT FIGÉS SUR L'API QUI TOURNE, pas sur ce que le dossier promet — la
 * différence a été mesurée route par route au `curl`. Deux écarts valent d'être
 * écrits, parce qu'ils auraient cassé le front en silence :
 *
 *   · `GET /journey-templates` et `GET /journeys` NE PORTENT PAS `nextCursor`.
 *     `pageSchema(item)` le rend obligatoire (§5.3 : « null en fin de liste »),
 *     donc l'employer ici ferait lever `ApiShapeError` sur une réponse
 *     parfaitement valide. Ces deux routes rendent une liste BORNÉE — quatre
 *     modèles, un parcours en gratuit — et n'ont jamais de page suivante ;
 *
 *   · le `meta` de ces routes n'est pas décoratif : il porte la phrase de la
 *     checklist, le plafond d'équipe et les délais de relance (§3.3, §3.4, §3.9).
 *     Il est donc DÉCRIT plutôt que laissé en `record(unknown)`.
 */

/** Le bandeau commun aux routes de parcours (§3.3, §3.4, §3.9). */
export const journeyMetaSchema = z.object({
  /** §3.3, règle dure : « les documents restent chez vous ». */
  checklistNotice: z.string(),
  maxMembers: z.number().int(),
  reminderDays: z.array(z.number().int()),
  inactivityDays: z.number().int(),
});

export type JourneyMeta = z.infer<typeof journeyMetaSchema>;

/** La version du modèle servie par `GET /journey-templates` (§2.1, §2.4). */
export const journeyTemplateVersionSchema = z.object({
  id: uuidSchema,
  version: z.number().int(),
  /**
   * LE NOMBRE D'ÉTAPES VIENT D'ICI, ET DE NULLE PART AILLEURS.
   *
   * La maquette de O03 écrit « 12 étapes » sous « Étudier » : c'est une
   * ILLUSTRATION. L'API répond 15 pour `STUDIES`, parce que le modèle a été
   * rechargé en version 3. Recopier le nombre de la maquette afficherait un
   * engagement faux au moment précis où le membre choisit son parcours.
   */
  stepCount: z.number().int(),
  isCountrySpecific: z.boolean(),
  changelog: z.string().nullable(),
});

export const journeyTemplateSchema = z.object({
  id: uuidSchema,
  code: z.string(),
  nameFr: z.string(),
  description: z.string().nullable(),
  targetPhase: z.enum(Phase),
  icon: z.string().nullable(),
  version: journeyTemplateVersionSchema,
});

export type JourneyTemplate = z.infer<typeof journeyTemplateSchema>;

/**
 * `GET /journey-templates` — les types proposés, résolus pour mon pays (§2.1).
 *
 * Sans `nextCursor` : voir la note d'en-tête de cette section. Mesuré sur l'API.
 */
export const journeyTemplatesResponseSchema = z.object({
  items: z.array(journeyTemplateSchema),
  meta: journeyMetaSchema,
});

export type JourneyTemplatesResponse = z.infer<typeof journeyTemplatesResponseSchema>;

/**
 * Le parcours tel que `POST /journeys` et `GET /journeys/:id` le rendent.
 *
 * Décrit ce dont le front a besoin pour NAVIGUER et pour nommer — l'identifiant,
 * le titre, l'étape en cours, l'avancement. Les champs que zod ne nomme pas sont
 * retirés à la validation, ce qui est le comportement voulu : un champ ajouté par
 * l'API ne casse rien, et un champ RETIRÉ lève `ApiShapeError` à l'appel.
 */
export const journeySummarySchema = z.object({
  id: uuidSchema,
  title: z.string(),
  status: z.enum(JourneyStatus),
  visibility: z.enum(JourneyVisibility),
  progressPct: z.number(),
  /** `null` sur un parcours dont toutes les étapes sont franchies. */
  currentStepId: uuidSchema.nullable(),
  doneCount: z.number().int(),
  totalCount: z.number().int(),
});

export type JourneySummary = z.infer<typeof journeySummarySchema>;

/** `POST /journeys` (§3.1) et `GET /journeys/:id`. */
export const journeyDetailResponseSchema = z.object({
  journey: journeySummarySchema,
  viewerRole: z.string(),
  meta: journeyMetaSchema.optional(),
});

export type JourneyDetailResponse = z.infer<typeof journeyDetailResponseSchema>;

/**
 * UNE LIGNE DE `GET /journeys`, ET CE N'EST PAS LA MÊME FORME QUE `POST /journeys`.
 *
 * Le piège, et il a bien mordu : la liste et le détail décrivent le même objet
 * avec des clés DIFFÉRENTES. Réutiliser `journeySummarySchema` pour les deux
 * paraissait économe, et c'est faux sur trois champs —
 *
 *   · la liste rend `currentStep: { id, title }` là où le détail rend
 *     `currentStepId` ;
 *   · la liste rend `stepCount`, le détail `totalCount` ;
 *   · la liste rend `isOwner`, `memberCount` et `lastActivityAt`, que le détail
 *     n'a pas ; le détail rend `viewerRole` et `owner`, que la liste n'a pas.
 *
 * ── COMMENT L'ERREUR EST PASSÉE, ET CE QU'ELLE COÛTAIT ──────────────────────
 *
 * Elle ne se voyait PAS sur une liste VIDE : `z.array(item)` accepte `[]` quel que
 * soit `item`. L'écran d'atterrissage O05 — le seul appelant — lit justement cette
 * route pour savoir si un parcours existe, et son cas « aucun parcours » passait
 * donc parfaitement. Le cas « un parcours » levait `ApiShapeError`, que l'écran
 * avale, et il retombait sur la variante de l'URL : le membre qui venait de créer
 * son parcours voyait quand même « votre parcours est prêt » — par accident, pour
 * la mauvaise raison, et il aurait vu la même chose sans en avoir aucun.
 *
 * Le test de bout en bout ne l'a pas vu non plus, parce que sa variante par défaut
 * était celle qu'il attendait. C'est la CHARGE RELEVÉE qui l'a montré, en une
 * lecture — et c'est tout l'argument des fixtures : un schéma déduit du code décrit
 * ce que son auteur croyait.
 */
export const journeyListItemSchema = z.object({
  id: uuidSchema,
  title: z.string(),
  /** §3.4 : accompagnant ou propriétaire — la liste mêle les deux. */
  isOwner: z.boolean(),
  status: z.enum(JourneyStatus),
  visibility: z.enum(JourneyVisibility),
  progressPct: z.number(),
  /** `null` quand toutes les étapes sont franchies. */
  currentStep: z.object({ id: uuidSchema, title: z.string() }).nullable(),
  doneCount: z.number().int(),
  stepCount: z.number().int(),
  memberCount: z.number().int(),
});

export type JourneyListItem = z.infer<typeof journeyListItemSchema>;

/** `GET /journeys` (§5.1). Sans `nextCursor` — voir la note d'en-tête. */
export const journeysListResponseSchema = z.object({
  items: z.array(journeyListItemSchema),
  meta: journeyMetaSchema,
});

export type JourneysListResponse = z.infer<typeof journeysListResponseSchema>;

/**
 * `POST /journeys/:id/steps/:stepId/blocker` — le BROUILLON (§3.5).
 *
 * `draftText` est le gabarit rempli par le serveur. Il n'est PAS ce qui sera
 * publié : la règle dure de §3.5 veut que le texte publié soit celui du corps de
 * `POST /blockers/:id/publish`. Le brouillon existe pour être relu et réécrit.
 */
export const blockerDraftResponseSchema = z.object({
  blocker: z.object({
    id: uuidSchema,
    journeyId: uuidSchema,
    journeyStepId: uuidSchema,
    target: z.enum(BlockerTarget),
    status: z.enum(BlockerStatus),
    draftText: z.string(),
  }),
  meta: journeyMetaSchema.optional(),
});

export type BlockerDraftResponse = z.infer<typeof blockerDraftResponseSchema>;

/** `POST /blockers/:id/publish` (§3.5) — la seule route qui promeut. */
export const blockerPublishedResponseSchema = z.object({
  blocker: z.object({
    id: uuidSchema,
    status: z.enum(BlockerStatus),
    target: z.enum(BlockerTarget),
    isPrivate: z.boolean(),
    publishedRefType: z.string().nullable(),
    publishedRefId: uuidSchema.nullable(),
    publishedAt: z.string().nullable(),
  }),
  meta: journeyMetaSchema.optional(),
});

export type BlockerPublishedResponse = z.infer<typeof blockerPublishedResponseSchema>;

/**
 * `POST /blockers/:id/cancel` (§3.5).
 *
 * La forme est PLATE — `{ id, status }` — là où la création et la publication
 * enveloppent dans `blocker`. Mesuré sur l'API ; supposer l'enveloppe ferait
 * lever `ApiShapeError` sur une annulation qui a pourtant réussi, et le membre
 * lirait « une erreur est survenue » après un geste qui a bien eu lieu.
 */
export const blockerCancelledResponseSchema = z.object({
  id: uuidSchema,
  status: z.enum(BlockerStatus),
});

export type BlockerCancelledResponse = z.infer<typeof blockerCancelledResponseSchema>;

/** `POST /journeys/:id/steps/:stepId/dismiss-share` (§3.6). */
export const dismissShareResponseSchema = z.object({ dismissed: z.boolean() });

export type DismissShareResponse = z.infer<typeof dismissShareResponseSchema>;
