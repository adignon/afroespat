import { Injectable, Logger } from '@nestjs/common';
import { newId, type Prisma } from '@app/db';
import {
  HELP_ERROR_CODES,
  HELP_ERROR_MESSAGES,
  HELP_LIMITS,
  HELP_SAFETY_BANNER,
  HELP_TYPES_FROM_PROFILE,
  HELP_USE_SERVICES_HINT,
  type CreateHelp,
  type CreateHelpResponse,
  type HelpCanHelpQuery,
  type HelpErrorCode,
  type HelpListQuery,
  type HelpMineQuery,
  type HelpMyResponsesQuery,
  type HelpTypeInput,
  type UpdateHelp,
  type VerificationLevel,
  levelSatisfies,
  matchLocalRule,
  type UpdateHelpResponse,
} from '@app/shared';
import { ApiError } from '../../common/api-error';
import { AuditService } from '../../common/audit.service';
import { buildPage, decodeCursor } from '../../common/cursor';
import { OutboxService } from '../../common/outbox.service';
import { PrismaService } from '../../common/prisma.service';
import { VisibilityService } from '../../common/visibility.service';
import { loadEnv } from '../../config/env';

/**
 * Fil d'entraide — 06-entraide.md.
 *
 * Ce module referme la boucle du produit : blocage → demande → réponse →
 * « ça m'a aidé » → contact créé → réputation créditée. Trois choses en
 * découlent, et expliquent la forme de ce service :
 *
 *   · la résolution écrit dans QUATRE tables de trois modules (`help_requests`,
 *     `help_responses`, `reputation_events`, `connections`) plus la boîte
 *     d'envoi. Tout est dans UNE transaction : un contact créé sans crédit de
 *     réputation, ou l'inverse, serait invisible et faux ;
 *   · « une seule réponse peut être marquée » (§2.4) implique de savoir
 *     DÉFAIRE : marquer une autre réponse, ou rouvrir, retire le crédit et le
 *     contact que la résolution précédente avait posés ;
 *   · l'entraide met deux membres en relation. `VisibilityService` est donc
 *     appelé sur chaque liste ET avant chaque mise en relation, dans les deux
 *     sens (08 §4).
 *
 * RÈGLE DURE (§1.2 et 14 §2) : l'entraide n'est jamais derrière un paiement. Ce
 * fichier ne lit jamais `users.plan`, et aucune de ses capacités ne porte de
 * quota de formule.
 */

/** Ce que le contrôleur transmet : l'identité et le NIVEAU du membre. */
export interface HelpActor {
  readonly userId: string;
  /**
   * §2.1 : une OFFER exige L1. Le niveau ne peut pas venir du décorateur — une
   * même route porte les deux `kind` — donc il vient du jeton, comme le garde le
   * lit lui-même.
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

type AuthorRow = {
  id: string;
  handle: string;
  displayName: string;
  phase: string;
  verificationLevel: string;
  avatarAsset: { storageKey: string } | null;
  city: { name: string } | null;
  originCountry: { iso2: string };
  mentorProfile: { userId: string } | null;
};

/**
 * CE QUE TOUTE CARTE DE LISTE LIT, au même endroit.
 *
 * L'étape d'origine (§2.5) y est jointe : la ligne « Étape 7 · Logement · parcours
 * Études » n'existait que sur le détail, et les listes écrivaient « Demande issue
 * d'un parcours » faute de mieux. Le titre PERSONNEL du parcours n'est pas
 * sélectionné — §2.5 veut le type, « jamais le titre personnel » (04 §2) : ne pas
 * le lire est plus sûr que penser à ne pas l'écrire.
 */
const CARD_INCLUDE = {
  author: { select: AUTHOR_SELECT },
  city: { select: { id: true, name: true } },
  originJourneyStep: {
    select: {
      title: true,
      position: true,
      stepDefinition: { select: { nameFr: true } },
      journey: {
        select: { templateVersion: { select: { template: { select: { nameFr: true } } } } },
      },
    },
  },
} as const;

/** Rayon de la Terre, en kilomètres — tri par proximité (02 §3, pas de PostGIS). */
const EARTH_RADIUS_KM = 6_371;

@Injectable()
export class HelpService {
  private readonly logger = new Logger(HelpService.name);
  private readonly cursorSecret = loadEnv().CURSOR_SECRET;

  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
    private readonly visibility: VisibilityService,
  ) {}

  private fail(code: HelpErrorCode, details?: Record<string, unknown>): never {
    throw new ApiError(code, HELP_ERROR_MESSAGES[code], HELP_ERROR_CODES[code], details);
  }

  /**
   * RÈGLE DURE (§2.7) : le bandeau de non-paiement accompagne CHAQUE réponse de
   * la section — listes et détail. Une seule fonction le pose, pour qu'aucune
   * route ne puisse l'oublier.
   */
  private meta(extra?: Record<string, unknown>): Record<string, unknown> {
    return { safetyBanner: HELP_SAFETY_BANNER, useServicesHint: HELP_USE_SERVICES_HINT, ...extra };
  }

  // ── Lectures ──────────────────────────────────────────────────────────────

  /**
   * `GET /help` (§4). Tri `createdAt desc` (T4 §4).
   *
   * Deux filtres ne sont PAS des options de l'appelant et s'appliquent toujours :
   * les membres séparés du lecteur (08 §4) et les demandes masquées par la
   * modération. Les rendre facultatifs reviendrait à laisser une requête les
   * contourner.
   */
  async list(actor: HelpActor, query: HelpListQuery) {
    const cityIds = await this.cityScope(query.cityId, query.radiusKm);
    // Le filtre de phase est passé à `baseWhere`, et non ajouté à côté : les deux
    // portent sur la relation `author`, et un second `author: { … }` dans le même
    // objet ÉCRASE le premier — les comptes éteints repasseraient alors dans la
    // liste dès qu'on filtre par phase. Trouvé en relisant le `where` construit.
    const where: Prisma.HelpRequestWhereInput = {
      ...(await this.baseWhere(actor.userId, query.phase)),
      status: query.status,
      ...(query.kind === undefined ? {} : { kind: query.kind }),
      ...(query.type === undefined ? {} : { type: query.type }),
      ...(cityIds === null ? {} : { cityId: { in: cityIds } }),
      ...(query.fromJourney === undefined
        ? {}
        : query.fromJourney
          ? { originJourneyStepId: { not: null } }
          : { originJourneyStepId: null }),
    };

    const scope = `help:list:${query.kind ?? ''}:${query.type ?? ''}:${query.cityId ?? ''}:${query.radiusKm}:${query.status}:${query.phase ?? ''}:${String(query.fromJourney)}`;
    const rows = await this.prisma.helpRequest.findMany({
      where: this.withCursor(where, query.cursor, scope),
      orderBy: { id: 'desc' },
      take: query.limit + 1,
      include: CARD_INCLUDE,
    });

    const page = buildPage(rows, query.limit, scope, this.cursorSecret);
    return {
      items: page.items.map((row) => this.card(row, actor.userId)),
      nextCursor: page.nextCursor,
      meta: this.meta(await this.counters(cityIds)),
    };
  }

