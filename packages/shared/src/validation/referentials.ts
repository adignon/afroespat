import { z } from 'zod';
import {
  getExampleNumber,
  parsePhoneNumberFromString,
  type CountryCode,
} from 'libphonenumber-js';
/**
 * L'attribut `with { type: 'json' }` NE MARCHE PAS ICI, et ce n'est pas un
 * oubli : `libphonenumber-js/examples.mobile.json` n'est pas un fichier JSON mais
 * un MODULE JavaScript qui l'exporte — la bibliothèque le dit en tête du fichier,
 * « a workaround for a bug in web browsers' native ES6 importing system ». Node
 * refuse alors l'attribut (`ERR_IMPORT_ATTRIBUTE_TYPE_INCOMPATIBLE`).
 */
import exemplesMobiles from 'libphonenumber-js/examples.mobile.json';
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

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ GLOBALISER UNE COMPÉTENCE — LE SEUL GESTE QUI EFFACE SON AUTEUR           ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « de nouvelles compétences que les administrateurs peuvent
 * globaliser […] quand c'est globalisé tout le monde y a accès. »
 *
 * `skills.created_by_user_id` à NULL VEUT DIRE « à tout le monde » : c'est déjà
 * l'état des soixante compétences semées. Globaliser, c'est donc effacer cette
 * colonne — pas poser un drapeau de plus, qui ferait deux vérités à tenir
 * d'accord.
 *
 * Le champ est un BOOLÉEN À SENS UNIQUE : `true` globalise. Il n'y a pas de
 * `false` qui rendrait une compétence à son auteur, et c'est voulu — d'autres
 * membres l'ont peut-être déjà choisie entre-temps, et la leur retirer serait
 * modifier leur profil sans qu'ils le sachent. REMONTÉ : si le porteur veut
 * pouvoir dé-globaliser, il faudra décider ce qu'on fait de ces profils.
 */
