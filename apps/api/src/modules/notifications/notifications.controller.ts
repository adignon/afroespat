import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  notificationListQuerySchema,
  notificationPreferencesSchema,
  notificationReadSchema,
  pushSubscriptionSchema,
  unsubscribeQuerySchema,
  uuidSchema,
} from '@app/shared';
import type { z } from 'zod';
import { Auth, type AuthContext } from '../../common/auth.guard';
import { PublicRead, RequiresCapability } from '../../common/capability.decorator';
import { zodPipe } from '../../common/zod.pipe';
import { NotificationsService } from './notifications.service';

/**
 * Notifications in-app — 12-notifications.md §4.
 *
 * DEUX choix de capacités à justifier, parce que la matrice du §7.3 n'en prévoit
 * aucune pour ce module :
 *
 *   · `content.read` (L0) partout. Ses notifications sont les données du membre :
 *     exiger L1 rendrait la cloche muette pour un pré-départ, qui est précisément
 *     celui que le produit veut accompagner ;
 *   · `POST /notifications/read` est une ÉCRITURE et doit donc déclarer une
 *     capacité (règle dure §7.3). Elle porte `content.read` : inventer
 *     `notification.read` ferait diverger la source unique des capacités, alors
 *     que marquer lu n'ouvre aucun droit nouveau — on ne peut marquer que ses
 *     propres notifications, le service filtre sur `user_id`.
 *
 * Les codes de retour sont EXPLICITES : Nest répond 201 à tout POST, et T4 §1
 * réserve 201 à une création. « Marquer lu » ne crée rien et répond 200 ;
 * l'enregistrement d'un abonnement push, lui, crée bien une ressource.
 */
@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Mes notifications — cloche, panneau, page (§2.7)' })
  async list(
    @Auth() auth: AuthContext,
    @Query(zodPipe(notificationListQuerySchema)) query: z.infer<typeof notificationListQuerySchema>,
  ) {
    return this.notifications.list(auth.userId, query);
  }

  @Post('read')
  @HttpCode(200)
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Marquer lu : `ids[]` ou `all` (§4)' })
  async read(
    @Auth() auth: AuthContext,
    @Body(zodPipe(notificationReadSchema)) body: z.infer<typeof notificationReadSchema>,
  ) {
    return this.notifications.markRead(auth.userId, body);
  }
}

/**
 * Réglages du membre — §4 et §5.
 *
 * `@Controller()` sans préfixe, comme `UsersController` : les routes `/me/...` de
 * modules différents cohabitent ainsi sans qu'un module s'approprie le préfixe.
 *
 * MANQUENT, et c'est une dépendance non satisfaite et non un oubli : `POST /me/email`
 * et `POST /me/email/verify`. §3 annonce `users.email` « ajoutée au module 01 » et
 * la colonne n'existe pas dans le schéma figé — aucune table ne peut porter
 * l'adresse. Exposer deux routes qui échoueraient toujours serait pire que leur
 * absence : le front croirait la chaîne branchée. Voir le rapport.
 */
@ApiTags('notifications')
@Controller()
export class NotificationSettingsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get('me/notification-preferences')
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'La grille catégorie × canal, les heures calmes, le résumé (§5)' })
  async preferences(@Auth() auth: AuthContext) {
    return this.notifications.preferences(auth.userId);
  }

  @Put('me/notification-preferences')
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Régler les canaux par catégorie (§2.2)' })
  async updatePreferences(
    @Auth() auth: AuthContext,
    @Body(zodPipe(notificationPreferencesSchema)) body: z.infer<typeof notificationPreferencesSchema>,
  ) {
    return this.notifications.updatePreferences(auth.userId, body);
  }

  /**
   * §2.4 : « Demande de permission uniquement après une action explicite. »
   *
   * Cette route est le POINT D'ARRIVÉE de ce geste : le navigateur a déjà accordé
   * la permission quand elle est appelée. Le serveur ne peut pas vérifier QUAND le
   * front a demandé ; ce qu'il garantit, c'est qu'aucun push ne part sans une
   * ligne créée ici.
   */
  @Post('me/push-subscriptions')
  @HttpCode(201)
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Enregistrer un abonnement Web Push (§2.4)' })
  async subscribe(
    @Auth() auth: AuthContext,
    @Body(zodPipe(pushSubscriptionSchema)) body: z.infer<typeof pushSubscriptionSchema>,
  ) {
    return this.notifications.registerPushSubscription(auth.userId, body);
  }

  @Delete('me/push-subscriptions/:id')
  @HttpCode(204)
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Retirer un abonnement push' })
  async unsubscribeDevice(
    @Auth() auth: AuthContext,
    @Param('id', zodPipe(uuidSchema)) id: string,
  ): Promise<void> {
    await this.notifications.removePushSubscription(auth.userId, id);
  }

  /**
   * `GET /unsubscribe?token` — RÈGLE DURE (§8) : « le lien de désabonnement
   * fonctionne sans connexion ».
   *
   * D'où `@PublicRead()`. Un lien qui exigerait de se connecter ne serait pas un
   * désabonnement en un clic : celui qui ne veut plus d'emails est justement celui
   * qui ne se connectera pas pour le dire, et il marquerait l'expéditeur comme
   * indésirable — ce que §2.5 cherche à éviter.
   *
   * Le jeton porte le membre et la catégorie, signé en HMAC : il n'ouvre AUCUNE
   * autre action, et il ne révèle rien qu'une adresse email ne révèle déjà.
   */
  @Get('unsubscribe')
  @PublicRead()
  @ApiOperation({ summary: 'Désabonnement email en un clic, lien signé (§2.2)' })
  async unsubscribeEmail(
    @Query(zodPipe(unsubscribeQuerySchema)) query: z.infer<typeof unsubscribeQuerySchema>,
  ) {
    return this.notifications.unsubscribe(query.token);
  }
}
