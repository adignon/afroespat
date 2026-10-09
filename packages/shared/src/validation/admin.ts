import { z } from 'zod';
import {
  AiVerdict,
  AuditActorType,
  ConsentType,
  MediaStatus,
  ModerationActionType,
  ModerationCaseStatus,
  ModerationSource,
  Phase,
  PlanCode,
  PlanInterval,
  ProContactMethod,
  ProTier,
  ProVerificationStatus,
  ReportSubjectType,
  StaffRole,
  UserStatus,
  VerificationLevel,
} from '../enums/generated.js';
import { COMMUNITY_CITY_THRESHOLD_DEFAULT, COMMUNITY_CITY_THRESHOLD_SETTING_KEY } from './communities.js';
import {
  HOUSING_PRICE_BOUNDS_DEFAULT,
  HOUSING_RISK_FLAGS,
  HOUSING_RISK_WEIGHTS,
  type HousingRiskFlag,
} from './housing.js';
import {
  BILLING_YEAR_PRICES_SETTING_KEY,
  PLAN_YEAR_PRICES_DEFAULT,
  yearPricesSchema,
} from './billing.js';
import {
  MODERATION_THRESHOLD_DEFAULTS,
  MODERATION_THRESHOLDS_SETTING_KEY,
  moderationThresholdsSchema,
} from './moderation.js';
import { cursorQuerySchema, pageSchema, uuidSchema } from './pagination.js';

/**
 * Administration et authentification d'équipe — 15-administration.md.
 *
 * SOURCE UNIQUE (00 §4). Ce fichier porte trois choses que rien d'autre ne doit
 * redéfinir :
 *
 *   · les bornes de l'authentification d'équipe (longueur de mot de passe, durée
 *     de session, verrouillage, paramètres TOTP) ;
 *   · le REGISTRE des `system_settings` : chaque clé y a son schéma, sa valeur
 *     par défaut et le rôle qui peut l'écrire. §4.4 exige « tous avec valeur par
 *     défaut dans le code » — le registre EST cette exigence, rendue exécutable ;
 *   · la matrice des rôles du §2.2, sous forme de listes nommées que les
 *     décorateurs de route consomment.
 *
 * Le registre est FERMÉ : une clé absente est refusée à l'écriture. Une table
 * clé → json ouverte laisserait l'équipe poser `moderation.threshold` (au
 * singulier) et croire avoir réglé un seuil que personne ne lit jamais. C'est le
 * genre de faute qu'aucun test ne rattrape et qu'aucun journal ne signale.
 */

// ── Rôles (§2.2) ────────────────────────────────────────────────────────────

export type StaffRoleValue = (typeof StaffRole)[number];

export const staffRoleSchema = z.enum(StaffRole);

/**
 * Les périmètres du tableau du §2.2, nommés une fois.
 *
 * Écrits en LISTES et non en hiérarchie : les quatre rôles ne sont pas
 * ordonnés. `SUPPORT` peut valider une fiche pro, ce que `MODERATOR` ne peut
 * pas ; `MODERATOR` peut suspendre, ce que `SUPPORT` ne peut pas. Toute tentative
 * de les ranger sur un axe « du moins au plus puissant » produit une matrice
 * fausse — et un garde qui laisse passer le mauvais rôle.
 */
export const STAFF_SCOPES = {
  /** Gérer les comptes équipe et rôles ; feature flags ; paramètres de paiement. */
  staffAdmin: ['SUPER_ADMIN'],
  /** Modèles, référentiels, pages, annonces, alertes arnaques, partenaires. */
  content: ['SUPER_ADMIN', 'CONTENT_ADMIN'],
  /** File de modération, masquer, avertir, suspendre. */
  moderation: ['SUPER_ADMIN', 'MODERATOR'],
  /** Lire une fiche membre complète — les quatre rôles. */
  memberRead: ['SUPER_ADMIN', 'CONTENT_ADMIN', 'MODERATOR', 'SUPPORT'],
  /** Export / suppression RGPD, remboursements. */
  rgpd: ['SUPER_ADMIN', 'SUPPORT'],
  /** Valider les fiches pro (justificatif). */
  proReview: ['SUPER_ADMIN', 'CONTENT_ADMIN', 'SUPPORT'],
  /** Tableaux de bord et journal d'audit — les quatre rôles. */
  dashboard: ['SUPER_ADMIN', 'CONTENT_ADMIN', 'MODERATOR', 'SUPPORT'],
  /** Paramètres système. Le registre resserre clé par clé. */
  settings: ['SUPER_ADMIN', 'CONTENT_ADMIN'],
} as const satisfies Record<string, readonly StaffRoleValue[]>;

// ── Authentification d'équipe (§2.1) ────────────────────────────────────────

/** §2.1 : « 12 caractères minimum ». */
export const STAFF_PASSWORD_MIN = 12;
export const STAFF_PASSWORD_MAX = 200;

/** §2.1 : « Sessions de 8 h ». Borne ABSOLUE, indépendante de l'activité. */
export const STAFF_SESSION_HOURS = 8;

/** §2.1 : « déconnexion à 30 min d'inactivité ». */
export const STAFF_IDLE_MINUTES = 30;

/** §2.1 : « 5 échecs → verrouillage 15 minutes ». */
export const STAFF_MAX_FAILED_ATTEMPTS = 5;
export const STAFF_LOCKOUT_MINUTES = 15;

/**
 * Durée de vie du défi rendu par `/auth/login` et consommé par `/auth/totp`.
 *
 * Court volontairement : c'est un demi-jeton, qui atteste le premier facteur. Il
 * n'ouvre aucune route — seul `/auth/totp` et `/auth/totp/confirm` le lisent.
 */
export const STAFF_CHALLENGE_SECONDS = 300;

/** Le cookie de session d'équipe. DISTINCT de `dp_refresh` (règle dure §2.1). */
export const STAFF_SESSION_COOKIE = 'dp_staff';

/** Paramètres TOTP (RFC 6238), valeurs par défaut de toutes les applications d'authentification. */
export const TOTP_STEP_SECONDS = 30;
export const TOTP_DIGITS = 6;
/** Tolérance d'un pas en avant et en arrière : les horloges dérivent. */
export const TOTP_WINDOW_STEPS = 1;
/** 20 octets, la taille recommandée pour HMAC-SHA1. */
export const TOTP_SECRET_BYTES = 20;

/** §8.4 : journal d'audit conservé 5 ans. */
export const AUDIT_RETENTION_YEARS = 5;

/**
 * Mots de passe interdits.
 *
 * §2.1 demande une « vérification contre les listes de mots de passe
 * compromis ». Une vraie vérification exige un service externe (k-anonymat HIBP)
 * ou une liste embarquée de plusieurs mégaoctets : aucun des deux n'est livré, et
 * c'est signalé plutôt que masqué. Cette liste courte n'est PAS un substitut —
 * elle arrête les fautes les plus grossières, rien de plus.
 */
export const STAFF_PASSWORD_DENYLIST: readonly string[] = [
  'motdepasse', 'password', 'password123', 'azertyuiop', 'qwertyuiop',
  'administrateur', 'administrator', 'changeme', 'changerlemotdepasse',
  '123456789012', 'aaaaaaaaaaaa', 'disaporyplus', 'afroexpates',
];

export function staffPasswordIsAllowed(password: string): boolean {
  const normalized = password.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (normalized.length === 0) return false;
  return !STAFF_PASSWORD_DENYLIST.includes(normalized);
}

const staffPasswordSchema = z
  .string()
  .min(STAFF_PASSWORD_MIN)
  .max(STAFF_PASSWORD_MAX)
  .refine(staffPasswordIsAllowed, {
    message: 'Ce mot de passe est trop courant. Choisissez-en un autre.',
  });

/** Le code à six chiffres. Les espaces sont tolérés : les applications en affichent. */
const totpCodeSchema = z
  .string()
  .transform((v) => v.replace(/\s+/g, ''))
  .pipe(z.string().regex(/^\d{6}$/));

export const staffLoginSchema = z
  .object({
    email: z.string().trim().email().max(320),
    password: z.string().min(1).max(STAFF_PASSWORD_MAX),
  })
  .strict();
export type StaffLogin = z.infer<typeof staffLoginSchema>;

export const staffTotpSchema = z
  .object({ challenge: z.string().min(1).max(2000), code: totpCodeSchema })
  .strict();
