import { Injectable } from '@nestjs/common';
import { QueueService } from '../../queue/queue.service';
import type { GuideViewCounterPort } from './guides.service';

/**
 * Le compteur de vues des guides, dans Redis — 05 §5 : « compteur approximatif
 * (incrément Redis, flush horaire) ».
 *
 * POURQUOI REDIS ET PAS LA BASE. Une vue de guide est la lecture la plus fréquente
 * du produit, et un `UPDATE guides SET view_count = view_count + 1` par lecture
 * sérialise toutes les vues d'un même guide sur une seule ligne : le guide le plus
 * lu devient le plus lent, et chaque vue produit une version de ligne à nettoyer.
 * §5 tranche, et c'est le bon arbitrage pour un chiffre qui n'est exposé à
 * personne (règle dure 00 §1.2).
 *
 * UN HACHAGE, pas une clé par guide. `HINCRBY guides:view_pending <id> 1` garde
 * tout le lot sous une seule clé, ce qui rend le vidage possible en une opération
 * — là où mille clés `guides:views:<id>` demanderaient un `SCAN`, donc un vidage
 * qui n'est atomique pour aucune clé et qui peut manquer celles créées pendant le
 * balayage.
 *
 * ── LE POINT DÉLICAT : LE PRÉLÈVEMENT EST ATOMIQUE ──────────────────────────
 *
 * `drain` lit ET efface dans le MÊME script Lua, c'est-à-dire dans la même
 * opération pour Redis, qui est mono-thread pendant l'exécution d'un script.
 *
 * Écrit en deux temps — `HGETALL` puis `DEL` — le défaut serait invisible en
 * développement et certain en production : toute vue arrivée ENTRE les deux serait
 * effacée sans avoir été comptée, et deux workers qui videraient en même temps
 * liraient tous deux le même lot et l'ajouteraient tous deux en base. Le second
 * cas est exactement le « compteur vidé deux fois » que le test d'idempotence de
 * l'ordonnanceur traque, et il ne se voit dans aucun test à un seul processus.
 *
 * `HDEL` champ par champ dans le script, et non `DEL` de la clé entière : un
 * `limit` atteint doit laisser en place les champs NON prélevés, sinon la borne du
 * lot deviendrait une perte silencieuse de tout le reste.
 */
@Injectable()
export class RedisGuideViewCounter implements GuideViewCounterPort {
  /** La clé du hachage en attente de vidage. Une seule, pour tout le produit. */
  static readonly KEY = 'guides:view_pending';

  /**
   * Prélève au plus `limit` champs : rend les couples (guide, vues) et les efface,
   * dans la même exécution.
   *
   * Le retour est un tableau plat `[champ, valeur, champ, valeur, …]` — la seule
   * forme qu'un script Lua peut rendre à Redis pour une association.
   */
  private static readonly DRAIN_SCRIPT = `
local fields = redis.call('HKEYS', KEYS[1])
local limit = tonumber(ARGV[1])
local out = {}
for i = 1, #fields do
  if i > limit then break end
  local field = fields[i]
  local value = redis.call('HGET', KEYS[1], field)
  redis.call('HDEL', KEYS[1], field)
  out[#out + 1] = field
  out[#out + 1] = value
end
return out
`;

  constructor(private readonly queues: QueueService) {}

  async increment(guideId: string): Promise<void> {
    await this.queues.redis.hincrby(RedisGuideViewCounter.KEY, guideId, 1);
  }

  async drain(limit: number): Promise<ReadonlyMap<string, number>> {
    const raw: unknown = await this.queues.redis.eval(
      RedisGuideViewCounter.DRAIN_SCRIPT,
      1,
      RedisGuideViewCounter.KEY,
      String(limit),
    );

    const out = new Map<string, number>();
    // `eval` est typé `unknown` par ioredis, et c'est honnête : la forme du retour
    // dépend du script. On rétrécit par vérification, jamais par assertion.
    if (!Array.isArray(raw)) return out;
    const flat = raw as readonly unknown[];

    for (let i = 0; i + 1 < flat.length; i += 2) {
      const field = flat[i];
      const value = Number(flat[i + 1]);
      // Une valeur non numérique est impossible avec `HINCRBY`, mais la clé est
      // partagée et `eval` rend `unknown` : on ignore plutôt que de rendre `NaN`,
      // qu'un `increment` Prisma propagerait en base.
      if (typeof field === 'string' && Number.isFinite(value)) out.set(field, value);
    }
    return out;
  }
}
