/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any --
   corps JSON du serveur démo : non typés par nature dans un fichier d'épreuve. */
import { createHmac } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import webpush from 'web-push';
import { startDemoServer, type DemoServer } from '@app/provider-demo';
import { AnthropicModerationProvider } from '../anthropic-moderation.provider';
import { BrevoEmailProvider } from '../brevo-email.provider';
import { ClamAvAntivirusProvider } from '../clamav-antivirus.provider';
import { DiditKycProvider, isAdultFromDecision, normalizeDiditWebhook } from '../didit-kyc.provider';
import { ProviderError } from '../http';
import { S3StorageProvider } from '../s3-storage.provider';
import { TurnstileCaptchaProvider } from '../turnstile-captcha.provider';
import { TwilioSmsProvider } from '../twilio-sms.provider';
import { WebPushProvider } from '../webpush.provider';

/**
 * Les adaptateurs RÉELS contre le serveur démo (port aléatoire) : succès ET erreurs.
 *
 * Contrairement à `adapters.test.ts` (qui simule `fetch` et vérifie ce qui PART), ces
 * épreuves font tourner le vrai code réseau — le SDK S3 et sa signature SigV4, le SDK
 * Anthropic, `web-push`, le protocole clamd — contre un serveur qui répond comme le
 * fournisseur. Ce qu'elles ne disent toujours pas : que le vrai fournisseur accepte.
 */
const KEYS = {
  twilioSid: 'ACdemo00000000000000000000000000',
  twilioToken: 'demo-twilio-auth-token',
  brevo: 'xkeysib-demo-brevo-api-key',
  didit: 'demo-didit-api-key',
  workflow: 'demo-didit-workflow',
  webhookSecret: 'demo-didit-webhook-secret-0123456789',
  s3Key: 'demo-access-key',
  s3Secret: 'demo-secret-key-0123456789abcdef',
  anthropic: 'sk-ant-demo-anthropic-key',
};

let demo: DemoServer;
let hook: Server;
const webhooks: { headers: Record<string, string | string[] | undefined>; raw: string }[] = [];

async function inbox(query: string): Promise<any[]> {
  const res = await fetch(`${demo.url}/__demo/inbox?${query}`);
  return ((await res.json()) as { items: any[] }).items;
}
async function post(path: string, body: unknown): Promise<any> {
  const res = await fetch(`${demo.url}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return res.json();
}

beforeAll(async () => {
  hook = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      webhooks.push({ headers: req.headers, raw: Buffer.concat(chunks).toString('utf8') });
      res.writeHead(200).end('{}');
    });
  });
  await new Promise<void>((r) => hook.listen(0, '127.0.0.1', r));
  const hookPort = (hook.address() as { port: number }).port;
  demo = await startDemoServer({ port: 0, host: '127.0.0.1', diditWebhookUrl: `http://127.0.0.1:${hookPort}/v1/webhooks/didit` });
});
afterAll(async () => {
  await demo.close();
  hook.close();
});
beforeEach(async () => {
  await post('/__demo/reset', {});
  webhooks.length = 0;
});

const twilio = (token = KEYS.twilioToken): TwilioSmsProvider =>
  new TwilioSmsProvider({ accountSid: KEYS.twilioSid, authToken: token, from: '+15005550006', baseUrl: demo.url });

describe('Twilio contre le démo', () => {
  it('envoie : 201, sid SM…, SMS lisible dans l’inbox avec son code', async () => {
    const out = await twilio().send('+33612345678', 'Votre code : 482913');
    expect(out.providerRef).toMatch(/^SM[0-9a-f]{32}$/);
    const [sms] = await inbox('kind=sms&to=33612345678');
    expect(sms).toMatchObject({ kind: 'sms', code: '482913', to: '+33612345678' });
  });

  it('jeton faux → 401 (20003), non réessayable', async () => {
    const error = await twilio('mauvais').send('+33612345678', 'x').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ProviderError);
    expect((error as ProviderError).status).toBe(401);
    expect((error as ProviderError).message).toContain('20003');
    expect((error as ProviderError).retryable).toBe(false);
  });

  it('numéros de test : invalide → 400/21211 ; 5xx → réessayable ; 429 → réessayable', async () => {
    const invalid = (await twilio().send('+15005550001', 'x').catch((e: unknown) => e)) as ProviderError;
    expect(invalid.status).toBe(400);
    expect(invalid.message).toContain('21211');
    const down = (await twilio().send('+15005550500', 'x').catch((e: unknown) => e)) as ProviderError;
    expect([down.status, down.retryable]).toEqual([503, true]);
    const limited = (await twilio().send('+15005550429', 'x').catch((e: unknown) => e)) as ProviderError;
    expect([limited.status, limited.retryable]).toEqual([429, true]);
    expect(await inbox('kind=sms')).toHaveLength(0);
  });

  it('statut : delivered ; numéro …5559999 → undelivered (30003)', async () => {
    const auth = `Basic ${Buffer.from(`${KEYS.twilioSid}:${KEYS.twilioToken}`).toString('base64')}`;
    const ok = await twilio().send('+33612345678', 'x');
    const bad = await twilio().send('+15005559999', 'x');
    const get = async (sid: string): Promise<any> =>
      (await fetch(`${demo.url}/2010-04-01/Accounts/${KEYS.twilioSid}/Messages/${sid}.json`, { headers: { authorization: auth } })).json();
    expect((await get(ok.providerRef)).status).toBe('delivered');
    expect(await get(bad.providerRef)).toMatchObject({ status: 'undelivered', error_code: 30003 });
  });
});

