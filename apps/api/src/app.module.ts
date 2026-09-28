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
import {
  CommentsController,
  FeedController,
  MyStoriesController,
  PostsController,
  StoriesController,
} from './modules/feed/feed.controller';
import { FeedService } from './modules/feed/feed.service';
import { ConnectionsController } from './modules/connections/connections.controller';
import { ConnectionsService } from './modules/connections/connections.service';
import { MentorshipController } from './modules/mentorship/mentorship.controller';
import { MentorshipService } from './modules/mentorship/mentorship.service';
import { MessagingController } from './modules/messaging/messaging.controller';
import { MessagingService } from './modules/messaging/messaging.service';
import { ModerationConsumer } from './modules/moderation/moderation.consumer';
import { ModerationController } from './modules/moderation/moderation.controller';
import { ModerationService } from './modules/moderation/moderation.service';
import { HousingController } from './modules/housing/housing.controller';
import { HousingService } from './modules/housing/housing.service';
import { JobsController } from './modules/jobs/jobs.controller';
import { JobsService } from './modules/jobs/jobs.service';
import { ProsController } from './modules/pros/pros.controller';
import { ProsService } from './modules/pros/pros.service';
import { CitiesController } from './modules/cities/cities.controller';
import { CitiesService } from './modules/cities/cities.service';
import { EventsController } from './modules/events/events.controller';
import { EventsService } from './modules/events/events.service';
import { CommunitiesController } from './modules/communities/communities.controller';
import { CommunitiesService } from './modules/communities/communities.service';
import { GuidesController } from './modules/guides/guides.controller';
import { GuidesService } from './modules/guides/guides.service';
import { JourneysController } from './modules/journeys/journeys.controller';
import { JourneysService } from './modules/journeys/journeys.service';
import { HelpController } from './modules/help/help.controller';
import { HelpService } from './modules/help/help.service';
import { AdminController } from './modules/admin/admin.controller';
import { AdminModerationController } from './modules/admin/admin-moderation.controller';
import { AdminService } from './modules/admin/admin.service';
import { StaffAuthController } from './modules/admin/staff-auth.controller';
import { StaffAuthService } from './modules/admin/staff-auth.service';
import { SearchController } from './modules/search/search.controller';
import { SearchService, SEARCH_INDEX_QUEUE } from './modules/search/search.service';
import { BullSearchIndexQueue, SearchIndexConsumer } from './modules/search/search.consumer';
import {
  NotificationSettingsController,
  NotificationsController,
} from './modules/notifications/notifications.controller';
import {
  EMAIL_ADDRESS,
  NoEmailAddressPort,
  NotificationsService,
  OUTBOUND_QUEUE,
} from './modules/notifications/notifications.service';
import { NotificationEventsService } from './modules/notifications/notifications.events';
import { BullOutboundQueue, OutboundConsumer } from './modules/notifications/notifications.outbound';
import { BlocksController } from './modules/blocks/blocks.controller';
import { BlocksService } from './modules/blocks/blocks.service';
import { QUEUES } from './queue/queues';
import { QueueService } from './queue/queue.service';
import { MODERATION_QUEUE, type ModerationQueuePort } from './modules/moderation/moderation.service';
import { TaskRegistrationsService } from './queue/task-registrations.service';
import { EventSubscriptionsService } from './queue/event-subscriptions.service';
import { AuthGuard } from './common/auth.guard';
import { StaffGuard } from './common/staff.guard';

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
  controllers: [HealthController, PlacesController, AuthController, UsersController, BlocksController, ConsentsController, HelpController, GuidesController, CommunitiesController, EventsController, CitiesController, HousingController, JobsController, ProsController, ModerationController,
    // Module 15 — l'équipe. Trois contrôleurs sous `/v1/admin`, derrière `StaffGuard`.
    StaffAuthController, AdminController, AdminModerationController,
    SearchController, NotificationsController, NotificationSettingsController,
    FeedController, PostsController, CommentsController, StoriesController, MyStoriesController,
    MentorshipController, ConnectionsController, MessagingController, JourneysController,
  ],
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
    HousingService,
    JobsService,
    ProsService,
    ModerationService,
    StaffAuthService,
    AdminService,
    SearchService,
    NotificationsService,
    NotificationEventsService,
    FeedService,
    MentorshipService,
    ConnectionsService,
    MessagingService,
    JourneysService,
    /**
     * Le port de file de la modération.
     *
     * Le service le reçoit en `@Optional()` : sans lui, `check()` applique les
     * règles locales et n'appelle PAS l'IA. C'est le bon comportement en test — il
     * évite d'exiger Redis d'une suite d'intégration — mais pas en production, où
     * la moitié asynchrone du pipeline disparaîtrait en silence.
     *
     * D'où ce fournisseur explicite : la file existe partout où l'API tourne, et
     * le CONSOMMATEUR, lui, ne tourne que dans le worker.
     */
    {
      provide: MODERATION_QUEUE,
      inject: [QueueService],
      useFactory: (queues: QueueService): ModerationQueuePort => ({
        enqueue: async (job) => {
          await queues.get(QUEUES.MODERATION).add('ai-analysis', job, {
            // Une analyse perdue laisse un contenu non relu : on réessaie
            // franchement, comme pour les événements de domaine.
            attempts: 5,
            backoff: { type: 'exponential', delay: 10_000 },
            removeOnComplete: { age: 3600, count: 1000 },
            removeOnFail: { age: 86_400 * 7 },
          });
        },
      }),
    },
    ModerationConsumer,

    /**
     * Les trois files des modules 11 et 12, branchées comme celle de la modération :
     * l'adaptateur existe PARTOUT (l'API comme le worker produit), les consommateurs
     * ne tournent que dans le worker — ils le vérifient eux-mêmes sur `APP_ROLE`.
     *
     * Les deux ports sont `@Optional()` dans leurs services, et ces fournisseurs sont
     * ce qui rend la file réelle en exécution. En test, leur absence fait retomber la
     * recherche sur une indexation SUR PLACE (même appel, même résultat) et les
     * notifications sur une décision écrite en base sans envoi — ce qui est
     * précisément ce qu'une suite d'intégration doit pouvoir vérifier sans Redis.
     */
    { provide: SEARCH_INDEX_QUEUE, useClass: BullSearchIndexQueue },
    SearchIndexConsumer,
    { provide: OUTBOUND_QUEUE, useClass: BullOutboundQueue },
    OutboundConsumer,

    /**
     * L'adresse email d'un membre — AUCUNE, et c'est une dépendance non satisfaite.
     *
     * 12 §3 annonce `users.email` « ajoutée au module 01 » ; la colonne n'existe pas
     * dans le schéma figé, donc aucune table ne peut porter l'adresse. Ce fournisseur
     * dit la vérité plutôt que de la masquer : `has()` rend `false`, donc AUCUN canal
     * email n'est jamais décidé, conformément au §3 (« sans email, pas de canal
     * email »). Le jour où la colonne arrive, ce seul fournisseur change.
     */
    { provide: EMAIL_ADDRESS, useClass: NoEmailAddressPort },

    // Le câblage des consommateurs d'événements. Placé ici, dans le module
    // racine, parce qu'il dépend des services métier — et `QueueModule` ne doit
    // pas les connaître.
    EventSubscriptionsService,
    /**
     * Le câblage des tâches planifiées de §9.3, ici pour la même raison que celui
     * des événements : il dépend des services métier, que `QueueModule` ne doit pas
     * connaître.
     *
     * Il tourne dans l'API AUSSI — seul le planificateur, c'est-à-dire l'horloge,
     * est réservé au worker. Enregistrer des deux côtés ne déclenche rien côté API
     * et garde le registre lisible depuis un test qui ne lève pas de worker.
     */
    TaskRegistrationsService,
    // Garde GLOBAL, et refusant par défaut : une route qui oublie de déclarer
    // sa capacité est rejetée, pas ouverte. Un garde qu'on pose route par route
    // protège exactement les routes auxquelles on a pensé.
    { provide: APP_GUARD, useClass: AuthGuard },
    /**
     * Le garde d'ÉQUIPE, second garde global — 15 §2.1, règle dure sur
     * l'hermétisme des deux domaines.
     *
     * Deux gardes et non un seul, et l'ORDRE compte : Nest les exécute dans
     * l'ordre de déclaration. `AuthGuard` passe le premier et LAISSE PASSER sans
     * rien lire toute route qui déclare `@RequiresStaffRole` ; `StaffGuard` passe
     * ensuite et refuse tout ce qui n'a pas de session d'équipe. Une route
     * appartient toujours à exactement un des deux domaines — celle qui
     * déclarerait les deux est refusée par `AuthGuard`, à chaque appel.
     *
     * Les inverser n'ouvrirait rien, mais rendrait le refus moins lisible : c'est
     * `AuthGuard` qui porte le « refus par défaut » du §7.3, et il doit rester le
     * premier à parler.
     */
    { provide: APP_GUARD, useClass: StaffGuard },
  ],
})
export class AppModule {}
