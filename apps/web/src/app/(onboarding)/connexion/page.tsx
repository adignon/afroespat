'use client';

import { P01Desktop } from '@/screens/p01/desktop.generated';
import { P01Mobile } from '@/screens/p01/mobile.generated';
import { useOnboarding } from '@/screens/onboarding/data';
import { ScreenFrames } from '@/screens/frames';

/**
 * P01 — Votre numéro de téléphone.
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
      screen="P01"
      desktop={<P01Desktop {...vals} />}
      mobile={<P01Mobile {...vals} />}
    />
  );
}
