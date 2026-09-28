import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Server } from 'node:http';
import { newId } from '@app/db';
import { AppModule } from '../../app.module';
import { ApiErrorFilter } from '../error.filter';
import { PrismaService } from '../prisma.service';
import { TokenService } from '../token.service';

/**
 * `@AllowSuspended()` — 13 §4.3 contre 00 §7.3.
 *
 * §7.3 refuse toute écriture à un compte suspendu. §4.3 lui donne le droit de
 * CONTESTER sa sanction. Contester est une écriture : les deux règles se
 * heurtaient, et c'est le refus qui gagnait.
 *
 * Une sanction sans recours effectif n'est pas une sanction, c'est une exclusion.
 * Ce test éprouve donc les DEUX moitiés : la contestation passe, et rien d'autre.
 */
describe('compte suspendu : ce qu’il peut et ne peut pas (13 §4.3)', () => {
  let app: INestApplication;
  /** `getHttpServer()` rend `any` : on le typifie une fois pour toutes. */
  const server = (): Server => app.getHttpServer() as Server;
  let prisma: PrismaService;
  let tokens: TokenService;
  const created: string[] = [];
  let staffId = '';

  /** Un jeton de membre SUSPENDU, tel qu'il en recevrait un en se reconnectant. */
  function suspendedToken(userId: string): string {
    return tokens.sign({
      sub: userId,
      sid: newId(),
      level: 'L0',
      plan: 'FREE',
      // Le piège d'origine : la suspension révoque les sessions, le membre se
      // reconnecte, et c'est son jeton NEUF qui porte `SUSPENDED`.
      status: 'SUSPENDED',
      exp: Math.floor(Date.now() / 1000) + 900,
    });
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('v1');
    app.useGlobalFilters(new ApiErrorFilter());
    await app.init();

    prisma = app.get(PrismaService);
    tokens = app.get(TokenService);

    /**
     * Un compte d'équipe est INDISPENSABLE : `sanctions.issued_by_staff_id` est
     * NOT NULL — une sanction a toujours un auteur humain, ce qui est une règle
     * dure de §4.2 et non un détail de schéma.
     *
     * Il est réutilisé et NON supprimé : un `staff_users` qui a pris une action de
     * modération ne peut plus l'être, la cascade `SetNull` étant un UPDATE que le
     * déclencheur d'ajout seul refuse.
     */
    const staff = await prisma.staffUser.upsert({
      where: { email: 'test-suspension@local' },
      update: {},
      create: {
        id: newId(),
        email: 'test-suspension@local',
        displayName: 'Équipe (test)',
        passwordHash: 'x',
        totpSecretEncrypted: new Uint8Array([0]),
        role: 'MODERATOR',
        isActive: true,
      },
      select: { id: true },
    });
    staffId = staff.id;
  });

  afterAll(async () => {
    if (created.length > 0) await prisma.user.deleteMany({ where: { id: { in: created } } });
    await app?.close();
  });

  async function suspendedMember(): Promise<{ id: string; token: string; sanctionId: string }> {
    const country = await prisma.country.findFirstOrThrow({
      where: { isActive: true, kind: { in: ['ORIGIN', 'BOTH'] } },
      select: { id: true },
    });
    const id = newId();
    await prisma.user.create({
      data: {
        id,
        handle: `susp${id.slice(-8)}`,
        displayName: 'Suspendu',
        phase: 'PRE_DEPARTURE',
        verificationLevel: 'L0',
        originCountryId: country.id,
        plan: 'FREE',
        status: 'SUSPENDED',
      },
    });
    created.push(id);

    /**
     * La sanction porte un DOSSIER, et ce n'est pas un détail de test.
     *
     * `appeal()` refuse en 404 une sanction sans `case_id`, parce que la
     * contestation s'écrit dans l'historique du dossier. Une sanction posée sans
     * dossier ne serait donc pas contestable — angle mort consigné dans le journal
     * de décisions, à combler quand l'application d'équipe existera.
     */
    const moderationCase = await prisma.moderationCase.create({
      data: {
        id: newId(),
        subjectType: 'USER',
        subjectId: id,
        subjectAuthorUserId: id,
        source: 'REPORT',
        priority: 2,
        status: 'RESOLVED',
        slaDueAt: new Date(),
      },
      select: { id: true },
    });

    const sanction = await prisma.sanction.create({
      data: {
        id: newId(),
        userId: id,
        type: 'SUSPENSION',
        reason: 'Motif de test suffisamment long pour la règle.',
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 7 * 86_400_000),
        issuedByStaffId: staffId,
        caseId: moderationCase.id,
      },
    });

    return { id, token: suspendedToken(id), sanctionId: sanction.id };
  }

  it('peut CONTESTER sa sanction', async () => {
    const member = await suspendedMember();

    const response = await request(server())
      .post(`/v1/sanctions/${member.sanctionId}/appeal`)
      .set('authorization', `Bearer ${member.token}`)
      .send({ text: 'Je conteste cette sanction, voici mon explication détaillée.' });

    // Avant l'exemption : 403 ACCOUNT_SUSPENDED. Le membre n'avait aucun recours.
    expect(response.status).toBe(201);
  });

  it('peut LIRE ses sanctions', async () => {
    const member = await suspendedMember();

    const response = await request(server())
      .get('/v1/me/sanctions')
      .set('authorization', `Bearer ${member.token}`);

    // §7.3 : « un compte suspendu peut toujours consulter ».
    expect(response.status).toBe(200);
  });

  it('ne peut TOUJOURS PAS publier', async () => {
    const member = await suspendedMember();

    const response = await request(server())
      .post('/v1/posts')
      .set('authorization', `Bearer ${member.token}`)
      .send({ type: 'DISCUSSION', body: 'Une publication qui ne doit pas passer.' });

    /**
     * La moitié qui compte autant que l'autre.
     *
     * L'exemption est NOMMÉE route par route : si elle s'appliquait largement, un
     * membre sanctionné continuerait de publier — et la sanction ne servirait plus
     * à rien.
     */
    expect(response.status).toBe(403);
    // `response.body` est `any` : on le rétrécit plutôt que de désactiver le lint.
    const body = response.body as { error: { code: string } };
    expect(body.error.code).toBe('ACCOUNT_SUSPENDED');
  });

  it('ne peut pas signaler un contenu', async () => {
    const member = await suspendedMember();

    const response = await request(server())
      .post('/v1/reports')
      .set('authorization', `Bearer ${member.token}`)
      .send({ subjectType: 'POST', subjectId: newId(), reason: 'SCAM' });

    // Signaler est un droit ouvert à L0, mais pas une voie de recours : rien dans
    // §4.3 ne l'ouvre à un compte suspendu.
    expect(response.status).toBe(403);
  });

});
