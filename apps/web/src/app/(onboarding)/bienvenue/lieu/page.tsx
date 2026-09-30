'use client';

import { O02Desktop } from '@/screens/o02/desktop.generated';
import { O02Mobile } from '@/screens/o02/mobile.generated';
import { useOnboardingFlow } from '@/screens/onboarding/use-onboarding-flow';
import { ScreenFrames } from '@/screens/frames';
import { FlowError } from '@/screens/onboarding/flow-error';
import { LevelInvitation } from '@/components/level-invitation';

/**
 * O02 — D’où venez-vous, où vivez-vous ?. Écran 3 des six de §5.
 *
 * Le JSX vient du TRANSCODAGE de `docs/template/01 Accès et Onboarding.dc.html`.
 * Seuls le comportement et l'appel à l'API s'écrivent ici.
 */
export default function Page() {
  const { vals, error, levelRequired, dismissLevelRequired } = useOnboardingFlow(3);

  return (
    <>
      <ScreenFrames
        screen="O02"
        desktop={<O02Desktop {...vals} />}
        mobile={<O02Mobile {...vals} />}
      />
      <FlowError message={error} />
      <LevelInvitation details={levelRequired} onClose={dismissLevelRequired} />
    </>
  );
}
