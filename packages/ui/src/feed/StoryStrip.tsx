'use client';

import { cn } from '../cn';
import { Icon } from '../icons/Icon';
import { SectionLabel } from '../primitives/primitives';

/**
 * Bandeau de stories — porté de `03 Accueil v2.dc.html`, section A01.
 *
 * En haut du fil : les stories du jour, première bulle « Créer une story ».
 * Le bandeau de jalons n'existe plus — il a été remplacé par les stories
 * (§10.1 et décision T4).
 *
 * RÈGLE DURE (§1.2) : aucun compteur de vues. Le chiffre affiché sous une bulle
 * est le compteur de VOTES du type — « 12 utile », « 5 à voir » —, jamais un
 * nombre de vues. Un anneau marque le vu / non vu, et cette information reste
 * privée au lecteur : l'auteur ne sait pas qui a regardé.
 */

export type StoryKind = 'CONSEIL' | 'DECOUVERTE' | 'INFORMATION';

/** Chaque type a sa couleur de pastille, relevée dans la maquette. */
const KIND_STYLE: Record<StoryKind, { pill: string; label: string }> = {
  CONSEIL: { pill: 'bg-primary', label: 'CONSEIL' },
  // Vert clair, pas terre cuite : le bandeau de stories n'emploie AUCUN terre
  // cuite dans la maquette — il est réservé au parcours (T1 §2.1).
  DECOUVERTE: { pill: 'bg-primary-alt', label: 'DÉCOUVERTE' },
  INFORMATION: { pill: 'bg-primary-strong', label: 'INFO' },
};

export interface StoryBubbleData {
  readonly id: string;
  readonly kind: StoryKind;
  readonly initials: string;
  readonly caption: string;
  /** Compteur de votes du type, jamais de vues. */
  readonly voteLabel: string;
  /** Anneau plein = pas encore vue. Information privée au lecteur. */
  readonly seen: boolean;
  readonly tone?: 'terracotta' | 'green' | 'greenStrong';
}

const TONE_BG = {
  terracotta: 'bg-journey-strong',
  green: 'bg-primary',
  greenStrong: 'bg-primary-strong',
} as const;

export interface StoryFilter {
  readonly label: string;
  readonly value: string;
}

export function StoryStrip({
  title,
  createLabel,
  filters,
  activeFilter,
  stories,
  onFilter,
  onCreate,
  onOpen,
}: {
  readonly title: string;
  readonly createLabel: string;
  readonly filters: readonly StoryFilter[];
  readonly activeFilter: string;
  readonly stories: readonly StoryBubbleData[];
  readonly onFilter?: (value: string) => void;
  readonly onCreate?: () => void;
  readonly onOpen?: (id: string) => void;
}) {
  return (
    <section className="rounded-2xl border border-border bg-surface px-4 pb-[14px] pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionLabel>{title}</SectionLabel>
        <div className="flex flex-wrap gap-[6px]" role="tablist" aria-label={title}>
          {filters.map((filter) => {
            const active = filter.value === activeFilter;
            return (
              <button
                key={filter.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onFilter?.(filter.value)}
                className="flex h-touch items-center"
              >
                <span
                  className={cn(
                    'flex h-8 items-center rounded-full border px-3 text-meta font-bold',
                    active
                      ? 'border-primary bg-primary text-text-on-dark'
                      : 'border-border bg-surface text-text',
                  )}
                >
                  {filter.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Défilement horizontal : sur mobile la liste dépasse forcément. */}
      <div className="mt-[14px] flex gap-[6px] overflow-x-auto pb-1">
        <button
          type="button"
          onClick={onCreate}
          className="flex w-[92px] shrink-0 flex-col items-center gap-[6px]"
        >
          <span className="flex h-[68px] w-[68px] items-center justify-center rounded-full border-[1.5px] border-dashed border-placeholder-line bg-bg">
            <Icon name="plus" size={22} strokeWidth={2.2} className="text-primary" />
          </span>
          <span className="h-[18px]" aria-hidden />
          <span className="text-center text-[11.5px] font-bold leading-tight">{createLabel}</span>
        </button>

        {stories.map((story) => {
          const kind = KIND_STYLE[story.kind];
          return (
            <button
              key={story.id}
              type="button"
              onClick={() => onOpen?.(story.id)}
              className="flex w-[92px] shrink-0 flex-col items-center gap-[6px]"
            >
              <span
                className={cn(
                  'flex h-[68px] w-[68px] rounded-full p-[3px]',
                  // Anneau épais vert = pas encore vue ; anneau fin gris = vue.
                  // Jamais de dégradé : T1 §4.2 l'interdit explicitement, parce
                  // qu'il évoque un autre réseau et sa mécanique d'attention.
                  story.seen
                    ? 'border-[1.5px] border-border-inactive'
                    : 'border-[3px] border-primary',
                )}
              >
                <span
                  className={cn(
                    'flex flex-1 items-center justify-center rounded-full text-[15px] font-bold text-text-on-dark',
                    TONE_BG[story.tone ?? 'green'],
                  )}
                >
                  {story.initials}
                </span>
              </span>
              <span
                className={cn(
                  'relative -mt-[15px] whitespace-nowrap rounded-full border-2 border-surface px-[7px] py-[3px] text-[8.5px] font-extrabold tracking-[0.6px] text-text-on-dark',
                  kind.pill,
                )}
              >
                {kind.label}
              </span>
              <span className="max-w-[92px] truncate text-center text-meta font-bold leading-tight">
                {story.caption}
              </span>
              <span className="-mt-1 text-[11px] font-bold text-primary">{story.voteLabel}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
