import { z } from 'zod';
import { Phase, StaffRole, UserStatus } from '../enums/generated.js';
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
import { cursorQuerySchema, uuidSchema } from './pagination.js';

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
  userPhaseForced: 'user.phase_forced',
  userCityForced: 'user.city_forced',
} as const;

/**
 * Le type de cible employé pour un `system_settings`.
 *
 * `audit_logs.target_id` est de type `Uuid` : la clé d'un réglage, qui est une
 * CHAÎNE, ne peut pas y entrer — Postgres refuse l'écriture. Elle passe donc en
 * métadonnées, sous `key`. Limite du schéma figé, contournée sans migration.
 */
export const AUDIT_SETTING_TARGET_TYPE = 'system_setting';
