/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any -- le corps des réponses HTTP est lu tel quel : le typer champ par champ doublerait chaque test sans rien prouver de plus. */
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
import { FeatureFlagService } from '../../../common/feature-flag.service';
import { PrismaService } from '../../../common/prisma.service';
import { TokenService } from '../../../common/token.service';
import { hashStaffPassword } from '../staff-password';
import { generateTotpSecret } from '../totp';

/**
 * Administration — contenu (pages, annonces, drapeaux), fiche membre (note,
 * suppression immédiate, export), migrations, export d'impact, modèles de parcours,
 * guides et alertes arnaques, côté équipe. Lot « administration et contenu légal ».
 *
 * Les routes sont appelées par HTTP : le garde de rôle fait partie de ce qu'on livre.
 */

interface Body {
  [k: string]: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}
const srv = (app: INestApplication): Server => app.getHttpServer() as Server;

describe('administration — contenu et modèles', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let crypto: CryptoService;
  let tokens: TokenService;
  const staffIds: string[] = [];
  const userIds: string[] = [];
  const pageIds: string[] = [];
  const run = Math.random().toString(36).slice(2, 8);
  let n = 0;
  let originCountryId: string;
  let cityId: string;
  let originalCgu: { version: string; body: string; title: string; publishedAt: Date | null };

  async function as(role: StaffRoleValue): Promise<{ cookie: string; staffId: string }> {
    n += 1;
    const staffId = newId();
    await prisma.staffUser.create({
      data: {
        id: staffId,
        email: `content-${run}-${n}@equipe.test`,
        displayName: `Équipe ${role} ${n}`,
        passwordHash: await hashStaffPassword('un-mot-de-passe-equipe-suffisamment-long'),
        totpSecretEncrypted: crypto.encryptContent(generateTotpSecret()),
        role,
        isActive: true,
      },
    });
    staffIds.push(staffId);
    const token = `c-${run}-${newId()}`;
    await prisma.staffSession.create({
      data: {
        id: newId(),
        staffId,
        tokenHash: crypto.hashToken(token),
        expiresAt: new Date(Date.now() + STAFF_IDLE_MINUTES * 60_000),
      },
    });
    return { cookie: `${STAFF_SESSION_COOKIE}=${token}`, staffId };
  }

  async function member(over: { cityId?: string | null; phase?: 'SETTLED' | 'PRE_DEPARTURE' } = {}) {
    n += 1;
    const id = newId();
    await prisma.user.create({
      data: {
        id,
        handle: `ct${run}${n}${id.slice(-5)}`,
        displayName: `Membre ${n}`,
        phase: over.phase ?? 'SETTLED',
        verificationLevel: 'L2',
        originCountryId,
        cityId: over.cityId === undefined ? cityId : over.cityId,
        plan: 'FREE',
        status: 'ACTIVE',
      },
    });
    userIds.push(id);
    const token = tokens.sign({
      sub: id,
      sid: newId(),
      level: 'L2',
      plan: 'FREE',
      status: 'ACTIVE',
      exp: Math.floor(Date.now() / 1000) + 900,
    });
    return { id, token };
  }

  const audit = (action: string, targetId: string) =>
    prisma.auditLog.findMany({ where: { action, targetId } });

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
    originCountryId = (await prisma.country.findFirstOrThrow({ where: { isActive: true, kind: { in: ['ORIGIN', 'BOTH'] } } })).id;
    cityId = (await prisma.city.findFirstOrThrow({ orderBy: { slug: 'asc' } })).id;
    const cgu = await prisma.staticPage.findUniqueOrThrow({ where: { slug: 'cgu' } });
    originalCgu = { version: cgu.version, body: cgu.body, title: cgu.title, publishedAt: cgu.publishedAt };
  });

  afterAll(async () => {
    await prisma.staticPage.update({ where: { slug: 'cgu' }, data: originalCgu });
    await prisma.staticPageVersion.deleteMany({ where: { page: { slug: 'cgu' }, version: { gt: Number(originalCgu.version) } } });
    await prisma.staticPage.deleteMany({ where: { id: { in: pageIds } } });
    await prisma.announcement.deleteMany({ where: { createdByStaffId: { in: staffIds } } });
    await prisma.featureFlag.deleteMany({ where: { key: { startsWith: `t.${run}` } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    /**
     * VAGUE 6 — LES MODÈLES DE PARCOURS QUE CE FICHIER CRÉE (« Essai » `T…`, « Cycle » `C…`)
     * restaient dans la base de dev à chaque lancement. Les parcours qui les référencent
     * partent avec leurs membres (ci-dessus), les versions et leurs étapes en cascade. Le
     * filtre porte sur le code de CE lancement (`run`), jamais sur un nom : un modèle réel
     * ne s'appelle pas `T`/`C` suivi de notre horodatage.
     */
    await prisma.journeyTemplate.deleteMany({
      where: { code: { in: [`T${run.toUpperCase()}`, `C${run.toUpperCase()}`] } },
    });
    for (const id of staffIds) {
      try {
        await prisma.staffUser.delete({ where: { id } });
      } catch {
        await prisma.staffUser.update({ where: { id }, data: { isActive: false } });
      }
    }
    await app?.close();
  });

  // ══ Pages ════════════════════════════════════════════════════════════════

  describe('pages statiques (15 §4.1)', () => {
    it('GET /pages/:slug est public et rend la version en vigueur', async () => {
      const res = await request(srv(app)).get('/v1/pages/cgu').expect(200);
      const b = res.body as Body;
      expect(b.slug).toBe('cgu');
      expect(typeof b.version).toBe('string');
      expect(b.body.length).toBeGreaterThan(10);
      await request(srv(app)).get('/v1/pages/inconnue-xyz').expect(404);
    });

    it('une page jamais publiée n’est pas servie ; publier la sert et la versionne', async () => {
      const staff = await as('CONTENT_ADMIN');
      const slug = `essai-${run}`;
      const created = await request(srv(app))
        .post('/v1/admin/pages')
        .set('cookie', staff.cookie)
        .send({ slug, title: 'Essai', body: '## 1. Début\n\nTexte.' })
        .expect(201);
      const id = (created.body as Body).id as string;
      pageIds.push(id);
      expect((created.body as Body).draft.version).toBe(1);
      await request(srv(app)).get(`/v1/pages/${slug}`).expect(404);

      await request(srv(app))
        .put(`/v1/admin/pages/${id}`)
        .set('cookie', staff.cookie)
        .send({ title: 'Essai v1', body: '## 1. Début\n\nTexte corrigé.' })
        .expect(200);
      const pub = await request(srv(app)).post(`/v1/admin/pages/${id}/publish`).set('cookie', staff.cookie).expect(200);
      expect((pub.body as Body).liveVersion).toBe('1');
      const live = await request(srv(app)).get(`/v1/pages/${slug}`).expect(200);
      expect((live.body as Body).title).toBe('Essai v1');
      expect((live.body as Body).version).toBe('1');

      // Pas de second brouillon : publier de nouveau est refusé.
      const again = await request(srv(app)).post(`/v1/admin/pages/${id}/publish`).set('cookie', staff.cookie).expect(409);
      expect((again.body as Body).error.code).toBe('PAGE_NO_DRAFT');
      // Une page publiée ne se supprime pas.
      await request(srv(app)).delete(`/v1/admin/pages/${id}`).set('cookie', staff.cookie).expect(409);
      expect((await audit('page.published', id)).length).toBe(1);
    });

    it('un slug pris est refusé, et un MODÉRATEUR ne peut pas écrire', async () => {
      const staff = await as('CONTENT_ADMIN');
      const moderator = await as('MODERATOR');
      const res = await request(srv(app))
        .post('/v1/admin/pages')
        .set('cookie', staff.cookie)
        .send({ slug: 'cgu', title: 'x', body: 'y' })
        .expect(409);
      expect((res.body as Body).error.code).toBe('PAGE_SLUG_TAKEN');
      await request(srv(app))
        .post('/v1/admin/pages')
        .set('cookie', moderator.cookie)
        .send({ slug: `m-${run}`, title: 'x', body: 'y' })
        .expect(403);
      await request(srv(app)).get('/v1/admin/pages').set('cookie', moderator.cookie).expect(200);
    });

    it('publier une nouvelle version des CGU redemande le consentement (outdated)', async () => {
      const staff = await as('CONTENT_ADMIN');
      const m = await member();
      const consents = await request(srv(app))
        .post('/v1/me/consents')
        .set('authorization', `Bearer ${m.token}`)
        .send({ type: 'TERMS', granted: true, version: originalCgu.version })
        .expect(201);
      expect(consents.body).toEqual({ recorded: true });
      let state = await request(srv(app)).get('/v1/me/consents').set('authorization', `Bearer ${m.token}`).expect(200);
      expect((state.body as Body).outstanding).not.toContain('TERMS');

      const cgu = await prisma.staticPage.findUniqueOrThrow({ where: { slug: 'cgu' } });
      await request(srv(app))
        .put(`/v1/admin/pages/${cgu.id}`)
        .set('cookie', staff.cookie)
        .send({ title: cgu.title, body: `${cgu.body}\n\nAjout.` })
        .expect(200);
      const pub = await request(srv(app)).post(`/v1/admin/pages/${cgu.id}/publish`).set('cookie', staff.cookie).expect(200);
      expect((pub.body as Body).asksConsent).toBe(true);

      state = await request(srv(app)).get('/v1/me/consents').set('authorization', `Bearer ${m.token}`).expect(200);
      expect((state.body as Body).outstanding).toContain('TERMS');
    });
  });

  // ══ Annonces ═════════════════════════════════════════════════════════════

  describe('annonces (15 §4.2)', () => {
    it('CRUD, journal, et la plus récente CIBLÉE est servie au membre', async () => {
      const staff = await as('CONTENT_ADMIN');
      const inCity = await member();
      const elsewhere = await member({ cityId: null });
      const past = new Date(Date.now() - 3_600_000).toISOString();

      const global = await request(srv(app))
        .post('/v1/admin/announcements')
        .set('cookie', staff.cookie)
        .send({ title: 'Pour tous', body: 'Texte global', startsAt: new Date(Date.now() - 7_200_000).toISOString() })
        .expect(201);
      const targeted = await request(srv(app))
        .post('/v1/admin/announcements')
        .set('cookie', staff.cookie)
        .send({ title: 'Ville', body: 'Texte ville', target: { cityIds: [cityId] }, startsAt: past })
        .expect(201);
      expect((await audit('announcement.created', (targeted.body as Body).id)).length).toBe(1);

      const a = await request(srv(app)).get('/v1/announcements/active').set('authorization', `Bearer ${inCity.token}`).expect(200);
      expect((a.body as Body).announcement.title).toBe('Ville');
      const b = await request(srv(app)).get('/v1/announcements/active').set('authorization', `Bearer ${elsewhere.token}`).expect(200);
      expect((b.body as Body).announcement.title).toBe('Pour tous');

      // Terminée : plus servie.
      await request(srv(app))
        .put(`/v1/admin/announcements/${(targeted.body as Body).id}`)
        .set('cookie', staff.cookie)
        .send({ title: 'Ville', body: 'Texte ville', target: { cityIds: [cityId] }, startsAt: new Date(Date.now() - 7_200_000).toISOString(), endsAt: new Date(Date.now() - 1000).toISOString() })
        .expect(200);
      const c = await request(srv(app)).get('/v1/announcements/active').set('authorization', `Bearer ${inCity.token}`).expect(200);
      expect((c.body as Body).announcement.title).toBe('Pour tous');

      const list = await request(srv(app)).get('/v1/admin/announcements?state=ended').set('cookie', staff.cookie).expect(200);
      expect((list.body as Body).items.map((x: Body) => x.id)).toContain((targeted.body as Body).id);
      await request(srv(app)).delete(`/v1/admin/announcements/${(global.body as Body).id}`).set('cookie', staff.cookie).expect(200);
      await request(srv(app)).delete(`/v1/admin/announcements/${(targeted.body as Body).id}`).set('cookie', staff.cookie).expect(200);
    });

    it('une fin avant le début est refusée ; le support ne peut pas écrire', async () => {
      const staff = await as('CONTENT_ADMIN');
      const support = await as('SUPPORT');
      await request(srv(app))
        .post('/v1/admin/announcements')
        .set('cookie', staff.cookie)
        .send({ title: 'x', body: 'y', startsAt: '2026-10-10T10:00:00Z', endsAt: '2026-10-09T10:00:00Z' })
        .expect(400);
      await request(srv(app))
        .post('/v1/admin/announcements')
        .set('cookie', support.cookie)
        .send({ title: 'x', body: 'y', startsAt: '2026-10-10T10:00:00Z' })
        .expect(403);
    });
  });

  // ══ Drapeaux ═════════════════════════════════════════════════════════════

  describe('feature flags (15 §4.3)', () => {
    it('SUPER_ADMIN seul écrit ; le membre reçoit l’état évalué', async () => {
      const root = await as('SUPER_ADMIN');
      const content = await as('CONTENT_ADMIN');
      const key = `t.${run}.section`;
      await request(srv(app)).post('/v1/admin/flags').set('cookie', content.cookie).send({ key, isEnabled: true }).expect(403);
      const created = await request(srv(app))
        .post('/v1/admin/flags')
        .set('cookie', root.cookie)
        .send({ key, isEnabled: true, rolloutPct: 100, conditions: { cityIds: [cityId] } })
        .expect(201);
      const dup = await request(srv(app)).post('/v1/admin/flags').set('cookie', root.cookie).send({ key, isEnabled: true }).expect(409);
      expect((dup.body as Body).error.code).toBe('FLAG_KEY_TAKEN');
      app.get(FeatureFlagService).invalidate();

      const inCity = await member();
      const elsewhere = await member({ cityId: null });
      const f1 = await request(srv(app)).get('/v1/me/flags').set('authorization', `Bearer ${inCity.token}`).expect(200);
      const f2 = await request(srv(app)).get('/v1/me/flags').set('authorization', `Bearer ${elsewhere.token}`).expect(200);
      expect((f1.body as Body).flags[key]).toBe(true);
      expect((f2.body as Body).flags[key]).toBe(false);

      await request(srv(app)).patch(`/v1/admin/flags/${(created.body as Body).id}`).set('cookie', root.cookie).send({ isEnabled: false }).expect(200);
      const f3 = await request(srv(app)).get('/v1/me/flags').set('authorization', `Bearer ${inCity.token}`).expect(200);
      expect((f3.body as Body).flags[key]).toBe(false);
      expect((await audit('flag.changed', (created.body as Body).id)).length).toBe(1);
      await request(srv(app)).delete(`/v1/admin/flags/${(created.body as Body).id}`).set('cookie', root.cookie).expect(200);
    });
  });

  // ══ Fiche membre ═════════════════════════════════════════════════════════

  describe('actions sur un membre (15 §3.2)', () => {
    it('note interne : tous les rôles, visible dans la fiche, contenu hors journal', async () => {
      const mod = await as('MODERATOR');
      const m = await member();
      const note = await request(srv(app))
        .post(`/v1/admin/users/${m.id}/note`)
        .set('cookie', mod.cookie)
        .send({ body: 'Déjà averti pour vente d’attestations.' })
        .expect(201);
      const rows = await audit('user.note_added', m.id);
      expect(rows.length).toBe(1);
      expect(JSON.stringify(rows[0]?.metadata)).not.toContain('averti');
      const detail = await request(srv(app)).get(`/v1/admin/users/${m.id}`).set('cookie', mod.cookie).expect(200);
      expect((detail.body as Body).notes[0].body).toContain('averti');
      expect((note.body as Body).author.displayName).toContain('MODERATOR');
    });

    it('export : SUPPORT, sans quota ; un modérateur est refusé', async () => {
      const support = await as('SUPPORT');
      const mod = await as('MODERATOR');
      const m = await member();
      const reason = 'Demande écrite du membre le 12 octobre.';
      await request(srv(app)).post(`/v1/admin/users/${m.id}/export`).set('cookie', mod.cookie).send({ reason }).expect(403);
      await request(srv(app)).post(`/v1/admin/users/${m.id}/export`).set('cookie', support.cookie).send({ reason }).expect(202);
      await request(srv(app)).post(`/v1/admin/users/${m.id}/export`).set('cookie', support.cookie).send({ reason }).expect(202);
      expect(await prisma.dataExport.count({ where: { userId: m.id } })).toBe(2);
      expect((await audit('user.exported', m.id)).length).toBe(2);
    });

    it('suppression immédiate : exige le pseudo, anonymise, supprime les notes', async () => {
      const support = await as('SUPPORT');
      const m = await member();
      const handle = (await prisma.user.findUniqueOrThrow({ where: { id: m.id } })).handle;
      await request(srv(app)).post(`/v1/admin/users/${m.id}/note`).set('cookie', support.cookie).send({ body: 'note' }).expect(201);
      const reason = 'Demande écrite du membre reçue par courrier.';
      const bad = await request(srv(app))
        .post(`/v1/admin/users/${m.id}/delete-now`)
        .set('cookie', support.cookie)
        .send({ reason, confirmHandle: 'autre' })
        .expect(422);
      expect((bad.body as Body).error.code).toBe('MEMBER_DELETE_CONFIRMATION');
      await request(srv(app))
        .post(`/v1/admin/users/${m.id}/delete-now`)
        .set('cookie', support.cookie)
        .send({ reason, confirmHandle: handle })
        .expect(200);
      const after = await prisma.user.findUniqueOrThrow({ where: { id: m.id } });
      expect(after.displayName).toBe('Membre supprimé');
      expect(await prisma.memberNote.count({ where: { userId: m.id } })).toBe(0);
      expect((await audit('user.deleted_now', m.id)).length).toBe(1);
      // Le membre supprimé n'est plus une cible.
      await request(srv(app)).post(`/v1/admin/users/${m.id}/note`).set('cookie', support.cookie).send({ body: 'x' }).expect(404);
    });
  });

  // ══ Pilotage ═════════════════════════════════════════════════════════════

  describe('pilotage (15 §5)', () => {
    it('stats/migrations et impact/export répondent, et l’export est tracé', async () => {
      const mod = await as('MODERATOR');
      const mig = await request(srv(app)).get('/v1/admin/stats/migrations').set('cookie', mod.cookie).expect(200);
      expect(Array.isArray((mig.body as Body).items)).toBe(true);
      const csv = await request(srv(app)).get('/v1/admin/impact/export?quarter=2026-Q3').set('cookie', mod.cookie).expect(200);
      expect(csv.headers['content-type']).toContain('text/csv');
      expect(csv.text).toContain('trimestre');
      const rows = await prisma.auditLog.count({ where: { action: 'impact.exported', actorId: mod.staffId } });
      expect(rows).toBe(1);
    });

    it('un parcours resté sur une version archivée est compté', async () => {
      const staff = await as('CONTENT_ADMIN');
      const code = `T${run.toUpperCase()}`;
      const tpl = await request(srv(app))
        .post('/v1/admin/journey-templates/templates')
        .set('cookie', staff.cookie)
        .send({ code, nameFr: 'Essai', targetPhase: 'SETTLED' })
        .expect(201);
      const def = await prisma.stepDefinition.findFirstOrThrow();
      const v1 = await request(srv(app)).post(`/v1/admin/journey-templates/templates/${(tpl.body as Body).id}/versions`).set('cookie', staff.cookie).send({ copyPublished: false }).expect(201);
      await request(srv(app)).put(`/v1/admin/journey-templates/versions/${(v1.body as Body).id}/steps`).set('cookie', staff.cookie).send({ steps: [{ stepDefinitionId: def.id }] }).expect(200);
      await request(srv(app)).post(`/v1/admin/journey-templates/versions/${(v1.body as Body).id}/publish`).set('cookie', staff.cookie).send({}).expect(200);
      const owner = await member();
      const journeyId = newId();
      await prisma.journey.create({
        data: {
          id: journeyId,
          ownerUserId: owner.id,
          templateVersionId: (v1.body as Body).id,
          title: 'Mon parcours',
          status: 'ACTIVE',
          originCountryId,
          destinationCityId: cityId,
          lastActivityAt: new Date(),
        } as never,
      });
      const v2 = await request(srv(app)).post(`/v1/admin/journey-templates/templates/${(tpl.body as Body).id}/versions`).set('cookie', staff.cookie).send({}).expect(201);
      expect((v2.body as Body).steps).toHaveLength(1);
      const pub = await request(srv(app)).post(`/v1/admin/journey-templates/versions/${(v2.body as Body).id}/publish`).set('cookie', staff.cookie).send({ changelog: 'Une étape de plus.' }).expect(200);
      expect((pub.body as Body).journeysStaying).toBe(1);
      const mig = await request(srv(app)).get('/v1/admin/stats/migrations').set('cookie', staff.cookie).expect(200);
      const line = (mig.body as Body).items.find((i: Body) => i.templateCode === code);
      expect(line.journeys).toBe(1);
      expect(line.currentVersion).toBe(2);
      // RÈGLE DURE 03 §2.2 : publier ne modifie jamais un parcours existant.
      const j = await prisma.journey.findUniqueOrThrow({ where: { id: journeyId } });
      expect(j.templateVersionId).toBe((v1.body as Body).id);
      await prisma.journey.delete({ where: { id: journeyId } });
    });
  });

  // ══ Modèles de parcours ══════════════════════════════════════════════════

  describe('modèles de parcours (03 §5.2)', () => {
    it('refuse une version vide, un cycle, une dépendance invalide ; une seule publiée', async () => {
      const staff = await as('CONTENT_ADMIN');
      const code = `C${run.toUpperCase()}`;
      const tpl = await request(srv(app)).post('/v1/admin/journey-templates/templates').set('cookie', staff.cookie).send({ code, nameFr: 'Cycle', targetPhase: 'SETTLED' }).expect(201);
      const dup = await request(srv(app)).post('/v1/admin/journey-templates/templates').set('cookie', staff.cookie).send({ code, nameFr: 'Cycle', targetPhase: 'SETTLED' }).expect(409);
      expect((dup.body as Body).error.code).toBe('TEMPLATE_CODE_TAKEN');
      const tid = (tpl.body as Body).id as string;
      const v = await request(srv(app)).post(`/v1/admin/journey-templates/templates/${tid}/versions`).set('cookie', staff.cookie).send({ copyPublished: false }).expect(201);
      const vid = (v.body as Body).id as string;
      const taken = await request(srv(app)).post(`/v1/admin/journey-templates/templates/${tid}/versions`).set('cookie', staff.cookie).send({}).expect(409);
      expect((taken.body as Body).error.code).toBe('VERSION_SLOT_TAKEN');

      const empty = await request(srv(app)).post(`/v1/admin/journey-templates/versions/${vid}/publish`).set('cookie', staff.cookie).send({}).expect(422);
      expect((empty.body as Body).error.code).toBe('VERSION_EMPTY');

      const defs = await prisma.stepDefinition.findMany({ take: 3 });
      const steps = defs.map((d) => ({ stepDefinitionId: d.id, daysBeforeArrival: 30 }));
      const cyc = await request(srv(app))
        .put(`/v1/admin/journey-templates/versions/${vid}/steps`)
        .set('cookie', staff.cookie)
        .send({ steps, dependencies: [{ step: 0, dependsOn: 1 }, { step: 1, dependsOn: 2 }, { step: 2, dependsOn: 0 }] })
        .expect(422);
      expect((cyc.body as Body).error.code).toBe('VERSION_CYCLE');
      const bad = await request(srv(app)).put(`/v1/admin/journey-templates/versions/${vid}/steps`).set('cookie', staff.cookie).send({ steps, dependencies: [{ step: 0, dependsOn: 9 }] }).expect(422);
      expect((bad.body as Body).error.code).toBe('VERSION_DEPENDENCY_INVALID');

      await request(srv(app)).put(`/v1/admin/journey-templates/versions/${vid}/steps`).set('cookie', staff.cookie).send({ steps, dependencies: [{ step: 2, dependsOn: 1 }] }).expect(200);
      const prev = await request(srv(app)).get(`/v1/admin/journey-templates/versions/${vid}/preview`).set('cookie', staff.cookie).expect(200);
      expect((prev.body as Body).steps[2].dependsOn).toEqual([2]);
      await request(srv(app)).post(`/v1/admin/journey-templates/versions/${vid}/publish`).set('cookie', staff.cookie).send({}).expect(200);
      // Une version publiée est figée.
      const frozen = await request(srv(app)).put(`/v1/admin/journey-templates/versions/${vid}/steps`).set('cookie', staff.cookie).send({ steps }).expect(409);
      expect((frozen.body as Body).error.code).toBe('VERSION_NOT_DRAFT');
      expect((await audit('template.publish', vid)).length).toBe(1);
    });

    it('traite une correction proposée : accepter, ou rejeter avec motif', async () => {
      const staff = await as('CONTENT_ADMIN');
      const m = await member();
      const version = await prisma.journeyTemplateVersion.findFirstOrThrow({ where: { status: 'PUBLISHED' } });
      const mk = async () => {
        const id = newId();
        await prisma.templateCorrectionProposal.create({
          data: { id, templateVersionId: version.id, userId: m.id, message: 'Le délai est faux.', status: 'PENDING' },
        });
        return id;
      };
      const a = await mk();
      const b = await mk();
      const q = await request(srv(app)).get('/v1/admin/journey-templates/correction-proposals').set('cookie', staff.cookie).expect(200);
      expect((q.body as Body).items.map((x: Body) => x.id)).toContain(a);
      // Le membre auteur n'est pas nommé.
      expect(JSON.stringify(q.body)).not.toContain(m.id);
      await request(srv(app)).post(`/v1/admin/journey-templates/correction-proposals/${a}`).set('cookie', staff.cookie).send({ decision: 'ACCEPT' }).expect(200);
      await request(srv(app)).post(`/v1/admin/journey-templates/correction-proposals/${b}`).set('cookie', staff.cookie).send({ decision: 'REJECT', reason: 'court' }).expect(400);
      await request(srv(app)).post(`/v1/admin/journey-templates/correction-proposals/${b}`).set('cookie', staff.cookie).send({ decision: 'REJECT', reason: 'Le délai indiqué est correct.' }).expect(200);
      const again = await request(srv(app)).post(`/v1/admin/journey-templates/correction-proposals/${a}`).set('cookie', staff.cookie).send({ decision: 'ACCEPT' }).expect(409);
      expect((again.body as Body).error.code).toBe('CORRECTION_ALREADY_DECIDED');
      await prisma.templateCorrectionProposal.deleteMany({ where: { id: { in: [a, b] } } });
    });
  });

  // ══ Guides ═══════════════════════════════════════════════════════════════

  describe('guides côté équipe (05 §4)', () => {
    it('force un statut avec motif, bascule « maintenu par la communauté », compte les onglets', async () => {
      const staff = await as('CONTENT_ADMIN');
      const mod = await as('MODERATOR');
      const author = await member();
      const guideId = newId();
      const versionId = newId();
      await prisma.guide.create({
        data: {
          id: guideId,
          authorUserId: author.id,
          title: `Guide ${run}`,
          slug: `guide-${run}`,
          category: 'ARRIVAL',
          scope: 'UNIVERSAL',
          status: 'PUBLISHED',
          lastContentUpdateAt: new Date(),
        },
      });
      await prisma.guideVersion.create({ data: { id: versionId, guideId, version: 1, body: 'Corps' } as never });
      await prisma.guide.update({ where: { id: guideId }, data: { currentVersionId: versionId } });

      const list = await request(srv(app)).get('/v1/admin/guides?status=PUBLISHED').set('cookie', mod.cookie).expect(200);
      expect((list.body as Body).items.map((g: Body) => g.id)).toContain(guideId);
      await request(srv(app)).post(`/v1/admin/guides/${guideId}/status`).set('cookie', mod.cookie).send({ status: 'FLAGGED', reason: 'Information périmée signalée.' }).expect(403);
      await request(srv(app)).post(`/v1/admin/guides/${guideId}/status`).set('cookie', staff.cookie).send({ status: 'FLAGGED', reason: 'court' }).expect(400);
      await request(srv(app)).post(`/v1/admin/guides/${guideId}/status`).set('cookie', staff.cookie).send({ status: 'FLAGGED', reason: 'Information périmée signalée.' }).expect(200);
      const counts = await request(srv(app)).get('/v1/admin/guides/counts').set('cookie', staff.cookie).expect(200);
      expect((counts.body as Body).flagged).toBeGreaterThanOrEqual(1);
      await request(srv(app)).post(`/v1/admin/guides/${guideId}/status`).set('cookie', staff.cookie).send({ status: 'PUBLISHED', reason: 'Vérifié par l’équipe.' }).expect(200);
      await request(srv(app)).put(`/v1/admin/guides/${guideId}/maintained`).set('cookie', staff.cookie).send({ maintainedByCommunity: true }).expect(200);
      expect((await prisma.guide.findUniqueOrThrow({ where: { id: guideId } })).maintainedByCommunity).toBe(true);
      expect((await audit('guide.status_forced', guideId)).length).toBe(2);
      await prisma.guide.update({ where: { id: guideId }, data: { currentVersionId: null } });
      await prisma.guide.delete({ where: { id: guideId } });
    });

    it('une proposition escaladée est tranchée par l’équipe ; une proposition non escaladée est refusée', async () => {
      const staff = await as('CONTENT_ADMIN');
      const author = await member();
      const proposer = await member();
      const guideId = newId();
      const versionId = newId();
      await prisma.guide.create({
        data: { id: guideId, authorUserId: author.id, title: `G ${run}`, slug: `g-${run}`, category: 'ARRIVAL', scope: 'UNIVERSAL', status: 'PUBLISHED', lastContentUpdateAt: new Date() },
      });
      await prisma.guideVersion.create({ data: { id: versionId, guideId, version: 1, body: 'dès l’obtention du visa' } as never });
      await prisma.guide.update({ where: { id: guideId }, data: { currentVersionId: versionId } });
      const mk = (status: 'ESCALATED' | 'PENDING') => {
        const id = newId();
        return prisma.guideRevisionProposal
          .create({
            data: {
              id,
              guideId,
              proposerUserId: proposer.id,
              baseVersionId: versionId,
              targetExcerpt: 'obtention',
              replacement: 'validation',
              reason: 'Le texte officiel parle de validation.',
              status,
              escalateAt: new Date(Date.now() - 86_400_000),
            },
          })
          .then(() => id);
      };
      const pending = await mk('PENDING');
      const notEsc = await request(srv(app)).post(`/v1/admin/guides/proposals/${pending}/decide`).set('cookie', staff.cookie).send({ decision: 'ACCEPT' }).expect(409);
      expect((notEsc.body as Body).error.code).toBe('GUIDE_NOT_ESCALATED');
      const esc = await mk('ESCALATED');
      const list = await request(srv(app)).get('/v1/admin/guides/proposals/escalated').set('cookie', staff.cookie).expect(200);
      expect((list.body as Body).items.find((p: Body) => p.id === esc).after).toBe('validation');
      await request(srv(app)).post(`/v1/admin/guides/proposals/${esc}/decide`).set('cookie', staff.cookie).send({ decision: 'REJECT', reason: 'Source non vérifiable.' }).expect(200);
      const row = await prisma.guideRevisionProposal.findUniqueOrThrow({ where: { id: esc } });
      expect(row.status).toBe('REJECTED');
      expect(row.reviewerStaffId).toBe(staff.staffId);
      expect(row.reviewerUserId).toBeNull();
      await prisma.guide.update({ where: { id: guideId }, data: { currentVersionId: null } });
      await prisma.guide.delete({ where: { id: guideId } });
    });
  });

  // ══ Alertes arnaques ═════════════════════════════════════════════════════

  describe('alertes arnaques côté équipe (13 §5)', () => {
    it('la lecture équipe rend aussi les alertes non publiées, avec leur état', async () => {
      const staff = await as('CONTENT_ADMIN');
      const mod = await as('MODERATOR');
      const created = await request(srv(app))
        .post('/v1/admin/moderation/scam-alerts')
        .set('cookie', staff.cookie)
        .send({ title: `Alerte ${run}`, body: 'La prise de rendez-vous est toujours gratuite.', severity: 'WARNING', publishedAt: new Date(Date.now() + 86_400_000).toISOString() })
        .expect(201);
      const list = await request(srv(app)).get('/v1/admin/moderation/scam-alerts').set('cookie', mod.cookie).expect(200);
      const id = (created.body as Body).id as string;
      const line = (list.body as Body).items.find((a: Body) => a.id === id);
      expect(line.state).toBe('draft');
      await prisma.scamAlert.deleteMany({ where: { id } });
    });
  });
});
