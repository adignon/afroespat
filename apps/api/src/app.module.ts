import { Module } from '@nestjs/common';
import { CommonModule } from './common/common.module';
import { ProvidersModule } from './providers/providers.module';
import { QueueModule } from './queue/queue.module';
import { HealthController } from './modules/health/health.controller';
import { PlacesController } from './modules/places/places.controller';

/**
 * Module racine. §3.3 : un dossier par module métier, dans l'ordre de
 * numérotation — auth, users, verification, onboarding, places, journeys, posts,
 * guides, help, communities, mentorship, connections, messaging, events,
 * housing, jobs, pros, search, notifications, moderation, billing, partners,
 * analytics, admin.
 *
 * Lot 0 : seuls le socle et `places` (module 02, lecture seule) existent. Les
 * autres arrivent lot par lot, sans que ce fichier change de forme.
 */
@Module({
  imports: [CommonModule, ProvidersModule, QueueModule],
  controllers: [HealthController, PlacesController],
})
export class AppModule {}
