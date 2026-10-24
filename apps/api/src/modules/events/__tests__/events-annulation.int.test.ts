import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId } from '@app/db';
import { CANCELLED_VISIBLE_DAYS } from '@app/shared';
import { AuditService } from '../../../common/audit.service';
import { OutboxService } from '../../../common/outbox.service';
import { PrismaService } from '../../../common/prisma.service';
import { VisibilityService } from '../../../common/visibility.service';
import { EventsService, ORGANIZER_DELETED_REASON } from '../events.service';

/**
 * Agenda — l'annulation motivée (09 §3.4, §4) et la suppression de compte (§9).
 *
 * Éprouvé en cassant : `hide_cancelled` relu sur `updated_at` fait tomber le test
 * « une modification tardive ne prolonge pas l'affichage » ; un gestionnaire qui
 * oublie la promotion de la file fait tomber « une place libérée promeut ».
 */
describe('agenda — annulation motivée et suppression de compte (09 §3.4, §9)', () => {
  let prisma: PrismaService;
  let events: EventsService;

  const createdUsers: string[] = [];
  const createdEvents: string[] = [];
  let countryId: string;
  let cityId: string;
  let counter = 0;

  async function member(): Promise<string> {
    counter += 1;
    const id = newId();
    await prisma.user.create({
      data: {
        id,
        handle: `ann${counter}${id.slice(-8)}`,
        displayName: `Organisateur ${counter}`,
        phase: 'SETTLED',
        verificationLevel: 'L2',
        originCountryId: countryId,
        plan: 'FREE',
        status: 'ACTIVE',
        cityId,
      },
    });
    createdUsers.push(id);
    return id;
  }

  async function event(
    organizerUserId: string,
    startsInMs: number,
    options: { capacity?: number; status?: 'SCHEDULED' | 'CANCELLED' } = {},
  ): Promise<string> {
    const id = newId();
    await prisma.event.create({
      data: {
        id,
        organizerUserId,
        type: 'PICNIC',
        title: 'Pique-nique du dimanche',
        cityId,
        addressText: 'Parc de la Tête d’Or',
        startsAt: new Date(Date.now() + startsInMs),
        status: options.status ?? 'SCHEDULED',
        ...(options.capacity === undefined ? {} : { capacity: options.capacity }),
      },
    });
    createdEvents.push(id);
    return id;
  }

  async function rsvp(
    eventId: string,
    userId: string,
    status: 'GOING' | 'WAITLIST',
    respondedAt = new Date(),
  ): Promise<void> {
    await prisma.eventAttendee.create({
      data: { id: newId(), eventId, userId, status, respondedAt },
    });
    if (status === 'GOING') {
      await prisma.event.update({ where: { id: eventId }, data: { attendeeCount: { increment: 1 } } });
    }
  }

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    events = new EventsService(
      prisma,
      new OutboxService(prisma),
      new AuditService(prisma),
      new VisibilityService(prisma),
    );
    countryId = (
      await prisma.country.findFirstOrThrow({
        where: { kind: { in: ['ORIGIN', 'BOTH'] } },
        orderBy: { sortOrder: 'asc' },
        select: { id: true },
      })
    ).id;
    cityId = (
      await prisma.city.findFirstOrThrow({ where: { mergedIntoCityId: null }, select: { id: true } })
    ).id;
  });

  afterAll(async () => {
    await prisma.domainEvent.deleteMany({ where: { aggregateId: { in: createdEvents } } });
    await prisma.event.deleteMany({ where: { id: { in: createdEvents } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUsers } } });
    await prisma.$disconnect();
  });

  // ══ Annulation : l’instant et le motif sont stockés ═══════════════════════

  describe('POST /events/:id/cancel', () => {
    it('pose `cancelled_at` et `cancel_reason` sur la ligne, et les rend dans la fiche', async () => {
      const organizer = await member();
      const id = await event(organizer, 3 * 86_400_000);

      const card = await events.cancel(id, organizer, { reason: 'Pluie annoncée toute la journée' });

      expect(card.status).toBe('CANCELLED');
      expect(card.cancelReason).toBe('Pluie annoncée toute la journée');
      expect(card.cancelledAt).toBeInstanceOf(Date);
      const row = await prisma.event.findUniqueOrThrow({ where: { id } });
      expect(row.cancelReason).toBe('Pluie annoncée toute la journée');
      expect(row.cancelledAt).not.toBeNull();
    });

    it('le motif est facultatif', async () => {
      const organizer = await member();
      const id = await event(organizer, 3 * 86_400_000);
      const card = await events.cancel(id, organizer, {});
      expect(card.cancelReason).toBeNull();
      expect(card.cancelledAt).not.toBeNull();
    });

    it('un autre membre ne peut pas annuler (404)', async () => {
      const organizer = await member();
      const stranger = await member();
      const id = await event(organizer, 3 * 86_400_000);
      await expect(events.cancel(id, stranger, {})).rejects.toMatchObject({ status: 404 });
    });
  });

  // ══ hide_cancelled lit `cancelled_at`, pas `updated_at` ═══════════════════

  describe('event.hide_cancelled (09 §3.4)', () => {
    it('masque un événement annulé il y a plus de sept jours, même si `updated_at` est récent', async () => {
      const organizer = await member();
      const id = await event(organizer, 3 * 86_400_000, { status: 'CANCELLED' });
      await prisma.event.update({
        where: { id },
        data: { cancelledAt: new Date(Date.now() - (CANCELLED_VISIBLE_DAYS + 1) * 86_400_000) },
      });

      const { hidden } = await events.hideCancelled();

      expect(hidden).toBeGreaterThanOrEqual(1);
      const row = await prisma.event.findUniqueOrThrow({ where: { id } });
      expect(row.deletedAt).not.toBeNull();
    });

    it('garde visible un événement annulé hier, même si `updated_at` est ancien', async () => {
      const organizer = await member();
      const id = await event(organizer, 3 * 86_400_000, { status: 'CANCELLED' });
      await prisma.event.update({ where: { id }, data: { cancelledAt: new Date(Date.now() - 86_400_000) } });
      // `updated_at` est posé par Prisma à chaque écriture ; on le recule en SQL.
      await prisma.$executeRaw`UPDATE events SET updated_at = now() - interval '30 days' WHERE id = ${id}::uuid`;

      await events.hideCancelled();

      const row = await prisma.event.findUniqueOrThrow({ where: { id } });
      expect(row.deletedAt).toBeNull();
      expect((await events.detail(id, null)).status).toBe('CANCELLED');
    });

    it('la lecture masque aussi un événement annulé depuis plus de sept jours (404)', async () => {
      const organizer = await member();
      const id = await event(organizer, 3 * 86_400_000, { status: 'CANCELLED' });
      await prisma.event.update({
        where: { id },
        data: { cancelledAt: new Date(Date.now() - 8 * 86_400_000) },
      });
      await expect(events.detail(id, null)).rejects.toMatchObject({ status: 404 });
    });
  });

  // ══ Suppression de compte (09 §9) ═════════════════════════════════════════

  describe('gestionnaire de `user.deleted`', () => {
    it('annule les événements à venir de l’organisateur, avec un motif et une notification', async () => {
      const organizer = await member();
      const guest = await member();
      const id = await event(organizer, 3 * 86_400_000);
      await rsvp(id, guest, 'GOING');

      await events.handleUserDeleted(organizer);

      const row = await prisma.event.findUniqueOrThrow({ where: { id } });
      expect(row.status).toBe('CANCELLED');
      expect(row.cancelReason).toBe(ORGANIZER_DELETED_REASON);
      expect(row.cancelledAt).not.toBeNull();
      const emitted = await prisma.domainEvent.findMany({
        where: { aggregateId: id, type: 'event.cancelled' },
      });
      expect(emitted).toHaveLength(1);
    });

    it('conserve les événements passés de l’organisateur', async () => {
      const organizer = await member();
      const id = await event(organizer, -3 * 86_400_000);
      await events.handleUserDeleted(organizer);
      const row = await prisma.event.findUniqueOrThrow({ where: { id } });
      expect(row.status).toBe('SCHEDULED');
      expect(row.cancelledAt).toBeNull();
    });

    it('supprime les RSVP du membre à des événements à venir et corrige le compteur', async () => {
      const organizer = await member();
      const leaver = await member();
      const id = await event(organizer, 3 * 86_400_000, { capacity: 5 });
      await rsvp(id, leaver, 'GOING');

      await events.handleUserDeleted(leaver);

      expect(await prisma.eventAttendee.count({ where: { userId: leaver } })).toBe(0);
      expect((await prisma.event.findUniqueOrThrow({ where: { id } })).attendeeCount).toBe(0);
    });

    it('une place libérée promeut le premier de la liste d’attente', async () => {
      const organizer = await member();
      const leaver = await member();
      const waiting = await member();
      const id = await event(organizer, 3 * 86_400_000, { capacity: 1 });
      await rsvp(id, leaver, 'GOING');
      await rsvp(id, waiting, 'WAITLIST');

      await events.handleUserDeleted(leaver);

      const promoted = await prisma.eventAttendee.findUniqueOrThrow({
        where: { eventId_userId: { eventId: id, userId: waiting } },
      });
      expect(promoted.status).toBe('GOING');
      expect((await prisma.event.findUniqueOrThrow({ where: { id } })).attendeeCount).toBe(1);
    });

    it('conserve la présence cochée d’un événement passé (l’indicateur d’impact ne s’efface pas)', async () => {
      const organizer = await member();
      const leaver = await member();
      const id = await event(organizer, -2 * 86_400_000);
      await prisma.eventAttendee.create({
        data: { id: newId(), eventId: id, userId: leaver, status: 'GOING', respondedAt: new Date(), checkedIn: true },
      });

      await events.handleUserDeleted(leaver);

      expect(await prisma.eventAttendee.count({ where: { userId: leaver, checkedIn: true } })).toBe(1);
    });

    it('est idempotent : un rejeu n’émet rien de plus', async () => {
      const organizer = await member();
      const id = await event(organizer, 3 * 86_400_000);
      await events.handleUserDeleted(organizer);
      await events.handleUserDeleted(organizer);
      const emitted = await prisma.domainEvent.count({ where: { aggregateId: id, type: 'event.cancelled' } });
      expect(emitted).toBe(1);
    });
  });
});
