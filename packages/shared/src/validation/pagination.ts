import { z } from 'zod';

/**
 * Pagination par curseur, JAMAIS par décalage (00-fondations.md §5.3).
 *
 * Chaque liste renvoie `{ items, nextCursor }`, nextCursor null en fin de liste.
 * Limite par défaut 20, maximum 50. Le curseur est opaque et signé : le client ne
 * doit ni le lire ni le fabriquer.
 *
 * Pourquoi pas de décalage : sur un fil qui bouge, `offset` saute et répète des
 * lignes. Le curseur s'appuie sur l'identifiant UUID v7, triable chronologiquement.
 */

export const DEFAULT_PAGE_LIMIT = 20;
export const MAX_PAGE_LIMIT = 50;

export const cursorQuerySchema = z.object({
  cursor: z.string().min(1).max(512).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_LIMIT).default(DEFAULT_PAGE_LIMIT),
});

export type CursorQuery = z.infer<typeof cursorQuerySchema>;

export interface Page<T> {
  readonly items: readonly T[];
  /** Null en fin de liste. */
  readonly nextCursor: string | null;
  /**
   * Facultatif (T4 §4) : compteurs, bandeau de sécurité, règle affichée.
   * C'est par là que passent les bandeaux obligatoires — celui de l'entraide et
   * celui du logement sont renvoyés par l'API, pas codés en dur dans le front.
   */
  readonly meta?: Record<string, unknown>;
}

export function emptyPage<T>(meta?: Record<string, unknown>): Page<T> {
  return meta === undefined ? { items: [], nextCursor: null } : { items: [], nextCursor: null, meta };
}

/** Le handle public d'un membre (01-identite.md §2.6). */
export const handleSchema = z
  .string()
  .min(3)
  .max(30)
  .regex(/^[a-z0-9](?:[a-z0-9]|[_-](?![_-]))*[a-z0-9]$/, {
    message:
      'Le pseudo accepte lettres minuscules, chiffres, tiret et souligné, sans commencer par un chiffre ni doubler les séparateurs.',
  })
  .refine((v) => !/^[0-9]/.test(v), {
    message: 'Le pseudo ne peut pas commencer par un chiffre.',
  });

export const uuidSchema = z.string().uuid();

export const slugSchema = z
  .string()
  .min(2)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

/** Montant : entier, en centimes, avec devise ISO 4217 (§4). Jamais de flottant. */
export const moneySchema = z.object({
  amountCents: z.number().int().min(0),
  currency: z.enum(['EUR', 'XOF']),
});

export type Money = z.infer<typeof moneySchema>;
