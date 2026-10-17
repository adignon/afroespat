import { z } from 'zod';
import { ConversationKind } from '../enums/generated.js';
import { cursorQuerySchema, handleSchema, uuidSchema } from './pagination.js';

/**
 * Messagerie — 08-parrainage-messagerie.md §5.
 *
 * « Volontairement minimale » (§1) : trois kinds, pas de groupe libre, pas de
 * recherche. Ce qui reste à valider est donc court, mais deux bornes portent une
 * règle et non un confort :
 *
 *   · 4 000 caractères par message. Au-delà, ce n'est plus un message mais un
 *     document, et le chiffrement au repos deviendrait coûteux à la lecture d'un
 *     fil (§5.3).
 *
 *   · 20 nouvelles conversations par jour et 60 messages par minute (§5.3). La
 *     première borne la PROSPECTION — c'est elle qui rend supportable la règle
 *     « n'importe qui une fois » de §5.2 ; sans elle, un compte peut écrire à
 *     toute une ville. La seconde borne le flood dans une conversation ouverte.
 *
 * Le chiffrement, lui, n'apparaît pas ici : `messages.body_encrypted` est chiffré
 * AU REPOS, pas de bout en bout (00 §8.1) — la modération doit pouvoir lire une
 * conversation signalée. Le corps circule donc en clair sur TLS, et c'est le
 * service qui scelle avec `CryptoService.encryptContent`.
 */

// ── Bornes de §5.3 ──────────────────────────────────────────────────────────

/** §5.3 : « Texte 1–4 000 caractères ». */
export const MESSAGE_BODY_MIN = 1;
export const MESSAGE_BODY_MAX = 4000;

/** §5.3 : « Limite : 60 messages/minute ». */
export const MESSAGES_PER_MINUTE = 60;
export const MESSAGE_RATE_WINDOW_MS = 60_000;

/** §5.3 : « 20 nouvelles conversations/jour ». */
export const NEW_CONVERSATIONS_PER_DAY = 20;
export const NEW_CONVERSATIONS_WINDOW_MS = 86_400_000;

/** §5.3 : repli en polling toutes les 15 s quand le WebSocket ne tient pas. */
export const MESSAGE_POLL_INTERVAL_MS = 15_000;

/** §5.3, suppression logique : ce que le fil affiche à la place du corps. */
export const MESSAGE_DELETED_PLACEHOLDER = 'Message supprimé';

/** §11 : dans les conversations de l'autre, un membre supprimé laisse cette ligne. */
export const MESSAGE_DELETED_USER_PLACEHOLDER = 'Message d’un membre supprimé';

/** Longueur de la dernière ligne renvoyée par `GET /conversations` (§7.3). */
export const CONVERSATION_PREVIEW_MAX = 120;

// ── Codes d'erreur propres à la messagerie (§7.3) ───────────────────────────

export const MESSAGING_ERROR_CODES = {
  /**
   * §5.2 : « premier message = demande de conversation, l'autre accepte ou
   * ignore ; sans réponse, pas de second message ».
   */
  PENDING_CONVERSATION: 409,
  /** §5.3 : 60 messages/minute, 20 nouvelles conversations/jour. */
  MESSAGE_RATE_LIMIT: 429,
  CONVERSATION_LIMIT: 429,
  /** Écrire dans une conversation qu'on a quittée, ou qu'un blocage a fermée. */
  CONVERSATION_CLOSED: 409,
  /**
   * « Contacter les modérateurs » SUR UN RÉSEAU QUI N'EN A AUCUN À JOINDRE.
   *
   * 409 et non 404 : le réseau existe, le demandeur en est membre, et c'est
   * l'ÉTAT du réseau qui empêche le geste — exactement ce qu'un conflit dit.
   * Un 404 ferait croire que le bouton pointe vers une route absente.
   *
   * Deux situations, et toutes deux sont réelles :
   *
   *   · un réseau AUTOMATIQUE de ville ou de pays n'a PAS de propriétaire
   *     (07 §2.1 : « pas de créateur ; modérateurs = bénévoles nommés par
   *     l'équipe ») et peut n'avoir encore reçu aucun bénévole. Il n'y a alors
   *     personne à qui écrire, et c'est `POST /reports` — qui va à l'équipe de
   *     la PLATEFORME — qui est le bon chemin ;
   *   · le demandeur EST le seul de l'équipe. Ouvrir un fil où il serait seul
   *     lui donnerait un carnet de notes déguisé en conversation.
   *
   * Le `details.reason` distingue les deux, pour que l'écran puisse proposer le
   * signalement dans le premier cas et se taire dans le second.
   */
  NO_MODERATORS_TO_CONTACT: 409,
} as const;

