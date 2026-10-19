'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { hasAccessToken, resumeSession } from '@/lib/api/index';
import type { CommentSort, PostDetailResponse } from '@app/shared';
import {
  createComment,
  deleteComment,
  fetchComments,
  fetchPost,
  updateComment,
} from '../accueil/api';
import { commentairesA02From } from './from-api';
import { echecDe, type FilEchec } from './echec';

/**
 * L'ÉTAT DE `/publications/:id`, ET CELUI DE TOUTE FENÊTRE DE COMMENTAIRES.
 *
 * Un seul crochet pour les deux, et ce n'est pas une économie : A02 et A01C
 * montrent LE MÊME fil de commentaires, par la même route
 * (`GET /comments?subjectType=…&subjectId=…`). Deux crochets, ce serait deux
 * endroits où décider si un `429` se rejoue — et ils divergeraient.
 *
 * ── LES APPELS NE SONT PAS LES MÊMES SELON L'ÉCRAN ────────────────────────
 *
 * A02 a besoin de la PUBLICATION (`GET /posts/:id`, qui rend déjà les 20 premiers
 * commentaires) ; A01C n'a besoin que du FIL, la carte étant déjà à l'écran
 * derrière la fenêtre. `avecPublication` dit lequel, et il n'est pas là pour
 * économiser un appel : ouvrir une fenêtre de commentaires ne doit pas recharger
 * la publication que le membre regarde déjà.
 *
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ CE CROCHET PORTAIT UN `postId`. IL PORTE MAINTENANT UN SUJET.              ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « Comment commenter un guide, c'est pas dans les design ? » — puis
 * son arbitrage : EMPRUNTER A01C AU GUIDE, « c'est un dessin de la même maquette,
 * et le même geste que sur le fil ».
 *
 * CE QUI BLOQUAIT, et c'était le SEUL endroit : `subjectType: 'POST'` était FIGÉ
 * dans `commenter()`. La lecture, elle, passait déjà par `fetchComments`, dont le
 * premier paramètre est polymorphe depuis le premier jour (`POST · TOPIC · GUIDE ·
 * EVENT`, ce que `GET /comments` résume lui-même dans son sommaire). Autrement
 * dit : on pouvait LIRE les commentaires d'un guide et pas en ÉCRIRE, et rien ne
 * le disait.
 *
 * ── CE QU'UN GUIDE N'A PAS, ET QU'IL FAUT NOMMER ─────────────────────────────
 *
 * `avecPublication` N'A AUCUN ÉQUIVALENT HORS DU TYPE `POST`. Il sert à prendre
 * `GET /posts/:id`, qui rend la carte ET les vingt premiers commentaires en une
 * requête. Il n'existe pas de route qui rende un guide AVEC son fil : le détail du
 * guide vient de `GET /guides/:slug` (que `useGuide` charge déjà, pour la page
 * elle-même), et le fil de `GET /comments`. Un sujet non-`POST` lit donc TOUJOURS
 * par `GET /comments`, et `etat.post` reste `null` — ce qui est juste et non un
 * manque : la carte du sujet d'un guide se compose de ce que `useGuide` a en main.
 *
 * `avecPublication` est donc IGNORÉ quand le sujet n'est pas une publication,
 * plutôt que de lever : un appelant qui le passerait par copier-coller obtiendrait
 * un `GET /posts/<id de guide>` en `404`, c'est-à-dire un écran vide pour une
 * étourderie. Le journal du réseau montrerait l'appel ; ici, il n'a pas lieu.
 *
 * ── LE SUJET SE DÉPLIE, ET CE N'EST PAS DU STYLE ─────────────────────────────
 *
 * `charger` dépend du sujet. Un OBJET passé en prise change d'identité à chaque
 * rendu de l'appelant — `usePublication({ subjectType: 'GUIDE_PAGE', subjectId: id })`
 * est un littéral neuf à chaque fois — donc `charger` se refabriquerait, l'effet
 * repartirait, et la requête tournerait en boucle jusqu'à ce que le serveur
 * limite. Les DEUX VALEURS entrent donc seules dans les dépendances, jamais
 * l'objet. C'est la même discipline que `useGuides` s'impose pour ses trois
 * filtres, et elle est écrite là-bas pour la même raison.
 *
 * ── CE QU'IL NE FAIT PAS ──────────────────────────────────────────────────
 *
 * Aucune gestion de jeton : `resumeSession()` une fois au montage, et c'est tout.
 * Le jeton vit en mémoire et meurt avec l'onglet ; le cookie de rafraîchissement
 * dure trente jours. Sans cette reprise, un rechargement de `/publications/:id`
 * partirait sans en-tête sur une session parfaitement bonne. Rien n'entre dans
 * `localStorage`.
 *
 * Aucune décision sur le niveau. On n'écrit pas `if (level === 'L0')` avant de
 * commenter : on tente, et un `403 LEVEL_REQUIRED` porte de quoi afficher
 * l'invitation de §7.3. Un niveau lu une fois et gardé, c'est la faille de quinze
 * minutes rejouée dans le front.
 */

