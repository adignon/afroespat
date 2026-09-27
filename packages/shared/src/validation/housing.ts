import { z } from 'zod';
import { AlertKind, HousingKind } from '../enums/generated.js';
import { cursorQuerySchema, uuidSchema } from './pagination.js';

/**
 * Logement — 10-services.md §2.
 *
 * SOURCE UNIQUE (00 §4) : ces bornes valident l'API ET le formulaire « Publier un
 * logement ». Recopiées côté front, elles auraient divergé au premier ajustement,
 * et c'est l'écran de publication qui aurait menti.
 *
 * Trois choses méritent d'être dites ici plutôt qu'en commentaire de service :
 *
 *   · le BANDEAU de sécurité est une constante de ce paquet, pas une chaîne du
 *     front. §2.2 en fait une règle dure (« renvoyé par l'API sur chaque liste et
 *     chaque annonce ») : le texte doit venir du serveur, sinon un déploiement
 *     front peut le faire disparaître sans que personne ne s'en aperçoive ;
 *
 *   · les POIDS du score de risque sont ici, avec les seuils. L'admin peut les
 *     régler (`system_settings`, §6) ; ces valeurs sont le repli quand le réglage
 *     n'existe pas. Ne pas retomber sur elles signifierait « aucun score tant que
 *     l'admin n'a rien réglé », or c'est la protection principale du module ;
 *
 *   · `price_cents` est un ENTIER en centimes (00 §4). Jamais un flottant sur un
 *     montant : 1 234,56 € en flottant finit par s'afficher 1 234,55 €.
 */

// ── Bornes du §2.1 ───────────────────────────────────────────────────────────

/** §2.1 : « Durée de vie 60 jours (`expires_at`) ». */
export const HOUSING_LIFETIME_DAYS = 60;
/** §2.1 : « renouvelable par l'auteur (une fois par 30 jours) ». */
export const HOUSING_RENEW_INTERVAL_DAYS = 30;
/** §2.1 : « 3 annonces actives maximum par membre ». */
export const MAX_ACTIVE_HOUSING_LISTINGS = 3;
/** §2.1 : « 1 à 8 photos (offre : au moins 1) ». */
export const HOUSING_PHOTOS_MAX = 8;
export const HOUSING_OFFER_PHOTOS_MIN = 1;
/** §2.4 et §5 : « ville (+ 30 km) ». */
export const HOUSING_DEFAULT_RADIUS_KM = 30;

/**
 * §2.1 : les kinds d'OFFRE, par opposition aux deux kinds de RECHERCHE.
 *
 * La distinction porte trois règles : le prix est obligatoire sur une offre, au
 * moins une photo aussi, et la médiane de prix se calcule par kind. La déduire du
 * nom (`SEEKING_*`) marcherait aujourd'hui et casserait au premier kind ajouté.
 */
export const HOUSING_OFFER_KINDS = ['RENT', 'FLATSHARE', 'SUBLET', 'TEMPORARY'] as const;
export const HOUSING_SEEKING_KINDS = ['SEEKING_HOUSING', 'SEEKING_FLATMATE'] as const;

export type HousingOfferKind = (typeof HOUSING_OFFER_KINDS)[number];

export function isHousingOfferKind(kind: string): kind is HousingOfferKind {
  return (HOUSING_OFFER_KINDS as readonly string[]).includes(kind);
}

/**
 * RÈGLE DURE (§2.2) : ce bandeau est renvoyé par l'API sur chaque liste et chaque
 * annonce, et affiché en permanence. Le texte est celui de la spec, au mot.
 */
export const HOUSING_SAFETY_BANNER =
  'Aucun versement avant visite ou vérification. Si une annonce demande un acompte à distance, signalez-la.';

/**
 * §2.1 : l'explication montrée à un L1 devant le formulaire grisé.
 *
 * Elle vit ici et non dans le front parce que c'est une PROMESSE de produit :
 * l'exigence L2 doit toujours s'expliquer, jamais se contenter d'un refus (00 §7.3).
 */
