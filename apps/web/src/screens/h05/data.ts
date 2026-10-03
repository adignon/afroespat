import type { BandeauEntraide } from '../entraide/data';

/**
 * H05 — ce que ses deux cadres lisent.
 *
 * Voir `../entraide/data` pour les formes partagées, et
 * `tools/screens/05-entraide.mjs` pour les liaisons qui les consomment.
 */
export interface H05Data extends BandeauEntraide {
  /**
   * La ville du filtre, sur LES DEUX cadres — « Lyon » dans la maquette.
   *
   * Même écart que H01 et K01 : `GET /me` ne rend qu'un `cityId`, un UUID, et les
   * deux référentiels qui le résoudraient sont des routes d'ÉQUIPE. Le nom se lit
   * donc sur le profil public de son propre pseudo, que le bandeau charge déjà —
   * aucun aller-retour de plus.
   */
  readonly ville: string;
}
