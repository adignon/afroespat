import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { OutboxService } from '../common/outbox.service';
import { QueueService } from './queue.service';
import { EVENT_JOB_OPTIONS, QUEUES } from './queues';

/**
 * Relais de la boîte d'envoi — 00-fondations.md §9.1 et §9.3 (`outbox.relay`, 1 s).
 *
 * Lit les événements non publiés et les met dans la file `events`, puis les
 * marque publiés. Ne tourne que dans le worker : deux relais en parallèle
 * fonctionneraient (SKIP LOCKED les protège) mais doubleraient la charge sur la
 * base sans rien apporter.
 *
 * Livraison AU MOINS UNE FOIS, assumée : si le processus meurt entre la mise en
 * file et le marquage, l'événement repart. Les abonnés doivent être idempotents —
 * d'où la contrainte d'unicité (membre, type, source) sur `reputation_events`
 * (§9.4), qui garantit qu'un événement rejoué ne compte pas deux fois.
 */
@Injectable()
export class OutboxRelayService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxRelayService.name);
  private timer: NodeJS.Timeout | undefined;
  private running = false;
  private stopped = false;

  constructor(
    private readonly outbox: OutboxService,
    private readonly queues: QueueService,
  ) {}

  onModuleInit(): void {
    // Toutes les secondes (§9.3). `unref` pour ne pas retenir le processus.
    this.timer = setInterval(() => void this.tick(), 1_000);
    this.timer.unref();
    this.logger.log('Relais de la boîte d’envoi démarré (1 s)');
  }

  onModuleDestroy(): void {
    this.stopped = true;
    if (this.timer !== undefined) clearInterval(this.timer);
  }

  /**
   * Un passage. Le drapeau `running` évite le chevauchement : si un lot met plus
   * d'une seconde, le suivant attend plutôt que de doubler la charge.
   */
  async tick(): Promise<number> {
    if (this.running || this.stopped) return 0;
    this.running = true;

    try {
      const events = await this.outbox.claimUnpublished(100);
      if (events.length === 0) return 0;

      const queue = this.queues.get(QUEUES.EVENTS);
      await queue.addBulk(
        events.map((e) => ({
          name: e.type,
          data: { id: e.id, type: e.type, aggregateId: e.aggregateId, payload: e.payload, occurredAt: e.occurredAt },
          // L'identifiant de l'événement sert de clé de job : BullMQ déduplique,
          // ce qui limite l'effet d'un rejeu.
          opts: { ...EVENT_JOB_OPTIONS, jobId: e.id },
        })),
      );

      await this.outbox.markPublished(events.map((e) => e.id));
      this.logger.debug(`${events.length} événements relayés`);
      return events.length;
    } catch (error) {
      // On ne marque rien : le prochain passage reprendra le lot.
      this.logger.error('Échec du relais', error instanceof Error ? error.stack : String(error));
      return 0;
    } finally {
      this.running = false;
    }
  }
}
