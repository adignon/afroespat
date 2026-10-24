'use client';

import { useEffect, useRef } from 'react';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LA CLOCHE SUIT ENTRE ONGLETS DU MÊME NAVIGATEUR (12 §2.7, lot F2)           ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Marquer une notification lue dans un onglet laissait le compteur des AUTRES
 * onglets inchangé jusqu'à la prochaine relecture (polling de 15 s, socket coupée) :
 * le temps réel ne pousse `notification.new` qu'à l'arrivée d'une notification, et
 * la liste fermée des événements serveur (`REALTIME_EVENTS`) n'a pas d'événement
 * « lue » — `notification.new` dirait « il y a du nouveau » pour un contraire.
 * Aucune entrée n'est donc ajoutée au vocabulaire du serveur : le signal reste dans
 * le NAVIGATEUR.
 *
 * `BroadcastChannel` quand il existe (tous les navigateurs actuels), sinon
 * l'événement `storage` : écrire une clé de `localStorage` le déclenche dans les
 * AUTRES onglets du même navigateur, jamais dans celui qui écrit. Les deux voies
 * sont gardées par `try/catch` : stockage bloqué, fenêtre privée, canal absent — la
 * page fonctionne sans, le polling reste le filet.
 *
 * Ne voyagent que des NOMBRES (les deux compteurs), jamais un titre ni un corps.
 * Ce qui ne passe pas d'un navigateur ou d'un appareil à l'autre : pour eux, c'est la
 * relecture périodique qui rattrape.
 */
export interface SignalCompteurs {
  readonly messages: number;
  readonly notifications: number;
}

const NOM_CANAL = 'afroespat:compteurs';

let canal: BroadcastChannel | null | undefined;

function canalOuvert(): BroadcastChannel | null {
  if (canal !== undefined) return canal;
  try {
    canal = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(NOM_CANAL);
  } catch {
    canal = null;
  }
  return canal;
}

function valide(valeur: unknown): valeur is SignalCompteurs {
  if (typeof valeur !== 'object' || valeur === null) return false;
  const v = valeur as Record<string, unknown>;
  return (
    typeof v['messages'] === 'number' &&
    Number.isFinite(v['messages']) &&
    typeof v['notifications'] === 'number' &&
    Number.isFinite(v['notifications'])
  );
}

/** Dit aux AUTRES onglets du navigateur où en sont les compteurs. */
export function diffuserCompteurs(valeurs: SignalCompteurs): void {
  const ouvert = canalOuvert();
  if (ouvert !== null) {
    try {
      ouvert.postMessage(valeurs);
      return;
    } catch {
      // Canal fermé : on tente la voie de repli.
    }
  }
  try {
    window.localStorage.setItem(NOM_CANAL, JSON.stringify({ ...valeurs, t: Date.now() }));
  } catch {
    // Stockage indisponible : le polling rattrape.
  }
}

/** Écoute les signaux des AUTRES onglets ; rend la fonction qui se désabonne. */
export function ecouterAutresOnglets(rappel: (valeurs: SignalCompteurs) => void): () => void {
  const ouvert = canalOuvert();
  const surCanal = (e: MessageEvent<unknown>): void => {
    if (valide(e.data)) rappel(e.data);
  };
  const surStockage = (e: StorageEvent): void => {
    if (e.key !== NOM_CANAL || e.newValue === null) return;
    try {
      const valeur: unknown = JSON.parse(e.newValue);
      if (valide(valeur)) rappel({ messages: valeur.messages, notifications: valeur.notifications });
    } catch {
      // Valeur illisible : ignorée.
    }
  };
  ouvert?.addEventListener('message', surCanal);
  window.addEventListener('storage', surStockage);
  return () => {
    ouvert?.removeEventListener('message', surCanal);
    window.removeEventListener('storage', surStockage);
  };
}

/** Le crochet : `rappel` peut changer d'identité sans réabonner. */
export function useAutresOnglets(rappel: (valeurs: SignalCompteurs) => void): void {
  const ref = useRef(rappel);
  ref.current = rappel;
  useEffect(
    () =>
      ecouterAutresOnglets((v) => {
        ref.current(v);
      }),
    [],
  );
}
