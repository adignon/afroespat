import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { STAFF_SCOPES, adminContentActionSchema, adminContentQuerySchema } from '@app/shared';
import type { z } from 'zod';
import { RequiresStaffRole } from '../../common/staff-role.decorator';
import { Staff, type StaffUser } from '../../common/staff.guard';
import { zodPipe } from '../../common/zod.pipe';
import { AdminContentsService } from './admin-contents.service';

/**
 * Les contenus des membres, gérés directement par l'administration (15 §4) : liste filtrable, retrait (logique,
 * réversible), rétablissement, suppression définitive. Chaque geste demande un motif et est tracé.
 */
@ApiTags('admin')
@Controller('admin/contents')
export class AdminContentsController {
  constructor(private readonly contents: AdminContentsService) {}

  @Get()
  @RequiresStaffRole(...STAFF_SCOPES.content)
  @ApiOperation({ summary: 'Liste les contenus d’un type, filtrable (texte, origine de l’auteur, état, dates)' })
  list(@Query(zodPipe(adminContentQuerySchema)) query: z.infer<typeof adminContentQuerySchema>) {
    return this.contents.list(query);
  }

  @Post('remove')
  @HttpCode(200)
  @RequiresStaffRole(...STAFF_SCOPES.content)
  @ApiOperation({ summary: 'Retire des contenus (logique, réversible) ; dryRun = compte seulement' })
  remove(@Staff() staff: StaffUser, @Body(zodPipe(adminContentActionSchema)) body: z.infer<typeof adminContentActionSchema>) {
    return this.contents.retirer(staff, body);
  }

  @Post('restore')
  @HttpCode(200)
  @RequiresStaffRole(...STAFF_SCOPES.content)
  @ApiOperation({ summary: 'Rétablit des contenus retirés' })
  restore(@Staff() staff: StaffUser, @Body(zodPipe(adminContentActionSchema)) body: z.infer<typeof adminContentActionSchema>) {
    return this.contents.retablir(staff, body);
  }

  @Post('erase')
  @HttpCode(200)
  @RequiresStaffRole(...STAFF_SCOPES.erase)
  @ApiOperation({ summary: 'Supprime DÉFINITIVEMENT des contenus (SUPER_ADMIN), confirmé par leur nombre ; dryRun = compte' })
  erase(@Staff() staff: StaffUser, @Body(zodPipe(adminContentActionSchema)) body: z.infer<typeof adminContentActionSchema>) {
    return this.contents.supprimer(staff, body);
  }
}
