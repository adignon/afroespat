'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CommunityDetailResponse, TopicsResponse } from '@app/shared';
import { hasAccessToken, resumeSession } from '@/lib/api/index';
import { fetchCommunity, fetchTopics, joinCommunity, leaveCommunity } from './api';
import { communityIsOpen, pinnedRowsFrom, topicRowsFrom, withoutPinned } from './from-api';
import { echecDe, type ReseauEchec } from './echec';
import { netTabsFor, panelReseaux, rail } from './chrome';
import type { A08Data, TopicRowView } from '../a08/data';
import { ownerActions, shortcuts } from '../a08/data';

/**
 * L'ÉTAT DE A08 — un réseau et son onglet Sujets.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * DEUX APPELS, ET LE SECOND A LE DROIT D'ÊTRE REFUSÉ
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `GET /communities/:slug` passe pour tout le monde — un réseau public se
 * découvre. `GET /communities/:id/topics` ne passe que pour un MEMBRE ACTIF, et
 * répond `403 NOT_A_MEMBER` sinon. Ce n'est pas un cas d'erreur à rattraper :
 * c'est le fonctionnement normal de la moitié des visites.
 *
 * D'où les trois règles de ce fichier :
 *
 *   1. LES DEUX APPELS PARTENT QUAND MÊME. On ne consulte pas `myStatus` pour
 *      décider d'appeler ou non : ce serait remplacer la garde du serveur par
 *      une garde du front, et le jour où les deux diverge­raient, c'est celle du
 *      front qui déciderait. Le serveur reste seul juge ; on lit sa réponse.
 *
 *   2. UN 403 `NOT_A_MEMBER` SUR LES SUJETS N'EST PAS UN ÉCHEC DE PAGE. Il pose
 *      `contenuFerme`, la page reste, et l'écran montre l'invitation à
 *      rejoindre. Le reste des échecs, lui, remonte normalement.
 *
 *   3. ON NE COMBLE RIEN. `topics` reste VIDE sur un refus, et `contenuFerme`
 *      dit pourquoi. La tentation serait d'afficher « aucun sujet pour le
 *      moment » — ce serait apprendre au lecteur que le réseau est mort alors
 *      qu'il est seulement fermé, et ce serait contourner par l'affichage la
 *      règle que le serveur tient.
 *
 * ── LES COMPTEURS DE L'EN-TÊTE SONT MASQUÉS, PAS NULS ──────────────────────
 *
 * Mesuré sur le même réseau PUBLIC à la même seconde : `counters.topics` vaut 1
 * pour un membre et 0 pour un passant, et `pinned` porte un sujet AVEC SON TITRE
 * pour le premier, `[]` pour le second. `compteursFiables` existe pour que
 * l'écran écrive « Rejoignez pour voir » plutôt que « 0 sujet ».
 */
export interface ReseauEtat {
  readonly pret: boolean;
  readonly chargement: boolean;
  /** Les échecs qui font une page cassée. Un refus d'adhésion n'en est pas un. */
  readonly echec: ReseauEchec | null;
  readonly reseau: CommunityDetailResponse | null;
  readonly sujets: TopicsResponse | null;
  readonly data: A08Data;
  /** Le lecteur est membre ACTIF : `INVITED` et `PENDING` ne comptent pas. */
  readonly membre: boolean;
  /**
   * Le contenu a été REFUSÉ — 403 `NOT_A_MEMBER`. Distinct de « vide ».
   *
   * C'est la prise qui empêche l'écran de mentir : `sujets` est vide dans les
   * deux cas, et seul ce booléen dit lequel des deux on regarde.
   */
  readonly contenuFerme: boolean;
  /** Les compteurs de l'en-tête sont-ils dignes de foi ? Même condition que `membre`. */
  readonly compteursFiables: boolean;
  readonly rejoindre: () => Promise<void>;
  readonly quitter: () => Promise<void>;
}

