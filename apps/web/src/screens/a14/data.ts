/**
 * A14 — créer une story. LES PRISES DÉCLARÉES.
 *
 * Cinq cadres, qui sont les ÉTATS d'un même écran : « 1 · Écrire », sa variante
 * photo, « 2 · Rattacher », « 3 · Publier », et la fenêtre sombre d'ordinateur qui
 * porte les trois étapes. Tout ce qu'ils lisent est de l'ÉTAT DE COMPOSITION —
 * couleur, type, audience, étape — donc rien ne vient du serveur, et c'est normal :
 * on compose avant d'envoyer.
 *
 * ── CE QUE LA MAQUETTE NE DESSINE PAS, ET QUI EMPÊCHE DE PUBLIER ───────────
 *
 * Il faut le dire net plutôt que de le contourner : CE CADRE N'A AUCUN CHAMP DE
 * SAISIE. Compté sur les cinq cadres — zéro `<textarea>`, zéro `<input>`, zéro
 * `contentEditable`. Le texte de la story (« Pour Visale, déposez votre VLS-TS… »)
 * est écrit en dur dans `docs/template/03 Accueil v2.dc.html`.
 *
 * Et le bouton « Publier » de l'étape 3 n'est qu'un dessin : le seul contrôle que
 * le transcodeur branche sur cet écran est le « Continuer » de l'étape 2
 * (`BUTTON_ACTIONS`, borné à A14), qui fait avancer d'une étape et rien d'autre.
 *
 * Conséquence : `POST /stories` ne peut être appelé depuis A14 avec AUCUN corps
 * que le membre aurait rédigé. Ce qui manque est (a) un champ de saisie dans la
 * maquette — décision du porteur — et (b) une entrée `BUTTON_ACTIONS` pour
 * « Publier », dans `tools/generate-screens.mjs`. Les deux sont remontés. Ce qui
 * n'est PAS fait, et ne doit pas l'être : retoucher le JSX généré, que la
 * régénération effacerait, ou ajouter une zone de texte à la main par-dessus un
 * cadre transcodé.
 *
 * Ce qui EST branché, parce que ça se branche honnêtement : le droit de composer.
 * `meta.canCreate` de `GET /stories` est recalculé PAR LE SERVEUR à chaque requête,
 * donc il ne périme pas comme une copie gardée du niveau le ferait — et on ne lit
 * JAMAIS le niveau pour autoriser. Le rappel affiché sous le composeur
 * (`meta.reminder` : « Pas de lien, pas de numéro, pas de montant. ») vient lui
 * aussi du serveur.
 */

export {
  attachSteps,
  attachTopics,
  audienceFor,
  msgsFor,
  paletteFor,
  photoTools,
  storyKindsFor,
  webFrameFor,
  webKindFor,
  webKindsFor,
  webPaletteFor,
  webPillFor,
  writeBgFor,
} from '../accueil/data';

import type {
  attachSteps,
  attachTopics,
  audienceFor,
  paletteFor,
  photoTools,
  storyKindsFor,
  webFrameFor,
  webKindsFor,
  webPaletteFor,
} from '../accueil/data';

/**
 * Ce que les cinq cadres de A14 lisent.
 *
 * `writeBg` est la couleur de fond CHOISIE, et c'est une donnée qui peint le cadre
 * entier — pas un jeton de thème. Elle n'est jamais assombrie : la règle de
 * contraste se tient par le texte blanc que la maquette pose dessus, et les sept
 * couleurs de la palette sont celles du dessin, à l'identique.
 */
export interface A14Data {
  /** Étape 1, mobile. */
  writeBg: string;
  palette: ReturnType<typeof paletteFor>;
  storyKinds: ReturnType<typeof storyKindsFor>;
  photoTools: typeof photoTools;

  /** Étape 2, mobile : à quoi rattacher la story. */
  attachSteps: typeof attachSteps;
  attachTopics: typeof attachTopics;
  /** Le seul contrôle que le transcodeur branche sur cet écran. */
  onContinue: () => void;

  /** Étape 3, mobile : qui voit, et qui peut écrire. */
  audience: ReturnType<typeof audienceFor>;
  msgsTrack: string;
  msgsKnob: string;
  toggleMsgs: () => void;

  /** Le cadre d'ordinateur, qui porte les trois étapes dans une fenêtre sombre. */
  webKind: string;
  webPill: string;
  webKinds: ReturnType<typeof webKindsFor>;
  webPalette: ReturnType<typeof webPaletteFor>;
  w: ReturnType<typeof webFrameFor>;
}
