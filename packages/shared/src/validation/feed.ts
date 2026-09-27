import { z } from 'zod';
import {
  CommentSubjectType,
  PostType,
  StoryAudience,
  StoryReactionKind,
  StoryTextStyle,
  StoryType,
  type ReactionKind,
} from '../enums/generated.js';
import { STORY_TYPE_VOCABULARY } from '../constants/post-types.js';
import { cursorQuerySchema, uuidSchema } from './pagination.js';

/**
 * Fil d'actualité — 04-fil.md §2 et §4.
 *
 * SOURCE UNIQUE (00 §4) : ces schémas valident l'API ET le composeur du front.
 * Les bornes de §2.4 (corps 1–3 000, 4 images), de §2.5 (commentaire 1–1 000) et
 * de §2.6 (story ≤ 280) ne sont écrites qu'ici : un composeur qui compterait
 * autrement laisserait le membre rédiger un texte que l'API refuse ensuite.
 *
 * Ce qui n'est PAS ici et ne doit pas y venir : la déduction de la réaction
 * depuis le type de publication est faite par le SERVEUR (§4 : « le serveur
 * déduit le `kind` du type »). Le client n'envoie donc aucun `kind` sur
 * `PUT /posts/:id/reaction`, et il n'y a pas de schéma pour ce corps.
 */

// ── Vocabulaire des réactions de publication (§2.1) ─────────────────────────

/**
 * La réaction STOCKÉE pour chaque type, telle que le tableau de §2.1 la fixe.
 *
 * RÈGLE DURE (§9) : « le vocabulaire de réaction renvoyé correspond au type de
 * publication ». Cette table est la seule autorité : le service ne choisit
 * jamais un `kind` autrement qu'en la lisant, et le front affiche le libellé
 * qu'elle donne.
 *
 * INFO et DISCUSSION partagent `LIKE` — c'est voulu par §2.1 : les deux
 * comptent « N réactions », seul le verbe du bouton change (« J'ai vu » contre
 * « J'aime »). `USEFUL` de l'énumération `ReactionKind` ne sert donc à AUCUN
 * type de publication ; c'est le vote de story `CONSEIL` qui le porte.
 */
export const POST_REACTION_KIND = {
  VICTORY: 'BRAVO',
  QUESTION: 'SUPPORT',
  INFO: 'LIKE',
  DISCUSSION: 'LIKE',
} as const satisfies Record<(typeof PostType)[number], ReactionKind>;

/** Les seuls `kind` qu'une réaction de publication peut prendre (§2.1). */
export const POST_REACTION_KINDS: readonly ReactionKind[] = [
  ...new Set(Object.values(POST_REACTION_KIND)),
];

// ── Rendu des liens sortants (§2.4) ─────────────────────────────────────────

/**
 * « Liens sortants rendus `rel="noopener nofollow ugc"` ».
 *
 * Renvoyé par l'API dans le `meta` des listes plutôt que codé en dur dans le
 * front : une règle de sécurité qui vit dans un composant disparaît au premier
 * écran qu'on oublie de brancher. Le corps, lui, sort en Markdown brut — le
 * rendu est au client, la CONSIGNE de rendu vient du serveur.
 */
export const POST_LINK_REL = 'noopener nofollow ugc';

/** Rappel du composeur de story (§2.6, étape 3). */
export const STORY_COMPOSER_REMINDER = 'Pas de lien, pas de numéro, pas de montant.';

// ── Bornes et limites (§2.4, §2.5, §2.6) ────────────────────────────────────

