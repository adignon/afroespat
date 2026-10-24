import type { VivantFichePro } from '../services/use-fiche-pro';
import type { Moi, Quotas } from '../services/data';

/**
 * S07 — une fiche pro (`/services/annuaire/:id`, 10 §4.4).
 *
 * Les champs viennent de `GET /pros/:id`.
 *
 * ── RÈGLE DURE 10 §4.1 : LE TÉLÉPHONE N'EST JAMAIS AFFICHÉ ──────────────────
 *
 * « Le téléphone n'est JAMAIS stocké ici ni affiché ; "sur demande" signifie que
 * le pro le communique lui-même en message. »
 *
 * La règle tenait par le DESSIN tant que cet écran lisait la maquette — elle n'y
 * écrit aucun numéro, et le transcodage ne réécrit rien. Elle ne tient plus par le
 * dessin dès que les champs viennent du réseau. Le rempart est donc à DEUX étages,
 * comme pour K04 :
 *
 *   · `proDetailResponseSchema` ne DÉCRIT aucun champ de numéro — il n'y a rien à
 *     lire, et donc rien à oublier de ne pas afficher ;
 *   · il est `.strict()`, donc une réponse qui en porterait un est REFUSÉE à la
 *     frontière. Sans `.strict()`, zod le dépouillerait en silence : l'écran ne
 *     l'afficherait pas aujourd'hui, et personne n'apprendrait que le serveur a
 *     commencé à l'envoyer — jusqu'au jour où quelqu'un ajoute la ligne qui le lit.
 *
 * Aucun champ de ce type n'est un numéro. `contactMethod` est un CANAL, pas un
 * instrument, et il n'est même pas affiché par cette planche.
 *
 * ── LE QUOTA VIENT DU SERVEUR ──────────────────────────────────────────────
 *
 * `contactsRestants` et `quotaCourt` dérivent de `contactQuota`, que le serveur
 * calcule (§4.4 : « 3 contacts distincts par mois en gratuit », illimité en
 * Premium, et « recontacter un pro déjà contacté ce mois-ci ne consomme pas »).
 * Le recalculer ici demanderait de relire le plan du membre — ce que le socle
 * interdit — et afficherait « 1 sur 3 » à un Premium illimité.
 */
export interface S07Data {
  readonly moi: Moi;
  readonly quotas: Quotas;
  /** Contacter, recommander, signaler : posé par la page. */
  readonly vivant: VivantFichePro;
  readonly pro: {
    readonly id: string;
    readonly estMienne: boolean;
    /** Le serveur dit si recommander est permis (un contact existe, §4.3). */
    readonly peutRecommander: boolean;
    readonly initiales: string;
    readonly nom: string;
    /** `tier` — le palier EFFECTIF (§4.1) : `FREE` dès que l'abonnement est échu. */
    readonly palier: string;
    readonly metier: string;
    /** Les villes couvertes (1 à 10, §4.1), telles que le référentiel les nomme. */
    readonly villes: string;
    readonly description: string;
    /** `priceHint` — tarifs indicatifs, texte libre saisi par le pro. */
    readonly tarif: string;
    readonly langues: string;
    readonly recos: number;
    /** `mutualConnectionCount` (§7), calculé par le serveur. */
    readonly contactsCommuns: number;
    /** Le plafond du mois, de `contactQuota.max` — « illimité » quand il est `null`. */
    readonly contactsRestants: string;
    /** « 1/3 », la forme courte du bouton mobile. */
    readonly quotaCourt: string;
    readonly recommandations: readonly Recommandation[];
  };
}

/** Une recommandation reçue (§4.3 : « affichées avec le handle du recommandeur »). */
export interface Recommandation {
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
  readonly fond: string;
  readonly initiales: string;
  readonly nom: string;
  /** Le commentaire, entre guillemets comme la maquette l'écrit. */
  readonly mot: string;
}

/** Ce que `chargerS07` lit de l'API ; la page y ajoute `vivant`. */
export type S07Charge = Omit<S07Data, 'vivant'>;
