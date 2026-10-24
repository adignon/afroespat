/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any -- le corps des réponses HTTP est lu tel quel. */
import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId } from '@app/db';
import { STAFF_IDLE_MINUTES, STAFF_SESSION_COOKIE } from '@app/shared';
import { AppModule } from '../../../app.module';
import { CryptoService } from '../../../common/crypto.service';
import { ApiErrorFilter } from '../../../common/error.filter';
import { PrismaService } from '../../../common/prisma.service';
import { TokenService } from '../../../common/token.service';
import { hashStaffPassword } from '../staff-password';
import { generateTotpSecret } from '../totp';

/**
 * Annonces (D12) — le CIBLAGE PAR PAYS, VILLES, PHASES ET PLANS (15 §4.2).
 *
 * L'écran propose maintenant les quatre sélecteurs ; ce fichier prouve que le serveur les applique,
 * séparément ET ensemble (ET entre dimensions, OU dans une dimension), et qu'une dimension vide veut
 * dire « tous ». Les membres voient l'annonce par la vraie route `GET /announcements/active`.
 */

const srv = (app: INestApplication): Server => app.getHttpServer() as Server;

describe('annonces — ciblage pays, villes, phases, plans', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let cookie = '';
  const run = Math.random().toString(36).slice(2, 8);
  const users: string[] = [];
  const annonces: string[] = [];
  let staffId = '';
  let tokens: TokenService;
  let benin = '';
  let togo = '';
  let villeA = '';
  let villeB = '';

  async function membre(over: { origine: string; ville: string; plan: 'FREE' | 'PREMIUM'; phase: 'SETTLED' | 'PRE_DEPARTURE' }) {
    const id = newId();
    await prisma.user.create({
      data: { id, handle: `ci${run}${id.slice(-6)}`, displayName: 'Cible', phase: over.phase, verificationLevel: 'L1', originCountryId: over.origine, cityId: over.ville, plan: over.plan, status: 'ACTIVE' },
    });
    users.push(id);
    const token = tokens.sign({ sub: id, sid: newId(), level: 'L1', plan: over.plan, status: 'ACTIVE', exp: Math.floor(Date.now() / 1000) + 900 });
    return { id, auth: { authorization: `Bearer ${token}` } };
  }
  const voit = async (m: { auth: Record<string, string> }): Promise<string | null> => {
    const r = await request(srv(app)).get('/v1/announcements/active').set(m.auth).expect(200);
    return (r.body).announcement?.title ?? null;
  };
  const publier = async (titre: string, target: unknown, decalage: number) => {
    const r = await request(srv(app))
      .post('/v1/admin/announcements')
      .set('cookie', cookie)
      .send({ title: titre, body: 'Texte de l’annonce ciblée.', target, startsAt: new Date(Date.now() - decalage).toISOString() })
      .expect(201);
    annonces.push((r.body).id);
    return r.body;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('v1');
    app.useGlobalFilters(new ApiErrorFilter());
    app.use(cookieParser());
    await app.init();
    prisma = app.get(PrismaService);
    tokens = app.get(TokenService);
    const crypto = app.get(CryptoService);
    benin = (await prisma.country.findFirstOrThrow({ where: { iso2: 'BJ' } })).id;
    togo = (await prisma.country.findFirstOrThrow({ where: { iso2: 'TG' } })).id;
    const villes = await prisma.city.findMany({ take: 2, orderBy: { slug: 'asc' } });
    villeA = villes[0]!.id;
    villeB = villes[1]!.id;
    staffId = newId();
    await prisma.staffUser.create({
      data: { id: staffId, email: `ciblage-${run}@equipe.test`, displayName: 'Contenu', passwordHash: await hashStaffPassword('un-mot-de-passe-equipe-suffisamment-long'), totpSecretEncrypted: crypto.encryptContent(generateTotpSecret()), role: 'CONTENT_ADMIN', isActive: true },
    });
    const token = `c-${run}-${newId()}`;
    await prisma.staffSession.create({ data: { id: newId(), staffId, tokenHash: crypto.hashToken(token), expiresAt: new Date(Date.now() + STAFF_IDLE_MINUTES * 60_000) } });
    cookie = `${STAFF_SESSION_COOKIE}=${token}`;
  });

  afterAll(async () => {
    await prisma.announcement.deleteMany({ where: { id: { in: annonces } } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    try {
      await prisma.staffUser.delete({ where: { id: staffId } });
    } catch {
      await prisma.staffUser.update({ where: { id: staffId }, data: { isActive: false } });
    }
    await app?.close();
  });

  it('le pays d’origine cible : un membre béninois voit l’annonce, un Togolais non', async () => {
    const bj = await membre({ origine: benin, ville: villeA, plan: 'FREE', phase: 'SETTLED' });
    const tg = await membre({ origine: togo, ville: villeA, plan: 'FREE', phase: 'SETTLED' });
    const a = await publier(`Pays ${run}`, { countryIds: [benin] }, 1000);
    expect(a.target).toEqual({ countryIds: [benin] });
    expect(await voit(bj)).toBe(`Pays ${run}`);
    expect(await voit(tg)).not.toBe(`Pays ${run}`);
    await request(srv(app)).delete(`/v1/admin/announcements/${a.id}`).set('cookie', cookie).expect(200);
  });

  it('le plan cible : seul le Premium voit l’annonce réservée au Premium', async () => {
    const free = await membre({ origine: benin, ville: villeA, plan: 'FREE', phase: 'SETTLED' });
    const prem = await membre({ origine: benin, ville: villeA, plan: 'PREMIUM', phase: 'SETTLED' });
    const a = await publier(`Plan ${run}`, { plans: ['PREMIUM'] }, 1000);
    expect(await voit(prem)).toBe(`Plan ${run}`);
    expect(await voit(free)).not.toBe(`Plan ${run}`);
    await request(srv(app)).delete(`/v1/admin/announcements/${a.id}`).set('cookie', cookie).expect(200);
  });

  it('les quatre dimensions se cumulent en ET ; plusieurs valeurs d’une dimension, en OU', async () => {
    const cible = await membre({ origine: benin, ville: villeB, plan: 'PREMIUM', phase: 'PRE_DEPARTURE' });
    const mauvaiseVille = await membre({ origine: benin, ville: villeA, plan: 'PREMIUM', phase: 'PRE_DEPARTURE' });
    const mauvaisePhase = await membre({ origine: benin, ville: villeB, plan: 'PREMIUM', phase: 'SETTLED' });
    const mauvaisPlan = await membre({ origine: benin, ville: villeB, plan: 'FREE', phase: 'PRE_DEPARTURE' });
    const autrePays = await membre({ origine: togo, ville: villeB, plan: 'PREMIUM', phase: 'PRE_DEPARTURE' });
    const titre = `Quatre ${run}`;
    const a = await publier(titre, { countryIds: [benin, newId()], cityIds: [villeB], phases: ['PRE_DEPARTURE', 'RECENT_ARRIVAL'], plans: ['PREMIUM', 'PRO'] }, 500);
    expect(await voit(cible)).toBe(titre);
    for (const m of [mauvaiseVille, mauvaisePhase, mauvaisPlan, autrePays]) expect(await voit(m)).not.toBe(titre);
    // La lecture d'équipe rend le ciblage tel qu'écrit : l'éditeur le rouvre à l'identique.
    const liste = await request(srv(app)).get('/v1/admin/announcements').set('cookie', cookie).expect(200);
    expect((liste.body).items.find((x: any) => x.id === a.id).target).toEqual({
      countryIds: [benin, expect.any(String)], cityIds: [villeB], phases: ['PRE_DEPARTURE', 'RECENT_ARRIVAL'], plans: ['PREMIUM', 'PRO'],
    });
  });

  it('sans ciblage, tous les membres la voient ; un plan ou un pays inconnu est refusé', async () => {
    const m = await membre({ origine: togo, ville: villeA, plan: 'FREE', phase: 'SETTLED' });
    const a = await publier(`Tous ${run}`, null, 100);
    expect(await voit(m)).toBe(`Tous ${run}`);
    await request(srv(app)).delete(`/v1/admin/announcements/${a.id}`).set('cookie', cookie).expect(200);
    await request(srv(app)).post('/v1/admin/announcements').set('cookie', cookie).send({ title: 'x', body: 'y', target: { plans: ['VIP'] }, startsAt: new Date().toISOString() }).expect(400);
    await request(srv(app)).post('/v1/admin/announcements').set('cookie', cookie).send({ title: 'x', body: 'y', target: { countryIds: ['pas-un-uuid'] }, startsAt: new Date().toISOString() }).expect(400);
  });
});
