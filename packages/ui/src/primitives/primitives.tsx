'use client';

// Composants interactifs : ils portent des gestionnaires d'événements, donc ils
// s'exécutent côté client. §10.3 le prévoit — rendu serveur pour les pages
// publiques, zone connectée en rendu client après authentification.

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../cn';
import { Icon, VerifiedBadge } from '../icons/Icon';
import type { IconName } from '../icons/paths';

/**
 * Primitives du design system — portées depuis docs/template/gen-helpers.js.
 *
 * Correspondance avec les helpers du design, pour que le lien reste traçable :
 *   av → Avatar · pill → Pill · lbl → SectionLabel · card → Card · tint → Tint
 *   btn → Button · bar → ProgressBar · field → Field · tog → Toggle
 *   chips → Chips · seg → Segmented · member → MemberRow · stat → Stat
 *   title → PageTitle
 *
 * Règles tenues ici plutôt que répétées partout :
 *   · aucune ombre portée (T1 §2.3) — la seule exception est la carte en déplacement
 *   · cible tactile 44 px minimum sur tout élément cliquable (T1 §2.3)
 *   · une pastille d'état est toujours texte + fond, jamais couleur seule (T1 §6)
 */

// ─── Avatar ──────────────────────────────────────────────────────────────────

const AVATAR_SIZES = { xs: 24, sm: 30, md: 34, lg: 40, xl: 44 } as const;
export type AvatarSize = keyof typeof AVATAR_SIZES;

export interface AvatarProps {
  /** Initiales. Le design n'emploie pas d'image générique quand la photo manque. */
  readonly initials: string;
  /** Couleur de fond, tirée de la palette. */
  readonly tone?: 'terracotta' | 'green' | 'greenStrong' | 'neutral';
  readonly size?: AvatarSize;
  readonly src?: string;
  readonly alt?: string;
}

const AVATAR_TONES = {
  terracotta: 'bg-journey-strong',
  green: 'bg-primary',
  greenStrong: 'bg-primary-strong',
  neutral: 'bg-text-subtle',
} as const;

export function Avatar({ initials, tone = 'green', size = 'md', src, alt }: AvatarProps) {
  const px = AVATAR_SIZES[size];
  if (src !== undefined) {
    return (
      <img
        src={src}
        alt={alt ?? ''}
        width={px}
        height={px}
        className="shrink-0 rounded-full object-cover"
        style={{ width: px, height: px }}
      />
    );
  }
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-bold text-text-on-dark',
        AVATAR_TONES[tone],
      )}
      style={{ width: px, height: px, fontSize: Math.round(px / 3.2) }}
      aria-hidden={alt === undefined ? true : undefined}
      aria-label={alt}
    >
      {initials}
    </span>
  );
}

/** Pile d'avatars — l'équipe d'un parcours, les participants d'un événement. */
export function AvatarStack({
  people,
  max = 4,
  size = 'sm',
}: {
  readonly people: readonly AvatarProps[];
  readonly max?: number;
  readonly size?: AvatarSize;
}) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <span className="flex items-center">
      {shown.map((p, i) => (
        <span key={i} className={i === 0 ? '' : '-ml-2'}>
          <Avatar {...p} size={size} />
        </span>
      ))}
      {rest > 0 ? (
        <span className="ml-2 text-meta text-text-muted">+{rest}</span>
      ) : null}
    </span>
  );
}

// ─── Pastilles ───────────────────────────────────────────────────────────────

export type PillTone =
  | 'neutral'
  | 'green'
  /** Terre cuite — RÉSERVÉ aux usages du parcours (T1 §2.1). */
  | 'journey'
  | 'success'
  | 'muted';

const PILL_TONES: Record<PillTone, string> = {
  neutral: 'bg-control-alt text-text-muted',
  green: 'bg-pill-green text-primary',
  journey: 'bg-journey-soft text-journey-strong',
  success: 'bg-pill-green text-success',
  muted: 'bg-pill-neutral text-text-subtle',
};

/**
 * Pastille de type ou d'état. Toujours texte + fond : une pastille qui ne serait
 * qu'une couleur est illisible pour un daltonien (T1 §6).
 */
export function Pill({
  children,
  tone = 'neutral',
  className,
}: {
  readonly children: ReactNode;
  readonly tone?: PillTone;
  readonly className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-full px-[10px] py-[4px] text-pill font-bold',
        PILL_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Compteur en pastille. Terre cuite : c'est un usage autorisé (compteur non lu). */
export function CountBadge({ count }: { readonly count: number }) {
  if (count <= 0) return null;
  return (
    <span className="inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-journey px-[7px] text-[11px] font-bold text-text-on-dark">
      {count}
    </span>
  );
}

/** Badge Premium. Terre cuite : usage autorisé explicitement par T1 §2.1. */
export function PremiumBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-journey-soft px-2 py-[3px] text-[10px] font-extrabold tracking-[0.6px] text-journey-strong">
      PREMIUM
    </span>
  );
}

