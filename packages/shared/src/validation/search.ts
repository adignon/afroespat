import { z } from 'zod';
import { SearchSubjectType } from '../enums/generated.js';
import { cursorQuerySchema, pageSchema, uuidSchema } from './pagination.js';

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

/**
 * ─── LE SEUIL DE PERSONNES DISTINCTES DES « GUIDES MANQUANTS » ───────────────
 *
 * Arbitrage du porteur : « n'afficher qu'une requête cherchée par PLUSIEURS
 * PERSONNES DISTINCTES ». Le panneau des guides manquants expose du texte écrit
 * par des membres ; le seuil est ce qui le rend montrable.
 *
 * CE QUI A ÉTÉ MESURÉ, ET POURQUOI AUCUNE HEURISTIQUE DE TEXTE N'EST EMPLOYÉE.
 * `normalizeQuery` ne retire que les accents et la ponctuation : lettres et
 * chiffres SURVIVENT. « Docteur Awa Diallo Lyon » devient « docteur awa diallo
 * lyon » et « rappeler 0612345678 » devient « rappeler 0612345678 » — l'un et
 * l'autre affichables tels quels. Chercher à reconnaître un nom ou un numéro dans
 * une requête libre, c'est écrire un filtre qui se trompe dans les deux sens, et
 * qui se trompe silencieusement. Le seuil, lui, ne lit pas le texte : une
 * recherche nominative est presque toujours le fait d'UNE personne, et elle tombe
 * d'elle-même.
 *
 * POURQUOI TROIS, ET PAS DEUX.
 *
 *   · « Plusieurs » commence littéralement à deux, mais deux ne sépare pas assez :
 *     il suffit d'un membre et d'un proche cherchant la même personne pour qu'une
 *     requête nominative passe. Trois demande une coïncidence qui ne se produit
 *     plus par hasard.
 *   · Le dépôt juge DÉJÀ à trois ce qui cesse d'être un avis isolé :
 *     `GUIDE_OUTDATED_FLAG_THRESHOLD` (trois signalements font basculer un guide),
 *     `GUIDE_PENDING_PROPOSAL_LIMIT`, `GUIDE_DAILY_PUBLISH_LIMIT`. Reprendre le
 *     même nombre évite d'introduire un quatrième seuil à expliquer.
 *   · Et c'est le seuil de petite cellule habituel pour publier un agrégat : à
 *     trois personnes, l'agrégat ne désigne plus personne.
 *
 * CE QUE CE SEUIL COMPTE — DES PERSONNES, PAS DES RECHERCHES.
 * `search_zero_results.count` compte les RECHERCHES : un seul membre qui cherche
 * trois fois y inscrit `count: 3`, et il aurait franchi un seuil posé sur `count`.
 * Mesuré sur le service avant l'arbitrage, trois appels du même membre donnaient
 * bien une ligne à `count: 3`. Le comptage des personnes distinctes vit donc dans
 * `search_zero_result_seekers`, en pseudonymes — voir `recordZeroResult`.
 */
export const SEARCH_ZERO_MIN_DISTINCT_SEEKERS = 3;

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

// ── Les réponses de lecture (§3) ──────────────────────────────────────────────

/**
 * ─── `GET /search` REND DEUX FORMES, ET C'EST `type` QUI DÉCIDE ──────────────
 *
 * Lu sur le CONTRÔLEUR et son service, pas déduit de l'enveloppe :
 *
 *   · SANS `type` — la recherche est GROUPÉE. `items` n'est alors PAS une liste de
 *     résultats : c'est une liste de GROUPES, chacun portant son type, son libellé
 *     français, son compteur, son drapeau de troncature et jusqu'à
 *     `SEARCH_GROUP_PREVIEW_SIZE` résultats. `nextCursor` vaut toujours `null` —
 *     la forme groupée ne pagine pas.
 *   · AVEC `type` — `items` est une liste de résultats PLATS, et `nextCursor`
 *     pagine pour de vrai.
 *
 * Deux schémas, donc, et non un seul permissif : un `union` laisserait l'écran
 * croire qu'il peut lire `items[].title` sur les deux, alors qu'en groupé ce
 * chemin donne le titre d'un GROUPE — c'est-à-dire `undefined`, et un onglet vide
 * sans que rien ne le dise. L'appelant choisit le schéma en même temps qu'il
 * choisit d'envoyer `type` ou non.
 *
 * `count` EST CUEILLI, DONC BORNÉ, et `capped` le dit : le service le commente
 * (« un COUNT(*) exact par type serait exact avant le filtre d'auteur, donc faux
 * après — et il divulguerait l'existence de contenus d'un auteur qui m'a
 * bloqué »). Un écran qui affiche ce compteur affiche donc un MINIMUM, et c'est
 * `capped` qui dit lequel l'est.
 */
