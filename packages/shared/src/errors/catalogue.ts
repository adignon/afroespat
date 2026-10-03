import { z } from 'zod';
import { ACCOUNT_ERROR_CODES, ACCOUNT_ERROR_MESSAGES } from '../validation/account.js';
import { ADMIN_ERROR_CODES, ADMIN_ERROR_MESSAGES } from '../validation/admin.js';
import { AUTH_ERROR_CODES, AUTH_ERROR_MESSAGES } from '../validation/auth.js';
import { BILLING_ERROR_CODES, BILLING_ERROR_MESSAGES } from '../validation/billing.js';
import { CITY_ERROR_CODES, CITY_ERROR_MESSAGES } from '../validation/cities.js';
import { COMMUNITY_ERROR_CODES, COMMUNITY_ERROR_MESSAGES } from '../validation/communities.js';
import { CONNECTION_ERROR_CODES, CONNECTION_ERROR_MESSAGES } from '../validation/connections.js';
import { EVENT_ERROR_CODES, EVENT_ERROR_MESSAGES } from '../validation/events.js';
import { FEED_ERROR_CODES, FEED_ERROR_MESSAGES } from '../validation/feed.js';
import { GUIDE_ERROR_CODES, GUIDE_ERROR_MESSAGES } from '../validation/guides.js';
import { HELP_ERROR_CODES, HELP_ERROR_MESSAGES } from '../validation/help.js';
import { HOUSING_ERROR_CODES, HOUSING_ERROR_MESSAGES } from '../validation/housing.js';
import { JOB_ERROR_CODES, JOB_ERROR_MESSAGES } from '../validation/jobs.js';
import { JOURNEY_ERROR_CODES, JOURNEY_ERROR_MESSAGES } from '../validation/journeys.js';
import { MEDIA_ERROR_CODES, MEDIA_ERROR_MESSAGES } from '../validation/media.js';
import { MENTORSHIP_ERROR_CODES, MENTORSHIP_ERROR_MESSAGES } from '../validation/mentorship.js';
import { MESSAGING_ERROR_CODES, MESSAGING_ERROR_MESSAGES } from '../validation/messaging.js';
import { MODERATION_ERROR_CODES, MODERATION_ERROR_MESSAGES } from '../validation/moderation.js';
import { PARTNER_ERROR_CODES, PARTNER_ERROR_MESSAGES } from '../validation/partners.js';
import { PRO_ERROR_CODES, PRO_ERROR_MESSAGES } from '../validation/pros.js';
import { TRANSVERSE_ERROR_CODES, TRANSVERSE_ERROR_MESSAGES } from './errors.js';

/**
 * Le CATALOGUE des codes d'erreur — l'union des vingt tables du dépôt.
 *
 * POURQUOI IL EXISTE. §5.2 dit que « le front utilise le `code` pour choisir son
 * affichage, jamais le message ». Pour cela il lui faut savoir quels codes
 * existent — et ils sont éparpillés dans vingt tables, une par module, parce que
 * c'est là qu'elles ont leur sens : le code vit à côté de la règle qui le lève.
 *
 * Ce fichier ne RECOPIE rien. Il importe les vingt tables et les fusionne. Une
 * table qui gagne un code le voit apparaître ici sans qu'on touche à ce fichier,
 * et un client qui traite les codes par exhaustivité se met à jour tout seul.
 * L'alternative — une liste écrite à la main dans le front — est la même faute
 * que `@RateLimit` : une deuxième source qui a l'air d'accord avec la première
 * jusqu'au jour où elle ne l'est plus.
 *
 * CE QU'IL N'EST PAS. Il n'est pas la liste des codes qu'une route donnée peut
 * lever : cela se lit dans la spécification du module. Il est la liste de ce qui
 * peut arriver, avec le statut HTTP et la phrase française associés.
 */

/**
 * Les tables, dans l'ordre de fusion. Les transverses EN DERNIER, délibérément.
 *
 * Un module peut redéfinir un code transverse pour en préciser le message (§5.2 :
 * « le module peut les préciser, jamais les contredire »), mais le statut HTTP des
 * transverses est fixé par `00` §5.2 et ne se négocie pas. Mettre les transverses
 * en dernier fait donc gagner la table de référence sur toute divergence de
 * statut — et `DUPLICATE_ERROR_CODES` ci-dessous rend la divergence visible au
 * lieu de la laisser se résoudre en silence.
 */
