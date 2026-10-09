'use client';

import { P01Desktop } from '@/screens/p01/desktop.generated';
import { P01Mobile } from '@/screens/p01/mobile.generated';
import { useOnboardingFlow } from '@/screens/onboarding/use-onboarding-flow';
import { ScreenFrames } from '@/screens/frames';
import { FlowError } from '@/screens/onboarding/flow-error';
import { LevelInvitation } from '@/components/level-invitation';
import { SelecteurPays } from '@/screens/onboarding/selecteur-pays';

/**
 * P01 — Votre numéro de téléphone. Écran 1 des six de §5.
 *
 * Le JSX vient du TRANSCODAGE de `docs/template/01 Accès et Onboarding.dc.html` :
 * le champ dessiné en `<div>` y devient un vrai `<input>`, et son exemple
 * « 97 12 34 42 » devient le `placeholder` — ce qu'il était déjà.
 */
export function ConnexionScreen({ initialError }: { readonly initialError: string | null }) {
  const { vals, error, levelRequired, dismissLevelRequired } = useOnboardingFlow(1, initialError);

  /**
   * LE PANNEAU DE CHOIX DE L'INDICATIF — le MÊME qu'en O02.
   *
   * Le porteur : « Utilise le modal de sélection du pays ici aussi. »
   *
   * Monté par cadre, parce que la géométrie diffère : la planche d'ordinateur
   * dessine une carte blanche de 420 px que le panneau recouvre, le téléphone
   * pose son contenu à plat. C'est le même montage qu'en O02, et le même
   * composant — en écrire un second aurait fait deux dessins qui divergent.
   *
   * LA LISTE N'EST PAS FILTRÉE ICI, contrairement à O02 : on choisit un
   * INDICATIF, pas un pays d'origine. La France en fait partie, et c'est elle que
   * la plupart des membres déjà arrivés emploieront.
   */
  const selecteur = (variante: 'desktop' | 'mobile') => (
    <SelecteurPays
      ouvert={vals.countryOuvert}
      pays={vals.countryOptions}
      choisiIso2={vals.countryIso2}
      variante={variante}
      onChoisir={vals.onCountryPick}
      onFermer={vals.onCountryFermer}
    />
  );

  return (
    <>
      <ScreenFrames
        screen="P01"
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
        desktop={<P01Desktop {...vals} paysIndicatifSelecteur={selecteur('desktop')} />}
        mobile={<P01Mobile {...vals} paysIndicatifSelecteur={selecteur('mobile')} />}
      />
      <FlowError message={error} />
      <LevelInvitation details={levelRequired} onClose={dismissLevelRequired} />
    </>
  );
}