export const searchHitSchema = z
  .object({
    id: z.string(),
    subjectType: searchSubjectTypeSchema,
    subjectId: z.string(),
    title: z.string(),
    /** Les 220 premiers caractères du corps indexé, coupés par le serveur. */
    excerpt: z.string(),
    cityId: uuidSchema.nullable(),
    countryId: uuidSchema.nullable(),
    communityId: uuidSchema.nullable(),
    /**
     * ╔══════════════════════════════════════════════════════════════════════════╗
     * ║ OÙ MÈNE CE RÉSULTAT — COMPOSÉ PAR LE SERVEUR                            ║
     * ╚══════════════════════════════════════════════════════════════════════════╝
     *
     * Le porteur : « les propositions doivent permettre d'aller directement sur un
     * élément ».
     *
     * L'index ne porte que le type et l'identifiant. Or quatre types sur neuf ne
     * s'ouvrent PAS par leur identifiant : un guide par son slug, un membre par
     * son pseudo, une ville par son slug, un sujet par le slug de son réseau. Un
     * client qui composerait les adresses devrait connaître neuf règles de routage
     * et savoir résoudre trois référentiels.
     *
     * `null` quand la source a disparu entre l'indexation et la lecture : l'écran
     * montre alors le résultat sans le rendre cliquable, plutôt que de mener à une
     * page absente.
     */
    url: z.string().nullable(),
    rank: z.number(),
    updatedAt: z.string().datetime(),
  })
  .strict();

export type SearchHit = z.infer<typeof searchHitSchema>;

export const searchGroupSchema = z
  .object({
    type: searchSubjectTypeSchema,
    /** Le libellé français, de `SEARCH_TYPE_LABELS_FR` — décidé par le serveur. */
    label: z.string(),
    count: z.number().int().nonnegative(),
    /** Vrai quand `count` est tronqué : l'écran affiche alors un minimum. */
    capped: z.boolean(),
    items: z.array(searchHitSchema),
  })
  .strict();

export type SearchGroup = z.infer<typeof searchGroupSchema>;

/**
 * `meta`, commun aux deux formes.
 *
 * `zeroResult` n'est présent QUE sur une recherche sans résultat dont la requête
 * porte des termes utiles (§2.4). Son texte vient de l'API et non du front —
 * `SEARCH_ZERO_PROMPT_FR` est ici pour que les deux disent la même chose, et le
 * recopier dans un composant en ferait une seconde source.
 */
export const searchMetaSchema = z
  .object({
    q: z.string(),
    normalized: z.string(),
    zeroResult: z
      .object({ prompt: z.string(), cta: z.string(), helpTitle: z.string() })
      .strict()
      .optional(),
  })
  .strict();

/** `GET /search` SANS `type` : des groupes, et aucune pagination. */
export const groupedSearchResponseSchema = z.object({
  items: z.array(searchGroupSchema),
  /** Toujours `null` : la forme groupée ne pagine pas. */
  nextCursor: z.null(),
  meta: searchMetaSchema,
});

export type GroupedSearchResponse = z.infer<typeof groupedSearchResponseSchema>;

/** `GET /search?type=…` : des résultats plats, paginés. */
export const typedSearchResponseSchema = z.object({
  items: z.array(searchHitSchema),
  nextCursor: z.string().nullable(),
  meta: searchMetaSchema,
});

export type TypedSearchResponse = z.infer<typeof typedSearchResponseSchema>;

