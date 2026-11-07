import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { newId } from '@app/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../../../app.module';
import { AuditService } from '../../../common/audit.service';
import { OutboxService } from '../../../common/outbox.service';
import { PrismaService } from '../../../common/prisma.service';
import { creerMembre, creerVille, purgerMembres } from '../../../common/__tests__/membres-s2b';
import { AI_MODERATION_PROVIDER, type AiModerationProvider } from '../../../providers/providers';
import { EventHandlerRegistry } from '../../../queue/event-handlers';
import { ModerationService, type ModerationQueuePort } from '../moderation.service';

/**
 * Étape 2 — les textes de parrainage, de recommandation et d'offre d'emploi entrent dans le
 * pipeline de modération ; quand la file est absente ou en panne, un dossier est OUVERT quand
 * même (une modération qui ne laisse aucune trace est une modération qui n'a pas eu lieu).
 */
describe('dossiers de modération des textes de parrainage, recommandation et emploi (étape 2)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let sansFile: ModerationService;
  let fileEnPanne: ModerationService;
  let cityId = '';
  let author = '';
  let other = '';
  const users: string[] = [];

  async function dossiers(subjectType: string, subjectId: string) {
    return prisma.moderationCase.findMany({ where: { subjectType: subjectType as never, subjectId } });
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    const outbox = new OutboxService(prisma);
    const audit = new AuditService(prisma);
    const ai = app.get<AiModerationProvider>(AI_MODERATION_PROVIDER);
    sansFile = new ModerationService(prisma, outbox, audit, ai, null);
    const enPanne: ModerationQueuePort = { enqueue: () => Promise.reject(new Error('Redis indisponible')) };
    fileEnPanne = new ModerationService(prisma, outbox, audit, ai, enPanne);

    cityId = await creerVille(prisma);
    author = await creerMembre(prisma, { cityId });
    other = await creerMembre(prisma, { cityId, level: 'L2' });
    users.push(author, other);
  });

  afterAll(async () => {
    await purgerMembres(prisma, users);
    await app.close();
  });

  it('demande de parrainage : dossier ouvert sans file de modération', async () => {
    const id = newId();
    await prisma.mentorship.create({
      data: { id, mentorUserId: other, menteeUserId: author, status: 'REQUESTED', requestMessage: 'Bonjour, pouvez-vous m’aider ?', expiresAt: new Date(Date.now() + 86_400_000) },
    });
    await sansFile.handleContentPublished('MENTORSHIP', id);
    const rows = await dossiers('MENTORSHIP', id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: 'OPEN', subjectAuthorUserId: author });
    // Rejouer ne double pas le dossier.
    await sansFile.handleContentPublished('MENTORSHIP', id);
    expect(await dossiers('MENTORSHIP', id)).toHaveLength(1);
  });

  it('commentaire d’évaluation de parrainage : dossier ouvert quand la file est en panne', async () => {
    const mentorshipId = newId();
    await prisma.mentorship.create({
      data: { id: mentorshipId, mentorUserId: other, menteeUserId: author, status: 'ENDED', requestMessage: 'Merci', expiresAt: new Date() },
    });
    const id = newId();
    await prisma.mentorshipReview.create({
      data: { id, mentorshipId, reviewerUserId: author, revieweeUserId: other, rating: 4, comment: 'Un échange très utile.' },
    });
    await fileEnPanne.handleContentPublished('MENTORSHIP_REVIEW', id);
    const rows = await dossiers('MENTORSHIP_REVIEW', id);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.subjectAuthorUserId).toBe(author);
  });

  it('présentation de parrain et recommandation de membre : dossiers ouverts', async () => {
    await prisma.mentorProfile.create({
      data: { userId: other, isAvailable: true, maxMentees: 2, journeyTemplateIds: [], bio: 'Installé depuis dix ans.', enabledAt: new Date() },
    });
    await sansFile.handleContentPublished('MENTOR_PROFILE', other);
    expect(await dossiers('MENTOR_PROFILE', other)).toHaveLength(1);

    const id = newId();
    await prisma.memberRecommendation.create({
      data: { id, fromUserId: author, toUserId: other, comment: 'Sérieux et ponctuel.' },
    });
    await sansFile.handleContentPublished('MEMBER_RECOMMENDATION', id);
    const rows = await dossiers('MEMBER_RECOMMENDATION', id);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.subjectAuthorUserId).toBe(author);
  });

  it('offre d’emploi : dossier ouvert sans file de modération', async () => {
    const id = newId();
    await prisma.jobListing.create({
      data: { id, authorUserId: author, kind: 'JOB', title: 'Aide-cuisinier', description: 'Poste à pourvoir à Lyon.', cityId, status: 'ACTIVE', expiresAt: new Date(Date.now() + 86_400_000) },
    });
    await sansFile.handleContentPublished('JOB', id);
    expect(await dossiers('JOB', id)).toHaveLength(1);
  });

  it('les événements de publication de ces textes sont abonnés au module de modération', () => {
    const registry = app.get(EventHandlerRegistry);
    const lignes = registry.describe();
    for (const type of ['mentorship.requested', 'mentorship.reviewed', 'mentor_profile.updated', 'member.recommended', 'job.published']) {
      const ligne = lignes.find((l) => l.startsWith(`${type} →`));
      expect(ligne, type).toBeDefined();
      expect(ligne).toContain('moderation');
    }
  });
});