export type StaffTotp = z.infer<typeof staffTotpSchema>;

export const staffTotpEnrollSchema = z.object({ challenge: z.string().min(1).max(2000) }).strict();
export type StaffTotpEnroll = z.infer<typeof staffTotpEnrollSchema>;

// ── Comptes équipe (§7, CRUD /staff) ────────────────────────────────────────

export const staffCreateSchema = z
  .object({
    email: z.string().trim().email().max(320),
    displayName: z.string().trim().min(2).max(120),
    password: staffPasswordSchema,
    role: staffRoleSchema,
  })
  .strict();
export type StaffCreate = z.infer<typeof staffCreateSchema>;

export const staffUpdateSchema = z
  .object({
    displayName: z.string().trim().min(2).max(120).optional(),
    role: staffRoleSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'Aucune modification demandée.' });
export type StaffUpdate = z.infer<typeof staffUpdateSchema>;

export const staffListQuerySchema = cursorQuerySchema
  .extend({ role: staffRoleSchema.optional(), isActive: z.coerce.boolean().optional() })
  .strict();
export type StaffListQuery = z.infer<typeof staffListQuerySchema>;

// ── Journal d'audit (§2.3, §7) ──────────────────────────────────────────────

export const auditQuerySchema = cursorQuerySchema
  .extend({
    /** L'identifiant du compte équipe, du membre, ou `SYSTEM`. */
    actor: z.union([uuidSchema, z.literal('SYSTEM')]).optional(),
    action: z.string().trim().min(1).max(120).optional(),
    targetType: z.string().trim().min(1).max(120).optional(),
    target: uuidSchema.optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
  })
  .strict()
  .refine((v) => v.from === undefined || v.to === undefined || v.from <= v.to, {
    message: 'La date de début doit précéder la date de fin.',
    path: ['from'],
  });
export type AuditQuery = z.infer<typeof auditQuerySchema>;

/** L'export CSV n'est pas paginé : il prend les mêmes filtres, sans curseur. */
export const AUDIT_EXPORT_MAX_ROWS = 10_000;

// ── Fiches professionnelles (§2.2 « Valider les fiches pro ») ───────────────

export const proReviewQuerySchema = cursorQuerySchema
  .extend({ status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).default('PENDING') })
  .strict();
export type ProReviewQuery = z.infer<typeof proReviewQuerySchema>;

/**
 * Le motif de refus.
 *
 * OBLIGATOIRE et long, comme le motif d'une sanction (13 §4.2) : il est renvoyé
 * au membre, qui doit pouvoir corriger sa fiche. « Non conforme » ne lui apprend
 * rien et transforme le refus en mur.
 */
export const PRO_REJECTION_REASON_MIN = 20;
export const PRO_REJECTION_REASON_MAX = 1000;

export const proApproveSchema = z
  .object({ note: z.string().trim().max(PRO_REJECTION_REASON_MAX).optional() })
  .strict();
export type ProApprove = z.infer<typeof proApproveSchema>;

export const proRejectSchema = z
  .object({
    reason: z.string().trim().min(PRO_REJECTION_REASON_MIN).max(PRO_REJECTION_REASON_MAX),
  })
  .strict();
export type ProReject = z.infer<typeof proRejectSchema>;

// ── Fiche membre (§3) ───────────────────────────────────────────────────────

export const memberSearchQuerySchema = cursorQuerySchema
  .extend({
    /**
     * Handle, nom d'affichage, ou NUMÉRO DE TÉLÉPHONE.
     *
     * §3.1 : « saisie du numéro → HMAC → recherche, le numéro n'est jamais
     * affiché ». La détection se fait sur la forme : un `q` qui commence par `+`
     * et ne contient que des chiffres est traité comme un numéro, et son
     * empreinte seule part en base.
     */
    q: z.string().trim().min(2).max(120),
    /**
     * `z.enum` et NON `z.string()`.
     *
     * Une chaîne libre passée telle quelle à Prisma sur une colonne d'énumération
     * produit un 500, pas un 400 : Postgres refuse la valeur et l'erreur remonte
     * brute. Trouvé en exécutant le test, qui envoyait `ARRIVED` là où l'énumération
     * dit `RECENT_ARRIVAL` — exactement la faute qu'un front commettra.
     */
    phase: z.enum(Phase).optional(),
    status: z.enum(UserStatus).optional(),
  })
  .strict();
export type MemberSearchQuery = z.infer<typeof memberSearchQuerySchema>;

export function looksLikePhone(q: string): boolean {
  return /^\+\d{6,18}$/.test(q.replace(/[\s.-]/g, ''));
}

/** Toute action sur un membre exige un motif tracé (§3.2 « Correction … tracée »). */
export const MEMBER_ACTION_REASON_MIN = 10;
export const MEMBER_ACTION_REASON_MAX = 1000;

const memberActionReason = z
  .string()
  .trim()
  .min(MEMBER_ACTION_REASON_MIN)
  .max(MEMBER_ACTION_REASON_MAX);

export const memberReasonSchema = z.object({ reason: memberActionReason }).strict();
export type MemberReason = z.infer<typeof memberReasonSchema>;

export const memberPhaseSchema = z
  .object({ phase: z.enum(Phase), reason: memberActionReason })
  .strict();
export type MemberPhase = z.infer<typeof memberPhaseSchema>;

export const memberCitySchema = z
  .object({ cityId: uuidSchema.nullable(), reason: memberActionReason })
  .strict();
export type MemberCity = z.infer<typeof memberCitySchema>;

// ── Registre des paramètres système (§4.4) ──────────────────────────────────

/**
 * Une entrée du registre : le schéma de la valeur, sa valeur par défaut, le rôle
 * qui peut l'écrire, et à quoi elle sert.
 *
 * `role` est par CLÉ et non par route : §7 dit « SUPER_ADMIN (certaines clés
 * CONTENT_ADMIN) ». Poser le rôle sur la route obligerait à ouvrir la route au
 * rôle le plus faible, donc à laisser un `CONTENT_ADMIN` écrire les prix.
 */
export interface SettingDefinition {
  readonly schema: z.ZodTypeAny;
  readonly defaultValue: unknown;
  readonly role: readonly StaffRoleValue[];
  readonly description: string;
}

/** Les poids du score de risque logement : un flag → un poids dans [0, 1]. */
const housingRiskWeightsSchema = z
  .object(
    Object.fromEntries(
      HOUSING_RISK_FLAGS.map((flag) => [flag, z.number().min(0).max(1).optional()]),
    ) as Record<HousingRiskFlag, z.ZodOptional<z.ZodNumber>>,
  )
  .strict();

const housingPriceBoundsSchema = z
  .object({ minCents: z.number().int().min(0), maxCents: z.number().int().min(1) })
  .strict()
  .refine((v) => v.maxCents > v.minCents, {
    message: 'La borne haute doit dépasser la borne basse.',
    path: ['maxCents'],
  });

/**
 * Un CIDR IPv4 ou IPv6. Vérifié par forme, jamais interprété ici : c'est le
 * garde qui compare, et il refuse ce qu'il ne sait pas lire.
 */
const cidrSchema = z
  .string()
  .trim()
  .regex(
    /^(?:\d{1,3}(?:\.\d{1,3}){3}\/(?:3[0-2]|[12]?\d)|[0-9a-fA-F:]+\/(?:12[0-8]|1[01]\d|\d{1,2}))$/,
    'CIDR invalide',
  );

