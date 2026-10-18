import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  createHelpResponseSchema,
  createHelpSchema,
  helpCanHelpQuerySchema,
  helpListQuerySchema,
  helpMineQuerySchema,
  helpMyResponsesQuerySchema,
  updateHelpResponseSchema,
  updateHelpSchema,
  uuidSchema,
} from '@app/shared';
import type { z } from 'zod';
import { Auth, type AuthContext } from '../../common/auth.guard';
import { RequiresCapability } from '../../common/capability.decorator';
import { zodPipe } from '../../common/zod.pipe';
import { HelpService, type HelpActor } from './help.service';

/**
 * Fil d'entraide — 06-entraide.md §4.
 *
 * Trois choses à savoir en lisant ce fichier.
 *
 * 1. L'ORDRE des routes compte. `can-help`, `mine` et `my-responses` sont
 *    déclarées AVANT `:id` : Nest résout dans l'ordre de déclaration, et
 *    `GET /help/mine` tomberait sinon sur `GET /help/:id`, où `mine` échouerait
 *    la validation UUID. Le symptôme serait un `VALIDATION_FAILED` sur un onglet
 *    entier, pour une raison invisible dans le code du service.
 *
 * 2. Aucune route de LECTURE n'est `@PublicRead()`. La matrice du §7.3 place
 *    l'entraide dans `content.read` — « lire le fil, les guides, l'entraide… » —
 *    qui exige un jeton dès L0. Les listes appliquent en plus la visibilité :
 *    un membre bloqué n'apparaît nulle part, dans les deux sens.
 *
 * 3. `POST /help` déclare `help.ask` (L0) et NON `help.offer` (L1). §2.1 donne
 *    deux capacités à une seule route, selon le `kind` ; le décorateur porte la
 *    plus permissive et le service refuse l'offre en L0 avec `LEVEL_REQUIRED`.
 *    Déclarer `help.offer` ici fermerait la demande d'aide aux pré-départ — soit
 *    l'inverse exact de ce que §2.1 protège.
 *
 * Les limites de §4 (5 demandes par jour, 30 réponses par heure) ne sont pas
 * déclarées par `@RateLimit()` : ce décorateur compte PAR MINUTE, et annoncer
 * « 5/min » dans l'OpenAPI serait faux. Elles sont comptées en base par le
 * service, qui renvoie `429 RATE_LIMITED`.
 *
 * Les codes de retour sont EXPLICITES sur les actions. Nest répond 201 à tout
 * POST, et T4 §1 réserve 201 à une création : « ça m'a aidé », « résoudre »,
 * « rouvrir » et « répondre en privé » ne créent pas de ressource nouvelle et
 * répondent donc 200. Trouvé en appelant les routes, pas en relisant le code —
 * un 201 sur une réouverture est le genre de détail qu'un client finit par
 * prendre pour un contrat.
 */
@ApiTags('help')
@Controller('help')
export class HelpController {
  constructor(private readonly help: HelpService) {}

  /** Le niveau vient du jeton : c'est lui qui décide si une OFFRE passe (§2.1). */
  private actor(auth: AuthContext): HelpActor {
    return { userId: auth.userId, level: auth.claims.level };
  }

  // ── Lectures ──────────────────────────────────────────────────────────────

  @Get()
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Demandes et offres d’entraide, filtrées par ville, type et état' })
  async list(
    @Auth() auth: AuthContext,
    @Query(zodPipe(helpListQuerySchema)) query: z.infer<typeof helpListQuerySchema>,
  ) {
    return this.help.list(this.actor(auth), query);
  }

  @Get('can-help')
  @RequiresCapability('content.read')
  @ApiOperation({ summary: '« Vous pouvez aider » — demandes correspondant au membre (§2.6)' })
  async canHelp(
    @Auth() auth: AuthContext,
    @Query(zodPipe(helpCanHelpQuerySchema)) query: z.infer<typeof helpCanHelpQuerySchema>,
  ) {
    return this.help.canHelp(this.actor(auth), query);
  }

  @Get('mine')
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Mes demandes, archivées comprises' })
  async mine(
    @Auth() auth: AuthContext,
    @Query(zodPipe(helpMineQuerySchema)) query: z.infer<typeof helpMineQuerySchema>,
  ) {
    return this.help.mine(this.actor(auth), query);
  }

  @Get('my-responses')
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Mes réponses' })
  async myResponses(
    @Auth() auth: AuthContext,
    @Query(zodPipe(helpMyResponsesQuerySchema)) query: z.infer<typeof helpMyResponsesQuerySchema>,
  ) {
    return this.help.myResponses(this.actor(auth), query);
  }

  @Get(':id')
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Une demande, ses réponses et son contexte de parcours' })
  async detail(@Auth() auth: AuthContext, @Param('id', zodPipe(uuidSchema)) id: string) {
    return this.help.detail(this.actor(auth), id);
  }

  // ── Écritures ─────────────────────────────────────────────────────────────

