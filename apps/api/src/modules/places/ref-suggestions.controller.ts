import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { newId } from '@app/db';
import { ApiError } from '../../common/api-error';
import { Auth, type AuthContext } from '../../common/auth.guard';
import { AuditService } from '../../common/audit.service';
import { RateLimit, RequiresCapability } from '../../common/capability.decorator';
import { PrismaService } from '../../common/prisma.service';
import { zodPipe } from '../../common/zod.pipe';

/** 02 §4.1 : `POST /ref/suggestions` — suggestion libre (`kind`, `label`), 5 par jour et par membre. */
export const REF_SUGGESTIONS_PER_DAY = 5;

export const refSuggestionSchema = z
  .object({
    kind: z.enum(['COUNTRY', 'CITY', 'LANGUAGE', 'SKILL', 'PROFESSION']),
    label: z.string().trim().min(2).max(120),
  })
  .strict();

export type RefSuggestion = z.infer<typeof refSuggestionSchema>;

const KIND_LABELS: Record<RefSuggestion['kind'], string> = {
  COUNTRY: 'un pays',
  CITY: 'une ville',
  LANGUAGE: 'une langue',
  SKILL: 'une compétence',
  PROFESSION: 'un métier',
};

@ApiTags('places')
@Controller('ref')
export class RefSuggestionsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Post('suggestions')
  @HttpCode(201)
  @RequiresCapability('content.read')
  @RateLimit(20, 'hour')
  @ApiOperation({ summary: 'Suggère un pays, une ville, une langue, une compétence ou un métier à l’équipe (5/jour)' })
  async suggest(
    @Auth() auth: AuthContext,
    @Body(zodPipe(refSuggestionSchema)) body: RefSuggestion,
  ): Promise<{ id: string; remainingToday: number }> {
    const id = newId();
    const since = new Date(Date.now() - 24 * 3_600_000);

    await this.prisma.$transaction(async (tx) => {
      // Quota PERSISTANT (il survit à un redémarrage de Redis) : compté sur le journal d'audit.
      const used = await tx.auditLog.count({
        where: { action: 'ref.suggestion', actorType: 'MEMBER', actorId: auth.userId, createdAt: { gte: since } },
      });
      if (used >= REF_SUGGESTIONS_PER_DAY) {
        throw ApiError.transverse('RATE_LIMITED', { retryAfterSeconds: 3600, reason: 'REF_SUGGESTIONS_DAILY' });
      }
      await this.audit.record(tx, {
        actor: { type: 'MEMBER', id: auth.userId },
        action: 'ref.suggestion',
        targetType: 'ref_suggestion',
        targetId: id,
        metadata: { kind: body.kind, label: body.label },
      });
      const team = await tx.staffUser.findMany({
        where: { isActive: true, role: { in: ['CONTENT_ADMIN', 'SUPER_ADMIN'] } },
        select: { id: true },
      });
      if (team.length > 0) {
        await tx.staffAlert.createMany({
          data: team.map((st) => ({
            id: newId(),
            staffId: st.id,
            kind: 'REF_SUGGESTION',
            title: `Suggestion de ${KIND_LABELS[body.kind]}`,
            body: body.label,
            refType: 'ref_suggestion',
            refId: id,
          })),
          skipDuplicates: true,
        });
      }
    });

    const used = await this.prisma.auditLog.count({
      where: { action: 'ref.suggestion', actorType: 'MEMBER', actorId: auth.userId, createdAt: { gte: since } },
    });
    return { id, remainingToday: Math.max(0, REF_SUGGESTIONS_PER_DAY - used) };
  }
}
