import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { placementQuerySchema, uuidSchema } from '@app/shared';
import { z } from 'zod';
import { Auth, MaybeAuth, type AuthContext } from '../../common/auth.guard';
import { PublicRead, RequiresCapability } from '../../common/capability.decorator';
import { zodPipe } from '../../common/zod.pipe';
import { PartnersService } from './partners.service';

/**
 * Le corps du clic : l'étape d'où il part, facultative.
 *
 * `.strict()` comme partout : un client qui enverrait `userId` ou `handle` en
 * espérant les voir dans l'URL d'affiliation est refusé en 400. C'est la même
 * barrière que pour les données de carte, au même endroit — à l'entrée.
 */
const clickBodySchema = z.object({ journeyStepId: uuidSchema.optional() }).strict();

/**
 * Encarts partenaires côté membre — 14-monetisation.md §5.
 *
 * DEUX ROUTES, ET IL N'EN EXISTERA PAS UNE TROISIÈME sans changer la règle dure
 * du §2 : « aucun encart partenaire dans le fil, l'entraide, les guides, les
 * réseaux, la messagerie ». La seule façon de demander un encart est de nommer une
 * ÉTAPE ou la section LOGEMENT — `placementQuerySchema` n'accepte rien d'autre, et
 * `PLACEMENT_SECTIONS` ne contient qu'une entrée.
 *
 * Aucun autre contrôleur n'appelle `PartnersService` : c'est ce qu'un test
 * statique vérifie, parce qu'une règle tenue par une absence ne lève jamais toute
 * seule.
 */
@ApiTags('placements')
@Controller('placements')
export class PartnersController {
  constructor(private readonly partners: PartnersService) {}

  /**
   * `GET /placements?stepDefinitionId=…` ou `?section=HOUSING`.
   *
   * Lecture OUVERTE, mais PERSONNALISÉE quand un jeton est présent : c'est ce qui
   * permet de résoudre le placement selon le pays d'origine et la destination du
   * membre, et de le MASQUER pour un membre Premium (§5.2). Un visiteur anonyme
   * voit l'encart générique — il n'a pas de plan, donc rien à masquer.
   */
  @Get()
  @PublicRead()
  @ApiOperation({ summary: 'L’encart partenaire résolu pour cette étape, ou rien' })
  async resolve(
    @Query(zodPipe(placementQuerySchema)) query: z.infer<typeof placementQuerySchema>,
    @MaybeAuth() auth: AuthContext | null,
  ) {
    return this.partners.resolve(query, auth?.userId ?? null);
  }

  /**
   * `POST /placements/:id/click` → l'URL d'affiliation (§5.3).
   *
   * RÈGLE DURE : l'URL ne contient QUE `click_id`. Elle est construite par
   * `buildAffiliateUrl`, qui LÈVE si l'identifiant du membre, son handle ou
   * l'identifiant de son étape s'y trouvent.
   *
   * Écriture, donc capacité déclarée — `content.read`, la plus basse : cliquer sur
   * un encart qu'on a le droit de voir ne demande pas de vérification d'identité.
   * Le clic est nominatif EN BASE (§5.3 : « placement, membre, étape,
   * horodatage »), ce qui exige un membre connecté.
   */
  @Post(':id/click')
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Enregistre le clic et rend l’URL d’affiliation (click_id seul)' })
  async click(
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Auth() auth: AuthContext,
    @Body(zodPipe(clickBodySchema)) body: z.infer<typeof clickBodySchema>,
  ) {
    return this.partners.click(id, auth.userId, body.journeyStepId);
  }
}

