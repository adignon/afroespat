import { Global, Module, type Provider } from '@nestjs/common';
import { loadEnv } from '../config/env';
import {
  AI_MODERATION_PROVIDER, ANTIVIRUS_PROVIDER, CAPTCHA_PROVIDER, EMAIL_PROVIDER,
  FakeAiModerationProvider, FakeAntivirusProvider, FakeCaptchaProvider, FakeEmailProvider,
  FakeKycProvider, FakeMobileMoneyProvider, FakePaymentProvider, FakePushProvider,
  FakeSmsProvider, FakeStorageProvider,
  KYC_PROVIDER, MOBILE_MONEY_PROVIDER, PAYMENT_PROVIDER, PUSH_PROVIDER,
  SMS_PROVIDER, STORAGE_PROVIDER,
} from './providers';

/**
 * Choix des implémentations selon la configuration (§11.3).
 *
 * Aujourd'hui toutes les implémentations réelles manquent : elles arriveront
 * avec les comptes fournisseurs. `loadEnv` refuse déjà le démarrage si un
 * fournisseur reste fictif en production, donc l'oubli est impossible.
 */
function pick<T>(token: symbol, mode: string, fake: () => T, real?: () => T): Provider {
  return {
    provide: token,
    useFactory: (): T => {
      if (mode === 'fake' || real === undefined) return fake();
      return real();
    },
  };
}

const env = loadEnv();

@Global()
@Module({
  providers: [
    pick(SMS_PROVIDER, env.SMS_PROVIDER, () => new FakeSmsProvider()),
    pick(EMAIL_PROVIDER, env.EMAIL_PROVIDER, () => new FakeEmailProvider()),
    pick(PUSH_PROVIDER, env.PUSH_PROVIDER, () => new FakePushProvider()),
    pick(KYC_PROVIDER, env.KYC_PROVIDER, () => new FakeKycProvider()),
    pick(PAYMENT_PROVIDER, env.PAYMENT_PROVIDER, () => new FakePaymentProvider()),
    pick(MOBILE_MONEY_PROVIDER, env.MOBILE_MONEY_PROVIDER, () => new FakeMobileMoneyProvider()),
    pick(AI_MODERATION_PROVIDER, env.AI_MODERATION_PROVIDER, () => new FakeAiModerationProvider()),
    pick(CAPTCHA_PROVIDER, env.CAPTCHA_PROVIDER, () => new FakeCaptchaProvider()),
    pick(STORAGE_PROVIDER, 'fake', () => new FakeStorageProvider()),
    pick(ANTIVIRUS_PROVIDER, 'fake', () => new FakeAntivirusProvider()),
  ],
  exports: [
    SMS_PROVIDER, EMAIL_PROVIDER, PUSH_PROVIDER, KYC_PROVIDER, PAYMENT_PROVIDER,
    MOBILE_MONEY_PROVIDER, AI_MODERATION_PROVIDER, CAPTCHA_PROVIDER,
    STORAGE_PROVIDER, ANTIVIRUS_PROVIDER,
  ],
})
export class ProvidersModule {}
