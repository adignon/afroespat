/**
 * Données de l'écran A01, reprises de `docs/template/03 Accueil v2.dc.html`.
 *
 * La maquette calcule ses valeurs d'affichage — fonds, couleurs de texte, états
 * actifs — dans son `renderVals()`. Elles sont reproduites ici À L'IDENTIQUE :
 * le JSX généré les consomme telles quelles, sans rien décider lui-même.
 *
 * C'est la séparation qui tient tout : la FORME est transcodée de la maquette,
 * la DONNÉE et le COMPORTEMENT s'écrivent ici. Au lot 3, ce fichier sera
 * remplacé par des hooks branchés sur l'API — le JSX, lui, ne bougera pas.
 */

// ─── Chemins d'icônes, tels que la maquette les définit ──────────────────────

export const I = {
  home: 'M4 11 12 4l8 7v9H4z',
  path: 'M5 5h6a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h10',
  heart: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z',
  serv: 'M4 20V8l8-4 8 4v12',
  cal: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  feed: 'M15 18h-5M18 14h-8M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-4 0v-9a2 2 0 0 1 2-2h2M10 6h8v4h-8z',
  book: 'M12 7v14M16 12h2M16 8h2M6 12h2M6 8h2M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z',
  net: 'M12 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM5 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 8v4M12 12l-5 4M12 12l5 4',
  city: 'M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11z',
  mentor: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 14s1.5 2 4 2 4-2 4-2M9 10h.01M15 10h.01',
  account: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM5 21a7 7 0 0 1 14 0',
} as const;

// ─── Navigation ──────────────────────────────────────────────────────────────

const RAIL_ITEMS: readonly (readonly [string, string])[] = [
  ['Accueil', I.home],
  ['Parcours', I.path],
  ['Entraide', I.heart],
  ['Services', I.serv],
  ['Agenda', I.cal],
];

export const rail = RAIL_ITEMS.map(([label, icon], i) => ({
  label,
  icon,
  bg: i === 0 ? '#FFFFFF' : 'rgba(255,255,255,.08)',
  fg: i === 0 ? '#0F5C48' : '#CFE3DA',
}));

/**
 * Panneau de section. `active` désigne l'entrée courante — la même fonction
 * sert aux panneaux Guides, Réseaux et Villes dans la maquette.
 *
 * RÈGLE (§10.1) : ici les compteurs sont des NOUVEAUTÉS depuis la dernière
 * visite ; dans les panneaux de section, ce sont des totaux.
 */
const PANEL_ITEMS: readonly (readonly [string, string, number | null])[] = [
  ["Fil d'actualité", I.feed, null],
  ['Guides & Démarches', I.book, null],
  ["Fil d'entraide", I.heart, 12],
  ['Réseaux', I.net, null],
  ['Parrainage', I.mentor, null],
  ['Villes & Membres', I.city, null],
  ['Événements', I.cal, 3],
];

export const panel = (active: number) =>
  PANEL_ITEMS.map(([label, icon, count], i) => ({
    label,
    icon,
    count,
    bg: i === active ? '#E3F0EB' : 'transparent',
    fg: i === active ? '#0F5C48' : '#16211D',
    w: i === active ? 700 : 500,
  }));

export const panelFil = panel(0);

export const shortcuts = [
  { name: 'Lyon & Rhône', sub: '1 400 membres', i: 'LY', bg: '#16785E' },
  { name: 'Béninois en France', sub: '890 membres', i: 'BN', bg: '#E0733A' },
  { name: 'Recherche Colocation', sub: '210 membres', i: 'RC', bg: '#0F5C48' },
];

// ─── Stories ─────────────────────────────────────────────────────────────────

/**
 * `k` est la clé de filtre — 0 conseil, 1 découverte, 2 information — et `type`
 * le SUJET affiché en pastille. Les deux diffèrent volontairement : « Dossier
 * locatif » est un conseil (k=0) dont la pastille annonce « LOGEMENT ». Savoir
 * de quoi parle une story vaut mieux que savoir de quel type elle est.
 *
 * `count` est un compteur de VOTES du type, jamais un compteur de vues
 * (règle dure §1.2).
 */
const ALL_STORIES = [
  { i: 'SM', name: 'Sandra M.', bg: '#0F5C48', type: 'INFORMATION', k: 2, pillBg: '#0F5C48', caption: 'Guichet CAF', count: '2 confirment', seen: false },
  { i: 'MK', name: 'Marc K.', bg: '#16785E', type: 'INFORMATION', k: 2, pillBg: '#0F5C48', caption: 'Préfecture fermée', count: '5 confirment', seen: true },
  { i: 'AD', name: 'Aïcha D.', bg: '#B4581F', type: 'CONSEIL', k: 0, pillBg: '#16785E', caption: 'Visale rapide', count: '31 utile', seen: false },
  { i: 'FN', name: 'Fatou N.', bg: '#2FA37D', type: 'LOGEMENT', k: 0, pillBg: '#16785E', caption: 'Dossier locatif', count: '12 utile', seen: false },
  { i: 'KB', name: 'Kofi B.', bg: '#E0733A', type: 'DÉCOUVERTE', k: 1, pillBg: '#2FA37D', caption: 'Épicerie wax', count: '14 à voir', seen: false },
  { i: 'YB', name: 'Yasmine B.', bg: '#0F5C48', type: 'DÉCOUVERTE', k: 1, pillBg: '#2FA37D', caption: 'Maquis Lyon 7', count: '9 à voir', seen: true },
];

