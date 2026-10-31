import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { z } from 'zod';
import { applyProviderMode } from './provider-demo-profile';

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

/**
 * Un secret de fournisseur : FACULTATIF dans le schéma, exigé par
 * `REQUIRED_BY_PROVIDER` dès que le fournisseur réel est choisi.
 *
 * La chaîne vide vaut absence : `.env.example` laisse ces lignes vides, et un
 * `KEY=` lu par `loadEnvFile` donne `''`, pas `undefined`. Sans ce prétraitement,
 * une clé vide passerait pour posée et l'erreur n'arriverait qu'au premier appel.
 */
const optionalSecret = z.preprocess(
  (v) => (v === '' ? undefined : v),
  z.string().min(1).optional(),
);

/** L'identifiant d'une clé de chiffrement : 1 à 255 (0 est réservé à l'ancien format). */
const keyId = z.coerce.number().int().min(1).max(255).default(1);

/**
 * Les clés RETIRÉES, encore lisibles : `id:base64,id:base64`. Vide par défaut.
 * Chaque clé doit faire 32 octets, et un identifiant ne peut pas servir deux fois.
 */
const previousKeys = z
  .preprocess((v) => (v === undefined ? '' : v), z.string())
  .transform((raw, ctx) => {
    const out: { id: number; key: string }[] = [];
    for (const part of raw.split(',').map((p) => p.trim()).filter((p) => p !== '')) {
      const at = part.indexOf(':');
      const id = Number(part.slice(0, at));
      const key = part.slice(at + 1);
      if (at < 1 || !Number.isInteger(id) || id < 1 || id > 255 || Buffer.from(key, 'base64').length !== 32) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `entrée « ${part.slice(0, 4)}… » : attendu id:clé-base64-de-32-octets`,
        });
        continue;
      }
      if (out.some((k) => k.id === id)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `identifiant de clé ${id} répété` });
      }
      out.push({ id, key });
    }
    return out;
  });

/**
 * Ce que chaque fournisseur RÉEL exige pour fonctionner.
 *
 * Vérifié DANS TOUT ENVIRONNEMENT, pas seulement en production : choisir `twilio`
 * en développement sans jeton ne doit pas démarrer un serveur qui lèverait au
 * premier SMS — c'est exactement le « repli silencieux » que ce lot retire de
 * `pick()` (`providers.module.ts`).
 */
export const REQUIRED_BY_PROVIDER: Readonly<
  Record<string, Readonly<Record<string, readonly string[]>>>
