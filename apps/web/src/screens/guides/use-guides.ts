'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ApiError,
  ApiShapeError,
  displayMessageFor,
  hasAccessToken,
  resumeSession,
} from '@/lib/api/index';
import type {
  GuideDetailResponse,
  GuideListResponse,
  GuideProposalsResponse,
  GuideVersionsResponse,
} from '@app/shared';
import {
  fetchGuide,
  fetchGuides,
  fetchProposals,
  fetchVersions,
  flagOutdated,
  unvoteGuide,
  voteGuide,
} from './api';
import { contributorsFrom, guideCardsFrom, propositionFrom, versionsFrom } from './from-api';

/**
 * L'ÉTAT DES ÉCRANS DE GUIDES — A03 et A04.
 *
 * ── CE QU'IL FAIT DU JETON : RIEN ───────────────────────────────────────────
 *
 * Il appelle `resumeSession()` une fois au montage, et c'est tout. Le jeton
 * d'accès vit en mémoire et meurt avec l'onglet ; le cookie de rafraîchissement,
 * lui, dure trente jours. Un rechargement laisse donc une session valide sans
 * jeton en main.
 *
 * Il ne LIT ni ne RANGE jamais le jeton, et rien n'entre dans `localStorage`.
 *
 * UNE NUANCE PROPRE À CE MODULE : `GET /guides` et `GET /guides/:slug` sont
 * `@PublicRead()`. La liste s'affiche donc même sans session — ce qui est voulu,
 * §2.3 tenant un guide publié pour de la documentation. La reprise de session
 * sert à obtenir `myVote`, `myOutdatedFlag` et `isAuthor`, qui n'arrivent qu'avec
 * un lecteur identifié. Son ÉCHEC n'est donc pas une erreur : on charge quand
 * même, en visiteur.
 *
 * ── CE QU'IL NE FAIT PAS AVEC LE NIVEAU ─────────────────────────────────────
 *
 * Aucun `if (level === 'L1')`. Les boutons « Proposer une correction »,
 * « L'information a changé » et le vote sont TOUJOURS affichés ; l'action est
 * tentée, et le serveur répond `403 LEVEL_REQUIRED`. `levelRequired` est exposé
 * tel quel pour que l'écran montre l'INVITATION de §7.3 — une invitation, jamais
 * une erreur sèche. Griser un bouton d'après un niveau gardé en mémoire, c'est la
 * faille de quinze minutes rejouée dans le front, et le membre n'apprendrait même
 * pas ce qui lui manque.
 *
 * ── LE DÉBIT LIMITÉ ─────────────────────────────────────────────────────────
 *
 * On ne rejoue JAMAIS un `429`, et on n'affiche jamais le message du serveur :
 * il dit « patientez un instant » pour une attente qui peut valoir une heure.
 * `displayMessageFor` compose la bonne phrase.
 */

/** Ce qu'un écran doit savoir d'un échec pour le montrer correctement. */
export interface GuideEchec {
  /** La phrase française, jamais le message brut du serveur sur un 429. */
  readonly message: string;
  /** §7.3 : de quoi composer l'INVITATION à monter de niveau. */
  readonly levelRequired: NonNullable<ApiError['levelRequired']> | null;
  /** Vrai quand le CONTRAT est cassé — un incident, pas une règle métier. */
  readonly incident: boolean;
  readonly retryAfterSeconds: number | null;
  /** Le code du serveur. On décide sur LUI, jamais sur le message (§5.2). */
  readonly code: string | null;
}

export function echecDe(error: unknown): GuideEchec {
  /**
   * `ApiShapeError` d'abord, et il n'hérite PAS d'`ApiError` — c'est voulu par le
   * socle : un `catch (e) { if (e instanceof ApiError) }` ne peut pas transformer
   * une rupture de contrat en message métier rassurant.
   */
  if (error instanceof ApiShapeError) {
    return {
      message: displayMessageFor(error),
      levelRequired: null,
      incident: true,
      retryAfterSeconds: null,
      code: null,
    };
  }
  if (error instanceof ApiError) {
    return {
      message: displayMessageFor(error),
      levelRequired: error.levelRequired,
      incident: false,
      retryAfterSeconds: error.retryAfterSeconds,
      code: error.code,
    };
  }
  return {
    message: displayMessageFor(error),
    levelRequired: null,
    incident: false,
    retryAfterSeconds: null,
    code: null,
  };
}

