import { Injectable, Logger } from '@nestjs/common';
import { newId, type Prisma } from '@app/db';
import {
  FEED_ERROR_CODES,
  FEED_ERROR_MESSAGES,
  FEED_LIMITS,
  POST_LINK_REL,
  POST_REACTION_KIND,
  POST_TYPE_VOCABULARY,
  STORY_BAND_TYPE_ORDER,
  STORY_COMPOSER_REMINDER,
  STORY_DISCOVERY_CATEGORIES,
  STORY_DISCOVERY_TIP_KIND,
  STORY_PAPERWORK_SUBJECT,
  STORY_SUBJECTS,
  STORY_SUBJECT_LABELS,
  STORY_TYPE_VOCABULARY,
  countLabel,
  levelSatisfies,
  storyReactionAllowed,
  type CommentSubjectType,
  type CommentsQuery,
  type CommentSort,
  type ConvertStory,
  type CreateComment,
  type CreatePost,
  type CreateStory,
  type FeedErrorCode,
  type FeedQuery,
  type MoveToTopic,
  type MyStoriesQuery,
  type PostType,
  type StoriesQuery,
  type StoryDiscoveryCategory,
  type StoryReactionInput,
  type StorySubject,
  type StoryType,
  type UpdateComment,
  type UpdatePost,
  type VerificationLevel,
} from '@app/shared';
import { ApiError } from '../../common/api-error';
import { AuditService } from '../../common/audit.service';
import { buildPage, decodeCursor, encodeCursor } from '../../common/cursor';
import { REQUIRED_MEDIA_STATUS, ownedAttachableWhere } from '../../common/media-attachment';
import { OutboxService } from '../../common/outbox.service';
import { PrismaService } from '../../common/prisma.service';
import { assertRedacted, redactForModeration } from '../../common/redact';
import { VisibilityService } from '../../common/visibility.service';
import { loadEnv } from '../../config/env';

/**
 * Fil d'actualité — 04-fil.md.
 *
 * Ce module porte quatre surfaces de lecture qui semblent indépendantes et ne le
 * sont pas : le fil, le bandeau de stories, les commentaires et la colonne
 * droite. Elles partagent toutes le même filtre de visibilité, et c'est de là que
 * viennent les erreurs les plus coûteuses — un contenu qui reparaît sur UN écran
 * suffit à défaire un blocage. Trois choix de forme en découlent.
 *
 * 1. **Tout `where` de liste est un tableau `AND`.** Jamais un objet littéral où
 *    des clauses conditionnelles sont étalées côte à côte. La raison est
 *    mécanique : deux diffusions qui posent la MÊME clé — `author`, `OR`,
 *    `cityId` — s'écrasent silencieusement, sans que `tsc` ne dise rien. Le
 *    module 06 s'est fait prendre sur `author`, et ici le cas aurait été pire :
 *    le filtre d'audience des stories et le filtre de blocage emploient tous
 *    deux `OR`. Le second aurait effacé le premier, et une story de membre
 *    bloqué serait revenue dans le bandeau. Un tableau `AND` ne peut pas perdre
 *    une clause.
 *
 * 2. **`notIn` n'est jamais employé seul sur une colonne NULLABLE.** En SQL,
 *    `x NOT IN (…)` est inconnu — donc faux — quand `x` est NULL : la ligne
 *    disparaît. La remontée locale du §2.3 partage le fil en « ma ville » et
 *    « le reste », et `posts.city_id` est nullable ; écrit `cityId: { notIn }`,
 *    le « reste » aurait perdu toutes les publications sans ville dès que le
 *    lecteur en a une. Même précaution sur l'auteur des commentaires, que §8
 *    destine à l'anonymisation.
 *
 * 3. **Aucun compteur de vues ne sort d'ici, pour personne** (règle dure §2.6).
 *    `story_views` n'est lu que pour dire à UN lecteur si LUI a vu la story, et
 *    la sortie des stories passe par une seule fonction de projection, pour
 *    qu'aucune route ne puisse ajouter le compteur par mégarde.
 *
 * RÈGLE DURE (§2.2) : le titre personnel d'un parcours n'est jamais exposé. Il
 * n'est même pas SÉLECTIONNÉ en base — ne pas le lire est plus sûr que penser à
 * ne pas l'écrire.
 *
 * RÈGLE DURE (13 §2) : aucun texte ne part vers l'analyse IA sans masquage. Tout
 * ce qui quitte ce module en direction de la modération passe par
 * `moderationPayload()`, qui masque PUIS vérifie.
 */

/** Ce que le contrôleur transmet : l'identité et le NIVEAU du membre. */
export interface FeedActor {
  readonly userId: string;
  /**
   * §2.4 : le composeur exige `post.create` (L1), le commentaire et la réaction
   * se contentent de L0. Le garde applique déjà la capacité de la route ; le
   * service la revérifie pour `post.create` afin que la règle dure de §9 (« un
   * L0 ne peut pas publier mais peut commenter et réagir ») soit vraie même
   * appelé hors HTTP — une tâche, un autre module, un test.
   */
  readonly level: VerificationLevel;
}

/** T4 §6 : un membre sort toujours sous la même forme. */
const AUTHOR_SELECT = {
  id: true,
  handle: true,
  displayName: true,
  phase: true,
  verificationLevel: true,
  status: true,
  deletedAt: true,
  avatarAsset: { select: { storageKey: true } },
  city: { select: { name: true } },
  originCountry: { select: { iso2: true } },
  mentorProfile: { select: { userId: true } },
} as const;

interface AuthorRow {
  id: string;
  handle: string;
  displayName: string;
  phase: string;
  verificationLevel: string;
  status: string;
  deletedAt: Date | null;
  avatarAsset: { storageKey: string } | null;
  city: { name: string } | null;
  originCountry: { iso2: string };
  mentorProfile: { userId: string } | null;
}

/**
 * Règles locales synchrones de modération (13 §2, étape 1, motifs à blocage
 * automatique) — coordonnées bancaires et demande de versement adressée à un
 * membre.
 *
 * Copiées de `help.service.ts` à dessein : elles y sont annoncées comme « la
 * seule partie écrite pour être jetée », et les dupliquer maintenant coûte moins
 * cher que d'inventer un `common/` que le module 13 devra de toute façon
 * remplacer. Quand `ModerationService.check()` arrivera, les deux blocs
 * disparaissent ensemble.
 *
 * §2.4 laisse les LIENS passer dans une publication (rendus `nofollow ugc`) : le
 * réglage est donc volontairement étroit — « il faut payer 225 € à la
 * préfecture » doit passer, « envoyez-moi 225 € sur mon compte » non.
 */
