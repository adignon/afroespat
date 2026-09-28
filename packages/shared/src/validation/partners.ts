import { z } from 'zod';
import { PartnerCategory, PayoutModel } from '../enums/generated.js';
import { cursorQuerySchema, uuidSchema } from './pagination.js';

/**
 * Partenaires et affiliation — 14-monetisation.md §5.
 *
 * DEUX RÈGLES DURES vivent ici, et elles sont tenues par des types, pas par des
 * intentions.
 *
 * 1. **Aucun encart hors d'une étape de parcours et du pied de Logement** (§2 et
 *    §5.1). Le seul moyen de demander un encart est `placementQuerySchema`, et il
 *    n'accepte QUE deux formes : une définition d'étape, ou la section
 *    `HOUSING`. `PLACEMENT_SECTIONS` ne contient qu'une entrée — le jour où
 *    quelqu'un y ajoute `FEED`, le test statique de couverture tombe. Une règle
 *    tenue par l'absence de code ne lève jamais toute seule ; celle-ci est
 *    tenue par une liste fermée, qui se compte.
 *
 * 2. **Aucune donnée personnelle dans un lien d'affiliation** (§5.3). Le gabarit
 *    d'URL est validé à l'écriture : il doit contenir `{click_id}` et AUCUN autre
 *    paramètre substituable. `buildAffiliateUrl` le vérifie une seconde fois au
 *    moment de rendre l'URL, et refuse si une valeur interdite s'y trouve — parce
 *    qu'un gabarit valide peut être contourné par un `headline` ou une
 *    concaténation ajoutée plus tard, et que la vérification doit être là où
 *    l'URL PART, pas seulement là où elle est saisie.
 */

// ── Sections où un encart peut vivre (§5.1) ─────────────────────────────────

/**
 * Les emplacements NON rattachés à une étape de parcours.
 *
 * Il y en a UN : le pied de la section Logement. §5.1 : « Second emplacement :
 * pied de la section Logement (`step_definition_id` virtuel `HOUSING_SECTION`,
 * même mécanisme) ». Tout ajout à cette liste est un changement de la règle dure
 * du §2, et doit se lire comme tel.
 */
export const PLACEMENT_SECTIONS = ['HOUSING'] as const;
export type PlacementSection = (typeof PLACEMENT_SECTIONS)[number];

/**
 * Le code de la définition d'étape « virtuelle » qui porte le pied de Logement.
 *
 * `partner_placements.step_definition_id` est NOT NULL et référence
 * `step_definitions` : le « virtuel » de la spec doit donc être une VRAIE ligne,
 * amorcée avec les plans. Elle n'appartient à aucune version de modèle, donc
 * aucun parcours ne la contient jamais.
 */
export const HOUSING_SECTION_STEP_CODE = 'HOUSING_SECTION';

/**
 * `GET /placements` — l'encart résolu, ou rien.
 *
 * Exactement UN des deux paramètres. Ni les deux (quelle serait la priorité ?),
 * ni aucun (ce qui demanderait « un encart, n'importe où » — précisément ce que
 * la règle dure interdit).
 */
export const placementQuerySchema = z
  .object({
    stepDefinitionId: uuidSchema.optional(),
    section: z.enum(PLACEMENT_SECTIONS).optional(),
  })
  .strict()
  .refine((v) => (v.stepDefinitionId === undefined) !== (v.section === undefined), {
    message: 'Indiquez une étape ou la section Logement, mais pas les deux.',
  });
export type PlacementQuery = z.infer<typeof placementQuerySchema>;

// ── Gabarit d'URL d'affiliation (§5.3) ──────────────────────────────────────

/** Le seul jeton substituable autorisé dans `partners.affiliate_url_template`. */
export const CLICK_ID_TOKEN = '{click_id}';

/** Tout jeton `{…}` présent dans un gabarit. */
const TOKEN_PATTERN = /\{[^}]*\}/g;

export const affiliateUrlTemplateSchema = z
  .string()
  .trim()
  .min(8)
  .max(1_000)
  .refine((v) => v.startsWith('https://'), { message: 'Le lien d’affiliation doit être en HTTPS.' })
  .refine((v) => v.includes(CLICK_ID_TOKEN), {
    message: 'Le gabarit doit contenir {click_id} : c’est ce qui permet de rattacher la conversion.',
  })
  .refine(
    (v) => (v.match(TOKEN_PATTERN) ?? []).every((token) => token === CLICK_ID_TOKEN),
    {
      message:
        'Le gabarit ne peut contenir aucun autre paramètre que {click_id} : ' +
        'aucune donnée personnelle ne part chez le partenaire (règle dure §5.3).',
    },
  );

