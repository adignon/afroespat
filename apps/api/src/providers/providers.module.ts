import { Global, Module, type Provider } from '@nestjs/common';
import { loadEnv } from '../config/env';
import { AnthropicModerationProvider } from './anthropic-moderation.provider';
import { BrevoEmailProvider } from './brevo-email.provider';
import { MailjetEmailProvider } from './mailjet-email.provider';
import { ClamAvAntivirusProvider } from './clamav-antivirus.provider';
import { DiditKycProvider } from './didit-kyc.provider';
import {
  AI_MODERATION_PROVIDER, ANTIVIRUS_PROVIDER, CAPTCHA_PROVIDER, EMAIL_PROVIDER,
  DisabledAiModerationProvider, FakeAiModerationProvider, TestersSmsProvider, FakeAntivirusProvider, FakeCaptchaProvider, FakeEmailProvider,
  FakeKycProvider, FakeMobileMoneyProvider, FakePaymentProvider, FakePushProvider,
  FakeSmsProvider, FakeStorageProvider,
  KYC_PROVIDER, MOBILE_MONEY_PROVIDER, PAYMENT_PROVIDER, PUSH_PROVIDER,
  SMS_PROVIDER, STORAGE_PROVIDER,
} from './providers';
import { S3StorageProvider } from './s3-storage.provider';
import { TurnstileCaptchaProvider } from './turnstile-captcha.provider';
import { TwilioSmsProvider } from './twilio-sms.provider';
import { WebPushProvider } from './webpush.provider';
import { WhatsAppSmsProvider } from './whatsapp-sms.provider';

/**
 * Choix des implémentations selon la configuration (§11.3).
 *
 * ── PLUS DE REPLI SILENCIEUX ────────────────────────────────────────────────
 *
 * `pick()` rendait la doublure dès que `real` manquait, quelle que soit la valeur
 * demandée : `SMS_PROVIDER=twilio` démarrait sur la doublure, sans un mot, et ne se
 * découvrait qu'à l'absence du premier SMS. Désormais, une valeur autre que
 * `fake` SANS implémentation fait échouer le démarrage, avec le nom de la variable
 * et la valeur. C'est le cas du paiement (`PAYMENT_PROVIDER`, `MOBILE_MONEY_PROVIDER`),
 * dont l'intégration réelle est hors périmètre : choisir `stripe` aujourd'hui doit
 * échouer fort, pas se transformer en paiement fictif.
 */
export function pick(
  token: symbol,
  variable: string,
  mode: string,
  fake: () => unknown,
  real?: Readonly<Record<string, () => unknown>>,
): Provider {
  return {
    provide: token,
    useFactory: (): unknown => {
      if (mode === 'fake') return fake();
      const factory = real?.[mode];
      if (factory === undefined) {
        throw new Error(
          `${variable}=${mode} : aucune implémentation réelle n’existe pour ce fournisseur. ` +
            `Valeurs acceptées ici : fake${real === undefined ? '' : `, ${Object.keys(real).join(', ')}`}.`,
        );
      }
      return factory();
    },
  };
}

const env = loadEnv();

