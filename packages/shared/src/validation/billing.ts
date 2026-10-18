import { z } from 'zod';
import {
  PaymentMethodKind,
  PaymentProviderKind,
  PaymentStatus,
  PlanCode,
  PlanInterval,
  SubscriptionStatus,
  UsageMetric,
} from '../enums/generated.js';
import { cursorQuerySchema, uuidSchema } from './pagination.js';

/**
 * Monétisation — 14-monetisation.md.
 *
 * SOURCE UNIQUE (00 §4) : ces schémas valident l'API ET les formulaires du front.
 * Quatre choses valent d'être dites avant de lire.
 *
 * 1. AUCUNE DONNÉE DE CARTE NE PEUT ENTRER (règle dure §4.1). Ce n'est pas une
 *    vérification, c'est une IMPOSSIBILITÉ : `checkoutSchema` est `.strict()`, donc
 *    un corps qui porte `cardNumber`, `cvc` ou `expiry` est refusé AVANT d'atteindre
 *    le service, avec `VALIDATION_FAILED`. Le seul champ de paiement que l'API
 *    accepte est un NUMÉRO DE TÉLÉPHONE Mobile Money, que l'agrégateur porte et que
 *    l'on ne stocke jamais (§4.1, seconde phrase).
 *
 * 2. LES MONTANTS SONT DES ENTIERS. `payments.amount_cents` et
 *    `plans.price_cents` sont des `Int` PostgreSQL — jamais de flottant, jamais de
 *    `Decimal`, jamais de `BigInt` (un grand entier non converti fait lever
 *    `JSON.stringify`). Pour le XOF, qui n'a pas de sous-unité, `amount_cents`
 *    porte des FRANCS ENTIERS : c'est ce que dit le commentaire du schéma
 *    (« ou plus petite unité pour le XOF »), et `currency` lève l'ambiguïté.
 *
 * 3. LES LIMITES SONT DANS `plans.limits`, ET NULLE PART AILLEURS (§3). Les
 *    valeurs de `PLAN_LIMITS` ci-dessous sont les données d'AMORÇAGE de cette
 *    table, pas une seconde source : les modules livrés (parcours, agenda,
 *    annuaire pro) lisent déjà `plans.limits` et ne retombent sur leur constante
 *    que si la ligne manque. Amorcer la table, c'est faire taire ce repli.
 *
 * 4. `null` VEUT DIRE « ILLIMITÉ », et zéro veut dire « interdit ». Les deux sont
 *    des valeurs utiles et distinctes : le plan gratuit a
 *    `sponsoredJobsPerMonth: 0` (aucune offre sponsorisée), le Premium a
 *    `maxActiveJourneys: null` (autant de parcours qu'il veut).
 */

// ── L'interrupteur « tout gratuit » (lot A) ─────────────────────────────────

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ TOUT EST GRATUIT POUR LE MOMENT — UN SEUL INTERRUPTEUR                      ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « On va laisser les paiements. Tout sera gratuit pour le moment. »
 *
 * `system_settings.monetisation_active`, FAUX par défaut (clé absente = faux).
 * Éteint, TOUS les membres ont les droits Premium : quotas de parcours,
 * d'événements, de contacts pro, offres sponsorisées, alertes (`PLAN_REQUIRED`).
 * Allumé, les plans s'appliquent comme avant — rien du code de paiement, de
 * facturation ni des quotas n'est supprimé.
 *
 * Réglage et non constante partagée : le rallumer ne doit pas demander un
 * déploiement (SUPER_ADMIN, `PUT /admin/settings/monetisation_active`). Le serveur
 * le lit (`common/monetisation.ts`) et le dit au front par `GET /me`
 * (`monetisationActive`), qui n'affiche alors aucune incitation à payer.
 */
export const MONETISATION_SETTING_KEY = 'monetisation_active';
export const MONETISATION_ACTIVE_DEFAULT = false;

// ── Prix (§3) ───────────────────────────────────────────────────────────────

/** §1 et §3 : « Premium membre (4 €/mois) ». */
export const PREMIUM_MONTH_PRICE_CENTS = 400;
/** §3 : « 4 €/mois ou 40 €/an ». */
export const PREMIUM_YEAR_PRICE_CENTS = 4_000;
/** §3 : « ~25 €/mois ». Le tilde est de la spec ; la valeur s'administre. */
export const PRO_MONTH_PRICE_CENTS = 2_500;
/** §3 : « ~40 €/mois ». */
export const PRO_PLUS_MONTH_PRICE_CENTS = 4_000;

