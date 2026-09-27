import { Body, Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { consentSchema } from '@app/shared';
import type { z } from 'zod';
import { Auth, type AuthContext } from '../../common/auth.guard';
import { RequiresCapability } from '../../common/capability.decorator';
import { PrismaService } from '../../common/prisma.service';
import { zodPipe } from '../../common/zod.pipe';
import { ConsentsService } from './consents.service';

/** Consentements — 01-identite.md §4.2 et §2.10. */
@ApiTags('me')
@Controller('me/consents')
export class ConsentsController {
  constructor(
    private readonly consents: ConsentsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'L’état des consentements, et ce qu’il reste à redemander' })
  async read(@Auth() auth: AuthContext) {
    return {
      items: await this.consents.current(auth.userId),
      outstanding: await this.consents.outstanding(auth.userId),
    };
  }

  @Post()
  @HttpCode(201)
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Enregistre un consentement, avec l’IP comme preuve' })
  async record(
    @Auth() auth: AuthContext,
    @Body(zodPipe(consentSchema)) body: z.infer<typeof consentSchema>,
    @Req() request: Request,
  ) {
    await this.consents.record(this.prisma, {
      userId: auth.userId,
      type: body.type,
      granted: body.granted,
      version: body.version,
      // L'IP vient de la REQUÊTE, ni du corps ni du jeton. Du corps, un client
      // écrirait n'importe quoi dans la preuve ; du jeton, elle serait celle de
      // la connexion — or un jeton dure quinze minutes et un téléphone change de
      // réseau en marchant.
      ip: clientIp(request),
    });
    return { recorded: true };
  }
}

/** L'IP du client. Voir le commentaire de `record` : elle sert de preuve (§5). */
function clientIp(request: Request): string | undefined {
  const forwarded = request.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0]?.trim();
  }
  return request.ip;
}
