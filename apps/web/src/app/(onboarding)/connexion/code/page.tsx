'use client';

import { P02Desktop } from '@/screens/p02/desktop.generated';
import { P02Mobile } from '@/screens/p02/mobile.generated';
import { useOnboardingFlow } from '@/screens/onboarding/use-onboarding-flow';
import { ScreenFrames } from '@/screens/frames';
import { FlowError } from '@/screens/onboarding/flow-error';
import { LevelInvitation } from '@/components/level-invitation';

/**
 * P02 — le code reçu par SMS. Écran 1 de §5, seconde moitié.
 *
 * La maquette ne dessine AUCUN bouton d'envoi : la vérification part au sixième
 * chiffre.
 *
 * ── LE CHAMP N'EST PLUS ICI, ET C'EST LA CORRECTION ─────────────────────────
 *
 * Cette page montait un `<CodeInput />` à CÔTÉ du cadre : un champ de 1 px, opaque
 * à zéro, focalisé une seule fois au montage et désactivé pendant la
 * vérification. Trois conséquences, toutes vécues par le porteur :
 *
 *   · au sixième chiffre, `busy` passait à vrai, le champ devenait `disabled`, et
 *     le navigateur le DÉFOCALISAIT. Personne ne lui rendait le focus au retour ;
 *   · les six cases étant des `<div>`, cliquer dessus ne focalisait rien. Le
 *     membre cliquait là où il regardait, tapait, et rien ne bougeait ;
 *   · le champ vivait hors du cadre, donc hors du dessin — aucun geste visible ne
 *     pouvait le désigner.
 *
 * Le champ est maintenant POSÉ SUR les six cases par le générateur (`OTP_FIELD`
 * dans `tools/generate-screens.mjs`), transparent et à leur taille exacte : la
 * surface qu'on clique EST le champ. Un seul champ, toujours — c'est ce qui fait
 * marcher le collage et le remplissage automatique depuis le SMS.
 */
export default function Page() {
  const { vals, error, levelRequired, dismissLevelRequired } = useOnboardingFlow(1);

  return (
    <>
      <ScreenFrames
        screen="P02"
        desktop={<P02Desktop {...vals} />}
        mobile={<P02Mobile {...vals} />}
      />
      <FlowError message={error} />
      <LevelInvitation details={levelRequired} onClose={dismissLevelRequired} />
    </>
  );
}
