import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../common/prisma.service';
import { QueueService } from '../../queue/queue.service';
import { PublicRead } from '../../common/capability.decorator';

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
  async ready(@Res({ passthrough: true }) res: Response): Promise<{ status: 'ok' | 'degraded'; database: boolean; redis: boolean }> {
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
    const ok = database && redis;
    if (!ok) res.status(503);
    return { status: ok ? 'ok' : 'degraded', database, redis };
  }
}
