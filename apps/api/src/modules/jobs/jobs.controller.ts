import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  createJobSchema,
  createMemberRecommendationSchema,
  handleSchema,
  jobSeekerProfileSchema,
  jobSeekersQuerySchema,
  jobsQuerySchema,
  updateJobSchema,
  uuidSchema,
} from '@app/shared';
import type { z } from 'zod';
import { Auth, type AuthContext, MaybeAuth } from '../../common/auth.guard';
import { PublicRead, RateLimit, RequiresCapability } from '../../common/capability.decorator';
import { zodPipe } from '../../common/zod.pipe';
import { JobsService } from './jobs.service';

/**
 * Emploi — 10-services.md §6.2.
 *
 * Les OFFRES déclarent `job.publish` (L1), la capacité que la matrice du §7.3 nomme
 * pour l'emploi. Elle porte `planLimit: 'sponsoredJobsPerMonth'`, ce qui ne rend pas
 * la publication payante — elle est gratuite (§3.1) — mais autorise le service à lire
 * `users.plan` pour la seule MISE EN AVANT. La règle dure 14 §2 le permet : l'emploi
 * ne fait pas partie des surfaces qui ne sont jamais payantes.
 *
 * Le PROFIL de recherche et la RECOMMANDATION d'un membre déclarent `post.create`
 * (L1, `planLimit: null`) : ce sont des publications, donc L1, mais rien ne doit
 * pouvoir les conditionner à un plan un jour — chercher du travail et recommander
 * quelqu'un ne se vend pas. La matrice est une SOURCE UNIQUE qu'un module ne complète
 * pas : on choisit dans ce qu'elle offre plutôt que d'y ajouter une entrée.
 */
@ApiTags('jobs')
@Controller()
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  // ── Lecture ───────────────────────────────────────────────────────────────

  /**
   * Déclarée AVANT `jobs/:id` : sans cela Nest fait correspondre « job-seekers » au
   * paramètre `:id`, et la route répondrait 400 sur un UUID invalide.
   */
  @Get('job-seekers')
  @PublicRead()
  @ApiOperation({ summary: 'Profils disponibles, filtrables par ville et secteur' })
  async jobSeekers(
    @Query(zodPipe(jobSeekersQuerySchema)) query: z.infer<typeof jobSeekersQuerySchema>,
    @MaybeAuth() viewer: AuthContext | null,
  ) {
    return this.jobs.listJobSeekers(query, viewer?.userId ?? null);
  }

  @Get('me/job-seeker-profile')
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Mon profil de recherche, ou null' })
  async myJobSeekerProfile(@Auth() auth: AuthContext) {
    return this.jobs.myJobSeekerProfile(auth.userId);
  }

  @Get('jobs')
  @PublicRead()
  @ApiOperation({ summary: 'Offres — au plus 2 sponsorisées en tête, pastille comprise' })
  async list(
    @Query(zodPipe(jobsQuerySchema)) query: z.infer<typeof jobsQuerySchema>,
    @MaybeAuth() viewer: AuthContext | null,
  ) {
    return this.jobs.list(query, viewer?.userId ?? null);
  }

  @Get('jobs/:id')
  @PublicRead()
  @ApiOperation({ summary: 'Une offre' })
  async detail(
    @Param('id', zodPipe(uuidSchema)) id: string,
    @MaybeAuth() viewer: AuthContext | null,
  ) {
    return this.jobs.detail(id, viewer?.userId ?? null);
  }

  @Get('users/:handle/recommendations')
  @PublicRead()
  @ApiOperation({ summary: '« Recommandé·e par N membres » sur le profil d’un membre' })
  async recommendations(
    @Param('handle', zodPipe(handleSchema)) handle: string,
    @MaybeAuth() viewer: AuthContext | null,
  ) {
    return this.jobs.recommendationsFor(handle, viewer?.userId ?? null);
  }

  // ── Écriture ──────────────────────────────────────────────────────────────

  @Post('jobs')
  @RequiresCapability('job.publish')
  @RateLimit(10)
  @ApiOperation({ summary: 'Publie une offre (L1, gratuit)' })
  async create(
    @Auth() auth: AuthContext,
    @Body(zodPipe(createJobSchema)) body: z.infer<typeof createJobSchema>,
  ) {
    return this.jobs.create(auth.userId, body);
  }

  @Patch('jobs/:id')
  @RequiresCapability('job.publish')
  @RateLimit(20)
  @ApiOperation({ summary: 'Modifie une offre' })
  async update(
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Auth() auth: AuthContext,
    @Body(zodPipe(updateJobSchema)) body: z.infer<typeof updateJobSchema>,
  ) {
    return this.jobs.update(id, auth.userId, body);
  }

  @Delete('jobs/:id')
  @RequiresCapability('job.publish')
  @ApiOperation({ summary: 'Retire une offre' })
  async remove(@Param('id', zodPipe(uuidSchema)) id: string, @Auth() auth: AuthContext) {
    return this.jobs.remove(id, auth.userId);
  }

  @Post('jobs/:id/renew')
  @RequiresCapability('job.publish')
  @ApiOperation({ summary: 'Repousse l’expiration de 45 jours' })
  async renew(@Param('id', zodPipe(uuidSchema)) id: string, @Auth() auth: AuthContext) {
    return this.jobs.renew(id, auth.userId);
  }

  @Post('jobs/:id/sponsor')
  @RequiresCapability('job.publish')
  @RateLimit(10)
  @ApiOperation({ summary: 'Met en avant 14 jours (Premium, 5 par mois)' })
  async sponsor(@Param('id', zodPipe(uuidSchema)) id: string, @Auth() auth: AuthContext) {
    return this.jobs.sponsor(id, auth.userId);
  }

  /**
   * `post.create` et non `job.publish` : un profil de recherche est une publication
   * visible par d'autres (donc L1), mais `job.publish` porte le quota de mise en avant,
   * et rien ici ne doit pouvoir devenir payant. `post.create` est la capacité L1 sans
   * quota de la matrice.
   */
  @Put('me/job-seeker-profile')
  @RequiresCapability('post.create')
  @ApiOperation({ summary: 'Crée ou remplace mon profil de recherche' })
  async putJobSeekerProfile(
    @Auth() auth: AuthContext,
    @Body(zodPipe(jobSeekerProfileSchema)) body: z.infer<typeof jobSeekerProfileSchema>,
  ) {
    return this.jobs.putJobSeekerProfile(auth.userId, body);
  }

  @Delete('me/job-seeker-profile')
  @RequiresCapability('post.create')
  @ApiOperation({ summary: 'Retire mon profil de recherche' })
  async deleteJobSeekerProfile(@Auth() auth: AuthContext) {
    return this.jobs.deleteJobSeekerProfile(auth.userId);
  }

  @Post('recommendations/members')
  @RequiresCapability('post.create')
  @RateLimit(20)
  @ApiOperation({ summary: 'Recommande un membre, pour une offre ou en général' })
  async recommendMember(
    @Auth() auth: AuthContext,
    @Body(zodPipe(createMemberRecommendationSchema))
    body: z.infer<typeof createMemberRecommendationSchema>,
  ) {
    return this.jobs.recommendMember(auth.userId, body);
  }
}
