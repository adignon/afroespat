'use client';

import { useEffect, useRef, useState } from 'react';
import { MESSAGE_POLL_INTERVAL_MS } from '@app/shared';
import { ecouter, suivreConnexion, estConnecte, type EvenementClient } from './temps-reel';

/**
 * Les deux crochets du temps réel.
 *
 * `useEvenements` : appelle `rappel(evenement, payload)` à chaque événement
 * demandé. `rappel` peut changer d'identité à chaque rendu sans réabonner : on le
 * lit par une référence.
 *
 * `useRepliPolling` : le FILET (08 §5.3, « repli en polling 15 s »). Tant que la
 * socket est ouverte, rien ne tourne ; dès qu'elle est coupée, `recharger` est
 * rappelé toutes les `MESSAGE_POLL_INTERVAL_MS`, et une fois à la reconnexion
 * (un événement manqué pendant la coupure n'est jamais rejoué).
 */
export function useEvenements(
  evenements: readonly EvenementClient[],
  rappel: (evenement: EvenementClient, payload: unknown) => void,
): void {
  const ref = useRef(rappel);
  ref.current = rappel;
  const cle = evenements.join('|');
  useEffect(() => {
    const desabonnements = (cle.split('|') as EvenementClient[]).map((nom) =>
      ecouter(nom, (payload) => {
        ref.current(nom, payload);
      }),
    );
    return () => {
      desabonnements.forEach((d) => {
        d();
      });
    };
  }, [cle]);
}

export function useConnecte(): boolean {
  const [connecte, setConnecte] = useState(estConnecte());
  useEffect(() => suivreConnexion(setConnecte), []);
  return connecte;
}

export function useRepliPolling(recharger: () => void, actif = true): void {
  const ref = useRef(recharger);
  ref.current = recharger;
  const connecte = useConnecte();
  useEffect(() => {
    if (!actif || connecte) return;
    const minuteur = setInterval(() => {
      ref.current();
    }, MESSAGE_POLL_INTERVAL_MS);
    return () => {
      clearInterval(minuteur);
    };
  }, [actif, connecte]);
}
