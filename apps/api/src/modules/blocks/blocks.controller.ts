import { Body, Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { handleSchema, uuidSchema } from '@app/shared';
import { z } from 'zod';
import { Auth, type AuthContext } from '../../common/auth.guard';
import { RequiresCapability } from '../../common/capability.decorator';
import { zodPipe } from '../../common/zod.pipe';
import { BlocksService } from './blocks.service';

/** Blocage — 08-parrainage-messagerie.md §7.2. */
@ApiTags('blocks')
@Controller()
export class BlocksController {
  constructor(private readonly blocks: BlocksService) {}

  @Post('blocks')
  @HttpCode(201)
  // `content.read` : bloquer est ouvert dès L0. Demander un niveau de
  // vérification pour se protéger serait exactement le mauvais arbitrage.
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Bloquer un membre' })
  async block(
    @Auth() auth: AuthContext,
    @Body(zodPipe(z.object({ handle: handleSchema }))) body: { handle: string },
  ) {
    return this.blocks.block(auth.userId, body.handle);
  }

  @Delete('blocks/:userId')
  @HttpCode(204)
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Débloquer — les contacts ne sont pas restaurés (§4)' })
  async unblock(
    @Auth() auth: AuthContext,
    @Param('userId', zodPipe(uuidSchema)) userId: string,
  ): Promise<void> {
    await this.blocks.unblock(auth.userId, userId);
  }

  @Get('me/blocks')
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Les membres bloqués' })
  async list(@Auth() auth: AuthContext) {
    return { items: await this.blocks.list(auth.userId) };
  }
}