export function useReseau(slug: string, ongletActif = 1): ReseauEtat {
  const [reseau, setReseau] = useState<CommunityDetailResponse | null>(null);
  const [sujets, setSujets] = useState<TopicsResponse | null>(null);
  const [contenuFerme, setContenuFerme] = useState(false);
  const [chargement, setChargement] = useState(true);
  const [pret, setPret] = useState(false);
  const [echec, setEchec] = useState<ReseauEchec | null>(null);
  const [tick, setTick] = useState(0);

  const reprise = useRef<Promise<boolean> | null>(null);

  useEffect(() => {
    if (slug === '') return;
    const ac = new AbortController();
    let vivant = true;
    setChargement(true);

    void (async () => {
      try {
        if (!hasAccessToken()) {
          reprise.current ??= resumeSession();
          await reprise.current;
        }

        /**
         * Les deux EN PARALLÈLE, et `allSettled` plutôt qu'`all`.
         *
         * `all` rejetterait dès que les sujets sont refusés — c'est-à-dire pour
         * tout passant — et la page entière disparaîtrait alors qu'on a
         * parfaitement de quoi afficher l'en-tête et le bouton « Rejoindre ».
         */
        const [fiche, liste] = await Promise.allSettled([
          fetchCommunity(slug, ac.signal),
          fetchTopics(slug, {}, ac.signal),
        ]);
        if (!vivant) return;

        if (fiche.status === 'fulfilled') {
          setReseau(fiche.value);
          setEchec(null);
        } else {
          setEchec(echecDe(fiche.reason));
        }

        if (liste.status === 'fulfilled') {
          setSujets(liste.value);
          setContenuFerme(false);
        } else {
          const e = echecDe(liste.reason);
          setSujets(null);
          /**
           * UN REFUS N'EST PAS UNE ABSENCE. On note qu'il est fermé, et on ne
           * remplace surtout pas la liste par un tableau vide présenté comme
           * une liste réelle.
           */
          setContenuFerme(e.notMember);
          // Tout autre échec sur les sujets est un vrai échec — sauf si la fiche
          // a elle-même échoué, auquel cas son message est le plus utile.
          if (!e.notMember && fiche.status === 'fulfilled') setEchec(e);
        }
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
  }, [slug, tick]);

  const membre = reseau !== null && communityIsOpen(reseau);

  /**
   * Les lignes de sujets : les ÉPINGLÉS en tête, puis les autres.
   *
   * `withoutPinned` est indispensable — mesuré, un sujet épinglé figure DANS
   * `items` ET dans `meta.pinned`. Dessiner les deux listes à la suite
   * l'afficherait deux fois, et le défaut ne se verrait que sur un réseau qui
   * épingle, c'est-à-dire tard.
   */
  const topics: readonly TopicRowView[] = useMemo(() => {
    if (sujets === null) return [];
    const epingles = sujets.meta.pinned;
    return [...pinnedRowsFrom(epingles), ...withoutPinned(topicRowsFrom(sujets.items), epingles)];
  }, [sujets]);

  const data: A08Data = useMemo(
    () => ({
      rail,
      shortcuts,
      panelReseaux,
      netTabs: netTabsFor(ongletActif),
      ownerActions,
      topics,
    }),
    [topics, ongletActif],
  );

  const rejoindre = useCallback(async () => {
    try {
      const apres = await joinCommunity(slug);
      setReseau(apres);
      // On RECHARGE les sujets : ils viennent peut-être de s'ouvrir. Et si
      // l'adhésion n'était qu'une DEMANDE (`PENDING`), ils resteront fermés —
      // c'est le serveur qui le dira, pas nous.
      setTick((t) => t + 1);
    } catch (e) {
      setEchec(echecDe(e));
    }
  }, [slug]);

  const quitter = useCallback(async () => {
    try {
      await leaveCommunity(slug);
      setTick((t) => t + 1);
    } catch (e) {
      setEchec(echecDe(e));
    }
  }, [slug]);

  return {
    pret,
    chargement,
    echec,
    reseau,
    sujets,
    data,
    membre,
    contenuFerme,
    compteursFiables: membre,
    rejoindre,
    quitter,
  };
}
