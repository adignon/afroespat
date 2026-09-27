'use client';

import { P01Desktop } from '@/screens/p01/desktop.generated';
import { P01Mobile } from '@/screens/p01/mobile.generated';
import { useOnboardingFlow } from '@/screens/onboarding/use-onboarding-flow';
import { ScreenFrames } from '@/screens/frames';
import { FlowError } from '@/screens/onboarding/flow-error';

/**
 * P01 — Votre numéro de téléphone. Écran 1 des six de §5.
 *
 * Le JSX vient du TRANSCODAGE de `docs/template/01 Accès et Onboarding.dc.html` :
 * le champ dessiné en `<div>` y devient un vrai `<input>`, et son exemple
 * « 97 12 34 42 » devient le `placeholder` — ce qu'il était déjà.
 */
export function ConnexionScreen({ initialError }: { readonly initialError: string | null }) {
  const { vals, error } = useOnboardingFlow(1, initialError);

  return (
    <>
      <ScreenFrames
        screen="P01"
        desktop={<P01Desktop {...vals} />}
        mobile={<P01Mobile {...vals} />}
      />
      <FlowError message={error} />
    </>
  );
}
