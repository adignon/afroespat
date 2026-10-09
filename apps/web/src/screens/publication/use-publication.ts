'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { hasAccessToken, resumeSession } from '@/lib/api/index';
import type { CommentSort, PostDetailResponse } from '@app/shared';
import { createComment, fetchComments, fetchPost } from '../accueil/api';
import { commentairesA02From } from './from-api';
import { echecDe, type FilEchec } from './echec';

/**
 * L'ÉTAT DE `/publications/:id`, ET CELUI DE LA FENÊTRE DE COMMENTAIRES DU FIL.
 *
 * Un seul crochet pour les deux, et ce n'est pas une économie : A02 et A01C
 * montrent LE MÊME fil de commentaires d'une publication, par la même route
 * (`GET /comments?subjectType=POST&subjectId=…`). Deux crochets, ce serait deux
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

export function usePublication(postId: string | null, avecPublication: boolean) {
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
      if (postId === null) {
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

        if (avecPublication) {
          const detail = await fetchPost(postId, signal);
          if (signal.aborted) return;
          setEtat({ pret: true, chargement: false, echec: null, post: detail.post });
          setFil(detail.comments);
          return;
        }

        const comments = await fetchComments('POST', postId, undefined, signal, tri);
        if (signal.aborted) return;
        setEtat({ pret: true, chargement: false, echec: null, post: null });
        setFil(comments);
      } catch (error) {
        if (signal.aborted) return;
        setFil(null);
        setEtat({ pret: true, chargement: false, echec: echecDe(error), post: null });
      }
    },
    [postId, avecPublication, tri],
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
      if (postId === null) return null;
      try {
        const { comment } = await createComment({
          subjectType: 'POST',
          subjectId: postId,
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
            items: courant.items.map((racine) =>
              racine.id === parent
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
    [postId],
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
    if (postId === null || fil === null || fil.nextCursor === null || suiteEnCours) return null;
    setSuiteEnCours(true);
    try {
      const suite = await fetchComments('POST', postId, fil.nextCursor, undefined, tri);
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
  }, [fil, postId, suiteEnCours, tri]);

  const commentaires = useMemo(
    () => (fil === null ? [] : commentairesA02From(fil.items)),
    [fil],
  );

  return { ...etat, fil, commentaires, commenter, tri, setTri, chargerSuite, suiteEnCours };
}