const TAB_PAR_RANG = ['helpful', 'recent', 'review'] as const;

export interface ListeEtat {
  readonly pret: boolean;
  readonly chargement: boolean;
  readonly echec: GuideEchec | null;
  readonly page: GuideListResponse | null;
}

/**
 * A03 — la liste.
 *
 * `tab` est le RANG de l'onglet dans la maquette (0 utiles, 1 récents,
 * 2 à vérifier), pas la valeur de l'API. La traduction est ici, en un seul
 * endroit, parce que le bandeau transcodé pose ces rangs et rien d'autre.
 */
export function useGuides(tab: number) {
  const [etat, setEtat] = useState<ListeEtat>({
    pret: false,
    chargement: true,
    echec: null,
    page: null,
  });

  /**
   * La reprise de session ne doit partir QU'UNE FOIS.
   *
   * En développement, React monte deux fois sous `StrictMode`. Deux
   * `resumeSession()` concurrents, c'est deux `POST /auth/refresh` — et le jeton
   * de rafraîchissement TOURNE à chaque usage : le second présenterait un jeton
   * déjà consommé, ce que la détection de rejeu traite en coupant la chaîne.
   */
  const reprise = useRef<Promise<boolean> | null>(null);

  const onglet = TAB_PAR_RANG[tab] ?? 'helpful';

  const charger = useCallback(
    async (signal: AbortSignal): Promise<void> => {
      try {
        /**
         * La reprise est TENTÉE, jamais exigée : la liste est publique. Son échec
         * ne doit pas vider l'écran d'un visiteur qui n'a simplement pas de
         * session — il verrait « connectez-vous » sur de la documentation ouverte.
         */
        if (!hasAccessToken()) {
          reprise.current ??= resumeSession().catch(() => false);
          await reprise.current;
        }

        const page = await fetchGuides({ tab: onglet }, signal);
        if (signal.aborted) return;
        setEtat({ pret: true, chargement: false, echec: null, page });
      } catch (error) {
        if (signal.aborted) return;
        setEtat({ pret: true, chargement: false, echec: echecDe(error), page: null });
      }
    },
    [onglet],
  );

  useEffect(() => {
    const ac = new AbortController();
    setEtat((p) => ({ ...p, chargement: true }));
    void charger(ac.signal);
    return () => ac.abort();
  }, [charger]);

  const donnees = useMemo(
    () => ({
      guides: etat.page === null ? [] : guideCardsFrom(etat.page),
      /** §2.3 — le seuil du bandeau vient du SERVEUR, jamais d'une constante du front. */
      staleAfterMonths: etat.page?.meta.staleAfterMonths ?? null,
      nextCursor: etat.page?.nextCursor ?? null,
    }),
    [etat.page],
  );

  return { ...etat, ...donnees };
}

export interface GuideEtat {
  readonly pret: boolean;
  readonly chargement: boolean;
  readonly echec: GuideEchec | null;
  readonly detail: GuideDetailResponse | null;
  readonly versions: GuideVersionsResponse | null;
  readonly propositions: GuideProposalsResponse | null;
}

/**
 * A04 — la lecture d'un guide, et A06 pour ses propositions.
 *
 * Les propositions sont chargées APRÈS le détail et non en parallèle, et c'est la
 * seule dépendance réelle de ce module : `GET /guides/:id/proposals` prend
 * l'IDENTIFIANT, que seul le détail donne — l'URL, elle, porte le slug. Les
 * lancer ensemble demanderait de deviner l'identifiant.
 *
 * L'historique, lui, prend le slug : il part donc EN PARALLÈLE du détail.
 */