const POST_BLOCK_RULES: readonly { readonly name: string; readonly pattern: RegExp }[] = [
  { name: 'IBAN', pattern: /\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}){3,7}[ ]?[A-Z0-9]{0,4}\b/ },
  { name: 'RIB', pattern: /\b(?:rib|iban|bic|swift)\b\s*[:=]?\s*[A-Z0-9]{6,}/i },
  { name: 'CARD', pattern: /\b(?:\d{4}[ -]?){3}\d{4}\b/ },
  {
    name: 'PAYMENT_LINK',
    pattern:
      /\b(?:paypal\.me|paypal\.com|lydia\.app|revolut\.me|wise\.com|remitly|westernunion|western union|moneygram|ria money)\b/i,
  },
  {
    name: 'MONEY_REQUEST',
    pattern:
      /\b(?:envoie|envoies|envoyez|envoyer|vers[ée]?|verses|versez|verser|transf[eè]re|transf[eé]rez|d[eé]pose|d[eé]posez|paye|payez|payer|r[eé]gle|r[eé]glez)\b[^.!?]{0,40}\b(?:moi|m['’]|me\s|mon compte|mon num[eé]ro|mon wave|mon momo|ma carte|mon rib|mon iban)/i,
  },
  {
    name: 'MONEY_REQUEST',
    pattern: /\bsur (?:mon|le) (?:compte|num[eé]ro|wave|momo|mobile money|orange money|mtn)\b/i,
  },
];

/**
 * RÈGLE DURE (§2.6) : « Une story ne contient ni lien, ni numéro, ni email (même
 * filtre que partout). »
 *
 * Le filtre des stories est donc STRICTEMENT plus dur que celui des
 * publications : ce qui est toléré dans une publication — un lien vers la
 * préfecture — est refusé dans une story. La raison est dans §2.6 lui-même :
 * une story se lit en plein écran, en trois secondes, et disparaît en 24 h. Un
 * lien y est invérifiable et intraçable.
 *
 * Les motifs viennent de `common/redact.ts`, qui sait déjà reconnaître ces trois
 * familles, mais redact MASQUE là où il faut ici REFUSER : on ne peut pas
 * publier un texte troué de `[TEL]` à la place du numéro que le membre a écrit.
 * D'où une détection propre, et l'emploi du décompte de redact comme juge.
 */
const STORY_FORBIDDEN_PATTERNS: readonly { readonly name: string; readonly pattern: RegExp }[] = [
  { name: 'URL', pattern: /\bhttps?:\/\/\S+|\bwww\.\S+|\b[a-z0-9-]+\.(?:fr|com|net|org|be|ch|ca|bj|sn|tg|cm|ml|ci)\b/i },
  { name: 'EMAIL', pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/ },
  { name: 'PHONE_INTL', pattern: /\+\d{1,4}[\s.\-–—]?(?:\(?\d{1,4}\)?[\s.\-–—]?){2,6}\d{2,4}/ },
  { name: 'PHONE_FR', pattern: /\b0\d(?:[\s.\-–—]?\d{2}){4}\b/ },
  { name: 'PHONE_LONG', pattern: /\b\d[\d\s.\-–—]{7,18}\d\b/ },
  { name: 'HANDLE', pattern: /(?:@[A-Za-z0-9_]{3,32}\b)|(?:\b(?:wa\.me|t\.me|m\.me)\/\S+)/ },
];

/** Rayon de la Terre, en kilomètres — remontée locale (§2.3, pas de PostGIS). */
const EARTH_RADIUS_KM = 6_371;

const DAY_MS = 86_400_000;

/**
 * Les deux phases d'une tranche de 24 h dans le fil global (§2.3) : d'abord les
 * publications de la ville du membre et des villes à moins de 30 km, puis le
 * reste. Le curseur porte la tranche ET la phase — sans quoi la remontée locale
 * ne survivrait pas à la deuxième page.
 */
type FeedPhase = 'LOCAL' | 'REST';

/** Les sujets de commentaire dont ce module tient lui-même le compteur. */
const POST_INCLUDE = {
  author: { select: AUTHOR_SELECT },
  city: { select: { id: true, name: true } },
  community: { select: { id: true, name: true, slug: true } },
  journey: {
    // Le titre PERSONNEL du parcours n'est pas sélectionné (règle dure §2.2) :
    // seul le nom du TYPE l'est. La colonne `journeys.title` n'apparaît nulle
    // part dans ce fichier, et c'est volontaire.
    select: { id: true, templateVersion: { select: { template: { select: { nameFr: true } } } } },
  },
  journeyStep: {
    select: {
      id: true,
      journeyId: true,
      position: true,
      status: true,
      completedAt: true,
      stepDefinition: { select: { nameFr: true } },
    },
  },
  media: {
    orderBy: { position: 'asc' },
    select: { position: true, mediaAsset: { select: { id: true, storageKey: true } } },
  },
  /**
   * ── LE SONDAGE ET LES GUIDES VIENNENT AVEC LA PUBLICATION ────────────────
   *
   * Dans la MÊME requête, et pas une par carte : une page de fil porte vingt
   * publications, donc vingt allers-retours de plus à chaque défilement. Une
   * jointure n'en coûte aucun.
   *
   * Les options sont ordonnées par `position` : sans cela, l'ordre serait celui
   * de l'index, c'est-à-dire celui des identifiants — un sondage dont les
   * réponses changent de place d'un chargement à l'autre.
   */
  poll: {
    select: {
      id: true,
      question: true,
      isMultiple: true,
      resultsAfterVote: true,
      isAnonymous: true,
      closesAt: true,
      createdAt: true,
      author: { select: { id: true, handle: true, displayName: true } },
      options: {
        orderBy: { position: 'asc' },
        select: {
          id: true,
          label: true,
          position: true,
          voteCount: true,
          /**
           * LES VOTANTS SONT RAMENÉS, PAS TOUJOURS RENDUS : `carteDeSondage` ne
           * les nomme que sur un sondage NON anonyme dont les résultats sont
           * visibles. Les charger inconditionnellement coûte une jointure et
           * évite une seconde requête conditionnelle dont on oublierait un cas.
           */
          votes: { select: { user: { select: { id: true, handle: true, displayName: true } } } },
        },
      },
    },
  },
  guides: {
    orderBy: { position: 'asc' },
    select: { guide: { select: { id: true, slug: true, title: true } } },
  },
} as const;

@Injectable()
export class FeedService {
  private readonly logger = new Logger(FeedService.name);
  private readonly cursorSecret = loadEnv().CURSOR_SECRET;

  /**
   * §7 : « La colonne droite est calculée à la requête avec cache Redis de 5
   * minutes par ville. »
   *
   * Le cache est ici EN MÉMOIRE et non dans Redis, comme celui des « Guichets du
   * jour » du module 09. Deux raisons, et une conséquence assumée : injecter
   * `QueueService` ferait de Redis une dépendance des tests d'intégration de ce
   * module, et la colonne droite est un agrégat public par ville — un serveur
   * qui garde sa propre copie cinq minutes ne rend jamais la donnée d'un autre
   * membre. La conséquence : avec N instances, jusqu'à N calculs au lieu d'un.
   * À rebrancher sur Redis le jour où le nombre d'instances le justifie.
   */
  private readonly sidebarCache = new Map<string, { at: number; value: unknown }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
    private readonly visibility: VisibilityService,
  ) {}

  /**
   * Vide le cache de la colonne droite. Réservé aux tests et à un redéploiement —
   * sans cela, un test qui modifie les données puis relit obtiendrait la copie de
   * cinq minutes et passerait pour la mauvaise raison. Même intention que
   * `resetEnvCache()` dans `config/env.ts`.
   */
  resetSidebarCache(): void {
    this.sidebarCache.clear();
  }

  private fail(code: FeedErrorCode, details?: Record<string, unknown>): never {
    throw new ApiError(code, FEED_ERROR_MESSAGES[code], FEED_ERROR_CODES[code], details);
  }

  // ══ LECTURES ═══════════════════════════════════════════════════════════════

  /**
   * `GET /feed` (§4) — le fil global, ou celui d'un réseau.
   *
   * §2.3 donne deux tris DIFFÉRENTS, et c'est la seule raison de la scission
   * ci-dessous : le fil de réseau est « chronologique pur », le fil global est
   * chronologique « avec remontée locale ». Les appliquer tous les deux au même
   * endroit obligerait à un `if` au milieu de la pagination, là où il coûte le
   * plus cher.
   *
   * « Pas de score d'engagement » (§2.3) : aucun `reactionCount` ni
   * `commentCount` n'apparaît dans un `orderBy` de ce fichier.
   */
  async feed(actor: FeedActor, query: FeedQuery) {
    const where = await this.postListWhere(actor, query);
    const meta = { linkRel: POST_LINK_REL, canPost: levelSatisfies(actor.level, 'post.create') };

    if (query.communityId !== undefined) {
      // §2.3 : « Fil de réseau […] visible des membres du réseau seulement. »
      // La vérification d'appartenance est faite AVANT la requête : sans elle, un
      // identifiant de réseau deviendrait une clé de lecture universelle.
      await this.assertCommunityMember(actor.userId, query.communityId);
      const scope = this.feedScope(query);
      const rows = await this.prisma.post.findMany({
        where: this.withIdCursor(where, query.cursor, scope),
        orderBy: { id: 'desc' },
        take: query.limit + 1,
        include: POST_INCLUDE,
      });
      const page = buildPage(rows, query.limit, scope, this.cursorSecret);
      return {
        items: await this.cards(page.items, actor.userId),
        nextCursor: page.nextCursor,
        meta: { ...meta, scopeKind: 'COMMUNITY' as const },
      };
    }

    return { ...(await this.globalFeed(actor, query, where)), meta: { ...meta, scopeKind: 'GLOBAL' as const } };
  }

  /**
   * La remontée locale de §2.3, et la façon dont elle traverse la pagination.
   *
   * « les publications de la ville du membre et des villes à moins de 30 km sont
   * affichées en premier DANS CHAQUE TRANCHE DE 24 H » : le tri est donc
   * (tranche décroissante, local avant le reste, date décroissante). Aucun de ces
   * trois critères n'est un score d'engagement, et le dernier est l'identifiant —
   * UUID v7, donc chronologique.
   *
   * Prisma ne sait pas trier sur une expression. La tranche et la phase vivent
   * donc dans le CURSEUR, et la requête est rejouée par (tranche, phase) jusqu'à
   * remplir la page. C'est ce qui rend la remontée locale exacte au-delà de la
   * première page — la trier en mémoire page par page donnerait un ordre
   * différent selon le découpage, et des publications vues deux fois.
   */
  private async globalFeed(
    actor: FeedActor,
    query: FeedQuery,
    base: Prisma.PostWhereInput[],
  ): Promise<{ items: unknown[]; nextCursor: string | null }> {
    const scope = this.feedScope(query);
    const localCityIds = await this.localCityIds(actor.userId);

    let bucket: Date;
    let phase: FeedPhase;
    let afterId: string | undefined;

    if (query.cursor === undefined) {
      const newest = await this.prisma.post.findFirst({
        where: { AND: base },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      });
      if (newest === null) return { items: [], nextCursor: null };
      bucket = startOfUtcDay(newest.createdAt);
      phase = 'LOCAL';
    } else {
      const payload = decodeCursor(query.cursor, this.cursorSecret, scope);
      const parsed = parseFeedSort(payload.sort);
      bucket = parsed.bucket;
      phase = parsed.phase;
      afterId = payload.id;
    }

    const want = query.limit + 1;
    const rows: { id: string; bucket: Date; phase: FeedPhase; row: PostRow }[] = [];
    // Garde-fou : un fil clairsemé pourrait faire boucler sur des tranches vides.
    // La recherche de la tranche suivante SAUTE les tranches vides (elle part de
    // la publication la plus récente antérieure), donc la borne ne sert qu'à
    // rendre la boucle manifestement finie.
    for (let guard = 0; guard < 400 && rows.length < want; guard += 1) {
      const chunk = await this.prisma.post.findMany({
        where: {
          AND: [
            ...base,
            { createdAt: { gte: bucket, lt: new Date(bucket.getTime() + DAY_MS) } },
            this.phaseWhere(phase, localCityIds),
            ...(afterId === undefined ? [] : [{ id: { lt: afterId } }]),
          ],
        },
        orderBy: { id: 'desc' },
        take: want - rows.length,
        include: POST_INCLUDE,
      });

      for (const row of chunk) rows.push({ id: row.id, bucket, phase, row });
      if (rows.length >= want) break;

      // La phase — puis la tranche — est épuisée : le curseur interne repart à
      // zéro, sinon il filtrerait une phase à laquelle il n'appartient pas.
      afterId = undefined;
      if (phase === 'LOCAL') {
        phase = 'REST';
        continue;
      }

      const older = await this.prisma.post.findFirst({
        where: { AND: [...base, { createdAt: { lt: bucket } }] },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      });
      if (older === null) break;
      bucket = startOfUtcDay(older.createdAt);
      phase = 'LOCAL';
    }

    const hasMore = rows.length > query.limit;
    const items = hasMore ? rows.slice(0, query.limit) : rows;
    const last = items.at(-1);

    return {
      items: await this.cards(
        items.map((r) => r.row),
        actor.userId,
      ),
      nextCursor:
        hasMore && last !== undefined
          ? encodeCursor(
              { id: last.id, sort: `${last.bucket.toISOString()}|${last.phase}`, scope },
              this.cursorSecret,
            )
          : null,
    };
  }

  /**
   * Le partage local / reste de §2.3.
   *
   * PIÈGE : `cityId: { notIn: localCityIds }` seul serait faux. `posts.city_id`
   * est nullable — une publication d'un membre sans ville, ou dont la ville a été
   * supprimée (`onDelete: SetNull`), porte NULL. En SQL, `NULL NOT IN (…)` vaut
   * « inconnu », donc la ligne est écartée : la publication disparaîtrait du fil
   * ENTIER dès que le lecteur a une ville, puisqu'elle n'est ni locale ni « le
   * reste ». D'où le `OR` explicite sur NULL.
   */
  private phaseWhere(phase: FeedPhase, localCityIds: readonly string[]): Prisma.PostWhereInput {
    if (phase === 'LOCAL') return { cityId: { in: [...localCityIds] } };
    if (localCityIds.length === 0) return {};
    return { OR: [{ cityId: null }, { cityId: { notIn: [...localCityIds] } }] };
  }

  /**
   * `GET /posts/:id` (§4) : la publication et ses 20 premiers commentaires.
   *
   * « 404 si masquée ou auteur bloqué » — et aussi si l'auteur a éteint son
   * compte, ce que §4 ne dit pas mais que 01 §4.4 impose partout.
   */
  async postDetail(actor: FeedActor, id: string) {
    const post = await this.prisma.post.findUnique({
      where: { id },
      include: {
        ...POST_INCLUDE,
        movedToTopic: { select: { id: true, community: { select: { id: true, name: true, slug: true } } } },
      },
    });
    if (post === null || post.deletedAt !== null) throw ApiError.notFound();

    const isAuthor = post.authorUserId === actor.userId;
    // Masquée par la modération : invisible pour tous SAUF son auteur, qui doit
    // comprendre pourquoi elle ne paraît plus (13 §2).
    if (post.status !== 'PUBLISHED' && !isAuthor) throw ApiError.notFound();
    if (post.status === 'REMOVED') throw ApiError.notFound();
    if (post.moderationStatus === 'FLAGGED' && !isAuthor) throw ApiError.notFound();
    await this.visibility.assertVisible(actor.userId, post.authorUserId);
    if (!isVisibleAuthor(post.author)) throw ApiError.notFound();
    if (post.communityId !== null) await this.assertCommunityMember(actor.userId, post.communityId);

    const [card] = await this.cards([post], actor.userId);
    if (card === undefined) throw ApiError.notFound();

    const comments = await this.commentPage(actor, {
      subjectType: 'POST',
      subjectId: id,
      limit: FEED_LIMITS.detailCommentCount,
    });

    return {
      post: {
        ...card,
        body: post.body,
        /**
         * §2.3 : « la publication reste avec un lien "Suite dans le réseau X" ».
         */
        movedTo:
          post.movedToTopic === null
            ? null
            : {
                topicId: post.movedToTopic.id,
                community: post.movedToTopic.community,
                label: `Suite dans le réseau ${post.movedToTopic.community.name}`,
              },
        /** §2.3 : l'invitation à déplacer ne s'affiche QU'À l'auteur. */
        canMoveToTopic:
          isAuthor &&
          post.type === 'QUESTION' &&
          post.communityId === null &&
          post.movedToTopicId === null &&
          post.commentCount > FEED_LIMITS.moveToTopicMinReplies,
      },
      comments,
      meta: { linkRel: POST_LINK_REL },
    };
  }

  /** `GET /comments` (§4). */
  async comments(actor: FeedActor, query: CommentsQuery) {
    await this.assertSubjectVisible(actor, query.subjectType, query.subjectId);
    return this.commentPage(actor, query);
  }

  /**
   * Les commentaires d'un sujet, à une profondeur (§2.5).
   *
   * Les réponses sont imbriquées sous leur parent plutôt que renvoyées à plat :
   * §2.5 garantit qu'il n'y a qu'UNE profondeur, donc la structure est finie et
   * le client n'a rien à recomposer. La pagination porte sur les commentaires
   * RACINE — paginer un mélange de racines et de réponses couperait un fil en
   * deux au milieu.
   */
  private async commentPage(
    actor: FeedActor,
    query: {
      subjectType: CommentSubjectType;
      subjectId: string;
      limit: number;
      // `| undefined` explicite : avec `exactOptionalPropertyTypes`, « absent »
      // et « présent à undefined » sont deux types différents, et la query
      // validée par zod porte le second.
      cursor?: string | undefined;
      sort?: CommentSort | undefined;
    },
  ) {
    const tri: CommentSort = query.sort ?? 'RELEVANT';
    /**
     * LE TRI ENTRE DANS LA PORTÉE DU CURSEUR. `decodeCursor` refuse un curseur dont
     * la portée ne correspond pas : sans cela, basculer d'onglet en gardant le
     * curseur de l'autre rendrait une page cohérente EN APPARENCE et fausse en
     * fait. C'est exactement ce que la portée existe pour empêcher.
     */
    const scope = `feed:comments:${query.subjectType}:${query.subjectId}:${tri}`;
    const visible = await this.commentVisibilityWhere(actor.userId);

    const filtres = [
      ...visible,
      { subjectType: query.subjectType, subjectId: query.subjectId },
      { parentCommentId: null },
    ];

    /**
     * ╔═════════════════════════════════════════════════════════════════════╗
     * ║ DEUX ORDRES, DEUX PAGINATIONS — ET CE N'EST PAS UN CHOIX DE STYLE      ║
     * ╚═════════════════════════════════════════════════════════════════════╝
     *
     * `RECENT` trie sur l'identifiant, qui est un UUID v7 : décroissant sur l'id
     * EST décroissant sur la date. La pagination reste donc une PAGINATION PAR
     * CLÉ — « ce qui vient après cet id » — et rien ne peut être sauté ni doublé
     * si un commentaire paraît pendant la lecture.
     *
     * `RELEVANT` trie sur le NOMBRE DE RÉPONSES, qui n'est pas une colonne : c'est
     * un `_count` de relation. On ne peut pas écrire « ce qui vient après » dans
     * un `where` sur une valeur que la base calcule à la volée, donc la seule
     * pagination possible est par DÉCALAGE. Le décalage voyage dans le curseur
     * signé, comme n'importe quelle autre charge de curseur.
     *
     * CE QUE LE DÉCALAGE COÛTE, dit plutôt que tu : si une réponse paraît pendant
     * qu'on déroule, une racine peut changer de rang et être revue ou manquée à la
     * page suivante. Sur un fil de commentaires — borné, lu d'une traite — c'est
     * acceptable ; ça ne le serait pas sur le fil d'actualité, qui garde sa
     * pagination par clé.
     */
    const decalage =
      tri === 'RELEVANT' && query.cursor !== undefined
        ? Number(decodeCursor(query.cursor, this.cursorSecret, scope).sort ?? 0)
        : 0;

    const roots = await this.prisma.comment.findMany({
      where:
        tri === 'RELEVANT'
          ? { AND: filtres }
          : this.withIdCursor(filtres, query.cursor, scope, 'lt'),
      orderBy:
        tri === 'RELEVANT'
          ? // À égalité de réponses, l'ordre de la discussion (§2.5).
            [{ replies: { _count: 'desc' } }, { id: 'asc' }]
          : { id: 'desc' },
      ...(tri === 'RELEVANT' && decalage > 0 ? { skip: decalage } : {}),
      take: query.limit + 1,
      include: { author: { select: AUTHOR_SELECT } },
    });

    const page =
      tri === 'RELEVANT'
        ? buildPage(roots, query.limit, scope, this.cursorSecret, () => decalage + query.limit)
        : buildPage(roots, query.limit, scope, this.cursorSecret);
    const rootIds = page.items.map((r) => r.id);

    const replies =
      rootIds.length === 0
        ? []
        : await this.prisma.comment.findMany({
            where: { AND: [...visible, { parentCommentId: { in: rootIds } }] },
            orderBy: { id: 'asc' },
            include: { author: { select: AUTHOR_SELECT } },
          });

    const byParent = new Map<string, typeof replies>();
    for (const reply of replies) {
      if (reply.parentCommentId === null) continue;
      byParent.set(reply.parentCommentId, [...(byParent.get(reply.parentCommentId) ?? []), reply]);
    }

    return {
      items: page.items.map((root) => ({
        ...this.commentCard(root, actor.userId),
        replies: (byParent.get(root.id) ?? []).map((r) => this.commentCard(r, actor.userId)),
      })),
      nextCursor: page.nextCursor,
    };
  }

  /**
   * `GET /stories` (§4) — le bandeau : « une bulle par auteur ayant des stories
   * actives ».
   *
   * Pas de pagination : §2.6 décrit un bandeau horizontal borné, et un anneau
   * vu / non vu qui se calcule par AUTEUR. Le paginer donnerait un anneau
   * incohérent d'une page à l'autre, pour un gain nul.
   *
   * RÈGLE DURE (§2.6) : la sortie ne contient AUCUN compteur de vues. `seen` est
   * un booléen qui ne parle que du lecteur — c'est l'anneau, pas une audience.
   */
  async storyBand(actor: FeedActor, query: StoriesQuery) {
    const now = new Date();
    const me = await this.prisma.user.findUniqueOrThrow({
      where: { id: actor.userId },
      select: { cityId: true },
    });

    const stories = await this.prisma.story.findMany({
      where: {
        AND: [
          ...(await this.storyVisibilityWhere(actor.userId, me.cityId, now)),
          ...(query.type === undefined ? [] : [{ type: query.type }]),
          ...(query.cityId === undefined ? [] : [{ cityId: query.cityId }]),
        ],
      },
      orderBy: { id: 'desc' },
      take: FEED_LIMITS.storyBandMaxAuthors * 20,
      include: {
        author: { select: AUTHOR_SELECT },
        city: { select: { id: true, name: true } },
        stepDefinition: { select: { id: true, nameFr: true } },
        // Le fond IMAGE. Sans cette relation, `storyBubble` ne pouvait rendre que
        // `null` — voir son commentaire.
        backgroundAsset: { select: { storageKey: true, status: true } },
      },
    });

    const seenIds = await this.seenStoryIds(
      actor.userId,
      stories.map((s) => s.id),
    );

    /** Une bulle par auteur (§2.6). */
    const byAuthor = new Map<string, { author: AuthorRow; stories: typeof stories }>();
    for (const story of stories) {
      const entry = byAuthor.get(story.authorUserId);
      if (entry === undefined) {
        byAuthor.set(story.authorUserId, { author: story.author, stories: [story] });
      } else {
        entry.stories.push(story);
      }
    }

    const classees = [...byAuthor.values()]
      .map((entry) => {
        const ordered = [...entry.stories].sort(compareForBand);
        const top = ordered[0];
        return {
          author: this.summary(entry.author),
          isMe: entry.author.id === actor.userId,
          /** L'anneau : vert tant qu'UNE story de l'auteur n'est pas vue (§2.6). */
          hasUnseen: ordered.some((s) => !seenIds.has(s.id)),
          stories: ordered.map((s) => this.storyBubble(s, seenIds.has(s.id))),
          /** Clé de tri de la bulle : celle de sa story de tête. */
          sortKey: top === undefined ? Number.MAX_SAFE_INTEGER : bandRank(top),
        };
      })
      .sort((a, b) => a.sortKey - b.sortKey);

    /**
     * ╔══════════════════════════════════════════════════════════════════════════╗
     * ║ LIRE UNE STORY NE DOIT PAS LA FAIRE DISPARAÎTRE DU RUBAN                ║
     * ╚══════════════════════════════════════════════════════════════════════════╝
     *
     * Le porteur : « Le marquage de lecture a un comportement bizarre. Quand tu
     * cliques sur plusieurs stories, l'une est lue et l'autre non. Parfois rien
     * n'est marqué lu. Je ne comprends pas. »
     *
     * MESURÉ : après lecture, la story n'était plus dans le ruban DU TOUT — ni
     * grise, ni verte : ABSENTE. Et donc jamais « marquée lue », puisqu'il n'y
     * avait plus rien à marquer.
     *
     * LA CAUSE ÉTAIT UN SEUL ENCHAÎNEMENT : on triait « non-vu d'abord » PUIS on
     * coupait aux trente auteurs. Le départage par `hasUnseen` n'était censé jouer
     * qu'à rang ÉGAL — mais pour un CONSEIL le rang est `-score`, et un score vaut
     * zéro tant que personne n'a voté : tous les rangs sont donc égaux, le vu/non-vu
     * devient le tri PRINCIPAL, et la bulle qu'on vient de lire tombe au-delà de la
     * coupe. Mesuré sur la base de développement : soixante-dix-huit auteurs pour
     * trente places.
     *
     * On sépare donc les deux questions, qui n'ont jamais été la même :
     *
     *   · QUI entre dans le ruban — le rang de contenu, et lui seul. Il ne dépend
     *     pas de ce que le lecteur a vu, donc le ruban ne se dérobe pas sous lui ;
     *   · DANS QUEL ORDRE on les montre — le non-vu d'abord, à rang égal, ce que
     *     §2.6 demande. Une bulle lue recule, elle ne sort pas.
     *
     * `Array.prototype.sort` est STABLE : le second tri garde l'ordre du premier
     * entre égaux, donc l'ordre à l'intérieur du ruban reste celui du serveur.
     */
    const retenues = classees.slice(0, FEED_LIMITS.storyBandMaxAuthors);
    const bubbles = [...retenues]
      .sort((a, b) => a.sortKey - b.sortKey || Number(a.hasUnseen ? 0 : 1) - Number(b.hasUnseen ? 0 : 1))
      .map(({ sortKey: _sortKey, ...bubble }) => bubble);

    return {
      items: bubbles,
      nextCursor: null,
      meta: {
        /** Première bulle côté client : « Créer une story » (§2.6). */
        canCreate: levelSatisfies(actor.level, 'post.create'),
        typeOrder: STORY_BAND_TYPE_ORDER,
        reminder: STORY_COMPOSER_REMINDER,
      },
    };
  }

  /**
   * `GET /stories/:id` (§4) : la story entière, et elle est MARQUÉE VUE.
   *
   * RÈGLE DURE (§2.6) : « Une story expirée n'est renvoyée qu'à son auteur et aux
   * membres qui l'ont enregistrée. » Le signet est la seule dérogation, et il est
   * vérifié à CHAQUE lecture — un signet retiré referme l'accès, comme §2.6 le
   * demande (« tant que le signet existe »).
   */
  async storyDetail(actor: FeedActor, id: string) {
    const now = new Date();
    const story = await this.prisma.story.findUnique({
      where: { id },
      include: {
        author: { select: AUTHOR_SELECT },
        city: { select: { id: true, name: true } },
        stepDefinition: { select: { id: true, nameFr: true } },
        // Le fond IMAGE. Sans cette relation, `storyBubble` ne pouvait rendre que
        // `null` — voir son commentaire.
        backgroundAsset: { select: { storageKey: true, status: true } },
      },
    });
    if (story === null || story.deletedAt !== null) throw ApiError.notFound();

    const isAuthor = story.authorUserId === actor.userId;
    if (story.status === 'REMOVED') throw ApiError.notFound();
    if (story.status === 'HIDDEN' && !isAuthor) throw ApiError.notFound();
    if (story.moderationStatus === 'FLAGGED' && !isAuthor) throw ApiError.notFound();
    await this.visibility.assertVisible(actor.userId, story.authorUserId);
    if (!isVisibleAuthor(story.author)) throw ApiError.notFound();

    const bookmarked = await this.hasStoryBookmark(actor.userId, id);
    const expired = story.status === 'EXPIRED' || story.expiresAt.getTime() <= now.getTime();
    if (expired && !isAuthor && !bookmarked) throw ApiError.notFound();

    // §2.6 : audience `CITY` — la story ne sort pas de sa ville. Vérifié même
    // ici, sur un accès par identifiant : le bandeau n'est pas la seule porte.
    if (story.audience === 'CITY' && !isAuthor) {
      const me = await this.prisma.user.findUniqueOrThrow({
        where: { id: actor.userId },
        select: { cityId: true },
      });
      if (me.cityId !== story.cityId) throw ApiError.notFound();
    }

    // L'anneau, et rien d'autre. `story_views` n'est jamais compté (§2.6) :
    // la ligne existe pour dire à CE lecteur qu'il a déjà vu, et l'auteur n'en
    // crée pas — « vu sa propre story » ne veut rien dire.
    if (!isAuthor) {
      await this.prisma.storyView.upsert({
        where: { storyId_userId: { storyId: id, userId: actor.userId } },
        create: { id: newId(), storyId: id, userId: actor.userId },
        update: {},
      });
    }

    const myReaction = await this.prisma.storyReaction.findUnique({
      where: { storyId_userId: { storyId: id, userId: actor.userId } },
      select: { kind: true },
    });

    return {
      story: {
        ...this.storyBubble(story, true),
        ...(await this.storyStateLine(story, now)),
        myReaction: myReaction?.kind ?? null,
        bookmarked,
        isAuthor,
        expired,
        /** §2.6 : « "Écrire à …" si `allow_messages` ». */
        canMessage: story.allowMessages && !isAuthor,
        context: this.storyContext(story),
      },
      meta: { reminder: STORY_COMPOSER_REMINDER },
    };
  }

  /**
   * `GET /me/stories` (§4) : « Historique 30 jours avec votes reçus ».
   *
   * Les votes reçus, pas les vues : §2.6 est explicite, l'auteur lui-même n'a
   * aucun compteur de vues.
   */
  async myStories(actor: FeedActor, query: MyStoriesQuery) {
    const since = new Date(Date.now() - FEED_LIMITS.storyHistoryDays * DAY_MS);
    const scope = 'feed:me:stories';

    const rows = await this.prisma.story.findMany({
      where: this.withIdCursor(
        [{ authorUserId: actor.userId }, { deletedAt: null }, { createdAt: { gte: since } }],
        query.cursor,
        scope,
      ),
      orderBy: { id: 'desc' },
      take: query.limit + 1,
      include: {
        author: { select: AUTHOR_SELECT },
        city: { select: { id: true, name: true } },
        stepDefinition: { select: { id: true, nameFr: true } },
        // Le fond IMAGE. Sans cette relation, `storyBubble` ne pouvait rendre que
        // `null` — voir son commentaire.
        backgroundAsset: { select: { storageKey: true, status: true } },
      },
    });

    const page = buildPage(rows, query.limit, scope, this.cursorSecret);
    return {
      items: page.items.map((story) => ({
        ...this.storyBubble(story, true),
        status: story.status,
        expired: story.status === 'EXPIRED' || story.expiresAt.getTime() <= Date.now(),
        convertedTo:
          story.convertedToId === null
            ? null
            : { type: story.convertedToType, id: story.convertedToId },
        votes: {
          positive: story.positiveCount,
          positiveLabel: STORY_TYPE_VOCABULARY[story.type].positive.label,
          negative: story.negativeCount,
          negativeLabel: STORY_TYPE_VOCABULARY[story.type].negative.label,
        },
      })),
      nextCursor: page.nextCursor,
    };
  }

  /**
   * `GET /feed/sidebar` (§2.7 et §4) : les quatre blocs, tous CALCULÉS.
   *
   * Les quatre sont indépendants et lancés en parallèle : un bloc qui tombe ne
   * doit pas vider la colonne. Ils partagent en revanche le même filtre de
   * visibilité — « Nouveaux arrivants » et « contacts en ligne » exposent des
   * MEMBRES, et c'est là que la colonne droite est dangereuse.
   */
  async sidebar(actor: FeedActor) {
    const me = await this.prisma.user.findUniqueOrThrow({
      where: { id: actor.userId },
      select: { cityId: true, originCountryId: true },
    });

    // La clé de cache porte la ville ET le lecteur : les blocs « Nouveaux
    // arrivants » et « contacts en ligne » dépendent de ses blocages et de ses
    // contacts. Une clé par ville seule — ce que §7 suggère — servirait à un
    // membre le voisinage d'un autre, blocages compris. La ville reste dans la
    // clé pour qu'un changement de ville invalide l'entrée.
    const cacheKey = `${actor.userId}:${me.cityId ?? 'none'}`;
    const cached = this.sidebarCache.get(cacheKey);
    if (cached !== undefined && Date.now() - cached.at < FEED_LIMITS.sidebarCacheSeconds * 1_000) {
      return cached.value;
    }

    const [events, arrivals, alerts, online] = await Promise.all([
      this.sidebarEvents(actor.userId, me.cityId),
      this.sidebarNewArrivals(actor, me.cityId),
      this.sidebarAlerts(me.cityId, me.originCountryId),
      this.sidebarOnline(actor.userId),
    ]);

    const value = {
      cityEvents: events,
      newArrivals: arrivals,
      scamAlert: alerts,
      onlineContacts: online,
      meta: { cachedForSeconds: FEED_LIMITS.sidebarCacheSeconds },
    };
    this.sidebarCache.set(cacheKey, { at: Date.now(), value });
    return value;
  }

  // ══ ÉCRITURES — PUBLICATIONS ═══════════════════════════════════════════════

  /**
   * `POST /posts` (§2.4 et §4).
   *
   * RÈGLE DURE (§9) : « un L0 ne peut pas publier mais peut commenter et
   * réagir. » Le garde de la route le fait déjà via `post.create` ; la
   * vérification est répétée ici pour que la règle tienne hors HTTP.
   *
   * §2.4 : « la publication est visible immédiatement sauf verdict BLOCK
   * synchrone sur les motifs à blocage automatique ». D'où l'ordre : règles
   * locales (synchrones, bloquantes), puis écriture en `PENDING`, puis analyse IA
   * en file. `CLEARED` mentirait sur ce qui a été vérifié.
   */
  async createPost(actor: FeedActor, input: CreatePost) {
    if (!levelSatisfies(actor.level, 'post.create')) {
      throw ApiError.levelRequired('post.create', actor.level);
    }

    this.assertPostPublishable(input.body);
    await this.assertPostQuota(actor.userId);

    const communityId = input.communityId;
    if (communityId !== undefined) await this.assertCommunityMember(actor.userId, communityId);

    const { journeyId, journeyStepId } = await this.resolveJourneyContext(
      actor.userId,
      input.journeyId,
      input.journeyStepId,
    );
    const mediaIds = await this.resolveMedia(actor.userId, input.mediaIds ?? []);
    const guideIds = await this.resolveGuides(input.guideIds ?? []);

    // §2.2 : la ville de contexte est celle du membre. `posts.city_id` reste
    // nullable — un pré-départ sans ville publie quand même, et la remontée
    // locale doit continuer de le faire apparaître (voir `phaseWhere`).
    const me = await this.prisma.user.findUniqueOrThrow({
      where: { id: actor.userId },
      select: { cityId: true },
    });

    const id = newId();
    await this.prisma.$transaction(async (tx) => {
      await tx.post.create({
        data: {
          id,
          authorUserId: actor.userId,
          type: input.type,
          body: input.body,
          status: 'PUBLISHED',
          moderationStatus: 'PENDING',
          ...(me.cityId === null ? {} : { cityId: me.cityId }),
          ...(communityId === undefined ? {} : { communityId }),
          ...(journeyId === undefined ? {} : { journeyId }),
          ...(journeyStepId === undefined ? {} : { journeyStepId }),
        },
      });

      if (mediaIds.length > 0) {
        await tx.postMedia.createMany({
          data: mediaIds.map((mediaAssetId, position) => ({
            id: newId(),
            postId: id,
            mediaAssetId,
            position,
          })),
        });
      }

      /**
       * ╔══════════════════════════════════════════════════════════════════════╗
       * ║ LE SONDAGE NAÎT AVEC LA PUBLICATION, OU AUCUN DES DEUX               ║
       * ╚══════════════════════════════════════════════════════════════════════╝
       *
       * Le porteur : « la création de sondage […] ne marche pas ».
       *
       * DANS LA MÊME TRANSACTION, et ce n'est pas du confort : une publication
       * créée puis un sondage qui échoue laisserait une carte dont la maquette
       * promet un sondage et qui n'en a pas — un état que rien ne rattraperait,
       * puisque `PATCH /posts/:id` ne porte que le corps.
       *
       * LE MODÈLE EST CELUI DU MODULE 07, repris tel quel : `polls` et
       * `poll_options`, avec `post_id` au lieu de `community_id`. La contrainte
       * `polls_rattachement` de la base refuse les deux à la fois et aucun des
       * deux. Le vote, les résultats masqués et la clôture sont ceux qui
       * existaient déjà — on n'en écrit pas un second.
       */
      if (input.poll !== undefined) {
        const pollId = newId();
        await tx.poll.create({
          data: {
            id: pollId,
            postId: id,
            authorUserId: actor.userId,
            question: input.poll.question,
            isMultiple: input.poll.isMultiple,
            resultsAfterVote: input.poll.resultsAfterVote,
            isAnonymous: input.poll.isAnonymous,
            ...(input.poll.closesAt === undefined ? {} : { closesAt: input.poll.closesAt }),
          },
        });
        await tx.pollOption.createMany({
          data: input.poll.options.map((label, position) => ({
            id: newId(),
            pollId,
            label,
            position,
          })),
        });
      }

      /**
       * ── LES GUIDES LIÉS — « Jusqu'à 3 » ────────────────────────────────────
       *
       * `resolveGuides` a déjà écarté les identifiants qui ne désignent aucun
       * guide PUBLIÉ : lier un brouillon ou un guide supprimé poserait une
       * étiquette qui mène à une page introuvable. La borne, elle, est tenue
       * DEUX FOIS — par `createPostSchema` à la frontière, et par le service —
       * parce qu'un schéma refuse une requête quand un service refuse un état.
       */
      if (guideIds.length > 0) {
        await tx.postGuide.createMany({
          data: guideIds.map((guideId, position) => ({ postId: id, guideId, position })),
        });
      }

      await this.outbox.emit(tx, {
        type: 'post.published',
        aggregateId: id,
        payload: {
          authorUserId: actor.userId,
          type: input.type,
          ...(communityId === undefined ? {} : { communityId }),
          ...(journeyStepId === undefined ? {} : { journeyStepId }),
          mediaCount: mediaIds.length,
          // RÈGLE DURE (13 §2) : le consommateur « moderation (analyse) » de §6
          // reçoit le texte MASQUÉ, jamais le corps brut.
          ...this.moderationPayload(input.body),
        },
      });
    });

    return this.postDetail(actor, id);
  }

  /**
   * LES GUIDES QU'ON PEUT VRAIMENT LIER.
   *
   * Un identifiant qui ne désigne aucun guide PUBLIÉ est ÉCARTÉ, et non refusé :
   * la différence compte. Refuser ferait échouer toute la publication parce qu'un
   * guide a été dépublié entre le moment où le membre l'a choisi et celui où il
   * appuie sur « Publier » — un délai qui se compte en minutes dans un composeur.
   * L'écarter publie ce qui est publiable, et l'étiquette absente se voit.
   *
   * L'ORDRE DU MEMBRE EST GARDÉ : `findMany` rend l'ordre de l'index, pas celui
   * de la liste. On réordonne donc sur l'entrée, sinon les trois étiquettes
   * s'afficheraient dans un ordre que personne n'a choisi.
   */
  private async resolveGuides(ids: readonly string[]): Promise<string[]> {
    if (ids.length === 0) return [];
    const uniques = [...new Set(ids)].slice(0, FEED_LIMITS.postGuidesMax);
    const rows = await this.prisma.guide.findMany({
      where: { id: { in: uniques }, deletedAt: null, status: 'PUBLISHED' },
      select: { id: true },
    });
    const connus = new Set(rows.map((r) => r.id));
    return uniques.filter((id) => connus.has(id));
  }

  /**
   * `PATCH /posts/:id` (§2.4) : « Modification : 15 minutes après publication,
   * puis figée (mention "modifié"). »
   *
   * Le TYPE n'est pas modifiable — §2.1 : « Modifiable jusqu'à la publication,
   * pas après. » Le schéma de mise à jour ne le porte donc pas du tout, plutôt
   * que de l'accepter pour le refuser ensuite.
   */
  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ PLUS DE DÉLAI DE QUINZE MINUTES SUR UNE PUBLICATION                     ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur : « C'est quoi cette affaire de délai de modification de 15 min
   * pour les publications dans le fil d'actualité ? Corrige ça. On peut modifier
   * quand on veut. »
   *
   * §2.4 l'écrivait, et le refus était donc fidèle à la spec. C'est un ARBITRAGE
   * DU PORTEUR qui la remplace, et il est consigné ici parce que rien d'autre ne
   * dirait pourquoi le code s'écarte de `docs/specs/04-fil.md`.
   *
   * CE QUI NE CHANGE PAS, et qui est la raison d'être de cette route :
   *
   *   · `ownedPost` — seul l'auteur modifie la sienne ;
   *   · `assertPostPublishable` — le texte modifié REPASSE par le filtre local,
   *     sinon publier un texte acceptable puis le remplacer le contournerait ;
   *   · `moderationStatus: 'PENDING'` — une publication modifiée repasse en
   *     modération, quel que soit son âge. C'est ce qui rend l'ouverture tenable :
   *     sans délai, un contenu ancien et déjà validé peut être réécrit, et il doit
   *     donc être revu comme s'il était neuf.
   *
   * LE DÉLAI RESTE SUR LES COMMENTAIRES (§2.5). Le porteur a nommé les
   * publications, et un commentaire est une réponse à quelqu'un : le réécrire des
   * jours plus tard change le sens de ce à quoi d'autres ont déjà répondu. Si cela
   * doit tomber aussi, c'est une seconde décision, pas une conséquence de
   * celle-ci.
   */
  async updatePost(actor: FeedActor, id: string, patch: UpdatePost) {
    const post = await this.ownedPost(actor.userId, id);

    // Le texte modifié repasse par les règles locales : sans cela, publier un
    // texte acceptable puis le remplacer contournerait entièrement le filtre.
    this.assertPostPublishable(patch.body);

    /**
     * ╔═════════════════════════════════════════════════════════════════════╗
     * ║ LES PIÈCES JOINTES SE VÉRIFIENT AVANT LA TRANSACTION                    ║
     * ╚══════════════════════════════════════════════════════════════════════╝
     *
     * `resolveMedia` refuse un média qui n'est pas à soi ou pas prêt ;
     * `resolveGuides` écarte ce qui n'est pas publié. Les appeler DEDANS tiendrait
     * la transaction ouverte pendant des lectures qui peuvent échouer, et le
     * message d'erreur arriverait après un rollback — plus lisible avant.
     */
    const mediaIds =
      patch.mediaIds === undefined
        ? undefined
        : await this.resolveMedia(actor.userId, patch.mediaIds);
    const guideIds =
      patch.guideIds === undefined ? undefined : await this.resolveGuides(patch.guideIds);

    /**
     * ╔═════════════════════════════════════════════════════════════════════╗
     * ║ UN SONDAGE DÉJÀ VOTÉ NE SE MODIFIE PAS, ET NE SE RETIRE PAS            ║
     * ╚══════════════════════════════════════════════════════════════════════╝
     *
     * Changer le libellé d'une option après coup RÉÉCRIRAIT ce que des membres ont
     * choisi ; le retirer effacerait leur voix. Un sondage voté est un engagement
     * pris envers ses votants, et c'est la SEULE règle de ce lot qui refuse un
     * geste à l'auteur de sa propre publication.
     *
     * La fenêtre de quinze minutes ne suffit pas à l'empêcher : un sondage peut
     * recevoir un vote dans la minute qui suit sa publication.
     */
    if (patch.poll !== undefined) {
      /**
       * LE COMPTE PASSE PAR LES OPTIONS : `poll_votes` porte `poll_option_id`, pas
       * `poll_id` — un vote appartient à une OPTION. `Poll` n'a donc aucune
       * relation `votes` à compter directement, et c'est la table des votes qu'on
       * interroge, par les options du sondage.
       */
      const existant = await this.prisma.poll.findUnique({
        where: { postId: id },
        select: { id: true },
      });
      if (existant !== null) {
        const votes = await this.prisma.pollVote.count({
          where: { pollOption: { pollId: existant.id } },
        });
        if (votes > 0) this.fail('POLL_HAS_VOTES');
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.post.update({
        where: { id },
        data: { body: patch.body, moderationStatus: 'PENDING' },
      });

      /**
       * ON REMPLACE, ON NE FUSIONNE PAS. `mediaIds` décrit l'ÉTAT VOULU, pas un
       * ajout : la fenêtre de modification montre les images restantes, et ce
       * qu'elle rend est ce que la publication doit porter. Fusionner rendrait le
       * retrait d'une image impossible.
       *
       * LA POSITION EST CELLE DU TABLEAU REÇU : l'ordre que l'auteur voit dans la
       * fenêtre est celui que le carrousel rendra.
       */
      if (mediaIds !== undefined) {
        await tx.postMedia.deleteMany({ where: { postId: id } });
        if (mediaIds.length > 0) {
          await tx.postMedia.createMany({
            data: mediaIds.map((mediaAssetId, position) => ({
              id: newId(),
              postId: id,
              mediaAssetId,
              position,
            })),
          });
        }
      }

      if (guideIds !== undefined) {
        await tx.postGuide.deleteMany({ where: { postId: id } });
        if (guideIds.length > 0) {
          await tx.postGuide.createMany({
            data: guideIds.map((guideId, position) => ({ postId: id, guideId, position })),
          });
        }
      }

      /**
       * LE SONDAGE EST REMPLACÉ EN ENTIER, options comprises. `onDelete: Cascade`
       * sur `poll_options` emporte les anciennes ; les votes, eux, ne peuvent pas
       * exister — le refus ci-dessus l'a déjà garanti.
       */
      if (patch.poll !== undefined) {
        await tx.poll.deleteMany({ where: { postId: id } });
        if (patch.poll !== null) {
          const pollId = newId();
          await tx.poll.create({
            data: {
              id: pollId,
              postId: id,
              authorUserId: actor.userId,
              question: patch.poll.question,
              isMultiple: patch.poll.isMultiple,
              resultsAfterVote: patch.poll.resultsAfterVote,
              isAnonymous: patch.poll.isAnonymous,
              ...(patch.poll.closesAt === undefined ? {} : { closesAt: patch.poll.closesAt }),
            },
          });
          await tx.pollOption.createMany({
            data: patch.poll.options.map((label, position) => ({
              id: newId(),
              pollId,
              label,
              position,
            })),
          });
        }
      }
      await this.outbox.emit(tx, {
        type: 'post.published',
        aggregateId: id,
        payload: {
          authorUserId: actor.userId,
          type: post.type,
          edited: true,
          ...this.moderationPayload(patch.body),
        },
      });
    });

    return this.postDetail(actor, id);
  }

  /** `DELETE /posts/:id` (§4) : suppression logique par l'auteur (§2.4). */
  async deletePost(actor: FeedActor, id: string): Promise<void> {
    const post = await this.ownedPost(actor.userId, id);
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.post.update({
        where: { id },
        data: { deletedAt: now, status: 'REMOVED' },
      });
      await this.audit.record(tx, {
        actor: { type: 'MEMBER', id: actor.userId },
        action: 'post.deleted',
        targetType: 'post',
        targetId: id,
        metadata: { type: post.type, reactionCount: post.reactionCount, commentCount: post.commentCount },
      });
    });
  }

  /**
   * `PUT /posts/:id/reaction` (§4) : « le serveur déduit le `kind` du type ».
   *
   * RÈGLE DURE (§9) : « le vocabulaire de réaction renvoyé correspond au type de
   * publication. » Le client n'envoie donc AUCUN `kind` — il n'y a rien à
   * valider, et donc rien à contourner. La table `POST_REACTION_KIND` est la
   * seule autorité (§2.1).
   *
   * Capacité `comment.create` (L0) : réagir n'attend pas la vérification
   * d'identité (§9, même règle que le commentaire).
   */
  async reactToPost(actor: FeedActor, id: string) {
    const post = await this.visiblePost(actor, id);
    const kind = POST_REACTION_KIND[post.type];

    const existing = await this.prisma.postReaction.findUnique({
      where: { postId_userId: { postId: id, userId: actor.userId } },
      select: { id: true, kind: true },
    });

    if (existing === null) {
      await this.prisma.$transaction(async (tx) => {
        await tx.postReaction.create({
          data: { id: newId(), postId: id, userId: actor.userId, kind },
        });
        // Compteur dénormalisé (00 §6) : incrémenté dans la MÊME transaction,
        // sinon la carte affiche un nombre faux jusqu'au prochain recalcul.
        await tx.post.update({ where: { id }, data: { reactionCount: { increment: 1 } } });
        await this.outbox.emit(tx, {
          type: 'post.reacted',
          aggregateId: id,
          payload: {
            userId: actor.userId,
            authorUserId: post.authorUserId,
            kind,
            // §6 : « reputation (aucun effet — les réactions ne comptent pas) ».
            // Dit dans la charge utile pour qu'aucun consommateur n'ait à le
            // deviner : une réaction ne crédite RIEN.
            affectsReputation: false,
          },
        });
      });
    }

    return this.reactionState(id, post.type, kind);
  }

  /** `DELETE /posts/:id/reaction` (§2.1 : « cliquer à nouveau la retire »). */
  async unreactToPost(actor: FeedActor, id: string) {
    const post = await this.visiblePost(actor, id);

    await this.prisma.$transaction(async (tx) => {
      const removed = await tx.postReaction.deleteMany({
        where: { postId: id, userId: actor.userId },
      });
      // Décrémenter sans avoir supprimé ferait dériver le compteur sous zéro à
      // chaque rejeu — la garde `gt: 0` vaut ceinture et bretelles.
      if (removed.count > 0) {
        await tx.post.updateMany({
          where: { id, reactionCount: { gt: 0 } },
          data: { reactionCount: { decrement: removed.count } },
        });
      }
    });

    return this.reactionState(id, post.type, null);
  }

  /**
   * `POST /posts/:id/move-to-topic` (§2.3 et §4).
   *
   * RÈGLE DURE (§9) : « le déplacement vers un réseau n'est jamais
   * automatique. » Rien dans ce module ne l'appelle : ni `createComment`, ni une
   * tâche, ni un gestionnaire d'événement. Le franchissement des 5 commentaires
   * ne fait qu'allumer `canMoveToTopic` dans la réponse de `GET /posts/:id` —
   * une INVITATION, que seul cet appel exauce.
   *
   * « création d'un `topic` avec le corps ET LES COMMENTAIRES copiés » : les deux
   * dans la même transaction. Un sujet créé sans ses commentaires perdrait
   * exactement ce qui justifiait le déplacement.
   */
  async moveToTopic(actor: FeedActor, id: string, input: MoveToTopic) {
    const post = await this.ownedPost(actor.userId, id);

    if (post.type !== 'QUESTION') this.fail('NOT_A_QUESTION', { type: post.type });
    if (post.movedToTopicId !== null) this.fail('ALREADY_MOVED', { topicId: post.movedToTopicId });
    if (post.commentCount <= FEED_LIMITS.moveToTopicMinReplies) {
      this.fail('NOT_ENOUGH_REPLIES', {
        commentCount: post.commentCount,
        required: FEED_LIMITS.moveToTopicMinReplies + 1,
      });
    }

    const community = await this.prisma.community.findFirst({
      where: {
        id: input.communityId,
        status: 'ACTIVE',
        members: { some: { userId: actor.userId, status: 'ACTIVE' } },
      },
      select: { id: true, name: true, slug: true },
    });
    if (community === null) this.fail('NOT_COMMUNITY_MEMBER', { communityId: input.communityId });

    const comments = await this.prisma.comment.findMany({
      where: { subjectType: 'POST', subjectId: id, deletedAt: null, status: 'PUBLISHED' },
      orderBy: { id: 'asc' },
      select: { id: true, authorUserId: true, parentCommentId: true, body: true, createdAt: true },
    });

    const topicId = newId();
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.topic.create({
        data: {
          id: topicId,
          communityId: community.id,
          authorUserId: actor.userId,
          title: excerpt(post.body, 110),
          body: post.body,
          status: 'OPEN',
          pinKind: 'NONE',
          replyCount: comments.length,
          ...(comments.length === 0 ? {} : { lastReplyAt: now }),
          originPostId: id,
        },
      });

      // La copie conserve la STRUCTURE : un commentaire racine reste racine, une
      // réponse reste attachée à la copie de son parent. Recopier les réponses à
      // plat les transformerait en commentaires indépendants, et la discussion
      // deviendrait illisible dans le réseau.
      const idMap = new Map<string, string>();
      for (const comment of comments.filter((c) => c.parentCommentId === null)) {
        const copyId = newId();
        idMap.set(comment.id, copyId);
        await tx.comment.create({
          data: {
            id: copyId,
            subjectType: 'TOPIC',
            subjectId: topicId,
            authorUserId: comment.authorUserId,
            body: comment.body,
            status: 'PUBLISHED',
          },
        });
      }
      for (const comment of comments.filter((c) => c.parentCommentId !== null)) {
        const parentCopy =
          comment.parentCommentId === null ? undefined : idMap.get(comment.parentCommentId);
        if (parentCopy === undefined) continue;
        await tx.comment.create({
          data: {
            id: newId(),
            subjectType: 'TOPIC',
            subjectId: topicId,
            authorUserId: comment.authorUserId,
            parentCommentId: parentCopy,
            body: comment.body,
            status: 'PUBLISHED',
          },
        });
      }

      await tx.post.update({ where: { id }, data: { movedToTopicId: topicId } });
      // Le réseau vient de vivre : 07 §2 fait de `last_activity_at` le compteur
      // d'archivage automatique, et un sujet déposé sans le toucher pourrait
      // faire endormir un réseau qui vient de recevoir une question.
      await tx.community.update({ where: { id: community.id }, data: { lastActivityAt: now } });

      await this.audit.record(tx, {
        actor: { type: 'MEMBER', id: actor.userId },
        action: 'post.moved_to_topic',
        targetType: 'post',
        targetId: id,
        metadata: { topicId, communityId: community.id, copiedComments: comments.length },
      });

      await this.outbox.emit(tx, {
        type: 'post.moved_to_topic',
        aggregateId: id,
        payload: {
          topicId,
          communityId: community.id,
          authorUserId: actor.userId,
          copiedComments: comments.length,
        },
      });
    });

    return {
      topicId,
      community,
      /** §2.3 : la publication RESTE, avec son lien vers la suite. */
      post: { id, movedToTopicId: topicId, label: `Suite dans le réseau ${community.name}` },
    };
  }

  // ══ ÉCRITURES — COMMENTAIRES ═══════════════════════════════════════════════

  /**
   * `POST /comments` (§2.5 et §4).
   *
   * Capacité `comment.create`, ouverte dès L0 (§9 : « un L0 ne peut pas publier
   * mais peut commenter et réagir »). AUCUNE vérification de niveau ici — en
   * ajouter une serait précisément casser la règle dure.
   */
  async createComment(actor: FeedActor, input: CreateComment) {
    await this.assertSubjectVisible(actor, input.subjectType, input.subjectId);
    this.assertPostPublishable(input.body);
    await this.assertCommentQuota(actor.userId);

    // §2.5 : « Une profondeur de réponse (`parent_comment_id` non nul → pas de
    // réponse à une réponse). »
    if (input.parentCommentId !== undefined) {
      const parent = await this.prisma.comment.findUnique({
        where: { id: input.parentCommentId },
        select: {
          id: true,
          parentCommentId: true,
          subjectType: true,
          subjectId: true,
          deletedAt: true,
        },
      });
      if (parent === null || parent.deletedAt !== null) throw ApiError.notFound();
      // Le parent doit porter sur LE MÊME sujet : sans ce contrôle, on
      // rattacherait une réponse au commentaire d'un autre contenu, et la
      // réponse apparaîtrait sous les deux.
      if (parent.subjectType !== input.subjectType || parent.subjectId !== input.subjectId) {
        throw ApiError.notFound();
      }
      if (parent.parentCommentId !== null) {
        this.fail('DEPTH_EXCEEDED', { parentCommentId: parent.id });
      }
    }

    const id = newId();
    await this.prisma.$transaction(async (tx) => {
      await tx.comment.create({
        data: {
          id,
          subjectType: input.subjectType,
          subjectId: input.subjectId,
          authorUserId: actor.userId,
          body: input.body,
          status: 'PUBLISHED',
          ...(input.parentCommentId === undefined
            ? {}
            : { parentCommentId: input.parentCommentId }),
        },
      });

      // §2.5 : « Un commentaire sur une QUESTION incrémente `comment_count` qui
      // sert de "N réponses". » Le compteur est incrémenté pour TOUS les types de
      // publication — c'est le même champ, et §2.1 le montre sous chaque carte.
      //
      // Pour TOPIC, GUIDE et EVENT, le compteur appartient à leur module
      // (`topics.reply_count` en particulier) : ce module n'y touche pas, et
      // l'événement `post.commented` porte le sujet pour qu'ils le fassent.
      if (input.subjectType === 'POST') {
        await tx.post.update({
          where: { id: input.subjectId },
          data: { commentCount: { increment: 1 } },
        });
      }

      await this.outbox.emit(tx, {
        type: 'post.commented',
        aggregateId: input.subjectId,
        payload: {
          commentId: id,
          subjectType: input.subjectType,
          authorUserId: actor.userId,
          ...(input.parentCommentId === undefined
            ? {}
            : { parentCommentId: input.parentCommentId }),
          ...this.moderationPayload(input.body),
        },
      });
    });

    const created = await this.prisma.comment.findUniqueOrThrow({
      where: { id },
      include: { author: { select: AUTHOR_SELECT } },
    });
    return { comment: { ...this.commentCard(created, actor.userId), replies: [] } };
  }

  /** `PATCH /comments/:id` (§2.5) : 15 minutes, comme la publication. */
  async updateComment(actor: FeedActor, id: string, patch: UpdateComment) {
    const comment = await this.ownedComment(actor.userId, id);

    const deadline = comment.createdAt.getTime() + FEED_LIMITS.editWindowMinutes * 60_000;
    if (Date.now() > deadline) {
      this.fail('EDIT_WINDOW_CLOSED', { publishedAt: comment.createdAt.toISOString() });
    }
    this.assertPostPublishable(patch.body);

    const updated = await this.prisma.comment.update({
      where: { id },
      data: { body: patch.body },
      include: { author: { select: AUTHOR_SELECT } },
    });
    return { comment: { ...this.commentCard(updated, actor.userId), replies: [] } };
  }

  /** `DELETE /comments/:id` (§2.5) : suppression logique. */
  async deleteComment(actor: FeedActor, id: string): Promise<void> {
    const comment = await this.ownedComment(actor.userId, id);

    await this.prisma.$transaction(async (tx) => {
      await tx.comment.update({
        where: { id },
        data: { deletedAt: new Date(), status: 'REMOVED' },
      });
      if (comment.subjectType === 'POST') {
        await tx.post.updateMany({
          where: { id: comment.subjectId, commentCount: { gt: 0 } },
          data: { commentCount: { decrement: 1 } },
        });
      }
    });
  }

  // ══ ÉCRITURES — STORIES ════════════════════════════════════════════════════

  /**
   * `POST /stories` (§2.6 et §4) — « trois étapes côté client, UN SEUL appel
   * API ». Le service reçoit donc tout d'un coup, et refuse tout d'un coup.
   *
   * RÈGLE DURE (§2.6) : « Une story ne contient ni lien, ni numéro, ni email. »
   * Le contrôle est SYNCHRONE et bloquant — contrairement au verdict IA, qui
   * laisse la publication visible. Une story vit 24 h : la mettre en file
   * reviendrait à la laisser passer.
   */
  async createStory(actor: FeedActor, input: CreateStory) {
    if (!levelSatisfies(actor.level, 'post.create')) {
      throw ApiError.levelRequired('post.create', actor.level);
    }

    this.assertStoryPublishable(input.body);
    await this.assertStoryQuota(actor.userId);

    const attachment = await this.resolveStoryAttachment(actor.userId, input);
    if (input.backgroundAssetId !== undefined) {
      await this.resolveMedia(actor.userId, [input.backgroundAssetId]);
    }

    const now = new Date();
    // §2.6 : « Expiration : 24 h, ou `valid_until` si plus tôt. »
    const lifetime = new Date(now.getTime() + FEED_LIMITS.storyLifetimeHours * 3_600_000);
    const expiresAt =
      attachment.validUntil !== null && attachment.validUntil.getTime() < lifetime.getTime()
        ? attachment.validUntil
        : lifetime;

    const id = newId();
    await this.prisma.$transaction(async (tx) => {
      await tx.story.create({
        data: {
          id,
          authorUserId: actor.userId,
          type: input.type,
          body: input.body,
          textStyle: input.textStyle,
          cityId: attachment.cityId,
          audience: input.audience,
          allowMessages: input.allowMessages,
          status: 'ACTIVE',
          moderationStatus: 'PENDING',
          expiresAt,
          ...(input.backgroundColor === undefined ? {} : { backgroundColor: input.backgroundColor }),
          ...(input.backgroundAssetId === undefined
            ? {}
            : { backgroundAssetId: input.backgroundAssetId }),
          ...(attachment.stepDefinitionId === null
            ? {}
            : { stepDefinitionId: attachment.stepDefinitionId }),
          ...(attachment.category === null ? {} : { category: attachment.category }),
          ...(attachment.categoryOther === null
            ? {}
            : { categoryOther: attachment.categoryOther }),
          ...(attachment.placeLabel === null ? {} : { placeLabel: attachment.placeLabel }),
          ...(attachment.validUntil === null ? {} : { validUntil: attachment.validUntil }),
        },
      });

      await this.outbox.emit(tx, {
        type: 'story.published',
        aggregateId: id,
        payload: {
          authorUserId: actor.userId,
          type: input.type,
          cityId: attachment.cityId,
          category: attachment.category,
          stepDefinitionId: attachment.stepDefinitionId,
          audience: input.audience,
          allowMessages: input.allowMessages,
          expiresAt: expiresAt.toISOString(),
          // §2.6 : « une INFORMATION de sujet démarches ouvre un dossier
          // priorité 2 si verdict QUEUE ». La priorité est portée par
          // l'événement plutôt que déduite par le module 13 : c'est §04 qui sait
          // pourquoi ce sujet compte.
          moderationPriority:
            input.type === 'INFORMATION' && attachment.category === STORY_PAPERWORK_SUBJECT ? 2 : null,
          ...this.moderationPayload(input.body),
        },
      });
    });

    return this.storyDetail(actor, id);
  }

  /**
   * `PUT /stories/:id/reaction` (§4).
   *
   * RÈGLE DURE (§9) : « une réaction dont le `kind` n'appartient pas au type de
   * la story est refusée. » §2.6 : « le service refuse un `kind` qui n'appartient
   * pas au type » — le SERVICE, pas le schéma : `KIND_NOT_ALLOWED_FOR_TYPE` est
   * un code nommé par §4, et un `VALIDATION_FAILED` sur l'énumération ne dirait
   * pas au membre que son vote existe ailleurs.
   *
   * §2.6 : « `score = positive_count − negative_count` recalculé toutes les 15
   * minutes. » Les COMPTEURS bougent tout de suite (ils s'affichent sous les
   * boutons), le SCORE non : c'est la tâche `story.score_recompute` qui le pose,
   * et le classement du bandeau ne doit pas sauter à chaque vote.
   */
  async reactToStory(actor: FeedActor, id: string, input: StoryReactionInput) {
    const story = await this.visibleStory(actor, id);

    if (!storyReactionAllowed(story.type, input.kind)) {
      this.fail('KIND_NOT_ALLOWED_FOR_TYPE', {
        type: story.type,
        kind: input.kind,
        allowed: [
          STORY_TYPE_VOCABULARY[story.type].positive.kind,
          STORY_TYPE_VOCABULARY[story.type].negative.kind,
        ],
      });
    }

    const positiveKind = STORY_TYPE_VOCABULARY[story.type].positive.kind;
    const isPositive = input.kind === positiveKind;

    const existing = await this.prisma.storyReaction.findUnique({
      where: { storyId_userId: { storyId: id, userId: actor.userId } },
      select: { id: true, kind: true },
    });
    const wasPositive = existing === null ? null : existing.kind === positiveKind;

    if (existing !== null && wasPositive === isPositive) return this.storyVotes(id, story.type);

    const before = { positive: story.positiveCount, negative: story.negativeCount };

    await this.prisma.$transaction(async (tx) => {
      await tx.storyReaction.upsert({
        where: { storyId_userId: { storyId: id, userId: actor.userId } },
        create: { id: newId(), storyId: id, userId: actor.userId, kind: input.kind },
        update: { kind: input.kind },
      });

      // « une réaction par membre et par story, MODIFIABLE » (§2.6) : changer de
      // camp décrémente l'ancien compteur et incrémente le nouveau. Sans le
      // décrément, un membre qui hésite gonflerait les deux.
      const data: Prisma.StoryUpdateInput = isPositive
        ? { positiveCount: { increment: 1 } }
        : { negativeCount: { increment: 1 } };
      if (wasPositive === true) data.positiveCount = { decrement: 1 };
      if (wasPositive === false) data.negativeCount = { decrement: 1 };
      await tx.story.update({ where: { id }, data });

      await this.outbox.emit(tx, {
        type: 'story.reacted',
        aggregateId: id,
        payload: {
          userId: actor.userId,
          authorUserId: story.authorUserId,
          kind: input.kind,
          positive: isPositive,
        },
      });
    });

    await this.flagIfMassivelyNegative(id, before, isPositive, wasPositive);
    return this.storyVotes(id, story.type);
  }

  /** `DELETE /stories/:id/reaction` (§4). */
  async unreactToStory(actor: FeedActor, id: string) {
    const story = await this.visibleStory(actor, id);
    const positiveKind = STORY_TYPE_VOCABULARY[story.type].positive.kind;

    const existing = await this.prisma.storyReaction.findUnique({
      where: { storyId_userId: { storyId: id, userId: actor.userId } },
      select: { kind: true },
    });
    if (existing === null) return this.storyVotes(id, story.type);

    const wasPositive = existing.kind === positiveKind;
    await this.prisma.$transaction(async (tx) => {
      await tx.storyReaction.deleteMany({ where: { storyId: id, userId: actor.userId } });
      await tx.story.updateMany({
        where: wasPositive ? { id, positiveCount: { gt: 0 } } : { id, negativeCount: { gt: 0 } },
        data: wasPositive
          ? { positiveCount: { decrement: 1 } }
          : { negativeCount: { decrement: 1 } },
      });
    });

    return this.storyVotes(id, story.type);
  }

  /**
   * `POST /stories/:id/convert` (§2.6 et §4) : « avant expiration, l'auteur peut
   * GARDER une story ».
   *
   * « Jamais automatique » (§2.6) : aucune tâche ni gestionnaire d'événement de
   * ce fichier n'appelle cette méthode. `story.expire` fait expirer, elle ne
   * convertit rien.
   */
  async convertStory(actor: FeedActor, id: string, input: ConvertStory) {
    const story = await this.prisma.story.findUnique({
      where: { id },
      select: {
        id: true,
        authorUserId: true,
        type: true,
        body: true,
        category: true,
        placeLabel: true,
        cityId: true,
        status: true,
        expiresAt: true,
        deletedAt: true,
        convertedToId: true,
      },
    });
    if (story === null || story.deletedAt !== null) throw ApiError.notFound();
    if (story.authorUserId !== actor.userId) this.fail('NOT_AUTHOR');
    if (story.convertedToId !== null) {
      this.fail('ALREADY_CONVERTED', { convertedToId: story.convertedToId });
    }
    if (story.status === 'EXPIRED' || story.expiresAt.getTime() <= Date.now()) {
      this.fail('STORY_EXPIRED', { expiresAt: story.expiresAt.toISOString() });
    }

    const isPaperworkInfo =
      story.type === 'INFORMATION' && story.category === STORY_PAPERWORK_SUBJECT;

    if (input.target === 'HELP_REQUEST' && story.type !== 'CONSEIL' && !isPaperworkInfo) {
      // §2.6 : « un conseil OU une information de sujet démarches devient une
      // demande d'entraide ». Une découverte, non — elle devient un `city_tip`.
      this.fail('INVALID_CONVERSION_TARGET', { type: story.type, category: story.category });
    }
    if (input.target === 'CITY_TIP' && story.type !== 'DECOUVERTE') {
      this.fail('INVALID_CONVERSION_TARGET', { type: story.type });
    }

    const targetId = newId();
    await this.prisma.$transaction(async (tx) => {
      if (input.target === 'HELP_REQUEST') {
        await tx.helpRequest.create({
          data: {
            id: targetId,
            authorUserId: actor.userId,
            kind: 'REQUEST',
            // §2.1 de 06 : le logement et l'emploi n'existent pas en entraide.
            // Une story de sujet démarches devient une demande PAPERWORK ; tout
            // le reste part en OTHER plutôt que d'inventer une correspondance.
            type: story.category === STORY_PAPERWORK_SUBJECT ? 'PAPERWORK' : 'OTHER',
            title: excerpt(story.body, 110),
            body: story.body,
            cityId: story.cityId,
            status: 'OPEN',
            moderationStatus: 'PENDING',
          },
        });
      } else {
        await tx.cityTip.create({
          data: {
            id: targetId,
            cityId: story.cityId,
            authorUserId: actor.userId,
            kind: tipKindFor(story.category),
            body: story.placeLabel === null ? story.body : `${story.placeLabel} — ${story.body}`,
            status: 'PUBLISHED',
            // §2.6 : « la fiche ville (module 09) si l'auteur la garde :
            // `city_tips.source_story_id` ». C'est ce champ qui permet de
            // remonter du conseil de ville à la story qui l'a produit.
            sourceStoryId: id,
          },
        });
      }

      await tx.story.update({
        where: { id },
        data: {
          convertedToType: input.target === 'HELP_REQUEST' ? 'help_request' : 'city_tip',
          convertedToId: targetId,
        },
      });

      await this.outbox.emit(tx, {
        type: 'story.converted',
        aggregateId: id,
        payload: {
          authorUserId: actor.userId,
          target: input.target,
          targetId,
          storyType: story.type,
          cityId: story.cityId,
        },
      });
    });

    return { target: input.target, targetId, storyId: id };
  }

  /** `DELETE /stories/:id` (§4 et §8 : « stories : supprimées »). */
  async deleteStory(actor: FeedActor, id: string): Promise<void> {
    const story = await this.prisma.story.findUnique({
      where: { id },
      select: { id: true, authorUserId: true, deletedAt: true, type: true },
    });
    if (story === null || story.deletedAt !== null) throw ApiError.notFound();
    if (story.authorUserId !== actor.userId) this.fail('NOT_AUTHOR');

    await this.prisma.$transaction(async (tx) => {
      await tx.story.update({
        where: { id },
        data: { deletedAt: new Date(), status: 'REMOVED' },
      });
      // §8 : « les signets des autres membres affichent "Contenu retiré" ». Le
      // signet n'est PAS supprimé : c'est l'écran qui le rend, et retirer le
      // signet ferait disparaître la trace sans rien expliquer.
      await this.audit.record(tx, {
        actor: { type: 'MEMBER', id: actor.userId },
        action: 'story.deleted',
        targetType: 'story',
        targetId: id,
        metadata: { type: story.type },
      });
    });
  }

  // ══ TÂCHES PLANIFIÉES (§7) ═════════════════════════════════════════════════

  /**
   * `story.expire`, toutes les 5 minutes (§7) : « `status = EXPIRED`, retrait du
   * bandeau ».
   *
   * `now` est un paramètre : une tâche qui ne dépend que de l'horloge système ne
   * s'éprouve qu'en attendant 24 heures, donc ne s'éprouve pas.
   */
  async expireStories(now: Date = new Date()): Promise<{ expired: number }> {
    const due = await this.prisma.story.findMany({
      where: { status: 'ACTIVE', deletedAt: null, expiresAt: { lte: now } },
      select: { id: true, authorUserId: true, type: true, cityId: true, category: true },
    });
    if (due.length === 0) return { expired: 0 };

    await this.prisma.$transaction(async (tx) => {
      await tx.story.updateMany({
        where: { id: { in: due.map((s) => s.id) } },
        data: { status: 'EXPIRED' },
      });
      await this.outbox.emitMany(
        tx,
        due.map((s) => ({
          type: 'story.expired' as const,
          aggregateId: s.id,
          payload: {
            authorUserId: s.authorUserId,
            type: s.type,
            cityId: s.cityId,
            category: s.category,
          },
          occurredAt: now,
        })),
      );
    });

    this.logger.log(`story.expire : ${due.length} story(ies) expirée(s)`);
    return { expired: due.length };
  }

  /**
   * `story.score_recompute`, toutes les 15 minutes (§7 et §2.6).
   *
   * En SQL et non en boucle Prisma : c'est une passe sur toutes les stories
   * actives, et N+1 requêtes toutes les quinze minutes finiraient par se voir.
   * `updated_at` n'est volontairement pas touché — le score est une dérivée
   * calculée, pas une modification du contenu.
   */
  async recomputeStoryScores(stepDefinitionId?: string): Promise<{ updated: number }> {
    const updated =
      stepDefinitionId === undefined
        ? await this.prisma.$executeRaw`
            UPDATE stories
            SET score = positive_count - negative_count
            WHERE status = 'ACTIVE'
              AND deleted_at IS NULL
              AND score <> positive_count - negative_count`
        : await this.prisma.$executeRaw`
            UPDATE stories
            SET score = positive_count - negative_count
            WHERE status = 'ACTIVE'
              AND deleted_at IS NULL
              AND step_definition_id = ${stepDefinitionId}::uuid
              AND score <> positive_count - negative_count`;
    return { updated };
  }

  /**
   * `story.purge_history`, quotidienne (§7) : « 30 jours après expiration, SAUF
   * enregistrées ».
   *
   * L'exception au signet n'est pas exprimable dans un `deleteMany` : `bookmarks`
   * est polymorphe et n'a aucune relation Prisma vers `stories`. D'où les deux
   * temps — candidats, puis retrait de ceux que quelqu'un a gardés. Supprimer
   * une story enregistrée viderait le signet d'un AUTRE membre, ce que §2.6
   * interdit explicitement (« tant que le signet existe »).
   */
  async purgeStoryHistory(now: Date = new Date()): Promise<{ purged: number; keptForBookmark: number }> {
    const cutoff = new Date(now.getTime() - FEED_LIMITS.storyHistoryDays * DAY_MS);
    const candidates = await this.prisma.story.findMany({
      where: { status: 'EXPIRED', expiresAt: { lt: cutoff } },
      select: { id: true },
    });
    if (candidates.length === 0) return { purged: 0, keptForBookmark: 0 };

    const ids = candidates.map((c) => c.id);
    const bookmarked = await this.prisma.bookmark.findMany({
      where: { subjectType: 'STORY', subjectId: { in: ids } },
      select: { subjectId: true },
      distinct: ['subjectId'],
    });
    const kept = new Set(bookmarked.map((b) => b.subjectId));
    const purgeable = ids.filter((id) => !kept.has(id));
    if (purgeable.length === 0) return { purged: 0, keptForBookmark: kept.size };

    const result = await this.prisma.story.deleteMany({ where: { id: { in: purgeable } } });
    this.logger.log(
      `story.purge_history : ${result.count} supprimée(s), ${kept.size} gardée(s) pour signet`,
    );
    return { purged: result.count, keptForBookmark: kept.size };
  }

  // ══ CONSOMMATEURS D'ÉVÉNEMENTS (§6) ════════════════════════════════════════

  /**
   * `moderation.content_hidden` (§6 : « statut »).
   *
   * Le seul des trois qui ÉCRIT. Le module 13 décide, le fil applique : le
   * contenu passe `HIDDEN`, et sort donc de toutes les listes, qui filtrent
   * `status = PUBLISHED`.
   *
   * Idempotent par construction : poser `HIDDEN` deux fois donne `HIDDEN`. Un
   * sujet qui n'appartient pas à ce module (un guide, une annonce) est ignoré
   * sans lever — lever ferait rejouer dix fois un travail qui n'est pas le nôtre.
   * En revanche, une panne de base remonte : c'est ce qui doit être rejoué.
   */
  async handleContentHidden(payload: unknown): Promise<{ hidden: number }> {
    const parsed = readSubject(payload);
    if (parsed === null) {
      this.logger.warn('moderation.content_hidden : charge utile illisible, ignorée');
      return { hidden: 0 };
    }

    if (parsed.subjectType === 'POST') {
      const r = await this.prisma.post.updateMany({
        where: { id: parsed.subjectId },
        data: { status: 'HIDDEN', moderationStatus: 'FLAGGED' },
      });
      return { hidden: r.count };
    }
    if (parsed.subjectType === 'STORY') {
      const r = await this.prisma.story.updateMany({
        where: { id: parsed.subjectId },
        data: { status: 'HIDDEN', moderationStatus: 'FLAGGED' },
      });
      return { hidden: r.count };
    }
    if (parsed.subjectType === 'COMMENT') {
      // `comments` n'a pas de `moderation_status` (schéma figé) : le masquage se
      // lit donc uniquement sur `status`. Signalé dans le rapport du module.
      const r = await this.prisma.comment.updateMany({
        where: { id: parsed.subjectId },
        data: { status: 'HIDDEN' },
      });
      return { hidden: r.count };
    }
    return { hidden: 0 };
  }

  /**
   * `user.blocked` (§6 : « exclusion »).
   *
   * Ce module n'a RIEN à écrire sur un blocage, et c'est une conclusion, pas un
   * oubli : l'exclusion de §2.3 et de §4 (« Toute lecture exclut les auteurs
   * bloqués dans un sens ou l'autre ») est appliquée à la LECTURE, par
   * `VisibilityService`, sur chacune des quatre surfaces. Effacer des réactions
   * ou des vues au blocage serait destructif et irréversible — un déblocage ne
   * les rendrait pas — pour un gain nul : aucune réponse n'énumère les membres
   * qui ont réagi.
   *
   * L'abonnement sert donc de TÉMOIN : il rejoue le filtre des deux côtés et
   * LÈVE si un contenu traverse encore. Un gestionnaire qui lève est rejoué dix
   * fois puis part en échec, ce qui est exactement l'alarme voulue — la règle
   * dure « une publication d'un membre bloqué n'est jamais renvoyée » ne doit pas
   * pouvoir se casser en silence.
   */
  async handleUserBlocked(payload: unknown): Promise<{ checked: number }> {
    const pair = readBlockPair(payload);
    if (pair === null) {
      this.logger.warn('user.blocked : charge utile illisible, ignorée');
      return { checked: 0 };
    }

    for (const [viewerId, otherId] of [
      [pair.blockerUserId, pair.blockedUserId],
      [pair.blockedUserId, pair.blockerUserId],
    ] as const) {
      const leaked = await this.prisma.post.count({
        where: { AND: [...(await this.postVisibilityWhere(viewerId)), { authorUserId: otherId }] },
      });
      const leakedStories = await this.prisma.story.count({
        where: { AND: [...(await this.storyVisibilityWhere(viewerId, null, new Date())), { authorUserId: otherId }] },
      });
      const leakedComments = await this.prisma.comment.count({
        where: { AND: [...(await this.commentVisibilityWhere(viewerId)), { authorUserId: otherId }] },
      });

      if (leaked + leakedStories + leakedComments > 0) {
        throw new Error(
          `Blocage non appliqué dans le fil : ${leaked} publication(s), ${leakedStories} story(ies), ` +
            `${leakedComments} commentaire(s) de ${otherId} restent visibles par ${viewerId} ` +
            '(règle dure 04 §9).',
        );
      }
    }
    return { checked: 2 };
  }

  /**
   * `journey.step_completed` (§6 : « encart »).
   *
   * Ce que le fil en fait, et ce qu'il n'en fait PAS. Il n'en fait pas une
   * publication : 03 §1.2 est une règle dure — « Aucune publication n'est jamais
   * faite automatiquement au nom d'un membre » — et §2.6 la redit pour la
   * conversion. L'encart « Étape franchie · N sur M » de §2.2 est calculé à la
   * LECTURE, depuis la position de l'étape : il n'y a rien à matérialiser.
   *
   * Il en fait une chose utile et idempotente : recalculer le score des CONSEILS
   * rattachés à cette `step_definition`. §2.6 fait alimenter par les conseils
   * « la carte de l'étape dans le parcours ("N conseils · le plus utile : …") »,
   * et c'est précisément à l'instant où le membre franchit l'étape qu'il ouvre
   * cette carte — avec, sans ce recalcul, un classement vieux d'un quart d'heure.
   *
   * Un recalcul est une fonction pure des compteurs : le rejouer ne change rien.
   */
  async handleJourneyStepCompleted(payload: unknown): Promise<{ updated: number }> {
    const stepId = readJourneyStepId(payload);
    if (stepId === null) {
      this.logger.warn('journey.step_completed : charge utile illisible, ignorée');
      return { updated: 0 };
    }

    const step = await this.prisma.journeyStep.findUnique({
      where: { id: stepId },
      select: { stepDefinitionId: true },
    });
    // Étape ajoutée par le membre (`step_definition_id` nul) : aucun conseil ne
    // peut s'y rattacher, rien à recalculer.
    if (step === null || step.stepDefinitionId === null) return { updated: 0 };

    return this.recomputeStoryScores(step.stepDefinitionId);
  }

  /**
   * Part de ce module dans la suppression d'un compte (§8), appelée par
   * `account.deletion_execute` du module 01.
   *
   * « Publications, images et stories : supprimées. Commentaires : conservés,
   * anonymisés s'ils portent sur un GUIDE ou un TOPIC ; supprimés s'ils portent
   * sur un POST ou un EVENT. Réactions : supprimées, compteurs décrémentés. »
   *
   * L'anonymisation ne se fait pas ici, et ne peut pas s'y faire :
   * `comments.author_user_id` est NOT NULL dans le schéma figé. 01 §2.8 vide en
   * revanche la ligne `users` (`display_name` = « Membre supprimé »), donc le
   * commentaire conservé pointe déjà vers un membre anonyme et s'affiche comme
   * §8 le demande. Le jour où la colonne devient nullable, une ligne suffira ici.
   *
   * Les compteurs sont ajustés en SQL ensembliste : une boucle sur les
   * publications réagies serait un N+1 sur un compte qui peut en avoir des
   * milliers.
   */
  async handleUserDeleted(
    userId: string,
  ): Promise<{ posts: number; stories: number; comments: number }> {
    return this.prisma.$transaction(async (tx) => {
      // 1. Les compteurs AVANT la suppression des réactions : après, il n'y a
      //    plus rien à compter.
      await tx.$executeRaw`
        UPDATE posts p
        SET reaction_count = GREATEST(0, p.reaction_count - x.c)
        FROM (
          SELECT post_id, COUNT(*) AS c FROM post_reactions WHERE user_id = ${userId}::uuid GROUP BY post_id
        ) x
        WHERE p.id = x.post_id`;
      await tx.$executeRaw`
        UPDATE stories s
        SET positive_count = GREATEST(0, s.positive_count - x.p),
            negative_count = GREATEST(0, s.negative_count - x.n)
        FROM (
          SELECT story_id,
                 COUNT(*) FILTER (WHERE kind IN ('USEFUL','WANT_TO_GO','CONFIRM')) AS p,
                 COUNT(*) FILTER (WHERE kind IN ('NOT_USEFUL','BEEN_THERE','CHANGED')) AS n
          FROM story_reactions WHERE user_id = ${userId}::uuid GROUP BY story_id
        ) x
        WHERE s.id = x.story_id`;
      await tx.postReaction.deleteMany({ where: { userId } });
      await tx.storyReaction.deleteMany({ where: { userId } });
      await tx.storyView.deleteMany({ where: { userId } });

      // 2. Les commentaires SUPPRIMÉS (POST, EVENT) décrémentent le compteur de
      //    la publication qui les portait, avant de partir.
      await tx.$executeRaw`
        UPDATE posts p
        SET comment_count = GREATEST(0, p.comment_count - x.c)
        FROM (
          SELECT subject_id, COUNT(*) AS c FROM comments
          WHERE author_user_id = ${userId}::uuid AND subject_type = 'POST' AND deleted_at IS NULL
          GROUP BY subject_id
        ) x
        WHERE p.id = x.subject_id`;
      const comments = await tx.comment.deleteMany({
        where: { authorUserId: userId, subjectType: { in: ['POST', 'EVENT'] } },
      });

      // 3. Publications et stories. `post_media` et `post_reactions` partent en
      //    cascade. Les commentaires des AUTRES sur mes publications, en
      //    revanche, NON : `comments` est polymorphe et n'a aucune clé étrangère
      //    vers `posts`. Sans ce retrait explicite, la base garderait
      //    indéfiniment des commentaires attachés à un `subject_id` qui n'existe
      //    plus — invisibles, jamais purgés, et comptés par toute requête qui
      //    compterait les commentaires d'un membre.
      const posts = await tx.post.findMany({ where: { authorUserId: userId }, select: { id: true } });
      if (posts.length > 0) {
        await tx.comment.deleteMany({
          where: { subjectType: 'POST', subjectId: { in: posts.map((p) => p.id) } },
        });
      }
      const deletedPosts = await tx.post.deleteMany({ where: { authorUserId: userId } });
      const deletedStories = await tx.story.deleteMany({ where: { authorUserId: userId } });

      return {
        posts: deletedPosts.count,
        stories: deletedStories.count,
        comments: comments.count,
      };
    });
  }

  // ══ OUTILS — VISIBILITÉ ════════════════════════════════════════════════════

  /**
   * Le filtre appliqué à TOUTE liste de publications : ni supprimée, ni masquée,
   * ni d'un membre séparé du lecteur, ni d'un compte éteint.
   *
   * Un TABLEAU, et non un objet : c'est ce qui rend la composition sûre. Les
   * appelants ajoutent leurs clauses à la suite, et deux clauses sur la même clé
   * cohabitent au lieu de s'écraser.
   */
  private async postVisibilityWhere(viewerId: string): Promise<Prisma.PostWhereInput[]> {
    const separated = await this.visibility.separatedFrom(viewerId);
    return [
      { deletedAt: null },
      // §4 : « les contenus HIDDEN/REMOVED » sont exclus de toute lecture.
      { status: 'PUBLISHED' },
      // `moderation.content_hidden` (§6) se lit ici aussi : un contenu FLAGGED
      // sort des listes même si son `status` n'a pas encore suivi.
      { moderationStatus: { not: 'FLAGGED' } },
      ...(separated.length === 0 ? [] : [{ authorUserId: { notIn: separated } }]),
      {
        author: {
          deletedAt: null,
          // Un compte suspendu garde ses contenus visibles (01 §7.3 : il peut
          // consulter, et ce qu'il a publié reste) ; désactivé ou supprimé, non.
          status: { in: ['ACTIVE' as const, 'SUSPENDED' as const] },
        },
      },
    ];
  }

  /**
   * Le `where` complet de `GET /feed`, filtres de §2.3 compris.
   *
   * Le filtre de PHASE porte sur `author`, que `postVisibilityWhere` emploie
   * déjà. Étalés dans un même objet littéral, les deux `author:` s'écraseraient
   * et les comptes éteints repasseraient dans la liste dès qu'on filtre par
   * phase — le bogue exact du module 06. Ajoutée au tableau `AND`, la clause
   * s'additionne.
   */
  private async postListWhere(actor: FeedActor, query: FeedQuery): Promise<Prisma.PostWhereInput[]> {
    return [
      ...(await this.postVisibilityWhere(actor.userId)),
      // §2.3 : le fil global ne montre PAS les publications de réseau, et le fil
      // d'un réseau ne montre que les siennes. `community_id` est nullable, donc
      // `null` explicite — et non une exclusion, qui écarterait les lignes NULL.
      query.communityId === undefined ? { communityId: null } : { communityId: query.communityId },
      ...(query.type === undefined ? [] : [{ type: query.type }]),
      ...(query.cityId === undefined ? [] : [{ cityId: query.cityId }]),
      ...(query.phase === undefined ? [] : [{ author: { phase: query.phase } }]),
    ];
  }

  /**
   * Le filtre des stories : actives, non masquées, de l'audience du lecteur, et
   * pas d'un membre séparé.
   *
   * Deux clauses emploient `OR` — l'audience et, s'il fallait un jour tolérer un
   * auteur NULL, l'auteur. Dans un objet littéral, la seconde effacerait la
   * première et les stories `CITY` d'autres villes reparaîtraient pour tout le
   * monde. Le tableau `AND` l'empêche par construction.
   */
  private async storyVisibilityWhere(
    viewerId: string,
    viewerCityId: string | null,
    now: Date,
  ): Promise<Prisma.StoryWhereInput[]> {
    const separated = await this.visibility.separatedFrom(viewerId);
    return [
      { deletedAt: null },
      { status: 'ACTIVE' },
      { expiresAt: { gt: now } },
      { moderationStatus: { not: 'FLAGGED' } },
      ...(separated.length === 0 ? [] : [{ authorUserId: { notIn: separated } }]),
      { author: { deletedAt: null, status: { in: ['ACTIVE' as const, 'SUSPENDED' as const] } } },
      {
        // §2.6 : audience `ALL` ou `CITY`. Une story `CITY` ne sort pas de sa
        // ville ; son auteur la voit toujours, où qu'il soit.
        OR: [
          { audience: 'ALL' as const },
          ...(viewerCityId === null
            ? []
            : [{ audience: 'CITY' as const, cityId: viewerCityId }]),
          { authorUserId: viewerId },
        ],
      },
    ];
  }

  /**
   * Le filtre des commentaires.
   *
   * PIÈGE, et il est ici IMPOSSIBLE À DÉSAMORCER : `comments.author_user_id` est
   * NOT NULL, donc `notIn` seul est correct aujourd'hui — mais §8 prévoit de
   * l'annuler à la suppression d'un compte. Le jour où la colonne deviendra
   * nullable, ce `notIn` fera disparaître TOUS les commentaires anonymisés dès
   * que le lecteur aura UN seul blocage. Voir la note dans le corps.
   */
  private async commentVisibilityWhere(viewerId: string): Promise<Prisma.CommentWhereInput[]> {
    const separated = await this.visibility.separatedFrom(viewerId);
    return [
      { deletedAt: null },
      { status: 'PUBLISHED' },
      // `notIn` SEUL, et c'est un CONSTAT et non un choix : la forme tolérante au
      // NULL — `OR: [{ authorUserId: null }, { authorUserId: { notIn } }]` — est
      // REFUSÉE par les types générés, parce que `comments.author_user_id` est
      // NOT NULL. §8 demande pourtant de l'annuler à la suppression d'un compte
      // (« conservés, anonymisés, `author_user_id = null` ») : la règle est
      // aujourd'hui inapplicable, et le jour où la colonne deviendra nullable,
      // c'est ICI qu'il faudra repasser — sinon un lecteur avec UN seul blocage
      // perdra tous les commentaires anonymisés, sans que rien ne l'explique.
      ...(separated.length === 0 ? [] : [{ authorUserId: { notIn: separated } }]),
      { author: { deletedAt: null, status: { in: ['ACTIVE' as const, 'SUSPENDED' as const] } } },
    ];
  }

  /** La publication, si le lecteur a le droit de la connaître. */
  private async visiblePost(actor: FeedActor, id: string) {
    const post = await this.prisma.post.findUnique({
      where: { id },
      select: {
        id: true,
        authorUserId: true,
        type: true,
        status: true,
        moderationStatus: true,
        communityId: true,
        deletedAt: true,
      },
    });
    if (post === null || post.deletedAt !== null) throw ApiError.notFound();
    if (post.status !== 'PUBLISHED') throw ApiError.notFound();
    if (post.moderationStatus === 'FLAGGED') throw ApiError.notFound();
    await this.visibility.assertVisible(actor.userId, post.authorUserId);
    if (post.communityId !== null) await this.assertCommunityMember(actor.userId, post.communityId);
    return post;
  }

  /** La story, si le lecteur a le droit de la connaître — et de voter dessus. */
  private async visibleStory(actor: FeedActor, id: string) {
    const story = await this.prisma.story.findUnique({
      where: { id },
      select: {
        id: true,
        authorUserId: true,
        type: true,
        status: true,
        audience: true,
        cityId: true,
        moderationStatus: true,
        positiveCount: true,
        negativeCount: true,
        expiresAt: true,
        deletedAt: true,
      },
    });
    if (story === null || story.deletedAt !== null) throw ApiError.notFound();
    if (story.status !== 'ACTIVE') throw ApiError.notFound();
    if (story.moderationStatus === 'FLAGGED') throw ApiError.notFound();
    if (story.expiresAt.getTime() <= Date.now()) throw ApiError.notFound();
    await this.visibility.assertVisible(actor.userId, story.authorUserId);

    if (story.audience === 'CITY' && story.authorUserId !== actor.userId) {
      const me = await this.prisma.user.findUniqueOrThrow({
        where: { id: actor.userId },
        select: { cityId: true },
      });
      if (me.cityId !== story.cityId) throw ApiError.notFound();
    }
    return story;
  }

  /** La publication dont le membre est l'auteur, ou 404 / NOT_AUTHOR. */
  private async ownedPost(userId: string, id: string) {
    const post = await this.prisma.post.findUnique({
      where: { id },
      select: {
        id: true,
        authorUserId: true,
        type: true,
        body: true,
        status: true,
        createdAt: true,
        commentCount: true,
        reactionCount: true,
        communityId: true,
        movedToTopicId: true,
        deletedAt: true,
      },
    });
    if (post === null || post.deletedAt !== null) throw ApiError.notFound();
    if (post.status === 'REMOVED') throw ApiError.notFound();
    if (post.authorUserId !== userId) this.fail('NOT_AUTHOR');
    return post;
  }

  private async ownedComment(userId: string, id: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id },
      select: {
        id: true,
        authorUserId: true,
        subjectType: true,
        subjectId: true,
        createdAt: true,
        status: true,
        deletedAt: true,
      },
    });
    if (comment === null || comment.deletedAt !== null) throw ApiError.notFound();
    if (comment.status === 'REMOVED') throw ApiError.notFound();
    if (comment.authorUserId !== userId) this.fail('NOT_AUTHOR');
    return comment;
  }

  /**
   * §2.3 : « visible des membres du réseau seulement. » 404 et non 403 (T4 §3) :
   * révéler qu'un réseau existe mais nous est fermé en dit déjà trop.
   */
  private async assertCommunityMember(userId: string, communityId: string): Promise<void> {
    const found = await this.prisma.communityMember.findFirst({
      where: { communityId, userId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (found === null) throw ApiError.notFound();
  }

  /**
   * Le sujet d'un commentaire existe-t-il, et le lecteur y a-t-il accès ?
   *
   * §2.5 partage la table avec trois autres modules, dont les règles de
   * visibilité ne sont pas les nôtres. Chacune est donc appliquée telle qu'elle
   * est, plutôt que devinée : un guide dépublié, un événement annulé, un sujet
   * d'un réseau fermé ne doivent pas devenir commentables par la porte du §2.5.
   */
  private async assertSubjectVisible(
    actor: FeedActor,
    subjectType: CommentSubjectType,
    subjectId: string,
  ): Promise<void> {
    const separated = await this.visibility.separatedFrom(actor.userId);

    if (subjectType === 'POST') {
      await this.visiblePost(actor, subjectId);
      return;
    }

    if (subjectType === 'TOPIC') {
      const topic = await this.prisma.topic.findUnique({
        where: { id: subjectId },
        select: { id: true, authorUserId: true, communityId: true, deletedAt: true, status: true },
      });
      if (topic === null || topic.deletedAt !== null) throw ApiError.notFound();
      if (separated.includes(topic.authorUserId)) throw ApiError.notFound();
      await this.assertCommunityMember(actor.userId, topic.communityId);
      return;
    }

    if (subjectType === 'GUIDE') {
      const guide = await this.prisma.guide.findUnique({
        where: { id: subjectId },
        select: { id: true, authorUserId: true, status: true, deletedAt: true },
      });
      if (guide === null || guide.deletedAt !== null) throw ApiError.notFound();
      if (guide.status !== 'PUBLISHED') throw ApiError.notFound();
      // `guides.author_user_id` EST nullable (anonymisation, 05 §8) : le test
      // passe donc par `!== null` et non par un `notIn` SQL, qui aurait écarté
      // tous les guides anonymisés.
      if (guide.authorUserId !== null && separated.includes(guide.authorUserId)) {
        throw ApiError.notFound();
      }
      return;
    }

    const event = await this.prisma.event.findUnique({
      where: { id: subjectId },
      select: {
        id: true,
        organizerUserId: true,
        communityId: true,
        status: true,
        deletedAt: true,
      },
    });
    if (event === null || event.deletedAt !== null) throw ApiError.notFound();
    if (separated.includes(event.organizerUserId)) throw ApiError.notFound();
    if (event.communityId !== null) await this.assertCommunityMember(actor.userId, event.communityId);
  }

  // ══ OUTILS — MODÉRATION LOCALE ET MASQUAGE ═════════════════════════════════

  /** Règles locales bloquantes (13 §2) sur une publication ou un commentaire. */
  private assertPostPublishable(body: string): void {
    for (const rule of POST_BLOCK_RULES) {
      if (rule.pattern.test(body)) {
        this.logger.warn(`Publication bloquée par la règle locale ${rule.name} (13 §2)`);
        // Motif générique côté membre : le détail servirait à contourner.
        this.fail('CONTENT_BLOCKED');
      }
    }
  }

  /**
   * RÈGLE DURE (§2.6 et §9) : « une story contenant un lien ou un numéro est
   * refusée ». Les règles des publications s'appliquent EN PLUS — une story ne
   * devient pas le canal libre de ce qu'une publication refuse.
   */
  private assertStoryPublishable(body: string): void {
    for (const rule of STORY_FORBIDDEN_PATTERNS) {
      if (rule.pattern.test(body)) {
        this.logger.warn(`Story refusée : ${rule.name} interdit dans une story (04 §2.6)`);
        this.fail('CONTENT_BLOCKED', { reason: 'NO_LINK_PHONE_EMAIL' });
      }
    }
    this.assertPostPublishable(body);
  }

  /**
   * RÈGLE DURE (13 §2) : « Le texte envoyé à l'API IA est toujours passé par
   * `redactForModeration`. »
   *
   * Cette fonction est le SEUL chemin par lequel un texte de ce module rejoint la
   * chaîne de modération : la charge utile de `post.published`, `story.published`
   * et `post.commented` ne porte jamais le corps brut, seulement sa version
   * masquée. `assertRedacted` refuse d'émettre si un numéro ou un email a
   * survécu — mieux vaut un contenu non analysé, qui part en modération humaine,
   * qu'une donnée personnelle transmise à un sous-traitant hors UE.
   */
  private moderationPayload(body: string): {
    redactedBody: string;
    redacted: true;
    redactionCounts: Record<string, number>;
  } {
    const result = redactForModeration(body);
    assertRedacted(result.text);
    return { redactedBody: result.text, redacted: true, redactionCounts: { ...result.counts } };
  }

  // ══ OUTILS — QUOTAS (§2.4, §2.5, §2.6) ═════════════════════════════════════

  /** §2.4 : 10 publications par heure, 30 par jour. Les supprimées comptent. */
  private async assertPostQuota(userId: string): Promise<void> {
    const now = Date.now();
    const [lastHour, lastDay] = await Promise.all([
      this.prisma.post.count({
        where: { authorUserId: userId, createdAt: { gte: new Date(now - 3_600_000) } },
      }),
      this.prisma.post.count({
        where: { authorUserId: userId, createdAt: { gte: new Date(now - DAY_MS) } },
      }),
    ]);
    // Compter les supprimées aussi : sinon la limite se remet à zéro d'un clic
    // sur « supprimer », et la limite ne limite plus rien.
    if (lastHour >= FEED_LIMITS.postsPerHour) {
      throw ApiError.transverse('RATE_LIMITED', {
        limit: 'feed.postsPerHour',
        max: FEED_LIMITS.postsPerHour,
        retryAfterSeconds: 600,
      });
    }
    if (lastDay >= FEED_LIMITS.postsPerDay) {
      throw ApiError.transverse('RATE_LIMITED', {
        limit: 'feed.postsPerDay',
        max: FEED_LIMITS.postsPerDay,
        retryAfterSeconds: 3_600,
      });
    }
  }

  /** §2.5 : 60 commentaires par heure. */
  private async assertCommentQuota(userId: string): Promise<void> {
    const count = await this.prisma.comment.count({
      where: { authorUserId: userId, createdAt: { gte: new Date(Date.now() - 3_600_000) } },
    });
    if (count >= FEED_LIMITS.commentsPerHour) {
      throw ApiError.transverse('RATE_LIMITED', {
        limit: 'feed.commentsPerHour',
        max: FEED_LIMITS.commentsPerHour,
        retryAfterSeconds: 600,
      });
    }
  }

  /** §2.6 : 3 stories par jour. `STORY_LIMIT` et non `RATE_LIMITED` (§4). */
  private async assertStoryQuota(userId: string): Promise<void> {
    const count = await this.prisma.story.count({
      where: { authorUserId: userId, createdAt: { gte: new Date(Date.now() - DAY_MS) } },
    });
    if (count >= FEED_LIMITS.storiesPerDay) {
      this.fail('STORY_LIMIT', { max: FEED_LIMITS.storiesPerDay, retryAfterSeconds: 3_600 });
    }
  }

  // ══ OUTILS — RATTACHEMENTS ═════════════════════════════════════════════════

  /**
   * §2.2 : le contexte de parcours. L'étape et le parcours doivent appartenir au
   * membre — 404 sinon, et non 403 : sinon, essayer des identifiants dirait
   * lesquels existent.
   */
  private async resolveJourneyContext(
    userId: string,
    journeyId: string | undefined,
    journeyStepId: string | undefined,
  ): Promise<{ journeyId?: string; journeyStepId?: string }> {
    if (journeyStepId !== undefined) {
      const step = await this.prisma.journeyStep.findUnique({
        where: { id: journeyStepId },
        select: { id: true, journeyId: true, journey: { select: { ownerUserId: true } } },
      });
      if (step === null || step.journey.ownerUserId !== userId) throw ApiError.notFound();
      if (journeyId !== undefined && journeyId !== step.journeyId) throw ApiError.notFound();
      // Le parcours est DÉDUIT de l'étape : un client qui n'envoie que l'étape
      // obtient quand même la ligne de contexte complète (§2.2), sans quoi
      // « Parcours Études » manquerait sur un jalon partagé.
      return { journeyId: step.journeyId, journeyStepId: step.id };
    }
    if (journeyId === undefined) return {};

    const journey = await this.prisma.journey.findUnique({
      where: { id: journeyId },
      select: { id: true, ownerUserId: true, deletedAt: true },
    });
    if (journey === null || journey.deletedAt !== null || journey.ownerUserId !== userId) {
      throw ApiError.notFound();
    }
    return { journeyId: journey.id };
  }

  /**
   * §2.4 : « Jusqu'à 4 images (`post_media`), passées par le PIPELINE MÉDIA
   * (EXIF, antivirus). »
   *
   * D'où les deux exigences : l'asset doit être `READY` — donc scanné — et
   * `exif_stripped`. Publier une photo dont les EXIF sont intacts publierait les
   * coordonnées GPS de qui l'a prise, et 09 pose comme règle dure qu'« aucune
   * position individuelle » ne sort de la plateforme. Un asset en attente de
   * traitement est donc refusé, pas publié en espérant.
   */
  private async resolveMedia(userId: string, mediaIds: readonly string[]): Promise<string[]> {
    if (mediaIds.length === 0) return [];
    const unique = [...new Set(mediaIds)];

    /**
     * [RÈGLE DURE] LE GENRE EST FILTRÉ, et son absence ici était une fuite.
     *
     * `ownedAttachableWhere` apporte les trois contrôles de la ligne :
     * propriétaire, non supprimé, et **genre recevable** — ce dernier manquait.
     * Sans lui, un membre pouvait passer l'identifiant de son propre justificatif
     * professionnel (`kind = 'PROOF'`) comme image de publication ou comme fond de
     * story, et le publier : 00 §8.1 range ce document en « accès équipe
     * uniquement, jamais affiché », et c'était contourné par son propriétaire même.
     *
     * Le genre vit dans le `where` et non dans la boucle : un refus explicite
     * apprendrait qu'un média de genre protégé existe sous cet identifiant. Un
     * genre non recevable sort donc du lot et tombe dans le `length !==`
     * ci-dessous, c'est-à-dire sur le MÊME 404 qu'un identifiant inconnu.
     */
    const assets = await this.prisma.mediaAsset.findMany({
      where: { id: { in: unique }, ...ownedAttachableWhere('feed', userId) },
      select: { id: true, status: true, exifStripped: true },
    });
    if (assets.length !== unique.length) throw ApiError.notFound();

    for (const asset of assets) {
      if (asset.status !== REQUIRED_MEDIA_STATUS || !asset.exifStripped) {
        this.fail('INVALID_ATTACHMENT', {
          mediaAssetId: asset.id,
          reason: asset.status !== REQUIRED_MEDIA_STATUS ? 'MEDIA_NOT_READY' : 'EXIF_NOT_STRIPPED',
        });
      }
    }
    // L'ordre demandé est conservé : `post_media.position` est ce qui décide de
    // l'ordre d'affichage, et le trier autrement mélangerait les images.
    return unique;
  }

  /**
   * Le rattachement OBLIGATOIRE de §2.6, type par type.
   *
   * Le tableau de §2.6 n'est pas une suggestion : il donne à chaque type ce sans
   * quoi la story ne sert à rien. Un conseil sans étape ni sujet ne peut être
   * classé nulle part, une découverte sans lieu ne se retrouve pas, une
   * information sans ville ne concerne personne. D'où `INVALID_ATTACHMENT`, code
   * nommé par §4, et non un `VALIDATION_FAILED` sur un champ.
   */
  private async resolveStoryAttachment(
    userId: string,
    input: CreateStory,
  ): Promise<{
    cityId: string;
    stepDefinitionId: string | null;
    category: string | null;
    categoryOther: string | null;
    placeLabel: string | null;
    validUntil: Date | null;
  }> {
    const category = input.category ?? null;
    const isSubject = category !== null && (STORY_SUBJECTS as readonly string[]).includes(category);
    const isDiscoveryCategory =
      category !== null && (STORY_DISCOVERY_CATEGORIES as readonly string[]).includes(category);

    // `valid_until` n'a de sens que pour une INFORMATION (§2.6, ligne
    // « Expiration ») : l'accepter ailleurs laisserait croire qu'il raccourcit la
    // vie d'un conseil, ce qu'il ne fait pas.
    if (input.validUntil !== undefined && input.type !== 'INFORMATION') {
      this.fail('INVALID_ATTACHMENT', { reason: 'VALID_UNTIL_INFORMATION_ONLY' });
    }
    const validUntil = input.validUntil === undefined ? null : new Date(input.validUntil);
    if (validUntil !== null && validUntil.getTime() <= Date.now()) {
      this.fail('INVALID_ATTACHMENT', { reason: 'VALID_UNTIL_IN_PAST' });
    }

    if (input.type === 'CONSEIL') {
      // L'ordre de ces deux contrôles compte, et il était INVERSE — bogue trouvé
      // en exerçant le service. Un membre qui choisit un conseil et une catégorie
      // de DÉCOUVERTE (« LIEU ») se voyait répondre « il faut une étape ou un
      // sujet » : vrai au fond, mais désignant le mauvais champ. Il aurait ajouté
      // une étape et gardé la catégorie fausse. Le motif le plus PRÉCIS d'abord.
      if (isDiscoveryCategory) {
        this.fail('INVALID_ATTACHMENT', { reason: 'CONSEIL_CATEGORY_MUST_BE_SUBJECT' });
      }
      // « Une `step_definition` OU un sujet » — au moins l'un des deux.
      if (input.stepDefinitionId === undefined && !isSubject) {
        this.fail('INVALID_ATTACHMENT', { reason: 'CONSEIL_NEEDS_STEP_OR_SUBJECT' });
      }
    } else if (input.type === 'DECOUVERTE') {
      // « Ville + catégorie (LIEU · PRODUIT · SORTIE) + `place_label` ».
      if (!isDiscoveryCategory) {
        this.fail('INVALID_ATTACHMENT', { reason: 'DECOUVERTE_NEEDS_CATEGORY' });
      }
      if (input.placeLabel === undefined) {
        this.fail('INVALID_ATTACHMENT', { reason: 'DECOUVERTE_NEEDS_PLACE' });
      }
      if (input.stepDefinitionId !== undefined) {
        this.fail('INVALID_ATTACHMENT', { reason: 'DECOUVERTE_HAS_NO_STEP' });
      }
    } else {
      // « Ville + sujet + `place_label` facultatif + `valid_until` facultatif ».
      if (!isSubject) this.fail('INVALID_ATTACHMENT', { reason: 'INFORMATION_NEEDS_SUBJECT' });
      if (input.stepDefinitionId !== undefined) {
        this.fail('INVALID_ATTACHMENT', { reason: 'INFORMATION_HAS_NO_STEP' });
      }
    }

    if (input.stepDefinitionId !== undefined) {
      const step = await this.prisma.stepDefinition.findUnique({
        where: { id: input.stepDefinitionId },
        select: { id: true },
      });
      if (step === null) throw ApiError.notFound();
    }

    // `stories.city_id` est NOT NULL : la ville du membre est la valeur de repli,
    // et un membre sans ville ne peut pas publier de story — ce que §2.6 implique
    // (« Ville + … » pour deux des trois types) sans jamais le dire.
    const me = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { cityId: true },
    });
    const requested = input.cityId ?? me.cityId;
    if (requested === null || requested === undefined) {
      this.fail('INVALID_ATTACHMENT', { reason: 'CITY_REQUIRED' });
    }
    const city = await this.prisma.city.findUnique({
      where: { id: requested },
      select: { id: true, mergedIntoCityId: true },
    });
    if (city === null) throw ApiError.notFound();

    return {
      // Une ville fusionnée n'existe plus pour personne (02 §2.2) : la story part
      // sur la ville cible, sinon elle n'apparaîtrait dans aucun bandeau.
      cityId: city.mergedIntoCityId ?? city.id,
      stepDefinitionId: input.stepDefinitionId ?? null,
      category,
      /**
       * Le sujet écrit à la main. `createStorySchema` a déjà refusé de l'accepter
       * sans « Autre » ; il n'y a donc rien à revérifier, et le relire ici serait
       * une seconde vérité qui finirait par diverger de la première.
       */
      categoryOther: input.categoryOther ?? null,
      placeLabel: input.placeLabel ?? null,
      validUntil,
    };
  }

  // ══ OUTILS — COLONNE DROITE (§2.7) ═════════════════════════════════════════

  /** « Événements dans ma ville » — module 09, les 3 prochains. */
  private async sidebarEvents(viewerId: string, cityId: string | null) {
    if (cityId === null) return [];
    const separated = await this.visibility.separatedFrom(viewerId);
    const myCommunities = await this.prisma.communityMember.findMany({
      where: { userId: viewerId, status: 'ACTIVE' },
      select: { communityId: true },
    });

    const events = await this.prisma.event.findMany({
      where: {
        AND: [
          { deletedAt: null },
          { cityId },
          { status: 'SCHEDULED' },
          { startsAt: { gte: new Date() } },
          ...(separated.length === 0 ? [] : [{ organizerUserId: { notIn: separated } }]),
          {
            organizer: {
              deletedAt: null,
              status: { in: ['ACTIVE' as const, 'SUSPENDED' as const] },
            },
          },
          // Un événement de réseau n'apparaît qu'aux membres du réseau.
          // `community_id` est nullable : le `null` explicite est OBLIGATOIRE,
          // un `notIn` écarterait les événements publics.
          {
            OR: [
              { communityId: null },
              { communityId: { in: myCommunities.map((m) => m.communityId) } },
            ],
          },
        ],
      },
      orderBy: { startsAt: 'asc' },
      take: FEED_LIMITS.sidebarItems,
      select: {
        id: true,
        title: true,
        type: true,
        startsAt: true,
        venueName: true,
        attendeeCount: true,
      },
    });
    return events;
  }

  /**
   * « Nouveaux arrivants » (§2.7) : membres `RECENT_ARRIVAL` de ma ville, 14
   * derniers jours, 3 maximum, avec le bouton « Saluer » si le lecteur est L1.
   *
   * C'est le bloc le plus délicat de la colonne : il expose des MEMBRES, pas des
   * contenus. Quatre filtres s'y empilent, et ils sont tous obligatoires — la
   * ville, la phase, la fenêtre de 14 jours, et la séparation dans les deux
   * sens. Le lecteur lui-même en est exclu : se voir dans « nouveaux arrivants »
   * n'a aucun sens et occuperait une des trois places.
   */
  private async sidebarNewArrivals(actor: FeedActor, cityId: string | null) {
    if (cityId === null) return { items: [], canGreet: false };
    const separated = await this.visibility.separatedFrom(actor.userId);
    const since = new Date(Date.now() - FEED_LIMITS.newArrivalDays * DAY_MS);

    const members = await this.prisma.user.findMany({
      where: {
        AND: [
          { cityId },
          { phase: 'RECENT_ARRIVAL' },
          { deletedAt: null },
          { status: 'ACTIVE' },
          { id: { not: actor.userId } },
          ...(separated.length === 0 ? [] : [{ id: { notIn: separated } }]),
          // « 14 derniers jours » : §2.7 ne dit pas de QUOI. `arrival_date`
          // quand elle est connue — c'est l'arrivée réelle —, sinon l'inscription.
          // `arrival_date` est nullable, d'où le `OR` : un `gte` seul écarterait
          // tous les membres qui ne l'ont pas renseignée.
          { OR: [{ arrivalDate: { gte: since } }, { arrivalDate: null, createdAt: { gte: since } }] },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: FEED_LIMITS.sidebarItems,
      select: AUTHOR_SELECT,
    });

    return {
      items: members.map((m) => this.summary(m)),
      // §2.7 : « bouton "Saluer" = message privé pré-adressé, SI L1 ».
      canGreet: levelSatisfies(actor.level, 'message.send'),
      greetingHint: 'Bienvenue ! Si vous avez une question sur la ville, écrivez-moi.',
    };
  }

  /** « Alerte vigilance » (§2.7) : `scam_alerts` épinglée pour ma ville ou mon pays. */
  private async sidebarAlerts(cityId: string | null, countryId: string) {
    const now = new Date();
    return this.prisma.scamAlert.findFirst({
      where: {
        AND: [
          { isPinned: true },
          { publishedAt: { not: null, lte: now } },
          { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
          // Ville OU pays OU portée générale. `city_id` et `country_id` sont
          // nullables et une alerte globale les laisse tous les deux à NULL :
          // c'est le cas le plus important à ne pas perdre.
          {
            OR: [
              { cityId: null, countryId: null },
              ...(cityId === null ? [] : [{ cityId }]),
              { countryId },
            ],
          },
        ],
      },
      orderBy: [{ severity: 'desc' }, { publishedAt: 'desc' }],
      select: { id: true, title: true, body: true, severity: true, publishedAt: true },
    });
  }

  /** « Parrains et contacts en ligne » (§2.7) : `last_seen_at` < 10 min. */
  private async sidebarOnline(viewerId: string) {
    const since = new Date(Date.now() - FEED_LIMITS.onlineWindowMinutes * 60_000);
    const connections = await this.prisma.connection.findMany({
      where: { removedAt: null, OR: [{ userAId: viewerId }, { userBId: viewerId }] },
      select: { userAId: true, userBId: true, origin: true },
    });
    const contactIds = connections.map((c) => (c.userAId === viewerId ? c.userBId : c.userAId));
    if (contactIds.length === 0) return [];

    // La séparation est déjà censée retirer le contact (08 §4), mais le filtre
    // est réappliqué : un blocage posé pendant que le retrait du contact échoue
    // ne doit pas rendre le membre visible ici.
    const separated = await this.visibility.separatedFrom(viewerId);
    const online = await this.prisma.user.findMany({
      where: {
        AND: [
          { id: { in: contactIds } },
          ...(separated.length === 0 ? [] : [{ id: { notIn: separated } }]),
          { deletedAt: null },
          { status: 'ACTIVE' },
          { lastSeenAt: { gte: since } },
        ],
      },
      orderBy: { lastSeenAt: 'desc' },
      take: 10,
      select: AUTHOR_SELECT,
    });

    return online.map((u) => ({
      ...this.summary(u),
      /** §2.7 nomme « Parrains ET contacts » : la distinction est utile à l'écran. */
      isMentor: u.mentorProfile !== null,
    }));
  }

  // ══ OUTILS — PROJECTIONS ═══════════════════════════════════════════════════

  /** T4 §6 : la forme unique d'un membre. Jamais de téléphone, d'email, de date de naissance. */
  private summary(author: AuthorRow) {
    return {
      id: author.id,
      handle: author.handle,
      displayName: author.displayName,
      avatarUrl: author.avatarAsset === null ? null : `/media/${author.avatarAsset.storageKey}`,
      level: author.verificationLevel,
      phase: author.phase,
      cityName: author.city?.name ?? null,
      countryIso2: author.originCountry.iso2,
      isMentor: author.mentorProfile !== null,
    };
  }

  /**
   * Les cartes du fil (§5 : « Carte de publication »).
   *
   * L'encart d'étape a besoin de « N sur M » (§2.2), qui n'est ni sur la
   * publication ni sur l'étape : c'est le rang de l'étape dans son parcours. Une
   * seule requête pour toute la page, plutôt qu'une par carte — c'est le N+1 que
   * cette fonction existe pour éviter.
   */
  private async cards(rows: readonly PostRow[], viewerId: string) {
    if (rows.length === 0) return [];

    const journeyIds = [
      ...new Set(
        rows.flatMap((r) => (r.journeyStep === null ? [] : [r.journeyStep.journeyId])),
      ),
    ];
    const positions =
      journeyIds.length === 0
        ? []
        : await this.prisma.journeyStep.findMany({
            where: { journeyId: { in: journeyIds } },
            select: { journeyId: true, position: true },
          });
    const stepsByJourney = new Map<string, number[]>();
    for (const p of positions) {
      stepsByJourney.set(p.journeyId, [...(stepsByJourney.get(p.journeyId) ?? []), p.position]);
    }

    const myReactions = await this.prisma.postReaction.findMany({
      where: { userId: viewerId, postId: { in: rows.map((r) => r.id) } },
      select: { postId: true, kind: true },
    });
    const mine = new Map(myReactions.map((r) => [r.postId, r.kind]));

    /**
     * ── MES VOTES, EN UNE REQUÊTE POUR TOUTE LA PAGE ────────────────────────
     *
     * Ils décident de DEUX choses, et la seconde est une règle : quelles options
     * sont cochées, et si les résultats sont visibles. §2.3 du module 07 : les
     * comptes restent cachés tant qu'on n'a pas voté et que le sondage n'est pas
     * clos. Les laisser dans la réponse HTTP en demandant au front de ne pas les
     * afficher reviendrait à les publier — c'est écrit dans `pollOptionSchema`,
     * et c'est pourquoi `voteCount` est NULLABLE.
     */
    /**
     * LA SÉPARATION, UNE FOIS POUR TOUTE LA PAGE. Elle ne sert qu'aux votants
     * nommés d'un sondage non anonyme — mais un membre qui m'a bloqué, ou que j'ai
     * bloqué, ne doit apparaître nulle part, et une liste de votants est un
     * endroit comme un autre.
     */
    const separes = new Set(await this.visibility.separatedFrom(viewerId));

    /**
     * ╔════════════════════════════════════════════════════════════════════╗
     * ║ LES SIGNETS DE LA PAGE, EN UNE REQUÊTE                                 ║
     * ╚════════════════════════════════════════════════════════════════════╝
     *
     * Une requête PAR PAGE, et non une par carte : vingt cartes feraient vingt
     * allers-retours pour un booléen. C'est la même forme que `mesVotes` juste
     * au-dessus, et pour la même raison.
     */
    const signets = new Set(
      (
        await this.prisma.bookmark.findMany({
          where: {
            userId: viewerId,
            subjectType: 'POST',
            subjectId: { in: rows.map((r) => r.id) },
          },
          select: { subjectId: true },
        })
      ).map((b) => b.subjectId),
    );

    const pollIds = rows.flatMap((r) => (r.poll === null ? [] : [r.poll.id]));
    const mesVotes =
      pollIds.length === 0
        ? []
        : await this.prisma.pollVote.findMany({
            where: { userId: viewerId, pollOption: { pollId: { in: pollIds } } },
            select: { pollOptionId: true, pollOption: { select: { pollId: true } } },
          });
    const votesParSondage = new Map<string, string[]>();
    for (const v of mesVotes) {
      const cle = v.pollOption.pollId;
      votesParSondage.set(cle, [...(votesParSondage.get(cle) ?? []), v.pollOptionId]);
    }

    return rows.map((row) => {
      const vocabulary = POST_TYPE_VOCABULARY[row.type];
      return {
        id: row.id,
        type: row.type,
        typeLabel: vocabulary.label,
        excerpt: excerpt(row.body, 400),
        createdAt: row.createdAt,
        author: this.summary(row.author),
        isAuthor: row.authorUserId === viewerId,
        city: row.city,
        community: row.community,
        media: row.media.map((m) => ({
          /**
           * L'IDENTIFIANT DU MÉDIA, et pas seulement son adresse.
           *
           * `PATCH /posts/:id` attend des IDENTIFIANTS, et la fenêtre de
           * modification doit pouvoir renvoyer la liste amputée de celui qu'on
           * retire. Sans ce champ, elle n'avait aucun moyen de nommer une image :
           * l'adresse porte une clé de stockage, pas la clé de la ligne.
           */
          id: m.mediaAsset.id,
          position: m.position,
          url: `/media/${m.mediaAsset.storageKey}`,
        })),
        /** §2.2 : la ligne de contexte, construite côté serveur, prête à afficher. */
        context: this.contextLine(row),
        /** §2.2 : l'encart « Étape franchie · N sur M ». */
        stepBadge: this.stepBadge(row, stepsByJourney),
        /** §2.1 : le compteur suit le VOCABULAIRE du type. */
        counter: {
          count: row.reactionCount,
          // Une QUESTION compte des RÉPONSES, c'est-à-dire des commentaires
          // (§2.1) — et non des réactions. Le compteur affiché change donc de
          // source selon le type, ce que le tableau de §2.1 dit noir sur blanc.
          displayCount: row.type === 'QUESTION' ? row.commentCount : row.reactionCount,
          word: countLabel(row.type, row.type === 'QUESTION' ? row.commentCount : row.reactionCount),
        },
        reaction: {
          kind: POST_REACTION_KIND[row.type],
          actionLabel: vocabulary.actionLabel,
          mine: mine.get(row.id) ?? null,
        },
        commentCount: row.commentCount,
        commentLabel: vocabulary.commentLabel,
        /** « Enregistrer » : le bouton était dessiné, et rien ne disait son état. */
        bookmarked: signets.has(row.id),
        /**
         * LE SONDAGE DE LA PUBLICATION (§2.4), avec la règle de visibilité du
         * module 07 appliquée telle quelle : tant qu'on n'a pas voté et que le
         * sondage n'est pas clos, les comptes sont `null` — pas zéro, pas cachés
         * côté écran. Un `0` dirait « personne n'a voté », ce qui est faux.
         */
        poll: row.poll === null ? null : this.carteDeSondage(row.poll, votesParSondage, separes),
        /** Les guides liés, dans l'ordre choisi par l'auteur. */
        guides: row.guides.map((g) => g.guide),
        linkRel: POST_LINK_REL,
      };
    });
  }

  /**
   * UN SONDAGE DE PUBLICATION, MIS EN FORME.
   *
   * La règle de visibilité des résultats est celle du module 07, et elle est
   * reprise plutôt que réécrite : on voit les comptes si l'on a voté OU si le
   * sondage est clos. Sinon `voteCount` et `totalVotes` valent `null`, et
   * `pollOptionSchema` est `.strict()` avec un `nullable()` explicite — un `0`
   * glissé là dirait « personne n'a voté » à qui n'a pas le droit de savoir.
   */
  private carteDeSondage(
    poll: PostRow['poll'] & object,
    votesParSondage: ReadonlyMap<string, string[]>,
    separes: ReadonlySet<string>,
  ) {
    const miens = votesParSondage.get(poll.id) ?? [];
    const closed = poll.closesAt !== null && poll.closesAt.getTime() <= Date.now();
    /**
     * `resultsAfterVote` EST UN RÉGLAGE DEPUIS CE LOT, et son défaut est l'ancienne
     * règle : masqué avant le vote. Posé à faux, les comptes sortent tout de suite.
     */
    const resultsVisible = !poll.resultsAfterVote || miens.length > 0 || closed;
    /**
     * LES NOMS SUIVENT LES RÉSULTATS, pas l'anonymat seul : les deux conditions,
     * sinon on saurait QUI a voté QUOI avant d'avoir le droit de savoir COMBIEN.
     */
    const nomme = resultsVisible && !poll.isAnonymous;
    return {
      id: poll.id,
      question: poll.question,
      isMultiple: poll.isMultiple,
      resultsAfterVote: poll.resultsAfterVote,
      isAnonymous: poll.isAnonymous,
      closesAt: poll.closesAt,
      closed,
      createdAt: poll.createdAt,
      /**
       * `communityAuthorSchema` — trois champs, et non `memberSummarySchema`.
       *
       * C'est le schéma que le module 07 emploie pour l'auteur d'un sondage, et
       * `postPollSchema` le reprend : le réutiliser ici évite qu'un sondage de
       * publication rende un auteur d'une autre forme que le même sondage dans un
       * réseau. `this.summary` en rend neuf, et `.strict()` les refuserait.
       */
      author: { id: poll.author.id, handle: poll.author.handle, displayName: poll.author.displayName },
      myOptionIds: miens,
      resultsVisible,
      totalVotes: resultsVisible ? poll.options.reduce((n, o) => n + o.voteCount, 0) : null,
      options: poll.options.map((o) => ({
        id: o.id,
        label: o.label,
        position: o.position,
        voteCount: resultsVisible ? o.voteCount : null,
        /** Un membre séparé n'est nommé nulle part, y compris sous une option. */
        voters: nomme ? o.votes.map((v) => v.user).filter((u) => !separes.has(u.id)) : [],
      })),
    };
  }

  /**
   * §2.2 : « Chaque publication porte une ligne de contexte construite côté
   * serveur et renvoyée PRÊTE À AFFICHER : "Parcours Études · Lyon · il y a 2 h" ».
   *
   * RÈGLE DURE : le composant « parcours » est le nom du TYPE
   * (`journey_templates.name_fr`), jamais `journeys.title`. Celui-ci n'est pas
   * lu — voir le `select` de `POST_INCLUDE`.
   */
  private contextLine(row: PostRow): { text: string; parts: string[] } {
    const parts: string[] = [];
    const journeyTypeName = row.journey?.templateVersion.template.nameFr;
    if (journeyTypeName !== undefined) parts.push(`Parcours ${journeyTypeName}`);
    if (row.city !== null) parts.push(row.city.name);
    parts.push(relativeTimeFr(row.createdAt));
    return { text: parts.join(' · '), parts };
  }

  /** §2.2 : « `journey_step_id` → encart "Étape franchie · N sur M" ». */
  private stepBadge(
    row: PostRow,
    stepsByJourney: Map<string, number[]>,
  ): { label: string; stepName: string; index: number; total: number } | null {
    const step = row.journeyStep;
    if (step === null) return null;
    // « Étape FRANCHIE » : l'encart ne s'affiche que si elle l'est vraiment. Une
    // publication liée à une étape encore en cours n'annonce pas un jalon.
    if (step.status !== 'DONE') return null;

    const all = (stepsByJourney.get(step.journeyId) ?? []).slice().sort((a, b) => a - b);
    const total = all.length;
    const index = all.filter((p) => p <= step.position).length;
    const stepName = step.stepDefinition?.nameFr ?? '';
    return {
      label: `Étape franchie · ${index} sur ${total}`,
      stepName,
      index,
      total,
    };
  }

  private commentCard(
    row: {
      id: string;
      body: string;
      createdAt: Date;
      authorUserId: string;
      parentCommentId: string | null;
      author: AuthorRow;
    },
    viewerId: string,
  ) {
    return {
      id: row.id,
      body: row.body,
      createdAt: row.createdAt,
      relativeTime: relativeTimeFr(row.createdAt),
      parentCommentId: row.parentCommentId,
      author: this.summary(row.author),
      isAuthor: row.authorUserId === viewerId,
      canEdit:
        row.authorUserId === viewerId &&
        Date.now() <= row.createdAt.getTime() + FEED_LIMITS.editWindowMinutes * 60_000,
    };
  }

  /**
   * La projection UNIQUE d'une story.
   *
   * RÈGLE DURE (§2.6) : « Aucun compteur de vues, pour personne. » Toute story
   * qui sort de ce module passe par ici — bandeau, détail, historique — pour
   * qu'aucune route ne puisse ajouter le compteur par mégarde. `seen` est un
   * booléen qui ne parle que du lecteur : c'est l'anneau, pas une audience.
   */
  private storyBubble(story: StoryRow, seen: boolean) {
    const vocabulary = STORY_TYPE_VOCABULARY[story.type];
    return {
      id: story.id,
      type: story.type,
      typeLabel: vocabulary.label,
      body: story.body,
      backgroundColor: story.backgroundColor,
      /**
       * ── LE FOND IMAGE ÉTAIT CODÉ À `null`, DONC INVISIBLE ────────────────
       *
       * Cette ligne valait `null as string | null` sur les TROIS lectures de
       * story — bandeau, détail, historique. La colonne `background_asset_id`
       * était écrite, et personne ne la lisait : un membre composait sa photo,
       * elle était publiée, et `apps/web/src/screens/story/from-api.ts` posait
       * `photo: false` faute d'URL. L'écran retombait sur une couleur, et la
       * photo n'était JAMAIS vue — ni par l'auteur, ni par personne.
       *
       * L'écart était consigné des deux côtés (« LE MUR : UNE STORY À FOND IMAGE
       * EST INDESSINABLE ») mais restait théorique tant qu'aucun écran n'envoyait
       * de fond image. Le composeur de A14 le rend réel.
       *
       * `READY` et rien d'autre : la même barre que `resolveMedia` à l'écriture.
       * Un fichier encore en analyse antivirus ne doit pas sortir parce qu'une
       * story le désigne — et rendre `null` fait retomber l'écran sur la couleur,
       * ce qu'il sait déjà faire, plutôt que d'afficher une image cassée.
       *
       * La forme de l'adresse est celle de tout le dépôt, `/media/<clé>`, servie
       * par `GET /media/*key` (`media.service.ts`, `bytes`).
       */
      backgroundUrl:
        story.backgroundAsset !== null && story.backgroundAsset.status === 'READY'
          ? `/media/${story.backgroundAsset.storageKey}`
          : null,
      textStyle: story.textStyle,
      city: story.city,
      category: story.category,
      categoryLabel: subjectLabel(story.category),
      categoryOther: story.categoryOther,
      placeLabel: story.placeLabel,
      stepDefinition: story.stepDefinition,
      audience: story.audience,
      allowMessages: story.allowMessages,
      createdAt: story.createdAt,
      expiresAt: story.expiresAt,
      validUntil: story.validUntil,
      /** L'anneau (§2.6) — pas un compteur. */
      seen,
      votes: {
        positive: story.positiveCount,
        positiveKind: vocabulary.positive.kind,
        positiveLabel: vocabulary.positive.label,
        negative: story.negativeCount,
        negativeKind: vocabulary.negative.kind,
        negativeLabel: vocabulary.negative.label,
      },
      author: this.summary(story.author),
    };
  }

  /**
   * La ligne d'état de §2.6 : « 1er des conseils Logement aujourd'hui · 31
   * trouvent utile ».
   *
   * Le rang est calculé parmi les stories ACTIVES du même type et du même sujet,
   * sur le critère de classement du type (§2.6) : score pour un conseil,
   * « À voir » pour une découverte, fraîcheur pour une information.
   */
  private async storyStateLine(story: StoryRow, now: Date) {
    const vocabulary = STORY_TYPE_VOCABULARY[story.type];
    const peers = await this.prisma.story.findMany({
      where: {
        type: story.type,
        status: 'ACTIVE',
        deletedAt: null,
        expiresAt: { gt: now },
        moderationStatus: { not: 'FLAGGED' },
        ...(story.category === null ? {} : { category: story.category }),
      },
      select: { id: true, score: true, positiveCount: true, createdAt: true },
    });

    const better = peers.filter((p) => {
      if (p.id === story.id) return false;
      if (story.type === 'CONSEIL') return Number(p.score) > Number(story.score);
      if (story.type === 'DECOUVERTE') return p.positiveCount > story.positiveCount;
      return p.createdAt.getTime() > story.createdAt.getTime();
    }).length;

    const rank = better + 1;
    const family = `${vocabulary.label.toLowerCase()}s${story.category === null ? '' : ` ${subjectLabel(story.category)}`}`;
    const positive = `${story.positiveCount} ${positiveVerb(story.type, story.positiveCount)}`;

    return {
      stateLine: `${rank === 1 ? '1er' : `${rank}e`} des ${family} aujourd’hui · ${positive}`,
      rank,
      peerCount: peers.length,
    };
  }

  private storyContext(story: StoryRow) {
    const parts = [story.city.name];
    if (story.stepDefinition !== null) parts.push(story.stepDefinition.nameFr);
    else if (story.category !== null) parts.push(subjectLabel(story.category) ?? story.category);
    parts.push(relativeTimeFr(story.createdAt));
    return { text: parts.join(' · '), parts, expiresIn: expiresInFr(story.expiresAt) };
  }

  /** L'état renvoyé après une réaction — vocabulaire du type compris (§2.1). */
  private async reactionState(postId: string, type: PostType, mine: string | null) {
    const post = await this.prisma.post.findUniqueOrThrow({
      where: { id: postId },
      select: { reactionCount: true, commentCount: true },
    });
    const vocabulary = POST_TYPE_VOCABULARY[type];
    const displayCount = type === 'QUESTION' ? post.commentCount : post.reactionCount;
    return {
      kind: POST_REACTION_KIND[type],
      actionLabel: vocabulary.actionLabel,
      mine,
      reactionCount: post.reactionCount,
      displayCount,
      word: countLabel(type, displayCount),
    };
  }

  private async storyVotes(storyId: string, type: StoryType) {
    const story = await this.prisma.story.findUniqueOrThrow({
      where: { id: storyId },
      select: { positiveCount: true, negativeCount: true, score: true },
    });
    const vocabulary = STORY_TYPE_VOCABULARY[type];
    return {
      positive: story.positiveCount,
      positiveKind: vocabulary.positive.kind,
      positiveLabel: vocabulary.positive.label,
      negative: story.negativeCount,
      negativeKind: vocabulary.negative.kind,
      negativeLabel: vocabulary.negative.label,
      score: Number(story.score),
    };
  }

  /**
   * §2.6 : « Le vote négatif n'a AUCUN effet de masquage ; à 10 négatifs pour
   * moins de 3 positifs : dossier de modération priorité 4. »
   *
   * Les deux moitiés comptent autant. La story n'est pas touchée — ni `status`,
   * ni `moderation_status` — et seul un événement part. C'est ce qui empêche un
   * groupe de dix membres de faire disparaître un contenu qui les dérange.
   *
   * L'événement n'est émis qu'au FRANCHISSEMENT (le dixième vote négatif), pas à
   * chaque vote au-delà : sinon la file de modération recevrait un dossier par
   * clic sur une story déjà signalée.
   */
  private async flagIfMassivelyNegative(
    storyId: string,
    before: { positive: number; negative: number },
    isPositive: boolean,
    wasPositive: boolean | null,
  ): Promise<void> {
    if (isPositive) return;
    const negative = before.negative + 1;
    const positive = before.positive - (wasPositive === true ? 1 : 0);
    if (negative !== FEED_LIMITS.storyNegativeCaseThreshold) return;
    if (positive >= FEED_LIMITS.storyNegativeCasePositiveMax) return;

    await this.outbox.emit(this.prisma, {
      type: 'content.flagged',
      aggregateId: storyId,
      payload: {
        subjectType: 'POST',
        storyId,
        reason: 'STORY_MASSIVELY_NEGATIVE',
        priority: 4,
        negative,
        positive,
        // §2.6 : le signalement ouvre un dossier, il ne masque RIEN.
        hidden: false,
      },
    });
  }

  // ══ OUTILS — DIVERS ════════════════════════════════════════════════════════

  /**
   * §2.3 : « la ville du membre et les villes à moins de 30 km ».
   *
   * Haversine en mémoire, et non en SQL : `cities` est un référentiel de quelques
   * dizaines de lignes (02), lu une fois par requête, et le faire en SQL
   * imposerait une requête brute qui ne se compose pas avec la pagination.
   */
  private async localCityIds(userId: string): Promise<string[]> {
    const me = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { cityId: true },
    });
    if (me.cityId === null) return [];

    const center = await this.prisma.city.findUnique({
      where: { id: me.cityId },
      select: { id: true, latitude: true, longitude: true },
    });
    if (center === null) return [];

    const all = await this.prisma.city.findMany({
      select: { id: true, latitude: true, longitude: true },
    });
    const lat = Number(center.latitude);
    const lon = Number(center.longitude);
    return all
      .filter(
        (c) =>
          distanceKm(lat, lon, Number(c.latitude), Number(c.longitude)) <=
          FEED_LIMITS.localRadiusKm,
      )
      .map((c) => c.id);
  }

  private async seenStoryIds(userId: string, storyIds: readonly string[]): Promise<Set<string>> {
    if (storyIds.length === 0) return new Set();
    const views = await this.prisma.storyView.findMany({
      where: { userId, storyId: { in: [...storyIds] } },
      select: { storyId: true },
    });
    return new Set(views.map((v) => v.storyId));
  }

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ ENREGISTRER UNE STORY — LE SIGNET AVAIT UNE TABLE, PAS DE ROUTE          ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur : « Le bouton de bookmark permet d'enregistrer la stories. Tu peux
   * l'implémenter ? »
   *
   * TOUT EXISTAIT SAUF L'ÉCRITURE. La table `bookmarks` est là, son enum porte
   * `STORY`, `bookmarks.service.ts` rafraîchit l'état des signets toutes les
   * heures, et `GET /stories/:id` rend DÉJÀ `bookmarked`. Il manquait les deux
   * routes qui posent et retirent — vérifié : le mot n'apparaissait dans aucun
   * `*.controller.ts` du dépôt.
   *
   * ── CE QUE LE SIGNET CHANGE, ET QUI N'EST PAS DÉCORATIF ───────────────────
   *
   * Une story EXPIRE en vingt-quatre heures, et `storyDetail` le dit en toutes
   * lettres : une story expirée est introuvable SAUF pour son auteur et pour qui
   * l'a enregistrée (`if (expired && !isAuthor && !bookmarked) throw notFound`).
   * Enregistrer, c'est donc garder un accès que le temps retire — exactement ce
   * que la planche promet sous « VISIBLE · 24 heures · puis gardé par ceux qui
   * l'enregistrent ».
   *
   * ── IDEMPOTENT DES DEUX CÔTÉS ────────────────────────────────────────────
   *
   * Poser deux fois ne crée pas deux signets, retirer deux fois ne lève pas : le
   * membre appuie sur un bouton, il ne gère pas un état de base. `upsert` et
   * `deleteMany` disent la même chose au serveur.
   */
  /**
   * ╔═══════════════════════════════════════════════════════════════════════╗
   * ║ ENREGISTRER UNE PUBLICATION                                              ║
   * ╚═══════════════════════════════════════════════════════════════════════╝
   *
   * `visiblePost` ET NON UNE VÉRIFICATION ÉCRITE ICI, pour la raison exacte que
   * `bookmarkStory` donne juste en dessous : un signet sur une publication qu'on
   * ne peut pas lire serait une FUITE — il suffirait d'en poser un pour apprendre
   * qu'elle existe. La fonction porte déjà le masquage par modération, le blocage
   * et la cloison des réseaux.
   *
   * `upsert` ET NON `create` : poser deux fois le même signet doit être sans effet,
   * pas une erreur. L'écran peut répéter l'appel — double clic, réseau lent — et
   * la réponse doit rester la même.
   */
  async bookmarkPost(actor: FeedActor, postId: string): Promise<{ bookmarked: boolean }> {
    await this.visiblePost(actor, postId);
    await this.prisma.bookmark.upsert({
      where: {
        userId_subjectType_subjectId: {
          userId: actor.userId,
          subjectType: 'POST',
          subjectId: postId,
        },
      },
      create: { id: newId(), userId: actor.userId, subjectType: 'POST', subjectId: postId },
      update: {},
    });
    return { bookmarked: true };
  }

  /**
   * `deleteMany` ET NON `delete` : retirer un signet qu'on n'a pas est un geste
   * sans effet, pas une erreur — et c'est ce que l'écran fait quand il rejoue.
   * Aucune vérification de visibilité : on retire CE QUI EST À SOI, et une
   * publication devenue invisible doit justement pouvoir être désenregistrée.
   */
  async unbookmarkPost(actor: FeedActor, postId: string): Promise<{ bookmarked: boolean }> {
    await this.prisma.bookmark.deleteMany({
      where: { userId: actor.userId, subjectType: 'POST', subjectId: postId },
    });
    return { bookmarked: false };
  }

  async bookmarkStory(actor: FeedActor, storyId: string): Promise<{ bookmarked: boolean }> {
    /**
     * `visibleStory` ET NON UNE VÉRIFICATION ÉCRITE ICI : elle existe déjà,
     * `reactToStory` s'en sert, et elle porte les règles de §2.6 — supprimée,
     * audience `CITY` hors de sa ville, etc. En réécrire une seconde aurait
     * créé deux vérités sur ce qu'un membre a le droit de voir.
     *
     * Un signet sur une story qu'on ne peut pas lire serait une fuite : il
     * suffirait d'en poser un pour apprendre qu'elle existe.
     */
    await this.visibleStory(actor, storyId);
    await this.prisma.bookmark.upsert({
      where: {
        userId_subjectType_subjectId: {
          userId: actor.userId,
          subjectType: 'STORY',
          subjectId: storyId,
        },
      },
      create: {
        id: newId(),
        userId: actor.userId,
        subjectType: 'STORY',
        subjectId: storyId,
      },
      update: {},
    });
    return { bookmarked: true };
  }

  async unbookmarkStory(actor: FeedActor, storyId: string): Promise<{ bookmarked: boolean }> {
    await this.prisma.bookmark.deleteMany({
      where: { userId: actor.userId, subjectType: 'STORY', subjectId: storyId },
    });
    return { bookmarked: false };
  }

  private async hasStoryBookmark(userId: string, storyId: string): Promise<boolean> {
    const found = await this.prisma.bookmark.findUnique({
      where: {
        userId_subjectType_subjectId: { userId, subjectType: 'STORY', subjectId: storyId },
      },
      select: { id: true },
    });
    return found !== null;
  }

  /** Une empreinte des filtres : un curseur ne vaut que pour la requête qui l'a produit. */
  private feedScope(query: FeedQuery): string {
    return `feed:list:${query.type ?? ''}:${query.cityId ?? ''}:${query.phase ?? ''}:${query.communityId ?? ''}`;
  }

  /**
   * Ajoute la clause de curseur sur l'identifiant à un tableau `AND`.
   *
   * Générique SANS contrainte : une contrainte `T extends { id?: unknown }`
   * élargit `id` à `unknown` et fait perdre à Prisma le type de tout le `where`,
   * donc celui du `include` et de la ligne renvoyée. Le symptôme est déroutant —
   * « il manque `author` à cette ligne » alors que le `include` le demande.
   */
  private withIdCursor<T>(
    clauses: T[],
    cursor: string | undefined,
    scope: string,
    direction: 'lt' | 'gt' = 'lt',
  ): { AND: T[] } {
    if (cursor === undefined) return { AND: clauses };
    const payload = decodeCursor(cursor, this.cursorSecret, scope);
    // Tri sur un UUID v7 : décroissant sur l'identifiant EST décroissant sur la
    // date de création, sans colonne de tri supplémentaire.
    return { AND: [...clauses, { id: { [direction]: payload.id } } as T] };
  }
}

// ── Formes de ligne, pour que les projections soient typées ──────────────────

type PostRow = {
  id: string;
  type: PostType;
  body: string;
  createdAt: Date;
  authorUserId: string;
  reactionCount: number;
  commentCount: number;
  author: AuthorRow;
  city: { id: string; name: string } | null;
  community: { id: string; name: string; slug: string } | null;
  journey: { id: string; templateVersion: { template: { nameFr: string } } } | null;
  journeyStep: {
    id: string;
    journeyId: string;
    position: number;
    status: string;
    completedAt: Date | null;
    stepDefinition: { nameFr: string } | null;
  } | null;
  media: { position: number; mediaAsset: { id: string; storageKey: string } }[];
  poll: {
    id: string;
    question: string;
    isMultiple: boolean;
    resultsAfterVote: boolean;
    isAnonymous: boolean;
    closesAt: Date | null;
    createdAt: Date;
    author: { id: string; handle: string; displayName: string };
    options: {
      id: string;
      label: string;
      position: number;
      voteCount: number;
      votes: { user: { id: string; handle: string; displayName: string } }[];
    }[];
  } | null;
  guides: { guide: { id: string; slug: string; title: string } }[];
};

type StoryRow = {
  id: string;
  type: StoryType;
  body: string;
  backgroundColor: string | null;
  backgroundAsset: { storageKey: string; status: string } | null;
  textStyle: string;
  category: string | null;
  categoryOther: string | null;
  placeLabel: string | null;
  audience: string;
  allowMessages: boolean;
  createdAt: Date;
  expiresAt: Date;
  validUntil: Date | null;
  positiveCount: number;
  negativeCount: number;
  score: Prisma.Decimal | number;
  author: AuthorRow;
  city: { id: string; name: string };
  stepDefinition: { id: string; nameFr: string } | null;
};

// ── Fonctions pures ─────────────────────────────────────────────────────────

/** Un compte éteint n'apparaît pas (01 §4.4). */
function isVisibleAuthor(author: { status: string; deletedAt: Date | null }): boolean {
  return (
    author.deletedAt === null && author.status !== 'DELETED' && author.status !== 'DEACTIVATED'
  );
}

/** Haversine (02 §3 : « tri par proximité, pas de PostGIS »). */
function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number): number => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Le début de la journée UTC — la borne des « tranches de 24 h » de §2.3. */
function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** Le `sort` du curseur du fil : `<tranche ISO>|<phase>`. */
function parseFeedSort(sort: string | number | undefined): { bucket: Date; phase: FeedPhase } {
  const raw = typeof sort === 'string' ? sort : '';
  const [bucketIso, phase] = raw.split('|');
  const bucket = bucketIso === undefined ? new Date(Number.NaN) : new Date(bucketIso);
  if (Number.isNaN(bucket.getTime()) || (phase !== 'LOCAL' && phase !== 'REST')) {
    throw ApiError.validation([{ path: 'cursor', code: 'MALFORMED' }]);
  }
  return { bucket, phase };
}

