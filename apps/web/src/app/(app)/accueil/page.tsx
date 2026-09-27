import {
  AppShell,
  Avatar,
  Button,
  Card,
  Chips,
  EmptyState,
  PageTitle,
  MobileHeader,
  SafetyBanner,
  SectionLabel,
  Stat,
  TopBar,
} from '@app/ui';
import { HomePanel } from '@/components/HomePanel';
import { fr } from '@/i18n/fr';

/**
 * A01 — Fil d'actualité.
 *
 * L'API n'existe pas encore (lot 0 en cours) : cet écran monte la coquille avec
 * les états vides et les données de démonstration ci-dessous, pour vérifier que le
 * portage du design rend bien. Les données viendront de hooks typés générés depuis
 * l'OpenAPI (§10.3) — aucune logique métier n'entrera dans ce composant.
 */

// Données de démonstration. Un seul endroit, nommé comme tel, à retirer au lot 3.
const DEMO = {
  viewer: { displayName: 'Amina Diallo', initials: 'AD' },
  journey: {
    title: 'Études en France · Lyon',
    progressPct: 58,
    currentStepPosition: 7,
    currentStepTitle: 'Logement',
  },
  whatsNew: { help: 3, events: 2 },
  myNetworks: [
    { name: 'Lyon', memberCount: 412 },
    { name: 'Bénin', memberCount: 1_284 },
    { name: 'Cuisine et saveurs', memberCount: 87 },
  ],
  reputation: { helpValidated: 23 },
} as const;

export default function FeedPage() {
  return (
    <AppShell
      mobileTab="home"
      mobileHeader={<MobileHeader title={fr.feed.title} />}
      panel={
        <HomePanel
          viewer={DEMO.viewer}
          journey={DEMO.journey}
          whatsNew={DEMO.whatsNew}
          myNetworks={DEMO.myNetworks}
        />
      }
      aside={
        <>
          <Card padding={16}>
            <SectionLabel>{fr.contextColumn.reputationLabel}</SectionLabel>
            <div className="mt-2">
              <Stat
                value={DEMO.reputation.helpValidated}
                label={fr.contextColumn.helpValidated}
                tone="green"
              />
            </div>
          </Card>
          <SafetyBanner>{fr.contextColumn.safetyBody}</SafetyBanner>
        </>
      }
    >
      <TopBar
        displayName={DEMO.viewer.displayName.split(' ')[0] ?? DEMO.viewer.displayName}
        initials={DEMO.viewer.initials}
        unreadMessages={1}
        unreadNotifications={3}
      />

      <div className="hidden lg:block">
        <PageTitle title={fr.feed.title} subtitle={fr.feed.subtitle} />
      </div>

      {/* Le composeur. Les chips sont les types de publication — pastilles texte,
          jamais des icônes (T1 §2.4). Le conseil n'y est pas : c'est une story. */}
      <Card>
        <div className="flex items-start gap-3">
          <Avatar initials={DEMO.viewer.initials} tone="terracotta" size="lg" />
          <p className="flex-1 pt-[10px] text-body text-text-subtle">
            {fr.feed.composerPlaceholder}
          </p>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <Chips
            items={[
              { label: fr.feed.types.question, value: 'QUESTION' },
              { label: fr.feed.types.info, value: 'INFO' },
              { label: fr.feed.types.victory, value: 'VICTORY' },
              { label: fr.feed.types.discussion, value: 'DISCUSSION' },
            ]}
            active="QUESTION"
          />
          {/* Désactivé tant que le corps est vide : une seule action primaire
              par écran, et elle ne doit pas mentir sur sa disponibilité. */}
          <Button disabled>{fr.feed.publish}</Button>
        </div>
      </Card>

      {/* État vide : un message et une action, jamais une page blanche (T1 §5). */}
      <Card>
        <EmptyState
          title={fr.feed.empty.title}
          description={fr.feed.empty.description}
          actionLabel={fr.feed.empty.action}
        />
      </Card>
    </AppShell>
  );
}
