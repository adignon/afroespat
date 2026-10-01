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
} as const;

export type MessagingErrorCode = keyof typeof MESSAGING_ERROR_CODES;

export const MESSAGING_ERROR_MESSAGES: Record<MessagingErrorCode, string> = {
  PENDING_CONVERSATION:
    'Votre premier message attend une réponse. Vous pourrez écrire de nouveau quand ce membre aura répondu.',
  MESSAGE_RATE_LIMIT: 'Vous envoyez trop de messages. Patientez un instant.',
  CONVERSATION_LIMIT: 'Vous avez ouvert trop de nouvelles conversations aujourd’hui.',
  CONVERSATION_CLOSED: 'Cette conversation est fermée.',
};

// ── Écriture ────────────────────────────────────────────────────────────────

/** `POST /conversations/direct` (§7.3). Le premier message EST la demande (§5.2). */
export const createDirectConversationSchema = z
  .object({
    toHandle: handleSchema,
    firstMessage: z.string().trim().min(MESSAGE_BODY_MIN).max(MESSAGE_BODY_MAX),
  })
  .strict();

export type CreateDirectConversation = z.infer<typeof createDirectConversationSchema>;

/** `POST /conversations/:id/messages` (§7.3). */
export const sendMessageSchema = z
  .object({
    body: z.string().trim().min(MESSAGE_BODY_MIN).max(MESSAGE_BODY_MAX),
    /** Une image facultative, déjà passée par le pipeline média (§5.3). */
    mediaId: uuidSchema.optional(),
  })
  .strict();

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
    /** La clé de stockage de l'avatar, ou `null` — jamais une URL signée. */
    avatarUrl: z.string().nullable(),
    hidden: z.boolean(),
    /** Non nul quand ce membre a quitté la conversation. */
    leftAt: z.string().datetime().nullable(),
  })
  .strict();

/**
 * Une conversation de `GET /conversations` (§7.3).
 *
 * `title` n'est renseigné que pour une conversation de PARCOURS (§8, « nommée par
 * le titre du parcours ») : pour une conversation directe le serveur rend `null`,
 * et c'est au front de la nommer par son interlocuteur — ce que la maquette M01
 * dessine d'ailleurs (« Sandra M. », « Kofi Boateng »).
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