export const HOUSING_L2_EXPLANATION =
  'Publier un logement demande un numéro français vérifié — c’est ce qui protège tout le monde des fausses annonces.';

/**
 * §2.3 : un L0 pré-départ peut LIRE les annonces, jamais contacter. Le message
 * l'oriente vers le parrainage plutôt que de le laisser devant une porte fermée.
 */
export const HOUSING_L0_CONTACT_HINT =
  'Avant votre arrivée, passez par un parrain ou un accompagnant pour contacter une annonce. Vous pouvez en demander un dès maintenant.';

// ── Score de risque (§2.2) ───────────────────────────────────────────────────

/** Les six signaux du tableau du §2.2, dans son ordre. */
export const HOUSING_RISK_FLAGS = [
  'PRICE_FAR_BELOW_MEDIAN',
  'PRICE_OUT_OF_BOUNDS',
  'NEW_L2_MEMBER',
  'CONTACT_IN_DESCRIPTION',
  'SCAM_TERMS',
  'DUPLICATE_PHOTOS',
  'FIRST_LISTING',
] as const;

export type HousingRiskFlag = (typeof HOUSING_RISK_FLAGS)[number];

/** Poids du §2.2. Repli quand `system_settings['housing.risk_weights']` n'existe pas. */
export const HOUSING_RISK_WEIGHTS: Readonly<Record<HousingRiskFlag, number>> = {
  PRICE_FAR_BELOW_MEDIAN: 0.5,
  // Même poids : la spec met « ou hors bornes absolues configurées » sur la même ligne.
  PRICE_OUT_OF_BOUNDS: 0.5,
  NEW_L2_MEMBER: 0.2,
  CONTACT_IN_DESCRIPTION: 0.2,
  SCAM_TERMS: 0.4,
  DUPLICATE_PHOTOS: 0.5,
  FIRST_LISTING: 0.1,
};

/** §2.2 : « ≥ 0,7 : annonce non publiée, dossier priorité 1 ». */
export const HOUSING_RISK_BLOCK_THRESHOLD = 0.7;
/** §2.2 : « 0,4–0,7 : publiée avec dossier priorité 2 » et rappel renforcé. */
export const HOUSING_RISK_REVIEW_THRESHOLD = 0.4;
/** §2.2 : « Prix inférieur de 40 % à la médiane ». */
export const HOUSING_MEDIAN_RATIO = 0.6;
/** §2.2 : « Membre L2 depuis moins de 7 jours ». */
export const HOUSING_NEW_MEMBER_DAYS = 7;

/**
 * Bornes absolues de prix (§2.2, réglables par l'admin — §6).
 *
 * Repli volontairement large : elles attrapent l'invraisemblable (un studio à
 * 50 € ou à 20 000 €), pas le simplement bon marché, que la médiane traite mieux.
 */
export const HOUSING_PRICE_BOUNDS_DEFAULT = { minCents: 15_000, maxCents: 800_000 } as const;

/**
 * §2.2 : « Termes détectés par la modération IA (acompte, virement, Western Union,
 * mandat, « sans visite ») ».
 *
 * La spec NOMME les termes : ils sont donc une règle, pas une sortie de modèle, et
 * ils s'appliquent sans dépendre de la disponibilité du fournisseur IA. Le pipeline
 * complet du module 13 passe en plus, par l'événement `housing.published`.
 */
export const HOUSING_SCAM_TERM_PATTERN =
  /acompte|virement|western\s*union|moneygram|mandat(?:\s|$)|sans\s+visite|sans\s+la\s+visiter/i;

/** Lien externe, adresse email ou numéro dans la description (§2.2). */
export const HOUSING_CONTACT_PATTERNS: readonly RegExp[] = [
  /https?:\/\//i,
  /\bwww\.[a-z0-9-]+\.[a-z]{2,}/i,
  /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i,
  // Un numéro : au moins 9 chiffres, séparateurs usuels tolérés. « 3 chambres »
  // ne doit pas déclencher le signal, « 06 12 34 56 78 » doit le déclencher.
  /(?:\+?\d[\s.\-()]*){9,}/,
];

