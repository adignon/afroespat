'use client';

import { O02Desktop } from '@/screens/o02/desktop.generated';
import { O02Mobile } from '@/screens/o02/mobile.generated';
import { useOnboarding } from '@/screens/onboarding/data';
import { ScreenFrames } from '@/screens/frames';

/**
 * O02 — D’où venez-vous, où vivez-vous ?.
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
      screen="O02"
      desktop={<O02Desktop {...vals} />}
      mobile={<O02Mobile {...vals} />}
    />
  );
}
