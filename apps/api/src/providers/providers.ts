import { randomUUID } from 'node:crypto';

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
    /**
     * ╔═════════════════════════════════════════════════════════════════════╗
     * ║ `Date.now()` NE SUFFIT PAS À IDENTIFIER UNE SESSION                      ║
     * ╚═════════════════════════════════════════════════════════════════════╝
     *
     * `kyc_verifications.provider_session_id` est UNIQUE, et les huit premiers
     * octets d'un UUID v7 sont une horloge : deux membres créés dans la même
     * seconde partagent leur préfixe. Il ne restait donc que la milliseconde pour
     * les distinguer.
     *
     * MESURÉ : deux ouvertures de session dans la même milliseconde — ce qui
     * arrive dès qu'une suite d'e2e monte deux membres en L1 de front — et la
     * seconde échouait sur la contrainte d'unicité. Le journal l'a dit mot pour
     * mot : « Unique constraint failed on the fields: (`provider_session_id`) »,
     * rendu au navigateur en `500 INTERNAL_ERROR`. Vu dans le journal de l'API,
     * avec deux identifiants consécutifs à une milliseconde d'écart.
     *
     * Le vrai fournisseur émet son propre identifiant ; celui-ci doit donc être au
     * moins aussi unique, et `randomUUID` l'est sans horloge partagée.
     */
    const providerSessionId = `fake-kyc-${userId.slice(0, 8)}-${randomUUID()}`;
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
  /**
   * Annulation À LA FIN DE PÉRIODE, et sa réversion (14 §4.3 : « effet en fin de
   * période, réversible jusqu'à la fin »).
   *
   * Distincte de `cancelSubscription`, qui coupe tout de suite : les deux gestes
   * existent chez Stripe et n'ont pas le même effet pour le membre. Confondre les
   * deux ferait perdre à un membre les trois semaines qu'il a payées.
   */
  setCancelAtPeriodEnd(providerRef: string, cancelAtPeriodEnd: boolean): Promise<void>;
  /**
   * Mensuel ↔ annuel, « au prochain renouvellement » (14 §4.3). La PÉRIODE est
   * tenue par le fournisseur, pas par nous : `subscriptions` n'a pas de colonne
   * `period` dans le schéma figé, donc la mémoriser localement créerait une
   * seconde vérité qui divergerait au premier prorata.
   */
  changePeriod(providerRef: string, period: 'MONTH' | 'YEAR'): Promise<void>;
  /** Le portail client du §4.1 — factures, moyen de paiement, résiliation. */
  createPortalUrl(providerRef: string): Promise<string>;
  /** Remboursement (§4.4), traité par SUPPORT. Montant en centimes. */
  refund(providerRef: string, amountCents: number): Promise<{ refundRef: string }>;
}

export const PAYMENT_PROVIDER = Symbol('PaymentProvider');

export class FakePaymentProvider implements PaymentProvider {
  private readonly logger = new Logger('FakePayment');

  createCheckout(input: { userId: string; planCode: string }): Promise<{ providerRef: string; checkoutUrl: string }> {
    const providerRef = fakeRef('fake-pay');
    this.logger.log(`Paiement fictif ${input.planCode} — succès immédiat`);
    return Promise.resolve({ providerRef, checkoutUrl: `/dev/paiement/${providerRef}` });
  }

  cancelSubscription(providerRef: string): Promise<void> {
    this.logger.log(`Annulation fictive ${providerRef}`);
    return Promise.resolve();
  }

  setCancelAtPeriodEnd(providerRef: string, cancelAtPeriodEnd: boolean): Promise<void> {
    this.logger.log(`Annulation fin de période fictive ${providerRef} : ${cancelAtPeriodEnd}`);
    return Promise.resolve();
  }

  changePeriod(providerRef: string, period: 'MONTH' | 'YEAR'): Promise<void> {
    this.logger.log(`Changement de période fictif ${providerRef} → ${period}`);
    return Promise.resolve();
  }

  createPortalUrl(providerRef: string): Promise<string> {
    return Promise.resolve(`/dev/portail/${providerRef}`);
  }

  refund(providerRef: string, amountCents: number): Promise<{ refundRef: string }> {
    this.logger.log(`Remboursement fictif ${providerRef} : ${amountCents}`);
    return Promise.resolve({ refundRef: fakeRef('fake-refund') });
  }
}

/**
 * Une référence de fournisseur fictive, UNIQUE.
 *
 * `Date.now()` seul ne l'est pas : `payments.provider_ref` porte une contrainte
 * d'unicité, et deux paiements créés dans la même milliseconde — ce qui arrive en
 * test bien plus qu'en production — échouaient sur une violation de contrainte
 * sans rapport apparent avec la cause.
 */
