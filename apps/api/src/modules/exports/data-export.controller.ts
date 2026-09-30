import { Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth, type AuthContext } from '../../common/auth.guard';
import { AllowSuspended, RateLimit, RequiresCapability } from '../../common/capability.decorator';
import { DataExportService } from './data-export.service';

/**
 * Export RGPD — 01-identite.md §4.2 : `POST /me/export` · `GET /me/export/latest`.
 *
 * `content.read` (L0) sur les deux, comme tout `/me` : le droit d'accès du RGPD
 * ne se mérite pas en vérifiant son identité. Un membre qui n'a jamais franchi
 * L0 a exactement le même droit de récupérer ce que la plateforme sait de lui.
 *
 * `@AllowSuspended()` sur le POST, et c'est la décision qui mérite l'explication.
 * `AuthGuard` refuse par défaut toute écriture à un compte suspendu ; or la
 * demande d'export EST une écriture (elle crée une ligne). Refuser reviendrait à
 * suspendre un droit légal en même temps qu'un accès de publication — ce qu'aucune
 * sanction de 13 §4.2 n'autorise, et que le RGPD n'admet pas. La suspension retire
 * la parole, pas le droit d'accès à ses propres données.
 *
 * `@RateLimit(3)` protège la route contre la répétition à la minute ; le vrai
 * plafond, « une demande par 30 jours » (§2.8), est un quota MÉTIER compté sur
 * `data_exports` dans le service — trente jours ne se tiennent pas dans Redis.
 */
@ApiTags('me')
@Controller()
export class DataExportController {
  constructor(private readonly exports: DataExportService) {}

  @Post('me/export')
  @HttpCode(202)
  @RequiresCapability('content.read')
  @AllowSuspended()
  @RateLimit(3)
  @ApiOperation({ summary: 'Demande une archive de ses données (§2.8) — génération asynchrone' })
  async request(@Auth() auth: AuthContext) {
    // 202 et non 201 : §2.8 dit « génération asynchrone ». Le code doit dire que
    // la demande est ACCEPTÉE, pas que l'archive est créée — elle ne l'est pas
    // encore quand cette réponse part.
    return this.exports.request(auth.userId);
  }

  @Get('me/export/latest')
  @RequiresCapability('content.read')
  @AllowSuspended()
  @ApiOperation({ summary: 'La dernière archive demandée et son lien (valable 7 jours)' })
  async latest(@Auth() auth: AuthContext) {
    return this.exports.latest(auth.userId);
  }
}