/**
 * L'URL finale, avec le seul `click_id`.
 *
 * `forbidden` porte les valeurs qui ne doivent EN AUCUN CAS s'y trouver —
 * identifiant du membre, handle, identifiant d'étape. La fonction lève si l'une
 * apparaît : c'est une assertion, pas un filtre, et elle vaut pour l'avenir. Le
 * jour où quelqu'un ajoutera « juste un paramètre de suivi », le test tombera
 * ici plutôt que chez le partenaire.
 */
export function buildAffiliateUrl(
  template: string,
  clickId: string,
  forbidden: readonly string[] = [],
): string {
  const url = template.split(CLICK_ID_TOKEN).join(encodeURIComponent(clickId));

  const remaining = url.match(TOKEN_PATTERN);
  if (remaining !== null) {
    throw new Error(
      `Gabarit d'affiliation non substitué : ${remaining.join(', ')} — aucune donnée du membre ne part chez le partenaire (§5.3).`,
    );
  }

  for (const value of forbidden) {
    // Les valeurs vides ne prouvent rien et feraient toujours correspondre.
    if (value.length === 0) continue;
    if (url.includes(value) || url.includes(encodeURIComponent(value))) {
      throw new Error(
        "Donnée personnelle dans un lien d'affiliation : seul click_id peut y figurer (règle dure §5.3).",
      );
    }
  }
  return url;
}

// ── Partenaires (§7.2, CONTENT_ADMIN) ───────────────────────────────────────

export const PARTNER_NAME_MAX = 120;
export const PARTNER_TRANSPARENCY_MAX = 2_000;
export const PLACEMENT_HEADLINE_MAX = 120;
export const PLACEMENT_DESCRIPTION_MAX = 500;
export const PLACEMENT_CTA_MAX = 40;

/** §5.2 : la mention « Partenaire » est TOUJOURS visible, et le serveur la fournit. */
export const PARTNER_BADGE_LABEL = 'Partenaire';
/** §5.2 : le lien vers la page de transparence, toujours joint à l'encart. */
export const PARTNER_TRANSPARENCY_LINK_LABEL = 'Pourquoi cet encart ?';
export const PARTNER_TRANSPARENCY_PAGE_SLUG = 'transparence-partenaires';

export const partnerCreateSchema = z
  .object({
    name: z.string().trim().min(2).max(PARTNER_NAME_MAX),
    category: z.enum(PartnerCategory),
    affiliateUrlTemplate: affiliateUrlTemplateSchema,
    payoutModel: z.enum(PayoutModel),
    logoAssetId: uuidSchema.optional(),
    contractStart: z.string().date().optional(),
    contractEnd: z.string().date().optional(),
    isActive: z.boolean().default(true),
  })
  .strict()
  .refine(
    (v) => v.contractStart === undefined || v.contractEnd === undefined || v.contractEnd > v.contractStart,
    { path: ['contractEnd'], message: 'La fin du contrat doit suivre son début.' },
  );
export type PartnerCreate = z.infer<typeof partnerCreateSchema>;

export const partnerUpdateSchema = z
  .object({
    name: z.string().trim().min(2).max(PARTNER_NAME_MAX).optional(),
    category: z.enum(PartnerCategory).optional(),
    affiliateUrlTemplate: affiliateUrlTemplateSchema.optional(),
    payoutModel: z.enum(PayoutModel).optional(),
    logoAssetId: uuidSchema.nullable().optional(),
    contractStart: z.string().date().nullable().optional(),
    contractEnd: z.string().date().nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'Rien à modifier.' });
export type PartnerUpdate = z.infer<typeof partnerUpdateSchema>;

export const partnersQuerySchema = cursorQuerySchema.extend({
  category: z.enum(PartnerCategory).optional(),
  isActive: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
});
export type PartnersQuery = z.infer<typeof partnersQuerySchema>;

// ── Placements (§5.1) ───────────────────────────────────────────────────────

/**
 * La CIBLE d'un placement : une étape, ou la section Logement. Même liste fermée
 * que la lecture — un placement qu'on ne peut pas lire n'aurait aucun sens, et
 * deux listes divergentes seraient le moyen le plus simple de faire entrer un
 * encart là où il est interdit.
 */
const placementTargetSchema = z
  .object({
    stepDefinitionId: uuidSchema.optional(),
    section: z.enum(PLACEMENT_SECTIONS).optional(),
  })
  .refine((v) => (v.stepDefinitionId === undefined) !== (v.section === undefined), {
    message: 'Un placement cible une étape de parcours ou la section Logement.',
  });

