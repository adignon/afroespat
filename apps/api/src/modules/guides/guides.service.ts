import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { newId, Prisma } from '@app/db';
import {
  computeFreshnessScore,
  containsForbiddenWord,
  GUIDE_AUTHOR_INACTIVITY_MONTHS,
  GUIDE_DAILY_PUBLISH_LIMIT,
  GUIDE_ERROR_CODES,
  GUIDE_ERROR_MESSAGES,
  GUIDE_ESCALATION_CASE_PRIORITY,
  GUIDE_FRESHNESS_BRACKETS,
  GUIDE_NEGATIVE_VOTE_CASE_PRIORITY,
  GUIDE_NEGATIVE_VOTE_THRESHOLD,
  GUIDE_NEGATIVE_VOTE_WINDOW_DAYS,
  GUIDE_OUTDATED_FLAG_THRESHOLD,
  GUIDE_PENDING_PROPOSAL_LIMIT,
  GUIDE_PROPOSAL_ESCALATION_DAYS,
  GUIDE_STALE_MONTHS,
  GUIDE_TITLE_MAX,
  GUIDE_UNPUBLISH_DELAY_DAYS,
  GUIDE_PAGE_TITLE_MAX,
  GUIDE_PAGE_TITLE_MIN,
  guideBodyMediaKeys,
  guidePublishableGuideBodySchema,
  joinGuidePageBodies,
  monthsSince,
  slugifyGuideTitle,
  type CreateGuide,
  type CreateGuidePage,
  type CreateProposal,
  type GuideBanner,
  type GuideErrorCode,
  type GuideListQuery,
  type GuideListItem,
  type GuidePageRef,
  type GuideVoteValue,
  type Page,
  type UpdateGuide,
  type UpdateGuidePage,
} from '@app/shared';
import { ApiError } from '../../common/api-error';
import { AuditService } from '../../common/audit.service';
import { commentCountWhere } from '../../common/comment-visibility';
import { buildPage, decodeCursor } from '../../common/cursor';
import { ATTACHABLE_KINDS, REQUIRED_MEDIA_STATUS } from '../../common/media-attachment';
import { OutboxService } from '../../common/outbox.service';
import { PrismaService } from '../../common/prisma.service';
import { redactForModeration, assertRedacted } from '../../common/redact';
import { VisibilityService } from '../../common/visibility.service';
import { loadEnv } from '../../config/env';
import { AI_MODERATION_PROVIDER, type AiModerationProvider } from '../../providers/providers';

/**
 * Guides et démarches — 05-guides.md.
 *
 * Trois choses expliquent la forme de ce service, et méritent d'être dites
 * avant de le lire :
 *
 * 1. LE CORPS N'EST PAS DANS `guides`. Il vit dans `guide_versions`, table en
 *    ajout seul. Un guide sans version n'a donc pas de texte — et comme §2.1
 *    veut un brouillon « enregistré côté serveur », la création du brouillon
 *    écrit déjà la version 1. La publication ne fait que changer l'état : c'est
 *    la seule lecture de §2.1 (« Publication → PUBLISHED, guide_versions v1 »)
 *    qui donne au brouillon un endroit où exister. Tant que le guide est
 *    DRAFT, cette version 1 est modifiée SUR PLACE : l'historique public
 *    commence à la publication, et enregistrer une version par frappe de
 *    l'éditeur auto-sauvegardé n'aurait aucun sens.
 *
 * 2. LES LISTES NE FONT PAS CONFIANCE AUX TÂCHES. La règle dure du §2.6 — un
 *    guide UNPUBLISHED, ou FLAGGED depuis plus de 30 jours, n'apparaît dans
 *    aucune liste publique — est appliquée par la REQUÊTE, pas seulement par la
 *    tâche `guide.outdated_unpublish`. Une tâche qui n'a pas tourné cette nuit
 *    ne doit pas rendre un guide périmé visible.
 *
 * 3. TOUTE LISTE PASSE PAR `VisibilityService`. Un membre bloqué disparaît, dans
 *    les deux sens, et le filtre est écrit de façon SÛRE AUX NULL : un guide
 *    anonymisé (auteur nul, §8) doit rester visible, alors qu'un
 *    `author_user_id NOT IN (…)` l'éliminerait silencieusement.
 *
 * 4. LE CORPS N'EST PLUS « LE » CORPS : IL Y EN A UN PAR PAGE. Depuis la
 *    fonctionnalité de pages (modèle `GuidePage`), la chaîne de versions descend
 *    du GUIDE vers la PAGE : `guide_pages.current_version_id` →
 *    `guide_versions.body`. Quatre conséquences se lisent partout dans ce
 *    fichier, et il vaut mieux les connaître avant :
 *
 *      · CE QUI RESTE SUR LE GUIDE : le `status` (publication d'un BLOC,
 *        décision du porteur — le lecteur ne tombe jamais sur un guide à trous),
 *        `last_content_update_at`, `freshness_score`, `helpful_count`, les votes,
 *        les signalements, les contributeurs et `guide_media`. On vote sur un
 *        guide, pas sur une page ;
 *      · CE QUI DESCEND SUR LA PAGE : le corps, le titre de section, et les
 *        COMMENTAIRES (`comments.subject_type = 'GUIDE_PAGE'`) ;
 *      · `guides.current_version_id` EST DÉPRÉCIÉE mais TENUE À JOUR sur la
 *        PREMIÈRE page — voir `syncGuideCurrentVersion`, qui dit pourquoi ;
 *      · LES DEUX COMPTEURS DE COMMENTAIRES NE SONT PAS LE MÊME. La LISTE porte
 *        le TOTAL du guide, le DÉTAIL celui de la page lue. C'est la décision du
 *        porteur, et les deux nombres sont justes là où ils sont — voir
 *        `pageCommentCounts` et `listCounts`.
 */
/**
 * Ce que porte une carte de liste (§5). Déclaré au niveau du module pour que
 * `Prisma.GuideGetPayload` puisse s'y référer : le type d'une ligne de liste est
 * alors DÉRIVÉ de la requête, et non recopié à côté d'elle.
 */
const LIST_INCLUDE = {
  author: { select: { handle: true, displayName: true, verificationLevel: true } },
  originCountry: { select: { id: true, iso2: true, nameFr: true } },
  city: { select: { id: true, name: true } },
} as const satisfies Prisma.GuideInclude;

type GuideListRow = Prisma.GuideGetPayload<{ include: typeof LIST_INCLUDE }>;

/**
 * Les pages VIVANTES d'un guide, dans l'ordre du lecteur, avec le corps courant
 * de chacune.
 *
 * `where: { deletedAt: null }` n'est pas une précaution : une page retirée garde
 * ses versions (l'historique est en ajout seul, §2.7) et ses commentaires, et sa
 * `position` est passée en NÉGATIF pour libérer la place. L'omettre ferait
 * réapparaître son corps dans la publication, dans la modération et dans le
 * balayage des images.
 *
 * Déclaré une fois pour que les six chargements qui en ont besoin lisent
 * EXACTEMENT la même chose : `loadOwned`, `loadVotable`, la publication, le
 * retour arrière, les décisions de proposition et `byIdForAuthor`. Six copies
 * auraient fini par ne plus filtrer la même chose.
 */
const PAGES_WITH_BODY = {
  where: { deletedAt: null },
  orderBy: { position: 'asc' },
  select: {
    id: true,
    position: true,
    title: true,
    slug: true,
    currentVersionId: true,
    currentVersion: { select: { id: true, body: true } },
  },
} as const;

/** Une page telle que `PAGES_WITH_BODY` la rend. */
type PageWithBody = {
  id: string;
  position: number;
  title: string;
  slug: string;
  currentVersionId: string | null;
  currentVersion: { id: string; body: string } | null;
};

/**
 * Le compteur de vues des guides — 05 §5 : « `guides.view_count` **Ajoutée**,
 * compteur APPROXIMATIF (incrément Redis, flush horaire) ».
 *
 * UN PORT, et non un appel direct à Redis, pour deux raisons :
 *
 *   · les tests de guides construisent le service à la main, sans Redis. Sans port
 *     facultatif, il faudrait une instance Redis pour éprouver la publication d'un
 *     guide — c'est-à-dire échanger une dépendance d'infrastructure contre un
 *     compteur qui, de son propre aveu, est approximatif ;
 *   · le drain doit être ATOMIQUE, et c'est la seule propriété qui compte ici. La
 *     mettre derrière une interface permet de l'éprouver, et de dire dans un seul
 *     endroit pourquoi elle est indispensable (voir `RedisGuideViewCounter`).
 *
 * `null` (pas de compteur branché) est un cas NORMAL, pas une panne : la lecture
 * d'un guide ne doit jamais échouer parce qu'un compteur interne est absent.
 */
export interface GuideViewCounterPort {
  /** Une vue de plus, en attente de vidage. Ne doit JAMAIS lever. */
  increment(guideId: string): Promise<void>;
  /**
   * PRÉLÈVE au plus `limit` compteurs et les REND. L'implémentation doit lire et
   * effacer dans la même opération atomique — voir `guide.view_count_flush`.
   */
  drain(limit: number): Promise<ReadonlyMap<string, number>>;
}

export const GUIDE_VIEW_COUNTER = Symbol('GUIDE_VIEW_COUNTER');


@Injectable()
export class GuidesService {
  private readonly logger = new Logger(GuidesService.name);
  private readonly cursorSecret: string;

