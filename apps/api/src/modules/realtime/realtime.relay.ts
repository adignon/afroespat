import { Injectable, Logger } from '@nestjs/common';
import { QueueService } from '../../queue/queue.service';
import { REALTIME_CHANNEL, type RealtimeEvent, type RelayMessage } from './realtime.channel';

/**
 * Le côté PUBLICATION du temps réel — 08 §7.3.
 *
 * LE PROBLÈME, qui n'est pas évident avant d'avoir posé les deux moitiés : les
 * sockets sont tenus par l'API (c'est elle qui écoute en HTTP), et les
 * événements de domaine sont consommés par le WORKER (§3.1). Le gestionnaire de
 * `message.sent` n'a donc AUCUN socket sous la main, et la passerelle ne voit
 * jamais passer l'événement. Sans ce pont, la passerelle serait authentifiée,
 * correcte, et muette — le défaut exact qu'on répare ailleurs dans ce lot.
 *
 * CE SERVICE NE CONNAÎT PAS LA PASSERELLE, et c'est structurel, pas esthétique.
 * Il tourne dans le worker ; importer la passerelle y chargerait
 * `@nestjs/websockets`, et la seule présence d'une classe `@WebSocketGateway`
 * dans l'arbre fait ÉCHOUER `NestFactory.createApplicationContext` — le worker
 * ne démarre plus du tout (« Nest can't resolve dependencies of the AuthGuard
 * (?, TokenService, PrismaService) »). Mesuré en lançant le worker, pas déduit.
 * L'abonnement vit donc dans la passerelle, côté API ; ici, on publie.
 *
 * LA LIVRAISON EST « AU PLUS UNE FOIS », et c'est assumé. Redis pub/sub ne
 * conserve rien : un membre dont le socket est fermé au moment de la publication
 * ne recevra pas l'événement. C'est acceptable parce que la passerelle n'est pas
 * un canal de vérité — §5.3 garde le « repli en polling 15 s », et la charge ne
 * porte jamais le contenu, seulement l'invitation à aller le lire. Faire
 * autrement demanderait une file par membre, c'est-à-dire de reconstruire les
 * notifications (module 12), qui existent déjà pour ce qui doit survivre à une
 * déconnexion.
 */
@Injectable()
export class RealtimeRelayService {
  private readonly logger = new Logger(RealtimeRelayService.name);

  constructor(private readonly queues: QueueService) {}

  /**
   * Publie — appelé par le gestionnaire d'événements, donc depuis le worker.
   *
   * NE LÈVE JAMAIS : un échec de poussée temps réel ne doit pas faire échouer le
   * travail BullMQ qui la déclenche, sinon un incident Redis ferait rejouer
   * l'envoi d'une notification déjà partie — et le membre la recevrait deux fois
   * pour que le confort du temps réel soit préservé. Le mauvais compromis.
   */
  async publish(userId: string, event: RealtimeEvent, payload: Record<string, unknown>): Promise<void> {
    try {
      await this.queues.redis.publish(
        REALTIME_CHANNEL,
        JSON.stringify({ userId, event, payload } satisfies RelayMessage),
      );
    } catch (error) {
      this.logger.warn(
        `poussée temps réel perdue (${event}) : ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
