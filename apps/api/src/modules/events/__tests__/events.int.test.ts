import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId } from '@app/db';
import { CANCELLED_VISIBLE_DAYS, EVENT_MAX_LEAD_MS, EVENT_MIN_LEAD_MS, EVENT_ORGANIZED_MIN_CHECKINS, calendarQuerySchema, createEventSchema, rsvpSchema } from '@app/shared';
import { AuditService } from '../../../common/audit.service';
import { OutboxService } from '../../../common/outbox.service';
import { PrismaService } from '../../../common/prisma.service';
import { VisibilityService } from '../../../common/visibility.service';
import {
  EventsService,
  haversineKm,
  localDate,
  monthKey,
  nextLocalDate,
  startOfLocalDay,
} from '../events.service';

/**
 * Agenda — 09-villes-agenda.md §3, §5 et §10.
 *
 * Les cinq règles dures du §10 ont chacune leur test, et chacun a été éprouvé en
 * cassant volontairement la règle : un test qui passe aussi avec le bogue ne
 * protège rien.
 *
 * Les tests appellent le SERVICE, pas HTTP : la capacité (`event.create`, L1) est
 * l'affaire du garde, vérifiée par capability-coverage.int.test.ts, et la faire
 * passer ici demanderait un jeton par cas sans rien ajouter aux règles du §3.
 */
