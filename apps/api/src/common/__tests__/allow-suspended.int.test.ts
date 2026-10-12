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

  /**
   * Un jeton de membre SUSPENDU, tel qu'il en recevrait un en se reconnectant.
   *
   * LE NIVEAU EST UN PARAMÈTRE DEPUIS QUE `sanction.appeal` EST EN L2. Il était
   * figé à `'L0'`, ce qui suffisait quand contester ne demandait aucun niveau :
   * le seul obstacle à éprouver était la suspension. Il y en a deux maintenant,
   * et les confondre dans un seul jeton rendrait ce fichier incapable de dire
   * LEQUEL des deux a refusé.
   */
  function suspendedToken(userId: string, level: 'L0' | 'L1' | 'L2' = 'L0'): string {
    return tokens.sign({
      sub: userId,
      sid: newId(),
      level,
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

  async function suspendedMember(
    level: 'L0' | 'L1' | 'L2' = 'L0',
  ): Promise<{ id: string; token: string; sanctionId: string }> {
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

    return {
      id,
      token: suspendedToken(id, level),
      sanctionId: sanction.id,
    };
  }

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LA SUSPENSION NE FERME PLUS LE RECOURS. LE NIVEAU, LUI, LE FERME        ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Ce cas tenait en une ligne : contester passe, 201. Il tombe depuis que
   * `sanction.appeal` est en L2 (refonte des niveaux, « N2 : faire tout le
   * reste » ; j'avais argumenté qu'un recours n'est pas une fonctionnalité, et le
   * porteur a tranché : « corrige ceci »).
   *
   * ⚠ CE QUI EST MESURÉ ICI EST À REMONTER, ET C'EST POURQUOI LE CAS EST GARDÉ
   * EN DEUX MOITIÉS PLUTÔT QUE RÉÉCRIT EN UNE : un membre sanctionné qui n'a
   * jamais atteint N2 n'a AUCUNE voie de recours. L'en-tête de ce fichier dit, et
   * disait déjà avant cet arbitrage : « Une sanction sans recours effectif n'est
   * pas une sanction, c'est une exclusion. » C'est maintenant le cas pour tout
   * compte sanctionné en N0 ou N1, et un compte sanctionné est précisément celui
   * qui ne va pas déposer une pièce d'identité et un justificatif de domicile
   * pour obtenir le droit de se défendre.
   *
   * Le geler en deux moitiés rend la chose VISIBLE au lieu de la dissoudre :
   *
   *   · en N2, contester passe — donc `@AllowSuspended()` fait toujours son
   *     travail, et §4.3 l'emporte toujours sur §7.3. C'était l'objet de ce
   *     fichier, et il tient ;
   *   · en N0, contester est refusé par `LEVEL_REQUIRED` et NON par
   *     `ACCOUNT_SUSPENDED`. Le code d'erreur est la preuve que ce n'est pas
   *     l'exemption qui a cédé : c'est une seconde porte, posée ailleurs.
   *
   * Revenir en arrière tient en un mot dans `capabilities.ts` :
   * `'sanction.appeal': { minLevel: 'L0' }`. Ce cas-ci tombera alors, et il faudra
   * le retourner — ce qui est exactement ce qu'on attend de lui.
   */
  it('peut CONTESTER sa sanction — en N2, le niveau qu’exige désormais le recours', async () => {
    const member = await suspendedMember('L2');

    const response = await request(server())
      .post(`/v1/sanctions/${member.sanctionId}/appeal`)
      .set('authorization', `Bearer ${member.token}`)
      .send({ text: 'Je conteste cette sanction, voici mon explication détaillée.' });

    // Avant l'exemption : 403 ACCOUNT_SUSPENDED. Le membre n'avait aucun recours.
    expect(response.status, JSON.stringify(response.body)).toBe(201);
  });

  it('⚠ en N0, le recours est fermé par le NIVEAU et non par la suspension', async () => {
    const member = await suspendedMember('L0');

    const response = await request(server())
      .post(`/v1/sanctions/${member.sanctionId}/appeal`)
      .set('authorization', `Bearer ${member.token}`)
      .send({ text: 'Je conteste cette sanction, voici mon explication détaillée.' });

    expect(response.status).toBe(403);
    const body = response.body as {
      error: { code: string; details?: { capability?: string; requiredLevel?: string } };
    };
    /**
     * LE CODE EST CE QUI COMPTE DANS CE CAS. `LEVEL_REQUIRED` dit que l'exemption
     * de §4.3 a bien laissé passer le compte suspendu, et qu'un autre garde a
     * refusé derrière. `ACCOUNT_SUSPENDED` voudrait dire que l'exemption a cédé —
     * ce serait une régression du fichier, pas une conséquence de l'arbitrage.
     */
    expect(body.error.code).toBe('LEVEL_REQUIRED');
    expect(body.error.details?.capability).toBe('sanction.appeal');
    expect(body.error.details?.requiredLevel).toBe('L2');
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
