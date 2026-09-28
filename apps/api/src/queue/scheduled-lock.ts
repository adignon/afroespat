import type { Redis } from 'ioredis';

/**
 * Le verrou Redis des tâches planifiées — 00-fondations.md §9.3 : « Toutes les
 * tâches sont idempotentes et protégées par un verrou Redis. »
 *
 * POURQUOI UN VERROU EXPLICITE, alors que BullMQ déduplique déjà.
 *
 * BullMQ garantit qu'un planificateur de travaux (`upsertJobScheduler`) ne pose
 * QU'UN travail par créneau, quel que soit le nombre d'instances qui l'ont
 * déclaré : la clé est déterministe, et le second `upsert` écrase le premier au
 * lieu d'ajouter. Cette garantie porte sur la MISE EN FILE. Elle est réelle, et
 * elle ne suffit pas, pour trois raisons distinctes :
 *
 *   1. **le travail « bloqué ».** Un consommateur qui ne renouvelle pas son
 *      verrou de travail dans `stalledInterval` (30 s par défaut) voit son travail
 *      redistribué — BullMQ le documente. Or « ne pas renouveler » n'est pas « être
 *      mort » : une requête Prisma synchrone longue, un ramasse-miettes, une
 *      machine chargée suffisent. `community.member_count_recompute` est un
 *      `UPDATE … FROM (SELECT … GROUP BY)` sur toute la table ; pendant qu'il
 *      tourne, un second consommateur peut recevoir le même travail et lancer le
 *      même `UPDATE`. Deux balayages concurrents de la même table, c'est le cas
 *      que §9.3 nomme.
 *
 *   2. **les reprises.** Une tentative est une seconde exécution, par construction.
 *      La déduplication à la mise en file n'a rien à dire là-dessus.
 *
 *   3. **le déploiement.** Pendant les quelques secondes où l'ancien worker
 *      termine et le nouveau démarre, deux processus consomment la même file.
 *
 * Le verrou porte donc sur l'EXÉCUTION, là où BullMQ porte sur la mise en file.
 * Les deux se complètent ; aucun des deux ne remplace l'autre.
 *
 * CE N'EST PAS UN MUTEX, et c'est le point de conception.
 *
 * Un mutex relâché en fin d'exécution interdirait la concurrence mais pas le
 * second passage : un travail redistribué qui arrive APRÈS la fin du premier
 * trouverait le verrou libre et referait le créneau. La clé est donc gardée
 * jusqu'à l'expiration de son bail — voir `leaseMs` dans `scheduled-tasks.ts`.
 * Une seule clé donne ainsi les deux propriétés : exclusion pendant l'exécution,
 * et un seul passage par créneau.
 *
 * Elle est en revanche RELÂCHÉE sur échec : le créneau n'a pas été fait, et une
 * reprise doit pouvoir passer. C'est `release()`, que le planificateur n'appelle
 * que dans son `catch`.
 */

/** Préfixe de clé. Distinct par nature des clés BullMQ, qui vivent sous `bull:`. */
export const SCHEDULED_LOCK_PREFIX = 'afroespat:scheduled:lock';

/**
 * Libère la clé SI elle nous appartient encore.
 *
 * Le `GET` puis `DEL` en deux commandes serait faux, et le défaut ne se verrait
 * qu'en charge : entre les deux, notre bail peut expirer et une autre instance
 * prendre la clé — on supprimerait alors SON verrou, et deux exécutions
 * partiraient. Lua rend la séquence atomique. C'est le motif classique, et le
 * jeton est ce qui le rend possible : sans lui, aucune commande ne peut
 * distinguer « ma clé » de « la clé de quelqu'un d'autre ».
 */
const RELEASE_SCRIPT = `
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('del', KEYS[1])
end
return 0
`;

/** Même prudence pour le renouvellement : prolonger la clé d'un autre serait pire. */
const RENEW_SCRIPT = `
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('pexpire', KEYS[1], ARGV[2])
end
return 0
`;

/** Un bail obtenu. Ne peut être créé que par `ScheduledTaskLock.acquire`. */
export interface ScheduledLease {
  /** Le jeton du détenteur. Identifie le bail ; deux baux n'en partagent jamais un. */
  readonly token: string;
  readonly key: string;
  /**
   * Prolonge le bail. `false` signifie qu'on ne l'a plus — et alors la tâche en
   * cours n'est PLUS protégée, ce que l'appelant doit savoir plutôt que supposer.
   */
  renew(ms: number): Promise<boolean>;
  /** Rend la clé. `false` si le bail avait déjà expiré ou changé de main. */
  release(): Promise<boolean>;
}

export class ScheduledTaskLock {
  constructor(
    private readonly redis: Redis,
    private readonly prefix: string = SCHEDULED_LOCK_PREFIX,
  ) {}

  key(task: string): string {
    return `${this.prefix}:${task}`;
  }

  /**
   * Tente de prendre le créneau. `null` veut dire « une autre instance l'a, ou
   * l'a déjà fait » — un cas NORMAL, pas une erreur : c'est exactement ce que le
   * verrou existe pour produire quand trois workers tournent.
   *
   * `SET … NX PX` en une commande : atomique côté Redis, donc deux workers qui
   * appellent en même temps ne peuvent pas réussir tous les deux. Un `EXISTS`
   * suivi d'un `SET` aurait la même apparence et aucune garantie.
   */
  async acquire(task: string, ms: number): Promise<ScheduledLease | null> {
    const key = this.key(task);
    const token = `${process.pid}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

    const result = await this.redis.set(key, token, 'PX', Math.max(1, Math.round(ms)), 'NX');
    if (result !== 'OK') return null;

    const redis = this.redis;
    return {
      token,
      key,
      async renew(nextMs: number): Promise<boolean> {
        const renewed = await redis.eval(RENEW_SCRIPT, 1, key, token, Math.max(1, Math.round(nextMs)));
        return renewed === 1;
      },
      async release(): Promise<boolean> {
        const released = await redis.eval(RELEASE_SCRIPT, 1, key, token);
        return released === 1;
      },
    };
  }

  /** Le temps restant sur un créneau, en ms. Négatif si la clé n'existe pas. Supervision. */
  async remainingMs(task: string): Promise<number> {
    return this.redis.pttl(this.key(task));
  }
}
