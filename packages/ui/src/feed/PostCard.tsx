'use client';

import type { ReactNode } from 'react';
import { POST_TYPE_VOCABULARY, countLabel, type PostType } from '@app/shared';
import { cn } from '../cn';
import { Icon, VerifiedBadge } from '../icons/Icon';
import type { IconName } from '../icons/paths';
import { Avatar, type AvatarProps } from '../primitives/primitives';

/**
 * Carte de publication — portée de `03 Accueil v2.dc.html`, section A01.
 *
 * Le type de publication gouverne TOUT : la couleur de la pastille, le verbe du
 * bouton, le mot du compteur, et jusqu'au libellé « Commenter » qui devient
 * « Répondre » sur une question. Le vocabulaire vient de @app/shared, parce que
 * c'est une règle métier — « 42 likes » sous une victoire de parcours trahirait
 * le produit.
 *
 * RÈGLE DURE (§1.2) : aucun compteur de vues. La carte n'en a pas de champ.
 * RÈGLE DURE (04 §2) : le titre personnel d'un parcours n'apparaît jamais ici ;
 * la ligne de contexte ne porte que le NOM DU TYPE (« Parcours Études · Lyon »).
 */

/**
 * Le point de la pastille et le cercle du compteur n'ont PAS la même couleur,
 * et ce n'est pas une inattention de la maquette :
 *
 *   · `dot` teinte la pastille de type, dans la famille de la pastille ;
 *   · `reaction` teinte le cercle du compteur, et vaut terre cuite sur une
 *     VICTOIRE — qui est un jalon de parcours — comme sur une QUESTION — dont
 *     le compteur est un compteur d'entraide. Ce sont les deux usages que
 *     T1 §2.1 autorise pour cette couleur.
 */
const TYPE_STYLE: Record<
  PostType,
  { pill: string; text: string; dot: string; reaction: string; action: string }
> = {
  VICTORY: {
    pill: 'bg-type-victory',
    text: 'text-primary-strong',
    dot: 'bg-primary',
    reaction: 'bg-journey',
    action: 'bg-type-victory text-primary-strong',
  },
  QUESTION: {
    pill: 'bg-type-question',
    text: 'text-journey-strong',
    dot: 'bg-journey',
    reaction: 'bg-journey',
    action: 'bg-type-question text-journey-strong',
  },
  INFO: {
    pill: 'bg-type-info',
    text: 'text-text-muted',
    dot: 'bg-text-subtle',
    reaction: 'bg-primary',
    action: 'bg-type-victory text-primary-strong',
  },
  DISCUSSION: {
    pill: 'bg-type-discussion',
    text: 'text-primary-strong',
    dot: 'bg-primary-strong',
    reaction: 'bg-primary-strong',
    action: 'bg-type-discussion text-primary-strong',
  },
};

/** L'icône du bouton de réaction change avec le type, comme dans la maquette. */
const TYPE_ICON: Record<PostType, IconName> = {
  VICTORY: 'trophy',
  QUESTION: 'heart',
  INFO: 'up',
  DISCUSSION: 'chats',
};

/** Pastille de type : texte + point coloré, jamais une icône (T1 §2.4). */
export function PostTypePill({ type }: { readonly type: PostType }) {
  const style = TYPE_STYLE[type];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-[6px] rounded-full px-[11px] py-1 text-[11px] font-bold',
        style.pill,
        style.text,
      )}
    >
      <span className={cn('h-[6px] w-[6px] rounded-full', style.dot)} aria-hidden />
      {POST_TYPE_VOCABULARY[type].label}
    </span>
  );
}

/**
 * Encart « Étape franchie », sous une victoire liée à une étape.
 *
 * `position sur total` plutôt qu'un pourcentage : « 4 sur 12 » se comprend
 * sans calcul, et ne suggère pas un classement.
 */
