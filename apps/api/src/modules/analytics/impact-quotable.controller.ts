import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { z } from 'zod';
import { quotableSchema, uuidSchema } from '@app/shared';
import { Auth, type AuthContext } from '../../common/auth.guard';
import { RequiresCapability } from '../../common/capability.decorator';
import { zodPipe } from '../../common/zod.pipe';
import { ImpactService } from './impact.service';

/**
 * L'accord de citation de l'AUTEUR (15 §5.3, §6 : « case "autoriser la citation" sur le
 * contenu »). Deux routes membre, une par type de contenu citable.
 *
 * Elles ne portent pas de capacité nouvelle : ce sont celles qui autorisent déjà à
 * écrire ce contenu (`guide.write`, `post.create`), et le SERVICE exige que le
 * demandeur soit l'AUTEUR — l'équipe ne coche jamais l'accord à la place de l'auteur.
 * Retirer l'accord (`quotable: false`) fait disparaître la citation du rapport au
 * prochain affichage.
 */
@ApiTags('impact')
@Controller()
export class ImpactQuotableController {
  constructor(private readonly impact: ImpactService) {}

  @Get('guides/:id/quotable')
  @RequiresCapability('guide.write')
  @ApiOperation({ summary: 'Mon accord de citation sur mon guide' })
  async guideAccord(@Auth() auth: AuthContext, @Param('id', zodPipe(uuidSchema)) id: string) {
    return this.impact.getGuideQuotable(auth.userId, id);
  }

  @Put('guides/:id/quotable')
  @RequiresCapability('guide.write')
  @ApiOperation({ summary: 'Autorise (ou retire) la citation de mon guide dans le rapport d’impact' })
  async guide(
    @Auth() auth: AuthContext,
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Body(zodPipe(quotableSchema)) body: z.infer<typeof quotableSchema>,
  ) {
    return this.impact.setGuideQuotable(auth.userId, id, body.quotable);
  }

  @Put('tips/:id/quotable')
  @RequiresCapability('post.create')
  @ApiOperation({ summary: 'Autorise (ou retire) la citation de ma contribution de ville dans le rapport d’impact' })
  async tip(
    @Auth() auth: AuthContext,
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Body(zodPipe(quotableSchema)) body: z.infer<typeof quotableSchema>,
  ) {
    return this.impact.setTipQuotable(auth.userId, id, body.quotable);
  }
}
