import { z } from 'zod';
import { MentorshipEndReason, MentorshipStatus } from '../enums/generated.js';
import { cursorQuerySchema, handleSchema, pageSchema, uuidSchema } from './pagination.js';

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

/**
 * §2.4 : « LES DEUX évaluations déposées » — un parrainage a exactement deux
 * parties, donc deux évaluations au plus (`mentorship_reviews` porte
 * `@@unique(mentorship_id, reviewer_user_id)`).
 *
 * Nombre NOMMÉ parce qu'un `>= 2` nu s'est déjà trompé de population : il
 * comptait les évaluations dont un membre est le SUJET — au plus une par
 * parrainage — au lieu de celles DU PARRAINAGE, et la condition ne pouvait donc
 * jamais être vraie. Le nom dit sur quoi on compte, et le front s'en sert pour
 * afficher « en attente de l'évaluation de l'autre » plutôt qu'une liste vide.
 */
export const MENTORSHIP_REVIEWS_BOTH_IN = 2;

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

// ── Schémas de RÉPONSE (§7.1) ───────────────────────────────────────────────
//
// RELEVÉS SUR LA CHARGE RÉELLE : un parrain réellement créé (L2 posé en base,
// faute de KYC en local), un parrainage réellement demandé, accepté, terminé et
// évalué des deux côtés. Trois choses se sont révélées en appelant, et aucune des
// trois n'aurait été devinée en lisant le service :
//
//   1. `GET /me/mentorships` N'A PAS DE `nextCursor`. Le service rend
//      `{ items, meta }` et borne à cent lignes — `pageSchema` ici aurait fait
//      REFUSER la réponse réelle, exactement comme `myBlocksResponseSchema` l'a
//      fait une fois dans `connections.ts`.
//   2. `avatarUrl` de la fiche parrain est la CLÉ DE STOCKAGE BRUTE
//      (`profile.user.avatarAsset?.storageKey`), alors que `helpMemberSchema`
//      reçoit un chemin `/media/<clé>` composé par son service. Les deux modules
//      ne rendent donc PAS la même chose sous le même nom. Écart remonté, pas
//      masqué par un schéma complaisant.
//   3. Les évaluations de la fiche parrain sont restées VIDES avec deux
//      évaluations déposées — voir `mentorReviewSchema`.

/**
 * Une évaluation visible sur la fiche d'un parrain (§2.4).
 *
 * ÉCART MESURÉ, À REMONTER AU PORTEUR. §2.4 veut ces évaluations « visibles
 * seulement une fois les deux évaluations déposées OU après 14 jours ». La
 * PREMIÈRE branche ne se produit jamais : `visibleReviewsFor()` ne lit que les
 * évaluations dont le membre est le SUJET (`revieweeUserId: userId`), puis compte
 * combien il y en a par parrainage et exige `>= 2`. Comme un parrainage porte au
 * plus deux évaluations, une par sens, il n'y en a jamais plus d'UNE sur le même
 * sujet — le seuil est inatteignable.
 *
 * Relevé en appelant : deux évaluations déposées, `reviews: []` ; la même fiche
 * avec `ended_at` reculé de vingt jours, l'évaluation paraît. La fiche d'un parrain
 * reste donc muette pendant quatorze jours après chaque parrainage — un défaut
 * d'affichage, pas une fuite, et il est signalé plutôt que contourné.
 */
export const mentorReviewSchema = z
  .object({
    rating: z.number().int().min(1).max(5),
    comment: z.string().nullable(),
    createdAt: z.string().datetime(),
    /** §11 : l'évaluation d'un membre supprimé est conservée, ANONYMISÉE (`null`). */
    reviewer: z
      .object({ handle: handleSchema, displayName: z.string() })
      .strict()
      .nullable(),
  })
  .strict();

export type MentorReview = z.infer<typeof mentorReviewSchema>;

/**
 * La fiche d'un parrain — `MentorshipService.card()`, §2.1 et §2.2.
 *
 * `.strict()` : c'est de l'IDENTITÉ, et la règle dure du §3.2 dit « aucun compteur
 * de contacts sur la fiche d'un parrain ». Sans `.strict()`, un `connectionCount`
 * ajouté un jour côté serveur serait dépouillé EN SILENCE : la donnée aurait
 * traversé le réseau, et la règle serait fausse sans que rien ne l'indique.
 * Avec, la réponse est refusée et l'écart se voit.
 */
