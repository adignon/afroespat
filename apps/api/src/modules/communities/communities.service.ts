import { Injectable, Logger } from '@nestjs/common';
import { newId, type Prisma } from '@app/db';
import {
  COMMUNITY_ANNOUNCEMENTS_PER_WEEK,
  COMMUNITY_ARCHIVE_AFTER_DAYS,
  COMMUNITY_ARCHIVE_WARNING_AFTER_DAYS,
  COMMUNITY_CITY_THRESHOLD_DEFAULT,
  COMMUNITY_CITY_THRESHOLD_SETTING_KEY,
  COMMUNITY_ERROR_CODES,
  COMMUNITY_ERROR_MESSAGES,
  COMMUNITY_MAX_PINNED_TOPICS,
  COMMUNITY_MIN_INVITES,
  type CommunityCreationGate,
  type CommunityErrorCode,
  type CommunityListQuery,
  type CreateCommunity,
  type CreatePoll,
  type CreateTopic,
  type InviteMembers,
  type MemberListQuery,
  type Page,
  TOPIC_ARCHIVE_AFTER_DAYS,
  TOPIC_EDIT_WINDOW_MINUTES,
  type TopicListQuery,
  type UpdateCommunity,
  type UpdateMember,
  type UpdateTopic,
} from '@app/shared';
import { ApiError } from '../../common/api-error';
import { AuditService } from '../../common/audit.service';
import { buildPage, decodeCursor } from '../../common/cursor';
import { OutboxService } from '../../common/outbox.service';
import { PrismaService } from '../../common/prisma.service';
import { VisibilityService } from '../../common/visibility.service';
import { loadEnv } from '../../config/env';

/**
 * Réseaux (communautés) — 07-reseaux.md.
 *
 * Trois choses expliquent la forme de ce service, et aucune n'est un détail :
 *
 *   · les réseaux de VILLE et de PAYS n'ont pas de créateur et ne se quittent
 *     pas (§2.1). L'adhésion y est une CONSÉQUENCE du profil, pas un acte : elle
 *     est donc recalculée (`syncAutoMemberships`) plutôt que demandée, et le
 *     recalcul est idempotent pour pouvoir être rejoué autant de fois qu'il faut ;
 *
 *   · un réseau d'intérêt VIDE décourage plus qu'il n'attire (décision T4). D'où
 *     les deux garde-fous de §2.2 — cinq invités et un seuil de ville — vérifiés
 *     ici, avant l'écriture, et non par le formulaire ;
 *
 *   · un réseau `INVITE_ONLY` ne doit rien laisser filtrer (§9, règle dure). Une
 *     seule porte d'entrée en lecture, `load()`, applique la règle pour TOUTES
 *     les routes de contenu : ajouter une route ne peut donc pas l'oublier.
 */

const DAY_MS = 86_400_000;

/** Les deux sortes de réseaux qu'on ne crée ni ne quitte (§2.1). */
const AUTO_KINDS = ['CITY', 'COUNTRY'] as const;

type CommunityRow = Prisma.CommunityGetPayload<{
  select: {
    id: true;
    kind: true;
    cityId: true;
    countryId: true;
    name: true;
    slug: true;
    description: true;
    category: true;
    visibility: true;
    createdByUserId: true;
    coverAssetId: true;
    memberCount: true;
    status: true;
    lastActivityAt: true;
    archivedAt: true;
    createdAt: true;
  };
}>;

const COMMUNITY_SELECT = {
  id: true,
  kind: true,
  cityId: true,
  countryId: true,
  name: true,
  slug: true,
  description: true,
  category: true,
  visibility: true,
  createdByUserId: true,
  coverAssetId: true,
  memberCount: true,
  status: true,
  lastActivityAt: true,
  archivedAt: true,
  createdAt: true,
} as const;

type Membership = { id: string; role: string; status: string; joinedAt: Date | null };

/** Ce que `load()` rend : le réseau, et la place du lecteur dedans. */
interface Access {
  readonly community: CommunityRow;
  readonly membership: Membership | null;
}

