/**
 * DE L'API VERS LES PRISES DE A02 — et de A01C, qui lit le même fil.
 *
 * Même charnière que `screens/accueil/from-api.ts`, même discipline : le JSX
 * transcodé ne bouge pas, ce fichier traduit le vocabulaire de l'API dans celui de
 * la maquette. Il ne décide rien. Chaque libellé qu'il pose vient soit du serveur
 * (`relativeTime`, `body`), soit de la table de DESSIN de la maquette (les
 * indentations, les couleurs d'avatar).
 *
 * ── POURQUOI UNE SECONDE CONVERSION DE COMMENTAIRE ─────────────────────────
 *
 * `threadFrom` (accueil) rend la forme de A01C ; celle-ci rend la forme de A02.
 * Ce ne sont PAS les mêmes prises, et les fondre obligerait l'un des deux cadres à
 * recevoir des champs qu'il n'affiche pas :
 *
 *   · A01C indente de 50 px (44 sur mobile), A02 de 48 (34 sur mobile) ;
 *   · A01C porte `phase`, `author`, `av` et un compteur de « j'aime » ; A02 non ;
 *   · A02 porte `guide`, la carte « Guide · N ont trouvé utile » sous un
 *     commentaire ; A01C non.
 *
 * Ces écarts sont ceux de la MAQUETTE, relevés sur ses deux planches. Les aligner
 * serait redessiner.
 *
 * ── CE QU'ON NE REMPLIT PAS ────────────────────────────────────────────────
 *
 * `guide` arrive TOUJOURS `null`. La carte est morte dans la maquette elle-même
 * (son balisage la dessine sous un `sc-if`, son `renderVals()` ne pose jamais le
 * champ) et l'API n'a aucun champ pour la remplir : ni `commentThreadSchema`, ni
 * aucune route du module `guides` ne rattache un guide à un commentaire.
 *
 * `likes` sur un commentaire n'existe nulle part — aucune réaction de commentaire,
 * ni en base ni dans aucune réponse. Remonté ; la prise de A01C reste vide.
 */
import type { CommentThread } from '@app/shared';
import { avatarColor, initials } from '../accueil/from-api';
import type { CommentA02View, RelGuideView } from '../a02/data';

/** Une ligne de A02, plus ce que la page doit connaître pour agir. */
export interface CommentaireA02 extends CommentA02View {
  readonly commentId: string;
  /** §2.5 : vrai pendant 15 minutes, et c'est le SERVEUR qui tranche. */
  readonly canEdit: boolean;
}

/**
 * Le fil de A02, aplati en une liste avec INDENTATION.
 *
 * C'est la forme que le JSX transcodé attend : la maquette dessine un décalage
 * pour l'unique niveau de réponse que §2.5 autorise, et non un arbre.
 *
 * `canReply` suit la PROFONDEUR, pas un droit : on répond à une racine, jamais à
 * une réponse (`DEPTH_EXCEEDED`, mesuré 422). Ce n'est donc pas une permission
 * qu'on préjuge — c'est la forme du fil.
 */
export function commentairesA02From(items: readonly CommentThread[]): readonly CommentaireA02[] {
  return items.flatMap((racine) => [
    {
      i: initials(racine.author.displayName),
      bg: avatarColor(racine.author.handle),
      name: racine.author.displayName,
      text: racine.body,
      /** « il y a 2 h » — COMPOSÉ PAR LE SERVEUR. Le front ne recalcule pas. */
      time: racine.relativeTime,
      indent: '0px',
      indentM: '0px',
      canReply: true,
      guide: null,
      commentId: racine.id,
      canEdit: racine.canEdit,
    },
    ...racine.replies.map((r) => ({
      i: initials(r.author.displayName),
      bg: avatarColor(r.author.handle),
      name: r.author.displayName,
      text: r.body,
      time: r.relativeTime,
      indent: '48px',
      indentM: '34px',
      canReply: false,
      guide: null,
      commentId: r.id,
      canEdit: r.canEdit,
    })),
  ]);
}

/**
 * LES GUIDES RATTACHÉS À UNE PUBLICATION : AUCUNE SOURCE, DONC RIEN.
 *
 * Vérifié route par route et schéma par schéma : `postCardSchema` et
 * `postDetailResponseSchema` n'ont aucun champ de guides liés, et le module
 * `guides` n'expose pas de route « guides d'une publication ». Le vote
 * « utile / pas utile » que la maquette dessine n'a donc rien à enregistrer.
 *
 * On rend une liste VIDE plutôt que les trois guides d'exemple de la maquette : un
 * rattachement affiché est une affirmation sur cette publication, et voter dessus
 * n'irait nulle part. Remonté au rapport de lot pour que le back le tranche.
 */
export const GUIDES_RATTACHES_SANS_SOURCE: readonly RelGuideView[] = [];
