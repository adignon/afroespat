'use client';

import { useCallback } from 'react';
import { useParams } from 'next/navigation';
import { chargerJ10 } from '@/screens/parcours/appels';
import { EcranParcoursDonnees } from '@/screens/parcours/ecran-donnees';
import { J10Desktop } from '@/screens/j10/desktop.generated';
import { J10Mobile } from '@/screens/j10/mobile.generated';

/**
 * J10 — la fin de parcours. `/parcours/:id/abouti`, « plein écran calme ».
 *
 * BRANCHÉ SUR `GET /journeys/:id` : le titre du parcours, son type, sa durée totale
 * (entre la première étape commencée et `journey.completedAt`) et son compte
 * d'étapes franchies sur étapes comptées.
 *
 * « 9 AIDES REÇUES » N'EST PAS LIÉ, et c'est un manque de l'API, pas un
 * renoncement : aucune route de parcours ne compte les aides reçues.
 * `GET /journeys/:id/activities` porte bien un type `HELP_RECEIVED`, mais le
 * journal est paginé et son total n'est pas rendu — compter les entrées du premier
 * lot donnerait un nombre qui change avec la taille de la page. Le chiffre reste
 * donc celui de la maquette. Signalé au porteur.
 *
 * §3.9 : « écran de félicitations, puis les trois propositions : devenir parrain
 * (si L2), écrire un guide à partir de l'étape la plus longue, organiser un
 * événement ». La maquette dessine les trois, et cette planche n'a ni rail ni
 * panneau — c'est la seule du module dans ce cas, et le générateur y pose donc
 * lui-même le repère `main`.
 *
 * Aucune fenêtre ne s'ouvre d'ici : la carte du panneau, et donc son bouton « Je
 * suis bloqué·e », n'existe pas sur cette planche. Un parcours abouti n'a plus
 * d'étape où l'on bute.
 */
export default function Page() {
  const params = useParams<{ id?: string }>();
  const journeyId = typeof params.id === 'string' ? params.id : '';
  const charger = useCallback(() => chargerJ10(journeyId), [journeyId]);

  return (
    <EcranParcoursDonnees
      screen="J10"
      charger={charger}
      desktop={(d) => <J10Desktop {...d} />}
      mobile={(d) => <J10Mobile {...d} />}
    />
  );
}
