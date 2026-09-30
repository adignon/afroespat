import { z } from 'zod';
import { afterEach, describe, expect, it } from 'vitest';
import { ApiError, formatRetryAfter, parseRetryAfter } from '../errors';
import { memberApi } from '../member';
import { clearSession } from '../session';
import { errorBody, fakeServer, type FakeServer } from './harness';

/**
 * LE DÉBIT LIMITÉ — 00 §5.5, T4 §5.
 *
 * Deux règles à garder, et la seconde est celle qui se paie :
 *
 *   1. un `429` se DISTINGUE d'un échec ordinaire ;
 *   2. l'attente se compte en SECONDES, et elle peut valoir une HEURE.
 *
 * Mesuré sur l'API qui tourne, en dépassant `POST /v1/auth/otp/request` (10/h) :
 *
 *     HTTP 429  Retry-After: 3600
 *     {"error":{"code":"RATE_LIMITED",
 *               "message":"Trop de tentatives. Patientez un instant avant de réessayer.",
 *               "details":{"scope":"route (10/h)","limit":10,"retryAfterSeconds":3600}}}
 *
 * Le message du serveur dit « patientez un instant » pour UNE HEURE d'attente. C'est
 * la trace de §5.5, qui raisonne par minute, alors que trois routes sont chiffrées à
 * l'heure. Un client qui reprend ce message fait réessayer en boucle : le membre
 * épuise le budget des autres derrière le même NAT, et finit par croire que
 * l'inscription est cassée.
 */
