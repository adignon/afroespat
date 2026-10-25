import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEMO_DEFAULTS } from '@app/provider-demo';
import { loadEnv, resetEnvCache } from './env';
import { applyProviderMode, demoProfile } from './provider-demo-profile';
import { pick } from '../providers/providers.module';

/**
 * Le profil `PROVIDER_MODE=demo` : valeurs par défaut seulement, jamais en production,
 * identique à `.env.demo.example` et aux clés du serveur démo.
 */
const BASE: NodeJS.ProcessEnv = {
  NODE_ENV: 'test', APP_NAME: 'app', WEB_ORIGIN: 'http://localhost:3000', ADMIN_ORIGIN: 'http://localhost:3010',
  DATABASE_URL: 'postgresql://a:b@localhost:5432/x', REDIS_URL: 'redis://localhost:6379',
  JWT_ACCESS_SECRET: 'a'.repeat(32), JWT_REFRESH_SECRET: 'b'.repeat(32), CURSOR_SECRET: 'c'.repeat(32),
  PHONE_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString('base64'), PHONE_HMAC_KEY: 'd'.repeat(32),
  CONTENT_ENCRYPTION_KEY: Buffer.alloc(32, 2).toString('base64'),
};

function loadWith(extra: NodeJS.ProcessEnv) {
  resetEnvCache();
  try {
    return loadEnv({ ...extra });
  } finally {
    resetEnvCache();
  }
}

describe('PROVIDER_MODE=demo', () => {
  it('sans le mode : source inchangée ; avec : valeurs démo en défaut, valeurs posées conservées', () => {
    expect(applyProviderMode(BASE)).toBe(BASE);
    const merged = applyProviderMode({ ...BASE, PROVIDER_MODE: 'demo', TWILIO_AUTH_TOKEN: 'ma-clef', BREVO_API_KEY: '' });
    expect(merged['SMS_PROVIDER']).toBe('twilio');
    expect(merged['TWILIO_AUTH_TOKEN']).toBe('ma-clef');
    expect(merged['BREVO_API_KEY']).toBe('xkeysib-demo-brevo-api-key');
    expect(merged['TWILIO_BASE_URL']).toBe('http://localhost:3077');
    // Le paiement n'est jamais touché.
    expect(merged['PAYMENT_PROVIDER']).toBeUndefined();
    expect(merged['MOBILE_MONEY_PROVIDER']).toBeUndefined();
  });

  it('précédence : shell > profil > .env (le .env de développement ne bloque pas le mode démo)', () => {
    const fromDotEnv: NodeJS.ProcessEnv = { ...BASE, PROVIDER_MODE: 'demo', SMS_PROVIDER: 'fake', S3_ENDPOINT: 'http://localhost:9000', TWILIO_AUTH_TOKEN: 'du-shell' };
    const merged = applyProviderMode(fromDotEnv, new Set(['TWILIO_AUTH_TOKEN', 'NODE_ENV', 'PROVIDER_MODE']));
    expect(merged['SMS_PROVIDER']).toBe('twilio');
    expect(merged['S3_ENDPOINT']).toBe('http://localhost:3077');
    expect(merged['TWILIO_AUTH_TOKEN']).toBe('du-shell');
  });

  it('DEMO_BASE_URL déplace toutes les adresses de base, clamd compris', () => {
    const p = demoProfile('http://127.0.0.1:4555');
    expect(p['S3_ENDPOINT']).toBe('http://127.0.0.1:4555');
    expect(p['ANTHROPIC_BASE_URL']).toBe('http://127.0.0.1:4555');
    expect([p['ANTIVIRUS_HOST'], p['ANTIVIRUS_PORT']]).toEqual(['127.0.0.1', '4555']);
  });

  it('REFUSÉ en production', () => {
    expect(() => applyProviderMode({ ...BASE, NODE_ENV: 'production', PROVIDER_MODE: 'demo' })).toThrow(/interdit en production/);
  });

  it('charge une configuration complète : adaptateurs réels, adresses démo ; sans mode, adresses de production', () => {
    const demo = loadWith({ ...BASE, PROVIDER_MODE: 'demo' });
    expect(demo).toMatchObject({
      SMS_PROVIDER: 'twilio', EMAIL_PROVIDER: 'brevo', PUSH_PROVIDER: 'webpush', KYC_PROVIDER: 'didit',
      AI_MODERATION_PROVIDER: 'anthropic', CAPTCHA_PROVIDER: 'turnstile', STORAGE_PROVIDER: 's3',
      ANTIVIRUS_PROVIDER: 'clamav', PAYMENT_PROVIDER: 'fake', MOBILE_MONEY_PROVIDER: 'fake',
      TWILIO_BASE_URL: 'http://localhost:3077', ANTIVIRUS_PORT: 3077,
    });
    const prod = loadWith({ ...BASE, S3_ENDPOINT: 'http://localhost:9000', S3_REGION: 'r', S3_BUCKET: 'b', S3_ACCESS_KEY_ID: 'a', S3_SECRET_ACCESS_KEY: 's' });
    expect(prod).toMatchObject({
      TWILIO_BASE_URL: 'https://api.twilio.com',
      BREVO_BASE_URL: 'https://api.brevo.com',
      TURNSTILE_BASE_URL: 'https://challenges.cloudflare.com',
      ANTHROPIC_BASE_URL: 'https://api.anthropic.com',
      DIDIT_BASE_URL: 'https://verification.didit.me',
    });
  });

  it('les garde-fous de pick() restent : une valeur sans implémentation échoue toujours', () => {
    const provider = pick(Symbol('x'), 'PAYMENT_PROVIDER', 'stripe', () => ({}));
    expect(() => (provider as { useFactory: () => unknown }).useFactory()).toThrow(/aucune implémentation réelle/);
  });

  it('profil = .env.demo.example = clés du serveur démo', () => {
    const file = readFileSync(resolve(__dirname, '..', '..', '..', '..', '.env.demo.example'), 'utf8');
    const parsed = Object.fromEntries(
      file.split('\n').filter((l) => /^[A-Z0-9_]+=/.test(l)).map((l) => {
        const [k, ...rest] = l.split('=');
        return [k, rest.join('=').replace(/\s+#.*$/, '').trim()];
      }),
    ) as Record<string, string>;
    for (const [name, value] of Object.entries(demoProfile('http://localhost:3077'))) {
      expect(parsed[name], name).toBe(value);
    }
    for (const [name, value] of Object.entries(DEMO_DEFAULTS)) {
      expect(parsed[name], `${name} (serveur démo)`).toBe(value);
    }
  });
});