const TABLES = [
  ACCOUNT_ERROR_CODES,
  ADMIN_ERROR_CODES,
  AUTH_ERROR_CODES,
  BILLING_ERROR_CODES,
  CITY_ERROR_CODES,
  COMMUNITY_ERROR_CODES,
  CONNECTION_ERROR_CODES,
  EVENT_ERROR_CODES,
  FEED_ERROR_CODES,
  GUIDE_ERROR_CODES,
  HELP_ERROR_CODES,
  HOUSING_ERROR_CODES,
  JOB_ERROR_CODES,
  JOURNEY_ERROR_CODES,
  MEDIA_ERROR_CODES,
  MENTORSHIP_ERROR_CODES,
  MESSAGING_ERROR_CODES,
  MODERATION_ERROR_CODES,
  PARTNER_ERROR_CODES,
  PRO_ERROR_CODES,
  TRANSVERSE_ERROR_CODES,
] as const satisfies readonly Readonly<Record<string, number>>[];

const MESSAGE_TABLES = [
  ACCOUNT_ERROR_MESSAGES,
  ADMIN_ERROR_MESSAGES,
  AUTH_ERROR_MESSAGES,
  BILLING_ERROR_MESSAGES,
  CITY_ERROR_MESSAGES,
  COMMUNITY_ERROR_MESSAGES,
  CONNECTION_ERROR_MESSAGES,
  EVENT_ERROR_MESSAGES,
  FEED_ERROR_MESSAGES,
  GUIDE_ERROR_MESSAGES,
  HELP_ERROR_MESSAGES,
  HOUSING_ERROR_MESSAGES,
  JOB_ERROR_MESSAGES,
  JOURNEY_ERROR_MESSAGES,
  MEDIA_ERROR_MESSAGES,
  MENTORSHIP_ERROR_MESSAGES,
  MESSAGING_ERROR_MESSAGES,
  MODERATION_ERROR_MESSAGES,
  PARTNER_ERROR_MESSAGES,
  PRO_ERROR_MESSAGES,
  TRANSVERSE_ERROR_MESSAGES,
] as const satisfies readonly Readonly<Record<string, string>>[];

/** Code → statut HTTP, pour les vingt modules. */
export const ALL_ERROR_STATUSES: Readonly<Record<string, number>> = Object.freeze(
  Object.assign({}, ...TABLES) as Record<string, number>,
);

/** Code → phrase française affichable telle quelle (§5.2). */
export const ALL_ERROR_MESSAGES: Readonly<Record<string, string>> = Object.freeze(
  Object.assign({}, ...MESSAGE_TABLES) as Record<string, string>,
);

/** Tous les codes connus, triés. */
export const ALL_ERROR_CODES: readonly string[] = Object.freeze(
  Object.keys(ALL_ERROR_STATUSES).sort(),
);

/**
 * Les codes déclarés dans PLUSIEURS tables avec des statuts DIFFÉRENTS.
 *
 * Normalement vide. Un code qui vaudrait 403 dans un module et 404 dans un autre
 * n'est pas un code stable : le front qui choisit son affichage sur le couple
 * (statut, code) se tromperait selon la route appelée. Un test le garde à zéro —
 * c'est le seul moyen de s'en apercevoir, la fusion étant silencieuse.
 */
export const CONFLICTING_ERROR_CODES: readonly string[] = Object.freeze(
  (() => {
    const seen = new Map<string, number>();
    const conflicts = new Set<string>();
    for (const table of TABLES) {
      for (const [code, status] of Object.entries(table)) {
        const previous = seen.get(code);
        if (previous !== undefined && previous !== status) conflicts.add(code);
        seen.set(code, status);
      }
    }
    return [...conflicts].sort();
  })(),
);

/** Le code est-il connu du dépôt ? */
export function isKnownErrorCode(code: string): boolean {
  return Object.prototype.hasOwnProperty.call(ALL_ERROR_STATUSES, code);
}

