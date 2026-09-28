import IORedis, { type Redis } from 'ioredis';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { loadEnv } from '../../config/env';
import { ScheduledTaskLock } from '../scheduled-lock';

/**
 * Le verrou Redis des tâches planifiées — §9.3.
 *
 * Contre un VRAI Redis, parce que tout ce que ce fichier éprouve est de
 * l'atomicité : un `SET NX PX` et deux scripts Lua. Une fausse implémentation de
 * Redis vérifierait que j'ai écrit ce que j'ai écrit, pas que Redis se comporte
 * comme je le crois.
 *
 * Les baux sont volontairement COURTS (quelques centaines de millisecondes) :
 * l'expiration fait partie du mécanisme, et on ne peut pas la vérifier sans
 * l'attendre.
 */
describe('verrou des tâches planifiées (§9.3)', () => {
  let redis: Redis;
  let lock: ScheduledTaskLock;
  const prefix = `test:scheduled:lock:${Date.now()}`;
  const task = 'test.verrou';

  beforeAll(() => {
    redis = new IORedis(loadEnv().REDIS_URL, { maxRetriesPerRequest: null });
    // Préfixe propre à l'exécution : la base Redis est partagée avec les files
    // BullMQ et avec les autres suites, et un test qui écrase la clé d'un autre
    // produit un échec que personne ne peut reproduire.
    lock = new ScheduledTaskLock(redis, prefix);
  });

  afterAll(async () => {
    const keys = await redis.keys(`${prefix}*`);
    if (keys.length > 0) await redis.del(...keys);
    await redis.quit();
  });

  beforeEach(async () => {
    await redis.del(lock.key(task));
  });

  /**
   * LE test central, et la propriété que §9.3 exige.
   *
   * Deux workers demandent le même créneau. Un seul l'obtient. Sans le `NX` du
   * `SET`, les deux l'obtiendraient — et `expireStories` passerait deux fois.
   */
  it('un seul détenteur à la fois : le second n’obtient RIEN', async () => {
    const premier = await lock.acquire(task, 5_000);
    const second = await lock.acquire(task, 5_000);

    expect(premier).not.toBeNull();
    expect(second).toBeNull();
  });

  it('et le cas concurrent, dix demandes simultanées : une seule réussit', async () => {
    // Séquentiellement, le test précédent suffirait. En parallèle, il éprouve
    // l'atomicité côté Redis : un `EXISTS` suivi d'un `SET` aurait la même
    // apparence dans le code et laisserait passer plusieurs détenteurs ici.
    const results = await Promise.all(
      Array.from({ length: 10 }, () => lock.acquire('test.verrou.course', 5_000)),
    );
    expect(results.filter((r) => r !== null)).toHaveLength(1);
    await redis.del(lock.key('test.verrou.course'));
  });

  it('libère le créneau sur demande, et un autre worker peut alors passer', async () => {
    const premier = await lock.acquire(task, 5_000);
    expect(premier).not.toBeNull();

    // C'est le chemin de l'ÉCHEC : le créneau n'a pas été fait, la reprise doit
    // pouvoir passer.
    expect(await premier?.release()).toBe(true);
    expect(await lock.acquire(task, 5_000)).not.toBeNull();
  });

  /**
   * La libération est un COMPARE-ET-SUPPRIME, et pas un simple `DEL`.
   *
   * Le défaut que cela évite ne se verrait qu'en charge : mon bail expire, un
   * autre worker prend la clé, puis mon `release()` arrive. Avec un `DEL`, je
   * supprimerais SON verrou, et un troisième worker partirait sur un créneau déjà
   * en cours. Le jeton est ce qui rend la distinction possible.
   */
  it('ne libère JAMAIS le bail d’un autre détenteur', async () => {
    const perdu = await lock.acquire(task, 120);
    expect(perdu).not.toBeNull();

    await new Promise((resolve) => setTimeout(resolve, 200));
    const suivant = await lock.acquire(task, 5_000);
    expect(suivant).not.toBeNull();

    // Le détenteur périmé rend la main : il ne doit PAS emporter la clé du suivant.
    expect(await perdu?.release()).toBe(false);
    expect(await redis.get(lock.key(task))).toBe(suivant?.token);
    // Et la preuve que ça compte : personne d'autre ne peut entrer.
    expect(await lock.acquire(task, 5_000)).toBeNull();
  });

  it('prolonge le bail pendant une exécution longue', async () => {
    const bail = await lock.acquire(task, 200);
    expect(bail).not.toBeNull();

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(await bail?.renew(3_000)).toBe(true);
    // Sans renouvellement, la clé serait tombée ici et un second worker aurait pu
    // lancer le même balayage pendant que le premier tournait encore.
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(await lock.acquire(task, 5_000)).toBeNull();
    expect(await lock.remainingMs(task)).toBeGreaterThan(1_000);
  });

  it('refuse de prolonger un bail qu’on n’a plus, sans voler celui du voisin', async () => {
    const perdu = await lock.acquire(task, 120);
    await new Promise((resolve) => setTimeout(resolve, 200));
    const suivant = await lock.acquire(task, 400);

    // `false` est l'information dont le planificateur a besoin : la tâche en cours
    // n'est plus protégée, et il doit le journaliser plutôt que de le supposer.
    expect(await perdu?.renew(60_000)).toBe(false);
    expect(await lock.remainingMs(task)).toBeLessThanOrEqual(400);
    expect(await redis.get(lock.key(task))).toBe(suivant?.token);
  });

  /**
   * Le bail EXPIRE de lui-même.
   *
   * C'est ce qui empêche un worker mort de bloquer une tâche pour toujours : le
   * créneau suivant repassera. Un mutex sans expiration, tenu par un processus
   * tué, arrêterait la tâche définitivement — et personne ne le remarquerait
   * avant plusieurs jours.
   */
  it('expire de lui-même : un worker mort ne bloque pas la tâche', async () => {
    const bail = await lock.acquire(task, 150);
    expect(bail).not.toBeNull();
    // On ne relâche RIEN, comme un processus tué en pleine exécution.
    await new Promise((resolve) => setTimeout(resolve, 250));

    expect(await lock.acquire(task, 5_000)).not.toBeNull();
  });

  it('un jeton par bail : deux détenteurs successifs n’en partagent pas', async () => {
    const premier = await lock.acquire(task, 5_000);
    await premier?.release();
    const second = await lock.acquire(task, 5_000);

    expect(premier?.token).not.toBe(second?.token);
  });

  it('isole les tâches les unes des autres', async () => {
    // Une seule clé par tâche : `story.expire` tenue ne doit rien empêcher à
    // `help.archive`, sinon la concurrence 4 du planificateur ne servirait à rien.
    const a = await lock.acquire('test.a', 5_000);
    const b = await lock.acquire('test.b', 5_000);
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    await a?.release();
    await b?.release();
  });
});
