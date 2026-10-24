import { Body, Controller, Delete, Get, Header, Param, Post, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import {
  ADMIN_CONTENT_AUDIT_ACTIONS,
  STAFF_SCOPES,
  impactQuarterQuerySchema,
  impactQuoteApproveSchema,
  impactRecomputeSchema,
  uuidSchema,
} from '@app/shared';
import { AuditService } from '../../common/audit.service';
import { Staff, type StaffUser } from '../../common/staff.guard';
import { RequiresStaffRole } from '../../common/staff-role.decorator';
import { zodPipe } from '../../common/zod.pipe';
import { AnalyticsService } from './analytics.service';
import { DashboardOverviewService } from './dashboard-overview.service';
import { ImpactService } from './impact.service';

/**
 * Le pilotage, côté équipe — 15-administration.md §7.
 *
 * Les quatre routes de §7 que `metric_snapshots` rend enfin possibles :
 * `GET /dashboard`, `/dashboard/:block`, `/stats/*`, `/impact`.
 *
 * TOUS LES RÔLES y ont accès : §2.2 met « Tableaux de bord » à ✓ pour
 * `SUPER_ADMIN`, `CONTENT_ADMIN`, `MODERATOR` et `SUPPORT`. C'est le seul bloc de
 * la matrice ouvert aux quatre, et le restreindre « par prudence » contredirait la
 * spec — un modérateur a besoin de voir la file et son SLA.
 *
 * RÈGLE DURE §5.2 : « Aucune statistique n'affiche un taux de réussite ou d'échec
 * côté membres. Ces données restent dans l'admin. » D'où `@RequiresStaffRole` et
 * non une capacité membre : ces routes vivent sous `/v1/admin`, derrière
 * `StaffGuard`, et aucune ne peut être atteinte avec un jeton de membre —
 * `AuthGuard` refuse d'ailleurs une route qui déclarerait les deux domaines.
 *
 * RÈGLE DURE §5.3 : « Toutes les données sont agrégées, jamais nominatives. »
 * Aucune de ces routes ne rend d'identifiant de membre : les dimensions sont des
 * villes, des pays, des statuts et des définitions d'étape.
 */

const STAFF_ALL = ['SUPER_ADMIN', 'CONTENT_ADMIN', 'MODERATOR', 'SUPPORT'] as const;

const seriesQuerySchema = z.object({
  metric: z.string().min(1).max(120),
  dimension: z.string().max(120).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(2_000).optional(),
});

/** Les métriques affichées en tête de l'accueil admin (§8 : « indicateur clé en tête »). */
const DASHBOARD_BLOCKS: Record<string, readonly string[]> = {
  membres: ['members.registered', 'members.active_7d', 'members.active_30d', 'members.new_7d', 'members.by_phase', 'members.by_level', 'members.by_city', 'members.by_origin_country'],
  indicateur_cle: ['key_indicator.event_presence_90d', 'key_indicator.city_members', 'key_indicator.city_present_90d'],
  parcours: ['journeys.by_status'],
  entraide: ['help.by_status', 'help.first_response_median_minutes'],
  guides: ['guides.by_status', 'guides.votes'],
  parrainage: ['mentorships.by_status'],
  evenements: ['events.by_status', 'events.checked_in'],
  reseaux: ['communities.by_status'],
  services: ['housing.by_status', 'jobs.by_status', 'pros.by_verification'],
  moderation: ['moderation.cases_by_status', 'moderation.sanctions_active'],
  revenus: ['subscriptions.by_status'],
};

const BLOCK_NAMES = [
  'membres', 'indicateur_cle', 'parcours', 'entraide', 'guides',
  'parrainage', 'evenements', 'reseaux', 'services', 'moderation', 'revenus',
] as const;

@ApiTags('admin')
@Controller('admin')
export class AnalyticsAdminController {
  constructor(
    private readonly analytics: AnalyticsService,
    private readonly audit: AuditService,
    private readonly overviewService: DashboardOverviewService,
    private readonly impactService: ImpactService,
  ) {}

  @Get('dashboard')
  @RequiresStaffRole(...STAFF_ALL)
  @ApiOperation({ summary: 'Tableau de bord principal — derniers instantanés de chaque bloc (§5.1)' })
  async dashboard() {
    const blocks: Record<string, unknown> = {};
    for (const [name, metrics] of Object.entries(DASHBOARD_BLOCKS)) {
      blocks[name] = await this.analytics.latest(metrics);
    }
    return { blocks };
  }

  /**
   * Ce que les blocs d'instantanés ne portent pas : alertes, indicateur clé AVEC objectif,
   * variation et courbe, file et SLA de modération, note des parrainages, événements du
   * mois, réseaux par type. Déclarée AVANT `dashboard/:block` : `overview` n'est pas un
   * nom de bloc, et l'ordre de déclaration décide de la route retenue.
   */
  @Get('dashboard/overview')
  @RequiresStaffRole(...STAFF_ALL)
  @ApiOperation({ summary: 'Tableau de bord — alertes, indicateur clé, modération, parrainage, événements, réseaux (§5.1)' })
  async overview(@Staff() staff: StaffUser) {
    return this.overviewService.overview(staff.staffId);
  }

  @Get('dashboard/:block')
  @RequiresStaffRole(...STAFF_ALL)
  @ApiOperation({ summary: 'Un bloc du tableau de bord (§7 : `/dashboard/:block`)' })
  async block(@Param('block', zodPipe(z.enum(BLOCK_NAMES))) block: (typeof BLOCK_NAMES)[number]) {
    // `z.enum` plutôt qu'une chaîne libre : un nom de bloc inconnu rend `400` avec
    // la liste des noms admis, au lieu d'un tableau vide qu'on prendrait pour
    // « aucune donnée » — la confusion coûte une demi-journée de recherche.
    return { block, items: await this.analytics.latest(DASHBOARD_BLOCKS[block] ?? []) };
  }

  @Get('stats/series')
  @RequiresStaffRole(...STAFF_ALL)
  @ApiOperation({ summary: 'La courbe d’un indicateur — ce pour quoi §6 crée `metric_snapshots`' })
  async series(@Query(zodPipe(seriesQuerySchema)) query: z.infer<typeof seriesQuerySchema>) {
    return { items: await this.analytics.series(query.metric, query) };
  }

  @Get('stats/steps')
  @RequiresStaffRole(...STAFF_ALL)
  @ApiOperation({ summary: 'Délais réels par étape : médiane, quartiles, effectif (§5.2)' })
  async steps() {
    return {
      items: await this.analytics.latest([
        'stats.step.effectif',
        'stats.step.p25_days',
        'stats.step.median_days',
        'stats.step.p75_days',
      ]),
    };
  }

  @Get('stats/blockers')
  @RequiresStaffRole(...STAFF_ALL)
  @ApiOperation({ summary: 'Étapes bloquantes et étapes sautées (§5.2) — suggèrent `is_risky`' })
  async blockers() {
    return { items: await this.analytics.latest(['stats.step.blocker_ratio', 'stats.step.skipped']) };
  }

  @Get('stats/migrations')
  @RequiresStaffRole(...STAFF_ALL)
  @ApiOperation({ summary: 'Parcours restés sur une version archivée, par modèle (§5.2)' })
  async migrations() {
    return { items: await this.analytics.migrations() };
  }

  @Get('impact')
  @RequiresStaffRole(...STAFF_ALL)
  @ApiOperation({ summary: 'Rapport d’impact d’un trimestre, relu dans l’historique (§5.3) — agrégé, jamais nominatif' })
  async impact(@Query(zodPipe(impactQuarterQuerySchema)) query: z.infer<typeof impactQuarterQuerySchema>) {
    return this.impactService.report(query.quarter);
  }

  /**
   * §7 : `/impact/export`. Un CSV (`trimestre,révision,indicateur,tranche,valeur`), pas un
   * PDF : aucune bibliothèque de rendu PDF n'est installée dans l'API, et l'impression du
   * navigateur (D16) produit le PDF. Le contenu est celui de `/impact` pour le trimestre
   * demandé — agrégé, jamais nominatif, témoignages consentis compris — et l'export est
   * TRACÉ (§2.3 : toute action qui sort des données de l'application se journalise).
   */
  @Get('impact/export')
  @RequiresStaffRole(...STAFF_ALL)
  @Header('content-type', 'text/csv; charset=utf-8')
  @Header('content-disposition', 'attachment; filename="rapport-impact.csv"')
  @ApiOperation({ summary: 'Export CSV du rapport d’impact d’un trimestre' })
  async impactExport(
    @Staff() staff: StaffUser,
    @Query(zodPipe(impactQuarterQuerySchema)) query: z.infer<typeof impactQuarterQuerySchema>,
  ) {
    const { report, text } = await this.impactService.csv(query.quarter);
    await this.audit.record(this.analyticsPrisma(), {
      actor: { type: 'STAFF', id: staff.staffId },
      action: ADMIN_CONTENT_AUDIT_ACTIONS.impactExported,
      targetType: 'impact_report',
      metadata: { trimestre: report.trimestre, revision: report.revision, lignes: report.items.length },
      ...(staff.ip === null ? {} : { ip: staff.ip }),
    });
    return text;
  }

  /** Un nouveau calcul d'un trimestre CLOS : une révision de plus, l'ancienne est conservée. */
  @Post('impact/recompute')
  @RequiresStaffRole(...STAFF_SCOPES.content)
  @ApiOperation({ summary: 'Recalcule un trimestre clos : pose la révision suivante (rien n’est écrasé)' })
  async recompute(@Staff() staff: StaffUser, @Body(zodPipe(impactRecomputeSchema)) body: z.infer<typeof impactRecomputeSchema>) {
    return this.impactService.recompute(body.quarter, staff.staffId, staff.ip);
  }

  @Get('impact/testimonials')
  @RequiresStaffRole(...STAFF_SCOPES.content)
  @ApiOperation({ summary: 'Contenus dont l’auteur accepte la citation, avec la citation approuvée du trimestre' })
  async testimonials(@Query(zodPipe(impactQuarterQuerySchema)) query: z.infer<typeof impactQuarterQuerySchema>) {
    return this.impactService.candidates(query.quarter ?? (await this.impactService.report(undefined)).trimestre);
  }

  @Put('impact/quotes')
  @RequiresStaffRole(...STAFF_SCOPES.content)
  @ApiOperation({ summary: 'Approuve la citation (extrait modéré) d’un contenu consenti pour un trimestre' })
  async approveQuote(@Staff() staff: StaffUser, @Body(zodPipe(impactQuoteApproveSchema)) body: z.infer<typeof impactQuoteApproveSchema>) {
    return this.impactService.approveQuote(body, staff.staffId, staff.ip);
  }

  @Delete('impact/quotes/:id')
  @RequiresStaffRole(...STAFF_SCOPES.content)
  @ApiOperation({ summary: 'Retire une citation du rapport' })
  async withdrawQuote(@Staff() staff: StaffUser, @Param('id', zodPipe(uuidSchema)) id: string) {
    return this.impactService.withdrawQuote(id, staff.staffId, staff.ip);
  }

  private analyticsPrisma() {
    return this.analytics.prismaClient();
  }
}