export const SETTINGS_REGISTRY = {
  [MODERATION_THRESHOLDS_SETTING_KEY]: {
    schema: moderationThresholdsSchema,
    defaultValue: MODERATION_THRESHOLD_DEFAULTS,
    role: STAFF_SCOPES.settings,
    description: 'Seuils de modération : blocage, mise en file, priorités (13 §4.4).',
  },
  'housing.risk_weights': {
    schema: housingRiskWeightsSchema,
    defaultValue: HOUSING_RISK_WEIGHTS,
    role: STAFF_SCOPES.staffAdmin,
    description: 'Poids de chaque indice dans le score de risque d’une annonce (10 §2.2).',
  },
  'housing.price_bounds': {
    schema: housingPriceBoundsSchema,
    defaultValue: HOUSING_PRICE_BOUNDS_DEFAULT,
    role: STAFF_SCOPES.staffAdmin,
    description: 'Bornes de prix acceptées pour une annonce de logement (10 §2).',
  },
  [COMMUNITY_CITY_THRESHOLD_SETTING_KEY]: {
    schema: z.number().int().min(0).max(100_000),
    defaultValue: COMMUNITY_CITY_THRESHOLD_DEFAULT,
    role: STAFF_SCOPES.staffAdmin,
    description: 'Nombre de membres d’une ville à partir duquel son réseau s’ouvre (07 §2.2).',
  },
  reserved_handles: {
    schema: z.array(z.string().trim().min(1).max(60)).max(2000),
    defaultValue: [],
    role: STAFF_SCOPES.content,
    description: 'Handles réservés en plus de la liste en dur (01 §2.6).',
  },
  /**
   * Les prix ANNUELS, en centimes d'euro, par code de plan.
   *
   * §3 du module 14 : « Prix en `system_settings` pour pouvoir tester des
   * variantes sans déploiement. » Seul l'ANNUEL vit ici : le mensuel est dans
   * `plans.price_cents`, et `plans.code` étant unique, la table ne peut pas
   * porter deux lignes pour un même plan. Voir l'arbitrage écrit dans
   * validation/billing.ts.
   *
   * SUPER_ADMIN, comme le veut §7.2 du module 14 (« GET/PUT /plans — prix et
   * limites (SUPER_ADMIN) ») : un prix est un engagement, pas un contenu.
   */
  [BILLING_YEAR_PRICES_SETTING_KEY]: {
    schema: yearPricesSchema,
    defaultValue: PLAN_YEAR_PRICES_DEFAULT,
    role: STAFF_SCOPES.staffAdmin,
    description: 'Prix annuels en centimes d’euro, par plan (14 §3).',
  },
  admin_allowed_cidrs: {
    schema: z.array(cidrSchema).max(200),
    defaultValue: [],
    role: STAFF_SCOPES.staffAdmin,
    description:
      'Restriction IP FACULTATIVE de l’application admin (§2.1). Liste vide = aucune restriction.',
  },
} as const satisfies Record<string, SettingDefinition>;

export type SettingKey = keyof typeof SETTINGS_REGISTRY;

export const SETTING_KEYS = Object.keys(SETTINGS_REGISTRY) as SettingKey[];

export function isSettingKey(key: string): key is SettingKey {
  return Object.prototype.hasOwnProperty.call(SETTINGS_REGISTRY, key);
}

/** Le corps d'un `PUT /settings/:key`. La valeur est validée par le registre, ensuite. */
export const settingWriteSchema = z
  .object({ value: z.unknown(), reason: z.string().trim().max(MEMBER_ACTION_REASON_MAX).optional() })
  .strict();
export type SettingWrite = z.infer<typeof settingWriteSchema>;

// ── Codes d'erreur ──────────────────────────────────────────────────────────

export const ADMIN_ERROR_CODES = {
  /** Identifiants refusés. Volontairement indistinct de « compte inconnu » (T4 §3). */
  STAFF_CREDENTIALS_INVALID: 401,
  /** 5 échecs en 15 minutes (§2.1). */
  STAFF_LOCKED: 423,
  /** Le défi de premier facteur est absent, expiré ou falsifié. */
  STAFF_CHALLENGE_INVALID: 401,
  /** Code TOTP faux, hors fenêtre, ou déjà employé. */
  STAFF_TOTP_INVALID: 401,
  /** TOTP pas encore enrôlé : l'enrôlement est forcé avant toute session (§2.1). */
  STAFF_TOTP_ENROLLMENT_REQUIRED: 403,
  /** Déjà enrôlé : on ne réenrôle pas sans passer par un SUPER_ADMIN. */
  STAFF_TOTP_ALREADY_ENROLLED: 409,
  /** Aucune session d'équipe valide. */
  STAFF_SESSION_REQUIRED: 401,
  /** Le rôle ne couvre pas l'action (§2.2). */
  STAFF_ROLE_REQUIRED: 403,
  /** L'IP n'est pas dans `admin_allowed_cidrs` (§2.1). */
  STAFF_IP_NOT_ALLOWED: 403,
  /**
   * RÈGLE DURE §2.1 : les deux domaines sont hermétiques. Un jeton membre
   * présenté sur une route d'équipe n'est pas « insuffisant », il est HORS SUJET.
   */
  CROSS_DOMAIN_TOKEN: 401,
  /** §2.2 : « ne peut pas retirer son propre rôle ni supprimer son compte s'il est le dernier ». */
  LAST_SUPER_ADMIN: 409,
  SELF_ROLE_CHANGE: 409,
  /** Email déjà pris par un autre compte équipe. */
  STAFF_EMAIL_TAKEN: 409,
  /** Clé absente du registre (§4.4). */
  UNKNOWN_SETTING: 404,
  /** La fiche pro n'est pas en attente de décision. */
  PRO_NOT_PENDING: 409,
  /** Suppression d'un compte équipe : impossible, voir `LAST_SUPER_ADMIN` et le rapport. */
  STAFF_DELETE_UNSUPPORTED: 409,
} as const;

export type AdminErrorCode = keyof typeof ADMIN_ERROR_CODES;

export const ADMIN_ERROR_MESSAGES: Record<AdminErrorCode, string> = {
  STAFF_CREDENTIALS_INVALID: 'Identifiants incorrects.',
  STAFF_LOCKED: 'Compte temporairement verrouillé après plusieurs échecs. Réessayez dans quelques minutes.',
  STAFF_CHALLENGE_INVALID: 'Cette étape de connexion a expiré. Recommencez.',
  STAFF_TOTP_INVALID: 'Code de vérification incorrect.',
  STAFF_TOTP_ENROLLMENT_REQUIRED: 'Vous devez d’abord enrôler votre application d’authentification.',
  STAFF_TOTP_ALREADY_ENROLLED: 'Une application d’authentification est déjà enrôlée sur ce compte.',
  STAFF_SESSION_REQUIRED: 'Session équipe requise.',
  STAFF_ROLE_REQUIRED: 'Votre rôle ne permet pas cette action.',
  STAFF_IP_NOT_ALLOWED: 'Connexion refusée depuis cette adresse.',
  CROSS_DOMAIN_TOKEN: 'Session équipe requise.',
  LAST_SUPER_ADMIN: 'Ce compte est le dernier SUPER_ADMIN actif : il ne peut être ni rétrogradé ni désactivé.',
  SELF_ROLE_CHANGE: 'Vous ne pouvez pas modifier votre propre rôle.',
  STAFF_EMAIL_TAKEN: 'Cette adresse est déjà associée à un compte équipe.',
  UNKNOWN_SETTING: 'Ce paramètre n’existe pas.',
  PRO_NOT_PENDING: 'Cette fiche n’attend pas de décision.',
  STAFF_DELETE_UNSUPPORTED:
    'Un compte équipe qui a déjà agi ne peut pas être supprimé ; désactivez-le.',
};

// ── Actions d'audit produites par ce module ─────────────────────────────────

/**
 * Les noms d'action écrits dans `audit_logs`, rassemblés ici pour que le filtre
 * de la page « Journal d'audit » et les écritures ne puissent pas diverger.
 */
export const AUDIT_ACTIONS = {
  staffLoggedIn: 'staff.logged_in',
  staffLoginFailed: 'staff.login_failed',
  staffLocked: 'staff.locked',
  staffLoggedOut: 'staff.logged_out',
  staffTotpEnrolled: 'staff.totp_enrolled',
  staffCreated: 'staff.created',
  staffUpdated: 'staff.updated',
  settingChanged: 'setting.changed',
  proApproved: 'pro.approved',
  proRejected: 'pro.rejected',
  userSessionsRevoked: 'user.sessions_revoked',
  userDeactivated: 'user.deactivated',
  userReactivated: 'user.reactivated',
  /**
   * La LEVÉE d'un bannissement — distincte d'une réactivation, et à dessein.
   *
   * Réactiver rend l'accès à un compte désactivé ; lever un bannissement annule une
   * décision de modération ET retire le numéro de la liste noire. Les confondre dans
   * le journal rendrait impossible de répondre à « qui a débanni ce membre, et
   * quand », qui est exactement la question qu'on posera.
   */
  userUnbanned: 'user.unbanned',
  userPhaseForced: 'user.phase_forced',
  userCityForced: 'user.city_forced',
  /** §3.2 : « Rétrograder le niveau » — marque le KYC `DECLINED` avec motif. */
  userKycDowngraded: 'user.kyc_downgraded',
  /**
   * 11 §4 : « Admin : `/v1/admin/search/reindex` (type) ».
   *
   * UNE RECONSTRUCTION D'INDEX EST UNE ÉCRITURE, et elle se trace comme les
   * autres. Elle réécrit `search_documents` ET en RETIRE les lignes dont la source
   * n'est plus éligible : c'est une opération qui peut faire disparaître du contenu
   * de la recherche du produit entier. « Qui a reconstruit l'index, quand, et sur
   * quels types » est exactement la question qu'on posera le jour où la recherche
   * ne rend plus rien.
   */
  searchReindexed: 'search.reindexed',
} as const;

