import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { LoggerService } from '@nestjs/common';
import pino, { type Logger as PinoLogger } from 'pino';
import pinoHttp from 'pino-http';
import { loadEnv } from '../config/env';

/**
 * Journaux JSON (`pino`) et suivi d'erreurs (Sentry, optionnel) — runbook §4.
 *
 * ── CE QUI N'ENTRE JAMAIS DANS UN JOURNAL ────────────────────────────────────
 *
 *   · ni en-têtes (`Authorization`, `Cookie`), ni corps de requête : les journaux
 *     sont gardés 90 jours (00 §8.4) et expédiés vers un agrégateur ;
 *   · ni chaîne de requête : `/unsubscribe?token=…` porte un jeton signé. Seul le
 *     CHEMIN est journalisé ;
 *   · un identifiant de requête (`x-request-id` reçu ou tiré) relie le journal, la
 *     réponse (même en-tête) et l'événement Sentry.
 *
 * Le logger Nest est redirigé vers pino (`PinoNestLogger`) : un seul format sur
 * stdout, que le collecteur du conteneur lit ligne à ligne.
 */
let root: PinoLogger | undefined;

export function rootLogger(): PinoLogger {
  root ??= pino({
    level: loadEnv().LOG_LEVEL,
    base: { app: loadEnv().APP_NAME, role: loadEnv().APP_ROLE },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: { paths: ['req.headers', 'res.headers', 'headers', 'authorization', 'cookie'], censor: '[masqué]' },
  });
  return root;
}

/** Les niveaux de Nest vers ceux de pino ; `verbose` et `debug` deviennent `debug`. */
export class PinoNestLogger implements LoggerService {
  constructor(private readonly logger: PinoLogger = rootLogger()) {}

  private emit(level: 'info' | 'warn' | 'error' | 'debug', message: unknown, params: unknown[]): void {
    const context = typeof params.at(-1) === 'string' ? (params.at(-1) as string) : undefined;
    const rest = context === undefined ? params : params.slice(0, -1);
    const text = typeof message === 'string' ? message : JSON.stringify(message);
    const bindings: Record<string, unknown> = {};
    if (context !== undefined) bindings['context'] = context;
    if (level === 'error' && rest.length > 0) bindings['stack'] = String(rest[0]);
    this.logger[level](bindings, text);
  }

  log(message: unknown, ...params: unknown[]): void { this.emit('info', message, params); }
  error(message: unknown, ...params: unknown[]): void { this.emit('error', message, params); }
  warn(message: unknown, ...params: unknown[]): void { this.emit('warn', message, params); }
  debug(message: unknown, ...params: unknown[]): void { this.emit('debug', message, params); }
  verbose(message: unknown, ...params: unknown[]): void { this.emit('debug', message, params); }
}

/** Le chemin sans chaîne de requête. */
export function pathOnly(url: string | undefined): string {
  if (url === undefined) return '';
  const q = url.indexOf('?');
  return q === -1 ? url : url.slice(0, q);
}

export function httpLogger() {
  return pinoHttp({
    logger: rootLogger(),
    genReqId: (req: IncomingMessage, res: ServerResponse) => {
      const given = req.headers['x-request-id'];
      const id = typeof given === 'string' && /^[\w.-]{8,64}$/.test(given) ? given : randomUUID();
      res.setHeader('x-request-id', id);
      return id;
    },
    serializers: {
      req: (req: { id: string; method: string; url: string }) => ({ id: req.id, method: req.method, path: pathOnly(req.url) }),
      res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
    },
    customLogLevel: (_req, res, error) =>
      error !== undefined || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
    // La sonde d'orchestrateur toutes les 5 s noierait le reste.
    autoLogging: { ignore: (req) => req.url === '/v1/health' || req.url === '/v1/ready' },
  });
}

// ── Sentry, optionnel ───────────────────────────────────────────────────────

type SentryLike = { captureException(error: unknown, hint?: unknown): unknown };
let sentry: SentryLike | null = null;

/**
 * Initialise Sentry SI `SENTRY_DSN` est posé. Sans DSN, ou si le paquet ne se charge
 * pas, l'application démarre normalement : le suivi d'erreurs ne doit jamais être
 * une condition de démarrage. `sendDefaultPii: false` et `beforeSend` retirent
 * cookies, en-têtes, corps et chaîne de requête de chaque événement.
 */
export async function initSentry(dsn: string | undefined = loadEnv().SENTRY_DSN): Promise<boolean> {
  if (dsn === undefined || dsn.trim() === '') return false;
  try {
    const Sentry = await import('@sentry/node');
    Sentry.init({
      dsn,
      environment: loadEnv().NODE_ENV,
      tracesSampleRate: 0,
      beforeSend(event) {
        if (event.request) {
          delete event.request.cookies;
          delete event.request.headers;
          delete event.request.data;
          delete event.request.query_string;
          if (event.request.url) event.request.url = pathOnly(event.request.url);
        }
        delete event.user;
        return event;
      },
    });
    sentry = Sentry;
    return true;
  } catch (error) {
    rootLogger().warn({ err: String(error) }, 'Sentry non initialisé : le suivi d’erreurs est désactivé');
    return false;
  }
}

/** Sans effet si Sentry n'est pas initialisé. */
export function reportError(error: unknown, requestId?: string): void {
  if (sentry === null) return;
  try {
    sentry.captureException(error, requestId === undefined ? undefined : { tags: { request_id: requestId } });
  } catch {
    /* un suivi défaillant ne doit jamais aggraver l'erreur qu'il rapporte */
  }
}

/** Réservé aux tests. */
export function __setSentryForTests(value: SentryLike | null): void {
  sentry = value;
}