/**
 * Parité fixe EUR/XOF — §4.2, et elle est FIXE par traité, pas par choix
 * produit : le franc CFA est arrimé à l'euro à 655,957. Aucun appel à un service
 * de taux, donc aucune dépendance sortante pour afficher un prix.
 */
export const EUR_XOF_RATE = 655.957;

/**
 * Le prix en francs CFA, arrondi À LA CENTAINE INFÉRIEURE.
 *
 * §4.2 donne l'exemple et le résultat attendu : « 4 € = 2 625 F arrondi à
 * 2 600 F ». C'est donc un arrondi vers le BAS, et à la centaine — ce qui est
 * aussi le seul sens acceptable commercialement : arrondir vers le haut ferait
 * payer plus que le prix annoncé.
 *
 * Rend un nombre ENTIER de francs : le XOF n'a pas de sous-unité.
 */
export function xofFromEurCents(eurCents: number): number {
  const francs = (eurCents / 100) * EUR_XOF_RATE;
  return Math.floor(francs / 100) * 100;
}

// ── Essai, grâce, délais (§3, §4.2, §4.3, §4.4) ─────────────────────────────

/** §3 : « 14 jours de Premium offerts à la première étape franchie ». */
export const TRIAL_DAYS = 14;
/** §10 : rappel d'essai à J−3. */
export const TRIAL_REMINDER_DAYS = 3;
/** §4.2 : « Après expiration : 3 jours de grâce, puis EXPIRED ». */
export const MOBILE_MONEY_GRACE_DAYS = 3;
/** §4.2 : « Timeout 5 minutes, statut PENDING visible ». */
export const MOBILE_MONEY_TIMEOUT_MINUTES = 5;
/** §4.2 : « Rappels J−7 et J−1 avant current_period_end ». */
export const RENEWAL_REMINDER_DAYS: readonly number[] = [7, 1];
/** §4.3 : « 3 tentatives Stripe sur 7 jours ». */
export const PAST_DUE_WINDOW_DAYS = 7;
/** §4.4 : « Remboursement sous 14 jours sans usage significatif ». */
export const REFUND_WINDOW_DAYS = 14;
/** §10 : « simple purge à 13 mois » des compteurs d'usage. */
export const USAGE_RETENTION_MONTHS = 13;

// ── Limites de plan (§3) ────────────────────────────────────────────────────

/**
 * Les quotas d'un plan. `null` = illimité, `0` = interdit.
 *
 * Les CLÉS sont celles de `PlanLimitKey` (capabilities.ts) : la matrice des
 * capacités les nomme déjà, et les modules livrés les lisent sous ce nom exact.
 * En inventer d'autres ici casserait silencieusement quatre lectures.
 */
export interface PlanLimits {
  /** §3 : 1 parcours actif en gratuit, illimité en Premium. */
  readonly maxActiveJourneys: number | null;
  readonly eventsPerMonth: number | null;
  readonly proContactsPerMonth: number | null;
  /** §3 : « offres d'emploi sponsorisées (5/mois) » en Premium, aucune en gratuit. */
  readonly sponsoredJobsPerMonth: number | null;
  /** §5.2 : « Masqué pour les membres PREMIUM (limits.hide_partners = true) ». */
  readonly hidePartners: boolean;
  /** §3 : Premium — « profil mis en avant dans l'annuaire des membres ». */
  readonly featuredInDirectory: boolean;
  /** §3 : Pro — « fiche mise en avant dans sa ville ». */
  readonly featuredInCity: boolean;
  /** §3 : Pro+ — « plusieurs villes ». */
  readonly multiCity: boolean;
  /** §3 : Pro+ — « mise en avant dans la recherche globale ». */
  readonly featuredInGlobalSearch: boolean;
  /** §3 : Premium — « alertes logement/emploi ». */
  readonly alerts: boolean;
  /** §3 : Premium — « export PDF + historique » des parcours. */
  readonly journeyExport: boolean;
  /** §3 : Premium — « filtres de recherche avancés ». */
  readonly advancedSearch: boolean;
}

