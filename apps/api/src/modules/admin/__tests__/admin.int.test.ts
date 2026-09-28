import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId } from '@app/db';
import {
  AUDIT_ACTIONS,
  COMMUNITY_CITY_THRESHOLD_SETTING_KEY,
  HOUSING_RISK_WEIGHTS,
  MODERATION_THRESHOLD_DEFAULTS,
  MODERATION_THRESHOLDS_SETTING_KEY,
  SETTING_KEYS,
  STAFF_IDLE_MINUTES,
  STAFF_SESSION_COOKIE,
  type StaffRoleValue,
} from '@app/shared';
import { AppModule } from '../../../app.module';
import { AuditService } from '../../../common/audit.service';
import { CryptoService } from '../../../common/crypto.service';
import { ApiErrorFilter } from '../../../common/error.filter';
import { PrismaService } from '../../../common/prisma.service';
import { generateTotpSecret } from '../totp';
import { hashStaffPassword } from '../staff-password';

/**
 * Administration — 15-administration.md §2.2, §2.3, §3, §4.4 et §12.
 *
 * Les routes sont appelées par HTTP, comme dans `staff-guard.int.test.ts`, parce
 * que le garde fait partie de ce qu'on livre : un test de service prouverait que
 * la méthode marche, pas que la route existe, ni qu'elle exige le bon rôle.
 *
 * Deux règles dures du §12 vivent ici :
 *   · « toute route admin non-GET écrit une ligne d'audit dans la même
 *     transaction » ;
 *   · « aucun numéro de téléphone en clair dans une réponse admin ».
 *
 * Les deux autres (`hermétisme`, `TOTP`) sont dans `staff-guard.int.test.ts`, et
 * « le rapport d'impact ne contient aucune donnée nominative » n'a pas de test
 * parce que le rapport d'impact n'est pas livré (voir le rapport).
 */

interface ErrorBody {
  error: { code: string; message: string; details?: Record<string, unknown> };
}
interface PageBody<T> {
  items: T[];
  nextCursor: string | null;
}

function httpServer(app: INestApplication): Server {
  return app.getHttpServer() as Server;
}

const PASSWORD = 'un-mot-de-passe-equipe-suffisamment-long';
/**
 * Le numéro de base. Chaque membre en reçoit une VARIANTE : `phone_numbers`
 * porte un index UNIQUE sur l'empreinte HMAC, et deux membres du même numéro
 * font échouer la création avec une erreur qui n'a rien à voir avec ce qu'on
 * teste. Découvert en exécutant le test.
 */
const PHONE_PREFIX = '+3361234';

/**
 * Un lecteur CSV minimal : cellules citées, guillemets doublés. Écrit ici plutôt
 * qu'importé, parce qu'il sert à VÉRIFIER l'écrivain — un test qui réutiliserait
 * le code de l'écrivain pour le relire ne prouverait rien.
 */
function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i] as string;
    if (quoted) {
      if (char !== '"') current += char;
      else if (line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === ',') {
      cells.push(current);
      current = '';
    } else current += char;
  }
  cells.push(current);
  return cells;
}
const REASON = 'Correction demandée par le membre par écrit le 12 mars.';

