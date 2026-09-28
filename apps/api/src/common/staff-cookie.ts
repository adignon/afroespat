import type { CookieOptions, Response } from 'express';
import { STAFF_SESSION_COOKIE, STAFF_SESSION_HOURS } from '@app/shared';
import { loadEnv } from '../config/env';

/**
 * Le cookie de session d'équipe — 15-administration.md §2.1.
 *
 * RÈGLE DURE (§2.1, 00 §7.4) : les comptes équipe et les comptes membres sont
 * HERMÉTIQUES. Ce fichier est l'une des trois pièces qui le rendent vrai, et la
 * plus concrète : le cookie porte un NOM DIFFÉRENT (`dp_staff` contre
 * `dp_refresh`) et un CHEMIN DIFFÉRENT (`/v1/admin` contre `/v1/auth`). Un
 * navigateur n'envoie donc jamais l'un là où l'autre est attendu, et une
 * confusion de domaine ne peut pas venir d'un accident de transport.
 *
 * `SameSite=Strict`, que §2.1 exige explicitement — et qui va de soi ici :
 * l'application admin n'a aucune navigation entrante légitime. Un `Lax` laisserait
 * le cookie partir sur un lien externe pointant l'admin, ce qui n'a aucune
 * contrepartie utile et ouvre une surface CSRF sur les seules routes qui
 * comptent vraiment.
 *
 * Le contenu du cookie est un secret opaque de 32 octets, dont seul le HACHAGE
 * est en base (`staff_sessions.token_hash`). Ce n'est PAS un JWT : un jeton
 * d'équipe n'a aucune revendication portable, et il n'existe donc rien à
 * présenter ailleurs. `TokenService.verify()` le rejette par construction —
 * il n'a ni les trois parties ni l'en-tête attendu.
 */

const STAFF_COOKIE_PATH = '/v1/admin';

function options(): CookieOptions {
  const env = loadEnv();
  return {
    httpOnly: true,
    // `secure` hors développement seulement : en local on sert en http, et un
    // cookie `secure` y serait ignoré sans le moindre message.
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: STAFF_COOKIE_PATH,
  };
}

export function setStaffCookie(response: Response, token: string): void {
  response.cookie(STAFF_SESSION_COOKIE, token, {
    ...options(),
    // Borne du navigateur alignée sur la borne absolue du serveur (§2.1, 8 h).
    // L'inactivité de 30 min, elle, est tenue côté serveur : un cookie ne sait
    // pas quand on a cessé de s'en servir.
    maxAge: STAFF_SESSION_HOURS * 3_600_000,
  });
}

/** Les attributs doivent être IDENTIQUES à la pose, chemin compris, sinon rien n'est effacé. */
export function clearStaffCookie(response: Response): void {
  response.clearCookie(STAFF_SESSION_COOKIE, options());
}

export { STAFF_COOKIE_PATH };
