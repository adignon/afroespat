import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { CryptoService } from './crypto.service';
import { OutboxService } from './outbox.service';
import { PrismaService } from './prisma.service';

/**
 * Briques partagées par tous les modules métier. Global : les 24 modules de §3.3
 * en dépendent tous, les importer un à un n'apporterait rien.
 */
@Global()
@Module({
  providers: [PrismaService, CryptoService, OutboxService, AuditService],
  exports: [PrismaService, CryptoService, OutboxService, AuditService],
})
export class CommonModule {}
