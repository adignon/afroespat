import { Injectable } from '@nestjs/common';
import { newId, type Prisma } from '@app/db';
import {
  ADMIN_CONTENT_AUDIT_ACTIONS as ACTIONS,
  ADMIN_CONTENT_ERROR_CODES,
  ADMIN_CONTENT_ERROR_MESSAGES,
  type MemberNoteInput,
  type MemberReason,
} from '@app/shared';
import { ApiError } from '../../common/api-error';
import { AuditService } from '../../common/audit.service';
import { OutboxService } from '../../common/outbox.service';
import { PrismaService } from '../../common/prisma.service';
import type { StaffUser } from '../../common/staff.guard';
import { AccountService } from '../users/account.service';

/**
 * Les trois actions de la fiche membre que 15 §7 promettait et que l'API n'avait
 * pas : `note`, `delete-now`, `export` (§3.2).
 *
 * Chacune est un `$transaction` qui contient l'écriture ET sa trace (§2.3).
 */
@Injectable()
export class AdminMemberActionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
    private readonly account: AccountService,
  ) {}

  private async userOr404(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, handle: true, status: true, deletedAt: true },
    });
    if (user === null || user.deletedAt !== null || user.status === 'DELETED') throw ApiError.notFound();
    return user;
  }

  private auditEntry(staff: StaffUser, action: string, userId: string, metadata: Prisma.InputJsonValue) {
    return {
      actor: { type: 'STAFF' as const, id: staff.staffId },
      action,
      targetType: 'user',
      targetId: userId,
      metadata,
      ...(staff.ip === null ? {} : { ip: staff.ip }),
    };
  }

  /**
   * §3.2 : « Ajouter une note interne — tous les rôles, visible équipe seulement,
   * journalisée ». Le CONTENU de la note n'entre pas dans le journal d'audit : le
   * journal est en ajout seul et conservé cinq ans, alors que §11 veut que les
   * notes disparaissent avec le membre. Seul son identifiant y figure.
   */
  async addNote(staff: StaffUser, userId: string, input: MemberNoteInput) {
    await this.userOr404(userId);
    const id = newId();
    const note = await this.prisma.$transaction(async (tx) => {
      const created = await tx.memberNote.create({
        data: { id, userId, staffId: staff.staffId, body: input.body },
        select: { id: true, createdAt: true, body: true, staff: { select: { id: true, displayName: true } } },
      });
      await this.audit.record(tx, this.auditEntry(staff, ACTIONS.memberNoteAdded, userId, { noteId: id }));
      return created;
    });
    return {
      id: note.id,
      createdAt: note.createdAt,
      body: note.body,
      author: { id: note.staff.id, displayName: note.staff.displayName },
    };
  }

  async listNotes(userId: string) {
    await this.userOr404(userId);
    const rows = await this.prisma.memberNote.findMany({
      where: { userId },
      orderBy: { id: 'desc' },
      take: 100,
      select: { id: true, createdAt: true, body: true, staff: { select: { id: true, displayName: true } } },
    });
    return {
      items: rows.map((n) => ({
        id: n.id,
        createdAt: n.createdAt,
        body: n.body,
        author: { id: n.staff.id, displayName: n.staff.displayName },
      })),
    };
  }

  /**
   * §3.2 : « Exécuter une suppression immédiate — SUPPORT, sur demande écrite du
   * membre, saute le délai de 7 jours ».
   *
   * Deux garde-fous en plus du motif : la SAISIE DU PSEUDO (une suppression ne se
   * défait pas, et le geste se fait depuis une fiche qu'on vient de lire), et la même
   * anonymisation que la tâche `account.deletion_execute` — jamais une variante : une
   * seconde manière de supprimer un compte finit toujours par oublier une table.
   */
  async deleteNow(staff: StaffUser, userId: string, input: MemberReason & { confirmHandle: string }) {
    const user = await this.userOr404(userId);
    if (input.confirmHandle.trim().toLowerCase() !== user.handle.toLowerCase()) {
      throw new ApiError(
        'MEMBER_DELETE_CONFIRMATION',
        ADMIN_CONTENT_ERROR_MESSAGES.MEMBER_DELETE_CONFIRMATION,
        ADMIN_CONTENT_ERROR_CODES.MEMBER_DELETE_CONFIRMATION,
      );
    }
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      // Une demande de suppression existe peut-être déjà (délai de 7 jours en cours) :
      // on la clôt au lieu d'en empiler une seconde, que la tâche rejouerait.
      const pending = await tx.accountDeletionRequest.findFirst({
        where: { userId, cancelledAt: null, executedAt: null },
        select: { id: true },
      });
      const requestId = pending?.id ?? newId();
      if (pending === null) {
        await tx.accountDeletionRequest.create({
          data: { id: requestId, userId, requestedAt: now, executeAfter: now, executedAt: now },
        });
      } else {
        await tx.accountDeletionRequest.update({ where: { id: requestId }, data: { executedAt: now } });
      }
      await this.account.anonymise(tx, userId, now);
      await this.audit.record(
        tx,
        this.auditEntry(staff, ACTIONS.userDeletedNow, userId, { reason: input.reason, requestId }),
      );
      await this.outbox.emit(tx, {
        type: 'user.deleted',
        aggregateId: userId,
        payload: { userId, requestId, reason: 'REQUESTED', byStaffId: staff.staffId },
      });
    });
    return { userId, deleted: true };
  }

  /**
   * §3.2 : « Générer un export — SUPPORT ». Même file que `POST /me/export`, MAIS sans
   * le quota de trente jours : c'est le support qui agit à la demande du membre, et le
   * quota protège la plateforme d'un membre insistant, pas d'une équipe qui répond.
   * L'archive est ensuite lisible par le membre (`GET /me/export/latest`) : l'équipe
   * ne lit jamais le contenu (§3.1).
   */
  async generateExport(staff: StaffUser, userId: string, input: MemberReason) {
    await this.userOr404(userId);
    const id = newId();
    await this.prisma.$transaction(async (tx) => {
      await tx.dataExport.create({ data: { id, userId, status: 'PENDING' } });
      await this.outbox.emit(tx, {
        type: 'user.export_requested',
        aggregateId: userId,
        payload: { exportId: id, userId },
      });
      await this.audit.record(
        tx,
        this.auditEntry(staff, ACTIONS.userExported, userId, { exportId: id, reason: input.reason }),
      );
    });
    return { id, status: 'PENDING' as const };
  }
}
