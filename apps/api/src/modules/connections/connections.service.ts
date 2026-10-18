import { Injectable, Logger } from '@nestjs/common';
import { newId, type Prisma } from '@app/db';
import {
  CONNECTION_ERROR_CODES,
  CONNECTION_ERROR_MESSAGES,
  CONNECTION_REQUESTS_PER_DAY,
  CONNECTION_REQUESTS_PER_TARGET,
  CONNECTION_REQUESTS_PER_TARGET_WINDOW_MS,
  CONNECTION_REQUEST_EXPIRY_MS,
  type ConnectionErrorCode,
  type ConnectionSuggestionOrigin,
  type ConnectionsQuery,
  type CreateConnectionRequest,
  MUTUAL_CONNECTIONS_CACHE_MS,
  MUTUAL_CONNECTIONS_SAMPLE,
} from '@app/shared';
import { ApiError } from '../../common/api-error';
import { AuditService } from '../../common/audit.service';
import { buildPage, decodeCursor } from '../../common/cursor';
import { OutboxService } from '../../common/outbox.service';
import { PrismaService } from '../../common/prisma.service';
import { VisibilityService } from '../../common/visibility.service';
import { loadEnv } from '../../config/env';

/**
 * Contacts — 08-parrainage-messagerie.md §3.
 *
 * Le contact est la brique de confiance de la plateforme : c'est lui qui ouvre la
 * messagerie sans restriction (§3.2), la recommandation professionnelle (module
 * 10) et le réseau de 2ᵉ degré. Il naît donc d'une INTERACTION RÉELLE et de cinq
 * origines seulement — aide validée, parrainage terminé, présence commune à un
 * événement, co-écriture d'un guide, demande manuelle bornée.
 *
 * Deux conséquences dans la forme de ce service :
 *
 *   · les origines AUTOMATIQUES (`HELP_VALIDATED`, `MENTORSHIP`) passent par un
 *     événement de domaine, jamais par un appel direct (00 §3.3). Elles ne
 *     figurent donc pas dans les routes : `handleMentorshipEnded` est appelée par
 *     le registre d'abonnements, et l'aide validée est déjà créée par le module
 *     06 lui-même (voir la note sur `help_request.resolved` plus bas) ;
 *
 *   · les SUGGESTIONS (`EVENT`, `GUIDE`) n'ont AUCUNE table. §3.1 est explicite :
 *     « suggestion (pas de création) ». Elles sont calculées à la lecture et
 *     disparaissent d'elles-mêmes dès que le contact existe. Une table de
 *     suggestions aurait demandé un nettoyage, et une suggestion périmée —
 *     proposant un membre déjà contact, ou bloqué depuis — est pire que pas de
 *     suggestion.
 *
 * RÈGLE DURE (§3.2) : « Aucun compteur public de contacts. Le nombre n'est visible
 * que de soi-même. » Aucune méthode de ce service ne renvoie donc le nombre de
 * contacts d'un TIERS. `mutualConnections` renvoie un décompte, mais c'est celui
 * des contacts DU LECTEUR qui connaissent la personne regardée : une donnée du
 * lecteur, que §3.2 autorise nommément (« Connecté·e à N de vos contacts »).
 */

/** La paire est ORDONNÉE en base : `user_a_id < user_b_id` (contrainte CHECK). */
function orderedPair(one: string, other: string): [string, string] {
  return one < other ? [one, other] : [other, one];
}

/** T4 §6 : la forme unique d'un membre. Jamais de téléphone, jamais d'email. */
const MEMBER_SELECT = {
  id: true,
  handle: true,
  displayName: true,
  deletedAt: true,
  status: true,
  cityId: true,
  avatarAsset: { select: { storageKey: true } },
} satisfies Prisma.UserSelect;

export interface ConnectionSuggestion {
  readonly origin: ConnectionSuggestionOrigin;
  readonly user: { readonly id: string; readonly handle: string; readonly displayName: string };
  /** Ce qui fonde la suggestion : « vous étiez tous les deux à … ». */
  readonly reason: string;
  readonly refId: string;
}

@Injectable()
export class ConnectionsService {
  private readonly logger = new Logger(ConnectionsService.name);
  private readonly cursorSecret = loadEnv().CURSOR_SECRET;

