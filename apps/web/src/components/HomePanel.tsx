import {
  Avatar,
  Card,
  JourneyPanelCard,
  JourneyPanelCardEmpty,
  MenuCard,
  SectionLabel,
  SectionPanel,
  type PanelItem,
} from '@app/ui';
import { PRODUCT_NAME } from '@app/shared';
import { cn } from '@app/ui';
import { fr } from '@/i18n/fr';

const NETWORK_TONES = {
  green: 'bg-primary',
  greenStrong: 'bg-primary-strong',
  terracotta: 'bg-journey-strong',
} as const;

/**
 * Panneau Accueil — §10.1 et T5 §0.
 *
 * Grammaire commune aux cinq panneaux : une carte contextuelle en haut, des
 * sections titrées avec compteurs, un bloc en bas.
 *
 * RÈGLE des compteurs (§10.1, décision T4) : ici ce sont des NOUVEAUTÉS depuis la
 * dernière visite. Dans les panneaux de section, ce sont des TOTAUX. Deux chiffres
 * différents pour la même entrée seraient incompréhensibles.
 */

export interface HomePanelProps {
  readonly viewer: {
    readonly displayName: string;
    readonly initials: string;
  };
  /** Absent = le membre n'a pas encore de parcours : la carte invite à en créer un. */
  readonly journey?: {
    readonly title: string;
    readonly progressPct: number;
    readonly currentStepPosition: number;
    readonly currentStepTitle: string;
  };
  /** Nouveautés depuis la dernière visite, jamais des totaux. */
  readonly whatsNew: {
    readonly help: number;
    readonly events: number;
  };
  readonly myNetworks: readonly {
    readonly name: string;
    readonly memberCount: number;
    readonly initials: string;
    readonly tone: keyof typeof NETWORK_TONES;
  }[];
}

export function HomePanel({ viewer, journey, whatsNew, myNetworks }: HomePanelProps) {
  const t = fr.homePanel;

  const communityItems: readonly PanelItem[] = [
    { label: t.feed, icon: 'list', href: '/accueil' },
    { label: t.guides, icon: 'book', href: '/guides' },
    { label: t.help, icon: 'heart', href: '/entraide', count: whatsNew.help },
    { label: t.networks, icon: 'team', href: '/reseaux' },
    { label: t.mentorship, icon: 'up', href: '/parrainage' },
    { label: t.cities, icon: 'pin', href: '/villes' },
    { label: t.events, icon: 'cal', href: '/agenda', count: whatsNew.events },
  ];

  return (
    <SectionPanel active="home" productName={PRODUCT_NAME}>
      {/* Carte contextuelle : le profil. */}
      <Card padding={16}>
        <div className="flex items-center gap-[11px]">
          <Avatar initials={viewer.initials} tone="terracotta" size="xl" />
          <div className="min-w-0">
            <div className="truncate text-body font-bold tracking-[-0.2px]">
              {viewer.displayName}
            </div>
            <a href="/compte/profil" className="text-meta text-text-subtle hover:text-primary">
              {t.viewPublicProfile}
            </a>
          </div>
        </div>
      </Card>

      {/* Le parcours, juste sous le profil : c'est la colonne vertébrale du produit. */}
      {journey === undefined ? (
        <JourneyPanelCardEmpty
          label={fr.journeyCard.label}
          pitch={fr.journeyCard.pitch}
          createLabel={fr.journeyCard.create}
        />
      ) : (
        <JourneyPanelCard
          label={fr.journeyCard.label}
          title={journey.title}
          progressPct={journey.progressPct}
          currentStepLabel={`${fr.journeyCard.stepPrefix} ${journey.currentStepPosition} : ${journey.currentStepTitle}`}
          continueLabel={fr.journeyCard.continue}
        />
      )}

      <MenuCard title={t.community} items={communityItems} activeIndex={0} />

      {/* Bloc du bas : les raccourcis vers ses réseaux. « Modifier » vit dans
          l'en-tête du bloc, comme dans la maquette A01. */}
      <Card padding={14}>
        <div className="flex items-center justify-between gap-2 px-[6px] pb-2">
          <SectionLabel>{t.shortcuts}</SectionLabel>
          {/* Marge négative : la cible fait 44 px sans épaissir l'en-tête. */}
          <a
            href="/reseaux"
            className="-my-[13px] flex h-touch items-center text-meta font-bold text-primary hover:text-primary-strong"
          >
            {t.edit}
          </a>
        </div>
        <div className="flex flex-col gap-[2px]">
          {myNetworks.map((network) => (
            <a
              key={network.name}
              href="/reseaux"
              className="flex h-[50px] items-center gap-[11px] rounded-lg px-2 hover:bg-control-alt"
            >
              {/* Pastille CARRÉE arrondie : distingue un réseau d'un membre,
                  dont l'avatar est toujours rond. */}
              <span
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-[10px] font-bold text-text-on-dark',
                  NETWORK_TONES[network.tone],
                )}
              >
                {network.initials}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-meta font-bold">{network.name}</span>
                <span className="block text-[11px] text-text-subtle">
                  {network.memberCount} {t.membersSuffix}
                </span>
              </span>
            </a>
          ))}
        </div>
      </Card>
    </SectionPanel>
  );
}
