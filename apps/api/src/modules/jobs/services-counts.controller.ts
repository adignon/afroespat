import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  housingQuerySchema,
  jobsQuerySchema,
  type ServicesCountsResponse,
} from '@app/shared';
import { type AuthContext, MaybeAuth } from '../../common/auth.guard';
import { PublicRead } from '../../common/capability.decorator';
import { HousingService } from '../housing/housing.service';
import { JobsService } from './jobs.service';

/** `HousingService.list` déclare `Page<…>` mais rend aussi `meta` (bandeau et total). */
const totalDe = (page: unknown): number => (page as { meta: { total: number } }).meta.total;

/**
 * Les compteurs du panneau de gauche des écrans Services — 10 §7 (lot E2).
 *
 * Une route À PART, parce que ces trois nombres traversent deux modules (logement et
 * emploi) et que dix écrans les affichent : les obtenir par quatre listes complètes
 * aurait coûté quatre requêtes par page vue. Elle ne recompte rien elle-même : elle
 * lit `meta.total` des services de liste (limite 1), donc les MÊMES règles de
 * visibilité — blocages, annonces masquées, offres expirées. Un compteur qui
 * divergerait de sa liste serait un mensonge que personne ne verrait.
 *
 * Lecture publique comme les listes (§2.3) ; `mine` n'existe qu'avec une session.
 */
@ApiTags('services')
@Controller()
export class ServicesCountsController {
  constructor(
    private readonly housing: HousingService,
    private readonly jobs: JobsService,
  ) {}

  @Get('services/counts')
  @PublicRead()
  @ApiOperation({ summary: 'Annonces logement, offres d’emploi et « Mes annonces » — totaux des listes' })
  async counts(@MaybeAuth() viewer: AuthContext | null): Promise<ServicesCountsResponse> {
    const viewerId = viewer?.userId ?? null;
    const [logements, offres] = await Promise.all([
      this.housing.list(housingQuerySchema.parse({ limit: 1 }), viewerId),
      this.jobs.list(jobsQuerySchema.parse({ limit: 1 }), viewerId),
    ]);

    let mine: number | null = null;
    if (viewerId !== null) {
      const [mesLogements, mesOffres] = await Promise.all([
        this.housing.list(housingQuerySchema.parse({ limit: 1, scope: 'mine' }), viewerId),
        this.jobs.list(jobsQuerySchema.parse({ limit: 1, scope: 'mine' }), viewerId),
      ]);
      mine = totalDe(mesLogements) + mesOffres.meta.total;
    }

    return {
      housing: totalDe(logements),
      jobs: offres.meta.total,
      mine,
    };
  }
}
