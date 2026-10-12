import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  addAlbumPhotoSchema,
  communityListQuerySchema,
  communityReportDecisionSchema,
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
  updateAnnouncementSchema,
  updateCommunitySchema,
  updateMemberSchema,
  updateTopicSchema,
  uuidSchema,
} from '@app/shared';
import { z } from 'zod';
import { Auth, type AuthContext } from '../../common/auth.guard';
import { RateLimit, RequiresCapability } from '../../common/capability.decorator';
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

  // ── Contacter l'équipe du réseau ──────────────────────────────────────────

  /**
   * « Contacter les modérateurs » — les deux boutons de la planche « À propos »
   * (A08T, 1036 px et 390 px) n'avaient aucune route.
   *
   * ⚠ CE N'EST PAS `POST /reports`, ET LA PLANCHE DESSINE LES DEUX CÔTE À CÔTE.
   * « Signaler le réseau » va à l'équipe de la PLATEFORME (13 §8.1), ouvre un
   * `moderation_case`, peut suspendre un compte, et exige `report.create` (L2).
   * Celle-ci ouvre un fil de GROUPE avec les bénévoles d'UN réseau : aucun
   * dossier, aucun pouvoir de sanction, et `content.read` (L0) suffit — demander
   * une règle à l'équipe de son réseau de ville ne doit rien exiger. Les
   * confondre donnerait à une question de voisinage le poids d'une procédure, et
   * enverrait un vrai abus à trois bénévoles au lieu de ceux qui peuvent agir.
   *
   * `content.read` et non `message.send` : la capacité L1 de la messagerie garde
   * l'OUVERTURE d'une conversation DIRECT (§5.2), et le §5.2 autorise justement
   * le L0 à écrire « dans les conversations dont il fait partie ». Ce fil-là est
   * une conversation de groupe, comme JOURNEY et MENTORSHIP, et c'est le même
   * raisonnement que `POST /conversations/:id/messages` — voir l'en-tête de
   * `MessagingController`.
   *
   * ⚠ AUCUN CORPS DE REQUÊTE, contrairement à `POST /conversations/direct` qui
   * exige un `firstMessage`. La maquette ne dessine aucun formulaire : un bouton,
   * et rien d'autre. On ne lui en invente pas un. Le fil naît VIDE — comme naît
   * une conversation de parcours — et le membre écrit dedans ensuite.
   *
   * `@RateLimit(10)` et AUCUN quota journalier : le geste est idempotent par
   * construction (un fil par réseau et par demandeur, tenu par un index unique),
   * donc il n'y a aucune ligne à compter. Le raisonnement complet est sur
   * `CommunitiesService.openModeratorsConversation`.
   */
  @Post('communities/:id/moderators-conversation')
  @HttpCode(201)
  @RequiresCapability('content.read')
  @RateLimit(10)
  @ApiOperation({
    summary: 'Ouvrir — ou rouvrir — le fil de groupe avec le propriétaire et les modérateurs',
  })
  async moderatorsConversation(@Auth() auth: AuthContext, @Param('id') id: string) {
    return this.communities.openModeratorsConversation(id, auth.userId);
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

  /**
   * ── TROIS CHAMPS, DEUX GESTES, UNE SEULE CAPACITÉ ─────────────────────────
   *
   * §4 met `role`, `status` et `muted` dans la même ligne du tableau, donc la
   * route est partagée. Elle porte pourtant deux gestes que le SERVICE sépare :
   * la modération (modérateur exigé, ligne d'audit) et la sourdine du §2.5
   * (n'importe quel membre, sur son PROPRE rang, sans audit).
   *
   * `content.read` (L0) reste la bonne capacité pour les deux : un modérateur
   * bénévole n'est pas nécessairement vérifié L1 (voir l'en-tête du
   * contrôleur), et mettre en sourdine le réseau de sa ville ne doit rien
   * exiger — c'est la seule échappatoire d'un membre à un réseau qu'il ne peut
   * pas quitter (§2.1 : « Impossible (on peut le mettre en sourdine) »).
   */
  @Patch('communities/:id/members/:userId')
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Rôle, bannissement (modérateur) ou sourdine (soi-même)' })
  async updateMember(
    @Auth() auth: AuthContext,
    @Param('id') id: string,
    @Param('userId', zodPipe(uuidSchema)) userId: string,
    @Body(zodPipe(updateMemberSchema)) body: z.infer<typeof updateMemberSchema>,
  ) {
    return this.communities.updateMember(id, auth.userId, userId, body);
  }

  /**
   * RETIRER — le geste RÉVERSIBLE, et il n'est pas le bannissement.
   *
   * Le porteur : « Retirer, il peut rejoindre à nouveau. Mais banni, il ne peut
   * plus rejoindre. » Deux conséquences opposées méritent deux gestes, et §4 n'en
   * décrivait qu'un.
   *
   * `DELETE` et non un `PATCH` de plus : ce que la route fait, c'est effacer
   * l'adhésion — la même chose que `POST /leave` pour soi-même. Le verbe le dit,
   * et un `status: 'REMOVED'` serait une valeur que `CommunityMemberStatus`
   * n'a pas.
   *
   * `204` comme `leave` : il n'y a plus d'état d'adhésion à renvoyer. Le
   * bannissement, lui, rend `{ status: 'BANNED' }`, parce que sa ligne existe
   * encore.
   */
  @Delete('communities/:id/members/:userId')
  @HttpCode(204)
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Retirer un membre — il pourra rejoindre à nouveau' })
  async removeMember(
    @Auth() auth: AuthContext,
    @Param('id') id: string,
    @Param('userId', zodPipe(uuidSchema)) userId: string,
  ): Promise<void> {
    await this.communities.removeMember(id, auth.userId, userId);
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

  /**
   * REMETTRE un sujet masqué — sept jours, puis l'équipe seule.
   *
   * Arbitrage du porteur. Réservée au propriétaire et aux modérateurs DU RÉSEAU,
   * et bornée à sept jours après le masquage, que le service compte sur
   * `topics.deleted_at`.
   *
   * `POST` sur une sous-ressource plutôt qu'un `PATCH /topics/:id` : `updateTopic`
   * départage déjà trois droits différents dans un seul corps (statut, épinglage,
   * titre), et y ajouter un quatrième aux conditions encore différentes rendrait
   * ses refus illisibles. C'est la forme que `POST /communities/:id/reactivate`
   * emploie déjà pour la même sorte de geste : défaire un retrait.
   *
   * ⚠ LA LIMITE DE POUVOIR DU §2.4 TIENT : cette route agit sur un CONTENU et
   * jamais sur un compte. Un modérateur de réseau ne lève aucune sanction de
   * membre — il ne peut ni suspendre ni réinstaller, il signale à l'équipe.
   */
  @Post('topics/:id/restore')
  @HttpCode(200)
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Remettre un sujet masqué (modérateur, 7 jours)' })
  async restoreTopic(@Auth() auth: AuthContext, @Param('id', zodPipe(uuidSchema)) id: string) {
    return this.communities.restoreTopic(id, auth.userId);
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
    /**
     * LE CORPS ENTIER DESCEND, et non plus `body.body` seul.
     *
     * `createAnnouncementSchema` porte maintenant les QUATRE contrôles de la
     * planche — titre, corps, épinglage, notification — et `zodPipe` a déjà
     * appliqué les deux défauts (`pinned: false`, `notify: true`). Extraire un
     * seul champ ici reviendrait à jeter les trois autres après les avoir
     * validés, ce qui est exactement l'écart que ce lot ferme.
     */
    return this.communities.createAnnouncement(id, auth.userId, body);
  }

  /**
   * ÉPINGLER OU DÉSÉPINGLER UNE ANNONCE DÉJÀ PUBLIÉE — arbitrage du 2026-10-11.
   *
   * L'épinglage reste EXCLUSIF (une seule annonce en haut du fil), et il
   * manquait le chemin du retour : sans cette route, on ne pouvait que remplacer
   * l'épinglée par une autre en publiant — avec un budget de deux annonces par
   * semaine (§2.3). « Épingler en haut du fil » était une porte à sens unique.
   *
   * `content.read` et non `post.create` : on ne publie rien ici, on déplace un
   * épinglage. La garde réelle est `assertModerator` dans le service, comme pour
   * la création.
   *
   * ⚠ LA MAQUETTE NE DESSINE AUCUN GESTE DE DÉSÉPINGLAGE — relevé : zéro
   * occurrence de « Désépingler » dans `03 Accueil v2.dc.html`. Remonté au
   * rapport ; la route existe parce qu'une accumulation sans issue est plus
   * grave qu'un bouton manquant.
   */
  @Patch('communities/:id/announcements/:announcementId')
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Épingler ou désépingler une annonce (propriétaire, modérateur)' })
  async updateAnnouncement(
    @Auth() auth: AuthContext,
    @Param('id') id: string,
    @Param('announcementId', zodPipe(uuidSchema)) announcementId: string,
    @Body(zodPipe(updateAnnouncementSchema)) body: z.infer<typeof updateAnnouncementSchema>,
  ) {
    return this.communities.setAnnouncementPinned(id, announcementId, auth.userId, body.pinned);
  }

  // ── Signalements du réseau (§2.4) ─────────────────────────────────────────

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LA FILE DE SIGNALEMENTS D'UN RÉSEAU — ELLE N'EXISTAIT NULLE PART        ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * §2.4 donne au propriétaire et aux modérateurs le pouvoir de « masquer une
   * publication ou un sujet du réseau », et la planche « Gérer » dessine la carte
   * « SIGNALEMENTS · 2 » avec ses deux décisions. Aucune route ne lisait les
   * signalements côté membre : `moderation.controller.ts` n'expose que
   * `POST /reports`, `GET /me/sanctions`, `POST /sanctions/:id/appeal` et
   * `GET /scam-alerts`. Le nombre affiché par la carte ne venait de nulle part.
   *
   * ⚠ ELLE VIT DANS CE CONTRÔLEUR ET NON DANS CELUI DE LA MODÉRATION, et c'est
   * une décision. La garde n'est pas un rôle d'équipe : c'est « être propriétaire
   * ou modérateur DE CE RÉSEAU », ce que seul `CommunitiesService.load()` sait
   * établir. Déclarer la route dans le module 13 l'obligerait à importer la garde
   * du 07, ou à la réécrire — et une seconde garde d'accès à un réseau est
   * exactement ce que l'en-tête de ce contrôleur dit de ne jamais faire.
   *
   * `content.read` (L0) comme le reste du module : un modérateur bénévole n'est
   * pas nécessairement vérifié L1.
   */
  @Get('communities/:id/reports')
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Les contenus signalés du réseau (propriétaire, modérateur)' })
  async reports(@Auth() auth: AuthContext, @Param('id') id: string) {
    return this.communities.reports(id, auth.userId);
  }

  /**
   * « Masquer » et « Conserver » — les DEUX seules décisions (§2.4).
   *
   * ⚠ LA CIBLE EST DANS LE CORPS et non dans l'URL, parce qu'elle est à DEUX
   * morceaux : la décision porte sur le COUPLE `(subjectType, subjectId)`, pas
   * sur un signalement. Un `/reports/:reportId/decide` aurait désigné UN des
   * cinq signalements d'un même contenu pour une décision qui clôt les cinq.
   *
   * ⚠ ET CE QUE CETTE ROUTE NE FAIT PAS EST LA RÈGLE : §2.4 — « Ils ne peuvent
   * pas suspendre un compte — ils signalent à l'équipe. » Aucune sanction, aucun
   * chemin vers `users` ; deux écritures sur du CONTENU.
   */
  @Post('communities/:id/reports/decide')
  @HttpCode(200)
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Masquer ou conserver un contenu signalé du réseau' })
  async decideReport(
    @Auth() auth: AuthContext,
    @Param('id') id: string,
    @Body(zodPipe(communityReportDecisionSchema))
    body: z.infer<typeof communityReportDecisionSchema>,
  ) {
    return this.communities.decideReport(id, auth.userId, body);
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