export const FEED_LIMITS = {
  /** §2.4 : corps de 1 à 3 000 caractères. */
  postBodyMin: 1,
  postBodyMax: 3_000,
  /** §2.4 : jusqu'à 4 images. */
  postMediaMax: 4,
  /** §2.4 : 10 publications par heure, 30 par jour. */
  postsPerHour: 10,
  postsPerDay: 30,
  /** §2.4 et §2.5 : modification pendant 15 minutes, puis figée. */
  editWindowMinutes: 15,
  /** §2.5 : commentaire de 1 à 1 000 caractères, 60 par heure. */
  commentBodyMin: 1,
  commentBodyMax: 1_000,
  commentsPerHour: 60,
  /** §4 : `GET /posts/:id` renvoie les 20 premiers commentaires. */
  detailCommentCount: 20,
  /** §2.3 : une QUESTION dépassant 5 commentaires peut être déplacée. */
  moveToTopicMinReplies: 5,
  /** §2.6 : story ≤ 280 caractères, 3 par jour. */
  storyBodyMax: 280,
  storiesPerDay: 3,
  /** §2.6 : une story vit 24 heures. */
  storyLifetimeHours: 24,
  /** §2.6 : l'auteur garde son historique 30 jours après expiration. */
  storyHistoryDays: 30,
  /** §2.6 : 10 votes négatifs pour moins de 3 positifs ouvrent un dossier. */
  storyNegativeCaseThreshold: 10,
  storyNegativeCasePositiveMax: 3,
  /** §2.3 : remontée locale — la ville du membre et celles à moins de 30 km. */
  localRadiusKm: 30,
  /** §2.7 : les trois prochains événements, trois nouveaux arrivants. */
  sidebarItems: 3,
  /** §2.7 : « Nouveaux arrivants » des 14 derniers jours. */
  newArrivalDays: 14,
  /** §2.7 : « en ligne » = vu il y a moins de 10 minutes. */
  onlineWindowMinutes: 10,
  /** §7 : la colonne droite est mise en cache 5 minutes par ville. */
  sidebarCacheSeconds: 300,
  /** Bandeau de stories : une bulle par auteur, bornée. */
  storyBandMaxAuthors: 30,
} as const;

// ── Fond et rattachement des stories (§2.6) ─────────────────────────────────

/**
 * « fond couleur (palette de 7) ». La palette est ici, et non dans le front :
 * `stories.background_color` est une colonne libre, et sans liste fermée côté
 * serveur n'importe quelle valeur y entrerait — y compris une URL.
 */
export const STORY_BACKGROUND_COLORS = [
  '#1B4332',
  '#2D6A4F',
  '#B7791F',
  '#9C2A2A',
  '#1D3557',
  '#5B3A70',
  '#22333B',
] as const;

export type StoryBackgroundColor = (typeof STORY_BACKGROUND_COLORS)[number];

/**
 * Les « sujets » d'un conseil ou d'une information (§2.6, étape 2).
 *
 * §2.6 exige « une `step_definition` **ou** un sujet » pour un conseil, et
 * « Ville + sujet » pour une information, mais n'énumère JAMAIS les sujets. Deux
 * indices les cadrent : « 1er des conseils **Logement** aujourd'hui » (§2.6,
 * ligne d'état) et « sujet = **démarches** » (§2.6, guichets du jour et dossier
 * priorité 2). Cette liste est donc une INFÉRENCE, signalée comme telle : elle
 * doit être confrontée à la spec avant la mise en production.
 */
export const STORY_SUBJECTS = [
  'DEMARCHES',
  'LOGEMENT',
  'EMPLOI',
  'ETUDES',
  'SANTE',
  'ARGENT',
  'TRANSPORT',
  'VIE_QUOTIDIENNE',
  'AUTRE',
] as const;

export type StorySubject = (typeof STORY_SUBJECTS)[number];

export const STORY_SUBJECT_LABELS: Record<StorySubject, string> = {
  DEMARCHES: 'Démarches',
  LOGEMENT: 'Logement',
  EMPLOI: 'Emploi',
  ETUDES: 'Études',
  SANTE: 'Santé',
  ARGENT: 'Argent',
  TRANSPORT: 'Transport',
  VIE_QUOTIDIENNE: 'Vie quotidienne',
  AUTRE: 'Autre',
};

/**
 * Le sujet qui déclenche les traitements particuliers de §2.6 : « Guichets du
 * jour » de la fiche ville, dossier de modération priorité 2 sur verdict
 * `QUEUE`, et conversion en demande d'entraide.
 */
export const STORY_PAPERWORK_SUBJECT: StorySubject = 'DEMARCHES';

/** §2.6 : catégories d'une découverte — « LIEU · PRODUIT · SORTIE ». */
export const STORY_DISCOVERY_CATEGORIES = ['LIEU', 'PRODUIT', 'SORTIE'] as const;

export type StoryDiscoveryCategory = (typeof STORY_DISCOVERY_CATEGORIES)[number];

/**
 * Le `city_tips.kind` que produit la conversion d'une découverte (§2.6 :
 * « devient un `city_tips` de kind SHOP ou TIP »). Un lieu ou un produit du pays
 * est une adresse — donc `SHOP` ; une sortie est un conseil — donc `TIP`.
 */
