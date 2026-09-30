import { Body, Controller, Delete, Get, HttpCode, Param, Post, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { otpRequestSchema, otpVerifySchema, uuidSchema } from '@app/shared';
import { z } from 'zod';
import { Auth, type AuthContext } from '../../common/auth.guard';
import { PublicRead, RateLimit, RequiresCapability } from '../../common/capability.decorator';
import { ApiError } from '../../common/api-error';
import { REFRESH_COOKIE, clearRefreshCookie, setRefreshCookie } from '../../common/refresh-cookie';
import { zodPipe } from '../../common/zod.pipe';
import { UsersService } from '../users/users.service';
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
 *
 * Le jeton de rafraîchissement ne figure JAMAIS dans une réponse JSON : il part
 * en cookie `httpOnly` (§4.1 « Corps : cookie »). Voir `refresh-cookie.ts`.
 */

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
  ) {}

  @Post('otp/request')
  @HttpCode(200)
  @PublicRead()
  // 01 §2 : « 10 par IP et par HEURE », au-dessus des 3 par heure et par numéro
  // que le service applique — celle-ci arrête le balayage de numéros, celle-là le
  // harcèlement d'un numéro précis.
  //
  // Elle disait `@RateLimit(10)` sans période, donc 10 par MINUTE : soixante fois
  // la règle, alors que chaque appel coûte un SMS. L'écart ne se voyait pas tant
  // que le décorateur ne limitait rien.
  //
  // `'ip'` est DÉCLARÉ, alors que le comportement était déjà le bon : une demande
  // de code n'a pas de jeton, donc `identityOf` tombait sur l'IP de toute façon.
  // Il y tombait PAR ACCIDENT. La spec écrit « par IP » ; le code le dit
  // maintenant aussi, et un jeton présenté avec la requête — un membre déjà
  // connecté qui demande un code pour un second numéro — ne lui ouvre plus un
  // budget à lui.
  @RateLimit(10, 'hour', 'ip')
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
  @ApiOperation({ summary: 'Vérifie le code, ouvre une session et pose le cookie' })
  async verifyOtp(
    @Body(zodPipe(otpVerifySchema)) body: z.infer<typeof otpVerifySchema>,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const ua = request.headers['user-agent'];
    const result = await this.auth.verifyOtp({
      challengeId: body.challengeId,
      code: body.code,
      ip: clientIp(request),
      userAgent: typeof ua === 'string' ? ua : undefined,
    });

    setRefreshCookie(response, result.refreshToken);

    // §4.1 demande `user` dans la réponse : sans lui, le front devrait enchaîner
    // sur `GET /me` avant de savoir s'il doit afficher l'onboarding ou l'accueil,
    // et ce deuxième aller-retour se verrait à l'écran.
    const me = await this.users.me(result.userId);

    return { accessToken: result.accessToken, isNewUser: result.isNewUser, ...me };
  }

  @Post('refresh')
  @HttpCode(200)
  @PublicRead()
  @RateLimit(30)
  @ApiOperation({ summary: 'Échange le cookie de rafraîchissement contre un jeton d’accès' })
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const token = readRefreshCookie(request);
    if (token === null) throw ApiError.transverse('UNAUTHENTICATED');

    const result = await this.auth.refresh(token, clientIp(request));
    setRefreshCookie(response, result.refreshToken);

    return { accessToken: result.accessToken };
  }

  @Post('logout')
  @HttpCode(204)
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Révoque la session courante' })
  async logout(
    @Auth() auth: AuthContext,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.auth.logout(auth.sessionId);
    // Le cookie part aussi : le laisser en place ferait échouer le prochain
    // rafraîchissement sur un jeton révoqué, ce que la détection de rejeu
    // interpréterait comme une session déjà coupée. Exact, mais inutilement
    // alarmant dans les journaux.
    clearRefreshCookie(response);
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
 * Lit le cookie de rafraîchissement.
 *
 * `request.cookies` est typé `any` par les types de `cookie-parser` : on le
 * reprend en `unknown` et on le rétrécit soi-même, plutôt que de propager un
 * `any` sur le chemin de l'authentification, où c'est le dernier endroit
 * souhaitable.
 */
function readRefreshCookie(request: Request): string | null {
  const jar: unknown = request.cookies;
  if (typeof jar !== 'object' || jar === null) return null;
  const raw = (jar as Record<string, unknown>)[REFRESH_COOKIE];
  return typeof raw === 'string' && raw.length > 0 ? raw : null;
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
