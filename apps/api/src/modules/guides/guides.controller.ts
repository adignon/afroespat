import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  amendProposalSchema,
  createGuideSchema,
  createProposalSchema,
  cursorQuerySchema,
  guideListQuerySchema,
  guideOutdatedFlagSchema,
  guideRevertSchema,
  guideVoteSchema,
  rejectProposalSchema,
  slugSchema,
  updateGuideSchema,
  uuidSchema,
} from '@app/shared';
import type { z } from 'zod';
import { Auth, type AuthContext, MaybeAuth } from '../../common/auth.guard';
import { PublicRead, RateLimit, RequiresCapability } from '../../common/capability.decorator';
import { zodPipe } from '../../common/zod.pipe';
import { GuidesService } from './guides.service';

/**
 * Guides et démarches — 05-guides.md §4.
 *
 * Les lectures sont `@PublicRead()` : un guide publié est de la documentation,
 * et §2.3 veut qu'il soit lisible — le service applique malgré tout la
 * visibilité (brouillon de quelqu'un d'autre, guide dépublié, membre bloqué).
 *
 * Les écritures déclarent la capacité du §2 : `guide.write` pour rédiger,
 * `guide.vote` pour voter, `guide.propose_revision` pour proposer. Le décorateur
 * porte aussi `x-capability` dans l'OpenAPI, que le test de couverture parcourt.
 */
@ApiTags('guides')
@Controller()
export class GuidesController {
  constructor(private readonly guides: GuidesService) {}

  // ── Listes et lectures ────────────────────────────────────────────────────

  @Get('guides')
  @PublicRead()
  @ApiOperation({ summary: 'Guides — onglets utiles / récents / à vérifier (§2.3)' })
  async list(
    @Query(zodPipe(guideListQuerySchema)) query: z.infer<typeof guideListQuerySchema>,
    @MaybeAuth() viewer: AuthContext | null,
  ) {
    return this.guides.list(query, viewer?.userId ?? null);
  }

  /**
   * `/me/guides` et non `/guides/mine` : §4 nomme cette route ainsi, et le
   * préfixe `/me` évite qu'elle entre en concurrence avec `/guides/:slug` —
   * Express résout dans l'ordre de déclaration, et un jour quelqu'un
   * réordonnerait ce fichier.
   */
  @Get('me/guides')
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Mes guides, tous statuts (§4)' })
  async mine(
    @Auth() auth: AuthContext,
    @Query(zodPipe(cursorQuerySchema)) query: z.infer<typeof cursorQuerySchema>,
  ) {
    return this.guides.mine(auth.userId, query.limit);
  }

  @Get('me/proposals')
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Mes propositions de mise à jour (§4)' })
  async myProposals(
    @Auth() auth: AuthContext,
    @Query(zodPipe(cursorQuerySchema)) query: z.infer<typeof cursorQuerySchema>,
  ) {
    return this.guides.myProposals(auth.userId, query.limit);
  }

  @Get('guides/:slug')
  @PublicRead()
  @ApiOperation({ summary: 'Un guide : version courante, contributeurs, mon vote, bandeaux' })
  async bySlug(
    @Param('slug', zodPipe(slugSchema)) slug: string,
    @MaybeAuth() viewer: AuthContext | null,
  ) {
    return this.guides.bySlug(slug, viewer?.userId ?? null);
  }

  @Get('guides/:slug/versions')
  @PublicRead()
  @ApiOperation({ summary: 'Historique des versions (§2.7)' })
  async versions(
    @Param('slug', zodPipe(slugSchema)) slug: string,
    @MaybeAuth() viewer: AuthContext | null,
  ) {
    return this.guides.versions(slug, viewer?.userId ?? null);
  }

  @Get('guides/:slug/versions/:versionId')
  @PublicRead()
  @ApiOperation({ summary: 'Une version, avec son corps (§2.7)' })
  async version(
    @Param('slug', zodPipe(slugSchema)) slug: string,
    @Param('versionId', zodPipe(uuidSchema)) versionId: string,
    @MaybeAuth() viewer: AuthContext | null,
  ) {
    return this.guides.version(slug, versionId, viewer?.userId ?? null);
  }

  // ── Rédaction ─────────────────────────────────────────────────────────────

  @Post('guides')
  @RequiresCapability('guide.write')
  @ApiOperation({ summary: 'Crée un brouillon de guide (§2.1)' })
  async create(
    @Auth() auth: AuthContext,
    @Body(zodPipe(createGuideSchema)) body: z.infer<typeof createGuideSchema>,
  ) {
    return this.guides.createDraft(auth.userId, body);
  }

  @Patch('guides/:id')
  @RequiresCapability('guide.write')
  // L'éditeur enregistre le brouillon automatiquement (§5) : la limite d'écriture
  // par défaut (30/min) serait atteinte en une minute de frappe.
  @RateLimit(60)
  @ApiOperation({ summary: 'Modifie un brouillon, ou édite directement (§2.7)' })
  async update(
    @Auth() auth: AuthContext,
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Body(zodPipe(updateGuideSchema)) body: z.infer<typeof updateGuideSchema>,
  ) {
    return this.guides.update(auth.userId, id, body);
  }

  @Post('guides/:id/publish')
  @RequiresCapability('guide.write')
  @ApiOperation({ summary: 'Publie le guide (§2.1)' })
  async publish(@Auth() auth: AuthContext, @Param('id', zodPipe(uuidSchema)) id: string) {
    return this.guides.publish(auth.userId, id);
  }

