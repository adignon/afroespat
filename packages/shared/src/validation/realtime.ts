import { z } from 'zod';
import { uuidSchema } from './pagination.js';

/**
 * Le vocabulaire du temps réel — 08 §7.3 (`WS /ws`) et T4 §7.
 *
 * DANS `@app/shared` parce que DEUX côtés le lisent : la passerelle de l'API, qui
 * ne doit jamais pousser autre chose, et le client du navigateur, qui doit
 * reconnaître ce qu'il reçoit. Recopier la liste des noms d'événements des deux
 * côtés les ferait diverger au premier ajout, et le symptôme serait un écran qui
 * ne bouge plus sans qu'aucune erreur ne s'affiche.
 *
 * LES CHARGES NE PORTENT JAMAIS DE CONTENU. Un identifiant, un horodatage, un
 * compteur : le client va lire le détail par l'API, qui applique les mêmes
 * contrôles qu'ailleurs (un message poussé avec son corps contournerait le
 * masquage des membres séparés, §4).
 */

/** Ce que la passerelle accepte de pousser. FERMÉ. */
export const REALTIME_EVENTS = [
  'message.new',
  'message.read',
  'conversation.updated',
  'notification.new',
  'conversation.typing',
] as const;
export type RealtimeEventName = (typeof REALTIME_EVENTS)[number];

/** Le nom de l'événement que le CLIENT émet pour dire « je suis en train d'écrire ». */
export const REALTIME_TYPING_CLIENT_EVENT = 'typing';

/**
 * Le client n'émet « frappe en cours » qu'une fois par intervalle, et le serveur
 * en refuse davantage : une frappe ne vaut pas un message, et chaque émission
 * est un aller-retour Redis. Le destinataire éteint l'indicateur de lui-même
 * après `REALTIME_TYPING_TTL_MS` sans nouvelle frappe — rien n'est mémorisé.
 */
export const REALTIME_TYPING_EMIT_INTERVAL_MS = 2_500;
export const REALTIME_TYPING_TTL_MS = 4_000;

export const realtimeMessageNewSchema = z.object({
  conversationId: uuidSchema,
  messageId: uuidSchema,
});

export const realtimeMessageReadSchema = z.object({
  conversationId: uuidSchema,
  readerUserId: uuidSchema,
  readAt: z.string().datetime(),
});

export const realtimeConversationUpdatedSchema = z.object({
  conversationId: uuidSchema,
  /** Pourquoi la liste doit se relire : un message, un accord, une suppression… */
  reason: z.enum(['message', 'accepted', 'deleted', 'read', 'muted']),
});

export const realtimeNotificationNewSchema = z.object({
  notificationId: uuidSchema,
  category: z.string(),
  unread: z.number().int().nonnegative(),
});

export const realtimeTypingSchema = z.object({
  conversationId: uuidSchema,
  userId: uuidSchema,
});

export type RealtimeMessageRead = z.infer<typeof realtimeMessageReadSchema>;
export type RealtimeConversationUpdated = z.infer<typeof realtimeConversationUpdatedSchema>;
export type RealtimeNotificationNew = z.infer<typeof realtimeNotificationNewSchema>;
export type RealtimeTyping = z.infer<typeof realtimeTypingSchema>;
