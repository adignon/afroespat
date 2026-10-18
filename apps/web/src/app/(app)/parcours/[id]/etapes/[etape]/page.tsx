'use client';

import { useCallback } from 'react';
import { useParams } from 'next/navigation';
import { VUE_NEUTRE, chargerJ01S } from '@/screens/parcours/appels';
import { EcranParcoursDonnees } from '@/screens/parcours/ecran-donnees';
import { useContexteParcours } from '@/screens/parcours/use-parcours-api';
import { J01SDesktop } from '@/screens/j01s/desktop.generated';
import { J01SMobile } from '@/screens/j01s/mobile.generated';

/**
 * J01S — l'étape en cours. `/parcours/:id/etapes/:etape`, comme la maquette
 * l'écrit sous sa planche.
 *
 * ── LE SEGMENT D'ÉTAPE N'EST PAS UN RANG ───────────────────────────────────
 *
 * `/parcours/1/etapes/7` est une URL LÉGITIME de ce dépôt : c'est celle que les
 * tests de planche emploient, parce que la maquette ne dessine qu'un parcours et
 * qu'inventer des identifiants serait inventer de la donnée. « 7 » n'est donc PAS
 * le rang d'une ligne de base, et le prendre pour un identifiant ferait partir
 * `GET /journeys/1`, que le serveur refuse en `400 VALIDATION_FAILED` — le membre
 * verrait une bannière d'erreur pour avoir ouvert une planche de démonstration.
 *
 * `useContexteParcours` EXIGE donc la forme d'un UUID pour le parcours, et ce
 * chargeur fait de même pour l'étape : un segment qui n'en est pas un veut dire
 * « planche d'illustration », et on demande au serveur l'étape EN COURS plutôt que
 * de lire un rang. L'écran reste alors inerte côté gestes, ce qui est exactement ce
 * qu'on veut d'une illustration.
 *
 * ── DEUX FENÊTRES S'OUVRENT D'ICI ──────────────────────────────────────────
 *
 *   · « Je suis bloqué·e » → J03, §3.5. Le bouton est dessiné deux fois sur
 *     ordinateur — carte du panneau et carte de l'étape — et les deux ouvrent la
 *     même feuille, sur la même étape ;
 *   · « Marquer comme franchie » (mobile : « Franchie ») → J04, §3.6 : « à
 *     `step_completed` … proposition de partage » sur une étape majeure. Ce n'est
 *     PAS une publication : la proposition s'ouvre, le champ est vide, et rien ne
 *     part sans un appel explicite (§3.5, règle dure).
 *
 * LE FRANCHISSEMENT LUI-MÊME — `PATCH /journeys/:id/steps/:stepId` — n'est toujours
 * pas appelé : le générateur ne pose aucun `onClick` sur « Marquer comme franchie »
 * au-delà de l'ouverture de la fenêtre. L'écran LIT son étape ; il ne la change
 * pas. Signalé.
 */

/** Un identifiant de la base : UUID, y compris les UUIDv7 que ce projet émet. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function Page() {
  const params = useParams<{ id?: string; etape?: string }>();
  const journeyId = typeof params.id === 'string' ? params.id : '';
  const etapeId =
    typeof params.etape === 'string' && UUID.test(params.etape) ? params.etape : undefined;
  const contexte = useContexteParcours();
  const charger = useCallback(() => chargerJ01S(journeyId, etapeId), [journeyId, etapeId]);

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
      screen="J01S"
      charger={charger}
      contexte={contexte}
      desktop={(d) => <J01SDesktop {...d} />}
      mobile={(d) => <J01SMobile {...d} />}
    />
  );
}
