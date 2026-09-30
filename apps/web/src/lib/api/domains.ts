/**
 * L'ÉTANCHÉITÉ DES DEUX DOMAINES, côté client — 15-administration.md §2.1 et
 * 00-fondations.md §7.4.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ RÈGLE DURE : les comptes équipe et les comptes membres sont HERMÉTIQUES.  │
 * │ Un jeton de membre n'ouvre jamais une route d'équipe, et réciproquement.  │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Le serveur la tient déjà, par quatre faits (voir `apps/api/src/common/staff.guard.ts`),
 * dont un refus explicite `CROSS_DOMAIN_TOKEN`. Ce fichier ne la répète pas : il
 * rend le mélange IMPOSSIBLE À ÉCRIRE, pour que `CROSS_DOMAIN_TOKEN` reste ce
 * qu'il doit être — un code qu'on ne voit jamais.
 *
 * MESURÉ, pas supposé. Le document OpenAPI de l'API qui tourne a été lu
 * (`GET /v1/docs-json`, 273 opérations) :
 *
 *   · 75 opérations portent un `x-capability` en `staff:…` ; TOUTES sont sous
 *     `/v1/admin`.
 *   · AUCUNE opération sous `/v1/admin` ne porte une capacité de membre.
 *   · les 4 seules exceptions sous `/v1/admin` sont `POST /v1/admin/auth/login`,
 *     `/auth/totp`, `/auth/totp/enroll`, `/auth/totp/confirm`, déclarées
 *     `none:public-read` — on ne peut pas exiger une session d'équipe pour ouvrir
 *     une session d'équipe. Elles appartiennent bien au domaine ÉQUIPE : c'est
 *     elles qui posent le cookie `dp_staff`.
 *
 * Le préfixe `/v1/admin` est donc EXACTEMENT le domaine équipe. C'est ce fait qui
 * rend la séparation structurelle possible, et c'est pourquoi il est mesuré et non
 * supposé : un seul contre-exemple — une route de membre sous `/v1/admin` — et
 * toute la construction ci-dessous serait fausse. Un test le vérifie sur le
 * document OpenAPI, et il rougira le jour où quelqu'un ajoute cette route.
 *
 * TROIS FAITS INDÉPENDANTS, chacun suffisant seul :
 *
 *   1. **LE TYPE.** `memberApi` n'accepte pas un chemin qui commence par `/admin` :
 *      `MemberOnly<'/admin/x'>` vaut `never`, donc `memberApi.get('/admin/x', …)`
 *      NE COMPILE PAS. Ce n'est pas un contrôle qu'on peut oublier de faire ; c'est
 *      le compilateur.
 *
 *   2. **LA BASE.** `staffApi` a pour base `/v1/admin` et ses chemins sont
 *      RELATIFS. Il n'a aucun moyen d'exprimer `/me` : tout ce qu'il envoie
 *      atterrit sous `/v1/admin`. Le domaine membre ne lui est pas interdit — il
 *      est inaccessible.
 *
 *   3. **LE TRANSPORT.** `staffApi` n'a pas accès au jeton d'accès. Pas « il ne
 *      l'envoie pas » : il ne peut pas le lire. Le jeton vit dans la clôture de
 *      `session.ts`, et le transport reçoit un descripteur d'identification —
 *      `{ kind: 'cookie' }` pour l'équipe — qui ne contient aucune fonction pour
 *      l'obtenir. Un en-tête `Authorization` sur une route d'équipe n'est donc pas
 *      une erreur à éviter : il n'existe pas de chemin de code qui le produise.
 *
 * Le contrôle d'exécution de `assertSafePath` n'est pas un quatrième fait de même
 * nature — c'est le filet du cas que les types ne voient pas : un chemin CALCULÉ.
 */

/**
 * Le préfixe du domaine équipe, tel que `00` §5.1 le fixe et tel que l'OpenAPI le
 * confirme sur les 75 opérations d'équipe.
 */
export const STAFF_PREFIX = '/admin';

/**
 * Un chemin que le client MEMBRE accepte : tout sauf le domaine équipe.
 *
 * `never` pour `/admin` et `/admin/…`, ce qui rend l'appel non compilable. Le
 * paramètre reste générique pour que TypeScript infère le littéral et applique la
 * condition dessus ; avec un simple `string`, il n'y aurait rien à tester.
 */
