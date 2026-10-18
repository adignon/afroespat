import { afterEach, describe, expect, it, vi } from 'vitest';
import { displayMessageFor } from '../api/errors';
import { CaptchaError, JETON_CAPTCHA_DE_TEST, obtenirJetonCaptcha } from '../captcha';

/** Captcha Turnstile côté navigateur : pas de DOM réel, un faux `window.turnstile`. */
function installerFauxDom(turnstile: Record<string, unknown>): { retire: ReturnType<typeof vi.fn> } {
  const retire = vi.fn();
  const noeud = () => ({ style: {}, appendChild: vi.fn(), setAttribute: vi.fn(), remove: retire });
  vi.stubGlobal('window', { turnstile });
  vi.stubGlobal('document', { createElement: noeud, body: { appendChild: vi.fn() }, head: { appendChild: vi.fn() } });
  return { retire };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('obtenirJetonCaptcha', () => {
  it('sans clé de site : le jeton de test officiel, aucun script chargé', async () => {
    vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', '');
    expect(await obtenirJetonCaptcha()).toBe(JETON_CAPTCHA_DE_TEST);
    expect(JETON_CAPTCHA_DE_TEST).toBe('XXXX.DUMMY.TOKEN.XXXX');
  });

  it('avec une clé : rend, exécute, rend le jeton du callback puis détruit le widget', async () => {
    vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', '0xSITE');
    let options: Record<string, (x?: string) => void> & { sitekey?: string } = {};
    const remove = vi.fn();
    const { retire } = installerFauxDom({
      render: (_c: unknown, o: typeof options) => { options = o; return 'w1'; },
      execute: () => options['callback']?.('jeton-reel'),
      remove,
    });
    expect(await obtenirJetonCaptcha()).toBe('jeton-reel');
    expect(options.sitekey).toBe('0xSITE');
    expect(remove).toHaveBeenCalledWith('w1');
    expect(retire).toHaveBeenCalled();
  });

  it('une erreur Cloudflare REJETTE avec un message lisible (jamais de jeton vide)', async () => {
    vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', '0xSITE');
    let options: Record<string, () => void> = {};
    installerFauxDom({
      render: (_c: unknown, o: typeof options) => { options = o; return 'w2'; },
      execute: () => options['error-callback']?.(),
      remove: vi.fn(),
    });
    const erreur = await obtenirJetonCaptcha().catch((e: unknown) => e);
    expect(erreur).toBeInstanceOf(CaptchaError);
    expect(displayMessageFor(erreur)).toContain('anti-robot');
  });
});