  @Post()
  @HttpCode(201)
  @RequiresCapability('help.ask')
  @ApiOperation({ summary: 'Publier une demande (L0) ou une offre (L1 — §2.1)' })
  async create(
    @Auth() auth: AuthContext,
    @Body(zodPipe(createHelpSchema)) body: z.infer<typeof createHelpSchema>,
  ) {
    return this.help.create(this.actor(auth), body);
  }

  @Patch(':id')
  @RequiresCapability('help.ask')
  @ApiOperation({ summary: 'Modifier sa demande, tant qu’elle est ouverte' })
  async update(
    @Auth() auth: AuthContext,
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Body(zodPipe(updateHelpSchema)) body: z.infer<typeof updateHelpSchema>,
  ) {
    return this.help.update(this.actor(auth), id, body);
  }

  /** `comment.create` (L0) : « un pré-départ aide un autre pré-départ » (§2.3). */
  @Post(':id/responses')
  @HttpCode(201)
  @RequiresCapability('comment.create')
  @ApiOperation({ summary: 'Répondre publiquement à une demande' })
  async respond(
    @Auth() auth: AuthContext,
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Body(zodPipe(createHelpResponseSchema)) body: z.infer<typeof createHelpResponseSchema>,
  ) {
    return this.help.respond(this.actor(auth), id, body);
  }

  /**
   * « Ça m'a aidé » (§2.4). Capacité `help.ask` : c'est l'action de l'auteur sur
   * sa propre demande, et il a nécessairement eu `help.ask` pour la publier. La
   * matrice du §7.3 ne prévoit pas de capacité de clôture, et en inventer une
   * ferait diverger la source unique des capacités.
   */
  @Post(':id/responses/:rid/helpful')
  @HttpCode(200)
  @RequiresCapability('help.ask')
  @ApiOperation({ summary: 'Marquer une réponse « ça m’a aidé » — clôt la demande' })
  async markHelpful(
    @Auth() auth: AuthContext,
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Param('rid', zodPipe(uuidSchema)) rid: string,
  ) {
    return this.help.markHelpful(this.actor(auth), id, rid);
  }

  @Post(':id/resolve')
  @HttpCode(200)
  @RequiresCapability('help.ask')
  @ApiOperation({ summary: '« Résolu sans réponse », ou « Offre pourvue » (§2.9)' })
  async resolve(@Auth() auth: AuthContext, @Param('id', zodPipe(uuidSchema)) id: string) {
    return this.help.resolve(this.actor(auth), id);
  }

  @Post(':id/reopen')
  @HttpCode(200)
  @RequiresCapability('help.ask')
  @ApiOperation({ summary: 'Rouvrir une demande résolue, dans les 7 jours (§2.2)' })
  async reopen(@Auth() auth: AuthContext, @Param('id', zodPipe(uuidSchema)) id: string) {
    return this.help.reopen(this.actor(auth), id);
  }

  /** `message.send` (L1) : §4 attend `LEVEL_REQUIRED`, le garde s'en charge. */
  @Post(':id/private-reply')
  @HttpCode(200)
  @RequiresCapability('message.send')
  @ApiOperation({ summary: 'Ouvrir ou retrouver la conversation directe avec l’auteur' })
  async privateReply(@Auth() auth: AuthContext, @Param('id', zodPipe(uuidSchema)) id: string) {
    return this.help.privateReply(this.actor(auth), id);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequiresCapability('help.ask')
  @ApiOperation({ summary: 'Supprimer sa demande (suppression logique)' })
  async remove(
    @Auth() auth: AuthContext,
    @Param('id', zodPipe(uuidSchema)) id: string,
  ): Promise<void> {
    await this.help.remove(this.actor(auth), id);
  }

  /**
   * Modifier SA réponse. `comment.create` comme la publication : c'est la même
   * capacité, et le service refuse tout ce qui n'est pas la réponse de l'appelant.
   */
  @Patch(':id/responses/:rid')
  @RequiresCapability('comment.create')
  @ApiOperation({ summary: 'Modifier sa réponse, tant que la demande est ouverte' })
  async updateResponse(
    @Auth() auth: AuthContext,
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Param('rid', zodPipe(uuidSchema)) rid: string,
    @Body(zodPipe(updateHelpResponseSchema)) body: z.infer<typeof updateHelpResponseSchema>,
  ) {
    return this.help.updateResponse(this.actor(auth), id, rid, body);
  }

  @Delete(':id/responses/:rid')
  @HttpCode(204)
  @RequiresCapability('comment.create')
  @ApiOperation({ summary: 'Supprimer sa réponse — sauf si elle a été marquée « ça m’a aidé »' })
  async removeResponse(
    @Auth() auth: AuthContext,
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Param('rid', zodPipe(uuidSchema)) rid: string,
  ): Promise<void> {
    await this.help.removeResponse(this.actor(auth), id, rid);
  }
}
