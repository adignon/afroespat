'use client';

import { useCallback } from 'react';
import { EcranDonnees } from '@/screens/compte/ecran-donnees';
import { ScreenFrames } from '@/screens/frames';
import { SQUELETTE_S06, chargerS06 } from '@/screens/services/appels';
import { S06Desktop } from '@/screens/s06/desktop.generated';
import { S06Mobile } from '@/screens/s06/mobile.generated';

/** S06 — l'annuaire professionnel, recherché par `?q=`. */
export function AnnuaireEcran({ recherche }: { readonly recherche: string }) {
  const charger = useCallback(() => chargerS06(recherche), [recherche]);
  return (
    <EcranDonnees charger={charger} attente="Chargement de l’annuaire…" squelette={SQUELETTE_S06}>
      {(donnees) => (
        <ScreenFrames screen="S06" desktop={<S06Desktop {...donnees} />} mobile={<S06Mobile {...donnees} />} />
      )}
    </EcranDonnees>
  );
}
