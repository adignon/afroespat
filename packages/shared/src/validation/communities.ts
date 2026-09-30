import { z } from 'zod';
import {
  CommunityKind,
  CommunityMemberRole,
  CommunityMemberStatus,
  CommunityStatus,
  CommunityVisibility,
  Phase,
  PostType,
  TopicPinKind,
  TopicStatus,
} from '../enums/generated.js';
import { cursorQuerySchema, handleSchema, pageSchema, uuidSchema } from './pagination.js';

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

// ═══════════════════════════════════════════════════════════════════════════
// SCHÉMAS DE RÉPONSE — relevés OCTET POUR OCTET sur l'API qui tourne.
// ═══════════════════════════════════════════════════════════════════════════
//
// Aucun de ces schémas n'est déduit du code du service. Chacun décrit une charge
// RELEVÉE : réseau créé, sujet ouvert puis ÉPINGLÉ, annonce, sondage, album,
// publication, puis les mêmes routes rappelées par un NON-MEMBRE. Ce qui suit
// note, à chaque écart, d'où vient le champ — parce que les écarts sont nombreux
// et qu'aucun ne se devine en lisant les routes.
//
// ── TROIS FORMES D'AUTEUR, ET NON UNE ───────────────────────────────────────
//
// Le fil global (`feed.ts`) expose `memberSummarySchema` : neuf champs, dont
// `level`, `countryIso2` et `isMentor`. AUCUNE route de ce module ne renvoie
// cela. Mesuré, il y en a trois, et les confondre ferait échouer la validation :
//
//   · `communityAuthorSchema` — TROIS champs `{ id, handle, displayName }`, sur
//     les sujets, les annonces, les sondages, les albums et le fil du réseau ;
//   · `communityMemberSchema` — la liste des membres, qui porte `avatarUrl`,
//     `phase`, `city`, `role`, `status`, `joinedAt` et PAS `level` ;
//   · l'auteur d'une photo d'album — DEUX champs `{ id, handle }`, sans nom
//     affiché.
//
// ── `.strict()` PARTOUT SUR LES FORMES DE CONTENU ───────────────────────────
//
// Même raison qu'au fil, et elle se vérifie ici aussi : sans `.strict()`, un
// `viewCount` greffé sur un sujet passerait sans un mot, alors que `00` §49
// interdit tout compteur de vues sur tout contenu. Le sondage rend la chose
// concrète — voir `pollDetailResponseSchema`, qui porte UN champ de plus que le
// même sondage vu en liste.
//
// Les dates sont des CHAÎNES ISO : rien ne sérialise les `Date` de Nest
// autrement que `JSON.stringify`. Donc `z.string().datetime()`, jamais `z.date()`.

/** `{ id, handle, displayName }` — l'auteur tel que CE module l'expose. */
export const communityAuthorSchema = z
  .object({ id: uuidSchema, handle: z.string(), displayName: z.string() })
  .strict();

export type CommunityAuthor = z.infer<typeof communityAuthorSchema>;

/** `{ id, name }` — la ville, telle qu'elle voyage dans ce module. */
const communityCityRefSchema = z.object({ id: uuidSchema, name: z.string() }).strict();

/**
 * L'EN-TÊTE PUBLIC d'un réseau — quatorze champs, `publicShape()` du service.
 *
 * C'est la seule partie d'un réseau qu'un NON-MEMBRE obtient, et c'est voulu :
 * un réseau `PUBLIC` se découvre, sinon le bouton « Rejoindre » n'aurait aucun
 * sens. Tout le reste — sujets, fil, membres, annonces, sondages, albums, carte —
 * lui est refusé par un `403 FORBIDDEN` / `NOT_A_MEMBER`.
 *
 * `description` et `category` sont NULLABLES : les réseaux automatiques de ville
 * et de pays n'en ont pas (mesuré sur « Lyon » : les deux à `null`).
 */
export const communityPublicSchema = z
  .object({
    id: uuidSchema,
    kind: z.enum(CommunityKind),
    name: z.string(),
    slug: z.string(),
    description: z.string().nullable(),
    category: z.string().nullable(),
    visibility: z.enum(CommunityVisibility),
    status: z.enum(CommunityStatus),
    cityId: uuidSchema.nullable(),
    countryId: uuidSchema.nullable(),
    memberCount: z.number().int(),
    coverAssetId: uuidSchema.nullable(),
    lastActivityAt: z.string().datetime(),
    createdAt: z.string().datetime(),
  })
  .strict();

