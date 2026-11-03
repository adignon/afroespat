import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { publicSearchQuerySchema, uuidSchema } from '@app/shared';
import type { z } from 'zod';
import { PublicRead, RateLimit } from '../../common/capability.decorator';
import { zodPipe } from '../../common/zod.pipe';
import { PublicLandingService } from './public-landing.service';

/**
 * La page d'accueil publique : ce qu'un visiteur sans compte peut lire. Trois lectures, toutes ouvertes, toutes
 * bornées par une limite de débit par appelant (ici, l'adresse IP).
 */
@ApiTags('public')
@Controller('public')
export class PublicLandingController {
  constructor(private readonly landing: PublicLandingService) {}

  @Get('landing')
  @PublicRead()
  @RateLimit(60)
  @ApiOperation({ summary: 'Compteurs (sous seuil : nuls), événements ouverts, villes, citations approuvées' })
  getLanding() {
    return this.landing.landing();
  }

  @Get('search')
  @PublicRead()
  @RateLimit(30)
  @ApiOperation({ summary: 'Recherche sans compte : guides publiés, réseaux de ville publics, villes actives' })
  search(@Query(zodPipe(publicSearchQuerySchema)) query: z.infer<typeof publicSearchQuerySchema>) {
    return this.landing.search(query);
  }

  @Get('communities/:id')
  @PublicRead()
  @RateLimit(60)
  @ApiOperation({ summary: 'Fiche « À propos » d’un réseau de ville PUBLIC (les autres : 404)' })
  community(@Param('id', zodPipe(uuidSchema)) id: string) {
    return this.landing.communityAbout(id);
  }
}
