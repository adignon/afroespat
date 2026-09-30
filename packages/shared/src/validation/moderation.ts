import { z } from 'zod';
import {
  ModerationActionType,
  ModerationCaseStatus,
  ReportReason,
  ReportSubjectType,
  SanctionType,
  ScamAlertSeverity,
} from '../enums/generated.js';
import { cursorQuerySchema, uuidSchema } from './pagination.js';

/**
 * Modération et sécurité — 13-moderation.md.
 *
 * SOURCE UNIQUE (00 §4) : les seuils, les bornes et les règles locales vivent
 * ici, et non dans le service. Deux raisons, et la seconde est celle qui a dicté
 * ce fichier :
 *
 *   · le front affiche « ce texte ne peut pas être publié » sur les mêmes
 *     bornes que celles que l'API applique ;
 *   · les RÈGLES LOCALES du §2.1 étaient recopiées dans `help.service.ts`, en
 *     attendant ce module. Une regex d'anti-arnaque recopiée dans chaque module
 *     de contenu finit par différer d'un module à l'autre, et c'est alors le
 *     module le plus laxiste qui définit la sécurité de la plateforme. Elles
 *     n'existent plus qu'ici.
 */

// ── Règles locales synchrones (§2.1) ────────────────────────────────────────

/**
 * Les règles LOCALES, appliquées sans appeler l'IA, avant publication :
 * coordonnées bancaires, demande de versement adressée à un membre, liens vers
 * des plateformes de paiement. Un résultat positif est un BLOCAGE immédiat
 * (§2.1 : « contenu non publié, code CONTENT_BLOCKED avec motif générique,
 * dossier priorité 1 »).
 *
 * Reprises telles quelles de `help.service.ts`, où elles avaient été écrites
 * « pour être déménagées ». Leur réglage est VOLONTAIREMENT étroit, et ce
 * réglage est le cœur du sujet : « Il faut payer 225 € à la préfecture » est une
 * information juste, utile, et doit passer ; « envoyez-moi 225 € sur mon
 * compte » ne doit pas. La différence n'est pas le montant, c'est le
 * DESTINATAIRE — d'où l'exigence d'un marqueur interpersonnel, et non d'un
 * simple verbe de paiement suivi d'une somme.
 *
 * AUCUN drapeau `g` : une regex globale garde son `lastIndex` entre deux appels
 * et `test()` rend alors faux un coup sur deux sur le même texte. Sur une règle
 * de sécurité, c'est un contenu bloqué sur deux qui passerait.
 */