  /**
   * « Vous pouvez aider » (§2.6) : les demandes OPEN de la ville du membre (puis
   * 30 km) dont le type correspond à ses `help_types` déclarés, OU dont l'étape
   * d'origine porte une `step_definition` qu'il a déjà franchie.
   *
   * Pas de curseur ici, et `nextCursor` toujours nul : c'est une SUGGESTION
   * calculée, triée par échéance la plus proche, pas une archive à parcourir.
   * Paginer par curseur une liste dont l'ordre dépend d'une date nullable
   * demanderait un curseur composite pour un encadré de colonne droite.
   */
  async canHelp(actor: HelpActor, query: HelpCanHelpQuery) {
    const me = await this.prisma.user.findUniqueOrThrow({
      where: { id: actor.userId },
      select: { cityId: true, profile: { select: { helpTypes: true } } },
    });

    // Les types déclarés au profil, traduits vers ceux de l'entraide (§2.6).
    const declared = new Set(
      (me.profile?.helpTypes ?? []).flatMap((t) => [...HELP_TYPES_FROM_PROFILE[t]]),
    );
    const completedDefinitions = await this.completedStepDefinitions(actor.userId);

    // Aucun critère : aucune suggestion. Renvoyer « toutes les demandes » serait
    // la pire réponse — l'encadré perdrait son sens et son taux de réponse.
    if (declared.size === 0 && completedDefinitions.length === 0) {
      return { items: [], nextCursor: null, meta: this.meta({ reason: 'NO_CRITERIA' }) };
    }

    const cityIds = await this.cityScope(me.cityId ?? undefined, query.radiusKm);
    const criteria: Prisma.HelpRequestWhereInput[] = [];
    if (declared.size > 0) criteria.push({ type: { in: [...declared] } });
    if (completedDefinitions.length > 0) {
      criteria.push({ originJourneyStep: { stepDefinitionId: { in: completedDefinitions } } });
    }

    const rows = await this.prisma.helpRequest.findMany({
      where: {
        ...(await this.baseWhere(actor.userId)),
        status: 'OPEN',
        // §2.6 parle de DEMANDES : une offre n'attend pas qu'on l'aide.
        kind: 'REQUEST',
        // On n'aide pas soi-même — ses propres demandes n'ont rien à faire ici.
        authorUserId: { not: actor.userId },
        ...(cityIds === null ? {} : { cityId: { in: cityIds } }),
        OR: criteria,
      },
      // « Tri : échéance proche d'abord » (§2.6). Les demandes sans échéance
      // viennent après, faute de quoi elles occuperaient tout l'encadré.
      orderBy: [{ dueDate: { sort: 'asc', nulls: 'last' } }, { id: 'desc' }],
      take: query.limit,
      include: CARD_INCLUDE,
    });

    return {
      items: rows.map((row) => this.card(row, actor.userId)),
      nextCursor: null,
      meta: this.meta(),
    };
  }

  /** `GET /help/mine` (§4). Mes demandes, archivées comprises. */
  async mine(actor: HelpActor, query: HelpMineQuery) {
    const where: Prisma.HelpRequestWhereInput = {
      authorUserId: actor.userId,
      deletedAt: null,
      ...(query.status === undefined ? {} : { status: query.status }),
    };
    const scope = `help:mine:${query.status ?? ''}`;

    const rows = await this.prisma.helpRequest.findMany({
      where: this.withCursor(where, query.cursor, scope),
      orderBy: { id: 'desc' },
      take: query.limit + 1,
      include: CARD_INCLUDE,
    });

    const page = buildPage(rows, query.limit, scope, this.cursorSecret);
    return {
      items: page.items.map((row) => this.card(row, actor.userId)),
      nextCursor: page.nextCursor,
      meta: this.meta(),
    };
  }

  /** `GET /help/my-responses` (§4). */
  async myResponses(actor: HelpActor, query: HelpMyResponsesQuery) {
    const separated = await this.visibility.separatedFrom(actor.userId);
    const where: Prisma.HelpResponseWhereInput = {
      authorUserId: actor.userId,
      deletedAt: null,
      // La demande dont l'auteur m'a bloqué depuis disparaît de mes réponses
      // aussi : la séparation vaut dans les deux sens et sur tous les écrans.
      helpRequest: { deletedAt: null, authorUserId: { notIn: separated } },
    };
    const scope = 'help:my-responses';

    const rows = await this.prisma.helpResponse.findMany({
      where: this.withCursor(where, query.cursor, scope),
      orderBy: { id: 'desc' },
      take: query.limit + 1,
      include: {
        helpRequest: { include: CARD_INCLUDE },
      },
    });

    const page = buildPage(rows, query.limit, scope, this.cursorSecret);
    return {
      items: page.items.map((row) => ({
        id: row.id,
        body: row.body,
        createdAt: row.createdAt,
        markedHelpful: row.markedHelpful,
        markedAt: row.markedAt,
        request: this.card(row.helpRequest, actor.userId),
      })),
      nextCursor: page.nextCursor,
      meta: this.meta(),
    };
  }

