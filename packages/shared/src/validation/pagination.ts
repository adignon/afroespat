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

/**
 * L'enveloppe de liste, en SCHÉMA — de quoi valider une réponse à la frontière.
 *
 * `Page<T>` ci-dessus est un TYPE : il décrit ce que l'API promet, et il ne
 * vérifie rien à l'exécution. Un client qui écrit `await res.json() as Page<City>`
 * sur une réponse qui a changé de forme obtient un objet dont `items` est
 * `undefined`, et le défaut ne se voit qu'au premier `.map` — plusieurs appels
 * plus loin, dans un composant qui n'a rien fait de mal. D'où ce constructeur :
 * `pageSchema(citySchema)` rend un schéma qui REFUSE cette réponse, à l'endroit
 * où elle arrive.
 *
 * `nextCursor` est requis et nullable, pas facultatif : §5.3 dit « null en fin de
 * liste », donc une réponse sans le champ est une réponse cassée, et l'accepter
 * ferait prendre une pagination muette pour une fin de liste — le fil s'arrêterait
 * sans raison visible.
 *
 * `meta` reste un enregistrement libre (T4 §4) : c'est par là que passent les
 * bandeaux obligatoires et les compteurs, dont la forme varie par route. Le module
 * qui en dépend le resserre chez lui avec `pageSchema(item).extend({ meta: … })`.
 */
export function pageSchema<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    items: z.array(item),
    nextCursor: z.string().nullable(),
    meta: z.record(z.unknown()).optional(),
  });
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