export type MessagingErrorCode = keyof typeof MESSAGING_ERROR_CODES;

export const MESSAGING_ERROR_MESSAGES: Record<MessagingErrorCode, string> = {
  PENDING_CONVERSATION:
    'Votre premier message attend une réponse. Vous pourrez écrire de nouveau quand ce membre aura répondu.',
  MESSAGE_RATE_LIMIT: 'Vous envoyez trop de messages. Patientez un instant.',
  CONVERSATION_LIMIT: 'Vous avez ouvert trop de nouvelles conversations aujourd’hui.',
  CONVERSATION_CLOSED: 'Cette conversation est fermée.',
  NO_MODERATORS_TO_CONTACT:
    'Ce réseau n’a aucun modérateur à contacter pour le moment. Pour un contenu ou un comportement qui pose problème, employez « Signaler ».',
};

// ── Écriture ────────────────────────────────────────────────────────────────

/**
 * `POST /conversations/direct` (§7.3). Le premier message EST la demande (§5.2).
 *
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ `mediaId` SUR LE PREMIER MESSAGE — ET C'EST §5.2 QUI L'EXIGE AINSI         ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « quand on envoie un message dans le contexte d'une story, il
 * faudrait que la story soit capturée comme une image et ajoutée au message juste
 * un peu sous le message ».
 *
 * LE RÉFLEXE — envoyer le texte, puis un second message portant l'image — EST
 * REFUSÉ PAR LE SERVEUR, et c'est une règle dure, pas un accident :
 * `sendMessage` répond `409 PENDING_CONVERSATION` quand la conversation est en
 * attente et que c'est l'initiateur qui écrit (§5.2, « votre premier message
 * attend une réponse »). Or écrire à l'auteur d'une story, c'est précisément le
 * cas froid : la conversation naît EN ATTENTE. Le second message serait donc
 * refusé une fois sur deux — exactement quand il s'agit d'un inconnu, c'est-à-dire
 * le cas pour lequel la capture sert le plus.
 *
 * L'image voyage donc AVEC le premier message. `sendMessageSchema` portait déjà
 * `mediaId` ; cette route l'ignorait, et c'était le seul endroit du module où une
 * image ne pouvait pas accompagner un texte.
 */
export const createDirectConversationSchema = z
  .object({
    toHandle: handleSchema,
    firstMessage: z.string().trim().min(MESSAGE_BODY_MIN).max(MESSAGE_BODY_MAX),
    /** Une image facultative, déjà passée par le pipeline média (§5.3, §8.3). */
    mediaId: uuidSchema.optional(),
    /** La story d'où part ce premier message — voir `sendMessageSchema.storyId`. */
    storyId: uuidSchema.optional(),
  })
  .strict();

export type CreateDirectConversation = z.infer<typeof createDirectConversationSchema>;

/**
 * LA RÉPONSE DE `POST /conversations/direct` — relevée sur `messaging.service.ts`
 * (`openDirect`), et partagée pour qu'il n'y en ait plus deux lectures.
 *
 * Elle n'est PAS une `conversationSchema` : la route ne rend que les deux
 * identifiants créés et `pending` (le premier message est une DEMANDE tant que la
 * relation est froide, §5.2). Le profil la lisait comme une conversation entière ;
 * le schéma refusait donc une réponse valide, le message partait quand même, et
 * l'écran affichait « Le message n'a pas pu partir. » — chaque nouvel essai
 * envoyait un message de plus.
 */
