'use client';

import { useCallback } from 'react';
import { useParams } from 'next/navigation';
import { VUE_NEUTRE, chargerJ07 } from '@/screens/parcours/appels';
import { EcranParcoursDonnees } from '@/screens/parcours/ecran-donnees';
import { useContexteParcours } from '@/screens/parcours/use-parcours-api';
import { J07Desktop } from '@/screens/j07/desktop.generated';
import { J07Mobile } from '@/screens/j07/mobile.generated';

/**
 * J07 — l'historique du parcours. `/parcours/:id/historique` (§3.8).
 *
 * BRANCHÉ SUR `GET /journeys/:id/activities` — LA SEULE LISTE DE CE MODULE QUI SOIT
 * PAGINÉE PAR CURSEUR. `GET /journeys` et `GET /journey-templates` rendent des
 * listes bornées et n'ont PAS de `nextCursor` ; le journal l'a, et l'accepter
 * facultatif ferait prendre une pagination muette pour une fin d'historique.
 *
 * RÉSERVÉE AU PROPRIÉTAIRE (§3.4) : le journal porte les blocages, les notes et les
 * motifs, et les accompagnants n'ont droit qu'aux étapes et à la progression. Un
 * accompagnant qui ouvre cette URL reçoit un `404` — MESURÉ au navigateur, et non
 * le `403` qu'on attendrait : `assertOwned` lève `notFound()`, donc le serveur ne
 * confirme pas même l'existence du journal. L'écran affiche le refus plutôt qu'un
 * journal vide, ce qui est la différence entre « pas pour vous » et « rien ».
 *
 * LA SUITE DU JOURNAL N'EST PAS CHARGÉE : la maquette ne dessine ni bouton « Voir
 * plus » ni défilement infini, et le premier lot de vingt entrées suffit à ce
 * qu'elle montre. `nextCursor` est validé et ignoré. Signalé.
 *
 * L'EXPORT PDF est réservé à Premium (T5 J07) et la feuille ne lit RIEN : ses trois
 * phrases sont des règles, vraies pour tout le monde.
 */
export default function Page() {
  const params = useParams<{ id?: string }>();
  const journeyId = typeof params.id === 'string' ? params.id : '';
  const contexte = useContexteParcours();
  const charger = useCallback(() => chargerJ07(journeyId), [journeyId]);

  return (
    <EcranParcoursDonnees
      /*
       * LE CADRE EST SERVI AVANT LA DONNEE. `VUE_NEUTRE` est le DESSIN sans la
       * donnee, et il existait deja pour les planches d'illustration : rien n'est
       * invente ici. Sans lui, cette route repond 200 en servant « DisaporyPlus
       * Chargement de votre parcours... » et RIEN d'autre — ni rail, ni panneau,
       * ni barre basse. Voir `screens/compte/ecran-donnees.tsx`.
       */
      squelette={VUE_NEUTRE}
      screen="J07"
      charger={charger}
      contexte={contexte}
      desktop={(d) => <J07Desktop {...d} />}
      mobile={(d) => <J07Mobile {...d} />}
    />
  );
}
