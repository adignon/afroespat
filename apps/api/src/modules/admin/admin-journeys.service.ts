import { Injectable } from '@nestjs/common';
import { newId, type Prisma } from '@app/db';
import {
  ADMIN_CONTENT_AUDIT_ACTIONS as ACTIONS,
  ADMIN_CONTENT_ERROR_CODES,
  ADMIN_CONTENT_ERROR_MESSAGES,
  type AdminContentErrorCode,
  type CorrectionDecision,
  type CorrectionQuery,
  type Page,
  type StepDefinitionUpdate,
  type StepDefinitionWrite,
  type TemplateUpdate,
  type TemplateWrite,
  type VersionCreate,
  type VersionPublish,
  type VersionSteps,
} from '@app/shared';
import { ApiError } from '../../common/api-error';
import { AuditService } from '../../common/audit.service';
import { buildPage, decodeCursor } from '../../common/cursor';
import { PrismaService } from '../../common/prisma.service';
import type { StaffUser } from '../../common/staff.guard';
import { loadEnv } from '../../config/env';

function fail(code: AdminContentErrorCode, details?: Record<string, unknown>): never {
  throw new ApiError(code, ADMIN_CONTENT_ERROR_MESSAGES[code], ADMIN_CONTENT_ERROR_CODES[code], details);
}

/**
 * Un cycle dans les dépendances ? Parcours en profondeur sur l'index des étapes.
 * PURE, exportée pour les tests unitaires.
 */
export function hasDependencyCycle(count: number, deps: readonly { step: number; dependsOn: number }[]): boolean {
  const next = new Map<number, number[]>();
  for (const d of deps) next.set(d.step, [...(next.get(d.step) ?? []), d.dependsOn]);
  const state = new Map<number, 1 | 2>();
  const visit = (n: number): boolean => {
    if (state.get(n) === 2) return false;
    if (state.get(n) === 1) return true;
    state.set(n, 1);
    for (const m of next.get(n) ?? []) if (visit(m)) return true;
    state.set(n, 2);
    return false;
  };
  for (let i = 0; i < count; i += 1) if (visit(i)) return true;
  return false;
}

/**
 * Modèles de parcours côté équipe — 03-parcours.md §5.2 (`/v1/admin/journey-templates/*`).
 *
 * RÈGLE DURE (03 §2.2) : « Publier une version ne modifie jamais un `journey`
 * existant. » Rien ici n'écrit dans `journeys` : la publication archive l'ancienne
 * version, les parcours en cours restent figés dessus, et `GET /admin/stats/migrations`
 * dit combien d'entre eux y sont restés.
 *
 * Le rendu « tel que vu par un membre » (`preview`) est la composition de la version
 * avec le nom, la description et le gabarit de chaque définition, surcharges
 * appliquées.
 *
 * NON LIVRÉ : la notification « la procédure a évolué » aux parcours en cours (§2.2).
 * Elle demande un type de notification et un consommateur d'événement qui n'existent
 * pas ; l'écrire ici en appel direct violerait §3.3. Remonté dans le rapport.
 */
@Injectable()
export class AdminJourneysService {
  private readonly cursorSecret = loadEnv().CURSOR_SECRET;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private async record(
    tx: Prisma.TransactionClient,
    staff: StaffUser,
    action: string,
    targetType: string,
    targetId: string,
    metadata: Prisma.InputJsonValue,
  ) {
    await this.audit.record(tx, {
      actor: { type: 'STAFF', id: staff.staffId },
      action,
      targetType,
      targetId,
      metadata,
      ...(staff.ip === null ? {} : { ip: staff.ip }),
    });
  }

  // ── Types ─────────────────────────────────────────────────────────────────