// ─── Libellé de section ──────────────────────────────────────────────────────

/** Libellé 11 px majuscules interlettré — la grammaire de titre des panneaux. */
export function SectionLabel({
  children,
  className,
}: {
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return (
    <div className={cn('text-label uppercase text-text-subtle', className)}>{children}</div>
  );
}

// ─── Surfaces ────────────────────────────────────────────────────────────────

/** Carte blanche, bordure 1 px, rayon 22 px, JAMAIS d'ombre (T1 §2.3). */
export function Card({
  children,
  padding = 20,
  className,
  as: As = 'div',
}: {
  readonly children: ReactNode;
  readonly padding?: number;
  readonly className?: string;
  readonly as?: 'div' | 'section' | 'article' | 'aside';
}) {
  return (
    <As
      className={cn('shrink-0 rounded-2xl border border-border bg-surface', className)}
      style={{ padding }}
    >
      {children}
    </As>
  );
}

/** Encart tonal, sans bordure. Sert aux blocs d'information dans une carte. */
export function Tint({
  children,
  tone = 'green',
  padding = 18,
  className,
}: {
  readonly children: ReactNode;
  readonly tone?: 'green' | 'greenSoft' | 'journey' | 'neutral' | 'inset';
  readonly padding?: number;
  readonly className?: string;
}) {
  const tones = {
    green: 'bg-surface-tonal',
    greenSoft: 'bg-primary-soft',
    journey: 'bg-journey-soft',
    neutral: 'bg-control-alt',
    inset: 'bg-surface-inset',
  } as const;
  return (
    <div className={cn('shrink-0 rounded-2xl', tones[tone], className)} style={{ padding }}>
      {children}
    </div>
  );
}

// ─── Bouton ──────────────────────────────────────────────────────────────────

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  /** Terre cuite — réservé aux actions de parcours, dont « Je suis bloqué·e ». */
  | 'journey'
  /**
   * Action destructive. Neutre, PAS rouge : aucun rouge dans l'interface
   * (règle dure §1.2). Le poids est porté par le libellé et la confirmation.
   */
  | 'destructiveNeutral';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-text-on-dark hover:bg-primary-strong',
  secondary: 'bg-control-alt text-text hover:bg-pill-neutral',
  ghost: 'bg-transparent text-text hover:bg-control-alt',
  journey: 'bg-journey text-text-on-dark hover:bg-journey-strong',
  destructiveNeutral: 'bg-control-alt text-text-muted hover:bg-pill-neutral',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant;
  readonly icon?: IconName;
  /** Occupe toute la largeur — usage courant en pied de feuille mobile. */
  readonly block?: boolean;
}

/** Hauteur 44 px : la cible tactile minimale, appliquée partout (T1 §2.3). */
export function Button({
  variant = 'primary',
  icon,
  block = false,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex h-touch shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-[18px] text-[13.5px] font-bold',
        'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-55',
        BUTTON_VARIANTS[variant],
        block && 'w-full',
        className,
      )}
      {...rest}
    >
      {icon !== undefined ? <Icon name={icon} size={17} /> : null}
      {children}
    </button>
  );
}

/** Bouton rond de la barre haute et des en-têtes mobiles (helper `rb`). */
export function RoundButton({
  icon,
  label,
  count,
  dot = false,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  readonly icon: IconName;
  /** Obligatoire : un bouton d'icône seule doit avoir un nom accessible (§10.6). */
  readonly label: string;
  readonly count?: number;
  readonly dot?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        'relative inline-flex h-touch w-touch shrink-0 items-center justify-center rounded-full bg-control text-text',
        'hover:bg-pill-neutral focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        className,
      )}
      {...rest}
    >
      <Icon name={icon} size={19} />
      {count !== undefined && count > 0 ? (
        <span className="absolute -right-[2px] -top-[2px] flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-bg bg-journey px-[5px] text-[10.5px] font-bold text-text-on-dark">
          {count}
        </span>
      ) : null}
      {dot && count === undefined ? (
        <span className="absolute right-[3px] top-[2px] h-[9px] w-[9px] rounded-full border-2 border-bg bg-journey" />
      ) : null}
    </button>
  );
}

// ─── Barre de progression ────────────────────────────────────────────────────

/**
 * Barre de progression de parcours. Terre cuite par défaut — usage RÉSERVÉ et
 * autorisé (T1 §2.1). Ne pas employer ce composant pour autre chose qu'un parcours.
 */
