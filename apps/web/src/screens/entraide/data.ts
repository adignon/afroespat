/**
 * Données des écrans H01 à H10, reprises de `docs/template/05 Entraide.dc.html`.
 *
 * ET IL N'Y EN A AUCUNE — ce fichier existe pour le dire, pas pour combler un vide.
 *
 * Les maquettes `01 Accès et Onboarding` et `03 Accueil v2` calculent leurs valeurs
 * d'affichage dans un `renderVals()` et les interpolent dans le HTML (`{{ p.comment }}`,
 * `<sc-for>`). `apps/web/src/screens/a01/data.ts` recopie ce `renderVals()` à
 * l'identique : c'est la séparation qui tient tout, la FORME transcodée d'un côté,
 * la DONNÉE écrite à la main de l'autre.
 *
 * `05 Entraide` ne fonctionne pas ainsi. Son `renderVals()` est littéralement
 * `renderVals() { return {}; }`, le fichier ne contient ni `{{ }}` ni `<sc-for>`, et
 * tout le contenu — les 41 demandes, les pastilles, les fonds actifs — est écrit en
 * clair dans le HTML. C'est vrai des sept maquettes 04 à 10 ; seules 01 et 03
 * emploient le dialecte.
 *
 * Recopier ce `renderVals()` à l'identique, c'est donc n'écrire aucune donnée. En
 * écrire une — extraire les cartes du HTML pour les remettre dans un tableau —
 * serait choisir une structure que la maquette n'a pas choisie, et introduire
 * exactement l'écart de jugement que le transcodage supprime.
 *
 * Le type reste, parce que le générateur en pose un en signature de chaque cadre, et
 * parce qu'il est le point d'accroche du lot 3 : quand ces écrans seront branchés sur
 * `apps/api/src/modules/help`, c'est ici que les champs arriveront, et le JSX
 * transcodé n'aura pas à bouger.
 */

/**
 * Aucun champ : les cadres générés reçoivent `_props`.
 *
 * `Record<string, never>` plutôt qu'un alias de `{}` : `{}` accepte n'importe quelle
 * valeur non nulle en TypeScript, y compris un nombre ou une chaîne. Un type qui
 * n'interdit rien ne dirait pas que l'écran ne consomme rien.
 */
export type EntraideData = Record<string, never>;
