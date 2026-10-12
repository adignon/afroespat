import { z } from 'zod';
import { ConnectionOrigin } from '../enums/generated.js';
import { cursorQuerySchema, handleSchema, pageSchema, uuidSchema } from './pagination.js';

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

/**
 * `GET /users/:handle/mutual-connections` — ce que MES contacts et MES réseaux
 * ont en commun avec le membre regardé (§3.2). Jamais l'étendue de SON réseau.
 */
export const mutualConnectionsResponseSchema = z
  .object({
    count: z.number().int().nonnegative(),
    handles: z.array(z.string()),
    /** Les réseaux où nous sommes tous deux membres actifs. */
    sharedCommunities: z.number().int().nonnegative(),
  })
  .strict();

export type MutualConnectionsResponse = z.infer<typeof mutualConnectionsResponseSchema>;

// ── Codes d'erreur propres aux contacts (§7.2) ───────────────────────────────

/**
 * `SAME_CITY_REQUIRED` (422) n'existe plus : le porteur a levé la condition de
 * ville sur les demandes de contact — voir `ConnectionsService.request`.
 */
export const CONNECTION_ERROR_CODES = {
  REQUEST_LIMIT: 429,
  ALREADY_CONNECTED: 409,
  /** Une demande est déjà en attente entre ces deux membres, dans un sens ou l'autre. */
  REQUEST_PENDING: 409,
} as const;

export type ConnectionErrorCode = keyof typeof CONNECTION_ERROR_CODES;

export const CONNECTION_ERROR_MESSAGES: Record<ConnectionErrorCode, string> = {
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

// ── Réponses (§3.1, §3.2, §4) ───────────────────────────────────────────────

/**
 * Un membre tel que les listes de ce module le montrent : le strict nécessaire
 * pour une carte de contact, et rien de plus.
 *
 * Pas de niveau, pas de ville, pas de téléphone. Ce sont les colonnes de
 * `MEMBER_SELECT` côté service, et le schéma les reprend à l'identique plutôt que
 * d'espérer : une liste de contacts qui se mettrait à transporter un numéro serait
 * une violation de 01 §2.1 que rien n'aurait signalée.
 */
const connectionMemberSchema = z.object({
  id: uuidSchema,
  handle: handleSchema,
  displayName: z.string(),
});

/**
 * `GET /me/connections` (§3.2).
 *
 * `meta.count` est MON nombre de contacts, et la règle dure du §3.2 dit « jamais
 * celui d'un autre ». Il arrive dans `meta`, ce que `pageSchema` prévoit, et il est
 * resserré ici parce que l'écran K05 l'affiche : « Mes contacts · 12 ».
 */
export const myConnectionsResponseSchema = pageSchema(
  z.object({
    userId: uuidSchema,
    handle: handleSchema,
    displayName: z.string(),
    avatarUrl: z.string().nullable(),
    origin: z.enum(ConnectionOrigin),
    connectedAt: z.string().datetime(),
  }),
).extend({ meta: z.object({ count: z.number().int() }) });

export type MyConnectionsResponse = z.infer<typeof myConnectionsResponseSchema>;

/**
 * `GET /me/connection-requests` (§3.1).
 *
 * `nextCursor` N'Y FIGURE PAS : le service rend `{ items }` seul, borné à cinquante
 * demandes en attente. Employer `pageSchema` ici ferait refuser la vraie réponse —
 * un schéma décrit ce que l'API envoie, pas ce qu'on aurait aimé qu'elle envoie.
 * L'écart avec §5.3 est réel et se remonte ; on ne le masque pas d'un `.optional()`.
 */
export const connectionRequestsResponseSchema = z.object({
  items: z.array(
    z.object({
      id: uuidSchema,
      /** Le message obligatoire de §3.1, 20 à 500 caractères. */
      message: z.string().nullable(),
      createdAt: z.string().datetime(),
      expiresAt: z.string().datetime(),
      user: connectionMemberSchema,
    }),
  ),
});

export type ConnectionRequestsResponse = z.infer<typeof connectionRequestsResponseSchema>;

/** `GET /me/connection-suggestions` (§3.1) : calculées, jamais stockées. */
export const connectionSuggestionsResponseSchema = z.object({
  items: z.array(
    z.object({
      origin: z.enum(CONNECTION_SUGGESTION_ORIGINS),
      user: connectionMemberSchema,
      /** La phrase que l'API compose (« Vous étiez tous les deux à … »). */
      reason: z.string(),
      refId: uuidSchema,
    }),
  ),
});

export type ConnectionSuggestionsResponse = z.infer<typeof connectionSuggestionsResponseSchema>;

/**
 * `GET /me/blocks` — 08 §4.
 *
 * `{ items }`, SANS `nextCursor` : le contrôleur enveloppe ce que le service rend
 * en liste nue, et il ne pagine pas.
 *
 * CE SCHÉMA A ÉTÉ ÉCRIT FAUX D'ABORD, et la leçon vaut d'être notée ici parce
 * qu'elle se rejouera sur chaque route d'un autre module. Il déclarait un TABLEAU
 * NU, parce qu'il avait été écrit en lisant `BlocksService.list()` — qui rend bien
 * `blocks.map(…)`. C'est le CONTRÔLEUR qui pose l'enveloppe, une ligne plus haut :
 * `return { items: await this.blocks.list(…) }`.
 *
 * Le défaut n'est pas passé inaperçu, et c'est le seul point qui compte : la
 * validation de réponse a refusé la réponse réelle, l'écran K05 est resté sur son
 * état d'attente, et TROIS tests de bout en bout ont rougi. Un type écrit à la main
 * l'aurait laissé passer jusqu'à un `.map` sur `undefined`, plusieurs composants
 * plus loin. Le schéma est la source unique ; il se lit sur le CONTRÔLEUR, jamais
 * sur le service.
 *
 * Il vit dans ce fichier et non dans un fichier à part parce que le blocage est
 * décrit par le même document que les contacts (08 §3 et §4), et que l'écran K05
 * les montre côte à côte.
 */
export const myBlocksResponseSchema = z.object({
  items: z.array(
    z.object({
      userId: uuidSchema,
      handle: handleSchema,
      displayName: z.string(),
      blockedAt: z.string().datetime(),
    }),
  ),
});

export type MyBlocksResponse = z.infer<typeof myBlocksResponseSchema>;
