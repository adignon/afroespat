'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ScreenFrames } from '@/screens/frames';
import { A13Desktop } from '@/screens/a13/desktop.generated';
import { A13Mobile } from '@/screens/a13/mobile.generated';
import { useStory } from '@/screens/story/use-story';
import { useVoisinsDeStory } from '@/screens/story/use-voisins';
import { ActionsStoryAuteur } from '@/components/actions-story-auteur';

/**
 * A13 — une story en lecture plein écran, BRANCHÉE SUR L'API.
 *
 * C'est le seul écran de ce lot qui est ENTIÈREMENT piloté par la donnée : les
 * dix-sept prises de `st` portent l'auteur, le texte, la pastille, la ligne d'état
 * et les deux votes, et toutes viennent de `GET /stories/:id`.
 *
 * ── AUCUN COMPTEUR DE VUES ────────────────────────────────────────────────
 *
 * La maquette l'écrit elle-même sous sa planche — « un composant, trois types ·
 * aucun compteur de vues » — et la règle dure (`00` §49, 04 §2.6) l'interdit sur
 * tout contenu. Ce qui se compte ici, ce sont les VOTES : un jugement donné
 * volontairement, pas une mesure d'attention subie. La règle n'est pas tenue par
 * cet écran mais À LA FRONTIÈRE : `storyBubbleSchema` est `.strict()`, donc un
 * `viewCount` greffé sur la réponse est refusé avant d'arriver jusqu'ici. C'est le
 * seul endroit où elle peut être tenue pour TOUS les écrans à la fois.
 *
 * ── LE VOTE ───────────────────────────────────────────────────────────────
 *
 * Les deux boutons envoient le `kind` que LA STORY porte (`votes.positiveKind` /
 * `negativeKind`), jamais un `kind` choisi d'après le type dans le front : §2.6 en
 * accepte deux par type et le serveur refuse `KIND_NOT_ALLOWED_FOR_TYPE` (mesuré
 * 422). Les compteurs affichés sont ceux que le serveur renvoie après le vote — pas
 * d'incrément local, qui divergerait dès qu'un autre membre vote en même temps.
 *
 * Les boutons ne sont PAS branchés dans le JSX transcodé : la maquette ne pose
 * aucun `onClick` dessus, et le transcodeur n'invente pas de comportement. Le
 * basculement est donc prêt (`basculerVote`) et attend soit un marqueur déclaré
 * dans `tools/screens/03-accueil.mjs`, soit une décision du porteur. Remonté.
 *
 * ── LE FOND ───────────────────────────────────────────────────────────────
 *
 * Le fond de PAGE est celui de la maquette (`#101A17`) : une story se lit comme une
 * photo, pas comme une page. Le fond de la CARTE, lui, est la couleur choisie par
 * l'auteur, servie telle quelle et jamais assombrie (T1 §1.2).
 *
 * Une story à FOND IMAGE reste indessinable : `backgroundUrl` vaut toujours `null`,
 * le service ne résolvant jamais `backgroundAssetId` en URL. C'est du back, et
 * c'est remonté.
 */
/**
 * QUINZE SECONDES — la durée que `motion.js` déclare sous `storyProgress`, et
 * que la barre de progression peint. Un seul nombre pour les deux : deux
 * valeurs finiraient par diverger, et la barre mentirait sur le temps restant.
 */
const DUREE_STORY_MS = 15_000;

