import { z } from 'zod';
import { cursorQuerySchema, handleSchema, uuidSchema } from './pagination.js';

/**
 * Parrainage — 08-parrainage-messagerie.md §2.
 *
 * SOURCE UNIQUE (00 §4) : ces bornes valident l'API ET les formulaires. Les
 * recopier côté front les ferait diverger au premier ajustement, et c'est l'écran
 * « Demander un parrain » qui mentirait sur la longueur du message.
 *
 * Deux choix méritent leur ligne :
 *
 *   · le MESSAGE de demande est obligatoire et long (50 caractères au minimum).
 *     §2.2 l'impose, et c'est la seule barrière contre la demande envoyée à dix
 *     parrains d'un clic : un membre qui doit écrire cinquante caractères choisit
 *     son parrain.
 *
 *   · `maxMentees` est borné à 3 côté SCHÉMA, pas seulement côté service. §2.1 :
 *     « défaut 2, maximum 3 ». La borne protège le parrain de lui-même, et c'est
 *     précisément le genre de garde qu'un formulaire ne doit pas pouvoir
 *     contourner.
 */

// ── Bornes de §2 ────────────────────────────────────────────────────────────

/** §2.3 : `ends_at = accepted_at + 90 jours`. */
export const MENTORSHIP_DURATION_DAYS = 90;
export const MENTORSHIP_DURATION_MS = MENTORSHIP_DURATION_DAYS * 86_400_000;

/** §2.2 : « sans réponse sous 7 jours, la demande expire ». */
export const MENTORSHIP_REQUEST_EXPIRY_DAYS = 7;
export const MENTORSHIP_REQUEST_EXPIRY_MS = MENTORSHIP_REQUEST_EXPIRY_DAYS * 86_400_000;

/** §2.1 : « `max_mentees` (défaut 2, maximum 3) ». */
export const MENTOR_DEFAULT_MAX_MENTEES = 2;
export const MENTOR_MAX_MAX_MENTEES = 3;

/** §2.1 : « SETTLED depuis 12 mois » — l'autre voie d'éligibilité. */
export const MENTOR_SETTLED_MONTHS = 12;

/**
 * §2.4 : évaluations « visibles seulement une fois les deux évaluations déposées
 * ou après 14 jours ».
 *
 * Ce même délai borne le DÉPÔT, et ce n'est pas une extrapolation gratuite :
 * passé 14 jours l'évaluation de l'autre devient visible, et déposer ensuite
 * permettrait de la lire puis d'y répondre. La réciprocité que §2.4 cherche
 * disparaîtrait — la note deviendrait une riposte.
 */
export const MENTORSHIP_REVIEW_WINDOW_DAYS = 14;
export const MENTORSHIP_REVIEW_WINDOW_MS = MENTORSHIP_REVIEW_WINDOW_DAYS * 86_400_000;

/** §2.2 : message de demande 50 à 1 000 caractères. */
export const MENTORSHIP_MESSAGE_MIN = 50;
export const MENTORSHIP_MESSAGE_MAX = 1000;

/** §2.1 : bio du parrain. Même borne que celle d'un profil (01 §2.3). */
export const MENTOR_BIO_MAX = 500;

/** §2.4 : commentaire d'évaluation, facultatif. */
export const MENTORSHIP_REVIEW_COMMENT_MAX = 1000;

// ── Codes d'erreur propres au parrainage (§7.1) ─────────────────────────────

export const MENTORSHIP_ERROR_CODES = {
  MENTOR_NOT_ELIGIBLE: 422,
  MENTOR_FULL: 422,
  PENDING_REQUEST_EXISTS: 409,
  ALREADY_EXTENDED: 422,
  REVIEW_WINDOW_CLOSED: 422,
  /** Accepter, refuser, terminer ou prolonger dans un état qui ne le permet pas. */
  MENTORSHIP_STATE: 409,
} as const;

export type MentorshipErrorCode = keyof typeof MENTORSHIP_ERROR_CODES;

