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
import { AccountController } from './modules/users/account.controller';
import { AccountService } from './modules/users/account.service';
import { PhonesService } from './modules/users/phones.service';
import { VerificationLevelService } from './modules/users/verification-level.service';
import { KycController } from './modules/kyc/kyc.controller';
import { KycService } from './modules/kyc/kyc.service';
import { ConsentsController } from './modules/consents/consents.controller';
import { ConsentsService } from './modules/consents/consents.service';
import {
  CommentsController,
  CommunityPendingPostsController,
  FeedController,
  MyStoriesController,
  PostsController,
  StoriesController,
} from './modules/feed/feed.controller';
import { FeedService } from './modules/feed/feed.service';
import { ConnectionsController } from './modules/connections/connections.controller';
import { ConnectionsService } from './modules/connections/connections.service';
import { AnalyticsService } from './modules/analytics/analytics.service';
import { AnalyticsAdminController } from './modules/analytics/analytics-admin.controller';
import { DataExportController } from './modules/exports/data-export.controller';
import { DataExportService } from './modules/exports/data-export.service';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { RealtimeRelayService } from './modules/realtime/realtime.relay';
import { MediaController } from './modules/media/media.controller';
import { MediaService } from './modules/media/media.service';
import { MentorshipController } from './modules/mentorship/mentorship.controller';
import { MentorshipService } from './modules/mentorship/mentorship.service';
import { MessagingController } from './modules/messaging/messaging.controller';
import { MessagingService } from './modules/messaging/messaging.service';
import { ModerationConsumer } from './modules/moderation/moderation.consumer';
import { ModerationController } from './modules/moderation/moderation.controller';
import { ModerationEffectsService } from './modules/moderation/moderation-effects.service';
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
import { BookmarksController } from './modules/bookmarks/bookmarks.controller';
import { BookmarksService } from './modules/bookmarks/bookmarks.service';
import { GUIDE_VIEW_COUNTER, GuidesService } from './modules/guides/guides.service';
import { RedisGuideViewCounter } from './modules/guides/guide-view-counter';
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
import { BillingController } from './modules/billing/billing.controller';
import { BillingAdminController } from './modules/billing/billing-admin.controller';
import { BillingService } from './modules/billing/billing.service';
import { PlanService } from './modules/billing/plan.service';
import {
  HmacWebhookVerifier,
  INVOICE_PDF,
  MOBILE_MONEY_WEBHOOK_VERIFIER,
  NoInvoicePdfPort,
  STRIPE_WEBHOOK_VERIFIER,
  UnconfiguredWebhookVerifier,
  type WebhookVerifier,
} from './modules/billing/billing.ports';
import { PartnersController } from './modules/partners/partners.controller';
import { PartnersService } from './modules/partners/partners.service';
import { loadEnv } from './config/env';
import { BlocksController } from './modules/blocks/blocks.controller';
import { BlocksService } from './modules/blocks/blocks.service';
import { QUEUES } from './queue/queues';
import { QueueService } from './queue/queue.service';
import { MODERATION_QUEUE, type ModerationQueuePort } from './modules/moderation/moderation.service';
import { TaskRegistrationsService } from './queue/task-registrations.service';
import { EventSubscriptionsService } from './queue/event-subscriptions.service';
import { AuthGuard } from './common/auth.guard';
import { ReferentialsController } from './modules/referentials/referentials.controller';
import { ReferentialsService } from './modules/referentials/referentials.service';
import { StaffGuard } from './common/staff.guard';
import {
  DEFAULT_RATE_LIMITS,
  RATE_LIMIT_CONFIG,
  type RateLimitConfig,
  RateLimitGuard,
} from './common/rate-limit.guard';

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
  imports: [
    CommonModule,
    ProvidersModule,
    QueueModule,
    /**
     * La passerelle WebSocket UNIQUEMENT dans l'API.
     *
     * Une liste d'imports calculée est inhabituelle, et elle est ici obligatoire :
     * la seule PRÉSENCE d'une classe `@WebSocketGateway()` dans l'arbre fait
     * échouer le `createApplicationContext` du worker (§3.1), sur un message qui
     * accuse `AuthGuard`. Voir `realtime.module.ts`. `loadEnv()` est mémoïsée et
     * `APP_ROLE` est posé avant l'import, donc l'évaluation est sûre ici.
     */
    ...(loadEnv().APP_ROLE === 'api' ? [RealtimeModule] : []),
  ],
  controllers: [HealthController, PlacesController, BookmarksController, AuthController, UsersController, AccountController, KycController, BlocksController, ConsentsController, HelpController, GuidesController, CommunitiesController, EventsController, CitiesController, HousingController, JobsController, ProsController, ModerationController,
    // Module 15 — l'équipe. Trois contrôleurs sous `/v1/admin`, derrière `StaffGuard`.
    StaffAuthController, AdminController, AdminModerationController,
    // Module 02 — les référentiels, tenus par CONTENT_ADMIN (§4.2).
    ReferentialsController,
    SearchController, NotificationsController, NotificationSettingsController,
    FeedController, PostsController, CommentsController, StoriesController, MyStoriesController,
    CommunityPendingPostsController,
    MentorshipController, ConnectionsController, MessagingController, JourneysController,
    // Module 14 — les revenus. Le contrôleur membre porte aussi les deux webhooks
    // entrants (T4 §8), qui n'ont pas de membre et se déclarent `@SignedWebhook()`.
    BillingController, PartnersController, BillingAdminController,
    // Module 01 §4.2 — l'export RGPD. Contrôleur séparé d'`AccountController` :
    // c'est une obligation légale avec son propre cycle (demande, génération,
    // péremption), pas un réglage de compte de plus.
    DataExportController,
    // Module 15 §7 — le pilotage. `/v1/admin/dashboard`, `/stats/*`, `/impact`.
    AnalyticsAdminController,
    /**
     * TRANSVERSE (00 §8.1 à §8.3, 01 §4.2) — l'envoi de fichiers.
     *
     * IL N'EXISTAIT AUCUNE ROUTE D'ENVOI DANS TOUTE L'API, et trois écrans
     * s'arrêtaient là : une annonce d'OFFRE de logement exige une photo
     * (10 §2.1), une fiche pro exige un justificatif (10 §4.1), et
     * `PUT /me/avatar` (01 §4.2) n'avait pas d'implémentation — personne
     * n'écrivait `users.avatar_asset_id`, que cinq services lisent.
     *
     * Contrôleur TRANSVERSE et non rattaché à un module : le même média sert au
     * fil, au logement, à l'annuaire pro, aux albums et à la messagerie. Le
     * rattacher à l'un d'eux obligerait les quatre autres à en dépendre.
     */
    MediaController,
  ],
  providers: [
    AuthService,
    UsersService,
    // Module 01, reliquat du lot 1 : niveaux, numéros, KYC, cycle de vie du compte.
    VerificationLevelService,
    PhonesService,
    AccountService,
    KycService,
    BlocksService,
    ConsentsService,
    HelpService,
    GuidesService,
    // Transverse (01 §2.9) : l'état des contenus enregistrés, rafraîchi par la
    // tâche horaire `bookmark.state_refresh`. Aucun contrôleur — §2.9 n'est pas
    // livrée ; voir l'en-tête du service.
    BookmarksService,
    CommunitiesService,
    EventsService,
    CitiesService,
    HousingService,
    JobsService,
    ProsService,
    ModerationService,
    // Les effets du masquage / rétablissement / retrait sur les tables des autres
    // modules (lot G) — voir l'en-tête du service.
    ModerationEffectsService,
    StaffAuthService,
    AdminService,
    ReferentialsService,
    SearchService,
    NotificationsService,
    NotificationEventsService,
    FeedService,
    MentorshipService,
    ConnectionsService,
    MessagingService,
    JourneysService,
    // Module 15 §5 — les instantanés d'indicateurs et les quatre tâches de §10.
    AnalyticsService,
    // Module 01 §2.8 — l'export RGPD.
    DataExportService,
    // Transverse — l'envoi de média (voir `MediaController` ci-dessus).
    MediaService,
    /**
     * Module 08 §7.3 — le côté PUBLICATION du temps réel.
     *
     * Enregistré pour LES DEUX rôles, et c'est le seul morceau du temps réel qui
     * le soit : c'est le WORKER qui publie, puisque c'est lui qui consomme
     * `message.sent`. L'abonnement et les sockets vivent dans `RealtimeModule`,
     * importé plus haut pour l'API seule. Ce service ne dépend d'aucune classe de
     * `@nestjs/websockets` — condition nécessaire pour que le worker démarre.
     */
    RealtimeRelayService,
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
     * Le compteur de vues des guides (05 §5), dans Redis.
     *
     * Branché ICI et non dans le module `guides` parce que c'est un choix
     * d'infrastructure, comme les deux files ci-dessus : le service, lui, ne connaît
     * qu'un port facultatif — ses tests n'ont donc pas besoin de Redis pour éprouver
     * la publication d'un guide.
     *
     * Ce compteur est le SEUL producteur de `guides.view_count`, et
     * `guide.view_count_flush` son seul consommateur. Il n'est jamais lu par une
     * route : la règle dure 00 §1.2 l'interdit, et un test de l'OpenAPI le tient.
     */
    { provide: GUIDE_VIEW_COUNTER, useClass: RedisGuideViewCounter },

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

    // ── Module 14 ────────────────────────────────────────────────────────────
    PlanService,
    BillingService,
    PartnersService,

    /**
     * Les deux VÉRIFICATEURS de signature de webhook (T4 §8).
     *
     * Même forme que `EMAIL_ADDRESS` : le fournisseur est ce qui rend la
     * dépendance satisfaite ou non, et il le dit. Sans secret configuré — ce qui
     * est le cas tant qu'aucune clé Stripe n'existe et que l'agrégateur Mobile
     * Money n'est pas désigné (décision D4) — c'est
     * `UnconfiguredWebhookVerifier` qui répond, et il REFUSE TOUT. Un webhook
     * accepté sans vérification serait une activation d'abonnement Premium
     * ouverte à quiconque connaît l'URL.
     *
     * Le jour où le prestataire arrive, ces deux fournisseurs changent, et RIEN
     * d'autre : ni le service, ni le contrôleur, ni les tests.
     */
    { provide: STRIPE_WEBHOOK_VERIFIER, useFactory: (): WebhookVerifier => verifierFor('stripe') },
    {
      provide: MOBILE_MONEY_WEBHOOK_VERIFIER,
      useFactory: (): WebhookVerifier => verifierFor('mobile-money'),
    },

    /**
     * La facture PDF — AUCUN rendu, et c'est une dépendance non satisfaite.
     *
     * Aucun moteur de rendu n'est installé, `media_assets` n'a pas de pipeline
     * d'écriture serveur, et `users.email` n'existe pas dans le schéma figé : une
     * facture ne peut donc être ni rendue ni envoyée. Le NUMÉRO, lui, est bien
     * attribué et séquentiel. Voir `NoInvoicePdfPort`.
     */
    { provide: INVOICE_PDF, useClass: NoInvoicePdfPort },

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
    /**
     * La limite de débit — §5.5. TROISIÈME garde global, et l'ordre est
     * nécessaire : elle doit connaître l'identité de l'appelant pour lui
     * attribuer un budget, et ce sont les deux gardes précédents qui la posent
     * (`request.auth` par `AuthGuard`, `request.staff` par `StaffGuard`).
     * Placée avant eux, elle ne verrait que des adresses IP et ferait partager
     * un même budget à tous les membres d'un réseau d'entreprise.
     *
     * Elle ne protège d'aucune faille : elle protège d'un abus, et d'un coût —
     * les routes d'OTP envoient un SMS à chaque appel. C'est pourquoi une panne
     * Redis la fait LAISSER PASSER plutôt que tout refuser.
     */
    { provide: APP_GUARD, useClass: RateLimitGuard },
    {
      provide: RATE_LIMIT_CONFIG,
      useFactory: (): RateLimitConfig => ({
        enabled: loadEnv().RATE_LIMIT_ENABLED,
        ...DEFAULT_RATE_LIMITS,
      }),
    },
  ],
})
export class AppModule {}

/**
 * Le vérificateur d'un canal, selon le secret configuré.
 *
 * Hors du décorateur pour rester lisible, et sans injection de configuration :
 * `loadEnv()` est déjà mémoïsée et employée ainsi par `ProvidersModule`.
 */
function verifierFor(channel: 'stripe' | 'mobile-money'): WebhookVerifier {
  const env = loadEnv();
  const secret =
    channel === 'stripe' ? env.STRIPE_WEBHOOK_SECRET : env.MOBILE_MONEY_WEBHOOK_SECRET;
  return secret === undefined
    ? new UnconfiguredWebhookVerifier(channel)
    : new HmacWebhookVerifier(channel, secret);
}
