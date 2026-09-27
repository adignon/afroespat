import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { proProfileSchema, proProofSchema, prosQuerySchema, recommendProSchema, uuidSchema } from '@app/shared';
import type { z } from 'zod';
import { Auth, type AuthContext, MaybeAuth } from '../../common/auth.guard';
import { PublicRead, RateLimit, RequiresCapability } from '../../common/capability.decorator';
import { zodPipe } from '../../common/zod.pipe';
import { ProsService } from './pros.service';

/**
 * Annuaire professionnel — 10-services.md §6.3.
 *
 * Le choix des capacités mérite d'être expliqué, parce que la matrice du §7.3 est une
 * SOURCE UNIQUE qu'un module ne complète pas :
 *
 *   · `pro.register` (**L2**) pour créer et modifier sa fiche et déposer son
 *     justificatif — c'est exactement ce que la matrice nomme ;
 *   · `pro.contact` (L1, quota `proContactsPerMonth`) pour contacter. La capacité PORTE
 *     le quota, ce qui autorise le service à lire `users.plan` — c'est la seule route
 *     de ce module qui y a droit ;
 *   · `post.create` (L1, `planLimit: null`) pour recommander. §4.3 demande « capacité
 *     L1 » sans la nommer, et une recommandation ne doit JAMAIS dépendre d'un plan :
 *     `pro.contact` aurait laissé entendre le contraire. `post.create` est la seule
 *     capacité L1 du bon niveau qui ne porte aucun quota.
 *
 * Les routes d'administration du §6.3 (`/v1/admin/pros/pending`, approuver, rejeter)
 * ne sont pas ici : elles exigent une authentification d'équipe qui n'existe pas
 * encore, et les colonnes `approved_at`, `approved_by_staff_id`, `rejection_reason`
 * manquent au schéma figé.
 */
@ApiTags('pros')
@Controller()
export class ProsController {
  constructor(private readonly pros: ProsService) {}

  // ── Lecture ───────────────────────────────────────────────────────────────

  /**
   * Déclarée avant `pros/:id` pour la même raison que partout : sans cela, Nest ferait
   * correspondre un segment littéral au paramètre. Ici les chemins ne se croisent pas,
   * mais l'ordre reste la convention du projet.
   */
  @Get('me/pro-profile')
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Ma fiche, son statut de validation, et si un justificatif est déposé' })
  async myProfile(@Auth() auth: AuthContext) {
    return this.pros.myProfile(auth.userId);
  }

  @Get('pros')
  @PublicRead()
  @ApiOperation({ summary: 'Annuaire — au plus 2 fiches mises en avant, signalées, puis le classement naturel' })
  async list(
    @Query(zodPipe(prosQuerySchema)) query: z.infer<typeof prosQuerySchema>,
    @MaybeAuth() viewer: AuthContext | null,
  ) {
    return this.pros.list(query, viewer?.userId ?? null);
  }

  @Get('pros/:id')
  @PublicRead()
  @ApiOperation({ summary: 'Une fiche, ses recommandations et vos contacts en commun' })
  async detail(
    @Param('id', zodPipe(uuidSchema)) id: string,
    @MaybeAuth() viewer: AuthContext | null,
  ) {
    return this.pros.detail(id, viewer?.userId ?? null);
  }

  // ── Ma fiche (L2 + justificatif, §4.1) ────────────────────────────────────

  @Put('me/pro-profile')
  @RequiresCapability('pro.register')
  @RateLimit(10)
  @ApiOperation({ summary: 'Crée ou met à jour ma fiche (L2 + justificatif)' })
  async putProfile(
    @Auth() auth: AuthContext,
    @Body(zodPipe(proProfileSchema)) body: z.infer<typeof proProfileSchema>,
  ) {
    return this.pros.putProfile(auth.userId, body);
  }

  @Post('me/pro-profile/proof')
  @RequiresCapability('pro.register')
  @RateLimit(10)
  @ApiOperation({ summary: 'Dépose ou remplace le justificatif d’activité — relance la relecture' })
  async submitProof(
    @Auth() auth: AuthContext,
    @Body(zodPipe(proProofSchema)) body: z.infer<typeof proProofSchema>,
  ) {
    return this.pros.submitProof(auth.userId, body.proofAssetId);
  }

  // ── Contact et recommandations ────────────────────────────────────────────

  @Post('pros/:id/contact')
  @RequiresCapability('pro.contact')
  @RateLimit(20)
  @ApiOperation({ summary: 'Ouvre une conversation — 3 fiches distinctes par mois en gratuit' })
  async contact(@Param('id', zodPipe(uuidSchema)) id: string, @Auth() auth: AuthContext) {
    return this.pros.contact(id, auth.userId);
  }

  @Post('pros/:id/recommend')
  @RequiresCapability('post.create')
  @RateLimit(20)
  @ApiOperation({ summary: 'Recommande ce professionnel — exige un contact existant' })
  async recommend(
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Auth() auth: AuthContext,
    @Body(zodPipe(recommendProSchema)) body: z.infer<typeof recommendProSchema>,
  ) {
    return this.pros.recommend(id, auth.userId, body);
  }

  @Delete('pros/:id/recommend')
  @RequiresCapability('post.create')
  @ApiOperation({ summary: 'Retire ma recommandation' })
  async unrecommend(@Param('id', zodPipe(uuidSchema)) id: string, @Auth() auth: AuthContext) {
    return this.pros.unrecommend(id, auth.userId);
  }
}
