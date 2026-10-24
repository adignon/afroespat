'use client';

import { useCallback, useState } from 'react';
import { SQUELETTE_E04, chargerE04 } from '@/screens/agenda/appels';
import type { E04Data } from '@/screens/agenda/data';
import { usePresence } from '@/screens/agenda/use-presence';
import { EcranDonnees } from '@/screens/compte/ecran-donnees';
import { ScreenFrames } from '@/screens/frames';
import { E04Desktop } from '@/screens/e04/desktop.generated';
import { E04Mobile } from '@/screens/e04/mobile.generated';

/**
 * E04 — la feuille de présence (`/agenda/:id/presence`, 09 §3.3), côté client.
 */
export function PresenceEcran({ id }: { readonly id: string }) {
  const [version, setVersion] = useState(0);
  const recharger = useCallback(() => {
    setVersion((n) => n + 1);
  }, []);
  const charger = useCallback(() => chargerE04(id), [id, version]);

  return (
    <EcranDonnees
      /*
       * LE CADRE EST SERVI AVANT LA DONNEE : sans squelette, cette route repond 200
       * en servant « DisaporyPlus Chargement de l'agenda... » et rien d'autre — ni
       * rail, ni barre basse. Voir `screens/compte/ecran-donnees.tsx`.
       */
      squelette={SQUELETTE_E04}
      charger={charger}
    >
      {(donnees) => <FeuillePresence id={id} donnees={donnees} recharger={recharger} />}
    </EcranDonnees>
  );
}

/** Les cases et l'enregistrement : un crochet, donc un composant (pas dans le rendu-prop). */
function FeuillePresence({
  id,
  donnees,
  recharger,
}: {
  readonly id: string;
  readonly donnees: E04Data;
  readonly recharger: () => void;
}) {
  const { presence, fenetre } = usePresence(id, donnees.presence, recharger);
  return (
    <>
      <ScreenFrames
        screen="E04"
        desktop={<E04Desktop {...donnees} presence={presence} />}
        mobile={<E04Mobile {...donnees} presence={presence} />}
      />
      {fenetre}
    </>
  );
}