/**
 * Les actions d'audit écrites par le SYSTÈME, hors application admin — 00 §8.5
 * (« alimentée par tout service admin ET par les actions système sensibles »).
 *
 * Elles vivent ici, avec les autres, parce que la page « Journal d'audit » les
 * filtre au même endroit : une suppression de compte exécutée par une tâche doit se
 * retrouver dans le même écran qu'une suppression décidée par l'équipe.
 */
export const SYSTEM_AUDIT_ACTIONS = {
  /** 01 §8 : la tâche `account.deletion_execute` a anonymisé un compte. */
  accountDeletionExecuted: 'account.deletion_executed',
  /** 01 §8 : `account.deactivated_purge`, après six mois de désactivation. */
  accountDeactivatedPurged: 'account.deactivated_purged',
  /** 01 §2.8 : le membre a demandé la suppression de son compte. */
  accountDeletionRequested: 'account.deletion_requested',
  /** 01 §2.8 : le membre a désactivé son compte lui-même. */
  accountDeactivatedBySelf: 'account.deactivated_by_self',
  /**
   * Le PREMIER compte d'équipe, créé par l'amorçage hors ligne.
   *
   * DISTINCTE de `staff.created` (§2.2, création en back-office), et il faut
   * qu'elle le reste : « ce `SUPER_ADMIN` est-il né d'un amorçage ou d'une
   * création par un pair ? » est exactement la question qu'un audit de sécurité
   * posera, et les confondre la rendrait sans réponse. L'acteur est `SYSTEM`
   * parce qu'`audit_logs.actor_id` veut l'UUID d'un compte d'équipe et qu'il n'en
   * existait aucun — c'est tout l'objet de l'amorçage.
   *
   * Voir `apps/api/src/modules/admin/staff-bootstrap.ts`.
   */
  staffBootstrapped: 'staff.bootstrapped',
} as const;

/**
 * Le type de cible employé pour un `system_settings`.
 *
 * `audit_logs.target_id` est de type `Uuid` : la clé d'un réglage, qui est une
 * CHAÎNE, ne peut pas y entrer — Postgres refuse l'écriture. Elle passe donc en
 * métadonnées, sous `key`. Limite du schéma figé, contournée sans migration.
 */
export const AUDIT_SETTING_TARGET_TYPE = 'system_setting';

// ── Schémas de RÉPONSE des routes d'équipe (§5.1, §5.3) ────────────────────
//
// Ils vivent ICI, et non dans le front, parce que §4 fait de `packages/shared` la
// source unique : un schéma de réponse recopié côté client est une deuxième
// définition, qui divergera le jour où la route gagne un champ.
//
// Ils sont RELEVÉS SUR L'API QUI TOURNE, avec une vraie session d'équipe (mot de
// passe argon2id puis TOTP), et non déduits des services. C'est la seule façon
// honnête ici : AUCUN handler des six contrôleurs d'équipe ne déclare de DTO de
// réponse ni de type de retour explicite — tout est inféré de l'appel au service.
// Lire le service aurait donné sa forme interne, pas celle du JSON.

/**
 * Un point de mesure, tel que `AnalyticsService.latest` et `impact` le rendent.
 *
 * C'est la brique commune de `GET /admin/dashboard`, `/admin/impact`,
 * `/admin/stats/*` — relevée identique sur les quatre.
 *
 * `dimension` est une CHAÎNE VIDE quand la mesure n'est pas ventilée, et porte
 * sinon la clé de ventilation : un statut (`ACTIVE`), une phase, ou un UUID de
 * ville ou de pays. Elle n'est donc pas `nullable` mais bien `''` — mesuré, et la
 * nuance compte : un `?? 'tous'` sur `null` n'aurait jamais déclenché.
 *
 * `.strict()` : une colonne ajoutée à ce point doit ARRÊTER l'écran, pas
 * disparaître en silence. C'est la leçon de `isPilot`, qui était servi et affiché
 * par personne.
 */
export const metricPointSchema = z
  .object({
    metric: z.string().min(1),
    dimension: z.string(),
    value: z.number(),
    periodStart: z.string().datetime(),
  })
  .strict();
export type MetricPoint = z.infer<typeof metricPointSchema>;

/**
 * `GET /v1/admin/impact` — le rapport d'impact (§5.3).
 *
 * `{ trimestre, items }`, relevé : `trimestre` vaut « 2026-T3 » (année, tiret,
 * `T` + numéro) et c'est le SERVEUR qui le décide. L'écran ne le déduit jamais de
 * l'horloge du navigateur : un rapport trimestriel daté par la machine du lecteur
 * changerait de titre selon qui l'ouvre.
 *
 * CE QUE CETTE ROUTE NE REND PAS, et qui manque à l'écran D16 : aucun témoignage.
 * `guides.quotable` et `city_tips.quotable` n'existent pas au schéma, donc rien
 * ici ne dit qu'un membre a donné son accord pour être cité. L'absence est le
 * comportement correct — voir la déclaration d'écran de D16.
 */
export const adminImpactResponseSchema = z
  .object({
    /** « 2026-T3 ». Décidé par le serveur, jamais par le client. */
    trimestre: z.string().min(1),
    items: z.array(metricPointSchema),
  })
  .strict();
export type AdminImpactResponse = z.infer<typeof adminImpactResponseSchema>;

/**
 * Les mesures du rapport d'impact que D16 affiche, nommées une fois.
 *
 * Les noms sont ceux que l'API RENVOIE, relevés sur elle. Les écrire ici plutôt
 * qu'en chaînes dans le front leur donne un seul endroit où ils peuvent être faux
 * — et un nom de mesure mal orthographié est exactement le genre de défaut
 * silencieux que ce projet a déjà payé : la recherche ne trouve rien, la valeur
 * reste à zéro, et l'écran affiche « 0 » sans que rien ne le signale.
 *
 * C'est aussi pourquoi le front REFUSE une mesure absente au lieu d'écrire zéro :
 * voir `chargerD16`.
 */
export const IMPACT_METRICS = {
  membresAccompagnes: 'impact.members_accompanied',
  parcoursAboutis: 'impact.journeys_completed',
  presences: 'impact.event_attendances',
  entraidesResolues: 'impact.help_resolved',
  parrainagesAboutis: 'impact.mentorships_completed',
  /** Ventilée par UUID de pays d'origine — le graphique de la 2e planche. */
  membresParPaysOrigine: 'impact.members_by_origin_country',
  membresParVille: 'impact.members_by_city',
  guidesPublies: 'impact.guides_published',
} as const;

// ── Schémas de réponse, suite : D02, D03, D04, D05, D10, D14, D15 ───────────
//
// Même règle que ci-dessus, et elle vaut d'être répétée parce que c'est la seule
// défense qui reste ici : AUCUN handler des six contrôleurs d'équipe ne déclare
// de DTO de réponse ni de type de retour. Chaque schéma ci-dessous a donc été
// RELEVÉ sur l'API qui tourne, avec une vraie session d'équipe, et non déduit du
// service — lire le service aurait donné sa forme INTERNE, pas celle du JSON.
//
// `.strict()` partout où un champ greffé serait une fuite, et c'est l'essentiel
// de ce module : ces routes portent des données de membres. Sans `.strict()`, zod
// dépouille EN SILENCE — c'est le mécanisme par lequel `isPilot` a pu être servi
// et ignoré pendant des semaines, et, bien plus grave ici, celui par lequel un
// `phoneEncrypted` greffé sur la fiche membre arriverait dans le navigateur sans
// que rien ne l'annonce. Un champ inconnu ARRÊTE l'écran, et c'est voulu.

