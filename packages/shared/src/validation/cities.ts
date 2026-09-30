import { z } from 'zod';
import { CityTipKind, OccupationStatus, Phase } from '../enums/generated.js';
import { cursorQuerySchema, uuidSchema } from './pagination.js';
import { DEFAULT_RADIUS_KM } from './events.js';

/**
 * Villes et membres — 09-villes-agenda.md §2 et §5.
 *
 * Le seuil de 3 vit ICI, en constante partagée, et non dans une requête SQL :
 * c'est la RÈGLE DURE du §2.1 (« jamais en dessous de 3 membres pour un filtre
 * pays »), elle s'applique à la carte ET à la répartition par pays de la fiche
 * ville, et une valeur recopiée dans deux requêtes finit par ne plus être la même.
 */

/** RÈGLE DURE §2.1 : en dessous de ce nombre, on renvoie « moins de 3 », jamais le compte. */
export const CITY_COUNT_PRIVACY_THRESHOLD = 3;

/** §2.4 : nouveaux arrivants des 14 derniers jours. */
export const NEWCOMER_WINDOW_DAYS = 14;

/**
 * 02-referentiels.md §2.2 : une ville « passe active quand l'équipe le décide, en
 * général à 20 membres ».
 *
 * CE N'EST PAS UN SEUIL D'ACTIVATION, et la nuance est tout le sujet : rien
 * n'active une ville automatiquement — §2.2 en fait un jugement humain, et
 * l'activation crée un réseau CITY et y inscrit des membres, ce qu'aucune route ne
 * défait. Ce nombre est le seuil à partir duquel la tâche hebdomadaire
 * `city.activation_suggest` (02 §7) SIGNALE la ville à l'équipe, qui décide.
 *
 * Il vit ici plutôt que dans `system_settings` parce que T3 §… n'en donne AUCUNE
 * clé : la table des paramètres réglables du seed ne le liste pas, là où elle liste
 * `community.interest_threshold_members`. Le jour où l'équipe veut le régler sans
 * déploiement, c'est une clé à ajouter à T3 — pas une valeur à deviner ici.
 */
export const CITY_ACTIVATION_SUGGEST_MEMBERS = 20;

/** §2.3 : « Calculé à la requête, cache 5 minutes. » */
export const CITY_DESKS_CACHE_MS = 5 * 60 * 1000;

/** §2.3, par kind (le tableau des règles). */
export const CITY_TIP_MAX_BODY: Readonly<Record<CityTipKind, number>> = {
  TIP: 500,
  SHOP: 500,
  /** « Libellé + `amount_cents` » : un libellé, pas un texte. */
  BUDGET: 200,
  TESTIMONY: 1000,
};

/** Codes d'erreur propres à la fiche ville. */
export const CITY_ERROR_CODES = {
  /** §2.3 : une ville inactive n'a « ni réseau, ni carte, ni fiche » (02 §2.2). */
  CITY_INACTIVE: 404,
} as const;

export type CityErrorCode = keyof typeof CITY_ERROR_CODES;

export const CITY_ERROR_MESSAGES: Record<CityErrorCode, string> = {
  CITY_INACTIVE: 'Cette ville n’a pas encore de fiche.',
};

// ── Lecture ──────────────────────────────────────────────────────────────────

export const cityMapQuerySchema = z
  .object({ countryId: uuidSchema.optional() })
  .strict();

export type CityMapQuery = z.infer<typeof cityMapQuerySchema>;

/**
 * Annuaire des membres (§2.2). Tri imposé : disponibilité pour aider d'abord,
 * puis ancienneté — il n'y a donc PAS de paramètre de tri.
 */
export const membersQuerySchema = cursorQuerySchema
  .extend({
    cityId: uuidSchema.optional(),
    radiusKm: z.coerce.number().int().min(0).max(200).default(DEFAULT_RADIUS_KM),
    originCountryId: uuidSchema.optional(),
    phase: z.enum(Phase).optional(),
    occupationStatus: z.enum(OccupationStatus).optional(),
    skillId: uuidSchema.optional(),
    languageId: uuidSchema.optional(),
    availableToHelp: z
      .enum(['true', 'false'])
      .optional()
      .transform((v) => (v === undefined ? undefined : v === 'true')),
  })
  .strict();

export type MembersQuery = z.infer<typeof membersQuerySchema>;

export const cityTipsQuerySchema = cursorQuerySchema
  .extend({ kind: z.enum(CityTipKind).optional() })
  .strict();

export type CityTipsQuery = z.infer<typeof cityTipsQuerySchema>;

// ── Écriture ─────────────────────────────────────────────────────────────────

/**
 * Contribution à la fiche ville (§2.3).
 *
 * `amountCents` n'est accepté QUE pour `BUDGET` : ailleurs, il n'a pas de sens et
 * la médiane affichée en tête de section se mettrait à compter des montants qui
 * ne sont pas des budgets. Un montant ignoré en silence serait pire — le membre
 * croirait l'avoir saisi.
 */
export const createCityTipSchema = z
  .object({
    kind: z.enum(CityTipKind),
    body: z.string().trim().min(10).max(1000),
    amountCents: z.number().int().min(0).max(100_000_000).optional(),
    /** §2.3 : une découverte gardée devient un tip, avec sa story d'origine. */
    sourceStoryId: uuidSchema.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const max = CITY_TIP_MAX_BODY[value.kind];
    if (value.body.length > max) {
      ctx.addIssue({ code: 'too_big', path: ['body'], maximum: max, type: 'string', inclusive: true });
    }
    if (value.kind === 'BUDGET' && value.amountCents === undefined) {
      ctx.addIssue({ code: 'custom', path: ['amountCents'], message: 'Un budget porte un montant.' });
    }
    if (value.kind !== 'BUDGET' && value.amountCents !== undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['amountCents'],
        message: 'Seul un budget porte un montant.',
      });
    }
  });

export type CreateCityTip = z.infer<typeof createCityTipSchema>;

export const updateCityTipSchema = z
  .object({
    body: z.string().trim().min(10).max(1000).optional(),
    amountCents: z.number().int().min(0).max(100_000_000).optional(),
  })
  .strict()
  .refine((v) => v.body !== undefined || v.amountCents !== undefined, {
    message: 'Aucune modification.',
  });

export type UpdateCityTip = z.infer<typeof updateCityTipSchema>;

/**
 * Compteur exposé pour une ville et un pays (§2.1).
 *
 * `count: null` + `belowThreshold: true` est la forme de « moins de 3 » : le
 * front a besoin de savoir qu'il y a QUELQU'UN sans savoir combien. Renvoyer 0
 * aurait été un mensonge, et renvoyer 2 aurait identifié la personne.
 */
export interface CityCount {
  readonly count: number | null;
  readonly belowThreshold: boolean;
}

export function cityCount(raw: number, threshold = CITY_COUNT_PRIVACY_THRESHOLD): CityCount {
  if (raw <= 0) return { count: 0, belowThreshold: false };
  return raw < threshold ? { count: null, belowThreshold: true } : { count: raw, belowThreshold: false };
}
