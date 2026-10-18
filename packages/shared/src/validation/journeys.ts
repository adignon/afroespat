import { z } from 'zod';
import {
  BlockerStatus,
  BlockerTarget,
  JourneyActivityType,
  JourneyMemberRole,
  JourneyMemberStatus,
  JourneyStatus,
  JourneyStepStatus,
  JourneyVisibility,
  Phase,
  StepCategory,
  VerificationLevel,
} from '../enums/generated.js';
import { cursorQuerySchema, handleSchema, pageSchema, uuidSchema } from './pagination.js';

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

// ── Régulariser ma situation : la variante choisie à la création (T3 A.2) ───

/** Le code du type « Régulariser ma situation » (T3 A.2). */
export const SETTLEMENT_TEMPLATE_CODE = 'SETTLEMENT';

/**
 * T3 A.2, ligne 1 de SETTLEMENT : « REGULARIZATION ou STATUS_CHANGE ou RENEWAL (le
 * membre choisit à la création ; les deux autres sont supprimées) ».
 *
 * `@@unique(version, position)` interdit trois alternatives sur une position : la
 * version publiée compose donc REGULARIZATION, et c'est `POST /journeys` qui
 * REMPLACE la définition de cette première étape par celle choisie. Les trois
 * codes sont ceux de `step_definitions.code` (seed T3 A.1).
 */
export const SETTLEMENT_VARIANTS = ['REGULARIZATION', 'STATUS_CHANGE', 'RENEWAL'] as const;
export type SettlementVariant = (typeof SETTLEMENT_VARIANTS)[number];

/** Les trois libellés de la planche J02 « variante Régulariser » (T5 §J02). */
export const SETTLEMENT_VARIANT_LABELS: Record<SettlementVariant, string> = {
  REGULARIZATION: 'Régulariser ma situation',
  STATUS_CHANGE: 'Changer de statut',
  RENEWAL: 'Renouveler mon titre de séjour',
};

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
  /** §5.1 `POST /journeys/:id/migrate` : le parcours suit déjà la version publiée courante. */
  ALREADY_CURRENT: 409,
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
  ALREADY_CURRENT: 'Votre parcours suit déjà la dernière version de la procédure.',
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
    /**
     * T3 A.2 : la variante de « Régulariser ma situation ». Elle n'a de sens que
     * pour ce type — le serveur la REFUSE pour un autre (`VALIDATION_FAILED`),
     * plutôt que de l'ignorer et de laisser croire qu'elle a servi.
     */
    variant: z.enum(SETTLEMENT_VARIANTS).optional(),
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
    /**
     * Le titre de la publication publique : celui de la demande d'entraide (06
     * §2.2), de l'annonce de recherche (10 §2.1) ou de l'accroche du profil de
     * recherche d'emploi (10 §3.2). Il est exigé par le SERVEUR selon la CIBLE du
     * brouillon, qu'un schéma de corps ne connaît pas : un parrainage n'en a pas.
     */
    title: z.string().trim().min(10).max(120).optional(),
    /** Cible HELP : le type de demande. Défaut `PAPERWORK` (06 §2.1). */
    helpType: z.enum(['PAPERWORK', 'SERVICE', 'RIDE', 'MATERIAL', 'OTHER']).optional(),
    /** Cibles HELP et HOUSING : la ville. Défaut = ville de destination du parcours. */
    cityId: uuidSchema.optional(),
    /** Cible HOUSING : recherche d'un logement ou d'un colocataire. Défaut : un logement. */
    housingKind: z.enum(['SEEKING_HOUSING', 'SEEKING_FLATMATE']).optional(),
    /** Cible JOBS : secteurs et contrats recherchés (10 §3.2). */
    sectors: z.array(z.string().trim().min(2).max(80)).max(10).optional(),
    contractTypes: z.array(z.string().trim().min(2).max(80)).max(10).optional(),
    /** Cible MENTORSHIP : le parrain sollicité, par son pseudo (08 §2.2). */
    mentorHandle: handleSchema.optional(),
  })
  .strict();

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
    /**
     * LES PARCOURS PUBLICS D'UN MEMBRE — l'onglet de son profil.
     *
     * ⚠ IL CHANGE AUSSI LA RÈGLE DES « AUTRES ». Sans lui, cette route sert
     * « 5 parcours publics d'AUTRES membres » (§3.7) et exclut donc les vôtres :
     * c'est juste pour un panneau de découverte, et faux pour un profil — le
     * vôtre n'afficherait rien. Quand l'auteur est demandé, la question n'est
     * plus « que découvrir ? » mais « qu'a publié cette personne ? », et la
     * réponse inclut soi-même.
     */
    authorHandle: handleSchema.optional(),
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