/**
 * `GET /v1/admin/dashboard` — les blocs d'indicateurs (§5.1).
 *
 * RELEVÉ : `{ blocks: { <nom>: MetricPoint[] } }`, onze blocs nommés —
 * `membres`, `indicateur_cle`, `parcours`, `entraide`, `guides`, `parrainage`,
 * `evenements`, `reseaux`, `services`, `moderation`, `revenus`.
 *
 * ─── CE QUE CETTE ROUTE NE REND PAS, ET QU'IL NE FAUT PAS LUI DEMANDER ─────
 *
 * ELLE NE REND AUCUNE ALERTE. Le bandeau « ALERTES » de la planche D02 — « SLA
 * dépassé · 3 dossiers de modération », « Justificatifs pro · 5 en attente »,
 * « Villes à activer · Nantes, Rennes » — n'a AUCUNE contrepartie ici : les blocs
 * ne contiennent que des points de mesure, et aucun `metric` relevé ne s'en
 * approche. Les trois morceaux vivraient dans trois routes différentes
 * (`/moderation/stats`, `/pro-profiles`, `/ref/cities`) ; les recoller côté écran
 * fabriquerait un bandeau d'alertes que l'API ne sert pas, et dont personne ne
 * pourrait dire s'il est complet. Il reste DESSINÉ, et c'est remonté au porteur :
 * entier ou rien.
 *
 * `blocks.revenus` est RELEVÉ VIDE (`[]`), et ce n'est pas un défaut de ce
 * schéma : le MRR n'est pas posé, ni la répartition Mobile Money/carte, ni
 * l'affiliation. « Un MRR faux est pire qu'un MRR absent » — le bloc REVENUS de
 * D02 reste donc celui de la maquette.
 *
 * `z.record` et non une liste fermée de onze clés : le serveur décide des blocs,
 * et un douzième ne doit pas arrêter le tableau de bord. L'écran, lui, REFUSE un
 * bloc qu'il ATTEND et qui manque — c'est `bloc()` dans `appels.ts`, et c'est là
 * que la distinction est juste : ici on valide la forme, là-bas on exige le
 * contenu dont l'écran dépend.
 */
export const adminDashboardResponseSchema = z
  .object({ blocks: z.record(z.array(metricPointSchema)) })
  .strict();
export type AdminDashboardResponse = z.infer<typeof adminDashboardResponseSchema>;

/**
 * Les mesures du tableau de bord que D02 affiche, nommées une fois.
 *
 * Mêmes raisons qu'`IMPACT_METRICS` : un nom de mesure mal orthographié ne lève
 * rien, ne trouve rien, et laisse à l'écran un « 0 » parfaitement crédible.
 *
 * Les mesures VENTILÉES portent ici le nom de la mesure seule ; la clé de
 * ventilation est passée à l'appel. `journeys.by_status` relevée avec la seule
 * dimension `ACTIVE` est le cas NORMAL : une dimension absente veut dire « aucune
 * ligne dans ce seau », donc zéro — tandis qu'une MESURE absente est un désaccord
 * de contrat. Les deux ne se confondent pas, et `appels.ts` les traite
 * séparément, pour la raison que `chargerD16` a déjà écrite : zéro est un fait,
 * pas une absence.
 */
/**
 * CINQ DE CES QUINZE NOMS NE SONT LUS PAR AUCUN ÉCRAN, et c'est mesuré, pas
 * supposé : `dossiersParStatut`, `evenementsParStatut`, `evenementsPresences`,
 * `parrainagesParStatut`, `reseauxParStatut`.
 *
 * Ce ne sont pas des restes. Ce sont les mesures des QUATRE CARTES DE D02 QUI
 * RESTENT DESSINÉES — MODÉRATION, ÉVÉNEMENTS, PARRAINAGE, RÉSEAUX — parce qu'il
 * manque à chacune un AUTRE nombre que la route ne sert pas (« SLA respecté »,
 * « Ce mois », « Note », « Intérêt »). La moitié servie est donc nommée ici, et
 * inutilisée là-bas, ce qui est exactement l'état des choses.
 *
 * Le fait a été VÉRIFIÉ par une mutation témoin : casser `dossiersParStatut`
 * laisse les onze tests de D02 verts, ce qui prouve que la carte MODÉRATION n'est
 * pas branchée — et le jour où elle le sera, le témoin cessera d'être vert.
 */
export const DASHBOARD_METRICS = {
  membresInscrits: 'members.registered',
  membresActifs30j: 'members.active_30d',
  membresParNiveau: 'members.by_level',
  parcoursParStatut: 'journeys.by_status',
  entraideParStatut: 'help.by_status',
  entraideDelaiMedianMinutes: 'help.first_response_median_minutes',
  guidesParStatut: 'guides.by_status',
  parrainagesParStatut: 'mentorships.by_status',
  evenementsParStatut: 'events.by_status',
  evenementsPresences: 'events.checked_in',
  reseauxParStatut: 'communities.by_status',
  logementsParStatut: 'housing.by_status',
  emploisParStatut: 'jobs.by_status',
  prosParVerification: 'pros.by_verification',
  dossiersParStatut: 'moderation.cases_by_status',
} as const;

/** Les noms de blocs de `GET /admin/dashboard` que D02 lit, relevés sur la route. */
export const DASHBOARD_BLOCKS = {
  membres: 'membres',
  parcours: 'parcours',
  entraide: 'entraide',
  guides: 'guides',
  parrainage: 'parrainage',
  evenements: 'evenements',
  reseaux: 'reseaux',
  services: 'services',
  moderation: 'moderation',
} as const;

/**
 * `GET /v1/admin/moderation/stats` — les compteurs de la file (13 §4.4).
 *
 * RELEVÉ : `openByPriority` est un objet dont les clés sont les priorités « 1 » à
 * « 5 » EN CHAÎNES — c'est du JSON — d'où `z.record` et non cinq champs nommés.
 *
 * `slaComplianceRate` est une PROPORTION dans [0,1], pas un pourcentage : relevée
 * à `1`. La borne `.max(1)` n'est pas décorative, elle fige la convention : le
 * jour où le serveur se mettrait à rendre `93`, l'écran s'arrête au lieu
 * d'afficher « 9 300 % ».
 *
 * ─── DEUX CHAMPS NULLABLES QUE L'ÉCHANTILLON NE MONTRAIT PAS ──────────────
 *
 * `slaComplianceRate` et `averageResolutionMs` sont RENDUS `null` quand aucun
 * dossier n'est encore résolu — `resolved.length === 0 ? null : …` dans
 * `ModerationService.stats`. La charge relevée sur la base de développement les
 * portait tous deux non nuls, et un schéma écrit sur ce seul échantillon les
 * aurait déclarés requis : l'écran se serait alors cassé le premier jour, sur une
 * file neuve, c'est-à-dire exactement quand personne ne regarde.
 *
 * La nullabilité se lit donc dans le CODE QUI LA PRODUIT et jamais dans
 * l'échantillon — même règle que `region` sur `adminCitySchema`, déclarée
 * nullable alors que les vingt villes relevées en portaient une.
 *
 * ─── ET `slaComplianceRate` EST UN ÉCHANTILLON, PAS UN TAUX ───────────────
 *
 * Il est calculé sur les 500 DERNIERS dossiers résolus (`take: 500`), et
 * `resolvedSampleSize` est là pour le dire. Ce n'est donc pas « le taux de
 * respect du SLA » : c'est celui d'un échantillon récent, et il ne porte que sur
 * des dossiers RÉSOLUS. Relevé `slaComplianceRate: 1` en même temps
 * qu'`overdueCount: 1723` — cent pour cent de respect et mille sept cent
 * vingt-trois dossiers hors délai, qui ne se contredisent qu'en apparence : les
 * seconds sont OUVERTS, donc hors de l'échantillon.
 *
 * Afficher ce nombre comme le « SLA respecté · 93 % » de la maquette dirait au
 * lecteur quelque chose de faux. C'est une des raisons pour lesquelles la carte
 * MODÉRATION de D02 n'est pas liée, et la seconde est de rôle (§2.2).
 */
