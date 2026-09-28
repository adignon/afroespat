import type { Server } from 'node:http';
import type { ExecutionContext, INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId } from '@app/db';
import {
  STAFF_IDLE_MINUTES,
  STAFF_MAX_FAILED_ATTEMPTS,
  STAFF_SESSION_COOKIE,
  STAFF_SESSION_HOURS,
  type StaffRoleValue,
} from '@app/shared';
import { AppModule } from '../../../app.module';
import { CryptoService } from '../../../common/crypto.service';
import { ApiErrorFilter } from '../../../common/error.filter';
import { PrismaService } from '../../../common/prisma.service';
import { STAFF_ROLE_KEY } from '../../../common/staff-role.decorator';
import { StaffGuard, ipInCidr } from '../../../common/staff.guard';
import { TokenService } from '../../../common/token.service';
import { hashStaffPassword } from '../staff-password';
import { generateTotpSecret, totpCodeFor, totpCounter } from '../totp';

/**
 * Le garde d'équipe, par HTTP — 15-administration.md §2.1, §2.2, §12.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ La règle dure que ce fichier existe pour prouver (15 §2.1, 00 §7.4) :    │
 * │                                                                          │
 * │   « Les comptes équipe et les comptes membres sont HERMÉTIQUES. Un jeton  │
 * │     membre ne doit jamais ouvrir une route d'équipe, et réciproquement. » │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Les tests passent par HTTP et non par le service, contrairement au reste de la
 * suite. C'est indispensable ici : l'hermétisme est une propriété de la CHAÎNE —
 * deux gardes globaux, deux transports, deux déclarations de route — et aucun
 * appel de service ne la met en jeu. Un test qui appellerait `AdminService`
 * directement prouverait que la méthode marche, pas qu'elle est inatteignable
 * avec le mauvais jeton.
 *
 * ── Ce qui a été éprouvé par MUTATION ───────────────────────────────────────
 *
 * Chaque règle dure a été cassée dans le code, le test devait tomber, puis la
 * règle a été restaurée. Résultats consignés dans le rapport de livraison :
 *   · `AuthGuard` : retirer le court-circuit `staffRoles !== undefined` → les
 *     routes d'équipe tombent en 403 « route sans capacité déclarée » ;
 *   · `StaffGuard.assertNoMemberToken` : la neutraliser → le test du jeton membre
 *     sur une route d'équipe tombe (401 attendu, on obtient 200) ;
 *   · `StaffGuard` contrôle de rôle : `return true` au lieu de `fail` → le test de
 *     rôle tombe ;
 *   · TOTP : rendre une session depuis `/auth/login` → le test « aucune session
 *     sans TOTP » tombe ;
 *   · audit : retirer `this.record(...)` de `putSetting` → le test d'audit tombe.
 *
 * ── Nettoyage ───────────────────────────────────────────────────────────────
 *
 * `audit_logs` est en AJOUT SEUL : le déclencheur refuse DELETE. Les lignes
 * écrites par ce fichier RESTENT, et c'est le comportement voulu (§2.3 : « aucune
 * suppression possible »). Les comptes équipe, eux, sont supprimables ICI parce
 * qu'`audit_logs.actor_id` n'a AUCUNE clé étrangère vers `staff_users` — la table
 * en ajout seul ne cascade donc pas. Ce ne serait pas vrai d'un compte ayant pris
 * une action de modération : `moderation_actions.staff_id` est en `SetNull`, et ce
 * SetNull est un UPDATE que le déclencheur refuse. La suppression est donc tentée
 * et le compte simplement désactivé si elle échoue.
 */

interface ErrorBody {
  error: { code: string; message: string; details?: Record<string, unknown> };
}

function httpServer(app: INestApplication): Server {
  return app.getHttpServer() as Server;
}

/** Le cookie `dp_staff` tel qu'un client l'enverrait. */
function staffCookie(token: string): string {
  return `${STAFF_SESSION_COOKIE}=${token}`;
}

function setCookieHeader(response: request.Response): string[] {
  const raw = response.headers['set-cookie'];
  if (raw === undefined) return [];
  return Array.isArray(raw) ? raw : [raw];
}

const PASSWORD = 'un-mot-de-passe-equipe-suffisamment-long';

