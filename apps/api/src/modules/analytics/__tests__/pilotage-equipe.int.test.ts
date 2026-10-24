/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any -- le corps des réponses HTTP est lu tel quel : le typer champ par champ doublerait chaque test sans rien prouver de plus. */
import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId } from '@app/db';
import {
  CITY_ACTIVATION_SUGGEST_MEMBERS,
  STAFF_IDLE_MINUTES,
  STAFF_MAX_FAILED_ATTEMPTS,
  STAFF_SESSION_COOKIE,
  adminDashboardOverviewSchema,
  adminStaffAlertsResponseSchema,
  type StaffRoleValue,
} from '@app/shared';
import { AppModule } from '../../../app.module';
import { CryptoService } from '../../../common/crypto.service';
import { ApiErrorFilter } from '../../../common/error.filter';
import { PrismaService } from '../../../common/prisma.service';
import { hashStaffPassword } from '../../admin/staff-password';
import { generateTotpSecret } from '../../admin/totp';
import { ModerationService } from '../../moderation/moderation.service';
import { AnalyticsService, startOfDayUtc } from '../analytics.service';

/**
 * Le tableau de bord complet (D02) et les alertes d'équipe — phase 5 « Administration ».
 *
 * `GET /admin/dashboard/overview` est ouvert aux QUATRE rôles. Les chiffres vivants sont
 * éprouvés par DIFFÉRENCE (avant / après avoir posé UN élément) : la base partagée porte
 * d'autres données, et un attendu absolu serait faux le jour où elle change. L'indicateur
 * clé, lui, est éprouvé avec les VRAIES tâches (`refreshKeyIndicator(now)`) rejouées à
 * deux dates : aucun instantané n'est écrit à la main.
 */

interface Body {
  [k: string]: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}
const srv = (app: INestApplication): Server => app.getHttpServer() as Server;
const DAY = 86_400_000;

