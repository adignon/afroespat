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
 * `shareNets` A ÉTÉ BRANCHÉ DEPUIS. Cette note disait « la seule source possible est
 * le module `communities`, qui n'a pas de schéma de réponse dans
 * `packages/shared` » : `communitiesResponseSchema` existe aujourd'hui, et sa clé
 * `mine` porte les réseaux du membre. Voir la prise plus bas.
 */

export { SHARE_SELECTION_DEFAULT, shareButtonFor } from '../a01/data';

/**
 * Un contact proposé au partage, tel que les deux cadres le lisent.
 *
 * `ring` non sélectionné vaut `2.5px solid transparent` et non `none` : une bordure
 * qui APPARAÎT déplacerait l'avatar de deux pixels et demi à chaque clic.
 */
export interface ShareContactView {
  /**
   * L'ADRESSE DU PROFIL PUBLIC — `/@handle`, ou absente.
   *
   * Le porteur : « ajoute l'accès au profil public d'un utilisateur à partir des
   * publications (quand on clique sur son nom […]) partout où le nom est
   * affiché ». Les trente-sept noms dessinés dans les cadres étaient des `<span>`
   * et aucun ne menait au profil.
   *
   * FACULTATIVE, ET C'EST LA GARDE : tous les noms ne sont pas des membres — un
   * réseau, une ville, un partenaire en portent un aussi — et le cadre ne pose le
   * lien que si la ligne porte une adresse. Sans elle, le nom reste nu, c'est-à-
   * dire exactement le dessin d'avant.
   */
  readonly profil?: string;
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
  /**
   * VRAI QUAND LA RECHERCHE NE TROUVE PERSONNE — et seulement alors.
   *
   * Le porteur : « Le champ recherche du modal partager ne marche pas ; s'il n'a
   * pas trouvé, il doit dire qu'il n'a pas trouvé. » La rangée se vidait en
   * silence, et rien ne distinguait « aucun contact en ligne » de « aucun à ce
   * nom » ni d'une fenêtre cassée.
   *
   * ⚠ LA DISTINCTION COMPTE : vrai seulement si QUELQUE CHOSE A ÉTÉ TAPÉ. Un
   * membre sans aucun contact en ligne ne cherche rien — lui dire « aucun contact
   * à ce nom » serait répondre à une question qu'il n'a pas posée.
   */
  partageAucun?: boolean;
  /**
   * ╔══════════════════════════════════════════════════════════════════════╗
   * ║ LES RÉSEAUX SONT CEUX DU MEMBRE — ils étaient ceux de la maquette      ║
   * ╚══════════════════════════════════════════════════════════════════════╝
   *
   * La note d'en-tête de ce fichier disait « la seule source possible est le module
   * `communities`, qui n'a pas de schéma de réponse dans `packages/shared` ». Ce
   * n'est plus vrai : `communitiesResponseSchema` existe, et sa clé `mine` porte
   * exactement les réseaux du membre. « Lyon et Rhône · 1 400 membres » venait de
   * la planche, et s'affichait à un membre qui n'en fait pas partie.
   *
   * `action` PORTE L'ÉTAT DE L'ENVOI — « Partager », « Envoi… », « Partagé » —
   * comme le libellé de « Publier » le fait sur le composeur. Deux clics sur le
   * même réseau créeraient deux publications.
   */
  shareNets: readonly {
    readonly i: string;
    readonly bg: string;
    readonly name: string;
    readonly sub: string;
    readonly action: string;
    readonly bloque: boolean;
    readonly onPartager: () => void;
  }[];
  /** « Copier le lien », « WhatsApp », « Email » — les trois tuiles de la planche. */
  shareOut: readonly {
    readonly label: string;
    readonly icon: string;
    readonly onChoisir: () => void;
  }[];
  /**
   * L'APERÇU de la publication partagée. `null` quand on ne l'a pas — la fenêtre
   * s'ouvre depuis une carte du fil, mais pas depuis un lien profond.
   */
  partageSujet: {
    readonly i: string;
    readonly bg: string;
    readonly titre: string;
    readonly extrait: string;
  } | null;
  /** Le champ qui FILTRE les contacts dessous — c'était un `<div>` de texte. */
  partageRecherche: string;
  onPartageRecherche: (event: { target: { value: string } }) => void;
  /** Le libellé PORTE l'état : « Choisissez un contact » quand rien n'est choisi. */
  shareBtn: string;
  shareBtnBg: string;
  shareBtnFg: string;
  /**
   * L'ENVOI — il n'existait pas. Voir `app/(app)/accueil/page.tsx` : partager à un
   * contact, c'est lui écrire, et `POST /conversations/direct` porte déjà les cinq
   * règles qu'une route de partage aurait dû redire.
   */
  onPartager: () => void;
  /** Éteint tant qu'aucun contact n'est choisi, et pendant l'envoi. */
  partageBloque: boolean;
}
