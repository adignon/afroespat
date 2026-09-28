import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { Worker } from 'bullmq';
import IORedis, { type Redis } from 'ioredis';
import { loadEnv } from '../../config/env';
import { QueueService } from '../../queue/queue.service';
import { QUEUES } from '../../queue/queues';
import { type SearchIndexJob, type SearchIndexQueuePort, SearchService } from './search.service';
import { jobIdOf } from '../../queue/job-id';

/**
 * La file `search-index` — 11 §2.5 : « traitement asynchrone, délai cible < 30 s ».
 *
 * Elle existait depuis le lot 0 et personne ne la retirait. Ce fichier tient les
 * deux bouts, comme `notifications.outbound.ts` pour les envois.
 *
 * `concurrency: 4` : chaque travail relit une source et fait un `INSERT … ON
 * CONFLICT`. La borne est le bassin de connexions Prisma, pas le processeur.
 */
@Injectable()
export class SearchIndexConsumer implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(SearchIndexConsumer.name);
  private connection?: Redis;
  private worker?: Worker;

  constructor(private readonly search: SearchService) {}

  onApplicationBootstrap(): void {
    const env = loadEnv();
    if (env.APP_ROLE !== 'worker') return;

    this.connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
    this.worker = new Worker(
      QUEUES.SEARCH_INDEX,
      async (job) => {
        const data = job.data as SearchIndexJob;
        await this.search.reindexSubject(data.subjectType, data.subjectId);
      },
      { connection: this.connection, concurrency: 4 },
    );

    this.worker.on('failed', (job, error) => {
      this.logger.error(
        `indexation ${job?.id ?? '?'} — tentative ${job?.attemptsMade ?? 0} : ${error.message}`,
      );
    });

    this.logger.log(`Consommateur de la file « ${QUEUES.SEARCH_INDEX} » démarré (§2.5).`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.connection?.quit();
  }
}

/**
 * L'adaptateur qui dépose.
 *
 * `jobId` par sujet, et c'est l'essentiel : dix modifications d'un même guide en
 * une seconde ne donnent qu'un travail, donc une seule relecture de la source. Sans
 * cette clé, une rafale d'`event.rsvp_changed` ferait dix indexations identiques.
 *
 * `removeOnComplete` très court : le travail ne porte qu'un type et un
 * identifiant, il n'a aucune valeur d'archive — et le garder empêcherait la
 * dé-duplication par `jobId` de fonctionner sur le travail suivant.
 *
 * LE SÉPARATEUR EST UN TIRET : BullMQ refuse un `jobId` contenant « : » sauf s'il
 * compte exactement trois segments. `reindex:TYPE:ID` passait — par ACCIDENT, et
 * cette tolérance est marquée « TODO » dans son code. Un tiret ne dépend d'aucun
 * accident.
 */
@Injectable()
export class BullSearchIndexQueue implements SearchIndexQueuePort {
  constructor(private readonly queues: QueueService) {}

  async enqueue(job: SearchIndexJob): Promise<void> {
    await this.queues.get(QUEUES.SEARCH_INDEX).add('reindex', job, {
      attempts: 5,
      backoff: { type: 'exponential', delay: 5_000 },
      removeOnComplete: { age: 60, count: 500 },
      removeOnFail: { age: 86_400 },
      jobId: jobIdOf('reindex', job.subjectType, job.subjectId),
    });
  }
}