export const planLimitsSchema = z
  .object({
    maxActiveJourneys: z.number().int().min(0).nullable(),
    eventsPerMonth: z.number().int().min(0).nullable(),
    proContactsPerMonth: z.number().int().min(0).nullable(),
    sponsoredJobsPerMonth: z.number().int().min(0).nullable(),
    hidePartners: z.boolean(),
    featuredInDirectory: z.boolean(),
    featuredInCity: z.boolean(),
    multiCity: z.boolean(),
    featuredInGlobalSearch: z.boolean(),
    alerts: z.boolean(),
    journeyExport: z.boolean(),
    advancedSearch: z.boolean(),
  })
  .strict() satisfies z.ZodType<PlanLimits>;

/**
 * Les quatre plans du tableau du §3 — données d'AMORÇAGE de la table `plans`.
 *
 * `interval` est MONTH pour tous : `plans.code` est unique, donc la table ne peut
 * pas porter deux lignes PREMIUM (une mensuelle, une annuelle). Le prix ANNUEL
 * vit dans `system_settings` sous `billing.year_prices` — voir l'arbitrage écrit
 * là-bas. Les limites, elles, ne dépendent pas de la période.
 */
export const PLAN_SEED: readonly {
  readonly code: PlanCode;
  readonly nameFr: string;
  readonly priceCents: number;
  readonly currency: 'EUR';
  readonly interval: PlanInterval;
  readonly limits: PlanLimits;
}[] = [
  {
    code: 'FREE',
    nameFr: 'Gratuit',
    priceCents: 0,
    currency: 'EUR',
    interval: 'MONTH',
    limits: {
      maxActiveJourneys: 1,
      eventsPerMonth: 1,
      proContactsPerMonth: 3,
      sponsoredJobsPerMonth: 0,
      // §3 : « encarts partenaires affichés ». C'est le plan gratuit qui les voit.
      hidePartners: false,
      featuredInDirectory: false,
      featuredInCity: false,
      multiCity: false,
      featuredInGlobalSearch: false,
      alerts: false,
      journeyExport: false,
      advancedSearch: false,
    },
  },
  {
    code: 'PREMIUM',
    nameFr: 'Premium',
    priceCents: PREMIUM_MONTH_PRICE_CENTS,
    currency: 'EUR',
    interval: 'MONTH',
    limits: {
      maxActiveJourneys: null,
      eventsPerMonth: null,
      proContactsPerMonth: null,
      sponsoredJobsPerMonth: 5,
      hidePartners: true,
      featuredInDirectory: true,
      featuredInCity: false,
      multiCity: false,
      featuredInGlobalSearch: false,
      alerts: true,
      journeyExport: true,
      advancedSearch: true,
    },
  },
  {
    code: 'PRO',
    nameFr: 'Pro',
    priceCents: PRO_MONTH_PRICE_CENTS,
    currency: 'EUR',
    interval: 'MONTH',
    limits: {
      // Un plan de FICHE, pas de membre : il ne change aucun quota personnel.
      // `users.plan` ne vaut jamais PRO — l'enum UserPlan n'a que FREE et PREMIUM.
      maxActiveJourneys: 1,
      eventsPerMonth: 1,
      proContactsPerMonth: 3,
      sponsoredJobsPerMonth: 0,
      hidePartners: false,
      featuredInDirectory: false,
      featuredInCity: true,
      multiCity: false,
      featuredInGlobalSearch: false,
      alerts: false,
      journeyExport: false,
      advancedSearch: false,
    },
  },
  {
    code: 'PRO_PLUS',
    nameFr: 'Pro+',
    priceCents: PRO_PLUS_MONTH_PRICE_CENTS,
    currency: 'EUR',
    interval: 'MONTH',
    limits: {
      maxActiveJourneys: 1,
      eventsPerMonth: 1,
      proContactsPerMonth: 3,
      sponsoredJobsPerMonth: 0,
      hidePartners: false,
      featuredInDirectory: false,
      featuredInCity: true,
      multiCity: true,
      featuredInGlobalSearch: true,
      alerts: false,
      journeyExport: false,
      advancedSearch: false,
    },
  },
];

/** Les limites d'amorçage d'un code, pour un repli explicite et testable. */
export function seededLimitsFor(code: PlanCode): PlanLimits {
  const found = PLAN_SEED.find((p) => p.code === code);
  // `PLAN_SEED` couvre les quatre valeurs de l'enum ; `noUncheckedIndexedAccess`
  // n'en sait rien, et un repli silencieux sur FREE serait un piège.
  if (found === undefined) throw new Error(`Plan sans amorçage : ${code}`);
  return found.limits;
}

