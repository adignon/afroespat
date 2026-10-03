/**
 * Données de l'écran A06 — les propositions reçues, et « Proposer une correction ».
 *
 * ── QUATRE CADRES, TROIS PRISES ─────────────────────────────────────────────
 *
 * Les deux cadres d'ORDINATEUR ne lisent que la NAVIGATION : le rail, le panneau
 * de section et les raccourcis. Les deux cadres MOBILES, eux, lisent quatre prises
 * de contenu — voir leur déclaration plus bas.
 *
 * ── CE QUI A CHANGÉ, ET CE QUE CE TEXTE DISAIT DE FAUX ─────────────────────
 *
 * Cet en-tête affirmait que les QUATRE cadres ne lisent que la navigation, et il
 * l'affirmait juste au-dessus d'une interface qui déclare `guide`,
 * `propositionDepliee`, `propositionRepliee` et `propositionsCompte`. Le code
 * disait une chose, sa documentation l'inverse — et c'est précisément ce qui a
 * laissé les deux pages de guides construire un objet incomplet sans que personne
 * ne le voie avant `tsc`.
 *
 * Ce qui RESTE dessiné sur la planche mobile : le passage visé, le remplacement
 * proposé et les trois boutons de décision. Le motif, le proposant et le délai,
 * eux, sont branchés.
 *
 * ── LA LIMITE QUI SUBSISTE, ET ELLE EST STRUCTURELLE ──────────────────────
 *
 * La planche dessine EXACTEMENT DEUX cartes en balisage statique — une dépliée,
 * une repliée — sans `<sc-for>` ni `<sc-if>`. Cet écran ne peut donc représenter
 * ni 0, ni 1, ni 3 propositions : il a deux EMPLACEMENTS, pas une liste. Un
 * emplacement sans proposition reçoit un en-tête vide, jamais les valeurs de la
 * maquette. Remonté : il faut que la planche dise ce qui déplie une carte.
 *
 * Ce qui EST fait : `screens/guides/api.ts` porte les cinq appels de §2.4 —
 * `fetchProposals`, `createProposal`, `acceptProposal`, `amendProposal`,
 * `rejectProposal` — tous validés par les schémas de `@app/shared`, et
 * `from-api.ts` sait déjà composer l'avant/après et le délai restant avant
 * escalade. Le jour où le cadre expose ses prises, il ne reste qu'à les relier.
 */
import { panel, rail, shortcuts } from '../a01/data';

export { panel, rail, shortcuts };

export const panelGuides = panel(1);

/** Ce que les quatre cadres générés de A06 consomment. */
/**
 * LES PRISES DES DEUX CADRES MOBILES DE A06, et la limite de ce qui peut l'être.
 *
 * `guide` sert à la feuille « Proposer une correction » : la PAGE derrière la
 * feuille est le guide, et son titre était écrit en dur — la feuille annonçait
 * donc « Obtenir la garantie Visale sans CDI » quelle que soit la correction
 * proposée.
 *
 * ── POURQUOI DEUX PROPOSITIONS NOMMÉES, ET PAS UNE LISTE ──────────────────
 *
 * La planche « Propositions reçues » dessine DEUX cartes STRUCTURELLEMENT
 * DIFFÉRENTES : la première est dépliée (AVANT / APRÈS / Motif / trois boutons),
 * la seconde est repliée (une ligne de résumé). Ce ne sont pas deux éléments d'une
 * liste, ce sont deux ÉTATS d'affichage, et une boucle devrait choisir l'un des
 * deux dessins — donc mentir sur l'autre. Les deux sont nommées, comme la maquette
 * les dessine, et c'est remonté : il faudrait que la planche dise ce qui déplie
 * une carte.
 *
 * ── CE QUI RESTE DESSINÉ DANS LA CARTE DÉPLIÉE ────────────────────────────
 *
 * Les blocs AVANT et APRÈS. La maquette y dessine un DIFF — le mot retiré barré
 * sur fond gris, les mots ajoutés surlignés en vert — alors que l'API rend deux
 * chaînes nues (`targetExcerpt`, `replacement`). Les lier mettrait le texte entier
 * dans un seul `<span>` et ferait disparaître le diff, c'est-à-dire la seule chose
 * que ces deux blocs servent à montrer. Il faut un composant de différence, pas une
 * prise : remonté.
 */
export interface PropositionEnTeteView {
  readonly i: string;
  readonly bg: string;
  readonly proposant: string;
  /** « 11 j » — le délai avant escalade (§2.4 : `created_at + 14 jours`). */
  readonly delai: string;
  readonly motif: string;
}

export const propositionDepliee: PropositionEnTeteView = {
  i: 'FN',
  bg: '#2FA37D',
  proposant: 'Fatou Ndiaye',
  delai: '11 j',
  motif: 'La validation en ligne est obligatoire depuis 2025.',
};

export const propositionRepliee: PropositionEnTeteView = {
  i: 'KB',
  bg: '#E0733A',
  proposant: 'Kofi Boateng',
  delai: '3 j',
  motif: 'Section 1 · retrait « ou votre contrat de travail »',
};

/**
 * Les compteurs des trois onglets.
 *
 * Ils sont DÉRIVÉS de la liste par statut — `GET /guides/:id/proposals` ne porte
 * aucun `meta` de comptage, vérifié sur `guideProposalsResponseSchema`. « Refusées »
 * n'en porte pas dans la maquette : on ne lui en invente pas un.
 */
export interface PropositionsCompteView {
  readonly attente: number;
  readonly acceptees: number;
}

export const propositionsCompte: PropositionsCompteView = { attente: 2, acceptees: 7 };

/** Le guide que la feuille de correction vise : son titre, et rien de plus. */
export interface GuideCorrigeView {
  readonly title: string;
}

export const guide: GuideCorrigeView = { title: 'Obtenir la garantie Visale sans CDI' };

export interface A06Data {
  rail: typeof rail;
  panelGuides: typeof panelGuides;
  shortcuts: typeof shortcuts;
  guide: GuideCorrigeView;
  propositionDepliee: PropositionEnTeteView;
  propositionRepliee: PropositionEnTeteView;
  propositionsCompte: PropositionsCompteView;
}