> = {
  SMS_PROVIDER: {
    twilio: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN'],
    whatsapp: ['WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_TEMPLATE_NAME'],
    testers: ['OTP_TEST_PHONES'],
  },
  EMAIL_PROVIDER: { brevo: ['BREVO_API_KEY'], mailjet: ['MAILJET_API_KEY', 'MAILJET_SECRET_KEY'] },
  PUSH_PROVIDER: { webpush: ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY'] },
  KYC_PROVIDER: { didit: ['DIDIT_API_KEY', 'DIDIT_WORKFLOW_ID', 'DIDIT_WEBHOOK_SECRET'] },
  AI_MODERATION_PROVIDER: { anthropic: ['ANTHROPIC_API_KEY'] },
  CAPTCHA_PROVIDER: { turnstile: ['TURNSTILE_SECRET_KEY'] },
};

/**
 * Les fournisseurs de PAIEMENT restent fictifs en production : le porteur a décidé
 * « on va laisser les paiements, tout sera gratuit pour le moment ». Aucune
 * implémentation réelle n'existe (`pick()` refuse d'ailleurs toute autre valeur que
 * `fake` pour eux), donc les exiger réels interdirait tout démarrage en production.
 * Le jour où l'intégration existe, cette exemption disparaît.
 */
const PAYMENT_PROVIDER_KEYS: readonly string[] = ['PAYMENT_PROVIDER', 'MOBILE_MONEY_PROVIDER'];

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  /**
   * Interrupteur des tâches planifiées de §9.3, dans le worker.
   *
   * `false` coupe les balayages SANS couper le worker : les consommateurs de
   * files et le relais de la boîte d'envoi continuent. C'est ce que le runbook §5
   * demande de pouvoir faire pendant un incident de base — sinon la seule option
   * serait d'arrêter le worker, ce qui bloquerait aussi les notifications.
   *
   * `z.coerce.boolean()` serait FAUX ici : il rend `true` pour la chaîne
   * « false », et l'interrupteur ne couperait jamais rien.
   */
  SCHEDULER_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),

  /**
   * La limite de débit du §5.5. Même forme que ci-dessus, et pour la même
   * raison : `z.coerce.boolean()` rend `true` pour la chaîne « false ».
   *
   * Par défaut ACTIVE : le défaut d'un interrupteur de protection doit être la
   * protection. Le dépôt la coupe dans son `.env` de développement, parce que la
   * suite d'intégration appelle des dizaines de fois la même route depuis la même
   * IP — une limite active y ferait échouer des tests pour une raison sans
   * rapport avec ce qu'ils éprouvent. Le test de la limite elle-même ne dépend
   * pas de cette variable : il fournit sa propre configuration (voir
   * `RATE_LIMIT_CONFIG` dans `common/rate-limit.guard.ts`).
   */
  RATE_LIMIT_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),

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
  /**
   * Chiffre les numéros ET les adresses email (12 §3 : « chiffrée comme le
   * téléphone »).
   *
   * ROTATION POSSIBLE depuis le lot « fournisseurs réels » : le format scellé porte
   * désormais l'identifiant de la clé (voir `crypto.service.ts`). On pose la clé
   * neuve ici avec un `PHONE_ENCRYPTION_KEY_ID` neuf, on déplace l'ancienne dans
   * `PHONE_ENCRYPTION_KEYS_PREVIOUS`, puis on lance le script de réchiffrement
   * (`infra/README.md`, « Rotation des clés »). L'ancien commentaire — « JAMAIS
   * rotée » — décrivait un format qui ne savait pas dire quelle clé l'avait scellé.
   */
  PHONE_ENCRYPTION_KEY: base64Key32,
  PHONE_ENCRYPTION_KEY_ID: keyId,
  PHONE_ENCRYPTION_KEYS_PREVIOUS: previousKeys,
  PHONE_HMAC_KEY: z.string().min(32),
  /** Chiffre notes d'étape et messages. Rotée tous les 12 mois (runbook §1). */
  CONTENT_ENCRYPTION_KEY: base64Key32,
  CONTENT_ENCRYPTION_KEY_ID: keyId,
  CONTENT_ENCRYPTION_KEYS_PREVIOUS: previousKeys,

  // ── Stockage objet — région UE obligatoire en production (règle dure §8.2) ─
  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  /**
   * `true` pour MinIO et la plupart des stockages compatibles hors AWS : l'adresse
   * est `endpoint/seau/clé` et non `seau.endpoint/clé`. Le défaut suit la pile
   * locale du dépôt, qui est un MinIO.
   */
  S3_FORCE_PATH_STYLE: z.enum(['true', 'false']).default('true').transform((v) => v === 'true'),

  // ── Fournisseurs externes. `fake` partout en local et en test (§11.3). ─────
  /**
   * `demo` : adaptateurs réels pointés sur le serveur démo (`apps/provider-demo`) avec
   * des clés de test — voir `provider-demo-profile.ts` et `docs/provider-demo.md`. Ne
   * fait que fournir des VALEURS PAR DÉFAUT ; refusé en production.
   */
  PROVIDER_MODE: z.enum(['standard', 'demo']).default('standard'),
  /**
   * URLs de base des API de fournisseurs. Le défaut est l'adresse de PRODUCTION : seul le
   * mode démo (ou un test) les change. `DIDIT_BASE_URL` et `S3_ENDPOINT` existent déjà.
   */
  TWILIO_BASE_URL: z.string().url().default('https://api.twilio.com'),
  BREVO_BASE_URL: z.string().url().default('https://api.brevo.com'),
  MAILJET_BASE_URL: z.string().url().default('https://api.mailjet.com'),
  TURNSTILE_BASE_URL: z.string().url().default('https://challenges.cloudflare.com'),
  ANTHROPIC_BASE_URL: z.string().url().default('https://api.anthropic.com'),
  SMS_PROVIDER: providerMode('twilio', 'whatsapp', 'testers'),
  SMS_FAKE_FIXED_CODE: z.string().regex(/^\d{6}$/).default('123456'),
  /**
   * `SMS_PROVIDER=testers` — accepté en production, EN ATTENDANT un vrai canal : le code
   * fixe `SMS_FAKE_FIXED_CODE` ne vaut que pour ces numéros (E.164, séparés par des
   * virgules) ; tout autre numéro est refusé. Rien n'est envoyé à personne.
   */
  OTP_TEST_PHONES: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z
      .string()
      .transform((s) => s.split(',').map((x) => x.trim()).filter((x) => x !== ''))
      .pipe(z.array(z.string().regex(/^\+\d{8,15}$/, 'doit être un numéro E.164 (+33612345678)')).min(1))
      .optional(),
  ),
  /**
   * Twilio — API Messages, et NON Verify. Le code OTP reste tiré, haché, borné en
   * tentatives et lié à son `purpose` par NOUS (`auth.service.ts`) : Verify
   * tirerait son propre code et garderait la vérification chez lui, ce qui ferait
   * deux sources de vérité pour un même défi et perdrait le lien code ↔ `purpose`
   * qui protège la suppression de compte (01 §2.8). Messages ne fait que porter.
   *
   * `TWILIO_MESSAGING_SERVICE_SID` est préféré à `TWILIO_FROM` quand il est posé :
   * un service de messagerie choisit l'expéditeur par pays (numéro long en France,
   * identifiant alphanumérique là où la réglementation l'exige).
   */
  TWILIO_ACCOUNT_SID: optionalSecret,
  TWILIO_AUTH_TOKEN: optionalSecret,
  TWILIO_FROM: optionalSecret,
  TWILIO_MESSAGING_SERVICE_SID: optionalSecret,
  /**
   * WhatsApp — API Cloud de Meta (`SMS_PROVIDER=whatsapp`). Le code part dans un MODÈLE
   * « Authentication » approuvé (`WHATSAPP_TEMPLATE_NAME`), seul message autorisé hors
   * de la fenêtre de 24 h. `WHATSAPP_OTP_BUTTON` : le modèle standard porte un bouton
   * « Copier le code » qui reçoit le code en second paramètre.
   */
  WHATSAPP_ACCESS_TOKEN: optionalSecret,
  WHATSAPP_PHONE_NUMBER_ID: optionalSecret,
  WHATSAPP_TEMPLATE_NAME: optionalSecret,
  WHATSAPP_TEMPLATE_LANGUAGE: z.string().min(2).default('fr'),
  WHATSAPP_OTP_BUTTON: z.enum(['true', 'false']).default('true').transform((v) => v === 'true'),
  WHATSAPP_API_VERSION: z.string().regex(/^v\d+\.\d+$/).default('v21.0'),
  WHATSAPP_BASE_URL: z.string().url().default('https://graph.facebook.com'),
  EMAIL_PROVIDER: providerMode('brevo', 'mailjet'),
  EMAIL_SMTP_URL: z.string().optional(),
  /** Brevo — API transactionnelle (`POST /v3/smtp/email`), 12 §2.5. */
  BREVO_API_KEY: optionalSecret,
  /** Mailjet — API Send v3.1 ; authentification Basic clé publique : clé secrète. */
  MAILJET_API_KEY: optionalSecret,
  MAILJET_SECRET_KEY: optionalSecret,
  /** « Expéditeur unique » (12 §2.5). */
  EMAIL_FROM_ADDRESS: z.string().email().default('no-reply@localhost.test'),
  EMAIL_FROM_NAME: z.string().min(1).default('DisaporyPlus'),
  PUSH_PROVIDER: providerMode('webpush'),
  /**
   * Web Push (VAPID). La clé PUBLIQUE est servie au navigateur par
   * `GET /me/push-subscriptions` ; la privée ne quitte jamais le serveur. Générer
   * une paire : `npx web-push generate-vapid-keys`.
   */
  VAPID_PUBLIC_KEY: optionalSecret,
  VAPID_PRIVATE_KEY: optionalSecret,
  /** « mailto:… » ou une URL : le service push s'en sert pour joindre l'émetteur. */
  VAPID_SUBJECT: z.string().default('mailto:no-reply@localhost.test'),
  KYC_PROVIDER: providerMode('didit'),
  /** Didit — création de session (`POST /v2/session/`) et lecture de la décision. */
  DIDIT_API_KEY: optionalSecret,
  DIDIT_WORKFLOW_ID: optionalSecret,
  DIDIT_BASE_URL: z.string().url().default('https://verification.didit.me'),
  /**
   * La fenêtre ANTI-REJEU du webhook : un `X-Timestamp` plus vieux (ou plus en
   * avance) que cela est refusé, même correctement signé. Cinq minutes : ce que
   * Didit recommande, et assez large pour une horloge un peu dérivée.
   */
  DIDIT_WEBHOOK_TOLERANCE_SECONDS: z.coerce.number().int().min(30).max(3600).default(300),
  /**
   * Le secret qui signe le webhook Didit (T4 §8, 01 §4.3 : « webhook signé,
   * en-tête HMAC »).
   *
   * OPTIONNEL dans le schéma, EXIGÉ en production dès que `KYC_PROVIDER` n'est
   * plus fictif — voir le garde-fou de `loadEnv`. Le rendre obligatoire tout de
   * suite empêcherait de démarrer tout environnement de développement existant
   * pour une clé qu'aucun fournisseur fictif n'emploie ; l'omettre du schéma
   * laisserait la vérification de signature silencieusement désactivée en
   * production, ce qui est bien pire : la route accepterait alors de n'importe
   * qui un « KYC approuvé ».
   */
  DIDIT_WEBHOOK_SECRET: z.string().min(16).optional(),
  PAYMENT_PROVIDER: providerMode('stripe'),
  MOBILE_MONEY_PROVIDER: providerMode('fedapay', 'kkiapay', 'paydunya'),
  /**
   * Les secrets de SIGNATURE des webhooks entrants (T4 §8, 14 §7.1).
   *
   * FACULTATIFS, et leur absence n'est pas un oubli : aucune clé Stripe n'existe,
   * et l'agrégateur Mobile Money n'est pas désigné (décision D4). Sans secret, le
   * vérificateur refuse TOUT webhook — voir `UnconfiguredWebhookVerifier`. C'est le
   * comportement voulu : un webhook accepté sans vérification serait une activation
   * d'abonnement ouverte à quiconque connaît l'URL.
   *
   * 32 caractères minimum QUAND ils sont présents : un secret partagé court se
   * force, et celui-ci ouvre le droit d'activer un abonnement.
   */
  STRIPE_WEBHOOK_SECRET: z.string().min(32).optional(),
  MOBILE_MONEY_WEBHOOK_SECRET: z.string().min(32).optional(),
  AI_MODERATION_PROVIDER: providerMode('anthropic', 'off'),
  /** Clé de l'API Claude. Le texte envoyé est TOUJOURS masqué avant (13 §2). */
  ANTHROPIC_API_KEY: optionalSecret,
  AI_MODERATION_MODEL: z.string().min(1).default('claude-opus-5-5'),
  CAPTCHA_PROVIDER: providerMode('turnstile', 'off'),
  /** Cloudflare Turnstile, vérification serveur (`/turnstile/v0/siteverify`). */
  TURNSTILE_SECRET_KEY: optionalSecret,
  /**
   * Stockage objet. `fake` écrit sur le disque local (`STORAGE_FAKE_DIR`) ; `s3`
   * parle à tout stockage compatible S3 — région UE en production (règle dure
   * §8.2). Il était FIGÉ à `fake` dans le module, sans variable : le garde-fou de
   * production ne pouvait donc pas le voir.
   */
  STORAGE_PROVIDER: providerMode('s3'),
  /**
   * Antivirus. `clamav` parle à clamd en TCP (protocole INSTREAM) sur
   * `ANTIVIRUS_HOST:ANTIVIRUS_PORT` — deux variables déclarées depuis le lot 0 et
   * lues par personne jusqu'ici.
   */
  ANTIVIRUS_PROVIDER: providerMode('clamav'),
  ANTIVIRUS_TIMEOUT_MS: z.coerce.number().int().min(1000).default(30_000),
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

  // Les noms posés par le shell AVANT le `.env` : le profil démo ne doit pas les écraser.
  const shellKeys = source === process.env ? new Set(Object.keys(process.env)) : undefined;
  if (source === process.env) loadDotEnvFromRepoRoot();

  const result = envSchema.safeParse(applyProviderMode(source, shellKeys));
  if (!result.success) {
    const problems = result.error.issues
      .map((i) => `  · ${i.path.join('.')} — ${i.message}`)
      .join('\n');
    throw new Error(
      `Configuration invalide : l'application refuse de démarrer (§11.2).\n${problems}\n\n` +
        'Repartez de .env.example : il contient des valeurs de développement pour tout.',
    );
  }

  const missing = missingProviderSettings(result.data);
  if (missing.length > 0) {
    throw new Error(
      `Configuration invalide : l'application refuse de démarrer (§11.2).\n` +
        `${missing.map((m) => `  · ${m}`).join('\n')}`,
    );
  }

  // Un garde-fou qui coûte une ligne et évite une fuite : en production, aucun
  // fournisseur ne doit rester en mode fictif. `STORAGE_PROVIDER` et
  // `ANTIVIRUS_PROVIDER` y entrent depuis qu'ils sont des variables : figés à
  // `fake` dans le module, ils échappaient au filtre par suffixe ci-dessous — la
  // production aurait écrit les médias sur le disque local, sans antivirus.
  if (result.data.NODE_ENV === 'production') {
    const fakes = Object.entries(result.data)
      .filter(([k, v]) => k.endsWith('_PROVIDER') && v === 'fake' && !PAYMENT_PROVIDER_KEYS.includes(k))
      .map(([k]) => k);
    if (fakes.length > 0) {
      throw new Error(
        `Fournisseurs encore en mode fictif en production : ${fakes.join(', ')}.\n` +
          'Un OTP fictif en production ouvrirait la plateforme à n’importe qui.',
      );
    }

    /**
     * Le webhook KYC doit être vérifiable. Sans ce secret, `POST /webhooks/didit`
     * refuse tout — donc aucun membre ne passerait jamais L1 —, et le découvrir en
     * production coûterait une journée de vérifications d'identité perdues.
     */
    if (result.data.KYC_PROVIDER !== 'fake' && result.data.DIDIT_WEBHOOK_SECRET === undefined) {
      throw new Error(
        'DIDIT_WEBHOOK_SECRET est absent alors que KYC_PROVIDER n’est pas fictif : le webhook ' +
          'signé de 01 §4.3 ne pourrait pas être vérifié, donc aucun résultat de vérification ' +
          'd’identité ne serait accepté.',
      );
    }
  }

  cached = result.data;
  return cached;
}

