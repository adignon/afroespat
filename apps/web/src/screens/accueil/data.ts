/**
 * Données des écrans A02 à A14 de `docs/template/03 Accueil v2.dc.html`.
 *
 * LA MAQUETTE N'A QU'UN SEUL `renderVals()` pour ses vingt-deux sections. Ce
 * fichier en est la suite : `screens/a01/data.ts` porte déjà tout ce que le fil et
 * ses quatre modales consomment — les icônes, le rail, le panneau, les raccourcis,
 * les événements, les arrivées — et rien n'en est recopié ici. Ce qui manquait est
 * ajouté, dans la même forme et avec les mêmes valeurs, au caractère près.
 *
 * Même séparation qu'en A01 : la FORME est transcodée de la maquette, la DONNÉE et
 * le COMPORTEMENT s'écrivent ici. Au lot 3, ce fichier sera remplacé par des hooks
 * branchés sur `apps/api/src/modules/{feed,guides,communities,cities}` — le JSX
 * généré, lui, ne bougera pas d'une virgule.
 */
import { I, arrivals, events, panel, rail, shortcuts } from '../a01/data';

export { arrivals, events, rail, shortcuts };

/**
 * Les icônes que A01 n'employait pas. Elles vivent ici plutôt que dans `a01/data`
 * pour ne pas toucher un fichier que d'autres écrans consomment déjà ; les onze
 * premières restent là-bas, et rien n'est écrit deux fois.
 */
const PIN = 'M12 17v5M9 3h6l-1 6 4 4H6l4-4z';
const CHAT = 'M4 5h16v11H9l-5 4z';
const LOCK = 'M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3';
const EYE = 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z';
const EDIT = 'M4 20h4L19 9l-4-4L4 16z';
const FLAG = 'M5 21V4h12l-2 4 2 4H5';
const ALERT = 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8v5M12 16h.01';

// ─── Panneaux de section ─────────────────────────────────────────────────────

/**
 * `panel(active)` vient de A01 : la MÊME fonction sert aux quatre panneaux, comme
 * dans la maquette. Les indices sont ceux de sa liste — 1 Guides, 3 Réseaux,
 * 5 Villes & Membres.
 */
export const panelGuides = panel(1);
export const panelReseaux = panel(3);
export const panelVilles = panel(5);
export { panelFil } from '../a01/data';

// ─── Deux fabriques que la maquette définit en tête de son `renderVals()` ────

/** Une pastille de filtre. `on` décide du fond, du texte et de la bordure. */
const chip = (label: string, on = false) => ({
  label,
  bg: on ? '#16785E' : '#fff',
  fg: on ? '#fff' : '#16211D',
  bd: on ? '#16785E' : '#E6EBE9',
});

/** Un onglet. Le soulignement vert marque l'actif ; `transparent` garde sa place. */
const tab = (label: string, on: boolean) => ({
  label,
  w: on ? 700 : 500,
  fg: on ? '#0F5C48' : '#5D6B66',
  bd: on ? '#16785E' : 'transparent',
});

// ═══ A03 · la liste des guides ═══════════════════════════════════════════════

export const guideTabs = [
  { label: 'Les plus utiles', bg: '#fff', fg: '#16211D' },
  { label: 'Récents', bg: 'transparent', fg: '#5D6B66' },
  { label: 'À vérifier', bg: 'transparent', fg: '#5D6B66' },
];

export const guideFilters = ['Catégorie', 'Pays', 'Ville'];

/**
 * `verify` est le bandeau « à vérifier » : la maquette le met sur le guide le plus
 * ancien (octobre 2025). C'est écrit sur les trois, y compris à `false`, pour que
 * les objets aient la même forme — sans quoi `g.verify` devient inaccessible sur
 * l'union, ce que `tsc` refuse sous `exactOptionalPropertyTypes`.
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
];

/** « Recherché sans résultat ce mois-ci » — ce que la communauté ne trouve pas. */
export const missing = [
  { q: 'CAF étudiant étranger', n: '64' },
  { q: 'Changer de statut étudiant → salarié', n: '51' },
  { q: 'Permis de conduire échange', n: '38' },
  { q: 'Mutuelle pas chère', n: '22' },
];

// ═══ A04 · la lecture d'un guide ═════════════════════════════════════════════

export const contributors = [
  { i: 'MK', bg: '#0F5C48' },
  { i: 'AD', bg: '#16785E' },
  { i: 'FN', bg: '#2FA37D' },
  { i: 'IS', bg: '#B4581F' },
];

export const guideActions = [
  { label: 'Proposer une correction', icon: EDIT },
  { label: "L'information a changé", icon: ALERT },
  { label: 'Signaler', icon: FLAG },
];

export const versions = [
  { t: 'Version 6 — Délais mis à jour', s: '12 mars · Marc K.', dot: '#16785E' },
  { t: 'Version 5 — Section propriétaire', s: '2 février · Fatou N.', dot: '#CBD5D1' },
  { t: 'Version 4', s: '10 janvier · Aïcha D.', dot: '#CBD5D1' },
];

// ═══ A05 · l'éditeur de guide ════════════════════════════════════════════════

export const mdTools = ['H', 'B', 'I', '•', '1.', 'Lien'];

/**
 * Les trois règles d'écriture. Ce ne sont pas des décorations : §5 interdit le mot
 * « certifié » et toute coordonnée personnelle dans un guide, et l'éditeur le
 * rappelle à l'endroit où on écrit.
 */
export const rules = [
  'Pas de mot « certifié »',
  'Pas de numéro, email ou adresse personnelle',
  'Citez vos sources quand c’est possible',
];

// ═══ A07 · les réseaux ═══════════════════════════════════════════════════════

/**
 * `unread` et `muted` sont écrits sur les quatre, `null` et `false` compris : la
 * maquette les omet, mais quatre formes d'objet différentes rendent `n.muted`
 * inaccessible sur l'union.
 */
export const myNets = [
  {
    i: 'LY',
    name: 'Lyon et Rhône',
    bg: '#16785E',
    members: '1 400 membres',
    unread: 12,
    muted: false,
  },
  {
    i: 'BN',
    name: 'Béninois en France',
    bg: '#E0733A',
    members: '890 membres',
    unread: 3,
    muted: false,
  },
  {
    i: 'EN',
    name: 'Entrepreneurs Lyon',
    bg: '#0F5C48',
    members: '62 membres',
    unread: null,
    muted: true,
  },
  {
    i: 'CO',
    name: 'Recherche Colocation',
    bg: '#2FA37D',
    members: '210 membres',
    unread: null,
    muted: false,
  },
];