  /**
   * `GET /help/:id` (§4) : la demande, ses réponses, et le contexte de parcours.
   *
   * §4 annonce « 404 si archivée et auteur bloqué ». Le 404 est ici appliqué dès
   * qu'un blocage existe, archivée ou non : `VisibilityService` ne connaît pas de
   * demi-visibilité, et une demande OPEN d'un membre bloqué qui resterait
   * lisible par lien direct viderait la règle de son sens.
   */
  async detail(actor: HelpActor, id: string) {
    const request = await this.prisma.helpRequest.findUnique({
      where: { id },
      include: {
        author: { select: AUTHOR_SELECT },
        city: { select: { id: true, name: true } },
        originJourneyStep: {
          select: {
            id: true,
            title: true,
            position: true,
            dueDate: true,
            stepDefinition: { select: { nameFr: true } },
            journey: {
              // Le titre PERSONNEL du parcours n'est pas sélectionné : §2.5 veut
              // le type de parcours, « jamais le titre personnel » (règle dure
              // 04 §2). Ne pas le lire est plus sûr que penser à ne pas l'écrire.
              select: {
                templateVersion: { select: { template: { select: { nameFr: true } } } },
              },
            },
          },
        },
      },
    });

    if (request === null || request.deletedAt !== null) throw ApiError.notFound();
    if (request.moderationStatus === 'FLAGGED' && request.authorUserId !== actor.userId) {
      // Masquée par la modération : invisible pour tous, sauf son auteur — qui
      // doit comprendre pourquoi elle ne paraît plus (13 §2).
      throw ApiError.notFound();
    }
    await this.visibility.assertVisible(actor.userId, request.authorUserId);
    if (!this.isVisibleAuthor(request.author)) throw ApiError.notFound();

    const separated = await this.visibility.separatedFrom(actor.userId);
    const responses = await this.prisma.helpResponse.findMany({
      where: { helpRequestId: id, deletedAt: null, authorUserId: { notIn: separated } },
      orderBy: [{ markedHelpful: 'desc' }, { id: 'asc' }],
      include: { author: { select: AUTHOR_SELECT } },
    });

    const isAuthor = request.authorUserId === actor.userId;
    return {
      request: {
        ...this.card(request, actor.userId),
        body: request.body,
        updatedAt: request.updatedAt,
        // Le serveur DÉCIDE ce que l'auteur peut faire ; le front éteint les
        // boutons sur ces drapeaux et ne recompte pas les 7 jours (§2.2).
        canEdit: isAuthor && request.status === 'OPEN',
        canReopen:
          isAuthor &&
          request.status === 'RESOLVED' &&
          this.reopenWindowOpen(request.resolvedAt ?? request.updatedAt),
      },
      journeyContext: this.journeyContext(request.originJourneyStep),
      responses: responses
        .filter((r) => this.isVisibleAuthor(r.author))
        .map((r) => ({
          id: r.id,
          body: r.body,
          createdAt: r.createdAt,
          markedHelpful: r.markedHelpful,
          markedAt: r.markedAt,
          author: this.summary(r.author),
          /** §2.4 : l'auteur marque UNE réponse, et seulement tant qu'elle est ouverte. */
          canMarkHelpful:
            isAuthor &&
            request.kind === 'REQUEST' &&
            request.status === 'OPEN' &&
            r.authorUserId !== actor.userId,
          isMine: r.authorUserId === actor.userId,
          /** Modifier ou supprimer MA réponse : jamais une réponse déjà marquée utile (§8). */
          canEdit: r.authorUserId === actor.userId && !r.markedHelpful && request.status === 'OPEN',
        })),
      meta: this.meta(),
    };
  }

  // ── Écritures ─────────────────────────────────────────────────────────────

  /**
   * `POST /help` (§4).
   *
   * Le contrôle de niveau est ICI et non sur le décorateur : une seule route
   * publie les deux `kind`, et §2.1 leur donne deux capacités différentes —
   * `help.ask` dès L0, `help.offer` à partir de L1. Le décorateur porte donc la
   * plus permissive des deux, et le `kind` décide du reste.
   *
   * §2.1 : « Un L0 peut poser une question mais pas proposer une offre — c'est la
   * protection du segment pré-départ contre le démarchage. »
   */
  async create(actor: HelpActor, input: CreateHelp) {
    if (input.kind === 'OFFER' && !levelSatisfies(actor.level, 'help.offer')) {
      throw ApiError.levelRequired('help.offer', actor.level);
    }

    const type = this.assertHelpType(input.type);
    this.assertPublishable(input.title, input.body);
    await this.assertQuota(actor.userId);

    const city = await this.prisma.city.findUnique({
      where: { id: input.cityId },
      select: { id: true, mergedIntoCityId: true },
    });
    if (city === null) throw ApiError.notFound();
    // Une ville fusionnée n'existe plus pour personne (02 §2.2) : la demande part
    // sur la ville cible, sinon elle n'apparaîtrait dans aucune liste.
    const cityId = city.mergedIntoCityId ?? city.id;

    // §2.5 : l'échéance est héritée de l'étape quand la demande en vient.
    const step = await this.resolveOriginStep(actor.userId, input.originJourneyStepId);
    const dueDate =
      input.dueDate !== undefined ? new Date(input.dueDate) : (step?.dueDate ?? null);

    const id = newId();
    await this.prisma.$transaction(async (tx) => {
      await tx.helpRequest.create({
        data: {
          id,
          authorUserId: actor.userId,
          kind: input.kind,
          type,
          title: input.title,
          body: input.body,
          cityId,
          status: 'OPEN',
          // PENDING : les règles locales sont passées, l'analyse IA suivra en
          // file (13 §2). `CLEARED` mentirait sur ce qui a été vérifié.
          moderationStatus: 'PENDING',
          ...(step === null ? {} : { originJourneyStepId: step.id }),
          ...(dueDate === null ? {} : { dueDate }),
        },
      });

      await this.outbox.emit(tx, {
        type: 'help_request.published',
        aggregateId: id,
        payload: {
          authorUserId: actor.userId,
          kind: input.kind,
          type,
          cityId,
          ...(step === null ? {} : { originJourneyStepId: step.id }),
        },
      });
    });

    return this.detail(actor, id);
  }

  /** `PATCH /help/:id` (§4) : l'auteur, tant que la demande est OPEN. */
  async update(actor: HelpActor, id: string, patch: UpdateHelp) {
    const request = await this.ownedRequest(actor.userId, id);
    if (request.status !== 'OPEN') this.fail('REQUEST_CLOSED');

    const data: Prisma.HelpRequestUpdateInput = {};
    if (patch.type !== undefined) data.type = this.assertHelpType(patch.type);
    if (patch.title !== undefined) data.title = patch.title;
    if (patch.body !== undefined) data.body = patch.body;
    if (patch.dueDate !== undefined) {
      data.dueDate = patch.dueDate === null ? null : new Date(patch.dueDate);
    }
    if (patch.cityId !== undefined) {
      const city = await this.prisma.city.findUnique({
        where: { id: patch.cityId },
        select: { id: true, mergedIntoCityId: true },
      });
      if (city === null) throw ApiError.notFound();
      data.city = { connect: { id: city.mergedIntoCityId ?? city.id } };
    }

    if (patch.title !== undefined || patch.body !== undefined) {
      // Le texte modifié repasse par les règles locales : sans cela, publier un
      // texte acceptable puis le remplacer contournerait entièrement le filtre.
      this.assertPublishable(patch.title ?? request.title, patch.body ?? request.body);
      data.moderationStatus = 'PENDING';
    }

    if (Object.keys(data).length > 0) {
      await this.prisma.helpRequest.update({ where: { id }, data });
    }
    return this.detail(actor, id);
  }

