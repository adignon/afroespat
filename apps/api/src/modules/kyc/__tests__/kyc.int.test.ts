import { createHmac } from 'node:crypto';
import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId } from '@app/db';
import { ACCOUNT_LIMITS, STAFF_IDLE_MINUTES, STAFF_SESSION_COOKIE } from '@app/shared';
import { AppModule } from '../../../app.module';
import { CryptoService } from '../../../common/crypto.service';
import { ApiErrorFilter } from '../../../common/error.filter';
import { PrismaService } from '../../../common/prisma.service';
import { loadEnv } from '../../../config/env';
import { FakeSmsProvider, SMS_PROVIDER } from '../../../providers/providers';
import { AuthService } from '../../auth/auth.service';
import { VerificationLevelService } from '../../users/verification-level.service';
import { hashStaffPassword } from '../../admin/staff-password';
import { generateTotpSecret } from '../../admin/totp';
import { KycService } from '../kyc.service';
import { numeroDEpreuve } from '../../../common/__tests__/numeros';

/**
 * Vérification d'identité et fraîcheur du jeton — 01 §2.3, §2.4, §4.3 et T4 §2.
 *
 * TOUT passe par HTTP, et ce n'est pas du zèle : ce qu'on livre ici est autant le
 * GARDE que le service. Un test de service prouverait que le niveau est recalculé ;
 * seul un appel réel prouve que le jeton déjà émis est refusé, ce qui est la moitié
 * qui manquait.
 *
 * L'application est créée avec `rawBody: true`, comme `main.ts` : sans lui, la
 * signature du webhook porterait sur des octets qu'on ne possède plus, et la route
 * refuserait tout. Le test l'aurait constaté ; la relecture non.
 */

interface ErrorBody {
  error: { code: string; message: string; details?: Record<string, unknown> };
}

function httpServer(app: INestApplication): Server {
  return app.getHttpServer() as Server;
}

