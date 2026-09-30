import { Logger, type OnApplicationBootstrap, type OnModuleDestroy } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  type OnGatewayConnection,
  type OnGatewayDisconnect,
} from '@nestjs/websockets';
import IORedis, { type Redis } from 'ioredis';
import type { Server, Socket } from 'socket.io';
import { ApiError } from '../../common/api-error';
import { loadEnv } from '../../config/env';
import { RealtimeAdmissionService, type RealtimeContext } from './realtime.admission';
import { REALTIME_CHANNEL, parseRelayMessage, userRoom, type RealtimeEvent } from './realtime.channel';

/**
 * La passerelle temps réel — 08-parrainage-messagerie.md §7.3 (`WS /ws`) et
 * T4 §7.
 *
 * §5.3 : « Temps réel par WebSocket ; repli en polling 15 s. » Le repli existait
 * déjà et continue de fonctionner ; cette passerelle le rend inutile dans le cas
 * courant, elle ne le remplace pas — un client qui n'établit pas la connexion
 * doit rester utilisable.
 *
 * ÉVÉNEMENTS ÉMIS, et rien d'autre (§7.3 et T4 §7) : `message.new`,
 * `message.read`, `conversation.updated`, `notification.new`.
 *
 * « AUCUNE DONNÉE NON DEMANDÉE : le client s'abonne à ses conversations
 * ouvertes » (T4 §7). D'où le salon par MEMBRE et non un salon par conversation
 * ouvert d'office : le serveur n'envoie à un socket que ce qui est destiné à son
 * propriétaire, et n'a jamais à décider quelles conversations « mériteraient »
 * d'être poussées. Le corps du message n'est JAMAIS dans la charge — comme pour
 * l'événement de domaine `message.sent` (§8.1) : la notification dit qu'il y a du
 * nouveau, le client va le lire par l'API, qui applique les mêmes contrôles
 * qu'ailleurs.
 */

interface AuthedSocket extends Socket {
  data: { auth?: RealtimeContext };
}

