/**
 * Données de l'écran A04 — la lecture d'un guide, vue LECTEUR et vue AUTEUR.
 *
 * ── CE QUE LE CADRE EXPOSE, ET CE QU'IL NE PEUT PAS EXPOSER ─────────────────
 *
 * Il faut le dire d'emblée, parce que c'est la limite du lot et non un oubli :
 * le CORPS du guide, son titre, sa catégorie et sa ligne « Mis à jour le … » sont
 * du BALISAGE STATIQUE dans la maquette. Le transcodeur les a donc écrits en dur
 * dans `*.generated.tsx`, et ces fichiers ne se modifient pas à la main — la
 * régénération les effacerait.
 *
 * Les seules prises que le cadre lit vraiment sont les trois ci-dessous :
 * `contributors`, `guideActions` et `versions`. Elles SONT branchées sur l'API.
 * Le reste demande que la maquette pose des marqueurs de données, ce qui est un
 * travail de transcodage — remonté au rapport de lot plutôt que contourné en
 * modifiant un fichier généré.
 */
import { panel, rail, shortcuts } from '../a01/data';

export { panel, rail, shortcuts };

export const panelGuides = panel(1);

// ─── Chemins d'icônes de la maquette ────────────────────────────────────────

const EDIT = 'M4 20h4L19 9l-4-4L4 16z';
const FLAG = 'M5 21V4h12l-2 4 2 4H5';
const ALERT = 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8v5M12 16h.01';

// ─── LES PRISES DU CADRE, DÉCLARÉES ─────────────────────────────────────────

/**
 * Un contributeur, réduit à sa pastille d'avatar : le cadre n'en dessine que les
 * initiales sur un fond. Le NOM n'est pas lu — la maquette écrit « Marc Koudou et
 * 3 contributeurs » en dur à côté de la rangée.
 */
export interface ContributorView {
  readonly i: string;
  readonly bg: string;
}

/**
 * Une action sur le guide : « Proposer une correction », « L'information a
 * changé », « Signaler ».
 *
 * Elles sont TOUJOURS affichées, quel que soit le niveau du membre. §7.3 le veut
 * ainsi : on tente l'action, et le serveur répond `403 LEVEL_REQUIRED` avec de
 * quoi composer l'INVITATION à monter de niveau. Griser le bouton d'après un
 * niveau lu une fois serait la faille de quinze minutes rejouée dans le front —
 * et le membre n'apprendrait même pas ce qui lui manque.
 */
export interface GuideActionView {
  readonly label: string;
  readonly icon: string;
}

/**
 * Une ligne de l'historique (§2.7).
 *
 * `dot` marque la version COURANTE en vert et les autres en gris. La maquette le
 * calcule ainsi, et c'est `meta.currentVersionId` que l'API donne qui tranche —
 * jamais « la première de la liste » : l'historique est trié par numéro
 * décroissant, mais un retour arrière crée une version PLUS RÉCENTE dont le corps
 * est ancien, et la plus haute reste la courante. Les deux coïncident presque
 * toujours, ce qui est exactement ce qui rend l'erreur invisible.
 */
export interface VersionRowView {
  readonly t: string;
  readonly s: string;
  readonly dot: string;
}

/**
 * L'EN-TÊTE DU GUIDE, et pourquoi cette prise n'existait pas.
 *
 * L'en-tête de ce fichier disait, jusqu'à ce lot : « le CORPS du guide, son titre,
 * sa catégorie et sa ligne “Mis à jour le …” sont du BALISAGE STATIQUE dans la
 * maquette. Le transcodeur les a donc écrits en dur ». C'était vrai, et ce n'est
 * plus une fatalité : la clé `donnees` de `tools/screens/03-accueil.mjs` DÉCLARE la
 * prise avec l'écran, là où vivent déjà l'emprunt et le titre, sans toucher ni à la
 * maquette ni aux fichiers générés.
 *
 * Les quatre cadres de A04 affichaient donc « Obtenir la garantie Visale sans CDI »
 * quel que soit le guide demandé. Ce n'est pas un défaut de dessin : c'est l'écran
 * qui mentait sur ce qu'il montre.
 *
 * ── CE QUI RESTE HORS DE PORTÉE, ET POURQUOI ───────────────────────────────
 *
 * Le CORPS du guide reste dessiné. La maquette l'écrit en HTML riche — titres de
 * section, listes, passage surligné, légende d'image, infobulle « Proposer une
 * correction sur ce passage » — alors que l'API rend un seul `body` en Markdown
 * restreint (`currentVersion.body`). Le lier demanderait de RENDRE ce Markdown,
 * c'est-à-dire d'écrire un composant, pas de déclarer une prise. Remonté au
 * porteur : c'est le prochain lot de cet écran, et il est de transcodage.
 *
 * `community` est `maintainedByCommunity`, et il passe sous `<sc-if>` : à faux, le
 * bandeau DISPARAÎT au lieu d'affirmer un entretien communautaire qui n'existe pas.
 *
 * `useful` est `helpfulCount` — un compteur de VOTES d'utilité. Jamais de vues :
 * `guides.view_count` existe en base et la règle dure 00 §49 interdit qu'il sorte ;
 * le schéma `.strict()` de `@app/shared` le refuse à la frontière.
 */
export interface GuideHeadView {
  readonly title: string;
  readonly cat: string;
  readonly scope: string;
  readonly updated: string;
  readonly community: boolean;
  readonly useful: number;
  /**
   * Le NOMBRE de contributeurs, et non `contributors.length` : la rangée de
   * pastilles est TRONQUÉE par le dessin (la maquette en montre quatre sur
   * l'ordinateur et trois sur le mobile) alors que ce compteur est celui que la
   * planche écrit sous « VOUS ÊTES L'AUTEUR ». Les déduire l'un de l'autre ferait
   * afficher « 3 contributeurs » à un guide qui en a douze.
   */
  readonly contributorCount: number;
  /** Les propositions de correction EN ATTENTE (§2.4) — la pastille orange. */
  readonly proposals: number;
}

/** L'en-tête telle que la maquette la dessine, jusqu'à ce que l'API réponde. */
export const guide: GuideHeadView = {
  title: 'Obtenir la garantie Visale sans CDI',
  cat: 'Logement',
  scope: 'Universel',
  updated: 'Mis à jour le 12 mars 2026',
  community: true,
  useful: 84,
  contributorCount: 3,
  proposals: 2,
};

export const contributors: readonly ContributorView[] = [
  { i: 'MK', bg: '#0F5C48' },
  { i: 'AD', bg: '#16785E' },
  { i: 'FN', bg: '#2FA37D' },
  { i: 'IS', bg: '#B4581F' },
];

export const guideActions: readonly GuideActionView[] = [
  { label: 'Proposer une correction', icon: EDIT },
  { label: "L'information a changé", icon: ALERT },
  { label: 'Signaler', icon: FLAG },
];

export const versions: readonly VersionRowView[] = [
  { t: 'Version 6 — Délais mis à jour', s: '12 mars · Marc K.', dot: '#16785E' },
  { t: 'Version 5 — Section propriétaire', s: '2 février · Fatou N.', dot: '#CBD5D1' },
  { t: 'Version 4', s: '10 janvier · Aïcha D.', dot: '#CBD5D1' },
];

/** Ce que les quatre cadres générés de A04 consomment. */
export interface A04Data {
  rail: typeof rail;
  panelGuides: typeof panelGuides;
  shortcuts: typeof shortcuts;
  guide: GuideHeadView;
  contributors: readonly ContributorView[];
  guideActions: readonly GuideActionView[];
  versions: readonly VersionRowView[];
}
