'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TopicDetailResponse } from '@app/shared';
import { hasAccessToken, resumeSession } from '@/lib/api/index';
import { deleteTopic, fetchTopic, updateTopic } from './api';
import { repliesFrom } from './from-api';
import { echecDe, type ReseauEchec } from './echec';
import { panelReseaux, rail } from './chrome';
import type { A09Data, CommentRowView } from '../a09/data';
import { modActions, shortcuts } from '../a09/data';

/**
 * L'ÉTAT DE A09 — un sujet et ses réponses.
 *
 * ── LA PORTE DE DERRIÈRE, ET POURQUOI ON NE LA FORCE PAS ───────────────────
 *
 * `GET /topics/:id` atteint un sujet par son identifiant propre, sans passer par
 * son réseau. C'est le chemin qu'une fuite emprunte : il ne ressemble pas à une
 * lecture de réseau, donc on oublie de le garder.
 *
 * Il EST gardé — mesuré, il refuse un non-membre d'un réseau PUBLIC par le même
 * `403 FORBIDDEN` / `NOT_A_MEMBER` que les sept routes de contenu. Ce hook
 * LAISSE REMONTER ce refus tel quel (`refuse`) au lieu de le convertir en page
 * vide, et il ne tente aucun repli : il n'existe aucune autre route qui rendrait
 * ce sujet, et en chercher une serait exactement contourner la garde par le
 * front.
 *
 * ── LES TROIS DROITS VIENNENT DU SERVEUR, À CHAQUE LECTURE ─────────────────
 *
 * `canResolve`, `canPin` et `canEdit` sont recalculés par le serveur à chaque
 * `GET /topics/:id` — `canEdit` dépend même d'une fenêtre de quinze minutes qui
 * se referme pendant qu'on lit la page. On les LIT pour montrer ou cacher les
 * actions ; on ne les recalcule pas depuis un rôle gardé en mémoire, et on ne
 * s'en sert jamais pour AUTORISER : le geste est tenté, et c'est le serveur qui
 * refuse si le droit a changé entre-temps.
 */
export interface SujetEtat {
  readonly pret: boolean;
  readonly chargement: boolean;
  readonly echec: ReseauEchec | null;
  readonly sujet: TopicDetailResponse | null;
  readonly data: A09Data;
  /** Le sujet est REFUSÉ : le lecteur n'est pas membre de son réseau. */
  readonly refuse: boolean;
  /** Le sujet est introuvable — ou son réseau est `INVITE_ONLY`, et on ne le dira pas. */
  readonly introuvable: boolean;
  /**
   * Épingler. Les quatre valeurs sont celles de `TopicPinKind`, et il n'y en a
   * pas d'autre : `NONE | RULES | RESOURCE | WELCOME`. Pas d'« IMPORTANT ».
   */
  readonly epingler: (kind: 'NONE' | 'RULES' | 'RESOURCE' | 'WELCOME') => Promise<void>;
  readonly resoudre: () => Promise<void>;
  /**
   * `masquer` est le SEUL geste qui retire un sujet de la vue.
   *
   * IL N'Y A PAS DE « CLORE », et ce n'est pas un oubli de ce fichier :
   * `TopicStatus` vaut `OPEN | RESOLVED | ARCHIVED`, sans état « clos », alors
   * que la maquette dessine l'action « Clore le sujet » et que le service
   * annonce en commentaire qu'« un modérateur clôt ». Écrire un `clore()` qui
   * enverrait `status: 'CLOSED'` compilerait contre un enum inventé et
   * échouerait en `400` à la première pression. L'écart est remonté au back
   * plutôt que comblé ici.
   */
  readonly masquer: () => Promise<void>;
}

export function useSujet(topicId: string): SujetEtat {
  const [sujet, setSujet] = useState<TopicDetailResponse | null>(null);
  const [chargement, setChargement] = useState(true);
  const [pret, setPret] = useState(false);
  const [echec, setEchec] = useState<ReseauEchec | null>(null);
  const [tick, setTick] = useState(0);

  const reprise = useRef<Promise<boolean> | null>(null);

  useEffect(() => {
    if (topicId === '') return;
    const ac = new AbortController();
    let vivant = true;
    setChargement(true);

    void (async () => {
      try {
        if (!hasAccessToken()) {
          reprise.current ??= resumeSession();
          await reprise.current;
        }
        const t = await fetchTopic(topicId, ac.signal);
        if (!vivant) return;
        setSujet(t);
        setEchec(null);
      } catch (e) {
        if (ac.signal.aborted || !vivant) return;
        /**
         * Le refus est CONSERVÉ tel quel. Aucun repli, aucune seconde route
         * essayée : il n'en existe pas, et en chercher une serait contourner
         * par le front la garde que le serveur tient.
         */
        setSujet(null);
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
  }, [topicId, tick]);

  const comments: readonly CommentRowView[] = useMemo(
    () => (sujet === null ? [] : repliesFrom(sujet.replies)),
    [sujet],
  );

  const data: A09Data = useMemo(
    () => ({ rail, shortcuts, panelReseaux, comments, modActions }),
    [comments],
  );

  /**
   * Les quatre gestes de modération. Tous TENTENT, aucun ne vérifie d'abord.
   *
   * La réponse de `PATCH /topics/:id` est le sujet ENTIER remis à jour — avec
   * ses trois `can*` recalculés. On la range donc telle quelle plutôt que de
   * modifier à la main l'état qu'on avait : après une clôture, `canResolve` peut
   * avoir changé, et le deviner serait se tromper une fois sur deux.
   */
  const patch = useCallback(
    async (corps: Parameters<typeof updateTopic>[1]) => {
      try {
        setSujet(await updateTopic(topicId, corps));
        setEchec(null);
      } catch (e) {
        setEchec(echecDe(e));
      }
    },
    [topicId],
  );

  return {
    pret,
    chargement,
    echec,
    sujet,
    data,
    refuse: echec?.notMember === true,
    introuvable: echec?.notFound === true,
    epingler: useCallback(
      (kind: 'NONE' | 'RULES' | 'RESOURCE' | 'WELCOME') => patch({ pinKind: kind }),
      [patch],
    ),
    resoudre: useCallback(() => patch({ status: 'RESOLVED' }), [patch]),
    masquer: useCallback(async () => {
      try {
        await deleteTopic(topicId);
        setTick((t) => t + 1);
      } catch (e) {
        setEchec(echecDe(e));
      }
    }, [topicId]),
  };
}
