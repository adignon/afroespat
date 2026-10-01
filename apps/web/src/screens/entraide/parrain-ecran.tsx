'use client';

import { useCallback } from 'react';
import { EcranDonnees } from '@/screens/compte/ecran-donnees';
import { chargerH06 } from '@/screens/entraide/appels';
import { ScreenFrames } from '@/screens/frames';
import { H06Desktop } from '@/screens/h06/desktop.generated';

/**
 * H06 — la fiche d'un parrain, chargée depuis `GET /mentors/:handle`.
 *
 * UN SEUL CADRE, et ce n'est pas un oubli : la maquette ne dessine PAS cette fiche
 * sur téléphone. Sa planche « MOBILE » montre la FEUILLE DE DEMANDE posée sur un
 * voile — un autre écran. `ScreenFrames` sert donc le cadre d'ordinateur à toutes
 * les largeurs, comme il le fait pour O05, et la feuille de demande est remontée
 * plutôt que montée à moitié.
 *
 * `charger` est un `useCallback` mémoïsé sur le pseudo : voir `demande-ecran.tsx`
 * pour la raison, qui est la même.
 *
 * « Demander comme parrain » est INERTE. Une demande de parrainage est un message de
 * cinquante caractères minimum adressé à quelqu'un (§2.2), et ce lot ne branche
 * aucune écriture. Un bouton qui refermerait la feuille ferait CROIRE au membre que
 * sa demande est partie — et §2.2 ne permet qu'une demande en attente à la fois,
 * donc la suivante serait refusée sans qu'il comprenne pourquoi.
 */
export function ParrainEcran({ pseudo }: { readonly pseudo: string }) {
  const charger = useCallback(() => chargerH06(pseudo), [pseudo]);

  return (
    <EcranDonnees charger={charger}>
      {(donnees) => (
        <ScreenFrames
          screen="H06"
          desktop={<H06Desktop {...donnees} />}
          mobile={<H06Desktop {...donnees} />}
        />
      )}
    </EcranDonnees>
  );
}
