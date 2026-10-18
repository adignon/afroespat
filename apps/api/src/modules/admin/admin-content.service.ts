import { Injectable } from '@nestjs/common';
import { newId, type Prisma } from '@app/db';
import {
  ADMIN_CONTENT_AUDIT_ACTIONS as ACTIONS,
  ADMIN_CONTENT_ERROR_CODES,
  ADMIN_CONTENT_ERROR_MESSAGES,
  type AdminContentErrorCode,
  type AnnouncementListQuery,
  type AnnouncementWrite,
  type Audience,
  CONSENT_PAGE_SLUGS,
  type FlagUpdate,
  type FlagWrite,
  type Page,
  type PageCreate,
  type PageDraft,
} from '@app/shared';
import { ApiError } from '../../common/api-error';
import { AuditService } from '../../common/audit.service';
import { buildPage, decodeCursor } from '../../common/cursor';
import { FeatureFlagService } from '../../common/feature-flag.service';
import { PrismaService } from '../../common/prisma.service';
import type { StaffUser } from '../../common/staff.guard';
import { loadEnv } from '../../config/env';

/**
 * Contenu de l'administration — 15-administration.md §4.1 (pages), §4.2
 * (annonces), §4.3 (drapeaux).
 *
 * RÈGLE DURE (§2.3) : chaque écriture est un `$transaction` qui contient l'écriture
 * ET sa trace d'audit. Même discipline que `AdminService`.
 *
 * ── LES PAGES SONT VERSIONNÉES, ET `static_pages` NE PORTE QUE LA VERSION EN VIGUEUR ──
 *
 * `static_pages` est ce que lisent les membres (`GET /pages/:slug`) et ce que
 * `consents.version` référence. L'historique et le brouillon vivent dans
 * `static_page_versions`. Publier le brouillon N copie son titre et son corps dans
 * `static_pages` et y pose `version = String(N)` : pour `cgu` et `confidentialite`,
 * c'est ce changement de version qui fait calculer `outdated` par
 * `ConsentsService.current` — la redemande du consentement n'est pas un événement
 * qu'on envoie, c'est une COMPARAISON que le prochain chargement fait.
 *
 * Aucun événement `page.published` n'est écrit dans la boîte d'envoi : §9 lui donne
 * pour consommateurs « users » (la comparaison ci-dessus) et « search » (qui n'indexe
 * pas les pages). Un type sans consommateur ferait croire la chaîne branchée — la
 * règle que `outbox.service.ts` s'impose à lui-même.
 */

function fail(code: AdminContentErrorCode, details?: Record<string, unknown>): never {
  throw new ApiError(code, ADMIN_CONTENT_ERROR_MESSAGES[code], ADMIN_CONTENT_ERROR_CODES[code], details);
}

