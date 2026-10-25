/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument --
   corps de réponse de supertest et du serveur démo : non typés par nature dans un fichier d'épreuve. */
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import sharp from 'sharp';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import webpush from 'web-push';
import { newId } from '@app/db';

/**
 * PARCOURS COMPLET EN MODE DÉMO — l'API, avec ses adaptateurs RÉELS, contre le serveur
 * démo (port aléatoire). Rien n'est substitué : `PROVIDER_MODE=demo` + les valeurs du
 * profil, exactement ce qu'un développeur lance avec `.env.demo.example`.
 *
 *   inscription par OTP (SMS Twilio lu dans l'inbox du démo) · captcha refusé ·
 *   portrait propre puis EICAR (rejeté par clamd) · modération d'un texte de test ·
 *   KYC accepté (webhook signé livré par le démo à l'API) puis refusé ·
 *   numéro de destination (L2) · justificatif · fiche pro · e-mail (Brevo) · push (VAPID).
 */
const env = await vi.hoisted(async () => {
  const { startDemoServer } = await import('@app/provider-demo');
  const { demoProfile } = await import('../../config/provider-demo-profile');
  const { createServer: net } = await import('node:net');
  const apiPort = await new Promise<number>((resolve) => {
    const s = net().listen(0, '127.0.0.1', () => {
      const p = (s.address() as { port: number }).port;
      s.close(() => resolve(p));
    });
  });
  // Le .env de développement pose déjà S3_*, DIDIT_*… dans l'environnement : les clés du démo
  // sont donc passées explicitement, celles du profil.
  const d = (await import('@app/provider-demo')).DEMO_DEFAULTS;
  const demo = await startDemoServer({
    twilioAccountSid: d.TWILIO_ACCOUNT_SID, twilioAuthToken: d.TWILIO_AUTH_TOKEN, brevoApiKey: d.BREVO_API_KEY,
    diditApiKey: d.DIDIT_API_KEY, diditWorkflowId: d.DIDIT_WORKFLOW_ID, diditWebhookSecret: d.DIDIT_WEBHOOK_SECRET,
    turnstileSecretKey: d.TURNSTILE_SECRET_KEY, s3AccessKeyId: d.S3_ACCESS_KEY_ID, s3SecretAccessKey: d.S3_SECRET_ACCESS_KEY,
    s3Bucket: d.S3_BUCKET, s3Region: d.S3_REGION, anthropicApiKey: d.ANTHROPIC_API_KEY, vapidPublicKey: '',
    port: 0, host: '127.0.0.1', diditWebhookUrl: `http://127.0.0.1:${apiPort}/v1/webhooks/didit` });
  for (const k of ['TWILIO_MESSAGING_SERVICE_SID']) delete process.env[k];
  Object.assign(process.env, demoProfile(demo.url), { PROVIDER_MODE: 'demo', DEMO_BASE_URL: demo.url, RATE_LIMIT_ENABLED: 'false' });
  return { demo, apiPort };
});

import { AppModule } from '../../app.module';
import { numeroDEpreuve } from '../../common/__tests__/numeros';
import { ApiErrorFilter } from '../../common/error.filter';
import { PrismaService } from '../../common/prisma.service';
import { ModerationService } from '../../modules/moderation/moderation.service';
import { NotificationsService } from '../../modules/notifications/notifications.service';

const { demo, apiPort } = env;
const CAPTCHA = 'XXXX.DUMMY.TOKEN.XXXX';
const EICAR = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';

