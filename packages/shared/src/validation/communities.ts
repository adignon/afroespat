import { z } from 'zod';
import {
  CommunityKind,
  CommunityMemberRole,
  CommunityVisibility,
  TopicPinKind,
  TopicStatus,
} from '../enums/generated.js';
import { cursorQuerySchema, handleSchema, uuidSchema } from './pagination.js';

/**
 * Schémas des réseaux — 07-reseaux.md §2, §3 et §4.
 *
 * SOURCE UNIQUE (00 §4) : ces schémas valident l'API ET les formulaires du
 * front. L'écran « Créer un réseau » a besoin de la même règle des cinq
 * invitations que le service, et une seconde définition côté formulaire finirait
 * par autoriser quatre invités là où l'API en exige cinq.
 */

// ── Seuils et garde-fous (§2.2, §2.3) ───────────────────────────────────────

/**
 * « Le créateur doit inviter AU MOINS 5 membres à la création. » (§2.2)
 *
 * C'est le garde-fou contre les réseaux vides, et il est dans le schéma partagé
 * pour que le compteur de l'écran de création affiche le même nombre que celui
 * que l'API refuse.
 */
export const COMMUNITY_MIN_INVITES = 5;

/** Au-delà, ce n'est plus une invitation mais un envoi en masse. */
export const COMMUNITY_MAX_INVITES = 50;

/**
 * Seuil par défaut de membres actifs dans la ville pour ouvrir la création de
 * réseaux d'intérêt (§2.2). Surchargeable par `system_settings`, d'où la clé.
 */
export const COMMUNITY_CITY_THRESHOLD_DEFAULT = 50;
export const COMMUNITY_CITY_THRESHOLD_SETTING_KEY = 'community_city_threshold';

/** Archivage automatique d'un réseau d'intérêt (§2.2). */
export const COMMUNITY_ARCHIVE_AFTER_DAYS = 60;
/** Avertissement au propriétaire, quinze jours avant (§2.2). */
export const COMMUNITY_ARCHIVE_WARNING_AFTER_DAYS = 45;
/** Un sujet sans réponse depuis 90 jours passe en ARCHIVED (§2.3). */
export const TOPIC_ARCHIVE_AFTER_DAYS = 90;

/** « 2 par semaine maximum » (§2.3, Annonces). */
export const COMMUNITY_ANNOUNCEMENTS_PER_WEEK = 2;
/** « épinglés en tête, 5 maximum » (§2.3, Sujets). */
export const COMMUNITY_MAX_PINNED_TOPICS = 5;
/** Fenêtre de correction du titre et du corps d'un sujet par son auteur (§4). */
export const TOPIC_EDIT_WINDOW_MINUTES = 15;

/**
 * Catégories des réseaux d'intérêt (§2.2). Liste FERMÉE : un membre ne crée pas
 * une catégorie, sinon la découverte par catégorie perd tout son sens.
 */
export const COMMUNITY_CATEGORIES = [
  'cuisine',
  'sport',
  'entrepreneuriat',
  'parents',
  'etudiants',
  'numerique',
  'musique',
  'lecture',
  'sorties',
  'foi',
  'autre',
] as const;

export type CommunityCategory = (typeof COMMUNITY_CATEGORIES)[number];

/** Libellés français, pour les filtres de la découverte. */
export const COMMUNITY_CATEGORY_LABELS: Record<CommunityCategory, string> = {
  cuisine: 'Cuisine',
  sport: 'Sport',
  entrepreneuriat: 'Entrepreneuriat',
  parents: 'Parents',
  etudiants: 'Étudiants',
  numerique: 'Numérique',
  musique: 'Musique',
  lecture: 'Lecture',
  sorties: 'Sorties',
  foi: 'Foi',
  autre: 'Autre',
};

// ── Codes d'erreur (§4) ─────────────────────────────────────────────────────

export const COMMUNITY_ERROR_CODES = {
  /** La ville du membre n'atteint pas le seuil de membres actifs (§2.2). */
  CITY_THRESHOLD: 422,
  /** Moins de cinq invités résolus à la création (§2.2). */
  NOT_ENOUGH_INVITES: 422,
  /** Réseau sur invitation : on ne rejoint pas de sa propre initiative (§2.2). */
  INVITE_ONLY: 403,
  /** « Sortie impossible » d'un réseau de ville ou de pays (§2.1). */
  AUTO_COMMUNITY: 422,
  /** Deux annonces par semaine au maximum (§2.3). */
  ANNOUNCEMENT_LIMIT: 422,
  /** Sondage clos : plus aucun vote (§2.3). */
  POLL_CLOSED: 409,
  /** Réseau archivé : lecture seule jusqu'à réactivation (§2.2). */
  COMMUNITY_ARCHIVED: 409,
  /** Cinq épinglés au maximum (§2.3). */
  PIN_LIMIT: 422,
  /** Un propriétaire transfère avant de quitter (§2.2). */
  OWNER_MUST_TRANSFER: 422,
  /** Retiré du réseau : ne peut plus rejoindre (§2.4). */
  BANNED_FROM_COMMUNITY: 403,
} as const;

