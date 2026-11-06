import { describe, expect, it, vi } from 'vitest';
import { motDePasseCompromis, sha1Hex, suffixePresent, verifierMotDePasseCompromis, type FetchLike } from '../password-breach';

// SHA-1("password") = 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8
const PASSWORD_SUFFIXE = '1E4C9B93F3F0682250B6CF8331B7EE68FD8';

const reponse = (corps: string, status = 200): ReturnType<FetchLike> =>
  Promise.resolve({ ok: status >= 200 && status < 300, status, text: () => Promise.resolve(corps) });

describe('mots de passe compromis (k-anonymat HIBP)', () => {
  it('calcule le SHA-1 attendu', () => {
    expect(sha1Hex('password')).toBe('5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8');
  });

  it('n’envoie que le préfixe de 5 caractères, avec bourrage', async () => {
    const f = vi.fn<FetchLike>(() => reponse(`${PASSWORD_SUFFIXE}:9545824\r\n0018A45C4D1DEF81644B54AB7F969B88D65:1`));
    expect(await verifierMotDePasseCompromis('password', f)).toBe('compromis');
    const [url, init] = f.mock.calls[0] as [string, { headers: Record<string, string> }];
    expect(url).toBe('https://api.pwnedpasswords.com/range/5BAA6');
    expect(url).not.toContain(PASSWORD_SUFFIXE);
    expect(init.headers['Add-Padding']).toBe('true');
  });

  it('propre quand le suffixe est absent, ou seulement en bourrage (compte 0)', async () => {
    expect(await verifierMotDePasseCompromis('password', () => reponse('AAAA:3'))).toBe('propre');
    expect(await verifierMotDePasseCompromis('password', () => reponse(`${PASSWORD_SUFFIXE}:0`))).toBe('propre');
    expect(suffixePresent(`${PASSWORD_SUFFIXE}:2`, PASSWORD_SUFFIXE)).toBe(true);
  });

  it('repli sûr : réseau en panne, statut d’erreur ou délai donnent « inconnu », jamais « propre »', async () => {
    expect(await verifierMotDePasseCompromis('x', () => Promise.reject(new Error('réseau')))).toBe('inconnu');
    expect(await verifierMotDePasseCompromis('x', () => reponse('', 503))).toBe('inconnu');
    const lent: FetchLike = (_u, init) =>
      new Promise((_ok, ko) => init.signal.addEventListener('abort', () => ko(new Error('abort'))));
    expect(await verifierMotDePasseCompromis('x', lent, 20)).toBe('inconnu');
  });

  it('ne fait aucun appel réseau sous NODE_ENV=test sans fetch injectée, et ne bloque pas hors ligne', async () => {
    expect(await motDePasseCompromis('password', { env: { NODE_ENV: 'test' } })).toBe(false);
    expect(await motDePasseCompromis('password', { fetchImpl: () => reponse(`${PASSWORD_SUFFIXE}:5`) })).toBe(true);
    expect(await motDePasseCompromis('password', { fetchImpl: () => Promise.reject(new Error('x')) })).toBe(false);
  });
});