function fakeRef(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
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
    const providerRef = fakeRef('fake-momo');
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
  /**
   * Dépose un contenu produit par le SERVEUR.
   *
   * `createUploadUrl` ne peut pas servir ici : elle rend une URL destinée au
   * NAVIGATEUR du membre, pour un fichier qu'il possède déjà. L'archive RGPD
   * (01 §2.8) est l'inverse — elle naît dans le worker, et personne d'autre ne
   * peut la téléverser. C'est la première écriture média côté serveur du projet ;
   * sans cette méthode, le service d'export n'aurait eu d'autre issue que
   * d'écrire hors du fournisseur de stockage, c'est-à-dire hors de la région UE
   * qu'impose la règle dure §8.2.
   */
  put(key: string, body: Buffer, mime: string): Promise<void>;
  /**
   * RELIT les octets déposés, pour que l'API puisse les servir elle-même.
   *
   * ── POURQUOI PAS `createDownloadUrl` ──────────────────────────────────────
   *
   * Elle existe, et elle reste la bonne réponse pour l'archive RGPD : un fichier
   * qu'on télécharge une fois, dont l'adresse expire. Elle ne l'est PAS pour les
   * images du produit, et le dépôt a déjà tranché sans l'écrire ici — neuf
   * endroits dans six modules composent `/media/<clé>` à la main (avatars, images
   * de publication, photos de logement, albums de réseau, fiches pro, membres
   * d'une ville). Une seconde convention d'adresse ferait apprendre au front
   * laquelle s'applique où, et le commentaire de `media.service.ts` dit déjà
   * « une seule convention d'adresse de média, sinon le front en apprend deux ».
   *
   * Rendre `null` plutôt que lever quand la clé est absente : une ligne peut
   * survivre à ses octets (purge de rétention, reprise de tâche), et l'appelant
   * doit pouvoir répondre « disparu » sans distinguer la panne de l'absence.
   */
  get(key: string): Promise<{ body: Buffer; mime: string } | null>;
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

  /**
   * Écrit VRAIMENT sur le disque, sous `STORAGE_FAKE_DIR` (défaut : le répertoire
   * temporaire du système).
   *
   * Un `put` fictif qui se contenterait de journaliser rendrait le service
   * d'export vert en test sans qu'aucun octet n'existe — exactement le genre de
   * doublure qui laisse passer une archive vide jusqu'en production. Ici, le
   * fichier est relisible, donc un test peut affirmer ce qu'il contient.
   */
  async put(key: string, body: Buffer, mime: string): Promise<void> {
    const path = await import('node:path');
    const fs = await import('node:fs/promises');
    const target = await this.pathFor(key);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, body);
    this.logger.log(`Dépôt fictif : ${key} (${body.length} octets, ${mime}) → ${target}`);
  }

  /**
   * SUPPRIME VRAIMENT, pour la même raison que `put` écrit vraiment.
   *
   * Elle se contentait de journaliser, et c'était un trou dans la doublure :
   * `data-export.service.ts` fait de la suppression des octets LA tâche de
   * `export.purge` — « passer la ligne à EXPIRED en laissant le fichier dans le
   * stockage garderait indéfiniment une copie complète des données d'un membre »
   * — et `media.service.ts` retire l'ancien portrait au remplacement. Avec un
   * `delete` muet, les deux étaient verts sans qu'aucun octet ne disparaisse.
   * Mesuré sur `PUT /me/avatar` appelé deux fois : la ligne passait bien à
   * `deleted_at`, et le fichier restait sur le disque.
   *
   * Une clé absente n'est PAS une erreur : la suppression doit être idempotente
   * (un second passage de `export.purge`, une reprise de tâche), et échouer sur
   * « déjà parti » ferait boucler le balayage sur un travail déjà fait.
   */
  async delete(key: string): Promise<void> {
    const fs = await import('node:fs/promises');
    const target = await this.pathFor(key);
    try {
      await fs.unlink(target);
      this.logger.log(`Suppression fictive : ${key} → ${target}`);
    } catch (error) {
      if ((error as { code?: string }).code === 'ENOENT') {
        this.logger.log(`Suppression fictive : ${key} — déjà absent`);
        return;
      }
      throw error;
    }
  }

  /**
   * RELIT ce que `put` a écrit, depuis le même bac.
   *
   * `pathFor` fait seul le travail de sécurité : il résout la clé puis vérifie
   * qu'elle reste sous la racine, donc un « .. » glissé dans l'URL ne peut pas
   * remonter l'arborescence. C'est la MÊME garde que pour l'écriture, et c'est
   * voulu : une doublure qui lirait plus largement qu'elle n'écrit donnerait des
   * tests verts sur un chemin que le vrai fournisseur refusera.
   *
   * `mime` n'est pas relu du disque : le fichier n'en porte pas. L'appelant tient
   * le type réel dans `media_assets.mime`, établi par les OCTETS MAGIQUES à
   * l'import (§8.3) et non par l'extension. Le rendre ici serait une seconde
   * source, moins sûre que la première.
   */
  async get(key: string): Promise<{ body: Buffer; mime: string } | null> {
    const fs = await import('node:fs/promises');
    const target = await this.pathFor(key);
    try {
      return { body: await fs.readFile(target), mime: 'application/octet-stream' };
    } catch (error) {
      if ((error as { code?: string }).code === 'ENOENT') return null;
      throw error;
    }
  }

  /**
   * La clé contient des « / » : on les respecte pour retrouver l'arborescence,
   * et `resolve` + vérification de préfixe interdit qu'un « .. » sorte du bac.
   */
  private async pathFor(key: string): Promise<string> {
    const path = await import('node:path');
    const os = await import('node:os');
    const root = process.env.STORAGE_FAKE_DIR ?? path.join(os.tmpdir(), 'afroespat-dev-storage');
    const target = path.resolve(root, key);
    if (!target.startsWith(path.resolve(root) + path.sep)) {
      throw new Error(`Clé de stockage hors du bac à sable : ${key}`);
    }
    return target;
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
