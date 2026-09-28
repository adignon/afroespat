import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { searchQuerySchema, searchZeroSchema, suggestQuerySchema } from '@app/shared';
import type { z } from 'zod';
import { Auth, type AuthContext } from '../../common/auth.guard';
import { RequiresCapability } from '../../common/capability.decorator';
import { zodPipe } from '../../common/zod.pipe';
import { SearchService } from './search.service';

/**
 * Recherche — 11-recherche.md §3.
 *
 * AUCUNE route n'est `@PublicRead()`, et c'est la règle dure du §2.1 qui l'impose :
 * « une requête ne renvoie jamais un document COMMUNITY d'un réseau dont le
 * demandeur n'est pas membre, ni un document dont l'auteur est bloqué dans un sens
 * ou l'autre ». Sans demandeur identifié, ni l'adhésion ni le blocage ne peuvent
 * être évalués — une recherche anonyme ne pourrait qu'ignorer la règle ou ne rien
 * rendre. `content.read` est de niveau L0, donc ouverte dès l'inscription.
 *
 * L'ORDRE des routes compte : `suggest` et `zero` sont déclarées après `GET /` mais
 * leurs chemins sont distincts, donc aucun risque de capture — contrairement à un
 * `:id` qu'il faudrait placer en dernier. Il n'y en a pas ici : la recherche n'a pas
 * de ressource adressable.
 *
 * MANQUENT VOLONTAIREMENT : `/v1/admin/search/reindex` et
 * `/v1/admin/search/zero-results` (§3). Aucune garde de RÔLE n'existe encore dans
 * l'application — `AuthGuard` ne connaît que les capacités de membre. Exposer une
 * réindexation complète derrière `content.read` donnerait à n'importe quel membre L0
 * de quoi saturer la base. Les deux méthodes existent sur le service
 * (`reindexType`, `zeroResults`) et attendent le module 15. Voir le rapport.
 */
@ApiTags('search')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Résultats groupés par type, ou paginés pour un type (§2.3)' })
  async search(
    @Auth() auth: AuthContext,
    @Query(zodPipe(searchQuerySchema)) query: z.infer<typeof searchQuerySchema>,
  ) {
    return this.searchService.search(auth.userId, query);
  }

  @Get('suggest')
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Suggestions de titres par préfixe, 6 max (§2.3)' })
  async suggest(@Query(zodPipe(suggestQuerySchema)) query: z.infer<typeof suggestQuerySchema>) {
    return this.searchService.suggest(query.q);
  }

  /**
   * `POST /search/zero` — « appelé par le client après affichage » (§3).
   *
   * Le corps ne porte AUCUN identifiant de membre, et le service n'en reçoit pas :
   * c'est la règle dure du §2.4. La route exige pourtant un jeton — toute écriture
   * déclare une capacité (§7.3) — mais ce jeton sert au contrôle d'accès, jamais à
   * la ligne écrite.
   */
  @Post('zero')
  @HttpCode(200)
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Signaler une recherche sans résultat, anonymement (§2.4)' })
  async zero(@Body(zodPipe(searchZeroSchema)) body: z.infer<typeof searchZeroSchema>) {
    return this.searchService.recordZeroResult(body);
  }
}