export const openDirectConversationResponseSchema = z
  .object({
    conversationId: uuidSchema,
    messageId: uuidSchema,
    pending: z.boolean(),
  })
  .strict();

export type OpenDirectConversationResponse = z.infer<typeof openDirectConversationResponseSchema>;

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ « CONTACTER LES MODÉRATEURS » — ET CE N'EST PAS UN SIGNALEMENT             ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * `POST /communities/:id/moderators-conversation` ouvre — ou ROUVRE — le fil de
 * groupe entre un membre et l'équipe de SON réseau : le propriétaire et les
 * modérateurs actifs, plus le demandeur.
 *
 * ── LA DISTINCTION À NE JAMAIS PERDRE ─────────────────────────────────────
 *
 * `POST /reports` (13-moderation §8.1) existe déjà et va À L'ÉQUIPE DE LA
 * PLATEFORME : il ouvre un `moderation_case`, il est tracé, il peut aboutir à
 * une suspension de compte, et il exige `report.create` (L2). Ceci va aux
 * BÉNÉVOLES D'UN SEUL RÉSEAU, n'ouvre aucun dossier, ne confère aucun pouvoir de
 * sanction, et se contente de `content.read` (L0) — parce que demander une règle
 * à l'équipe de son réseau de ville ne doit rien exiger. Les confondre
 * donnerait à une question de voisinage le poids d'une procédure, et
 * inversement : un vrai abus finirait dans un fil que trois bénévoles peuvent
 * lire au lieu d'arriver chez ceux qui peuvent agir.
 *
 * ── CE QUE LE PORTEUR A TRANCHÉ ───────────────────────────────────────────
 *
 * Entre un message au propriétaire SEUL — livrable tout de suite, sans toucher à
 * la messagerie — et une conversation de GROUPE avec le propriétaire et les
 * modérateurs : « fais le bon ». Donc le groupe, pour une réponse collective et
 * traçable qui ne dépend pas de la disponibilité d'une seule personne.
 *
 * ── AUCUN CORPS DE REQUÊTE, ET C'EST UN ÉCART ASSUMÉ ──────────────────────
 *
 * `POST /conversations/direct` exige un `firstMessage` : §5.2 fait du premier
 * message la DEMANDE elle-même, et une conversation directe vide n'existe pas.
 * Ici la maquette ne dessine AUCUN formulaire — un bouton, rien d'autre — et on
 * ne lui en invente pas un. Le fil naît donc VIDE, comme naît une conversation
 * JOURNEY (§5.1, « à la création du parcours »), et le membre écrit dedans par
 * `POST /conversations/:id/messages`. Le front n'a donc rien à envoyer : la
 * route ne porte pas de schéma de requête, seulement cette réponse.
 */
export const moderatorsConversationResponseSchema = z
  .object({
    /** Le fil à ouvrir : `/messages/<conversationId>`. */
    conversationId: uuidSchema,
    /**
     * Vrai à la PREMIÈRE ouverture, faux quand on rouvre la sienne.
     *
     * L'IDEMPOTENCE EST OBSERVABLE, et c'est pour cela que ce champ existe : un
     * second clic rend le MÊME `conversationId` avec `created: false`. Sans ce
     * drapeau l'écran ne pourrait pas distinguer « votre demande est partie » de
     * « vous reprenez une conversation en cours », et il dirait donc l'un des
     * deux à tort.
     */
    created: z.boolean(),
    /**
     * Combien de personnes de l'équipe liront : propriétaire et modérateurs
     * actifs, le demandeur NON COMPRIS. Toujours au moins 1 — à zéro la route
     * refuse par `NO_MODERATORS_TO_CONTACT`.
     *
     * Ce n'est pas une fuite : la liste de l'équipe est déjà lisible de tout
     * membre par `GET /communities/:id/members?role=MODERATOR`, et la carte
     * « ÉQUIPE » de la planche « À propos » la dessine nommément.
     */
    recipients: z.number().int().positive(),
  })
  .strict();

export type ModeratorsConversationResponse = z.infer<
  typeof moderatorsConversationResponseSchema
>;

