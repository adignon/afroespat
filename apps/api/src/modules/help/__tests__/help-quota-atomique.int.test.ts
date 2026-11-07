import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { newId } from '@app/db';
import { HELP_LIMITS } from '@app/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../../../app.module';
import { PrismaService } from '../../../common/prisma.service';
import { creerMembre, creerVille, purgerMembres } from '../../../common/__tests__/membres-s2b';
import { HelpService } from '../help.service';

/**
 * Étape 2 — les quotas d'entraide sont ATOMIQUES.
 *
 * `count()` puis `create()` laissait N appels simultanés lire tous « 4 sur 5 » et passer
 * ensemble. Le quota est maintenant vérifié sous verrou transactionnel (par membre).
 */
describe('quotas d’entraide atomiques (étape 2)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let help: HelpService;
  let cityId = '';
  const users: string[] = [];

  const body = 'Je dois déposer mon dossier la semaine prochaine et je ne sais pas quelles pièces réunir.';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    help = app.get(HelpService);
    cityId = await creerVille(prisma);
  });

  afterAll(async () => {
    await purgerMembres(prisma, users);
    await app.close();
  });

  it('laisse passer exactement `requestsPerDay` demandes parmi des appels concurrents', async () => {
    const userId = await creerMembre(prisma, { cityId });
    users.push(userId);
    const attempts = HELP_LIMITS.requestsPerDay + 5;

    const results = await Promise.allSettled(
      Array.from({ length: attempts }, (_, i) =>
        help.create(
          { userId, level: 'L1' },
          { kind: 'REQUEST', type: 'PAPERWORK', title: `Titre de séjour ${i}`, body, cityId },
        ),
      ),
    );

    const ok = results.filter((r) => r.status === 'fulfilled').length;
    const refused = results.filter(
      (r) => r.status === 'rejected' && (r.reason as { code?: string }).code === 'RATE_LIMITED',
    ).length;
    expect(ok).toBe(HELP_LIMITS.requestsPerDay);
    expect(refused).toBe(attempts - HELP_LIMITS.requestsPerDay);
    expect(await prisma.helpRequest.count({ where: { authorUserId: userId } })).toBe(HELP_LIMITS.requestsPerDay);
  });

  it('laisse passer exactement `responsesPerHour` réponses parmi des appels concurrents', async () => {
    const author = await creerMembre(prisma, { cityId });
    const responder = await creerMembre(prisma, { cityId });
    users.push(author, responder);

    // Une seule demande ouverte ; le quota de réponses est pré-rempli à N-3 par des lignes directes.
    const request = await prisma.helpRequest.create({
      data: {
        id: newId(),
        authorUserId: author,
        kind: 'REQUEST',
        type: 'PAPERWORK',
        title: 'Une demande ouverte',
        body,
        cityId,
        status: 'OPEN',
        moderationStatus: 'CLEARED',
      },
      select: { id: true },
    });
    const prefill = HELP_LIMITS.responsesPerHour - 3;
    await prisma.helpResponse.createMany({
      data: Array.from({ length: prefill }, () => ({
        id: newId(),
        helpRequestId: request.id,
        authorUserId: responder,
        body: 'Réponse préalable',
      })),
    });

    const results = await Promise.allSettled(
      Array.from({ length: 10 }, (_, i) =>
        help.respond({ userId: responder, level: 'L1' }, request.id, { body: `Voici ce qu’il faut apporter ${i}` }),
      ),
    );
    expect(results.filter((r) => r.status === 'fulfilled').length).toBe(3);
    expect(await prisma.helpResponse.count({ where: { authorUserId: responder } })).toBe(
      HELP_LIMITS.responsesPerHour,
    );
  });
});
