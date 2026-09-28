import { Global, Module } from '@nestjs/common';
import { loadEnv } from '../config/env';
import { EventConsumerService } from './event-consumer.service';
import { EventHandlerRegistry } from './event-handlers';
import { ScheduledTaskRegistry } from './scheduled-tasks';
import { TaskSchedulerService } from './task-scheduler.service';
import { OutboxRelayService } from './outbox-relay.service';
import { QueueService } from './queue.service';

/**
 * Files et relais.
 *
 * Le RELAIS ne tourne que dans le worker (§3.1) : deux relais fonctionneraient —
 * `SKIP LOCKED` les protège — mais doubleraient la charge sur la base sans rien
 * apporter. Les files, elles, sont disponibles partout : l'API produit, le
 * worker consomme.
 */
const env = loadEnv();

/**
 * Le REGISTRE d'événements et celui des TÂCHES PLANIFIÉES sont disponibles
 * partout ; le CONSOMMATEUR et le PLANIFICATEUR seulement dans le worker.
 *
 * Cette asymétrie est volontaire : les modules déclarent leurs abonnements dans
 * leur `onModuleInit`, qui tourne aussi bien dans l'API que dans le worker. Si le
 * registre n'existait que côté worker, l'API ne compilerait pas — et surtout, un
 * module ne saurait plus où s'abonner. Il en va de même du registre des tâches
 * planifiées : le câblage tourne des deux côtés, l'horloge d'un seul.
 */
@Global()
@Module({
  providers: [
    QueueService,
    EventHandlerRegistry,
    ScheduledTaskRegistry,
    ...(env.APP_ROLE === 'worker'
      ? [OutboxRelayService, EventConsumerService, TaskSchedulerService]
      : []),
  ],
  exports: [QueueService, EventHandlerRegistry, ScheduledTaskRegistry],
})
export class QueueModule {}