function excerpt(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/**
 * « il y a 2 h » (§2.2). Composé côté SERVEUR parce que §2.2 veut la ligne de
 * contexte « prête à afficher ». Les bornes sont celles d'usage : sous la
 * minute, on ne compte pas ; au-delà d'une semaine, la date est plus parlante
 * qu'un nombre de jours.
 */
function relativeTimeFr(date: Date, now: Date = new Date()): string {
  const seconds = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1_000));
  if (seconds < 60) return 'à l’instant';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `il y a ${days} j`;
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: 'UTC' });
}

/** « Expire dans 3 h » — l'en-tête de la lecture plein écran (§2.6). */
function expiresInFr(expiresAt: Date, now: Date = new Date()): string {
  const minutes = Math.floor((expiresAt.getTime() - now.getTime()) / 60_000);
  if (minutes <= 0) return 'Expirée';
  if (minutes < 60) return `Expire dans ${minutes} min`;
  return `Expire dans ${Math.floor(minutes / 60)} h`;
}

function subjectLabel(category: string | null): string | null {
  if (category === null) return null;
  if ((STORY_SUBJECTS as readonly string[]).includes(category)) {
    return STORY_SUBJECT_LABELS[category as StorySubject];
  }
  return category.charAt(0) + category.slice(1).toLowerCase();
}

