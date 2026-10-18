import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { STAFF_SCOPES, memberDeleteNowSchema, memberNoteSchema, memberReasonSchema, uuidSchema } from '@app/shared';
import type { z } from 'zod';
import { RequiresStaffRole } from '../../common/staff-role.decorator';
import { Staff, type StaffUser } from '../../common/staff.guard';
import { zodPipe } from '../../common/zod.pipe';
import { AdminMemberActionsService } from './admin-member-actions.service';

/** Les actions de la fiche membre que `AdminController` ne portait pas — 15 §3.2 et §7. */
@ApiTags('admin')
@Controller('admin/users')
export class AdminMemberController {
  constructor(private readonly actions: AdminMemberActionsService) {}

  @Get(':id/notes')
  @RequiresStaffRole(...STAFF_SCOPES.memberRead)
  @ApiOperation({ summary: 'Les notes internes d’un membre (équipe seulement)' })
  notes(@Param('id', zodPipe(uuidSchema)) id: string) {
    return this.actions.listNotes(id);
  }

  @Post(':id/note')
  @RequiresStaffRole(...STAFF_SCOPES.memberRead)
  @ApiOperation({ summary: 'Ajoute une note interne — tous les rôles, journalisée' })
  note(
    @Staff() staff: StaffUser,
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Body(zodPipe(memberNoteSchema)) body: z.infer<typeof memberNoteSchema>,
  ) {
    return this.actions.addNote(staff, id, body);
  }

  @Post(':id/delete-now')
  @HttpCode(200)
  @RequiresStaffRole(...STAFF_SCOPES.rgpd)
  @ApiOperation({ summary: 'Suppression immédiate sur demande écrite du membre (saute les 7 jours)' })
  deleteNow(
    @Staff() staff: StaffUser,
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Body(zodPipe(memberDeleteNowSchema)) body: z.infer<typeof memberDeleteNowSchema>,
  ) {
    return this.actions.deleteNow(staff, id, body);
  }

  @Post(':id/export')
  @HttpCode(202)
  @RequiresStaffRole(...STAFF_SCOPES.rgpd)
  @ApiOperation({ summary: 'Génère l’export RGPD du membre, sans le quota de 30 jours' })
  export(
    @Staff() staff: StaffUser,
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Body(zodPipe(memberReasonSchema)) body: z.infer<typeof memberReasonSchema>,
  ) {
    return this.actions.generateExport(staff, id, body);
  }
}
