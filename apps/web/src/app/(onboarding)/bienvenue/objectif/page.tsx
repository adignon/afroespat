'use client';

import { O03Desktop } from '@/screens/o03/desktop.generated';
import { O03Mobile } from '@/screens/o03/mobile.generated';
import { useOnboarding } from '@/screens/onboarding/data';
import { ScreenFrames } from '@/screens/frames';

/**
 * O03 — Quel est votre objectif ?.
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
      screen="O03"
      desktop={<O03Desktop {...vals} />}
      mobile={<O03Mobile {...vals} />}
    />
  );
}
