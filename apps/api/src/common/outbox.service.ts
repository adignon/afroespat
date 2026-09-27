import { Injectable, Logger } from '@nestjs/common';
import { newId, type Prisma } from '@app/db';
import { PrismaService } from './prisma.service';

/**
 * Boîte d'envoi transactionnelle — 00-fondations.md §9.1.
 *
 * « Un service qui modifie l'état écrit, DANS LA MÊME TRANSACTION, une ligne
 * dans `domain_events`. Un relais (tâche toutes les secondes) publie ces
 * événements dans la file `events` et les marque publiés. Cela garantit qu'aucun
 * effet de bord n'est perdu ni exécuté pour une écriture annulée. »
 *
 * Le problème que ce patron résout, et qu'une publication directe ne résout
 * pas : si l'on publiait dans Redis juste après le COMMIT, une panne entre les
 * deux perdrait l'événement — un parrainage accepté sans notification, une
 * réputation jamais créditée. Et si l'on publiait AVANT, une transaction annulée
 * déclencherait des effets pour une écriture qui n'a jamais eu lieu.
 *
 * Écrire l'événement dans la même transaction que la donnée élimine les deux
 * cas : soit les deux existent, soit aucun.
 *
 * RÈGLE (§3.3) : « Les effets de bord (notifications, indexation, réputation)
 * passent par des événements de domaine, JAMAIS par des appels directs. » Un
 * service qui appellerait NotificationService en direct recréerait le couplage
 * que ce patron existe pour défaire.
 */

/** Nommage imposé : `<entité>.<verbe_passé>` (§9.1). */
export type DomainEventType =
  | 'journey.created'
  | 'journey.step_completed'
  | 'journey.step_started'
  | 'journey.completed'
  | 'blocker.published'
  | 'post.created'
  | 'story.created'
  | 'guide.voted'
  | 'guide.published'
  // Le reste du §6 du module 05. Chacun a son consommateur nommé : search et
  // journeys pour les changements d'état (le lien d'étape doit cesser de pointer
  // un guide retiré), reputation pour les votes et les contributions,
  // notifications et moderation pour les propositions.
  | 'guide.unpublished'
  | 'guide.flagged'
  | 'guide.restored'
  | 'guide.vote_removed'
  | 'guide.version_created'
  | 'guide.proposal_created'
  | 'guide.proposal_accepted'
  | 'guide.proposal_rejected'
  | 'guide.proposal_escalated'
  // Les quatre événements de 06 §6. `published` et non `created` : c'est le nom
  // que la spec donne, et celui que search, moderation et les notifications
  // « Vous pouvez aider » attendent. `help_request.created` était une invention
  // de ce catalogue, sans consommateur — retiré plutôt que gardé en doublon.
  | 'help_request.published'
  | 'help_request.responded'
  | 'help_request.resolved'
  | 'help_request.reopened'
  | 'mentorship.requested'
  | 'mentorship.accepted'
  | 'mentorship.ended'
  // Module 09 §7. `event.created` et `event.attended` figuraient ici depuis le
  // lot 0 et ne correspondent à AUCUNE ligne du §7 : c'étaient des inventions de
  // ce catalogue, sans consommateur. Retirées plutôt que gardées en doublon, comme
  // `help_request.created` l'avait été.
  | 'event.published'
  | 'event.updated'
  | 'event.cancelled'
  | 'event.done'
  | 'event.rsvp_changed'
  | 'event.checked_in'
  | 'city_tip.published'
  | 'city_tip.voted'
  | 'connection.created'
  // Consommé par presque tous les modules de contenu — fil, guides, entraide,
  // réseaux, agenda, services — pour leurs règles de visibilité.
  | 'user.blocked'
  | 'kyc.status_changed'
  | 'phone.added'
  | 'phone.removed'
  | 'user.level_changed'
  | 'user.registered'
  // Le reste du §7 du module 01. Chacun a un consommateur nommé dans la spec :
  // un type sans consommateur créerait une file que personne ne lit.
  | 'user.onboarded'
  | 'user.onboarded_location'
  | 'user.phase_changed'
  | 'user.deactivated'
  | 'user.reactivated'
  | 'user.deletion_requested'
  | 'user.deleted'
  // 07-reseaux.md §6. Consommateurs nommés : search et notifications pour la vie
  // du réseau, notifications et cities pour les adhésions.
  //
  // `community.activity` du §6 n'est PAS ici : son unique consommateur déclaré
  // est « met à jour last_activity_at », que le service fait lui-même dans la
  // transaction. Un événement pour se le renvoyer à soi-même ouvrirait une
  // fenêtre où l'activité existe mais où la date d'archivage est encore vieille,
  // et la tâche quotidienne pourrait endormir un réseau qui vient de vivre.
  //
  // `community.topic_replied` non plus : aucune route ne crée de réponse
  // aujourd'hui, donc rien ne peut l'émettre.
  | 'community.created'
  | 'community.archived'
  | 'community.reactivated'
  | 'community.member_joined'
  | 'community.member_left'
  | 'community.member_banned'
  | 'community.topic_created'
  | 'community.topic_resolved'
  | 'community.announcement_published'
  | 'subscription.changed'
  | 'report.created'
  | 'content.flagged';