  /**
   * `POST /help/:id/responses` (§2.3 et §4).
   *
   * Capacité `comment.create`, ouverte dès L0 : « un pré-départ aide un autre
   * pré-départ » (§2.3). C'est l'OFFRE qui exige L1, pas l'entraide.
   */
  async respond(actor: HelpActor, id: string, input: CreateHelpResponse) {
    const request = await this.visibleRequest(actor.userId, id);

    // §2.3 : « L'auteur d'une demande ne peut pas y répondre. » Il modifie sa
    // demande pour la compléter.
    if (request.authorUserId === actor.userId) this.fail('OWN_REQUEST');
    if (request.status !== 'OPEN') this.fail('REQUEST_CLOSED');

    this.assertPublishable(null, input.body);
    await this.assertResponseQuota(actor.userId);

    const responseId = newId();
    await this.prisma.$transaction(async (tx) => {
      await tx.helpResponse.create({
        data: {
          id: responseId,
          helpRequestId: id,
          authorUserId: actor.userId,
          body: input.body,
        },
      });
      // Le compteur est dénormalisé (00 §6 : « tous les *_count ») : il est
      // incrémenté dans la MÊME transaction, sinon la carte affiche un nombre
      // faux jusqu'au prochain recalcul.
      await tx.helpRequest.update({
        where: { id },
        data: { responseCount: { increment: 1 } },
      });
      await this.outbox.emit(tx, {
        type: 'help_request.responded',
        aggregateId: id,
        payload: {
          responseId,
          responderUserId: actor.userId,
          authorUserId: request.authorUserId,
        },
      });
    });

    return { id: responseId, meta: this.meta() };
  }

