import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  caseActionSchema,
  casesQuerySchema,
  moderationThresholdsSchema,
  scamAlertWriteSchema,
  uuidSchema,
} from '@app/shared';
import type { z } from 'zod';
import { RequiresStaffRole } from '../../common/staff-role.decorator';
import { Staff, staffContext, type StaffUser } from '../../common/staff.guard';
import { zodPipe } from '../../common/zod.pipe';
import { ModerationService } from '../moderation/moderation.service';

/**
 * Modération, côté équipe — 13-moderation.md §8.2, sous `/v1/admin/moderation`.
 *
 * ── Ce fichier ne contient AUCUNE logique, et c'est le but ──────────────────
 *
 * `ModerationService` porte déjà toute la logique d'équipe, testée, avec sa garde
 * de rôle interne et ses écritures d'audit transactionnelles. Ce qui manquait
 * était le garde : `moderation.controller.ts` l'explique en tête, et dit que « le
 * jour où le garde arrive, ce fichier gagne huit routes de dix lignes et rien
 * d'autre ne bouge ». Le garde est arrivé ; les routes sont ici plutôt que
 * là-bas, pour une raison simple — elles vivent sous un autre préfixe, elles
 * relèvent d'un autre domaine de sécurité, et mélanger les deux dans un même
 * contrôleur remettrait côte à côte les deux choses que la règle dure du §2.1
 * demande de séparer.
 *
 * La logique des autres modules n'est pas réécrite : chaque méthode est appelée
 * telle quelle, avec le `StaffContext` que `staffContext()` extrait du contexte du
 * garde.
 *
 * ── Double contrôle de rôle, volontaire ────────────────────────────────────
 *
 * Le rôle est vérifié DEUX FOIS : par `@RequiresStaffRole` ici, et par
 * `assertRole` dans le service. Ce n'est pas une redondance à supprimer :
 *   · le garde refuse AVANT que le corps de la requête ne soit lu, donc avant
 *     toute requête en base ;
 *   · le service protège ses méthodes contre un appel venu d'ailleurs — d'une
 *     tâche planifiée, d'un autre module — où aucun garde ne tourne.
 * Les listes sont identiques à celles du service, exprès : une liste plus étroite
 * ici rendrait une branche du service inatteignable et impossible à tester.
 */
@ApiTags('admin-moderation')
@Controller('admin/moderation')
export class AdminModerationController {
  constructor(private readonly moderation: ModerationService) {}

  // ── La file (§8.2) ────────────────────────────────────────────────────────

  @Get('cases')
  @RequiresStaffRole('MODERATOR', 'CONTENT_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'File de modération, filtrable par statut, priorité, assignation, SLA' })
  async cases(
    @Staff() staff: StaffUser,
    @Query(zodPipe(casesQuerySchema)) query: z.infer<typeof casesQuerySchema>,
  ) {
    return this.moderation.listCases(staffContext(staff), query);
  }

  @Get('cases/:id')
  @RequiresStaffRole('MODERATOR', 'CONTENT_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Dossier complet : signalements, analyses IA, historique de l’auteur' })
  async caseDetail(@Staff() staff: StaffUser, @Param('id', zodPipe(uuidSchema)) id: string) {
    return this.moderation.caseDetail(staffContext(staff), id);
  }

  @Post('cases/:id/assign')
  @RequiresStaffRole('MODERATOR', 'CONTENT_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'S’assigne un dossier (refusé sur une contestation déjà tranchée par soi)' })
  async assign(@Staff() staff: StaffUser, @Param('id', zodPipe(uuidSchema)) id: string) {
    return this.moderation.assignCase(staffContext(staff), id);
  }

  @Post('cases/:id/release')
  @RequiresStaffRole('MODERATOR', 'CONTENT_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Rend le dossier à la file' })
  async release(@Staff() staff: StaffUser, @Param('id', zodPipe(uuidSchema)) id: string) {
    return this.moderation.releaseCase(staffContext(staff), id);
  }