export type CommunityErrorCode = keyof typeof COMMUNITY_ERROR_CODES;

export const COMMUNITY_ERROR_MESSAGES: Record<CommunityErrorCode, string> = {
  // Le message porte le nombre et la ville : « Les réseaux d'intérêt ouvrent à
  // partir de 50 membres à Lyon (34 aujourd'hui). » Les valeurs arrivent dans
  // `details` — le front compose la phrase, le back ne fabrique pas de texte
  // avec des trous.
  CITY_THRESHOLD: 'Les réseaux d’intérêt ne sont pas encore ouverts dans votre ville.',
  NOT_ENOUGH_INVITES: 'Invitez au moins 5 membres pour créer un réseau.',
  INVITE_ONLY: 'Ce réseau se rejoint uniquement sur invitation.',
  AUTO_COMMUNITY: 'Ce réseau est le vôtre par votre ville ou votre pays : vous ne pouvez pas le quitter, mais vous pouvez le mettre en sourdine.',
  ANNOUNCEMENT_LIMIT: 'Deux annonces par semaine au maximum.',
  POLL_CLOSED: 'Ce sondage est clos.',
  COMMUNITY_ARCHIVED: 'Ce réseau est archivé : il reste en lecture seule.',
  PIN_LIMIT: 'Cinq épinglés au maximum. Retirez-en un avant d’en ajouter.',
  OWNER_MUST_TRANSFER: 'Transférez la propriété du réseau avant de le quitter.',
  BANNED_FROM_COMMUNITY: 'Vous ne pouvez plus rejoindre ce réseau.',
};

// ── Champs (§2.2, §2.3) ─────────────────────────────────────────────────────

export const communityNameSchema = z.string().trim().min(3).max(60);
export const communityDescriptionSchema = z.string().trim().max(500);
export const communityCategorySchema = z.enum(COMMUNITY_CATEGORIES);
export const communityVisibilitySchema = z.enum(CommunityVisibility);
export const communityKindSchema = z.enum(CommunityKind);

/** Titre de sujet : 10–120 (§2.3). Le minimum écarte les « aide ! » sans objet. */
export const topicTitleSchema = z.string().trim().min(10).max(120);
export const topicBodySchema = z.string().trim().min(1).max(10_000);

// ── Découverte et listes (§4) ───────────────────────────────────────────────

export const communityListQuerySchema = cursorQuerySchema.extend({
  kind: communityKindSchema.optional(),
  category: communityCategorySchema.optional(),
  cityId: uuidSchema.optional(),
  q: z.string().trim().min(1).max(80).optional(),
});

export type CommunityListQuery = z.infer<typeof communityListQuerySchema>;

export const memberListQuerySchema = cursorQuerySchema.extend({
  /** Recherche par handle (§2.3, Liste). */
  q: z.string().trim().min(1).max(40).optional(),
  role: z.enum(CommunityMemberRole).optional(),
  /** Les demandes en attente, pour l'écran de gestion (§5). */
  pending: z
    .union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true')])
    .optional(),
});

export type MemberListQuery = z.infer<typeof memberListQuerySchema>;

export const topicListQuerySchema = cursorQuerySchema.extend({
  status: z.enum(TopicStatus).optional(),
  q: z.string().trim().min(1).max(80).optional(),
});

export type TopicListQuery = z.infer<typeof topicListQuerySchema>;

// ── Écritures (§4) ──────────────────────────────────────────────────────────

/**
 * Création d'un réseau d'intérêt (§2.2).
 *
 * `inviteHandles` a son minimum DANS LE SCHÉMA et non seulement dans le
 * service : l'écran de création affiche un compteur « 3 sur 5 », et il le lit
 * ici. Les doublons sont écartés avant le comptage, sinon inviter cinq fois la
 * même personne suffirait à ouvrir un réseau vide.
 */
export const createCommunitySchema = z.object({
  name: communityNameSchema,
  description: communityDescriptionSchema.optional(),
  category: communityCategorySchema,
  visibility: communityVisibilitySchema.default('PUBLIC'),
  coverAssetId: uuidSchema.optional(),
  inviteHandles: z
    .array(handleSchema)
    .max(COMMUNITY_MAX_INVITES)
    .transform((handles) => [...new Set(handles.map((h) => h.toLowerCase()))])
    .refine((handles) => handles.length >= COMMUNITY_MIN_INVITES, {
      message: `Invitez au moins ${COMMUNITY_MIN_INVITES} membres.`,
    }),
});