/** Anneau épais vert = pas encore vue ; anneau fin gris = vue. Jamais de dégradé (T1 §4.2). */
export const storiesFor = (filter: number) =>
  ALL_STORIES.filter((s) => filter < 0 || s.k === filter).map((s) => ({
    ...s,
    ring: s.seen ? '1.5px solid #CBD5D1' : '3px solid #16785E',
    pad: '3px',
  }));

export const storyFiltersFor = (filter: number, onPick: (k: number) => void) =>
  ([['Tout', -1], ['Informations', 2], ['Conseils', 0], ['Découvertes', 1]] as const).map(
    ([label, k]) => {
      const on = filter === k;
      return {
        label,
        bg: on ? '#16785E' : '#fff',
        fg: on ? '#fff' : '#16211D',
        bd: on ? '#16785E' : '#E6EBE9',
        onPick: () => onPick(k),
      };
    },
  );

// ─── Composeur ───────────────────────────────────────────────────────────────

/**
 * Les quatre types de publication. Le conseil n'y est pas : c'est une story
 * (décision T4).
 */
export const postTypesFor = (active: number, onPick: (i: number) => void) =>
  ([
    ['Victoire', '#E3F0EB', '#0F5C48', '#16785E'],
    ['Question', '#FBE3D4', '#B4581F', '#E0733A'],
    ['Info', '#F2F5F4', '#5D6B66', '#8A958F'],
    ['Discussion', '#E8EEEC', '#0F5C48', '#0F5C48'],
  ] as const).map(([label, b, f, d], i) => {
    const on = active === i;
    return { label, bg: on ? f : b, fg: on ? '#fff' : f, dot: on ? '#fff' : d, onPick: () => onPick(i) };
  });

// ─── Fil ─────────────────────────────────────────────────────────────────────

/**
 * Les publications de la maquette.
 *
 * `word` et `action` portent le VOCABULAIRE du type : « félicitations / Bravo »
 * sur une victoire, « réponses / Soutenir » sur une question (T1 §6). Et
 * `comment` devient « Répondre » sur une question.
 *
 * `ctx` n'expose que le NOM DU TYPE de parcours, jamais le titre personnel que
 * le membre lui a donné (règle dure 04 §2).
 */
export const feedPosts = [
  {
    name: 'Aïcha Diop', i: 'AD', bg: '#16785E', type: 'Discussion',
    tBg: '#E8EEEC', tFg: '#0F5C48', tDot: '#0F5C48',
    ctx: 'Installée · Lyon 7e · il y a 1 h',
    body: 'On organise un repas partagé pour les nouveaux arrivants. Quelle date vous arrange ?',
    poll: ([
      ['Samedi 22 mars', '58 %', true],
      ['Dimanche 23 mars', '30 %', false],
      ['Samedi 29 mars', '12 %', false],
    ] as const).map(([t, p, on]) => ({
      t, p, w: p.replace(' ', ''),
      fill: on ? '#E3F0EB' : '#F2F5F4',
      bd: on ? '1.5px solid #16785E' : '1px solid #E6EBE9',
      fw: on ? 700 : 500,
    })),
    pollMeta: '86 votes · se termine dans 3 jours · vous avez voté',
    n: 86, word: 'votes', meta: '12 commentaires',
    action: 'Participer', actionIcon: 'M4 5h12v8H8l-4 3zM20 9v8l-3-2h-6',
    reactBg: '#0F5C48', comment: 'Commenter', aBg: '#E8EEEC', aFg: '#0F5C48',
  },
  {
    name: 'Amina Diallo', i: 'AD', bg: '#B4581F', type: 'Victoire',
    tBg: '#E3F0EB', tFg: '#0F5C48', tDot: '#16785E',
    ctx: 'Parcours Études · Lyon · il y a 2 h',
    body: 'Attestation de virement irrévocable validée ce matin. Merci à la communauté pour vos retours sur la banque partenaire.',
    step: 'Caution bancaire et AVI validée',
    n: 42, word: 'félicitations', meta: '8 commentaires · 3 partages',
    action: 'Bravo',
    actionIcon: 'M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 21h8',
    reactBg: '#E0733A', comment: 'Commenter', aBg: '#E3F0EB', aFg: '#0F5C48',
  },
  {
    name: 'Marc Koudou', i: 'MK', bg: '#0F5C48', type: 'Info',
    tBg: '#F2F5F4', tFg: '#5D6B66', tDot: '#8A958F',
    ctx: 'Parcours Travail · Paris · il y a 4 h',
    body: 'Pour un garant à Paris : regardez Visale (gratuit, Action Logement) ou Garantme avant de céder aux agences qui demandent 3 fois le loyer.',
    // « certificat » est un document officiel : la règle dure interdit
    // « certifié » dans les LIBELLÉS, pas dans le corps (05-guides.md §2).
    tip: 'Le VLS-TS est accepté d’office pour le certificat Visale dès votre arrivée.',
    n: 19, word: 'mentions utiles', meta: '14 commentaires · 7 partages',
    action: 'Utile',
    actionIcon: 'M7 11v9M7 11l4-7c1.5 0 2.5 1 2.5 2.5V10h5a2 2 0 0 1 2 2l-1.5 6a2 2 0 0 1-2 2H7',
    reactBg: '#16785E', comment: 'Commenter', aBg: '#E3F0EB', aFg: '#0F5C48',
  },
  {
    name: 'Fatou Ndiaye', i: 'FN', bg: '#2FA37D', type: 'Question',
    tBg: '#FBE3D4', tFg: '#B4581F', tDot: '#E0733A',
    ctx: 'Installée · Lyon 7e · il y a 6 h',
    body: 'Quelqu’un connaîtrait un médecin généraliste qui prend de nouveaux patients sur Lyon 7e ou 3e ? C’est pour déclarer mon médecin traitant.',
    tags: ['Santé', 'Lyon7', 'CPAM'],
    n: 11, word: 'réponses', meta: '4 soutiens',
    action: 'Soutenir',
    actionIcon: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z',
    reactBg: '#E0733A', comment: 'Répondre', aBg: '#FBE3D4', aFg: '#B4581F',
  },
  {
    name: 'Kofi Boateng', i: 'KB', bg: '#E0733A', type: 'Victoire',
    tBg: '#E3F0EB', tFg: '#0F5C48', tDot: '#16785E',
    ctx: 'Parcours Travail · Lyon 3e · il y a 9 h',
    body: 'Premier jour chez mon employeur ! Il y a six mois je cherchais encore un stage. Merci à Sandra pour la relecture de mon CV.',
    photo: 'Photo de Kofi', photoH: '260px',
    n: 67, word: 'félicitations', meta: '21 commentaires',
    action: 'Bravo',
    actionIcon: 'M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 21h8',
    reactBg: '#E0733A', comment: 'Commenter', aBg: '#E3F0EB', aFg: '#0F5C48',
  },
];

