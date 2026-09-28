import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  handleSchema,
  onboardingAdvanceSchema,
  updateMeSchema,
  updateProfileSchema,
} from '@app/shared';
import { z } from 'zod';
import { Auth, type AuthContext, MaybeAuth } from '../../common/auth.guard';
import { PublicRead, RateLimit, RequiresCapability } from '../../common/capability.decorator';
import { zodPipe } from '../../common/zod.pipe';
import { UsersService } from './users.service';

/**
 * Compte et membres — 01-identite.md §4.2 et §4.4.
 *
 * `GET /me` est déclarée `@RequiresCapability('content.read')` et non
 * `@PublicRead()` : elle n'a aucun sens sans jeton, et la déclarer publique
 * rendrait l'absence de membre courant un cas à traiter partout en aval.
 */

const arrivedSchema = z.object({ arrivalDate: z.string().date() });

@ApiTags('me')
@Controller()
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Le compte complet du membre courant' })
  async me(@Auth() auth: AuthContext) {
    return this.users.me(auth.userId);
  }

  @Patch('me')
  @RequiresCapability('content.read')
  // §4.4 : « `PATCH /me` 20/h ». Un formulaire de profil qui enregistre à chaque
  // frappe atteindrait cette limite en quelques secondes — c'est voulu, il ne doit
  // pas. La période était ABSENTE, donc lue comme la minute : le commentaire citait
  // l'heure et le code appliquait soixante fois plus.
  @RateLimit(20, 'hour')
  @ApiOperation({ summary: 'Modifie le compte (pseudo, phase, ville, dates)' })
  async updateMe(
    @Auth() auth: AuthContext,
    @Body(zodPipe(updateMeSchema)) body: z.infer<typeof updateMeSchema>,
  ) {
    return this.users.updateMe(auth.userId, body);
  }

  @Patch('me/profile')
  @RequiresCapability('content.read')
  // §4.4 ne chiffre que `PATCH /me`. La même période est appliquée ici : c'est la
  // même surface d'édition de profil, coupée en deux routes pour des raisons de
  // schéma, et laisser la seconde soixante fois plus ouverte viderait la première
  // de son sens. Hypothèse, et non lecture littérale de la spec.
  @RateLimit(20, 'hour')
  @ApiOperation({ summary: 'Modifie le profil (bio, statut, langues, compétences)' })
  async updateProfile(
    @Auth() auth: AuthContext,
    @Body(zodPipe(updateProfileSchema)) body: z.infer<typeof updateProfileSchema>,
  ) {
    return this.users.updateProfile(auth.userId, body);
  }

  @Post('me/arrived')
  @RequiresCapability('content.read')
  @ApiOperation({ summary: '« Je suis arrivé » — passe en RECENT_ARRIVAL' })
  async arrived(
    @Auth() auth: AuthContext,
    @Body(zodPipe(arrivedSchema)) body: z.infer<typeof arrivedSchema>,
  ) {
    return this.users.declareArrival(auth.userId, body.arrivalDate);
  }

  @Post('me/onboarding')
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Enregistre l’écran d’onboarding franchi (§5)' })
  async advanceOnboarding(
    @Auth() auth: AuthContext,
    @Body(zodPipe(onboardingAdvanceSchema)) body: z.infer<typeof onboardingAdvanceSchema>,
  ) {
    return this.users.advanceOnboarding(auth.userId, body.step);
  }

  /**
   * Profil public (§4.4). `@PublicRead()` parce que §2.7 prévoit `is_public` :
   * un profil marqué public est lisible hors connexion. Le service applique la
   * visibilité — jeton ou pas, un membre bloqué ne voit rien.
   */
  @Get('users/:handle')
  @PublicRead()
  @ApiOperation({ summary: 'Profil public d’un membre' })
  async publicProfile(
    @Param('handle', zodPipe(handleSchema)) handle: string,
    @MaybeAuth() viewer: AuthContext | null,
  ) {
    return this.users.publicProfile(handle, viewer?.userId ?? null);
  }
}