export const STORY_DISCOVERY_TIP_KIND: Record<StoryDiscoveryCategory, 'SHOP' | 'TIP'> = {
  LIEU: 'SHOP',
  PRODUIT: 'SHOP',
  SORTIE: 'TIP',
};

/**
 * Les deux votes acceptés par type (§2.6). Dérivé de `STORY_TYPE_VOCABULARY`
 * pour qu'il n'existe qu'UNE table : le libellé affiché et le `kind` accepté ne
 * doivent pas pouvoir diverger.
 */
export const STORY_ALLOWED_REACTIONS = {
  CONSEIL: [
    STORY_TYPE_VOCABULARY.CONSEIL.positive.kind,
    STORY_TYPE_VOCABULARY.CONSEIL.negative.kind,
  ],
  DECOUVERTE: [
    STORY_TYPE_VOCABULARY.DECOUVERTE.positive.kind,
    STORY_TYPE_VOCABULARY.DECOUVERTE.negative.kind,
  ],
  INFORMATION: [
    STORY_TYPE_VOCABULARY.INFORMATION.positive.kind,
    STORY_TYPE_VOCABULARY.INFORMATION.negative.kind,
  ],
} as const satisfies Record<(typeof StoryType)[number], readonly (typeof StoryReactionKind)[number][]>;

/** Vrai si ce vote appartient au type de la story (§2.6, `KIND_NOT_ALLOWED_FOR_TYPE`). */
export function storyReactionAllowed(
  type: (typeof StoryType)[number],
  kind: (typeof StoryReactionKind)[number],
): boolean {
  return (STORY_ALLOWED_REACTIONS[type] as readonly string[]).includes(kind);
}

/** Le vote POSITIF du type — celui dont le compteur s'affiche sous la bulle (§2.6). */
export function storyPositiveKind(
  type: (typeof StoryType)[number],
): (typeof StoryReactionKind)[number] {
  return STORY_TYPE_VOCABULARY[type].positive.kind;
}

/**
 * Ordre par défaut du bandeau (§2.6, lecture) : « informations, puis conseils,
 * puis découvertes ». Un ordre, pas une préférence d'affichage : l'information
 * datée est ce qui périme le plus vite.
 */
export const STORY_BAND_TYPE_ORDER = ['INFORMATION', 'CONSEIL', 'DECOUVERTE'] as const;

// ── Codes d'erreur propres au module (§4) ───────────────────────────────────

export const FEED_ERROR_CODES = {
  /** §2.4 et §2.5 : au-delà de 15 minutes, le texte est figé. */
  EDIT_WINDOW_CLOSED: 422,
  /** Règle locale de modération (13 §2) — et, pour une story, lien ou numéro. */
  CONTENT_BLOCKED: 422,
  /** §2.3 : seule une QUESTION se déplace vers un réseau. */
  NOT_A_QUESTION: 422,
  /** §2.3 : il faut dépasser 5 commentaires. */
  NOT_ENOUGH_REPLIES: 422,
  /** §2.3 : on ne déplace que vers un réseau dont on est membre. */
  NOT_COMMUNITY_MEMBER: 403,
  /** §2.3 : `moved_to_topic_id` déjà renseigné. */
  ALREADY_MOVED: 409,
  /** §2.5 : une seule profondeur de réponse. */
  DEPTH_EXCEEDED: 422,
  /** §2.6 : 3 stories par jour. */
  STORY_LIMIT: 429,
  /** §2.6 : le rattachement obligatoire du type n'est pas fourni. */
  INVALID_ATTACHMENT: 422,
  /** §2.6 : « le service refuse un `kind` qui n'appartient pas au type ». */
  KIND_NOT_ALLOWED_FOR_TYPE: 422,
  /** §2.6 : la conversion se fait AVANT expiration. */
  STORY_EXPIRED: 422,
  ALREADY_CONVERTED: 409,
  /** Une découverte ne devient pas une demande d'entraide, et inversement. */
  INVALID_CONVERSION_TARGET: 422,
  /** L'auteur seul modifie, supprime ou convertit son contenu. */
  NOT_AUTHOR: 403,
} as const;

export type FeedErrorCode = keyof typeof FEED_ERROR_CODES;

