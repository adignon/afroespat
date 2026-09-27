import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  acceptSuggestionSchema,
  connectionRequestsQuerySchema,
  connectionsQuerySchema,
  createConnectionRequestSchema,
  handleSchema,
  uuidSchema,
} from '@app/shared';
import type { z } from 'zod';
import { Auth, type AuthContext } from '../../common/auth.guard';
import { RateLimit, RequiresCapability } from '../../common/capability.decorator';
import { zodPipe } from '../../common/zod.pipe';
import { ConnectionsService } from './connections.service';

/**
 * Contacts — 08-parrainage-messagerie.md §7.2.
 *
 * AUCUNE route publique ici, et c'est la règle dure du §3.2 qui l'impose :
 * « Aucun compteur public de contacts. Le nombre n'est visible que de soi-même. »
 * Toutes les lectures partent donc du jeton, jamais d'un `:handle` — sauf
 * `mutual-connections`, qui compte MES contacts et non les siens.
 *
 * `connection.request` est L1 : une demande manuelle est un démarchage potentiel,
 * et §3.1 la borne par la ville, un message obligatoire et deux quotas. La
 * LECTURE de mes propres contacts, elle, n'a pas à exiger L1 — d'où
 * `content.read` sur les routes de consultation.
 */
@ApiTags('connections')
@Controller()
export class ConnectionsController {
  constructor(private readonly connections: ConnectionsService) {}

  // ── Lecture ───────────────────────────────────────────────────────────────

  @Get('me/connections')
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Mes contacts, et mon nombre de contacts (visible de moi seul)' })
  async list(
    @Auth() auth: AuthContext,
    @Query(zodPipe(connectionsQuerySchema)) query: z.infer<typeof connectionsQuerySchema>,
  ) {
    return this.connections.list(auth.userId, query);
  }

  @Get('me/connection-requests')
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Demandes de contact reçues ou envoyées' })
  async listRequests(
    @Auth() auth: AuthContext,
    @Query(zodPipe(connectionRequestsQuerySchema))
    query: z.infer<typeof connectionRequestsQuerySchema>,
  ) {
    return this.connections.listRequests(auth.userId, query.direction);
  }

  @Get('me/connection-suggestions')
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Suggestions EVENT et GUIDE, calculées à la requête (§3.1)' })
  async suggestions(@Auth() auth: AuthContext) {
    return this.connections.suggestions(auth.userId);
  }

  /**
   * Le réseau de 2ᵉ degré (§3.2).
   *
   * Ce que la route renvoie est une donnée DU LECTEUR : « Connecté·e à N de vos
   * contacts ». Elle ne dit rien du nombre de contacts de la personne regardée,
   * ce que la règle dure du §3.2 interdit.
   */
  @Get('users/:handle/mutual-connections')
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Connecté·e à N de vos contacts, avec les handles' })
  async mutual(
    @Auth() auth: AuthContext,
    @Param('handle', zodPipe(handleSchema)) handle: string,
  ) {
    return this.connections.mutualConnections(auth.userId, handle);
  }

  // ── Écriture ──────────────────────────────────────────────────────────────

  @Post('connection-requests')
  @HttpCode(201)
  @RequiresCapability('connection.request')
  // §3.1 borne à 10 par jour ; la limite de débit protège la minute.
  @RateLimit(10)
  @ApiOperation({ summary: 'Demande de contact : même ville, message de 20 à 500 caractères' })
  async request(
    @Auth() auth: AuthContext,
    @Body(zodPipe(createConnectionRequestSchema))
    body: z.infer<typeof createConnectionRequestSchema>,
  ) {
    return this.connections.request(auth.userId, body);
  }

  @Post('connection-requests/:id/accept')
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Accepter une demande de contact — le contact est réciproque' })
  async accept(@Param('id', zodPipe(uuidSchema)) id: string, @Auth() auth: AuthContext) {
    return this.connections.acceptRequest(id, auth.userId);
  }

  @Post('connection-requests/:id/decline')
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Refuser une demande de contact, sans notification' })
  async decline(@Param('id', zodPipe(uuidSchema)) id: string, @Auth() auth: AuthContext) {
    return this.connections.declineRequest(id, auth.userId);
  }

  @Post('connection-suggestions/accept')
  @HttpCode(201)
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Accepter une suggestion EVENT ou GUIDE (§3.1)' })
  async acceptSuggestion(
    @Auth() auth: AuthContext,
    @Body(zodPipe(acceptSuggestionSchema)) body: z.infer<typeof acceptSuggestionSchema>,
  ) {
    return this.connections.acceptSuggestion(auth.userId, body.origin, body.toHandle);
  }

  @Delete('me/connections/:userId')
  @HttpCode(204)
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Retirer un contact — sans notification (§3.2)' })
  async remove(
    @Auth() auth: AuthContext,
    @Param('userId', zodPipe(uuidSchema)) userId: string,
  ): Promise<void> {
    await this.connections.remove(auth.userId, userId);
  }
}
