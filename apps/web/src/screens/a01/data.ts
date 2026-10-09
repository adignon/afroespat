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

/**
 * ─── LA DESTINATION EST UN CHAMP DE L'ENTRÉE, COMME SON ICÔNE ───────────────
 *
 * Le rail de cette maquette est une BOUCLE : `<sc-for list="{{ rail }}" as="r">`
 * n'écrit qu'UN `<a>` pour cinq entrées au rendu, et son libellé est
 * `{{ r.label }}`. Aucun mécanisme indexé sur le texte ne peut donc lui donner
 * cinq destinations — c'est exactement pourquoi aucun lien du rail ne marchait.
 * L'adresse voyage avec la donnée, et le cadre la pose par `href={r.href}` (clé
 * `liens` de `tools/screens/03-accueil.mjs`, table dans `tools/squelette-membre.mjs`).
 *
 * `/services/logement` ET NON `/services` : il n'existe aucune route `/services`,
 * et la maquette ne dessine aucune planche « Services — accueil ». La première
 * planche du module est S01, « Logement — liste ». C'est un arbitrage de produit,
 * pris par défaut et REMONTÉ au porteur, pas une évidence.
 */
const RAIL_ITEMS: readonly (readonly [string, string, string])[] = [
  ['Accueil', I.home, '/accueil'],
  ['Parcours', I.path, '/parcours'],
  ['Entraide', I.heart, '/entraide'],
  ['Services', I.serv, '/services/logement'],
  ['Agenda', I.cal, '/agenda'],
];

/**
 * ─── POURQUOI « ACCUEIL » RESTE L'ENTRÉE ALLUMÉE, ET POURQUOI C'EST VRAI ────
 *
 * `i === 0` vient de la maquette, et à la relecture cela ressemble à un défaut :
 * une page qui s'annoncerait sous le nom d'une autre. Vérifié écran par écran, ce
 * n'en est pas un ICI, et il faut l'écrire pour que personne ne le « corrige » :
 *
 * les ONZE écrans qui consomment ce rail sont A01 (`/accueil`), A02
 * (`/publications/:id`), A03/A04/A06 (`/guides…`), A07–A10 (`/reseaux…`) et
 * A11/A12 (`/villes…`). Or `T5 §0` range Guides & Démarches, Réseaux,
 * Parrainage, Villes & Membres et Événements dans le PANNEAU D'ACCUEIL : ces
 * pages SONT atteintes par l'entrée « Accueil », et c'est le PANNEAU qui dit
 * ensuite laquelle — `panelGuides`, `panelReseaux`, `panelVilles`. L'écran annonce
 * donc « Accueil › Réseaux », ce qui est juste.
 *
 * Les 52 autres cadres membre n'emploient PAS cette donnée : leur rail est écrit
 * en clair dans leur maquette, qui peint elle-même la bonne entrée — « Agenda »
 * sur l'agenda, « Entraide » sur l'entraide, et AUCUNE sur Compte, Messages et
 * Recherche, dont aucune des cinq entrées ne désigne la page. Mesuré sur les 52.
 *
 * Déduire l'entrée allumée du chemin courant demanderait une table « quelle page
 * appartient à quel module » que ni la maquette ni les specs ne donnent — et la
 * première version écrite ici n'allumait RIEN sur `/guides`, parce qu'aucun des
 * cinq chemins ne préfixe `/guides`. Inventer cette table aurait éteint le rail
 * sur neuf écrans sur onze. On garde donc le dessin de la maquette.
 */
