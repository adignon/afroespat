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

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ « UNE SESSION EST ATTENDUE » — POUR REPRENDRE AVANT LE PREMIER APPEL      ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * MESURÉ au navigateur (lot W1A, phase 0.6) : au premier chargement d'une page
 * membre, `GET /me`, `/journeys`, `/communities`… partaient SANS jeton, prenaient
 * chacun un `401`, puis étaient rejoués après le rafraîchissement. Rien d'invalide
 * côté membre, mais quatre `401` dans la console et dans le journal du serveur à
 * chaque rechargement — un signal qui ne veut plus rien dire. La reprise existait
 * (`GardeSession`, `SessionBoot`) mais elle tourne dans un `useEffect`, et React
 * exécute les effets des ENFANTS avant ceux du parent : les écrans partaient
 * toujours les premiers.
 *
 * La correction est dans le transport, pas dans les écrans : avant un appel
 * authentifié sans jeton, on attend la reprise (partagée et unique en vol,
 * voir `member.ts`). Elle ne se déclenche que si une session est ATTENDUE :
 *
 *   · la zone `(app)` la déclare (`attendreSession()`, appelé par `GardeSession`) ;
 *   · un indicateur du navigateur la déclare ailleurs (`dp_session`, posé à
 *     l'obtention d'un jeton, retiré à la déconnexion et à la mort de la session).
 *     Il ne contient AUCUN secret — un « 1 » — : le jeton de rafraîchissement
 *     reste un cookie `httpOnly`, et le jeton d'accès reste en mémoire. Il sert à
 *     ne PAS appeler `/auth/refresh` pour un visiteur qui n'a jamais ouvert de
 *     session (la page de connexion), ce qui lui prendrait un `401` pour rien.
 *
 * `localStorage` peut manquer ou lever (navigation privée, données bloquées) : tout
 * est enveloppé, et sans lui on retombe sur le comportement d'avant — le premier
 * `401` déclenche le rafraîchissement, comme le transport le fait depuis toujours.
 */
const INDICATEUR_SESSION = 'dp_session';

let sessionAttendue = false;

function lireIndicateur(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(INDICATEUR_SESSION) === '1';
  } catch {
    return false;
  }
}

/**
 * Le MÊME indicateur, en cookie de l'origine du site : c'est le seul moyen pour que le
 * SERVEUR de rendu sache, sur `/`, qu'un visiteur n'a jamais ouvert de session et l'envoie
 * à la connexion sans lui faire voir le fil. Ce n'est qu'un indice d'affichage — un « 1 »,
 * lisible par le script, sans aucune valeur d'authentification : le serveur ne s'y fie
 * pour aucun droit, et un indice périmé retombe sur la garde de session, comme avant.
 */
const DUREE_INDICATEUR_COOKIE = 60 * 60 * 24 * 30;

function ecrireCookieIndicateur(present: boolean): void {
  try {
    if (typeof document === 'undefined') return;
    const securise = typeof location !== 'undefined' && location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = present
      ? `${INDICATEUR_SESSION}=1; Path=/; Max-Age=${DUREE_INDICATEUR_COOKIE}; SameSite=Lax${securise}`
      : `${INDICATEUR_SESSION}=; Path=/; Max-Age=0; SameSite=Lax${securise}`;
  } catch {
    // Cookies bloqués : `/` retombe sur la garde de session.
  }
}

function ecrireIndicateur(present: boolean): void {
  ecrireCookieIndicateur(present);
  try {
    if (typeof localStorage === 'undefined') return;
    if (present) localStorage.setItem(INDICATEUR_SESSION, '1');
    else localStorage.removeItem(INDICATEUR_SESSION);
  } catch {
    // Sans stockage, l'indicateur n'existe pas : voir plus haut.
  }
}

/** La zone membre déclare qu'une session doit exister : les appels l'attendront. */
export function attendreSession(): void {
  sessionAttendue = true;
}

/** Faut-il reprendre la session avant d'envoyer un appel sans jeton ? */
export function sessionEstAttendue(): boolean {
  return sessionAttendue || lireIndicateur();
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
  if (token !== null) {
    sessionDead = false;
    ecrireIndicateur(true);
  }
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
  ecrireIndicateur(false);
}

/** Déconnexion : tout part, y compris ce qu'on croyait savoir. */
export function clearSession(): void {
  accessToken = null;
  knownMember = null;
  sessionDead = false;
  sessionAttendue = false;
  ecrireIndicateur(false);
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
