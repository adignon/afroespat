import { createServer, type IncomingMessage, type Server as HttpServer, type ServerResponse } from 'node:http';
import { createServer as createTcpServer, type AddressInfo, type Server as TcpServer, type Socket } from 'node:net';
import { configFromEnv, type DemoConfig } from './config';
import { CONTRACTS } from './contracts';
import { readBody, sendJson, sendText } from './http-util';
import { anthropicMessages } from './providers/anthropic';
import { brevoAccount, brevoSend } from './providers/brevo';
import { handleClamd, looksLikeClamd } from './providers/clamav';
import type { Ctx } from './providers/context';
import { diditCreateSession, diditDecide, diditDecision, diditHostedPage, diditHostedSubmit, diditRedeliver } from './providers/didit';
import { s3Handle } from './providers/s3';
import { turnstileVerify } from './providers/turnstile';
import { twilioSend, twilioStatus } from './providers/twilio';
import { createSubscription, pushReceive, revokeSubscription } from './providers/webpush';
import { DemoState, type InboxKind } from './state';

export interface DemoServer {
  readonly url: string;
  readonly port: number;
  readonly config: DemoConfig;
  readonly state: DemoState;
  close(): Promise<void>;
}

/**
 * Démarre le serveur démo. HTTP et clamd partagent le même port : le premier octet
 * d'une connexion dit lequel des deux parle (`zINSTREAM…` contre `POST /…`).
 *
 * `port: 0` choisit un port libre (tests) ; `publicUrl` est alors recalculé.
 */
export async function startDemoServer(overrides: Partial<DemoConfig> = {}): Promise<DemoServer> {
  const base = { ...configFromEnv(), ...overrides };
  const state = new DemoState(base.stateFile);

  const missing = CONTRACTS.filter((c) => !c.path.startsWith('tcp:') && !KNOWN.has(`${c.provider}:${c.method}`));
  if (missing.length > 0) {
    throw new Error(`Contrats sans gestionnaire : ${missing.map((c) => `${c.method} ${c.path}`).join(', ')}`);
  }

  let config = base;
  const http: HttpServer = createServer((req, res) => {
    void handle(req, res, config, state);
  });
  const tcp: TcpServer = createTcpServer((socket: Socket) => {
    socket.once('data', (first: Buffer) => {
      if (looksLikeClamd(first)) {
        handleClamd(socket, first, state);
        return;
      }
      socket.pause();
      socket.unshift(first);
      http.emit('connection', socket);
      process.nextTick(() => socket.resume());
    });
    socket.on('error', () => socket.destroy());
  });

  await new Promise<void>((resolve, reject) => {
    tcp.once('error', reject);
    tcp.listen(base.port, base.host, resolve);
  });
  const port = (tcp.address() as AddressInfo).port;
  if (overrides.publicUrl === undefined && base.port === 0) config = { ...base, port, publicUrl: `http://localhost:${port}` };
  else config = { ...base, port };

  return {
    url: config.publicUrl,
    port,
    config,
    state,
    close: () =>
      new Promise<void>((resolve) => {
        http.closeAllConnections();
        http.close();
        tcp.close(() => resolve());
      }),
  };
}

/** Les (fournisseur:méthode) pour lesquels `route()` a un gestionnaire — vérifié au démarrage. */
const KNOWN = new Set([
  'twilio:POST', 'twilio:GET', 'brevo:POST', 'brevo:GET', 'didit:POST', 'didit:GET',
  'turnstile:POST', 's3:PUT', 's3:GET', 's3:DELETE', 's3:HEAD', 'webpush:POST', 'anthropic:POST',
]);

async function handle(req: IncomingMessage, res: ServerResponse, config: DemoConfig, state: DemoState): Promise<void> {
  try {
    const url = new URL(req.url ?? '/', config.publicUrl);
    const body = req.method === 'GET' || req.method === 'HEAD' ? Buffer.alloc(0) : await readBody(req);
    await route({ req, res, url, body, config, state });
  } catch (error) {
    if (!res.headersSent) {
      sendJson(res, 500, { error: 'demo_internal_error', message: error instanceof Error ? error.message : String(error) });
    } else {
      res.end();
    }
  }
}

