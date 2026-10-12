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
 * LES RÈGLES DU RÉSEAU — l'onglet « À propos » en dessine trois, et sa planche
 * d'édition écrit « RÈGLES DU RÉSEAU · 4 SUR 8 ». Le plafond de huit est donc
 * celui du dessin, et il est ICI pour que le compteur de l'écran et le refus du
 * serveur disent le même nombre.
 */
export const COMMUNITY_MAX_RULES = 8;
export const communityRuleSchema = z.string().trim().min(3).max(200);

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ SEPT JOURS POUR REVENIR SUR UN MASQUAGE — ARBITRAGE DU PORTEUR             ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * §2.4 donne aux modérateurs de réseau le droit de masquer un sujet, et RIEN ne
 * leur permettait de revenir sur une erreur de clic : seule l'équipe pouvait
 * rétablir (`ModerationActionType.UNHIDE`, module 13). Le porteur a tranché —
 * « le modérateur qui a masqué peut remettre dans les sept jours ; au-delà, seule
 * l'équipe ».
 *
 * La borne est ICI et non dans le service parce que l'écran doit dire la même
 * chose que l'API refuse : la carte de modération d'un sujet masqué montre le
 * geste tant qu'il reste dans la fenêtre, et c'est le serveur qui calcule
 * `unhideUntil`. Un `7` recopié dans le front serait une seconde source.
 */
export const TOPIC_UNHIDE_WINDOW_DAYS = 7;

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
  /**
   * BANNI du réseau : ne peut plus rejoindre (§2.4).
   *
   * ⚠ LE COMMENTAIRE DISAIT « RETIRÉ », ET C'ÉTAIT DEVENU FAUX. Le porteur a
   * tranché : « Retirer, il peut rejoindre à nouveau. Mais banni, il ne peut plus
   * rejoindre. » Un membre RETIRÉ n'a plus de ligne d'adhésion du tout, donc il
   * ne rencontre jamais ce refus — il redemande comme n'importe qui. Ce code ne
   * concerne QUE le bannissement.
   */
  BANNED_FROM_COMMUNITY: 403,
  /**
   * La sourdine ne se pose QUE sur son propre rang (§4 : « `muted` (soi-même) »).
   *
   * Ce n'est pas une variante de `FORBIDDEN` : la sourdine n'est pas de la
   * modération, c'est une PRÉFÉRENCE. Un propriétaire ne peut pas faire taire
   * un réseau pour quelqu'un d'autre, et un modérateur non plus — il n'existe
   * aucun rôle qui le permette. Un code à part le dit, là où un `403 FORBIDDEN`
   * laisserait croire qu'un rang plus élevé y donnerait droit.
   */
  MUTE_SELF_ONLY: 403,
  /**
   * `muted` arrive dans le même corps que `role` ou `status`.
   *
   * Refusé plutôt que départagé : les deux gestes n'ont ni le même acteur
   * (soi-même contre un modérateur) ni la même nature (préférence contre
   * modération), et une requête qui les mêle ne peut pas être journalisée
   * honnêtement — une seule ligne d'audit devrait décrire deux actes.
   */
  MUTE_ALONE: 422,
  /** Le signalement ne vise aucun contenu de ce réseau (§2.4). */
  REPORT_NOT_IN_COMMUNITY: 404,
  /** Le signalement est déjà clos : la décision a déjà été prise (§2.4). */
  REPORT_ALREADY_DECIDED: 409,
  /**
   * Le masquage d'un sujet a plus de sept jours : seule l'équipe peut encore le
   * rétablir (arbitrage du porteur, `TOPIC_UNHIDE_WINDOW_DAYS`).
   */
  UNHIDE_WINDOW_CLOSED: 422,
  /** « Autoriser les sondages par tous les membres » est éteint (Gérer · Paramètres). */
  POLLS_RESTRICTED: 403,
  /** « Album ouvert aux membres » est éteint (Gérer · Paramètres). */
  ALBUM_RESTRICTED: 403,
  /** La publication n'attend aucune validation, ou a déjà été décidée. */
  POST_NOT_PENDING: 409,
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
  AUTO_COMMUNITY:
    'Ce réseau est le vôtre par votre ville ou votre pays : vous ne pouvez pas le quitter, mais vous pouvez le mettre en sourdine.',
  ANNOUNCEMENT_LIMIT: 'Deux annonces par semaine au maximum.',
  POLL_CLOSED: 'Ce sondage est clos.',
  COMMUNITY_ARCHIVED: 'Ce réseau est archivé : il reste en lecture seule.',
  PIN_LIMIT: 'Cinq épinglés au maximum. Retirez-en un avant d’en ajouter.',
  OWNER_MUST_TRANSFER: 'Transférez la propriété du réseau avant de le quitter.',
  BANNED_FROM_COMMUNITY: 'Vous ne pouvez plus rejoindre ce réseau.',
  MUTE_SELF_ONLY:
    'La sourdine est une préférence personnelle : elle ne se pose que sur son propre rang.',
  MUTE_ALONE: 'La sourdine se change seule, sans toucher au rôle ni au statut du membre.',
  REPORT_NOT_IN_COMMUNITY: 'Ce signalement ne vise aucun contenu de ce réseau.',
  REPORT_ALREADY_DECIDED: 'Ce signalement a déjà été traité.',
  // Le nombre de jours arrive dans `details` : le front compose la phrase, le
  // back ne fabrique pas de texte avec des trous (même règle que CITY_THRESHOLD).
  UNHIDE_WINDOW_CLOSED:
    'Ce masquage est trop ancien : seule l’équipe peut encore remettre ce contenu.',
  POLLS_RESTRICTED: 'Dans ce réseau, seuls les modérateurs créent des sondages.',
  ALBUM_RESTRICTED: 'Dans ce réseau, seuls les modérateurs ajoutent des photos aux albums.',
  POST_NOT_PENDING: 'Cette publication n’attend plus de validation.',
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
    /**
     * LES RÈGLES ET LES TROIS PARAMÈTRES DE « GÉRER ».
     *
     * Ils sont ouverts aux MODÉRATEURS, là où le nom, la catégorie, la
     * visibilité et la couverture restent au propriétaire : un réseau
     * automatique n'a PAS de propriétaire (§2.1, ses bénévoles sont des
     * modérateurs), et sans cela personne ne pourrait jamais y écrire ses
     * règles. C'est le service qui fait la différence ; le schéma ne porte que
     * les formes.
     */
    rules: z.array(communityRuleSchema).max(COMMUNITY_MAX_RULES).optional(),
    postsRequireApproval: z.boolean().optional(),
    pollsOpenToMembers: z.boolean().optional(),
    albumOpenToMembers: z.boolean().optional(),
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
 *
 * ── `muted` ARRIVE PAR LA MÊME ROUTE ET N'EST PAS LE MÊME GESTE ────────────
 *
 * §4 le met explicitement dans cette ligne du tableau : « `role`, `status`
 * (BANNED), `muted` (soi-même) ». Il PARTAGE donc la route, et c'est le service
 * qui départage — mais les deux gestes n'ont rien en commun :
 *
 *   · `role` et `status` sont de la MODÉRATION : un modérateur les pose sur
 *     quelqu'un d'autre, et §2.4 exige une ligne d'`audit_logs` ;
 *   · `muted` est une PRÉFÉRENCE (§2.5) : n'importe quel membre la pose sur son
 *     propre rang, et il n'y a rien à journaliser — personne n'a de pouvoir à
 *     rendre compte sur le silence qu'il se choisit.
 *
 * ⚠ C'est pourquoi le service REFUSE un corps qui mêle `muted` à l'un des deux
 * (`MUTE_ALONE`) au lieu de les appliquer ensemble : une seule requête ne peut
 * pas être à la fois un acte de modération et un réglage personnel, et une
 * seule ligne d'audit ne saurait pas décrire les deux.
 /**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ « RETIRER » N'EST PAS UNE VALEUR DE `status` — C'EST UNE AUTRE ROUTE        ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « Retirer, il peut rejoindre à nouveau. Mais banni, il ne peut
 * plus rejoindre. » La maquette dessinait donc bien DEUX entrées dans le menu
 * d'une ligne de membre, et §2.4 — qui n'écrit que « retirer un membre
 * (`BANNED`) » — est incomplet.
 *
 * `status: 'BANNED'` reste le bannissement. Retirer est `DELETE
 * /communities/:id/members/:userId`, et c'est une route et non une troisième
 * valeur ici pour une raison de forme : retirer FAIT DISPARAÎTRE la ligne
 * d'adhésion, exactement comme `POST /leave` le fait pour soi-même. Un
 * `status: 'REMOVED'` serait un état que `CommunityMemberStatus` ne porte pas, et
 * le schéma de base est figé.
 */
