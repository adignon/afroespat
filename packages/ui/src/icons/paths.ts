/**
 * Jeu d'icônes — porté tel quel depuis docs/template/gen-helpers.js (carte `I`).
 *
 * Icônes Lucide, tracé 1,7 px (T1 §2.4). Ce sont les chemins exacts employés par
 * les 88 écrans maquettés : les redessiner ferait dériver l'interface du design.
 *
 * AUCUN EMOJI dans l'interface (règle dure T1 §2.4). Le contenu d'un membre peut
 * en contenir, l'interface jamais.
 */
export const ICON_PATHS = {
  home: 'M4 11 12 4l8 7v9H4z',
  path: 'M5 5h6a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h10',
  heart: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z',
  serv: 'M4 20V8l8-4 8 4v12',
  cal: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM5 21a7 7 0 0 1 14 0',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM4 12h2M18 12h2M12 4v2M12 18v2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M6.3 17.7l1.4-1.4M16.3 7.7l1.4-1.4',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zm9 2-4-4',
  plus: 'M12 5v14M5 12h14',
  chat: 'M4 5h16v11H9l-5 4z',
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20a2 2 0 0 0 4 0',
  check: 'm5 12 4.5 4.5L19 7',
  x: 'M18 6 6 18M6 6l12 12',
  back: 'm15 18-6-6 6-6',
  right: 'm9 18 6-6-6-6',
  down: 'm6 9 6 6 6-6',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  flag: 'M5 21V4h12l-2 4 2 4H5',
  shield: 'M12 3 4 6v6c0 4.5 3.5 8 8 9 4.5-1 8-4.5 8-9V6z',
  lock: 'M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3',
  team: 'M9 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20a6 6 0 0 1 12 0M17 11a2.5 2.5 0 1 0 0-5M16 20h5a5 5 0 0 0-4-5',
  list: 'M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
  pin: 'M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  img: 'M3 4h18v16H3zM8.5 11a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2zM21 16l-5-5-9 9',
  bm: 'M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z',
  book: 'M12 7v14M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z',
  brief: 'M3 7h18v13H3zM8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
  tool: 'M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z',
  euro: 'M17 6a7 7 0 1 0 0 12M4 10h9M4 14h9',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  edit: 'M4 20h4L19 9l-4-4L4 16z',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  dl: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2',
  mail: 'M3 6h18v12H3zM3 7l9 6 9-6',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18',
  key: 'M15 7a4 4 0 1 1-3.9 4.9L4 19v2h3l1-1v-2h2v-2h2l.1-.1A4 4 0 0 1 15 7z',
  link: 'M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1',
  send: 'M5 12h14m-6-6 6 6-6 6',
  alert: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8v5M12 16h.01',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  ext: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
  gift: 'M4 11h16v9H4zM3 7h18v4H3zM12 7v13M12 7a3 3 0 1 1 3-3M12 7a3 3 0 1 0-3-3',
  dev: 'M5 3h14v18H5zM11 18h2',
  pause: 'M8 5v14M16 5v14',
  filter: 'M4 5h16l-6 8v6l-4-2v-4z',
  up: 'M7 11v9M7 11l4-7c1.5 0 2.5 1 2.5 2.5V10h5a2 2 0 0 1 2 2l-1.5 6a2 2 0 0 1-2 2H7',
  share: 'M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8.6 13.5l6.8 4M15.4 6.5l-6.8 4',

  // Icônes de réaction du fil, relevées dans 03 Accueil v2.dc.html : le bouton
  // d'une victoire porte un trophée, celui d'une discussion deux bulles.
  trophy: 'M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 21h8',
  chats: 'M4 5h12v8H8l-4 3zM20 9v8l-3-2h-6',
} as const;

export type IconName = keyof typeof ICON_PATHS;

export const ICON_NAMES = Object.keys(ICON_PATHS) as IconName[];