export type CommunityPublic = z.infer<typeof communityPublicSchema>;

/**
 * UN SUJET ÉPINGLÉ, tel que l'en-tête et la liste des sujets le portent.
 *
 * IL PORTE SON TITRE, et c'est pour cela que le masquage côté serveur compte :
 * `pinned` vaut `[]` pour un non-membre, et cette liste vide est la seule chose
 * qui empêche un passant de lire les titres des sujets épinglés d'un réseau
 * qu'il n'a pas rejoint. Un front qui irait chercher ces titres ailleurs
 * contournerait la garde ; il n'y a pas d'ailleurs, et c'est délibéré.
 */
export const pinnedTopicSchema = z
  .object({
    id: uuidSchema,
    title: z.string(),
    pinKind: z.enum(TopicPinKind),
    status: z.enum(TopicStatus),
    replyCount: z.number().int(),
  })
  .strict();

export type PinnedTopic = z.infer<typeof pinnedTopicSchema>;

/**
 * `GET /communities/:slug` — l'en-tête, mon rôle, les compteurs, les épinglés.
 *
 * LA MOITIÉ DE CETTE FORME EST UNE GARDE, et il faut le savoir pour ne pas la
 * défaire à l'affichage. Relevé sur le MÊME réseau `PUBLIC`, à la même seconde :
 *
 *                        membre              non-membre
 *   myRole               "OWNER"             null
 *   myStatus             "ACTIVE"            null
 *   canJoin              false               true
 *   counters.topics      1                   0
 *   counters.announcem.  1                   0
 *   pinned               [1 sujet + TITRE]   []
 *
 * Les trois dernières lignes ne sont PAS des compteurs à zéro : ce sont des
 * compteurs MASQUÉS. Un `counters.topics` à 1 dirait déjà à un passant qu'il se
 * dit quelque chose ici. L'écran doit donc lire `myStatus === 'ACTIVE'` pour
 * savoir s'il regarde un contenu ou une façade — et jamais présenter le zéro
 * masqué comme un réseau vide.
 */
export const communityDetailResponseSchema = communityPublicSchema
  .extend({
    myRole: z.enum(CommunityMemberRole).nullable(),
    myStatus: z.enum(CommunityMemberStatus).nullable(),
    canJoin: z.boolean(),
    canLeave: z.boolean(),
    counters: z
      .object({
        members: z.number().int(),
        topics: z.number().int(),
        announcements: z.number().int(),
      })
      .strict(),
    pinned: z.array(pinnedTopicSchema),
  })
  .strict();

export type CommunityDetailResponse = z.infer<typeof communityDetailResponseSchema>;

/** Un réseau de MA liste : l'en-tête public, plus mon rôle et ma date d'entrée. */
export const myCommunitySchema = communityPublicSchema
  .extend({ myRole: z.enum(CommunityMemberRole), joinedAt: z.string().datetime() })
  .strict();

export type MyCommunity = z.infer<typeof myCommunitySchema>;

/** Un réseau de la DÉCOUVERTE : l'en-tête public, plus « déjà rejoint ». */
export const discoverCommunitySchema = communityPublicSchema
  .extend({ joined: z.boolean() })
  .strict();

export type DiscoverCommunity = z.infer<typeof discoverCommunitySchema>;

/** Le seuil de création, en SCHÉMA — l'interface du dessus continue de le typer. */
export const communityCreationGateSchema = z
  .object({
    canCreate: z.boolean(),
    required: z.number().int(),
    current: z.number().int(),
    cityId: uuidSchema.nullable(),
    cityName: z.string().nullable(),
  })
  .strict();

/**
 * `GET /communities` — A07.
 *
 * CE N'EST PAS UNE PAGE : la racine porte cinq clés, et seul `discover` pagine.
 * `mine`, `invitations` et `pendingRequests` sont des listes ENTIÈRES — le
 * service les lit sans curseur ni limite. Les traiter comme des pages ferait
 * chercher un `nextCursor` qui n'existe pas.
 *
 * `creationGate` arrive ICI, dans la réponse de la liste : c'est ce qui permet à
 * A07 d'afficher — ou non — le bouton « Créer », et à A10 d'écrire la phrase
 * exacte avec le seuil et le compte. Il est RECALCULÉ à chaque appel côté
 * serveur, donc il ne périme pas ; le garder en mémoire le ferait.
 */
export const communitiesResponseSchema = z
  .object({
    mine: z.array(myCommunitySchema),
    invitations: z.array(communityPublicSchema),
    pendingRequests: z.array(communityPublicSchema),
    discover: pageSchema(discoverCommunitySchema),
    creationGate: communityCreationGateSchema,
  })
  .strict();

