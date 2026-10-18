/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any, @typescript-eslint/no-base-to-string, @typescript-eslint/no-require-imports --
   les corps de réponse de supertest et les simulacres de fetch sont non typés par nature ; ce sont des fichiers d'épreuve. */
import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId } from '@app/db';
import { AppModule } from '../../../app.module';
import { numeroDEpreuve } from '../../../common/__tests__/numeros';
import { ApiErrorFilter } from '../../../common/error.filter';
import { PrismaService } from '../../../common/prisma.service';
import { EMAIL_PROVIDER, FakeEmailProvider, FakeSmsProvider, SMS_PROVIDER } from '../../../providers/providers';
import { AuthService } from '../../auth/auth.service';
import { EmailAddressService } from '../email-address.service';
import { NotificationsService } from '../notifications.service';

/**
 * Adresse email du membre (12 §3) et abonnements push (12 §2.4), PAR HTTP.
 *
 * Ce que ces cas tiennent, et que le service seul ne montrerait pas :
 *   · la route répond avec les bons codes et ne renvoie JAMAIS l'adresse en clair ;
 *   · l'adresse est chiffrée en base (aucun « @ » lisible dans la colonne) ;
 *   · « sans email vérifié, pas de canal email » (`has()`/`resolve()`) ;
 *   · un changement garde l'ancienne adresse active jusqu'à confirmation ;
 *   · le code est borné en essais et en durée, lié à l'adresse demandée.
 */
