import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { CommunitiesService } from '../modules/communities/communities.service';
import { GuidesService } from '../modules/guides/guides.service';
import { HelpService } from '../modules/help/help.service';
import { HousingService } from '../modules/housing/housing.service';
import { JobsService } from '../modules/jobs/jobs.service';
import { ModerationService } from '../modules/moderation/moderation.service';
import { ProsService } from '../modules/pros/pros.service';
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
    this.registry.on('user.deleted', 'help', async (job) => {
      await this.help.handleUserDeleted(job.aggregateId);
    });

    this.registry.on('user.deleted', 'guides', async (job) => {
      await this.guides.handleUserDeleted(job.aggregateId);
    });

    this.registry.on('user.deleted', 'housing', async (job) => {
      await this.housing.handleUserDeleted(job.aggregateId);
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
