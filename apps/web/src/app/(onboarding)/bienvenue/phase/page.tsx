'use client';

import { O01Desktop } from '@/screens/o01/desktop.generated';
import { O01Mobile } from '@/screens/o01/mobile.generated';
import { useOnboardingFlow } from '@/screens/onboarding/use-onboarding-flow';
import { ScreenFrames } from '@/screens/frames';
import { FlowError } from '@/screens/onboarding/flow-error';
import { LevelInvitation } from '@/components/level-invitation';

/**
 * O01 — Où en êtes-vous ?. Écran 2 des six de §5.
 *
 * Le JSX vient du TRANSCODAGE de `docs/template/01 Accès et Onboarding.dc.html`.
 * Seuls le comportement et l'appel à l'API s'écrivent ici.
 */
export default function Page() {
  const { vals, error, levelRequired, dismissLevelRequired } = useOnboardingFlow(2);

  return (
    <>
      <ScreenFrames
        screen="O01"
        desktop={<O01Desktop {...vals} />}
        mobile={<O01Mobile {...vals} />}
      />
      <FlowError message={error} />
      <LevelInvitation details={levelRequired} onClose={dismissLevelRequired} />
    </>
  );
}
