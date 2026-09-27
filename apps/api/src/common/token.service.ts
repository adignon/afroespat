import { createHmac, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { UserPlan, UserStatus, VerificationLevel } from '@app/shared';
import { loadEnv } from '../config/env';

/**
 * Jeton d'accès — T4 §2.
 *
 * Écrit à la main plutôt qu'avec une bibliothèque : trois fonctions de
 * `node:crypto` suffisent, et c'est une dépendance de moins dans la chaîne
 * d'approvisionnement sur le chemin de l'authentification.
 *
 * Signature ET vérification vivent ICI, ensemble. Les séparer — le service
 * d'auth signe, le garde vérifie de son côté — c'est se garantir qu'un jour
 * l'un des deux changera d'algorithme ou de tolérance sans l'autre.
 */

/** Ce que porte le jeton, et rien de plus (T4 §2). */
export interface AccessClaims {
  readonly sub: string;
  readonly sid: string;
  readonly level: VerificationLevel;
  readonly plan: UserPlan;
  readonly status: UserStatus;
  readonly exp: number;
}

const HEADER = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');

@Injectable()
export class TokenService {
  private readonly secret: string;

  constructor() {
    this.secret = loadEnv().JWT_ACCESS_SECRET;
  }

  sign(claims: AccessClaims): string {
    const body = Buffer.from(JSON.stringify(claims)).toString('base64url');
    return `${HEADER}.${body}.${this.sigFor(`${HEADER}.${body}`)}`;
  }

  /**
   * Rend les revendications, ou `null`. JAMAIS d'exception : un jeton invalide
   * est un cas ordinaire — expiré, tronqué, d'une ancienne clé — et non un
   * incident. C'est au garde de décider de la réponse HTTP.
   */
  verify(token: string): AccessClaims | null {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [head, body, sig] = parts as [string, string, string];

    // On vérifie l'en-tête au lieu de le croire : sans cela, un jeton portant
    // `alg: none` serait accepté dès qu'on cesserait de comparer la signature.
    if (head !== HEADER) return null;

    if (!this.signatureMatches(`${head}.${body}`, sig)) return null;

    let claims: unknown;
    try {
      claims = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    } catch {
      return null;
    }

    if (!isAccessClaims(claims)) return null;
    if (claims.exp * 1000 <= Date.now()) return null;

    return claims;
  }

  private sigFor(signingInput: string): string {
    return createHmac('sha256', this.secret).update(signingInput).digest('base64url');
  }

  /**
   * Comparaison à temps constant. Une comparaison `===` sur une signature laisse
   * fuir, par le temps de réponse, combien d'octets de tête sont corrects — ce
   * qui suffit à la forger octet par octet.
   */
  private signatureMatches(signingInput: string, given: string): boolean {
    const expected = Buffer.from(this.sigFor(signingInput));
    const provided = Buffer.from(given);
    if (expected.length !== provided.length) return false;
    return timingSafeEqual(expected, provided);
  }
}

function isAccessClaims(value: unknown): value is AccessClaims {
  if (typeof value !== 'object' || value === null) return false;
  const c = value as Record<string, unknown>;
  return (
    typeof c['sub'] === 'string' &&
    typeof c['sid'] === 'string' &&
    typeof c['level'] === 'string' &&
    typeof c['plan'] === 'string' &&
    typeof c['status'] === 'string' &&
    typeof c['exp'] === 'number'
  );
}