  async listTemplates() {
    const rows = await this.prisma.journeyTemplate.findMany({
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
      include: {
        versions: {
          orderBy: [{ version: 'desc' }],
          select: {
            id: true,
            version: true,
            status: true,
            originCountryId: true,
            changelog: true,
            publishedAt: true,
            updatedAt: true,
            originCountry: { select: { iso2: true, nameFr: true } },
            _count: { select: { steps: true, journeys: true } },
          },
        },
      },
    });
    return {
      items: rows.map((t) => ({
        id: t.id,
        code: t.code,
        nameFr: t.nameFr,
        description: t.description,
        targetPhase: t.targetPhase,
        icon: t.icon,
        isActive: t.isActive,
        sortOrder: t.sortOrder,
        createsJourney: t.createsJourney,
        versions: t.versions.map((v) => ({
          id: v.id,
          version: v.version,
          status: v.status,
          originCountryId: v.originCountryId,
          originCountry: v.originCountry?.nameFr ?? null,
          changelog: v.changelog,
          publishedAt: v.publishedAt?.toISOString() ?? null,
          updatedAt: v.updatedAt.toISOString(),
          stepCount: v._count.steps,
          journeyCount: v._count.journeys,
        })),
      })),
    };
  }

  async createTemplate(staff: StaffUser, input: TemplateWrite) {
    if ((await this.prisma.journeyTemplate.findUnique({ where: { code: input.code }, select: { id: true } })) !== null) {
      fail('TEMPLATE_CODE_TAKEN');
    }
    const id = newId();
    await this.prisma.$transaction(async (tx) => {
      await tx.journeyTemplate.create({
        data: {
          id,
          code: input.code,
          nameFr: input.nameFr,
          description: input.description ?? null,
          targetPhase: input.targetPhase,
          icon: input.icon ?? null,
          isActive: input.isActive,
          sortOrder: input.sortOrder,
          createsJourney: input.createsJourney,
        },
      });
      await this.record(tx, staff, ACTIONS.templateCreated, 'journey_template', id, { code: input.code });
    });
    return { id };
  }

  async updateTemplate(staff: StaffUser, id: string, input: TemplateUpdate) {
    const before = await this.prisma.journeyTemplate.findUnique({ where: { id } });
    if (before === null) throw ApiError.notFound();
    await this.prisma.$transaction(async (tx) => {
      await tx.journeyTemplate.update({
        where: { id },
        data: {
          ...(input.nameFr === undefined ? {} : { nameFr: input.nameFr }),
          ...(input.description === undefined ? {} : { description: input.description }),
          ...(input.targetPhase === undefined ? {} : { targetPhase: input.targetPhase }),
          ...(input.icon === undefined ? {} : { icon: input.icon }),
          ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
          ...(input.sortOrder === undefined ? {} : { sortOrder: input.sortOrder }),
          ...(input.createsJourney === undefined ? {} : { createsJourney: input.createsJourney }),
        },
      });
      await this.record(tx, staff, ACTIONS.templateUpdated, 'journey_template', id, {
        code: before.code,
        fields: Object.keys(input),
      });
    });
    return { id };
  }

  // ── Bibliothèque d'étapes ─────────────────────────────────────────────────

  async listStepDefinitions(query: { cursor?: string | undefined; limit: number }): Promise<Page<unknown>> {
    const scope = 'admin:step-definitions';
    const rows = await this.prisma.stepDefinition.findMany({
      where: query.cursor === undefined ? {} : { id: { gt: decodeCursor(query.cursor, this.cursorSecret, scope).id } },
      orderBy: { id: 'asc' },
      take: query.limit + 1,
      include: { guide: { select: { id: true, title: true } } },
    });
    const total = await this.prisma.stepDefinition.count();
    const page = buildPage(rows, query.limit, scope, this.cursorSecret);
    return {
      items: page.items.map((s) => ({
        id: s.id,
        code: s.code,
        nameFr: s.nameFr,
        description: s.description,
        category: s.category,
        defaultDurationDays: s.defaultDurationDays,
        guideId: s.guideId,
        guideTitle: s.guide?.title ?? null,
        blockerTarget: s.blockerTarget,
        blockerTemplate: s.blockerTemplate,
        isMajorMilestone: s.isMajorMilestone,
        isRisky: s.isRisky,
        riskMessage: s.riskMessage,
        documentChecklist: s.documentChecklist,
      })),
      nextCursor: page.nextCursor,
      meta: { total },
    };
  }

