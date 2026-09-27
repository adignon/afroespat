'use client';

import { P02Desktop } from '@/screens/p02/desktop.generated';
import { P02Mobile } from '@/screens/p02/mobile.generated';
import { useOnboarding } from '@/screens/onboarding/data';
import { ScreenFrames } from '@/screens/frames';

/**
 * P02 — Entrez le code reçu.
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
      screen="P02"
      desktop={<P02Desktop {...vals} />}
      mobile={<P02Mobile {...vals} />}
    />
  );
}
