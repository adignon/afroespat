import { z } from 'zod';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LA PAGE D'ACCUEIL PUBLIQUE — CE QU'UN VISITEUR SANS COMPTE PEUT LIRE        ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Trois routes ouvertes (`GET /public/landing`, `/public/search`, `/public/communities/:id`) alimentent la page
 * d'accueil. Elles ne rendent QUE ce qui est déjà public ailleurs — guides publiés, événements ouverts, villes actives
 * — plus la fiche « À propos » des réseaux de ville PUBLICS. Un réseau privé n'est jamais exposé, pas même par son
 * existence (404).
 *
 * ── LES SEUILS ─────────────────────────────────────────────────────────────
 *
 * Un chiffre n'est affiché que s'il est vrai ET significatif. Sous \`LANDING_MIN_MEMBERS\` membres, les compteurs
 * (membres, villes, pays, membres par ville) valent \`null\` et la page ne les montre pas : afficher « 12 400 membres »
 * sur une base qui en compte dix serait faux, et « 3 membres » ne rassure personne.
 */
export const LANDING_MIN_MEMBERS = 100;
/** Les statistiques d'entraide (délai médian, taux de résolution) exigent au moins ce nombre de demandes sur 90 jours. */
export const LANDING_MIN_HELP_REQUESTS = 20;
/** Le nombre de guides publiés ne s'affiche qu'à partir de là. */
export const LANDING_MIN_GUIDES = 10;

export const PUBLIC_SEARCH_MIN_CHARS = 2;
export const PUBLIC_SEARCH_LIMIT = 6;

export const publicLandingSchema = z
  .object({
    stats: z
      .object({
        members: z.number().int().nullable(),
        cities: z.number().int().nullable(),
        countries: z.number().int().nullable(),
        /** Noms des pays d'origine des membres (pour le bandeau défilant). Vide sous le seuil. */
        countryNames: z.array(z.string()),
      })
      .strict(),
    entraide: z
      .object({
        medianFirstReplyMinutes: z.number().int().nullable(),
        resolvedPercent: z.number().int().nullable(),
        publishedGuides: z.number().int().nullable(),
      })
      .strict(),
    events: z.array(
      z
        .object({
          id: z.string().uuid(),
          title: z.string(),
          startsAt: z.string().datetime(),
          type: z.string(),
          cityName: z.string().nullable(),
          /** Le réseau organisateur, sinon le prénom et l'initiale de l'organisateur. */
          by: z.string(),
          attendeeCount: z.number().int(),
        })
        .strict(),
    ),
    cities: z.array(
      z
        .object({
          slug: z.string(),
          name: z.string(),
          /** `null` sous le seuil. */
          memberCount: z.number().int().nullable(),
          /**
           * Le réseau PUBLIC de la ville (créé à l'activation) : la page d'accueil ouvre sa fiche « À propos ».
           * `null` si la ville n'en a pas (ou si son réseau n'est pas public).
           */
          communityId: z.string().uuid().nullable(),
        })
        .strict(),
    ),
    /**
     * Les lieux du sélecteur : chaque pays qui a au moins une ville active, avec ces villes. Le visiteur choisit
     * d'abord un pays, puis une ville de ce pays.
     */
    places: z.array(
      z
        .object({
          /** Code ISO-3166 alpha-2 du pays (`FR`). */
          code: z.string(),
          name: z.string(),
          /** Somme des membres de ses villes ; `null` sous le seuil. */
          memberCount: z.number().int().nullable(),
          cities: z.array(
            z.object({ slug: z.string(), name: z.string(), memberCount: z.number().int().nullable() }).strict(),
          ),
        })
        .strict(),
    ),
    quotes: z.array(
      z
        .object({
          id: z.string().uuid(),
          text: z.string(),
          /** « Prénom N. », ou `null` si la source n'a plus d'auteur. */
          authorName: z.string().nullable(),
          context: z.string().nullable(),
        })
        .strict(),
    ),
    generatedAt: z.string().datetime(),
  })
  .strict();
export type PublicLanding = z.infer<typeof publicLandingSchema>;

export const publicSearchQuerySchema = z
  .object({
    q: z.string().trim().min(PUBLIC_SEARCH_MIN_CHARS).max(80),
    /** Slug d'une ville : restreint guides et réseaux à cette ville (les guides universels restent). */
    city: z.string().trim().min(1).max(80).optional(),
    /** Code ISO d'un pays : restreint aux villes de ce pays (sans effet si `city` est donné). */
    country: z.string().trim().length(2).optional(),
  })
  .strict();
export type PublicSearchQuery = z.infer<typeof publicSearchQuerySchema>;

export const publicSearchResponseSchema = z
  .object({
    guides: z.array(
      z
        .object({
          slug: z.string(),
          title: z.string(),
          category: z.string(),
          helpfulCount: z.number().int(),
          cityName: z.string().nullable(),
        })
        .strict(),
    ),
    communities: z.array(
      z
        .object({
          id: z.string().uuid(),
          name: z.string(),
          cityName: z.string().nullable(),
          memberCount: z.number().int().nullable(),
        })
        .strict(),
    ),
    cities: z.array(z.object({ slug: z.string(), name: z.string() }).strict()),
  })
  .strict();
export type PublicSearchResponse = z.infer<typeof publicSearchResponseSchema>;

/**
 * La fiche « À propos » d'un réseau de ville PUBLIC — et rien d'autre : ni le fil, ni les événements du réseau, ni la
 * liste des membres, ni l'album. Les modérateurs sont nommés « Prénom N. ».
 */
export const publicCommunityAboutSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
    cityName: z.string().nullable(),
    description: z.string().nullable(),
    /** `null` sous le seuil de membres. */
    memberCount: z.number().int().nullable(),
    foundedYear: z.number().int(),
    moderators: z.array(z.object({ name: z.string(), role: z.enum(['OWNER', 'MODERATOR']) }).strict()),
  })
  .strict();
export type PublicCommunityAbout = z.infer<typeof publicCommunityAboutSchema>;

/** « Aïcha Diop » → « Aïcha D. ». Un seul mot reste tel quel. */
export function shortName(displayName: string): string {
  const mots = displayName.trim().split(/\s+/).filter((m) => m !== '');
  if (mots.length === 0) return '';
  if (mots.length === 1) return mots[0] ?? '';
  const dernier = mots[mots.length - 1] ?? '';
  return `${mots[0] ?? ''} ${dernier.charAt(0).toUpperCase()}.`;
}

/** La médiane d'une liste de nombres (arrondie), ou `null` si elle est vide. */
export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const tri = [...values].sort((a, b) => a - b);
  const milieu = Math.floor(tri.length / 2);
  const valeur = tri.length % 2 === 1 ? (tri[milieu] ?? 0) : ((tri[milieu - 1] ?? 0) + (tri[milieu] ?? 0)) / 2;
  return Math.round(valeur);
}
