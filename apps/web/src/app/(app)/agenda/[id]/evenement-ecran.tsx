'use client';

import { useCallback, useState } from 'react';
import { SQUELETTE_E02, chargerE02 } from '@/screens/agenda/appels';
import { useActionsEvenement } from '@/screens/agenda/use-actions-evenement';
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
  // Un geste réussi relit la fiche : le compteur, la place dans la file et les
  // boutons viennent du serveur. `version` change l'identité de `charger`, ce qui
  // relance `useDonnees` SANS vider l'écran (l'ancienne fiche reste affichée).
  const [version, setVersion] = useState(0);
  const recharger = useCallback(() => {
    setVersion((n) => n + 1);
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `version` relance la lecture
  const charger = useCallback(() => chargerE02(id), [id, version]);
  const { actions, fenetres } = useActionsEvenement(id, recharger);

  return (
    <>
      <EcranDonnees
        /*
         * LE CADRE EST SERVI AVANT LA DONNEE : sans squelette, cette route repond 200
         * en servant « DisaporyPlus Chargement de l'agenda... » et rien d'autre — ni
         * rail, ni barre basse. Voir `screens/compte/ecran-donnees.tsx`.
         */
        squelette={SQUELETTE_E02}
        charger={charger}
      >
        {(donnees) => (
          <ScreenFrames
            screen="E02"
            desktop={<E02Desktop {...donnees} actions={actions} />}
            mobile={<E02Mobile {...donnees} actions={actions} />}
          />
        )}
      </EcranDonnees>
      {fenetres}
    </>
  );
}
