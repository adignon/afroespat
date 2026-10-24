import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  STAFF_SCOPES,
  announcementListQuerySchema,
  announcementWriteSchema,
  flagUpdateSchema,
  flagWriteSchema,
  pageCreateSchema,
  pageDraftSchema,
  pageSlugSchema,
  uuidSchema,
} from '@app/shared';
import type { z } from 'zod';
import { Auth, type AuthContext } from '../../common/auth.guard';
import { RequiresCapability, PublicRead } from '../../common/capability.decorator';
import { FeatureFlagService } from '../../common/feature-flag.service';
import { PrismaService } from '../../common/prisma.service';
import { RequiresStaffRole } from '../../common/staff-role.decorator';
import { Staff, type StaffUser } from '../../common/staff.guard';
import { zodPipe } from '../../common/zod.pipe';
import { AdminContentService } from './admin-content.service';

/**
 * Pages, annonces et drapeaux — 15 §7.
 *
 * Rôles (§2.2) : pages et annonces — `content` (SUPER_ADMIN, CONTENT_ADMIN) ;
 * drapeaux — `staffAdmin` (SUPER_ADMIN seul). Lecture des drapeaux : les quatre
 * rôles voient l'état, un seul le change.
 */
@ApiTags('admin')
@Controller('admin')
export class AdminContentController {
  constructor(private readonly content: AdminContentService) {}

  // ── Pages ─────────────────────────────────────────────────────────────────

  @Get('pages')
  @RequiresStaffRole(...STAFF_SCOPES.dashboard)
  @ApiOperation({ summary: 'Les pages statiques : version en vigueur, brouillon, historique' })
  listPages() {
    return this.content.listPages();
  }

  @Post('pages')
  @RequiresStaffRole(...STAFF_SCOPES.content)
  @ApiOperation({ summary: 'Crée une page (non publiée) avec son premier brouillon' })
  createPage(@Staff() staff: StaffUser, @Body(zodPipe(pageCreateSchema)) body: z.infer<typeof pageCreateSchema>) {
    return this.content.createPage(staff, body);
  }

  @Get('pages/:id')
  @RequiresStaffRole(...STAFF_SCOPES.dashboard)
  @ApiOperation({ summary: 'Une page, avec le corps de sa version en vigueur et de son brouillon' })
  getPage(@Param('id', zodPipe(uuidSchema)) id: string) {
    return this.content.getPage(id);
  }

  @Put('pages/:id')
  @RequiresStaffRole(...STAFF_SCOPES.content)
  @ApiOperation({ summary: 'Enregistre le brouillon de la page' })
  saveDraft(
    @Staff() staff: StaffUser,
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Body(zodPipe(pageDraftSchema)) body: z.infer<typeof pageDraftSchema>,
  ) {
    return this.content.saveDraft(staff, id, body);
  }

  @Post('pages/:id/publish')
  @HttpCode(200)
  @RequiresStaffRole(...STAFF_SCOPES.content)
  @ApiOperation({ summary: 'Publie le brouillon ; CGU et confidentialité redemandent le consentement' })
  publishPage(@Staff() staff: StaffUser, @Param('id', zodPipe(uuidSchema)) id: string) {
    return this.content.publishPage(staff, id);
  }

  @Delete('pages/:id')
  @RequiresStaffRole(...STAFF_SCOPES.content)
  @ApiOperation({ summary: 'Supprime une page jamais publiée' })
  deletePage(@Staff() staff: StaffUser, @Param('id', zodPipe(uuidSchema)) id: string) {
    return this.content.deletePage(staff, id);
  }

  // ── Annonces ──────────────────────────────────────────────────────────────

  @Get('announcements')
  @RequiresStaffRole(...STAFF_SCOPES.dashboard)
  @ApiOperation({ summary: 'Les annonces, filtrables par état' })
  listAnnouncements(
    @Query(zodPipe(announcementListQuerySchema)) query: z.infer<typeof announcementListQuerySchema>,
  ) {
    return this.content.listAnnouncements(query);
  }

