import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { BookmarksService } from '../modules/bookmarks/bookmarks.service';
import { CitiesService } from '../modules/cities/cities.service';
import { CommunitiesService } from '../modules/communities/communities.service';
import { ConnectionsService } from '../modules/connections/connections.service';
import { EventsService } from '../modules/events/events.service';
import { FeedService } from '../modules/feed/feed.service';
import { GuidesService } from '../modules/guides/guides.service';
import { HelpService } from '../modules/help/help.service';
import { HousingService } from '../modules/housing/housing.service';
import { JobsService } from '../modules/jobs/jobs.service';
import { JourneysService } from '../modules/journeys/journeys.service';
import { MentorshipService } from '../modules/mentorship/mentorship.service';
import { ModerationService } from '../modules/moderation/moderation.service';
import { NotificationEventsService } from '../modules/notifications/notifications.events';
import { NotificationsService } from '../modules/notifications/notifications.service';
import { ProsService } from '../modules/pros/pros.service';
import { StaffAuthService } from '../modules/admin/staff-auth.service';
import { BillingService } from '../modules/billing/billing.service';
import { AccountService } from '../modules/users/account.service';
import { KycService } from '../modules/kyc/kyc.service';
import { ImpactService } from '../modules/analytics/impact.service';
import { AnalyticsService } from '../modules/analytics/analytics.service';
import { DataExportService } from '../modules/exports/data-export.service';
import { ScheduledTaskRegistry, dailyAt, every, hourlyAt, quarterlyAt, weeklyAt } from './scheduled-tasks';

/**
 * Le câblage des tâches planifiées — 00-fondations.md §9.3.
 *
 * TOUT est ici, et nulle part ailleurs, pour les deux raisons qui valent déjà pour
 * `event-subscriptions.service.ts` :
 *
 *   · les services métier restent IGNORANTS de l'ordonnanceur. Ils exposent des
 *     méthodes publiques, idempotentes, avec un `now` en paramètre — et leurs
 *     tests d'intégration n'ont donc besoin ni de Redis ni de BullMQ ;
 *   · on lit en un coup d'œil CE QUI TOURNE et À QUELLE HEURE. Une cadence
 *     éparpillée dans vingt-quatre `onModuleInit` est une cadence que personne ne
 *     peut vérifier contre la spec, et c'est ainsi qu'une tâche disparaît.
 *
 * LES NOMS sont ceux de §9.3 et des commentaires des méthodes appelées, pas des
 * inventions : ils apparaissent dans le journal, dans la file `scheduled` et dans
 * le runbook. Une tâche qu'on cherche sous le nom de la spec doit se trouver.
 *
 * LES HEURES sont ÉTALÉES, et c'est le seul choix de ce fichier qui ne vienne pas
 * de la spec. Dix-neuf tâches quotidiennes toutes posées à 3 h 00 ouvriraient
 * dix-neuf balayages dans la même seconde ; la concurrence 4 du planificateur en
 * ferait une file d'attente, mais les quatre premiers se battraient tout de même
 * pour le même bassin de connexions. Dix minutes d'écart ne coûtent rien à des
 * règles qui se comptent en jours.
 *
 * TROIS TÂCHES DES SPECS NE SONT PAS ICI, et chacune pour une raison écrite :
 *   · `outbox.relay` (1 s) — déjà tenue par `OutboxRelayService`, à son propre
 *     rythme. Un travail BullMQ par seconde coûterait plus que le balayage lui-même ;
 *   · `audit.retention` et `affiliate.reconcile` — la première a été RETIRÉE
 *     par décision du porteur (« on ne supprime jamais » : le journal d'audit est
 *     conservé sans limite), la seconde attend un partenaire qui expose une API.
 *     Les deux sont détaillées en fin de fichier, pour que l'écart avec §9.3 se lise
 *     ici plutôt que de se découvrir en production.
 *
 * `event.waitlist_promote` (09 §8) n'est pas une tâche : la spec la donne « à la
 * désinscription (immédiat, pas planifié) », et elle est tenue par le service.
 */
@Injectable()
export class TaskRegistrationsService implements OnModuleInit {
  private readonly logger = new Logger(TaskRegistrationsService.name);

