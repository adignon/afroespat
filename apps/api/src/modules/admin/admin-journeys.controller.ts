import { Body, Controller, Get, HttpCode, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  STAFF_SCOPES,
  correctionDecisionSchema,
  correctionQuerySchema,
  cursorQuerySchema,
  stepDefinitionUpdateSchema,
  stepDefinitionWriteSchema,
  templateUpdateSchema,
  templateWriteSchema,
  uuidSchema,
  versionCreateSchema,
  versionPublishSchema,
  versionStepsSchema,
} from '@app/shared';
import type { z } from 'zod';
import { RequiresStaffRole } from '../../common/staff-role.decorator';
import { Staff, type StaffUser } from '../../common/staff.guard';
import { zodPipe } from '../../common/zod.pipe';
import { AdminJourneysService } from './admin-journeys.service';

/**
 * `/v1/admin/journey-templates/*` — 03 §5.2, rôle `CONTENT_ADMIN` (et SUPER_ADMIN).
 * Lecture : les quatre rôles voient les modèles, deux les modifient.
 */
@ApiTags('admin')
@Controller('admin/journey-templates')
export class AdminJourneysController {
  constructor(private readonly journeys: AdminJourneysService) {}

  @Get('templates')
  @RequiresStaffRole(...STAFF_SCOPES.dashboard)
  @ApiOperation({ summary: 'Les types de parcours et leurs versions' })
  templates() {
    return this.journeys.listTemplates();
  }

  @Post('templates')
  @RequiresStaffRole(...STAFF_SCOPES.content)
  @ApiOperation({ summary: 'Crée un type de parcours' })
  createTemplate(@Staff() staff: StaffUser, @Body(zodPipe(templateWriteSchema)) body: z.infer<typeof templateWriteSchema>) {
    return this.journeys.createTemplate(staff, body);
  }

  @Patch('templates/:id')
  @RequiresStaffRole(...STAFF_SCOPES.content)
  @ApiOperation({ summary: 'Modifie un type de parcours' })
  updateTemplate(
    @Staff() staff: StaffUser,
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Body(zodPipe(templateUpdateSchema)) body: z.infer<typeof templateUpdateSchema>,
  ) {
    return this.journeys.updateTemplate(staff, id, body);
  }

  @Post('templates/:id/versions')
  @RequiresStaffRole(...STAFF_SCOPES.content)
  @ApiOperation({ summary: 'Nouveau brouillon (copie de la version publiée ou vide)' })
  createVersion(
    @Staff() staff: StaffUser,
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Body(zodPipe(versionCreateSchema)) body: z.infer<typeof versionCreateSchema>,
  ) {
    return this.journeys.createVersion(staff, id, body);
  }

  @Get('step-definitions')
  @RequiresStaffRole(...STAFF_SCOPES.dashboard)
  @ApiOperation({ summary: 'La bibliothèque d’étapes' })
  stepDefinitions(@Query(zodPipe(cursorQuerySchema)) query: z.infer<typeof cursorQuerySchema>) {
    return this.journeys.listStepDefinitions(query);
  }

  @Post('step-definitions')
  @RequiresStaffRole(...STAFF_SCOPES.content)
  @ApiOperation({ summary: 'Crée une définition d’étape' })
  createStepDefinition(
    @Staff() staff: StaffUser,
    @Body(zodPipe(stepDefinitionWriteSchema)) body: z.infer<typeof stepDefinitionWriteSchema>,
  ) {
    return this.journeys.createStepDefinition(staff, body);
  }

  @Patch('step-definitions/:id')
  @RequiresStaffRole(...STAFF_SCOPES.content)
  @ApiOperation({ summary: 'Modifie une définition d’étape' })
  updateStepDefinition(
    @Staff() staff: StaffUser,
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Body(zodPipe(stepDefinitionUpdateSchema)) body: z.infer<typeof stepDefinitionUpdateSchema>,
  ) {
    return this.journeys.updateStepDefinition(staff, id, body);
  }

  @Get('versions/:id')
  @RequiresStaffRole(...STAFF_SCOPES.dashboard)
  @ApiOperation({ summary: 'Une version : composition et dépendances' })
  version(@Param('id', zodPipe(uuidSchema)) id: string) {
    return this.journeys.getVersion(id);
  }

  @Put('versions/:id/steps')
  @RequiresStaffRole(...STAFF_SCOPES.content)
  @ApiOperation({ summary: 'Composition ordonnée + dépendances + décalages d’un brouillon' })
  putSteps(
    @Staff() staff: StaffUser,
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Body(zodPipe(versionStepsSchema)) body: z.infer<typeof versionStepsSchema>,
  ) {
    return this.journeys.putSteps(staff, id, body);
  }

  @Get('versions/:id/preview')
  @RequiresStaffRole(...STAFF_SCOPES.dashboard)
  @ApiOperation({ summary: 'Rendu tel que vu par un membre' })
  preview(@Param('id', zodPipe(uuidSchema)) id: string) {
    return this.journeys.preview(id);
  }

  @Post('versions/:id/publish')
  @HttpCode(200)
  @RequiresStaffRole(...STAFF_SCOPES.content)
  @ApiOperation({ summary: 'Publie : au moins une étape, pas de cycle ; archive la précédente' })
  publish(
    @Staff() staff: StaffUser,
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Body(zodPipe(versionPublishSchema)) body: z.infer<typeof versionPublishSchema>,
  ) {
    return this.journeys.publish(staff, id, body);
  }

  @Post('versions/:id/archive')
  @HttpCode(200)
  @RequiresStaffRole(...STAFF_SCOPES.content)
  @ApiOperation({ summary: 'Archive une version' })
  archive(@Staff() staff: StaffUser, @Param('id', zodPipe(uuidSchema)) id: string) {
    return this.journeys.archive(staff, id);
  }

  @Get('correction-proposals')
  @RequiresStaffRole(...STAFF_SCOPES.dashboard)
  @ApiOperation({ summary: 'File des corrections proposées par les membres' })
  corrections(@Query(zodPipe(correctionQuerySchema)) query: z.infer<typeof correctionQuerySchema>) {
    return this.journeys.listCorrections(query);
  }

  @Post('correction-proposals/:id')
  @HttpCode(200)
  @RequiresStaffRole(...STAFF_SCOPES.content)
  @ApiOperation({ summary: 'Accepte ou rejette (avec motif) une correction proposée' })
  decide(
    @Staff() staff: StaffUser,
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Body(zodPipe(correctionDecisionSchema)) body: z.infer<typeof correctionDecisionSchema>,
  ) {
    return this.journeys.decideCorrection(staff, id, body);
  }
}
