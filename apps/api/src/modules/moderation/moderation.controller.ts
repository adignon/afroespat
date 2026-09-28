import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  appealSchema,
  createReportSchema,
  scamAlertsQuerySchema,
  uuidSchema,
} from '@app/shared';
import type { z } from 'zod';
import { Auth, type AuthContext } from '../../common/auth.guard';
import { AllowSuspended, PublicRead, RateLimit, RequiresCapability } from '../../common/capability.decorator';
import { zodPipe } from '../../common/zod.pipe';
import { ModerationService } from './moderation.service';

/**
 * Modération — 13-moderation.md §8.
 *
 * CE CONTRÔLEUR NE PORTE QUE LES ROUTES MEMBRES (§8.1). Les routes d'équipe de
 * §8.2 (`/v1/admin/moderation/*`) ne sont PAS exposées, et c'est délibéré : elles
 * exigent un contexte `StaffUser` et un garde de rôle qui n'existent pas dans le
 * tronc commun. Les publier sous le garde de capacités des membres donnerait à
 * n'importe quel compte L0 le pouvoir de bannir — le garde global n'a aucune
 * notion de rôle équipe, et `@RequiresCapability('content.read')` laisserait
 * passer tout le monde.
 *
 * Les méthodes correspondantes existent et sont testées dans
 * `ModerationService` : `listCases`, `caseDetail`, `assignCase`, `releaseCase`,
 * `act`, `userModerationHistory`, `stats`, `createScamAlert`, `updateThresholds`.
 * Elles prennent un `StaffContext` en premier argument. Le jour où le garde
 * arrive, ce fichier gagne huit routes de dix lignes et rien d'autre ne bouge.
 *
 * `POST /reports` est déclarée `@RateLimit(20)` : signaler doit rester facile —
 * la limite de débit n'est pas la défense contre l'abus de signalement, la règle
 * des dix rejets consécutifs du §3 l'est.
 */
@ApiTags('moderation')
@Controller()
export class ModerationController {
  constructor(private readonly moderation: ModerationService) {}

  // ── §8.1 — Membres ────────────────────────────────────────────────────────

  @Post('reports')
  @RequiresCapability('report.create')
  @RateLimit(20)
  @ApiOperation({ summary: 'Signale un contenu ou un profil (un seul par sujet)' })
  async report(
    @Auth() auth: AuthContext,
    @Body(zodPipe(createReportSchema)) body: z.infer<typeof createReportSchema>,
  ) {
    return this.moderation.report(auth.userId, body);
  }

  /**
   * `@RequiresCapability('content.read')` et non `@PublicRead()` : la route n'a
   * aucun sens sans jeton, et la déclarer publique la laisserait répondre à un
   * visiteur — qui n'a pas de sanctions.
   */
  @Get('me/sanctions')
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Mes avertissements et suspensions, avec la règle enfreinte' })
  async mySanctions(@Auth() auth: AuthContext) {
    return this.moderation.mySanctions(auth.userId);
  }

  /**
   * §4.3 : une contestation, une seule.
   *
   * ATTENTION — le garde global refuse toute écriture d'un compte `SUSPENDED`
   * (00 §7.3 : « un compte suspendu peut toujours CONSULTER »). Un membre suspendu
   * reçoit donc aujourd'hui `403 ACCOUNT_SUSPENDED` sur sa propre contestation,
   * alors que §4.3 lui en donne le droit. La correction appartient au garde, pas
   * à ce module : il lui faut une exemption explicite pour cette route. Signalé
   * dans le rapport de livraison ; le service, lui, traite la contestation
   * correctement dès qu'on l'appelle.
   */
  @AllowSuspended()
  @Post('sanctions/:id/appeal')
  @RequiresCapability('sanction.appeal')
  @RateLimit(5)
  @ApiOperation({ summary: 'Conteste une sanction, une seule fois (≤ 1 000 caractères)' })
  async appeal(
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Auth() auth: AuthContext,
    @Body(zodPipe(appealSchema)) body: z.infer<typeof appealSchema>,
  ) {
    return this.moderation.appeal(auth.userId, id, body);
  }

  /**
   * §5 : les alertes arnaques actives. `@PublicRead()` parce qu'un pré-départ qui
   * n'a pas encore de compte est exactement la personne que ces alertes protègent
   * (§1 : « la modération protège d'abord le segment pré-départ »). La leur cacher
   * derrière une inscription irait contre la raison d'être de la table.
   */
  @Get('scam-alerts')
  @PublicRead()
  @ApiOperation({ summary: 'Alertes arnaques actives, globales ou ciblées ville/pays' })
  async scamAlerts(
    @Query(zodPipe(scamAlertsQuerySchema)) query: z.infer<typeof scamAlertsQuerySchema>,
  ) {
    return this.moderation.listScamAlerts(query);
  }
}