export const netFilters = [chip('Ville', true), chip('Pays'), chip('Intérêt'), chip('Catégorie')];

/**
 * « Découvrir » — trois réseaux à rejoindre. Le troisième est SUR DEMANDE, et son
 * bouton le dit : « Demander » sur fond clair, pas « Rejoindre » sur fond vert. La
 * différence de couleur porte l'information, elle n'est pas décorative.
 */
export const discover = [
  {
    name: 'Étudiants de Lyon 2',
    cat: 'Intérêt',
    desc: 'Entraide cours, stages et vie de campus.',
    members: '340 membres',
    cta: 'Rejoindre',
    cover: '#CFE3DA',
    btnBg: '#16785E',
    btnFg: '#fff',
  },
  {
    name: 'Sénégalais de Lyon',
    cat: 'Pays',
    desc: 'Réseau des Sénégalais installés dans le Rhône.',
    members: '520 membres',
    cta: 'Rejoindre',
    cover: '#FBE3D4',
    btnBg: '#16785E',
    btnFg: '#fff',
  },
  {
    name: 'Femmes entrepreneures',
    cat: 'Intérêt',
    desc: 'Sur demande · pour créer et développer son activité.',
    members: '88 membres',
    cta: 'Demander',
    cover: '#E9F2EE',
    btnBg: '#F2F5F4',
    btnFg: '#0F5C48',
  },
];

// ═══ A08 · un réseau ═════════════════════════════════════════════════════════

/** Les six onglets. Le deuxième — « Sujets » — est celui que A08 montre. */
export const NET_TABS = ['Fil', 'Sujets', 'Événements', 'Membres', 'Album', 'À propos'] as const;

export const netTabsFor = (active: number) => NET_TABS.map((l, i) => tab(l, i === active));

export const netTabs = netTabsFor(1);

export const ownerActions = ['Annonce', 'Épingler', 'Gérer'];

/**
 * Les sujets du réseau. `pinned` change le fond de la ligne ET la couleur de son
 * icône — deux marques, pas une, parce qu'un fond très clair seul ne se voit pas
 * à contraste réduit.
 */
export const topics = [
  {
    title: 'Renouveler son passeport depuis la France',
    last: 'Dernier message il y a 2 h · Sandra M.',
    state: 'Ouvert',
    n: 23,
    icon: PIN,
    pinned: true,
  },
  {
    title: 'Liste des pièces pour l’acte de naissance',
    last: 'Épinglé par les modérateurs',
    state: 'Résolu',
    n: 41,
    icon: PIN,
    pinned: true,
  },
  {
    title: 'Envoyer de l’argent au pays : quels services ?',
    last: 'il y a 5 h · Marc K.',
    state: 'Ouvert',
    n: 17,
    icon: CHAT,
    pinned: false,
  },
  {
    title: 'Fête de l’indépendance — 1er août',
    last: 'hier · Aïcha D.',
    state: 'Ouvert',
    n: 9,
    icon: CHAT,
    pinned: false,
  },
  {
    title: 'Double nationalité : retours d’expérience',
    last: 'il y a 3 j · Ibrahim S.',
    state: 'Résolu',
    n: 32,
    icon: CHAT,
    pinned: false,
  },
].map((t) => ({
  ...t,
  bg: t.pinned ? '#FAFBFB' : 'transparent',
  iconBg: t.pinned ? '#E3F0EB' : '#F2F5F4',
  iconFg: t.pinned ? '#0F5C48' : '#5D6B66',
  stBg: t.state === 'Ouvert' ? '#E3F0EB' : '#F2F5F4',
  stFg: t.state === 'Ouvert' ? '#0F5C48' : '#5D6B66',
}));

// ═══ A09 · un sujet ══════════════════════════════════════════════════════════

/**
 * `guide` est écrit à `null` sur les trois, et c'est une DIVERGENCE de la maquette
 * qu'il faut connaître : son balisage dessine, dans un commentaire, une carte
 * « Guide · 57 ont trouvé utile » sous `<sc-if value="{{ c.guide }}">` — mais son
 * `renderVals()` ne pose jamais ce champ. La carte est donc morte DANS LA MAQUETTE
 * elle-même. On reproduit l'état qu'elle montre (aucun guide lié) plutôt que
 * d'inventer le lien qu'elle a oublié de fournir.
 */
export const comments = [
  {
    i: 'SM',
    bg: '#0F5C48',
    name: 'Sandra M.',
    text: 'Le Dr Mensah, rue de Marseille, prend encore des patients. Appelez le matin.',
    time: 'il y a 5 h',
    indent: '0px',
    indentM: '0px',
    canReply: true,
    guide: null,
  },
  {
    i: 'FN',
    bg: '#2FA37D',
    name: 'Fatou Ndiaye',
    text: 'Merci ! Il accepte la carte Vitale provisoire ?',
    time: 'il y a 4 h',
    indent: '48px',
    indentM: '34px',
    canReply: false,
    guide: null,
  },
  {
    i: 'KB',
    bg: '#E0733A',
    name: 'Kofi Boateng',
    text: 'Maison de santé Jean Macé aussi, via Doctolib. Ils parlent anglais.',
    time: 'il y a 3 h',
    indent: '0px',
    indentM: '0px',
    canReply: true,
    guide: null,
  },
];

export const modActions = [
  { label: 'Épingler', icon: PIN },
  { label: 'Clore le sujet', icon: LOCK },
  { label: 'Masquer', icon: EYE },
];

// ═══ A10 · créer un réseau ═══════════════════════════════════════════════════

/**
 * Les trois visibilités de §7. « Sur invitation » est INVISIBLE dans Découvrir —
 * la maquette l'écrit, et c'est la règle du dossier, pas un détail d'affichage.
 */
export const visibility = [
  { t: 'Public', s: 'Tout membre peut voir et rejoindre.', on: true },
  { t: 'Sur demande', s: 'Les membres demandent à rejoindre, vous acceptez.', on: false },
  {
    t: 'Sur invitation',
    s: 'Invisible dans Découvrir. Accès par invitation seulement.',
    on: false,
  },
].map((v) => ({
  ...v,
  bg: v.on ? '#EFF7F3' : '#fff',
  bd: v.on ? '1.5px solid #16785E' : '1px solid #E6EBE9',
  radio: v.on ? '6px solid #16785E' : '1.5px solid #CBD5D1',
}));