export const placementCreateSchema = z
  .object({
    partnerId: uuidSchema,
    stepDefinitionId: uuidSchema.optional(),
    section: z.enum(PLACEMENT_SECTIONS).optional(),
    originCountryId: uuidSchema.optional(),
    destinationCountryId: uuidSchema.optional(),
    headline: z.string().trim().min(3).max(PLACEMENT_HEADLINE_MAX),
    description: z.string().trim().max(PLACEMENT_DESCRIPTION_MAX).optional(),
    ctaLabel: z.string().trim().min(2).max(PLACEMENT_CTA_MAX),
    startsAt: z.string().datetime().optional(),
    endsAt: z.string().datetime().optional(),
    isActive: z.boolean().default(true),
  })
  .strict()
  .superRefine((v, ctx) => {
    const target = placementTargetSchema.safeParse(v);
    if (!target.success) {
      ctx.addIssue({
        code: 'custom',
        path: ['stepDefinitionId'],
        message: 'Un placement cible une étape de parcours ou la section Logement.',
      });
    }
    if (v.startsAt !== undefined && v.endsAt !== undefined && v.endsAt <= v.startsAt) {
      ctx.addIssue({ code: 'custom', path: ['endsAt'], message: 'La fin doit suivre le début.' });
    }
  });
export type PlacementCreate = z.infer<typeof placementCreateSchema>;

export const placementUpdateSchema = z
  .object({
    headline: z.string().trim().min(3).max(PLACEMENT_HEADLINE_MAX).optional(),
    description: z.string().trim().max(PLACEMENT_DESCRIPTION_MAX).nullable().optional(),
    ctaLabel: z.string().trim().min(2).max(PLACEMENT_CTA_MAX).optional(),
    startsAt: z.string().datetime().nullable().optional(),
    endsAt: z.string().datetime().nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'Rien à modifier.' });
export type PlacementUpdate = z.infer<typeof placementUpdateSchema>;

export const placementsQuerySchema = cursorQuerySchema.extend({
  partnerId: uuidSchema.optional(),
  stepDefinitionId: uuidSchema.optional(),
});
export type PlacementsQuery = z.infer<typeof placementsQuerySchema>;

// ── Import de conversions (§5.3, §7.2) ──────────────────────────────────────

/**
 * Une ligne de l'import CSV du partenaire.
 *
 * `clickId` et non un identifiant de membre : le partenaire ne connaît que
 * `click_id`, et c'est exactement le point de la règle dure §5.3. Un import qui
 * porterait un `userId` serait le signe qu'une donnée personnelle a fuité —
 * `.strict()` le refuse.
 */
export const affiliateConversionSchema = z
  .object({
    clickId: uuidSchema,
    conversionRef: z.string().trim().min(1).max(200),
    payoutCents: z.number().int().min(0),
    convertedAt: z.string().datetime().optional(),
  })
  .strict();
export type AffiliateConversion = z.infer<typeof affiliateConversionSchema>;

export const affiliateImportSchema = z
  .object({ rows: z.array(affiliateConversionSchema).min(1).max(5_000) })
  .strict();
export type AffiliateImport = z.infer<typeof affiliateImportSchema>;

// ── Codes d'erreur ──────────────────────────────────────────────────────────

export const PARTNER_ERROR_CODES = {
  /**
   * §5.1 : « Contrainte d'unicité : un seul placement actif par étape et par
   * combinaison de pays → un seul encart par étape. Un second placement pour la
   * même étape est refusé (PLACEMENT_EXISTS) ». Le nom du code est celui de la spec.
   */
  PLACEMENT_EXISTS: 409,
  /** Le partenaire est inactif ou hors contrat : on ne place pas pour lui. */
  PARTNER_INACTIVE: 409,
  /**
   * La section demandée n'a pas de ligne d'ancrage en base (`HOUSING_SECTION`
   * non amorcée). Dit franchement plutôt que de rendre « aucun encart », qui
   * ferait passer un défaut d'amorçage pour une absence de partenaire.
   */
  SECTION_NOT_SEEDED: 503,
} as const;

export type PartnerErrorCode = keyof typeof PARTNER_ERROR_CODES;

export const PARTNER_ERROR_MESSAGES: Record<PartnerErrorCode, string> = {
  PLACEMENT_EXISTS: 'Un encart est déjà actif pour cette étape et cette combinaison de pays.',
  PARTNER_INACTIVE: 'Ce partenaire n’est pas actif.',
  SECTION_NOT_SEEDED: 'Cet emplacement n’est pas encore configuré.',
};
