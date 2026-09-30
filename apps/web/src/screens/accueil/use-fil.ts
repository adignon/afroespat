'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ApiError,
  ApiShapeError,
  displayMessageFor,
  hasAccessToken,
  resumeSession,
} from '@/lib/api/index';
import type { FeedResponse, FeedSidebarResponse, StoryBandResponse } from '@app/shared';
import { fetchFeed, fetchSidebar, fetchStoryBand, reactToPost, unreactToPost } from './api';
import { arrivalsFrom, eventsFrom, feedPostsFrom, onlineFrom, storiesFrom } from './from-api';

/**
 * L'ÉTAT DU FIL — un seul crochet pour A01, parce que la page n'a qu'un écran.
 *
 * ── CE QU'IL FAIT DU JETON : RIEN ───────────────────────────────────────────
 *
 * Il appelle `resumeSession()` une fois au montage, et c'est tout. Le jeton d'accès
 * vit en mémoire et meurt avec l'onglet (`lib/api/session.ts`) ; le cookie de
 * rafraîchissement, lui, dure trente jours. Un rechargement laisse donc une session
 * valide sans jeton en main — sans cette reprise, le premier `GET /feed` partirait
 * sans en-tête et le fil serait vide sur une session parfaitement bonne.
 *
 * Il ne LIT ni ne RANGE jamais le jeton, et rien n'entre dans `localStorage`.
 *
 * ── CE QU'IL NE FAIT PAS AVEC LE NIVEAU ─────────────────────────────────────
 *
 * Aucun `if (level === 'L1')`. Le composeur s'ouvre ou se grise selon
 * `meta.canPost`, que le SERVEUR recalcule à chaque requête — donc il ne peut pas
 * périmer comme une copie gardée le ferait. Et quand une action est refusée, c'est
 * le `403 LEVEL_REQUIRED` qui porte de quoi afficher l'invitation de §7.3 :
 * `levelRequired` est exposé tel quel, pour que l'écran montre une INVITATION et
 * non une erreur sèche.
 *
 * ── LE DÉBIT LIMITÉ ─────────────────────────────────────────────────────────
 *
 * On ne rejoue JAMAIS un `429`, et on n'affiche jamais le message du serveur :
 * il dit « patientez un instant » pour une attente qui peut valoir une heure.
 * `error.displayMessage` (via `displayMessageFor`) compose la bonne phrase.
 */

/** Ce qu'un écran doit savoir d'un échec pour le montrer correctement. */
export interface FilEchec {
  /** La phrase française, jamais le message brut du serveur sur un 429. */
  readonly message: string;
  /** §7.3 : de quoi composer l'INVITATION à monter de niveau. */
  readonly levelRequired: NonNullable<ApiError['levelRequired']> | null;
  /** Vrai quand le CONTRAT est cassé — un incident, pas une règle métier. */
  readonly incident: boolean;
  readonly retryAfterSeconds: number | null;
}

function echecDe(error: unknown): FilEchec {
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
    };
  }
  if (error instanceof ApiError) {
    return {
      message: displayMessageFor(error),
      levelRequired: error.levelRequired,
      incident: false,
      retryAfterSeconds: error.retryAfterSeconds,
    };
  }
  return {
    message: displayMessageFor(error),
    levelRequired: null,
    incident: false,
    retryAfterSeconds: null,
  };
}

export interface FilEtat {
  readonly pret: boolean;
  readonly chargement: boolean;
  readonly echec: FilEchec | null;
  readonly feed: FeedResponse | null;
  readonly sidebar: FeedSidebarResponse | null;
  readonly bandeau: StoryBandResponse | null;
}

/**
 * `filter` est l'indice de la maquette — -1 tout, 0 conseil, 1 découverte,
 * 2 information — et non le type de l'API. La traduction est ici, en un seul
 * endroit, parce que le bandeau transcodé pose ces indices et rien d'autre.
 */
const TYPE_PAR_FILTRE = ['CONSEIL', 'DECOUVERTE', 'INFORMATION'] as const;

