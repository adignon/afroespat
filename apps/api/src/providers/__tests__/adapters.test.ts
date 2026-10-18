/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any, @typescript-eslint/no-base-to-string, @typescript-eslint/no-require-imports --
   les corps de réponse de supertest et les simulacres de fetch sont non typés par nature ; ce sont des fichiers d'épreuve. */
import { createServer, type Server } from 'node:net';
import { describe, expect, it } from 'vitest';
import webpush from 'web-push';
import { AnthropicModerationProvider, type AnthropicLike } from '../anthropic-moderation.provider';
import { BrevoEmailProvider } from '../brevo-email.provider';
import { buildInstream, ClamAvAntivirusProvider, parseClamdReply } from '../clamav-antivirus.provider';
import { DiditKycProvider, isAdultFromDecision, normalizeDiditWebhook } from '../didit-kyc.provider';
import { renderEmail } from '../email-templates';
import { ProviderError, type FetchLike } from '../http';
import { pick } from '../providers.module';
import { FakeSmsProvider, maskCodeOutsideDev } from '../providers';
import { S3StorageProvider } from '../s3-storage.provider';
import { TurnstileCaptchaProvider } from '../turnstile-captcha.provider';
import { TwilioSmsProvider } from '../twilio-sms.provider';
import { WebPushProvider } from '../webpush.provider';

/**
 * Les adaptateurs réels, éprouvés SANS compte fournisseur : un `fetch` simulé
 * vérifie ce qui PART (adresse, en-têtes, corps) et rend ce que le fournisseur
 * documente. Ce que ces tests ne peuvent pas dire — que Twilio, Brevo ou Didit
 * acceptent vraiment la requête — reste à confirmer avec de vrais comptes.
 */