export type CommunitiesResponse = z.infer<typeof communitiesResponseSchema>;

// ── Sujets ──────────────────────────────────────────────────────────────────

/** Une ligne de la liste des sujets. Pas de `body` : la liste ne le porte pas. */
export const topicListItemSchema = z
  .object({
    id: uuidSchema,
    title: z.string(),
    status: z.enum(TopicStatus),
    pinKind: z.enum(TopicPinKind),
    replyCount: z.number().int(),
    /** `null` tant que personne n'a répondu — et non la date de création. */
    lastReplyAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    author: communityAuthorSchema,
  })
  .strict();

export type TopicListItem = z.infer<typeof topicListItemSchema>;

/**
 * `GET /communities/:id/topics` — l'onglet Sujets de A08.
 *
 * Les épinglés sont dans `meta.pinned` et NON intercalés dans `items`, parce
 * qu'un épinglé remis en tête de chaque page y apparaîtrait autant de fois qu'il
 * y a de pages. Ils sont aussi PRÉSENTS dans `items` — mesuré : le sujet épinglé
 * figure aux deux endroits. L'écran qui dessine les deux sans le savoir
 * afficherait deux fois le même sujet.
 */
export const topicsResponseSchema = pageSchema(topicListItemSchema).extend({
  meta: z.object({ pinned: z.array(pinnedTopicSchema) }).strict(),
});

export type TopicsResponse = z.infer<typeof topicsResponseSchema>;

/**
 * Une réponse à un sujet.
 *
 * `parentCommentId` est présent et nullable : les réponses de sujet passent par
 * la table des commentaires, qui n'autorise qu'un niveau de réponse (§2.5). Le
 * service les renvoie À PLAT, dans l'ordre de création — il ne les imbrique pas.
 */
export const topicReplySchema = z
  .object({
    id: uuidSchema,
    body: z.string(),
    createdAt: z.string().datetime(),
    parentCommentId: uuidSchema.nullable(),
    author: communityAuthorSchema,
  })
  .strict();

export type TopicReply = z.infer<typeof topicReplySchema>;

/**
 * `GET /topics/:id` — A09, et LA PORTE DE DERRIÈRE.
 *
 * Cette route atteint un sujet par son identifiant propre, SANS passer par le
 * réseau. C'est le chemin qu'une fuite emprunte, parce qu'il ne ressemble pas à
 * une lecture de réseau. Mesuré : elle refuse un non-membre par le même
 * `403 FORBIDDEN` / `NOT_A_MEMBER` que les sept autres — le service recharge le
 * réseau depuis `topic.communityId` avant de rien rendre.
 *
 * `authorUserId` ET `author.id` portent la même valeur. Les deux sont là parce
 * que le service étale la ligne de base puis y ajoute l'auteur ; `.strict()`
 * oblige à le dire plutôt qu'à l'ignorer.
 *
 * `canResolve`, `canPin` et `canEdit` sont CALCULÉS PAR LE SERVEUR à chaque
 * requête — `canEdit` dépend même d'une fenêtre de quinze minutes. L'écran les
 * lit ; il ne les recalcule pas depuis un rôle qu'il aurait gardé.
 */
export const topicDetailResponseSchema = z
  .object({
    id: uuidSchema,
    communityId: uuidSchema,
    title: z.string(),
    body: z.string(),
    status: z.enum(TopicStatus),
    pinKind: z.enum(TopicPinKind),
    replyCount: z.number().int(),
    lastReplyAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    authorUserId: uuidSchema,
    author: communityAuthorSchema,
    community: z.object({ id: uuidSchema, slug: z.string(), name: z.string() }).strict(),
    canResolve: z.boolean(),
    canPin: z.boolean(),
    canEdit: z.boolean(),
    replies: z.array(topicReplySchema),
  })
  .strict();

export type TopicDetailResponse = z.infer<typeof topicDetailResponseSchema>;

// ── Membres ─────────────────────────────────────────────────────────────────

/**
 * Un membre du réseau. NEUF champs, et ce ne sont PAS ceux de `memberSummary`.
 *
 * Pas de `level` : rien dans cette liste ne dit le niveau de vérification, et
 * c'est cohérent avec la règle du socle — le niveau ne sert jamais à autoriser,
 * donc un écran n'a pas à le lire pour dessiner une liste de membres.
 */