/** Le type de parcours, tel que les réponses de parcours le nomment. */
export const journeyTemplateRefSchema = z
  .object({ code: z.string(), nameFr: z.string(), icon: z.string().nullable() })
  .strict();

/** La ville de destination, NOMMÉE — jamais un simple identifiant. */
export const cityRefSchema = z.object({ id: uuidSchema, name: z.string() }).strict();

export const countryRefSchema = z
  .object({ id: uuidSchema, iso2: z.string(), nameFr: z.string() })
  .strict();

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
  /**
   * CE TYPE OUVRE-T-IL UN PARCOURS ?
   *
   * Faux pour les deux objectifs que T5 §O03 dessine sous « sans créer de
   * parcours » — « M'intégrer, rencontrer du monde » et « Aider les autres ». La
   * même page pose que « les deux groupes ont le même rang visuel de choix », et
   * §5 que « le parcours n'est jamais imposé » : ce sont des objectifs au même
   * titre que les quatre autres, et l'écran doit pouvoir les proposer de la même
   * façon.
   *
   * Ils ont une version publiée à ZÉRO étape — sans elle, « un type sans version
   * publiée n'est pas proposé » les exclurait. C'est donc ce booléen, et non
   * l'absence de version, qui dit de ne rien créer. Un client qui l'ignorerait
   * créerait un parcours vide.
   */
  createsJourney: z.boolean(),
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
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ `GET /journey-templates/:id/steps` — LES ÉTAPES D'UN TYPE DE PARCOURS      ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * ── POURQUOI CETTE ROUTE N'EXISTAIT PAS, ET POURQUOI ELLE MANQUE ───────────
 *
 * `GET /journey-templates` rend le NOMBRE d'étapes (`version.stepCount`) et rien
 * d'autre : de quoi écrire « 15 étapes » sous un type, pas de quoi en nommer une
 * seule. Aucune route ne servait les étapes elles-mêmes à un membre — seule
 * l'ouverture d'un parcours les matérialisait, en les COPIANT dans `journey_steps`.
 *
 * Le composeur de story en a besoin AVANT toute ouverture : `createStorySchema`
 * accepte un `stepDefinitionId` pour rattacher un conseil à l'étape qu'il
 * concerne — c'est ce qui, dit §2.6, « le rend réutilisable ». Sans cette route,
 * l'écran ne peut proposer qu'une liste écrite en dur, donc sans identifiant,
 * donc impossible à envoyer.
 *
 * ── CE QU'ELLE REND, ET CE QU'ELLE NE REND PAS ────────────────────────────
 *
 * `stepDefinitionId` est la clé qui part dans `POST /stories` : c'est l'identifiant
 * de la DÉFINITION, pas celui de `template_steps`. Deux versions d'un même type
 * réutilisent la même définition ; rattacher un conseil à la ligne de version le
 * rendrait caduc à la publication suivante.
 *
 * `position` est l'ordre que la VERSION fixe — §2.1 : elle « assemble et ordonne
 * des définitions ». Il sert à afficher « Étape 7 », jamais à identifier.
 *
 * Le nom et la description obéissent aux SURCHARGES de la version
 * (`template_steps.overrides`), exactement comme à l'ouverture d'un parcours.
 * Servir ici la définition brute ferait lire au membre un intitulé que son
 * parcours n'emploiera pas — la déclinaison Bénin de T3 A.3 est précisément faite
 * pour que les deux diffèrent.
 *
 * `isOptional` est servi parce que la liste le montre : proposer une étape
 * facultative sans le dire laisserait croire qu'elle est due.
 *
 * Pas de `nextCursor` : une version publiée compte quinze étapes, pas mille, et
 * les couper en pages ferait de l'ordre une illusion.
 */
export const journeyTemplateStepSchema = z
  .object({
    /** L'identifiant qui part dans `POST /stories` — voir l'en-tête. */
    stepDefinitionId: uuidSchema,
    code: z.string(),
    nameFr: z.string(),
    description: z.string().nullable(),
    category: z.enum(StepCategory),
    /** Le rang dans la version, à partir de 1. Pour l'affichage, jamais pour l'identité. */
    position: z.number().int(),
    isOptional: z.boolean(),
  })
  .strict();

export type JourneyTemplateStep = z.infer<typeof journeyTemplateStepSchema>;

