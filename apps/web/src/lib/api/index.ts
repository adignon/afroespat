/**
 * LE SOCLE D'APPEL DE L'API — la surface publique, et rien d'autre.
 *
 * À lire avant de brancher un domaine. Le détail des choix est dans chaque fichier ;
 * voici ce qu'il faut savoir pour s'en servir.
 *
 * ── 1. DEUX CLIENTS, JAMAIS UN ──────────────────────────────────────────────
 *
 *     memberApi.get('/me', meResponseSchema)              → GET /v1/me
 *     staffApi.get('/moderation/cases', casesSchema)       → GET /v1/admin/moderation/cases
 *
 * `memberApi` porte le jeton, `staffApi` le cookie `dp_staff`. Aucun des deux ne
 * peut atteindre le domaine de l'autre, et ce n'est pas une consigne : c'est le
 * type, la base et le transport (voir `domains.ts`). N'essayez pas de contourner —
 * si vous en avez besoin, la route est mal rangée côté API, remontez-le.
 *
 * ── 2. TOUT APPEL PORTE UN SCHÉMA DE RÉPONSE ────────────────────────────────
 *
 * Il n'existe aucune variante sans schéma. La réponse est validée à l'arrivée, et
 * une forme inattendue lève `ApiShapeError` — sur l'appel, avec le nom du champ —
 * au lieu de propager `undefined` jusqu'à un écran blanc.
 *
 * Le schéma vient de `@app/shared`. Si celui de votre route n'existe pas encore,
 * ÉCRIVEZ-LE LÀ, à côté du schéma de requête du même module, et pas dans un
 * fichier du front : `00` §4 fait de `packages/shared` la source unique, et un
 * schéma de réponse recopié dans le front est une deuxième source qui divergera.
 *
 * Outils fournis : `pageSchema(item)` pour l'enveloppe `{ items, nextCursor, meta }`
 * de §5.3, et `voidResponse` pour les `204`.
 *
 * ── 3. LES ERREURS ──────────────────────────────────────────────────────────
 *
 * Trois classes, volontairement distinctes — `ApiError` (le serveur a dit non),
 * `ApiShapeError` (le contrat est cassé), `ApiNetworkError` (rien n'a répondu).
 * `ApiShapeError` n'hérite PAS d'`ApiError` : un `catch (e) { if (e instanceof
 * ApiError) … }` ne peut donc pas transformer un changement de contrat en message
 * métier.
 *
 * On décide sur `error.code`, JAMAIS sur le message (§5.2). `displayMessageFor(e)`
 * donne la phrase française pour n'importe quel échec.
 *
 * ── 4. LE DÉBIT LIMITÉ ──────────────────────────────────────────────────────
 *
 * `error.isRateLimited` distingue le `429` de tout autre refus, et
 * `error.retryAfterSeconds` donne l'attente EN SECONDES. Elle peut valoir 3600 :
 * trois routes sont chiffrées à l'HEURE (`POST /auth/otp/request` 10/h,
 * `PATCH /me` 20/h, `PATCH /me/profile` 20/h). N'affichez pas le message du
 * serveur sur un `429` — il dit « patientez un instant » pour une heure d'attente.
 * `error.displayMessage` le fait déjà correctement.
 *
 * ── 5. LE NIVEAU DE VÉRIFICATION ────────────────────────────────────────────
 *
 * NE L'EMPLOYEZ JAMAIS POUR AUTORISER. Tentez l'action ; le serveur répond
 * `403 LEVEL_REQUIRED`, et `error.levelRequired` porte `requiredLevel`,
 * `currentLevel` et `labelFr` — de quoi afficher l'invitation à monter de niveau
 * que §7.3 exige (une invitation, jamais une simple erreur).
 *
 * La raison est dans `session.ts`, et elle vaut d'être lue : un niveau lu une fois
 * et gardé, c'est la faille de quinze minutes du projet rejouée dans le front.
 */

export { API_BASE } from './base';

export {
  ApiError,
  ApiFailure,
  ApiNetworkError,
  ApiShapeError,
  displayMessageFor,
  formatRetryAfter,
  isApiFailure,
  parseRetryAfter,
} from './errors';

export {
  assertMemberPath,
  assertSafePath,
  assertStaffPath,
  STAFF_PREFIX,
  type MemberOnly,
  type StaffOnly,
} from './domains';

export {
  clearSession,
  fetchMe,
  hasAccessToken,
  knownMe,
  logout,
  memberApi,
  resumeSession,
  setAccessToken,
} from './member';

export { staffApi } from './staff';

export { voidResponse } from './void-response';

export type { Credentials, HttpMethod, RequestOptions, Transport } from './transport';
