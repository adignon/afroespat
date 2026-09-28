import { Body, Controller, Delete, HttpCode, Ip, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { addPhoneStartSchema, otpConfirmSchema, uuidSchema } from '@app/shared';
import { z } from 'zod';
import { Auth, type AuthContext } from '../../common/auth.guard';
import { AllowSuspended, RateLimit, RequiresCapability } from '../../common/capability.decorator';
import { zodPipe } from '../../common/zod.pipe';
import { AccountService } from './account.service';
import { PhonesService } from './phones.service';

/**
 * Compte : numéros, désactivation, suppression — 01-identite.md §4.2.
 *
 * Un contrôleur SÉPARÉ de `UsersController`, qui porte déjà `/me` et le profil.
 * Ces routes-ci changent l'ÉTAT DU COMPTE — elles révoquent des sessions,
 * suspendent l'accès, engagent une suppression — alors que les autres modifient des
 * champs. Les mélanger rendrait plus difficile de vérifier que chacune de
 * celles-ci, et seulement celles-ci, révoque bien ce qu'elle doit révoquer.
 *
 * Toutes déclarent `content.read` (L0), comme le reste de `/me` : un membre doit
 * pouvoir quitter la plateforme depuis n'importe quel niveau. La seule qui exige
 * davantage est l'ajout d'un numéro de destination, et c'est le SERVICE qui le
 * refuse (§2.5, L1 requis) — la capacité d'une route ne sait pas dire « L1 pour
 * cette action précise ».
 */
@ApiTags('me')
@Controller()
export class AccountController {
  constructor(
    private readonly account: AccountService,
    private readonly phones: PhonesService,
  ) {}

  // ── Numéros (§2.5) ────────────────────────────────────────────────────────

  @Post('me/phones')
  @RequiresCapability('content.read')
  // Le même plafond que `otp/request` côté esprit : un SMS coûte, et cette route
  // en déclenche un. La limite par NUMÉRO et par heure (3, §2.1) s'applique en plus,
  // dans `AuthService`.
  @RateLimit(3)
  @ApiOperation({ summary: 'Démarre l’ajout d’un numéro de destination (OTP)' })
  async startAddPhone(
    @Auth() auth: AuthContext,
    @Body(zodPipe(addPhoneStartSchema)) body: z.infer<typeof addPhoneStartSchema>,
    @Ip() ip: string,
  ) {
    return this.phones.start(auth.userId, body, ip);
  }

  @Post('me/phones/verify')
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Confirme le numéro ajouté — fait passer L1 → L2' })
  async verifyAddPhone(
    @Auth() auth: AuthContext,
    @Body(zodPipe(otpConfirmSchema)) body: z.infer<typeof otpConfirmSchema>,
  ) {
    return this.phones.verify(auth.userId, body);
  }

  @Delete('me/phones/:id')
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Retire un numéro — refusé si c’est le dernier' })
  async removePhone(
    @Auth() auth: AuthContext,
    @Param('id', zodPipe(uuidSchema)) id: string,
  ) {
    return this.phones.remove(auth.userId, id);
  }

  // ── Désactivation et suppression (§2.8) ───────────────────────────────────

  @Post('me/deactivate')
  @RequiresCapability('content.read')
  @HttpCode(200)
  @ApiOperation({ summary: 'Désactive le compte — réversible par connexion OTP' })
  async deactivate(@Auth() auth: AuthContext) {
    return this.account.deactivate(auth.userId);
  }

  /**
   * `@AllowSuspended()` — un compte SUSPENDU doit pouvoir partir.
   *
   * §7.3 retire toute écriture à un compte suspendu, et c'est juste pour publier.
   * Mais quitter la plateforme n'est pas une publication : c'est le droit à
   * l'effacement (§8, RGPD art. 17), qu'une sanction de modération ne suspend pas.
   * Sans cette exemption, un membre suspendu recevait `403 ACCOUNT_SUSPENDED` sur la
   * seule route qui lui permet de s'en aller — donc une plateforme qui garde ses
   * données contre sa volonté, ce qui n'est pas une sanction mais une rétention.
   *
   * Le piège était le même que pour la contestation, et aussi invisible : la
   * suspension révoque les sessions, le membre se reconnecte, et c'est son jeton NEUF
   * qui porte `SUSPENDED` — le refus n'apparaissait donc qu'au second tour.
   *
   * L'exemption s'arrête là. `POST /me/deactivate` ne l'a PAS : se désactiver
   * n'efface rien, et laisser un compte sanctionné se soustraire à l'affichage
   * « Membre suspendu » serait un moyen de contourner la sanction.
   */
  @Post('me/deletion')
  @RequiresCapability('content.read')
  @AllowSuspended()
  @ApiOperation({
    summary: 'Demande la suppression du compte (OTP purpose=DELETE_ACCOUNT, 7 jours)',
  })
  async requestDeletion(
    @Auth() auth: AuthContext,
    @Body(zodPipe(otpConfirmSchema)) body: z.infer<typeof otpConfirmSchema>,
  ) {
    return this.account.requestDeletion(auth.userId, body);
  }

  /**
   * PAS de `DELETE /me/deletion`, ni de `GET /me/deletion` — ÉCART ASSUMÉ AVEC §4.2,
   * imposé par une contradiction DANS la spec.
   *
   * §4.2 liste « POST /me/deletion · DELETE /me/deletion — Demander / annuler ».
   * §2.8 dit, de la même demande : « sessions révoquées IMMÉDIATEMENT », et
   * « pendant 7 jours, une connexion OTP annule la demande ».
   *
   * Les deux ne peuvent pas être vraies ensemble. La demande révoque toutes les
   * sessions du membre, et le garde refuse désormais un jeton d'accès dont la session
   * est révoquée (voir `AuthGuard.assertTokenFresh`) : après la demande, le membre n'a
   * plus AUCUN moyen d'atteindre une route `/me`. Et s'il se reconnecte par OTP, cette
   * connexion a déjà annulé la demande — il n'y a donc plus rien à annuler.
   *
   * ARBITRAGE : la révocation immédiate l'emporte, parce que c'est la propriété de
   * sécurité (un appareil volé ne doit pas garder l'accès d'un compte en cours de
   * suppression) et parce que §2.8 est la section qui décrit le comportement, là où le
   * tableau du §4.2 en est le résumé. Le chemin d'annulation livré est donc celui que
   * §2.8 nomme : la connexion OTP, implémentée dans `AuthService.resumeAccount`.
   *
   * Livrer ces deux routes quand même aurait été pire qu'un manque : elles ne
   * pourraient répondre que `401` ou `409`, et le front croirait tenir un bouton
   * « Annuler » qui ne marche jamais. `AccountService` ne porte donc pas non plus de
   * méthode d'annulation : une méthode que rien n'appelle ferait croire la chaîne
   * branchée, tout comme un gestionnaire de tâche vide.
   */
}
