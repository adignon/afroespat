import { Body, Controller, Post, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import {
  STAFF_SCOPES,
  staffLoginSchema,
  staffTotpEnrollSchema,
  staffTotpSchema,
} from '@app/shared';
import type { z } from 'zod';
import { PublicRead, RateLimit } from '../../common/capability.decorator';
import { clearStaffCookie, setStaffCookie } from '../../common/staff-cookie';
import { RequiresStaffRole } from '../../common/staff-role.decorator';
import { Staff, clientIp, type StaffUser } from '../../common/staff.guard';
import { zodPipe } from '../../common/zod.pipe';
import { StaffAuthService } from './staff-auth.service';

/**
 * Connexion de l'équipe — 15-administration.md §7, préfixe `/v1/admin`.
 *
 * ── Pourquoi `@PublicRead()` sur des routes d'administration ────────────────
 *
 * Les quatre premières routes sont AVANT toute session : elles la créent. Elles ne
 * peuvent donc pas porter `@RequiresStaffRole` — il n'y a pas encore de rôle à
 * vérifier — et le garde global refuse par défaut ce qui ne déclare rien (00
 * §7.3). `@PublicRead()` est la déclaration explicite qui manquerait sans quoi.
 *
 * Cela ne les rend PAS accessibles sans authentification, au sens où l'on pourrait
 * y faire quelque chose : chacune exige un mot de passe valide, ou un défi signé,
 * ou les deux plus un code TOTP. Et cela ne crée aucune passerelle entre les deux
 * domaines : ces routes ne lisent aucune identité de membre pour décider quoi que
 * ce soit, et `@PublicRead()` fait que `AuthGuard` ne lit pas de capacité.
 * C'est exactement la situation de `/v1/auth/otp/request` côté membres.
 *
 * CORRECTION D'UNE AFFIRMATION QUI ÉTAIT FAUSSE ICI. Ce commentaire disait que ces
 * routes « ne posent jamais de `request.auth` ». `AuthGuard` le pose pourtant dès
 * qu'un jeton de membre valide accompagne la requête, `@PublicRead()` ou non — il
 * le fait avant de rendre la main, et rien ne l'en empêche. La route n'en fait
 * rien, donc il n'y avait pas de passerelle ; mais la limite de débit, elle, s'en
 * servait. Voir ci-dessous.
 *
 * `logout`, elle, porte `@RequiresStaffRole` avec les quatre rôles : on ne peut se
 * déconnecter que d'une session qui existe, et c'est le garde qui la retrouve.
 *
 * ── Limites de débit ────────────────────────────────────────────────────────
 *
 * Resserrées : cinq par minute sur les routes qui vérifient un secret. §2.1 borne
 * déjà les échecs à cinq en quinze minutes, mais ce verrou est PAR COMPTE — il ne
 * dit rien d'un attaquant qui essaie mille adresses. La limite de débit couvre
 * l'autre moitié.
 *
 * ET ELLE SE COMPTE PAR IP, pas par appelant. C'est le `by: 'ip'` de chaque
 * `@RateLimit` ci-dessous, et il corrige un affaiblissement MESURÉ : puisque
 * `AuthGuard` pose `request.auth` dès qu'un jeton de membre accompagne la requête
 * (voir la correction ci-dessus), `identityOf` préférait ce membre à l'IP et
 * CHAQUE COMPTE MEMBRE APPORTAIT UN BUDGET NEUF. Relevé dans Redis : trois seaux
 * pour la même route, deux par membre et un par IP — soit 15 tentatives par minute
 * depuis une seule adresse avec deux comptes gratuits, au lieu de 5.
 *
 * Le comptage par IP est le bon ici parce que, sur une route de connexion,
 * l'appelant est par nature l'adversaire : lui laisser choisir son seau vide le
 * verrou de son sens.
 *
 * SECONDE AFFIRMATION CORRIGÉE : ce commentaire disait que `@RateLimit` posait
 * « une métadonnée que RIEN n'applique ». C'était vrai à l'écriture et faux depuis
 * que `common/rate-limit.guard.ts` existe — le 429 est mesuré au sixième essai.
 */
@ApiTags('admin-auth')
@Controller('admin/auth')
export class StaffAuthController {
  constructor(private readonly auth: StaffAuthService) {}

  @Post('login')
  @PublicRead()
  @RateLimit(5, 'minute', 'ip')
  @ApiOperation({ summary: 'Premier facteur équipe : email + mot de passe. Rend un défi TOTP.' })
  async login(
    @Req() request: Request,
    @Body(zodPipe(staffLoginSchema)) body: z.infer<typeof staffLoginSchema>,
  ) {
    return this.auth.login(body, clientIp(request));
  }

  /**
   * Second facteur. C'est ici que la session naît, et le cookie avec elle.
   *
   * Le jeton n'est PAS rendu dans le corps : il n'existe que dans un cookie
   * `httpOnly`. Un jeton de session en JSON finit dans un stockage lisible par
   * JavaScript, donc exfiltrable par n'importe quel script injecté — et sur
   * l'application admin, une session volée vaut tous les pouvoirs du rôle.
   */
  @Post('totp')
  @PublicRead()
  @RateLimit(5, 'minute', 'ip')
  @ApiOperation({ summary: 'Second facteur équipe : code TOTP. Ouvre la session (cookie).' })
  async totp(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Body(zodPipe(staffTotpSchema)) body: z.infer<typeof staffTotpSchema>,
  ) {
    const result = await this.auth.totp(body.challenge, body.code, clientIp(request));
    setStaffCookie(response, result.token);
    return { staff: result.staff, expiresAt: result.expiresAt };
  }

  /** §2.1 : enrôlement TOTP forcé à la première connexion. Rend le secret et son URI. */
  @Post('totp/enroll')
  @PublicRead()
  @RateLimit(5, 'minute', 'ip')
  @ApiOperation({ summary: 'Enrôlement TOTP : rend le secret à scanner et un défi de confirmation' })
  async enroll(@Body(zodPipe(staffTotpEnrollSchema)) body: z.infer<typeof staffTotpEnrollSchema>) {
    return this.auth.enroll(body.challenge);
  }

  /** Confirme l'enrôlement par un premier code, puis ouvre la session. */
  @Post('totp/confirm')
  @PublicRead()
  @RateLimit(5, 'minute', 'ip')
  @ApiOperation({ summary: 'Confirme l’enrôlement TOTP et ouvre la session' })
  async confirm(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Body(zodPipe(staffTotpSchema)) body: z.infer<typeof staffTotpSchema>,
  ) {
    const result = await this.auth.confirmEnrollment(body.challenge, body.code, clientIp(request));
    setStaffCookie(response, result.token);
    return { staff: result.staff, expiresAt: result.expiresAt };
  }

  @Post('logout')
  @RequiresStaffRole(...STAFF_SCOPES.memberRead)
  @ApiOperation({ summary: 'Révoque la session d’équipe courante' })
  async logout(@Staff() staff: StaffUser, @Res({ passthrough: true }) response: Response) {
    const result = await this.auth.logout(staff.staffId, staff.sessionId, staff.ip);
    clearStaffCookie(response);
    return result;
  }

  /**
   * Qui suis-je ? La route que l'application admin appelle au chargement.
   *
   * Elle n'est pas dans le tableau du §7, et elle y manque : sans elle, le front
   * équipe ne peut pas savoir quel rôle il sert, donc ne peut pas masquer ce que
   * ce rôle ne peut pas faire (§8). Elle ne rend rien de plus que ce que le garde
   * a déjà validé.
   */
  @Post('session')
  @RequiresStaffRole(...STAFF_SCOPES.memberRead)
  @ApiOperation({ summary: 'La session d’équipe courante : identifiant et rôle' })
  async session(@Staff() staff: StaffUser) {
    // Le nom d'affichage sert au rond d'avatar et au menu de la barre d'équipe.
    return { staffId: staff.staffId, role: staff.role, sessionId: staff.sessionId, displayName: await this.auth.displayNameOf(staff.staffId) };
  }
}