export const adminModerationStatsResponseSchema = z
  .object({
    /**
     * La FILE, par priorité — statut `OPEN` **ou** `IN_REVIEW`.
     *
     * Mesuré : la somme vaut 1847 là où `moderation.cases_by_status/OPEN` du
     * tableau de bord vaut 1811. Les deux nombres sont justes et ne comptent pas
     * la même chose — 36 dossiers sont en cours d'examen. C'est celui-ci que
     * l'écran de file affiche, parce que c'est ce qu'il y a dans la file.
     */
    openByPriority: z.record(z.number().int().nonnegative()),
    overdueCount: z.number().int().nonnegative(),
    /** Proportion dans [0,1] sur un échantillon — nulle si rien n'est résolu. */
    slaComplianceRate: z.number().min(0).max(1).nullable(),
    /** Nul si rien n'est résolu. */
    averageResolutionMs: z.number().nonnegative().nullable(),
    resolvedSampleSize: z.number().int().nonnegative(),
  })
  .strict();
export type AdminModerationStatsResponse = z.infer<typeof adminModerationStatsResponseSchema>;

/** L'indicateur de délai, tel que la route le rend — calculé par le SERVEUR (§9). */
export const slaStateSchema = z.enum(['OK', 'WARNING', 'OVERDUE']);

/**
 * Une ligne de la file de modération — `GET /v1/admin/moderation/cases` (13 §4.1).
 *
 * ─── CE QUE CETTE ROUTE NE REND PAS, ET QUE D04 DESSINE ────────────────────
 *
 * ELLE NE REND AUCUN NOM D'AUTEUR. La planche D04 dessine une colonne
 * « AUTEUR » — « Joël K. », « Paul A. », « M. Traoré », « Anonyme » — et la charge
 * relevée ne porte que `subjectId` et `subjectType` : pas de nom, pas de handle,
 * pas même l'identifiant de l'auteur du contenu visé. La colonne reste donc
 * DESSINÉE, et c'est le bon choix plutôt qu'un identifiant tronqué dans une case
 * qui annonce un nom.
 *
 * Et il y a plus qu'un manque de champ : résoudre ces noms demanderait un appel
 * par ligne vers `/admin/users/:id`, c'est-à-dire sortir la fiche de quarante-six
 * membres pour remplir une colonne de liste. Le rôle `MODERATOR` peut lire une
 * fiche membre (§2.2 `memberRead`), mais la lire DOSSIER PAR DOSSIER quand il
 * l'ouvre n'est pas la même chose que de la lire pour tous en vrac — c'est la
 * règle dure « aucune donnée personnelle au-delà de ce que le rôle permet » prise
 * au sérieux du côté de la quantité, pas seulement du droit. Remonté au porteur :
 * s'il veut cette colonne, c'est à la route de la servir.
 *
 * `aiScore` est NULLABLE (relevé `null` sur les dossiers sans passage IA) et vaut
 * sinon une confiance dans [0,1] — « 0,95 », pas « 95 ».
 */
export const adminModerationCaseRowSchema = z
  .object({
    id: z.string().uuid(),
    createdAt: z.string().datetime(),
    subjectType: z.enum(ReportSubjectType),
    subjectId: z.string().uuid(),
    source: z.enum(ModerationSource),
    /** 1 (le plus urgent) à 5, tel que §4.1 trie la file. */
    priority: z.number().int().min(1).max(5),
    status: z.enum(ModerationCaseStatus),
    assignedStaffId: z.string().uuid().nullable(),
    slaDueAt: z.string().datetime(),
    sla: slaStateSchema,
    aiVerdict: z.enum(AiVerdict),
    aiLabels: z.array(z.string()),
    /** Confiance dans [0,1], nulle sans passage IA. Jamais un pourcentage. */
    aiScore: z.number().min(0).max(1).nullable(),
  })
  .strict();
export type AdminModerationCaseRow = z.infer<typeof adminModerationCaseRowSchema>;

export const adminModerationCasesResponseSchema = pageSchema(adminModerationCaseRowSchema);
export type AdminModerationCasesResponse = z.infer<typeof adminModerationCasesResponseSchema>;

/** Une action portée au dossier (13 §4.2) — tracée, avec son motif. */
export const adminModerationActionSchema = z
  .object({
    id: z.string().uuid(),
    createdAt: z.string().datetime(),
    /** Nul quand l'action est AUTOMATIQUE : « Masquage automatique … (§2.3) ». */
    staffId: z.string().uuid().nullable(),
    action: z.enum(ModerationActionType),
    reason: z.string(),
  })
  .strict();

/**
 * Le dossier complet — `GET /v1/admin/moderation/cases/:id` (13 §4.2).
 *
 * RELEVÉ sur un dossier réel. Les cinq listes jointes (`reports`, `actions`,
 * `sanctions`, `aiChecks`) et les deux objets facultatifs (`authorHistory`,
 * `conversation`) arrivent toujours, vides ou nuls selon le cas.
 *
 * ─── `.passthrough()` SUR LES JOINTURES NON RELEVÉES, ET POURQUOI ──────────
 *
 * `reports`, `sanctions` et `aiChecks` ont été relevés VIDES sur tous les
 * dossiers atteignables : la base de développement n'en porte aucun. Leur forme
 * d'ÉLÉMENT est donc INCONNUE, et écrire un `.strict()` dessus serait inventer un
 * contrat — le premier dossier qui en porterait un arrêterait l'écran sur un
 * champ parfaitement légitime.
 *
 * Ils sont donc déclarés `z.array(z.unknown())` : on valide qu'une liste arrive,
 * et on n'affirme RIEN de ses éléments, parce qu'on ne les a pas vus. L'écran ne
 * lit que leur LONGUEUR — « Signalements · 5 », « 1 avertissement » — ce qui est
 * exactement ce que cette connaissance permet. Le jour où la base en porte, on
 * relève et on resserre ; d'ici là, le schéma dit la vérité sur ce qui a été
 * mesuré.
 *
 * `authorHistory` et `conversation` sont relevés `null` et NULLABLES : la
 * maquette dessine « Conversation jointe (4 messages) » et « Contestation :
 * aucune », qui en dépendent. Leur contenu n'est pas lu pour la même raison.
 */
export const adminModerationCaseDetailSchema = z
  .object({
    id: z.string().uuid(),
    createdAt: z.string().datetime(),
    subjectType: z.enum(ReportSubjectType),
    subjectId: z.string().uuid(),
    /** Nul quand le contenu visé n'a pas d'auteur identifié. */
    subjectAuthorUserId: z.string().uuid().nullable(),
    source: z.enum(ModerationSource),
    priority: z.number().int().min(1).max(5),
    status: z.enum(ModerationCaseStatus),
    assignedStaffId: z.string().uuid().nullable(),
    slaDueAt: z.string().datetime(),
    sla: slaStateSchema,
    resolution: z.string().nullable(),
    resolvedAt: z.string().datetime().nullable(),
    aiVerdict: z.enum(AiVerdict),
    aiLabels: z.array(z.string()),
    aiScore: z.number().min(0).max(1).nullable(),
    /** Relevées VIDES : forme d'élément inconnue, donc non affirmée. */
    reports: z.array(z.unknown()),
    actions: z.array(adminModerationActionSchema),
    sanctions: z.array(z.unknown()),
    aiChecks: z.array(z.unknown()),
    authorHistory: z.unknown().nullable(),
    conversation: z.unknown().nullable(),
  })
  .strict();
export type AdminModerationCaseDetail = z.infer<typeof adminModerationCaseDetailSchema>;

/**
 * Une ligne de la recherche de membres — `GET /v1/admin/users?q=…` (§3.1).
 *
 * ─── CETTE ROUTE EST UNE RECHERCHE, PAS UNE LISTE ─────────────────────────
 *
 * `q` est OBLIGATOIRE et fait deux caractères au minimum
 * (`memberSearchQuerySchema`) : mesuré, un appel sans `q` répond
 * `400 VALIDATION_FAILED` sur le champ `q`. Il n'existe AUCUNE route qui liste
 * les membres. La planche D03 dessine pourtant un tableau de trois membres
 * au-dessus de son champ de recherche, comme s'il était rempli à l'ouverture.
 * Il ne peut pas l'être, et D03 le dit à l'écran plutôt que d'inventer une
 * requête — voir `chargerD03`.
 *
 * AUCUN NUMÉRO DE TÉLÉPHONE ICI, et c'est la règle dure §3.1 tenue par la route
 * elle-même : la recherche par numéro passe par l'EMPREINTE HMAC (`looksLikePhone`
 * détecte la forme, seule l'empreinte part en base) et la réponse n'en rend aucun,
 * ni en clair ni masqué. `.strict()` est ce qui garde ce fait : un `phones` greffé
 * sur cette ligne arrêterait l'écran au lieu d'arriver en silence.
 */
