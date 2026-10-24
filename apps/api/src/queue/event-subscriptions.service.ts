import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { CitiesService } from '../modules/cities/cities.service';
import { CommunitiesService } from '../modules/communities/communities.service';
import { GuidesService } from '../modules/guides/guides.service';
import { HelpService } from '../modules/help/help.service';
import { HousingService } from '../modules/housing/housing.service';
import { JobsService } from '../modules/jobs/jobs.service';
import { ConnectionsService } from '../modules/connections/connections.service';
import { FeedService } from '../modules/feed/feed.service';
import { JourneysService } from '../modules/journeys/journeys.service';
import { MentorshipService } from '../modules/mentorship/mentorship.service';
import { MessagingService } from '../modules/messaging/messaging.service';
import { ModerationEffectsService } from '../modules/moderation/moderation-effects.service';
import { ModerationService } from '../modules/moderation/moderation.service';
import { ProsService } from '../modules/pros/pros.service';
import { NotificationEventsService } from '../modules/notifications/notifications.events';
import { NotificationsService } from '../modules/notifications/notifications.service';
import { SearchService } from '../modules/search/search.service';
import { BillingService } from '../modules/billing/billing.service';
import { DataExportService } from '../modules/exports/data-export.service';
import { RealtimeRelayService } from '../modules/realtime/realtime.relay';
import type { DomainEventType } from '../common/outbox.service';
import { EventHandlerRegistry } from './event-handlers';

/**
 * Le câblage des consommateurs d'événements.
 *
 * TOUT est ici, et nulle part ailleurs. Deux raisons :
 *
 *   · les services métier restent IGNORANTS de la file. Ils exposent des méthodes
 *     publiques — `syncAutoMemberships`, `handleUserDeleted` — et se construisent
 *     avec Prisma et deux ou trois dépendances. Leurs tests d'intégration n'ont
 *     donc besoin ni de Redis ni de BullMQ, ce qui est la différence entre une
 *     suite qui tourne en dix secondes et une qui demande un environnement ;
 *   · on lit en un coup d'œil QUI écoute QUOI. Éparpillés dans vingt-quatre
 *     `onModuleInit`, les abonnements deviennent invisibles, et on découvre qu'un
 *     événement n'avait aucun lecteur des mois plus tard — ce qui vient
 *     précisément d'arriver à `user.onboarded_location`.
 *
 * Le couplage que ce fichier introduit est celui d'un fichier de câblage, au même
 * titre que `app.module.ts`. C'est le bon endroit pour le porter.
 */
@Injectable()
export class EventSubscriptionsService implements OnModuleInit {
  private readonly logger = new Logger(EventSubscriptionsService.name);

  constructor(
    private readonly registry: EventHandlerRegistry,
    private readonly communities: CommunitiesService,
    private readonly help: HelpService,
    private readonly guides: GuidesService,
    private readonly housing: HousingService,
    private readonly jobs: JobsService,
    private readonly pros: ProsService,
    private readonly moderation: ModerationService,
    private readonly mentorship: MentorshipService,
    private readonly connections: ConnectionsService,
    private readonly messaging: MessagingService,
    private readonly feed: FeedService,
    private readonly journeys: JourneysService,
    private readonly notifications: NotificationsService,
    private readonly notificationEvents: NotificationEventsService,
    private readonly search: SearchService,
    private readonly billing: BillingService,
    private readonly dataExports: DataExportService,
    private readonly cities: CitiesService,
    private readonly realtime: RealtimeRelayService,
    private readonly moderationEffects: ModerationEffectsService,
  ) {}

