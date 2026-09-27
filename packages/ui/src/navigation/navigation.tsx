import type { ReactNode } from 'react';
import { cn } from '../cn.js';
import { Icon } from '../icons/Icon.js';
import type { IconName } from '../icons/paths.js';
import {
  Avatar,
  CountBadge,
  PremiumBadge,
  ProgressBar,
  RoundButton,
  SectionLabel,
} from '../primitives/primitives.js';

/**
 * Coquille de navigation — portée depuis docs/template/Fil d'actualité v2.dc.html
 * et les helpers `logo`, `RAIL`, `menuCard`, `panel`, `topbar`, `desk`, `navM`.
 *
 * `docs/template/CLAUDE.md` est explicite : cette coquille prime sur toute autre
 * description de navigation. Les cinq panneaux de section suivent la même
 * grammaire — une carte contextuelle en haut, des sections titrées, un bloc en bas.
 *
 * RÈGLE DURE (§10.1, T1 §3.1) : la navigation principale n'est JAMAIS une barre
 * d'icônes horizontale en haut d'écran sur ordinateur.
 */

// ─── Rail ────────────────────────────────────────────────────────────────────

export const RAIL_SECTIONS = [
  { key: 'home', label: 'Accueil', icon: 'home', href: '/accueil' },
  { key: 'journey', label: 'Parcours', icon: 'path', href: '/parcours' },
  { key: 'help', label: 'Entraide', icon: 'heart', href: '/entraide' },
  { key: 'services', label: 'Services', icon: 'serv', href: '/services' },
  { key: 'agenda', label: 'Agenda', icon: 'cal', href: '/agenda' },
] as const satisfies readonly { key: string; label: string; icon: IconName; href: string }[];

export type RailSection = (typeof RAIL_SECTIONS)[number]['key'];

/** Le logo : trois cercles, dont un point terre cuite. Porté tel quel. */
export function Logo({ size = 38 }: { readonly size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-[12px] bg-primary-strong"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.7">
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="16.5" cy="7.5" r="1.6" fill="#E0733A" stroke="none" />
      </svg>
    </span>
  );
}

/** Rail d'icônes 76 px, en carte arrondie 22 px sur fond vert fort. */
export function IconRail({
  active,
  onSettings,
  settingsActive = false,
  renderLink,
}: {
  readonly active: RailSection;
  readonly onSettings?: () => void;
  readonly settingsActive?: boolean;
  /**
   * Permet à l'application d'injecter son composant de lien (Next.js).
   * Le type porte `| undefined` explicitement : la prop est transmise depuis
   * SectionPanel, et `exactOptionalPropertyTypes` distingue « absente » de
   * « présente et undefined ».
   */
  readonly renderLink?: ((href: string, children: ReactNode, key: string) => ReactNode) | undefined;
}) {
  return (
    <nav
      aria-label="Navigation principale"
      className="flex w-rail shrink-0 flex-col gap-1 self-stretch rounded-2xl bg-primary-strong p-[12px_8px]"
    >
      {RAIL_SECTIONS.map((section) => {
        const isActive = section.key === active;
        const content = (
          <span
            className={cn(
              'flex h-[58px] flex-col items-center justify-center gap-[5px] rounded-[16px] text-[9.5px] font-bold',
              isActive ? 'bg-surface text-primary-strong' : 'bg-white/[.08] text-text-on-rail',
            )}
          >
            <Icon name={section.icon} size={18} />
            {section.label}
          </span>
        );
        return renderLink !== undefined ? (
          renderLink(section.href, content, section.key)
        ) : (
          <a
            key={section.key}
            href={section.href}
            aria-current={isActive ? 'page' : undefined}
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-surface"
          >
            {content}
          </a>
        );
      })}
      <div className="min-h-3 flex-1" />
      <button
        type="button"
        onClick={onSettings}
        aria-label="Réglages"
        className={cn(
          'flex h-12 items-center justify-center rounded-[16px]',
          settingsActive ? 'bg-surface text-primary-strong' : 'text-text-on-rail',
        )}
      >
        <Icon name="gear" size={19} />
      </button>
    </nav>
  );
}

// ─── Panneau de section ──────────────────────────────────────────────────────

export interface PanelItem {
  readonly label: string;
  readonly icon: IconName;
  readonly href?: string;
  /**
   * Compteur. RÈGLE de §10.1 : dans le panneau Accueil c'est un nombre de
   * NOUVEAUTÉS depuis la dernière visite ; dans les panneaux de section, un TOTAL.
   */
  readonly count?: number;
  readonly badge?: 'premium';
  readonly hint?: string;
}

