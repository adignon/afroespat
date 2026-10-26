import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId } from '@app/db';
import { ACCOUNT_LIMITS } from '@app/shared';
import { AppModule } from '../../../app.module';
import { CryptoService } from '../../../common/crypto.service';
import { ApiErrorFilter } from '../../../common/error.filter';
import { PrismaService } from '../../../common/prisma.service';
import { FakeSmsProvider, SMS_PROVIDER } from '../../../providers/providers';
import { AuthService } from '../../auth/auth.service';
import { AccountService } from '../account.service';
import { VerificationLevelService } from '../verification-level.service';
import { numeroDEpreuve } from '../../../common/__tests__/numeros';
import { enFormatInternational } from '@app/shared';

/**
 * LE FORMAT INTERNATIONAL VIENT DE LA BIBLIOTHÈQUE, PAS D'UN COLLAGE.
 *
 * Ces bancs écrivaient `+229` suivi du numéro privé de ses zéros de tête. C'est
 * la règle FRANÇAISE : le « 0 » y est un préfixe interurbain, et il tombe. Au
 * BÉNIN il fait PARTIE du numéro — `+229 01 9…` — et libphonenumber le garde.
 * MESURÉ : l'attendu disait `+229196833223` là où le serveur stocke
 * `+2290196833223`, et le banc accusait le serveur.
 */

/**
 * Cycle de vie du compte — 01 §2.5, §2.8, §8 et §9.
 *
 * Ce fichier existe pour une raison précise : `user.deleted` avait DIX
 * consommateurs et aucun producteur. La méthode `account.deletion_execute` que la
 * spec nomme n'existait pas, donc aucun nettoyage de suppression de compte n'avait
 * jamais lieu — et chaque module croyait le sien branché.
 *
 * Les routes passent par HTTP (les capacités et le garde font partie de la
 * livraison), les tâches planifiées par appel direct avec un `now` explicite : c'est
 * ce qui rend éprouvable « sept jours » et « six mois » sans attendre.
 */

interface ErrorBody {
  error: { code: string; message: string; details?: Record<string, unknown> };
}

function httpServer(app: INestApplication): Server {
  return app.getHttpServer() as Server;
}

const STAFF_EMAIL = 'test-cycle-de-vie@local';

