'use client';

import { useCallback } from 'react';
import { chargerE01, SQUELETTE_E01 } from '@/screens/agenda/appels';
import { EcranDonnees } from '@/screens/compte/ecran-donnees';
import { ScreenFrames } from '@/screens/frames';
import { E01Desktop } from '@/screens/e01/desktop.generated';
import { E01Mobile } from '@/screens/e01/mobile.generated';

/**
 * E01 — l'agenda (`/agenda`, 09 §3.5), côté client.
 *
 * `?jour=2026-10-02` sélectionne un jour ; sans paramètre, c'est §3.5 qui décide
 * (« aujourd'hui, ou le prochain jour avec événement »), et la décision est prise
 * sur la réponse du serveur, dans `appels.ts`.
 *
 * LA FONCTION PASSÉE À `charger` EST MÉMOÏSÉE, et il faut qu'elle le soit :
 * `useDonnees` a `charger` dans ses dépendances — c'est écrit et justifié dans
 * `ecran-donnees.tsx` — donc une fonction anonyme rechargerait en boucle. Le
 * `useCallback` dépend du seul paramètre qui change l'appel.
 */
export function AgendaEcran({ jour }: { readonly jour: string | null }) {
  const charger = useCallback(() => chargerE01(jour), [jour]);

  return (
    <EcranDonnees
      charger={charger}
      attente="Chargement de l’agenda…"
      /*
       * LE CADRE EST SERVI AVANT LA DONNÉE, et c'est mesuré : sans cela, `/agenda`
       * répondait 200 sans rail et sans barre basse. Voir `SQUELETTE_E01`.
       */
      squelette={SQUELETTE_E01}
    >
      {(donnees) => (
        <ScreenFrames
          screen="E01"
          desktop={<E01Desktop {...donnees} />}
          mobile={<E01Mobile {...donnees} />}
        />
      )}
    </EcranDonnees>
  );
}
