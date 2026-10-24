import type { GestesMesAnnonces } from '../services/use-mes-annonces';
import type { Moi, Quotas } from '../services/data';

/**
 * S09 — « Mes annonces » (`/services/mes-annonces`, 10 §7).
 *
 * DEUX ROUTES : `GET /housing?scope=mine` et `GET /jobs?scope=mine`. `scope=mine`
 * est exactement ce que `housingQuerySchema` prévoit pour cet écran — « l'auteur y
 * voit aussi ses annonces en pause », ce que la liste publique masque.
 *
 * ── RÈGLE DURE 00 §49 : AUCUN COMPTEUR DE VUES ─────────────────────────────
 *
 * « Aucun compteur de vues n'est exposé à personne, sur aucun contenu. » `T5 S09`
 * demande pourtant « compteur de vues et contacts » ; la maquette TRANCHE pour la
 * règle dure, en écrivant dans sa propre légende de route « /services/mes-annonces
 * · aucun compteur de vues ».
 *
 * Le service INCRÉMENTE bien `viewCount` à chaque lecture d'annonce — c'est un
 * compteur interne de modération — et aucune réponse ne le porte. `housingCardSchema`
 * étant `.strict()`, il serait REFUSÉ s'il sortait un jour : la règle ne dépend
 * plus de la vigilance de celui qui écrit le `select`.
 *
 * ÉCART SIGNALÉ AU PORTEUR : « 6 contacts », que la règle AUTORISE, n'existe dans
 * aucun champ de `HousingCard`. `sousTitre` porte donc l'expiration seule, qui est
 * une donnée réelle de la même réponse (`expiresAt`). Composer un nombre de
 * contacts que personne n'a envoyé serait pire qu'un sous-titre plus court.
 */
export interface S09Data {
  readonly moi: Moi;
  readonly quotas: Quotas;
  /** Renouveler, pause, trouvé, supprimer, onglet : posé par la page. */
  readonly gestes: GestesMesAnnonces;
  readonly mesAnnonces: {
    /** `meta.total` de `GET /housing?scope=mine`. */
    readonly logement: number;
    /** Compté sur `items` : `GET /jobs` n'expose aucun `total` (écart signalé). */
    readonly emploi: number;
    readonly liste: readonly LigneAnnonce[];
  };
}

/**
 * Une de mes annonces, dans l'un des états que la maquette dessine.
 *
 * CINQ BOOLÉENS EXCLUSIFS, et non un état en chaîne, parce que le dialecte de la
 * maquette n'a pas de `switch` : chaque variante dessinée vit sous son propre
 * `<sc-if>`. Et il y en a cinq parce que les deux cadres ne dessinent pas les
 * mêmes — l'ordinateur montre « Active », « En vérification », « Trouvé » et
 * « Expirée » avec des jeux d'actions DIFFÉRENTS (quatre puces, deux, une, deux),
 * le mobile montre « Active » et « En pause ». En garder un seul aurait fait
 * proposer « Logement trouvé » sur une annonce expirée.
 *
 * `enVerification` vient de `reviewState === 'UNDER_REVIEW'`, un champ RÉSERVÉ À
 * L'AUTEUR : il vaut `null` pour les autres lecteurs. Les quatre autres viennent
 * de `status`.
 */
export interface LigneAnnonce {
  readonly id: string;
  /** L'onglet où la ligne se range. */
  readonly genre: 'logement' | 'emploi';
  /** La fiche publique de l'annonce. */
  readonly href: string;
  /** Le formulaire de modification (logement seulement : une offre ne se modifie pas ici). */
  readonly hrefModifier: string;
  readonly active: boolean;
  readonly enVerification: boolean;
  readonly trouvee: boolean;
  readonly expiree: boolean;
  readonly enPause: boolean;
  readonly titre: string;
  /** « expire dans 12 jours », de `expiresAt` — jamais un compteur de vues (§49). */
  readonly sousTitre: string;
}

/** Ce que `chargerS09` lit de l'API ; la page y ajoute `gestes`. */
export type S09Charge = Omit<S09Data, 'gestes'>;