/**
 * Prix ANNUELS, par code — valeur par défaut du paramètre `billing.year_prices`.
 *
 * ARBITRAGE. §3 annonce « Prix en `system_settings` pour pouvoir tester des
 * variantes sans déploiement », alors que la table `plans` porte déjà
 * `price_cents`. Deux sources pour un même prix, c'est une divergence promise.
 * Retenu : `plans.price_cents` est LA source du prix mensuel (c'est la colonne
 * qui existe, et §3 dit par ailleurs que `plans` est la source unique) ;
 * `system_settings` ne porte que ce que la table ne PEUT pas porter, à savoir le
 * prix annuel, faute d'une seconde ligne par code.
 *
 * §3 ne donne un prix annuel que pour le Premium (40 € pour 4 €/mois, soit dix
 * mois payés). Les deux formules Pro sont alignées sur le même rapport, à défaut
 * d'une valeur de spec — et le paramètre existe précisément pour la corriger sans
 * déploiement.
 */
export const PLAN_YEAR_PRICES_DEFAULT: Record<Exclude<PlanCode, 'FREE'>, number> = {
  PREMIUM: PREMIUM_YEAR_PRICE_CENTS,
  PRO: PRO_MONTH_PRICE_CENTS * 10,
  PRO_PLUS: PRO_PLUS_MONTH_PRICE_CENTS * 10,
};

export const BILLING_YEAR_PRICES_SETTING_KEY = 'billing.year_prices';

export const yearPricesSchema = z
  .object({
    PREMIUM: z.number().int().min(0),
    PRO: z.number().int().min(0),
    PRO_PLUS: z.number().int().min(0),
  })
  .strict();

// ── Plans payants et périodes ───────────────────────────────────────────────

/** Les codes qu'un membre peut SOUSCRIRE. `FREE` ne se souscrit pas : c'est le défaut. */
export const PAID_PLAN_CODES = ['PREMIUM', 'PRO', 'PRO_PLUS'] as const;
export type PaidPlanCode = (typeof PAID_PLAN_CODES)[number];

/**
 * Les deux FAMILLES d'abonnement du §4.3 : « Une seule subscription ACTIVE par
 * (membre, type de plan). Premium et Pro sont indépendants ». PRO et PRO_PLUS
 * sont le même type de plan — passer de l'un à l'autre est un changement de
 * formule, pas un second abonnement.
 */
export type PlanFamily = 'MEMBER' | 'PRO';

export function planFamilyOf(code: PaidPlanCode): PlanFamily {
  return code === 'PREMIUM' ? 'MEMBER' : 'PRO';
}

export function codesInFamily(family: PlanFamily): readonly PaidPlanCode[] {
  return family === 'MEMBER' ? ['PREMIUM'] : ['PRO', 'PRO_PLUS'];
}

// ── Souscription (§7.1) ─────────────────────────────────────────────────────

/**
 * Un numéro Mobile Money, au format E.164 sans le `+`.
 *
 * Il n'est JAMAIS stocké (règle dure §4.1 : « aucun numéro Mobile Money stocké
 * au-delà de la transaction ») : il traverse le service jusqu'à l'agrégateur, et
 * aucune ligne écrite ne le porte.
 */
export const mobileMoneyPhoneSchema = z
  .string()
  .trim()
  .regex(/^\d{8,15}$/, 'Numéro invalide');

/**
 * `POST /me/subscription/checkout`.
 *
 * `.strict()` EST la règle dure §4.1 côté entrée : tout champ non listé fait
 * échouer la requête en 400, donc `cardNumber`, `cvc`, `expMonth`, `pan` ou quel
 * que soit le nom employé n'atteint jamais le service. Ce n'est pas une
 * politesse de validation, c'est le seul endroit où l'API peut garantir qu'aucune
 * donnée de carte ne lui parvient — et c'est pourquoi un `.passthrough()` ici
 * serait une régression de sécurité, pas une commodité.
 */
