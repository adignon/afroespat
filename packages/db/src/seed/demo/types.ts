import type { Prisma } from '../../../generated/client/index.js';
import type { Rng } from './prng.js';
import type { CleContenu } from './scellement.js';

export type Tx = Prisma.TransactionClient;

export type Phase = 'PRE_DEPARTURE' | 'RECENT_ARRIVAL' | 'SETTLED';

/** Un membre généré, tel que les autres domaines en ont besoin. */
export interface Membre {
  readonly id: string;
  readonly handle: string;
  readonly displayName: string;
  readonly cityId: string;
  readonly cityName: string;
  readonly citySlug: string;
  readonly countryId: string;
  readonly originIso2: string;
  readonly phase: Phase;
  readonly niveau: 'L1' | 'L2';
  readonly creeLe: Date;
  /** Installé de longue date : peut écrire des guides, parrainer, organiser. */
  readonly ancien: boolean;
}

export interface Ville {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly communauteId: string;
}

export interface Contexte {
  readonly tx: Tx;
  readonly rng: Rng;
  readonly now: Date;
  readonly log: (ligne: string) => void;
  readonly cleContenu: CleContenu | null;
  readonly membres: Membre[];
  readonly villes: Ville[];
  /** Ce qui a été écrit, par domaine, pour le rapport final. */
  readonly compte: Record<string, number>;
  /** Les identifiants à indexer dans la recherche, par type de sujet. */
  readonly aIndexer: { sujet: string; id: string; titre: string; texte: string; cityId: string | null; communityId: string | null }[];
}

export const JOUR = 86_400_000;

/** Un lot de `createMany` : coupe en paquets pour ne pas dépasser la limite de paramètres de Postgres. */
export function paquets<T>(liste: readonly T[], taille = 500): T[][] {
  const sortie: T[][] = [];
  for (let i = 0; i < liste.length; i += taille) sortie.push(liste.slice(i, i + taille));
  return sortie;
}

export const incr = (c: Contexte, cle: string, n = 1): void => {
  c.compte[cle] = (c.compte[cle] ?? 0) + n;
};
