import { Body, Controller, Delete, Get, HttpCode, Param, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { otpRequestSchema, otpVerifySchema, uuidSchema } from '@app/shared';
import { z } from 'zod';
import { Auth, type AuthContext } from '../../common/auth.guard';
import { PublicRead, RateLimit, RequiresCapability } from '../../common/capability.decorator';
import { zodPipe } from '../../common/zod.pipe';
import { AuthService } from './auth.service';

/**
 * Routes d'authentification — 01-identite.md §4.1.
 *
 * Les quatre premières sont `@PublicRead()` : on ne peut pas demander d'être
 * connecté pour se connecter. Ce n'est pas un trou dans le modèle de capacités,
 * c'est sa condition d'entrée — et le décorateur le dit explicitement, plutôt
 * que de laisser l'absence de déclaration parler à sa place.
 *
 * Elles portent en revanche des limites de débit resserrées : ce sont les seules
 * routes qu'un inconnu peut appeler, donc les seules qu'il peut marteler.
 */

const refreshSchema = z.object({ refreshToken: z.string().min(16) });

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('otp/request')
  @HttpCode(200)
  @PublicRead()
  // 10 par minute et par IP, au-dessus des 3 par heure et par numéro que le
  // service applique : celle-ci arrête le balayage de numéros, celle-là le
  // harcèlement d'un numéro précis.
  @RateLimit(10)
  @ApiOperation({ summary: 'Envoie un code à 6 chiffres par SMS' })
  async requestOtp(
    @Body(zodPipe(otpRequestSchema)) body: z.infer<typeof otpRequestSchema>,
    @Req() request: Request,
  ) {
    const result = await this.auth.requestOtp({
      phone: body.phone,
      countryIso2: body.countryIso2,
      captchaToken: body.captchaToken,
      purpose: body.purpose,
      ip: clientIp(request),
    });
    return { challengeId: result.challengeId, expiresAt: result.expiresAt.toISOString() };
  }

  @Post('otp/verify')
  @HttpCode(200)
  @PublicRead()
  @RateLimit(10)
  @ApiOperation({ summary: 'Vérifie le code et ouvre une session' })
  async verifyOtp(
    @Body(zodPipe(otpVerifySchema)) body: z.infer<typeof otpVerifySchema>,
    @Req() request: Request,
  ) {
    const ua = request.headers['user-agent'];
    const result = await this.auth.verifyOtp({
      challengeId: body.challengeId,
      code: body.code,
      ip: clientIp(request),
      userAgent: typeof ua === 'string' ? ua : undefined,
    });

    // `userId` n'est PAS renvoyé : il est déjà dans le jeton, et l'exposer ici
    // en ferait un identifiant que le front serait tenté d'employer ailleurs.
    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      isNewUser: result.isNewUser,
    };
  }

  @Post('refresh')
  @HttpCode(200)
  @PublicRead()
  @RateLimit(30)
  @ApiOperation({ summary: 'Échange un jeton de rafraîchissement contre un nouveau couple' })
  async refresh(
    @Body(zodPipe(refreshSchema)) body: z.infer<typeof refreshSchema>,
    @Req() request: Request,
  ) {
    return this.auth.refresh(body.refreshToken, clientIp(request));
  }

  @Post('logout')
  @HttpCode(204)
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Révoque la session courante' })
  async logout(@Auth() auth: AuthContext): Promise<void> {
    await this.auth.logout(auth.sessionId);
  }

  @Get('sessions')
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Les appareils connectés' })
  async sessions(@Auth() auth: AuthContext) {
    return { sessions: await this.auth.listSessions(auth.userId, auth.sessionId) };
  }

  @Delete('sessions/:id')
  @HttpCode(204)
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Déconnecte un appareil' })
  async revokeSession(
    @Auth() auth: AuthContext,
    @Param('id', zodPipe(uuidSchema)) id: string,
  ): Promise<void> {
    await this.auth.revokeSession(auth.userId, id);
  }

  @Delete('sessions')
  @HttpCode(204)
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Déconnecte tous les autres appareils' })
  async revokeOthers(@Auth() auth: AuthContext): Promise<void> {
    await this.auth.revokeOtherSessions(auth.userId, auth.sessionId);
  }
}

/**
 * L'IP du client. Elle sert aux limites de débit et à rien d'autre : elle n'est
 * jamais renvoyée dans une réponse (§8.1 ne collecte aucune position plus fine
 * que la ville, et une IP en est une approximation).
 */
function clientIp(request: Request): string | undefined {
  const forwarded = request.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    // Le premier de la liste est le client ; les suivants sont les relais.
    return forwarded.split(',')[0]?.trim();
  }
  return request.ip;
}