function tipKindFor(category: string | null): 'SHOP' | 'TIP' {
  if (category !== null && (STORY_DISCOVERY_CATEGORIES as readonly string[]).includes(category)) {
    return STORY_DISCOVERY_TIP_KIND[category as StoryDiscoveryCategory];
  }
  return 'TIP';
}

/** Le verbe du compteur positif, accordé (§2.6 : « 31 trouvent utile »). */
function positiveVerb(type: StoryType, count: number): string {
  if (type === 'CONSEIL') return count > 1 ? 'trouvent utile' : 'trouve utile';
  if (type === 'DECOUVERTE') return count > 1 ? 'veulent y aller' : 'veut y aller';
  return count > 1 ? 'confirment' : 'confirme';
}

/**
 * Le classement du bandeau (§2.6) : le TYPE d'abord — « informations, puis
 * conseils, puis découvertes » —, puis le critère propre au type : « Par `score` »
 * pour un conseil, « Par "À voir" » pour une découverte, « Par fraîcheur » pour
 * une information.
 */
function bandRank(story: { type: StoryType; score: Prisma.Decimal | number; positiveCount: number; createdAt: Date }): number {
  const typeIndex = STORY_BAND_TYPE_ORDER.indexOf(story.type);
  const withinType =
    story.type === 'CONSEIL'
      ? -Number(story.score)
      : story.type === 'DECOUVERTE'
        ? -story.positiveCount
        : -story.createdAt.getTime() / 1_000;
  // Le type domine : un million de places par type, jamais franchies par le
  // critère interne. Sans cette séparation, une découverte très populaire
  // passerait devant une information — l'inverse de ce que §2.6 demande.
  return typeIndex * 1e12 + withinType;
}

