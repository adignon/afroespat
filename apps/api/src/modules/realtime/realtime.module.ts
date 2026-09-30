import { Module } from '@nestjs/common';
import { RealtimeAdmissionService } from './realtime.admission';
import { RealtimeGateway } from './realtime.gateway';

/**
 * La passerelle WebSocket, et RIEN QUE dans l'API — 00 §3.1.
 *
 * POURQUOI UN MODULE SÉPARÉ alors que tout le reste de cette application vit
 * dans `AppModule`. Ce n'est pas un choix de style : c'est la seule façon de ne
 * PAS charger la passerelle dans le worker.
 *
 * §3.1 fait démarrer le worker sur le MÊME module racine, par
 * `NestFactory.createApplicationContext` — sans serveur HTTP. Or une classe
 * annotée `@WebSocketGateway()` présente dans l'arbre fait échouer cet appel :
 *
 *     Nest can't resolve dependencies of the AuthGuard (?, TokenService,
 *     PrismaService) — Reflector at index [0]
 *
 * Le message ne parle pas de WebSocket, et c'est ce qui rend le piège coûteux :
 * on cherche du côté des gardes. La cause est que le contexte applicatif
 * n'initialise pas le sous-système des passerelles, et le worker ne démarre plus
 * DU TOUT — ni le relais de la boîte d'envoi, ni les 47 tâches planifiées, ni les
 * neuf files. Constaté en lançant le worker, pas en relisant le code.
 *
 * Le fond est d'ailleurs le même que la mécanique : un worker n'a aucun socket à
 * servir, donc une passerelle n'y a rien à faire. `AppModule` n'importe donc ce
 * module que lorsque `APP_ROLE` vaut `api`.
 *
 * `RealtimeRelayService` N'EST PAS ICI : il publie sur Redis, le worker en a
 * besoin, et il ne dépend d'aucune classe de `@nestjs/websockets`. Il reste dans
 * `AppModule`, chargé par les deux rôles.
 */
@Module({
  providers: [RealtimeAdmissionService, RealtimeGateway],
  exports: [RealtimeAdmissionService],
})
export class RealtimeModule {}
