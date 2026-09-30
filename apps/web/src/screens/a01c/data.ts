/**
 * A01C — la fenêtre de commentaires du fil. LES PRISES, ET RIEN D'AUTRE.
 *
 * ── POURQUOI CE FICHIER EXISTE ──────────────────────────────────────────────
 *
 * Les deux cadres de A01C lisent UNE SEULE propriété : `thread`. Ils déclaraient
 * pourtant `A01Data` en signature — les vingt prises du fil entier, stories,
 * colonne droite et contacts de partage compris. Deux conséquences, et la seconde
 * n'est pas cosmétique :
 *
 *   1. la page devait passer le fil complet à une fenêtre de commentaires, donc
 *      construire tout A01 pour afficher cinq lignes de texte ;
 *   2. RIEN NE DISAIT ce que cette fenêtre consomme vraiment. Le jour où on la
 *      branche sur `GET /comments`, il faut savoir exactement quoi remplir — et
 *      `A01Data` ne répond pas à cette question, il répond à celle de A01.
 *
 * Le CONTRAT vit donc ici. La DONNÉE de la maquette, elle, ne bouge pas : `thread`
 * et `CommentView` restent dans `screens/a01/data.ts`, parce que la maquette les
 * écrit dans le MÊME `renderVals()` que le fil — c'est un seul écran avec des
 * fenêtres par-dessus, et les déplacer créerait deux sources pour un seul état.
 * On les réexporte pour que le cadre et sa donnée se lisent d'un seul endroit.
 *
 * ── CE QUE LA FENÊTRE NE PEUT PAS MONTRER, ET QU'ON NE FABRIQUE PAS ─────────
 *
 * `likes` sur un commentaire : AUCUNE réaction de commentaire n'existe côté API —
 * ni en base, ni dans `commentThreadSchema`, ni sur aucune route. La maquette en
 * dessine pourtant le compteur. La prise reste FACULTATIVE et arrive vide : la
 * remplir de `0` afficherait un compteur qui ne bougera jamais, et le défaut ne se
 * verrait qu'au clic. Remonté au rapport de lot.
 */

export type { CommentView } from '../a01/data';
export { thread } from '../a01/data';

import type { CommentView } from '../a01/data';

/**
 * Ce que les deux cadres de A01C lisent. Une propriété, et c'est tout.
 *
 * `readonly` sur le tableau : la fenêtre AFFICHE un fil, elle ne le trie pas et ne
 * le complète pas. Ce qui pagine, c'est l'appel (`nextCursor`), pas le cadre.
 */
export interface A01CData {
  thread: readonly CommentView[];
}
