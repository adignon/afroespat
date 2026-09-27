import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  createAlertSchema,
  createHousingSchema,
  housingQuerySchema,
  updateAlertSchema,
  updateHousingSchema,
  uuidSchema,
} from '@app/shared';
import type { z } from 'zod';
import { Auth, type AuthContext, MaybeAuth } from '../../common/auth.guard';
import { PublicRead, RateLimit, RequiresCapability } from '../../common/capability.decorator';
import { zodPipe } from '../../common/zod.pipe';
import { HousingService } from './housing.service';

/**
 * Logement — 10-services.md §6.1.
 *
 * Les LECTURES sont publiques, et c'est une décision du §2.3 : « un L0 pré-départ
 * peut LIRE les annonces ». Quelqu'un qui prépare son départ doit voir à quoi
 * ressemble le marché avant d'avoir un numéro français — c'est même une des raisons
 * de s'inscrire. Le service applique la visibilité de toute façon.
 *
 * Les ÉCRITURES déclarent leur capacité (00 §7.3) :
 *   · `housing.publish` (**L2**) pour publier, modifier, renouveler et retirer —
 *     c'est le même pouvoir sur le même objet, et §2.1 dit « sans exception » ;
 *   · `message.send` (L1) pour contacter : contacter, c'est écrire. C'est ce qui
 *     rend le refus d'un L0 cohérent avec le reste de la plateforme, plutôt que
 *     d'inventer une règle propre au logement ;
 *   · `content.read` pour les alertes. Une alerte est une RECHERCHE mémorisée : elle
 *     ne publie rien, n'expose rien à personne, et n'exige donc aucun niveau. Sa
 *     barrière est le PLAN (§2.4, Premium), que le service applique — la matrice du
 *     §7.3 ne porte volontairement aucune capacité d'alerte, et en inventer une
 *     reviendrait à dupliquer une source unique.
 *
 * `POST /housing/:id/hide-from` du §6.1 n'est pas déclarée : `hidden_from_user_ids`
 * n'existe pas dans le schéma figé. Une route qui accepterait l'appel sans rien
 * masquer serait pire que son absence — elle ferait croire au membre qu'il est
 * protégé.
 */
@ApiTags('housing')
@Controller()
export class HousingController {
  constructor(private readonly housing: HousingService) {}

  // ── Lecture ───────────────────────────────────────────────────────────────

  @Get('housing')
  @PublicRead()
  @ApiOperation({
    summary: 'Annonces et recherches de logement · bandeau de sécurité dans meta',
  })
  async list(
    @Query(zodPipe(housingQuerySchema)) query: z.infer<typeof housingQuerySchema>,
    @MaybeAuth() viewer: AuthContext | null,
  ) {
    return this.housing.list(query, viewer?.userId ?? null);
  }

  @Get('housing/:id')
  @PublicRead()
  @ApiOperation({ summary: 'Une annonce, son bandeau et vos contacts en commun' })
  async detail(
    @Param('id', zodPipe(uuidSchema)) id: string,
    @MaybeAuth() viewer: AuthContext | null,
  ) {
    return this.housing.detail(id, viewer?.userId ?? null);
  }

  // ── Publication (L2 sans exception, §2.1) ─────────────────────────────────

  @Post('housing')
  @RequiresCapability('housing.publish')
  // Publier une annonce est un geste rare, et la limite de débit ne doit pas
  // permettre d'arroser la ville pendant qu'un score de risque se calcule.
  @RateLimit(10)
  @ApiOperation({ summary: 'Publie une annonce ou une recherche (L2)' })
  async create(
    @Auth() auth: AuthContext,
    @Body(zodPipe(createHousingSchema)) body: z.infer<typeof createHousingSchema>,
  ) {
    return this.housing.create(auth.userId, body);
  }

