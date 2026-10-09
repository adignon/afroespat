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
      /**
       * `direction="column"` : LA MAQUETTE ÉCRIT `flex-direction: column` SUR CE
       * CADRE, et le générateur retire ce conteneur parce qu’il portait aussi la
       * taille fixe de la planche. L’enveloppe repose alors sur son défaut — une
       * RANGÉE, qui est juste pour les écrans à rail de gauche et faux pour
       * ceux-ci.
       *
       * MESURÉ AU NAVIGATEUR, et c’est le porteur qui l’a vu : « La page
       * d’onboarding a une pagination à gauche ? » Non — la maquette dessine une
       * BARRE DE PROGRESSION EN HAUT (bouton retour, six segments sur toute la
       * largeur, compteur à droite). En rangée, cette barre devenait une colonne
       * de 216 px de large sur toute la hauteur, ses six segments écrasés à 30 px,
       * et le bouton avec le compteur flottaient au milieu à gauche. Les HUIT
       * cadres d’ordinateur de cette maquette sont des colonnes : toutes les
       * pages de ce groupe portent donc cette prise.
       */
      direction="column"
        desktop={<O01Desktop {...vals} />}
        mobile={<O01Mobile {...vals} />}
      />
      <FlowError message={error} />
      <LevelInvitation details={levelRequired} onClose={dismissLevelRequired} />
    </>
  );
}
