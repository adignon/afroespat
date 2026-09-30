import type { MeResponse } from '@app/shared';

/**
 * La session du MEMBRE — le jeton d'accès et ce qu'on croit savoir de ses droits.
 *
 * Ce module est le SEUL détenteur du jeton. Il n'exporte aucun moyen de le lire
 * autrement que par `bearerHeader()`, et `staff.ts` ne l'importe pas : c'est ce qui
 * rend l'étanchéité structurelle plutôt que disciplinaire (voir `domains.ts`).
 *
 * ── LE JETON RESTE EN MÉMOIRE ───────────────────────────────────────────────
 *
 * Jamais dans `localStorage`, jamais dans `sessionStorage`. Le jeton de
 * rafraîchissement est un cookie `httpOnly` précisément pour qu'un script injecté
 * ne puisse pas l'exfiltrer (T4 §2) ; écrire le jeton d'accès dans un stockage
 * lisible par JavaScript rendrait ce soin inutile, puisque quinze minutes de droits
 * volés suffisent. Il disparaît au rechargement, et c'est voulu : le cookie sert à
 * en obtenir un nouveau, c'est son unique rôle.
 *
 * ── CE QUI EST BEAUCOUP PLUS DÉLICAT : LE NIVEAU ─────────────────────────────
 *
 * L'historique du projet est écrit dans `auth.guard.ts` et vaut d'être relu, parce
 * que le front peut le REJOUER à son tour :
 *
 *   1. le jeton d'accès porte `level` et vit quinze minutes ;
 *   2. `level_refresh_required` était posé et lu par personne — un membre
 *      rétrogradé gardait ses droits quinze minutes ;
 *   3. la correction a lu le drapeau, mais `/auth/refresh` le remet à `false` : le
 *      VIEUX jeton d'accès, encore valide, redevenait acceptable AVEC SON ANCIEN
 *      NIVEAU. Une élévation de privilège ouverte par le remède ;
 *   4. la correction de la correction compare aussi `claims.level` au niveau en
 *      base. Vérifié sur l'API qui tourne : les deux critères sont là.
 *
 * LE FRONT PEUT REFAIRE LA MÊME FAUTE, dans sa propre monnaie. S'il garde une copie
 * de `verificationLevel` et s'en sert pour décider ce qu'il affiche ou autorise,
 * alors un membre rétrogradé garde une interface de niveau supérieur aussi
 * longtemps que vit cette copie. Le serveur refusera l'écriture — donc ce n'est pas
 * une faille — mais c'est la même erreur de raisonnement : croire qu'un niveau lu
 * une fois reste vrai.
 *
 * D'où la règle de ce module : `TOKEN_STALE` ne veut pas dire « ton jeton est
 * vieux », il veut dire **TOUT CE QUE TU CROIS SAVOIR DES DROITS DE CE MEMBRE EST
 * PÉRIMÉ**. `forgetRights()` est appelé à chaque `TOKEN_STALE` et à chaque
 * `LEVEL_REQUIRED`, et la copie de `MeResponse` est jetée. La suivante vient du
 * serveur.
 *
 * Et la règle pour les écrans, à faire respecter par ceux qui les brancheront : le
 * niveau ne sert JAMAIS à autoriser, seulement à expliquer. On tente l'action, et
 * c'est `LEVEL_REQUIRED` — avec `requiredLevel`, `currentLevel` et `labelFr` dans
 * ses détails — qui fait afficher l'invitation à monter de niveau (§7.3).
 */

/** Le jeton d'accès. Portée module : rien d'autre ne le voit. */
let accessToken: string | null = null;

/** La dernière réponse `/me` connue. Jetée dès qu'un droit peut avoir changé. */
let knownMember: MeResponse | null = null;

/**
 * La session est-elle définitivement morte ?
 *
 * Posé quand `/auth/refresh` a refusé de façon définitive (401/403) : session
 * révoquée, chaîne coupée par détection de rejeu, compte supprimé. Il existe pour
 * une raison très concrète : sans lui, chaque appel qui échoue relance un
 * rafraîchissement, et une page qui en fait dix au chargement martèle
 * `/auth/refresh` — laquelle porte `@RateLimit(30)`. On passerait alors d'une
 * « session expirée » à un `429`, c'est-à-dire d'un message clair à un message
 * trompeur.
 *
 * Seul `setAccessToken` avec un vrai jeton le lève : autrement dit, seule une
 * nouvelle connexion ressuscite la session.
 */
let sessionDead = false;

export function setAccessToken(token: string | null): void {
  accessToken = token;
  if (token !== null) sessionDead = false;
}

export function hasAccessToken(): boolean {
  return accessToken !== null;
}

/**
 * L'en-tête `Authorization`, ou `null`.
 *
 * La SEULE sortie du jeton hors de ce module, et elle rend un en-tête déjà formé
 * plutôt que la valeur brute : il n'y a donc rien à recopier ailleurs, et rien à
 * mettre par erreur dans un journal, une URL ou un corps de requête.
 */
export function bearerHeader(): Readonly<Record<string, string>> | null {
  return accessToken === null ? null : { authorization: `Bearer ${accessToken}` };
}

export function isSessionDead(): boolean {
  return sessionDead;
}

/** Appelé quand `/auth/refresh` a refusé définitivement. */
export function markSessionDead(): void {
  sessionDead = true;
  accessToken = null;
  knownMember = null;
}

/** Déconnexion : tout part, y compris ce qu'on croyait savoir. */
export function clearSession(): void {
  accessToken = null;
  knownMember = null;
  sessionDead = false;
}

/**
 * Le membre courant tel qu'on l'a lu la dernière fois, ou `null`.
 *
 * `null` n'est PAS « pas connecté » : c'est « je ne sais pas, demande au serveur ».
 * La distinction compte, parce que `forgetRights()` rend précisément ce `null` sur
 * une session parfaitement valide.
 */
export function knownMe(): MeResponse | null {
  return knownMember;
}

export function rememberMe(me: MeResponse): void {
  knownMember = me;
}

/**
 * Oublier les droits, garder la session.
 *
 * Appelé sur `TOKEN_STALE` et sur `LEVEL_REQUIRED`. Le jeton n'est PAS effacé —
 * il va être remplacé par un rafraîchissement, et l'effacer ferait passer une
 * actualisation de routine pour une déconnexion. Ce qui part, c'est la copie de
 * `MeResponse` : le niveau, le plan et le statut qu'elle contient viennent d'être
 * démentis par le serveur.
 */
export function forgetRights(): void {
  knownMember = null;
}