  onModuleInit(): void {
    // ── Réseaux : l'adhésion automatique (07 §6) ─────────────────────────────
    //
    // C'est la chaîne que l'onboarding promet : l'écran du lieu inscrit le membre
    // aux réseaux de sa ville et de son pays. `syncAutoMemberships` est un
    // RECALCUL idempotent, donc un rejeu ne duplique rien et ne bouge aucun
    // compteur — ce qui est exactement ce qu'une livraison « au moins une fois »
    // exige.
    this.registry.on('user.onboarded_location', 'communities', async (job) => {
      await this.communities.syncAutoMemberships(job.aggregateId);
    });

    // Un changement de ville réaffecte le membre. L'événement n'est pas encore
    // émis par le module 01 — l'abonnement l'attend, plutôt que d'être oublié le
    // jour où il arrivera.
    this.registry.on('user.phase_changed', 'communities', async (job) => {
      await this.communities.syncAutoMemberships(job.aggregateId);
    });

    // ── Suppression de compte (01 §2.8) ──────────────────────────────────────
    //
    // Chaque module nettoie SA part. Les deux gestionnaires sont indépendants :
    // l'échec de l'un ne doit pas empêcher l'autre d'anonymiser ses contenus, et
    // le registre les isole pour cette raison.
    /**
     * 01 §2.8 — la génération ASYNCHRONE de l'archive RGPD.
     *
     * Le seul consommateur de `user.export_requested`, et la raison pour laquelle
     * la route `POST /me/export` rend `202` : c'est ici que l'archive naît, dans
     * le worker, après le COMMIT de la demande. `generate` est idempotente — le
     * relais garantit « au moins une fois » — et ne régénère rien si l'archive
     * existe déjà.
     */
    this.registry.on('user.export_requested', 'users', async (job) => {
      const payload = job.payload as { exportId?: unknown };
      if (typeof payload?.exportId !== 'string') return;
      await this.dataExports.generate(payload.exportId);
    });

    /**
     * 08 §7.3 — la poussée temps réel d'un message.
     *
     * Le MÊME événement que les notifications consomment, et c'est voulu : §5.3
     * veut le temps réel ET le repli, donc la poussée ne remplace pas la
     * notification, elle la double pour les membres connectés. Deux
     * enregistrements distincts, comme le registre le fait partout ailleurs :
     * un échec de la poussée ne doit pas empêcher la notification de partir.
     *
     * AUCUN CORPS DE MESSAGE dans la charge (§8.1). `recipientUserIds` vient de
     * l'émetteur, qui a déjà exclu l'expéditeur.
     */
    /**
     * ── Fraîcheur des guichets d'une ville (09 §2.3) ─────────────────────────
     *
     * UN LECTEUR SANS ÉVÉNEMENT — le miroir exact de ce que le préambule de ce
     * fichier raconte à propos de `user.onboarded_location`.
     *
     * `CitiesService.desks()` garde cinq minutes en mémoire, et la seule purge
     * vivait dans `createTip`, qui écrit `city_tips`. Or `desks()` lit `stories` :
     * la purge ne pouvait RIEN changer, et rien sur le chemin des stories ne
     * purgeait. Mesuré par l'agent qui branchait la fiche ville : une information
     * de guichet publiée par `POST /stories` est restée invisible jusqu'au
     * redémarrage du processus, la route continuant de rendre
     * `{"items":[],"meta":{"cached":true}}`.
     *
     * DEUX événements, et le choix est vérifié. `story.expired` compte autant que
     * `story.published` : sans elle, le cache maintiendrait une information en vie
     * cinq minutes de plus que sa propre échéance.
     *
     * `story.converted` est EXCLUE, et ce n'est pas un oubli : la conversion
     * n'écrit que `convertedToType` et `convertedToId` — ni le statut, ni
     * l'échéance, ni le lieu. La story reste légitimement sur la fiche, donc il
     * n'y a rien à oublier. `story.deleted` n'existe pas : ce n'est pas un type du
     * domaine, et le compilateur l'a dit quand j'ai essayé de m'y abonner.
     *
     * `cityId` vient de la charge — une story n'est pas toujours rattachée à une
     * ville, et sans ville il n'y a pas de fiche à oublier.
     */
    for (const type of ['story.published', 'story.expired'] as const) {
      this.registry.on(type, 'cities', async (job) => {
        const cityId = (job.payload as { cityId?: string | null } | null)?.cityId;
        if (typeof cityId === 'string') this.cities.oublierGuichets(cityId);
        return Promise.resolve();
      });
    }

    this.registry.on('message.sent', 'realtime', async (job) => {
      const payload = job.payload as {
        conversationId?: unknown;
        messageId?: unknown;
        recipientUserIds?: unknown;
        senderUserId?: unknown;
      };
      const recipients: unknown[] = Array.isArray(payload?.recipientUserIds) ? (payload.recipientUserIds as unknown[]) : [];
      for (const userId of recipients) {
        if (typeof userId !== 'string') continue;
        await this.realtime.publish(userId, 'message.new', {
          conversationId: payload.conversationId,
          messageId: payload.messageId,
        });
      }
      // `conversation.updated` va à TOUS, expéditeur compris : la liste se
      // réordonne chez chacun (la conversation remonte), et les autres onglets de
      // l'expéditeur voient arriver leur propre message. Les destinataires reçoivent
      // donc deux événements pour un message ; le client les fusionne en un seul
      // rechargement (`lib/temps-reel`).
      const everyone = [...recipients, payload?.senderUserId];
      for (const userId of everyone) {
        if (typeof userId !== 'string') continue;
        await this.realtime.publish(userId, 'conversation.updated', {
          conversationId: payload.conversationId,
          reason: 'message',
        });
      }
    });

    // 08 §3.1 : deux présents au même événement, un auteur et son contributeur →
    // « Ajouter X à vos contacts ? ». Voir `ConnectionsService.emitSuggestions`.
    this.registry.on('event.checked_in', 'connections', async (job) => {
      const userIds = (job.payload as { userIds?: unknown } | null)?.userIds;
      if (!Array.isArray(userIds)) return;
      await this.connections.emitSuggestions(
        userIds.filter((u): u is string => typeof u === 'string'),
        'EVENT',
        job.aggregateId,
      );
    });
    this.registry.on('guide.proposal_accepted', 'connections', async (job) => {
      const p = job.payload as { guideId?: unknown; proposerUserId?: unknown } | null;
      if (typeof p?.guideId !== 'string' || typeof p.proposerUserId !== 'string') return;
      await this.connections.emitSuggestions([p.proposerUserId], 'GUIDE', p.guideId);
    });

    this.registry.on('user.deleted', 'help', async (job) => {
      await this.help.handleUserDeleted(job.aggregateId);
    });

    this.registry.on('user.deleted', 'guides', async (job) => {
      await this.guides.handleUserDeleted(job.aggregateId);
    });

    this.registry.on('user.deleted', 'housing', async (job) => {
      await this.housing.handleUserDeleted(job.aggregateId);
    });

    // 03 §9 : les parcours du membre sont supprimés, ses places d'équipe retirées, ses
    // corrections de modèle anonymisées.
    this.registry.on('user.deleted', 'journeys', async (job) => {
      await this.journeys.handleUserDeleted(job.aggregateId);
    });

    this.registry.on('user.deleted', 'jobs', async (job) => {
      await this.jobs.handleUserDeleted(job.aggregateId);
    });

    this.registry.on('user.deleted', 'pros', async (job) => {
      await this.pros.handleUserDeleted(job.aggregateId);
    });

    // ── Annuaire professionnel : la recommandation suit le contact ────────────
    //
    // 10 §4.3 conditionne une recommandation pro à l'existence d'une `connection`.
    // Elle doit donc disparaître quand le contact disparaît — sinon l'annuaire
    // afficherait une recommandation que son auteur ne pourrait plus poster.
    //
    // La charge est lue DÉFENSIVEMENT : le producteur (module 08) n'existe pas
    // encore, et un gestionnaire qui suppose une forme se casse le jour où elle
    // arrive autrement.
    this.registry.on('connection.removed', 'pros', async (job) => {
      const connectionId = readString(job.payload, 'connectionId');
      // Une charge inattendue ne doit pas mettre le travail en échec indéfiniment :
      // il n'y a rien à faire, et lever le ferait rejouer dix fois pour rien.
      if (connectionId === null) return;
      await this.pros.handleConnectionRemoved(connectionId);
    });

    this.registry.on('user.blocked', 'pros', async (job) => {
      const blocker = readString(job.payload, 'blockerUserId');
      const blocked = readString(job.payload, 'blockedUserId');
      if (blocker === null || blocked === null) return;
      await this.pros.handleUserBlocked(blocker, blocked);
    });

    // ── Modération (13 §6) ───────────────────────────────────────────────────
    //
    // Le module de modération n'écrit dans AUCUNE table de contenu : il ouvre des
    // dossiers et émet `moderation.content_hidden`. Chaque module de contenu
    // appliquera l'effet sur sa propre table en s'y abonnant à son tour — c'est
    // ce qui lui évite de connaître les douze types de sujet.
    this.registry.on('user.deleted', 'moderation', async (job) => {
      await this.moderation.handleUserDeleted(job.aggregateId);
    });

    // §4.4, anti-abus : plus de 20 blocages en 30 jours ouvre un dossier. Le
    // service de blocage se contentait de journaliser, faute de ce module.
    this.registry.on('user.blocked', 'moderation', async (job) => {
      const blocker = readString(job.payload, 'blockerUserId');
      if (blocker === null) return;
      await this.moderation.handleUserBlocked(blocker);
    });

    this.registry.on('report.created', 'moderation', async (job) => {
      await this.moderation.handleReportCreated(job.aggregateId);
    });

    // L'analyse IA d'un contenu publié. Asynchrone par construction : §2.3 ne
    // laisse jamais l'IA empêcher une publication, elle masque après coup.
    this.registry.on('help_request.published', 'moderation', async (job) => {
      await this.moderation.handleContentPublished('HELP_REQUEST', job.aggregateId);
    });

    this.registry.on('event.published', 'moderation', async (job) => {
      await this.moderation.handleContentPublished('EVENT', job.aggregateId);
    });

    // ── TOUS les contenus publiés passent par le pipeline (lot G) ────────────
    //
    // Chaque événement ci-dessous nomme le sujet par `aggregateId` ; le texte est
    // RELU depuis la table (`ModerationService.contentText`), jamais lu dans
    // l'événement. Les modules refusent déjà en SYNCHRONE ce que les règles
    // locales interdisent (`ModerationService.gate`) ; ce qui suit est l'étape
    // asynchrone du §2 : analyse IA, dossier, masquage automatique.
    const published: readonly [Parameters<ModerationService['handleContentPublished']>[0], DomainEventType][] = [
      ['POST', 'post.published'],
      ['STORY', 'story.published'],
      ['GUIDE', 'guide.published'],
      ['HOUSING', 'housing.published'],
      ['JOB', 'job.published'],
      ['CITY_TIP', 'city_tip.published'],
      ['PRO', 'pro.registered'],
      ['TOPIC', 'community.topic_created'],
    ];
    for (const [subjectType, eventType] of published) {
      this.registry.on(eventType, 'moderation', async (job) => {
        await this.moderation.handleContentPublished(subjectType, job.aggregateId);
      });
    }
    // Un commentaire (fil, réponse de sujet de réseau, guide, événement) : le
    // sujet de l'événement est la PUBLICATION, le commentaire est dans la charge.
    this.registry.on('post.commented', 'moderation', async (job) => {
      const commentId = readString(job.payload, 'commentId');
      if (commentId === null) return;
      await this.moderation.handleContentPublished('COMMENT', commentId);
    });

    // Les EFFETS du masquage, du rétablissement et du retrait sur les tables des
    // autres modules (voir `ModerationEffectsService`). Le masquage des POST,
    // STORY et COMMENT reste au fil, juste en dessous.
    this.registry.on('moderation.content_hidden', 'moderation-effects', async (job) => {
      await this.moderationEffects.apply('hidden', job.payload);
    });
    this.registry.on('moderation.content_restored', 'moderation-effects', async (job) => {
      await this.moderationEffects.apply('restored', job.payload);
    });
    this.registry.on('moderation.content_removed', 'moderation-effects', async (job) => {
      await this.moderationEffects.apply('removed', job.payload);
    });

    // ── La cascade du blocage (08 §4) ────────────────────────────────────────
    //
    // §4 la décrit comme des « effets immédiats (transaction) », mais §9 fait de
    // `user.blocked` un événement consommé par tous les modules : une transaction
    // unique entre modules est impossible. La cascade est donc en plusieurs
    // transactions — et la LECTURE, elle, est protégée dès la première, puisque
    // `VisibilityService` lit la table `blocks` et non ses conséquences.
    this.registry.on('user.blocked', 'connections', async (job) => {
      const pair = blockPair(job.payload);
      if (pair === null) return;
      await this.connections.handleUserBlocked(pair.blocker, pair.blocked);
    });

    this.registry.on('user.blocked', 'mentorship', async (job) => {
      const pair = blockPair(job.payload);
      if (pair === null) return;
      await this.mentorship.handleUserBlocked(pair.blocker, pair.blocked);
    });

    this.registry.on('user.blocked', 'messaging', async (job) => {
      const pair = blockPair(job.payload);
      if (pair === null) return;
      await this.messaging.handleUserBlocked(pair.blocker, pair.blocked);
    });

    this.registry.on('mentorship.ended', 'connections', async (job) => {
      // Le gestionnaire lit la CHARGE, pas l'identifiant d'agrégat : il lui faut
      // les deux membres et le motif de fin — un parrainage terminé pour cause de
      // blocage ne doit évidemment pas produire un contact.
      await this.connections.handleMentorshipEnded(job.payload as Parameters<
        ConnectionsService['handleMentorshipEnded']
      >[0]);
    });

    // Conversation de parcours : recalcul idempotent. `journey.created` et
    // `journey.member_joined` n'ont pas encore de producteur (module 03).
    this.registry.on('journey.created', 'messaging', async (job) => {
      await this.messaging.syncJourneyConversation(job.aggregateId);
    });

    this.registry.on('journey.member_joined', 'messaging', async (job) => {
      await this.messaging.syncJourneyConversation(job.aggregateId);
    });

    this.registry.on('user.deleted', 'mentorship', async (job) => {
      await this.mentorship.handleUserDeleted(job.aggregateId);
    });

    this.registry.on('user.deleted', 'connections', async (job) => {
      await this.connections.handleUserDeleted(job.aggregateId);
    });

    this.registry.on('user.deleted', 'messaging', async (job) => {
      await this.messaging.handleUserDeleted(job.aggregateId);
    });

    // ── Fil (04 §6) ──────────────────────────────────────────────────────────
    this.registry.on('user.deleted', 'feed', async (job) => {
      await this.feed.handleUserDeleted(job.aggregateId);
    });

    this.registry.on('moderation.content_hidden', 'feed', async (job) => {
      await this.feed.handleContentHidden(job.payload);
    });

    this.registry.on('user.blocked', 'feed', async (job) => {
      await this.feed.handleUserBlocked(job.payload);
    });

    this.registry.on('journey.step_completed', 'feed', async (job) => {
      await this.feed.handleJourneyStepCompleted(job.payload);
    });

    // ── Facturation (14 §3 et §9, « Consommés ») ─────────────────────────────
    //
    // L'ESSAI PREMIUM s'ouvre à la PREMIÈRE ÉTAPE FRANCHIE, jamais à
    // l'inscription : « le membre doit avoir vu la valeur » (14 §3, et décision
    // T4 de 2026-09). C'est le seul déclencheur automatique du module, et le
    // module 03 émet déjà l'événement — d'où la faisabilité de ce lot.
    //
    // IDEMPOTENT et SILENCIEUX : la deuxième étape franchie, comme un rejeu de la
    // file, ne doit ni lever ni offrir un second essai. `grantTrial` prend un
    // verrou sur la ligne du membre et ne rend rien quand l'essai a déjà servi.
    //
    // La charge est lue DÉFENSIVEMENT, comme partout ici : sans `ownerUserId`,
    // il n'y a rien à faire et lever ferait rejouer dix fois pour rien.
    this.registry.on('journey.step_completed', 'billing', async (job) => {
      const ownerUserId = readString(job.payload, 'ownerUserId');
      if (ownerUserId === null) return;
      await this.billing.handleStepCompleted(ownerUserId);
    });

    // §11 : « Abonnements : annulés immédiatement chez le fournisseur. » La ligne,
    // elle, disparaît avec le membre — `subscriptions.user_id` est NOT NULL et en
    // CASCADE, donc l'anonymisation que §11 demande est impossible en base. Voir
    // `BillingService.handleUserDeleted`.
    this.registry.on('user.deleted', 'billing', async (job) => {
      await this.billing.handleUserDeleted(job.aggregateId);
    });

    // ── Parcours (03 §7, « Consommés ») ──────────────────────────────────────
    //
    // Les trois gestionnaires sont INDÉPENDANTS et IDEMPOTENTS, comme le contrat
    // de ce fichier l'exige : un rejeu n'ajoute ni second accompagnant, ni
    // seconde activité, ni second événement — et chacun LÈVE quand il échoue,
    // pour être rejoué plutôt que perdu.
    //
    // §2.3 du module 08 fait voyager `journeyId` dans `mentorship.accepted`
    // précisément pour celui-ci : « le parrain devient SUPPORTER », et c'est au
    // module 03 de l'inscrire — jamais au parrainage d'écrire dans
    // `journey_members`.
    this.registry.on('mentorship.accepted', 'journeys', async (job) => {
      await this.journeys.handleMentorshipAccepted(job.payload);
    });

    // §3.4 : « Un blocage retire automatiquement. » Dans les deux sens.
    this.registry.on('user.blocked', 'journeys', async (job) => {
      const pair = blockPair(job.payload);
      if (pair === null) return;
      await this.journeys.handleUserBlocked(pair.blocker, pair.blocked);
    });

    // 06 §2.5 : « si `origin_journey_step_id` : activité HELP_RECEIVED sur
    // l'étape ». L'identifiant d'agrégat de `help_request.resolved` EST la
    // demande — le gestionnaire remonte de là vers l'étape, plutôt que de
    // supposer une forme de charge utile.
    this.registry.on('help_request.resolved', 'journeys', async (job) => {
      await this.journeys.handleHelpRequestResolved(job.aggregateId);
    });

    // La conversation du parcours suit aussi les DÉPARTS : sans cet abonnement,
    // un accompagnant retiré de l'équipe continuerait de lire la discussion.
    this.registry.on('journey.member_removed', 'messaging', async (job) => {
      await this.messaging.syncJourneyConversation(job.aggregateId);
    });
    // ── Notifications (12) et recherche (11) ────────────────────────
    //
    // Les deux blocs sont des FONCTIONS exportées plutôt que du code en ligne, et
    // pour une raison de test : un test d'intégration peut alors poser les VRAIS
    // abonnements sur un registre neuf et éprouver la chaîne PAR L'ÉVÉNEMENT —
    // `registry.dispatch(job)` — au lieu d'appeler un gestionnaire à la main. Le
    // câblage reste ici, visible d'un coup d'œil, et c'est bien lui qui est testé.
    registerNotificationSubscriptions(this.registry, this.notifications, this.notificationEvents);
    /**
     * ── Référentiels (02 §2.2) ───────────────────────────────────────────────
     *
     * Activer une ville ou un pays, ou fusionner deux villes, change l'appartenance
     * automatique de membres déjà inscrits. Le service fait l'écriture bornée dans
     * sa transaction — le drapeau, le réseau, le déplacement des membres — et
     * délègue ICI le recalcul, qui peut concerner des centaines de personnes et n'a
     * aucune raison de tenir une transaction d'administration.
     *
     * Les trois événements appellent le MÊME gestionnaire : ils posent la même
     * question, « quels membres doivent voir leurs adhésions recalculées ».
     */
    this.registry.on('city.activated', 'communities', async (job) => {
      await this.communities.handleLocationActivated({ cityId: job.aggregateId });
    });
    this.registry.on('country.activated', 'communities', async (job) => {
      await this.communities.handleLocationActivated({ countryId: job.aggregateId });
    });
    this.registry.on('city.merged', 'communities', async (job) => {
      // Les membres ont été déplacés vers la cible : c'est SA population qu'il faut
      // recalculer, pas celle de la ville absorbée, qui n'en a plus.
      const target = readString(job.payload, 'targetCityId');
      if (target === null) return;
      await this.communities.handleLocationActivated({ cityId: target });
    });

    registerSearchSubscriptions(this.registry, this.search);

    this.logger.log(`${this.registry.describe().length} type(s) d’événement écouté(s)`);
  }
}

