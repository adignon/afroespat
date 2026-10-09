import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  commentsQuerySchema,
  convertStorySchema,
  createCommentSchema,
  createPostSchema,
  createStorySchema,
  feedQuerySchema,
  moveToTopicSchema,
  myStoriesQuerySchema,
  storiesQuerySchema,
  storyReactionSchema,
  updateCommentSchema,
  updatePostSchema,
  uuidSchema,
} from '@app/shared';
import type { z } from 'zod';
import { Auth, type AuthContext } from '../../common/auth.guard';
import { RequiresCapability } from '../../common/capability.decorator';
import { zodPipe } from '../../common/zod.pipe';
import { FeedService, type FeedActor } from './feed.service';

/**
 * Fil d'actualité — 04-fil.md §4.
 *
 * Cinq contrôleurs dans un fichier, parce que §4 décrit CINQ préfixes — `/feed`,
 * `/posts`, `/comments`, `/stories`, `/me/stories` — pour un seul module métier.
 * Les séparer en cinq fichiers éparpillerait les remarques ci-dessous, qui valent
 * pour les cinq.
 *
 * Ce qu'il faut savoir en lisant :
 *
 * 1. **AUCUNE route de lecture n'est `@PublicRead()`.** La matrice du §7.3 place
 *    le fil dans `content.read` — « lire le fil, les guides, l'entraide… » — qui
 *    exige un jeton dès L0. Ce n'est pas une prudence excessive : les listes
 *    appliquent la visibilité relative au LECTEUR (blocages, audience `CITY`,
 *    remontée locale), et une lecture anonyme n'aurait pas de lecteur à qui les
 *    appliquer. Elle renverrait donc, par construction, la version la plus large.
 *
 * 2. **`POST /posts` déclare `post.create` (L1), `POST /comments` et les
 *    réactions déclarent `comment.create` (L0).** C'est la règle dure de §9 —
 *    « un L0 ne peut pas publier mais peut commenter et réagir » — et elle vit
 *    dans le choix du décorateur, pas dans une condition du service. Mettre
 *    `post.create` sur la réaction la fermerait aux pré-départ ; mettre
 *    `comment.create` sur la publication ouvrirait le composeur à un compte non
 *    vérifié. Les deux erreurs sont silencieuses à la compilation.
 *
 * 3. **L'ORDRE des routes compte.** `GET /stories` est déclarée avant
 *    `GET /stories/:id`, et `/feed/sidebar` avant tout segment variable : Nest
 *    résout dans l'ordre de déclaration. `/me/stories` porte son propre
 *    contrôleur pour la même raison — un `@Get('me/stories')` dans le contrôleur
 *    `stories` produirait `/stories/me/stories`.
 *
 * 4. **Les codes de retour sont EXPLICITES sur les actions.** Nest répond 201 à
 *    tout POST, et T4 §1 réserve 201 à une création : « réagir », « garder une
 *    story » et « déplacer vers un réseau » répondent 200. Un 201 sur une
 *    réaction est le genre de détail qu'un client finit par prendre pour un
 *    contrat.
 *
 * Les limites de §2.4 et §2.5 (10 publications/heure, 30/jour, 60
 * commentaires/heure, 3 stories/jour) ne sont pas déclarées par `@RateLimit()` :
 * ce décorateur compte PAR MINUTE, et annoncer « 10/min » dans l'OpenAPI serait
 * faux. Elles sont comptées en base par le service.
 */

/** Le niveau vient du jeton : c'est lui qui décide si le composeur est ouvert (§2.4). */
function actorOf(auth: AuthContext): FeedActor {
  return { userId: auth.userId, level: auth.claims.level };
}

@ApiTags('feed')
@Controller('feed')
export class FeedController {
  constructor(private readonly feed: FeedService) {}

  /**
   * Déclarée AVANT toute route à segment variable. `/feed` n'en a pas
   * aujourd'hui, mais l'ordre est la convention du module et se casse au premier
   * `:id` ajouté sans y penser.
   */
  @Get('sidebar')
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Colonne droite de l’accueil : les 4 blocs calculés (§2.7)' })
  async sidebar(@Auth() auth: AuthContext) {
    return this.feed.sidebar(actorOf(auth));
  }

