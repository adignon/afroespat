/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any -- le corps des réponses HTTP est lu tel quel : le typer champ par champ doublerait chaque test sans rien prouver de plus. */
import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId } from '@app/db';
import { STAFF_IDLE_MINUTES, STAFF_SESSION_COOKIE, adminImpactCandidatesSchema, adminImpactReportSchema, type StaffRoleValue } from '@app/shared';
import { AppModule } from '../../../app.module';
import { CryptoService } from '../../../common/crypto.service';
import { ApiErrorFilter } from '../../../common/error.filter';
import { PrismaService } from '../../../common/prisma.service';
import { TokenService } from '../../../common/token.service';
import { hashStaffPassword } from '../../admin/staff-password';
import { generateTotpSecret } from '../../admin/totp';
import { ImpactService } from '../impact.service';

/**
 * Le rapport d'impact — HISTORIQUE par trimestre et TÉMOIGNAGES consentis (15 §5.3).
 * Décision du porteur : « il faut tout conserver ».
 *
 * Les trimestres éprouvés sont des trimestres CLOS du passé lointain (2024-T1, 2024-T2) :
 * le calcul `impactPoints(début, fin)` y est déterministe pour les membres créés avant
 * leur fin, et aucun instantané réel de la base de développement ne s'y trouve.
 */

interface Body {
  [k: string]: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}
const srv = (app: INestApplication): Server => app.getHttpServer() as Server;

