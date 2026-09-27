import { Injectable, Logger } from '@nestjs/common';
import { newId, type Prisma } from '@app/db';
import {
  type AttendeeStatus,
  CALENDAR_CACHE_MS,
  CANCELLED_VISIBLE_DAYS,
  type CalendarDay,
  type CalendarQuery,
  type CancelEvent,
  type CheckIn,
  type CreateEvent,
  EVENT_CANCEL_GRACE_MS,
  EVENT_DONE_AFTER_END_MS,
  EVENT_DONE_AFTER_START_MS,
  EVENT_ERROR_CODES,
  EVENT_ERROR_MESSAGES,
  EVENT_MAX_LEAD_MS,
  EVENT_MIN_LEAD_MS,
  EVENT_ORGANIZED_MIN_CHECKINS,
  type EventErrorCode,
  type EventsQuery,
  FREE_EVENTS_PER_MONTH,
  type Rsvp,
  type UpdateEvent,
  SELF_CHECKIN_WINDOW_MS,
  TIME_ZONE_BY_COUNTRY_ISO2,
} from '@app/shared';
import { ApiError } from '../../common/api-error';
import { AuditService } from '../../common/audit.service';
import { buildPage, decodeCursor } from '../../common/cursor';
import { OutboxService } from '../../common/outbox.service';
import { PrismaService } from '../../common/prisma.service';
import { VisibilityService } from '../../common/visibility.service';
import { loadEnv } from '../../config/env';

/**
 * Agenda — 09-villes-agenda.md §3.
 *
 * L'agenda est « le convertisseur en ligne → réel » (§1), et la présence
 * effective en est l'indicateur clé. Trois choses en découlent, et expliquent la
 * forme de ce service :
 *
 *   · la PRÉSENCE est une donnée, pas un affichage : `checked_in` alimente
 *     l'indicateur « 30 % des inscrits participent à un événement physique en
 *     3 mois », et §3.3 refuse la réputation à un événement sans présence
 *     enregistrée. D'où `markDone()`, qui compte avant de créditer ;
 *
 *   · les FUSEAUX sont deux problèmes distincts qu'il ne faut pas confondre :
 *     les instants SORTENT en ISO 8601 UTC (T4 §1), mais un événement se lit
 *     dans le fuseau de sa VILLE (§3.5). Un pique-nique à 23 h à Lyon relève du
 *     jour local, jamais du jour UTC — sans quoi le calendrier vertical le
 *     rangerait un jour trop tard une partie de l'année ;
 *
 *   · un BLOCAGE interdit le RSVP dans les DEUX sens (§3.2 et 08 §4), et un
 *     événement réservé à un réseau n'existe pas pour un non-membre : 404, pas
 *     403 (T4 §3).
 *
 * Ce que ce service NE fait pas, et pourquoi : il n'envoie aucune notification.
 * §3.3 en décrit quatre (J−1, H−2, résumé organisateur, promotion de la liste
 * d'attente) et §7 nomme leurs consommateurs. Elles passent donc par la boîte
 * d'envoi (00 §3.3 : « JAMAIS par des appels directs »), et le module 11-12 les
 * branchera sur des événements qui existent déjà.
 */

/** Ce que la fiche d'un événement expose. Les instants sont des `Date`, sérialisés en UTC. */
export interface EventCard {
  readonly id: string;
  readonly type: string;
  readonly title: string;
  readonly description: string | null;
  readonly city: { readonly id: string; readonly name: string; readonly slug: string };
  readonly venueName: string | null;
  /** Texte libre. Aucune latitude, aucune longitude : rien n'est géocodé (règle dure §10). */
  readonly addressText: string | null;
  readonly startsAt: Date;
  readonly endsAt: Date | null;
  /** Fuseau de la ville, et jour civil dans ce fuseau (§3.5). */
  readonly timeZone: string;
  readonly localDate: string;
  readonly capacity: number | null;
  /** Nombre de `GOING` : c'est ce nombre que `capacity` borne (§3.2). */
  readonly attendeeCount: number;
  readonly status: string;
  readonly communityId: string | null;
  readonly organizer: {
    readonly handle: string | null;
    readonly displayName: string;
    readonly avatarUrl: string | null;
  };
  readonly coverUrl: string | null;
  /** Mon RSVP, ou null. `WAITLIST` porte sa position. */
  readonly myStatus: AttendeeStatus | null;
  readonly myWaitlistPosition: number | null;
  readonly myCheckedIn: boolean;
  readonly isOrganizer: boolean;
}

/** Mon RSVP sur un événement, tel que les listes le projettent. */
interface MyAttendance {
  readonly myStatus: AttendeeStatus;
  readonly myCheckedIn: boolean;
  readonly waitlistPosition: number | null;
}

/** Le `select` d'une fiche : écrit UNE fois, pour que lecture et projection ne divergent pas. */
const EVENT_SELECT = {
  id: true,
  deletedAt: true,
  type: true,
  title: true,
  description: true,
  venueName: true,
  addressText: true,
  startsAt: true,
  endsAt: true,
  capacity: true,
  attendeeCount: true,
  status: true,
  communityId: true,
  organizerUserId: true,
  createdAt: true,
  updatedAt: true,
  city: {
    select: {
      id: true,
      name: true,
      slug: true,
      latitude: true,
      longitude: true,
      country: { select: { iso2: true } },
    },
  },
  organizer: {
    select: {
      handle: true,
      displayName: true,
      avatarAsset: { select: { storageKey: true } },
    },
  },
  coverAsset: { select: { storageKey: true } },
} satisfies Prisma.EventSelect;

