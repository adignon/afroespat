import { z } from 'zod';
import { cursorQuerySchema, pageSchema, uuidSchema } from './pagination.js';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ CE QU'UN MEMBRE A PUBLIÉ — `GET /users/:handle/content`                   ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « Je propose qu'il y ait des tabs (guides, fil d'actualités,
 * stories, entraides, services, évènements, parcours publics) qui montrent ce
 * que l'utilisateur a publié dans ces choses. »
 *
 * CE QUI MANQUAIT, et c'est ce qui bloquait aussi la liste « GUIDES PUBLIÉS »
 * déjà dessinée sur la planche d'ordinateur : AUCUNE route ne sait filtrer par
 * auteur. `guideListQuerySchema` porte `tab`, `category`, `countryId`, `cityId`
 * — pas d'auteur. Idem pour le fil, l'entraide, les services et l'agenda. Seule
 * la recherche sait le faire, et elle ne rend pas des cartes de profil.
 *
 * ── UNE ROUTE POUR LES SEPT, ET NON SEPT ROUTES ──────────────────────────────
 *
 * Les sept onglets posent la MÊME question — « qu'a publié cette personne ? » —
 * et attendent la même carte : un titre, une ligne de contexte, une adresse. Sept
 * routes auraient voulu dire sept paginations, sept règles de visibilité et sept
 * occasions d'en oublier une. Ici la règle de visibilité est écrite UNE fois par
 * espèce, au même endroit, et elle se relit d'un coup d'œil.
 *
 * ── LA VISIBILITÉ N'EST PAS CELLE DE L'AUTEUR, C'EST CELLE DU VISITEUR ──────
 *
 * Un profil public montre ce qui est PUBLIÉ, jamais les brouillons, jamais ce
 * que la modération a retiré, jamais un parcours privé. La règle est portée par
 * le service, et le blocage l'est en amont : la route refuse comme le profil
 * public lui-même refuse — `404`, indiscernable d'un membre qui n'existe pas
 * (08 §4.4, T4 §3).
 */
export const MEMBER_CONTENT_TYPES = [
  'GUIDE',
  'POST',
  'STORY',
  'HELP',
  'SERVICE',
  'EVENT',
  'JOURNEY',
] as const;

export const memberContentTypeSchema = z.enum(MEMBER_CONTENT_TYPES);

export type MemberContentType = (typeof MEMBER_CONTENT_TYPES)[number];

/** Les libellés d'onglet, tels que le porteur les a nommés. */
export const MEMBER_CONTENT_LABELS_FR: Record<MemberContentType, string> = {
  GUIDE: 'Guides',
  POST: 'Fil d’actualité',
  STORY: 'Stories',
  HELP: 'Entraide',
  SERVICE: 'Services',
  EVENT: 'Événements',
  JOURNEY: 'Parcours publics',
};

export const memberContentQuerySchema = cursorQuerySchema.extend({
  /** Absent = toutes les espèces, dans l'ordre des onglets. */
  type: memberContentTypeSchema.optional(),
});

export type MemberContentQuery = z.infer<typeof memberContentQuerySchema>;

/**
 * UNE CARTE, SEPT ESPÈCES.
 *
 * `subtitle` porte ce que l'espèce a d'utile à dire en une ligne — la catégorie
 * d'un guide, l'état d'une demande d'entraide, la ville d'un événement. Elle est
 * COMPOSÉE PAR LE SERVEUR, qui seul connaît les règles de chaque module : le
 * front n'a pas à savoir qu'une demande résolue se dit « Résolue ».
 *
 * `href` est l'adresse du contenu dans l'application, composée par le serveur
 * pour la même raison — c'est lui qui sait qu'un guide s'ouvre par son `slug` et
 * une publication par son identifiant.
 */
export const memberContentItemSchema = z
  .object({
    id: uuidSchema,
    type: memberContentTypeSchema,
    title: z.string(),
    subtitle: z.string(),
    href: z.string(),
    createdAt: z.string().datetime(),
    /**
     * ╔══════════════════════════════════════════════════════════════════════╗
     * ║ L'APERÇU D'UNE STORY — CE QU'IL FAUT POUR LA REDESSINER              ║
     * ╚══════════════════════════════════════════════════════════════════════╝
     *
     * Le porteur : « Les stories c'est les previews l'un à côté de l'autre et ça
     * peut aller à la ligne (pas besoin de prev et next). » Une story ne
     * s'affiche pas en ligne de titre : elle s'affiche TELLE QU'ELLE EST, fond
     * compris. `ApercuStory` sait la dessiner — il lui faut son fond, son
     * étiquette de type et son texte.
     *
     * Absent sur les six autres espèces : seul `STORY` se dessine ainsi, et un
     * champ toujours présent mais toujours nul serait une promesse vide.
     */
    apercu: z
      .object({
        /** Couleur de l'aplat, ou adresse de la photo de fond. */
        fond: z.string(),
        photo: z.boolean(),
        etiquette: z.string(),
        texte: z.string(),
      })
      .strict()
      .optional(),
  })
  .strict();

export type MemberContentItem = z.infer<typeof memberContentItemSchema>;

export const memberContentResponseSchema = pageSchema(memberContentItemSchema).extend({
  /**
   * LE COMPTE PAR ESPÈCE, pour les onglets — et il porte TOUJOURS la collection
   * entière, quel que soit le filtre. Compter les cartes reçues afficherait
   * « Guides · 20 » à qui en a quarante.
   */
  meta: z.object({
    total: z.number().int().nonnegative(),
    parType: z.record(memberContentTypeSchema, z.number().int().nonnegative()),
  }),
});

export type MemberContentResponse = z.infer<typeof memberContentResponseSchema>;