export const invitees = [
  { i: 'SM', name: 'Sandra M.', sub: 'Installée · Lyon 3e', bg: '#0F5C48', invited: true },
  { i: 'KB', name: 'Kofi Boateng', sub: 'Arrivé · Lyon 3e', bg: '#E0733A', invited: true },
  { i: 'FN', name: 'Fatou Ndiaye', sub: 'Installée · Lyon 7e', bg: '#2FA37D', invited: true },
  { i: 'IS', name: 'Ibrahim S.', sub: 'Contact · Bordeaux', bg: '#B4581F', invited: false },
  { i: 'YB', name: 'Yasmine Benali', sub: 'Contact · Paris', bg: '#16785E', invited: false },
].map((m) => ({
  ...m,
  btn: m.invited ? 'Invité·e' : 'Inviter',
  btnBg: m.invited ? '#E3F0EB' : '#16785E',
  btnFg: m.invited ? '#0F5C48' : '#fff',
}));

// ═══ A11 · villes et membres ═════════════════════════════════════════════════

export const dirFilters = [
  chip('Lyon · 10 km', true),
  chip('Pays'),
  chip('Phase'),
  chip('Disponible'),
];

export const directory = [
  {
    i: 'SM',
    name: 'Sandra M.',
    sub: 'Installée · Lyon 3e',
    bg: '#0F5C48',
    help: true,
    skills: ['Droit', 'Anglais'],
  },
  {
    i: 'KB',
    name: 'Kofi Boateng',
    sub: 'Arrivé · Lyon 3e',
    bg: '#E0733A',
    help: false,
    skills: ['Informatique'],
  },
  {
    i: 'AD',
    name: 'Aïcha Diop',
    sub: 'Installée · Lyon 7e',
    bg: '#16785E',
    help: true,
    skills: ['Comptabilité', 'CAF'],
  },
  {
    i: 'MS',
    name: 'Moussa Sow',
    sub: 'Prépare son départ · Dakar',
    bg: '#2FA37D',
    help: false,
    skills: ['BTP'],
  },
];

// ═══ A12 · la fiche d'une ville ══════════════════════════════════════════════

export const countryBars = [
  { c: 'Sénégal', w: '82%', n: '312' },
  { c: 'Côte d’Ivoire', w: '64%', n: '246' },
  { c: 'Bénin', w: '46%', n: '178' },
  { c: 'Cameroun', w: '38%', n: '142' },
];

export const CITY_TABS = [
  'Bons plans',
  'Produits du pays',
  'Budgets réels',
  'Témoignages',
] as const;

export const cityTabsFor = (active: number) => CITY_TABS.map((l, i) => tab(l, i === active));

export const cityTabs = cityTabsFor(2);

/**
 * LES MÊMES QUATRE ONGLETS, EN PASTILLES — la forme que la planche MOBILE dessine.
 *
 * Ce n'est pas un doublon décoratif, et il faut dire pourquoi il existe. La
 * planche d'ordinateur de A12 dessine ses onglets SOULIGNÉS : graisse, couleur de
 * texte et trait du bas, ce que `tab()` calcule. La planche mobile les dessine en
 * PASTILLES : fond, couleur de texte et bordure, ce que `chip()` calcule — et
 * aucune des trois valeurs n'est la même (`#16785E` de fond contre `#0F5C48` de
 * texte, `#fff` de texte contre `#5D6B66`).
 *
 * Réemployer `cityTabs` sur le cadre mobile aurait donc demandé de RECOLORER une
 * valeur à la main dans la déclaration liée, c'est-à-dire de redessiner. Les deux
 * formes sont deux vues du MÊME état — le rang de l'onglet courant est l'unique
 * argument — donc rien ne peut divergir entre elles.
 */
export const cityPillsFor = (active: number) => CITY_TABS.map((l, i) => chip(l, i === active));

export const cityPills = cityPillsFor(2);

/** `u` est le nombre de membres qui ont contribué à la médiane. */
export const budgets = [
  { l: 'Chambre en coloc', v: '480 €', u: 24 },
  { l: 'Studio meublé', v: '620 €', u: 19 },
  { l: 'Courses mensuelles', v: '220 €', u: 31 },
  { l: 'Abonnement TCL (-26 ans)', v: '25 €', u: 12 },
];

// ═══ A01N · LE COMPOSEUR EN PLEIN ÉCRAN, ET CE QUE LE BACK N'A PAS ═════════
//
// A01N est le composeur mobile. Il dessinait tout en dur : le texte du brouillon,
// deux miniatures d'image, un aperçu de sondage, une étiquette de guide lié, trois
// compteurs et « Visible par Béninois en France ».
//
// ── CE QUI EST LIÉ, ET POURQUOI SEULEMENT CELA ─────────────────────────────
//
// `createPostSchema` (`@app/shared`, `validation/feed.ts`) est `.strict()` et porte
// CINQ champs : `type`, `body`, `mediaIds` (≤ `FEED_LIMITS.postMediaMax`),
// `communityId`, `journeyId`/`journeyStepId`. Il n'a NI `guideIds`, NI sondage.
//
// Conséquence lue, pas supposée : `POST /posts` REFUSERAIT un sondage ou un guide
// lié — `.strict()` rejette le champ inconnu. Les deux fenêtres que la maquette
// ouvre depuis ce composeur, « Lier un guide » (A01G) et « Créer un sondage »
// (A01S), n'ont donc AUCUNE route où envoyer leur résultat, et la grille de
// sondages n'existe que sur les RÉSEAUX (`createPollSchema`, 2 à 8 options), pas
// sur le fil.
//
// On lie donc le type, le corps, les images et le réseau cible — ce que la route
// accepte — et on LAISSE DESSINÉS l'aperçu de sondage et l'étiquette de guide.
// Fabriquer un contrat pour eux serait inventer une API. REMONTÉ AU PORTEUR :
// c'est un manque du BACK, et il est le premier à combler sur cet écran.
//
// ── LA RÈGLE DURE DES IMAGES SE TIENT ICI, ET UNE SEULE FOIS ───────────────
//
// « Jusqu'à 4 images » (04 §2.4) : la borne est `FEED_LIMITS.postMediaMax`, lue de
// `@app/shared` et non recopiée. Le compteur affiché est `photos.length`, donc il
// ne peut pas se désynchroniser des miniatures — c'est exactement le défaut que
// `composeur.test.ts` décrit : la pastille « 2 images » ne bougeait pas quand on
// dessinait une cinquième miniature.