export function useFil(storyFilter: number, postType: number) {
  const [etat, setEtat] = useState<FilEtat>({
    pret: false,
    chargement: true,
    echec: null,
    feed: null,
    sidebar: null,
    bandeau: null,
  });

  /**
   * La reprise de session ne doit partir QU'UNE FOIS.
   *
   * En développement, React monte deux fois sous `StrictMode`. Deux
   * `resumeSession()` concurrents, c'est deux `POST /auth/refresh` — et le jeton de
   * rafraîchissement TOURNE à chaque usage : le second présenterait un jeton déjà
   * consommé, ce que la détection de rejeu traite en coupant la chaîne. On
   * couperait donc la session du membre au chargement de sa page la plus visitée.
   * Le socle partage déjà un rafraîchissement en vol, et ce garde-fou le double
   * ici où l'effet est déclenché.
   */
  const reprise = useRef<Promise<boolean> | null>(null);

  const typeStory = storyFilter < 0 ? undefined : TYPE_PAR_FILTRE[storyFilter];

  const charger = useCallback(
    async (signal: AbortSignal): Promise<void> => {
      try {
        if (!hasAccessToken()) {
          reprise.current ??= resumeSession();
          await reprise.current;
        }

        /**
         * Les trois appels EN PARALLÈLE, et c'est mesurable : en série, la colonne
         * droite attend le fil, qui attend le bandeau. Ils ne dépendent pas les uns
         * des autres.
         *
         * `allSettled` et non `all` : si la colonne droite échoue, le FIL doit
         * quand même s'afficher. `all` ferait disparaître la page entière pour un
         * bloc secondaire — et la colonne droite est justement celle qui dépend
         * d'un cache de cinq minutes et de la ville du membre.
         */
        const [feed, sidebar, bandeau] = await Promise.allSettled([
          fetchFeed(postType >= 0 ? {} : {}, signal),
          fetchSidebar(signal),
          fetchStoryBand(typeStory === undefined ? {} : { type: typeStory }, signal),
        ]);

        if (signal.aborted) return;

        /** Le FIL est la page : s'il échoue, l'écran doit le dire. */
        if (feed.status === 'rejected') {
          setEtat({
            pret: true,
            chargement: false,
            echec: echecDe(feed.reason),
            feed: null,
            sidebar: sidebar.status === 'fulfilled' ? sidebar.value : null,
            bandeau: bandeau.status === 'fulfilled' ? bandeau.value : null,
          });
          return;
        }

        setEtat({
          pret: true,
          chargement: false,
          echec: null,
          feed: feed.value,
          sidebar: sidebar.status === 'fulfilled' ? sidebar.value : null,
          bandeau: bandeau.status === 'fulfilled' ? bandeau.value : null,
        });
      } catch (error) {
        if (signal.aborted) return;
        setEtat((p) => ({ ...p, pret: true, chargement: false, echec: echecDe(error) }));
      }
    },
    [postType, typeStory],
  );

  useEffect(() => {
    const ac = new AbortController();
    void charger(ac.signal);
    return () => ac.abort();
  }, [charger]);

  /**
   * Réagir. On envoie, PUIS on recale sur ce que le serveur renvoie.
   *
   * Pas de mise à jour optimiste du compteur : `reactionState` rend le compteur
   * FRAÎCHEMENT RELU, et une incrémentation locale divergerait dès qu'un autre
   * membre réagit en même temps. Le compteur affiché est donc toujours celui du
   * serveur.
   *
   * Un `429` n'est PAS rejoué.
   */
  const basculerReaction = useCallback(
    async (postId: string, dejaReagi: boolean): Promise<FilEchec | null> => {
      try {
        const etatReaction = dejaReagi ? await unreactToPost(postId) : await reactToPost(postId);
        setEtat((p) => {
          if (p.feed === null) return p;
          return {
            ...p,
            feed: {
              ...p.feed,
              items: p.feed.items.map((item) =>
                item.id === postId
                  ? {
                      ...item,
                      counter: {
                        count: etatReaction.reactionCount,
                        displayCount: etatReaction.displayCount,
                        word: etatReaction.word,
                      },
                      reaction: { ...item.reaction, mine: etatReaction.mine },
                    }
                  : item,
              ),
            },
          };
        });
        return null;
      } catch (error) {
        return echecDe(error);
      }
    },
    [],
  );

  /** Les prises de la maquette, dérivées une fois par changement de donnée. */
  const donnees = useMemo(
    () => ({
      feedPosts: etat.feed === null ? [] : feedPostsFrom(etat.feed),
      stories: etat.bandeau === null ? [] : storiesFrom(etat.bandeau),
      events: etat.sidebar === null ? [] : eventsFrom(etat.sidebar),
      arrivals: etat.sidebar === null ? [] : arrivalsFrom(etat.sidebar),
      online: etat.sidebar === null ? [] : onlineFrom(etat.sidebar),
      /** §2.4 : le composeur suit CE booléen, recalculé par le serveur. */
      canPost: etat.feed?.meta.canPost ?? false,
      canCreateStory: etat.bandeau?.meta.canCreate ?? false,
      /** §2.6 : le rappel du composeur de story vient du serveur, pas du front. */
      rappelStory: etat.bandeau?.meta.reminder ?? '',
      /** §2.4 : la consigne de rendu des liens sortants, elle aussi du serveur. */
      linkRel: etat.feed?.meta.linkRel ?? 'noopener nofollow ugc',
    }),
    [etat.feed, etat.sidebar, etat.bandeau],
  );

  return { ...etat, ...donnees, basculerReaction };
}
