import type { z } from 'zod';
import { meResponseSchema, refreshResponseSchema, type MeResponse } from '@app/shared';
import { API_BASE } from './base';
import { assertMemberPath, type MemberOnly } from './domains';
import { ApiError } from './errors';
import {
  bearerHeader,
  clearSession,
  forgetRights,
  hasAccessToken,
  isSessionDead,
  sessionEstAttendue,
  knownMe,
  markSessionDead,
  rememberMe,
  setAccessToken,
} from './session';
import { createTransport, type RequestOptions } from './transport';
import { voidResponse } from './void-response';

/**
 * Le client du domaine MEMBRE — `/v1/…`, jeton porteur.
 *
 * Il ne peut pas appeler `/v1/admin/…` : `MemberOnly` rend l'appel non compilable,
 * et `assertMemberPath` refuse le chemin calculé. Voir `domains.ts`.
 */

/**
 * LE RAFRAÎCHISSEMENT, PARTAGÉ ET UNIQUE EN VOL.
 *
 * Sans partage, cinq appels simultanés qui prennent un `401` lancent cinq
 * rotations. Or le jeton de rafraîchissement TOURNE à chaque usage et porte un
 * numéro de génération (D — `chain_id` + `token_generation`) : la deuxième rotation
 * présente une génération dépassée, le serveur y voit un REJEU — ce pour quoi il
 * est fait — et RÉVOQUE LA CHAÎNE ENTIÈRE. Le membre est déconnecté, au hasard, au
 * chargement d'une page, et le journal du serveur accuse un rejeu qui n'a pas eu
 * lieu.
 *
 * C'est exactement le genre de défaut qu'on ne voit jamais en développement — où
 * les appels partent un par un — et toujours en production.
 */
let inFlight: Promise<boolean> | null = null;

async function refreshOnce(): Promise<boolean> {
  // Une session morte ne se rafraîchit pas : voir `markSessionDead`.
  if (isSessionDead()) return false;

  const existing = inFlight;
  if (existing !== null) return existing;

  const started = (async (): Promise<boolean> => {
    let response: Response;
    try {
      /**
       * `fetch` NU, et non le transport.
       *
       * Le transport rafraîchit sur `401` : l'employer ici ferait qu'un
       * rafraîchissement refusé déclenche un rafraîchissement, indéfiniment. La
       * route de sortie ne peut pas passer par le mécanisme qu'elle sert.
       */
      response = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        // Le cookie `dp_refresh` est `httpOnly` et son chemin est `/v1/auth` : il
        // ne part que si on le demande, l'API étant sur une autre origine.
        credentials: 'include',
      });
    } catch {
      /**
       * Panne réseau : on ne TUE PAS la session.
       *
       * La distinction est importante. Un refus du serveur est un verdict ; une
       * absence de réponse n'est pas un verdict. Marquer la session morte sur une
       * coupure de wifi déconnecterait un membre parfaitement valide, et il
       * faudrait recommencer l'OTP — SMS compris — pour rien.
       */
      return false;
    }

    if (!response.ok) {
      /**
       * `401` ou `403` : verdict DÉFINITIF. Session révoquée, chaîne coupée par
       * détection de rejeu, compte supprimé. On marque la session morte, ce qui
       * empêche les appels suivants de marteler cette route — laquelle porte
       * `@RateLimit(30)` et répondrait sinon `429`, c'est-à-dire un message
       * trompeur à la place de « reconnectez-vous ».
       *
       * Tout le reste — `429`, `500`, `502` — est temporaire : l'appel échoue, la
       * session reste. Un hoquet du serveur n'est pas une déconnexion.
       */
      if (response.status === 401 || response.status === 403) markSessionDead();
      return false;
    }

    let parsed: unknown;
    try {
      parsed = await response.json();
    } catch {
      return false;
    }

    const body = refreshResponseSchema.safeParse(parsed);
    // Même ici la frontière tient : un `200` dont le corps n'a pas la bonne forme
    // ne doit pas installer `undefined` comme jeton d'accès. Chaque appel partirait
    // alors avec `Authorization: Bearer undefined`, que le serveur refuse — un
    // symptôme de « session expirée » dont la cause est un contrat cassé.
    if (!body.success) return false;

    setAccessToken(body.data.accessToken);
    return true;
  })();

  inFlight = started;
  try {
    return await started;
  } finally {
    // Libéré dans TOUS les cas : sans cela, un seul échec réseau condamnerait la
    // session pour le reste de la vie de l'onglet.
    inFlight = null;
  }
}

/**
 * LA REPRISE AVANT LE PREMIER APPEL — voir `session.ts`, « une session est attendue ».
 *
 * `/auth/…` est exclu : l'envoi du code et sa vérification n'ont pas de session à
 * reprendre, et `/auth/logout` n'a pas à en acheter une pour la fermer. La promesse
 * est gardée : plusieurs appels simultanés attendent la MÊME reprise (et
 * `refreshOnce` la partage de toute façon, ce qui évite la rotation multiple).
 */
let reprise: Promise<boolean> | null = null;

