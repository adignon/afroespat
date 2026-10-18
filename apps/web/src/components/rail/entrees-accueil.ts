/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LES ENTRÉES DU MENU D'ACCUEIL — UNE SEULE LISTE, POUR TOUS LES ENDROITS    ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « quand on est au niveau de la page des parcours (ou un autre) et
 * qu'on fait un hover sur l'icône d'accueil, est-ce que ça affiche le même nombre
 * de liens que celui du menu sidebar de la page d'accueil ? »
 *
 * MESURÉ : non. Le menu de la page d'accueil porte QUATRE entrées — le porteur a
 * retiré « Fil d'entraide », « Événements » et « Parrainage » le 2026-10-11 :
 * « C'est déjà dans entraide et événements » — alors que le volet du rail en
 * affichait SIX (« Fil d'entraide » et « Événements » y étaient restés), sous des
 * libellés légèrement différents (« Guides et Démarches », « Villes et Membres »).
 * Pire : les pages Messages et Notifications dessinaient encore l'ancienne liste de
 * six, en `<span>` — des entrées qui ne menaient nulle part, dont un « 12 » écrit
 * en dur.
 *
 * Trois endroits décrivaient la même liste, chacun de son côté, et aucun test ne
 * pouvait les voir diverger. Il n'y en a plus qu'UNE, ici :
 *
 *   · le panneau « COMMUNAUTÉ » de l'accueil (`screens/a01/data.ts`, `PANEL_ITEMS`) ;
 *   · le volet que le rail déplie au survol (`rail/menus.ts`, rubrique « Accueil ») ;
 *   · la carte « ACCUEIL » des pages Messages et Notifications
 *     (`rail/menu-accueil.tsx`, posée par l'adaptation `ACCUEIL_ENTREES`).
 *
 * Retirer ou ajouter une entrée se fait donc ici, et nulle part ailleurs.
 *
 * Les tracés et les adresses sont ceux que l'accueil utilisait déjà ; chaque adresse
 * est une route vérifiée de `app/(app)/`.
 */
export interface EntreeAccueil {
  readonly libelle: string;
  readonly href: string;
  readonly trace: string;
}

export const ENTREES_ACCUEIL: readonly EntreeAccueil[] = [
  {
    libelle: "Fil d'actualité",
    href: '/accueil',
    trace:
      'M15 18h-5M18 14h-8M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-4 0v-9a2 2 0 0 1 2-2h2M10 6h8v4h-8z',
  },
  {
    libelle: 'Guides & Démarches',
    href: '/guides',
    trace:
      'M12 7v14M16 12h2M16 8h2M6 12h2M6 8h2M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z',
  },
  {
    libelle: 'Réseaux',
    href: '/reseaux',
    trace:
      'M12 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM5 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 8v4M12 12l-5 4M12 12l5 4',
  },
  {
    libelle: 'Villes & Membres',
    href: '/villes',
    trace: 'M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11z',
  },
];