export const journeyTemplateStepsResponseSchema = z.object({
  items: z.array(journeyTemplateStepSchema),
  /** La version RÉSOLUE pour le pays du membre — celle dont ces étapes viennent. */
  version: journeyTemplateVersionSchema,
  meta: journeyMetaSchema,
});

export type JourneyTemplateStepsResponse = z.infer<typeof journeyTemplateStepsResponseSchema>;

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
  /**
   * `null` quand toutes les étapes sont franchies.
   *
   * ── POURQUOI LA DESCRIPTION EST ICI ────────────────────────────────────────
   *
   * Elle n'y était pas, et O05 — « Votre parcours est prêt » — récitait donc la
   * phrase de la maquette, « Campus France, choix des formations, lettre de
   * motivation », sous l'étape d'un parcours de REGROUPEMENT FAMILIAL. Le porteur
   * l'a vu : « il faut que cette page prenne en compte le parcours réel ».
   *
   * Le chemin remonté à l'époque était un second aller-retour vers
   * `GET /journeys/:id`, au dernier écran de l'inscription, pour une phrase. La
   * liste la SERT maintenant : elle lit déjà `JourneyStep` pour compter les étapes
   * et nommer celle en cours, et `description` est une colonne de la même ligne —
   * aucune jointure, aucune requête de plus.
   *
   * `nullable` parce que la colonne l'est : une étape ajoutée à la main peut
   * n'avoir que son titre.
   */
  currentStep: z
    .object({ id: uuidSchema, title: z.string(), description: z.string().nullable() })
    .strict()
    .nullable(),
  doneCount: z.number().int(),
  stepCount: z.number().int(),
  memberCount: z.number().int(),

  /**
   * ── LES SIX CLÉS QUE CE LOT A AJOUTÉES, ET POURQUOI ELLES Y ÉTAIENT DÉJÀ ──
   *
   * `GET /journeys` les REND, et depuis toujours : la charge relevée
   * (`journeys_liste`) les porte toutes les six. Elles n'étaient pas DÉCRITES,
   * donc zod les dépouillait en silence — et J11 (« Mes parcours ») n'avait ni
   * type de parcours, ni ville, ni date de dernière activité pour écrire ses
   * cartes. Un champ rendu par l'API et absent du schéma est exactement aussi
   * invisible qu'un champ que l'API ne rend pas.
   *
   * Elles sont REQUISES et non facultatives : la liste les rend toujours, et les
   * accepter absentes ferait prendre une régression du serveur pour un cas normal.
   */
  template: journeyTemplateRefSchema,
  destinationCity: cityRefSchema,
  originCountry: countryRefSchema,
  /** §3.1 — la date d'arrivée cible, `null` tant qu'elle n'est pas fixée. */
  targetArrivalDate: z.string().nullable(),
  /** La prochaine échéance non franchie, ou `null`. */
  nextDueDate: z.string().nullable(),
  /** §3.9 — c'est elle qui déclenche « Où en êtes-vous ? » après soixante jours. */
  lastActivityAt: z.string(),
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

// ── Réponses — le parcours COMPLET, l'équipe, les publics et le journal ──────

/**
 * ─── LE SECOND LOT DE SCHÉMAS DE RÉPONSE, ET CE QU'IL AJOUTE ────────────────
 *
 * Les schémas au-dessus décrivent ce qu'il faut pour NAVIGUER : l'identifiant, le
 * titre, l'étape en cours. Les trente-deux cadres de J01 et J05 à J11 affichent
 * autre chose — la liste des étapes, la checklist, l'équipe, les parcours publics
 * d'autres membres, le journal. Ce sont ces charges-là qui manquaient.
 *
 * TOUS SONT FIGÉS SUR DES CHARGES RELEVÉES, écrites octet pour octet en fixture
 * par de vraies routes d'une API qui tournait (membre ouvert par OTP, parcours
 * créé, rendu public, étapes franchies, équipe invitée et acceptée) :
 * `journey_equipe`, `journey_detail_avance`, `journeys_publics`,
 * `journey_public_fiche`, `journey_journal`, `journey_plan_limite`.
 *
 * TROIS ÉCARTS MESURÉS, qui auraient cassé un écran en silence :
 *
 *   · `GET /journeys/public` NE REND PAS `currentStep`. La FICHE
 *     (`GET /journeys/public/:id`) le rend, la LISTE non — c'est exactement le
 *     piège déjà payé entre `GET /journeys` et `GET /journeys/:id`, une seconde
 *     fois et sur d'autres clés. Deux schémas, donc, dont l'un étend l'autre :
 *     ils ne peuvent plus diverger ;
 *   · la vue publique n'a NI `title`, NI `lastActivityAt`, NI `visibility` : §3.7
 *     en fait une liste FERMÉE, et le service la construit en un seul endroit
 *     (`publicView`). D'où le `.strict()` — voir ci-dessous ;
 *   · `GET /journeys/:id/activities` PORTE `nextCursor`, contrairement à
 *     `GET /journeys` et `GET /journey-templates`. Le journal est paginé par
 *     curseur, les deux autres rendent une liste bornée. `pageSchema` convient
 *     ici, et nulle part ailleurs dans ce module.
 */

