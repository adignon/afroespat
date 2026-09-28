import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { Worker, type Job } from 'bullmq';
import IORedis, { type Redis } from 'ioredis';
import { loadEnv } from '../config/env';
import { QueueService } from './queue.service';
import { QUEUES } from './queues';
import { ScheduledTaskLock, type ScheduledLease } from './scheduled-lock';
import { ScheduledTaskRegistry, leaseMs, retryPolicy } from './scheduled-tasks';

/**
 * Le planificateur des tâches de §9.3.
 *
 * Il ne tourne QUE dans le worker (`APP_ROLE=worker`), pour la même raison que le
 * consommateur d'événements : le faire tourner aussi dans l'API multiplierait les
 * consommateurs par le nombre d'instances HTTP.
 *
 * DEUX MÉCANISMES, et ils ne font pas le même travail.
 *
 *   · **les planificateurs de travaux BullMQ** (`upsertJobScheduler`) tiennent
 *     l'HORLOGE. La cadence vit dans Redis, donc elle survit au redémarrage du
 *     worker, et `upsert` est idempotent : trois instances qui déclarent les
 *     mêmes vingt-six tâches produisent vingt-six planificateurs, pas
 *     soixante-dix-huit. Un `setInterval` par tâche dans chaque processus, lui,
 *     aurait donné trois déclenchements par créneau et aucune trace de l'horloge.
 *
 *   · **le verrou Redis** (`ScheduledTaskLock`) tient l'EXÉCUTION. Voir l'en-tête
 *     de `scheduled-lock.ts` pour le détail : la déduplication de BullMQ porte
 *     sur la mise en file, et un travail redistribué pour cause de blocage, une
 *     reprise, ou le recouvrement de deux workers pendant un déploiement
 *     échappent tous les trois à cette garantie.
 *
 * UNE TÂCHE = UN TRAVAIL, et c'est ce qui donne l'isolation gratuitement : un
 * balayage qui lève ne touche pas les vingt-cinq autres, chacun étant son propre
 * travail dans la file. Un travail unique « lance tout ce qui est dû » aurait
 * demandé de rattraper les exceptions à la main — et aurait fait tenir un seul
 * verrou pour vingt-six balayages.
 *
 * LE MOMENT DE DÉMARRAGE, leçon déjà payée par `EventConsumerService` :
 * `onApplicationBootstrap` et non `onModuleInit`. `QueueModule` est global, donc
 * son `onModuleInit` précède celui du câblage — le planificateur démarrerait sur
 * un registre vide, ne poserait aucun travail répétable, et rien ne le dirait.
 */
