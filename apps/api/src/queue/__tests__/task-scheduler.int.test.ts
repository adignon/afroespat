import type { Job } from 'bullmq';
import IORedis, { type Redis } from 'ioredis';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadEnv, resetEnvCache } from '../../config/env';
import { QueueService } from '../queue.service';
import { QUEUES } from '../queues';
import { SCHEDULED_LOCK_PREFIX } from '../scheduled-lock';
import {
  ScheduledTaskRegistry,
  dailyAt,
  retryPolicy,
  type Schedule,
  type ScheduledTaskDefinition,
} from '../scheduled-tasks';
import { TaskSchedulerService } from '../task-scheduler.service';

/**
 * Le planificateur de tâches — §9.3.
 *
 * LA PROPRIÉTÉ CENTRALE de tout ce travail est ici : « plusieurs instances de
 * worker tourneront ; une tâche ne doit s'exécuter qu'UNE fois par créneau ». Elle
 * ne se lit pas dans le code — elle dépend de Redis, de BullMQ et de leur
 * interaction — donc elle se prouve, avec de vrais workers sur une vraie file.
 *
 * DEUX instances de `TaskSchedulerService`, chacune avec sa propre connexion Redis
 * et son propre consommateur BullMQ : c'est la situation de deux conteneurs
 * `APP_ROLE=worker` derrière le même Redis. Le compteur est partagé par le
 * processus de test, ce qui est précisément ce qui permet de le lire ; la
 * vérification à deux PROCESSUS réels a été faite à la main, hors de cette suite.
 *
 * ATTENTION, cette suite REMET À ZÉRO la file `scheduled` du Redis de
 * développement (jobs et planificateurs). C'est le prix de l'isolation : sans
 * cela, des travaux laissés par un worker lancé à la main seraient consommés au
 * milieu du test. Un worker redémarré repose ses planificateurs au démarrage.
 */

/** Une cadence d'une seconde. Bail plancher : 30 s (voir `MIN_LEASE_MS`). */
const CHAQUE_SECONDE: Schedule = { label: 'test 1 s', intervalMs: 1_000, every: 1_000 };

/** Un job BullMQ réduit à ce que `process` en lit. */
const fauxJob = (task: string): Job =>
  ({ name: task, data: { task }, opts: { attempts: 1 } }) as unknown as Job;

const attendre = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