export function StepDoneInset({
  stepTitle,
  position,
  total,
  label,
}: {
  readonly stepTitle: string;
  readonly position: number;
  readonly total: number;
  readonly label: string;
}) {
  return (
    <div className="mt-[14px] flex items-center gap-[14px] rounded-xl bg-inset-step-done px-4 py-[14px]">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary">
        <Icon name="check" size={22} strokeWidth={2} className="text-text-on-dark" />
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-label uppercase text-primary">{label}</span>
          <span className="rounded-full bg-surface px-[9px] py-[2px] text-[11.5px] font-semibold text-text-muted">
            {position} sur {total}
          </span>
        </div>
        <div className="mt-1 truncate text-card-title">{stepTitle}</div>
      </div>
    </div>
  );
}

/** Encart « Bon à savoir » : une précision utile attachée à une info. */
export function TipInset({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return (
    <div className="mt-[14px] flex gap-3 rounded-lg bg-surface-tonal px-[14px] py-3">
      <span className="w-[3px] shrink-0 rounded-full bg-primary" aria-hidden />
      <div>
        <div className="text-meta font-bold text-primary-strong">{title}</div>
        <div className="mt-[3px] text-[13px] leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

export interface PollOptionView {
  readonly label: string;
  /** Pourcentage entier, 0 à 100. */
  readonly percent: number;
  readonly chosen: boolean;
}

/** Sondage. La barre est un fond, pas une image : elle se lit sans couleur. */
export function PollBlock({
  options,
  meta,
}: {
  readonly options: readonly PollOptionView[];
  readonly meta: string;
}) {
  return (
    <div className="mt-3 flex flex-col gap-2">
      {options.map((option) => (
        <div
          key={option.label}
          className={cn(
            'relative flex h-11 items-center gap-[10px] overflow-hidden rounded-lg px-[14px]',
            option.chosen ? 'border-[1.5px] border-primary' : 'border border-border',
          )}
        >
          <span
            className={cn('absolute inset-y-0 left-0', option.chosen ? 'bg-primary-soft' : 'bg-control-alt')}
            style={{ width: `${option.percent}%` }}
            aria-hidden
          />
          <span className={cn('relative flex-1 text-[13.5px]', option.chosen ? 'font-bold' : 'font-medium')}>
            {option.label}
          </span>
          <span className="relative text-[13px] font-bold">{option.percent} %</span>
        </div>
      ))}
      <div className="text-meta text-text-subtle">{meta}</div>
    </div>
  );
}

export interface PostCardProps {
  readonly author: {
    readonly name: string;
    readonly avatar: AvatarProps;
    readonly level?: 'L1' | 'L2' | undefined;
  };
  readonly type: PostType;
  /** « Parcours Études · Lyon · il y a 2 h ». Jamais le titre personnel du parcours. */
  readonly context: string;
  readonly body: string;
  readonly reactionCount: number;
  /** « 8 commentaires · 3 partages ». */
  readonly meta: string;

  readonly stepDone?: { stepTitle: string; position: number; total: number; label: string };
  readonly tip?: { title: string; body: string };
  readonly tags?: readonly string[];
  readonly media?: ReactNode;
  readonly poll?: { options: readonly PollOptionView[]; meta: string };

  readonly reacted?: boolean;
  readonly bookmarked?: boolean;
  readonly onReact?: () => void;
  readonly onComment?: () => void;
  readonly onShare?: () => void;
  readonly onBookmark?: () => void;
  readonly shareLabel: string;
  readonly bookmarkLabel: string;
}

export function PostCard({
  author,
  type,
  context,
  body,
  reactionCount,
  meta,
  stepDone,
  tip,
  tags,
  media,
  poll,
  reacted = false,
  bookmarked = false,
  onReact,
  onComment,
  onShare,
  onBookmark,
  shareLabel,
  bookmarkLabel,
}: PostCardProps) {
  const vocabulary = POST_TYPE_VOCABULARY[type];
  const style = TYPE_STYLE[type];

  // Un sondage compte des VOTES, pas des participations : le compteur suit ce
  // que le membre a fait. Le vocabulaire du type reste la règle par défaut.
  const countWord =
    poll === undefined
      ? countLabel(type, reactionCount)
      : reactionCount > 1
        ? 'votes'
        : 'vote';

  return (
    <article className="rounded-2xl border border-border bg-surface p-5">
      <header className="flex items-center gap-3">
        <Avatar {...author.avatar} size="xl" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-[7px]">
            <span className="text-[15px] font-bold tracking-[-0.3px]">{author.name}</span>
            {author.level !== undefined ? <VerifiedBadge size={15} level={author.level} /> : null}
            <PostTypePill type={type} />
          </div>
          <div className="mt-[3px] truncate text-meta text-text-subtle">{context}</div>
        </div>
        {/* Signet privé : aucun compteur d'enregistrements nulle part (règle dure §1.2). */}
        <button
          type="button"
          onClick={onBookmark}
          aria-label={bookmarkLabel}
          aria-pressed={bookmarked}
          className={cn(
            'flex h-touch w-touch shrink-0 items-center justify-center rounded-full',
            bookmarked ? 'bg-primary-soft text-primary' : 'bg-control-alt text-text hover:bg-pill-neutral',
          )}
        >
          <Icon name="bm" size={17} />
        </button>
      </header>

      <p className="mt-[14px] whitespace-pre-line text-[15px] leading-[1.62]">{body}</p>

      {stepDone !== undefined ? <StepDoneInset {...stepDone} /> : null}
      {tip !== undefined ? <TipInset title={tip.title}>{tip.body}</TipInset> : null}

      {tags !== undefined && tags.length > 0 ? (
        <div className="mt-[14px] flex flex-wrap gap-[6px]">
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-control-alt px-3 py-[6px] text-meta font-semibold text-text-muted"
            >
              #{tag}
            </span>
          ))}
        </div>
      ) : null}

      {media !== undefined ? <div className="mt-[14px]">{media}</div> : null}
      {poll !== undefined ? <PollBlock options={poll.options} meta={poll.meta} /> : null}

      {/* Ligne de compteurs. Le mot suit le type (T1 §6). */}
      <div className="mt-[14px] flex flex-wrap items-center gap-3 text-meta text-text-muted">
        <span className="flex items-center gap-[7px]">
          <span className={cn('flex h-6 w-6 items-center justify-center rounded-full', style.reaction)}>
            <Icon name={TYPE_ICON[type]} size={13} strokeWidth={2.2} className="text-text-on-dark" />
          </span>
          <strong className="text-text">{reactionCount}</strong> {countWord}
        </span>
        <span className="h-1 w-1 rounded-full bg-border-inactive" aria-hidden />
        <span>{meta}</span>
      </div>

      {/* Trois actions de largeur égale : réagir, commenter, partager. */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={onReact}
          aria-pressed={reacted}
          className={cn(
            'flex h-touch items-center justify-center gap-2 rounded-lg text-[13.5px] font-bold',
            style.action,
          )}
        >
          <Icon name={TYPE_ICON[type]} size={17} strokeWidth={1.8} />
          {vocabulary.actionLabel}
        </button>
        <button
          type="button"
          onClick={onComment}
          className="flex h-touch items-center justify-center gap-2 rounded-lg bg-control-alt text-[13.5px] font-bold hover:bg-pill-neutral"
        >
          <Icon name="chat" size={17} strokeWidth={1.8} />
          {vocabulary.commentLabel}
        </button>
        <button
          type="button"
          onClick={onShare}
          className="flex h-touch items-center justify-center gap-2 rounded-lg bg-control-alt text-[13.5px] font-bold hover:bg-pill-neutral"
        >
          <Icon name="share" size={17} strokeWidth={1.8} />
          {shareLabel}
        </button>
      </div>
    </article>
  );
}
