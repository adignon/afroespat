import { Logger } from '@nestjs/common';

/**
 * Fournisseurs externes — 00-fondations.md §11.3.
 *
 * « Chaque fournisseur externe est derrière une interface avec une
 * implémentation FICTIVE en local et en test : SMS fictif (code OTP fixe et
 * journalisé), KYC fictif (page locale pour choisir le résultat), paiement
 * fictif (succès immédiat). »
 *
 * Trois bénéfices, et le troisième est le moins évident :
 *   · la CI est hermétique — aucun appel sortant, aucun coût, aucun quota ;
 *   · le développement ne dépend d'aucun compte à ouvrir ;
 *   · le jour où un fournisseur doit être remplacé — l'agrégateur Mobile Money
 *     n'est même pas encore désigné (décision D4) — un seul fichier change.
 *
 * Les interfaces vivent ici, ensemble, parce qu'elles décrivent la FRONTIÈRE de
 * l'application : tout ce qui la franchit passe par l'une d'elles.
 */

// ── SMS ─────────────────────────────────────────────────────────────────────

export interface SmsProvider {
  /** `to` est au format E.164. Ne journalise JAMAIS le numéro en clair (§8.1). */
  send(to: string, body: string): Promise<{ providerRef: string }>;
}

export const SMS_PROVIDER = Symbol('SmsProvider');

/**
 * SMS fictif : rien n'est envoyé, le message part au journal.
 *
 * Le code, lui, reste ALÉATOIRE — il est tiré par le service d'authentification,
 * pas par ce fournisseur. Un code fixe en développement s'installerait dans les
 * habitudes et finirait par être attendu ailleurs ; `loadEnv` refuse d'ailleurs
 * le démarrage si un fournisseur reste fictif en production.
 *
 * Il conserve les messages envoyés, en mémoire : c'est ce qui permet aux tests
 * de lire le code sans passer par le journal, dont l'écriture est tamponnée et
 * les séquences de couleur difficiles à filtrer.
 */
export class FakeSmsProvider implements SmsProvider {
  private readonly logger = new Logger('FakeSms');
  /** Les CORPS seulement : le numéro n'a pas à être conservé, même ici. */
  private readonly bodies: string[] = [];

  send(to: string, body: string): Promise<{ providerRef: string }> {
    // Seuls les quatre derniers chiffres, même en développement : on n'apprend
    // pas à l'équipe à voir des numéros entiers dans les journaux.
    this.logger.log(`SMS fictif vers …${to.slice(-4)} : ${body}`);
    this.bodies.push(body);
    return Promise.resolve({ providerRef: `fake-sms-${Date.now()}` });
  }

  /** Le code à 6 chiffres du dernier message, ou `null` si aucun n'est parti. */
  lastCodeSent(): string | null {
    const last = this.bodies.at(-1);
    return last?.match(/\b(\d{6})\b/)?.[1] ?? null;
  }

  sentCount(): number {
    return this.bodies.length;
  }
}

// ── Email ───────────────────────────────────────────────────────────────────

export interface EmailProvider {
  send(to: string, template: string, variables: Record<string, unknown>): Promise<{ providerRef: string }>;
}

export const EMAIL_PROVIDER = Symbol('EmailProvider');

export class FakeEmailProvider implements EmailProvider {
  private readonly logger = new Logger('FakeEmail');

  send(to: string, template: string): Promise<{ providerRef: string }> {
    const [user, domain] = to.split('@');
    this.logger.log(`Email fictif « ${template} » vers ${user?.slice(0, 2)}…@${domain}`);
    return Promise.resolve({ providerRef: `fake-email-${Date.now()}` });
  }
}

// ── Push ────────────────────────────────────────────────────────────────────

export interface PushProvider {
  send(
    subscription: { endpoint: string; p256dh: string; auth: string },
    payload: { title: string; body: string; url?: string },
  ): Promise<{ delivered: boolean }>;
}

export const PUSH_PROVIDER = Symbol('PushProvider');

export class FakePushProvider implements PushProvider {
  private readonly logger = new Logger('FakePush');

  send(_s: { endpoint: string }, payload: { title: string }): Promise<{ delivered: boolean }> {
    this.logger.log(`Push fictif : ${payload.title}`);
    return Promise.resolve({ delivered: true });
  }
}

// ── Vérification d'identité ─────────────────────────────────────────────────

export type KycStatusValue =
  | 'NOT_STARTED' | 'IN_PROGRESS' | 'APPROVED' | 'DECLINED' | 'IN_REVIEW' | 'ABANDONED' | 'EXPIRED';

