'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CommunitiesResponse } from '@app/shared';
import { hasAccessToken, resumeSession } from '@/lib/api/index';
import { fetchCommunities, joinCommunity, type CommunityFilters } from './api';
import { discoversFrom, myNetsFrom } from './from-api';
import { echecDe, type ReseauEchec } from './echec';
import type { A07Data, DiscoverView, MyNetView } from '../a07/data';
import { netFiltersFor, shortcuts } from '../a07/data';
import { panelReseaux, rail } from './chrome';

/**
 * L'ÉTAT DE A07 — « Réseaux ».
 *
 * ── UNE SEULE ROUTE, ET C'EST VOULU ────────────────────────────────────────
 *
 * `GET /communities` rend les cinq blocs de l'écran d'un coup : mes réseaux, mes
 * invitations, mes demandes en attente, la découverte paginée, et le seuil de
 * création. Les découper en cinq appels ferait cinq allers-retours pour une page
 * qui n'en demande qu'un — et surtout, `creationGate` serait alors lu à part,
 * donc susceptible de vieillir pendant que la liste se recharge.
 *
 * ── CE QU'IL NE FAIT PAS DU NIVEAU ─────────────────────────────────────────
 *
 * Aucun `if (level === 'L1')`. Le bouton « Créer » suit `creationGate.canCreate`,
 * que le SERVEUR recalcule à chaque requête — donc il ne peut pas périmer comme
 * une copie gardée le ferait. Et si le bouton est montré à tort, c'est le
 * `403 LEVEL_REQUIRED` de A10 qui portera l'invitation de §7.3.
 *
 * ── LE JETON ───────────────────────────────────────────────────────────────
 *
 * Il appelle `resumeSession()` une fois au montage, et c'est tout. Le jeton
 * d'accès vit en mémoire et meurt avec l'onglet ; le cookie de rafraîchissement
 * dure trente jours. Sans cette reprise, le premier `GET /communities` partirait
 * sans en-tête sur une session parfaitement bonne. Rien n'entre dans
 * `localStorage`.
 */
export interface ReseauxEtat {
  readonly pret: boolean;
  readonly chargement: boolean;
  readonly echec: ReseauEchec | null;
  readonly reponse: CommunitiesResponse | null;
  readonly data: A07Data;
  readonly myNets: readonly MyNetView[];
  readonly discover: readonly DiscoverView[];
  /**
   * La phrase du seuil, composée à partir des NOMBRES que le serveur donne.
   *
   * §2.2 veut « Les réseaux d'intérêt ouvrent à partir de 50 membres à Lyon
   * (34 aujourd'hui) » : le back envoie `required`, `current` et `cityName`
   * plutôt qu'un texte à trous, et c'est ici qu'on l'assemble. `null` quand la
   * création est ouverte — il n'y a alors rien à expliquer.
   */
  readonly seuilPhrase: string | null;
  readonly rejoindre: (slug: string) => Promise<void>;
  readonly recharger: () => void;
}

export function useReseaux(filters: CommunityFilters = {}, kindFilter = 0): ReseauxEtat {
  const [reponse, setReponse] = useState<CommunitiesResponse | null>(null);
  const [chargement, setChargement] = useState(true);
  const [pret, setPret] = useState(false);
  const [echec, setEchec] = useState<ReseauEchec | null>(null);
  const [tick, setTick] = useState(0);

  /**
   * La reprise de session ne doit partir QU'UNE FOIS.
   *
   * Sous `StrictMode`, React monte deux fois en développement. Deux
   * `resumeSession()` concurrents, c'est deux `POST /auth/refresh` — et le jeton
   * de rafraîchissement TOURNE à chaque usage : le second présenterait un jeton
   * déjà consommé, que la détection de rejeu traite en coupant la chaîne.
   */
  const reprise = useRef<Promise<boolean> | null>(null);

  const cle = JSON.stringify(filters);

  useEffect(() => {
    const ac = new AbortController();
    let vivant = true;
    setChargement(true);

    void (async () => {
      try {
        if (!hasAccessToken()) {
          reprise.current ??= resumeSession();
          await reprise.current;
        }
        const r = await fetchCommunities(JSON.parse(cle) as CommunityFilters, ac.signal);
        if (!vivant) return;
        setReponse(r);
        setEchec(null);
      } catch (e) {
        if (ac.signal.aborted || !vivant) return;
        setEchec(echecDe(e));
      } finally {
        if (vivant) {
          setChargement(false);
          setPret(true);
        }
      }
    })();

    return () => {
      vivant = false;
      ac.abort();
    };
  }, [cle, tick]);

  const myNets = useMemo(
    () => (reponse === null ? [] : myNetsFrom(reponse.mine)),
    [reponse],
  );
  const discover = useMemo(
    () => (reponse === null ? [] : discoversFrom(reponse.discover.items)),
    [reponse],
  );

  const seuilPhrase = useMemo(() => {
    const g = reponse?.creationGate;
    if (g === undefined || g.canCreate) return null;
    if (g.cityName === null) {
      return 'Renseignez votre ville pour créer un réseau d’intérêt.';
    }
    return `Les réseaux d’intérêt ouvrent à partir de ${g.required} membres à ${g.cityName} (${g.current} aujourd’hui).`;
  }, [reponse]);

  /**
   * Rejoindre — ou DEMANDER. La route est la même, le serveur tranche.
   *
   * On ne met PAS à jour la liste à la main d'après ce qu'on croit avoir fait :
   * la réponse dit `myStatus` (`ACTIVE` ou `PENDING`), et le seul état qui
   * compte ensuite est celui que `GET /communities` renverra. On recharge donc,
   * plutôt que de peindre un « Rejoint » qui pourrait être faux.
   */
  const rejoindre = useCallback(async (slug: string) => {
    try {
      await joinCommunity(slug);
      setTick((t) => t + 1);
    } catch (e) {
      setEchec(echecDe(e));
    }
  }, []);

  const data: A07Data = useMemo(
    () => ({
      rail,
      shortcuts,
      panelReseaux,
      netFilters: netFiltersFor(kindFilter),
      myNets,
      discover,
    }),
    [myNets, discover, kindFilter],
  );

  return {
    pret,
    chargement,
    echec,
    reponse,
    data,
    myNets,
    discover,
    seuilPhrase,
    rejoindre,
    recharger: useCallback(() => setTick((t) => t + 1), []),
  };
}