@Injectable()
export class AdminContentService {
  private readonly cursorSecret = loadEnv().CURSOR_SECRET;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly flags: FeatureFlagService,
  ) {}

  private async record(
    tx: Prisma.TransactionClient,
    staff: StaffUser,
    entry: { action: string; targetType: string; targetId?: string; metadata?: Prisma.InputJsonValue },
  ): Promise<void> {
    await this.audit.record(tx, {
      actor: { type: 'STAFF', id: staff.staffId },
      action: entry.action,
      targetType: entry.targetType,
      ...(entry.targetId === undefined ? {} : { targetId: entry.targetId }),
      ...(entry.metadata === undefined ? {} : { metadata: entry.metadata }),
      ...(staff.ip === null ? {} : { ip: staff.ip }),
    });
  }

  // ════════════════════════════════════════════════════════════════════════
  // §4.1 — Pages statiques
  // ════════════════════════════════════════════════════════════════════════

  /** La page EN VIGUEUR, telle que la lisent les membres. `null` si absente ou jamais publiée. */
  async publicPage(slug: string) {
    const page = await this.prisma.staticPage.findUnique({
      where: { slug },
      select: { slug: true, title: true, body: true, version: true, publishedAt: true },
    });
    if (page === null || page.publishedAt === null) throw ApiError.notFound();
    return {
      slug: page.slug,
      title: page.title,
      body: page.body,
      version: page.version,
      publishedAt: page.publishedAt.toISOString(),
    };
  }

  private pageView(
    page: {
      id: string;
      slug: string;
      title: string;
      body: string;
      version: string;
      publishedAt: Date | null;
      updatedAt: Date;
      versions: { id: string; version: number; title: string; body: string; changelog: string | null; publishedAt: Date | null; createdAt: Date }[];
    },
    withBodies: boolean,
  ) {
    const draft = page.versions.find((v) => v.publishedAt === null) ?? null;
    return {
      id: page.id,
      slug: page.slug,
      title: page.title,
      /** La version EN VIGUEUR, ou `null` tant que la page n'a jamais été publiée. */
      liveVersion: page.publishedAt === null ? null : page.version,
      publishedAt: page.publishedAt?.toISOString() ?? null,
      updatedAt: page.updatedAt.toISOString(),
      /** Une page dont une nouvelle version redemande le consentement. */
      asksConsent: (CONSENT_PAGE_SLUGS as readonly string[]).includes(page.slug),
      draft:
        draft === null
          ? null
          : {
              id: draft.id,
              version: draft.version,
              title: draft.title,
              changelog: draft.changelog,
              updatedAt: draft.createdAt.toISOString(),
              ...(withBodies ? { body: draft.body } : {}),
            },
      versions: page.versions
        .filter((v) => v.publishedAt !== null)
        .map((v) => ({
          id: v.id,
          version: v.version,
          title: v.title,
          changelog: v.changelog,
          publishedAt: (v.publishedAt as Date).toISOString(),
          ...(withBodies ? { body: v.body } : {}),
        })),
      ...(withBodies ? { body: page.body } : {}),
    };
  }

  async listPages() {
    const pages = await this.prisma.staticPage.findMany({
      orderBy: { slug: 'asc' },
      include: { versions: { orderBy: { version: 'desc' } } },
    });
    return { items: pages.map((p) => this.pageView(p, false)) };
  }

  async getPage(id: string) {
    const page = await this.prisma.staticPage.findUnique({
      where: { id },
      include: { versions: { orderBy: { version: 'desc' } } },
    });
    if (page === null) throw ApiError.notFound();
    return this.pageView(page, true);
  }

  async createPage(staff: StaffUser, input: PageCreate) {
    const taken = await this.prisma.staticPage.findUnique({ where: { slug: input.slug }, select: { id: true } });
    if (taken !== null) fail('PAGE_SLUG_TAKEN');
    const id = newId();
    await this.prisma.$transaction(async (tx) => {
      await tx.staticPage.create({
        data: {
          id,
          slug: input.slug,
          title: input.title,
          body: input.body,
          version: '0',
          publishedAt: null,
          updatedByStaffId: staff.staffId,
        },
      });
      await tx.staticPageVersion.create({
        data: {
          id: newId(),
          pageId: id,
          version: 1,
          title: input.title,
          body: input.body,
          changelog: input.changelog ?? null,
          createdByStaffId: staff.staffId,
        },
      });
      await this.record(tx, staff, {
        action: ACTIONS.pageCreated,
        targetType: 'static_page',
        targetId: id,
        metadata: { slug: input.slug },
      });
    });
    return this.getPage(id);
  }

  /** Enregistre le BROUILLON : met à jour celui qui existe, ou en ouvre un nouveau. */
  async saveDraft(staff: StaffUser, id: string, input: PageDraft) {
    const page = await this.prisma.staticPage.findUnique({
      where: { id },
      select: { id: true, slug: true, versions: { select: { id: true, version: true, publishedAt: true } } },
    });
    if (page === null) throw ApiError.notFound();
    const draft = page.versions.find((v) => v.publishedAt === null) ?? null;
    const next = Math.max(0, ...page.versions.map((v) => v.version)) + 1;

    await this.prisma.$transaction(async (tx) => {
      if (draft === null) {
        await tx.staticPageVersion.create({
          data: {
            id: newId(),
            pageId: id,
            version: next,
            title: input.title,
            body: input.body,
            changelog: input.changelog ?? null,
            createdByStaffId: staff.staffId,
          },
        });
      } else {
        await tx.staticPageVersion.update({
          where: { id: draft.id },
          data: { title: input.title, body: input.body, changelog: input.changelog ?? null },
        });
      }
      await this.record(tx, staff, {
        action: ACTIONS.pageDrafted,
        targetType: 'static_page',
        targetId: id,
        metadata: { slug: page.slug, version: draft?.version ?? next },
      });
    });
    return this.getPage(id);
  }

  /**
   * Publie le brouillon : il devient la version en vigueur.
   *
   * Pour `cgu` et `confidentialite`, c'est ici que « une nouvelle version redemande le
   * consentement » (15 §4.1) : la version de `static_pages` change, et
   * `ConsentsService.current` calcule `outdated` pour tout membre qui avait accepté
   * la précédente.
   */
  async publishPage(staff: StaffUser, id: string) {
    const page = await this.prisma.staticPage.findUnique({
      where: { id },
      select: { id: true, slug: true, version: true, versions: { where: { publishedAt: null }, take: 1 } },
    });
    if (page === null) throw ApiError.notFound();
    const draft = page.versions[0];
    if (draft === undefined) fail('PAGE_NO_DRAFT');

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.staticPageVersion.update({ where: { id: draft.id }, data: { publishedAt: now } });
      await tx.staticPage.update({
        where: { id },
        data: {
          title: draft.title,
          body: draft.body,
          version: String(draft.version),
          publishedAt: now,
          updatedByStaffId: staff.staffId,
        },
      });
      await this.record(tx, staff, {
        action: ACTIONS.pagePublished,
        targetType: 'static_page',
        targetId: id,
        metadata: {
          slug: page.slug,
          before: page.version,
          after: String(draft.version),
          asksConsent: (CONSENT_PAGE_SLUGS as readonly string[]).includes(page.slug),
        },
      });
    });
    return this.getPage(id);
  }

  /** Une page jamais publiée se supprime ; une page publiée jamais (des consentements la citent). */
  async deletePage(staff: StaffUser, id: string) {
    const page = await this.prisma.staticPage.findUnique({
      where: { id },
      select: { id: true, slug: true, publishedAt: true },
    });
    if (page === null) throw ApiError.notFound();
    if (page.publishedAt !== null || (CONSENT_PAGE_SLUGS as readonly string[]).includes(page.slug)) {
      fail('PAGE_NOT_DELETABLE');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.staticPage.delete({ where: { id } });
      await this.record(tx, staff, {
        action: ACTIONS.pageDeleted,
        targetType: 'static_page',
        targetId: id,
        metadata: { slug: page.slug },
      });
    });
    return { deleted: true };
  }

  // ════════════════════════════════════════════════════════════════════════
  // §4.2 — Annonces
  // ════════════════════════════════════════════════════════════════════════

  private announcementView(a: {
    id: string;
    title: string;
    body: string;
    target: Prisma.JsonValue;
    startsAt: Date;
    endsAt: Date | null;
    createdAt: Date;
  }) {
    const now = Date.now();
    const state =
      a.startsAt.getTime() > now ? 'upcoming' : a.endsAt !== null && a.endsAt.getTime() <= now ? 'ended' : 'active';
    return {
      id: a.id,
      title: a.title,
      body: a.body,
      target: (a.target as Audience | null) ?? null,
      startsAt: a.startsAt.toISOString(),
      endsAt: a.endsAt?.toISOString() ?? null,
      createdAt: a.createdAt.toISOString(),
      state,
    };
  }

  async listAnnouncements(query: AnnouncementListQuery): Promise<Page<unknown>> {
    const now = new Date();
    const stateWhere: Prisma.AnnouncementWhereInput =
      query.state === 'active'
        ? { startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gt: now } }] }
        : query.state === 'upcoming'
          ? { startsAt: { gt: now } }
          : query.state === 'ended'
            ? { endsAt: { lte: now } }
            : {};
    const scope = `admin:announcements:${query.state}`;
    const where: Prisma.AnnouncementWhereInput =
      query.cursor === undefined
        ? stateWhere
        : { AND: [stateWhere, { id: { lt: decodeCursor(query.cursor, this.cursorSecret, scope).id } }] };
    const rows = await this.prisma.announcement.findMany({
      where,
      orderBy: { id: 'desc' },
      take: query.limit + 1,
    });
    return buildPage(
      rows.map((r) => this.announcementView(r)),
      query.limit,
      scope,
      this.cursorSecret,
    );
  }

  async createAnnouncement(staff: StaffUser, input: AnnouncementWrite) {
    const id = newId();
    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.announcement.create({
        data: {
          id,
          title: input.title,
          body: input.body,
          ...(input.target === null || input.target === undefined ? {} : { target: input.target }),
          startsAt: input.startsAt,
          endsAt: input.endsAt ?? null,
          createdByStaffId: staff.staffId,
        },
      });
      await this.record(tx, staff, {
        action: ACTIONS.announcementCreated,
        targetType: 'announcement',
        targetId: id,
        metadata: { title: input.title },
      });
      return created;
    });
    return this.announcementView(row);
  }

  async updateAnnouncement(staff: StaffUser, id: string, input: AnnouncementWrite) {
    const before = await this.prisma.announcement.findUnique({ where: { id } });
    if (before === null) throw ApiError.notFound();
    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.announcement.update({
        where: { id },
        data: {
          title: input.title,
          body: input.body,
          target: input.target === null || input.target === undefined ? ({ set: null } as never) : input.target,
          startsAt: input.startsAt,
          endsAt: input.endsAt ?? null,
        },
      });
      await this.record(tx, staff, {
        action: ACTIONS.announcementUpdated,
        targetType: 'announcement',
        targetId: id,
        metadata: { before: { title: before.title }, after: { title: input.title } },
      });
      return updated;
    });
    return this.announcementView(row);
  }

  async deleteAnnouncement(staff: StaffUser, id: string) {
    const before = await this.prisma.announcement.findUnique({ where: { id }, select: { id: true, title: true } });
    if (before === null) throw ApiError.notFound();
    await this.prisma.$transaction(async (tx) => {
      await tx.announcement.delete({ where: { id } });
      await this.record(tx, staff, {
        action: ACTIONS.announcementDeleted,
        targetType: 'announcement',
        targetId: id,
        metadata: { title: before.title },
      });
    });
    return { deleted: true };
  }

  /**
   * §4.2 : « 1 active par membre à la fois (la plus récente ciblée) ».
   *
   * Le ciblage est évalué ICI, côté serveur — le front reçoit l'annonce ou rien. La
   * fermeture par le membre est mémorisée côté client (§4.2), donc rien à stocker.
   */
  async activeFor(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { cityId: true, originCountryId: true, phase: true, plan: true },
    });
    if (user === null) return { announcement: null };
    const now = new Date();
    const candidates = await this.prisma.announcement.findMany({
      where: { startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
      orderBy: [{ startsAt: 'desc' }, { id: 'desc' }],
      take: 50,
    });
    const allowed = (list: readonly string[] | undefined, value: string | null): boolean =>
      list === undefined || list.length === 0 || (value !== null && list.includes(value));
    for (const a of candidates) {
      const t = (a.target as Audience | null) ?? {};
      if (
        allowed(t.cityIds, user.cityId) &&
        allowed(t.countryIds, user.originCountryId) &&
        allowed(t.phases, user.phase) &&
        allowed(t.plans, user.plan)
      ) {
        return { announcement: { id: a.id, title: a.title, body: a.body, startsAt: a.startsAt.toISOString() } };
      }
    }
    return { announcement: null };
  }

  // ════════════════════════════════════════════════════════════════════════
  // §4.3 — Feature flags
  // ════════════════════════════════════════════════════════════════════════

  private flagView(f: {
    id: string;
    key: string;
    isEnabled: boolean;
    rolloutPct: number;
    conditions: Prisma.JsonValue;
    updatedAt: Date;
  }) {
    return {
      id: f.id,
      key: f.key,
      isEnabled: f.isEnabled,
      rolloutPct: f.rolloutPct,
      conditions: (f.conditions as Audience | null) ?? null,
      updatedAt: f.updatedAt.toISOString(),
    };
  }

  async listFlags() {
    const rows = await this.prisma.featureFlag.findMany({ orderBy: { key: 'asc' } });
    return { items: rows.map((r) => this.flagView(r)) };
  }

  async createFlag(staff: StaffUser, input: FlagWrite) {
    const taken = await this.prisma.featureFlag.findUnique({ where: { key: input.key }, select: { id: true } });
    if (taken !== null) fail('FLAG_KEY_TAKEN');
    const id = newId();
    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.featureFlag.create({
        data: {
          id,
          key: input.key,
          isEnabled: input.isEnabled,
          rolloutPct: input.rolloutPct,
          ...(input.conditions === null || input.conditions === undefined ? {} : { conditions: input.conditions }),
        },
      });
      await this.record(tx, staff, {
        action: ACTIONS.flagCreated,
        targetType: 'feature_flag',
        targetId: id,
        metadata: { key: input.key, isEnabled: input.isEnabled, rolloutPct: input.rolloutPct },
      });
      return created;
    });
    this.flags.invalidate();
    return this.flagView(row);
  }

  async updateFlag(staff: StaffUser, id: string, input: FlagUpdate) {
    const before = await this.prisma.featureFlag.findUnique({ where: { id } });
    if (before === null) throw ApiError.notFound();
    const changes: Record<string, Prisma.InputJsonValue> = {};
    if (input.isEnabled !== undefined && input.isEnabled !== before.isEnabled) {
      changes['isEnabled'] = { from: before.isEnabled, to: input.isEnabled };
    }
    if (input.rolloutPct !== undefined && input.rolloutPct !== before.rolloutPct) {
      changes['rolloutPct'] = { from: before.rolloutPct, to: input.rolloutPct };
    }
    if (input.conditions !== undefined) changes['conditions'] = { to: (input.conditions ?? null) as Prisma.InputJsonValue };

    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.featureFlag.update({
        where: { id },
        data: {
          ...(input.isEnabled === undefined ? {} : { isEnabled: input.isEnabled }),
          ...(input.rolloutPct === undefined ? {} : { rolloutPct: input.rolloutPct }),
          ...(input.conditions === undefined
            ? {}
            : { conditions: input.conditions === null ? ({ set: null } as never) : input.conditions }),
        },
      });
      await this.record(tx, staff, {
        action: ACTIONS.flagChanged,
        targetType: 'feature_flag',
        targetId: id,
        metadata: { key: before.key, changes },
      });
      return updated;
    });
    this.flags.invalidate();
    return this.flagView(row);
  }

  async deleteFlag(staff: StaffUser, id: string) {
    const before = await this.prisma.featureFlag.findUnique({ where: { id }, select: { id: true, key: true } });
    if (before === null) throw ApiError.notFound();
    await this.prisma.$transaction(async (tx) => {
      await tx.featureFlag.delete({ where: { id } });
      await this.record(tx, staff, {
        action: ACTIONS.flagDeleted,
        targetType: 'feature_flag',
        targetId: id,
        metadata: { key: before.key },
      });
    });
    this.flags.invalidate();
    return { deleted: true };
  }
}
