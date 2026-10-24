'use client';

import { useCallback } from 'react';
import { EcranDonnees } from '@/screens/compte/ecran-donnees';
import { ScreenFrames } from '@/screens/frames';
import { SQUELETTE_S06, chargerS06 } from '@/screens/services/appels';
import { S06Desktop } from '@/screens/s06/desktop.generated';
import { S06Mobile } from '@/screens/s06/mobile.generated';

/** S06 — l'annuaire professionnel, recherché par `?q=` et filtré par `?ville=` et `?metier=`. */
export function AnnuaireEcran({
  recherche,
  ville,
  metier,
  plus,
}: {
  readonly recherche: string;
  readonly ville: string;
  /** `?metier=` : l'identifiant du métier filtré, ou `''`. */
  readonly metier: string;
  /** `?plus=1` : toutes les pastilles de métier, et non les premières. */
  readonly plus: boolean;
}) {
  const charger = useCallback(() => chargerS06(recherche, ville, metier, plus), [recherche, ville, metier, plus]);
  return (
    <EcranDonnees charger={charger} attente="Chargement de l’annuaire…" squelette={SQUELETTE_S06}>
      {(donnees) => (
        <ScreenFrames screen="S06" desktop={<S06Desktop {...donnees} />} mobile={<S06Mobile {...donnees} />} />
      )}
    </EcranDonnees>
  );
}
