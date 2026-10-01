'use client';

import { EcranDonnees } from '@/screens/compte/ecran-donnees';
import { chargerH10 } from '@/screens/entraide/appels';
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
  return (
    <EcranDonnees charger={chargerH10}>
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
