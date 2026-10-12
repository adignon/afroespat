import type { Moi, Quotas } from '../services/data';

/**
 * S01 — « Annonces logement », la liste (`/services/logement`, 10 §7).
 *
 * UN TYPE PAR ÉCRAN : voir l'en-tête de `screens/services/data.ts`. Ce type
 * n'exige que ce que LES DEUX CADRES DE S01 lisent, et il les exige — un type
 * partagé par les dix écrans aurait dû tout rendre facultatif.
 *
 * Les champs viennent de `GET /housing` (+ `GET /me` et `GET /me/subscription`
 * pour le bandeau d'ordinateur) ; `screens/services/appels.ts` dit comment.
 */
export interface S01Data {
  readonly moi: Moi;
  readonly quotas: Quotas;
  readonly liste: {
    /** `meta.total` — le compte de la RECHERCHE, pas celui de la page. */
    readonly total: number;
    /** La ville cherchée, ou « France » quand aucun filtre de ville n'est posé. */
    readonly ville: string;
    /**
     * RÈGLE DURE 10 §2.2 — le bandeau de non-paiement, de `meta.safetyBanner`.
     *
     * Il vient du SERVEUR et pas d'une constante du front : §2.2 en fait une règle
     * dure (« renvoyé par l'API sur chaque liste et chaque annonce »), et un texte
     * que le front possède est un texte qu'un déploiement front peut faire
     * disparaître sans que personne ne s'en aperçoive.
     */
    readonly bandeau: string;
    readonly annonces: readonly CarteAnnonce[];
  };
}

/**
 * Une carte d'annonce, telle que la maquette la dessine.
 *
 * `fond` est une COULEUR, et c'est une donnée parce que la maquette donne un fond
 * différent à chaque avatar de sa liste — six teintes, cyclées par rang. Aucune
 * n'est assombrie : ce sont celles de `06 Services`, relevées sur ses planches.
 *
 * `prix` est une CHAÎNE déjà mise en forme : l'API rend `priceCents` (un entier,
 * règle 00 §4) et `currency`, et `Intl` fait le reste dans `appels.ts`. Un nombre
 * nu ici aurait laissé le JSX transcodé décider d'un format, ce qu'il ne sait pas
 * faire — et « Gratuit » n'est pas un nombre.
 */
export interface CarteAnnonce {
  /**
   * L'ADRESSE DU DÉTAIL, ou absente.
   *
   * Le porteur, après avoir vu les gestes revenir sur la carte du fil : « c'est
   * bon aussi pour les autres ? » Non : mesuré au navigateur, ces cartes ne
   * menaient nulle part, même sur leur propre page. Elles portent maintenant
   * leur adresse, et `CadreCliquable` rend un `<div>` quand elle manque — ce qui
   * est le cas des cartes DESSINÉES par la maquette, qui n'ont pas d'identifiant.
   */
  readonly href?: string;

  /** Le kind (§2.1) dans les mots de la maquette : « Location », « Colocation »… */
  readonly genre: string;
  readonly titre: string;
  /** « 620 € », ou « Gratuit » quand `priceCents` est `null` (TEMPORARY, §2.1). */
  readonly prix: string;
  /** « Meublé · 1er oct. · 12 mois » — composée des champs réels de la réponse. */
  readonly detail: string;
  readonly fond: string;
  readonly initiales: string;
  readonly auteur: string;
}
