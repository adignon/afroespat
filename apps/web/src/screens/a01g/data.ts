/**
 * A01G — la fenêtre « Lier un guide » du composeur. LES PRISES, ET RIEN D'AUTRE.
 *
 * ── POURQUOI CE FICHIER EXISTE, ET CE QU'IL CORRIGE ─────────────────────────
 *
 * Il manquait, et c'est tout le défaut de compilation du lot repris : la
 * déclaration de A01G (`tools/screens/03-accueil.mjs`) LIE deux listes —
 * `guidesSuggeres` et `guidesTrouves` — que le cadre généré destructure donc,
 * alors que sa signature était restée `A01Data`, qui ne les porte pas. Les six
 * `TS2339`/`TS7006` des deux cadres ne disaient rien d'autre : la LIAISON avait
 * été déclarée, le CONTRAT ne l'avait pas suivie.
 *
 * On ne retire pas la liaison pour faire taire `tsc` — ce serait rendre la fenêtre
 * muette après l'avoir branchée. On écrit le contrat qui manquait, ici, comme
 * `a01c/data.ts` et `a01p/data.ts` le font pour les deux autres fenêtres du fil :
 * une fenêtre déclare ce que SES cadres lisent, jamais les vingt prises du fil
 * entier.
 *
 * ── LA DONNÉE DE LA MAQUETTE NE BOUGE PAS ───────────────────────────────────
 *
 * `GuideLiableView`, `guidesSuggeres` et `guidesTrouves` restent dans
 * `screens/accueil/data.ts`, là où la maquette les écrit. On les réexporte pour que
 * le cadre et son dessin se lisent d'un seul endroit — exactement le choix de
 * `a01c/data.ts` pour `thread`.
 *
 * ── CE QUE LA FENÊTRE NE PEUT PAS FAIRE, ET QU'ON NE FABRIQUE PAS ───────────
 *
 * Elle n'a AUCUNE route où envoyer son résultat : `createPostSchema` est
 * `.strict()` et n'a pas de `guideIds`. « 3 guides maximum » et « Lier 2 guides »
 * restent donc des compteurs d'une sélection qui ne va nulle part, et la case à
 * cocher reste du dessin. Deux manques de plus, tous deux remontés :
 * `guideListQuerySchema` n'accepte pas de `q` (le champ de recherche dessiné n'a
 * rien à appeler) et rien ne rend des guides « suggérés pour cette publication ».
 */

export type { GuideLiableView } from '../accueil/data';
export { guidesSuggeres, guidesTrouves } from '../accueil/data';

import type { GuideLiableView } from '../accueil/data';

/**
 * Ce que les deux cadres de A01G lisent. Deux listes, et c'est tout.
 *
 * DEUX ET NON UNE, parce que la maquette dessine deux sections nommées et deux
 * cartes différentes : la suggérée est sur fond vert, cochée, avec une pastille
 * « Suggéré » ; le résultat est sur fond blanc avec une case vide. Les fondre
 * obligerait à choisir laquelle des deux cartes garder, donc à mentir sur l'autre.
 *
 * `readonly` : la fenêtre AFFICHE deux listes, elle ne les trie ni ne les complète.
 */
export interface A01GData {
  /**
   * LA RECHERCHE DE GUIDES. La barre était un `<div>` portant le mot « médecin » :
   * le texte que la planche écrit pour montrer une recherche en cours.
   *
   * Elle interroge `GET /search?type=GUIDE` et NON `GET /guides`, qui n'accepte
   * aucun texte — filtrer la page chargée aurait cherché dans vingt guides sur
   * plusieurs centaines. Voir `useRechercheGuides`.
   */
  guideRecherche: string;
  onGuideRecherche: (event: { target: { value: string } }) => void;
  guidesSuggeres: readonly GuideLiableView[];
  guidesTrouves: readonly GuideLiableView[];
  /** Valide la sélection et la pose sur le composeur. Voir `accueil/page.tsx`. */
  onLierGuides: () => void;
  onAnnulerGuides: () => void;
  /** Éteint tant qu'aucun guide n'est choisi. */
  lierBloque: boolean;
}
