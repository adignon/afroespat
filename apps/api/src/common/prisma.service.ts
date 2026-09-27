import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@app/db';

/**
 * Accès à la base. Un seul client pour toute l'application.
 *
 * §3.3 : « Un service peut appeler d'autres services, jamais le dépôt d'un autre
 * module. » Ce client est donc injecté dans les dépôts, pas dans les contrôleurs.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Base de données connectée');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
