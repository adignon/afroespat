import { z } from 'zod';

/**
 * Configuration — 00-fondations.md §11.2.
 *
 * « Toute configuration passe par des variables d'environnement, validées au
 * démarrage ; l'application refuse de démarrer si une variable manque. »
 *
 * Refuser de démarrer est volontairement brutal : une clé de chiffrement absente
 * qui se révèle à la première écriture coûte bien plus cher qu'un serveur qui ne
 * démarre pas.
 */

/** Une clé de chiffrement de 32 octets, transmise en base64. */
const base64Key32 = z
  .string()
  .refine((v) => Buffer.from(v, 'base64').length === 32, {
    message: 'doit être une clé de 32 octets encodée en base64',
  });

const providerMode = <T extends string>(...real: T[]) =>
  z.enum(['fake', ...real] as [string, ...string[]]).default('fake');

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  /** api : serveur HTTP. worker : mêmes modules, processeurs de files actifs (§3.1). */
  APP_ROLE: z.enum(['api', 'worker']).default('api'),
  APP_NAME: z.string().min(1),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  WEB_ORIGIN: z.string().url(),
  ADMIN_ORIGIN: z.string().url(),
  DEFAULT_TIMEZONE: z.string().default('Europe/Paris'),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),

  // ── Secrets. Aucune valeur par défaut : c'est tout l'intérêt. ──────────────
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  /** Signe les curseurs de pagination : un curseur est opaque ET signé (§5.3). */
  CURSOR_SECRET: z.string().min(32),
  /** Chiffre les numéros. JAMAIS rotée : la rotation impose un réchiffrement complet. */
  PHONE_ENCRYPTION_KEY: base64Key32,
  PHONE_HMAC_KEY: z.string().min(32),
  /** Chiffre notes d'étape et messages. Rotée tous les 12 mois (runbook §1). */
  CONTENT_ENCRYPTION_KEY: base64Key32,

  // ── Stockage objet — région UE obligatoire en production (règle dure §8.2) ─
  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),

  // ── Fournisseurs externes. `fake` partout en local et en test (§11.3). ─────
  SMS_PROVIDER: providerMode('twilio'),
  SMS_FAKE_FIXED_CODE: z.string().regex(/^\d{6}$/).default('123456'),
  EMAIL_PROVIDER: providerMode('brevo'),
  EMAIL_SMTP_URL: z.string().optional(),
  PUSH_PROVIDER: providerMode('webpush'),
  KYC_PROVIDER: providerMode('didit'),
  PAYMENT_PROVIDER: providerMode('stripe'),
  MOBILE_MONEY_PROVIDER: providerMode('fedapay', 'kkiapay', 'paydunya'),
  AI_MODERATION_PROVIDER: providerMode('anthropic'),
  CAPTCHA_PROVIDER: providerMode('turnstile'),
  ANTIVIRUS_HOST: z.string().default('localhost'),
  ANTIVIRUS_PORT: z.coerce.number().int().default(3310),

  SENTRY_DSN: z.string().optional(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

/**
 * Valide l'environnement. Échoue bruyamment, avec la liste complète des
 * variables fautives — pas la première seulement : corriger une variable pour
 * découvrir la suivante au redémarrage est une perte de temps.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (cached !== undefined) return cached;

  const result = envSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues
      .map((i) => `  · ${i.path.join('.')} — ${i.message}`)
      .join('\n');
    throw new Error(
      `Configuration invalide : l'application refuse de démarrer (§11.2).\n${problems}\n\n` +
        'Repartez de .env.example : il contient des valeurs de développement pour tout.',
    );
  }

  // Un garde-fou qui coûte une ligne et évite une fuite : en production, aucun
  // fournisseur ne doit rester en mode fictif.
  if (result.data.NODE_ENV === 'production') {
    const fakes = Object.entries(result.data)
      .filter(([k, v]) => k.endsWith('_PROVIDER') && v === 'fake')
      .map(([k]) => k);
    if (fakes.length > 0) {
      throw new Error(
        `Fournisseurs encore en mode fictif en production : ${fakes.join(', ')}.\n` +
          'Un OTP fictif en production ouvrirait la plateforme à n’importe qui.',
      );
    }
  }

  cached = result.data;
  return cached;
}

/** Réservé aux tests. */
export function resetEnvCache(): void {
  cached = undefined;
}