/**
 * Une chaîne d'une charge d'événement, ou `null`.
 *
 * La charge est du JSON venu de la base : son type est `unknown`, et il le reste.
 * La lire défensivement importe surtout pour les événements dont le PRODUCTEUR
 * n'existe pas encore — un gestionnaire qui suppose une forme se casse le jour où
 * elle arrive autrement, et l'échec surviendrait dans le worker, loin de l'écran.
 */
function readString(payload: unknown, key: string): string | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * Les deux membres d'un blocage, ou `null` si la charge n'a pas la forme attendue.
 *
 * Trois modules en ont besoin, d'où la fonction plutôt que trois lectures
 * recopiées : une seule définition de ce qu'est une charge valide.
 */
function blockPair(payload: unknown): { blocker: string; blocked: string } | null {
  const blocker = readString(payload, 'blockerUserId');
  const blocked = readString(payload, 'blockedUserId');
  if (blocker === null || blocked === null) return null;
  return { blocker, blocked };
}

/**
 * Les consommateurs de NOTIFICATIONS — 12-notifications.md.
 *
 * C'est la moitié manquante de huit chaînes : tous les modules livrés émettaient,
 * aucun ne notifiait. Un module = un bloc ; les gestionnaires sont indépendants, et
 * le registre isole leurs échecs.
 *
 * L'ordre suit celui des modules, pas celui des événements : on cherche bien plus
 * souvent « qu'est-ce que l'agenda notifie ? » que « qui écoute event.updated ? ».
 */