describe('vérification d’identité (01 §2.3, §2.4, §4.3)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let auth: AuthService;
  let kyc: KycService;
  let crypto: CryptoService;
  let sms: FakeSmsProvider;

  const run = Math.random().toString(36).slice(2, 8);
  const createdUsers: string[] = [];
  const createdStaff: string[] = [];
  let counter = 0;
  let franceId = '';

  /** Un numéro béninois distinct par appel : les limites d'OTP sont par numéro. */
  const nextPhone = (): string => {
    counter += 1;
    return numeroDEpreuve(counter);
  };

  /** Inscription complète, par le service : on veut une VRAIE session en base. */
  async function signIn(
    phone: string,
    iso2 = 'BJ',
  ): Promise<{ userId: string; accessToken: string; refreshToken: string; sessionId: string }> {
    const { challengeId } = await auth.requestOtp({
      phone,
      countryIso2: iso2,
      captchaToken: 'test',
      purpose: 'SIGNUP',
      ip: undefined,
    });
    const code = sms.lastCodeSent();
    expect(code).not.toBeNull();
    const session = await auth.verifyOtp({
      challengeId,
      code: code as string,
      ip: undefined,
      userAgent: undefined,
    });
    if (!createdUsers.includes(session.userId)) createdUsers.push(session.userId);
    const row = await prisma.authSession.findFirstOrThrow({
      where: { userId: session.userId, revokedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    return { ...session, sessionId: row.id };
  }

  /** Le corps du webhook, signé comme Didit le signe (T4 §8). */
  function postWebhook(
    body: Record<string, unknown>,
    options: { signature?: string } = {},
  ): request.Test {
    const raw = JSON.stringify(body);
    /**
     * LA VARIABLE EST FACULTATIVE, DONC ON VÉRIFIE QU'ELLE EST LÀ.
     *
     * `as string` mentait au typage : sans la variable, `undefined` filait jusqu'à
     * `createHmac`, et les ONZE tests de ce fichier échouaient sur « The "key"
     * argument must be of type string … Received undefined » — une erreur de Node
     * qui ne nomme ni la variable, ni le fichier, ni la cause. C'est arrivé à la
     * fusion : le secret était dans `.env.example` et pas dans le `.env` local, et
     * la suite avait l'air cassée alors qu'elle était seulement non configurée.
     *
     * Une ligne qui dit ce qui manque vaut une demi-heure de diagnostic.
     */
    const secret = loadEnv().DIDIT_WEBHOOK_SECRET;
    if (secret === undefined || secret === '') {
      throw new Error(
        'DIDIT_WEBHOOK_SECRET absente de votre .env — copiez la valeur de .env.example. ' +
          'Sans elle, aucun webhook KYC ne peut être signé, donc aucun de ces tests ne peut passer.',
      );
    }
    const signature =
      options.signature ?? createHmac('sha256', secret).update(Buffer.from(raw, 'utf8')).digest('hex');
    return request(httpServer(app))
      .post('/v1/webhooks/didit')
      .set('content-type', 'application/json')
      .set('x-signature', signature)
      .send(raw);
  }

  /** Approuve la dernière session KYC du membre, par le webhook réel. */
  async function approve(userId: string, isAdult = true): Promise<string> {
    const session = await kyc.createSession(userId);
    await postWebhook({ sessionId: session.sessionId, status: 'APPROVED', isAdult }).expect(200);
    return session.sessionId;
  }

  async function staffCookie(role: 'MODERATOR' | 'SUPPORT'): Promise<string> {
    counter += 1;
    const staffId = newId();
    await prisma.staffUser.create({
      data: {
        id: staffId,
        email: `kyc-${run}-${counter}@equipe.test`,
        displayName: `Équipe ${role}`,
        passwordHash: await hashStaffPassword('un-mot-de-passe-equipe-suffisamment-long'),
        totpSecretEncrypted: crypto.encryptContent(generateTotpSecret()),
        role,
        isActive: true,
      },
    });
    createdStaff.push(staffId);
    const token = `k-${run}-${newId()}`;
    await prisma.staffSession.create({
      data: {
        id: newId(),
        staffId,
        tokenHash: crypto.hashToken(token),
        expiresAt: new Date(Date.now() + STAFF_IDLE_MINUTES * 60_000),
      },
    });
    return `${STAFF_SESSION_COOKIE}=${token}`;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    // `rawBody: true` : le même réglage que `main.ts`. C'est la condition pour que
    // la signature du webhook soit vérifiable.
    app = moduleRef.createNestApplication({ rawBody: true });
    app.setGlobalPrefix('v1');
    app.useGlobalFilters(new ApiErrorFilter());
    app.use(cookieParser());
    await app.init();

    prisma = app.get(PrismaService);
    auth = app.get(AuthService);
    kyc = app.get(KycService);
    crypto = app.get(CryptoService);
    sms = app.get<FakeSmsProvider>(SMS_PROVIDER);

    franceId = (
      await prisma.country.findFirstOrThrow({
        where: { iso2: 'FR' },
        select: { id: true },
      })
    ).id;
  });

  afterAll(async () => {
    /**
     * `audit_logs` n'est PAS nettoyée, et il ne faut pas essayer : la table est en
     * ajout seul, et un déclencheur de base refuse UPDATE, DELETE et TRUNCATE
     * (00 §8.5). Le `deleteMany` que j'avais écrit ici faisait échouer tout le
     * fichier sur un `PrismaClientUnknownRequestError` sans rapport avec le sujet
     * — trouvé en exécutant, jamais en relisant.
     *
     * Même raison pour les comptes d'équipe : celui qui a rétrogradé un membre est
     * l'`actor_id` d'une ligne d'audit, et la cascade `SetNull` est un UPDATE que le
     * déclencheur refuse. On tente, on laisse en place si la base dit non.
     */
    if (createdUsers.length > 0) {
      await prisma.domainEvent.deleteMany({ where: { aggregateId: { in: createdUsers } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUsers } } });
    }
    for (const id of createdStaff) {
      await prisma.staffSession.deleteMany({ where: { staffId: id } });
      try {
        await prisma.staffUser.delete({ where: { id } });
      } catch {
        /* Le compte a agi : sa trace d'audit le rend indélébile. */
      }
    }
    await app?.close();
  });

  // ══════════════════════════════════════════════════════════════════════════
  // §4.3 — Ouverture de session
  // ══════════════════════════════════════════════════════════════════════════

  it('ouvre une session et la consigne IN_PROGRESS avec son échéance à 48 h', async () => {
    const me = await signIn(nextPhone());

    const response = await request(httpServer(app))
      .post('/v1/me/kyc/session')
      .set('authorization', `Bearer ${me.accessToken}`)
      .expect(201);

    const body = response.body as { sessionId: string; verificationUrl: string };
    expect(body.verificationUrl).toMatch(/kyc/);

    const row = await prisma.kycVerification.findUniqueOrThrow({
      where: { providerSessionId: body.sessionId },
    });
    expect(row.status).toBe('IN_PROGRESS');
    expect(row.userId).toBe(me.userId);
    expect(row.expiresAt).not.toBeNull();
    // 48 h, à la minute près : c'est ce que `kyc.expire_sessions` exploitera.
    const hours = ((row.expiresAt as Date).getTime() - row.createdAt.getTime()) / 3_600_000;
    expect(hours).toBeGreaterThan(ACCOUNT_LIMITS.kycSessionExpiryHours - 1);
    expect(hours).toBeLessThan(ACCOUNT_LIMITS.kycSessionExpiryHours + 1);
  });

  it('refuse une seconde vérification quand l’identité est déjà approuvée', async () => {
    const me = await signIn(nextPhone());
    await approve(me.userId);

    const response = await request(httpServer(app))
      .post('/v1/me/kyc/session')
      // Le jeton est PÉRIMÉ après l'approbation : on rafraîchit d'abord, sinon on
      // mesurerait TOKEN_STALE au lieu de la règle qu'on veut éprouver.
      .set('authorization', `Bearer ${(await auth.refresh(me.refreshToken, undefined)).accessToken}`)
      .expect(409);
    expect((response.body as ErrorBody).error.code).toBe('KYC_ALREADY_APPROVED');
  });

  it('impose 24 h après un refus, puis refuse au-delà de 3 essais sur 30 jours', async () => {
    const me = await signIn(nextPhone());

    const first = await kyc.createSession(me.userId);
    await postWebhook({
      sessionId: first.sessionId,
      status: 'DECLINED',
      declineReasonCode: 'DOC_UNREADABLE',
    }).expect(200);

    // Délai de 24 h (§2.3).
    await expect(kyc.createSession(me.userId)).rejects.toMatchObject({
      code: 'KYC_RETRY_TOO_SOON',
    });

    // Le lendemain, la tentative repasse.
    const tomorrow = new Date(Date.now() + 25 * 3_600_000);
    const second = await kyc.createSession(me.userId, tomorrow);
    await postWebhook({ sessionId: second.sessionId, status: 'DECLINED' }).expect(200);

    const later = new Date(Date.now() + 50 * 3_600_000);
    const third = await kyc.createSession(me.userId, later);
    await postWebhook({ sessionId: third.sessionId, status: 'DECLINED' }).expect(200);

    // Trois lignes dans la fenêtre : la quatrième est refusée pour le MOIS, et non
    // pour 24 h — l'ordre des refus annonce la contrainte qui borne réellement.
    const muchLater = new Date(Date.now() + 100 * 3_600_000);
    await expect(kyc.createSession(me.userId, muchLater)).rejects.toMatchObject({
      code: 'KYC_MAX_ATTEMPTS',
    });

    const status = await kyc.status(me.userId, muchLater);
    expect(status.attemptsUsed).toBe(3);
    expect(status.status).toBe('DECLINED');
    /**
     * Le code de refus est celui de la DERNIÈRE session — « la dernière fait foi »
     * (§3) — et non celui de la première. Cette dernière n'en portait aucun, d'où
     * `UNSPECIFIED` : `decline_reason_code` est nullable, et laisser `null` ferait
     * lire au front « refusée, sans motif » là où le fournisseur en avait un.
     */
    expect(status.declineReasonCode).toBe('UNSPECIFIED');
    expect(
      (
        await prisma.kycVerification.findUniqueOrThrow({
          where: { providerSessionId: first.sessionId },
          select: { declineReasonCode: true },
        })
      ).declineReasonCode,
    ).toBe('DOC_UNREADABLE');
  });

  // ══════════════════════════════════════════════════════════════════════════
  // §4.3 — Webhook signé
  // ══════════════════════════════════════════════════════════════════════════

  it('refuse un webhook sans signature, mal signé, ou signé d’un autre secret', async () => {
    const me = await signIn(nextPhone());
    const session = await kyc.createSession(me.userId);
    const body = { sessionId: session.sessionId, status: 'APPROVED', isAdult: true };

    await request(httpServer(app))
      .post('/v1/webhooks/didit')
      .set('content-type', 'application/json')
      .send(JSON.stringify(body))
      .expect(401);

    await postWebhook(body, { signature: 'f'.repeat(64) }).expect(401);

    const wrong = createHmac('sha256', 'un-autre-secret-de-plus-de-seize')
      .update(JSON.stringify(body))
      .digest('hex');
    await postWebhook(body, { signature: wrong }).expect(401);

    // Rien n'a bougé : la signature est le seul contrôle d'accès de cette route.
    const row = await prisma.kycVerification.findUniqueOrThrow({
      where: { providerSessionId: session.sessionId },
      select: { status: true },
    });
    expect(row.status).toBe('IN_PROGRESS');
  });

  it('[RÈGLE DURE] aucune donnée d’identité du webhook Didit n’est persistée', async () => {
    const me = await signIn(nextPhone());
    const session = await kyc.createSession(me.userId);

    /** Ce qu'un vrai webhook Didit transporte, et que rien ne doit garder. */
    const secrets = {
      firstName: `Aicha${run}`,
      lastName: `Segbedji${run}`,
      dateOfBirth: '1991-04-17',
      documentNumber: `AB${run}998877`,
      documentImageUrl: `https://didit.example/doc/${run}.jpg`,
      nationality: 'BEN',
      address: `12 rue de la Paix ${run}`,
    };

    await postWebhook({
      sessionId: session.sessionId,
      status: 'APPROVED',
      isAdult: true,
      ...secrets,
    }).expect(200);

    const row = await prisma.kycVerification.findUniqueOrThrow({
      where: { providerSessionId: session.sessionId },
    });
    expect(row.status).toBe('APPROVED');
    expect(row.isAdult).toBe(true);

    /**
     * On cherche les valeurs PARTOUT où le webhook a pu laisser une trace : la
     * ligne KYC, la boîte d'envoi (dont la charge est du JSON libre) et le journal
     * d'audit. C'est la charge qui a failli être le trou : `payload` accepte
     * n'importe quel objet, et y recopier le corps reçu aurait été naturel.
     */
    const events = await prisma.domainEvent.findMany({ where: { aggregateId: me.userId } });
    const audits = await prisma.auditLog.findMany({ where: { targetId: me.userId } });
    const haystack = JSON.stringify([row, events, audits]);
    for (const value of Object.values(secrets)) {
      expect(haystack, `« ${value} » ne doit apparaître nulle part`).not.toContain(value);
    }
  });

  it('[ANTI-REJEU] un X-Timestamp hors fenêtre est refusé même bien signé ; dans la fenêtre il passe', async () => {
    const me = await signIn(nextPhone());
    const session = await kyc.createSession(me.userId);
    const raw = JSON.stringify({ sessionId: session.sessionId, status: 'APPROVED', isAdult: true });
    const secret = loadEnv().DIDIT_WEBHOOK_SECRET as string;
    const signature = createHmac('sha256', secret).update(Buffer.from(raw, 'utf8')).digest('hex');
    const send = (timestamp: number) =>
      request(httpServer(app))
        .post('/v1/webhooks/didit')
        .set('content-type', 'application/json')
        .set('x-signature', signature)
        .set('x-timestamp', String(timestamp))
        .send(raw);

    const now = Math.floor(Date.now() / 1000);
    // Un message d'il y a une heure (rejeu) et un message « du futur » : refusés.
    expect(((await send(now - 3600).expect(401)).body as { error: { code: string } }).error.code).toBe('WEBHOOK_SIGNATURE_INVALID');
    await send(now + 3600).expect(401);
    await send(Number.NaN).expect(401);
    expect((await prisma.kycVerification.findUniqueOrThrow({ where: { providerSessionId: session.sessionId } })).status).not.toBe('APPROVED');
    // Frais : accepté.
    await send(now - 5).expect(200);
    expect((await prisma.kycVerification.findUniqueOrThrow({ where: { providerSessionId: session.sessionId } })).status).toBe('APPROVED');
  });

  it('le corps RÉEL de Didit (session_id, statut en toutes lettres, décision) est ramené à la forme interne sans rien garder', async () => {
    const me = await signIn(nextPhone());
    const session = await kyc.createSession(me.userId);
    await postWebhook({
      session_id: session.sessionId,
      status: 'Approved',
      decision: { id_verification: { age: 34, first_name: `Zainab${run}`, document_number: `ZZ${run}123` } },
    }).expect(200);
    const row = await prisma.kycVerification.findUniqueOrThrow({ where: { providerSessionId: session.sessionId } });
    expect(row.status).toBe('APPROVED');
    expect(row.isAdult).toBe(true);
    expect(JSON.stringify(row)).not.toContain(`Zainab${run}`);

    const minor = await signIn(nextPhone());
    const s2 = await kyc.createSession(minor.userId);
    await postWebhook({ session_id: s2.sessionId, status: 'Approved', decision: { id_verification: { age: 16 } } }).expect(200);
    expect((await prisma.kycVerification.findUniqueOrThrow({ where: { providerSessionId: s2.sessionId } })).isAdult).toBe(false);
  });

  it('est idempotent sur (session, statut) : le rejeu n’applique rien', async () => {
    const me = await signIn(nextPhone());
    const session = await kyc.createSession(me.userId);

    const first = await postWebhook({
      sessionId: session.sessionId,
      status: 'APPROVED',
      isAdult: true,
    }).expect(200);
    expect((first.body as { applied: boolean }).applied).toBe(true);

    const second = await postWebhook({
      sessionId: session.sessionId,
      status: 'APPROVED',
      isAdult: true,
    }).expect(200);
    expect((second.body as { applied: boolean; reason?: string }).applied).toBe(false);

    // Un seul `kyc.status_changed`, donc une seule notification au membre.
    const changes = await prisma.domainEvent.count({
      where: { aggregateId: me.userId, type: 'kyc.status_changed' },
    });
    expect(changes).toBe(1);
  });

  it('répond 200 — et non 404 — pour une session inconnue', async () => {
    // T4 §8 : « réponse 200 rapide ». Un 404 ferait réessayer Didit sans fin.
    const response = await postWebhook({
      sessionId: `inconnue-${run}`,
      status: 'APPROVED',
      isAdult: true,
    }).expect(200);
    expect((response.body as { applied: boolean; reason?: string }).reason).toBe('SESSION_UNKNOWN');
  });

  // ══════════════════════════════════════════════════════════════════════════
  // §7.2 / §2.4 — Niveaux
  // ══════════════════════════════════════════════════════════════════════════

  it('[RÈGLE DURE] un KYC refusé ou expiré ramène à L0, même avec un numéro français', async () => {
    const me = await signIn(nextPhone());
    const approved = await approve(me.userId);

    // Un numéro de destination vérifié : le membre est L2.
    await prisma.phoneNumber.create({
      data: {
        id: newId(),
        userId: me.userId,
        countryId: franceId,
        phoneEncrypted: crypto.encryptPhone(`+3369${String(Date.now()).slice(-7)}`),
        phoneHmac: crypto.phoneFingerprint(`fr-${run}-${counter}-${Date.now()}`),
        isPrimary: false,
        isDestination: true,
        verifiedAt: new Date(),
      },
    });
    const levels = app.get(VerificationLevelService);
    expect((await levels.recompute(me.userId, 'phone.added')).level).toBe('L2');

    /**
     * Le fournisseur REVIENT sur sa décision, sur la MÊME session.
     *
     * Pas une nouvelle session : `createSession` refuserait en `KYC_ALREADY_APPROVED`
     * — ce qui est juste, et c'est ce que le test a appris. Un second webhook sur la
     * session approuvée est précisément le cas réel (revue humaine a posteriori chez
     * Didit), et l'idempotence le laisse passer puisque le statut change.
     */
    await postWebhook({ sessionId: approved, status: 'DECLINED' }).expect(200);

    const after = await prisma.user.findUniqueOrThrow({
      where: { id: me.userId },
      select: { verificationLevel: true },
    });
    expect(after.verificationLevel).toBe('L0');
  });

  // ══════════════════════════════════════════════════════════════════════════
  // T4 §2 — `level_refresh_required` → 401 TOKEN_STALE
  // ══════════════════════════════════════════════════════════════════════════

  it('[RÈGLE DURE] la SÉQUENCE complète : jeton périmé → TOKEN_STALE → rafraîchi → passe', async () => {
    const me = await signIn(nextPhone());

    // 1. Le jeton neuf fonctionne, et porte L0.
    const before = await request(httpServer(app))
      .get('/v1/me')
      .set('authorization', `Bearer ${me.accessToken}`)
      .expect(200);
    expect((before.body as { user: { verificationLevel: string } }).user.verificationLevel).toBe('L0');

    // 2. L'identité est approuvée pendant que le jeton vit encore.
    await approve(me.userId);

    const session = await prisma.authSession.findUniqueOrThrow({
      where: { id: me.sessionId },
      select: { levelRefreshRequired: true },
    });
    expect(session.levelRefreshRequired).toBe(true);

    // 3. LE REFUS. Avant ce travail, l'appel passait : le drapeau était écrit et lu
    //    par personne, et le membre restait quinze minutes en L0.
    const stale = await request(httpServer(app))
      .get('/v1/me')
      .set('authorization', `Bearer ${me.accessToken}`)
      .expect(401);
    expect((stale.body as ErrorBody).error.code).toBe('TOKEN_STALE');

    // 4. Le client rafraîchit et rejoue (T4 §2).
    const refreshed = await auth.refresh(me.refreshToken, undefined);
    const after = await request(httpServer(app))
      .get('/v1/me')
      .set('authorization', `Bearer ${refreshed.accessToken}`)
      .expect(200);
    expect((after.body as { user: { verificationLevel: string } }).user.verificationLevel).toBe('L1');

    expect(
      (
        await prisma.authSession.findUniqueOrThrow({
          where: { id: me.sessionId },
          select: { levelRefreshRequired: true },
        })
      ).levelRefreshRequired,
    ).toBe(false);

    /**
     * 5. LE SECOND TOUR, et c'est celui qui manquait.
     *
     * Le rafraîchissement remet le drapeau à `false`. L'ANCIEN jeton d'accès, lui,
     * reste cryptographiquement valide quinze minutes : si le contrôle ne tenait
     * qu'au drapeau, il redeviendrait acceptable — avec son ancien niveau. Sur une
     * rétrogradation, ce serait une élévation de privilège ouverte par le remède.
     */
    const oldAgain = await request(httpServer(app))
      .get('/v1/me')
      .set('authorization', `Bearer ${me.accessToken}`)
      .expect(401);
    expect((oldAgain.body as ErrorBody).error.code).toBe('TOKEN_STALE');
  });

  it('[RÈGLE DURE] le DRAPEAU seul suffit à périmer un jeton, à niveau inchangé', async () => {
    /**
     * LE CAS QUE LA COMPARAISON DE NIVEAU NE VOIT PAS, et donc celui qui prouve que
     * `level_refresh_required` est bien lu.
     *
     * Le membre est L0. Son identité est approuvée (L1), puis retirée (L0) avant qu'il
     * n'ait rafraîchi. Son jeton porte L0 et la base dit L0 : les deux CONCORDENT. Seul
     * le drapeau, posé deux fois et jamais remis à zéro, dit que ce jeton a traversé un
     * changement d'état — et T4 §2 veut qu'il soit refusé pour que le client rejoue.
     *
     * Sans ce test, retirer le drapeau du garde laissait la suite « approbation →
     * TOKEN_STALE » verte, puisque la comparaison de niveau la couvrait aussi.
     */
    const me = await signIn(nextPhone());
    const approved = await approve(me.userId);
    await postWebhook({ sessionId: approved, status: 'DECLINED' }).expect(200);

    const session = await prisma.authSession.findUniqueOrThrow({
      where: { id: me.sessionId },
      select: { levelRefreshRequired: true },
    });
    expect(session.levelRefreshRequired).toBe(true);
    expect(
      (
        await prisma.user.findUniqueOrThrow({
          where: { id: me.userId },
          select: { verificationLevel: true },
        })
      ).verificationLevel,
    ).toBe('L0');
    // Le jeton porte bien le MÊME niveau que la base : la concordance est le point.
    const stale = await request(httpServer(app))
      .get('/v1/me')
      .set('authorization', `Bearer ${me.accessToken}`)
      .expect(401);
    expect((stale.body as ErrorBody).error.code).toBe('TOKEN_STALE');

    // Et le rafraîchissement remet le compteur à zéro : le membre n'est pas bloqué.
    const refreshed = await auth.refresh(me.refreshToken, undefined);
    await request(httpServer(app))
      .get('/v1/me')
      .set('authorization', `Bearer ${refreshed.accessToken}`)
      .expect(200);
  });

  it('une lecture publique reste ouverte malgré un jeton périmé', async () => {
    const me = await signIn(nextPhone());
    await prisma.userProfile.create({
      data: { userId: me.userId, occupationStatus: 'OTHER', availableToHelp: false, isPublic: true },
    });
    const handle = (
      await prisma.user.findUniqueOrThrow({ where: { id: me.userId }, select: { handle: true } })
    ).handle;

    await approve(me.userId);

    // §7.3 : une lecture ouverte se personnalise, elle n'exige pas la connexion.
    // La refuser pour un jeton périmé casserait la navigation d'un visiteur.
    await request(httpServer(app))
      .get(`/v1/users/${handle}`)
      .set('authorization', `Bearer ${me.accessToken}`)
      .expect(200);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // §2.3 — Mineur
  // ══════════════════════════════════════════════════════════════════════════

  it('[RÈGLE DURE] un membre mineur est désactivé et ne peut pas se reconnecter', async () => {
    const phone = nextPhone();
    const me = await signIn(phone);
    const session = await kyc.createSession(me.userId);

    await postWebhook({
      sessionId: session.sessionId,
      status: 'DECLINED',
      isAdult: false,
      declineReasonCode: 'UNDERAGE',
    }).expect(200);

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: me.userId },
      select: { status: true, deactivatedAt: true, verificationLevel: true },
    });
    expect(user.status).toBe('DEACTIVATED');
    expect(user.deactivatedAt).not.toBeNull();
    expect(user.verificationLevel).toBe('L0');

    // Les sessions partent : sinon le jeton de rafraîchissement rouvrirait le compte.
    const live = await prisma.authSession.count({
      where: { userId: me.userId, revokedAt: null },
    });
    expect(live).toBe(0);

    /**
     * LE SECOND TOUR, et c'est le piège que ce test existe pour fermer.
     *
     * §2.8 promet « réactivation par simple connexion OTP » à tout compte désactivé.
     * Le mineur relançait donc l'inscription, tombait sur son numéro connu, et
     * ANNULAIT lui-même la désactivation en deux écrans. Le refus ne peut pas se lire
     * dans `users.status` — un banni y est aussi `DEACTIVATED` — mais dans
     * `kyc_verifications.is_adult = false`.
     */
    const { challengeId } = await auth.requestOtp({
      phone,
      countryIso2: 'BJ',
      captchaToken: 'test',
      purpose: 'LOGIN',
      ip: undefined,
    });
    const code = sms.lastCodeSent() as string;
    await expect(
      auth.verifyOtp({ challengeId, code, ip: undefined, userAgent: undefined }),
    ).rejects.toMatchObject({ code: 'ACCOUNT_MINOR' });

    expect(
      (
        await prisma.user.findUniqueOrThrow({
          where: { id: me.userId },
          select: { status: true },
        })
      ).status,
    ).toBe('DEACTIVATED');

    expect((await kyc.status(me.userId)).isMinor).toBe(true);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // §8 — `kyc.expire_sessions`
  // ══════════════════════════════════════════════════════════════════════════

  it('expire les sessions restées en cours au-delà de 48 h, et reste idempotent', async () => {
    const me = await signIn(nextPhone());
    const session = await kyc.createSession(me.userId);

    const later = new Date(Date.now() + (ACCOUNT_LIMITS.kycSessionExpiryHours + 1) * 3_600_000);
    const first = await kyc.expireStaleSessions(later);
    expect(first.expired).toBeGreaterThanOrEqual(1);

    expect(
      (
        await prisma.kycVerification.findUniqueOrThrow({
          where: { providerSessionId: session.sessionId },
          select: { status: true },
        })
      ).status,
    ).toBe('EXPIRED');

    // Second passage sur le même créneau : plus rien de CETTE session.
    const before = await prisma.domainEvent.count({
      where: { aggregateId: me.userId, type: 'kyc.status_changed' },
    });
    await kyc.expireStaleSessions(later);
    const after = await prisma.domainEvent.count({
      where: { aggregateId: me.userId, type: 'kyc.status_changed' },
    });
    expect(after).toBe(before);

    // Aucun délai de 24 h après une expiration : le membre peut recommencer tout
    // de suite (§2.3 ne l'impose qu'après un refus).
    expect((await kyc.status(me.userId, later)).retryAvailableAt).toBeNull();
    await expect(kyc.createSession(me.userId, later)).resolves.toMatchObject({
      verificationUrl: expect.stringContaining('kyc'),
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 15 §3.2 — « Rétrograder le niveau »
  // ══════════════════════════════════════════════════════════════════════════

  it('l’équipe rétrograde le niveau : KYC DECLINED, L0, sessions périmées, audit', async () => {
    const me = await signIn(nextPhone());
    await approve(me.userId);
    const refreshed = await auth.refresh(me.refreshToken, undefined);

    const cookie = await staffCookie('MODERATOR');
    const response = await request(httpServer(app))
      .post(`/v1/admin/users/${me.userId}/kyc/downgrade`)
      .set('cookie', cookie)
      .send({ reason: 'Document manifestement falsifié, vérifié avec le fournisseur.' })
      .expect(201);
    expect((response.body as { level: string }).level).toBe('L0');

    const latest = await prisma.kycVerification.findFirstOrThrow({
      where: { userId: me.userId },
      orderBy: { createdAt: 'desc' },
      select: { status: true, declineReasonCode: true, decidedAt: true },
    });
    expect(latest.status).toBe('DECLINED');
    expect(latest.declineReasonCode).toBe('STAFF_REVIEW');
    expect(latest.decidedAt).not.toBeNull();

    // Le jeton L1 que le membre tient en main devient périmé sur-le-champ.
    const stale = await request(httpServer(app))
      .get('/v1/me')
      .set('authorization', `Bearer ${refreshed.accessToken}`)
      .expect(401);
    expect((stale.body as ErrorBody).error.code).toBe('TOKEN_STALE');

    // RÈGLE DURE 00 §7.4 : toute action admin écrit une ligne d'audit.
    const audits = await prisma.auditLog.findMany({
      where: { targetId: me.userId, action: 'user.kyc_downgraded' },
    });
    expect(audits).toHaveLength(1);
    expect(JSON.stringify(audits[0]?.metadata)).toContain('falsifié');
  });

  it('refuse la rétrogradation d’un membre sans vérification approuvée', async () => {
    const me = await signIn(nextPhone());
    const cookie = await staffCookie('MODERATOR');
    const response = await request(httpServer(app))
      .post(`/v1/admin/users/${me.userId}/kyc/downgrade`)
      .set('cookie', cookie)
      .send({ reason: 'Aucune vérification approuvée à retirer, motif assez long.' })
      .expect(409);
    expect((response.body as ErrorBody).error.code).toBe('CONFLICT');
  });

  it('la rétrogradation est fermée au SUPPORT (§2.2)', async () => {
    const me = await signIn(nextPhone());
    const cookie = await staffCookie('SUPPORT');
    await request(httpServer(app))
      .post(`/v1/admin/users/${me.userId}/kyc/downgrade`)
      .set('cookie', cookie)
      .send({ reason: 'Le rôle SUPPORT ne doit pas pouvoir retirer un niveau.' })
      .expect(403);
  });

  it('un jeton de membre n’atteint jamais la route d’équipe (§2.1)', async () => {
    const me = await signIn(nextPhone());
    await request(httpServer(app))
      .post(`/v1/admin/users/${me.userId}/kyc/downgrade`)
      .set('authorization', `Bearer ${me.accessToken}`)
      .send({ reason: 'Un membre ne doit pas pouvoir se rétrograder ni rétrograder autrui.' })
      .expect(401);
  });
});
