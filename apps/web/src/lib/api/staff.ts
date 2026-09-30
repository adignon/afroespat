import type { z } from 'zod';
import { API_BASE } from './base';
import { assertStaffPath, STAFF_PREFIX, type StaffOnly } from './domains';
import { createTransport, type RequestOptions } from './transport';

/**
 * Le client du domaine ÉQUIPE — `/v1/admin/…`, cookie `dp_staff`.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ CE FICHIER N'IMPORTE PAS `session.ts`.                                    │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Ce n'est pas un oubli ni une convention : c'est la règle dure 15 §2.1 rendue
 * structurelle. Le jeton d'accès du membre vit dans la clôture de `session.ts`, et
 * `bearerHeader()` est la seule sortie. Ce module ne l'appelle pas, ne l'importe
 * pas, et passe au transport un descripteur `{ kind: 'cookie' }` — qui ne contient
 * AUCUNE fonction capable de produire un en-tête d'identification.
 *
 * Conséquence : « un jeton de membre sur une route d'équipe » n'est pas une erreur
 * qu'il faut penser à éviter. Il n'existe pas de chemin de code, dans ce client, qui
 * puisse construire cet en-tête. `CROSS_DOMAIN_TOKEN` est la réponse du serveur à
 * une faute que ce client ne sait pas commettre — et un test le vérifie en posant un
 * jeton de membre puis en regardant ce que `staffApi` envoie.
 *
 * ── PAS DE RAFRAÎCHISSEMENT, ET C'EST EXACT ─────────────────────────────────
 *
 * Une session d'équipe n'a pas de jeton de rafraîchissement. Elle se prolonge À
 * L'ACTIVITÉ, côté serveur : `StaffGuard.slideExpiry` repousse `expires_at` de 30
 * minutes à chaque requête, dans une borne absolue de 8 h (§2.1). Le client n'a rien
 * à faire pour cela — et il n'a surtout rien à rejouer.
 *
 * Un `401 STAFF_SESSION_REQUIRED` veut donc dire : la session est finie (inactivité,
 * 8 h atteintes, révocation, compte désactivé), il faut repasser par
 * `POST /admin/auth/login`. Rejouer l'appel ne changerait rien, et rafraîchir
 * appellerait `/v1/auth/refresh` — une route du domaine MEMBRE. Ce serait rétablir
 * dans le client la passerelle que tout le reste ferme.
 */

const transport = createTransport({
  base: API_BASE,
  /**
   * Le préfixe, posé UNE FOIS ici et jamais négociable par appel.
   *
   * C'est le deuxième fait de l'étanchéité : tous les chemins de ce client sont
   * relatifs à `/v1/admin`. Il n'a aucun moyen d'exprimer `/me`. `assertStaffPath`
   * refuse en plus les segments `..`, que le navigateur normaliserait AVANT
   * d'émettre — `/v1/admin/../me` partirait en `/v1/me`, ce qui serait l'évasion
   * complète du domaine.
   */
  domainPrefix: STAFF_PREFIX,
  /** Aucune fonction pour obtenir un jeton : voir l'en-tête. */
  credentials: { kind: 'cookie' },
  assertPath: assertStaffPath,
});

/**
 * Les cinq verbes. Les chemins s'écrivent SANS `/admin` : le client le pose.
 *
 *     staffApi.get('/moderation/cases', …)   →  GET /v1/admin/moderation/cases
 *
 * `StaffOnly<P>` refuse `/admin/…` à la compilation, pour que le préfixe ne se
 * retrouve pas écrit deux fois — ce qui ne donnerait qu'un 404 sans cause lisible.
 */
export const staffApi = {
  get<P extends string, S extends z.ZodTypeAny>(
    path: P & StaffOnly<P>,
    schema: S,
    options?: RequestOptions,
  ): Promise<z.infer<S>> {
    return transport.request('GET', path, schema, options);
  },
  post<P extends string, S extends z.ZodTypeAny>(
    path: P & StaffOnly<P>,
    schema: S,
    options?: RequestOptions,
  ): Promise<z.infer<S>> {
    return transport.request('POST', path, schema, options);
  },
  patch<P extends string, S extends z.ZodTypeAny>(
    path: P & StaffOnly<P>,
    schema: S,
    options?: RequestOptions,
  ): Promise<z.infer<S>> {
    return transport.request('PATCH', path, schema, options);
  },
  put<P extends string, S extends z.ZodTypeAny>(
    path: P & StaffOnly<P>,
    schema: S,
    options?: RequestOptions,
  ): Promise<z.infer<S>> {
    return transport.request('PUT', path, schema, options);
  },
  del<P extends string, S extends z.ZodTypeAny>(
    path: P & StaffOnly<P>,
    schema: S,
    options?: RequestOptions,
  ): Promise<z.infer<S>> {
    return transport.request('DELETE', path, schema, options);
  },
} as const;
