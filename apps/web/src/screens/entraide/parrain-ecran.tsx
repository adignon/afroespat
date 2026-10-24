'use client';

import { useCallback } from 'react';
import { ParrainFicheMobile } from '@/components/entraide/parrain-fiche-mobile';
import { EcranDonnees } from '@/screens/compte/ecran-donnees';
import { SQUELETTE_H06, chargerH06 } from '@/screens/entraide/appels';
import { ScreenFrames } from '@/screens/frames';
import { H06Desktop } from '@/screens/h06/desktop.generated';

/**
 * H06 — la fiche d'un parrain, chargée depuis `GET /mentors/:handle`.
 *
 * DEUX CADRES, DONT LE MOBILE EST UN AJOUT : la maquette ne dessine PAS cette fiche
 * sur téléphone (sa planche « MOBILE » montre la feuille de demande sur un voile).
 * Servir le cadre d'ordinateur à 390 px débordait de 10 px (400 px mesurés). Le
 * cadre téléphone est donc composé dans `components/entraide/parrain-fiche-mobile.tsx`
 * avec les mêmes briques et les mêmes données que le bureau.
 *
 * `charger` est un `useCallback` mémoïsé sur le pseudo : voir `demande-ecran.tsx`
 * pour la raison, qui est la même.
 *
 * « Demander comme parrain » ouvre la feuille de demande (`BoutonDemander`), sur
 * les deux cadres : un message de cinquante caractères minimum, validé par le serveur.
 */
export function ParrainEcran({ pseudo }: { readonly pseudo: string }) {
  const charger = useCallback(() => chargerH06(pseudo), [pseudo]);

  return (
    <EcranDonnees
      /*
       * LE CADRE EST SERVI AVANT LA DONNEE : sans squelette, cette route repond 200
       * en servant « DisaporyPlus Chargement de votre compte... » et rien d'autre.
       * Voir `screens/compte/ecran-donnees.tsx`.
       */
      squelette={SQUELETTE_H06} charger={charger}>
      {(donnees) => (
        <ScreenFrames
          screen="H06"
          desktop={<H06Desktop {...donnees} />}
          mobile={<ParrainFicheMobile {...donnees} />}
        />
      )}
    </EcranDonnees>
  );
}
