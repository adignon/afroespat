import { Injectable, Logger } from '@nestjs/common';
import { newId, type Prisma } from '@app/db';
import {
  type CreateMentorship,
  MENTORSHIP_DURATION_MS,
  MENTORSHIP_ERROR_CODES,
  MENTORSHIP_ERROR_MESSAGES,
  MENTORSHIP_MONEY_BANNER,
  MENTORSHIP_REQUEST_EXPIRY_MS,
  MENTORSHIP_REVIEW_WINDOW_MS,
  MENTORSHIP_REVIEWS_BOTH_IN,
  MENTOR_MAX_MAX_MENTEES,
  MENTOR_SETTLED_MONTHS,
  type MentorProfileInput,
  type MentorshipErrorCode,
  type MentorshipReviewInput,
  type MentorsQuery,
  type MyMentorshipsQuery,
  type VerificationLevel,
} from '@app/shared';
import { ApiError } from '../../common/api-error';
import { AuditService } from '../../common/audit.service';
import { buildPage, decodeCursor } from '../../common/cursor';
import { OutboxService } from '../../common/outbox.service';
import { PrismaService } from '../../common/prisma.service';
import { VisibilityService } from '../../common/visibility.service';
import { loadEnv } from '../../config/env';
import { MessagingService } from '../messaging/messaging.service';

/**
 * Parrainage — 08-parrainage-messagerie.md §2.
 *
 * Le parrainage est BORNÉ, et chaque borne existe contre un risque précis :
 *
 *   · 90 JOURS, parce qu'un accompagnement sans fin devient une dépendance, et
 *     parce qu'une relation qui s'éteint sans être fermée laisse les deux membres
 *     dans un flou que personne n'ose rompre ;
 *   · 2 FILLEULS par défaut, 3 au maximum, parce qu'un parrain saturé abandonne
 *     ses filleuls plutôt que d'en refuser un (décision T4) ;
 *   · UNE SEULE demande en attente par membre, parce que dix demandes simultanées
 *     transformeraient le parrainage en marché ;
 *   · JAMAIS D'ARGENT (règle dure §2.4). Le bandeau accompagne toutes les
 *     réponses, la conversation MENTORSHIP est surveillée par la modération IA en
 *     priorité 1 sur `MONEY_REQUEST`.
 *
 * DEUX COLONNES « AJOUTÉES » PAR §6, ET ENFIN POSÉES. `mentorships.extended_once`
 * (booléen) et `mentorships.expires_at` (la demande expire à 7 jours) étaient
 * DÉDUITES quand le schéma ne les portait pas — « déjà prolongé » se lisait sur
 * `ends_at > accepted_at + 90 jours`, « demande expirée » sur `created_at + 7 j`.
 * La déduction était exacte, mais elle interdisait deux choses : changer la durée
 * de l'expiration sans réécrire l'historique (les anciennes lignes auraient changé
 * d'état d'un coup), et filtrer en SQL sur l'échéance (la tâche
 * `mentorship.expire_requests` balayait sur `created_at`). La migration
 * `20261017040000_entraide_parrainage` ajoute les deux colonnes et reprend
 * l'existant avec EXACTEMENT la déduction qu'elle remplace, donc aucun état visible
 * ne change au passage.
 *
 * Une ligne écrite SANS `expires_at` (un script, un jeu d'essai) reste lisible : le
 * repli est `created_at + 7 jours`, et c'est `expiryWindow()` qui le porte — à un
 * seul endroit.
 */

/**
 * Borne du balayage de la liste des parrains.
 *
 * Le tri de §2.2 — disponibles d'abord, puis note moyenne, puis parrainages menés
 * — porte sur un critère CALCULÉ (`is_available` ET `active_mentee_count <
 * max_mentees`) que Prisma ne sait pas ordonner : comparer deux colonnes entre
 * elles n'est pas exprimable. Le tri se fait donc en mémoire, sur un ensemble
 * borné. C'est tenable parce que l'ensemble est petit par construction — un
 * parrain est L2, a un profil, et les filtres de §2.2 le ramènent à sa ville.
 */
const MENTOR_SCAN_MAX = 500;

const MENTOR_USER_SELECT = {
  id: true,
  handle: true,
  displayName: true,
  phase: true,
  deletedAt: true,
  status: true,
  cityId: true,
  originCountryId: true,
  arrivalDate: true,
  avatarAsset: { select: { storageKey: true } },
  city: { select: { id: true, name: true, slug: true } },
} satisfies Prisma.UserSelect;

const MENTOR_SELECT = {
  userId: true,
  bio: true,
  isAvailable: true,
  maxMentees: true,
  activeMenteeCount: true,
  completedCount: true,
  avgRating: true,
  journeyTemplateIds: true,
  enabledAt: true,
  disabledAt: true,
  user: { select: MENTOR_USER_SELECT },
} satisfies Prisma.MentorProfileSelect;

type MentorRow = Prisma.MentorProfileGetPayload<{ select: typeof MENTOR_SELECT }>;

/**
 * Les demandes en attente ENCORE VALIDES à l'instant `now` : `expires_at` dans le
 * futur, ou — pour une ligne qui n'en porte pas — `created_at` de moins de 7 jours.
 */
function stillPending(now: Date): Prisma.MentorshipWhereInput {
  return {
    status: 'REQUESTED',
    OR: [
      { expiresAt: { gt: now } },
      { expiresAt: null, createdAt: { gte: new Date(now.getTime() - MENTORSHIP_REQUEST_EXPIRY_MS) } },
    ],
  };
}

/** Les demandes en attente DÉPASSÉES à l'instant `now` — le complément exact de `stillPending`. */
function pendingExpired(now: Date): Prisma.MentorshipWhereInput {
  return {
    status: 'REQUESTED',
    OR: [
      { expiresAt: { lte: now } },
      { expiresAt: null, createdAt: { lt: new Date(now.getTime() - MENTORSHIP_REQUEST_EXPIRY_MS) } },
    ],
  };
}