describe('parcours complet — API en mode démo', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const created: string[] = [];
  let rank = 700;

  const api = (): any => request(`http://127.0.0.1:${apiPort}`);

  async function inbox(query: string): Promise<any[]> {
    return ((await (await fetch(`${demo.url}/__demo/inbox?${query}`)).json()) as { items: any[] }).items;
  }
  async function lastCode(kind: 'sms' | 'email', to: string): Promise<string> {
    const [entry] = await inbox(`kind=${kind}&to=${encodeURIComponent(to)}&limit=1`);
    expect(entry?.code, `aucun code ${kind} pour ${to} dans l'inbox du démo`).toMatch(/^\d{6}$/);
    return entry.code as string;
  }
  async function png(): Promise<Buffer> {
    return sharp({ create: { width: 64, height: 64, channels: 3, background: '#2a7' } }).png().toBuffer();
  }

  /** Inscription par OTP : le code est LU dans l'inbox du démo, pas dans les journaux. */
  async function signup(): Promise<{ agent: any; userId: string; token: string; phone: string }> {
    rank += 1;
    const phone = numeroDEpreuve(rank);
    const agent = request.agent(`http://127.0.0.1:${apiPort}`);
    const asked = await agent.post('/v1/auth/otp/request').send({ phone, countryIso2: 'BJ', captchaToken: CAPTCHA, purpose: 'SIGNUP', acceptTerms: true }).expect(200);
    const [sms] = await inbox('kind=sms&limit=1');
    const code = sms.code as string;
    const verified = await agent.post('/v1/auth/otp/verify').send({ challengeId: asked.body.challengeId, code }).expect(200);
    const userId = (JSON.parse(Buffer.from(String(verified.body.accessToken).split('.')[1] as string, 'base64url').toString()) as { sub: string }).sub;
    created.push(userId);
    return { agent, userId, token: verified.body.accessToken, phone };
  }

  const refresh = async (agent: any): Promise<string> => (await agent.post('/v1/auth/refresh').send({}).expect(200)).body.accessToken;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ rawBody: true });
    app.setGlobalPrefix('v1');
    app.use(cookieParser());
    app.useGlobalFilters(new ApiErrorFilter());
    await app.init();
    await app.listen(apiPort, '127.0.0.1');
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma?.user.deleteMany({ where: { id: { in: created.filter(Boolean) } } });
    await app?.close();
    await demo.close();
  });

  it('les adaptateurs en service sont les RÉELS, pointés sur le démo', () => {
    const names = [
      'SMS_PROVIDER', 'EMAIL_PROVIDER', 'PUSH_PROVIDER', 'KYC_PROVIDER',
      'AI_MODERATION_PROVIDER', 'CAPTCHA_PROVIDER', 'STORAGE_PROVIDER', 'ANTIVIRUS_PROVIDER',
    ];
    expect(names.map((n) => process.env[n])).toEqual(['twilio', 'brevo', 'webpush', 'didit', 'anthropic', 'turnstile', 's3', 'clamav']);
  });

  it('captcha refusé par Turnstile : aucun SMS part', async () => {
    const before = (await inbox('kind=sms')).length;
    const res = await api().post('/v1/auth/otp/request').send({ phone: numeroDEpreuve(699), countryIso2: 'BJ', captchaToken: 'fail-ce-jeton', purpose: 'SIGNUP', acceptTerms: true });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(res.body)).toContain('CAPTCHA');
    expect((await inbox('kind=sms')).length).toBe(before);
  });

  it('inscription, portrait propre servi depuis S3, puis EICAR rejeté par clamd', async () => {
    const me = await signup();
    expect((await inbox('kind=sms&limit=1'))[0].provider).toBe('twilio');

    const objectsBefore = demo.state.objects.size;
    const ok = await me.agent.put('/v1/me/avatar').set('authorization', `Bearer ${me.token}`).attach('file', await png(), { filename: 'p.png', contentType: 'image/png' });
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);
    expect(demo.state.objects.size).toBeGreaterThan(objectsBefore);
    const path = new URL(ok.body.url, 'http://x').pathname;
    const url = path.startsWith('/v1/') ? path : `/v1${path}`;
    const served = await api().get(url).set('authorization', `Bearer ${me.token}`);
    expect(served.status).toBe(200);
    expect(Buffer.from(served.body).length).toBeGreaterThan(50);

    const infected = Buffer.concat([await png(), Buffer.from(EICAR)]);
    const stored = demo.state.objects.size;
    const bad = await me.agent.put('/v1/me/avatar').set('authorization', `Bearer ${me.token}`).attach('file', infected, { filename: 'virus.png', contentType: 'image/png' });
    expect(bad.status).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(bad.body)).toContain('MEDIA_INFECTED');
    expect(demo.state.objects.size).toBe(stored);
    expect((await inbox('kind=scan')).some((e) => /FOUND/.test(e.body))).toBe(true);
  });

  it('modération IA d’un texte de test : verdict du démo, trace sans texte', async () => {
    const me = await signup();
    const moderation = app.get(ModerationService);
    const clean = await moderation.analyze({ subjectType: 'POST', subjectId: newId(), authorUserId: me.userId, redactedText: 'Bonjour, quelqu’un connaît une bonne boulangerie ?' });
    expect(clean.verdict).toBe('ALLOW');
    const scamId = newId();
    const scam = await moderation.analyze({ subjectType: 'POST', subjectId: scamId, authorUserId: me.userId, redactedText: 'Paiement garantie, envoie un acompte par Western Union' });
    expect(scam.verdict).toBe('BLOCK');
    expect(scam.labels).toEqual(expect.arrayContaining(['SCAM', 'MONEY_REQUEST']));
    const refused = await moderation.analyze({ subjectType: 'POST', subjectId: newId(), authorUserId: me.userId, redactedText: 'DEMO_REFUSAL' });
    expect(refused.verdict).toBe('QUEUE'); // le modèle refuse : repli humain, jamais « ALLOW » silencieux
    const trace = await prisma.aiModerationCheck.findFirstOrThrow({ where: { subjectId: scamId } });
    expect([trace.model, trace.verdict, trace.redacted]).toEqual(['claude-opus-5-5', 'BLOCK', true]);
  });

  it('KYC : accepté (webhook signé livré par le démo) → L1 ; refusé → DECLINED', async () => {
    const ok = await signup();
    const session = await ok.agent.post('/v1/me/kyc/session').set('authorization', `Bearer ${ok.token}`).send({}).expect(201);
    expect(session.body.verificationUrl).toContain(`${demo.url}/__demo/kyc/`);
    const submit = await fetch(session.body.verificationUrl, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'name=Awa+Test' });
    expect(submit.status).toBe(303);
    const kyc = demo.state.kyc.get(session.body.sessionId);
    expect(kyc?.deliveries.map((d) => d.status), JSON.stringify(kyc?.deliveries)).toEqual([200]);
    const token = await refresh(ok.agent);
    const status = await ok.agent.get('/v1/me/kyc').set('authorization', `Bearer ${token}`).expect(200);
    expect(status.body.status).toBe('APPROVED');

    const ko = await signup();
    const s2 = await ko.agent.post('/v1/me/kyc/session').set('authorization', `Bearer ${ko.token}`).send({}).expect(201);
    await fetch(s2.body.verificationUrl, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'name=Test+refus' });
    const status2 = await ko.agent.get('/v1/me/kyc').set('authorization', `Bearer ${ko.token}`);
    expect(status2.body.status).toBe('DECLINED');
  });

  it('webhook mal signé refusé ; mineur accepté mais pas majeur', async () => {
    const me = await signup();
    const bad = await api().post('/v1/webhooks/didit').set('content-type', 'application/json').set('x-signature', 'deadbeef').send('{"sessionId":"x","status":"APPROVED"}');
    expect(bad.status).toBe(401);
    const s = await me.agent.post('/v1/me/kyc/session').set('authorization', `Bearer ${me.token}`).send({}).expect(201);
    await fetch(s.body.verificationUrl, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'name=Jeune+mineur' });
    // Un mineur n'atteint pas L1 : le verdict est appliqué avec isAdult=false.
    const row = await prisma.kycVerification.findUniqueOrThrow({ where: { providerSessionId: s.body.sessionId } });
    expect([row.status, row.isAdult]).toEqual(['APPROVED', false]);
  });

  it('L2, justificatif (EICAR rejeté, propre accepté), fiche pro, e-mail Brevo et push VAPID', async () => {
    const me = await signup();
    let token = me.token;
    const s = await me.agent.post('/v1/me/kyc/session').set('authorization', `Bearer ${token}`).send({}).expect(201);
    await fetch(s.body.verificationUrl, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'name=Awa+Test' });
    token = await refresh(me.agent);

    // Numéro de destination : le SMS part par Twilio-démo vers un numéro français.
    const fr = `+3361${String(Math.floor(Math.random() * 1e7)).padStart(7, '0')}`;
    const dep = await me.agent.post('/v1/me/phones').set('authorization', `Bearer ${token}`).send({ phone: fr, countryIso2: 'FR', captchaToken: CAPTCHA }).expect(201);
    const verified = await me.agent.post('/v1/me/phones/verify').set('authorization', `Bearer ${token}`).send({ challengeId: dep.body.challengeId, code: await lastCode('sms', fr) }).expect(201);
    expect(verified.body.level).toBe('L2');
    token = await refresh(me.agent);

    const upload = (buf: Buffer, name: string, mime: string): any =>
      me.agent.post('/v1/media').set('authorization', `Bearer ${token}`).field('kind', 'PROOF').attach('file', buf, { filename: name, contentType: mime });
    const infected = await upload(Buffer.concat([await png(), Buffer.from(EICAR)]), 'justificatif.png', 'image/png');
    expect(JSON.stringify(infected.body)).toContain('MEDIA_INFECTED');
    const proof = await upload(await png(), 'justificatif.png', 'image/png');
    expect(proof.status, JSON.stringify(proof.body)).toBe(201);

    const profession = await prisma.profession.findFirst();
    const city = await prisma.city.findFirst({ where: { country: { iso2: 'FR' } } });
    if (profession !== null && city !== null) {
      const put = await me.agent.put('/v1/me/pro-profile').set('authorization', `Bearer ${token}`).send({
        professionId: profession.id, contactMethod: 'PLATFORM_MESSAGE', cityIds: [city.id], proofAssetId: proof.body.id,
        description: 'Accompagnement administratif, devis gratuit.',
      });
      expect(put.status, JSON.stringify(put.body)).toBeLessThan(300);
      const mine = await me.agent.get('/v1/me/pro-profile').set('authorization', `Bearer ${token}`).expect(200);
      expect(JSON.stringify(mine.body)).toContain(profession.id);
    }

    // E-mail : code envoyé par Brevo-démo, lu dans l'inbox.
    const email = `membre.${Date.now()}@example.org`;
    await me.agent.post('/v1/me/email').set('authorization', `Bearer ${token}`).send({ email }).expect(200);
    const mail = (await inbox(`kind=email&to=${encodeURIComponent(email)}&limit=1`))[0];
    expect(mail.provider).toBe('brevo');
    await me.agent.post('/v1/me/email/verify').set('authorization', `Bearer ${token}`).send({ code: mail.code }).expect(200);

    // Push : l'abonnement est créé chez le démo avec LA clé VAPID de l'API, puis un push part.
    const state = await me.agent.get('/v1/me/push-subscriptions').set('authorization', `Bearer ${token}`).expect(200);
    const vapidKey = state.body.vapidPublicKey ?? state.body.publicKey;
    expect(vapidKey).toBe(process.env['VAPID_PUBLIC_KEY']);
    expect(webpush.generateVAPIDKeys().publicKey).not.toBe(vapidKey);
    const sub = (await (await fetch(`${demo.url}/__demo/push/subscriptions`, { method: 'POST', body: JSON.stringify({ vapidPublicKey: vapidKey }) })).json()) as any;
    await me.agent.post('/v1/me/push-subscriptions').set('authorization', `Bearer ${token}`).send({ endpoint: sub.endpoint, keys: sub.keys }).expect(201);
    const outboundId = newId();
    await prisma.outboundMessage.create({ data: { id: outboundId, channel: 'PUSH', userId: me.userId, template: 'test', status: 'QUEUED' } });
    const sent = await app.get(NotificationsService).sendPush({ outboundId, userId: me.userId, title: 'Bienvenue', body: 'Votre profil est prêt', url: '/profil' });
    expect(sent).toMatchObject({ delivered: 1, removed: 0 });
    expect((await inbox(`kind=push&to=${sub.id}`))[0]).toMatchObject({ subject: 'Bienvenue', body: 'Votre profil est prêt' });
  });
});
