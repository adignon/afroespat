'use client';

import { useCallback } from 'react';
import { chargerE02 } from '@/screens/agenda/appels';
import { EcranDonnees } from '@/screens/compte/ecran-donnees';
import { ScreenFrames } from '@/screens/frames';
import { E02Desktop } from '@/screens/e02/desktop.generated';
import { E02Mobile } from '@/screens/e02/mobile.generated';

/**
 * E02 — la fiche d'un événement (`/agenda/:id`, 09 §3.2), côté client.
 *
 * `charger` est mémoïsé sur l'identifiant de la route : même motif que K02, et
 * même raison — `useDonnees` dépend de `charger`.
 */
export function EvenementEcran({ id }: { readonly id: string }) {
  const charger = useCallback(() => chargerE02(id), [id]);

  return (
    <EcranDonnees charger={charger}>
      {(donnees) => (
        <ScreenFrames
          screen="E02"
          desktop={<E02Desktop {...donnees} />}
          mobile={<E02Mobile {...donnees} />}
        />
      )}
    </EcranDonnees>
  );
}
