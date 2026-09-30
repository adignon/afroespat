/**
 * A01P — la fenêtre « Partager » du fil. LES PRISES, ET RIEN D'AUTRE.
 *
 * Même raison d'être que `a01c/data.ts` : les deux cadres lisent six propriétés et
 * déclaraient `A01Data` tout entier. Le contrat vit ici, la donnée de la maquette
 * reste dans `screens/a01/data.ts` où son `renderVals()` la met.
 *
 * ── CE QUE LE BACK NE DONNE PAS, ET QU'ON NE CONSTRUIT PAS ──────────────────
 *
 * IL N'EXISTE AUCUNE ROUTE DE PARTAGE. Ni `POST /posts/:id/share`, ni compteur de
 * partages sur `postCardSchema` : le bouton « Envoyer à N contacts » n'a rien à
 * appeler, et la ligne « N partages » que la maquette dessine sous les compteurs
 * n'a aucune source. C'est remonté au rapport de lot, pas comblé ici — fabriquer
 * un envoi qui n'arrive nulle part serait pire que de ne rien brancher.
 *
 * Ce qui EST branchable l'est : la liste de contacts. Elle vient de
 * `GET /feed/sidebar` (`onlineContacts`), déjà relu par l'écran du fil — donc des
 * membres réels, calculés par le serveur, et pas cinq initiales d'exemple.
 *
 * `shareNets` (les réseaux du membre) reste du dessin : la seule source possible
 * est le module `communities`, qui n'a pas de schéma de réponse dans
 * `packages/shared` et n'est pas de ce lot. Remonté.
 */

export { SHARE_SELECTION_DEFAULT, shareButtonFor, shareNets, shareOut } from '../a01/data';

import type { shareNets, shareOut } from '../a01/data';

/**
 * Un contact proposé au partage, tel que les deux cadres le lisent.
 *
 * `ring` non sélectionné vaut `2.5px solid transparent` et non `none` : une bordure
 * qui APPARAÎT déplacerait l'avatar de deux pixels et demi à chaque clic.
 */
export interface ShareContactView {
  readonly i: string;
  readonly bg: string;
  readonly name: string;
  readonly on: boolean;
  readonly ring: string;
  readonly onPick: () => void;
}

/**
 * LES CONTACTS VIENNENT DE L'API, pas de la maquette.
 *
 * Cette fabrique remplace `shareContactsFor` (`screens/a01/data.ts`), qui mappait
 * cinq contacts d'exemple : « Sandra M. », « Aïcha Diop »… Les servir sous une
 * case à cocher affirmerait que ce sont MES contacts. Ceux-ci sont ceux que
 * `GET /feed/sidebar` calcule (§2.7, `last_seen_at` < 10 min), déjà relus par
 * l'écran du fil — donc aucun appel de plus.
 *
 * « cliquez les contacts », écrit la maquette sous sa planche : c'est une véritable
 * interaction, pas une illustration. L'anneau vert marque la sélection.
 */
export const shareContactsDe = (
  contacts: readonly { readonly i: string; readonly bg: string; readonly name: string }[],
  selected: readonly number[],
  onToggle: (index: number) => void,
): readonly ShareContactView[] =>
  contacts.map((c, i) => {
    const on = selected.includes(i);
    return {
      i: c.i,
      bg: c.bg,
      name: c.name,
      on,
      ring: on ? '2.5px solid #16785E' : '2.5px solid transparent',
      onPick: () => onToggle(i),
    };
  });

/** Ce que les deux cadres de A01P lisent. */
export interface A01PData {
  shareContacts: readonly ShareContactView[];
  shareNets: typeof shareNets;
  shareOut: typeof shareOut;
  /** Le libellé PORTE l'état : « Choisissez un contact » quand rien n'est choisi. */
  shareBtn: string;
  shareBtnBg: string;
  shareBtnFg: string;
}