/**
 * La phrase française d'un code, ou `null` s'il est inconnu.
 *
 * `null` et non une phrase inventée : un code que le dépôt ne connaît pas vient
 * d'une API plus récente que ce client, et prétendre le comprendre ferait passer
 * une nouveauté pour une règle métier déjà gérée. L'appelant décide quoi afficher,
 * et il sait alors qu'il ne sait pas.
 */
export function messageForErrorCode(code: string): string | null {
  return ALL_ERROR_MESSAGES[code] ?? null;
}

/**
 * Le schéma de l'enveloppe d'erreur de §5.2 — `error { code, message, details }`.
 *
 * Il est ICI et pas dans `errors.ts` pour une raison de dépendances : `errors.ts`
 * n'importe rien, et c'est ce qui lui permet d'être importé par les vingt modules
 * sans cycle. Ce fichier-ci les importe tous, donc il ne peut pas être importé par
 * eux — et il n'a pas à l'être.
 *
 * `code` n'est PAS un `z.enum(ALL_ERROR_CODES)`, et c'est délibéré : une API plus
 * récente que ce client peut lever un code qu'il ne connaît pas encore, et
 * transformer cela en échec de validation ferait d'un déploiement une panne.
 * `isKnownErrorCode` sert à décider ensuite, en connaissance de cause.
 */
export const apiErrorBodySchema = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string(),
    details: z.record(z.unknown()).optional(),
  }),
});

export type ApiErrorBodyParsed = z.infer<typeof apiErrorBodySchema>;

/**
 * Les détails d'un `429 RATE_LIMITED`, tels que `RateLimitGuard` les émet.
 *
 * `retryAfterSeconds` est en SECONDES, et il n'y a pas d'autre unité dans ce
 * projet : §5.5 raisonne par minute, mais plusieurs routes sont chiffrées à
 * l'HEURE (`POST /auth/otp/request` 10/h, `PATCH /me` 20/h, `PATCH /me/profile`
 * 20/h). Mesuré sur l'API : le dépassement de l'OTP renvoie
 * `Retry-After: 3600` et `details.retryAfterSeconds: 3600`. Un client qui lirait
 * ce nombre comme des minutes se tromperait d'un facteur 60 — et, dans l'autre
 * sens, un client qui supposerait la minute afficherait « une minute » là où il
 * faut attendre une heure.
 *
 * Tous les champs sont facultatifs : le serveur les envoie, mais un `429` produit
 * par un intermédiaire — proxy, hébergeur — n'en aura aucun, et le client doit
 * quand même savoir qu'il a été freiné.
 */
export const rateLimitedDetailsSchema = z
  .object({
    scope: z.string().optional(),
    limit: z.number().int().optional(),
    retryAfterSeconds: z.number().int().nonnegative().optional(),
  })
  .passthrough();

export type RateLimitedDetails = z.infer<typeof rateLimitedDetailsSchema>;

/**
 * Les détails d'un `403 LEVEL_REQUIRED`, tels que `ApiError.levelRequired` les
 * émet (via `levelRequiredDetails`).
 *
 * §7.3 : le front affiche une INVITATION à monter de niveau, jamais une simple
 * erreur. Il lui faut donc le niveau requis, le niveau courant, et le libellé
 * français de ce que le membre essayait de faire — les trois sont dans `details`,
 * et c'est pour cela qu'ils sont typés ici plutôt que laissés en `unknown`.
 */
export const levelRequiredDetailsSchema = z
  .object({
    capability: z.string().optional(),
    requiredLevel: z.string().optional(),
    currentLevel: z.string().optional(),
    labelFr: z.string().optional(),
  })
  .passthrough();

export type LevelRequiredDetailsParsed = z.infer<typeof levelRequiredDetailsSchema>;

/**
 * Les détails d'un `400 VALIDATION_FAILED` — `details.fields: [{ path, code }]`
 * (T4 §3), avec `message` seulement sur les refus `custom` (voir `zod.pipe.ts`).
 */
export const validationFailedDetailsSchema = z
  .object({
    fields: z
      .array(
        z.object({
          path: z.string(),
          code: z.string(),
          message: z.string().optional(),
        }),
      )
      .default([]),
  })
  .passthrough();

export type ValidationFailedDetails = z.infer<typeof validationFailedDetailsSchema>;
