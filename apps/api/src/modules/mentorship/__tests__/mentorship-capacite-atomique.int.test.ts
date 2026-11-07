import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { newId } from '@app/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../../../app.module';
import { PrismaService } from '../../../common/prisma.service';
import { creerMembre, purgerMembres } from '../../../common/__tests__/membres-s2b';
import { MentorshipService } from '../mentorship.service';

/**
 * Étape 2 — la capacité d'un parrain est contrôlée ATOMIQUEMENT.
 *
 * Lire `active_mentee_count` puis l'incrémenter laissait deux demandes DIFFÉRENTES,
 * acceptées en même temps, dépasser `max_mentees`. L'incrément est conditionné à la
 * capacité dans la même instruction.
 */
describe('capacité de parrain atomique (étape 2)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let mentorship: MentorshipService;
  const users: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    mentorship = app.get(MentorshipService);
  });

  afterAll(async () => {
    await purgerMembres(prisma, users);
    await app.close();
  });

  it('n’accepte pas plus de `max_mentees` filleuls parmi des acceptations concurrentes', async () => {
    const mentor = await creerMembre(prisma, { level: 'L2' });
    users.push(mentor);
    await prisma.mentorProfile.create({
      data: { userId: mentor, isAvailable: true, maxMentees: 2, activeMenteeCount: 0, journeyTemplateIds: [], enabledAt: new Date() },
    });

    const ids: string[] = [];
    for (let i = 0; i < 5; i += 1) {
      const mentee = await creerMembre(prisma);
      users.push(mentee);
      const id = newId();
      ids.push(id);
      await prisma.mentorship.create({
        data: {
          id,
          mentorUserId: mentor,
          menteeUserId: mentee,
          status: 'REQUESTED',
          requestMessage: 'Pouvez-vous me parrainer ?',
          expiresAt: new Date(Date.now() + 7 * 86_400_000),
        },
      });
    }

    const results = await Promise.allSettled(ids.map((id) => mentorship.accept(id, mentor)));

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(2);
    const refused = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    expect(refused.every((r) => (r.reason as { code?: string }).code === 'MENTOR_FULL')).toBe(true);

    const profile = await prisma.mentorProfile.findUniqueOrThrow({ where: { userId: mentor } });
    expect(profile.activeMenteeCount).toBe(2);
    expect(await prisma.mentorship.count({ where: { mentorUserId: mentor, status: 'ACTIVE' } })).toBe(2);
    // Les refus ont tout annulé : les trois autres demandes sont restées en attente.
    expect(await prisma.mentorship.count({ where: { mentorUserId: mentor, status: 'REQUESTED' } })).toBe(3);
  });
});
