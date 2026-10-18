import { Injectable } from '@nestjs/common';
import type { Prisma } from '@app/db';
import {
  ADMIN_CONTENT_AUDIT_ACTIONS as ACTIONS,
  ADMIN_CONTENT_ERROR_CODES,
  ADMIN_CONTENT_ERROR_MESSAGES,
  type AdminGuideMaintained,
  type AdminGuideRevert,
  type AdminGuideStatus,
  type AdminGuidesQuery,
  type AdminProposalDecision,
  type Page,
} from '@app/shared';
import { ApiError } from '../../common/api-error';
import { AuditService } from '../../common/audit.service';
import { buildPage, decodeCursor } from '../../common/cursor';
import { OutboxService } from '../../common/outbox.service';
import { PrismaService } from '../../common/prisma.service';
import type { StaffUser } from '../../common/staff.guard';
import { loadEnv } from '../../config/env';
import { GuidesService } from '../guides/guides.service';

/**
 * Guides, côté équipe — 05 §4 : « `/v1/admin/guides` (liste par statut, forcer
 * FLAGGED/UNPUBLISHED/PUBLISHED, traiter les propositions escaladées, retour arrière,
 * basculer « maintenu par la communauté »). »
 *
 * AUCUNE RÉDACTION INTERNE (05 §1) : l'équipe modère, elle n'écrit pas. Le retour
 * arrière réécrit donc le corps d'une version DÉJÀ publiée — il n'invente aucun texte —
 * et il est exécuté au nom de l'auteur (`GuidesService.revert` exige le propriétaire),
 * avec la trace d'audit de l'équipe en plus. Un guide sans auteur (compte supprimé)
 * ne peut pas être ramené en arrière : 409.
 */
