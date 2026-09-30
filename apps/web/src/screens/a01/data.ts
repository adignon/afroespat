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
  {
    i: 'SM',
    name: 'Sandra M.',
    bg: '#0F5C48',
    type: 'INFORMATION',
    k: 2,
    pillBg: '#0F5C48',
    caption: 'Guichet CAF',
    count: '2 confirment',
    seen: false,
  },
  {
    i: 'MK',
    name: 'Marc K.',
    bg: '#16785E',
    type: 'INFORMATION',
    k: 2,
    pillBg: '#0F5C48',
    caption: 'Préfecture fermée',
    count: '5 confirment',
    seen: true,
  },
  {
    i: 'AD',
    name: 'Aïcha D.',
    bg: '#B4581F',
    type: 'CONSEIL',
    k: 0,
    pillBg: '#16785E',
    caption: 'Visale rapide',
    count: '31 utile',
    seen: false,
  },
  {
    i: 'FN',
    name: 'Fatou N.',
    bg: '#2FA37D',
    type: 'LOGEMENT',
    k: 0,
    pillBg: '#16785E',
    caption: 'Dossier locatif',
    count: '12 utile',
    seen: false,
  },
  {
    i: 'KB',
    name: 'Kofi B.',
    bg: '#E0733A',
    type: 'DÉCOUVERTE',
    k: 1,
    pillBg: '#2FA37D',
    caption: 'Épicerie wax',
    count: '14 à voir',
    seen: false,
  },
  {
    i: 'YB',
    name: 'Yasmine B.',
    bg: '#0F5C48',
    type: 'DÉCOUVERTE',
    k: 1,
    pillBg: '#2FA37D',
    caption: 'Maquis Lyon 7',
    count: '9 à voir',
    seen: true,
  },
];

/** Anneau épais vert = pas encore vue ; anneau fin gris = vue. Jamais de dégradé (T1 §4.2). */
export const storiesFor = (filter: number) =>
  ALL_STORIES.filter((s) => filter < 0 || s.k === filter).map((s) => ({
    ...s,
    ring: s.seen ? '1.5px solid #CBD5D1' : '3px solid #16785E',
    pad: '3px',
  }));

export const storyFiltersFor = (filter: number, onPick: (k: number) => void) =>
  (
    [
      ['Tout', -1],
      ['Informations', 2],
      ['Conseils', 0],
      ['Découvertes', 1],
    ] as const
  ).map(([label, k]) => {
    const on = filter === k;
    return {
      label,
      bg: on ? '#16785E' : '#fff',
      fg: on ? '#fff' : '#16211D',
      bd: on ? '#16785E' : '#E6EBE9',
      onPick: () => onPick(k),
    };
  });

// ─── Composeur ───────────────────────────────────────────────────────────────

/**
 * Les quatre types de publication. Le conseil n'y est pas : c'est une story
 * (décision T4).
 */
