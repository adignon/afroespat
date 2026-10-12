/**
 * LE DESSIN COMMUN AUX QUATRE ÉCRANS DE RÉSEAUX — et rien d'autre.
 *
 * Le rail, le panneau de section, les chips et les onglets sont identiques sur
 * A07, A08, A09 et A10 : la maquette les dessine une fois et les répète. Ils sont
 * donc écrits une fois ici, et les quatre `data.ts` les réexportent.
 *
 * ── POURQUOI ILS NE VIENNENT PAS DE `screens/accueil/data.ts` ───────────────
 *
 * Parce que quatre agents travaillent en parallèle sur ce module, et que ce
 * fichier est celui qui les ferait se percuter. Les recopier ici coûte quelques
 * lignes ; se marcher dessus coûte le lot.
 *
 * ── CE QUE CE FICHIER NE CONTIENT PAS ──────────────────────────────────────
 *
 * Aucune donnée. Pas un nom de réseau, pas un compteur, pas un libellé de sujet :
 * tout cela vient de l'API, par `from-api.ts`. Ici il n'y a que du DESSIN —
 * chemins d'icônes et couleurs, tels que la maquette les fixe. Aucune couleur
 * n'est assombrie (T1 §1.2).
 */

// ─── Chemins d'icônes, tels que la maquette les définit ─────────────────────

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
} as const;

/** Les quatre icônes que les sujets et la modération emploient. */
export const PIN = 'M12 17v5M9 3h6l-1 6 4 4H6l4-4z';
export const CHAT = 'M4 5h16v11H9l-5 4z';
export const LOCK = 'M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3';
export const EYE =
  'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z';

// ─── Navigation ─────────────────────────────────────────────────────────────

/**
 * ─── LE RAIL ET LE PANNEAU NE SONT PLUS RECOPIÉS ICI ────────────────────────
 *
 * Ils l'ÉTAIENT, et l'en-tête de ce fichier dit pourquoi : quatre agents
 * travaillaient en parallèle sur le module, et recopier douze lignes coûtait
 * moins que se percuter. La raison était bonne, et elle a cessé de l'être au
 * moment où ces entrées ont reçu une DESTINATION.
 *
 * Une couleur recopiée qui dérive se voit à l'œil. Une ROUTE recopiée qui dérive
 * ne se voit pas : le rail de `/reseaux` enverrait « Services » ailleurs que le
 * rail de `/accueil`, les deux cliqueraient, les deux auraient l'air justes, et
 * rien n'arrêterait la génération. Il n'y a donc plus qu'UNE table de
 * destinations — celle de `screens/a01/data.ts`, déclarée en regard de la clé
 * `liens` de `tools/screens/03-accueil.mjs`.
 *
 * `I` reste local : il sert aux icônes propres à ce module, et ce sont des tracés,
 * pas des adresses.
 */
export { panel, rail } from '../a01/data';
// Réexporter ne met rien dans la portée locale, et `panelReseaux` ci-dessous
// APPELLE `panel` : il faut donc aussi l'importer.
import { panel } from '../a01/data';

/** « Réseaux » est la quatrième entrée : c'est elle qui s'allume sur A07–A10. */
export const panelReseaux = panel('Réseaux');

export const chip = (label: string, on = false) => ({
  label,
  bg: on ? '#16785E' : '#fff',
  fg: on ? '#fff' : '#16211D',
  bd: on ? '#16785E' : '#E6EBE9',
});

export const tab = (label: string, on: boolean) => ({
  label,
  w: on ? 700 : 500,
  fg: on ? '#0F5C48' : '#5D6B66',
  bd: on ? '#16785E' : 'transparent',
});

/** Les six onglets du réseau. Le deuxième — « Sujets » — est celui que A08 montre. */
export const NET_TABS = ['Fil', 'Sujets', 'Événements', 'Membres', 'Album', 'À propos'] as const;

/**
 * ─── LE NOM DE CHAQUE ONGLET DANS L'URL, DANS L'ORDRE DE `NET_TABS` ─────────
 *
 * Ce sont les six valeurs que `app/(app)/reseaux/[slug]/page.tsx` lit dans
 * `?onglet=` et que `reseau-screen.tsx` range dans son `SLUGS` : rien n'est
 * inventé ici, la table est recopiée de là, et l'ordre est celui de la barre.
 *
 * LA DESTINATION EST RELATIVE, ET C'EST UN CHOIX MESURÉ : le slug du réseau n'est
 * dessiné dans aucune de ces planches, et leur prise ne le porte pas. Une requête
 * seule se résout contre l'URL courante en gardant son chemin — depuis
 * `/reseaux/pays-bj`, `?onglet=membres` donne `/reseaux/pays-bj?onglet=membres`.
 * Composer une adresse absolue demanderait d'inventer le réseau.
 *
 * La barre de A08 n'est rendue qu'en VUE MEMBRE (`reseau-screen.tsx` ne monte le
 * cadre complet que dans sa branche `plain`, qui exige `!owner`) : aucun
 * `&vue=proprietaire` n'a donc à voyager ici.
 */
