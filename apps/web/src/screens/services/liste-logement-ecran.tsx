'use client';

import { useCallback } from 'react';
import { EcranDonnees } from '@/screens/compte/ecran-donnees';
import { ScreenFrames } from '@/screens/frames';
import { chargerS01, SQUELETTE_S01 } from '@/screens/services/appels';
import type { FiltreLogement } from '@/screens/services/navigation';
import { S01Desktop } from '@/screens/s01/desktop.generated';
import { S01Mobile } from '@/screens/s01/mobile.generated';

/** S01 — les annonces de logement, filtrées par `?kind=` (liens des puces de genre). */
export function ListeLogementEcran({ kind }: { readonly kind: FiltreLogement }) {
  const charger = useCallback(() => chargerS01(kind), [kind]);
  return (
    <EcranDonnees charger={charger} attente="Chargement des annonces…" squelette={SQUELETTE_S01}>
      {(donnees) => (
        <ScreenFrames screen="S01" desktop={<S01Desktop {...donnees} />} mobile={<S01Mobile {...donnees} />} />
      )}
    </EcranDonnees>
  );
}