export const checkoutSchema = z
  .object({
    planCode: z.enum(PAID_PLAN_CODES),
    period: z.enum(PlanInterval),
    provider: z.enum(PaymentProviderKind),
    /** Obligatoire pour Mobile Money, refusé pour la carte (voir le `superRefine`). */
    phone: mobileMoneyPhoneSchema.optional(),
    /**
     * L'OPÉRATEUR, pour Mobile Money — §8 : « Numéro, opérateur ».
     *
     * `payments.method` est NOT NULL et l'enum n'a pas de valeur « inconnu » : il
     * faut donc que le membre le déclare. Pour la carte, il n'y a rien à
     * déclarer — `CARD` est la seule valeur possible, et la demander serait un
     * champ de plus à se tromper.
     */
    method: z.enum(['MTN_MOMO', 'MOOV_MONEY'] as const).optional(),
    /** Renseigné pour PRO / PRO_PLUS : l'abonnement porte sur une fiche. */
    proProfileId: uuidSchema.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.provider === 'MOBILE_MONEY' && value.phone === undefined) {
      ctx.addIssue({ code: 'custom', path: ['phone'], message: 'Indiquez votre numéro Mobile Money.' });
    }
    // Un numéro envoyé avec « carte » n'est pas une erreur bénigne : c'est une
    // donnée personnelle transmise sans raison. On refuse plutôt que d'ignorer.
    if (value.provider === 'STRIPE' && value.phone !== undefined) {
      ctx.addIssue({ code: 'custom', path: ['phone'], message: 'Le paiement par carte ne demande aucun numéro.' });
    }
    if (value.provider === 'MOBILE_MONEY' && value.method === undefined) {
      ctx.addIssue({ code: 'custom', path: ['method'], message: 'Indiquez votre opérateur.' });
    }
    if (value.provider === 'STRIPE' && value.method !== undefined) {
      ctx.addIssue({ code: 'custom', path: ['method'], message: 'Le paiement par carte n’a pas d’opérateur.' });
    }
    if (planFamilyOf(value.planCode) === 'PRO' && value.proProfileId === undefined) {
      ctx.addIssue({ code: 'custom', path: ['proProfileId'], message: 'Indiquez la fiche concernée.' });
    }
    if (planFamilyOf(value.planCode) === 'MEMBER' && value.proProfileId !== undefined) {
      ctx.addIssue({ code: 'custom', path: ['proProfileId'], message: 'Le Premium ne porte pas sur une fiche.' });
    }
  });
export type Checkout = z.infer<typeof checkoutSchema>;

/** Le moyen de paiement déduit du canal. `CARD` est le seul pour Stripe. */
export function methodFor(input: Checkout): PaymentMethodKind {
  return input.provider === 'STRIPE' ? 'CARD' : (input.method ?? 'MTN_MOMO');
}

export const changePeriodSchema = z.object({ period: z.enum(PlanInterval) }).strict();
export type ChangePeriod = z.infer<typeof changePeriodSchema>;

/** `POST /me/subscription/cancel` · `/resume` : la famille visée. */
export const subscriptionTargetSchema = z
  .object({ planCode: z.enum(PAID_PLAN_CODES).default('PREMIUM') })
  .strict();
export type SubscriptionTarget = z.infer<typeof subscriptionTargetSchema>;

// ── Webhooks (§7.1, T4 §8) ──────────────────────────────────────────────────

/**
 * Le corps d'un webhook entrant, réduit à ce que le traitement lit.
 *
 * `.passthrough()` ici et NON `.strict()` — c'est le seul schéma du module qui
 * l'emploie, et pour une raison qui n'a rien à voir avec le confort : le corps
 * vient du FOURNISSEUR, qui ajoutera des champs sans nous demander. Un
 * `.strict()` ferait échouer tous les webhooks au premier champ nouveau, ce qui
 * couperait les activations d'abonnement en silence. La sécurité ne repose pas
 * sur la forme du corps mais sur sa SIGNATURE, vérifiée avant toute lecture.
 *
 * Aucun champ de carte n'est lu, même s'il est présent : rien de ce corps n'est
 * écrit en base hormis `providerRef` et le statut.
 */
export const webhookEventSchema = z
  .object({
    /** L'identifiant de l'événement chez le fournisseur : clé d'idempotence. */
    id: z.string().trim().min(1).max(200),
    type: z.string().trim().min(1).max(120),
    /** La référence du paiement ou de l'abonnement concerné, côté fournisseur. */
    providerRef: z.string().trim().min(1).max(200),
  })
  .passthrough();
export type WebhookEvent = z.infer<typeof webhookEventSchema>;

// ── Équipe (§7.2) ───────────────────────────────────────────────────────────

