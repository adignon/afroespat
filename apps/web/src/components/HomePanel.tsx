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
import { fr } from '@/i18n/fr';

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
  readonly myNetworks: readonly { readonly name: string; readonly memberCount: number }[];
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

      {/* Bloc du bas : les raccourcis vers ses réseaux. */}
      <Card padding={14}>
        <div className="px-[6px] pb-2">
          <SectionLabel>{t.shortcuts}</SectionLabel>
        </div>
        {myNetworks.map((network) => (
          <a
            key={network.name}
            href="/reseaux"
            className="flex h-touch items-center gap-[11px] rounded-lg px-3 hover:bg-control-alt"
          >
            {/* Pastille carrée : distingue un réseau d'un membre, qui est toujours rond. */}
            <span className="h-[26px] w-[26px] shrink-0 rounded-md bg-primary-soft" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13.5px] font-semibold">{network.name}</span>
              <span className="block text-[11.5px] text-text-subtle">
                {network.memberCount} {t.membersSuffix}
              </span>
            </span>
          </a>
        ))}
        {/* Action autonome, pas un lien en ligne : 44 px comme les lignes au-dessus. */}
        <a
          href="/reseaux"
          className="flex h-touch items-center rounded-lg px-3 text-[12.5px] font-bold text-primary hover:bg-control-alt hover:text-primary-strong"
        >
          {t.edit}
        </a>
      </Card>
    </SectionPanel>
  );
}
