'use client';

import { O02Desktop } from '@/screens/o02/desktop.generated';
import { O02Mobile } from '@/screens/o02/mobile.generated';
import { useOnboardingFlow } from '@/screens/onboarding/use-onboarding-flow';
import { ScreenFrames } from '@/screens/frames';
import { FlowError } from '@/screens/onboarding/flow-error';
import { LevelInvitation } from '@/components/level-invitation';
import { SelecteurPays } from '@/screens/onboarding/selecteur-pays';
import { SelecteurVille } from '@/screens/onboarding/selecteur-ville';

/**
 * O02 — D’où venez-vous, où vivez-vous ?. Écran 3 des six de §5.
 *
 * Le JSX vient du TRANSCODAGE de `docs/template/01 Accès et Onboarding.dc.html`.
 * Seuls le comportement et l'appel à l'API s'écrivent ici.
 */
export default function Page() {
  const { vals, error, levelRequired, dismissLevelRequired } = useOnboardingFlow(3);

  /**
   * LE PANNEAU DE CHOIX DU PAYS, UN PAR CADRE.
   *
   * Le porteur : « il faut afficher un slide left modal quand on clique sur le pays
   * […] un modal dans la section qui cache tout le contenu de la section. »
   *
   * Il est monté ICI, et pas dans `data.ts`, pour une raison de géométrie : les
   * deux cadres ne recouvrent pas la même chose. Sur ordinateur la maquette dessine
   * une CARTE BLANCHE de 22 px de rayon autour des deux champs, et c'est elle que
   * le panneau doit couvrir, bord à bord. Sur téléphone il n'y a AUCUNE carte — les
   * champs sont posés à plat dans le cadre — donc le panneau prend la page. Un seul
   * panneau partagé aurait eu la mauvaise coque dans l'un des deux cas.
   *
   * C'est le même montage que `nouvelle-story-screen.tsx` pour le sélecteur de
   * parcours de A14 : le transcodeur ménage la place (`{{ paysSelecteur }}`), la
   * page y pose le composant.
   */
  /**
   * LE PANNEAU DES VILLES — « La sélection de ville : utilise le panneau aussi. »
   *
   * Même coque que celui des pays (`panneau-section.tsx`), même montage par cadre
   * et pour la même raison de géométrie. Le champ de recherche que la planche
   * dessinait sous « Où vivez-vous ? » n'a pas disparu : il est DANS le panneau,
   * à sa taille et avec sa loupe.
   */
  const selecteurVille = (variante: 'desktop' | 'mobile') => (
    <SelecteurVille
      ouvert={vals.villeOuvert}
      villes={vals.cities}
      villeId={null}
      recherche={vals.citySearch}
      onRecherche={vals.onCitySearch}
      variante={variante}
      onFermer={vals.onVilleFermer}
    />
  );

  const selecteur = (variante: 'desktop' | 'mobile') => (
    <SelecteurPays
      ouvert={vals.originOuvert}
      pays={vals.originOptions}
      choisiIso2={vals.originIso2}
      variante={variante}
      onChoisir={vals.onOriginPick}
      onFermer={vals.onOriginFermer}
    />
  );

  return (
    <>
      <ScreenFrames
        screen="O02"
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
        desktop={
          <O02Desktop
            {...vals}
            paysSelecteur={selecteur('desktop')}
            villeSelecteur={selecteurVille('desktop')}
          />
        }
        mobile={
          <O02Mobile
            {...vals}
            paysSelecteur={selecteur('mobile')}
            villeSelecteur={selecteurVille('mobile')}
          />
        }
      />
      <FlowError message={error} />
      <LevelInvitation details={levelRequired} onClose={dismissLevelRequired} />
    </>
  );
}
