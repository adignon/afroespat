import { Injectable, type OnModuleInit } from '@nestjs/common';
import { EventHandlerRegistry } from '../../queue/event-handlers';
import { ModerationService } from '../moderation/moderation.service';

/**
 * 06 §2.7 : « La modération IA marque `MONEY_REQUEST` toute réponse contenant une
 * demande de paiement ou des coordonnées bancaires. »
 *
 * Seule la DEMANDE passait par la modération (`help_request.published`) ; la
 * RÉPONSE — où un faux aidant glisse son IBAN — n'était regardée par personne,
 * alors que `ModerationService.handleContentPublished` sait déjà lire le type
 * `HELP_RESPONSE`. Il ne manquait que l'abonnement.
 *
 * Il est posé ICI et non dans `event-subscriptions.service.ts` (partagé par tous
 * les modules) : le registre accepte plusieurs lecteurs pour un même type, et les
 * notifications écoutent déjà `help_request.responded`.
 */
@Injectable()
export class HelpResponseModeration implements OnModuleInit {
  constructor(
    private readonly registry: EventHandlerRegistry,
    private readonly moderation: ModerationService,
  ) {}

  onModuleInit(): void {
    this.registry.on('help_request.responded', 'moderation', async (job) => {
      const responseId = (job.payload as { responseId?: unknown } | null)?.responseId;
      // Une charge inattendue ne doit pas être rejouée indéfiniment.
      if (typeof responseId !== 'string') return;
      await this.moderation.handleContentPublished('HELP_RESPONSE', responseId);
    });
  }
}
