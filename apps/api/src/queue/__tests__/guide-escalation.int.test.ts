/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any -- le corps des réponses HTTP est lu tel quel. */
import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId } from '@app/db';
import { GUIDE_PROPOSAL_ESCALATION_DAYS, STAFF_IDLE_MINUTES, STAFF_SESSION_COOKIE } from '@app/shared';
import { AppModule } from '../../app.module';
import { CryptoService } from '../../common/crypto.service';
import { ApiErrorFilter } from '../../common/error.filter';
import { PrismaService } from '../../common/prisma.service';
import { TokenService } from '../../common/token.service';
import { hashStaffPassword } from '../../modules/admin/staff-password';
import { generateTotpSecret } from '../../modules/admin/totp';
import { ScheduledTaskRegistry } from '../scheduled-tasks';

/**
 * L'ESCALADE À 14 JOURS D'UNE PROPOSITION DE GUIDE, PAR LA TÂCHE PLANIFIÉE (05 §2.4).
 *
 * Les tests existants (`guides.int.test.ts`) appellent la méthode du service après avoir
 * RÉÉCRIT `escalate_at` en base : ils éprouvent la règle, pas le câblage, et la date y est
 * simulée par une écriture SQL. Ici :
 *
 *   · le guide, la proposition et la décision de l'équipe passent par les VRAIES ROUTES ;
 *   · aucune date n'est réécrite : c'est l'instant passé à la tâche qui avance
 *     (`registry.run(nom, instant)`), exactement comme le fait le planificateur ;
 *   · la tâche est lancée PAR LE REGISTRE DE PRODUCTION, sous son nom de spec
 *     (`guide.proposal_escalation`) : une méthode juste dont l'entrée manquerait dans
 *     `task-registrations.service.ts` ferait échouer ce test.
 */

interface Body {
  [k: string]: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}
const srv = (app: INestApplication): Server => app.getHttpServer() as Server;
const DAY = 86_400_000;

