/**
 * Les quatre onglets de la fiche ville (A12), SANS `'use client'`.
 *
 * Ces trois lignes vivaient dans `appels.ts`, qui est un module CLIENT (il appelle
 * l'API depuis le navigateur). `app/(app)/villes/[slug]/page.tsx` est un composant
 * SERVEUR : il appelait `ongletDeUrl` depuis là, et Next refusait d'invoquer une
 * fonction cliente côté serveur — « Attempted to call ongletDeUrl() from the server
 * but ongletDeUrl is on the client ». MESURÉ au navigateur : TOUTE la fiche ville
 * (`/villes/:slug`) tombait en erreur d'exécution, aux deux largeurs. Une fonction
 * pure que lit aussi le serveur n'a rien à faire dans un module client ; `appels.ts`
 * la ré-exporte pour ses autres lecteurs.
 */

/** Les quatre onglets de la fiche, dans l'ordre de `CITY_TABS`, et le genre qu'ils listent. */
export const ONGLETS_VILLE = ['bons-plans', 'produits', 'budgets', 'temoignages'] as const;
export type OngletVille = (typeof ONGLETS_VILLE)[number];

export const KIND_PAR_ONGLET = {
  'bons-plans': 'TIP',
  produits: 'SHOP',
  budgets: 'BUDGET',
  temoignages: 'TESTIMONY',
} as const satisfies Record<OngletVille, 'TIP' | 'SHOP' | 'BUDGET' | 'TESTIMONY'>;

/** L'onglet demandé par `?onglet=`, ou « budgets » (celui que la maquette ouvre) s'il est inconnu. */
export function ongletDeUrl(valeur: string | null): OngletVille {
  return (ONGLETS_VILLE as readonly (string | null)[]).includes(valeur)
    ? (valeur as OngletVille)
    : 'budgets';
}