type EventRow = Prisma.EventGetPayload<{ select: typeof EVENT_SELECT }>;

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);
  private readonly cursorSecret = loadEnv().CURSOR_SECRET;
  private readonly defaultTimeZone = loadEnv().DEFAULT_TIMEZONE;

  /** §5 : « Cache 5 min par (membre, ville) » pour le calendrier. */
  private readonly calendarCache = new Map<string, { at: number; days: CalendarDay[] }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
    private readonly visibility: VisibilityService,
  ) {}

  private fail(code: EventErrorCode, details?: Record<string, unknown>): never {
    throw new ApiError(code, EVENT_ERROR_MESSAGES[code], EVENT_ERROR_CODES[code], details);
  }

  // ── Création (§3.1) ───────────────────────────────────────────────────────

  /**
   * Crée un événement.
   *
   * L'ordre des contrôles est délibéré : les bornes de temps AVANT le quota. Un
   * membre qui se trompe d'heure ne doit pas voir son unique événement mensuel
   * consommé par une tentative refusée.
   */
  async create(organizerUserId: string, input: CreateEvent): Promise<EventCard> {
    const now = Date.now();
    const lead = input.startsAt.getTime() - now;
    if (lead < EVENT_MIN_LEAD_MS) {
      this.fail('TOO_SOON', { earliestStartsAt: new Date(now + EVENT_MIN_LEAD_MS).toISOString() });
    }
    if (lead > EVENT_MAX_LEAD_MS) {
      this.fail('TOO_FAR', { latestStartsAt: new Date(now + EVENT_MAX_LEAD_MS).toISOString() });
    }

    const city = await this.prisma.city.findUnique({
      where: { id: input.cityId },
      select: { id: true, mergedIntoCityId: true },
    });
    if (city === null) throw ApiError.notFound();
    // `city.merged` (§7) : une ville fusionnée n'existe plus pour personne, et un
    // événement créé dessus serait invisible sur la fiche de la ville d'accueil.
    const cityId = city.mergedIntoCityId ?? city.id;

    if (input.communityId !== undefined) {
      await this.assertCommunityMember(input.communityId, organizerUserId);
    }

    const organizer = await this.prisma.user.findUniqueOrThrow({
      where: { id: organizerUserId },
      select: { plan: true },
    });

    const eventId = newId();

    const created = await this.prisma.$transaction(async (tx) => {
      await this.consumeMonthlyQuota(tx, organizerUserId, organizer.plan);

      const event = await tx.event.create({
        data: {
          id: eventId,
          organizerUserId,
          communityId: input.communityId ?? null,
          type: input.type,
          title: input.title,
          description: input.description ?? null,
          cityId,
          venueName: input.venueName ?? null,
          // Stockée TELLE QUELLE. Aucun appel sortant, aucune coordonnée déduite
          // (règle dure §10 : « aucune adresse d'événement n'est envoyée à un
          // service de géocodage »).
          addressText: input.addressText,
          startsAt: input.startsAt,
          endsAt: input.endsAt ?? null,
          capacity: input.capacity ?? null,
          coverAssetId: input.coverAssetId ?? null,
          status: 'SCHEDULED',
        },
        select: EVENT_SELECT,
      });

      // L'organisateur est inscrit d'office : il vient à son propre événement, et
      // ne pas l'inscrire ferait un événement à « 0 participant » affiché à lui.
      await tx.eventAttendee.create({
        data: {
          id: newId(),
          eventId: event.id,
          userId: organizerUserId,
          status: 'GOING',
          respondedAt: new Date(),
        },
      });
      await tx.event.update({ where: { id: event.id }, data: { attendeeCount: 1 } });

      await this.audit.record(tx, {
        actor: { type: 'MEMBER', id: organizerUserId },
        action: 'event.created',
        targetType: 'event',
        targetId: event.id,
        metadata: { cityId, type: input.type, startsAt: input.startsAt.toISOString() },
      });

      // §3.1 « Modération à la publication (comme un post) » : le pipeline de
      // modération s'abonne à cet événement. La table `events` ne porte pas de
      // colonne `moderation_status` — signalé, non contourné.
      await this.outbox.emit(tx, {
        type: 'event.published',
        aggregateId: event.id,
        payload: {
          organizerUserId,
          cityId,
          communityId: input.communityId ?? null,
          type: input.type,
          startsAt: input.startsAt.toISOString(),
        },
      });

      return { ...event, attendeeCount: 1 };
    });

    this.calendarCache.clear();
    return this.toCard(created, { myStatus: 'GOING', myCheckedIn: false, waitlistPosition: null }, organizerUserId);
  }

  /**
   * Quota mensuel (§3.1, RÈGLE DURE §10).
   *
   * On INCRÉMENTE d'abord, on vérifie ensuite, dans la transaction : `upsert`
   * pose un verrou de ligne, donc deux créations simultanées se sérialisent et la
   * seconde voit `2`. Vérifier puis écrire aurait laissé passer les deux — c'est
   * exactement la course qu'un quota de 1 rend facile à gagner.
   *
   * Le dépassement lève, ce qui annule l'incrément avec le reste de la
   * transaction : rien à compenser.
   */
  private async consumeMonthlyQuota(
    tx: Prisma.TransactionClient,
    userId: string,
    plan: string,
  ): Promise<void> {
    // Premium : illimité (§3.1). C'est la seule lecture de `users.plan` de ce
    // module ; `event.attend` ne la fait jamais (règle dure 14 §2).
    if (plan !== 'FREE') return;

    const max = await this.freeEventsPerMonth(tx);
    const periodKey = monthKey(new Date());

    const counter = await tx.usageCounter.upsert({
      where: { userId_metric_periodKey: { userId, metric: 'EVENTS_CREATED', periodKey } },
      create: { userId, metric: 'EVENTS_CREATED', periodKey, count: 1 },
      update: { count: { increment: 1 } },
      select: { count: true },
    });

    if (counter.count > max) {
      throw ApiError.planLimit('eventsPerMonth', counter.count - 1, max);
    }
  }

  /**
   * La limite du plan gratuit, lue dans `plans.limits` quand la ligne existe.
   *
   * La table `plans` n'est pas encore amorcée (le module 14 n'existe pas) : on
   * retombe alors sur la valeur de la spec, 1. Ne PAS retomber signifierait
   * qu'aucune limite ne s'applique tant que la facturation n'est pas livrée — or
   * c'est une règle dure, et elle doit tenir dès maintenant.
   */
  private async freeEventsPerMonth(tx: Prisma.TransactionClient): Promise<number> {
    const plan = await tx.plan.findUnique({ where: { code: 'FREE' }, select: { limits: true } });
    const limits = plan?.limits;
    if (limits !== null && limits !== undefined && typeof limits === 'object' && !Array.isArray(limits)) {
      const raw = (limits as Record<string, unknown>)['eventsPerMonth'];
      if (typeof raw === 'number' && Number.isInteger(raw) && raw >= 0) return raw;
    }
    return FREE_EVENTS_PER_MONTH;
  }

  // ── Modification et annulation (§3.1, §3.4) ───────────────────────────────

  async update(eventId: string, organizerUserId: string, patch: UpdateEvent): Promise<EventCard> {
    const event = await this.loadOwned(eventId, organizerUserId);

    // §3.1 : « Modifiable par l'organisateur jusqu'au début. »
    if (event.startsAt.getTime() <= Date.now()) this.fail('EVENT_STARTED');
    if (event.status !== 'SCHEDULED') throw ApiError.transverse('CONFLICT', { status: event.status });

    const data: Prisma.EventUpdateInput = {};
    const notable: string[] = [];

    if (patch.title !== undefined) data.title = patch.title;
    if (patch.description !== undefined) data.description = patch.description;
    if (patch.type !== undefined) data.type = patch.type;
    if (patch.capacity !== undefined) data.capacity = patch.capacity;
    if (patch.coverAssetId !== undefined) {
      data.coverAsset = { connect: { id: patch.coverAssetId } };
    }

    // §3.1 : « les participants sont notifiés d'un changement de date, d'heure ou
    // de lieu ». Ces trois-là seulement : renommer un pique-nique ne réveille
    // personne, et notifier pour tout finirait par faire ignorer la notification.
    if (patch.venueName !== undefined) {
      data.venueName = patch.venueName;
      notable.push('venueName');
    }
    if (patch.addressText !== undefined) {
      data.addressText = patch.addressText;
      notable.push('addressText');
    }
    if (patch.startsAt !== undefined) {
      const lead = patch.startsAt.getTime() - Date.now();
      if (lead < EVENT_MIN_LEAD_MS) this.fail('TOO_SOON');
      if (lead > EVENT_MAX_LEAD_MS) this.fail('TOO_FAR');
      data.startsAt = patch.startsAt;
      notable.push('startsAt');
    }
    if (patch.endsAt !== undefined) {
      data.endsAt = patch.endsAt;
      notable.push('endsAt');
    }
    if (patch.cityId !== undefined) {
      const city = await this.prisma.city.findUnique({
        where: { id: patch.cityId },
        select: { id: true, mergedIntoCityId: true },
      });
      if (city === null) throw ApiError.notFound();
      data.city = { connect: { id: city.mergedIntoCityId ?? city.id } };
      notable.push('cityId');
    }

    const endsAt = patch.endsAt ?? event.endsAt;
    const startsAt = patch.startsAt ?? event.startsAt;
    if (endsAt !== null && endsAt.getTime() <= startsAt.getTime()) {
      throw ApiError.validation([{ path: 'endsAt', code: 'TOO_SMALL' }]);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.event.update({ where: { id: eventId }, data, select: EVENT_SELECT });

      await this.audit.record(tx, {
        actor: { type: 'MEMBER', id: organizerUserId },
        action: 'event.updated',
        targetType: 'event',
        targetId: eventId,
        metadata: { fields: Object.keys(data) },
      });

      await this.outbox.emit(tx, {
        type: 'event.updated',
        aggregateId: eventId,
        // `notifyAttendees` porte la DÉCISION, pas le consommateur : c'est ici
        // qu'on sait ce qui a changé, et §3.1 ne notifie que date, heure et lieu.
        payload: { fields: Object.keys(data), notifyAttendees: notable.length > 0 },
      });

      return row;
    });

    this.calendarCache.clear();
    return this.cardFor(updated, organizerUserId);
  }

  /** §3.4 : annulation par l'organisateur, motif facultatif, inscrits notifiés. */
  async cancel(eventId: string, organizerUserId: string, input: CancelEvent): Promise<EventCard> {
    const event = await this.loadOwned(eventId, organizerUserId);
    if (event.status === 'CANCELLED') return this.cardFor(event, organizerUserId);
    if (event.status === 'DONE') throw ApiError.transverse('CONFLICT', { status: event.status });

    const withinGrace = Date.now() - event.createdAt.getTime() < EVENT_CANCEL_GRACE_MS;

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.event.update({
        where: { id: eventId },
        data: { status: 'CANCELLED' },
        select: EVENT_SELECT,
      });

      // §3.1 : « Un événement annulé dans l'heure ne compte pas. » Le compteur est
      // celui du MOIS DE CRÉATION, pas du mois courant : un événement créé le 31
      // et annulé le 1er doit rendre le crédit du mois où il a été pris.
      if (withinGrace) {
        await tx.usageCounter.updateMany({
          where: {
            userId: organizerUserId,
            metric: 'EVENTS_CREATED',
            periodKey: monthKey(event.createdAt),
            count: { gt: 0 },
          },
          data: { count: { decrement: 1 } },
        });
      }

      await this.audit.record(tx, {
        actor: { type: 'MEMBER', id: organizerUserId },
        action: 'event.cancelled',
        targetType: 'event',
        targetId: eventId,
        metadata: { withinGrace },
      });

      await this.outbox.emit(tx, {
        type: 'event.cancelled',
        aggregateId: eventId,
        // Le MOTIF vit ici et dans le journal : `events` ne porte ni
        // `cancelled_at` ni `cancel_reason` (colonnes de §4 absentes du schéma).
        payload: {
          organizerUserId,
          reason: input.reason ?? null,
          cancelledAt: new Date().toISOString(),
          withinGrace,
        },
      });

      return row;
    });

    this.calendarCache.clear();
    return this.cardFor(updated, organizerUserId);
  }

  // ── RSVP (§3.2) ───────────────────────────────────────────────────────────

  /**
   * Pose ou change mon RSVP.
   *
   * Deux règles se jouent ici, et aucune n'est un détail d'affichage :
   *
   *   · un membre BLOQUÉ ne peut pas s'inscrire à l'événement de l'autre, dans
   *     les deux sens (§3.2) — et la lecture l'a déjà caché, donc 404 ;
   *   · quand la capacité est atteinte, on n'échoue pas : on met en liste
   *     d'attente (§3.2). La position est calculée, faute de colonne
   *     `waitlist_position` — voir `waitlistPositionOf()`.
   */
  async rsvp(eventId: string, userId: string, input: Rsvp): Promise<{
    status: AttendeeStatus;
    waitlistPosition: number | null;
    attendeeCount: number;
  }> {
    const event = await this.loadVisible(eventId, userId);

    if (event.status !== 'SCHEDULED') throw ApiError.transverse('CONFLICT', { status: event.status });
    if (event.startsAt.getTime() <= Date.now()) this.fail('EVENT_STARTED');

    // La visibilité a déjà écarté un organisateur séparé de moi (404). Ce second
    // contrôle vise le cas inverse : le blocage posé APRÈS l'affichage de la
    // fiche, entre le chargement de l'écran et le clic.
    if (event.organizerUserId !== userId) {
      await this.visibility.assertVisible(userId, event.organizerUserId);
    }

    const existing = await this.prisma.eventAttendee.findUnique({
      where: { eventId_userId: { eventId, userId } },
      select: { id: true, status: true, respondedAt: true },
    });

    const result = await this.prisma.$transaction(async (tx) => {
      // Verrou de ligne sur l'événement : sans lui, deux inscriptions
      // simultanées sur la dernière place passeraient toutes les deux en GOING.
      const locked = await tx.$queryRaw<{ attendee_count: number; capacity: number | null }[]>`
        SELECT attendee_count, capacity FROM events WHERE id = ${eventId}::uuid FOR UPDATE`;
      const snapshot = locked[0];
      if (snapshot === undefined) throw ApiError.notFound();

      const wasGoing = existing?.status === 'GOING';
      let status: AttendeeStatus = input.status;

      if (input.status === 'GOING' && !wasGoing) {
        const full =
          snapshot.capacity !== null && Number(snapshot.attendee_count) >= Number(snapshot.capacity);
        if (full) status = 'WAITLIST';
      }

      const respondedAt = existing === null || existing.status !== status ? new Date() : existing.respondedAt;

      if (existing === null) {
        await tx.eventAttendee.create({
          data: { id: newId(), eventId, userId, status, respondedAt },
        });
      } else {
        await tx.eventAttendee.update({
          where: { id: existing.id },
          data: { status, respondedAt },
        });
      }

      const goingDelta = (status === 'GOING' ? 1 : 0) - (wasGoing ? 1 : 0);
      if (goingDelta !== 0) {
        await tx.event.update({
          where: { id: eventId },
          data: { attendeeCount: { increment: goingDelta } },
        });
      }

      // Une place libérée par un changement de statut promeut la file, exactement
      // comme une désinscription (§8 : « à la désinscription, immédiat »).
      const promoted = goingDelta < 0 ? await this.promoteWaitlist(tx, eventId) : null;

      await this.outbox.emit(tx, {
        type: 'event.rsvp_changed',
        aggregateId: eventId,
        payload: {
          userId,
          from: existing?.status ?? null,
          to: status,
          promotedUserId: promoted,
        },
      });

      const fresh = await tx.event.findUniqueOrThrow({
        where: { id: eventId },
        select: { attendeeCount: true },
      });
      return { status, attendeeCount: fresh.attendeeCount };
    });

    this.calendarCache.clear();
    return {
      status: result.status,
      waitlistPosition:
        result.status === 'WAITLIST' ? await this.waitlistPositionOf(eventId, userId) : null,
      attendeeCount: result.attendeeCount,
    };
  }

  /** Désinscription complète. La ligne disparaît — §9 : « RSVP : supprimés ». */
  async withdraw(eventId: string, userId: string): Promise<{ attendeeCount: number }> {
    const event = await this.loadVisible(eventId, userId);

    const attendee = await this.prisma.eventAttendee.findUnique({
      where: { eventId_userId: { eventId, userId } },
      select: { id: true, status: true },
    });
    if (attendee === null) throw ApiError.notFound();
    // L'organisateur ne se retire pas de son propre événement : il l'annule.
    if (event.organizerUserId === userId) {
      throw ApiError.transverse('CONFLICT', { reason: 'ORGANIZER_CANNOT_WITHDRAW' });
    }

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.eventAttendee.delete({ where: { id: attendee.id } });

      if (attendee.status === 'GOING') {
        await tx.event.update({
          where: { id: eventId },
          data: { attendeeCount: { decrement: 1 } },
        });
      }

      const promoted = attendee.status === 'GOING' ? await this.promoteWaitlist(tx, eventId) : null;

      await this.outbox.emit(tx, {
        type: 'event.rsvp_changed',
        aggregateId: eventId,
        payload: { userId, from: attendee.status, to: null, promotedUserId: promoted },
      });

      const fresh = await tx.event.findUniqueOrThrow({
        where: { id: eventId },
        select: { attendeeCount: true },
      });
      return { attendeeCount: fresh.attendeeCount };
    });

    this.calendarCache.clear();
    return result;
  }

  /**
   * Promotion de la liste d'attente (§3.2, §8).
   *
   * Le premier arrivé dans la file, et un seul : une désinscription libère UNE
   * place. L'ordre est `responded_at`, faute de colonne `waitlist_position` —
   * c'est le même ordre, mais il se recalcule au lieu d'être stocké.
   *
   * Rend l'identifiant promu, pour que la notification du §3.2 parte de l'appelant
   * avec le reste de la transaction.
   */
  private async promoteWaitlist(
    tx: Prisma.TransactionClient,
    eventId: string,
  ): Promise<string | null> {
    const event = await tx.event.findUniqueOrThrow({
      where: { id: eventId },
      select: { capacity: true, attendeeCount: true, status: true },
    });
    if (event.status !== 'SCHEDULED') return null;
    if (event.capacity === null || event.attendeeCount >= event.capacity) return null;

    const next = await tx.eventAttendee.findFirst({
      where: { eventId, status: 'WAITLIST' },
      orderBy: [{ respondedAt: 'asc' }, { id: 'asc' }],
      select: { id: true, userId: true },
    });
    if (next === null) return null;

    await tx.eventAttendee.update({ where: { id: next.id }, data: { status: 'GOING' } });
    await tx.event.update({ where: { id: eventId }, data: { attendeeCount: { increment: 1 } } });
    return next.userId;
  }

  /** La position dans la file, comptée sur `responded_at`. 1 = le prochain promu. */
  private async waitlistPositionOf(eventId: string, userId: string): Promise<number | null> {
    const mine = await this.prisma.eventAttendee.findUnique({
      where: { eventId_userId: { eventId, userId } },
      select: { status: true, respondedAt: true },
    });
    if (mine === null || mine.status !== 'WAITLIST') return null;
    const ahead = await this.prisma.eventAttendee.count({
      where: { eventId, status: 'WAITLIST', respondedAt: { lt: mine.respondedAt } },
    });
    return ahead + 1;
  }

  // ── Présence (§3.3) ───────────────────────────────────────────────────────

  /**
   * Coche les présents.
   *
   * Deux gestes, une route (§5) : l'organisateur coche une liste, le participant
   * se déclare lui-même. La FENÊTRE diffère, et c'est voulu :
   *
   *   · le participant, de H−0 à H+6 (§3.3) : « Je suis là » pendant l'événement ;
   *   · l'organisateur, du début de l'événement jusqu'au passage à DONE, parce
   *     que §3.3 lui fait cocher « après le début » et que la liste se remplit
   *     souvent une fois tout le monde reparti.
   */
  async checkIn(
    eventId: string,
    actorUserId: string,
    input: CheckIn,
  ): Promise<{ checkedIn: string[]; checkedInCount: number }> {
    const event = await this.loadVisible(eventId, actorUserId);
    if (event.status === 'CANCELLED') throw ApiError.transverse('CONFLICT', { status: event.status });

    const now = Date.now();
    const started = event.startsAt.getTime();
    if (now < started) this.fail('CHECKIN_WINDOW_CLOSED', { opensAt: event.startsAt.toISOString() });

    const isOrganizer = event.organizerUserId === actorUserId;
    const targets = input.userIds ?? [actorUserId];

    if (!isOrganizer) {
      // Un participant ne coche QUE lui-même : cocher un autre membre serait
      // déclarer sa présence physique à sa place.
      if (targets.length !== 1 || targets[0] !== actorUserId) throw ApiError.notFound();
      if (now > started + SELF_CHECKIN_WINDOW_MS) {
        this.fail('CHECKIN_WINDOW_CLOSED', {
          closedAt: new Date(started + SELF_CHECKIN_WINDOW_MS).toISOString(),
        });
      }
    } else if (event.status !== 'SCHEDULED') {
      // La fenêtre de l'organisateur se ferme sur le STATUT, pas sur l'horloge.
      //
      // Bogue trouvé en exerçant la route : bornée à `doneAt()`, elle refusait
      // l'organisateur d'un événement sans heure de fin dès H+4, alors que
      // `event.mark_done` ne passe qu'une fois par heure et que le crédit
      // `EVENT_ORGANIZED` se décide AU passage à DONE. Entre les deux, la feuille
      // de présence était donc fermée sur un événement encore SCHEDULED — et
      // l'indicateur clé de la plateforme perdait ses présences en silence.
      this.fail('CHECKIN_WINDOW_CLOSED', {
        status: event.status,
        closedAt: doneAt(event.startsAt, event.endsAt).toISOString(),
      });
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // Seuls les INSCRITS : cocher quelqu'un qui n'a pas répondu inventerait une
      // présence, et l'indicateur clé compte « les inscrits qui participent ».
      const attendees = await tx.eventAttendee.findMany({
        where: { eventId, userId: { in: targets }, status: { in: ['GOING', 'MAYBE', 'WAITLIST'] } },
        select: { id: true, userId: true, checkedIn: true },
      });

      const toCheck = attendees.filter((a) => !a.checkedIn);
      if (toCheck.length > 0) {
        await tx.eventAttendee.updateMany({
          where: { id: { in: toCheck.map((a) => a.id) } },
          data: { checkedIn: true },
        });
      }

      const checkedInCount = await tx.eventAttendee.count({ where: { eventId, checkedIn: true } });

      if (toCheck.length > 0) {
        await this.outbox.emit(tx, {
          type: 'event.checked_in',
          aggregateId: eventId,
          // §3.3 : « Deux `checked_in` au même événement → suggestion de contact
          // (module 08) », et l'indicateur clé se calcule sur ces lignes.
          payload: {
            userIds: toCheck.map((a) => a.userId),
            by: isOrganizer ? 'ORGANIZER' : 'SELF',
            checkedInCount,
          },
        });
      }

      return { checkedIn: toCheck.map((a) => a.userId), checkedInCount };
    });

    return result;
  }

  // ── Lecture (§5) ──────────────────────────────────────────────────────────

  async detail(eventId: string, viewerId: string | null): Promise<EventCard & {
    attendees: { handle: string | null; displayName: string; avatarUrl: string | null }[];
    checkedInCount: number | null;
  }> {
    const event = await this.loadVisible(eventId, viewerId);
    const card = await this.cardFor(event, viewerId);

    // §3.2 : « les participants voient les avatars des GOING et le compteur ».
    const going = await this.prisma.eventAttendee.findMany({
      where: { eventId, status: 'GOING' },
      orderBy: { respondedAt: 'asc' },
      take: 24,
      select: {
        user: { select: { handle: true, displayName: true, avatarAsset: { select: { storageKey: true } } } },
      },
    });

    return {
      ...card,
      attendees: going.map((a) => ({
        handle: a.user.handle,
        displayName: a.user.displayName,
        avatarUrl: mediaUrl(a.user.avatarAsset?.storageKey),
      })),
      // Le compte des présents ne sort qu'à l'organisateur avant DONE : c'est sa
      // feuille de présence, pas une statistique publique.
      checkedInCount:
        card.isOrganizer || event.status === 'DONE'
          ? await this.prisma.eventAttendee.count({ where: { eventId, checkedIn: true } })
          : null,
    };
  }

  /** §5 : organisateur → liste complète ; autres → avatars des `GOING`. */
  async attendees(eventId: string, viewerId: string | null) {
    const event = await this.loadVisible(eventId, viewerId);
    const isOrganizer = viewerId !== null && event.organizerUserId === viewerId;

    const rows = await this.prisma.eventAttendee.findMany({
      where: { eventId, ...(isOrganizer ? {} : { status: 'GOING' }) },
      orderBy: [{ status: 'asc' }, { respondedAt: 'asc' }],
      select: {
        userId: true,
        status: true,
        checkedIn: true,
        respondedAt: true,
        user: { select: { handle: true, displayName: true, avatarAsset: { select: { storageKey: true } } } },
      },
    });

    let waitlistRank = 0;
    const items = rows.map((row) => {
      if (row.status === 'WAITLIST') waitlistRank += 1;
      return {
        // L'identifiant ne sort qu'à l'organisateur : lui seul coche les présents.
        ...(isOrganizer ? { userId: row.userId } : {}),
        handle: row.user.handle,
        displayName: row.user.displayName,
        avatarUrl: mediaUrl(row.user.avatarAsset?.storageKey),
        status: row.status,
        ...(isOrganizer ? { checkedIn: row.checkedIn } : {}),
        ...(row.status === 'WAITLIST' ? { waitlistPosition: waitlistRank } : {}),
      };
    });

    return {
      items,
      nextCursor: null,
      meta: {
        going: rows.filter((r) => r.status === 'GOING').length,
        ...(isOrganizer
          ? {
              maybe: rows.filter((r) => r.status === 'MAYBE').length,
              waitlist: rows.filter((r) => r.status === 'WAITLIST').length,
              declined: rows.filter((r) => r.status === 'DECLINED').length,
              checkedIn: rows.filter((r) => r.checkedIn).length,
            }
          : {}),
      },
    };
  }

  /**
   * La liste d'événements (§5).
   *
   * « Les participations du membre en tête » : le tri ne peut donc pas être une
   * simple clause SQL sur `starts_at`. On pagine sur (participation, début, id)
   * — en deux passes, mes participations d'abord — ce que le curseur signé porte
   * dans son `sort`.
   */
  async list(query: EventsQuery, viewerId: string | null) {
    const zone = await this.referenceZone(viewerId);
    const window = this.windowOf(query, zone);
    const cityIds = await this.scopeCityIds(query, viewerId);

    const where = await this.visibleWhere(viewerId, cityIds, query, window);

    const scope = `events:${query.scope}:${query.date ?? ''}:${query.from ?? ''}:${query.to ?? ''}:${query.cityId ?? ''}:${query.radiusKm}:${query.type ?? ''}`;
    const after =
      query.cursor === undefined ? null : decodeCursor(query.cursor, this.cursorSecret, scope);

    const rows = await this.prisma.event.findMany({
      where: {
        ...where,
        ...(after === null
          ? {}
          : {
              OR: [
                { startsAt: { gt: new Date(Number(after.sort)) } },
                { startsAt: new Date(Number(after.sort)), id: { gt: after.id } },
              ],
            }),
      },
      orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
      take: query.limit + 1,
      select: EVENT_SELECT,
    });

    const mine = await this.myStatuses(viewerId, rows.map((r) => r.id));

    // Le jour civil est celui de la VILLE de l'événement (§3.5) : un événement
    // qui, dans son fuseau, ne tombe pas le jour demandé n'a rien à faire là.
    const filtered =
      query.date === undefined
        ? rows
        : rows.filter((row) => localDate(row.startsAt, zoneOf(row.city.country.iso2, this.defaultTimeZone)) === query.date);

    const page = buildPage(filtered, query.limit, scope, this.cursorSecret, (row) =>
      row.startsAt.getTime(),
    );

    const cards = page.items.map((row) =>
      this.toCard(row, mine.get(row.id) ?? null, viewerId),
    );

    // §3.5 : « mes participations en tête, marquées, puis les autres ». Le tri
    // final est stable : à égalité de participation, l'ordre chronologique tient.
    const attending = (card: EventCard) => (card.myStatus === 'GOING' || card.myStatus === 'WAITLIST' ? 0 : 1);
    cards.sort((a, b) => attending(a) - attending(b) || a.startsAt.getTime() - b.startsAt.getTime());

    return { items: cards, nextCursor: page.nextCursor };
  }

  /**
   * Le calendrier vertical (§3.5, §5).
   *
   * Un objet PAR JOUR, y compris les jours vides : §3.5 les veut « présents mais
   * atténués ». Les omettre obligerait le front à reconstruire la grille, et il
   * la reconstruirait dans SON fuseau.
   */
  async calendar(query: CalendarQuery, viewerId: string | null): Promise<{ items: CalendarDay[]; meta: Record<string, unknown> }> {
    const zone = await this.referenceZone(viewerId);
    const cacheKey = `${viewerId ?? 'anon'}:${zone}:${query.from}:${query.to}`;
    const cached = this.calendarCache.get(cacheKey);
    if (cached !== undefined && Date.now() - cached.at < CALENDAR_CACHE_MS) {
      return { items: cached.days, meta: { timeZone: zone, cached: true } };
    }

    const from = startOfLocalDay(query.from, zone);
    const to = startOfLocalDay(nextLocalDate(query.to), zone);
    const cityIds = await this.nearbyCityIds(viewerId, null, undefined);

    const where = await this.visibleWhere(viewerId, cityIds, { scope: 'all' }, { from, to });

    const rows = await this.prisma.event.findMany({
      where,
      orderBy: [{ startsAt: 'asc' }],
      select: {
        id: true,
        title: true,
        startsAt: true,
        city: { select: { country: { select: { iso2: true } } } },
      },
    });

    const mine = await this.myStatuses(viewerId, rows.map((r) => r.id));

    const byDay = new Map<string, { total: number; attending: number; firstTitle: string | null }>();
    for (const row of rows) {
      const day = localDate(row.startsAt, zoneOf(row.city.country.iso2, this.defaultTimeZone));
      const bucket = byDay.get(day) ?? { total: 0, attending: 0, firstTitle: null };
      bucket.total += 1;
      if (bucket.firstTitle === null) bucket.firstTitle = row.title;
      const status = mine.get(row.id)?.myStatus;
      if (status === 'GOING' || status === 'WAITLIST') bucket.attending += 1;
      byDay.set(day, bucket);
    }

    const days: CalendarDay[] = [];
    for (let day = query.from; day <= query.to; day = nextLocalDate(day)) {
      const bucket = byDay.get(day);
      days.push({
        date: day,
        total: bucket?.total ?? 0,
        attending: bucket?.attending ?? 0,
        firstTitle: bucket?.firstTitle ?? null,
      });
    }

    this.calendarCache.set(cacheKey, { at: Date.now(), days });
    return { items: days, meta: { timeZone: zone, cached: false } };
  }

  // ── Tâches planifiées (§8) ────────────────────────────────────────────────

  /**
   * `event.mark_done` (§8, horaire) — et la RÈGLE DURE du §3.3.
   *
   * « `EVENT_ORGANIZED` en réputation : événement `DONE` avec ≥ 3 présents
   * cochés. Pas de réputation pour un événement sans présence enregistrée —
   * évite les événements fantômes. »
   *
   * Le crédit est écrit ici, dans la même transaction que le passage à DONE :
   * `reputation_events` porte une contrainte d'unicité (00 §9.4) qui rend
   * l'opération idempotente, donc un rejeu ne double rien.
   */
  async markDone(now = new Date()): Promise<{ done: number; credited: number }> {
    const due = await this.prisma.event.findMany({
      where: {
        status: 'SCHEDULED',
        deletedAt: null,
        OR: [
          { endsAt: { not: null, lt: new Date(now.getTime() - EVENT_DONE_AFTER_END_MS) } },
          { endsAt: null, startsAt: { lt: new Date(now.getTime() - EVENT_DONE_AFTER_START_MS) } },
        ],
      },
      select: { id: true, organizerUserId: true, startsAt: true, endsAt: true },
      take: 500,
    });

    let credited = 0;

    for (const event of due) {
      await this.prisma.$transaction(async (tx) => {
        const checkedInCount = await tx.eventAttendee.count({
          where: { eventId: event.id, checkedIn: true },
        });

        await tx.event.update({ where: { id: event.id }, data: { status: 'DONE' } });

        const eligible = checkedInCount >= EVENT_ORGANIZED_MIN_CHECKINS;
        if (eligible) {
          // `createMany` + `skipDuplicates` plutôt que `create` : la contrainte
          // d'unicité fait foi, et une ligne déjà là n'est pas une erreur.
          await tx.reputationEvent.createMany({
            data: [
              {
                id: newId(),
                userId: event.organizerUserId,
                type: 'EVENT_ORGANIZED',
                sourceType: 'event',
                sourceId: event.id,
              },
            ],
            skipDuplicates: true,
          });
          credited += 1;
        }

        await this.outbox.emit(tx, {
          type: 'event.done',
          aggregateId: event.id,
          payload: {
            organizerUserId: event.organizerUserId,
            checkedInCount,
            // La DÉCISION est prise ici, pas chez le consommateur : elle est une
            // règle dure, et la laisser à la réputation la dupliquerait.
            reputationCredited: eligible,
          },
        });
      });
    }

    this.calendarCache.clear();
    return { done: due.length, credited };
  }

  /**
   * `event.hide_cancelled` (§8, quotidienne).
   *
   * §3.4 : « Un événement annulé reste visible 7 jours barré, puis masqué. » Sans
   * colonne `cancelled_at`, la borne est `updated_at` — l'annulation est la
   * dernière écriture d'un événement annulé. Le masquage est donc aussi APPLIQUÉ
   * à la lecture (`visibleWhere`) : la tâche ne fait qu'alléger les requêtes.
   */
  async hideCancelled(now = new Date()): Promise<{ hidden: number }> {
    const cutoff = new Date(now.getTime() - CANCELLED_VISIBLE_DAYS * 86_400_000);
    const result = await this.prisma.event.updateMany({
      where: { status: 'CANCELLED', deletedAt: null, updatedAt: { lt: cutoff } },
      data: { deletedAt: now },
    });
    this.calendarCache.clear();
    return { hidden: result.count };
  }

  /**
   * `event.reminders` (§8, toutes les 15 min) — J−1, H−2, résumé organisateur.
   *
   * Cette méthode ne fait que MARQUER et émettre : les canaux (push si activé,
   * sinon in-app) appartiennent au module 11-12. `reminder_sent_at` est la seule
   * colonne disponible pour l'idempotence ; elle ne peut retenir qu'UN envoi,
   * alors que §3.3 en prévoit trois. On s'en sert pour le rappel le plus proche
   * (H−2), et le J−1 comme le résumé H−24 restent à câbler quand la table des
   * notifications existera — signalé plutôt que deviné.
   */
  async sendDueReminders(now = new Date()): Promise<{ notified: number }> {
    const horizon = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const due = await this.prisma.event.findMany({
      where: {
        status: 'SCHEDULED',
        deletedAt: null,
        reminderSentAt: null,
        startsAt: { gt: now, lte: horizon },
      },
      select: { id: true, organizerUserId: true, startsAt: true },
      take: 200,
    });

    for (const event of due) {
      await this.prisma.$transaction(async (tx) => {
        await tx.event.update({ where: { id: event.id }, data: { reminderSentAt: now } });
        const counts = await tx.eventAttendee.groupBy({
          by: ['status'],
          where: { eventId: event.id },
          _count: { _all: true },
        });
        await this.outbox.emit(tx, {
          type: 'event.updated',
          aggregateId: event.id,
          payload: {
            reminder: 'H_MINUS_2',
            notifyAttendees: true,
            startsAt: event.startsAt.toISOString(),
            counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])),
          },
        });
      });
    }

    return { notified: due.length };
  }

  // ── Visibilité et outils ──────────────────────────────────────────────────

  /**
   * Charge un événement LISIBLE par ce membre, ou lève 404.
   *
   * RÈGLE DURE (§10) : « un événement réservé à un réseau n'est pas renvoyé à un
   * non-membre ». Et 404, pas 403 (T4 §3) : dire « cet événement existe mais il
   * n'est pas pour vous » révèle déjà l'événement du réseau.
   */
  private async loadVisible(eventId: string, viewerId: string | null): Promise<EventRow> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: EVENT_SELECT,
    });
    // §9 et 00 §6.1 : `deleted_at` est exclu par défaut, partout.
    if (event === null || event.deletedAt !== null) throw ApiError.notFound();

    if (event.communityId !== null) {
      if (viewerId === null) throw ApiError.notFound();
      const member = await this.prisma.communityMember.findUnique({
        where: { communityId_userId: { communityId: event.communityId, userId: viewerId } },
        select: { status: true },
      });
      if (member === null || member.status !== 'ACTIVE') throw ApiError.notFound();
    }

    if (viewerId !== null && event.organizerUserId !== viewerId) {
      await this.visibility.assertVisible(viewerId, event.organizerUserId);
    }

    // §3.4 : passé 7 jours, un événement annulé est masqué.
    if (event.status === 'CANCELLED') {
      const cutoff = Date.now() - CANCELLED_VISIBLE_DAYS * 86_400_000;
      if (event.updatedAt.getTime() < cutoff) throw ApiError.notFound();
    }

    return event;
  }

  /** Charge un événement dont je suis l'organisateur, ou lève 404. */
  private async loadOwned(eventId: string, organizerUserId: string): Promise<EventRow> {
    const event = await this.loadVisible(eventId, organizerUserId);
    // 404 et non 403 : à qui n'organise pas, l'événement n'est pas modifiable, et
    // le distinguer d'un événement inexistant n'apporte rien (T4 §3).
    if (event.organizerUserId !== organizerUserId) throw ApiError.notFound();
    return event;
  }

  /** Le filtre de visibilité d'une LISTE : réseaux, blocages, annulations, fenêtre. */
  private async visibleWhere(
    viewerId: string | null,
    cityIds: string[] | null,
    query: { scope: 'all' | 'mine' | 'organized'; type?: string | undefined },
    window: { from: Date; to: Date },
  ): Promise<Prisma.EventWhereInput> {
    const separated = await this.visibility.separatedFrom(viewerId);
    const communityIds = await this.myCommunityIds(viewerId);
    const cancelledCutoff = new Date(Date.now() - CANCELLED_VISIBLE_DAYS * 86_400_000);

    const and: Prisma.EventWhereInput[] = [
      // RÈGLE DURE §10 : un événement de réseau n'existe que pour ses membres.
      {
        OR: [
          { communityId: null },
          ...(communityIds.length > 0 ? [{ communityId: { in: communityIds } }] : []),
        ],
      },
      // §3.4 : annulé = visible 7 jours, barré, puis plus du tout.
      {
        OR: [
          { status: { in: ['SCHEDULED', 'DONE'] } },
          { status: 'CANCELLED', updatedAt: { gte: cancelledCutoff } },
        ],
      },
    ];

    if (query.scope === 'mine') {
      if (viewerId === null) throw ApiError.transverse('UNAUTHENTICATED');
      and.push({ attendees: { some: { userId: viewerId, status: { in: ['GOING', 'MAYBE', 'WAITLIST'] } } } });
    }
    if (query.scope === 'organized') {
      if (viewerId === null) throw ApiError.transverse('UNAUTHENTICATED');
      and.push({ organizerUserId: viewerId });
    }

    // Le filtre de ville ne s'applique PAS à mes participations : un événement
    // auquel je suis inscrit à 400 km reste le mien, et §3.5 le veut en tête.
    if (cityIds !== null && query.scope === 'all') {
      and.push(
        viewerId === null
          ? { cityId: { in: cityIds } }
          : {
              OR: [
                { cityId: { in: cityIds } },
                { attendees: { some: { userId: viewerId, status: { in: ['GOING', 'WAITLIST'] } } } },
              ],
            },
      );
    } else if (cityIds !== null) {
      and.push({ cityId: { in: cityIds } });
    }

    return {
      deletedAt: null,
      startsAt: { gte: window.from, lt: window.to },
      ...(query.type === undefined ? {} : { type: query.type as never }),
      ...(separated.length > 0 ? { organizerUserId: { notIn: separated } } : {}),
      AND: and,
    };
  }

  private async myCommunityIds(viewerId: string | null): Promise<string[]> {
    if (viewerId === null) return [];
    const rows = await this.prisma.communityMember.findMany({
      where: { userId: viewerId, status: 'ACTIVE' },
      select: { communityId: true },
    });
    return rows.map((r) => r.communityId);
  }

  private async myStatuses(
    viewerId: string | null,
    eventIds: string[],
  ): Promise<Map<string, MyAttendance>> {
    if (viewerId === null || eventIds.length === 0) return new Map();
    const rows = await this.prisma.eventAttendee.findMany({
      where: { userId: viewerId, eventId: { in: eventIds } },
      select: { eventId: true, status: true, checkedIn: true },
    });
    return new Map(
      rows.map((r) => [
        r.eventId,
        { myStatus: r.status, myCheckedIn: r.checkedIn, waitlistPosition: null },
      ]),
    );
  }

  /** Les villes du périmètre demandé : ville explicite + rayon, sinon la mienne. */
  private async scopeCityIds(query: EventsQuery, viewerId: string | null): Promise<string[] | null> {
    if (query.scope !== 'all') return null;
    return this.nearbyCityIds(viewerId, query.cityId ?? null, query.radiusKm);
  }

  /**
   * Les villes « près de moi » : la ville de référence et celles dans le rayon.
   *
   * Haversine en mémoire, sur les villes actives (02 §3 : « pas de PostGIS »).
   * Elles se comptent en dizaines : une requête géographique coûterait plus cher
   * à maintenir qu'à exécuter.
   */
  private async nearbyCityIds(
    viewerId: string | null,
    cityId: string | null,
    radiusKm: number | undefined,
  ): Promise<string[] | null> {
    let centerId = cityId;
    if (centerId === null && viewerId !== null) {
      const me = await this.prisma.user.findUnique({
        where: { id: viewerId },
        select: { cityId: true },
      });
      centerId = me?.cityId ?? null;
    }
    // Sans ville de référence, pas de filtre : mieux vaut tout l'agenda qu'un
    // agenda vide pour qui n'a pas encore renseigné sa ville.
    if (centerId === null) return null;

    const center = await this.prisma.city.findUnique({
      where: { id: centerId },
      select: { id: true, latitude: true, longitude: true },
    });
    if (center === null) return null;

    const radius = radiusKm ?? 30;
    if (radius === 0) return [center.id];

    const cities = await this.prisma.city.findMany({
      where: { mergedIntoCityId: null },
      select: { id: true, latitude: true, longitude: true },
    });

    return cities
      .filter(
        (city) =>
          city.id === center.id ||
          haversineKm(
            Number(center.latitude),
            Number(center.longitude),
            Number(city.latitude),
            Number(city.longitude),
          ) <= radius,
      )
      .map((city) => city.id);
  }

  /** La fenêtre UTC d'une requête, dérivée des jours civils demandés. */
  private windowOf(query: EventsQuery, zone: string): { from: Date; to: Date } {
    if (query.date !== undefined) {
      return {
        from: startOfLocalDay(query.date, zone),
        to: startOfLocalDay(nextLocalDate(query.date), zone),
      };
    }
    if (query.from !== undefined || query.to !== undefined) {
      return {
        from:
          query.from === undefined
            ? new Date(Date.now() - 62 * 86_400_000)
            : startOfLocalDay(query.from, zone),
        to:
          query.to === undefined
            ? new Date(Date.now() + 366 * 86_400_000)
            : startOfLocalDay(nextLocalDate(query.to), zone),
      };
    }
    // Par défaut : à venir. La colonne droite de l'accueil veut « 3 prochains ».
    return { from: new Date(), to: new Date(Date.now() + 366 * 86_400_000) };
  }

  /**
   * Le fuseau de RÉFÉRENCE du membre — celui dans lequel la grille de jours est
   * construite. Chaque événement garde ensuite le fuseau de SA ville.
   */
  private async referenceZone(viewerId: string | null): Promise<string> {
    if (viewerId === null) return this.defaultTimeZone;
    const me = await this.prisma.user.findUnique({
      where: { id: viewerId },
      select: { timezone: true, city: { select: { country: { select: { iso2: true } } } } },
    });
    if (me === null) return this.defaultTimeZone;
    // La ville d'abord (§3.5 : l'agenda est local), le fuseau déclaré ensuite.
    const cityZone = me.city === null ? undefined : TIME_ZONE_BY_COUNTRY_ISO2[me.city.country.iso2];
    return cityZone ?? me.timezone ?? this.defaultTimeZone;
  }

  private async assertCommunityMember(communityId: string, userId: string): Promise<void> {
    const member = await this.prisma.communityMember.findUnique({
      where: { communityId_userId: { communityId, userId } },
      select: { status: true },
    });
    // 404 : un réseau dont on n'est pas membre ne doit pas se confirmer par un 403.
    if (member === null || member.status !== 'ACTIVE') throw ApiError.notFound();
  }

  private async cardFor(event: EventRow, viewerId: string | null): Promise<EventCard> {
    if (viewerId === null) return this.toCard(event, null, null);
    const mine = await this.prisma.eventAttendee.findUnique({
      where: { eventId_userId: { eventId: event.id, userId: viewerId } },
      select: { status: true, checkedIn: true },
    });
    return this.toCard(
      event,
      mine === null
        ? null
        : {
            myStatus: mine.status,
            myCheckedIn: mine.checkedIn,
            waitlistPosition:
              mine.status === 'WAITLIST' ? await this.waitlistPositionOf(event.id, viewerId) : null,
          },
      viewerId,
    );
  }

  private toCard(
    event: EventRow,
    mine: MyAttendance | null,
    viewerId: string | null,
  ): EventCard {
    const zone = zoneOf(event.city.country.iso2, this.defaultTimeZone);
    return {
      id: event.id,
      type: event.type,
      title: event.title,
      description: event.description,
      city: { id: event.city.id, name: event.city.name, slug: event.city.slug },
      venueName: event.venueName,
      addressText: event.addressText,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      timeZone: zone,
      localDate: localDate(event.startsAt, zone),
      capacity: event.capacity,
      attendeeCount: event.attendeeCount,
      status: event.status,
      communityId: event.communityId,
      organizer: {
        handle: event.organizer.handle,
        displayName: event.organizer.displayName,
        avatarUrl: mediaUrl(event.organizer.avatarAsset?.storageKey),
      },
      coverUrl: mediaUrl(event.coverAsset?.storageKey),
      myStatus: mine?.myStatus ?? null,
      myWaitlistPosition: mine?.waitlistPosition ?? null,
      myCheckedIn: mine?.myCheckedIn ?? false,
      isOrganizer: viewerId !== null && event.organizerUserId === viewerId,
    };
  }
}