/** `POST /conversations/:id/messages` (§7.3). */
/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ UN MESSAGE PEUT N'ÊTRE QU'UNE IMAGE — LA BORNE A ÉTÉ DESSERRÉE            ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « il faut permettre plusieurs images ensuite tu le mets dans
 * l'input comme on a fait avec l'input de publication de la file d'actualité ».
 *
 * CE QUE LA BORNE INTERDISAIT. `body` exigeait au moins un caractère, et la
 * route ne porte qu'UNE image (`mediaId`, au singulier). Plusieurs images, c'est
 * donc plusieurs messages — comme Messenger, où chaque photo est sa propre
 * bulle — et chacun aurait eu besoin d'un texte. On aurait demandé au membre
 * d'écrire quatre phrases pour envoyer quatre photos, ou inventé un corps à sa
 * place, ce qui est pire.
 *
 * LA RÈGLE DEVIENT « AU MOINS L'UN DES DEUX », et elle reste une règle : un
 * message entièrement vide est toujours refusé. `superRefine` le dit sur `body`,
 * pour que l'erreur désigne le champ que le membre peut corriger.
 *
 * ⚠ ARBITRAGE : §7.3 résume la route par « 1 à 4 000 caractères, image
 * facultative ». La borne haute ne bouge pas ; la borne BASSE devient
 * conditionnelle. Remonté au porteur, qui l'a demandé en demandant les images
 * multiples.
 */
export const sendMessageSchema = z
  .object({
    body: z.string().trim().max(MESSAGE_BODY_MAX).optional(),
    /** Une image facultative, déjà passée par le pipeline média (§5.3). */
    mediaId: uuidSchema.optional(),
    /**
     * LA STORY D'OÙ LE MESSAGE PART, quand il part de l'écran de lecture.
     *
     * Le porteur : « Il faut qu'on puisse cliquer sur [la vignette] et aller vers
     * la story si toujours en ligne. Sinon ça affirme que la story a expiré. »
     *
     * La vignette jointe est une CAPTURE, c'est-à-dire un média autonome qui
     * survit à la story. Elle ne ramène donc à rien par elle-même : il faut dire
     * CE QU'ELLE MONTRE. Facultatif, parce qu'une image jointe à la main dans une
     * conversation ne vient d'aucune story.
     */
    storyId: uuidSchema.optional(),
  })
  .strict()
  .superRefine((valeur, ctx) => {
    const corps = valeur.body ?? '';
    if (corps.length >= MESSAGE_BODY_MIN || valeur.mediaId !== undefined) return;
    ctx.addIssue({
      code: 'custom',
      path: ['body'],
      message: 'Un message doit porter un texte ou une image.',
    });
  });

export type SendMessage = z.infer<typeof sendMessageSchema>;

/** `GET /conversations` et `GET /conversations/:id/messages` (§7.3). */
export const conversationsQuerySchema = cursorQuerySchema;
export const messagesQuerySchema = cursorQuerySchema;

export type ConversationsQuery = z.infer<typeof conversationsQuerySchema>;
export type MessagesQuery = z.infer<typeof messagesQuerySchema>;

/**
 * Les kinds de message de §6 (`messages.kind`, colonne « Ajoutée »).
 *
 * La colonne N'EXISTE PAS dans le schéma figé — ni dans `packages/db/prisma/schema`
 * ni en base. Le kind est donc DÉDUIT : `IMAGE` quand `media_asset_id` est
 * renseigné, `TEXT` sinon. `SYSTEM` (« Sandra a rejoint le parcours ») n'est pas
 * représentable et aucune route n'en produit — un message système écrit
 * aujourd'hui serait indistinguable d'un message écrit par le membre.
 */
export const MESSAGE_KINDS = ['TEXT', 'IMAGE', 'SYSTEM'] as const;

export type MessageKind = (typeof MESSAGE_KINDS)[number];

// ── Lecture : les réponses, décrites là où vit déjà la requête ───────────────

