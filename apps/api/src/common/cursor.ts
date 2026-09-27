import { createHmac, timingSafeEqual } from 'node:crypto';
import { ApiError } from './api-error';

/**
 * Curseurs de pagination — 00-fondations.md §5.3 et T4 §4.
 *
 * « Par curseur, jamais par décalage. Le curseur est opaque et signé. »
 *
 * Opaque : le client ne doit pas savoir ce qu'il contient, sinon il finira par
 * le fabriquer, et la forme interne deviendra un contrat qu'on ne peut plus
 * changer.
 *
 * Signé : sans signature, un client peut forger un curseur et lire des lignes
 * qu'il n'aurait pas dû voir — la clause `WHERE id > ?` ne vérifie rien par
 * elle-même. La signature est comparée en temps constant.
 */

export interface CursorPayload {
  /** Dernier identifiant vu. UUID v7, donc triable chronologiquement. */
  readonly id: string;
  /** Valeur de tri secondaire, quand le tri n'est pas sur l'identifiant. */
  readonly sort?: string | number;
  /** Empreinte des filtres : un curseur ne vaut que pour la requête qui l'a produit. */
  readonly scope: string;
}

function sign(data: string, secret: string): string {
  return createHmac('sha256', secret).update(data).digest('base64url');
}

export function encodeCursor(payload: CursorPayload, secret: string): string {
  const data = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `${data}.${sign(data, secret)}`;
}

/**
 * Décode et VÉRIFIE. Un curseur invalide donne 400, jamais une pagination
 * silencieusement fausse : mieux vaut une erreur claire qu'une liste trouée.
 *
 * `scope` lie le curseur à la requête : changer de filtre en gardant l'ancien
 * curseur produirait des résultats incohérents.
 */
export function decodeCursor(cursor: string, secret: string, scope: string): CursorPayload {
  const parts = cursor.split('.');
  if (parts.length !== 2) throw ApiError.validation([{ path: 'cursor', code: 'MALFORMED' }]);

  const [data, signature] = parts as [string, string];
  const expected = sign(data, secret);

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw ApiError.validation([{ path: 'cursor', code: 'INVALID_SIGNATURE' }]);
  }

  let payload: CursorPayload;
  try {
    payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as CursorPayload;
  } catch {
    throw ApiError.validation([{ path: 'cursor', code: 'MALFORMED' }]);
  }

  if (payload.scope !== scope) {
    throw ApiError.validation([{ path: 'cursor', code: 'SCOPE_MISMATCH' }]);
  }
  return payload;
}

/**
 * Construit une page à partir de `limit + 1` lignes : la ligne excédentaire dit
 * qu'il y a une suite, sans exiger un COUNT(*) qui coûte cher sur un gros fil.
 */
export function buildPage<T extends { id: string }>(
  rows: T[],
  limit: number,
  scope: string,
  secret: string,
  sortOf?: (row: T) => string | number,
): { items: T[]; nextCursor: string | null } {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items.at(-1);

  if (!hasMore || last === undefined) return { items, nextCursor: null };

  const payload: CursorPayload =
    sortOf === undefined
      ? { id: last.id, scope }
      : { id: last.id, sort: sortOf(last), scope };

  return { items, nextCursor: encodeCursor(payload, secret) };
}
