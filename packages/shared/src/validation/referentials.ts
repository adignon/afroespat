import { z } from 'zod';
import { cursorQuerySchema } from './pagination.js';

/**
 * Administration des référentiels — 02-referentiels.md §4.2.
 *
 * `CONTENT_ADMIN` tient ces listes : pays, villes, langues, compétences, métiers.
 * Ce sont des listes FERMÉES (§2.3) — un membre ne crée jamais une valeur, il peut
 * la suggérer — donc quelqu'un doit pouvoir les tenir, et c'est ce que ces schémas
 * décrivent.
 */

/** Les trois listes simples, qui partagent leur forme. */
export const REFERENTIAL_LISTS = ['languages', 'skills', 'professions'] as const;
export type ReferentialList = (typeof REFERENTIAL_LISTS)[number];

const nameFr = z.string().trim().min(2).max(80);
const category = z.string().trim().min(2).max(40);

export const refListQuerySchema = z.object({
  /** Par défaut on montre TOUT, actif ou non : c'est un écran d'administration. */
  active: z.enum(['true', 'false']).optional(),
  q: z.string().trim().min(1).max(60).optional(),
});
export type RefListQuery = z.infer<typeof refListQuerySchema>;

export const createLanguageSchema = z.object({
  /** Code ISO 639-1, ou 639-3 pour les langues qui n'ont pas de code à deux lettres. */
  code: z.string().trim().min(2).max(8).toLowerCase(),
  nameFr,
});
export type CreateLanguage = z.infer<typeof createLanguageSchema>;

export const updateLanguageSchema = z.object({ nameFr });
export type UpdateLanguage = z.infer<typeof updateLanguageSchema>;

/**
 * Compétences et métiers : mêmes colonnes, donc même schéma.
 *
 * `isActive` est modifiable, contrairement aux langues — §2.3 veut qu'« une entrée
 * `is_active = false` reste affichée sur les profils qui l'ont déjà, mais n'est plus
 * proposée », et seules ces deux tables portent la colonne.
 */
export const createTaggedSchema = z.object({
  nameFr,
  category: category.optional(),
  isActive: z.boolean().default(true),
});
export type CreateTagged = z.infer<typeof createTaggedSchema>;

export const updateTaggedSchema = createTaggedSchema.partial().refine(
  (v) => Object.keys(v).length > 0,
  { message: 'Indiquez au moins un champ à modifier.' },
);
export type UpdateTagged = z.infer<typeof updateTaggedSchema>;

// ── Pays ───────────────────────────────────────────────────────────────────

export const COUNTRY_KINDS = ['ORIGIN', 'DESTINATION', 'BOTH'] as const;

export const createCountrySchema = z.object({
  iso2: z.string().trim().length(2).toUpperCase(),
  nameFr,
  /** Indicatif au format international, `+` compris. */
  dialCode: z.string().trim().regex(/^\+\d{1,4}$/, 'Indicatif au format « +229 ».'),
  kind: z.enum(COUNTRY_KINDS),
  sortOrder: z.number().int().min(0).max(999).default(0),
});
export type CreateCountry = z.infer<typeof createCountrySchema>;

/**
 * `isActive` est ABSENT de la modification, et ce n'est pas un oubli : activer un
 * pays crée son réseau et y inscrit les membres (§2.2), donc c'est une route à part
 * qui le fait, tracée comme telle. Un `PATCH` qui pourrait l'activer au passage
 * rendrait cet effet invisible dans le journal d'audit.
 */
export const updateCountrySchema = z
  .object({
    nameFr: nameFr.optional(),
    dialCode: z.string().trim().regex(/^\+\d{1,4}$/).optional(),
    kind: z.enum(COUNTRY_KINDS).optional(),
    sortOrder: z.number().int().min(0).max(999).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: 'Indiquez au moins un champ à modifier.',
  });
export type UpdateCountry = z.infer<typeof updateCountrySchema>;

// ── Villes ─────────────────────────────────────────────────────────────────

/**
 * Les bornes des coordonnées sont celles du globe, et la colonne est en
 * `Decimal(9,6)` : six décimales, soit une dizaine de centimètres. Elles servent au
 * tri par proximité (haversine) et au compteur « à moins de 30 km », jamais à
 * localiser un membre — aucune position individuelle n'est collectée.
 */
const latitude = z.number().min(-90).max(90);
const longitude = z.number().min(-180).max(180);

export const createCitySchema = z.object({
  countryId: z.string().uuid(),
  name: z.string().trim().min(2).max(80),
  /** Minuscules, chiffres et tirets : c'est une part d'URL. */
  slug: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Minuscules, chiffres et tirets seulement.'),
  region: z.string().trim().min(2).max(80).optional(),
  latitude,
  longitude,
  postalPrefix: z.string().trim().min(1).max(10).optional(),
});
export type CreateCity = z.infer<typeof createCitySchema>;

export const updateCitySchema = z
  .object({
    countryId: z.string().uuid().optional(),
    name: z.string().trim().min(2).max(80).optional(),
    region: z.string().trim().min(2).max(80).optional(),
    latitude: latitude.optional(),
    longitude: longitude.optional(),
    postalPrefix: z.string().trim().min(1).max(10).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: 'Indiquez au moins un champ à modifier.',
  });
export type UpdateCity = z.infer<typeof updateCitySchema>;

export const citiesAdminQuerySchema = cursorQuerySchema.extend({
  countryId: z.string().uuid().optional(),
  active: z.enum(['true', 'false']).optional(),
  q: z.string().trim().min(1).max(60).optional(),
});
export type CitiesAdminQuery = z.infer<typeof citiesAdminQuerySchema>;

/**
 * La FUSION est irréversible (§2.2), d'où la confirmation explicite.
 *
 * Taper le slug de la ville absorbée est la seule confirmation qui ne se clique pas
 * par réflexe : elle oblige à lire ce qu'on est en train de faire. Un booléen
 * `confirm: true` aurait la même force qu'un bouton, c'est-à-dire aucune.
 */
export const mergeCitySchema = z.object({
  targetCityId: z.string().uuid(),
  confirmSlug: z.string().trim().min(2).max(80),
  reason: z.string().trim().min(10).max(500),
});
export type MergeCity = z.infer<typeof mergeCitySchema>;

export const refReasonSchema = z.object({ reason: z.string().trim().min(10).max(500) });
export type RefReason = z.infer<typeof refReasonSchema>;

/**
 * Import CSV de villes — `nom, région, latitude, longitude, pays` (§4.2).
 *
 * Le CSV arrive en TEXTE dans le corps JSON plutôt qu'en `multipart` : l'API n'a
 * aucun autre téléversement de fichier, et en ajouter un pour cette seule route
 * demanderait un intercepteur, une limite de taille et un stockage temporaire — pour
 * un contenu qui tient dans une chaîne. Le jour où l'on importe des fichiers de
 * plusieurs mégaoctets, ce choix se revoit.
 */
export const importCitiesSchema = z.object({
  csv: z.string().min(1).max(200_000),
  /** Sans cela on ne fait que VALIDER et rendre le rapport : rien n'est écrit. */
  apply: z.boolean().default(false),
});
export type ImportCities = z.infer<typeof importCitiesSchema>;
