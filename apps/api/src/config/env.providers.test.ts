import { describe, expect, it } from 'vitest';
import { envSchema, missingProviderSettings } from './env';

const BASE = {
  APP_NAME: 'app', WEB_ORIGIN: 'http://localhost:3000', ADMIN_ORIGIN: 'http://localhost:3010',
  DATABASE_URL: 'postgresql://a:b@localhost:5432/x', REDIS_URL: 'redis://localhost:6379',
  JWT_ACCESS_SECRET: 'a'.repeat(32), JWT_REFRESH_SECRET: 'b'.repeat(32), CURSOR_SECRET: 'c'.repeat(32),
  PHONE_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString('base64'), PHONE_HMAC_KEY: 'd'.repeat(32),
  CONTENT_ENCRYPTION_KEY: Buffer.alloc(32, 2).toString('base64'),
  S3_ENDPOINT: 'http://localhost:9000', S3_REGION: 'eu-west-1', S3_BUCKET: 'b', S3_ACCESS_KEY_ID: 'a', S3_SECRET_ACCESS_KEY: 's',
};
const parse = (extra: Record<string, string>) => envSchema.parse({ ...BASE, ...extra });

describe('variables des fournisseurs réels', () => {
  it('STORAGE_PROVIDER et ANTIVIRUS_PROVIDER existent, fictifs par défaut', () => {
    const env = parse({});
    expect([env.STORAGE_PROVIDER, env.ANTIVIRUS_PROVIDER]).toEqual(['fake', 'fake']);
  });
  it('refuse une valeur inconnue', () => {
    expect(() => parse({ STORAGE_PROVIDER: 'gcs' })).toThrow();
  });
  it('un fournisseur réel sans ses secrets est signalé, dans tout environnement', () => {
    const m = missingProviderSettings(parse({ SMS_PROVIDER: 'twilio', EMAIL_PROVIDER: 'brevo', CAPTCHA_PROVIDER: 'turnstile' }));
    expect(m.join('\n')).toContain('TWILIO_ACCOUNT_SID');
    expect(m.join('\n')).toContain('TWILIO_FROM ou TWILIO_MESSAGING_SERVICE_SID');
    expect(m.join('\n')).toContain('BREVO_API_KEY');
    expect(m.join('\n')).toContain('TURNSTILE_SECRET_KEY');
  });
  it('une chaîne vide vaut absence', () => {
    expect(parse({ BREVO_API_KEY: '' }).BREVO_API_KEY).toBeUndefined();
  });
  it('tout posé → rien ne manque', () => {
    const env = parse({ SMS_PROVIDER: 'twilio', TWILIO_ACCOUNT_SID: 'AC', TWILIO_AUTH_TOKEN: 't', TWILIO_FROM: '+33' });
    expect(missingProviderSettings(env)).toEqual([]);
  });
  it('les clés précédentes sont validées', () => {
    const k = Buffer.alloc(32, 9).toString('base64');
    expect(parse({ PHONE_ENCRYPTION_KEYS_PREVIOUS: `1:${k}` }).PHONE_ENCRYPTION_KEYS_PREVIOUS).toEqual([{ id: 1, key: k }]);
    expect(() => parse({ PHONE_ENCRYPTION_KEYS_PREVIOUS: '1:court' })).toThrow();
    expect(() => parse({ PHONE_ENCRYPTION_KEYS_PREVIOUS: `1:${k},1:${k}` })).toThrow();
  });
});

describe('garde-fou de production', () => {
  const prod = (extra: Record<string, string>): NodeJS.ProcessEnv => ({ ...BASE, NODE_ENV: 'production', ...extra }) as NodeJS.ProcessEnv;
  const REAL = {
    SMS_PROVIDER: 'twilio', TWILIO_ACCOUNT_SID: 'AC', TWILIO_AUTH_TOKEN: 't', TWILIO_FROM: '+33',
    EMAIL_PROVIDER: 'brevo', BREVO_API_KEY: 'k', PUSH_PROVIDER: 'webpush', VAPID_PUBLIC_KEY: 'p', VAPID_PRIVATE_KEY: 'q',
    KYC_PROVIDER: 'didit', DIDIT_API_KEY: 'k', DIDIT_WORKFLOW_ID: 'w', DIDIT_WEBHOOK_SECRET: 'x'.repeat(20),
    AI_MODERATION_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'k', CAPTCHA_PROVIDER: 'turnstile', TURNSTILE_SECRET_KEY: 's',
  };
  it('refuse STORAGE_PROVIDER=fake et ANTIVIRUS_PROVIDER=fake en production', async () => {
    const { loadEnv, resetEnvCache } = await import('./env');
    resetEnvCache();
    expect(() => loadEnv(prod(REAL))).toThrow(/STORAGE_PROVIDER, ANTIVIRUS_PROVIDER/);
    resetEnvCache();
  });
  it('accepte la production réelle, paiement fictif toléré', async () => {
    const { loadEnv, resetEnvCache } = await import('./env');
    resetEnvCache();
    expect(loadEnv(prod({ ...REAL, STORAGE_PROVIDER: 's3', ANTIVIRUS_PROVIDER: 'clamav' })).PAYMENT_PROVIDER).toBe('fake');
    resetEnvCache();
  });
});
