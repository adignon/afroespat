/**
 * Configuration du serveur démo.
 *
 * Les clés portent EXACTEMENT les noms des variables de l'API (`TWILIO_AUTH_TOKEN`,
 * `BREVO_API_KEY`, …) : le même fichier `.env.demo` sert aux deux côtés, et passer
 * en production, c'est mettre les vraies valeurs dans ces mêmes variables.
 *
 * Les valeurs par défaut ci-dessous sont les clés de TEST publiques de
 * `.env.demo.example`. Elles ne protègent rien et ne doivent jamais être des clés réelles.
 */
export interface DemoConfig {
  readonly host: string;
  readonly port: number;
  /** Adresse sous laquelle les clients joignent ce serveur (liens retournés, audience VAPID). */
  readonly publicUrl: string;
  /** Fichier JSON où l'état est conservé entre deux démarrages (facultatif). */
  readonly stateFile: string | undefined;
  /** Où le démo poste les webhooks Didit signés. */
  readonly diditWebhookUrl: string;
  readonly twilioAccountSid: string;
  readonly twilioAuthToken: string;
  readonly brevoApiKey: string;
  readonly diditApiKey: string;
  readonly diditWorkflowId: string;
  readonly diditWebhookSecret: string;
  readonly turnstileSecretKey: string;
  readonly s3AccessKeyId: string;
  readonly s3SecretAccessKey: string;
  readonly s3Bucket: string;
  readonly s3Region: string;
  readonly anthropicApiKey: string;
  /** Clé publique VAPID attendue ; vide = toute clé est acceptée (liée à l'abonnement). */
  readonly vapidPublicKey: string;
}

export const DEMO_DEFAULTS = {
  TWILIO_ACCOUNT_SID: 'ACdemo00000000000000000000000000',
  TWILIO_AUTH_TOKEN: 'demo-twilio-auth-token',
  BREVO_API_KEY: 'xkeysib-demo-brevo-api-key',
  DIDIT_API_KEY: 'demo-didit-api-key',
  DIDIT_WORKFLOW_ID: 'demo-didit-workflow',
  DIDIT_WEBHOOK_SECRET: 'demo-didit-webhook-secret-0123456789',
  TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA',
  S3_ACCESS_KEY_ID: 'demo-access-key',
  S3_SECRET_ACCESS_KEY: 'demo-secret-key-0123456789abcdef',
  S3_BUCKET: 'app-media',
  S3_REGION: 'eu-west-1',
  ANTHROPIC_API_KEY: 'sk-ant-demo-anthropic-key',
} as const;

export function configFromEnv(env: NodeJS.ProcessEnv = process.env): DemoConfig {
  const pick = (name: keyof typeof DEMO_DEFAULTS): string => {
    const v = env[name];
    return v !== undefined && v !== '' ? v : DEMO_DEFAULTS[name];
  };
  const port = Number(env['DEMO_PORT'] ?? 3077);
  const apiPort = env['API_PORT'] ?? '3001';
  return {
    host: env['DEMO_HOST'] ?? '127.0.0.1',
    port,
    publicUrl: (env['DEMO_PUBLIC_URL'] ?? `http://localhost:${port}`).replace(/\/$/, ''),
    stateFile: env['DEMO_STATE_FILE'] === '' ? undefined : env['DEMO_STATE_FILE'],
    diditWebhookUrl: env['DEMO_DIDIT_WEBHOOK_URL'] ?? `http://localhost:${apiPort}/v1/webhooks/didit`,
    twilioAccountSid: pick('TWILIO_ACCOUNT_SID'),
    twilioAuthToken: pick('TWILIO_AUTH_TOKEN'),
    brevoApiKey: pick('BREVO_API_KEY'),
    diditApiKey: pick('DIDIT_API_KEY'),
    diditWorkflowId: pick('DIDIT_WORKFLOW_ID'),
    diditWebhookSecret: pick('DIDIT_WEBHOOK_SECRET'),
    turnstileSecretKey: pick('TURNSTILE_SECRET_KEY'),
    s3AccessKeyId: pick('S3_ACCESS_KEY_ID'),
    s3SecretAccessKey: pick('S3_SECRET_ACCESS_KEY'),
    s3Bucket: pick('S3_BUCKET'),
    s3Region: pick('S3_REGION'),
    anthropicApiKey: pick('ANTHROPIC_API_KEY'),
    vapidPublicKey: env['VAPID_PUBLIC_KEY'] ?? '',
  };
}