/**
 * `GET /search/suggest` — et son enveloppe est À PART.
 *
 * Elle ne porte NI `nextCursor` NI `meta` : le contrôleur rend `{ items }` et rien
 * d'autre. Lui appliquer `pageSchema` ferait échouer tous les appels, puisque
 * `nextCursor` y est requis — c'est le genre d'écart qu'on ne voit qu'en lisant le
 * contrôleur, et c'est pour cela qu'il est écrit ici.
 *
 * UNE SUGGESTION PORTE DE QUOI OUVRIR SON ÉLÉMENT — `subjectId` et `url`.
 *
 * Elle ne portait auparavant qu'un titre et un type : la choisir ne pouvait que
 * relancer la recherche sur son texte, alors que le serveur savait déjà de quel
 * élément il parlait. Le porteur l'a demandé autrement : « les propositions sous
 * l'input doivent s'afficher et permettre d'ALLER DIRECTEMENT sur un élément. »
 *
 * `url` est NULLABLE pour la même raison que celui d'un résultat : la source peut
 * avoir disparu entre l'indexation et la frappe, et une suggestion qui mène à une
 * page absente est pire qu'une suggestion qu'on ne peut qu'ouvrir en recherche.
 */
export const suggestResponseSchema = z
  .object({
    items: z.array(
      z
        .object({
          title: z.string(),
          subjectType: searchSubjectTypeSchema,
          subjectId: z.string(),
          url: z.string().nullable(),
        })
        .strict(),
    ),
  })
  .strict();

export type SuggestResponse = z.infer<typeof suggestResponseSchema>;

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ `POST /v1/admin/search/reindex` — §4, ET ELLE N'EXISTAIT PAS              ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * La spec la nomme : « Admin : `/v1/admin/search/reindex` (type) ». Le service
 * porte `reindexType` depuis toujours ; AUCUNE route ne l'appelait — le
 * contrôleur de recherche l'écrit en commentaire : « attendent le module 15 ».
 *
 * Elle a manqué le jour où il l'a fallu. Le relais d'événements ne tournait pas
 * (`APP_ROLE=api` sans worker), donc rien n'avait jamais été indexé ; une fois le
 * worker démarré, les CONTENUS NOUVEAUX s'indexent, mais les anciens restent hors
 * de l'index — leurs événements sont passés. Rejouer des événements vieux de
 * plusieurs jours serait faux ; relire la source est exactement ce que cette
 * route fait.
 *
 * `types` et non `type` : reconstruire l'index entier demande neuf appels, et neuf
 * appels successifs se coupent en deux au premier qui échoue.
 */
export const adminReindexSchema = z
  .object({ types: z.array(searchSubjectTypeSchema).min(1) })
  .strict();

export type AdminReindex = z.infer<typeof adminReindexSchema>;

export const adminReindexResponseSchema = z
  .object({
    items: z.array(
      z
        .object({
          type: searchSubjectTypeSchema,
          indexed: z.number().int().nonnegative(),
          removed: z.number().int().nonnegative(),
        })
        .strict(),
    ),
  })
  .strict();

export type AdminReindexResponse = z.infer<typeof adminReindexResponseSchema>;

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