describe('Brevo contre le démo', () => {
  const brevo = (key = KEYS.brevo): BrevoEmailProvider =>
    new BrevoEmailProvider({ apiKey: key, fromAddress: 'no-reply@x.test', fromName: 'X', appName: 'X', baseUrl: demo.url });

  it('envoie : messageId, e-mail et code lisibles, en-tête List-Unsubscribe conservé', async () => {
    const out = await brevo().send('membre@example.org', 'email_verification', {
      code: '654321',
      unsubscribeUrl: 'https://app.test/unsubscribe?t=abc',
    });
    expect(out.providerRef).toMatch(/^<.+@smtp-relay\.demo>$/);
    const [mail] = await inbox('kind=email&to=membre@example.org');
    expect(mail.code).toBe('654321');
    expect(mail.links).toContain('https://app.test/unsubscribe?t=abc');
    expect(mail.meta.headers['List-Unsubscribe']).toBe('<https://app.test/unsubscribe?t=abc>');
    expect(mail.meta.tags).toEqual(['email_verification']);
  });

  it('clé fausse → 401 ; destinataire « fail@ » → 400 ; « down@ » → 503 réessayable', async () => {
    const e1 = (await brevo('mauvaise').send('a@example.org', 'welcome', {}).catch((e: unknown) => e)) as ProviderError;
    expect(e1.status).toBe(401);
    const e2 = (await brevo().send('fail@example.org', 'welcome', {}).catch((e: unknown) => e)) as ProviderError;
    expect(e2.status).toBe(400);
    const e3 = (await brevo().send('down@example.org', 'welcome', {}).catch((e: unknown) => e)) as ProviderError;
    expect([e3.status, e3.retryable]).toEqual([503, true]);
  });
});

describe('Didit contre le démo', () => {
  const didit = (apiKey = KEYS.didit, workflowId = KEYS.workflow): DiditKycProvider =>
    new DiditKycProvider({ apiKey, workflowId, baseUrl: demo.url, callbackUrl: 'http://localhost:3176/profil' });

  async function run(name: string): Promise<{ id: string; webhook: Record<string, unknown> | null }> {
    const session = await didit().createSession('user-1');
    await post(`/__demo/kyc/${session.providerSessionId}/decide`, { name });
    const last = webhooks[webhooks.length - 1];
    // Le webhook est vérifié comme le fait KycService : HMAC-SHA256 du corps brut.
    expect(last?.headers['x-signature']).toBe(createHmac('sha256', KEYS.webhookSecret).update(last?.raw ?? '').digest('hex'));
    expect(Math.abs(Number(last?.headers['x-timestamp']) - Date.now() / 1000)).toBeLessThan(30);
    return { id: session.providerSessionId, webhook: normalizeDiditWebhook(JSON.parse(last?.raw ?? '{}')) };
  }

  it('crée une session (url hébergée), statut NOT_STARTED avant décision', async () => {
    const s = await didit().createSession('user-1');
    expect(s.verificationUrl).toBe(`${demo.url}/__demo/kyc/${s.providerSessionId}`);
    expect(await didit().getStatus(s.providerSessionId)).toEqual({ status: 'NOT_STARTED' });
    const page = await (await fetch(s.verificationUrl)).text();
    expect(page).toContain('<form');
  });

  it('nom ordinaire → APPROVED majeur ; getStatus et webhook concordent', async () => {
    const { id, webhook } = await run('Awa Test');
    expect(webhook).toMatchObject({ sessionId: id, status: 'APPROVED', isAdult: true });
    expect(await didit().getStatus(id)).toEqual({ status: 'APPROVED', isAdult: true });
  });

  it('« refus » → DECLINED avec code ; « mineur » → majorité fausse ; « revue » → IN_REVIEW', async () => {
    const declined = await run('Test refus');
    expect(declined.webhook).toMatchObject({ status: 'DECLINED', declineReasonCode: 'DOCUMENT_NOT_SUPPORTED' });
    const minor = await run('Jeune mineur');
    expect(minor.webhook).toMatchObject({ status: 'APPROVED', isAdult: false });
    expect(isAdultFromDecision(await (await fetch(`${demo.url}/v2/session/${minor.id}/decision/`, { headers: { 'x-api-key': KEYS.didit } })).json())).toBe(false);
    expect((await run('en revue')).webhook).toMatchObject({ status: 'IN_REVIEW' });
  });

  it('la page hébergée décide aussi (formulaire) et redirige vers le retour', async () => {
    const s = await didit().createSession('user-2');
    const res = await fetch(s.verificationUrl, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'name=Awa+refus' });
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('http://localhost:3176/profil');
    expect((await didit().getStatus(s.providerSessionId)).status).toBe('DECLINED');
  });

  it('clé fausse → 401 ; workflow inconnu → 404 ; session inconnue → 404', async () => {
    expect(((await didit('x').createSession('u').catch((e: unknown) => e)) as ProviderError).status).toBe(401);
    expect(((await didit(KEYS.didit, 'autre').createSession('u').catch((e: unknown) => e)) as ProviderError).status).toBe(404);
    expect(((await didit().getStatus('inconnue').catch((e: unknown) => e)) as ProviderError).status).toBe(404);
  });
});

