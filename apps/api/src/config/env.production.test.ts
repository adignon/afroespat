import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_BASE_URLS, envSchema, insecureLaunchWarnings, productionProblems } from './env';

const k = (n: number) => Buffer.alloc(32, n + 40).toString('base64');
/** Une configuration de production SAINE : aucune valeur de développement. */
const GOOD = {
  NODE_ENV: 'production', APP_NAME: 'DiasporyPlus', WEB_ORIGIN: 'https://diasporyplus.com', ADMIN_ORIGIN: 'https://diasporyplus.com',
  DATABASE_URL: 'postgresql://app:Zq9x7Lm2Vb4Tn8Rc@postgres:5432/app', REDIS_URL: 'redis://:r3dis@redis:6379',
  JWT_ACCESS_SECRET: 'Ak3jf92Lqz81VbnX7cTr5HwYp0MdEu6S', JWT_REFRESH_SECRET: 'Qw8rT1yUi5oPa3sDf6gHj9kLz2xCv4Bn',
  CURSOR_SECRET: 'Zx3cVb6nM9aSd2fGh5jKl8qWe1rTy4Ui', PHONE_ENCRYPTION_KEY: k(1), PHONE_HMAC_KEY: 'Mn4bVc7xZ0lKj3hGf6dSa9pOi2uYt5Re',
  CONTENT_ENCRYPTION_KEY: k(2), S3_ENDPOINT: 'https://s3.eu-west-3.amazonaws.com', S3_REGION: 'eu-west-3', S3_BUCKET: 'media',
  S3_ACCESS_KEY_ID: 'AKIAREALKEYID', S3_SECRET_ACCESS_KEY: 'rEaLsEcReT0123456789',
};
const problems = (extra: Record<string, string> = {}) => productionProblems(envSchema.parse({ ...GOOD, ...extra }));

describe('garde-fous de production (productionProblems)', () => {
  it('une configuration saine ne soulève rien', () => {
    expect(problems()).toEqual([]);
  });

  it('OTP_TEST_PHONES=* est refusé, sauf ALLOW_INSECURE_LAUNCH=true', () => {
    const base = { SMS_PROVIDER: 'testers', OTP_TEST_PHONES: '*', SMS_FAKE_FIXED_CODE: '654321' };
    expect(problems(base).join('\n')).toContain('OTP_TEST_PHONES');
    expect(problems({ ...base, ALLOW_INSECURE_LAUNCH: 'true' })).toEqual([]);
  });
  it('SMS_PROVIDER=testers avec le code fixe par défaut est refusé, sauf ALLOW_INSECURE_LAUNCH=true', () => {
    const base = { SMS_PROVIDER: 'testers', OTP_TEST_PHONES: '+33612345678' };
    expect(problems(base).join('\n')).toContain('123456');
    expect(problems({ ...base, SMS_FAKE_FIXED_CODE: '654321' })).toEqual([]);
    expect(problems({ ...base, ALLOW_INSECURE_LAUNCH: 'true' })).toEqual([]);
  });

  it('RATE_LIMIT_ENABLED=false est refusé, même avec ALLOW_INSECURE_LAUNCH', () => {
    expect(problems({ RATE_LIMIT_ENABLED: 'false', ALLOW_INSECURE_LAUNCH: 'true' }).join('\n')).toContain('RATE_LIMIT_ENABLED');
  });

  it.each(['WEB_ORIGIN', 'ADMIN_ORIGIN', 'S3_ENDPOINT'])('%s vers localhost / 127.0.0.1 est refusé', (name) => {
    expect(problems({ [name]: 'http://localhost:3000' }).join('\n')).toContain(name);
    expect(problems({ [name]: 'http://127.0.0.1:9000' }).join('\n')).toContain(name);
  });

  it('une *_BASE_URL surchargée est refusée ; la valeur par défaut passe', () => {
    for (const name of Object.keys(DEFAULT_BASE_URLS)) {
      expect(problems({ [name]: 'http://evil.example' }).join('\n')).toContain(name);
    }
    expect(problems({ TWILIO_BASE_URL: 'https://api.twilio.com/' })).toEqual([]);
  });

  it('un secret de développement est refusé (dev-, change-me, clé base64 décodée, valeurs d’exemple)', () => {
    expect(problems({ JWT_ACCESS_SECRET: 'dev-access-secret-0000000000000000000' }).join('\n')).toContain('JWT_ACCESS_SECRET');
    expect(problems({ CURSOR_SECRET: 'prod-change-me-xxxxxxxxxxxxxxxxxxxxxxxx' }).join('\n')).toContain('CURSOR_SECRET');
    expect(problems({ PHONE_ENCRYPTION_KEY: 'ZGV2LXBob25lLWtleS0zMi1ieXRlcy0wMDAwMDAwMDA=' }).join('\n')).toContain('PHONE_ENCRYPTION_KEY');
    expect(problems({ S3_SECRET_ACCESS_KEY: 'minioadmin' }).join('\n')).toContain('S3_SECRET_ACCESS_KEY');
    expect(problems({ STRIPE_WEBHOOK_SECRET: 'dev-stripe-webhook-secret-0000000000' }).join('\n')).toContain('STRIPE_WEBHOOK_SECRET');
  });

  it('TOUTES les valeurs de développement de .env.example sont refusées en production', () => {
    const lines = readFileSync(resolve(__dirname, '../../../../.env.example'), 'utf8').split(/\r?\n/);
    const example: Record<string, string> = {};
    for (const l of lines) {
      const m = /^([A-Z0-9_]+)=([^#]*)/.exec(l);
      if (m?.[1] !== undefined && m[2] !== undefined) example[m[1]] = m[2].trim();
    }
    for (const name of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'CURSOR_SECRET', 'PHONE_ENCRYPTION_KEY', 'PHONE_HMAC_KEY', 'CONTENT_ENCRYPTION_KEY', 'S3_SECRET_ACCESS_KEY', 'STRIPE_WEBHOOK_SECRET', 'MOBILE_MONEY_WEBHOOK_SECRET']) {
      const value = example[name];
      expect(value, name).toBeTruthy();
      expect(problems({ [name]: value as string }).join('\n'), name).toContain(name);
    }
  });
});

describe('avertissements de lancement dégradé (insecureLaunchWarnings)', () => {
  it('CAPTCHA_PROVIDER=off et AI_MODERATION_PROVIDER=off restent acceptés mais avertissent', () => {
    const env = envSchema.parse({ ...GOOD, CAPTCHA_PROVIDER: 'off', AI_MODERATION_PROVIDER: 'off' });
    expect(productionProblems(env)).toEqual([]);
    const w = insecureLaunchWarnings(env).join('\n');
    expect(w).toContain('CAPTCHA_PROVIDER=off');
    expect(w).toContain('AI_MODERATION_PROVIDER=off');
  });
  it('rien à signaler sur une configuration saine', () => {
    expect(insecureLaunchWarnings(envSchema.parse(GOOD))).toEqual([]);
  });
});
