import { Body, Controller, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  PlanCode,
  STAFF_SCOPES,
  affiliateImportSchema,
  partnerCreateSchema,
  partnerUpdateSchema,
  partnersQuerySchema,
  placementCreateSchema,
  placementUpdateSchema,
  placementsQuerySchema,
  planUpdateSchema,
  refundSchema,
  revenueQuerySchema,
  subscriptionsQuerySchema,
  uuidSchema,
} from '@app/shared';
import { z } from 'zod';
import { RequiresStaffRole } from '../../common/staff-role.decorator';
import { Staff, type StaffUser } from '../../common/staff.guard';
import { zodPipe } from '../../common/zod.pipe';
import { PartnersService } from '../partners/partners.service';
import { BillingService } from './billing.service';

/**
 * Facturation et partenaires côté équipe — 14-monetisation.md §7.2,
 * préfixe `/v1/admin/billing`.
 *
 * LES RÔLES VIENNENT DE `STAFF_SCOPES`, jamais écrits à la main, et ils suivent le
 * tableau du §7.2 au mot :
 *
 *   · les PLANS (prix, limites) → `staffAdmin`, c'est-à-dire `SUPER_ADMIN` seul.
 *     Un prix est un engagement contractuel ;
 *   · les REMBOURSEMENTS → `rgpd`, qui est exactement `SUPER_ADMIN` + `SUPPORT` —
 *     §7.2 dit « POST /payments/:id/refund · SUPPORT » ;
 *   · les PARTENAIRES et PLACEMENTS → `content`, c'est-à-dire `CONTENT_ADMIN`
 *     (+ `SUPER_ADMIN`), comme §7.2 l'écrit ;
 *   · la LISTE des abonnements et le TABLEAU DE BORD → `dashboard`, les quatre
 *     rôles : §7.2 ne les restreint pas, et un modérateur qui instruit un
 *     signalement d'arnaque doit pouvoir voir si le compte a payé.
 *
 * AUCUNE de ces routes ne déclare `@RequiresCapability` en plus : `AuthGuard`
 * refuse une route mixte à chaque appel (règle dure 15 §2.1, hermétisme des deux
 * domaines).
 */
/** Le code de plan dans le chemin. Déclaré une fois, pour le type du paramètre. */
const planCodeSchema = z.enum(PlanCode);

@ApiTags('admin')
@Controller('admin/billing')
export class BillingAdminController {
  constructor(
    private readonly billing: BillingService,
    private readonly partners: PartnersService,
  ) {}

  // ── Plans (§7.2, SUPER_ADMIN) ─────────────────────────────────────────────

  @Get('plans')
  @RequiresStaffRole(...STAFF_SCOPES.staffAdmin)
  @ApiOperation({ summary: 'Les plans, leurs prix et leurs limites' })
  async plans() {
    return this.billing.adminPlans();
  }

  /**
   * `PUT /plans/:code` — le prix et les limites (§7.2).
   *
   * `PUT` et non `PATCH` : §7.2 l'écrit ainsi, et T4 §1 réserve `PUT` au
   * remplacement d'une sous-ressource entière — ce qu'est le bloc `limits`, source
   * unique des quotas de quatre modules. Les champs absents du corps ne sont pas
   * remis à zéro pour autant : remettre un prix à zéro parce qu'on modifiait une
   * limite serait un défaut à quatre euros par membre.
   */
  @Put('plans/:code')
  @RequiresStaffRole(...STAFF_SCOPES.staffAdmin)
  @ApiOperation({ summary: 'Modifie le prix, les limites ou l’activation d’un plan' })
  async updatePlan(
    @Staff() staff: StaffUser,
    @Param('code', zodPipe(planCodeSchema)) code: z.infer<typeof planCodeSchema>,
    @Body(zodPipe(planUpdateSchema)) body: z.infer<typeof planUpdateSchema>,
  ) {
    return this.billing.updatePlan(staff.staffId, code, body);
  }

  // ── Abonnements et paiements ──────────────────────────────────────────────

  @Get('subscriptions')
  @RequiresStaffRole(...STAFF_SCOPES.dashboard)
  @ApiOperation({ summary: 'Les abonnements, filtrables par statut, fournisseur ou essai' })
  async subscriptions(
    @Query(zodPipe(subscriptionsQuerySchema)) query: z.infer<typeof subscriptionsQuerySchema>,
  ) {
    return this.billing.listSubscriptions(query);
  }

  /**
   * `POST /payments/:id/refund` — SUPPORT (§4.4).
   *
   * Le motif est OBLIGATOIRE : le remboursement est tracé dans `audit_logs`, et une
   * trace sans motif n'explique rien six mois plus tard.
   */
  @Post('payments/:id/refund')
  @RequiresStaffRole(...STAFF_SCOPES.rgpd)
  @ApiOperation({ summary: 'Rembourse un paiement — 14 jours, sans usage significatif' })
  async refund(
    @Staff() staff: StaffUser,
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Body(zodPipe(refundSchema)) body: z.infer<typeof refundSchema>,
  ) {
    return this.billing.refund(staff.staffId, id, body.reason);
  }

