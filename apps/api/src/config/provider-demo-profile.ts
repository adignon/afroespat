/**
 * Profil `PROVIDER_MODE=demo` : tous les fournisseurs RÉELS (adaptateurs réels), pointés
 * sur le serveur démo (`apps/provider-demo`) avec des clés de TEST.
 *
 * Ce n'est qu'un jeu de VALEURS PAR DÉFAUT : une variable posée dans l'environnement
 * gagne toujours. Passer en production, c'est donc : retirer `PROVIDER_MODE=demo`, poser
 * les vraies clés, et supprimer (ou remplacer) les `*_BASE_URL` — rien dans le code.
 *
 * Les valeurs doivent rester identiques à celles de `.env.demo.example` et de
 * `apps/provider-demo/src/config.ts` (vérifié par `provider-demo.test.ts`).
 * Les fournisseurs de PAIEMENT ne sont pas touchés : ils restent fictifs.
 */
export function demoProfile(demoUrl: string): Readonly<Record<string, string>> {
  const url = new URL(demoUrl);
  return {
    SMS_PROVIDER: 'twilio',
    TWILIO_ACCOUNT_SID: 'ACdemo00000000000000000000000000',
    TWILIO_AUTH_TOKEN: 'demo-twilio-auth-token',
    TWILIO_FROM: '+15005550006',
    TWILIO_BASE_URL: demoUrl,
    EMAIL_PROVIDER: 'brevo',
    BREVO_API_KEY: 'xkeysib-demo-brevo-api-key',
    BREVO_BASE_URL: demoUrl,
    PUSH_PROVIDER: 'webpush',
    VAPID_PUBLIC_KEY: 'BHUeTVgWuISQbsxk-hTE5W2REZyDqLRQmcz-9wu72eK-E4Ku_hEFkObksUBxalQrCi-ggJf0Z61HIt1CzV9DOoE',
    VAPID_PRIVATE_KEY: 's9gJ5FXfMnGawjne7tKPQTwnfHlFRE1qWOIamY7MTrM',
    KYC_PROVIDER: 'didit',
    DIDIT_API_KEY: 'demo-didit-api-key',
    DIDIT_WORKFLOW_ID: 'demo-didit-workflow',
    DIDIT_WEBHOOK_SECRET: 'demo-didit-webhook-secret-0123456789',
    DIDIT_BASE_URL: demoUrl,
    AI_MODERATION_PROVIDER: 'anthropic',
    ANTHROPIC_API_KEY: 'sk-ant-demo-anthropic-key',
    ANTHROPIC_BASE_URL: demoUrl,
    CAPTCHA_PROVIDER: 'turnstile',
    TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA',
    TURNSTILE_BASE_URL: demoUrl,
    STORAGE_PROVIDER: 's3',
    S3_ENDPOINT: demoUrl,
    S3_REGION: 'eu-west-1',
    S3_BUCKET: 'app-media',
    S3_ACCESS_KEY_ID: 'demo-access-key',
    S3_SECRET_ACCESS_KEY: 'demo-secret-key-0123456789abcdef',
    S3_FORCE_PATH_STYLE: 'true',
    ANTIVIRUS_PROVIDER: 'clamav',
    ANTIVIRUS_HOST: url.hostname,
    ANTIVIRUS_PORT: url.port === '' ? '80' : url.port,
  };
}

/**
 * Applique le profil : les variables ABSENTES (ou vides) prennent la valeur démo, les
 * autres sont conservées. Ne modifie pas `source`.
 */
export function applyProviderMode(source: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  if (source['PROVIDER_MODE'] !== 'demo') return source;
  if (source['NODE_ENV'] === 'production') {
    throw new Error(
      'PROVIDER_MODE=demo est interdit en production : les fournisseurs pointeraient sur un ' +
        'serveur de démonstration avec des clés de test publiques. Retirez-le et posez les vraies clés.',
    );
  }
  const defaults = demoProfile(source['DEMO_BASE_URL'] ?? 'http://localhost:3077');
  const merged: NodeJS.ProcessEnv = { ...source };
  for (const [name, value] of Object.entries(defaults)) {
    if (merged[name] === undefined || merged[name] === '') merged[name] = value;
  }
  return merged;
}