export function registerNotificationSubscriptions(
  registry: EventHandlerRegistry,
  notifications: NotificationsService,
  events: NotificationEventsService,
): void {
  // ── 06 Entraide ───────────────────────────────────────────────────────────
  registry.on('help_request.published', 'notifications', async (job) => {
    await events.onHelpPublished(job.aggregateId, job.payload);
  });
  registry.on('help_request.responded', 'notifications', async (job) => {
    await events.onHelpResponded(job.aggregateId, job.payload);
  });
  registry.on('help_request.resolved', 'notifications', async (job) => {
    await events.onHelpResolved(job.aggregateId, job.payload);
  });

  // ── 08 Parrainage ─────────────────────────────────────────────────────────
  registry.on('mentorship.requested', 'notifications', async (job) => {
    await events.onMentorshipRequested(job.payload);
  });
  registry.on('mentorship.accepted', 'notifications', async (job) => {
    await events.onMentorshipAccepted(job.payload);
  });
  registry.on('mentorship.declined', 'notifications', async (job) => {
    await events.onMentorshipDeclined(job.payload);
  });
  registry.on('mentorship.ended', 'notifications', async (job) => {
    await events.onMentorshipEnded(job.payload);
  });

  // ── 08 Messagerie et contacts ─────────────────────────────────────────────
  registry.on('message.sent', 'notifications', async (job) => {
    await events.onMessageSent(job.payload);
  });
  registry.on('connection.requested', 'notifications', async (job) => {
    await events.onConnectionRequested(job.payload);
  });
  registry.on('connection.suggested', 'notifications', async (job) => {
    await events.onConnectionSuggested(job.payload);
  });

  // ── 04 Fil — le regroupement du §2.3 ──────────────────────────────────────
  registry.on('post.reacted', 'notifications', async (job) => {
    await events.onPostReacted(job.aggregateId, job.payload);
  });
  registry.on('post.commented', 'notifications', async (job) => {
    await events.onPostCommented(job.aggregateId, job.payload);
  });

  // ── 07 Réseaux ────────────────────────────────────────────────────────────
  registry.on('community.announcement_published', 'notifications', async (job) => {
    await events.onCommunityAnnouncement(job.payload);
  });
  registry.on('community.member_joined', 'notifications', async (job) => {
    await events.onCommunityMemberJoined(job.payload);
  });
  registry.on('community.created', 'notifications', async (job) => {
    await events.onCommunityCreated(job.aggregateId, job.payload);
  });
  registry.on('community.archived', 'notifications', async (job) => {
    await events.onCommunityArchived(job.aggregateId, job.payload);
  });
  // L'avertissement à 45 jours (§2.2). Sans cet abonnement, la tâche déposerait
  // l'événement au relais et PERSONNE ne le lirait — l'avertissement serait
  // écrit en base (`warning_sent_at`) sans jamais atteindre le propriétaire,
  // c'est-à-dire pire que de ne rien faire.
  registry.on('community.archive_warning', 'notifications', async (job) => {
    await events.onCommunityArchiveWarning(job.aggregateId, job.payload);
  });

  // ── 09 Agenda ─────────────────────────────────────────────────────────────
  //
  // `event.updated` porte DEUX faits : la modification notable, et le rappel H−2
  // que la tâche planifiée du module 09 émet avec `reminder: 'H_MINUS_2'`.
  registry.on('event.updated', 'notifications', async (job) => {
    await events.onEventUpdated(job.aggregateId, job.payload);
  });
  registry.on('event.cancelled', 'notifications', async (job) => {
    await events.onEventCancelled(job.aggregateId, job.payload);
  });
  registry.on('event.rsvp_changed', 'notifications', async (job) => {
    await events.onEventRsvpChanged(job.aggregateId, job.payload);
  });

  // ── 10 Services ───────────────────────────────────────────────────────────
  registry.on('housing.published', 'notifications', async (job) => {
    await events.onListingPublished('HOUSING', job.aggregateId, job.payload);
  });
  registry.on('job.published', 'notifications', async (job) => {
    await events.onListingPublished('JOB', job.aggregateId, job.payload);
  });
  registry.on('housing.contacted', 'notifications', async (job) => {
    await events.onListingContacted('HOUSING', job.payload);
  });
  registry.on('pro.contacted', 'notifications', async (job) => {
    await events.onListingContacted('PRO', job.payload);
  });
  registry.on('pro.recommended', 'notifications', async (job) => {
    await events.onRecommended('PRO', job.aggregateId, job.payload);
  });
  registry.on('member.recommended', 'notifications', async (job) => {
    await events.onRecommended('MEMBER', job.aggregateId, job.payload);
  });
  registry.on('housing.expired', 'notifications', async (job) => {
    await events.onHousingExpired(job.aggregateId, job.payload);
  });

  // ── 05 Guides ─────────────────────────────────────────────────────────────
  registry.on('guide.proposal_created', 'notifications', async (job) => {
    await events.onGuideProposalCreated(job.aggregateId, job.payload);
  });
  registry.on('guide.proposal_accepted', 'notifications', async (job) => {
    await events.onGuideProposalDecided('ACCEPTED', job.aggregateId, job.payload);
  });
  registry.on('guide.proposal_rejected', 'notifications', async (job) => {
    await events.onGuideProposalDecided('REJECTED', job.aggregateId, job.payload);
  });
  registry.on('guide.proposal_escalated', 'notifications', async (job) => {
    await events.onGuideProposalDecided('ESCALATED', job.aggregateId, job.payload);
  });
  registry.on('guide.flagged', 'notifications', async (job) => {
    await events.onGuideFlagged(job.aggregateId, job.payload);
  });

  // ── 13 Modération — catégorie NON DÉSACTIVABLE (§2.2) ─────────────────────
  registry.on('moderation.content_hidden', 'notifications', async (job) => {
    await events.onModerationContent('HIDDEN', job.payload);
  });
  registry.on('moderation.content_removed', 'notifications', async (job) => {
    await events.onModerationContent('REMOVED', job.payload);
  });
  registry.on('moderation.content_restored', 'notifications', async (job) => {
    await events.onModerationContent('RESTORED', job.payload);
  });
  registry.on('moderation.user_suspended', 'notifications', async (job) => {
    await events.onSanction('SUSPENDED', job.payload);
  });
  registry.on('moderation.user_banned', 'notifications', async (job) => {
    await events.onSanction('BANNED', job.payload);
  });
  registry.on('moderation.user_reinstated', 'notifications', async (job) => {
    await events.onSanction('REINSTATED', job.payload);
  });
  registry.on('moderation.case_resolved', 'notifications', async (job) => {
    await events.onModerationCaseResolved(job.aggregateId);
  });

  // ── 01 Compte ─────────────────────────────────────────────────────────────
  registry.on('user.registered', 'notifications', async (job) => {
    await events.onUserRegistered(job.aggregateId);
  });
  registry.on('user.level_changed', 'notifications', async (job) => {
    await events.onLevelChanged(job.aggregateId, job.payload);
  });
  registry.on('kyc.status_changed', 'notifications', async (job) => {
    await events.onKycStatusChanged(job.aggregateId, job.payload);
  });
  registry.on('user.deletion_requested', 'notifications', async (job) => {
    await events.onDeletionRequested(job.aggregateId);
  });

  // ── 14 Abonnement et paiements ────────────────────────────────────────────
  //
  // `subscription.changed` figurait dans le catalogue d'événements depuis le lot 0
  // SANS aucun consommateur : le module 14 n'existait pas. Le voici — c'est ce qui
  // autorise le module à l'émettre.
  //
  // UN SEUL type porte les huit faits du §9 (activation, expiration, annulation,
  // essai, rappels), distingués par `payload.reason` : c'est la forme déjà employée
  // par `event.updated` + `reminder: 'H_MINUS_2'` (module 09), et elle évite sept
  // types sans consommateur propre.
  registry.on('subscription.changed', 'notifications', async (job) => {
    await events.onSubscriptionChanged(job.aggregateId, job.payload);
  });

  registry.on('payment.failed', 'notifications', async (job) => {
    await events.onPaymentFailed(job.payload);
  });

  registry.on('payment.refunded', 'notifications', async (job) => {
    await events.onPaymentRefunded(job.payload);
  });

  // §7 : notifications, préférences et abonnements push supprimés ;
  // `outbound_messages` anonymisés.
  registry.on('user.deleted', 'notifications', async (job) => {
    await notifications.handleUserDeleted(job.aggregateId);
  });
}