/**
 * ─── CE QUE CES DEUX SCHÉMAS TIENNENT, ET POURQUOI ILS SONT `.strict()` ──────
 *
 * LA RÈGLE LA PLUS GRAVE DE CE MODULE : le corps des messages est chiffré. Mais il
 * l'est AU REPOS, pas de bout en bout (00 §8.1) — l'en-tête de ce fichier le dit
 * déjà, et la modération doit pouvoir lire une conversation signalée. Le service
 * descelle donc avant de répondre, en UN SEUL endroit
 * (`MessagingService.bodyOf`), et ce qui circule sur le fil est du TEXTE CLAIR :
 *
 *   · `GET /conversations` → `lastMessagePreview`, le corps déscellé puis coupé à
 *     `CONVERSATION_PREVIEW_MAX` ; `null` quand la conversation est vide ou quand
 *     l'auteur est séparé du lecteur (§4) ;
 *   · `GET /conversations/:id/messages` → `body`, le corps déscellé ; `null` quand
 *     il est masqué, ou l'un des deux substituts de suppression ci-dessus.
 *
 * VÉRIFIÉ SUR LE SERVICE, pas supposé : aucune route de ce dépôt ne rend de
 * cryptogramme. Le `bytea` ne sort pas du serveur, et l'écran n'a donc RIEN à
 * déchiffrer — lui en donner les moyens serait ajouter une clé au front.
 *
 * D'OÙ LE `.strict()`, qui est la part exécutable de la règle. Sans lui, zod
 * DÉPOUILLE EN SILENCE : le jour où la réponse porterait un `bodyEncrypted`, un
 * `bodyCipher` ou un `lastMessageBody` non coupé, les octets auraient déjà quitté
 * le serveur, traversé le réseau et atteint le navigateur — et rien, nulle part,
 * ne l'aurait dit. Avec lui, la réponse est REFUSÉE à la frontière, sur l'appel,
 * en nommant le champ de trop. Un champ greffé sur une forme de messagerie est une
 * FUITE, jamais un enrichissement : c'est ce que ce modificateur affirme.
 *
 * Il n'existe aucun intercepteur de validation de réponse côté API — compté :
 * zéro `APP_INTERCEPTOR` dans `app.module.ts`. Ces schémas ne sont donc pas de la
 * documentation : ils sont le SEUL endroit où la forme de la réponse est vérifiée,
 * et cet endroit est la frontière du front.
 */

/**
 * Un autre membre de la conversation, tel que `MEMBER_SELECT` le rend.
 *
 * `hidden` est l'effet de LECTURE du §4 : dans une conversation de groupe commune,
 * un blocage laisse les deux membres en place et masque leurs contenus
 * mutuellement. L'écran l'affiche ; il ne le recalcule pas — il n'a pas la liste
 * des séparations, et il ne doit pas l'avoir.
 */
export const conversationMemberSchema = z
  .object({
    userId: uuidSchema,
    handle: handleSchema,
    displayName: z.string(),
    /**
     * Chemin RELATIF (`/media/…`), ou `null` — jamais une URL signée.
     *
     * Rendait la clé de STOCKAGE nue jusqu'à ce lot, seul endroit du dépôt à le
     * faire : le front l'aurait résolue contre l'API en `/v1/<clé>`, qui ne sert
     * rien. Aligné sur `memberSummarySchema.avatarUrl` et sur les cinq autres
     * routes qui rendent un média.
     */
    avatarUrl: z.string().nullable(),
    hidden: z.boolean(),
    /** Non nul quand ce membre a quitté la conversation. */
    leftAt: z.string().datetime().nullable(),
  })
  .strict();

/**
 * Une conversation de `GET /conversations` (§7.3).
 *
 * `title` est renseigné pour les deux conversations que le serveur sait NOMMER :
 * celle de PARCOURS (§8, « nommée par le titre du parcours ») et celle de
 * MODÉRATION D'UN RÉSEAU, nommée par le nom du réseau. Pour une conversation
 * directe il rend `null`, et c'est au front de la nommer par son interlocuteur —
 * ce que la maquette M01 dessine d'ailleurs (« Sandra M. », « Kofi Boateng »).
 *
 * LE NOM DU RÉSEAU SEUL, SANS MOT AJOUTÉ. « Modération · Béninois en France »
 * serait plus clair et serait du TEXTE D'INTERFACE INVENTÉ : ce fichier note
 * déjà qu'aucune table du dépôt ne donne le mot français d'un `kind`, et qu'en
 * fabriquer un a été signalé au porteur plutôt que deviné. La règle du §8 est
 * reprise telle quelle — une conversation de groupe porte le nom de l'objet
 * qu'elle sert.
 *
 * `pendingForMe` et `awaitingReply` sont les DEUX FACES du §5.2 (« premier message
 * = demande de conversation »), et le serveur les dérive tous les deux. L'écran ne
 * les recalcule pas : il n'a ni l'auteur du premier message ni l'état d'acceptation.
 */
