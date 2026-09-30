import { z } from 'zod';
import {
  CommentSubjectType,
  EventType,
  Phase,
  PostType,
  ReactionKind,
  ScamAlertSeverity,
  StoryAudience,
  StoryReactionKind,
  StoryStatus,
  StoryTextStyle,
  StoryType,
  VerificationLevel,
} from '../enums/generated.js';
import { STORY_TYPE_VOCABULARY } from '../constants/post-types.js';
import { cursorQuerySchema, pageSchema, uuidSchema } from './pagination.js';

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
} as const satisfies Record<
  (typeof StoryType)[number],
  readonly (typeof StoryReactionKind)[number][]
>;

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

const postBodySchema = z.string().trim().min(FEED_LIMITS.postBodyMin).max(FEED_LIMITS.postBodyMax);

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

// ═══ Schémas de RÉPONSE (§4) ═════════════════════════════════════════════════
//
// Écrits ICI, à côté des schémas de requête du même module, parce que `00` §4
// fait de `packages/shared` la source unique : un schéma de réponse recopié dans
// le front serait une deuxième source, et elle divergerait.
//
// Ils ne sont pas devinés. Chaque champ a été relevé sur la charge RÉELLE d'une
// API qui tournait — membre L1 ouvert par le vrai parcours OTP, contenu publié
// par les vraies routes. Les pièges qui en sortent sont notés là où ils se
// manifestent, parce qu'aucun ne se déduit de la spec :
//
//   · une carte de fil porte `excerpt` et PAS de `body` ; le détail porte les deux ;
//   · `meta` change d'une route à l'autre — trois clés sur `GET /feed`, une seule
//     sur `GET /posts/:id`, aucune sur `GET /comments` ;
//   · `greetingHint` est ABSENT (et non `null`) quand le membre n'a pas de ville ;
//   · le `votes` de `GET /me/stories` ÉCRASE celui de la bulle et perd ses deux
//     `kind` : ce n'est pas le même objet, donc ce n'est pas le même schéma ;
//   · `sortKey` est retiré des bulles du bandeau avant l'envoi — l'attendre échoue.
//
// Les dates sont des CHAÎNES ISO : rien ne sérialise les `Date` de Nest autrement
// que `JSON.stringify`, donc `z.string().datetime()` et jamais `z.date()`.

/**
 * Le membre tel que le fil l'expose. Neuf champs, jamais un de plus.
 *
 * `.strict()` — et il faut dire pourquoi, parce qu'un schéma de réponse strict est
 * un choix qui se paie : un champ AJOUTÉ par l'API casse le front au lieu d'être
 * ignoré. C'est assumé ici et sur les quatre autres formes de contenu ci-dessous.
 *
 * La raison est une règle dure, pas un goût pour la rigueur : `01` §2.1 interdit
 * que le numéro de téléphone sorte de l'API autrement que masqué, et `00` §49
 * interdit tout compteur de vues sur tout contenu. Un objet permissif ACCEPTE
 * silencieusement `phone` ou `viewCount` le jour où une requête mal écrite les
 * ajoute — mesuré : sans `.strict()`, un `viewCount: 412` greffé sur une story
 * passait la validation sans un mot. La frontière est le seul endroit où ces deux
 * règles peuvent être tenues pour TOUS les écrans à la fois.
 */
export const memberSummarySchema = z
  .object({
    id: uuidSchema,
    handle: z.string(),
    displayName: z.string(),
    /** Chemin RELATIF (`/media/…`), pas une URL absolue. */
    avatarUrl: z.string().nullable(),
    level: z.enum(VerificationLevel),
    phase: z.enum(Phase),
    cityName: z.string().nullable(),
    countryIso2: z.string().length(2),
    isMentor: z.boolean(),
  })
  .strict();

export type MemberSummary = z.infer<typeof memberSummarySchema>;

/** `{ id, name }` — la ville telle que le fil et les stories la portent. */
const cityRefSchema = z.object({ id: uuidSchema, name: z.string() });

