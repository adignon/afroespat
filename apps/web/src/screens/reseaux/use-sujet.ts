'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TopicDetailResponse } from '@app/shared';
import { hasAccessToken, resumeSession } from '@/lib/api/index';
import { deleteTopic, fetchTopic, restoreTopic, updateTopic } from './api';
/**
 * `POST /comments` VIENT DU MODULE ACCUEIL, ET CE N'EST PAS UN EMPRUNT HASARDEUX.
 *
 * Les réponses d'un sujet sont des `Comment` de la table polymorphe — le service
 * les lit en `{ subjectType: 'TOPIC', subjectId }` — et la seule route qui en
 * écrit est `POST /comments`, portée par `CommentsController` du module Feed.
 * `screens/accueil/api.ts` l'appelle déjà, avec `createCommentSchema.parse`
 * avant l'envoi. En recopier un second appel dans `reseaux/api.ts` donnerait deux
 * sources pour la même route, et ce fichier dit partout ailleurs pourquoi deux
 * sources divergent toujours.
 */
import { createComment } from '../accueil/api';
import { repliesFrom, sujetTeteFrom } from './from-api';
import { echecDe, type ReseauEchec } from './echec';
import { panelReseaux, rail } from './chrome';
import type { A09Data, CommentRowView, SujetTeteView } from '../a09/data';
import { modActions, shortcuts, teteVide } from '../a09/data';

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
  /**
   * ⚠ CE N'EST PAS CE QUE LE BOUTON « MARQUER RÉSOLU » APPELLE.
   *
   * Le bouton des deux cadres passe par `data.onResoudre`, qui ajoute le verrou
   * du double clic et rend la promesse au `finally` qui le relâche. Celui-ci
   * reste exposé pour un appelant qui gérerait son attente lui-même — personne
   * ne le fait aujourd'hui, et il n'est conservé qu'avec `epingler` et
   * `masquer`, les trois gestes du panneau MODÉRATION qu'aucun écran ne branche
   * encore. À ne pas câbler en second chemin sur le même bouton : deux appels
   * pour un clic est exactement ce que le verrou évite.
   */
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
  /**
   * RÉPONDRE. Rend l'échec, ou `null` — comme `commenter()` de `usePublication`,
   * dont ce geste est le jumeau : l'appelant décide s'il met une alerte ou pas.
   */
  readonly repondre: (corps: string) => Promise<ReseauEchec | null>;
}