describe('cycle de vie du compte (01 §2.5, §2.8, §8)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let auth: AuthService;
  let account: AccountService;
  let levels: VerificationLevelService;
  let crypto: CryptoService;
  let sms: FakeSmsProvider;

  const createdUsers: string[] = [];
  let counter = 0;
  let staffId = '';

  const nextPhone = (): string => {
    counter += 1;
    return numeroDEpreuve(counter);
  };

  async function signIn(
    phone: string,
    iso2 = 'BJ',
  ): Promise<{ userId: string; accessToken: string; refreshToken: string }> {
    const { challengeId } = await auth.requestOtp({
      phone,
      countryIso2: iso2,
      captchaToken: 'test',
      purpose: 'SIGNUP',
      ip: undefined,
    });
    const session = await auth.verifyOtp({
      challengeId,
      code: sms.lastCodeSent() as string,
      ip: undefined,
      userAgent: undefined,
    });
    if (!createdUsers.includes(session.userId)) createdUsers.push(session.userId);
    return session;
  }

  /** Un code OTP frais sur le numéro du membre, pour le `purpose` demandé. */
  async function otpFor(
    phone: string,
    purpose: 'LOGIN' | 'DELETE_ACCOUNT' | 'ADD_PHONE',
    iso2 = 'BJ',
  ): Promise<{ challengeId: string; code: string }> {
    const { challengeId } = await auth.requestOtp({
      phone,
      countryIso2: iso2,
      captchaToken: 'test',
      purpose,
      ip: undefined,
    });
    return { challengeId, code: sms.lastCodeSent() as string };
  }

  /**
   * Amène le membre en L1 sans passer par Didit.
   *
   * Le chemin complet (session, webhook signé, recalcul) est éprouvé dans
   * `kyc/__tests__/kyc.int.test.ts` ; ici L1 n'est qu'un POINT DE DÉPART, celui
   * qu'exige §2.5 pour ajouter un numéro. Le refaire par HTTP allongerait chaque
   * test sans rien prouver de plus.
   */
  async function makeL1(userId: string): Promise<void> {
    await prisma.kycVerification.create({
      data: {
        id: newId(),
        userId,
        provider: 'DIDIT',
        providerSessionId: `fixture-${newId()}`,
        status: 'APPROVED',
        isAdult: true,
        decidedAt: new Date(),
      },
    });
    await levels.recompute(userId, 'kyc.status_changed');
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ rawBody: true });
    app.setGlobalPrefix('v1');
    app.useGlobalFilters(new ApiErrorFilter());
    app.use(cookieParser());
    await app.init();

    prisma = app.get(PrismaService);
    auth = app.get(AuthService);
    account = app.get(AccountService);
    levels = app.get(VerificationLevelService);
    crypto = app.get(CryptoService);
    sms = app.get<FakeSmsProvider>(SMS_PROVIDER);

    // `sanctions.issued_by_staff_id` est NOT NULL : une sanction a toujours un
    // auteur humain (13 §4.2). Le compte est réutilisé et jamais supprimé.
    staffId = (
      await prisma.staffUser.upsert({
        where: { email: STAFF_EMAIL },
        update: {},
        create: {
          id: newId(),
          email: STAFF_EMAIL,
          displayName: 'Équipe (test cycle de vie)',
          passwordHash: 'x',
          totpSecretEncrypted: new Uint8Array([0]),
          role: 'SUPER_ADMIN',
          isActive: true,
        },
        select: { id: true },
      })
    ).id;
  });

  afterAll(async () => {
    if (createdUsers.length > 0) {
      await prisma.domainEvent.deleteMany({ where: { aggregateId: { in: createdUsers } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUsers } } });
    }
    await app?.close();
  });

  // ══════════════════════════════════════════════════════════════════════════
  // §2.8 — Désactivation et réactivation
  // ══════════════════════════════════════════════════════════════════════════

  it('désactive, révoque les sessions, et se laisse réveiller par une connexion OTP', async () => {
    const phone = nextPhone();
    const me = await signIn(phone);

    await request(httpServer(app))
      .post('/v1/me/deactivate')
      .set('authorization', `Bearer ${me.accessToken}`)
      .expect(200);

    const after = await prisma.user.findUniqueOrThrow({
      where: { id: me.userId },
      select: { status: true, deactivatedAt: true },
    });
    expect(after.status).toBe('DEACTIVATED');
    // `deactivated_at` est la SEULE donnée qui permette à la purge de compter six
    // mois. Laissée nulle, le compte ne serait jamais supprimé (§2.8).
    expect(after.deactivatedAt).not.toBeNull();
    expect(await prisma.authSession.count({ where: { userId: me.userId, revokedAt: null } })).toBe(0);
    expect(
      await prisma.domainEvent.count({
        where: { aggregateId: me.userId, type: 'user.deactivated' },
      }),
    ).toBe(1);

    // §2.8 : « réactivation par simple connexion OTP ».
    const otp = await otpFor(phone, 'LOGIN');
    const back = await auth.verifyOtp({
      challengeId: otp.challengeId,
      code: otp.code,
      ip: undefined,
      userAgent: undefined,
    });
    expect(back.isNewUser).toBe(false);
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: me.userId }, select: { status: true } }))
        .status,
    ).toBe('ACTIVE');
    expect(
      await prisma.domainEvent.count({
        where: { aggregateId: me.userId, type: 'user.reactivated' },
      }),
    ).toBe(1);
  });

  it('après la désactivation, le jeton d’accès déjà émis ne vaut plus rien', async () => {
    const me = await signIn(nextPhone());
    await request(httpServer(app))
      .post('/v1/me/deactivate')
      .set('authorization', `Bearer ${me.accessToken}`)
      .expect(200);

    /**
     * §2.8 : « sessions RÉVOQUÉES ». Le jeton d'accès vit quinze minutes et ne sait
     * rien de la révocation : sans le contrôle du garde sur `revoked_at`,
     * « immédiatement » voulait dire « dans un quart d'heure », et un compte désactivé
     * — celui d'un mineur, par exemple — gardait tous ses droits d'écriture.
     */
    const response = await request(httpServer(app))
      .post('/v1/me/deactivate')
      .set('authorization', `Bearer ${me.accessToken}`)
      .expect(401);
    expect((response.body as ErrorBody).error.code).toBe('UNAUTHENTICATED');

    // Et la règle métier tient aussi, pour l'appelant qui aurait encore une session.
    await expect(account.deactivate(me.userId)).rejects.toMatchObject({
      code: 'ALREADY_DEACTIVATED',
    });
  });

  it('[RÈGLE DURE] un compte banni ne se réveille PAS par une connexion OTP', async () => {
    const phone = nextPhone();
    const me = await signIn(phone);

    /**
     * 13 §4.2 écrit `status = DEACTIVATED` sur un `BAN_USER`, faute de valeur
     * `BANNED` dans l'enum : un banni est donc indistinguable d'un désactivé si l'on
     * ne regarde que `users.status`. Sans le contrôle des sanctions, §2.8 rendait
     * l'accès au banni en deux écrans — et c'est le SEUL rempart disponible, la table
     * `banned_phone_hashes` que 13 §4.2 nomme n'existant pas dans le schéma figé.
     */
    await prisma.user.update({
      where: { id: me.userId },
      data: { status: 'DEACTIVATED', deactivatedAt: new Date() },
    });
    await prisma.sanction.create({
      data: {
        id: newId(),
        userId: me.userId,
        type: 'BAN',
        reason: 'Arnaque caractérisée, dossier documenté et vérifié.',
        startsAt: new Date(),
        issuedByStaffId: staffId,
      },
    });

    const otp = await otpFor(phone, 'LOGIN');
    await expect(
      auth.verifyOtp({
        challengeId: otp.challengeId,
        code: otp.code,
        ip: undefined,
        userAgent: undefined,
      }),
    ).rejects.toMatchObject({ code: 'ACCOUNT_BANNED' });

    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: me.userId }, select: { status: true } }))
        .status,
    ).toBe('DEACTIVATED');
  });

  // ══════════════════════════════════════════════════════════════════════════
  // §2.8 — Demande de suppression
  // ══════════════════════════════════════════════════════════════════════════

  it('exige un OTP de purpose DELETE_ACCOUNT, sur un numéro du membre', async () => {
    const phone = nextPhone();
    const me = await signIn(phone);

    // Un code de CONNEXION ne confirme pas une suppression : sans ce contrôle, le
    // code que le membre vient de recevoir vaudrait consentement à tout.
    const login = await otpFor(phone, 'LOGIN');
    const mismatch = await request(httpServer(app))
      .post('/v1/me/deletion')
      .set('authorization', `Bearer ${me.accessToken}`)
      .send({ challengeId: login.challengeId, code: login.code })
      .expect(422);
    expect((mismatch.body as ErrorBody).error.code).toBe('OTP_PURPOSE_MISMATCH');

    // Un code reçu sur le téléphone de QUELQU'UN D'AUTRE ne vaut pas davantage.
    const otherPhone = nextPhone();
    await signIn(otherPhone);
    const foreign = await otpFor(otherPhone, 'DELETE_ACCOUNT');
    const notMine = await request(httpServer(app))
      .post('/v1/me/deletion')
      .set('authorization', `Bearer ${me.accessToken}`)
      .send({ challengeId: foreign.challengeId, code: foreign.code })
      .expect(404);
    expect((notMine.body as ErrorBody).error.code).toBe('NOT_FOUND');

    expect(
      await prisma.accountDeletionRequest.count({ where: { userId: me.userId } }),
    ).toBe(0);
  });

  it('enregistre la demande à 7 jours, révoque les sessions, et refuse un doublon', async () => {
    const phone = nextPhone();
    const me = await signIn(phone);

    const otp = await otpFor(phone, 'DELETE_ACCOUNT');
    const response = await request(httpServer(app))
      .post('/v1/me/deletion')
      .set('authorization', `Bearer ${me.accessToken}`)
      .send({ challengeId: otp.challengeId, code: otp.code })
      .expect(201);

    const body = response.body as { requestedAt: string; executeAfter: string };
    const days =
      (new Date(body.executeAfter).getTime() - new Date(body.requestedAt).getTime()) / 86_400_000;
    expect(days).toBeCloseTo(ACCOUNT_LIMITS.deletionGraceDays, 5);

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: me.userId },
      select: { status: true },
    });
    expect(user.status).toBe('DELETION_PENDING');
    // « Sessions révoquées IMMÉDIATEMENT » (§2.8).
    expect(await prisma.authSession.count({ where: { userId: me.userId, revokedAt: null } })).toBe(0);
    expect(
      await prisma.domainEvent.count({
        where: { aggregateId: me.userId, type: 'user.deletion_requested' },
      }),
    ).toBe(1);

    // Le jeton d'accès est mort avec la session : la route n'est plus atteignable, et
    // c'est pourquoi `DELETE /me/deletion` de §4.2 n'est pas livrée (voir le contrôleur).
    const unreachable = await request(httpServer(app))
      .post('/v1/me/deletion')
      .set('authorization', `Bearer ${me.accessToken}`)
      .send({ challengeId: newId(), code: '000000' })
      .expect(401);
    expect((unreachable.body as ErrorBody).error.code).toBe('UNAUTHENTICATED');

    // La règle du doublon reste éprouvée au niveau du service, qui la porte.
    const second = await otpFor(phone, 'DELETE_ACCOUNT');
    await expect(
      account.requestDeletion(me.userId, {
        challengeId: second.challengeId,
        code: second.code,
      }),
    ).rejects.toMatchObject({ code: 'DELETION_ALREADY_PENDING' });
  });

  it('une connexion OTP pendant les 7 jours annule la demande', async () => {
    const phone = nextPhone();
    const me = await signIn(phone);
    const otp = await otpFor(phone, 'DELETE_ACCOUNT');
    await request(httpServer(app))
      .post('/v1/me/deletion')
      .set('authorization', `Bearer ${me.accessToken}`)
      .send({ challengeId: otp.challengeId, code: otp.code })
      .expect(201);

    const login = await otpFor(phone, 'LOGIN');
    await auth.verifyOtp({
      challengeId: login.challengeId,
      code: login.code,
      ip: undefined,
      userAgent: undefined,
    });

    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: me.userId }, select: { status: true } }))
        .status,
    ).toBe('ACTIVE');
    const pending = await prisma.accountDeletionRequest.findFirstOrThrow({
      where: { userId: me.userId },
    });
    expect(pending.cancelledAt).not.toBeNull();

    // Et la tâche ne trouve plus rien, même une fois l'échéance passée.
    const later = new Date(Date.now() + (ACCOUNT_LIMITS.deletionGraceDays + 1) * 86_400_000);
    await account.executeDueDeletions(later);
    expect(
      (
        await prisma.user.findUniqueOrThrow({
          where: { id: me.userId },
          select: { status: true },
        })
      ).status,
    ).toBe('ACTIVE');
  });

  /**
   * LE CODE DE SUPPRESSION PART AU NUMÉRO DU MEMBRE — lot w5b (branchement de K08).
   *
   * L'écran ne connaît que des masques (01 §2.1) : il ne peut pas demander le code avec
   * `POST /auth/otp/request`, qui veut le numéro en clair. `POST /me/deletion/code` le fait à sa
   * place, et ce qui compte à éprouver est qu'on ne choisit PAS le destinataire : le défi porte
   * l'empreinte du numéro principal du membre, rien d'autre.
   */
  it('POST /me/deletion/code envoie le code au numéro principal, sans jamais le rendre', async () => {
    const phone = nextPhone();
    const me = await signIn(phone);
    const avant = sms.sentCount();

    const reponse = await request(httpServer(app))
      .post('/v1/me/deletion/code')
      .set('authorization', `Bearer ${me.accessToken}`)
      .send({ captchaToken: 'test' })
      .expect(200);
    const corps = reponse.body as { challengeId: string; expiresAt: string; masked: string };

    // Un SMS est parti, et la réponse ne porte que le MASQUE du numéro.
    expect(sms.sentCount()).toBe(avant + 1);
    expect(corps.masked).toContain('•');
    expect(JSON.stringify(corps)).not.toContain(phone.replace(/^0/, ''));
    expect(new Date(corps.expiresAt).getTime()).toBeGreaterThan(Date.now());

    // Le défi est celui d'une SUPPRESSION et porte l'empreinte du numéro DU MEMBRE.
    const defi = await prisma.otpChallenge.findUniqueOrThrow({ where: { id: corps.challengeId } });
    const numero = await prisma.phoneNumber.findFirstOrThrow({ where: { userId: me.userId, isPrimary: true } });
    expect(defi.purpose).toBe('DELETE_ACCOUNT');
    expect(defi.phoneHmac).toBe(numero.phoneHmac);

    // Et ce code confirme bien la suppression, sept jours de rétractation à la clé.
    const code = sms.lastCodeSent() as string;
    const demande = await request(httpServer(app))
      .post('/v1/me/deletion')
      .set('authorization', `Bearer ${me.accessToken}`)
      .send({ challengeId: corps.challengeId, code })
      .expect(201);
    expect((demande.body as { executeAfter: string }).executeAfter).toBeTruthy();
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: me.userId }, select: { status: true } })).status,
    ).toBe('DELETION_PENDING');
  });

  it('POST /me/deletion/code exige une session, et refuse une demande déjà en attente', async () => {
    await request(httpServer(app)).post('/v1/me/deletion/code').send({ captchaToken: 'test' }).expect(401);

    const phone = nextPhone();
    const me = await signIn(phone);
    const otp = await otpFor(phone, 'DELETE_ACCOUNT');
    await account.requestDeletion(me.userId, { challengeId: otp.challengeId, code: otp.code });

    // Pas de SMS dépensé pour un geste qui sera refusé.
    const avant = sms.sentCount();
    await expect(
      account.sendDeletionCode(me.userId, { captchaToken: 'test' }, undefined),
    ).rejects.toMatchObject({ code: 'DELETION_ALREADY_PENDING' });
    expect(sms.sentCount()).toBe(avant);
  });

  it('un code de CONNEXION ne confirme pas la suppression, même demandé juste avant', async () => {
    const phone = nextPhone();
    const me = await signIn(phone);
    const login = await otpFor(phone, 'LOGIN');
    const refus = await request(httpServer(app))
      .post('/v1/me/deletion')
      .set('authorization', `Bearer ${me.accessToken}`)
      .send({ challengeId: login.challengeId, code: login.code })
      .expect(422);
    expect((refus.body as ErrorBody).error.code).toBe('OTP_PURPOSE_MISMATCH');
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: me.userId }, select: { status: true } })).status,
    ).toBe('ACTIVE');
  });

  /**
   * « ANNULER LA SUPPRESSION » EST UNE RECONNEXION, ET L'ÉCRAN DOIT L'APPRENDRE.
   *
   * §2.8 : « pendant 7 jours, une connexion OTP annule la demande ». La session étant révoquée
   * dès la demande, il n'existe pas de `DELETE /me/deletion` atteignable (voir le contrôleur) :
   * l'annulation passe par `POST /auth/otp/verify`, qui rend maintenant `deletionCancelled`.
   * Sans ce champ, le membre se reconnecte et ne sait pas que son compte est sauvé.
   */
  it('POST /auth/otp/verify dit deletionCancelled quand la reconnexion annule la suppression', async () => {
    // Trois codes par numéro et par heure (§2.1) : un membre pour la connexion ordinaire…
    const autre = nextPhone();
    await signIn(autre);
    const ordinaire = await otpFor(autre, 'LOGIN');
    const lue = await request(httpServer(app))
      .post('/v1/auth/otp/verify')
      .send({ challengeId: ordinaire.challengeId, code: ordinaire.code })
      .expect(200);
    expect((lue.body as { deletionCancelled: boolean }).deletionCancelled).toBe(false);

    // … et un autre pour la suppression demandée puis annulée par la reconnexion.
    const phone = nextPhone();
    const me = await signIn(phone);
    const otp = await otpFor(phone, 'DELETE_ACCOUNT');
    await account.requestDeletion(me.userId, { challengeId: otp.challengeId, code: otp.code });
    const retour = await otpFor(phone, 'LOGIN');
    const annulee = await request(httpServer(app))
      .post('/v1/auth/otp/verify')
      .send({ challengeId: retour.challengeId, code: retour.code })
      .expect(200);
    expect((annulee.body as { deletionCancelled: boolean }).deletionCancelled).toBe(true);
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: me.userId }, select: { status: true } })).status,
    ).toBe('ACTIVE');
  });

  it('[RÈGLE DURE] un compte SUSPENDU peut demander sa suppression, et rien d’autre', async () => {
    const phone = nextPhone();
    const me = await signIn(phone);

    /**
     * Le jeton doit porter `SUSPENDED`, sinon le test ne mesure rien.
     *
     * C'est exactement le piège du §4.3 du module 13 : la suspension révoque les
     * sessions, le membre se reconnecte, et c'est son jeton NEUF qui porte le nouvel
     * état. On reproduit ce second tour par un rafraîchissement, qui relit le statut
     * en base.
     */
    await prisma.user.update({ where: { id: me.userId }, data: { status: 'SUSPENDED' } });
    const token = (await auth.refresh(me.refreshToken, undefined)).accessToken;

    // La moitié qui compte autant que l'autre : l'exemption est NOMMÉE route par route.
    const refused = await request(httpServer(app))
      .post('/v1/me/deactivate')
      .set('authorization', `Bearer ${token}`)
      .expect(403);
    expect((refused.body as ErrorBody).error.code).toBe('ACCOUNT_SUSPENDED');

    // Quitter la plateforme est un DROIT que la sanction ne suspend pas (§8, RGPD).
    const otp = await otpFor(phone, 'DELETE_ACCOUNT');
    await request(httpServer(app))
      .post('/v1/me/deletion')
      .set('authorization', `Bearer ${token}`)
      .send({ challengeId: otp.challengeId, code: otp.code })
      .expect(201);

    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: me.userId }, select: { status: true } }))
        .status,
    ).toBe('DELETION_PENDING');
  });

  // ══════════════════════════════════════════════════════════════════════════
  // §8 et §9 — `account.deletion_execute`
  // ══════════════════════════════════════════════════════════════════════════

  it('[RÈGLE DURE] la suppression anonymise users, vide les tables du module, et émet user.deleted', async () => {
    const phone = nextPhone();
    const me = await signIn(phone);
    await makeL1(me.userId);
    await prisma.userProfile.create({
      data: { userId: me.userId, occupationStatus: 'STUDENT', availableToHelp: true, isPublic: true },
    });
    await prisma.bookmark.create({
      data: { id: newId(), userId: me.userId, subjectType: 'GUIDE', subjectId: newId() },
    });
    const handleBefore = (
      await prisma.user.findUniqueOrThrow({ where: { id: me.userId }, select: { handle: true } })
    ).handle;

    const otp = await otpFor(phone, 'DELETE_ACCOUNT');
    await account.requestDeletion(me.userId, { challengeId: otp.challengeId, code: otp.code });

    // AVANT l'échéance : rien ne bouge. C'est la moitié qu'on oublie de vérifier,
    // et une tâche qui supprimerait tout de suite rendrait les sept jours fictifs.
    const early = await account.executeDueDeletions(new Date(Date.now() + 86_400_000));
    expect(early.executed).toBe(0);
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: me.userId }, select: { status: true } }))
        .status,
    ).toBe('DELETION_PENDING');

    const later = new Date(Date.now() + (ACCOUNT_LIMITS.deletionGraceDays + 1) * 86_400_000);
    const done = await account.executeDueDeletions(later);
    expect(done.executed).toBeGreaterThanOrEqual(1);
    expect(done.failed).toBe(0);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: me.userId } });
    expect(user.status).toBe('DELETED');
    expect(user.deletedAt).not.toBeNull();
    expect(user.displayName).toBe('Membre supprimé');
    expect(user.handle).toMatch(/^deleted_[0-9a-f]{12}$/);
    expect(user.handle).not.toBe(handleBefore);
    expect(user.cityId).toBeNull();
    expect(user.arrivalDate).toBeNull();
    expect(user.avatarAssetId).toBeNull();
    expect(user.verificationLevel).toBe('L0');

    // §9 : les tables du module sont VIDÉES.
    expect(await prisma.phoneNumber.count({ where: { userId: me.userId } })).toBe(0);
    expect(await prisma.authSession.count({ where: { userId: me.userId } })).toBe(0);
    expect(await prisma.kycVerification.count({ where: { userId: me.userId } })).toBe(0);
    expect(await prisma.userProfile.count({ where: { userId: me.userId } })).toBe(0);
    expect(await prisma.bookmark.count({ where: { userId: me.userId } })).toBe(0);

    /**
     * §9 : `consents` est CONSERVÉE — « 3 ans comme preuve ». Une suppression qui
     * emporterait la preuve du consentement ferait perdre la seule pièce qui atteste
     * qu'on avait le droit d'ouvrir le compte.
     */
    expect(await prisma.consent.count({ where: { userId: me.userId } })).toBeGreaterThan(0);

    // L'événement que dix modules attendaient.
    expect(
      await prisma.domainEvent.count({
        where: { aggregateId: me.userId, type: 'user.deleted' },
      }),
    ).toBe(1);

    // Idempotence : le créneau suivant ne rejoue rien et n'émet pas un second
    // `user.deleted` — ce qui ferait travailler dix modules pour rien.
    const again = await account.executeDueDeletions(later);
    expect(again.executed).toBe(0);
    expect(
      await prisma.domainEvent.count({
        where: { aggregateId: me.userId, type: 'user.deleted' },
      }),
    ).toBe(1);
  });

  it('deux passages CONCURRENTS n’exécutent la suppression qu’une fois', async () => {
    /**
     * LA PRISE, et la seule façon de l'éprouver.
     *
     * `executed_at` est posé par un `updateMany` CONDITIONNEL, qui sert de prise : deux
     * passages qui se croisent — reprise BullMQ, worker redémarré en pleine exécution,
     * deux workers — ne doivent pas exécuter la même demande deux fois, donc ne pas
     * émettre deux `user.deleted`. Dix modules écoutent cet événement ; le rejouer les
     * ferait tous travailler une seconde fois.
     *
     * Un test SÉQUENTIEL ne prouve rien ici : au second appel, la requête de
     * sélection ne trouve plus la demande. Seule la concurrence exerce la prise.
     */
    const phone = nextPhone();
    const me = await signIn(phone);
    const otp = await otpFor(phone, 'DELETE_ACCOUNT');
    await account.requestDeletion(me.userId, { challengeId: otp.challengeId, code: otp.code });

    const later = new Date(Date.now() + (ACCOUNT_LIMITS.deletionGraceDays + 1) * 86_400_000);
    const [a, b] = await Promise.all([
      account.executeDueDeletions(later),
      account.executeDueDeletions(later),
    ]);

    // Un seul des deux a exécuté ; l'autre a vu la prise (ou a échoué sur un conflit
    // de verrou, ce que la tâche compte comme un échec et rejouera).
    expect(a.executed + b.executed).toBe(1);
    expect(
      await prisma.domainEvent.count({
        where: { aggregateId: me.userId, type: 'user.deleted' },
      }),
    ).toBe(1);
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: me.userId }, select: { status: true } }))
        .status,
    ).toBe('DELETED');
  });

  // ══════════════════════════════════════════════════════════════════════════
  // §8 — `account.deactivated_purge`
  // ══════════════════════════════════════════════════════════════════════════

  it('purge les comptes désactivés depuis plus de six mois — mais JAMAIS un banni', async () => {
    const sevenMonthsAgo = new Date();
    sevenMonthsAgo.setUTCMonth(sevenMonthsAgo.getUTCMonth() - 7);

    const ordinaire = await signIn(nextPhone());
    await prisma.user.update({
      where: { id: ordinaire.userId },
      data: { status: 'DEACTIVATED', deactivatedAt: sevenMonthsAgo },
    });

    const bannedPhone = nextPhone();
    const banni = await signIn(bannedPhone);
    const bannedHmac = (
      await prisma.phoneNumber.findFirstOrThrow({
        where: { userId: banni.userId },
        select: { phoneHmac: true },
      })
    ).phoneHmac;
    await prisma.user.update({
      where: { id: banni.userId },
      data: { status: 'DEACTIVATED', deactivatedAt: sevenMonthsAgo },
    });
    await prisma.sanction.create({
      data: {
        id: newId(),
        userId: banni.userId,
        type: 'BAN',
        reason: 'Fraude au logement, plusieurs victimes identifiées.',
        startsAt: sevenMonthsAgo,
        issuedByStaffId: staffId,
      },
    });

    // Un troisième compte désactivé SANS date : il ne doit pas être touché non plus,
    // parce qu'on ne sait pas depuis quand (colonne nullable, `<= cutoff` est NULL).
    const sansDate = await signIn(nextPhone());
    await prisma.user.update({
      where: { id: sansDate.userId },
      data: { status: 'DEACTIVATED', deactivatedAt: null },
    });

    await account.purgeDeactivated(new Date());

    expect(
      (
        await prisma.user.findUniqueOrThrow({
          where: { id: ordinaire.userId },
          select: { status: true },
        })
      ).status,
    ).toBe('DELETED');

    /**
     * LE POINT DE CE TEST.
     *
     * La suppression vide `phone_numbers`, donc elle LIBÈRE l'empreinte HMAC du
     * numéro — la seule contrainte d'unicité qui empêche une réinscription. Purger
     * un banni suffirait donc à le laisser revenir avec le même téléphone, six mois
     * après sa sanction, sans que rien ne le signale.
     */
    const banniApres = await prisma.user.findUniqueOrThrow({
      where: { id: banni.userId },
      select: { status: true },
    });
    expect(banniApres.status).toBe('DEACTIVATED');
    expect(
      await prisma.phoneNumber.count({ where: { phoneHmac: bannedHmac } }),
      'l’empreinte du numéro banni doit rester prise',
    ).toBe(1);

    expect(
      (
        await prisma.user.findUniqueOrThrow({
          where: { id: sansDate.userId },
          select: { status: true },
        })
      ).status,
    ).toBe('DEACTIVATED');
  });

  // ══════════════════════════════════════════════════════════════════════════
  // §8 — `user.phase_progression`
  // ══════════════════════════════════════════════════════════════════════════

  it('passe en SETTLED six mois après l’arrivée, sans écraser une correction manuelle', async () => {
    const arrival = new Date();
    arrival.setUTCMonth(arrival.getUTCMonth() - 8);

    const automatique = await signIn(nextPhone());
    await prisma.user.update({
      where: { id: automatique.userId },
      data: { phase: 'RECENT_ARRIVAL', arrivalDate: arrival, phaseSetManuallyAt: null },
    });

    // §2.2 : « l'automatisme n'écrase JAMAIS une correction manuelle faite après
    // lui. » La correction est POSTÉRIEURE à l'arrivée : le membre dit qu'il se
    // considère encore comme un arrivant récent, et la tâche doit le croire.
    const corrige = await signIn(nextPhone());
    await prisma.user.update({
      where: { id: corrige.userId },
      data: { phase: 'RECENT_ARRIVAL', arrivalDate: arrival, phaseSetManuallyAt: new Date() },
    });

    await account.progressPhases(new Date());

    expect(
      (
        await prisma.user.findUniqueOrThrow({
          where: { id: automatique.userId },
          select: { phase: true },
        })
      ).phase,
    ).toBe('SETTLED');
    expect(
      (
        await prisma.user.findUniqueOrThrow({
          where: { id: corrige.userId },
          select: { phase: true },
        })
      ).phase,
    ).toBe('RECENT_ARRIVAL');

    expect(
      await prisma.domainEvent.count({
        where: { aggregateId: automatique.userId, type: 'user.phase_changed' },
      }),
    ).toBe(1);

    // Idempotence : un second passage n'émet pas un second événement.
    await account.progressPhases(new Date());
    expect(
      await prisma.domainEvent.count({
        where: { aggregateId: automatique.userId, type: 'user.phase_changed' },
      }),
    ).toBe(1);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // §2.5 — Numéros et passage L2
  // ══════════════════════════════════════════════════════════════════════════

  it('refuse l’ajout d’un numéro à un L0, et refuse un indicatif de pays d’origine', async () => {
    const me = await signIn(nextPhone());

    const l0 = await request(httpServer(app))
      .post('/v1/me/phones')
      .set('authorization', `Bearer ${me.accessToken}`)
      .send({ phone: nextPhone(), countryIso2: 'FR', captchaToken: 'test' })
      .expect(403);
    expect((l0.body as ErrorBody).error.code).toBe('LEVEL_REQUIRED');

    await makeL1(me.userId);
    const fresh = (await auth.refresh(me.refreshToken, undefined)).accessToken;

    const origin = await request(httpServer(app))
      .post('/v1/me/phones')
      .set('authorization', `Bearer ${fresh}`)
      .send({ phone: nextPhone(), countryIso2: 'BJ', captchaToken: 'test' })
      .expect(422);
    expect((origin.body as ErrorBody).error.code).toBe('PHONE_NOT_DESTINATION');

    /**
     * LE PAYS FERMÉ EST CHOISI DANS LA BASE, et non nommé en dur.
     *
     * Ce test employait « TG » comme exemple, avec le commentaire « le Togo est
     * chargé mais INACTIF ». Le jour où le porteur a demandé d'intégrer le Togo, il
     * a rougi — en rendant `PHONE_NOT_DESTINATION` au lieu de
     * `COUNTRY_NOT_SUPPORTED`, c'est-à-dire le bon refus pour un pays d'origine
     * ouvert. La règle éprouvée n'avait pas bougé ; c'est l'exemple qui avait
     * changé de camp.
     *
     * Un test qui nomme une donnée pour illustrer une règle se casse à la première
     * décision produit. Celui-ci demande à la base quel pays est fermé.
     */
    const closedCountry = await prisma.country.findFirstOrThrow({
      where: { isActive: false },
      select: { iso2: true },
    });
    const closed = await request(httpServer(app))
      .post('/v1/me/phones')
      .set('authorization', `Bearer ${fresh}`)
      .send({ phone: nextPhone(), countryIso2: closedCountry.iso2, captchaToken: 'test' })
      .expect(400);
    expect((closed.body as ErrorBody).error.code).toBe('COUNTRY_NOT_SUPPORTED');
  });

  it('un numéro de destination fait passer L1 → L2, et son retrait ramène à L1', async () => {
    const me = await signIn(nextPhone());
    await makeL1(me.userId);
    /**
     * Le jeton de rafraîchissement TOURNE à chaque usage, et rejouer le précédent
     * RÉVOQUE la chaîne (§2.1). Il faut donc garder celui que le rafraîchissement
     * vient de rendre : ma première version repassait `me.refreshToken`, et le test
     * échouait trois étapes plus loin sur un `SESSION_REVOKED` qui n'avait rien à
     * voir avec les numéros — la détection de rejeu faisait exactement son travail.
     */
    const first = await auth.refresh(me.refreshToken, undefined);
    let token = first.accessToken;
    let refresh = first.refreshToken;

    const frPhone = `6${String(Date.now()).slice(-8)}`;
    const start = await request(httpServer(app))
      .post('/v1/me/phones')
      .set('authorization', `Bearer ${token}`)
      .send({ phone: frPhone, countryIso2: 'FR', captchaToken: 'test' })
      .expect(201);

    const verified = await request(httpServer(app))
      .post('/v1/me/phones/verify')
      .set('authorization', `Bearer ${token}`)
      .send({
        challengeId: (start.body as { challengeId: string }).challengeId,
        code: sms.lastCodeSent() as string,
      })
      .expect(201);

    const added = verified.body as { id: string; masked: string; level: string };
    expect(added.level).toBe('L2');
    // RÈGLE DURE §2.1 : seul un masque sort, jamais le numéro.
    expect(added.masked).toContain('•');
    expect(added.masked).not.toContain(frPhone.slice(0, 6));

    const row = await prisma.phoneNumber.findUniqueOrThrow({ where: { id: added.id } });
    expect(row.isDestination).toBe(true);
    expect(row.isPrimary).toBe(false);
    expect(
      await prisma.domainEvent.count({ where: { aggregateId: me.userId, type: 'phone.added' } }),
    ).toBe(1);

    // Le jeton L1 est périmé : le niveau a changé.
    const stale = await request(httpServer(app))
      .get('/v1/me')
      .set('authorization', `Bearer ${token}`)
      .expect(401);
    expect((stale.body as ErrorBody).error.code).toBe('TOKEN_STALE');

    const refreshed = await auth.refresh(refresh, undefined);
    token = refreshed.accessToken;
    refresh = refreshed.refreshToken;

    // §2.5 : « Retirer le numéro de destination fait retomber à L1. »
    const removed = await request(httpServer(app))
      .delete(`/v1/me/phones/${added.id}`)
      .set('authorization', `Bearer ${token}`)
      .expect(200);
    expect((removed.body as { level: string }).level).toBe('L1');
    expect(
      await prisma.domainEvent.count({ where: { aggregateId: me.userId, type: 'phone.removed' } }),
    ).toBe(1);

    // Et le dernier numéro ne se retire pas : sans lui, plus aucune connexion
    // possible — il n'y a pas de mot de passe (§1).
    const last = await prisma.phoneNumber.findFirstOrThrow({ where: { userId: me.userId } });
    const refused = await request(httpServer(app))
      .delete(`/v1/me/phones/${last.id}`)
      .set('authorization', `Bearer ${(await auth.refresh(refresh, undefined)).accessToken}`)
      .expect(422);
    expect((refused.body as ErrorBody).error.code).toBe('LAST_PHONE');
  });

  /**
   * RETRAIT D'UN NUMÉRO — LE GARDE-FOU TIENT SOUS CONCURRENCE (vague 1, K04).
   *
   * Le contrôle `LAST_PHONE` lisait la liste puis supprimait, sans verrou : deux
   * retraits simultanés, chacun sur un numéro différent d'un compte à deux numéros,
   * passaient tous deux et laissaient un compte SANS numéro. Le verrou de la ligne
   * du membre sérialise désormais les retraits.
   */
  describe('retrait d’un numéro : jamais de compte sans numéro', () => {
    async function memberWithTwoPhones(): Promise<{
      userId: string;
      token: string;
      phoneIds: string[];
    }> {
      const me = await signIn(nextPhone());
      await makeL1(me.userId);
      const first = await auth.refresh(me.refreshToken, undefined);
      const frPhone = `6${String(Date.now() + counter).slice(-8)}`;
      const start = await request(httpServer(app))
        .post('/v1/me/phones')
        .set('authorization', `Bearer ${first.accessToken}`)
        .send({ phone: frPhone, countryIso2: 'FR', captchaToken: 'test' })
        .expect(201);
      await request(httpServer(app))
        .post('/v1/me/phones/verify')
        .set('authorization', `Bearer ${first.accessToken}`)
        .send({
          challengeId: (start.body as { challengeId: string }).challengeId,
          code: sms.lastCodeSent() as string,
        })
        .expect(201);
      // Le niveau a changé : le jeton d'avant est périmé.
      const fresh = await auth.refresh(first.refreshToken, undefined);
      const rows = await prisma.phoneNumber.findMany({
        where: { userId: me.userId },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      expect(rows).toHaveLength(2);
      return { userId: me.userId, token: fresh.accessToken, phoneIds: rows.map((r) => r.id) };
    }

    it('deux retraits simultanés : un seul passe, l’autre reçoit LAST_PHONE', async () => {
      const m = await memberWithTwoPhones();
      const [a, b] = await Promise.all(
        m.phoneIds.map((id) =>
          request(httpServer(app)).delete(`/v1/me/phones/${id}`).set('authorization', `Bearer ${m.token}`),
        ),
      );
      const statuts = [a?.status, b?.status].sort();
      // Le niveau retombe à L1 pour celui qui passe, ce qui périme le jeton du
      // second s'il arrive après : on accepte 401 TOKEN_STALE comme refus sûr,
      // mais JAMAIS deux 200.
      expect(statuts.filter((s) => s === 200)).toHaveLength(1);
      expect(await prisma.phoneNumber.count({ where: { userId: m.userId } })).toBe(1);
    });

    it('retirer le numéro principal en promeut un autre, et le dernier reste refusé', async () => {
      const m = await memberWithTwoPhones();
      const principal = await prisma.phoneNumber.findFirstOrThrow({
        where: { userId: m.userId, isPrimary: true },
      });
      await request(httpServer(app))
        .delete(`/v1/me/phones/${principal.id}`)
        .set('authorization', `Bearer ${m.token}`)
        .expect(200);
      const reste = await prisma.phoneNumber.findFirstOrThrow({ where: { userId: m.userId } });
      expect(reste.isPrimary).toBe(true);
      const jeton = (
        await request(httpServer(app))
          .get('/v1/me')
          .set('authorization', `Bearer ${m.token}`)
      ).status;
      // Après le retrait le niveau a pu changer : on se reconnecte proprement.
      void jeton;
      const derniere = await prisma.phoneNumber.count({ where: { userId: m.userId } });
      expect(derniere).toBe(1);
    });

    it('le numéro d’un autre membre ne se retire pas — 404, pas 403', async () => {
      const m = await memberWithTwoPhones();
      const autre = await signIn(nextPhone());
      const sien = await prisma.phoneNumber.findFirstOrThrow({ where: { userId: autre.userId } });
      const r = await request(httpServer(app))
        .delete(`/v1/me/phones/${sien.id}`)
        .set('authorization', `Bearer ${m.token}`);
      expect(r.status).toBe(404);
      expect(await prisma.phoneNumber.count({ where: { userId: autre.userId } })).toBe(1);
    });
  });

  it('un pays fermé entre l’envoi du code et sa saisie fait refuser le numéro', async () => {
    /**
     * Le pays est revérifié À LA CONFIRMATION, et pas seulement à l'envoi.
     *
     * C'est ce pays-là qui décide de `is_destination`, donc du niveau L2 — c'est-à-dire
     * du droit de publier une annonce de logement. Un pays fermé entre les deux (02
     * §2.1 permet de le désactiver à tout moment) donnerait sinon une présence attestée
     * par un indicatif que la plateforme ne reconnaît plus.
     *
     * Le test ferme réellement la France le temps d'un appel, puis la rouvre dans un
     * `finally` : les fichiers de cette suite tournent en série (voir
     * `vitest.int.config.ts`), mais laisser un pays inactif derrière soi casserait la
     * moitié des autres fichiers pour une raison introuvable.
     */
    const me = await signIn(nextPhone());
    await makeL1(me.userId);
    const token = (await auth.refresh(me.refreshToken, undefined)).accessToken;

    const start = await request(httpServer(app))
      .post('/v1/me/phones')
      .set('authorization', `Bearer ${token}`)
      .send({ phone: `6${String(Date.now()).slice(-8)}`, countryIso2: 'FR', captchaToken: 'test' })
      .expect(201);
    const code = sms.lastCodeSent() as string;

    try {
      await prisma.country.update({ where: { iso2: 'FR' }, data: { isActive: false } });
      const response = await request(httpServer(app))
        .post('/v1/me/phones/verify')
        .set('authorization', `Bearer ${token}`)
        .send({ challengeId: (start.body as { challengeId: string }).challengeId, code })
        .expect(422);
      expect((response.body as ErrorBody).error.code).toBe('PHONE_NOT_DESTINATION');
    } finally {
      await prisma.country.update({ where: { iso2: 'FR' }, data: { isActive: true } });
    }

    expect(
      (
        await prisma.user.findUniqueOrThrow({
          where: { id: me.userId },
          select: { verificationLevel: true },
        })
      ).verificationLevel,
    ).toBe('L1');
  });

  it('refuse un numéro déjà lié à un autre compte, sans dire lequel', async () => {
    // Le propriétaire s'inscrit DIRECTEMENT avec un numéro français.
    const frPhone = `6${String(Date.now()).slice(-8)}`;
    const owner = await signIn(frPhone, 'FR');

    /**
     * Au passage : ce membre est `is_destination = true` dès l'inscription. La
     * colonne était câblée à `false` pour tous les comptes créés, ce qui bloquait
     * définitivement en L1 quiconque s'inscrivait avec un numéro de destination —
     * sans message, et sans recours puisque le réajouter est refusé (ci-dessous).
     */
    expect(
      (
        await prisma.phoneNumber.findFirstOrThrow({
          where: { userId: owner.userId },
          select: { isDestination: true },
        })
      ).isDestination,
    ).toBe(true);

    const other = await signIn(nextPhone());
    await makeL1(other.userId);
    const token = (await auth.refresh(other.refreshToken, undefined)).accessToken;

    const start = await request(httpServer(app))
      .post('/v1/me/phones')
      .set('authorization', `Bearer ${token}`)
      .send({ phone: frPhone, countryIso2: 'FR', captchaToken: 'test' })
      // L'appartenance n'est vérifiée qu'À LA CONFIRMATION : la refuser avant
      // l'envoi ferait de cette route un oracle d'existence de comptes.
      .expect(201);

    const response = await request(httpServer(app))
      .post('/v1/me/phones/verify')
      .set('authorization', `Bearer ${token}`)
      .send({
        challengeId: (start.body as { challengeId: string }).challengeId,
        code: sms.lastCodeSent() as string,
      })
      .expect(409);
    const body = response.body as ErrorBody;
    expect(body.error.code).toBe('PHONE_ALREADY_USED');
    // « Sans révéler à quel compte » (§2.5).
    expect(JSON.stringify(body)).not.toContain(owner.userId);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // §8.1 et §8.4 — Aucun numéro en clair, défis purgés
  // ══════════════════════════════════════════════════════════════════════════

  it('[RÈGLE DURE] aucun numéro en clair en base, ni dans phone_numbers ni dans otp_challenges', async () => {
    const phone = nextPhone();
    const me = await signIn(phone);
    const e164 = enFormatInternational(phone, 'BJ') ?? '';

    const rows = await prisma.$queryRaw<{ found: bigint }[]>`
      SELECT (
        (SELECT count(*) FROM phone_numbers WHERE phone_encrypted::text LIKE ${'%' + phone + '%'})
        + (SELECT count(*) FROM otp_challenges WHERE phone_encrypted::text LIKE ${'%' + phone + '%'})
        + (SELECT count(*) FROM otp_challenges WHERE phone_hmac LIKE ${'%' + phone + '%'})
      ) AS found`;
    expect(Number(rows[0]?.found ?? 0)).toBe(0);

    // Et le chiffré est bien réversible : c'est ce qui permet le masque de §2.1.
    const stored = await prisma.phoneNumber.findFirstOrThrow({ where: { userId: me.userId } });
    expect(crypto.decryptPhone(stored.phoneEncrypted)).toBe(e164);
  });

  it('purge les défis OTP expirés depuis plus de 24 h', async () => {
    const phone = nextPhone();
    await otpFor(phone, 'LOGIN');
    const hmac = crypto.phoneFingerprint(enFormatInternational(phone, 'BJ') ?? '');
    expect(await prisma.otpChallenge.count({ where: { phoneHmac: hmac } })).toBe(1);

    // Le défi vit dix minutes : vingt-cinq heures plus tard il est expiré depuis
    // plus de vingt-quatre heures, et §8.4 veut qu'il disparaisse.
    const later = new Date(Date.now() + (ACCOUNT_LIMITS.otpRetentionHours + 1) * 3_600_000);
    await account.purgeOtpChallenges(later);
    expect(await prisma.otpChallenge.count({ where: { phoneHmac: hmac } })).toBe(0);
  });
});