function compareForBand(
  a: { type: StoryType; score: Prisma.Decimal | number; positiveCount: number; createdAt: Date },
  b: { type: StoryType; score: Prisma.Decimal | number; positiveCount: number; createdAt: Date },
): number {
  return bandRank(a) - bandRank(b);
}

/** Lecture défensive d'une charge utile d'événement : elle vient de la file, pas de nous. */
function readSubject(payload: unknown): { subjectType: string; subjectId: string } | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const record = payload as Record<string, unknown>;
  const subjectType = record['subjectType'];
  const subjectId = record['subjectId'];
  if (typeof subjectType !== 'string' || typeof subjectId !== 'string') return null;
  return { subjectType, subjectId };
}

function readBlockPair(
  payload: unknown,
): { blockerUserId: string; blockedUserId: string } | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const record = payload as Record<string, unknown>;
  const blockerUserId = record['blockerUserId'];
  const blockedUserId = record['blockedUserId'];
  if (typeof blockerUserId !== 'string' || typeof blockedUserId !== 'string') return null;
  return { blockerUserId, blockedUserId };
}

function readJourneyStepId(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const record = payload as Record<string, unknown>;
  const stepId = record['journeyStepId'] ?? record['stepId'];
  return typeof stepId === 'string' ? stepId : null;
}
