import { z } from 'zod';

/**
 * Le pilotage côté équipe, phase 5 « Administration » — 15 §5.1 (tableau de bord),
 * §5.3 (rapport d'impact), §2.1 et 13 §4.4 (alertes d'équipe).
 *
 * Même règle que `admin-responses.ts` : `packages/shared` est la source unique des
 * bornes ET des schémas de réponse, le front les importe et le transport refuse toute
 * réponse qui ne leur correspond pas.
 *
 * RÈGLE DURE (15 §5.3) : « Toutes les données sont agrégées, jamais nominatives. »
 * Aucun schéma de ce fichier ne porte d'identifiant ni de nom de membre.
 */

// ── Tableau de bord : objectif de l'indicateur clé ──────────────────────────

/** `system_settings['key_indicator_target']` — 15 §5.1 : « Objectif : 30 % ». */
export const KEY_INDICATOR_TARGET_SETTING_KEY = 'key_indicator_target';
export const KEY_INDICATOR_TARGET_DEFAULT = 30;

/** Le nombre de semaines de la courbe de l'indicateur clé (15 §5.1 : « courbe hebdomadaire »). */
export const KEY_INDICATOR_WEEKS = 12;

const nullableNumber = z.number().nullable();

/**
 * `GET /v1/admin/dashboard/overview` — ce que les onze blocs d'instantanés ne portent
 * pas : le bandeau d'alertes, l'indicateur clé AVEC son objectif, sa variation et sa
 * courbe, la file de modération et son SLA, la note moyenne des parrainages, les
 * événements du mois, les réseaux par type.
 *
 * Ouverte aux QUATRE rôles (15 §2.2, « Tableaux de bord »), c'est pourquoi la file de
 * modération et son SLA sont ICI et non lus dans `GET /admin/moderation/stats`
 * (SUPER_ADMIN et MODERATOR seulement) : un écran ne doit pas exiger plus de
 * privilège que ce qu'il affiche.
 *
 * UNE MESURE ABSENTE EST `null`, jamais zéro : l'écran écrit « — » et « Pas encore de
 * mesure ». `0` est un fait (aucun dossier en retard), `null` est une absence (aucun
 * calcul de l'indicateur clé n'a encore tourné).
 *
 * `revenus` est ABSENT à dessein : le paiement est hors périmètre (« tout est gratuit »),
 * l'écran écrit « — » sans rien inventer.
 */
export const adminDashboardOverviewSchema = z
  .object({
    generatedAt: z.string().datetime(),
    alerts: z
      .object({
        /** Dossiers de modération ouverts dont le délai (SLA) est dépassé. */
        moderationOverdue: z.object({ count: z.number() }).strict(),
        /** Fiches pro en attente de validation du justificatif. */
        proPending: z.object({ count: z.number() }).strict(),
        /** Villes inactives au-dessus du seuil de suggestion d'activation (02 §7). */
        citiesToActivate: z.object({ count: z.number(), names: z.array(z.string()) }).strict(),
        /** Alertes d'équipe non lues du compte connecté (délai de modération, verrouillage). */
        unreadStaffAlerts: z.number(),
      })
      .strict(),
    keyIndicator: z
      .object({
        /** Part des membres des villes cochés présents à un événement sur 90 jours, 0 à 100. */
        percent: nullableNumber,
        /** L'objectif en pourcentage (`key_indicator_target`, 30 par défaut). */
        target: z.number(),
        /** Écart en points avec le dernier instantané d'au moins 7 jours plus ancien. */
        variationPoints: nullableNumber,
        members: nullableNumber,
        present: nullableNumber,
        measuredAt: z.string().datetime().nullable(),
        byCity: z.array(
          z.object({ cityId: z.string(), name: z.string(), percent: z.number(), members: z.number(), present: z.number() }).strict(),
        ),
        weekly: z.array(z.object({ weekStart: z.string().datetime(), percent: z.number() }).strict()),
      })
      .strict(),
    moderation: z
      .object({
        queue: z.number(),
        /** Une PROPORTION dans [0, 1] (comme `slaComplianceRate` de `/moderation/stats`). */
        slaComplianceRate: z.number().min(0).max(1).nullable(),
        resolvedSampleSize: z.number(),
      })
      .strict(),
    mentorship: z
      .object({ active: z.number(), averageRating: nullableNumber, ratingCount: z.number() })
      .strict(),
    events: z.object({ thisMonth: z.number(), checkedInThisMonth: z.number() }).strict(),
    communities: z.object({ active: z.number(), interest: z.number() }).strict(),
  })
  .strict();
export type AdminDashboardOverview = z.infer<typeof adminDashboardOverviewSchema>;

// ── Rapport d'impact : historique, témoignages ──────────────────────────────

