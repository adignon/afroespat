import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { newId } from '@app/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../../../app.module';
import { PrismaService } from '../../../common/prisma.service';
import { creerMembre, creerVille, purgerMembres } from '../../../common/__tests__/membres-s2b';
import { EventHandlerRegistry } from '../../../queue/event-handlers';
import { ReferentialsService } from '../referentials.service';
import { UsersService } from '../../users/users.service';

/**
 * Étape 2 — villes : la fusion migre TOUS les contenus rattachés, et un changement de ville
 * réaffecte les réseaux de ville du membre.
 */
describe('fusion de villes et changement de ville (étape 2)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ref: ReferentialsService;
  let users: UsersService;
  let registry: EventHandlerRegistry;
  let staff: { staffId: string; role: 'CONTENT_ADMIN'; sessionId: string; ip: null };
  const members: string[] = [];
  const cities: string[] = [];

  async function ville(): Promise<string> {
    const id = await creerVille(prisma);
    cities.push(id);
    return id;
  }
  const slugOf = async (id: string) => (await prisma.city.findUniqueOrThrow({ where: { id }, select: { slug: true } })).slug;

  /** Distribue les événements d'UN membre, comme le relais de la boîte d'envoi le ferait. */
  async function distribuer(userId: string): Promise<void> {
    const events = await prisma.domainEvent.findMany({ where: { aggregateId: userId, type: 'user.onboarded_location' } });
    for (const e of events) {
      await registry.dispatch({
        id: e.id,
        type: e.type as Parameters<typeof registry.dispatch>[0]['type'],
        aggregateId: e.aggregateId,
        payload: e.payload,
        occurredAt: e.occurredAt.toISOString(),
      });
    }
  }

  async function villesDuReseau(userId: string): Promise<string[]> {
    const rows = await prisma.communityMember.findMany({
      where: { userId, status: 'ACTIVE', community: { kind: 'CITY' } },
      select: { community: { select: { cityId: true } } },
    });
    return rows.map((r) => r.community.cityId as string);
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    ref = app.get(ReferentialsService);
    users = app.get(UsersService);
    registry = app.get(EventHandlerRegistry);
    const row = await prisma.staffUser.create({
      data: {
        id: newId(),
        email: `s2b-${newId().slice(-8)}@local`,
        displayName: 'Équipe S2B',
        passwordHash: 'x',
        totpSecretEncrypted: new Uint8Array([0]),
        role: 'CONTENT_ADMIN',
        isActive: true,
      },
      select: { id: true },
    });
    staff = { staffId: row.id, role: 'CONTENT_ADMIN', sessionId: newId(), ip: null };
  });

  afterAll(async () => {
    await purgerMembres(prisma, members);
    const communities = await prisma.community.findMany({ where: { cityId: { in: cities } }, select: { id: true } });
    await prisma.communityMember.deleteMany({ where: { communityId: { in: communities.map((c) => c.id) } } });
    await prisma.community.deleteMany({ where: { id: { in: communities.map((c) => c.id) } } });
    await prisma.searchZeroResult.deleteMany({ where: { cityId: { in: cities } } });
    await prisma.searchZeroResultSeeker.deleteMany({ where: { cityId: { in: cities } } });
    await prisma.helpRequest.deleteMany({ where: { cityId: { in: cities } } });
    await prisma.jobListing.deleteMany({ where: { cityId: { in: cities } } });
    await prisma.city.updateMany({ where: { id: { in: cities } }, data: { mergedIntoCityId: null } });
    await prisma.city.deleteMany({ where: { id: { in: cities } } });
    await prisma.staffUser.deleteMany({ where: { id: staff.staffId } });
    await app.close();
  });

  it('inventaire : chaque colonne `city_id` du schéma est traitée par la fusion', async () => {
    const rows = await prisma.$queryRaw<{ ref: string }[]>`
      SELECT table_name || '.' || column_name AS ref
        FROM information_schema.columns
       WHERE table_schema = 'public'
         AND column_name ~ 'city_id$'
         AND column_name <> 'merged_into_city_id'
       ORDER BY 1`;
    // Toute nouvelle clé `city_id` doit être ajoutée à `ReferentialsService.mergeCity`, PUIS ici.
    expect(rows.map((r) => r.ref)).toEqual([
      'city_tips.city_id',
      'communities.city_id',
      'countries.default_city_id',
      'events.city_id',
      'guides.city_id',
      'help_requests.city_id',
      'housing_listings.city_id',
      'housing_price_medians.city_id',
      'impact_quotes.city_id',
      'job_listings.city_id',
      'journeys.destination_city_id',
      'posts.city_id',
      'pro_profile_cities.city_id',
      'scam_alerts.city_id',
      'search_documents.city_id',
      'search_zero_result_seekers.city_id',
      'search_zero_results.city_id',
      'stories.city_id',
      'users.city_id',
    ]);
  });

  it('la fusion migre membres, demandes d’aide, offres et recherches sans résultat (compteurs additionnés)', async () => {
    const source = await ville();
    const target = await ville();
    const member = await creerMembre(prisma, { cityId: source });
    members.push(member);
    const day = new Date('2026-11-01');

    await prisma.helpRequest.create({
      data: { id: newId(), authorUserId: member, kind: 'REQUEST', type: 'PAPERWORK', title: 'Aide', body: 'Un corps assez long pour la demande.', cityId: source, status: 'OPEN', moderationStatus: 'CLEARED' },
    });
    await prisma.jobListing.create({
      data: { id: newId(), authorUserId: member, kind: 'JOB', title: 'Offre', description: 'Description', cityId: source, status: 'ACTIVE', expiresAt: new Date(Date.now() + 86_400_000) },
    });
    await prisma.searchZeroResult.createMany({
      data: [
        { id: newId(), queryNormalized: 'titre sejour s2b', cityId: source, occurredOn: day, count: 2 },
        { id: newId(), queryNormalized: 'titre sejour s2b', cityId: target, occurredOn: day, count: 3 },
        { id: newId(), queryNormalized: 'autre requete s2b', cityId: source, occurredOn: day, count: 1 },
      ],
    });
    await prisma.searchZeroResultSeeker.create({
      data: { id: newId(), queryNormalized: 'titre sejour s2b', cityId: source, occurredOn: day, seekerHash: 'a'.repeat(64) },
    });

    const result = await ref.mergeCity(staff, source, {
      targetCityId: target,
      confirmSlug: await slugOf(source),
      reason: 'Doublon de la même ville.',
    });
    expect(result.usersMoved).toBe(1);

    expect((await prisma.user.findUniqueOrThrow({ where: { id: member } })).cityId).toBe(target);
    expect(await prisma.helpRequest.count({ where: { cityId: source } })).toBe(0);
    expect(await prisma.helpRequest.count({ where: { cityId: target, authorUserId: member } })).toBe(1);
    expect(await prisma.jobListing.count({ where: { cityId: source } })).toBe(0);
    expect(await prisma.jobListing.count({ where: { cityId: target, authorUserId: member } })).toBe(1);

    expect(await prisma.searchZeroResult.count({ where: { cityId: source } })).toBe(0);
    const merged = await prisma.searchZeroResult.findMany({ where: { cityId: target }, orderBy: { queryNormalized: 'asc' } });
    expect(merged.map((r) => [r.queryNormalized, r.count])).toEqual([
      ['autre requete s2b', 1],
      ['titre sejour s2b', 5],
    ]);
    expect(await prisma.searchZeroResultSeeker.count({ where: { cityId: source } })).toBe(0);
    expect(await prisma.searchZeroResultSeeker.count({ where: { cityId: target } })).toBe(1);
  });

  it('un changement de ville réaffecte le réseau de ville du membre', async () => {
    const a = await ville();
    const b = await ville();
    const member = await creerMembre(prisma, { cityId: a });
    members.push(member);

    // Inscription initiale aux réseaux automatiques (écran du lieu).
    await app.get(UsersService).advanceOnboarding(member, 3);
    await distribuer(member);
    expect(await villesDuReseau(member)).toEqual([a]);

    await users.updateMe(member, { cityId: b });
    await distribuer(member);

    // Il a QUITTÉ le réseau de l'ancienne ville et REJOINT celui de la nouvelle.
    expect(await villesDuReseau(member)).toEqual([b]);
  });
});