  /** §3.2 : réseau de 2ᵉ degré « calculé à la requête, mis en cache 1 h ». */
  private readonly mutualCache = new Map<
    string,
    { at: number; value: { count: number; handles: string[] } }
  >();

  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
    private readonly visibility: VisibilityService,
  ) {}

  private fail(code: ConnectionErrorCode, details?: Record<string, unknown>): never {
    throw new ApiError(code, CONNECTION_ERROR_MESSAGES[code], CONNECTION_ERROR_CODES[code], details);
  }

  // ── Lectures ──────────────────────────────────────────────────────────────

  /**
   * `GET /me/connections` (§7.2).
   *
   * Le nombre total accompagne la liste, dans `meta`. C'est la SEULE route qui le
   * renvoie, et elle ne peut porter que sur soi : l'identifiant vient du jeton,
   * jamais d'un paramètre (règle dure §3.2).
   */
  async list(userId: string, query: ConnectionsQuery) {
    const scope = `connections:${userId}`;
    const where: Prisma.ConnectionWhereInput = {
      removedAt: null,
      OR: [{ userAId: userId }, { userBId: userId }],
    };

    const rows = await this.prisma.connection.findMany({
      where:
        query.cursor === undefined
          ? where
          : { AND: [where, { id: { lt: decodeCursor(query.cursor, this.cursorSecret, scope).id } }] },
      // Tri `id desc` sur un UUID v7 : décroissant sur l'identifiant EST
      // décroissant sur la date de création, sans colonne de tri supplémentaire.
      orderBy: { id: 'desc' },
      take: query.limit + 1,
      include: {
        userA: { select: MEMBER_SELECT },
        userB: { select: MEMBER_SELECT },
      },
    });

    const page = buildPage(rows, query.limit, scope, this.cursorSecret);
    const separated = new Set(await this.visibility.separatedFrom(userId));

    const items = page.items
      .map((row) => {
        const other = row.userAId === userId ? row.userB : row.userA;
        return { row, other };
      })
      // Un blocage retire le contact (§4) mais la ligne peut survivre un instant
      // à la cascade — et un compte éteint n'apparaît pas (01 §4.4).
      .filter(({ other }) => !separated.has(other.id) && this.isVisible(other))
      .map(({ row, other }) => ({
        userId: other.id,
        handle: other.handle,
        displayName: other.displayName,
        avatarUrl: other.avatarAsset?.storageKey ?? null,
        origin: row.origin,
        connectedAt: row.createdAt,
      }));

    return {
      items,
      nextCursor: page.nextCursor,
      meta: { count: await this.countFor(userId) },
    };
  }

  /** Mon nombre de contacts. Jamais celui d'un autre (règle dure §3.2). */
  async countFor(userId: string): Promise<number> {
    return this.prisma.connection.count({
      where: { removedAt: null, OR: [{ userAId: userId }, { userBId: userId }] },
    });
  }

  /** Les identifiants de mes contacts. Sert au 2ᵉ degré et à la messagerie. */
  async connectionIdsOf(userId: string): Promise<string[]> {
    const rows = await this.prisma.connection.findMany({
      where: { removedAt: null, OR: [{ userAId: userId }, { userBId: userId }] },
      select: { userAId: true, userBId: true },
    });
    return rows.map((r) => (r.userAId === userId ? r.userBId : r.userAId));
  }

  /** Ces deux membres sont-ils contacts ? §3.2 : c'est ce qui ouvre la messagerie. */
  async areConnected(one: string, other: string): Promise<boolean> {
    const [userAId, userBId] = orderedPair(one, other);
    const found = await this.prisma.connection.findUnique({
      where: { userAId_userBId: { userAId, userBId } },
      select: { removedAt: true },
    });
    return found !== null && found.removedAt === null;
  }

  /**
   * `GET /users/:handle/mutual-connections` (§7.2) — le réseau de 2ᵉ degré (§3.2).
   *
   * Le décompte porte sur MES contacts, pas sur les siens : c'est ce que §3.2
   * demande d'afficher (« Connecté·e à N de vos contacts ») et c'est la seule
   * formulation qui respecte la règle dure — je n'apprends rien sur l'étendue de
   * son réseau, seulement sur le recouvrement avec le mien.
   */
  async mutualConnections(viewerId: string, handle: string) {
    const target = await this.prisma.user.findUnique({
      where: { handle },
      select: { id: true, deletedAt: true, status: true },
    });
    if (target === null || !this.isVisible(target)) throw ApiError.notFound();
    await this.visibility.assertVisible(viewerId, target.id);
    if (target.id === viewerId) return { count: 0, handles: [], sharedCommunities: 0 };

    const key = `${viewerId}:${target.id}`;
    const cached = this.mutualCache.get(key);
    if (cached !== undefined && Date.now() - cached.at < MUTUAL_CONNECTIONS_CACHE_MS) {
      return cached.value;
    }

    const mine = await this.connectionIdsOf(viewerId);
    const theirs = await this.connectionIdsOf(target.id);
    const theirSet = new Set(theirs);
    const shared = mine.filter((id) => theirSet.has(id) && id !== viewerId && id !== target.id);

    // Les handles : §3.2 les affiche. Un échantillon seulement — la liste
    // complète du recouvrement n'est pas demandée et coûterait une requête large.
    const sample =
      shared.length === 0
        ? []
        : await this.prisma.user.findMany({
            where: { id: { in: shared.slice(0, MUTUAL_CONNECTIONS_SAMPLE) }, deletedAt: null },
            select: { handle: true },
          });

    /**
     * LES RÉSEAUX EN COMMUN — « Connectée à 3 de vos contacts · 2 réseaux en
     * commun », que le profil écrivait en dur. Même principe que les contacts :
     * on compte le RECOUVREMENT avec mes propres réseaux (adhésions ACTIVES des
     * deux côtés, réseau ACTIF), jamais l'étendue de ses adhésions à lui.
     */
    const mesReseaux = await this.prisma.communityMember.findMany({
      where: { userId: viewerId, status: 'ACTIVE', community: { status: 'ACTIVE' } },
      select: { communityId: true },
    });
    const sharedCommunities =
      mesReseaux.length === 0
        ? 0
        : await this.prisma.communityMember.count({
            where: {
              userId: target.id,
              status: 'ACTIVE',
              communityId: { in: mesReseaux.map((r) => r.communityId) },
            },
          });

    const value = { count: shared.length, handles: sample.map((u) => u.handle), sharedCommunities };
    this.mutualCache.set(key, { at: Date.now(), value });
    return value;
  }

  /**
   * `GET /me/connection-suggestions` (§7.2) — origines `EVENT` et `GUIDE` (§3.1).
   *
   * Calculées, jamais stockées. Une suggestion déjà satisfaite (contact existant)
   * ou devenue impossible (blocage) disparaît d'elle-même, ce qu'une table
   * n'aurait pas fait sans tâche de nettoyage.
   */
  async suggestions(userId: string): Promise<{ items: ConnectionSuggestion[] }> {
    const separated = await this.visibility.separatedFrom(userId);
    const already = new Set([...(await this.connectionIdsOf(userId)), userId, ...separated]);

    const items = [
      ...(await this.eventSuggestions(userId, already)),
      ...(await this.guideSuggestions(userId, separated, already)),
    ];
    return { items };
  }

  /**
   * ╔════════════════════════════════════════════════════════════════════════════╗
   * ║ ÉMETTRE `connection.suggested` — LE CATALOGUE LE PROMETTAIT (08 §7)        ║
   * ╚════════════════════════════════════════════════════════════════════════════╝
   *
   * §7 liste `connection.suggested` parmi les événements du module, et §3.1 dit
   * qu'« une suggestion est une notification "Ajouter X à vos contacts ?" ». Les
   * suggestions étaient CALCULÉES à la lecture (`suggestions()`), mais l'événement
   * n'était émis par personne : le membre ne l'apprenait que s'il ouvrait la page
   * Contacts. Ce chemin le pousse.
   *
   * Appelée par les gestionnaires de `event.checked_in` et de
   * `guide.proposal_accepted`. Elle RELIT `suggestions()` plutôt que de recopier ses
   * règles (blocage, contact existant, compte masqué) : une seule définition d'une
   * suggestion valable. Un événement par SENS — A apprend B et B apprend A — car
   * l'autre moitié n'est pas forcément dans la charge (le déjà-pointé d'un
   * événement ne l'est pas). Idempotente : le dédoublonnage de la notification
   * (même membre, même type, même objet) absorbe un rejeu.
   */
  async emitSuggestions(
    userIds: readonly string[],
    origin: ConnectionSuggestionOrigin,
    refId: string,
  ): Promise<number> {
    let emitted = 0;
    for (const userId of userIds) {
      const { items } = await this.suggestions(userId);
      for (const item of items.filter((i) => i.origin === origin && i.refId === refId)) {
        await this.prisma.$transaction(async (tx) => {
          for (const [to, about] of [
            [userId, item.user.id],
            [item.user.id, userId],
          ] as const) {
            await this.outbox.emit(tx, {
              type: 'connection.suggested',
              aggregateId: to,
              payload: { userId: to, suggestedUserId: about, origin, refId },
            });
            emitted += 1;
          }
        });
      }
    }
    return emitted;
  }

  /** §3.1 : « Les deux ont `checked_in = true` au même événement → suggestion ». */
  private async eventSuggestions(
    userId: string,
    already: Set<string>,
  ): Promise<ConnectionSuggestion[]> {
    const mine = await this.prisma.eventAttendee.findMany({
      where: { userId, checkedIn: true },
      select: { eventId: true, event: { select: { title: true } } },
      take: 50,
      orderBy: { id: 'desc' },
    });
    if (mine.length === 0) return [];

    const others = await this.prisma.eventAttendee.findMany({
      where: {
        eventId: { in: mine.map((a) => a.eventId) },
        checkedIn: true,
        userId: { notIn: [...already] },
      },
      select: { eventId: true, user: { select: MEMBER_SELECT } },
      take: 100,
    });

    const titleOf = new Map(mine.map((a) => [a.eventId, a.event.title]));
    return others
      .filter((a) => this.isVisible(a.user))
      .map((a) => ({
        origin: 'EVENT' as const,
        user: { id: a.user.id, handle: a.user.handle, displayName: a.user.displayName },
        reason: `Vous étiez tous les deux à « ${titleOf.get(a.eventId) ?? 'un événement'} »`,
        refId: a.eventId,
      }));
  }

  /**
   * §3.1 : « Proposition acceptée → suggestion entre auteur et contributeur ».
   *
   * ATTENTION, le piège du `notIn` sur une colonne NULLABLE : `guides.author_user_id`
   * est nullable (guide anonymisé après suppression de compte), et
   * `authorUserId: { notIn: [...] }` élimine AUSSI les lignes à NULL. Ici on veut
   * au contraire écarter explicitement les guides sans auteur — il n'y a personne
   * à suggérer — d'où le `not: null` EXPLICITE plutôt qu'un `notIn` qui le ferait
   * par accident : le jour où la règle change, l'intention reste lisible.
   */
  private async guideSuggestions(
    userId: string,
    separated: string[],
    already: Set<string>,
  ): Promise<ConnectionSuggestion[]> {
    // Moi contributeur → l'auteur du guide.
    const asContributor = await this.prisma.guideContributor.findMany({
      where: {
        userId,
        guide: {
          authorUserId: { not: null, notIn: [...separated, userId] },
        },
      },
      select: {
        guideId: true,
        guide: { select: { title: true, author: { select: MEMBER_SELECT } } },
      },
      take: 50,
    });

    // Moi auteur → mes contributeurs.
    const asAuthor = await this.prisma.guideContributor.findMany({
      where: {
        guide: { authorUserId: userId },
        userId: { notIn: [...already] },
      },
      select: { guideId: true, guide: { select: { title: true } }, user: { select: MEMBER_SELECT } },
      take: 50,
    });

    const out: ConnectionSuggestion[] = [];
    for (const row of asContributor) {
      const author = row.guide.author;
      if (author === null || already.has(author.id) || !this.isVisible(author)) continue;
      out.push({
        origin: 'GUIDE',
        user: { id: author.id, handle: author.handle, displayName: author.displayName },
        reason: `Vous avez contribué à « ${row.guide.title} »`,
        refId: row.guideId,
      });
    }
    for (const row of asAuthor) {
      if (!this.isVisible(row.user)) continue;
      out.push({
        origin: 'GUIDE',
        user: { id: row.user.id, handle: row.user.handle, displayName: row.user.displayName },
        reason: `Ce membre a contribué à votre guide « ${row.guide.title} »`,
        refId: row.guideId,
      });
    }
    return out;
  }

  /** `GET /me/connection-requests` : reçues ou envoyées (écran Contacts, §8). */
  async listRequests(userId: string, direction: 'incoming' | 'outgoing') {
    const rows = await this.prisma.connectionRequest.findMany({
      where: {
        ...(direction === 'incoming' ? { toUserId: userId } : { fromUserId: userId }),
        status: 'PENDING',
        // La colonne `expires_at` de §6 n'existe pas : l'expiration est DÉDUITE de
        // `created_at`. Une demande périmée que la tâche n'a pas encore balayée
        // ne doit pas apparaître comme en attente.
        createdAt: { gte: new Date(Date.now() - CONNECTION_REQUEST_EXPIRY_MS) },
      },
      orderBy: { id: 'desc' },
      take: 50,
      include: {
        fromUser: { select: MEMBER_SELECT },
        toUser: { select: MEMBER_SELECT },
      },
    });

    const separated = new Set(await this.visibility.separatedFrom(userId));
    return {
      items: rows
        .map((row) => ({ row, other: direction === 'incoming' ? row.fromUser : row.toUser }))
        .filter(({ other }) => !separated.has(other.id) && this.isVisible(other))
        .map(({ row, other }) => ({
          id: row.id,
          message: row.message,
          createdAt: row.createdAt,
          expiresAt: new Date(row.createdAt.getTime() + CONNECTION_REQUEST_EXPIRY_MS),
          user: { id: other.id, handle: other.handle, displayName: other.displayName },
        })),
    };
  }

  // ── Écritures ─────────────────────────────────────────────────────────────

  /**
   * `POST /connection-requests` (§7.2) — l'origine `MANUAL` de §3.1.
   *
   * Trois contrôles, dans cet ordre : blocage, contact déjà là, quotas.
   *
   * ── LA CONDITION DE VILLE EST LEVÉE, PAR DÉCISION DU PORTEUR ─────────────
   *
   * 08 §3.1 (et le test « RÈGLE DURE §12 ») réservait la demande `MANUAL` à un
   * membre de la même ville — ou de la même ville cible —, et refusait le reste
   * par `SAME_CITY_REQUIRED`. Le porteur, après l'avoir rencontré à l'usage :
   * « corrige et permet à tout le monde d'être ajouté ». Le contrôle est donc
   * retiré, et le code d'erreur avec lui. `docs/` étant en lecture seule, la
   * spécification n'est PAS mise à jour ici : l'écart est à y reporter.
   *
   * Ce qui protège encore de la prospection : le message obligatoire (20 à 500
   * caractères, schéma partagé), le blocage dans les deux sens (404), et les
   * quotas de demandes juste en dessous — ceux-là ne bougent pas.
   */
  async request(fromUserId: string, input: CreateConnectionRequest) {
    const target = await this.prisma.user.findUnique({
      where: { handle: input.toHandle },
      select: { id: true, deletedAt: true, status: true },
    });
    if (target === null || !this.isVisible(target)) throw ApiError.notFound();
    if (target.id === fromUserId) {
      throw ApiError.validation([{ path: 'toHandle', code: 'SELF_CONNECTION' }]);
    }
    // 404 et jamais 403 (T4 §3) : révéler le blocage en dirait déjà trop.
    await this.visibility.assertVisible(fromUserId, target.id);

    if (await this.areConnected(fromUserId, target.id)) this.fail('ALREADY_CONNECTED');

    const now = new Date();
    const pendingFrom = new Date(now.getTime() - CONNECTION_REQUEST_EXPIRY_MS);
    const existing = await this.prisma.connectionRequest.findFirst({
      where: {
        status: 'PENDING',
        createdAt: { gte: pendingFrom },
        OR: [
          { fromUserId, toUserId: target.id },
          { fromUserId: target.id, toUserId: fromUserId },
        ],
      },
      select: { id: true },
    });
    if (existing !== null) this.fail('REQUEST_PENDING');

    await this.assertRequestQuota(fromUserId, target.id, now);

    const id = newId();
    await this.prisma.$transaction(async (tx) => {
      await tx.connectionRequest.create({
        data: { id, fromUserId, toUserId: target.id, message: input.message, status: 'PENDING' },
      });
      await this.audit.record(tx, {
        actor: { type: 'MEMBER', id: fromUserId },
        action: 'connection.requested',
        targetType: 'connection_request',
        targetId: id,
      });
      await this.outbox.emit(tx, {
        type: 'connection.requested',
        aggregateId: id,
        payload: { requestId: id, fromUserId, toUserId: target.id },
      });
    });

    return { id, status: 'PENDING' as const, expiresAt: new Date(now.getTime() + CONNECTION_REQUEST_EXPIRY_MS) };
  }

  /** §3.1 : « Pas plus de 10 demandes manuelles par jour, 3 vers le même membre sur 30 jours. » */
  private async assertRequestQuota(fromUserId: string, toUserId: string, now: Date): Promise<void> {
    const dayAgo = new Date(now.getTime() - 86_400_000);
    const perDay = await this.prisma.connectionRequest.count({
      where: { fromUserId, createdAt: { gte: dayAgo } },
    });
    if (perDay >= CONNECTION_REQUESTS_PER_DAY) {
      this.fail('REQUEST_LIMIT', { limit: 'perDay', max: CONNECTION_REQUESTS_PER_DAY });
    }

    const windowStart = new Date(now.getTime() - CONNECTION_REQUESTS_PER_TARGET_WINDOW_MS);
    const perTarget = await this.prisma.connectionRequest.count({
      where: { fromUserId, toUserId, createdAt: { gte: windowStart } },
    });
    if (perTarget >= CONNECTION_REQUESTS_PER_TARGET) {
      this.fail('REQUEST_LIMIT', { limit: 'perTarget', max: CONNECTION_REQUESTS_PER_TARGET });
    }
  }

  /** `POST /connection-requests/:id/accept` (§7.2) — la réciprocité de §3.1. */
  async acceptRequest(requestId: string, userId: string) {
    const request = await this.pendingRequestFor(requestId, userId);
    await this.visibility.assertVisible(userId, request.fromUserId);

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.connectionRequest.update({
        where: { id: requestId },
        data: { status: 'ACCEPTED', decidedAt: now },
      });
      await this.connect(tx, request.fromUserId, userId, {
        origin: 'MANUAL',
        refType: 'connection_request',
        refId: requestId,
      });
      await this.audit.record(tx, {
        actor: { type: 'MEMBER', id: userId },
        action: 'connection.accepted',
        targetType: 'connection_request',
        targetId: requestId,
      });
      await this.outbox.emit(tx, {
        type: 'connection.created',
        aggregateId: requestId,
        payload: { origin: 'MANUAL', userIds: orderedPair(request.fromUserId, userId) },
      });
    });

    return { status: 'ACCEPTED' as const };
  }

  /** `POST /connection-requests/:id/decline` (§7.2). Sans motif, jamais notifié. */
  async declineRequest(requestId: string, userId: string) {
    const request = await this.pendingRequestFor(requestId, userId);
    await this.prisma.connectionRequest.update({
      where: { id: request.id },
      data: { status: 'DECLINED', decidedAt: new Date() },
    });
    return { status: 'DECLINED' as const };
  }

  /**
   * Accepter une suggestion `EVENT` ou `GUIDE` (§3.1 : « Sur acceptation »).
   *
   * Pas de `connection_requests` : la suggestion n'en a jamais créé. On vérifie
   * que le fondement existe TOUJOURS — deux présences cochées, une contribution —
   * puis on crée le contact. Sans cette vérification, la route deviendrait un
   * « ajouter n'importe qui » SANS demande : le contact naîtrait d'un coup, sans
   * le message ni l'acceptation que `request()` impose.
   */
  async acceptSuggestion(userId: string, origin: ConnectionSuggestionOrigin, handle: string) {
    const target = await this.prisma.user.findUnique({
      where: { handle },
      select: { id: true, deletedAt: true, status: true },
    });
    if (target === null || !this.isVisible(target)) throw ApiError.notFound();
    await this.visibility.assertVisible(userId, target.id);
    if (target.id === userId) throw ApiError.notFound();

    const suggestions = await this.suggestions(userId);
    const match = suggestions.items.find((s) => s.origin === origin && s.user.id === target.id);
    if (match === undefined) throw ApiError.notFound();

    if (await this.areConnected(userId, target.id)) this.fail('ALREADY_CONNECTED');

    await this.prisma.$transaction(async (tx) => {
      await this.connect(tx, userId, target.id, {
        origin,
        refType: origin === 'EVENT' ? 'event' : 'guide',
        refId: match.refId,
      });
      await this.audit.record(tx, {
        actor: { type: 'MEMBER', id: userId },
        action: 'connection.created',
        targetType: 'user',
        targetId: target.id,
        metadata: { origin },
      });
      await this.outbox.emit(tx, {
        type: 'connection.created',
        aggregateId: target.id,
        payload: { origin, userIds: orderedPair(userId, target.id) },
      });
    });

    return { status: 'CONNECTED' as const };
  }

  /**
   * `DELETE /me/connections/:userId` (§7.2).
   *
   * « Par l'un des deux, sans notification » (§3.2). Retrait LOGIQUE
   * (`removed_at`) : la contrainte d'unicité sur la paire interdit une seconde
   * ligne, donc une suppression physique rendrait le contact impossible à
   * recréer par une aide validée ultérieure.
   */
  async remove(userId: string, otherUserId: string): Promise<void> {
    const [userAId, userBId] = orderedPair(userId, otherUserId);
    const connection = await this.prisma.connection.findUnique({
      where: { userAId_userBId: { userAId, userBId } },
      select: { id: true, removedAt: true },
    });
    // Idempotent : retirer un contact déjà retiré est le même état, et refuser
    // ferait échouer un double clic.
    if (connection === null || connection.removedAt !== null) return;

    await this.prisma.$transaction(async (tx) => {
      await tx.connection.update({ where: { id: connection.id }, data: { removedAt: new Date() } });
      await this.audit.record(tx, {
        actor: { type: 'MEMBER', id: userId },
        action: 'connection.removed',
        targetType: 'user',
        targetId: otherUserId,
      });
      await this.outbox.emit(tx, {
        type: 'connection.removed',
        aggregateId: connection.id,
        payload: { userIds: [userAId, userBId], removedByUserId: userId },
      });
    });
    this.mutualCache.clear();
  }

  // ── Consommateurs d'événements ────────────────────────────────────────────

  /**
   * §3.1, origine `MENTORSHIP` : « Événement `mentorship.ended` motif COMPLETED ».
   *
   * IDEMPOTENT : `connect()` ne crée rien si la paire existe déjà, et un rejeu de
   * l'événement — la livraison est « au moins une fois » — retombe donc sur le
   * même état. LÈVE en cas d'échec, pour que BullMQ rejoue (00 §9.2).
   *
   * Une fin pour un autre motif ne crée RIEN : §3.1 nomme `COMPLETED`, et un
   * parrainage terminé par blocage ou par décision de modération ne doit
   * évidemment pas produire un contact.
   */
  async handleMentorshipEnded(payload: {
    mentorshipId?: unknown;
    mentorUserId?: unknown;
    menteeUserId?: unknown;
    reason?: unknown;
  }): Promise<void> {
    const { mentorshipId, mentorUserId, menteeUserId, reason } = payload;
    if (
      typeof mentorshipId !== 'string' ||
      typeof mentorUserId !== 'string' ||
      typeof menteeUserId !== 'string'
    ) {
      // Un payload incomplet est un défaut de l'émetteur : lever le fait rejouer
      // et laisse une trace, alors que sortir en silence le perdrait.
      throw new Error('mentorship.ended : payload incomplet');
    }
    if (reason !== 'COMPLETED') return;

    // Un blocage survenu entre-temps l'emporte : §4 retire les contacts, il
    // serait absurde d'en créer un juste après.
    if (await this.visibility.isSeparated(mentorUserId, menteeUserId)) return;

    // Les deux membres doivent EXISTER encore. Trouvé en exerçant la cascade : un
    // `mentorship.ended` en retard, dont l'un des membres a depuis été supprimé,
    // faisait échouer la création sur la clé étrangère — donc dix tentatives
    // BullMQ, puis un échec définitif, pour un contact qui ne devait de toute
    // façon pas exister (§11 : « Contacts : supprimés »). Un compte éteint ne
    // gagne pas de contact non plus (01 §4.4).
    const present = await this.prisma.user.count({
      where: {
        id: { in: [mentorUserId, menteeUserId] },
        deletedAt: null,
        status: { notIn: ['DELETED', 'DEACTIVATED'] },
      },
    });
    if (present !== 2) return;

    await this.prisma.$transaction(async (tx) => {
      const created = await this.connect(tx, mentorUserId, menteeUserId, {
        origin: 'MENTORSHIP',
        refType: 'mentorship',
        refId: mentorshipId,
      });
      if (!created) return;
      await this.outbox.emit(tx, {
        type: 'connection.created',
        aggregateId: mentorshipId,
        payload: { origin: 'MENTORSHIP', userIds: orderedPair(mentorUserId, menteeUserId) },
      });
    });
  }

  /**
   * §4, la part « contacts » de la cascade de blocage.
   *
   * « `connections` retirée ; `connection_requests` en attente expirées. » Les
   * deux dans UNE transaction : un contact retiré sans sa demande expirée
   * laisserait la demande acceptable, et le contact reviendrait aussitôt.
   *
   * IDEMPOTENT : les deux écritures sont des `updateMany` conditionnés à l'état
   * courant, donc un rejeu ne change rien et n'émet pas d'événement en double.
   */
  async handleUserBlocked(blockerUserId: string, blockedUserId: string): Promise<void> {
    const [userAId, userBId] = orderedPair(blockerUserId, blockedUserId);
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      const removed = await tx.connection.updateMany({
        where: { userAId, userBId, removedAt: null },
        data: { removedAt: now },
      });

      const expired = await tx.connectionRequest.updateMany({
        where: {
          status: 'PENDING',
          OR: [
            { fromUserId: blockerUserId, toUserId: blockedUserId },
            { fromUserId: blockedUserId, toUserId: blockerUserId },
          ],
        },
        data: { status: 'EXPIRED', decidedAt: now },
      });

      if (removed.count === 0 && expired.count === 0) return;

      await this.audit.record(tx, {
        actor: { type: 'SYSTEM' },
        action: 'connection.blocked_cascade',
        targetType: 'user',
        targetId: blockedUserId,
        metadata: { connectionsRemoved: removed.count, requestsExpired: expired.count },
      });

      if (removed.count > 0) {
        await this.outbox.emit(tx, {
          type: 'connection.removed',
          aggregateId: userAId,
          payload: { userIds: [userAId, userBId], reason: 'BLOCKED' },
        });
      }
    });

    this.mutualCache.clear();
  }

  /**
   * §11 : « Contacts : supprimés. Demandes : expirées. »
   *
   * Les blocages ne sont PAS touchés : §11 les conserve (« l'autre partie garde sa
   * protection »), et c'est le module 01 qui anonymise l'identifiant.
   */
  async handleUserDeleted(userId: string): Promise<void> {
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.connection.updateMany({
        where: { removedAt: null, OR: [{ userAId: userId }, { userBId: userId }] },
        data: { removedAt: now },
      });
      await tx.connectionRequest.updateMany({
        where: { status: 'PENDING', OR: [{ fromUserId: userId }, { toUserId: userId }] },
        data: { status: 'EXPIRED', decidedAt: now },
      });
    });
    this.mutualCache.clear();
  }

  // ── Tâche planifiée (§10) ─────────────────────────────────────────────────

  /**
   * `connection.expire_requests`, quotidienne (§10) : 30 jours.
   *
   * La colonne `connection_requests.expires_at` que §6 déclare « Ajoutée »
   * N'EXISTE PAS dans le schéma figé. L'échéance est donc déduite de `created_at`,
   * ici comme à la lecture — les deux emploient la même constante, pour qu'une
   * demande périmée ne soit jamais acceptable, même avant le passage de la tâche.
   */
  async expireRequests(now = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - CONNECTION_REQUEST_EXPIRY_MS);
    const { count } = await this.prisma.connectionRequest.updateMany({
      where: { status: 'PENDING', createdAt: { lt: cutoff } },
      data: { status: 'EXPIRED', decidedAt: now },
    });
    if (count > 0) this.logger.log(`${count} demande(s) de contact expirée(s) (§10)`);
    return count;
  }

  // ── Interne ───────────────────────────────────────────────────────────────

  /**
   * Crée le contact, ou le fait revivre. Rend `true` si l'état a changé.
   *
   * La PAIRE EST ORDONNÉE (`user_a_id < user_b_id`, contrainte CHECK posée en
   * SQL) : sans cela, (A,B) et (B,A) passeraient tous les deux et le même contact
   * existerait en double — la contrainte d'unicité ne servirait à rien.
   */
  private async connect(
    tx: Prisma.TransactionClient,
    one: string,
    other: string,
    origin: { origin: Prisma.ConnectionCreateInput['origin']; refType: string; refId: string },
  ): Promise<boolean> {
    const [userAId, userBId] = orderedPair(one, other);
    const existing = await tx.connection.findUnique({
      where: { userAId_userBId: { userAId, userBId } },
      select: { id: true, removedAt: true },
    });

    if (existing !== null) {
      // Un contact retiré puis refondé reprend vie : laisser `removed_at` posé
      // donnerait un contact invisible et impossible à recréer, la contrainte
      // d'unicité interdisant la seconde ligne.
      if (existing.removedAt === null) return false;
      await tx.connection.update({ where: { id: existing.id }, data: { removedAt: null } });
      return true;
    }

    await tx.connection.create({
      data: {
        id: newId(),
        userAId,
        userBId,
        origin: origin.origin,
        originRefType: origin.refType,
        originRefId: origin.refId,
      },
    });
    return true;
  }

  /** Une demande en attente, adressée à ce membre. 404 sinon (T4 §3). */
  private async pendingRequestFor(requestId: string, userId: string) {
    const request = await this.prisma.connectionRequest.findUnique({
      where: { id: requestId },
      select: { id: true, fromUserId: true, toUserId: true, status: true, createdAt: true },
    });
    if (request === null || request.toUserId !== userId || request.status !== 'PENDING') {
      throw ApiError.notFound();
    }
    // Périmée : elle n'existe plus, même si la tâche ne l'a pas encore balayée.
    if (request.createdAt.getTime() + CONNECTION_REQUEST_EXPIRY_MS < Date.now()) {
      throw ApiError.notFound();
    }
    return request;
  }

  /** Un compte éteint n'apparaît pas (01 §4.4). */
  private isVisible(user: { deletedAt: Date | null; status: string }): boolean {
    return (
      user.deletedAt === null && user.status !== 'DELETED' && user.status !== 'DEACTIVATED'
    );
  }
}
