'use client';

import { O03Desktop } from '@/screens/o03/desktop.generated';
import { O03Mobile } from '@/screens/o03/mobile.generated';
import { useOnboardingFlow } from '@/screens/onboarding/use-onboarding-flow';
import { ScreenFrames } from '@/screens/frames';
import { FlowError } from '@/screens/onboarding/flow-error';
import { LevelInvitation } from '@/components/level-invitation';

/**
 * O03 — Quel est votre objectif ?. Écran 4 des six de §5.
 *
 * Le JSX vient du TRANSCODAGE de `docs/template/01 Accès et Onboarding.dc.html`.
 * Seuls le comportement et l'appel à l'API s'écrivent ici.
 */
export default function Page() {
  const { vals, error, levelRequired, dismissLevelRequired } = useOnboardingFlow(4);

  return (
    <>
      <ScreenFrames
        screen="O03"
        desktop={<O03Desktop {...vals} />}
        mobile={<O03Mobile {...vals} />}
      />
      <FlowError message={error} />
      <LevelInvitation details={levelRequired} onClose={dismissLevelRequired} />
    </>
  );
}