export const mentorCardSchema = z
  .object({
    userId: uuidSchema,
    handle: handleSchema,
    displayName: z.string(),
    /** CLÉ DE STOCKAGE BRUTE, pas un chemin `/media/…` — écart mesuré, voir plus haut. */
    avatarUrl: z.string().nullable(),
    city: z
      .object({ id: uuidSchema, name: z.string(), slug: z.string() })
      .strict()
      .nullable(),
    bio: z.string().nullable(),
    journeyTemplateIds: z.array(uuidSchema),
    maxMentees: z.number().int().min(1).max(MENTOR_MAX_MAX_MENTEES),
    activeMenteeCount: z.number().int().min(0),
    completedCount: z.number().int().min(0),
    /** `Decimal` en base, rendu en nombre par le service. */
    avgRating: z.number().nullable(),
    /** §2.1 : « Disponible » ou « Complet ». Un libellé, pas deux booléens. */
    availability: z.enum(['AVAILABLE', 'FULL']),
    isAvailable: z.boolean(),
  })
  .strict();

export type MentorCard = z.infer<typeof mentorCardSchema>;

/**
 * Le `meta` que toute réponse du parrainage porte.
 *
 * `moneyBanner` est la règle dure de §2.4 — « le parrainage n'implique jamais
 * d'argent » — et elle voyage avec la réponse. Le schéma l'exige : une API qui
 * cesserait de l'envoyer serait refusée, au lieu de produire une liste de parrains
 * sans son avertissement.
 */
export const mentorshipMetaSchema = z
  .object({
    moneyBanner: z.string().min(1),
    /** `listMentors` seul le compte ; la branche « modèle inconnu » ne le rend pas. */
    total: z.number().int().min(0).optional(),
  })
  .strict();

/** `GET /mentors` (§7.1). */
export const mentorsResponseSchema = pageSchema(mentorCardSchema).extend({
  meta: mentorshipMetaSchema,
});

export type MentorsResponse = z.infer<typeof mentorsResponseSchema>;

/** `GET /mentors/:handle` (§7.1) — la fiche, et ses évaluations visibles. */
export const mentorCardResponseSchema = mentorCardSchema.extend({
  reviews: z.array(mentorReviewSchema),
  meta: mentorshipMetaSchema,
});

export type MentorCardResponse = z.infer<typeof mentorCardResponseSchema>;

/**
 * Mon évaluation, ou celle de l'autre, dans `GET /me/mentorships`.
 *
 * Elle ne porte PAS la même forme que `mentorReviewSchema` : ici le service
 * sélectionne `reviewerUserId` et aucun nom. C'est ce qu'il envoie, et on le décrit
 * tel quel plutôt que d'harmoniser les deux formes dans le schéma — ce serait
 * décrire une API qui n'existe pas.
 */
export const mentorshipOwnReviewSchema = z
  .object({
    reviewerUserId: uuidSchema,
    rating: z.number().int().min(1).max(5),
    comment: z.string().nullable(),
    createdAt: z.string().datetime(),
  })
  .strict();

/**
 * `GET /me/mentorships` (§7.1) — « comme parrain et comme filleul ».
 *
 * PAS DE `nextCursor`, mesuré : le service rend `{ items, meta }` et borne à cent
 * lignes. `pageSchema` ferait refuser la réponse réelle.
 *
 * `other` est NULLABLE, et c'est la règle dure du module qui l'impose : le service
 * le met à `null` dès qu'un blocage existe entre les deux. Un parrainage avec un
 * membre bloqué reste donc listé — il a existé — mais SANS nom, SANS pseudo et
 * SANS identifiant. L'écran doit savoir afficher cette ligne muette ; un schéma qui
 * exigerait `other` ferait échouer la page entière au premier blocage.
 *
 * `requestMessage` n'est pas nullable : la colonne est `String` non nulle, et §2.2
 * rend le message obligatoire. `.strict()` : c'est du CONTENU écrit par un membre à
 * un autre.
 */