  /**
   * L'action : masquer, avertir, suspendre, bannir, classer.
   *
   * Le bannissement définitif est réservé au `SUPER_ADMIN` (§2.2). C'est le SERVICE
   * qui le vérifie, sur le contenu du corps (`input.action === 'BAN_USER'`), parce
   * que le garde ne lit pas le corps. Déclarer la route `SUPER_ADMIN` seulement
   * interdirait à un modérateur de masquer un contenu ; la déclarer ouverte aux
   * trois rôles et laisser le service trancher est la seule répartition juste.
   */
  @Post('cases/:id/actions')
  @RequiresStaffRole('MODERATOR', 'CONTENT_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Agit sur un dossier ; le bannissement exige SUPER_ADMIN' })
  async act(
    @Staff() staff: StaffUser,
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Body(zodPipe(caseActionSchema)) body: z.infer<typeof caseActionSchema>,
  ) {
    return this.moderation.act(staffContext(staff), id, body);
  }

  @Get('users/:id/history')
  @RequiresStaffRole('MODERATOR', 'CONTENT_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Historique de modération d’un membre : sanctions et dossiers' })
  async history(@Staff() staff: StaffUser, @Param('id', zodPipe(uuidSchema)) id: string) {
    return this.moderation.userModerationHistory(staffContext(staff), id);
  }

  @Get('stats')
  @RequiresStaffRole('MODERATOR', 'CONTENT_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'File par priorité, dossiers en retard, délai moyen, respect du SLA' })
  async stats(@Staff() staff: StaffUser) {
    return this.moderation.stats(staffContext(staff));
  }

  // ── Les seuils (§4.4) ─────────────────────────────────────────────────────

  /**
   * Les seuils vivent dans `system_settings['moderation.thresholds']`, et sont
   * donc lisibles et modifiables AUSSI par `/v1/admin/settings/:key`. Deux chemins
   * pour la même clé, ce qui mérite une justification : celui-ci valide avec le
   * schéma du module 13 et passe par son service, qui est le seul à savoir ce
   * qu'un seuil partiel signifie. Le registre générique, lui, applique le MÊME
   * schéma zod (`moderationThresholdsSchema`) — c'est ce qui garantit que les deux
   * portes ne peuvent pas accepter des valeurs différentes.
   */
  @Get('settings')
  @RequiresStaffRole('MODERATOR', 'CONTENT_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Seuils de modération effectifs (défauts du code si non réglés)' })
  async thresholds() {
    return this.moderation.thresholds();
  }

  @Put('settings')
  @RequiresStaffRole('CONTENT_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Modifie les seuils de modération' })
  async putThresholds(
    @Staff() staff: StaffUser,
    @Body(zodPipe(moderationThresholdsSchema)) body: z.infer<typeof moderationThresholdsSchema>,
  ) {
    return this.moderation.updateThresholds(staffContext(staff), body);
  }

  // ── Alertes arnaques (§5) ─────────────────────────────────────────────────

  @Post('scam-alerts')
  @RequiresStaffRole('CONTENT_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Publie une alerte arnaque, globale ou ciblée ville/pays' })
  async createScamAlert(
    @Staff() staff: StaffUser,
    @Body(zodPipe(scamAlertWriteSchema)) body: z.infer<typeof scamAlertWriteSchema>,
  ) {
    return this.moderation.createScamAlert(staffContext(staff), body);
  }

  @Put('scam-alerts/:id')
  @RequiresStaffRole('CONTENT_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Modifie une alerte arnaque' })
  async updateScamAlert(
    @Staff() staff: StaffUser,
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Body(zodPipe(scamAlertWriteSchema)) body: z.infer<typeof scamAlertWriteSchema>,
  ) {
    return this.moderation.updateScamAlert(staffContext(staff), id, body);
  }

  @Post('scam-alerts/:id/retire')
  @RequiresStaffRole('CONTENT_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Retire une alerte arnaque de l’affichage' })
  async retireScamAlert(@Staff() staff: StaffUser, @Param('id', zodPipe(uuidSchema)) id: string) {
    return this.moderation.retireScamAlert(staffContext(staff), id);
  }
}
