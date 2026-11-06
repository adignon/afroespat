import { isIP } from 'node:net';
import type { Request } from 'express';

/**
 * L'IP du client — LA SEULE lecture de l'adresse d'une requête (limites de débit, audit, preuve de consentement).
 *
 * Elle s'appuie sur `request.ip`, que Express déduit de `X-Forwarded-For` selon `app.set('trust proxy', N)`
 * (voir `main.ts`, variable `TRUST_PROXY_HOPS`, 1 derrière Caddy) : Express retire N relais par la DROITE de la liste,
 * donc une valeur forgée par le client — placée à gauche — n'est jamais prise. Lire soi-même la première entrée de
 * l'en-tête (ce que faisaient trois endroits) laissait n'importe qui choisir son adresse et contourner la limite.
 *
 * Résultat validé par `net.isIP` : une valeur qui n'est pas une adresse rend `null`. Les IPv4 mappées en IPv6
 * (`::ffff:1.2.3.4`) sont ramenées en IPv4, forme que comprennent les comparaisons de CIDR et `audit_logs.ip` (inet).
 */
export function clientIp(request: Pick<Request, 'ip'>): string | null {
  const raw = request.ip;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  const ip = trimmed.toLowerCase().startsWith('::ffff:') && isIP(trimmed.slice(7)) === 4 ? trimmed.slice(7) : trimmed;
  return isIP(ip) === 0 ? null : ip;
}
