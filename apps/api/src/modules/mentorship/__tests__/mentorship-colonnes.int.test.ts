import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId } from '@app/db';
import { MENTORSHIP_DURATION_MS, MENTORSHIP_REQUEST_EXPIRY_MS } from '@app/shared';
import { AuditService } from '../../../common/audit.service';
import { CryptoService } from '../../../common/crypto.service';
import { OutboxService } from '../../../common/outbox.service';
import { PrismaService } from '../../../common/prisma.service';
import { VisibilityService } from '../../../common/visibility.service';
import { ConnectionsService } from '../../connections/connections.service';
import { MessagingService } from '../../messaging/messaging.service';
import { MentorshipService } from '../mentorship.service';

/**
 * Parrainage — les deux colonnes « Ajoutées » de 08 §6 (`extended_once`,
 * `expires_at`) et le diagnostic d'éligibilité de `GET /me/mentor-profile` (§2.1).
 *
 * Les colonnes étaient DÉDUITES (`ends_at - accepted_at`, `created_at + 7 j`). Ces
 * tests tiennent ce que la déduction ne pouvait pas : que la colonne soit ce qui
 * décide, et qu'une ligne écrite sans elle reste lisible.
 */
describe('parrainage : colonnes extended_once / expires_at et diagnostic (08 §6, §2.1)', () => {
  let prisma: PrismaService;
  let mentorship: MentorshipService;
  const createdUsers: string[] = [];
  let originCountryId: string;
  let cityId: string;
  let counter = 0;

  async function member(
    options: { phase?: 'PRE_DEPARTURE' | 'RECENT_ARRIVAL' | 'SETTLED'; arrivalYearsAgo?: number } = {},
  ): Promise<{ id: string; handle: string }> {
    counter += 1;
    const id = newId();
    const handle = `col${counter}${id.slice(-8)}`;
    await prisma.user.create({
      data: {
        id,
        handle,
        displayName: `Membre ${counter}`,
        phase: options.phase ?? 'SETTLED',
        verificationLevel: 'L2',
        originCountryId,
        cityId,
        plan: 'FREE',
        status: 'ACTIVE',
        arrivalDate:
          options.arrivalYearsAgo === undefined
            ? null
            : new Date(Date.now() - options.arrivalYearsAgo * 365 * 86_400_000),
      },
    });
    createdUsers.push(id);
    return { id, handle };
  }

  async function mentor(): Promise<{ id: string; handle: string }> {
    const user = await member({ phase: 'SETTLED', arrivalYearsAgo: 2 });
    await mentorship.upsertProfile(user.id, {
      bio: 'J’accompagne les nouveaux arrivants depuis deux ans, avec plaisir.',
      journeyTemplateIds: [],
      maxMentees: 2,
      isAvailable: true,
    });
    return user;
  }

  const MESSAGE =
    'Bonjour, je prépare mon départ et je cherche quelqu’un qui connaît les démarches locales pour m’aider.';

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    const outbox = new OutboxService(prisma);
    const audit = new AuditService(prisma);
    const visibility = new VisibilityService(prisma);
    const connections = new ConnectionsService(prisma, outbox, audit, visibility);
    const messaging = new MessagingService(
      prisma,
      new CryptoService(),
      outbox,
      audit,
      visibility,
      connections,
    );
    mentorship = new MentorshipService(prisma, outbox, audit, visibility, messaging);

    originCountryId = (
      await prisma.country.findFirstOrThrow({
        where: { isActive: true, kind: { in: ['ORIGIN', 'BOTH'] } },
        select: { id: true },
      })
    ).id;
    cityId = (await prisma.city.findFirstOrThrow({ select: { id: true } })).id;
  });

  afterAll(async () => {
    if (createdUsers.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: createdUsers } } });
    }
    await prisma.$disconnect();
  });

  it('rule: la demande porte expires_at = demande + 7 jours, et la liste le rend', async () => {
    const m = await mentor();
    const mentee = await member({ phase: 'PRE_DEPARTURE' });
    const before = Date.now();
    const created = await mentorship.request(mentee.id, { mentorHandle: m.handle, message: MESSAGE });

    const row = await prisma.mentorship.findUniqueOrThrow({ where: { id: created.id } });
    expect(row.expiresAt).not.toBeNull();
    const delta = (row.expiresAt as Date).getTime() - before;
    expect(delta).toBeGreaterThanOrEqual(MENTORSHIP_REQUEST_EXPIRY_MS - 1000);
    expect(delta).toBeLessThanOrEqual(MENTORSHIP_REQUEST_EXPIRY_MS + 5000);

    const list = await mentorship.myMentorships(mentee.id, { role: 'all', state: 'pending' });
    expect(list.items[0]?.expiresAt?.getTime()).toBe((row.expiresAt as Date).getTime());
  });

  it('une ligne SANS expires_at reste lisible : le repli est created_at + 7 jours', async () => {
    const m = await mentor();
    const mentee = await member({ phase: 'PRE_DEPARTURE' });
    const created = await mentorship.request(mentee.id, { mentorHandle: m.handle, message: MESSAGE });
    // Une ligne écrite par un script d'avant la colonne : pas d'échéance, 8 jours d'âge.
    await prisma.mentorship.update({
      where: { id: created.id },
      data: { expiresAt: null, createdAt: new Date(Date.now() - MENTORSHIP_REQUEST_EXPIRY_MS - 86_400_000) },
    });

    expect(await mentorship.expireRequests()).toBeGreaterThanOrEqual(1);
    const row = await prisma.mentorship.findUniqueOrThrow({ where: { id: created.id } });
    expect(row.status).toBe('CANCELLED');
  });

  it('rule: la prolongation pose extended_once, et une seconde est refusée', async () => {
    const m = await mentor();
    const mentee = await member({ phase: 'PRE_DEPARTURE' });
    const created = await mentorship.request(mentee.id, { mentorHandle: m.handle, message: MESSAGE });
    await mentorship.accept(created.id, m.id);

    const before = await prisma.mentorship.findUniqueOrThrow({ where: { id: created.id } });
    expect(before.extendedOnce).toBe(false);
    const listBefore = await mentorship.myMentorships(mentee.id, { role: 'all', state: 'active' });
    expect(listBefore.items[0]).toMatchObject({ extended: false, canExtend: true });

    await mentorship.extend(created.id, mentee.id);
    const after = await prisma.mentorship.findUniqueOrThrow({ where: { id: created.id } });
    expect(after.extendedOnce).toBe(true);
    expect((after.endsAt as Date).getTime() - (before.endsAt as Date).getTime()).toBe(
      MENTORSHIP_DURATION_MS,
    );

    const listAfter = await mentorship.myMentorships(m.id, { role: 'all', state: 'active' });
    expect(listAfter.items[0]).toMatchObject({ extended: true, canExtend: false });
    await expect(mentorship.extend(created.id, m.id)).rejects.toMatchObject({
      code: 'ALREADY_EXTENDED',
    });
  });

  it('rule: « déjà prolongé » se lit sur la colonne, pas sur ends_at', async () => {
    const m = await mentor();
    const mentee = await member({ phase: 'PRE_DEPARTURE' });
    const created = await mentorship.request(mentee.id, { mentorHandle: m.handle, message: MESSAGE });
    await mentorship.accept(created.id, m.id);
    // `ends_at` déplacé SANS la colonne : la déduction l'aurait vu « prolongé », la
    // colonne dit qu'il ne l'est pas — et c'est elle qui fait foi (08 §6).
    await prisma.mentorship.update({
      where: { id: created.id },
      data: { endsAt: new Date(Date.now() + 2 * MENTORSHIP_DURATION_MS) },
    });
    await expect(mentorship.extend(created.id, m.id)).resolves.toMatchObject({ extended: true });
  });

  it('diagnostic: les trois conditions de §2.1 sont dites une à une', async () => {
    const newcomer = await member({ phase: 'RECENT_ARRIVAL', arrivalYearsAgo: 0 });
    const lacking = await mentorship.myProfile(newcomer.id, 'L1');
    expect(lacking.profile).toBeNull();
    expect(lacking.eligibility).toEqual({
      eligible: false,
      identity: true,
      phone: false,
      experience: { ok: false, completedJourneys: 0, settledForMonths: false },
    });

    const veteran = await member({ phase: 'SETTLED', arrivalYearsAgo: 2 });
    const l0 = await mentorship.myProfile(veteran.id, 'L0');
    expect(l0.eligibility).toMatchObject({
      eligible: false,
      identity: false,
      phone: false,
      experience: { ok: true, settledForMonths: true },
    });
    const l2 = await mentorship.myProfile(veteran.id, 'L2');
    expect(l2.eligibility.eligible).toBe(true);

    // Le diagnostic ne COMPTE PAS comme une autorisation : le PUT applique la règle.
    await expect(
      mentorship.upsertProfile(newcomer.id, {
        bio: 'Je veux aider les autres, même si je viens juste d’arriver ici.',
        journeyTemplateIds: [],
        maxMentees: 2,
        isAvailable: true,
      }),
    ).rejects.toMatchObject({ code: 'MENTOR_NOT_ELIGIBLE' });

    await mentorship.upsertProfile(veteran.id, {
      bio: 'J’accompagne les nouveaux arrivants depuis deux ans, avec plaisir.',
      journeyTemplateIds: [],
      maxMentees: 2,
      isAvailable: true,
    });
    expect((await mentorship.myProfile(veteran.id, 'L2')).profile).toMatchObject({
      handle: veteran.handle,
      availability: 'AVAILABLE',
    });
  });
});