export const myMentorshipsResponseSchema = z
  .object({
    items: z.array(
      z
        .object({
          id: uuidSchema,
          role: z.enum(['mentor', 'mentee']),
          status: z.enum(MentorshipStatus),
          endReason: z.enum(MentorshipEndReason).nullable(),
          requestMessage: z.string(),
          journeyId: uuidSchema.nullable(),
          conversationId: uuidSchema.nullable(),
          acceptedAt: z.string().datetime().nullable(),
          endsAt: z.string().datetime().nullable(),
          endedAt: z.string().datetime().nullable(),
          /**
           * §2.2 / §6 : la colonne `mentorships.expires_at` pour une demande en
           * attente (created_at + 7 jours), `null` sinon.
           */
          expiresAt: z.string().datetime().nullable(),
          /** §6 : la colonne `mentorships.extended_once`. */
          extended: z.boolean(),
          /**
           * Décidé par le SERVEUR : actif, pas déjà prolongé. Le front éteint le
           * bouton « Prolonger » sur ce drapeau, il ne recalcule pas les 90 jours.
           */
          canExtend: z.boolean(),
          canReview: z.boolean(),
          myReview: mentorshipOwnReviewSchema.nullable(),
          theirReview: mentorshipOwnReviewSchema.nullable(),
          /** `null` dès qu'un blocage sépare les deux membres (§4). */
          other: z
            .object({ id: uuidSchema, handle: handleSchema, displayName: z.string() })
            .strict()
            .nullable(),
        })
        .strict(),
    ),
    meta: mentorshipMetaSchema,
  })
  .strict();

export type MyMentorshipsResponse = z.infer<typeof myMentorshipsResponseSchema>;

/**
 * `GET /me/mentor-profile` — MON profil de parrain (s'il existe) et LE DIAGNOSTIC
 * D'ÉLIGIBILITÉ de §2.1.
 *
 * Il manquait une route qui dise LESQUELLES des trois conditions manquent :
 * `PUT /me/mentor-profile` répond `MENTOR_NOT_ELIGIBLE` sans détail, et l'écran
 * « Devenir parrain » dessine trois conditions qu'il ne pouvait pas évaluer. Le
 * serveur les évalue ; le front les montre.
 *
 *   · `identity`   — identité vérifiée (niveau L1 au moins) ;
 *   · `phone`      — numéro d'un pays de destination vérifié (niveau L2) ;
 *   · `experience` — un parcours terminé, OU SETTLED depuis 12 mois.
 *
 * `eligible` est la conjonction des trois : le PUT l'applique de toute façon.
 */
export const mentorEligibilitySchema = z
  .object({
    eligible: z.boolean(),
    identity: z.boolean(),
    phone: z.boolean(),
    experience: z
      .object({
        ok: z.boolean(),
        completedJourneys: z.number().int().min(0),
        settledForMonths: z.boolean(),
      })
      .strict(),
  })
  .strict();

export type MentorEligibility = z.infer<typeof mentorEligibilitySchema>;

export const myMentorProfileResponseSchema = z
  .object({
    profile: mentorCardSchema.nullable(),
    eligibility: mentorEligibilitySchema,
    meta: mentorshipMetaSchema,
  })
  .strict();

export type MyMentorProfileResponse = z.infer<typeof myMentorProfileResponseSchema>;

/** `PUT /me/mentor-profile` (§7.1) : la fiche telle qu'elle vient d'être posée. */
export const mentorProfileResponseSchema = mentorCardSchema.extend({
  meta: mentorshipMetaSchema,
});

export type MentorProfileResponse = z.infer<typeof mentorProfileResponseSchema>;

/**
 * `POST /mentorships` (§7.1) : la demande créée, en attente.
 *
 * TROIS CHAMPS, pas quatre. Ce schéma a d'abord été écrit avec un
 * `conversationId: z.null()` — par symétrie avec l'acceptation, qui en porte un.
 * La charge réelle n'en a AUCUN : la conversation naît à l'acceptation (§2.3), pas
 * à la demande. `.strict()` aurait refusé la bonne réponse, ce qui est la bonne
 * façon d'échouer, mais la leçon est qu'un schéma écrit par symétrie est un schéma
 * deviné.
 */
export const mentorshipCreatedSchema = z
  .object({
    id: uuidSchema,
    status: z.literal('REQUESTED'),
    expiresAt: z.string().datetime(),
    meta: mentorshipMetaSchema,
  })
  .strict();

export type MentorshipCreated = z.infer<typeof mentorshipCreatedSchema>;

/**
 * `POST /mentorships/:id/accept` (§2.3) : le parrainage devient actif, et une
 * conversation s'ouvre entre les deux membres.
 *
 * `.strict()` : c'est une MISE EN RELATION — la règle dure du module. Un champ
 * greffé ici serait à lire comme une fuite, pas comme un extra.
 */
export const mentorshipAcceptedSchema = z
  .object({
    id: uuidSchema,
    status: z.literal('ACTIVE'),
    endsAt: z.string().datetime(),
    conversationId: uuidSchema,
    meta: mentorshipMetaSchema,
  })
  .strict();

export type MentorshipAccepted = z.infer<typeof mentorshipAcceptedSchema>;
