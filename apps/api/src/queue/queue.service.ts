import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import IORedis, { type Redis } from 'ioredis';
import { loadEnv } from '../config/env';
import { ALL_QUEUES, type QueueName } from './queues';

/**
 * Accès aux files. Une seule connexion Redis partagée par les producteurs :
 * BullMQ en exige une par *consommateur*, mais les producteurs peuvent partager.
 */
@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private connection!: Redis;
  private readonly queues = new Map<QueueName, Queue>();

  onModuleInit(): void {
    const env = loadEnv();
    this.connection = new IORedis(env.REDIS_URL, {
      // Exigé par BullMQ : sans cela, un job bloquant lève au lieu d'attendre.
      maxRetriesPerRequest: null,
    });

    for (const name of ALL_QUEUES) {
      this.queues.set(name, new Queue(name, { connection: this.connection }));
    }
    this.logger.log(`${ALL_QUEUES.length} files prêtes : ${ALL_QUEUES.join(', ')}`);
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([...this.queues.values()].map((q) => q.close()));
    await this.connection?.quit();
  }

  get(name: QueueName): Queue {
    const queue = this.queues.get(name);
    if (queue === undefined) throw new Error(`File inconnue : ${name}`);
    return queue;
  }

  /** La connexion brute, pour les consommateurs et les verrous du planificateur. */
  get redis(): Redis {
    return this.connection;
  }

  /** Profondeur des files — métrique de supervision du runbook §4. */
  async depths(): Promise<Record<string, { waiting: number; active: number; failed: number }>> {
    const out: Record<string, { waiting: number; active: number; failed: number }> = {};
    for (const [name, queue] of this.queues) {
      const [waiting, active, failed] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getFailedCount(),
      ]);
      out[name] = { waiting, active, failed };
    }
    return out;
  }
}