  async createStepDefinition(staff: StaffUser, input: StepDefinitionWrite) {
    if ((await this.prisma.stepDefinition.findUnique({ where: { code: input.code }, select: { id: true } })) !== null) {
      fail('STEP_CODE_TAKEN');
    }
    const id = newId();
    await this.prisma.$transaction(async (tx) => {
      await tx.stepDefinition.create({
        data: {
          id,
          code: input.code,
          nameFr: input.nameFr,
          description: input.description ?? null,
          category: input.category,
          defaultDurationDays: input.defaultDurationDays ?? null,
          guideId: input.guideId ?? null,
          blockerTarget: input.blockerTarget,
          blockerTemplate: input.blockerTemplate ?? null,
          isMajorMilestone: input.isMajorMilestone,
          isRisky: input.isRisky,
          riskMessage: input.riskMessage ?? null,
          documentChecklist: input.documentChecklist,
        },
      });
      await this.record(tx, staff, ACTIONS.stepDefinitionCreated, 'step_definition', id, { code: input.code });
    });
    return { id };
  }

  async updateStepDefinition(staff: StaffUser, id: string, input: StepDefinitionUpdate) {
    const before = await this.prisma.stepDefinition.findUnique({ where: { id }, select: { code: true } });
    if (before === null) throw ApiError.notFound();
    await this.prisma.$transaction(async (tx) => {
      await tx.stepDefinition.update({
        where: { id },
        data: {
          ...(input.nameFr === undefined ? {} : { nameFr: input.nameFr }),
          ...(input.description === undefined ? {} : { description: input.description }),
          ...(input.category === undefined ? {} : { category: input.category }),
          ...(input.defaultDurationDays === undefined ? {} : { defaultDurationDays: input.defaultDurationDays }),
          ...(input.guideId === undefined ? {} : { guideId: input.guideId }),
          ...(input.blockerTarget === undefined ? {} : { blockerTarget: input.blockerTarget }),
          ...(input.blockerTemplate === undefined ? {} : { blockerTemplate: input.blockerTemplate }),
          ...(input.isMajorMilestone === undefined ? {} : { isMajorMilestone: input.isMajorMilestone }),
          ...(input.isRisky === undefined ? {} : { isRisky: input.isRisky }),
          ...(input.riskMessage === undefined ? {} : { riskMessage: input.riskMessage }),
          ...(input.documentChecklist === undefined ? {} : { documentChecklist: input.documentChecklist }),
        },
      });
      await this.record(tx, staff, ACTIONS.stepDefinitionUpdated, 'step_definition', id, {
        code: before.code,
        fields: Object.keys(input),
      });
    });
    return { id };
  }

  // ── Versions ──────────────────────────────────────────────────────────────