export const adminMemberRowSchema = z
  .object({
    id: z.string().uuid(),
    createdAt: z.string().datetime(),
    handle: z.string(),
    displayName: z.string(),
    phase: z.enum(Phase),
    verificationLevel: z.enum(VerificationLevel),
    plan: z.enum(PlanCode),
    status: z.enum(UserStatus),
    lastSeenAt: z.string().datetime().nullable(),
    deletedAt: z.string().datetime().nullable(),
    /** Nulle tant que le membre n'a pas choisi sa ville. */
    city: z.object({ id: z.string().uuid(), name: z.string() }).strict().nullable(),
    originCountry: z
      .object({ id: z.string().uuid(), iso2: z.string().length(2), nameFr: z.string() })
      .strict()
      .nullable(),
  })
  .strict();
export type AdminMemberRow = z.infer<typeof adminMemberRowSchema>;

export const adminMembersResponseSchema = pageSchema(adminMemberRowSchema);
export type AdminMembersResponse = z.infer<typeof adminMembersResponseSchema>;

/**
 * UN NUMÉRO DE MEMBRE TEL QUE L'ADMIN A LE DROIT DE LE VOIR — et pas autrement.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ RÈGLE DURE (15 §3.1) : « l'application admin n'affiche JAMAIS un numéro   │
 * │ de téléphone en clair ».                                                 │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * La route la tient déjà : la charge relevée porte `masked` — « +229 •• •• •• 31 »
 * — et NI `phoneEncrypted`, NI `phoneHmac`, NI `e164`. Ce schéma ne répète pas la
 * règle, il la REND EXÉCUTABLE À LA FRONTIÈRE : `.strict()` fait qu'un champ de
 * numéro ajouté à cette jointure — par une jointure Prisma élargie d'une ligne,
 * ce qui est la façon dont cela arrivera — ARRÊTE l'écran D03 au lieu de traverser
 * zod en silence et d'atterrir dans le navigateur d'un membre de l'équipe.
 *
 * C'est le seul endroit du front où cette règle peut être attrapée : le JSX
 * n'affiche que ce qu'on lui passe, mais la RÉPONSE, elle, aurait déjà traversé le
 * réseau. Un test de mutation le vérifie en greffant `phoneEncrypted` sur la
 * charge et en exigeant que le schéma refuse.
 */
export const adminMemberPhoneSchema = z
  .object({
    id: z.string().uuid(),
    /** La SEULE forme de numéro que cette application connaisse (§3.1). */
    masked: z.string(),
    countryIso2: z.string().length(2),
    isPrimary: z.boolean(),
    isDestination: z.boolean(),
    verifiedAt: z.string().datetime().nullable(),
  })
  .strict();

/** Un consentement versionné (§4.1) — la ligne « CGU v3 · confidentialité v3 ». */
export const adminMemberConsentSchema = z
  .object({
    id: z.string().uuid(),
    type: z.enum(ConsentType),
    version: z.string(),
    granted: z.boolean(),
    createdAt: z.string().datetime(),
  })
  .strict();

/**
 * La fiche membre complète — `GET /v1/admin/users/:id` (§3.1).
 *
 * Mêmes principes que le dossier de modération : ce qui a été relevé est décrit
 * strictement, ce qui a été relevé VIDE n'est pas affirmé. `kycVerifications`,
 * `sanctions`, `dataExports`, `deletionRequests`, `activeSessions` et
 * `moderationCases` sont tous arrivés `[]` sur les fiches atteignables ; l'écran
 * n'en lit que la LONGUEUR (« 1 avertissement », « 2 actives », « 3 dossiers »),
 * donc c'est tout ce que ce schéma promet.
 *
 * `phones`, en revanche, est RELEVÉ NON VIDE et décrit strictement : c'est là que
 * passe la règle dure, et c'est le seul endroit où une description lâche
 * coûterait quelque chose.
 */
