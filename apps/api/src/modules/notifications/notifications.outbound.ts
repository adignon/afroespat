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
import { OUTBOUND_JOB_OPTIONS, QUEUES } from '../../queue/queues';
import {
  type OutboundEmailJob,
  type OutboundPushJob,
  type OutboundQueuePort,
  NotificationsService,
} from './notifications.service';
import { jobIdOf } from '../../queue/job-id';

/**
 * Les files `email` et `push` — la moitié manquante des envois sortants.
 *
 * Elles existaient depuis le lot 0 avec `OUTBOUND_JOB_OPTIONS` et personne ne les
 * retirait. Ce fichier tient les deux bouts : l'adaptateur qui dépose, et les
 * consommateurs qui appellent les fournisseurs.
 *
 * Calqué sur `ModerationConsumer`, et pour les mêmes raisons : worker seulement,
 * `onApplicationBootstrap`, connexion Redis propre.
 *
 * `concurrency` différente par file, et c'est délibéré : la borne de l'email est le
 * fournisseur (Brevo limite le débit), celle du push est le nombre d'abonnements à
 * parcourir par travail, donc la base.
 */
@Injectable()
export class OutboundConsumer implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(OutboundConsumer.name);
  private connection?: Redis;
  private readonly workers: Worker[] = [];

  constructor(private readonly notifications: NotificationsService) {}

  onApplicationBootstrap(): void {
    const env = loadEnv();
    if (env.APP_ROLE !== 'worker') return;

    this.connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });

    this.workers.push(
      new Worker(
        QUEUES.EMAIL,
        async (job) => {
          await this.notifications.sendEmail(job.data as OutboundEmailJob);
        },
        { connection: this.connection, concurrency: 5 },
      ),
    );

    this.workers.push(
      new Worker(
        QUEUES.PUSH,
        async (job) => {
          await this.notifications.sendPush(job.data as OutboundPushJob);
        },
        { connection: this.connection, concurrency: 10 },
      ),
    );

    for (const worker of this.workers) {
      worker.on('failed', (job, error) => {
        // Journalisé et non avalé : après cinq tentatives, la ligne
        // `outbound_messages` reste en `FAILED` avec son message, et cette trace
        // est ce qui permet de distinguer « fournisseur en panne » de « adresse
        // invalide » sans relire le code.
        this.logger.error(
          `${worker.name} ${job?.id ?? '?'} — tentative ${job?.attemptsMade ?? 0} : ${error.message}`,
        );
      });
    }

    this.logger.log(`Consommateurs des files « ${QUEUES.EMAIL} » et « ${QUEUES.PUSH} » démarrés (§2.5).`);
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all(this.workers.map((w) => w.close()));
    await this.connection?.quit();
  }
}

/**
 * L'adaptateur qui dépose — l'implémentation d'`OutboundQueuePort`.
 *
 * `OUTBOUND_JOB_OPTIONS` tel quel : cinq tentatives, repli exponentiel sur environ
 * une heure. C'est le réglage du §9.2 de `00`, pensé pour qu'un fournisseur
 * indisponible dix minutes ne perde rien, sans réessayer indéfiniment une adresse
 * invalide.
 *
 * `jobId` porte l'identifiant de la ligne `outbound_messages` : deux dépôts pour le
 * même envoi — ce qui arrive si un événement est rejoué entre le COMMIT et la mise
 * en file — ne donnent qu'un seul travail.
 *
 * LE SÉPARATEUR EST UN TIRET, ET CE N'EST PAS UN DÉTAIL DE STYLE. BullMQ refuse un
 * `jobId` qui contient « : », sauf s'il compte EXACTEMENT trois segments — une
 * compatibilité laissée aux anciens travaux répétables, que son propre code marque
 * « TODO: replace this check ». `push:<uuid>` en compte deux : la mise en file
 * levait « Custom Id cannot contain : », l'erreur était journalisée par `enqueue()`
 * et la ligne `outbound_messages` restait éternellement en `QUEUED`.
 *
 * Trouvé en lançant le worker et en appelant l'API, pas en relisant le code : le
 * test d'intégration emploie une file en mémoire, qui n'a pas cette contrainte.
 */
@Injectable()
export class BullOutboundQueue implements OutboundQueuePort {
  constructor(private readonly queues: QueueService) {}

  async enqueueEmail(job: OutboundEmailJob): Promise<void> {
    await this.queues
      .get(QUEUES.EMAIL)
      .add('send', job, { ...OUTBOUND_JOB_OPTIONS, jobId: jobIdOf('email', job.outboundId) });
  }

  async enqueuePush(job: OutboundPushJob): Promise<void> {
    await this.queues
      .get(QUEUES.PUSH)
      .add('send', job, { ...OUTBOUND_JOB_OPTIONS, jobId: jobIdOf('push', job.outboundId) });
  }
}