export const communityMemberSchema = z
  .object({
    userId: uuidSchema,
    handle: z.string(),
    displayName: z.string(),
    /** Chemin RELATIF (`/media/…`), jamais une URL absolue. */
    avatarUrl: z.string().nullable(),
    phase: z.enum(Phase),
    city: communityCityRefSchema.nullable(),
    role: z.enum(CommunityMemberRole),
    status: z.enum(CommunityMemberStatus),
    joinedAt: z.string().datetime(),
  })
  .strict();

export type CommunityMember = z.infer<typeof communityMemberSchema>;

/** `GET /communities/:id/members` — et `?pending=true` pour les demandes. */
export const communityMembersResponseSchema = pageSchema(communityMemberSchema);

export type CommunityMembersResponse = z.infer<typeof communityMembersResponseSchema>;

/** `PATCH /communities/:id/members/:userId` — l'état APRÈS, et rien d'autre. */
export const memberMutationResponseSchema = z
  .object({
    userId: uuidSchema,
    /** `null` si la ligne a disparu — un banni garde la sienne, mesuré. */
    role: z.enum(CommunityMemberRole).nullable(),
    status: z.enum(CommunityMemberStatus).nullable(),
  })
  .strict();

export type MemberMutationResponse = z.infer<typeof memberMutationResponseSchema>;

/** `POST /communities/:id/requests/:userId/{accept,reject}`. */
export const requestDecisionResponseSchema = z
  .object({ status: z.enum(['ACTIVE', 'REJECTED']) })
  .strict();

/**
 * `POST /communities/:id/invite` — trois listes de HANDLES, jamais d'identifiants.
 *
 * `alreadyKnown` couvre aussi bien un membre déjà là qu'un banni : le service ne
 * les distingue pas dans sa réponse, et l'écran ne doit donc pas prétendre le
 * faire. Mesuré : inviter un membre déjà présent le range dans `alreadyKnown`,
 * `invited` reste vide.
 */
export const inviteMembersResponseSchema = z
  .object({
    invited: z.array(z.string()),
    alreadyKnown: z.array(z.string()),
    unresolved: z.array(z.string()),
  })
  .strict();

export type InviteMembersResponse = z.infer<typeof inviteMembersResponseSchema>;

// ── Fil, annonces, sondages, albums, carte ──────────────────────────────────

/**
 * Une publication du fil DU RÉSEAU — et elle N'EST PAS une `postCard`.
 *
 * Sept champs bruts, contre seize au fil global. Manquent, mesuré : `typeLabel`,
 * `counter.word`, `reaction.actionLabel`, `commentLabel`, `context`, `media`,
 * `isAuthor`, `stepBadge`, `city`, `community`, `linkRel`. Autrement dit TOUT le
 * vocabulaire que §2.1 fait composer par le serveur.
 *
 * Le front ne le recompose PAS. « Le vocabulaire de réaction renvoyé correspond
 * au type de publication » est une règle dure : un front qui déduirait
 * « Félicitations » du type `VICTORY` créerait une seconde table de vocabulaire,
 * et deux tables divergent toujours. L'écart est remonté au back ; d'ici là
 * l'onglet Fil de A08 montre ce que la route donne, et rien de plus.
 */
export const communityFeedPostSchema = z
  .object({
    id: uuidSchema,
    type: z.enum(PostType),
    /** `body` ENTIER, et non l'`excerpt` tronqué du fil global. */
    body: z.string(),
    createdAt: z.string().datetime(),
    reactionCount: z.number().int(),
    commentCount: z.number().int(),
    author: communityAuthorSchema,
  })
  .strict();

export type CommunityFeedPost = z.infer<typeof communityFeedPostSchema>;

export const communityFeedResponseSchema = pageSchema(communityFeedPostSchema);

export type CommunityFeedResponse = z.infer<typeof communityFeedResponseSchema>;

export const announcementSchema = z
  .object({
    id: uuidSchema,
    body: z.string(),
    createdAt: z.string().datetime(),
    author: communityAuthorSchema,
  })
  .strict();

export type Announcement = z.infer<typeof announcementSchema>;

export const announcementsResponseSchema = pageSchema(announcementSchema);

export type AnnouncementsResponse = z.infer<typeof announcementsResponseSchema>;

/** `POST /communities/:id/announcements` — SANS `author`. Forme différente. */
export const createAnnouncementResponseSchema = z
  .object({ id: uuidSchema, body: z.string(), createdAt: z.string().datetime() })
  .strict();

