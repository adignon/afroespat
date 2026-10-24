/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any -- le corps des réponses HTTP est lu tel quel. */
import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId } from '@app/db';
import { STAFF_IDLE_MINUTES, STAFF_SESSION_COOKIE, type StaffRoleValue } from '@app/shared';
import { AppModule } from '../../../app.module';
import { CryptoService } from '../../../common/crypto.service';
import { ApiErrorFilter } from '../../../common/error.filter';
import { PrismaService } from '../../../common/prisma.service';
import { TokenService } from '../../../common/token.service';
import { hashStaffPassword } from '../staff-password';
import { generateTotpSecret } from '../totp';

/**
 * D10 — « fiches pro en attente » : l'équipe doit POUVOIR LIRE le justificatif qu'elle valide.
 *
 * Avant : `GET /media/…` ne sert un justificatif qu'à son propriétaire, et l'écran ne montrait que « image/png · 1 Ko » —
 * la validation se faisait à l'aveugle. `GET /admin/pro-profiles/:id/proof` le sert aux rôles `proReview`, trace la
 * consultation, et reste fermé à tout le monde d'autre. Le dépôt, la fiche et la décision passent par les VRAIES routes.
 */

const srv = (app: INestApplication): Server => app.getHttpServer() as Server;
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

describe('justificatif d’une fiche pro, lu par l’équipe', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let crypto: CryptoService;
  let tokens: TokenService;
  const run = Math.random().toString(36).slice(2, 8);
  let n = 0;
  const staffIds: string[] = [];
  const userIds: string[] = [];
  let fiche = '';
  let sansJustificatif = '';
  let membreAuth: Record<string, string> = {};

  async function as(role: StaffRoleValue) {
    n += 1;
    const staffId = newId();
    await prisma.staffUser.create({
      data: { id: staffId, email: `proof-${run}-${n}@equipe.test`, displayName: `Équipe ${n}`, passwordHash: await hashStaffPassword('un-mot-de-passe-equipe-suffisamment-long'), totpSecretEncrypted: crypto.encryptContent(generateTotpSecret()), role, isActive: true },
    });
    staffIds.push(staffId);
    const token = `p-${run}-${newId()}`;
    await prisma.staffSession.create({ data: { id: newId(), staffId, tokenHash: crypto.hashToken(token), expiresAt: new Date(Date.now() + STAFF_IDLE_MINUTES * 60_000) } });
    return { cookie: `${STAFF_SESSION_COOKIE}=${token}`, staffId };
  }
  async function membre() {
    n += 1;
    const id = newId();
    const country = await prisma.country.findFirstOrThrow({ where: { iso2: 'BJ' } });
    const city = await prisma.city.findFirstOrThrow({ orderBy: { slug: 'asc' } });
    await prisma.user.create({
      data: { id, handle: `pj${run}${n}${id.slice(-5)}`, displayName: `Pro ${n}`, phase: 'SETTLED', verificationLevel: 'L2', originCountryId: country.id, cityId: city.id, plan: 'FREE', status: 'ACTIVE' },
    });
    userIds.push(id);
    const token = tokens.sign({ sub: id, sid: newId(), level: 'L2', plan: 'FREE', status: 'ACTIVE', exp: Math.floor(Date.now() / 1000) + 900 });
    return { id, cityId: city.id, auth: { authorization: `Bearer ${token}` } };
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
    const pro = await membre();
    membreAuth = pro.auth;
    const up = await request(srv(app)).post('/v1/media').set(pro.auth).field('kind', 'PROOF').attach('file', PNG, { filename: 'justificatif.png', contentType: 'image/png' }).expect(201);
    const profession = await prisma.profession.findFirstOrThrow({ where: { isActive: true } });
    const put = await request(srv(app))
      .put('/v1/me/pro-profile')
      .set(pro.auth)
      .send({ professionId: profession.id, businessName: `Cabinet ${run}`, contactMethod: 'PLATFORM_MESSAGE', cityIds: [pro.cityId], proofAssetId: (up.body).id })
      .expect(200);
    fiche = (put.body).id;
  });

  afterAll(async () => {
    await prisma.proProfile.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.mediaAsset.deleteMany({ where: { ownerUserId: { in: userIds } } });
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

  it('SUPPORT, CONTENT_ADMIN et SUPER_ADMIN lisent le justificatif ; chaque lecture est tracée', async () => {
    for (const role of ['SUPPORT', 'CONTENT_ADMIN', 'SUPER_ADMIN'] as const) {
      const staff = await as(role);
      const res = await request(srv(app)).get(`/v1/admin/pro-profiles/${fiche}/proof`).set('cookie', staff.cookie).buffer(true).expect(200);
      expect(res.headers['content-type']).toContain('image/png');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['content-security-policy']).toContain('sandbox');
      expect(res.headers['cache-control']).toContain('no-store');
      expect(Buffer.from(res.body as Buffer).length).toBeGreaterThan(0);
      expect(await prisma.auditLog.count({ where: { action: 'pro.proof_viewed', actorId: staff.staffId, targetId: fiche } })).toBe(1);
    }
  });

  it('un MODÉRATEUR ne le lit pas (§2.2), pas plus qu’un visiteur ou qu’un membre — même le propriétaire par cette route', async () => {
    const mod = await as('MODERATOR');
    await request(srv(app)).get(`/v1/admin/pro-profiles/${fiche}/proof`).set('cookie', mod.cookie).expect(403);
    await request(srv(app)).get(`/v1/admin/pro-profiles/${fiche}/proof`).expect(401);
    await request(srv(app)).get(`/v1/admin/pro-profiles/${fiche}/proof`).set(membreAuth).expect(401);
    expect(await prisma.auditLog.count({ where: { action: 'pro.proof_viewed', actorId: mod.staffId } })).toBe(0);
  });

  it('une fiche sans justificatif, ou inconnue, répond 404 et ne trace rien', async () => {
    const staff = await as('SUPPORT');
    const autre = await membre();
    const profession = await prisma.profession.findFirstOrThrow({ where: { isActive: true } });
    sansJustificatif = newId();
    await prisma.proProfile.create({
      data: { id: sansJustificatif, userId: autre.id, professionId: profession.id, contactMethod: 'PLATFORM_MESSAGE', verificationStatus: 'PENDING', tier: 'FREE', status: 'ACTIVE' },
    });
    await request(srv(app)).get(`/v1/admin/pro-profiles/${sansJustificatif}/proof`).set('cookie', staff.cookie).expect(404);
    await request(srv(app)).get(`/v1/admin/pro-profiles/${newId()}/proof`).set('cookie', staff.cookie).expect(404);
    expect(await prisma.auditLog.count({ where: { action: 'pro.proof_viewed', actorId: staff.staffId } })).toBe(0);
  });

  it('le geste complet : voir, approuver (ou refuser avec motif) — la fiche suit', async () => {
    const staff = await as('SUPPORT');
    await request(srv(app)).post(`/v1/admin/pro-profiles/${fiche}/reject`).set('cookie', staff.cookie).send({ reason: 'court' }).expect(400);
    const rejet = await request(srv(app)).post(`/v1/admin/pro-profiles/${fiche}/reject`).set('cookie', staff.cookie).send({ reason: 'Le justificatif est illisible : merci de déposer une copie nette.' });
    expect(rejet.status).toBeLessThan(300);
    expect((await prisma.proProfile.findUniqueOrThrow({ where: { id: fiche } })).verificationStatus).toBe('REJECTED');
    expect(await prisma.auditLog.count({ where: { action: 'pro.rejected', targetId: fiche } })).toBe(1);
  });
});