/** `PUT /admin/billing/plans/:code` — prix et limites (SUPER_ADMIN). */
export const planUpdateSchema = z
  .object({
    priceCents: z.number().int().min(0).optional(),
    yearPriceCents: z.number().int().min(0).optional(),
    limits: planLimitsSchema.optional(),
    isActive: z.boolean().optional(),
    nameFr: z.string().trim().min(1).max(80).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'Rien à modifier.' });
export type PlanUpdate = z.infer<typeof planUpdateSchema>;

export const subscriptionsQuerySchema = cursorQuerySchema.extend({
  status: z.enum(SubscriptionStatus).optional(),
  provider: z.enum(PaymentProviderKind).optional(),
  /** Les essais en cours, qui n'ont ni fournisseur ni paiement. */
  trialsOnly: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
});
export type SubscriptionsQuery = z.infer<typeof subscriptionsQuerySchema>;

export const refundSchema = z
  .object({ reason: z.string().trim().min(3).max(500) })
  .strict();
export type Refund = z.infer<typeof refundSchema>;

/** `GET /admin/billing/revenue?from&to` — bornes de mois, AAAA-MM. */
export const monthKeySchema = z.string().regex(/^\d{4}-(?:0[1-9]|1[0-2])$/, 'Mois attendu au format AAAA-MM');

export const revenueQuerySchema = z
  .object({ from: monthKeySchema.optional(), to: monthKeySchema.optional() })
  .strict();
export type RevenueQuery = z.infer<typeof revenueQuerySchema>;

export const paymentsQuerySchema = cursorQuerySchema.extend({
  status: z.enum(PaymentStatus).optional(),
});
export type PaymentsQuery = z.infer<typeof paymentsQuerySchema>;

// ── Codes d'erreur (§7.1, T4 §3) ────────────────────────────────────────────

export const BILLING_ERROR_CODES = {
  /** §7.1 : un abonnement ACTIVE existe déjà pour ce type de plan (§4.3). */
  ALREADY_SUBSCRIBED: 409,
  /** §7.1 : le portail client est une fonction Stripe ; Mobile Money n'en a pas. */
  NOT_STRIPE: 409,
  /** §7.1 : l'essai de 14 jours ne s'offre qu'une fois. */
  TRIAL_ALREADY_USED: 409,
  /**
   * §3 : « 14 jours offerts À LA PREMIÈRE ÉTAPE FRANCHIE d'un parcours (pas à
   * l'inscription — le membre doit avoir vu la valeur) ». Sans étape franchie,
   * l'essai n'est pas encore dû.
   */
  TRIAL_NOT_ELIGIBLE: 422,
  /** Aucun abonnement à annuler, reprendre ou modifier. */
  NO_SUBSCRIPTION: 404,
  /**
   * §4.2 : Mobile Money fonctionne PAR PÉRIODE, sans récurrence. Il n'y a donc
   * rien à reprendre — le membre repaie une période quand il le souhaite.
   */
  MOBILE_MONEY_NOT_RECURRING: 409,
  /** §4.4 : hors des 14 jours, ou usage significatif constaté. */
  REFUND_NOT_ELIGIBLE: 422,
  /** Le paiement n'est pas dans un état remboursable. */
  PAYMENT_NOT_REFUNDABLE: 409,
  /**
   * T4 §8 : « signature vérifiée ». Un webhook non signé, mal signé, ou reçu
   * alors qu'aucun secret n'est configuré est REFUSÉ — jamais traité « au
   * bénéfice du doute », ce qui laisserait n'importe qui activer un abonnement.
   */
  WEBHOOK_SIGNATURE_INVALID: 400,
  /**
   * La facture PDF n'est pas générable : aucun moteur de rendu n'est branché et
   * `payments.invoice_asset_id` n'a pas de pipeline média. 503 et non 404 : la
   * facture EXISTE (son numéro est attribué), c'est sa mise en forme qui manque.
   */
  INVOICE_UNAVAILABLE: 503,
  /** Le fournisseur de paiement visé n'est pas configuré (§4.1, décision D4). */
  PROVIDER_UNAVAILABLE: 503,
} as const;

export type BillingErrorCode = keyof typeof BILLING_ERROR_CODES;

