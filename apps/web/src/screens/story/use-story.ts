'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { hasAccessToken, resumeSession } from '@/lib/api/index';
import type { StoryDetailResponse } from '@app/shared';
import { fetchStory, unvoteStory, voteStory } from '../accueil/api';
import { echecDe, type FilEchec } from '../publication/echec';
import { storyLueFrom, type StoryLue, type VoteKind } from './from-api';

/**
 * L'ÉTAT DE `/stories/:id`.
 *
 * ── `GET /stories/:id` EST UNE LECTURE QUI ÉCRIT ──────────────────────────
 *
 * Elle MARQUE LA STORY VUE — c'est l'anneau du bandeau, pas un compteur : §2.6
 * interdit tout compteur de vues, et l'API n'en expose aucun. La conséquence pour
 * ce crochet est concrète : l'appel n'est pas idempotent du point de vue de
 * l'anneau, donc il ne doit partir qu'UNE FOIS par story. `StrictMode` monte deux
 * fois en développement ; l'`AbortController` annule le premier, et l'effet ne
 * dépend que de l'identifiant.
 *
 * ── 404 SUR UNE STORY EXPIRÉE ─────────────────────────────────────────────
 *
 * §2.6 : une story expirée répond `404` sauf à son auteur ou à qui l'a gardée.
 * C'est une règle métier, pas un incident — `echecDe` la rend en `ApiError`, et
 * l'écran affiche la phrase française, jamais une page blanche.
 */

export interface StoryEtat {
  readonly pret: boolean;
  readonly chargement: boolean;
  readonly echec: FilEchec | null;
  readonly reponse: StoryDetailResponse | null;
}

export function useStory(storyId: string) {
  const [etat, setEtat] = useState<StoryEtat>({
    pret: false,
    chargement: true,
    echec: null,
    reponse: null,
  });

  const reprise = useRef<Promise<boolean> | null>(null);

  const charger = useCallback(
    async (signal: AbortSignal): Promise<void> => {
      try {
        if (!hasAccessToken()) {
          reprise.current ??= resumeSession();
          await reprise.current;
        }
        const reponse = await fetchStory(storyId, signal);
        if (signal.aborted) return;
        setEtat({ pret: true, chargement: false, echec: null, reponse });
      } catch (error) {
        if (signal.aborted) return;
        setEtat({ pret: true, chargement: false, echec: echecDe(error), reponse: null });
      }
    },
    [storyId],
  );

  useEffect(() => {
    const ac = new AbortController();
    void charger(ac.signal);
    return () => ac.abort();
  }, [charger]);

  /**
   * Voter, et retirer son vote. On envoie, PUIS on recale sur le serveur.
   *
   * Aucune mise à jour optimiste : `PUT /stories/:id/reaction` rend les compteurs
   * FRAÎCHEMENT RELUS, et une incrémentation locale divergerait dès qu'un autre
   * membre vote en même temps.
   *
   * Le `kind` EST envoyé ici — contrairement à la réaction de publication, où le
   * serveur le déduit du type. §2.6 en accepte deux par type, et le serveur refuse
   * `KIND_NOT_ALLOWED_FOR_TYPE` (mesuré 422) si l'on se trompe. L'appelant passe
   * donc `positiveKind` ou `negativeKind` lus SUR LA STORY, jamais une table tenue
   * dans le front.
   *
   * Un `429` n'est PAS rejoué.
   */
  const basculerVote = useCallback(
    async (kind: VoteKind): Promise<FilEchec | null> => {
      const courant = etat.reponse;
      if (courant === null) return null;
      try {
        const votes =
          courant.story.myReaction === kind
            ? await unvoteStory(storyId)
            : await voteStory(storyId, kind);
        setEtat((p) =>
          p.reponse === null
            ? p
            : {
                ...p,
                reponse: {
                  ...p.reponse,
                  story: {
                    ...p.reponse.story,
                    myReaction: courant.story.myReaction === kind ? null : kind,
                    votes: {
                      positive: votes.positive,
                      positiveKind: votes.positiveKind,
                      positiveLabel: votes.positiveLabel,
                      negative: votes.negative,
                      negativeKind: votes.negativeKind,
                      negativeLabel: votes.negativeLabel,
                    },
                  },
                },
              },
        );
        return null;
      } catch (error) {
        return echecDe(error);
      }
    },
    [etat.reponse, storyId],
  );

  const story: StoryLue | null = useMemo(
    () => (etat.reponse === null ? null : storyLueFrom(etat.reponse)),
    [etat.reponse],
  );

  return { ...etat, story, basculerVote };
}