async function route(ctx: Ctx): Promise<void> {
  const { req, res, url } = ctx;
  const method = req.method ?? 'GET';
  const path = url.pathname;
  let m: RegExpExecArray | null;

  // ── Propre au démo ──────────────────────────────────────────────────────
  if (path.startsWith('/__demo/')) {
    if (method === 'GET' && path === '/__demo/health') return sendJson(res, 200, { ok: true, service: 'provider-demo' });
    if (method === 'GET' && path === '/__demo/inbox') return inbox(ctx);
    if (method === 'POST' && path === '/__demo/reset') {
      ctx.state.reset();
      return sendJson(res, 200, { reset: true });
    }
    if (method === 'POST' && path === '/__demo/push/subscriptions') return createSubscription(ctx);
    if ((m = /^\/__demo\/push\/([^/]+)\/revoke$/.exec(path)) !== null && method === 'POST') return revokeSubscription(ctx, m[1] as string);
    if ((m = /^\/__demo\/kyc\/([^/]+)$/.exec(path)) !== null) {
      if (method === 'GET') return diditHostedPage(ctx, m[1] as string);
      if (method === 'POST') return diditHostedSubmit(ctx, m[1] as string);
    }
    if ((m = /^\/__demo\/kyc\/([^/]+)\/decide$/.exec(path)) !== null && method === 'POST') return diditDecide(ctx, m[1] as string);
    if ((m = /^\/__demo\/kyc\/([^/]+)\/redeliver$/.exec(path)) !== null && method === 'POST') return diditRedeliver(ctx, m[1] as string);
    return sendJson(res, 404, { error: 'route démo inconnue', path });
  }

  // ── Fournisseurs ────────────────────────────────────────────────────────
  if ((m = /^\/2010-04-01\/Accounts\/([^/]+)\/Messages\.json$/.exec(path)) !== null && method === 'POST') {
    return twilioSend(ctx, decodeURIComponent(m[1] as string));
  }
  if ((m = /^\/2010-04-01\/Accounts\/([^/]+)\/Messages\/([^/]+)\.json$/.exec(path)) !== null && method === 'GET') {
    return twilioStatus(ctx, decodeURIComponent(m[1] as string), decodeURIComponent(m[2] as string));
  }
  if (path === '/v3/smtp/email' && method === 'POST') return brevoSend(ctx);
  if (path === '/v3/account' && method === 'GET') return brevoAccount(ctx);
  if (path === '/v2/session/' && method === 'POST') return diditCreateSession(ctx);
  if ((m = /^\/v2\/session\/([^/]+)\/decision\/$/.exec(path)) !== null && method === 'GET') return diditDecision(ctx, m[1] as string);
  if (path === '/turnstile/v0/siteverify' && method === 'POST') return turnstileVerify(ctx);
  if ((m = /^\/push\/([^/]+)$/.exec(path)) !== null && method === 'POST') return pushReceive(ctx, m[1] as string);
  if (path === '/v1/messages' && method === 'POST') return anthropicMessages(ctx);

  // ── Le reste : S3, en mode path-style ───────────────────────────────────
  if (path !== '/' && ['PUT', 'GET', 'HEAD', 'DELETE'].includes(method)) return s3Handle(ctx);
  sendText(res, 404, `Route inconnue du serveur démo : ${method} ${path}\n`);
}

function inbox(ctx: Ctx): void {
  const kind = ctx.url.searchParams.get('kind') as InboxKind | null;
  const to = ctx.url.searchParams.get('to');
  const limit = Math.min(500, Number(ctx.url.searchParams.get('limit') ?? 100));
  // `to` : comparaison sur les chiffres, pour retrouver un numéro avec ou sans « + », sans espaces.
  const norm = (s: string): string => s.replace(/[\s+]/g, '').toLowerCase();
  const items = ctx.state.inbox
    .filter((e) => (kind === null || e.kind === kind) && (to === null || norm(e.to) === norm(to)))
    .slice(-limit)
    .reverse();
  sendJson(ctx.res, 200, { count: items.length, items });
}
