import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { OutboxService } from '../../common/outbox.service';
import { PrismaService } from '../../common/prisma.service';
import { loadEnv } from '../../config/env';
import { QueueService } from '../../queue/queue.service';
import { PublicRead } from '../../common/capability.decorator';

/** Santé de la boîte d'envoi : âge (secondes) du plus ancien événement non publié, `null` si aucun. */
export interface OutboxHealth {
  oldestPendingSeconds: number | null;
  stuck: boolean;
}

/** Pur et exporté pour être éprouvé : `maxSeconds` à 0 désactive le seuil. */
export function evaluateOutbox(ageMs: number | null, maxSeconds: number): OutboxHealth {
  if (ageMs === null) return { oldestPendingSeconds: null, stuck: false };
  const seconds = Math.max(0, Math.round(ageMs / 1000));
  return { oldestPendingSeconds: seconds, stuck: maxSeconds > 0 && seconds > maxSeconds };
}

async function outboxHealth(outbox: OutboxService): Promise<OutboxHealth> {
  try {
    return evaluateOutbox(await outbox.oldestPendingAge(), loadEnv().OUTBOX_MAX_PENDING_AGE_SECONDS);
  } catch {
    // La mesure elle-même échoue : ne pas retirer l'instance du trafic pour un signal secondaire.
    return { oldestPendingSeconds: null, stuck: false };
  }
}

/**
 * Sonde de santé — consommée par l'orchestrateur et par la supervision
 * (runbook §4). Ne révèle AUCUNE information interne : ni version de base, ni
 * nom d'hôte, ni trace. Un point de santé bavard est un point de reconnaissance
 * offert.
 */
@ApiTags('health')
@Controller()
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queues: QueueService,
    private readonly outbox: OutboxService,
  ) {}

  @Get('health')
  @PublicRead()
  @ApiOperation({ summary: 'Vivacité du service' })
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }

  /**
   * PRÊT = base ET Redis. Redis porte les files, le verrou des tâches planifiées,
   * les compteurs de limite de débit et la passerelle temps réel : une API qui
   * répond mais ne peut plus mettre en file ne doit pas recevoir de trafic.
   * `503` quand l'un manque, pour que l'orchestrateur retire l'instance du
   * répartiteur (un `200 degraded` laissait passer le trafic). Chaque sonde est
   * bornée à 2 s : une dépendance qui ne répond pas ne doit pas figer la sonde.
   */
  @Get('ready')
  @PublicRead()
  @ApiOperation({ summary: 'Le service peut-il traiter du trafic (base et Redis)' })
  async ready(@Res({ passthrough: true }) res: Response): Promise<{ status: 'ok' | 'degraded'; database: boolean; redis: boolean; outbox: OutboxHealth }> {
    const within = async (probe: () => Promise<unknown>): Promise<boolean> => {
      let timer: NodeJS.Timeout | undefined;
      try {
        await Promise.race([
          probe(),
          new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error('délai')), 2000);
          }),
        ]);
        return true;
      } catch {
        return false;
      } finally {
        if (timer !== undefined) clearTimeout(timer);
      }
    };
    const [database, redis] = await Promise.all([
      within(() => this.prisma.$queryRaw`SELECT 1`),
      within(() => this.queues.redis.ping()),
    ]);
    // L'âge du plus ancien événement non publié : un relais arrêté ne casse ni la base ni Redis, mais plus rien ne part
    // (notifications, e-mails, files). Au-delà du seuil, l'instance est signalée dégradée (503). Sans base, on n'interroge pas.
    const outbox = database ? await outboxHealth(this.outbox) : { oldestPendingSeconds: null, stuck: false };
    const ok = database && redis && !outbox.stuck;
    if (!ok) res.status(503);
    return { status: ok ? 'ok' : 'degraded', database, redis, outbox };
  }
}