describe('rapport d’impact : historique, témoignages, export (15 §5.3)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let crypto: CryptoService;
  let tokens: TokenService;
  let impact: ImpactService;
  const run = Math.random().toString(36).slice(2, 8);
  let n = 0;
  const staffIds: string[] = [];
  const userIds: string[] = [];
  const guideIds: string[] = [];
  const tipIds: string[] = [];
  const QUARTERS = ['2024-T1', '2024-T2', '2024-T3'];
  let originCountryId = '';
  let cityId = '';
  let cityName = '';

  async function as(role: StaffRoleValue): Promise<{ cookie: string; staffId: string }> {
    n += 1;
    const staffId = newId();
    await prisma.staffUser.create({
      data: {
        id: staffId,
        email: `imp-${run}-${n}@equipe.test`,
        displayName: `Équipe ${role} ${n}`,
        passwordHash: await hashStaffPassword('un-mot-de-passe-equipe-suffisamment-long'),
        totpSecretEncrypted: crypto.encryptContent(generateTotpSecret()),
        role,
        isActive: true,
      },
    });
    staffIds.push(staffId);
    const token = `i-${run}-${newId()}`;
    await prisma.staffSession.create({
      data: { id: newId(), staffId, tokenHash: crypto.hashToken(token), expiresAt: new Date(Date.now() + STAFF_IDLE_MINUTES * 60_000) },
    });
    return { cookie: `${STAFF_SESSION_COOKIE}=${token}`, staffId };
  }

  async function member(createdAt?: Date) {
    n += 1;
    const id = newId();
    await prisma.user.create({
      data: {
        id, handle: `im${run}${n}${id.slice(-5)}`, displayName: `Impact ${n}`, phase: 'SETTLED', verificationLevel: 'L2',
        originCountryId, cityId, plan: 'FREE', status: 'ACTIVE', ...(createdAt === undefined ? {} : { createdAt }),
      },
    });
    userIds.push(id);
    const token = tokens.sign({ sub: id, sid: newId(), level: 'L2', plan: 'FREE', status: 'ACTIVE', exp: Math.floor(Date.now() / 1000) + 900 });
    return { id, auth: { authorization: `Bearer ${token}` } };
  }

  async function tip(authorUserId: string, body = 'Le marché de la Croix-Rousse le dimanche matin, tout le monde s’y retrouve.') {
    const id = newId();
    await prisma.cityTip.create({ data: { id, cityId, authorUserId, kind: 'TIP', body, status: 'PUBLISHED' } });
    tipIds.push(id);
    return id;
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
    impact = app.get(ImpactService);
    originCountryId = (await prisma.country.findFirstOrThrow({ where: { isActive: true, kind: { in: ['ORIGIN', 'BOTH'] } } })).id;
    const city = await prisma.city.findFirstOrThrow({ orderBy: { slug: 'asc' } });
    cityId = city.id;
    cityName = city.name;
  });

  afterAll(async () => {
    await prisma.impactQuote.deleteMany({ where: { quarter: { in: QUARTERS } } });
    await prisma.impactReportSnapshot.deleteMany({ where: { quarter: { in: QUARTERS } } });
    await prisma.metricSnapshot.deleteMany({ where: { metric: { startsWith: 'impact.' }, periodStart: { lt: new Date('2025-01-01') } } });
    await prisma.cityTip.deleteMany({ where: { id: { in: tipIds } } });
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

  const get = (cookie: string, path: string) => request(srv(app)).get(`/v1/admin${path}`).set('cookie', cookie);

  // ══ L’historique ══════════════════════════════════════════════════════════

  describe('historique par trimestre (jamais écrasé)', () => {
    it('un trimestre sans instantané n’invente rien : révision nulle, aucun point', async () => {
      const staff = await as('SUPPORT');
      const res = await get(staff.cookie, '/impact?quarter=2024-T3').expect(200);
      const parsed = adminImpactReportSchema.safeParse(res.body);
      expect(parsed.success ? null : parsed.error.issues).toBeNull();
      expect(res.body).toMatchObject({ trimestre: '2024-T3', revision: null, computedAt: null, items: [], temoignages: [] });
      await get(staff.cookie, '/impact?quarter=n-importe-quoi').expect(400);
    });

    it('la tâche trimestrielle pose la révision 1, une seconde passe n’en pose pas', async () => {
      const first = await impact.prepareQuarter(new Date('2024-04-10T06:00:00Z'));
      expect(first).toMatchObject({ trimestre: '2024-T1', revision: 1 });
      const again = await impact.prepareQuarter(new Date('2024-04-11T06:00:00Z'));
      expect(again).toMatchObject({ trimestre: '2024-T1', revision: null });
      expect(await prisma.impactReportSnapshot.count({ where: { quarter: '2024-T1' } })).toBe(1);
    });

    it('un recalcul pose la révision SUIVANTE : l’ancienne reste intacte et lisible', async () => {
      const content = await as('CONTENT_ADMIN');
      const support = await as('SUPPORT');
      const avant = await prisma.impactReportSnapshot.findFirstOrThrow({ where: { quarter: '2024-T1', revision: 1 } });

      // Un membre inscrit en février 2024 : il compte dans « membres accompagnés » du trimestre.
      await member(new Date('2024-02-01T10:00:00Z'));

      await request(srv(app)).post('/v1/admin/impact/recompute').set('cookie', support.cookie).send({ quarter: '2024-T1' }).expect(403);
      const res = await request(srv(app)).post('/v1/admin/impact/recompute').set('cookie', content.cookie).send({ quarter: '2024-T1' }).expect(201);
      expect(res.body).toMatchObject({ trimestre: '2024-T1', revision: 2 });

      // La révision 1 n'a pas bougé d'un octet.
      const apres = await prisma.impactReportSnapshot.findFirstOrThrow({ where: { quarter: '2024-T1', revision: 1 } });
      expect(apres.items).toEqual(avant.items);
      expect(apres.createdAt.toISOString()).toBe(avant.createdAt.toISOString());

      const lecture = await get(support.cookie, '/impact?quarter=2024-T1').expect(200);
      expect(lecture.body.revision).toBe(2);
      const accompagnes = (rev: Body) => rev.items.find((i: Body) => i.metric === 'impact.members_accompanied' && i.dimension === '').value;
      const v1 = (avant.items as Body[]).find((i) => i.metric === 'impact.members_accompanied')!.value;
      expect(accompagnes(lecture.body)).toBe(v1 + 1);

      // Le sélecteur de trimestre : chaque trimestre conservé, avec sa dernière révision.
      expect(lecture.body.quarters.find((q: Body) => q.quarter === '2024-T1')).toMatchObject({ revision: 2 });
      expect(await prisma.impactReportSnapshot.count({ where: { quarter: '2024-T1' } })).toBe(2);
      expect(await prisma.auditLog.count({ where: { action: 'impact.recomputed', actorId: content.staffId } })).toBe(1);
    });

    it('deux trimestres se lisent séparément, et un trimestre non clos ne se recalcule pas', async () => {
      const content = await as('CONTENT_ADMIN');
      await impact.prepareQuarter(new Date('2024-07-02T06:00:00Z'));
      const t1 = (await get(content.cookie, '/impact?quarter=2024-T1').expect(200)).body;
      const t2 = (await get(content.cookie, '/impact?quarter=2024-T2').expect(200)).body;
      expect(t1.trimestre).toBe('2024-T1');
      expect(t2.trimestre).toBe('2024-T2');
      expect(t2.revision).toBe(1);
      expect(t2.quarters.map((q: Body) => q.quarter)).toEqual(expect.arrayContaining(['2024-T2', '2024-T1']));
      // Le plus récent d'abord.
      const ordre = t2.quarters.map((q: Body) => q.quarter);
      expect([...ordre].sort().reverse()).toEqual(ordre);

      const res = await request(srv(app)).post('/v1/admin/impact/recompute').set('cookie', content.cookie).send({ quarter: '2999-T1' }).expect(409);
      expect(res.body.error.code).toBe('IMPACT_QUARTER_OPEN');
    });

    it('sans `quarter`, le rapport est celui du trimestre conservé le plus récent', async () => {
      const staff = await as('MODERATOR');
      const res = await get(staff.cookie, '/impact').expect(200);
      const attendu = (await impact.quarters())[0]!.quarter;
      expect(res.body.trimestre).toBe(attendu);
    });

    it('aucune donnée nominative : ni identifiant ni nom de membre dans le rapport', async () => {
      const staff = await as('SUPPORT');
      const raw = JSON.stringify((await get(staff.cookie, '/impact?quarter=2024-T1').expect(200)).body);
      for (const id of userIds) expect(raw).not.toContain(id);
      expect(raw).not.toMatch(/handle|displayName|authorUserId|userId|phone/i);
    });
  });

  // ══ L’export CSV par trimestre ════════════════════════════════════════════

  describe('export CSV par trimestre', () => {
    it('rend le trimestre demandé (tranches nommées), tracé à l’audit', async () => {
      const staff = await as('SUPPORT');
      const res = await get(staff.cookie, '/impact/export?quarter=2024-T1').expect(200);
      expect(res.headers['content-type']).toContain('text/csv');
      const csv = res.text;
      expect(csv.startsWith('﻿"trimestre","revision","indicateur","tranche","valeur"')).toBe(true);
      expect(csv).toContain('"2024-T1","2","impact.members_accompanied","",');
      // Les villes sont NOMMÉES, pas des UUID.
      expect(csv).toContain(`"impact.members_by_city","${cityName}"`);
      expect(await prisma.auditLog.count({ where: { action: 'impact.exported', actorId: staff.staffId } })).toBe(1);
      const log = await prisma.auditLog.findFirstOrThrow({ where: { action: 'impact.exported', actorId: staff.staffId } });
      expect(log.metadata).toMatchObject({ trimestre: '2024-T1', revision: 2 });
    });

    it('un autre trimestre donne un autre fichier, et un trimestre vide ne contient que l’en-tête', async () => {
      const staff = await as('CONTENT_ADMIN');
      const t2 = (await get(staff.cookie, '/impact/export?quarter=2024-T2').expect(200)).text;
      expect(t2).toContain('"2024-T2","1"');
      expect(t2).not.toContain('"2024-T1"');
      const vide = (await get(staff.cookie, '/impact/export?quarter=2024-T3').expect(200)).text;
      expect(vide.trim().split('\r\n')).toHaveLength(1);
    });
  });

  // ══ Les témoignages ═══════════════════════════════════════════════════════

  describe('témoignages : accord de l’auteur, citation modérée, affichage', () => {
    it('le parcours complet : accord → approbation → rapport → retrait d’accord → disparition', async () => {
      const content = await as('CONTENT_ADMIN');
      const support = await as('SUPPORT');
      const auteur = await member();
      const autre = await member();
      const tipId = await tip(auteur.id);
      const quote = 'Le marché du dimanche matin, tout le monde s’y retrouve.';

      // 1. Sans accord, le contenu n'est pas proposé, et une requête forgée est refusée.
      const sans = adminImpactCandidatesSchema.parse((await get(content.cookie, '/impact/testimonials?quarter=2024-T1').expect(200)).body);
      expect(sans.items.find((i) => i.sourceId === tipId)).toBeUndefined();
      const forge = await request(srv(app)).put('/v1/admin/impact/quotes').set('cookie', content.cookie).send({ quarter: '2024-T1', kind: 'CITY_TIP', sourceId: tipId, quote }).expect(409);
      expect(forge.body.error.code).toBe('IMPACT_QUOTE_NOT_CONSENTED');

      // 2. SEUL l'auteur donne son accord.
      await request(srv(app)).put(`/v1/tips/${tipId}/quotable`).set(autre.auth).send({ quotable: true }).expect(404);
      await request(srv(app)).put(`/v1/tips/${tipId}/quotable`).send({ quotable: true }).expect(401);
      await request(srv(app)).put(`/v1/tips/${tipId}/quotable`).set(auteur.auth).send({ quotable: 'oui' }).expect(400);
      const ok = await request(srv(app)).put(`/v1/tips/${tipId}/quotable`).set(auteur.auth).send({ quotable: true }).expect(200);
      expect(ok.body).toEqual({ quotable: true });

      // 3. Le contenu est proposé à l'équipe, avec un extrait, sa ville, et aucune trace d'auteur.
      const avec = adminImpactCandidatesSchema.parse((await get(content.cookie, '/impact/testimonials?quarter=2024-T1').expect(200)).body);
      const candidat = avec.items.find((i) => i.sourceId === tipId);
      expect(candidat).toMatchObject({ kind: 'CITY_TIP', cityName, quote: null });
      expect(candidat?.excerpt).toContain('Croix-Rousse');
      expect(JSON.stringify(avec)).not.toContain(auteur.id);
      await get(support.cookie, '/impact/testimonials?quarter=2024-T1').expect(403);

      // 4. L'équipe approuve un extrait ; bornes, rôle, audit.
      await request(srv(app)).put('/v1/admin/impact/quotes').set('cookie', content.cookie).send({ quarter: '2024-T1', kind: 'CITY_TIP', sourceId: tipId, quote: 'trop court' }).expect(400);
      await request(srv(app)).put('/v1/admin/impact/quotes').set('cookie', content.cookie).send({ quarter: '2024-T1', kind: 'CITY_TIP', sourceId: tipId, quote: 'x'.repeat(301) }).expect(400);
      await request(srv(app)).put('/v1/admin/impact/quotes').set('cookie', support.cookie).send({ quarter: '2024-T1', kind: 'CITY_TIP', sourceId: tipId, quote }).expect(403);
      await request(srv(app)).put('/v1/admin/impact/quotes').set('cookie', content.cookie).send({ quarter: '2024-T1', kind: 'CITY_TIP', sourceId: newId(), quote }).expect(404);
      const approuve = await request(srv(app)).put('/v1/admin/impact/quotes').set('cookie', content.cookie).send({ quarter: '2024-T1', kind: 'CITY_TIP', sourceId: tipId, quote }).expect(200);
      expect(await prisma.auditLog.count({ where: { action: 'impact.quote_approved', targetId: approuve.body.id } })).toBe(1);

      // 5. Elle s'affiche dans le rapport du trimestre — et dans le CSV — avec le TYPE et la VILLE, sans auteur.
      const rapport = adminImpactReportSchema.parse((await get(support.cookie, '/impact?quarter=2024-T1').expect(200)).body);
      expect(rapport.temoignages).toEqual([{ id: approuve.body.id, quote, kind: 'CITY_TIP', cityName }]);
      expect(JSON.stringify(rapport)).not.toContain(auteur.id);
      const csv = (await get(support.cookie, '/impact/export?quarter=2024-T1').expect(200)).text;
      expect(csv).toContain(`"temoignage.conseil_de_ville","${cityName}","${quote}"`);
      // Un autre trimestre ne la montre pas.
      expect((await get(support.cookie, '/impact?quarter=2024-T2').expect(200)).body.temoignages).toEqual([]);

      // 6. L'auteur retire son accord : la citation disparaît du rapport AU PROCHAIN AFFICHAGE.
      await request(srv(app)).put(`/v1/tips/${tipId}/quotable`).set(auteur.auth).send({ quotable: false }).expect(200);
      expect((await get(support.cookie, '/impact?quarter=2024-T1').expect(200)).body.temoignages).toEqual([]);
      expect((await get(support.cookie, '/impact/export?quarter=2024-T1').expect(200)).text).not.toContain('temoignage.');
      const retire = adminImpactCandidatesSchema.parse((await get(content.cookie, '/impact/testimonials?quarter=2024-T1').expect(200)).body);
      expect(retire.items.find((i) => i.sourceId === tipId)).toBeUndefined();

      // 7. L'accord redonné, la citation approuvée revient ; l'équipe peut la retirer à son tour.
      await request(srv(app)).put(`/v1/tips/${tipId}/quotable`).set(auteur.auth).send({ quotable: true }).expect(200);
      expect((await get(support.cookie, '/impact?quarter=2024-T1').expect(200)).body.temoignages).toHaveLength(1);
      await request(srv(app)).delete(`/v1/admin/impact/quotes/${approuve.body.id}`).set('cookie', support.cookie).expect(403);
      await request(srv(app)).delete(`/v1/admin/impact/quotes/${approuve.body.id}`).set('cookie', content.cookie).expect(200);
      expect((await get(support.cookie, '/impact?quarter=2024-T1').expect(200)).body.temoignages).toEqual([]);
      await request(srv(app)).delete(`/v1/admin/impact/quotes/${approuve.body.id}`).set('cookie', content.cookie).expect(404);
      expect(await prisma.auditLog.count({ where: { action: 'impact.quote_withdrawn', targetId: approuve.body.id } })).toBe(1);

      // 8. Une citation retirée peut être approuvée de nouveau (même ligne, remise en service).
      const reapprouve = await request(srv(app)).put('/v1/admin/impact/quotes').set('cookie', content.cookie).send({ quarter: '2024-T1', kind: 'CITY_TIP', sourceId: tipId, quote }).expect(200);
      expect(reapprouve.body.id).toBe(approuve.body.id);
      expect((await get(support.cookie, '/impact?quarter=2024-T1').expect(200)).body.temoignages).toHaveLength(1);
    });

    it('un contenu masqué ou supprimé n’est plus cité ; un guide se cite comme une contribution', async () => {
      const content = await as('CONTENT_ADMIN');
      const auteur = await member();
      const quote = 'Un guide qui m’a fait gagner trois semaines de démarches.';

      const guideId = newId();
      await prisma.guide.create({
        data: {
          id: guideId, authorUserId: auteur.id, title: `Guide cité ${run}`, slug: `guide-cite-${run}`, category: 'ARRIVAL', scope: 'UNIVERSAL',
          cityId, status: 'PUBLISHED', lastContentUpdateAt: new Date(),
        },
      });
      guideIds.push(guideId);
      await request(srv(app)).put(`/v1/guides/${guideId}/quotable`).set(auteur.auth).send({ quotable: true }).expect(200);
      const autre = await member();
      await request(srv(app)).put(`/v1/guides/${guideId}/quotable`).set(autre.auth).send({ quotable: true }).expect(404);

      const liste = adminImpactCandidatesSchema.parse((await get(content.cookie, '/impact/testimonials?quarter=2024-T2').expect(200)).body);
      expect(liste.items.find((i) => i.sourceId === guideId)).toMatchObject({ kind: 'GUIDE', title: `Guide cité ${run}`, cityName });
      await request(srv(app)).put('/v1/admin/impact/quotes').set('cookie', content.cookie).send({ quarter: '2024-T2', kind: 'GUIDE', sourceId: guideId, quote }).expect(200);
      expect((await get(content.cookie, '/impact?quarter=2024-T2').expect(200)).body.temoignages).toMatchObject([{ kind: 'GUIDE', quote }]);

      // Le guide est dépublié : l'accord ne couvre plus un contenu qui n'est plus en ligne.
      await prisma.guide.update({ where: { id: guideId }, data: { status: 'UNPUBLISHED' } });
      expect((await get(content.cookie, '/impact?quarter=2024-T2').expect(200)).body.temoignages).toEqual([]);
      await prisma.guide.update({ where: { id: guideId }, data: { status: 'PUBLISHED' } });
      expect((await get(content.cookie, '/impact?quarter=2024-T2').expect(200)).body.temoignages).toHaveLength(1);

      // Suppression du contenu : la citation part avec lui (cascade).
      await prisma.guide.delete({ where: { id: guideId } });
      expect(await prisma.impactQuote.count({ where: { guideId } })).toBe(0);
    });
  });

  // ══ Ce que la table d’historique ne fait jamais ══════════════════════════

  it('RÈGLE : aucun chemin de code n’écrase ni ne supprime un instantané du rapport', async () => {
    const { readFileSync, readdirSync } = await import('node:fs');
    const { join } = await import('node:path');
    const dir = join(__dirname, '..');
    const source = readdirSync(dir).filter((f) => f.endsWith('.ts')).map((f) => readFileSync(join(dir, f), 'utf8')).join('\n');
    expect(source).not.toMatch(/impactReportSnapshot\.(update|updateMany|upsert|delete|deleteMany)\(/);
    expect(source).not.toMatch(/DELETE\s+FROM\s+impact_report_snapshots|UPDATE\s+impact_report_snapshots/i);
  });
});
