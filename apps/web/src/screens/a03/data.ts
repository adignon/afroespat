/**
 * Données de l'écran A03 — « Guides & Démarches », la liste.
 *
 * ── POURQUOI CE FICHIER EXISTE ──────────────────────────────────────────────
 *
 * A03 lisait jusqu'ici `AccueilData`, le type partagé par dix-sept écrans. Ce
 * type décrivait ses guides par `typeof guides`, c'est-à-dire par les TROIS
 * cartes d'exemple de la maquette : `cat` n'y était pas `string` mais
 * `'Logement' | 'Titre de séjour' | 'Banque'`, et `updated` valait l'une des
 * trois dates écrites à la main. Aucune donnée venue de l'API ne pouvait
 * satisfaire un tel contrat — non parce qu'elle était mal formée, mais parce que
 * le contrat décrivait un ÉCHANTILLON. C'est le piège relevé sur A01, et il était
 * ici à l'identique.
 *
 * Les prises sont donc DÉCLARÉES : elles disent ce que le JSX transcodé LIT, ni
 * plus ni moins. Les constantes de la maquette les satisfont — c'est vérifié par
 * `satisfies`, donc le dessin reste la référence — et les données de l'API les
 * satisfont aussi. Le JSX n'a pas bougé d'une virgule.
 */
import { panel, rail, shortcuts } from '../a01/data';

export { panel, rail, shortcuts };

/** Le panneau de section, entrée « Guides & Démarches » active (rang 1). */
export const panelGuides = panel(1);

// ─── Constantes de maquette que l'API ne remplit pas ────────────────────────

/**
 * Les trois onglets de §2.3 — « Les plus utiles », « Récents », « À vérifier ».
 *
 * Les COULEURS sont du dessin et restent ici ; l'onglet ACTIF, lui, est un état
 * de la page. `guideTabsFor` prend donc le rang courant, exactement comme
 * `storyFiltersFor` le fait sur A01 : la maquette calcule ses fonds dans son
 * `renderVals()`, on reproduit ce calcul plutôt que de figer un onglet.
 *
 * L'ordre est celui de la spec, et `tab` porte la valeur que l'API attend — de
 * sorte que la page n'ait pas à tenir sa propre table de correspondance.
 *
 * ── `onPick` N'EST PAS ENCORE APPELÉ, ET IL FAUT LE DIRE ────────────────────
 *
 * MESURÉ dans un navigateur : cliquer « À vérifier » ne déclenche AUCUN appel.
 * Le cadre transcodé dessine les trois onglets en `<span>` nus — ni `onClick`, ni
 * `onPick` — parce que la maquette ne les marque pas comme interactifs, là où elle
 * marque « cliquez les contacts » sous la planche de partage de A01. Le
 * transcodeur ne pose un gestionnaire que là où la maquette en annonce un, et
 * c'est la bonne règle : il ne devine pas l'interaction.
 *
 * `onPick` est donc conservé ICI parce que toute la chaîne derrière lui EST
 * branchée et éprouvée — `useGuides(tab)` refait bien l'appel avec `tab=review`,
 * et l'API filtre correctement (vérifié en direct). Il ne manque que le marqueur
 * d'interaction dans la maquette, puis une régénération. C'est du transcodage, pas
 * du branchement, et un `*.generated.tsx` ne se modifie pas à la main.
 *
 * REMONTÉ AU RAPPORT DE LOT. Tant que ce n'est pas fait, la liste s'ouvre sur
 * « Les plus utiles » et n'en change pas.
 */
const TABS = [
  ['Les plus utiles', 'helpful'],
  ['Récents', 'recent'],
  ['À vérifier', 'review'],
] as const;

export type GuideTabKey = (typeof TABS)[number][1];

export const guideTabsFor = (active: number, onPick: (tab: GuideTabKey, index: number) => void) =>
  TABS.map(([label, tab], i) => {
    const on = i === active;
    return {
      label,
      tab,
      bg: on ? '#fff' : 'transparent',
      fg: on ? '#16211D' : '#5D6B66',
      onPick: () => onPick(tab, i),
    };
  });

/** L'onglet de départ : « Les plus utiles », comme la maquette le dessine. */
export const guideTabs = guideTabsFor(0, () => {});

/**
 * Les trois filtres de §2.3. Ce sont des CHAÎNES, pas des objets : le cadre écrit
 * `{f}` directement, suivi d'un chevron dessiné en SVG.
 *
 * Ils ne sont pas branchés : `GET /guides` accepte bien `category`, `countryId` et
 * `cityId`, mais la maquette dessine trois menus déroulants dont elle ne donne
 * aucune option. Les remplir demanderait les référentiels (module 02) et un cadre
 * qui sache les ouvrir — ni l'un ni l'autre n'est dans ce lot. Remonté.
 */
export const guideFilters = ['Catégorie', 'Pays', 'Ville'];