export type CreateCommunity = z.infer<typeof createCommunitySchema>;

export const updateCommunitySchema = z
  .object({
    name: communityNameSchema.optional(),
    description: communityDescriptionSchema.nullable().optional(),
    category: communityCategorySchema.optional(),
    visibility: communityVisibilitySchema.optional(),
    coverAssetId: uuidSchema.nullable().optional(),
  })
  .refine((patch) => Object.keys(patch).length > 0, { message: 'Aucune modification.' });

export type UpdateCommunity = z.infer<typeof updateCommunitySchema>;

export const inviteMembersSchema = z.object({
  handles: z
    .array(handleSchema)
    .min(1)
    .max(COMMUNITY_MAX_INVITES)
    .transform((handles) => [...new Set(handles.map((h) => h.toLowerCase()))]),
});

export type InviteMembers = z.infer<typeof inviteMembersSchema>;

/**
 * `PATCH /communities/:id/members/:userId` (§4).
 *
 * `role` et `status` sont réservés au propriétaire et aux modérateurs ; c'est le
 * service qui l'applique. `OWNER` n'est PAS une valeur acceptable ici : la
 * propriété se transfère par `POST /communities/:id/transfer`, qui déplace
 * l'ancien propriétaire en même temps — un `role: OWNER` posé ici créerait deux
 * propriétaires là où §2.2 en veut un seul.
 */
export const updateMemberSchema = z
  .object({
    role: z.enum(['MODERATOR', 'MEMBER']).optional(),
    status: z.enum(['ACTIVE', 'BANNED']).optional(),
  })
  .refine((patch) => Object.keys(patch).length > 0, { message: 'Aucune modification.' });

export type UpdateMember = z.infer<typeof updateMemberSchema>;

export const transferCommunitySchema = z.object({ toUserId: uuidSchema });

export const createTopicSchema = z.object({
  title: topicTitleSchema,
  body: topicBodySchema,
});

export type CreateTopic = z.infer<typeof createTopicSchema>;

/**
 * `PATCH /topics/:id` (§4). Trois autorisations différentes dans un seul corps,
 * que le service départage : `status` par l'auteur ou un modérateur, `pinKind`
 * par un modérateur seulement, `title`/`body` par l'auteur dans les 15 minutes.
 */
export const updateTopicSchema = z
  .object({
    status: z.enum(TopicStatus).optional(),
    pinKind: z.enum(TopicPinKind).optional(),
    title: topicTitleSchema.optional(),
    body: topicBodySchema.optional(),
  })
  .refine((patch) => Object.keys(patch).length > 0, { message: 'Aucune modification.' });

export type UpdateTopic = z.infer<typeof updateTopicSchema>;

export const createAnnouncementSchema = z.object({
  body: z.string().trim().min(1).max(2_000),
});

export const createPollSchema = z.object({
  question: z.string().trim().min(5).max(200),
  /** 2–8 options (§2.3). Une seule option n'est pas un sondage. */
  options: z.array(z.string().trim().min(1).max(100)).min(2).max(8),
  isMultiple: z.boolean().default(false),
  closesAt: z.coerce.date().optional(),
});

export type CreatePoll = z.infer<typeof createPollSchema>;

export const pollVoteSchema = z.object({
  /** Un seul identifiant si le sondage est à choix unique — le service l'exige. */
  optionIds: z.array(uuidSchema).min(1).max(8),
});

export const createAlbumSchema = z.object({
  title: z.string().trim().min(3).max(80),
  /** Album lié à un événement du réseau, ou album libre (§2.3). */
  eventId: uuidSchema.optional(),
});

export const addAlbumPhotoSchema = z.object({
  mediaAssetId: uuidSchema,
  caption: z.string().trim().max(300).optional(),
});

// ── Réponses ────────────────────────────────────────────────────────────────

/**
 * Le seuil de création, tel que l'écran « Réseaux » en a besoin (§2.2).
 *
 * `canCreate` ET les nombres : le front doit pouvoir écrire « Les réseaux
 * d'intérêt ouvrent à partir de 50 membres à Lyon (34 aujourd'hui) », donc il
 * lui faut la ville, le seuil et le compte — pas seulement un booléen.
 */
export interface CommunityCreationGate {
  readonly canCreate: boolean;
  readonly required: number;
  readonly current: number;
  readonly cityId: string | null;
  readonly cityName: string | null;
}