/**
 * Les consommateurs de la RECHERCHE — 11-recherche.md §2.5.
 *
 * « Abonné aux événements `*.published`, `*.updated`, `*.unpublished`,
 * `*.archived`, `*.hidden`, `user.profile_updated`, `user.blocked` (pas de
 * réindexation, exclusion à la requête). »
 *
 * DEUX écarts, tous deux imposés par le catalogue d'événements :
 *
 *   · `user.blocked` n'a PAS d'abonnement, et c'est exactement ce que la spec dit
 *     entre parenthèses : le blocage s'applique à la REQUÊTE. Réindexer serait faux
 *     de toute façon — un document n'est pas caché en soi, il est caché POUR un
 *     demandeur ;
 *   · `user.profile_updated` EXISTE désormais : `UsersService.writeMe` l'émet à
 *     chaque `PATCH /me`, et il réindexe la fiche USER — une bio modifiée n'attend
 *     plus la réindexation d'admin. (Il manquait au catalogue ; la phrase d'origine
 *     de ce commentaire le consignait comme un écart.)
 *
 * Tous les gestionnaires passent par `enqueueReindex`, qui RELIT LA SOURCE : aucun
 * ne reçoit de titre dans sa charge, donc l'ordre d'arrivée des événements n'a pas
 * d'importance — ce qui compte pour une livraison « au moins une fois » qui ne
 * garantit aucun ordre.
 */