  async createVersion(staff: StaffUser, templateId: string, input: VersionCreate) {
    const template = await this.prisma.journeyTemplate.findUnique({ where: { id: templateId }, select: { id: true, code: true } });
    if (template === null) throw ApiError.notFound();
    const country = input.originCountryId ?? null;

    const open = await this.prisma.journeyTemplateVersion.findFirst({
      where: { templateId, originCountryId: country, status: 'DRAFT' },
      select: { id: true },
    });
    if (open !== null) fail('VERSION_SLOT_TAKEN', { versionId: open.id });

    const max = await this.prisma.journeyTemplateVersion.aggregate({ where: { templateId }, _max: { version: true } });
    const version = (max._max.version ?? 0) + 1;

    const source = input.copyPublished
      ? await this.prisma.journeyTemplateVersion.findFirst({
          where: { templateId, status: 'PUBLISHED', originCountryId: country },
          include: { steps: { orderBy: { position: 'asc' } }, stepDependencies: true },
        })
      : null;

    const id = newId();
    await this.prisma.$transaction(async (tx) => {
      await tx.journeyTemplateVersion.create({
        data: { id, templateId, version, originCountryId: country, status: 'DRAFT', changelog: input.changelog ?? null },
      });
      if (source !== null) {
        const idMap = new Map<string, string>();
        for (const s of source.steps) {
          const nid = newId();
          idMap.set(s.id, nid);
          await tx.templateStep.create({
            data: {
              id: nid,
              templateVersionId: id,
              stepDefinitionId: s.stepDefinitionId,
              position: s.position,
              isOptional: s.isOptional,
              daysBeforeArrival: s.daysBeforeArrival,
              ...(s.overrides === null ? {} : { overrides: s.overrides }),
            },
          });
        }
        for (const d of source.stepDependencies) {
          const a = idMap.get(d.stepId);
          const b = idMap.get(d.dependsOnStepId);
          if (a !== undefined && b !== undefined) {
            await tx.stepDependency.create({ data: { id: newId(), templateVersionId: id, stepId: a, dependsOnStepId: b } });
          }
        }
      }
      await this.record(tx, staff, ACTIONS.templateVersionCreated, 'journey_template_version', id, {
        template: template.code,
        version,
        copiedFrom: source?.version ?? null,
      });
    });
    return this.versionView(id);
  }

  private async versionView(id: string) {
    const v = await this.prisma.journeyTemplateVersion.findUnique({
      where: { id },
      include: {
        template: { select: { id: true, code: true, nameFr: true } },
        originCountry: { select: { id: true, iso2: true, nameFr: true } },
        steps: {
          orderBy: { position: 'asc' },
          include: { stepDefinition: { select: { id: true, code: true, nameFr: true, category: true, isRisky: true } } },
        },
        stepDependencies: true,
        _count: { select: { journeys: true } },
      },
    });
    if (v === null) throw ApiError.notFound();
    const indexOf = new Map(v.steps.map((s, i) => [s.id, i]));
    return {
      id: v.id,
      version: v.version,
      status: v.status,
      changelog: v.changelog,
      publishedAt: v.publishedAt?.toISOString() ?? null,
      template: v.template,
      originCountry: v.originCountry,
      journeyCount: v._count.journeys,
      steps: v.steps.map((s) => ({
        stepDefinitionId: s.stepDefinitionId,
        code: s.stepDefinition.code,
        nameFr: (s.overrides as { nameFr?: string } | null)?.nameFr ?? s.stepDefinition.nameFr,
        category: s.stepDefinition.category,
        isRisky: s.stepDefinition.isRisky,
        isOptional: s.isOptional,
        daysBeforeArrival: s.daysBeforeArrival,
        overrides: s.overrides,
      })),
      dependencies: v.stepDependencies
        .map((d) => ({ step: indexOf.get(d.stepId) ?? -1, dependsOn: indexOf.get(d.dependsOnStepId) ?? -1 }))
        .filter((d) => d.step >= 0 && d.dependsOn >= 0),
    };
  }

  getVersion(id: string) {
    return this.versionView(id);
  }

  /** « Rendu tel que vu par un membre » : l'ordre, les noms, la rétro-planification. */
  async preview(id: string) {
    const v = await this.versionView(id);
    const full = await this.prisma.stepDefinition.findMany({
      where: { id: { in: v.steps.map((s) => s.stepDefinitionId) } },
      select: { id: true, description: true, defaultDurationDays: true, documentChecklist: true, riskMessage: true },
    });
    const byId = new Map(full.map((f) => [f.id, f]));
    return {
      ...v,
      steps: v.steps.map((s, i) => ({
        position: i + 1,
        ...s,
        description: byId.get(s.stepDefinitionId)?.description ?? null,
        defaultDurationDays: byId.get(s.stepDefinitionId)?.defaultDurationDays ?? null,
        documentChecklist: byId.get(s.stepDefinitionId)?.documentChecklist ?? [],
        riskMessage: s.isRisky ? (byId.get(s.stepDefinitionId)?.riskMessage ?? null) : null,
        dependsOn: v.dependencies.filter((d) => d.step === i).map((d) => d.dependsOn + 1),
      })),
    };
  }

