import type { PostType, ReactionKind } from '../enums/generated.js';

/**
 * Vocabulaire des publications — 04-fil.md et T1 §6.
 *
 * « Les compteurs suivent le vocabulaire du type (félicitations, mentions
 * utiles, réponses). » Ce n'est pas un détail de présentation : dire « 42 likes »
 * sous une victoire de parcours trahirait le produit. Un membre qui obtient son
 * visa reçoit des FÉLICITATIONS ; une question reçoit des RÉPONSES.
 *
 * Le vocabulaire vit donc ici, dans le code partagé, et non dans un composant :
 * l'API s'en sert pour composer ses notifications, le front pour ses libellés.
 *
 * Le conseil n'est pas un type de publication : c'est une story (décision T4).
 */

export interface PostTypeVocabulary {
  /** Libellé du type, en pastille. */
  readonly label: string;
  /** La réaction que porte ce type. */
  readonly reaction: ReactionKind;
  /** Verbe du bouton de réaction. */
  readonly actionLabel: string;
  /** Nom du compteur, au pluriel. */
  readonly countWord: string;
  /** Le même au singulier — « 1 réponse », pas « 1 réponses ». */
  readonly countWordSingular: string;
  /** Une question appelle des réponses, pas des commentaires. */
  readonly commentLabel: string;
}

export const POST_TYPE_VOCABULARY = {
  VICTORY: {
    label: 'Victoire',
    reaction: 'BRAVO',
    actionLabel: 'Bravo',
    countWord: 'félicitations',
    countWordSingular: 'félicitation',
    commentLabel: 'Commenter',
  },
  QUESTION: {
    label: 'Question',
    reaction: 'SUPPORT',
    actionLabel: 'Soutenir',
    countWord: 'réponses',
    countWordSingular: 'réponse',
    commentLabel: 'Répondre',
  },
  INFO: {
    label: 'Info',
    reaction: 'USEFUL',
    actionLabel: 'Utile',
    countWord: 'mentions utiles',
    countWordSingular: 'mention utile',
    commentLabel: 'Commenter',
  },
  DISCUSSION: {
    label: 'Discussion',
    reaction: 'LIKE',
    actionLabel: 'Participer',
    countWord: 'participations',
    countWordSingular: 'participation',
    commentLabel: 'Commenter',
  },
} as const satisfies Record<PostType, PostTypeVocabulary>;

/** Accorde le compteur. « 0 réponse » au singulier, comme en français courant. */
export function countLabel(type: PostType, count: number): string {
  const v = POST_TYPE_VOCABULARY[type];
  return count > 1 ? v.countWord : v.countWordSingular;
}

/**
 * Vocabulaire des stories — deux votes par type, avec compteurs affichés
 * (décision T4). Le type impose l'utilité : c'est ce qui justifie le format.
 */
export const STORY_TYPE_VOCABULARY = {
  CONSEIL: {
    label: 'Conseil',
    positive: { kind: 'USEFUL', label: 'Utile' },
    negative: { kind: 'NOT_USEFUL', label: 'Pas utile' },
  },
  DECOUVERTE: {
    label: 'Découverte',
    positive: { kind: 'WANT_TO_GO', label: 'À voir' },
    negative: { kind: 'BEEN_THERE', label: 'J’y suis allé·e' },
  },
  INFORMATION: {
    label: 'Information',
    positive: { kind: 'CONFIRM', label: 'Je confirme' },
    negative: { kind: 'CHANGED', label: 'Ça a changé' },
  },
} as const;

export type StoryTypeKey = keyof typeof STORY_TYPE_VOCABULARY;

/**
 * Les deux seuls votes acceptés pour un type de story. L'API rejette les autres :
 * « seuls les deux kinds du type sont acceptés » (00 §6.3, story_reactions).
 */
export function allowedStoryReactions(type: StoryTypeKey): readonly string[] {
  const v = STORY_TYPE_VOCABULARY[type];
  return [v.positive.kind, v.negative.kind];
}