@Injectable()
export class MentorshipService {
  private readonly logger = new Logger(MentorshipService.name);
  private readonly cursorSecret = loadEnv().CURSOR_SECRET;

  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
    private readonly visibility: VisibilityService,
    private readonly messaging: MessagingService,
  ) {}

  private fail(code: MentorshipErrorCode, details?: Record<string, unknown>): never {
    throw new ApiError(
      code,
      MENTORSHIP_ERROR_MESSAGES[code],
      MENTORSHIP_ERROR_CODES[code],
      details,
    );
  }

  /**
   * RÈGLE DURE (§2.4) : le bandeau « jamais d'argent » accompagne CHAQUE réponse
   * du module. Une seule fonction le pose, pour qu'aucune route ne puisse l'oublier
   * — c'est la forme que le module entraide a retenue pour son propre bandeau.
   */
  private meta(extra?: Record<string, unknown>): Record<string, unknown> {
    return { moneyBanner: MENTORSHIP_MONEY_BANNER, ...extra };
  }

  // ── Profil de parrain (§2.1) ──────────────────────────────────────────────

  /**
   * `PUT /me/mentor-profile` (§7.1). Capacité `mentor.become`, L2.
   *
   * ÉLIGIBILITÉ (§2.1) : « au moins un parcours COMPLETED, ou SETTLED depuis
   * 12 mois ». Elle est revérifiée à chaque écriture, et pas seulement à la
   * création : un profil créé sur la première condition ne doit pas survivre à un
   * parcours supprimé.
   *
   * « SETTLED depuis 12 mois » demande une date que le schéma ne porte pas — il
   * n'existe pas de `phase_changed_at`. `arrival_date` en tient lieu : c'est la
   * seule date d'installation disponible, et elle est TOUJOURS antérieure au
   * passage en SETTLED. La condition est donc un peu plus permissive que la lettre
   * de la spec, jamais plus stricte, ce qui est le bon côté pour une éligibilité.
   */
  async upsertProfile(userId: string, input: MentorProfileInput) {
    await this.assertEligible(userId);

    if (input.maxMentees > MENTOR_MAX_MAX_MENTEES) {
      this.fail('MENTOR_NOT_ELIGIBLE', { maxMentees: MENTOR_MAX_MAX_MENTEES });
    }

    const templateIds = await this.validTemplateIds(input.journeyTemplateIds);
    const now = new Date();

    const profile = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.mentorProfile.findUnique({
        where: { userId },
        select: { userId: true, activeMenteeCount: true },
      });

      // `max_mentees` ne peut pas descendre sous le nombre de filleuls en cours :
      // le profil deviendrait « Complet » d'une façon que le parrain n'a pas
      // choisie, et §2.1 dit que ses parrainages en cours continuent.
      if (existing !== null && input.maxMentees < existing.activeMenteeCount) {
        this.fail('MENTOR_FULL', {
          activeMenteeCount: existing.activeMenteeCount,
          maxMentees: input.maxMentees,
        });
      }

      const row = await tx.mentorProfile.upsert({
        where: { userId },
        create: {
          userId,
          bio: input.bio ?? null,
          journeyTemplateIds: templateIds,
          maxMentees: input.maxMentees,
          isAvailable: input.isAvailable,
          enabledAt: now,
        },
        update: {
          bio: input.bio ?? null,
          journeyTemplateIds: templateIds,
          maxMentees: input.maxMentees,
          isAvailable: input.isAvailable,
          // Un profil rallumé perd sa date de désactivation, sinon il resterait
          // marqué éteint tout en acceptant des demandes.
          disabledAt: input.isAvailable ? null : now,
        },
        select: MENTOR_SELECT,
      });

      await this.audit.record(tx, {
        actor: { type: 'MEMBER', id: userId },
        action: existing === null ? 'mentor_profile.created' : 'mentor_profile.updated',
        targetType: 'mentor_profile',
        targetId: userId,
      });

      return row;
    });

    return { ...this.card(profile), meta: this.meta() };
  }

  /**
   * `GET /me/mentor-profile` — MON profil (ou `null`) et LE DIAGNOSTIC des trois
   * conditions de §2.1.
   *
   * Le diagnostic existait sous la forme d'un refus : `PUT` répondait
   * `MENTOR_NOT_ELIGIBLE` sans dire laquelle des conditions manquait, et l'écran
   * « Devenir parrain » dessinait trois pastilles qu'il ne pouvait pas remplir. Le
   * serveur les évalue, le front les montre — et le `PUT` les applique de toute
   * façon, donc ce diagnostic ne peut pas ouvrir une porte.
   *
   * Le NIVEAU vient du jeton, comme pour l'entraide : le niveau est dérivé de deux
   * faits (KYC, numéro vérifié) et le garde le recalcule dès qu'un jeton est
   * périmé ; le relire en base ici serait une seconde source. L1 = identité
   * vérifiée, L2 = en plus un numéro d'un pays de destination.
   */
  async myProfile(userId: string, level: VerificationLevel) {
    const [profile, experience] = await Promise.all([
      this.prisma.mentorProfile.findUnique({ where: { userId }, select: MENTOR_SELECT }),
      this.experienceOf(userId),
    ]);
    const identity = level === 'L1' || level === 'L2';
    const phone = level === 'L2';
    return {
      profile: profile === null ? null : this.card(profile),
      eligibility: {
        eligible: identity && phone && experience.ok,
        identity,
        phone,
        experience,
      },
      meta: this.meta(),
    };
  }

  /**
   * `DELETE /me/mentor-profile` (§7.1) — « cesser ».
   *
   * La LIGNE EST CONSERVÉE, désactivée. §2.1 : « un parrain peut se désactiver à
   * tout moment ; ses parrainages en cours continuent ». Supprimer la ligne
   * effacerait `completed_count` et `avg_rating` — l'historique d'un parrain qui
   * revient dans six mois — et les évaluations reçues pointeraient dans le vide.
   */
  async disableProfile(userId: string): Promise<void> {
    const existing = await this.prisma.mentorProfile.findUnique({
      where: { userId },
      select: { isAvailable: true },
    });
    if (existing === null) throw ApiError.notFound();
    if (!existing.isAvailable) return;

    await this.prisma.$transaction(async (tx) => {
      await tx.mentorProfile.update({
        where: { userId },
        data: { isAvailable: false, disabledAt: new Date() },
      });
      await this.audit.record(tx, {
        actor: { type: 'MEMBER', id: userId },
        action: 'mentor_profile.disabled',
        targetType: 'mentor_profile',
        targetId: userId,
      });
    });
  }

  // ── Liste et fiche (§2.2) ─────────────────────────────────────────────────

  /**
   * `GET /mentors` (§7.1). Filtres ville, langue, type de parcours, pays d'origine.
   *
   * LES QUATRE FILTRES PORTENT SUR LA MÊME RELATION `user`, et c'est un piège qui a
   * déjà coûté cher ailleurs dans ce dépôt : trois diffusions conditionnelles
   * posant chacune `user: { … }` dans le même objet littéral se remplacent
   * silencieusement — la dernière gagne, sans un mot de `tsc`. On construit donc UN
   * seul sous-objet `user`, cumulatif. Le test qui protège cette ligne combine
   * ville + pays + langue : un test par filtre passerait malgré l'écrasement.
   */
  async listMentors(query: MentorsQuery, viewerId: string | null) {
    const separated = await this.visibility.separatedFrom(viewerId);

    const userWhere: Prisma.UserWhereInput = {
      deletedAt: null,
      status: 'ACTIVE',
      ...(query.cityId === undefined ? {} : { cityId: query.cityId }),
      ...(query.countryId === undefined ? {} : { originCountryId: query.countryId }),
      ...(query.languageId === undefined
        ? {}
        : { languages: { some: { languageId: query.languageId } } }),
    };

    const where: Prisma.MentorProfileWhereInput = {
      user: userWhere,
      // `user_id` n'est pas nullable ici : le `notIn` n'a donc pas à être protégé
      // par un `OR: [{ … : null }, …]`. Ce piège concerne les colonnes d'auteur
      // NULLABLES — un contenu anonymisé disparaîtrait de la liste dès que le
      // lecteur a un seul blocage.
      ...(separated.length === 0 ? {} : { userId: { notIn: separated } }),
    };

    if (query.templateCode !== undefined) {
      const template = await this.prisma.journeyTemplate.findUnique({
        where: { code: query.templateCode },
        select: { id: true },
      });
      // Un code inconnu ne doit pas renvoyer TOUS les parrains : un filtre qui
      // s'évapore est plus trompeur qu'une liste vide.
      if (template === null) return { items: [], nextCursor: null, meta: this.meta() };
      where.journeyTemplateIds = { has: template.id };
    }

    const rows = await this.prisma.mentorProfile.findMany({
      where,
      take: MENTOR_SCAN_MAX,
      select: MENTOR_SELECT,
    });

    // §2.2 : « disponibles d'abord, puis note moyenne, puis parrainages menés ».
    // Le dernier critère est l'identifiant : sans départage stable, deux pages
    // consécutives pourraient répéter ou sauter une ligne.
    const sorted = rows.sort((a, b) => {
      const availability = Number(this.isAvailable(b)) - Number(this.isAvailable(a));
      if (availability !== 0) return availability;
      const rating = this.ratingOf(b) - this.ratingOf(a);
      if (rating !== 0) return rating;
      if (b.completedCount !== a.completedCount) return b.completedCount - a.completedCount;
      return a.userId.localeCompare(b.userId);
    });

    const scope = [
      'mentors',
      query.cityId ?? '',
      query.countryId ?? '',
      query.languageId ?? '',
      query.templateCode ?? '',
      viewerId ?? 'anon',
    ].join(':');

    // Le curseur porte le dernier identifiant vu ; l'ordre étant déterministe, il
    // situe exactement la reprise sans exposer la forme du tri.
    let start = 0;
    if (query.cursor !== undefined) {
      const payload = decodeCursor(query.cursor, this.cursorSecret, scope);
      const index = sorted.findIndex((row) => row.userId === payload.id);
      start = index === -1 ? sorted.length : index + 1;
    }

    const slice = sorted.slice(start, start + query.limit + 1);
    const page = buildPage(
      slice.map((row) => ({ ...row, id: row.userId })),
      query.limit,
      scope,
      this.cursorSecret,
    );

    return {
      items: page.items.map((row) => this.card(row)),
      nextCursor: page.nextCursor,
      meta: this.meta({ total: sorted.length }),
    };
  }

  /**
   * `GET /mentors/:handle` (§7.1).
   *
   * RÈGLE DURE (§3.2) : aucun compteur de contacts. La fiche porte les parrainages
   * menés et la note moyenne — ce que §2.2 demande pour trier — et RIEN sur le
   * réseau du parrain.
   */
  async mentorCard(handle: string, viewerId: string | null) {
    const profile = await this.prisma.mentorProfile.findFirst({
      where: { user: { handle } },
      select: MENTOR_SELECT,
    });
    if (profile === null || !this.isVisibleUser(profile.user)) throw ApiError.notFound();
    // 404 et jamais 403 (T4 §3) : un membre bloqué n'existe pas pour l'autre.
    await this.visibility.assertVisible(viewerId, profile.userId);

    const reviews = await this.visibleReviewsFor(profile.userId);
    return {
      ...this.card(profile),
      reviews,
      meta: this.meta(),
    };
  }

  /** `GET /me/mentorships` (§7.1) : « comme parrain et comme filleul ». */
  async myMentorships(userId: string, query: MyMentorshipsQuery) {
    const roleFilter: Prisma.MentorshipWhereInput =
      query.role === 'mentor'
        ? { mentorUserId: userId }
        : query.role === 'mentee'
          ? { menteeUserId: userId }
          : { OR: [{ mentorUserId: userId }, { menteeUserId: userId }] };

    const stateFilter: Prisma.MentorshipWhereInput =
      query.state === 'pending'
        ? stillPending(new Date())
        : query.state === 'active'
          ? { status: 'ACTIVE' }
          : query.state === 'past'
            ? { status: { in: ['ENDED', 'DECLINED', 'CANCELLED'] } }
            : {};

    const rows = await this.prisma.mentorship.findMany({
      where: { AND: [roleFilter, stateFilter] },
      orderBy: { id: 'desc' },
      take: 100,
      include: {
        mentor: { select: MENTOR_USER_SELECT },
        mentee: { select: MENTOR_USER_SELECT },
        reviews: { select: { reviewerUserId: true, rating: true, comment: true, createdAt: true } },
      },
    });

    const separated = new Set(await this.visibility.separatedFrom(userId));

    return {
      items: rows.map((row) => {
        const isMentor = row.mentorUserId === userId;
        const other = isMentor ? row.mentee : row.mentor;
        const mine = row.reviews.find((r) => r.reviewerUserId === userId);
        const theirs = row.reviews.find((r) => r.reviewerUserId !== userId);
        // §2.4 : l'évaluation de l'autre n'est visible qu'une fois les deux
        // déposées, ou après 14 jours.
        const bothIn = mine !== undefined && theirs !== undefined;
        const windowOver =
          row.endedAt !== null && Date.now() - row.endedAt.getTime() >= MENTORSHIP_REVIEW_WINDOW_MS;

        return {
          id: row.id,
          role: isMentor ? ('mentor' as const) : ('mentee' as const),
          status: row.status,
          endReason: row.endReason,
          requestMessage: row.requestMessage,
          journeyId: row.journeyId,
          conversationId: row.conversationId,
          acceptedAt: row.acceptedAt,
          endsAt: row.endsAt,
          endedAt: row.endedAt,
          expiresAt:
            row.status === 'REQUESTED'
              ? (row.expiresAt ?? new Date(row.createdAt.getTime() + MENTORSHIP_REQUEST_EXPIRY_MS))
              : null,
          extended: row.extendedOnce,
          canExtend: row.status === 'ACTIVE' && !row.extendedOnce,
          canReview: this.reviewWindowOpen(row) && mine === undefined,
          myReview: mine ?? null,
          theirReview: bothIn || windowOver ? (theirs ?? null) : null,
          other: separated.has(other.id)
            ? null
            : { id: other.id, handle: other.handle, displayName: other.displayName },
        };
      }),
      meta: this.meta(),
    };
  }

  // ── Demande, acceptation, refus (§2.2 et §2.3) ────────────────────────────

  /**
   * `POST /mentorships` (§7.1). Capacité `mentorship.request`, ouverte dès L0 :
   * « le pré-départ doit pouvoir demander avant l'avion » (§2.2).
   *
   * L'ordre des contrôles est délibéré : blocage, puis disponibilité du parrain,
   * puis demande déjà en attente. Un membre bloqué ne doit rien apprendre du
   * parrain ; et `PENDING_REQUEST_EXISTS` arrive en dernier parce que c'est le seul
   * refus que le membre peut lever lui-même.
   */
  async request(menteeUserId: string, input: CreateMentorship) {
    const mentorUser = await this.prisma.user.findUnique({
      where: { handle: input.mentorHandle },
      select: { id: true, deletedAt: true, status: true },
    });
    if (mentorUser === null || !this.isVisibleUser(mentorUser)) throw ApiError.notFound();
    if (mentorUser.id === menteeUserId) {
      throw ApiError.validation([{ path: 'mentorHandle', code: 'SELF_MENTORSHIP' }]);
    }

    // §2.2 : « Un membre ne peut pas demander un parrain qu'il a bloqué ou qui l'a
    // bloqué. » §7.1 nomme `BLOCKED_RELATIONSHIP` sur cette route.
    if (await this.visibility.isSeparated(menteeUserId, mentorUser.id)) {
      throw ApiError.transverse('BLOCKED_RELATIONSHIP');
    }

    const profile = await this.prisma.mentorProfile.findUnique({
      where: { userId: mentorUser.id },
      select: { isAvailable: true, maxMentees: true, activeMenteeCount: true },
    });
    if (profile === null) throw ApiError.notFound();
    if (!this.isAvailable(profile)) this.fail('MENTOR_FULL');

    // §2.2 : « Une seule demande REQUESTED à la fois » par membre. La demande
    // périmée ne compte pas, même si la tâche ne l'a pas encore balayée.
    const pending = await this.prisma.mentorship.findFirst({
      where: { menteeUserId, ...stillPending(new Date()) },
      select: { id: true },
    });
    if (pending !== null) this.fail('PENDING_REQUEST_EXISTS');

    if (input.journeyId !== undefined) {
      const journey = await this.prisma.journey.findFirst({
        where: { id: input.journeyId, ownerUserId: menteeUserId, deletedAt: null },
        select: { id: true },
      });
      // Demander un parrain pour le parcours de quelqu'un d'autre lui donnerait le
      // rôle SUPPORTER sur un parcours qui n'est pas le nôtre (§2.3).
      if (journey === null) throw ApiError.notFound();
    }

    const id = newId();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + MENTORSHIP_REQUEST_EXPIRY_MS);
    await this.prisma.$transaction(async (tx) => {
      await tx.mentorship.create({
        data: {
          id,
          mentorUserId: mentorUser.id,
          menteeUserId,
          journeyId: input.journeyId ?? null,
          status: 'REQUESTED',
          requestMessage: input.message,
          expiresAt,
        },
      });
      await this.audit.record(tx, {
        actor: { type: 'MEMBER', id: menteeUserId },
        action: 'mentorship.requested',
        targetType: 'mentorship',
        targetId: id,
      });
      await this.outbox.emit(tx, {
        type: 'mentorship.requested',
        aggregateId: id,
        payload: {
          mentorshipId: id,
          mentorUserId: mentorUser.id,
          menteeUserId,
          journeyId: input.journeyId ?? null,
        },
      });
    });

    return {
      id,
      status: 'REQUESTED' as const,
      expiresAt,
      meta: this.meta(),
    };
  }

  /**
   * `POST /mentorships/:id/accept` (§7.1), par le parrain.
   *
   * RÈGLE DURE (§12) : « un parrain à `max_mentees` refuse toute nouvelle
   * acceptation ». La vérification est faite ICI, à l'acceptation, et non
   * seulement à la demande : entre les deux, le parrain a pu accepter quelqu'un
   * d'autre, et c'est exactement le cas que la règle vise.
   *
   * Le compteur et la conversation sont dans LA MÊME transaction que le
   * changement de statut : un parrainage actif sans conversation laisserait les
   * deux membres sans moyen de se parler, et rien ne viendrait la créer ensuite.
   */
  async accept(mentorshipId: string, mentorUserId: string) {
    const mentorship = await this.requestedFor(mentorshipId, mentorUserId);

    if (await this.visibility.isSeparated(mentorship.mentorUserId, mentorship.menteeUserId)) {
      throw ApiError.transverse('BLOCKED_RELATIONSHIP');
    }

    const now = new Date();
    const endsAt = new Date(now.getTime() + MENTORSHIP_DURATION_MS);

    const result = await this.prisma.$transaction(async (tx) => {
      const profile = await tx.mentorProfile.findUnique({
        where: { userId: mentorUserId },
        select: { maxMentees: true, activeMenteeCount: true, isAvailable: true },
      });
      if (profile === null) throw ApiError.notFound();
      // La règle dure. `active_mentee_count >= max_mentees` refuse, quel que soit
      // `is_available` : un parrain saturé est « Complet », pas « indisponible ».
      if (profile.activeMenteeCount >= profile.maxMentees) this.fail('MENTOR_FULL');

      // `updateMany` conditionné au statut : deux acceptations concurrentes ne
      // peuvent pas incrémenter le compteur deux fois.
      const moved = await tx.mentorship.updateMany({
        where: { id: mentorshipId, status: 'REQUESTED' },
        data: { status: 'ACTIVE', acceptedAt: now, endsAt },
      });
      if (moved.count === 0) this.fail('MENTORSHIP_STATE');

      await tx.mentorProfile.update({
        where: { userId: mentorUserId },
        data: { activeMenteeCount: { increment: 1 } },
      });

      const conversationId = await this.messaging.ensureMentorshipConversation(tx, mentorshipId, [
        mentorship.mentorUserId,
        mentorship.menteeUserId,
      ]);
      await tx.mentorship.update({
        where: { id: mentorshipId },
        data: { conversationId },
      });

      await this.audit.record(tx, {
        actor: { type: 'MEMBER', id: mentorUserId },
        action: 'mentorship.accepted',
        targetType: 'mentorship',
        targetId: mentorshipId,
      });

      await this.outbox.emit(tx, {
        type: 'mentorship.accepted',
        aggregateId: mentorshipId,
        // `journeyId` voyage : §2.3 veut que le parrain devienne SUPPORTER du
        // parcours, ce qui est le travail du module 03 — jamais un appel direct
        // (00 §3.3).
        payload: {
          mentorshipId,
          mentorUserId: mentorship.mentorUserId,
          menteeUserId: mentorship.menteeUserId,
          journeyId: mentorship.journeyId,
          conversationId,
          endsAt: endsAt.toISOString(),
        },
      });

      return { conversationId };
    });

    return {
      id: mentorshipId,
      status: 'ACTIVE' as const,
      endsAt,
      conversationId: result.conversationId,
      meta: this.meta(),
    };
  }

  /** `POST /mentorships/:id/decline` (§7.1) : « Le parrain accepte ou refuse SANS MOTIF ». */
  async decline(mentorshipId: string, mentorUserId: string) {
    await this.requestedFor(mentorshipId, mentorUserId);
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      const moved = await tx.mentorship.updateMany({
        where: { id: mentorshipId, status: 'REQUESTED' },
        data: { status: 'DECLINED', endedAt: now },
      });
      if (moved.count === 0) this.fail('MENTORSHIP_STATE');
      await this.outbox.emit(tx, {
        type: 'mentorship.declined',
        aggregateId: mentorshipId,
        // Aucun motif : §2.2 n'en demande pas, et en transporter un inviterait
        // les notifications à l'afficher.
        payload: { mentorshipId, mentorUserId },
      });
    });

    return { id: mentorshipId, status: 'DECLINED' as const };
  }

  // ── Fin et prolongation (§2.4) ────────────────────────────────────────────

  /**
   * `POST /mentorships/:id/end` (§7.1) — « Par l'un des deux ».
   *
   * CONTRADICTION DANS LA SPEC, tranchée ici : §2.4 fait de `COMPLETED` la
   * « clôture anticipée d'accord commun (les deux cliquent Terminer) », alors que
   * §7.1 donne la route à « l'un des deux ». Les deux ensemble sont impossibles :
   * si le premier clic termine, le second n'a plus rien à terminer, et le schéma
   * figé n'offre aucune colonne pour retenir « l'un des deux a demandé la fin ».
   *
   * On retient §7.1 : la fin est UNILATÉRALE et immédiate, motif `MENTOR_LEFT` ou
   * `MENTEE_LEFT`. `COMPLETED` reste le motif de la fin par échéance (tâche
   * `mentorship.end_due`), qui est l'autre déclencheur que §2.4 nomme. Conséquence
   * assumée : une fin anticipée ne crédite pas la réputation et ne crée pas de
   * contact — ce qui est cohérent, puisque quelqu'un a quitté.
   */
  async end(mentorshipId: string, userId: string) {
    const mentorship = await this.partyTo(mentorshipId, userId);

    if (mentorship.status === 'REQUESTED') {
      // Le filleul retire sa demande, le parrain la refuse : dans les deux cas la
      // relation n'a jamais commencé.
      await this.prisma.mentorship.updateMany({
        where: { id: mentorshipId, status: 'REQUESTED' },
        data: { status: 'CANCELLED', endedAt: new Date() },
      });
      return { id: mentorshipId, status: 'CANCELLED' as const, endReason: null };
    }

    if (mentorship.status !== 'ACTIVE') this.fail('MENTORSHIP_STATE');

    const reason = mentorship.mentorUserId === userId ? 'MENTOR_LEFT' : 'MENTEE_LEFT';
    await this.endActive(mentorshipId, reason, { type: 'MEMBER', id: userId });
    return { id: mentorshipId, status: 'ENDED' as const, endReason: reason };
  }

  /**
   * `POST /mentorships/:id/extend` (§7.1) — « Par l'un des deux », une fois (§2.4).
   *
   * `mentorships.extended_once` (§6) dit « déjà prolongé ». Elle est posée dans la
   * MÊME écriture que le déplacement de `ends_at`, sous la condition
   * `extended_once = false` : deux prolongations concurrentes ne peuvent pas
   * ajouter 180 jours, et c'est la base qui le garantit, pas une relecture.
   */
  async extend(mentorshipId: string, userId: string) {
    const mentorship = await this.partyTo(mentorshipId, userId);
    if (mentorship.status !== 'ACTIVE') this.fail('MENTORSHIP_STATE');
    if (mentorship.extendedOnce) this.fail('ALREADY_EXTENDED');

    const base = mentorship.endsAt ?? mentorship.acceptedAt ?? new Date();
    const endsAt = new Date(base.getTime() + MENTORSHIP_DURATION_MS);

    await this.prisma.$transaction(async (tx) => {
      const moved = await tx.mentorship.updateMany({
        where: { id: mentorshipId, status: 'ACTIVE', extendedOnce: false },
        data: { endsAt, extendedOnce: true },
      });
      // `extendedOnce: false` dans le `where` sert de verrou optimiste : deux
      // prolongations concurrentes ne peuvent pas ajouter 180 jours.
      if (moved.count === 0) this.fail('ALREADY_EXTENDED');
      await this.outbox.emit(tx, {
        type: 'mentorship.extended',
        aggregateId: mentorshipId,
        payload: { mentorshipId, extendedByUserId: userId, endsAt: endsAt.toISOString() },
      });
    });

    return { id: mentorshipId, endsAt, extended: true };
  }

  /**
   * `POST /mentorships/:id/review` (§7.1) — évaluation mutuelle de §2.4.
   *
   * Ouverte seulement sur un parrainage terminé pour `COMPLETED` : évaluer une
   * relation que l'autre a quittée n'est pas une évaluation, c'est une riposte.
   * Et bornée à 14 jours, le délai au terme duquel l'évaluation de l'autre devient
   * visible — sans cette borne, on pourrait la lire puis y répondre.
   */
  async review(mentorshipId: string, userId: string, input: MentorshipReviewInput) {
    const mentorship = await this.partyTo(mentorshipId, userId);
    if (!this.reviewWindowOpen(mentorship)) this.fail('REVIEW_WINDOW_CLOSED');

    const revieweeUserId =
      mentorship.mentorUserId === userId ? mentorship.menteeUserId : mentorship.mentorUserId;

    const existing = await this.prisma.mentorshipReview.findUnique({
      where: { mentorshipId_reviewerUserId: { mentorshipId, reviewerUserId: userId } },
      select: { id: true },
    });
    if (existing !== null) throw ApiError.transverse('CONFLICT');

    const id = newId();
    await this.prisma.$transaction(async (tx) => {
      await tx.mentorshipReview.create({
        data: {
          id,
          mentorshipId,
          reviewerUserId: userId,
          revieweeUserId,
          rating: input.rating,
          comment: input.comment ?? null,
        },
      });
      await this.recomputeRating(tx, revieweeUserId);
    });

    return { id, rating: input.rating, meta: this.meta() };
  }

  // ── Tâches planifiées (§10) ───────────────────────────────────────────────

  /**
   * `mentorship.end_due`, quotidienne (§10) : `ends_at` atteint → `COMPLETED`.
   *
   * C'est ICI que se produit tout ce que §2.4 attache à `COMPLETED` : réputation
   * du parrain, contact automatique (par l'événement, consommé par le module
   * contacts), `completed_count++`, évaluation mutuelle ouverte.
   */
  async endDueMentorships(now = new Date()): Promise<number> {
    const due = await this.prisma.mentorship.findMany({
      where: { status: 'ACTIVE', endsAt: { lte: now } },
      select: { id: true },
      take: 500,
    });
    let ended = 0;
    for (const row of due) {
      // Un échec sur un parrainage ne doit pas arrêter le balayage des autres.
      try {
        if (await this.endActive(row.id, 'COMPLETED', { type: 'SYSTEM' }, now)) ended += 1;
      } catch (error) {
        this.logger.error(
          `mentorship.end_due a échoué sur ${row.id} : ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    if (ended > 0) this.logger.log(`${ended} parrainage(s) terminé(s) à échéance (§10)`);
    return ended;
  }

  /**
   * `mentorship.expire_requests`, quotidienne (§10) : 7 jours.
   *
   * Le statut retenu est `CANCELLED` : l'enum `MentorshipStatus` du schéma figé n'a
   * pas d'`EXPIRED`, et `DECLINED` serait un mensonge — le parrain n'a rien refusé,
   * il n'a pas répondu. §2.2 ne demande que l'effet : « le membre peut en faire
   * une autre », ce que `CANCELLED` produit.
   */
  async expireRequests(now = new Date()): Promise<number> {
    const { count } = await this.prisma.mentorship.updateMany({
      where: pendingExpired(now),
      data: { status: 'CANCELLED', endedAt: now },
    });
    if (count > 0) this.logger.log(`${count} demande(s) de parrainage expirée(s) (§10)`);
    return count;
  }

  /** `mentor.rating_recompute`, quotidienne (§10). */
  async recomputeAllRatings(): Promise<number> {
    const profiles = await this.prisma.mentorProfile.findMany({ select: { userId: true } });
    for (const profile of profiles) {
      await this.prisma.$transaction((tx) => this.recomputeRating(tx, profile.userId));
    }
    return profiles.length;
  }

  // ── Consommateurs d'événements ────────────────────────────────────────────

  /**
   * §4, la part « parrainage » de la cascade de blocage :
   * « `mentorships` actif → `ENDED` motif BLOCKED, dossier de modération ouvert
   * (priorité 2) ».
   *
   * Les demandes en attente entre les deux sont annulées au passage : §2.2
   * interdit de demander un parrain qu'on a bloqué, et laisser la demande
   * acceptable contredirait le blocage dès le clic suivant.
   *
   * IDEMPOTENT : les transitions sont conditionnées au statut courant, et le
   * dossier de modération est cherché avant d'être créé. LÈVE pour être rejoué.
   */
  async handleUserBlocked(blockerUserId: string, blockedUserId: string): Promise<void> {
    const between: Prisma.MentorshipWhereInput = {
      OR: [
        { mentorUserId: blockerUserId, menteeUserId: blockedUserId },
        { mentorUserId: blockedUserId, menteeUserId: blockerUserId },
      ],
    };

    const now = new Date();

    const pending = await this.prisma.mentorship.findMany({
      where: { AND: [between, { status: 'REQUESTED' }] },
      select: { id: true },
    });
    for (const row of pending) {
      await this.prisma.mentorship.updateMany({
        where: { id: row.id, status: 'REQUESTED' },
        data: { status: 'CANCELLED', endedAt: now },
      });
    }

    const active = await this.prisma.mentorship.findMany({
      where: { AND: [between, { status: 'ACTIVE' }] },
      select: { id: true, mentorUserId: true, menteeUserId: true },
    });

    for (const row of active) {
      const changed = await this.endActive(row.id, 'BLOCKED', { type: 'SYSTEM' }, now);
      if (changed) await this.openBlockedCase(row.id, blockedUserId, now);
    }
  }

  /**
   * §11, gestionnaire de suppression : « Profil parrain : supprimé ; parrainages
   * actifs → `ENDED` motif ADMIN avec notification au filleul ; évaluations reçues
   * par les autres : conservées anonymisées. »
   *
   * Les évaluations que le membre a REÇUES sont conservées telles quelles : c'est
   * le module 01 qui anonymise l'identité, et les supprimer ici retirerait aux
   * autres parrains une note qu'ils ont légitimement reçue. La notification au
   * filleul passe par `mentorship.ended`, comme toute notification (00 §3.3).
   */
  async handleUserDeleted(userId: string): Promise<void> {
    const now = new Date();

    const active = await this.prisma.mentorship.findMany({
      where: {
        status: 'ACTIVE',
        OR: [{ mentorUserId: userId }, { menteeUserId: userId }],
      },
      select: { id: true },
    });
    for (const row of active) {
      await this.endActive(row.id, 'ADMIN', { type: 'SYSTEM' }, now);
    }

    await this.prisma.mentorship.updateMany({
      where: {
        status: 'REQUESTED',
        OR: [{ mentorUserId: userId }, { menteeUserId: userId }],
      },
      data: { status: 'CANCELLED', endedAt: now },
    });

    await this.prisma.mentorProfile.deleteMany({ where: { userId } });
  }

  // ── Interne ───────────────────────────────────────────────────────────────

  /**
   * La transition commune à toutes les fins. Rend `true` si l'état a changé.
   *
   * Tout est dans UNE transaction : statut, compteur du parrain, réputation,
   * statistiques, événement. Un compteur décrémenté sans que le statut ait bougé
   * rendrait un parrain éternellement « disponible » alors qu'il accompagne
   * quelqu'un — et l'inverse le bloquerait pour toujours.
   */
  private async endActive(
    mentorshipId: string,
    reason: 'COMPLETED' | 'MENTOR_LEFT' | 'MENTEE_LEFT' | 'BLOCKED' | 'ADMIN',
    actor: { type: 'MEMBER'; id: string } | { type: 'SYSTEM'; id?: undefined },
    now = new Date(),
  ): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const mentorship = await tx.mentorship.findUnique({
        where: { id: mentorshipId },
        select: { id: true, mentorUserId: true, menteeUserId: true, journeyId: true, status: true },
      });
      if (mentorship === null || mentorship.status !== 'ACTIVE') return false;

      const moved = await tx.mentorship.updateMany({
        where: { id: mentorshipId, status: 'ACTIVE' },
        data: { status: 'ENDED', endedAt: now, endReason: reason },
      });
      // Rejeu : quelqu'un d'autre a déjà terminé ce parrainage. On ne touche NI le
      // compteur NI la réputation — c'est toute la raison de ce garde.
      if (moved.count === 0) return false;

      await tx.mentorProfile.updateMany({
        where: { userId: mentorship.mentorUserId, activeMenteeCount: { gt: 0 } },
        data: { activeMenteeCount: { decrement: 1 } },
      });

      if (reason === 'COMPLETED') {
        // §2.4 : `reputation_events` MENTORSHIP_COMPLETED pour le parrain. La
        // contrainte d'unicité (membre, type, source) porte sur le parrainage :
        // c'est elle qui rend le rejeu inoffensif (00 §9.4).
        const credited = await tx.reputationEvent.createMany({
          data: [
            {
              id: newId(),
              userId: mentorship.mentorUserId,
              type: 'MENTORSHIP_COMPLETED',
              sourceType: 'mentorship',
              sourceId: mentorship.id,
            },
          ],
          skipDuplicates: true,
        });

        // Le compteur ne bouge QUE si l'événement a réellement été créé — la
        // leçon du module entraide, qui incrémentait à chaque appel pendant que
        // `skipDuplicates` faisait correctement son travail.
        if (credited.count > 0) {
          await tx.mentorProfile.updateMany({
            where: { userId: mentorship.mentorUserId },
            data: { completedCount: { increment: 1 } },
          });
          await tx.userStats.upsert({
            where: { userId: mentorship.mentorUserId },
            create: { userId: mentorship.mentorUserId, mentorshipsCompleted: 1, computedAt: now },
            update: { mentorshipsCompleted: { increment: 1 }, computedAt: now },
          });
        }
      }

      await this.audit.record(tx, {
        actor,
        action: 'mentorship.ended',
        targetType: 'mentorship',
        targetId: mentorshipId,
        metadata: { reason },
      });

      await this.outbox.emit(tx, {
        type: 'mentorship.ended',
        aggregateId: mentorshipId,
        // Le motif ET les deux identifiants : le module contacts crée le contact
        // sur `COMPLETED` seulement (§3.1), et il ne peut pas le deviner.
        payload: {
          mentorshipId,
          mentorUserId: mentorship.mentorUserId,
          menteeUserId: mentorship.menteeUserId,
          journeyId: mentorship.journeyId,
          reason,
        },
      });

      return true;
    });
  }

  /** §4 : « dossier de modération ouvert (priorité 2) » sur le parrainage rompu par blocage. */
  private async openBlockedCase(
    mentorshipId: string,
    blockedUserId: string,
    now: Date,
  ): Promise<void> {
    // Idempotent : un seul dossier ouvert par membre pour cette règle. Un rejeu de
    // `user.blocked` ne doit pas empiler des dossiers identiques dans la file de
    // modération, qui est une file HUMAINE.
    const existing = await this.prisma.moderationCase.findFirst({
      where: {
        subjectType: 'USER',
        subjectId: blockedUserId,
        source: 'AUTO_RULE',
        status: { in: ['OPEN', 'IN_REVIEW'] },
      },
      select: { id: true },
    });
    if (existing !== null) return;

    await this.prisma.moderationCase.create({
      data: {
        id: newId(),
        // `ReportSubjectType` n'a pas de valeur `MENTORSHIP` : le sujet est le
        // MEMBRE bloqué, et l'identifiant du parrainage voyage dans les labels.
        subjectType: 'USER',
        subjectId: blockedUserId,
        subjectAuthorUserId: blockedUserId,
        source: 'AUTO_RULE',
        priority: 2,
        status: 'OPEN',
        aiLabels: ['MENTORSHIP_BLOCKED', mentorshipId],
        // Le SLA du schéma : 24 h, et 4 h en priorité 1 seulement.
        slaDueAt: new Date(now.getTime() + 24 * 3_600_000),
      },
    });
  }

  /** §2.4 : `avg_rating` recalculée sur les évaluations reçues. */
  private async recomputeRating(tx: Prisma.TransactionClient, userId: string): Promise<void> {
    const profile = await tx.mentorProfile.findUnique({
      where: { userId },
      select: { userId: true },
    });
    // Le filleul est évalué lui aussi (§2.4, « évaluation mutuelle ») mais n'a pas
    // forcément de profil de parrain : il n'y a alors aucune moyenne à tenir.
    if (profile === null) return;

    const aggregate = await tx.mentorshipReview.aggregate({
      where: { revieweeUserId: userId },
      _avg: { rating: true },
      _count: { _all: true },
    });

    await tx.mentorProfile.update({
      where: { userId },
      data: {
        // Une CHAÎNE, pas un flottant : la colonne est `Decimal(3,2)` et Prisma
        // accepte la chaîne sans passer par un binaire flottant qui arrondirait.
        avgRating:
          aggregate._count._all === 0 || aggregate._avg.rating === null
            ? null
            : aggregate._avg.rating.toFixed(2),
      },
    });
  }

  /**
   * §2.4 : « visible seulement une fois les deux évaluations déposées ou après 14 jours ».
   *
   * LA BRANCHE « LES DEUX DÉPOSÉES » ÉTAIT MORTE, ET LA FICHE RESTAIT MUETTE
   * QUATORZE JOURS.
   *
   * La version précédente comptait les évaluations par parrainage DANS LA PAGE
   * qu'elle venait de lire — une page filtrée sur `revieweeUserId: userId`, donc
   * sur les évaluations dont ce membre est le SUJET. Or `mentorship_reviews` porte
   * `@@unique([mentorshipId, reviewerUserId])` et un parrainage n'a que deux
   * parties : le filleul évalue le parrain, le parrain évalue le filleul. Pour un
   * sujet donné, il n'y a donc JAMAIS plus d'UNE évaluation par parrainage, et le
   * test `>= 2` ne pouvait pas être vrai une seule fois. Seule la fenêtre de
   * quatorze jours rendait une évaluation visible : deux évaluations déposées le
   * jour même rendaient `reviews: []`, et la fiche d'un parrain se taisait pendant
   * deux semaines après chaque parrainage — exactement l'inverse de ce que §2.4
   * veut, puisque la fenêtre y est le REPLI et l'accord mutuel le cas normal.
   *
   * « Les deux évaluations » sont celles DU PARRAINAGE, dans les deux sens. C'est
   * donc `mentorship._count.reviews` qui décide, lu en base et non recompté sur la
   * page : un comptage fait sur la page serait de surcroît faux dès que le `take`
   * coupe entre deux parrainages.
   */
  private async visibleReviewsFor(userId: string) {
    const reviews = await this.prisma.mentorshipReview.findMany({
      where: { revieweeUserId: userId },
      orderBy: { id: 'desc' },
      take: 20,
      include: {
        mentorship: { select: { id: true, endedAt: true, _count: { select: { reviews: true } } } },
        reviewer: { select: { handle: true, displayName: true, deletedAt: true } },
      },
    });

    const now = Date.now();
    return reviews
      .filter((review) => {
        const endedAt = review.mentorship.endedAt;
        const windowOver =
          endedAt !== null && now - endedAt.getTime() >= MENTORSHIP_REVIEW_WINDOW_MS;
        return windowOver || review.mentorship._count.reviews >= MENTORSHIP_REVIEWS_BOTH_IN;
      })
      .map((review) => ({
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt,
        // §11 : une évaluation d'un membre supprimé est conservée, ANONYMISÉE.
        reviewer:
          review.reviewer.deletedAt === null
            ? { handle: review.reviewer.handle, displayName: review.reviewer.displayName }
            : null,
      }));
  }

  /** §2.1, éligibilité : un parcours COMPLETED, ou SETTLED depuis 12 mois. */
  private async assertEligible(userId: string): Promise<void> {
    if (!(await this.experienceOf(userId)).ok) this.fail('MENTOR_NOT_ELIGIBLE');
  }

  /**
   * La troisième condition de §2.1, DÉTAILLÉE : combien de parcours terminés, et
   * l'installation depuis 12 mois. `assertEligible` et le diagnostic de
   * `myProfile` lisent la même fonction — deux évaluations de la même règle
   * finiraient par diverger, et l'écran dirait « éligible » avant un refus.
   */
  private async experienceOf(userId: string) {
    const completedJourneys = await this.prisma.journey.count({
      where: { ownerUserId: userId, status: 'COMPLETED', deletedAt: null },
    });

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { phase: true, arrivalDate: true },
    });
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - MENTOR_SETTLED_MONTHS);
    const settledForMonths =
      user.phase === 'SETTLED' &&
      user.arrivalDate !== null &&
      user.arrivalDate <= twelveMonthsAgo;

    return { ok: completedJourneys > 0 || settledForMonths, completedJourneys, settledForMonths };
  }

  /** Les types de parcours déclarés doivent exister : un identifiant inventé ne filtre rien. */
  private async validTemplateIds(ids: readonly string[]): Promise<string[]> {
    if (ids.length === 0) return [];
    const found = await this.prisma.journeyTemplate.findMany({
      where: { id: { in: [...ids] } },
      select: { id: true },
    });
    if (found.length !== ids.length) {
      throw ApiError.validation([{ path: 'journeyTemplateIds', code: 'UNKNOWN_TEMPLATE' }]);
    }
    return found.map((t) => t.id);
  }

  /** §2.1 : « Disponible » = `active_mentee_count < max_mentees` ET `is_available`. */
  private isAvailable(profile: {
    isAvailable: boolean;
    maxMentees: number;
    activeMenteeCount: number;
  }): boolean {
    return profile.isAvailable && profile.activeMenteeCount < profile.maxMentees;
  }

  private ratingOf(profile: { avgRating: Prisma.Decimal | null }): number {
    return profile.avgRating === null ? 0 : Number(profile.avgRating);
  }

  private reviewWindowOpen(mentorship: {
    status: string;
    endReason: string | null;
    endedAt: Date | null;
  }): boolean {
    if (mentorship.status !== 'ENDED' || mentorship.endReason !== 'COMPLETED') return false;
    if (mentorship.endedAt === null) return false;
    return Date.now() - mentorship.endedAt.getTime() < MENTORSHIP_REVIEW_WINDOW_MS;
  }

  /** Une demande en attente adressée à CE parrain. 404 sinon (T4 §3). */
  private async requestedFor(mentorshipId: string, mentorUserId: string) {
    const mentorship = await this.prisma.mentorship.findUnique({
      where: { id: mentorshipId },
      select: {
        id: true,
        mentorUserId: true,
        menteeUserId: true,
        journeyId: true,
        status: true,
        createdAt: true,
        expiresAt: true,
      },
    });
    if (mentorship === null || mentorship.mentorUserId !== mentorUserId) throw ApiError.notFound();
    if (mentorship.status !== 'REQUESTED') this.fail('MENTORSHIP_STATE');
    // Périmée : elle n'existe plus, même avant le passage de la tâche (§2.2).
    const expiry =
      mentorship.expiresAt ?? new Date(mentorship.createdAt.getTime() + MENTORSHIP_REQUEST_EXPIRY_MS);
    if (expiry.getTime() < Date.now()) this.fail('MENTORSHIP_STATE');
    return mentorship;
  }

  /** L'un des deux membres du parrainage. 404 pour tout autre. */
  private async partyTo(mentorshipId: string, userId: string) {
    const mentorship = await this.prisma.mentorship.findUnique({
      where: { id: mentorshipId },
      select: {
        id: true,
        mentorUserId: true,
        menteeUserId: true,
        status: true,
        endReason: true,
        acceptedAt: true,
        endsAt: true,
        endedAt: true,
        extendedOnce: true,
      },
    });
    if (
      mentorship === null ||
      (mentorship.mentorUserId !== userId && mentorship.menteeUserId !== userId)
    ) {
      throw ApiError.notFound();
    }
    return mentorship;
  }

  /** La fiche d'un parrain, telle que la liste et le détail la projettent. */
  private card(profile: MentorRow) {
    return {
      userId: profile.userId,
      handle: profile.user.handle,
      displayName: profile.user.displayName,
      avatarUrl: profile.user.avatarAsset?.storageKey ?? null,
      city:
        profile.user.city === null
          ? null
          : {
              id: profile.user.city.id,
              name: profile.user.city.name,
              slug: profile.user.city.slug,
            },
      bio: profile.bio,
      journeyTemplateIds: profile.journeyTemplateIds,
      maxMentees: profile.maxMentees,
      activeMenteeCount: profile.activeMenteeCount,
      completedCount: profile.completedCount,
      avgRating: profile.avgRating === null ? null : Number(profile.avgRating),
      /** §2.1 : « Disponible » ou « Complet ». Un libellé, pas deux booléens à recomposer. */
      availability: this.isAvailable(profile) ? ('AVAILABLE' as const) : ('FULL' as const),
      isAvailable: profile.isAvailable,
    };
  }

  private isVisibleUser(user: { deletedAt: Date | null; status: string }): boolean {
    return user.deletedAt === null && user.status !== 'DELETED' && user.status !== 'DEACTIVATED';
  }
}