describe('escalade à 14 jours des propositions de guide, par la tâche planifiée', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let registry: ScheduledTaskRegistry;
  let crypto: CryptoService;
  let tokens: TokenService;
  const run = Math.random().toString(36).slice(2, 8);
  let n = 0;
  const userIds: string[] = [];
  const guideIds: string[] = [];
  const staffIds: string[] = [];
  let countryId = '';

  const corps =
    '## Le guichet\n\nLe guichet ouvre tôt le matin et la file s’allonge vite : venez avant l’ouverture. ' +
    'Prévoyez deux photocopies de chaque pièce, la salle n’a pas de photocopieur. Comptez trois semaines ' +
    'entre le dépôt du dossier et la réponse écrite, parfois davantage en période de rentrée scolaire.\n\n' +
    '### Ce qui m’a fait perdre du temps\n\nJ’ai commencé par la mauvaise adresse, au deuxième étage.';

  async function member(level: 'L1' | 'L2') {
    n += 1;
    const id = newId();
    await prisma.user.create({
      data: {
        id, handle: `esc${run}${n}${id.slice(-5)}`, displayName: `Escalade ${n}`, phase: 'SETTLED', verificationLevel: level,
        originCountryId: countryId, plan: 'FREE', status: 'ACTIVE', lastSeenAt: new Date(),
      },
    });
    userIds.push(id);
    const token = tokens.sign({ sub: id, sid: newId(), level, plan: 'FREE', status: 'ACTIVE', exp: Math.floor(Date.now() / 1000) + 900 });
    return { id, auth: { authorization: `Bearer ${token}` } };
  }

  async function staff(role: 'CONTENT_ADMIN' | 'MODERATOR') {
    n += 1;
    const staffId = newId();
    await prisma.staffUser.create({
      data: {
        id: staffId, email: `esc-${run}-${n}@equipe.test`, displayName: `Équipe ${n}`,
        passwordHash: await hashStaffPassword('un-mot-de-passe-equipe-suffisamment-long'),
        totpSecretEncrypted: crypto.encryptContent(generateTotpSecret()), role, isActive: true,
      },
    });
    staffIds.push(staffId);
    const token = `e-${run}-${newId()}`;
    await prisma.staffSession.create({
      data: { id: newId(), staffId, tokenHash: crypto.hashToken(token), expiresAt: new Date(Date.now() + STAFF_IDLE_MINUTES * 60_000) },
    });
    return { cookie: `${STAFF_SESSION_COOKIE}=${token}`, staffId };
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('v1');
    app.useGlobalFilters(new ApiErrorFilter());
    app.use(cookieParser());
    await app.init();
    prisma = app.get(PrismaService);
    crypto = app.get(CryptoService);
    tokens = app.get(TokenService);
    registry = app.get(ScheduledTaskRegistry);
    countryId = (await prisma.country.findFirstOrThrow({ where: { isActive: true, kind: { in: ['ORIGIN', 'BOTH'] } } })).id;
  });

  afterAll(async () => {
    await prisma.guideRevisionProposal.deleteMany({ where: { guideId: { in: guideIds } } });
    await prisma.guide.updateMany({ where: { id: { in: guideIds } }, data: { currentVersionId: null } });
    await prisma.guide.deleteMany({ where: { id: { in: guideIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    for (const id of staffIds) {
      try {
        await prisma.staffUser.delete({ where: { id } });
      } catch {
        await prisma.staffUser.update({ where: { id }, data: { isActive: false } });
      }
    }
    await app?.close();
  });

  it('la tâche existe sous son nom de spec, quotidienne, dans le registre de production', () => {
    const task = registry.get('guide.proposal_escalation');
    expect(task).toBeDefined();
    expect(task?.module).toBe('guides');
    expect(task?.schedule.label).toMatch(/quotidien|chaque jour|3 h 20|03:20|daily/i);
    expect(GUIDE_PROPOSAL_ESCALATION_DAYS).toBe(14);
  });

  it('le parcours réel : proposition par la route, rien à J+13, escalade à J+14 par la tâche, décision de l’équipe', async () => {
    const author = await member('L2');
    const proposer = await member('L2');
    const content = await staff('CONTENT_ADMIN');

    // 1. Un guide PUBLIÉ par ses routes (brouillon puis publication).
    const created = await request(srv(app))
      .post('/v1/guides')
      .set(author.auth)
      .send({ title: `Démarche en préfecture ${run}`, body: corps, category: 'ARRIVAL', scope: 'UNIVERSAL' })
      .expect(201);
    const guideId = (created.body as Body).id as string;
    guideIds.push(guideId);
    await request(srv(app)).post(`/v1/guides/${guideId}/publish`).set(author.auth).expect(201);

    // 2. Une proposition, par la route du proposant.
    const proposed = await request(srv(app))
      .post(`/v1/guides/${guideId}/proposals`)
      .set(proposer.auth)
      .send({
        targetExcerpt: 'Le guichet ouvre tôt le matin',
        replacement: 'Le guichet ouvre désormais à 9 h',
        reason: 'Les horaires ont changé au 1er septembre, vérifié sur place.',
      })
      .expect(201);
    const proposalId = (proposed.body as Body).id as string;
    const row = await prisma.guideRevisionProposal.findUniqueOrThrow({ where: { id: proposalId } });
    expect(row.status).toBe('PENDING');
    const echeance = row.escalateAt.getTime();
    expect(Math.round((echeance - row.createdAt.getTime()) / DAY)).toBe(GUIDE_PROPOSAL_ESCALATION_DAYS);

    // 3. J+13 : la tâche tourne et n'escalade PAS cette proposition. (Elle peut en escalader
    //    d'autres de la base : on ne compte que la nôtre.)
    await registry.run('guide.proposal_escalation', new Date(echeance - DAY));
    expect((await prisma.guideRevisionProposal.findUniqueOrThrow({ where: { id: proposalId } })).status).toBe('PENDING');
    expect(await prisma.moderationCase.count({ where: { subjectType: 'GUIDE', subjectId: guideId, priority: 3 } })).toBe(0);
    // L'équipe n'a encore rien à trancher.
    const avant = await request(srv(app)).get('/v1/admin/guides/proposals/escalated').set('cookie', content.cookie).expect(200);
    expect((avant.body as Body).items.find((p: Body) => p.id === proposalId)).toBeUndefined();
    await request(srv(app)).post(`/v1/admin/guides/proposals/${proposalId}/decide`).set('cookie', content.cookie).send({ decision: 'ACCEPT' }).expect(409);

    // 4. J+14 : la tâche, lancée par le registre, escalade.
    const passage = await registry.run('guide.proposal_escalation', new Date(echeance + 60_000));
    expect(passage.task).toBe('guide.proposal_escalation');
    expect(passage.summary).toMatch(/escalated/);
    const escaladee = await prisma.guideRevisionProposal.findUniqueOrThrow({ where: { id: proposalId } });
    expect(escaladee.status).toBe('ESCALATED');
    // Dossier de modération de priorité 3 + événement de domaine.
    expect(await prisma.moderationCase.count({ where: { subjectType: 'GUIDE', subjectId: guideId, priority: 3 } })).toBe(1);
    expect(await prisma.domainEvent.count({ where: { type: 'guide.proposal_escalated', aggregateId: proposalId } })).toBe(1);

    // 5. Rejouée, la tâche ne refait rien : un seul dossier, un seul événement.
    await registry.run('guide.proposal_escalation', new Date(echeance + 2 * 60_000));
    expect(await prisma.moderationCase.count({ where: { subjectType: 'GUIDE', subjectId: guideId, priority: 3 } })).toBe(1);
    expect(await prisma.domainEvent.count({ where: { type: 'guide.proposal_escalated', aggregateId: proposalId } })).toBe(1);

    // 6. Le créateur ne décide plus ; l'équipe, par sa route, voit la proposition et l'accepte.
    await request(srv(app)).post(`/v1/proposals/${proposalId}/accept`).set(author.auth).expect(409);
    const apres = await request(srv(app)).get('/v1/admin/guides/proposals/escalated').set('cookie', content.cookie).expect(200);
    const ligne = (apres.body as Body).items.find((p: Body) => p.id === proposalId);
    expect(ligne).toMatchObject({ guideId, after: 'Le guichet ouvre désormais à 9 h' });
    expect(ligne.daysOverdue).toBeGreaterThanOrEqual(0);
    await request(srv(app)).post(`/v1/admin/guides/proposals/${proposalId}/decide`).set('cookie', content.cookie).send({ decision: 'ACCEPT' }).expect(200);
    const decidee = await prisma.guideRevisionProposal.findUniqueOrThrow({ where: { id: proposalId } });
    expect(decidee.status).toBe('ACCEPTED');
    expect(decidee.reviewerStaffId).toBe(content.staffId);
  });
});
