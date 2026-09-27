import type { CookieOptions, Response } from 'express';
import { RATE_LIMITS } from '@app/shared';
import { loadEnv } from '../config/env';

/**
 * Le jeton de rafraîchissement voyage en COOKIE, pas dans le corps JSON — T4 §2
 * et 01-identite.md §4.1 (« Corps : cookie »).
 *
 * C'est la seule différence qui compte en cas de faille XSS : un jeton rendu en
 * JSON finit forcément dans un stockage lisible par JavaScript, donc exfiltrable
 * par n'importe quel script injecté. Un cookie `httpOnly` ne l'est pas. Le jeton
 * d'accès, lui, reste dans le corps : il est court (15 min) et le front doit le
 * poser dans l'en-tête `Authorization`.
 *
 * Le chemin est restreint à `/v1/auth` : le cookie n'est alors envoyé qu'aux
 * quatre routes qui en ont besoin, et non à chaque appel de l'API.
 */

export const REFRESH_COOKIE = 'dp_refresh';

const REFRESH_PATH = '/v1/auth';

function options(): CookieOptions {
  const env = loadEnv();
  return {
    httpOnly: true,
    // `secure` hors développement seulement : en local on sert en http, et un
    // cookie `secure` y serait simplement ignoré — sans le moindre message.
    secure: env.NODE_ENV === 'production',
    // `strict` et non `lax` : aucune navigation de premier niveau n'a besoin de
    // ce cookie, il n'est lu que par un appel de rafraîchissement. `lax` le
    // laisserait partir sur un lien entrant, sans contrepartie utile.
    sameSite: 'strict',
    path: REFRESH_PATH,
  };
}

export function setRefreshCookie(response: Response, token: string): void {
  response.cookie(REFRESH_COOKIE, token, {
    ...options(),
    maxAge: RATE_LIMITS.refreshTokenDays * 86_400_000,
  });
}

/**
 * Efface le cookie. Les attributs doivent être IDENTIQUES à la pose — chemin
 * compris : un `clearCookie` sur un autre chemin ne supprime rien, et la session
 * paraîtrait révoquée côté serveur tout en restant présente côté navigateur.
 */
export function clearRefreshCookie(response: Response): void {
  response.clearCookie(REFRESH_COOKIE, options());
}
