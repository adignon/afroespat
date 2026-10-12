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
  type CreateAnnouncement,
  type CreateCommunity,
  type CreatePoll,
  type CreateTopic,
  type InviteMembers,
  type MemberListQuery,
  type Page,
  TOPIC_ARCHIVE_AFTER_DAYS,
  TOPIC_EDIT_WINDOW_MINUTES,
  TOPIC_UNHIDE_WINDOW_DAYS,
  type TopicListQuery,
  type UpdateCommunity,
  type UpdateMember,
  type UpdateTopic,
} from '@app/shared';
import { ApiError } from '../../common/api-error';
import { AuditService } from '../../common/audit.service';
import { buildPage, decodeCursor } from '../../common/cursor';
import { REQUIRED_MEDIA_STATUS, ownedAttachableWhere } from '../../common/media-attachment';
import { OutboxService } from '../../common/outbox.service';
import { PrismaService } from '../../common/prisma.service';
import { VisibilityService } from '../../common/visibility.service';
import { loadEnv } from '../../config/env';
/**
 * LA MESSAGERIE EST APPELÉE, PAS RÉIMPLÉMENTÉE.
 *
 * Un seul geste de ce module ouvre une conversation — « Contacter les
 * modérateurs » — et il la DÉLÈGUE : la forme d'un fil, ses membres, son
 * idempotence appartiennent au module 08. Le sens de la dépendance est le bon et
 * ne boucle pas : `MessagingService` dépend de `ConnectionsService`, qui ne
 * dépend d'aucun des deux (vérifié dans son constructeur).
 */
import { MessagingService } from '../messaging/messaging.service';

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
    coverAsset: { select: { storageKey: true; deletedAt: true } };
    memberCount: true;
    status: true;
    lastActivityAt: true;
    archivedAt: true;
    createdAt: true;
    postsRequireApproval: true;
    pollsOpenToMembers: true;
    albumOpenToMembers: true;
    rules: true;
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
  /**
   * LA CLÉ DE STOCKAGE DE LA COUVERTURE, pour composer `coverUrl` — voir
   * `publicShape`. L'identifiant seul (`coverAssetId`) ne s'affiche pas : la
   * route `/media/<clé>` attend la CLÉ, qui porte un segment aléatoire.
   */
  coverAsset: { select: { storageKey: true, deletedAt: true } },
  memberCount: true,
  status: true,
  lastActivityAt: true,
  archivedAt: true,
  createdAt: true,
  postsRequireApproval: true,
  pollsOpenToMembers: true,
  albumOpenToMembers: true,
  rules: true,
} as const;

/**
 * `muted` EST DANS LA MEMBERSHIP PARCE QUE `load()` LA CHARGE DÉJÀ.
 *
 * Toute route du module passe par `load()`, qui lit la ligne d'adhésion du
 * lecteur ; ajouter la colonne au `select` ne coûte aucune requête, et c'est ce
 * qui permet à `detail()` de rendre `myMuted` sans en faire une seconde.
 */
