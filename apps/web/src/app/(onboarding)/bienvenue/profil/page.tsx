'use client';

import { O04Desktop } from '@/screens/o04/desktop.generated';
import { O04Mobile } from '@/screens/o04/mobile.generated';
import { useOnboardingFlow } from '@/screens/onboarding/use-onboarding-flow';
import { ScreenFrames } from '@/screens/frames';
import { FlowError } from '@/screens/onboarding/flow-error';

/**
 * O04 — Présentez-vous. Écran 5 des six de §5.
 *
 * Le JSX vient du TRANSCODAGE de `docs/template/01 Accès et Onboarding.dc.html`.
 * Seuls le comportement et l'appel à l'API s'écrivent ici.
 */
export default function Page() {
  const { vals, error } = useOnboardingFlow(5);

  return (
    <>
      <ScreenFrames
        screen="O04"
        desktop={<O04Desktop {...vals} />}
        mobile={<O04Mobile {...vals} />}
      />
      <FlowError message={error} />
    </>
  );
}
