import { createServer as createNetServer } from 'node:net';
import { createServer, type Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import webpush from 'web-push';
import { CONTRACTS, matchContract, startDemoServer, type DemoServer } from '@app/provider-demo';
import { AnthropicModerationProvider } from '../anthropic-moderation.provider';
import { BrevoEmailProvider } from '../brevo-email.provider';
import { ClamAvAntivirusProvider } from '../clamav-antivirus.provider';
import { DiditKycProvider } from '../didit-kyc.provider';
import { S3StorageProvider } from '../s3-storage.provider';
import { TurnstileCaptchaProvider } from '../turnstile-captcha.provider';
import { TwilioSmsProvider } from '../twilio-sms.provider';
import { WebPushProvider } from '../webpush.provider';

/**
 * PARITÉ : si un adaptateur appelle une route que le serveur démo n'implémente pas,
 * ce test échoue.
 *
 * Méthode : chaque adaptateur RÉEL est pointé sur un serveur-témoin qui NOTE la requête
 * (méthode + chemin) et répond vide. Chaque requête relevée doit correspondre à un
 * contrat de la liste partagée (`CONTRACTS`, apps/provider-demo/src/contracts.ts) — qui
 * est aussi la liste que le démo sert — ET le contrat doit nommer cet adaptateur. Dans
 * l'autre sens, chaque contrat qui se dit « utilisé par » un adaptateur doit avoir été
 * observé : une route démo orpheline (l'adaptateur a changé de chemin) échoue aussi.
 *
 * Un NOUVEAU méthode publique sur un adaptateur échoue enfin, tant qu'elle n'est pas
 * ajoutée ci-dessous : c'est le rappel d'écrire son contrat.
 */
interface Seen { method: string; path: string }
const seen: { who: string; req: Seen }[] = [];
let witness: Server;
let witnessUrl: string;
let demo: DemoServer;

beforeAll(async () => {
  witness = createServer((req, res) => {
    req.resume();
    req.on('end', () => {
      seen.push({ who: current, req: { method: req.method ?? '', path: new URL(req.url ?? '/', 'http://x').pathname } });
      res.writeHead(200, { 'content-type': 'application/json' }).end('{}');
    });
  });
  await new Promise<void>((r) => witness.listen(0, '127.0.0.1', r));
  witnessUrl = `http://127.0.0.1:${(witness.address() as { port: number }).port}`;
  demo = await startDemoServer({ port: 0, host: '127.0.0.1' });
});
afterAll(async () => {
  await demo.close();
  witness.close();
});

let current = '';
const ignore = (): void => undefined;

/** Les méthodes que chaque adaptateur a le droit d'exposer (le reste est interne). */
const PUBLIC: Record<string, string[]> = {
  TwilioSmsProvider: ['send'],
  BrevoEmailProvider: ['send'],
  DiditKycProvider: ['createSession', 'getStatus'],
  TurnstileCaptchaProvider: ['verify'],
  S3StorageProvider: ['createUploadUrl', 'createDownloadUrl', 'put', 'get', 'delete'],
  ClamAvAntivirusProvider: ['scan'],
  WebPushProvider: ['send'],
  AnthropicModerationProvider: ['classify'],
};
const INTERNAL = new Set(['constructor', 'headers']);

describe('parité adaptateurs ⇄ serveur démo', () => {
  it('chaque requête d’un adaptateur réel correspond à un contrat qui le nomme', async () => {
    const s3 = new S3StorageProvider({ endpoint: witnessUrl, region: 'eu-west-1', bucket: 'b', accessKeyId: 'k', secretAccessKey: 's', forcePathStyle: true });
    const sub = { endpoint: `${witnessUrl}/push/abc`, p256dh: webpush.generateVAPIDKeys().publicKey, auth: 'AAAAAAAAAAAAAAAAAAAAAA' };
    const vapid = webpush.generateVAPIDKeys();
    // L'abonnement doit être une vraie clé ECDH pour que web-push chiffre : on en tire une du démo.
    const real = (await (await fetch(`${demo.url}/__demo/push/subscriptions`, { method: 'POST', body: '{}' })).json()) as { keys: { p256dh: string; auth: string } };

    const calls: [string, () => Promise<unknown>][] = [
      ['TwilioSmsProvider.send', () => new TwilioSmsProvider({ accountSid: 'AC1', authToken: 't', from: '+1', baseUrl: witnessUrl }).send('+33600000000', 'x')],
      ['BrevoEmailProvider.send', () => new BrevoEmailProvider({ apiKey: 'k', fromAddress: 'a@b.c', fromName: 'n', appName: 'n', baseUrl: witnessUrl }).send('a@b.c', 'welcome', {})],
      ['DiditKycProvider.createSession', () => new DiditKycProvider({ apiKey: 'k', workflowId: 'w', baseUrl: witnessUrl, callbackUrl: 'http://x' }).createSession('u')],
      ['DiditKycProvider.getStatus', () => new DiditKycProvider({ apiKey: 'k', workflowId: 'w', baseUrl: witnessUrl, callbackUrl: 'http://x' }).getStatus('sess-1')],
      ['TurnstileCaptchaProvider.verify', () => new TurnstileCaptchaProvider('s', { baseUrl: witnessUrl }).verify('tok')],
      ['S3StorageProvider.put', () => s3.put('dir/key.bin', Buffer.from('x'), 'text/plain')],
      ['S3StorageProvider.get', () => s3.get('dir/key.bin')],
      ['S3StorageProvider.delete', () => s3.delete('dir/key.bin')],
      ['S3StorageProvider.createUploadUrl', async () => { const { url } = await s3.createUploadUrl('dir/up.bin', 'text/plain'); await fetch(url, { method: 'PUT', body: 'x' }); }],
      ['S3StorageProvider.createDownloadUrl', async () => { await fetch(await s3.createDownloadUrl('dir/up.bin', 60)); }],
      ['WebPushProvider.send', () => new WebPushProvider({ publicKey: vapid.publicKey, privateKey: vapid.privateKey, subject: 'mailto:a@b.c' }).send({ ...sub, ...real.keys }, { title: 't', body: 'b' })],
      ['AnthropicModerationProvider.classify', () => new AnthropicModerationProvider({ apiKey: 'k', model: 'm', baseUrl: witnessUrl, timeoutMs: 3000 }).classify('bonjour')],
    ];

    for (const [who, run] of calls) {
      current = who;
      await run().catch(ignore); // la réponse vide du témoin fait échouer l'analyse : seule la requête compte
    }

    // ClamAV (TCP) : la première commande envoyée doit être INSTREAM.
    let firstBytes = '';
    const tcp = createNetServer((socket) => {
      socket.once('data', (d: Buffer) => { firstBytes = d.toString('latin1', 0, 10); socket.destroy(); });
      socket.on('error', ignore);
    });
    await new Promise<void>((r) => tcp.listen(0, '127.0.0.1', r));
    await new ClamAvAntivirusProvider({ host: '127.0.0.1', port: (tcp.address() as { port: number }).port, timeoutMs: 1000 }).scan(Buffer.from('x')).catch(ignore);
    tcp.close();
    expect(firstBytes).toBe('zINSTREAM\0');

    const observed = new Set<string>(['ClamAvAntivirusProvider.scan']);
    for (const { who, req } of seen) {
      const contract = matchContract(req.method, req.path);
      expect(contract, `${who} appelle ${req.method} ${req.path} : aucune route du démo ne le couvre`).toBeDefined();
      expect([contract?.usedBy].flat(), `${req.method} ${req.path} est couvert, mais le contrat ne nomme pas ${who}`).toContain(who);
      observed.add(who);
    }

    const declared = CONTRACTS.flatMap((c) => [c.usedBy].flat()).filter((u): u is string => u !== null);
    for (const who of declared) expect(observed.has(who), `le contrat de ${who} n’a été observé nulle part`).toBe(true);
    for (const [who] of calls) expect(declared, `${who} n’a aucun contrat`).toContain(who);
  });

  it('chaque contrat à chemin est SERVI par le démo (ni « route inconnue » ni 405)', async () => {
    for (const c of CONTRACTS.filter((x) => !x.path.startsWith('tcp:'))) {
      const path = c.path.replace(/:\w+(\.json)?/g, (m) => (m.endsWith('.json') ? 'x.json' : 'x')).replace('*', 'a/b');
      const res = await fetch(`${demo.url}${path}`, { method: c.method, redirect: 'manual' });
      const text = c.method === 'HEAD' ? '' : await res.text();
      expect(text, `${c.method} ${c.path}`).not.toContain('Route inconnue du serveur démo');
      expect(res.status, `${c.method} ${c.path}`).not.toBe(405);
      expect(res.status, `${c.method} ${c.path}`).not.toBe(500);
    }
  });

  it('les adaptateurs n’exposent que les méthodes déclarées', () => {
    const classes: Record<string, { prototype: object }> = {
      TwilioSmsProvider, BrevoEmailProvider, DiditKycProvider, TurnstileCaptchaProvider,
      S3StorageProvider, ClamAvAntivirusProvider, WebPushProvider, AnthropicModerationProvider,
    };
    for (const [name, cls] of Object.entries(classes)) {
      const own = Object.getOwnPropertyNames(cls.prototype).filter((m) => !INTERNAL.has(m));
      expect(own.sort(), `${name} : nouvelle méthode — déclarez son contrat`).toEqual([...(PUBLIC[name] ?? [])].sort());
    }
  });
});
