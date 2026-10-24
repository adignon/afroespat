import type { FormulaireAnnonceView } from '../services/use-publication';
import type { Moi, Quotas } from '../services/data';

/**
 * S03 — « Publier une annonce » (`/services/logement/nouveau`, 10 §2.1).
 *
 * CET ÉCRAN NE LIT QUE LE BANDEAU ET SON RAPPEL, et il faut le dire plutôt que
 * d'inventer une liaison. Ses champs sont un FORMULAIRE VIDE : « Studio meublé
 * Lyon 7e », « 620 € », « Lyon » sont des exemples de saisie, pas les valeurs d'un
 * objet existant. Les lier à `GET /housing/:id` transformerait l'écran
 * « Publier » en écran « Modifier », que la maquette ne dessine pas.
 *
 * LE FORMULAIRE GRISÉ DE §2.1 MANQUE À LA MAQUETTE, et sa donnée existe pourtant :
 * `GET /housing` rend `meta.canPublish` (relevé `false` avec un membre L0) et
 * `meta.publishRequirement`, qui porte EXACTEMENT la phrase de la carte
 * « PUBLIER · SOUS L2 » de la planche « ÉTATS » de S01. Ce n'est pas un cadre
 * d'écran, et rien ne dit où elle s'insère. Remonté au porteur ; elle n'est pas
 * ajoutée, ce serait réécrire la maquette.
 *
 * `bandeau` est donc le seul champ propre à cet écran — RÈGLE DURE §2.2 : le
 * rappel de non-paiement vient du serveur (`meta.safetyBanner`).
 */
export interface S03Data {
  readonly moi: Moi;
  readonly quotas: Quotas;
  /** Le formulaire (champs, photos, publication) : posé par la page. */
  readonly formulaire: FormulaireAnnonceView;
  readonly publication: {
    readonly bandeau: string;
  };
}

/** Ce que `chargerS03` lit de l'API ; la page y ajoute `formulaire`. */
export type S03Charge = Omit<S03Data, 'formulaire'>;
