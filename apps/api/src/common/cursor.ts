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


/**
 * LE CAS LE PLUS COURANT : « le plus récent d'abord », paginé honnêtement.
 *
 * POURQUOI CES TROIS FONCTIONS EXISTENT. Cinq routes du dépôt écrivaient
 * `take: query.limit` puis `nextCursor: null` EN DUR — une troncature muette,
 * mesurée à 50 villes rendues sur 65 avec une enveloppe qui affirmait la fin de
 * liste. Les cinq trient par `created_at` décroissant, et les cinq avaient besoin
 * du même prédicat de reprise. Écrit cinq fois, il aurait divergé cinq fois ;
 * écrit une fois, il se relit.
 *
 * LA CLÉ EST UN COUPLE (`created_at`, `id`), et `id` n'est pas décoratif : deux
 * lignes créées dans la même milliseconde — un import, une migration, un seed —
 * ne sont pas départagées par `created_at` seul, et la page les répéterait ou en
 * sauterait une. L'ordre doit être TOTAL pour qu'un curseur situe exactement la
 * reprise.
 *
 * `created_at` VOYAGE EN ISO 8601, pas en millisecondes : la colonne est
 * `timestamptz` et PostgreSQL y garde la microseconde, qu'un entier de
 * millisecondes arrondirait. Arrondi vers le bas, le curseur ferait répéter une
 * ligne ; arrondi vers le haut, il la ferait sauter.
 */

export interface CreatedAtDescResume {
  readonly createdAt: Date;
  readonly id: string;
}

/** Le `sort` du curseur, à passer en dernier argument de `buildPage`. */
export function createdAtDescSort(row: { createdAt: Date }): string {
  return row.createdAt.toISOString();
}

/**
 * Décode un curseur de cette forme. Rend `null` quand il n'y a pas de curseur —
 * première page — et REFUSE un curseur dont la date est illisible plutôt que de
 * reprendre au début en silence.
 */
export function decodeCreatedAtDesc(
  cursor: string | undefined,
  secret: string,
  scope: string,
): CreatedAtDescResume | null {
  if (cursor === undefined) return null;
  const payload = decodeCursor(cursor, secret, scope);
  const iso = typeof payload.sort === 'string' ? payload.sort : '';
  const createdAt = new Date(iso);
  if (iso === '' || Number.isNaN(createdAt.getTime())) {
    throw ApiError.validation([{ path: 'cursor', code: 'MALFORMED' }]);
  }
  return { createdAt, id: payload.id };
}

/**
 * Le prédicat « strictement après le curseur », dans l'ordre
 * `[{ createdAt: 'desc' }, { id: 'desc' }]`.
 *
 * Rendu comme une liste à répandre dans un `AND` : vide sur la première page,
 * d'un seul élément ensuite. Cela évite au point d'appel un `?:` sur toute la
 * clause `where`, qui est exactement l'endroit où l'on se trompe.
 *
 * Le type de retour reste volontairement structurel : `where` est typé par Prisma
 * modèle par modèle, et un type générique commun n'existe pas. Les quatre points
 * d'appel le placent dans leur propre `Prisma.<Modèle>WhereInput[]`, où `tsc`
 * vérifie la forme.
 */
export function createdAtDescAfter(resume: CreatedAtDescResume | null): {
  OR: ({ createdAt: { lt: Date } } | { createdAt: Date; id: { lt: string } })[];
}[] {
  if (resume === null) return [];
  return [
    {
      OR: [
        { createdAt: { lt: resume.createdAt } },
        { createdAt: resume.createdAt, id: { lt: resume.id } },
      ],
    },
  ];
}