// ─── Colonne de contexte ─────────────────────────────────────────────────────

export const events = [
  { d: '24', m: 'FÉV', t: 'Apéro Diaspora et Étudiants', s: 'Berges du Rhône · 19h00' },
  { d: '02', m: 'MAR', t: 'Atelier CV et stage', s: 'Maison des Assos · 14h30' },
];

export const arrivals = [
  { name: 'Kofi Boateng', sub: 'Arrivé il y a 3 jours', i: 'KB', bg: '#E0733A' },
  { name: 'Sarah Traoré', sub: 'Arrivée cette semaine', i: 'ST', bg: '#16785E' },
];

export const online = [
  { name: 'Aïcha Diop (Parraine)', i: 'AD', bg: '#0F5C48' },
  { name: 'Ibrahim S.', i: 'IS', bg: '#B4581F' },
  { name: 'Yasmine Benali', i: 'YB', bg: '#E0733A' },
];

// ─── Mobile ──────────────────────────────────────────────────────────────────

/** Le panneau de section devient une barre d'onglets horizontale (T1 §3.2). */
const M_TABS: readonly (readonly [string, number | null])[] = [
  ["Fil d'actualité", null],
  ['Guides', null],
  ['Entraide', 12],
  ['Réseaux', null],
  ['Parrainage', null],
  ['Villes', null],
  ['Événements', 3],
];

export const mTabs = M_TABS.map(([label, count], i) => ({
  label,
  count,
  bg: i === 0 ? '#16785E' : '#fff',
  fg: i === 0 ? '#fff' : '#16211D',
  bd: i === 0 ? '#16785E' : '#E6EBE9',
}));

/** Barre d'onglets basse : Agenda cède sa place à Compte (§10.1). */
const M_BOTTOM: readonly (readonly [string, string])[] = [
  ['Accueil', I.home],
  ['Parcours', I.path],
  ['Entraide', I.heart],
  ['Services', I.serv],
  ['Compte', I.account],
];

export const mBottom = M_BOTTOM.map(([label, icon], i) => ({
  label,
  icon,
  bg: i === 0 ? '#E3F0EB' : 'transparent',
  fg: i === 0 ? '#0F5C48' : '#8A958F',
}));

/** Ce que les deux cadres générés consomment. */
export interface A01Data {
  rail: typeof rail;
  panelFil: typeof panelFil;
  shortcuts: typeof shortcuts;
  stories: ReturnType<typeof storiesFor>;
  storyFilters: ReturnType<typeof storyFiltersFor>;
  postTypes: ReturnType<typeof postTypesFor>;
  feedPosts: typeof feedPosts;
  events: typeof events;
  arrivals: typeof arrivals;
  online: typeof online;
  mTabs: typeof mTabs;
  mBottom: typeof mBottom;
}