/** §3.3 — un libellé cochable, et AUCUN fichier : « les documents restent chez vous ». */
export const journeyChecklistItemSchema = z
  .object({
    id: uuidSchema,
    label: z.string(),
    position: z.number().int(),
    isChecked: z.boolean(),
    checkedAt: z.string().nullable(),
  })
  /**
   * `.strict()` — LA RÈGLE DURE DE §3.3 RENDUE EXÉCUTABLE.
   *
   * « Cochez ce que vous avez réuni. Les documents restent chez vous » : il n'y a
   * aucun fichier en V1. Le jour où une refonte ajoute `fileKey` ou `uploadUrl` à
   * cette ligne, zod le DÉPOUILLERAIT en silence — l'écran continuerait de passer,
   * et la fuite ne se verrait qu'au premier dépôt de pièce d'identité. Ici elle
   * lève, et le nom du champ est dans le message.
   */
  .strict();

export type JourneyChecklistItem = z.infer<typeof journeyChecklistItemSchema>;

/**
 * UNE ÉTAPE, TELLE QUE `GET /journeys/:id` LA REND — et le rôle décide.
 *
 * RÈGLE DURE (§10, §3.4) : « les notes et la checklist ne sont jamais renvoyées à
 * un observateur », et le service va plus loin — l'ACCOMPAGNANT non plus ne les
 * voit pas. Le filtrage n'est pas fait après coup : `stepView` ne MET PAS ces
 * champs dans l'objet quand le lecteur n'est pas le propriétaire. Les cinq clés
 * concernées sont donc `.optional()` ici, et c'est la description exacte de ce que
 * l'API fait : elles sont là pour le propriétaire, ABSENTES pour les autres.
 *
 * On ne les rend PAS `.nullable()` à la place : `notes: null` et « pas de notes
 * renvoyées » sont deux choses différentes, et les confondre ferait croire qu'un
 * observateur reçoit un champ vide là où il ne reçoit rien du tout.
 */