/** Un onglet de type dans le composeur MOBILE : fond, texte et bordure, les trois. */
const typeChip = (label: string, on: boolean) => ({
  label,
  bg: on ? '#0F5C48' : '#fff',
  fg: on ? '#fff' : '#5D6B66',
  bd: on ? '#0F5C48' : '#E6EBE9',
});

/**
 * Les quatre types de publication, dans la forme que A01N dessine.
 *
 * Ce n'est pas `postTypesFor` : celui-là porte la palette PAR TYPE de la planche
 * d'ordinateur de A01 (vert pour Victoire, orange pour Question…), là où le
 * composeur mobile dessine un seul vert pour l'actif et du blanc pour les autres.
 * Deux dessins, un seul état — le rang actif est l'unique argument des deux.
 */
export const draftTypesFor = (active: number) =>
  ['Victoire', 'Question', 'Info', 'Discussion'].map((l, i) => typeChip(l, i === active));

export const draftTypes = draftTypesFor(3);

/**
 * LE BROUILLON EN COURS.
 *
 * `photos` porte les LIBELLÉS des miniatures (« Photo 1 »), pas des URL : le cadre
 * ne dessine qu'un rectangle hachuré avec un nom, et le pipeline média de §2.4
 * rend des identifiants que cet écran n'a pas à résoudre.
 *
 * `cible` est le réseau où l'on publie — `communityId` de `createPostSchema`. Vide,
 * la publication va au fil public, et la maquette n'en dessine pas la forme : c'est
 * la seule raison pour laquelle ce champ n'est pas nullable ici.
 */
export interface BrouillonView {
  readonly texte: string;
  readonly photos: readonly string[];
  readonly cible: string;
}

export const brouillon: BrouillonView = {
  texte: 'On organise un repas partagé pour les nouveaux arrivants. Votez pour la date !',
  photos: ['Photo 1', 'Photo 2'],
  cible: 'Visible par Béninois en France',
};

// ═══ A01G · « Lier un guide » — les deux listes de la fenêtre ══════════════
//
// Les cartes de cette fenêtre SONT des données : titre, catégorie, portée ou ville,
// date de mise à jour et compteur d'utilité, tous présents sur `guideListItemSchema`
// (`GET /guides`). Elles étaient écrites en dur dans les deux cadres.
//
// DEUX LISTES ET NON UNE, parce que la maquette dessine deux SECTIONS NOMMÉES —
// « SUGGÉRÉS POUR VOTRE PUBLICATION » et « RÉSULTATS » — et deux cartes
// différentes : la suggérée est sur fond vert, cochée, avec une pastille
// « Suggéré » ; le résultat est sur fond blanc avec une case vide. Les fondre en
// une seule liste demanderait de choisir laquelle des deux cartes garder, donc de
// mentir sur l'autre moitié.
//
// ── DEUX MANQUES DU BACK, REMONTÉS ET NON CONTOURNÉS ──────────────────────
//
//   · LA RECHERCHE TEXTE N'EXISTE PAS sur les guides : `guideListQuerySchema`
//     accepte `tab`, `category`, `countryId`, `cityId` et `cursor` — pas de `q`.
//     Le champ « médecin » que la maquette dessine n'a donc aucune route à
//     appeler, et il reste dessiné ;
//   · LA SUGGESTION n'existe pas davantage : rien dans 05 §4 ne rend des guides
//     « suggérés pour cette publication ». La liste est donc remplie des mêmes
//     cartes réelles, et l'ordre est celui que l'API donne.

/** Une carte de la fenêtre « Lier un guide » : son titre et sa ligne de contexte. */
export interface GuideLiableView {
  readonly titre: string;
  /** « Santé · mis à jour le 2 février », ou « Santé · Lyon · 57 utiles ». */
  readonly meta: string;
}

export const guidesSuggeres = [
  { titre: 'Déclarer son médecin traitant', meta: 'Santé · mis à jour le 2 février' },
  { titre: 'Carte Vitale : premiers pas', meta: 'Santé · mis à jour le 18 janvier' },
] satisfies readonly GuideLiableView[];

export const guidesTrouves = [
  {
    titre: 'Trouver un médecin qui accepte de nouveaux patients',
    meta: 'Santé · Lyon · 57 utiles',
  },
  { titre: 'Complémentaire santé solidaire', meta: 'Santé · Universel · 34 utiles' },
] satisfies readonly GuideLiableView[];

// ═══ A12T · LES ONGLETS DE LA FICHE VILLE ══════════════════════════════════
//
// Les six planches d'onglet — trois d'ordinateur en 1036 px, trois mobiles dans
// MOB2 — étaient ENTIÈREMENT littérales : « Lyon », « Wax et Saveurs »,
// « Utile · 48 » écrits en dur dans six composants. Elles recevaient `AccueilData`
// et l'ignoraient (`_props`). Les prises ci-dessous sont ce que ces six cadres
// LISENT, déclarées plutôt que déduites d'un exemple.
//
// ── AUCUNE ROUTE NE LES REMPLIT ENCORE, ET IL FAUT LE DIRE ─────────────────
//
// `apps/api/src/modules/cities/` porte bien les routes — `GET /cities/:slug`,
// `GET /cities/:slug/tips`, `GET /cities/:slug/desks`, `GET /cities/map`, toutes
// `@PublicRead()` — mais `packages/shared/src/validation/cities.ts` NE CONTIENT
// AUCUN SCHÉMA DE RÉPONSE : seulement les schémas de requête et d'écriture
// (`cityTipsQuerySchema`, `createCityTipSchema`, …). Il n'existe donc pas de
// frontière validée par où ces charges pourraient entrer, et il n'y a pas non
// plus de module front (`screens/villes/`) comme il y en a pour les guides et
// les réseaux.
//
// Les valeurs restent donc celles de la MAQUETTE, exactement comme
// `a07/data.ts` garde les siennes en attendant `use-reseaux.ts`. Ce qui change,
// et c'est tout l'objet de ce lot : le JSX ne les porte plus. Le jour où les
// schémas de réponse sont écrits, un `villesData()` les remplace et aucun cadre
// ne bouge. REMONTÉ AU PORTEUR — c'est un manque du BACK, pas du transcodage.
//
// ── LE SEUIL DE CONFIDENTIALITÉ NE SE TIENT PAS ICI ────────────────────────
//
// `CITY_COUNT_PRIVACY_THRESHOLD` vaut 3 (`validation/cities.ts`), et c'est le
// SERVEUR qui l'applique : un compteur sous le seuil ne sort pas. Le front
// affiche ce qu'on lui envoie et ne recalcule rien — deux implémentations de la
// même règle divergent toujours, et celle-ci protège des personnes.