describe('Turnstile contre le démo', () => {
  const ts = (secret = '1x0000000000000000000000000000000AA'): TurnstileCaptchaProvider =>
    new TurnstileCaptchaProvider(secret, { baseUrl: demo.url });

  it('jeton factice du front accepté ; jeton « fail… » refusé ; clés de test 2x et inconnue refusées', async () => {
    expect(await ts().verify('XXXX.DUMMY.TOKEN.XXXX', '203.0.113.9')).toBe(true);
    expect(await ts().verify('fail-ce-jeton')).toBe(false);
    expect(await ts('2x0000000000000000000000000000000AA').verify('XXXX.DUMMY.TOKEN.XXXX')).toBe(false);
    expect(await ts('clef-inconnue').verify('XXXX.DUMMY.TOKEN.XXXX')).toBe(false);
  });

  it('une panne refuse (serveur injoignable → false)', async () => {
    expect(await new TurnstileCaptchaProvider('1x0000000000000000000000000000000AA', { baseUrl: 'http://127.0.0.1:9', timeoutMs: 500 }).verify('jeton')).toBe(false);
  });
});

describe('S3 contre le démo (SDK officiel, SigV4 vérifiée)', () => {
  const s3 = (secret = KEYS.s3Secret, bucket = 'app-media'): S3StorageProvider =>
    new S3StorageProvider({ endpoint: demo.url, region: 'eu-west-1', bucket, accessKeyId: KEYS.s3Key, secretAccessKey: secret, forcePathStyle: true });

  it('put / get / delete, clé absente → null, suppression idempotente', async () => {
    const body = Buffer.from('octets de test é');
    await s3().put('avatars/u1/p.png', body, 'image/png');
    const got = await s3().get('avatars/u1/p.png');
    expect(got?.body.equals(body)).toBe(true);
    expect(got?.mime).toBe('image/png');
    await s3().delete('avatars/u1/p.png');
    await s3().delete('avatars/u1/p.png');
    expect(await s3().get('avatars/u1/p.png')).toBeNull();
    expect(await s3().get('jamais/ecrit')).toBeNull();
  });

  it('clés avec caractères spéciaux et gros objet (> 64 Kio)', async () => {
    const big = Buffer.alloc(300_000, 7);
    await s3().put('exports/été 2026/rapport (1).bin', big, 'application/octet-stream');
    expect((await s3().get('exports/été 2026/rapport (1).bin'))?.body.equals(big)).toBe(true);
  });

  it('secret faux → 403 SignatureDoesNotMatch ; seau inconnu → NoSuchBucket', async () => {
    await expect(s3('mauvais-secret').put('k', Buffer.from('x'), 'text/plain')).rejects.toMatchObject({ name: 'SignatureDoesNotMatch' });
    await expect(s3(KEYS.s3Secret, 'autre-seau').put('k', Buffer.from('x'), 'text/plain')).rejects.toMatchObject({ name: 'NoSuchBucket' });
  });

  it('URL pré-signée d’envoi puis de lecture ; altérée ou expirée → 403', async () => {
    const { url } = await s3().createUploadUrl('uploads/direct.txt', 'text/plain');
    const put = await fetch(url, { method: 'PUT', headers: { 'content-type': 'text/plain' }, body: 'direct' });
    expect(put.status).toBe(200);
    const down = await s3().createDownloadUrl('uploads/direct.txt', 60);
    expect(await (await fetch(down)).text()).toBe('direct');
    expect((await fetch(down.replace('direct.txt', 'autre.txt'))).status).toBe(403);
    const short = await s3().createDownloadUrl('uploads/direct.txt', 1);
    await new Promise((r) => setTimeout(r, 2200));
    const expired = await fetch(short);
    expect(expired.status).toBe(403);
    expect(await expired.text()).toContain('Request has expired');
  });
});