export const BILLING_ERROR_MESSAGES: Record<BillingErrorCode, string> = {
  ALREADY_SUBSCRIBED: 'Vous avez déjà un abonnement en cours pour cette formule.',
  NOT_STRIPE: 'Le portail de gestion n’existe que pour les paiements par carte.',
  TRIAL_ALREADY_USED: 'Vous avez déjà bénéficié de l’essai gratuit.',
  TRIAL_NOT_ELIGIBLE:
    'L’essai s’active à la première étape franchie d’un parcours. Avancez d’une étape, puis revenez.',
  NO_SUBSCRIPTION: 'Vous n’avez pas d’abonnement en cours.',
  MOBILE_MONEY_NOT_RECURRING:
    'Un paiement Mobile Money couvre une période, sans reconduction. Repayez quand vous le souhaitez.',
  REFUND_NOT_ELIGIBLE: 'Ce paiement ne remplit pas les conditions de remboursement.',
  PAYMENT_NOT_REFUNDABLE: 'Ce paiement n’est pas remboursable dans son état actuel.',
  WEBHOOK_SIGNATURE_INVALID: 'Signature invalide.',
  INVOICE_UNAVAILABLE: 'Votre facture n’est pas encore téléchargeable. Le numéro est déjà attribué.',
  PROVIDER_UNAVAILABLE: 'Ce moyen de paiement n’est pas encore disponible.',
};

// ── Métriques d'usage (§4.5) ────────────────────────────────────────────────

/**
 * La clé de limite qui borne chaque métrique de `usage_counters`.
 *
 * `SPONSORED_JOBS` est ABSENTE de l'enum `UsageMetric` du schéma figé, alors que
 * §4.5 la nomme. Le module `jobs`, livré, déduit donc son compte mensuel de
 * `sponsored_until` au lieu d'un compteur — signalé, non contourné.
 */
export const USAGE_METRIC_LIMIT_KEYS = {
  EVENTS_CREATED: 'eventsPerMonth',
  PRO_CONTACTS: 'proContactsPerMonth',
} as const;

/** `AAAA-MM` de la date donnée, en UTC : la clé de `usage_counters.period_key`. */
export function monthKeyOf(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Le premier instant du mois suivant : le `resetsAt` annoncé au membre (§4.5). */
export function nextMonthStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1, 0, 0, 0, 0));
}

// ── Réponses (§7.1, §4.3, §4.4, §4.5) ───────────────────────────────────────

/**
 * Un montant, tel que toute route de ce module l'envoie : des CENTIMES entiers et
 * une devise, jamais un flottant.
 *
 * §4.1 et la table `payments` sont d'accord là-dessus, et c'est la seule forme qui
 * ne perde rien : `2600 / 100` donne 26 en EUR, mais un XOF n'a pas de centime et
 * un arrondi de flottant sur une facture est une erreur comptable. Le front
 * formate à l'affichage ; il ne convertit pas.
 */
export const moneyResponseSchema = z.object({
  amountCents: z.number().int(),
  currency: z.string(),
});

/**
 * `GET /plans` (§7.1) — LES DEUX DEVISES, toujours.
 *
 * Le serveur n'en choisit pas une : « le membre peut être béninois en France, ou
 * français au Bénin, et le pays déduit d'une IP serait faux la moitié du temps ».
 * L'écran K06 montre celle qui correspond au canal de paiement choisi.
 */
export const plansResponseSchema = z.object({
  items: z.array(
    z.object({
      code: z.enum(PlanCode),
      nameFr: z.string(),
      month: z.object({ eur: moneyResponseSchema, xof: moneyResponseSchema }),
      year: z.object({ eur: moneyResponseSchema, xof: moneyResponseSchema }),
      limits: planLimitsSchema,
    }),
  ),
});

export type PlansResponse = z.infer<typeof plansResponseSchema>;

/** Un abonnement tel que `GET /me/subscription` le montre (§4.3). */
const subscriptionViewSchema = z.object({
  id: uuidSchema,
  planCode: z.enum(PlanCode),
  status: z.enum(SubscriptionStatus),
  provider: z.enum(PaymentProviderKind),
  /** Dérivé, faute de colonne `is_trial` (§6). */
  isTrial: z.boolean(),
  currentPeriodStart: z.string().datetime(),
  currentPeriodEnd: z.string().datetime(),
  cancelAtPeriodEnd: z.boolean(),
  /** Dérivée, et SEULEMENT pour Mobile Money (§4.2) : trois jours de grâce. */
  graceUntil: z.string().datetime().nullable(),
  cancelledAt: z.string().datetime().nullable(),
});

