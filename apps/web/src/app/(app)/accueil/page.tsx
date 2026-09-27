'use client';

import { useState } from 'react';
import type { PostType } from '@app/shared';
import {
  AppShell,
  AsideCard,
  Composer,
  EventRow,
  MobileHeader,
  NewArrivalRow,
  OnlineContactRow,
  PageTitle,
  PostCard,
  ScamAlert,
  StoryStrip,
  TopBar,
} from '@app/ui';
import { HomePanel } from '@/components/HomePanel';
import { fr } from '@/i18n/fr';
import {
  DEMO_ARRIVALS,
  DEMO_EVENTS,
  DEMO_JOURNEY,
  DEMO_NETWORKS,
  DEMO_ONLINE,
  DEMO_POSTS,
  DEMO_STORIES,
  DEMO_VIEWER,
  DEMO_WHATS_NEW,
} from './demo-data';

/**
 * A01 — Fil d'actualité. Portée de `docs/template/03 Accueil v2.dc.html`.
 *
 * L'API du fil arrive au lot 3 : les contenus viennent de `demo-data.ts`, un
 * seul fichier nommé pour ce qu'il est. Les données passeront par des hooks
 * typés générés depuis l'OpenAPI (§10.3) sans que cet écran change de forme —
 * aucune logique métier n'y vit.
 *
 * Ce que cet écran tient déjà :
 *   · le vocabulaire des réactions suit le type (T1 §6), depuis @app/shared ;
 *   · la ligne de contexte n'expose que le NOM DU TYPE de parcours, jamais le
 *     titre personnel que le membre lui a donné (règle dure 04 §2) ;
 *   · aucun compteur de vues, nulle part (règle dure §1.2) ;
 *   · le signet est privé et sans compteur.
 */

const STORY_FILTERS = [
  { label: fr.stories.filters.all, value: 'all' },
  { label: fr.stories.filters.information, value: 'INFORMATION' },
  { label: fr.stories.filters.conseil, value: 'CONSEIL' },
  { label: fr.stories.filters.decouverte, value: 'DECOUVERTE' },
];

const CITY = 'Lyon';

export default function FeedPage() {
  const [storyFilter, setStoryFilter] = useState('all');
  const [composerType, setComposerType] = useState<PostType>('QUESTION');
  const [draft, setDraft] = useState('');

  const stories =
    storyFilter === 'all' ? DEMO_STORIES : DEMO_STORIES.filter((s) => s.kind === storyFilter);

  return (
    <AppShell
      mobileTab="home"
      mobileHeader={<MobileHeader title={fr.feed.title} />}
      panel={
        <HomePanel
          viewer={DEMO_VIEWER}
          journey={DEMO_JOURNEY}
          whatsNew={DEMO_WHATS_NEW}
          myNetworks={DEMO_NETWORKS}
        />
      }
      aside={
        <>
          <AsideCard
            title={fr.contextColumn.eventsTitle.replace('{ville}', CITY)}
            action={{ label: fr.contextColumn.seeAll, href: '/agenda' }}
          >
            {DEMO_EVENTS.map((event) => (
              <EventRow key={event.title} {...event} />
            ))}
          </AsideCard>

          <AsideCard title={fr.contextColumn.arrivalsTitle}>
            {DEMO_ARRIVALS.map((person) => (
              <NewArrivalRow
                key={person.name}
                avatar={{ initials: person.initials, tone: person.tone }}
                name={person.name}
                subtitle={person.subtitle}
                greetLabel={fr.contextColumn.greet}
              />
            ))}
          </AsideCard>

          {/* Terre cuite doux, usage autorisé (T1 §2.1). Rédigée par l'équipe. */}
          <ScamAlert title={fr.contextColumn.alertTitle}>{fr.contextColumn.alertBody}</ScamAlert>

          <AsideCard title={fr.contextColumn.contactsTitle}>
            {DEMO_ONLINE.map((contact) => (
              <OnlineContactRow
                key={contact.name}
                avatar={{ initials: contact.initials, tone: contact.tone }}
                name={contact.name}
                statusLabel={fr.contextColumn.online}
                href={contact.href}
              />
            ))}
          </AsideCard>
        </>
      }
    >
      <TopBar
        displayName={DEMO_VIEWER.firstName}
        initials={DEMO_VIEWER.initials}
        unreadMessages={1}
        unreadNotifications={3}
      />

      <div className="hidden lg:block">
        <PageTitle title={fr.feed.title} subtitle={fr.feed.subtitle} />
      </div>

      {/* Le bandeau de jalons n'existe plus : les stories l'ont remplacé (§10.1). */}
      <StoryStrip
        title={fr.stories.title}
        createLabel={fr.stories.create}
        filters={STORY_FILTERS}
        activeFilter={storyFilter}
        stories={stories}
        onFilter={setStoryFilter}
      />

      <Composer
        avatar={{ initials: DEMO_VIEWER.initials, tone: 'terracotta' }}
        placeholder={fr.feed.composerPlaceholder}
        publishLabel={fr.feed.publish}
        activeType={composerType}
        onSelectType={setComposerType}
        actionLabels={fr.feed.composerActions}
        value={draft}
        onChange={setDraft}
        canPublish={draft.trim().length > 0}
      />

      {DEMO_POSTS.map((post) => (
        <PostCard
          key={post.id}
          {...post}
          shareLabel={fr.feed.share}
          bookmarkLabel={fr.feed.bookmark}
        />
      ))}
    </AppShell>
  );
}