// ── Fuseaux et jours civils ─────────────────────────────────────────────────
//
// Exportées pour être éprouvées directement : le décalage d'un jour ne se voit
// pas dans une réponse HTTP, il se voit dans un cas limite (23 h, changement
// d'heure) qu'un test doit pouvoir viser.

/** Le fuseau d'une ville, d'après son pays. */
export function zoneOf(countryIso2: string, fallback: string): string {
  return TIME_ZONE_BY_COUNTRY_ISO2[countryIso2] ?? fallback;
}

/** Le jour civil (AAAA-MM-JJ) d'un instant, dans un fuseau donné. */
export function localDate(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Le décalage du fuseau à cet instant, en millisecondes. */
function zoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);
  const get = (type: string): number => Number(parts.find((p) => p.type === type)?.value ?? '0');
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'));
  // Les parts n'ont pas les millisecondes : on compare à la seconde, sinon le
  // décalage sortirait avec un reste de quelques centaines de millisecondes.
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/**
 * L'instant UTC où commence un jour civil, dans un fuseau donné.
 *
 * DEUX passes, et c'est le cœur du calcul : le décalage dépend de l'instant, et
 * l'instant dépend du décalage. La nuit du changement d'heure, une seule passe
 * se trompe d'une heure — et le calendrier vertical déplace alors un événement
 * de fin de soirée au jour suivant.
 */