export const updateTaggedSchema = createTaggedSchema
  .partial()
  .extend({ global: z.literal(true).optional() })
  .refine(
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
  /**
   * Le nombre de chiffres d'un numéro NATIONAL dans ce pays, ou `null` quand le
   * référentiel ne le dit pas encore.
   *
   * Le porteur : « il faut la validation du numéro selon le pays. Backend et
   * frontend aussi pour valider le format. » L'écran en a besoin pour refuser
   * AVANT d'envoyer un SMS ; le serveur applique la même règle, lue de la même
   * colonne — une seule vérité, et c'est le référentiel qui la porte.
   */
  phoneNationalLength: z.number().int().positive().nullable(),
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

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ UN NUMÉRO EST-IL BIEN FORMÉ POUR SON PAYS ? — LIBPHONENUMBER TRANCHE      ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « il faut la validation du numéro selon le pays. Backend et
 * frontend aussi pour valider le format », puis : « pour la validation utilise
 * les librairies de validation de lib number de Google ».
 *
 * ── POURQUOI LA TABLE ÉCRITE À LA MAIN A ÉTÉ JETÉE ────────────────────────
 *
 * Une première version posait la longueur attendue dans le référentiel, pays par
 * pays. Elle marchait, et elle était fausse par nature : un plan de numérotation
 * ne tient pas en un nombre. Le Bénin le prouve — `libphonenumber` sait que ses
 * mobiles valent `01` + huit chiffres depuis 2023, et que `97123442` n'est plus
 * valide. Aucune table tenue à la main n'aurait su ça.
 *
 * ── CE QUE LA MAQUETTE DESSINE EST L'ANCIEN FORMAT ───────────────────────
 *
 * Les planches écrivent « 97 12 34 42 » et « +229 •• •• •• 42 » : huit chiffres,
 * c'est-à-dire le Bénin d'AVANT 2023. REMONTÉ au porteur — l'invite du champ et
 * l'exemple du masque sont à reprendre, et ce lot ne les change pas de lui-même.
 *
 * ── LA MÊME FONCTION DES DEUX CÔTÉS ──────────────────────────────────────
 *
 * L'écran s'en sert pour griser « Recevoir le code » ; le serveur pour refuser.
 * Deux implémentations divergeraient, et c'est le membre qui paierait l'écart.
 */
export function numeroValide(saisie: string, iso2: string): boolean {
  const lu = parsePhoneNumberFromString(saisie, iso2.toUpperCase() as CountryCode);
  return lu !== undefined && lu.isValid();
}

/**
 * LE NUMÉRO AU FORMAT INTERNATIONAL — « il faut que ce soit le format
 * international qu'il faut enregistrer ».
 *
 * `null` quand la saisie n'est pas un numéro valide dans ce pays : rendre une
 * chaîne quand même ferait enregistrer un numéro que personne ne peut appeler,
 * et deux écritures du même numéro créeraient deux comptes — ce que
 * `e164Schema` dit déjà vouloir empêcher.
 *
 * La bibliothèque retire le zéro de service, accepte les espaces, les points et
 * les tirets, et accepte aussi une saisie DÉJÀ internationale : c'est exactement
 * ce que `normalizePhone` faisait à la main, en moins complet.
 */
export function enFormatInternational(saisie: string, iso2: string): string | null {
  const lu = parsePhoneNumberFromString(saisie, iso2.toUpperCase() as CountryCode);
  return lu !== undefined && lu.isValid() ? lu.number : null;
}

/**
 * L'EXEMPLE OFFICIEL D'UN NUMÉRO DE CE PAYS, écrit comme on l'écrit sur place.
 *
 * Il remplace l'invite « 97 12 34 42 » de la planche, qui est un numéro béninois
 * d'avant la renumérotation de 2023 — donc un exemple que le serveur refuse
 * désormais. L'exemple vient des métadonnées de `libphonenumber` : il est juste
 * par construction, et il suit le pays choisi.
 *
 * Chaîne vide si le pays est inconnu de la bibliothèque : une invite absente vaut
 * mieux qu'une invite fausse.
 */
export function exempleNational(iso2: string): string {
  const exemple = getExampleNumber(iso2.toUpperCase() as CountryCode, exemplesMobiles);
  return exemple === undefined ? '' : exemple.formatNational();
}

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LE NUMÉRO MASQUÉ, POUR L'ÉCRAN DU CODE                                    ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « Au niveau de la page de l'OTP, le numéro n'est pas celui qui est
 * renseigné. » Il ne l'était pas : la planche écrit « +229 •• •• •• 42 » EN
 * CLAIR, et cet exemple s'affichait quel que soit le numéro tapé.
 *
 * ── POURQUOI LE MASQUE SE CONSTRUIT ICI ET NON AU SERVEUR ────────────────
 *
 * Le serveur sait masquer — `GET /me` rend `phones[].masked` — mais il ne répond
 * qu'à un membre AUTHENTIFIÉ, et à cette étape le code n'est pas encore vérifié.
 * Le seul qui connaisse le numéro est l'écran qui vient de le recevoir.
 *
 * ── LA FORME EST CELLE DU SERVEUR, PAS UNE AUTRE ─────────────────────────
 *
 * Indicatif, des paires masquées, et les DEUX DERNIERS chiffres en clair :
 * « +229 •• •• •• 42 ». C'est exactement ce que la planche dessine et ce que le
 * serveur rend ailleurs. Deux masques différents dans la même application
 * feraient douter le membre de ce qu'il lit.
 */
export function masqueNumero(saisie: string, iso2: string): string {
  const lu = parsePhoneNumberFromString(saisie, iso2.toUpperCase() as CountryCode);
  if (lu === undefined) return '';
  const national = lu.nationalNumber;
  const visibles = national.slice(-2);
  const caches = Math.max(0, national.length - 2);
  const paires = Array.from({ length: Math.ceil(caches / 2) }, () => '••').join(' ');
  return `+${lu.countryCallingCode} ${paires} ${visibles}`.replace(/\s+/g, ' ').trim();
}

/**
 * Une LANGUE, telle que `GET /v1/places/languages` la renvoie.
 *
 * RELEVÉ SUR L'API QUI TOURNE, pas déduit du service : trois colonnes — `id`,
 * `code` (ISO 639-1 : `fr`, `en`, `de`…) et `nameFr`. La route n'en sert pas
 * d'autres, et `.strict()` le fige : une colonne qui apparaîtrait sans que le
 * front la lise ferait échouer la frontière plutôt que de passer inaperçue.
 *
 * Ces schémas N'EXISTAIENT PAS : les deux routes étaient servies et personne ne
 * les appelait. Elles sont branchées depuis que le porteur a demandé « l'ajout de
 * compétence langue ».
 */
export const placesLanguageSchema = z
  .object({
    id: z.string().uuid(),
    code: z.string(),
    nameFr: z.string(),
  })
  .strict();
export type PlacesLanguage = z.infer<typeof placesLanguageSchema>;

export const placesLanguagesResponseSchema = pageSchema(placesLanguageSchema);

/**
 * Une COMPÉTENCE, telle que `GET /v1/places/skills` la renvoie.
 *
 * `category` regroupe les compétences (« Bâtiment », « Bureautique »…) et le
 * service trie DESSUS avant `nameFr`. Elle est donc servie, et le front la lit :
 * c'est ce qui permet de montrer d'où vient une suggestion sans inventer de
 * classement.
 */
export const placesSkillSchema = z
  .object({
    id: z.string().uuid(),
    nameFr: z.string(),
    category: z.string().nullable(),
  })
  .strict();
export type PlacesSkill = z.infer<typeof placesSkillSchema>;

export const placesSkillsResponseSchema = pageSchema(placesSkillSchema);

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