  @Get('revenue')
  @RequiresStaffRole(...STAFF_SCOPES.dashboard)
  @ApiOperation({ summary: 'Abonnements et affiliation, par mois' })
  async revenue(@Query(zodPipe(revenueQuerySchema)) query: z.infer<typeof revenueQuerySchema>) {
    return this.billing.revenue(query);
  }

  // ── Partenaires (§7.2, CONTENT_ADMIN) ─────────────────────────────────────

  @Get('partners')
  @RequiresStaffRole(...STAFF_SCOPES.content)
  @ApiOperation({ summary: 'Les partenaires d’affiliation' })
  async partnersList(
    @Query(zodPipe(partnersQuerySchema)) query: z.infer<typeof partnersQuerySchema>,
  ) {
    return this.partners.listPartners(query);
  }

  /**
   * `POST /partners`.
   *
   * RÈGLE DURE (§5.3) : le gabarit d'URL est validé par
   * `affiliateUrlTemplateSchema`, qui refuse tout jeton autre que `{click_id}`. Un
   * gabarit contenant `{user_id}` ou `{handle}` est rejeté en 400, ici, avant
   * d'entrer en base — c'est la seule place où l'on peut empêcher une fuite qui
   * partirait ensuite à chaque clic.
   */
  @Post('partners')
  @RequiresStaffRole(...STAFF_SCOPES.content)
  @ApiOperation({ summary: 'Crée un partenaire — gabarit d’URL limité à {click_id}' })
  async createPartner(
    @Staff() staff: StaffUser,
    @Body(zodPipe(partnerCreateSchema)) body: z.infer<typeof partnerCreateSchema>,
  ) {
    return this.partners.createPartner(staff.staffId, body);
  }

  @Patch('partners/:id')
  @RequiresStaffRole(...STAFF_SCOPES.content)
  @ApiOperation({ summary: 'Modifie un partenaire, ou le désactive' })
  async updatePartner(
    @Staff() staff: StaffUser,
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Body(zodPipe(partnerUpdateSchema)) body: z.infer<typeof partnerUpdateSchema>,
  ) {
    return this.partners.updatePartner(staff.staffId, id, body);
  }

  // ── Placements (§5.1) ─────────────────────────────────────────────────────

  @Get('placements')
  @RequiresStaffRole(...STAFF_SCOPES.content)
  @ApiOperation({ summary: 'Les encarts, par étape, avec leur nombre de clics' })
  async placementsList(
    @Query(zodPipe(placementsQuerySchema)) query: z.infer<typeof placementsQuerySchema>,
  ) {
    return this.partners.listPlacements(query);
  }

  /**
   * `POST /placements`.
   *
   * RÈGLE DURE (§5.1) : « un seul placement actif par étape et par combinaison de
   * pays ». Le service le fait respecter sous verrou consultatif, parce que l'index
   * unique du schéma ne protège rien quand un pays est `NULL` — voir le préambule
   * de `PartnersService`.
   */
  @Post('placements')
  @RequiresStaffRole(...STAFF_SCOPES.content)
  @ApiOperation({ summary: 'Crée un encart sur une étape ou en pied de Logement' })
  async createPlacement(
    @Staff() staff: StaffUser,
    @Body(zodPipe(placementCreateSchema)) body: z.infer<typeof placementCreateSchema>,
  ) {
    return this.partners.createPlacement(staff.staffId, body);
  }

  @Patch('placements/:id')
  @RequiresStaffRole(...STAFF_SCOPES.content)
  @ApiOperation({ summary: 'Modifie un encart, l’active ou le désactive' })
  async updatePlacement(
    @Staff() staff: StaffUser,
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Body(zodPipe(placementUpdateSchema)) body: z.infer<typeof placementUpdateSchema>,
  ) {
    return this.partners.updatePlacement(staff.staffId, id, body);
  }

  // ── Affiliation (§5.3) ────────────────────────────────────────────────────

  @Post('affiliate/import')
  @RequiresStaffRole(...STAFF_SCOPES.content)
  @ApiOperation({ summary: 'Importe les conversions du partenaire — idempotent' })
  async importConversions(
    @Staff() staff: StaffUser,
    @Body(zodPipe(affiliateImportSchema)) body: z.infer<typeof affiliateImportSchema>,
  ) {
    return this.partners.importConversions(staff.staffId, body);
  }

  @Get('affiliate')
  @RequiresStaffRole(...STAFF_SCOPES.dashboard)
  @ApiOperation({ summary: 'Clics, conversions, taux et revenus par partenaire et par étape' })
  async affiliateDashboard() {
    return this.partners.affiliateDashboard();
  }
}