@Injectable()
export class CommunitiesService {
  private readonly logger = new Logger(CommunitiesService.name);
  private readonly cursorSecret = loadEnv().CURSOR_SECRET;

  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
    private readonly visibility: VisibilityService,
  ) {}

  private fail(code: CommunityErrorCode, details?: Record<string, unknown>): never {
    throw new ApiError(
      code,
      COMMUNITY_ERROR_MESSAGES[code],
      COMMUNITY_ERROR_CODES[code],
      details,
    );
  }

  // ══ Lecture et garde d'accès ═══════════════════════════════════════════════

  /**
   * Charge un réseau pour un lecteur, et applique la visibilité du §2.2.
   *
   * RÈGLE DURE (§9) : « le contenu d'un réseau INVITE_ONLY n'est jamais renvoyé
   * à un non-membre ni indexé pour lui. » Le refus est un `404`, jamais un `403`
   * (00 §5.2) : dire « ce réseau existe mais vous n'y avez pas accès » révèle
   * déjà son existence, son nom dans l'URL, et qui s'y trouve.
   *
   * Toute route de ce module passe par ici. C'est volontairement la seule porte :
   * une route qui irait chercher son réseau elle-même finirait par oublier la
   * règle, et l'oubli ne se verrait pas.
   */
  private async load(idOrSlug: string, viewerId: string): Promise<Access> {
    const asId = this.asUuid(idOrSlug);
    // La branche `id` n'est posée QUE si la valeur est un UUID : passer une
    // chaîne quelconque sur une colonne `@db.Uuid` fait lever Prisma avant même
    // d'atteindre la base, et un slug parfaitement valide donnerait alors 500.
    const community = await this.prisma.community.findFirst({
      where: asId === null ? { slug: idOrSlug } : { OR: [{ id: asId }, { slug: idOrSlug }] },
      select: COMMUNITY_SELECT,
    });
    if (community === null) throw ApiError.notFound();

    const membership = await this.membershipOf(community.id, viewerId);

    if (community.visibility === 'INVITE_ONLY') {
      // INVITED compte : le membre a reçu l'invitation, il doit pouvoir lire
      // l'en-tête pour décider. PENDING n'existe pas ici — on ne demande pas à
      // rejoindre un réseau sur invitation.
      const admitted =
        membership !== null && (membership.status === 'ACTIVE' || membership.status === 'INVITED');
      if (!admitted) throw ApiError.notFound();
    }

    return { community, membership };
  }

  /**
   * Le contenu d'un réseau est réservé à ses membres ACTIFS (§2.3 : « Membres
   * seulement » pour le fil, les sujets et les événements).
   *
   * Sur un réseau `INVITE_ONLY`, `load()` a déjà renvoyé 404 : le `403` ci-dessous
   * ne concerne donc que les réseaux dont l'existence est publique, où « rejoignez
   * d'abord » est l'information utile.
   */
  private assertMember(access: Access): Membership {
    if (access.membership === null || access.membership.status !== 'ACTIVE') {
      throw ApiError.transverse('FORBIDDEN', {
        reason: 'NOT_A_MEMBER',
        communityId: access.community.id,
      });
    }
    return access.membership;
  }

  private assertModerator(access: Access): Membership {
    const membership = this.assertMember(access);
    if (membership.role !== 'OWNER' && membership.role !== 'MODERATOR') {
      throw ApiError.transverse('FORBIDDEN', { reason: 'MODERATOR_REQUIRED' });
    }
    return membership;
  }

  private assertOwner(access: Access): Membership {
    const membership = this.assertMember(access);
    if (membership.role !== 'OWNER') {
      throw ApiError.transverse('FORBIDDEN', { reason: 'OWNER_REQUIRED' });
    }
    return membership;
  }

  /** Un réseau archivé est en LECTURE SEULE (§2.2). */
  private assertWritable(access: Access): void {
    if (access.community.status === 'ARCHIVED') this.fail('COMMUNITY_ARCHIVED');
  }

  private async membershipOf(communityId: string, userId: string): Promise<Membership | null> {
    return this.prisma.communityMember.findUnique({
      where: { communityId_userId: { communityId, userId } },
      select: { id: true, role: true, status: true, joinedAt: true },
    });
  }

  /** `:id` accepte aussi un slug. Rendre `null` évite un `where` sur un UUID invalide. */
  private asUuid(value: string): string | null {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
      ? value
      : null;
  }

  // ══ Adhésion automatique — la chaîne de l'onboarding (§2.1, §6) ════════════

  /**
   * Recalcule les adhésions automatiques d'un membre : réseau de sa VILLE,
   * réseau de son PAYS d'origine (§2.1).
   *
   * C'est le consommateur de `user.onboarded_location` et de `user.city_changed`
   * (§6). Il est écrit comme un RECALCUL et non comme un « ajoute-le au réseau X »
   * pour trois raisons :
   *
   *   · la livraison des événements est « au moins une fois » (00 §9.1) : rejouer
   *     un ajout doit être sans effet, et c'est le cas ici ;
   *   · « changement de ville = changement de réseau » (§2.1) : il faut RETIRER
   *     l'ancienne adhésion, ce qu'un simple ajout ne fait pas ;
   *   · l'événement peut ne jamais arriver — il n'est aujourd'hui émis par
   *     personne (voir la note du contrôleur). Appeler le recalcul depuis
   *     `GET /communities` rattrape alors le retard sans rien dupliquer.
   *
   * Un membre BANNI n'est jamais réintégré : §2.4 donne aux modérateurs le droit
   * de retirer quelqu'un, y compris d'un réseau de ville, et un recalcul qui le
   * ramènerait viderait la sanction de son sens.
   */
  async syncAutoMemberships(userId: string): Promise<{ joined: string[]; left: string[] }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, cityId: true, originCountryId: true, status: true, deletedAt: true },
    });
    if (user === null || user.deletedAt !== null || user.status === 'DELETED') {
      return { joined: [], left: [] };
    }

    const expected = new Set<string>();
    if (user.cityId !== null) {
      const community = await this.ensureAutoCommunity('CITY', user.cityId);
      if (community !== null) expected.add(community.id);
    }
    if (user.originCountryId !== null) {
      const community = await this.ensureAutoCommunity('COUNTRY', user.originCountryId);
      if (community !== null) expected.add(community.id);
    }

    const existing = await this.prisma.communityMember.findMany({
      where: { userId, community: { kind: { in: [...AUTO_KINDS] } } },
      select: { id: true, communityId: true, status: true, role: true },
    });

    const joined: string[] = [];
    const left: string[] = [];

    for (const member of existing) {
      if (expected.has(member.communityId)) continue;
      // Réseau automatique qui ne correspond plus au profil : on retire.
      // Un modérateur bénévole garde son rôle ailleurs ; ici il change de ville,
      // donc il quitte comme les autres.
      if (member.status === 'BANNED') continue;
      await this.removeMembership(member.communityId, userId, 'community.member_left', {
        reason: 'LOCATION_CHANGED',
      });
      left.push(member.communityId);
    }

    const known = new Map(existing.map((m) => [m.communityId, m]));
    for (const communityId of expected) {
      const current = known.get(communityId);
      if (current !== undefined && current.status === 'BANNED') continue;
      if (current !== undefined && current.status === 'ACTIVE') continue;
      await this.activateMembership(communityId, userId, 'MEMBER');
      joined.push(communityId);
    }

    return { joined, left };
  }

  /**
   * Le réseau de ville ou de pays, créé s'il manque.
   *
   * §2.1 fait naître ces réseaux « à l'activation de la ville (module 02) », par
   * l'événement `city.activated` — que personne n'émet encore. On lit donc
   * `cities.is_active` / `countries.is_active`, qui est l'ÉTAT que cet événement
   * annonce, plutôt que d'inventer l'événement. La conséquence est celle que le
   * schéma décrit déjà : « une ville inactive n'a ni réseau, ni carte, ni fiche ».
   */
  async ensureAutoCommunity(
    kind: 'CITY' | 'COUNTRY',
    refId: string,
  ): Promise<{ id: string; slug: string } | null> {
    const existing = await this.prisma.community.findFirst({
      where: kind === 'CITY' ? { kind, cityId: refId } : { kind, countryId: refId },
      select: { id: true, slug: true },
    });
    if (existing !== null) return existing;

    let name: string;
    let slugBase: string;

    if (kind === 'CITY') {
      const city = await this.prisma.city.findUnique({
        where: { id: refId },
        select: { name: true, slug: true, isActive: true },
      });
      if (city === null || !city.isActive) return null;
      name = city.name;
      slugBase = `ville-${city.slug}`;
    } else {
      const country = await this.prisma.country.findUnique({
        where: { id: refId },
        select: { nameFr: true, iso2: true, isActive: true },
      });
      if (country === null || !country.isActive) return null;
      name = country.nameFr;
      slugBase = `pays-${country.iso2.toLowerCase()}`;
    }

    const id = newId();
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.community.create({
          data: {
            id,
            kind,
            ...(kind === 'CITY' ? { cityId: refId } : { countryId: refId }),
            name,
            slug: slugBase,
            // Pas de créateur, visibilité PUBLIC, jamais archivé (§2.1).
            visibility: 'PUBLIC',
            status: 'ACTIVE',
            lastActivityAt: new Date(),
          },
        });
        await this.outbox.emit(tx, {
          type: 'community.created',
          aggregateId: id,
          payload: { kind, slug: slugBase, auto: true },
        });
        await this.audit.record(tx, {
          actor: { type: 'SYSTEM' },
          action: 'community.auto_created',
          targetType: 'community',
          targetId: id,
          metadata: { kind, refId },
        });
      });
      return { id, slug: slugBase };
    } catch {
      // Deux recalculs simultanés pour deux membres de la même ville : le second
      // perd la course sur `slug`. Ce n'est pas une erreur — le réseau existe.
      return this.prisma.community.findFirst({
        where: kind === 'CITY' ? { kind, cityId: refId } : { kind, countryId: refId },
        select: { id: true, slug: true },
      });
    }
  }

  /**
   * Pose ou réactive une adhésion ACTIVE, et tient `member_count`.
   *
   * Le compteur est maintenu à l'écriture ET recalculé chaque nuit
   * (`community.member_count_recompute`, §7). L'incrément sert l'affichage
   * immédiat ; le recalcul corrige les dérives, il ne les remplace pas.
   */
  private async activateMembership(
    communityId: string,
    userId: string,
    role: 'OWNER' | 'MODERATOR' | 'MEMBER',
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const before = await tx.communityMember.findUnique({
        where: { communityId_userId: { communityId, userId } },
        select: { id: true, status: true },
      });

      if (before === null) {
        await tx.communityMember.create({
          data: {
            id: newId(),
            communityId,
            userId,
            role,
            status: 'ACTIVE',
            joinedAt: new Date(),
          },
        });
      } else {
        await tx.communityMember.update({
          where: { id: before.id },
          data: { status: 'ACTIVE', joinedAt: new Date() },
        });
      }

      // N'incrémente que si le membre n'était pas DÉJÀ actif : sans ce test, un
      // rejeu d'événement gonflerait le compteur à chaque passage.
      if (before?.status !== 'ACTIVE') {
        await tx.community.update({
          where: { id: communityId },
          data: { memberCount: { increment: 1 } },
        });
      }

      await this.outbox.emit(tx, {
        type: 'community.member_joined',
        aggregateId: communityId,
        payload: { communityId, userId, role },
      });
    });
  }

  private async removeMembership(
    communityId: string,
    userId: string,
    event: 'community.member_left' | 'community.member_banned',
    payload: Record<string, unknown> = {},
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const before = await tx.communityMember.findUnique({
        where: { communityId_userId: { communityId, userId } },
        select: { id: true, status: true },
      });
      if (before === null) return;

      if (event === 'community.member_banned') {
        // Banni : la ligne RESTE, c'est elle qui interdit de revenir (§2.4).
        await tx.communityMember.update({
          where: { id: before.id },
          data: { status: 'BANNED', role: 'MEMBER' },
        });
      } else {
        await tx.communityMember.delete({ where: { id: before.id } });
      }

      if (before.status === 'ACTIVE') {
        await tx.community.update({
          where: { id: communityId },
          data: { memberCount: { decrement: 1 } },
        });
      }

      await this.outbox.emit(tx, {
        type: event,
        aggregateId: communityId,
        payload: { communityId, userId, ...payload },
      });
    });
  }

  /**
   * `last_activity_at`, dont dépend l'archivage à 60 jours (§2.2).
   *
   * Mis à jour DANS la transaction de l'activité, et non par un consommateur de
   * `community.activity` : entre l'écriture et la consommation, la tâche
   * d'archivage pourrait passer et archiver un réseau qui vient de vivre.
   */
  private async touch(tx: Prisma.TransactionClient, communityId: string): Promise<void> {
    await tx.community.update({
      where: { id: communityId },
      data: { lastActivityAt: new Date() },
    });
  }

  // ══ GET /communities (§4) ══════════════════════════════════════════════════

  /**
   * Mes réseaux, la découverte, et l'état du bouton « Créer » (§4, §5).
   *
   * Le recalcul des adhésions automatiques est fait ici, en préalable : c'est la
   * première route que l'écran « Réseaux » appelle, et c'est le seul endroit où
   * l'on est sûr de rattraper un membre dont l'événement d'onboarding n'a pas été
   * consommé. L'opération est idempotente, donc la répéter ne coûte que deux
   * lectures quand il n'y a rien à faire.
   */
  async list(userId: string, query: CommunityListQuery) {
    await this.syncAutoMemberships(userId);

    const mine = await this.prisma.communityMember.findMany({
      where: { userId, status: 'ACTIVE' },
      orderBy: [{ community: { kind: 'asc' } }, { community: { name: 'asc' } }],
      select: {
        role: true,
        joinedAt: true,
        community: { select: COMMUNITY_SELECT },
      },
    });

    const invitations = await this.prisma.communityMember.findMany({
      where: { userId, status: 'INVITED' },
      select: { community: { select: COMMUNITY_SELECT } },
    });

    const pending = await this.prisma.communityMember.findMany({
      where: { userId, status: 'PENDING' },
      select: { community: { select: COMMUNITY_SELECT } },
    });

    const mineIds = new Set(mine.map((m) => m.community.id));

    const scope = `communities:${query.kind ?? ''}:${query.category ?? ''}:${query.cityId ?? ''}:${query.q ?? ''}`;
    const after = query.cursor === undefined ? null : decodeCursor(query.cursor, this.cursorSecret, scope);

    const where: Prisma.CommunityWhereInput = {
      // « invisible dans la découverte » (§2.2) et « retiré de la découverte »
      // pour un réseau archivé (§2.2). Les deux se disent dans le WHERE, pas
      // après coup : un filtre appliqué en mémoire fausserait la pagination.
      visibility: { not: 'INVITE_ONLY' },
      status: 'ACTIVE',
      ...(query.kind === undefined ? {} : { kind: query.kind }),
      ...(query.category === undefined ? {} : { category: query.category }),
      ...(query.cityId === undefined ? {} : { cityId: query.cityId }),
      ...(query.q === undefined
        ? {}
        : {
            OR: [
              { name: { contains: query.q, mode: 'insensitive' } },
              { description: { contains: query.q, mode: 'insensitive' } },
            ],
          }),
      ...(after === null ? {} : { id: { lt: after.id } }),
    };

    const rows = await this.prisma.community.findMany({
      where,
      orderBy: { id: 'desc' },
      take: query.limit + 1,
      select: COMMUNITY_SELECT,
    });

    const page = buildPage(rows, query.limit, scope, this.cursorSecret);
    const gate = await this.creationGate(userId);

    return {
      mine: mine.map((m) => ({
        ...this.publicShape(m.community),
        myRole: m.role,
        joinedAt: m.joinedAt,
      })),
      invitations: invitations.map((i) => this.publicShape(i.community)),
      pendingRequests: pending.map((p) => this.publicShape(p.community)),
      discover: {
        items: page.items.map((c) => ({ ...this.publicShape(c), joined: mineIds.has(c.id) })),
        nextCursor: page.nextCursor,
      },
      creationGate: gate,
    };
  }

  /**
   * Le seuil de création (§2.2) : « le bouton n'apparaît que si la ville du
   * membre compte 50 membres actifs ou plus ».
   *
   * Le compte est fait EN DIRECT sur `users`, et non sur `cities.member_count` :
   * cette colonne est recalculée chaque nuit (02 §3), donc un membre arrivé dans
   * la journée n'y figure pas. Pour un affichage, la dérive est sans importance ;
   * pour une porte qui s'ouvre à 50, elle décide.
   */
  async creationGate(userId: string): Promise<CommunityCreationGate> {
    const required = await this.cityThreshold();
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { cityId: true, city: { select: { id: true, name: true } } },
    });

    // `=== undefined || === null` explicites : le dépôt interdit `==` (eqeqeq),
    // et l'ambiguïté qu'il masque est justement ce qu'on veut voir ici.
    if (user === null || user.cityId === null || user.city === null) {
      return { canCreate: false, required, current: 0, cityId: null, cityName: null };
    }

    const current = await this.prisma.user.count({
      where: { cityId: user.cityId, status: 'ACTIVE', deletedAt: null },
    });

    return {
      canCreate: current >= required,
      required,
      current,
      cityId: user.city.id,
      cityName: user.city.name,
    };
  }

  /** « Ce seuil est un `system_settings` » (§2.2) — modifiable sans déploiement. */
  private async cityThreshold(): Promise<number> {
    const setting = await this.prisma.systemSetting.findUnique({
      where: { key: COMMUNITY_CITY_THRESHOLD_SETTING_KEY },
      select: { value: true },
    });
    const value = setting?.value;
    if (typeof value === 'number' && Number.isInteger(value) && value >= 0) return value;
    // `{ "value": 50 }` est accepté aussi : les réglages posés à la main par
    // l'équipe prennent souvent cette forme, et refuser les deux écritures
    // ferait retomber silencieusement sur la valeur par défaut.
    if (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      typeof (value as Record<string, unknown>)['value'] === 'number'
    ) {
      return (value as Record<string, number>)['value'] as number;
    }
    return COMMUNITY_CITY_THRESHOLD_DEFAULT;
  }

  private publicShape(c: CommunityRow) {
    return {
      id: c.id,
      kind: c.kind,
      name: c.name,
      slug: c.slug,
      description: c.description,
      category: c.category,
      visibility: c.visibility,
      status: c.status,
      cityId: c.cityId,
      countryId: c.countryId,
      memberCount: c.memberCount,
      coverAssetId: c.coverAssetId,
      lastActivityAt: c.lastActivityAt,
      createdAt: c.createdAt,
    };
  }

  // ══ GET /communities/:slug (§4) ════════════════════════════════════════════

  /** En-tête, mon rôle, compteurs, épinglés (§4). */
  async detail(idOrSlug: string, userId: string) {
    const access = await this.load(idOrSlug, userId);
    const { community, membership } = access;

    const isMember = membership?.status === 'ACTIVE';

    const pinned = isMember ? await this.pinnedTopics(community.id, userId) : [];

    const [topicCount, announcementCount] = isMember
      ? await Promise.all([
          this.prisma.topic.count({ where: { communityId: community.id, deletedAt: null } }),
          this.prisma.communityAnnouncement.count({ where: { communityId: community.id } }),
        ])
      : [0, 0];

    return {
      ...this.publicShape(community),
      myRole: membership?.role ?? null,
      myStatus: membership?.status ?? null,
      /** Ce que le front doit afficher : Rejoindre, Demander, ou rien (§2.2, §5). */
      canJoin:
        membership === null &&
        community.status === 'ACTIVE' &&
        (community.visibility === 'PUBLIC' || community.visibility === 'ON_REQUEST'),
      canLeave: isMember && !AUTO_KINDS.includes(community.kind as 'CITY' | 'COUNTRY'),
      counters: { members: community.memberCount, topics: topicCount, announcements: announcementCount },
      pinned,
    };
  }

  private async pinnedTopics(communityId: string, viewerId: string) {
    const separated = await this.visibility.separatedFrom(viewerId);
    const rows = await this.prisma.topic.findMany({
      where: {
        communityId,
        deletedAt: null,
        pinKind: { not: 'NONE' },
        ...(separated.length === 0 ? {} : { authorUserId: { notIn: separated } }),
      },
      orderBy: { createdAt: 'asc' },
      take: COMMUNITY_MAX_PINNED_TOPICS,
      select: { id: true, title: true, pinKind: true, status: true, replyCount: true },
    });
    return rows;
  }

  // ══ POST /communities (§2.2, §4) ═══════════════════════════════════════════

  /**
   * Création d'un réseau d'intérêt.
   *
   * RÈGLE DURE (§9) : « un réseau d'intérêt ne peut pas être créé sans 5
   * invitations » — et ce sont cinq invitations RÉSOLUES qu'on compte, pas cinq
   * chaînes dans le corps de la requête. Un handle inexistant, le créateur
   * lui-même, un membre supprimé ou un membre séparé par un blocage ne peuplent
   * aucun réseau : les accepter reviendrait à contourner le garde-fou en tapant
   * cinq pseudos au hasard.
   *
   * RÈGLE DURE (§9) : « le bouton de création est refusé sous le seuil de membres
   * de la ville » — vérifié ici et pas seulement à l'affichage, sinon un appel
   * direct à l'API suffirait à ouvrir un réseau dans une ville de trois membres.
   */
  async create(userId: string, input: CreateCommunity) {
    const gate = await this.creationGate(userId);
    if (!gate.canCreate) {
      this.fail('CITY_THRESHOLD', {
        required: gate.required,
        current: gate.current,
        cityId: gate.cityId,
        cityName: gate.cityName,
      });
    }

    const separated = await this.visibility.separatedFrom(userId);
    const invitees = await this.prisma.user.findMany({
      where: {
        handle: { in: input.inviteHandles },
        deletedAt: null,
        status: { in: ['ACTIVE', 'SUSPENDED'] },
        id: { not: userId, ...(separated.length === 0 ? {} : { notIn: separated }) },
      },
      select: { id: true, handle: true },
    });

    if (invitees.length < COMMUNITY_MIN_INVITES) {
      this.fail('NOT_ENOUGH_INVITES', {
        required: COMMUNITY_MIN_INVITES,
        resolved: invitees.length,
        // Les handles qui n'ont pas abouti, pour que l'écran de création puisse
        // les marquer plutôt que de renvoyer un refus global.
        unresolved: input.inviteHandles.filter(
          (h) => !invitees.some((i) => i.handle.toLowerCase() === h),
        ),
      });
    }

    const id = newId();
    const slug = await this.uniqueSlug(input.name);

    await this.prisma.$transaction(async (tx) => {
      await tx.community.create({
        data: {
          id,
          kind: 'INTEREST',
          name: input.name,
          slug,
          description: input.description ?? null,
          category: input.category,
          visibility: input.visibility,
          createdByUserId: userId,
          coverAssetId: input.coverAssetId ?? null,
          // « Le réseau est créé en ACTIVE » (§2.2) : aucun état d'attente, le
          // créateur n'a pas à revenir vérifier que son réseau s'est ouvert.
          status: 'ACTIVE',
          memberCount: 1,
          lastActivityAt: new Date(),
        },
      });

      await tx.communityMember.create({
        data: {
          id: newId(),
          communityId: id,
          userId,
          role: 'OWNER',
          status: 'ACTIVE',
          joinedAt: new Date(),
        },
      });

      await tx.communityMember.createMany({
        data: invitees.map((i) => ({
          id: newId(),
          communityId: id,
          userId: i.id,
          role: 'MEMBER' as const,
          status: 'INVITED' as const,
        })),
        skipDuplicates: true,
      });

      await this.audit.record(tx, {
        actor: { type: 'MEMBER', id: userId },
        action: 'community.created',
        targetType: 'community',
        targetId: id,
        metadata: { kind: 'INTEREST', visibility: input.visibility, invited: invitees.length },
      });

      await this.outbox.emit(tx, {
        type: 'community.created',
        aggregateId: id,
        // Les invités sont dans la charge utile : c'est `notifications` qui les
        // prévient (§6), pas ce service — 00 §3.3 interdit l'appel direct.
        payload: {
          kind: 'INTEREST',
          slug,
          ownerUserId: userId,
          invitedUserIds: invitees.map((i) => i.id),
        },
      });
    });

    return this.detail(id, userId);
  }

  private async uniqueSlug(name: string): Promise<string> {
    const base =
      name
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60) || 'reseau';

    for (let suffix = 0; suffix < 50; suffix += 1) {
      const candidate = suffix === 0 ? base : `${base}-${suffix}`;
      const taken = await this.prisma.community.findUnique({
        where: { slug: candidate },
        select: { id: true },
      });
      if (taken === null) return candidate;
    }
    return `${base}-${newId().replace(/-/g, '').slice(0, 6)}`;
  }

  // ══ PATCH /communities/:id (§4) ════════════════════════════════════════════

  async update(idOrSlug: string, userId: string, patch: UpdateCommunity) {
    const access = await this.load(idOrSlug, userId);
    this.assertOwner(access);
    this.assertWritable(access);

    if (AUTO_KINDS.includes(access.community.kind as 'CITY' | 'COUNTRY')) {
      // Un réseau de ville tient son nom du référentiel (02) : le renommer ici
      // le désynchroniserait de la ville qu'il représente.
      throw ApiError.transverse('FORBIDDEN', { reason: 'AUTO_COMMUNITY_IMMUTABLE' });
    }

    // `Unchecked` plutôt que `CommunityUpdateInput` : la version vérifiée ne
    // connaît que la RELATION `coverAsset`, et poser une clé étrangère à `null`
    // par un `disconnect` pour une simple photo de couverture est plus de code
    // pour le même effet.
    const data: Prisma.CommunityUncheckedUpdateInput = {};
    if (patch.name !== undefined) data.name = patch.name;
    if (patch.description !== undefined) data.description = patch.description;
    if (patch.category !== undefined) data.category = patch.category;
    if (patch.visibility !== undefined) data.visibility = patch.visibility;
    if (patch.coverAssetId !== undefined) data.coverAssetId = patch.coverAssetId;

    await this.prisma.$transaction(async (tx) => {
      await tx.community.update({ where: { id: access.community.id }, data });
      await this.audit.record(tx, {
        actor: { type: 'MEMBER', id: userId },
        action: 'community.updated',
        targetType: 'community',
        targetId: access.community.id,
        metadata: { fields: Object.keys(data) },
      });
    });

    return this.detail(access.community.id, userId);
  }

  // ══ Adhésion (§2.2, §4) ═══════════════════════════════════════════════════

  async join(idOrSlug: string, userId: string) {
    const access = await this.load(idOrSlug, userId);
    this.assertWritable(access);
    const { community, membership } = access;

    if (membership?.status === 'BANNED') this.fail('BANNED_FROM_COMMUNITY');
    // Idempotent : rejoindre deux fois n'est pas une erreur, c'est le même état.
    if (membership?.status === 'ACTIVE') return this.detail(community.id, userId);

    if (community.visibility === 'INVITE_ONLY' && membership?.status !== 'INVITED') {
      this.fail('INVITE_ONLY');
    }

    if (community.visibility === 'ON_REQUEST' && membership === null) {
      await this.prisma.communityMember.create({
        data: { id: newId(), communityId: community.id, userId, role: 'MEMBER', status: 'PENDING' },
      });
      return this.detail(community.id, userId);
    }
    if (community.visibility === 'ON_REQUEST' && membership?.status === 'PENDING') {
      return this.detail(community.id, userId);
    }

    await this.activateMembership(community.id, userId, 'MEMBER');
    return this.detail(community.id, userId);
  }

  /**
   * RÈGLE DURE (§9) : « on ne peut pas quitter un réseau automatique. »
   *
   * §2.1 le dit ligne par ligne : sortie « Impossible (on peut le mettre en
   * sourdine) ». Un membre de Lyon EST du réseau de Lyon ; ce n'est pas une
   * adhésion, c'est un fait, et le recalcul du §2.1 le remettrait de toute façon.
   */
  async leave(idOrSlug: string, userId: string): Promise<void> {
    const access = await this.load(idOrSlug, userId);
    const { community, membership } = access;

    if (AUTO_KINDS.includes(community.kind as 'CITY' | 'COUNTRY')) {
      this.fail('AUTO_COMMUNITY', { kind: community.kind });
    }
    if (membership === null) return;

    if (membership.role === 'OWNER') {
      // §2.2 : la propriété est unique et transférable. Laisser partir le
      // propriétaire sans successeur laisserait un réseau que personne ne peut
      // plus modérer ni réactiver.
      this.fail('OWNER_MUST_TRANSFER');
    }

    await this.removeMembership(community.id, userId, 'community.member_left', { self: true });
  }

  // ══ Invitations (§4) ══════════════════════════════════════════════════════

  async invite(idOrSlug: string, userId: string, input: InviteMembers) {
    const access = await this.load(idOrSlug, userId);
    this.assertMember(access);
    this.assertWritable(access);

    // Sur un réseau sur invitation, seuls propriétaire et modérateurs invitent :
    // sinon « invisible dans la découverte » (§2.2) ne tiendrait plus, n'importe
    // quel membre pouvant y faire entrer qui il veut.
    if (access.community.visibility === 'INVITE_ONLY') this.assertModerator(access);

    const separated = await this.visibility.separatedFrom(userId);
    const targets = await this.prisma.user.findMany({
      where: {
        handle: { in: input.handles },
        deletedAt: null,
        status: { in: ['ACTIVE', 'SUSPENDED'] },
        id: { not: userId, ...(separated.length === 0 ? {} : { notIn: separated }) },
      },
      select: { id: true, handle: true },
    });

    const existing = await this.prisma.communityMember.findMany({
      where: { communityId: access.community.id, userId: { in: targets.map((t) => t.id) } },
      select: { userId: true, status: true },
    });
    const known = new Map(existing.map((e) => [e.userId, e.status]));

    // Un banni n'est pas réinvité : §2.4 dit « ne peut plus rejoindre ».
    const fresh = targets.filter((t) => known.get(t.id) === undefined);

    if (fresh.length > 0) {
      await this.prisma.communityMember.createMany({
        data: fresh.map((t) => ({
          id: newId(),
          communityId: access.community.id,
          userId: t.id,
          role: 'MEMBER' as const,
          status: 'INVITED' as const,
        })),
        skipDuplicates: true,
      });
    }

    return {
      invited: fresh.map((t) => t.handle),
      alreadyKnown: targets.filter((t) => known.has(t.id)).map((t) => t.handle),
      unresolved: input.handles.filter((h) => !targets.some((t) => t.handle.toLowerCase() === h)),
    };
  }

  // ══ Demandes d'adhésion (§4) ══════════════════════════════════════════════

  async decideRequest(
    idOrSlug: string,
    actorId: string,
    targetUserId: string,
    decision: 'accept' | 'reject',
  ): Promise<{ status: string }> {
    const access = await this.load(idOrSlug, actorId);
    this.assertModerator(access);
    this.assertWritable(access);

    const request = await this.prisma.communityMember.findUnique({
      where: { communityId_userId: { communityId: access.community.id, userId: targetUserId } },
      select: { id: true, status: true },
    });
    if (request === null || request.status !== 'PENDING') throw ApiError.notFound();

    if (decision === 'accept') {
      await this.activateMembership(access.community.id, targetUserId, 'MEMBER');
    } else {
      // Rejet : la ligne DISPARAÎT plutôt que de passer BANNED. Refuser une
      // demande n'est pas bannir, et le membre doit pouvoir redemander.
      await this.prisma.communityMember.delete({ where: { id: request.id } });
    }

    await this.audit.record(this.prisma, {
      actor: { type: 'MEMBER', id: actorId },
      action: `community.request_${decision}ed`,
      targetType: 'community_member',
      targetId: request.id,
      metadata: { communityId: access.community.id, userId: targetUserId },
    });

    return { status: decision === 'accept' ? 'ACTIVE' : 'REJECTED' };
  }

  // ══ GET /communities/:id/members (§2.3, §4) ═══════════════════════════════

  /**
   * Liste des membres : rôle, phase, ville ; recherche par handle (§2.3).
   *
   * RÈGLE (§6, `user.blocked`) : masquage RÉCIPROQUE. `separatedFrom()` rend les
   * deux sens d'un coup — celui qui a bloqué ne doit pas non plus retrouver
   * l'autre dans cette liste (08 §4).
   */
  async members(idOrSlug: string, userId: string, query: MemberListQuery) {
    const access = await this.load(idOrSlug, userId);
    this.assertMember(access);

    if (query.pending === true) this.assertModerator(access);

    const separated = await this.visibility.separatedFrom(userId);
    const scope = `members:${access.community.id}:${query.q ?? ''}:${query.role ?? ''}:${query.pending === true ? 'p' : 'a'}`;
    const after = query.cursor === undefined ? null : decodeCursor(query.cursor, this.cursorSecret, scope);

    const rows = await this.prisma.communityMember.findMany({
      where: {
        communityId: access.community.id,
        status: query.pending === true ? 'PENDING' : 'ACTIVE',
        ...(query.role === undefined ? {} : { role: query.role }),
        ...(separated.length === 0 ? {} : { userId: { notIn: separated } }),
        ...(after === null ? {} : { id: { lt: after.id } }),
        user: {
          deletedAt: null,
          ...(query.q === undefined ? {} : { handle: { contains: query.q, mode: 'insensitive' } }),
        },
      },
      // Tri sur le SEUL identifiant, et pas « rôle puis identifiant » : le
      // curseur de 00 §5.3 ne porte qu'une clé, et un tri à deux niveaux dont la
      // première est un enum non comparable rendrait la pagination fausse dès la
      // deuxième page. L'écran de gestion obtient ses modérateurs par
      // `?role=MODERATOR`, qui est exact à toutes les pages.
      orderBy: { id: 'desc' },
      take: query.limit + 1,
      select: {
        id: true,
        role: true,
        status: true,
        joinedAt: true,
        user: {
          select: {
            id: true,
            handle: true,
            displayName: true,
            phase: true,
            city: { select: { id: true, name: true } },
            avatarAsset: { select: { storageKey: true } },
          },
        },
      },
    });

    const page = buildPage(rows, query.limit, scope, this.cursorSecret);

    return {
      items: page.items.map((m) => ({
        userId: m.user.id,
        handle: m.user.handle,
        displayName: m.user.displayName,
        avatarUrl: m.user.avatarAsset === null ? null : `/media/${m.user.avatarAsset.storageKey}`,
        phase: m.user.phase,
        city: m.user.city,
        role: m.role,
        status: m.status,
        joinedAt: m.joinedAt,
      })),
      nextCursor: page.nextCursor,
    } satisfies Page<unknown>;
  }

  // ══ PATCH /communities/:id/members/:userId (§2.4, §4) ═════════════════════

  /**
   * Rôle et bannissement. Toute action est journalisée avec
   * `actor_type = MEMBER` (§2.4) : un modérateur bénévole n'est pas l'équipe, et
   * le journal doit le dire.
   *
   * NOTE — `muted` de §4 n'est PAS traité ici : la colonne
   * `community_members.muted` que §3 annonce « ajoutée » n'existe pas dans le
   * schéma, qui est figé. Voir le rapport.
   */
  async updateMember(
    idOrSlug: string,
    actorId: string,
    targetUserId: string,
    patch: UpdateMember,
  ) {
    const access = await this.load(idOrSlug, actorId);
    const actor = this.assertModerator(access);
    this.assertWritable(access);

    const target = await this.prisma.communityMember.findUnique({
      where: { communityId_userId: { communityId: access.community.id, userId: targetUserId } },
      select: { id: true, role: true, status: true },
    });
    if (target === null) throw ApiError.notFound();

    if (target.role === 'OWNER') {
      throw ApiError.transverse('FORBIDDEN', { reason: 'OWNER_IMMUTABLE' });
    }
    // Un modérateur ne touche pas à un autre modérateur : seul le propriétaire
    // nomme et révoque (§2.2). Sans cela, deux modérateurs pourraient se
    // destituer l'un l'autre.
    if (target.role === 'MODERATOR' && actor.role !== 'OWNER') {
      throw ApiError.transverse('FORBIDDEN', { reason: 'OWNER_REQUIRED' });
    }
    if (patch.role !== undefined && actor.role !== 'OWNER') {
      throw ApiError.transverse('FORBIDDEN', { reason: 'OWNER_REQUIRED' });
    }

    if (patch.status === 'BANNED') {
      await this.removeMembership(access.community.id, targetUserId, 'community.member_banned', {
        byUserId: actorId,
      });
      await this.audit.record(this.prisma, {
        actor: { type: 'MEMBER', id: actorId },
        action: 'community.member_banned',
        targetType: 'community_member',
        targetId: target.id,
        metadata: { communityId: access.community.id, userId: targetUserId },
      });
      return { userId: targetUserId, role: 'MEMBER', status: 'BANNED' };
    }

    await this.prisma.$transaction(async (tx) => {
      if (patch.status === 'ACTIVE' && target.status !== 'ACTIVE') {
        await tx.communityMember.update({
          where: { id: target.id },
          data: { status: 'ACTIVE', joinedAt: new Date() },
        });
        await tx.community.update({
          where: { id: access.community.id },
          data: { memberCount: { increment: 1 } },
        });
      }
      if (patch.role !== undefined) {
        await tx.communityMember.update({
          where: { id: target.id },
          data: { role: patch.role },
        });
      }
      await this.audit.record(tx, {
        actor: { type: 'MEMBER', id: actorId },
        action: 'community.member_updated',
        targetType: 'community_member',
        targetId: target.id,
        metadata: { communityId: access.community.id, userId: targetUserId, ...patch },
      });
    });

    const after = await this.membershipOf(access.community.id, targetUserId);
    return { userId: targetUserId, role: after?.role ?? null, status: after?.status ?? null };
  }

  // ══ POST /communities/:id/transfer (§2.2, §4) ═════════════════════════════

  /** « Le propriétaire peut transférer la propriété » (§2.2) — et il n'y en a qu'un. */
  async transfer(idOrSlug: string, actorId: string, toUserId: string) {
    const access = await this.load(idOrSlug, actorId);
    this.assertOwner(access);

    if (toUserId === actorId) {
      throw ApiError.validation([{ path: 'toUserId', code: 'SELF_TRANSFER' }]);
    }

    const target = await this.prisma.communityMember.findUnique({
      where: { communityId_userId: { communityId: access.community.id, userId: toUserId } },
      select: { id: true, status: true },
    });
    if (target === null || target.status !== 'ACTIVE') throw ApiError.notFound();

    await this.prisma.$transaction(async (tx) => {
      // Les deux mises à jour dans la MÊME transaction : entre les deux, le
      // réseau aurait soit deux propriétaires, soit aucun.
      await tx.communityMember.update({
        where: { communityId_userId: { communityId: access.community.id, userId: actorId } },
        data: { role: 'MODERATOR' },
      });
      await tx.communityMember.update({ where: { id: target.id }, data: { role: 'OWNER' } });
      await tx.community.update({
        where: { id: access.community.id },
        data: { createdByUserId: toUserId },
      });
      await this.audit.record(tx, {
        actor: { type: 'MEMBER', id: actorId },
        action: 'community.ownership_transferred',
        targetType: 'community',
        targetId: access.community.id,
        metadata: { from: actorId, to: toUserId },
      });
    });

    return this.detail(access.community.id, actorId);
  }

  // ══ GET /communities/:id/feed (§2.3, §4) ══════════════════════════════════

  /**
   * Le fil du réseau. Lecture seule ici : les publications appartiennent au
   * module 04, qui n'existe pas encore — on lit `posts.community_id`, on n'en
   * écrit pas.
   */
  async feed(idOrSlug: string, userId: string, query: { cursor?: string | undefined; limit: number }) {
    const access = await this.load(idOrSlug, userId);
    this.assertMember(access);

    const separated = await this.visibility.separatedFrom(userId);
    const scope = `feed:${access.community.id}`;
    const after = query.cursor === undefined ? null : decodeCursor(query.cursor, this.cursorSecret, scope);

    const rows = await this.prisma.post.findMany({
      where: {
        communityId: access.community.id,
        deletedAt: null,
        status: 'PUBLISHED',
        ...(separated.length === 0 ? {} : { authorUserId: { notIn: separated } }),
        ...(after === null ? {} : { id: { lt: after.id } }),
      },
      orderBy: { id: 'desc' },
      take: query.limit + 1,
      select: {
        id: true,
        type: true,
        body: true,
        createdAt: true,
        reactionCount: true,
        commentCount: true,
        author: { select: { id: true, handle: true, displayName: true } },
      },
    });

    const page = buildPage(rows, query.limit, scope, this.cursorSecret);
    return { items: page.items, nextCursor: page.nextCursor };
  }

  // ══ Sujets (§2.3, §4) ═════════════════════════════════════════════════════

  async topics(idOrSlug: string, userId: string, query: TopicListQuery) {
    const access = await this.load(idOrSlug, userId);
    this.assertMember(access);

    const separated = await this.visibility.separatedFrom(userId);
    const scope = `topics:${access.community.id}:${query.status ?? ''}:${query.q ?? ''}`;
    const after = query.cursor === undefined ? null : decodeCursor(query.cursor, this.cursorSecret, scope);

    const rows = await this.prisma.topic.findMany({
      where: {
        communityId: access.community.id,
        deletedAt: null,
        ...(query.status === undefined ? {} : { status: query.status }),
        ...(separated.length === 0 ? {} : { authorUserId: { notIn: separated } }),
        ...(query.q === undefined
          ? {}
          : {
              OR: [
                { title: { contains: query.q, mode: 'insensitive' } },
                { body: { contains: query.q, mode: 'insensitive' } },
              ],
            }),
        ...(after === null ? {} : { id: { lt: after.id } }),
      },
      orderBy: { id: 'desc' },
      take: query.limit + 1,
      select: {
        id: true,
        title: true,
        status: true,
        pinKind: true,
        replyCount: true,
        lastReplyAt: true,
        createdAt: true,
        author: { select: { id: true, handle: true, displayName: true } },
      },
    });

    const page = buildPage(rows, query.limit, scope, this.cursorSecret);

    return {
      items: page.items,
      nextCursor: page.nextCursor,
      // Les épinglés sont renvoyés à part et non intercalés : « épinglés en tête »
      // (§2.3) et une pagination par curseur ne se marient pas — un épinglé placé
      // en tête de chaque page y apparaîtrait autant de fois qu'il y a de pages.
      meta: { pinned: await this.pinnedTopics(access.community.id, userId) },
    } satisfies Page<unknown>;
  }

  async createTopic(idOrSlug: string, userId: string, input: CreateTopic) {
    const access = await this.load(idOrSlug, userId);
    this.assertMember(access);
    this.assertWritable(access);

    const id = newId();
    await this.prisma.$transaction(async (tx) => {
      await tx.topic.create({
        data: {
          id,
          communityId: access.community.id,
          authorUserId: userId,
          title: input.title,
          body: input.body,
          status: 'OPEN',
          pinKind: 'NONE',
        },
      });
      // Un sujet est une activité au sens de §2.2 : il repousse l'archivage.
      await this.touch(tx, access.community.id);
      await this.outbox.emit(tx, {
        type: 'community.topic_created',
        aggregateId: id,
        payload: { communityId: access.community.id, topicId: id, authorUserId: userId },
      });
    });

    return this.topic(id, userId);
  }

  /**
   * Un sujet et ses réponses.
   *
   * Le sujet est chargé DEPUIS son réseau (`load`) et non directement : sans
   * cela, un sujet d'un réseau `INVITE_ONLY` serait lisible par son identifiant,
   * et la règle dure du §9 tomberait par la porte de derrière.
   */
  async topic(topicId: string, userId: string) {
    const topic = await this.prisma.topic.findFirst({
      where: { id: topicId, deletedAt: null },
      select: {
        id: true,
        communityId: true,
        title: true,
        body: true,
        status: true,
        pinKind: true,
        replyCount: true,
        lastReplyAt: true,
        createdAt: true,
        authorUserId: true,
        author: { select: { id: true, handle: true, displayName: true } },
      },
    });
    if (topic === null) throw ApiError.notFound();

    const access = await this.load(topic.communityId, userId);
    const membership = this.assertMember(access);

    // Un sujet écrit par un membre séparé n'existe PAS pour ce lecteur, dans les
    // deux sens (§6, `user.blocked`). 404 et non 403 : T4 §3.
    if (await this.visibility.isSeparated(userId, topic.authorUserId)) throw ApiError.notFound();

    const separated = await this.visibility.separatedFrom(userId);
    const replies = await this.prisma.comment.findMany({
      where: {
        subjectType: 'TOPIC',
        subjectId: topic.id,
        deletedAt: null,
        status: 'PUBLISHED',
        ...(separated.length === 0 ? {} : { authorUserId: { notIn: separated } }),
      },
      orderBy: { createdAt: 'asc' },
      take: 200,
      select: {
        id: true,
        body: true,
        createdAt: true,
        parentCommentId: true,
        author: { select: { id: true, handle: true, displayName: true } },
      },
    });

    const isModerator = membership.role === 'OWNER' || membership.role === 'MODERATOR';
    return {
      ...topic,
      community: { id: access.community.id, slug: access.community.slug, name: access.community.name },
      canResolve: topic.authorUserId === userId || isModerator,
      canPin: isModerator,
      canEdit:
        topic.authorUserId === userId &&
        Date.now() - topic.createdAt.getTime() < TOPIC_EDIT_WINDOW_MINUTES * 60_000,
      replies,
    };
  }

  /**
   * `PATCH /topics/:id` (§4) : trois droits distincts dans un même appel.
   *
   *   · `status` — l'auteur marque RÉSOLU (§2.3), un modérateur clôt (§2.4) ;
   *   · `pinKind` — modérateur seulement, cinq épinglés au maximum (§2.3) ;
   *   · `title` / `body` — l'auteur, dans les 15 minutes (§4).
   */
  async updateTopic(topicId: string, userId: string, patch: UpdateTopic) {
    const topic = await this.prisma.topic.findFirst({
      where: { id: topicId, deletedAt: null },
      select: {
        id: true,
        communityId: true,
        authorUserId: true,
        status: true,
        pinKind: true,
        createdAt: true,
      },
    });
    if (topic === null) throw ApiError.notFound();

    const access = await this.load(topic.communityId, userId);
    const membership = this.assertMember(access);
    this.assertWritable(access);

    const isAuthor = topic.authorUserId === userId;
    const isModerator = membership.role === 'OWNER' || membership.role === 'MODERATOR';

    const data: Prisma.TopicUpdateInput = {};

    if (patch.pinKind !== undefined) {
      if (!isModerator) throw ApiError.transverse('FORBIDDEN', { reason: 'MODERATOR_REQUIRED' });
      if (patch.pinKind !== 'NONE' && topic.pinKind === 'NONE') {
        const pinned = await this.prisma.topic.count({
          where: { communityId: topic.communityId, deletedAt: null, pinKind: { not: 'NONE' } },
        });
        if (pinned >= COMMUNITY_MAX_PINNED_TOPICS) {
          this.fail('PIN_LIMIT', { max: COMMUNITY_MAX_PINNED_TOPICS, current: pinned });
        }
      }
      data.pinKind = patch.pinKind;
    }

    if (patch.status !== undefined) {
      if (!isAuthor && !isModerator) {
        throw ApiError.transverse('FORBIDDEN', { reason: 'AUTHOR_OR_MODERATOR_REQUIRED' });
      }
      // ARCHIVED est posé par la tâche `community.topic_archive` (§7), pas à la
      // main : l'ouvrir ici donnerait deux façons d'archiver, dont une qui ne
      // respecte pas les 90 jours.
      if (patch.status === 'ARCHIVED') {
        throw ApiError.validation([{ path: 'status', code: 'SYSTEM_ONLY' }]);
      }
      data.status = patch.status;
    }

    if (patch.title !== undefined || patch.body !== undefined) {
      const withinWindow =
        Date.now() - topic.createdAt.getTime() < TOPIC_EDIT_WINDOW_MINUTES * 60_000;
      if (!isAuthor || !withinWindow) {
        throw ApiError.transverse('FORBIDDEN', {
          reason: 'EDIT_WINDOW_CLOSED',
          windowMinutes: TOPIC_EDIT_WINDOW_MINUTES,
        });
      }
      if (patch.title !== undefined) data.title = patch.title;
      if (patch.body !== undefined) data.body = patch.body;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.topic.update({ where: { id: topic.id }, data });
      if (isModerator && !isAuthor) {
        // §2.4 : « toute action de modération de réseau est journalisée ».
        await this.audit.record(tx, {
          actor: { type: 'MEMBER', id: userId },
          action: 'community.topic_moderated',
          targetType: 'topic',
          targetId: topic.id,
          metadata: { communityId: topic.communityId, fields: Object.keys(data) },
        });
      }
      if (patch.status === 'RESOLVED' && topic.status !== 'RESOLVED') {
        await this.outbox.emit(tx, {
          type: 'community.topic_resolved',
          aggregateId: topic.id,
          payload: { communityId: topic.communityId, topicId: topic.id, byUserId: userId },
        });
      }
    });

    return this.topic(topic.id, userId);
  }

  /** §2.4 : masquer un sujet du réseau. L'auteur peut aussi retirer le sien. */
  async deleteTopic(topicId: string, userId: string): Promise<void> {
    const topic = await this.prisma.topic.findFirst({
      where: { id: topicId, deletedAt: null },
      select: { id: true, communityId: true, authorUserId: true },
    });
    if (topic === null) throw ApiError.notFound();

    const access = await this.load(topic.communityId, userId);
    const membership = this.assertMember(access);
    const isModerator = membership.role === 'OWNER' || membership.role === 'MODERATOR';
    if (!isModerator && topic.authorUserId !== userId) {
      throw ApiError.transverse('FORBIDDEN', { reason: 'AUTHOR_OR_MODERATOR_REQUIRED' });
    }

    await this.prisma.$transaction(async (tx) => {
      // Masqué, pas supprimé : 13 §2 — « le pipeline masque, il ne supprime jamais ».
      await tx.topic.update({ where: { id: topic.id }, data: { deletedAt: new Date() } });
      await this.audit.record(tx, {
        actor: { type: 'MEMBER', id: userId },
        action: 'community.topic_hidden',
        targetType: 'topic',
        targetId: topic.id,
        metadata: { communityId: topic.communityId, byModerator: isModerator },
      });
    });
  }

  // ══ Annonces (§2.3, §4) ═══════════════════════════════════════════════════

  async announcements(
    idOrSlug: string,
    userId: string,
    query: { cursor?: string | undefined; limit: number },
  ) {
    const access = await this.load(idOrSlug, userId);
    this.assertMember(access);

    const scope = `announcements:${access.community.id}`;
    const after = query.cursor === undefined ? null : decodeCursor(query.cursor, this.cursorSecret, scope);

    const rows = await this.prisma.communityAnnouncement.findMany({
      where: {
        communityId: access.community.id,
        ...(after === null ? {} : { id: { lt: after.id } }),
      },
      orderBy: { id: 'desc' },
      take: query.limit + 1,
      select: {
        id: true,
        body: true,
        createdAt: true,
        author: { select: { id: true, handle: true, displayName: true } },
      },
    });

    const page = buildPage(rows, query.limit, scope, this.cursorSecret);
    return { items: page.items, nextCursor: page.nextCursor };
  }

  /**
   * Annonce du propriétaire ou d'un modérateur (§2.3).
   *
   * « 2 par semaine maximum » est une limite PAR RÉSEAU et non par auteur : le
   * but est de ne pas noyer les membres de notifications, et deux modérateurs qui
   * annoncent chacun deux fois feraient quatre notifications.
   */
  async createAnnouncement(idOrSlug: string, userId: string, body: string) {
    const access = await this.load(idOrSlug, userId);
    this.assertModerator(access);
    this.assertWritable(access);

    const since = new Date(Date.now() - 7 * DAY_MS);
    const recent = await this.prisma.communityAnnouncement.count({
      where: { communityId: access.community.id, createdAt: { gte: since } },
    });
    if (recent >= COMMUNITY_ANNOUNCEMENTS_PER_WEEK) {
      this.fail('ANNOUNCEMENT_LIMIT', { max: COMMUNITY_ANNOUNCEMENTS_PER_WEEK, current: recent });
    }

    const id = newId();
    await this.prisma.$transaction(async (tx) => {
      await tx.communityAnnouncement.create({
        data: { id, communityId: access.community.id, authorUserId: userId, body },
      });
      await this.touch(tx, access.community.id);
      await this.outbox.emit(tx, {
        type: 'community.announcement_published',
        aggregateId: id,
        // `notifications` doit prévenir « tous les membres non en sourdine »
        // (§2.3). La sourdine n'est pas stockable aujourd'hui — voir le rapport.
        payload: { communityId: access.community.id, announcementId: id, authorUserId: userId },
      });
    });

    return { id, body, createdAt: new Date() };
  }

  // ══ Sondages (§2.3, §4) ═══════════════════════════════════════════════════

  async polls(idOrSlug: string, userId: string, query: { cursor?: string | undefined; limit: number }) {
    const access = await this.load(idOrSlug, userId);
    this.assertMember(access);

    const separated = await this.visibility.separatedFrom(userId);
    const scope = `polls:${access.community.id}`;
    const after = query.cursor === undefined ? null : decodeCursor(query.cursor, this.cursorSecret, scope);

    const rows = await this.prisma.poll.findMany({
      where: {
        communityId: access.community.id,
        ...(separated.length === 0 ? {} : { authorUserId: { notIn: separated } }),
        ...(after === null ? {} : { id: { lt: after.id } }),
      },
      orderBy: { id: 'desc' },
      take: query.limit + 1,
      select: {
        id: true,
        question: true,
        isMultiple: true,
        closesAt: true,
        createdAt: true,
        author: { select: { id: true, handle: true, displayName: true } },
        options: { orderBy: { position: 'asc' }, select: { id: true, label: true, position: true, voteCount: true } },
      },
    });

    const page = buildPage(rows, query.limit, scope, this.cursorSecret);
    const myVotes = await this.prisma.pollVote.findMany({
      where: { userId, pollOption: { pollId: { in: page.items.map((p) => p.id) } } },
      select: { pollOptionId: true, pollOption: { select: { pollId: true } } },
    });

    return {
      items: page.items.map((poll) => this.shapePoll(poll, myVotes)),
      nextCursor: page.nextCursor,
    };
  }

  /**
   * « Résultats visibles après vote ou clôture » (§2.3).
   *
   * Les compteurs sont donc RETIRÉS de la réponse tant que le membre n'a pas
   * voté : les laisser et demander au front de ne pas les afficher revient à les
   * publier, puisqu'ils sont dans la réponse HTTP.
   */
  private shapePoll(
    poll: {
      id: string;
      question: string;
      isMultiple: boolean;
      closesAt: Date | null;
      createdAt: Date;
      author: { id: string; handle: string; displayName: string };
      options: { id: string; label: string; position: number; voteCount: number }[];
    },
    myVotes: { pollOptionId: string; pollOption: { pollId: string } }[],
  ) {
    const mine = myVotes.filter((v) => v.pollOption.pollId === poll.id).map((v) => v.pollOptionId);
    const closed = poll.closesAt !== null && poll.closesAt.getTime() <= Date.now();
    const revealed = closed || mine.length > 0;

    return {
      id: poll.id,
      question: poll.question,
      isMultiple: poll.isMultiple,
      closesAt: poll.closesAt,
      closed,
      createdAt: poll.createdAt,
      author: poll.author,
      myOptionIds: mine,
      resultsVisible: revealed,
      totalVotes: revealed ? poll.options.reduce((sum, o) => sum + o.voteCount, 0) : null,
      options: poll.options.map((o) => ({
        id: o.id,
        label: o.label,
        position: o.position,
        voteCount: revealed ? o.voteCount : null,
      })),
    };
  }

  async createPoll(idOrSlug: string, userId: string, input: CreatePoll) {
    const access = await this.load(idOrSlug, userId);
    this.assertMember(access);
    this.assertWritable(access);

    if (input.closesAt !== undefined && input.closesAt.getTime() <= Date.now()) {
      throw ApiError.validation([{ path: 'closesAt', code: 'TOO_SMALL' }]);
    }

    const id = newId();
    await this.prisma.$transaction(async (tx) => {
      await tx.poll.create({
        data: {
          id,
          communityId: access.community.id,
          authorUserId: userId,
          question: input.question,
          isMultiple: input.isMultiple,
          closesAt: input.closesAt ?? null,
          options: {
            create: input.options.map((label, position) => ({ id: newId(), label, position })),
          },
        },
      });
      await this.touch(tx, access.community.id);
    });

    return this.poll(id, userId);
  }

  async poll(pollId: string, userId: string) {
    const poll = await this.prisma.poll.findUnique({
      where: { id: pollId },
      select: {
        id: true,
        communityId: true,
        question: true,
        isMultiple: true,
        closesAt: true,
        createdAt: true,
        authorUserId: true,
        author: { select: { id: true, handle: true, displayName: true } },
        options: { orderBy: { position: 'asc' }, select: { id: true, label: true, position: true, voteCount: true } },
      },
    });
    if (poll === null) throw ApiError.notFound();

    const access = await this.load(poll.communityId, userId);
    this.assertMember(access);
    if (await this.visibility.isSeparated(userId, poll.authorUserId)) throw ApiError.notFound();

    const myVotes = await this.prisma.pollVote.findMany({
      where: { userId, pollOption: { pollId: poll.id } },
      select: { pollOptionId: true, pollOption: { select: { pollId: true } } },
    });

    return { ...this.shapePoll(poll, myVotes), communityId: poll.communityId };
  }

  /**
   * « Un vote par membre (modifiable jusqu'à clôture) » (§2.3).
   *
   * Le vote est donc REMPLACÉ, pas ajouté : on efface les choix précédents et on
   * repose les nouveaux, dans une seule transaction, en ajustant les compteurs.
   * Un `create` simple ferait compter deux fois un membre qui change d'avis.
   */
  async vote(pollId: string, userId: string, optionIds: string[]) {
    const poll = await this.prisma.poll.findUnique({
      where: { id: pollId },
      select: {
        id: true,
        communityId: true,
        isMultiple: true,
        closesAt: true,
        options: { select: { id: true } },
      },
    });
    if (poll === null) throw ApiError.notFound();

    const access = await this.load(poll.communityId, userId);
    this.assertMember(access);

    if (poll.closesAt !== null && poll.closesAt.getTime() <= Date.now()) this.fail('POLL_CLOSED');
    if (!poll.isMultiple && optionIds.length > 1) {
      throw ApiError.validation([{ path: 'optionIds', code: 'TOO_BIG' }]);
    }

    const valid = new Set(poll.options.map((o) => o.id));
    const chosen = [...new Set(optionIds)];
    if (chosen.some((id) => !valid.has(id))) {
      throw ApiError.validation([{ path: 'optionIds', code: 'INVALID_OPTION' }]);
    }

    await this.prisma.$transaction(async (tx) => {
      const previous = await tx.pollVote.findMany({
        where: { userId, pollOption: { pollId: poll.id } },
        select: { id: true, pollOptionId: true },
      });

      const toRemove = previous.filter((v) => !chosen.includes(v.pollOptionId));
      const alreadyChosen = new Set(previous.map((v) => v.pollOptionId));
      const toAdd = chosen.filter((id) => !alreadyChosen.has(id));

      if (toRemove.length > 0) {
        await tx.pollVote.deleteMany({ where: { id: { in: toRemove.map((v) => v.id) } } });
        for (const vote of toRemove) {
          await tx.pollOption.update({
            where: { id: vote.pollOptionId },
            data: { voteCount: { decrement: 1 } },
          });
        }
      }
      for (const optionId of toAdd) {
        await tx.pollVote.create({ data: { id: newId(), pollOptionId: optionId, userId } });
        await tx.pollOption.update({
          where: { id: optionId },
          data: { voteCount: { increment: 1 } },
        });
      }
    });

    return this.poll(poll.id, userId);
  }

  /** Clôture. Le schéma n'a pas de colonne d'état : `closes_at = maintenant` la dit. */
  async closePoll(pollId: string, userId: string) {
    const poll = await this.prisma.poll.findUnique({
      where: { id: pollId },
      select: { id: true, communityId: true, authorUserId: true, closesAt: true },
    });
    if (poll === null) throw ApiError.notFound();

    const access = await this.load(poll.communityId, userId);
    const membership = this.assertMember(access);
    const isModerator = membership.role === 'OWNER' || membership.role === 'MODERATOR';
    if (poll.authorUserId !== userId && !isModerator) {
      throw ApiError.transverse('FORBIDDEN', { reason: 'AUTHOR_OR_MODERATOR_REQUIRED' });
    }
    if (poll.closesAt !== null && poll.closesAt.getTime() <= Date.now()) this.fail('POLL_CLOSED');

    await this.prisma.poll.update({ where: { id: poll.id }, data: { closesAt: new Date() } });
    return this.poll(poll.id, userId);
  }

  // ══ Albums (§2.3, §4) ═════════════════════════════════════════════════════

  async albums(idOrSlug: string, userId: string) {
    const access = await this.load(idOrSlug, userId);
    this.assertMember(access);

    const separated = await this.visibility.separatedFrom(userId);
    const albums = await this.prisma.album.findMany({
      where: { communityId: access.community.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        title: true,
        eventId: true,
        createdAt: true,
        createdBy: { select: { id: true, handle: true, displayName: true } },
        photos: {
          where: {
            deletedAt: null,
            ...(separated.length === 0 ? {} : { uploadedByUserId: { notIn: separated } }),
          },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            caption: true,
            mediaAssetId: true,
            createdAt: true,
            uploadedBy: { select: { id: true, handle: true } },
            mediaAsset: { select: { storageKey: true, status: true } },
          },
        },
      },
    });

    return {
      items: albums.map((a) => ({
        id: a.id,
        title: a.title,
        eventId: a.eventId,
        createdAt: a.createdAt,
        createdBy: a.createdBy,
        photoCount: a.photos.length,
        photos: a.photos.map((p) => ({
          id: p.id,
          caption: p.caption,
          uploadedBy: p.uploadedBy,
          createdAt: p.createdAt,
          // Une image encore en traitement n'a pas d'URL : le pipeline média
          // (module 00 §9.2, file `media`) ne tourne pas encore.
          url: p.mediaAsset.status === 'READY' ? `/media/${p.mediaAsset.storageKey}` : null,
        })),
      })),
      nextCursor: null,
    };
  }

  async createAlbum(
    idOrSlug: string,
    userId: string,
    input: { title: string; eventId?: string | undefined },
  ) {
    const access = await this.load(idOrSlug, userId);
    this.assertMember(access);
    this.assertWritable(access);

    if (input.eventId !== undefined) {
      // L'événement doit appartenir à CE réseau : un album rattaché à
      // l'événement d'un autre réseau y exposerait ses photos.
      const event = await this.prisma.event.findFirst({
        where: { id: input.eventId, communityId: access.community.id, deletedAt: null },
        select: { id: true },
      });
      if (event === null) throw ApiError.notFound();
    }

    const id = newId();
    await this.prisma.$transaction(async (tx) => {
      await tx.album.create({
        data: {
          id,
          communityId: access.community.id,
          eventId: input.eventId ?? null,
          title: input.title,
          createdByUserId: userId,
        },
      });
      await this.touch(tx, access.community.id);
    });

    return { id, title: input.title, eventId: input.eventId ?? null };
  }

  /** « Tout membre ajoute (L1) » (§2.3). */
  async addPhoto(
    albumId: string,
    userId: string,
    input: { mediaAssetId: string; caption?: string | undefined },
  ) {
    const album = await this.prisma.album.findUnique({
      where: { id: albumId },
      select: { id: true, communityId: true },
    });
    if (album === null) throw ApiError.notFound();

    const access = await this.load(album.communityId, userId);
    this.assertMember(access);
    this.assertWritable(access);

    // L'image doit appartenir à celui qui la pose : sans ce contrôle, un membre
    // pourrait afficher dans un album n'importe quelle image de la plateforme en
    // devinant son identifiant.
    const asset = await this.prisma.mediaAsset.findFirst({
      where: { id: input.mediaAssetId, ownerUserId: userId, deletedAt: null, kind: 'ALBUM' },
      select: { id: true },
    });
    if (asset === null) throw ApiError.notFound();

    const id = newId();
    await this.prisma.$transaction(async (tx) => {
      await tx.albumPhoto.create({
        data: {
          id,
          albumId,
          mediaAssetId: input.mediaAssetId,
          uploadedByUserId: userId,
          caption: input.caption ?? null,
        },
      });
      await this.touch(tx, album.communityId);
    });

    return { id, albumId, mediaAssetId: input.mediaAssetId };
  }

  /** « Propriétaire et modérateurs suppriment » (§2.3) — et celui qui a posé. */
  async deletePhoto(albumId: string, photoId: string, userId: string): Promise<void> {
    const photo = await this.prisma.albumPhoto.findFirst({
      where: { id: photoId, albumId, deletedAt: null },
      select: { id: true, uploadedByUserId: true, album: { select: { communityId: true } } },
    });
    if (photo === null) throw ApiError.notFound();

    const access = await this.load(photo.album.communityId, userId);
    const membership = this.assertMember(access);
    const isModerator = membership.role === 'OWNER' || membership.role === 'MODERATOR';
    if (!isModerator && photo.uploadedByUserId !== userId) {
      throw ApiError.transverse('FORBIDDEN', { reason: 'UPLOADER_OR_MODERATOR_REQUIRED' });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.albumPhoto.update({ where: { id: photo.id }, data: { deletedAt: new Date() } });
      if (isModerator && photo.uploadedByUserId !== userId) {
        await this.audit.record(tx, {
          actor: { type: 'MEMBER', id: userId },
          action: 'community.photo_removed',
          targetType: 'album_photo',
          targetId: photo.id,
          metadata: { communityId: photo.album.communityId },
        });
      }
    });
  }

  // ══ GET /communities/:id/map (§2.3, §4) ═══════════════════════════════════

  /**
   * Compteurs par ville des membres du réseau (§2.3).
   *
   * Des COMPTEURS, jamais des positions : règle dure 00 §1.2 — « aucune position
   * individuelle n'est collectée ». La maille est la ville, et rien de plus fin.
   */
  async map(idOrSlug: string, userId: string) {
    const access = await this.load(idOrSlug, userId);
    this.assertMember(access);

    const separated = await this.visibility.separatedFrom(userId);
    const excluded = separated.length === 0 ? ['00000000-0000-0000-0000-000000000000'] : separated;

    const rows = await this.prisma.$queryRaw<
      { cityId: string; name: string; slug: string; memberCount: bigint }[]
    >`
      SELECT c.id AS "cityId", c.name, c.slug, COUNT(*) AS "memberCount"
      FROM community_members m
      JOIN users u ON u.id = m.user_id
      JOIN cities c ON c.id = u.city_id
      WHERE m.community_id = ${access.community.id}::uuid
        AND m.status::text = 'ACTIVE'
        AND u.deleted_at IS NULL
        AND u.id <> ALL (${excluded}::uuid[])
      GROUP BY c.id, c.name, c.slug
      ORDER BY COUNT(*) DESC, c.name ASC
    `;

    return {
      items: rows.map((r) => ({
        cityId: r.cityId,
        name: r.name,
        slug: r.slug,
        memberCount: Number(r.memberCount),
      })),
    };
  }

  // ══ POST /communities/:id/reactivate (§2.2, §4) ═══════════════════════════

  async reactivate(idOrSlug: string, userId: string) {
    const access = await this.load(idOrSlug, userId);
    this.assertOwner(access);

    if (access.community.status !== 'ARCHIVED') {
      throw ApiError.transverse('CONFLICT', { reason: 'NOT_ARCHIVED' });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.community.update({
        where: { id: access.community.id },
        // `lastActivityAt` remis à maintenant : sans cela, la tâche
        // d'archivage rendormirait le réseau à son prochain passage.
        data: { status: 'ACTIVE', archivedAt: null, lastActivityAt: new Date() },
      });
      await this.audit.record(tx, {
        actor: { type: 'MEMBER', id: userId },
        action: 'community.reactivated',
        targetType: 'community',
        targetId: access.community.id,
      });
      await this.outbox.emit(tx, {
        type: 'community.reactivated',
        aggregateId: access.community.id,
        payload: { byUserId: userId },
      });
    });

    return this.detail(access.community.id, userId);
  }

  // ══ Tâches planifiées (§7) ════════════════════════════════════════════════

  /**
   * `community.archive_inactive` — quotidienne (§7).
   *
   * RÈGLE DURE (§9) : « un réseau d'intérêt sans activité depuis 60 jours est
   * archivé, JAMAIS un réseau automatique. » Le filtre `kind: 'INTEREST'` est
   * donc la moitié du travail : un réseau de ville sans un message depuis trois
   * mois reste le réseau de la ville, et l'archiver le retirerait de la liste de
   * tous ses habitants.
   */
  async archiveInactive(now = new Date()): Promise<{ archived: string[]; warned: string[] }> {
    const archiveBefore = new Date(now.getTime() - COMMUNITY_ARCHIVE_AFTER_DAYS * DAY_MS);
    const warnBefore = new Date(now.getTime() - COMMUNITY_ARCHIVE_WARNING_AFTER_DAYS * DAY_MS);

    const stale = await this.prisma.community.findMany({
      where: { kind: 'INTEREST', status: 'ACTIVE', lastActivityAt: { lt: archiveBefore } },
      select: { id: true, slug: true, createdByUserId: true },
    });

    for (const community of stale) {
      await this.prisma.$transaction(async (tx) => {
        await tx.community.update({
          where: { id: community.id },
          data: { status: 'ARCHIVED', archivedAt: now },
        });
        await this.audit.record(tx, {
          actor: { type: 'SYSTEM' },
          action: 'community.archived',
          targetType: 'community',
          targetId: community.id,
          metadata: { reason: 'INACTIVE', days: COMMUNITY_ARCHIVE_AFTER_DAYS },
        });
        await this.outbox.emit(tx, {
          type: 'community.archived',
          aggregateId: community.id,
          payload: { reason: 'INACTIVE', ownerUserId: community.createdByUserId },
        });
      });
    }

    // L'avertissement à 45 jours est IDENTIFIÉ mais pas notifié : §3 prévoit
    // `communities.warning_sent_at` pour ne prévenir qu'une fois, et cette
    // colonne n'existe pas dans le schéma figé. Sans elle, la tâche quotidienne
    // enverrait le même avertissement quinze jours de suite. Voir le rapport.
    const warned = await this.prisma.community.findMany({
      where: {
        kind: 'INTEREST',
        status: 'ACTIVE',
        lastActivityAt: { lt: warnBefore, gte: archiveBefore },
      },
      select: { id: true },
    });

    return { archived: stale.map((c) => c.id), warned: warned.map((c) => c.id) };
  }

  /** `community.topic_archive` — quotidienne : 90 jours sans réponse (§2.3, §7). */
  async archiveStaleTopics(now = new Date()): Promise<number> {
    const before = new Date(now.getTime() - TOPIC_ARCHIVE_AFTER_DAYS * DAY_MS);

    // Deux passes : `last_reply_at` quand il y a eu une réponse, `created_at`
    // sinon. Un OR sur une colonne nulle laisserait passer les sujets qui n'ont
    // JAMAIS reçu de réponse — exactement ceux que la règle visait.
    const withReplies = await this.prisma.topic.updateMany({
      where: { status: 'OPEN', deletedAt: null, lastReplyAt: { lt: before } },
      data: { status: 'ARCHIVED' },
    });
    const never = await this.prisma.topic.updateMany({
      where: { status: 'OPEN', deletedAt: null, lastReplyAt: null, createdAt: { lt: before } },
      data: { status: 'ARCHIVED' },
    });

    return withReplies.count + never.count;
  }

  /**
   * L'inscription des membres au réseau d'une ville ou d'un pays qui vient d'être
   * activé — 02 §2.2 : « les membres déjà rattachés y sont inscrits par événement ».
   *
   * Consommateur de `city.activated`, `country.activated` et `city.merged`. Les
   * trois posent la même question — « quels membres doivent voir leurs adhésions
   * automatiques recalculées ? » — et la réponse est la même fonction.
   *
   * ON RECALCULE, ON N'INSCRIT PAS. `syncAutoMemberships` compare l'état attendu à
   * l'état existant et corrige dans les deux sens ; c'est ce qui le rend rejouable
   * autant de fois qu'il faut, ce qu'un consommateur d'événement doit être. Une
   * boucle d'inscriptions, elle, créerait des doublons au second passage.
   *
   * MEMBRE PAR MEMBRE, et c'est assumé : une ville s'active vers vingt membres
   * (§2.2), et la correction d'une adhésion demande de regarder les DEUX réseaux du
   * membre — sa ville et son pays d'origine — ce qu'une requête d'ensemble ne sait
   * pas faire sans réécrire toute la logique une seconde fois. Le jour où une ville
   * s'active avec dix mille membres, c'est le lot qu'il faudra revoir, pas la règle.
   *
   * Un échec sur un membre N'ARRÊTE PAS les autres, mais il est compté et la
   * méthode LÈVE à la fin : le travail sera rejoué, et le rejeu est sans effet sur
   * ceux qui étaient déjà corrects. Sans cette levée, BullMQ marquerait le travail
   * fait et les membres restants ne seraient jamais inscrits.
   */
  async handleLocationActivated(input: {
    cityId?: string;
    countryId?: string;
  }): Promise<{ scanned: number; joined: number; left: number; failed: number }> {
    const where =
      input.cityId !== undefined
        ? { cityId: input.cityId }
        : input.countryId !== undefined
          ? { originCountryId: input.countryId }
          : null;
    if (where === null) return { scanned: 0, joined: 0, left: 0, failed: 0 };

    const members = await this.prisma.user.findMany({
      where: { ...where, deletedAt: null, status: 'ACTIVE' },
      select: { id: true },
    });

    let joined = 0;
    let left = 0;
    let failed = 0;
    for (const member of members) {
      try {
        const result = await this.syncAutoMemberships(member.id);
        joined += result.joined.length;
        left += result.left.length;
      } catch (error) {
        failed += 1;
        this.logger.error(
          `adhésion automatique impossible pour ${member.id} : ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    if (failed > 0) {
      throw new Error(
        `${failed} membre(s) sur ${members.length} n’ont pas pu être inscrits : le travail sera rejoué.`,
      );
    }
    return { scanned: members.length, joined, left, failed };
  }

  /** `community.member_count_recompute` — quotidienne (§7). */
  async recomputeMemberCounts(): Promise<number> {
    const updated = await this.prisma.$executeRaw`
      UPDATE communities c
      SET member_count = sub.total
      FROM (
        SELECT co.id, COUNT(u.id) AS total
        FROM communities co
        LEFT JOIN community_members m
          ON m.community_id = co.id
         AND m.status::text = 'ACTIVE'
        LEFT JOIN users u ON u.id = m.user_id AND u.deleted_at IS NULL
        GROUP BY co.id
      ) AS sub
      WHERE c.id = sub.id AND c.member_count <> sub.total
    `;
    return updated;
  }
}
