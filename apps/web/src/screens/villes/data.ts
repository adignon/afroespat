import type { AccueilData, CityHeadView } from '../accueil/data';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ VILLES ET MEMBRES (A11) ET FICHE VILLE (A12, A12C, A12T) — DONNÉES VIVANTES ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Ces écrans étaient ENTIÈREMENT en démonstration : `accueilData()` leur servait
 * « Lyon · 1 400 membres », trois bons plans, deux commerces et un `<iframe>` vers
 * `Carte Villes.html`, qui renvoie 404 — et qui chargeait OpenStreetMap sans qu'aucune
 * règle ne l'autorise. Depuis, le porteur a TRANCHÉ (09 §14) : l'affichage de tuiles OSM est
 * autorisé, le géocodage ne l'est toujours pas ; voir `components/carte-osm.tsx`.
 *
 * Les cadres sont toujours ceux de la maquette (`CityHeadView`, `MembreAnnuaire`,
 * `budgets`, `arrivals`… gardent leurs formes), mais leurs valeurs viennent de
 * `/cities/*`, `/members` et `/tips/*` (voir `from-api.ts`). Ce qui s'y ajoute — des
 * gestes (voter, signaler, saluer, contribuer, supprimer) et ce que la maquette ne
 * dessine pas (le nom d'un réseau, un lien) — vit dans `vivant`.
 *
 * `VilleData` ÉTEND `AccueilData` plutôt que de le remplacer : les cadres de ces
 * sections sont déclarés sur ce type (voir `tools/screens/03-accueil.mjs`), et les
 * prises qu'ils lisent (`panelVilles`, `rail`, `ville`, `arrivals`…) y gardent leur
 * nom. Seules les prises RÉELLES sont resserrées ci-dessous, pour que l'adaptation
 * puisse lire `t.id` ou `b.mine` sans point d'interrogation.
 */

/** Ce que toute contribution porte en plus du dessin : de quoi la voter, la signaler, la retirer. */
export interface Vivante {
  readonly id: string;
  readonly votedByMe: boolean;
  readonly mine: boolean;
  /** `/@handle` de l'auteur, ou absent (compte supprimé). */
  readonly profil?: string;
}

export interface TipVivant extends Vivante {
  readonly cat: string;
  readonly titre: string;
  readonly texte: string;
  readonly i: string;
  readonly bg: string;
  readonly auteur: string;
  readonly sous: string;
  readonly utileBg: string;
  readonly utileFg: string;
  readonly utiles: number;
}

export interface LieuVivant extends Vivante {
  readonly nom: string;
  readonly adresse: string;
  readonly tags: readonly string[];
  readonly texte: string;
  readonly i: string;
  readonly bg: string;
  readonly auteur: string;
  readonly sous: string;
  readonly utileBg: string;
  readonly utileFg: string;
  readonly utiles: number;
}

export interface TemoignageVivant extends Vivante {
  readonly texte: string;
  readonly parcours: string;
  readonly i: string;
  readonly bg: string;
  readonly auteur: string;
  readonly sous: string;
  readonly utileBg: string;
  readonly utileFg: string;
  readonly utiles: number;
}

export interface BudgetVivant extends Vivante {
  /** Le libellé de la ligne (« Chambre en coloc »). */
  readonly l: string;
  /** « 480 € ». */
  readonly v: string;
  /** Le nombre de membres qui l'ont trouvée utile. */
  readonly u: number;
}

export interface ArrivantVivant {
  readonly i: string;
  readonly name: string;
  readonly sub: string;
  readonly bg: string;
  readonly profil?: string;
  /** Le pseudo à qui écrire (« Saluer »). */
  readonly handle: string | null;
}

export interface EvenementVille {
  readonly d: string;
  readonly m: string;
  readonly t: string;
  readonly s: string;
  readonly href: string;
}

export interface BarrePays {
  readonly c: string;
  readonly w: string;
  readonly n: string;
}

/** Les gestes d'une liste de contributions (A12, A12T). */
export interface GestesContributions {
  readonly occupe: boolean;
  /** « Utile » : pose ou retire mon vote. Le serveur dit le nouveau compteur. */
  readonly onVoter: (id: string, aVote: boolean) => void;
  readonly onSignaler: (id: string) => void;
  readonly onSupprimer: (id: string) => void;
  /** « Saluer » un nouvel arrivant. */
  readonly onSaluer: (handle: string) => void;
}

/** Le formulaire de contribution (A12C), tel que ses trois planches le lisent. */
export type TypeContribution = 'TIP' | 'SHOP' | 'BUDGET' | 'TESTIMONY';

export interface LigneBudgetSaisie {
  readonly libelle: string;
  readonly montant: string;
}

export interface ContributionView {
  /** Toujours vrai : l'ouverture de la fenêtre est l'affaire de l'écran (`Modal`). */
  readonly ouverte: boolean;
  readonly type: TypeContribution;
  readonly onType: (type: TypeContribution) => void;
  readonly titre: string;
  readonly onTitre: (e: { readonly target: { readonly value: string } }) => void;
  readonly texte: string;
  readonly onTexte: (e: { readonly target: { readonly value: string } }) => void;
  readonly lieu: string;
  readonly onLieu: (e: { readonly target: { readonly value: string } }) => void;
  readonly adresse: string;
  readonly onAdresse: (e: { readonly target: { readonly value: string } }) => void;
  readonly lignes: readonly LigneBudgetSaisie[];
  readonly onLigne: (rang: number, champ: 'libelle' | 'montant', valeur: string) => void;
  readonly onAjouterLigne: () => void;
  readonly onPublier: () => void;
  readonly bloque: boolean;
  readonly occupe: boolean;
  readonly echec: string;
  /** Ordinateur : l'étape 1 choisit le genre, l'étape 2 le remplit (la feuille mobile fait les deux). */
  readonly etape: 'type' | 'detail';
  readonly onContinuer: () => void;
  readonly onRetour: () => void;
  /** Le titre de l'étape 2 : « Bon plan », « Produit du pays », « Budget réel », « Témoignage ». */
  readonly titreEtape: string;
  /** Remet le formulaire à son début (à la fermeture de la fenêtre). */
  readonly reinitialiser: () => void;
  /** Les bornes lues sur `createCityTipSchema` et `CITY_TIP_MAX_BODY`. */
  readonly max: Readonly<Record<TypeContribution, number>>;
}

/** L'en-tête, tel que la fiche ET les quatre planches d'onglet l'écrivent. */
export interface EnteteVivant extends CityHeadView {
  /** La médiane des budgets, « 1 050 € », ou `null` quand personne n'a contribué. */
  readonly mediane: string | null;
  /** « 38 contributions » sous la médiane. */
  readonly medianeSous: string;
  /** `/reseaux/:slug` du réseau de la ville, ou `null` (une ville peut ne pas en avoir). */
  readonly reseauHref: string | null;
}

export interface VilleVivante {
  readonly entete: EnteteVivant;
  readonly gestes: GestesContributions;
  readonly contribution: ContributionView;
  /** La phrase d'un onglet sans contribution — selon l'onglet. */
  readonly videTips: string;
}

/**
 * LE CHROME EST STATIQUE, ET C'EST VOULU : le rail, le panneau de section et les
 * raccourcis sont de la navigation (`panel('Villes & Membres')`), pas de la donnée.
 * Ils viennent de `accueil/data.ts`, comme sur les autres écrans du dépôt, et la
 * colonne de gauche vivante (raccourcis, avancement) est du ressort d'un autre lot.
 */
type Chrome = Pick<AccueilData, 'rail' | 'panelVilles' | 'shortcuts'>;

export type VilleData = Chrome & {
  readonly cityTabs: AccueilData['cityTabs'];
  readonly cityPills: AccueilData['cityPills'];
  readonly ville: EnteteVivant;
  readonly budgets: readonly BudgetVivant[];
  readonly arrivals: readonly ArrivantVivant[];
  readonly events: readonly EvenementVille[];
  readonly countryBars: readonly BarrePays[];
  readonly cityTips: readonly TipVivant[];
  readonly cityPlaces: readonly LieuVivant[];
  readonly cityStories: readonly TemoignageVivant[];
  readonly vivant: VilleVivante;
};

// ─── A11 ─────────────────────────────────────────────────────────────────────

export type VueVilles = 'carte' | 'annuaire';

export interface PointCarte {
  readonly id: string;
  readonly slug: string;
  readonly nom: string;
  readonly region: string | null;
  readonly latitude: number;
  readonly longitude: number;
  /** `null` sous le seuil de confidentialité (09 §2.1) : « moins de 3 ». */
  readonly compte: number | null;
  readonly souslesSeuil: boolean;
}

export interface MembreVivant {
  readonly i: string;
  readonly name: string;
  readonly sub: string;
  readonly bg: string;
  readonly help: boolean;
  readonly skills: readonly string[];
  readonly profil?: string;
  readonly handle: string | null;
}

export interface FiltreVivant {
  readonly label: string;
  readonly bg: string;
  readonly fg: string;
  readonly bd: string;
  /** Les options du filtre quand il en a (pays, phase), sinon `null` : il bascule. */
  readonly options: readonly { readonly valeur: string; readonly libelle: string }[] | null;
  readonly valeur: string;
  readonly onChange: (valeur: string) => void;
}

export interface VillesVivantes {
  /** La vue réellement montrée à cette largeur (les défauts diffèrent : voir `useVilles`). */
  readonly vue: VueVilles;
  readonly hrefCarte: string;
  readonly hrefAnnuaire: string;
  readonly pays: string;
  readonly paysOptions: readonly { readonly valeur: string; readonly libelle: string }[];
  readonly onPays: (valeur: string) => void;
  readonly points: readonly PointCarte[];
  readonly seuil: number;
  readonly annuaire: readonly MembreVivant[];
  readonly filtres: readonly FiltreVivant[];
  readonly aPlus: boolean;
  readonly onPlus: () => void;
  readonly chargement: boolean;
  readonly echec: string;
  readonly onSaluer: (handle: string) => void;
  /** Ma ville : son cercle est terre cuite sur la carte. */
  readonly maVilleId: string | null;
}

export type VillesData = Chrome & {
  readonly dirFilters: readonly FiltreVivant[];
  readonly directory: readonly MembreVivant[];
  readonly vivant: VillesVivantes;
};
