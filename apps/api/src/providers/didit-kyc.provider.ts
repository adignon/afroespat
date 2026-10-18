import type { KycProvider, KycStatusValue } from './providers';
import { callProviderJson, type HttpOptions } from './http';

/**
 * Vérification d'identité réelle — Didit (01 §2.3 et §4.3, T4 §8).
 *
 *   · `createSession` → `POST {base}/v2/session/` avec `workflow_id`, l'identifiant du
 *     membre en `vendor_data` et l'adresse de retour ; Didit rend `session_id` et
 *     l'URL hébergée `url` que le membre suit.
 *   · `getStatus` → `GET {base}/v2/session/{id}/decision/`, en complément du webhook
 *     signé (la tâche `kyc.expire` et le support s'en servent quand un webhook se
 *     perd).
 *
 * RÈGLE DURE (§1.2, rappelée dans `KycProvider`) : AUCUNE pièce n'est conservée. La
 * décision Didit porte nom, date de naissance, numéro de document, photos ; on n'en
 * garde que le STATUT et UN booléen, `isAdult`, calculé ici et jeté avec le reste.
 * Ce que ce fichier ne rend pas ne peut fuir nulle part ailleurs.
 */
export interface DiditConfig {
  readonly apiKey: string;
  readonly workflowId: string;
  readonly baseUrl: string;
  /** Où Didit renvoie le membre une fois le parcours fini. */
  readonly callbackUrl: string;
}

/** Les statuts Didit, tels qu'ils sont ÉCRITS par Didit, vers notre énumération. */
const STATUS_MAP: Record<string, KycStatusValue> = {
  'not started': 'NOT_STARTED',
  'in progress': 'IN_PROGRESS',
  approved: 'APPROVED',
  declined: 'DECLINED',
  'in review': 'IN_REVIEW',
  abandoned: 'ABANDONED',
  expired: 'EXPIRED',
  'kyc expired': 'EXPIRED',
};

export function mapDiditStatus(raw: unknown): KycStatusValue | null {
  if (typeof raw !== 'string') return null;
  return STATUS_MAP[raw.trim().toLowerCase()] ?? null;
}

/**
 * La majorité, déduite de la décision — et rien d'autre n'en sort.
 *
 * Didit rend `age` quand il l'a calculé, sinon `date_of_birth` (AAAA-MM-JJ). Sans
 * l'un ni l'autre, `undefined` : on ne DEVINE pas une majorité, et
 * `VerificationLevelService` exige `isAdult === true` pour L1.
 */
export function isAdultFromDecision(decision: unknown, now: Date = new Date()): boolean | undefined {
  if (typeof decision !== 'object' || decision === null) return undefined;
  const d = decision as Record<string, unknown>;
  const idv = (d['id_verification'] ?? d['decision'] ?? d) as Record<string, unknown> | undefined;
  const nested =
    idv !== undefined && typeof idv['id_verification'] === 'object' && idv['id_verification'] !== null
      ? (idv['id_verification'] as Record<string, unknown>)
      : idv;
  if (nested === undefined) return undefined;
  if (typeof nested['age'] === 'number') return nested['age'] >= 18;
  const dob = nested['date_of_birth'];
  if (typeof dob === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dob)) {
    const birth = new Date(`${dob.slice(0, 10)}T00:00:00Z`);
    const eighteen = new Date(birth);
    eighteen.setUTCFullYear(birth.getUTCFullYear() + 18);
    return eighteen.getTime() <= now.getTime();
  }
  return undefined;
}

/**
 * Le corps RÉEL d'un webhook Didit, ramené à la forme interne de
 * `diditWebhookSchema` — `{ sessionId, status, isAdult?, declineReasonCode? }`.
 *
 * Rend `null` quand le corps n'a pas la forme Didit (`session_id` absent) : c'est
 * alors déjà la forme interne — celle de la doublure et des bancs d'essai.
 */
export function normalizeDiditWebhook(body: unknown): Record<string, unknown> | null {
  if (typeof body !== 'object' || body === null) return null;
  const b = body as Record<string, unknown>;
  if (typeof b['session_id'] !== 'string') return null;
  const status = mapDiditStatus(b['status']);
  const isAdult = isAdultFromDecision(b['decision']);
  const out: Record<string, unknown> = { sessionId: b['session_id'], status: status ?? b['status'] };
  if (isAdult !== undefined) out['isAdult'] = isAdult;
  // Un CODE seulement, borné : §2.3 interdit d'en garder davantage.
  const reasons = (b['decision'] as Record<string, unknown> | undefined)?.['warnings'];
  if (status === 'DECLINED' && Array.isArray(reasons) && reasons.length > 0) {
    const first = reasons[0] as Record<string, unknown>;
    if (typeof first['risk'] === 'string') out['declineReasonCode'] = first['risk'].slice(0, 64);
  }
  return out;
}

export class DiditKycProvider implements KycProvider {
  constructor(
    private readonly config: DiditConfig,
    private readonly http: HttpOptions = {},
  ) {}

  private headers(): Record<string, string> {
    return { 'x-api-key': this.config.apiKey, 'Content-Type': 'application/json', Accept: 'application/json' };
  }

  async createSession(userId: string): Promise<{ providerSessionId: string; verificationUrl: string }> {
    const result = await callProviderJson<{ session_id?: string; url?: string }>(
      'didit',
      `${this.config.baseUrl}/v2/session/`,
      {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          workflow_id: this.config.workflowId,
          // L'identifiant interne seulement : ni nom, ni téléphone ne partent chez Didit.
          vendor_data: userId,
          callback: this.config.callbackUrl,
        }),
      },
      this.http,
    );
    if (typeof result.session_id !== 'string' || typeof result.url !== 'string') {
      throw new Error('Didit : réponse de création de session sans `session_id` ni `url`.');
    }
    return { providerSessionId: result.session_id, verificationUrl: result.url };
  }

  async getStatus(providerSessionId: string): Promise<{ status: KycStatusValue; isAdult?: boolean }> {
    const result = await callProviderJson<Record<string, unknown>>(
      'didit',
      `${this.config.baseUrl}/v2/session/${encodeURIComponent(providerSessionId)}/decision/`,
      { method: 'GET', headers: this.headers() },
      this.http,
    );
    const status = mapDiditStatus(result['status']) ?? 'IN_PROGRESS';
    const isAdult = isAdultFromDecision(result);
    return isAdult === undefined ? { status } : { status, isAdult };
  }
}