/**
 * Une option de sondage. `voteCount` est `null` TANT QUE LES RÉSULTATS SONT
 * CACHÉS — il n'est pas à zéro, il est absent de l'information.
 *
 * C'est une garde, pas une commodité : « résultats visibles après vote ou
 * clôture » (§2.3), et le service RETIRE les compteurs de la réponse plutôt que
 * de demander au front de ne pas les afficher — les laisser dans la réponse HTTP
 * reviendrait à les publier. L'écran ne doit donc jamais écrire `?? 0`.
 */
export const pollOptionSchema = z
  .object({
    id: uuidSchema,
    label: z.string(),
    position: z.number().int(),
    voteCount: z.number().int().nullable(),
  })
  .strict();

const pollFields = {
  id: uuidSchema,
  question: z.string(),
  isMultiple: z.boolean(),
  closesAt: z.string().datetime().nullable(),
  /** Calculé serveur : `closesAt` dépassé. Le schéma n'a pas de colonne d'état. */
  closed: z.boolean(),
  createdAt: z.string().datetime(),
  author: communityAuthorSchema,
  myOptionIds: z.array(uuidSchema),
  resultsVisible: z.boolean(),
  /** `null` avec les résultats cachés, comme `voteCount`. */
  totalVotes: z.number().int().nullable(),
  options: z.array(pollOptionSchema),
};

/** Un sondage vu EN LISTE — `GET /communities/:id/polls`. */
export const pollSchema = z.object(pollFields).strict();

export type Poll = z.infer<typeof pollSchema>;

export const pollsResponseSchema = pageSchema(pollSchema);

export type PollsResponse = z.infer<typeof pollsResponseSchema>;

/**
 * Un sondage vu SEUL — `POST /polls/:id/vote` et `POST /polls/:id/close`.
 *
 * IL PORTE UN CHAMP DE PLUS : `communityId`. C'est exactement le genre d'écart
 * qu'on n'invente pas et qu'on ne devine pas — il vient de ce que `poll()` rend
 * la ligne entière là où `polls()` la remodèle. Réutiliser `pollSchema` ici
 * ferait échouer la validation sur un vote parfaitement réussi, et `.strict()`
 * est ce qui a rendu l'écart visible au lieu de le laisser passer.
 */
export const pollDetailResponseSchema = z
  .object({ ...pollFields, communityId: uuidSchema })
  .strict();

export type PollDetailResponse = z.infer<typeof pollDetailResponseSchema>;

export const albumPhotoSchema = z
  .object({
    id: uuidSchema,
    caption: z.string().nullable(),
    /** DEUX champs seulement — pas de `displayName` sur celui qui a posé. */
    uploadedBy: z.object({ id: uuidSchema, handle: z.string() }).strict(),
    createdAt: z.string().datetime(),
    /** `null` tant que l'image est en traitement : le pipeline média ne tourne pas. */
    url: z.string().nullable(),
  })
  .strict();

export const albumSchema = z
  .object({
    id: uuidSchema,
    title: z.string(),
    eventId: uuidSchema.nullable(),
    createdAt: z.string().datetime(),
    createdBy: communityAuthorSchema,
    photoCount: z.number().int(),
    photos: z.array(albumPhotoSchema),
  })
  .strict();

export type Album = z.infer<typeof albumSchema>;

/**
 * `GET /communities/:id/albums`.
 *
 * `nextCursor` est là et vaut TOUJOURS `null` : le service prend les cinquante
 * premiers albums et ne pagine pas. L'écran ne doit donc pas dessiner un
 * « charger la suite » qui ne chargerait jamais rien.
 */
export const albumsResponseSchema = pageSchema(albumSchema);

export type AlbumsResponse = z.infer<typeof albumsResponseSchema>;

/** `POST /communities/:id/albums` — trois champs, sans photos ni auteur. */
export const createAlbumResponseSchema = z
  .object({ id: uuidSchema, title: z.string(), eventId: uuidSchema.nullable() })
  .strict();

/**
 * `GET /communities/:id/map` — les membres par ville.
 *
 * CE N'EST PAS UNE PAGE : la réponse porte `items` et RIEN d'autre, pas même un
 * `nextCursor: null`. `pageSchema` la refuserait, puisqu'il exige `nextCursor`.
 */
export const communityMapResponseSchema = z
  .object({
    items: z.array(
      z
        .object({
          cityId: uuidSchema,
          name: z.string(),
          slug: z.string(),
          memberCount: z.number().int(),
        })
        .strict(),
    ),
  })
  .strict();

export type CommunityMapResponse = z.infer<typeof communityMapResponseSchema>;
