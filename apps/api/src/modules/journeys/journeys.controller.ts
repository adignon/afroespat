import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import {
  addJourneyMemberSchema,
  createJourneySchema,
  createJourneyStepSchema,
  inactivityResponseSchema,
  journeyActivitiesQuerySchema,
  publicJourneysQuerySchema,
  publishBlockerSchema,
  reorderStepsSchema,
  replaceChecklistSchema,
  reportTemplateErrorSchema,
  shareMilestoneSchema,
  updateJourneySchema,
  updateJourneyStepSchema,
  uuidSchema,
} from '@app/shared';
import type { z } from 'zod';
import { Auth, type AuthContext } from '../../common/auth.guard';
import { RequiresCapability } from '../../common/capability.decorator';
import { zodPipe } from '../../common/zod.pipe';
import { JourneysService, type JourneyActor } from './journeys.service';

/**
 * Parcours — 03-parcours.md §5.1.
 *
 * AUCUNE route n'est `@PublicRead()`, et c'est une règle dure : §3.7 dit qu'« un
 * parcours public n'est jamais visible hors connexion ni indexé par la
 * recherche ». « Public » veut dire « visible des MEMBRES CONNECTÉS » — pas du
 * web. Un `@PublicRead()` sur `/journeys/public` suffirait à faire mentir cette
 * phrase, et personne ne le verrait avant le premier robot d'indexation.
 *
 * Les capacités : `journey.create` (L0) pour créer, `journey.manage` (L0) pour
 * tout le reste du parcours — un pré-départ non vérifié doit pouvoir avancer dans
 * ses démarches, c'est la raison d'être du produit. Deux exceptions, qui publient
 * hors du parcours et relèvent donc du niveau de la publication :
 *
 *   · `POST /journeys/:id/steps/:stepId/share` porte `post.create` (L1) : elle
 *     écrit une publication dans le fil ;
 *   · `POST /blockers/:id/publish` porte `help.ask` (L0) : demander de l'aide
 *     n'attend pas la vérification d'identité (06 §2.1), et c'est l'entraide qui
 *     vérifiera le reste.
 */
@ApiTags('journeys')
@Controller()
export class JourneysController {
  constructor(private readonly journeys: JourneysService) {}

  /** L'acteur tel que le jeton le décrit : l'identité ET le niveau. */
  private actor(auth: AuthContext): JourneyActor {
    return { userId: auth.userId, level: auth.claims.level };
  }

  // ── Modèles et listes ─────────────────────────────────────────────────────

  @Get('journey-templates')
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Types de parcours proposés, résolus pour mon pays (§2.1)' })
  async templates(@Auth() auth: AuthContext) {
    return this.journeys.templates(auth.userId);
  }

  /**
   * LES ÉTAPES D'UN TYPE, AVANT TOUTE OUVERTURE DE PARCOURS.
   *
   * `journey-templates` au-dessus rend `version.stepCount` — un nombre, pas des
   * noms. Jusqu'ici les étapes n'existaient pour un membre qu'APRÈS l'ouverture
   * d'un parcours, qui les copie dans `journey_steps`.
   *
   * Le composeur de story en a besoin avant : `POST /stories` accepte un
   * `stepDefinitionId`, et c'est ce qui « rend un conseil réutilisable » (§2.6).
   * Sans cette route l'écran ne pouvait proposer qu'une liste écrite en dur —
   * donc sans identifiant, donc inenvoyable.
   *
   * ── L'ORDRE DES ROUTES COMPTE ─────────────────────────────────────────────
   *
   * Elle est déclarée AVANT `journeys/:id` et consorts, et son chemin commence par
   * le segment littéral `journey-templates` : Nest résout dans l'ordre de
   * déclaration, et un segment variable placé avant avalerait celui-ci sans que
   * rien ne le signale.
   *
   * `content.read` comme sa voisine : lire les étapes proposées ne demande pas
   * plus que lire les types.
   */
  @Get('journey-templates/:id/steps')
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Étapes d’un type de parcours, résolues pour mon pays (§2.1)' })
  async templateSteps(
    @Auth() auth: AuthContext,
    @Param('id', zodPipe(uuidSchema)) id: string,
  ) {
    return this.journeys.templateSteps(auth.userId, id);
  }

