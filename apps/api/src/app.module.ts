import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { CommonModule } from './common/common.module';
import { ProvidersModule } from './providers/providers.module';
import { QueueModule } from './queue/queue.module';
import { HealthController } from './modules/health/health.controller';
import { PlacesController } from './modules/places/places.controller';
import { AuthController } from './modules/auth/auth.controller';
import { AuthService } from './modules/auth/auth.service';
import { UsersController } from './modules/users/users.controller';
import { UsersService } from './modules/users/users.service';
import { ConsentsController } from './modules/consents/consents.controller';
import { ConsentsService } from './modules/consents/consents.service';
import { CitiesController } from './modules/cities/cities.controller';
import { CitiesService } from './modules/cities/cities.service';
import { EventsController } from './modules/events/events.controller';
import { EventsService } from './modules/events/events.service';
import { CommunitiesController } from './modules/communities/communities.controller';
import { CommunitiesService } from './modules/communities/communities.service';
import { GuidesController } from './modules/guides/guides.controller';
import { GuidesService } from './modules/guides/guides.service';
import { HelpController } from './modules/help/help.controller';
import { HelpService } from './modules/help/help.service';
import { BlocksController } from './modules/blocks/blocks.controller';
import { BlocksService } from './modules/blocks/blocks.service';
import { AuthGuard } from './common/auth.guard';

/**
 * Module racine. §3.3 : un dossier par module métier, dans l'ordre de
 * numérotation — auth, users, verification, onboarding, places, journeys, posts,
 * guides, help, communities, mentorship, connections, messaging, events,
 * housing, jobs, pros, search, notifications, moderation, billing, partners,
 * analytics, admin.
 *
 * Lot 0 : le socle et `places` (module 02, lecture seule).
 * Lot 1 : `auth` et `users` (module 01). Les autres arrivent lot par lot,
 * sans que ce
 * fichier change de forme.
 */
@Module({
  imports: [CommonModule, ProvidersModule, QueueModule],
  controllers: [HealthController, PlacesController, AuthController, UsersController, BlocksController, ConsentsController, HelpController, GuidesController, CommunitiesController, EventsController, CitiesController],
  providers: [
    AuthService,
    UsersService,
    BlocksService,
    ConsentsService,
    HelpService,
    GuidesService,
    CommunitiesService,
    EventsService,
    CitiesService,
    // Garde GLOBAL, et refusant par défaut : une route qui oublie de déclarer
    // sa capacité est rejetée, pas ouverte. Un garde qu'on pose route par route
    // protège exactement les routes auxquelles on a pensé.
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}
