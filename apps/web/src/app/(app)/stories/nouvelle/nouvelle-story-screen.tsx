'use client';

import { useCallback, useState } from 'react';
import { ScreenFrames } from '@/screens/frames';
import { A14Desktop } from '@/screens/a14/desktop.generated';
import { A14Mobile } from '@/screens/a14/mobile.generated';
import { A14MobilePhoto } from '@/screens/a14/mobilephoto.generated';
import { A14MobileRattacher } from '@/screens/a14/mobilerattacher.generated';
import { A14MobilePublier } from '@/screens/a14/mobilepublier.generated';
import { accueilData } from '@/screens/accueil/props';

/**
 * A14 — créer une story, en trois étapes. `/stories/nouvelle`
 *
 * Quatre cadres mobiles, qui sont les ÉTATS d'un même écran et non quatre écrans :
 * « 1 · Écrire », sa variante photo, « 2 · Rattacher », « 3 · Publier ». Le cadre
 * d'ordinateur porte les trois étapes dans une fenêtre sombre.
 *
 * SEUL ÉCRAN généré avec `keepFrameStyle` : ses cadres mettent de la vraie mise en
 * page dans le conteneur que le générateur retire d'habitude — remplissage, texte
 * blanc, et un fond qui est une DONNÉE (`background: {{ writeBg }}`, la couleur
 * choisie dans la palette). Sans la coque, du texte blanc se dessinait sur fond
 * clair, collé aux bords.
 *
 * ── CE QUE LA MAQUETTE NE DESSINE PAS, ET QU'ON N'INVENTE PAS ───────────────
 *
 * Il n'y a de bouton « suivant » QUE sur l'étape 2 (« Continuer ») et sur le cadre
 * d'ordinateur (`w.prev` / `w.next`). Le passage de l'étape 1 à l'étape 2 n'a aucun
 * contrôle dessiné sur mobile : la maquette montre ses quatre états côte à côte, une
 * planche n'a pas besoin de navigation.
 *
 * L'étape se lit donc dans l'URL (`?etape=1|2|3`), et le « Continuer » de l'étape 2
 * avance vraiment — c'est un bouton de la maquette, et le générateur lui donne son
 * action. Ajouter une barre d'étapes à la main serait dessiner à la place du
 * porteur ; l'exposer par l'URL ne dessine rien et rend les trois états atteignables
 * en attendant le flux du lot 3.
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
  const [msgs, setMsgs] = useState(true);
  const [photo, setPhoto] = useState(false);

  const onToggleMsgs = useCallback((): void => setMsgs((on) => !on), []);
  const onPhoto = useCallback((): void => setPhoto((on) => !on), []);
  const onContinue = useCallback((): void => setStep((s) => Math.min(2, s + 1)), []);

  const data = accueilData({
    pal,
    onPal: setPal,
    storyKind,
    onStoryKind: setStoryKind,
    audience,
    onAudience: setAudience,
    msgs,
    onToggleMsgs,
    step,
    photo,
    onPhoto,
    onContinue,
  });

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
