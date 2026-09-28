import { type CanActivate, type ExecutionContext, Inject, Injectable, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { ApiError } from './api-error';
import { RATE_LIMIT_KEY, type RateLimitRule } from './capability.decorator';
import { clientIp } from './staff.guard';
import { QueueService } from '../queue/queue.service';
import type { AuthContext } from './auth.guard';
import type { StaffUser } from './staff.guard';

/**
 * La limite de débit — 00-fondations.md §5.5.
 *
 * POURQUOI CE FICHIER EXISTE : le décorateur `@RateLimit(n)` ne limitait RIEN.
 *
 * Il posait sa métadonnée et émettait `x-rate-limit` dans l'OpenAPI, et
 * **personne ne la lisait** : une seule occurrence de `app:rateLimit` dans tout
 * le dépôt, sa propre déclaration. Quinze contrôleurs déclaraient une limite,
 * dont les routes d'authentification à 5 et 10 par minute — celles qui coûtent un
 * SMS à chaque appel. L'OpenAPI annonçait la protection, ce qui est pire qu'une
 * absence : on ne cherche pas ce qu'on croit avoir.
 *
 * Trouvé en vérifiant le rapport d'un agent, par un `grep` — pas en relisant.
 *
 * TROIS BUDGETS, ET ILS S'ADDITIONNENT
 *
 * §5.5 énonce deux budgets par membre : 120 requêtes/min et 30 écritures/min. Le
 * décorateur en ajoute un troisième, propre à la route, et avec sa propre PÉRIODE
 * — les spécifications chiffrent souvent l'heure (« `PATCH /me` 20/h », « 10 par
 * IP et par heure » pour l'envoi d'un code). Les trois sont vérifiés, et le
 * premier dépassé refuse : une route déclarée à 10/h ne dispense pas du plafond
 * global de la minute, et le plafond global ne dispense pas de la route.
 *
 * L'IDENTITÉ, dans cet ordre : le membre, puis le compte d'équipe, puis l'IP.
 * L'IP est le dernier recours parce qu'elle est partagée — un foyer, un réseau
 * d'entreprise, un opérateur mobile derrière un NAT. C'est pourtant la seule
 * identité disponible sur la connexion, qui est précisément la route à protéger.
 * Conséquence assumée et à connaître : deux membres du même foyer se partagent le
 * budget des routes d'OTP.
 *
 * FENÊTRE FIXE, pas glissante. Elle autorise une pointe à cheval sur deux
 * fenêtres (jusqu'à 2n en deux minutes) et c'est le compromis retenu : une
 * fenêtre glissante demande de garder un horodatage par requête, donc une
 * structure par identité que rien n'expire toute seule. §5.5 raisonne « par
 * minute », la fenêtre fixe dit exactement cela.
 *
 * EN CAS DE PANNE REDIS, ON LAISSE PASSER — et c'est une décision, pas un oubli.
 * Refuser ferait d'un hoquet Redis une panne totale de l'API, alors que la limite
 * de débit protège d'un abus, pas d'une faille. L'échec est journalisé en
 * `error`, de sorte qu'il soit visible dans le runbook.
 */

/** Ce que la fenêtre Redis rend : le compte après incrément, et ce qui reste à courir. */
interface Hit {
  readonly count: number;
  readonly ttlMs: number;
}

export const RATE_LIMIT_CONFIG = Symbol('RATE_LIMIT_CONFIG');

/**
 * Configuration injectée plutôt que lue de l'environnement dans le garde.
 *
 * Injectée pour une raison de test : la suite d'intégration a besoin que la
 * limite soit COUPÉE (des dizaines de tests appellent la même route depuis la
 * même IP, et une limite active les ferait échouer pour une raison sans rapport
 * avec ce qu'ils éprouvent), tandis que le test de la limite elle-même a besoin
 * qu'elle soit ACTIVE. `loadEnv()` met son résultat en cache pour tout le
 * processus : un test ne peut pas le changer après coup. Un fournisseur Nest, si.
 */
export interface RateLimitConfig {
  readonly enabled: boolean;
  /** §5.5 : 120 requêtes/min par membre. */
  readonly requestsPerMinute: number;
  /** §5.5 : 30 écritures/min par membre. */
  readonly writesPerMinute: number;
}

export const DEFAULT_RATE_LIMITS = {
  requestsPerMinute: 120,
  writesPerMinute: 30,
} as const;

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;

function windowMsOf(period: RateLimitRule['period']): number {
  return period === 'hour' ? HOUR_MS : MINUTE_MS;
}

/**
 * Incrémente et pose l'expiration EN UNE SEULE opération.
 *
 * Un `INCR` suivi d'un `EXPIRE` en deux allers-retours laisse une fenêtre — très
 * courte, mais réelle — où le processus meurt entre les deux : la clé reste alors
 * SANS expiration, et l'identité est bloquée pour toujours. Le script rend aussi
 * le temps restant, qui sert à `Retry-After` : le calculer côté client
 * supposerait que les horloges concordent.
 */
const HIT_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
return { count, redis.call('PTTL', KEYS[1]) }
`;

interface RateLimitedRequest extends Request {
  auth?: AuthContext;
  staff?: StaffUser;
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly queues: QueueService,
    @Inject(RATE_LIMIT_CONFIG) private readonly config: RateLimitConfig,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!this.config.enabled) return true;
    if (context.getType<string>() !== 'http') return true;

    const request = context.switchToHttp().getRequest<RateLimitedRequest>();
    const identity = this.identityOf(request);
    if (identity === null) return true;

    const method = request.method.toUpperCase();
    const isWrite = method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS';

    const routeRule = this.reflector.getAllAndOverride<RateLimitRule | undefined>(RATE_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    /**
     * L'ordre est délibéré : le budget le plus SERRÉ est vérifié en premier, pour
     * que le refus nomme la contrainte qui mord réellement. Tous sont incrémentés
     * de toute façon — la vérification s'arrête, le comptage non, sinon une rafale
     * refusée par la route échapperait au plafond global.
     */
    const buckets: { key: string; limit: number; scope: string; windowMs: number }[] = [];
    if (routeRule !== undefined) {
      const route = `${context.getClass().name}.${context.getHandler().name}`;
      const windowMs = windowMsOf(routeRule.period);
      /**
       * La PÉRIODE est dans la clé, et il le faut : sans elle, changer
       * `@RateLimit(20)` en `@RateLimit(20, 'hour')` réutiliserait le seau de la
       * minute, dont l'expiration est déjà posée — la nouvelle période ne
       * prendrait effet qu'à la fin de l'ancienne fenêtre, et seulement pour les
       * identités qui n'ont rien appelé entre-temps.
       */
      buckets.push({
        key: `rl-route-${route}-${routeRule.period}-${identity}`,
        limit: routeRule.count,
        scope: `route (${routeRule.count}/${routeRule.period === 'hour' ? 'h' : 'min'})`,
        windowMs,
      });
    }
    if (isWrite) {
      buckets.push({
        key: `rl-write-${identity}`,
        limit: this.config.writesPerMinute,
        scope: 'écritures',
        windowMs: MINUTE_MS,
      });
    }
    buckets.push({
      key: `rl-all-${identity}`,
      limit: this.config.requestsPerMinute,
      scope: 'requêtes',
      windowMs: MINUTE_MS,
    });

    let exceeded: { scope: string; limit: number; ttlMs: number } | null = null;
    for (const bucket of buckets) {
      const hit = await this.hit(bucket.key, bucket.windowMs);
      // `null` = Redis n'a pas répondu. On laisse passer, mais on continue de
      // compter les autres seaux : ils emploient peut-être une autre réplique.
      if (hit === null) continue;
      if (hit.count > bucket.limit && exceeded === null) {
        exceeded = { scope: bucket.scope, limit: bucket.limit, ttlMs: hit.ttlMs };
      }
    }

    if (exceeded === null) return true;

    const retryAfterSeconds = Math.max(1, Math.ceil(exceeded.ttlMs / 1000));
    const response = context.switchToHttp().getResponse<Response>();
    // En-tête normalisé (RFC 9110 §10.2.3) : le client sait quand revenir, au
    // lieu de réessayer en boucle et d'aggraver ce qu'on essaie de limiter.
    response.setHeader('Retry-After', String(retryAfterSeconds));
    throw ApiError.transverse('RATE_LIMITED', {
      scope: exceeded.scope,
      limit: exceeded.limit,
      retryAfterSeconds,
    });
  }

  /**
   * L'identité qui porte le budget.
   *
   * Le membre d'abord : c'est lui que §5.5 nomme, et c'est la seule identité qui
   * ne soit pas partagée. Puis le compte d'équipe. Puis l'IP, faute de mieux.
   * `null` quand même l'IP est indéterminée — on ne fabrique pas une identité
   * commune à tous les appelants inconnus, qui serait un seau unique où le
   * premier venu épuiserait le budget de tous les autres.
   */
  private identityOf(request: RateLimitedRequest): string | null {
    if (request.auth !== undefined) return `u-${request.auth.userId}`;
    if (request.staff !== undefined) return `s-${request.staff.staffId}`;
    const ip = clientIp(request);
    return ip === null ? null : `ip-${ip}`;
  }

  private async hit(key: string, windowMs: number): Promise<Hit | null> {
    try {
      const raw = (await this.queues.redis.eval(
        HIT_SCRIPT,
        1,
        key,
        String(windowMs),
      )) as [number, number];
      const [count, ttlMs] = raw;
      return { count, ttlMs: ttlMs > 0 ? ttlMs : windowMs };
    } catch (error) {
      this.logger.error(
        `limite de débit indisponible pour ${key} : ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }
}
