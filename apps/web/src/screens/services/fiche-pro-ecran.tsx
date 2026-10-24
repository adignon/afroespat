'use client';

import { useCallback, useState } from 'react';
import { EcranDonnees } from '@/screens/compte/ecran-donnees';
import { ScreenFrames } from '@/screens/frames';
import { SQUELETTE_S07, chargerS07 } from '@/screens/services/appels';
import { useFichePro } from '@/screens/services/use-fiche-pro';
import type { S07Charge } from '@/screens/s07/data';
import { S07Desktop } from '@/screens/s07/desktop.generated';
import { S07Mobile } from '@/screens/s07/mobile.generated';

/**
 * S07 — une fiche pro (10 §4.2). « Contacter » ouvre la conversation (`POST
 * /pros/:id/contact`, quota du mois tenu par le serveur), « Recommander » et
 * « Signaler » ont leur fenêtre.
 */
export function FicheProEcran({ id }: { readonly id: string }) {
  const [version, setVersion] = useState(0);
  const charger = useCallback(() => chargerS07(id), [id, version]);
  const recharger = useCallback(() => {
    setVersion((v) => v + 1);
  }, []);

  return (
    <EcranDonnees squelette={SQUELETTE_S07} charger={charger} attente="Chargement de la fiche…">
      {(donnees) => <FicheVivante id={id} donnees={donnees} recharger={recharger} />}
    </EcranDonnees>
  );
}

function FicheVivante({
  id,
  donnees,
  recharger,
}: {
  readonly id: string;
  readonly donnees: S07Charge;
  readonly recharger: () => void;
}) {
  const { vivant, fenetres } = useFichePro(id, recharger);
  const avec = { ...donnees, vivant };
  return (
    <>
      <ScreenFrames screen="S07" desktop={<S07Desktop {...avec} />} mobile={<S07Mobile {...avec} />} />
      {fenetres}
    </>
  );
}
