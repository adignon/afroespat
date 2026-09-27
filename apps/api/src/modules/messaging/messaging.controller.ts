import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  conversationsQuerySchema,
  createDirectConversationSchema,
  messagesQuerySchema,
  sendMessageSchema,
  uuidSchema,
} from '@app/shared';
import type { z } from 'zod';
import { Auth, type AuthContext } from '../../common/auth.guard';
import { RateLimit, RequiresCapability } from '../../common/capability.decorator';
import { zodPipe } from '../../common/zod.pipe';
import { MessagingService } from './messaging.service';

/**
 * Messagerie — 08-parrainage-messagerie.md §7.3.
 *
 * UNE SUBTILITÉ DE CAPACITÉ, et elle est structurante.
 *
 * `POST /conversations/direct` déclare `message.send` (L1) : §5.2 est formel, un L0
 * ne peut ouvrir aucune conversation directe. C'est le garde qui refuse, avec
 * `LEVEL_REQUIRED` et de quoi proposer la montée de niveau (00 §7.3).
 *
 * `POST /conversations/:id/messages` déclare en revanche `content.read` (L0), parce
 * que la même §5.2 autorise le L0 à écrire « dans les conversations MENTORSHIP et
 * JOURNEY dont il fait partie ». Un pré-départ doit pouvoir parler à son parrain :
 * c'est tout l'intérêt d'avoir ouvert `mentorship.request` en L0. Le refus pour une
 * conversation DIRECT est donc pris par le SERVICE, en fonction du kind — et c'est
 * la règle dure du §12 (« un L0 peut demander un parrain mais ne peut pas ouvrir de
 * conversation directe ») qui l'exige à cet endroit précis.
 *
 * Le WebSocket `/ws` de §7.3 n'est PAS ici : aucune passerelle WebSocket n'existe
 * dans cette application. Les trois événements (`message.new`, `message.read`,
 * `conversation.updated`) sont produits sous forme d'événements de domaine
 * (`message.sent`), et le repli en polling 15 s de §5.3 fonctionne dès maintenant
 * sur `GET /conversations`.
 */
@ApiTags('messaging')
@Controller()
export class MessagingController {
  constructor(private readonly messaging: MessagingService) {}

  // ── Lecture ───────────────────────────────────────────────────────────────

  @Get('conversations')
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Mes conversations : non-lus, dernière ligne, demandes en attente' })
  async list(
    @Auth() auth: AuthContext,
    @Query(zodPipe(conversationsQuerySchema)) query: z.infer<typeof conversationsQuerySchema>,
  ) {
    return this.messaging.listConversations(auth.userId, query);
  }

  @Get('conversations/:id/messages')
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Messages paginés ; marque lu, sauf demande non acceptée' })
  async messages(
    @Auth() auth: AuthContext,
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Query(zodPipe(messagesQuerySchema)) query: z.infer<typeof messagesQuerySchema>,
  ) {
    return this.messaging.listMessages(auth.userId, id, query);
  }

  // ── Écriture ──────────────────────────────────────────────────────────────

  @Post('conversations/direct')
  @HttpCode(201)
  @RequiresCapability('message.send')
  @RateLimit(20)
  @ApiOperation({ summary: 'Ouvrir une conversation directe (L1) — unique par paire' })
  async openDirect(
    @Auth() auth: AuthContext,
    @Body(zodPipe(createDirectConversationSchema))
    body: z.infer<typeof createDirectConversationSchema>,
  ) {
    return this.messaging.openDirect(
      { userId: auth.userId, level: auth.claims.level },
      body,
    );
  }

  @Post('conversations/:id/accept')
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Accepter une conversation directe en attente (§5.2)' })
  async accept(@Auth() auth: AuthContext, @Param('id', zodPipe(uuidSchema)) id: string) {
    return this.messaging.acceptDirect(auth.userId, id);
  }

  /**
   * `content.read` et non `message.send` : le L0 écrit dans les conversations
   * MENTORSHIP et JOURNEY dont il fait partie (§5.2). Le refus pour une DIRECT est
   * pris par le service, qui seul connaît le kind de la conversation.
   */
  @Post('conversations/:id/messages')
  @HttpCode(201)
  @RequiresCapability('content.read')
  @RateLimit(60)
  @ApiOperation({ summary: 'Envoyer un message, 1 à 4 000 caractères, image facultative' })
  async send(
    @Auth() auth: AuthContext,
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Body(zodPipe(sendMessageSchema)) body: z.infer<typeof sendMessageSchema>,
  ) {
    return this.messaging.sendMessage({ userId: auth.userId, level: auth.claims.level }, id, body);
  }

  @Delete('messages/:id')
  @HttpCode(204)
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Supprimer son message — « Message supprimé » reste dans le fil' })
  async remove(
    @Auth() auth: AuthContext,
    @Param('id', zodPipe(uuidSchema)) id: string,
  ): Promise<void> {
    await this.messaging.deleteMessage(auth.userId, id);
  }
}