export function ProgressBar({
  value,
  height = 8,
  onDark = false,
  label,
}: {
  /** Pourcentage, 0 à 100. */
  readonly value: number;
  readonly height?: number;
  readonly onDark?: boolean;
  readonly label?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label ?? 'Progression du parcours'}
      className={cn('overflow-hidden rounded-full', onDark ? 'bg-white/[.18]' : 'bg-control')}
      style={{ height }}
    >
      <div className="h-full rounded-full bg-journey" style={{ width: `${clamped}%` }} />
    </div>
  );
}

// ─── Champ ───────────────────────────────────────────────────────────────────

export function Field({
  label,
  children,
  focused = false,
  hint,
  error,
  htmlFor,
}: {
  readonly label: string;
  readonly children: ReactNode;
  readonly focused?: boolean;
  readonly hint?: string;
  /**
   * Message d'erreur. Neutre : ni rouge (règle dure §1.2), ni terre cuite — le
   * terre cuite est réservé au parcours (T1 §2.1), et une erreur de saisie n'en
   * est pas un. C'est la bordure appuyée et le texte qui informent.
   */
  readonly error?: string;
  readonly htmlFor?: string;
}) {
  return (
    <div className="shrink-0">
      <label htmlFor={htmlFor} className="mb-[6px] block text-[12.5px] font-bold">
        {label}
      </label>
      <div
        className={cn(
          'min-h-12 rounded-lg bg-surface px-[14px] py-[13px] text-body leading-normal',
          focused ? 'border-[1.5px] border-primary' : 'border border-border',
          error !== undefined && 'border-[1.5px] border-text-muted',
        )}
      >
        {children}
      </div>
      {hint !== undefined ? (
        <p className="mt-[6px] text-meta text-text-muted">{hint}</p>
      ) : null}
      {error !== undefined ? (
        <p className="mt-[6px] text-meta font-semibold text-text">{error}</p>
      ) : null}
    </div>
  );
}

// ─── Interrupteur ────────────────────────────────────────────────────────────

export function Toggle({
  label,
  description,
  checked,
  disabled = false,
  onChange,
}: {
  readonly label: string;
  readonly description?: string;
  readonly checked: boolean;
  readonly disabled?: boolean;
  readonly onChange?: (next: boolean) => void;
}) {
  return (
    <div className={cn('flex items-center gap-3 py-3', disabled && 'opacity-55')}>
      <div className="flex-1">
        <div className="text-[13.5px] font-bold">{label}</div>
        {description !== undefined ? (
          <div className="mt-[2px] text-meta leading-normal text-text-muted">{description}</div>
        ) : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange?.(!checked)}
        className={cn(
          'relative h-[26px] w-[46px] shrink-0 rounded-full transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
          checked ? 'bg-primary' : 'bg-border-inactive',
        )}
      >
        <span
          className="absolute top-[3px] h-5 w-5 rounded-full bg-surface transition-[left]"
          style={{ left: checked ? 23 : 3 }}
        />
      </button>
    </div>
  );
}

// ─── Chips et segmenté ───────────────────────────────────────────────────────

export interface ChipItem {
  readonly label: string;
  readonly value: string;
  readonly count?: number;
}

/** Filtres. Le séparateur se note par une entrée de valeur `|`. */
export function Chips({
  items,
  active,
  onSelect,
  dark = false,
}: {
  readonly items: readonly ChipItem[];
  readonly active: string;
  readonly onSelect?: (value: string) => void;
  readonly dark?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-wrap gap-[6px]" role="tablist">
      {items.map((item) =>
        item.value === '|' ? (
          <span key="sep" className="mx-1 w-px bg-border-strong" aria-hidden />
        ) : (
          // Le design donne 37 px de haut à une chip ; T1 §2.3 exige 44 px de
          // cible tactile. Le BOUTON fait donc 44 px — mesurable, donc auditable —
          // et la pilule visuelle à l'intérieur garde ses 37 px exacts.
          // Un pseudo-élément aurait étendu la zone cliquable sans que la mesure
          // le voie : invisible à un audit, donc invérifiable.
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={item.value === active}
            onClick={() => onSelect?.(item.value)}
            className="flex h-touch items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:rounded-full"
          >
            <span
              className={cn(
                'flex items-center whitespace-nowrap rounded-full border px-[13px] py-2 text-[12.5px] font-bold',
                item.value === active
                  ? dark
                    ? 'border-text bg-text text-text-on-dark'
                    : 'border-primary bg-primary text-text-on-dark'
                  : 'border-border bg-surface text-text hover:bg-control-alt',
              )}
            >
              {item.label}
              {item.count !== undefined ? (
                <span className="ml-[6px] font-semibold">{item.count}</span>
              ) : null}
            </span>
          </button>
        ),
      )}
    </div>
  );
}

