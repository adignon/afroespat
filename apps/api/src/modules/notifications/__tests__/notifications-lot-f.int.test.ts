import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId } from '@app/db';
import { AuditService } from '../../../common/audit.service';
import { OutboxService } from '../../../common/outbox.service';
import { PrismaService } from '../../../common/prisma.service';
import { VisibilityService } from '../../../common/visibility.service';
import { AdminJourneysService } from '../../admin/admin-journeys.service';
import { ConnectionsService } from '../../connections/connections.service';
import type { RealtimeEvent } from '../../realtime/realtime.channel';
import type { RealtimeRelayService } from '../../realtime/realtime.relay';
import { NotificationEventsService } from '../notifications.events';
import { NotificationsService } from '../notifications.service';
import { EventHandlerRegistry, type DomainEventJob } from '../../../queue/event-handlers';
import { registerNotificationSubscriptions } from '../../../queue/event-subscriptions.service';

/**
 * Lot F — la cloche en direct, les lignes qui mènent quelque part, et
 * « Ajouter X à vos contacts ? » (08 §3.1, 12 §2.7, T4 §7).
 */
describe('notifications : notification.new, url, suggestions de contact', () => {
  let prisma: PrismaService;
  let notifications: NotificationsService;
  let events: NotificationEventsService;
  let connections: ConnectionsService;
  let registry: EventHandlerRegistry;
  const poussees: { userId: string; event: RealtimeEvent; payload: Record<string, unknown> }[] = [];
  const users: string[] = [];
  const evenements: string[] = [];
  const salons: string[] = [];
  const modeles: string[] = [];
  const equipe: string[] = [];
  let countryId = '';
  let cityId = '';
  const run = Math.random().toString(36).slice(2, 7);

  async function member(): Promise<{ id: string; handle: string }> {
    const id = newId();
    const handle = `nf${run}${id.slice(-6)}`;
    await prisma.user.create({
      data: { id, handle, displayName: `Membre ${handle}`, phase: 'SETTLED', verificationLevel: 'L1', originCountryId: countryId, cityId, plan: 'FREE', status: 'ACTIVE' },
    });
    users.push(id);
    return { id, handle };
  }

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    const relais = {
      publish: (userId: string, event: RealtimeEvent, payload: Record<string, unknown>) => {
        poussees.push({ userId, event, payload });
        return Promise.resolve();
      },
    } as unknown as RealtimeRelayService;
    const noop = { send: () => Promise.resolve({ ok: true }) } as never;
    notifications = new NotificationsService(prisma, noop, noop, undefined, null, relais);
    events = new NotificationEventsService(prisma, notifications);
    const outbox = new OutboxService(prisma);
    connections = new ConnectionsService(prisma, outbox, new AuditService(prisma), new VisibilityService(prisma));
    registry = new EventHandlerRegistry();
    registerNotificationSubscriptions(registry, notifications, events);
    countryId = (await prisma.country.findFirstOrThrow({ where: { isActive: true, kind: { in: ['ORIGIN', 'BOTH'] } }, select: { id: true } })).id;
    cityId = (await prisma.city.findFirstOrThrow({ select: { id: true } })).id;
  });

  afterAll(async () => {
    await prisma.domainEvent.deleteMany({ where: { id: { in: evenements } } });
    await prisma.notification.deleteMany({ where: { userId: { in: users } } });
    await prisma.eventAttendee.deleteMany({ where: { userId: { in: users } } });
    await prisma.event.deleteMany({ where: { id: { in: salons } } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    await prisma.journeyTemplate.deleteMany({ where: { id: { in: modeles } } });
    await prisma.staffUser.deleteMany({ where: { id: { in: equipe } } }).catch(() => undefined);
    await prisma.$disconnect();
  });

  async function dispatch(type: string, aggregateId: string, payload: unknown): Promise<void> {
    await registry.dispatch({ id: newId(), type: type as DomainEventJob['type'], aggregateId, payload, occurredAt: new Date().toISOString() });
  }

  it('deliver() garde l’adresse (url) et pousse notification.new avec le compteur, sans titre ni corps', async () => {
    const a = await member();
    poussees.length = 0;
    const r = await notifications.deliver({
      userId: a.id, category: 'SOCIAL', type: 'social.post_reacted', title: 'Titre secret', refType: 'POST', refId: newId(), url: '/publications/abc',
    });
    expect(r.outcome).toBe('CREATED');
    const row = await prisma.notification.findUniqueOrThrow({ where: { id: r.notificationId as string } });
    expect(row.url).toBe('/publications/abc');

    const liste = await notifications.list(a.id, { limit: 20 });
    expect(liste.items[0]?.url).toBe('/publications/abc');

    expect(poussees).toHaveLength(1);
    expect(poussees[0]).toMatchObject({ userId: a.id, event: 'notification.new' });
    expect(poussees[0]?.payload).toMatchObject({ notificationId: r.notificationId, category: 'SOCIAL', unread: 1 });
    expect(JSON.stringify(poussees)).not.toContain('Titre secret');
  });

  it('un rejeu (doublon) ne pousse rien', async () => {
    const a = await member();
    const input = { userId: a.id, category: 'ACCOUNT' as const, type: 'account.welcome', title: 'Bienvenue', refType: 'USER', refId: newId() };
    await notifications.deliver(input);
    poussees.length = 0;
    expect((await notifications.deliver(input)).outcome).toBe('DUPLICATE');
    expect(poussees).toHaveLength(0);
  });

  it('[08 §3.1] event.checked_in émet connection.suggested dans les DEUX sens, et la notification mène au profil', async () => {
    const a = await member();
    const b = await member();
    const eventId = newId();
    await prisma.event.create({
      data: { id: eventId, organizerUserId: a.id, type: 'PICNIC', title: 'Pique-nique', cityId, addressText: 'Parc', startsAt: new Date(Date.now() - 86_400_000), status: 'DONE' },
    });
    salons.push(eventId);
    for (const u of [a.id, b.id]) {
      await prisma.eventAttendee.create({
        data: { id: newId(), eventId, userId: u, status: 'GOING', respondedAt: new Date(), checkedIn: true },
      });
    }
    const emitted = await connections.emitSuggestions([a.id], 'EVENT', eventId);
    expect(emitted).toBe(2);
    const lignes = await prisma.domainEvent.findMany({ where: { type: 'connection.suggested', aggregateId: { in: [a.id, b.id] } }, select: { id: true, aggregateId: true, payload: true } });
    evenements.push(...lignes.map((l) => l.id));
    expect(lignes.map((l) => l.aggregateId).sort()).toEqual([a.id, b.id].sort());

    for (const l of lignes) await dispatch('connection.suggested', l.aggregateId, l.payload);
    const chezA = await prisma.notification.findFirstOrThrow({ where: { userId: a.id, type: 'social.connection_suggested' } });
    expect(chezA.title).toContain('à vos contacts ?');
    expect(chezA.url).toBe(`/${b.handle}`);
    expect(chezA.refId).toBe(b.id);
  });

  it('emitSuggestions n’émet rien pour des membres déjà en contact, ni pour soi', async () => {
    const a = await member();
    expect(await connections.emitSuggestions([a.id], 'GUIDE', newId())).toBe(0);
  });

  /**
   * ── « LA PROCÉDURE A ÉVOLUÉ » (03 §2.2, §7 — lot F2) ───────────────────────────
   *
   * La publication d'une version archive la précédente ; les parcours en cours
   * restent dessus et leur PROPRIÉTAIRE est prévenu, par l'événement
   * `journey.template_version_published` — jamais par un appel direct (§3.3).
   */
  describe('journey.template_version_published', () => {
    async function modele() {
      const templateId = newId();
      await prisma.journeyTemplate.create({
        data: { id: templateId, code: `pe-${run}-${templateId.slice(-6)}`, nameFr: 'Modèle évolutif', targetPhase: 'PRE_DEPARTURE', isActive: true, sortOrder: 1 },
      });
      modeles.push(templateId);
      const definition = await prisma.stepDefinition.create({
        data: { id: newId(), code: `pe-def-${run}-${templateId.slice(-6)}`, nameFr: 'Étape', description: 'x', category: 'PRE_DEPARTURE', defaultDurationDays: 7, blockerTarget: 'NONE', isMajorMilestone: false, isRisky: false, documentChecklist: [] },
      });
      const v1 = newId();
      await prisma.journeyTemplateVersion.create({ data: { id: v1, templateId, version: 1, status: 'PUBLISHED', publishedAt: new Date() } });
      const v2 = newId();
      await prisma.journeyTemplateVersion.create({ data: { id: v2, templateId, version: 2, status: 'DRAFT' } });
      await prisma.templateStep.create({ data: { id: newId(), templateVersionId: v2, stepDefinitionId: definition.id, position: 1, isOptional: false } });
      return { v1, v2 };
    }
    async function parcours(ownerId: string, versionId: string, title: string, status: 'ACTIVE' | 'COMPLETED' = 'ACTIVE') {
      const id = newId();
      await prisma.journey.create({
        data: { id, ownerUserId: ownerId, templateVersionId: versionId, title, status, originCountryId: countryId, destinationCityId: cityId, lastActivityAt: new Date() },
      });
      return id;
    }

    it('publier une version prévient le propriétaire de chaque parcours resté dessus — et lui seul', async () => {
      const { v1, v2 } = await modele();
      const un = await member();
      const deux = await member();
      const termine = await member();
      const passif = await member();
      const unParcours = await parcours(un.id, v1, 'Mes études à Lyon');
      await parcours(deux.id, v1, 'Premier');
      await parcours(deux.id, v1, 'Second');
      await parcours(termine.id, v1, 'Fini', 'COMPLETED');

      const admin = new AdminJourneysService(prisma, new AuditService(prisma), new OutboxService(prisma));
      const staffId = newId();
      await prisma.staffUser.create({
        data: { id: staffId, email: `pe-${run}-${staffId.slice(-6)}@example.test`, displayName: 'Équipe contenu', passwordHash: 'x', totpSecretEncrypted: Buffer.from('x'), role: 'CONTENT_ADMIN', isActive: true },
      });
      equipe.push(staffId);
      // La publication ÉMET l'événement (relevé en base), qu'on rejoue ensuite par le registre.
      const publiee = await admin.publish({ staffId, role: 'CONTENT_ADMIN', sessionId: newId(), ip: null }, v2, {});
      expect(publiee.journeysNotified).toBe(3); // le parcours terminé ne compte pas
      const emis = await prisma.domainEvent.findFirstOrThrow({ where: { type: 'journey.template_version_published', aggregateId: v2 } });
      evenements.push(emis.id);
      expect((emis.payload as { previousVersionIds: string[] }).previousVersionIds).toEqual([v1]);
      await dispatch('journey.template_version_published', v2, emis.payload);

      const chezUn = await prisma.notification.findMany({ where: { userId: un.id, type: 'journey.template_version_published' } });
      expect(chezUn).toHaveLength(1);
      expect(chezUn[0]?.category).toBe('JOURNEY_DEADLINE');
      expect(chezUn[0]?.title).toBe('La procédure de « Mes études à Lyon » a évolué');
      expect(chezUn[0]?.url).toBe(`/parcours/${unParcours}`);

      // Deux parcours visés : UNE notification, qui mène à la liste.
      const chezDeux = await prisma.notification.findMany({ where: { userId: deux.id, type: 'journey.template_version_published' } });
      expect(chezDeux).toHaveLength(1);
      expect(chezDeux[0]?.title).toBe('La procédure de 2 de vos parcours a évolué');
      expect(chezDeux[0]?.url).toBe('/parcours');

      // Un parcours terminé n'a plus de procédure à suivre ; un membre sans parcours, rien à apprendre.
      for (const aucun of [termine, passif]) {
        expect(await prisma.notification.count({ where: { userId: aucun.id, type: 'journey.template_version_published' } })).toBe(0);
      }

      // Rejeu : aucune seconde notification.
      await dispatch('journey.template_version_published', v2, { templateVersionId: v2, previousVersionIds: [v1] });
      expect(await prisma.notification.count({ where: { userId: un.id, type: 'journey.template_version_published' } })).toBe(1);
    });

    it('sans version précédente, personne n’est prévenu', async () => {
      const a = await member();
      await dispatch('journey.template_version_published', newId(), { templateVersionId: newId(), previousVersionIds: [] });
      expect(await prisma.notification.count({ where: { userId: a.id, type: 'journey.template_version_published' } })).toBe(0);
    });
  });
});
