import { z } from 'zod';
import { KycStatus } from '../enums/generated.js';
import { uuidSchema } from './pagination.js';

/**
 * Vérification d'identité et cycle de vie du compte — 01-identite.md §2.3 à §2.8.
 *
 * SOURCE UNIQUE (00 §4) : ce fichier porte les schémas, les codes d'erreur et les
 * bornes temporelles du KYC, de l'ajout de numéro et de la suppression de compte.
 * Ils sont ici et non dans le service parce que le front doit pouvoir dire « vous
 * pourrez réessayer dans 24 heures » sans appeler l'API pour l'apprendre.
 */

// ── Codes d'erreur (§4.3, §2.5, §2.8) ───────────────────────────────────────

export const ACCOUNT_ERROR_CODES = {
  /** §4.3 : une identité déjà approuvée ne se revérifie pas. */
  KYC_ALREADY_APPROVED: 409,
  /** §2.3 : « délai 24 h » après un refus. */
  KYC_RETRY_TOO_SOON: 429,
  /** §2.3 : « 3 tentatives maximum sur 30 jours ». */
  KYC_MAX_ATTEMPTS: 429,
  /**
   * §2.3 : « `IN_REVIEW` : le membre est informé que la vérification est en
   * cours, sans délai promis. » Une revue humaine chez le fournisseur ne se
   * relance pas en ouvrant une seconde session — la première finira par répondre.
   */
  KYC_IN_REVIEW: 409,
  /**
   * Webhook non signé ou mal signé (T4 §8). `401` et non `403` : le fournisseur
   * n'a pas prouvé qui il est, ce qui n'est pas la même chose qu'un refus.
   */
  WEBHOOK_SIGNATURE_INVALID: 401,
  /** §2.5 : le numéro ajouté doit être celui d'un pays de DESTINATION actif. */
  PHONE_NOT_DESTINATION: 422,
  /** §2.8 : une demande de suppression est déjà en cours. */
  DELETION_ALREADY_PENDING: 409,
  /** §2.8 : rien à annuler. */
  DELETION_NOT_PENDING: 409,
  /** §2.8 : le compte est déjà désactivé. */
  ALREADY_DEACTIVATED: 409,
  /**
   * Le défi OTP présenté n'a pas le `purpose` attendu (§3).
   *
   * `422` et non `400` : le corps est bien formé, c'est la règle métier qui
   * refuse — un code de connexion ne vaut pas confirmation d'une suppression.
   */
  OTP_PURPOSE_MISMATCH: 422,
  /**
   * Compte banni (13 §4.2). Le porteur du numéro a prouvé qu'il est bien le
   * titulaire : lui dire que son compte est banni ne révèle rien qu'il ne sache.
   */
  ACCOUNT_BANNED: 403,
  /**
   * §2.8 : « une demande par 30 jours ». `429` comme les autres plafonds de ce
   * fichier — la demande est légitime, elle est seulement trop rapprochée.
   */
  EXPORT_TOO_SOON: 429,
  /** Aucune archive à remettre : le membre n'en a jamais demandé. */
  EXPORT_NOT_FOUND: 404,
} as const;

export type AccountErrorCode = keyof typeof ACCOUNT_ERROR_CODES;