  @Post('announcements')
  @RequiresStaffRole(...STAFF_SCOPES.content)
  @ApiOperation({ summary: 'Crée une annonce (titre, corps, ciblage, période)' })
  createAnnouncement(
    @Staff() staff: StaffUser,
    @Body(zodPipe(announcementWriteSchema)) body: z.infer<typeof announcementWriteSchema>,
  ) {
    return this.content.createAnnouncement(staff, body);
  }

  @Put('announcements/:id')
  @RequiresStaffRole(...STAFF_SCOPES.content)
  @ApiOperation({ summary: 'Modifie une annonce' })
  updateAnnouncement(
    @Staff() staff: StaffUser,
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Body(zodPipe(announcementWriteSchema)) body: z.infer<typeof announcementWriteSchema>,
  ) {
    return this.content.updateAnnouncement(staff, id, body);
  }

  @Delete('announcements/:id')
  @RequiresStaffRole(...STAFF_SCOPES.content)
  @ApiOperation({ summary: 'Supprime une annonce' })
  deleteAnnouncement(@Staff() staff: StaffUser, @Param('id', zodPipe(uuidSchema)) id: string) {
    return this.content.deleteAnnouncement(staff, id);
  }

  // ── Drapeaux ──────────────────────────────────────────────────────────────

  @Get('flags')
  @RequiresStaffRole(...STAFF_SCOPES.dashboard)
  @ApiOperation({ summary: 'Les feature flags' })
  listFlags() {
    return this.content.listFlags();
  }

  @Post('flags')
  @RequiresStaffRole(...STAFF_SCOPES.staffAdmin)
  @ApiOperation({ summary: 'Crée un feature flag' })
  createFlag(@Staff() staff: StaffUser, @Body(zodPipe(flagWriteSchema)) body: z.infer<typeof flagWriteSchema>) {
    return this.content.createFlag(staff, body);
  }

  @Patch('flags/:id')
  @RequiresStaffRole(...STAFF_SCOPES.staffAdmin)
  @ApiOperation({ summary: 'Active, désactive, change le pourcentage ou les conditions d’un flag' })
  updateFlag(
    @Staff() staff: StaffUser,
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Body(zodPipe(flagUpdateSchema)) body: z.infer<typeof flagUpdateSchema>,
  ) {
    return this.content.updateFlag(staff, id, body);
  }

  @Delete('flags/:id')
  @RequiresStaffRole(...STAFF_SCOPES.staffAdmin)
  @ApiOperation({ summary: 'Supprime un feature flag' })
  deleteFlag(@Staff() staff: StaffUser, @Param('id', zodPipe(uuidSchema)) id: string) {
    return this.content.deleteFlag(staff, id);
  }
}

/**
 * Le côté MEMBRE de ce contenu : la page en vigueur, l'annonce du moment, les
 * drapeaux. Aucune écriture, donc aucune capacité au-delà de la lecture.
 */
@ApiTags('content')
@Controller()
export class PublicContentController {
  constructor(
    private readonly content: AdminContentService,
    private readonly flags: FeatureFlagService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * `GET /pages/:slug` — public, comme `GET /scam-alerts` : les conditions et la
   * politique de confidentialité se lisent AVANT de s'inscrire, c'est tout leur objet
   * (01 §2.10 : l'inscription les cite).
   */
  @Get('pages/:slug')
  @PublicRead()
  @ApiOperation({ summary: 'La version en vigueur d’une page statique' })
  page(@Param('slug', zodPipe(pageSlugSchema)) slug: string) {
    return this.content.publicPage(slug);
  }

  @Get('announcements/active')
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'L’annonce active pour ce membre (la plus récente ciblée), ou null' })
  active(@Auth() auth: AuthContext) {
    return this.content.activeFor(auth.userId);
  }

  @Get('me/flags')
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'L’état de chaque feature flag pour ce membre' })
  async myFlags(@Auth() auth: AuthContext) {
    const user = await this.prisma.user.findUnique({
      where: { id: auth.userId },
      select: { cityId: true, originCountryId: true, phase: true, plan: true },
    });
    const flags = await this.flags.evaluateAll({
      userId: auth.userId,
      cityId: user?.cityId ?? null,
      countryId: user?.originCountryId ?? null,
      phase: user?.phase ?? null,
      plan: user?.plan ?? null,
    });
    return { flags };
  }
}
