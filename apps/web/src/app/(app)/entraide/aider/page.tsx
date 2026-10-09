'use client';

import { EcranDonnees } from '@/screens/compte/ecran-donnees';
import { SQUELETTE_H04, chargerH04 } from '@/screens/entraide/appels';
import { ScreenFrames } from '@/screens/frames';
import { H04Desktop } from '@/screens/h04/desktop.generated';
import { H04Mobile } from '@/screens/h04/mobile.generated';

/**
 * H04 — « Vous pouvez aider » (`/entraide/aider`, 06 §5).
 *
 * Transcodé de `docs/template/05 Entraide.dc.html`. Voir `/entraide/page.tsx` pour
 * le procédé et la raison pour laquelle ces écrans sont des composants CLIENT.
 *
 * Le sous-titre compte les suggestions de `GET /help/can-help` (§2.6) — le même
 * nombre que la pastille du rail : UNE donnée, deux endroits.
 *
 * LA LISTE DE CARTES N'EST PAS LIÉE, et la raison est écrite dans
 * `screens/entraide/data.ts` : les deux cartes de cette planche portent chacune une
 * pastille de motif différente (« Vous avez franchi l'étape Logement » contre
 * « Correspond à vos types d'aide »), que l'API ne renvoie pas. `GET /help/can-help`
 * dit QUELLES demandes correspondent, jamais POURQUOI chacune correspond. Écart
 * remonté.
 */
export default function HelpCanHelpPage() {
  return (
    <EcranDonnees
      charger={chargerH04}
      /*
       * LE CADRE EST SERVI AVANT LA DONNÉE, et c'est MESURÉ : cette route
       * répondait 200 avec cinq mots — « DisaporyPlus Chargement de votre
       * compte… » — et aucune entrée de rail dans le HTML servi. Voir
       * `screens/compte/ecran-donnees.tsx` pour le raisonnement complet.
       */
      squelette={SQUELETTE_H04}
    >
      {(donnees) => (
        <ScreenFrames
          screen="H04"
          desktop={<H04Desktop {...donnees} />}
          mobile={<H04Mobile {...donnees} />}
        />
      )}
    </EcranDonnees>
  );
}