/** L'en-tête de la fiche ville, découpé en ses cinq textes réels. */
export interface CityHeadView {
  readonly nom: string;
  readonly region: string;
  readonly membres: string;
  /**
   * « 212 contributions ». Les planches A12T l'écrivent, le cadre complet de A12
   * ne l'écrit PAS : c'est la maquette qui en décide, et les deux lignes sont
   * donc composées séparément à partir des mêmes trois champs.
   */
  readonly contributions: string;
  readonly reseau: string;
}

export const ville: CityHeadView = {
  nom: 'Lyon',
  region: 'Auvergne-Rhône-Alpes',
  membres: '1 400 membres',
  contributions: '212 contributions',
  reseau: 'Réseau Lyon et Rhône',
};

/**
 * Le pied d'une contribution — auteur, compteur d'utilité, enregistrer, signaler.
 *
 * `utileBg` et `utileFg` voyagent ENSEMBLE et disent si LE LECTEUR a déjà voté :
 * vert plein quand oui, gris quand non. Ce n'est pas décoratif — c'est le seul
 * endroit où l'écran dit que le geste est déjà fait.
 *
 * `utiles` est un compteur de VOTES D'UTILITÉ. Jamais de vues : la règle dure
 * 00 §49 l'interdit, et aucune des quatre listes de cette fiche n'en porte.
 */
interface ContributionPied {
  readonly i: string;
  readonly bg: string;
  readonly auteur: string;
  readonly sous: string;
  readonly utileBg: string;
  readonly utileFg: string;
  readonly utiles: number;
}

/** Un bon plan de la ville (onglet « Bons plans »). */
export interface CityTipView extends ContributionPied {
  readonly cat: string;
  readonly titre: string;
  readonly texte: string;
}

/** Un lieu du pays (onglet « Produits du pays »). */
export interface CityPlaceView extends ContributionPied {
  readonly nom: string;
  readonly adresse: string;
  /**
   * Les étiquettes du lieu — type, puis pays. Leur NOMBRE varie : la maquette en
   * dessine trois sur « Wax et Saveurs » et deux sur « Chez Mama Adjo », et deux
   * seulement sur la planche mobile. C'est donc une liste, pas trois champs.
   */
  readonly tags: readonly string[];
  /** « Vous y êtes allé·e » quand le lecteur l'a marqué, « J'y suis allé·e » sinon. */
  readonly been: string;
  readonly beenBg: string;
  readonly beenBd: string;
  readonly texte: string;
}

/** Un témoignage (onglet « Témoignages »). */
export interface CityStoryView extends ContributionPied {
  readonly texte: string;
  /** « Parcours Études · 7 étapes franchies » — le parcours que le témoignage rattache. */
  readonly parcours: string;
}

export const cityTipFiltersFor = (active: number) =>
  ['Tout', 'Transport', 'Administration', 'Sorties', 'Économies'].map((l, i) =>
    chip(l, i === active),
  );

export const cityPlaceFiltersFor = (active: number) =>
  ['Tout', 'Épiceries', 'Restaurants', 'Tissus', 'Coiffure'].map((l, i) => chip(l, i === active));

export const cityStoryFiltersFor = (active: number) =>
  ['Tout', 'Études', 'Travail', 'Famille'].map((l, i) => chip(l, i === active));

export const cityTipFilters = cityTipFiltersFor(0);
export const cityPlaceFilters = cityPlaceFiltersFor(0);
export const cityStoryFilters = cityStoryFiltersFor(0);

/**
 * Les trois bons plans de la maquette.
 *
 * `satisfies` et non `as const` : le tableau garde le type DÉCLARÉ — donc
 * `cat: string` et non l'union des trois catégories écrites — tout en étant
 * vérifié contre la prise. Si un cadre se mettait à lire un champ de plus, la
 * ligne rougirait ici, à la source du dessin.
 */
export const cityTips = [
  {
    cat: 'Transport',
    titre: 'Abonnement TCL à 25 € pour les moins de 26 ans',
    texte:
      'Demandez-le en agence avec votre carte étudiante, il n’est pas proposé en ligne pour les étudiants étrangers.',
    i: 'SM',
    bg: '#0F5C48',
    auteur: 'Sandra M.',
    sous: 'Installée · Lyon 3e',
    utileBg: '#16785E',
    utileFg: '#fff',
    utiles: 48,
  },
  {
    cat: 'Administration',
    titre: 'Préfecture : arriver avant 8 h le mardi',
    texte:
      'Les files sont plus courtes le mardi matin pour les retraits de titre. Pensez à la photocopie du récépissé.',
    i: 'MK',
    bg: '#0F5C48',
    auteur: 'Marc K.',
    sous: 'Installé',
    utileBg: '#F2F5F4',
    utileFg: '#16211D',
    utiles: 31,
  },
  {
    cat: 'Économies',
    titre: 'Too Good To Go autour de la Guillotière',
    texte:
      'Les boulangeries de la place Gabriel-Péri mettent leurs paniers en ligne vers 19 h.',
    i: 'FN',
    bg: '#2FA37D',
    auteur: 'Fatou N.',
    sous: 'Installée · Lyon 7e',
    utileBg: '#F2F5F4',
    utileFg: '#16211D',
    utiles: 22,
  },
] satisfies readonly CityTipView[];