export function useGuide(slug: string) {
  const [etat, setEtat] = useState<GuideEtat>({
    pret: false,
    chargement: true,
    echec: null,
    detail: null,
    versions: null,
    propositions: null,
  });

  const reprise = useRef<Promise<boolean> | null>(null);

  const charger = useCallback(
    async (signal: AbortSignal): Promise<void> => {
      try {
        if (!hasAccessToken()) {
          reprise.current ??= resumeSession().catch(() => false);
          await reprise.current;
        }

        /**
         * `allSettled` et non `all` : si l'HISTORIQUE échoue, le guide doit
         * quand même s'afficher. `all` ferait disparaître la page entière pour un
         * encart latéral.
         */
        const [detail, versions] = await Promise.allSettled([
          fetchGuide(slug, signal),
          fetchVersions(slug, signal),
        ]);

        if (signal.aborted) return;

        /** Le GUIDE est la page : s'il échoue, l'écran doit le dire. */
        if (detail.status === 'rejected') {
          setEtat({
            pret: true,
            chargement: false,
            echec: echecDe(detail.reason),
            detail: null,
            versions: versions.status === 'fulfilled' ? versions.value : null,
            propositions: null,
          });
          return;
        }

        const propositions = await fetchProposals(detail.value.guide.id, signal).catch(
          () => null,
        );
        if (signal.aborted) return;

        setEtat({
          pret: true,
          chargement: false,
          echec: null,
          detail: detail.value,
          versions: versions.status === 'fulfilled' ? versions.value : null,
          propositions,
        });
      } catch (error) {
        if (signal.aborted) return;
        setEtat((p) => ({ ...p, pret: true, chargement: false, echec: echecDe(error) }));
      }
    },
    [slug],
  );

  useEffect(() => {
    const ac = new AbortController();
    void charger(ac.signal);
    return () => ac.abort();
  }, [charger]);

  /**
   * Voter. On envoie, PUIS on recale sur ce que le serveur renvoie.
   *
   * Pas de mise à jour optimiste du compteur : `helpfulCount` est RELU, et une
   * incrémentation locale divergerait dès qu'un autre membre vote. Surtout,
   * `NOT_HELPFUL` ne bouge PAS le compteur (règle dure §9) — un front qui
   * incrémenterait « de son côté » inventerait le seul chiffre que la règle
   * interdit de bouger.
   *
   * Un `429` n'est PAS rejoué.
   */
  const voter = useCallback(
    async (value: 'HELPFUL' | 'NOT_HELPFUL'): Promise<GuideEchec | null> => {
      const detail = etat.detail;
      if (detail === null) return null;
      try {
        const dejaVote = detail.myVote === value;
        const r = dejaVote
          ? await unvoteGuide(detail.guide.id)
          : await voteGuide(detail.guide.id, value);
        setEtat((p) =>
          p.detail === null
            ? p
            : {
                ...p,
                detail: {
                  ...p.detail,
                  guide: { ...p.detail.guide, helpfulCount: r.helpfulCount },
                  myVote: r.value,
                },
              },
        );
        return null;
      } catch (error) {
        return echecDe(error);
      }
    },
    [etat.detail],
  );

  /** « L'information a changé » (§2.6). Distinct du signalement d'abus. */
  const signalerObsolete = useCallback(
    async (comment?: string): Promise<GuideEchec | null> => {
      const detail = etat.detail;
      if (detail === null) return null;
      try {
        const r = await flagOutdated(detail.guide.id, comment);
        setEtat((p) =>
          p.detail === null
            ? p
            : {
                ...p,
                detail: {
                  ...p.detail,
                  guide: {
                    ...p.detail.guide,
                    outdatedFlagCount: r.outdatedFlagCount,
                    status: r.status,
                  },
                },
              },
        );
        return null;
      } catch (error) {
        return echecDe(error);
      }
    },
    [etat.detail],
  );

  const donnees = useMemo(
    () => ({
      contributors: etat.detail === null ? [] : contributorsFrom(etat.detail),
      versionRows: etat.versions === null ? [] : versionsFrom(etat.versions),
      propositionsVues:
        etat.propositions === null ? [] : etat.propositions.items.map((p) => propositionFrom(p)),
      /** §5 — l'écran de l'AUTEUR, décidé par le serveur à chaque requête. */
      isAuthor: etat.detail?.guide.isAuthor ?? false,
      monVote: etat.detail?.myVote ?? null,
      aSignale: etat.detail?.myOutdatedFlag !== null && etat.detail?.myOutdatedFlag !== undefined,
      bandeaux: etat.detail?.guide.banners ?? [],
    }),
    [etat.detail, etat.versions, etat.propositions],
  );

  return { ...etat, ...donnees, voter, signalerObsolete };
}