describe('tableau de bord complet et alertes d’équipe (15 §5.1)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let crypto: CryptoService;
  let analytics: AnalyticsService;
  const run = Math.random().toString(36).slice(2, 8);
  let n = 0;
  const staffIds: string[] = [];
  const userIds: string[] = [];
  const eventIds: string[] = [];
  const caseIds: string[] = [];
  const proIds: string[] = [];
  const cityIds: string[] = [];
  const communityIds: string[] = [];
  const mentorshipIds: string[] = [];
  const snapshotDays: Date[] = [];
  let originCountryId = '';
  let cityId = '';
  let professionId = '';

  async function as(role: StaffRoleValue): Promise<{ cookie: string; staffId: string; email: string }> {
    n += 1;
    const staffId = newId();
    const email = `pil-${run}-${n}@equipe.test`;
    await prisma.staffUser.create({
      data: {
        id: staffId,
        email,
        displayName: `Équipe ${role} ${n}`,
        passwordHash: await hashStaffPassword('un-mot-de-passe-equipe-suffisamment-long'),
        totpSecretEncrypted: crypto.encryptContent(generateTotpSecret()),
        role,
        isActive: true,
      },
    });
    staffIds.push(staffId);
    const token = `p-${run}-${newId()}`;
    await prisma.staffSession.create({
      data: {
        id: newId(),
        staffId,
        tokenHash: crypto.hashToken(token),
        expiresAt: new Date(Date.now() + STAFF_IDLE_MINUTES * 60_000),
      },
    });
    return { cookie: `${STAFF_SESSION_COOKIE}=${token}`, staffId, email };
  }

  async function member(tag: string, over: { cityId?: string } = {}): Promise<string> {
    n += 1;
    const id = newId();
    await prisma.user.create({
      data: {
        id,
        handle: `pi${run}${n}${id.slice(-5)}`,
        displayName: `Pilotage ${tag}`,
        phase: 'SETTLED',
        verificationLevel: 'L1',
        originCountryId,
        cityId: over.cityId ?? cityId,
        plan: 'FREE',
        status: 'ACTIVE',
      },
    });
    userIds.push(id);
    return id;
  }

  async function overview(cookie: string): Promise<Body> {
    const res = await request(srv(app)).get('/v1/admin/dashboard/overview').set('cookie', cookie).expect(200);
    const parsed = adminDashboardOverviewSchema.safeParse(res.body);
    expect(parsed.success ? null : parsed.error.issues).toBeNull();
    return res.body as Body;
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
    analytics = app.get(AnalyticsService);
    originCountryId = (await prisma.country.findFirstOrThrow({ where: { isActive: true, kind: { in: ['ORIGIN', 'BOTH'] } } })).id;
    cityId = (await prisma.city.findFirstOrThrow({ orderBy: { slug: 'asc' } })).id;
    professionId = (await prisma.profession.findFirstOrThrow()).id;
  });

  afterAll(async () => {
    await prisma.staffAlert.deleteMany({ where: { staffId: { in: staffIds } } });
    await prisma.mentorshipReview.deleteMany({ where: { mentorshipId: { in: mentorshipIds } } });
    await prisma.mentorship.deleteMany({ where: { id: { in: mentorshipIds } } });
    await prisma.proProfile.deleteMany({ where: { id: { in: proIds } } });
    await prisma.community.deleteMany({ where: { id: { in: communityIds } } });
    await prisma.eventAttendee.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.event.deleteMany({ where: { id: { in: eventIds } } });
    await prisma.moderationCase.deleteMany({ where: { id: { in: caseIds } } });
    await prisma.city.deleteMany({ where: { id: { in: cityIds } } });
    await prisma.metricSnapshot.deleteMany({ where: { periodStart: { in: snapshotDays }, metric: { startsWith: 'key_indicator.' } } });
    await prisma.systemSetting.deleteMany({ where: { key: 'key_indicator_target', updatedByStaffId: { in: staffIds } } });
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

  // ══ L'accès ═══════════════════════════════════════════════════════════════

  it('exige une session d’équipe, et la sert aux QUATRE rôles', async () => {
    await request(srv(app)).get('/v1/admin/dashboard/overview').expect(401);
    for (const role of ['SUPER_ADMIN', 'CONTENT_ADMIN', 'MODERATOR', 'SUPPORT'] as const) {
      const staff = await as(role);
      const body = await overview(staff.cookie);
      expect(body.keyIndicator.target).toBe(30);
    }
  });

  it('ne porte AUCUN identifiant de membre (agrégé, jamais nominatif)', async () => {
    const staff = await as('SUPPORT');
    const raw = JSON.stringify(await overview(staff.cookie));
    expect(raw).not.toMatch(/userId|handle|displayName|phone/i);
  });

  // ══ Le bandeau d’alertes ══════════════════════════════════════════════════

  it('alertes : un dossier hors délai, une fiche pro en attente et une ville à activer se comptent', async () => {
    const staff = await as('SUPPORT');
    const avant = (await overview(staff.cookie)).alerts;

    const caseId = newId();
    await prisma.moderationCase.create({
      data: {
        id: caseId, subjectType: 'POST', subjectId: newId(), source: 'REPORT', priority: 1,
        status: 'OPEN', aiLabels: [], slaDueAt: new Date(Date.now() - 3 * 3_600_000),
      },
    });
    caseIds.push(caseId);

    const proUser = await member('pro');
    const proId = newId();
    await prisma.proProfile.create({
      data: {
        id: proId, userId: proUser, professionId, contactMethod: 'PLATFORM_MESSAGE',
        verificationStatus: 'PENDING', tier: 'FREE', status: 'ACTIVE',
      },
    });
    proIds.push(proId);

    const ville = await prisma.city.create({
      data: {
        id: newId(), countryId: (await prisma.city.findFirstOrThrow({ where: { id: cityId } })).countryId,
        name: `Ville à activer ${run}`, slug: `a-activer-${run}`, latitude: 45, longitude: 4, isActive: false,
        memberCount: CITY_ACTIVATION_SUGGEST_MEMBERS + 5,
      },
    });
    cityIds.push(ville.id);

    const apres = (await overview(staff.cookie)).alerts;
    expect(apres.moderationOverdue.count).toBe(avant.moderationOverdue.count + 1);
    expect(apres.proPending.count).toBe(avant.proPending.count + 1);
    expect(apres.citiesToActivate.count).toBe(avant.citiesToActivate.count + 1);
    expect(apres.citiesToActivate.names).toContain(`Ville à activer ${run}`);
  });

  // ══ Modération, parrainage, événements, réseaux ═══════════════════════════

  it('modération : la file et le SLA se lisent (même pour SUPPORT, que /moderation/stats exclut)', async () => {
    const support = await as('SUPPORT');
    await request(srv(app)).get('/v1/admin/moderation/stats').set('cookie', support.cookie).expect(403);

    const avant = (await overview(support.cookie)).moderation;
    const open = newId();
    const late = newId();
    await prisma.moderationCase.createMany({
      data: [
        { id: open, subjectType: 'POST', subjectId: newId(), source: 'REPORT', priority: 2, status: 'OPEN', aiLabels: [], slaDueAt: new Date(Date.now() + DAY) },
        {
          id: late, subjectType: 'POST', subjectId: newId(), source: 'REPORT', priority: 2, status: 'RESOLVED', aiLabels: [],
          slaDueAt: new Date(Date.now() - 2 * DAY), resolvedAt: new Date(Date.now() - DAY), resolution: 'KEEP',
        },
      ],
    });
    caseIds.push(open, late);
    const apres = (await overview(support.cookie)).moderation;
    expect(apres.queue).toBe(avant.queue + 1);
    expect(apres.resolvedSampleSize).toBe(avant.resolvedSampleSize + 1);
    // Un dossier résolu APRÈS son délai fait baisser (ou laisse nul) le respect du SLA, jamais monter.
    expect(apres.slaComplianceRate).not.toBeNull();
    if (avant.slaComplianceRate !== null) expect(apres.slaComplianceRate).toBeLessThanOrEqual(avant.slaComplianceRate);
    expect(apres.slaComplianceRate).toBeGreaterThanOrEqual(0);
    expect(apres.slaComplianceRate).toBeLessThanOrEqual(1);
  });

  it('parrainage : les parrainages en cours et la note moyenne', async () => {
    const staff = await as('MODERATOR');
    const avant = (await overview(staff.cookie)).mentorship;
    const mentor = await member('parrain');
    const mentee = await member('filleul');
    const id = newId();
    await prisma.mentorship.create({
      data: { id, mentorUserId: mentor, menteeUserId: mentee, status: 'ACTIVE', requestMessage: 'Bonjour', acceptedAt: new Date() },
    });
    mentorshipIds.push(id);
    await prisma.mentorshipReview.create({
      data: { id: newId(), mentorshipId: id, reviewerUserId: mentee, revieweeUserId: mentor, rating: 5 },
    });
    const apres = (await overview(staff.cookie)).mentorship;
    expect(apres.active).toBe(avant.active + 1);
    expect(apres.ratingCount).toBe(avant.ratingCount + 1);
    expect(apres.averageRating).toBeGreaterThanOrEqual(1);
    expect(apres.averageRating).toBeLessThanOrEqual(5);
  });

  it('événements du mois et présences cochées du mois ; un événement annulé ne compte pas', async () => {
    const staff = await as('CONTENT_ADMIN');
    const avant = (await overview(staff.cookie)).events;
    const orga = await member('orga');
    const participant = await member('participant');
    // Au milieu du mois courant : jamais à cheval sur une frontière de mois.
    const now = new Date();
    const milieu = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 15, 12));
    const mk = async (status: 'SCHEDULED' | 'CANCELLED') => {
      const id = newId();
      await prisma.event.create({
        data: { id, organizerUserId: orga, type: 'NETWORKING', title: `Mois ${run}`, cityId, startsAt: milieu, status },
      });
      eventIds.push(id);
      return id;
    };
    const tenu = await mk('SCHEDULED');
    const annule = await mk('CANCELLED');
    await prisma.eventAttendee.createMany({
      data: [
        { id: newId(), eventId: tenu, userId: participant, status: 'GOING', respondedAt: new Date(), checkedIn: true },
        { id: newId(), eventId: annule, userId: orga, status: 'GOING', respondedAt: new Date(), checkedIn: true },
      ],
    });
    const apres = (await overview(staff.cookie)).events;
    expect(apres.thisMonth).toBe(avant.thisMonth + 1);
    expect(apres.checkedInThisMonth).toBe(avant.checkedInThisMonth + 1);
  });

  it('réseaux : actifs et réseaux d’intérêt', async () => {
    const staff = await as('SUPER_ADMIN');
    const avant = (await overview(staff.cookie)).communities;
    const id = newId();
    await prisma.community.create({
      data: {
        id, kind: 'INTEREST', name: `Cuisine ${run}`, slug: `cuisine-${run}`, category: 'cuisine',
        visibility: 'PUBLIC', status: 'ACTIVE', lastActivityAt: new Date(),
      },
    });
    communityIds.push(id);
    const apres = (await overview(staff.cookie)).communities;
    expect(apres.active).toBe(avant.active + 1);
    expect(apres.interest).toBe(avant.interest + 1);
  });

  // ══ L’indicateur clé ══════════════════════════════════════════════════════

  it('indicateur clé : « Pas encore de mesure » sans instantané, puis le pourcentage, l’objectif, l’écart en points, la courbe et la ville', async () => {
    const staff = await as('SUPER_ADMIN');
    const sans = (await overview(staff.cookie)).keyIndicator;
    if (sans.measuredAt === null) {
      // Une base sans instantané n'est PAS en panne : des absences, pas des zéros.
      expect(sans).toMatchObject({ percent: null, variationPoints: null, members: null, present: null, byCity: [], weekly: [] });
    }

    // Une ville à soi : quatre membres, un seul coché présent à un événement de la veille.
    const ville = await prisma.city.create({
      data: {
        id: newId(), countryId: (await prisma.city.findFirstOrThrow({ where: { id: cityId } })).countryId,
        name: `Ville mesurée ${run}`, slug: `mesuree-${run}`, latitude: 46, longitude: 5, isActive: true, memberCount: 4,
      },
    });
    cityIds.push(ville.id);
    const [present, , , ] = [await member('p', { cityId: ville.id }), await member('a', { cityId: ville.id }), await member('b', { cityId: ville.id }), await member('c', { cityId: ville.id })];
    const evId = newId();
    const debut = new Date(Date.now() - 5 * DAY);
    await prisma.event.create({
      data: { id: evId, organizerUserId: present, type: 'NETWORKING', title: `Mesure ${run}`, cityId: ville.id, startsAt: debut, status: 'DONE' },
    });
    eventIds.push(evId);
    await prisma.eventAttendee.create({
      data: { id: newId(), eventId: evId, userId: present, status: 'GOING', respondedAt: new Date(), checkedIn: true },
    });

    // Deux passages de la VRAIE tâche quotidienne : il y a 9 jours (l'événement n'a pas
    // encore eu lieu, personne n'est présent) puis hier (il est dans les 90 jours).
    const avant = new Date(Date.now() - 9 * DAY);
    const hier = new Date(Date.now() - 1 * DAY);
    // Les instantanés qu'une autre suite (toutes les tâches rejouées) a pu poser pour ces jours, ou plus tard,
    // sont des données DÉRIVÉES : on les écarte pour que « le plus récent » soit bien celui d'hier.
    await prisma.metricSnapshot.deleteMany({ where: { metric: { startsWith: 'key_indicator.' }, periodStart: { gte: startOfDayUtc(avant) } } });
    await analytics.refreshKeyIndicator(avant);
    await analytics.refreshKeyIndicator(hier);
    snapshotDays.push(startOfDayUtc(avant), startOfDayUtc(hier));

    const apres = (await overview(staff.cookie)).keyIndicator;
    expect(apres.measuredAt).toBe(startOfDayUtc(hier).toISOString());
    expect(apres.members).toBeGreaterThanOrEqual(4);
    expect(apres.present).toBeGreaterThanOrEqual(1);
    // Le pourcentage est EXACTEMENT présents / membres, arrondi au dixième.
    expect(apres.percent).toBe(Math.round((apres.present / apres.members) * 1000) / 10);
    expect(apres.target).toBe(30);

    // La ville de l'essai : 4 membres, 1 présent → 25 %, écrit en dur.
    const laVille = apres.byCity.find((c: Body) => c.cityId === ville.id);
    expect(laVille).toMatchObject({ name: `Ville mesurée ${run}`, members: 4, present: 1, percent: 25 });

    // L'écart en POINTS avec l'instantané d'il y a 9 jours : le présent est apparu, donc > 0.
    expect(apres.variationPoints).not.toBeNull();
    expect(apres.variationPoints).toBeGreaterThan(0);
    const ref = await prisma.$queryRaw<{ members: number; present: number }[]>`
      SELECT COALESCE(sum(value) FILTER (WHERE metric = 'key_indicator.city_members'), 0)::float8 AS members,
             COALESCE(sum(value) FILTER (WHERE metric = 'key_indicator.city_present_90d'), 0)::float8 AS present
        FROM metric_snapshots WHERE period_start = ${startOfDayUtc(avant)}`;
    const refPct = Math.round((ref[0]!.present / ref[0]!.members) * 1000) / 10;
    expect(apres.variationPoints).toBe(Math.round((apres.percent - refPct) * 10) / 10);

    // La courbe hebdomadaire : au moins une semaine, croissante dans le temps, valeurs en %.
    expect(apres.weekly.length).toBeGreaterThanOrEqual(1);
    const semaines = apres.weekly.map((w: Body) => w.weekStart);
    expect([...semaines].sort()).toEqual(semaines);
    for (const w of apres.weekly) {
      expect(w.percent).toBeGreaterThanOrEqual(0);
      expect(w.percent).toBeLessThanOrEqual(100);
    }
  });

  it('l’objectif se règle par les paramètres (SUPER_ADMIN) et le tableau de bord le relit', async () => {
    const superAdmin = await as('SUPER_ADMIN');
    const content = await as('CONTENT_ADMIN');
    await request(srv(app)).put('/v1/admin/settings/key_indicator_target').set('cookie', content.cookie).send({ value: 40 }).expect(403);
    await request(srv(app)).put('/v1/admin/settings/key_indicator_target').set('cookie', superAdmin.cookie).send({ value: 150 }).expect(400);
    await request(srv(app)).put('/v1/admin/settings/key_indicator_target').set('cookie', superAdmin.cookie).send({ value: 40 }).expect(200);
    expect((await overview(content.cookie)).keyIndicator.target).toBe(40);
    await request(srv(app)).put('/v1/admin/settings/key_indicator_target').set('cookie', superAdmin.cookie).send({ value: 30 }).expect(200);
    expect((await overview(content.cookie)).keyIndicator.target).toBe(30);
  });

  // ══ Alertes d’équipe : délai de modération et verrouillage ════════════════

  describe('alertes d’équipe (staff_alerts)', () => {
    it('un verrouillage de compte alerte les AUTRES SUPER_ADMIN, lisible puis marquée lue ; jamais un SUPPORT', async () => {
      const boss = await as('SUPER_ADMIN');
      const support = await as('SUPPORT');
      const cible = await as('MODERATOR');
      await prisma.staffUser.update({ where: { id: cible.staffId }, data: { passwordHash: await hashStaffPassword('un-mot-de-passe-equipe-suffisamment-long') } });
      for (let i = 0; i < STAFF_MAX_FAILED_ATTEMPTS; i += 1) {
        await request(srv(app)).post('/v1/admin/auth/login').send({ email: cible.email, password: `faux-${i}-mot-de-passe` }).expect(401);
      }
      await request(srv(app)).post('/v1/admin/auth/login').send({ email: cible.email, password: 'un-mot-de-passe-equipe-suffisamment-long' }).expect(423);

      const liste = await request(srv(app)).get('/v1/admin/moderation/alerts').set('cookie', boss.cookie).expect(200);
      expect(adminStaffAlertsResponseSchema.safeParse(liste.body).success).toBe(true);
      const alerte = (liste.body as Body).items.find((a: Body) => a.kind === 'STAFF_LOCKED' && a.title === 'Compte équipe verrouillé' && a.body.includes(`Équipe MODERATOR`));
      expect(alerte).toBeDefined();
      expect(alerte.read).toBe(false);
      expect((liste.body as Body).unread).toBeGreaterThanOrEqual(1);
      expect((await overview(boss.cookie)).alerts.unreadStaffAlerts).toBeGreaterThanOrEqual(1);

      // Les tentatives suivantes ne multiplient pas l'alerte (unicité compte × genre × cible).
      await request(srv(app)).post('/v1/admin/auth/login').send({ email: cible.email, password: 'faux-encore-mot-de-passe' }).expect(423);
      const encore = await request(srv(app)).get('/v1/admin/moderation/alerts').set('cookie', boss.cookie).expect(200);
      expect((encore.body as Body).items.filter((a: Body) => a.kind === 'STAFF_LOCKED' && a.body.includes('Équipe MODERATOR')).length).toBe(
        (liste.body as Body).items.filter((a: Body) => a.kind === 'STAFF_LOCKED' && a.body.includes('Équipe MODERATOR')).length,
      );

      // Marquer lue : seulement les siennes.
      await request(srv(app)).post(`/v1/admin/moderation/alerts/${alerte.id}/read`).set('cookie', support.cookie).expect(403);
      const autre = await as('SUPER_ADMIN');
      await request(srv(app)).post(`/v1/admin/moderation/alerts/${alerte.id}/read`).set('cookie', autre.cookie).expect(404);
      await request(srv(app)).post(`/v1/admin/moderation/alerts/${alerte.id}/read`).set('cookie', boss.cookie).expect(201);
      const lue = await request(srv(app)).get('/v1/admin/moderation/alerts?unread=true').set('cookie', boss.cookie).expect(200);
      expect((lue.body as Body).items.find((a: Body) => a.id === alerte.id)).toBeUndefined();
      const toutes = await request(srv(app)).get('/v1/admin/moderation/alerts').set('cookie', boss.cookie).expect(200);
      expect((toutes.body as Body).items.find((a: Body) => a.id === alerte.id).read).toBe(true);

      // Un SUPPORT n'a pas accès à la liste (alertes de modération et de sécurité).
      await request(srv(app)).get('/v1/admin/moderation/alerts').set('cookie', support.cookie).expect(403);
    });

    it('un dossier prioritaire hors délai alerte l’équipe par la tâche planifiée', async () => {
      const mod = await as('MODERATOR');
      const id = newId();
      await prisma.moderationCase.create({
        data: { id, subjectType: 'POST', subjectId: newId(), source: 'REPORT', priority: 1, status: 'OPEN', aiLabels: [], slaDueAt: new Date(Date.now() - 2 * 3_600_000) },
      });
      caseIds.push(id);
      
      await app.get(ModerationService).alertOverdueUrgentCases(new Date());
      const liste = await request(srv(app)).get('/v1/admin/moderation/alerts').set('cookie', mod.cookie).expect(200);
      const alerte = (liste.body as Body).items.find((a: Body) => a.caseId === id);
      expect(alerte).toMatchObject({ kind: 'SLA_BREACH', caseOpen: true, read: false });
    });
  });
});