export const rail = RAIL_ITEMS.map(([label, icon, href], i) => ({
  label,
  icon,
  href,
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
const PANEL_ITEMS: readonly (readonly [string, string, number | null, string])[] = [
  ["Fil d'actualité", I.feed, null, '/accueil'],
  ['Guides & Démarches', I.book, null, '/guides'],
  ["Fil d'entraide", I.heart, 12, '/entraide'],
  ['Réseaux', I.net, null, '/reseaux'],
  ['Parrainage', I.mentor, null, '/parrainage'],
  ['Villes & Membres', I.city, null, '/villes'],
  ['Événements', I.cal, 3, '/agenda'],
];

/**
 * Les sept destinations sont des routes VÉRIFIÉES dans `app/(app)/`, et le cadre
 * les pose par `href={m.href}` — même mécanisme que le rail, pour la même raison :
 * la maquette n'écrit qu'UNE entrée dans `<sc-for as="m">`.
 *
 * « Fil d'actualité » mène à `/accueil` et « Événements » à `/agenda`, c'est-à-dire
 * aux mêmes pages que deux entrées du rail. Ce n'est pas un doublon à corriger :
 * `T5 §0` range bien ces deux-là dans le panneau d'accueil ET dans le rail.
 */
export const panel = (active: number) =>
  PANEL_ITEMS.map(([label, icon, count, href], i) => ({
    label,
    icon,
    count,
    href,
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
    /** Le hachurage de la maquette : ces cartes sont des DESSINS, pas des données. */
    photoFond: 'repeating-linear-gradient(135deg,#E3ECE8 0 14px,#DCE6E1 14px 28px)',
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

/**
 * ─── LA BARRE D'ONGLETS DE SECTION, ET SES SEPT DESTINATIONS ────────────────
 *
 * Le panneau de section devient une barre d'onglets horizontale (T1 §3.2), et ses
 * sept entrées mènent aux SEPT MÊMES PAGES que celui de l'ordinateur — voir
 * `PANEL_ITEMS` ci-dessus, dont les routes sont reprises une par une. Rien n'est
 * choisi ici.
 *
 * ELLES N'ÉTAIENT PAS DES LIENS, et le compteur de « href="#" » ne pouvait pas le
 * dire : la maquette dessine ces sept pastilles en `<span>`. Ce n'étaient pas des
 * liens cassés — CE N'ÉTAIENT PAS DES LIENS. Sur un téléphone, c'était toute la
 * navigation de section qui ne répondait pas, et c'est ce que le porteur a touché.
 */
const M_TABS: readonly (readonly [string, number | null, string])[] = [
  ["Fil d'actualité", null, '/accueil'],
  ['Guides', null, '/guides'],
  ['Entraide', 12, '/entraide'],
  ['Réseaux', null, '/reseaux'],
  ['Parrainage', null, '/parrainage'],
  ['Villes', null, '/villes'],
  ['Événements', 3, '/agenda'],
];

export const mTabs = M_TABS.map(([label, count, href], i) => ({
  label,
  count,
  href,
  bg: i === 0 ? '#16785E' : '#fff',
  fg: i === 0 ? '#fff' : '#16211D',
  bd: i === 0 ? '#16785E' : '#E6EBE9',
}));

/**
 * Barre d'onglets basse : Agenda cède sa place à Compte (§10.1).
 *
 * Les QUATRE PREMIÈRES entrées sont les quatre premières du RAIL d'ordinateur, aux
 * mêmes adresses (`RAIL_ITEMS` ci-dessus) : il n'y a rien à décider, et c'est la
 * même barre sous une autre forme.
 *
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ « COMPTE » MÈNE AU MODULE COMPTE — IL NE MENAIT NULLE PART                 ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « Le bouton compte dans le menu sur mobile au niveau du bottom bar
 * ne marche pas. »
 *
 * CE QUI ÉTAIT ÉCRIT ICI, et qui était vrai au jour où ça a été écrit : « il
 * n'existe aucune route `/compte` […] choisir laquelle EST "Compte" serait
 * décider à la place du porteur ». `href` restait donc `undefined`, et l'onglet
 * était aussi inerte que le `<div>` de la maquette.
 *
 * LE PORTEUR A TRANCHÉ EN LE SIGNALANT. `app/(app)/compte/page.tsx` existe
 * maintenant et redirige vers `/compte/profil` — la PREMIÈRE des dix pages du
 * module dans T5 §11, et la première entrée du panneau « MON COMPTE » que les
 * cadres d'ordinateur dessinent. Ce n'est donc plus un choix inventé : c'est
 * l'ordre que la maquette écrit elle-même.
 *
 * La redirection plutôt qu'un lien direct vers `/compte/profil` : l'onglet dit
 * « Compte », et l'adresse doit dire la même chose. Le jour où le module gagne
 * une page d'accueil propre, c'est la redirection qui change, pas les onze
 * cadres qui portent cette barre.
 */
const M_BOTTOM: readonly (readonly [string, string, string | undefined])[] = [
  ['Accueil', I.home, '/accueil'],
  ['Parcours', I.path, '/parcours'],
  ['Entraide', I.heart, '/entraide'],
  ['Services', I.serv, '/services/logement'],
  ['Compte', I.account, '/compte'],
];

export const mBottom = M_BOTTOM.map(([label, icon, href], i) => ({
  label,
  icon,
  href,
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
// A01S (« Créer un sondage ») ne consomme AUCUNE donnée : son balisage est
// entièrement statique dans la maquette, faute de route — `createPostSchema` est
// `.strict()` et ne porte aucun champ de sondage. Rien à écrire pour elle, et
// c'est le transcodeur qui le dit — il la génère avec zéro propriété.
//
// A01G (« Lier un guide ») ÉTAIT dans le même cas, et ne l'est PLUS : ses quatre
// cartes de guide sont des DONNÉES (`GET /guides`), et son contrat vit dans
// `screens/a01g/data.ts` (`A01GData`), sur le modèle de A01C et A01P. Ce
// commentaire affirmait le contraire alors que le cadre lisait déjà
// `guidesSuggeres` et `guidesTrouves` : c'est cette contradiction entre le code et
// sa documentation qui avait laissé passer le défaut de compilation du lot.

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
  /**
   * ╔═════════════════════════════════════════════════════════════════════╗
   * ║ LE SIGNET ET LE MENU DE L'AUTEUR                                       ║
   * ╚═════════════════════════════════════════════════════════════════════╝
   *
   * `isAuthor` VIENT DU SERVEUR (`postCardSchema.isAuthor`), jamais d'une
   * comparaison faite ici : un menu de suppression affiché à tort serait une
   * promesse que l'API refuserait, et la comparaison aurait besoin de l'identité
   * du lecteur, que la carte ne porte pas.
   *
   * TOUS FACULTATIFS : les cartes d'exemple de ce fichier sont des DESSINS. Sans
   * `onEnregistrer`, le signet est un bouton sans geste — ce qu'il était avant ce
   * lot, et ce qu'il doit rester sur une planche de documentation.
   */
  readonly isAuthor?: boolean;
  readonly enregistre?: boolean;
  /**
   * « J'AI DÉJÀ RÉAGI » — DÉRIVÉ de `postCardSchema.reaction.mine`, qui porte
   * le GENRE de la réaction (ou `null`), jamais d'une bascule locale. Le porteur : « quand l'utilisateur clique dessus, il faut
   * que l'icône de réaction devienne filled ». Le champ existait dans la réponse
   * et arrivait jusqu'à la carte ; personne ne le LISAIT, et le cœur restait
   * vide une fois la réaction prise.
   *
   * FACULTATIF : les cartes dessinées de la maquette n'en portent pas, et une
   * carte sans réaction n'est pas une carte « non réagie ».
   */
  readonly reagi?: boolean;
  readonly onEnregistrer?: () => void;
  readonly onModifier?: () => void;
  readonly onSupprimer?: () => void;
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
  /**
   * LE FOND DU BLOC PHOTO — l'image, ou le hachurage de la maquette.
   *
   * Le porteur : « les images ne marchent pas ». MESURÉ : le bloc gardait le
   * `repeating-linear-gradient` de la planche ET affichait `{p.photo}` COMME
   * TEXTE — c'est-à-dire l'adresse du média, en gris, sur un rectangle rayé.
   * Même défaut, même endroit et même correction que `photoFond` sur la story.
   *
   * FACULTATIF : le bloc n'est rendu que sous `p.photo`, et les cartes d'exemple de
   * ce fichier sont des DESSINS — elles n'ont pas d'image à montrer.
   */
  readonly photoFond?: string;
  /**
   * TOUTES LES ADRESSES D'IMAGE, dans l'ordre de `position`.
   *
   * `photoFond` ne porte que la première, DÉJÀ RECADRÉE en « couvrir », et la
   * carte n'en montrait qu'une alors que §2.4 en autorise quatre.
   * `CarrouselPhotos` lit CELLE-CI parce qu'il a besoin des deux recadrages : la
   * carte couvre, la visionneuse contient. `photoFond` reste pour les cartes
   * d'exemple de ce fichier, qui sont des DESSINS sans image.
   */
  readonly photoUrls?: readonly string[];
  readonly aBg: string;
  readonly aFg: string;
  readonly step?: string;
  readonly photo?: string;
  readonly photoH?: string;
  readonly tip?: string;
  readonly tags?: readonly string[];
  /**
   * ╔════════════════════════════════════════════════════════════════════════╗
   * ║ LE SONDAGE D'UNE PUBLICATION — DESSINÉ DEPUIS LE DÉBUT                ║
   * ╚════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur : « la création de sondage […] ne marche pas ». Le bloc existait
   * dans la planche, cette prise existait, et la BASE ne savait pas rattacher un
   * sondage à une publication — `polls.community_id` était obligatoire. Il est
   * devenu facultatif, exclusif de `post_id` (migration
   * `20261007040000_sondage_et_guides_sur_publication`).
   *
   * `optionId` et `pollId` sont POSÉS, pas dessinés : la maquette ne connaît que
   * des pourcentages. Sans eux, une option ne peut pas être votée — c'est
   * exactement la même histoire que `postId` sur la carte.
   */
  readonly poll?: readonly {
    readonly t: string;
    readonly p: string;
    readonly w: string;
    readonly fill: string;
    readonly bd: string;
    readonly fw: number;
    readonly optionId?: string;
    readonly pollId?: string;
    /**
     * LE SONDAGE EST TERMINÉ — l'option n'est plus un bouton actif.
     *
     * Facultatif comme les deux précédents : la maquette n'en sait rien, et les
     * cartes d'exemple de ce fichier sont des dessins. Absent, le bouton reste
     * cliquable, ce qui est le cas courant d'un sondage ouvert.
     */
    readonly clos?: boolean;
  }[];
  /**
   * LA QUESTION DU SONDAGE. Facultative : les cartes d'exemple de ce fichier sont
   * des DESSINS, et une publication d'avant ce lot n'en porte pas. Absente, le
   * cadre ne dessine rien au-dessus des réponses — plutôt qu'une ligne vide.
   */
  readonly pollQuestion?: string;
  readonly pollMeta?: string;
  /**
   * LES GUIDES LIÉS — « Jusqu'à 3. Étiquettes vertes avec croix. »
   *
   * `slug` et non seulement `id` : une étiquette MÈNE au guide, et un guide
   * s'ouvre par son slug. Le serveur le rend, l'écran n'a rien à résoudre.
   */
  readonly guides?: readonly { readonly slug: string; readonly title: string }[];
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
  /**
   * L'IDENTIFIANT DE LA STORY — ce qui rend la bulle ouvrable.
   *
   * Le porteur : « ajouter le click sur les stories déjà créé ». `storiesFrom`
   * le posait DÉJÀ sur chaque bulle depuis le branchement du ruban ; il manquait
   * seulement à ce type, donc le transcodeur ne pouvait pas en faire un lien.
   * Une story publiée ne pouvait plus jamais être rouverte, alors que
   * `/stories/[id]` sert la planche A13 depuis le début.
   */
  readonly storyId: string;
  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LE FOND DE LA CARTE — « Fil d'actualité v2 » montre la story entière    ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur : « Change la section de stories comme sur la page ci. »
   *
   * La bande d'avant montrait un ROND d'initiales ; la nouvelle montre la story
   * EN FOND, derrière un voile dégradé. Il lui faut donc une image — ou, à
   * défaut, la couleur que l'auteur a choisie à la composition.
   *
   * C'EST UNE VALEUR CSS DE FOND, pas une adresse : `url("…") center/cover
   * no-repeat` comme partout ailleurs dans le dépôt, ou simplement `#2D6A4F`.
   * Sans `cover` et `no-repeat`, le navigateur poserait l'image à sa taille
   * naturelle et la répéterait.
   */
  readonly fond: string;
  /** `/stories/<id>` — la carte entière devient un lien. */
  readonly lien: string;
  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ CE QUE LA CARTE MONTRE — LE CONTENU, PAS UNE ÉTIQUETTE                  ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur : « Le preview doit montrer déjà le contenu exact comme affiché au
   * display story. »
   *
   * `caption` portait le LIEU ou la catégorie — « Logement », « Lyon ». C'est une
   * étiquette, pas la story. `apercu` porte son CORPS : exactement le texte que
   * l'écran de lecture écrit au centre du fond (A13, `st.text`), à la taille de
   * la carte.
   *
   * AUCUNE COUPE ICI : le corps d'une story tient en 280 caractères (règle de
   * composition), et la carte le borne par son dessin — trois lignes, puis le
   * débordement est masqué. Couper au mot près demanderait de connaître la
   * largeur rendue, que la donnée ne connaît pas.
   */
  readonly apercu: string;
  /**
   * VRAI quand `fond` est une PHOTO, faux quand c'est un aplat.
   *
   * L'écran de lecture ne pose son voile dégradé que sur une photo (A13) : sur
   * un aplat, il assombrirait une couleur choisie exprès. La vignette suit la
   * même règle, et elle ne peut pas la deviner d'une valeur CSS sans la lire au
   * préfixe — ce qui marcherait jusqu'au jour où la recette change.
   */
  readonly estPhoto: boolean;
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
  /**
   * LE COMPTEUR « UTILE », ET POURQUOI IL EST FACULTATIF.
   *
   * Aucune réaction de commentaire n'existe — ni table, ni colonne, ni route. La
   * prise reste déclarée parce que la maquette la dessine, et le cadre ne REND le
   * compteur que si elle est là : sans ça, l'ordinateur affichait un pouce sans
   * chiffre et le téléphone « Utile · » suivi de rien. Un `0` serait pire : il
   * affirmerait que personne n'a trouvé le commentaire utile.
   */
  readonly likes?: number;
  readonly likeFg?: string;
  /**
   * « Répondre » — désigne la RACINE à laquelle on répond.
   *
   * FACULTATIF : les cartes d'exemple de ce fichier sont des DESSINS, et la
   * planche n'ouvre l'affordance que sous `canReply`, qui ne vaut que pour une
   * racine (§2.5 — une seule profondeur, pas de réponse à une réponse).
   */
  readonly onRepondre?: () => void;
  /**
   * SIGNALER CE COMMENTAIRE.
   *
   * Le porteur : « sur les publications le signalement des commentaires ne
   * marche pas non plus. » La planche dessine `<a href="#">Signaler</a>` sous
   * chaque commentaire — un lien mort.
   *
   * FACULTATIF : les commentaires d'exemple de ce fichier sont des DESSINS, et
   * on ne signale pas un dessin. Le cadre éteint alors le bouton plutôt que de
   * promettre une fenêtre qui ne s'ouvrirait pas.
   */
  readonly onSignaler?: () => void;
}

/** Un des trois contrôles du bas du composeur, dans son apparence du moment. */
export interface PastilleComposeur {
  readonly garni: boolean;
  /** « Sondage », « 1 guide lié », « 2 images » — vide quand le rond est nu. */
  readonly libelle: string;
  /** Le nom accessible, TOUJOURS présent : un rond nu n'a pas de texte. */
  readonly titre: string;
  readonly encre: string;
}

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ CE QUE LA FENÊTRE DE SONDAGE LIT — ET RIEN D'AUTRE                        ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « Sondage et guides liés : sur mobile ça ne marche pas aussi. »
 *
 * La fenêtre A01S ne lit que le sondage. Tant qu'elle déclarait `A01Data`, la
 * monter demandait de fournir le fil, les stories, les raccourcis et vingt
 * autres prises qu'elle n'ouvre jamais — ce qui a suffi à ce qu'aucune autre
 * page qu'`/accueil` ne puisse l'afficher.
 *
 * `A01Data` l'étend : la page du fil s'y étale comme avant, sans changement.
 */
export interface A01SData {
  sondageQuestion: string;
  onSondageQuestion: (event: { target: { value: string } }) => void;
  sondageOptions: readonly {
    readonly texte: string;
    readonly onTexte: (event: { target: { value: string } }) => void;
    readonly onRetirer: () => void;
    /** Faux en dessous de deux options : un sondage à une réponse n'en est pas un. */
    readonly retirable: boolean;
  }[];
  onAjouterOption: () => void;
  /** Les quatre durées dessinées — 1, 3, 7, 14 jours — dont une retenue. */
  sondageDurees: readonly {
    readonly label: string;
    readonly on: boolean;
    readonly bg: string;
    readonly fg: string;
    readonly onPick: () => void;
  }[];
  /**
   * « Plusieurs réponses possibles » — le SEUL des trois interrupteurs qui ait
   * quelque chose à changer : `polls.is_multiple`. Les deux autres décrivent des
   * invariants et restent inertes, avec leur raison en infobulle.
   */
  sondageMultiple: boolean;
  onSondageMultiple: () => void;
  /**
   * LES DEUX AUTRES RÉGLAGES — ils étaient inertes, le porteur en a fait des
   * choix : « non, fais de ça un réglage ».
   *
   * `sondageApresVote` : allumé (le défaut) = les comptes restent masqués tant
   * qu'on n'a pas voté. C'est l'ancienne règle, donc rien ne change pour les
   * sondages déjà créés. Éteint = les résultats sont visibles tout de suite.
   *
   * `sondageAnonyme` : allumé (le défaut) = seuls les totaux sortent. Éteint = la
   * réponse nomme les votants de chaque option, et l'écran les affiche sous le
   * sondage. Le défaut est le silence : un sondage créé sans y toucher ne nomme
   * personne.
   */
  sondageApresVote: boolean;
  onSondageApresVote: () => void;
  sondageAnonyme: boolean;
  onSondageAnonyme: () => void;
  onValiderSondage: () => void;
  onAnnulerSondage: () => void;
  /** Éteint tant que la question ou deux réponses manquent. */
  sondageBloque: boolean;
}

export interface A01Data extends A01SData {
  rail: typeof rail;
  panelFil: typeof panelFil;
  shortcuts: typeof shortcuts;
  stories: readonly StoryView[];
  storyFilters: ReturnType<typeof storyFiltersFor>;
  postTypes: ReturnType<typeof postTypesFor>;
  feedPosts: readonly FeedPostView[];
  /**
   * ╔════════════════════════════════════════════════════════════════════════╗
   * ║ LE COMPOSEUR DU FIL — IL N'AVAIT AUCUN ÉTAT                            ║
   * ╚════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur : « la création de la publication dans le fil d'actualité ne marche
   * pas ». MESURÉ : le seul champ de saisie du cadre d'ordinateur était celui de
   * la barre haute. La zone « Que voulez-vous partager avec la diaspora ? » était
   * un `<div>` de texte, et « Publier » un bouton sans geste.
   *
   * `screens/accueil/composeur.test.ts` le disait déjà, et prévoyait ce moment :
   * « le composeur N'A AUCUN ÉTAT dans l'application […] quand le composeur aura un
   * état — lot 3, quand `POST /posts` acceptera des pièces jointes — les trois
   * constantes déménagent dans le garde-fou d'exécution ».
   */
  composeurTexte: string;
  onComposeurTexte: (event: { target: { value: string } }) => void;
  onPublier: () => void;
  /** Éteint tant qu'il n'y a rien à publier, et pendant l'envoi. */
  publierBloque: boolean;
  /** Ouvre le sélecteur de fichiers. §2.4 : quatre images au plus. */
  onAjouterImage: () => void;

  /**
   * ╔════════════════════════════════════════════════════════════════════════╗
   * ║ LE COMPOSEUR GARNI — LA PLANCHE QUE JE N'AVAIS PAS CHERCHÉE           ║
   * ╚════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur : « quand les éléments sont ajoutés au champ de la publication, ça
   * doit se présenter comme sur le A01·S — COMPOSEUR AVEC PIÈCES JOINTES ».
   *
   * Le composeur a DEUX états dessinés, vide et garni, et je n'avais transcodé que
   * le premier. Les pièces jointes partaient bien au serveur — mesuré — sans que
   * rien ne les montre. C'est le défaut le plus facile à commettre ici : croire
   * qu'un dessin manque alors qu'il est sur la planche d'à côté.
   */
  composeurGarni: boolean;
  /** Les images déposées : la vignette de 92 px et sa croix. */
  composeurImages: readonly {
    readonly fond: string;
    readonly nom: string;
    readonly retirer: string;
    readonly onRetirer: () => void;
  }[];
  /** « 2 / 4 », dans la case en tireté. §2.4 : quatre au plus. */
  composeurImagesCompte: string;
  /** La case en tireté est un BOUTON : éteinte quand les quatre sont là. */
  composeurAjoutBloque: boolean;
  /** La carte de sondage, ou `null`. */
  composeurSondage: {
    readonly question: string;
    readonly options: readonly string[];
    /** « 3 jours · résultats après le vote · anonyme » — composée des RÉGLAGES. */
    readonly meta: string;
    readonly onModifier: () => void;
    readonly onRetirer: () => void;
  } | null;
  composeurGuides: readonly {
    readonly titre: string;
    readonly retirer: string;
    readonly onRetirer: () => void;
  }[];
  /**
   * LES TROIS CONTRÔLES DU BAS, dans l'une ou l'autre de leurs apparences
   * dessinées : rond gris à icône quand ils ne portent rien, pastille verte à
   * libellé quand ils portent quelque chose.
   */
  composeurPastilles: {
    readonly sondage: PastilleComposeur;
    readonly guides: PastilleComposeur;
    readonly images: PastilleComposeur;
  };

  /**
   * ╔════════════════════════════════════════════════════════════════════════╗
   * ║ LA FENÊTRE « CRÉER UN SONDAGE » — ELLE N'AVAIT PAS UN SEUL CHAMP      ║
   * ╚════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur : « la création de sondage […] ne marche pas ». MESURÉ : zéro
   * `<input>` dans tout le cadre — la question, les trois options et la durée
   * étaient des `<div>` portant les exemples de la maquette.
   *
   * Le sondage n'est PAS envoyé par cette fenêtre : elle le pose sur le
   * composeur, et c'est « Publier » qui l'envoie, dans la même transaction que la
   * publication. Deux appels laisseraient une publication dont la maquette promet
   * un sondage et qui n'en a pas.
   *
   * ⚠ DEUX INTERRUPTEURS SUR TROIS RESTENT DESSINÉS, et il faut dire lesquels :
   * « Résultats visibles après le vote » n'est pas une option mais LA RÈGLE
   * (§2.3), et « Vote anonyme » n'a aucune colonne — `poll_votes` porte
   * `user_id`, et aucune réponse ne rend les noms des votants. REMONTÉS.
   */
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
// met. A01S garde `A01Data` : elle ne consomme rien. A01G, elle, a MAINTENANT son
// propre contrat (`screens/a01g/data.ts`), et sa donnée — `guidesSuggeres`,
// `guidesTrouves` — vit dans `screens/accueil/data.ts`, là où la maquette l'écrit.
//
// `shareContactsFor` et `SHARE_SELECTION_DEFAULT` ne servent plus à l'écran
// branché — les contacts de partage viennent de l'API (`shareContactsDe`, dans
// `screens/a01p/data.ts`) et rien n'est coché d'avance. Ils restent le DESSIN de
// la maquette, et c'est à ce titre qu'ils sont conservés.