/** Contrôle segmenté, sur fond `control`. */
export function Segmented({
  items,
  active,
  onSelect,
}: {
  readonly items: readonly ChipItem[];
  readonly active: string;
  readonly onSelect?: (value: string) => void;
}) {
  return (
    <div
      className="flex shrink-0 gap-1 self-start rounded-lg bg-control p-1"
      role="tablist"
    >
      {items.map((item) => (
        // Même principe que les chips : bouton de 44 px, visuel du design dedans.
        <button
          key={item.value}
          type="button"
          role="tab"
          aria-selected={item.value === active}
          onClick={() => onSelect?.(item.value)}
          className="flex h-touch items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:rounded-md"
        >
          <span
            className={cn(
              'flex items-center whitespace-nowrap rounded-md px-4 py-[9px] text-[13px] font-bold',
              item.value === active ? 'bg-surface text-text' : 'text-text-muted',
            )}
          >
            {item.label}
          </span>
        </button>
      ))}
    </div>
  );
}

// ─── Membre ──────────────────────────────────────────────────────────────────

/**
 * Rendu unique d'un membre (T4 §6 : `UserSummary` a toujours la même forme).
 *
 * N'affiche JAMAIS de téléphone, d'email ni de date de naissance — ils ne sont même
 * pas renvoyés par l'API. Un membre bloqué ou désactivé arrive sans handle, sous
 * « Membre indisponible ».
 */
export function MemberRow({
  avatar,
  name,
  subtitle,
  level,
  right,
  size = 'lg',
}: {
  readonly avatar: AvatarProps;
  readonly name: string;
  readonly subtitle?: string;
  readonly level?: 'L1' | 'L2';
  readonly right?: ReactNode;
  readonly size?: AvatarSize;
}) {
  return (
    <div className="flex items-center gap-3">
      <Avatar {...avatar} size={size} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-[5px] text-body font-bold">
          <span className="truncate">{name}</span>
          {level !== undefined ? <VerifiedBadge level={level} /> : null}
        </span>
        {subtitle !== undefined ? (
          <span className="block truncate text-meta text-text-subtle">{subtitle}</span>
        ) : null}
      </span>
      {right}
    </div>
  );
}

// ─── Statistique et titre ────────────────────────────────────────────────────

/**
 * Tuile de chiffre. Sert à la réputation et aux quotas.
 *
 * RÈGLE DURE (§1.2) : jamais de compteur de vues, pour personne. Et jamais de
 * taux de réussite ou d'échec côté membres (15 §…).
 */
export function Stat({
  value,
  label,
  tone = 'surface',
}: {
  readonly value: ReactNode;
  readonly label: string;
  readonly tone?: 'surface' | 'green' | 'journey' | 'dark';
}) {
  // Chaque ton porte sa couleur de libellé EXPLICITE, jamais une opacité.
  //
  // `opacity` sur du texte est un piège d'accessibilité : elle mélange la couleur
  // avec le fond, fait chuter le contraste réel, et reste invisible à un contrôle
  // au niveau des jetons — qui ne voit que la couleur déclarée. Trouvé par
  // axe-core au navigateur, sur ce composant même.
  const tones = {
    surface: { box: 'bg-surface border border-border', value: 'text-text', label: 'text-text-muted' },
    green: { box: 'bg-primary-soft', value: 'text-primary-strong', label: 'text-primary-strong' },
    journey: { box: 'bg-journey-soft', value: 'text-journey-strong', label: 'text-journey-strong' },
    dark: { box: 'bg-primary-strong', value: 'text-text-on-dark', label: 'text-text-on-dark' },
  } as const;
  const t = tones[tone];
  return (
    <div className={cn('rounded-xl p-4', t.box)}>
      <div className={cn('text-[24px] font-extrabold tracking-[-0.6px]', t.value)}>{value}</div>
      <div className={cn('mt-[2px] text-meta', t.label)}>{label}</div>
    </div>
  );
}

/** Titre de page 28 px extra-gras, avec sous-titre et actions à droite. */
export function PageTitle({
  title,
  subtitle,
  right,
}: {
  readonly title: string;
  readonly subtitle?: string;
  readonly right?: ReactNode;
}) {
  return (
    <div className="flex shrink-0 items-end gap-4">
      <div className="min-w-0 flex-1">
        <h1 className="text-[28px] font-extrabold tracking-[-0.9px]">{title}</h1>
        {subtitle !== undefined ? (
          <p className="mt-1 text-[13.5px] text-text-muted">{subtitle}</p>
        ) : null}
      </div>
      {right}
    </div>
  );
}
