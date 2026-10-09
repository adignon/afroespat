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
        desktop={<P02Desktop {...vals} />}
        mobile={<P02Mobile {...vals} />}
      />
      <FlowError message={error} />
      <LevelInvitation details={levelRequired} onClose={dismissLevelRequired} />
    </>
  );
}
