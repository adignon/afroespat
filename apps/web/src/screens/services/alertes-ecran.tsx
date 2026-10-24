'use client';

import { useCallback, useState } from 'react';
import { EcranDonnees } from '@/screens/compte/ecran-donnees';
import { ScreenFrames } from '@/screens/frames';
import { SQUELETTE_S10, chargerS10 } from '@/screens/services/appels';
import { useAlertes } from '@/screens/services/use-alertes';
import { S10Desktop } from '@/screens/s10/desktop.generated';
import { S10Mobile } from '@/screens/s10/mobile.generated';

/** S10 — mes alertes : enregistrer, activer / mettre en pause, supprimer (10 §2.4). */
export function AlertesEcran() {
  const [version, setVersion] = useState(0);
  const charger = useCallback(() => chargerS10(), [version]); // eslint-disable-line react-hooks/exhaustive-deps -- `version` relance la lecture
  const recharger = useCallback(() => {
    setVersion((v) => v + 1);
  }, []);
  const { formulaire, gestes, fenetres } = useAlertes(recharger);
  return (
    <>
      <EcranDonnees
        charger={charger}
        attente="Chargement de vos alertes…"
        squelette={SQUELETTE_S10}
      >
        {(donnees) => (
          <ScreenFrames
            screen="S10"
            desktop={<S10Desktop {...donnees} formulaire={formulaire} gestes={gestes} />}
            mobile={<S10Mobile {...donnees} formulaire={formulaire} gestes={gestes} />}
          />
        )}
      </EcranDonnees>
      {fenetres}
    </>
  );
}
