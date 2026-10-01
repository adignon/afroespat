'use client';

import { EcranDonnees } from '@/screens/compte/ecran-donnees';
import { chargerH09 } from '@/screens/entraide/appels';
import { ScreenFrames } from '@/screens/frames';
import { H09Desktop } from '@/screens/h09/desktop.generated';
import { H09Mobile } from '@/screens/h09/mobile.generated';

/**
 * H09 — Mes demandes (`/entraide/mes-demandes`, 06 §5).
 *
 * Transcodé de `docs/template/05 Entraide.dc.html`. Voir `/entraide/page.tsx` pour
 * le procédé et la raison pour laquelle ces écrans sont des composants CLIENT.
 *
 * LE TITRE DIFFÈRE ENTRE LES DEUX CADRES, et c'est la maquette : « Mes demandes »
 * sur ordinateur, « Fil d'entraide » sur mobile — où « Mes demandes » devient une
 * pastille sous un en-tête commun. Un titre déduit aurait gommé l'écart.
 *
 * ÉCART REMONTÉ : « 1 avec de nouvelles réponses » demande de savoir ce qui est NEUF
 * depuis la dernière visite, et aucun champ de `GET /help/mine` ne le dit. Le nombre
 * affiché est celui des demandes QUI ONT des réponses — une donnée réelle de la
 * route — et non une heuristique de fraîcheur inventée ici.
 */
export default function MyHelpRequestsPage() {
  return (
    <EcranDonnees charger={chargerH09}>
      {(donnees) => (
        <ScreenFrames
          screen="H09"
          desktop={<H09Desktop {...donnees} />}
          mobile={<H09Mobile {...donnees} />}
        />
      )}
    </EcranDonnees>
  );
}