export const cityPlaces = [
  {
    nom: 'Wax et Saveurs',
    adresse: '12 rue Paul-Bert, Lyon 3e',
    tags: ['Épicerie', 'Bénin', 'Sénégal'],
    been: 'Vous y êtes allé·e',
    beenBg: '#E3F0EB',
    beenBd: '#E3F0EB',
    texte: 'Attiéké frais le samedi matin, gari, piment. Paiement carte.',
    i: 'KB',
    bg: '#E0733A',
    auteur: 'Kofi B.',
    sous: 'Arrivé · Lyon 3e',
    utileBg: '#F2F5F4',
    utileFg: '#16211D',
    utiles: 36,
  },
  {
    nom: 'Chez Mama Adjo',
    adresse: '5 cours Gambetta, Lyon 7e',
    tags: ['Restaurant', 'Bénin'],
    been: 'J’y suis allé·e',
    beenBg: '#fff',
    beenBd: '#E6EBE9',
    texte: 'Amiwo et sauce feuille le vendredi. Petites portions à 8 €.',
    i: 'AD',
    bg: '#16785E',
    auteur: 'Aïcha D.',
    sous: 'Installée · Lyon 7e',
    utileBg: '#F2F5F4',
    utileFg: '#16211D',
    utiles: 27,
  },
] satisfies readonly CityPlaceView[];

export const cityStories = [
  {
    texte:
      '« J’ai trouvé ma coloc en deux semaines grâce au réseau. Le plus dur a été le garant, Visale m’a sauvé. Venez tôt aux événements du jeudi, c’est là que tout se passe. »',
    parcours: 'Parcours Études · 7 étapes franchies',
    i: 'AD',
    bg: '#B4581F',
    auteur: 'Amina D.',
    sous: 'Étudiante · Lyon',
    utileBg: '#16785E',
    utileFg: '#fff',
    utiles: 54,
  },
  {
    texte:
      '« Arrivé en plein hiver sans connaître personne. Trois mois après, j’ai un CDI et des amis. Le parrainage change tout. »',
    parcours: 'Parcours Travail · abouti',
    i: 'KB',
    bg: '#E0733A',
    auteur: 'Kofi B.',
    sous: 'Arrivé · Lyon 3e',
    utileBg: '#F2F5F4',
    utileFg: '#16211D',
    utiles: 41,
  },
] satisfies readonly CityStoryView[];

// ═══ A02 · une publication ═══════════════════════════════════════════════════

const REL_GUIDES = [
  { t: 'Déclarer son médecin traitant', s: 'Mis à jour le 2 février', auto: false },
  {
    t: 'Trouver un médecin qui accepte de nouveaux patients',
    s: 'Mis à jour le 9 mars',
    auto: false,
  },
  { t: 'Carte Vitale : premiers pas', s: 'Mis à jour le 18 janvier', auto: true },
] as const;

/** Un vote sur un guide lié : utile, pas utile, ou rien encore. */
export type GuideVote = 'up' | 'down' | undefined;

/**
 * Les guides liés à la publication, et leur vote.
 *
 * `auto` marque ceux que la plateforme a rattachés d'elle-même — c'est ce que le
 * vote sert à corriger. Le membre dit si le rattachement est utile, et l'état
 * traverse la page comme `storyFiltersFor` en A01 : l'état vit dans la page, la
 * donnée calcule ce qui s'affiche.
 */
export const relGuidesFor = (
  votes: Readonly<Record<number, GuideVote>>,
  onVote: (i: number, v: 'up' | 'down') => void,
) =>
  REL_GUIDES.map((g, i) => {
    const v = votes[i];
    return {
      ...g,
      upBg: v === 'up' ? '#16785E' : '#F2F5F4',
      upFg: v === 'up' ? '#fff' : '#5D6B66',
      downBg: v === 'down' ? '#16211D' : '#F2F5F4',
      downFg: v === 'down' ? '#fff' : '#5D6B66',
      voted: v !== undefined,
      onUp: () => onVote(i, 'up'),
      onDown: () => onVote(i, 'down'),
    };
  });

// ═══ A13 · une story en lecture ══════════════════════════════════════════════

/**
 * AUCUN COMPTEUR DE VUES — règle dure §1.2, et la maquette la tient d'elle-même :
 * elle écrit « un composant, trois types · aucun compteur de vues » sous sa planche.
 * Ce qui se compte ici, ce sont les RÉACTIONS : « 31 trouvent utile », « 2
 * confirment ». C'est une autre chose — un jugement de valeur donné volontairement,
 * pas une mesure d'attention subie.
 *
 * `bars` sont les segments de progression de la story, en largeurs déjà calculées.
 *
 * LA PREMIÈRE STORY EST ÉCRITE UNE FOIS, et les deux lectures y puisent. La maquette,
 * elle, la recopie : `storyMain` (que lit le cadre d'ordinateur) et `storyViews[0]`
 * (que lit le cadre mobile) portent le même conseil de Visale, au mot près, à ceci
 * près que la seconde ajoute `align`, `photo` et `confirmers`. Deux écritures pour
 * une seule story, c'est deux endroits où corriger une faute de frappe.
 *
 * `useful`, `photo` et `confirmers` sont écrits sur les trois, `false` et `null`
 * compris : la maquette les omet, mais trois formes d'objet différentes rendent
 * `st.confirmers` inaccessible sur l'union — ce que `tsc` signale.
 */
const MAIN_STORY = {
  bg: '#16785E',
  avBg: '#B4581F',
  i: 'AD',
  name: 'Aïcha Diop',
  sub: 'Lyon · il y a 3 h · expire dans 21 h',
  pill: 'CONSEIL · LOGEMENT',
  pillFg: '#16785E',
  label: 'CONSEIL',
  text: 'Pour Visale, déposez votre VLS-TS dès sa validation sur l\u2019ANEF. Réponse en 48 h.',
  state: '1er des conseils Logement aujourd\u2019hui · 31 trouvent utile',
  a1: 'Utile',
  useful: true,
  n1: '31',
  a2: 'Pas utile',
  n2: '2',
  write: 'Écrire à Aïcha…',
  bars: ['100%', '40%', '0%'],
  align: 'center',
  photo: false,
  confirmers: null as readonly { readonly i: string; readonly bg: string }[] | null,
};

