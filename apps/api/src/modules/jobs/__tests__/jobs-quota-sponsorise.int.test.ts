import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { newId } from '@app/db';
import { FREE_SPONSORED_JOBS_PER_MONTH } from '@app/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../../../app.module';
import { PrismaService } from '../../../common/prisma.service';
import { reglerMonetisation } from '../../../common/__tests__/monetisation';
import { creerMembre, creerVille, purgerMembres } from '../../../common/__tests__/membres-s2b';
import { JobsService } from '../jobs.service';

/**
 * Étape 2 — le quota mensuel d'offres sponsorisées est vérifié SOUS VERROU.
 *
 * Lire le compteur puis écrire laissait N mises en avant simultanées (sur N offres
 * différentes) franchir ensemble le plafond mensuel.
 */
describe('quota d’offres sponsorisées sous verrou (étape 2)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jobs: JobsService;
  let cityId = '';
  const users: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    jobs = app.get(JobsService);
    await reglerMonetisation(prisma, true);
    cityId = await creerVille(prisma);
  });

  afterAll(async () => {
    await reglerMonetisation(prisma, null);
    await purgerMembres(prisma, users);
    await app.close();
  });

  it('ne dépasse jamais le plafond mensuel sous appels concurrents (et refuse deux fois la même offre)', async () => {
    const author = await creerMembre(prisma, { cityId, plan: 'PREMIUM' });
    users.push(author);
    const total = FREE_SPONSORED_JOBS_PER_MONTH + 4;
    const ids: string[] = [];
    for (let i = 0; i < total; i += 1) {
      const id = newId();
      ids.push(id);
      await prisma.jobListing.create({
        data: {
          id,
          authorUserId: author,
          kind: 'JOB',
          title: `Offre ${i}`,
          description: 'Une offre de test',
          cityId,
          status: 'ACTIVE',
          expiresAt: new Date(Date.now() + 30 * 86_400_000),
        },
      });
    }

    // L'offre 0 est visée DEUX fois en même temps : une seule mise en avant doit être comptée.
    const results = await Promise.allSettled([
      ...ids.map((id) => jobs.sponsor(id, author)),
      jobs.sponsor(ids[0]!, author),
    ]);

    const ok = results.filter((r) => r.status === 'fulfilled').length;
    expect(ok).toBe(FREE_SPONSORED_JOBS_PER_MONTH);
    const codes = results
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      .map((r) => (r.reason as { code?: string }).code);
    expect(codes.every((c) => c === 'SPONSORED_LIMIT' || c === 'ALREADY_SPONSORED')).toBe(true);
    expect(
      await prisma.jobListing.count({ where: { authorUserId: author, sponsoredUntil: { not: null } } }),
    ).toBe(FREE_SPONSORED_JOBS_PER_MONTH);
  });
});