export interface DomainEventInput {
  readonly type: DomainEventType;
  /** L'entité concernée : parcours, publication, membre… */
  readonly aggregateId: string;
  readonly payload: Prisma.InputJsonValue;
  /** Par défaut maintenant. Explicite quand l'événement décrit un fait passé. */
  readonly occurredAt?: Date;
}

/** Le client Prisma, ou la transaction en cours. */
type Writer = PrismaService | Prisma.TransactionClient;

@Injectable()
export class OutboxService {
  private readonly logger = new Logger(OutboxService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Écrit un événement. À appeler AVEC le client de transaction, jamais sans —
   * c'est toute la garantie du patron.
   *
   *   await this.prisma.$transaction(async (tx) => {
   *     const journey = await tx.journey.create({ ... });
   *     await this.outbox.emit(tx, { type: 'journey.created', aggregateId: journey.id, payload: {} });
   *   });
   */
  async emit(writer: Writer, event: DomainEventInput): Promise<void> {
    await writer.domainEvent.create({
      data: {
        id: newId(),
        type: event.type,
        aggregateId: event.aggregateId,
        payload: event.payload,
        occurredAt: event.occurredAt ?? new Date(),
      },
    });
  }

  /** Plusieurs événements d'une même transaction. */
  async emitMany(writer: Writer, events: readonly DomainEventInput[]): Promise<void> {
    if (events.length === 0) return;
    const now = new Date();
    await writer.domainEvent.createMany({
      data: events.map((e) => ({
        id: newId(),
        type: e.type,
        aggregateId: e.aggregateId,
        payload: e.payload,
        occurredAt: e.occurredAt ?? now,
      })),
    });
  }

  /**
   * Récupère un lot d'événements non publiés, pour le relais.
   *
   * `FOR UPDATE SKIP LOCKED` : plusieurs workers peuvent tourner en parallèle
   * sans se marcher dessus ni traiter deux fois la même ligne. Sans `SKIP
   * LOCKED`, ils s'attendraient l'un l'autre et le relais deviendrait
   * séquentiel ; sans `FOR UPDATE`, ils publieraient deux fois.
   */
  async claimUnpublished(limit = 100): Promise<
    { id: string; type: string; aggregateId: string; payload: unknown; occurredAt: Date }[]
  > {
    return this.prisma.$queryRaw`
      SELECT id, type, aggregate_id AS "aggregateId", payload, occurred_at AS "occurredAt"
      FROM domain_events
      WHERE published_at IS NULL
      ORDER BY created_at ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    `;
  }

  /**
   * Marque publié. Appelé APRÈS la mise en file, jamais avant : en cas de panne
   * entre les deux, l'événement sera republié. Les abonnés doivent donc être
   * idempotents — c'est une livraison « au moins une fois », et la contrainte
   * d'unicité de `reputation_events` est justement là pour ça (§9.4).
   */
  async markPublished(ids: readonly string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.prisma.domainEvent.updateMany({
      where: { id: { in: [...ids] } },
      data: { publishedAt: new Date() },
    });
  }

  /** Supervision : la file d'attente de la boîte d'envoi (runbook §4). */
  async pendingCount(): Promise<number> {
    return this.prisma.domainEvent.count({ where: { publishedAt: null } });
  }

  /**
   * Le plus ancien événement en attente. Une valeur qui grimpe signale un relais
   * arrêté — l'alerte du runbook §4 (« file `events` > 10 000 ou job > 10 min »)
   * se branche ici.
   */
  async oldestPendingAge(): Promise<number | null> {
    const oldest = await this.prisma.domainEvent.findFirst({
      where: { publishedAt: null },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    });
    if (oldest === null) return null;
    return Date.now() - oldest.createdAt.getTime();
  }
}
