import { Writable } from 'node:stream';
import pino from 'pino';
import { describe, expect, it } from 'vitest';
import { PinoNestLogger, __setSentryForTests, initSentry, pathOnly, reportError } from '../observability';

describe('journaux et suivi d’erreurs', () => {
  it('le chemin perd sa chaîne de requête (jeton de désabonnement)', () => {
    expect(pathOnly('/v1/unsubscribe?token=abc.def')).toBe('/v1/unsubscribe');
    expect(pathOnly('/v1/health')).toBe('/v1/health');
  });

  it('le logger Nest écrit une ligne JSON par message, avec niveau et contexte', () => {
    const lines: string[] = [];
    const sink = new Writable({ write(chunk, _e, cb) { lines.push(String(chunk)); cb(); } });
    const logger = new PinoNestLogger(pino({ level: 'debug', base: { app: 't' } }, sink));
    logger.log('démarré', 'bootstrap');
    logger.error('boum', 'stack-xyz', 'Service');
    const [a, b] = lines.map((l) => JSON.parse(l) as Record<string, unknown>);
    expect(a).toMatchObject({ level: 30, msg: 'démarré', context: 'bootstrap', app: 't' });
    expect(b).toMatchObject({ level: 50, msg: 'boum', context: 'Service', stack: 'stack-xyz' });
  });

  it('sans DSN, Sentry n’est pas initialisé et reportError ne fait rien', async () => {
    expect(await initSentry('')).toBe(false);
    expect(await initSentry(undefined as unknown as string)).toBe(false);
    expect(() => reportError(new Error('x'))).not.toThrow();
  });

  it('avec Sentry, l’erreur est transmise avec l’identifiant de requête ; un Sentry défaillant ne casse rien', () => {
    const seen: unknown[] = [];
    __setSentryForTests({ captureException: (e, h) => { seen.push([e, h]); } });
    reportError(new Error('x'), 'req-1');
    expect(seen).toHaveLength(1);
    __setSentryForTests({ captureException: () => { throw new Error('panne Sentry'); } });
    expect(() => reportError(new Error('y'))).not.toThrow();
    __setSentryForTests(null);
  });
});