export type MemberOnly<P extends string> = P extends `${typeof STAFF_PREFIX}${'' | `/${string}`}`
  ? never
  : P;

/**
 * Un chemin que le client ÉQUIPE accepte : relatif à `/v1/admin`, donc SANS le
 * préfixe.
 *
 * `/admin/…` est refusé, et pas par excès de zèle : le client le préfixe lui-même,
 * donc `staffApi.get('/admin/moderation/cases')` viserait `/v1/admin/admin/moderation/cases`
 * — un 404 dont la cause est invisible à la lecture. Autant qu'il ne compile pas.
 */
export type StaffOnly<P extends string> = P extends `${typeof STAFF_PREFIX}${'' | `/${string}`}`
  ? never
  : P;

/**
 * Le contrôle d'exécution, pour les chemins CALCULÉS.
 *
 * Les types ne voient qu'un littéral. Or un chemin se construit : `/users/${id}`,
 * `/cases/${caseId}/notes`. Si `id` vient d'une réponse d'API, d'une URL ou d'un
 * formulaire, il peut contenir n'importe quoi — et deux formes traversent le
 * préfixe :
 *
 *   · `..` — le NAVIGATEUR normalise avant d'émettre. `/v1/admin/../me` part en
 *     `/v1/me`. C'est l'évasion complète du domaine : un client d'équipe
 *     atteindrait une route de membre, base relative ou pas. C'est le trou que
 *     laisserait une séparation qui ne repose que sur la concaténation.
 *   · `//` en tête — `fetch('//exemple.test/x')` est une URL PROTOCOL-RELATIVE :
 *     la requête part sur un autre HÔTE, avec les cookies de ce domaine. Le jeton
 *     n'y va pas (il est dans un en-tête que l'on choisit), mais le chemin
 *     appelé n'est plus celui qu'on croit.
 *
 * On REFUSE plutôt que d'assainir. Un chemin qui contient `..` est un bogue de
 * l'appelant, et le réécrire en silence le laisserait vivre — avec, quelque part,
 * un identifiant mal encodé qui interroge la mauvaise ressource.
 */
export function assertSafePath(path: string): void {
  if (!path.startsWith('/')) {
    throw new Error(`Chemin d’API invalide : « ${path} » doit commencer par « / ».`);
  }
  if (path.startsWith('//')) {
    throw new Error(
      `Chemin d’API invalide : « ${path} » commence par « // », ce que fetch lit comme ` +
        `une URL vers un autre hôte.`,
    );
  }
  // Sur les SEGMENTS, pas sur la chaîne : un identifiant peut légitimement
  // contenir deux points (« a..b » n'est pas une remontée), alors qu'un segment
  // qui EST « .. » en est toujours une.
  if (path.split(/[?#]/)[0]?.split('/').includes('..') === true) {
    throw new Error(
      `Chemin d’API invalide : « ${path} » contient un segment « .. ». Le navigateur le ` +
        `normalise avant d’émettre, ce qui ferait sortir l’appel de son domaine.`,
    );
  }
}

/**
 * Le chemin reste-t-il dans le domaine du membre ?
 *
 * Doublon assumé du type `MemberOnly` : il attrape ce que le type ne voit pas, un
 * chemin calculé qui viserait `/admin`. Les deux sont nécessaires — le type rend
 * la faute non écrivable, celui-ci rend la faute calculée non exécutable.
 */
export function assertMemberPath(path: string): void {
  assertSafePath(path);
  const first = path.split(/[?#]/)[0] ?? path;
  if (first === STAFF_PREFIX || first.startsWith(`${STAFF_PREFIX}/`)) {
    throw new Error(
      `Le client membre ne peut pas appeler « ${path} » : ${STAFF_PREFIX} est le domaine ` +
        `de l’équipe (règle dure 15 §2.1). Employez staffApi, sans le préfixe.`,
    );
  }
}

/** Le pendant : un chemin d'équipe ne redouble pas son propre préfixe. */
export function assertStaffPath(path: string): void {
  assertSafePath(path);
  const first = path.split(/[?#]/)[0] ?? path;
  if (first === STAFF_PREFIX || first.startsWith(`${STAFF_PREFIX}/`)) {
    throw new Error(
      `Le client équipe préfixe déjà ${STAFF_PREFIX} : « ${path} » viserait ` +
        `${STAFF_PREFIX}${path}. Écrivez le chemin sans le préfixe.`,
    );
  }
}
