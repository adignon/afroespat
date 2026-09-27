import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  createMentorshipSchema,
  handleSchema,
  mentorProfileSchema,
  mentorshipReviewSchema,
  mentorsQuerySchema,
  myMentorshipsQuerySchema,
  uuidSchema,
} from '@app/shared';
import type { z } from 'zod';
import { Auth, type AuthContext, MaybeAuth } from '../../common/auth.guard';
import { PublicRead, RateLimit, RequiresCapability } from '../../common/capability.decorator';
import { zodPipe } from '../../common/zod.pipe';
import { MentorshipService } from './mentorship.service';

/**
 * Parrainage — 08-parrainage-messagerie.md §7.1.
 *
 * Les LECTURES de la liste et de la fiche sont `@PublicRead()` : un pré-départ qui
 * hésite à s'inscrire doit pouvoir voir qu'il y a des parrains dans sa ville cible.
 * Le service applique la visibilité de toute façon (§4, membre bloqué → 404), avec
 * ou sans jeton.
 *
 * Les ÉCRITURES déclarent leur capacité (00 §7.3), et l'ASYMÉTRIE est la règle du
 * module : `mentor.become` est L2 — devenir parrain suppose d'être sur le
 * territoire — tandis que `mentorship.request` est L0, parce que « le pré-départ
 * doit pouvoir demander avant l'avion » (§2.2). Inverser les deux viderait le
 * parrainage de sa raison d'être.
 *
 * Les routes d'acceptation, de fin, de prolongation et d'évaluation portent
 * `mentorship.request` (L0) : ce sont les suites d'une relation déjà nouée, et un
 * filleul L0 doit pouvoir terminer ou évaluer son parrainage. Exiger L1 pour
 * clore une relation qu'on a pu ouvrir en L0 enfermerait le membre dedans.
 */
@ApiTags('mentorship')
@Controller()
export class MentorshipController {
  constructor(private readonly mentorship: MentorshipService) {}

  // ── Lecture ───────────────────────────────────────────────────────────────

  @Get('mentors')
  @PublicRead()
  @ApiOperation({ summary: 'Parrains filtrables (ville, langue, type de parcours, pays)' })
  async listMentors(
    @Query(zodPipe(mentorsQuerySchema)) query: z.infer<typeof mentorsQuerySchema>,
    @MaybeAuth() viewer: AuthContext | null,
  ) {
    return this.mentorship.listMentors(query, viewer?.userId ?? null);
  }

  @Get('mentors/:handle')
  @PublicRead()
  @ApiOperation({ summary: 'Fiche parrain, évaluations visibles (§2.4)' })
  async mentorCard(
    @Param('handle', zodPipe(handleSchema)) handle: string,
    @MaybeAuth() viewer: AuthContext | null,
  ) {
    return this.mentorship.mentorCard(handle, viewer?.userId ?? null);
  }

  @Get('me/mentorships')
  @RequiresCapability('mentorship.request')
  @ApiOperation({ summary: 'Mes parrainages, comme parrain et comme filleul' })
  async myMentorships(
    @Auth() auth: AuthContext,
    @Query(zodPipe(myMentorshipsQuerySchema)) query: z.infer<typeof myMentorshipsQuerySchema>,
  ) {
    return this.mentorship.myMentorships(auth.userId, query);
  }

  // ── Profil de parrain ─────────────────────────────────────────────────────

  @Put('me/mentor-profile')
  @RequiresCapability('mentor.become')
  @ApiOperation({ summary: 'Devenir parrain (L2, parcours terminé ou installé depuis un an)' })
  async upsertProfile(
    @Auth() auth: AuthContext,
    @Body(zodPipe(mentorProfileSchema)) body: z.infer<typeof mentorProfileSchema>,
  ) {
    return this.mentorship.upsertProfile(auth.userId, body);
  }

  @Delete('me/mentor-profile')
  @HttpCode(204)
  @RequiresCapability('mentor.become')
  @ApiOperation({ summary: 'Cesser d’être parrain — les parrainages en cours continuent (§2.1)' })
  async disableProfile(@Auth() auth: AuthContext): Promise<void> {
    await this.mentorship.disableProfile(auth.userId);
  }

  // ── Cycle de vie d'un parrainage ──────────────────────────────────────────

  @Post('mentorships')
  @HttpCode(201)
  @RequiresCapability('mentorship.request')
  // Une demande par membre à la fois (§2.2) : la limite de débit n'a pas à être
  // large, et `PENDING_REQUEST_EXISTS` la double de toute façon.
  @RateLimit(10)
  @ApiOperation({ summary: 'Demander un parrain, message obligatoire de 50 à 1 000 caractères' })
  async request(
    @Auth() auth: AuthContext,
    @Body(zodPipe(createMentorshipSchema)) body: z.infer<typeof createMentorshipSchema>,
  ) {
    return this.mentorship.request(auth.userId, body);
  }

  @Post('mentorships/:id/accept')
  @RequiresCapability('mentorship.request')
  @ApiOperation({ summary: 'Accepter (parrain) — refusé si max_mentees atteint' })
  async accept(@Param('id', zodPipe(uuidSchema)) id: string, @Auth() auth: AuthContext) {
    return this.mentorship.accept(id, auth.userId);
  }

  @Post('mentorships/:id/decline')
  @RequiresCapability('mentorship.request')
  @ApiOperation({ summary: 'Refuser, sans motif (§2.2)' })
  async decline(@Param('id', zodPipe(uuidSchema)) id: string, @Auth() auth: AuthContext) {
    return this.mentorship.decline(id, auth.userId);
  }

  @Post('mentorships/:id/end')
  @RequiresCapability('mentorship.request')
  @ApiOperation({ summary: 'Terminer — par l’un des deux (§7.1)' })
  async end(@Param('id', zodPipe(uuidSchema)) id: string, @Auth() auth: AuthContext) {
    return this.mentorship.end(id, auth.userId);
  }

  @Post('mentorships/:id/extend')
  @RequiresCapability('mentorship.request')
  @ApiOperation({ summary: 'Prolonger de 90 jours, une seule fois (§2.4)' })
  async extend(@Param('id', zodPipe(uuidSchema)) id: string, @Auth() auth: AuthContext) {
    return this.mentorship.extend(id, auth.userId);
  }

  @Post('mentorships/:id/review')
  @HttpCode(201)
  @RequiresCapability('mentorship.request')
  @ApiOperation({ summary: 'Évaluer, note de 1 à 5, dans les 14 jours suivant la clôture' })
  async review(
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Auth() auth: AuthContext,
    @Body(zodPipe(mentorshipReviewSchema)) body: z.infer<typeof mentorshipReviewSchema>,
  ) {
    return this.mentorship.review(id, auth.userId, body);
  }
}