/** La ligne de contexte est COMPOSÉE PAR LE SERVEUR (§2.2), prête à afficher. */
const contextLineSchema = z.object({ text: z.string(), parts: z.array(z.string()) });

/**
 * L'encart « Étape franchie · N sur M » (§2.2).
 *
 * `stepName` peut valoir la CHAÎNE VIDE — le service retombe sur `?? ''` quand la
 * définition d'étape manque. Un `.min(1)` refuserait une charge légitime.
 */
const stepBadgeSchema = z.object({
  label: z.string(),
  stepName: z.string(),
  index: z.number().int(),
  total: z.number().int(),
});

/**
 * La carte de publication du fil. SEIZE champs, tous toujours présents.
 *
 * `excerpt` et pas `body` : le fil tronque à 400 caractères. Un écran qui a besoin
 * du texte entier appelle `GET /posts/:id`. L'absence de `body` ici n'est pas un
 * oubli — c'est ce qui empêche le fil de transporter 3 000 caractères par carte.
 */
export const postCardSchema = z
  .object({
    id: uuidSchema,
    type: z.enum(PostType),
    typeLabel: z.string(),
    excerpt: z.string(),
    createdAt: z.string().datetime(),
    author: memberSummarySchema,
    isAuthor: z.boolean(),
    city: cityRefSchema.nullable(),
    community: z.object({ id: uuidSchema, name: z.string(), slug: z.string() }).nullable(),
    /** §2.4 : quatre images au plus, et c'est le SERVEUR qui le garantit. */
    media: z
      .array(z.object({ position: z.number().int(), url: z.string() }))
      .max(FEED_LIMITS.postMediaMax),
    context: contextLineSchema,
    stepBadge: stepBadgeSchema.nullable(),
    /** §2.1 : le compteur suit le VOCABULAIRE du type, pas un « like » générique. */
    counter: z.object({
      count: z.number().int(),
      displayCount: z.number().int(),
      word: z.string(),
    }),
    reaction: z.object({
      kind: z.enum(ReactionKind),
      actionLabel: z.string(),
      /** La réaction du LECTEUR, ou `null`. Jamais déduite côté client. */
      mine: z.enum(ReactionKind).nullable(),
    }),
    commentCount: z.number().int(),
    commentLabel: z.string(),
    linkRel: z.literal(POST_LINK_REL),
  })
  .strict();

export type PostCard = z.infer<typeof postCardSchema>;

/** `GET /feed` — `meta` porte TROIS clés, dont la consigne de rendu des liens. */
export const feedResponseSchema = pageSchema(postCardSchema).extend({
  meta: z.object({
    linkRel: z.literal(POST_LINK_REL),
    /** §2.4 : le composeur est ouvert ou grisé selon CE champ, pas selon un niveau lu. */
    canPost: z.boolean(),
    scopeKind: z.enum(['GLOBAL', 'COMMUNITY']),
  }),
});

export type FeedResponse = z.infer<typeof feedResponseSchema>;

/** Un commentaire. HUIT champs ; `replies` n'est ajouté que sur les racines. */
const commentCardSchema = z
  .object({
    id: uuidSchema,
    body: z.string(),
    createdAt: z.string().datetime(),
    /** Composé par le serveur : « il y a 2 h ». Le front ne recalcule pas. */
    relativeTime: z.string(),
    parentCommentId: uuidSchema.nullable(),
    author: memberSummarySchema,
    isAuthor: z.boolean(),
    /** §2.5 : vrai pendant 15 minutes, et c'est le SERVEUR qui tranche. */
    canEdit: z.boolean(),
  })
  /**
   * `.strict()` PORTE ICI LA PROFONDEUR UNIQUE de §2.5.
   *
   * `commentThreadSchema` ajoute `replies` aux seules RACINES. Sans `.strict()`,
   * une réponse pouvait porter à son tour un `replies` — mesuré : un troisième
   * niveau passait la validation, alors que le service répond `DEPTH_EXCEEDED`.
   * Le schéma disait donc possible ce que l'API refuse.
   */
  .strict();