  /** Guides vidés par passage de `guide.view_count_flush`. Voir la méthode. */
  private static readonly VIEW_FLUSH_BATCH = 5_000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
    private readonly visibility: VisibilityService,
    @Inject(AI_MODERATION_PROVIDER) private readonly moderation: AiModerationProvider,
    @Optional()
    @Inject(GUIDE_VIEW_COUNTER)
    private readonly views: GuideViewCounterPort | null = null,
  ) {
    this.cursorSecret = loadEnv().CURSOR_SECRET;
  }

  private fail(code: GuideErrorCode, details?: Record<string, unknown>): never {
    throw new ApiError(code, GUIDE_ERROR_MESSAGES[code], GUIDE_ERROR_CODES[code], details);
  }

  // ════════════════════════════════════════════════════════════════════════
  // Lectures
  // ════════════════════════════════════════════════════════════════════════

  /**
   * RÈGLE DURE (§2.6) : ni les guides UNPUBLISHED, ni les guides FLAGGED dont
   * le délai de correction est écoulé, ne sortent d'ici.
   *
   * `unpublish_deadline_at` porte la date du §2.6 (`now + 30 jours` au moment du
   * troisième signalement) : la comparer à maintenant dit « signalé depuis plus
   * de 30 jours » sans avoir à retrouver la date de passage en FLAGGED, que le
   * schéma ne garde pas.
   */
  private publiclyVisible(now: Date): Prisma.GuideWhereInput {
    return {
      deletedAt: null,
      OR: [
        { status: 'PUBLISHED' },
        // FLAGGED reste visible pendant le délai : §2.3 le veut dans l'onglet
        // « À vérifier », avec son bandeau d'alerte.
        { status: 'FLAGGED', unpublishDeadlineAt: { gt: now } },
      ],
    };
  }

  /**
   * Les guides des membres séparés du lecteur disparaissent — dans les DEUX
   * sens (08 §4).
   *
   * Le `OR` avec `authorUserId: null` n'est pas une précaution de style : un
   * guide anonymisé n'a plus d'auteur, et `author_user_id NOT IN (…)` est faux
   * pour NULL en SQL. Sans lui, la suppression d'un compte ferait disparaître de
   * la liste les guides que §8 demande précisément de CONSERVER, dès que le
   * lecteur a bloqué quelqu'un.
   */
  private notSeparated(separated: readonly string[]): Prisma.GuideWhereInput {
    if (separated.length === 0) return {};
    return { OR: [{ authorUserId: null }, { authorUserId: { notIn: [...separated] } }] };
  }

  /** GET /guides — onglets et filtres du §2.3. */
  async list(query: GuideListQuery, viewerId: string | null): Promise<Page<GuideListItem>> {
    const now = new Date();
    const separated = await this.visibility.separatedFrom(viewerId);

    const viewer =
      viewerId === null
        ? null
        : await this.prisma.user.findUnique({
            where: { id: viewerId },
            select: { originCountryId: true },
          });

    const conditions: Prisma.GuideWhereInput[] = [
      this.publiclyVisible(now),
      this.notSeparated(separated),
    ];

    if (query.category !== undefined) conditions.push({ category: query.category });
    if (query.cityId !== undefined) conditions.push({ cityId: query.cityId });
    /**
     * LES GUIDES D'UN MEMBRE — l'onglet « Guides » de son profil public.
     *
     * Le filtre s'AJOUTE à `publiclyVisible` et `notSeparated`, qui restent
     * devant : demander l'auteur ne montre pas un brouillon, ni un guide retiré,
     * ni celui de quelqu'un dont on est séparé.
     */
    if (query.authorHandle !== undefined) {
      conditions.push({ author: { handle: query.authorHandle } });
    }

    /**
     * §2.3 : « Un guide UNIVERSAL apparaît pour tous ; un guide COUNTRY
     * n'apparaît par défaut que pour les membres de ce pays d'origine (filtre
     * modifiable). »
     *
     * Le filtre explicite l'emporte ; sinon on retient le pays du lecteur.
     * Un visiteur ANONYME voit tout : nous ne connaissons pas son pays, et lui
     * cacher les guides COUNTRY viderait la liste de sa substance.
     */
    const countryFilter = query.countryId ?? viewer?.originCountryId;
    if (countryFilter !== undefined && countryFilter !== null) {
      conditions.push({ OR: [{ scope: 'UNIVERSAL' }, { originCountryId: countryFilter }] });
    }

    const staleBefore = this.monthsAgo(GUIDE_STALE_MONTHS, now);
    if (query.tab === 'review') {
      // §2.3 : « guides FLAGGED ou > 24 mois, par ancienneté ».
      conditions.push({
        OR: [{ status: 'FLAGGED' }, { lastContentUpdateAt: { lt: staleBefore } }],
      });
    }

    const scope = [
      'guides',
      query.tab,
      query.category ?? '',
      countryFilter ?? '',
      query.cityId ?? '',
      // Le curseur d'un anonyme ne vaut pas pour un membre : les deux ne voient
      // pas la même liste (pays d'origine, blocages).
      viewerId ?? 'anon',
    ].join(':');

    const cursor =
      query.cursor === undefined
        ? null
        : decodeCursor(query.cursor, this.cursorSecret, scope);

    const keyset = this.keysetFor(query.tab, cursor);
    if (keyset !== null) conditions.push(keyset);

    const rows = await this.prisma.guide.findMany({
      where: { AND: conditions },
      orderBy: this.orderByFor(query.tab),
      take: query.limit + 1,
      include: LIST_INCLUDE,
    });

    const page = buildPage(rows, query.limit, scope, this.cursorSecret, (row) =>
      query.tab === 'helpful'
        ? row.freshnessScore.toString()
        : row.lastContentUpdateAt.toISOString(),
    );

    const counts = await this.listCounts(
      page.items.map((row) => row.id),
      viewerId,
    );

    return {
      items: page.items.map((row) => this.toListItem(row, now, counts.get(row.id))),
      nextCursor: page.nextCursor,
      // T4 §4 : la règle affichée voyage avec la liste, elle n'est pas codée en
      // dur dans le front. Ici, le seuil du bandeau « À vérifier ».
      meta: { tab: query.tab, staleAfterMonths: GUIDE_STALE_MONTHS },
    };
  }

  private orderByFor(tab: GuideListQuery['tab']): Prisma.GuideOrderByWithRelationInput[] {
    if (tab === 'helpful') return [{ freshnessScore: 'desc' }, { id: 'desc' }];
    if (tab === 'review') return [{ lastContentUpdateAt: 'asc' }, { id: 'asc' }];
    return [{ lastContentUpdateAt: 'desc' }, { id: 'desc' }];
  }

  /**
   * Pagination par clé composite : (valeur de tri, identifiant). Le second
   * critère départage les ex æquo — sans lui, deux guides de même score
   * feraient boucler ou sauter la page suivante.
   */
  private keysetFor(
    tab: GuideListQuery['tab'],
    cursor: { id: string; sort?: string | number } | null,
  ): Prisma.GuideWhereInput | null {
    if (cursor === null || cursor.sort === undefined) return null;

    if (tab === 'helpful') {
      const sort = String(cursor.sort);
      return {
        OR: [
          { freshnessScore: { lt: sort } },
          { freshnessScore: sort, id: { lt: cursor.id } },
        ],
      };
    }

    const sort = new Date(String(cursor.sort));
    if (tab === 'review') {
      return {
        OR: [
          { lastContentUpdateAt: { gt: sort } },
          { lastContentUpdateAt: sort, id: { gt: cursor.id } },
        ],
      };
    }
    return {
      OR: [
        { lastContentUpdateAt: { lt: sort } },
        { lastContentUpdateAt: sort, id: { lt: cursor.id } },
      ],
    };
  }

  /**
   * Les bandeaux du §2.3 et du §2.6, calculés par le serveur.
   *
   * Le front ne recompose pas les seuils : 24 mois et 3 signalements sont des
   * règles métier, et deux implémentations de la même règle divergent toujours.
   */
  private bannersFor(
    guide: { status: string; maintainedByCommunity: boolean; lastContentUpdateAt: Date },
    now: Date,
  ): GuideBanner[] {
    const banners: GuideBanner[] = [];
    const months = monthsSince(guide.lastContentUpdateAt, now);
    if (months > GUIDE_STALE_MONTHS) banners.push({ kind: 'TO_VERIFY', months });
    if (guide.status === 'FLAGGED') banners.push({ kind: 'OUTDATED_REPORTED' });
    if (guide.maintainedByCommunity) banners.push({ kind: 'COMMUNITY_MAINTAINED' });
    return banners;
  }

  /**
   * LES DEUX COMPTEURS SONT DONNÉS, JAMAIS DEVINÉS.
   *
   * `counts` est un paramètre et non une requête faite ici, pour une raison
   * mesurée : cette méthode est appelée dans une boucle sur une page de liste
   * (jusqu'à 50 guides). Y lire la base ferait 50 requêtes par page, et
   * `listCounts` les fait en deux.
   *
   * `undefined` est traité comme « un guide d'une page, sans commentaire ». Ce
   * n'est pas une valeur attendue — tout guide a au moins une page — mais un
   * appelant qui l'oublierait doit rendre une carte, pas lever : la liste des
   * guides ne se vide pas parce qu'un compteur manque.
   */
  private toListItem(
    row: GuideListRow,
    now: Date,
    counts: { pageCount: number; commentCount: number } | undefined,
  ): GuideListItem {
    return {
      pageCount: counts?.pageCount ?? 1,
      commentCount: counts?.commentCount ?? 0,
      id: row.id,
      slug: row.slug,
      title: row.title,
      category: row.category,
      scope: row.scope,
      status: row.status,
      // RÈGLE DURE (§9) : la date de dernière mise à jour est renvoyée sur
      // CHAQUE guide de liste — « aussi visible que le titre » (T1 §6).
      lastContentUpdateAt: row.lastContentUpdateAt,
      helpfulCount: row.helpfulCount,
      freshnessScore: row.freshnessScore.toNumber(),
      maintainedByCommunity: row.maintainedByCommunity,
      author: row.author,
      country: row.originCountry,
      city: row.city,
      banners: this.bannersFor(row, now),
    };
  }

  /**
   * GET /guides/:slug — §4, et `?page=<slug de page>` depuis les pages.
   *
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ UN GUIDE À UNE PAGE RÉPOND EXACTEMENT COMME AVANT                        ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * C'est la garantie qui tient tous les liens déjà partagés, et c'est la raison
   * pour laquelle §2.1 fige le slug d'un guide à la publication. `pageSlug`
   * absent prend donc la PREMIÈRE page — celle que la reprise de données a donnée
   * à chacun des 127 guides existants, avec le titre du guide et son corps
   * d'alors. `currentVersion` porte le corps de cette page, `commentCount` ses
   * commentaires : pour un guide d'une seule page, les trois sont ce qu'ils
   * étaient.
   *
   * UN SLUG DE PAGE INCONNU DONNE 404, et jamais la première page. Rendre autre
   * chose que ce qui est demandé ferait croire au lecteur qu'il lit la page du
   * lien — et il commenterait sous une page qu'il n'a pas choisie.
   */
  async bySlug(slug: string, viewerId: string | null, pageSlug?: string) {
    const now = new Date();
    const guide = await this.prisma.guide.findUnique({
      where: { slug },
      include: {
        ...LIST_INCLUDE,
        pages: {
          where: { deletedAt: null },
          orderBy: { position: 'asc' },
          select: {
            id: true,
            position: true,
            title: true,
            slug: true,
            currentVersion: {
              select: {
                id: true,
                version: true,
                body: true,
                summary: true,
                createdAt: true,
                createdBy: { select: { handle: true, displayName: true } },
              },
            },
          },
        },
        contributors: {
          orderBy: { acceptedCount: 'desc' },
          select: {
            acceptedCount: true,
            firstAt: true,
            user: { select: { handle: true, displayName: true } },
          },
        },
      },
    });

    if (guide === null || guide.deletedAt !== null) throw ApiError.notFound();

    const isAuthor = viewerId !== null && guide.authorUserId === viewerId;
    const visible =
      guide.status === 'PUBLISHED' ||
      (guide.status === 'FLAGGED' &&
        guide.unpublishDeadlineAt !== null &&
        guide.unpublishDeadlineAt > now);

    // L'auteur voit son brouillon et son guide dépublié ; personne d'autre.
    // 404 et non 403 (T4 §3) : l'existence d'un brouillon ne se révèle pas.
    if (!visible && !isAuthor) throw ApiError.notFound();

    if (guide.authorUserId !== null) {
      await this.visibility.assertVisible(viewerId, guide.authorUserId);
    }

    /**
     * LA PAGE LUE EST CHOISIE AVANT TOUT LE RESTE, et un 404 part d'ici.
     *
     * `pages` ne peut pas être vide : `LAST_PAGE` interdit de retirer la
     * dernière, et la reprise de données en a donné une à chaque guide. Le cas
     * est quand même traité — en 404 — parce qu'une base réparée à la main
     * pourrait le produire, et qu'un `pages[0]!` planterait en 500 sur un guide
     * que personne ne peut plus lire ni corriger.
     */
    const pages = guide.pages;
    const currentPageRow =
      pageSlug === undefined ? pages[0] : pages.find((page) => page.slug === pageSlug);
    if (currentPageRow === undefined) throw ApiError.notFound();

    const [myVote, myFlag, pageCounts] = await Promise.all([
      viewerId === null
        ? Promise.resolve(null)
        : this.prisma.guideVote.findUnique({
            where: { guideId_userId: { guideId: guide.id, userId: viewerId } },
            select: { value: true },
          }),
      viewerId === null
        ? Promise.resolve(null)
        : this.prisma.guideOutdatedFlag.findUnique({
            where: { guideId_userId: { guideId: guide.id, userId: viewerId } },
            select: { id: true, comment: true },
          }),
      this.pageCommentCounts(
        pages.map((page) => page.id),
        viewerId,
      ),
    ]);

    const pageRefs: GuidePageRef[] = pages.map((page) => ({
      id: page.id,
      position: page.position,
      title: page.title,
      slug: page.slug,
      commentCount: pageCounts.get(page.id) ?? 0,
    }));
    const currentPage =
      pageRefs.find((page) => page.id === currentPageRow.id) ??
      ({
        id: currentPageRow.id,
        position: currentPageRow.position,
        title: currentPageRow.title,
        slug: currentPageRow.slug,
        commentCount: 0,
      } satisfies GuidePageRef);

    // La vue est comptée ICI et pas plus haut : après les trois refus (guide
    // absent, non visible, auteur bloqué), donc seulement quand le guide a
    // vraiment été RENDU. Compter avant ferait du compteur une mesure de
    // tentatives, ce qui n'est pas ce que §5 annonce.
    //
    // ET ELLE N'EST JAMAIS RENVOYÉE (règle dure 00 §1.2 : « aucun compteur de vues
    // n'est exposé à personne, sur aucun contenu »). Un test de l'OpenAPI le tient :
    // `capability-coverage.int.test.ts` échoue si `viewCount` apparaît dans le
    // contrat, et c'est le contrat que le front consomme.
    await this.countView(guide.id);

    return {
      guide: {
        // Sur le DÉTAIL, `commentCount` est celui de LA PAGE LUE — décision du
        // porteur, et c'est le nombre qui coiffe le fil rendu juste en dessous.
        // Le total du guide reste lisible : c'est la somme des
        // `pages[].commentCount`, et c'est lui que la carte de liste porte.
        ...this.toListItem(guide, now, {
          pageCount: pages.length,
          commentCount: currentPage.commentCount,
        }),
        originCountryId: guide.originCountryId,
        outdatedFlagCount: guide.outdatedFlagCount,
        unpublishDeadlineAt: guide.unpublishDeadlineAt,
        createdAt: guide.createdAt,
        isAuthor,
      },
      pages: pageRefs,
      currentPage,
      // LA VERSION COURANTE DE LA PAGE LUE, et non celle du guide : le champ a
      // changé de sens avec les pages, et c'est le seul corps que A04 affiche.
      currentVersion: currentPageRow.currentVersion,
      contributors: guide.contributors,
      myVote: myVote?.value ?? null,
      myOutdatedFlag: myFlag,
    };
  }

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ « COMMENTAIRES » : DEUX NOMBRES, ET UN SEUL CRITÈRE DE VISIBILITÉ        ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur : « Les commentaires concernent donc une page du guide, et c'est
   * LE TOTAL qui est affiché sur la page de listing des guides. » Il y a donc
   * deux calculs, et c'est voulu :
   *
   *   · sur le DÉTAIL (`GET /guides/:slug`), le nombre est celui de LA PAGE LUE,
   *     parce qu'il coiffe le fil rendu juste en dessous. C'est la règle que
   *     `chargerH02` tient déjà côté écran pour les réponses d'entraide : le
   *     nombre annoncé est la LONGUEUR DE LA LISTE RENDUE, jamais un compteur à
   *     côté. Le fil d'un guide, c'est `GET /comments?subjectType=GUIDE_PAGE&
   *     subjectId=<currentPage.id>` — donc son nombre est celui de cette page ;
   *   · sur la LISTE (`GET /guides`, `GET /me/guides`), c'est le TOTAL du guide,
   *     toutes pages confondues : un lecteur qui choisit un guide veut savoir si
   *     la démarche entière a fait parler, pas si sa première page l'a fait.
   *
   * ── LE CRITÈRE EST CELUI DE LA LISTE, REPRIS ET NON REDIT ────────────────
   *
   * `commentCountWhere` (`common/comment-visibility.ts`) est bâtie sur le MÊME
   * fragment que `FeedService.commentPage` applique pour dresser le fil : non
   * supprimé, PUBLISHED ou masqué par la modération, auteur vivant (`ACTIVE` ou
   * `SUSPENDED`) et non séparé du lecteur (08 §4), et racine visible pour une
   * réponse. Le critère vit dans un fichier commun plutôt que recopié, parce
   * qu'un compteur qui compte autre chose que ce que la liste affiche est un
   * mensonge à l'écran — « 12 commentaires », puis un fil qui en montre neuf, et
   * un membre qui cherche les trois autres. DEUX calculs, UN critère : c'est ce
   * partage qui garantit que la somme des pages égale le total du guide.
   *
   * ── CE QUI N'A PAS CHANGÉ AVEC LES PAGES ─────────────────────────────────
   *
   * Les emplacements RETIRÉS par la modération comptent (une ligne grise est une
   * ligne rendue) ; les suppressions par l'auteur ne comptent pas ; les RÉPONSES
   * comptent, sauf celles dont la racine n'apparaît pas. Tout cela est écrit, avec
   * son prix, dans `comment-visibility.ts` — ne pas le redire ici était le but de
   * l'extraire.
   *
   * ── IL DÉPEND DU LECTEUR, DONC IL NE SE CACHE PAS ────────────────────────
   *
   * Deux membres n'ont pas les mêmes blocages : ces nombres ne sont pas des
   * propriétés du guide ni de la page, et n'ont leur place ni dans une colonne
   * `guides.*` ni dans une colonne `guide_pages.*`. C'est aussi pourquoi ils sont
   * calculés à chaque lecture, comme `myVote`, et non incrémentés quelque part.
   *
   * ── UN SEUL `groupBy`, ET NON UNE REQUÊTE PAR PAGE ───────────────────────
   *
   * Un guide de dix pages aurait coûté dix `count`, et une liste de cinquante
   * guides cinq cents. Le `groupBy` par `subject_id` en fait UNE, et l'index
   * `comments(subject_type, subject_id)` la sert. Les pages sans commentaire
   * n'apparaissent pas dans le résultat : la carte est donc PRÉ-REMPLIE à zéro,
   * sinon une page muette rendrait `undefined` et l'écran afficherait « NaN ».
   */
  private async pageCommentCounts(
    pageIds: readonly string[],
    viewerId: string | null,
  ): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    for (const id of pageIds) counts.set(id, 0);
    if (pageIds.length === 0) return counts;

    const separated = await this.visibility.separatedFrom(viewerId);
    const rows = await this.prisma.comment.groupBy({
      by: ['subjectId'],
      where: {
        AND: [
          ...commentCountWhere(separated),
          { subjectType: 'GUIDE_PAGE', subjectId: { in: [...pageIds] } },
        ],
      },
      _count: { _all: true },
    });
    for (const row of rows) counts.set(row.subjectId, row._count._all);
    return counts;
  }

  /**
   * `pageCount` et le TOTAL de commentaires, pour une page de liste entière.
   *
   * DEUX REQUÊTES POUR N GUIDES, et c'est la raison d'être de cette méthode : les
   * identifiants de pages sont nécessaires pour compter les commentaires (ils
   * portent `subject_id`), et une fois ramenés ils donnent `pageCount` sans rien
   * demander de plus. Un `_count` de relation filtré aurait rendu `pageCount`
   * seul, et il aurait fallu une seconde lecture des pages pour les compteurs.
   */
  private async listCounts(
    guideIds: readonly string[],
    viewerId: string | null,
  ): Promise<Map<string, { pageCount: number; commentCount: number }>> {
    const totals = new Map<string, { pageCount: number; commentCount: number }>();
    if (guideIds.length === 0) return totals;

    const pages = await this.prisma.guidePage.findMany({
      where: { guideId: { in: [...guideIds] }, deletedAt: null },
      select: { id: true, guideId: true },
    });
    const counts = await this.pageCommentCounts(
      pages.map((page) => page.id),
      viewerId,
    );

    for (const page of pages) {
      const current = totals.get(page.guideId) ?? { pageCount: 0, commentCount: 0 };
      totals.set(page.guideId, {
        pageCount: current.pageCount + 1,
        commentCount: current.commentCount + (counts.get(page.id) ?? 0),
      });
    }
    return totals;
  }

  /** GET /guides/:slug/versions — historique public (§2.7). */
  async versions(slug: string, viewerId: string | null) {
    const guide = await this.readableGuideBySlug(slug, viewerId);
    const items = await this.prisma.guideVersion.findMany({
      where: { guideId: guide.id },
      orderBy: { version: 'desc' },
      select: {
        id: true,
        version: true,
        summary: true,
        createdAt: true,
        sourceProposalId: true,
        // Le CORPS n'est pas dans la liste : l'historique sert à choisir une
        // version, pas à télécharger le guide vingt fois.
        createdBy: { select: { handle: true, displayName: true } },
      },
    });
    return { items, nextCursor: null, meta: { currentVersionId: guide.currentVersionId } };
  }

  /** GET /guides/:slug/versions/:versionId. */
  async version(slug: string, versionId: string, viewerId: string | null) {
    const guide = await this.readableGuideBySlug(slug, viewerId);
    const version = await this.prisma.guideVersion.findFirst({
      // `guideId` dans la clause, et non une simple recherche par identifiant :
      // sinon l'identifiant d'une version d'un AUTRE guide, non lisible,
      // sortirait par cette route.
      where: { id: versionId, guideId: guide.id },
      select: {
        id: true,
        version: true,
        body: true,
        summary: true,
        createdAt: true,
        sourceProposalId: true,
        createdBy: { select: { handle: true, displayName: true } },
      },
    });
    if (version === null) throw ApiError.notFound();
    return version;
  }

  private async readableGuideBySlug(slug: string, viewerId: string | null) {
    const guide = await this.prisma.guide.findUnique({
      where: { slug },
      select: {
        id: true,
        authorUserId: true,
        status: true,
        deletedAt: true,
        currentVersionId: true,
        unpublishDeadlineAt: true,
      },
    });
    if (guide === null || guide.deletedAt !== null) throw ApiError.notFound();

    const now = new Date();
    const visible =
      guide.status === 'PUBLISHED' ||
      (guide.status === 'FLAGGED' &&
        guide.unpublishDeadlineAt !== null &&
        guide.unpublishDeadlineAt > now);
    if (!visible && guide.authorUserId !== viewerId) throw ApiError.notFound();
    if (guide.authorUserId !== null) {
      await this.visibility.assertVisible(viewerId, guide.authorUserId);
    }
    return guide;
  }

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ GET /guides/:slug/editor — RELIRE SON PROPRE GUIDE, TOUTES PAGES COMPRISES ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * CE QUI MANQUAIT, mesuré avant ce lot et écrit en toutes lettres dans
   * `use-editeur-guide.ts` : AUCUNE route ne rendait le corps de plusieurs pages
   * sans écrire. `GET /guides/:slug` est `@PublicRead()`, ne sert pas un brouillon
   * à quiconque, et ne rend que le corps de LA page lue ; les neuf réponses qui
   * portent un corps sont celles des ÉCRITURES. L'éditeur s'en sortait parce que
   * `/guides/nouveau` crée lui-même chacune de ses pages et garde leurs corps en
   * mémoire de session — ce qui ne peut pas marcher sur un guide EXISTANT, et le
   * lot précédent l'avait remonté plutôt que bricolé.
   *
   * ── LA RÈGLE D'ACCÈS N'EST PAS RÉÉCRITE : C'EST `loadOwned` ────────────────
   *
   * Le slug est résolu en identifiant, puis `loadOwned` tranche — et il tranche
   * exactement comme pour les neuf écritures : 404 sur un brouillon d'autrui (un
   * brouillon ne se devine pas, et un 403 révélerait qu'il existe), `NOT_AUTHOR`
   * sur un guide PUBLIÉ dont on n'est pas l'auteur (celui-là existe
   * publiquement : le refus peut se dire). Une seconde règle écrite ici aurait
   * divergé de celle des écritures, et c'est la pire divergence possible — un
   * écran qui s'ouvre sur un guide que le serveur refusera d'enregistrer.
   *
   * ⚠ ET C'EST POURQUOI LA ROUTE EST SOUS `guide.write` (N2) ET NON
   * `content.read` : elle sert un BROUILLON, donc du contenu que son auteur n'a
   * pas publié, et elle n'a de sens que pour qui peut l'écrire.
   *
   * ── LES CORPS NE COÛTENT PAS UNE REQUÊTE DE PLUS ──────────────────────────
   *
   * `loadOwned` charge déjà `pages: PAGES_WITH_BODY` — « les sept écritures qui
   * passent par ici en ont toutes besoin ». Les corps sont donc DÉJÀ en main : on
   * les apparie au plan que `byIdForAuthor` compose, au lieu d'interroger la base
   * une seconde fois pour ce qu'elle vient de rendre.
   *
   * `byIdForAuthor` EST APPELÉ SANS `focusPageId`, donc `currentPage` et
   * `currentVersion` décrivent la PREMIÈRE page — la même que la route de lecture
   * publique rend par défaut. L'éditeur ouvre sur la page 1 ; la barre latérale
   * sert à aller ailleurs, et elle a maintenant de quoi le faire sans écrire.
   */
  async editorBySlug(slug: string, userId: string) {
    const row = await this.prisma.guide.findUnique({ where: { slug }, select: { id: true } });
    if (row === null) throw ApiError.notFound();
    const owned = await this.loadOwned(row.id, userId);
    const base = await this.byIdForAuthor(row.id, userId);
    const corps = new Map(
      owned.pages.map((page) => [page.id, page.currentVersion?.body ?? ''] as const),
    );
    return {
      ...base,
      /**
       * `?? ''` N'EST PAS DÉFENSIF CONTRE RIEN : les deux listes viennent du même
       * `deletedAt: null` ordonné par `position`, donc chaque page du plan a son
       * corps. Le repli existe parce que le type d'une `Map` ne le promet pas, et
       * la chaîne vide est de toute façon ce qu'une page sans version courante
       * rend.
       */
      pages: base.pages.map((page) => ({ ...page, body: corps.get(page.id) ?? '' })),
    };
  }

  /** GET /me/guides — tous statuts (§4). */
  async mine(userId: string, limit: number) {
    const now = new Date();
    const rows = await this.prisma.guide.findMany({
      where: { authorUserId: userId, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      include: LIST_INCLUDE,
    });
    const counts = await this.listCounts(
      rows.map((row) => row.id),
      userId,
    );
    return {
      items: rows.map((row) => this.toListItem(row, now, counts.get(row.id))),
      nextCursor: null,
    };
  }

  /** GET /me/proposals — mes propositions (§4). */
  async myProposals(userId: string, limit: number) {
    const items = await this.prisma.guideRevisionProposal.findMany({
      where: { proposerUserId: userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        status: true,
        targetExcerpt: true,
        replacement: true,
        reason: true,
        sourceUrl: true,
        rejectReason: true,
        escalateAt: true,
        decidedAt: true,
        createdAt: true,
        guide: { select: { id: true, slug: true, title: true } },
      },
    });
    return { items, nextCursor: null };
  }

  // ════════════════════════════════════════════════════════════════════════
  // Rédaction
  // ════════════════════════════════════════════════════════════════════════

  /**
   * POST /guides — brouillon (§2.1).
   *
   * UN GUIDE NAÎT AVEC UNE PAGE, et la route ne connaît que celle-là : son corps
   * devient la page 1, titrée comme le guide. C'est ce qui rend
   * `createGuideSchema` inchangé — l'éditeur A05 envoie toujours
   * `{ title, body, … }` — et c'est la même forme que la reprise de données a
   * donnée aux 127 guides d'avant les pages. Les pages suivantes s'ajoutent par
   * `POST /guides/:id/pages`.
   */
  async createDraft(userId: string, input: CreateGuide) {
    return this.createGuideWithPages(userId, input, [{ title: input.title, body: input.body }]);
  }

  /**
   * Le chemin commun de `POST /guides` et de `POST /journeys/:id/to-guide`.
   *
   * POURQUOI IL EXISTE : la conversion d'un parcours produit UNE PAGE PAR ÉTAPE
   * (voir `draftFromJourney`), donc plusieurs pages d'un coup. Les créer par
   * `createDraft` puis `addPage` aurait écrit un guide d'une page, PUIS l'aurait
   * modifié N fois — donc N resynchronisations d'images, N bascules de
   * `last_content_update_at`, et un guide à moitié né visible en base entre deux
   * appels. Tout est ici, dans UNE transaction.
   *
   * `pages` est non vide : un guide sans page n'a pas de corps.
   */
  private async createGuideWithPages(
    userId: string,
    input: CreateGuide,
    pages: readonly { title: string; body?: string }[],
  ) {
    // RÈGLE DURE (§2.1) : « certifié » et ses dérivés sont rejetés dans le
    // TITRE. Pas dans le corps : un guide doit pouvoir nommer « le certificat
    // de scolarité » ou citer un document officiel. Les titres de PAGE sont
    // soumis à la même règle : ils s'affichent comme des intertitres du guide.
    this.assertTitleAllowed(input.title);
    for (const page of pages) this.assertTitleAllowed(page.title);
    await this.assertPlacesExist(input.originCountryId, input.cityId);

    const now = new Date();
    const guideId = newId();

    await this.prisma.$transaction(async (tx) => {
      await tx.guide.create({
        data: {
          id: guideId,
          authorUserId: userId,
          title: input.title,
          slug: await this.freeSlug(tx, input.title),
          category: input.category,
          scope: input.scope,
          originCountryId: input.scope === 'COUNTRY' ? (input.originCountryId ?? null) : null,
          cityId: input.cityId ?? null,
          status: 'DRAFT',
          // Non nulle en base. La date de création fait un point de départ
          // honnête : le brouillon est à jour au moment où il est écrit.
          lastContentUpdateAt: now,
        },
      });

      for (const [index, page] of pages.entries()) {
        const pageId = newId();
        await tx.guidePage.create({
          data: {
            id: pageId,
            guideId,
            // 1 et non 0 : la position est ce que le lecteur compte (« page 2
            // sur 5 »), et un plan qui commence à zéro se relit mal en SQL.
            position: index + 1,
            title: page.title,
            slug: await this.freePageSlug(tx, guideId, page.title),
          },
        });
        if (page.body === undefined) continue;
        const version = await this.appendVersion(tx, {
          guideId,
          pageId,
          body: page.body,
          createdByUserId: userId,
        });
        await tx.guidePage.update({
          where: { id: pageId },
          data: { currentVersionId: version.id },
        });
        // Les images citées par le brouillon sont vérifiées et rattachées ICI,
        // dans la transaction qui écrit la version : un corps citant une image ne
        // doit jamais exister, même une seconde, sans le lien qui la retient.
        // `guide_media` est au niveau du GUIDE, donc le balayage lit TOUTES les
        // pages déjà écrites et remplace le corps de celle-ci — voir
        // `syncBodyMedia`.
        await this.syncBodyMedia(tx, {
          guideId,
          pageId,
          body: page.body,
          ownerUserId: userId,
        });
      }

      await this.syncGuideCurrentVersion(tx, guideId);
    });

    return this.byIdForAuthor(guideId, userId);
  }

  /**
   * PATCH /guides/:id — brouillon, ou édition directe par l'auteur (§2.7).
   *
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ `body` VA DANS UNE PAGE — `pageId` DIT LAQUELLE, ABSENT = LA PREMIÈRE    ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Le défaut n'est pas un confort, c'est la compatibilité : l'éditeur d'un guide
   * à une page envoie `{ body }` seul, comme avant les pages, et il atteint la
   * seule page qu'il y a. Un `pageId` inconnu — ou celui d'une page retirée, ou
   * d'une page d'un AUTRE guide — donne 404 : `pages` vient de `loadOwned`, donc
   * la recherche est bornée au guide du demandeur.
   *
   * `title` reste celui du GUIDE. Mais voir plus bas : il entraîne celui de la
   * PREMIÈRE page tant que personne ne l'a renommée à la main.
   */
  async update(userId: string, guideId: string, patch: UpdateGuide) {
    const guide = await this.loadOwned(guideId, userId);
    const isDraft = guide.status === 'DRAFT' || guide.status === 'UNPUBLISHED';

    const pages: PageWithBody[] = guide.pages;
    const target =
      patch.pageId === undefined ? pages[0] : pages.find((page) => page.id === patch.pageId);
    if (target === undefined) throw ApiError.notFound();

    if (patch.title !== undefined) {
      this.assertTitleAllowed(patch.title);
      // §2.1 : le slug n'est JAMAIS modifié après publication, et §4 ne permet
      // le titre que sur un brouillon. Un titre changé sans son slug donnerait
      // une adresse qui ne dit plus ce qu'elle contient.
      if (!isDraft && patch.title !== guide.title) {
        throw ApiError.transverse('CONFLICT', {
          field: 'title',
          reason: 'TITLE_LOCKED_AFTER_PUBLISH',
        });
      }
    }

    const country =
      patch.originCountryId === undefined ? guide.originCountryId : patch.originCountryId;
    const scope = patch.scope ?? guide.scope;
    if (scope === 'COUNTRY' && country === null) {
      throw ApiError.validation([{ path: 'originCountryId', code: 'REQUIRED_FOR_COUNTRY_SCOPE' }]);
    }
    await this.assertPlacesExist(patch.originCountryId ?? undefined, patch.cityId ?? undefined);

    const now = new Date();
    const bodyChanged =
      patch.body !== undefined && patch.body !== (target.currentVersion?.body ?? null);

    /**
     * ╔══════════════════════════════════════════════════════════════════════════╗
     * ║ L'ÉCRITURE DOIT PARTIR DE LA VERSION COURANTE — ARBITRAGE DU PORTEUR     ║
     * ╚══════════════════════════════════════════════════════════════════════════╝
     *
     * « Le serveur refuse une écriture qui ne part pas de la version courante,
     * avec un message clair : ce guide a été modifié ailleurs, rechargez. »
     *
     * MESURÉ AVANT L'ARBITRAGE, deux onglets sur le MÊME brouillon : le guide finit
     * avec UNE seule version, portant le texte du second onglet, et le texte du
     * premier n'est retrouvable dans AUCUNE version. Sur un guide publié la perte se
     * répare — l'historique est en ajout seul — mais sur un brouillon la version 1
     * est modifiée SUR PLACE, et la perte est définitive. L'enregistrement
     * automatique de l'éditeur écrit toutes les 1,5 s : deux onglets s'écrasent sans
     * que rien ne le signale.
     *
     * ── POURQUOI UNE COLONNE, ET PAS UN CHAMP DÉJÀ RENDU ──────────────────────
     *
     * Mesuré aussi : `guides.updated_at` ne bouge PAS entre deux enregistrements de
     * brouillon — le chemin « brouillon » n'écrit que `guide_versions.body`. Les
     * trois horodatages relevés étaient identiques à la milliseconde. Aucun champ
     * existant ne distinguait donc deux états d'un brouillon, d'où `guides.revision`.
     *
     * ── DEUX TEMPS, ET LE SECOND N'EST PAS DE LA CEINTURE ────────────────────
     *
     * ICI, avant la transaction : le refus NOMMÉ, sans rien écrire ni verrouiller.
     * PUIS, première écriture de la transaction, un `updateMany` conditionné sur la
     * même révision — parce que deux requêtes qui lisent la même valeur à la même
     * milliseconde passeraient toutes deux cette comparaison-ci.
     *
     * ── SEUL LE CORPS EST GARDÉ ──────────────────────────────────────────────
     *
     * Titre, catégorie et portée se refont d'un clic : les garder coûterait des
     * refus sans rien sauver. `updateGuideSchema` exige donc `baseRevision` avec
     * `body`, et avec lui seul.
     *
     * ── OÙ VIT L'EXIGENCE, ET POURQUOI PAS ICI ───────────────────────────────
     *
     * `baseRevision` ABSENT ne refuse pas. C'est `updateGuideSchema` qui l'exige
     * dès qu'un corps est envoyé, donc **tout client HTTP** qui l'omet reçoit un
     * `400` à la frontière — c'est la doctrine du dépôt : `packages/shared` est la
     * seule source de validation, et `.strict()` garde la frontière.
     *
     * Refuser aussi ICI un `undefined` ne protégerait contre aucun client réel, et
     * couperait les treize appels INTERNES du module (tests, conversion d'un
     * parcours en guide) qui écrivent un corps sans partir d'un éditeur concurrent.
     * On refuse donc ce qui est FAUX, pas ce qui est absent — et l'`updateMany`
     * conditionnel ci-dessous tient l'atomicité dans les deux cas.
     */
    if (bodyChanged && patch.baseRevision !== undefined && patch.baseRevision !== guide.revision) {
      throw ApiError.transverse('CONFLICT', {
        field: 'body',
        reason: 'EDITED_ELSEWHERE',
        expected: guide.revision,
        received: patch.baseRevision ?? null,
      });
    }

    await this.prisma.$transaction(async (tx) => {
      /**
       * LA RÉVISION EST RÉCLAMÉE AVANT TOUTE AUTRE ÉCRITURE.
       *
       * `guide.revision` et non `patch.baseRevision` : les deux sont égales — la
       * comparaison ci-dessus l'a établi — mais celle-ci est un `number` et non un
       * `number | undefined`, et `where: { revision: undefined }` ne filtre RIEN
       * chez Prisma. La garde disparaîtrait sans qu'aucun test ne le dise.
       *
       * Zéro ligne touchée ne peut vouloir dire qu'une chose : la révision a bougé
       * entre notre lecture et notre écriture — `loadOwned` a déjà prouvé que le
       * guide existe.
       */
      if (bodyChanged) {
        const reclamee = await tx.guide.updateMany({
          where: { id: guideId, revision: guide.revision },
          data: { revision: { increment: 1 } },
        });
        if (reclamee.count === 0) {
          throw ApiError.transverse('CONFLICT', {
            field: 'body',
            reason: 'EDITED_ELSEWHERE',
            expected: guide.revision,
            received: patch.baseRevision ?? null,
          });
        }
      }
      const data: Prisma.GuideUpdateInput = {};
      if (patch.title !== undefined && isDraft) {
        data.title = patch.title;
        // Le brouillon n'a pas d'adresse publique : son slug peut encore suivre
        // le titre. Il se figera à la publication.
        if (guide.status === 'DRAFT') data.slug = await this.freeSlug(tx, patch.title, guideId);
        /**
         * LE TITRE DE LA PREMIÈRE PAGE SUIT CELUI DU GUIDE — TANT QU'IL LE SUIT.
         *
         * À la création, la page 1 reçoit le titre du guide : les deux disent la
         * même chose. Renommer le guide sans elle les ferait DIVERGER, et le plan
         * des pages afficherait l'ancien titre sous le nouveau — visible à
         * l'écran, inexplicable pour l'auteur.
         *
         * La condition d'égalité est ce qui rend le geste sûr : dès que l'auteur
         * a renommé sa page 1 par `PATCH /guides/:id/pages/:pageId`, elle porte
         * une intention propre, et renommer le guide n'y touche plus. Son SLUG,
         * lui, ne bouge pas : il voyage dans les liens (§2.1).
         */
        const first = pages[0];
        if (first !== undefined && first.title === guide.title) {
          await tx.guidePage.update({ where: { id: first.id }, data: { title: patch.title } });
        }
      }
      if (patch.category !== undefined) data.category = patch.category;
      if (patch.scope !== undefined) data.scope = patch.scope;
      if (patch.originCountryId !== undefined || patch.scope !== undefined) {
        data.originCountry =
          scope === 'COUNTRY' && country !== null ? { connect: { id: country } } : { disconnect: true };
      }
      if (patch.cityId !== undefined) {
        data.city = patch.cityId === null ? { disconnect: true } : { connect: { id: patch.cityId } };
      }

      if (bodyChanged && patch.body !== undefined) {
        // AVANT l'écriture de la version, et dans la même transaction : un refus
        // d'image doit annuler la mise à jour entière, pas la laisser à moitié
        // faite avec un corps qui cite une image non rattachée.
        await this.syncBodyMedia(tx, {
          guideId,
          pageId: target.id,
          body: patch.body,
          ownerUserId: userId,
        });
        if (guide.status === 'DRAFT' && target.currentVersionId !== null) {
          // Brouillon : la version 1 DE CETTE PAGE est modifiée SUR PLACE.
          // L'historique public commence à la publication ; garder une version
          // par enregistrement automatique n'apprendrait rien à personne.
          await tx.guideVersion.update({
            where: { id: target.currentVersionId },
            data: { body: patch.body },
          });
        } else {
          const version = await this.appendVersion(tx, {
            guideId,
            pageId: target.id,
            body: patch.body,
            createdByUserId: userId,
            summary: 'Mise à jour par l’auteur',
          });
          // LA VERSION COURANTE EST CELLE DE LA PAGE, et `guides` en reçoit le
          // reflet par `syncGuideCurrentVersion` quand il s'agit de la première.
          await tx.guidePage.update({
            where: { id: target.id },
            data: { currentVersionId: version.id },
          });
          // §2.3 : une mise à jour du contenu rafraîchit LE GUIDE et le fait
          // remonter au classement — « `lastContentUpdateAt` bouge dès qu'une
          // page change », parce que c'est la démarche entière qui est à jour.
          data.lastContentUpdateAt = now;
          data.freshnessScore = computeFreshnessScore(guide.helpfulCount, now, now);
          await this.outbox.emit(tx, {
            type: 'guide.version_created',
            aggregateId: guideId,
            payload: {
              guideId,
              pageId: target.id,
              versionId: version.id,
              version: version.version,
              by: userId,
            },
          });
        }
      }

      if (Object.keys(data).length > 0) {
        await tx.guide.update({ where: { id: guideId }, data });
      }
      if (bodyChanged) await this.syncGuideCurrentVersion(tx, guideId);
    });

    return this.byIdForAuthor(guideId, userId, target.id);
  }

  /** POST /guides/:id/publish — §2.1. */
  async publish(userId: string, guideId: string) {
    const guide = await this.loadOwned(guideId, userId);
    if (guide.status === 'PUBLISHED' || guide.status === 'FLAGGED') {
      throw ApiError.transverse('CONFLICT', { reason: 'ALREADY_PUBLISHED' });
    }
    if (guide.status === 'ARCHIVED') throw ApiError.transverse('CONFLICT', { reason: 'ARCHIVED' });

    /**
     * ╔══════════════════════════════════════════════════════════════════════════╗
     * ║ ON PUBLIE LE GUIDE ENTIER, ET LES 300 CARACTÈRES SONT CEUX DU TOTAL     ║
     * ╚══════════════════════════════════════════════════════════════════════════╝
     *
     * PUBLICATION D'UN BLOC — décision du porteur : « on publie le guide, toutes
     * ses pages ensemble. Le statut reste sur le GUIDE, il ne descend pas sur la
     * page. Le lecteur ne tombe jamais sur un guide à trous. » Il n'y a donc
     * qu'un `status`, et il est ici.
     *
     * LE MINIMUM PORTE SUR LE TOTAL, et la raison est écrite au complet sur
     * `guidePublishableGuideBodySchema` (@app/shared). En deux lignes : un guide
     * de cinq pages courtes mais riche serait refusé si chaque page devait faire
     * 300 caractères, alors qu'il en totalise 1 200 et qu'il est exactement ce que
     * les pages servent à écrire ; et l'auteur n'aurait qu'à tout remettre sur une
     * page pour contourner la règle. Le MAXIMUM, lui, reste par page — chaque
     * `PATCH` l'a déjà appliqué.
     *
     * Les 300 caractères sont exigés ICI, pas au brouillon : l'éditeur enregistre
     * en continu, et bloquer un texte en cours d'écriture le perdrait.
     */
    const body = joinGuidePageBodies(
      guide.pages.map((page) => page.currentVersion?.body ?? ''),
    );
    const parsed = guidePublishableGuideBodySchema.safeParse(body);
    if (!parsed.success) {
      throw ApiError.validation(
        parsed.error.issues.map((i) => ({ path: 'body', code: i.code.toUpperCase() })),
      );
    }
    this.assertTitleAllowed(guide.title);

    await this.assertDailyPublishLimit(userId);
    await this.assertModerationAllows(guide.title, body, guideId, userId);

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.guide.update({
        where: { id: guideId },
        data: {
          status: 'PUBLISHED',
          lastContentUpdateAt: now,
          freshnessScore: computeFreshnessScore(guide.helpfulCount, now, now),
          // Republication après dépublication (§2.6) : le délai tombe, les
          // signalements ont déjà été traités par la correction.
          unpublishDeadlineAt: null,
        },
      });

      // La date de publication n'existe pas dans `guides` : le journal d'audit
      // en tient lieu, et c'est lui que compte la limite de trois par jour.
      await this.audit.record(tx, {
        actor: { type: 'MEMBER', id: userId },
        action: 'guide.published',
        targetType: 'guide',
        targetId: guideId,
        metadata: { slug: guide.slug, category: guide.category, scope: guide.scope },
      });

      await this.outbox.emit(tx, {
        type: 'guide.published',
        aggregateId: guideId,
        payload: {
          guideId,
          slug: guide.slug,
          authorUserId: userId,
          category: guide.category,
          scope: guide.scope,
          originCountryId: guide.originCountryId,
        },
      });
    });

    return this.byIdForAuthor(guideId, userId);
  }

  /** POST /guides/:id/unpublish — par l'auteur (§4). */
  async unpublish(userId: string, guideId: string) {
    const guide = await this.loadOwned(guideId, userId);
    if (guide.status !== 'PUBLISHED' && guide.status !== 'FLAGGED') {
      throw ApiError.transverse('CONFLICT', { reason: 'NOT_PUBLISHED' });
    }

    await this.prisma.$transaction(async (tx) => {
      // §2.6 : « conservé en brouillon pour l'auteur, retiré de la recherche ».
      // UNPUBLISHED plutôt que DRAFT : le guide garde son slug, son historique
      // et ses votes, et l'auteur peut republier après modification.
      await tx.guide.update({
        where: { id: guideId },
        data: { status: 'UNPUBLISHED', unpublishDeadlineAt: null },
      });
      await this.audit.record(tx, {
        actor: { type: 'MEMBER', id: userId },
        action: 'guide.unpublished',
        targetType: 'guide',
        targetId: guideId,
      });
      await this.outbox.emit(tx, {
        type: 'guide.unpublished',
        aggregateId: guideId,
        payload: { guideId, slug: guide.slug, reason: 'AUTHOR' },
      });
    });

    return this.byIdForAuthor(guideId, userId);
  }

  /**
   * POST /guides/:id/revert — §2.7.
   *
   * « Crée une nouvelle version dont le corps est celui de la version choisie
   * (jamais de suppression d'historique). » Le retour arrière est donc une
   * écriture de plus, pas un effacement : l'historique reste intégral.
   */
  async revert(userId: string, guideId: string, versionId: string) {
    const guide = await this.loadOwned(guideId, userId);
    const source = await this.prisma.guideVersion.findFirst({
      where: { id: versionId, guideId },
      select: { id: true, version: true, body: true, pageId: true },
    });
    if (source === null) throw ApiError.notFound();

    /**
     * LE RETOUR ARRIÈRE SE FAIT SUR LA PAGE DE LA VERSION CHOISIE.
     *
     * `guide_versions.page_id` porte la page par construction, et c'est ce qui
     * rend la route juste sans rien ajouter à son contrat : l'historique de §2.7
     * est celui du GUIDE (toutes pages confondues), et chaque ligne sait d'où
     * elle vient. Écrire le corps ramené sur la PREMIÈRE page aurait écrasé un
     * texte que personne n'a demandé de changer.
     *
     * Deux refus propres, et non un 500 :
     *   · `page_id` nul — impossible aujourd'hui (la reprise a tout renseigné,
     *     et le service l'écrit toujours), mais une ligne héritée d'une base
     *     réparée à la main existerait ;
     *   · la page a été RETIRÉE depuis. Son historique lui reste attaché (§2.7,
     *     ajout seul), mais y écrire une version ressusciterait un corps que le
     *     guide ne montre plus.
     */
    const page =
      source.pageId === null
        ? undefined
        : guide.pages.find((candidate) => candidate.id === source.pageId);
    if (page === undefined) {
      throw ApiError.transverse('CONFLICT', { reason: 'PAGE_REMOVED', versionId: source.id });
    }
    if (page.currentVersionId === source.id) {
      throw ApiError.transverse('CONFLICT', { reason: 'ALREADY_CURRENT' });
    }

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const version = await this.appendVersion(tx, {
        guideId,
        pageId: page.id,
        body: source.body,
        createdByUserId: userId,
        // `revert_of_version_id` n'existe pas dans le schéma figé : le résumé
        // porte la trace, faute de colonne.
        summary: `Retour à la version ${source.version}`,
      });
      /**
       * LE RETOUR ARRIÈRE RAMÈNE AUSSI LES IMAGES D'ALORS. `guide_media` décrit
       * ce que le corps COURANT affiche : sans cette ligne, un retour vers une
       * version illustrée laisserait les rattachements de la version abandonnée,
       * donc retiendrait des fichiers que plus personne ne voit et n'en
       * retiendrait aucun de ceux qui réapparaissent.
       *
       * Le corps vient de l'historique, donc sa grammaire a déjà été validée ;
       * ce qui est revérifié ici, c'est l'ÉTAT des actifs — un média retiré
       * entre-temps fait échouer le retour proprement, au lieu de republier un
       * cadre vide.
       */
      await this.syncBodyMedia(tx, {
        guideId,
        pageId: page.id,
        body: source.body,
        ownerUserId: userId,
      });
      await tx.guidePage.update({
        where: { id: page.id },
        data: { currentVersionId: version.id },
      });
      await tx.guide.update({
        where: { id: guideId },
        data: {
          lastContentUpdateAt: now,
          freshnessScore: computeFreshnessScore(guide.helpfulCount, now, now),
        },
      });
      await this.syncGuideCurrentVersion(tx, guideId);
      await this.outbox.emit(tx, {
        type: 'guide.version_created',
        aggregateId: guideId,
        payload: {
          guideId,
          pageId: page.id,
          versionId: version.id,
          version: version.version,
          revertOfVersionId: source.id,
          by: userId,
        },
      });
    });

    return this.byIdForAuthor(guideId, userId);
  }

  // ════════════════════════════════════════════════════════════════════════
  // Vote d'utilité (§2.2)
  // ════════════════════════════════════════════════════════════════════════

  /** PUT /guides/:id/vote. */
  async vote(userId: string, guideId: string, value: GuideVoteValue) {
    const guide = await this.loadVotable(guideId, userId);

    const existing = await this.prisma.guideVote.findUnique({
      where: { guideId_userId: { guideId, userId } },
      select: { id: true, value: true },
    });
    if (existing?.value === value) return { value, helpfulCount: guide.helpfulCount };

    const now = new Date();
    const voteId = existing?.id ?? newId();
    // Le compteur ne bouge que pour HELPFUL. RÈGLE DURE (§2.2) : « NOT_HELPFUL
    // ne décrémente rien et n'affecte pas le classement. »
    const delta = (value === 'HELPFUL' ? 1 : 0) - (existing?.value === 'HELPFUL' ? 1 : 0);

    await this.prisma.$transaction(async (tx) => {
      if (existing === null) {
        await tx.guideVote.create({ data: { id: voteId, guideId, userId, value } });
      } else {
        await tx.guideVote.update({ where: { id: voteId }, data: { value } });
      }

      if (delta !== 0) {
        const helpfulCount = guide.helpfulCount + delta;
        await tx.guide.update({
          where: { id: guideId },
          data: {
            helpfulCount,
            // Le score suit immédiatement : le coefficient de fraîcheur est
            // connu, et attendre la nuit ferait mentir l'onglet « Les plus
            // utiles » toute la journée. La tâche quotidienne reste nécessaire,
            // elle, pour les guides qui VIEILLISSENT sans recevoir de vote.
            freshnessScore: computeFreshnessScore(helpfulCount, guide.lastContentUpdateAt, now),
          },
        });
      }

      // §2.2 : la réputation ne récompense que le vote positif, et pour
      // l'AUTEUR seul — les contributeurs sont crédités à l'acceptation de leur
      // proposition. Rien pour un guide anonymisé : il n'a plus d'auteur.
      if (value === 'HELPFUL' && guide.authorUserId !== null) {
        await tx.reputationEvent.createMany({
          data: [
            {
              id: newId(),
              userId: guide.authorUserId,
              type: 'GUIDE_HELPFUL_VOTE',
              sourceType: 'guide_vote',
              sourceId: voteId,
            },
          ],
          // Livraison « au moins une fois » de la boîte d'envoi (§9.4) : la
          // contrainte d'unicité fait l'idempotence, `skipDuplicates` évite de
          // transformer un rejeu en erreur.
          skipDuplicates: true,
        });
      } else if (existing?.value === 'HELPFUL') {
        await tx.reputationEvent.deleteMany({
          where: { sourceType: 'guide_vote', sourceId: voteId, type: 'GUIDE_HELPFUL_VOTE' },
        });
      }

      await this.outbox.emit(tx, {
        type: 'guide.voted',
        aggregateId: guideId,
        payload: { guideId, voteId, userId, value, authorUserId: guide.authorUserId },
      });
    });

    // §2.2 : cinq votes négatifs en sept jours ouvrent un dossier AUTO_RULE.
    // Hors transaction : le vote est acquis, et l'ouverture du dossier ne doit
    // pas pouvoir l'annuler.
    if (value === 'NOT_HELPFUL') await this.checkNegativeVoteRule(guideId, guide.authorUserId);

    return { value, helpfulCount: guide.helpfulCount + delta };
  }

  /** DELETE /guides/:id/vote — retrait (§2.2). */
  async removeVote(userId: string, guideId: string) {
    const existing = await this.prisma.guideVote.findUnique({
      where: { guideId_userId: { guideId, userId } },
      select: { id: true, value: true },
    });
    if (existing === null) throw ApiError.notFound();

    const guide = await this.prisma.guide.findUniqueOrThrow({
      where: { id: guideId },
      select: { helpfulCount: true, lastContentUpdateAt: true },
    });

    const now = new Date();
    const helpfulCount =
      existing.value === 'HELPFUL' ? Math.max(0, guide.helpfulCount - 1) : guide.helpfulCount;

    await this.prisma.$transaction(async (tx) => {
      await tx.guideVote.delete({ where: { id: existing.id } });
      if (existing.value === 'HELPFUL') {
        await tx.guide.update({
          where: { id: guideId },
          data: {
            helpfulCount,
            freshnessScore: computeFreshnessScore(helpfulCount, guide.lastContentUpdateAt, now),
          },
        });
        // §2.2 : « suppression de la ligne ET du reputation_event ».
        await tx.reputationEvent.deleteMany({
          where: { sourceType: 'guide_vote', sourceId: existing.id, type: 'GUIDE_HELPFUL_VOTE' },
        });
      }
      await this.outbox.emit(tx, {
        type: 'guide.vote_removed',
        aggregateId: guideId,
        payload: { guideId, voteId: existing.id, userId, previousValue: existing.value },
      });
    });

    return { value: null, helpfulCount };
  }

  private async checkNegativeVoteRule(guideId: string, authorUserId: string | null): Promise<void> {
    const since = new Date(Date.now() - GUIDE_NEGATIVE_VOTE_WINDOW_DAYS * 86_400_000);
    const negatives = await this.prisma.guideVote.count({
      where: { guideId, value: 'NOT_HELPFUL', createdAt: { gte: since } },
    });
    if (negatives < GUIDE_NEGATIVE_VOTE_THRESHOLD) return;
    await this.openModerationCase({
      guideId,
      authorUserId,
      source: 'AUTO_RULE',
      priority: GUIDE_NEGATIVE_VOTE_CASE_PRIORITY,
      dedupe: true,
    });
  }

  // ════════════════════════════════════════════════════════════════════════
  // Obsolescence (§2.6)
  // ════════════════════════════════════════════════════════════════════════

  /** POST /guides/:id/outdated — « L'information a changé ». */
  async flagOutdated(userId: string, guideId: string, comment: string | undefined) {
    const guide = await this.loadVotable(guideId, userId);

    const existing = await this.prisma.guideOutdatedFlag.findUnique({
      where: { guideId_userId: { guideId, userId } },
      select: { id: true },
    });
    // §2.6 : un signalement par membre et par guide.
    if (existing !== null) this.fail('ALREADY_FLAGGED');

    const count = guide.outdatedFlagCount + 1;
    const reachesThreshold =
      count >= GUIDE_OUTDATED_FLAG_THRESHOLD && guide.status === 'PUBLISHED';
    const deadline = reachesThreshold
      ? new Date(Date.now() + GUIDE_UNPUBLISH_DELAY_DAYS * 86_400_000)
      : guide.unpublishDeadlineAt;

    await this.prisma.$transaction(async (tx) => {
      await tx.guideOutdatedFlag.create({
        data: { id: newId(), guideId, userId, comment: comment ?? null },
      });
      await tx.guide.update({
        where: { id: guideId },
        data: {
          outdatedFlagCount: count,
          ...(reachesThreshold
            ? { status: 'FLAGGED', unpublishDeadlineAt: deadline }
            : {}),
        },
      });
      if (reachesThreshold) {
        await this.outbox.emit(tx, {
          type: 'guide.flagged',
          aggregateId: guideId,
          payload: {
            guideId,
            slug: guide.slug,
            // Le créateur ET les contributeurs sont notifiés (§2.6) : c'est le
            // consommateur qui compose, mais il doit savoir qui prévenir.
            authorUserId: guide.authorUserId,
            unpublishDeadlineAt: deadline,
            outdatedFlagCount: count,
          },
        });
      }
    });

    return { outdatedFlagCount: count, status: reachesThreshold ? 'FLAGGED' : guide.status };
  }

  /**
   * DELETE /guides/:id/outdated — retrait du signalement.
   *
   * §2.6 ne dit pas ce qu'un retrait produit ; §4 déclare la route. Retenu :
   * repasser sous le seuil rend le guide à PUBLISHED et efface le délai. Un
   * signalement posé par erreur — trois suffisent à enclencher une
   * dépublication — doit pouvoir être défait, sinon la route ne sert à rien.
   */
  async removeOutdatedFlag(userId: string, guideId: string) {
    const flag = await this.prisma.guideOutdatedFlag.findUnique({
      where: { guideId_userId: { guideId, userId } },
      select: { id: true },
    });
    if (flag === null) throw ApiError.notFound();

    const guide = await this.prisma.guide.findUniqueOrThrow({
      where: { id: guideId },
      select: { outdatedFlagCount: true, status: true, slug: true },
    });
    const count = Math.max(0, guide.outdatedFlagCount - 1);
    const restored = guide.status === 'FLAGGED' && count < GUIDE_OUTDATED_FLAG_THRESHOLD;

    await this.prisma.$transaction(async (tx) => {
      await tx.guideOutdatedFlag.delete({ where: { id: flag.id } });
      await tx.guide.update({
        where: { id: guideId },
        data: {
          outdatedFlagCount: count,
          ...(restored ? { status: 'PUBLISHED', unpublishDeadlineAt: null } : {}),
        },
      });
      if (restored) {
        await this.outbox.emit(tx, {
          type: 'guide.restored',
          aggregateId: guideId,
          payload: { guideId, slug: guide.slug, reason: 'FLAG_WITHDRAWN' },
        });
      }
    });

    return { outdatedFlagCount: count, status: restored ? 'PUBLISHED' : guide.status };
  }

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ `GET /guides/:id/outdated` — L'AUTEUR VOIT CE QUI A ÉTÉ SIGNALÉ          ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * ── CE QUI MANQUAIT, MESURÉ ────────────────────────────────────────────────
   *
   * `grep -rn "guideOutdatedFlag" apps/api/src` ne trouvait AUCUN `findMany` : la
   * table n'était jamais PARCOURUE, seulement cherchée par `(guideId, userId)`
   * pour refuser un second signalement du même membre. Les deux seules routes
   * étaient `POST` et `DELETE`. Le champ `comment` — 1 à 500 caractères, branché à
   * la saisie au lot précédent — n'était donc LU PAR PERSONNE : le membre écrivait
   * ce qui avait changé, et cela n'atteignait aucun écran.
   *
   * ── LA RÈGLE D'ACCÈS N'EST PAS RÉÉCRITE : C'EST `loadOwned` ───────────────
   *
   * Le même garde que les sept écritures du module, et pour les mêmes refus :
   * 404 sur le brouillon d'autrui (« un brouillon ne se devine pas, et un 403
   * révélerait qu'il existe »), `NOT_AUTHOR` sur un guide public. Écrire ici une
   * seconde règle — « si `authorUserId !== userId` alors 403 » — aurait divergé de
   * celle-là au premier changement, et c'est exactement le genre d'écart qu'on ne
   * voit qu'en lisant les deux.
   *
   * ⚠ `loadOwned` CHARGE LES PAGES AVEC LE GUIDE (`PAGES_WITH_BODY`), ce dont
   * cette lecture n'a aucun usage. C'est le prix de la règle partagée, et il est
   * assumé : une seconde façon de charger « le guide, s'il est à moi » aurait été
   * une seconde façon de se tromper. Le geste n'arrive de toute façon qu'à la
   * demande de l'auteur, pas dans une liste.
   *
   * ── L'ANONYMAT TIENT AU `select`, PAS À LA DISCIPLINE DE L'APPELANT ───────
   *
   * ARBITRAGE DU PORTEUR, qui n'a PAS été annulé par celui qui ouvre cette
   * lecture : « Les signalants resteront anonymes : l'auteur ne voit que le
   * compte. » On rend donc DEUX colonnes, et la relation `user` n'est même pas
   * incluse — `userId` est dans la ligne, et le `select` est la seule chose qui
   * l'empêche de sortir. Voir `guideOutdatedFlagsResponseSchema`, qui le redit à
   * la frontière avec son `.strict()`.
   *
   * ⚠ L'IDENTIFIANT DU SIGNALEMENT NE SORT PAS NON PLUS. Il ne nomme personne,
   * mais l'écran de l'auteur n'en a aucun usage : il n'offre ni retrait (c'est le
   * signalant qui se défait, par `DELETE`) ni réponse. Rendre une clé sans emploi
   * invite le lot suivant à la croiser avec autre chose.
   *
   * ── L'ORDRE, ET POURQUOI IL EST DÉCROISSANT ──────────────────────────────
   *
   * Le dernier signalement d'abord : c'est celui qui vient d'arriver, et c'est
   * celui dont la notification du §2.6 parle. Un ordre croissant aurait mis en
   * tête le plus ancien, c'est-à-dire celui que l'auteur a déjà lu.
   */
  async listOutdatedFlags(userId: string, guideId: string) {
    await this.loadOwned(guideId, userId);
    const rows = await this.prisma.guideOutdatedFlag.findMany({
      where: { guideId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true, comment: true },
    });
    return {
      items: rows.map((row) => ({
        createdAt: row.createdAt.toISOString(),
        comment: row.comment,
      })),
    };
  }

  // ════════════════════════════════════════════════════════════════════════
  // Maintenu par la communauté (§2.5)
  // ════════════════════════════════════════════════════════════════════════

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ `PUT /guides/:id/community` — OUVRIR, ET REPRENDRE LA MAIN               ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur : « le bouton ouvrir à la communauté ne marche pas. » MESURÉ :
   * `maintainedByCommunity` n'était écrit QUE par `switchInactiveAuthorsToCommunity`
   * (la tâche hebdomadaire du §2.5) et par l'anonymisation du §8. AUCUNE route ne
   * permettait à l'auteur de le demander, alors que §2.5 le prévoit.
   *
   * ── CE QUE CE BOOLÉEN FAIT VRAIMENT, ET C'EST LE POINT ───────────────────
   *
   * §2.4, ligne 52 : « Si le guide est `maintained_by_community` : les propositions
   * vont directement en file de modération, sans passer par le créateur. » Le code
   * l'applique déjà — `decideProposal` lit `const toModeration = guide.
   * maintainedByCommunity`. Ouvrir son guide, c'est donc RENONCER à valider les
   * corrections qu'on reçoit. Ce n'est pas un réglage d'affichage, et c'est pour
   * cela que l'écran demande confirmation en disant ce qu'on perd.
   *
   * ── RÉVERSIBLE, PARCE QUE LA SPÉCIFICATION LE DIT ────────────────────────
   *
   * §2.5 : « Réversible si l'auteur revient et le demande. » D'où un booléen reçu
   * plutôt qu'une bascule : une bascule sans valeur (« inverse l'état ») aurait
   * rendu le double clic destructeur — le second clic défaisant le premier — et
   * deux onglets ouverts sur le même guide auraient donné un résultat qui dépend
   * de l'ordre d'arrivée. Avec la valeur dans le corps, le geste est idempotent :
   * demander « ouvert » sur un guide déjà ouvert ne change rien et ne refuse pas.
   *
   * ⚠ AUCUN ÉVÉNEMENT N'EST ÉMIS, et c'est un relevé, pas un oubli : la tâche
   * d'inactivité, qui bascule le MÊME champ sur des centaines de guides, n'en
   * émet aucun non plus, et §2.5 ne déclare aucune notification pour cette
   * bascule. En émettre un ici aurait fait deux chemins pour un seul fait, dont un
   * seul observable. Remonté.
   *
   * ⚠ CE QUE CETTE ROUTE NE FAIT PAS : elle ne touche NI le statut, NI l'auteur,
   * NI le crédit. §2.5 : « L'auteur reste crédité (sauf anonymisation) » — un
   * guide ouvert à la communauté garde donc son `authorUserId`, et l'auteur garde
   * le droit de modifier directement. C'est la VALIDATION des propositions qu'il
   * délègue, pas la paternité du guide.
   */
  async setCommunityMaintenance(userId: string, guideId: string, maintained: boolean) {
    await this.loadOwned(guideId, userId);
    const updated = await this.prisma.guide.update({
      where: { id: guideId },
      data: { maintainedByCommunity: maintained },
      select: { maintainedByCommunity: true },
    });
    return { maintainedByCommunity: updated.maintainedByCommunity };
  }

  // ════════════════════════════════════════════════════════════════════════
  // Propositions de mise à jour (§2.4)
  // ════════════════════════════════════════════════════════════════════════

  /** POST /guides/:id/proposals. */
  async createProposal(userId: string, guideId: string, input: CreateProposal) {
    const guide = await this.loadVotable(guideId, userId);

    const pending = await this.prisma.guideRevisionProposal.count({
      where: { guideId, proposerUserId: userId, status: 'PENDING' },
    });
    if (pending >= GUIDE_PENDING_PROPOSAL_LIMIT) {
      this.fail('PROPOSAL_LIMIT', { limit: GUIDE_PENDING_PROPOSAL_LIMIT, current: pending });
    }

    /**
     * ╔══════════════════════════════════════════════════════════════════════════╗
     * ║ LA PAGE VISÉE SE DÉDUIT DU PASSAGE — AUCUN CHAMP DE PLUS DANS LE CONTRAT ║
     * ╚══════════════════════════════════════════════════════════════════════════╝
     *
     * §2.4 : le passage doit exister EXACTEMENT UNE FOIS. Avec les pages, cette
     * phrase se lit « exactement une fois DANS TOUT LE GUIDE » : on cherche donc
     * dans le corps courant de chaque page, et il doit y avoir UNE page qui le
     * contient UNE fois. Zéro : le texte a changé. Plusieurs (dans la même page ou
     * réparti sur deux) : le remplacement serait ambigu, et appliquer « la
     * première occurrence » corrigerait un passage que le proposant n'a pas lu.
     *
     * POURQUOI DÉDUIRE PLUTÔT QUE DEMANDER. `createProposalSchema` reste inchangé,
     * donc l'écran A06 — qui copie le passage sélectionné et rien d'autre —
     * continue de fonctionner tel quel. Un `pageId` obligatoire aurait fait de
     * chaque correction en vol un 400 au déploiement ; un `pageId` facultatif
     * aurait créé deux vérités sur la même question, dont une à ignorer quand elle
     * contredit le texte.
     *
     * `baseVersionId` porte alors la page PAR RICOCHET (`guide_versions.page_id`),
     * et c'est ce que `decideProposal` relit pour savoir où écrire.
     */
    const pages: PageWithBody[] = guide.pages;
    let occurrences = 0;
    const matches: PageWithBody[] = [];
    for (const page of pages) {
      const count = this.countOccurrences(page.currentVersion?.body ?? '', input.targetExcerpt);
      occurrences += count;
      if (count > 0) matches.push(page);
    }
    // `occurrences !== 1` couvre les deux ambiguïtés d'un coup : deux fois dans
    // la même page, ou une fois dans deux pages. `matches[0]` est alors la seule
    // page possible, et le test de `matches.length` le prouve au compilateur
    // autant qu'au relecteur.
    const found = matches[0];
    if (occurrences !== 1 || matches.length !== 1 || found === undefined) {
      this.fail('EXCERPT_NOT_FOUND', { occurrences });
    }
    if (found.currentVersionId === null) this.fail('EXCERPT_NOT_FOUND', { occurrences });

    const proposalId = newId();
    const now = new Date();
    // Capturé hors de la transaction : le rétrécissement de type obtenu plus
    // haut ne survit pas à l'entrée dans la fermeture asynchrone.
    const baseVersionId = found.currentVersionId;
    const escalateAt = new Date(now.getTime() + GUIDE_PROPOSAL_ESCALATION_DAYS * 86_400_000);
    // §2.4 : si le guide est maintenu par la communauté, la proposition va
    // DIRECTEMENT en file de modération — il n'y a plus de créateur pour
    // décider, ou il ne répond plus depuis six mois.
    const toModeration = guide.maintainedByCommunity;

    await this.prisma.$transaction(async (tx) => {
      await tx.guideRevisionProposal.create({
        data: {
          id: proposalId,
          guideId,
          proposerUserId: userId,
          baseVersionId,
          targetExcerpt: input.targetExcerpt,
          replacement: input.replacement,
          reason: input.reason,
          sourceUrl: input.sourceUrl ?? null,
          status: toModeration ? 'ESCALATED' : 'PENDING',
          escalateAt,
        },
      });
      await this.outbox.emit(tx, {
        type: toModeration ? 'guide.proposal_escalated' : 'guide.proposal_created',
        aggregateId: proposalId,
        payload: {
          proposalId,
          guideId,
          proposerUserId: userId,
          authorUserId: guide.authorUserId,
          escalateAt: escalateAt.toISOString(),
          // Champ OMIS, et non posé à `undefined` : la charge d'un événement est
          // du JSON, où `undefined` n'existe pas.
          ...(toModeration ? { reason: 'COMMUNITY_MAINTAINED' } : {}),
        },
      });
    });

    if (toModeration) {
      await this.openModerationCase({
        guideId,
        authorUserId: guide.authorUserId,
        source: 'AUTO_RULE',
        priority: GUIDE_ESCALATION_CASE_PRIORITY,
        dedupe: false,
      });
    }

    return this.proposalView(proposalId);
  }

  /** GET /guides/:id/proposals — §4. */
  async listProposals(guideId: string, viewerId: string | null) {
    const guide = await this.prisma.guide.findUnique({
      where: { id: guideId },
      select: { id: true, authorUserId: true, status: true, deletedAt: true, unpublishDeadlineAt: true },
    });
    if (guide === null || guide.deletedAt !== null) throw ApiError.notFound();

    const isAuthor = viewerId !== null && guide.authorUserId === viewerId;
    // « Pour l'auteur : en attente ; pour tous : acceptées. » Une proposition
    // refusée ne se montre à personne d'autre que son proposant (/me/proposals) :
    // l'afficher publiquement exposerait un désaccord réglé.
    const status: Prisma.GuideRevisionProposalWhereInput['status'] = isAuthor
      ? { in: ['PENDING', 'ESCALATED', 'ACCEPTED', 'AMENDED'] }
      : { in: ['ACCEPTED', 'AMENDED'] };

    const items = await this.prisma.guideRevisionProposal.findMany({
      where: { guideId, status },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        targetExcerpt: true,
        replacement: true,
        reason: true,
        sourceUrl: true,
        escalateAt: true,
        decidedAt: true,
        createdAt: true,
        proposer: { select: { handle: true, displayName: true } },
      },
    });
    return { items, nextCursor: null };
  }

  /**
   * POST /proposals/:id/accept · /amend · /reject — §2.4.
   *
   * Les trois décisions partagent tout sauf le texte retenu, et la seule
   * différence qui compte pour la réputation est qu'ACCEPTED et AMENDED
   * créditent le contributeur tandis que REJECTED ne crédite rien. Les écrire
   * séparément aurait multiplié par trois les occasions d'oublier le crédit.
   */
  async decideProposal(
    userId: string,
    proposalId: string,
    decision:
      | { kind: 'ACCEPT' }
      | { kind: 'AMEND'; replacement: string }
      | { kind: 'REJECT'; reason: string },
    /**
     * L'ÉQUIPE décide à la place du créateur — 05 §2.4 : passé le délai de 14 jours,
     * la proposition est `ESCALATED` et « l'équipe accepte ou refuse ». Sans ce
     * paramètre le comportement est celui d'avant (créateur seul, `PENDING` seule).
     */
    staffId?: string,
  ) {
    const proposal = await this.prisma.guideRevisionProposal.findUnique({
      where: { id: proposalId },
      include: {
        guide: {
          select: {
            id: true,
            slug: true,
            authorUserId: true,
            status: true,
            helpfulCount: true,
            currentVersionId: true,
            maintainedByCommunity: true,
          },
        },
        // LA PAGE VIENT PAR RICOCHET, exactement comme le disait l'en-tête de
        // `createProposal` : la version de base sait à quelle page elle
        // appartient, donc la proposition le sait aussi.
        baseVersion: { select: { pageId: true } },
      },
    });
    if (proposal === null) throw ApiError.notFound();
    // 403 NOT_AUTHOR, et non 404 : le guide est public, la proposition aussi
    // dès qu'elle est acceptée. C'est §4 qui nomme ce code.
    if (staffId === undefined && proposal.guide.authorUserId !== userId) this.fail('NOT_AUTHOR');
    if (
      staffId === undefined
        ? proposal.status !== 'PENDING'
        : proposal.status !== 'ESCALATED' && proposal.status !== 'PENDING'
    ) {
      this.fail('ALREADY_DECIDED', { status: proposal.status });
    }

    const now = new Date();

    if (decision.kind === 'REJECT') {
      await this.prisma.$transaction(async (tx) => {
        await tx.guideRevisionProposal.update({
          where: { id: proposalId },
          data: {
            status: 'REJECTED',
            ...(staffId === undefined ? { reviewerUserId: userId } : { reviewerStaffId: staffId }),
            rejectReason: decision.reason,
            decidedAt: now,
          },
        });
        await this.outbox.emit(tx, {
          type: 'guide.proposal_rejected',
          aggregateId: proposalId,
          payload: {
            proposalId,
            guideId: proposal.guideId,
            proposerUserId: proposal.proposerUserId,
            reason: decision.reason,
          },
        });
      });
      return this.proposalView(proposalId);
    }

    /**
     * ╔══════════════════════════════════════════════════════════════════════════╗
     * ║ LE REMPLACEMENT EST ÉCRIT DANS LA BONNE PAGE — VÉRIFIÉ, PAS SUPPOSÉ     ║
     * ╚══════════════════════════════════════════════════════════════════════════╝
     *
     * C'était le défaut à ne pas commettre : `currentBody.replace(…)` lisait
     * `guide.currentVersion.body`, c'est-à-dire la version courante DU GUIDE.
     * Avec les pages, cette colonne reflète la PREMIÈRE page — donc une
     * correction acceptée sur la page 3 aurait été appliquée au texte de la
     * page 1, où le passage n'existe pas : `assertExcerptUnique` l'aurait refusée
     * en `EXCERPT_NOT_FOUND`, et l'auteur aurait vu une proposition
     * indéfiniment impossible à accepter sans savoir pourquoi.
     *
     * On repart donc de `baseVersion.pageId`, et le corps relu est celui de la
     * VERSION COURANTE DE CETTE PAGE — pas celui de la version de base : entre la
     * proposition et la décision, une autre proposition a pu être acceptée sur la
     * même page. Appliquer un remplacement calculé sur un texte disparu écrirait
     * n'importe quoi dans le guide.
     *
     * Une page RETIRÉE entre-temps donne un `CONFLICT` explicite plutôt qu'un
     * refus incompréhensible : son corps n'est plus lu par personne.
     */
    const pageId = proposal.baseVersion.pageId;
    const page =
      pageId === null
        ? null
        : await this.prisma.guidePage.findFirst({
            where: { id: pageId, guideId: proposal.guideId, deletedAt: null },
            select: { id: true, currentVersionId: true, currentVersion: { select: { body: true } } },
          });
    if (page === null) {
      throw ApiError.transverse('CONFLICT', { reason: 'PAGE_REMOVED', proposalId });
    }

    const currentBody = page.currentVersion?.body ?? '';
    this.assertExcerptUnique(currentBody, proposal.targetExcerpt);

    const replacement = decision.kind === 'AMEND' ? decision.replacement : proposal.replacement;
    const body = currentBody.replace(proposal.targetExcerpt, replacement);
    const status = decision.kind === 'AMEND' ? 'AMENDED' : 'ACCEPTED';

    await this.prisma.$transaction(async (tx) => {
      const version = await this.appendVersion(tx, {
        guideId: proposal.guideId,
        pageId: page.id,
        body,
        /**
         * L'auteur de la version est le PROPOSANT, pas le créateur qui accepte.
         *
         * §2.7 précise `created_by_user_id = auteur` pour la seule édition
         * DIRECTE ; le contraste dit le reste. L'historique public affiche
         * « l'auteur de la version » (§2.7) : y mettre le créateur du guide
         * effacerait le travail du contributeur de la seule page où il est
         * visible. Qui a DÉCIDÉ reste noté sur la proposition
         * (`reviewer_user_id`), y compris pour « accepter en modifiant ».
         */
        createdByUserId: proposal.proposerUserId,
        sourceProposalId: proposalId,
        summary: proposal.reason.slice(0, 200),
      });

      /**
       * UNE PROPOSITION PEUT DÉPLACER OU RETIRER UNE IMAGE, puisqu'elle remplace
       * un PASSAGE du corps — et le passage peut contenir un `![…](/media/…)`.
       *
       * Les rattachements sont donc resynchronisés ici aussi, sur le corps
       * RÉSULTANT. Le propriétaire attendu est le créateur du guide (`userId`,
       * qui est forcément l'auteur : le refus `NOT_AUTHOR` plus haut l'impose) —
       * un proposant ne peut donc pas glisser SON image dans le guide d'un autre
       * par la porte de la correction, mais il peut garder, déplacer ou retirer
       * celles qui y sont déjà.
       *
       * ⚠ CONSÉQUENCE ASSUMÉE : si une image du guide a été retirée entre la
       * proposition et la décision, l'acceptation ÉCHOUE avec
       * `IMAGE_NOT_ATTACHABLE` au lieu de republier un cadre vide. C'est le même
       * parti que `assertExcerptUnique` juste au-dessus : mieux vaut une décision
       * refusée et explicable qu'un guide écrit de travers.
       */
      await this.syncBodyMedia(tx, {
        guideId: proposal.guideId,
        pageId: page.id,
        body,
        ownerUserId: proposal.guide.authorUserId,
      });

      await tx.guideRevisionProposal.update({
        where: { id: proposalId },
        data: {
          status,
          ...(staffId === undefined ? { reviewerUserId: userId } : { reviewerStaffId: staffId }),
          decidedAt: now,
        },
      });

      // §2.6 : « une proposition acceptée pendant le délai : retour à
      // PUBLISHED, signalements archivés, outdated_flag_count = 0 ».
      const wasFlagged = proposal.guide.status === 'FLAGGED';
      if (wasFlagged) {
        // Le schéma figé n'a pas de colonne d'archivage sur
        // `guide_outdated_flags`, et l'index unique (guide, membre) empêche un
        // membre de signaler à nouveau si la ligne reste. Les lignes sont donc
        // SUPPRIMÉES : un guide corrigé doit pouvoir être resignalé le jour où
        // l'information change encore.
        await tx.guideOutdatedFlag.deleteMany({ where: { guideId: proposal.guideId } });
      }

      // La version courante est celle de LA PAGE ; `guides.current_version_id`
      // n'en reçoit le reflet que si c'est la première (`syncGuideCurrentVersion`).
      await tx.guidePage.update({
        where: { id: page.id },
        data: { currentVersionId: version.id },
      });
      await tx.guide.update({
        where: { id: proposal.guideId },
        data: {
          // §2.3 : « Une proposition acceptée remet last_content_update_at à
          // jour et fait remonter le guide. » Sur le GUIDE, comme la fraîcheur et
          // les votes : la démarche entière vient d'être corrigée.
          lastContentUpdateAt: now,
          freshnessScore: computeFreshnessScore(proposal.guide.helpfulCount, now, now),
          ...(wasFlagged
            ? { status: 'PUBLISHED', outdatedFlagCount: 0, unpublishDeadlineAt: null }
            : {}),
        },
      });
      await this.syncGuideCurrentVersion(tx, proposal.guideId);

      // §2.4 : le contributeur est crédité — y compris quand le créateur a
      // MODIFIÉ son texte avant de l'accepter.
      await tx.guideContributor.upsert({
        where: { guideId_userId: { guideId: proposal.guideId, userId: proposal.proposerUserId } },
        create: {
          guideId: proposal.guideId,
          userId: proposal.proposerUserId,
          acceptedCount: 1,
          firstAt: now,
        },
        update: { acceptedCount: { increment: 1 } },
      });

      await tx.reputationEvent.createMany({
        data: [
          {
            id: newId(),
            userId: proposal.proposerUserId,
            type: 'GUIDE_CONTRIBUTION',
            sourceType: 'guide_revision_proposal',
            sourceId: proposalId,
          },
        ],
        skipDuplicates: true,
      });

      await this.outbox.emit(tx, {
        type: 'guide.proposal_accepted',
        aggregateId: proposalId,
        payload: {
          proposalId,
          guideId: proposal.guideId,
          proposerUserId: proposal.proposerUserId,
          versionId: version.id,
          amended: decision.kind === 'AMEND',
        },
      });
      await this.outbox.emit(tx, {
        type: 'guide.version_created',
        aggregateId: proposal.guideId,
        payload: {
          guideId: proposal.guideId,
          pageId: page.id,
          versionId: version.id,
          version: version.version,
          sourceProposalId: proposalId,
        },
      });
      if (wasFlagged) {
        await this.outbox.emit(tx, {
          type: 'guide.restored',
          aggregateId: proposal.guideId,
          payload: { guideId: proposal.guideId, slug: proposal.guide.slug, reason: 'CORRECTED' },
        });
      }
    });

    return this.proposalView(proposalId);
  }

  // ════════════════════════════════════════════════════════════════════════
  // Les pages d'un guide
  // ════════════════════════════════════════════════════════════════════════

  /**
   * POST /guides/:id/pages — ajouter une page, EN DERNIÈRE POSITION.
   *
   * SEUL L'AUTEUR, comme pour tout ce qui écrit dans un guide : `loadOwned` rend
   * 404 si le guide n'est pas le sien, ou `NOT_AUTHOR` s'il est public — c'est
   * exactement ce que font déjà `update`, `publish`, `unpublish` et `revert`, et
   * ces trois routes n'inventent rien. La modération, elle, ne passe PAS par ici :
   * ce module ne lui offre aucune route d'écriture de contenu (elle masque et
   * dépublie par le module 13), et lui en ouvrir une sans que le §4 la déclare
   * aurait créé un pouvoir que personne n'a demandé.
   *
   * `body` facultatif : la maquette A05 ajoute une section puis la remplit. Une
   * page sans corps n'a pas de version courante, et elle ne pèse rien dans le
   * total exigé à la publication.
   */
  async addPage(userId: string, guideId: string, input: CreateGuidePage) {
    const guide = await this.loadOwned(guideId, userId);
    // Le titre d'une page s'affiche comme un intertitre du guide : la règle dure
    // du §2.1 sur « certifié » y vaut autant que sur le titre du guide.
    this.assertTitleAllowed(input.title);

    const pages: PageWithBody[] = guide.pages;
    const last = pages[pages.length - 1];
    const position = (last?.position ?? 0) + 1;
    const pageId = newId();
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.guidePage.create({
        data: {
          id: pageId,
          guideId,
          position,
          title: input.title,
          slug: await this.freePageSlug(tx, guideId, input.title),
        },
      });

      if (input.body !== undefined) {
        const version = await this.appendVersion(tx, {
          guideId,
          pageId,
          body: input.body,
          createdByUserId: userId,
          summary: `Nouvelle page « ${input.title} »`,
        });
        await tx.guidePage.update({
          where: { id: pageId },
          data: { currentVersionId: version.id },
        });
        await this.syncBodyMedia(tx, { guideId, pageId, body: input.body, ownerUserId: userId });
        /**
         * `guide.version_created` ET NON UN `guide.page_added` INVENTÉ.
         *
         * Le catalogue d'événements (`common/outbox.service.ts`) refuse un type
         * sans consommateur nommé, et la seule chose qu'une page remplie change
         * pour quelqu'un, c'est l'INDEX : il porte le corps de toutes les pages,
         * et `search` est déjà abonné à cet événement. Un second type aurait
         * demandé un second abonnement pour le même travail.
         *
         * `pageId` et `newPage` sont dans la charge pour qu'un consommateur futur
         * puisse distinguer une page neuve d'une édition — sans avoir besoin d'un
         * type de plus.
         */
        await this.outbox.emit(tx, {
          type: 'guide.version_created',
          aggregateId: guideId,
          payload: {
            guideId,
            pageId,
            versionId: version.id,
            version: version.version,
            newPage: true,
            by: userId,
          },
        });
        /**
         * `last_content_update_at` NE BOUGE QUE SI DU CONTENU EST ARRIVÉ.
         *
         * Le porteur : « `lastContentUpdateAt` bouge dès qu'une page change. »
         * Une page VIDE n'a rien changé pour le lecteur : la faire remonter au
         * classement (§2.3) donnerait un guide « mis à jour aujourd'hui » dont
         * rien n'a été mis à jour, et un cadre vide ferait gagner la fraîcheur
         * qu'un vrai ajout mérite.
         */
        await tx.guide.update({
          where: { id: guideId },
          data: {
            lastContentUpdateAt: now,
            freshnessScore: computeFreshnessScore(guide.helpfulCount, now, now),
          },
        });
      }

      await this.syncGuideCurrentVersion(tx, guideId);
    });

    return this.byIdForAuthor(guideId, userId, pageId);
  }

  /**
   * PATCH /guides/:id/pages/:pageId — renommer, déplacer.
   *
   * LE SLUG SUIT LE TITRE TANT QUE LE GUIDE EST UN BROUILLON, et se fige ensuite.
   * C'est la règle du §2.1 appliquée telle quelle, un cran plus bas : un brouillon
   * n'a pas d'adresse publique, donc son slug peut encore dire ce qu'il contient ;
   * une fois publié, le slug voyage dans les liens partagés
   * (`/guides/:slug?page=<slug>`) et le changer les casserait tous.
   *
   * `position` est bornée au nombre de pages : l'écran n'a pas à le connaître
   * pour demander « mets-la en dernier ».
   */
  async updatePage(userId: string, guideId: string, pageId: string, patch: UpdateGuidePage) {
    const guide = await this.loadOwned(guideId, userId);
    const pages: PageWithBody[] = guide.pages;
    const page = pages.find((candidate) => candidate.id === pageId);
    if (page === undefined) throw ApiError.notFound();

    if (patch.title !== undefined) this.assertTitleAllowed(patch.title);

    await this.prisma.$transaction(async (tx) => {
      if (patch.title !== undefined) {
        await tx.guidePage.update({
          where: { id: pageId },
          data: {
            title: patch.title,
            ...(guide.status === 'DRAFT'
              ? { slug: await this.freePageSlug(tx, guideId, patch.title, pageId) }
              : {}),
          },
        });
      }
      if (patch.position !== undefined) await this.movePage(tx, guideId, pages, page, patch.position);

      /**
       * NI `last_content_update_at`, NI LA FRAÎCHEUR, NI AUCUN ÉVÉNEMENT.
       *
       * LA FRAÎCHEUR D'ABORD : renommer une section ou en changer l'ordre ne met
       * pas la DÉMARCHE à jour — les délais, les pièces et les adresses sont les
       * mêmes. Si ce geste rafraîchissait le guide, remonter au classement (§2.3)
       * coûterait un renommage, et le bandeau « À vérifier » du §2.6 — qui existe
       * pour dire qu'une information a vieilli — s'éteindrait sans qu'aucune
       * information n'ait été vérifiée.
       *
       * L'ÉVÉNEMENT ENSUITE : le catalogue (`common/outbox.service.ts`) refuse un
       * type sans consommateur nommé, et ce geste n'en a aucun. L'index de
       * recherche ne porte ni les titres de page ni leur ordre (seulement le titre
       * du guide et les corps), et aucune notification du §6 ne parle d'une
       * section renommée. Émettre « au cas où » aurait ajouté une ligne de
       * `domain_events` par frappe de l'éditeur, que rien n'aurait jamais lue.
       */
    });

    return this.byIdForAuthor(guideId, userId, pageId);
  }

  /**
   * DELETE /guides/:id/pages/:pageId — retirer une page.
   *
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ ON NE RETIRE PAS LA DERNIÈRE PAGE                                        ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * `LAST_PAGE` (409) : un guide sans page n'a pas de corps. Ni
   * `GET /guides/:slug` ni la publication ne sauraient quoi en faire, et
   * `guides.current_version_id` pointerait vers une version que plus aucune page
   * ne porte. Supprimer le guide entier est un AUTRE geste, que l'auteur doit
   * choisir explicitement.
   *
   * ── LA SUPPRESSION EST LOGIQUE, ET CE N'EST PAS UN DÉTAIL ────────────────
   *
   * `deleted_at`, pas un `DELETE`. `guide_versions` est en AJOUT SEUL (§2.7 :
   * « jamais de suppression d'historique ») et les versions d'une page partent en
   * CASCADE avec elle : un vrai `DELETE` effacerait une part de l'historique
   * public du guide, que §2.7 promet intégral. La page garde donc ses versions, et
   * ses commentaires avec elle.
   *
   * ⚠ CE QUE CELA LAISSE, ET QUI EST ASSUMÉ : les commentaires de la page retirée
   * existent toujours en base et ne sont plus atteignables par aucune route — la
   * page n'apparaît plus dans `pages`, donc plus personne ne demande son fil, et
   * le TOTAL du guide ne les compte plus (`listCounts` filtre `deletedAt: null`).
   * Les effacer serait pire : un auteur pourrait faire disparaître la critique
   * d'un lecteur en retirant la page où elle est écrite. Les laisser dormants
   * permet de rendre la page si le retrait était une erreur.
   *
   * Sa `position` passe en NÉGATIF pour libérer la place : `(guide_id, position)`
   * est unique et non différable. Son SLUG reste pris — recréer une page de même
   * titre obtient un slug suffixé, et c'est le prix de l'adresse figée.
   */
  async removePage(userId: string, guideId: string, pageId: string) {
    const guide = await this.loadOwned(guideId, userId);
    const pages: PageWithBody[] = guide.pages;
    const page = pages.find((candidate) => candidate.id === pageId);
    if (page === undefined) throw ApiError.notFound();
    if (pages.length <= 1) this.fail('LAST_PAGE', { guideId, pageId });

    const avaitDuContenu = (page.currentVersion?.body ?? '').length > 0;
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      const plancher = await this.negativePositionFloor(tx, guideId);
      await tx.guidePage.update({
        where: { id: pageId },
        data: { deletedAt: now, position: plancher },
      });
      // Les survivantes reprennent 1..n-1, dans le même ordre.
      await this.renumberPages(
        tx,
        pages.filter((candidate) => candidate.id !== pageId),
        plancher - 1,
      );

      /**
       * LE BALAYAGE DES IMAGES EST OBLIGATOIRE ICI. `guide_media` décrit ce que le
       * guide AFFICHE : sans cet appel, les images citées par la page retirée
       * resteraient rattachées, donc retiendraient des fichiers que plus personne
       * ne voit. Aucun `pageId` n'est passé — c'est l'état de la base APRÈS le
       * retrait qui fait foi, et la page n'y est plus.
       */
      await this.syncBodyMedia(tx, { guideId, ownerUserId: guide.authorUserId });

      if (avaitDuContenu) {
        // Du texte a disparu du guide : c'est un changement de contenu, comme
        // l'ajout d'une page remplie. Une page vide retirée ne change rien.
        await tx.guide.update({
          where: { id: guideId },
          data: {
            lastContentUpdateAt: now,
            freshnessScore: computeFreshnessScore(guide.helpfulCount, now, now),
          },
        });
      }

      await this.syncGuideCurrentVersion(tx, guideId);
      await this.outbox.emit(tx, {
        type: 'guide.page_removed',
        aggregateId: guideId,
        payload: { guideId, pageId, title: page.title, by: userId },
      });
    });

    return this.byIdForAuthor(guideId, userId);
  }

  // ════════════════════════════════════════════════════════════════════════
  // Conversion depuis un parcours (§2.8)
  // ════════════════════════════════════════════════════════════════════════

  /**
   * POST /journeys/:id/to-guide — pré-remplit un BROUILLON.
   *
   * « Le membre rédige. Rien n'est publié sans son action. » Cette route ne
   * publie donc rien : elle crée un brouillon, et s'arrête là.
   *
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ DEPUIS LES PAGES : UNE PAGE PAR ÉTAPE FRANCHIE                           ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Elle écrivait UN corps avec un `## Titre` par étape. C'est la maquette qui
   * tranche : A05 annonce « Une section par étape de *Mes études à Lyon* a été
   * pré-remplie », et une « section » d'un guide est désormais une PAGE — c'est
   * l'unité de lecture et l'unité de conversation. Le membre qui raconte son
   * parcours obtient donc le plan qu'il va remplir, et chaque étape a son propre
   * fil de commentaires : une question sur « le rendez-vous en préfecture » se
   * pose sous cette étape, pas sous le guide entier.
   *
   * LE PLAN COMPLET, dans l'ordre : une page d'introduction, une page par étape
   * franchie (dans l'ordre de `position`), et la page « Ce que je ferais
   * différemment » que §2.8 veut en dernier. Les titres de page ne portent plus
   * de `##` — le titre de la page EST l'intertitre, et l'y remettre donnerait deux
   * titres superposés à l'écran.
   *
   * ⚠ CONSÉQUENCE ASSUMÉE : un parcours de douze étapes franchies donne un guide
   * de quatorze pages. C'est beaucoup, et c'est un BROUILLON — l'auteur retire
   * (`DELETE /guides/:id/pages/:pageId`) celles qu'il ne veut pas raconter, et
   * c'est moins de travail que de découper un mur de texte à la main. Le total de
   * 300 caractères exigé à la publication se mesure sur l'ensemble, donc un plan
   * de quatorze pages à moitié rempli publie quand même.
   */
  async draftFromJourney(userId: string, journeyId: string) {
    const journey = await this.prisma.journey.findUnique({
      where: { id: journeyId },
      select: {
        id: true,
        ownerUserId: true,
        title: true,
        status: true,
        deletedAt: true,
        originCountryId: true,
        destinationCityId: true,
        templateVersion: { select: { template: { select: { nameFr: true } } } },
        steps: {
          where: { status: 'DONE' },
          orderBy: { position: 'asc' },
          select: {
            id: true,
            title: true,
            durationDays: true,
            stepDefinition: { select: { category: true } },
          },
        },
        activities: {
          where: { type: 'HELP_RECEIVED' },
          orderBy: { createdAt: 'asc' },
          select: { journeyStepId: true },
        },
      },
    });

    // Le parcours d'un autre membre ne se révèle pas : 404, jamais 403 (T4 §3).
    if (journey === null || journey.deletedAt !== null) throw ApiError.notFound();
    if (journey.ownerUserId !== userId) throw ApiError.notFound();
    if (journey.status !== 'COMPLETED') this.fail('JOURNEY_NOT_COMPLETED', { status: journey.status });

    const templateName = journey.templateVersion.template.nameFr;
    const title = this.fitTitle(`${templateName} : mon parcours, étape par étape`);
    const helpByStep = new Map<string, number>();
    for (const activity of journey.activities) {
      const stepId = activity.journeyStepId;
      if (stepId === null) continue;
      helpByStep.set(stepId, (helpByStep.get(stepId) ?? 0) + 1);
    }

    const pages: { title: string; body?: string }[] = [
      {
        title: 'Mon parcours en bref',
        body:
          `Ce guide part de mon parcours « ${templateName} ».\n\n` +
          'Résumez ici ce que vous avez vécu, et ce que ce guide apporte à qui le lira.',
      },
    ];

    for (const [index, step] of journey.steps.entries()) {
      const lines: string[] = [];
      if (step.durationDays !== null) {
        lines.push(`*Durée réelle : ${step.durationDays} jour${step.durationDays > 1 ? 's' : ''}.*`);
      }
      const help = helpByStep.get(step.id) ?? 0;
      if (help > 0) {
        lines.push(`*Aide reçue de la communauté : ${help} fois.*`);
      }
      lines.push('Racontez ici comment vous avez franchi cette étape.');
      pages.push({ title: this.fitPageTitle(step.title, index + 1), body: lines.join('\n\n') });
    }

    // §2.8 la veut en dernier, et elle reste la seule page sans texte d'exemple
    // à reprendre : c'est celle que l'auteur doit écrire lui-même.
    pages.push({
      title: 'Ce que je ferais différemment',
      body: 'Complétez cette page avant de publier.',
    });

    return this.createGuideWithPages(
      userId,
      {
        title,
        // `createGuideSchema` exige un `body` : c'est le corps de la page 1, et
        // `createGuideWithPages` ne le relit pas — il lit `pages`. On lui donne
        // donc celui de la page 1, pour que le type reste honnête.
        body: pages[0]?.body ?? '',
        category: this.categoryFromSteps(journey.steps),
        scope: 'COUNTRY',
        originCountryId: journey.originCountryId,
        cityId: journey.destinationCityId,
      },
      pages,
    );
  }

  /**
   * Le titre d'une étape, ramené aux bornes d'un titre de PAGE.
   *
   * Les deux ne sont pas bornés de la même façon : un titre d'étape de parcours
   * peut faire un mot (« Visa ») ou une phrase de deux cents caractères, et
   * `GUIDE_PAGE_TITLE_MIN/MAX` ne l'ont jamais contraint. Un titre trop court
   * devient « Étape N » plutôt qu'un refus : cette route pré-remplit un
   * brouillon, et faire échouer la conversion d'un parcours entier pour un titre
   * d'étape de un caractère serait disproportionné. L'auteur renomme.
   */
  private fitPageTitle(title: string, rank: number): string {
    const trimmed = title.trim();
    if (trimmed.length < GUIDE_PAGE_TITLE_MIN) return `Étape ${rank}`;
    return trimmed.length <= GUIDE_PAGE_TITLE_MAX
      ? trimmed
      : `${trimmed.slice(0, GUIDE_PAGE_TITLE_MAX - 1)}…`;
  }

  /**
   * Catégorie DÉDUITE (§2.8). Les deux nomenclatures ne se recouvrent pas :
   * `StepCategory` compte trois valeurs, `GuideCategory` six. La catégorie
   * dominante des étapes franchies donne la plus proche, et le membre corrige —
   * c'est un brouillon.
   */
  private categoryFromSteps(
    steps: readonly { stepDefinition: { category: string } | null }[],
  ): 'PRE_DEPARTURE' | 'ARRIVAL' | 'DAILY_LIFE' {
    const tally = new Map<string, number>();
    for (const step of steps) {
      const category = step.stepDefinition?.category;
      if (category === undefined) continue;
      tally.set(category, (tally.get(category) ?? 0) + 1);
    }
    let best: string | null = null;
    let bestCount = 0;
    for (const [category, count] of tally) {
      if (count > bestCount) {
        best = category;
        bestCount = count;
      }
    }
    if (best === 'PRE_DEPARTURE') return 'PRE_DEPARTURE';
    if (best === 'SETTLEMENT') return 'DAILY_LIFE';
    return 'ARRIVAL';
  }

  // ════════════════════════════════════════════════════════════════════════
  // Tâches planifiées (§7)
  // ════════════════════════════════════════════════════════════════════════

  /**
   * `guide.freshness_recompute` — quotidienne (§2.3).
   *
   * Une requête par tranche de fraîcheur, et non une lecture ligne à ligne :
   * le score est `helpful_count × coeff`, donc PostgreSQL peut le calculer
   * lui-même. Les bornes viennent de `GUIDE_FRESHNESS_BRACKETS` : la table du
   * §2.3 n'est écrite qu'une fois, dans `@app/shared`.
   */
  /**
   * Une vue de plus, dans le compteur en attente.
   *
   * N'ÉCHOUE JAMAIS : une panne Redis ne doit pas transformer la lecture d'un guide
   * en erreur 500. Le compteur est approximatif par décision de §5 ; perdre une vue
   * est sans conséquence, perdre la page ne l'est pas.
   */
  private async countView(guideId: string): Promise<void> {
    if (this.views === null) return;
    try {
      await this.views.increment(guideId);
    } catch (error) {
      this.logger.warn(
        `compteur de vues indisponible pour ${guideId} : ` +
          (error instanceof Error ? error.message : String(error)),
      );
    }
  }

  /**
   * `guide.view_count_flush` — horaire (§7).
   *
   * L'ORDRE DES DEUX OPÉRATIONS EST TOUTE LA TÂCHE, et il est
   * contre-intuitif : on PRÉLÈVE d'abord (lecture + effacement atomiques dans
   * Redis), on ajoute ENSUITE en base.
   *
   * Dans cet ordre, une panne entre les deux PERD un lot de vues. Dans l'autre
   * ordre — ajouter en base, puis effacer Redis — la même panne les COMPTE DEUX
   * FOIS, et à chaque reprise de nouveau : `attempts` vaut 1 pour une tâche
   * horaire, mais un travail « bloqué » redistribué par BullMQ, ou un
   * redémarrage en pleine exécution, rejoue le créneau (c'est écrit dans
   * `scheduled-tasks.ts`, et c'est pourquoi l'idempotence y est exigée). Un
   * compteur qui double à chaque incident dérive sans retour possible ; un
   * compteur qui perd un lot reste approximatif, ce que §5 annonce noir sur
   * blanc. On choisit donc la perte.
   *
   * C'EST AUSSI CE QUI REND LA TÂCHE IDEMPOTENTE, et c'est ce que le test
   * d'idempotence de l'ordonnanceur mesure : `guides.view_count` entre dans son
   * empreinte (la colonne finit par `count`). Au second passage, le prélèvement
   * rend une carte VIDE, et la somme ne bouge pas d'une unité.
   *
   * `increment` et non une écriture de la valeur absolue : plusieurs vues ont pu
   * arriver depuis le début du prélèvement, et deux workers peuvent prélever des
   * lots disjoints. Un `set` écraserait l'un avec l'autre.
   *
   * BORNÉE : au plus `VIEW_FLUSH_BATCH` guides par passage, comme toute tâche
   * (`scheduled-tasks.ts`). Ce qui reste part au créneau suivant — dans une heure.
   */
  async flushViewCounts(): Promise<{ guides: number; vues: number }> {
    if (this.views === null) return { guides: 0, vues: 0 };

    const drained = await this.views.drain(GuidesService.VIEW_FLUSH_BATCH);
    if (drained.size === 0) return { guides: 0, vues: 0 };

    let guides = 0;
    let vues = 0;
    for (const [guideId, count] of drained) {
      if (count <= 0) continue;
      // `updateMany` et non `update` : un guide SUPPRIMÉ entre la vue et le vidage
      // est le cas normal d'un compteur horaire, et `update` lèverait `P2025` —
      // ce qui ferait échouer tout le lot pour une vue qui n'intéresse plus personne.
      const { count: written } = await this.prisma.guide.updateMany({
        where: { id: guideId },
        data: { viewCount: { increment: count } },
      });
      if (written > 0) {
        guides += 1;
        vues += count;
      }
    }

    return { guides, vues };
  }

  async recomputeFreshness(now: Date = new Date()): Promise<{ updated: number }> {
    let updated = 0;
    for (const [index, bracket] of GUIDE_FRESHNESS_BRACKETS.entries()) {
      const next = GUIDE_FRESHNESS_BRACKETS[index + 1];
      // La tranche court de `fromMonths` (inclus) à celle de la suivante
      // (exclue) : en dates, de la plus récente à la plus ancienne.
      const newerThan = next === undefined ? null : this.monthsAgo(next.fromMonths, now);
      const olderThan = this.monthsAgo(bracket.fromMonths, now);

      updated += await this.prisma.$executeRaw`
        UPDATE guides
        SET freshness_score = helpful_count * ${bracket.coefficient}::numeric
        WHERE status IN ('PUBLISHED', 'FLAGGED')
          AND last_content_update_at <= ${olderThan}
          AND (${newerThan}::timestamptz IS NULL OR last_content_update_at > ${newerThan})
          AND freshness_score <> helpful_count * ${bracket.coefficient}::numeric
      `;
    }
    return { updated };
  }

  /** `guide.proposal_escalation` — quotidienne (§2.4). */
  async escalateStaleProposals(now: Date = new Date()): Promise<{ escalated: number }> {
    const stale = await this.prisma.guideRevisionProposal.findMany({
      where: { status: 'PENDING', escalateAt: { lte: now } },
      select: { id: true, guideId: true, proposerUserId: true, guide: { select: { authorUserId: true } } },
      take: 200,
    });

    for (const proposal of stale) {
      await this.prisma.$transaction(async (tx) => {
        await tx.guideRevisionProposal.update({
          where: { id: proposal.id },
          data: { status: 'ESCALATED' },
        });
        await this.outbox.emit(tx, {
          type: 'guide.proposal_escalated',
          aggregateId: proposal.id,
          payload: {
            proposalId: proposal.id,
            guideId: proposal.guideId,
            proposerUserId: proposal.proposerUserId,
            reason: 'NO_DECISION_AFTER_DELAY',
          },
        });
      });
      // §2.4 : « dossier de modération ouvert (priorité 3), l'équipe accepte ou
      // refuse à la place du créateur ».
      await this.openModerationCase({
        guideId: proposal.guideId,
        authorUserId: proposal.guide.authorUserId,
        source: 'AUTO_RULE',
        priority: GUIDE_ESCALATION_CASE_PRIORITY,
        dedupe: false,
      });
    }
    return { escalated: stale.length };
  }

  /** `guide.outdated_unpublish` — quotidienne (§2.6). */
  async unpublishOutdated(now: Date = new Date()): Promise<{ unpublished: number }> {
    const expired = await this.prisma.guide.findMany({
      where: { status: 'FLAGGED', unpublishDeadlineAt: { lte: now } },
      select: { id: true, slug: true, authorUserId: true },
      take: 500,
    });

    for (const guide of expired) {
      await this.prisma.$transaction(async (tx) => {
        await tx.guide.update({ where: { id: guide.id }, data: { status: 'UNPUBLISHED' } });
        await this.audit.record(tx, {
          actor: { type: 'SYSTEM' },
          action: 'guide.outdated_unpublish',
          targetType: 'guide',
          targetId: guide.id,
        });
        await this.outbox.emit(tx, {
          type: 'guide.unpublished',
          aggregateId: guide.id,
          payload: { guideId: guide.id, slug: guide.slug, reason: 'OUTDATED_DEADLINE' },
        });
      });
    }
    return { unpublished: expired.length };
  }

  /** `guide.author_inactivity` — hebdomadaire (§2.5). */
  async switchInactiveAuthorsToCommunity(
    now: Date = new Date(),
  ): Promise<{ switched: number }> {
    const threshold = this.monthsAgo(GUIDE_AUTHOR_INACTIVITY_MONTHS, now);
    // Les auteurs d'abord, les guides ensuite : `updateMany` ne filtre pas sur
    // une relation, et une jointure déguisée en filtre imbriqué serait refusée
    // au moment où la tâche tourne — c'est-à-dire la nuit, sans personne.
    const inactive = await this.prisma.user.findMany({
      where: {
        /**
         * ╔════════════════════════════════════════════════════════════════════╗
         * ║ « JAMAIS VU » NE VEUT PAS DIRE « INACTIF DEPUIS SIX MOIS »        ║
         * ╚════════════════════════════════════════════════════════════════════╝
         *
         * Ce critère disait : « `lastSeenAt: null` est le cas d'un compte créé
         * puis abandonné : l'omettre laisserait ses guides sans personne pour les
         * tenir. » L'intention est juste, la clause ne la traduisait pas — elle
         * retenait AUSSI le compte créé ce matin, qui n'a rien abandonné du tout.
         *
         * ⚠ ET ELLE LES RETENAIT TOUS, parce que `users.last_seen_at` n'était
         * écrit par personne (mesuré : 29 855 comptes sur 29 953 à `null`). Tout
         * guide publié basculait donc « maintenu par la communauté » au premier
         * passage hebdomadaire, et son auteur perdait l'attribution de son guide
         * sans rien avoir fait. La colonne est désormais écrite par `AuthGuard` —
         * mais la clause reste fausse pour un compte qui n'a jamais ouvert une
         * page depuis sa création, et elle le serait encore si l'écriture venait
         * à retomber en panne.
         *
         * L'ÂGE DU COMPTE EST DONC LA SECONDE CONDITION, et c'est la vraie
         * traduction de « créé puis abandonné » : jamais vu ET créé avant le
         * seuil. Les deux correctifs sont indépendants — celui-ci protège même si
         * l'autre cède.
         */
        OR: [
          { lastSeenAt: null, createdAt: { lt: threshold } },
          { lastSeenAt: { lt: threshold } },
        ],
        guides: { some: { maintainedByCommunity: false, status: { in: ['PUBLISHED', 'FLAGGED'] } } },
      },
      select: { id: true },
      take: 1_000,
    });
    if (inactive.length === 0) return { switched: 0 };

    const result = await this.prisma.guide.updateMany({
      where: {
        maintainedByCommunity: false,
        status: { in: ['PUBLISHED', 'FLAGGED'] },
        authorUserId: { in: inactive.map((user) => user.id) },
      },
      data: { maintainedByCommunity: true },
    });
    return { switched: result.count };
  }

  // ════════════════════════════════════════════════════════════════════════
  // Gestionnaire de suppression (§8)
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Consommateur de `user.deleted` (§6 et §8).
   *
   * RÈGLE DURE (§9) : les guides publiés sont ANONYMISÉS, pas supprimés. C'est
   * la mémoire collective de la plateforme — un membre qui part n'emporte pas
   * les démarches qu'il a expliquées.
   */
  async handleUserDeleted(userId: string): Promise<{
    anonymised: number;
    draftsDeleted: number;
    votesRemoved: number;
    proposalsRejected: number;
  }> {
    const guides = await this.prisma.guide.findMany({
      where: { authorUserId: userId },
      select: { id: true, status: true },
    });
    const drafts = guides.filter((g) => g.status === 'DRAFT').map((g) => g.id);
    const published = guides.filter((g) => g.status !== 'DRAFT').map((g) => g.id);

    const votes = await this.prisma.guideVote.findMany({
      where: { userId },
      select: { id: true, guideId: true, value: true },
    });

    return this.prisma.$transaction(async (tx) => {
      // Brouillons : supprimés (§8). Les versions suivent par cascade.
      if (drafts.length > 0) {
        await tx.guide.deleteMany({ where: { id: { in: drafts } } });
      }

      if (published.length > 0) {
        await tx.guide.updateMany({
          where: { id: { in: published } },
          data: { authorUserId: null, maintainedByCommunity: true },
        });
      }
      // Les versions écrites par le membre perdent leur auteur, sur TOUS les
      // guides — y compris ceux des autres, où il a contribué.
      await tx.guideVersion.updateMany({
        where: { createdByUserId: userId },
        data: { createdByUserId: null },
      });

      // Votes : supprimés, compteurs décrémentés, réputation des auteurs
      // concernés ajustée (§8).
      for (const vote of votes) {
        await tx.guideVote.delete({ where: { id: vote.id } });
        await tx.reputationEvent.deleteMany({
          where: { sourceType: 'guide_vote', sourceId: vote.id },
        });
        if (vote.value === 'HELPFUL') {
          const guide = await tx.guide.update({
            where: { id: vote.guideId },
            data: { helpfulCount: { decrement: 1 } },
            select: { helpfulCount: true, lastContentUpdateAt: true },
          });
          await tx.guide.update({
            where: { id: vote.guideId },
            data: {
              freshnessScore: computeFreshnessScore(
                Math.max(0, guide.helpfulCount),
                guide.lastContentUpdateAt,
              ),
            },
          });
        }
      }

      // Propositions en attente : refusées, motif « compte supprimé » (§8).
      const rejected = await tx.guideRevisionProposal.updateMany({
        where: { proposerUserId: userId, status: { in: ['PENDING', 'ESCALATED'] } },
        data: { status: 'REJECTED', rejectReason: 'compte supprimé', decidedAt: new Date() },
      });

      await this.audit.record(tx, {
        actor: { type: 'SYSTEM' },
        action: 'guide.author_anonymised',
        targetType: 'user',
        targetId: userId,
        metadata: { anonymised: published.length, draftsDeleted: drafts.length },
      });

      return {
        anonymised: published.length,
        draftsDeleted: drafts.length,
        votesRemoved: votes.length,
        proposalsRejected: rejected.count,
      };
    });
  }

  // ════════════════════════════════════════════════════════════════════════
  // Outils
  // ════════════════════════════════════════════════════════════════════════

  /** RÈGLE DURE (§2.1) : « certifié » et ses dérivés, dans un titre. */
  private assertTitleAllowed(title: string): void {
    // La fonction vient de `@app/shared` : elle épargne « certificat », qui
    // nomme un document réel, et rejette « certification », qui est l'acte.
    // En réécrire une ici garantirait que les deux divergent.
    if (containsForbiddenWord(title)) this.fail('FORBIDDEN_WORD', { field: 'title' });
  }

  /**
   * Le pays et la ville existent-ils ?
   *
   * Vérifié AVANT l'écriture, pour rendre un 404 propre plutôt qu'une violation
   * de clé étrangère remontée en 500. La contrainte `guides_country_scope` de la
   * base reste le dernier mot, mais elle ne doit jamais être ce que le membre
   * voit.
   */
  private async assertPlacesExist(
    originCountryId: string | undefined,
    cityId: string | undefined,
  ): Promise<void> {
    if (originCountryId !== undefined) {
      const country = await this.prisma.country.findUnique({
        where: { id: originCountryId },
        select: { isActive: true },
      });
      // Un pays inactif n'apparaît nulle part côté membres (02 §2.1) : il ne
      // peut donc pas non plus être choisi comme portée d'un guide.
      if (country === null || !country.isActive) throw ApiError.notFound();
    }
    if (cityId !== undefined) {
      const city = await this.prisma.city.findUnique({
        where: { id: cityId },
        select: { mergedIntoCityId: true },
      });
      if (city === null || city.mergedIntoCityId !== null) throw ApiError.notFound();
    }
  }

  /**
   * Combien de fois le passage apparaît, au plus deux.
   *
   * S'arrête à DEUX, et non au compte exact : la seule question posée est
   * « exactement une fois ? », et un passage de quatre caractères répété cent
   * fois dans un corps de 20 000 ne doit pas coûter cent recherches pour une
   * réponse qu'on tient dès la deuxième. Extraite de `assertExcerptUnique` parce
   * que `createProposal` doit maintenant interroger CHAQUE page sans lever au
   * premier échec — il cherche laquelle contient le passage.
   */
  private countOccurrences(body: string, excerpt: string): number {
    let occurrences = 0;
    let from = 0;
    for (;;) {
      const at = body.indexOf(excerpt, from);
      if (at === -1) break;
      occurrences += 1;
      if (occurrences > 1) break;
      from = at + excerpt.length;
    }
    return occurrences;
  }

  private assertExcerptUnique(body: string, excerpt: string): void {
    const occurrences = this.countOccurrences(body, excerpt);
    if (occurrences !== 1) this.fail('EXCERPT_NOT_FOUND', { occurrences });
  }

  /**
   * Limite du §2.1 : trois guides publiés par jour.
   *
   * Comptée dans `audit_logs` : le schéma figé n'a pas de `guides.published_at`,
   * et la ligne d'audit écrite par `publish()` est la seule trace horodatée
   * d'une publication. La table est en ajout seul — le compteur ne peut pas être
   * effacé pour contourner la limite.
   */
  private async assertDailyPublishLimit(userId: string): Promise<void> {
    const since = new Date(Date.now() - 86_400_000);
    const published = await this.prisma.auditLog.count({
      where: {
        actorType: 'MEMBER',
        actorId: userId,
        action: 'guide.published',
        createdAt: { gte: since },
      },
    });
    if (published >= GUIDE_DAILY_PUBLISH_LIMIT) {
      this.fail('GUIDE_LIMIT_REACHED', {
        limit: GUIDE_DAILY_PUBLISH_LIMIT,
        current: published,
      });
    }
  }

  /**
   * Modération à la publication, « comme pour un post » (§2.1).
   *
   * Le pipeline complet appartient au module 13 (scores, verdicts, file
   * humaine) ; il n'existe pas encore. Ce qui est fait ici est le minimum
   * NON NÉGOCIABLE : le texte est masqué avant de quitter le serveur (règle
   * dure 13 §2), un verdict bloquant refuse la publication et ouvre un dossier.
   * Quand le module 13 arrivera, ce bloc l'appellera au lieu du fournisseur.
   */
  private async assertModerationAllows(
    title: string,
    body: string,
    guideId: string,
    authorUserId: string,
  ): Promise<void> {
    const { text } = redactForModeration(`${title}\n\n${body}`);
    assertRedacted(text);

    let verdict: { labels: string[]; score: number };
    try {
      verdict = await this.moderation.classify(text);
    } catch (error) {
      // Un fournisseur indisponible ne bloque pas la publication : §2.1 veut
      // une modération, pas un point de panne unique. Le dossier est ouvert,
      // l'équipe relira.
      this.logger.warn(`Modération indisponible, publication laissée passer : ${String(error)}`);
      await this.openModerationCase({
        guideId,
        authorUserId,
        source: 'AI',
        priority: 3,
        dedupe: true,
      });
      return;
    }

    const blocking = verdict.labels.filter((label) =>
      ['SCAM', 'MONEY_REQUEST', 'HARASSMENT', 'HATE', 'SEXUAL', 'SELF_HARM'].includes(label),
    );
    if (blocking.length === 0) return;

    await this.openModerationCase({
      guideId,
      authorUserId,
      source: 'AI',
      // 13 §2 : arnaque et demande d'argent sont en priorité 1.
      priority: blocking.some((l) => l === 'SCAM' || l === 'MONEY_REQUEST') ? 1 : 2,
      dedupe: true,
      labels: blocking,
      score: verdict.score,
    });
    this.fail('CONTENT_BLOCKED', { labels: blocking });
  }

  private async openModerationCase(input: {
    guideId: string;
    authorUserId: string | null;
    source: 'AI' | 'AUTO_RULE';
    priority: number;
    dedupe: boolean;
    labels?: readonly string[];
    score?: number;
  }): Promise<void> {
    if (input.dedupe) {
      const open = await this.prisma.moderationCase.findFirst({
        where: {
          subjectType: 'GUIDE',
          subjectId: input.guideId,
          source: input.source,
          status: { in: ['OPEN', 'IN_REVIEW'] },
        },
        select: { id: true },
      });
      // Cinq votes négatifs de plus ne doivent pas ouvrir un sixième dossier
      // sur le même guide : la file de modération deviendrait illisible.
      if (open !== null) return;
    }

    await this.prisma.moderationCase.create({
      data: {
        id: newId(),
        subjectType: 'GUIDE',
        subjectId: input.guideId,
        subjectAuthorUserId: input.authorUserId,
        source: input.source,
        priority: input.priority,
        status: 'OPEN',
        aiLabels: [...(input.labels ?? [])],
        ...(input.score === undefined ? {} : { aiScore: input.score }),
        // 13 : SLA de 24 h, ramené à 4 h en priorité 1.
        slaDueAt: new Date(Date.now() + (input.priority === 1 ? 4 : 24) * 3_600_000),
      },
    });
  }

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LES IMAGES DU CORPS — VÉRIFIÉES, PUIS RATTACHÉES DANS LA MÊME TRANSACTION ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * `guideBodyMediaKeys` (@app/shared) a déjà dit que CHAQUE image du corps est
   * une adresse de média de l'application : la grammaire est refusée à la
   * frontière, par le schéma, et ce service ne voit donc jamais d'URL externe.
   * Ce qu'un schéma ne peut PAS dire, parce qu'il ne lit pas la base, c'est si la
   * clé citée désigne quelque chose. Trois questions restent, et ce sont les
   * trois que 00 §8.2 et §8.3 posent :
   *
   *   1. **EXISTE-T-IL ?** Une clé inventée — ou copiée depuis un guide supprimé
   *      — donnerait un cadre vide que personne ne peut réparer ;
   *   2. **EST-IL PRÊT ?** `status` vaut `PENDING`, `SCANNING`, `REJECTED` ou
   *      `READY`. Publier un `REJECTED`, c'est afficher le fichier que
   *      l'antivirus vient de refuser ; publier un `SCANNING`, c'est afficher un
   *      fichier dont on ne sait pas encore s'il est propre ;
   *   3. **EST-IL À L'AUTEUR ?** La clé de stockage VAUT autorisation de lecture
   *      (16 octets d'aléa, voir `MediaService.keyFor`) : collée dans un guide,
   *      la clé d'un tiers republierait son image sous la signature de
   *      quelqu'un d'autre, et le retrait du média par son propriétaire casserait
   *      un guide qu'il ne sait pas avoir illustré.
   *
   * LE GENRE EST DANS LA CLAUSE `where` (`ATTACHABLE_KINDS.guide`) et le reste
   * est vérifié APRÈS la requête — c'est la règle que `media-attachment.ts` a
   * déjà tranchée, et son raisonnement vaut mot pour mot ici : un mauvais genre
   * doit être INTROUVABLE (sinon la réponse confirme ce qu'un `PROOF` est), un
   * mauvais statut doit être DIT (le membre vient de déposer le fichier et sait
   * qu'il existe).
   *
   * ── POURQUOI UNE LIGNE EN BASE, ET PAS SEULEMENT UNE VÉRIFICATION ─────────
   *
   * Parce qu'une vérification ne survit pas à l'instant où elle a lieu. Sans
   * `guide_media`, l'image serait validée à la publication puis plus jamais :
   * aucun nettoyage ne pourrait distinguer un média employé d'un orphelin, et
   * l'image disparaîtrait un jour SOUS le guide. La ligne est écrite dans LA MÊME
   * TRANSACTION que la version — sinon un corps citant une image existerait, même
   * une seconde, sans le lien qui la retient.
   *
   * ── `ownerUserId` À `null` : LE GUIDE SANS AUTEUR ────────────────────────
   *
   * §8 ANONYMISE les guides au lieu de les supprimer, et `account.service.ts`
   * met alors `media_assets.owner_user_id` à `null` (minimisation, §8.1). Un
   * guide maintenu par la communauté n'a donc plus personne à qui appartenir ses
   * images. Dans ce cas la propriété ne peut pas être exigée, et la règle qui la
   * remplace est PLUS stricte, pas moins : seuls passent les actifs DÉJÀ
   * rattachés à ce guide. Une correction communautaire peut déplacer ou garder
   * une image existante ; elle ne peut pas en introduire une nouvelle.
   *
   * ── LA SYNCHRONISATION EST UN DIFF, PAS UN « VIDER PUIS REMPLIR » ────────
   *
   * L'éditeur enregistre en continu (§5) : effacer et réécrire les lignes à
   * chaque frappe ferait de `guide_media.id` et de `created_at` des valeurs sans
   * aucun sens, et la table est aussi ce qu'un nettoyage futur lira pour dater un
   * rattachement. On garde donc la ligne d'un actif encore cité et on ne corrige
   * que sa `position`.
   */
  private async syncBodyMedia(
    tx: Prisma.TransactionClient,
    input: { guideId: string; ownerUserId: string | null; pageId?: string; body?: string },
  ): Promise<void> {
    /**
     * ╔══════════════════════════════════════════════════════════════════════════╗
     * ║ LE BALAYAGE PORTE SUR LE CORPS DE TOUTES LES PAGES                      ║
     * ╚══════════════════════════════════════════════════════════════════════════╝
     *
     * `guide_media` RESTE AU NIVEAU DU GUIDE, et c'est un choix mesuré, pas une
     * économie : une image appartient au guide, citée par l'une de ses pages. La
     * descendre sur la page coûterait une migration de plus pour ne rien ajouter —
     * aucune règle du module ne demande « les images de la page 3 », alors que
     * trois en demandent celles du guide (le nettoyage des orphelins,
     * l'anonymisation du §8, et le retrait d'un actif par son propriétaire). Et
     * cela PERDRAIT quelque chose : déplacer un paragraphe illustré d'une page à
     * l'autre deviendrait un retrait suivi d'un rattachement, donc un instant où
     * l'image n'est retenue par rien.
     *
     * CE QUI OBLIGE À LIRE TOUTES LES PAGES ICI. Le corps d'une seule page ne
     * décrit plus ce que le guide affiche : balayer avec lui seul effacerait les
     * rattachements des images des AUTRES pages à chaque frappe de l'éditeur, et
     * elles disparaîtraient sous un guide que personne n'a modifié.
     *
     * `pageId` + `body` REMPLACENT le corps d'une page par celui qu'on est en
     * train d'écrire — il n'est pas encore en base, et c'est tout l'intérêt
     * d'appeler cette méthode AVANT l'écriture de la version : un refus d'image
     * annule la transaction entière. Sans eux (retrait d'une page), c'est l'état
     * de la base qui fait foi.
     */
    const livePages = await tx.guidePage.findMany({
      where: { guideId: input.guideId, deletedAt: null },
      orderBy: { position: 'asc' },
      select: { id: true, currentVersion: { select: { body: true } } },
    });
    const bodies = livePages.map((page) =>
      page.id === input.pageId && input.body !== undefined
        ? input.body
        : (page.currentVersion?.body ?? ''),
    );
    // La page visée peut ne pas être encore en base — elle l'est toujours
    // aujourd'hui (créée dans la même transaction, juste avant), mais un appelant
    // futur qui vérifierait un corps avant de créer sa page ne doit pas le voir
    // silencieusement ignoré.
    if (
      input.pageId !== undefined &&
      input.body !== undefined &&
      !livePages.some((page) => page.id === input.pageId)
    ) {
      bodies.push(input.body);
    }

    const keys = guideBodyMediaKeys(joinGuidePageBodies(bodies));

    const existing = await tx.guideMedia.findMany({
      where: { guideId: input.guideId },
      select: { id: true, position: true, mediaAssetId: true, mediaAsset: { select: { storageKey: true } } },
      orderBy: { position: 'asc' },
    });

    if (keys.length === 0) {
      // AUCUNE page n'affiche d'image : les rattachements d'une version
      // précédente ne décrivent plus rien. Les laisser retiendrait des fichiers
      // que le guide n'affiche plus — exactement l'inverse de ce que la table
      // sert à faire.
      if (existing.length > 0) {
        await tx.guideMedia.deleteMany({ where: { guideId: input.guideId } });
      }
      return;
    }

    const attachedKeys = new Set(existing.map((row) => row.mediaAsset.storageKey));

    const assets = await tx.mediaAsset.findMany({
      where: {
        storageKey: { in: keys },
        deletedAt: null,
        // COPIE du tableau partagé : Prisma exige un tableau mutable, et lui
        // donner la constante lui donnerait de quoi la vider pour tous.
        kind: { in: [...ATTACHABLE_KINDS.guide] },
      },
      select: { id: true, storageKey: true, status: true, ownerUserId: true },
    });
    const byKey = new Map(assets.map((asset) => [asset.storageKey, asset]));

    /**
     * Le refus NOMME CHAQUE CLÉ ET SON MOTIF. L'éditeur peut alors désigner
     * l'image fautive ; un `IMAGE_NOT_ATTACHABLE` nu obligerait le membre à
     * retirer ses images une par une pour trouver laquelle bloque.
     *
     * Dire le motif ne révèle rien qu'il ne sache déjà : il FAUT tenir la clé
     * pour l'écrire, et tenir la clé vaut déjà autorisation de lecture.
     */
    const refus: { key: string; reason: string }[] = [];
    const orderedAssetIds: string[] = [];

    for (const key of keys) {
      const asset = byKey.get(key);
      if (asset === undefined) {
        refus.push({ key, reason: 'UNKNOWN' });
        continue;
      }
      if (asset.status !== REQUIRED_MEDIA_STATUS) {
        refus.push({ key, reason: asset.status === 'REJECTED' ? 'REJECTED' : 'NOT_READY' });
        continue;
      }
      const owned =
        input.ownerUserId !== null && asset.ownerUserId === input.ownerUserId;
      if (!owned && !attachedKeys.has(key)) {
        refus.push({ key, reason: 'NOT_OWNED' });
        continue;
      }
      orderedAssetIds.push(asset.id);
    }

    if (refus.length > 0) this.fail('IMAGE_NOT_ATTACHABLE', { images: refus });

    const keptByAsset = new Map<string, { id: string; position: number }>();
    const surplus: string[] = [];
    for (const row of existing) {
      // Une ligne dont l'actif n'est plus cité s'en va ; un DOUBLON hérité
      // (`guide_media` n'a pas d'unicité, comme `post_media`) aussi.
      if (!orderedAssetIds.includes(row.mediaAssetId) || keptByAsset.has(row.mediaAssetId)) {
        surplus.push(row.id);
        continue;
      }
      keptByAsset.set(row.mediaAssetId, { id: row.id, position: row.position });
    }
    if (surplus.length > 0) {
      await tx.guideMedia.deleteMany({ where: { id: { in: surplus } } });
    }

    for (const [index, assetId] of orderedAssetIds.entries()) {
      const kept = keptByAsset.get(assetId);
      if (kept === undefined) {
        await tx.guideMedia.create({
          data: { id: newId(), guideId: input.guideId, mediaAssetId: assetId, position: index },
        });
        continue;
      }
      if (kept.position !== index) {
        await tx.guideMedia.update({ where: { id: kept.id }, data: { position: index } });
      }
    }
  }

  /**
   * Version suivante, SUR UNE PAGE. La table est en AJOUT SEUL : on n'écrase
   * jamais.
   *
   * `version` reste numérotée par GUIDE et non par page, et c'est voulu :
   * l'historique public du §2.7 est celui de la DÉMARCHE (`GET
   * /guides/:slug/versions` les liste toutes, dans l'ordre), et
   * `(guide_id, version)` reste l'unicité qui l'ordonne. La version 7 d'un guide
   * est donc sa 7ᵉ écriture, sur n'importe laquelle de ses pages. Numéroter par
   * page aurait donné deux « version 3 » dans un même historique, et aurait
   * demandé de REMPLACER l'index unique — un `DROP CONSTRAINT`, interdit ici.
   */
  private async appendVersion(
    tx: Prisma.TransactionClient,
    input: {
      guideId: string;
      pageId: string;
      body: string;
      createdByUserId: string | null;
      summary?: string;
      sourceProposalId?: string;
    },
  ): Promise<{ id: string; version: number }> {
    const last = await tx.guideVersion.aggregate({
      where: { guideId: input.guideId },
      _max: { version: true },
    });
    const version = (last._max.version ?? 0) + 1;
    try {
      const created = await tx.guideVersion.create({
        data: {
          id: newId(),
          guideId: input.guideId,
          pageId: input.pageId,
          version,
          body: input.body,
          summary: input.summary ?? null,
          createdByUserId: input.createdByUserId,
          sourceProposalId: input.sourceProposalId ?? null,
        },
        select: { id: true, version: true },
      });
      return created;
    } catch (error) {
      // L'index unique (guide, version) a parlé : deux décisions simultanées.
      // Une erreur propre, pas une violation de contrainte remontée brute.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw ApiError.transverse('CONFLICT', { reason: 'CONCURRENT_VERSION' });
      }
      throw error;
    }
  }

  /**
   * Slug libre POUR UNE PAGE, dans le guide.
   *
   * `slugifyGuideTitle` est RÉEMPLOYÉE, et la reprise de données reproduit la
   * même règle en SQL — vérifié sur les 127 titres de la base : 0 écart. Une
   * seconde translittération aurait fini par donner un autre slug pour le même
   * titre, et un slug est figé à l'écriture : l'écart serait définitif.
   *
   * L'unicité est `(guide_id, slug)` et non globale : deux guides peuvent avoir
   * une page « Le dossier », et c'est normal — l'adresse les distingue déjà par
   * le slug du guide.
   *
   * ⚠ LES PAGES RETIRÉES COMPTENT DANS LES SLUGS PRIS (aucun `deletedAt: null`
   * ici) : leur ligne existe toujours, et l'index unique ne connaît pas la
   * suppression logique. Recréer une page de même titre obtient donc `-2`.
   */
  private async freePageSlug(
    tx: Prisma.TransactionClient,
    guideId: string,
    title: string,
    excludePageId?: string,
  ): Promise<string> {
    const base = slugifyGuideTitle(title);
    const taken = await tx.guidePage.findMany({
      where: {
        guideId,
        slug: { startsWith: base },
        ...(excludePageId === undefined ? {} : { id: { not: excludePageId } }),
      },
      select: { slug: true },
    });
    const used = new Set(taken.map((row) => row.slug));
    if (!used.has(base)) return base;
    for (let suffix = 2; suffix < 1_000; suffix += 1) {
      const candidate = `${base}-${suffix}`;
      if (!used.has(candidate)) return candidate;
    }
    return `${base}-${newId().slice(0, 8)}`;
  }

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ UNE POSITION LIBRE SOUS TOUTES LES AUTRES — LE PRIX D'UNE UNICITÉ        ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * `(guide_id, position)` est un index unique et PostgreSQL ne le vérifie pas en
   * fin de transaction : il le vérifie ligne à ligne. Un décalage naïf
   * (`position = position + 1`) échoue donc au premier chevauchement, et un
   * `UPDATE` ensembliste dans le « bon » ordre ne se commande pas.
   *
   * La parade est un ESPACE LIBRE : toutes les positions provisoires sont écrites
   * STRICTEMENT SOUS la plus petite position existante, donc hors de portée de
   * tout ce qui est déjà là. Et elle sert deux fois :
   *
   *   · au DÉPLACEMENT, pour garer les pages avant de les renuméroter ;
   *   · au RETRAIT, pour y garer la page retirée définitivement — sinon elle
   *     garderait une position que la renumérotation veut rendre à une autre.
   *
   * Le minimum est pris sur TOUTES les lignes du guide, retirées comprises : ce
   * sont elles qui occupent déjà le négatif.
   */
  private async negativePositionFloor(
    tx: Prisma.TransactionClient,
    guideId: string,
  ): Promise<number> {
    const aggregate = await tx.guidePage.aggregate({
      where: { guideId },
      _min: { position: true },
    });
    return Math.min((aggregate._min.position ?? 1) - 1, -1);
  }

  /**
   * Renumérote `ordered` en 1…n, EN DEUX PASSES.
   *
   * Passe 1 : chacune part se garer sur une position négative libre (voir
   * `negativePositionFloor`). Passe 2 : chacune reçoit sa position finale. Sans la
   * première passe, la seconde heurterait l'unicité dès que deux pages échangent
   * leur place — et le refus arriverait au MILIEU de la boucle, laissant un plan
   * à moitié renuméroté si la transaction n'était pas là pour tout annuler.
   */
  private async renumberPages(
    tx: Prisma.TransactionClient,
    ordered: readonly { id: string }[],
    floor: number,
  ): Promise<void> {
    for (const [index, page] of ordered.entries()) {
      await tx.guidePage.update({ where: { id: page.id }, data: { position: floor - index } });
    }
    for (const [index, page] of ordered.entries()) {
      await tx.guidePage.update({ where: { id: page.id }, data: { position: index + 1 } });
    }
  }

  /**
   * Déplace `page` à la position `wanted` (comptée à partir de 1), BORNÉE.
   *
   * Bornée et non refusée : « mets-la en dernier » s'écrit alors sans connaître le
   * nombre de pages, et une position de 99 sur un guide de trois pages veut dire
   * la même chose. Refuser aurait obligé chaque écran à compter d'abord.
   */
  private async movePage(
    tx: Prisma.TransactionClient,
    guideId: string,
    pages: readonly PageWithBody[],
    page: PageWithBody,
    wanted: number,
  ): Promise<void> {
    const target = Math.min(Math.max(wanted, 1), pages.length);
    const others = pages.filter((candidate) => candidate.id !== page.id);
    const ordered = [...others.slice(0, target - 1), page, ...others.slice(target - 1)];
    if (ordered.every((candidate, index) => candidate.position === index + 1)) return;
    await this.renumberPages(tx, ordered, await this.negativePositionFloor(tx, guideId));
  }

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ `guides.current_version_id` EST UN REFLET, ET ON LE TIENT À JOUR         ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * LA COLONNE EST DÉPRÉCIÉE au profit de `guide_pages.current_version_id` : la
   * « version courante d'un guide » n'a plus de sens, un guide de trois pages en a
   * trois. Elle n'a PAS été supprimée, et un `DROP COLUMN` était explicitement
   * interdit sur cette base.
   *
   * ELLE SUIT LA PREMIÈRE PAGE, et ce n'est pas arbitraire : c'est la page que
   * `GET /guides/:slug` rend quand aucune n'est demandée, donc celle qu'un lien
   * partagé avant les pages ouvre encore. Trois choses continuent ainsi de
   * fonctionner sans rien savoir des pages :
   *
   *   1. `GET /guides/:slug/versions` rend `meta.currentVersionId`, et A04 s'en
   *      sert pour marquer la ligne courante de l'historique ;
   *   2. la contrainte `guides_current_version_id_fkey` existe en base — la
   *      laisser pointer vers une version d'une page RETIRÉE l'aurait rendue
   *      fausse sans l'invalider ;
   *   3. tout lecteur futur de cette colonne (une tâche, un export, un outil
   *      d'équipe) trouve un corps qui existe, et pas `null`.
   *
   * ⚠ ELLE EST DONC INCOMPLÈTE PAR CONSTRUCTION : elle ne connaît que la page 1.
   * Ce qu'il faudrait pour la retirer un jour est écrit sur la colonne elle-même,
   * dans `05-guides.prisma`.
   */
  private async syncGuideCurrentVersion(
    tx: Prisma.TransactionClient,
    guideId: string,
  ): Promise<void> {
    const first = await tx.guidePage.findFirst({
      where: { guideId, deletedAt: null },
      orderBy: { position: 'asc' },
      select: { currentVersionId: true },
    });
    const currentVersionId = first?.currentVersionId ?? null;
    // `updateMany` et non `update` : si le guide a disparu dans la même
    // transaction, `update` lèverait `P2025` et ferait échouer tout le reste pour
    // un reflet dont plus personne n'a besoin. Et `tx`, jamais `this.prisma` : le
    // reflet doit vivre ou mourir avec l'écriture qu'il reflète.
    await tx.guide.updateMany({ where: { id: guideId }, data: { currentVersionId } });
  }

  /**
   * Slug libre, suffixé en cas de conflit (§2.1).
   *
   * L'unicité est vérifiée AVANT l'insertion pour choisir le suffixe, et
   * garantie APRÈS par l'index unique : entre les deux, deux membres peuvent
   * publier le même titre à la même seconde.
   */
  private async freeSlug(
    tx: Prisma.TransactionClient,
    title: string,
    excludeGuideId?: string,
  ): Promise<string> {
    const base = slugifyGuideTitle(title);
    const taken = await tx.guide.findMany({
      where: {
        slug: { startsWith: base },
        ...(excludeGuideId === undefined ? {} : { id: { not: excludeGuideId } }),
      },
      select: { slug: true },
    });
    const used = new Set(taken.map((row) => row.slug));
    if (!used.has(base)) return base;
    for (let suffix = 2; suffix < 1_000; suffix += 1) {
      const candidate = `${base}-${suffix}`;
      if (!used.has(candidate)) return candidate;
    }
    return `${base}-${newId().slice(0, 8)}`;
  }

  /**
   * Le guide ET SES PAGES, s'il appartient au demandeur. 404 sinon : un brouillon
   * ne se devine pas.
   *
   * Les pages viennent AVEC, et par `PAGES_WITH_BODY` : les sept écritures qui
   * passent par ici en ont toutes besoin — pour trouver celle que `pageId` vise,
   * pour assembler le corps publiable, pour refuser le retrait de la dernière, ou
   * pour renuméroter. Les charger séparément aurait fait de « quelles sont les
   * pages de ce guide » une question à sept réponses possibles.
   */
  private async loadOwned(guideId: string, userId: string) {
    const guide = await this.prisma.guide.findUnique({
      where: { id: guideId },
      include: { pages: PAGES_WITH_BODY },
    });
    if (guide === null || guide.deletedAt !== null) throw ApiError.notFound();
    if (guide.authorUserId !== userId) {
      // Un guide publié existe publiquement : le refus peut se dire. Un
      // brouillon, non — et 403 révélerait qu'il existe.
      if (guide.status === 'PUBLISHED' || guide.status === 'FLAGGED') this.fail('NOT_AUTHOR');
      throw ApiError.notFound();
    }
    return guide;
  }

  /**
   * Le guide, pour une action de LECTEUR : vote, signalement, proposition.
   *
   * Trois refus, dans cet ordre : le guide doit être visible, il ne doit pas
   * être celui du demandeur, et les deux membres ne doivent pas être séparés.
   */
  private async loadVotable(guideId: string, userId: string) {
    const now = new Date();
    const guide = await this.prisma.guide.findUnique({
      where: { id: guideId },
      // Les pages viennent avec : `createProposal` doit chercher dans quelle page
      // le passage visé se trouve, et il n'a pas d'autre moyen de le savoir.
      include: { pages: PAGES_WITH_BODY },
    });
    if (guide === null || guide.deletedAt !== null) throw ApiError.notFound();

    const visible =
      guide.status === 'PUBLISHED' ||
      (guide.status === 'FLAGGED' &&
        guide.unpublishDeadlineAt !== null &&
        guide.unpublishDeadlineAt > now);
    if (!visible) throw ApiError.notFound();

    // §2.2 et §2.4 : on ne vote pas, on ne signale pas, on ne propose pas sur
    // son propre guide — on l'édite.
    if (guide.authorUserId === userId) this.fail('OWN_GUIDE');
    if (guide.authorUserId !== null) {
      await this.visibility.assertVisible(userId, guide.authorUserId);
    }
    return guide;
  }

  /**
   * Ce que rendent les NEUF écritures de l'auteur — forme PLATE, distincte de
   * celle de `GET /guides/:slug` (voir `guideEditorResponseSchema`).
   *
   * `focusPageId` NOMME LA PAGE dont le corps est rendu, et c'est ce qui rend la
   * réponse non ambiguë : après un `PATCH` sur la page 3, l'éditeur recevait le
   * corps de la page 1 et croyait sa sauvegarde perdue. Absent (publication,
   * dépublication, retrait d'une page), c'est la PREMIÈRE — celle que la route de
   * lecture rend par défaut.
   *
   * `commentCount` est ici LE TOTAL DU GUIDE, comme sur la carte de liste dont
   * cette forme hérite : l'éditeur n'affiche pas de fil, et le total est le seul
   * nombre qui ait un sens hors d'une page lue. Le détail par page reste
   * disponible dans `pages[].commentCount`.
   */
  private async byIdForAuthor(guideId: string, userId: string, focusPageId?: string) {
    const guide = await this.prisma.guide.findUniqueOrThrow({
      where: { id: guideId },
      include: {
        ...LIST_INCLUDE,
        pages: {
          where: { deletedAt: null },
          orderBy: { position: 'asc' },
          select: {
            id: true,
            position: true,
            title: true,
            slug: true,
            currentVersion: { select: { id: true, version: true, body: true, summary: true } },
          },
        },
      },
    });

    const pageCounts = await this.pageCommentCounts(
      guide.pages.map((page) => page.id),
      userId,
    );
    const pages: GuidePageRef[] = guide.pages.map((page) => ({
      id: page.id,
      position: page.position,
      title: page.title,
      slug: page.slug,
      commentCount: pageCounts.get(page.id) ?? 0,
    }));
    const focusRow =
      (focusPageId === undefined
        ? guide.pages[0]
        : guide.pages.find((page) => page.id === focusPageId)) ?? guide.pages[0];
    // Un guide sans page ne peut pas exister (`LAST_PAGE`), mais le type doit le
    // dire : `findUniqueOrThrow` ne promet rien sur la longueur d'une relation.
    if (focusRow === undefined) throw ApiError.notFound();
    const currentPage =
      pages.find((page) => page.id === focusRow.id) ??
      ({
        id: focusRow.id,
        position: focusRow.position,
        title: focusRow.title,
        slug: focusRow.slug,
        commentCount: 0,
      } satisfies GuidePageRef);

    return {
      ...this.toListItem(guide, new Date(), {
        pageCount: pages.length,
        commentCount: pages.reduce((total, page) => total + page.commentCount, 0),
      }),
      originCountryId: guide.originCountryId,
      outdatedFlagCount: guide.outdatedFlagCount,
      unpublishDeadlineAt: guide.unpublishDeadlineAt,
      isAuthor: guide.authorUserId === userId,
      pages,
      currentPage,
      currentVersion: focusRow.currentVersion,
      /**
       * LE JETON DE CONCURRENCE, rendu par TOUTE réponse d'écriture.
       *
       * L'éditeur le renvoie en `baseRevision` à l'enregistrement suivant. Sans ce
       * renvoi, il se ferait refuser par sa PROPRE écriture au deuxième
       * enregistrement — la garde deviendrait un blocage au lieu d'une protection.
       *
       * Il est sur CETTE forme et pas sur la carte de liste : seul l'auteur écrit,
       * et une liste publique n'a rien à faire d'un jeton d'écriture concurrente.
       * Le voir ailleurs voudrait dire qu'on l'a mis trop haut.
       */
      revision: guide.revision,
    };
  }

  private async proposalView(proposalId: string) {
    return this.prisma.guideRevisionProposal.findUniqueOrThrow({
      where: { id: proposalId },
      select: {
        id: true,
        guideId: true,
        status: true,
        targetExcerpt: true,
        replacement: true,
        reason: true,
        sourceUrl: true,
        rejectReason: true,
        escalateAt: true,
        decidedAt: true,
        createdAt: true,
        proposer: { select: { handle: true, displayName: true } },
      },
    });
  }

  /** Une date située N mois calendaires avant `now`. */
  private monthsAgo(months: number, now: Date = new Date()): Date {
    const date = new Date(now);
    date.setMonth(date.getMonth() - months);
    return date;
  }

  private fitTitle(title: string): string {
    return title.length <= GUIDE_TITLE_MAX ? title : `${title.slice(0, GUIDE_TITLE_MAX - 3)}…`;
  }
}
