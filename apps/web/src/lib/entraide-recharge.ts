'use client';

import { useSyncExternalStore } from 'react';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ « RECHARGE L'ÉCRAN » — LE SEUL LIEN ENTRE UN GESTE ET LA LISTE QU'IL CHANGE ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Les écrans de l'entraide et du parrainage sont chargés par `EcranDonnees`, qui ne
 * recharge que lorsque l'IDENTITÉ de sa fonction `charger` change. Un geste —
 * résoudre une demande, accepter un parrainage — doit donc pouvoir dire à l'écran
 * « relis ». Un compteur de version, lu par la page dans les dépendances de son
 * `useCallback`, fait exactement cela et rien d'autre : pas de cache, pas de
 * seconde source de vérité, le serveur reste ce qu'on relit.
 *
 * `bump()` est appelé par les composants de geste APRÈS une réponse réussie du
 * serveur — jamais avant : le front prévient, le serveur décide.
 */
let version = 0;
const abonnes = new Set<() => void>();

export function rechargerEntraide(): void {
  version += 1;
  for (const a of abonnes) a();
}

export function useVersionEntraide(): number {
  return useSyncExternalStore(
    (rappel) => {
      abonnes.add(rappel);
      return () => {
        abonnes.delete(rappel);
      };
    },
    () => version,
    () => 0,
  );
}