export const MENTORSHIP_ERROR_MESSAGES: Record<MentorshipErrorCode, string> = {
  MENTOR_NOT_ELIGIBLE:
    'Pour devenir parrain, il faut avoir terminé un parcours ou être installé·e depuis un an.',
  MENTOR_FULL: 'Ce parrain accompagne déjà le nombre maximum de filleuls.',
  PENDING_REQUEST_EXISTS:
    'Vous avez déjà une demande de parrainage en attente. Attendez la réponse ou son expiration.',
  ALREADY_EXTENDED: 'Ce parrainage a déjà été prolongé une fois.',
  REVIEW_WINDOW_CLOSED: 'La période d’évaluation de ce parrainage est terminée.',
  MENTORSHIP_STATE: 'Cette action n’est plus possible dans l’état actuel du parrainage.',
};

/**
 * RÈGLE DURE (§2.4) : « Le parrainage n'implique jamais d'argent. »
 *
 * Le bandeau voyage avec la réponse de l'API (T4 §4), il n'est pas codé en dur
 * dans le front — sinon l'application mobile, l'admin et le web en auraient
 * trois versions, et celle qui compte serait la moins à jour.
 */
export const MENTORSHIP_MONEY_BANNER =
  'Un parrainage est gratuit et bénévole. Aucun parrain ne doit vous demander d’argent, ni vous garantir un visa, un logement ou un emploi. Signalez immédiatement toute demande de ce type.';

// ── Écriture ────────────────────────────────────────────────────────────────

/**
 * `PUT /me/mentor-profile` (§7.1). Remplacement complet : c'est un PUT.
 *
 * `isAvailable` a un défaut plutôt que d'être obligatoire : on devient parrain
 * pour être disponible, et exiger le drapeau ferait échouer la première requête
 * de l'écran « Devenir parrain » pour rien.
 */
export const mentorProfileSchema = z
  .object({
    bio: z.string().trim().min(20).max(MENTOR_BIO_MAX).optional(),
    /** Types de parcours connus. Facultatif : un parrain peut n'en déclarer aucun. */
    journeyTemplateIds: z.array(uuidSchema).max(20).default([]),
    maxMentees: z
      .number()
      .int()
      .min(1)
      .max(MENTOR_MAX_MAX_MENTEES)
      .default(MENTOR_DEFAULT_MAX_MENTEES),
    isAvailable: z.boolean().default(true),
  })
  .strict();

export type MentorProfileInput = z.infer<typeof mentorProfileSchema>;

/** `GET /mentors` (§7.1). Les quatre filtres de §2.2, tous facultatifs. */
export const mentorsQuerySchema = cursorQuerySchema.extend({
  cityId: uuidSchema.optional(),
  languageId: uuidSchema.optional(),
  /** Code d'un `journey_templates`, pas son identifiant : c'est ce que §7.1 nomme. */
  templateCode: z.string().trim().min(2).max(60).optional(),
  /** Pays d'origine : « priorité au même, sans exclusivité » (§2.2). */
  countryId: uuidSchema.optional(),
});

export type MentorsQuery = z.infer<typeof mentorsQuerySchema>;

/** `POST /mentorships` (§7.1). */
export const createMentorshipSchema = z
  .object({
    mentorHandle: handleSchema,
    message: z.string().trim().min(MENTORSHIP_MESSAGE_MIN).max(MENTORSHIP_MESSAGE_MAX),
    journeyId: uuidSchema.optional(),
  })
  .strict();

export type CreateMentorship = z.infer<typeof createMentorshipSchema>;

/** `POST /mentorships/:id/review` (§7.1). Note 1 à 5, commentaire facultatif. */
export const mentorshipReviewSchema = z
  .object({
    rating: z.number().int().min(1).max(5),
    comment: z.string().trim().min(1).max(MENTORSHIP_REVIEW_COMMENT_MAX).optional(),
  })
  .strict();

export type MentorshipReviewInput = z.infer<typeof mentorshipReviewSchema>;

/** `GET /me/mentorships` (§7.1) : « comme parrain et comme filleul ». */
export const myMentorshipsQuerySchema = z
  .object({
    role: z.enum(['mentor', 'mentee', 'all']).default('all'),
    state: z.enum(['pending', 'active', 'past', 'all']).default('all'),
  })
  .strict();

export type MyMentorshipsQuery = z.infer<typeof myMentorshipsQuerySchema>;