type Membership = {
  id: string;
  role: string;
  status: string;
  joinedAt: Date | null;
  muted: boolean;
};

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
    private readonly messaging: MessagingService,
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
      select: { id: true, role: true, status: true, joinedAt: true, muted: true },
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
      /**
       * `warningSentAt` EST EFFACÉ PAR TOUTE ACTIVITÉ, et c'est la moitié du
       * mécanisme d'avertissement (§2.2, §7).
       *
       * L'horodatage sert à ne prévenir QU'UNE FOIS par endormissement — la
       * tâche est quotidienne, et sans mémoire elle enverrait le même
       * avertissement les quinze jours qui séparent le 45e du 60e. Mais s'il
       * n'était jamais effacé, un réseau qui reprend vie puis se rendort deux
       * mois plus tard ne serait PLUS JAMAIS prévenu : il serait archivé sans
       * préavis, ce que §2.2 promet justement d'éviter.
       *
       * Il est donc remis à `null` exactement là où `lastActivityAt` repart :
       * les deux colonnes décrivent le même endormissement, elles doivent être
       * réinitialisées ensemble ou pas du tout.
       */
      data: { lastActivityAt: new Date(), warningSentAt: null },
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
        /** §2.5 — la pastille « En sourdine » des cartes de « Mes réseaux ». */
        muted: true,
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
        muted: m.muted,
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

  /**
   * LA COUVERTURE D'UN RÉSEAU EST UN MÉDIA DE SON PROPRIÉTAIRE, PRÊT.
   *
   * `create` et `update` recopiaient `coverAssetId` tel quel : n'importe quel
   * identifiant de média passait — celui d'un autre membre, ou un justificatif
   * (`PROOF`, « jamais affiché ») qu'on aurait ainsi exposé en bandeau. C'est
   * exactement le trou que `events.service.ts` a refermé pour ses couvertures,
   * et c'est le même contrôle : `ownedAttachableWhere('eventCover', …)`, car
   * l'énumération de 00 §6.3 n'a pas de `COMMUNITY_COVER` et le réseau emprunte
   * `EVENT_COVER` (voir `media-attachment.ts`).
   *
   * 404 pour un média étranger ou d'un autre genre (indistinguable d'un média
   * absent), 400 `MEDIA_NOT_READY` pour un fichier encore en analyse.
   */
  private async assertOwnedCover(userId: string, coverAssetId: string): Promise<void> {
    const asset = await this.prisma.mediaAsset.findFirst({
      where: { id: coverAssetId, ...ownedAttachableWhere('eventCover', userId) },
      select: { status: true },
    });
    if (asset === null) throw ApiError.notFound();
    if (asset.status !== REQUIRED_MEDIA_STATUS) {
      throw ApiError.validation([{ path: 'coverAssetId', code: 'MEDIA_NOT_READY' }]);
    }
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
      /**
       * L'ADRESSE DE LA COUVERTURE, `/media/<clé>` — la forme que rendent déjà
       * les événements (`events.service.ts`, `mediaUrl`) et la messagerie. Sans
       * elle, le bandeau du réseau ne pouvait rien afficher : la fiche ne portait
       * que l'identifiant. Un média supprimé rend `null`, et le bandeau retombe
       * sur sa teinte dessinée plutôt que sur une image cassée.
       */
      coverUrl:
        c.coverAsset === null || c.coverAsset.deletedAt !== null
          ? null
          : `/media/${c.coverAsset.storageKey}`,
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
      /**
       * MA sourdine (§2.5). `false` pour un passant, et ce n'est pas un défaut
       * de forme : la question « ce réseau me notifie-t-il ? » a toujours une
       * réponse, là où « quel est mon rôle ? » n'en a pas. Voir
       * `communityDetailResponseSchema`.
       *
       * ⚠ ELLE EST LUE MÊME POUR UN MEMBRE NON ACTIF (`INVITED`, `PENDING`) :
       * `membership?.muted` et non `isMember && …`. Un invité qui met le réseau
       * en sourdine avant d'accepter garde sa préférence, et la lui cacher
       * rallumerait le bouton à ses yeux sans rien changer en base.
       */
      myMuted: membership?.muted ?? false,
      rules: community.rules,
      settings: {
        postsRequireApproval: community.postsRequireApproval,
        pollsOpenToMembers: community.pollsOpenToMembers,
        albumOpenToMembers: community.albumOpenToMembers,
      },
      team: await this.team(community.id, userId),
      stats:
        isMember && (membership.role === 'OWNER' || membership.role === 'MODERATOR')
          ? await this.stats(community.id)
          : null,
      counters: { members: community.memberCount, topics: topicCount, announcements: announcementCount },
      pinned,
    };
  }

  /**
   * LES DEUX TUILES DE « GÉRER », pour l'équipe — voir `communityDetailResponseSchema.stats`.
   *
   * L'activité est comptée sur les deux écritures qui FONT la vie d'un réseau :
   * une publication dans son fil, un sujet ouvert. Les commentaires et les
   * réactions n'y sont pas — elles se comptent mal par réseau (un commentaire
   * vise une publication, pas un réseau) et la tuile dit « actifs », pas
   * « présents ».
   */
  private async stats(communityId: string) {
    const maintenant = new Date();
    const debutMois = new Date(Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth(), 1));
    const il30Jours = new Date(maintenant.getTime() - 30 * 86_400_000);
    const [joinedThisMonth, auteurs, ouvreurs] = await Promise.all([
      this.prisma.communityMember.count({
        where: { communityId, status: 'ACTIVE', joinedAt: { gte: debutMois } },
      }),
      this.prisma.post.findMany({
        where: { communityId, createdAt: { gte: il30Jours }, deletedAt: null },
        select: { authorUserId: true },
        distinct: ['authorUserId'],
      }),
      this.prisma.topic.findMany({
        where: { communityId, createdAt: { gte: il30Jours }, deletedAt: null },
        select: { authorUserId: true },
        distinct: ['authorUserId'],
      }),
    ]);
    const actifs = new Set([...auteurs, ...ouvreurs].map((r) => r.authorUserId));
    const membres = await this.prisma.communityMember.count({
      where: { communityId, status: 'ACTIVE', userId: { in: [...actifs] } },
    });
    return { joinedThisMonth, activeLast30Days: membres };
  }

  /**
   * L'ÉQUIPE DU RÉSEAU — propriétaire puis modérateurs, ACTIFS seulement.
   *
   * Pour la carte « ÉQUIPE » de l'onglet « À propos », que la planche dessine
   * pour TOUT lecteur, passant compris : c'est elle qui dit à qui « Contacter
   * les modérateurs » écrit. Les comptes séparés du lecteur (blocage) en sont
   * retirés, comme partout ailleurs dans ce module.
   *
   * BORNÉE à douze : la planche en dessine trois, et une équipe plus nombreuse
   * se lit dans l'onglet « Membres », filtre « Modérateurs ».
   */
  private async team(communityId: string, viewerId: string) {
    const separated = await this.visibility.separatedFrom(viewerId);
    const rows = await this.prisma.communityMember.findMany({
      where: {
        communityId,
        status: 'ACTIVE',
        role: { in: ['OWNER', 'MODERATOR'] },
        user: { deletedAt: null },
        ...(separated.length === 0 ? {} : { userId: { notIn: separated } }),
      },
      orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
      take: 12,
      select: {
        role: true,
        user: {
          select: {
            id: true,
            handle: true,
            displayName: true,
            avatarAsset: { select: { storageKey: true } },
          },
        },
      },
    });
    return rows.map((m) => ({
      userId: m.user.id,
      handle: m.user.handle,
      displayName: m.user.displayName,
      avatarUrl: m.user.avatarAsset === null ? null : `/media/${m.user.avatarAsset.storageKey}`,
      role: m.role,
    }));
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
    if (input.coverAssetId !== undefined) await this.assertOwnedCover(userId, input.coverAssetId);
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
          /**
           * QUI A INVITÉ — §3, `community_members.invited_by_user_id`.
           *
           * C'est le CRÉATEUR, et c'est le seul endroit du module où l'inviteur
           * est connu sans ambiguïté : §2.2 exige cinq invitations À LA
           * CRÉATION, et il n'y a qu'une personne pour les envoyer.
           */
          invitedByUserId: userId,
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

  /**
   * ╔════════════════════════════════════════════════════════════════════════╗
   * ║ DEUX CERCLES D'ÉCRITURE — LE PROPRIÉTAIRE, ET L'ÉQUIPE                 ║
   * ╚════════════════════════════════════════════════════════════════════════╝
   *
   * Ce qui FAIT le réseau — son nom, sa catégorie, sa visibilité, sa
   * couverture — reste au propriétaire (§2.2). Ce qui le FAIT VIVRE — sa
   * description, ses règles, les trois interrupteurs de « Gérer » — est ouvert
   * aux modérateurs : le porteur l'a demandé (« À propos vu modérateur : les
   * champs ne sont pas modifiables »), et un réseau AUTOMATIQUE n'a pas de
   * propriétaire du tout (§2.1) — sans cela personne n'y écrirait jamais rien.
   *
   * ── UN RÉSEAU AUTOMATIQUE REFUSE LES CHAMPS QUI LE DÉFINISSENT ───────────
   *
   * Il refusait TOUT, y compris sa description. La planche d'édition l'écrit
   * pourtant : « Catégorie et visibilité sont fixées pour un réseau
   * automatique de pays » — c'est-à-dire que le RESTE ne l'est pas. Le refus
   * `AUTO_COMMUNITY_IMMUTABLE` ne porte donc plus que sur le nom, la catégorie
   * et la visibilité, qui sont dérivés de la ville ou du pays.
   *
   * ── LA VISIBILITÉ CHANGE CE QUE LA RECHERCHE A LE DROIT DE MONTRER ───────
   *
   * Un réseau passé « Sur invitation » ne doit plus laisser filtrer ses sujets
   * ni ses événements (§9, règle dure) ; un réseau rouvert doit réapparaître.
   * La cascade est celle de l'archivage — `reindexCommunityChildren` — portée
   * par un événement d'outbox dans la MÊME transaction que l'écriture.
   */
  async update(idOrSlug: string, userId: string, patch: UpdateCommunity) {
    const access = await this.load(idOrSlug, userId);
    const fondateur =
      patch.name !== undefined ||
      patch.category !== undefined ||
      patch.visibility !== undefined ||
      patch.coverAssetId !== undefined;
    if (fondateur) this.assertOwner(access);
    else this.assertModerator(access);
    this.assertWritable(access);
    if (patch.coverAssetId !== undefined && patch.coverAssetId !== null) {
      await this.assertOwnedCover(userId, patch.coverAssetId);
    }

    const automatique = AUTO_KINDS.includes(access.community.kind as 'CITY' | 'COUNTRY');
    if (
      automatique &&
      (patch.name !== undefined || patch.category !== undefined || patch.visibility !== undefined)
    ) {
      throw ApiError.transverse('FORBIDDEN', { reason: 'AUTO_COMMUNITY_IMMUTABLE' });
    }

    const data: Prisma.CommunityUncheckedUpdateInput = {};
    if (patch.name !== undefined) data.name = patch.name;
    if (patch.description !== undefined) data.description = patch.description;
    if (patch.category !== undefined) data.category = patch.category;
    if (patch.visibility !== undefined) data.visibility = patch.visibility;
    if (patch.coverAssetId !== undefined) data.coverAssetId = patch.coverAssetId;
    if (patch.rules !== undefined) data.rules = patch.rules;
    if (patch.postsRequireApproval !== undefined) {
      data.postsRequireApproval = patch.postsRequireApproval;
    }
    if (patch.pollsOpenToMembers !== undefined) data.pollsOpenToMembers = patch.pollsOpenToMembers;
    if (patch.albumOpenToMembers !== undefined) data.albumOpenToMembers = patch.albumOpenToMembers;

    const visibiliteChangee =
      patch.visibility !== undefined && patch.visibility !== access.community.visibility;

    await this.prisma.$transaction(async (tx) => {
      await tx.community.update({ where: { id: access.community.id }, data });
      await this.audit.record(tx, {
        actor: { type: 'MEMBER', id: userId },
        action: 'community.updated',
        targetType: 'community',
        targetId: access.community.id,
        metadata: { fields: Object.keys(data) },
      });
      if (visibiliteChangee) {
        await this.outbox.emit(tx, {
          type: 'community.visibility_changed',
          aggregateId: access.community.id,
          payload: { from: access.community.visibility, to: patch.visibility },
        });
      }
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
          /**
           * L'APPELANT, et non le propriétaire du réseau (§3).
           *
           * Sur un réseau `PUBLIC` ou `ON_REQUEST`, N'IMPORTE QUEL membre invite
           * — `assertMember`, pas `assertModerator`. La colonne doit donc porter
           * celui qui a tapé le handle : écrire le propriétaire ferait dire au
           * journal qu'il a invité des gens qu'il n'a jamais nommés.
           */
          invitedByUserId: userId,
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
          /**
           * LE PSEUDO OU LE NOM AFFICHÉ. §2.3 écrit « recherche par handle »,
           * mais l'onglet « Membres » n'affiche QUE des noms — « Aïcha Diop »,
           * jamais « @aicha-d » — et le porteur tapait ce qu'il voyait : « la
           * recherche ne marche pas ». Chercher dans les deux colonnes rend le
           * champ fidèle à ce que la liste montre.
           */
          ...(query.q === undefined
            ? {}
            : {
                OR: [
                  { handle: { contains: query.q, mode: 'insensitive' as const } },
                  { displayName: { contains: query.q, mode: 'insensitive' as const } },
                ],
              }),
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

  // ══ POST /communities/:id/moderators-conversation ═════════════════════════

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ « CONTACTER LES MODÉRATEURS » — LE SEUL POINT D'ENTRÉE DE CE MODULE      ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Les deux boutons de la planche « À propos » (A08T, 1036 px et 390 px)
   * n'avaient AUCUNE route : §2.4 décrit ce que les modérateurs font AU membre —
   * masquer, retirer, épingler, clore — et jamais comment un membre leur parle.
   *
   * CE N'EST PAS UN SIGNALEMENT, et c'est la distinction à tenir : la planche
   * dessine « Signaler le réseau » JUSTE À CÔTÉ, et `POST /reports` (13 §8.1) le
   * sert déjà. Celui-là va à l'équipe de la PLATEFORME, ouvre un
   * `moderation_case`, peut suspendre un compte, et exige `report.create` (L2).
   * Celui-ci va aux bénévoles d'UN réseau, n'ouvre aucun dossier, ne confère
   * aucun pouvoir de sanction, et se contente de `content.read` (L0) — demander
   * une règle à l'équipe de son réseau de ville ne doit rien exiger.
   *
   * ── CE QUE CE MODULE FAIT, ET CE QU'IL DÉLÈGUE ───────────────────────────
   *
   * Il fait ce que lui seul sait faire : appliquer la visibilité du §2.2 par
   * `load()` — « toute route de ce module passe par ici, c'est volontairement la
   * seule porte » —, exiger l'adhésion ACTIVE, refuser un réseau archivé, et
   * LIRE L'ÉQUIPE. La conversation, elle, appartient à la messagerie : c'est
   * `MessagingService.ensureCommunityModerationConversation` qui la crée, la
   * retrouve et resynchronise ses membres. Recopier ici la moindre ligne de
   * messagerie donnerait deux endroits où un fil de modération peut naître.
   *
   * ── L'ADHÉSION ACTIVE EST EXIGÉE, ET C'EST UN ARBITRAGE ──────────────────
   *
   * `assertMember` et non « n'importe quel lecteur de la fiche ». §2.3 réserve le
   * contenu d'un réseau à ses membres, et un fil avec l'équipe EST du contenu de
   * réseau. Un candidat `PENDING` ou un passant qui a un problème avec le réseau
   * a déjà `POST /reports`, qui ne demande aucune adhésion. Le refus est le
   * `403 NOT_A_MEMBER` que l'écran sait déjà lire (`contenuFerme`).
   *
   * ── UN RÉSEAU ARCHIVÉ EST EN LECTURE SEULE ───────────────────────────────
   *
   * `assertWritable`, comme pour un sujet ou une annonce (§2.2). Ouvrir un fil
   * avec l'équipe d'un réseau archivé demanderait une réponse à des bénévoles
   * que l'archivage a précisément libérés.
   *
   * ── LA BORNE : `@RateLimit` ET AUCUN QUOTA MÉTIER ────────────────────────
   *
   * Choisi en connaissance de cause, et l'en-tête de `@RateLimit` donne le
   * critère : la limite de débit protège la minute, un quota métier compte des
   * LIGNES CRÉÉES. Or ce geste est IDEMPOTENT par construction — un seul fil par
   * (réseau, demandeur), tenu par un index unique en base — donc le rejouer ne
   * crée aucune ligne, et il n'y a rien à compter. Ce qu'un quota journalier
   * aurait borné, l'unicité le borne déjà, et mieux : exactement.
   *
   * Ce qui reste à protéger est la RAFALE — un bouton martelé, ou un script qui
   * parcourt les réseaux d'un membre — et c'est le rôle du décorateur. Le FLOOD,
   * lui, est déjà tenu là où il se produit : les messages passent par
   * `sendMessage` et ses 60 par minute (§5.3).
   */
  async openModeratorsConversation(idOrSlug: string, userId: string) {
    const access = await this.load(idOrSlug, userId);
    this.assertMember(access);
    this.assertWritable(access);

    /**
     * LE PROPRIÉTAIRE **ET** LES MODÉRATEURS, en une requête — et `status:
     * 'ACTIVE'` sur les deux.
     *
     * Un modérateur `PENDING` ou `BANNED` n'est pas un modérateur : la colonne
     * `role` survit au changement de `status`, donc filtrer sur le rôle seul
     * aurait mis dans le fil quelqu'un que le réseau a retiré. C'est le même
     * filtre que `members()` applique.
     *
     * `user: { deletedAt: null }` : §11 supprime le compte, pas la ligne
     * d'adhésion tout de suite. Un compte supprimé dans la liste aurait donné un
     * destinataire qui ne lira jamais — et `recipients` l'aurait compté.
     */
    const equipe = await this.prisma.communityMember.findMany({
      where: {
        communityId: access.community.id,
        status: 'ACTIVE',
        role: { in: ['OWNER', 'MODERATOR'] },
        user: { deletedAt: null },
      },
      select: { userId: true },
    });

    return this.messaging.ensureCommunityModerationConversation({
      communityId: access.community.id,
      communityName: access.community.name,
      requesterUserId: userId,
      teamUserIds: equipe.map((m) => m.userId),
    });
  }

  // ══ PATCH /communities/:id/members/:userId (§2.4, §4) ═════════════════════

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LA SOURDINE — §2.5, ET LES QUATRE DÉCISIONS QU'ELLE A DEMANDÉES         ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * « Un membre peut mettre un réseau en sourdine : plus de notifications, le
   * réseau reste dans sa liste. » C'est tout ce que la spécification dit, et
   * chacune des quatre décisions ci-dessous comble un silence :
   *
   * 1. SUR SON PROPRE RANG SEULEMENT (`MUTE_SELF_ONLY`). §4 écrit « `muted`
   *    (soi-même) » et c'est sans appel : aucun rôle ne donne le droit de faire
   *    taire un réseau pour quelqu'un d'autre. Un propriétaire qui le pourrait
   *    aurait un moyen de couper les notifications d'un membre sans le bannir
   *    ni le prévenir — c'est-à-dire de l'exclure en silence, ce que §2.4 ne lui
   *    donne pas.
   *
   * 2. AUCUNE LIGNE D'AUDIT. §2.4 exige la trace de « toute action de
   *    MODÉRATION de réseau » ; se choisir le silence n'en est pas une. Une
   *    ligne par bascule remplirait un journal conservé cinq ans de réglages
   *    personnels, et noierait les bannissements qu'on y cherche.
   *
   * 3. AUCUN `assertWritable`. On met en sourdine un réseau ARCHIVÉ : il reste
   *    dans sa liste (§2.2 : « lecture seule »), et la lecture seule porte sur
   *    son CONTENU, pas sur les préférences de notification de ses membres. Le
   *    refuser enfermerait le membre dans les notifications d'un réseau mort.
   *
   * 4. TOUT STATUT D'ADHÉSION SUFFIT, pas seulement `ACTIVE`. Un `INVITED` reçoit
   *    déjà des notifications du réseau — c'est même ce qu'est une invitation —
   *    et doit donc pouvoir les couper. `assertMember` l'aurait refusé ; on
   *    exige seulement une LIGNE d'adhésion, parce que c'est elle qui porte la
   *    colonne.
   *
   * ⚠ EN REVANCHE, PAS DE LIGNE = 404. Mettre en sourdine un réseau qu'on n'a
   * pas rejoint n'a nulle part où s'écrire, et créer une adhésion fantôme pour
   * l'occasion mettrait dans `community_members` des lignes que personne n'a
   * demandées — qui compteraient dans la liste des membres.
   */
  private async setMuted(
    access: Access,
    actorId: string,
    targetUserId: string,
    muted: boolean,
  ) {
    if (targetUserId !== actorId) this.fail('MUTE_SELF_ONLY');

    const membership = access.membership;
    if (membership === null) throw ApiError.notFound();

    // Idempotent : reposer la même valeur ne touche pas `updated_at` pour rien.
    if (membership.muted !== muted) {
      await this.prisma.communityMember.update({
        where: { id: membership.id },
        data: { muted },
      });
    }

    return { userId: targetUserId, role: membership.role, status: membership.status, muted };
  }

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ RÔLE, BANNISSEMENT — ET LA SOURDINE, QUI N'EST PAS DU MÊME ORDRE        ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Toute action de MODÉRATION est journalisée avec `actor_type = MEMBER`
   * (§2.4) : un modérateur bénévole n'est pas l'équipe, et le journal doit le
   * dire.
   *
   * ── LES DEUX GESTES DE CETTE ROUTE, ET POURQUOI ILS NE SE MÊLENT PAS ──────
   *
   * §4 met les trois champs dans la même ligne du tableau — « `role`, `status`
   * (BANNED), `muted` (soi-même) » — donc la route est partagée. Elle porte
   * pourtant DEUX gestes de nature différente, et le service les sépare AVANT
   * la garde de modération :
   *
   *   · `muted` est une PRÉFÉRENCE PERSONNELLE (§2.5). N'IMPORTE QUEL membre la
   *     pose, et seulement sur SON propre rang. Il n'y a rien à journaliser :
   *     personne n'exerce de pouvoir sur personne, et une ligne d'`audit_logs`
   *     par silence choisi noierait les vraies actions de modération dans un
   *     journal conservé cinq ans.
   *   · `role` et `status` sont de la MODÉRATION. Modérateur exigé, propriétaire
   *     pour les rôles, et ligne d'audit obligatoire.
   *
   * ⚠ `assertModerator` NE PEUT DONC PLUS ÊTRE LA PREMIÈRE LIGNE. Il l'était, et
   * c'est ce qui aurait rendu la sourdine inatteignable pour un membre
   * ordinaire — c'est-à-dire pour la quasi-totalité de ceux qu'elle concerne.
   *
   * ⚠ UN CORPS QUI MÊLE LES DEUX EST REFUSÉ (`MUTE_ALONE`) plutôt que départagé.
   * Deux raisons, et la seconde est la vraie : les deux gestes n'ont pas le même
   * acteur légitime, et une seule requête ne peut pas produire une ligne d'audit
   * honnête quand elle est à la fois un acte de modération et un réglage
   * personnel. Mieux vaut un refus lisible qu'une trace qui mentirait.
   /**
   * ║ LA CIBLE D'UN GESTE DE MODÉRATION, ET LES TROIS REFUS QUI LA PROTÈGENT   ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Extraite de `updateMember` quand « retirer » est devenu un geste distinct du
   * bannissement : les deux routes doivent appliquer EXACTEMENT les mêmes refus,
   * et deux copies de trois `if` divergent toujours. La première version de ce
   * lot avait justement oublié `OWNER_IMMUTABLE` sur la route de retrait — le
   * propriétaire se serait retiré lui-même du réseau qu'il est seul à pouvoir
   * modérer, ce que `leave()` refuse déjà pour la même raison (§2.2).
   *
   * `assertModerator` et `assertWritable` restent chez l'appelant : ils portent
   * sur le RÉSEAU, pas sur la cible, et `load()` doit les avoir faits avant.
   */
  private async moderationTarget(
    access: Access,
    actor: Membership,
    targetUserId: string,
  ): Promise<{ id: string; role: string; status: string; muted: boolean }> {
    const target = await this.prisma.communityMember.findUnique({
      where: { communityId_userId: { communityId: access.community.id, userId: targetUserId } },
      /**
       * `muted` EST LU ICI parce que `updateMember` en a besoin, et qu'il partage
       * cette cible avec le retrait et le bannissement depuis l'extraction. Le
       * retirer du `select` a cassé la bascule de sourdine à la fusion : deux lots
       * avaient touché cette méthode sans se voir, et c'est le typage qui l'a dit.
       */
      select: { id: true, role: true, status: true, muted: true },
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
    return target;
  }

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ RETIRER — L'ADHÉSION DISPARAÎT, ET LA PERSONNE PEUT REVENIR              ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * ARBITRAGE DU PORTEUR, mot pour mot : « Retirer, il peut rejoindre à nouveau.
   * Mais banni, il ne peut plus rejoindre. »
   *
   * La maquette dessinait DEUX entrées dans le menu d'une ligne de membre —
   * « Retirer du réseau » et « Bannir du réseau » — et un lot précédent les avait
   * branchées toutes les deux sur le bannissement, parce que §2.4 ne décrit que
   * celui-là (« retirer un membre (`BANNED` : ne peut plus rejoindre) »). La
   * maquette avait raison ; c'est la spécification qui est incomplète.
   *
   * ── CE GESTE IMITE `leave()`, IL NE L'INVENTE PAS ──────────────────────────
   *
   * `leave()` passe par `removeMembership(…, 'community.member_left')`, qui
   * SUPPRIME la ligne — par opposition au bannissement, qui la garde en `BANNED`
   * puisque c'est elle qui interdit de revenir. Retirer fait donc exactement ce
   * que `leave` fait, par la main d'un modérateur : même méthode, même
   * événement, et `self: true` en moins — remplacé par `byUserId`, qui dit qui a
   * agi. Un consommateur de `community.member_left` n'a ainsi rien de nouveau à
   * apprendre.
   *
   * ── ⚠ SUR UN RÉSEAU DE VILLE OU DE PAYS, LE RETRAIT NE TIENT PAS ──────────
   *
   * Et il faut le dire plutôt que de le laisser découvrir : `syncAutoMemberships`
   * RECALCULE l'adhésion d'un membre à son réseau de ville et de pays à chaque
   * `GET /communities`, et n'épargne que les BANNIS. Un membre retiré d'un réseau
   * automatique y revient donc au prochain chargement de sa liste — ce qui est
   * cohérent avec §2.1 (« on ne quitte pas un réseau automatique : l'adhésion est
   * une conséquence du profil ») mais rend le geste sans effet durable là. Sur un
   * réseau automatique, seul le bannissement écarte vraiment. REMONTÉ.
   *
   * On ne REFUSE pas pour autant : rien dans l'arbitrage ne le demande, et un
   * modérateur de réseau de ville a le droit du §2.4. Il voit simplement la
   * personne revenir, ce qui est la vérité de ce réseau-là.
   */
  async removeMember(idOrSlug: string, actorId: string, targetUserId: string): Promise<void> {
    const access = await this.load(idOrSlug, actorId);
    const actor = this.assertModerator(access);
    this.assertWritable(access);

    const target = await this.moderationTarget(access, actor, targetUserId);

    await this.removeMembership(access.community.id, targetUserId, 'community.member_left', {
      byUserId: actorId,
    });

    /**
     * SA PROPRE LIGNE D'AUDIT, et c'est §2.4 qui l'exige : « toute action de
     * modération de réseau est journalisée ». Deux gestes aux conséquences
     * opposées — l'un réversible, l'autre non — qui s'écriraient
     * `community.member_banned` tous les deux rendraient le journal incapable de
     * dire lequel a eu lieu. C'est précisément ce qu'un journal conservé cinq ans
     * sert à savoir.
     *
     * HORS TRANSACTION, comme le bannissement juste en dessous : la ligne
     * d'adhésion vient d'être SUPPRIMÉE par `removeMembership`, et `targetId`
     * désigne une ligne qui n'existe plus. Écrire dans la même transaction ne
     * changerait rien à cela — `audit_logs` n'a pas de clé étrangère vers
     * `community_members` — et imposerait de démonter `removeMembership`.
     */
    await this.audit.record(this.prisma, {
      actor: { type: 'MEMBER', id: actorId },
      action: 'community.member_removed',
      targetType: 'community_member',
      targetId: target.id,
      metadata: { communityId: access.community.id, userId: targetUserId, reversible: true },
    });
  }

  /**
   * Rôle et bannissement. Toute action est journalisée avec
   * `actor_type = MEMBER` (§2.4) : un modérateur bénévole n'est pas l'équipe, et
   * le journal doit le dire.
   *
   * RETIRER N'EST PLUS ICI : voir `removeMember` et son en-tête. `status` ne
   * porte donc que deux valeurs, `ACTIVE` et `BANNED`.
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

    if (patch.muted !== undefined) {
      if (patch.role !== undefined || patch.status !== undefined) this.fail('MUTE_ALONE');
      return this.setMuted(access, actorId, targetUserId, patch.muted);
    }

    const actor = this.assertModerator(access);
    this.assertWritable(access);

    const target = await this.moderationTarget(access, actor, targetUserId);

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
        // `reversible: false` fait pendant au `true` de `community.member_removed` :
        // les deux gestes se lisent côte à côte dans le journal, et la différence
        // que le porteur a tranchée y est écrite plutôt que déduite du nom.
        metadata: { communityId: access.community.id, userId: targetUserId, reversible: false },
      });
      /**
       * `muted` EST CELUI D'AVANT LE BANNISSEMENT, et il est servi quand même :
       * la réponse décrit l'état APRÈS, et la sourdine n'a pas bougé. Le
       * bannissement ne la touche pas — `removeMembership` ne lit pas cette
       * colonne — et affirmer `false` serait inventer un changement.
       */
      return { userId: targetUserId, role: 'MEMBER', status: 'BANNED', muted: target.muted };
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
    return {
      userId: targetUserId,
      role: after?.role ?? null,
      status: after?.status ?? null,
      muted: after?.muted ?? false,
    };
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
   *
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ UN SUJET MASQUÉ EST RENDU — AUX MODÉRATEURS DU RÉSEAU, ET À EUX SEULS    ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Le filtre `deletedAt: null` était ici, et il fermait la seule porte par
   * laquelle revenir sur une erreur de clic : le modérateur qui venait de masquer
   * recevait un `404` sur la page même où il avait cliqué. L'arbitrage du porteur
   * — « il peut remettre dans les sept jours » — n'aurait eu aucun écran.
   *
   * Le filtre est donc déplacé APRÈS la garde de rôle. Pour tout le monde sauf un
   * modérateur ou le propriétaire, un sujet masqué reste un `404`, exactement
   * comme avant — y compris pour SON AUTEUR : rendre le contenu masqué à qui
   * n'a pas le pouvoir de le rétablir ne sert à rien et montre ce que la
   * modération a retiré. La LISTE (`topics()`), elle, ne change pas : elle
   * continue de ne rendre que les sujets visibles.
   */
  async topic(topicId: string, userId: string) {
    const topic = await this.prisma.topic.findFirst({
      where: { id: topicId },
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
        deletedAt: true,
        authorUserId: true,
        author: { select: { id: true, handle: true, displayName: true } },
      },
    });
    if (topic === null) throw ApiError.notFound();

    const access = await this.load(topic.communityId, userId);
    const membership = this.assertMember(access);
    if (
      topic.deletedAt !== null &&
      membership.role !== 'OWNER' &&
      membership.role !== 'MODERATOR'
    ) {
      throw ApiError.notFound();
    }

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

    /**
     * ── `deletedAt` NE SORT PAS, IL EST TRADUIT ───────────────────────────────
     *
     * `topicDetailResponseSchema` est `.strict()` : un champ de plus fait échouer
     * la validation CÔTÉ FRONT, sur une réponse parfaitement correcte. La date de
     * masquage est donc retirée de l'étalement et rendue sous trois noms que
     * l'écran sait lire — ce qui vaut mieux de toute façon, puisque la fenêtre de
     * sept jours est un calcul de serveur et non une date brute à comparer dans
     * le navigateur.
     *
     * `unhideUntil` n'est pas `canUnhide` : la date se lit même quand le rôle ne
     * permet pas le geste, et c'est elle qui permet d'écrire « jusqu'au … ».
     */
    const { deletedAt, ...visible } = topic;
    const unhideUntil =
      deletedAt === null
        ? null
        : new Date(deletedAt.getTime() + TOPIC_UNHIDE_WINDOW_DAYS * DAY_MS);

    return {
      ...visible,
      community: { id: access.community.id, slug: access.community.slug, name: access.community.name },
      canResolve: topic.authorUserId === userId || isModerator,
      canPin: isModerator,
      canEdit:
        topic.authorUserId === userId &&
        Date.now() - topic.createdAt.getTime() < TOPIC_EDIT_WINDOW_MINUTES * 60_000,
      hidden: deletedAt !== null,
      /**
       * CALCULÉ À CHAQUE LECTURE, comme `canEdit` : la fenêtre se referme pendant
       * qu'on regarde la page.
       *
       * ⚠ IL PEUT ÊTRE OPTIMISTE, ET C'EST ASSUMÉ : il ne sait pas si c'est
       * l'AUTEUR qui a retiré son propre sujet, ce que `restoreTopic` refuse
       * (voir son en-tête). Le savoir ici coûterait une lecture du journal
       * d'audit à chaque affichage d'un sujet, et le dépôt a une doctrine pour
       * ce cas : le front PRÉVIENT, il n'autorise pas — le geste est tenté, et
       * c'est le serveur qui refuse.
       */
      canUnhide:
        isModerator &&
        unhideUntil !== null &&
        unhideUntil.getTime() > Date.now() &&
        access.community.status !== 'ARCHIVED',
      unhideUntil,
      replies,
    };
  }

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ REMETTRE UN SUJET MASQUÉ — SEPT JOURS, PUIS L'ÉQUIPE                     ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * ARBITRAGE DU PORTEUR : « le modérateur qui a masqué peut remettre dans les
   * sept jours. Au-delà, seule l'équipe. »
   *
   * Avant ce lot, masquer était sans retour du côté réseau : seule l'équipe
   * disposait de `ModerationActionType.UNHIDE` (module 13), c'est-à-dire d'un
   * dossier de modération ouvert à la main. Un clic de travers sur « Masquer »
   * n'avait aucun remède à l'échelle du réseau.
   *
   * ── LA DATE VIENT DE L'OBJET, PAS DU JOURNAL, ET VOICI POURQUOI ────────────
   *
   * Les deux candidats étaient `topics.deleted_at` et la ligne d'audit
   * `community.topic_hidden`. C'est `deleted_at` qui est retenu :
   *
   *   · c'est la valeur qui FAIT le masquage — tant qu'elle est posée, le sujet
   *     est hors des listes ; il n'y a donc aucun écart possible entre l'état et
   *     la date qui le borne ;
   *   · elle est écrite dans la MÊME transaction que la ligne d'audit
   *     (`deleteTopic`), donc rien n'est perdu en la préférant ;
   *   · le journal est en AJOUT SEUL : un sujet masqué, remis, puis masqué de
   *     nouveau y porte PLUSIEURS lignes `community.topic_hidden`, et il faudrait
   *     choisir la bonne. `deleted_at` ne porte que le dernier masquage, qui est
   *     exactement celui dont on compte les sept jours.
   *
   * ── LE JOURNAL SERT QUAND MÊME, POUR UNE AUTRE QUESTION ───────────────────
   *
   * `deleteTopic` est ouvert à l'AUTEUR autant qu'aux modérateurs (« l'auteur
   * peut aussi retirer le sien »). Rétablir le retrait d'un auteur par-dessus sa
   * volonté serait republier ce qu'il a retiré — ce n'est pas une erreur de clic
   * de modération, et l'arbitrage ne parle pas de ça. On lit donc la DERNIÈRE
   * ligne de masquage, dont la métadonnée `byModerator` dit en quelle qualité le
   * geste a été fait, et on refuse quand ce n'était PAS un acte de modération.
   *
   * ⚠ ET NON PAS « quand c'est l'auteur », ce qu'une première version faisait :
   * MESURÉ à l'épreuve, un propriétaire qui ouvre un sujet puis le masque par
   * erreur recevait `403` — c'est-à-dire exactement l'erreur de clic que
   * l'arbitrage veut rattraper, refusée par la garde censée le servir.
   * `byModerator` distingue les deux cas que l'identité de l'acteur confond :
   * `deleteTopic` l'écrit depuis le rôle réel du moment.
   *
   * ── CE QUI N'EST PAS FAIT, ET QUI SE VOIT ────────────────────────────────
   *
   * Un modérateur qui masque puis QUITTE la page ne retrouve plus le sujet : la
   * liste des sujets ne rend pas les masqués, et il n'existe aucune route pour
   * les énumérer. La fenêtre de sept jours ne sert donc en pratique qu'à qui est
   * resté sur la page — ce qui couvre l'erreur de clic, mais pas le remords du
   * lendemain. Il faudrait un `GET /communities/:id/topics?hidden=true` réservé
   * aux modérateurs. REMONTÉ.
   */
  async restoreTopic(topicId: string, userId: string) {
    const topic = await this.prisma.topic.findUnique({
      where: { id: topicId },
      select: { id: true, communityId: true, authorUserId: true, deletedAt: true },
    });
    if (topic === null) throw ApiError.notFound();

    const access = await this.load(topic.communityId, userId);
    this.assertModerator(access);
    this.assertWritable(access);

    /**
     * IDEMPOTENT quand le sujet est déjà visible : remettre deux fois rend le
     * même état, et c'est un cas qui arrive pour de bon — deux onglets ouverts,
     * ou un double clic sur une liaison lente. Aucune ligne d'audit n'est écrite
     * dans ce cas : le journal dit ce qui a eu lieu, et il n'a rien eu lieu.
     */
    if (topic.deletedAt === null) return this.topic(topic.id, userId);

    /**
     * RECOPIÉE DANS UNE CONSTANTE, et ce n'est pas du style : le rétrécissement
     * de type que le test ci-dessus obtient ne survit pas à la fermeture
     * asynchrone de la transaction — TypeScript ne peut pas savoir que rien ne
     * réassigne `topic` entre-temps, et il a raison de le dire (TS18047).
     */
    const masqueLe = topic.deletedAt;

    const limite = masqueLe.getTime() + TOPIC_UNHIDE_WINDOW_DAYS * DAY_MS;
    if (limite <= Date.now()) {
      this.fail('UNHIDE_WINDOW_CLOSED', {
        days: TOPIC_UNHIDE_WINDOW_DAYS,
        hiddenAt: masqueLe.toISOString(),
      });
    }

    const masquage = await this.prisma.auditLog.findFirst({
      where: { action: 'community.topic_hidden', targetType: 'topic', targetId: topic.id },
      orderBy: { createdAt: 'desc' },
      select: { metadata: true },
    });
    /**
     * `byModerator` ABSENT laisse passer, et c'est un choix : un masquage sans
     * ligne d'audit ne devrait pas exister — `deleteTopic` l'écrit dans la MÊME
     * transaction — mais si une voie future posait `deleted_at` sans journaliser,
     * refuser le rétablissement rendrait ce contenu irrécupérable côté réseau.
     * Entre les deux risques, celui d'un sujet remis par erreur se répare d'un
     * clic ; celui d'un sujet bloqué masqué ne se répare pas.
     */
    const parModerateur =
      masquage === null || typeof masquage.metadata !== 'object' || masquage.metadata === null
        ? null
        : (masquage.metadata as Record<string, unknown>)['byModerator'];
    if (parModerateur === false) {
      throw ApiError.transverse('FORBIDDEN', { reason: 'AUTHOR_WITHDREW' });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.topic.update({ where: { id: topic.id }, data: { deletedAt: null } });
      // TRACÉE COMME LE MASQUAGE L'EST — même forme, même `targetType`, même
      // `actor_type = MEMBER` (§2.4). Le journal porte alors la paire complète :
      // qui a masqué, qui a remis, et quand.
      await this.audit.record(tx, {
        actor: { type: 'MEMBER', id: userId },
        action: 'community.topic_restored',
        targetType: 'topic',
        targetId: topic.id,
        metadata: {
          communityId: topic.communityId,
          hiddenAt: masqueLe.toISOString(),
          windowDays: TOPIC_UNHIDE_WINDOW_DAYS,
        },
      });
    });

    return this.topic(topic.id, userId);
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

  /**
   * §2.4 : masquer un sujet du réseau. L'auteur peut aussi retirer le sien.
   *
   * RÉVERSIBLE PENDANT SEPT JOURS depuis ce lot, par un modérateur du réseau et
   * à sa seule main — voir `restoreTopic`. `deletedAt` est la date dont ces sept
   * jours sont comptés, et c'est pour ça qu'elle est posée ici et pas ailleurs.
   */
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
        /**
         * LES TROIS CHAMPS QUE LA PLANCHE DESSINE ET QUE CETTE ROUTE TAISAIT.
         *
         * `title` et `pinnedAt` sont les deux colonnes ajoutées par ce lot ;
         * `notifiedAt` existait déjà dans la table et n'était simplement pas
         * sélectionné, donc l'écran ne pouvait pas dire si la notification était
         * partie. Les trois sont dans `announcementSchema`, qui est `.strict()` :
         * ils ne peuvent pas manquer de la charge sans la faire refuser côté
         * front, ce qui est exactement la garde qu'on veut ici.
         */
        title: true,
        body: true,
        pinnedAt: true,
        notifiedAt: true,
        createdAt: true,
        author: { select: { id: true, handle: true, displayName: true } },
      },
    });

    const page = buildPage(rows, query.limit, scope, this.cursorSecret);
    return { items: page.items, nextCursor: page.nextCursor };
  }

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ ANNONCE DU PROPRIÉTAIRE OU D'UN MODÉRATEUR — LES QUATRE CONTRÔLES       ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur : « L'annonce : tous les champs doivent être branchés. » La planche
   * en dessine QUATRE — titre, corps, « Épingler en haut du fil », « Notifier les
   * 890 membres » — et ce service n'en écrivait qu'un. Les trois autres n'avaient
   * nulle part où aller : ce n'était pas un branchement d'écran manquant mais un
   * écart de contrat, fermé par la migration `annonce_titre_et_epinglage`.
   *
   * ── « 2 PAR SEMAINE MAXIMUM » RESTE UN COMPTE DE LIGNES, PAS UN @RateLimit ──
   *
   * `@RateLimit` existe et il ne convient pas ici, et son propre en-tête le dit :
   * « La journée n'est PAS proposée. Les quotas journaliers des spécifications
   * […] sont des règles MÉTIER : elles doivent survivre à un redémarrage de
   * Redis, être lisibles par le membre, et compter des objets créés — pas des
   * requêtes reçues. » La semaine est a fortiori hors de sa portée (`minute` ou
   * `hour`), et le budget y est compté PAR APPELANT là où §2.3 borne le RÉSEAU :
   * deux modérateurs qui annoncent chacun deux fois feraient quatre
   * notifications, et c'est précisément ce que la règle empêche. Le compte de
   * lignes sur sept jours est donc gardé tel quel.
   *
   * ── L'ÉPINGLAGE EST EXCLUSIF, ET C'EST UNE DÉCISION ────────────────────────
   *
   * La spécification ne tranche pas : §2.3 borne les SUJETS épinglés à cinq et ne
   * dit rien des annonces. La planche, elle, écrit « Épingler en haut du fil » —
   * UN emplacement, au singulier, et elle ne dessine AUCUN geste pour déépingler.
   * Non exclusif, les annonces épinglées s'accumuleraient sans aucun moyen d'en
   * retirer une : le dessin ne donnerait jamais ce qu'il promet. Exclusif, la
   * nouvelle remplace la précédente, ce qui est auto-nettoyant et ne demande
   * aucun contrôle que la maquette ne dessine pas.
   *
   * Tenu par le SERVICE et non par un index unique partiel : un index ferait
   * ÉCHOUER la seconde annonce épinglée au lieu de remplacer la première.
   *
   * ── LA SOURDINE EST TENUE, ET ELLE NE L'EST PAS ICI ───────────────────────
   *
   * §2.3 veut prévenir « tous les membres NON EN SOURDINE ». Ce service ne filtre
   * toujours rien, et c'est juste : il émet un événement, et c'est
   * `notifications.events.ts` (`onCommunityAnnouncement`) qui choisit les
   * destinataires — 00 §3.3 interdit l'appel direct d'un module à un autre.
   *
   * ⚠ CET EN-TÊTE DISAIT LE CONTRAIRE, et il avait raison au moment où il a été
   * écrit : `community_members.muted` n'existait pas, le filtre était
   * impossible, et « Notifier » réveillait tout le monde. La colonne est arrivée
   * avec la migration `reseaux_sourdine_inviteur_avertissement`, le filtre est
   * posé dans `onCommunityAnnouncement` (où il écarte AUSSI les `PENDING`, les
   * `INVITED` et les bannis), et le paragraphe est corrigé plutôt que laissé à
   * défendre un état révolu.
   *
   * ⚠ RESTE UN ÉCART DE MAQUETTE, remonté : la planche de 1 036 px écrit sous
   * l'interrupteur « Une seule notification, même pour les membres en
   * sourdine. » C'est maintenant FAUX — les membres en sourdine ne reçoivent
   * rien, comme §2.3 l'exige. La phrase est du DESSIN ; la corriger serait
   * réécrire la maquette, ce qui est interdit. C'est au porteur de la retoucher.
   */
  async createAnnouncement(idOrSlug: string, userId: string, input: CreateAnnouncement) {
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
    /**
     * UN SEUL INSTANT POUR LES DEUX HORODATAGES ET POUR LA RÉPONSE.
     *
     * `new Date()` appelé trois fois rendrait trois instants à quelques
     * millisecondes d'écart, et la réponse ne dirait alors pas exactement ce que
     * la ligne porte. Ce n'est pas visible à l'œil ; c'est visible dans un test
     * qui compare la réponse à la relecture, et c'est ce test qui a raison.
     */
    const maintenant = new Date();
    const pinnedAt = input.pinned ? maintenant : null;
    const notifiedAt = input.notify ? maintenant : null;

    await this.prisma.$transaction(async (tx) => {
      /**
       * DÉÉPINGLER AVANT D'ÉPINGLER, dans la MÊME transaction. Hors transaction,
       * un lecteur tombant entre les deux écritures verrait zéro annonce
       * épinglée — ou deux, selon l'ordre.
       */
      if (pinnedAt !== null) {
        await tx.communityAnnouncement.updateMany({
          where: { communityId: access.community.id, pinnedAt: { not: null } },
          data: { pinnedAt: null },
        });
      }
      await tx.communityAnnouncement.create({
        data: {
          id,
          communityId: access.community.id,
          authorUserId: userId,
          ...(input.title === undefined ? {} : { title: input.title }),
          body: input.body,
          pinnedAt,
          notifiedAt,
        },
      });
      await this.touch(tx, access.community.id);
      /**
       * L'ÉVÉNEMENT NE PART QUE SI « Notifier » EST DEMANDÉ.
       *
       * C'est tout le sens de l'interrupteur : une annonce non notifiée s'écrit
       * dans la liste du réseau et ne réveille personne. Émettre quand même, en
       * laissant `notifications` filtrer, serait un interrupteur décoratif.
       */
      if (notifiedAt !== null) {
        await this.outbox.emit(tx, {
          type: 'community.announcement_published',
          aggregateId: id,
          payload: { communityId: access.community.id, announcementId: id, authorUserId: userId },
        });
      }
    });

    return {
      id,
      title: input.title ?? null,
      body: input.body,
      pinnedAt,
      notifiedAt,
      createdAt: maintenant,
    };
  }

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ ÉPINGLER ET DÉSÉPINGLER UNE ANNONCE DÉJÀ PUBLIÉE                        ║
   * ║ `PATCH /communities/:id/announcements/:announcementId`                   ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * ── LE MANQUE, ET L'ARBITRAGE DU 2026-10-11 ───────────────────────────────
   *
   * `createAnnouncement` pose l'épinglage et le tient EXCLUSIF. Le porteur a
   * confirmé que l'exclusivité reste. Mais il n'existait aucun chemin pour
   * revenir à « aucune annonce épinglée » : on ne pouvait que remplacer
   * l'épinglée par une autre, en publiant une annonce — et le budget est de deux
   * par semaine (§2.3). « Épingler en haut du fil » était donc une porte à sens
   * unique, et une annonce périmée y restait.
   *
   * ⚠ LA MAQUETTE NE DESSINE AUCUN GESTE DE DÉSÉPINGLAGE. Relevé sur les octets
   * de `03 Accueil v2.dc.html` : « Désépingler » 0 fois, « Retirer l'épinglage »
   * 0 fois ; l'interrupteur « Épingler en haut du fil » n'existe que dans le
   * formulaire de CRÉATION. Le dessin du geste est remonté au rapport ; la route
   * existe de toute façon, parce qu'une accumulation sans issue est plus grave
   * qu'un bouton manquant.
   *
   * ── L'EXCLUSIVITÉ VAUT ICI AUSSI, ET C'EST LE POINT ──────────────────────
   *
   * Épingler une ANCIENNE annonce déépingle la courante, dans la même
   * transaction. Sans cela, la règle tiendrait à la création et nulle part
   * ailleurs : deux annonces épinglées seraient atteignables par le chemin le
   * plus évident — en épingler une seconde depuis la liste.
   *
   * ── LES TROIS GARDES, ET POURQUOI CHACUNE ─────────────────────────────────
   *
   *   · `assertModerator` — même porte que la création (§2.3 : « Propriétaire et
   *     modérateurs »). Épingler est un acte éditorial sur le haut du fil d'un
   *     réseau ; ce n'est pas au membre qui a écrit l'annonce d'en décider, et
   *     l'auteur N'EST PAS exempté : un modérateur destitué ne doit pas garder
   *     la main sur son annonce épinglée.
   *   · `assertWritable` — un réseau archivé est en lecture seule (§2.2).
   *   · l'annonce doit appartenir à CE réseau. Sans ce `where`, un modérateur
   *     d'un réseau pourrait épingler l'annonce d'un autre : l'identifiant de
   *     l'annonce suffirait, et c'est exactement le genre de fuite entre réseaux
   *     que ce module passe son temps à refermer.
   *
   * ── UNE LIGNE D'AUDIT, PARCE QUE §2.4 LA DEMANDE ─────────────────────────
   *
   * « Toute action de modération de réseau est journalisée (`audit_logs`,
   * `actor_type = MEMBER`). » Épingler est dans la liste de §2.4 (« épingler »),
   * au même titre que masquer et bannir.
   *
   * ⚠ AUCUN `touch()` : épingler n'est pas de l'activité au sens de §2.2
   * (« publication, sujet, réponse, événement »). Un modérateur qui désépingle
   * une annonce périmée dans un réseau mort ne doit pas le réveiller pour quinze
   * jours de plus — sans quoi on aurait un moyen d'empêcher l'archivage sans
   * rien y publier.
   */
  async setAnnouncementPinned(
    idOrSlug: string,
    announcementId: string,
    userId: string,
    pinned: boolean,
  ) {
    const access = await this.load(idOrSlug, userId);
    this.assertModerator(access);
    this.assertWritable(access);

    const annonce = await this.prisma.communityAnnouncement.findFirst({
      where: { id: announcementId, communityId: access.community.id },
      select: { id: true, pinnedAt: true },
    });
    if (annonce === null) throw ApiError.notFound();

    // Idempotent : reposer le même état n'écrit rien et ne journalise rien. Une
    // ligne d'audit par clic sans effet remplirait le journal de non-actions.
    if ((annonce.pinnedAt !== null) === pinned) {
      return { id: annonce.id, pinnedAt: annonce.pinnedAt };
    }

    const pinnedAt = pinned ? new Date() : null;

    await this.prisma.$transaction(async (tx) => {
      if (pinned) {
        // DÉÉPINGLER LES AUTRES D'ABORD, dans la MÊME transaction — exactement
        // comme `createAnnouncement`. Hors transaction, un lecteur tombant
        // entre les deux écritures verrait deux annonces épinglées.
        await tx.communityAnnouncement.updateMany({
          where: {
            communityId: access.community.id,
            pinnedAt: { not: null },
            id: { not: annonce.id },
          },
          data: { pinnedAt: null },
        });
      }
      await tx.communityAnnouncement.update({
        where: { id: annonce.id },
        data: { pinnedAt },
      });
      await this.audit.record(tx, {
        actor: { type: 'MEMBER', id: userId },
        action: pinned ? 'community.announcement_pinned' : 'community.announcement_unpinned',
        targetType: 'community_announcement',
        targetId: annonce.id,
        metadata: { communityId: access.community.id },
      });
    });

    return { id: annonce.id, pinnedAt };
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
            votes: { select: { user: { select: { id: true, handle: true, displayName: true } } } },
          },
        },
      },
    });

    const page = buildPage(rows, query.limit, scope, this.cursorSecret);
    const myVotes = await this.prisma.pollVote.findMany({
      where: { userId, pollOption: { pollId: { in: page.items.map((p) => p.id) } } },
      select: { pollOptionId: true, pollOption: { select: { pollId: true } } },
    });

    /**
     * LA SÉPARATION VAUT AUSSI DANS UNE LISTE DE VOTANTS. Un membre qui m'a bloqué
     * — ou que j'ai bloqué — n'est nommé nulle part, y compris sous une option de
     * sondage non anonyme. On la charge une fois pour toute la page.
     */
    const separes = new Set(await this.visibility.separatedFrom(userId));

    return {
      items: page.items.map((poll) => this.shapePoll(poll, myVotes, separes)),
      nextCursor: page.nextCursor,
    };
  }

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LES RÉSULTATS, ET MAINTENANT DEUX RÉGLAGES QUI DÉCIDENT DE CE QUI SORT   ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * « Résultats visibles après vote ou clôture » (§2.3) ÉTAIT la règle, pour tout
   * le monde. Le porteur en a fait un réglage — `resultsAfterVote` — et le défaut
   * reste l'ancienne règle, donc rien ne change pour ce qui existe.
   *
   * Les compteurs sont RETIRÉS de la réponse quand ils sont masqués : les laisser
   * et demander au front de ne pas les afficher revient à les publier, puisqu'ils
   * sont dans la réponse HTTP. C'était vrai avant, ça l'est toujours.
   *
   * ── LES NOMS NE SORTENT PAS « PARCE QUE CE N'EST PAS ANONYME » ────────────
   *
   * Ils sortent quand les RÉSULTATS sortent, ET que le sondage n'est pas anonyme.
   * Les deux conditions, pas l'une ou l'autre : sans cela, le réglage d'anonymat
   * contournerait celui des résultats, et on saurait QUI a voté QUOI avant d'avoir
   * le droit de savoir COMBIEN.
   *
   * `separes` : un membre qui m'a bloqué, ou que j'ai bloqué, n'est jamais nommé —
   * la séparation vaut partout, y compris dans une liste de votants.
   */
  private shapePoll(
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
        votes?: { user: { id: string; handle: string; displayName: string } }[];
      }[];
    },
    myVotes: { pollOptionId: string; pollOption: { pollId: string } }[],
    separes: ReadonlySet<string> = new Set(),
  ) {
    const mine = myVotes.filter((v) => v.pollOption.pollId === poll.id).map((v) => v.pollOptionId);
    const closed = poll.closesAt !== null && poll.closesAt.getTime() <= Date.now();
    const revealed = !poll.resultsAfterVote || closed || mine.length > 0;
    const nomme = revealed && !poll.isAnonymous;

    return {
      id: poll.id,
      question: poll.question,
      isMultiple: poll.isMultiple,
      resultsAfterVote: poll.resultsAfterVote,
      isAnonymous: poll.isAnonymous,
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
        voters: nomme
          ? (o.votes ?? [])
              .map((v) => v.user)
              .filter((u) => !separes.has(u.id))
          : [],
      })),
    };
  }

  async createPoll(idOrSlug: string, userId: string, input: CreatePoll) {
    const access = await this.load(idOrSlug, userId);
    const membership = this.assertMember(access);
    this.assertWritable(access);

    // « Autoriser les sondages par tous les membres » — éteint, l'équipe seule.
    // La même règle est tenue sur un sondage joint à une publication du fil du
    // réseau (`FeedService.createPost`) : deux portes, une règle.
    if (
      !access.community.pollsOpenToMembers &&
      membership.role !== 'OWNER' &&
      membership.role !== 'MODERATOR'
    ) {
      this.fail('POLLS_RESTRICTED');
    }

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
          resultsAfterVote: input.resultsAfterVote,
          isAnonymous: input.isAnonymous,
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
        postId: true,
        question: true,
        isMultiple: true,
        resultsAfterVote: true,
        isAnonymous: true,
        closesAt: true,
        createdAt: true,
        authorUserId: true,
        author: { select: { id: true, handle: true, displayName: true } },
        options: {
          orderBy: { position: 'asc' },
          select: {
            id: true,
            label: true,
            position: true,
            voteCount: true,
            /**
             * LES VOTANTS SONT RAMENÉS, PAS TOUJOURS RENDUS. `shapePoll` ne les
             * nomme que sur un sondage NON anonyme dont les résultats sont
             * visibles ; les charger inconditionnellement coûte une jointure et
             * évite une seconde requête conditionnelle dont on oublierait un cas.
             */
            votes: { select: { user: { select: { id: true, handle: true, displayName: true } } } },
          },
        },
      },
    });
    if (poll === null) throw ApiError.notFound();

    await this.assertPollAccess(poll, userId);
    if (await this.visibility.isSeparated(userId, poll.authorUserId)) throw ApiError.notFound();

    const myVotes = await this.prisma.pollVote.findMany({
      where: { userId, pollOption: { pollId: poll.id } },
      select: { pollOptionId: true, pollOption: { select: { pollId: true } } },
    });

    /** Même garde que la liste : un membre séparé n'est nommé nulle part. */
    const separes = new Set(await this.visibility.separatedFrom(userId));
    return { ...this.shapePoll(poll, myVotes, separes), communityId: poll.communityId };
  }

  /**
   * « Un vote par membre (modifiable jusqu'à clôture) » (§2.3).
   *
   * Le vote est donc REMPLACÉ, pas ajouté : on efface les choix précédents et on
   * repose les nouveaux, dans une seule transaction, en ajustant les compteurs.
   * Un `create` simple ferait compter deux fois un membre qui change d'avis.
   */
  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ QUI PEUT TOUCHER À CE SONDAGE — ET IL Y A MAINTENANT DEUX RÉPONSES       ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Un sondage appartient à un RÉSEAU ou à une PUBLICATION du fil, jamais aux deux
   * (contrainte `polls_rattachement`). Les trois routes — lire, voter, clore —
   * posaient la même question à `load(communityId)` puis `assertMember`. Avec un
   * `community_id` devenu facultatif, ce chemin recevait `null` et `tsc` l'a dit
   * tout de suite : c'est exactement ce qu'on veut d'un type.
   *
   * ── LA VISIBILITÉ D'UN SONDAGE EST CELLE DE SON PORTEUR ───────────────────
   *
   * Pour un réseau, c'est l'adhésion ACTIVE. Pour une publication, c'est la
   * publication elle-même : si elle est dans un fil de réseau, il faut en être
   * membre ; dans le fil global, il suffit qu'elle soit publiée et non supprimée.
   * On ne réinvente pas une règle de visibilité — on suit celle du contenu qui
   * porte le sondage, sans quoi un sondage deviendrait une porte dérobée vers un
   * fil de réseau fermé.
   *
   * Rend le rôle quand le sondage est celui d'un réseau, `null` sinon : seule la
   * clôture s'en sert, et un sondage de publication n'a pas de modérateur de
   * réseau — c'est son AUTEUR qui le clôt.
   */
  private async assertPollAccess(
    poll: { communityId: string | null; postId: string | null },
    userId: string,
  ): Promise<{ role: string } | null> {
    if (poll.communityId !== null) {
      const access = await this.load(poll.communityId, userId);
      return this.assertMember(access);
    }
    if (poll.postId === null) {
      // La contrainte de base l'interdit ; si elle tombait, on refuse plutôt que
      // d'ouvrir un sondage que personne ne porte.
      throw ApiError.notFound();
    }
    const post = await this.prisma.post.findFirst({
      where: { id: poll.postId, deletedAt: null, status: 'PUBLISHED' },
      select: { communityId: true },
    });
    if (post === null) throw ApiError.notFound();
    if (post.communityId !== null) {
      const access = await this.load(post.communityId, userId);
      this.assertMember(access);
    }
    return null;
  }

  async vote(pollId: string, userId: string, optionIds: string[]) {
    const poll = await this.prisma.poll.findUnique({
      where: { id: pollId },
      select: {
        id: true,
        communityId: true,
        postId: true,
        isMultiple: true,
        closesAt: true,
        options: { select: { id: true } },
      },
    });
    if (poll === null) throw ApiError.notFound();

    await this.assertPollAccess(poll, userId);

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
      select: { id: true, communityId: true, postId: true, authorUserId: true, closesAt: true },
    });
    if (poll === null) throw ApiError.notFound();

    const membership = await this.assertPollAccess(poll, userId);
    /**
     * UN SONDAGE DE PUBLICATION N'A PAS DE MODÉRATEUR DE RÉSEAU : `membership` est
     * alors `null`, et seul l'AUTEUR peut clore. C'est la lecture juste de « auteur
     * ou modérateur » hors d'un réseau — il n'y a pas de modérateur à désigner.
     */
    const isModerator = membership !== null && (membership.role === 'OWNER' || membership.role === 'MODERATOR');
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

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ CRÉER UN ALBUM EST RÉSERVÉ AU PROPRIÉTAIRE ET AUX MODÉRATEURS            ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * ⚠ CETTE LIGNE ÉTAIT `assertMember`, ET LE DIRE EST LA MOITIÉ DE LA
   * CORRECTION : n'importe quel membre actif pouvait créer autant d'albums qu'il
   * voulait dans un réseau dont il n'est que membre. §2.3 ne tranchait pas — il
   * ne nomme que deux règles, « tout membre ajoute (L1) » pour une PHOTO et
   * « propriétaire et modérateurs suppriment » — et le silence a été lu comme
   * une permission.
   *
   * ARBITRAGE DU PORTEUR, 2026-10-11, mot pour mot : « les administrateurs ont
   * seul le bouton ajouté […] et ajouter un album ». L'écran ne montre donc ce
   * geste qu'au propriétaire et aux modérateurs — mais LE FRONT PRÉVIENT, IL
   * N'AUTORISE PAS (00 §5) : un bouton caché n'est pas une règle, et sans cette
   * ligne la route restait ouverte à tout membre qui l'appelle directement.
   *
   * `assertModerator` ET NON `assertOwner` : « les administrateurs » au pluriel,
   * et c'est la même porte que l'annonce, l'épinglage et le masquage — toutes
   * les décisions de contenu du réseau passent par `MODERATOR_REQUIRED`.
   *
   * ⚠ `addPhoto` N'EST PAS TOUCHÉE, et c'est délibéré : §2.3 écrit en toutes
   * lettres « tout membre ajoute (L1) », et `post.create` est la capacité que le
   * contrôleur déclare. Le dessin ne donne le bouton qu'aux modérateurs ; la
   * RÈGLE, elle, reste celle de la spécification. REMONTÉ : le porteur voudra
   * peut-être trancher aussi celle-là, et c'est un mot de sa part, pas une
   * déduction de ce service.
   */
  async createAlbum(
    idOrSlug: string,
    userId: string,
    input: { title: string; eventId?: string | undefined },
  ) {
    const access = await this.load(idOrSlug, userId);
    this.assertModerator(access);
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
    const membership = this.assertMember(access);
    this.assertWritable(access);

    /**
     * « ALBUM OUVERT AUX MEMBRES » — l'interrupteur de « Gérer », appliqué ici.
     * Éteint, seule l'équipe ajoute des photos ; allumé (le défaut, et ce que la
     * planche dessine), tout membre actif peut garnir un album DÉJÀ créé — la
     * création d'un album reste à l'équipe dans les deux cas (`createAlbum`).
     */
    if (
      !access.community.albumOpenToMembers &&
      membership.role !== 'OWNER' &&
      membership.role !== 'MODERATOR'
    ) {
      this.fail('ALBUM_RESTRICTED');
    }

    // L'image doit appartenir à celui qui la pose : sans ce contrôle, un membre
    // pourrait afficher dans un album n'importe quelle image de la plateforme en
    // devinant son identifiant.
    const asset = await this.prisma.mediaAsset.findFirst({
      // `status: 'READY'` — §8.3, l'antivirus avant publication. Une ligne
      // `REJECTED` désigne une clé sur laquelle rien n'a été déposé : l'album
      // afficherait un trou.
      where: {
        id: input.mediaAssetId,
        ownerUserId: userId,
        deletedAt: null,
        kind: 'ALBUM',
        status: 'READY',
      },
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

  // ══ LA FILE DE SIGNALEMENTS D'UN RÉSEAU (§2.4) ════════════════════════════
  //
  // ╔═════════════════════════════════════════════════════════════════════════╗
  // ║ LE LIEN ENTRE UN SIGNALEMENT ET UN RÉSEAU N'EXISTE PAS EN COLONNE       ║
  // ╚═════════════════════════════════════════════════════════════════════════╝
  //
  // MESURÉ avant d'écrire une ligne. `reports` (`13-moderation.prisma`) porte
  // `reporter_user_id`, `subject_type`, `subject_id`, `reason`, `details`,
  // `status`, `case_id` — et AUCUN `community_id`. `ReportSubjectType` nomme
  // douze sujets et aucun n'est « réseau ». Aucune route du dépôt ne lisait ces
  // lignes côté membre : `moderation.controller.ts` n'expose que `POST /reports`,
  // `GET /me/sanctions`, `POST /sanctions/:id/appeal` et `GET /scam-alerts`.
  //
  // LE LIEN EXISTE DONC, MAIS EN DÉRIVATION — et c'est ce qui a été retenu
  // plutôt que d'ajouter une colonne :
  //
  //   · `POST`    → `posts.community_id` (nullable : null = fil global) ;
  //   · `TOPIC`   → `topics.community_id` (non nullable) ;
  //   · `COMMENT` → `comments.subject_type` / `subject_id` remonte au POST ou au
  //                 TOPIC, puis la règle ci-dessus. `comments` n'a pas non plus
  //                 de `community_id`, et une réponse de sujet EST un
  //                 commentaire de sujet (§2.3).
  //
  // Les neuf autres genres ne sont jamais dans un réseau : ils sont absents de
  // cette file par construction, pas filtrés par prudence.
  //
  // ⚠ POURQUOI PAS UNE COLONNE `reports.community_id` : elle serait écrite au
  // moment du signalement, donc FIGÉE — et un post déplacé vers un sujet
  // (`post.moved_to_topic`, §6) changerait de réseau sans qu'elle suive. La
  // dérivation dit toujours où le contenu est AUJOURD'HUI, ce qui est la seule
  // question que pose un modérateur. REMONTÉ : si la file devenait longue, c'est
  // une vue matérialisée qu'il faudrait, pas une colonne.

  /**
   * `GET /communities/:id/reports` — UNE RANGÉE PAR CONTENU, pas par signalement.
   *
   * La planche « Gérer » écrit « Demande d'argent · 5 signalements » sur UNE
   * rangée, avec UNE paire « Masquer » / « Conserver ». Cinq rangées identiques
   * auraient donné cinq paires de boutons dont le premier clic rendrait les
   * quatre autres sans objet. Le regroupement est la forme de la DÉCISION, qui
   * porte sur un contenu et non sur l'acte d'un signaleur.
   *
   * ── POURQUOI DU SQL BRUT, ALORS QUE TOUT LE MODULE EST EN PRISMA ─────────
   *
   * Parce que la jointure est POLYMORPHE : `reports.subject_id` pointe trois
   * tables selon `subject_type`, et Prisma ne sait pas joindre là-dessus. Les
   * deux solutions en Prisma auraient été pires :
   *
   *   · lire TOUS les posts, sujets et commentaires du réseau puis chercher
   *     leurs identifiants dans `reports` — c'est-à-dire charger le contenu
   *     entier d'un réseau de 890 membres pour en retenir deux lignes ;
   *   · lire tous les signalements ouverts de la plateforme puis les filtrer en
   *     mémoire — une lecture qui grossit avec le trafic global, pas avec ce
   *     réseau.
   *
   * La requête PART DE `reports` avec `status IN ('NEW','ATTACHED')`, qui est
   * indexé (`reports_status_idx`), et rattache chaque ligne par `LEFT JOIN`. Le
   * `COALESCE` des quatre `community_id` possibles est le lien dérivé décrit
   * ci-dessus, écrit une seule fois.
   *
   * ── CE QUE LA REQUÊTE NE SERT PAS, ET C'EST UNE GARDE ────────────────────
   *
   * ⚠ NI `reporter_user_id`, NI `details`. 13 §… : le signaleur n'est jamais
   * révélé, et `details` est du texte libre écrit par un membre sur un autre.
   * Un modérateur bénévole n'a besoin ni de l'un ni de l'autre pour choisir
   * entre masquer et conserver, et les servir ferait voyager une accusation
   * nominale de plus. `count` dit combien ils sont ; rien ne dit qui.
   *
   * `extrait` est tronqué À 160 CARACTÈRES EN SQL : la rangée dessine une seule
   * ligne, et faire voyager dix mille caractères de publication pour en afficher
   * cent soixante finit toujours par être affiché quelque part.
   *
   * ⚠ PIÈGE PAYÉ EN ÉCRIVANT CETTE MÉTHODE : les commentaires SQL du gabarit
   * ci-dessous ne peuvent pas porter d'accent grave. `$queryRaw` prend un
   * TEMPLATE LITERAL, et le premier accent grave d'un commentaire le termine —
   * TypeScript rend alors six erreurs de syntaxe à des lignes qui n'ont rien à
   * voir (`TS1005`, `TS1443`). Le style du dépôt cite les colonnes entre accents
   * graves ; dans un `$queryRaw`, il faut s'en passer.
   */
  async reports(idOrSlug: string, userId: string) {
    const access = await this.load(idOrSlug, userId);
    this.assertModerator(access);

    const rows = await this.prisma.$queryRaw<
      {
        subjectType: string;
        subjectId: string;
        count: number;
        reason: string;
        lastReportedAt: Date;
        authorUserId: string | null;
        extrait: string;
        hidden: boolean;
        escalated: boolean;
      }[]
    >`
      SELECT
        r.subject_type::text                                        AS "subjectType",
        r.subject_id                                                AS "subjectId",
        COUNT(*)::int                                               AS "count",
        -- Le motif du signalement le PLUS RÉCENT du groupe : c'est lui qui a
        -- fait remonter la rangée dans la file, donc celui que le modérateur
        -- voit arriver. La rangée n'en dessine qu'un.
        (ARRAY_AGG(r.reason::text ORDER BY r.created_at DESC))[1]   AS "reason",
        MAX(r.created_at)                                           AS "lastReportedAt",
        COALESCE(p.author_user_id, t.author_user_id, c.author_user_id) AS "authorUserId",
        COALESCE(
          LEFT(p.body, 160),
          -- Pour un SUJET c'est le TITRE et non le corps : la planche écrit
          -- « Commentaire de Paul A. dans « Double nationalité » », c'est-à-dire
          -- le titre. Un sujet a les deux ; son corps n'identifie rien.
          t.title,
          LEFT(c.body, 160),
          ''
        )                                                           AS "extrait",
        -- DÉJÀ MASQUÉ ? Trois tables, trois façons de le dire, et il faut les
        -- trois : un posts.status vaut HIDDEN ou REMOVED, un topics.status
        -- ne porte pas ces valeurs (OPEN / RESOLVED / ARCHIVED) et son masquage
        -- se lit sur deleted_at — c'est ce que deleteTopic écrit.
        (
          COALESCE(p.status::text IN ('HIDDEN', 'REMOVED'), FALSE)
          OR COALESCE(c.status::text IN ('HIDDEN', 'REMOVED'), FALSE)
          OR p.deleted_at IS NOT NULL
          OR t.deleted_at IS NOT NULL
          OR c.deleted_at IS NOT NULL
        )                                                           AS "hidden",
        -- « transmis à la modération de la plateforme » : un dossier d'équipe
        -- non résolu existe sur ce contenu. La planche l'écrit sous la première
        -- rangée et pas sous la seconde — les deux valeurs sont dessinées.
        EXISTS (
          SELECT 1 FROM moderation_cases mc
          WHERE mc.subject_type = r.subject_type
            AND mc.subject_id = r.subject_id
            AND mc.status::text <> 'RESOLVED'
        )                                                           AS "escalated"
      FROM reports r
      LEFT JOIN posts    p  ON r.subject_type::text = 'POST'    AND p.id  = r.subject_id
      LEFT JOIN topics   t  ON r.subject_type::text = 'TOPIC'   AND t.id  = r.subject_id
      LEFT JOIN comments c  ON r.subject_type::text = 'COMMENT' AND c.id  = r.subject_id
      LEFT JOIN posts    cp ON c.subject_type::text = 'POST'    AND cp.id = c.subject_id
      LEFT JOIN topics   ct ON c.subject_type::text = 'TOPIC'   AND ct.id = c.subject_id
      WHERE r.status::text IN ('NEW', 'ATTACHED')
        AND r.subject_type::text IN ('POST', 'TOPIC', 'COMMENT')
        AND COALESCE(p.community_id, t.community_id, cp.community_id, ct.community_id)
            = ${access.community.id}::uuid
      GROUP BY
        r.subject_type, r.subject_id,
        p.author_user_id, t.author_user_id, c.author_user_id,
        p.body, t.title, c.body,
        p.status, c.status, p.deleted_at, t.deleted_at, c.deleted_at
      ORDER BY MAX(r.created_at) DESC
      LIMIT 50
    `;

    /**
     * LES AUTEURS EN UN SEUL APPEL, et non une jointure de plus.
     *
     * `users` porte des colonnes chiffrées et une règle de visibilité (blocages)
     * que `VisibilityService` applique ; les lire en SQL brut contournerait les
     * deux. On remonte donc les identifiants et on les résout par Prisma, qui
     * est la seule porte de ce module vers un profil.
     */
    const authorIds = [
      ...new Set(rows.map((r) => r.authorUserId).filter((id): id is string => id !== null)),
    ];
    const authors =
      authorIds.length === 0
        ? []
        : await this.prisma.user.findMany({
            where: { id: { in: authorIds } },
            select: { id: true, handle: true, displayName: true },
          });
    const parHandle = new Map(authors.map((a) => [a.id, a]));

    return {
      items: rows.map((r) => ({
        subjectType: r.subjectType as 'POST' | 'COMMENT' | 'TOPIC',
        subjectId: r.subjectId,
        reason: r.reason,
        count: r.count,
        author: r.authorUserId === null ? null : parHandle.get(r.authorUserId) ?? null,
        extrait: r.extrait,
        hidden: r.hidden,
        escalated: r.escalated,
        lastReportedAt: r.lastReportedAt,
      })),
      /**
       * `nextCursor` TOUJOURS NUL, et dit plutôt que sous-entendu : le
       * regroupement se fait en SQL et un curseur sur une agrégation exigerait
       * une clé de tri stable qu'aucune colonne ne porte. L'écran ne doit donc
       * pas dessiner un « charger la suite » qui ne chargerait jamais rien.
       */
      nextCursor: null,
      /**
       * LE NOMBRE QUE LA PLANCHE AFFICHE TROIS FOIS — « SIGNALEMENTS · 2 », la
       * tuile « 2 signalements ouverts », la pastille du rail. Compté par le
       * serveur, et c'est tout l'objet de ce `meta` : `items.length` sur une page
       * bornée à cinquante serait un compte FAUX affiché comme un compte, ce que
       * cette maquette a déjà payé quatre fois sur « DEMANDES D'ADHÉSION · 4 ».
       *
       * Il compte des CONTENUS et non des signalements : c'est ce que la rangée
       * représente, et « 2 » sur la planche désigne bien deux contenus.
       */
      meta: { open: rows.length },
    };
  }

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ « MASQUER » ET « CONSERVER » — LES DEUX DÉCISIONS, ET RIEN DE PLUS      ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * `POST /communities/:id/reports/decide`.
   *
   * ⚠ LA LIMITE DE POUVOIR EST DANS CE QUE CETTE MÉTHODE NE SAIT PAS FAIRE.
   * §2.4 : « Ils ne peuvent pas suspendre un compte — ils SIGNALENT à l'équipe. »
   * Il n'y a donc ici aucun chemin vers `users`, aucune sanction, aucun
   * `ModerationAction` — seulement deux écritures sur du CONTENU. Un modérateur
   * bénévole qui veut qu'un COMPTE soit traité passe par
   * `ModerationService.reportAsVolunteerModerator`, qui existe et escalade la
   * priorité (13 §6). Cette méthode ne lui donne rien de plus.
   *
   * ── « MASQUER » : CE QUI EXISTAIT DÉJÀ, ET CE QUI MANQUAIT ───────────────
   *
   * Vérifié avant d'écrire : masquer un SUJET était faisable
   * (`deleteTopic`, `PATCH /topics/:id`), masquer une PUBLICATION du réseau ne
   * l'était pas. `FeedService.deletePost` exige l'AUTEUR (`ownedPost`), et
   * `handleContentHidden` n'est qu'un consommateur d'événement du module 13 —
   * aucune route membre ne l'atteint. Les commentaires n'avaient rien non plus.
   * Les trois sont donc écrits ici, du même geste.
   *
   * ── MASQUER, JAMAIS SUPPRIMER (13 §2) ───────────────────────────────────
   *
   * « Le pipeline masque, il ne supprime jamais. » Un post passe
   * `status = HIDDEN` + `moderationStatus = FLAGGED` — exactement ce que
   * `FeedService.handleContentHidden` écrit quand l'équipe décide, et c'est
   * voulu : deux façons de masquer la même chose divergeraient, et les listes du
   * fil filtrent déjà `status = PUBLISHED`. Un sujet passe par `deletedAt`,
   * parce que `TopicStatus` ne porte pas `HIDDEN` et que c'est ce que
   * `deleteTopic` écrit déjà.
   *
   * ── LES DEUX DÉCISIONS CLOSENT LES SIGNALEMENTS, ET PAS DU MÊME MOT ──────
   *
   *   · `HIDE`  → `RESOLVED` : le signalement a abouti ;
   *   · `KEEP`  → `DISMISSED` : il est classé sans suite.
   *
   * ⚠ ET CE MOT A UNE CONSÉQUENCE AILLEURS, qu'il faut connaître : §3 du module
   * 13 rétrograde les signalements d'un membre dont « 10 signalements consécutifs
   * sont classés DISMISSED » (`ModerationService.dismissedStreak`). Un
   * modérateur de réseau qui conserve un contenu pèse donc sur la réputation du
   * signaleur. C'est le mécanisme voulu — un signalement abusif doit coûter —
   * mais il est écrit ici pour que personne ne le découvre par surprise.
   *
   * ⚠ LE DOSSIER D'ÉQUIPE N'EST PAS TOUCHÉ. Si l'équipe a ouvert un
   * `ModerationCase` sur ce contenu (`escalated`), elle garde la main : un
   * modérateur bénévole ne clôt pas un dossier d'équipe, et §2.4 ne lui en donne
   * pas le droit. Il masque le contenu DANS SON RÉSEAU, et la décision de
   * l'équipe reste à venir.
   */
  async decideReport(
    idOrSlug: string,
    userId: string,
    input: { subjectType: 'POST' | 'COMMENT' | 'TOPIC'; subjectId: string; decision: 'HIDE' | 'KEEP' },
  ) {
    const access = await this.load(idOrSlug, userId);
    this.assertModerator(access);
    this.assertWritable(access);

    /**
     * LE CONTENU DOIT APPARTENIR À CE RÉSEAU, et c'est vérifié AVANT tout le
     * reste. Sans ce contrôle, un modérateur d'un réseau quelconque pourrait
     * masquer la publication d'un autre réseau — ou du fil global — en envoyant
     * son identifiant. C'est la même fuite entre réseaux que `load()` referme
     * sur la lecture, et elle doit être refermée sur l'écriture.
     */
    const dansLeReseau = await this.subjectInCommunity(
      input.subjectType,
      input.subjectId,
      access.community.id,
    );
    if (!dansLeReseau) this.fail('REPORT_NOT_IN_COMMUNITY');

    const ouverts = await this.prisma.report.findMany({
      where: {
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        status: { in: ['NEW', 'ATTACHED'] },
      },
      select: { id: true },
    });
    /**
     * `premier` plutôt que `ouverts[0]` dans la ligne d'audit : avec
     * `noUncheckedIndexedAccess`, un accès par index rend `T | undefined`, et
     * `exactOptionalPropertyTypes` interdit de passer cet `undefined` à un
     * `targetId?: string`. La garde ci-dessous le prouve au compilateur une fois
     * pour toutes, au lieu d'un `!` qui mentirait.
     */
    const premier = ouverts[0];
    if (premier === undefined) this.fail('REPORT_ALREADY_DECIDED');

    let hidden = false;

    await this.prisma.$transaction(async (tx) => {
      if (input.decision === 'HIDE') {
        if (input.subjectType === 'POST') {
          await tx.post.updateMany({
            where: { id: input.subjectId },
            data: { status: 'HIDDEN', moderationStatus: 'FLAGGED' },
          });
        } else if (input.subjectType === 'COMMENT') {
          // `comments` n'a PAS de `moderation_status` (schéma figé) : le masquage
          // s'y lit uniquement sur `status`. Déjà relevé par `FeedService`.
          await tx.comment.updateMany({
            where: { id: input.subjectId },
            data: { status: 'HIDDEN' },
          });
        } else {
          await tx.topic.updateMany({
            where: { id: input.subjectId, deletedAt: null },
            data: { deletedAt: new Date() },
          });
        }
        hidden = true;
      }

      await tx.report.updateMany({
        where: { id: { in: ouverts.map((r) => r.id) } },
        data: { status: input.decision === 'HIDE' ? 'RESOLVED' : 'DISMISSED' },
      });

      // §2.4, dernière phrase : « Toute action de modération de réseau est
      // journalisée (`audit_logs`, `actor_type = MEMBER`). » Les DEUX décisions
      // le sont, y compris « Conserver » : classer cinq signalements sans suite
      // est un acte de modération, et c'est celui qu'on voudra pouvoir relire le
      // jour où le contenu conservé posera problème.
      await this.audit.record(tx, {
        actor: { type: 'MEMBER', id: userId },
        action: input.decision === 'HIDE' ? 'community.report_hidden' : 'community.report_kept',
        targetType: 'report',
        targetId: premier.id,
        metadata: {
          communityId: access.community.id,
          subjectType: input.subjectType,
          subjectId: input.subjectId,
          reports: ouverts.length,
        },
      });

      if (input.decision === 'HIDE') {
        /**
         * L'ÉVÉNEMENT EST ÉMIS POUR LES AUTRES MODULES, pas pour appliquer le
         * masquage — celui-ci vient d'être écrit juste au-dessus, dans la même
         * transaction. `search` doit désindexer, et un consommateur qui
         * rejouerait `handleContentHidden` reposerait les mêmes valeurs
         * (idempotent par construction, dit son en-tête).
         */
        await this.outbox.emit(tx, {
          type: 'moderation.content_hidden',
          aggregateId: input.subjectId,
          payload: {
            subjectType: input.subjectType,
            subjectId: input.subjectId,
            byUserId: userId,
            communityId: access.community.id,
            source: 'COMMUNITY_MODERATOR',
          },
        });
      }
    });

    return {
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      decision: input.decision,
      closed: ouverts.length,
      hidden,
    };
  }

  /**
   * Le contenu signalé appartient-il à CE réseau ?
   *
   * C'est la dérivation décrite en tête de section, écrite en Prisma plutôt
   * qu'en SQL parce qu'elle ne regarde qu'UNE ligne : la jointure polymorphe qui
   * justifiait le SQL brut de `reports()` n'a pas lieu d'être ici.
   *
   * ⚠ UN CONTENU DÉJÀ MASQUÉ RESTE « DANS LE RÉSEAU ». On ne filtre ni
   * `deletedAt` ni `status` : « Conserver » doit rester possible sur un contenu
   * que l'équipe vient de masquer — sinon ses signalements resteraient ouverts
   * pour toujours dans la file du réseau, et le compteur « SIGNALEMENTS · N »
   * ne redescendrait jamais.
   */
  private async subjectInCommunity(
    subjectType: 'POST' | 'COMMENT' | 'TOPIC',
    subjectId: string,
    communityId: string,
  ): Promise<boolean> {
    if (subjectType === 'POST') {
      const post = await this.prisma.post.findFirst({
        where: { id: subjectId, communityId },
        select: { id: true },
      });
      return post !== null;
    }
    if (subjectType === 'TOPIC') {
      const topic = await this.prisma.topic.findFirst({
        where: { id: subjectId, communityId },
        select: { id: true },
      });
      return topic !== null;
    }

    const comment = await this.prisma.comment.findUnique({
      where: { id: subjectId },
      select: { subjectType: true, subjectId: true },
    });
    if (comment === null) return false;
    // Un commentaire de STORY ou de tout autre sujet n'est jamais dans un
    // réseau : la récursion s'arrête aux deux seuls genres qui en portent un.
    if (comment.subjectType !== 'POST' && comment.subjectType !== 'TOPIC') return false;
    return this.subjectInCommunity(comment.subjectType, comment.subjectId, communityId);
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
        //
        // `warningSentAt` remis à null pour la même raison, et ce n'est pas du
        // zèle : sans cela, un réseau réactivé puis rendormi serait archivé
        // SANS AVERTISSEMENT — la tâche croirait l'avoir déjà envoyé.
        data: {
          status: 'ACTIVE',
          archivedAt: null,
          lastActivityAt: new Date(),
          warningSentAt: null,
        },
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

    /**
     * ╔════════════════════════════════════════════════════════════════════════╗
     * ║ L'AVERTISSEMENT À 45 JOURS — IL ÉTAIT IDENTIFIÉ, IL EST MAINTENANT     ║
     * ║ ENVOYÉ                                                                 ║
     * ╚════════════════════════════════════════════════════════════════════════╝
     *
     * §2.2 : « Le propriétaire reçoit un avertissement à 45 jours. » §7 le met
     * dans CETTE tâche : « quotidienne — avertissement à 45 jours, archivage à
     * 60 ». Cette moitié ne faisait rien : elle relevait la liste et la rendait,
     * et personne n'était prévenu. La cause était nommée ici même —
     * `communities.warning_sent_at` manquait — et la colonne existe désormais
     * (migration `reseaux_sourdine_inviteur_avertissement`).
     *
     * ── `warningSentAt: null` EST LA MOITIÉ DU FILTRE, PAS UNE PRÉCAUTION ───
     *
     * La tâche passe CHAQUE JOUR, et la fenêtre d'avertissement dure QUINZE
     * jours (du 45e au 60e). Sans ce filtre, le propriétaire recevrait le même
     * avertissement quinze fois — et §2.3 vient justement de nous apprendre
     * qu'on ne noie pas les membres de notifications. L'horodatage est écrit
     * dans la même transaction que l'émission : les deux vivent ou meurent
     * ensemble, et un plantage entre les deux ferait au pire un avertissement
     * de plus, jamais un avertissement perdu.
     *
     * Il est remis à `null` par `touch()` et par `reactivate()` : un réseau qui
     * reprend puis se rendort est prévenu de nouveau. Voir leur note.
     *
     * ── UN ÉVÉNEMENT, PAS UN APPEL À `notifications` ────────────────────────
     *
     * 00 §3.3 interdit l'appel direct d'un module à un autre. On émet donc
     * `community.archive_warning` et c'est `notifications` qui prévient — le
     * même chemin que `community.archived` juste au-dessus. ⚠ L'ABONNEMENT EST
     * À POSER dans `event-subscriptions.service.ts` et le gestionnaire dans
     * `notifications.events.ts` : sans eux l'événement part au relais et
     * personne ne le lit. C'est fait dans ce lot ; dit ici pour que la prochaine
     * lecture n'ait pas à le chercher.
     *
     * ── UNE LIGNE D'AUDIT, `actor_type = SYSTEM` ────────────────────────────
     *
     * Comme l'archivage juste au-dessus : ce n'est l'action de personne, c'est
     * celle de la tâche. Elle dit QUAND le propriétaire a été prévenu, ce qui
     * est la seule défense contre « je n'ai jamais reçu d'avertissement » le
     * jour où un réseau est archivé.
     */
    const toWarn = await this.prisma.community.findMany({
      where: {
        kind: 'INTEREST',
        status: 'ACTIVE',
        lastActivityAt: { lt: warnBefore, gte: archiveBefore },
        warningSentAt: null,
      },
      select: { id: true, slug: true, createdByUserId: true, lastActivityAt: true },
    });

    for (const community of toWarn) {
      await this.prisma.$transaction(async (tx) => {
        await tx.community.update({
          where: { id: community.id },
          data: { warningSentAt: now },
        });
        await this.audit.record(tx, {
          actor: { type: 'SYSTEM' },
          action: 'community.archive_warned',
          targetType: 'community',
          targetId: community.id,
          metadata: {
            days: COMMUNITY_ARCHIVE_WARNING_AFTER_DAYS,
            archiveAfterDays: COMMUNITY_ARCHIVE_AFTER_DAYS,
          },
        });
        await this.outbox.emit(tx, {
          type: 'community.archive_warning',
          aggregateId: community.id,
          payload: {
            communityId: community.id,
            slug: community.slug,
            ownerUserId: community.createdByUserId,
            /**
             * LE NOMBRE DE JOURS QUI RESTENT, et non la date d'archivage : c'est
             * la phrase que `notifications` écrira (« il sera archivé dans N
             * jours »), et la calculer là-bas obligerait ce module à y exporter
             * ses deux seuils.
             */
            daysLeft: Math.max(
              0,
              COMMUNITY_ARCHIVE_AFTER_DAYS -
                Math.floor((now.getTime() - community.lastActivityAt.getTime()) / DAY_MS),
            ),
          },
        });
      });
    }

    return { archived: stale.map((c) => c.id), warned: toWarn.map((c) => c.id) };
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
