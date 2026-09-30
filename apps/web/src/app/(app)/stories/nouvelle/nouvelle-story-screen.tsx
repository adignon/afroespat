'use client';

import { useCallback, useState } from 'react';
import { ScreenFrames } from '@/screens/frames';
import { A14Desktop } from '@/screens/a14/desktop.generated';
import { A14Mobile } from '@/screens/a14/mobile.generated';
import { A14MobilePhoto } from '@/screens/a14/mobilephoto.generated';
import { A14MobileRattacher } from '@/screens/a14/mobilerattacher.generated';
import { A14MobilePublier } from '@/screens/a14/mobilepublier.generated';
import {
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
  type A14Data,
} from '@/screens/a14/data';

/**
 * A14 — créer une story, en trois étapes. `/stories/nouvelle`
 *
 * Cinq cadres, qui sont les ÉTATS d'un même écran et non cinq écrans : « 1 ·
 * Écrire », sa variante photo, « 2 · Rattacher », « 3 · Publier », et la fenêtre
 * sombre d'ordinateur qui porte les trois étapes.
 *
 * ── POURQUOI CET ÉCRAN N'APPELLE PAS L'API, ET CE N'EST PAS UN OUBLI ───────
 *
 * On ne peut pas publier depuis A14, et il faut le dire plutôt que de brancher
 * quelque chose qui en donnerait l'air :
 *
 *   · AUCUN CHAMP DE SAISIE. Compté sur les cinq cadres générés : zéro
 *     `<textarea>`, zéro `<input>`, zéro `contentEditable`. Le texte de la story
 *     est écrit en dur dans `docs/template/03 Accueil v2.dc.html`. Il n'existe donc
 *     aucun corps à envoyer à `POST /stories` ;
 *   · LE BOUTON « PUBLIER » N'EST QU'UN DESSIN. Le seul contrôle que le transcodeur
 *     branche ici est le « Continuer » de l'étape 2 (`BUTTON_ACTIONS`, borné à A14),
 *     qui avance d'une étape.
 *
 * Les deux manques sont REMONTÉS. Ce qu'on ne fait pas : ajouter une zone de texte
 * à la main par-dessus un cadre transcodé, ni retoucher le JSX généré — la
 * régénération l'effacerait, et on aurait dessiné à la place du porteur.
 *
 * Ce qui a changé malgré tout, et qui compte pour la suite : cet écran déclare
 * maintenant son propre contrat (`A14Data`, quinze prises) au lieu des cinquante
 * de `AccueilData`. Le jour où la maquette donnera un champ, on saura exactement
 * quoi remplir — et `createStorySchema` (280 caractères, un seul fond, audience et
 * messages obligatoires) est déjà la seule autorité sur ce qui part.
 *
 * ── L'ÉTAT DE COMPOSITION ─────────────────────────────────────────────────
 *
 * Il vit dans la page, comme la maquette le calcule dans son `renderVals()`.
 * L'étape se lit dans l'URL parce que la maquette ne dessine AUCUN contrôle de
 * navigation entre l'étape 1 et l'étape 2 sur mobile : elle montre ses états côte à
 * côte, une planche n'a pas besoin de navigation. L'exposer par l'URL ne dessine
 * rien et rend les trois états atteignables.
 *
 * AUCUNE ANIMATION entre les étapes : `motion.js` réserve `panelAdvance` et
 * `onboardingStep` aux parcours de démarche. Une composition de story n'en est pas
 * un, et rien dans la table ne couvre ce cas.
 */
export function NouvelleStoryScreen({ etape }: { readonly etape: number }) {
  const [step, setStep] = useState(Math.min(2, Math.max(0, etape - 1)));
  const [pal, setPal] = useState(0);
  const [storyKind, setStoryKind] = useState(0);
  const [audience, setAudience] = useState(0);
  // La maquette dessine l'interrupteur ALLUMÉ : `this.state.msgs === false` est faux
  // au premier rendu, donc la piste est verte.
  const [msgs, setMsgs] = useState(true);
  const [photo, setPhoto] = useState(false);

  const onToggleMsgs = useCallback((): void => setMsgs((on) => !on), []);
  const onPhoto = useCallback((): void => setPhoto((on) => !on), []);
  const onContinue = useCallback((): void => setStep((s) => Math.min(2, s + 1)), []);

  const data: A14Data = {
    writeBg: writeBgFor(pal),
    palette: paletteFor(pal, setPal),
    storyKinds: storyKindsFor(storyKind, setStoryKind),
    photoTools,

    attachSteps,
    attachTopics,
    onContinue,

    audience: audienceFor(audience, setAudience),
    ...msgsFor(msgs),
    toggleMsgs: onToggleMsgs,

    webKind: webKindFor(storyKind),
    webPill: webPillFor(storyKind),
    webKinds: webKindsFor(storyKind, setStoryKind),
    webPalette: webPaletteFor(pal, setPal),
    w: webFrameFor(step, photo, onPhoto),
  };

  /**
   * La variante photo n'est pas une étape de plus : c'est l'étape 1 quand une photo
   * a été jointe, exactement comme la maquette l'annonce — « Écrire · variante photo
   * · Rattacher · Publier ».
   */
  const mobile =
    step === 0 && photo ? (
      <A14MobilePhoto {...data} />
    ) : step === 0 ? (
      <A14Mobile {...data} />
    ) : step === 1 ? (
      <A14MobileRattacher {...data} />
    ) : (
      <A14MobilePublier {...data} />
    );

  return (
    <ScreenFrames
      screen={`A14-${step + 1}`}
      background={data.writeBg}
      desktop={<A14Desktop {...data} />}
      mobile={mobile}
    />
  );
}