export function startOfLocalDay(date: string, timeZone: string): Date {
  const naive = Date.parse(`${date}T00:00:00Z`);
  const first = zoneOffsetMs(new Date(naive), timeZone);
  const candidate = naive - first;
  const second = zoneOffsetMs(new Date(candidate), timeZone);
  return new Date(second === first ? candidate : naive - second);
}

/** Le lendemain d'un jour civil. Arithmétique UTC : un jour civil n'a pas d'heure. */
export function nextLocalDate(date: string): string {
  const next = new Date(Date.parse(`${date}T00:00:00Z`) + 86_400_000);
  return next.toISOString().slice(0, 10);
}

/** Clé de période des compteurs d'usage : AAAA-MM (14 §… et `usage_counters`). */
export function monthKey(instant: Date): string {
  return instant.toISOString().slice(0, 7);
}

/** §3.3 : DONE 12 h après la fin, ou 4 h après le début quand la fin manque. */
export function doneAt(startsAt: Date, endsAt: Date | null): Date {
  return endsAt === null
    ? new Date(startsAt.getTime() + EVENT_DONE_AFTER_START_MS)
    : new Date(endsAt.getTime() + EVENT_DONE_AFTER_END_MS);
}

/** Distance à vol d'oiseau, en kilomètres (02 §3 : haversine, pas de PostGIS). */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number): number => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(a)));
}

function mediaUrl(storageKey: string | undefined): string | null {
  return storageKey === undefined ? null : `/media/${storageKey}`;
}
