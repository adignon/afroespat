'use client';

import { useCallback, useState } from 'react';
import { EcranDonnees } from '@/screens/compte/ecran-donnees';
import { ScreenFrames } from '@/screens/frames';
import { SQUELETTE_S09, chargerS09 } from '@/screens/services/appels';
import { useMesAnnonces } from '@/screens/services/use-mes-annonces';
import { S09Desktop } from '@/screens/s09/desktop.generated';
import { S09Mobile } from '@/screens/s09/mobile.generated';

/** S09 — mes annonces : renouveler, pause, trouvé, supprimer (avec confirmation). */
export function MesAnnoncesEcran() {
  const [version, setVersion] = useState(0);
  const charger = useCallback(() => chargerS09(), [version]);
  const recharger = useCallback(() => {
    setVersion((v) => v + 1);
  }, []);
  const { gestes, fenetres } = useMesAnnonces(recharger);
  return (
    <>
      <EcranDonnees
        charger={charger}
        attente="Chargement de vos annonces…"
        squelette={SQUELETTE_S09}
      >
        {(donnees) => (
          <ScreenFrames
            screen="S09"
            desktop={<S09Desktop {...donnees} gestes={gestes} />}
            mobile={<S09Mobile {...donnees} gestes={gestes} />}
          />
        )}
      </EcranDonnees>
      {fenetres}
    </>
  );
}