export const updateMemberSchema = z
  .object({
    role: z.enum(['MODERATOR', 'MEMBER']).optional(),
    status: z.enum(['ACTIVE', 'BANNED']).optional(),
    /** La sourdine du §2.5 — sur son PROPRE rang seulement (`MUTE_SELF_ONLY`). */
    muted: z.boolean().optional(),
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

/**
 * Titre d'annonce : 3–120, FACULTATIF.
 *
 * ── LES DEUX BORNES, ET D'OÙ ELLES VIENNENT ─────────────────────────────────
 *
 * Le maximum est celui de `topicTitleSchema` — 120 — parce que c'est le titre de
 * l'autre objet titré du MÊME module, affiché dans les mêmes listes et la même
 * largeur de carte. Deux maximums différents pour deux titres voisins seraient
 * une divergence sans raison, et la planche n'en fixe aucun.
 *
 * Le minimum, lui, est 3 et NON 10 : les dix de `topicTitleSchema` « écartent les
 * "aide !" sans objet », ce qui a du sens pour une question posée à un réseau.
 * Une annonce est écrite par le propriétaire et peut légitimement s'appeler
 * « AG », « Fête » ou « Visa ». Trois caractères est le minimum qui écarte la
 * frappe accidentelle sans écarter un mot réel.
 *
 * ⚠ FACULTATIF, et c'est la colonne qui le décide : `community_announcements.title`
 * est NULLABLE, parce que les annonces publiées avant ce lot n'en ont pas. Le
 * rendre obligatoire ici donnerait un schéma qui refuse ce que la table contient.
 */
export const announcementTitleSchema = z.string().trim().min(3).max(120);

/**
 * `POST /communities/:id/announcements` — LES QUATRE CONTRÔLES DE LA PLANCHE.
 *
 * ── CE SCHÉMA N'EN ACCEPTAIT QU'UN, ET C'ÉTAIT UN ÉCART DE CONTRAT ──────────
 *
 * Le porteur : « L'annonce : tous les champs doivent être branchés. » MESURÉ : la
 * planche « ADMIN · ANNONCE » dessine QUATRE contrôles sur les DEUX largeurs —
 * un titre, un corps, « Épingler en haut du fil », « Notifier les 890 membres » —
 * et ce schéma n'acceptait que `{ body }`. Deux des quatre n'avaient nulle part
 * où s'écrire : ce n'était pas un oubli de branchement d'écran, c'était la table
 * et le schéma qui étaient en deçà du dessin.
 *
 * ── LES DEUX DÉFAUTS SONT L'ANCIEN COMPORTEMENT, AU BIT PRÈS ────────────────
 *
 * Même règle que les deux réglages de sondage juste en dessous, et pour la même
 * raison : un appelant qui ne passe NI `pinned` NI `notify` doit obtenir
 * exactement ce qu'il obtenait avant ce lot. Avant, toute annonce émettait sa
 * notification et aucune n'était épinglée — d'où `notify: true` et
 * `pinned: false`.
 *
 * ⚠ CE N'EST PAS CE QUE LA PLANCHE DESSINE, et l'écart est volontaire : elle
 * montre les DEUX interrupteurs ALLUMÉS. C'est l'ÉCRAN qui part de cet état
 * (`use-annonce.ts`), pas le schéma — un défaut de schéma à `pinned: true`
 * épinglerait toute annonce créée par un appel direct, c'est-à-dire changerait le
 * sens d'un appel existant.
 */
export const createAnnouncementSchema = z
  .object({
    title: announcementTitleSchema.optional(),
    body: z.string().trim().min(1).max(2_000),
    /** « Épingler en haut du fil ». Exclusif : le service déépingle les autres. */
    pinned: z.boolean().default(false),
    /** « Notifier les N membres ». C'est lui qui pose `notified_at`. */
    notify: z.boolean().default(true),
  })
  .strict();

export type CreateAnnouncement = z.infer<typeof createAnnouncementSchema>;

/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║ `PATCH /communities/:id/announcements/:announcementId` — ÉPINGLER ET      ║
 * ║ SURTOUT DÉSÉPINGLER                                                       ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 *
 * ── LE MANQUE QUE CETTE ROUTE COMBLE, ARBITRÉ LE 2026-10-11 ───────────────
 *
 * `createAnnouncement` pose `pinned_at` et déépingle les autres dans la même
 * transaction : l'épinglage est EXCLUSIF, et le porteur a confirmé qu'il le
 * reste. Mais il n'existait AUCUN chemin pour revenir à « aucune annonce
 * épinglée » : on ne pouvait que remplacer l'épinglée par une autre. « Épingler
 * en haut du fil » était une porte à sens unique — une fois franchie, le haut du
 * fil portait une annonce pour toujours, même devenue fausse (« Jusqu'au 14
 * mars », que la planche écrit elle-même sous l'interrupteur).
 *
 * ── UN SEUL CHAMP, ET IL EST OBLIGATOIRE ─────────────────────────────────
 *
 * `pinned: boolean`, sans `.optional()` ni défaut. Le besoin arbitré est le
 * RETRAIT (`false`) ; `true` est servi par la même route parce que la question
 * posée est la même — « cette annonce est-elle en haut du fil ? » — et qu'une
 * route par sens aurait doublé la garde de modération pour rien.
 *
 * ⚠ L'EXCLUSIVITÉ VAUT ICI AUSSI, et c'est le service qui la tient : épingler
 * une ANCIENNE annonce déépingle la courante. Sans cela la règle tiendrait à la
 * création et nulle part ailleurs, et deux annonces épinglées seraient
 * atteignables par le chemin le plus évident.
 *
 * Le corps est `.strict()` : ni `title`, ni `body`, ni `notify`. Une annonce
 * publiée ne se réécrit pas — §2.3 ne le prévoit pas, la planche ne dessine
 * aucune édition d'annonce, et la notification est déjà partie.
 */
export const updateAnnouncementSchema = z.object({ pinned: z.boolean() }).strict();

export type UpdateAnnouncement = z.infer<typeof updateAnnouncementSchema>;

/**
 * LES DEUX BORNES D'UN SONDAGE, NOMMÉES PLUTÔT QU'ÉCRITES.
 *
 * Elles étaient deux nombres dans le schéma, et l'écran qui compose un sondage en
 * a besoin : sans elles, il laisserait ajouter une neuvième réponse que le serveur
 * refuserait à la publication — un refus que le membre ne découvrirait qu'à la
 * fin. Un `8` recopié dans le front serait une seconde source, et quatre bornes
 * recopiées ont déjà divergé dans ce dépôt.
 *
 * ⚠ LA MAQUETTE ÉCRIT « 2 à 5 » sous le titre « Options », là où §2.3 et ce schéma
 * disent 2 à 8. L'écart est REMONTÉ : on suit le SERVEUR, qui est ce qui refuse.
 */
export const POLL_OPTIONS_MIN = 2;
export const POLL_OPTIONS_MAX = 8;

export const createPollSchema = z.object({
  question: z.string().trim().min(5).max(200),
  /** 2–8 options (§2.3). Une seule option n'est pas un sondage. */
  options: z.array(z.string().trim().min(1).max(100)).min(POLL_OPTIONS_MIN).max(POLL_OPTIONS_MAX),
  isMultiple: z.boolean().default(false),
  closesAt: z.coerce.date().optional(),
  /**
   * ── LES DEUX RÉGLAGES QUE LA MAQUETTE DESSINE ─────────────────────────────
   *
   * Ils étaient deux interrupteurs inertes : le produit imposait les deux règles.
   * Le porteur a tranché — « non, fais de ça un réglage ».
   *
   * LES DÉFAUTS SONT L'ANCIEN COMPORTEMENT, au bit près : résultats masqués avant
   * le vote, et aucun nom de votant. Un appelant qui ne les passe pas obtient donc
   * exactement ce qu'il obtenait, ce qui est la seule façon d'ajouter un réglage
   * sans changer le sens de ce qui existe.
   */
  resultsAfterVote: z.boolean().default(true),
  /**
   * LE DÉFAUT EST LE SILENCE. C'est le seul défaut acceptable pour un réglage de
   * confidentialité : un sondage créé sans rien dire ne nomme personne.
   */
  isAnonymous: z.boolean().default(true),
});

export type CreatePoll = z.infer<typeof createPollSchema>;

export const pollVoteSchema = z.object({
  /** Un seul identifiant si le sondage est à choix unique — le service l'exige. */
  optionIds: z.array(uuidSchema).min(1).max(8),
});

/**
 * LE TITRE D'UN ALBUM, NOMMÉ À PART POUR QUE L'ÉCRAN LISE SES BORNES.
 *
 * Il était écrit en ligne dans `createAlbumSchema`, donc invisible au front : la
 * fenêtre « Nouvel album » aurait dû RECOPIER 3 et 80, et le mémo l'interdit
 * (« les bornes ne se recopient jamais : on les importe »). Nommé, le schéma
 * porte `minLength` et `maxLength`, que `use-reseau.ts` lit — exactement ce que
 * `announcementTitleSchema` fait déjà pour le formulaire d'annonce.
 *
 * AUCUNE BORNE NE CHANGE : `.trim().min(3).max(80)`, au caractère près.
 */
export const albumTitleSchema = z.string().trim().min(3).max(80);

export const createAlbumSchema = z.object({
  title: albumTitleSchema,
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
    /**
     * MA sourdine sur CE réseau (§2.5) — jamais celle d'un autre membre.
     *
     * UN BOOLÉEN ET NON UN NULLABLE, là où `myRole` et `myStatus` sont nuls pour
     * un passant. La différence n'est pas une inconséquence : « quel est mon
     * rôle ? » n'a pas de réponse quand on n'est pas membre, tandis que « ce
     * réseau me notifie-t-il ? » en a toujours une — non, et `false` la dit.
     * Un `null` ici obligerait les sept cadres qui dessinent le bouton
     * « Sourdine » à distinguer trois états pour un interrupteur qui en a deux.
     */
    myMuted: z.boolean(),
    /**
     * LES RÈGLES ET LES PARAMÈTRES — publics, comme la description : un passant
     * doit pouvoir lire les règles d'un réseau AVANT de le rejoindre, et savoir
     * si ses publications passeront par un modérateur.
     */
    /**
     * DES DÉFAUTS, ET NON DES CHAMPS EXIGÉS : les charges relevées sur l'API
     * avant ce lot (`packages/shared/src/__tests__/fixtures/community_detail_*`)
     * ne les portent pas, et elles sont relevées octet pour octet — on ne les
     * retouche pas. Les défauts sont ceux d'un réseau tel que la migration le
     * crée : aucune règle, rien en validation, sondages et album ouverts, pas de
     * pilotage, équipe inconnue. L'API, elle, les envoie toujours.
     */
    rules: z.array(z.string()).default([]),
    settings: z
      .object({
        postsRequireApproval: z.boolean(),
        pollsOpenToMembers: z.boolean(),
        albumOpenToMembers: z.boolean(),
      })
      .strict()
      .default({ postsRequireApproval: false, pollsOpenToMembers: true, albumOpenToMembers: true }),
    /**
     * LES DEUX TUILES DE « GÉRER » — « +34 ce mois » et « 61 % actifs sur 30
     * jours », dessinées en dur. Rendues à l'ÉQUIPE seulement (`null` pour tout
     * autre lecteur) : un taux d'activité est une donnée de pilotage, pas une
     * information publique.
     *
     *   · `joinedThisMonth` — adhésions ACTIVES dont `joinedAt` tombe dans le
     *     mois civil en cours (UTC) ;
     *   · `activeLast30Days` — membres actifs ayant publié dans le fil du réseau
     *     ou ouvert un sujet ces trente derniers jours.
     */
    stats: z
      .object({
        joinedThisMonth: z.number().int(),
        activeLast30Days: z.number().int(),
      })
      .strict()
      .nullable()
      .default(null),
    /**
     * L'ÉQUIPE — le propriétaire et les modérateurs ACTIFS, pour la carte
     * « ÉQUIPE » de l'onglet « À propos ». Publique pour la même raison que les
     * règles : « Contacter les modérateurs » est proposé à un passant, et il
     * doit savoir qui il contacte. Bornée par le service.
     */
    team: z
      .array(
        z
          .object({
            userId: uuidSchema,
            handle: z.string(),
            displayName: z.string(),
            avatarUrl: z.string().nullable(),
            role: z.enum(CommunityMemberRole),
          })
          .strict(),
      )
      .default([]),
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

/**
 * Un réseau de MA liste : l'en-tête public, plus mon rôle et ma date d'entrée.
 *
 * `muted` EST AJOUTÉ ICI, et pas seulement sur la fiche : la maquette A07
 * dessine une pastille « En sourdine » sur les cartes de « Mes réseaux »
 * (`n.muted` dans le cadre transcodé), qui était posée à `false` en dur faute de
 * colonne. §2.5 dit « le réseau reste dans sa liste » — c'est donc dans la liste
 * qu'il faut pouvoir dire qu'il est silencieux, sinon la sourdine devient
 * invisible et on ne sait plus laquelle on a posée.
 */
export const myCommunitySchema = communityPublicSchema
  .extend({
    myRole: z.enum(CommunityMemberRole),
    joinedAt: z.string().datetime(),
    /** §2.5 — la pastille « En sourdine » des cartes de « Mes réseaux ». */
    muted: z.boolean(),
  })
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
    /**
     * ── LE SUJET EST-IL MASQUÉ, ET PEUT-ON ENCORE LE REMETTRE ? ─────────────
     *
     * `GET /topics/:id` ne rendait QUE les sujets visibles (`deleted_at IS
     * NULL`). Un modérateur qui venait de masquer par erreur tombait donc sur un
     * `404` : il n'y avait plus d'écran où revenir sur son clic. La route rend
     * maintenant le sujet masqué AUX MODÉRATEURS du réseau, et ces trois champs
     * disent quoi en faire.
     *
     * `canUnhide` est CALCULÉ PAR LE SERVEUR, comme `canEdit` : il dépend d'une
     * fenêtre de sept jours qui se referme pendant qu'on lit la page. L'écran le
     * lit, il ne le recalcule pas — et il ne s'en sert jamais pour autoriser :
     * le geste est tenté, le serveur refuse si la fenêtre s'est fermée.
     */
    hidden: z.boolean(),
    canUnhide: z.boolean(),
    /** La fin de la fenêtre de sept jours. `null` quand le sujet n'est pas masqué. */
    unhideUntil: z.string().datetime().nullable(),
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
    /**
     * NUL pour une demande en ATTENTE (`?pending=true`) : on n'a pas encore
     * rejoint. Le schéma l'exigeait non nul, alors que le service rend
     * `joinedAt: null` sur chaque ligne `PENDING` — MESURÉ : toute la page de
     * demandes échouait à la validation côté écran, et la carte « Demandes
     * d'adhésion » de « Gérer » restait à zéro sur un réseau qui en avait.
     */
    joinedAt: z.string().datetime().nullable(),
  })
  .strict();

export type CommunityMember = z.infer<typeof communityMemberSchema>;

/** `GET /communities/:id/members` — et `?pending=true` pour les demandes. */
export const communityMembersResponseSchema = pageSchema(communityMemberSchema);

export type CommunityMembersResponse = z.infer<typeof communityMembersResponseSchema>;

/**
 * `PATCH /communities/:id/members/:userId` — l'état APRÈS, et rien d'autre.
 *
 * `muted` EST SERVI PAR LES TROIS CHEMINS de la route — rôle, bannissement,
 * sourdine — et non seulement par celui qui le change. L'écran rebascule un
 * interrupteur sur cette réponse : s'il n'arrivait que sur un chemin, le cadre
 * devrait deviner sa valeur sur les deux autres, ce qui est exactement la
 * seconde vérité qu'on refuse (le bouton « Sourdine » lirait une chose et le
 * serveur en porterait une autre).
 */
export const memberMutationResponseSchema = z
  .object({
    userId: uuidSchema,
    /** `null` si la ligne a disparu — un banni garde la sienne, mesuré. */
    role: z.enum(CommunityMemberRole).nullable(),
    status: z.enum(CommunityMemberStatus).nullable(),
    /** §2.5 — l'état de la sourdine APRÈS le geste. */
    muted: z.boolean(),
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

/**
 * Une annonce telle que `GET /communities/:id/announcements` la rend.
 *
 * LES TROIS CHAMPS AJOUTÉS SONT NULLABLES ET NON FACULTATIFS, et la différence
 * compte sous `exactOptionalPropertyTypes` : le service les SÉLECTIONNE tous les
 * trois, donc ils sont toujours présents dans la charge — avec la valeur `null`
 * quand le fait n'a pas eu lieu. Un `.optional()` laisserait croire qu'ils
 * peuvent manquer, et un écran écrirait alors `?? ` sur une absence qui n'arrive
 * jamais.
 *
 * `pinnedAt` et `notifiedAt` voyagent en INSTANTS plutôt qu'en booléens, comme
 * les colonnes : « épinglée depuis le 11 octobre » est affichable, « épinglée :
 * vrai » ne l'est pas.
 */
export const announcementSchema = z
  .object({
    id: uuidSchema,
    /** Nul sur les annonces publiées avant que la colonne existe. */
    title: z.string().nullable(),
    body: z.string(),
    /** Non nul = épinglée en haut du fil, et depuis cet instant. */
    pinnedAt: z.string().datetime().nullable(),
    /** Non nul = la notification est partie, et à cet instant. */
    notifiedAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    author: communityAuthorSchema,
  })
  .strict();

export type Announcement = z.infer<typeof announcementSchema>;

export const announcementsResponseSchema = pageSchema(announcementSchema);

export type AnnouncementsResponse = z.infer<typeof announcementsResponseSchema>;

/**
 * `POST /communities/:id/announcements` — SANS `author`. Forme différente.
 *
 * Elle porte MAINTENANT les trois mêmes champs que la forme de liste, moins
 * l'auteur : c'est le propriétaire qui vient de publier, il se connaît. L'écran
 * en a besoin pour afficher ce qu'il vient de faire sans rappeler la liste —
 * notamment pour dire si la notification est partie.
 */
export const createAnnouncementResponseSchema = z
  .object({
    id: uuidSchema,
    title: z.string().nullable(),
    body: z.string(),
    pinnedAt: z.string().datetime().nullable(),
    notifiedAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
  })
  .strict();

export type CreateAnnouncementResponse = z.infer<typeof createAnnouncementResponseSchema>;

/**
 * `PATCH /communities/:id/announcements/:announcementId` — DEUX CHAMPS.
 *
 * Volontairement plus court que la forme de création : le seul fait que la
 * requête change est l'épinglage, et renvoyer `title`, `body` et `notifiedAt`
 * inchangés inviterait l'écran à les réécrire depuis une réponse qui ne les
 * décide pas. `pinnedAt` dit l'état ET depuis quand, ce qui est tout ce que le
 * bouton a besoin de savoir pour changer de libellé.
 */
export const updateAnnouncementResponseSchema = z
  .object({ id: uuidSchema, pinnedAt: z.string().datetime().nullable() })
  .strict();

export type UpdateAnnouncementResponse = z.infer<typeof updateAnnouncementResponseSchema>;

/**
 * Une option de sondage. `voteCount` est `null` TANT QUE LES RÉSULTATS SONT
 * CACHÉS — il n'est pas à zéro, il est absent de l'information.
 *
 * C'est une garde, pas une commodité : « résultats visibles après vote ou
 * clôture » (§2.3), et le service RETIRE les compteurs de la réponse plutôt que
 * de demander au front de ne pas les afficher — les laisser dans la réponse HTTP
 * reviendrait à les publier. L'écran ne doit donc jamais écrire `?? 0`.
 */
/**
 * UN VOTANT NOMMÉ — seulement sur un sondage NON anonyme, et seulement quand les
 * résultats sont visibles.
 *
 * Les noms ne sortent pas « parce que le sondage n'est pas anonyme » : ils sortent
 * quand les RÉSULTATS sortent. Un sondage non anonyme dont les résultats sont
 * encore masqués ne nomme personne — sinon le réglage d'anonymat contournerait
 * celui des résultats, et on saurait qui a voté quoi avant d'avoir le droit de
 * savoir combien.
 */
export const pollVoterSchema = z
  .object({ id: uuidSchema, handle: z.string(), displayName: z.string() })
  .strict();

export const pollOptionSchema = z
  .object({
    id: uuidSchema,
    label: z.string(),
    position: z.number().int(),
    voteCount: z.number().int().nullable(),
    /**
     * LES VOTANTS DE CETTE OPTION — vide sauf sur un sondage non anonyme dont les
     * résultats sont visibles.
     *
     * Un TABLEAU VIDE et non `null` : l'absence de noms n'est pas une inconnue,
     * c'est un fait — personne n'est nommé. `voteCount`, lui, est `null` quand on
     * n'a pas le droit de connaître le compte, ce qui est une inconnue. Les deux
     * situations sont différentes et le schéma les distingue.
     */
    voters: z.array(pollVoterSchema),
  })
  .strict();

const pollFields = {
  id: uuidSchema,
  question: z.string(),
  isMultiple: z.boolean(),
  /** Vrai = les comptes restent masqués tant qu'on n'a pas voté (§2.3). */
  resultsAfterVote: z.boolean(),
  /** Vrai = seuls les totaux sortent ; faux = les options nomment leurs votants. */
  isAnonymous: z.boolean(),
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

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LE MÊME SONDAGE, PORTÉ PAR UNE PUBLICATION DU FIL                        ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur voulait le sondage du composeur du fil. Le mécanisme existait
 * ENTIER ici — 2 à 8 options, vote modifiable, résultats masqués avant vote,
 * clôture — et seule la base refusait le rattachement : `polls.community_id`
 * était obligatoire. Il est devenu facultatif, exclusif de `post_id`.
 *
 * CE SCHÉMA EST `pollFields` TEL QUEL, et c'est le point : un second schéma
 * aurait dupliqué neuf champs et quatre règles, et la copie aurait divergé. Il
 * existe sous son propre nom parce que `04-fil` ne doit pas importer le schéma
 * d'un sondage de RÉSEAU pour décrire celui d'une publication — les deux se
 * ressemblent aujourd'hui, et le jour où l'un gagne un champ, l'autre doit
 * pouvoir ne pas le gagner.
 */
export const postPollSchema = z.object(pollFields).strict();

export type PostPoll = z.infer<typeof postPollSchema>;

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
/**
 * ── `communityId` EST DEVENU NULLABLE, ET IL FALLAIT LE DIRE ICI ────────────
 *
 * Un sondage appartient désormais à un RÉSEAU ou à une PUBLICATION du fil (voir
 * `postPollSchema`). `POST /polls/:id/vote` sert les deux — c'est la même route,
 * le même modèle, le même vote — donc sa réponse rend `null` pour un sondage de
 * publication. Garder `uuidSchema` ferait échouer la validation sur un vote
 * PARFAITEMENT RÉUSSI, et `.strict()` est ce qui rend ce genre d'écart visible
 * au lieu de le laisser passer.
 */
export const pollDetailResponseSchema = z
  .object({ ...pollFields, communityId: uuidSchema.nullable() })
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

// ══ LA FILE DE SIGNALEMENTS D'UN RÉSEAU (§2.4) ══════════════════════════════
//
// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║ LE LIEN ENTRE UN SIGNALEMENT ET UN RÉSEAU N'EXISTE PAS EN COLONNE        ║
// ╚═══════════════════════════════════════════════════════════════════════════╝
//
// MESURÉ avant d'écrire une ligne : `reports` (13 §…, `13-moderation.prisma`)
// porte `reporter_user_id`, `subject_type`, `subject_id`, `reason`, `details`,
// `status`, `case_id` — et AUCUN `community_id`. `ReportSubjectType` nomme douze
// sujets (POST, COMMENT, TOPIC, GUIDE, HELP_REQUEST, HELP_RESPONSE, HOUSING,
// JOB, PRO, EVENT, MESSAGE, USER) ; aucun n'est « réseau ».
//
// LE LIEN EXISTE DONC, MAIS EN DÉRIVATION, et c'est ce qui a été retenu plutôt
// que d'ajouter une colonne :
//
//   · `POST`    → `posts.community_id` (nullable : null = fil global) ;
//   · `TOPIC`   → `topics.community_id` (NON nullable : un sujet est toujours
//                 dans un réseau) ;
//   · `COMMENT` → `comments.subject_type`/`subject_id` remonte au POST ou au
//                 TOPIC, puis la règle ci-dessus. `comments` n'a pas non plus de
//                 `community_id`, et une réponse de sujet est un commentaire de
//                 sujet (§2.3 : « Réponses via `comments` (subject TOPIC) »).
//
// LES NEUF AUTRES GENRES NE SONT JAMAIS DANS UN RÉSEAU et sont donc absents de
// cette file — pas filtrés par prudence, absents par construction : un guide,
// un logement ou un compte n'appartiennent à aucun réseau, et §2.4 borne le
// pouvoir d'un modérateur bénévole au CONTENU DE SON RÉSEAU.
//
// ⚠ POURQUOI PAS UNE COLONNE `reports.community_id` : elle serait écrite par le
// module 13 au moment du signalement, donc FIGÉE — et un post déplacé vers un
// sujet (`post.moved_to_topic`, §6) ou un sujet fusionné changerait de réseau
// sans que la colonne suive. La dérivation, elle, dit toujours où le contenu est
// AUJOURD'HUI, ce qui est la seule question que pose un modérateur. Le coût est
// une jointure par genre ; il est payé à la lecture d'une file de quelques
// lignes. REMONTÉ au porteur : si la file devenait longue, une vue matérialisée
// serait le bon lot, pas une colonne.

/**
 * ⚠ LA LIMITE DE POUVOIR D'UN MODÉRATEUR DE RÉSEAU EST UN ENUM À DEUX VALEURS.
 *
 * §2.4 : « Ils ne peuvent pas suspendre un compte — ils SIGNALENT à l'équipe. »
 * `ModerationResolution` porte aussi `REMOVE`, `WARN` et `SUSPEND` ; aucun des
 * trois n'a sa place ici. Un modérateur bénévole agit sur du CONTENU, jamais sur
 * un compte, et c'est `communityReportDecisionSchema` ci-dessous — deux valeurs,
 * `HIDE` et `KEEP` — qui tient cette frontière. Ce n'est pas une simplification
 * de l'API : c'est la garde elle-même.
 *
 *   · `HIDE`  — « Masquer » : le contenu signalé disparaît du réseau ;
 *   · `KEEP`  — « Conserver » : les signalements sont clos sans suite.
 *
 * Les deux mots sont ceux de `ModerationResolution` (`HIDE`, `KEEP`), et c'est
 * volontaire : le dossier d'équipe qui regroupe ces signalements emploie déjà ce
 * vocabulaire, et deux tables de mots pour la même décision divergeraient.
 */

/**
 * `GET /communities/:id/reports` — UNE LIGNE PAR CONTENU SIGNALÉ, pas par
 * signalement.
 *
 * ── C'EST LE DESSIN QUI L'IMPOSE, ET IL A RAISON ──────────────────────────
 *
 * La planche « Gérer » écrit, sur UNE rangée : « Publication de Joël K. ·
 * « Vends attestation d’hébergement » » puis « Demande d’argent · 5
 * signalements · transmis à la modération de la plateforme ». Cinq
 * signalements, UNE rangée, UNE paire « Masquer » / « Conserver ».
 *
 * Une ligne par signalement aurait affiché cinq rangées identiques pour la même
 * publication, avec cinq paires de boutons dont le premier clic aurait rendu les
 * quatre autres sans objet. Le regroupement n'est donc pas une optimisation :
 * c'est la seule forme qui corresponde à la décision qu'on prend, qui porte sur
 * un CONTENU et pas sur l'acte d'un signaleur.
 *
 * ⚠ CONSÉQUENCE SUR L'IDENTITÉ DE LA LIGNE : elle est désignée par
 * `subjectType` + `subjectId`, et il n'y a PAS de champ `id`. Servir
 * l'identifiant d'un des cinq signalements serait un piège — l'écran le
 * prendrait pour la cible de la décision, alors que la décision clôt les cinq.
 *
 * ── CE QUI N'Y EST PAS, ET POURQUOI ──────────────────────────────────────
 *
 * ⚠ AUCUN SIGNALEUR. 13 §… : le signaleur n'est jamais révélé — ni à l'auteur,
 * ni à un modérateur bénévole. `count` dit COMBIEN ils sont ; rien ne dit qui.
 *
 * ⚠ AUCUN `details`. C'est du texte libre écrit par un membre sur un autre,
 * purgé à 90 jours (`purgeOldReportDetails`). L'équipe le lit dans le dossier ;
 * choisir entre masquer et conserver n'en a pas besoin, et le servir ferait
 * voyager une accusation nominale de plus vers un modérateur bénévole.
 */
export const communityReportSchema = z
  .object({
    /** Les trois seuls genres qui puissent appartenir à un réseau. */
    subjectType: z.enum(['POST', 'COMMENT', 'TOPIC']),
    subjectId: uuidSchema,
    /**
     * Le motif du signalement le PLUS RÉCENT du groupe.
     *
     * Choisi comme tel plutôt qu'en liste : la rangée dessine UN motif, et les
     * cinq signalements d'un même contenu portent presque toujours le même. Le
     * plus récent plutôt que le premier parce que c'est celui qui a fait
     * remonter la rangée dans la file, donc celui que le modérateur vient de
     * voir arriver.
     */
    reason: z.string(),
    /** Combien de membres ont signalé CE contenu. Jamais qui. */
    count: z.number().int(),
    /** L'auteur du CONTENU signalé — nul si le contenu a perdu son auteur. */
    author: communityAuthorSchema.nullable(),
    /** Les 160 premiers caractères du contenu, ou le titre d'un sujet. */
    extrait: z.string(),
    /**
     * Le contenu est-il DÉJÀ masqué ?
     *
     * La planche ne le dessine pas, et il est servi quand même : sans lui, un
     * modérateur appuierait sur « Masquer » un contenu que l'équipe a déjà
     * masqué, sans savoir qu'il ne change rien.
     */
    hidden: z.boolean(),
    /**
     * `true` quand un dossier d'équipe est OUVERT sur ce contenu — c'est la
     * phrase « transmis à la modération de la plateforme » que la planche écrit
     * sous la première rangée et pas sous la seconde. Les deux rangées de la
     * maquette montrent donc les deux valeurs : ce n'est pas une décoration.
     */
    escalated: z.boolean(),
    /** Le signalement le plus RÉCENT du groupe — « il y a 4 h » sur la planche. */
    lastReportedAt: z.string().datetime(),
  })
  .strict();

export type CommunityReport = z.infer<typeof communityReportSchema>;

/**
 * `GET /communities/:id/reports`.
 *
 * ⚠ `meta.open` EST LE NOMBRE QUE LA PLANCHE AFFICHE TROIS FOIS — « SIGNALEMENTS
 * · 2 », la tuile « 2 / signalements ouverts » et la pastille « Signalements
 * · 2 » du rail — et c'est la raison pour laquelle cette route porte un `meta`
 * là où `GET /communities/:id/members` n'en a pas. Le défaut déjà payé sur cette
 * maquette est exactement celui-là : un compte déduit de `items.length` sur une
 * page tronquée est une affirmation FAUSSE affichée comme un compte. Ici le
 * serveur le compte, donc l'écran n'a rien à déduire.
 *
 * `nextCursor` vaut TOUJOURS `null` : le service rend les cinquante premières
 * rangées et ne pagine pas — le regroupement par contenu se fait en SQL, et un
 * curseur sur une agrégation demanderait une clé de tri stable qu'aucune colonne
 * ne porte. REMONTÉ : au-delà de cinquante contenus signalés en attente, c'est
 * un réseau que l'équipe doit regarder, pas son propriétaire.
 */
export const communityReportsResponseSchema = pageSchema(communityReportSchema).extend({
  meta: z.object({ open: z.number().int() }).strict(),
});

export type CommunityReportsResponse = z.infer<typeof communityReportsResponseSchema>;

/**
 * `POST /communities/:id/reports/decide` — la cible ET la décision dans le corps.
 *
 * ── POURQUOI LA CIBLE N'EST PAS DANS L'URL ───────────────────────────────
 *
 * Parce qu'elle est à DEUX morceaux. `reports` n'a pas de clé unique par
 * contenu — son unique est `(reporter, subject_type, subject_id)` — et la
 * décision porte sur le COUPLE `(subjectType, subjectId)`, pas sur un
 * signalement. Un `/reports/:id/decide` aurait désigné un des cinq signalements
 * pour une décision qui clôt les cinq, et le prochain lecteur aurait cru que
 * l'un d'eux était traité et les autres non.
 */
export const communityReportDecisionSchema = z
  .object({
    subjectType: z.enum(['POST', 'COMMENT', 'TOPIC']),
    subjectId: uuidSchema,
    decision: z.enum(['HIDE', 'KEEP']),
  })
  .strict();

export type CommunityReportDecision = z.infer<typeof communityReportDecisionSchema>;

/** `POST /communities/:id/reports/decide` — ce que la décision rend. */
export const communityReportDecisionResponseSchema = z
  .object({
    subjectType: z.enum(['POST', 'COMMENT', 'TOPIC']),
    subjectId: uuidSchema,
    decision: z.enum(['HIDE', 'KEEP']),
    /** Combien de signalements la décision a clos. */
    closed: z.number().int(),
    /** Le contenu est-il masqué APRÈS la décision ? Inchangé sur « Conserver ». */
    hidden: z.boolean(),
  })
  .strict();

export type CommunityReportDecisionResponse = z.infer<typeof communityReportDecisionResponseSchema>;

// ── §2.4 — LES PUBLICATIONS QUI ATTENDENT LA VALIDATION D'UN MODÉRATEUR ─────

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ « VALIDATION DES NOUVELLES PUBLICATIONS » — L'INTERRUPTEUR APPLIQUÉ        ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * La planche « Gérer » écrit : « Les publications des nouveaux membres passent
 * par un modérateur. » « NOUVEAU » EST DÉFINI ICI, et c'est un arbitrage remonté :
 * un membre ordinaire dont AUCUNE publication n'a encore été validée dans ce
 * réseau. Sa première publication attend ; dès qu'un modérateur en valide une,
 * il est tenu pour connu et publie directement. C'est la seule définition qui ne
 * demande ni un délai arbitraire, ni une seconde colonne d'« ancienneté ».
 *
 * L'équipe (propriétaire, modérateurs) n'attend jamais.
 */
export const pendingPostSchema = z
  .object({
    postId: uuidSchema,
    type: z.string(),
    body: z.string(),
    createdAt: z.string().datetime(),
    author: z
      .object({
        userId: uuidSchema,
        handle: z.string(),
        displayName: z.string(),
        avatarUrl: z.string().nullable(),
      })
      .strict(),
  })
  .strict();

export type PendingPost = z.infer<typeof pendingPostSchema>;

export const pendingPostsResponseSchema = pageSchema(pendingPostSchema);

export type PendingPostsResponse = z.infer<typeof pendingPostsResponseSchema>;

export const pendingPostDecisionSchema = z
  .object({ decision: z.enum(['APPROVE', 'REJECT']) })
  .strict();

export type PendingPostDecision = z.infer<typeof pendingPostDecisionSchema>;

export const pendingPostDecisionResponseSchema = z
  .object({
    postId: uuidSchema,
    decision: z.enum(['APPROVE', 'REJECT']),
  })
  .strict();

export type PendingPostDecisionResponse = z.infer<typeof pendingPostDecisionResponseSchema>;
