'use client';

import { VueExport } from '@/components/parcours/vue-export';

/**
 * `/parcours/:id/export` — AJOUT HORS MAQUETTE : le parcours dans une page imprimable.
 *
 * J07 proposait un « EXPORT PDF réservé à Premium » sans aucun geste derrière : aucune
 * route serveur ne produit de PDF. Plutôt qu'un bouton mort, la page rend le parcours —
 * étapes, durées réelles, journal — et « Imprimer / Enregistrer en PDF » ouvre la boîte
 * d'impression du navigateur, dont l'une des destinations est le PDF. Gratuit, sans
 * dépendance, et le contenu ne quitte jamais l'appareil. Les NOTES ne sont pas incluses.
 */
export default function Page() {
  return <VueExport />;
}