export interface KycProvider {
  /** Crée une session hébergée et renvoie l'URL que suit le membre. */
  createSession(userId: string): Promise<{ providerSessionId: string; verificationUrl: string }>;
  /** Interrogation directe, en complément du webhook signé. */
  getStatus(providerSessionId: string): Promise<{ status: KycStatusValue; isAdult?: boolean }>;
}

export const KYC_PROVIDER = Symbol('KycProvider');

/**
 * KYC fictif. Le vrai (Didit) renvoie son résultat par webhook signé ; ici, une
 * page locale permettra de choisir le résultat (§11.3).
 *
 * RÈGLE DURE (§1.2) : aucune pièce d'identité n'est stockée. Cette interface ne
 * peut même pas en transporter — elle ne renvoie qu'un statut et `isAdult`.
 * C'est volontaire : ce qu'un type ne peut pas exprimer ne peut pas fuir.
 */
export class FakeKycProvider implements KycProvider {
  private readonly logger = new Logger('FakeKyc');
  private readonly sessions = new Map<string, KycStatusValue>();

  createSession(userId: string): Promise<{ providerSessionId: string; verificationUrl: string }> {
    const providerSessionId = `fake-kyc-${userId.slice(0, 8)}-${Date.now()}`;
    this.sessions.set(providerSessionId, 'IN_PROGRESS');
    this.logger.log(`Session KYC fictive : ${providerSessionId}`);
    return Promise.resolve({
      providerSessionId,
      verificationUrl: `/dev/kyc/${providerSessionId}`,
    });
  }

  getStatus(providerSessionId: string): Promise<{ status: KycStatusValue; isAdult?: boolean }> {
    const status = this.sessions.get(providerSessionId) ?? 'NOT_STARTED';
    return Promise.resolve(status === 'APPROVED' ? { status, isAdult: true } : { status });
  }

  /** Réservé au développement : force un résultat depuis la page locale. */
  setStatus(providerSessionId: string, status: KycStatusValue): void {
    this.sessions.set(providerSessionId, status);
  }
}

// ── Paiement carte ──────────────────────────────────────────────────────────

export interface PaymentProvider {
  /**
   * RÈGLE DURE (14 §4.1) : aucune donnée de carte ne transite par le serveur.
   * D'où une URL de paiement hébergée, jamais un numéro de carte en paramètre.
   */
  createCheckout(input: {
    userId: string;
    planCode: string;
    amountCents: number;
    currency: string;
  }): Promise<{ providerRef: string; checkoutUrl: string }>;
  cancelSubscription(providerRef: string): Promise<void>;
}

export const PAYMENT_PROVIDER = Symbol('PaymentProvider');

export class FakePaymentProvider implements PaymentProvider {
  private readonly logger = new Logger('FakePayment');

  createCheckout(input: { userId: string; planCode: string }): Promise<{ providerRef: string; checkoutUrl: string }> {
    const providerRef = `fake-pay-${Date.now()}`;
    this.logger.log(`Paiement fictif ${input.planCode} — succès immédiat`);
    return Promise.resolve({ providerRef, checkoutUrl: `/dev/paiement/${providerRef}` });
  }

  cancelSubscription(providerRef: string): Promise<void> {
    this.logger.log(`Annulation fictive ${providerRef}`);
    return Promise.resolve();
  }
}

// ── Mobile Money ────────────────────────────────────────────────────────────

/**
 * Agrégateur UEMOA — NON DÉSIGNÉ (décision D4 : FedaPay, KKiaPay ou PayDunya).
 *
 * L'interface est volontairement étroite et sans récurrence : les agrégateurs
 * UEMOA n'ont pas d'abonnement récurrent natif, le membre paie par période
 * (décision T4). Une interface qui promettrait `subscribe()` mentirait sur ce
 * que le domaine permet.
 */
export interface MobileMoneyProvider {
  requestPayment(input: {
    userId: string;
    phone: string;
    amountCents: number;
    /** XOF. Parité fixe EUR/XOF à 655,957. */
    currency: 'XOF';
    periodMonths: 1 | 12;
  }): Promise<{ providerRef: string; status: 'PENDING' }>;
  getStatus(providerRef: string): Promise<{ status: 'PENDING' | 'SUCCEEDED' | 'FAILED' }>;
}

export const MOBILE_MONEY_PROVIDER = Symbol('MobileMoneyProvider');

export class FakeMobileMoneyProvider implements MobileMoneyProvider {
  private readonly logger = new Logger('FakeMobileMoney');

  requestPayment(input: { amountCents: number }): Promise<{ providerRef: string; status: 'PENDING' }> {
    const providerRef = `fake-momo-${Date.now()}`;
    this.logger.log(`Mobile Money fictif : ${input.amountCents} (plus petite unité)`);
    return Promise.resolve({ providerRef, status: 'PENDING' });
  }

