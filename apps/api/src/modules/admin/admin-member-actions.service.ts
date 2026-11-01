import { Injectable } from '@nestjs/common';
import { newId, type Prisma } from '@app/db';
import {
  ADMIN_CONTENT_AUDIT_ACTIONS as ACTIONS,
  ADMIN_CONTENT_ERROR_CODES,
  ADMIN_CONTENT_ERROR_MESSAGES,
  type MemberBulkErase,
  type MemberBulkEraseResult,
  type MemberErase,
  type MemberEraseResult,
  type MemberNoteInput,
  type MemberReason,
} from '@app/shared';
import { ApiError } from '../../common/api-error';
import { AuditService } from '../../common/audit.service';
import { OutboxService } from '../../common/outbox.service';
import { PrismaService } from '../../common/prisma.service';
import type { StaffUser } from '../../common/staff.guard';
import { AccountService } from '../users/account.service';

/** Levée à la fin d'un aperçu pour ANNULER la transaction : le décompte part avec l'exception. */
class ErasePreview extends Error {
  constructor(readonly removed: Record<string, number>) {
    super('aperçu de suppression');
  }
}

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
   * SUPPRESSION DÉFINITIVE d'un compte ET de ses contenus (périmètre `erase`, SUPER_ADMIN).
   *
   * Ce n'est PAS `deleteNow` : celle-ci anonymise (la ligne reste, « Membre supprimé », et les contenus restent
   * lisibles). Ici la ligne `users` disparaît. La base fait presque tout seule — 70 relations vers `users` sont en
   * cascade (publications, événements, parcours, annonces, messages, demandes d'aide…) — mais DOUZE ne le sont pas
   * (`SetNull`) et laisseraient des lignes orphelines : guides, conseils de ville, réseaux créés, conversations,
   * médias… On les traite donc ICI, explicitement, avant de supprimer le compte.
   *
   * Refus d'un compte qui porte une PREUVE À CONSERVER (consentements, 3 ans ; sanctions) : pour lui, la bonne
   * suppression est l'anonymisation RGPD. Les comptes créés par un chargement de données de départ n'en portent pas.
   *
   * `dryRun` : tout le travail est fait, puis la transaction est ANNULÉE — la réponse dit ce qui serait supprimé.
   */
  async erase(staff: StaffUser, userId: string, input: MemberErase): Promise<MemberEraseResult> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, handle: true } });
    if (user === null) throw ApiError.notFound();
    if (input.confirmHandle.trim().toLowerCase() !== user.handle.toLowerCase()) {
      throw new ApiError(
        'MEMBER_DELETE_CONFIRMATION',
        ADMIN_CONTENT_ERROR_MESSAGES.MEMBER_DELETE_CONFIRMATION,
        ADMIN_CONTENT_ERROR_CODES.MEMBER_DELETE_CONFIRMATION,
      );
    }
    return this.eraseOne(staff, user, input.reason, input.dryRun === true);
  }

  /** La même chose pour une sélection : comptes traités UN PAR UN, chacun dans sa transaction, refus rapportés. */
  async eraseMany(staff: StaffUser, input: MemberBulkErase): Promise<MemberBulkEraseResult> {
    const ids = [...new Set(input.ids)];
    if (input.confirmCount !== ids.length) {
      throw new ApiError(
        'MEMBER_ERASE_COUNT',
        ADMIN_CONTENT_ERROR_MESSAGES.MEMBER_ERASE_COUNT,
        ADMIN_CONTENT_ERROR_CODES.MEMBER_ERASE_COUNT,
      );
    }
    const dryRun = input.dryRun === true;
    const users = await this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, handle: true } });
    const parId = new Map(users.map((u) => [u.id, u]));
    const erased: MemberEraseResult[] = [];
    const refused: MemberBulkEraseResult['refused'] = [];
    for (const id of ids) {
      const user = parId.get(id);
      if (user === undefined) {
        refused.push({ userId: id, code: 'NOT_FOUND', message: 'Ce compte n’existe pas.' });
        continue;
      }
      try {
        erased.push(await this.eraseOne(staff, user, input.reason, dryRun));
      } catch (error) {
        refused.push({
          userId: id,
          code: error instanceof ApiError ? error.code : 'ERASE_FAILED',
          message: error instanceof ApiError ? error.message : 'La suppression a échoué.',
        });
      }
    }
    return { dryRun, erased, refused };
  }

  private async eraseOne(
    staff: StaffUser,
    user: { readonly id: string; readonly handle: string },
    reason: string,
    dryRun: boolean,
  ): Promise<MemberEraseResult> {
    const preuves =
      (await this.prisma.consent.count({ where: { userId: user.id } })) +
      (await this.prisma.sanction.count({ where: { userId: user.id } }));
    if (preuves > 0) {
      throw new ApiError(
        'MEMBER_ERASE_NOT_ALLOWED',
        ADMIN_CONTENT_ERROR_MESSAGES.MEMBER_ERASE_NOT_ALLOWED,
        ADMIN_CONTENT_ERROR_CODES.MEMBER_ERASE_NOT_ALLOWED,
      );
    }

    try {
      const removed = await this.prisma.$transaction(
        async (tx) => {
          const retire = await this.removeMemberAndContent(tx, user.id);
          await this.audit.record(
            tx,
            this.auditEntry(staff, ACTIONS.userErased, user.id, { reason, handle: user.handle, removed: retire }),
          );
          if (dryRun) throw new ErasePreview(retire);
          return retire;
        },
        // Un compte chargé de contenus peut dépasser les 5 s par défaut d'une transaction interactive.
        { timeout: 60_000, maxWait: 10_000 },
      );
      return { userId: user.id, handle: user.handle, dryRun: false, removed };
    } catch (error) {
      if (error instanceof ErasePreview) {
        return { userId: user.id, handle: user.handle, dryRun: true, removed: error.removed };
      }
      throw error;
    }
  }

  /** Le travail de la suppression, dans la transaction de l'appelant. Rend le décompte de ce qui part. */
  private async removeMemberAndContent(tx: Prisma.TransactionClient, userId: string): Promise<Record<string, number>> {
    const removed: Record<string, number> = {};
    const compter = (nom: string, n: number) => {
      if (n > 0) removed[nom] = n;
    };

    const compte = await tx.user.findUnique({
      where: { id: userId },
      select: { cityId: true, status: true },
    });

    // ── Ce que la cascade emportera : compté d'avance, pour que l'aperçu soit parlant.
    compter('publications', await tx.post.count({ where: { authorUserId: userId } }));
    compter('événements organisés', await tx.event.count({ where: { organizerUserId: userId } }));
    compter('parcours', await tx.journey.count({ where: { ownerUserId: userId } }));
    compter('demandes d’entraide', await tx.helpRequest.count({ where: { authorUserId: userId } }));
    compter('annonces de logement', await tx.housingListing.count({ where: { authorUserId: userId } }));
    compter('offres d’emploi', await tx.jobListing.count({ where: { authorUserId: userId } }));
    compter('fiches professionnelles', await tx.proProfile.count({ where: { userId } }));
    compter('messages envoyés', await tx.message.count({ where: { senderUserId: userId } }));

    // ── Les identifiants dont l'index de recherche doit être purgé (aucune clé étrangère ne s'en charge).
    const guides = await tx.guide.findMany({ where: { authorUserId: userId }, select: { id: true } });
    const sujets = await tx.topic.findMany({ where: { authorUserId: userId }, select: { id: true } });
    const entraide = await tx.helpRequest.findMany({ where: { authorUserId: userId }, select: { id: true } });
    const logements = await tx.housingListing.findMany({ where: { authorUserId: userId }, select: { id: true } });
    const emplois = await tx.jobListing.findMany({ where: { authorUserId: userId }, select: { id: true } });
    const evenements = await tx.event.findMany({ where: { organizerUserId: userId }, select: { id: true } });
    const pros = await tx.proProfile.findMany({ where: { userId }, select: { id: true } });
    const parcours = await tx.journey.findMany({ where: { ownerUserId: userId }, select: { id: true } });
    const ids = (l: readonly { id: string }[]) => l.map((x) => x.id);

    // ── Les réseaux créés par ce compte : supprimés s'ils n'ont aucun autre membre que des comptes de départ.
    const crees = await tx.community.findMany({ where: { createdByUserId: userId }, select: { id: true } });
    const autres = await tx.communityMember.findMany({
      where: { communityId: { in: ids(crees) }, userId: { not: userId } },
      select: { communityId: true, userId: true },
    });
    const originesAutres = new Map(
      (await tx.user.findMany({ where: { id: { in: [...new Set(autres.map((a) => a.userId))] } }, select: { id: true, origin: true } })).map(
        (u) => [u.id, u.origin],
      ),
    );
    const reseauxASupprimer = ids(crees).filter((id) =>
      autres.filter((a) => a.communityId === id).every((a) => originesAutres.get(a.userId) === 'SEED'),
    );
    const sujetsDesReseaux = await tx.topic.findMany({ where: { communityId: { in: reseauxASupprimer } }, select: { id: true } });

    // ── L'index de recherche.
    await tx.searchDocument.deleteMany({
      where: {
        OR: [
          { subjectType: 'GUIDE', subjectId: { in: ids(guides) } },
          { subjectType: 'TOPIC', subjectId: { in: [...ids(sujets), ...ids(sujetsDesReseaux)] } },
          { subjectType: 'HELP_REQUEST', subjectId: { in: ids(entraide) } },
          { subjectType: 'HOUSING', subjectId: { in: ids(logements) } },
          { subjectType: 'JOB', subjectId: { in: ids(emplois) } },
          { subjectType: 'EVENT', subjectId: { in: ids(evenements) } },
          { subjectType: 'PRO', subjectId: { in: ids(pros) } },
          { subjectType: 'USER', subjectId: userId },
        ],
      },
    });

    // ── Les contenus que la cascade LAISSERAIT (relations `SetNull`).
    compter('guides', (await tx.guide.deleteMany({ where: { id: { in: ids(guides) } } })).count);
    compter('conseils de ville', (await tx.cityTip.deleteMany({ where: { authorUserId: userId } })).count);

    // Conversations : celles qu'il a ouvertes, celles d'un parcours qu'il possédait, celles d'un réseau supprimé,
    // et les échanges à deux dont il fait partie (il ne resterait à l'autre qu'un monologue).
    const aDeux = await tx.conversation.findMany({
      where: { members: { some: { userId } } },
      select: { id: true, _count: { select: { members: true } } },
    });
    const conversations = await tx.conversation.deleteMany({
      where: {
        OR: [
          { openedByUserId: userId },
          { journeyId: { in: ids(parcours) } },
          { communityId: { in: reseauxASupprimer } },
          { id: { in: aDeux.filter((c) => c._count.members <= 2).map((c) => c.id) } },
        ],
      },
    });
    compter('conversations', conversations.count);

    // Compteurs : les réseaux qui restent perdent un membre (la ville aussi). Le recalcul nocturne rattrape le reste.
    const adhesions = await tx.communityMember.findMany({
      where: { userId, status: 'ACTIVE', communityId: { notIn: reseauxASupprimer } },
      select: { communityId: true },
    });
    if (adhesions.length > 0) {
      await tx.community.updateMany({
        where: { id: { in: adhesions.map((a) => a.communityId) }, memberCount: { gt: 0 } },
        data: { memberCount: { decrement: 1 } },
      });
    }
    if (compte !== null && compte.cityId !== null && compte.status === 'ACTIVE') {
      await tx.city.updateMany({ where: { id: compte.cityId, memberCount: { gt: 0 } }, data: { memberCount: { decrement: 1 } } });
    }

    compter('réseaux créés', (await tx.community.deleteMany({ where: { id: { in: reseauxASupprimer } } })).count);
    await tx.outboundMessage.deleteMany({ where: { userId } });

    // ── Le compte : la cascade emporte le reste.
    await tx.user.delete({ where: { id: userId } });
    removed['compte'] = 1;
    return removed;
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