export const ACCOUNT_ERROR_MESSAGES: Record<AccountErrorCode, string> = {
  KYC_ALREADY_APPROVED: 'Votre identité est déjà vérifiée.',
  KYC_RETRY_TOO_SOON: 'Vous pourrez réessayer dans 24 heures.',
  KYC_MAX_ATTEMPTS: 'Vous avez atteint le nombre d’essais autorisés pour ce mois.',
  KYC_IN_REVIEW: 'Votre vérification est en cours d’examen.',
  WEBHOOK_SIGNATURE_INVALID: 'Signature du webhook invalide.',
  PHONE_NOT_DESTINATION:
    'Ce numéro doit être celui d’un pays de destination pour attester votre présence.',
  DELETION_ALREADY_PENDING: 'Une demande de suppression est déjà en cours.',
  DELETION_NOT_PENDING: 'Aucune demande de suppression n’est en cours.',
  ALREADY_DEACTIVATED: 'Votre compte est déjà désactivé.',
  OTP_PURPOSE_MISMATCH: 'Ce code ne correspond pas à l’action demandée.',
  ACCOUNT_BANNED: 'Ce compte a été fermé définitivement.',
  EXPORT_TOO_SOON: 'Vous avez déjà demandé vos données récemment. Une demande est possible tous les 30 jours.',
  EXPORT_NOT_FOUND: 'Vous n’avez encore demandé aucune archive de vos données.',
};

// ── Bornes temporelles ──────────────────────────────────────────────────────

/**
 * Les délais de §2.3 et §2.8, nommés une fois.
 *
 * En HEURES et en JOURS, jamais en millisecondes : les services les convertissent,
 * et une constante « 86400000 » relue six mois plus tard ne dit plus si elle vaut
 * un jour ou vingt-quatre heures d'un fuseau particulier.
 */
export const ACCOUNT_LIMITS = {
  /** §2.3 : nouvelle tentative possible 24 h après un `DECLINED`. */
  kycRetryDelayHours: 24,
  /** §2.3 : 3 tentatives maximum sur 30 jours. */
  kycMaxAttempts: 3,
  kycAttemptWindowDays: 30,
  /** §8 : `kyc.expire_sessions` — `IN_PROGRESS` → `EXPIRED` après 48 h sans résultat. */
  kycSessionExpiryHours: 48,
  /** §2.8 : sept jours de rétractation avant l'exécution. */
  deletionGraceDays: 7,
  /** §2.8 : un compte désactivé depuis plus de six mois est supprimé. */
  deactivatedPurgeMonths: 6,
  /** §2.2 : `RECENT_ARRIVAL` → `SETTLED` six mois après l'arrivée. */
  settledAfterArrivalMonths: 6,
  /** §8.4 : les défis OTP sont purgés après 24 h. */
  otpRetentionHours: 24,
  /**
   * 00-fondations.md §8.4 : « Sessions expirées : 30 jours. »
   *
   * Appliqué par la tâche transverse `retention.purge` (§9.3), et sur les sessions
   * de MEMBRES : celles de l'équipe partent à l'heure (`staff.session_cleanup`),
   * parce qu'une session d'équipe expirée n'a aucune valeur d'enquête — la trace de
   * la connexion étant dans `audit_logs` pour cinq ans, et plus complète.
   *
   * Trente jours et non zéro : une session expirée porte l'appareil, l'adresse IP et
   * la date de dernier usage. C'est exactement ce qu'un membre regarde quand il
   * signale un accès qu'il ne reconnaît pas, et l'effacer à l'expiration lui
   * retirerait la preuve en même temps que l'accès.
   */
  sessionRetentionDays: 30,
  /**
   * §2.8 : « une demande par 30 jours ».
   *
   * Un QUOTA MÉTIER, et non un `@RateLimit` : la doctrine de
   * `capability.decorator.ts` réserve le décorateur aux fenêtres de la minute et
   * de l'heure, tenues dans Redis. Trente jours tenus dans Redis seraient perdus
   * au premier vidage du cache, et le membre pourrait redemander une archive
   * complète de toutes ses données à volonté — un coût de calcul, mais surtout
   * une surface d'exfiltration. Le quota se compte donc sur `data_exports`, qui
   * est durable.
   */
  exportRequestIntervalDays: 30,
  /** §2.8 : « lien valable 7 jours ». */
  exportLinkValidityDays: 7,
} as const;

// ── Vérification d'identité (§4.3) ──────────────────────────────────────────

