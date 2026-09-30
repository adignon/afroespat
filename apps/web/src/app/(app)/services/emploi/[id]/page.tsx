import { OffreEcran } from '@/screens/services/offre-ecran';

/**
 * S05 — une offre d'emploi (`/services/emploi/:id`, 10 §3.1).
 *
 * DEUX ROUTES, UNE SEULE PLANCHE, et c'est la maquette qui l'écrit : sa légende
 * dit « /services/emploi/:id · /nouveau ». Le cadre d'ordinateur porte le détail
 * de l'offre dans sa colonne centrale ET le formulaire « PUBLIER UNE OFFRE » dans
 * sa colonne de droite. `/services/emploi/nouveau` tombe donc sur cette route
 * dynamique et affiche exactement ce que la maquette dessine. Fabriquer une
 * seconde page pour un seul dessin inventerait un écart qu'elle n'a pas.
 *
 * L'identifiant de route n'est pas lu : la maquette montre UNE offre, écrite en
 * clair. Voir `/services/logement/[id]/page.tsx` pour le détail de ce choix.
 */
export default function OffreEmploiPage() {
  return <OffreEcran />;
}