export function useSujet(topicId: string): SujetEtat {
  const [sujet, setSujet] = useState<TopicDetailResponse | null>(null);
  const [chargement, setChargement] = useState(true);
  const [pret, setPret] = useState(false);
  const [echec, setEchec] = useState<ReseauEchec | null>(null);
  const [tick, setTick] = useState(0);
  /** Le brouillon de réponse, et le verrou du double envoi. */
  const [reponseTexte, setReponseTexte] = useState('');
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [resolutionEnCours, setResolutionEnCours] = useState(false);

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

  const tete: SujetTeteView = useMemo(
    () => (sujet === null ? teteVide : sujetTeteFrom(sujet)),
    [sujet],
  );

  /**
   * RÉPONDRE, PUIS RELIRE LE SUJET — on n'insère pas la réponse à la main.
   *
   * `usePublication.commenter()` insère le commentaire que le serveur rend, et
   * c'est juste là-bas : la fenêtre A01C lit `GET /comments`, donc la forme reçue
   * à la création est EXACTEMENT celle de la liste.
   *
   * Ici elles diffèrent. `POST /comments` rend un `CommentView` (avec
   * `relativeTime`, `canEdit`, `isAuthor`, `replies`) ; `GET /topics/:id` rend un
   * `TopicReply`, qui n'a que cinq champs. Fabriquer l'un depuis l'autre
   * demanderait d'inventer les champs manquants — et `replyCount` resterait
   * périmé dans la tête. On relit donc le sujet, qui est la SEULE source de ses
   * réponses, et le `tick` existe déjà pour ça (`masquer` l'emploie).
   *
   * Un `429` n'est PAS rejoué : voir le même choix dans `usePublication`.
   */
  const repondre = useCallback(
    async (corps: string): Promise<ReseauEchec | null> => {
      if (topicId === '') return null;
      try {
        await createComment({ subjectType: 'TOPIC', subjectId: topicId, body: corps });
        setTick((t) => t + 1);
        return null;
      } catch (e) {
        return echecDe(e);
      }
    },
    [topicId],
  );

  const onEnvoyerReponse = useCallback((): void => {
    const corps = reponseTexte.trim();
    if (corps === '' || envoiEnCours) return;
    setEnvoiEnCours(true);
    void repondre(corps)
      .then((e) => {
        /**
         * LE BROUILLON N'EST VIDÉ QUE SI L'ENVOI A PASSÉ. Le vider d'abord
         * perdrait le texte sur un `429` ou une coupure de réseau — et c'est
         * précisément quand on perd le plus à le perdre.
         */
        if (e === null) setReponseTexte('');
        else setEchec(e);
      })
      .finally(() => setEnvoiEnCours(false));
  }, [envoiEnCours, reponseTexte, repondre]);

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

  /**
   * « Marquer résolu ». Le bouton est MONTRÉ d'après `canResolve` et ÉTEINT
   * pendant l'envoi comme sur un sujet qui n'est plus ouvert — repatcher
   * `RESOLVED` sur un sujet résolu est un appel qui ne dit rien.
   *
   * `canResolve` est un RÔLE (auteur ou modérateur), pas un niveau : l'éteindre
   * est ce que `lib/capacites.ts` fait pour les niveaux, et ici c'est le serveur
   * qui vient de le calculer, à cette lecture-ci.
   */
  const onResoudre = useCallback((): void => {
    if (resolutionEnCours) return;
    setResolutionEnCours(true);
    void patch({ status: 'RESOLVED' }).finally(() => setResolutionEnCours(false));
  }, [patch, resolutionEnCours]);

  /**
   * ╔══════════════════════════════════════════════════════════════════════╗
   * ║ LA CARTE « MODÉRATION » — CALCULÉE, ET POUR L'ÉQUIPE SEULEMENT        ║
   * ╚══════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur : « La vue détails des sujets aussi n'est pas faite. » La carte
   * lisait la constante `modActions` de `a09/data.ts` — trois entrées SANS
   * geste — et elle était montrée à TOUT lecteur, membre ordinaire compris.
   *
   * Elle suit maintenant `canPin`, que le serveur calcule (propriétaire ou
   * modérateur du réseau) : vide pour les autres, et l'adaptation
   * `RV_SUJET_MODERATION` retire alors la carte. Chaque entrée a son geste :
   *
   *   · « Épingler » / « Désépingler » — `pinKind` RESSOURCE ou rien ; §2.3
   *     borne à cinq, et le refus `PIN_LIMIT` s'affiche tel quel ;
   *   · « Clore le sujet » — `RESOLVED` : `ARCHIVED` est réservé à la tâche
   *     d'archivage (le service répond `SYSTEM_ONLY`), et clore une question
   *     est ce que « résolu » veut dire ici ;
   *   · « Masquer » / « Remettre » — `DELETE /topics/:id` et sa restauration,
   *     dans la fenêtre de sept jours que le serveur tient (`canUnhide`).
   */
  const actionsModeration = useMemo(() => {
    if (sujet === null || !sujet.canPin) return [] as typeof modActions;
    const [epingle, clore, oeil] = modActions;
    return [
      {
        label: sujet.pinKind === 'NONE' ? 'Épingler' : 'Désépingler',
        icon: epingle?.icon ?? '',
        onClick: () => {
          void patch({ pinKind: sujet.pinKind === 'NONE' ? 'RESOURCE' : 'NONE' });
        },
      },
      {
        label: 'Clore le sujet',
        icon: clore?.icon ?? '',
        onClick:
          sujet.status === 'OPEN'
            ? () => {
                void patch({ status: 'RESOLVED' });
              }
            : undefined,
      },
      sujet.hidden
        ? {
            label: 'Remettre',
            icon: oeil?.icon ?? '',
            onClick: sujet.canUnhide
              ? () => {
                  void restoreTopic(topicId)
                    .then((t) => {
                      setSujet(t);
                    })
                    .catch((e: unknown) => {
                      setEchec(echecDe(e));
                    });
                }
              : undefined,
          }
        : {
            label: 'Masquer',
            icon: oeil?.icon ?? '',
            onClick: () => {
              void deleteTopic(topicId)
                .then(() => {
                  setTick((t) => t + 1);
                })
                .catch((e: unknown) => {
                  setEchec(echecDe(e));
                });
            },
          },
    ];
  }, [patch, sujet, topicId]);

  const data: A09Data = useMemo(
    () => ({
      rail,
      shortcuts,
      panelReseaux,
      comments,
      modActions: actionsModeration,
      sujet: tete,
      reponseTexte,
      onReponseTexte: (event: { target: { value: string } }) => setReponseTexte(event.target.value),
      onEnvoyerReponse,
      reponseBloquee: envoiEnCours || reponseTexte.trim() === '',
      resoudreVisible: sujet?.canResolve === true,
      resoudreBloque: resolutionEnCours || sujet === null || sujet.status !== 'OPEN',
      onResoudre,
    }),
    [
      actionsModeration,
      comments,
      envoiEnCours,
      onEnvoyerReponse,
      onResoudre,
      reponseTexte,
      resolutionEnCours,
      sujet,
      tete,
    ],
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
    repondre,
  };
}
