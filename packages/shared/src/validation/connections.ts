import { z } from 'zod';
import { cursorQuerySchema, handleSchema } from './pagination.js';

/**
 * Contacts — 08-parrainage-messagerie.md §3.
 *
 * « Un contact naît d'une interaction réelle, pas d'un clic » (commentaire du
 * schéma). Les quatre origines automatiques ou suggérées ne passent donc PAS par
 * ces schémas : elles naissent d'un événement. Seule la demande MANUELLE a un
 * corps de requête, et §3.1 la borne serré — même ville, message de 20 à 500
 * caractères, dix par jour, trois vers le même membre sur trente jours.
 *
 * Ces quatre bornes forment ensemble l'anti-spam du module. Chacune seule se
 * contourne : sans la ville, on démarche toute la plateforme ; sans le message,
 * on automatise ; sans le quota journalier, on démarche toute sa ville ; sans la
 * limite par destinataire, on harcèle une personne. Elles vivent ici pour que
 * l'écran affiche les mêmes nombres que le serveur applique.
 */

// ── Bornes de §3 ────────────────────────────────────────────────────────────

/** §3.1 : « Une demande manuelle expire à 30 jours. » */
export const CONNECTION_REQUEST_EXPIRY_DAYS = 30;
export const CONNECTION_REQUEST_EXPIRY_MS = CONNECTION_REQUEST_EXPIRY_DAYS * 86_400_000;

/** §3.1 : « Pas plus de 10 demandes manuelles envoyées par jour ». */
export const CONNECTION_REQUESTS_PER_DAY = 10;

/** §3.1 : « 3 vers le même membre sur 30 jours ». */
export const CONNECTION_REQUESTS_PER_TARGET = 3;
export const CONNECTION_REQUESTS_PER_TARGET_WINDOW_MS = 30 * 86_400_000;

/** §3.1 : message obligatoire, 20 à 500 caractères. */
export const CONNECTION_MESSAGE_MIN = 20;
export const CONNECTION_MESSAGE_MAX = 500;

/** §3.2 : réseau de 2ᵉ degré « calculé à la requête, mis en cache 1 h ». */
export const MUTUAL_CONNECTIONS_CACHE_MS = 60 * 60 * 1000;

/** §3.2 : le nombre de handles renvoyés avec « Connecté·e à N de vos contacts ». */
export const MUTUAL_CONNECTIONS_SAMPLE = 5;

// ── Codes d'erreur propres aux contacts (§7.2) ───────────────────────────────

export const CONNECTION_ERROR_CODES = {
  SAME_CITY_REQUIRED: 422,
  REQUEST_LIMIT: 429,
  ALREADY_CONNECTED: 409,
  /** Une demande est déjà en attente entre ces deux membres, dans un sens ou l'autre. */
  REQUEST_PENDING: 409,
} as const;

export type ConnectionErrorCode = keyof typeof CONNECTION_ERROR_CODES;

export const CONNECTION_ERROR_MESSAGES: Record<ConnectionErrorCode, string> = {
  SAME_CITY_REQUIRED:
    'Une demande de contact ne peut être adressée qu’à un membre de votre ville ou de votre ville cible.',
  REQUEST_LIMIT: 'Vous avez envoyé trop de demandes de contact. Réessayez demain.',
  ALREADY_CONNECTED: 'Ce membre fait déjà partie de vos contacts.',
  REQUEST_PENDING: 'Une demande de contact est déjà en attente avec ce membre.',
};

// ── Écriture ────────────────────────────────────────────────────────────────

/** `POST /connection-requests` (§7.2). */
export const createConnectionRequestSchema = z
  .object({
    toHandle: handleSchema,
    /** Obligatoire : c'est la moitié de l'anti-spam de §3.1. */
    message: z.string().trim().min(CONNECTION_MESSAGE_MIN).max(CONNECTION_MESSAGE_MAX),
  })
  .strict();

export type CreateConnectionRequest = z.infer<typeof createConnectionRequestSchema>;

/** `GET /me/connections` (§7.2). */
export const connectionsQuerySchema = cursorQuerySchema;

export type ConnectionsQuery = z.infer<typeof connectionsQuerySchema>;

/** `GET /me/connection-requests` : les demandes reçues et envoyées (écran Contacts, §8). */
export const connectionRequestsQuerySchema = z
  .object({
    direction: z.enum(['incoming', 'outgoing']).default('incoming'),
  })
  .strict();

export type ConnectionRequestsQuery = z.infer<typeof connectionRequestsQuerySchema>;

/**
 * Une suggestion de contact (§3.1), telle que `GET /me/connection-suggestions`
 * la renvoie.
 *
 * Aucune table : §3.1 dit « suggestion (pas de création) ». La suggestion est
 * donc CALCULÉE — deux présences cochées au même événement, une proposition de
 * guide acceptée — et disparaît d'elle-même dès que le contact existe. Une table
 * aurait demandé un nettoyage, et une suggestion périmée est pire que pas de
 * suggestion.
 */
export const CONNECTION_SUGGESTION_ORIGINS = ['EVENT', 'GUIDE'] as const;

export type ConnectionSuggestionOrigin = (typeof CONNECTION_SUGGESTION_ORIGINS)[number];

/** `POST /connection-requests` depuis une suggestion : on accepte par origine + référence. */
export const acceptSuggestionSchema = z
  .object({
    origin: z.enum(CONNECTION_SUGGESTION_ORIGINS),
    toHandle: handleSchema,
  })
  .strict();

export type AcceptSuggestion = z.infer<typeof acceptSuggestionSchema>;
