import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@app/db';
import type { VerificationLevel } from '@app/shared';
import { OutboxService } from '../../common/outbox.service';
import { PrismaService } from '../../common/prisma.service';

/**
 * Le calcul du niveau de vérification — 00-fondations.md §7.2 et 01 §2.4.
 *
 * Un SEUL endroit calcule le niveau, et c'est tout l'intérêt d'un service dédié :
 * §7.2 pose trois conditions cumulatives et une conséquence non évidente (« un KYC
 * refusé ou expiré fait retomber le membre à L0, même s'il a un numéro français »).
 * Recopier ce calcul dans le KYC puis dans les téléphones garantirait qu'un jour
 * l'un des deux oublie la rétrogradation.
 *
 * TROIS EFFETS indissociables, dans une seule transaction (§2.4) :
 *   1. `users.verification_level` est mis à jour ;
 *   2. `auth_sessions.level_refresh_required = true` sur toutes les sessions
 *      actives — le niveau figure dans le jeton d'accès (T4 §2), donc les jetons
 *      déjà émis sont périmés et doivent être refusés en `401 TOKEN_STALE` ;
 *   3. `user.level_changed` part par la boîte d'envoi, dans la même transaction.
 *
 * Les séparer laisserait une fenêtre où le membre est L1 en base et L0 dans son
 * jeton, sans que rien ne le signale — c'est-à-dire un membre qui vient de
 * vérifier son identité et à qui la plateforme continue de refuser la publication.
 *
 * IDEMPOTENT : appelé deux fois de suite, le second appel ne change rien, ne
 * marque aucune session et n'émet aucun événement. C'est ce qui permet de
 * l'appeler depuis un webhook rejoué et depuis une tâche planifiée.
 */

/** Ce qui a provoqué le recalcul. Voyage dans l'événement, pour le journal. */
export type LevelTrigger = 'kyc.status_changed' | 'phone.added' | 'phone.removed' | 'staff.downgrade';

export interface LevelRecomputeResult {
  readonly level: VerificationLevel;
  readonly previousLevel: VerificationLevel;
  readonly changed: boolean;
  /** Nombre de sessions marquées à rafraîchir. 0 si rien n'a changé. */
  readonly sessionsFlagged: number;
}

@Injectable()
export class VerificationLevelService {
  private readonly logger = new Logger(VerificationLevelService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  /**
   * Recalcule et applique le niveau. À appeler APRÈS l'écriture qui l'a rendu
   * caduc (statut KYC, ajout ou retrait de numéro).
   *
   * Prend la transaction EN OPTION. Passée, les trois effets partagent la
   * transaction de l'appelant — ce que veut le webhook, qui écrit le statut KYC
   * juste avant. Absente, le service ouvre la sienne — ce que veut une tâche
   * planifiée qui recalcule plusieurs membres.
   */
  async recompute(
    userId: string,
    trigger: LevelTrigger,
    tx?: Prisma.TransactionClient,
  ): Promise<LevelRecomputeResult> {
    if (tx !== undefined) return this.apply(tx, userId, trigger);
    return this.prisma.$transaction((inner) => this.apply(inner, userId, trigger));
  }

  private async apply(
    tx: Prisma.TransactionClient,
    userId: string,
    trigger: LevelTrigger,
  ): Promise<LevelRecomputeResult> {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { verificationLevel: true, deletedAt: true },
    });
    if (user === null) {
      // Un membre disparu n'est pas une erreur ici : le webhook d'un fournisseur
      // peut arriver après une suppression de compte. Il n'y a rien à recalculer.
      return { level: 'L0', previousLevel: 'L0', changed: false, sessionsFlagged: 0 };
    }

    const previousLevel = user.verificationLevel;
    const level =
      user.deletedAt !== null ? previousLevel : await this.levelFor(tx, userId);

    if (level === previousLevel) {
      return { level, previousLevel, changed: false, sessionsFlagged: 0 };
    }

    await tx.user.update({ where: { id: userId }, data: { verificationLevel: level } });

    /**
     * Toutes les sessions ACTIVES, révoquées exclues.
     *
     * `revokedAt: null` est écrit EXPLICITEMENT plutôt que laissé implicite :
     * marquer une session déjà révoquée ne sert à rien, et le compte rendu de
     * cette méthode — que les tests lisent — annoncerait des sessions à
     * rafraîchir qui ne se rafraîchiront jamais.
     */
    const flagged = await tx.authSession.updateMany({
      where: { userId, revokedAt: null },
      data: { levelRefreshRequired: true },
    });

    await this.outbox.emit(tx, {
      type: 'user.level_changed',
      aggregateId: userId,
      payload: { userId, from: previousLevel, to: level, trigger },
    });

    this.logger.log(`${userId} : ${previousLevel} → ${level} (${trigger})`);

    return { level, previousLevel, changed: true, sessionsFlagged: flagged.count };
  }

  /**
   * Le niveau que les faits imposent — §7.2, lu ligne à ligne.
   *
   * « L1 = L0 + identité vérifiée par Didit (statut `APPROVED`) », « L2 = L1 + un
   * numéro d'un pays de destination actif ». Cumulatifs : sans KYC approuvé, un
   * numéro français laisse le membre en L0.
   *
   * `is_adult = false` NE DONNE PAS L1, même sur un `APPROVED` : §2.3 réserve la
   * plateforme aux majeurs, et son compte est désactivé. Le cas ne devrait pas
   * exister — un mineur n'est pas approuvé — mais le fournisseur décide seul de la
   * combinaison qu'il renvoie, et lui faire confiance ici donnerait L1 à un mineur.
   */
  private async levelFor(
    tx: Prisma.TransactionClient,
    userId: string,
  ): Promise<VerificationLevel> {
    // « La dernière fait foi » (§3) : on trie par création, pas par statut.
    const latestKyc = await tx.kycVerification.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { status: true, isAdult: true },
    });

    const identityVerified =
      latestKyc !== null && latestKyc.status === 'APPROVED' && latestKyc.isAdult !== false;
    if (!identityVerified) return 'L0';

    /**
     * Le numéro de destination doit encore être celui d'un pays ACTIF (§7.2).
     *
     * `is_destination` est figé à la vérification du numéro ; si le pays est
     * fermé depuis, la présence qu'il atteste ne vaut plus. On rejoint donc
     * `countries` au lieu de croire la colonne dénormalisée — c'est une requête
     * de plus et une incohérence de moins.
     */
    const destination = await tx.phoneNumber.findFirst({
      where: { userId, isDestination: true, country: { isActive: true } },
      select: { id: true },
    });

    return destination === null ? 'L1' : 'L2';
  }
}