  /**
   * « Ça m'a aidé » (§2.4) — le cœur du module.
   *
   * Cinq effets, indissociables : la réponse est marquée, la demande passe
   * RESOLVED, la réputation de l'aidant est créditée, un contact est créé, et
   * l'événement part. Une transaction unique, parce qu'un contact sans crédit (ou
   * l'inverse) ne se rattrape pas : rien dans les données ne dirait qu'il manque.
   *
   * « Une seule réponse peut être marquée. Marquer une autre réponse désmarque la
   * première (réputation et connexion ajustées) » — d'où `unwind()`.
   */
  async markHelpful(actor: HelpActor, id: string, responseId: string) {
    const request = await this.prisma.helpRequest.findUnique({
      where: { id },
      select: {
        id: true,
        authorUserId: true,
        kind: true,
        status: true,
        deletedAt: true,
        resolvedByResponseId: true,
        originJourneyStepId: true,
      },
    });
    if (request === null || request.deletedAt !== null) throw ApiError.notFound();
    // NOT_AUTHOR et non 404 : la demande est publique, son existence n'est pas un
    // secret (§4 nomme ce code). Le 404 est réservé à ce qui doit rester inconnu.
    if (request.authorUserId !== actor.userId) this.fail('NOT_AUTHOR');
    // §2.9 : une offre se clôt par « Offre pourvue », sans marquage — « la
    // réputation n'est créditée que sur une demande résolue par un aidant, pas
    // sur une offre. Cela évite de récompenser l'auto-promotion. »
    if (request.kind === 'OFFER') {
      throw ApiError.transverse('CONFLICT', { reason: 'OFFER_NOT_MARKABLE' });
    }
    if (request.status === 'ARCHIVED') this.fail('REQUEST_CLOSED');

    const response = await this.prisma.helpResponse.findUnique({
      where: { id: responseId },
      select: { id: true, helpRequestId: true, authorUserId: true, deletedAt: true },
    });
    if (response === null || response.deletedAt !== null) throw ApiError.notFound();
    if (response.helpRequestId !== id) throw ApiError.notFound();
    // §2.4 : « Impossible de se marquer soi-même » — une réponse de l'auteur
    // n'existe pas (§2.3), mais la garde reste : elle coûte une ligne et ferme
    // définitivement la porte à une réputation auto-attribuée.
    if (response.authorUserId === actor.userId) this.fail('OWN_REQUEST');

    const separated = await this.visibility.isSeparated(actor.userId, response.authorUserId);
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      if (
        request.resolvedByResponseId !== null &&
        request.resolvedByResponseId !== responseId
      ) {
        await this.unwind(tx, request.id, request.resolvedByResponseId);
      }

      await tx.helpResponse.update({
        where: { id: responseId },
        data: { markedHelpful: true, markedAt: now },
      });
      await tx.helpRequest.update({
        where: { id },
        data: { status: 'RESOLVED', resolvedAt: now, resolvedByResponseId: responseId },
      });

      // Réputation : la contrainte d'unicité (membre, type, source) porte sur la
      // DEMANDE, pas sur la réponse (00 §9.4). C'est ce qui garantit « une seule
      // fois par demande » (§9) même si l'auteur change de réponse marquée.
      const credited = await tx.reputationEvent.createMany({
        data: [
          {
            id: newId(),
            userId: response.authorUserId,
            type: 'HELP_VALIDATED',
            sourceType: 'help_request',
            sourceId: request.id,
          },
        ],
        skipDuplicates: true,
      });

      // Le compteur ne bouge QUE si l'événement a réellement été créé.
      //
      // Bogue trouvé en exerçant le service : marquer deux fois la même réponse
      // laissait `reputation_events` à une ligne — `skipDuplicates` faisait son
      // travail — mais incrémentait `help_validated_count` à chaque appel. Le
      // compteur affiché partait donc en avance sur les événements qui le
      // justifient, et la règle « une seule fois par demande » (§9) était fausse
      // là où elle se voit : sur le profil.
      if (credited.count > 0) {
        // `upsert` et non `update` : la ligne `user_stats` n'existe pas
        // forcément — rien ne la crée à l'inscription. `computed_at` est
        // obligatoire et porte la date du dernier recalcul, ici celle du crédit.
        await tx.userStats.upsert({
          where: { userId: response.authorUserId },
          create: { userId: response.authorUserId, helpValidatedCount: 1, computedAt: now },
          update: { helpValidatedCount: { increment: 1 }, computedAt: now },
        });
      }

      // Contact automatique (§2.4, 08 §3.1), « sauf si un blocage existe ».
      if (!separated) {
        await this.connect(tx, actor.userId, response.authorUserId, request.id);
      }

      await this.audit.record(tx, {
        actor: { type: 'MEMBER', id: actor.userId },
        action: 'help_request.marked_helpful',
        targetType: 'help_request',
        targetId: request.id,
        metadata: { responseId, helperUserId: response.authorUserId, connectionCreated: !separated },
      });

      await this.outbox.emit(tx, {
        type: 'help_request.resolved',
        aggregateId: request.id,
        payload: {
          responseId,
          helperUserId: response.authorUserId,
          authorUserId: actor.userId,
          connectionCreated: !separated,
          // §2.4 : le module 03 consomme ceci pour poser l'activité
          // HELP_RECEIVED et proposer « marquer l'étape comme franchie ? ».
          originJourneyStepId: request.originJourneyStepId,
        },
      });
    });

    return this.detail(actor, id);
  }

  /** `POST /help/:id/resolve` (§2.2 et §2.9) : « Résolu sans réponse », ou « Offre pourvue ». */
  async resolve(actor: HelpActor, id: string) {
    const request = await this.ownedRequest(actor.userId, id);
    if (request.status !== 'OPEN') this.fail('REQUEST_CLOSED');

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.helpRequest.update({
        where: { id },
        data: { status: 'RESOLVED', resolvedAt: now },
      });
      // Aucun aidant, donc AUCUNE réputation et AUCUN contact (§2.4 les attache
      // au marquage, pas à la résolution). L'événement part quand même : le
      // module 03 a une étape à proposer de franchir, la recherche un document à
      // mettre à jour.
      await this.outbox.emit(tx, {
        type: 'help_request.resolved',
        aggregateId: id,
        payload: {
          responseId: null,
          helperUserId: null,
          authorUserId: actor.userId,
          connectionCreated: false,
          originJourneyStepId: request.originJourneyStepId,
        },
      });
    });

    return this.detail(actor, id);
  }

  /**
   * `POST /help/:id/reopen` (§2.2) : « L'auteur peut rouvrir une demande RESOLVED
   * dans les 7 jours (erreur de clic). »
   *
   * Erreur de clic veut dire que tout ce que la résolution a produit doit
   * repartir : le marquage, le crédit de réputation, et le contact créé par CETTE
   * résolution (§6 : « reputation (retrait), connections (retrait si créée par
   * cette résolution) »). Un contact né d'un parrainage ou d'une demande manuelle
   * survit — il n'a pas été créé ici.
   */
  async reopen(actor: HelpActor, id: string) {
    const request = await this.ownedRequest(actor.userId, id);
    if (request.status !== 'RESOLVED') this.fail('REQUEST_CLOSED');

    const since = request.resolvedAt ?? request.updatedAt;
    if (!this.reopenWindowOpen(since)) {
      this.fail('REOPEN_WINDOW_CLOSED', { resolvedAt: since.toISOString() });
    }

    await this.prisma.$transaction(async (tx) => {
      if (request.resolvedByResponseId !== null) {
        await this.unwind(tx, request.id, request.resolvedByResponseId);
      }
      await tx.helpRequest.update({
        where: { id },
        // §3 « Ajoutée » : `reopened_at` garde la trace de la réouverture — sans
        // elle, rien ne distinguait une demande jamais résolue d'une demande
        // rouverte, et une troisième résolution n'avait aucune mémoire.
        data: {
          status: 'OPEN',
          resolvedAt: null,
          resolvedByResponseId: null,
          reopenedAt: new Date(),
        },
      });
      await this.outbox.emit(tx, {
        type: 'help_request.reopened',
        aggregateId: id,
        payload: { authorUserId: actor.userId, previousResponseId: request.resolvedByResponseId },
      });
    });

    return this.detail(actor, id);
  }

  /**
   * `POST /help/:id/private-reply` (§2.3 et §4) : ouvre ou récupère la
   * conversation directe avec l'auteur.
   *
   * §2.3 : la réponse privée n'est PAS comptée dans `response_count` — elle ne
   * crée aucune ligne `help_responses`. 08 §3.2 l'autorise même hors contact :
   * « un membre L1 ne peut écrire qu'à un contact, ou en réponse privée à une
   * demande d'entraide ».
   */
  async privateReply(actor: HelpActor, id: string) {
    const request = await this.visibleRequest(actor.userId, id);
    if (request.authorUserId === actor.userId) this.fail('OWN_REQUEST');

    const existing = await this.prisma.conversation.findFirst({
      where: {
        kind: 'DIRECT',
        // Les deux membres, et personne d'autre : une conversation directe n'a
        // que deux participants, et `every` sans `some` accepterait une
        // conversation vide.
        AND: [
          { members: { some: { userId: actor.userId } } },
          { members: { some: { userId: request.authorUserId } } },
        ],
      },
      select: { id: true },
    });
    if (existing !== null) return { conversationId: existing.id, created: false };

    const conversationId = newId();
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.conversation.create({ data: { id: conversationId, kind: 'DIRECT' } });
      await tx.conversationMember.createMany({
        data: [
          { conversationId, userId: actor.userId, joinedAt: now },
          { conversationId, userId: request.authorUserId, joinedAt: now },
        ],
      });
    });

    return { conversationId, created: true };
  }

  /** `DELETE /help/:id` (§4) : suppression logique par l'auteur. */
  async remove(actor: HelpActor, id: string): Promise<void> {
    const request = await this.ownedRequest(actor.userId, id);

    await this.prisma.$transaction(async (tx) => {
      await tx.helpRequest.update({ where: { id }, data: { deletedAt: new Date() } });
      await this.audit.record(tx, {
        actor: { type: 'MEMBER', id: actor.userId },
        action: 'help_request.deleted',
        targetType: 'help_request',
        targetId: id,
        metadata: { status: request.status, responseCount: request.responseCount },
      });
    });
  }

  /**
   * `PATCH /help/:id/responses/:rid` — modifier SA réponse.
   *
   * Pas dans le tableau de §4, qui ne prévoit que la suppression ; l'écran « Mes
   * réponses » dessine pourtant « Modifier ma réponse », et corriger une faute ne
   * doit pas obliger à supprimer puis réécrire (la réponse perdrait son rang).
   *
   * Mêmes garde-fous que la publication : le texte repasse par les règles locales
   * de modération (sinon publier un texte acceptable puis le remplacer
   * contournerait le filtre), et une réponse marquée « ça m'a aidé » ne se modifie
   * pas — elle a produit un crédit de réputation et un contact sur ce qu'elle
   * disait. Comme `removeResponse`, la demande doit être encore ouverte.
   */
  async updateResponse(
    actor: HelpActor,
    id: string,
    responseId: string,
    input: UpdateHelpResponse,
  ) {
    const response = await this.prisma.helpResponse.findUnique({
      where: { id: responseId },
      select: {
        id: true,
        helpRequestId: true,
        authorUserId: true,
        deletedAt: true,
        markedHelpful: true,
        helpRequest: { select: { status: true, deletedAt: true } },
      },
    });
    if (response === null || response.deletedAt !== null) throw ApiError.notFound();
    if (response.helpRequestId !== id || response.helpRequest.deletedAt !== null) {
      throw ApiError.notFound();
    }
    if (response.authorUserId !== actor.userId) this.fail('NOT_AUTHOR');
    if (response.markedHelpful) {
      throw ApiError.transverse('CONFLICT', { reason: 'MARKED_HELPFUL' });
    }
    if (response.helpRequest.status !== 'OPEN') this.fail('REQUEST_CLOSED');

    this.assertPublishable(null, input.body);
    await this.prisma.helpResponse.update({
      where: { id: responseId },
      data: { body: input.body },
    });
    return { id: responseId, meta: this.meta() };
  }

  /**
   * `DELETE /help/:id/responses/:rid` (§4).
   *
   * Une réponse marquée « ça m'a aidé » ne se supprime pas : §8 la conserve même
   * à la suppression du compte, « elle a aidé quelqu'un ». La supprimer retirerait
   * aussi l'encart de clôture de la demande de quelqu'un d'autre.
   */
  async removeResponse(actor: HelpActor, id: string, responseId: string): Promise<void> {
    const response = await this.prisma.helpResponse.findUnique({
      where: { id: responseId },
      select: {
        id: true,
        helpRequestId: true,
        authorUserId: true,
        deletedAt: true,
        markedHelpful: true,
      },
    });
    if (response === null || response.deletedAt !== null) throw ApiError.notFound();
    if (response.helpRequestId !== id) throw ApiError.notFound();
    if (response.authorUserId !== actor.userId) this.fail('NOT_AUTHOR');
    if (response.markedHelpful) {
      throw ApiError.transverse('CONFLICT', { reason: 'MARKED_HELPFUL' });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.helpResponse.update({ where: { id: responseId }, data: { deletedAt: new Date() } });
      await tx.helpRequest.update({
        where: { id },
        data: { responseCount: { decrement: 1 } },
      });
    });
  }

  // ── Tâche planifiée `help.archive` (§7) ───────────────────────────────────

  /**
   * Archivage quotidien (§2.2 et §7) : « OPEN sans réponse depuis 45 jours, ou
   * RESOLVED depuis 90 jours ».
   *
   * « Sans réponse DEPUIS 45 jours » se lit sur la dernière réponse, pas sur la
   * création : une demande qui a reçu une réponse il y a deux jours est vivante,
   * même si elle a été publiée il y a deux mois. Une demande qui n'en a jamais eu
   * compte depuis sa création.
   *
   * Rendue publique et sans dépendance à l'heure système pour être éprouvable :
   * un test qui doit attendre 45 jours ne serait jamais écrit.
   */
  async archiveDue(now: Date = new Date()): Promise<{ archived: number }> {
    const openCutoff = new Date(now.getTime() - HELP_LIMITS.archiveOpenDays * 86_400_000);
    const resolvedCutoff = new Date(now.getTime() - HELP_LIMITS.archiveResolvedDays * 86_400_000);

    const stale = await this.prisma.helpRequest.findMany({
      where: {
        deletedAt: null,
        OR: [
          {
            status: 'OPEN',
            createdAt: { lt: openCutoff },
            // Aucune réponse récente : ni une réponse vivante après la coupure,
            // ni une réponse tout court quand la demande est plus vieille.
            responses: { none: { deletedAt: null, createdAt: { gte: openCutoff } } },
          },
          { status: 'RESOLVED', resolvedAt: { lt: resolvedCutoff } },
        ],
      },
      select: { id: true },
    });
    if (stale.length === 0) return { archived: 0 };

    const result = await this.prisma.helpRequest.updateMany({
      where: { id: { in: stale.map((r) => r.id) } },
      // §3 « Ajoutée » : `archived_at` est posée ici, par la tâche `help.archive`
      // (§7) — la date de l'archivage, et non plus `updated_at` qu'une écriture
      // quelconque déplace.
      data: { status: 'ARCHIVED', archivedAt: now },
    });
    this.logger.log(`help.archive : ${result.count} demandes archivées`);
    return { archived: result.count };
  }

  // ── Gestionnaire de suppression (§8) ─────────────────────────────────────

  /**
   * Part de ce module dans la suppression d'un compte (§8, appelée par
   * `account.deletion_execute` du module 01).
   *
   * « Demandes : supprimées. Réponses : conservées ANONYMISÉES si
   * `marked_helpful` — elles ont aidé quelqu'un —, supprimées sinon. »
   *
   * L'anonymisation ne se fait pas ici : 01 §2.8 garde la ligne `users` en la
   * vidant (`handle` remplacé, `display_name` = « Membre supprimé »), et la
   * réponse conservée pointe donc vers un membre déjà anonyme. Rien à faire de
   * plus — et surtout rien à écrire dans `users`, qui n'appartient pas à ce
   * module.
   */
  async handleUserDeleted(userId: string): Promise<{ requests: number; responses: number }> {
    return this.prisma.$transaction(async (tx) => {
      // Les réponses des AUTRES sur mes demandes partent avec elles (cascade de
      // `help_requests` → `help_responses`) : sans la demande, une réponse n'a
      // plus de sens lisible.
      const requests = await tx.helpRequest.deleteMany({ where: { authorUserId: userId } });
      const responses = await tx.helpResponse.deleteMany({
        where: { authorUserId: userId, markedHelpful: false },
      });
      return { requests: requests.count, responses: responses.count };
    });
  }

  // ── Outils ────────────────────────────────────────────────────────────────

  /**
   * Le filtre appliqué à TOUTE liste publique : ni supprimée, ni masquée par la
   * modération, ni d'un membre séparé du lecteur, ni d'un compte éteint.
   */
  private async baseWhere(
    viewerId: string,
    phase?: 'PRE_DEPARTURE' | 'RECENT_ARRIVAL' | 'SETTLED',
  ): Promise<Prisma.HelpRequestWhereInput> {
    const separated = await this.visibility.separatedFrom(viewerId);
    return {
      deletedAt: null,
      // `moderation.content_hidden` (§6) se lit ici : un contenu FLAGGED sort des
      // listes sans que ce module ait besoin d'écouter l'événement.
      moderationStatus: { not: 'FLAGGED' },
      authorUserId: { notIn: separated },
      author: {
        deletedAt: null,
        // Un compte suspendu garde ses contenus visibles (§7.3 : il peut
        // consulter, et ce qu'il a publié reste) ; désactivé ou supprimé, non.
        status: { in: ['ACTIVE', 'SUSPENDED'] },
        ...(phase === undefined ? {} : { phase }),
      },
    };
  }

  /** La demande, si le lecteur a le droit de la connaître. */
  private async visibleRequest(viewerId: string, id: string) {
    const request = await this.prisma.helpRequest.findUnique({
      where: { id },
      select: {
        id: true,
        authorUserId: true,
        status: true,
        kind: true,
        deletedAt: true,
        moderationStatus: true,
      },
    });
    if (request === null || request.deletedAt !== null) throw ApiError.notFound();
    if (request.moderationStatus === 'FLAGGED') throw ApiError.notFound();
    await this.visibility.assertVisible(viewerId, request.authorUserId);
    return request;
  }

  /** La demande dont le membre est l'auteur, ou 404 / NOT_AUTHOR. */
  private async ownedRequest(userId: string, id: string) {
    const request = await this.prisma.helpRequest.findUnique({
      where: { id },
      select: {
        id: true,
        authorUserId: true,
        status: true,
        kind: true,
        title: true,
        body: true,
        deletedAt: true,
        updatedAt: true,
        resolvedAt: true,
        resolvedByResponseId: true,
        responseCount: true,
        originJourneyStepId: true,
      },
    });
    if (request === null || request.deletedAt !== null) throw ApiError.notFound();
    if (request.authorUserId !== userId) this.fail('NOT_AUTHOR');
    return request;
  }

  /**
   * §2.1 : « Le logement et l'emploi ne sont pas des types d'entraide : ils
   * vivent dans Services (module 10). »
   */
  private assertHelpType(type: HelpTypeInput) {
    if (type === 'HOUSING' || type === 'JOB') {
      this.fail('USE_SERVICES', { type, section: 'services' });
    }
    return type;
  }

  /** Règles locales de modération (13 §2) sur le titre et le corps. */
  private assertPublishable(title: string | null, body: string): void {
    const text = title === null ? body : `${title}\n${body}`;
    // Les règles sont CELLES du module de modération (`matchLocalRule`, source
    // unique dans `@app/shared`) : ce fichier en gardait une copie, écrite quand
    // `ModerationService.check()` n'existait pas encore, et deux copies finissent
    // par se contredire.
    const rule = matchLocalRule(text);
    if (rule !== null) {
      this.logger.warn(`Publication bloquée par la règle locale ${rule} (13 §2)`);
      // Motif générique côté membre : le détail servirait à contourner.
      this.fail('CONTENT_BLOCKED');
    }
  }

  /** §4 : 5 demandes par jour. Compte les supprimées aussi — sinon la limite se remet à zéro d'un clic. */
  private async assertQuota(userId: string): Promise<void> {
    const since = new Date(Date.now() - 86_400_000);
    const count = await this.prisma.helpRequest.count({
      where: { authorUserId: userId, createdAt: { gte: since } },
    });
    if (count >= HELP_LIMITS.requestsPerDay) {
      throw ApiError.transverse('RATE_LIMITED', {
        limit: 'help.requestsPerDay',
        max: HELP_LIMITS.requestsPerDay,
        retryAfterSeconds: 3_600,
      });
    }
  }

  /** §2.3 et §4 : 30 réponses par heure. */
  private async assertResponseQuota(userId: string): Promise<void> {
    const since = new Date(Date.now() - 3_600_000);
    const count = await this.prisma.helpResponse.count({
      where: { authorUserId: userId, createdAt: { gte: since } },
    });
    if (count >= HELP_LIMITS.responsesPerHour) {
      throw ApiError.transverse('RATE_LIMITED', {
        limit: 'help.responsesPerHour',
        max: HELP_LIMITS.responsesPerHour,
        retryAfterSeconds: 600,
      });
    }
  }

  /**
   * L'étape d'origine (§2.5), si elle appartient bien à un parcours du membre.
   *
   * 404 et non 403 quand elle est à quelqu'un d'autre : sinon, essayer des
   * identifiants d'étape dirait lesquels existent.
   */
  private async resolveOriginStep(userId: string, stepId: string | undefined) {
    if (stepId === undefined) return null;
    const step = await this.prisma.journeyStep.findUnique({
      where: { id: stepId },
      select: { id: true, dueDate: true, journey: { select: { ownerUserId: true } } },
    });
    if (step === null || step.journey.ownerUserId !== userId) throw ApiError.notFound();
    return step;
  }

  /** Les `step_definition` que le membre a déjà franchies (§2.6). */
  private async completedStepDefinitions(userId: string): Promise<string[]> {
    const steps = await this.prisma.journeyStep.findMany({
      where: {
        status: 'DONE',
        stepDefinitionId: { not: null },
        journey: { ownerUserId: userId, deletedAt: null },
      },
      select: { stepDefinitionId: true },
      distinct: ['stepDefinitionId'],
    });
    return steps.flatMap((s) => (s.stepDefinitionId === null ? [] : [s.stepDefinitionId]));
  }

  /**
   * Les villes dans le rayon demandé, ou `null` quand aucune ville n'est donnée
   * (pas de filtre géographique du tout).
   *
   * Haversine en mémoire, et non en SQL : `cities` est un référentiel de quelques
   * centaines de lignes (02), lu une fois par requête, et le faire en SQL
   * imposerait une requête brute qui ne se compose pas avec la pagination Prisma.
   */
  private async cityScope(
    cityId: string | undefined,
    radiusKm: number,
  ): Promise<string[] | null> {
    if (cityId === undefined) return null;
    const center = await this.prisma.city.findUnique({
      where: { id: cityId },
      select: { id: true, latitude: true, longitude: true },
    });
    if (center === null) throw ApiError.notFound();
    if (radiusKm <= 0) return [center.id];

    const all = await this.prisma.city.findMany({
      select: { id: true, latitude: true, longitude: true },
    });
    const lat = Number(center.latitude);
    const lon = Number(center.longitude);

    return all
      .filter((c) => distanceKm(lat, lon, Number(c.latitude), Number(c.longitude)) <= radiusKm)
      .map((c) => c.id);
  }

  /** Les compteurs du sous-titre (§5) : « 41 ouvertes à Lyon · 178 résolues ce mois-ci ». */
  private async counters(cityIds: string[] | null): Promise<Record<string, number>> {
    const scope = cityIds === null ? {} : { cityId: { in: cityIds } };
    const startOfMonth = new Date();
    startOfMonth.setUTCDate(1);
    startOfMonth.setUTCHours(0, 0, 0, 0);

    const [open, resolvedThisMonth] = await Promise.all([
      this.prisma.helpRequest.count({
        where: { ...scope, status: 'OPEN', deletedAt: null, moderationStatus: { not: 'FLAGGED' } },
      }),
      this.prisma.helpRequest.count({
        where: {
          ...scope,
          status: 'RESOLVED',
          deletedAt: null,
          moderationStatus: { not: 'FLAGGED' },
          resolvedAt: { gte: startOfMonth },
        },
      }),
    ]);
    return { open, resolvedThisMonth };
  }

  /**
   * Retire ce qu'une résolution avait posé : marquage, crédit de réputation, et
   * le contact né de CETTE demande.
   *
   * `originRefId` est ce qui distingue « contact créé par cette résolution » d'un
   * contact déjà existant (parrainage, demande manuelle) : sans lui, rouvrir une
   * demande casserait un lien qu'elle n'avait pas créé.
   */
  private async unwind(
    tx: Prisma.TransactionClient,
    requestId: string,
    responseId: string,
  ): Promise<void> {
    const previous = await tx.helpResponse.findUnique({
      where: { id: responseId },
      select: { id: true, authorUserId: true },
    });
    if (previous === null) return;

    await tx.helpResponse.update({
      where: { id: responseId },
      data: { markedHelpful: false, markedAt: null },
    });

    const removed = await tx.reputationEvent.deleteMany({
      where: {
        userId: previous.authorUserId,
        type: 'HELP_VALIDATED',
        sourceType: 'help_request',
        sourceId: requestId,
      },
    });
    // 00 §9.4 : « Un vote retiré supprime l'événement et décrémente le
    // compteur. » Décrémenter sans avoir supprimé ferait dériver le compteur
    // sous zéro à chaque rejeu.
    if (removed.count > 0) {
      await tx.userStats.updateMany({
        where: { userId: previous.authorUserId, helpValidatedCount: { gt: 0 } },
        data: { helpValidatedCount: { decrement: removed.count } },
      });
    }

    await tx.connection.deleteMany({
      where: {
        origin: 'HELP_VALIDATED',
        originRefType: 'help_request',
        originRefId: requestId,
      },
    });
  }

  /**
   * Crée le contact, si les deux n'en ont pas déjà un.
   *
   * L'unicité de `connections` porte sur la paire ORDONNÉE (`user_a_id`,
   * `user_b_id`) : les deux identifiants sont donc triés avant écriture. Sans
   * cela, (A,B) et (B,A) passeraient tous les deux et le même contact existerait
   * en double — la contrainte ne servirait à rien.
   */
  private async connect(
    tx: Prisma.TransactionClient,
    one: string,
    other: string,
    requestId: string,
  ): Promise<void> {
    const [userAId, userBId] = one < other ? [one, other] : [other, one];
    const existing = await tx.connection.findUnique({
      where: { userAId_userBId: { userAId, userBId } },
      select: { id: true, removedAt: true },
    });

    if (existing !== null) {
      // Un contact retiré puis recréé par une nouvelle résolution reprend vie :
      // laisser `removed_at` posé donnerait un contact invisible et impossible à
      // recréer, la contrainte d'unicité interdisant la seconde ligne.
      if (existing.removedAt !== null) {
        await tx.connection.update({ where: { id: existing.id }, data: { removedAt: null } });
      }
      return;
    }

    await tx.connection.create({
      data: {
        id: newId(),
        userAId,
        userBId,
        origin: 'HELP_VALIDATED',
        originRefType: 'help_request',
        originRefId: requestId,
      },
    });
  }

  /** Ajoute la clause de curseur à un `where`, ou le rend tel quel. */
  private withCursor<T extends { id?: unknown }>(
    where: T,
    cursor: string | undefined,
    scope: string,
  ): T {
    if (cursor === undefined) return where;
    const payload = decodeCursor(cursor, this.cursorSecret, scope);
    // Tri `id desc` sur un UUID v7 : décroissant sur l'identifiant EST
    // décroissant sur la date de création, sans colonne de tri supplémentaire.
    return { ...where, id: { lt: payload.id } };
  }

  /** Un compte éteint n'apparaît pas (01 §4.4). */
  private isVisibleAuthor(author: { status: string; deletedAt: Date | null }): boolean {
    return (
      author.deletedAt === null && author.status !== 'DELETED' && author.status !== 'DEACTIVATED'
    );
  }

  /** T4 §6 : la forme unique d'un membre. Jamais de téléphone, d'email ni de date de naissance. */
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

  /** §2.2 : « l'auteur peut rouvrir une demande RESOLVED dans les 7 jours ». */
  private reopenWindowOpen(since: Date): boolean {
    return Date.now() <= since.getTime() + HELP_LIMITS.reopenWindowDays * 86_400_000;
  }

  /** La carte de liste (§5). */
  private card(
    row: {
      id: string;
      kind: string;
      type: string;
      title: string;
      body: string;
      status: string;
      dueDate: Date | null;
      responseCount: number;
      createdAt: Date;
      resolvedAt: Date | null;
      resolvedByResponseId: string | null;
      authorUserId: string;
      originJourneyStepId: string | null;
      reopenedAt: Date | null;
      originJourneyStep?: {
        title: string;
        position: number;
        stepDefinition: { nameFr: string } | null;
        journey: { templateVersion: { template: { nameFr: string } } };
      } | null;
      author: AuthorRow;
      city: { id: string; name: string };
    },
    viewerId: string,
  ) {
    return {
      id: row.id,
      kind: row.kind,
      type: row.type,
      title: row.title,
      // Corps TRONQUÉ sur la carte (§5). Le détail renvoie le texte entier.
      excerpt: row.body.length > 280 ? `${row.body.slice(0, 280)}…` : row.body,
      status: row.status,
      city: row.city,
      dueDate: row.dueDate,
      responseCount: row.responseCount,
      createdAt: row.createdAt,
      resolvedAt: row.resolvedAt,
      resolvedByResponseId: row.resolvedByResponseId,
      /** Pastille « Depuis un parcours » (§2.5) — sans rien dire du parcours. */
      fromJourney: row.originJourneyStepId !== null,
      // §2.5 : l'étape et le TYPE de parcours — jamais son titre personnel.
      journeyStep:
        row.originJourneyStep === null || row.originJourneyStep === undefined
          ? null
          : {
              stepName: row.originJourneyStep.stepDefinition?.nameFr ?? row.originJourneyStep.title,
              stepNumber: Math.max(1, row.originJourneyStep.position),
              journeyTypeName: row.originJourneyStep.journey.templateVersion.template.nameFr,
            },
      reopenedAt: row.reopenedAt,
      author: this.summary(row.author),
      isAuthor: row.authorUserId === viewerId,
    };
  }

  /**
   * La ligne de contexte de §2.5 : « Étape Logement du parcours Études ·
   * échéance dans N jours ».
   *
   * RÈGLE (§2.5 et 04 §2) : le TYPE de parcours, jamais son titre personnel.
   * Celui-ci n'est même pas lu en base — voir le `select` de `detail()`.
   */
  private journeyContext(
    step: {
      title: string;
      dueDate: Date | null;
      stepDefinition: { nameFr: string } | null;
      journey: { templateVersion: { template: { nameFr: string } } };
    } | null,
  ) {
    if (step === null) return null;
    const dueDate = step.dueDate;
    return {
      stepName: step.stepDefinition?.nameFr ?? step.title,
      journeyTypeName: step.journey.templateVersion.template.nameFr,
      dueDate,
      dueInDays:
        dueDate === null
          ? null
          : Math.ceil((dueDate.getTime() - Date.now()) / 86_400_000),
    };
  }
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
