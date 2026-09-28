import { z } from 'zod';
import { BlockerTarget, JourneyMemberRole, JourneyVisibility } from '../enums/generated.js';
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