export const journeyStepSchema = z
  .object({
    id: uuidSchema,
    title: z.string(),
    description: z.string().nullable(),
    position: z.number().int(),
    status: z.enum(JourneyStepStatus),
    startedAt: z.string().nullable(),
    completedAt: z.string().nullable(),
    pausedAt: z.string().nullable(),
    /** Durée RÉELLE, écrite au franchissement. `null` tant que l'étape court. */
    durationDays: z.number().int().nullable(),
    isCustom: z.boolean(),
    /** §3.2 — une étape facultative ne compte pas dans l'avancement. */
    isOptional: z.boolean(),
    stepDefinitionCode: z.string().nullable(),
    category: z.enum(StepCategory).nullable(),
    guideId: uuidSchema.nullable(),
    /** Le guide lié s'il est publié (T3 A.1) : de quoi l'ouvrir et dire « N ont trouvé utile ». */
    guide: z
      .object({ slug: z.string(), title: z.string(), helpfulCount: z.number().int() })
      .strict()
      .nullable()
      .optional(),
    blockerTarget: z.enum(BlockerTarget),
    /** §3.6 — seule une étape majeure propose le partage de jalon. */
    isMajorMilestone: z.boolean(),
    isRisky: z.boolean(),
    /** T3 A.1 — le message affiché AVANT de commencer une étape à risque. */
    riskMessage: z.string().nullable(),
    indicativeDurationDays: z.number().int().nullable(),

    // ── Propriétaire seulement (§3.4, §10) ──────────────────────────────────
    dueDate: z.string().nullable().optional(),
    dueDateManual: z.boolean().optional(),
    /** §3.6 — « Plus tard » posé une fois, le partage n'est plus reproposé. */
    sharePromptDismissedAt: z.string().nullable().optional(),
    /** §8.1 — chiffrées au repos, déchiffrées pour le propriétaire SEUL. */
    notes: z.string().nullable().optional(),
    checklist: z.array(journeyChecklistItemSchema).optional(),
    /**
     * §2.3 — « Cette échéance est trop proche : B prend en général N jours ».
     *
     * Posée par le serveur quand l'étape dépend d'une autre (`step_dependencies`)
     * dont l'échéance + la durée indicative dépasse la sienne. UNE ALERTE, jamais
     * un blocage. Absente (ou `null`) quand tout est cohérent, et réservée au
     * propriétaire comme les échéances elles-mêmes.
     */
    deadlineAlert: z
      .object({
        dependsOnStepId: uuidSchema,
        dependsOnTitle: z.string(),
        indicativeDays: z.number().int(),
      })
      .strict()
      .nullable()
      .optional(),
    /**
     * §6 — « N membres de Lyon ont franchi cette étape » : posé sur l'ÉTAPE EN COURS
     * du propriétaire seulement. `sample` ne contient que des membres dont le parcours
     * est PUBLIC (§3.7) — au plus trois.
     */
    peers: z
      .object({
        count: z.number().int(),
        cityName: z.string(),
        sample: z.array(
          z
            .object({
              handle: z.string(),
              displayName: z.string().nullable(),
              avatarKey: z.string().nullable(),
            })
            .strict(),
        ),
      })
      .strict()
      .nullable()
      .optional(),
  })
  /**
   * `.strict()` — parce qu'un champ greffé sur une étape EST une fuite.
   *
   * C'est la forme où `notes` vit. Un champ ajouté par une refonte — `notesRaw`,
   * `privateNote`, `blockerText` — serait dépouillé en silence par le défaut de
   * zod, et personne ne saurait que le serveur l'envoie à un observateur. Le
   * `.strict()` fait de cette question une erreur à l'appel, nommant le champ.
   */
  .strict();

export type JourneyStep = z.infer<typeof journeyStepSchema>;

/** Le membre tel que les routes de parcours le nomment (`MEMBER_USER_SELECT`). */
export const journeyUserSchema = z
  .object({
    id: uuidSchema,
    handle: z.string(),
    /** Vide (`""`) sur un compte qui n'a pas encore rempli son profil. */
    displayName: z.string().nullable(),
    verificationLevel: z.enum(VerificationLevel),
    avatarAsset: z.object({ storageKey: z.string() }).strict().nullable(),
  })
  /**
   * `.strict()` — 01 §2.1, RÈGLE DURE : aucun numéro de téléphone en clair.
   *
   * Cette forme est celle qui voyage avec chaque membre d'une équipe de parcours.
   * `phone`, `e164` ou `email` greffés dessus seraient dépouillés sans un mot ; le
   * `.strict()` en fait un refus. Le rempart du module Compte est le même, et pour
   * la même raison.
   */
  .strict();

export type JourneyUser = z.infer<typeof journeyUserSchema>;

/** §3.4 — un accompagnant ou un observateur du parcours. Dix au plus. */
export const journeyTeamMemberSchema = z
  .object({
    userId: uuidSchema,
    role: z.enum(JourneyMemberRole),
    status: z.enum(JourneyMemberStatus),
    /** `null` tant que l'invitation n'est pas acceptée (`status: 'INVITED'`). */
    acceptedAt: z.string().nullable(),
    user: journeyUserSchema,
  })
  .strict();

export type JourneyTeamMember = z.infer<typeof journeyTeamMemberSchema>;

/**
 * LE PARCOURS COMPLET de `GET /journeys/:id`, et non sa projection de navigation.
 *
 * Il ÉTEND `journeySummarySchema` : les huit clés que la navigation emploie ne sont
 * donc pas redécrites, et les deux schémas ne peuvent pas diverger sur `status`,
 * `progressPct` ou `currentStepId`. C'était le défaut de la liste contre le détail,
 * et on ne le rejoue pas en recopiant.
 *
 * `groupConversationId` vaut `null` pour un OBSERVATEUR : §3.4 n'offre la
 * discussion qu'à ceux qui peuvent y écrire. Ce n'est pas « pas de discussion »,
 * c'est « pas pour vous » — l'écran doit donc masquer l'entrée, pas afficher un
 * fil vide.
 */
