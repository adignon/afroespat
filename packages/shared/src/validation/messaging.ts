import { z } from 'zod';
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
