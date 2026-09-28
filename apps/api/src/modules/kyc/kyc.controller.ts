import { Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Auth, type AuthContext } from '../../common/auth.guard';
import { RequiresCapability, SignedWebhook } from '../../common/capability.decorator';
import { KycService } from './kyc.service';

/**
 * Vérification d'identité — 01-identite.md §4.3.
 *
 * Trois routes, et seulement trois. La page de dépôt de pièce n'est PAS servie
 * ici : §2.3 la confie à Didit (« le membre la suit, page hébergée par Didit »), et
 * c'est ce qui permet à la plateforme de ne jamais recevoir de document. Le
 * back-end ne fait donc que trois choses — ouvrir la session, dire où en est le
 * membre, et recevoir le verdict signé.
 */

/**
 * Le corps brut, tel que `rawBody: true` le pose sur la requête.
 *
 * Nest le déclare `Buffer | undefined` sur `RawBodyRequest<T>` ; on le redit ici
 * pour que le contrôleur n'ait pas à importer un type utilitaire dont il n'emploie
 * qu'un champ, et pour que l'absence du champ reste un cas explicite du code.
 */
interface RawRequest extends Request {
  rawBody?: Buffer;
}

@ApiTags('kyc')
@Controller()
export class KycController {
  constructor(private readonly kyc: KycService) {}

  /**
   * §4.3 : rend `verificationUrl` et `sessionId`.
   *
   * `content.read` (L0) et non une capacité plus haute : c'est la route par
   * laquelle on QUITTE le niveau L0, et exiger L1 pour l'appeler serait un
   * verrou dont la clé est à l'intérieur.
   *
   * Pas de `@RateLimit()` : la limite de §4.4 (« kyc/session 3 par 30 jours »)
   * n'est pas une limite par minute et ne se dit pas dans ce décorateur. Elle est
   * appliquée par le service, qui compte les lignes de `kyc_verifications`, et
   * survit donc à un redémarrage — ce qu'un compteur en mémoire ne fait pas.
   */
  @Post('me/kyc/session')
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Ouvre une session de vérification d’identité (Didit)' })
  async createSession(@Auth() auth: AuthContext) {
    return this.kyc.createSession(auth.userId);
  }

  @Get('me/kyc')
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Statut courant de la vérification d’identité' })
  async status(@Auth() auth: AuthContext) {
    return this.kyc.status(auth.userId);
  }

  /**
   * Webhook signé (§4.3, T4 §8).
   *
   * `200` et non `201` : ce n'est pas une création côté appelant, et T4 §8 demande
   * « une réponse 200 rapide ». Un `201` ferait croire à Didit qu'une ressource lui
   * appartient ici.
   *
   * La requête ENTIÈRE est passée au service : la signature porte sur les octets
   * bruts et sur un en-tête, donc découper ici obligerait à recopier la liste des
   * en-têtes acceptés hors du seul endroit qui la vérifie.
   */
  @Post('webhooks/didit')
  @SignedWebhook('didit')
  @HttpCode(200)
  @ApiOperation({ summary: 'Résultat de vérification Didit (HMAC signé, idempotent)' })
  async diditWebhook(@Req() request: RawRequest) {
    return this.kyc.applyWebhook(request.rawBody, request.headers, new Date());
  }
}