interface Call { url: string; init: RequestInit }
function fakeFetch(reply: { status?: number; body?: unknown }, calls: Call[]): FetchLike {
  return (url, init) => {
    calls.push({ url, init: init ?? {} });
    return Promise.resolve(
      new Response(JSON.stringify(reply.body ?? {}), {
        status: reply.status ?? 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
  };
}

describe('Twilio', () => {
  it('envoie un formulaire authentifié en Basic, service de messagerie en priorité', async () => {
    const calls: Call[] = [];
    const sms = new TwilioSmsProvider(
      { accountSid: 'ACxxx', authToken: 'tok', from: '+33100000000', messagingServiceSid: 'MGyyy' },
      { fetch: fakeFetch({ body: { sid: 'SM123' } }, calls) },
    );
    const out = await sms.send('+33612345678', 'Code 482913');
    expect(out.providerRef).toBe('SM123');
    expect(calls[0]?.url).toBe('https://api.twilio.com/2010-04-01/Accounts/ACxxx/Messages.json');
    const headers = calls[0]?.init.headers as Record<string, string>;
    expect(headers['Authorization']).toBe(`Basic ${Buffer.from('ACxxx:tok').toString('base64')}`);
    const form = new URLSearchParams(String(calls[0]?.init.body));
    expect(form.get('To')).toBe('+33612345678');
    expect(form.get('MessagingServiceSid')).toBe('MGyyy');
    expect(form.get('From')).toBeNull();
  });

  it('refuse sans expéditeur', () => {
    expect(() => new TwilioSmsProvider({ accountSid: 'a', authToken: 'b' })).toThrow(/TWILIO_FROM/);
  });

  it('ne recopie jamais le numéro ni le code dans l’erreur, et marque 429/5xx réessayables', async () => {
    const sms = new TwilioSmsProvider(
      { accountSid: 'a', authToken: 'b', from: '+1' },
      { fetch: fakeFetch({ status: 503, body: { message: 'indisponible' } }, []) },
    );
    const error = await sms.send('+33612345678', 'Code 482913').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ProviderError);
    expect((error as ProviderError).retryable).toBe(true);
    expect((error as Error).message).not.toContain('612345678');
    expect((error as Error).message).not.toContain('482913');
  });

  it('un 400 n’est pas réessayable', async () => {
    const sms = new TwilioSmsProvider(
      { accountSid: 'a', authToken: 'b', from: '+1' },
      { fetch: fakeFetch({ status: 400 }, []) },
    );
    const error = (await sms.send('+1', 'x').catch((e: unknown) => e)) as ProviderError;
    expect(error.retryable).toBe(false);
  });

  it('un fournisseur muet est coupé par le délai', async () => {
    const hang: FetchLike = (_u, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      });
    const sms = new TwilioSmsProvider({ accountSid: 'a', authToken: 'b', from: '+1' }, { fetch: hang, timeoutMs: 20 });
    const error = (await sms.send('+1', 'x').catch((e: unknown) => e)) as ProviderError;
    expect(error.message).toContain('délai dépassé');
    expect(error.retryable).toBe(true);
  });
});

describe('Brevo', () => {
  it('compose texte et HTML, échappe, et pose List-Unsubscribe', async () => {
    const calls: Call[] = [];
    const email = new BrevoEmailProvider(
      { apiKey: 'k', fromAddress: 'no-reply@x.test', fromName: 'App', appName: 'App' },
      { fetch: fakeFetch({ body: { messageId: '<abc@brevo>' } }, calls) },
    );
    const out = await email.send('a@b.test', 'welcome', {
      title: '<b>Salut</b>',
      body: 'Corps',
      unsubscribeUrl: 'https://app.test/unsubscribe?token=t',
    });
    expect(out.providerRef).toBe('<abc@brevo>');
    expect(calls[0]?.url).toBe('https://api.brevo.com/v3/smtp/email');
    expect((calls[0]?.init.headers as Record<string, string>)['api-key']).toBe('k');
    const body = JSON.parse(String(calls[0]?.init.body)) as Record<string, any>;
    expect(body.to).toEqual([{ email: 'a@b.test' }]);
    expect(body.htmlContent).toContain('&lt;b&gt;Salut&lt;/b&gt;');
    expect(body.htmlContent).not.toContain('<b>Salut');
    expect(body.headers['List-Unsubscribe']).toBe('<https://app.test/unsubscribe?token=t>');
    expect(body.tags).toEqual(['welcome']);
  });

  it('le modèle de vérification porte le code', () => {
    const r = renderEmail('email_verification', { code: '654321' }, 'App');
    expect(r.text).toContain('654321');
    expect(r.subject).toContain('code de vérification');
  });
});

describe('Didit', () => {
  const cfg = { apiKey: 'dk', workflowId: 'wf', baseUrl: 'https://didit.test', callbackUrl: 'https://app.test/profil' };

  it('crée une session avec l’identifiant interne seulement', async () => {
    const calls: Call[] = [];
    const kyc = new DiditKycProvider(cfg, {
      fetch: fakeFetch({ body: { session_id: 'S1', url: 'https://verify.didit.test/S1' } }, calls),
    });
    const out = await kyc.createSession('user-1');
    expect(out).toEqual({ providerSessionId: 'S1', verificationUrl: 'https://verify.didit.test/S1' });
    expect(calls[0]?.url).toBe('https://didit.test/v2/session/');
    expect((calls[0]?.init.headers as Record<string, string>)['x-api-key']).toBe('dk');
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({
      workflow_id: 'wf', vendor_data: 'user-1', callback: 'https://app.test/profil',
    });
  });

  it('lit l’état et ne rend que statut et majorité', async () => {
    const kyc = new DiditKycProvider(cfg, {
      fetch: fakeFetch({ body: { status: 'Approved', id_verification: { age: 31, first_name: 'Secret' } } }, []),
    });
    const out = await kyc.getStatus('S1');
    expect(out).toEqual({ status: 'APPROVED', isAdult: true });
    expect(JSON.stringify(out)).not.toContain('Secret');
  });

  it('ne devine pas une majorité absente', () => {
    expect(isAdultFromDecision({})).toBeUndefined();
    expect(isAdultFromDecision({ id_verification: { date_of_birth: '2015-01-01' } }, new Date('2026-01-01'))).toBe(false);
    expect(isAdultFromDecision({ id_verification: { date_of_birth: '2000-01-01' } }, new Date('2026-01-01'))).toBe(true);
  });

  it('ramène un webhook réel à la forme interne, sans donnée d’identité', () => {
    const out = normalizeDiditWebhook({
      session_id: 'S1', status: 'Declined',
      decision: { id_verification: { age: 16, full_name: 'Secret Nom' }, warnings: [{ risk: 'DOCUMENT_EXPIRED' }] },
    });
    expect(out).toEqual({ sessionId: 'S1', status: 'DECLINED', isAdult: false, declineReasonCode: 'DOCUMENT_EXPIRED' });
    expect(JSON.stringify(out)).not.toContain('Secret');
    expect(normalizeDiditWebhook({ sessionId: 'S1', status: 'APPROVED' })).toBeNull();
  });
});

describe('Turnstile', () => {
  it('rend true si Cloudflare dit success, envoie secret, jeton et IP', async () => {
    const calls: Call[] = [];
    const captcha = new TurnstileCaptchaProvider('sec', { fetch: fakeFetch({ body: { success: true } }, calls) });
    expect(await captcha.verify('tok', '1.2.3.4')).toBe(true);
    const form = new URLSearchParams(String(calls[0]?.init.body));
    expect([form.get('secret'), form.get('response'), form.get('remoteip')]).toEqual(['sec', 'tok', '1.2.3.4']);
  });
  it('refuse sur échec, sur jeton vide et sur panne (jamais d’ouverture)', async () => {
    expect(await new TurnstileCaptchaProvider('s', { fetch: fakeFetch({ body: { success: false } }, []) }).verify('t')).toBe(false);
    expect(await new TurnstileCaptchaProvider('s', { fetch: fakeFetch({ body: {} }, []) }).verify('  ')).toBe(false);
    expect(await new TurnstileCaptchaProvider('s', { fetch: fakeFetch({ status: 500 }, []) }).verify('t')).toBe(false);
  });
});

describe('Web Push', () => {
  const keys = webpush.generateVAPIDKeys();
  // Un abonnement de navigateur valide : paire P-256 réelle + secret d'authentification de 16 octets.
  const ecdh = (): { p256dh: string; auth: string } => {
    const { createECDH, randomBytes } = require('node:crypto') as typeof import('node:crypto');
    const k = createECDH('prime256v1');
    k.generateKeys();
    return { p256dh: k.getPublicKey().toString('base64url'), auth: randomBytes(16).toString('base64url') };
  };
  const provider = (reply: { status: number }, calls: Call[]): WebPushProvider =>
    new WebPushProvider(
      { publicKey: keys.publicKey, privateKey: keys.privateKey, subject: 'mailto:a@b.test' },
      { fetch: fakeFetch(reply, calls) },
    );

  it('chiffre la charge, signe en VAPID et poste sur l’endpoint', async () => {
    const calls: Call[] = [];
    const out = await provider({ status: 201 }, calls).send(
      { endpoint: 'https://push.test/abc', ...ecdh() },
      { title: 'Titre', body: 'Corps', url: '/x' },
    );
    expect(out.delivered).toBe(true);
    expect(calls[0]?.url).toBe('https://push.test/abc');
    const h = calls[0]?.init.headers as Record<string, string>;
    expect(h['Authorization'] ?? h['authorization']).toMatch(/^vapid /);
    expect(h['Content-Encoding']).toBe('aes128gcm');
    // La charge est chiffrée : le titre n'apparaît pas en clair dans le corps.
    expect(Buffer.from(calls[0]?.init.body as Uint8Array).toString('latin1')).not.toContain('Titre');
  });

  it('410 → gone, pour supprimer l’abonnement tout de suite', async () => {
    const out = await provider({ status: 410 }, []).send({ endpoint: 'https://push.test/abc', ...ecdh() }, { title: 't', body: 'b' });
    expect(out).toEqual({ delivered: false, gone: true });
  });

  it('500 lève (réessai)', async () => {
    await expect(
      provider({ status: 500 }, []).send({ endpoint: 'https://push.test/abc', ...ecdh() }, { title: 't', body: 'b' }),
    ).rejects.toBeInstanceOf(ProviderError);
  });
});

describe('S3', () => {
  it('put envoie PutObject avec la clé, le type et le seau', async () => {
    const sent: any[] = [];
    const s3 = new S3StorageProvider(
      { endpoint: 'http://x', region: 'eu-west-1', bucket: 'b', accessKeyId: 'a', secretAccessKey: 's', forcePathStyle: true },
      { send: (c) => { sent.push(c); return Promise.resolve({}); } },
    );
    await s3.put('users/1/a.png', Buffer.from('x'), 'image/png');
    expect(sent[0].constructor.name).toBe('PutObjectCommand');
    expect(sent[0].input).toMatchObject({ Bucket: 'b', Key: 'users/1/a.png', ContentType: 'image/png' });
  });

  it('get rend les octets, null pour une clé absente, et relance les autres pannes', async () => {
    const mk = (fn: () => Promise<unknown>): S3StorageProvider =>
      new S3StorageProvider(
        { endpoint: 'http://x', region: 'r', bucket: 'b', accessKeyId: 'a', secretAccessKey: 's', forcePathStyle: true },
        { send: fn },
      );
    const ok = mk(() => Promise.resolve({ ContentType: 'image/png', Body: { transformToByteArray: () => Promise.resolve(new Uint8Array([1, 2, 3])) } }));
    expect(await ok.get('k')).toEqual({ body: Buffer.from([1, 2, 3]), mime: 'image/png' });
    const missing = mk(() => Promise.reject(Object.assign(new Error('x'), { name: 'NoSuchKey' })));
    expect(await missing.get('k')).toBeNull();
    const down = mk(() => Promise.reject(Object.assign(new Error('boom'), { name: 'InternalError', $metadata: { httpStatusCode: 500 } })));
    await expect(down.get('k')).rejects.toThrow('boom');
  });

  it('signe une URL de téléchargement expirante', async () => {
    const s3 = new S3StorageProvider({ endpoint: 'http://localhost:9000', region: 'eu-west-1', bucket: 'b', accessKeyId: 'a', secretAccessKey: 's', forcePathStyle: true });
    const url = await s3.createDownloadUrl('exports/x.zip', 120);
    expect(url).toContain('http://localhost:9000/b/exports/x.zip');
    expect(url).toContain('X-Amz-Expires=120');
    expect(url).toContain('X-Amz-Signature=');
  });
});

describe('ClamAV (clamd INSTREAM)', () => {
  it('découpe en blocs préfixés par leur longueur et termine par un bloc vide', () => {
    const parts = buildInstream(Buffer.alloc(70_000, 1));
    expect(parts[0]?.toString()).toBe('zINSTREAM\0');
    expect(parts[1]?.readUInt32BE(0)).toBe(65_536);
    expect(parts[3]?.readUInt32BE(0)).toBe(70_000 - 65_536);
    expect(parts.at(-1)?.readUInt32BE(0)).toBe(0);
  });

  it('lit les réponses OK / FOUND et refuse le reste', () => {
    expect(parseClamdReply('stream: OK\0')).toEqual({ clean: true });
    expect(parseClamdReply('stream: Eicar-Test-Signature FOUND\0')).toEqual({ clean: false, signature: 'Eicar-Test-Signature' });
    expect(() => parseClamdReply('INSTREAM size limit exceeded. ERROR\0')).toThrow();
  });

  const serve = (reply: string | null): Promise<{ server: Server; port: number; received: Buffer[] }> =>
    new Promise((resolve) => {
      const received: Buffer[] = [];
      const server = createServer((socket) => {
        let all = Buffer.alloc(0);
        socket.on('data', (d) => {
          received.push(d);
          all = Buffer.concat([all, d]);
          // fin du flux : le bloc final de longueur zéro
          if (reply !== null && all.subarray(-4).equals(Buffer.alloc(4))) socket.end(reply);
        });
      }).listen(0, '127.0.0.1', () => resolve({ server, port: (server.address() as { port: number }).port, received }));
    });

  it('dialogue réel sur TCP : propre, infecté, puis panne', async () => {
    const clean = await serve('stream: OK\0');
    const av = new ClamAvAntivirusProvider({ host: '127.0.0.1', port: clean.port, timeoutMs: 2000 });
    expect(await av.scan(Buffer.from('bonjour'))).toEqual({ clean: true });
    expect(Buffer.concat(clean.received).subarray(0, 10).toString()).toBe('zINSTREAM\0');
    clean.server.close();

    const bad = await serve('stream: Win.Test.EICAR_HDB-1 FOUND\0');
    const av2 = new ClamAvAntivirusProvider({ host: '127.0.0.1', port: bad.port, timeoutMs: 2000 });
    expect(await av2.scan(Buffer.from('x'))).toEqual({ clean: false, signature: 'Win.Test.EICAR_HDB-1' });
    bad.server.close();

    const refused = new ClamAvAntivirusProvider({ host: '127.0.0.1', port: 1, timeoutMs: 500 });
    await expect(refused.scan(Buffer.from('x'))).rejects.toThrow(/ClamAV/);
  });

  it('un clamd muet fait lever le délai, jamais clean', async () => {
    const mute = await serve(null);
    const av = new ClamAvAntivirusProvider({ host: '127.0.0.1', port: mute.port, timeoutMs: 100 });
    await expect(av.scan(Buffer.from('x'))).rejects.toThrow(/délai/);
    mute.server.close();
  });
});

describe('Modération Anthropic', () => {
  const reply = (text: string, stop = 'end_turn'): AnthropicLike => ({
    messages: { create: () => Promise.resolve({ stop_reason: stop, content: [{ type: 'text', text }] }) },
  });
  const cfg = { apiKey: 'k', model: 'claude-opus-5-5' };

  it('envoie une sortie structurée, sans tool_choice forcé ni prefill, et lit les étiquettes', async () => {
    let seen: Record<string, any> = {};
    const client: AnthropicLike = {
      messages: {
        create: (p) => {
          seen = p;
          return Promise.resolve({ stop_reason: 'end_turn', content: [{ type: 'text', text: '{"labels":["SCAM","MONEY_REQUEST"],"score":0.93}' }] });
        },
      },
    };
    const out = await new AnthropicModerationProvider(cfg, client).classify('Envoyez [TEL] 500 euros');
    expect(out).toMatchObject({ labels: ['SCAM', 'MONEY_REQUEST'], score: 0.93, model: 'claude-opus-5-5' });
    expect(seen['model']).toBe('claude-opus-5-5');
    expect(seen['output_config'].format.type).toBe('json_schema');
    expect(seen['tool_choice']).toBeUndefined();
    expect(seen['temperature']).toBeUndefined();
    expect(JSON.stringify(seen['messages'])).toContain('<contenu>');
  });

  it('refuse d’envoyer un texte non masqué (règle dure 13 §2)', async () => {
    const p = new AnthropicModerationProvider(cfg, reply('{"labels":["OK"],"score":0}'));
    await expect(p.classify('appelez le 06 12 34 56 78')).rejects.toThrow();
    await expect(p.classify('écrivez à jean@exemple.fr')).rejects.toThrow();
  });

  it('un refus, une sortie illisible ou incomplète LÈVENT (relecture humaine), jamais OK', async () => {
    await expect(new AnthropicModerationProvider(cfg, reply('{}', 'refusal')).classify('texte')).rejects.toThrow(/refus/);
    await expect(new AnthropicModerationProvider(cfg, reply('pas du json')).classify('texte')).rejects.toThrow();
    await expect(new AnthropicModerationProvider(cfg, reply('{"labels":["INCONNU"],"score":1}')).classify('texte')).rejects.toThrow();
  });

  it('borne le score à [0,1]', async () => {
    const out = await new AnthropicModerationProvider(cfg, reply('{"labels":["OK"],"score":7}')).classify('texte');
    expect(out.score).toBe(1);
  });
});

describe('pick() — plus de repli silencieux', () => {
  const fake = { kind: 'fake' };
  const run = (mode: string, real?: Record<string, () => unknown>) =>
    (pick(Symbol('t'), 'X_PROVIDER', mode, () => fake, real) as { useFactory: () => unknown }).useFactory();

  it('fake → la doublure', () => expect(run('fake')).toBe(fake));
  it('valeur réelle implémentée → l’adaptateur', () => expect(run('twilio', { twilio: () => 'reel' })).toBe('reel'));
  it('valeur réelle SANS implémentation → erreur claire au démarrage', () => {
    expect(() => run('stripe')).toThrow(/X_PROVIDER=stripe/);
    expect(() => run('autre', { twilio: () => 1 })).toThrow(/twilio/);
  });
});

describe('doublure SMS : le code ne sort pas hors développement/test', () => {
  it('masque six chiffres selon NODE_ENV', () => {
    const before = process.env['NODE_ENV'];
    try {
      process.env['NODE_ENV'] = 'production';
      expect(maskCodeOutsideDev('Votre code : 482913')).toBe('Votre code : ••••••');
      process.env['NODE_ENV'] = 'staging';
      expect(maskCodeOutsideDev('482913')).toBe('••••••');
      process.env['NODE_ENV'] = 'test';
      expect(maskCodeOutsideDev('482913')).toBe('482913');
      process.env['NODE_ENV'] = 'development';
      expect(maskCodeOutsideDev('482913')).toBe('482913');
    } finally {
      if (before === undefined) delete process.env['NODE_ENV']; else process.env['NODE_ENV'] = before;
    }
  });
  it('garde le code en mémoire pour les tests', async () => {
    const sms = new FakeSmsProvider();
    await sms.send('+33612345678', 'Code 111222');
    expect(sms.lastCodeSent()).toBe('111222');
  });
});