  @Get()
  @RequiresCapability('content.read')
  @ApiOperation({
    summary:
      'Fil global (chronologique inverse, remontée locale) ou fil d’un réseau (chronologique pur)',
  })
  async list(
    @Auth() auth: AuthContext,
    @Query(zodPipe(feedQuerySchema)) query: z.infer<typeof feedQuerySchema>,
  ) {
    return this.feed.feed(actorOf(auth), query);
  }
}

@ApiTags('feed')
@Controller('posts')
export class PostsController {
  constructor(private readonly feed: FeedService) {}

  @Get(':id')
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Une publication et ses 20 premiers commentaires' })
  async detail(@Auth() auth: AuthContext, @Param('id', zodPipe(uuidSchema)) id: string) {
    return this.feed.postDetail(actorOf(auth), id);
  }

  /** §2.4 : « Capacité `post.create` (L1). Un L0 voit le composeur grisé. » */
  @Post()
  @HttpCode(201)
  @RequiresCapability('post.create')
  @ApiOperation({ summary: 'Publier dans le fil global ou dans un réseau' })
  async create(
    @Auth() auth: AuthContext,
    @Body(zodPipe(createPostSchema)) body: z.infer<typeof createPostSchema>,
  ) {
    return this.feed.createPost(actorOf(auth), body);
  }