@Injectable()
export class TaskSchedulerService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(TaskSchedulerService.name);
  private connection?: Redis;
  private worker?: Worker;
  private lock?: ScheduledTaskLock;

  constructor(
    private readonly registry: ScheduledTaskRegistry,
    private readonly queues: QueueService,
  ) {}

  /**
   * Plafond de renouvellement du bail.
   *
   * Le bail se renouvelle tant que la tâche tourne, sinon un balayage plus long
   * que son bail perdrait sa protection en cours de route. Mais renouveler SANS
   * FIN transformerait une tâche bloquée en verrou éternel : plus personne ne
   * reprendrait ce créneau, et la tâche serait morte en silence — exactement le
   * défaut qu'on répare. Au-delà de trente minutes, on cesse de renouveler et on
   * le journalise en erreur : aucun de ces balayages n'a de raison légitime de
   * durer autant, et le journal doit le crier.
   */
  private static readonly MAX_RUN_MS = 30 * 60_000;

  onApplicationBootstrap(): void {
    const env = loadEnv();
    if (env.APP_ROLE !== 'worker') return;

    if (!env.SCHEDULER_ENABLED) {
      // Interrupteur d'exploitation : couper les balayages sans couper le worker,
      // le temps d'un incident de base. Les consommateurs de files, eux, continuent.
      this.logger.warn('SCHEDULER_ENABLED=false — aucune tâche planifiée ne sera déclenchée.');
      return;
    }

    const tasks = this.registry.all();
    if (tasks.length === 0) {
      // À ce stade le câblage est posé : un registre vide veut vraiment dire que
      // rien ne tournera. Le dire fort, parce que le symptôme (« les stories
      // n'expirent pas ») apparaîtrait des jours plus tard, ailleurs.
      this.logger.error('Aucune tâche planifiée enregistrée : §9.3 ne sera pas appliqué.');
      return;
    }

    // Sa propre connexion : BullMQ l'exige d'un consommateur, dont une commande
    // bloquante ne peut pas servir aussi de productrice.
    this.connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
    // Le verrou, lui, n'émet que des commandes courtes : il partage la connexion
    // des producteurs, plutôt que d'en ouvrir une troisième par worker.
    this.lock = new ScheduledTaskLock(this.queues.redis);

    this.worker = new Worker(
      QUEUES.SCHEDULED,
      (job) => this.process(job),
      {
        connection: this.connection,
        /**
         * Quatre balayages à la fois.
         *
         * Ce n'est pas un réglage de performance mais une borne : quinze tâches
         * quotidiennes sont posées dans la même tranche nocturne, et les laisser
         * toutes partir ensemble mettrait quinze balayages en concurrence sur le
         * bassin de connexions Prisma. Aucune n'est urgente à la seconde ; les
         * sérialiser quatre par quatre les fait toutes passer, plus lentement et
         * sans saturer personne.
         */
        concurrency: 4,
      },
    );

    // Journalisé ici, et non avalé dans la tâche : une tâche à cadence courte
    // n'a qu'UNE tentative (voir `retryPolicy`), donc sans cette ligne un
    // balayage qui échoue tous les quarts d'heure ne laisserait aucune trace.
    this.worker.on('failed', (job, error) => {
      this.logger.error(
        `tâche ${job?.name ?? '?'} — tentative ${job?.attemptsMade ?? 0}/` +
          `${job?.opts.attempts ?? 1} : ${error.message}`,
      );
    });

    // Un `error` d'émetteur SANS écouteur devient une exception non rattrapée, et
    // tue le processus : le worker perdrait ses consommateurs de files en même
    // temps que ses tâches, pour une coupure Redis passagère dont BullMQ se
    // relève seul. (`EventConsumerService` porte le même manque — signalé.)
    this.worker.on('error', (error) => {
      this.logger.error(`file scheduled : ${error.message}`);
    });

    void this.installSchedulers();
  }

  async onModuleDestroy(): Promise<void> {
    // `close()` attend la fin du balayage en cours. L'interrompre laisserait un
    // bail posé sur un créneau à moitié fait — et le bail, lui, n'est relâché que
    // sur échec constaté.
    await this.worker?.close();
    await this.connection?.quit();
  }

  /**
   * Pose un planificateur BullMQ par tâche, et retire ceux qui n'ont plus de
   * tâche.
   *
   * LE RETRAIT compte autant que la pose. Un planificateur vit dans Redis, pas
   * dans le code : une tâche renommée ou supprimée continuerait à tirer
   * indéfiniment, et son travail échouerait à chaque créneau sur « tâche
   * inconnue ». Redis est la source de vérité de l'horloge, le code celle de la
   * liste — les réconcilier au démarrage est la seule façon qu'un déploiement
   * suffise.
   */
  private async installSchedulers(): Promise<void> {
    const queue = this.queues.get(QUEUES.SCHEDULED);
    const env = loadEnv();

    try {
      for (const task of this.registry.all()) {
        const { attempts, backoffMs } = retryPolicy(task.schedule);
        await queue.upsertJobScheduler(
          task.name,
          'every' in task.schedule
            ? { every: task.schedule.every }
            : // Le fuseau est celui de la plateforme : « lundi 8 h » et « 3 h du
              // matin » se lisent à Paris, pas en UTC — deux heures d'écart en
              // été, ce qui déplacerait une tâche nocturne en pleine soirée.
              { pattern: task.schedule.pattern, tz: env.DEFAULT_TIMEZONE },
          {
            name: task.name,
            data: { task: task.name },
            opts: {
              attempts,
              ...(backoffMs > 0
                ? { backoff: { type: 'exponential' as const, delay: backoffMs } }
                : {}),
              // Sans bornes, la liste des travaux terminés grossit indéfiniment
              // dans Redis — 26 tâches, dont une toutes les 5 minutes.
              removeOnComplete: { age: 86_400 * 7, count: 500 },
              removeOnFail: { age: 86_400 * 30 },
            },
          },
        );
      }

      const known = new Set(this.registry.all().map((t) => t.name));
      for (const scheduler of await queue.getJobSchedulers()) {
        if (!known.has(scheduler.key)) {
          await queue.removeJobScheduler(scheduler.key);
          this.logger.warn(`Planificateur obsolète retiré : ${scheduler.key}`);
        }
      }

      this.logger.log(`Planificateur prêt — ${this.registry.all().length} tâche(s) de §9.3 :`);
      for (const line of this.registry.describe()) this.logger.log(`  ${line}`);
    } catch (error) {
      // Lever ici tuerait le worker après son démarrage, et les consommateurs de
      // files avec lui. On journalise : sans horloge, les tâches ne tournent pas,
      // mais les événements continuent d'être distribués.
      this.logger.error(
        `Pose des planificateurs impossible — aucune tâche ne tournera : ` +
          `${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Un créneau.
   *
   * Rendu public pour être éprouvable : c'est le cœur de tout ce fichier, et un
   * test qui doit lever un vrai worker BullMQ pour l'atteindre est un test qu'on
   * n'écrit pas.
   */
  async process(job: Job): Promise<{ task: string; skipped?: true; durationMs?: number; summary?: string }> {
    const data = job.data as { task?: unknown } | null;
    const name = typeof data?.task === 'string' ? data.task : job.name;

    const task = this.registry.get(name);
    if (task === undefined) {
      // On NE LÈVE PAS : un travail resté d'un déploiement antérieur n'a rien à
      // faire et lever le ferait échouer en boucle. `installSchedulers` retire
      // son planificateur ; ceci ne concerne que les travaux déjà en file.
      this.logger.warn(`Travail planifié sans tâche correspondante, ignoré : ${name}`);
      return { task: name, skipped: true };
    }

    const lease = await this.acquire(task.name, leaseMs(task.schedule));
    if (lease === null) {
      // Cas NORMAL avec plusieurs workers : une autre instance tient le créneau,
      // ou l'a déjà traité. En `debug` parce que, sur `story.expire`, deux
      // workers sur trois écriraient cette ligne toutes les cinq minutes.
      this.logger.debug(`${task.name} — créneau déjà pris, passage ignoré`);
      return { task: task.name, skipped: true };
    }

    const renewal = this.startRenewal(lease, task.name, leaseMs(task.schedule));

    try {
      const run = await this.registry.run(task.name, new Date());
      // SUCCÈS : le bail n'est PAS relâché. Il expire de lui-même à la fin du
      // créneau, et interdit d'ici là qu'un travail redistribué refasse le même
      // balayage. C'est la propriété centrale — voir `scheduled-lock.ts`.
      return { task: run.task, durationMs: run.durationMs, summary: run.summary };
    } catch (error) {
      // ÉCHEC : le créneau n'a pas été fait. On rend la clé, sinon la reprise à
      // dix minutes des tâches quotidiennes se heurterait au bail de douze heures
      // que cette tentative vient de poser, et les trois tentatives annoncées par
      // `retryPolicy` seraient une fiction.
      await lease.release().catch(() => false);
      throw error;
    } finally {
      clearInterval(renewal);
    }
  }

  /** Isolé pour que `process` reste lisible, et pour que l'absence de verrou se voie. */
  private async acquire(task: string, ms: number): Promise<ScheduledLease | null> {
    if (this.lock === undefined) {
      // Ne devrait pas arriver : `process` n'est atteignable qu'après
      // `onApplicationBootstrap`. Refuser est le bon défaut — exécuter sans
      // verrou vaudrait moins que ne pas exécuter du tout.
      throw new Error(`Verrou indisponible : ${task} n’a pas été lancée.`);
    }
    return this.lock.acquire(task, ms);
  }

  /**
   * Prolonge le bail pendant l'exécution, au tiers de sa durée.
   *
   * Au tiers, et non à la moitié : un renouvellement manqué (un aller-retour
   * Redis perdu) laisse deux tentatives avant l'expiration. À la moitié, il n'en
   * laisse qu'une, et un balayage long perdrait sa protection sur un seul
   * incident réseau.
   */
  private startRenewal(lease: ScheduledLease, task: string, ms: number): NodeJS.Timeout {
    const startedAt = Date.now();
    const timer = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      if (elapsed > TaskSchedulerService.MAX_RUN_MS) {
        clearInterval(timer);
        this.logger.error(
          `${task} tourne depuis ${Math.round(elapsed / 60_000)} min : renouvellement du ` +
            'verrou arrêté. Le créneau sera repris — vérifier ce qui bloque.',
        );
        return;
      }
      void lease.renew(ms).then((ok) => {
        if (!ok) {
          clearInterval(timer);
          // Le bail a changé de main ou expiré : la tâche en cours n'est plus
          // protégée. On ne peut plus l'arrêter proprement, mais on doit le dire.
          this.logger.warn(`${task} — verrou perdu en cours d’exécution.`);
        }
      });
    }, Math.max(1_000, Math.round(ms / 3)));
    timer.unref();
    return timer;
  }
}