/**
 * Une racine de commentaire, avec sa seule profondeur de réponses (§2.5).
 *
 * `replies` n'est PAS récursif, et ce n'est pas une simplification : un
 * `parentCommentId` non nul interdit la réponse à une réponse, et le service
 * répond `DEPTH_EXCEEDED` — mesuré, 422, sur l'API qui tournait. Un schéma
 * récursif inviterait un écran à dessiner un troisième niveau qui ne peut pas
 * exister.
 */
export const commentThreadSchema = commentCardSchema.extend({
  replies: z.array(commentCardSchema),
});

export type CommentThread = z.infer<typeof commentThreadSchema>;

/** `GET /comments` — PAS de `meta` sur cette route. */
export const commentsResponseSchema = z.object({
  items: z.array(commentThreadSchema),
  nextCursor: z.string().nullable(),
});

export type CommentsResponse = z.infer<typeof commentsResponseSchema>;

/** `GET /posts/:id` — la carte, le corps entier, et les 20 premiers commentaires. */
export const postDetailResponseSchema = z.object({
  post: postCardSchema.extend({
    body: z.string(),
    movedTo: z
      .object({
        topicId: uuidSchema,
        community: z.object({ id: uuidSchema, name: z.string(), slug: z.string() }),
        label: z.string(),
      })
      .nullable(),
    /** §2.3 : le déplacement n'est JAMAIS automatique — le serveur dit s'il est offert. */
    canMoveToTopic: z.boolean(),
  }),
  comments: commentsResponseSchema,
  meta: z.object({ linkRel: z.literal(POST_LINK_REL) }),
});

export type PostDetailResponse = z.infer<typeof postDetailResponseSchema>;

/** `PUT`/`DELETE /posts/:id/reaction` — objet PLAT, pas enveloppé. */
export const postReactionStateSchema = z.object({
  kind: z.enum(ReactionKind),
  actionLabel: z.string(),
  mine: z.enum(ReactionKind).nullable(),
  reactionCount: z.number().int(),
  displayCount: z.number().int(),
  word: z.string(),
});

export type PostReactionState = z.infer<typeof postReactionStateSchema>;

/** `POST /posts/:id/move-to-topic` (§2.3). */
export const moveToTopicResponseSchema = z.object({
  topicId: uuidSchema,
  community: z.object({ id: uuidSchema, name: z.string(), slug: z.string() }),
  post: z.object({ id: uuidSchema, movedToTopicId: uuidSchema, label: z.string() }),
});

export type MoveToTopicResponse = z.infer<typeof moveToTopicResponseSchema>;

/** `POST`/`PATCH /comments` — enveloppé, et `replies` y vaut toujours `[]`. */
export const commentMutationResponseSchema = z.object({ comment: commentThreadSchema });

export type CommentMutationResponse = z.infer<typeof commentMutationResponseSchema>;

// ── La colonne droite de l'accueil (§2.7) ───────────────────────────────────

/**
 * `GET /feed/sidebar` — les quatre blocs, tous CALCULÉS par le serveur.
 *
 * `newArrivals.greetingHint` est `.optional()` et NON `.nullable()` : quand le
 * membre n'a pas de ville, le service rend `{ items: [], canGreet: false }` et la
 * clé n'existe pas dans le JSON. `.nullable()` refuserait cette charge, et un
 * membre sans ville verrait un incident de contrat là où il n'y a qu'une absence.
 */
