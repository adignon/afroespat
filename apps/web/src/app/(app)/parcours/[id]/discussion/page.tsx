'use client';

import { useCallback } from 'react';
import { useParams } from 'next/navigation';
import { VUE_NEUTRE, chargerJ01D } from '@/screens/parcours/appels';
import { EcranParcoursDonnees } from '@/screens/parcours/ecran-donnees';
import { useContexteParcours } from '@/screens/parcours/use-parcours-api';
import { plancheBlocage } from '@/screens/parcours/modales';
import { J01DDesktop } from '@/screens/j01d/desktop.generated';
import { J01DMobile } from '@/screens/j01d/mobile.generated';

/**
 * J01D — la discussion du parcours. `/parcours/:id/discussion`.
 *
 * BRANCHÉ SUR `GET /journeys/:id` POUR SON CADRE, ET PAS POUR SES MESSAGES.
 *
 * La conversation de groupe appartient à la MESSAGERIE :
 * `journey.groupConversationId` en donne l'identifiant, et les messages se lisent
 * sur les routes de `conversations`, hors de ce périmètre. Les bulles de la planche
 * restent donc celles de la maquette — c'est dit, plutôt que masqué par un écran
 * qui aurait l'air branché.
 *
 * §3.4 : la discussion n'est PAS offerte à un observateur — « OBSERVER : voir les
 * étapes et leur état, la progression ; ne peut pas commenter, voir les notes, la
 * checklist, la discussion ». Le serveur le tient à la source :
 * `groupConversationId` vaut `null` pour un observateur, mesuré dans le service.
 * Ce n'est pas « pas de discussion », c'est « pas pour vous », et un écran qui
 * confondrait les deux afficherait un fil vide au lieu de masquer l'entrée.
 */
export default function Page() {
  const params = useParams<{ id?: string }>();
  const journeyId = typeof params.id === 'string' ? params.id : '';
  const contexte = useContexteParcours();
  const charger = useCallback(() => chargerJ01D(journeyId), [journeyId]);

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
      screen="J01D"
      charger={charger}
      contexte={contexte}
      desktop={(d) => <J01DDesktop {...d} />}
      mobile={(d) => <J01DMobile {...d} />}
      modales={(d, volet) => ({ J03: plancheBlocage(volet, d) })}
    />
  );
}