/**
 * `GET /me/subscription` (§4.3, §4.5).
 *
 * `items` PLUTÔT QU'UN OBJET, et ce n'est pas une maladresse de l'API : un membre
 * peut porter deux abonnements à la fois — Premium et Pro sont des plans
 * différents (§3) — et `history` porte en plus les expirés, parce qu'« un membre
 * dont l'abonnement vient d'expirer doit pouvoir le constater plutôt que de voir
 * un écran vide qui laisse croire qu'il n'a jamais payé ».
 *
 * `usage.items[].limit` vaut `null` pour « illimité ». L'écran affiche « illimité »,
 * jamais « 0 sur null » — le commentaire du service le dit déjà, et le schéma le
 * rend vérifiable.
 */
export const mySubscriptionResponseSchema = z.object({
  items: z.array(subscriptionViewSchema),
  history: z.array(subscriptionViewSchema),
  trial: z.object({
    used: z.boolean(),
    active: z.boolean(),
    endsAt: z.string().datetime().nullable(),
  }),
  usage: z.object({
    /** `AAAA-MM`, la clé de `usage_counters.period_key`. */
    periodKey: monthKeySchema,
    resetsAt: z.string().datetime(),
    items: z.array(
      z.object({
        metric: z.enum(UsageMetric),
        used: z.number().int(),
        limit: z.number().int().nullable(),
      }),
    ),
  }),
});

export type MySubscriptionResponse = z.infer<typeof mySubscriptionResponseSchema>;

/**
 * `GET /me/payments` (§4.4) — l'historique des factures.
 *
 * RÈGLE DURE §4.1 : aucune donnée de carte ne transite par le serveur. Ce schéma
 * en est une preuve exécutable côté lecture : il n'y a ni numéro, ni empreinte, ni
 * quatre derniers chiffres, ni date d'expiration. `method` est un KIND — `CARD`,
 * `MOBILE_MONEY` — c'est-à-dire le CANAL, pas l'instrument. Si l'API se mettait un
 * jour à joindre un `last4`, la validation de réponse le refuserait au lieu de le
 * laisser atteindre l'écran.
 *
 * `nextCursor` est là et vaut toujours `null` : le service ne pagine pas encore
 * cette liste, et le déclarer `z.null()` dirait faux le jour où il le fera.
 *
 * ── `.strict()` SUR LA LIGNE DE PAIEMENT, ET C'EST LÀ QUE TIENT LA RÈGLE ────
 *
 * Sans lui, ce schéma DÉPOUILLE en silence une clé qu'il ne connaît pas : une API
 * qui se mettrait à joindre `last4`, `fingerprint` ou `exp_month` verrait sa réponse
 * acceptée, la donnée n'atteindrait pas l'écran, et tout le monde conclurait que la
 * règle est tenue. Elle ne le serait pas : §4.1 dit « aucune donnée de carte ne
 * TRANSITE par le serveur », et une donnée dépouillée à l'arrivée a transité.
 *
 * Avec `.strict()`, elle lève `ApiShapeError` — un INCIDENT, pas un message métier,
 * et `ApiShapeError` n'hérite pas d'`ApiError` précisément pour qu'aucun `catch`
 * métier ne puisse l'avaler. La règle cesse d'être une consigne de relecture et
 * devient un refus.
 *
 * CE N'EST PAS UNE PRÉCAUTION THÉORIQUE : la mutation qui ajoute `last4: '4242'` au
 * service de facturation ne faisait ROUGIR AUCUN TEST avant ce `.strict()`. Le test
 * de bout en bout qui balayait le corps des trois routes restait vert, parce qu'un
 * membre neuf n'a aucun paiement — `items` est vide, il n'y avait rien à trouver.
 * Un test qui ne peut pas échouer est un test creux, et celui-là l'était à moitié.
 */
export const paymentViewSchema = z
  .object({
    id: uuidSchema,
    amount: moneyResponseSchema,
    provider: z.enum(PaymentProviderKind),
    method: z.enum(PaymentMethodKind),
    status: z.enum(PaymentStatus),
    invoiceNumber: z.string().nullable(),
    paidAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
  })
  .strict();

export const myPaymentsResponseSchema = z.object({
  items: z.array(paymentViewSchema),
  nextCursor: z.string().nullable(),
});

export type MyPaymentsResponse = z.infer<typeof myPaymentsResponseSchema>;
