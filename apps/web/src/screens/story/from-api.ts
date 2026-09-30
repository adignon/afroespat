/**
 * DE L'API VERS LES PRISES DE A13 — la story en lecture.
 *
 * Tout ce que le cadre affiche vient du serveur : l'auteur, le texte, la ligne
 * d'état (« 1er des conseils Logement aujourd'hui · 31 trouvent utile »), les deux
 * libellés de vote et leurs compteurs. Ce qui reste ici est du DESSIN — la couleur
 * de la pastille par type, et la palette d'avatars — parce qu'un code couleur n'a
 * rien à faire dans une réponse JSON.
 *
 * ── LES DEUX LIBELLÉS DE VOTE VIENNENT DU SERVEUR, ET C'EST UNE RÈGLE DURE ──
 *
 * §2.6 accepte DEUX `kind` par type de story, et le serveur refuse
 * `KIND_NOT_ALLOWED_FOR_TYPE` (mesuré 422) si l'on se trompe. On lit donc
 * `votes.positiveKind` / `votes.negativeKind` et leurs libellés plutôt que de tenir
 * une seconde table de vocabulaire dans le front — deux tables divergent toujours,
 * et celle-ci ferait proposer « Je confirme » sur une découverte.
 *
 * ── AUCUN COMPTEUR DE VUES ─────────────────────────────────────────────────
 *
 * `n1` et `n2` sont des compteurs de VOTES. Il n'existe pas de compteur de vues sur
 * une story, sur aucune route, pas même pour l'auteur (`00` §49, 04 §2.6), et
 * `storyBubbleSchema` est `.strict()` pour que l'ajout d'un `viewCount` soit refusé
 * À LA FRONTIÈRE au lieu d'arriver jusqu'à un écran qui l'afficherait.
 *
 * ── LE MUR : UNE STORY À FOND IMAGE EST INDESSINABLE ───────────────────────
 *
 * `backgroundUrl` vaut TOUJOURS `null` — le service ne résout jamais
 * `backgroundAssetId` en URL. `photo` est donc toujours faux et le fond retombe sur
 * la couleur. C'est du back, et c'est remonté : rien n'est fabriqué ici pour le
 * masquer, et surtout pas une image tirée d'ailleurs.
 */
import type { StoryDetailResponse } from '@app/shared';
import { avatarColor, initials } from '../accueil/from-api';
import type { StoryReadView } from '../a13/data';

/** Les couleurs de pastille par type, telles que la maquette les fixe. */
const STORY_PILL_FG = {
  CONSEIL: '#16785E',
  DECOUVERTE: '#16785E',
  INFORMATION: '#1F2A44',
} as const;

/**
 * Le fond quand le serveur n'en donne aucun.
 *
 * `backgroundColor` est `nullable` : une story créée avec une image de fond n'a pas
 * de couleur, et son image n'est pas résolue (voir plus haut). Plutôt qu'un cadre
 * transparent où le texte blanc deviendrait illisible, on retombe sur le PREMIER
 * ton de la palette de la maquette — celui que le composeur propose par défaut.
 * Aucune teinte n'est assombrie (T1 §1.2).
 */
const FOND_PAR_DEFAUT = '#16785E';

/** « Écrire à Aïcha… » — le PRÉNOM seul, comme la maquette l'écrit. */
function invitationEcriture(displayName: string): string {
  const prenom = displayName.trim().split(/\s+/)[0] ?? displayName;
  return `Écrire à ${prenom}…`;
}

/**
 * Le vocabulaire de vote, DÉRIVÉ du schéma partagé (`z.infer`) et jamais réécrit.
 * Un type recopié dans le front serait une seconde table, et le serveur répondrait
 * `KIND_NOT_ALLOWED_FOR_TYPE` le jour où les deux divergeraient.
 */
export type VoteKind = StoryDetailResponse['story']['votes']['positiveKind'];

/** Les prises de A13, plus ce que la page doit connaître pour agir. */
export interface StoryLue extends StoryReadView {
  readonly storyId: string;
  /** Les deux seuls `kind` que le serveur acceptera pour CETTE story (§2.6). */
  readonly positiveKind: VoteKind;
  readonly negativeKind: VoteKind;
  /** Mon vote, ou `null`. Jamais déduit du compteur. */
  readonly mine: VoteKind | null;
  /** §2.6 : le serveur dit si l'auteur accepte les messages. On ne le devine pas. */
  readonly canMessage: boolean;
  readonly expired: boolean;
  readonly isAuthor: boolean;
}

export function storyLueFrom(reponse: StoryDetailResponse): StoryLue {
  const s = reponse.story;
  return {
    bg: s.backgroundColor ?? FOND_PAR_DEFAUT,
    avBg: avatarColor(s.author.handle),
    i: initials(s.author.displayName),
    name: s.author.displayName,
    /** « Lyon · il y a 3 h · expire dans 21 h » — COMPOSÉ PAR LE SERVEUR. */
    sub: s.context.text,
    /**
     * La pastille dit le SUJET quand il y en a un — « CONSEIL · LOGEMENT ». C'est
     * ce que la maquette montre, et c'est le bon choix : savoir de quoi parle une
     * story vaut mieux que savoir de quel type elle est.
     */
    pill:
      s.categoryLabel === null
        ? s.typeLabel.toLocaleUpperCase('fr-FR')
        : `${s.typeLabel.toLocaleUpperCase('fr-FR')} · ${s.categoryLabel.toLocaleUpperCase('fr-FR')}`,
    pillFg: STORY_PILL_FG[s.type],
    label: s.typeLabel.toLocaleUpperCase('fr-FR'),
    text: s.body,
    /** §2.6 : « 1er des conseils Logement aujourd'hui · 31 trouvent utile ». */
    state: s.stateLine,
    a1: s.votes.positiveLabel,
    /** Le bouton est ACTIF quand c'est MON vote — jamais quand le compteur est haut. */
    useful: s.myReaction === s.votes.positiveKind,
    n1: String(s.votes.positive),
    a2: s.votes.negativeLabel,
    n2: String(s.votes.negative),
    write: invitationEcriture(s.author.displayName),
    /**
     * LES SEGMENTS DE PROGRESSION. `GET /stories/:id` rend UNE story, pas la série
     * de son auteur : on n'en dessine donc qu'un, plein. La maquette en dessine
     * trois parce qu'elle illustre une série ; en fabriquer trois ici laisserait
     * croire qu'il y a deux stories de plus à faire défiler.
     */
    bars: ['100%'],
    align: 'center',
    /** Toujours faux aujourd'hui : `backgroundUrl` n'est jamais résolu. Remonté. */
    photo: s.backgroundUrl !== null,
    /**
     * LES AVATARS DE CEUX QUI CONFIRMENT : aucune route ne les donne. Le serveur
     * rend le NOMBRE (`votes.positive`), jamais la liste. On laisse `null` — la
     * maquette n'affiche alors rien — plutôt que d'inventer des visages. Remonté.
     */
    confirmers: null,

    storyId: s.id,
    positiveKind: s.votes.positiveKind,
    negativeKind: s.votes.negativeKind,
    mine: s.myReaction,
    canMessage: s.canMessage,
    expired: s.expired,
    isAuthor: s.isAuthor,
  };
}