export const NET_TAB_SLUGS = ['fil', 'sujets', 'evenements', 'membres', 'album', 'a-propos'] as const;

/**
 * LE RANG DE L'ONGLET « MEMBRES », LU DANS LA TABLE ET NON RECOPIÉ.
 *
 * `useReseau` ne charge la liste des membres que sur cet onglet-là — deux appels
 * de plus sur chacun des cinq autres seraient du gaspillage pur. Il lui faut donc
 * le rang, et un `3` écrit à la main serait une seconde source : il suffirait
 * d'insérer un onglet dans `NET_TABS` pour que le chargement se mette à suivre
 * « Album ». On le DÉRIVE.
 */
export const RANG_ONGLET_MEMBRES = NET_TAB_SLUGS.indexOf('membres');

/**
 * LE RANG DE L'ONGLET « FIL », DÉRIVÉ POUR LA MÊME RAISON QUE CELUI DES MEMBRES.
 *
 * `useReseau` ne charge les publications du réseau et son annonce épinglée que sur
 * cet onglet-là — deux appels de plus sur chacun des cinq autres seraient du
 * gaspillage pur.
 *
 * ⚠ C'EST AUSSI L'ONGLET PAR DÉFAUT depuis l'arbitrage du porteur (« la page des
 * réseaux doit s'ouvrir par défaut sur le fil d'actualité »), ce qui le rend le
 * plus visité du module : c'est `app/(app)/reseaux/[slug]/page.tsx` qui le décide,
 * et cette constante ne fait que nommer son rang dans la barre.
 */
export const RANG_ONGLET_FIL = NET_TAB_SLUGS.indexOf('fil');

/**
 * LE RANG DE L'ONGLET « ÉVÉNEMENTS », DÉRIVÉ POUR LA MÊME RAISON QUE LES DEUX
 * AUTRES.
 *
 * `useReseau` ne charge les événements du réseau que sur cet onglet-là : un
 * appel de plus sur chacun des cinq autres serait du gaspillage pur, et celui-ci
 * se recharge à chaque bascule de pastille (« À venir » / « Passés »).
 */
export const RANG_ONGLET_EVENEMENTS = NET_TAB_SLUGS.indexOf('evenements');

/**
 * LE RANG DE L'ONGLET « ALBUM », DÉRIVÉ POUR LA MÊME RAISON QUE LES TROIS AUTRES.
 *
 * `useReseau` ne charge les albums que sur cet onglet-là, et il y fait DEUX
 * appels : `GET /communities/:id/albums` pour les albums, et
 * `GET /feed?communityId=` pour l'onglet « Partagés » — qui n'est pas un album
 * mais les images des publications. Les lancer sur les cinq autres onglets
 * doublerait l'appel de fil que l'onglet « Fil » fait déjà.
 */
export const RANG_ONGLET_ALBUM = NET_TAB_SLUGS.indexOf('album');

export const netTabsFor = (active: number) =>
  NET_TABS.map((l, i) => ({ ...tab(l, i === active), href: `?onglet=${NET_TAB_SLUGS[i]}` }));

// ─── Identité visuelle d'une personne et d'un réseau ────────────────────────

/** La palette d'avatars de la maquette, dans son ordre. Aucune teinte ajoutée. */
const AVATAR_COLORS = ['#0F5C48', '#16785E', '#B4581F', '#2FA37D', '#E0733A'] as const;

/**
 * Les initiales, comme la maquette les dessine : une ou deux lettres majuscules.
 *
 * `Array.from` et non `split('')` : « Émile » commence par un caractère qui tient
 * sur deux unités de code dans certaines compositions, et `split('')` le couperait
 * en deux moitiés invalides.
 */
export function initials(label: string): string {
  const mots = label
    .trim()
    .split(/\s+/)
    .filter((m) => m.length > 0);
  if (mots.length === 0) return '·';
  const lettre = (m: string): string => (Array.from(m)[0] ?? '').toLocaleUpperCase('fr-FR');
  return mots.length === 1
    ? lettre(mots[0] as string)
    : `${lettre(mots[0] as string)}${lettre(mots[1] as string)}`;
}

/**
 * Couleur STABLE dérivée d'une clé — handle d'un membre, slug d'un réseau.
 *
 * Stable importe : une couleur tirée au hasard changerait à chaque rendu, et le
 * même réseau serait de deux couleurs entre « Mes réseaux » et « Découvrir ».
 */
export function tint(key: string): string {
  let somme = 0;
  for (const c of key) somme = (somme + c.codePointAt(0)!) % 9973;
  return AVATAR_COLORS[somme % AVATAR_COLORS.length] as string;
}
