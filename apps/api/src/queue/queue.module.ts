import { Global, Module } from '@nestjs/common';
import { loadEnv } from '../config/env';
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

@Global()
@Module({
  providers: [QueueService, ...(env.APP_ROLE === 'worker' ? [OutboxRelayService] : [])],
  exports: [QueueService],
})
export class QueueModule {}
