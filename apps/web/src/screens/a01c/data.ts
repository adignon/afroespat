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

import type { CommentSort } from '@app/shared';

import type { CommentView } from '../a01/data';

/**
 * Ce que les deux cadres de A01C lisent. Une propriété, et c'est tout.
 *
 * `readonly` sur le tableau : la fenêtre AFFICHE un fil, elle ne le trie pas et ne
 * le complète pas. Ce qui pagine, c'est l'appel (`nextCursor`), pas le cadre.
 */
export interface A01CData {
  thread: readonly CommentView[];
  /**
   * ╔════════════════════════════════════════════════════════════════════════╗
   * ║ ON POUVAIT LIRE LES COMMENTAIRES, PAS EN ÉCRIRE                       ║
   * ╚════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur : « finalise […] les commentaires […] au niveau des posts ».
   *
   * MESURÉ au navigateur : la fenêtre s'ouvrait bien sur la bonne publication et
   * affichait son fil — « Commentaires · 8 », les réponses, les deux onglets — avec
   * un bouton « Envoyer » et AUCUN champ. La ligne « Écrire un commentaire… » était
   * un `<div>` portant ce texte en dur.
   *
   * `usePublication` portait pourtant `commenter(body)` depuis le branchement du
   * module, avec son insertion recalée sur la réponse du serveur. Il manquait le
   * champ et le fil entre les deux.
   */
  commentaireTexte: string;
  onCommentaireTexte: (event: { target: { value: string } }) => void;
  onEnvoyerCommentaire: () => void;
  /** Éteint tant qu'il n'y a rien à envoyer, et pendant l'envoi. */
  envoiBloque: boolean;

  /**
   * ╔═══════════════════════════════════════════════════════════════════════╗
   * ║ LA CARTE DU HAUT EST LA PUBLICATION, PAS UN COMMENTAIRE               ║
   * ╚═══════════════════════════════════════════════════════════════════════╝
   *
   * La planche la dessine en dur : « Amina Diallo · Victoire » et son texte. Le
   * porteur l'a vue apparaître sur une publication qui n'était pas d'elle — la
   * fenêtre affirmait une publication qu'elle n'avait pas.
   *
   * `null` QUAND ON NE L'A PAS : la fenêtre s'ouvre depuis le fil, qui connaît la
   * carte ; depuis un lien profond, elle ne l'a pas encore. Mieux vaut pas de carte
   * qu'une carte d'exemple.
   */
  sujetCarte: {
    readonly i: string;
    readonly bg: string;
    readonly nom: string;
    readonly badge: string;
    readonly extrait: string;
  } | null;

  /** « · 8 » dans le titre — le compte du SERVEUR, pas celui de la planche. */
  commentairesCompte: string;

  /**
   * ╔═══════════════════════════════════════════════════════════════════════╗
   * ║ L'ÉTAT VIDE — « Soyez la première personne à réagir. »                ║
   * ╚═══════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur : « "AUCUN COMMENTAIRE · Soyez la première personne à réagir" :
   * extrais. »
   *
   * La maquette le dessine dans la colonne « ÉTATS » de A01C, hors des deux
   * cadres. Jusqu'ici une feuille ouverte sur un guide ou une publication sans
   * commentaire montrait une zone VIDE entre la carte du sujet et le champ de
   * saisie : rien ne disait au lecteur qu'il pouvait être le premier.
   *
   * ⚠ « VIDE » VEUT DIRE « CHARGÉ ET VIDE », jamais « pas encore chargé ». Les
   * deux appelants l'écrivent `fil !== null && thread.length === 0` : pendant la
   * requête, `fil` est `null` et la carte ne s'affiche pas. Lui donner
   * `thread.length === 0` tout court ferait clignoter « Soyez la première
   * personne à réagir » sur chaque ouverture, y compris sur un fil de douze
   * commentaires — c'est-à-dire une affirmation fausse pendant un tiers de
   * seconde.
   *
   * ⚠ UN FIL QUI NE CONTIENT QU'UN EMPLACEMENT RETIRÉ N'EST PAS VIDE. `thread`
   * porte les emplacements comme des lignes, donc sa longueur vaut 1 et la carte
   * ne s'affiche pas — ce qui est juste : il y a bien eu un commentaire, et le
   * lecteur n'est pas la première personne à réagir.
   *
   * L'ÉTIQUETTE « AUCUN COMMENTAIRE » DE LA MAQUETTE N'EST PAS TRANSCODÉE : c'est
   * de la documentation, et la preuve est la carte voisine, coiffée de
   * « NIVEAU L0 ». L'arbitrage est écrit au-dessus de `A01C_DONNEES` dans
   * `tools/screens/03-accueil.mjs`.
   */
  filVide: boolean;

  /**
   * LE TRI, ET SON LIBELLÉ.
   *
   * `triCommentaires` porte la valeur (`RELEVANT` / `RECENT`) : c'est elle qui dit
   * quel onglet est allumé sur l'ordinateur. `triLibelle` porte le MOT, pour le
   * déclencheur unique du téléphone — écrire `RELEVANT` à l'écran mettrait un
   * terme d'API sous les yeux du membre.
   *
   * `onTriCommentaires()` SANS ARGUMENT bascule sur l'autre tri : c'est ce dont le
   * déclencheur unique a besoin, et c'est aussi ce qu'un `onClick` nu appellerait.
   */
  triCommentaires: CommentSort;
  triLibelle: string;
  onTriCommentaires: (valeur?: CommentSort) => void;

  /** « Voir N autres commentaires » — dessiné seulement s'il reste une page. */
  suiteVisible: boolean;
  suiteLibelle: string;
  onVoirSuite: () => void;

  /**
   * « En réponse à ‹nom› » — `null` tant qu'on ne répond à personne.
   *
   * La planche dessine la bande EN PERMANENCE, avec « Sandra M. ». Elle annonçait
   * donc une réponse à quelqu'un qui n'existe pas, et sa croix — un `<svg>` nu —
   * n'annulait rien.
   */
  reponseA: string | null;
  onAnnulerReponse: () => void;
}
