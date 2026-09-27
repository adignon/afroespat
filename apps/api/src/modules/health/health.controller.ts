import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../common/prisma.service';
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
  constructor(private readonly prisma: PrismaService) {}

  @Get('health')
  @PublicRead()
  @ApiOperation({ summary: 'Vivacité du service' })
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Get('ready')
  @PublicRead()
  @ApiOperation({ summary: 'Le service peut-il traiter du trafic' })
  async ready(): Promise<{ status: 'ok' | 'degraded'; database: boolean }> {
    let database = false;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      database = true;
    } catch {
      database = false;
    }
    return { status: database ? 'ok' : 'degraded', database };
  }
}