export const adminMemberDetailSchema = z
  .object({
    id: z.string().uuid(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    deletedAt: z.string().datetime().nullable(),
    handle: z.string(),
    displayName: z.string(),
    phase: z.enum(Phase),
    verificationLevel: z.enum(VerificationLevel),
    plan: z.enum(PlanCode),
    status: z.enum(UserStatus),
    timezone: z.string(),
    lastSeenAt: z.string().datetime().nullable(),
    deactivatedAt: z.string().datetime().nullable(),
    arrivalDate: z.string().datetime().nullable(),
    onboardingStep: z.number().int(),
    city: z
      .object({ id: z.string().uuid(), name: z.string(), slug: z.string() })
      .strict()
      .nullable(),
    originCountry: z
      .object({ id: z.string().uuid(), iso2: z.string().length(2), nameFr: z.string() })
      .strict()
      .nullable(),
    /** La règle dure §3.1, décrite strictement. Voir `adminMemberPhoneSchema`. */
    phones: z.array(adminMemberPhoneSchema),
    consents: z.array(adminMemberConsentSchema),
    /** Relevés VIDES : seule leur longueur est lue, donc seule elle est promise. */
    kycVerifications: z.array(z.unknown()),
    sanctions: z.array(z.unknown()),
    dataExports: z.array(z.unknown()),
    deletionRequests: z.array(z.unknown()),
    activeSessions: z.array(z.unknown()),
    moderationCases: z.array(z.unknown()),
    stats: z.unknown(),
  })
  .strict();
export type AdminMemberDetail = z.infer<typeof adminMemberDetailSchema>;

/**
 * Une fiche professionnelle en attente de justificatif — `GET /v1/admin/pro-profiles`
 * (10 §4.1), `status=PENDING` par défaut.
 *
 * RELEVÉE sur une fiche réelle (via `status=APPROVED`, la file d'attente étant
 * vide sur la base de développement : c'est la MÊME route et donc la même forme
 * d'élément).
 *
 * `siret` et `description` sont des données d'ENTREPRISE, pas des données
 * personnelles de contact : aucun téléphone, aucune adresse. `contactMethod` dit
 * seulement par quel canal le membre accepte d'être joint — `PHONE_ON_REQUEST`
 * est un CHOIX, pas un numéro, et la route n'en rend aucun.
 */
export const adminProProfileSchema = z
  .object({
    id: z.string().uuid(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    userId: z.string().uuid(),
    member: z
      .object({
        id: z.string().uuid(),
        handle: z.string(),
        displayName: z.string(),
        verificationLevel: z.enum(VerificationLevel),
        status: z.enum(UserStatus),
      })
      .strict(),
    profession: z
      .object({ id: z.string().uuid(), nameFr: z.string() })
      .strict()
      .nullable(),
    businessName: z.string().nullable(),
    description: z.string().nullable(),
    priceHint: z.string().nullable(),
    contactMethod: z.enum(ProContactMethod),
    siret: z.string().nullable(),
    verificationStatus: z.enum(ProVerificationStatus),
    status: z.string(),
    tier: z.enum(ProTier),
    cities: z.array(
      z.object({ id: z.string().uuid(), name: z.string(), slug: z.string() }).strict(),
    ),
    /**
     * LE JUSTIFICATIF, et jamais son contenu.
     *
     * `storageKey` est une CLÉ de stockage, pas une URL signée : elle ne télécharge
     * rien par elle-même. La maquette dessine « Avocate · carte professionnelle »,
     * c'est-à-dire le TYPE du justificatif, pas le document. Nul quand la fiche
     * n'en porte pas encore.
     */
    proof: z
      .object({
        id: z.string().uuid(),
        mime: z.string(),
        sizeBytes: z.number().int().nonnegative(),
        status: z.enum(MediaStatus),
        storageKey: z.string(),
      })
      .strict()
      .nullable(),
  })
  .strict();
export type AdminProProfile = z.infer<typeof adminProProfileSchema>;

export const adminProProfilesResponseSchema = pageSchema(adminProProfileSchema);
export type AdminProProfilesResponse = z.infer<typeof adminProProfilesResponseSchema>;

/**
 * Une ligne du journal d'audit — `GET /v1/admin/audit` (§2.3, §8.4).
 *
 * ─── CETTE ROUTE NE REND PAS LE NOM DE L'ACTEUR ───────────────────────────
 *
 * La planche D15 dessine « R. Adjovi », « N. Mensah », « K. Diop » dans sa
 * colonne ACTEUR. La charge relevée ne porte que `actorId` (un UUID) et
 * `actorType` (`STAFF`, `SYSTEM` ou `MEMBER`). Le nom se résout pour un acteur
 * d'ÉQUIPE — `GET /admin/staff` rend `displayName` — et pas du tout pour un
 * acteur MEMBRE sans un appel par ligne.
 *
 * D15 affiche donc le nom quand l'acteur est de l'équipe et que le compte figure
 * encore dans la liste, et dit ce qu'il est sinon (« Système », « Membre »). Ce
 * n'est pas un repli cosmétique : un journal d'audit qui attribuerait une action
 * au mauvais acteur serait pire qu'un journal qui dit ne pas savoir — et §8.4 le
 * conserve cinq ans.
 *
 * `metadata` est `unknown` et NON décrit : il porte le détail propre à chaque
 * action, dont la forme varie par action, et l'écran ne l'affiche pas.
 */
export const adminAuditEntrySchema = z
  .object({
    id: z.string().uuid(),
    createdAt: z.string().datetime(),
    actorType: z.enum(AuditActorType),
    actorId: z.string(),
    action: z.string(),
    targetType: z.string(),
    targetId: z.string(),
    ip: z.string().nullable(),
    metadata: z.unknown().nullable(),
  })
  .strict();
export type AdminAuditEntry = z.infer<typeof adminAuditEntrySchema>;

export const adminAuditResponseSchema = pageSchema(adminAuditEntrySchema);
export type AdminAuditResponse = z.infer<typeof adminAuditResponseSchema>;

/**
 * Un compte d'équipe — `GET /v1/admin/staff` (§2.2), réservé à `SUPER_ADMIN`.
 *
 * `totpEnrolled` est un BOOLÉEN et le secret n'est jamais rendu : un test
 * d'intégration du module vérifie déjà que la réponse ne contient pas la chaîne
 * « totpSecret ». `.strict()` le tient à la frontière du front pour la même
 * raison — un secret greffé sur cette ligne doit arrêter l'écran.
 *
 * C'est aussi la seule route qui donne un `displayName` d'équipe, et c'est ce qui
 * rend la colonne ACTEUR de D15 possible. Voir `POST /admin/auth/session`, qui
 * n'en rend pas pour le compte CONNECTÉ — manque remonté.
 */
export const adminStaffMemberSchema = z
  .object({
    id: z.string().uuid(),
    createdAt: z.string().datetime(),
    email: z.string(),
    displayName: z.string(),
    role: staffRoleSchema,
    isActive: z.boolean(),
    lastLoginAt: z.string().datetime().nullable(),
    totpEnrolled: z.boolean(),
  })
  .strict();
export type AdminStaffMember = z.infer<typeof adminStaffMemberSchema>;

export const adminStaffResponseSchema = pageSchema(adminStaffMemberSchema);
export type AdminStaffResponse = z.infer<typeof adminStaffResponseSchema>;

/**
 * La session d'équipe courante — `POST /v1/admin/auth/session`.
 *
 * ─── CE QU'ELLE NE REND PAS, ET CE QUE ÇA COÛTE À QUINZE CADRES ───────────
 *
 * RELEVÉ : `{ staffId, role, sessionId }` — et PAS de `displayName`, alors que
 * `POST /admin/auth/totp` en rend un à la connexion. Les quinze planches D02 à
 * D16 dessinent toutes le même avatar « RA » en haut à droite. Après un simple
 * RECHARGEMENT de page, le front n'a plus que cette route, donc plus aucun nom :
 * l'avatar ne peut pas être rempli, et il reste dessiné. Remonté au porteur.
 *
 * Ce qu'elle rend et qui MANQUAIT vraiment, c'est le `role` : le cookie `dp_staff`
 * est `HttpOnly`, le front ne peut pas le lire, et il n'existe aucun équivalent
 * d'`hasAccessToken()` côté équipe. La PRÉSENCE d'une session est déjà couverte
 * par le 401 de chaque écran ; ce qui manquait était le rôle, pour conditionner
 * l'affichage au tableau du §2.2. Il est ici, et il est lu — jamais deviné.
 *
 * `.strict()` : si cette route gagne un jour le `displayName` qui lui manque, on
 * veut l'apprendre par un arrêt net, pas par un champ dépouillé en silence.
 */
export const adminStaffSessionResponseSchema = z
  .object({
    staffId: z.string().uuid(),
    role: staffRoleSchema,
    sessionId: z.string().uuid(),
  })
  .strict();
export type AdminStaffSessionResponse = z.infer<typeof adminStaffSessionResponseSchema>;

/**
 * Un plan tarifaire — `GET /v1/admin/billing/plans` (14 §3).
 *
 * ─── UNE SEULE DEVISE EST RENDUE, ET D14 EN DESSINE DEUX ──────────────────
 *
 * RELEVÉ : `currency` vaut `'EUR'` sur les quatre plans, et il n'y a qu'un
 * `priceCents` et un `yearPriceCents`. La planche D14 dessine un tableau à DEUX
 * colonnes de prix, « EUR » et « XOF » (« 4 € | 2 600 F »). Le montant en francs
 * CFA n'a AUCUNE source dans cette charge.
 *
 * Il n'est pas calculé à partir de l'euro, et c'est volontaire : la parité du
 * franc CFA est fixe, mais l'inscrire dans le front en ferait une deuxième source
 * de vérité pour un PRIX — c'est-à-dire un montant qu'un membre paie. Un prix
 * affiché doit venir de celui qui l'encaisse. La colonne XOF reste donc dessinée
 * et c'est remonté ; `currency` est néanmoins LU et vérifié, pour qu'un plan qui
 * basculerait en XOF n'aille pas s'afficher dans la colonne des euros.
 */
export const adminPlanSchema = z
  .object({
    code: z.enum(PlanCode),
    nameFr: z.string(),
    interval: z.enum(PlanInterval),
    currency: z.enum(['EUR', 'XOF']),
    priceCents: z.number().int().nonnegative(),
    yearPriceCents: z.number().int().nonnegative(),
    isActive: z.boolean(),
    /** Les quotas du plan (14 §2) : lus par les écrans membres, pas par D14. */
    limits: z.unknown(),
  })
  .strict();
export type AdminPlan = z.infer<typeof adminPlanSchema>;

/**
 * `GET /v1/admin/billing/plans` — et son ENVELOPPE N'EST PAS CELLE DU §5.3.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ MESURÉ : cette route rend `{ items }` SANS `nextCursor`. Trois routes de  │
 * │ facturation font de même — `/billing/plans`, `/billing/revenue`,          │
 * │ `/billing/affiliate` — là où les onze autres listes d'équipe rendent bien │
 * │ `{ items, nextCursor }`.                                                 │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Ce n'est donc PAS `pageSchema` : l'employer ici faisait échouer la validation
 * sur `nextCursor — Required`, ce qui est exactement ce que `pageSchema` promet de
 * faire et a raison de faire. Le champ est requis et nullable par décision du
 * §5.3 — « null en fin de liste » — précisément pour qu'une pagination MUETTE ne
 * se confonde pas avec une fin de liste.
 *
 * Pour les plans, l'écart est sans conséquence : la liste est FERMÉE par
 * `PlanCode`, quatre plans, et il n'y a rien à paginer. Le schéma décrit donc ce
 * qui est servi plutôt que ce que la convention promet — décrire une enveloppe
 * qu'on ne reçoit pas ferait échouer l'écran sur une route qui va bien.
 *
 * L'écart est REMONTÉ, et il n'est pas anodin sur les deux autres : `/revenue` et
 * `/affiliate` sont des listes qui, elles, peuvent croître, et un client qui
 * suivrait le curseur n'y trouverait rien à suivre.
 */
export const adminPlansResponseSchema = z
  .object({ items: z.array(adminPlanSchema) })
  .strict();
export type AdminPlansResponse = z.infer<typeof adminPlansResponseSchema>;