  getStatus(): Promise<{ status: 'SUCCEEDED' }> {
    return Promise.resolve({ status: 'SUCCEEDED' });
  }
}

// ── Modération IA ───────────────────────────────────────────────────────────

export type ModerationLabel =
  | 'SCAM' | 'MONEY_REQUEST' | 'HARASSMENT' | 'HATE' | 'SEXUAL' | 'SPAM' | 'SELF_HARM' | 'OFF_TOPIC' | 'OK';

export interface AiModerationProvider {
  /**
   * Le texte reçu est DÉJÀ masqué : c'est l'appelant qui passe par
   * `redactForModeration` et `assertRedacted` (règle dure 13 §2).
   */
  classify(redactedText: string): Promise<{ labels: ModerationLabel[]; score: number; model: string; latencyMs: number }>;
}

export const AI_MODERATION_PROVIDER = Symbol('AiModerationProvider');

/**
 * Modération fictive. Applique les mêmes règles LOCALES que le vrai pipeline
 * pour rester utile en développement : un test de bout en bout sur une demande
 * d'argent doit produire un dossier, même sans appeler l'IA.
 */
export class FakeAiModerationProvider implements AiModerationProvider {
  classify(redactedText: string): Promise<{ labels: ModerationLabel[]; score: number; model: string; latencyMs: number }> {
    const lower = redactedText.toLowerCase();
    const labels: ModerationLabel[] = [];

    if (/\b(?:envoie|envoyer|verse|versement|transfert|western union|moneygram)\b/.test(lower)) {
      labels.push('MONEY_REQUEST');
    }
    if (/\b(?:garantie|100\s*%|sans dossier|rapide et sûr|payer d.avance|acompte)\b/.test(lower)) {
      labels.push('SCAM');
    }
    if (labels.length === 0) labels.push('OK');

    const score = labels.includes('OK') ? 0.05 : 0.85;
    return Promise.resolve({ labels, score, model: 'fake-moderation-v1', latencyMs: 1 });
  }
}

// ── Captcha ─────────────────────────────────────────────────────────────────

export interface CaptchaProvider {
  /** Obligatoire avant tout envoi d'OTP (01 §2.1). */
  verify(token: string, ip?: string): Promise<boolean>;
}

export const CAPTCHA_PROVIDER = Symbol('CaptchaProvider');

export class FakeCaptchaProvider implements CaptchaProvider {
  verify(token: string): Promise<boolean> {
    // `fail` permet de tester le chemin d'échec sans dépendre du réseau.
    return Promise.resolve(token !== 'fail');
  }
}

// ── Stockage objet ──────────────────────────────────────────────────────────

export interface StorageProvider {
  /** URL signée pour un import direct : le fichier ne transite pas par l'API. */
  createUploadUrl(key: string, mime: string): Promise<{ url: string; fields?: Record<string, string> }>;
  createDownloadUrl(key: string, expiresInSeconds: number): Promise<string>;
  delete(key: string): Promise<void>;
}

export const STORAGE_PROVIDER = Symbol('StorageProvider');

export class FakeStorageProvider implements StorageProvider {
  private readonly logger = new Logger('FakeStorage');

  createUploadUrl(key: string): Promise<{ url: string }> {
    this.logger.log(`Import fictif : ${key}`);
    return Promise.resolve({ url: `/dev/upload/${encodeURIComponent(key)}` });
  }

  createDownloadUrl(key: string): Promise<string> {
    return Promise.resolve(`/dev/media/${encodeURIComponent(key)}`);
  }

  delete(key: string): Promise<void> {
    this.logger.log(`Suppression fictive : ${key}`);
    return Promise.resolve();
  }
}

// ── Antivirus ───────────────────────────────────────────────────────────────

export interface AntivirusProvider {
  /** Analyse AVANT publication (§8.3). `media_assets.status` en garde la trace. */
  scan(buffer: Buffer): Promise<{ clean: boolean; signature?: string }>;
}

export const ANTIVIRUS_PROVIDER = Symbol('AntivirusProvider');

export class FakeAntivirusProvider implements AntivirusProvider {
  scan(buffer: Buffer): Promise<{ clean: boolean; signature?: string }> {
    // Chaîne de test EICAR : permet de vérifier le chemin « fichier rejeté »
    // sans manipuler de vrai logiciel malveillant.
    const isEicar = buffer.includes('EICAR-STANDARD-ANTIVIRUS-TEST-FILE');
    return Promise.resolve(isEicar ? { clean: false, signature: 'EICAR-Test-File' } : { clean: true });
  }
}
