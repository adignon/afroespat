'use client';

import { POST_TYPE_VOCABULARY, type PostType } from '@app/shared';
import { cn } from '../cn';
import { Icon } from '../icons/Icon';
import type { IconName } from '../icons/paths';
import { Avatar, type AvatarProps } from '../primitives/primitives';

/**
 * Composeur — porté de `03 Accueil v2.dc.html`, section A01.
 *
 * Trois actions logées dans le champ : sondage, lier un guide, ajouter une
 * image. Puis les chips de type, dont l'actif s'inverse (fond plein, texte
 * blanc), et le bouton Publier.
 *
 * RÈGLE DURE (§1.2) : aucune publication n'est jamais faite automatiquement au
 * nom d'un membre. Le système pré-remplit — c'est le cas du « Je suis bloqué » —,
 * le membre relit et valide. `onPublish` n'est donc jamais appelé par autre
 * chose qu'un clic.
 *
 * Variante L0 : le membre qui n'a pas vérifié son identité ne peut pas publier
 * dans le fil (§7.3, `post.create` exige L1). Le composeur s'affiche alors
 * désactivé, avec une invitation à monter de niveau — jamais une simple erreur.
 */

const COMPOSER_ACTIONS: readonly { icon: IconName; key: 'poll' | 'guide' | 'image' }[] = [
  { icon: 'chart', key: 'poll' },
  { icon: 'book', key: 'guide' },
  { icon: 'img', key: 'image' },
];

const TYPE_ORDER: readonly PostType[] = ['VICTORY', 'QUESTION', 'INFO', 'DISCUSSION'];

const TYPE_STYLE: Record<PostType, { idle: string; dot: string; active: string }> = {
  VICTORY: { idle: 'bg-type-victory text-primary-strong', dot: 'bg-primary', active: 'bg-primary-strong' },
  QUESTION: { idle: 'bg-type-question text-journey-strong', dot: 'bg-journey', active: 'bg-journey-strong' },
  INFO: { idle: 'bg-type-info text-text-muted', dot: 'bg-text-subtle', active: 'bg-text-muted' },
  DISCUSSION: { idle: 'bg-type-discussion text-primary-strong', dot: 'bg-primary-strong', active: 'bg-primary-strong' },
};

export interface ComposerProps {
  readonly avatar: AvatarProps;
  readonly placeholder: string;
  readonly publishLabel: string;
  readonly activeType: PostType;
  readonly onSelectType?: (type: PostType) => void;
  readonly onAction?: (key: 'poll' | 'guide' | 'image') => void;
  readonly onPublish?: () => void;
  /** Libellés accessibles des trois actions du champ. */
  readonly actionLabels: Record<'poll' | 'guide' | 'image', string>;
  /** Le corps est vide : publier n'a pas de sens, le bouton le dit. */
  readonly canPublish?: boolean;
  /** Niveau insuffisant : le composeur est grisé et l'invitation prend le relais. */
  readonly disabled?: boolean;
  readonly value?: string;
  readonly onChange?: (value: string) => void;
}

export function Composer({
  avatar,
  placeholder,
  publishLabel,
  activeType,
  onSelectType,
  onAction,
  onPublish,
  actionLabels,
  canPublish = false,
  disabled = false,
  value,
  onChange,
}: ComposerProps) {
  return (
    <section className={cn('rounded-2xl border border-border bg-surface p-4', disabled && 'opacity-60')}>
      <div className="flex items-start gap-3">
        <Avatar {...avatar} size="xl" />
        <div className="relative min-h-[92px] min-w-0 flex-1 rounded-xl bg-control-alt">
          <textarea
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            rows={3}
            className={cn(
              'min-h-[92px] w-full resize-none rounded-xl bg-transparent py-[14px] pl-[18px] text-body',
              'placeholder:text-text-subtle focus-visible:outline-none',
              // Réserve la place des trois boutons, sur une ligne à partir de sm.
              'pr-[18px] sm:pr-[146px]',
            )}
          />
          <div className="flex justify-end gap-1 px-[6px] pb-[4px] sm:absolute sm:bottom-0 sm:right-0 sm:px-0 sm:pr-[6px]">
            {COMPOSER_ACTIONS.map((action) => (
              <button
                key={action.key}
                type="button"
                onClick={() => onAction?.(action.key)}
                disabled={disabled}
                aria-label={actionLabels[action.key]}
                title={actionLabels[action.key]}
                className="flex h-touch w-touch items-center justify-center disabled:cursor-not-allowed"
              >
                {/* Carré de 36 px comme la maquette ; le bouton, lui, fait 44 px
                    pour tenir la cible tactile (T1 §2.3). */}
                <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary-soft text-primary-strong hover:bg-pill-green">
                  <Icon name={action.icon} size={18} strokeWidth={1.9} />
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-[14px] flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label={publishLabel}>
          {TYPE_ORDER.map((type) => {
            const active = type === activeType;
            const style = TYPE_STYLE[type];
            return (
              <button
                key={type}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onSelectType?.(type)}
                disabled={disabled}
                className="flex h-touch items-center"
              >
                <span
                  className={cn(
                    'flex h-[38px] items-center gap-[6px] rounded-full px-[14px] text-meta font-bold',
                    active ? cn(style.active, 'text-text-on-dark') : style.idle,
                  )}
                >
                  <span
                    className={cn('h-[6px] w-[6px] rounded-full', active ? 'bg-surface' : style.dot)}
                    aria-hidden
                  />
                  {POST_TYPE_VOCABULARY[type].label}
                </span>
              </button>
            );
          })}
        </div>
        <span className="flex-1" />
        <button
          type="button"
          onClick={onPublish}
          disabled={disabled || !canPublish}
          className={cn(
            'flex h-touch items-center justify-center rounded-lg px-5 text-[13.5px] font-bold',
            'bg-primary text-text-on-dark hover:bg-primary-strong',
            'disabled:cursor-not-allowed disabled:bg-control-alt disabled:text-text-subtle',
          )}
        >
          {publishLabel}
        </button>
      </div>
    </section>
  );
}
