/**
 * Données des écrans M01 et X01 à X04, reprises de
 * `docs/template/09 Messages et transverse.dc.html`.
 *
 * ET IL N'Y EN A AUCUNE, pour la même raison que l'entraide et l'agenda : le
 * `renderVals()` de cette maquette rend `{}`, et le fichier ne contient ni `{{ … }}`
 * ni `<sc-for>` — vérifié, pas supposé. Le détail du constat, et pourquoi en
 * inventer une serait pire que n'en avoir aucune, est dans
 * `apps/web/src/screens/entraide/data.ts`.
 *
 * C'est ici que les champs arriveront quand ces écrans seront branchés sur
 * `apps/api/src/modules/messaging` (conversations, non-lus, accusés de lecture),
 * sur la recherche (module 11) et sur les notifications (module 12). Le JSX
 * transcodé n'aura pas à bouger.
 */

/** Aucun champ : les cadres générés reçoivent `_props`. */
export type MessagesData = Record<string, never>;
