/**
 * Point d'entrée du paquet — ce que le worker consomme.
 *
 * §3.1 : « apps/api et apps/worker partagent le même code. » Le worker importe
 * donc le MÊME module racine, pas une copie. Un point d'entrée unique plutôt que
 * des sous-chemins : la résolution Node classique ne lit pas le champ `exports`,
 * et passer en résolution node16 imposerait de remettre les extensions `.js`,
 * que SWC ne résout pas.
 */
export { AppModule } from './app.module';
export { loadEnv, type Env } from './config/env';
export { PrismaService } from './common/prisma.service';
export { OutboxService, type DomainEventType } from './common/outbox.service';
export { AuditService } from './common/audit.service';
export { CryptoService } from './common/crypto.service';
export { QueueService } from './queue/queue.service';
export { QUEUES, ALL_QUEUES, type QueueName } from './queue/queues';
export { redactForModeration, assertRedacted } from './common/redact';
