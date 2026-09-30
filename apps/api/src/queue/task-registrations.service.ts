import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { CitiesService } from '../modules/cities/cities.service';
import { CommunitiesService } from '../modules/communities/communities.service';
import { ConnectionsService } from '../modules/connections/connections.service';
import { EventsService } from '../modules/events/events.service';
import { FeedService } from '../modules/feed/feed.service';
import { GuidesService } from '../modules/guides/guides.service';
import { HelpService } from '../modules/help/help.service';
import { HousingService } from '../modules/housing/housing.service';
import { JobsService } from '../modules/jobs/jobs.service';
import { MentorshipService } from '../modules/mentorship/mentorship.service';
import { ModerationService } from '../modules/moderation/moderation.service';
import { NotificationsService } from '../modules/notifications/notifications.service';
import { ProsService } from '../modules/pros/pros.service';
import { StaffAuthService } from '../modules/admin/staff-auth.service';
import { BillingService } from '../modules/billing/billing.service';
import { AccountService } from '../modules/users/account.service';
import { KycService } from '../modules/kyc/kyc.service';
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
 * DEUX TÂCHES DE §9.3 NE SONT PAS ICI, et c'est volontaire :
 *   · `outbox.relay` (1 s) — déjà tenue par `OutboxRelayService`, à son propre
 *     rythme. Un travail BullMQ par seconde coûterait plus que le balayage lui-même ;
 *   · les tâches dont AUCUN module n'expose encore la méthode. Elles sont listées
 *     en fin de fichier, pour que l'écart avec §9.3 se lise ici plutôt que de se
 *     découvrir en production.
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
    private readonly dataExports: DataExportService,
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

    // `moderation.sla_alert` ne fait pour l'instant que LIRE : `overdueUrgentCases`
    // rend les dossiers de priorité 1 hors SLA, sans notifier personne — le module
    // 12 n'existe pas encore. La tâche est enregistrée quand même : sa ligne de
    // journal est aujourd'hui la seule alerte SLA que le runbook §4 puisse
    // observer, et le jour où les notifications arrivent, seul le gestionnaire
    // change.
    this.registry.register({
      name: 'moderation.sla_alert',
      module: 'moderation',
      schedule: every(15),
      handle: (ctx) => this.moderation.overdueUrgentCases(ctx.now),
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
      handle: (ctx) => this.analytics.prepareQuarterlyImpact(ctx.now),
    });

    /**
     * ── CE QUI MANQUE ENCORE ─────────────────────────────────────────────────
     *
     * Ce qui reste n'a AUCUNE méthode de service à appeler — sauf le module 03, qui
     * est livré mais n'expose pas de point d'entrée. Rien n'est enregistré : un
     * gestionnaire vide serait pire qu'une absence, puisque le journal de démarrage
     * affirmerait que la tâche tourne.
     *
     *   · `audit.retention` (quotidienne) — 15 §10, « 5 ans ». `audit_logs` est en
     *     AJOUT SEUL, et pas seulement par convention : la migration
     *     `append_only_truncate_guard` y pose deux déclencheurs PostgreSQL
     *     (`audit_logs_append_only`, `audit_logs_no_truncate`) qui font LEVER tout
     *     UPDATE, DELETE ou TRUNCATE. Écrire la tâche demanderait donc de retirer
     *     une protection posée exprès contre §2.3 (« Aucune suppression
     *     possible »). §2.3 et §10 se contredisent — cinq ans de rétention
     *     supposent un effacement au bout de cinq ans — et l'arbitrage appartient
     *     au propriétaire, pas à ce fichier ;
     *   · `city.activation_suggest` (hebdomadaire) — 02 §7 : signale à l'équipe les
     *     villes inactives à plus de 20 membres. Aucune méthode côté `CitiesService` ;
     *   · `guide.view_count_flush` (horaire) — 05 §7 : aucun compteur de vues n'est
     *     tenu en cache, donc rien à vider ;
     *   · `housing.price_median_recompute` et `alerts.dispatch` (10 §9) — aucune
     *     méthode côté `HousingService` ni de répartiteur d'alertes ;
     *   · `bookmark.state_refresh` (horaire) et `retention.purge` (quotidienne) —
     *     transverse. Noter que `notifications.purge` couvre la conservation de
     *     90 jours du module 12, mais PAS la rétention transverse du §9.3, qui
     *     porte sur d'autres tables.
     *   · `affiliate.reconcile` (quotidienne) — module 14 : §10 la conditionne à un
     *     partenaire qui expose une API, et aucun partenaire n'est configuré. Il n'y
     *     a donc rien à interroger. L'import CSV, lui, est livré en route d'équipe.
     *
     * `billing.expiry_reminders` et `notifications.weekly_digest` ne sont PLUS dans
     * cette liste : les modules 14 et 12 les ont livrées. `export.purge` non plus,
     * ni les quatre tâches de pilotage de 15 §10 — l'export RGPD et la table
     * `metric_snapshots` sont livrés. Chaque ligne qui en sort est un trou comblé,
     * et c'est le seul endroit où cela se lit.
     *
     * Trois autres du module 03 attendent une méthode publique : le module est
     * livré, mais `journey.reminders`, `journey.inactivity_check` et
     * `journey.progress_recompute` n'ont pas de point d'entrée — seule la RÉPONSE
     * à la relance (`POST /inactivity-response`) existe, pas son déclencheur.
     *
     * Le jour où la méthode existe, une entrée de ce fichier suffit. Rien d'autre
     * ne change, ni dans le registre, ni dans le planificateur.
     */

    this.logger.log(`${this.registry.all().length} tâche(s) planifiée(s) enregistrée(s) (§9.3)`);
  }
}