/** Ce que l'API dit d'une annonce au lecteur — jamais le score, jamais les drapeaux. */
export const HOUSING_CAUTION_LEVELS = ['STANDARD', 'REINFORCED'] as const;
export type HousingCautionLevel = (typeof HOUSING_CAUTION_LEVELS)[number];

// ── Codes d'erreur (§6.1) ────────────────────────────────────────────────────

export const HOUSING_ERROR_CODES = {
  MAX_ACTIVE_LISTINGS: 422,
  LISTING_UNDER_REVIEW: 422,
  RENEW_TOO_SOON: 422,
  PLAN_REQUIRED: 422,
} as const;

export type HousingErrorCode = keyof typeof HOUSING_ERROR_CODES;

export const HOUSING_ERROR_MESSAGES: Record<HousingErrorCode, string> = {
  MAX_ACTIVE_LISTINGS: `Vous avez déjà ${MAX_ACTIVE_HOUSING_LISTINGS} annonces en ligne. Mettez-en une en pause ou indiquez « Logement trouvé » avant d’en publier une autre.`,
  LISTING_UNDER_REVIEW:
    'Votre annonce est en vérification. Nous la relisons avant sa mise en ligne, vous serez prévenu·e.',
  RENEW_TOO_SOON: `Une annonce se renouvelle au plus une fois tous les ${HOUSING_RENEW_INTERVAL_DAYS} jours.`,
  PLAN_REQUIRED: 'Les alertes personnalisées font partie de la formule Premium.',
};

// ── Écriture (§2.1) ──────────────────────────────────────────────────────────

/** Jour civil. Une disponibilité est une DATE, pas un instant : aucun fuseau ici. */
const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .transform((value) => new Date(`${value}T00:00:00.000Z`));

const housingFields = {
  kind: z.enum(HousingKind),
  title: z.string().trim().min(10).max(120),
  description: z.string().trim().min(50).max(3000),
  cityId: uuidSchema,
  /** Quartier en texte libre : jamais d'adresse, jamais de coordonnée (§8.1). */
  district: z.string().trim().min(2).max(120).optional(),
  priceCents: z.number().int().min(0).max(100_000_000).nullable().optional(),
  isFurnished: z.boolean().optional(),
  availableFrom: dateOnlySchema.optional(),
  durationMonths: z.number().int().min(1).max(120).optional(),
  photoAssetIds: z.array(uuidSchema).max(HOUSING_PHOTOS_MAX),
};

/**
 * §2.1 : « `price_cents` obligatoire pour une offre, `null` accepté pour
 * TEMPORARY gratuit », « offre : au moins 1 » photo.
 *
 * Les deux règles sont ici et non dans le service : ce sont des contraintes de
 * FORMULAIRE, et le front doit pouvoir les afficher champ par champ.
 */
export const createHousingSchema = z
  .object(housingFields)
  .strict()
  .refine(
    (v) =>
      !isHousingOfferKind(v.kind) ||
      v.kind === 'TEMPORARY' ||
      (v.priceCents !== null && v.priceCents !== undefined),
    { path: ['priceCents'], message: 'Une offre doit indiquer un loyer.' },
  )
  .refine((v) => !isHousingOfferKind(v.kind) || v.photoAssetIds.length >= HOUSING_OFFER_PHOTOS_MIN, {
    path: ['photoAssetIds'],
    message: 'Une offre demande au moins une photo.',
  });

export type CreateHousing = z.infer<typeof createHousingSchema>;

/**
 * `kind` est absent de la modification : passer une offre en recherche viderait
 * ses photos et son prix de sens, et la médiane de sa ville aurait déjà compté
 * l'annonce dans l'autre catégorie. Republier est la bonne manière de le dire.
 */