export interface PublicationEtat {
  readonly pret: boolean;
  readonly chargement: boolean;
  readonly echec: FilEchec | null;
  readonly post: PostDetailResponse['post'] | null;
}

/**
 * CE QU'ON COMMENTE. Les quatre valeurs sont celles de `GET /comments` et de
 * `createCommentSchema` — on ne réécrit pas l'énumération, on la reprend de
 * `fetchComments`, qui la tient de l'API.
 */
export type SujetCommente = {
  readonly subjectType: Parameters<typeof fetchComments>[0];
  readonly subjectId: string;
};

/**
 * `usePublication(sujet, avecPublication)`.
 *
 * `sujet` ACCEPTE UNE CHAÎNE, et c'est de la compatibilité, pas de la complaisance :
 * les deux appelants historiques — la page d'une publication (A02) et la fenêtre de
 * commentaires du fil — passent un identifiant de PUBLICATION, et c'est ce qu'ils
 * veulent dire. Une chaîne est donc lue comme `{ subjectType: 'POST', subjectId }`,
 * exactement l'ancien comportement, sans qu'aucun de ces appelants ne change d'une
 * ligne. Un sujet d'un AUTRE type s'écrit en entier, et le compilateur l'exige.
 */
export function usePublication(
  sujet: SujetCommente | string | null,
  avecPublication: boolean,
) {
  /**
   * LES DEUX VALEURS DU SUJET, DÉPLIÉES — voir l'en-tête. Elles sont des chaînes,
   * donc comparables par `===` dans les dépendances de `charger` ; l'objet, lui,
   * n'y entre jamais.
   */
  const subjectType = sujet === null ? null : typeof sujet === 'string' ? 'POST' : sujet.subjectType;
  const subjectId = sujet === null ? null : typeof sujet === 'string' ? sujet : sujet.subjectId;
  /**
   * LE TRI DES DEUX ONGLETS — « Pertinents » / « Récents » de la planche A01C.
   *
   * Il est DANS le crochet et non dans la page parce qu'il change ce qui est
   * chargé : `charger` en dépend, donc un changement d'onglet recharge le fil
   * depuis le serveur. Le tenir dans la page obligerait à le redescendre, et
   * l'oubli d'une dépendance donnerait un onglet qui s'allume sans rien trier —
   * exactement le défaut que ce lot vient de corriger sur le composeur de story.
   */
  const [tri, setTri] = useState<CommentSort>('RELEVANT');
  const [suiteEnCours, setSuiteEnCours] = useState(false);
  const [etat, setEtat] = useState<PublicationEtat>({
    pret: false,
    chargement: true,
    echec: null,
    post: null,
  });
  const [fil, setFil] = useState<PostDetailResponse['comments'] | null>(null);

  /**
   * La reprise de session ne doit partir QU'UNE FOIS.
   *
   * React monte deux fois sous `StrictMode` en développement. Deux
   * `resumeSession()` concurrents, c'est deux `POST /auth/refresh` — et le jeton de
   * rafraîchissement TOURNE à chaque usage : le second présenterait un jeton déjà
   * consommé, ce que la détection de rejeu traite en coupant la chaîne. Le socle
   * partage déjà un rafraîchissement en vol ; ce garde-fou le double là où l'effet
   * est déclenché.
   */
  const reprise = useRef<Promise<boolean> | null>(null);

  const charger = useCallback(
    async (signal: AbortSignal): Promise<void> => {
      if (subjectId === null || subjectType === null) {
        setEtat({ pret: true, chargement: false, echec: null, post: null });
        setFil(null);
        return;
      }
      setEtat((p) => ({ ...p, chargement: true }));
      try {
        if (!hasAccessToken()) {
          reprise.current ??= resumeSession();
          await reprise.current;
        }

        /**
         * `GET /posts/:id` N'EST DEMANDÉ QUE POUR UNE PUBLICATION. Voir l'en-tête :
         * aucune autre route ne rend un sujet AVEC son fil, et appeler celle-ci
         * avec l'identifiant d'un guide rendrait `404` — donc un écran vide pour
         * un `avecPublication` passé par étourderie.
         */
        if (avecPublication && subjectType === 'POST') {
          const detail = await fetchPost(subjectId, signal);
          if (signal.aborted) return;
          setEtat({ pret: true, chargement: false, echec: null, post: detail.post });
          setFil(detail.comments);
          return;
        }

        const comments = await fetchComments(subjectType, subjectId, undefined, signal, tri);
        if (signal.aborted) return;
        setEtat({ pret: true, chargement: false, echec: null, post: null });
        setFil(comments);
      } catch (error) {
        if (signal.aborted) return;
        setFil(null);
        setEtat({ pret: true, chargement: false, echec: echecDe(error), post: null });
      }
    },
    [subjectType, subjectId, avecPublication, tri],
  );

  useEffect(() => {
    const ac = new AbortController();
    void charger(ac.signal);
    return () => ac.abort();
  }, [charger]);

  /**
   * Commenter, puis RECALER sur ce que le serveur renvoie.
   *
   * Le commentaire créé est INSÉRÉ tel que le serveur le rend — pas tel qu'on l'a
   * envoyé. `relativeTime`, `canEdit` et `isAuthor` sont composés côté serveur, et
   * les fabriquer ici ferait apparaître « à l'instant » sur une horloge locale
   * décalée, puis changer au premier rechargement.
   *
   * Le corps passe par `createCommentSchema` AVANT l'envoi (dans `accueil/api.ts`) :
   * un texte hors bornes échoue ici, avec le nom du champ, plutôt qu'en `400` qui
   * ne dit pas lequel.
   *
   * Un `429` n'est PAS rejoué.
   */
  const commenter = useCallback(
    async (body: string, parentCommentId?: string): Promise<FilEchec | null> => {
      if (subjectId === null || subjectType === null) return null;
      try {
        const { comment } = await createComment({
          /**
           * ╔════════════════════════════════════════════════════════════════╗
           * ║ C'ÉTAIT LE SEUL `'POST'` FIGÉ DE TOUTE LA CHAÎNE               ║
           * ╚════════════════════════════════════════════════════════════════╝
           *
           * La lecture était polymorphe (`fetchComments` prend le type), l'API
           * l'est (`POST /comments` accepte `POST · TOPIC · GUIDE · EVENT`), le
           * schéma l'est (`createCommentSchema`). Seule cette ligne décidait, pour
           * tout le front, qu'on ne commente que des publications — et elle le
           * décidait en silence : un guide affichait son fil et refusait l'envoi.
           */
          subjectType,
          subjectId,
          body,
          ...(parentCommentId === undefined ? {} : { parentCommentId }),
        });
        /**
         * ╔══════════════════════════════════════════════════════════════════╗
         * ║ UNE RÉPONSE SE RANGE SOUS SON PARENT, PAS EN FIN DE LISTE        ║
         * ╚══════════════════════════════════════════════════════════════════╝
         *
         * L'insertion était la même pour les deux : un commentaire envoyé en
         * réponse à quelqu'un apparaissait comme une RACINE, sans retrait, à la
         * fin du fil — puis se replaçait au rechargement. L'écran montrait donc
         * autre chose que ce que le serveur avait enregistré.
         *
         * `parentCommentId` est celui que le SERVEUR rend, pas celui qu'on a
         * envoyé : c'est lui qui fait foi, et c'est la même règle que pour
         * `relativeTime` et `canEdit` juste au-dessus.
         */
        setFil((courant) => {
          if (courant === null) return { items: [comment], nextCursor: null };
          const parent = comment.parentCommentId;
          if (parent === null) return { ...courant, items: [...courant.items, comment] };
          return {
            ...courant,
            /**
             * `'removed' in racine` AVANT `racine.id`, et ce n'est pas une
             * précaution de typage : une ligne du fil peut être l'emplacement
             * `{ removed: true }` qu'un retrait de modération laisse, et il n'a
             * NI identifiant NI réponses. On ne peut donc pas répondre dessous —
             * le cadre n'y dessine aucun « Répondre », et le serveur ne rend pas
             * son identifiant — et le sauter est le seul comportement juste.
             */
            items: courant.items.map((racine) =>
              !('removed' in racine) && racine.id === parent
                ? { ...racine, replies: [...racine.replies, comment] }
                : racine,
            ),
          };
        });
        return null;
      } catch (error) {
        return echecDe(error);
      }
    },
    [subjectType, subjectId],
  );

  /**
   * ╔════════════════════════════════════════════════════════════════════════╗
   * ║ « VOIR N AUTRES COMMENTAIRES » — LE LIEN N'ALLAIT NULLE PART            ║
   * ╚════════════════════════════════════════════════════════════════════════╝
   *
   * La planche l'écrit en `<a href="#">`, et `nextCursor` existait depuis le
   * début sans que rien ne le lise : la fenêtre montrait les vingt premiers et
   * taisait le reste.
   *
   * ON AJOUTE À LA SUITE, on ne remplace pas : le membre a lu le haut du fil, et
   * le remplacer le renverrait au début. `nextCursor` de la nouvelle page devient
   * celui du fil — c'est lui qui dit s'il reste quelque chose après.
   */
  const chargerSuite = useCallback(async (): Promise<FilEchec | null> => {
    if (subjectId === null || subjectType === null) return null;
    if (fil === null || fil.nextCursor === null || suiteEnCours) return null;
    setSuiteEnCours(true);
    try {
      const suite = await fetchComments(subjectType, subjectId, fil.nextCursor, undefined, tri);
      setFil((courant) =>
        courant === null
          ? suite
          : { items: [...courant.items, ...suite.items], nextCursor: suite.nextCursor },
      );
      return null;
    } catch (error) {
      return echecDe(error);
    } finally {
      setSuiteEnCours(false);
    }
  }, [fil, subjectType, subjectId, suiteEnCours, tri]);


  /**
   * MODIFIER SON COMMENTAIRE (`PATCH /comments/:id`, lot G).
   *
   * Le délai de 15 minutes est celui du SERVEUR (`canEdit`, `EDIT_WINDOW_CLOSED`) :
   * le bouton ne s'offre que tant que `canEdit` est vrai, et un refus tardif remonte
   * en échec nommé. Le commentaire est remplacé tel que le serveur le rend — ses
   * réponses sont conservées, `PATCH` ne les renvoie pas.
   */
  const modifierCommentaire = useCallback(
    async (commentId: string, body: string): Promise<FilEchec | null> => {
      try {
        const { comment } = await updateComment(commentId, body);
        setFil((courant) =>
          courant === null
            ? courant
            : {
                ...courant,
                items: courant.items.map((racine) => {
                  if ('removed' in racine) return racine;
                  if (racine.id === commentId) return { ...comment, replies: racine.replies };
                  return {
                    ...racine,
                    replies: racine.replies.map((r) =>
                      !('removed' in r) && r.id === commentId ? comment : r,
                    ),
                  };
                }),
              },
        );
        return null;
      } catch (error) {
        return echecDe(error);
      }
    },
    [],
  );

  /**
   * SUPPRIMER SON COMMENTAIRE (`DELETE /comments/:id`, suppression logique).
   *
   * Une RACINE supprimée emporte ses réponses de la vue, comme le serveur les
   * masque avec elle ; le compteur de la publication descend du nombre de lignes
   * retirées.
   */
  const supprimerCommentaire = useCallback(async (commentId: string): Promise<FilEchec | null> => {
    try {
      await deleteComment(commentId);
      let retires = 0;
      setFil((courant) => {
        if (courant === null) return courant;
        const items = courant.items.flatMap((racine): typeof courant.items => {
          if ('removed' in racine) return [racine];
          if (racine.id === commentId) {
            retires += 1 + racine.replies.length;
            return [];
          }
          const reste = racine.replies.filter((r) => 'removed' in r || r.id !== commentId);
          retires += racine.replies.length - reste.length;
          return [{ ...racine, replies: reste }];
        });
        return { ...courant, items };
      });
      setEtat((e) =>
        e.post === null
          ? e
          : { ...e, post: { ...e.post, commentCount: Math.max(0, e.post.commentCount - Math.max(retires, 1)) } },
      );
      return null;
    } catch (error) {
      return echecDe(error);
    }
  }, []);

  /** Après `PATCH /posts/:id` ou un déplacement : la publication rendue remplace l'ancienne. */
  const remplacerPost = useCallback((post: PostDetailResponse['post']): void => {
    setEtat((e) => ({ ...e, post }));
  }, []);

  /** Relit la publication et son fil (après un déplacement vers un réseau, par exemple). */
  const recharger = useCallback(async (): Promise<void> => {
    await charger(new AbortController().signal);
  }, [charger]);

  const commentaires = useMemo(
    () => (fil === null ? [] : commentairesA02From(fil.items)),
    [fil],
  );

  return {
    ...etat,
    fil,
    commentaires,
    commenter,
    modifierCommentaire,
    supprimerCommentaire,
    remplacerPost,
    recharger,
    tri,
    setTri,
    chargerSuite,
    suiteEnCours,
  };
}