export const journeyDetailSchema = journeySummarySchema.extend({
  /** §3.1 — la date d'arrivée cible, librement modifiable. */
  targetArrivalDate: z.string().nullable(),
  completedAt: z.string().nullable(),
  owner: journeyUserSchema,
  template: journeyTemplateRefSchema,
  templateVersion: z.number().int(),
  destinationCity: cityRefSchema,
  originCountry: countryRefSchema,
  groupConversationId: uuidSchema.nullable(),
  /** La prochaine échéance non franchie, ou `null`. §3.9 en tire les relances. */
  nextDueDate: z.string().nullable(),
  inactivityPromptSentAt: z.string().nullable(),
  /**
   * §2.2 — « La procédure a évolué ». La version publiée courante du modèle quand
   * elle est PLUS RÉCENTE que celle que ce parcours suit, sinon `null`. Réservée au
   * propriétaire : un accompagnant ne migre pas le parcours d'un autre. Absente
   * d'une réponse plus ancienne que ce lot, d'où `optional`.
   */
  newerVersion: z
    .object({
      id: uuidSchema,
      version: z.number().int(),
      changelog: z.string().nullable(),
    })
    .strict()
    .nullable()
    .optional(),
  /** §3.9 — « Où en êtes-vous ? » attend une réponse (relance envoyée, rien fait depuis). */
  inactivityPromptPending: z.boolean().optional(),
  /** J10 « N aides reçues » : le nombre d'activités `HELP_RECEIVED` du journal. */
  helpReceivedCount: z.number().int().optional(),
});

export type JourneyDetail = z.infer<typeof journeyDetailSchema>;

/**
 * `GET /journeys/:id` et `POST /journeys` — LA CHARGE ENTIÈRE.
 *
 * Elle ÉTEND `journeyDetailResponseSchema`, donc la projection de navigation reste
 * la seule définition de ses propres clés. Les deux sont éprouvées sur LA MÊME
 * fixture (`journey_equipe`) : une divergence ferait rougir les deux cas à la fois,
 * ce qui est exactement ce qu'on veut d'une source unique.
 *
 * `viewerRole` est une chaîne et non une énumération, parce que c'est ce que
 * `journeyDetailResponseSchema` dit déjà de la même route et qu'on ne resserre pas
 * une clé dans un schéma dérivé — deux règles pour une clé est le début de la
 * divergence. Les trois valeurs émises sont `OWNER`, `SUPPORTER` et `OBSERVER`.
 */
export const journeyFullResponseSchema = journeyDetailResponseSchema.extend({
  journey: journeyDetailSchema,
  /** Triées par `position` par le serveur : l'ordre est celui du parcours. */
  steps: z.array(journeyStepSchema),
  /** §3.4 — `INVITED` et `ACTIVE`, jamais les membres retirés. */
  members: z.array(journeyTeamMemberSchema),
  meta: journeyMetaSchema,
});

export type JourneyFullResponse = z.infer<typeof journeyFullResponseSchema>;

/**
 * UNE ÉTAPE FRANCHIE, TELLE QUE LA VUE PUBLIQUE LA MONTRE (§3.7).
 *
 * Quatre clés, et la liste est FERMÉE : titre de l'étape, rang, durée réelle, date
 * de franchissement. Le titre d'une ÉTAPE est celui du modèle, commun à tous ; le
 * titre du PARCOURS, lui, est personnel et ne sort jamais — c'est la règle dure de
 * §3.7, et c'est tout l'intérêt du `.strict()` ci-dessous.
 */
export const publicJourneyStepSchema = z
  .object({
    id: uuidSchema,
    title: z.string(),
    position: z.number().int(),
    durationDays: z.number().int().nullable(),
    completedAt: z.string().nullable(),
  })
  .strict();

export type PublicJourneyStep = z.infer<typeof publicJourneyStepSchema>;

/**
 * LA VUE PUBLIQUE D'UN PARCOURS — `GET /journeys/public` (§3.7).
 *
 * ── POURQUOI `.strict()` ICI PLUS QU'AILLEURS ───────────────────────────────
 *
 * §3.7 énumère ce qu'un membre connecté voit d'un parcours public, et c'est une
 * LISTE FERMÉE : handle, avatar, niveau, type, ville, pays, étape en cours, étapes
 * franchies avec leur durée, progression. « Jamais le titre personnel, ni les
 * notes, ni la checklist, ni l'équipe, ni la discussion, ni les dates cibles. »
 *
 * Le défaut de zod est de DÉPOUILLER ce qu'il ne nomme pas. Appliqué ici, il
 * transformerait une fuite en non-événement : le serveur enverrait `title` à tous
 * les membres connectés, le schéma le retirerait sans un mot, l'écran n'afficherait
 * rien d'anormal — et la fuite serait DANS LA RÉPONSE HTTP, lisible dans n'importe
 * quel onglet réseau, pendant des mois.
 *
 * `.strict()` fait de cette question un échec à l'appel qui NOMME le champ en
 * trop. C'est le seul endroit de ce module où le front peut encore voir passer une
 * régression du serveur sur une règle dure de confidentialité.
 */
