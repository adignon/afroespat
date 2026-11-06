import { Injectable } from '@nestjs/common';
import { newId, type Prisma } from '@app/db';
import {
  ADMIN_CONTENT_AUDIT_ACTIONS as ACTIONS,
  ADMIN_CONTENT_ERROR_CODES,
  ADMIN_CONTENT_ERROR_MESSAGES,
  validateAdminContentChanges,
  type AdminContentDetail,
  type AdminContentType,
  type AdminContentUpdate,
} from '@app/shared';
import { ApiError } from '../../common/api-error';
import { AuditService } from '../../common/audit.service';
import { PrismaService } from '../../common/prisma.service';
import type { StaffUser } from '../../common/staff.guard';

type Valeurs = Record<string, string | number | null>;

const iso = (d: Date | null): string | null => (d === null ? null : d.toISOString());

/**
 * LA CORRECTION D'UN CONTENU PAR L'ÉQUIPE (15 §4) — le pendant, pour la MODIFICATION, de ce que `AdminContentsService`
 * fait déjà pour le retrait, le rétablissement et la suppression définitive.
 *
 * Les champs modifiables sont ceux de `ADMIN_CONTENT_EDIT_FIELDS` (source unique, partagée avec l'écran) ; la validation
 * est `validateAdminContentChanges` (pure). Chaque modification est tracée (motif obligatoire) et, quand le titre ou le
 * texte change, l'index de recherche est mis à jour pour ne pas montrer l'ancien libellé.
 */
