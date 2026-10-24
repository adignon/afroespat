import { z } from 'zod';
import { afterEach, describe, expect, it } from 'vitest';
import { memberApi } from '../member';
import { attendreSession, clearSession, hasAccessToken } from '../session';
import { fakeServer, fakeToken, type FakeServer } from './harness';

/**
 * LA REPRISE DE SESSION PASSE AVANT LE PREMIER APPEL — W1A, phase 0.6.
 *
 * Mesuré au navigateur : au chargement d'une page membre, `/me`, `/journeys` et
 * `/communities` partaient sans jeton et prenaient trois `401` avant d'être
 * rejoués. La reprise existait mais tournait dans un `useEffect`, derrière ceux
 * des écrans. Ces cas fixent le comportement attendu du transport : quand une
 * session est attendue, le rafraîchissement part d'abord, UNE fois, et aucun appel
 * ne prend de `401`.
 */
describe('reprise avant le premier appel authentifié', () => {
  let server: FakeServer;
  const ok = z.object({ ok: z.boolean() });

  afterEach(() => {
    server?.restore();
    clearSession();
    try {
      localStorage.clear();
    } catch {
      // pas de stockage : rien à vider
    }
  });

  it('une session attendue : refresh d’abord, UN seul, aucun 401', async () => {
    attendreSession();
    server = fakeServer((call) => {
      if (call.url.includes('/auth/refresh')) return { json: { accessToken: fakeToken('neuf') } };
      return call.headers['authorization'] === undefined
        ? { status: 401, json: { error: { code: 'UNAUTHENTICATED', message: 'non' } } }
        : { json: { ok: true } };
    });

    await Promise.all([
      memberApi.get('/me', ok),
      memberApi.get('/journeys', ok),
      memberApi.get('/communities', ok),
    ]);

    expect(server.matching('/auth/refresh')).toHaveLength(1);
    // Le refresh précède tout autre appel.
    expect(server.calls[0]?.url).toContain('/auth/refresh');
    expect(server.calls.filter((c) => c.headers['authorization'] === undefined && !c.url.includes('/auth/refresh'))).toHaveLength(0);
    expect(hasAccessToken()).toBe(true);
  });

  it('aucune session attendue : pas de refresh préalable (visiteur de /connexion)', async () => {
    server = fakeServer(() => ({ json: { ok: true } }));
    await memberApi.get('/places/countries', ok);
    expect(server.matching('/auth/refresh')).toHaveLength(0);
  });

  it('l’indicateur du navigateur suffit à déclarer la session attendue', async () => {
    localStorage.setItem('dp_session', '1');
    server = fakeServer((call) =>
      call.url.includes('/auth/refresh')
        ? { json: { accessToken: fakeToken('neuf') } }
        : { json: { ok: true } },
    );
    await memberApi.get('/me', ok);
    expect(server.calls[0]?.url).toContain('/auth/refresh');
  });

  it('les routes /auth/ ne reprennent rien (envoi du code, déconnexion)', async () => {
    attendreSession();
    server = fakeServer(() => ({ json: { ok: true } }));
    await memberApi.post('/auth/otp/request', ok);
    expect(server.matching('/auth/refresh')).toHaveLength(0);
  });

  it('un refus définitif de la reprise ne la rejoue pas à chaque appel', async () => {
    attendreSession();
    server = fakeServer((call) =>
      call.url.includes('/auth/refresh')
        ? { status: 401, json: { error: { code: 'UNAUTHENTICATED', message: 'non' } } }
        : { status: 401, json: { error: { code: 'UNAUTHENTICATED', message: 'non' } } },
    );
    await memberApi.get('/me', ok).catch(() => undefined);
    await memberApi.get('/journeys', ok).catch(() => undefined);
    expect(server.matching('/auth/refresh')).toHaveLength(1);
  });
});