@Global()
@Module({
  providers: [
    pick(SMS_PROVIDER, 'SMS_PROVIDER', env.SMS_PROVIDER, () => new FakeSmsProvider(), {
      twilio: () =>
        new TwilioSmsProvider({
          accountSid: env.TWILIO_ACCOUNT_SID as string,
          authToken: env.TWILIO_AUTH_TOKEN as string,
          from: env.TWILIO_FROM,
          messagingServiceSid: env.TWILIO_MESSAGING_SERVICE_SID,
          baseUrl: env.TWILIO_BASE_URL,
        }),
      testers: () => new TestersSmsProvider(env.OTP_TEST_PHONES ?? []),
      whatsapp: () =>
        new WhatsAppSmsProvider({
          accessToken: env.WHATSAPP_ACCESS_TOKEN as string,
          phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID as string,
          templateName: env.WHATSAPP_TEMPLATE_NAME as string,
          templateLanguage: env.WHATSAPP_TEMPLATE_LANGUAGE,
          otpButton: env.WHATSAPP_OTP_BUTTON,
          apiVersion: env.WHATSAPP_API_VERSION,
          baseUrl: env.WHATSAPP_BASE_URL,
        }),
    }),
    pick(EMAIL_PROVIDER, 'EMAIL_PROVIDER', env.EMAIL_PROVIDER, () => new FakeEmailProvider(), {
      brevo: () =>
        new BrevoEmailProvider({
          apiKey: env.BREVO_API_KEY as string,
          fromAddress: env.EMAIL_FROM_ADDRESS,
          fromName: env.EMAIL_FROM_NAME,
          appName: env.APP_NAME,
          baseUrl: env.BREVO_BASE_URL,
        }),
      mailjet: () =>
        new MailjetEmailProvider({
          apiKey: env.MAILJET_API_KEY as string,
          secretKey: env.MAILJET_SECRET_KEY as string,
          fromAddress: env.EMAIL_FROM_ADDRESS,
          fromName: env.EMAIL_FROM_NAME,
          appName: env.APP_NAME,
          baseUrl: env.MAILJET_BASE_URL,
        }),
    }),
    pick(PUSH_PROVIDER, 'PUSH_PROVIDER', env.PUSH_PROVIDER, () => new FakePushProvider(), {
      webpush: () =>
        new WebPushProvider({
          publicKey: env.VAPID_PUBLIC_KEY as string,
          privateKey: env.VAPID_PRIVATE_KEY as string,
          subject: env.VAPID_SUBJECT,
        }),
    }),
    pick(KYC_PROVIDER, 'KYC_PROVIDER', env.KYC_PROVIDER, () => new FakeKycProvider(), {
      didit: () =>
        new DiditKycProvider({
          apiKey: env.DIDIT_API_KEY as string,
          workflowId: env.DIDIT_WORKFLOW_ID as string,
          baseUrl: env.DIDIT_BASE_URL,
          callbackUrl: `${env.WEB_ORIGIN}/profil`,
        }),
    }),
    // Paiement : HORS PÉRIMÈTRE. Aucune implémentation réelle → toute valeur ≠ fake échoue.
    pick(PAYMENT_PROVIDER, 'PAYMENT_PROVIDER', env.PAYMENT_PROVIDER, () => new FakePaymentProvider()),
    pick(MOBILE_MONEY_PROVIDER, 'MOBILE_MONEY_PROVIDER', env.MOBILE_MONEY_PROVIDER, () => new FakeMobileMoneyProvider()),
    pick(AI_MODERATION_PROVIDER, 'AI_MODERATION_PROVIDER', env.AI_MODERATION_PROVIDER, () => new FakeAiModerationProvider(), {
      anthropic: () =>
        new AnthropicModerationProvider({
          apiKey: env.ANTHROPIC_API_KEY as string,
          model: env.AI_MODERATION_MODEL,
          baseUrl: env.ANTHROPIC_BASE_URL,
        }),
      off: () => new DisabledAiModerationProvider(),
    }),
    pick(CAPTCHA_PROVIDER, 'CAPTCHA_PROVIDER', env.CAPTCHA_PROVIDER, () => new FakeCaptchaProvider(), {
      turnstile: () => new TurnstileCaptchaProvider(env.TURNSTILE_SECRET_KEY as string, { baseUrl: env.TURNSTILE_BASE_URL }),
    }),
    pick(STORAGE_PROVIDER, 'STORAGE_PROVIDER', env.STORAGE_PROVIDER, () => new FakeStorageProvider(), {
      s3: () =>
        new S3StorageProvider({
          endpoint: env.S3_ENDPOINT,
          region: env.S3_REGION,
          bucket: env.S3_BUCKET,
          accessKeyId: env.S3_ACCESS_KEY_ID,
          secretAccessKey: env.S3_SECRET_ACCESS_KEY,
          forcePathStyle: env.S3_FORCE_PATH_STYLE,
        }),
    }),
    pick(ANTIVIRUS_PROVIDER, 'ANTIVIRUS_PROVIDER', env.ANTIVIRUS_PROVIDER, () => new FakeAntivirusProvider(), {
      clamav: () =>
        new ClamAvAntivirusProvider({
          host: env.ANTIVIRUS_HOST,
          port: env.ANTIVIRUS_PORT,
          timeoutMs: env.ANTIVIRUS_TIMEOUT_MS,
        }),
    }),
  ],
  exports: [
    SMS_PROVIDER, EMAIL_PROVIDER, PUSH_PROVIDER, KYC_PROVIDER, PAYMENT_PROVIDER,
    MOBILE_MONEY_PROVIDER, AI_MODERATION_PROVIDER, CAPTCHA_PROVIDER,
    STORAGE_PROVIDER, ANTIVIRUS_PROVIDER,
  ],
})
export class ProvidersModule {}
