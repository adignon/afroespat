'use client';

import type { ReactNode } from 'react';

import { Avatar, SectionLabel, type AvatarProps } from '../primitives/primitives';

/**
 * Blocs de la colonne de contexte — portés de `03 Accueil v2.dc.html`, A01.
 *
 * Quatre blocs : événements de la ville, nouveaux arrivants, alerte vigilance,
 * parrains et contacts en ligne.
 *
 * Le choix des quatre n'est pas décoratif : ils poussent tous vers le RÉEL —
 * un événement physique, un membre à saluer, un parrain joignable. C'est la
 * mécanique du produit, qui optimise le problème résolu et non le temps passé.
 */

/** Carte de la colonne, avec son libellé et un lien facultatif. */
export function AsideCard({
  title,
  action,
  children,
}: {
  readonly title: string;
  readonly action?: { label: string; href: string } | undefined;
  readonly children?: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-[18px]">
      <div className="flex items-center justify-between gap-2">
        <SectionLabel>{title}</SectionLabel>
        {/* Action autonome, pas un lien en ligne : 44 px de cible (T1 §2.3). */}
        {action !== undefined ? (
          <a
            href={action.href}
            className="-my-[10px] flex h-touch items-center text-meta font-bold text-primary hover:text-primary-strong"
          >
            {action.label}
          </a>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/** Bloc de date d'un événement : jour en gros, mois en petit. */
export function DateBlock({ day, month }: { readonly day: string; readonly month: string }) {
  return (
    <div className="flex h-[50px] w-[50px] shrink-0 flex-col items-center justify-center rounded-lg bg-primary-soft text-primary-strong">
      <span className="text-[16px] font-extrabold leading-none">{day}</span>
      <span className="text-[9px] font-bold uppercase">{month}</span>
    </div>
  );
}

export function EventRow({
  day,
  month,
  title,
  subtitle,
  href,
}: {
  readonly day: string;
  readonly month: string;
  readonly title: string;
  readonly subtitle: string;
  readonly href: string;
}) {
  return (
    <a href={href} className="mt-[14px] flex min-h-touch items-center gap-3 rounded-lg hover:bg-control-alt">
      <DateBlock day={day} month={month} />
      <div className="min-w-0">
        <div className="truncate text-[13px] font-bold">{title}</div>
        <div className="truncate text-[11.5px] text-text-subtle">{subtitle}</div>
      </div>
    </a>
  );
}

/**
 * Nouvel arrivant, avec le bouton « Saluer ».
 *
 * Ce bouton n'envoie rien tout seul : il ouvre un message pré-rempli que le
 * membre relit et valide (règle dure §1.2).
 */
export function NewArrivalRow({
  avatar,
  name,
  subtitle,
  greetLabel,
  onGreet,
}: {
  readonly avatar: AvatarProps;
  readonly name: string;
  readonly subtitle: string;
  readonly greetLabel: string;
  readonly onGreet?: () => void;
}) {
  return (
    <div className="mt-[14px] flex items-center gap-[11px]">
      <Avatar {...avatar} size="lg" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-bold">{name}</span>
        <span className="block truncate text-[11.5px] text-text-subtle">{subtitle}</span>
      </span>
      <button
        type="button"
        onClick={onGreet}
        className="flex h-touch shrink-0 items-center"
        aria-label={`${greetLabel} ${name}`}
      >
        <span className="flex h-[34px] items-center rounded-full bg-primary-strong px-[14px] text-meta font-bold text-text-on-dark">
          {greetLabel}
        </span>
      </button>
    </div>
  );
}

/**
 * Contact en ligne. Le point de présence est la SEULE information de présence
 * exposée : aucune « dernière connexion », aucune position (§8.1).
 */
export function OnlineContactRow({
  avatar,
  name,
  statusLabel,
  href,
}: {
  readonly avatar: AvatarProps;
  readonly name: string;
  readonly statusLabel: string;
  readonly href: string;
}) {
  return (
    <a href={href} className="mt-3 flex min-h-touch items-center gap-[11px] rounded-lg hover:bg-control-alt">
      <span className="relative shrink-0">
        <Avatar {...avatar} size="md" />
        <span
          className="absolute -bottom-[1px] -right-[1px] h-[11px] w-[11px] rounded-full border-2 border-surface bg-primary-alt"
          aria-hidden
        />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-bold">{name}</span>
        <span className="block text-[11.5px] text-text-subtle">{statusLabel}</span>
      </span>
    </a>
  );
}

/**
 * Alerte vigilance — fond terre cuite très doux.
 *
 * Usage autorisé du terre cuite (T1 §2.1, `ScamAlert`). Rédigée par l'équipe
 * (13 §…), ciblable par ville ou par pays. Elle protège d'abord le segment
 * pré-départ, cible privilégiée des arnaques.
 */
export function ScamAlert({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  // Rend sa propre carte plutôt que de passer un ton à AsideCard : le terre
  // cuite reste ainsi confiné au composant que T1 §2.1 autorise nommément,
  // au lieu de devenir une option ouverte à toutes les cartes de la colonne.
  return (
    <section className="rounded-2xl bg-inset-alert p-[18px]" role="note">
      <div className="text-label uppercase text-journey-strong">{title}</div>
      <p className="mt-[6px] text-[13px] leading-relaxed">{children}</p>
    </section>
  );
}
