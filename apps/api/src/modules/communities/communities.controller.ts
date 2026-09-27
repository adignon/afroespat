import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  addAlbumPhotoSchema,
  communityListQuerySchema,
  createAlbumSchema,
  createAnnouncementSchema,
  createCommunitySchema,
  createPollSchema,
  createTopicSchema,
  cursorQuerySchema,
  inviteMembersSchema,
  memberListQuerySchema,
  pollVoteSchema,
  topicListQuerySchema,
  transferCommunitySchema,
  updateCommunitySchema,
  updateMemberSchema,
  updateTopicSchema,
  uuidSchema,
} from '@app/shared';
import { z } from 'zod';
import { Auth, type AuthContext } from '../../common/auth.guard';
import { RequiresCapability } from '../../common/capability.decorator';
import { zodPipe } from '../../common/zod.pipe';
import { CommunitiesService } from './communities.service';

/**
 * Réseaux — 07-reseaux.md §4.
 *
 * AUCUNE route n'est `@PublicRead()`, contrairement au fil ou aux guides. §2.3
 * réserve le contenu d'un réseau à ses membres — fil, sujets et événements —, et
 * la règle dure du §9 va plus loin pour `INVITE_ONLY` : « jamais renvoyé à un
 * non-membre ni indexé pour lui ». Une lecture ouverte, même filtrée ensuite,
 * serait une porte à refermer à chaque nouvelle route.
 *
 * Les capacités employées viennent toutes de la matrice existante (00 §7.3) :
 *   · `community.create` (L1) pour créer un réseau — la capacité est nommée pour ça ;
 *   · `post.create` (L1) pour publier DANS un réseau — sujet, annonce, sondage,
 *     album, photo. §2.3 dit « L1 pour publier », et cette capacité est la porte
 *     L1 de la publication. Un `community.publish` distinct serait plus juste,
 *     mais il faudrait l'ajouter à la matrice du module 00 ;
 *   · `content.read` (L0) pour tout le reste, y compris rejoindre, quitter,
 *     voter, modérer. Rejoindre le réseau de sa ville ne doit rien exiger, et un
 *     modérateur bénévole n'est pas nécessairement vérifié L1.
 *
 * NOTE SUR `user.onboarded_location` (§6) : l'événement est déclaré dans
 * `DomainEventType` mais AUCUN service ne l'émet aujourd'hui — pas même
 * `UsersService.advanceOnboarding`, qui n'émet que `user.onboarded` au dernier
 * écran. Et rien ne consomme encore la file `events` : le relais y dépose les
 * messages, aucun processeur ne les lit. L'adhésion automatique est donc branchée
 * là où elle marche aujourd'hui — `CommunitiesService.syncAutoMemberships()`,
 * appelée par `GET /communities` — et elle reste prête à être branchée sur
 * l'événement le jour où il existera, puisqu'elle est idempotente.
 */
@ApiTags('communities')
@Controller()
export class CommunitiesController {
  constructor(private readonly communities: CommunitiesService) {}

  // ── Découverte et fiche ───────────────────────────────────────────────────

  @Get('communities')
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Mes réseaux, la découverte, et l’état du bouton « Créer »' })
  async list(
    @Auth() auth: AuthContext,
    @Query(zodPipe(communityListQuerySchema)) query: z.infer<typeof communityListQuerySchema>,
  ) {
    return this.communities.list(auth.userId, query);
  }

  @Post('communities')
  @HttpCode(201)
  @RequiresCapability('community.create')
  @ApiOperation({ summary: 'Créer un réseau d’intérêt (5 invitations minimum)' })
  async create(
    @Auth() auth: AuthContext,
    @Body(zodPipe(createCommunitySchema)) body: z.infer<typeof createCommunitySchema>,
  ) {
    return this.communities.create(auth.userId, body);
  }

