import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { CommunitiesService } from '../modules/communities/communities.service';
import { GuidesService } from '../modules/guides/guides.service';
import { HelpService } from '../modules/help/help.service';
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

    this.logger.log(`${this.registry.describe().length} type(s) d’événement écouté(s)`);
  }
}
