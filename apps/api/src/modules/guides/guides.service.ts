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
  guidePublishableBodySchema,
  monthsSince,
  slugifyGuideTitle,
  type CreateGuide,
  type CreateProposal,
  type GuideBanner,
  type GuideErrorCode,
  type GuideListQuery,
  type GuideListItem,
  type GuideVoteValue,
  type Page,
  type UpdateGuide,
} from '@app/shared';
import { ApiError } from '../../common/api-error';
import { AuditService } from '../../common/audit.service';
import { buildPage, decodeCursor } from '../../common/cursor';
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

    return {
      items: page.items.map((row) => this.toListItem(row, now)),
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

  private toListItem(row: GuideListRow, now: Date): GuideListItem {
    return {
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

  /** GET /guides/:slug — §4. */
  async bySlug(slug: string, viewerId: string | null) {
    const now = new Date();
    const guide = await this.prisma.guide.findUnique({
      where: { slug },
      include: {
        ...LIST_INCLUDE,
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

    const [myVote, myFlag] = await Promise.all([
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
    ]);

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
        ...this.toListItem(guide, now),
        originCountryId: guide.originCountryId,
        outdatedFlagCount: guide.outdatedFlagCount,
        unpublishDeadlineAt: guide.unpublishDeadlineAt,
        createdAt: guide.createdAt,
        isAuthor,
      },
      currentVersion: guide.currentVersion,
      contributors: guide.contributors,
      myVote: myVote?.value ?? null,
      myOutdatedFlag: myFlag,
    };
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

  /** GET /me/guides — tous statuts (§4). */
  async mine(userId: string, limit: number) {
    const now = new Date();
    const rows = await this.prisma.guide.findMany({
      where: { authorUserId: userId, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      include: LIST_INCLUDE,
    });
    return { items: rows.map((row) => this.toListItem(row, now)), nextCursor: null };
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

  /** POST /guides — brouillon (§2.1). */
  async createDraft(userId: string, input: CreateGuide) {
    // RÈGLE DURE (§2.1) : « certifié » et ses dérivés sont rejetés dans le
    // TITRE. Pas dans le corps : un guide doit pouvoir nommer « le certificat
    // de scolarité » ou citer un document officiel.
    this.assertTitleAllowed(input.title);
    await this.assertPlacesExist(input.originCountryId, input.cityId);

    const now = new Date();
    const guideId = newId();
    const versionId = newId();

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
      await tx.guideVersion.create({
        data: { id: versionId, guideId, version: 1, body: input.body, createdByUserId: userId },
      });
      await tx.guide.update({ where: { id: guideId }, data: { currentVersionId: versionId } });
    });

    return this.byIdForAuthor(guideId, userId);
  }

  /** PATCH /guides/:id — brouillon, ou édition directe par l'auteur (§2.7). */
  async update(userId: string, guideId: string, patch: UpdateGuide) {
    const guide = await this.loadOwned(guideId, userId);
    const isDraft = guide.status === 'DRAFT' || guide.status === 'UNPUBLISHED';

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
      patch.body !== undefined && patch.body !== (guide.currentVersion?.body ?? null);

    await this.prisma.$transaction(async (tx) => {
      const data: Prisma.GuideUpdateInput = {};
      if (patch.title !== undefined && isDraft) {
        data.title = patch.title;
        // Le brouillon n'a pas d'adresse publique : son slug peut encore suivre
        // le titre. Il se figera à la publication.
        if (guide.status === 'DRAFT') data.slug = await this.freeSlug(tx, patch.title, guideId);
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
        if (guide.status === 'DRAFT' && guide.currentVersionId !== null) {
          // Brouillon : la version 1 est modifiée SUR PLACE. L'historique
          // public commence à la publication ; garder une version par
          // enregistrement automatique n'apprendrait rien à personne.
          await tx.guideVersion.update({
            where: { id: guide.currentVersionId },
            data: { body: patch.body },
          });
        } else {
          const version = await this.appendVersion(tx, {
            guideId,
            body: patch.body,
            createdByUserId: userId,
            summary: 'Mise à jour par l’auteur',
          });
          data.currentVersion = { connect: { id: version.id } };
          // §2.3 : une mise à jour du contenu rafraîchit le guide et le fait
          // remonter au classement.
          data.lastContentUpdateAt = now;
          data.freshnessScore = computeFreshnessScore(guide.helpfulCount, now, now);
          await this.outbox.emit(tx, {
            type: 'guide.version_created',
            aggregateId: guideId,
            payload: { guideId, versionId: version.id, version: version.version, by: userId },
          });
        }
      }

      if (Object.keys(data).length > 0) {
        await tx.guide.update({ where: { id: guideId }, data });
      }
    });

    return this.byIdForAuthor(guideId, userId);
  }

  /** POST /guides/:id/publish — §2.1. */
  async publish(userId: string, guideId: string) {
    const guide = await this.loadOwned(guideId, userId);
    if (guide.status === 'PUBLISHED' || guide.status === 'FLAGGED') {
      throw ApiError.transverse('CONFLICT', { reason: 'ALREADY_PUBLISHED' });
    }
    if (guide.status === 'ARCHIVED') throw ApiError.transverse('CONFLICT', { reason: 'ARCHIVED' });

    const body = guide.currentVersion?.body ?? '';
    // Les 300 caractères du §2.1 sont exigés ICI, pas au brouillon : l'éditeur
    // enregistre en continu, et bloquer un texte en cours d'écriture le perdrait.
    const parsed = guidePublishableBodySchema.safeParse(body);
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
      select: { id: true, version: true, body: true },
    });
    if (source === null) throw ApiError.notFound();
    if (guide.currentVersionId === source.id) {
      throw ApiError.transverse('CONFLICT', { reason: 'ALREADY_CURRENT' });
    }

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const version = await this.appendVersion(tx, {
        guideId,
        body: source.body,
        createdByUserId: userId,
        // `revert_of_version_id` n'existe pas dans le schéma figé : le résumé
        // porte la trace, faute de colonne.
        summary: `Retour à la version ${source.version}`,
      });
      await tx.guide.update({
        where: { id: guideId },
        data: {
          currentVersionId: version.id,
          lastContentUpdateAt: now,
          freshnessScore: computeFreshnessScore(guide.helpfulCount, now, now),
        },
      });
      await this.outbox.emit(tx, {
        type: 'guide.version_created',
        aggregateId: guideId,
        payload: {
          guideId,
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

  // ════════════════════════════════════════════════════════════════════════
  // Propositions de mise à jour (§2.4)
  // ════════════════════════════════════════════════════════════════════════

  /** POST /guides/:id/proposals. */
  async createProposal(userId: string, guideId: string, input: CreateProposal) {
    const guide = await this.loadVotable(guideId, userId);
    if (guide.currentVersionId === null || guide.currentVersion === null) {
      throw ApiError.notFound();
    }

    const pending = await this.prisma.guideRevisionProposal.count({
      where: { guideId, proposerUserId: userId, status: 'PENDING' },
    });
    if (pending >= GUIDE_PENDING_PROPOSAL_LIMIT) {
      this.fail('PROPOSAL_LIMIT', { limit: GUIDE_PENDING_PROPOSAL_LIMIT, current: pending });
    }

    // §2.4 : le passage doit exister EXACTEMENT UNE FOIS dans le corps de la
    // version de base. Zéro fois : le texte a changé. Plusieurs fois : le
    // remplacement serait ambigu, et appliquer « la première occurrence »
    // corrigerait un passage que le proposant n'a pas lu.
    this.assertExcerptUnique(guide.currentVersion.body, input.targetExcerpt);

    const proposalId = newId();
    const now = new Date();
    // Capturé hors de la transaction : le rétrécissement de type obtenu plus
    // haut ne survit pas à l'entrée dans la fermeture asynchrone.
    const baseVersionId = guide.currentVersionId;
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
            currentVersion: { select: { id: true, body: true } },
          },
        },
      },
    });
    if (proposal === null) throw ApiError.notFound();
    // 403 NOT_AUTHOR, et non 404 : le guide est public, la proposition aussi
    // dès qu'elle est acceptée. C'est §4 qui nomme ce code.
    if (proposal.guide.authorUserId !== userId) this.fail('NOT_AUTHOR');
    if (proposal.status !== 'PENDING') this.fail('ALREADY_DECIDED', { status: proposal.status });

    const now = new Date();

    if (decision.kind === 'REJECT') {
      await this.prisma.$transaction(async (tx) => {
        await tx.guideRevisionProposal.update({
          where: { id: proposalId },
          data: {
            status: 'REJECTED',
            reviewerUserId: userId,
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

    const currentBody = proposal.guide.currentVersion?.body ?? '';
    // Le passage est revérifié sur la version COURANTE, et pas seulement sur la
    // version de base : entre la proposition et la décision, une autre
    // proposition a pu être acceptée. Appliquer un remplacement calculé sur un
    // texte disparu écrirait n'importe quoi dans le guide.
    this.assertExcerptUnique(currentBody, proposal.targetExcerpt);

    const replacement = decision.kind === 'AMEND' ? decision.replacement : proposal.replacement;
    const body = currentBody.replace(proposal.targetExcerpt, replacement);
    const status = decision.kind === 'AMEND' ? 'AMENDED' : 'ACCEPTED';

    await this.prisma.$transaction(async (tx) => {
      const version = await this.appendVersion(tx, {
        guideId: proposal.guideId,
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

      await tx.guideRevisionProposal.update({
        where: { id: proposalId },
        data: { status, reviewerUserId: userId, decidedAt: now },
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

      await tx.guide.update({
        where: { id: proposal.guideId },
        data: {
          currentVersionId: version.id,
          // §2.3 : « Une proposition acceptée remet last_content_update_at à
          // jour et fait remonter le guide. »
          lastContentUpdateAt: now,
          freshnessScore: computeFreshnessScore(proposal.guide.helpfulCount, now, now),
          ...(wasFlagged
            ? { status: 'PUBLISHED', outdatedFlagCount: 0, unpublishDeadlineAt: null }
            : {}),
        },
      });

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
  // Conversion depuis un parcours (§2.8)
  // ════════════════════════════════════════════════════════════════════════

  /**
   * POST /journeys/:id/to-guide — pré-remplit un BROUILLON.
   *
   * « Le membre rédige. Rien n'est publié sans son action. » Cette route ne
   * publie donc rien : elle crée un brouillon avec une section par étape
   * franchie, et s'arrête là.
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

    const sections = journey.steps.map((step) => {
      const lines = [`## ${step.title}`];
      if (step.durationDays !== null) {
        lines.push(`*Durée réelle : ${step.durationDays} jour${step.durationDays > 1 ? 's' : ''}.*`);
      }
      const help = helpByStep.get(step.id) ?? 0;
      if (help > 0) {
        lines.push(`*Aide reçue de la communauté : ${help} fois.*`);
      }
      lines.push('Racontez ici comment vous avez franchi cette étape.');
      return lines.join('\n\n');
    });

    const body = [
      `Ce guide part de mon parcours « ${templateName} ».`,
      ...sections,
      '## Ce que je ferais différemment',
      'Complétez cette section avant de publier.',
    ].join('\n\n');

    return this.createDraft(userId, {
      title,
      body,
      category: this.categoryFromSteps(journey.steps),
      scope: 'COUNTRY',
      originCountryId: journey.originCountryId,
      cityId: journey.destinationCityId,
    });
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
        // Jamais vu OU vu avant le seuil. `lastSeenAt: null` est le cas d'un
        // compte créé puis abandonné : l'omettre laisserait ses guides sans
        // personne pour les tenir.
        OR: [{ lastSeenAt: null }, { lastSeenAt: { lt: threshold } }],
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

  private assertExcerptUnique(body: string, excerpt: string): void {
    let occurrences = 0;
    let from = 0;
    for (;;) {
      const at = body.indexOf(excerpt, from);
      if (at === -1) break;
      occurrences += 1;
      if (occurrences > 1) break;
      from = at + excerpt.length;
    }
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

  /** Version suivante. La table est en AJOUT SEUL : on n'écrase jamais. */
  private async appendVersion(
    tx: Prisma.TransactionClient,
    input: {
      guideId: string;
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

  /** Le guide, s'il appartient au demandeur. 404 sinon : un brouillon ne se devine pas. */
  private async loadOwned(guideId: string, userId: string) {
    const guide = await this.prisma.guide.findUnique({
      where: { id: guideId },
      include: { currentVersion: { select: { id: true, body: true } } },
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
      include: { currentVersion: { select: { id: true, body: true } } },
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

  private async byIdForAuthor(guideId: string, userId: string) {
    const guide = await this.prisma.guide.findUniqueOrThrow({
      where: { id: guideId },
      include: {
        ...LIST_INCLUDE,
        currentVersion: { select: { id: true, version: true, body: true, summary: true } },
      },
    });
    return {
      ...this.toListItem(guide, new Date()),
      originCountryId: guide.originCountryId,
      outdatedFlagCount: guide.outdatedFlagCount,
      unpublishDeadlineAt: guide.unpublishDeadlineAt,
      isAuthor: guide.authorUserId === userId,
      currentVersion: guide.currentVersion,
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