  constructor(
    private readonly registry: ScheduledTaskRegistry,
    private readonly help: HelpService,
    private readonly guides: GuidesService,
    private readonly communities: CommunitiesService,
    private readonly events: EventsService,
    private readonly housing: HousingService,
    private readonly jobs: JobsService,
    private readonly pros: ProsService,
    private readonly moderation: ModerationService,
    private readonly mentorship: MentorshipService,
    private readonly connections: ConnectionsService,
    private readonly feed: FeedService,
    private readonly cities: CitiesService,
    private readonly notifications: NotificationsService,
    private readonly staffAuth: StaffAuthService,
    private readonly billing: BillingService,
    private readonly account: AccountService,
    private readonly kyc: KycService,
    private readonly analytics: AnalyticsService,
    private readonly impact: ImpactService,
    private readonly dataExports: DataExportService,
    private readonly journeys: JourneysService,
    private readonly bookmarks: BookmarksService,
    private readonly notificationEvents: NotificationEventsService,
  ) {}

  onModuleInit(): void {
    // ── Fil d'actualité (04 §7) ──────────────────────────────────────────────
    //
    // `story.expire` est la plus fréquente des vingt-sept, et celle que §9.3 cite
    // en exemple du verrou : sans lui, trois workers retireraient la même story
    // du fil trois fois par créneau.
    this.registry.register({
      name: 'story.expire',
      module: 'feed',
      schedule: every(5),
      handle: (ctx) => this.feed.expireStories(ctx.now),
    });

    // Le seul balayage qui n'a PAS de `now` : c'est un `UPDATE … WHERE score <>
    // positive_count - negative_count`, donc une comparaison d'état, sans notion
    // d'échéance. Rien à lui passer, et rien à lui reprocher.
    this.registry.register({
      name: 'story.score_recompute',
      module: 'feed',
      schedule: every(15),
      handle: () => this.feed.recomputeStoryScores(),
    });

    this.registry.register({
      name: 'story.purge_history',
      module: 'feed',
      schedule: dailyAt(4, 45),
      handle: (ctx) => this.feed.purgeStoryHistory(ctx.now),
    });

    // ── Agenda (09 §8) ───────────────────────────────────────────────────────
    //
    // `event.reminders` envoie J−1 et H−2 : le quart d'heure de §9.3 est une
    // borne de précision, pas un confort. À l'heure, un rappel « dans deux
    // heures » pourrait partir avec cinquante-neuf minutes de retard.
    this.registry.register({
      name: 'event.reminders',
      module: 'events',
      schedule: every(15),
      handle: (ctx) => this.events.sendDueReminders(ctx.now),
    });

    this.registry.register({
      name: 'event.mark_done',
      module: 'events',
      schedule: hourlyAt(5),
      handle: (ctx) => this.events.markDone(ctx.now),
    });

    this.registry.register({
      name: 'event.hide_cancelled',
      module: 'events',
      schedule: dailyAt(3, 40),
      handle: (ctx) => this.events.hideCancelled(ctx.now),
    });

    // ── Modération (13 §11) ──────────────────────────────────────────────────
    //
    // Les trois horaires sont décalées de cinq minutes : elles touchent les mêmes
    // tables (`moderation_cases`, `sanctions`) et se suivre plutôt que se croiser
    // évite des verrous de ligne inutiles.
    this.registry.register({
      name: 'moderation.release_stale',
      module: 'moderation',
      schedule: hourlyAt(10),
      handle: (ctx) => this.moderation.releaseStaleAssignments(ctx.now),
    });

    // Celle-ci REND l'accès à un compte suspendu dont la peine est purgée. Un
    // retard se voit côté membre, d'où l'heure et non la journée.
    this.registry.register({
      name: 'sanctions.expire',
      module: 'moderation',
      schedule: hourlyAt(15),
      handle: (ctx) => this.moderation.expireSanctions(ctx.now),
    });

    // `moderation.sla_alert` ÉCRIT l'alerte : une `staff_alerts` par compte équipe
    // actif et par dossier de priorité 1 hors délai (lot G). Avant, elle ne faisait
    // que lire et le journal de la tâche était la seule alerte observable.
    this.registry.register({
      name: 'moderation.sla_alert',
      module: 'moderation',
      schedule: every(15),
      handle: (ctx) => this.moderation.alertOverdueUrgentCases(ctx.now),
    });

    this.registry.register({
      name: 'scam_alerts.expire',
      module: 'moderation',
      schedule: dailyAt(4, 5),
      handle: (ctx) => this.moderation.expireScamAlerts(ctx.now),
    });

    this.registry.register({
      name: 'moderation.purge_reports',
      module: 'moderation',
      schedule: dailyAt(4, 10),
      handle: (ctx) => this.moderation.purgeOldReportDetails(ctx.now),
    });

    // ── Entraide (06 §7) ─────────────────────────────────────────────────────
    this.registry.register({
      name: 'help.archive',
      module: 'help',
      schedule: dailyAt(3, 0),
      handle: (ctx) => this.help.archiveDue(ctx.now),
    });

    // ── Parcours (03 §8) ─────────────────────────────────────────────────────
    //
    // LES TROIS TÂCHES DU MODULE 03. Elles figuraient dans la liste « ce qui manque
    // encore » ci-dessous : le module était livré, mais aucune des trois n'avait de
    // point d'entrée — seule la RÉPONSE à la relance (`POST /inactivity-response`)
    // existait, pas son déclencheur. Autrement dit l'écran de relance de §3.9, avec
    // ses quatre réponses, n'était montré à personne.
    //
    // §9.3 n'en nomme que DEUX (`journey.reminders`, `journey.inactivity_check`) ;
    // la troisième, `journey.progress_recompute`, vient du tableau du §8 du module.
    // Les deux tableaux se complètent plutôt qu'ils ne se contredisent, et les noms
    // sont ceux du module — c'est sous eux que le runbook les cherchera.
    this.registry.register({
      name: 'journey.reminders',
      module: 'journeys',
      schedule: hourlyAt(30),
      handle: (ctx) => this.journeys.sendDueReminders(ctx.now),
    });

    this.registry.register({
      name: 'journey.inactivity_check',
      module: 'journeys',
      schedule: dailyAt(2, 35),
      handle: (ctx) => this.journeys.runInactivityCheck(ctx.now),
    });

    // Posée dans la tranche des RECALCULS, avec les compteurs de réseaux et les
    // notes de parrains, et pour la même raison : elle ouvre une transaction par
    // parcours et n'a aucune raison de croiser un balayage qui expire des lignes.
    this.registry.register({
      name: 'journey.progress_recompute',
      module: 'journeys',
      schedule: dailyAt(4, 50),
      handle: (ctx) => this.journeys.recomputeAllProgress(ctx.now),
    });

    // ── Guides (05 §2) ───────────────────────────────────────────────────────
    this.registry.register({
      name: 'guide.freshness_recompute',
      module: 'guides',
      schedule: dailyAt(3, 10),
      handle: (ctx) => this.guides.recomputeFreshness(ctx.now),
    });

    this.registry.register({
      name: 'guide.proposal_escalation',
      module: 'guides',
      schedule: dailyAt(3, 20),
      handle: (ctx) => this.guides.escalateStaleProposals(ctx.now),
    });

    this.registry.register({
      name: 'guide.outdated_unpublish',
      module: 'guides',
      schedule: dailyAt(3, 25),
      handle: (ctx) => this.guides.unpublishOutdated(ctx.now),
    });

    // HEBDOMADAIRE et non quotidienne : §9.3 le dit, et la règle porte sur six
    // mois d'inactivité — la vérifier chaque nuit coûterait un balayage de la
    // table des membres pour un effet mensuel.
    this.registry.register({
      name: 'guide.author_inactivity',
      module: 'guides',
      schedule: weeklyAt(1, 5, 0),
      handle: (ctx) => this.guides.switchInactiveAuthorsToCommunity(ctx.now),
    });

    // La SEULE tâche de ce fichier qui vide un tampon Redis au lieu de balayer une
    // table — 05 §5 : « compteur approximatif (incrément Redis, flush horaire) ».
    //
    // Elle ne reçoit PAS `ctx.now`, et c'est exact : elle ne répond à aucune
    // échéance. Elle prélève ce qui s'est accumulé depuis le dernier passage, quel
    // que soit l'instant — son idempotence vient du prélèvement atomique, pas d'une
    // borne de temps. Voir `GuidesService.flushViewCounts`, où l'ordre des deux
    // opérations est tout le sujet.
    this.registry.register({
      name: 'guide.view_count_flush',
      module: 'guides',
      schedule: hourlyAt(35),
      handle: async () => this.guides.flushViewCounts(),
    });

    // ── Réseaux (07 §7) ──────────────────────────────────────────────────────
    this.registry.register({
      name: 'community.archive_inactive',
      module: 'communities',
      schedule: dailyAt(3, 30),
      handle: (ctx) => this.communities.archiveInactive(ctx.now),
    });

    this.registry.register({
      name: 'community.topic_archive',
      module: 'communities',
      schedule: dailyAt(3, 35),
      handle: (ctx) => this.communities.archiveStaleTopics(ctx.now),
    });

    // SEULE au bout de la tranche nocturne : c'est un `UPDATE` de toute la table
    // `communities` depuis une agrégation de `community_members`, la plus lourde
    // des vingt-sept. La laisser croiser un autre balayage ferait s'attendre deux
    // transactions longues.
    this.registry.register({
      name: 'community.member_count_recompute',
      module: 'communities',
      schedule: dailyAt(4, 30),
      handle: () => this.communities.recomputeMemberCounts(),
    });

    // ── Services : logement, emploi, annuaire (10 §9) ─────────────────────────
    //
    // §9.3 n'annonce qu'une ligne, `listing.expire` (« logement 60 jours, emploi
    // 45 jours »), mais les deux moitiés vivent dans deux modules et deux
    // méthodes. DEUX TÂCHES, donc, et non un gestionnaire qui appelle les deux :
    // sous un seul nom, une erreur côté logement empêcherait l'expiration des
    // offres d'emploi, et le verrou d'un balayage serait tenu par l'autre. Le nom
    // de la spec reste le préfixe, pour qu'on les trouve.
    this.registry.register({
      name: 'listing.expire.housing',
      module: 'housing',
      schedule: dailyAt(3, 45),
      handle: (ctx) => this.housing.expireDueListings(ctx.now),
    });

    this.registry.register({
      name: 'listing.expire.jobs',
      module: 'jobs',
      schedule: dailyAt(3, 50),
      handle: (ctx) => this.jobs.expireDueJobs(ctx.now),
    });

    this.registry.register({
      name: 'sponsored.expire',
      module: 'jobs',
      schedule: dailyAt(3, 55),
      handle: (ctx) => this.jobs.expireSponsorships(ctx.now),
    });

    this.registry.register({
      name: 'pro.tier_expire',
      module: 'pros',
      schedule: dailyAt(4, 0),
      handle: (ctx) => this.pros.expireTiers(ctx.now),
    });

    // APRÈS `listing.expire.housing` (3 h 45), et l'ordre est une règle, pas un
    // confort : la médiane ne compte que les annonces ACTIVES, et une annonce
    // expirée cette nuit ne doit plus y peser. Calculée avant l'expiration, la
    // médiane de la journée serait tirée par des annonces déjà mortes — et c'est
    // cette médiane qui décide de mettre une annonce en modération (§2.2).
    this.registry.register({
      name: 'housing.price_median_recompute',
      module: 'housing',
      schedule: dailyAt(4, 55),
      handle: (ctx) => this.housing.recomputePriceMedians(ctx.now),
    });

    // Module 10 §9 par son TRAVAIL, module 12 par son CODE : le répartiteur vit dans
    // `NotificationEventsService`, à côté du chemin par événement
    // (`onListingPublished`) avec lequel il partage `last_notified_at`, la fenêtre
    // d'une heure et le filtrage des critères. Deux copies de « cette alerte
    // correspond-elle ? » finiraient par ne plus répondre pareil, et le membre
    // recevrait deux fois, ou zéro fois.
    this.registry.register({
      name: 'alerts.dispatch',
      module: '10',
      schedule: hourlyAt(45),
      handle: (ctx) => this.notificationEvents.dispatchSavedAlerts(ctx.now),
    });

    // ── Parrainage et contacts (08 §10) ──────────────────────────────────────
    this.registry.register({
      name: 'mentorship.end_due',
      module: 'mentorship',
      schedule: dailyAt(4, 15),
      handle: (ctx) => this.mentorship.endDueMentorships(ctx.now),
    });

    // Deux tâches nommées « expire_requests » dans DEUX modules, avec deux délais
    // (7 jours pour un parrainage, 30 pour un contact) : le préfixe du nom n'est
    // pas décoratif, il est ce qui les distingue dans le journal et dans Redis.
    this.registry.register({
      name: 'mentorship.expire_requests',
      module: 'mentorship',
      schedule: dailyAt(4, 20),
      handle: (ctx) => this.mentorship.expireRequests(ctx.now),
    });

    this.registry.register({
      name: 'connection.expire_requests',
      module: 'connections',
      schedule: dailyAt(4, 25),
      handle: (ctx) => this.connections.expireRequests(ctx.now),
    });

    // Boucle sur tous les profils de mentor, une transaction chacun : posée en fin
    // de tranche, comme le recalcul des compteurs de réseaux, et pour la même
    // raison.
    this.registry.register({
      name: 'mentor.rating_recompute',
      module: 'mentorship',
      schedule: dailyAt(4, 40),
      handle: () => this.mentorship.recomputeAllRatings(),
    });

    // ── Référentiels (02 §2.2) ───────────────────────────────────────────────
    //
    // §2.2 mot pour mot : « Recalculé chaque nuit : membres actifs avec `city_id`
    // = cette ville. Utilisé par la carte. » Personne ne l'écrivait, et le
    // compteur valait donc zéro pour toutes les villes depuis toujours — ce qui
    // faisait sortir la carte dans l'ordre ALPHABÉTIQUE, son premier critère de
    // tri ne départageant rien. Voir le commentaire de la méthode.
    this.registry.register({
      name: 'city.member_count_recompute',
      module: '02',
      schedule: dailyAt(3, 5),
      handle: async () => ({ villes: await this.cities.recomputeMemberCounts() }),
    });

    // LUNDI 6 H, et la position n'est pas neutre : T4 §6 range « Villes à activer »
    // dans la revue HEBDOMADAIRE de l'équipe, qui se fait en semaine. La liste doit
    // donc être fraîche quand l'équipe arrive, et posée APRÈS le recalcul nocturne
    // des compteurs (3 h 05) qu'elle lit — une semaine de retard sur le compteur
    // ferait manquer une ville tout juste arrivée au seuil.
    //
    // Elle ne fait que LIRE. §2.2 réserve l'activation à une décision humaine, et
    // cette décision crée un réseau CITY et y inscrit des membres — ce qu'aucune
    // route ne défait. Même forme que `moderation.sla_alert`, et même raison.
    this.registry.register({
      name: 'city.activation_suggest',
      module: '02',
      schedule: weeklyAt(1, 6, 0),
      handle: async () => this.cities.suggestActivations(),
    });

    // ── Notifications (12 §6) ────────────────────────────────────────────────
    //
    // Les quatre cadences viennent de la documentation des méthodes elles-mêmes,
    // pas de mon interprétation. Une seule surprend, et c'est la bonne :
    // `weekly_digest` tourne CHAQUE HEURE, non le lundi à 8 h. §2.6 dit « lundi
    // 8 h par fuseau » et §6 « exécutions horaires avec filtre de fuseau » ; seule
    // la seconde lecture est réalisable, et c'est celle qu'implémente la méthode,
    // qui choisit ses destinataires selon LEUR fuseau. La poser le lundi à 8 h
    // heure de Paris ne servirait donc qu'un seul fuseau, et le nom de la tâche
    // aurait suffi à le faire croire correct.
    this.registry.register({
      name: 'notifications.quiet_hours_flush',
      module: '12',
      schedule: hourlyAt(10),
      handle: async ({ now }) => this.notifications.flushQuietHours(now),
    });
    this.registry.register({
      name: 'notifications.weekly_digest',
      module: '12',
      schedule: hourlyAt(25),
      handle: async ({ now }) => this.notifications.weeklyDigest(now),
    });
    this.registry.register({
      name: 'notifications.purge',
      module: '12',
      schedule: dailyAt(3, 15),
      handle: async ({ now }) => this.notifications.purge(now),
    });
    this.registry.register({
      name: 'push.cleanup',
      module: '12',
      schedule: dailyAt(3, 25),
      handle: async () => ({ abonnements: await this.notifications.cleanupPushSubscriptions() }),
    });

    // ── Équipe (15 §10) ──────────────────────────────────────────────────────
    //
    // Supprime, là où les sessions de MEMBRES sont conservées trente jours (00
    // §8.4) : une session d'équipe expirée n'a aucune valeur d'enquête, la trace
    // de la connexion étant dans `audit_logs` pour cinq ans, et plus complète.
    this.registry.register({
      name: 'staff.session_cleanup',
      module: '15',
      schedule: hourlyAt(40),
      handle: async ({ now }) => ({ sessions: await this.staffAuth.cleanupSessions(now) }),
    });

    // ── Monétisation (14 §10) ────────────────────────────────────────────────
    //
    // Les QUATRE tâches du §10 qui ont désormais une méthode. `billing.expiry_reminders`
    // était nommément citée par la liste « ce qui manque encore » ci-dessous : elle
    // en sort.
    //
    // `affiliate.reconcile` (quotidienne) reste ABSENTE : §10 la décrit comme un
    // « import automatique SI le partenaire expose une API », et aucun partenaire
    // n'est configuré — il n'y a donc aucune API à interroger. L'import manuel de
    // CSV existe, lui : `POST /admin/billing/affiliate/import`.
    this.registry.register({
      name: 'billing.expiry_reminders',
      module: 'billing',
      schedule: dailyAt(5, 10),
      handle: (ctx) => this.billing.sendExpiryReminders(ctx.now),
    });

    // Horaire, et à la minute 15 : une expiration à l'heure près suffit (la grâce
    // se compte en jours), mais pas à la journée — un membre qui renouvelle doit
    // retrouver son Premium dans l'heure.
    this.registry.register({
      name: 'billing.expire_subscriptions',
      module: 'billing',
      schedule: hourlyAt(15),
      handle: (ctx) => this.billing.expireSubscriptions(ctx.now),
    });

    this.registry.register({
      name: 'billing.trial_end',
      module: 'billing',
      schedule: hourlyAt(20),
      handle: (ctx) => this.billing.endTrials(ctx.now),
    });

    // §10 l'appelle `usage.reset` et explique aussitôt qu'il n'y a rien à
    // réinitialiser : « les compteurs sont par `period_key`, donc simple purge à
    // 13 mois ». Le NOM de la spec est gardé — c'est celui qu'on cherchera dans le
    // journal — et le travail est bien une purge. Mensuelle : une purge quotidienne
    // de treize mois d'historique ne trouverait rien 29 jours sur 30.
    this.registry.register({
      name: 'usage.reset',
      module: 'billing',
      schedule: dailyAt(5, 20),
      handle: (ctx) => this.billing.purgeUsageCounters(ctx.now),
    });

    // ── Compte et identité (01 §8) ───────────────────────────────────────────
    //
    // `account.deletion_execute` est HORAIRE, comme §8 et §9.3 le disent, et non
    // quotidienne : le délai de sept jours est une promesse faite au membre
    // (« votre compte sera supprimé le … »), et l'exécuter à une heure fixe le
    // ferait attendre jusqu'à vingt-quatre heures de plus. C'est aussi la tâche que
    // dix autres modules attendaient : `user.deleted` avait dix consommateurs et
    // aucun producteur, donc AUCUN nettoyage de suppression de compte n'avait jamais
    // lieu, dans aucun module.
    this.registry.register({
      name: 'account.deletion_execute',
      module: 'users',
      schedule: hourlyAt(20),
      handle: (ctx) => this.account.executeDueDeletions(ctx.now),
    });

    // §8 : « Défis expirés depuis plus de 24 h. » Horaire, décalée de la
    // précédente : les deux effacent, mais dans des tables sans rapport.
    this.registry.register({
      name: 'otp.purge',
      module: 'users',
      schedule: hourlyAt(25),
      handle: (ctx) => this.account.purgeOtpChallenges(ctx.now),
    });

    this.registry.register({
      name: 'user.phase_progression',
      module: 'users',
      schedule: dailyAt(2, 30),
      handle: (ctx) => this.account.progressPhases(ctx.now),
    });

    // Celle-ci SUPPRIME des comptes : elle est posée seule, avant la tranche des
    // recalculs, pour qu'un incident sur elle se lise sans être noyé.
    this.registry.register({
      name: 'account.deactivated_purge',
      module: 'users',
      schedule: dailyAt(2, 45),
      handle: (ctx) => this.account.purgeDeactivated(ctx.now),
    });

    // §8 : « `IN_PROGRESS` → `EXPIRED` après 48 h sans résultat. » Quotidienne
    // suffit : la borne est à 48 h, et un membre dont la session vient d'expirer
    // peut de toute façon en ouvrir une autre sans attendre (aucun délai après un
    // `EXPIRED`, voir `KycService.retryAvailableAt`).
    this.registry.register({
      name: 'kyc.expire_sessions',
      module: 'kyc',
      schedule: dailyAt(2, 50),
      handle: (ctx) => this.kyc.expireStaleSessions(ctx.now),
    });

    // §8 : « Archives expirées ». Elle SORT de la liste « ce qui manque encore » :
    // `POST /me/export` est livrée, donc `data_exports` se remplit et il y a
    // désormais quelque chose à purger. Posée APRÈS la tranche des recalculs :
    // elle supprime des octets dans le stockage objet, c'est-à-dire qu'elle fait
    // des appels réseau sortants, et une tranche nocturne chargée les ferait
    // expirer.
    this.registry.register({
      name: 'export.purge',
      module: 'users',
      schedule: dailyAt(5, 30),
      handle: (ctx) => this.dataExports.purgeExpired(ctx.now),
    });

    // ── Transverse (00 §8.4 et §9.3) ─────────────────────────────────────────
    //
    // LES DEUX TÂCHES QUE §9.3 ÉTIQUETTE « transverse », et qui n'appartiennent donc
    // à aucun module. Toutes deux sortent de la liste « ce qui manque encore ».
    //
    // `retention.purge` applique §8.4. Sur ses sept durées, six avaient déjà leur
    // tâche ou n'avaient rien à purger ; la septième — « sessions expirées :
    // 30 jours » — n'était tenue par PERSONNE. `staff.session_cleanup` ne voit que
    // les sessions d'équipe, et le gestionnaire de suppression de compte ne vide
    // `auth_sessions` que du membre supprimé : les sessions expirées de tous les
    // autres s'accumulaient sans fin. Le détail ligne par ligne est dans le
    // commentaire de la méthode, avec ce qu'elle ne purge pas et pourquoi.
    //
    // Posée à 2 h 55, dans la tranche des purges (2 h 45 comptes désactivés, 2 h 50
    // sessions KYC) et AVANT les recalculs : elle efface, et un incident sur un
    // effacement se lit mieux seul.
    this.registry.register({
      name: 'retention.purge',
      module: 'transverse',
      schedule: dailyAt(2, 55),
      handle: (ctx) => this.account.purgeExpiredSessions(ctx.now),
    });

    // `bookmark.state_refresh` calcule l'état des contenus enregistrés (01 §2.9).
    //
    // Les quatre routes de §2.9 SONT livrées (`bookmarks.controller.ts` :
    // `GET`/`PUT /me/bookmarks`, `GET /me/bookmarks/states`,
    // `DELETE /me/bookmarks/:type/:id`) : la tâche a donc des signets à balayer et
    // un lecteur — l'écran « Enregistrés » lit `bookmarks.state`. (Une version
    // précédente de ce commentaire disait le contraire ; elle est périmée.)
    //
    // À la minute 55, la dernière de l'heure : elle lit l'état de douze tables que
    // d'autres tâches horaires modifient (`event.mark_done` à 5, `sanctions.expire`
    // à 15, `billing.expire_subscriptions` à 15…), et lire après elles donne un
    // état stable plutôt qu'un instantané pris en pleine écriture.
    this.registry.register({
      name: 'bookmark.state_refresh',
      module: 'transverse',
      schedule: hourlyAt(55),
      handle: (ctx) => this.bookmarks.refreshStates(ctx.now),
    });

    // ── Pilotage (15 §10) ────────────────────────────────────────────────────
    //
    // LES QUATRE TÂCHES QUE `metric_snapshots` DÉBLOQUE. Elles étaient les seules
    // de tout le dossier à n'avoir NI méthode NI table : §6 annonçait la table
    // « Ajoutée », elle ne l'était pas, et `docs/decisions.md` le notait déjà —
    // « `metric_snapshots` absente bloque les trois tableaux de bord du §5 ».
    // La table existe maintenant ; voici les quatre déclencheurs.
    //
    // La cinquième de §10, `staff.session_cleanup`, est plus haut (module 15 déjà
    // livré). La sixième, `audit.retention`, reste ABSENTE — voir la liste en fin
    // de fichier : elle SUPPRIME des lignes d'`audit_logs`, table en ajout seul
    // protégée par un déclencheur PostgreSQL (`audit_logs_append_only`), et aucune
    // méthode ne peut donc l'écrire sans lever la protection. Ce n'est pas un
    // oubli, c'est un arbitrage qui appartient au propriétaire.

    // Horaire, à la minute 50 : la dernière de l'heure, pour lire un état stable
    // plutôt que de compter pendant qu'une autre tâche écrit.
    this.registry.register({
      name: 'metrics.refresh',
      module: '15',
      schedule: hourlyAt(50),
      handle: (ctx) => this.analytics.refreshMetrics(ctx.now),
    });

    // §10 : quotidienne — « présence à 90 jours par ville ». Posée après
    // `event.mark_done` (horaire, minute 5) et loin de la tranche nocturne : elle
    // fait une jointure sur `event_attendees`, que `event.mark_done` met à jour.
    this.registry.register({
      name: 'metrics.key_indicator',
      module: '15',
      schedule: dailyAt(5, 40),
      handle: (ctx) => this.analytics.refreshKeyIndicator(ctx.now),
    });

    // §10 : hebdomadaire. Le dimanche, et non le lundi : §5.2 alimente les
    // MODÈLES de parcours, que l'équipe révise en semaine — la statistique doit
    // être fraîche quand elle arrive au bureau, pas en train de tourner.
    this.registry.register({
      name: 'stats.steps_recompute',
      module: '15',
      schedule: weeklyAt(0, 5, 50),
      handle: (ctx) => this.analytics.recomputeStepStats(ctx.now),
    });

    // §10 : « 1er jour du trimestre ». La méthode prépare le trimestre ÉCOULÉ —
    // voir son commentaire : au 1er janvier, le financeur attend octobre-décembre.
    this.registry.register({
      name: 'impact.quarterly_prepare',
      module: '15',
      schedule: quarterlyAt(6, 0),
      handle: (ctx) => this.impact.prepareQuarter(ctx.now),
    });

    /**
     * ── CE QUI MANQUE ENCORE ─────────────────────────────────────────────────
     *
     * DEUX TÂCHES, et aucune des deux n'est un oubli.
     *
     * LE DÉCOMPTE, parce qu'il a déjà été faux deux fois. Les quatorze tableaux
     * « Tâches » des modules, réunis à §9.3, nomment CINQUANTE-HUIT tâches
     * distinctes — `event.waitlist_promote` mise à part, 09 §8 disant lui-même « à la
     * désinscription (immédiat, pas planifié) », et elle est tenue par le service.
     * De ces cinquante-huit : `outbox.relay` appartient à `OutboxRelayService` ;
     * cinquante-cinq sont câblées ci-dessus sous CINQUANTE-SIX entrées (`listing.expire`
     * en compte deux, une par module, pour la raison écrite plus haut) ; restent les
     * deux qui suivent.
     *
     *   · `audit.retention` (quotidienne) — 15 §10 la donnait à « 5 ans », en
     *     contradiction avec §2.3 (« Aucune suppression possible »). LE PORTEUR A
     *     TRANCHÉ : « on ne supprime jamais ». La rétention du journal est ILLIMITÉE,
     *     la tâche est retirée de la spec (15 §10) et n'existera pas. `audit_logs` est
     *     en AJOUT SEUL par deux déclencheurs PostgreSQL (`audit_logs_append_only`,
     *     `audit_logs_no_truncate`) qui font LEVER tout UPDATE, DELETE ou TRUNCATE, et
     *     aucune clé étrangère ne l'atteint. Le test
     *     `common/__tests__/audit-jamais-supprime.int.test.ts` ÉCHOUE si une tâche,
     *     une purge ou une cascade apparaît ;
     *   · `affiliate.reconcile` (quotidienne) — module 14 : §10 la conditionne à un
     *     partenaire qui expose une API (« import automatique SI le partenaire
     *     expose une API »), et aucun partenaire n'est configuré. Il n'y a donc
     *     AUCUNE API à interroger, et les deux événements qu'elle produirait
     *     (`affiliate.clicked`, `affiliate.converted`) sont volontairement hors du
     *     catalogue de `outbox.service.ts`, faute de consommateur. Une
     *     réconciliation qui fabriquerait ses chiffres serait pire que son absence :
     *     elle porterait sur de l'argent. L'import manuel de CSV, lui, est livré :
     *     `POST /admin/billing/affiliate/import`.
     *
     * CE QUI EST SORTI DE CETTE LISTE, et c'est le seul endroit où cela se lit :
     * les trois du module 03 (`journey.reminders`, `journey.inactivity_check`,
     * `journey.progress_recompute`) — le module était livré, mais aucune n'avait de
     * point d'entrée, si bien que l'écran de relance de §3.9 et ses quatre réponses
     * n'étaient montrés à personne ; `city.activation_suggest` (02 §7) ;
     * `guide.view_count_flush` (05 §7), avec la colonne `guides.view_count` et son
     * compteur Redis, que §5 annonçait « Ajoutée » et qui ne l'était pas ;
     * `housing.price_median_recompute` et `alerts.dispatch` (10 §9) ;
     * `retention.purge` et `bookmark.state_refresh` (transverse).
     *
     * CE QUI RESTE VRAI, ET CE QUI A ÉTÉ TRANCHÉ (lot G) :
     *
     *   · `guides.view_count` N'A AUCUN LECTEUR, et c'est VOULU. 05 §5 exige la
     *     colonne (« Ajoutée, compteur approximatif ») et 05 §7 la tâche
     *     `guide.view_count_flush` ; la règle dure 00 §1.2 interdit d'exposer un
     *     compteur de vues « à personne, sur aucun contenu », et 15 §5.1 ne le
     *     liste pas parmi les indicateurs « Guides ». Ajouter un lecteur violerait la
     *     spec, retirer la tâche aussi : le compteur est conservé comme donnée
     *     interne du produit, sans route ni écran. Même situation que
     *     `housing_listings.view_count` et `pro_profiles.view_count` ;
     *   · `bookmark.state_refresh` A UN LECTEUR depuis que les routes de 01 §2.9 sont
     *     livrées : voir son enregistrement plus haut.
     *
     * Le jour où la méthode existe, une entrée de ce fichier suffit. Rien d'autre
     * ne change, ni dans le registre, ni dans le planificateur.
     */

    this.logger.log(`${this.registry.all().length} tâche(s) planifiée(s) enregistrée(s) (§9.3)`);
  }
}