export const storyViews = [
  MAIN_STORY,
  {
    bg: '#2E3A35',
    avBg: '#E0733A',
    i: 'KB',
    name: 'Kofi Boateng',
    sub: 'Lyon 7e · il y a 5 h · expire dans 19 h',
    pill: 'DÉCOUVERTE · PRODUIT',
    pillFg: '#16785E',
    label: 'DÉCOUVERTE',
    text: 'Épicerie Wax et Saveurs : attiéké frais le samedi matin.',
    state: 'Ajoutée aux produits du pays de la fiche Lyon · 14 veulent y aller',
    a1: 'À voir',
    useful: false,
    n1: '14',
    a2: 'J\u2019y suis allé·e',
    n2: '6',
    write: 'Écrire à Kofi…',
    bars: ['100%', '0%'],
    align: 'flex-end',
    photo: true,
    confirmers: null as readonly { readonly i: string; readonly bg: string }[] | null,
  },
  {
    bg: '#1F2A44',
    avBg: '#0F5C48',
    i: 'SM',
    name: 'Sandra M.',
    sub: 'Lyon 3e · il y a 1 h · expire dans 23 h',
    pill: 'INFORMATION · CAF',
    pillFg: '#1F2A44',
    label: 'INFORMATION',
    text: 'Le guichet CAF de la Part-Dieu ferme à 12 h cette semaine.',
    state: '2 membres confirment · dans Guichets du jour',
    a1: 'Je confirme',
    useful: false,
    n1: '2',
    a2: 'Ça a changé',
    n2: '0',
    write: 'Écrire à Sandra…',
    bars: ['60%'],
    align: 'center',
    photo: false,
    confirmers: [
      { i: 'MK', bg: '#16785E' },
      { i: 'FN', bg: '#2FA37D' },
    ] as readonly { readonly i: string; readonly bg: string }[] | null,
  },
];

/**
 * Le cadre d'ORDINATEUR de A13 boucle sur `storyMain`, celui de MOBILE est lui-même
 * DANS une boucle sur `storyViews` — `<sc-for as="st">` entoure le téléphone, pour
 * montrer les trois types côte à côte sur la planche. Le cadre extrait référence
 * donc `st` seul, qui devient une donnée à fournir : la story qu'on lit.
 */
export const storyMain = [MAIN_STORY];

/** La story qu'on lit, la première par défaut — ce que la maquette montre. */
export const storyViewFor = (index: number) => storyViews[index] ?? MAIN_STORY;

// ═══ A14 · créer une story ═══════════════════════════════════════════════════

const PALETTE = [
  '#16785E',
  '#0F5C48',
  '#E0733A',
  '#1F2A44',
  '#6B4A34',
  '#16211D',
  '#5B3F8C',
] as const;

/** La couleur de fond choisie. C'est la DONNÉE qui peint le cadre entier. */
export const writeBgFor = (pal: number) => PALETTE[pal] ?? PALETTE[0];

/** La palette sur mobile : un anneau blanc épais marque le choix. */
export const paletteFor = (pal: number, onPick: (i: number) => void) =>
  PALETTE.map((hex, i) => ({
    hex,
    bd: pal === i ? '3px solid #fff' : '2px solid rgba(255,255,255,.35)',
    // `on` n'est pas dans la maquette : elle marque la sélection par l'anneau, ce
    // qui ne dit rien à un lecteur d'écran. Le générateur pose `aria-pressed={c.on}`
    // sur ces pastilles ; c'est la donnée qu'il lui faut.
    on: pal === i,
    onPick: () => onPick(i),
  }));

/** La même palette sur ordinateur : un anneau vert, sur fond clair. */
export const webPaletteFor = (pal: number, onPick: (i: number) => void) =>
  PALETTE.map((hex, i) => ({
    hex,
    ring: pal === i ? '2.5px solid #16785E' : 'none',
    on: pal === i,
    onPick: () => onPick(i),
  }));

const STORY_KINDS = ['Conseil', 'Découverte', 'Information'] as const;

export const storyKindsFor = (sk: number, onPick: (i: number) => void) =>
  STORY_KINDS.map((label, i) => {
    const on = sk === i;
    return {
      label,
      bg: on ? '#fff' : 'transparent',
      fg: on ? '#16211D' : '#fff',
      onPick: () => onPick(i),
    };
  });

export const webKindsFor = (sk: number, onPick: (i: number) => void) =>
  STORY_KINDS.map((label, i) => ({
    label,
    bg: sk === i ? '#fff' : 'transparent',
    fg: sk === i ? '#16211D' : '#5D6B66',
    onPick: () => onPick(i),
  }));

export const webKindFor = (sk: number) => (STORY_KINDS[sk] ?? STORY_KINDS[0]).toUpperCase();
export const webPillFor = (sk: number) => `${webKindFor(sk)} · LOGEMENT`;

export const photoTools = ['Changer', 'Recadrer', 'Assombrir le bas'];

/**
 * Les étapes du parcours auxquelles rattacher la story. La première est celle qu'on
 * vient de franchir — c'est ce que la maquette met en avant, et c'est le sens du
 * produit : la story documente une étape, elle ne flotte pas.
 */
export const attachSteps = [
  { t: 'Étape 7 · Logement', s: 'Vous venez de la franchir', on: true },
  { t: 'Étape 6 · Caution bancaire et AVI', s: 'Franchie il y a 3 semaines', on: false },
  { t: 'Étape 8 · Assurance habitation', s: 'À venir', on: false },
].map((a) => ({
  ...a,
  bg: a.on ? '#E3F0EB' : '#fff',
  bd: a.on ? '1.5px solid #16785E' : '1px solid #E6EBE9',
  cBg: a.on ? '#16785E' : '#fff',
  cBd: a.on ? 'none' : '1.5px solid #CBD5D1',
}));

export const attachTopics = ['Visale', 'Garant', 'CAF', 'Colocation', 'Banque'];

export const audienceFor = (aud: number, onPick: (i: number) => void) =>
  ['Tous les membres', 'Lyon seulement'].map((label, i) => {
    const on = aud === i;
    return {
      label,
      bg: on ? '#fff' : 'transparent',
      fg: on ? '#16211D' : '#5D6B66',
      onPick: () => onPick(i),
    };
  });

/**
 * L'interrupteur « recevoir des messages ». La maquette le dessine ALLUMÉ par
 * défaut (`this.state.msgs === false` étant faux au départ), et le curseur voyage
 * de 3 px à 23 px sur une piste de 48.
 */
export const msgsFor = (on: boolean) => ({
  msgsTrack: on ? '#16785E' : '#CBD5D1',
  msgsKnob: on ? '23px' : '3px',
});

const WEB_STEPS = ['1 · Écrire', '2 · Rattacher', '3 · Publier'] as const;

/**
 * Le cadre d'ordinateur de A14 est RÉPÉTÉ par la maquette — `<sc-for
 * list="{{ webFrames }}" as="w">` l'entoure — pour montrer ses quatre états côte à
 * côte sur la planche. Le cadre extrait référence donc `w`, qui devient une donnée
 * à fournir : l'état courant de l'assistant.
 *
 * `photo` et `color` sont exclusifs : une story est soit une photo, soit un aplat de
 * couleur. C'est pourquoi `color: !photo` et non un troisième booléen — deux
 * booléens indépendants auraient permis l'état impossible « ni l'un ni l'autre ».
 */