export const FEED_ERROR_MESSAGES: Record<FeedErrorCode, string> = {
  EDIT_WINDOW_CLOSED: 'Le délai de modification de 15 minutes est dépassé.',
  // Motif GÉNÉRIQUE (13 §2) : détailler la règle déclenchée apprendrait à la
  // contourner à qui cherche justement à la contourner.
  CONTENT_BLOCKED: 'Ce texte ne peut pas être publié en l’état.',
  NOT_A_QUESTION: 'Seule une question peut être déplacée vers un réseau.',
  NOT_ENOUGH_REPLIES: 'Cette question n’a pas encore assez de réponses pour être déplacée.',
  NOT_COMMUNITY_MEMBER: 'Vous n’êtes pas membre de ce réseau.',
  ALREADY_MOVED: 'Cette question a déjà été déplacée vers un réseau.',
  DEPTH_EXCEEDED: 'On ne répond pas à une réponse. Répondez au commentaire d’origine.',
  STORY_LIMIT: 'Vous avez publié 3 stories aujourd’hui. Revenez demain.',
  INVALID_ATTACHMENT: 'Ce type de story demande un rattachement que vous n’avez pas indiqué.',
  KIND_NOT_ALLOWED_FOR_TYPE: 'Ce vote n’existe pas pour ce type de story.',
  STORY_EXPIRED: 'Cette story a expiré : elle ne peut plus être gardée.',
  ALREADY_CONVERTED: 'Cette story a déjà été gardée.',
  INVALID_CONVERSION_TARGET: 'Ce type de story ne se garde pas sous cette forme.',
  NOT_AUTHOR: 'Seule la personne qui a publié ce contenu peut faire cela.',
};

// ── Schémas d'écriture — publications (§2.4, §4) ────────────────────────────

const postBodySchema = z
  .string()
  .trim()
  .min(FEED_LIMITS.postBodyMin)
  .max(FEED_LIMITS.postBodyMax);

export const createPostSchema = z
  .object({
    /** §2.1 : le type est choisi AVANT la rédaction, et n'est plus modifiable après. */
    type: z.enum(PostType),
    body: postBodySchema,
    /** §2.4 : jusqu'à 4 images, passées par le pipeline média. */
    mediaIds: z.array(uuidSchema).max(FEED_LIMITS.postMediaMax).optional(),
    /** §2.3 : renseigné = fil du réseau, visible de ses membres seuls. */
    communityId: uuidSchema.optional(),
    /** §2.2 : le contexte « Parcours Études » — jamais le titre personnel. */
    journeyId: uuidSchema.optional(),
    /**
     * Jalon partagé (§2.2 et 03 §3.6 : « Partager un jalon […] produit une
     * publication Victoire »). §4 ne le nomme pas dans le corps de `POST /posts`
     * alors que §2.2 en fait la source de l'encart « Étape franchie · N sur M » :
     * sans ce champ, l'encart ne serait alimenté par aucune route.
     */
    journeyStepId: uuidSchema.optional(),
  })
  .strict();

export type CreatePost = z.infer<typeof createPostSchema>;

/** §2.4 : « Modification : 15 minutes après publication ». Le type, jamais. */
export const updatePostSchema = z.object({ body: postBodySchema }).strict();

export type UpdatePost = z.infer<typeof updatePostSchema>;

export const moveToTopicSchema = z.object({ communityId: uuidSchema }).strict();

export type MoveToTopic = z.infer<typeof moveToTopicSchema>;

// ── Schémas d'écriture — commentaires (§2.5, §4) ────────────────────────────

const commentBodySchema = z
  .string()
  .trim()
  .min(FEED_LIMITS.commentBodyMin)
  .max(FEED_LIMITS.commentBodyMax);

export const createCommentSchema = z
  .object({
    /** §2.5 : table polymorphe partagée avec sujets, guides et événements. */
    subjectType: z.enum(CommentSubjectType),
    subjectId: uuidSchema,
    body: commentBodySchema,
    /** §2.5 : « non nul → pas de réponse à une réponse ». */
    parentCommentId: uuidSchema.optional(),
  })
  .strict();

export type CreateComment = z.infer<typeof createCommentSchema>;

export const updateCommentSchema = z.object({ body: commentBodySchema }).strict();

export type UpdateComment = z.infer<typeof updateCommentSchema>;

// ── Schémas d'écriture — stories (§2.6, §4) ─────────────────────────────────

