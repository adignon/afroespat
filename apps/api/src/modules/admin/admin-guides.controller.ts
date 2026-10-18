import { Body, Controller, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  STAFF_SCOPES,
  adminGuideMaintainedSchema,
  adminGuideRevertSchema,
  adminGuideStatusSchema,
  adminGuidesQuerySchema,
  adminProposalDecisionSchema,
  uuidSchema,
} from '@app/shared';
import type { z } from 'zod';
import { RequiresStaffRole } from '../../common/staff-role.decorator';
import { Staff, type StaffUser } from '../../common/staff.guard';
import { zodPipe } from '../../common/zod.pipe';
import { AdminGuidesService } from './admin-guides.service';

/** `/v1/admin/guides` — 05 §4. Contenu : SUPER_ADMIN et CONTENT_ADMIN écrivent, les quatre rôles lisent. */
@ApiTags('admin')
@Controller('admin/guides')
export class AdminGuidesController {
  constructor(private readonly guides: AdminGuidesService) {}

  @Get()
  @RequiresStaffRole(...STAFF_SCOPES.dashboard)
  @ApiOperation({ summary: 'Les guides par statut' })
  list(@Query(zodPipe(adminGuidesQuerySchema)) query: z.infer<typeof adminGuidesQuerySchema>) {
    return this.guides.list(query);
  }

  @Get('counts')
  @RequiresStaffRole(...STAFF_SCOPES.dashboard)
  @ApiOperation({ summary: 'Compteurs des onglets : escaladées, signalés, tous' })
  counts() {
    return this.guides.counts();
  }

  @Get('proposals/escalated')
  @RequiresStaffRole(...STAFF_SCOPES.dashboard)
  @ApiOperation({ summary: 'Les propositions escaladées (avant / après)' })
  escalated() {
    return this.guides.escalatedProposals();
  }

  @Post('proposals/:id/decide')
  @HttpCode(200)
  @RequiresStaffRole(...STAFF_SCOPES.content)
  @ApiOperation({ summary: 'Accepte ou refuse, à la place du créateur, une proposition escaladée' })
  decide(
    @Staff() staff: StaffUser,
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Body(zodPipe(adminProposalDecisionSchema)) body: z.infer<typeof adminProposalDecisionSchema>,
  ) {
    return this.guides.decideProposal(staff, id, body);
  }

  @Get(':id/versions')
  @RequiresStaffRole(...STAFF_SCOPES.dashboard)
  @ApiOperation({ summary: 'Les versions d’un guide' })
  versions(@Param('id', zodPipe(uuidSchema)) id: string) {
    return this.guides.versions(id);
  }

  @Post(':id/status')
  @HttpCode(200)
  @RequiresStaffRole(...STAFF_SCOPES.content)
  @ApiOperation({ summary: 'Force FLAGGED, UNPUBLISHED ou PUBLISHED, avec motif' })
  status(
    @Staff() staff: StaffUser,
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Body(zodPipe(adminGuideStatusSchema)) body: z.infer<typeof adminGuideStatusSchema>,
  ) {
    return this.guides.forceStatus(staff, id, body);
  }

  @Post(':id/revert')
  @HttpCode(200)
  @RequiresStaffRole(...STAFF_SCOPES.content)
  @ApiOperation({ summary: 'Retour arrière : nouvelle version au corps d’une version passée' })
  revert(
    @Staff() staff: StaffUser,
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Body(zodPipe(adminGuideRevertSchema)) body: z.infer<typeof adminGuideRevertSchema>,
  ) {
    return this.guides.revert(staff, id, body);
  }

  @Put(':id/maintained')
  @RequiresStaffRole(...STAFF_SCOPES.content)
  @ApiOperation({ summary: 'Bascule « maintenu par la communauté »' })
  maintained(
    @Staff() staff: StaffUser,
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Body(zodPipe(adminGuideMaintainedSchema)) body: z.infer<typeof adminGuideMaintainedSchema>,
  ) {
    return this.guides.setMaintained(staff, id, body);
  }
}