export const webFrameFor = (step: number, photo: boolean, onPhoto: () => void) => ({
  title:
    ['ORDINATEUR · 1 · ÉCRIRE', 'ORDINATEUR · 2 · RATTACHER', 'ORDINATEUR · 3 · PUBLIER'][step] ??
    '',
  s1: step === 0,
  s2: step === 1,
  s3: step === 2,
  photo,
  color: !photo,
  frameBd: step === 0 ? '1.5px dashed rgba(255,255,255,.85)' : '1.5px solid transparent',
  photoBg: photo ? '#16785E' : '#F2F5F4',
  photoFg: photo ? '#fff' : '#16211D',
  onPhoto,
  prev: step === 0 ? 'Annuler' : 'Retour',
  next: ['Suivant', 'Continuer', 'Publier'][step] ?? 'Suivant',
  steps: WEB_STEPS.map((label, i) => ({
    label,
    bar: i <= step ? '#16785E' : '#E6EBE9',
    fg: i === step ? '#16211D' : '#8A958F',
  })),
});

// ─── Le type que tous les écrans de cette maquette partagent ─────────────────

/**
 * UN SEUL type, parce que la maquette n'a qu'un `renderVals()`. Les cadres qui ne
 * consomment rien — et ils sont nombreux : MOB, MOB2, A08T et A12T sont entièrement
 * statiques — reçoivent `_props`, ce que le générateur écrit de lui-même.
 */
export interface AccueilData {
  rail: typeof rail;
  shortcuts: typeof shortcuts;
  panelFil: ReturnType<typeof panel>;
  panelGuides: typeof panelGuides;
  panelReseaux: typeof panelReseaux;
  panelVilles: typeof panelVilles;

  guideTabs: typeof guideTabs;
  guideFilters: typeof guideFilters;
  guides: typeof guides;
  missing: typeof missing;

  contributors: typeof contributors;
  guideActions: typeof guideActions;
  versions: typeof versions;

  mdTools: typeof mdTools;
  rules: typeof rules;

  myNets: typeof myNets;
  netFilters: typeof netFilters;
  discover: typeof discover;

  netTabs: ReturnType<typeof netTabsFor>;
  ownerActions: typeof ownerActions;
  topics: typeof topics;

  comments: typeof comments;
  modActions: typeof modActions;

  visibility: typeof visibility;
  invitees: typeof invitees;

  dirFilters: typeof dirFilters;
  directory: typeof directory;

  countryBars: typeof countryBars;
  cityTabs: ReturnType<typeof cityTabsFor>;
  cityPills: ReturnType<typeof cityPillsFor>;
  ville: CityHeadView;
  cityTipFilters: ReturnType<typeof cityTipFiltersFor>;
  cityPlaceFilters: ReturnType<typeof cityPlaceFiltersFor>;
  cityStoryFilters: ReturnType<typeof cityStoryFiltersFor>;
  cityTips: readonly CityTipView[];
  cityPlaces: readonly CityPlaceView[];
  cityStories: readonly CityStoryView[];

  draftTypes: ReturnType<typeof draftTypesFor>;
  brouillon: BrouillonView;
  /** La borne de 04 §2.4, lue de `@app/shared` et non recopiée dans le front. */
  photosMax: number;
  guidesSuggeres: readonly GuideLiableView[];
  guidesTrouves: readonly GuideLiableView[];
  budgets: typeof budgets;
  arrivals: typeof arrivals;
  events: typeof events;

  relGuides: ReturnType<typeof relGuidesFor>;

  storyMain: typeof storyMain;
  /** La story en cours de lecture — le cadre mobile de A13 la reçoit seule. */
  st: (typeof storyViews)[number];

  writeBg: string;
  palette: ReturnType<typeof paletteFor>;
  storyKinds: ReturnType<typeof storyKindsFor>;
  photoTools: typeof photoTools;
  attachSteps: typeof attachSteps;
  attachTopics: typeof attachTopics;
  audience: ReturnType<typeof audienceFor>;
  msgsTrack: string;
  msgsKnob: string;
  toggleMsgs: () => void;
  /**
   * L'action du bouton « Continuer » que A14 dessine à l'étape 2. C'est le
   * générateur qui la pose (`BUTTON_ACTIONS`, borné à cet écran) : le bouton est de
   * la maquette, son comportement s'écrit ici.
   */
  onContinue: () => void;
  webKind: string;
  webPill: string;
  webKinds: ReturnType<typeof webKindsFor>;
  webPalette: ReturnType<typeof webPaletteFor>;
  w: ReturnType<typeof webFrameFor>;
}

/** L'icône du livre, dont A03 se sert pour son en-tête de section. */
export { I };

/**
 * LES VOLETS DE LA FENÊTRE DE CONTRIBUTION (A12C), et pourquoi ils viennent de l'URL.
 *
 * La maquette dessine la contribution en DEUX ÉTAPES — « Étape 1 sur 2 · Contribuer
 * à la fiche Lyon », puis « Étape 2 sur 2 · Lyon » — mais elle ne dessine le second
 * volet que pour DEUX des quatre types : « Produit du pays » et « Budget réel ».
 * Le bon plan et le témoignage n'ont pas de planche d'étape 2 sur ordinateur.
 *
 * Le volet vient donc de l'URL, exactement comme `?paiement=` le fait pour le flux
 * Mobile Money de K06, et pour la même raison : ce qui fait avancer une démarche est
 * un envoi au serveur, et ce lot ne branche aucune route. Un `?contribution=budget`
 * rend le volet atteignable et testable sans affirmer qu'une contribution a été
 * enregistrée.
 *
 * Le volet hors bornes retombe sur `null` — donc fenêtre fermée. Jamais sur un
 * volet d'étape 2, qui laisserait croire qu'un type a été choisi.
 */
export const VOLETS_CONTRIBUTION = ['type', 'produit', 'budget'] as const;

export type VoletContribution = (typeof VOLETS_CONTRIBUTION)[number];

export function voletContribution(
  brut: string | readonly string[] | undefined,
): VoletContribution | null {
  if (typeof brut !== 'string') return null;
  return VOLETS_CONTRIBUTION.find((v) => v === brut) ?? null;
}
