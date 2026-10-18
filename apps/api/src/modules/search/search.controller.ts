import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  SEARCH_RATE_LIMITS,
  searchQuerySchema,
  searchZeroSchema,
  suggestQuerySchema,
  zeroResultsQuerySchema,
} from '@app/shared';
import type { z } from 'zod';
import { Auth, type AuthContext } from '../../common/auth.guard';
import { RateLimit, RequiresCapability } from '../../common/capability.decorator';
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
 * L'ORDRE des routes compte : `zero-results`, `suggest` et `zero` sont déclarées
 * après `GET /` mais leurs chemins sont distincts, donc aucun risque de capture — contrairement à un
 * `:id` qu'il faudrait placer en dernier. Il n'y en a pas ici : la recherche n'a pas
 * de ressource adressable.
 *
 * MANQUE VOLONTAIREMENT : `/v1/admin/search/reindex` (§3). Aucune garde de RÔLE
 * n'existe encore dans l'application — `AuthGuard` ne connaît que les capacités de
 * membre — et exposer une réindexation complète derrière `content.read` donnerait à
 * n'importe quel membre L0 de quoi saturer la base. `reindexType` existe sur le
 * service et attend le module 15.
 *
 * ⚠ CE PARAGRAPHE METTAIT `zeroResults` DANS LE MÊME SAC, et c'était l'erreur :
 * les deux méthodes n'ont pas le même risque. `GET search/zero-results` ci-dessous
 * l'expose donc en lecture MEMBRE, et le pourquoi au long est sur
 * `searchZeroResultRowSchema` (`@app/shared`), avec l'avertissement de
 * confidentialité qui va avec.
 /**
 * MANQUENT VOLONTAIREMENT : `/v1/admin/search/reindex` et
 * `/v1/admin/search/zero-results` (§3). Aucune garde de RÔLE n'existe encore dans
 * l'application — `AuthGuard` ne connaît que les capacités de membre. Exposer une
 * réindexation complète derrière `content.read` donnerait à n'importe quel membre L0
 * de quoi saturer la base. Les deux méthodes existent sur le service
 * (`reindexType`, `zeroResults`) et attendent le module 15. Voir le rapport.
 *
 * ⚠ CE QU'IL FAUT SAVOIR AVANT D'EXPOSER `zeroResults` À UN MEMBRE. Le panneau
 * « guides manquants » de A03 n'est PAS branché sur cette méthode : il affiche
 * quatre lignes dessinées (`screens/a03/data.ts`), et aucune route ne lui donne de
 * vraies requêtes — vérifié en cherchant « zero-results » dans tout le dépôt, où
 * seuls ce commentaire et celui du service en parlent. Le jour où une route
 * s'ouvrira, `zeroResults` ne rend déjà plus que les requêtes cherchées par au moins
 * `SEARCH_ZERO_MIN_DISTINCT_SEEKERS` PERSONNES DISTINCTES : c'est l'arbitrage du
 * porteur, et c'est ce qui rend ces requêtes montrables, `normalizeQuery` laissant
 * passer lettres et chiffres — donc les noms et les numéros de téléphone.
 */
@ApiTags('search')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @RequiresCapability('content.read')
  @RateLimit(SEARCH_RATE_LIMITS.search)
  @ApiOperation({ summary: 'Résultats groupés par type, ou paginés pour un type (§2.3)' })
  async search(
    @Auth() auth: AuthContext,
    @Query(zodPipe(searchQuerySchema)) query: z.infer<typeof searchQuerySchema>,
  ) {
    return this.searchService.search(auth.userId, query);
  }

  /**
   * `GET /search/zero-results` — le panneau « GUIDES MANQUANTS » d'A03.
   *
   * EN LECTURE, ET SANS AUCUN IDENTIFIANT DE MEMBRE : §2.4 interdit au modèle d'en
   * porter un, donc l'agrégat n'en a pas à rendre. Le jeton sert au contrôle
   * d'accès (`content.read`, N0), jamais à filtrer la liste.
   *
   * ⚠ LA REQUÊTE NORMALISÉE EST DU TEXTE DE MEMBRE. `normalizeQuery` garde les
   * lettres et les chiffres : un nom propre ou un numéro tapé dans la barre de
   * recherche survit à la normalisation. L'arbitrage est celui du porteur, et il
   * est écrit au long sur `searchZeroResultRowSchema`.
   *
   * ⚠ `cityId` RESTE FACULTATIF, ET L'ÉCRAN NE LE PASSE PAS. `zeroResults` filtre
   * sur l'ÉGALITÉ de `cityId` ; or `recordZeroResult` y écrit la ville DE LA
   * RECHERCHE (le filtre choisi par le chercheur), `null` quand il n'en a choisi
   * aucune. Passer une ville exclurait donc toutes les lignes sans ville, c'est-à-dire
   * la majorité. Le paramètre existe pour l'outil qui en voudra un ; le panneau, lui,
   * demande la liste entière.
   */
  @Get('zero-results')
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Top des recherches restées sans résultat (§2.4)' })
  async zeroResults(
    @Query(zodPipe(zeroResultsQuerySchema)) query: z.infer<typeof zeroResultsQuerySchema>,
  ) {
    return this.searchService.zeroResults(query);
  }

  @Get('suggest')
  @RequiresCapability('content.read')
  @RateLimit(SEARCH_RATE_LIMITS.suggest)
  @ApiOperation({ summary: 'Suggestions de titres par préfixe, 6 max (§2.3)' })
  async suggest(@Query(zodPipe(suggestQuerySchema)) query: z.infer<typeof suggestQuerySchema>) {
    return this.searchService.suggest(query.q);
  }

  /**
   * `POST /search/zero` — « appelé par le client après affichage » (§3).
   *
   * LE CORPS NE PORTE AUCUN IDENTIFIANT DE MEMBRE, et c'est la règle dure du §2.4 :
   * `searchZeroSchema` n'en a pas de champ, donc un client ne peut ni en déclarer un
   * ni se faire passer pour un autre chercheur.
   *
   * CE QUI A CHANGÉ, ET CE QUE CE COMMENTAIRE DISAIT. Il affirmait que « le service
   * n'en reçoit pas ». Ce n'est plus vrai : le service reçoit `auth.userId`, et
   * l'arbitrage du porteur l'exige — le panneau des « guides manquants » n'affiche
   * qu'une requête cherchée par plusieurs PERSONNES DISTINCTES, et compter des
   * personnes sans en connaître aucune est impossible.
   *
   * CE QUI N'A PAS CHANGÉ, en revanche : rien de cette identité n'est écrit.
   * `recordZeroResult` n'en garde qu'un HMAC salé par la requête elle-même, dans une
   * table distincte, et `search_zero_results` reste sans la moindre colonne de
   * membre. Le jeton sert donc à DEUX choses désormais — le contrôle d'accès et le
   * pseudonyme — et à rien d'autre ; le détail est écrit sur le service.
   */
  @Post('zero')
  @HttpCode(200)
  @RequiresCapability('content.read')
  @RateLimit(SEARCH_RATE_LIMITS.zero)
  @ApiOperation({ summary: 'Signaler une recherche sans résultat, anonymement (§2.4)' })
  async zero(
    @Auth() auth: AuthContext,
    @Body(zodPipe(searchZeroSchema)) body: z.infer<typeof searchZeroSchema>,
  ) {
    return this.searchService.recordZeroResult(auth.userId, body);
  }
}