  @Get('journeys')
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Mes parcours et ceux où je suis accompagnant (§5.1)' })
  async list(@Auth() auth: AuthContext) {
    return this.journeys.list(auth.userId);
  }

  /**
   * Déclarée AVANT `journeys/:id` : Express résout dans l'ordre, et `public`
   * serait sinon lu comme un identifiant — qui échouerait à la validation UUID,
   * donc en 400 au lieu de la liste attendue.
   */
  /**
   * Les invitations qui attendent ma réponse (§3.4). Déclarée AVANT `journeys/:id`
   * pour la raison déjà dite plus bas : `invitations` n'est pas un identifiant, et
   * Express le lirait comme tel, d'où un 400 au lieu de la liste.
   */
  @Get('journeys/invitations')
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Les invitations à rejoindre l’équipe d’un parcours, en attente' })
  async invitations(@Auth() auth: AuthContext) {
    return this.journeys.invitations(auth.userId);
  }

  @Get('journeys/public')
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Parcours publics d’autres membres (§3.7)' })
  async publicList(
    @Auth() auth: AuthContext,
    @Query(zodPipe(publicJourneysQuerySchema)) query: z.infer<typeof publicJourneysQuerySchema>,
  ) {
    return this.journeys.publicList(auth.userId, query);
  }

  @Get('journeys/public/:id')
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Vue publique d’un parcours — progression seule (§3.7)' })
  async publicDetail(@Auth() auth: AuthContext, @Param('id', zodPipe(uuidSchema)) id: string) {
    return this.journeys.publicDetail(auth.userId, id);
  }

  @Get('journeys/:id')
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Parcours complet : étapes, checklist, équipe, progression' })
  async detail(@Auth() auth: AuthContext, @Param('id', zodPipe(uuidSchema)) id: string) {
    return this.journeys.detail(auth.userId, id);
  }

  @Get('journeys/:id/activities')
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Journal du parcours, paginé (§3.8)' })
  async activities(
    @Auth() auth: AuthContext,
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Query(zodPipe(journeyActivitiesQuerySchema)) query: z.infer<typeof journeyActivitiesQuerySchema>,
  ) {
    return this.journeys.activities(auth.userId, id, query);
  }

  // ── Le parcours ───────────────────────────────────────────────────────────

  @Post('journeys')
  @RequiresCapability('journey.create')
  @ApiOperation({ summary: 'Crée un parcours (§3.1) — PLAN_LIMIT_REACHED en gratuit' })
  async create(
    @Auth() auth: AuthContext,
    @Body(zodPipe(createJourneySchema)) body: z.infer<typeof createJourneySchema>,
  ) {
    return this.journeys.create(this.actor(auth), body);
  }

