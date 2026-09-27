import { Injectable, Logger } from '@nestjs/common';
import { newId } from '@app/db';
import { ApiError } from '../../common/api-error';
import { AuditService } from '../../common/audit.service';
import { OutboxService } from '../../common/outbox.service';
import { PrismaService } from '../../common/prisma.service';

/**
 * Blocage entre membres — 08-parrainage-messagerie.md §4.
 *
 * §4 décrit une CASCADE : contacts retirés, demandes expirées, parrainage
 * terminé, membres de parcours retirés, RSVP interdits, conversations fermées.
 * Aucun de ces modules n'existe encore.
 *
 * Ce service pose donc le blocage lui-même et son événement ; chaque lot suivant
 * vient brancher sa part de la cascade en consommant `user.blocked` — la même
 * mécanique que le plan retient pour la suppression de compte. L'alternative
 * aurait été d'attendre tous les modules avant de pouvoir bloquer qui que ce
 * soit, alors que c'est une protection dont un membre peut avoir besoin dès le
 * premier jour.
 *
 * `separatedFrom()` de `VisibilityService` lit ces lignes : la règle de
 * visibilité est donc appliquée partout DÈS MAINTENANT, même là où la cascade
 * n'existe pas.
 */
@Injectable()
export class BlocksService {
  private readonly logger = new Logger(BlocksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
  ) {}

  /** §4 : plus de 20 blocages en 30 jours ouvre un dossier de modération. */
  private static readonly ABUSE_THRESHOLD = 20;

  async block(blockerUserId: string, handle: string): Promise<{ blockedUserId: string }> {
    const target = await this.prisma.user.findUnique({
      where: { handle },
      select: { id: true, deletedAt: true },
    });
    if (target === null || target.deletedAt !== null) throw ApiError.notFound();
    if (target.id === blockerUserId) {
      throw ApiError.transverse('VALIDATION_FAILED', {
        fields: [{ path: 'handle', code: 'SELF_BLOCK' }],
      });
    }

    const existing = await this.prisma.block.findUnique({
      where: { blockerUserId_blockedUserId: { blockerUserId, blockedUserId: target.id } },
      select: { id: true },
    });
    // Idempotent : bloquer deux fois n'est pas une erreur, c'est le même état.
    if (existing !== null) return { blockedUserId: target.id };

    await this.prisma.$transaction(async (tx) => {
      await tx.block.create({
        data: { id: newId(), blockerUserId, blockedUserId: target.id },
      });

      await this.audit.record(tx, {
        actor: { type: 'MEMBER', id: blockerUserId },
        action: 'user.blocked',
        targetType: 'user',
        targetId: target.id,
      });

      await this.outbox.emit(tx, {
        type: 'user.blocked',
        aggregateId: blockerUserId,
        // Les DEUX identifiants : un consommateur doit pouvoir nettoyer les deux
        // côtés — une conversation, un contact, un parcours partagé.
        payload: { blockerUserId, blockedUserId: target.id },
      });
    });

    await this.flagIfAbusive(blockerUserId);
    return { blockedUserId: target.id };
  }

  /**
   * Déblocage. §4 : « les contacts ne sont pas restaurés ».
   *
   * Aucun événement n'est émis : il n'y a rien à reconstruire, et un
   * `user.unblocked` inviterait un consommateur à tenter de restaurer ce que la
   * spec dit explicitement perdu.
   */
  async unblock(blockerUserId: string, blockedUserId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const removed = await tx.block.deleteMany({
        where: { blockerUserId, blockedUserId },
      });
      if (removed.count === 0) return;

      await this.audit.record(tx, {
        actor: { type: 'MEMBER', id: blockerUserId },
        action: 'user.unblocked',
        targetType: 'user',
        targetId: blockedUserId,
      });
    });
  }

  /** La liste des bloqués, pour Compte → Confidentialité (§4). */
  async list(blockerUserId: string) {
    const blocks = await this.prisma.block.findMany({
      where: { blockerUserId },
      orderBy: { createdAt: 'desc' },
      include: {
        blocked: {
          select: { id: true, handle: true, displayName: true },
        },
      },
    });

    return blocks.map((b) => ({
      userId: b.blocked.id,
      handle: b.blocked.handle,
      displayName: b.blocked.displayName,
      blockedAt: b.createdAt,
    }));
  }

  /**
   * §4, anti-abus : au-delà de 20 blocages en 30 jours, un dossier s'ouvre.
   *
   * Le blocage lui-même n'est PAS refusé. Un membre harcelé par plusieurs
   * comptes a un besoin légitime d'en bloquer beaucoup ; c'est à la modération
   * de regarder, pas à un compteur de décider.
   */
  private async flagIfAbusive(blockerUserId: string): Promise<void> {
    const since = new Date(Date.now() - 30 * 86_400_000);
    const count = await this.prisma.block.count({
      where: { blockerUserId, createdAt: { gte: since } },
    });
    if (count <= BlocksService.ABUSE_THRESHOLD) return;

    // Le dossier de modération relève du module 13, qui n'existe pas encore : on
    // journalise, et le module viendra consommer cette trace.
    this.logger.warn(
      `Anti-abus : ${count} blocages en 30 jours par un même membre — dossier à ouvrir (§4)`,
    );
  }
}
