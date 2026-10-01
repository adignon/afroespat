import { z } from 'zod';
import { CountryKind } from '../enums/generated.js';
import { cursorQuerySchema, pageSchema } from './pagination.js';

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

// ── Lecture publique : `GET /v1/places/…` ────────────────────────────────────
//
// Les schémas ci-dessus décrivent l'ADMINISTRATION des référentiels (§4.2). Ceux
// qui suivent décrivent ce que le côté MEMBRE en lit — les listes servies par
// `PlacesController`, que l'inscription consomme dès le premier écran.
//
// Ce sont des schémas de RÉPONSE, validés à la frontière par le client
// (`apps/web/src/lib/api`). Ils vivent ICI, et non dans le front, parce que §4 fait
// de `packages/shared` la source unique : un schéma de réponse recopié côté client
// est une deuxième définition, qui divergera le jour où la route gagne un champ.
//
// Il manque encore `languages`, `skills` et `professions` — trois listes de la même
// forme, servies par le même contrôleur. Elles ne sont pas écrites ici parce que
// rien ne les consomme encore, et un schéma que personne n'emploie est un schéma que
// personne ne corrige. À ajouter en branchant l'écran du profil (O04).

/** Un pays, tel que `GET /v1/places/countries` le renvoie. */
export const placesCountrySchema = z.object({
  id: z.string().uuid(),
  iso2: z.string().length(2),
  nameFr: z.string(),
  /** `+33`, `+229`… La saisie du numéro s'y appuie (voir `normalizePhone`). */
  dialCode: z.string(),
  kind: z.enum(CountryKind),
});
export type PlacesCountry = z.infer<typeof placesCountrySchema>;

export const placesCountriesResponseSchema = pageSchema(placesCountrySchema);

/**
 * Une ville, telle que `GET /v1/places/cities` la renvoie.
 *
 * `isActive` est RENVOYÉ et doit l'être : 02 §2.2 rend une ville inactive
 * sélectionnable à l'inscription — le membre doit pouvoir dire où il vit — alors
 * qu'elle n'a « ni réseau, ni carte, ni fiche ». L'écran a besoin de la distinction,
 * et la route s'appelle donc avec `activeOnly=false` à l'inscription. Au lancement
 * AUCUNE ville n'est active (elles le deviennent vers 20 membres) : filtrer sur
 * l'activité rendrait une liste vide, et l'écran paraîtrait cassé.
 */
export const placesCitySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  region: z.string().nullable(),
  isActive: z.boolean(),
  memberCount: z.number().int().nonnegative(),
});
export type PlacesCity = z.infer<typeof placesCitySchema>;

export const placesCitiesResponseSchema = pageSchema(placesCitySchema);

// ── La vue d'ÉQUIPE d'une ville — `GET /v1/admin/ref/cities` (D08) ──────────
//
// DISTINCTE de `placesCitySchema`, et il faut dire pourquoi plutôt que de
// réutiliser l'autre : ce ne sont pas les mêmes colonnes. La route de membre rend
// six champs, celle d'équipe en rend douze — le pays résolu, les coordonnées, la
// date d'activation, la cible de fusion et `isPilot`. Les confondre ferait
// dépouiller en silence la moitié de ce que l'écran D08 dessine.
//
// RELEVÉ SUR L'API QUI TOURNE, avec une vraie session d'équipe, et non déduit du
// service : vingt villes, `region` toujours renseignée dans l'échantillon mais
// `String?` au schéma Prisma (donc nullable ici — on suit le CONTRAT, pas
// l'échantillon), `activatedAt` nul sur les villes jamais ouvertes,
// `mergedIntoCityId` nul partout dans l'échantillon et nullable au schéma.

/**
 * Une ville vue par l'équipe.
 *
 * ─── `.strict()`, ET C'EST ICI QU'IL SE JUSTIFIE LE MIEUX ──────────────────
 *
 * Sans lui, zod DÉPOUILLE les champs inconnus en silence — et c'est exactement
 * l'histoire de `isPilot` : l'API le rendait déjà, et rien ne l'affichait. Un
 * schéma permissif aurait reproduit l'oubli une couche plus bas, sans un mot.
 * Avec `.strict()`, la prochaine colonne ajoutée à cette route ARRÊTE l'écran au
 * lieu de disparaître — ce qui est le comportement qu'on veut d'une frontière.
 *
 * `isPilot` est DÉRIVÉ par le serveur (`PILOT_CITY_SLUG` de `@app/shared`,
 * « paris ») et non stocké. Il est donc lu, jamais recalculé côté écran :
 * comparer un slug au constant dans le front ferait une deuxième source de
 * vérité pour une décision de lancement.
 */
export const adminCitySchema = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
    slug: z.string(),
    region: z.string().nullable(),
    latitude: z.number(),
    longitude: z.number(),
    isActive: z.boolean(),
    memberCount: z.number().int().nonnegative(),
    /** Nul tant que la ville n'a jamais été ouverte (02 §4.2). */
    activatedAt: z.string().datetime().nullable(),
    /** Non nul sur un DOUBLON déjà fusionné — la troisième ligne de D08. */
    mergedIntoCityId: z.string().uuid().nullable(),
    country: z
      .object({ id: z.string().uuid(), iso2: z.string().length(2), nameFr: z.string() })
      .strict(),
    /** La ville pilote, dérivée par le serveur. Lue, jamais recalculée. */
    isPilot: z.boolean(),
  })
  .strict();
export type AdminCity = z.infer<typeof adminCitySchema>;

export const adminCitiesResponseSchema = pageSchema(adminCitySchema);
export type AdminCitiesResponse = z.infer<typeof adminCitiesResponseSchema>;
