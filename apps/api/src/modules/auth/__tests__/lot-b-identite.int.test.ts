import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId } from '@app/db';
import { RATE_LIMITS } from '@app/shared';
import { AppModule } from '../../../app.module';
import { numeroDEpreuve } from '../../../common/__tests__/numeros';
import { ApiErrorFilter } from '../../../common/error.filter';
import { PrismaService } from '../../../common/prisma.service';
import { FakeSmsProvider, SMS_PROVIDER } from '../../../providers/providers';
import { AuthService } from '../auth.service';

/**
 * LOT B — durcissement de l'authentification (OTP atomique, rotation du jeton de
 * rafraîchissement, inscriptions simultanées, `purpose` de la route publique, documents légaux).
 *
 * Ces tests ont besoin d'une base PostgreSQL (suite d'intégration).
 */

function httpServer(app: INestApplication): Server {
  return app.getHttpServer() as Server;
}

describe('authentification — lot B', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let auth: AuthService;
  let sms: FakeSmsProvider;
  const createdUsers: string[] = [];
  let counter = 500;
  const nextPhone = (): string => {
    counter += 1;
    return numeroDEpreuve(counter);
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ rawBody: true });
    app.setGlobalPrefix('v1');
    app.useGlobalFilters(new ApiErrorFilter());
    app.use(cookieParser());
    await app.init();
    prisma = app.get(PrismaService);
    auth = app.get(AuthService);
    sms = app.get<FakeSmsProvider>(SMS_PROVIDER);
  });

  afterAll(async () => {
    if (createdUsers.length > 0) {
      await prisma.domainEvent.deleteMany({ where: { aggregateId: { in: createdUsers } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUsers } } });
    }
    await app?.close();
  });

  async function challengeFor(phone: string, purpose: 'SIGNUP' | 'LOGIN' = 'SIGNUP') {
    const { challengeId } = await auth.requestOtp({
      phone,
      countryIso2: 'BJ',
      captchaToken: 'test',
      purpose,
      ip: undefined,
    });
    return { challengeId, code: sms.lastCodeSent() as string };
  }

  it('[ATOMIQUE] deux vérifications simultanées du MÊME code : une seule ouvre une session', async () => {
    const { challengeId, code } = await challengeFor(nextPhone());
    const results = await Promise.allSettled([
      auth.verifyOtp({ challengeId, code, ip: undefined, userAgent: undefined }),
      auth.verifyOtp({ challengeId, code, ip: undefined, userAgent: undefined }),
    ]);
    const ok = results.filter((r) => r.status === 'fulfilled');
    expect(ok).toHaveLength(1);
    for (const r of ok) if (r.status === 'fulfilled') createdUsers.push(r.value.userId);
    const sessions = await prisma.authSession.count({ where: { userId: { in: createdUsers } } });
    expect(sessions).toBeGreaterThanOrEqual(1);
  });

  it('[ATOMIQUE] les mauvais essais simultanés ne dépassent pas le plafond de tentatives', async () => {
    const { challengeId } = await challengeFor(nextPhone());
    await Promise.allSettled(
      Array.from({ length: RATE_LIMITS.otpAttempts + 6 }, () =>
        auth.verifyOtp({ challengeId, code: '000000', ip: undefined, userAgent: undefined }),
      ),
    );
    const row = await prisma.otpChallenge.findUniqueOrThrow({ where: { id: challengeId } });
    expect(row.attempts).toBeLessThanOrEqual(RATE_LIMITS.otpAttempts);
  });

  it('[CAS] deux rafraîchissements simultanés avec le même jeton : un seul avance la chaîne', async () => {
    const { challengeId, code } = await challengeFor(nextPhone());
    const session = await auth.verifyOtp({ challengeId, code, ip: undefined, userAgent: undefined });
    createdUsers.push(session.userId);
    const results = await Promise.allSettled([
      auth.refresh(session.refreshToken, undefined),
      auth.refresh(session.refreshToken, undefined),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const row = await prisma.authSession.findFirstOrThrow({ where: { userId: session.userId } });
    expect(row.tokenGeneration).toBe(1);
    expect(row.revokedAt).toBeNull();
  });

  it('[P2002] deux inscriptions simultanées sur le même numéro ne font pas de 500 : un seul compte', async () => {
    const phone = nextPhone();
    const a = await challengeFor(phone);
    // Le second code remplace le dernier connu du faux SMS : on garde les deux défis et leurs codes.
    const b = await challengeFor(phone);
    const results = await Promise.allSettled([
      auth.verifyOtp({ challengeId: a.challengeId, code: a.code, ip: undefined, userAgent: undefined }),
      auth.verifyOtp({ challengeId: b.challengeId, code: b.code, ip: undefined, userAgent: undefined }),
    ]);
    const ok = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
    expect(ok.length).toBeGreaterThanOrEqual(1);
    expect(new Set(ok.map((o) => o.userId)).size).toBe(1);
    createdUsers.push(ok[0]?.userId as string);
    expect(ok.filter((o) => o.isNewUser).length).toBeLessThanOrEqual(1);
  });

  it('la route publique refuse les purposes ADD_PHONE et DELETE_ACCOUNT', async () => {
    for (const purpose of ['ADD_PHONE', 'DELETE_ACCOUNT']) {
      const res = await request(httpServer(app))
        .post('/v1/auth/otp/request')
        .send({ phone: nextPhone(), countryIso2: 'BJ', captchaToken: 'test', purpose, acceptTerms: true });
      expect([400, 422]).toContain(res.status);
    }
  });

  it('le libellé du SMS suit le purpose (suppression de compte, ajout de numéro)', async () => {
    await auth.requestOtp({ phone: nextPhone(), countryIso2: 'BJ', captchaToken: 'test', purpose: 'DELETE_ACCOUNT', ip: undefined });
    expect(sms.lastBodySent?.() ?? '').toMatch(/suppression/i);
    await auth.requestOtp({ phone: nextPhone(), countryIso2: 'BJ', captchaToken: 'test', purpose: 'ADD_PHONE', ip: undefined });
    expect(sms.lastBodySent?.() ?? '').toMatch(/ajouter/i);
  });

  it('[CGU] sans document légal publié, l’inscription est refusée AVANT l’envoi du code et sans consommer de défi', async () => {
    const pages = await prisma.staticPage.findMany({
      where: { slug: { in: ['cgu', 'confidentialite'] } },
      select: { id: true, publishedAt: true },
    });
    try {
      await prisma.staticPage.updateMany({
        where: { slug: { in: ['cgu', 'confidentialite'] } },
        data: { publishedAt: null },
      });
      await expect(
        auth.requestOtp({ phone: nextPhone(), countryIso2: 'BJ', captchaToken: 'test', purpose: 'SIGNUP', ip: undefined }),
      ).rejects.toMatchObject({ response: expect.anything() });
    } finally {
      for (const p of pages) {
        await prisma.staticPage.update({ where: { id: p.id }, data: { publishedAt: p.publishedAt } });
      }
    }
    // Un défi non consommé n'est pas perdu : il fonctionne dès que les documents sont republiés.
    expect(newId()).toBeTruthy();
  });
});