/** Carte de menu : un libellé de section, des items de 44 px, un compteur. */
export function MenuCard({
  title,
  items,
  activeIndex = -1,
  renderLink,
}: {
  readonly title: string;
  readonly items: readonly PanelItem[];
  readonly activeIndex?: number;
  readonly renderLink?: ((href: string, children: ReactNode, key: string) => ReactNode) | undefined;
}) {
  return (
    <nav className="shrink-0 rounded-2xl border border-border bg-surface p-[14px]" aria-label={title}>
      <div className="px-[6px] pb-2">
        <SectionLabel>{title}</SectionLabel>
      </div>
      {items.map((item, i) => {
        const isActive = i === activeIndex;
        const content = (
          <span
            className={cn(
              'flex h-touch items-center gap-[11px] rounded-lg px-3 text-[13.5px]',
              isActive
                ? 'bg-primary-soft font-bold text-primary-strong'
                : 'font-medium text-text hover:bg-control-alt',
            )}
          >
            <Icon name={item.icon} size={17} />
            <span className="flex-1 truncate">{item.label}</span>
            {item.badge === 'premium' ? <PremiumBadge /> : null}
            {item.count !== undefined ? <CountBadge count={item.count} /> : null}
            {item.hint !== undefined ? (
              <span className="text-[11.5px] text-text-subtle">{item.hint}</span>
            ) : null}
          </span>
        );
        return renderLink !== undefined && item.href !== undefined ? (
          renderLink(item.href, content, item.label)
        ) : (
          <a
            key={item.label}
            href={item.href ?? '#'}
            aria-current={isActive ? 'page' : undefined}
            className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {content}
          </a>
        );
      })}
    </nav>
  );
}

/**
 * Carte « Mon parcours » du panneau — vert foncé, barre terre cuite.
 *
 * Le titre affiché est celui que le MEMBRE a donné à son parcours : c'est ce titre
 * qui vit dans la navigation (03 §3.1). Il n'apparaît en revanche jamais dans le
 * fil, où seul le nom du type est exposé (règle dure 04 §2).
 */
export function JourneyPanelCard({
  title,
  progressPct,
  currentStepLabel,
  onContinue,
}: {
  readonly title: string;
  readonly progressPct: number;
  readonly currentStepLabel: string;
  readonly onContinue?: () => void;
}) {
  return (
    <section className="shrink-0 rounded-2xl bg-primary-strong p-[18px] text-text-on-dark">
      <div className="flex items-start justify-between gap-[10px]">
        <div className="min-w-0">
          <div className="text-[10.5px] font-bold tracking-[1px] text-[#A9CDBF]">MON PARCOURS</div>
          <div className="mt-[5px] truncate text-[14.5px] font-bold tracking-[-0.2px]">{title}</div>
        </div>
        <span className="text-[22px] font-extrabold tabular-nums tracking-[-0.8px]">
          {progressPct}%
        </span>
      </div>
      <div className="mt-[14px]">
        <ProgressBar value={progressPct} onDark label={`Progression : ${progressPct} %`} />
      </div>
      <div className="mt-[14px] flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-[12.5px] text-[#A9CDBF]">{currentStepLabel}</span>
        <button
          type="button"
          onClick={onContinue}
          className="shrink-0 rounded-[11px] bg-surface px-3 py-[7px] text-[12.5px] font-bold text-primary-strong"
        >
          Continuer
        </button>
      </div>
    </section>
  );
}

/** Variante sans parcours : l'invitation à en créer un. */
export function JourneyPanelCardEmpty({ onCreate }: { readonly onCreate?: () => void }) {
  return (
    <section className="shrink-0 rounded-2xl bg-primary-strong p-[18px] text-text-on-dark">
      <div className="text-[10.5px] font-bold tracking-[1px] text-[#A9CDBF]">MON PARCOURS</div>
      <p className="mt-[6px] text-[13.5px] leading-normal">
        Listez vos étapes, suivez vos échéances, trouvez de l’aide au bon moment.
      </p>
      <button
        type="button"
        onClick={onCreate}
        className="mt-[14px] h-touch w-full rounded-[11px] bg-surface text-[13px] font-bold text-primary-strong"
      >
        Créer mon parcours
      </button>
    </section>
  );
}

/** Colonne de gauche complète : logo, rail, puis les cartes du panneau. */
export function SectionPanel({
  active,
  productName,
  children,
  renderLink,
}: {
  readonly active: RailSection;
  readonly productName: string;
  readonly children: ReactNode;
  readonly renderLink?: ((href: string, children: ReactNode, key: string) => ReactNode) | undefined;
}) {
  return (
    <div className="flex w-[400px] shrink-0 flex-col px-6">
      <div className="flex h-16 items-center gap-[10px]">
        <Logo />
        <span className="text-[21px] font-extrabold tracking-[-0.5px] text-primary-strong">
          {productName}
        </span>
      </div>
      <div className="flex gap-3 pt-3">
        <IconRail active={active} renderLink={renderLink} />
        <div className="flex min-w-0 flex-1 flex-col gap-3">{children}</div>
      </div>
    </div>
  );
}

// ─── Barre haute ─────────────────────────────────────────────────────────────