  /**
   * `:slug` accepte aussi un identifiant : §4 emploie `:slug` pour la fiche et
   * `:id` pour tout le reste, et obliger le front à jongler entre les deux pour
   * un même réseau n'apporterait rien.
   */
  @Get('communities/:slug')
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'En-tête, mon rôle, compteurs, épinglés' })
  async detail(@Auth() auth: AuthContext, @Param('slug') slug: string) {
    return this.communities.detail(slug, auth.userId);
  }

  @Patch('communities/:id')
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Modifier le réseau (propriétaire)' })
  async update(
    @Auth() auth: AuthContext,
    @Param('id') id: string,
    @Body(zodPipe(updateCommunitySchema)) body: z.infer<typeof updateCommunitySchema>,
  ) {
    return this.communities.update(id, auth.userId, body);
  }

  // ── Adhésion ──────────────────────────────────────────────────────────────

  /**
   * `@HttpCode(200)` et non le 201 par défaut de Nest : rejoindre est IDEMPOTENT
   * (rejoindre deux fois rend le même état) et ne crée aucune ressource
   * adressable. Un 201 annoncerait au client une création qui n'a pas eu lieu.
   */
  @Post('communities/:id/join')
  @HttpCode(200)
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Rejoindre — ou demander à rejoindre si ON_REQUEST' })
  async join(@Auth() auth: AuthContext, @Param('id') id: string) {
    return this.communities.join(id, auth.userId);
  }

  @Post('communities/:id/leave')
  @HttpCode(204)
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Quitter — impossible sur un réseau de ville ou de pays' })
  async leave(@Auth() auth: AuthContext, @Param('id') id: string): Promise<void> {
    await this.communities.leave(id, auth.userId);
  }

  @Post('communities/:id/invite')
  @HttpCode(200)
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Inviter des membres par handle' })
  async invite(
    @Auth() auth: AuthContext,
    @Param('id') id: string,
    @Body(zodPipe(inviteMembersSchema)) body: z.infer<typeof inviteMembersSchema>,
  ) {
    return this.communities.invite(id, auth.userId, body);
  }

  @Post('communities/:id/requests/:userId/accept')
  @HttpCode(200)
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Accepter une demande d’adhésion' })
  async acceptRequest(
    @Auth() auth: AuthContext,
    @Param('id') id: string,
    @Param('userId', zodPipe(uuidSchema)) userId: string,
  ) {
    return this.communities.decideRequest(id, auth.userId, userId, 'accept');
  }

  @Post('communities/:id/requests/:userId/reject')
  @HttpCode(200)
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Refuser une demande d’adhésion' })
  async rejectRequest(
    @Auth() auth: AuthContext,
    @Param('id') id: string,
    @Param('userId', zodPipe(uuidSchema)) userId: string,
  ) {
    return this.communities.decideRequest(id, auth.userId, userId, 'reject');
  }

  // ── Membres ───────────────────────────────────────────────────────────────

  @Get('communities/:id/members')
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Membres : rôle, phase, ville ; recherche par handle' })
  async members(
    @Auth() auth: AuthContext,
    @Param('id') id: string,
    @Query(zodPipe(memberListQuerySchema)) query: z.infer<typeof memberListQuerySchema>,
  ) {
    return this.communities.members(id, auth.userId, query);
  }

  @Patch('communities/:id/members/:userId')
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Rôle ou bannissement (propriétaire, modérateur)' })
  async updateMember(
    @Auth() auth: AuthContext,
    @Param('id') id: string,
    @Param('userId', zodPipe(uuidSchema)) userId: string,
    @Body(zodPipe(updateMemberSchema)) body: z.infer<typeof updateMemberSchema>,
  ) {
    return this.communities.updateMember(id, auth.userId, userId, body);
  }

  @Post('communities/:id/transfer')
  @HttpCode(200)
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Transférer la propriété' })
  async transfer(
    @Auth() auth: AuthContext,
    @Param('id') id: string,
    @Body(zodPipe(transferCommunitySchema)) body: z.infer<typeof transferCommunitySchema>,
  ) {
    return this.communities.transfer(id, auth.userId, body.toUserId);
  }

  // ── Contenu ───────────────────────────────────────────────────────────────

  @Get('communities/:id/feed')
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Le fil du réseau' })
  async feed(
    @Auth() auth: AuthContext,
    @Param('id') id: string,
    @Query(zodPipe(cursorQuerySchema)) query: z.infer<typeof cursorQuerySchema>,
  ) {
    return this.communities.feed(id, auth.userId, query);
  }

  @Get('communities/:id/topics')
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Sujets du réseau ; épinglés dans `meta.pinned`' })
  async topics(
    @Auth() auth: AuthContext,
    @Param('id') id: string,
    @Query(zodPipe(topicListQuerySchema)) query: z.infer<typeof topicListQuerySchema>,
  ) {
    return this.communities.topics(id, auth.userId, query);
  }

  @Post('communities/:id/topics')
  @HttpCode(201)
  @RequiresCapability('post.create')
  @ApiOperation({ summary: 'Ouvrir un sujet (titre 10–120)' })
  async createTopic(
    @Auth() auth: AuthContext,
    @Param('id') id: string,
    @Body(zodPipe(createTopicSchema)) body: z.infer<typeof createTopicSchema>,
  ) {
    return this.communities.createTopic(id, auth.userId, body);
  }

  @Get('topics/:id')
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Un sujet et ses réponses' })
  async topic(@Auth() auth: AuthContext, @Param('id', zodPipe(uuidSchema)) id: string) {
    return this.communities.topic(id, auth.userId);
  }

  @Patch('topics/:id')
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Résolu (auteur), épinglé (modérateur), titre/corps (15 min)' })
  async updateTopic(
    @Auth() auth: AuthContext,
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Body(zodPipe(updateTopicSchema)) body: z.infer<typeof updateTopicSchema>,
  ) {
    return this.communities.updateTopic(id, auth.userId, body);
  }

  /** §2.4 : « masquer une publication ou un sujet du réseau ». */
  @Delete('topics/:id')
  @HttpCode(204)
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Masquer un sujet (auteur ou modérateur)' })
  async deleteTopic(
    @Auth() auth: AuthContext,
    @Param('id', zodPipe(uuidSchema)) id: string,
  ): Promise<void> {
    await this.communities.deleteTopic(id, auth.userId);
  }

  // ── Annonces ──────────────────────────────────────────────────────────────

  @Get('communities/:id/announcements')
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Annonces du réseau' })
  async announcements(
    @Auth() auth: AuthContext,
    @Param('id') id: string,
    @Query(zodPipe(cursorQuerySchema)) query: z.infer<typeof cursorQuerySchema>,
  ) {
    return this.communities.announcements(id, auth.userId, query);
  }

  @Post('communities/:id/announcements')
  @HttpCode(201)
  @RequiresCapability('post.create')
  @ApiOperation({ summary: 'Publier une annonce (2 par semaine maximum)' })
  async createAnnouncement(
    @Auth() auth: AuthContext,
    @Param('id') id: string,
    @Body(zodPipe(createAnnouncementSchema)) body: z.infer<typeof createAnnouncementSchema>,
  ) {
    return this.communities.createAnnouncement(id, auth.userId, body.body);
  }

  // ── Sondages ──────────────────────────────────────────────────────────────

  @Get('communities/:id/polls')
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Sondages ; résultats masqués avant vote ou clôture' })
  async polls(
    @Auth() auth: AuthContext,
    @Param('id') id: string,
    @Query(zodPipe(cursorQuerySchema)) query: z.infer<typeof cursorQuerySchema>,
  ) {
    return this.communities.polls(id, auth.userId, query);
  }

  @Post('communities/:id/polls')
  @HttpCode(201)
  @RequiresCapability('post.create')
  @ApiOperation({ summary: 'Créer un sondage (2 à 8 options)' })
  async createPoll(
    @Auth() auth: AuthContext,
    @Param('id') id: string,
    @Body(zodPipe(createPollSchema)) body: z.infer<typeof createPollSchema>,
  ) {
    return this.communities.createPoll(id, auth.userId, body);
  }

  @Post('polls/:id/vote')
  @HttpCode(200)
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Voter — modifiable jusqu’à la clôture' })
  async vote(
    @Auth() auth: AuthContext,
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Body(zodPipe(pollVoteSchema)) body: z.infer<typeof pollVoteSchema>,
  ) {
    return this.communities.vote(id, auth.userId, body.optionIds);
  }

  @Post('polls/:id/close')
  @HttpCode(200)
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Clore un sondage (auteur ou modérateur)' })
  async closePoll(@Auth() auth: AuthContext, @Param('id', zodPipe(uuidSchema)) id: string) {
    return this.communities.closePoll(id, auth.userId);
  }

  // ── Albums ────────────────────────────────────────────────────────────────

  @Get('communities/:id/albums')
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Albums du réseau et leurs photos' })
  async albums(@Auth() auth: AuthContext, @Param('id') id: string) {
    return this.communities.albums(id, auth.userId);
  }

  @Post('communities/:id/albums')
  @HttpCode(201)
  @RequiresCapability('post.create')
  @ApiOperation({ summary: 'Créer un album, lié ou non à un événement' })
  async createAlbum(
    @Auth() auth: AuthContext,
    @Param('id') id: string,
    @Body(zodPipe(createAlbumSchema)) body: z.infer<typeof createAlbumSchema>,
  ) {
    return this.communities.createAlbum(id, auth.userId, body);
  }

  @Post('albums/:id/photos')
  @HttpCode(201)
  @RequiresCapability('post.create')
  @ApiOperation({ summary: 'Ajouter une photo à un album' })
  async addPhoto(
    @Auth() auth: AuthContext,
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Body(zodPipe(addAlbumPhotoSchema)) body: z.infer<typeof addAlbumPhotoSchema>,
  ) {
    return this.communities.addPhoto(id, auth.userId, body);
  }

  @Delete('albums/:id/photos/:photoId')
  @HttpCode(204)
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Retirer une photo (celui qui l’a posée, ou un modérateur)' })
  async deletePhoto(
    @Auth() auth: AuthContext,
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Param('photoId', zodPipe(uuidSchema)) photoId: string,
  ): Promise<void> {
    await this.communities.deletePhoto(id, photoId, auth.userId);
  }

  // ── Carte et réactivation ─────────────────────────────────────────────────

  @Get('communities/:id/map')
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Compteurs par ville des membres du réseau' })
  async map(@Auth() auth: AuthContext, @Param('id') id: string) {
    return this.communities.map(id, auth.userId);
  }

  @Post('communities/:id/reactivate')
  @HttpCode(200)
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Réactiver un réseau archivé (propriétaire)' })
  async reactivate(@Auth() auth: AuthContext, @Param('id') id: string) {
    return this.communities.reactivate(id, auth.userId);
  }
}