describe('agenda (09 §3)', () => {
  let prisma: PrismaService;
  let events: EventsService;

  const createdUsers: string[] = [];
  const createdCommunities: string[] = [];
  const createdEvents: string[] = [];
  const createdMediaIds: string[] = [];

  let originCountryId: string;
  /** Deux villes proches (≤ 30 km) et une lointaine, pour le rayon du §2.2. */
  let paris: { id: string; slug: string };
  let nearParis: { id: string; slug: string };
  let farCity: { id: string; slug: string };

  let counter = 0;

  async function member(
    options: { plan?: 'FREE' | 'PREMIUM'; cityId?: string | null } = {},
  ): Promise<string> {
    counter += 1;
    const id = newId();
    await prisma.user.create({
      data: {
        id,
        handle: `ag${counter}${id.slice(-8)}`,
        displayName: `Membre ${counter}`,
        phase: 'RECENT_ARRIVAL',
        verificationLevel: 'L1',
        originCountryId,
        plan: options.plan ?? 'FREE',
        status: 'ACTIVE',
        ...(options.cityId === undefined ? { cityId: paris.id } : { cityId: options.cityId }),
      },
    });
    createdUsers.push(id);
    return id;
  }

  /** Un début valide : bien au-delà de +2 h, bien en dessous de 6 mois. */
  function soon(offsetMs = 3 * 86_400_000): Date {
    return new Date(Date.now() + offsetMs);
  }

  async function newEvent(
    organizerUserId: string,
    overrides: Partial<Parameters<EventsService['create']>[1]> = {},
  ) {
    const event = await events.create(organizerUserId, {
      type: 'PICNIC',
      title: 'Pique-nique du dimanche',
      cityId: paris.id,
      addressText: 'Parc de la Tête d’Or, entrée nord',
      startsAt: soon(),
      ...overrides,
    });
    createdEvents.push(event.id);
    return event;
  }

  /** Un événement PASSÉ : impossible par l'API (TOO_SOON), donc posé en base. */
  async function pastEvent(
    organizerUserId: string,
    startsAt: Date,
    endsAt: Date | null = null,
  ): Promise<string> {
    const id = newId();
    await prisma.event.create({
      data: {
        id,
        organizerUserId,
        type: 'PICNIC',
        title: 'Événement passé',
        cityId: paris.id,
        addressText: 'Quelque part',
        startsAt,
        endsAt,
        status: 'SCHEDULED',
      },
    });
    await prisma.eventAttendee.create({
      data: { id: newId(), eventId: id, userId: organizerUserId, status: 'GOING', respondedAt: startsAt },
    });
    await prisma.event.update({ where: { id }, data: { attendeeCount: 1 } });
    createdEvents.push(id);
    return id;
  }

  async function attend(eventId: string, userId: string, checkedIn: boolean): Promise<void> {
    await prisma.eventAttendee.create({
      data: { id: newId(), eventId, userId, status: 'GOING', respondedAt: new Date(), checkedIn },
    });
  }

  async function community(ownerUserId: string): Promise<string> {
    const id = newId();
    counter += 1;
    await prisma.community.create({
      data: {
        id,
        kind: 'INTEREST',
        name: `Réseau ${counter}`,
        slug: `reseau-test-${counter}-${id.slice(-8)}`,
        visibility: 'PUBLIC',
        createdByUserId: ownerUserId,
        status: 'ACTIVE',
        lastActivityAt: new Date(),
      },
    });
    createdCommunities.push(id);
    await prisma.communityMember.create({
      data: { id: newId(), communityId: id, userId: ownerUserId, role: 'OWNER', status: 'ACTIVE' },
    });
    return id;
  }

  async function domainEvents(aggregateId: string, type: string) {
    return prisma.domainEvent.findMany({ where: { aggregateId, type }, orderBy: { createdAt: 'asc' } });
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

    const country = await prisma.country.findFirstOrThrow({
      where: { isActive: true, kind: { in: ['ORIGIN', 'BOTH'] } },
      select: { id: true },
    });
    originCountryId = country.id;

    paris = await prisma.city.findFirstOrThrow({
      where: { slug: 'paris' },
      select: { id: true, slug: true },
    });

    // Les villes viennent du référentiel amorcé : on CHOISIT une voisine et une
    // lointaine d'après les coordonnées réelles, plutôt que d'en supposer une.
    const all = await prisma.city.findMany({
      select: { id: true, slug: true, latitude: true, longitude: true },
    });
    const center = all.find((c) => c.slug === 'paris');
    if (center === undefined) throw new Error('Ville de référence absente du référentiel.');
    const withDistance = all
      .filter((c) => c.slug !== 'paris')
      .map((c) => ({
        city: { id: c.id, slug: c.slug },
        km: haversineKm(
          Number(center.latitude),
          Number(center.longitude),
          Number(c.latitude),
          Number(c.longitude),
        ),
      }));
    const near = withDistance.filter((c) => c.km <= 30).sort((a, b) => a.km - b.km)[0];
    const far = withDistance.sort((a, b) => b.km - a.km)[0];
    if (near === undefined || far === undefined) throw new Error('Référentiel de villes trop pauvre.');
    nearParis = near.city;
    farCity = far.city;
  });

  afterAll(async () => {
    if (createdEvents.length > 0) {
      await prisma.event.deleteMany({ where: { id: { in: createdEvents } } });
    }
    if (createdUsers.length > 0) {
      await prisma.event.deleteMany({ where: { organizerUserId: { in: createdUsers } } });
      // APRÈS les événements, AVANT les membres : `events.cover_asset_id` référence
      // le média, et `media_assets.owner_user_id` le membre. La base est PARTAGÉE,
      // et un reste d'ici ferait échouer une autre suite sur une clé étrangère.
      if (createdMediaIds.length > 0) {
        await prisma.mediaAsset.deleteMany({ where: { id: { in: createdMediaIds } } });
      }
      await prisma.user.deleteMany({ where: { id: { in: createdUsers } } });
    }
    if (createdCommunities.length > 0) {
      await prisma.community.deleteMany({ where: { id: { in: createdCommunities } } });
    }
    await prisma.$disconnect();
  });

  // ══ RÈGLE DURE §10 · quota mensuel ════════════════════════════════════════

  describe('rule: la limite d’un événement par mois est appliquée côté serveur en gratuit', () => {
    it('refuse le deuxième événement du mois en plan gratuit', async () => {
      const organizer = await member({ plan: 'FREE' });
      await newEvent(organizer);

      await expect(newEvent(organizer)).rejects.toMatchObject({ code: 'PLAN_LIMIT_REACHED' });

      // Et le compteur reste à 1 : l'incrément de la tentative refusée est annulé
      // avec sa transaction. S'il restait à 2, le membre perdrait le mois suivant.
      const counters = await prisma.usageCounter.findMany({
        where: { userId: organizer, metric: 'EVENTS_CREATED' },
      });
      expect(counters).toHaveLength(1);
      expect(counters[0]?.count).toBe(1);
      expect(counters[0]?.periodKey).toBe(monthKey(new Date()));
    });

    it('n’applique aucune limite en Premium', async () => {
      const organizer = await member({ plan: 'PREMIUM' });
      await newEvent(organizer);
      await newEvent(organizer);
      const third = await newEvent(organizer);
      expect(third.id).toBeDefined();
      // Aucun compteur n'est même ouvert : la lecture du plan court-circuite.
      expect(
        await prisma.usageCounter.count({ where: { userId: organizer, metric: 'EVENTS_CREATED' } }),
      ).toBe(0);
    });

    it('rend le crédit d’un événement annulé dans l’heure (§3.1)', async () => {
      const organizer = await member({ plan: 'FREE' });
      const event = await newEvent(organizer);

      await events.cancel(event.id, organizer, { reason: 'Météo' });

      const counters = await prisma.usageCounter.findFirstOrThrow({
        where: { userId: organizer, metric: 'EVENTS_CREATED' },
      });
      expect(counters.count).toBe(0);
      // Et le membre peut réellement recréer : le compteur n'est pas décoratif.
      await expect(newEvent(organizer)).resolves.toBeDefined();
    });

    it('ne rend PAS le crédit d’un événement annulé plus d’une heure après', async () => {
      const organizer = await member({ plan: 'FREE' });
      const event = await newEvent(organizer);
      // On vieillit la création : l'annulation tardive garde le crédit consommé,
      // sinon annuler et recréer indéfiniment contournerait la limite.
      await prisma.event.update({
        where: { id: event.id },
        data: { createdAt: new Date(Date.now() - 3 * 3_600_000) },
      });

      await events.cancel(event.id, organizer, {});

      const counter = await prisma.usageCounter.findFirstOrThrow({
        where: { userId: organizer, metric: 'EVENTS_CREATED' },
      });
      expect(counter.count).toBe(1);
      await expect(newEvent(organizer)).rejects.toMatchObject({ code: 'PLAN_LIMIT_REACHED' });
    });
  });

  // ══ RÈGLE DURE §10 · réputation et présence ═══════════════════════════════

  describe('rule: EVENT_ORGANIZED n’est crédité qu’avec au moins 3 présents cochés', () => {
    it('ne crédite pas un événement à 2 présents', async () => {
      const organizer = await member();
      const eventId = await pastEvent(organizer, new Date(Date.now() - 30 * 3_600_000));
      const second = await member();
      await attend(eventId, second, true);
      await prisma.eventAttendee.updateMany({
        where: { eventId, userId: organizer },
        data: { checkedIn: true },
      });

      await events.markDone();

      const event = await prisma.event.findUniqueOrThrow({ where: { id: eventId } });
      expect(event.status).toBe('DONE');
      expect(
        await prisma.reputationEvent.count({
          where: { userId: organizer, type: 'EVENT_ORGANIZED', sourceId: eventId },
        }),
      ).toBe(0);

      const [emitted] = await domainEvents(eventId, 'event.done');
      expect(emitted?.payload).toMatchObject({ checkedInCount: 2, reputationCredited: false });
    });

    it('crédite un événement à 3 présents, une seule fois', async () => {
      const organizer = await member();
      const eventId = await pastEvent(organizer, new Date(Date.now() - 30 * 3_600_000));
      for (const _ of [1, 2]) await attend(eventId, await member(), true);
      await prisma.eventAttendee.updateMany({
        where: { eventId, userId: organizer },
        data: { checkedIn: true },
      });
      expect(await prisma.eventAttendee.count({ where: { eventId, checkedIn: true } })).toBe(
        EVENT_ORGANIZED_MIN_CHECKINS,
      );

      await events.markDone();
      // Rejoué : la boîte d'envoi livre « au moins une fois » (00 §9.1), donc le
      // crédit doit être idempotent. La contrainte d'unicité de reputation_events
      // le garantit — ce test vérifie qu'on s'appuie dessus et qu'on ne lève pas.
      await events.markDone();

      expect(
        await prisma.reputationEvent.count({
          where: { userId: organizer, type: 'EVENT_ORGANIZED', sourceId: eventId },
        }),
      ).toBe(1);
    });

    it('ne crédite jamais un événement sans aucune présence enregistrée', async () => {
      const organizer = await member();
      const eventId = await pastEvent(organizer, new Date(Date.now() - 30 * 3_600_000));

      await events.markDone();

      expect(
        await prisma.reputationEvent.count({ where: { sourceId: eventId } }),
      ).toBe(0);
      // §3.3 : « évite les événements fantômes ». Un événement passé sans présence
      // passe bien à DONE — c'est la réputation qui n'est pas due, pas le statut.
      expect((await prisma.event.findUniqueOrThrow({ where: { id: eventId } })).status).toBe('DONE');
    });

    it('n’achève un événement qu’après la fenêtre du §3.3', async () => {
      const organizer = await member();
      // Fin il y a 2 h : la règle est 12 h après la fin. Trop tôt.
      const recent = await pastEvent(
        organizer,
        new Date(Date.now() - 5 * 3_600_000),
        new Date(Date.now() - 2 * 3_600_000),
      );
      // Sans fin, la bascule est à début + 4 h : 3 h, trop tôt aussi.
      const started = await pastEvent(organizer, new Date(Date.now() - 3 * 3_600_000));

      await events.markDone();

      expect((await prisma.event.findUniqueOrThrow({ where: { id: recent } })).status).toBe('SCHEDULED');
      expect((await prisma.event.findUniqueOrThrow({ where: { id: started } })).status).toBe('SCHEDULED');
    });
  });

  // ══ RÈGLE DURE §10 · événement réservé à un réseau ════════════════════════

  describe('rule: un événement réservé à un réseau n’est pas renvoyé à un non-membre', () => {
    it('renvoie 404 — et non 403 — au non-membre, et la fiche au membre', async () => {
      const organizer = await member();
      const communityId = await community(organizer);
      const event = await newEvent(organizer, { communityId });

      const outsider = await member();
      await expect(events.detail(event.id, outsider)).rejects.toMatchObject({ code: 'NOT_FOUND' });
      // Un visiteur non connecté non plus : un réseau n'est pas public.
      await expect(events.detail(event.id, null)).rejects.toMatchObject({ code: 'NOT_FOUND' });

      const insider = await member();
      await prisma.communityMember.create({
        data: { id: newId(), communityId, userId: insider, role: 'MEMBER', status: 'ACTIVE' },
      });
      await expect(events.detail(event.id, insider)).resolves.toMatchObject({ id: event.id });
    });

    it('l’exclut aussi des LISTES d’un non-membre', async () => {
      const organizer = await member();
      const communityId = await community(organizer);
      const reserved = await newEvent(organizer, { communityId });
      const publicOne = await newEvent(organizer, { title: 'Ouvert à tous' }).catch(async () => {
        // L'organisateur gratuit a déjà consommé son mois : on passe en Premium
        // plutôt que d'affaiblir le test en réutilisant le même événement.
        await prisma.user.update({ where: { id: organizer }, data: { plan: 'PREMIUM' } });
        return newEvent(organizer, { title: 'Ouvert à tous' });
      });

      const outsider = await member();
      const page = await events.list(
        { scope: 'all', radiusKm: 30, limit: 50 } as never,
        outsider,
      );
      const ids = page.items.map((item) => item.id);
      expect(ids).toContain(publicOne.id);
      expect(ids).not.toContain(reserved.id);
    });

    it('refuse de créer un événement pour un réseau dont on n’est pas membre', async () => {
      const owner = await member();
      const communityId = await community(owner);
      const stranger = await member();

      await expect(
        newEvent(stranger, { communityId }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  });

  // ══ RÈGLE DURE §10 · aucun géocodage ══════════════════════════════════════

  describe('rule: aucune adresse d’événement n’est envoyée à un service de géocodage', () => {
    it('stocke l’adresse telle quelle et n’expose aucune coordonnée', async () => {
      const organizer = await member();
      const address = '12 rue des Lilas, bâtiment C, code 4512B';
      const event = await newEvent(organizer, { addressText: address, venueName: 'Chez Awa' });

      const stored = await prisma.event.findUniqueOrThrow({
        where: { id: event.id },
        select: { addressText: true, venueName: true },
      });
      // Octet pour octet : ni normalisation, ni « adresse corrigée » par un tiers.
      expect(stored.addressText).toBe(address);
      expect(stored.venueName).toBe('Chez Awa');

      const card = JSON.stringify(await events.detail(event.id, organizer));
      expect(card).not.toMatch(/latitude|longitude|"lat"|"lng"|placeId/i);
    });

    it('le module ne contient aucun appel sortant', () => {
      // La règle porte sur un appel RÉSEAU : la seule vérification qui vaille est
      // qu'il n'y en ait aucun à écrire. Un test de comportement ne prouverait
      // rien — un géocodeur ajouté demain passerait tous les autres tests.
      const here = join(__dirname, '..');
      for (const file of ['events.service.ts', 'events.controller.ts']) {
        const source = readFileSync(join(here, file), 'utf8');
        expect(source, `${file} ne doit faire aucun appel sortant`).not.toMatch(
          /\bfetch\s*\(|\baxios\b|node:https?|https?:\/\/[a-z]|nominatim|mapbox|googleapis|geocoder/i,
        );
      }
    });
  });

  // ══ Blocage (§3.2 et 08 §4) ═══════════════════════════════════════════════

  describe('blocage : impossible de RSVP à l’événement d’un membre bloqué', () => {
    it('refuse dans les DEUX sens, en 404', async () => {
      const organizer = await member();
      const event = await newEvent(organizer);
      const other = await member();

      // 1) L'autre a bloqué l'organisateur.
      await prisma.block.create({
        data: { id: newId(), blockerUserId: other, blockedUserId: organizer },
      });
      await expect(events.rsvp(event.id, other, { status: 'GOING' })).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
      expect(
        await prisma.eventAttendee.count({ where: { eventId: event.id, userId: other } }),
      ).toBe(0);

      // 2) Sens inverse : c'est l'ORGANISATEUR qui a bloqué. Le bloqué ne doit pas
      //    davantage pouvoir s'inscrire — un blocage est une séparation (08 §4).
      await prisma.block.deleteMany({ where: { blockerUserId: other, blockedUserId: organizer } });
      await prisma.block.create({
        data: { id: newId(), blockerUserId: organizer, blockedUserId: other },
      });
      await expect(events.rsvp(event.id, other, { status: 'GOING' })).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('retire l’événement d’un membre bloqué des listes', async () => {
      const organizer = await member({ plan: 'PREMIUM' });
      const event = await newEvent(organizer);
      const other = await member();

      const before = await events.list({ scope: 'all', radiusKm: 30, limit: 50 } as never, other);
      expect(before.items.map((i) => i.id)).toContain(event.id);

      await prisma.block.create({
        data: { id: newId(), blockerUserId: organizer, blockedUserId: other },
      });
      const after = await events.list({ scope: 'all', radiusKm: 30, limit: 50 } as never, other);
      expect(after.items.map((i) => i.id)).not.toContain(event.id);
    });
  });

  // ══ Capacité et liste d'attente (§3.2) ════════════════════════════════════

  describe('liste d’attente (§3.2)', () => {
    it('met en WAITLIST quand la capacité est atteinte, puis promeut à la désinscription', async () => {
      const organizer = await member();
      // Capacité 2 : l'organisateur occupe une place, il reste une seule chaise.
      const event = await newEvent(organizer, { capacity: 2 });
      expect(event.attendeeCount).toBe(1);

      const first = await member();
      const second = await member();
      const third = await member();

      expect(await events.rsvp(event.id, first, { status: 'GOING' })).toMatchObject({
        status: 'GOING',
        attendeeCount: 2,
      });

      // Complet : pas d'erreur, une place dans la file — et une POSITION, sinon
      // le membre ne sait pas s'il est deuxième ou vingtième.
      expect(await events.rsvp(event.id, second, { status: 'GOING' })).toMatchObject({
        status: 'WAITLIST',
        waitlistPosition: 1,
      });
      expect(await events.rsvp(event.id, third, { status: 'GOING' })).toMatchObject({
        status: 'WAITLIST',
        waitlistPosition: 2,
      });

      // Une désinscription libère une place : le PREMIER de la file passe GOING,
      // et lui seul (§3.2 : « promotion automatique à la première désinscription »).
      await events.withdraw(event.id, first);

      const statuses = await prisma.eventAttendee.findMany({
        where: { eventId: event.id },
        select: { userId: true, status: true },
      });
      const byUser = new Map(statuses.map((s) => [s.userId, s.status]));
      expect(byUser.get(second)).toBe('GOING');
      expect(byUser.get(third)).toBe('WAITLIST');
      expect(byUser.has(first)).toBe(false);

      const fresh = await prisma.event.findUniqueOrThrow({ where: { id: event.id } });
      expect(fresh.attendeeCount).toBe(2);

      // La promotion doit être NOTIFIABLE : elle voyage dans l'événement de
      // domaine, sinon le promu ne l'apprend jamais.
      const emitted = await domainEvents(event.id, 'event.rsvp_changed');
      expect(
        emitted.some((e) => (e.payload as { promotedUserId?: string }).promotedUserId === second),
      ).toBe(true);
    });

    it('ne promeut personne quand l’événement n’a pas de capacité', async () => {
      const organizer = await member();
      const event = await newEvent(organizer);
      const guest = await member();

      await events.rsvp(event.id, guest, { status: 'GOING' });
      const result = await events.rsvp(event.id, guest, { status: 'DECLINED' });
      expect(result.status).toBe('DECLINED');
      expect(result.attendeeCount).toBe(1);
    });

    it('n’accepte pas WAITLIST demandé par le client', () => {
      // Le schéma refuse la valeur : c'est une décision du serveur (§3.2).
      expect(rsvpSchema.safeParse({ status: 'WAITLIST' }).success).toBe(false);
      expect(rsvpSchema.safeParse({ status: 'GOING' }).success).toBe(true);
    });

    it('libère une place quand un GOING passe à MAYBE', async () => {
      const organizer = await member();
      const event = await newEvent(organizer, { capacity: 2 });
      const going = await member();
      const waiting = await member();

      await events.rsvp(event.id, going, { status: 'GOING' });
      await events.rsvp(event.id, waiting, { status: 'GOING' });

      // « Peut-être » n'occupe pas de place : la file doit avancer, sinon une
      // chaise reste vide alors que quelqu'un l'attend.
      await events.rsvp(event.id, going, { status: 'MAYBE' });

      const promoted = await prisma.eventAttendee.findFirstOrThrow({
        where: { eventId: event.id, userId: waiting },
      });
      expect(promoted.status).toBe('GOING');
    });
  });

  // ══ Bornes de création (§3.1) ═════════════════════════════════════════════

  describe('bornes de création (§3.1)', () => {
    it('refuse un début à moins de 2 h', async () => {
      const organizer = await member();
      await expect(
        newEvent(organizer, { startsAt: new Date(Date.now() + EVENT_MIN_LEAD_MS - 60_000) }),
      ).rejects.toMatchObject({ code: 'TOO_SOON' });
      // Aucun quota consommé par un refus : les bornes passent avant le compteur.
      expect(
        await prisma.usageCounter.count({ where: { userId: organizer, metric: 'EVENTS_CREATED' } }),
      ).toBe(0);
    });

    it('refuse un début à plus de 6 mois', async () => {
      const organizer = await member();
      await expect(
        newEvent(organizer, { startsAt: new Date(Date.now() + EVENT_MAX_LEAD_MS + 86_400_000) }),
      ).rejects.toMatchObject({ code: 'TOO_FAR' });
    });

    it('exige une adresse : aucun événement en ligne (§3.5)', () => {
      const base = {
        type: 'CONFERENCE',
        title: 'Conférence en ligne',
        cityId: paris.id,
        startsAt: soon().toISOString(),
      };
      expect(createEventSchema.safeParse(base).success).toBe(false);
      expect(
        createEventSchema.safeParse({ ...base, addressText: 'Maison des associations' }).success,
      ).toBe(true);
    });

    it('refuse une fin avant le début', async () => {
      const organizer = await member();
      const parsed = createEventSchema.safeParse({
        type: 'PICNIC',
        title: 'Pique-nique inversé',
        cityId: paris.id,
        addressText: 'Parc',
        startsAt: soon().toISOString(),
        endsAt: soon(2 * 86_400_000).toISOString(),
      });
      expect(parsed.success).toBe(false);
      expect(organizer).toBeDefined();
    });
  });

  // ══ Modification et annulation (§3.1, §3.4) ═══════════════════════════════

  describe('modification et annulation', () => {
    it('refuse la modification après le début (EVENT_STARTED)', async () => {
      const organizer = await member();
      const event = await newEvent(organizer);
      await prisma.event.update({
        where: { id: event.id },
        data: { startsAt: new Date(Date.now() - 3_600_000) },
      });

      await expect(
        events.update(event.id, organizer, { title: 'Nouveau titre' }),
      ).rejects.toMatchObject({ code: 'EVENT_STARTED' });
    });

    it('refuse la modification par un autre membre, en 404', async () => {
      const organizer = await member();
      const event = await newEvent(organizer);
      const intruder = await member();

      await expect(
        events.update(event.id, intruder, { title: 'Détournement' }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('signale un changement de date ou de lieu, pas un changement de titre', async () => {
      const organizer = await member({ plan: 'PREMIUM' });
      const titleOnly = await newEvent(organizer);
      await events.update(titleOnly.id, organizer, { title: 'Un titre plus clair' });
      const emittedTitle = await domainEvents(titleOnly.id, 'event.updated');
      expect((emittedTitle[0]?.payload as { notifyAttendees: boolean }).notifyAttendees).toBe(false);

      const moved = await newEvent(organizer);
      await events.update(moved.id, organizer, { startsAt: soon(5 * 86_400_000) });
      const emittedMove = await domainEvents(moved.id, 'event.updated');
      // §3.1 : « les participants sont notifiés d'un changement de date, d'heure
      // ou de lieu ». Sans ce drapeau, personne ne saurait quoi notifier.
      expect((emittedMove[0]?.payload as { notifyAttendees: boolean }).notifyAttendees).toBe(true);
    });

    it('garde un événement annulé visible 7 jours, puis le masque', async () => {
      const organizer = await member();
      const event = await newEvent(organizer);
      await events.cancel(event.id, organizer, { reason: 'Pluie' });

      const visible = await events.detail(event.id, organizer);
      expect(visible.status).toBe('CANCELLED');

      // Le motif n'a pas de colonne : il vit dans l'événement de domaine et le
      // journal d'audit. Il doit donc s'y trouver, sinon il est perdu.
      const [emitted] = await domainEvents(event.id, 'event.cancelled');
      expect(emitted?.payload).toMatchObject({ reason: 'Pluie' });

      await prisma.event.update({
        where: { id: event.id },
        data: { updatedAt: new Date(Date.now() - (CANCELLED_VISIBLE_DAYS + 1) * 86_400_000) },
      });
      await expect(events.detail(event.id, organizer)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('la tâche hide_cancelled supprime logiquement au-delà de 7 jours', async () => {
      const organizer = await member();
      const event = await newEvent(organizer);
      await events.cancel(event.id, organizer, {});
      await prisma.event.update({
        where: { id: event.id },
        data: { updatedAt: new Date(Date.now() - (CANCELLED_VISIBLE_DAYS + 2) * 86_400_000) },
      });

      const result = await events.hideCancelled();
      expect(result.hidden).toBeGreaterThanOrEqual(1);
      const row = await prisma.event.findUniqueOrThrow({ where: { id: event.id } });
      expect(row.deletedAt).not.toBeNull();
    });

    it('interdit le RSVP sur un événement annulé', async () => {
      const organizer = await member();
      const event = await newEvent(organizer);
      await events.cancel(event.id, organizer, {});
      const guest = await member();

      await expect(events.rsvp(event.id, guest, { status: 'GOING' })).rejects.toMatchObject({
        code: 'CONFLICT',
      });
    });
  });

  // ══ Présence (§3.3) ═══════════════════════════════════════════════════════

  describe('présence (§3.3)', () => {
    it('refuse la présence avant le début', async () => {
      const organizer = await member();
      const event = await newEvent(organizer);

      await expect(events.checkIn(event.id, organizer, {})).rejects.toMatchObject({
        code: 'CHECKIN_WINDOW_CLOSED',
      });
    });

    it('ferme « Je suis là » à H+6 pour le participant, mais pas pour l’organisateur', async () => {
      const organizer = await member();
      const eventId = await pastEvent(organizer, new Date(Date.now() - 7 * 3_600_000));
      const guest = await member();
      await attend(eventId, guest, false);

      // H+7 : la fenêtre du participant (H−0 → H+6) est passée.
      await expect(events.checkIn(eventId, guest, {})).rejects.toMatchObject({
        code: 'CHECKIN_WINDOW_CLOSED',
      });
      // L'organisateur, lui, coche encore : sa feuille de présence se remplit
      // quand tout le monde est reparti (§3.3, « après le début »).
      const result = await events.checkIn(eventId, organizer, { userIds: [guest] });
      expect(result.checkedIn).toEqual([guest]);
    });

    it('n’autorise personne à cocher un autre membre', async () => {
      const organizer = await member();
      const eventId = await pastEvent(organizer, new Date(Date.now() - 3_600_000));
      const a = await member();
      const b = await member();
      await attend(eventId, a, false);
      await attend(eventId, b, false);

      await expect(events.checkIn(eventId, a, { userIds: [b] })).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
      expect(
        (await prisma.eventAttendee.findFirstOrThrow({ where: { eventId, userId: b } })).checkedIn,
      ).toBe(false);
    });

    it('ne coche que des inscrits, et n’émet rien pour un doublon', async () => {
      const organizer = await member();
      const eventId = await pastEvent(organizer, new Date(Date.now() - 3_600_000));
      const outsider = await member();
      // Celui-là a répondu « je ne viens pas » : le cocher présent serait une
      // contradiction, et c'est le cas que le filtre de statut attrape.
      const declined = await member();
      await prisma.eventAttendee.create({
        data: {
          id: newId(),
          eventId,
          userId: declined,
          status: 'DECLINED',
          respondedAt: new Date(),
        },
      });

      const first = await events.checkIn(eventId, organizer, {
        userIds: [organizer, outsider, declined],
      });
      // `outsider` n'a pas répondu : le cocher inventerait une présence, et
      // l'indicateur clé compte « les inscrits qui participent ».
      expect(first.checkedIn).toEqual([organizer]);
      expect(
        (await prisma.eventAttendee.findFirstOrThrow({ where: { eventId, userId: declined } }))
          .checkedIn,
      ).toBe(false);

      const again = await events.checkIn(eventId, organizer, { userIds: [organizer] });
      expect(again.checkedIn).toEqual([]);
      expect(await domainEvents(eventId, 'event.checked_in')).toHaveLength(1);
    });

    it('accepte « Je suis là » pendant l’événement', async () => {
      const organizer = await member();
      const eventId = await pastEvent(organizer, new Date(Date.now() - 3_600_000));
      const guest = await member();
      await attend(eventId, guest, false);

      const result = await events.checkIn(eventId, guest, {});
      expect(result.checkedIn).toEqual([guest]);
      expect(result.checkedInCount).toBe(1);
    });
  });

  // ══ Fuseaux (§3.5 et T4 §1) ═══════════════════════════════════════════════

  describe('fuseaux horaires', () => {
    it('range un événement de fin de soirée sur son jour LOCAL, pas son jour UTC', () => {
      // 23 h 30 UTC en janvier = 00 h 30 le lendemain à Paris.
      const instant = new Date('2027-01-15T23:30:00Z');
      expect(instant.toISOString().slice(0, 10)).toBe('2027-01-15');
      expect(localDate(instant, 'Europe/Paris')).toBe('2027-01-16');
      // En juillet, Paris est à UTC+2 : 22 h 30 UTC basculent déjà.
      expect(localDate(new Date('2027-07-15T22:30:00Z'), 'Europe/Paris')).toBe('2027-07-16');
    });

    it('calcule le début du jour local des deux côtés d’un changement d’heure', () => {
      // Hiver : minuit à Paris = 23 h UTC la veille.
      expect(startOfLocalDay('2027-01-15', 'Europe/Paris').toISOString()).toBe(
        '2027-01-14T23:00:00.000Z',
      );
      // Été : minuit à Paris = 22 h UTC la veille.
      expect(startOfLocalDay('2027-07-15', 'Europe/Paris').toISOString()).toBe(
        '2027-07-14T22:00:00.000Z',
      );
      // La nuit même du passage à l'heure d'été (28 mars 2027, 2 h → 3 h).
      expect(startOfLocalDay('2027-03-28', 'Europe/Paris').toISOString()).toBe(
        '2027-03-27T23:00:00.000Z',
      );
      expect(startOfLocalDay('2027-03-29', 'Europe/Paris').toISOString()).toBe(
        '2027-03-28T22:00:00.000Z',
      );
      expect(nextLocalDate('2027-02-28')).toBe('2027-03-01');
    });

    it('filtre `date` sur le jour de la ville et sort les instants en UTC', async () => {
      const organizer = await member();
      // Un événement dont le jour UTC et le jour parisien diffèrent.
      const startsAt = new Date(Date.now() + 10 * 86_400_000);
      startsAt.setUTCHours(23, 30, 0, 0);
      const event = await newEvent(organizer, { startsAt });

      const utcDay = startsAt.toISOString().slice(0, 10);
      const localDay = localDate(startsAt, 'Europe/Paris');
      expect(localDay).not.toBe(utcDay);

      const onLocal = await events.list(
        { scope: 'all', radiusKm: 30, limit: 50, date: localDay } as never,
        organizer,
      );
      expect(onLocal.items.map((i) => i.id)).toContain(event.id);

      const onUtc = await events.list(
        { scope: 'all', radiusKm: 30, limit: 50, date: utcDay } as never,
        organizer,
      );
      expect(onUtc.items.map((i) => i.id)).not.toContain(event.id);

      // T4 §1 : les dates SORTENT en ISO 8601 UTC. Le jour local est un champ à
      // part — le front n'a pas à le recalculer, ni à convertir l'instant.
      const card = onLocal.items.find((i) => i.id === event.id);
      expect(card?.startsAt.toISOString()).toBe(startsAt.toISOString());
      expect(card?.localDate).toBe(localDay);
      expect(card?.timeZone).toBe('Europe/Paris');
    });

    it('place le même événement au bon jour du calendrier', async () => {
      const organizer = await member();
      const startsAt = new Date(Date.now() + 12 * 86_400_000);
      startsAt.setUTCHours(23, 30, 0, 0);
      const event = await newEvent(organizer, { startsAt, title: 'Soirée tardive' });

      const localDay = localDate(startsAt, 'Europe/Paris');
      const utcDay = startsAt.toISOString().slice(0, 10);

      const calendar = await events.calendar(
        { from: utcDay, to: nextLocalDate(localDay) },
        organizer,
      );
      const days = new Map(calendar.items.map((d) => [d.date, d]));
      expect(days.get(localDay)?.total).toBeGreaterThanOrEqual(1);
      expect(days.get(localDay)?.attending).toBeGreaterThanOrEqual(1);
      expect(days.get(utcDay)?.total).toBe(0);
      // Les jours vides sont PRÉSENTS (§3.5 : « atténués », donc rendus).
      expect(days.get(utcDay)).toBeDefined();
      expect(event.localDate).toBe(localDay);
    });

    it('refuse un intervalle de calendrier de plus de 62 jours', () => {
      expect(calendarQuerySchema.safeParse({ from: '2027-01-01', to: '2027-03-31' }).success).toBe(
        false,
      );
      expect(calendarQuerySchema.safeParse({ from: '2027-01-01', to: '2027-02-15' }).success).toBe(
        true,
      );
    });
  });

  // ══ Listes (§3.5, §5) ═════════════════════════════════════════════════════

  describe('listes et périmètre', () => {
    it('met mes participations en tête', async () => {
      const organizer = await member({ plan: 'PREMIUM' });
      const later = await newEvent(organizer, { startsAt: soon(20 * 86_400_000), title: 'Plus tard' });
      const sooner = await newEvent(organizer, { startsAt: soon(4 * 86_400_000), title: 'Bientôt' });

      const guest = await member();
      await events.rsvp(later.id, guest, { status: 'GOING' });

      const page = await events.list({ scope: 'all', radiusKm: 30, limit: 50 } as never, guest);
      const ids = page.items.map((i) => i.id);
      // `later` commence PLUS TARD que `sooner` : s'il n'arrive pas devant, c'est
      // que le tri par participation n'est pas appliqué (§3.5).
      expect(ids.indexOf(later.id)).toBeLessThan(ids.indexOf(sooner.id));
      expect(page.items[0]?.myStatus).toBe('GOING');
    });

    it('garde mes participations hors de mon périmètre géographique', async () => {
      const organizer = await member({ cityId: farCity.id });
      const event = await newEvent(organizer, { cityId: farCity.id });
      const guest = await member({ cityId: paris.id });

      const before = await events.list({ scope: 'all', radiusKm: 30, limit: 50 } as never, guest);
      expect(before.items.map((i) => i.id)).not.toContain(event.id);

      await events.rsvp(event.id, guest, { status: 'GOING' });
      const after = await events.list({ scope: 'all', radiusKm: 30, limit: 50 } as never, guest);
      // Un événement à 500 km auquel je suis inscrit reste le mien : le filtre de
      // ville ne doit pas l'effacer de mon agenda.
      expect(after.items.map((i) => i.id)).toContain(event.id);
    });

    it('inclut les villes du rayon de 30 km, et pas au-delà', async () => {
      const organizer = await member({ plan: 'PREMIUM', cityId: nearParis.id });
      const near = await newEvent(organizer, { cityId: nearParis.id, title: 'Juste à côté' });
      const far = await newEvent(organizer, { cityId: farCity.id, title: 'Très loin' });

      const viewer = await member({ cityId: paris.id });
      const page = await events.list({ scope: 'all', radiusKm: 30, limit: 50 } as never, viewer);
      const ids = page.items.map((i) => i.id);
      expect(ids).toContain(near.id);
      expect(ids).not.toContain(far.id);

      // Rayon 0 : ma ville seulement.
      const strict = await events.list(
        { scope: 'all', radiusKm: 0, limit: 50, cityId: paris.id } as never,
        viewer,
      );
      expect(strict.items.map((i) => i.id)).not.toContain(near.id);
    });

    it('distingue « mes participations » de « mes organisations »', async () => {
      const organizer = await member();
      const organized = await newEvent(organizer);
      const otherOrganizer = await member();
      const attended = await newEvent(otherOrganizer);
      await events.rsvp(attended.id, organizer, { status: 'MAYBE' });

      const mine = await events.list({ scope: 'mine', radiusKm: 30, limit: 50 } as never, organizer);
      expect(mine.items.map((i) => i.id)).toEqual(
        expect.arrayContaining([organized.id, attended.id]),
      );

      const mineOrganized = await events.list(
        { scope: 'organized', radiusKm: 30, limit: 50 } as never,
        organizer,
      );
      expect(mineOrganized.items.map((i) => i.id)).toContain(organized.id);
      expect(mineOrganized.items.map((i) => i.id)).not.toContain(attended.id);
    });
  });

  // ══ Participants (§3.2, §5) ═══════════════════════════════════════════════

  describe('liste des participants', () => {
    it('donne tout à l’organisateur, les avatars des GOING aux autres', async () => {
      const organizer = await member();
      const event = await newEvent(organizer, { capacity: 2 });
      const going = await member();
      const maybe = await member();
      const waiting = await member();
      await events.rsvp(event.id, going, { status: 'GOING' });
      await events.rsvp(event.id, maybe, { status: 'MAYBE' });
      await events.rsvp(event.id, waiting, { status: 'GOING' });

      const asOrganizer = await events.attendees(event.id, organizer);
      expect(asOrganizer.meta).toMatchObject({ going: 2, maybe: 1, waitlist: 1 });
      expect(asOrganizer.items.some((i) => 'userId' in i)).toBe(true);

      const asGuest = await events.attendees(event.id, going);
      expect(asGuest.items).toHaveLength(2);
      expect(asGuest.items.every((i) => i.status === 'GOING')).toBe(true);
      // Ni identifiant ni présence : la feuille de présence est celle de
      // l'organisateur, pas une information publique.
      expect(JSON.stringify(asGuest.items)).not.toMatch(/userId|checkedIn/);
      expect(asGuest.meta).not.toHaveProperty('checkedIn');
    });
  });

  // ══ RÈGLE DURE · la couverture d'un événement ═════════════════════════════

  describe('rule: la couverture est un média À SOI, de genre EVENT_COVER et prêt', () => {
    /**
     * [RÈGLE DURE] Les trois contrôles manquaient TOUS LES TROIS, aux DEUX points.
     *
     * `create` écrivait `coverAssetId: input.coverAssetId ?? null` tel quel, et
     * `update` connectait par simple identifiant
     * (`data.coverAsset = { connect: { id } }`).
     *
     * LE PLUS GRAVE N'EST PAS LE GENRE, C'EST LE PROPRIÉTAIRE, absent des deux.
     * Les autres rattachements du dépôt vérifiaient au moins celui-là, si bien
     * qu'on pouvait le croire acquis. Ici un organisateur pouvait donner pour
     * couverture le média d'UN AUTRE MEMBRE : non pas un mésusage de son propre
     * document, mais une référence croisée — le justificatif professionnel d'un
     * tiers en bandeau d'un événement public, et `events.cover_asset_id` ne garde
     * aucune trace de qui l'a posé.
     *
     * Le membre est PREMIUM pour que le quota de §10 (un événement par mois en
     * gratuit) ne décide de rien ici : ce test parle de la couverture, et un
     * `PLAN_LIMIT_REACHED` au milieu le rendrait illisible.
     */
    it('refuse une couverture qui n’est pas à soi, d’un autre genre, ou non prête', async () => {
      const organizer = await member({ plan: 'PREMIUM' });
      const stranger = await member({ plan: 'PREMIUM' });

      const asset = async (
        ownerUserId: string,
        kind: 'EVENT_COVER' | 'PROOF',
        status: 'READY' | 'PENDING' | 'REJECTED' = 'READY',
      ) => {
        const row = await prisma.mediaAsset.create({
          data: {
            id: newId(),
            ownerUserId,
            kind,
            storageKey: `test/evt-couverture/${newId()}.jpg`,
            mime: 'image/jpeg',
            sizeBytes: BigInt(4096),
            status,
            exifStripped: true,
          },
        });
        createdMediaIds.push(row.id);
        return row.id;
      };

      // ── PRÉMISSE : sa propre couverture, du bon genre et prête, PASSE ─────
      const mine = await asset(organizer, 'EVENT_COVER');
      const created = await newEvent(organizer, { coverAssetId: mine });
      const stored = await prisma.event.findUniqueOrThrow({
        where: { id: created.id },
        select: { coverAssetId: true },
      });
      expect(stored.coverAssetId).toBe(mine);

      // ── À LA CRÉATION ────────────────────────────────────────────────────
      //
      // 404 pour le propriétaire et le genre : tous deux vivent dans le `where`,
      // et un refus nommé ferait de l'identifiant un oracle d'existence.
      const hers = await asset(stranger, 'EVENT_COVER');
      await expect(newEvent(organizer, { coverAssetId: hers })).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });

      const myProof = await asset(organizer, 'PROOF');
      await expect(newEvent(organizer, { coverAssetId: myProof })).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });

      // 400 pour le statut : l'organisateur vient d'envoyer ce fichier et sait
      // qu'il existe. Un REJECTED est le cas qui compte — sa clé est réservée
      // SANS OCTETS DESSOUS, donc la couverture serait un bandeau introuvable.
      for (const status of ['PENDING', 'REJECTED'] as const) {
        await expect(
          newEvent(organizer, { coverAssetId: await asset(organizer, 'EVENT_COVER', status) }),
        ).rejects.toMatchObject({
          code: 'VALIDATION_FAILED',
          details: { fields: [{ path: 'coverAssetId', code: 'MEDIA_NOT_READY' }] },
        });
      }

      // ── À LA MISE À JOUR ─────────────────────────────────────────────────
      //
      // Le second point, et il se teste à part : `update` ne passe pas par le
      // même code que `create`, et corriger l'un sans l'autre laisserait la
      // porte ouverte à une requête de plus.
      await expect(events.update(created.id, organizer, { coverAssetId: hers })).rejects.toMatchObject(
        { code: 'NOT_FOUND' },
      );
      await expect(
        events.update(created.id, organizer, { coverAssetId: myProof }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
      await expect(
        events.update(created.id, organizer, {
          coverAssetId: await asset(organizer, 'EVENT_COVER', 'REJECTED'),
        }),
      ).rejects.toMatchObject({
        code: 'VALIDATION_FAILED',
        details: { fields: [{ path: 'coverAssetId', code: 'MEDIA_NOT_READY' }] },
      });

      // La couverture d'origine est INTACTE : un refus ne doit pas avoir écrit à
      // moitié. Sans cette vérification, un `update` qui aurait effacé la
      // couverture avant de refuser passerait pour correct.
      const after = await prisma.event.findUniqueOrThrow({
        where: { id: created.id },
        select: { coverAssetId: true },
      });
      expect(after.coverAssetId).toBe(mine);

      // Et le remplacement LICITE fonctionne toujours — sans quoi tout ce qui
      // précède serait obtenu en refusant simplement toute couverture.
      const second = await asset(organizer, 'EVENT_COVER');
      await events.update(created.id, organizer, { coverAssetId: second });
      const replaced = await prisma.event.findUniqueOrThrow({
        where: { id: created.id },
        select: { coverAssetId: true },
      });
      expect(replaced.coverAssetId).toBe(second);
    });
  });
});
