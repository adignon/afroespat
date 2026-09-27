'use client';

import { P02Desktop } from '@/screens/p02/desktop.generated';
import { P02Mobile } from '@/screens/p02/mobile.generated';
import { useOnboardingFlow } from '@/screens/onboarding/use-onboarding-flow';
import { ScreenFrames } from '@/screens/frames';
import { CodeInput } from '@/screens/onboarding/code-input';
import { FlowError } from '@/screens/onboarding/flow-error';

/**
 * P02 — le code reçu par SMS. Écran 1 de §5, seconde moitié.
 *
 * La maquette ne dessine AUCUN bouton d'envoi : la vérification part au sixième
 * chiffre. Le champ, lui, est unique et masqué — voir `CodeInput`, qui explique
 * pourquoi six cases séparées seraient un recul.
 */
export default function Page() {
  const { vals, error } = useOnboardingFlow(1);

  return (
    <>
      <CodeInput value={vals.codeValue} onChange={vals.onCodeChange} disabled={vals.busy} />
      <ScreenFrames
        screen="P02"
        desktop={<P02Desktop {...vals} />}
        mobile={<P02Mobile {...vals} />}
      />
      <FlowError message={error} />
    </>
  );
}
