/**
 * A02 — une publication et son fil de réponses. LES PRISES DÉCLARÉES.
 *
 * Même démarche qu'`a01/data.ts` au lot précédent : le cadre dit ce qu'il LIT, et
 * ce contrat est satisfait par la maquette comme par l'API. Ce qui l'emportait
 * avant — `AccueilData`, les cinquante prises des dix-sept écrans de la maquette —
 * ne disait rien de A02 en particulier, et un écran qui ne sait pas ce qu'il
 * consomme ne peut pas être branché sans le deviner.
 *
 * ── CE QUE CE CADRE NE PEUT PAS AFFICHER, ET C'EST LA MAQUETTE ─────────────
 *
 * LA PUBLICATION ELLE-MÊME EST ÉCRITE EN DUR. Compté sur les deux cadres : l'auteur
 * (« Fatou Ndiaye »), le corps, le type, les compteurs et la ligne de contexte ne
 * portent AUCUNE interpolation dans `docs/template/03 Accueil v2.dc.html`. Le seul
 * contenu variable de A02 est la liste des commentaires et celle des guides
 * rattachés — c'est ce que ce fichier déclare, et rien de plus.
 *
 * Conséquence à dire franchement plutôt qu'à masquer : `/publications/:id` sert de
 * vrais commentaires SOUS une publication dessinée. Combler cela demande des
 * interpolations dans la maquette, donc une décision du porteur — jamais une
 * retouche du JSX généré, que la régénération effacerait. Remonté au rapport de lot.
 *
 * ── LES GUIDES RATTACHÉS : AUCUNE SOURCE ───────────────────────────────────
 *
 * `relGuides` n'a pas de source côté API. Vérifié route par route : ni
 * `postCardSchema`, ni `postDetailResponseSchema` ne portent de guides liés, et le
 * module `guides` n'expose aucune route « guides d'une publication ». Le vote
 * « utile / pas utile » sur un rattachement automatique n'a donc rien à enregistrer.
 * La prise reste déclarée — la maquette la dessine — et arrive VIDE. Remonté.
 */

import { panelFil, rail, relGuidesFor, shortcuts } from '../accueil/data';

export { panelFil, rail, relGuidesFor, shortcuts };
export { comments } from '../accueil/data';
export type { GuideVote } from '../accueil/data';

/**
 * Un commentaire tel que les DEUX cadres de A02 le lisent.
 *
 * Ce n'est PAS `CommentView` (A01C) : l'indentation n'est pas la même (48 px ici
 * contre 50, 34 contre 44 sur mobile), il n'y a ni `phase`, ni `author`, ni `av`,
 * et il y a un `guide` que A01C n'a pas. Deux cadres, deux contrats — les fondre
 * obligerait l'un des deux à recevoir des champs qu'il n'affiche pas, et on ne
 * saurait plus lesquels sont réellement lus.
 *
 * `guide` est la carte « Guide · N ont trouvé utile » sous un commentaire. Elle est
 * MORTE DANS LA MAQUETTE elle-même : son balisage la dessine sous un `sc-if`, son
 * `renderVals()` ne pose jamais le champ. On reproduit l'état qu'elle montre —
 * `null` — plutôt que d'inventer le lien qu'elle a oublié de fournir, et l'API n'en
 * a de toute façon aucun.
 */
export interface CommentA02View {
  readonly i: string;
  readonly bg: string;
  readonly name: string;
  readonly text: string;
  readonly time: string;
  readonly indent: string;
  readonly indentM: string;
  readonly canReply: boolean;
  readonly guide: string | null;
}

/**
 * Un guide rattaché, et son vote.
 *
 * `auto` marque les rattachements que la plateforme a faits d'elle-même — c'est ce
 * que le vote sert à corriger. Les six couleurs sont du DESSIN dérivé du vote,
 * calculé par `relGuidesFor` comme la maquette le calcule.
 */
export interface RelGuideView {
  readonly t: string;
  readonly s: string;
  readonly auto: boolean;
  readonly upBg: string;
  readonly upFg: string;
  readonly downBg: string;
  readonly downFg: string;
  readonly voted: boolean;
  readonly onUp: () => void;
  readonly onDown: () => void;
}

/** Ce que les deux cadres de A02 lisent. Le cadre mobile n'en emploie qu'un. */
export interface A02Data {
  rail: typeof rail;
  panelFil: typeof panelFil;
  shortcuts: typeof shortcuts;
  comments: readonly CommentA02View[];
  relGuides: readonly RelGuideView[];
}