  @Patch('housing/:id')
  @RequiresCapability('housing.publish')
  @RateLimit(20)
  @ApiOperation({ summary: 'Modifie une annonce — le score de risque est recalculé' })
  async update(
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Auth() auth: AuthContext,
    @Body(zodPipe(updateHousingSchema)) body: z.infer<typeof updateHousingSchema>,
  ) {
    return this.housing.update(id, auth.userId, body);
  }

  @Post('housing/:id/renew')
  @RequiresCapability('housing.publish')
  @ApiOperation({ summary: 'Repousse l’expiration de 60 jours (une fois par 30 jours)' })
  async renew(@Param('id', zodPipe(uuidSchema)) id: string, @Auth() auth: AuthContext) {
    return this.housing.renew(id, auth.userId);
  }

  @Post('housing/:id/pause')
  @RequiresCapability('housing.publish')
  @ApiOperation({ summary: 'Met l’annonce en pause' })
  async pause(@Param('id', zodPipe(uuidSchema)) id: string, @Auth() auth: AuthContext) {
    return this.housing.setStatus(id, auth.userId, 'PAUSED');
  }

  /**
   * Reprise. Absente du §6.1, ajoutée parce que `PAUSED` y serait sinon une porte à
   * sens unique : l'écran « Mes annonces » propose bien de mettre en pause, et rien
   * ne permettrait de reprendre.
   */
  @Post('housing/:id/resume')
  @RequiresCapability('housing.publish')
  @ApiOperation({ summary: 'Remet en ligne une annonce en pause' })
  async resume(@Param('id', zodPipe(uuidSchema)) id: string, @Auth() auth: AuthContext) {
    return this.housing.setStatus(id, auth.userId, 'ACTIVE');
  }

  @Post('housing/:id/taken')
  @RequiresCapability('housing.publish')
  @ApiOperation({ summary: '« Logement trouvé » — retire l’annonce des listes' })
  async taken(@Param('id', zodPipe(uuidSchema)) id: string, @Auth() auth: AuthContext) {
    return this.housing.setStatus(id, auth.userId, 'TAKEN');
  }

  @Delete('housing/:id')
  @RequiresCapability('housing.publish')
  @ApiOperation({ summary: 'Retire définitivement l’annonce' })
  async remove(@Param('id', zodPipe(uuidSchema)) id: string, @Auth() auth: AuthContext) {
    return this.housing.setStatus(id, auth.userId, 'REMOVED');
  }

  // ── Contact (§2.3) ────────────────────────────────────────────────────────

  @Post('housing/:id/contact')
  @RequiresCapability('message.send')
  @RateLimit(20)
  @ApiOperation({ summary: 'Ouvre une conversation avec l’auteur (L1 ; L0 → parrainage)' })
  async contact(@Param('id', zodPipe(uuidSchema)) id: string, @Auth() auth: AuthContext) {
    return this.housing.contact(id, auth.userId);
  }

  // ── Alertes (§2.4, §6.4) ──────────────────────────────────────────────────

  @Get('me/alerts')
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Mes alertes logement et emploi' })
  async alerts(@Auth() auth: AuthContext) {
    return this.housing.listAlerts(auth.userId);
  }

  @Post('me/alerts')
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Crée une alerte (Premium) — PLAN_REQUIRED sinon' })
  async createAlert(
    @Auth() auth: AuthContext,
    @Body(zodPipe(createAlertSchema)) body: z.infer<typeof createAlertSchema>,
  ) {
    return this.housing.createAlert(auth.userId, body);
  }

  @Patch('me/alerts/:id')
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Modifie ou désactive une alerte' })
  async updateAlert(
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Auth() auth: AuthContext,
    @Body(zodPipe(updateAlertSchema)) body: z.infer<typeof updateAlertSchema>,
  ) {
    return this.housing.updateAlert(id, auth.userId, body);
  }

  @Delete('me/alerts/:id')
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Supprime une alerte' })
  async deleteAlert(@Param('id', zodPipe(uuidSchema)) id: string, @Auth() auth: AuthContext) {
    return this.housing.deleteAlert(id, auth.userId);
  }
}