export const MODERATION_LOCAL_RULES: readonly {
  readonly name: string;
  readonly pattern: RegExp;
}[] = [
  // IBAN : deux lettres de pays, deux chiffres de contrôle, puis des groupes.
  { name: 'IBAN', pattern: /\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}){3,7}[ ]?[A-Z0-9]{0,4}\b/ },
  { name: 'RIB', pattern: /\b(?:rib|iban|bic|swift)\b\s*[:=]?\s*[A-Z0-9]{6,}/i },
  // Numéro de carte : quatre groupes de quatre chiffres.
  { name: 'CARD', pattern: /\b(?:\d{4}[ -]?){3}\d{4}\b/ },
  {
    name: 'PAYMENT_LINK',
    pattern:
      /\b(?:paypal\.me|paypal\.com|lydia\.app|revolut\.me|wise\.com|remitly|westernunion|western union|moneygram|ria money)\b/i,
  },
  {
    // Un verbe de versement dont la cible est LE MEMBRE lui-même.
    name: 'MONEY_REQUEST',
    pattern:
      /\b(?:envoie|envoies|envoyez|envoyer|vers[ée]?|verses|versez|verser|transf[eè]re|transf[eé]rez|d[eé]pose|d[eé]posez|paye|payez|payer|r[eé]gle|r[eé]glez)\b[^.!?]{0,40}\b(?:moi|m['’]|me\s|mon compte|mon num[eé]ro|mon wave|mon momo|ma carte|mon rib|mon iban)/i,
  },
  {
    name: 'MONEY_REQUEST',
    pattern: /\bsur (?:mon|le) (?:compte|num[eé]ro|wave|momo|mobile money|orange money|mtn)\b/i,
  },
];

/**
 * La règle locale déclenchée, ou `null`. Pure et synchrone : c'est l'étape 1 du
 * §2, celle qui doit répondre AVANT que le contenu n'existe.
 *
 * Le nom rendu sert au journal et au dossier, JAMAIS à la réponse envoyée au
 * membre : détailler la règle franchie apprendrait à la contourner à qui cherche
 * justement à la contourner (§2.1, « motif générique »).
 */
export function matchLocalRule(text: string): string | null {
  for (const rule of MODERATION_LOCAL_RULES) {
    if (rule.pattern.test(text)) return rule.name;
  }
  return null;
}

// ── Verdicts de l'IA (§2.3) ─────────────────────────────────────────────────

/** Les étiquettes du prompt de classification (§2.3). */
export const MODERATION_LABELS = [
  'SCAM',
  'MONEY_REQUEST',
  'HARASSMENT',
  'HATE',
  'SEXUAL',
  'SPAM',
  'SELF_HARM',
  'OFF_TOPIC',
  'OK',
] as const;

export type ModerationLabelValue = (typeof MODERATION_LABELS)[number];

/** § 2.3 : `ALLOW` sous 0,3 ; `QUEUE` de 0,3 à 0,8 ; `BLOCK` au-delà. */
export const AI_QUEUE_SCORE = 0.3;
export const AI_BLOCK_SCORE = 0.8;

/**
 * Les seules étiquettes sur lesquelles un score > 0,8 MASQUE le contenu (§2.3).
 *
 * `HARASSMENT` n'en fait pas partie, et ce n'est pas un oubli : §2.3 énumère
 * « SCAM, MONEY_REQUEST, HATE, SEXUAL ». Un harcèlement à score élevé part donc
 * en file humaine, contenu visible — et §3 le confirme en le plaçant en
 * priorité 2, non en priorité 1. `guides.service.ts` bloquait sur `HARASSMENT`
 * et `SELF_HARM` : sa liste provisoire était plus large que la spec.
 */
export const AI_BLOCKING_LABELS: readonly ModerationLabelValue[] = [
  'SCAM',
  'MONEY_REQUEST',
  'HATE',
  'SEXUAL',
];

/**
 * §2, dernier paragraphe : `SELF_HARM` ne bloque JAMAIS. Dossier priorité 1 avec
 * consigne de bienveillance, et un encart vers la page de ressources du
 * module 15. « Aucune autre action automatique. »
 */
export const SELF_HARM_CASE_NOTE =
  'Consigne : bienveillance. Ne pas masquer, ne pas sanctionner. Prendre contact avec prudence.';

/** `static_pages/ressources` (module 15). */
export const SELF_HARM_RESOURCE_PAGE_SLUG = 'ressources';

// ── Priorités et délai de traitement (§3, §4.1) ─────────────────────────────

/** §4.1 : « sla_due_at = created_at + 24 h (priorité 1 : 4 h) ». */
export const MODERATION_SLA_HOURS = 24;
export const MODERATION_SLA_HOURS_PRIORITY_1 = 4;

/** Le délai de traitement d'un dossier, d'après sa seule priorité (§4.1). */
export function slaDueAt(priority: number, from: Date = new Date()): Date {
  const hours = priority === 1 ? MODERATION_SLA_HOURS_PRIORITY_1 : MODERATION_SLA_HOURS;
  return new Date(from.getTime() + hours * 3_600_000);
}

/** §4.1 : « un dossier assigné depuis 2 h sans action revient en file ». */
export const MODERATION_ASSIGNMENT_STALE_MS = 2 * 3_600_000;

/** §12 et §11 : `moderation.purge_reports`, quotidienne, 3 ans. */
export const REPORT_RETENTION_DAYS = 3 * 365;

/**
 * Les surfaces où une arnaque ou une demande d'argent est en priorité 1 (§3) :
 * « logement, parrainage, entraide ».
 *
 * Le parrainage passe par la messagerie privée : c'est `MESSAGE` qui le porte,
 * le schéma n'ayant pas de type de sujet « parrainage ».
 */
export const PRIORITY_1_SCAM_SURFACES: readonly (typeof ReportSubjectType)[number][] = [
  'HOUSING',
  'MESSAGE',
  'HELP_REQUEST',
  'HELP_RESPONSE',
];

/**
 * La priorité initiale d'un signalement, d'après le tableau du §3.
 *
 * Le tableau ne couvre PAS une arnaque signalée hors de ces quatre surfaces —
 * une arnaque dans un guide, par exemple. Elle est rangée en priorité 2 : c'est
 * la ligne la plus proche (« annonce logement à score moyen »), et la reléguer
 * en 4 ou 5 reviendrait à traiter une arnaque comme un contenu déplacé. Le choix
 * est signalé plutôt que caché.
 */
export function reportPriority(
  reason: (typeof ReportReason)[number],
  subjectType: (typeof ReportSubjectType)[number],
): number {
  switch (reason) {
    case 'SCAM':
    case 'MONEY_REQUEST':
      return PRIORITY_1_SCAM_SURFACES.includes(subjectType) ? 1 : 2;
    case 'HARASSMENT':
      return 2;
    case 'SPAM':
      return 3;
    case 'INAPPROPRIATE':
      return 4;
    case 'OTHER':
      return 5;
  }
}

/** Les bornes du tableau du §3 : 1 est le plus urgent, 5 le moins. */
export const MODERATION_PRIORITY_MIN = 1;
export const MODERATION_PRIORITY_MAX = 5;

/** §6 : un modérateur bénévole « signale avec priorité +1 » vers l'équipe. */
export function escalatedPriority(priority: number): number {
  return Math.max(MODERATION_PRIORITY_MIN, priority - 1);
}

// ── Règles automatiques (§4.4) ──────────────────────────────────────────────

/**
 * Les seuils du §4.4. « Seuils dans `system_settings`, modifiables sans
 * déploiement » : ces valeurs sont les DÉFAUTS, lues par
 * `ModerationService.thresholds()` si la clé est absente.
 */
export const MODERATION_THRESHOLD_DEFAULTS = {
  /** Abus de blocage : 20 blocages / 30 jours → dossier priorité 3. */
  blockAbuseCount: 20,
  blockAbuseWindowDays: 30,
  /** Abus de signalement : 10 rejets consécutifs → dossier priorité 3. */
  dismissedStreak: 10,
  /** Nouveau compte à forte activité : 20 publications le premier jour. */
  newAccountBurstCount: 20,
  /** Annonce logement : 0,4–0,7 → priorité 2 ; ≥ 0,7 → priorité 1 + non publiée. */
  housingRiskQueue: 0.4,
  housingRiskBlock: 0.7,
} as const;

export type ModerationThresholds = { -readonly [K in keyof typeof MODERATION_THRESHOLD_DEFAULTS]: number };

/** La clé unique de `system_settings` qui porte les seuils du §4.4. */
export const MODERATION_THRESHOLDS_SETTING_KEY = 'moderation.thresholds';

export const moderationThresholdsSchema = z
  .object({
    blockAbuseCount: z.number().int().min(1).max(1000),
    blockAbuseWindowDays: z.number().int().min(1).max(365),
    dismissedStreak: z.number().int().min(1).max(100),
    newAccountBurstCount: z.number().int().min(1).max(1000),
    housingRiskQueue: z.number().min(0).max(1),
    housingRiskBlock: z.number().min(0).max(1),
  })
  .strict()
  .refine((v) => v.housingRiskBlock >= v.housingRiskQueue, {
    path: ['housingRiskBlock'],
    message: 'Le seuil de blocage doit être au moins égal au seuil de mise en file.',
  });

export type ModerationThresholdsInput = z.infer<typeof moderationThresholdsSchema>;

// ── Sanctions (§4.2, §4.3) ──────────────────────────────────────────────────

/**
 * §4.2 : « Une suspension ou un bannissement exige un motif d'au moins
 * 20 caractères. » La borne est ici, appliquée par le schéma ET revérifiée par
 * le service — une règle dure ne dépend pas du passage par un schéma.
 */
export const SANCTION_REASON_MIN = 20;
/** Motif d'une action ordinaire : court accepté, vide refusé. */
export const ACTION_REASON_MIN = 3;
export const ACTION_REASON_MAX = 2000;

/** §4.2 : « SUSPENSION avec durée (1, 7, 30 jours) ». */
export const SUSPENSION_DAYS = [1, 7, 30] as const;

export type SuspensionDays = (typeof SUSPENSION_DAYS)[number];

/** §4.3 : « contester une fois (formulaire, ≤ 1 000 caractères) ». */
export const APPEAL_TEXT_MAX = 1000;
/** §4.3 : la contestation « rouvre le dossier en priorité 3 ». */
export const APPEAL_CASE_PRIORITY = 3;

/**
 * Les actions qui exigent une sanction, donc un motif long et un compte équipe
 * (§4.2). `BAN_USER` exige en plus `SUPER_ADMIN`.
 */
export const SANCTIONING_ACTIONS: readonly (typeof ModerationActionType)[number][] = [
  'WARN',
  'SUSPEND_USER',
  'BAN_USER',
];

/** §3 : « Motifs : … (+ détails ≤ 500) ». */
export const REPORT_DETAILS_MAX = 500;

// ── Codes d'erreur (§8) ─────────────────────────────────────────────────────

export const MODERATION_ERROR_CODES = {
  /** §8.1 : un signalement par membre et par sujet. */
  ALREADY_REPORTED: 409,
  /** §8.1 : « contester une fois ». */
  ALREADY_APPEALED: 409,
  /** §2.1 : règle locale franchie. Motif générique. */
  CONTENT_BLOCKED: 422,
  /** §4.2 : suspension ou bannissement sans motif suffisant. */
  REASON_TOO_SHORT: 422,
  /** §4.1 : le dossier est déjà pris par quelqu'un d'autre. */
  CASE_ASSIGNED: 409,
  /** §4.3 : la contestation doit être traitée par un AUTRE modérateur. */
  SAME_REVIEWER: 403,
  /** §4.2 : `BAN_USER` est réservé au `SUPER_ADMIN`. */
  BAN_REQUIRES_SUPER_ADMIN: 403,
  /** On ne se signale pas soi-même. */
  SELF_REPORT: 422,
  /** §4.3 : la décision finale n'est plus contestable. */
  CASE_RESOLVED: 409,
  /** §6 : un modérateur bénévole n'a pas ce pouvoir, ou pas sur ce périmètre. */
  OUT_OF_SCOPE: 403,
} as const;

export type ModerationErrorCode = keyof typeof MODERATION_ERROR_CODES;

export const MODERATION_ERROR_MESSAGES: Record<ModerationErrorCode, string> = {
  ALREADY_REPORTED: 'Vous avez déjà signalé ce contenu. Notre équipe l’examine.',
  ALREADY_APPEALED: 'Vous avez déjà contesté cette décision. Elle est définitive.',
  // Motif GÉNÉRIQUE (§2.1) : le détail servirait à contourner la règle.
  CONTENT_BLOCKED: 'Ce texte ne peut pas être publié en l’état.',
  REASON_TOO_SHORT: `Une suspension ou un bannissement exige un motif d’au moins ${SANCTION_REASON_MIN} caractères.`,
  CASE_ASSIGNED: 'Ce dossier est déjà pris en charge par un autre modérateur.',
  SAME_REVIEWER: 'Une contestation doit être examinée par un autre modérateur.',
  BAN_REQUIRES_SUPER_ADMIN: 'Seul un super-administrateur peut bannir un compte.',
  SELF_REPORT: 'Vous ne pouvez pas vous signaler vous-même.',
  CASE_RESOLVED: 'Ce dossier est clos.',
  OUT_OF_SCOPE: 'Cette action dépasse votre périmètre de modération.',
};

/**
 * §3 : « Le signaleur reçoit une confirmation ». Le texte est ici pour que la
 * feuille de signalement et l'API disent la même chose.
 */
export const REPORT_CONFIRMATION =
  'Merci. Notre équipe examine votre signalement ; vous serez informé·e de sa clôture.';

/** §3 : la notification de clôture, « sans détail de la décision ». */
export const REPORT_RESOLVED_NOTICE = 'Merci, nous avons traité votre signalement.';

/** §2.3 et §9 : la mention posée sur le contenu masqué de son auteur. */
export const CONTENT_IN_REVIEW_NOTICE = 'Ce contenu est en vérification.';

// ── Schémas d'écriture (§8.1) ───────────────────────────────────────────────

export const reportSubjectTypeSchema = z.enum(ReportSubjectType);
export const reportReasonSchema = z.enum(ReportReason);

export const createReportSchema = z
  .object({
    subjectType: reportSubjectTypeSchema,
    subjectId: uuidSchema,
    reason: reportReasonSchema,
    details: z.string().trim().min(1).max(REPORT_DETAILS_MAX).optional(),
  })
  .strict();

export type CreateReport = z.infer<typeof createReportSchema>;

export const appealSchema = z
  .object({ text: z.string().trim().min(20).max(APPEAL_TEXT_MAX) })
  .strict();

export type Appeal = z.infer<typeof appealSchema>;

/**
 * `GET /me/sanctions` — mes sanctions et ce que je peux encore en faire (§8.1).
 *
 * DEUX CHAMPS SONT DÉRIVÉS PAR LE SERVEUR, et l'écran K09 ne doit surtout pas les
 * recalculer :
 *
 *   · `active` — vrai tant que la sanction n'est ni levée ni échue. Le comparer à
 *     `endsAt` côté front demanderait de connaître l'heure du serveur, et une
 *     horloge de navigateur décalée afficherait « suspendu » à un membre libre.
 *   · `appealable` — §4.3 : « contester UNE FOIS ». C'est le serveur qui sait si
 *     une contestation a déjà été déposée. L'écran affiche le formulaire quand ce
 *     drapeau est vrai ; il ne le déduit pas, et l'API refuse de toute façon.
 *
 * `rule` est la RÈGLE ENFREINTE du §4.2 — le motif du modérateur, écrit pour être
 * lu par le membre. La planche l'affiche telle quelle (« Règle : Coordonnées
 * personnelles »), et la reformuler côté front serait inventer un texte
 * d'interface que T2 ne donne pas.
 */
export const mySanctionsResponseSchema = z.object({
  items: z.array(
    z.object({
      id: uuidSchema,
      type: z.enum(SanctionType),
      rule: z.string(),
      startsAt: z.string().datetime(),
      endsAt: z.string().datetime().nullable(),
      liftedAt: z.string().datetime().nullable(),
      active: z.boolean(),
      appealable: z.boolean(),
    }),
  ),
  /** Toujours `null` : le service ne pagine pas cette liste. */
  nextCursor: z.null(),
});

export type MySanctionsResponse = z.infer<typeof mySanctionsResponseSchema>;

/**
 * Une action de modération (§4.2).
 *
 * `duration` n'est acceptée QUE sur `SUSPEND_USER`, et seulement parmi 1, 7 et
 * 30 jours. Un `refine` plutôt qu'une union : le message d'erreur nomme alors le
 * champ fautif, ce dont le formulaire du §9 a besoin.
 */
export const caseActionSchema = z
  .object({
    action: z.enum(ModerationActionType),
    reason: z.string().trim().min(ACTION_REASON_MIN).max(ACTION_REASON_MAX),
    durationDays: z
      .union([z.literal(1), z.literal(7), z.literal(30)])
      .optional(),
  })
  .strict()
  .refine((v) => v.action === 'SUSPEND_USER' || v.durationDays === undefined, {
    path: ['durationDays'],
    message: 'Une durée ne se pose que sur une suspension.',
  })
  .refine((v) => v.action !== 'SUSPEND_USER' || v.durationDays !== undefined, {
    path: ['durationDays'],
    message: 'Une suspension exige une durée de 1, 7 ou 30 jours.',
  })
  .refine(
    (v) => !SANCTIONING_ACTIONS.includes(v.action) || v.reason.length >= SANCTION_REASON_MIN,
    { path: ['reason'], message: MODERATION_ERROR_MESSAGES.REASON_TOO_SHORT },
  );

export type CaseAction = z.infer<typeof caseActionSchema>;

// ── Schémas de lecture (§8.2) ───────────────────────────────────────────────

/**
 * La file (§8.2). `assigned` accepte trois états et non deux : « à moi »,
 * « à personne », et « peu importe ». Un booléen ne dirait pas la différence
 * entre un dossier libre et un dossier pris par un collègue, or c'est
 * exactement le filtre dont l'écran du §9 a besoin.
 */
export const casesQuerySchema = cursorQuerySchema
  .extend({
    status: z.enum(ModerationCaseStatus).optional(),
    priority: z.coerce
      .number()
      .int()
      .min(MODERATION_PRIORITY_MIN)
      .max(MODERATION_PRIORITY_MAX)
      .optional(),
    assigned: z.enum(['me', 'nobody', 'any']).default('any'),
    subjectType: reportSubjectTypeSchema.optional(),
    /** L'écran du §9 veut voir d'abord ce qui dépasse le délai. */
    overdue: z
      .enum(['true', 'false'])
      .transform((v) => v === 'true')
      .optional(),
  })
  .strict();

export type CasesQuery = z.infer<typeof casesQuerySchema>;

/** §8.1 : `GET /scam-alerts?cityId&countryId`. */
export const scamAlertsQuerySchema = cursorQuerySchema
  .extend({
    cityId: uuidSchema.optional(),
    countryId: uuidSchema.optional(),
    /** La colonne de droite de l'accueil ne veut que les épinglées (§5). */
    pinnedOnly: z
      .enum(['true', 'false'])
      .transform((v) => v === 'true')
      .optional(),
  })
  .strict();

export type ScamAlertsQuery = z.infer<typeof scamAlertsQuerySchema>;

/** §5 : titre, corps, gravité, ciblage, épinglage, expiration. */
export const scamAlertWriteSchema = z
  .object({
    title: z.string().trim().min(5).max(160),
    body: z.string().trim().min(20).max(5000),
    severity: z.enum(ScamAlertSeverity),
    /** Ville OU pays OU aucun des deux (alerte globale). Jamais les deux. */
    cityId: uuidSchema.optional(),
    countryId: uuidSchema.optional(),
    isPinned: z.boolean().default(false),
    publishedAt: z.string().datetime({ offset: true }).optional(),
    expiresAt: z.string().datetime({ offset: true }).optional(),
    relatedCaseId: uuidSchema.optional(),
  })
  .strict()
  .refine((v) => v.cityId === undefined || v.countryId === undefined, {
    path: ['countryId'],
    message: 'Une alerte cible une ville, un pays, ou rien — pas une ville et un pays.',
  });

export type ScamAlertWrite = z.infer<typeof scamAlertWriteSchema>;

/**
 * L'indicateur de délai de l'écran de file (§9) : vert, ambre, dépassé.
 *
 * Calculé côté serveur et non côté front : l'heure du navigateur est réglable,
 * et un modérateur dont la machine est en retard ne doit pas voir « vert » sur un
 * dossier hors délai.
 */
export type SlaState = 'OK' | 'WARNING' | 'OVERDUE';

/** Ambre dans le dernier quart du délai. */
export function slaState(createdAt: Date, dueAt: Date, now: Date = new Date()): SlaState {
  if (now.getTime() >= dueAt.getTime()) return 'OVERDUE';
  const total = dueAt.getTime() - createdAt.getTime();
  const left = dueAt.getTime() - now.getTime();
  return total > 0 && left <= total / 4 ? 'WARNING' : 'OK';
}