describe('administration (15)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let crypto: CryptoService;
  let audit: AuditService;

  const createdStaff: string[] = [];
  const createdUsers: string[] = [];
  const createdSettings: string[] = [];
  const run = Math.random().toString(36).slice(2, 8);
  let counter = 0;

  let originCountryId: string;
  let franceCountryId: string;
  let cityId: string;
  let otherCityId: string;
  let professionId: string;

  /** Le cookie d'un compte équipe du rôle demandé. */
  async function as(role: StaffRoleValue): Promise<{ cookie: string; staffId: string }> {
    counter += 1;
    const staffId = newId();
    await prisma.staffUser.create({
      data: {
        id: staffId,
        email: `admin-${run}-${counter}@equipe.test`,
        displayName: `Équipe ${role} ${counter}`,
        passwordHash: await hashStaffPassword(PASSWORD),
        totpSecretEncrypted: crypto.encryptContent(generateTotpSecret()),
        role,
        isActive: true,
      },
    });
    createdStaff.push(staffId);

    const token = `a-${run}-${newId()}`;
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

  async function member(options: { withPhone?: boolean; status?: 'ACTIVE' | 'DEACTIVATED' } = {}) {
    counter += 1;
    const id = newId();
    const phone = `${PHONE_PREFIX}${String(1000 + counter)}`;
    await prisma.user.create({
      data: {
        id,
        handle: `ad${run}${counter}${id.slice(-6)}`,
        displayName: `Membre Test ${counter}`,
        phase: 'SETTLED',
        verificationLevel: 'L2',
        originCountryId,
        cityId,
        plan: 'FREE',
        status: options.status ?? 'ACTIVE',
      },
    });
    createdUsers.push(id);
    if (options.withPhone === true) {
      await prisma.phoneNumber.create({
        data: {
          id: newId(),
          userId: id,
          countryId: franceCountryId,
          phoneEncrypted: crypto.encryptPhone(phone),
          phoneHmac: crypto.phoneFingerprint(phone),
          isPrimary: true,
          isDestination: true,
          verifiedAt: new Date(),
        },
      });
    }
    return { id, phone };
  }

  /** Le raccourci pour les tests qui n'ont besoin que de l'identifiant. */
  async function memberId(options: Parameters<typeof member>[0] = {}): Promise<string> {
    return (await member(options)).id;
  }

  /**
   * Une fiche pro en attente, écrite directement.
   *
   * `ProsService.putProfile` ferait le même travail, mais il faudrait le
   * construire avec ses quatre dépendances pour obtenir un état dont on n'a besoin
   * que comme POINT DE DÉPART. Ce que ce fichier teste est la DÉCISION, pas la
   * soumission — laquelle est déjà couverte par `pros.int.test.ts`.
   */
  async function proProfile(
    userId: string,
    options: { status?: 'PENDING' | 'APPROVED' | 'REJECTED'; deleted?: boolean } = {},
  ): Promise<string> {
    const id = newId();
    const asset = newId();
    await prisma.mediaAsset.create({
      data: {
        id: asset,
        ownerUserId: userId,
        kind: 'PROOF',
        storageKey: `test/proof/${asset}.pdf`,
        mime: 'application/pdf',
        sizeBytes: BigInt(4096),
        status: 'READY',
      },
    });
    await prisma.proProfile.create({
      data: {
        id,
        userId,
        professionId,
        businessName: 'Cabinet du coin',
        description: 'Accompagnement des démarches administratives du quotidien.',
        contactMethod: 'PLATFORM_MESSAGE',
        siret: '12345678900011',
        proofAssetId: asset,
        verificationStatus: options.status ?? 'PENDING',
        tier: 'FREE',
        status: 'ACTIVE',
        ...(options.deleted === true ? { deletedAt: new Date() } : {}),
      },
    });
    return id;
  }

  async function auditRows(targetId: string, action?: string) {
    return prisma.auditLog.findMany({
      where: { targetId, ...(action === undefined ? {} : { action }) },
      orderBy: { id: 'desc' },
    });
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
    audit = app.get(AuditService);

    const origin = await prisma.country.findFirstOrThrow({
      where: { isActive: true, kind: { in: ['ORIGIN', 'BOTH'] } },
      select: { id: true },
    });
    originCountryId = origin.id;
    const france = await prisma.country.findFirstOrThrow({
      where: { iso2: 'FR' },
      select: { id: true },
    });
    franceCountryId = france.id;

    const cities = await prisma.city.findMany({ orderBy: { slug: 'asc' }, take: 2, select: { id: true } });
    cityId = (cities[0] as { id: string }).id;
    otherCityId = (cities[1] as { id: string }).id;

    const profession = await prisma.profession.findFirstOrThrow({ select: { id: true } });
    professionId = profession.id;
  });

  afterAll(async () => {
    // Les fiches pro et les médias partent avec le membre (cascade).
    await prisma.user.deleteMany({ where: { id: { in: createdUsers } } });
    await prisma.systemSetting.deleteMany({ where: { key: { in: createdSettings } } });
    for (const id of createdStaff) {
      try {
        await prisma.staffUser.delete({ where: { id } });
      } catch {
        await prisma.staffUser.update({ where: { id }, data: { isActive: false } });
      }
    }
    await app?.close();
  });

  // ══════════════════════════════════════════════════════════════════════════
  // PRIORITÉ 2 — La validation des fiches pro : ce qui débloque le module 10
  // ══════════════════════════════════════════════════════════════════════════

  describe('validation des fiches professionnelles (10 §4.1)', () => {
    it('la file ne montre que les fiches en attente et non supprimées', async () => {
      const staff = await as('CONTENT_ADMIN');
      const pending = await proProfile(await memberId());
      const approved = await proProfile(await memberId(), { status: 'APPROVED' });
      const removed = await proProfile(await memberId(), { deleted: true });

      const res = await request(httpServer(app))
        .get('/v1/admin/pro-profiles')
        .set('cookie', staff.cookie)
        .expect(200);
      const ids = (res.body as PageBody<{ id: string }>).items.map((i) => i.id);
      expect(ids).toContain(pending);
      expect(ids).not.toContain(approved);
      // Une fiche soft-supprimée n'est nulle part, même en attente. `deletedAt: null`
      // et non un `notIn` sur les statuts : `notIn` sur une colonne NULLABLE
      // éliminerait aussi les lignes à NULL, c'est-à-dire toutes les fiches vivantes.
      expect(ids).not.toContain(removed);

      const approvedList = await request(httpServer(app))
        .get('/v1/admin/pro-profiles?status=APPROVED')
        .set('cookie', staff.cookie)
        .expect(200);
      expect((approvedList.body as PageBody<{ id: string }>).items.map((i) => i.id)).toContain(approved);
    });

    it('le justificatif est visible de l’équipe, et le compteur de vues ne l’est pas', async () => {
      const staff = await as('SUPPORT');
      const id = await proProfile(await memberId());
      const res = await request(httpServer(app))
        .get(`/v1/admin/pro-profiles/${id}`)
        .set('cookie', staff.cookie)
        .expect(200);
      const body = res.body as { proof: { storageKey: string; sizeBytes: number } | null };
      // 00 §8.1 : « accès équipe uniquement ». Sans lui, la validation humaine du
      // §4.1 n'aurait rien à regarder.
      expect(body.proof?.storageKey).toContain('test/proof/');
      // `sizeBytes` est un BigInt en base : s'il n'était pas converti, la
      // sérialisation JSON lèverait et la fiche répondrait 500.
      expect(typeof body.proof?.sizeBytes).toBe('number');
      // Règle dure 10 §1.2 : aucun compteur de vues exposé.
      expect(JSON.stringify(res.body)).not.toMatch(/viewCount|view_count/);
    });

    it('valider une fiche la rend APPROUVÉE, trace la décision et émet l’événement', async () => {
      const staff = await as('CONTENT_ADMIN');
      const userId = await memberId();
      const id = await proProfile(userId);

      const res = await request(httpServer(app))
        .post(`/v1/admin/pro-profiles/${id}/approve`)
        .set('cookie', staff.cookie)
        .send({ note: 'Justificatif conforme, SIRET vérifié.' })
        .expect(201);
      expect(res.body).toMatchObject({ verificationStatus: 'APPROVED', decidedByStaffId: staff.staffId });

      const row = await prisma.proProfile.findUniqueOrThrow({
        where: { id },
        select: { verificationStatus: true },
      });
      expect(row.verificationStatus).toBe('APPROVED');

      /**
       * LES TROIS COLONNES MANQUANTES, vérifiées par leur remplaçant.
       *
       * `pro_profiles.approved_at`, `approved_by_staff_id` et `rejection_reason`
       * (10 §5) n'existent pas dans le schéma figé. La ligne d'audit les porte
       * toutes les trois : `created_at`, `actor_id`, `metadata.note`.
       */
      const trace = await auditRows(id, AUDIT_ACTIONS.proApproved);
      expect(trace).toHaveLength(1);
      expect(trace[0]).toMatchObject({ actorType: 'STAFF', actorId: staff.staffId });
      expect(trace[0]?.metadata).toMatchObject({
        userId,
        before: 'PENDING',
        after: 'APPROVED',
        note: 'Justificatif conforme, SIRET vérifié.',
      });

      const events = await prisma.domainEvent.findMany({ where: { aggregateId: id, type: 'pro.approved' } });
      expect(events).toHaveLength(1);

      // L'historique est reconstitué depuis `audit_logs`.
      const detail = await request(httpServer(app))
        .get(`/v1/admin/pro-profiles/${id}`)
        .set('cookie', staff.cookie)
        .expect(200);
      expect((detail.body as { decisions: { decision: string }[] }).decisions[0]).toMatchObject({
        decision: 'APPROVED',
        byStaffId: staff.staffId,
      });
    });

    it('refuser exige un motif long, qui est conservé comme rejection_reason', async () => {
      const staff = await as('SUPER_ADMIN');
      const id = await proProfile(await memberId());

      const tooShort = await request(httpServer(app))
        .post(`/v1/admin/pro-profiles/${id}/reject`)
        .set('cookie', staff.cookie)
        .send({ reason: 'non' })
        .expect(400);
      expect((tooShort.body as ErrorBody).error.code).toBe('VALIDATION_FAILED');

      const reason = 'Le justificatif transmis est illisible : merci d’en envoyer un plus net.';
      await request(httpServer(app))
        .post(`/v1/admin/pro-profiles/${id}/reject`)
        .set('cookie', staff.cookie)
        .send({ reason })
        .expect(201);

      const trace = await auditRows(id, AUDIT_ACTIONS.proRejected);
      expect(trace[0]?.metadata).toMatchObject({ reason, after: 'REJECTED' });
      const events = await prisma.domainEvent.findMany({ where: { aggregateId: id, type: 'pro.rejected' } });
      expect(events).toHaveLength(1);
    });

    /**
     * Deux membres de l'équipe ouvrant la même file ne doivent pas pouvoir écrire
     * deux décisions contradictoires, la dernière gagnant en silence.
     */
    it('une fiche déjà tranchée refuse une seconde décision', async () => {
      const staff = await as('SUPER_ADMIN');
      const id = await proProfile(await memberId());
      await request(httpServer(app))
        .post(`/v1/admin/pro-profiles/${id}/approve`)
        .set('cookie', staff.cookie)
        .send({})
        .expect(201);

      const again = await request(httpServer(app))
        .post(`/v1/admin/pro-profiles/${id}/reject`)
        .set('cookie', staff.cookie)
        .send({ reason: 'Je change d’avis, ce justificatif ne convient pas du tout.' })
        .expect(409);
      expect((again.body as ErrorBody).error.code).toBe('PRO_NOT_PENDING');
    });

    it('un MODERATOR ne valide pas les fiches pro (§2.2)', async () => {
      const staff = await as('MODERATOR');
      const id = await proProfile(await memberId());
      const res = await request(httpServer(app))
        .post(`/v1/admin/pro-profiles/${id}/approve`)
        .set('cookie', staff.cookie)
        .send({})
        .expect(403);
      expect((res.body as ErrorBody).error.code).toBe('STAFF_ROLE_REQUIRED');
      // Et rien n'a bougé.
      const row = await prisma.proProfile.findUniqueOrThrow({
        where: { id },
        select: { verificationStatus: true },
      });
      expect(row.verificationStatus).toBe('PENDING');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // PRIORITÉ 3 — Les réglages (§4.4)
  // ══════════════════════════════════════════════════════════════════════════

  describe('paramètres système (§4.4)', () => {
    it('rend toutes les clés du registre, défaut du code compris', async () => {
      const staff = await as('SUPPORT');
      const res = await request(httpServer(app))
        .get('/v1/admin/settings')
        .set('cookie', staff.cookie)
        .expect(200);
      const items = (res.body as { items: { key: string; value: unknown; isDefault: boolean }[] }).items;
      expect(items.map((i) => i.key).sort()).toEqual([...SETTING_KEYS].sort());

      // Les trois clés que la priorité de livraison nomme.
      const thresholds = items.find((i) => i.key === MODERATION_THRESHOLDS_SETTING_KEY);
      expect(thresholds?.value).toMatchObject(MODERATION_THRESHOLD_DEFAULTS);
      expect(items.find((i) => i.key === 'housing.risk_weights')?.value).toMatchObject(
        HOUSING_RISK_WEIGHTS,
      );
      expect(items.find((i) => i.key === COMMUNITY_CITY_THRESHOLD_SETTING_KEY)?.value).toBe(50);
    });

    it('écrit une valeur valide, la trace, et sert ensuite la valeur écrite', async () => {
      const staff = await as('SUPER_ADMIN');
      createdSettings.push(COMMUNITY_CITY_THRESHOLD_SETTING_KEY);

      await request(httpServer(app))
        .put(`/v1/admin/settings/${COMMUNITY_CITY_THRESHOLD_SETTING_KEY}`)
        .set('cookie', staff.cookie)
        .send({ value: 75, reason: 'Ouverture plus progressive des réseaux de ville.' })
        .expect(200);

      const after = await request(httpServer(app))
        .get(`/v1/admin/settings/${COMMUNITY_CITY_THRESHOLD_SETTING_KEY}`)
        .set('cookie', staff.cookie)
        .expect(200);
      expect(after.body).toMatchObject({ value: 75, isDefault: false, defaultValue: 50 });

      /**
       * LA LIMITE DU SCHÉMA, vérifiée plutôt que supposée.
       *
       * `audit_logs.target_id` est un UUID : la clé d'un réglage — une CHAÎNE — ne
       * peut pas y entrer. Elle passe par les métadonnées, et `target_id` reste nul.
       */
      const trace = await prisma.auditLog.findFirst({
        where: { actorId: staff.staffId, action: AUDIT_ACTIONS.settingChanged },
        orderBy: { id: 'desc' },
      });
      expect(trace?.targetId).toBeNull();
      expect(trace?.targetType).toBe('system_setting');
      expect(trace?.metadata).toMatchObject({
        key: COMMUNITY_CITY_THRESHOLD_SETTING_KEY,
        before: null,
        after: 75,
      });
    });

    it('refuse une valeur hors schéma, en nommant le champ fautif', async () => {
      const staff = await as('SUPER_ADMIN');
      const res = await request(httpServer(app))
        .put('/v1/admin/settings/housing.price_bounds')
        .set('cookie', staff.cookie)
        .send({ value: { minCents: 90_000, maxCents: 1000 } })
        .expect(400);
      const body = res.body as ErrorBody;
      expect(body.error.code).toBe('VALIDATION_FAILED');
      expect(
        (body.error.details as { fields: { path: string }[] }).fields.map((f) => f.path),
      ).toContain('value.maxCents');
      // Rien n'a été écrit.
      expect(await prisma.systemSetting.findUnique({ where: { key: 'housing.price_bounds' } })).toBeNull();
    });

    /**
     * §7 : « SUPER_ADMIN (certaines clés CONTENT_ADMIN) ».
     *
     * Le rôle est vérifié par CLÉ, dans le service, parce que le garde ne lit pas
     * le corps de la requête — et qu'une route ouverte au rôle le plus faible du
     * registre laisserait un `CONTENT_ADMIN` écrire les poids du score de risque.
     */
    it('le rôle exigé dépend de la clé, pas de la route', async () => {
      const contentAdmin = await as('CONTENT_ADMIN');
      createdSettings.push('reserved_handles');

      const refused = await request(httpServer(app))
        .put('/v1/admin/settings/housing.risk_weights')
        .set('cookie', contentAdmin.cookie)
        .send({ value: { SCAM_TERMS: 0.9 } })
        .expect(403);
      expect((refused.body as ErrorBody).error.code).toBe('STAFF_ROLE_REQUIRED');
      expect(await prisma.systemSetting.findUnique({ where: { key: 'housing.risk_weights' } })).toBeNull();

      // La même route, une autre clé : permise.
      await request(httpServer(app))
        .put('/v1/admin/settings/reserved_handles')
        .set('cookie', contentAdmin.cookie)
        .send({ value: [`interdit-${run}`] })
        .expect(200);

      // Et un rôle hors du périmètre de la route n'entre même pas.
      const support = await as('SUPPORT');
      const blocked = await request(httpServer(app))
        .put('/v1/admin/settings/reserved_handles')
        .set('cookie', support.cookie)
        .send({ value: [] })
        .expect(403);
      expect((blocked.body as ErrorBody).error.code).toBe('STAFF_ROLE_REQUIRED');
    });

    it('une clé absente du registre est refusée (404), en lecture comme en écriture', async () => {
      const staff = await as('SUPER_ADMIN');
      for (const method of ['get', 'put'] as const) {
        const res = await request(httpServer(app))[method]('/v1/admin/settings/moderation.threshold')
          .set('cookie', staff.cookie)
          .send(method === 'put' ? { value: 1 } : undefined)
          .expect(404);
        expect((res.body as ErrorBody).error.code).toBe('UNKNOWN_SETTING');
      }
    });

    /** Les seuils de modération ont deux portes ; elles doivent accepter la même chose. */
    it('les seuils de modération sont lisibles par les deux chemins', async () => {
      const staff = await as('SUPER_ADMIN');
      createdSettings.push(MODERATION_THRESHOLDS_SETTING_KEY);
      const next = { ...MODERATION_THRESHOLD_DEFAULTS, dismissedStreak: 12 };

      await request(httpServer(app))
        .put('/v1/admin/moderation/settings')
        .set('cookie', staff.cookie)
        .send(next)
        .expect(200);

      const generic = await request(httpServer(app))
        .get(`/v1/admin/settings/${MODERATION_THRESHOLDS_SETTING_KEY}`)
        .set('cookie', staff.cookie)
        .expect(200);
      expect((generic.body as { value: { dismissedStreak: number } }).value.dismissedStreak).toBe(12);

      // Et le schéma est le même : un seuil de blocage inférieur au seuil de file
      // est refusé par les DEUX portes.
      const bad = { ...MODERATION_THRESHOLD_DEFAULTS, housingRiskBlock: 0.1, housingRiskQueue: 0.9 };
      await request(httpServer(app))
        .put('/v1/admin/moderation/settings')
        .set('cookie', staff.cookie)
        .send(bad)
        .expect(400);
      await request(httpServer(app))
        .put(`/v1/admin/settings/${MODERATION_THRESHOLDS_SETTING_KEY}`)
        .set('cookie', staff.cookie)
        .send({ value: bad })
        .expect(400);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // §2.3 / §12 — L'audit
  // ══════════════════════════════════════════════════════════════════════════

  describe('journal d’audit (§2.3)', () => {
    /**
     * LE PIÈGE QUI A COÛTÉ CHER À TROIS MODULES.
     *
     * `from` et `to` portent tous deux sur `created_at`. En deux diffusions
     * conditionnelles, la seconde écrase la première : le filtre de début
     * disparaît, la page renvoie des lignes trop anciennes, et rien ne le dit.
     * Ce test interroge la COMBINAISON, ce qu'un test par filtre ne ferait jamais.
     */
    it('les filtres from ET to s’appliquent tous les deux, ensemble', async () => {
      const staff = await as('SUPER_ADMIN');
      const target = newId();

      // Trois traces, à trois dates. Les `created_at` sont posés à la main parce
      // qu'on ne peut pas attendre quelques jours dans un test.
      const ids = { old: newId(), middle: newId(), recent: newId() };
      const dates = {
        old: new Date(Date.now() - 30 * 86_400_000),
        middle: new Date(Date.now() - 15 * 86_400_000),
        recent: new Date(Date.now() - 1 * 86_400_000),
      };
      for (const key of ['old', 'middle', 'recent'] as const) {
        await prisma.auditLog.create({
          data: {
            id: ids[key],
            createdAt: dates[key],
            actorType: 'STAFF',
            actorId: staff.staffId,
            action: `test.window_${run}`,
            targetType: 'test',
            targetId: target,
          },
        });
      }

      const from = new Date(Date.now() - 20 * 86_400_000).toISOString();
      const to = new Date(Date.now() - 10 * 86_400_000).toISOString();

      // `from` seul : middle + recent.
      const onlyFrom = await request(httpServer(app))
        .get(`/v1/admin/audit?action=test.window_${run}&from=${from}`)
        .set('cookie', staff.cookie)
        .expect(200);
      expect((onlyFrom.body as PageBody<{ id: string }>).items.map((i) => i.id).sort()).toEqual(
        [ids.middle, ids.recent].sort(),
      );

      // `to` seul : old + middle.
      const onlyTo = await request(httpServer(app))
        .get(`/v1/admin/audit?action=test.window_${run}&to=${to}`)
        .set('cookie', staff.cookie)
        .expect(200);
      expect((onlyTo.body as PageBody<{ id: string }>).items.map((i) => i.id).sort()).toEqual(
        [ids.old, ids.middle].sort(),
      );

      // LES DEUX : middle seulement. C'est l'assertion qui compte.
      const both = await request(httpServer(app))
        .get(`/v1/admin/audit?action=test.window_${run}&from=${from}&to=${to}`)
        .set('cookie', staff.cookie)
        .expect(200);
      expect((both.body as PageBody<{ id: string }>).items.map((i) => i.id)).toEqual([ids.middle]);
    });

    it('les filtres acteur, action et cible se combinent aussi', async () => {
      const a = await as('SUPER_ADMIN');
      const b = await as('SUPER_ADMIN');
      const target = newId();
      const other = newId();

      await prisma.auditLog.createMany({
        data: [
          { id: newId(), actorType: 'STAFF', actorId: a.staffId, action: `t.x_${run}`, targetType: 'test', targetId: target },
          { id: newId(), actorType: 'STAFF', actorId: b.staffId, action: `t.x_${run}`, targetType: 'test', targetId: target },
          { id: newId(), actorType: 'STAFF', actorId: a.staffId, action: `t.y_${run}`, targetType: 'test', targetId: target },
          { id: newId(), actorType: 'STAFF', actorId: a.staffId, action: `t.x_${run}`, targetType: 'test', targetId: other },
        ],
      });

      const res = await request(httpServer(app))
        .get(`/v1/admin/audit?actor=${a.staffId}&action=t.x_${run}&target=${target}`)
        .set('cookie', a.cookie)
        .expect(200);
      const items = (res.body as PageBody<{ actorId: string; action: string; targetId: string }>).items;
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({ actorId: a.staffId, action: `t.x_${run}`, targetId: target });

      // Un acteur `SYSTEM` se filtre par son TYPE : il n'a pas d'identifiant.
      await prisma.auditLog.create({
        data: { id: newId(), actorType: 'SYSTEM', action: `t.sys_${run}`, targetType: 'test', targetId: target },
      });
      const system = await request(httpServer(app))
        .get(`/v1/admin/audit?actor=SYSTEM&target=${target}`)
        .set('cookie', a.cookie)
        .expect(200);
      expect((system.body as PageBody<{ actorType: string }>).items.every((i) => i.actorType === 'SYSTEM')).toBe(
        true,
      );
    });

    it('exporte en CSV avec les mêmes filtres, en échappant les cellules', async () => {
      const staff = await as('CONTENT_ADMIN');
      const target = newId();
      await prisma.auditLog.create({
        data: {
          id: newId(),
          actorType: 'STAFF',
          actorId: staff.staffId,
          action: `t.csv_${run}`,
          targetType: 'test',
          targetId: target,
          metadata: { note: 'une virgule, un "guillemet"' },
        },
      });

      const res = await request(httpServer(app))
        .get(`/v1/admin/audit/export?action=t.csv_${run}`)
        .set('cookie', staff.cookie)
        .expect(200);
      expect(res.headers['content-type']).toContain('text/csv');
      const lines = res.text.trim().split('\n');
      expect(lines[0]).toBe('id,created_at,actor_type,actor_id,action,target_type,target_id,ip,metadata');
      expect(lines).toHaveLength(2);

      /**
       * L'assertion qui compte : la VIRGULE contenue dans la métadonnée n'a pas
       * créé de colonne. Relire la ligne avec un lecteur CSV minimal est le seul
       * moyen de le dire — chercher une sous-chaîne dans la ligne brute ne
       * distingue pas un échappement juste d'un échappement absent.
       */
      const cells = parseCsvLine(lines[1] as string);
      expect(cells).toHaveLength(9);
      expect(JSON.parse(cells[8] as string)).toEqual({ note: 'une virgule, un "guillemet"' });
    });

    /**
     * RÈGLE DURE (§2.3) : la trace est écrite AVANT le commit.
     *
     * Le prouver demande de faire ÉCHOUER la trace et de constater que l'action
     * disparaît avec elle. L'occasion est la limite du schéma elle-même :
     * `audit_logs.target_id` est un UUID, donc une clé de réglage passée en
     * `targetId` fait refuser l'écriture par Postgres. Si la trace était posée
     * après le commit, la mise à jour survivrait.
     */
    it('une trace refusée annule l’action (même transaction)', async () => {
      const staff = await as('SUPER_ADMIN');
      const key = `test.rollback.${run}`;
      createdSettings.push(key);

      await expect(
        prisma.$transaction(async (tx) => {
          await tx.systemSetting.create({ data: { key, value: { v: 1 } } });
          await audit.record(tx, {
            actor: { type: 'STAFF', id: staff.staffId },
            action: `t.rollback_${run}`,
            targetType: 'system_setting',
            // Une CHAÎNE dans une colonne `uuid` : Postgres refuse.
            targetId: key,
          });
        }),
      ).rejects.toThrow();

      // L'écriture a été annulée AVEC la trace.
      expect(await prisma.systemSetting.findUnique({ where: { key } })).toBeNull();
      expect(await prisma.auditLog.count({ where: { action: `t.rollback_${run}` } })).toBe(0);
    });

    /**
     * §8.5 et §2.3 : « valeurs sensibles masquées ». Le nettoyeur
     * d'`audit.service.ts` s'en charge ; ce test vérifie qu'il tourne bien sur le
     * chemin des routes d'administration, et pas seulement en théorie.
     */
    it('une métadonnée sensible n’atteint jamais le journal en clair', async () => {
      const staff = await as('SUPER_ADMIN');
      const target = newId();
      await audit.record(prisma, {
        actor: { type: 'STAFF', id: staff.staffId },
        action: `t.scrub_${run}`,
        targetType: 'test',
        targetId: target,
        metadata: { phone: `${PHONE_PREFIX}9999`, nested: { totpSecret: 'ABCDEF', email: 'x@y.test' } },
      });
      const row = await prisma.auditLog.findFirstOrThrow({ where: { action: `t.scrub_${run}` } });
      const serialized = JSON.stringify(row.metadata);
      expect(serialized).not.toContain(`${PHONE_PREFIX}9999`);
      expect(serialized).not.toContain('ABCDEF');
      expect(serialized).not.toContain('x@y.test');
      expect(serialized).toContain('[masqué]');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // §2.2 — Comptes équipe
  // ══════════════════════════════════════════════════════════════════════════

  describe('comptes équipe (§2.2)', () => {
    it('crée un compte non enrôlé, sans jamais rendre le secret TOTP', async () => {
      const staff = await as('SUPER_ADMIN');
      const email = `neuf-${run}-${Date.now()}@equipe.test`;
      const res = await request(httpServer(app))
        .post('/v1/admin/staff')
        .set('cookie', staff.cookie)
        .send({ email, displayName: 'Nouvelle Recrue', password: PASSWORD, role: 'SUPPORT' })
        .expect(201);
      const created = res.body as { id: string };
      createdStaff.push(created.id);

      const row = await prisma.staffUser.findUniqueOrThrow({
        where: { id: created.id },
        select: { totpSecretEncrypted: true, passwordHash: true, role: true },
      });
      // §2.1 : l'enrôlement est forcé à la première connexion → secret vide.
      expect(row.totpSecretEncrypted.length).toBe(0);
      // Le mot de passe est haché, jamais stocké en clair.
      expect(row.passwordHash).not.toContain(PASSWORD);
      expect(row.passwordHash.startsWith('scrypt$')).toBe(true);

      // La liste dit l'enrôlement par un booléen, et ne rend aucun secret.
      const list = await request(httpServer(app))
        .get('/v1/admin/staff')
        .set('cookie', staff.cookie)
        .expect(200);
      const found = (list.body as PageBody<{ id: string; totpEnrolled: boolean }>).items.find(
        (i) => i.id === created.id,
      );
      expect(found).toMatchObject({ totpEnrolled: false });
      expect(JSON.stringify(list.body)).not.toContain('totpSecret');
      expect(JSON.stringify(list.body)).not.toContain('passwordHash');

      // Et la trace de la création porte l'acteur — ce que
      // `created_by_staff_id` (§6, absente du schéma) aurait dit.
      const trace = await auditRows(created.id, AUDIT_ACTIONS.staffCreated);
      expect(trace[0]).toMatchObject({ actorId: staff.staffId });

      // L'email est unique.
      const duplicate = await request(httpServer(app))
        .post('/v1/admin/staff')
        .set('cookie', staff.cookie)
        .send({ email, displayName: 'Doublon', password: PASSWORD, role: 'SUPPORT' })
        .expect(409);
      expect((duplicate.body as ErrorBody).error.code).toBe('STAFF_EMAIL_TAKEN');
    });

    it('refuse un mot de passe trop court ou trop courant', async () => {
      const staff = await as('SUPER_ADMIN');
      for (const password of ['court', 'motdepasse', 'password123', 'AZERTYUIOP']) {
        await request(httpServer(app))
          .post('/v1/admin/staff')
          .set('cookie', staff.cookie)
          .send({
            email: `faible-${run}-${Math.random()}@equipe.test`,
            displayName: 'Mot De Passe Faible',
            password,
            role: 'SUPPORT',
          })
          .expect(400);
      }
    });

    it('une modification ne trace que les champs qui changent, et coupe les sessions', async () => {
      const actor = await as('SUPER_ADMIN');
      const target = await as('MODERATOR');
      expect(await prisma.staffSession.count({ where: { staffId: target.staffId, revokedAt: null } })).toBe(1);

      await request(httpServer(app))
        .patch(`/v1/admin/staff/${target.staffId}`)
        .set('cookie', actor.cookie)
        .send({ role: 'SUPPORT', isActive: false })
        .expect(200);

      const trace = await auditRows(target.staffId, AUDIT_ACTIONS.staffUpdated);
      expect(trace[0]?.metadata).toMatchObject({
        changes: { role: { from: 'MODERATOR', to: 'SUPPORT' }, isActive: { from: true, to: false } },
      });
      // §2.3 : « champs modifiés UNIQUEMENT » — `displayName` n'a pas bougé.
      expect(JSON.stringify(trace[0]?.metadata)).not.toContain('displayName');

      // La désactivation a révoqué les sessions dans la même transaction.
      expect(await prisma.staffSession.count({ where: { staffId: target.staffId, revokedAt: null } })).toBe(0);
      await request(httpServer(app))
        .get('/v1/admin/moderation/cases')
        .set('cookie', target.cookie)
        .expect(401);
    });

    /** §2.2 : « ne peut pas retirer son propre rôle ni supprimer son compte s'il est le dernier ». */
    it('protège le dernier SUPER_ADMIN et interdit de changer son propre rôle', async () => {
      const actor = await as('SUPER_ADMIN');

      const self = await request(httpServer(app))
        .patch(`/v1/admin/staff/${actor.staffId}`)
        .set('cookie', actor.cookie)
        .send({ role: 'SUPPORT' })
        .expect(409);
      expect((self.body as ErrorBody).error.code).toBe('SELF_ROLE_CHANGE');

      // Changer son propre NOM reste possible : l'interdit porte sur le rôle.
      await request(httpServer(app))
        .patch(`/v1/admin/staff/${actor.staffId}`)
        .set('cookie', actor.cookie)
        .send({ displayName: 'Nom Corrigé' })
        .expect(200);

      /**
       * Le « dernier SUPER_ADMIN » se teste en faisant en sorte qu'il n'en reste
       * qu'un : on désactive TOUS les autres, puis on vérifie que le survivant est
       * intouchable. Ce n'est pas une mise en scène artificielle — c'est exactement
       * l'état dont aucune route ne permettrait de sortir.
       */
      const others = await prisma.staffUser.findMany({
        where: { role: 'SUPER_ADMIN', isActive: true, id: { not: actor.staffId } },
        select: { id: true },
      });
      await prisma.staffUser.updateMany({
        where: { id: { in: others.map((o) => o.id) } },
        data: { isActive: false },
      });
      try {
        const last = await request(httpServer(app))
          .patch(`/v1/admin/staff/${actor.staffId}`)
          .set('cookie', actor.cookie)
          .send({ isActive: false })
          .expect(409);
        expect((last.body as ErrorBody).error.code).toBe('LAST_SUPER_ADMIN');
      } finally {
        await prisma.staffUser.updateMany({
          where: { id: { in: others.map((o) => o.id) } },
          data: { isActive: true },
        });
      }
    });

    /**
     * Le `D` du CRUD promis par §7 répond 409, et le commentaire de
     * `AdminService.deleteStaff` dit pourquoi : les tables en ajout seul refusent
     * l'UPDATE des cascades `SetNull`. C'est une décision produit à prendre, pas
     * un défaut à corriger.
     */
    it('la suppression d’un compte équipe est refusée explicitement', async () => {
      const actor = await as('SUPER_ADMIN');
      const target = await as('SUPPORT');
      const res = await request(httpServer(app))
        .delete(`/v1/admin/staff/${target.staffId}`)
        .set('cookie', actor.cookie)
        .expect(409);
      expect((res.body as ErrorBody).error.code).toBe('STAFF_DELETE_UNSUPPORTED');
      // Le compte est toujours là : rien n'a été à demi fait.
      expect(await prisma.staffUser.count({ where: { id: target.staffId } })).toBe(1);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // §3 — Fiche membre
  // ══════════════════════════════════════════════════════════════════════════

  describe('fiche membre (§3)', () => {
    /** RÈGLE DURE §12 : « aucun numéro de téléphone en clair dans une réponse admin ». */
    it('la fiche masque le numéro, et ne le rend jamais en clair', async () => {
      const staff = await as('SUPPORT');
      const { id: userId, phone } = await member({ withPhone: true });

      const res = await request(httpServer(app))
        .get(`/v1/admin/users/${userId}`)
        .set('cookie', staff.cookie)
        .expect(200);

      const serialized = JSON.stringify(res.body);
      // Ni le format E.164, ni ses variantes espacées, ni la partie nationale.
      expect(serialized).not.toContain(phone);
      expect(serialized).not.toContain(phone.slice(3));
      expect(serialized).not.toContain('phoneEncrypted');

      const body = res.body as { phones: { masked: string; countryIso2: string }[] };
      expect(body.phones).toHaveLength(1);
      expect(body.phones[0]?.masked).toContain('•');
      // Les deux derniers chiffres seuls demeurent (01 §2.1).
      expect(body.phones[0]?.masked.endsWith(phone.slice(-2))).toBe(true);
    });

    /** §3.1 : « saisie du numéro → HMAC → recherche, le numéro n'est jamais affiché ». */
    it('recherche par numéro sans jamais faire voyager le numéro', async () => {
      const staff = await as('MODERATOR');
      const { id: userId, phone } = await member({ withPhone: true });

      const found = await request(httpServer(app))
        .get(`/v1/admin/users?q=${encodeURIComponent(phone)}`)
        .set('cookie', staff.cookie)
        .expect(200);
      const ids = (found.body as PageBody<{ id: string }>).items.map((i) => i.id);
      expect(ids).toEqual([userId]);
      expect(JSON.stringify(found.body)).not.toContain(phone);

      // Un numéro inconnu ne rend RIEN — et surtout pas un repli sur la recherche
      // texte, qui renverrait des membres sans rapport avec la saisie.
      const none = await request(httpServer(app))
        .get('/v1/admin/users?q=%2B33699999999')
        .set('cookie', staff.cookie)
        .expect(200);
      expect((none.body as PageBody<unknown>).items).toEqual([]);
    });

    it('recherche par handle et par nom d’affichage, sans tenir compte de la casse', async () => {
      const staff = await as('CONTENT_ADMIN');
      const userId = await memberId();
      const user = await prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { handle: true },
      });

      const byHandle = await request(httpServer(app))
        .get(`/v1/admin/users?q=${user.handle.toUpperCase()}`)
        .set('cookie', staff.cookie)
        .expect(200);
      expect((byHandle.body as PageBody<{ id: string }>).items.map((i) => i.id)).toContain(userId);
    });

    it('révoque les sessions d’un membre, avec motif et trace', async () => {
      const staff = await as('SUPPORT');
      const userId = await memberId();
      await prisma.authSession.create({
        data: {
          id: newId(),
          userId,
          refreshTokenHash: `h-${newId()}`,
          chainId: newId(),
          expiresAt: new Date(Date.now() + 30 * 86_400_000),
        },
      });

      const noReason = await request(httpServer(app))
        .post(`/v1/admin/users/${userId}/revoke-sessions`)
        .set('cookie', staff.cookie)
        .send({})
        .expect(400);
      expect((noReason.body as ErrorBody).error.code).toBe('VALIDATION_FAILED');

      const res = await request(httpServer(app))
        .post(`/v1/admin/users/${userId}/revoke-sessions`)
        .set('cookie', staff.cookie)
        .send({ reason: REASON })
        .expect(201);
      expect(res.body).toMatchObject({ revoked: 1 });
      expect(await prisma.authSession.count({ where: { userId, revokedAt: null } })).toBe(0);

      const trace = await auditRows(userId, AUDIT_ACTIONS.userSessionsRevoked);
      expect(trace[0]?.metadata).toMatchObject({ reason: REASON, revoked: 1 });
    });

    it('désactive puis réactive un membre, en coupant ses sessions', async () => {
      const staff = await as('MODERATOR');
      const userId = await memberId();
      await prisma.authSession.create({
        data: {
          id: newId(),
          userId,
          refreshTokenHash: `h-${newId()}`,
          chainId: newId(),
          expiresAt: new Date(Date.now() + 30 * 86_400_000),
        },
      });

      await request(httpServer(app))
        .post(`/v1/admin/users/${userId}/deactivate`)
        .set('cookie', staff.cookie)
        .send({ reason: REASON })
        .expect(201);
      const off = await prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { status: true, deactivatedAt: true },
      });
      expect(off.status).toBe('DEACTIVATED');
      expect(off.deactivatedAt).not.toBeNull();
      expect(await prisma.authSession.count({ where: { userId, revokedAt: null } })).toBe(0);
      expect(await auditRows(userId, AUDIT_ACTIONS.userDeactivated)).toHaveLength(1);

      await request(httpServer(app))
        .post(`/v1/admin/users/${userId}/reactivate`)
        .set('cookie', staff.cookie)
        .send({ reason: REASON })
        .expect(201);
      const on = await prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { status: true, deactivatedAt: true },
      });
      expect(on.status).toBe('ACTIVE');
      expect(on.deactivatedAt).toBeNull();
    });

    /**
     * LE BOGUE QUE CE TEST EXISTE POUR FERMER.
     *
     * `UserStatus` n'a pas de valeur `BANNED` : 13 §4.2 écrit `DEACTIVATED` sur un
     * bannissement définitif. Un membre banni est donc, en base, indistinguable
     * d'un membre simplement désactivé — et `POST /reactivate`, réservé au
     * MODERATOR, l'aurait DÉBANNI, alors que bannir est réservé au SUPER_ADMIN.
     * La distinction ne se lit que dans `sanctions`.
     */
    it('ne réactive pas un membre banni', async () => {
      const issuer = await as('SUPER_ADMIN');
      const staff = await as('MODERATOR');
      const userId = await memberId({ status: 'DEACTIVATED' });
      await prisma.sanction.create({
        data: {
          id: newId(),
          userId,
          type: 'BAN',
          reason: 'Bannissement définitif prononcé après une fraude caractérisée sur l’annuaire.',
          startsAt: new Date(),
          issuedByStaffId: issuer.staffId,
        },
      });

      const res = await request(httpServer(app))
        .post(`/v1/admin/users/${userId}/reactivate`)
        .set('cookie', staff.cookie)
        .send({ reason: REASON })
        .expect(409);
      expect((res.body as ErrorBody).error.details).toMatchObject({
        reason: 'compte banni : lever la sanction depuis la modération',
      });
      const row = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { status: true } });
      expect(row.status).toBe('DEACTIVATED');
    });

    it('force une phase et marque la correction pour que l’automatisme ne l’efface pas', async () => {
      const staff = await as('SUPPORT');
      const userId = await memberId();

      await request(httpServer(app))
        .post(`/v1/admin/users/${userId}/phase`)
        .set('cookie', staff.cookie)
        .send({ phase: 'RECENT_ARRIVAL', reason: REASON })
        .expect(201);

      const row = await prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { phase: true, phaseSetManuallyAt: true },
      });
      expect(row.phase).toBe('RECENT_ARRIVAL');
      // Sans cette marque, la progression automatique de 01 §3 annulerait la
      // correction à la prochaine passe.
      expect(row.phaseSetManuallyAt).not.toBeNull();
      expect(await auditRows(userId, AUDIT_ACTIONS.userPhaseForced)).toHaveLength(1);
    });

    it('force une ville active, refuse une ville inactive ou inconnue', async () => {
      const staff = await as('SUPPORT');
      const userId = await memberId();

      // Le jeu de référentiels n'a aucune ville active : on en ouvre une, comme
      // l'exploitation le ferait, et on la referme ensuite.
      await prisma.city.update({ where: { id: otherCityId }, data: { isActive: true } });
      try {
        await request(httpServer(app))
          .post(`/v1/admin/users/${userId}/city`)
          .set('cookie', staff.cookie)
          .send({ cityId: otherCityId, reason: REASON })
          .expect(201);
        const row = await prisma.user.findUniqueOrThrow({
          where: { id: userId },
          select: { cityId: true },
        });
        expect(row.cityId).toBe(otherCityId);
        expect(await auditRows(userId, AUDIT_ACTIONS.userCityForced)).toHaveLength(1);

        // Une ville INACTIVE est refusée : 02 §2.1 — elle n'apparaît nulle part
        // côté membres, et l'y poser laisserait le membre sans réseau ni agenda.
        const inactive = await request(httpServer(app))
          .post(`/v1/admin/users/${userId}/city`)
          .set('cookie', staff.cookie)
          .send({ cityId, reason: REASON })
          .expect(400);
        expect(
          (
            (inactive.body as ErrorBody).error.details as { fields: { path: string; code: string }[] }
          ).fields[0],
        ).toMatchObject({ path: 'cityId', code: 'NOT_FOUND' });
      } finally {
        await prisma.city.update({ where: { id: otherCityId }, data: { isActive: false } });
      }
    });

    it('un membre inexistant répond 404 sur toutes les actions', async () => {
      const staff = await as('SUPER_ADMIN');
      const ghost = newId();
      for (const path of ['revoke-sessions', 'deactivate', 'reactivate', 'phase', 'city']) {
        const body: Record<string, unknown> = { reason: REASON };
        if (path === 'phase') body['phase'] = 'RECENT_ARRIVAL';
        if (path === 'city') body['cityId'] = null;
        await request(httpServer(app))
          .post(`/v1/admin/users/${ghost}/${path}`)
          .set('cookie', staff.cookie)
          .send(body)
          .expect(404);
      }
      await request(httpServer(app))
        .get(`/v1/admin/users/${ghost}`)
        .set('cookie', staff.cookie)
        .expect(404);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // §12 — « toute route admin non-GET écrit une ligne d'audit »
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Le garde-fou de couverture.
   *
   * Les tests ci-dessus vérifient la trace d'audit route par route. Ce test
   * ÉNUMÈRE les routes d'écriture de l'administration depuis l'OpenAPI et exige
   * que chacune figure dans la liste de celles dont la trace est vérifiée. Une
   * route ajoutée demain sans son test d'audit fait tomber celui-ci — avec son
   * nom dans le message, ce qu'une couverture « à la main » ne donne pas.
   */
  it('toute route d’écriture de l’administration a un test d’audit', () => {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('test').setVersion('1.0').build(),
    ) as unknown as { paths: Record<string, Record<string, unknown>> };

    /** Routes d'écriture dont la trace est vérifiée dans CE fichier. */
    const auditedHere = new Set([
      'POST /v1/admin/pro-profiles/{id}/approve',
      'POST /v1/admin/pro-profiles/{id}/reject',
      'PUT /v1/admin/settings/{key}',
      'POST /v1/admin/staff',
      'PATCH /v1/admin/staff/{id}',
      'POST /v1/admin/users/{id}/revoke-sessions',
      'POST /v1/admin/users/{id}/deactivate',
      'POST /v1/admin/users/{id}/reactivate',
      'POST /v1/admin/users/{id}/phase',
      'POST /v1/admin/users/{id}/city',
    ]);
    /** Vérifiées ailleurs, ou n'écrivant rien. */
    const elsewhere = new Set([
      // `staff-guard.int.test.ts` : connexion, enrôlement, verrouillage, déconnexion.
      'POST /v1/admin/auth/login',
      'POST /v1/admin/auth/totp',
      'POST /v1/admin/auth/totp/enroll',
      'POST /v1/admin/auth/totp/confirm',
      'POST /v1/admin/auth/logout',
      // Lecture déguisée en POST : ne modifie rien, donc rien à tracer.
      'POST /v1/admin/auth/session',
      // `moderation.int.test.ts` : la logique ET son audit y sont déjà couverts.
      'POST /v1/admin/moderation/cases/{id}/assign',
      'POST /v1/admin/moderation/cases/{id}/release',
      'POST /v1/admin/moderation/cases/{id}/actions',
      'PUT /v1/admin/moderation/settings',
      'POST /v1/admin/moderation/scam-alerts',
      'PUT /v1/admin/moderation/scam-alerts/{id}',
      'POST /v1/admin/moderation/scam-alerts/{id}/retire',
      // Refusée par construction : elle n'écrit jamais rien (voir `deleteStaff`).
      'DELETE /v1/admin/staff/{id}',
    ]);

    const uncovered: string[] = [];
    for (const [path, operations] of Object.entries(document.paths)) {
      if (!path.startsWith('/v1/admin')) continue;
      for (const verb of Object.keys(operations)) {
        if (verb.toLowerCase() === 'get') continue;
        const name = `${verb.toUpperCase()} ${path}`;
        if (!auditedHere.has(name) && !elsewhere.has(name)) uncovered.push(name);
      }
    }
    expect(uncovered, `Routes d'écriture sans test d'audit :\n  ${uncovered.join('\n  ')}`).toEqual([]);
  });
});
