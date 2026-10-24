import type { Onglet } from '../services/navigation';
import type { Moi, Quotas } from '../services/data';

/**
 * S06 — « Annuaire professionnel » (`/services/annuaire`, 10 §4.2).
 *
 * Les champs viennent de `GET /pros`, et la TÊTE MISE EN AVANT est un champ À
 * PART de `items`, qui l'exclut. C'est la charge relevée qui l'a appris : un
 * schéma écrit sur `pageSchema(card)` seul aurait accepté la réponse, et l'écran
 * aurait perdu les deux fiches signalées — donc la mention « Fiche mise en
 * avant », donc la règle dure du §4.2 — en silence.
 *
 * ── RÈGLE DURE 10 §4.1 : AUCUN TÉLÉPHONE ───────────────────────────────────
 *
 * Aucun champ de ce type n'est un numéro, et ce n'est pas une promesse : la
 * réponse n'en porte aucun, et `proCardSchema` est `.strict()` — une réponse qui
 * en porterait un est REFUSÉE avant d'atteindre cet écran, au lieu d'être
 * dépouillée en silence par zod.
 *
 * `contactsPro` n'est PAS dans ce type : « 2 contacts sur 3 ce mois-ci » lit le
 * MÊME `quotas` que la barre latérale. §4.4 ne compte qu'un quota, et deux sources
 * pour un seul compteur finiraient par ne plus dire la même chose.
 */
export interface S06Data {
  readonly moi: Moi;
  readonly quotas: Quotas;
  readonly onglets: readonly Onglet[];
  readonly annuaire: {
    /** La recherche en cours (`?q=`). */
    readonly recherche: string;
    /** Les puces de métier : des liens `?q=`. */
    readonly metiers: readonly Onglet[];
    /**
     * LA VILLE FILTRÉE (lot E2) : l'identifiant retenu par `?ville=`, ou `''` pour
     * « Toutes les villes ». La case « Lyon » de la maquette était le nom d'une ville
     * d'exemple, écrit en dur ; c'est désormais une liste des villes du référentiel
     * (`GET /places/cities`) qui filtre `GET /pros?cityId=`.
     */
    readonly ville: string;
    /** Les villes proposées : `valeur` est l'identifiant, `''` pour « Toutes ». */
    readonly villes: readonly { readonly valeur: string; readonly libelle: string }[];
    /** La tête mise en avant d'abord (au plus deux, §4.2), puis le classement naturel. */
    readonly fiches: readonly CarteFiche[];
  };
}

/**
 * Une fiche de l'annuaire, dans l'un des DEUX cadres que la maquette dessine.
 *
 * `enAvant` et `ordinaire` sont deux booléens EXCLUSIFS, et non un seul avec sa
 * négation, parce que le dialecte de la maquette n'a pas de `else` : chaque
 * variante dessinée vit sous son propre `<sc-if>`. Les deux sont gardées — en
 * garder une seule aurait soit collé la mention à toutes les fiches, soit effacé
 * la règle du §4.2.
 */
export interface CarteFiche {
  /** `/services/annuaire/:id` — la fiche. */
  readonly href: string;
  /**
   * L'ADRESSE DU PROFIL PUBLIC — `/@handle`, ou absente.
   *
   * Le porteur : « ajoute l'accès au profil public d'un utilisateur […] partout
   * où le nom est affiché ». Les noms dessinés dans les cadres étaient des
   * `<span>` et aucun ne menait au profil.
   *
   * FACULTATIVE : le cadre ne pose le lien que si la ligne porte une adresse.
   * Sans elle, le nom reste nu — exactement le dessin d'avant.
   */
  readonly profil?: string;
  readonly enAvant: boolean;
  readonly ordinaire: boolean;
  /** `featuredLabel` — « Fiche mise en avant », écrit par le SERVEUR (§4.2). */
  readonly mention: string;
  readonly fond: string;
  readonly initiales: string;
  readonly nom: string;
  /** `profession.nameFr` du référentiel, ou le nom commercial quand il y en a un. */
  readonly metier: string;
  /** « Lyon, Villeurbanne · Français, Peul » — villes couvertes et langues. */
  readonly lieux: string;
  /** `recommendationCount` (§4.3). */
  readonly recos: number;
}