/**
 * « Recherché sans résultat ce mois-ci ».
 *
 * AUCUNE ROUTE NE LE DONNE. Le module de recherche (11) journalise bien les
 * requêtes, mais rien dans 05 §4 ni dans `GET /guides` n'expose les recherches
 * infructueuses. Les valeurs de la maquette restent donc ici, telles quelles, et
 * le manque est remonté au rapport de lot — on ne fabrique pas un chiffre qui
 * a l'air mesuré.
 */
export const missing: readonly MissingQueryView[] = [
  { q: 'CAF étudiant étranger', n: '64' },
  { q: 'Changer de statut étudiant → salarié', n: '51' },
  { q: 'Permis de conduire échange', n: '38' },
  { q: 'Mutuelle pas chère', n: '22' },
];

// ─── LES PRISES DU CADRE, DÉCLARÉES ─────────────────────────────────────────

/**
 * Une carte de guide, telle que le cadre la lit.
 *
 * RÈGLE DURE (05 §9, T1 §6) : `updated` est REQUIS — « date de mise à jour aussi
 * visible que le titre ». Le déclarer facultatif suffirait à ce qu'un convertisseur
 * cesse un jour de le poser sans que `tsc` ne dise rien, et la carte s'afficherait
 * sans date. C'est la seule raison pour laquelle ce champ n'est pas optionnel alors
 * que tous ses voisins d'affichage pourraient l'être.
 *
 * `verify` est le bandeau « À vérifier » de §2.3. Il vient du bandeau `TO_VERIFY`
 * que le SERVEUR calcule, jamais d'un âge recalculé ici : le seuil de 24 mois est
 * une règle métier, et deux implémentations de la même règle divergent toujours.
 *
 * `useful` est un compteur de VOTES d'utilité — jamais de vues (règle dure 00 §49).
 */
export interface GuideCardView {
  readonly title: string;
  readonly updated: string;
  readonly cat: string;
  readonly scope: string;
  readonly author: string;
  readonly i: string;
  readonly bg: string;
  readonly useful: number;
  readonly verify: boolean;
  readonly excerpt: string;
}

/** Une recherche restée sans réponse : la requête et son nombre d'occurrences. */
export interface MissingQueryView {
  readonly q: string;
  readonly n: string;
}

/**
 * Les trois cartes de la maquette.
 *
 * `satisfies` et non `as const` : le tableau garde le type déclaré — donc
 * `cat: string` et non l'union des trois valeurs écrites — tout en étant VÉRIFIÉ
 * contre la prise. Si le cadre se mettait à lire un champ de plus, cette ligne
 * rougirait ici, à la source du dessin, plutôt qu'au premier rendu.
 */
export const guides = [
  {
    title: 'Obtenir la garantie Visale sans CDI',
    updated: 'Mis à jour le 12 mars',
    cat: 'Logement',
    scope: 'Universel',
    author: 'Marc Koudou',
    i: 'MK',
    bg: '#0F5C48',
    useful: 84,
    verify: false,
    excerpt:
      'Visale est une caution gratuite d’Action Logement. Les étudiants de 18 à 30 ans y ont droit dès la validation du VLS-TS. Voici les pièces à préparer, les délais réels observés par les membres et la façon de le présenter au propriétaire pour qu’il l’accepte.',
  },
  {
    title: 'Valider son VLS-TS en ligne',
    updated: 'Mis à jour le 28 février',
    cat: 'Titre de séjour',
    scope: 'Universel',
    author: 'Aïcha Diop',
    i: 'AD',
    bg: '#16785E',
    useful: 132,
    verify: false,
    excerpt:
      'Depuis 2025, la validation du VLS-TS se fait uniquement sur le site de l’ANEF, dans les trois mois après l’arrivée. Le guide détaille chaque écran, la taxe à payer et ce qu’il faut faire si le site refuse votre numéro de visa.',
  },
  {
    title: 'Ouvrir un compte bancaire depuis Cotonou',
    updated: 'Mis à jour le 3 oct. 2025',
    cat: 'Banque',
    scope: 'Bénin',
    author: 'Ibrahim S.',
    i: 'IS',
    bg: '#B4581F',
    useful: 41,
    verify: true,
    excerpt:
      'Plusieurs banques proposent l’ouverture à distance avant le départ. Comparatif des frais, des documents demandés et du délai pour obtenir l’attestation de virement irrévocable exigée par le consulat.',
  },
] satisfies readonly GuideCardView[];

/** Ce que les deux cadres générés de A03 consomment. */
export interface A03Data {
  rail: typeof rail;
  panelGuides: typeof panelGuides;
  shortcuts: typeof shortcuts;
  guideTabs: ReturnType<typeof guideTabsFor>;
  guideFilters: readonly string[];
  guides: readonly GuideCardView[];
  missing: readonly MissingQueryView[];
}
