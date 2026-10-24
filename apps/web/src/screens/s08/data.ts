import type { FormulaireFicheProView } from '../services/use-ma-fiche-pro';
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
/**
 * L'offre Pro telle que la planche la dessine, et telle que `GET /plans` la rend.
 *
 * Elle ne décrit PAS la fiche du membre — c'est le PLAN. Le raisonnement ci-dessus
 * interdit de lier les champs du formulaire ; il n'interdit pas de lire le tarif
 * qu'on propose au membre, et le figer serait le défaut inverse : la table `plans`
 * se modifie depuis l'administration (`PATCH /admin/plans/:code` porte `priceCents`
 * et `nameFr`), donc un « 9 €/mois » écrit en dur mentirait au premier changement.
 *
 * ÉCART SIGNALÉ : « Badge Pro, 10 villes » reste DESSINÉ. `planLimitsSchema` porte
 * `multiCity` et `featuredInDirectory`, deux booléens, et aucun champ ne dit
 * « dix ». Il faudrait un `maxCities` dans les limites du plan — ou retirer le
 * nombre de la planche. Même chose pour « statistiques », que la planche
 * d'ordinateur ajoute sans qu'aucun champ ne l'autorise.
 */
export interface OffrePro {
  readonly nom: string;
  readonly prix: string;
}

export interface S08Data {
  readonly moi: Moi;
  readonly quotas: Quotas;
  /** Le formulaire de la fiche pro : posé par la page. */
  readonly formulaire: FormulaireFicheProView;
  readonly offrePro: OffrePro;
}

/** Ce que `chargerS08` lit de l'API ; la page y ajoute `formulaire`. */
export type S08Charge = Omit<S08Data, 'formulaire'>;