export const conversationSchema = z
  .object({
    id: uuidSchema,
    kind: z.enum(ConversationKind),
    title: z.string().nullable(),
    /** Les AUTRES membres : le service retire déjà le lecteur de la liste. */
    members: z.array(conversationMemberSchema),
    lastMessageAt: z.string().datetime().nullable(),
    /**
     * La dernière ligne, EN CLAIR et coupée à `CONVERSATION_PREVIEW_MAX` par le
     * serveur. `null` = rien à montrer ; ce n'est pas une panne, et l'écran doit
     * laisser la place vide plutôt que d'y mettre un substitut de son invention.
     */
    lastMessagePreview: z.string().max(CONVERSATION_PREVIEW_MAX).nullable(),
    unreadCount: z.number().int().nonnegative(),
    /**
     * LA SOURDINE DE CETTE CONVERSATION, pour MOI.
     *
     * `conversation_members.is_muted` existait dans le schéma figé depuis le
     * début et aucune route ne la lisait : l'entrée « Mettre en sourdine » du
     * menu de conversation était un décor. Elle est par MEMBRE, pas par
     * conversation — mettre en sourdine est un choix personnel.
     */
    muted: z.boolean(),
    pendingForMe: z.boolean(),
    awaitingReply: z.boolean(),
  })
  .strict();

export type Conversation = z.infer<typeof conversationSchema>;

/**
 * `GET /conversations` — l'enveloppe, `meta.unreadTotal` compris.
 *
 * `meta` est RESSERRÉ ici plutôt que laissé libre : c'est ce que l'en-tête de
 * `pageSchema` demande au module qui en dépend. `unreadTotal` est la somme des
 * non-lus de la page, et c'est elle que la cloche de la barre haute affiche.
 */
export const conversationsResponseSchema = z.object({
  items: z.array(conversationSchema),
  nextCursor: z.string().nullable(),
  meta: z.object({ unreadTotal: z.number().int().nonnegative() }).strict(),
});

export type ConversationsResponse = z.infer<typeof conversationsResponseSchema>;

/**
 * Un message de `GET /conversations/:id/messages` (§7.3).
 *
 * `body` EST LE CORPS DÉSCELLÉ — voir le commentaire de bloc ci-dessus. Trois
 * valeurs non textuelles sont possibles, et toutes trois viennent du serveur :
 * `null` quand l'auteur est séparé du lecteur, `MESSAGE_DELETED_PLACEHOLDER`
 * quand le message est supprimé logiquement, et `MESSAGE_DELETED_USER_PLACEHOLDER`
 * quand c'est son auteur qui l'est (§11). L'écran les affiche tels quels : les
 * deux substituts sont des textes de produit, déjà écrits en tête de ce fichier.
 *
 * `kind` est DÉDUIT par le serveur (`IMAGE` si `mediaAssetId`, `TEXT` sinon) : la
 * colonne de §6 n'existe pas, et l'en-tête de `MESSAGE_KINDS` l'explique. `SYSTEM`
 * n'est donc jamais rendu — ce qui est à retenir pour l'écran M01, dont la maquette
 * dessine pourtant une ligne système (« Aïcha a rejoint le parcours »).
 */