/**
 * Les réglages manquants pour les fournisseurs RÉELS choisis — exporté pour être
 * éprouvé sans recharger le module.
 */
export function missingProviderSettings(data: Env): string[] {
  const record = data as unknown as Record<string, unknown>;
  const missing: string[] = [];
  for (const [variable, byMode] of Object.entries(REQUIRED_BY_PROVIDER)) {
    const mode = String(record[variable]);
    for (const needed of byMode[mode] ?? []) {
      if (record[needed] === undefined) missing.push(`${variable}=${mode} exige ${needed}`);
    }
  }
  if (data.SMS_PROVIDER === 'twilio' && data.TWILIO_FROM === undefined && data.TWILIO_MESSAGING_SERVICE_SID === undefined) {
    missing.push('SMS_PROVIDER=twilio exige TWILIO_FROM ou TWILIO_MESSAGING_SERVICE_SID');
  }
  return missing;
}

/** Réservé aux tests. */
export function resetEnvCache(): void {
  cached = undefined;
}

/**
 * Charge le `.env` de la racine du dépôt, hors production.
 *
 * Sans cela, `pnpm dev` ne fonctionne que lancé depuis la racine : le script du
 * paquet, lui, ne charge rien. On ne s'en aperçoit qu'en lançant le serveur
 * depuis `apps/api` — et on perd alors du temps à chercher dans le schéma de
 * validation un défaut qui n'y est pas.
 *
 * En PRODUCTION, rien n'est chargé : les variables viennent de l'orchestrateur,
 * et un fichier `.env` qui traînerait sur le serveur ne doit surtout pas les
 * remplacer silencieusement.
 */
function loadDotEnvFromRepoRoot(): void {
  if (process.env['NODE_ENV'] === 'production') return;

  // On remonte jusqu'au pnpm-workspace.yaml : c'est ce qui définit la racine.
  let dir = __dirname;
  for (let depth = 0; depth < 8; depth += 1) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) {
      const envFile = join(dir, '.env');
      // `loadEnvFile` n'écrase pas une variable déjà posée : le shell ou le
      // conteneur gagnent sur le fichier. (Vérifié, pas supposé — c'est le
      // comportement de `--env-file`, et il n'y a pas d'option pour le régler.)
      if (existsSync(envFile)) process.loadEnvFile(envFile);
      return;
    }
    const parent = dirname(dir);
    if (parent === dir) return;
    dir = parent;
  }
}