describe('limite de débit', () => {
  let server: FakeServer;
  const ok = z.object({ ok: z.boolean() });

  afterEach(() => {
    server?.restore();
    clearSession();
  });

  /** La réponse exacte relevée sur l'API, en-tête compris. */
  function tooManyRequests(seconds = 3600): Parameters<typeof fakeServer>[0] {
    return () => ({
      status: 429,
      headers: { 'retry-after': String(seconds) },
      json: errorBody('RATE_LIMITED', 'Trop de tentatives. Patientez un instant avant de réessayer.', {
        scope: 'route (10/h)',
        limit: 10,
        retryAfterSeconds: seconds,
      }),
    });
  }

  it('[RÈGLE DURE] un 429 est reconnaissable, et ne se confond pas avec un autre refus', async () => {
    server = fakeServer(tooManyRequests());

    const failure = await memberApi
      .post('/auth/otp/request', ok, { body: {} })
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ApiError);
    const error = failure as ApiError;
    expect(error.isRateLimited).toBe(true);
    expect(error.status).toBe(429);
    expect(error.code).toBe('RATE_LIMITED');
    // Et le contraste : un 403 n'est PAS une limite de débit.
    expect(error.levelRequired).toBeNull();
  });

  it('[RÈGLE DURE] l’attente est rendue en SECONDES, sans division par 60', async () => {
    server = fakeServer(tooManyRequests(3600));

    const error = (await memberApi
      .post('/auth/otp/request', ok, { body: {} })
      .catch((e: unknown) => e)) as ApiError;

    // 3600 SECONDES. Ni 60, ni 216 000. C'est l'assertion qui garde le facteur 60.
    expect(error.retryAfterSeconds).toBe(3600);
    expect(error.rateLimit).toMatchObject({ scope: 'route (10/h)', limit: 10 });
  });

  it('[RÈGLE DURE] le message affiché dit « une heure », pas « un instant »', async () => {
    server = fakeServer(tooManyRequests(3600));

    const error = (await memberApi
      .post('/auth/otp/request', ok, { body: {} })
      .catch((e: unknown) => e)) as ApiError;

    expect(error.displayMessage).toContain('une heure');
    // Le message du serveur est bien celui qu'on refuse de reprendre tel quel.
    expect(error.message).toContain('un instant');
    expect(error.displayMessage).not.toContain('un instant');
  });

  it('un 429 sans détails reste reconnaissable grâce à l’en-tête', async () => {
    // Le cas du proxy : `Retry-After` présent, corps hors format §5.2.
    server = fakeServer(() => ({
      status: 429,
      headers: { 'retry-after': '120' },
      text: 'Too Many Requests',
    }));

    const error = (await memberApi.get('/me', ok).catch((e: unknown) => e)) as ApiError;

    expect(error.isRateLimited).toBe(true);
    expect(error.retryAfterSeconds).toBe(120);
    expect(error.displayMessage).toContain('2 minutes');
  });

  it('un 429 sans en-tête retombe sur les détails', async () => {
    server = fakeServer(() => ({
      status: 429,
      json: errorBody('RATE_LIMITED', 'Trop de tentatives.', { retryAfterSeconds: 45 }),
    }));

    const error = (await memberApi.get('/me', ok).catch((e: unknown) => e)) as ApiError;
    expect(error.retryAfterSeconds).toBe(45);
  });

  it('un 429 sans aucune indication ne prétend pas savoir', async () => {
    // `null`, et non un nombre inventé : annoncer une attente fausse ferait réessayer
    // trop tôt, donc reprendre un 429.
    server = fakeServer(() => ({ status: 429, json: errorBody('RATE_LIMITED') }));

    const error = (await memberApi.get('/me', ok).catch((e: unknown) => e)) as ApiError;
    expect(error.retryAfterSeconds).toBeNull();
    expect(error.isRateLimited).toBe(true);
  });

  it('[RÈGLE DURE] un 429 n’est JAMAIS rejoué', async () => {
    /**
     * Rejouer un appel freiné aggrave exactement ce que la limite protège — et, la
     * fenêtre étant FIXE côté serveur, le rejeu compte aussi. Le socle ne rejoue que
     * sur les `401` rafraîchissables ; un `429` doit remonter du premier coup.
     */
    server = fakeServer(tooManyRequests());

    await memberApi.get('/me', ok).catch(() => undefined);

    expect(server.calls).toHaveLength(1);
    expect(server.matching('/auth/refresh')).toHaveLength(0);
  });

  describe('formatRetryAfter', () => {
    it('rend des phrases justes aux trois échelles', () => {
      expect(formatRetryAfter(1)).toBe('une seconde');
      expect(formatRetryAfter(30)).toBe('30 secondes');
      expect(formatRetryAfter(60)).toBe('une minute');
      expect(formatRetryAfter(120)).toBe('2 minutes');
      // 20/h sur `PATCH /me` : l'attente annoncée doit être une heure.
      expect(formatRetryAfter(3600)).toBe('une heure');
      expect(formatRetryAfter(7200)).toBe('2 heures');
    });

    it('arrondit vers le HAUT', () => {
      // Annoncer moins que la réalité fait réessayer trop tôt, donc reprendre un 429.
      expect(formatRetryAfter(61)).toBe('2 minutes');
      expect(formatRetryAfter(3601)).toBe('2 heures');
    });
  });

  describe('parseRetryAfter', () => {
    it('lit les secondes', () => {
      expect(parseRetryAfter('3600')).toBe(3600);
      expect(parseRetryAfter(' 45 ')).toBe(45);
    });

    it('lit aussi une date HTTP (RFC 9110 §10.2.3)', () => {
      // `RateLimitGuard` envoie des secondes, mais la norme admet les deux formes et
      // un intermédiaire peut envoyer une date. La lire comme un nombre donnerait
      // `NaN`, donc aucune attente annoncée là où il en faut une.
      const dans2min = new Date(Date.now() + 120_000).toUTCString();
      const parsed = parseRetryAfter(dans2min);
      expect(parsed).not.toBeNull();
      expect(parsed).toBeGreaterThan(100);
      expect(parsed).toBeLessThanOrEqual(121);
    });

    it('rend null sur l’absence ou l’illisible', () => {
      expect(parseRetryAfter(null)).toBeNull();
      expect(parseRetryAfter('')).toBeNull();
      expect(parseRetryAfter('bientôt')).toBeNull();
    });
  });
});