async function reprendreAvant(path: string): Promise<void> {
  if (hasAccessToken() || isSessionDead() || path.startsWith('/auth/')) return;
  if (!sessionEstAttendue()) return;
  reprise ??= refreshOnce().finally(() => {
    reprise = null;
  });
  await reprise.catch(() => false);
}

const transport = createTransport({
  base: API_BASE,
  /** Domaine membre : aucun préfixe. Le domaine équipe en a un. */
  domainPrefix: '',
  credentials: {
    kind: 'bearer',
    header: bearerHeader,
    refresh: refreshOnce,
    isDead: isSessionDead,
    before: reprendreAvant,
    onRightsChanged: forgetRights,
  },
  assertPath: assertMemberPath,
});

/**
 * Les cinq verbes, chacun exigeant un schéma de réponse.
 *
 * La signature `P & MemberOnly<P>` est ce qui refuse `/admin/…` À LA COMPILATION :
 * `MemberOnly<'/admin/x'>` vaut `never`, l'intersection vaut `never`, et aucune
 * chaîne n'est assignable à `never`. `P` apparaît seul dans l'intersection pour que
 * TypeScript infère bien le littéral avant d'appliquer la condition.
 */
export const memberApi = {
  get<P extends string, S extends z.ZodTypeAny>(
    path: P & MemberOnly<P>,
    schema: S,
    options?: RequestOptions,
  ): Promise<z.infer<S>> {
    return transport.request('GET', path, schema, options);
  },
  post<P extends string, S extends z.ZodTypeAny>(
    path: P & MemberOnly<P>,
    schema: S,
    options?: RequestOptions,
  ): Promise<z.infer<S>> {
    return transport.request('POST', path, schema, options);
  },
  patch<P extends string, S extends z.ZodTypeAny>(
    path: P & MemberOnly<P>,
    schema: S,
    options?: RequestOptions,
  ): Promise<z.infer<S>> {
    return transport.request('PATCH', path, schema, options);
  },
  put<P extends string, S extends z.ZodTypeAny>(
    path: P & MemberOnly<P>,
    schema: S,
    options?: RequestOptions,
  ): Promise<z.infer<S>> {
    return transport.request('PUT', path, schema, options);
  },
  del<P extends string, S extends z.ZodTypeAny>(
    path: P & MemberOnly<P>,
    schema: S,
    options?: RequestOptions,
  ): Promise<z.infer<S>> {
    return transport.request('DELETE', path, schema, options);
  },
} as const;

/**
 * Le membre courant.
 *
 * `force: false` (le défaut) rend la copie en mémoire si elle existe. Elle
 * n'existe PAS après un `TOKEN_STALE` ou un `LEVEL_REQUIRED` : `forgetRights()` l'a
 * jetée, précisément pour que la lecture suivante reparte du serveur. C'est le
 * pendant côté client de la correction du garde — voir `session.ts` pour
 * l'histoire complète, qui vaut d'être lue avant de toucher à ceci.
 *
 * NE PAS S'EN SERVIR POUR AUTORISER. Le niveau qu'il porte sert à EXPLIQUER (« il
 * vous faut un compte vérifié pour publier »), jamais à décider. Décider revient au
 * serveur, qui répond `LEVEL_REQUIRED` avec ce qu'il faut pour afficher
 * l'invitation du §7.3.
 */
export async function fetchMe(options: { readonly force?: boolean } = {}): Promise<MeResponse> {
  if (options.force !== true) {
    const cached = knownMe();
    if (cached !== null) return cached;
  }
  const me = await memberApi.get('/me', meResponseSchema);
  rememberMe(me);
  return me;
}

/**
 * Reprendre une session au chargement de la page.
 *
 * Le jeton d'accès vit en mémoire et meurt avec l'onglet ; le cookie de
 * rafraîchissement, lui, dure trente jours. Un rechargement laisse donc une
 * session valide sans jeton en main, et c'est cette fonction qui la récupère.
 *
 * `false` ne veut pas forcément dire « pas connecté » : une panne réseau rend
 * `false` aussi. `isSessionDead()` distingue les deux — mort = verdict du serveur.
 */
export async function resumeSession(): Promise<boolean> {
  return refreshOnce();
}

/**
 * Déconnexion — `POST /auth/logout`, puis on oublie tout localement.
 *
 * L'état local est nettoyé MÊME SI l'appel échoue, et l'ordre importe : garder le
 * jeton parce que le serveur n'a pas répondu laisserait une interface connectée
 * après un geste de déconnexion explicite. C'est le seul cas où l'on préfère
 * l'oubli local à la vérité du serveur — le membre a demandé à partir.
 */
export async function logout(): Promise<void> {
  try {
    await memberApi.post('/auth/logout', voidResponse);
  } catch (error) {
    // Un `401` ici n'est pas un échec : la session était déjà coupée.
    if (!(error instanceof ApiError)) throw error;
  } finally {
    clearSession();
  }
}

export { setAccessToken, clearSession, hasAccessToken, knownMe } from './session';
