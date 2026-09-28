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
import { type AiAnalysisJob, type ModerationQueuePort, ModerationService } from './moderation.service';
import { jobIdOf } from '../../queue/job-id';

/**
 * L'étape 3 du §2 : l'analyse IA, asynchrone, sur la file `moderation`.
 *
 * La file existait depuis le lot 0 et PERSONNE ne la retirait. Ce fichier est sa
 * moitié manquante. Il est calqué sur `queue/event-consumer.service.ts`, et pour
 * les mêmes raisons :
 *
 *   · il ne tourne QUE dans le worker (`APP_ROLE=worker`). Un consommateur par
 *     instance HTTP multiplierait les appels au fournisseur d'IA, et un
 *     déploiement en pleine analyse couperait le travail en cours ;
 *   · `onApplicationBootstrap` et non `onModuleInit` : le service doit être
 *     entièrement construit avant qu'un travail ne lui soit confié ;
 *   · sa propre connexion Redis : BullMQ l'exige d'un consommateur, une connexion
 *     bloquante ne pouvant pas servir aussi de productrice.
 *
 * `concurrency: 3` : la borne est le fournisseur d'IA, pas la base. Trois appels
 * en vol suffisent à absorber une rafale de publications sans transformer une
 * pointe de trafic en pointe de facture.
 *
 * Le travail LÈVE en cas d'échec, il n'avale pas : BullMQ rejoue, et `analyze()`
 * est idempotent — `openCase` dédoublonne sur le sujet.
 */
@Injectable()
export class ModerationConsumer implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(ModerationConsumer.name);
  private connection?: Redis;
  private worker?: Worker;

  constructor(private readonly moderation: ModerationService) {}

  onApplicationBootstrap(): void {
    const env = loadEnv();
    if (env.APP_ROLE !== 'worker') return;

    this.connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
    this.worker = new Worker(
      QUEUES.MODERATION,
      async (job) => {
        await this.moderation.analyze(job.data as AiAnalysisJob);
      },
      { connection: this.connection, concurrency: 3 },
    );

    /**
     * L'écouteur `'error'` n'est PAS optionnel.
     *
     * Un `Worker` BullMQ est un `EventEmitter`, et un événement `'error'` sans
     * écouteur devient une exception non rattrapée qui TUE le processus. Le worker
     * perdrait donc tous ses consommateurs pour une coupure Redis passagère dont
     * BullMQ se relève seul.
     *
     * On journalise et on laisse BullMQ se reconnecter. Relevé par l'agent de
     * l'ordonnanceur, qui en avait posé un sur le sien.
     */
    this.worker.on('error', (error) => {
      this.logger.error(`file ${QUEUES.MODERATION} : ${error.message}`);
    });

    this.worker.on('failed', (job, error) => {
      // Un masquage incomplet arrive ici : `analyze()` lève AVANT l'envoi, et
      // c'est le comportement voulu (règle dure §2). La trace doit donc être
      // lisible, parce que ce n'est pas une panne mais un refus délibéré.
      this.logger.error(
        `analyse ${job?.id ?? '?'} — tentative ${job?.attemptsMade ?? 0} : ${error.message}`,
      );
    });

    this.logger.log(`Consommateur de la file « ${QUEUES.MODERATION} » démarré (§2.3).`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.connection?.quit();
  }
}

/**
 * L'adaptateur qui met en file — l'implémentation de `ModerationQueuePort`.
 *
 * Il vit ici, avec le consommateur, pour que les deux moitiés du même mécanisme
 * se lisent ensemble : ce qui est déposé et ce qui le retire.
 *
 * `attempts: 5` avec repli exponentiel : une analyse perdue est un contenu non
 * analysé, et `removeOnComplete` court garde Redis propre — le travail contient
 * du texte masqué, qui n'a aucune raison d'y séjourner.
 */
@Injectable()
export class BullModerationQueue implements ModerationQueuePort {
  constructor(private readonly queues: QueueService) {}

  async enqueue(job: AiAnalysisJob): Promise<void> {
    await this.queues.get(QUEUES.MODERATION).add('analyze', job, {
      attempts: 5,
      backoff: { type: 'exponential', delay: 10_000 },
      removeOnComplete: { age: 300, count: 100 },
      removeOnFail: { age: 86_400 },
      // Un même sujet analysé deux fois de suite ne vaut qu'un travail : la clé
      // rend la mise en file idempotente sur une rafale d'enregistrements.
      jobId: jobIdOf('analyze', job.subjectType, job.subjectId),
    });
  }
}