/** Barre haute 64 px, sans bordure : recherche en pilule, créer, messages, notifications, avatar. */
export function TopBar({
  displayName,
  initials,
  unreadMessages = 0,
  unreadNotifications = 0,
  onSearch,
  onCreate,
}: {
  readonly displayName: string;
  readonly initials: string;
  readonly unreadMessages?: number;
  readonly unreadNotifications?: number;
  readonly onSearch?: () => void;
  readonly onCreate?: () => void;
}) {
  return (
    <div className="flex h-16 shrink-0 items-center gap-2">
      <button
        type="button"
        onClick={onSearch}
        className="flex h-touch max-w-[420px] flex-1 items-center gap-[10px] rounded-full bg-control px-[18px] text-[13.5px] text-text-subtle hover:bg-pill-neutral"
      >
        <Icon name="search" size={17} />
        <span className="min-w-0 flex-1 truncate text-left">Rechercher dans la diaspora</span>
      </button>
      <span className="flex-1" />
      <RoundButton icon="plus" label="Créer" onClick={onCreate} />
      <RoundButton icon="chat" label="Messages" dot={unreadMessages > 0} />
      <RoundButton icon="bell" label="Notifications" count={unreadNotifications} />
      <button
        type="button"
        className="ml-1 flex h-touch items-center gap-[9px] rounded-full bg-control p-[3px_16px_3px_3px] hover:bg-pill-neutral"
        aria-label={`Mon compte, ${displayName}`}
      >
        <Avatar initials={initials} tone="terracotta" size="lg" />
        <span className="text-[13.5px] font-semibold">{displayName}</span>
      </button>
    </div>
  );
}

// ─── Coquilles ───────────────────────────────────────────────────────────────

/**
 * Coquille ordinateur (≥ 1024 px) : colonne gauche 352 px + contenu 660 px max +
 * colonne droite 300 px, masquée sous 1280 px.
 */
export function DesktopShell({
  panel,
  children,
  aside,
}: {
  readonly panel: ReactNode;
  readonly children: ReactNode;
  /** Colonne de contexte. `null` étale le contenu sur toute la largeur. */
  readonly aside?: ReactNode | null;
}) {
  return (
    <div className="flex min-h-screen bg-bg">
      {panel}
      <div className="flex min-w-0 flex-1 flex-col pr-6">
        <div className="flex items-start gap-6 pb-6 pt-3">
          {aside === null ? (
            <main className="flex min-w-0 flex-1 flex-col gap-[14px]">{children}</main>
          ) : (
            <>
              <main className="flex min-w-0 max-w-content flex-1 flex-col gap-[14px]">
                {children}
              </main>
              <aside className="hidden w-[300px] shrink-0 flex-col gap-3 xl:flex">{aside}</aside>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Barre d'onglets basse mobile, 5 entrées. Agenda est accessible depuis Accueil. */
export const MOBILE_TABS = [
  { key: 'home', label: 'Accueil', icon: 'home', href: '/accueil' },
  { key: 'journey', label: 'Parcours', icon: 'path', href: '/parcours' },
  { key: 'help', label: 'Entraide', icon: 'heart', href: '/entraide' },
  { key: 'services', label: 'Services', icon: 'serv', href: '/services' },
  { key: 'account', label: 'Compte', icon: 'user', href: '/compte/profil' },
] as const satisfies readonly { key: string; label: string; icon: IconName; href: string }[];

export type MobileTab = (typeof MOBILE_TABS)[number]['key'];

export function MobileTabBar({ active }: { readonly active: MobileTab }) {
  return (
    <nav
      aria-label="Navigation principale"
      className="grid shrink-0 grid-cols-5 border-t border-border bg-surface px-2 pb-6 pt-[6px]"
    >
      {MOBILE_TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <a
            key={tab.key}
            href={tab.href}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'flex h-[54px] flex-col items-center justify-center gap-1 rounded-lg text-[10px] font-bold',
              isActive ? 'bg-primary-soft text-primary-strong' : 'text-text-subtle',
            )}
          >
            <Icon name={tab.icon} size={20} />
            {tab.label}
          </a>
        );
      })}
    </nav>
  );
}

/** Le panneau de section devient une barre d'onglets horizontale défilante sur mobile. */
export function MobileSectionTabs({
  items,
  active,
  onSelect,
}: {
  readonly items: readonly { label: string; value: string }[];
  readonly active: string;
  readonly onSelect?: (value: string) => void;
}) {
  return (
    <div className="flex shrink-0 gap-[6px] overflow-x-auto px-4 py-[10px]" role="tablist">
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          role="tab"
          aria-selected={item.value === active}
          onClick={() => onSelect?.(item.value)}
          className={cn(
            'flex h-9 shrink-0 items-center whitespace-nowrap rounded-full border px-[13px] text-[12.5px] font-bold',
            item.value === active
              ? 'border-primary bg-primary text-text-on-dark'
              : 'border-border bg-surface text-text',
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
