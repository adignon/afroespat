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
  CreatePost,
  FeedResponse,
  FeedSidebarResponse,
  StoryBandResponse,
  UpdatePost,
} from '@app/shared';
import {
  bookmarkPost,
  createPost,
  deletePost,
  fetchFeed,
  fetchSidebar,
  fetchStoryBand,
  reactToPost,
  unbookmarkPost,
  unreactToPost,
  updatePost,
  votePoll,
} from './api';
import { arrivalsFrom, eventsFrom, feedPostsFrom, onlineFrom, storiesFrom } from './from-api';
import { ecouterStoriesVues } from '../story/vue';

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
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ L'ANNEAU GRISE DÈS QUE LA STORY EST LUE                                 ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur : « Il faut rafraîchir pour savoir ce qui est lu ou pas. »
   *
   * La story s'ouvre dans une FENÊTRE — une route interceptée, montée à côté de ce
   * fil et non dedans — donc rien ne redescendait jusqu'au bandeau. Le serveur a
   * déjà enregistré la vue quand la fenêtre a chargé la story ; on pose ici la même
   * chose dans l'état, plutôt que de redemander une vérité qu'on connaît.
   *
   * `hasUnseen` est RECALCULÉ, et pas seulement `seen` : c'est lui qui décide de
   * l'anneau de l'auteur quand il a plusieurs stories, et le laisser à sa valeur
   * d'avant ferait dire au bandeau qu'il reste du non-vu là où il n'y en a plus.
   */
  useEffect(
    () =>
      ecouterStoriesVues((storyId) => {
        setEtat((precedent) => {
          if (precedent.bandeau === null) return precedent;
          let touche = false;
          const items = precedent.bandeau.items.map((entree) => {
            if (!entree.stories.some((s) => s.id === storyId && !s.seen)) return entree;
            touche = true;
            const stories = entree.stories.map((s) => (s.id === storyId ? { ...s, seen: true } : s));
            return { ...entree, stories, hasUnseen: stories.some((s) => !s.seen) };
          });
          // Rien à changer : on rend l'état PRÉCÉDENT, pour ne pas re-rendre le fil
          // entier à chaque story lue d'une traversée.
          return touche ? { ...precedent, bandeau: { ...precedent.bandeau, items } } : precedent;
        });
      }),
    [],
  );

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

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ PUBLIER, ET VOIR SA PUBLICATION SANS RECHARGER                           ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur : « la création de la publication dans le fil d'actualité ne marche
   * pas ».
   *
   * LA PUBLICATION CRÉÉE EST INSÉRÉE TELLE QUE LE SERVEUR LA REND, jamais telle
   * qu'on l'a envoyée. `relativeTime`, `reaction.actionLabel`, `isAuthor` et le
   * vocabulaire de réaction du type sont composés CÔTÉ SERVEUR — les fabriquer ici
   * ferait afficher « à l'instant » sur une horloge locale décalée, et un libellé
   * de réaction qui changerait au premier rechargement. C'est la même règle que
   * `commenter` dans `use-publication.ts`, et pour les mêmes raisons.
   *
   * `postDetailResponseSchema` rend `postCardSchema` ÉTENDU — un sur-ensemble de ce
   * que le fil porte — donc l'insertion en tête est exacte, pas approchée.
   *
   * Un `429` n'est PAS rejoué : le plafond est de dix publications par heure (§2.4),
   * et réessayer tout seul le consommerait deux fois.
   */
  const publier = useCallback(async (input: CreatePost): Promise<FilEchec | null> => {
    try {
      const { post } = await createPost(input);
      setEtat((p) =>
        p.feed === null ? p : { ...p, feed: { ...p.feed, items: [post, ...p.feed.items] } },
      );
      return null;
    } catch (error) {
      return echecDe(error);
    }
  }, []);

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ VOTER SUR LE SONDAGE D'UNE PUBLICATION                                  ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * LA RÉPONSE DU SERVEUR REMPLACE LE SONDAGE, elle ne le corrige pas par petites
   * touches. Voter change QUATRE choses à la fois — mes options, le compte de
   * chacune, le total, et la VISIBILITÉ des résultats, qui passe de masquée à
   * visible — et recomposer ces quatre-là à la main, c'est se tromper sur l'une.
   * `POST /polls/:id/vote` rend le sondage entier : on le pose.
   *
   * Pas de mise à jour optimiste ici, contrairement à la réaction : tant qu'on n'a
   * pas voté, les comptes sont `null` et il n'y a RIEN à anticiper — on ne connaît
   * pas les chiffres qu'on ferait bouger. Afficher un total deviné puis le corriger
   * serait montrer un résultat faux à qui venait justement de gagner le droit de le
   * voir.
   */
  const voterSondage = useCallback(
    async (pollId: string, optionIds: readonly string[]): Promise<FilEchec | null> => {
      try {
        /**
         * `communityId` EST RETIRÉ, pas laissé à `undefined` : la réponse de vote
         * porte un champ de plus que la carte — c'est un écart déjà consigné dans
         * `pollDetailResponseSchema` — et `postPollSchema` est `.strict()`. Le
         * garder ferait traîner une clé que rien ne lit et que le schéma refuse.
         */
        const { communityId: _communityId, ...sondage } = await votePoll(pollId, optionIds);
        setEtat((p) => {
          if (p.feed === null) return p;
          return {
            ...p,
            feed: {
              ...p.feed,
              items: p.feed.items.map((item) =>
                item.poll?.id === pollId
                  ? { ...item, poll: sondage }
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

  /**
   * ╔═══════════════════════════════════════════════════════════════════════╗
   * ║ UN COMMENTAIRE DE PLUS — ET LE COMPTEUR QUI LE DIT                       ║
   * ╚═══════════════════════════════════════════════════════════════════════╝
   *
   * MESURÉ au navigateur : la fenêtre titrait « Commentaires · 2 » en affichant
   * quatre commentaires, dont deux venaient d'être écrits. `commentCount` est celui
   * du SERVEUR, relevé au chargement du fil, et rien ne le bougeait ensuite.
   *
   * ON INCRÉMENTE ICI, et c'est l'EXCEPTION à la règle qu'applique
   * `basculerReaction` juste au-dessus (« pas de mise à jour optimiste »). La
   * différence est que la réaction a une route qui REND le compteur relu, alors
   * que `POST /comments` ne rend que le commentaire. Sans ce +1, le seul moyen de
   * voir le bon nombre serait de recharger le fil entier — pour un chiffre que
   * l'écran a déjà sous les yeux, puisqu'il vient d'afficher la ligne.
   *
   * ÇA PEUT DÉRIVER si un autre membre commente au même instant, et c'est assumé :
   * le prochain chargement du fil recale. Un compteur en retard d'une unité sur
   * une seconde est moins faux qu'un compteur qui ignore ce que le membre vient
   * d'écrire.
   */
  /**
   * ╔═══════════════════════════════════════════════════════════════════════╗
   * ║ LE SIGNET — ON POSE CE QUE LE SERVEUR REND, PAS CE QU'ON A DEMANDÉ       ║
   * ╚═══════════════════════════════════════════════════════════════════════╝
   *
   * Les deux routes rendent `{ bookmarked }`, et c'est CETTE valeur qui est posée.
   * Basculer localement donnerait un signet allumé sur un appel qui a échoué — et
   * le membre croirait avoir gardé une publication qu'il ne retrouvera pas dans
   * « Enregistrés ».
   */
  const basculerSignet = useCallback(
    async (postId: string, dejaEnregistre: boolean): Promise<FilEchec | null> => {
      try {
        const { bookmarked } = dejaEnregistre
          ? await unbookmarkPost(postId)
          : await bookmarkPost(postId);
        setEtat((p) => {
          if (p.feed === null) return p;
          return {
            ...p,
            feed: {
              ...p.feed,
              items: p.feed.items.map((item) =>
                item.id === postId ? { ...item, bookmarked } : item,
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

  /**
   * SUPPRIMER — et retirer la carte du fil DÈS QUE LE SERVEUR A RÉPONDU.
   *
   * La suppression est LOGIQUE côté serveur (§2.4) : la ligne reste, son
   * `deleted_at` est posé. Rien ne la renverra donc dans une page suivante, et la
   * retirer ici est fidèle — contrairement à un retrait optimiste AVANT la
   * réponse, qui ferait disparaître une publication que l'API aurait refusé de
   * supprimer.
   */
  const supprimer = useCallback(async (postId: string): Promise<FilEchec | null> => {
    try {
      await deletePost(postId);
      setEtat((p) => {
        if (p.feed === null) return p;
        return {
          ...p,
          feed: { ...p.feed, items: p.feed.items.filter((item) => item.id !== postId) },
        };
      });
      return null;
    } catch (error) {
      return echecDe(error);
    }
  }, []);

  /**
   * MODIFIER — et REMPLACER la carte par celle que le serveur rend.
   *
   * `PATCH /posts/:id` rend le détail entier, donc la carte recalculée : extrait
   * retaillé, médias réordonnés, guides résolus, sondage reconstruit. Recoudre à
   * la main ce qu'on croit avoir changé ferait diverger l'écran du service au
   * premier champ que le serveur recompose seul — et il en recompose plusieurs.
   */
  const modifier = useCallback(
    async (postId: string, patch: UpdatePost): Promise<FilEchec | null> => {
      try {
        const { post } = await updatePost(postId, patch);
        setEtat((p) => {
          if (p.feed === null) return p;
          return {
            ...p,
            feed: {
              ...p.feed,
              items: p.feed.items.map((item) => (item.id === postId ? post : item)),
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

  const marquerCommentaire = useCallback((postId: string): void => {
    setEtat((p) => {
      if (p.feed === null) return p;
      return {
        ...p,
        feed: {
          ...p.feed,
          items: p.feed.items.map((item) =>
            item.id === postId ? { ...item, commentCount: item.commentCount + 1 } : item,
          ),
        },
      };
    });
  }, []);

  return {
    ...etat,
    ...donnees,
    basculerReaction,
    publier,
    voterSondage,
    marquerCommentaire,
    basculerSignet,
    supprimer,
    modifier,
  };
}