export const createStorySchema = z
  .object({
    type: z.enum(StoryType),
    body: z.string().trim().min(1).max(FEED_LIMITS.storyBodyMax),
    /** L'un OU l'autre, jamais les deux : une story a un seul fond. */
    backgroundColor: z.enum(STORY_BACKGROUND_COLORS).optional(),
    backgroundAssetId: uuidSchema.optional(),
    textStyle: z.enum(StoryTextStyle),
    /**
     * `stories.city_id` est NOT NULL et §2.6 exige la ville pour une découverte
     * comme pour une information ; §4 ne la liste pourtant pas dans le corps de
     * `POST /stories`. Le champ est donc facultatif ICI et retombe sur la ville
     * du membre — un membre sans ville reçoit `INVALID_ATTACHMENT`.
     */
    cityId: uuidSchema.optional(),
    /** Conseil : l'étape à laquelle il se rattache (§2.6, étape 2). */
    stepDefinitionId: uuidSchema.optional(),
    /** Sujet (conseil, information) ou catégorie de découverte. */
    category: z.union([z.enum(STORY_SUBJECTS), z.enum(STORY_DISCOVERY_CATEGORIES)]).optional(),
    placeLabel: z.string().trim().min(1).max(120).optional(),
    /** Information : fin de validité, si plus courte que 24 h. */
    validUntil: z.string().datetime().optional(),
    audience: z.enum(StoryAudience),
    allowMessages: z.boolean(),
  })
  .strict()
  .refine((v) => (v.backgroundColor === undefined) !== (v.backgroundAssetId === undefined), {
    message: 'Indiquez une couleur de fond OU une image de fond, pas les deux.',
    path: ['backgroundColor'],
  });

export type CreateStory = z.infer<typeof createStorySchema>;

export const storyReactionSchema = z.object({ kind: z.enum(StoryReactionKind) }).strict();

export type StoryReactionInput = z.infer<typeof storyReactionSchema>;

/** §2.6 : « un conseil ou une information […] devient une demande d'entraide ». */
export const convertStorySchema = z
  .object({ target: z.enum(['HELP_REQUEST', 'CITY_TIP']) })
  .strict();

export type ConvertStory = z.infer<typeof convertStorySchema>;

// ── Schémas de lecture (§4) ─────────────────────────────────────────────────

/**
 * `GET /feed` (§4). « Aucun filtre n'est appliqué par défaut » (§2.3) : tous les
 * champs sont donc facultatifs et sans valeur par défaut.
 *
 * `communityId` n'est pas dans le tableau de §4, mais §2.3 décrit un « fil de
 * réseau » (`community_id` renseigné, « visible des membres du réseau
 * seulement », tri chronologique pur). Sans ce paramètre, aucune route ne
 * servirait ce fil — et, plus grave, le fil global devrait choisir entre
 * montrer les publications de réseau à tout le monde et ne les montrer à
 * personne.
 */
export const feedQuerySchema = cursorQuerySchema.extend({
  type: z.enum(PostType).optional(),
  cityId: uuidSchema.optional(),
  /** Phase de l'AUTEUR (§2.3) : cibler les pré-départ, ou les installés. */
  phase: z.enum(['PRE_DEPARTURE', 'RECENT_ARRIVAL', 'SETTLED']).optional(),
  communityId: uuidSchema.optional(),
});

export type FeedQuery = z.infer<typeof feedQuerySchema>;

export const commentsQuerySchema = cursorQuerySchema.extend({
  subjectType: z.enum(CommentSubjectType),
  subjectId: uuidSchema,
});

export type CommentsQuery = z.infer<typeof commentsQuerySchema>;

/**
 * `GET /stories` (§4) : le bandeau. Pas de curseur — c'est un bandeau borné
 * d'auteurs ayant des stories actives, pas une archive à parcourir. Le
 * paginer donnerait un anneau vu/non vu incohérent d'une page à l'autre.
 */
export const storiesQuerySchema = z.object({
  type: z.enum(StoryType).optional(),
  cityId: uuidSchema.optional(),
});

export type StoriesQuery = z.infer<typeof storiesQuerySchema>;

/** `GET /me/stories` (§4) : l'historique de 30 jours, avec les votes reçus. */
export const myStoriesQuerySchema = cursorQuerySchema;

export type MyStoriesQuery = z.infer<typeof myStoriesQuerySchema>;