  @Post('guides/:id/unpublish')
  @RequiresCapability('guide.write')
  @ApiOperation({ summary: 'Dépublie son propre guide (§4)' })
  async unpublish(@Auth() auth: AuthContext, @Param('id', zodPipe(uuidSchema)) id: string) {
    return this.guides.unpublish(auth.userId, id);
  }

  @Post('guides/:id/revert')
  @RequiresCapability('guide.write')
  @ApiOperation({ summary: 'Retour arrière : nouvelle version copiant une ancienne (§2.7)' })
  async revert(
    @Auth() auth: AuthContext,
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Body(zodPipe(guideRevertSchema)) body: z.infer<typeof guideRevertSchema>,
  ) {
    return this.guides.revert(auth.userId, id, body.versionId);
  }

  // ── Vote d'utilité ────────────────────────────────────────────────────────

  @Put('guides/:id/vote')
  @RequiresCapability('guide.vote')
  @ApiOperation({ summary: '« Ce guide vous a-t-il aidé ? » (§2.2)' })
  async vote(
    @Auth() auth: AuthContext,
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Body(zodPipe(guideVoteSchema)) body: z.infer<typeof guideVoteSchema>,
  ) {
    return this.guides.vote(auth.userId, id, body.value);
  }

  @Delete('guides/:id/vote')
  @RequiresCapability('guide.vote')
  @ApiOperation({ summary: 'Retire son vote (§2.2)' })
  async removeVote(@Auth() auth: AuthContext, @Param('id', zodPipe(uuidSchema)) id: string) {
    return this.guides.removeVote(auth.userId, id);
  }

  // ── Obsolescence ──────────────────────────────────────────────────────────

  /**
   * « L'information a changé » (§2.6). Distinct du signalement d'abus.
   *
   * La matrice des capacités (00 §7.3, figée dans `@app/shared`) n'en déclare
   * aucune pour ce geste. `guide.propose_revision` est retenue plutôt que
   * `content.read` : trois signalements enclenchent une dépublication, et ouvrir
   * cela à un compte non vérifié (L0) offrirait un moyen de faire tomber un
   * guide à peu de frais. Signaler que l'information a changé, c'est déjà
   * proposer une correction.
   */
  @Post('guides/:id/outdated')
  @RequiresCapability('guide.propose_revision')
  @ApiOperation({ summary: 'Signale que l’information a changé (§2.6)' })
  async flagOutdated(
    @Auth() auth: AuthContext,
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Body(zodPipe(guideOutdatedFlagSchema)) body: z.infer<typeof guideOutdatedFlagSchema>,
  ) {
    return this.guides.flagOutdated(auth.userId, id, body.comment);
  }

  @Delete('guides/:id/outdated')
  @RequiresCapability('guide.propose_revision')
  @ApiOperation({ summary: 'Retire son signalement d’obsolescence' })
  async removeOutdatedFlag(
    @Auth() auth: AuthContext,
    @Param('id', zodPipe(uuidSchema)) id: string,
  ) {
    return this.guides.removeOutdatedFlag(auth.userId, id);
  }

  // ── Propositions de mise à jour ───────────────────────────────────────────

  @Post('guides/:id/proposals')
  @RequiresCapability('guide.propose_revision')
  @ApiOperation({ summary: 'Propose une correction sur un passage (§2.4)' })
  async createProposal(
    @Auth() auth: AuthContext,
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Body(zodPipe(createProposalSchema)) body: z.infer<typeof createProposalSchema>,
  ) {
    return this.guides.createProposal(auth.userId, id, body);
  }

  @Get('guides/:id/proposals')
  @PublicRead()
  @ApiOperation({ summary: 'Propositions : en attente pour l’auteur, acceptées pour tous (§4)' })
  async listProposals(
    @Param('id', zodPipe(uuidSchema)) id: string,
    @MaybeAuth() viewer: AuthContext | null,
  ) {
    return this.guides.listProposals(id, viewer?.userId ?? null);
  }

  @Post('proposals/:id/accept')
  @RequiresCapability('guide.write')
  @ApiOperation({ summary: 'Accepte une proposition : nouvelle version, contributeur crédité' })
  async acceptProposal(@Auth() auth: AuthContext, @Param('id', zodPipe(uuidSchema)) id: string) {
    return this.guides.decideProposal(auth.userId, id, { kind: 'ACCEPT' });
  }

  @Post('proposals/:id/amend')
  @RequiresCapability('guide.write')
  @ApiOperation({ summary: 'Accepte en modifiant — le contributeur est crédité quand même' })
  async amendProposal(
    @Auth() auth: AuthContext,
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Body(zodPipe(amendProposalSchema)) body: z.infer<typeof amendProposalSchema>,
  ) {
    return this.guides.decideProposal(auth.userId, id, {
      kind: 'AMEND',
      replacement: body.replacement,
    });
  }

  @Post('proposals/:id/reject')
  @RequiresCapability('guide.write')
  @ApiOperation({ summary: 'Refuse une proposition — motif obligatoire (§2.4)' })
  async rejectProposal(
    @Auth() auth: AuthContext,
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Body(zodPipe(rejectProposalSchema)) body: z.infer<typeof rejectProposalSchema>,
  ) {
    return this.guides.decideProposal(auth.userId, id, { kind: 'REJECT', reason: body.reason });
  }

  // ── Conversion depuis un parcours (§2.8) ──────────────────────────────────

  @Post('journeys/:id/to-guide')
  @RequiresCapability('guide.write')
  @ApiOperation({ summary: 'Pré-remplit un brouillon depuis un parcours terminé (§2.8)' })
  async fromJourney(@Auth() auth: AuthContext, @Param('id', zodPipe(uuidSchema)) id: string) {
    return this.guides.draftFromJourney(auth.userId, id);
  }
}