@Injectable()
export class AdminGuidesService {
  private readonly cursorSecret = loadEnv().CURSOR_SECRET;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
    private readonly guides: GuidesService,
  ) {}

  private async record(tx: Prisma.TransactionClient, staff: StaffUser, action: string, targetId: string, metadata: Prisma.InputJsonValue) {
    await this.audit.record(tx, {
      actor: { type: 'STAFF', id: staff.staffId },
      action,
      targetType: 'guide',
      targetId,
      metadata,
      ...(staff.ip === null ? {} : { ip: staff.ip }),
    });
  }

  async list(query: AdminGuidesQuery): Promise<Page<unknown>> {
    const scope = `admin:guides:${query.status ?? ''}:${query.view}`;
    const where: Prisma.GuideWhereInput = {
      deletedAt: null,
      ...(query.view === 'flagged' ? { status: 'FLAGGED' } : query.status === undefined ? {} : { status: query.status }),
      ...(query.cursor === undefined ? {} : { id: { lt: decodeCursor(query.cursor, this.cursorSecret, scope).id } }),
    };
    const rows = await this.prisma.guide.findMany({
      where,
      orderBy: { id: 'desc' },
      take: query.limit + 1,
      select: {
        id: true,
        slug: true,
        title: true,
        status: true,
        maintainedByCommunity: true,
        outdatedFlagCount: true,
        unpublishDeadlineAt: true,
        helpfulCount: true,
        lastContentUpdateAt: true,
        authorUserId: true,
      },
    });
    const now = Date.now();
    return buildPage(
      rows.map((g) => ({
        id: g.id,
        slug: g.slug,
        title: g.title,
        status: g.status,
        maintainedByCommunity: g.maintainedByCommunity,
        outdatedFlagCount: g.outdatedFlagCount,
        unpublishInDays:
          g.unpublishDeadlineAt === null ? null : Math.max(0, Math.ceil((g.unpublishDeadlineAt.getTime() - now) / 86_400_000)),
        helpfulCount: g.helpfulCount,
        lastContentUpdateAt: g.lastContentUpdateAt.toISOString(),
        hasAuthor: g.authorUserId !== null,
      })),
      query.limit,
      scope,
      this.cursorSecret,
    );
  }

  /** Les compteurs des onglets de D09. */
  async counts() {
    const [escalated, flagged, all] = await Promise.all([
      this.prisma.guideRevisionProposal.count({ where: { status: 'ESCALATED' } }),
      this.prisma.guide.count({ where: { status: 'FLAGGED', deletedAt: null } }),
      this.prisma.guide.count({ where: { deletedAt: null } }),
    ]);
    return { escalated, flagged, all };
  }

  /** Les propositions escaladées, avec l'avant/après que D09 dessine. */
  async escalatedProposals() {
    const rows = await this.prisma.guideRevisionProposal.findMany({
      where: { status: 'ESCALATED' },
      orderBy: { escalateAt: 'asc' },
      take: 50,
      select: {
        id: true,
        targetExcerpt: true,
        replacement: true,
        reason: true,
        escalateAt: true,
        guide: { select: { id: true, title: true, maintainedByCommunity: true } },
      },
    });
    const now = Date.now();
    return {
      items: rows.map((p) => ({
        id: p.id,
        guideId: p.guide.id,
        guideTitle: p.guide.title,
        maintainedByCommunity: p.guide.maintainedByCommunity,
        before: p.targetExcerpt,
        after: p.replacement,
        reason: p.reason,
        daysOverdue: Math.max(0, Math.floor((now - p.escalateAt.getTime()) / 86_400_000)),
      })),
    };
  }

  async decideProposal(staff: StaffUser, proposalId: string, input: AdminProposalDecision) {
    const proposal = await this.prisma.guideRevisionProposal.findUnique({
      where: { id: proposalId },
      select: { id: true, status: true, guideId: true },
    });
    if (proposal === null) throw ApiError.notFound();
    if (proposal.status !== 'ESCALATED') {
      throw new ApiError('GUIDE_NOT_ESCALATED', ADMIN_CONTENT_ERROR_MESSAGES.GUIDE_NOT_ESCALATED, ADMIN_CONTENT_ERROR_CODES.GUIDE_NOT_ESCALATED);
    }
    const decision = input.decision === 'ACCEPT' ? ({ kind: 'ACCEPT' } as const) : ({ kind: 'REJECT', reason: input.reason } as const);
    const result = await this.guides.decideProposal('', proposalId, decision, staff.staffId);
    await this.prisma.$transaction(async (tx) => {
      await this.record(tx, staff, ACTIONS.guideProposalDecided, proposal.guideId, {
        proposalId,
        decision: input.decision,
        ...(input.decision === 'REJECT' ? { reason: input.reason } : {}),
      });
    });
    return result;
  }

  /** Forcer FLAGGED / UNPUBLISHED / PUBLISHED, avec motif. */
  async forceStatus(staff: StaffUser, guideId: string, input: AdminGuideStatus) {
    const guide = await this.prisma.guide.findUnique({
      where: { id: guideId },
      select: { id: true, slug: true, status: true, deletedAt: true, currentVersionId: true },
    });
    if (guide === null || guide.deletedAt !== null) throw ApiError.notFound();
    if (guide.status === input.status) throw ApiError.transverse('CONFLICT', { status: guide.status });
    if (input.status === 'PUBLISHED' && guide.currentVersionId === null) {
      throw ApiError.transverse('CONFLICT', { reason: 'NO_VERSION' });
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.guide.update({
        where: { id: guideId },
        data: {
          status: input.status,
          ...(input.status === 'PUBLISHED' ? { outdatedFlagCount: 0, unpublishDeadlineAt: null } : {}),
          ...(input.status === 'FLAGGED' ? { unpublishDeadlineAt: new Date(Date.now() + 30 * 86_400_000) } : {}),
          ...(input.status === 'UNPUBLISHED' ? { unpublishDeadlineAt: null } : {}),
        },
      });
      if (input.status === 'PUBLISHED') await tx.guideOutdatedFlag.deleteMany({ where: { guideId } });
      await this.record(tx, staff, ACTIONS.guideStatusForced, guideId, {
        before: guide.status,
        after: input.status,
        reason: input.reason,
      });
      await this.outbox.emit(tx, {
        type: input.status === 'PUBLISHED' ? 'guide.restored' : input.status === 'FLAGGED' ? 'guide.flagged' : 'guide.unpublished',
        aggregateId: guideId,
        payload: { guideId, slug: guide.slug, reason: 'STAFF' },
      });
    });
    return { id: guideId, status: input.status };
  }

  async revert(staff: StaffUser, guideId: string, input: AdminGuideRevert) {
    const guide = await this.prisma.guide.findUnique({ where: { id: guideId }, select: { authorUserId: true, deletedAt: true } });
    if (guide === null || guide.deletedAt !== null) throw ApiError.notFound();
    if (guide.authorUserId === null) throw ApiError.transverse('CONFLICT', { reason: 'NO_AUTHOR' });
    await this.guides.revert(guide.authorUserId, guideId, input.versionId);
    await this.prisma.$transaction(async (tx) => {
      await this.record(tx, staff, ACTIONS.guideReverted, guideId, { versionId: input.versionId, reason: input.reason });
    });
    return { id: guideId, reverted: true };
  }

  async setMaintained(staff: StaffUser, guideId: string, input: AdminGuideMaintained) {
    const guide = await this.prisma.guide.findUnique({ where: { id: guideId }, select: { id: true, maintainedByCommunity: true, deletedAt: true } });
    if (guide === null || guide.deletedAt !== null) throw ApiError.notFound();
    await this.prisma.$transaction(async (tx) => {
      await tx.guide.update({ where: { id: guideId }, data: { maintainedByCommunity: input.maintainedByCommunity } });
      await this.record(tx, staff, ACTIONS.guideMaintainedToggled, guideId, {
        before: guide.maintainedByCommunity,
        after: input.maintainedByCommunity,
      });
    });
    return { id: guideId, maintainedByCommunity: input.maintainedByCommunity };
  }

  /** Les versions d'un guide, pour choisir un retour arrière. */
  async versions(guideId: string) {
    const rows = await this.prisma.guideVersion.findMany({
      where: { guideId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, version: true, summary: true, createdAt: true },
    });
    return { items: rows.map((v) => ({ id: v.id, version: v.version, summary: v.summary, createdAt: v.createdAt.toISOString() })) };
  }
}
