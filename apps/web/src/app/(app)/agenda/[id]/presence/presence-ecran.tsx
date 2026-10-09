'use client';

import { useCallback } from 'react';
import { SQUELETTE_E04, chargerE04 } from '@/screens/agenda/appels';
import { EcranDonnees } from '@/screens/compte/ecran-donnees';
import { ScreenFrames } from '@/screens/frames';
import { E04Desktop } from '@/screens/e04/desktop.generated';
import { E04Mobile } from '@/screens/e04/mobile.generated';

/**
 * E04 — la feuille de présence (`/agenda/:id/presence`, 09 §3.3), côté client.
 */
export function PresenceEcran({ id }: { readonly id: string }) {
  const charger = useCallback(() => chargerE04(id), [id]);

  return (
    <EcranDonnees
      /*
       * LE CADRE EST SERVI AVANT LA DONNEE : sans squelette, cette route repond 200
       * en servant « DisaporyPlus Chargement de l'agenda... » et rien d'autre — ni
       * rail, ni barre basse. Voir `screens/compte/ecran-donnees.tsx`.
       */
      squelette={SQUELETTE_E04} charger={charger}>
      {(donnees) => (
        <ScreenFrames
          screen="E04"
          desktop={<E04Desktop {...donnees} />}
          mobile={<E04Mobile {...donnees} />}
        />
      )}
    </EcranDonnees>
  );
}
