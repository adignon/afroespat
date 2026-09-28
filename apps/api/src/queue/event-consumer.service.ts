import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { Worker } from 'bullmq';
import IORedis, { type Redis } from 'ioredis';
import { loadEnv } from '../config/env';
import { type DomainEventJob, EventHandlerRegistry } from './event-handlers';
import { QUEUES } from './queues';

/**
 * Le consommateur de la file d'événements — 00-fondations.md §9.2.
 *
 * Il ne tourne QUE dans le worker (`APP_ROLE=worker`). Le faire tourner aussi
 * dans l'API multiplierait les consommateurs par le nombre d'instances HTTP, et
 * un déploiement en pleine analyse de contenu couperait le travail en cours.
 *
 * `concurrency: 5` : les gestionnaires écrivent en base, et une concurrence plus
 * haute ne ferait qu'allonger la file d'attente du pool de connexions Prisma. Ce
 * n'est pas un réglage de performance, c'est une borne.
 *
 * Sa propre connexion Redis : BullMQ l'exige pour un consommateur — une connexion
 * en mode bloquant ne peut pas servir aussi de productrice.
 *
 * LE MOMENT DE DÉMARRAGE compte, et ma première version l'avait raté.
 *
 * `QueueModule` est global, donc son `onModuleInit` tourne AVANT celui des
 * providers du module racine — dont le câblage des abonnements. Le consommateur
 * démarrait alors sur un registre vide. Or `dispatch` sort silencieusement quand
 * aucun gestionnaire n'écoute, et BullMQ marque le travail TERMINÉ : tout
 * événement arrivé dans cet intervalle était perdu, sans trace.
 *
 * `onApplicationBootstrap` ne se déclenche qu'après tous les `onModuleInit`. Le
 * consommateur ne démarre donc qu'une fois les abonnements en place, et le
 * journal de démarrage dit enfin la vérité sur qui écoute quoi.
 */
@Injectable()
export class EventConsumerService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(EventConsumerService.name);
  private connection?: Redis;
  private worker?: Worker;

  constructor(private readonly registry: EventHandlerRegistry) {}

  onApplicationBootstrap(): void {
    const env = loadEnv();
    if (env.APP_ROLE !== 'worker') return;

    this.connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });

    this.worker = new Worker(
      QUEUES.EVENTS,
      async (job) => {
        await this.registry.dispatch(job.data as DomainEventJob);
      },
      { connection: this.connection, concurrency: 5 },
    );

    // Un échec est JOURNALISÉ ici, et non avalé dans le gestionnaire : BullMQ
    // rejoue jusqu'à dix fois, et sans cette trace un événement qui échoue à
    // chaque tentative finirait en échec définitif sans que rien ne le dise.
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
      this.logger.error(`file ${QUEUES.EVENTS} : ${error.message}`);
    });

    this.worker.on('failed', (job, error) => {
      this.logger.error(
        `événement ${job?.name ?? '?'} (${job?.id ?? '?'}) — tentative ` +
          `${job?.attemptsMade ?? 0} : ${error.message}`,
      );
    });

    const subscriptions = this.registry.describe();
    if (subscriptions.length === 0) {
      // Désormais fiable : à ce stade, tous les abonnements sont posés. Un
      // registre vide ici signifie vraiment que le worker viderait la file pour
      // rien — ce qui perdrait les événements.
      this.logger.warn('Aucun gestionnaire abonné : la file `events` sera vidée sans effet.');
    } else {
      this.logger.log(`Consommateur d’événements prêt — ${subscriptions.length} type(s) écouté(s)`);
      for (const line of subscriptions) this.logger.log(`  ${line}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    // Fermeture ORDONNÉE : `close()` attend la fin des travaux en cours plutôt
    // que de les abandonner à mi-chemin. Un événement interrompu serait rejoué,
    // mais un gestionnaire coupé au milieu d'une transaction non validée laisse
    // un état que personne n'a voulu.
    await this.worker?.close();
    await this.connection?.quit();
  }
}