export function registerSearchSubscriptions(
  registry: EventHandlerRegistry,
  search: SearchService,
): void {
  const guideEvents = [
    'guide.published',
    'guide.unpublished',
    'guide.flagged',
    'guide.restored',
    'guide.version_created',
    'guide.proposal_accepted',
    // Le retrait d'une page RÉTRÉCIT le document indexé : l'index porte le corps
    // de toutes les pages du guide. Sans cet abonnement, le texte d'une page
    // retirée resterait cherchable et mènerait vers une page qu'aucune route ne
    // rend. L'ajout d'une page remplie passe par `guide.version_created`, déjà
    // dans cette liste.
    'guide.page_removed',
  ] as const;
  for (const type of guideEvents) {
    registry.on(type, 'search', async (job) => {
      await search.enqueueReindex('GUIDE', job.aggregateId);
    });
  }

  for (const type of ['help_request.published', 'help_request.resolved', 'help_request.reopened'] as const) {
    registry.on(type, 'search', async (job) => {
      await search.enqueueReindex('HELP_REQUEST', job.aggregateId);
    });
  }

  for (const type of ['housing.published', 'housing.updated', 'housing.taken', 'housing.expired'] as const) {
    registry.on(type, 'search', async (job) => {
      await search.enqueueReindex('HOUSING', job.aggregateId);
    });
  }

  for (const type of ['job.published', 'job.sponsored', 'job.updated'] as const) {
    registry.on(type, 'search', async (job) => {
      await search.enqueueReindex('JOB', job.aggregateId);
    });
  }

  for (const type of ['event.published', 'event.updated', 'event.cancelled', 'event.done'] as const) {
    registry.on(type, 'search', async (job) => {
      await search.enqueueReindex('EVENT', job.aggregateId);
    });
  }

  for (const type of ['community.topic_created', 'community.topic_resolved'] as const) {
    registry.on(type, 'search', async (job) => {
      await search.enqueueReindex('TOPIC', job.aggregateId);
    });
  }

  // « Réindexer un sujet à chaque réponse » : le document TOPIC porte le corps du
  // sujet ET ses premières réponses (§2.1). Deux chemins en produisent — un
  // commentaire posé sur le sujet, une publication déplacée vers lui.
  registry.on('post.commented', 'search', async (job) => {
    const payload = job.payload as { subjectType?: unknown } | null;
    if (payload?.subjectType !== 'TOPIC') return;
    await search.enqueueReindex('TOPIC', job.aggregateId);
  });
  registry.on('post.moved_to_topic', 'search', async (job) => {
    const topicId = (job.payload as { topicId?: unknown } | null)?.topicId;
    if (typeof topicId === 'string') await search.enqueueReindex('TOPIC', topicId);
  });

  // Un réseau archivé ou réactivé change la visibilité de TOUS ses sujets et
  // événements : la cascade est portée ici, parce qu'aucun événement ne concerne les
  // sujets eux-mêmes.
  for (const type of [
    'community.archived',
    'community.reactivated',
    'community.visibility_changed',
  ] as const) {
    registry.on(type, 'search', async (job) => {
      await search.reindexCommunityChildren(job.aggregateId);
    });
  }

  registry.on('pro.registered', 'search', async (job) => {
    await search.enqueueReindex('PRO', job.aggregateId);
  });

  for (const type of [
    'user.onboarded',
    'user.phase_changed',
    'user.profile_updated',
    'user.deactivated',
    'user.reactivated',
  ] as const) {
    registry.on(type, 'search', async (job) => {
      await search.enqueueReindex('USER', job.aggregateId);
    });
  }

  // §5 : « Documents USER supprimés ; les autres documents de l'auteur suivent le
  // sort de leur source. »
  registry.on('user.deleted', 'search', async (job) => {
    await search.handleUserDeleted(job.aggregateId);
  });

  // Un contenu masqué, retiré ou rétabli doit sortir de l'index ou y revenir. Le
  // type de sujet est traduit en type de document ; `POST`, `COMMENT`, `MESSAGE` et
  // `STORY` n'en ont pas — ils ne sont JAMAIS indexés (§2.1), donc rien à faire.
  const moderationEvents = [
    'moderation.content_hidden',
    'moderation.content_removed',
    'moderation.content_restored',
  ] as const;
  for (const type of moderationEvents) {
    registry.on(type, 'search', async (job) => {
      const payload = job.payload as { subjectType?: unknown; subjectId?: unknown } | null;
      const subjectType = typeof payload?.subjectType === 'string' ? payload.subjectType : null;
      const subjectId = typeof payload?.subjectId === 'string' ? payload.subjectId : job.aggregateId;
      const searchType = SearchService.searchTypeOfModerationSubject(subjectType);
      if (searchType === null) return;
      await search.enqueueReindex(searchType, subjectId);
    });
  }
}
