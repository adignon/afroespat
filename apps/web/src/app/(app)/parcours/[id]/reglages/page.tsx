'use client';

import { useCallback } from 'react';
import { useParams } from 'next/navigation';
import { VUE_NEUTRE, chargerJ08 } from '@/screens/parcours/appels';
import { EcranParcoursDonnees } from '@/screens/parcours/ecran-donnees';
import { useContexteParcours } from '@/screens/parcours/use-parcours-api';
import { J08Desktop } from '@/screens/j08/desktop.generated';
import { J08Mobile } from '@/screens/j08/mobile.generated';

/**
 * J08 — les réglages du parcours. `/parcours/:id/reglages`.
 *
 * BRANCHÉ EN LECTURE SUR `GET /journeys/:id` : le nom, la date cible, la version du
 * modèle (§2.4) et le nombre d'étapes franchies que l'arrêt conserve.
 *
 * L'ÉCRITURE N'EST PAS CÂBLÉE, et ce n'est pas un oubli. `PATCH /journeys/:id` est
 * la route qui change le titre, la date, la mise en pause et la VISIBILITÉ (§3.7,
 * avec l'adresse IP comme preuve de consentement `JOURNEY_VISIBILITY`). Le
 * générateur ne reconnaît ni « Mettre à jour », ni « Mettre en pause », ni
 * « Arrêter », donc aucun `onClick` n'est posé sur ces boutons : aucune suite de
 * clics ne change la visibilité d'un parcours ni ne l'arrête. « Arrêter » est
 * irréversible (§3.9) et un bouton qui mentirait là serait pire que l'inertie.
 * Signalé.
 *
 * §3.7 : la visibilité en TROIS choix, avec « l'explication exacte de ce qui est
 * visible et invisible en public ». La maquette écrit cette phrase, et elle est
 * transcodée telle quelle : « Ils verront vos étapes franchies et leur durée.
 * Jamais vos notes, vos documents, votre équipe ni votre discussion. »
 *
 * §3.9 : l'arrêt se confirme « sans vocabulaire d'échec ». La confirmation est une
 * FEUILLE sur mobile et une carte DANS LA PAGE sur ordinateur — la planche de
 * 1440 px la dessine en ligne, avec ses boutons Garder et Arrêter. D'où
 * `mobileOnly` : on ne superpose pas une fenêtre à une carte qui dit déjà la même
 * chose. Les deux nomment le parcours et comptent SES étapes franchies.
 */
export default function Page() {
  const params = useParams<{ id?: string }>();
  const journeyId = typeof params.id === 'string' ? params.id : '';
  const contexte = useContexteParcours();
  const charger = useCallback(() => chargerJ08(journeyId), [journeyId]);

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
      screen="J08"
      charger={charger}
      contexte={contexte}
      desktop={(d) => <J08Desktop {...d} />}
      mobile={(d) => <J08Mobile {...d} />}
    />
  );
}
