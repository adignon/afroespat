'use client';

import { useCallback } from 'react';
import { useParams } from 'next/navigation';
import { VUE_NEUTRE, chargerJ05 } from '@/screens/parcours/appels';
import { EcranParcoursDonnees } from '@/screens/parcours/ecran-donnees';
import { useContexteParcours } from '@/screens/parcours/use-parcours-api';
import { J05Desktop } from '@/screens/j05/desktop.generated';
import { J05Mobile } from '@/screens/j05/mobile.generated';
import { J05MobileInvitation } from '@/screens/j05invitation/mobileinvitation.generated';

/**
 * J05 — l'équipe du parcours. `/parcours/:id/equipe`.
 *
 * BRANCHÉ SUR `GET /journeys/:id` : la route rend `journey.owner` ET `members` en
 * un seul appel, et c'est tout ce que cet écran affiche.
 *
 * §3.4 : deux rôles seulement, `OBSERVER` et `SUPPORTER`, dix membres au plus, et
 * « le co-porteur n'existe pas en V1 ». LA MAQUETTE EN DESSINE QUATRE —
 * Propriétaire, Parraine, Accompagnant, Observatrice. Le propriétaire n'est pas un
 * membre (il n'est pas dans `members`, mesuré sur la charge relevée) et « parrain »
 * est un rôle du PARRAINAGE : la pastille orange « Parraine » reste donc dessinée
 * dans le cadre et n'est jamais choisie. Écart signalé au porteur.
 *
 * La feuille d'invitation n'a PAS de planche d'ordinateur : la maquette ne la
 * dessine qu'en mobile. Elle sert donc aux deux largeurs (voir `Modal`), et elle NE
 * LIT RIEN — ses deux suggestions sont des CONTACTS du membre
 * (`GET /me/connections`, module Compte), pas des membres de parcours.
 */
export default function Page() {
  const params = useParams<{ id?: string }>();
  const journeyId = typeof params.id === 'string' ? params.id : '';
  const contexte = useContexteParcours();
  /**
   * MÉMOÏSÉ SUR L'IDENTIFIANT, et il le faut : `useDonnees` a `charger` dans ses
   * dépendances, donc une fonction anonyme rechargerait en boucle. C'est la même
   * discipline que K02 dans le module Compte, et la boucle se voit tout de suite —
   * un rechargement manqué ne se voit jamais.
   */
  const charger = useCallback(() => chargerJ05(journeyId), [journeyId]);

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
      screen="J05"
      charger={charger}
      contexte={contexte}
      desktop={(d) => <J05Desktop {...d} />}
      mobile={(d) => <J05Mobile {...d} />}
    />
  );
}
