import { z } from 'zod';
import { SearchSubjectType } from '../enums/generated.js';
import { cursorQuerySchema, uuidSchema } from './pagination.js';

/**
 * Recherche — 11-recherche.md.
 *
 * SOURCE UNIQUE (00 §4) : les bornes de la requête (2 caractères pour chercher, 3
 * pour suggérer, 6 suggestions) valent pour l'API et pour la barre haute. Le front
 * doit pouvoir désactiver le bouton avec la MÊME borne que celle qui refusera la
 * requête, sinon l'écran propose une action que le serveur rejette.
 *
 * Ce qui n'est PAS ici, et volontairement : la construction du `tsquery`. Le
 * `tsvector` est maintenu par un déclencheur PostgreSQL (migration
 * 20260927050000) avec `to_tsvector('french', immutable_unaccent(…))`, pondéré A
 * sur le titre et B sur le corps. La requête doit passer par les MÊMES fonctions,
 * donc elle s'écrit en SQL, dans le service. Recomposer ici un analyseur français
 * en TypeScript produirait deux définitions du mot « sécurité » — et la seconde
 * finirait par ne plus trouver ce que la première a indexé.
 */

// ── Bornes du §2.3 ────────────────────────────────────────────────────────────

/** « Minimum 2 caractères. » */
export const SEARCH_MIN_QUERY_LENGTH = 2;
/** « Suggestions dès 3 caractères (titres par préfixe, 6 max, mis en cache). » */
export const SUGGEST_MIN_QUERY_LENGTH = 3;
export const SUGGEST_MAX_RESULTS = 6;
export const SUGGEST_CACHE_TTL_MS = 60_000;
/** « onglet “Tout” avec les 3 meilleurs de chaque type et compteurs ». */
export const SEARCH_GROUP_PREVIEW_SIZE = 3;
/** §2.2 : « boost de fraîcheur léger (documents de moins de 30 jours) ». */
export const SEARCH_FRESHNESS_DAYS = 30;
/** Le poids ajouté au rang. « Léger » : il départage, il ne renverse pas. */
export const SEARCH_FRESHNESS_BOOST = 0.15;
/** §2.2 : « boost local (même ville) appliqué au classement, pas au filtrage ». */
export const SEARCH_LOCAL_BOOST = 0.25;
/** Un rayon par défaut cohérent avec le logement et l'agenda. */
export const SEARCH_DEFAULT_RADIUS_KM = 30;
export const SEARCH_MAX_QUERY_LENGTH = 120;

/**
 * §2.1, « Jamais indexés » — la liste au mot.
 *
 * Elle est une CONSTANTE et non un commentaire parce qu'un test de règle dure s'y
 * adosse : « les parcours et les messages ne sont jamais indexés » (§6). Un
 * `subject_type` ajouté un jour à `SearchSubjectType` pour l'une de ces sources
 * ferait tomber ce test, ce qui est exactement l'effet voulu.
 */
export const SEARCH_NEVER_INDEXED = [
  'JOURNEY',
  'JOURNEY_STEP',
  'STORY',
  'BOOKMARK',
  'MESSAGE',
  'POST',
  'NOTE',
  'CHECKLIST',
  'INVITE_ONLY_COMMUNITY',
] as const;

/** §2.1 : les états de source qui donnent droit à un document, par type. */
export const SEARCH_HELP_RESOLVED_MAX_AGE_DAYS = 90;
/** « guides PUBLISHED / FLAGGED < 30 j ». */
export const SEARCH_GUIDE_FLAGGED_MAX_AGE_DAYS = 30;
/** §2.1 : « corps + 3 premières réponses » pour un sujet de réseau. */
export const SEARCH_TOPIC_REPLIES_INDEXED = 3;
/** Le corps indexé est tronqué : un guide de 40 000 signes n'améliore aucun rang. */
export const SEARCH_BODY_MAX_CHARS = 8_000;

// ── Normalisation (§2.4) ──────────────────────────────────────────────────────

/**
 * Mots vides français. §2.4 : le zéro résultat se juge « après suppression des
 * mots vides » — sans quoi « le » et « de » compteraient comme des termes et une
 * recherche de deux mots vides serait enregistrée comme une attente produit.
 *
 * Liste COURTE et volontairement : elle sert à décider si la requête a encore un
 * terme utile, pas à remplacer le dictionnaire `french` de PostgreSQL, qui fait
 * déjà ce travail dans le `tsvector`.
 */
export const FRENCH_STOPWORDS: readonly string[] = [
  'a', 'ai', 'au', 'aux', 'avec', 'ce', 'ces', 'dans', 'de', 'des', 'du', 'elle',
  'en', 'est', 'et', 'eux', 'il', 'ils', 'je', 'la', 'le', 'les', 'leur', 'lui',
  'ma', 'mais', 'me', 'mes', 'mon', 'ne', 'nos', 'notre', 'nous', 'on', 'ou',
  'par', 'pas', 'pour', 'qu', 'que', 'qui', 'sa', 'se', 'ses', 'son', 'sur',
  'ta', 'te', 'tes', 'toi', 'ton', 'tu', 'un', 'une', 'vos', 'votre', 'vous', 'y',
];

