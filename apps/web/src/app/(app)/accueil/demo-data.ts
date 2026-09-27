import type { PostCardProps, StoryBubbleData } from '@app/ui';

/**
 * Données de démonstration de l'écran A01.
 *
 * Reprises de `docs/template/03 Accueil v2.dc.html` : ce sont les contenus que
 * la maquette affiche, conservés tels quels pour que le rendu soit comparable
 * au pixel près.
 *
 * ELLES DISPARAISSENT AU LOT 3, quand le fil sera branché sur l'API. Un seul
 * fichier, nommé pour ce qu'il est : rien ne se glissera ailleurs.
 */

export const DEMO_VIEWER = {
  displayName: 'Amina Diallo',
  firstName: 'Amina',
  initials: 'AD',
} as const;

export const DEMO_JOURNEY = {
  /** Le titre que le MEMBRE a donné. Visible ici, jamais dans le fil (règle dure 04 §2). */
  title: 'Mes études à Lyon',
  progressPct: 58,
  currentStepPosition: 7,
  currentStepTitle: 'Logement',
} as const;

export const DEMO_WHATS_NEW = { help: 3, events: 2 } as const;

export const DEMO_NETWORKS = [
  { name: 'Lyon', memberCount: 412, initials: 'LY', tone: 'green' as const },
  { name: 'Bénin', memberCount: 1_284, initials: 'BJ', tone: 'terracotta' as const },
  { name: 'Cuisine et saveurs', memberCount: 87, initials: 'CS', tone: 'greenStrong' as const },
];

export const DEMO_STORIES: StoryBubbleData[] = [
  { id: 's1', kind: 'INFORMATION', initials: 'MK', caption: 'Préfecture Lyon', voteLabel: '18 confirment', seen: false, tone: 'greenStrong' },
  { id: 's2', kind: 'CONSEIL', initials: 'FN', caption: 'Dossier CAF', voteLabel: '12 utile', seen: false, tone: 'green' },
  { id: 's3', kind: 'DECOUVERTE', initials: 'KB', caption: 'Épicerie Guillotière', voteLabel: '9 à voir', seen: false, tone: 'terracotta' },
  { id: 's4', kind: 'CONSEIL', initials: 'AD', caption: 'Compte bancaire', voteLabel: '7 utile', seen: true, tone: 'terracotta' },
  { id: 's5', kind: 'INFORMATION', initials: 'SD', caption: 'OFII rendez-vous', voteLabel: '5 confirment', seen: true, tone: 'green' },
];

/**
 * Les cinq publications de la maquette. Chaque type montre un encart différent :
 * sondage, étape franchie, « bon à savoir », étiquettes, photo. C'est ce qui
 * permet de vérifier le rendu de toutes les variantes d'un coup.
 */
export const DEMO_POSTS: (Omit<PostCardProps, 'shareLabel' | 'bookmarkLabel'> & { id: string })[] = [
  {
    id: 'p1',
    author: { name: 'Aïcha Diop', avatar: { initials: 'AD', tone: 'green' }, level: 'L2' },
    type: 'DISCUSSION',
    context: 'Installée · Lyon 7e · il y a 1 h',
    body: 'On organise un repas partagé pour les nouveaux arrivants. Quelle date vous arrange ?',
    poll: {
      options: [
        { label: 'Samedi 22 mars', percent: 58, chosen: true },
        { label: 'Dimanche 23 mars', percent: 30, chosen: false },
        { label: 'Samedi 29 mars', percent: 12, chosen: false },
      ],
      meta: '86 votes · se termine dans 3 jours · vous avez voté',
    },
    reactionCount: 86,
    meta: '12 commentaires',
  },
  {
    id: 'p2',
    author: { name: 'Amina Diallo', avatar: { initials: 'AD', tone: 'terracotta' }, level: 'L2' },
    type: 'VICTORY',
    // Le NOM DU TYPE de parcours, pas le titre personnel « Mes études à Lyon ».
    context: 'Parcours Études · Lyon · il y a 2 h',
    body: 'Attestation de virement irrévocable validée ce matin. Merci à la communauté pour vos retours sur la banque partenaire.',
    stepDone: { stepTitle: 'Caution bancaire et AVI validée', position: 4, total: 12, label: 'Étape franchie' },
    reactionCount: 42,
    meta: '8 commentaires · 3 partages',
  },
  {
    id: 'p3',
    author: { name: 'Marc Koudou', avatar: { initials: 'MK', tone: 'greenStrong' }, level: 'L2' },
    type: 'INFO',
    context: 'Parcours Travail · Paris · il y a 4 h',
    body: 'Pour un garant à Paris : regardez Visale (gratuit, Action Logement) ou Garantme avant de céder aux agences qui demandent 3 fois le loyer.',
    tip: {
      title: 'Bon à savoir',
      body: 'Le VLS-TS est accepté d’office pour le certificat Visale dès votre arrivée.',
    },
    reactionCount: 19,
    meta: '14 commentaires · 7 partages',
  },
  {
    id: 'p4',
    author: { name: 'Fatou Ndiaye', avatar: { initials: 'FN', tone: 'green' }, level: 'L1' },
    type: 'QUESTION',
    context: 'Installée · Lyon 7e · il y a 6 h',
    body: 'Quelqu’un connaîtrait un médecin généraliste qui prend de nouveaux patients sur Lyon 7e ou 3e ? C’est pour déclarer mon médecin traitant.',
    tags: ['Santé', 'Lyon7', 'CPAM'],
    reactionCount: 11,
    meta: '4 soutiens',
  },
];

export const DEMO_EVENTS = [
  { day: '22', month: 'MARS', title: 'Repas partagé des nouveaux', subtitle: 'Lyon 7e · 18 participants', href: '/agenda' },
  { day: '29', month: 'MARS', title: 'Atelier CV et lettre', subtitle: 'Lyon 3e · 11 participants', href: '/agenda' },
];

export const DEMO_ARRIVALS = [
  { initials: 'SD', tone: 'greenStrong' as const, name: 'Sandra Diarra', subtitle: 'Arrivée il y a 4 jours · Lyon' },
  { initials: 'IB', tone: 'terracotta' as const, name: 'Ibrahim Bah', subtitle: 'Arrivé il y a 1 semaine · Lyon' },
];

export const DEMO_ONLINE = [
  { initials: 'MK', tone: 'green' as const, name: 'Marc Koudou', href: '/@marc' },
  { initials: 'AD', tone: 'terracotta' as const, name: 'Aïcha Diop', href: '/@aicha' },
  { initials: 'KB', tone: 'greenStrong' as const, name: 'Kofi Boateng', href: '/@kofi' },
];