/**
 * La charge d'un webhook Didit, RÉDUITE à ce que §2.3 autorise à connaître.
 *
 * NON STRICT, et c'est le point entier : zod DÉPOUILLE les clés inconnues. Le
 * vrai webhook Didit transporte un nom, une date de naissance, un type de
 * document et parfois une image ; `parse` rend un objet qui n'en porte aucune
 * trace, et le service n'a donc physiquement rien d'autre à écrire. Un
 * `.passthrough()` — ou une lecture directe du JSON brut — rendrait la règle dure
 * « aucune donnée d'identité du webhook n'est persistée » dépendante de la
 * vigilance de celui qui écrit l'`update`.
 *
 * `isAdult` est la SEULE donnée dérivée conservée (§2.3).
 */
export const diditWebhookSchema = z.object({
  /** L'identifiant de session du fournisseur : la clé d'idempotence (§4.3). */
  sessionId: z.string().min(1).max(200),
  status: z.enum(KycStatus),
  isAdult: z.boolean().optional(),
  /** Code fournisseur, sans détail : §2.3 interdit d'en conserver davantage. */
  declineReasonCode: z.string().max(64).optional(),
});

export type DiditWebhook = z.infer<typeof diditWebhookSchema>;

/** Ce que `GET /me/kyc` renvoie (§4.3). Jamais autre chose que ces champs. */
export interface KycStatusResponse {
  readonly status: (typeof KycStatus)[number];
  readonly sessionId: string | null;
  readonly decidedAt: string | null;
  readonly expiresAt: string | null;
  /** Motif GÉNÉRIQUE : §6 dit « motif générique + délai de nouvelle tentative ». */
  readonly declineReasonCode: string | null;
  /** Null si aucune nouvelle tentative n'est nécessaire ou possible. */
  readonly retryAvailableAt: string | null;
  /** Tentatives consommées sur la fenêtre de 30 jours (§2.3). */
  readonly attemptsUsed: number;
  readonly attemptsMax: number;
  /** §2.3 : un mineur voit son compte désactivé, et le front doit le dire. */
  readonly isMinor: boolean;
}

/**
 * §15 §3.2 : « Rétrograder le niveau — MODERATOR — marque le KYC `DECLINED` avec
 * motif ; recalcul. » Le motif est OBLIGATOIRE et long : il finit dans
 * `audit_logs`, qui est conservé cinq ans et relu par l'équipe.
 */
export const kycDowngradeSchema = z
  .object({ reason: z.string().trim().min(20).max(500) })
  .strict();

export type KycDowngrade = z.infer<typeof kycDowngradeSchema>;

// ── Ajout et retrait d'un numéro (§2.5) ─────────────────────────────────────

/**
 * `POST /me/phones` : démarre l'ajout. Le captcha est exigé comme pour tout envoi
 * d'OTP (§2.1) — la route est authentifiée, mais le SMS coûte de l'argent et un
 * compte volé sert à en envoyer.
 */
export const addPhoneStartSchema = z
  .object({
    phone: z.string().min(4).max(24),
    countryIso2: z.string().length(2).toUpperCase(),
    captchaToken: z.string().min(1),
  })
  .strict();

export type AddPhoneStart = z.infer<typeof addPhoneStartSchema>;

/** Le code à six chiffres, partagé par les trois confirmations par OTP. */
const otpCode = z.string().regex(/^\d{6}$/, { message: 'Le code comporte 6 chiffres.' });

export const otpConfirmSchema = z
  .object({ challengeId: uuidSchema, code: otpCode })
  .strict();

export type OtpConfirm = z.infer<typeof otpConfirmSchema>;

// ── Suppression de compte (§2.8) ────────────────────────────────────────────

/** Ce que `POST /me/deletion` et `GET /me/deletion` renvoient. */
export interface DeletionStatusResponse {
  readonly requestedAt: string;
  /** `requested_at` + 7 jours. Une connexion OTP avant cette date annule tout. */
  readonly executeAfter: string;
}