export const feedSidebarResponseSchema = z.object({
  cityEvents: z
    .array(
      z.object({
        id: uuidSchema,
        title: z.string(),
        type: z.enum(EventType),
        startsAt: z.string().datetime(),
        venueName: z.string().nullable(),
        attendeeCount: z.number().int(),
      }),
    )
    .max(FEED_LIMITS.sidebarItems),
  newArrivals: z.object({
    items: z.array(memberSummarySchema).max(FEED_LIMITS.sidebarItems),
    /** §2.7 : « bouton Saluer […] si L1 ». On TENTE quand même ; ceci n'est qu'un affichage. */
    canGreet: z.boolean(),
    greetingHint: z.string().optional(),
  }),
  scamAlert: z
    .object({
      id: uuidSchema,
      title: z.string(),
      body: z.string(),
      severity: z.enum(ScamAlertSeverity),
      publishedAt: z.string().datetime().nullable(),
    })
    .nullable(),
  onlineContacts: z.array(memberSummarySchema),
  meta: z.object({ cachedForSeconds: z.number().int() }),
});

export type FeedSidebarResponse = z.infer<typeof feedSidebarResponseSchema>;

// ── Stories (§2.6) ──────────────────────────────────────────────────────────

/**
 * La bulle de story, partagée par le bandeau, le détail et l'historique.
 *
 * AUCUN COMPTEUR DE VUES, sur aucune route, pas même pour l'auteur : c'est la
 * règle dure de §2.6 et de `00` §49. `seen` est un BOOLÉEN — l'anneau — et
 * ajouter ici un `viewCount` casserait une règle que l'API respecte aujourd'hui.
 *
 * `backgroundUrl` vaut TOUJOURS `null` sur l'API d'aujourd'hui : le service ne
 * résout jamais `backgroundAssetId` en URL. Le champ reste nullable plutôt que
 * `z.null()` pour qu'un branchement futur ne casse pas le contrat, mais une story
 * à fond image est aujourd'hui indessinable — remonté au rapport de lot.
 */
export const storyBubbleSchema = z
  .object({
    id: uuidSchema,
    type: z.enum(StoryType),
    typeLabel: z.string(),
    body: z.string().max(FEED_LIMITS.storyBodyMax),
    backgroundColor: z.string().nullable(),
    backgroundUrl: z.string().nullable(),
    textStyle: z.enum(StoryTextStyle),
    city: cityRefSchema,
    /**
     * Colonne LIBRE en base, pas une énumération : `z.string()` et non
     * `z.enum(STORY_SUBJECTS)`. Un `enum` ici refuserait une ligne écrite hors de
     * ces chemins, et transformerait une donnée inattendue en écran blanc.
     */
    category: z.string().nullable(),
    categoryLabel: z.string().nullable(),
    placeLabel: z.string().nullable(),
    stepDefinition: z.object({ id: uuidSchema, nameFr: z.string() }).nullable(),
    audience: z.enum(StoryAudience),
    allowMessages: z.boolean(),
    createdAt: z.string().datetime(),
    expiresAt: z.string().datetime(),
    validUntil: z.string().datetime().nullable(),
    /** L'ANNEAU (§2.6), pas un compteur. */
    seen: z.boolean(),
    votes: z.object({
      positive: z.number().int(),
      positiveKind: z.enum(StoryReactionKind),
      positiveLabel: z.string(),
      negative: z.number().int(),
      negativeKind: z.enum(StoryReactionKind),
      negativeLabel: z.string(),
    }),
    author: memberSummarySchema,
  })
  /**
   * `.strict()` REND STRUCTURELLE LA RÈGLE « AUCUN COMPTEUR DE VUES ».
   *
   * §2.6 et `00` §49 l’interdisent sur tout contenu, et l’API le respecte : rien
   * n’expose `viewCount`, pas même à l’auteur. Mais un objet permissif ACCEPTE un
   * champ en trop, et c’est mesuré : `viewCount: 412` greffé sur une bulle passait
   * la validation sans un mot. Un écran aurait pu l’afficher, et aucun test de
   * schéma ne l’aurait vu. Ici, la charge est refusée à la frontière.
   */
  .strict();

export type StoryBubble = z.infer<typeof storyBubbleSchema>;

/**
 * `GET /stories` — le bandeau, une bulle par AUTEUR.
 *
 * `nextCursor` vaut toujours `null` : §4 ne pagine pas le bandeau, et le paginer
 * donnerait un anneau vu/non-vu incohérent d'une page à l'autre. `sortKey` est
 * retiré par le service avant l'envoi — ne pas l'attendre.
 */
