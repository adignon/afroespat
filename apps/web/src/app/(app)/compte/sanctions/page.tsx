'use client';

import { useCallback, useState } from 'react';
import { SQUELETTE_K09, chargerK09 } from '@/screens/compte/appels';
import { EcranDonnees } from '@/screens/compte/ecran-donnees';
import { ScreenFrames } from '@/screens/frames';
import { K09Desktop } from '@/screens/k09/desktop.generated';
import { K09Mobile } from '@/screens/k09/mobile.generated';

/**
 * K09 — « Sanctions » (`/compte/sanctions`, 13 §4).
 *
 * UNE CARTE PAR SANCTION, et la contestation s'ouvre DANS la carte : la planche
 * d'ordinateur dessinait la carte « CONTESTER · UNE SEULE FOIS » dans la page,
 * sans croix de fermeture — la signature d'une fenêtre dans cette maquette — donc
 * pas de fenêtre. Le cadre mobile n'en dessinait pas du tout : le même composant
 * (`SanctionsListe`, AJOUT) sert les deux largeurs.
 *
 * `active`, `appealable` ET `appeal` VIENNENT DU SERVEUR, et ne sont pas recalculés
 * ici (voir `chargerK09`). AUCUNE SANCTION est le cas normal, et la liste le dit.
 */
export default function SanctionsPage() {
  /** Recharger après un recours : la carte passe à « Recours en cours ». */
  const [recharge, setRecharge] = useState(0);
  const charger = useCallback(async () => {
    void recharge;
    return chargerK09();
  }, [recharge]);
  const recharger = useCallback(() => {
    setRecharge((n) => n + 1);
  }, []);

  return (
    <EcranDonnees
      /*
       * LE CADRE EST SERVI AVANT LA DONNEE : sans squelette, cette route repond 200
       * en servant cinq mots et aucune entree de rail. Voir
       * `screens/compte/ecran-donnees.tsx`.
       */
      squelette={SQUELETTE_K09} charger={charger}>
      {(donnees) => (
        <ScreenFrames
          screen="K09"
          desktop={<K09Desktop {...donnees} onRecharger={recharger} />}
          mobile={<K09Mobile {...donnees} onRecharger={recharger} />}
        />
      )}
    </EcranDonnees>
  );
}