@WebSocketGateway({
  path: '/ws',
  // Les mêmes origines que l'API HTTP (`main.ts`). Sans cette ligne, socket.io
  // accepte TOUTE origine : le navigateur d'un site tiers pourrait ouvrir une
  // connexion avec le jeton d'un membre piégé.
  cors: { origin: corsOrigins(), credentials: true },
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  private server?: Server;

  private revalidation?: NodeJS.Timeout;
  private subscriber?: Redis;

  constructor(private readonly admission: RealtimeAdmissionService) {}

  /**
   * L'ABONNEMENT AU CANAL, qui vit ici et non dans `RealtimeRelayService`.
   *
   * La passerelle est le seul objet qui détient des sockets ; c'est donc le seul
   * qui puisse livrer. Le relais, lui, tourne dans le worker et ne fait que
   * publier — voir l'en-tête de `realtime.relay.ts` pour la raison mécanique qui
   * interdit à ce dernier d'importer ce fichier.
   *
   * Un abonné Redis est une connexion en MODE ABONNEMENT : elle ne peut plus
   * servir à rien d'autre, d'où sa propre connexion plutôt que celle des
   * producteurs.
   */
  onApplicationBootstrap(): void {
    this.subscriber = new IORedis(loadEnv().REDIS_URL, { maxRetriesPerRequest: null });

    this.subscriber.on('message', (_channel, raw: string) => {
      const message = parseRelayMessage(raw);
      if (message === null) {
        // On NE LÈVE PAS : un message illisible vient d'une version antérieure ou
        // d'un autre producteur, et tuer l'abonné priverait de temps réel tous
        // les membres connectés à cette instance.
        this.logger.warn('message de relais illisible, ignoré');
        return;
      }
      this.publish(message.userId, message.event, message.payload);
    });

    // Sans écouteur d'`error`, une coupure Redis devient une exception non
    // rattrapée et tue le processus — la leçon déjà écrite dans
    // `task-scheduler.service.ts`.
    this.subscriber.on('error', (error: Error) => {
      this.logger.error(`abonné temps réel : ${error.message}`);
    });

    void this.subscriber.subscribe(REALTIME_CHANNEL).then(
      () => this.logger.log(`Temps réel : abonné à ${REALTIME_CHANNEL}`),
      (error: unknown) => this.logger.error(`abonnement impossible : ${String(error)}`),
    );
  }

  /**
   * L'intervalle de REVÉRIFICATION des sockets ouverts.
   *
   * Voir l'en-tête de `realtime.admission.ts` : sans elle, une connexion admise
   * une fois survivrait à un bannissement ou à une rétrogradation aussi longtemps
   * que le membre la garde ouverte. Soixante secondes est choisi pour être
   * inférieur d'un ordre de grandeur à la durée de vie d'un jeton d'accès (quinze
   * minutes) : la fenêtre d'un droit périmé sur un socket devient ainsi PLUS
   * COURTE que celle acceptée en HTTP, et non plus longue.
   */
  private static readonly REVALIDATION_MS = 60_000;

  /**
   * La poignée de main.
   *
   * ON DÉCONNECTE, on ne se contente pas de refuser un message : un socket
   * accepté puis « ignoré » resterait compté comme ouvert, consommerait un
   * descripteur, et laisserait croire au client qu'il est branché — il cesserait
   * alors de faire son repli en polling et n'aurait plus RIEN. Un refus doit se
   * voir.
   */
  async handleConnection(client: AuthedSocket): Promise<void> {
    try {
      const context = await this.admission.admit(tokenOf(client));
      client.data.auth = context;
      await client.join(userRoom(context.userId));
      client.emit('ready', { userId: context.userId });
      this.startRevalidation();
    } catch (error) {
      this.refuse(client, error);
    }
  }

  handleDisconnect(client: AuthedSocket): void {
    // socket.io quitte les salons tout seul ; la ligne existe pour que le
    // diagnostic d'une fuite de socket ait une trace à lire.
    this.logger.debug(`socket ${client.id} fermé`);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.revalidation !== undefined) clearInterval(this.revalidation);
    await this.subscriber?.quit();
  }

  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Pousse un événement au membre — le point d'entrée du relais.
   *
   * `.local` et NON une diffusion globale : avec l'adaptateur Redis, plusieurs
   * instances d'API partagent les salons, et chacune reçoit le message du relais.
   * Une diffusion globale depuis chacune livrerait donc l'événement autant de
   * fois qu'il y a d'instances. `.local` laisse chaque instance servir SES
   * sockets, et la somme est exactement une livraison.
   */
  publish(userId: string, event: RealtimeEvent, payload: Record<string, unknown>): void {
    this.server?.local.to(userRoom(userId)).emit(event, payload);
  }

  /** Le nombre de sockets ouverts — supervision, et appui des tests. */
  async openSockets(): Promise<number> {
    const sockets = await this.server?.local.fetchSockets();
    return sockets?.length ?? 0;
  }

  /**
   * Rejoue `admit()` sur chaque socket ouvert et ferme ceux qui ne passent plus.
   *
   * Rendue publique pour être ÉPROUVABLE : un test qui devrait attendre soixante
   * secondes pour vérifier qu'un membre banni est bien éjecté est un test que
   * personne n'écrit, et la règle ne serait donc gardée par rien.
   */
  async revalidateAll(): Promise<{ examines: number; fermes: number }> {
    const sockets = (await this.server?.local.fetchSockets()) ?? [];
    let fermes = 0;
    for (const socket of sockets) {
      const context = (socket.data as { auth?: RealtimeContext }).auth;
      if (context === undefined) continue;
      try {
        await this.admission.admit(tokenOf(socket as unknown as Socket));
      } catch (error) {
        const code = error instanceof ApiError ? error.code : 'UNAUTHENTICATED';
        socket.emit('refused', { code });
        socket.disconnect(true);
        fermes += 1;
        this.logger.log(`socket ${socket.id} fermé — ${code} (membre ${context.userId})`);
      }
    }
    return { examines: sockets.length, fermes };
  }

  // ───────────────────────────────────────────────────────────────────────────

  private refuse(client: AuthedSocket, error: unknown): void {
    const code = error instanceof ApiError ? error.code : 'UNAUTHENTICATED';
    // Le code part AVANT la fermeture : T4 §7 veut que le client sache s'il doit
    // rafraîchir son jeton (`TOKEN_STALE`) ou cesser d'essayer (`UNAUTHENTICATED`).
    client.emit('refused', { code });
    client.disconnect(true);
  }

  private startRevalidation(): void {
    if (this.revalidation !== undefined) return;
    this.revalidation = setInterval(() => {
      void this.revalidateAll().catch((error: unknown) => {
        this.logger.error(`revérification impossible : ${error instanceof Error ? error.message : String(error)}`);
      });
    }, RealtimeGateway.REVALIDATION_MS);
    this.revalidation.unref();
  }
}

/**
 * Le jeton d'une connexion.
 *
 * Trois emplacements, par ordre de préférence, et le premier est celui que T4 §7
 * décrit (« authentifié par le jeton d'accès à la connexion ») :
 *   · `auth: { token }` de socket.io — le seul qui ne finisse pas dans un journal
 *     d'accès, une URL étant journalisée par tout mandataire ;
 *   · l'en-tête `Authorization`, pour un client non navigateur ;
 *   · la chaîne de requête, en dernier recours et à contrecœur.
 *
 * AUCUN COOKIE n'est lu : `AuthGuard` n'en lit pas non plus pour le jeton
 * d'accès, et une poignée de main WebSocket authentifiée par cookie serait
 * soumise au CSRF — le navigateur joint les cookies à une connexion ouverte
 * depuis n'importe quelle origine.
 */
function tokenOf(client: Socket): string | undefined {
  const handshake = client.handshake;
  const fromAuth = (handshake.auth as { token?: unknown } | undefined)?.token;
  if (typeof fromAuth === 'string' && fromAuth !== '') return fromAuth;

  const header = handshake.headers?.authorization;
  if (typeof header === 'string' && header.startsWith('Bearer ')) return header.slice('Bearer '.length).trim();

  const query = handshake.query?.token;
  if (typeof query === 'string' && query !== '') return query;
  return undefined;
}

/** Les origines autorisées, comme `main.ts` les calcule pour l'API HTTP. */
function corsOrigins(): string[] {
  const env = loadEnv();
  const origins = [env.WEB_ORIGIN, env.ADMIN_ORIGIN];
  return origins.filter((o): o is string => typeof o === 'string' && o !== '');
}
