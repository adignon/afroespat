import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  cityMapQuerySchema,
  cityTipsQuerySchema,
  createCityTipSchema,
  membersQuerySchema,
  slugSchema,
  updateCityTipSchema,
  uuidSchema,
} from '@app/shared';
import type { z } from 'zod';
import { Auth, type AuthContext, MaybeAuth } from '../../common/auth.guard';
import { PublicRead, RateLimit, RequiresCapability } from '../../common/capability.decorator';
import { zodPipe } from '../../common/zod.pipe';
import { CitiesService } from './cities.service';

/**
 * Villes et membres — 09-villes-agenda.md §5.
 *
 * Lectures publiques : la carte, la fiche ville et l'annuaire sont ce qu'un
 * visiteur voit avant de s'inscrire. Le service applique les règles quoi qu'il
 * arrive — seuil de 3 sur tout compteur filtré par pays, profils non publics
 * écartés hors connexion, membres bloqués invisibles dans les deux sens.
 *
 * `/tips/:id/vote` du §5 n'est PAS ici : la table `city_tip_votes` que §4 déclare
 * « ajoutée » n'existe pas dans le schéma figé. Sans elle, l'unicité « un vote par
 * membre » n'a aucun support, et une route qui incrémenterait `helpful_count` sans
 * mémoire laisserait un membre voter cent fois — le tri « par utilité » du §2.3
 * deviendrait un tri par acharnement. Signalé plutôt que contourné.
 */
@ApiTags('cities')
@Controller()
export class CitiesController {
  constructor(private readonly cities: CitiesService) {}

  // ── Carte et annuaire ─────────────────────────────────────────────────────

  @Get('cities/map')
  @PublicRead()
  @ApiOperation({ summary: 'Villes actives et compteurs (seuil de 3 par filtre pays)' })
  async map(@Query(zodPipe(cityMapQuerySchema)) query: z.infer<typeof cityMapQuerySchema>) {
    return this.cities.map(query.countryId);
  }

  @Get('members')
  @PublicRead()
  @ApiOperation({ summary: 'Annuaire filtrable : disponibles pour aider d’abord' })
  async members(
    @Query(zodPipe(membersQuerySchema)) query: z.infer<typeof membersQuerySchema>,
    @MaybeAuth() viewer: AuthContext | null,
  ) {
    return this.cities.members(query, viewer?.userId ?? null);
  }

  // ── Fiche ville ───────────────────────────────────────────────────────────

  /**
   * Déclarée avant `cities/:slug` : sans cela, « map » serait capté par le
   * paramètre et la carte répondrait 404 sur une ville nommée « map ».
   */
  @Get('cities/:slug/desks')
  @PublicRead()
  @ApiOperation({ summary: 'Guichets du jour : par lieu, la dernière information' })
  async desks(
    @Param('slug', zodPipe(slugSchema)) slug: string,
    @MaybeAuth() viewer: AuthContext | null,
  ) {
    return this.cities.desks(slug, viewer?.userId ?? null);
  }

  @Get('cities/:slug/tips')
  @PublicRead()
  @ApiOperation({ summary: 'Contenus communautaires d’une ville, par kind' })
  async tips(
    @Param('slug', zodPipe(slugSchema)) slug: string,
    @Query(zodPipe(cityTipsQuerySchema)) query: z.infer<typeof cityTipsQuerySchema>,
    @MaybeAuth() viewer: AuthContext | null,
  ) {
    return this.cities.listTips(slug, query, viewer?.userId ?? null);
  }

  @Get('cities/:slug')
  @PublicRead()
  @ApiOperation({ summary: 'Fiche ville : en-tête, réseau, événements, arrivants, tips' })
  async profile(
    @Param('slug', zodPipe(slugSchema)) slug: string,
    @MaybeAuth() viewer: AuthContext | null,
  ) {
    return this.cities.profile(slug, viewer?.userId ?? null);
  }

  // ── Contributions ─────────────────────────────────────────────────────────

  @Post('cities/:slug/tips')
  // §2.3 : « Capacité `post.create` (L1) » — la même que publier dans le fil.
  @RequiresCapability('post.create')
  @RateLimit(20)
  @ApiOperation({ summary: 'Contribue à la fiche ville (bon plan, commerce, budget, témoignage)' })
  async createTip(
    @Param('slug', zodPipe(slugSchema)) slug: string,
    @Auth() auth: AuthContext,
    @Body(zodPipe(createCityTipSchema)) body: z.infer<typeof createCityTipSchema>,
  ) {
    return this.cities.createTip(slug, auth.userId, body);
  }

  @Patch('tips/:id')
  @RequiresCapability('post.create')
  @ApiOperation({ summary: 'Modifie sa contribution (auteur)' })
  async updateTip(
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Auth() auth: AuthContext,
    @Body(zodPipe(updateCityTipSchema)) body: z.infer<typeof updateCityTipSchema>,
  ) {
    return this.cities.updateTip(id, auth.userId, body);
  }

  @Delete('tips/:id')
  @RequiresCapability('post.create')
  @ApiOperation({ summary: 'Retire sa contribution (auteur, suppression logique)' })
  async deleteTip(@Param('id', zodPipe(uuidSchema)) id: string, @Auth() auth: AuthContext) {
    return this.cities.deleteTip(id, auth.userId);
  }
}