  /** Remplace la composition d'un BROUILLON : étapes ordonnées, dépendances, décalages. */
  async putSteps(staff: StaffUser, id: string, input: VersionSteps) {
    const v = await this.prisma.journeyTemplateVersion.findUnique({ where: { id }, select: { id: true, status: true, version: true } });
    if (v === null) throw ApiError.notFound();
    if (v.status !== 'DRAFT') fail('VERSION_NOT_DRAFT');

    const n = input.steps.length;
    for (const d of input.dependencies) {
      if (d.step >= n || d.dependsOn >= n || d.step === d.dependsOn) fail('VERSION_DEPENDENCY_INVALID', d);
    }
    if (hasDependencyCycle(n, input.dependencies)) fail('VERSION_CYCLE');

    const defIds = [...new Set(input.steps.map((s) => s.stepDefinitionId))];
    const known = await this.prisma.stepDefinition.count({ where: { id: { in: defIds } } });
    if (known !== defIds.length) throw ApiError.notFound();

    await this.prisma.$transaction(async (tx) => {
      await tx.stepDependency.deleteMany({ where: { templateVersionId: id } });
      await tx.templateStep.deleteMany({ where: { templateVersionId: id } });
      const ids = input.steps.map(() => newId());
      for (const [i, s] of input.steps.entries()) {
        await tx.templateStep.create({
          data: {
            id: ids[i] as string,
            templateVersionId: id,
            stepDefinitionId: s.stepDefinitionId,
            position: i + 1,
            isOptional: s.isOptional,
            daysBeforeArrival: s.daysBeforeArrival ?? null,
            ...(s.overrides === null || s.overrides === undefined ? {} : { overrides: s.overrides }),
          },
        });
      }
      for (const d of input.dependencies) {
        await tx.stepDependency.create({
          data: { id: newId(), templateVersionId: id, stepId: ids[d.step] as string, dependsOnStepId: ids[d.dependsOn] as string },
        });
      }
      if (input.changelog !== undefined) {
        await tx.journeyTemplateVersion.update({ where: { id }, data: { changelog: input.changelog } });
      }
      await this.record(tx, staff, ACTIONS.templateVersionEdited, 'journey_template_version', id, {
        version: v.version,
        steps: n,
        dependencies: input.dependencies.length,
      });
    });
    return this.versionView(id);
  }

  /**
   * 03 §5.2 : « Vérifie : au moins une étape, pas de cycle dans les dépendances, une
   * seule publiée par (type, pays). Archive la précédente. »
   */
  async publish(staff: StaffUser, id: string, input: VersionPublish) {
    const v = await this.prisma.journeyTemplateVersion.findUnique({
      where: { id },
      include: { steps: { select: { id: true } }, stepDependencies: true, template: { select: { code: true } } },
    });
    if (v === null) throw ApiError.notFound();
    if (v.status !== 'DRAFT') fail('VERSION_NOT_DRAFT');
    if (v.steps.length === 0) fail('VERSION_EMPTY');
    const index = new Map(v.steps.map((s, i) => [s.id, i]));
    const deps = v.stepDependencies.map((d) => ({ step: index.get(d.stepId) ?? 0, dependsOn: index.get(d.dependsOnStepId) ?? 0 }));
    if (hasDependencyCycle(v.steps.length, deps)) fail('VERSION_CYCLE');

    const now = new Date();
    let archived = 0;
    let affected = 0;
    await this.prisma.$transaction(async (tx) => {
      const previous = await tx.journeyTemplateVersion.findMany({
        where: { templateId: v.templateId, originCountryId: v.originCountryId, status: 'PUBLISHED' },
        select: { id: true },
      });
      for (const p of previous) {
        await tx.journeyTemplateVersion.update({ where: { id: p.id }, data: { status: 'ARCHIVED' } });
      }
      archived = previous.length;
      affected = await tx.journey.count({
        where: { templateVersionId: { in: previous.map((p) => p.id) }, status: { in: ['ACTIVE', 'PAUSED'] } },
      });
      await tx.journeyTemplateVersion.update({
        where: { id },
        data: {
          status: 'PUBLISHED',
          publishedAt: now,
          publishedByStaffId: staff.staffId,
          ...(input.changelog === undefined ? {} : { changelog: input.changelog }),
        },
      });
      await this.record(tx, staff, ACTIONS.templateVersionPublished, 'journey_template_version', id, {
        template: v.template.code,
        version: v.version,
        archived,
        journeysStayingOnOldVersion: affected,
      });
    });
    return { ...(await this.versionView(id)), archivedVersions: archived, journeysNotified: 0, journeysStaying: affected };
  }