/**
 * « 2026-T3 ». La forme « 2026-Q3 » (acceptée de longue date par `GET /impact`) est lue
 * comme « 2026-T3 » : un seul libellé circule ensuite, celui que le serveur écrit.
 */
export const impactQuarterSchema = z
  .string()
  .regex(/^\d{4}-[TQ][1-4]$/)
  .transform((q) => q.replace('-Q', '-T'));

/** `?quarter=` des routes d'impact : la forme « AAAA-TN » que le serveur écrit. */
export const impactQuarterQuerySchema = z.object({ quarter: impactQuarterSchema.optional() }).strict();

export const IMPACT_QUOTE_MIN = 20;
export const IMPACT_QUOTE_MAX = 300;

export const impactQuoteKindSchema = z.enum(['GUIDE', 'CITY_TIP']);
export type ImpactQuoteKind = z.infer<typeof impactQuoteKindSchema>;

/** `POST /admin/impact/recompute` — un nouveau calcul, une révision de plus. */
export const impactRecomputeSchema = z.object({ quarter: impactQuarterSchema }).strict();

/** `PUT /admin/impact/quotes` — l'équipe approuve (et peut raccourcir) l'extrait cité. */
export const impactQuoteApproveSchema = z
  .object({
    quarter: impactQuarterSchema,
    kind: impactQuoteKindSchema,
    sourceId: z.string().uuid(),
    quote: z.string().trim().min(IMPACT_QUOTE_MIN).max(IMPACT_QUOTE_MAX),
  })
  .strict();
export type ImpactQuoteApprove = z.infer<typeof impactQuoteApproveSchema>;

/** `PUT /guides/:id/quotable` · `PUT /tips/:id/quotable` — l'accord de l'auteur. */
export const quotableSchema = z.object({ quotable: z.boolean() }).strict();

export const impactPointSchema = z
  .object({ metric: z.string().min(1), dimension: z.string(), value: z.number() })
  .strict();

/**
 * Un témoignage tel que le rapport l'affiche : l'extrait approuvé, le type de contenu et
 * la ville. NI nom NI identifiant d'auteur (« agrégé, jamais nominatif »).
 */
export const impactTestimonialSchema = z
  .object({
    id: z.string(),
    quote: z.string(),
    kind: impactQuoteKindSchema,
    cityName: z.string().nullable(),
  })
  .strict();

/**
 * `GET /v1/admin/impact?quarter=` — le rapport d'un trimestre, relu dans l'HISTORIQUE.
 *
 * `revision` et `computedAt` valent `null` quand aucun instantané n'existe pour ce
 * trimestre (« Pas encore de mesure », jamais un rapport inventé). `quarters` liste
 * tous les trimestres conservés, du plus récent au plus ancien, pour le sélecteur.
 */
export const adminImpactReportSchema = z
  .object({
    trimestre: z.string().min(1),
    revision: z.number().nullable(),
    computedAt: z.string().datetime().nullable(),
    items: z.array(impactPointSchema),
    quarters: z.array(
      z.object({ quarter: z.string(), revision: z.number(), computedAt: z.string().datetime() }).strict(),
    ),
    temoignages: z.array(impactTestimonialSchema),
  })
  .strict();
export type AdminImpactReport = z.infer<typeof adminImpactReportSchema>;

/** `GET /admin/impact/testimonials?quarter=` — les contenus que l'auteur accepte de voir cités. */
export const adminImpactCandidatesSchema = z
  .object({
    items: z.array(
      z
        .object({
          kind: impactQuoteKindSchema,
          sourceId: z.string(),
          title: z.string().nullable(),
          excerpt: z.string(),
          cityName: z.string().nullable(),
          /** La citation approuvée pour CE trimestre, ou `null`. */
          quote: z.object({ id: z.string(), quote: z.string() }).strict().nullable(),
        })
        .strict(),
    ),
  })
  .strict();
export type AdminImpactCandidates = z.infer<typeof adminImpactCandidatesSchema>;

// ── Alertes d'équipe (13 §4.4, 15 §2.1) ─────────────────────────────────────

/** Les genres d'alerte d'équipe. `SLA_BREACH` : dossier hors délai ; `STAFF_LOCKED` : compte verrouillé. */
export const STAFF_ALERT_KINDS = ['SLA_BREACH', 'STAFF_LOCKED'] as const;
export type StaffAlertKind = (typeof STAFF_ALERT_KINDS)[number];

export const adminStaffAlertsResponseSchema = z
  .object({
    items: z.array(
      z
        .object({
          id: z.string(),
          createdAt: z.string(),
          kind: z.string(),
          title: z.string(),
          body: z.string().nullable(),
          caseId: z.string().nullable(),
          caseOpen: z.boolean().nullable(),
          read: z.boolean(),
        })
        .passthrough(),
    ),
    unread: z.number(),
  })
  .passthrough();
export type AdminStaffAlerts = z.infer<typeof adminStaffAlertsResponseSchema>;
