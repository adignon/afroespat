/**
 * Les PRISES de l'écran A07 — « Réseaux », `docs/template/03 Accueil v2.dc.html`.
 *
 * ── DÉCLARÉES, ET NON DÉDUITES D'UN EXEMPLE ────────────────────────────────
 *
 * Les types ci-dessous sont écrits à la main plutôt qu'inférés d'un jeu de
 * données d'exemple, et c'est le point du fichier. Tant que la forme était
 * déduite d'un tableau de démonstration, deux choses passaient inaperçues : un
 * champ que le convertisseur cessait de poser (le JSX recevait `undefined` et
 * dessinait un bouton sans libellé), et un champ que l'exemple portait par
 * hasard. Déclarée, la prise est VÉRIFIÉE : `from-api.ts` est contrôlé contre
 * elle par `tsc`.
 *
 * Les valeurs de repli restent celles de la maquette — elles servent au rendu
 * serveur et aux cadres que personne n'a encore branchés. Elles ne sont PAS des
 * données : dès que l'API répond, `use-reseaux.ts` les remplace.
 */
export { I, chip, panel, panelReseaux, rail } from '../reseaux/chrome';
import { chip, panel, panelReseaux, rail } from '../reseaux/chrome';

// ─── Les prises, déclarées ──────────────────────────────────────────────────

/**
 * Une entrée de « Mes réseaux ».
 *
 * `unread` et `muted` sont écrits sur TOUTES les entrées, `null` et `false`
 * compris : la maquette les omet sur certaines, mais quatre formes d'objet
 * différentes rendraient `n.muted` inaccessible sur l'union. C'est une
 * contrainte du JSX transcodé, pas un choix de données.
 *
 * Aucun des deux n'a de source côté API — aucun compteur de non-lus n'existe, et
 * la colonne `community_members.muted` n'est pas dans le schéma. Ils restent
 * donc neutres, et c'est remonté plutôt que rempli d'un nombre inventé.
 */
export interface MyNetView {
  /**
   * L'ADRESSE DU PROFIL PUBLIC — `/@handle`, ou absente.
   *
   * Le porteur : « ajoute l'accès au profil public d'un utilisateur à partir des
   * publications (quand on clique sur son nom […]) partout où le nom est
   * affiché ». Les trente-sept noms dessinés dans les cadres étaient des `<span>`
   * et aucun ne menait au profil.
   *
   * FACULTATIVE, ET C'EST LA GARDE : tous les noms ne sont pas des membres — un
   * réseau, une ville, un partenaire en portent un aussi — et le cadre ne pose le
   * lien que si la ligne porte une adresse. Sans elle, le nom reste nu, c'est-à-
   * dire exactement le dessin d'avant.
   */
  readonly profil?: string;
  readonly i: string;
  readonly name: string;
  readonly bg: string;
  readonly members: string;
  readonly unread: number | null;
  readonly muted: boolean;
}

/**
 * Une carte de « Découvrir ».
 *
 * `cta`, `btnBg` et `btnFg` portent ENSEMBLE la visibilité du réseau :
 * « Rejoindre » sur fond vert pour un `PUBLIC`, « Demander » sur fond clair pour
 * un `ON_REQUEST`. La couleur n'est pas décorative — les deux gestes n'aboutissent
 * pas au même état.
 *
 * `slug` et `joined` ne sont jamais DESSINÉS : ils voyagent avec la carte parce
 * que la page en a besoin pour ouvrir ou rejoindre, et les transporter à côté,
 * dans un tableau indexé par rang, se désynchroniserait au premier filtre.
 */
export interface DiscoverView {
  /**
   * L'ADRESSE DU PROFIL PUBLIC — `/@handle`, ou absente.
   *
   * Le porteur : « ajoute l'accès au profil public d'un utilisateur à partir des
   * publications (quand on clique sur son nom […]) partout où le nom est
   * affiché ». Les trente-sept noms dessinés dans les cadres étaient des `<span>`
   * et aucun ne menait au profil.
   *
   * FACULTATIVE, ET C'EST LA GARDE : tous les noms ne sont pas des membres — un
   * réseau, une ville, un partenaire en portent un aussi — et le cadre ne pose le
   * lien que si la ligne porte une adresse. Sans elle, le nom reste nu, c'est-à-
   * dire exactement le dessin d'avant.
   */
  readonly profil?: string;
  readonly name: string;
  readonly cat: string;
  readonly desc: string;
  readonly members: string;
  readonly cta: string;
  readonly cover: string;
  readonly btnBg: string;
  readonly btnFg: string;
  readonly slug: string;
  readonly joined: boolean;
}

// ─── Repli de la maquette, jusqu'à ce que l'API réponde ────────────────────

export const netFilters = [chip('Ville', true), chip('Pays'), chip('Intérêt'), chip('Catégorie')];

/** Les quatre filtres de kind, et le rang de celui qui est allumé. */
export const netFiltersFor = (active: number) =>
  ['Ville', 'Pays', 'Intérêt', 'Catégorie'].map((l, i) => chip(l, i === active));

export const myNets: readonly MyNetView[] = [];

export const discover: readonly DiscoverView[] = [];

/**
 * La forme que les deux cadres de A07 reçoivent.
 *
 * Elle est la même pour l'ordinateur et le mobile : le générateur donne à tous
 * les cadres d'un écran la même signature, et c'est ce qui fait qu'un champ
 * ajouté manque d'un coup aux deux plutôt qu'à l'exécution de l'un d'eux.
 */
export interface A07Data {
  rail: typeof rail;
  shortcuts: readonly { name: string; sub: string; i: string; bg: string }[];
  panelReseaux: ReturnType<typeof panel>;
  netFilters: typeof netFilters;
  myNets: readonly MyNetView[];
  discover: readonly DiscoverView[];
}

export const shortcuts: readonly { name: string; sub: string; i: string; bg: string }[] = [];

export const a07Fallback: A07Data = {
  rail,
  shortcuts,
  panelReseaux,
  netFilters,
  myNets,
  discover,
};
