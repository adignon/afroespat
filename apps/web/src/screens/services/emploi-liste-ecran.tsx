'use client';

import { EcranDonnees } from '@/screens/compte/ecran-donnees';
import { ScreenFrames } from '@/screens/frames';
import { SQUELETTE_S04, chargerS04 } from '@/screens/services/appels';
import { useContacterMembre } from '@/screens/services/use-contacter-membre';
import { S04Desktop } from '@/screens/s04/desktop.generated';
import { S04Mobile } from '@/screens/s04/mobile.generated';
import type { OngletEmploi } from '@/screens/s04/data';

/**
 * S04 — offres d'emploi, profils disponibles et profil de recherche du membre ; l'onglet
 * vient de l'adresse (`?onglet=`), « Contacter » écrit au membre.
 */
export function EmploiListeEcran({ onglet }: { readonly onglet: OngletEmploi }) {
  const { vivant, fenetre } = useContacterMembre();
  return (
    <>
      <EcranDonnees
        charger={chargerS04}
        attente="Chargement des offres…"
        squelette={SQUELETTE_S04}
      >
        {(donnees) => (
          <ScreenFrames
            screen="S04"
            desktop={<S04Desktop {...donnees} onglet={onglet} vivant={vivant} />}
            mobile={<S04Mobile {...donnees} onglet={onglet} vivant={vivant} />}
          />
        )}
      </EcranDonnees>
      {fenetre}
    </>
  );
}