/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║ `GET /search/zero-results` — « GUIDES MANQUANTS », EN LECTURE MEMBRE         ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 *
 * MESURÉ avant ce lot : le panneau « GUIDES MANQUANTS · Recherché sans résultat ce
 * mois-ci » de la colonne de droite d'A03 affichait les QUATRE lignes d'exemple de
 * la maquette (`missing`, dans `apps/web/src/screens/a03/data.ts`). Tout existait
 * sauf la route :
 *
 *   · le modèle `SearchZeroResult` (`11-12-search-notifications.prisma`), unique
 *     sur `(queryNormalized, cityId, occurredOn)` ;
 *   · son ALIMENTATION — `recordZeroResult`, appelée par `POST /search/zero` ;
 *   · l'AGRÉGAT — `searchService.zeroResults({ weeks, cityId, limit })`, un
 *     `groupBy` déjà trié par somme décroissante ;
 *   · et AUCUNE route : `grep -rn zeroResults …/*.controller.ts` ne trouvait qu'un
 *     commentaire disant que `/v1/admin/search/zero-results` « attend le module 15 ».
 *
 * ── POURQUOI UNE ROUTE MEMBRE, ET NON L'ADMIN QUI ATTEND LE MODULE 15 ─────────
 *
 * Parce que ce ne sont pas les mêmes données. La route admin de §3 a été laissée
 * de côté pour une raison écrite dans `search.controller.ts` : `AuthGuard` ne
 * connaît que les capacités de MEMBRE, et exposer la RÉINDEXATION derrière
 * `content.read` donnerait à n'importe qui de quoi saturer la base. L'agrégat des
 * recherches sans résultat, lui, ne porte aucun de ces deux risques : il est en
 * lecture seule, borné par `limit`, et il ne nomme personne — §2.4 interdit au
 * modèle de transporter un identifiant de membre (« requête normalisée, ville,
 * jour — sans identifiant de membre »), donc la réponse ne peut pas en porter un.
 * `content.read` est en N0 (`capabilities.ts`), et c'est le bon niveau : c'est une
 * liste de recherches, pas un contenu de membre.
 *
 * ⚠ CE QUE `query` PORTE, ET CE N'EST PAS UNE DÉCISION DE CODE ───────────────
 *
 * `queryNormalized` EST DU TEXTE ÉCRIT PAR DES MEMBRES, et `normalizeQuery` (plus
 * haut dans ce fichier) ne fait que trois choses : décomposition Unicode pour
 * retirer les accents, passage en minuscules, et remplacement de tout ce qui n'est
 * pas `[a-z0-9]` par une espace. Autrement dit : **les lettres et les chiffres
 * survivent**. Une recherche « Docteur Awa Diallo Lyon » reste « docteur awa diallo
 * lyon », et « rappeler 0612345678 » reste « rappeler 0612345678 ». Rien dans
 * `recordZeroResult` ne filtre un nom propre ni une suite de chiffres — le seul
 * filtre est `hasMeaningfulTerms`, qui retire les MOTS VIDES et rien d'autre.
 *
 * Afficher cet agrégat à tout membre peut donc, en théorie, exposer le nom d'une
 * personne ou un numéro tapés par quelqu'un d'autre dans une barre de recherche.
 * C'EST UN ARBITRAGE DU PORTEUR, pas une décision de code, et il est REMONTÉ : le
 * code ne masque rien de son propre chef, parce que masquer « ce qui ressemble à un
 * nom » demanderait une heuristique qui se tromperait dans les deux sens.
 */
export const searchZeroResultRowSchema = z
  .object({
    /** La requête NORMALISÉE — voir l'avertissement ci-dessus. */
    query: z.string(),
    /** La somme des occurrences sur la fenêtre demandée. */
    count: z.number().int().nonnegative(),
  })
  .strict();

export type SearchZeroResultRow = z.infer<typeof searchZeroResultRowSchema>;

/**
 * `.strict()` ET PAS `pageSchema` NU : le service rend `{ items, nextCursor }` et
 * rien d'autre — `nextCursor` y est écrit `null` en dur, parce qu'un `groupBy`
 * borné par `take` ne pagine pas. Le `meta` facultatif de `pageSchema` reste
 * déclaré, et `.strict()` refuse tout le reste : une clé ajoutée au service sans
 * être déclarée ici fait échouer l'appel côté front, ce qui est exactement le
 * signal qu'on veut.
 */
export const zeroResultsResponseSchema = pageSchema(searchZeroResultRowSchema).strict();

export type ZeroResultsResponse = z.infer<typeof zeroResultsResponseSchema>;

/**
 * « CE MOIS-CI », EN SEMAINES — parce que c'est l'unité que le service prend.
 *
 * La maquette écrit « Recherché sans résultat ce mois-ci » ; `zeroResults` ne
 * connaît que `weeks` (1 à 12, `zeroResultsQuerySchema` juste au-dessus). Quatre
 * semaines est la lecture la plus proche du mot dessiné, et la constante est ici
 * — et non dans l'écran — pour la même raison que toutes les bornes de ce
 * paquet : une valeur recopiée dans un composant est une seconde source.
 */
export const SEARCH_ZERO_RESULTS_PANEL_WEEKS = 4;

/**
 * Le nombre de lignes que le panneau d'A03 dessine : QUATRE, comptées sur la
 * planche de 1 440 px. La liste est pourtant une boucle (`<sc-for>`), donc le
 * cadre en afficherait autant qu'on lui en donne — mais la colonne fait 300 px de
 * large et la maquette en dessine quatre. On en demande quatre.
 */
export const SEARCH_ZERO_RESULTS_PANEL_LIMIT = 4;