export const updateHousingSchema = z
  .object({
    title: housingFields.title.optional(),
    description: housingFields.description.optional(),
    cityId: housingFields.cityId.optional(),
    district: housingFields.district,
    priceCents: housingFields.priceCents,
    isFurnished: housingFields.isFurnished,
    availableFrom: housingFields.availableFrom,
    durationMonths: housingFields.durationMonths,
    photoAssetIds: housingFields.photoAssetIds.optional(),
  })
  .strict()
  .refine((v) => Object.values(v).some((field) => field !== undefined), {
    message: 'Aucune modification.',
  });

export type UpdateHousing = z.infer<typeof updateHousingSchema>;

// ── Lecture (§2.4) ───────────────────────────────────────────────────────────

/**
 * Booléen de query string. `z.coerce.boolean()` est un piège ici : il rend `true`
 * pour la chaîne `"false"`, donc un filtre « non meublé » afficherait les meublés.
 */
const booleanQuerySchema = z.enum(['true', 'false']).transform((v) => v === 'true');

export const housingSortSchema = z.enum(['date', 'price']);
export type HousingSort = z.infer<typeof housingSortSchema>;

export const housingScopeSchema = z.enum(['all', 'mine']);
export type HousingScope = z.infer<typeof housingScopeSchema>;

export const housingQuerySchema = cursorQuerySchema
  .extend({
    kind: z.enum(HousingKind).optional(),
    cityId: uuidSchema.optional(),
    radiusKm: z.coerce.number().int().min(0).max(200).default(HOUSING_DEFAULT_RADIUS_KM),
    /** Budget maximum. Une annonce sans prix (TEMPORARY gratuit) y répond toujours. */
    maxPriceCents: z.coerce.number().int().min(0).optional(),
    isFurnished: booleanQuerySchema.optional(),
    /** « Disponible à partir de » : je cherche un logement libre à cette date. */
    availableFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    /** Durée souhaitée : je veux pouvoir rester au moins ce nombre de mois. */
    minDurationMonths: z.coerce.number().int().min(1).max(120).optional(),
    sort: housingSortSchema.default('date'),
    /** `mine` est l'écran « Mes annonces » : l'auteur y voit aussi ses annonces en pause. */
    scope: housingScopeSchema.default('all'),
  })
  .strict();

export type HousingQuery = z.infer<typeof housingQuerySchema>;

// ── Alertes (§2.4 et §6.4) ───────────────────────────────────────────────────

/**
 * Critères d'une alerte. Le même vocabulaire que la recherche, à dessein : une
 * alerte est une recherche mémorisée, et deux vocabulaires différents finiraient
 * par ne plus décrire les mêmes résultats.
 */
export const alertCriteriaSchema = z
  .object({
    kind: z.enum(HousingKind).optional(),
    cityId: uuidSchema.optional(),
    radiusKm: z.number().int().min(0).max(200).optional(),
    maxPriceCents: z.number().int().min(0).optional(),
    isFurnished: z.boolean().optional(),
    sector: z.string().trim().min(2).max(80).optional(),
    contractType: z.string().trim().min(2).max(80).optional(),
  })
  .strict()
  .refine((v) => Object.values(v).some((field) => field !== undefined), {
    message: 'Une alerte a besoin d’au moins un critère.',
  });

export type AlertCriteria = z.infer<typeof alertCriteriaSchema>;

export const createAlertSchema = z
  .object({
    kind: z.enum(AlertKind),
    criteria: alertCriteriaSchema,
    isActive: z.boolean().default(true),
  })
  .strict();

export type CreateAlert = z.infer<typeof createAlertSchema>;

export const updateAlertSchema = z
  .object({ criteria: alertCriteriaSchema.optional(), isActive: z.boolean().optional() })
  .strict()
  .refine((v) => v.criteria !== undefined || v.isActive !== undefined, {
    message: 'Aucune modification.',
  });

export type UpdateAlert = z.infer<typeof updateAlertSchema>;

/** §2.4 : « regroupement : au plus une notification par heure ». */
export const ALERT_DISPATCH_INTERVAL_MS = 60 * 60 * 1000;
