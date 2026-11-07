import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { newId } from '@app/db';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../../../app.module';
import { PrismaService } from '../../../common/prisma.service';
import { creerMembre, creerVille, purgerMembres } from '../../../common/__tests__/membres-s2b';
import { EventHandlerRegistry } from '../../../queue/event-handlers';
import { ModerationEffectsService } from '../moderation-effects.service';
import { ModerationService } from '../moderation.service';

/**
 * Lot S3c — les effets de la modération sur les quatre types ajoutés avec le parrainage et la
 * recommandation, et le passage en modération d'une offre d'emploi MODIFIÉE.
 */
describe('effets de modération : parrainage, évaluation, profil de parrain, recommandation', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let effects: ModerationEffectsService;
  let mentor = '';
  let mentee = '';
  const users: string[] = [];

  const payload = (subjectType: string, subjectId: string) => ({ subjectType, subjectId });

  async function parrainage(status: 'REQUESTED' | 'ACTIVE') {
    const id = newId();
    await prisma.mentorship.create({
      data: { id, mentorUserId: mentor, menteeUserId: mentee, status, requestMessage: 'Bonjour', expiresAt: new Date(Date.now() + 86_400_000) },
    });
    return id;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    effects = new ModerationEffectsService(prisma);
    const cityId = await creerVille(prisma);
    mentor = await creerMembre(prisma, { cityId, level: 'L2' });
    mentee = await creerMembre(prisma, { cityId });
    users.push(mentor, mentee);
    await prisma.mentorProfile.create({
      data: { userId: mentor, isAvailable: true, maxMentees: 2, activeMenteeCount: 1, journeyTemplateIds: [], bio: 'Installé depuis dix ans.', enabledAt: new Date() },
    });
  });

  afterAll(async () => {
    await prisma.moderationHide.deleteMany({ where: { subjectType: { in: ['MENTORSHIP', 'MENTORSHIP_REVIEW', 'MENTOR_PROFILE', 'MEMBER_RECOMMENDATION'] } } });
    await purgerMembres(prisma, users);
    await app.close();
  });

  it('demande de parrainage : masquée = annulée, rétablie = de nouveau en attente', async () => {
    const id = await parrainage('REQUESTED');
    expect((await effects.apply('hidden', payload('MENTORSHIP', id))).changed).toBe(1);
    expect((await prisma.mentorship.findUniqueOrThrow({ where: { id } })).status).toBe('CANCELLED');
    // Rejeu : l'état d'avant n'est pas écrasé.
    await effects.apply('hidden', payload('MENTORSHIP', id));
    expect((await effects.apply('restored', payload('MENTORSHIP', id))).changed).toBe(1);
    expect((await prisma.mentorship.findUniqueOrThrow({ where: { id } })).status).toBe('REQUESTED');
    // Rétablir sans note ne touche à rien.
    expect((await effects.apply('restored', payload('MENTORSHIP', id))).changed).toBe(0);
  });

  it('parrainage en cours : masqué = terminé par l’équipe, compteur du parrain ajusté, rétablissement symétrique', async () => {
    const id = await parrainage('ACTIVE');
    await effects.apply('hidden', payload('MENTORSHIP', id));
    const ended = await prisma.mentorship.findUniqueOrThrow({ where: { id } });
    expect(ended).toMatchObject({ status: 'ENDED', endReason: 'ADMIN' });
    expect((await prisma.mentorProfile.findUniqueOrThrow({ where: { userId: mentor } })).activeMenteeCount).toBe(0);
    await effects.apply('restored', payload('MENTORSHIP', id));
    expect(await prisma.mentorship.findUniqueOrThrow({ where: { id } })).toMatchObject({ status: 'ACTIVE', endReason: null, endedAt: null });
    expect((await prisma.mentorProfile.findUniqueOrThrow({ where: { userId: mentor } })).activeMenteeCount).toBe(1);
  });

  it('parrainage retiré : annulé pour de bon, la note est effacée et rien ne le rétablit', async () => {
    const id = await parrainage('REQUESTED');
    await effects.apply('hidden', payload('MENTORSHIP', id));
    expect((await effects.apply('removed', payload('MENTORSHIP', id))).changed).toBe(0); // déjà annulé
    expect(await prisma.moderationHide.count({ where: { subjectType: 'MENTORSHIP', subjectId: id } })).toBe(0);
    expect((await effects.apply('restored', payload('MENTORSHIP', id))).changed).toBe(0);
    expect((await prisma.mentorship.findUniqueOrThrow({ where: { id } })).status).toBe('CANCELLED');
    const direct = await parrainage('REQUESTED');
    expect((await effects.apply('removed', payload('MENTORSHIP', direct))).changed).toBe(1);
    expect((await prisma.mentorship.findUniqueOrThrow({ where: { id: direct } })).status).toBe('CANCELLED');
  });

  it('évaluation : masquer retire le commentaire (note gardée), rétablir le remet, retirer supprime et recalcule la moyenne', async () => {
    const mentorshipId = await parrainage('REQUESTED');
    const id = newId();
    await prisma.mentorshipReview.create({
      data: { id, mentorshipId, reviewerUserId: mentee, revieweeUserId: mentor, rating: 1, comment: 'Texte à masquer' },
    });
    await effects.apply('hidden', payload('MENTORSHIP_REVIEW', id));
    expect(await prisma.mentorshipReview.findUniqueOrThrow({ where: { id } })).toMatchObject({ comment: null, rating: 1 });
    await effects.apply('restored', payload('MENTORSHIP_REVIEW', id));
    expect((await prisma.mentorshipReview.findUniqueOrThrow({ where: { id } })).comment).toBe('Texte à masquer');

    await prisma.mentorProfile.update({ where: { userId: mentor }, data: { avgRating: '1.00' } });
    expect((await effects.apply('removed', payload('MENTORSHIP_REVIEW', id))).changed).toBe(1);
    expect(await prisma.mentorshipReview.findUnique({ where: { id } })).toBeNull();
    expect((await prisma.mentorProfile.findUniqueOrThrow({ where: { userId: mentor } })).avgRating).toBeNull();
  });

  it('profil de parrain : masquer vide la présentation et éteint le profil, rétablir les remet, retirer éteint pour de bon', async () => {
    await effects.apply('hidden', payload('MENTOR_PROFILE', mentor));
    const hidden = await prisma.mentorProfile.findUniqueOrThrow({ where: { userId: mentor } });
    expect(hidden).toMatchObject({ bio: null, isAvailable: false });
    expect(hidden.disabledAt).not.toBeNull();

    await effects.apply('restored', payload('MENTOR_PROFILE', mentor));
    const back = await prisma.mentorProfile.findUniqueOrThrow({ where: { userId: mentor } });
    expect(back).toMatchObject({ bio: 'Installé depuis dix ans.', isAvailable: true, disabledAt: null });

    expect((await effects.apply('removed', payload('MENTOR_PROFILE', mentor))).changed).toBe(1);
    const removed = await prisma.mentorProfile.findUniqueOrThrow({ where: { userId: mentor } });
    expect(removed).toMatchObject({ bio: null, isAvailable: false });
    expect((await effects.apply('restored', payload('MENTOR_PROFILE', mentor))).changed).toBe(0);
  });

  it('recommandation : masquer retire le commentaire, rétablir le remet, retirer supprime la ligne', async () => {
    const id = newId();
    await prisma.memberRecommendation.create({ data: { id, fromUserId: mentee, toUserId: mentor, comment: 'Très recommandé' } });
    await effects.apply('hidden', payload('MEMBER_RECOMMENDATION', id));
    expect((await prisma.memberRecommendation.findUniqueOrThrow({ where: { id } })).comment).toBeNull();
    await effects.apply('restored', payload('MEMBER_RECOMMENDATION', id));
    expect((await prisma.memberRecommendation.findUniqueOrThrow({ where: { id } })).comment).toBe('Très recommandé');
    expect((await effects.apply('removed', payload('MEMBER_RECOMMENDATION', id))).changed).toBe(1);
    expect(await prisma.memberRecommendation.findUnique({ where: { id } })).toBeNull();
  });

  it('un sujet absent ou sans texte ne lève pas et ne change rien', async () => {
    expect((await effects.apply('hidden', payload('MEMBER_RECOMMENDATION', newId()))).changed).toBe(0);
    expect((await effects.apply('hidden', payload('MENTORSHIP', newId()))).changed).toBe(0);
  });

  it('job.updated passe par la modération (modification de contenu seulement)', async () => {
    const registry = app.get(EventHandlerRegistry);
    const reg = registry.for('job.updated').find((r) => r.module === 'moderation');
    expect(reg).toBeDefined();

    const cityId = await creerVille(prisma);
    const id = newId();
    await prisma.jobListing.create({
      data: { id, authorUserId: mentee, kind: 'JOB', title: 'Aide-cuisinier', description: 'Poste à pourvoir à Lyon.', cityId, status: 'ACTIVE', expiresAt: new Date(Date.now() + 86_400_000) },
    });
    const run = (p: unknown) =>
      reg!.handle({ id: newId(), type: 'job.updated', aggregateId: id, payload: p, occurredAt: new Date().toISOString() });
    const spy = vi.spyOn(app.get(ModerationService), 'handleContentPublished').mockResolvedValue(undefined);
    try {
      await run({ renewed: true });
      await run({ removed: true });
      await run(null);
      expect(spy).not.toHaveBeenCalled();
      await run({ fields: ['title'] });
      expect(spy).toHaveBeenCalledWith('JOB', id);
    } finally {
      spy.mockRestore();
    }
  });
});