export const postTypesFor = (active: number, onPick: (i: number) => void) =>
  (
    [
      ['Victoire', '#E3F0EB', '#0F5C48', '#16785E'],
      ['Question', '#FBE3D4', '#B4581F', '#E0733A'],
      ['Info', '#F2F5F4', '#5D6B66', '#8A958F'],
      ['Discussion', '#E8EEEC', '#0F5C48', '#0F5C48'],
    ] as const
  ).map(([label, b, f, d], i) => {
    const on = active === i;
    return {
      label,
      bg: on ? f : b,
      fg: on ? '#fff' : f,
      dot: on ? '#fff' : d,
      onPick: () => onPick(i),
    };
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
export const feedPosts: readonly FeedPostView[] = [
  {
    name: 'Aïcha Diop',
    i: 'AD',
    bg: '#16785E',
    type: 'Discussion',
    tBg: '#E8EEEC',
    tFg: '#0F5C48',
    tDot: '#0F5C48',
    ctx: 'Installée · Lyon 7e · il y a 1 h',
    body: 'On organise un repas partagé pour les nouveaux arrivants. Quelle date vous arrange ?',
    poll: (
      [
        ['Samedi 22 mars', '58 %', true],
        ['Dimanche 23 mars', '30 %', false],
        ['Samedi 29 mars', '12 %', false],
      ] as const
    ).map(([t, p, on]) => ({
      t,
      p,
      w: p.replace(' ', ''),
      fill: on ? '#E3F0EB' : '#F2F5F4',
      bd: on ? '1.5px solid #16785E' : '1px solid #E6EBE9',
      fw: on ? 700 : 500,
    })),
    pollMeta: '86 votes · se termine dans 3 jours · vous avez voté',
    n: 86,
    word: 'votes',
    meta: '12 commentaires',
    action: 'Participer',
    actionIcon: 'M4 5h12v8H8l-4 3zM20 9v8l-3-2h-6',
    reactBg: '#0F5C48',
    comment: 'Commenter',
    aBg: '#E8EEEC',
    aFg: '#0F5C48',
  },
  {
    name: 'Amina Diallo',
    i: 'AD',
    bg: '#B4581F',
    type: 'Victoire',
    tBg: '#E3F0EB',
    tFg: '#0F5C48',
    tDot: '#16785E',
    ctx: 'Parcours Études · Lyon · il y a 2 h',
    body: 'Attestation de virement irrévocable validée ce matin. Merci à la communauté pour vos retours sur la banque partenaire.',
    step: 'Caution bancaire et AVI validée',
    n: 42,
    word: 'félicitations',
    meta: '8 commentaires · 3 partages',
    action: 'Bravo',
    actionIcon: 'M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 21h8',
    reactBg: '#E0733A',
    comment: 'Commenter',
    aBg: '#E3F0EB',
    aFg: '#0F5C48',
  },
  {
    name: 'Marc Koudou',
    i: 'MK',
    bg: '#0F5C48',
    type: 'Info',
    tBg: '#F2F5F4',
    tFg: '#5D6B66',
    tDot: '#8A958F',
    ctx: 'Parcours Travail · Paris · il y a 4 h',
    body: 'Pour un garant à Paris : regardez Visale (gratuit, Action Logement) ou Garantme avant de céder aux agences qui demandent 3 fois le loyer.',
    // « certificat » est un document officiel : la règle dure interdit
    // « certifié » dans les LIBELLÉS, pas dans le corps (05-guides.md §2).
    tip: 'Le VLS-TS est accepté d’office pour le certificat Visale dès votre arrivée.',
    n: 19,
    word: 'mentions utiles',
    meta: '14 commentaires · 7 partages',
    action: 'Utile',
    actionIcon: 'M7 11v9M7 11l4-7c1.5 0 2.5 1 2.5 2.5V10h5a2 2 0 0 1 2 2l-1.5 6a2 2 0 0 1-2 2H7',
    reactBg: '#16785E',
    comment: 'Commenter',
    aBg: '#E3F0EB',
    aFg: '#0F5C48',
  },
  {
    name: 'Fatou Ndiaye',
    i: 'FN',
    bg: '#2FA37D',
    type: 'Question',
    tBg: '#FBE3D4',
    tFg: '#B4581F',
    tDot: '#E0733A',
    ctx: 'Installée · Lyon 7e · il y a 6 h',
    body: 'Quelqu’un connaîtrait un médecin généraliste qui prend de nouveaux patients sur Lyon 7e ou 3e ? C’est pour déclarer mon médecin traitant.',
    tags: ['Santé', 'Lyon7', 'CPAM'],
    n: 11,
    word: 'réponses',
    meta: '4 soutiens',
    action: 'Soutenir',
    actionIcon: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z',
    reactBg: '#E0733A',
    comment: 'Répondre',
    aBg: '#FBE3D4',
    aFg: '#B4581F',
  },
  {
    name: 'Kofi Boateng',
    i: 'KB',
    bg: '#E0733A',
    type: 'Victoire',
    tBg: '#E3F0EB',
    tFg: '#0F5C48',
    tDot: '#16785E',
    ctx: 'Parcours Travail · Lyon 3e · il y a 9 h',
    body: 'Premier jour chez mon employeur ! Il y a six mois je cherchais encore un stage. Merci à Sandra pour la relecture de mon CV.',
    photo: 'Photo de Kofi',
    photoH: '260px',
    n: 67,
    word: 'félicitations',
    meta: '21 commentaires',
    action: 'Bravo',
    actionIcon: 'M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 21h8',
    reactBg: '#E0733A',
    comment: 'Commenter',
    aBg: '#E3F0EB',
    aFg: '#0F5C48',
  },
];

// ─── Colonne de contexte ─────────────────────────────────────────────────────

export const events: readonly EventView[] = [
  { d: '24', m: 'FÉV', t: 'Apéro Diaspora et Étudiants', s: 'Berges du Rhône · 19h00' },
  { d: '02', m: 'MAR', t: 'Atelier CV et stage', s: 'Maison des Assos · 14h30' },
];

export const arrivals: readonly PersonView[] = [
  { name: 'Kofi Boateng', sub: 'Arrivé il y a 3 jours', i: 'KB', bg: '#E0733A' },
  { name: 'Sarah Traoré', sub: 'Arrivée cette semaine', i: 'ST', bg: '#16785E' },
];

export const online: readonly PersonView[] = [
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

// ─── Les quatre modales du fil (A01C, A01P, A01G, A01S) ──────────────────────
//
// Elles vivent ICI, et non dans un fichier à part, parce que la maquette les met
// dans le MÊME `renderVals()` que les stories et le fil : c'est un seul écran,
// avec des fenêtres qui s'ouvrent par-dessus. Les séparer donnerait deux sources
// pour un même état.
//
// A01G (« Lier un guide ») et A01S (« Créer un sondage ») ne consomment AUCUNE
// donnée : leur balisage est entièrement statique dans la maquette. Rien à écrire
// pour elles, et c'est le transcodeur qui le dit — il les génère avec zéro
// propriété.

/**
 * A01C — le fil de commentaires.
 *
 * `likeFg` est dérivé, exactement comme la maquette le dérive : au-delà de trois
 * appuis, le compteur passe au vert. `indent` et `indentM` sont deux valeurs
 * distinctes parce que la réponse est moins décalée sur mobile — la maquette les
 * écrit séparément plutôt que de calculer un pourcentage.
 */
export const thread = (
  [
    // `author: false` est ÉCRIT sur les quatre autres, alors que la maquette se
    // contente de l'omettre. Une propriété absente donne cinq formes d'objet
    // différentes, et `c.author` devient inaccessible sur l'union — c'est ce que
    // `tsc` a signalé. `false` dit la même chose que l'absence, et le dit à tous.
    {
      i: 'SM',
      bg: '#0F5C48',
      name: 'Sandra M.',
      phase: 'Installée · Lyon 3e',
      author: false,
      text: 'Bravo Amina ! Tu as pris quelle banque au final ? Je conseille souvent celle-là aux nouveaux.',
      time: 'il y a 1 h',
      likes: 6,
      indent: '0px',
      indentM: '0px',
      canReply: true,
      av: '38px',
    },
    {
      i: 'AD',
      bg: '#B4581F',
      name: 'Amina Diallo',
      phase: 'Étudiante · Lyon',
      author: true,
      text: 'Merci ! La banque partenaire de mon école, virement reçu en 5 jours.',
      time: 'il y a 50 min',
      likes: 3,
      indent: '50px',
      indentM: '44px',
      canReply: false,
      av: '32px',
    },
    {
      i: 'KB',
      bg: '#E0733A',
      name: 'Kofi Boateng',
      phase: 'Arrivé · Lyon 3e',
      author: false,
      text: 'Félicitations ! Prochaine étape le logement, courage pour Visale.',
      time: 'il y a 40 min',
      likes: 2,
      indent: '0px',
      indentM: '0px',
      canReply: true,
      av: '38px',
    },
    {
      i: 'FN',
      bg: '#2FA37D',
      name: 'Fatou Ndiaye',
      phase: 'Installée · Lyon 7e',
      author: false,
      text: 'Super nouvelle. Garde bien l’attestation, la préfecture la redemande parfois.',
      time: 'il y a 20 min',
      likes: 4,
      indent: '0px',
      indentM: '0px',
      canReply: true,
      av: '38px',
    },
    {
      i: 'MK',
      bg: '#16785E',
      name: 'Marc Koudou',
      phase: 'Installé · Paris',
      author: false,
      text: 'Bien vu Fatou, c’est arrivé à mon cousin l’an dernier.',
      time: 'il y a 10 min',
      likes: 1,
      indent: '50px',
      indentM: '44px',
      canReply: false,
      av: '32px',
    },
  ] as const
).map((c) => ({ ...c, likeFg: c.likes > 3 ? '#16785E' : '#8A958F' }));

/** La sélection de départ de la maquette : les deux premiers contacts, 0 et 2. */
export const SHARE_SELECTION_DEFAULT: readonly number[] = [0, 2];

const SHARE_CONTACTS = [
  { i: 'SM', name: 'Sandra M.', bg: '#0F5C48' },
  { i: 'AD', name: 'Aïcha Diop', bg: '#16785E' },
  { i: 'KB', name: 'Kofi B.', bg: '#E0733A' },
  { i: 'FN', name: 'Fatou N.', bg: '#2FA37D' },
  { i: 'YB', name: 'Yasmine B.', bg: '#B4581F' },
] as const;

/**
 * A01P — les contacts de partage, sélectionnables.
 *
 * « cliquez les contacts », écrit la maquette sous sa planche : c'est une
 * véritable interaction, pas une illustration. L'anneau vert marque la sélection,
 * et `onPick` bascule — d'où le passage de l'état, comme pour `storyFiltersFor`.
 *
 * L'anneau non sélectionné est `2.5px solid transparent` et non `none` : une
 * bordure qui apparaît déplacerait l'avatar de deux pixels et demi à chaque clic.
 */
export const shareContactsFor = (selected: readonly number[], onToggle: (index: number) => void) =>
  SHARE_CONTACTS.map((c, i) => {
    const on = selected.includes(i);
    return {
      ...c,
      on,
      ring: on ? '2.5px solid #16785E' : '2.5px solid transparent',
      onPick: () => onToggle(i),
    };
  });

/**
 * Le bouton d'envoi, dont le libellé COMPTE les contacts choisis.
 *
 * Sans sélection il devient inerte et le dit — « Choisissez un contact » — au lieu
 * d'un bouton désactivé qui n'explique rien. La maquette le calcule ainsi, et
 * c'est la bonne façon : le libellé porte l'état.
 */
export const shareButtonFor = (count: number) => ({
  shareBtn:
    count > 0 ? `Envoyer à ${count} contact${count > 1 ? 's' : ''}` : 'Choisissez un contact',
  shareBtnBg: count > 0 ? '#16785E' : '#CFE3DA',
  shareBtnFg: count > 0 ? '#fff' : '#5D8A79',
});

export const shareNets = [
  { i: 'LY', name: 'Lyon et Rhône', sub: '1 400 membres', bg: '#16785E' },
  { i: 'BN', name: 'Béninois en France', sub: '890 membres', bg: '#E0733A' },
] as const;

export const shareOut = [
  {
    label: 'Copier le lien',
    icon: 'M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1',
  },
  {
    label: 'WhatsApp',
    icon: 'M3 21l1.6-5A8.5 8.5 0 1 1 8 19.4zM9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.5-2-1-1 .8a4 4 0 0 1-1.8-1.8l.8-1-1-2z',
  },
  { label: 'Email', icon: 'M3 6h18v12H3zM3 7l9 6 9-6' },
] as const;

// ─── LES PRISES DU CADRE, DÉCLARÉES ─────────────────────────────────────────
//
// Ce bloc est le changement de fond du lot 3, et il vaut une explication.
//
// AVANT, `A01Data` décrivait ses données par `typeof feedPosts` : le CONTRAT du
// cadre était donc déduit des cinq publications d'exemple. Cela paraissait
// économique et c'était un piège à deux détentes :
//
//   1. le contrat portait les VALEURS de la maquette. `poll.t` n'était pas
//      `string` mais `'Samedi 22 mars' | 'Dimanche 23 mars' | 'Samedi 29 mars'`,
//      et `photoH` valait `never` sur les cartes qui n'en avaient pas. Aucune
//      donnée venue de l'API ne pouvait satisfaire un tel type — pas parce
//      qu'elle était mal formée, mais parce que le type décrivait un échantillon ;
//   2. il donnait l'illusion d'être vérifié. Le cadre compilait, `A01Data` était
//      « typé », et rien ne disait que ce type ne décrivait qu'un exemple.
//
// Les prises sont donc DÉCLARÉES ci-dessous : elles disent ce que le JSX
// transcodé LIT, ni plus ni moins. Les constantes de la maquette les satisfont
// — c'est vérifié par `satisfies`, donc le dessin reste la référence — et les
// données de l'API les satisfont aussi. Le JSX, lui, n'a pas bougé d'une virgule.

/**
 * Une carte de publication, telle que le cadre la lit.
 *
 * Les quatre derniers champs sont FACULTATIFS parce que la maquette les dessine
 * sur certaines cartes seulement. Les trois suivants — `poll`, `tags`, `tip` — le
 * sont aussi, et pour une autre raison qu'il faut dire : l'API n'a AUCUN champ qui
 * puisse les remplir. Ni `createPostSchema` (qui est `.strict()`), ni `model Post`,
 * ni 04 §2.4 ne connaissent de sondage, de mots-clés ou d'encadré sur une
 * publication. Ils restent déclarés pour que la maquette continue de se décrire
 * elle-même, et ils arrivent vides depuis l'API. Remonté au rapport de lot.
 */
export interface FeedPostView {
  /**
   * L'IDENTIFIANT DE LA PUBLICATION, et il n'est pas DESSINÉ : il est POSÉ.
   *
   * Les deux boutons « Commenter » et « Partager » vivent dans la boucle des
   * publications, et le transcodeur y pose maintenant
   * `data-modal-subject={p.postId}` (déclaré par `subject` dans
   * `tools/screens/03-accueil.mjs`). Sans ce champ, le JSX généré ne compilerait
   * pas — et c'est voulu : la prise du cadre et le convertisseur doivent se
   * répondre, sinon l'attribut arriverait vide sans que rien ne le dise.
   *
   * FACULTATIF parce que les cartes d'exemple de ce fichier n'ont pas
   * d'identifiant : ce sont des dessins, pas des publications. React n'écrit
   * alors aucun attribut, et l'écouteur délégué n'ouvre rien — plutôt que
   * d'ouvrir la fenêtre d'une autre publication, ce qui était le défaut.
   */
  readonly postId?: string;
  readonly name: string;
  readonly i: string;
  readonly bg: string;
  readonly type: string;
  readonly tBg: string;
  readonly tFg: string;
  readonly tDot: string;
  readonly ctx: string;
  readonly body: string;
  readonly n: number;
  readonly word: string;
  readonly meta: string;
  readonly action: string;
  readonly actionIcon: string;
  readonly reactBg: string;
  readonly comment: string;
  readonly aBg: string;
  readonly aFg: string;
  readonly step?: string;
  readonly photo?: string;
  readonly photoH?: string;
  readonly tip?: string;
  readonly tags?: readonly string[];
  readonly poll?: readonly {
    readonly t: string;
    readonly p: string;
    readonly w: string;
    readonly fill: string;
    readonly bd: string;
    readonly fw: number;
  }[];
  readonly pollMeta?: string;
}

/**
 * Une bulle de story.
 *
 * `count` est une CHAÎNE parce que le cadre l'affiche telle quelle (« 31 utile »),
 * et c'est un compteur de VOTES du type — jamais de vues (règle dure §2.6).
 */
export interface StoryView {
  readonly i: string;
  readonly name: string;
  readonly bg: string;
  readonly type: string;
  readonly k: number;
  readonly pillBg: string;
  readonly caption: string;
  readonly count: string;
  readonly seen: boolean;
  readonly ring: string;
  readonly pad: string;
}

/** Un événement de la colonne droite : jour, mois, titre, lieu et heure. */
export interface EventView {
  readonly d: string;
  readonly m: string;
  readonly t: string;
  readonly s: string;
}

/** Un nouvel arrivant, et un contact en ligne — la même forme à l'écran. */
export interface PersonView {
  readonly name: string;
  readonly i: string;
  readonly bg: string;
  readonly sub?: string;
}

/**
 * Un commentaire du fil A01C, avec son indentation.
 *
 * `likes` est FACULTATIF, et c'est un manque du back, pas un oubli : aucune
 * réaction de commentaire n'existe, ni en base ni dans aucune réponse d'API. La
 * maquette en dessine le compteur, donc la prise est là ; elle arrive vide.
 */
export interface CommentView {
  readonly i: string;
  readonly bg: string;
  readonly name: string;
  readonly phase: string;
  readonly author: boolean;
  readonly text: string;
  readonly time: string;
  readonly indent: string;
  readonly indentM: string;
  readonly canReply: boolean;
  readonly av: string;
  readonly likes?: number;
  readonly likeFg?: string;
}

export interface A01Data {
  rail: typeof rail;
  panelFil: typeof panelFil;
  shortcuts: typeof shortcuts;
  stories: readonly StoryView[];
  storyFilters: ReturnType<typeof storyFiltersFor>;
  postTypes: ReturnType<typeof postTypesFor>;
  feedPosts: readonly FeedPostView[];
  events: readonly EventView[];
  arrivals: readonly PersonView[];
  online: readonly PersonView[];
  mTabs: typeof mTabs;
  mBottom: typeof mBottom;
}

// ─── CE QUE `A01Data` NE DÉCLARE PLUS, ET POURQUOI ──────────────────────────
//
// Les sept prises des deux fenêtres du fil — `thread` pour A01C, les six du
// partage pour A01P — étaient déclarées ici, parce que le transcodeur donnait
// `A01Data` en signature aux quatre modales. Elles sont parties dans
// `screens/a01c/data.ts` et `screens/a01p/data.ts`, qui déclarent chacun le
// contrat de SES cadres.
//
// Ce n'est pas du rangement. Tant que la fenêtre de commentaires exigeait
// `A01Data`, la page devait lui passer le fil entier — stories, colonne droite,
// filtres — pour afficher cinq lignes de texte, et RIEN ne disait ce qu'elle
// consomme vraiment. Au moment de la brancher sur `GET /comments`, c'est
// précisément la question à laquelle il faut répondre.
//
// La DONNÉE, elle, n'a pas bougé : `thread`, `shareContactsFor`, `shareNets` et
// `shareOut` restent ci-dessus, là où le `renderVals()` unique de la maquette les
// met. A01G et A01S gardent `A01Data` : elles ne consomment rien.
//
// `shareContactsFor` et `SHARE_SELECTION_DEFAULT` ne servent plus à l'écran
// branché — les contacts de partage viennent de l'API (`shareContactsDe`, dans
// `screens/a01p/data.ts`) et rien n'est coché d'avance. Ils restent le DESSIN de
// la maquette, et c'est à ce titre qu'ils sont conservés.