@Injectable()
export class AdminContentsEditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async detail(type: AdminContentType, id: string): Promise<AdminContentDetail> {
    const values = await this.lire(this.prisma, type, id);
    if (values === null) throw this.introuvable();
    return { id, type, values };
  }

  async update(staff: StaffUser, type: AdminContentType, id: string, input: AdminContentUpdate): Promise<AdminContentDetail> {
    const verdict = validateAdminContentChanges(type, input.changes);
    if (!verdict.ok) {
      throw new ApiError(
        'CONTENT_FIELD_INVALID',
        `${ADMIN_CONTENT_ERROR_MESSAGES.CONTENT_FIELD_INVALID} (${verdict.field} : ${verdict.message})`,
        ADMIN_CONTENT_ERROR_CODES.CONTENT_FIELD_INVALID,
      );
    }
    const data = verdict.data;

    await this.prisma.$transaction(
      async (tx) => {
        const avant = await this.lire(tx, type, id);
        if (avant === null) throw this.introuvable();
        await this.ecrire(tx, type, id, data);
        const apres = await this.lire(tx, type, id);
        await this.audit.record(tx, {
          actor: { type: 'STAFF', id: staff.staffId },
          action: ACTIONS.contentUpdated,
          targetType: 'content',
          targetId: id,
          metadata: {
            type,
            reason: input.reason,
            fields: Object.keys(data),
            // Les anciennes valeurs de texte long ne sont pas recopiées dans l'audit : leur nom suffit.
            before: Object.fromEntries(Object.keys(data).map((k) => [k, typeof avant[k] === 'string' ? String(avant[k]).slice(0, 80) : (avant[k] ?? null)])),
            after: Object.fromEntries(Object.keys(data).map((k) => [k, typeof apres?.[k] === 'string' ? String(apres[k]).slice(0, 80) : (apres?.[k] ?? null)])),
          },
          ...(staff.ip === null ? {} : { ip: staff.ip }),
        });
      },
      { timeout: 30_000, maxWait: 10_000 },
    );
    return this.detail(type, id);
  }

  private introuvable(): ApiError {
    return new ApiError('CONTENT_NOT_FOUND', ADMIN_CONTENT_ERROR_MESSAGES.CONTENT_NOT_FOUND, ADMIN_CONTENT_ERROR_CODES.CONTENT_NOT_FOUND);
  }

  // ── Lecture ────────────────────────────────────────────────────────────────

  private async lire(db: Prisma.TransactionClient | PrismaService, type: AdminContentType, id: string): Promise<Valeurs | null> {
    switch (type) {
      case 'GUIDE': {
        const g = await db.guide.findUnique({ where: { id }, select: { title: true, category: true, status: true } });
        if (g === null) return null;
        const page = await db.guidePage.findFirst({
          where: { guideId: id, deletedAt: null },
          orderBy: { position: 'asc' },
          select: { currentVersionId: true },
        });
        const versionId = page?.currentVersionId ?? null;
        const version = versionId === null ? null : await db.guideVersion.findUnique({ where: { id: versionId }, select: { body: true } });
        return { title: g.title, category: g.category, status: g.status, body: version?.body ?? '' };
      }
      case 'EVENT': {
        const e = await db.event.findUnique({
          where: { id },
          select: { title: true, description: true, venueName: true, addressText: true, startsAt: true, endsAt: true, capacity: true, status: true },
        });
        if (e === null) return null;
        return { ...e, startsAt: e.startsAt.toISOString(), endsAt: iso(e.endsAt) };
      }
      case 'POST': {
        const p = await db.post.findUnique({ where: { id }, select: { body: true, type: true, status: true } });
        return p === null ? null : { ...p };
      }
      case 'HELP_REQUEST': {
        const h = await db.helpRequest.findUnique({ where: { id }, select: { title: true, body: true, status: true } });
        return h === null ? null : { ...h };
      }
      case 'HOUSING': {
        const h = await db.housingListing.findUnique({
          where: { id },
          select: { title: true, description: true, district: true, priceCents: true, status: true },
        });
        return h === null ? null : { ...h };
      }
      case 'JOB': {
        const j = await db.jobListing.findUnique({
          where: { id },
          select: { title: true, description: true, companyName: true, contractType: true, status: true },
        });
        return j === null ? null : { ...j };
      }
      case 'PRO': {
        const p = await db.proProfile.findUnique({
          where: { id },
          select: { businessName: true, description: true, priceHint: true, status: true },
        });
        return p === null ? null : { ...p };
      }
      case 'COMMUNITY': {
        const c = await db.community.findUnique({ where: { id }, select: { name: true, description: true } });
        return c === null ? null : { ...c };
      }
      case 'STORY': {
        const x = await db.story.findUnique({ where: { id }, select: { body: true, placeLabel: true } });
        return x === null ? null : { ...x };
      }
      case 'CITY_TIP': {
        const x = await db.cityTip.findUnique({ where: { id }, select: { body: true, venueName: true } });
        return x === null ? null : { ...x };
      }
      case 'JOURNEY': {
        const x = await db.journey.findUnique({ where: { id }, select: { title: true, status: true, visibility: true } });
        return x === null ? null : { ...x };
      }
      // Rien à corriger : on dit seulement si l'élément existe (le formulaire est alors vide).
      default:
        return (await this.existe(db, type, id)) ? {} : null;
    }
  }

  /** Les types sans champ modifiable : seule l'existence compte (le formulaire est vide, toute modification est refusée). */
  private async existe(db: Prisma.TransactionClient | PrismaService, type: AdminContentType, id: string): Promise<boolean> {
    const tables: Partial<Record<AdminContentType, { findUnique(a: { where: { id: string }; select: { id: true } }): Promise<unknown> }>> = {
      CONVERSATION: db.conversation,
      MODERATION_CASE: db.moderationCase,
      SCAM_ALERT: db.scamAlert,
      LANGUAGE: db.language,
      SKILL: db.skill,
      PROFESSION: db.profession,
      COUNTRY: db.country,
      CITY: db.city,
      STEP_DEFINITION: db.stepDefinition,
      JOURNEY_TEMPLATE: db.journeyTemplate,
      PARTNER: db.partner,
      PLACEMENT: db.partnerPlacement,
    };
    const t = tables[type];
    return t === undefined ? false : (await t.findUnique({ where: { id }, select: { id: true } })) !== null;
  }

  // ── Écriture ───────────────────────────────────────────────────────────────

  private async ecrire(
    tx: Prisma.TransactionClient,
    type: AdminContentType,
    id: string,
    data: Readonly<Record<string, string | number | Date | null>>,
  ): Promise<void> {
    const { body, ...reste } = data;
    switch (type) {
      case 'GUIDE': {
        if (Object.keys(reste).length > 0) {
          await tx.guide.update({ where: { id }, data: { ...(reste), lastContentUpdateAt: new Date() } });
        }
        if (typeof body === 'string') await this.nouvelleVersionDeGuide(tx, id, body);
        await this.reindexer(tx, 'GUIDE', id, typeof reste['title'] === 'string' ? reste['title'] : undefined, typeof body === 'string' ? body : undefined);
        return;
      }
      case 'EVENT':
        await tx.event.update({ where: { id }, data: reste });
        await this.reindexer(tx, 'EVENT', id, typeof reste['title'] === 'string' ? reste['title'] : undefined);
        return;
      case 'POST':
        await tx.post.update({ where: { id }, data: { ...(reste), ...(typeof body === 'string' ? { body } : {}) } });
        return;
      case 'HELP_REQUEST':
        await tx.helpRequest.update({ where: { id }, data: { ...(reste), ...(typeof body === 'string' ? { body } : {}) } });
        await this.reindexer(tx, 'HELP_REQUEST', id, typeof reste['title'] === 'string' ? reste['title'] : undefined, typeof body === 'string' ? body : undefined);
        return;
      case 'HOUSING':
        await tx.housingListing.update({ where: { id }, data: reste });
        await this.reindexer(tx, 'HOUSING', id, typeof reste['title'] === 'string' ? reste['title'] : undefined);
        return;
      case 'JOB':
        await tx.jobListing.update({ where: { id }, data: reste });
        await this.reindexer(tx, 'JOB', id, typeof reste['title'] === 'string' ? reste['title'] : undefined);
        return;
      case 'PRO':
        await tx.proProfile.update({ where: { id }, data: reste });
        return;
      case 'COMMUNITY':
        await tx.community.update({ where: { id }, data: reste });
        return;
      case 'STORY':
        await tx.story.update({ where: { id }, data: { ...reste, ...(typeof body === 'string' ? { body } : {}) } });
        return;
      case 'CITY_TIP':
        await tx.cityTip.update({ where: { id }, data: { ...reste, ...(typeof body === 'string' ? { body } : {}) } });
        return;
      case 'JOURNEY':
        await tx.journey.update({ where: { id }, data: reste });
        return;
      default:
        throw this.introuvable();
    }
  }

  /**
   * Un nouveau texte de guide est une NOUVELLE VERSION de la première page (jamais une réécriture de l'historique) :
   * numéro suivant du guide, page et guide pointés dessus, révision incrémentée.
   */
  private async nouvelleVersionDeGuide(tx: Prisma.TransactionClient, guideId: string, body: string): Promise<void> {
    const page = await tx.guidePage.findFirst({ where: { guideId, deletedAt: null }, orderBy: { position: 'asc' }, select: { id: true } });
    if (page === null) throw this.introuvable();
    const derniere = await tx.guideVersion.findFirst({ where: { guideId }, orderBy: { version: 'desc' }, select: { version: true } });
    const versionId = newId();
    await tx.guideVersion.create({
      data: {
        id: versionId,
        guideId,
        pageId: page.id,
        version: (derniere?.version ?? 0) + 1,
        body,
        summary: 'Correction par l’équipe',
      },
    });
    await tx.guidePage.update({ where: { id: page.id }, data: { currentVersionId: versionId } });
    await tx.guide.update({
      where: { id: guideId },
      data: { currentVersionId: versionId, revision: { increment: 1 }, lastContentUpdateAt: new Date() },
    });
  }

  /** Met à jour le titre (et le texte) indexés ; sans effet si le contenu n'est pas indexé. */
  private async reindexer(
    tx: Prisma.TransactionClient,
    sujet: 'GUIDE' | 'EVENT' | 'HELP_REQUEST' | 'HOUSING' | 'JOB',
    id: string,
    titre: string | undefined,
    texte?: string,
  ): Promise<void> {
    if (titre === undefined && texte === undefined) return;
    if (titre !== undefined) {
      await tx.$executeRaw`UPDATE search_documents SET title = ${titre}, updated_at = now() WHERE subject_type = ${sujet}::"SearchSubjectType" AND subject_id = ${id}::uuid`;
    }
    if (texte !== undefined) {
      await tx.$executeRaw`UPDATE search_documents SET body_text = ${texte.slice(0, 20000)}, updated_at = now() WHERE subject_type = ${sujet}::"SearchSubjectType" AND subject_id = ${id}::uuid`;
    }
  }
}