export const storyBandResponseSchema = z.object({
  items: z
    .array(
      z.object({
        author: memberSummarySchema,
        isMe: z.boolean(),
        /** L'anneau vert : vrai tant qu'UNE story de l'auteur n'est pas vue. */
        hasUnseen: z.boolean(),
        stories: z.array(storyBubbleSchema),
      }),
    )
    .max(FEED_LIMITS.storyBandMaxAuthors),
  nextCursor: z.string().nullable(),
  meta: z.object({
    canCreate: z.boolean(),
    typeOrder: z.array(z.enum(StoryType)),
    reminder: z.literal(STORY_COMPOSER_REMINDER),
  }),
});

export type StoryBandResponse = z.infer<typeof storyBandResponseSchema>;

/** `GET /stories/:id` et `POST /stories` — la même forme. */
export const storyDetailResponseSchema = z.object({
  story: storyBubbleSchema.extend({
    /** « 1er des conseils Logement aujourd'hui · 31 trouvent utile » — composé serveur. */
    stateLine: z.string(),
    rank: z.number().int().min(1),
    peerCount: z.number().int().min(1),
    myReaction: z.enum(StoryReactionKind).nullable(),
    bookmarked: z.boolean(),
    isAuthor: z.boolean(),
    expired: z.boolean(),
    canMessage: z.boolean(),
    context: z.object({
      text: z.string(),
      parts: z.array(z.string()),
      expiresIn: z.string(),
    }),
  }),
  meta: z.object({ reminder: z.literal(STORY_COMPOSER_REMINDER) }),
});

export type StoryDetailResponse = z.infer<typeof storyDetailResponseSchema>;

/**
 * `GET /me/stories` — l'historique de 30 jours.
 *
 * ATTENTION : son `votes` n'est PAS celui de la bulle. Le service l'écrase après
 * l'étalement, et la version d'ici PERD `positiveKind` et `negativeKind`.
 * Réutiliser `storyBubbleSchema` tel quel ferait échouer la validation sur deux
 * champs manquants — d'où le `.extend()` qui le remplace explicitement.
 */
export const myStoriesResponseSchema = z.object({
  items: z.array(
    storyBubbleSchema.extend({
      status: z.enum(StoryStatus),
      expired: z.boolean(),
      convertedTo: z.object({ type: z.string().nullable(), id: uuidSchema }).nullable(),
      /**
       * QUATRE clés, et `.strict()` pour que ce soit vérifié.
       *
       * Sans lui, un `votes` à six clés — celui de la bulle, avec ses `kind` —
       * passait ici : mesuré. Un écran d'historique aurait alors lu
       * `votes.positiveKind` en développement contre une charge fabriquée, et
       * `undefined` en production contre la vraie.
       */
      votes: z
        .object({
          positive: z.number().int(),
          positiveLabel: z.string(),
          negative: z.number().int(),
          negativeLabel: z.string(),
        })
        .strict(),
    }),
  ),
  nextCursor: z.string().nullable(),
});

export type MyStoriesResponse = z.infer<typeof myStoriesResponseSchema>;

/** `PUT`/`DELETE /stories/:id/reaction` — le seul endroit où `score` sort. */
export const storyVotesResponseSchema = z.object({
  positive: z.number().int(),
  positiveKind: z.enum(StoryReactionKind),
  positiveLabel: z.string(),
  negative: z.number().int(),
  negativeKind: z.enum(StoryReactionKind),
  negativeLabel: z.string(),
  score: z.number(),
});

export type StoryVotesResponse = z.infer<typeof storyVotesResponseSchema>;

/** `POST /stories/:id/convert` (§2.6). */
export const convertStoryResponseSchema = z.object({
  target: z.enum(['HELP_REQUEST', 'CITY_TIP']),
  targetId: uuidSchema,
  storyId: uuidSchema,
});

export type ConvertStoryResponse = z.infer<typeof convertStoryResponseSchema>;
