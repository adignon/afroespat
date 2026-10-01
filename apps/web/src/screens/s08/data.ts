import type { Moi, Quotas } from '../services/data';

/**
 * S08 — « Créer ma fiche pro » (`/services/annuaire/ma-fiche`, 10 §4.1).
 *
 * CET ÉCRAN NE LIT QUE LE BANDEAU, et c'est un choix à défendre plutôt qu'à
 * cacher. `GET /me/pro-profile` existe, son schéma est écrit et éprouvé sur une
 * charge réelle — mais il rend `null` tant que la fiche n'existe pas, et c'est LE
 * CAS PRINCIPAL d'un écran qui s'appelle « Créer ma fiche pro ». La planche, elle,
 * dessine un formulaire REMPLI (« Avocate », « Cabinet Bah », « Consultation dès
 * 80 € ») et ne dessine PAS l'état vide. Lier ses champs viderait l'écran pour
 * tous ceux qui viennent le remplir.
 *
 * DEUX ÉCARTS REMONTÉS AU PORTEUR :
 *
 *   · il manque à la maquette l'état « aucune fiche », que la route rend déjà ;
 *   · `GET /me/pro-profile` rend `tier: "FREE"` et `isFeatured: false` sur une
 *     fiche dont `GET /pros` dit `tier: "PRO"` et `isFeatured: true` — relevé sur
 *     deux charges du MÊME objet, à une seconde d'intervalle.
 *     `ProsService.myProfile` appelle `toCard(rest, userId)` sans son troisième
 *     argument, celui qui porte la mise en avant. Le palier affiché sur « Ma fiche
 *     pro » serait donc faux pour un pro payant : une raison de plus de ne pas
 *     lier ces champs avant correction.
 */
export interface S08Data {
  readonly moi: Moi;
  readonly quotas: Quotas;
}
