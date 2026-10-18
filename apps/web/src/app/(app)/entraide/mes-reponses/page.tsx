'use client';

import { useChargeur } from '@/lib/entraide-recharge';
import { EcranDonnees } from '@/screens/compte/ecran-donnees';
import { SQUELETTE_H10, chargerH10 } from '@/screens/entraide/appels';
import { ScreenFrames } from '@/screens/frames';
import { H10Desktop } from '@/screens/h10/desktop.generated';
import { H10Mobile } from '@/screens/h10/mobile.generated';

/**
 * H10 — Mes réponses (`/entraide/mes-reponses`, 06 §5).
 *
 * Transcodé de `docs/template/05 Entraide.dc.html`. Voir `/entraide/page.tsx` pour
 * le procédé et la raison pour laquelle ces écrans sont des composants CLIENT.
 *
 * ÉCART REMONTÉ : `GET /help/my-responses` n'a PAS de `meta.count`, contrairement à
 * `GET /me/connections` qui porte le sien. Les deux nombres du sous-titre sont donc
 * comptés sur la page rendue, et ils seront FAUX au-delà de cinquante réponses. On ne
 * masque pas l'écart derrière une pagination muette.
 */
export default function MyHelpResponsesPage() {
  const charger = useChargeur(chargerH10);
  return (
    <EcranDonnees
      charger={charger}
      /*
       * LE CADRE EST SERVI AVANT LA DONNÉE, et c'est MESURÉ : cette route
       * répondait 200 avec cinq mots — « DisaporyPlus Chargement de votre
       * compte… » — et aucune entrée de rail dans le HTML servi. Voir
       * `screens/compte/ecran-donnees.tsx` pour le raisonnement complet.
       */
      squelette={SQUELETTE_H10}
    >
      {(donnees) => (
        <ScreenFrames
          screen="H10"
          desktop={<H10Desktop {...donnees} />}
          mobile={<H10Mobile {...donnees} />}
        />
      )}
    </EcranDonnees>
  );
}