export const publicJourneySchema = z
  .object({
    id: uuidSchema,
    status: z.enum(JourneyStatus),
    progressPct: z.number(),
    /** Le membre, par son HANDLE — jamais son identifiant interne (§3.7). */
    member: z
      .object({
        handle: z.string(),
        displayName: z.string().nullable(),
        verificationLevel: z.enum(VerificationLevel),
        avatarKey: z.string().nullable(),
      })
      .strict(),
    template: journeyTemplateRefSchema,
    destinationCity: cityRefSchema,
    originCountry: countryRefSchema,
    completedSteps: z.array(publicJourneyStepSchema),
  })
  .strict();

export type PublicJourney = z.infer<typeof publicJourneySchema>;

/**
 * `GET /journeys/public` (§3.7) — cinq parcours d'AUTRES membres.
 *
 * SANS `nextCursor`, comme `GET /journeys` : la réserve est bornée et classée en
 * mémoire (l'ordre dépend de MON avancement, donc ce n'est pas un `ORDER BY`), et
 * il n'y a pas de page suivante. Mesuré sur l'API.
 */
export const publicJourneysResponseSchema = z.object({
  items: z.array(publicJourneySchema),
  meta: journeyMetaSchema,
});

export type PublicJourneysResponse = z.infer<typeof publicJourneysResponseSchema>;

/**
 * `GET /journeys/public/:id` — LA FICHE, ET ELLE N'A PAS LA FORME DE LA LISTE.
 *
 * La fiche porte `currentStep` — `{ id, title, position }` — que la LISTE ne rend
 * PAS. C'est le même écart que celui déjà payé entre `GET /journeys` et
 * `GET /journeys/:id`, à un autre endroit du même module, et il se voit de la même
 * façon : pas du tout, puisque `z.array(item)` accepte `[]`.
 *
 * Le schéma de la fiche ÉTEND celui de la liste au lieu de le recopier. Une clé
 * retirée côté serveur fait donc rougir les deux, et une clé ajoutée à la liste
 * arrive dans la fiche sans qu'on y pense.
 */
export const publicJourneyDetailResponseSchema = z.object({
  journey: publicJourneySchema.extend({
    currentStep: z
      .object({ id: uuidSchema, title: z.string(), position: z.number().int() })
      .strict()
      .nullable(),
  }),
  meta: journeyMetaSchema,
});

export type PublicJourneyDetailResponse = z.infer<typeof publicJourneyDetailResponseSchema>;

/**
 * UNE ENTRÉE DU JOURNAL — `GET /journeys/:id/activities` (§3.8).
 *
 * Réservée au PROPRIÉTAIRE : §3.4 donne aux accompagnants les étapes et la
 * progression, pas le journal — qui porte les blocages, les notes et les motifs.
 *
 * `payload` est laissé LIBRE et nullable, et c'est exact plutôt que paresseux : la
 * forme dépend du type. `STEP_DONE` porte `{ durationDays }`, `STEP_STARTED` porte
 * `null`. Le décrire par une union de huit formes figerait ici une liste que le
 * serveur fait évoluer, et le front afficherait alors « une erreur est survenue »
 * pour un type d'activité ajouté — alors qu'il n'a besoin que du libellé et de la
 * date. Ce qu'il LIT est typé ; ce qu'il ne lit pas ne doit pas le faire tomber.
 */
export const journeyActivitySchema = z
  .object({
    id: uuidSchema,
    type: z.enum(JourneyActivityType),
    stepId: uuidSchema.nullable(),
    /** Le titre de l'étape concernée, résolu par le serveur. */
    stepTitle: z.string().nullable(),
    refType: z.string().nullable(),
    refId: uuidSchema.nullable(),
    payload: z.unknown().nullable(),
    /**
     * `null` pour un événement que personne n'a produit à la main — `HELP_RECEIVED`,
     * écrit par le consommateur de `help_request.resolved` — et pour l'auteur d'un
     * autre parcours dont le compte a été supprimé (§9).
     */
    actor: z.object({ handle: z.string(), displayName: z.string().nullable() }).strict().nullable(),
    createdAt: z.string(),
  })
  .strict();

