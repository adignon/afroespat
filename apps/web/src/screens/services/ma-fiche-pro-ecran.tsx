'use client';

import { EcranDonnees } from '@/screens/compte/ecran-donnees';
import { ScreenFrames } from '@/screens/frames';
import { SQUELETTE_S08, chargerS08 } from '@/screens/services/appels';
import { useMaFichePro } from '@/screens/services/use-ma-fiche-pro';
import { S08Desktop } from '@/screens/s08/desktop.generated';
import { S08Mobile } from '@/screens/s08/mobile.generated';

/**
 * S08 — créer ma fiche pro (10 §4.1) : `GET/PUT /me/pro-profile`, justificatif déposé
 * par `/media`. La fiche attend une validation humaine ; le téléphone n'est jamais demandé.
 */
export function MaFicheProEcran() {
  const { formulaire, fenetre } = useMaFichePro();
  return (
    <>
      <EcranDonnees
        charger={chargerS08}
        attente="Chargement de votre fiche…"
        squelette={SQUELETTE_S08}
      >
        {(donnees) => (
          <ScreenFrames
            screen="S08"
            desktop={<S08Desktop {...donnees} formulaire={formulaire} />}
            mobile={<S08Mobile {...donnees} formulaire={formulaire} />}
          />
        )}
      </EcranDonnees>
      {fenetre}
    </>
  );
}