/**
 * La forme NORMALISÉE d'une requête : minuscules, sans accents, espaces réduits.
 *
 * C'est elle qui est stockée dans `search_zero_results.query_normalized`, et c'est
 * ce qui permet d'agréger « Sécurité Sociale » et « securite sociale » sur la même
 * ligne. La suppression des accents emploie la décomposition Unicode — même
 * résultat que `unaccent` sur du texte français, sans dépendre de la base.
 */
export function normalizeQuery(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Les termes utiles d'une requête : normalisés, sans mots vides, sans doublons. */
export function meaningfulTerms(raw: string): string[] {
  const seen = new Set<string>();
  for (const token of normalizeQuery(raw).split(' ')) {
    if (token.length === 0) continue;
    if (FRENCH_STOPWORDS.includes(token)) continue;
    seen.add(token);
  }
  return [...seen];
}

/**
 * La requête a-t-elle encore un terme après les mots vides ?
 *
 * Décide si un zéro résultat doit être ENREGISTRÉ (§2.4). « de la » ne dit rien
 * d'un guide manquant ; l'enregistrer polluerait la revue produit.
 */
export function hasMeaningfulTerms(raw: string): boolean {
  return meaningfulTerms(raw).length > 0;
}

// ── Schémas d'API (§3) ────────────────────────────────────────────────────────

export const searchSubjectTypeSchema = z.enum(SearchSubjectType);

/** §2.3 : « période (7 j / 30 j / tout) ». */
export const SEARCH_PERIODS = ['7d', '30d', 'all'] as const;
export type SearchPeriod = (typeof SEARCH_PERIODS)[number];

/** §2.3 : « état (ouvert / résolu pour l'entraide et les sujets) ». */
export const SEARCH_STATES = ['open', 'resolved'] as const;
export type SearchState = (typeof SEARCH_STATES)[number];

export const searchQuerySchema = cursorQuerySchema.extend({
  q: z.string().trim().min(SEARCH_MIN_QUERY_LENGTH).max(SEARCH_MAX_QUERY_LENGTH),
  /** Absent = onglet « Tout » (groupé). Présent = onglet du type, paginé. */
  type: searchSubjectTypeSchema.optional(),
  cityId: uuidSchema.optional(),
  radiusKm: z.coerce.number().int().min(1).max(500).optional(),
  countryId: uuidSchema.optional(),
  period: z.enum(SEARCH_PERIODS).default('all'),
  state: z.enum(SEARCH_STATES).optional(),
});

export type SearchQuery = z.infer<typeof searchQuerySchema>;

export const suggestQuerySchema = z.object({
  q: z.string().trim().min(SUGGEST_MIN_QUERY_LENGTH).max(SEARCH_MAX_QUERY_LENGTH),
});

/**
 * `POST /search/zero` — « appelé par le client après affichage » (§3).
 *
 * AUCUN identifiant de membre dans le schéma, et c'est la règle dure du §2.4 :
 * « requête normalisée, ville, jour — sans identifiant de membre ». Ce qu'un type
 * ne peut pas transporter ne peut pas être stocké par erreur.
 */
export const searchZeroSchema = z.object({
  q: z.string().trim().min(SEARCH_MIN_QUERY_LENGTH).max(SEARCH_MAX_QUERY_LENGTH),
  cityId: uuidSchema.optional(),
});

/** Réindexation admin, par type (§2.5 et §3). */
export const searchReindexSchema = z.object({
  type: searchSubjectTypeSchema,
});

export const zeroResultsQuerySchema = z.object({
  /** Semaines en arrière ; 1 = la semaine en cours. */
  weeks: z.coerce.number().int().min(1).max(12).default(1),
  cityId: uuidSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ── Textes (§2.4 et §4) ───────────────────────────────────────────────────────

/** §2.4, au mot : la proposition affichée sur l'état vide. */
export const SEARCH_ZERO_PROMPT_FR = 'Aucun résultat. Posez la question à la communauté ?';
/** §4 : le bouton de l'état vide, qui pré-remplit le composeur d'entraide. */
export const SEARCH_ZERO_CTA_FR = 'Poser la question';

export const SEARCH_TYPE_LABELS_FR: Record<string, string> = {
  GUIDE: 'Guides',
  TOPIC: 'Sujets de réseau',
  HELP_REQUEST: 'Entraide',
  HOUSING: 'Logement',
  JOB: 'Emploi',
  EVENT: 'Événements',
  USER: 'Membres',
  CITY: 'Villes',
  PRO: 'Professionnels',
};
