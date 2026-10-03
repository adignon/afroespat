import type { Moi, Quotas } from '../services/data';

/**
 * S02 — une annonce de logement (`/services/logement/:id`, 10 §2.3).
 *
 * Les champs viennent de `GET /housing/:id` (+ le bandeau d'ordinateur).
 *
 * ── RÈGLE DURE 10 §7 : LA TRANCHE, JAMAIS LE SCORE ──────────────────────────
 *
 * `prudenceRenforcee` est un BOOLÉEN, et c'est tout ce que cet écran peut savoir
 * du risque. Il vient de `cautionLevel === 'REINFORCED'`, une énumération à deux
 * valeurs — il n'existe aucun chemin par lequel un nombre pourrait arriver ici :
 * `housingDetailResponseSchema` est `.strict()` et refuse une réponse portant
 * `riskScore` ou `riskFlags`. Le `<sc-if>` du cadre transcodé ne lit que ce
 * booléen, donc l'écran ne PEUT pas afficher un chiffre de risque.
 *
 * ── CE QUE L'API NE DONNE PAS, ET QU'ON NE COMPOSE PAS ──────────────────────
 *
 * Trois valeurs de la planche restent dessinées, et c'est signalé plutôt que
 * deviné :
 *
 *   · la SURFACE (« 24 m² ») et le DÉPÔT (« 1 240 € ») — aucun champ de
 *     `HousingCard`, aucune colonne du schéma figé ;
 *   · « Installée · Lyon 7e » sous le nom de l'auteur, c'est-à-dire sa phase et sa
 *     ville. `HOUSING_SELECT` s'arrête au pseudo, au nom, à l'avatar et au niveau.
 */
export interface S02Data {
  readonly moi: Moi;
  readonly quotas: Quotas;
  readonly annonce: {
    readonly titre: string;
    /** « 620 € », mis en forme par `Intl` depuis `priceCents` et `currency`. */
    readonly prix: string;
    readonly genre: string;
    /** « Lyon 7e · Jean Macé » — la ville et le quartier, jamais une adresse (§8.1). */
    readonly quartier: string;
    readonly disponible: string;
    readonly duree: string;
    readonly description: string;
    readonly initiales: string;
    readonly auteur: string;
    /**
     * « Sarah T. » — le nom ABRÉGÉ, pour le suréacrit de la feuille « Présentez-vous ».
     *
     * La maquette écrit le nom entier sur l'écran et l'abrège dans sa feuille ;
     * c'est la même mise en forme de `author.displayName` que les initiales, pas
     * un second champ de l'API. Un nom d'un seul mot reste entier — « Sarah. »
     * serait une faute de ponctuation, pas une abréviation.
     */
    readonly auteurCourt: string;
    /** « Sarah » — le prénom, pour « Contacter Sarah » et la phrase de pied. */
    readonly prenomAuteur: string;
    /** `photos.length` moins les deux que la maquette dessine en grand. */
    readonly autresPhotos: number;
    /** `mutualConnectionCount` — calculé par le serveur (§7). */
    readonly contactsCommuns: number;
    /** `cautionLevel === 'REINFORCED'` (§2.2, tranche 0,4–0,7). Jamais un score. */
    readonly prudenceRenforcee: boolean;
  };
}
