import type { BandeauEntraide } from '../entraide/data';

/**
 * H01 — le fil d'entraide (`/entraide`).
 *
 * `ville` est le NOM de la ville du membre, et il ne vient pas de `GET /me` :
 * celui-ci ne rend qu'un `cityId`. Voir `../entraide/appels.ts` pour le chemin
 * réellement emprunté, et l'écart qu'il signale.
 */
export interface H01Data extends BandeauEntraide {
  readonly ville: string;
}