describe('ClamAV contre le démo (clamd INSTREAM sur le même port)', () => {
  const av = (port = demo.port): ClamAvAntivirusProvider => new ClamAvAntivirusProvider({ host: '127.0.0.1', port, timeoutMs: 3000 });

  it('fichier propre (y compris multi-blocs) → clean ; EICAR → signature', async () => {
    expect(await av().scan(Buffer.from('bonjour'))).toEqual({ clean: true });
    expect(await av().scan(Buffer.alloc(200_000, 1))).toEqual({ clean: true });
    const eicar = Buffer.from('X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*');
    expect(await av().scan(eicar)).toEqual({ clean: false, signature: 'Win.Test.EICAR_HDB-1' });
    expect(await av().scan(Buffer.from('DEMO-VIRUS-TEST'))).toMatchObject({ clean: false });
  });

  it('panne simulée (ERROR) ou port fermé → l’adaptateur LÈVE, ne rend jamais clean', async () => {
    await expect(av().scan(Buffer.from('DEMO-CLAMD-ERROR'))).rejects.toThrow(/ClamAV/);
    await expect(av(9).scan(Buffer.from('x'))).rejects.toThrow(/ClamAV/);
  });
});

describe('Web Push contre le démo (VAPID vérifié, charge déchiffrée)', () => {
  const vapid = webpush.generateVAPIDKeys();
  const sender = (keys = vapid): WebPushProvider => new WebPushProvider({ publicKey: keys.publicKey, privateKey: keys.privateKey, subject: 'mailto:ops@example.org' });
  const subscribe = async (): Promise<{ id: string; endpoint: string; p256dh: string; auth: string }> => {
    const s = await post('/__demo/push/subscriptions', {});
    return { id: s.id, endpoint: s.endpoint, p256dh: s.keys.p256dh, auth: s.keys.auth };
  };

  it('livre : 201, titre/corps/lien déchiffrés dans l’inbox', async () => {
    const sub = await subscribe();
    const out = await sender().send(sub, { title: 'Bonjour', body: 'Un nouveau message', url: '/messages' });
    expect(out).toEqual({ delivered: true });
    const [entry] = await inbox(`kind=push&to=${sub.id}`);
    expect(entry).toMatchObject({ subject: 'Bonjour', body: 'Un nouveau message', links: ['/messages'] });
  });

  it('abonnement révoqué → 410 → gone ; inconnu → 404 → gone', async () => {
    const sub = await subscribe();
    await post(`/__demo/push/${sub.id}/revoke`, {});
    expect(await sender().send(sub, { title: 't', body: 'b' })).toEqual({ delivered: false, gone: true });
    expect(await sender().send({ ...sub, endpoint: `${demo.url}/push/inconnu` }, { title: 't', body: 'b' })).toEqual({ delivered: false, gone: true });
  });

  it('autre clé VAPID que celle de l’abonnement → 403', async () => {
    const sub = await subscribe();
    await sender().send(sub, { title: 'premier', body: 'lie la clé' });
    const error = (await sender(webpush.generateVAPIDKeys()).send(sub, { title: 'x', body: 'y' }).catch((e: unknown) => e)) as ProviderError;
    expect(error).toBeInstanceOf(ProviderError);
    expect(error.status).toBe(403);
  });
});

describe('Anthropic contre le démo (SDK officiel)', () => {
  const ai = (apiKey = KEYS.anthropic): AnthropicModerationProvider =>
    new AnthropicModerationProvider({ apiKey, model: 'claude-opus-5-5', baseUrl: demo.url, timeoutMs: 5000 });

  it('verdicts déterministes selon des mots-clés', async () => {
    expect(await ai().classify('Bonjour, quelqu’un connaît une bonne boulangerie à Lyon ?')).toMatchObject({ labels: ['OK'], score: 0.05, model: 'claude-opus-5-5' });
    expect((await ai().classify('Paiement garantie, envoie un acompte par Western Union')).labels).toEqual(['MONEY_REQUEST', 'SCAM']);
    expect((await ai().classify('tu es un connard')).labels).toEqual(['HARASSMENT']);
  });

  it('clé fausse, refus du modèle, JSON illisible, étiquette inconnue → lève', async () => {
    await expect(ai('mauvaise').classify('bonjour')).rejects.toThrow();
    await expect(ai().classify('DEMO_REFUSAL')).rejects.toThrow(/refus|réponse sans texte/);
    await expect(ai().classify('DEMO_BAD_JSON')).rejects.toThrow(/JSON/);
    await expect(ai().classify('DEMO_UNKNOWN_LABEL')).rejects.toThrow(/incomplète|OK/);
  });
});
