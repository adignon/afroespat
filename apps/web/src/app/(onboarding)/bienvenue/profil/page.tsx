'use client';

import { O04Desktop } from '@/screens/o04/desktop.generated';
import { O04Mobile } from '@/screens/o04/mobile.generated';
import { useOnboarding } from '@/screens/onboarding/data';
import { ScreenFrames } from '@/screens/frames';

/**
 * O04 — Présentez-vous.
 *
 * Le JSX vient du TRANSCODAGE de `docs/template/01 Accès et Onboarding.dc.html` :
 * les styles en ligne sont ceux de la maquette, à l'identique.
 *
 * `useOnboarding` porte l'état que la maquette calcule dans son `renderVals()` —
 * carte de phase choisie, interrupteurs. C'est ce qui rend l'écran vivant plutôt
 * qu'illustratif.
 */
export default function Page() {
  const { vals } = useOnboarding();

  return (
    <ScreenFrames
      screen="O04"
      desktop={<O04Desktop {...vals} />}
      mobile={<O04Mobile {...vals} />}
    />
  );
}