  @Patch(':id')
  @RequiresCapability('post.create')
  @ApiOperation({ summary: 'Modifier le corps, dans les 15 minutes (§2.4)' })
  async update(
    @Auth() auth: AuthContext,
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Body(zodPipe(updatePostSchema)) body: z.infer<typeof updatePostSchema>,
  ) {
    return this.feed.updatePost(actorOf(auth), id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequiresCapability('post.create')
  @ApiOperation({ summary: 'Supprimer sa publication (suppression logique)' })
  async remove(
    @Auth() auth: AuthContext,
    @Param('id', zodPipe(uuidSchema)) id: string,
  ): Promise<void> {
    await this.feed.deletePost(actorOf(auth), id);
  }

  /**
   * §4 : « Réaction (le serveur déduit le `kind` du type) ». Aucun corps : il
   * n'y a rien à envoyer, donc rien à falsifier.
   *
   * `comment.create` (L0) : §9 — « un L0 […] peut commenter ET RÉAGIR ».
   */
  @Put(':id/reaction')
  @HttpCode(200)
  @RequiresCapability('comment.create')
  @ApiOperation({ summary: 'Réagir — Bravo, Soutenir, J’ai vu ou J’aime selon le type' })
  async react(@Auth() auth: AuthContext, @Param('id', zodPipe(uuidSchema)) id: string) {
    return this.feed.reactToPost(actorOf(auth), id);
  }

  @Delete(':id/reaction')
  @HttpCode(200)
  @RequiresCapability('comment.create')
  @ApiOperation({ summary: 'Retirer sa réaction (§2.1 : « cliquer à nouveau la retire »)' })
  async unreact(@Auth() auth: AuthContext, @Param('id', zodPipe(uuidSchema)) id: string) {
    return this.feed.unreactToPost(actorOf(auth), id);
  }

  /**
   * ╔═══════════════════════════════════════════════════════════════════════╗
   * ║ ENREGISTRER UNE PUBLICATION — le bouton était dessiné, la route manquait  ║
   * ╚═══════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur : « Le bouton bookmark des publications marche ? » Il ne marchait
   * pas : la carte dessine un `<button title="Enregistrer">` depuis le début, et
   * SEULES LES STORIES avaient une route.
   *
   * LA TABLE, ELLE, ÉTAIT DÉJÀ PRÊTE : `BookmarkSubjectType` énumère `POST` au
   * même titre que `STORY`, et la clé unique porte déjà le triplet
   * (membre, type, sujet). Il n'y avait donc rien à migrer — seulement deux routes
   * à ouvrir, calquées sur celles de la story.
   *
   * `comment.create` (L0) ET NON `post.create` : enregistrer, c'est lire. §9 dit
   * qu'un L0 « ne peut pas publier mais peut commenter et réagir » ; lui refuser un
   * signet reviendrait à lui interdire de garder ce qu'il a le droit de lire.
   */
  @Put(':id/bookmark')
  @HttpCode(200)
  @RequiresCapability('comment.create')
  @ApiOperation({ summary: 'Enregistrer une publication' })
  async bookmark(@Auth() auth: AuthContext, @Param('id', zodPipe(uuidSchema)) id: string) {
    return this.feed.bookmarkPost(actorOf(auth), id);
  }

  @Delete(':id/bookmark')
  @HttpCode(200)
  @RequiresCapability('comment.create')
  @ApiOperation({ summary: 'Retirer une publication de ses enregistrés' })
  async unbookmark(@Auth() auth: AuthContext, @Param('id', zodPipe(uuidSchema)) id: string) {
    return this.feed.unbookmarkPost(actorOf(auth), id);
  }

  /**
   * §2.3 : « Non automatique. » La route est le seul chemin, et elle exige
   * `post.create` — déplacer sa question, c'est publier dans un réseau.
   */
  @Post(':id/move-to-topic')
  @HttpCode(200)
  @RequiresCapability('post.create')
  @ApiOperation({ summary: 'Déplacer une question vers un réseau (corps et commentaires copiés)' })
  async moveToTopic(
    @Auth() auth: AuthContext,
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Body(zodPipe(moveToTopicSchema)) body: z.infer<typeof moveToTopicSchema>,
  ) {
    return this.feed.moveToTopic(actorOf(auth), id, body);
  }
}

@ApiTags('feed')
@Controller('comments')
export class CommentsController {
  constructor(private readonly feed: FeedService) {}

  @Get()
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Commentaires d’un sujet (POST · TOPIC · GUIDE · EVENT)' })
  async list(
    @Auth() auth: AuthContext,
    @Query(zodPipe(commentsQuerySchema)) query: z.infer<typeof commentsQuerySchema>,
  ) {
    return this.feed.comments(actorOf(auth), query);
  }

  /** §2.5 : « Capacité `comment.create` (L0) » — un pré-départ participe. */
  @Post()
  @HttpCode(201)
  @RequiresCapability('comment.create')
  @ApiOperation({ summary: 'Commenter, ou répondre à un commentaire (une seule profondeur)' })
  async create(
    @Auth() auth: AuthContext,
    @Body(zodPipe(createCommentSchema)) body: z.infer<typeof createCommentSchema>,
  ) {
    return this.feed.createComment(actorOf(auth), body);
  }

  @Patch(':id')
  @RequiresCapability('comment.create')
  @ApiOperation({ summary: 'Modifier son commentaire, dans les 15 minutes' })
  async update(
    @Auth() auth: AuthContext,
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Body(zodPipe(updateCommentSchema)) body: z.infer<typeof updateCommentSchema>,
  ) {
    return this.feed.updateComment(actorOf(auth), id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequiresCapability('comment.create')
  @ApiOperation({ summary: 'Supprimer son commentaire (suppression logique)' })
  async remove(
    @Auth() auth: AuthContext,
    @Param('id', zodPipe(uuidSchema)) id: string,
  ): Promise<void> {
    await this.feed.deleteComment(actorOf(auth), id);
  }
}

@ApiTags('feed')
@Controller('stories')
export class StoriesController {
  constructor(private readonly feed: FeedService) {}

  @Get()
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Bandeau : une bulle par auteur ayant des stories actives' })
  async band(
    @Auth() auth: AuthContext,
    @Query(zodPipe(storiesQuerySchema)) query: z.infer<typeof storiesQuerySchema>,
  ) {
    return this.feed.storyBand(actorOf(auth), query);
  }

  /**
   * `GET /stories/:id` MARQUE VUE — c'est donc une lecture qui écrit. Elle reste
   * un GET : `story_views` n'est pas une ressource du domaine, c'est l'état de
   * l'anneau, et §4 la déclare bien en GET. Un compte suspendu peut donc la
   * lire, ce que §7.3 veut (« un compte suspendu peut toujours consulter ») et
   * qu'un POST aurait interdit.
   */
  @Get(':id')
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Story complète ; marque vue. 404 si expirée et ni auteur ni gardée' })
  async detail(@Auth() auth: AuthContext, @Param('id', zodPipe(uuidSchema)) id: string) {
    return this.feed.storyDetail(actorOf(auth), id);
  }

  /** §2.6 : création en trois étapes côté client, UN seul appel. `post.create` (L1). */
  @Post()
  @HttpCode(201)
  @RequiresCapability('post.create')
  @ApiOperation({ summary: 'Publier une story — conseil, découverte ou information' })
  async create(
    @Auth() auth: AuthContext,
    @Body(zodPipe(createStorySchema)) body: z.infer<typeof createStorySchema>,
  ) {
    return this.feed.createStory(actorOf(auth), body);
  }

  @Put(':id/reaction')
  @HttpCode(200)
  @RequiresCapability('comment.create')
  @ApiOperation({ summary: 'Voter — seuls les deux kinds du type sont acceptés (§2.6)' })
  async react(
    @Auth() auth: AuthContext,
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Body(zodPipe(storyReactionSchema)) body: z.infer<typeof storyReactionSchema>,
  ) {
    return this.feed.reactToStory(actorOf(auth), id, body);
  }

  @Delete(':id/reaction')
  @HttpCode(200)
  @RequiresCapability('comment.create')
  @ApiOperation({ summary: 'Retirer son vote' })
  async unreact(@Auth() auth: AuthContext, @Param('id', zodPipe(uuidSchema)) id: string) {
    return this.feed.unreactToStory(actorOf(auth), id);
  }

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ ENREGISTRER UNE STORY — « Le bouton de bookmark […] Tu peux l'implémenter ? » ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * La table, son enum, la tâche de rafraîchissement et le champ `bookmarked` de
   * `GET /stories/:id` existaient déjà. Il manquait ces deux routes — le mot
   * n'apparaissait dans AUCUN contrôleur du dépôt.
   *
   * `content.read` et non `comment.create` : enregistrer ne PUBLIE rien et n'est
   * visible de personne d'autre. C'est la capacité des gestes de lecture et de
   * profil (`GET /me`, `PUT /me/avatar`), et elle est ouverte dès L0 — refuser à
   * un membre non vérifié de garder une story qu'il peut lire n'aurait aucun sens.
   */
  @Put(':id/bookmark')
  @HttpCode(200)
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Enregistrer la story — elle survit à ses 24 h (§2.6)' })
  async bookmark(@Auth() auth: AuthContext, @Param('id', zodPipe(uuidSchema)) id: string) {
    return this.feed.bookmarkStory(actorOf(auth), id);
  }

  @Delete(':id/bookmark')
  @HttpCode(200)
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Retirer la story de ses enregistrées' })
  async unbookmark(@Auth() auth: AuthContext, @Param('id', zodPipe(uuidSchema)) id: string) {
    return this.feed.unbookmarkStory(actorOf(auth), id);
  }

  /**
   * §2.6 : « Jamais automatique. » La conversion crée une demande d'entraide ou
   * un conseil de ville — donc une PUBLICATION ailleurs : `post.create` (L1),
   * comme la story qu'elle prolonge.
   */
  @Post(':id/convert')
  @HttpCode(200)
  @RequiresCapability('post.create')
  @ApiOperation({ summary: 'Garder une story : demande d’entraide ou conseil de ville' })
  async convert(
    @Auth() auth: AuthContext,
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Body(zodPipe(convertStorySchema)) body: z.infer<typeof convertStorySchema>,
  ) {
    return this.feed.convertStory(actorOf(auth), id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequiresCapability('post.create')
  @ApiOperation({ summary: 'Supprimer sa story' })
  async remove(
    @Auth() auth: AuthContext,
    @Param('id', zodPipe(uuidSchema)) id: string,
  ): Promise<void> {
    await this.feed.deleteStory(actorOf(auth), id);
  }
}

/**
 * `GET /me/stories` (§4) : son propre contrôleur, parce que le préfixe diffère.
 * Déclaré dans `app.module.ts` AVANT `StoriesController` n'a aucun effet — ce
 * sont deux chemins distincts, et c'est justement l'intérêt.
 */
@ApiTags('feed')
@Controller('me/stories')
export class MyStoriesController {
  constructor(private readonly feed: FeedService) {}

  @Get()
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Historique de 30 jours, avec les votes reçus (jamais les vues)' })
  async list(
    @Auth() auth: AuthContext,
    @Query(zodPipe(myStoriesQuerySchema)) query: z.infer<typeof myStoriesQuerySchema>,
  ) {
    return this.feed.myStories(actorOf(auth), query);
  }
}