export const messageSchema = z
  .object({
    id: uuidSchema,
    senderUserId: uuidSchema,
    senderHandle: handleSchema,
    kind: z.enum(MESSAGE_KINDS),
    body: z.string().nullable(),
    mediaId: uuidSchema.nullable(),
    /**
     * ╔══════════════════════════════════════════════════════════════════════╗
     * ║ L'ADRESSE DE L'IMAGE — SANS ELLE, `mediaId` NE SERVAIT À RIEN        ║
     * ╚══════════════════════════════════════════════════════════════════════╝
     *
     * `screens/m01/data.ts` l'avait consigné comme l'un de ses quatre manques :
     * « la vignette d'image — `kind: 'IMAGE'` et `mediaId` arrivent bien, mais
     * AUCUNE route de ce lot ne résout un média en URL ». La maquette dessine
     * pourtant la vignette, et le module acceptait déjà `mediaId` à l'écriture :
     * une image envoyée partait en base et n'était JAMAIS montrée.
     *
     * L'adresse est `/media/<clé de stockage>`, composée par le serveur comme
     * `feed.service.ts`, `housing.service.ts` et `users.service.ts` le font déjà.
     * Le front n'a pas accès aux clés de stockage, et il ne doit pas : la clé
     * porte seize octets d'aléa et VAUT l'autorisation de lecture (voir
     * `media.service.ts`, `keyFor`). La composer côté client demanderait de servir
     * les clés en clair à des gens qui n'ont pas le média.
     *
     * `null` quand le message n'en porte pas, et aussi quand le média a été
     * supprimé — la relation est `onDelete: SetNull`, donc `mediaId` tombe avec
     * lui.
     */
    mediaUrl: z.string().nullable(),
    /**
     * ╔══════════════════════════════════════════════════════════════════════╗
     * ║ LA STORY QUE LA VIGNETTE MONTRE, ET SI ELLE VIT ENCORE               ║
     * ╚══════════════════════════════════════════════════════════════════════╝
     *
     * DEUX CHAMPS ET NON UN, parce que l'écran a deux gestes à choisir et qu'un
     * seul ne les distingue pas :
     *
     *   · `storyId` null → la vignette n'est pas une story : une image jointe à la
     *     main. Elle ne mène nulle part, et le cadre la laisse en `<div>` ;
     *   · `storyId` posé, `storyAlive` vrai → la vignette ouvre `/stories/<id>` ;
     *   · `storyId` posé, `storyAlive` faux → « Cette story a expiré ».
     *
     * `storyAlive` EST CALCULÉ PAR LE SERVEUR et jamais déduit d'une date rendue
     * au client : une story vit vingt-quatre heures, l'horloge du navigateur peut
     * être fausse de plusieurs heures, et c'est déjà la règle que `feed.service`
     * applique (`status === 'EXPIRED' || expiresAt <= now`). Le dire ici garde une
     * seule définition de « encore en ligne » pour tout le dépôt.
     *
     * Il vaut FAUX aussi quand la story a été supprimée : la relation est
     * `onDelete: SetNull`, donc `storyId` tombe avec elle et le premier cas
     * s'applique — la vignette redevient une image muette plutôt que de promettre
     * une page qui rendrait 404.
     */
    storyId: uuidSchema.nullable(),
    storyAlive: z.boolean(),
    sentAt: z.string().datetime(),
    deletedAt: z.string().datetime().nullable(),
    /** Vrai quand c'est MOI qui ai écrit : la bulle change de côté et de couleur. */
    mine: z.boolean(),
  })
  .strict();

export type Message = z.infer<typeof messageSchema>;

/**
 * `GET /conversations/:id/messages` — l'enveloppe et ses trois méta.
 *
 * LES MESSAGES ARRIVENT DU PLUS RÉCENT AU PLUS ANCIEN (`orderBy: { id: 'desc' }`,
 * vérifié dans le service) : un fil qui les affiche dans cet ordre les montre à
 * l'envers. C'est à l'appelant de les retourner, et c'est dit ici parce que
 * l'enveloppe ne le laisse pas voir.
 */
export const messagesResponseSchema = z.object({
  items: z.array(messageSchema),
  nextCursor: z.string().nullable(),
  meta: z
    .object({
      kind: z.enum(ConversationKind),
      pendingForMe: z.boolean(),
      awaitingReply: z.boolean(),
    })
    .strict(),
});

export type MessagesResponse = z.infer<typeof messagesResponseSchema>;