  async archive(staff: StaffUser, id: string) {
    const v = await this.prisma.journeyTemplateVersion.findUnique({ where: { id }, select: { id: true, status: true, version: true } });
    if (v === null) throw ApiError.notFound();
    await this.prisma.$transaction(async (tx) => {
      await tx.journeyTemplateVersion.update({ where: { id }, data: { status: 'ARCHIVED' } });
      await this.record(tx, staff, ACTIONS.templateVersionArchived, 'journey_template_version', id, { version: v.version, before: v.status });
    });
    return this.versionView(id);
  }

  // ── Corrections proposées par les membres (03 §2.4) ──────────────────────

  async listCorrections(query: CorrectionQuery): Promise<Page<unknown>> {
    const scope = `admin:corrections:${query.status}`;
    const rows = await this.prisma.templateCorrectionProposal.findMany({
      where: {
        status: query.status,
        ...(query.cursor === undefined ? {} : { id: { lt: decodeCursor(query.cursor, this.cursorSecret, scope).id } }),
      },
      orderBy: { id: 'desc' },
      take: query.limit + 1,
      include: {
        templateVersion: { select: { id: true, version: true, template: { select: { code: true, nameFr: true } } } },
        stepDefinition: { select: { id: true, code: true, nameFr: true } },
      },
    });
    // AGRÉGÉ côté identité : le membre auteur n'est pas nommé à l'équipe qui corrige un modèle.
    return buildPage(
      rows.map((r) => ({
        id: r.id,
        createdAt: r.createdAt.toISOString(),
        message: r.message,
        status: r.status,
        template: r.templateVersion.template.nameFr,
        templateCode: r.templateVersion.template.code,
        version: r.templateVersion.version,
        step: r.stepDefinition === null ? null : { id: r.stepDefinition.id, code: r.stepDefinition.code, nameFr: r.stepDefinition.nameFr },
      })),
      query.limit,
      scope,
      this.cursorSecret,
    );
  }

  /** « Accepter (l'équipe modifie le brouillon de la version suivante), rejeter avec motif. » */
  async decideCorrection(staff: StaffUser, id: string, input: CorrectionDecision) {
    const c = await this.prisma.templateCorrectionProposal.findUnique({ where: { id }, select: { id: true, status: true } });
    if (c === null) throw ApiError.notFound();
    if (c.status !== 'PENDING') fail('CORRECTION_ALREADY_DECIDED');
    await this.prisma.$transaction(async (tx) => {
      await tx.templateCorrectionProposal.update({
        where: { id },
        data: {
          status: input.decision === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED',
          reviewedByStaffId: staff.staffId,
          reviewedAt: new Date(),
        },
      });
      await this.record(tx, staff, ACTIONS.correctionDecided, 'template_correction_proposal', id, {
        decision: input.decision,
        ...(input.decision === 'REJECT' ? { reason: input.reason } : {}),
      });
    });
    return { id, status: input.decision === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED' };
  }
}
