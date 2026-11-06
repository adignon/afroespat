import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  STAFF_SCOPES,
  adminContentActionSchema,
  adminContentQuerySchema,
  adminContentTypeSchema,
  adminContentUpdateSchema,
  uuidSchema,
} from '@app/shared';
import type { z } from 'zod';
import { RequiresStaffRole } from '../../common/staff-role.decorator';
import { Staff, type StaffUser } from '../../common/staff.guard';
import { zodPipe } from '../../common/zod.pipe';
import { AdminContentsEditService } from './admin-contents-edit.service';
import { AdminContentsService } from './admin-contents.service';

/**
 * Les contenus des membres, gérés directement par l'administration (15 §4) : liste filtrable, retrait (logique,
 * réversible), rétablissement, suppression définitive. Chaque geste demande un motif et est tracé.
 */
@ApiTags('admin')
@Controller('admin/contents')
export class AdminContentsController {
  constructor(
    private readonly contents: AdminContentsService,
    private readonly edition: AdminContentsEditService,
  ) {}

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
  @Get(':type/:id')
  @RequiresStaffRole(...STAFF_SCOPES.content)
  @ApiOperation({ summary: 'Les valeurs modifiables d’un contenu (formulaire de correction)' })
  detail(
    @Param('type', zodPipe(adminContentTypeSchema)) type: z.infer<typeof adminContentTypeSchema>,
    @Param('id', zodPipe(uuidSchema)) id: string,
  ) {
    return this.edition.detail(type, id);
  }

  @Patch(':type/:id')
  @RequiresStaffRole(...STAFF_SCOPES.content)
  @ApiOperation({ summary: 'Corrige un contenu (titre, texte, état…) ; motif obligatoire, tracé' })
  update(
    @Staff() staff: StaffUser,
    @Param('type', zodPipe(adminContentTypeSchema)) type: z.infer<typeof adminContentTypeSchema>,
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Body(zodPipe(adminContentUpdateSchema)) body: z.infer<typeof adminContentUpdateSchema>,
  ) {
    return this.edition.update(staff, type, id, body);
  }
}