describe('garde d’équipe et hermétisme des deux domaines (15 §2.1)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let crypto: CryptoService;
  let tokens: TokenService;

  const createdStaff: string[] = [];
  const createdUsers: string[] = [];
  const run = Math.random().toString(36).slice(2, 8);
  let counter = 0;

  let originCountryId: string;
  let cityId: string;

  /**
   * Un compte équipe. `enrolled: false` laisse `totp_secret_encrypted` VIDE, ce
   * qui est la façon dont l'absence d'enrôlement s'écrit faute de la colonne
   * `totp_enrolled_at` annoncée par §6.
   */
  async function staffAccount(
    role: StaffRoleValue,
    options: { enrolled?: boolean; isActive?: boolean } = {},
  ): Promise<{ id: string; email: string; secret: string | null }> {
    counter += 1;
    const id = newId();
    const email = `garde-${run}-${counter}@equipe.test`;
    const secret = options.enrolled === false ? null : generateTotpSecret();
    await prisma.staffUser.create({
      data: {
        id,
        email,
        displayName: `Équipe ${role} ${counter}`,
        passwordHash: await hashStaffPassword(PASSWORD),
        totpSecretEncrypted:
          secret === null ? new Uint8Array(0) : crypto.encryptContent(secret),
        role,
        isActive: options.isActive ?? true,
      },
    });
    createdStaff.push(id);
    return { id, email, secret };
  }

  /**
   * Une session d'équipe posée DIRECTEMENT en base.
   *
   * Pourquoi pas le parcours HTTP partout : un code TOTP ne vaut qu'une fois
   * (RFC 6238 §5.2, et le service le fait respecter). Deux connexions du même
   * compte dans le même pas de trente secondes produiraient le même code, et la
   * seconde serait refusée comme rejeu — un échec de test qui n'aurait rien à voir
   * avec ce qu'on mesure. Le garde, lui, ne lit que la base ; ce raccourci ne
   * contourne donc aucun contrôle de garde. Le parcours complet est éprouvé
   * séparément, par HTTP, dans « connexion en deux temps ».
   */
  async function openSession(
    staffId: string,
    options: { expiresAt?: Date; revoked?: boolean; createdAt?: Date } = {},
  ): Promise<string> {
    const token = `s-${run}-${newId()}`;
    await prisma.staffSession.create({
      data: {
        id: newId(),
        staffId,
        tokenHash: crypto.hashToken(token),
        expiresAt: options.expiresAt ?? new Date(Date.now() + STAFF_IDLE_MINUTES * 60_000),
        ...(options.createdAt === undefined ? {} : { createdAt: options.createdAt }),
        ...(options.revoked === true ? { revokedAt: new Date() } : {}),
      },
    });
    return token;
  }

  /** Un membre, et son jeton d'accès signé — le domaine d'en face. */
  async function memberToken(): Promise<{ userId: string; token: string }> {
    counter += 1;
    const userId = newId();
    await prisma.user.create({
      data: {
        id: userId,
        handle: `gd${run}${counter}${userId.slice(-6)}`,
        displayName: `Membre ${counter}`,
        phase: 'SETTLED',
        verificationLevel: 'L2',
        originCountryId,
        cityId,
        plan: 'FREE',
        status: 'ACTIVE',
      },
    });
    createdUsers.push(userId);
    const token = tokens.sign({
      sub: userId,
      sid: newId(),
      level: 'L2',
      plan: 'FREE',
      status: 'ACTIVE',
      exp: Math.floor(Date.now() / 1000) + 900,
    });
    return { userId, token };
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('v1');
    app.useGlobalFilters(new ApiErrorFilter());
    // Sans `cookie-parser`, `request.cookies` est indéfini et TOUTES les routes
    // d'équipe répondraient 401 — un symptôme qui ressemble à une session expirée.
    // Le garde a un repli sur l'en-tête brut, et ce test le couvre donc deux fois.
    app.use(cookieParser());
    await app.init();

    prisma = app.get(PrismaService);
    crypto = app.get(CryptoService);
    tokens = app.get(TokenService);

    const origin = await prisma.country.findFirstOrThrow({
      where: { isActive: true, kind: { in: ['ORIGIN', 'BOTH'] } },
      select: { id: true },
    });
    originCountryId = origin.id;
    // `isActive` n'est PAS exigé ici : le jeu de référentiels chargé sur app_a2
    // n'a aucune ville active (02 §2.1 — l'ouverture ville par ville est une
    // décision d'exploitation, pas un état de départ). Ce test n'a besoin que
    // d'une ville existante pour rattacher un membre.
    const city = await prisma.city.findFirstOrThrow({
      orderBy: { slug: 'asc' },
      select: { id: true },
    });
    cityId = city.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: createdUsers } } });
    for (const id of createdStaff) {
      try {
        await prisma.staffUser.delete({ where: { id } });
      } catch {
        // Un compte qui a agi ne peut pas disparaître (voir l'en-tête). On le
        // désactive, ce qui est exactement ce que la production ferait.
        await prisma.staffUser.update({ where: { id }, data: { isActive: false } });
      }
    }
    await app?.close();
  });

  // ══════════════════════════════════════════════════════════════════════════
  // RÈGLE DURE — hermétisme, dans les deux sens
  // ══════════════════════════════════════════════════════════════════════════

  it('un jeton MEMBRE sur une route d’équipe est refusé', async () => {
    const { token } = await memberToken();
    const res = await request(httpServer(app))
      .get('/v1/admin/settings')
      .set('authorization', `Bearer ${token}`)
      .expect(401);
    expect((res.body as ErrorBody).error.code).toBe('CROSS_DOMAIN_TOKEN');
  });

  /**
   * Le cas le plus dangereux : un jeton membre valide ET une session d'équipe
   * valide. Sans refus explicite, la requête passerait — et le code fautif (un
   * intercepteur du front membres hérité par l'admin) continuerait de « marcher »,
   * liant les deux domaines en silence.
   */
  it('un jeton membre invalide la requête MÊME avec une session d’équipe valide', async () => {
    const staff = await staffAccount('SUPER_ADMIN');
    const session = await openSession(staff.id);
    const { token } = await memberToken();

    // Sans le jeton membre : ça passe.
    await request(httpServer(app))
      .get('/v1/admin/settings')
      .set('cookie', staffCookie(session))
      .expect(200);

    // Avec : refusé.
    const res = await request(httpServer(app))
      .get('/v1/admin/settings')
      .set('cookie', staffCookie(session))
      .set('authorization', `Bearer ${token}`)
      .expect(401);
    expect((res.body as ErrorBody).error.code).toBe('CROSS_DOMAIN_TOKEN');
  });

  it('un jeton d’ÉQUIPE sur une route membre est refusé', async () => {
    const staff = await staffAccount('SUPER_ADMIN');
    const session = await openSession(staff.id);

    // En en-tête `Authorization` : le jeton d'équipe n'est pas un JWT, il ne se
    // vérifie pas, et la route membre répond comme à un visiteur.
    const asBearer = await request(httpServer(app))
      .get('/v1/me')
      .set('authorization', `Bearer ${session}`)
      .expect(401);
    expect((asBearer.body as ErrorBody).error.code).toBe('UNAUTHENTICATED');

    // En cookie : une route membre ne lit pas `dp_staff`, donc rien n'est accordé.
    const asCookie = await request(httpServer(app))
      .get('/v1/me')
      .set('cookie', staffCookie(session))
      .expect(401);
    expect((asCookie.body as ErrorBody).error.code).toBe('UNAUTHENTICATED');
  });

  /**
   * Le sens inverse du précédent : glisser un jeton MEMBRE dans le cookie
   * d'équipe. Il n'y a aucune ligne de `staff_sessions` dont le hachage y
   * corresponde, donc rien ne s'ouvre — et surtout, le garde ne tente jamais de le
   * lire comme un JWT.
   */
  it('un jeton membre placé dans le cookie d’équipe n’ouvre rien', async () => {
    const { token } = await memberToken();
    const res = await request(httpServer(app))
      .get('/v1/admin/settings')
      .set('cookie', staffCookie(token))
      .expect(401);
    // `STAFF_SESSION_REQUIRED` et non `CROSS_DOMAIN_TOKEN` : rien n'a été présenté
    // en `Authorization`, il n'y a donc pas de confusion de domaine à signaler,
    // seulement une session inconnue.
    expect((res.body as ErrorBody).error.code).toBe('STAFF_SESSION_REQUIRED');
  });

  it('sans cookie, toute route d’équipe répond 401', async () => {
    for (const path of ['/v1/admin/settings', '/v1/admin/staff', '/v1/admin/moderation/cases']) {
      const res = await request(httpServer(app)).get(path).expect(401);
      expect((res.body as ErrorBody).error.code).toBe('STAFF_SESSION_REQUIRED');
    }
  });

  /**
   * La déclaration de route, contrôlée sur le document OpenAPI complet.
   *
   * C'est le troisième pilier de l'hermétisme : aucune route ne doit déclarer à la
   * fois une capacité de membre et un rôle d'équipe. Le garde refuse ce cas à
   * l'exécution ; ce test le refuse à la construction, sur les 200 et quelques
   * routes de l'application, y compris celles que personne n'a encore écrites.
   */
  it('aucune route ne déclare à la fois une capacité membre et un rôle d’équipe', () => {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('test').setVersion('1.0').build(),
    ) as unknown as {
      paths: Record<string, Record<string, { 'x-capability'?: string; 'x-staff-role'?: string }>>;
    };

    const mixed: string[] = [];
    const staffRoutes: string[] = [];
    for (const [path, operations] of Object.entries(document.paths)) {
      for (const [verb, op] of Object.entries(operations)) {
        const capability = op['x-capability'];
        const staffRole = op['x-staff-role'];
        if (staffRole === undefined) continue;
        staffRoutes.push(`${verb.toUpperCase()} ${path}`);
        // Le sentinelle `staff:…` est la MÊME information que `x-staff-role` ; une
        // vraie capacité de membre, elle, serait une route mixte.
        if (capability !== undefined && !capability.startsWith('staff:')) {
          mixed.push(`${verb.toUpperCase()} ${path} → ${capability} + ${staffRole}`);
        }
      }
    }
    expect(mixed, `Routes mixtes :\n  ${mixed.join('\n  ')}`).toEqual([]);
    // Garde-fou : si ce compte tombe à zéro, c'est que la découverte de métadonnées
    // a cassé et que le test ci-dessus ne vérifie plus rien.
    expect(staffRoutes.length).toBeGreaterThan(20);
  });

  it('toute route sous /v1/admin déclare un rôle ou est une route de connexion', () => {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('test').setVersion('1.0').build(),
    ) as unknown as {
      paths: Record<string, Record<string, { 'x-capability'?: string; 'x-staff-role'?: string }>>;
    };
    /** Les seules routes d'équipe sans rôle : elles créent la session. */
    const loginRoutes = new Set([
      'POST /v1/admin/auth/login',
      'POST /v1/admin/auth/totp',
      'POST /v1/admin/auth/totp/enroll',
      'POST /v1/admin/auth/totp/confirm',
    ]);

    const naked: string[] = [];
    for (const [path, operations] of Object.entries(document.paths)) {
      if (!path.startsWith('/v1/admin')) continue;
      for (const verb of Object.keys(operations)) {
        const name = `${verb.toUpperCase()} ${path}`;
        const op = operations[verb] as { 'x-staff-role'?: string };
        if (op['x-staff-role'] === undefined && !loginRoutes.has(name)) naked.push(name);
      }
    }
    expect(naked, `Routes admin sans rôle déclaré :\n  ${naked.join('\n  ')}`).toEqual([]);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // §2.2 — Le rôle
  // ══════════════════════════════════════════════════════════════════════════

  it('un rôle hors périmètre reçoit 403, un rôle du périmètre passe', async () => {
    const support = await staffAccount('SUPPORT');
    const superAdmin = await staffAccount('SUPER_ADMIN');

    // `GET /admin/staff` est réservée au SUPER_ADMIN (§2.2).
    const refused = await request(httpServer(app))
      .get('/v1/admin/staff')
      .set('cookie', staffCookie(await openSession(support.id)))
      .expect(403);
    const body = refused.body as ErrorBody;
    expect(body.error.code).toBe('STAFF_ROLE_REQUIRED');
    expect(body.error.details).toMatchObject({ role: 'SUPPORT' });

    await request(httpServer(app))
      .get('/v1/admin/staff')
      .set('cookie', staffCookie(await openSession(superAdmin.id)))
      .expect(200);
  });

  it('la file de modération est fermée au SUPPORT et ouverte au MODERATOR', async () => {
    const support = await staffAccount('SUPPORT');
    const moderator = await staffAccount('MODERATOR');

    await request(httpServer(app))
      .get('/v1/admin/moderation/cases')
      .set('cookie', staffCookie(await openSession(support.id)))
      .expect(403);

    await request(httpServer(app))
      .get('/v1/admin/moderation/cases')
      .set('cookie', staffCookie(await openSession(moderator.id)))
      .expect(200);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // §2.1 — La session
  // ══════════════════════════════════════════════════════════════════════════

  it('une session révoquée, expirée, ou d’un compte désactivé ne passe pas', async () => {
    const staff = await staffAccount('SUPER_ADMIN');

    const revoked = await openSession(staff.id, { revoked: true });
    await request(httpServer(app)).get('/v1/admin/settings').set('cookie', staffCookie(revoked)).expect(401);

    const expired = await openSession(staff.id, { expiresAt: new Date(Date.now() - 1000) });
    await request(httpServer(app)).get('/v1/admin/settings').set('cookie', staffCookie(expired)).expect(401);

    const inactive = await staffAccount('SUPER_ADMIN', { isActive: false });
    const live = await openSession(inactive.id);
    await request(httpServer(app)).get('/v1/admin/settings').set('cookie', staffCookie(live)).expect(401);
  });

  /**
   * §2.1 : « renouvellement à l'activité, déconnexion à 30 min d'inactivité »,
   * dans une session de 8 h.
   *
   * `staff_sessions` n'a pas de `last_seen_at` : `expires_at` porte l'échéance
   * d'inactivité, et la borne absolue se déduit de `created_at + 8 h`. Le test
   * vérifie les DEUX moitiés — sans la seconde, une session éternellement active
   * ne s'arrêterait jamais, ce qui est précisément la faute que la borne absolue
   * existe pour empêcher.
   */
  it('la session glisse à l’activité, sans jamais dépasser 8 h depuis sa création', async () => {
    const staff = await staffAccount('SUPER_ADMIN');

    // Créée il y a une minute, échéance dans deux minutes : l'activité doit la
    // repousser vers +30 min.
    const fresh = await openSession(staff.id, {
      createdAt: new Date(Date.now() - 60_000),
      expiresAt: new Date(Date.now() + 120_000),
    });
    await request(httpServer(app)).get('/v1/admin/settings').set('cookie', staffCookie(fresh)).expect(200);
    const slid = await prisma.staffSession.findUniqueOrThrow({
      where: { tokenHash: crypto.hashToken(fresh) },
      select: { expiresAt: true },
    });
    expect(slid.expiresAt.getTime()).toBeGreaterThan(Date.now() + (STAFF_IDLE_MINUTES - 2) * 60_000);

    // Créée il y a 7 h 50 : la borne absolue est dans dix minutes, et l'activité ne
    // doit PAS la repousser à trente.
    const createdAt = new Date(Date.now() - (STAFF_SESSION_HOURS * 60 - 10) * 60_000);
    const old = await openSession(staff.id, {
      createdAt,
      expiresAt: new Date(Date.now() + 60_000),
    });
    await request(httpServer(app)).get('/v1/admin/settings').set('cookie', staffCookie(old)).expect(200);
    const capped = await prisma.staffSession.findUniqueOrThrow({
      where: { tokenHash: crypto.hashToken(old) },
      select: { expiresAt: true },
    });
    const absolute = createdAt.getTime() + STAFF_SESSION_HOURS * 3_600_000;
    expect(capped.expiresAt.getTime()).toBe(absolute);
    expect(capped.expiresAt.getTime()).toBeLessThan(Date.now() + STAFF_IDLE_MINUTES * 60_000);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // RÈGLE DURE — TOTP obligatoire (§2.1, §12)
  // ══════════════════════════════════════════════════════════════════════════

  describe('connexion en deux temps', () => {
    it('le mot de passe seul ne pose AUCUN cookie et n’ouvre aucune session', async () => {
      const staff = await staffAccount('SUPER_ADMIN');
      const res = await request(httpServer(app))
        .post('/v1/admin/auth/login')
        .send({ email: staff.email, password: PASSWORD })
        .expect(201);

      expect(setCookieHeader(res)).toEqual([]);
      expect(res.body).toMatchObject({ enrollmentRequired: false });
      expect(res.body).toHaveProperty('challenge');
      expect(await prisma.staffSession.count({ where: { staffId: staff.id } })).toBe(0);

      // Et le défi ne vaut rien sur une route d'équipe.
      await request(httpServer(app))
        .get('/v1/admin/settings')
        .set('cookie', staffCookie((res.body as { challenge: string }).challenge))
        .expect(401);
    });

    it('le code TOTP juste ouvre la session ; le faux ne l’ouvre pas', async () => {
      const staff = await staffAccount('SUPER_ADMIN');
      const login = await request(httpServer(app))
        .post('/v1/admin/auth/login')
        .send({ email: staff.email, password: PASSWORD })
        .expect(201);
      const challenge = (login.body as { challenge: string }).challenge;

      const wrong = await request(httpServer(app))
        .post('/v1/admin/auth/totp')
        .send({ challenge, code: '000000' })
        .expect(401);
      expect((wrong.body as ErrorBody).error.code).toBe('STAFF_TOTP_INVALID');
      expect(setCookieHeader(wrong)).toEqual([]);

      const code = totpCodeFor(staff.secret as string, totpCounter());
      const ok = await request(httpServer(app))
        .post('/v1/admin/auth/totp')
        .send({ challenge, code })
        .expect(201);

      const cookies = setCookieHeader(ok);
      expect(cookies.some((c) => c.startsWith(`${STAFF_SESSION_COOKIE}=`))).toBe(true);
      // Le cookie doit être `HttpOnly` et `Strict`, et porté par `/v1/admin` : sans
      // quoi le navigateur l'enverrait aux routes membres, ou un script pourrait le lire.
      const staffCookieLine = cookies.find((c) => c.startsWith(`${STAFF_SESSION_COOKIE}=`)) as string;
      expect(staffCookieLine).toContain('HttpOnly');
      expect(staffCookieLine).toContain('SameSite=Strict');
      expect(staffCookieLine).toContain('Path=/v1/admin');
      // Le jeton n'est JAMAIS rendu dans le corps.
      expect(JSON.stringify(ok.body)).not.toContain('token');

      expect(await prisma.staffSession.count({ where: { staffId: staff.id, revokedAt: null } })).toBe(1);

      // Et la session ainsi obtenue ouvre bien une route de son rôle.
      const token = /dp_staff=([^;]+)/.exec(staffCookieLine)?.[1] as string;
      await request(httpServer(app))
        .get('/v1/admin/staff')
        .set('cookie', staffCookie(decodeURIComponent(token)))
        .expect(200);
    });

    /** RFC 6238 §5.2 : un code accepté ne l'est qu'une fois. */
    it('le même code TOTP ne sert pas deux fois', async () => {
      const staff = await staffAccount('SUPER_ADMIN');
      const code = totpCodeFor(staff.secret as string, totpCounter());

      const first = await request(httpServer(app))
        .post('/v1/admin/auth/login')
        .send({ email: staff.email, password: PASSWORD })
        .expect(201);
      await request(httpServer(app))
        .post('/v1/admin/auth/totp')
        .send({ challenge: (first.body as { challenge: string }).challenge, code })
        .expect(201);

      const second = await request(httpServer(app))
        .post('/v1/admin/auth/login')
        .send({ email: staff.email, password: PASSWORD })
        .expect(201);
      const replayed = await request(httpServer(app))
        .post('/v1/admin/auth/totp')
        .send({ challenge: (second.body as { challenge: string }).challenge, code })
        .expect(401);
      expect((replayed.body as ErrorBody).error.code).toBe('STAFF_TOTP_INVALID');
      expect((replayed.body as ErrorBody).error.details).toMatchObject({ reason: 'code déjà employé' });
    });

    /** §2.1 : « enrôlement forcé à la première connexion ». */
    it('un compte non enrôlé doit s’enrôler avant d’obtenir une session', async () => {
      const staff = await staffAccount('CONTENT_ADMIN', { enrolled: false });
      const login = await request(httpServer(app))
        .post('/v1/admin/auth/login')
        .send({ email: staff.email, password: PASSWORD })
        .expect(201);
      expect(login.body).toMatchObject({ enrollmentRequired: true });
      const challenge = (login.body as { challenge: string }).challenge;

      // Le défi d'enrôlement ne passe PAS par la route du second facteur ordinaire.
      const refused = await request(httpServer(app))
        .post('/v1/admin/auth/totp')
        .send({ challenge, code: '123456' })
        .expect(403);
      expect((refused.body as ErrorBody).error.code).toBe('STAFF_TOTP_ENROLLMENT_REQUIRED');

      const enroll = await request(httpServer(app))
        .post('/v1/admin/auth/totp/enroll')
        .send({ challenge })
        .expect(201);
      const enrolled = enroll.body as { secret: string; otpauthUri: string; challenge: string };
      expect(enrolled.secret).toMatch(/^[A-Z2-7]{32}$/);
      expect(enrolled.otpauthUri).toContain('algorithm=SHA1');
      // Rien n'est encore écrit : tant que le code n'est pas prouvé, le compte
      // reste non enrôlé — sinon un enrôlement abandonné le rendrait inaccessible.
      const before = await prisma.staffUser.findUniqueOrThrow({
        where: { id: staff.id },
        select: { totpSecretEncrypted: true },
      });
      expect(before.totpSecretEncrypted.length).toBe(0);

      const confirm = await request(httpServer(app))
        .post('/v1/admin/auth/totp/confirm')
        .send({ challenge: enrolled.challenge, code: totpCodeFor(enrolled.secret, totpCounter()) })
        .expect(201);
      expect(setCookieHeader(confirm).some((c) => c.startsWith(`${STAFF_SESSION_COOKIE}=`))).toBe(true);

      const after = await prisma.staffUser.findUniqueOrThrow({
        where: { id: staff.id },
        select: { totpSecretEncrypted: true },
      });
      expect(after.totpSecretEncrypted.length).toBeGreaterThan(0);
      // Le secret est CHIFFRÉ au repos : les octets stockés ne sont pas le secret.
      expect(Buffer.from(after.totpSecretEncrypted).toString('utf8')).not.toContain(enrolled.secret);
      expect(crypto.decryptContent(after.totpSecretEncrypted)).toBe(enrolled.secret);

      // Et un compte DÉJÀ enrôlé ne peut pas se réenrôler : ce serait la façon la
      // plus simple de remplacer le second facteur de quelqu'un d'autre.
      const again = await request(httpServer(app))
        .post('/v1/admin/auth/totp/enroll')
        .send({ challenge })
        .expect(409);
      expect((again.body as ErrorBody).error.code).toBe('STAFF_TOTP_ALREADY_ENROLLED');
    });

    it('un défi falsifié ou expiré est refusé', async () => {
      const staff = await staffAccount('SUPER_ADMIN');
      const login = await request(httpServer(app))
        .post('/v1/admin/auth/login')
        .send({ email: staff.email, password: PASSWORD })
        .expect(201);
      const challenge = (login.body as { challenge: string }).challenge;
      const [body, signature] = challenge.split('.') as [string, string];

      for (const forged of [
        `${body}.${signature.slice(0, -1)}x`,
        `${body}x.${signature}`,
        body,
        'nimporte.quoi',
      ]) {
        const res = await request(httpServer(app))
          .post('/v1/admin/auth/totp')
          .send({ challenge: forged, code: '123456' })
          .expect(401);
        expect((res.body as ErrorBody).error.code).toBe('STAFF_CHALLENGE_INVALID');
      }
    });

    it('un mot de passe faux est refusé du même code qu’un email inconnu', async () => {
      const staff = await staffAccount('SUPPORT');
      const wrongPassword = await request(httpServer(app))
        .post('/v1/admin/auth/login')
        .send({ email: staff.email, password: 'ce-nest-pas-le-bon-mot-de-passe' })
        .expect(401);
      const unknownEmail = await request(httpServer(app))
        .post('/v1/admin/auth/login')
        .send({ email: `inconnu-${run}@equipe.test`, password: PASSWORD })
        .expect(401);

      // Le MÊME code : la réponse ne doit pas dire si l'adresse existe (T4 §3).
      expect((wrongPassword.body as ErrorBody).error.code).toBe('STAFF_CREDENTIALS_INVALID');
      expect((unknownEmail.body as ErrorBody).error.code).toBe('STAFF_CREDENTIALS_INVALID');
    });

    /** §2.1 : « 5 échecs → verrouillage 15 minutes ». */
    it('cinq échecs verrouillent le compte, même avec le bon mot de passe ensuite', async () => {
      const staff = await staffAccount('SUPPORT');
      for (let i = 0; i < STAFF_MAX_FAILED_ATTEMPTS; i += 1) {
        await request(httpServer(app))
          .post('/v1/admin/auth/login')
          .send({ email: staff.email, password: `faux-mot-de-passe-${i}` })
          .expect(401);
      }
      const locked = await request(httpServer(app))
        .post('/v1/admin/auth/login')
        .send({ email: staff.email, password: PASSWORD })
        .expect(423);
      expect((locked.body as ErrorBody).error.code).toBe('STAFF_LOCKED');

      // La trace du verrouillage est écrite (§9, `staff.locked`).
      expect(
        await prisma.auditLog.count({ where: { targetId: staff.id, action: 'staff.locked' } }),
      ).toBeGreaterThan(0);
    });

    it('la déconnexion révoque la session et efface le cookie', async () => {
      const staff = await staffAccount('MODERATOR');
      const token = await openSession(staff.id);

      const res = await request(httpServer(app))
        .post('/v1/admin/auth/logout')
        .set('cookie', staffCookie(token))
        .expect(201);
      expect(res.body).toMatchObject({ loggedOut: true });
      expect(setCookieHeader(res).some((c) => c.startsWith(`${STAFF_SESSION_COOKIE}=;`))).toBe(true);

      await request(httpServer(app))
        .get('/v1/admin/moderation/cases')
        .set('cookie', staffCookie(token))
        .expect(401);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // §2.1 — Restriction IP (`admin_allowed_cidrs`)
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * La comparaison de CIDR est testée comme fonction PURE, et la porte du garde
   * sur une instance construite à la main.
   *
   * Pourquoi pas par HTTP : le garde met la liste en cache une minute, et une
   * liste posée par un test resterait active pour les suivants — donc pour toutes
   * les requêtes de ce fichier. C'est exactement le genre d'interférence qui fait
   * échouer un test SANS RAPPORT, en le rendant en plus non reproductible.
   */
  it('compare les CIDR sans rien laisser passer par défaut', () => {
    expect(ipInCidr('10.1.2.3', '10.0.0.0/8')).toBe(true);
    expect(ipInCidr('10.1.2.3', '10.1.2.0/24')).toBe(true);
    expect(ipInCidr('10.1.3.3', '10.1.2.0/24')).toBe(false);
    expect(ipInCidr('192.168.0.1', '10.0.0.0/8')).toBe(false);
    expect(ipInCidr('127.0.0.1', '0.0.0.0/0')).toBe(true);
    expect(ipInCidr('2001:db8::1', '2001:db8::/32')).toBe(true);
    expect(ipInCidr('2001:db9::1', '2001:db8::/32')).toBe(false);
    // Familles différentes : jamais de correspondance.
    expect(ipInCidr('10.0.0.1', '2001:db8::/32')).toBe(false);
    expect(ipInCidr('2001:db8::1', '10.0.0.0/8')).toBe(false);
    // Tout ce qui n'est pas compris FERME la porte.
    for (const bad of ['10.0.0.0', '10.0.0.0/33', '10.0.0.0/abc', 'pas-une-ip/8', '']) {
      expect(ipInCidr('10.0.0.1', bad)).toBe(false);
    }
  });

  it('refuse une IP hors de la liste, et n’applique rien quand la liste est vide', async () => {
    const staff = await staffAccount('SUPER_ADMIN');
    const token = await openSession(staff.id);

    function context(roles: readonly StaffRoleValue[] | undefined, ip: string): ExecutionContext {
      const req = {
        headers: { cookie: staffCookie(token) },
        ip,
        path: '/v1/admin/settings',
        originalUrl: '/v1/admin/settings',
      };
      return {
        getHandler: () => () => undefined,
        getClass: () => class Fake {},
        switchToHttp: () => ({ getRequest: () => req }),
      } as unknown as ExecutionContext;
    }
    function guardWith(cidrs: string[] | null): StaffGuard {
      const reflector = {
        getAllAndOverride: (key: string) =>
          key === STAFF_ROLE_KEY ? (['SUPER_ADMIN'] as const) : undefined,
      } as unknown as Reflector;
      const fakePrisma = {
        staffSession: prisma.staffSession,
        systemSetting: {
          findUnique: () => Promise.resolve(cidrs === null ? null : { value: cidrs }),
        },
      } as unknown as PrismaService;
      return new StaffGuard(reflector, fakePrisma, crypto, tokens);
    }

    // Liste absente : la restriction est FACULTATIVE, rien n'est fermé.
    await expect(guardWith(null).canActivate(context(['SUPER_ADMIN'], '203.0.113.9'))).resolves.toBe(
      true,
    );
    // Liste posée : l'IP dedans passe, celle dehors est refusée.
    await expect(
      guardWith(['203.0.113.0/24']).canActivate(context(['SUPER_ADMIN'], '203.0.113.9')),
    ).resolves.toBe(true);
    await expect(
      guardWith(['203.0.113.0/24']).canActivate(context(['SUPER_ADMIN'], '198.51.100.1')),
    ).rejects.toMatchObject({ code: 'STAFF_IP_NOT_ALLOWED' });
  });
});
