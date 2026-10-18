'use client';

/**
 * AJOUT HORS MAQUETTE — QUELLE FEUILLE EST OUVERTE, ET SUR QUOI.
 *
 * Les feuilles du module (« Je suis bloqué·e », « Partager un jalon », « Inviter »,
 * « Arrêter », « Exporter », le sélecteur de parcours, « Signaler une erreur ») sont
 * ouvertes depuis des endroits que ni la page ni la vue ne partagent : la carte du
 * panneau de gauche (cadre transcodé, qui porte `data-modal-open`), un bouton d'étape
 * de la frise, la colonne de droite. Un petit magasin évite de faire redescendre un
 * état par six composants — `useSyncExternalStore`, comme les compteurs de la barre
 * haute.
 */

import { useSyncExternalStore } from 'react';

export type NomFeuille =
  | 'blocage'
  | 'partage'
  | 'inviter'
  | 'arreter'
  | 'exporter'
  | 'selecteur'
  | 'signaler';

export interface FeuilleOuverte {
  readonly nom: NomFeuille;
  /** L'étape visée ; absente = l'étape en cours du parcours. */
  readonly stepId?: string;
}

let courante: FeuilleOuverte | null = null;
const abonnes = new Set<() => void>();

function diffuser(): void {
  for (const rappel of abonnes) rappel();
}

export function ouvrirFeuille(nom: NomFeuille, stepId?: string): void {
  courante = stepId === undefined ? { nom } : { nom, stepId };
  diffuser();
}

export function fermerFeuille(): void {
  courante = null;
  diffuser();
}

export function useFeuille(): FeuilleOuverte | null {
  return useSyncExternalStore(
    (rappel) => {
      abonnes.add(rappel);
      return () => abonnes.delete(rappel);
    },
    () => courante,
    () => null,
  );
}

/** Les anciens noms de planche (`data-modal-open`) et la feuille qu'ils ouvrent. */
export const FEUILLE_DE_MODALE: Readonly<Record<string, NomFeuille>> = {
  J03: 'blocage',
  J04: 'partage',
  J05I: 'inviter',
  J07X: 'exporter',
  J08A: 'arreter',
  J01M: 'selecteur',
};
