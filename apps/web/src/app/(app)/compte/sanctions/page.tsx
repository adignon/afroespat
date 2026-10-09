'use client';

import { useCallback, useState } from 'react';
import { SanctionsVivantes } from '@/screens/compte/sanctions-vivantes';
import { SQUELETTE_K09, chargerK09 } from '@/screens/compte/appels';
import { EcranDonnees } from '@/screens/compte/ecran-donnees';
import { ScreenFrames } from '@/screens/frames';
import { K09Desktop } from '@/screens/k09/desktop.generated';
import { K09Mobile } from '@/screens/k09/mobile.generated';

/**
 * K09 — « Sanctions » (`/compte/sanctions`, 13 §4).
 *
 * LA CONTESTATION N'EST PAS UNE FENÊTRE, et c'est la maquette qui le décide : la
 * planche d'ordinateur dessine la carte « CONTESTER · UNE SEULE FOIS » DANS la
 * page, avec son champ et son bouton, et ne lui donne aucune croix de fermeture —
 * la signature d'une fenêtre dans cette maquette. Le cadre mobile n'en dessine pas
 * du tout. On n'ouvre donc pas une fenêtre par-dessus une carte qui dit déjà la
 * même chose.
 *
 * `active` ET `appealable` VIENNENT DU SERVEUR, et ne sont pas recalculés ici.
 * Comparer `endsAt` à l'horloge du navigateur afficherait « suspendu » à un membre
 * libre dès que sa machine est décalée ; et « contester une fois » (13 §4.3)
 * demande de savoir si une contestation a déjà été déposée, ce que seul le serveur
 * sait. Le bouton reste inerte : ce lot ne poste aucune contestation.
 *
 * AUCUNE SANCTION EST LE CAS NORMAL, et la carte le dit alors — un écran vide
 * serait plus inquiétant qu'informatif pour quelqu'un qui vient vérifier qu'il n'a
 * rien.
 */
export default function SanctionsPage() {
  /** Recharger après une contestation : voir la page Sécurité pour le pourquoi. */
  const [recharge, setRecharge] = useState(0);
  const [sanctionId, setSanctionId] = useState<string | null>(null);
  const charger = useCallback(async () => {
    void recharge;
    const d = await chargerK09();
    setSanctionId(d.sanctionId ?? null);
    return d;
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
        <SanctionsVivantes donnees={donnees} sanctionId={sanctionId} onRecharger={recharger}>
          {(vivantes) => (
            <ScreenFrames
          screen="K09"
          desktop={<K09Desktop {...vivantes} />}
          mobile={<K09Mobile {...vivantes} />}
        />
          )}
        </SanctionsVivantes>
      )}
    </EcranDonnees>
  );
}