describe('adresse email et push — routes /me/email et /me/push-subscriptions', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let emails: FakeEmailProvider;
  let addresses: EmailAddressService;
  let notifications: NotificationsService;
  const created: string[] = [];
  let counter = 0;

  const http = (): Server => app.getHttpServer() as Server;

  async function member(): Promise<{ userId: string; bearer: string }> {
    const sms = app.get<FakeSmsProvider>(SMS_PROVIDER);
    const auth = app.get(AuthService);
    counter += 1;
    const otp = await auth.requestOtp({
      phone: numeroDEpreuve(900 + counter),
      countryIso2: 'BJ',
      captchaToken: 'test',
      purpose: 'SIGNUP',
      ip: undefined,
    });
    const session = await auth.verifyOtp({
      challengeId: otp.challengeId,
      code: sms.lastCodeSent() as string,
      ip: undefined,
      userAgent: undefined,
    });
    created.push(session.userId);
    return { userId: session.userId, bearer: `Bearer ${session.accessToken}` };
  }

  beforeAll(async () => {
    emails = new FakeEmailProvider();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(SMS_PROVIDER)
      .useValue(new FakeSmsProvider())
      .overrideProvider(EMAIL_PROVIDER)
      .useValue(emails)
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('v1');
    app.use(cookieParser());
    app.useGlobalFilters(new ApiErrorFilter());
    await app.init();
    prisma = app.get(PrismaService);
    addresses = app.get(EmailAddressService);
    notifications = app.get(NotificationsService);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: created } } });
    await app.close();
  });

  it('ajout : code envoyé, adresse masquée, rien de lisible en base, canal fermé tant que non vérifiée', async () => {
    const me = await member();
    const before = emails.sentCount();
    const res = await request(http())
      .post('/v1/me/email')
      .set('authorization', me.bearer)
      .send({ email: 'Jean.Dupont@Example.org' })
      .expect(200);
    expect(emails.sentCount()).toBe(before + 1);
    expect(res.body.pending.masked).toBe('j•••••••@example.org');
    expect(res.body.email).toBeNull();
    expect(JSON.stringify(res.body)).not.toContain('dupont');

    // Rien de lisible en base : ni dans `users`, ni dans la vérification en attente.
    const pending = await prisma.emailVerification.findUniqueOrThrow({ where: { userId: me.userId } });
    expect(Buffer.from(pending.emailEncrypted).toString('latin1')).not.toContain('example');
    expect(pending.codeHash).not.toContain(emails.lastCode() as string);

    // Pas vérifiée → pas de canal.
    expect(await addresses.has(me.userId)).toBe(false);
    expect(await addresses.resolve(me.userId)).toBeNull();
  });

  it('vérification : le bon code confirme, le canal s’ouvre, GET masque', async () => {
    const me = await member();
    await request(http()).post('/v1/me/email').set('authorization', me.bearer).send({ email: 'a.b@example.org' }).expect(200);
    const code = emails.lastCode() as string;

    const wrong = code === '000000' ? '111111' : '000000';
    const bad = await request(http()).post('/v1/me/email/verify').set('authorization', me.bearer).send({ code: wrong }).expect(422);
    expect(bad.body.error.code).toBe('EMAIL_CODE_INVALID');
    expect(bad.body.error.details.attemptsLeft).toBe(4);

    const ok = await request(http()).post('/v1/me/email/verify').set('authorization', me.bearer).send({ code }).expect(200);
    expect(ok.body).toMatchObject({ email: { masked: 'a•••@example.org', verified: true }, pending: null });
    expect(await addresses.has(me.userId)).toBe(true);
    expect(await addresses.resolve(me.userId)).toBe('a.b@example.org');

    const get = await request(http()).get('/v1/me/email').set('authorization', me.bearer).expect(200);
    expect(get.body.email.verified).toBe(true);
    expect(JSON.stringify(get.body)).not.toContain('a.b@example.org');

    const row = await prisma.user.findUniqueOrThrow({ where: { id: me.userId }, select: { emailEncrypted: true } });
    expect(Buffer.from(row.emailEncrypted as Uint8Array).toString('latin1')).not.toContain('@');
  });

  it('un code de 6 chiffres exact : forme invalide → 400', async () => {
    const me = await member();
    await request(http()).post('/v1/me/email/verify').set('authorization', me.bearer).send({ code: '12ab56' }).expect(400);
    await request(http()).post('/v1/me/email').set('authorization', me.bearer).send({ email: 'pas-un-email' }).expect(400);
  });

  it('sans vérification en cours → 409 ; sans session → 401', async () => {
    const me = await member();
    const res = await request(http()).post('/v1/me/email/verify').set('authorization', me.bearer).send({ code: '123456' }).expect(409);
    expect(res.body.error.code).toBe('EMAIL_NO_PENDING');
    await request(http()).post('/v1/me/email').send({ email: 'a@b.co' }).expect(401);
  });

  it('cinq essais faux brûlent le code, même le bon ensuite', async () => {
    const me = await member();
    await request(http()).post('/v1/me/email').set('authorization', me.bearer).send({ email: 'c@example.org' }).expect(200);
    const code = emails.lastCode() as string;
    const wrong = code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i += 1) {
      await request(http()).post('/v1/me/email/verify').set('authorization', me.bearer).send({ code: wrong }).expect(422);
    }
    const after = await request(http()).post('/v1/me/email/verify').set('authorization', me.bearer).send({ code }).expect(410);
    expect(after.body.error.code).toBe('EMAIL_CODE_EXPIRED');
    expect(await addresses.has(me.userId)).toBe(false);
  });

  it('un code expiré est refusé', async () => {
    const me = await member();
    await request(http()).post('/v1/me/email').set('authorization', me.bearer).send({ email: 'd@example.org' }).expect(200);
    const code = emails.lastCode() as string;
    await prisma.emailVerification.update({ where: { userId: me.userId }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const res = await request(http()).post('/v1/me/email/verify').set('authorization', me.bearer).send({ code }).expect(410);
    expect(res.body.error.code).toBe('EMAIL_CODE_EXPIRED');
  });

  it('renvoi immédiat refusé (429), puis permis après le délai', async () => {
    const me = await member();
    await request(http()).post('/v1/me/email').set('authorization', me.bearer).send({ email: 'e@example.org' }).expect(200);
    const res = await request(http()).post('/v1/me/email').set('authorization', me.bearer).send({ email: 'e@example.org' }).expect(429);
    expect(res.body.error.code).toBe('EMAIL_RESEND_TOO_SOON');
    await prisma.emailVerification.update({ where: { userId: me.userId }, data: { sentAt: new Date(Date.now() - 61_000) } });
    await request(http()).post('/v1/me/email').set('authorization', me.bearer).send({ email: 'e@example.org' }).expect(200);
  });

  it('changement : l’ancienne adresse reste active jusqu’à confirmation ; le code ne vaut que pour la nouvelle', async () => {
    const me = await member();
    const confirm = async (email: string): Promise<void> => {
      await request(http()).post('/v1/me/email').set('authorization', me.bearer).send({ email }).expect(200);
      await request(http()).post('/v1/me/email/verify').set('authorization', me.bearer).send({ code: emails.lastCode() }).expect(200);
    };
    await confirm('ancienne@example.org');
    await prisma.emailVerification.deleteMany({ where: { userId: me.userId } });

    const res = await request(http()).post('/v1/me/email').set('authorization', me.bearer).send({ email: 'nouvelle@example.org' }).expect(200);
    expect(res.body.email.masked).toBe('a•••••••@example.org');
    expect(res.body.pending.masked).toBe('n•••••••@example.org');
    expect(await addresses.resolve(me.userId)).toBe('ancienne@example.org');

    await request(http()).post('/v1/me/email/verify').set('authorization', me.bearer).send({ code: emails.lastCode() }).expect(200);
    expect(await addresses.resolve(me.userId)).toBe('nouvelle@example.org');
  });

  it('retrait : le canal s’éteint, la vérification en cours aussi', async () => {
    const me = await member();
    await request(http()).post('/v1/me/email').set('authorization', me.bearer).send({ email: 'f@example.org' }).expect(200);
    await request(http()).post('/v1/me/email/verify').set('authorization', me.bearer).send({ code: emails.lastCode() }).expect(200);
    await request(http()).delete('/v1/me/email').set('authorization', me.bearer).expect(204);
    expect(await addresses.has(me.userId)).toBe(false);
    const get = await request(http()).get('/v1/me/email').set('authorization', me.bearer).expect(200);
    expect(get.body).toEqual({ email: null, pending: null });
  });

  it('un email envoyé au membre part bien à l’adresse vérifiée (chaîne sendEmail)', async () => {
    const me = await member();
    await request(http()).post('/v1/me/email').set('authorization', me.bearer).send({ email: 'g@example.org' }).expect(200);
    await request(http()).post('/v1/me/email/verify').set('authorization', me.bearer).send({ code: emails.lastCode() }).expect(200);
    const outboundId = newId();
    await prisma.outboundMessage.create({
      data: { id: outboundId, channel: 'EMAIL', userId: me.userId, template: 'welcome', status: 'QUEUED' },
    });
    const before = emails.sentCount();
    expect(await notifications.sendEmail({ outboundId, userId: me.userId, template: 'welcome', variables: {} })).toBe('SENT');
    expect(emails.sentCount()).toBe(before + 1);
    await prisma.outboundMessage.delete({ where: { id: outboundId } });
  });

  // ── Push ──────────────────────────────────────────────────────────────────

  it('push : GET rend la clé VAPID et les appareils sans leurs capacités ; POST puis DELETE', async () => {
    const me = await member();
    const first = await request(http()).get('/v1/me/push-subscriptions').set('authorization', me.bearer).expect(200);
    expect(typeof first.body.publicKey).toBe('string');
    expect(first.body.subscriptions).toEqual([]);

    const sub = { endpoint: `https://push.example.test/${newId()}`, keys: { p256dh: 'BPk', auth: 'sec' }, userAgent: 'test' };
    const posted = await request(http()).post('/v1/me/push-subscriptions').set('authorization', me.bearer).send(sub).expect(201);
    const again = await request(http()).post('/v1/me/push-subscriptions').set('authorization', me.bearer).send(sub).expect(201);
    expect(again.body).toMatchObject({ id: posted.body.id, created: false });

    const list = await request(http()).get('/v1/me/push-subscriptions').set('authorization', me.bearer).expect(200);
    expect(list.body.subscriptions).toHaveLength(1);
    expect(JSON.stringify(list.body)).not.toContain(sub.endpoint);
    expect(JSON.stringify(list.body)).not.toContain('sec');

    await request(http()).delete(`/v1/me/push-subscriptions/${posted.body.id}`).set('authorization', me.bearer).expect(204);
    await request(http()).delete(`/v1/me/push-subscriptions/${posted.body.id}`).set('authorization', me.bearer).expect(404);
  });

  it('push : un 410 du service supprime l’abonnement tout de suite, sans attendre cinq échecs', async () => {
    const me = await member();
    const endpoint = `https://push.example.test/${newId()}`;
    await request(http()).post('/v1/me/push-subscriptions').set('authorization', me.bearer)
      .send({ endpoint, keys: { p256dh: 'k', auth: 'a' } }).expect(201);
    const outboundId = newId();
    await prisma.outboundMessage.create({
      data: { id: outboundId, channel: 'PUSH', userId: me.userId, template: 'push', status: 'QUEUED' },
    });
    const service = notifications as unknown as { pushProvider: { send: () => Promise<unknown> } };
    const original = service.pushProvider;
    service.pushProvider = { send: () => Promise.resolve({ delivered: false, gone: true }) };
    try {
      const out = await notifications.sendPush({ outboundId, userId: me.userId, title: 't', body: 'b' });
      expect(out).toEqual({ delivered: 0, removed: 1 });
    } finally {
      service.pushProvider = original;
    }
    expect(await prisma.pushSubscription.count({ where: { userId: me.userId } })).toBe(0);
    await prisma.outboundMessage.delete({ where: { id: outboundId } });
  });
});