export function StoryEcran({
  storyId,
  enFenetre = false,
}: {
  readonly storyId: string;
  /**
   * ── LE FOND EST TRANSPARENT DANS UNE FENÊTRE ───────────────────────────
   *
   * Le porteur : « Le background est transparent ? » Il ne l'était pas :
   * `#101A17` opaque, mesuré. Posé dans une fenêtre, cet aplat recouvrait le
   * voile — et donc la page de dessous, que le porteur veut « voir légèrement ».
   *
   * Sur une PAGE entière, en revanche, il faut bien un fond : transparent, on
   * verrait le blanc du document. Les deux cas existent — l'adresse directe sert
   * la page, le clic depuis le fil sert la fenêtre — donc la prise aussi.
   */
  readonly enFenetre?: boolean;
}) {
  /**
   * ── LES VOISINS, POUR « PRÉCÉDENT » ET « SUIVANT » ───────────────────────
   *
   * Le porteur : « Je parle des boutons next […] le clic sur les écrans gauche ou
   * droite ou sur les boutons next ou preview doivent animer parfaitement les
   * stories et afficher celui sélectionné. »
   *
   * `GET /stories/:id` NE REND PAS DE VOISINS — vérifié dans
   * `storyDetailResponseSchema`. Le RUBAN, lui, les connaît : c'est lui qui
   * ordonne les stories du jour, et c'est exactement ce que les deux panneaux
   * « Aïcha D. » et « Kofi B. » de la planche représentent. On le lit donc, plutôt
   * que d'ajouter une route pour une information déjà servie.
   */
  /**
   * L'IDENTIFIANT COURANT VIT DANS L'ÉTAT, et non seulement dans l'URL : passer
   * d'une story à l'autre ne doit pas re-naviguer, sans quoi l'interception de
   * route poserait une fenêtre sur la page de story déjà ouverte — mesuré.
   */
  const router = useRouter();

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ FERMER LA STORY — LA CROIX ÉTAIT UN DESSIN                              ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur : « Le bouton close ne fonctionne pas ? » MESURÉ : la croix de
   * l'en-tête est un `<span>` dans les deux planches — aucun geste, aucun nom
   * accessible. Le transcodeur en fait un vrai bouton ; voici ce qu'il appelle.
   *
   * `router.back()` plutôt qu'une adresse fixe : on revient d'où l'on vient — le
   * fil, un profil, une ville. Poser « /accueil » ferait d'une fermeture une
   * NAVIGATION, et le membre perdrait sa place. Le repli existe parce que
   * `back()` ne fait rien quand l'onglet s'est ouvert DIRECTEMENT sur l'adresse
   * d'une story : il n'y a alors aucune page précédente, et la croix paraîtrait
   * morte — ce qui est précisément le défaut qu'on corrige.
   */
  const onFermer = useCallback((): void => {
    if (window.history.length > 1) {
      router.back();
      return;
    }
    router.push('/accueil');
  }, [router]);

  const [idCourant, setIdCourant] = useState(storyId);
  /** La story d'abord : les voisins se filtrent sur SON type. */
  const { story } = useStory(idCourant);
  const voisins = useVoisinsDeStory(idCourant, setIdCourant, story?.typeStory ?? null);

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ QUINZE SECONDES, PUIS LA STORY SUIVANTE                                 ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur : « La barre de progression doit progresser pendant 15 s et
   * automatiquement slide right pour aller vers le story suivant. »
   *
   * MESURÉ avant : après huit secondes, l'URL n'avait pas bougé — aucun minuteur
   * n'existait.
   *
   * La barre, elle, est animée en CSS (`dp-story-progress`, même durée) : une
   * animation ne sait pas changer de story, et un minuteur ne sait pas peindre.
   * Les deux portent la MÊME durée, déclarée une fois dans `motion.js` sous
   * `storyProgress`.
   *
   * LE MINUTEUR SE REMET À ZÉRO à chaque changement de story — `idCourant` est
   * dans ses dépendances — et S'ARRÊTE quand il n'y a plus de suivant : on reste
   * alors sur la dernière, plutôt que de boucler sans que personne l'ait demandé.
   */
  const suivantId = voisins.suivant?.id ?? null;

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LE MINUTEUR S'ARRÊTE PENDANT QU'ON ÉCRIT, ET REPREND OÙ IL EN ÉTAIT     ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur : « Le focus dans l'input de message doit stopper temporairement la
   * progress bar. » La barre est peinte par une animation CSS, qu'un
   * `animation-play-state` met en pause ; mais c'est CE MINUTEUR qui fait changer
   * de story, et sans lui la barre s'arrêterait au-dessus d'une story qui part
   * quand même — un message à moitié écrit disparaissant sous les doigts.
   *
   * ── POURQUOI UN RESTE, ET PAS UN SIMPLE REDÉMARRAGE ───────────────────────
   *
   * Reposer quinze secondes à chaque sortie du champ donnerait à la barre et au
   * minuteur deux temps différents : la barre reprend à 60 %, le minuteur
   * repartirait de zéro, et la story changerait six secondes après que la barre a
   * touché le bout. On retient donc ce qui RESTE à courir, et on repart de là.
   *
   * Un `useRef` et non un état : l'écrire dans l'état relancerait cet effet, qui
   * le réécrirait, indéfiniment.
   */
  const enPause = story?.barrePause === 'oui';
  const resteAvantSuivant = useRef(DUREE_STORY_MS);
  useEffect(() => {
    resteAvantSuivant.current = DUREE_STORY_MS;
  }, [idCourant]);

  useEffect(() => {
    if (suivantId === null || enPause) return undefined;
    const depart = Date.now();
    const minuteur = setTimeout(() => {
      setIdCourant(suivantId);
      window.history.replaceState(null, '', `/stories/${suivantId}`);
    }, resteAvantSuivant.current);
    return () => {
      clearTimeout(minuteur);
      resteAvantSuivant.current = Math.max(0, resteAvantSuivant.current - (Date.now() - depart));
    };
  }, [idCourant, suivantId, enPause]);

  /**
   * TANT QUE LA STORY N'EST PAS LÀ, ON NE DESSINE PAS DE STORY.
   *
   * Pas de carte d'exemple pendant le chargement, et surtout pas celle de la
   * maquette : elle affirmerait qu'Aïcha Diop a publié un conseil sur Visale. Le
   * cadre attend sa donnée — c'est la même discipline que le fil, qui ne sert plus
   * de fausses publications depuis le lot précédent.
   *
   * ╔════════════════════════════════════════════════════════════════════════════╗
   * ║ MAIS LE CADRE VIDE NE SERVAIT PAS UN SEUL MOT, ET C'EN EST UN DÉFAUT      ║
   * ╚════════════════════════════════════════════════════════════════════════════╝
   *
   * Les deux cadres valaient `null`. Mesuré en sondant LES QUATRE-VINGT-DOUZE
   * routes du produit au `curl` : `/stories/:id` répondait **200 en servant UN
   * SEUL MOT** — « DisaporyPlus », le titre du document — et c'était la seule
   * route du dépôt dans ce cas. Les 404 en servent autant, ce qui est normal ;
   * une route qui répond 200 ne doit pas leur ressembler.
   *
   * Ce que ça donne : une page NOIRE ET MUETTE. Aucun titre, aucun texte, rien
   * qu'un lecteur d'écran puisse annoncer, et rien qui distingue « ça charge » de
   * « c'est cassé ». A13 n'a pas de coquille à peindre pour s'en sortir — pas de
   * rail, pas de panneau, pas d'onglets : une story EST son contenu. C'est ce qui
   * la distingue de la coquille vide des réseaux, où le cadre existait et où il
   * suffisait de le peindre.
   *
   * La réponse est donc la plus petite qui soit honnête : DIRE QU'ON ATTEND. Un
   * `role="status"`, le mot « Chargement de la story… », dans la couleur claire
   * que la maquette emploie sur ce fond sombre (`#CFE3DA`, le même que le bas du
   * rail). Rien n'est inventé sur la story elle-même — ni auteur, ni texte, ni
   * couleur d'auteur.
   */
  if (story === null) {
    const attente = (
      <p
        role="status"
        style={{ padding: '24px', color: '#CFE3DA', fontSize: '14px', textAlign: 'center' }}
      >
        Chargement de la story…
      </p>
    );
    return (
      <ScreenFrames
        screen="A13"
        background={enFenetre ? 'transparent' : '#101A17'}
        desktop={attente}
        mobile={attente}
      />
    );
  }

  /**
   * `onFermer` est ajouté ICI, et aux DEUX prises : `storyMain` est la boucle que
   * la planche parcourt, `st` la story de tête. Les deux désignent la même story
   * et doivent porter le même geste de fermeture.
   */
  const affichee = { ...story, onFermer };
  const data = {
    storyMain: [affichee],
    st: affichee,
    /**
     * EN FENÊTRE, LA COQUE EST TRANSPARENTE. `#101A17` est ce que la planche
     * peint, et c'est juste pour une page entière ; posé sur le fil, cet aplat
     * recouvrait le voile — et donc la page que le porteur veut voir derrière.
     */
    fondEcran: enFenetre ? 'transparent' : '#101A17',
    ...voisins.prises,
  };

  return (
    <>
      <ScreenFrames
        screen="A13"
        background={enFenetre ? 'transparent' : '#101A17'}
        /**
         * ╔══════════════════════════════════════════════════════════════════════╗
         * ║ PLUS DE `key` ICI — ET C'EST CE QUI REND LE FONDU POSSIBLE           ║
         * ╚══════════════════════════════════════════════════════════════════════╝
         *
         * Le porteur : « il faut que le background se change avec une animation de
         * fade ».
         *
         * `key={idCourant}` remontait le cadre ENTIER à chaque voisin. C'était voulu
         * — une animation CSS ne rejoue que si le nœud est recréé, et c'est ainsi
         * que la barre de progression repartait — mais ça interdisait exactement ce
         * qui est demandé ici : on ne transitionne pas la couleur d'un nœud qui
         * vient de naître. Le fond sautait d'un vert profond à un rouge sombre.
         *
         * La clé est descendue sur la SEULE barre (`key={st.cle}`, posé par le
         * transcodeur) : elle repart de zéro, le cadre reste en place, et
         * `[data-story-fond]` fond une couleur dans l'autre.
         */
        /** La story est une SURFACE : elle couvre, elle ne se centre pas. Voir `ScreenFrames`. */
        pleineLargeur
        desktop={<A13Desktop {...data} />}
        mobile={<A13Mobile {...data} />}
      />
      {/* Les gestes de l'AUTEUR (garder, supprimer, historique) — AJOUT lot G. */}
      {story.isAuthor ? (
        <ActionsStoryAuteur
          storyId={idCourant}
          type={story.typeStory}
          expiree={story.expired}
          onSupprimee={onFermer}
        />
      ) : null}
    </>
  );
}