export type JourneyActivity = z.infer<typeof journeyActivitySchema>;

/**
 * `GET /journeys/:id/activities` (§3.8) — paginé PAR CURSEUR.
 *
 * `pageSchema` convient ici et dans aucune autre route de ce module : le journal
 * est la seule liste non bornée des parcours. `nextCursor` y est requis et
 * nullable — l'accepter facultatif ferait prendre une pagination muette pour une
 * fin de journal, et l'historique s'arrêterait sans raison visible.
 */
export const journeyActivitiesResponseSchema = pageSchema(journeyActivitySchema).extend({
  meta: journeyMetaSchema,
});

export type JourneyActivitiesResponse = z.infer<typeof journeyActivitiesResponseSchema>;


// ── Réponses — les gestes d'écriture que l'écran appelle ────────────────────

/**
 * §3.6 — ce que `PATCH /journeys/:id/steps/:stepId` rend EN PLUS du parcours quand
 * l'étape vient d'être franchie : des PROPOSITIONS, jamais des publications.
 *
 * `milestone.text` vaut toujours `''` : « le champ est VIDE, c'est le membre qui
 * écrit » (§3.6). Un serveur qui y mettrait un texte ferait lever ce schéma.
 */
export const journeyProposalsSchema = z
  .object({
    tip: z.object({ kind: z.literal('STORY_TIP'), stepId: uuidSchema }).strict(),
    milestone: z
      .object({ kind: z.literal('VICTORY'), stepId: uuidSchema, text: z.literal('') })
      .strict()
      .nullable(),
    goPublic: z.object({ kind: z.literal('GO_PUBLIC') }).strict().nullable(),
  })
  .strict();

export type JourneyProposals = z.infer<typeof journeyProposalsSchema>;

/** `PATCH /journeys/:id/steps/:stepId` : le parcours complet + les propositions éventuelles. */
export const journeyStepUpdateResponseSchema = journeyFullResponseSchema.extend({
  proposals: journeyProposalsSchema.nullable().optional(),
});

export type JourneyStepUpdateResponse = z.infer<typeof journeyStepUpdateResponseSchema>;

/**
 * `POST /journeys/:id/migrate` (§2.2) : le parcours complet + le bilan de la
 * migration. Les trois compteurs sont ceux de la règle : « les étapes de même
 * `step_definition` gardent leur état, les nouvelles arrivent en `TODO`, les
 * supprimées sont conservées en `is_custom = true` ».
 */
export const journeyMigrationResponseSchema = journeyFullResponseSchema.extend({
  migration: z
    .object({
      fromVersion: z.number().int(),
      toVersion: z.number().int(),
      kept: z.number().int(),
      added: z.number().int(),
      madeCustom: z.number().int(),
      changelog: z.string().nullable(),
    })
    .strict(),
});

export type JourneyMigrationResponse = z.infer<typeof journeyMigrationResponseSchema>;

/**
 * `GET /journeys/invitations` (§3.4) — les invitations qui ATTENDENT ma réponse.
 *
 * L'invité ne voit PAS le titre personnel du parcours (§3.7) : le nom du type, la
 * ville et la personne qui invite suffisent pour accepter ou refuser en
 * connaissance de cause.
 */
export const journeyInvitationSchema = z
  .object({
    journeyId: uuidSchema,
    role: z.enum(JourneyMemberRole),
    invitedAt: z.string(),
    template: journeyTemplateRefSchema,
    destinationCity: cityRefSchema,
    invitedBy: z
      .object({ handle: z.string(), displayName: z.string().nullable() })
      .strict(),
  })
  .strict();

export type JourneyInvitation = z.infer<typeof journeyInvitationSchema>;

export const journeyInvitationsResponseSchema = z.object({
  items: z.array(journeyInvitationSchema),
  meta: journeyMetaSchema,
});

export type JourneyInvitationsResponse = z.infer<typeof journeyInvitationsResponseSchema>;

/** `POST /journeys/:id/members/decline`. */
export const journeyDeclineResponseSchema = z.object({ declined: z.boolean() });

/** `POST /journeys/:id/report-template-error` (§2.4). */
export const reportTemplateErrorResponseSchema = z.object({
  id: uuidSchema,
  status: z.literal('PENDING'),
  meta: journeyMetaSchema.optional(),
});

export type ReportTemplateErrorResponse = z.infer<typeof reportTemplateErrorResponseSchema>;
