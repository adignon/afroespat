import type { JsonWebKey } from 'node:crypto';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';

/** Ce que la route `/__demo/inbox` rend : tout ce que le démo a « envoyé ». */
export type InboxKind = 'sms' | 'email' | 'push' | 'kyc' | 'scan' | 'moderation' | 'captcha';

export interface InboxEntry {
  readonly id: string;
  readonly kind: InboxKind;
  readonly at: string;
  readonly provider: string;
  /** Destinataire (numéro, adresse, identifiant d'abonnement, session…). */
  readonly to: string;
  readonly subject?: string;
  readonly body: string;
  /** Code à 6 chiffres lu dans le texte (OTP), le cas échéant. */
  readonly code?: string;
  /** Liens http(s) trouvés dans le texte (confirmation, désabonnement…). */
  readonly links: string[];
  readonly meta?: Record<string, unknown>;
}

export interface StoredObject {
  body: Buffer;
  mime: string;
  etag: string;
  lastModified: string;
  encryption?: string;
}

export interface TwilioMessage {
  sid: string;
  to: string;
  from: string | null;
  messagingServiceSid: string | null;
  body: string;
  status: 'queued' | 'sent' | 'delivered' | 'undelivered' | 'failed';
  errorCode: number | null;
  createdAt: string;
}

export interface KycSession {
  id: string;
  number: number;
  vendorData: string | null;
  callback: string | null;
  status: string;
  decision: Record<string, unknown> | null;
  createdAt: string;
  deliveries: { at: string; status: number | null; error?: string }[];
}

export interface PushSubscriptionRecord {
  id: string;
  /** Clé ECDH privée de l'« appareil » (JWK), pour déchiffrer la charge. */
  privateJwk: JsonWebKey;
  p256dh: string;
  auth: string;
  /** Clé VAPID à laquelle l'abonnement est lié (premier envoi, ou imposée à la création). */
  vapidKey: string | null;
  revoked: boolean;
}

export class DemoState {
  inbox: InboxEntry[] = [];
  twilio = new Map<string, TwilioMessage>();
  kyc = new Map<string, KycSession>();
  objects = new Map<string, StoredObject>();
  push = new Map<string, PushSubscriptionRecord>();
  private kycCounter = 0;

  constructor(private readonly file: string | undefined) {
    if (file !== undefined && existsSync(file)) this.load(file);
  }

  record(entry: Omit<InboxEntry, 'id' | 'at' | 'links'> & { links?: string[] }): InboxEntry {
    const full: InboxEntry = {
      id: randomUUID(),
      at: new Date().toISOString(),
      links: entry.links ?? [],
      ...entry,
    };
    this.inbox.push(full);
    if (this.inbox.length > 5000) this.inbox.splice(0, this.inbox.length - 5000);
    this.persist();
    return full;
  }

  nextKycNumber(): number {
    this.kycCounter += 1;
    return this.kycCounter;
  }

  reset(): void {
    this.inbox = [];
    this.twilio.clear();
    this.kyc.clear();
    this.objects.clear();
    this.push.clear();
    this.kycCounter = 0;
    this.persist();
  }

  persist(): void {
    if (this.file === undefined) return;
    const dump = {
      inbox: this.inbox,
      twilio: [...this.twilio.entries()],
      kyc: [...this.kyc.entries()],
      push: [...this.push.entries()],
      kycCounter: this.kycCounter,
      objects: [...this.objects.entries()].map(([k, o]) => [k, { ...o, body: o.body.toString('base64') }]),
    };
    const tmp = `${this.file}.tmp`;
    writeFileSync(tmp, JSON.stringify(dump));
    renameSync(tmp, this.file);
  }

  private load(file: string): void {
    try {
      const raw = JSON.parse(readFileSync(file, 'utf8')) as {
        inbox?: InboxEntry[];
        twilio?: [string, TwilioMessage][];
        kyc?: [string, KycSession][];
        push?: [string, PushSubscriptionRecord][];
        kycCounter?: number;
        objects?: [string, Omit<StoredObject, 'body'> & { body: string }][];
      };
      this.inbox = raw.inbox ?? [];
      this.twilio = new Map(raw.twilio ?? []);
      this.kyc = new Map(raw.kyc ?? []);
      this.push = new Map(raw.push ?? []);
      this.kycCounter = raw.kycCounter ?? 0;
      this.objects = new Map((raw.objects ?? []).map(([k, o]) => [k, { ...o, body: Buffer.from(o.body, 'base64') }]));
    } catch {
      // Fichier illisible : on repart à vide plutôt que de refuser de démarrer.
      this.inbox = [];
    }
  }
}

export function extractCode(text: string): string | undefined {
  return /(?<!\d)(\d{6})(?!\d)/.exec(text)?.[1];
}

export function extractLinks(text: string): string[] {
  return [...new Set(text.match(/https?:\/\/[^\s"'<>)]+/g) ?? [])];
}
