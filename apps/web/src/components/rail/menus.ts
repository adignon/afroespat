/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LE MENU DE CHAQUE RUBRIQUE DU RAIL — CE QUE LE SURVOL DÉPLIE               ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « le menu green de gauche affiche au "hover" un floatting side bar
 * menu quand on passe le curseur sur Accueil, Parcours etc. — donc ça va permettre
 * d'avoir la navigation même sur les pages où la side bar est réutilisée pour le
 * contexte de la page sur laquelle on se trouve, comme la recherche. »
 *
 * ── D'OÙ VIENNENT CES ENTRÉES ─────────────────────────────────────────────
 *
 * ELLES NE SONT PAS INVENTÉES : chacune est relevée dans la carte de section que
 * les planches dessinent elles-mêmes dans leur colonne de gauche — « ACCUEIL » sur
 * M01/X01/X02, « ENTRAIDE » et « PARRAINAGE » sur les dix planches d'entraide,
 * « SERVICES » et « MON ESPACE » sur les dix de services. Les libellés et les
 * tracés sont ceux de ces cartes, verbatim. C'est exactement le menu qu'on perd
 * quand la colonne sert au contexte de la page, et c'est lui qu'on redonne.
 *
 * ── CE QUI N'Y EST PAS, ET POURQUOI ───────────────────────────────────────
 *
 * PARCOURS : sa carte de section (« MON PARCOURS » sur les treize planches de
 * parcours) liste « Vue d'ensemble », « Étape en cours », « Discussion »,
 * « Équipe », « Checklist de documents », « Historique », « Réglages ». Ces sept
 * routes existent TOUTES — mais sous `/parcours/[id]/…` : elles demandent
 * l'identifiant du parcours courant, que le rail ne connaît pas et qui n'a pas de
 * sens depuis une page de recherche. Le menu de Parcours ne porte donc que ses
 * trois entrées de niveau haut, qui sont des routes réelles. Les sept autres sont
 * dans la colonne de la page de parcours, là où l'identifiant existe.
 *
 * AGENDA : les quatre planches d'agenda ne dessinent AUCUNE carte de navigation —
 * leur colonne porte un calendrier, « CE WEEK-END » et la ville. Il n'y a donc
 * aucun menu dessiné à reprendre. Les deux routes du module (`/agenda`,
 * `/agenda/nouveau`) sont nommées ici parce qu'elles existent et qu'un menu à
 * quatre rubriques sur cinq serait un trou qu'on verrait. C'est la seule entrée de
 * cette table qui ne vient pas d'une carte dessinée : REMONTÉ.
 *
 * ── CE QUI EST VÉRIFIÉ ────────────────────────────────────────────────────
 *
 * Les routes, une par une, dans `apps/web/src/app/(app)/`. Un menu qui mène à une
 * page absente est pire qu'un menu absent, parce qu'on y va.
 */

export interface EntreeMenu {
  readonly libelle: string;
  readonly href: string;
  readonly trace: string;
}

export interface MenuRubrique {
  /** Le titre de la carte, comme la planche l'écrit : en capitales. */
  readonly titre: string;
  readonly entrees: readonly EntreeMenu[];
}

/** Les tracés, relevés sur les cartes de section des planches. */
const T = {
  fil: 'M4 11 12 4l8 7v9H4z',
  guide:
    'M12 7v14M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z',
  coeur: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z',
  gens: 'M9 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20a6 6 0 0 1 12 0M17 11a2.5 2.5 0 1 0 0-5M16 20h5a5 5 0 0 0-4-5',
  epingle: 'M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  calendrier: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  liste: 'M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01',
  bulle: 'M4 5h16v11H9l-5 4z',
  fleche: 'M5 12h14m-6-6 6 6-6 6',
  loupe: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zm9 2-4-4',
  etoile: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
  grille: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  mallette: 'M3 7h18v13H3zM8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
  outils: 'M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z',
  cloche: 'M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20a2 2 0 0 0 4 0',
  fiche: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM5 21a7 7 0 0 1 14 0',
  /** Feather `plus-circle` — la seule entrée qu'aucune carte ne dessine. */
  plus: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 8v8M8 12h8',
} as const;

/**
 * Les menus, indexés par le LIBELLÉ du rail.
 *
 * Par le libellé et non par l'adresse, pour une raison mesurée : le rail existe en
 * deux formes dans les maquettes — cinquante et un rails LITTÉRAUX, où les cinq
 * libellés sont écrits en clair, et treize rails en BOUCLE, où ils viennent de la
 * donnée. L'adresse de « Services » diffère d'ailleurs du nom de sa rubrique
 * (`/services/logement`, arbitrage déjà remonté dans `tools/squelette-membre.mjs`).
 * Le libellé rendu, lui, est le même des deux côtés : c'est le seul discriminant
 * que les deux formes partagent.
 */
export const MENUS_RAIL: Readonly<Record<string, MenuRubrique>> = {
  Accueil: {
    titre: 'ACCUEIL',
    entrees: [
      { libelle: 'Fil d’actualité', href: '/accueil', trace: T.fil },
      { libelle: 'Guides et Démarches', href: '/guides', trace: T.guide },
      { libelle: 'Fil d’entraide', href: '/entraide', trace: T.coeur },
      { libelle: 'Réseaux', href: '/reseaux', trace: T.gens },
      { libelle: 'Villes et Membres', href: '/villes', trace: T.epingle },
      { libelle: 'Événements', href: '/agenda', trace: T.calendrier },
    ],
  },
  Parcours: {
    titre: 'PARCOURS',
    entrees: [
      { libelle: 'Mon parcours', href: '/parcours', trace: T.grille },
      { libelle: 'Parcours publics', href: '/parcours/publics', trace: T.gens },
      { libelle: 'Nouveau parcours', href: '/parcours/nouveau', trace: T.plus },
    ],
  },
  Entraide: {
    titre: 'ENTRAIDE',
    entrees: [
      { libelle: 'Toutes les demandes', href: '/entraide', trace: T.liste },
      { libelle: 'Vous pouvez aider', href: '/entraide/aider', trace: T.coeur },
      { libelle: 'Mes demandes', href: '/entraide/mes-demandes', trace: T.bulle },
      { libelle: 'Mes réponses', href: '/entraide/mes-reponses', trace: T.fleche },
      { libelle: 'Trouver un parrain', href: '/parrainage', trace: T.loupe },
      { libelle: 'Mes parrainages', href: '/parrainage/mes-parrainages', trace: T.gens },
      { libelle: 'Devenir parrain', href: '/parrainage/devenir', trace: T.etoile },
    ],
  },
  Services: {
    titre: 'SERVICES',
    entrees: [
      { libelle: 'Annonces logement', href: '/services/logement', trace: T.fil },
      { libelle: 'Bourses et emploi', href: '/services/emploi', trace: T.mallette },
      { libelle: 'Annuaire professionnel', href: '/services/annuaire', trace: T.outils },
      { libelle: 'Mes annonces', href: '/services/mes-annonces', trace: T.liste },
      { libelle: 'Mes alertes', href: '/services/alertes', trace: T.cloche },
      { libelle: 'Ma fiche pro', href: '/services/annuaire/ma-fiche', trace: T.fiche },
    ],
  },
  Agenda: {
    titre: 'AGENDA',
    entrees: [
      { libelle: 'Tous les événements', href: '/agenda', trace: T.calendrier },
      { libelle: 'Créer un événement', href: '/agenda/nouveau', trace: T.plus },
    ],
  },
};