describe('planificateur de tâches — un seul passage par créneau (§9.3)', () => {
  /** Suffixe unique : les clés de verrou vivent jusqu'à 12 h, et Redis est partagé. */
  const marque = `test.ordo.${Date.now().toString(36)}`;
  let redis: Redis;
  let queuesA: QueueService;
  let queuesB: QueueService;
  let registreA: ScheduledTaskRegistry;
  let registreB: ScheduledTaskRegistry;
  let workerA: TaskSchedulerService;
  let workerB: TaskSchedulerService;

  /** Ce que les tâches de test ont fait, par nom. C'est ce qu'on compte. */
  const passages = new Map<string, number>();
  const compter = (task: string): number => {
    const n = (passages.get(task) ?? 0) + 1;
    passages.set(task, n);
    return n;
  };

  const tache = (name: string, schedule: Schedule, handle?: ScheduledTaskDefinition['handle']) => ({
    name,
    module: 'test',
    schedule,
    handle:
      handle ??
      (async (): Promise<number> => {
        const n = compter(name);
        // Un balayage réel n'est pas instantané : ce délai est ce qui rend la
        // concurrence observable. Sans lui, deux travaux pourraient se suivre
        // au lieu de se croiser, et le test ne prouverait rien de la concurrence.
        await attendre(120);
        return n;
      }),
  });

  const CRENEAU = `${marque}.creneau`;
  const ECHEC = `${marque}.echec`;
  const INCONNUE = `${marque}.inconnue`;

  beforeAll(async () => {
    // Le planificateur ne démarre que dans le worker (§3.1). En test, le rôle
    // vient de `.env` (`api`) : on le force ici, puisque c'est le worker qu'on
    // éprouve.
    process.env['APP_ROLE'] = 'worker';
    resetEnvCache();
    expect(loadEnv().APP_ROLE).toBe('worker');

    redis = new IORedis(loadEnv().REDIS_URL, { maxRetriesPerRequest: null });

    registreA = new ScheduledTaskRegistry();
    registreB = new ScheduledTaskRegistry();
    for (const registre of [registreA, registreB]) {
      registre.register(tache(CRENEAU, CHAQUE_SECONDE));
      // Cadence quotidienne : son planificateur BullMQ ne tirera pas pendant le
      // test (prochain créneau à 3 h du matin), donc ces tâches ne sont lancées
      // que par les appels explicites des tests. Un `every` court, lui, aurait
      // ajouté des passages imprévisibles au milieu des assertions.
      registre.register(
        tache(ECHEC, dailyAt(3, 0), () => {
          compter(ECHEC);
          return Promise.reject(new Error('base indisponible'));
        }),
      );
    }

    queuesA = new QueueService();
    queuesB = new QueueService();
    queuesA.onModuleInit();
    queuesB.onModuleInit();

    // Table rase : voir l'en-tête. `obliterate` emporte les travaux ET les
    // planificateurs de la file.
    await queuesA.get(QUEUES.SCHEDULED).obliterate({ force: true });

    workerA = new TaskSchedulerService(registreA, queuesA);
    workerB = new TaskSchedulerService(registreB, queuesB);
    workerA.onApplicationBootstrap();
    workerB.onApplicationBootstrap();
    // `installSchedulers` est lancé sans être attendu (le démarrage du worker ne
    // doit pas en dépendre) : on lui laisse le temps de poser ses clés.
    await attendre(600);
  });

  afterAll(async () => {
    await workerA?.onModuleDestroy();
    await workerB?.onModuleDestroy();
    const keys = await redis.keys(`${SCHEDULED_LOCK_PREFIX}:${marque}*`);
    if (keys.length > 0) await redis.del(...keys);
    await queuesA?.get(QUEUES.SCHEDULED).obliterate({ force: true });
    await queuesA?.onModuleDestroy();
    await queuesB?.onModuleDestroy();
    await redis.quit();
    process.env['APP_ROLE'] = 'api';
    resetEnvCache();
  });

  /**
   * ═══ LE TEST ═══
   *
   * Vingt travaux pour la même tâche, déposés d'un coup, consommés par DEUX
   * workers à concurrence 4. Un seul passage.
   *
   * Vingt travaux DISTINCTS, et c'est le point : la déduplication de BullMQ par
   * `jobId` ne les verrait pas comme des doublons, et ne protège donc de rien
   * ici. Or c'est exactement la forme que prennent les cas réels — un travail
   * « bloqué » redistribué, une reprise, deux workers qui se recouvrent pendant un
   * déploiement. Seul le verrou Redis les arrête.
   */
  it('vingt travaux, deux workers, UN seul passage', async () => {
    const queue = queuesA.get(QUEUES.SCHEDULED);
    // Le planificateur d'une seconde a déjà tiré pendant le démarrage : on repart
    // d'un créneau vierge, sinon on mesurerait son passage à lui.
    await redis.del(`${SCHEDULED_LOCK_PREFIX}:${CRENEAU}`);
    passages.delete(CRENEAU);

    const ids = Array.from({ length: 20 }, (_, i) => `${CRENEAU}-${i}`);
    await queue.addBulk(
      ids.map((jobId) => ({
        name: CRENEAU,
        data: { task: CRENEAU },
        opts: { jobId, attempts: 1, removeOnComplete: true, removeOnFail: true },
      })),
    );

    // On attend que les VINGT soient sortis de la file, plutôt qu'un délai fixe :
    // un délai trop court rendrait le test vert sans avoir rien consommé.
    const limite = Date.now() + 20_000;
    let restants = ids.length;
    while (Date.now() < limite && restants > 0) {
      const jobs = await Promise.all(ids.map((id) => queue.getJob(id)));
      restants = jobs.filter((j) => j !== undefined).length;
      if (restants > 0) await attendre(100);
    }
    expect(restants, 'les vingt travaux n’ont pas été consommés').toBe(0);

    expect(passages.get(CRENEAU) ?? 0).toBe(1);
  });

  /**
   * Et la preuve que le test précédent n'est pas vide.
   *
   * Le même gestionnaire, vingt fois, en contournant le planificateur et donc le
   * verrou : vingt passages. C'est la mesure de ce que le verrou empêche — et ce
   * que le test précédent verrait si on le retirait.
   */
  it('sans le verrou, les mêmes vingt appels donnent vingt passages', async () => {
    const task = `${marque}.sansverrou`;
    registreA.register(tache(task, dailyAt(3, 0)));

    await Promise.all(Array.from({ length: 20 }, () => registreA.run(task)));
    expect(passages.get(task)).toBe(20);
  });

  /**
   * Le second travail est IGNORÉ, pas mis en échec.
   *
   * Lever ferait réessayer BullMQ, et le journal du worker se remplirait d'échecs
   * pour un comportement voulu. `skipped` est la bonne réponse : rien à faire,
   * quelqu'un l'a fait.
   */
  it('dit explicitement qu’un créneau déjà pris est ignoré', async () => {
    const task = `${marque}.ignore`;
    for (const registre of [registreA, registreB]) registre.register(tache(task, dailyAt(3, 0)));

    const premier = await workerA.process(fauxJob(task));
    const second = await workerB.process(fauxJob(task));

    expect(premier.skipped).toBeUndefined();
    expect(premier.summary).toBe('1');
    // L'AUTRE worker, avec sa propre connexion Redis : c'est la situation réelle.
    expect(second.skipped).toBe(true);
    expect(passages.get(task)).toBe(1);
  });

  /**
   * Le bail est GARDÉ après un succès, et c'est ce qui distingue ce verrou d'un
   * mutex.
   *
   * Un mutex relâché en fin d'exécution laisserait un travail redistribué qui
   * arrive APRÈS la fin du premier refaire tout le créneau. Ici, la clé tient
   * jusqu'à la fin du créneau : le second passage est refusé même une fois le
   * premier terminé.
   */
  it('garde le bail après un succès : un travail tardif ne refait pas le créneau', async () => {
    const task = `${marque}.tardif`;
    for (const registre of [registreA, registreB]) registre.register(tache(task, dailyAt(3, 0)));

    await workerA.process(fauxJob(task));
    // Le premier a fini — un mutex serait libre à cet instant précis.
    await attendre(150);
    expect((await workerB.process(fauxJob(task))).skipped).toBe(true);
    expect(passages.get(task)).toBe(1);

    const restant = await redis.pttl(`${SCHEDULED_LOCK_PREFIX}:${task}`);
    // Bail d'une tâche quotidienne : douze heures, plafonné (voir `leaseMs`).
    expect(restant).toBeGreaterThan(11 * 3_600_000);
  });

  /**
   * Et le pendant indispensable : le bail est RELÂCHÉ sur échec.
   *
   * Sans cela, la reprise à dix minutes des tâches quotidiennes se heurterait au
   * bail de douze heures que la tentative en échec vient de poser : les trois
   * tentatives de `retryPolicy` seraient une fiction, et un échec passager
   * coûterait une journée entière.
   */
  it('relâche le bail sur échec, pour que la reprise puisse passer', async () => {
    passages.delete(ECHEC);

    await expect(workerA.process(fauxJob(ECHEC))).rejects.toThrow(/base indisponible/);
    // La clé ne doit plus être là.
    expect(await redis.exists(`${SCHEDULED_LOCK_PREFIX}:${ECHEC}`)).toBe(0);

    // La reprise — ou l'autre worker — repasse bien.
    await expect(workerB.process(fauxJob(ECHEC))).rejects.toThrow(/base indisponible/);
    expect(passages.get(ECHEC)).toBe(2);
    // Et la politique annoncée est bien celle d'une cadence quotidienne.
    expect(retryPolicy(dailyAt(3, 0)).attempts).toBe(3);
  });

  /**
   * Un travail dont plus aucune tâche ne porte le nom n'est PAS une erreur.
   *
   * Il arrive à chaque renommage : le planificateur vit dans Redis, et un travail
   * déjà en file lui survit. Lever ferait échouer en boucle une tâche qui n'existe
   * plus.
   */
  it('ignore un travail sans tâche correspondante, sans lever', async () => {
    const resultat = await workerA.process(fauxJob(INCONNUE));
    expect(resultat).toEqual({ task: INCONNUE, skipped: true });
    // Et sans poser de verrou pour rien.
    expect(await redis.exists(`${SCHEDULED_LOCK_PREFIX}:${INCONNUE}`)).toBe(0);
  });

  /**
   * L'horloge vit dans Redis, pas dans le processus.
   *
   * C'est ce qui fait qu'un worker redémarré ne perd pas la cadence, et que deux
   * workers qui déclarent les mêmes tâches produisent UN planificateur par tâche —
   * pas un par worker. `upsert` est ce qui le garantit ; un `setInterval` par
   * processus aurait donné deux déclenchements par créneau.
   */
  it('pose UN planificateur par tâche, même déclaré par deux workers', async () => {
    const schedulers = await queuesA.get(QUEUES.SCHEDULED).getJobSchedulers();
    const parNom = schedulers.filter((s) => s.key.startsWith(marque));

    expect(parNom.map((s) => s.key)).toEqual(expect.arrayContaining([CRENEAU, ECHEC]));
    // `every` revient de Redis, donc en chaîne selon la version : on compare la
    // valeur, pas sa représentation.
    expect(Number(parNom.find((s) => s.key === CRENEAU)?.every)).toBe(1_000);
    // La cadence quotidienne passe par un patron cron, dans le fuseau de la
    // plateforme — « 3 h du matin » se lit à Paris, pas en UTC.
    expect(parNom.find((s) => s.key === ECHEC)?.pattern).toBe('0 3 * * *');
    expect(parNom.find((s) => s.key === ECHEC)?.tz).toBe(loadEnv().DEFAULT_TIMEZONE);
  });

  /**
   * Un planificateur ORPHELIN est retiré au démarrage.
   *
   * Sans cette réconciliation, une tâche renommée continuerait à tirer
   * indéfiniment depuis Redis, et son travail échouerait à chaque créneau — dans
   * un code où plus personne ne trouverait son nom.
   */
  it('retire les planificateurs qui n’ont plus de tâche', async () => {
    const orphelin = `${marque}.orphelin`;
    await queuesA
      .get(QUEUES.SCHEDULED)
      .upsertJobScheduler(orphelin, { pattern: '0 3 * * *' }, { name: orphelin, data: {} });
    expect(
      (await queuesA.get(QUEUES.SCHEDULED).getJobSchedulers()).some((s) => s.key === orphelin),
    ).toBe(true);

    // Un redémarrage de worker, et rien d'autre.
    const relance = new TaskSchedulerService(registreA, queuesA);
    relance.onApplicationBootstrap();
    await attendre(800);
    await relance.onModuleDestroy();

    expect(
      (await queuesA.get(QUEUES.SCHEDULED).getJobSchedulers()).some((s) => s.key === orphelin),
    ).toBe(false);
  });

  /**
   * L'interrupteur du runbook §5 : couper les balayages sans couper le worker.
   *
   * Un test court, mais il éprouve la seule chose qu'on veut de cet interrupteur —
   * qu'il n'installe RIEN. Un planificateur posé puis ignoré aurait fait s'empiler
   * les travaux, et le retour à `true` aurait déclenché vingt-sept balayages d'un
   * coup.
   */
  it('n’installe rien quand SCHEDULER_ENABLED est faux', async () => {
    process.env['SCHEDULER_ENABLED'] = 'false';
    resetEnvCache();

    const registre = new ScheduledTaskRegistry();
    const task = `${marque}.coupe`;
    registre.register(tache(task, dailyAt(3, 0)));
    const coupe = new TaskSchedulerService(registre, queuesA);
    coupe.onApplicationBootstrap();
    await attendre(300);
    await coupe.onModuleDestroy();

    expect(
      (await queuesA.get(QUEUES.SCHEDULED).getJobSchedulers()).some((s) => s.key === task),
    ).toBe(false);

    delete process.env['SCHEDULER_ENABLED'];
    resetEnvCache();
  });
});