  @Post('journeys/:id/conversation')
  @HttpCode(200)
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'La discussion du parcours, créée si elle manque (idempotent)' })
  async ensureConversation(@Auth() auth: AuthContext, @Param('id', zodPipe(uuidSchema)) id: string) {
    return this.journeys.ensureConversation(auth.userId, id);
  }

  @Patch('journeys/:id')
  @RequiresCapability('journey.manage')
  @ApiOperation({ summary: 'Titre, date cible, mise en pause, visibilité (§3.7)' })
  async update(
    @Auth() auth: AuthContext,
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Body(zodPipe(updateJourneySchema)) body: z.infer<typeof updateJourneySchema>,
    @Req() request: Request,
  ) {
    // L'IP est la preuve du consentement `JOURNEY_VISIBILITY` (01 §2.10).
    return this.journeys.update(auth.userId, id, body, request.ip);
  }

  @Post('journeys/:id/migrate')
  @RequiresCapability('journey.manage')
  @ApiOperation({ summary: 'Migre vers la version publiée courante du modèle (§2.2) — ALREADY_CURRENT' })
  async migrate(@Auth() auth: AuthContext, @Param('id', zodPipe(uuidSchema)) id: string) {
    return this.journeys.migrate(auth.userId, id);
  }

  @Post('journeys/:id/inactivity-response')
  @RequiresCapability('journey.manage')
  @ApiOperation({ summary: 'Réponse à « Où en êtes-vous ? » (§3.9)' })
  async inactivityResponse(
    @Auth() auth: AuthContext,
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Body(zodPipe(inactivityResponseSchema)) body: z.infer<typeof inactivityResponseSchema>,
  ) {
    return this.journeys.inactivityResponse(auth.userId, id, body);
  }

  @Post('journeys/:id/report-template-error')
  @RequiresCapability('journey.manage')
  @ApiOperation({ summary: 'Signaler une erreur dans ce modèle (§2.4)' })
  async reportTemplateError(
    @Auth() auth: AuthContext,
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Body(zodPipe(reportTemplateErrorSchema)) body: z.infer<typeof reportTemplateErrorSchema>,
  ) {
    return this.journeys.reportTemplateError(auth.userId, id, body);
  }

  // ── Étapes ────────────────────────────────────────────────────────────────

  @Post('journeys/:id/steps')
  @RequiresCapability('journey.manage')
  @ApiOperation({ summary: 'Ajoute une étape personnelle (§3.2)' })
  async addStep(
    @Auth() auth: AuthContext,
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Body(zodPipe(createJourneyStepSchema)) body: z.infer<typeof createJourneyStepSchema>,
  ) {
    return this.journeys.addStep(auth.userId, id, body);
  }

  /**
   * Déclarée avant `journeys/:id/steps/:stepId` pour la même raison qu'au-dessus :
   * `order` n'est pas un identifiant d'étape.
   */
  @Put('journeys/:id/steps/order')
  @RequiresCapability('journey.manage')
  @ApiOperation({ summary: 'Réordonne les étapes (§3.2)' })
  async reorderSteps(
    @Auth() auth: AuthContext,
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Body(zodPipe(reorderStepsSchema)) body: z.infer<typeof reorderStepsSchema>,
  ) {
    return this.journeys.reorderSteps(auth.userId, id, body);
  }

  @Patch('journeys/:id/steps/:stepId')
  @RequiresCapability('journey.manage')
  @ApiOperation({ summary: 'État, échéance, notes d’une étape (§3.2) — INVALID_TRANSITION' })
  async updateStep(
    @Auth() auth: AuthContext,
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Param('stepId', zodPipe(uuidSchema)) stepId: string,
    @Body(zodPipe(updateJourneyStepSchema)) body: z.infer<typeof updateJourneyStepSchema>,
  ) {
    return this.journeys.updateStep(this.actor(auth), id, stepId, body);
  }

  @Delete('journeys/:id/steps/:stepId')
  @RequiresCapability('journey.manage')
  @ApiOperation({ summary: 'Retire une étape (§3.2)' })
  async deleteStep(
    @Auth() auth: AuthContext,
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Param('stepId', zodPipe(uuidSchema)) stepId: string,
  ) {
    return this.journeys.deleteStep(auth.userId, id, stepId);
  }

  @Put('journeys/:id/steps/:stepId/checklist')
  @RequiresCapability('journey.manage')
  @ApiOperation({ summary: 'Remplace la checklist de documents (§3.3) — aucun fichier' })
  async replaceChecklist(
    @Auth() auth: AuthContext,
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Param('stepId', zodPipe(uuidSchema)) stepId: string,
    @Body(zodPipe(replaceChecklistSchema)) body: z.infer<typeof replaceChecklistSchema>,
  ) {
    return this.journeys.replaceChecklist(auth.userId, id, stepId, body);
  }

  // ── Équipe ────────────────────────────────────────────────────────────────

  @Post('journeys/:id/members')
  @RequiresCapability('journey.manage')
  @ApiOperation({ summary: 'Invite un accompagnant (§3.4) — MAX_MEMBERS, BLOCKED_RELATIONSHIP' })
  async addMember(
    @Auth() auth: AuthContext,
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Body(zodPipe(addJourneyMemberSchema)) body: z.infer<typeof addJourneyMemberSchema>,
  ) {
    return this.journeys.addMember(auth.userId, id, body);
  }

  @Post('journeys/:id/members/accept')
  @RequiresCapability('journey.manage')
  @ApiOperation({ summary: 'J’accepte l’invitation (§3.4)' })
  async acceptInvite(@Auth() auth: AuthContext, @Param('id', zodPipe(uuidSchema)) id: string) {
    return this.journeys.acceptInvite(auth.userId, id);
  }

  @Post('journeys/:id/members/decline')
  @RequiresCapability('journey.manage')
  @ApiOperation({ summary: 'Je refuse l’invitation (§3.4)' })
  async declineInvite(@Auth() auth: AuthContext, @Param('id', zodPipe(uuidSchema)) id: string) {
    return this.journeys.declineInvite(auth.userId, id);
  }

  @Delete('journeys/:id/members/:userId')
  @RequiresCapability('journey.manage')
  @ApiOperation({ summary: 'Retire un accompagnant (§3.4)' })
  async removeMember(
    @Auth() auth: AuthContext,
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Param('userId', zodPipe(uuidSchema)) memberUserId: string,
  ) {
    return this.journeys.removeMember(auth.userId, id, memberUserId);
  }

  // ── « Je suis bloqué » (§3.5) ─────────────────────────────────────────────

  @Post('journeys/:id/steps/:stepId/blocker')
  @RequiresCapability('journey.manage')
  @ApiOperation({ summary: 'Crée le BROUILLON et rend le texte pré-rempli (§3.5)' })
  async createBlockerDraft(
    @Auth() auth: AuthContext,
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Param('stepId', zodPipe(uuidSchema)) stepId: string,
  ) {
    return this.journeys.createBlockerDraft(auth.userId, id, stepId);
  }

  /**
   * La SEULE route qui promeut un brouillon en contenu (§3.5, règle dure). Le
   * texte publié est celui du corps de la requête, jamais le gabarit.
   */
  @Post('blockers/:id/publish')
  @RequiresCapability('help.ask')
  @ApiOperation({ summary: 'Publie la demande — appel explicite, texte du client (§3.5)' })
  async publishBlocker(
    @Auth() auth: AuthContext,
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Body(zodPipe(publishBlockerSchema)) body: z.infer<typeof publishBlockerSchema>,
  ) {
    return this.journeys.publishBlocker(this.actor(auth), id, body);
  }

  @Post('blockers/:id/cancel')
  @RequiresCapability('journey.manage')
  @ApiOperation({ summary: 'Annule le brouillon (§3.5)' })
  async cancelBlocker(@Auth() auth: AuthContext, @Param('id', zodPipe(uuidSchema)) id: string) {
    return this.journeys.cancelBlocker(auth.userId, id);
  }

  // ── Partage de jalon (§3.6) ───────────────────────────────────────────────

  @Post('journeys/:id/steps/:stepId/share')
  @RequiresCapability('post.create')
  @ApiOperation({ summary: 'Publie la victoire avec MON texte (§3.6)' })
  async shareMilestone(
    @Auth() auth: AuthContext,
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Param('stepId', zodPipe(uuidSchema)) stepId: string,
    @Body(zodPipe(shareMilestoneSchema)) body: z.infer<typeof shareMilestoneSchema>,
  ) {
    return this.journeys.shareMilestone(this.actor(auth), id, stepId, body);
  }

  @Post('journeys/:id/steps/:stepId/dismiss-share')
  @RequiresCapability('journey.manage')
  @ApiOperation({ summary: 'Décliner le partage — plus jamais reproposé (§3.6)' })
  async dismissShare(
    @Auth() auth: AuthContext,
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Param('stepId', zodPipe(uuidSchema)) stepId: string,
  ) {
    return this.journeys.dismissShare(auth.userId, id, stepId);
  }
}
