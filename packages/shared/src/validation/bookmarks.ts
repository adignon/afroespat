import { z } from 'zod';
import { BookmarkState, BookmarkSubjectType } from '../enums/generated.js';
import { cursorQuerySchema, pageSchema, uuidSchema } from './pagination.js';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LES ENREGISTRÉS — QUATRE ROUTES ANNONCÉES, AUCUNE LIVRÉE                  ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « La page des choses enregistrées aussi ? » puis « Finalise les
 * routes bookmarks et branche-les. »
 *
 * MESURÉ : `bookmarks.service.ts` existait — il porte la tâche horaire qui
 * rafraîchit les états — et son propre en-tête le disait : « §2.9 annonce quatre
 * routes : `GET /me/bookmarks`, `PUT /me/bookmarks`, `DELETE
 * /me/bookmarks/:type/:id`, `GET /me/bookmarks/states`. AUCUNE n'est livrée. »
 * Le contrôleur n'existait pas, et la page K10 montrait les cinq lignes de la
 * maquette à tout le monde.
 *
 * ── `PUT` ET NON `POST`, ET C'EST §2.9 QUI LE DIT ─────────────────────────
 *
 * Enregistrer est IDEMPOTENT : le même contenu enregistré deux fois reste
 * enregistré une fois, et la table le garantit (`@@unique([userId, subjectType,
 * subjectId])`). `PUT` dit cela ; `POST` promettrait une création à chaque appel.
 *
 * ── L'ÉTAT N'EST PAS UNE DÉCORATION ───────────────────────────────────────
 *
 * §2.9 : « pour chaque ligne l'état actuel du contenu — story "expirée, gardée
 * pour vous", demande "résolue"… ». C'est la raison d'être de cette page : on
 * garde ce qui disparaît. L'état est CALCULÉ par la tâche horaire et stocké, pas
 * recalculé à la lecture — une page d'enregistrés ne doit pas interroger douze
 * tables à chaque ouverture.
 */
export const bookmarkSubjectTypeSchema = z.enum(BookmarkSubjectType);
export const bookmarkStateSchema = z.enum(BookmarkState);

/** `PUT /me/bookmarks` — enregistrer un contenu. */
export const putBookmarkSchema = z
  .object({
    subjectType: bookmarkSubjectTypeSchema,
    subjectId: uuidSchema,
  })
  .strict();

export type PutBookmark = z.infer<typeof putBookmarkSchema>;

/**
 * Une ligne de `GET /me/bookmarks`.
 *
 * `title` ET `subtitle` SONT COMPOSÉS PAR LE SERVEUR, parce que lui seul sait
 * lire les douze tables de sujets. Le front ne doit pas faire douze appels pour
 * afficher une liste.
 *
 * `href` est l'adresse du contenu — `/stories/:id`, `/guides/:slug`… — ou `null`
 * quand il n'y a plus rien à ouvrir : une story expirée se garde, mais elle ne
 * s'ouvre plus. Un lien mort serait pire que pas de lien.
 */
export const bookmarkSchema = z
  .object({
    id: uuidSchema,
    subjectType: bookmarkSubjectTypeSchema,
    subjectId: uuidSchema,
    state: bookmarkStateSchema,
    createdAt: z.string().datetime(),
    title: z.string(),
    subtitle: z.string(),
    href: z.string().nullable(),
  })
  .strict();

export type Bookmark = z.infer<typeof bookmarkSchema>;

export const bookmarksQuerySchema = cursorQuerySchema.extend({
  /**
   * Les onglets de la planche : « Tout », « Stories », « Guides »…
   *
   * `subjectType`, ET PAS `type` : c'est le nom que porte déjà le corps du `PUT`
   * et la requête de `GET /me/bookmarks/states`. Un même champ sous deux noms
   * dans un même module se paie une fois par appelant — ici, le premier l'a payé
   * tout de suite : le filtre partait en `?subjectType=…`, la route lisait
   * `type`, et l'onglet « Villes » rendait la liste entière sans erreur.
   */
  subjectType: bookmarkSubjectTypeSchema.optional(),
});

export type BookmarksQuery = z.infer<typeof bookmarksQuerySchema>;

export const bookmarksResponseSchema = pageSchema(bookmarkSchema).extend({
  /**
   * LE COMPTE PAR TYPE, pour les onglets. La planche écrit « 14 enregistrés » et
   * sept onglets : les compter à l'écran demanderait de charger TOUTES les pages
   * avant d'afficher la première.
   */
  meta: z.object({
    total: z.number().int().nonnegative(),
    parType: z.record(bookmarkSubjectTypeSchema, z.number().int().nonnegative()),
  }),
});

export type BookmarksResponse = z.infer<typeof bookmarksResponseSchema>;

/**
 * `GET /me/bookmarks/states` — « états en LOT » (§2.9).
 *
 * Elle répond à une question d'écran : « parmi ces vingt publications affichées,
 * lesquelles ai-je enregistrées ? ». Une requête par carte serait vingt
 * allers-retours pour dessiner vingt signets.
 */
export const bookmarkStatesQuerySchema = z
  .object({
    subjectType: bookmarkSubjectTypeSchema,
    /** Les identifiants à interroger, séparés par des virgules. */
    ids: z.string().min(1),
  })
  .strict();

export const bookmarkStatesResponseSchema = z
  .object({
    items: z.array(
      z.object({ subjectId: uuidSchema, state: bookmarkStateSchema }).strict(),
    ),
  })
  .strict();

export type BookmarkStatesResponse = z.infer<typeof bookmarkStatesResponseSchema>;
