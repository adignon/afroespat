import { Injectable, Logger } from '@nestjs/common';
import {
  ALERT_DISPATCH_INTERVAL_MS,
  CONTENT_IN_REVIEW_NOTICE,
  GROUPING_WINDOW_HOUR_MS,
  REPORT_RESOLVED_NOTICE,
  groupedTitle,
  messagePushTitle,
} from '@app/shared';
import { PrismaService } from '../../common/prisma.service';
import { NotificationsService } from './notifications.service';

/**
 * Événements de domaine → notifications.
 *
 * C'est la moitié manquante de huit chaînes. Chaque méthode est un GESTIONNAIRE au
 * sens de `queue/event-handlers.ts`, donc soumise aux trois propriétés que la file
 * impose :
 *
 *   · IDEMPOTENT. Aucune méthode ne compte, n'incrémente ni ne marque quoi que ce
 *     soit hors de `deliver()`, qui dé-duplique lui-même. La seule exception est
 *     `saved_alerts.last_notified_at`, et elle n'est écrite QUE si une notification
 *     a réellement été créée — le piège du compteur dénormalisé incrémenté hors du
 *     `skipDuplicates`.
 *   · INDÉPENDANT. Aucune méthode n'appelle une autre.
 *   · QUI LÈVE. Une erreur de base remonte, et les dix tentatives d'`EVENT_JOB_OPTIONS`
 *     s'en chargent. Une CHARGE UTILE inattendue, en revanche, sort en silence :
 *     il n'y a rien à faire, et lever ferait rejouer dix fois pour rien.
 *
 * LA CHARGE EST LUE DÉFENSIVEMENT, toujours. Elle vient de `domain_events`, donc
 * son type est `unknown` et il le reste. Un gestionnaire qui suppose une forme se
 * casse le jour où le producteur change, et l'échec surviendrait dans le worker,
 * loin de l'écran.
 */
@Injectable()
export class NotificationEventsService {
  private readonly logger = new Logger(NotificationEventsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  // ══ Entraide (06) ═════════════════════════════════════════════════════════

  /** Une réponse publique à ma demande — `HELP`, push autorisé (§2.1). */
  async onHelpResponded(aggregateId: string, payload: unknown): Promise<void> {
    const responseId = readString(payload, 'responseId');
    const responder = readString(payload, 'responderUserId');
    const author = readString(payload, 'authorUserId');
    if (responseId === null || responder === null || author === null) return;
    // Répondre à sa propre demande ne se notifie pas à soi-même.
    if (responder === author) return;

    await this.notifications.deliver({
      userId: author,
      category: 'HELP',
      type: 'help.response_received',
      title: `${await this.displayName(responder)} a répondu à votre demande`,
      refType: 'HELP_RESPONSE',
      refId: responseId,
      url: `/entraide/${aggregateId}`,
    });
  }

  /** « Ça m'a aidé » — le remerciement va à celui qui a aidé (06 §2.4). */
  async onHelpResolved(aggregateId: string, payload: unknown): Promise<void> {
    const responseId = readString(payload, 'responseId');
    const helper = readString(payload, 'helperUserId');
    const author = readString(payload, 'authorUserId');
    // « Résolu sans réponse » n'a personne à remercier : les deux champs sont
    // `null`, et c'est un cas normal, pas une charge invalide.
    if (responseId === null || helper === null || author === null || helper === author) return;

    await this.notifications.deliver({
      userId: helper,
      category: 'HELP',
      type: 'help.marked_helpful',
      title: `${await this.displayName(author)} a trouvé votre réponse utile`,
      refType: 'HELP_RESPONSE',
      refId: responseId,
      url: `/entraide/${aggregateId}`,
    });
  }

  /**
   * « Vous pouvez aider » — 06 §2.6, et le regroupement du §2.3 : AU PLUS UNE PAR
   * JOUR. La fenêtre est portée par `GROUPING_BY_TYPE['help.can_help']`, de portée
   * `USER` : peu importe la demande, un membre n'en reçoit qu'une par jour.
   *
   * Les destinataires sont les membres de la ville qui se déclarent disponibles et
   * dont les types d'aide recoupent la demande. Les membres séparés de l'auteur
   * sont écartés — dans les deux sens (08 §4).
   */
  async onHelpPublished(aggregateId: string, payload: unknown): Promise<void> {
    const author = readString(payload, 'authorUserId');
    const kind = readString(payload, 'kind');
    const cityId = readString(payload, 'cityId');
    const type = readString(payload, 'type');
    if (author === null || cityId === null || type === null) return;
    // Une OFFRE n'a personne à alerter : c'est déjà quelqu'un qui propose.
    if (kind !== 'REQUEST') return;

    const profileType = PROFILE_HELP_TYPE[type] ?? null;

    const candidates = await this.prisma.user.findMany({
      where: {
        cityId,
        status: 'ACTIVE',
        deletedAt: null,
        id: { not: author },
        profile: {
          availableToHelp: true,
          // Le type n'est confronté QUE s'il a un équivalent dans le profil : sans
          // équivalent, on s'en tient à la ville et à la disponibilité, plutôt que
          // de ne prévenir personne.
          ...(profileType === null ? {} : { helpTypes: { has: profileType } }),
        },
      },
      select: { id: true },
      take: 50,
    });

    const recipients = await this.withoutSeparated(
      candidates.map((c) => c.id),
      author,
    );
    if (recipients.length === 0) return;

    await this.notifications.deliverMany(
      recipients.map((userId) => ({
        userId,
        category: 'HELP' as const,
        type: 'help.can_help',
        title: 'Une demande d’entraide correspond à ce que vous savez faire',
        refType: 'HELP_REQUEST',
        refId: aggregateId,
        url: `/entraide/${aggregateId}`,
      })),
    );
  }

  // ══ Parrainage (08) ═══════════════════════════════════════════════════════

  /** Demande reçue — la seule notification `MENTORSHIP` qui part aussi par email (§2.1). */
  async onMentorshipRequested(payload: unknown): Promise<void> {
    const mentorshipId = readString(payload, 'mentorshipId');
    const mentor = readString(payload, 'mentorUserId');
    const mentee = readString(payload, 'menteeUserId');
    if (mentorshipId === null || mentor === null || mentee === null) return;

    const menteeName = await this.displayName(mentee);
    await this.notifications.deliver({
      userId: mentor,
      category: 'MENTORSHIP',
      type: 'mentorship.request_received',
      title: `${menteeName} vous demande comme parrain`,
      refType: 'MENTORSHIP',
      refId: mentorshipId,
      url: `/parrainage/${mentorshipId}`,
      emailTemplate: 'mentorship_request_received',
      emailVariables: { menteeName, mentorshipId },
    });
  }

  async onMentorshipAccepted(payload: unknown): Promise<void> {
    const mentorshipId = readString(payload, 'mentorshipId');
    const mentor = readString(payload, 'mentorUserId');
    const mentee = readString(payload, 'menteeUserId');
    if (mentorshipId === null || mentor === null || mentee === null) return;

    await this.notifications.deliver({
      userId: mentee,
      category: 'MENTORSHIP',
      type: 'mentorship.accepted',
      title: `${await this.displayName(mentor)} a accepté de vous parrainer`,
      refType: 'MENTORSHIP',
      refId: mentorshipId,
      url: `/parrainage/${mentorshipId}`,
    });
  }

  /**
   * Refus. La charge ne porte PAS le filleul — 08 §2.2 refuse d'y mettre un motif,
   * et l'événement s'en tient au parrain. On relit donc la ligne.
   */
  async onMentorshipDeclined(payload: unknown): Promise<void> {
    const mentorshipId = readString(payload, 'mentorshipId');
    if (mentorshipId === null) return;

    const row = await this.prisma.mentorship.findUnique({
      where: { id: mentorshipId },
      select: { menteeUserId: true },
    });
    if (row === null) return;

    await this.notifications.deliver({
      userId: row.menteeUserId,
      category: 'MENTORSHIP',
      type: 'mentorship.declined',
      // AUCUN motif, et aucun nom : §2.2 n'en transporte pas, et l'afficher
      // transformerait un refus discret en jugement.
      title: 'Votre demande de parrainage n’a pas été retenue',
      refType: 'MENTORSHIP',
      refId: mentorshipId,
    });
  }

  /**
   * Fin de parrainage. `reason: 'BLOCKED'` ne notifie PERSONNE : dire « votre
   * parrainage est terminé » au moment d'un blocage apprend à l'autre qu'il a été
   * bloqué, ce que 08 §4 interdit précisément.
   */
  async onMentorshipEnded(payload: unknown): Promise<void> {
    const mentorshipId = readString(payload, 'mentorshipId');
    const mentor = readString(payload, 'mentorUserId');
    const mentee = readString(payload, 'menteeUserId');
    const reason = readString(payload, 'reason');
    if (mentorshipId === null || mentor === null || mentee === null) return;
    if (reason === 'BLOCKED') return;

    await this.notifications.deliverMany(
      [mentor, mentee].map((userId) => ({
        userId,
        category: 'MENTORSHIP' as const,
        type: 'mentorship.ended',
        title: 'Votre parrainage est terminé',
        body: 'Vous pouvez laisser une évaluation.',
        refType: 'MENTORSHIP',
        refId: mentorshipId,
      })),
    );
  }

  // ══ Messagerie (08) ═══════════════════════════════════════════════════════

  /**
   * RÈGLE DURE (§2.4) : « un push MESSAGE ne contient jamais le corps du message ».
   *
   * Elle est tenue par CONSTRUCTION, à deux niveaux : l'événement `message.sent` ne
   * transporte aucun corps (le module 08 l'a voulu ainsi), et ce gestionnaire ne lit
   * pas la table `messages`. Le titre vient de `messagePushTitle`, qui ne prend que
   * le nom de l'expéditeur.
   */
  async onMessageSent(payload: unknown): Promise<void> {
    const messageId = readString(payload, 'messageId');
    const conversationId = readString(payload, 'conversationId');
    const sender = readString(payload, 'senderUserId');
    const recipients = readStringArray(payload, 'recipientUserIds');
    if (messageId === null || conversationId === null || sender === null || recipients.length === 0) return;

    const senderName = await this.displayName(sender);
    const title = messagePushTitle(senderName);

    await this.notifications.deliverMany(
      recipients
        .filter((id) => id !== sender)
        .map((userId) => ({
          userId,
          category: 'MESSAGE' as const,
          type: 'message.received',
          title,
          // `body` reste NUL : il n'y a rien d'autre à dire, et laisser la place
          // vide est ce qui garantit qu'aucun extrait ne s'y glissera un jour.
          body: null,
          refType: 'CONVERSATION',
          refId: messageId,
          url: `/messages/${conversationId}`,
        })),
    );
  }

  // ══ Contacts (08) ═════════════════════════════════════════════════════════

  /** `SOCIAL` : in-app seulement, jamais d'email (règle dure §2.1). */
  async onConnectionRequested(payload: unknown): Promise<void> {
    const requestId = readString(payload, 'requestId');
    const from = readString(payload, 'fromUserId');
    const to = readString(payload, 'toUserId');
    if (requestId === null || from === null || to === null) return;

    await this.notifications.deliver({
      userId: to,
      category: 'SOCIAL',
      type: 'social.connection_requested',
      title: `${await this.displayName(from)} souhaite entrer en contact`,
      refType: 'CONNECTION_REQUEST',
      refId: requestId,
      url: '/contacts/demandes',
    });
  }

  // ══ Fil (04) — le regroupement du §2.3 ════════════════════════════════════

  /**
   * « Sandra et 4 autres ont réagi » (§2.3).
   *
   * LE COMPTE VIENT DE LA SOURCE, pas d'un compteur maintenu à la main : on compte
   * les réactions de la dernière heure dans `post_reactions`. C'est ce qui rend le
   * regroupement IDEMPOTENT — un rejeu de l'événement recompte la même chose et
   * réécrit le même titre, alors qu'un `+1` à chaque passage gonflerait à chaque
   * rejeu.
   */
  async onPostReacted(postId: string, payload: unknown): Promise<void> {
    const author = readString(payload, 'authorUserId');
    const actor = readString(payload, 'userId');
    if (author === null || actor === null || author === actor) return;

    const since = new Date(Date.now() - GROUPING_WINDOW_HOUR_MS);
    const recent = await this.prisma.postReaction.findMany({
      where: { postId, createdAt: { gte: since }, userId: { not: author } },
      orderBy: { createdAt: 'desc' },
      select: { userId: true },
      take: 50,
    });

    const actors = [...new Set([actor, ...recent.map((r) => r.userId)])];
    const others = actors.length - 1;

    await this.notifications.deliver({
      userId: author,
      category: 'SOCIAL',
      type: 'social.post_reacted',
      title: groupedTitle(
        await this.displayName(actors[0] ?? actor),
        others,
        others === 0 ? 'a réagi à votre publication' : 'ont réagi à votre publication',
      ),
      refType: 'POST',
      refId: postId,
      url: `/fil/${postId}`,
    });
  }

  /** Même regroupement, sur les commentaires. */
  async onPostCommented(subjectId: string, payload: unknown): Promise<void> {
    const subjectType = readString(payload, 'subjectType');
    const actor = readString(payload, 'authorUserId');
    if (actor === null) return;
    // Seuls les commentaires de PUBLICATION sont traités : les autres sujets de
    // commentaire (guide, événement) n'ont pas d'auteur lisible par ce chemin, et
    // en deviner un enverrait la notification à la mauvaise personne.
    if (subjectType !== 'POST') return;

    const post = await this.prisma.post.findUnique({
      where: { id: subjectId },
      select: { authorUserId: true },
    });
    if (post === null || post.authorUserId === actor) return;

    const since = new Date(Date.now() - GROUPING_WINDOW_HOUR_MS);
    const recent = await this.prisma.comment.findMany({
      where: {
        subjectType: 'POST',
        subjectId,
        createdAt: { gte: since },
        authorUserId: { not: post.authorUserId },
      },
      orderBy: { createdAt: 'desc' },
      select: { authorUserId: true },
      take: 50,
    });

    const actors = [...new Set([actor, ...recent.map((r) => r.authorUserId)])];
    const others = actors.length - 1;

    await this.notifications.deliver({
      userId: post.authorUserId,
      category: 'SOCIAL',
      type: 'social.post_commented',
      title: groupedTitle(
        await this.displayName(actors[0] ?? actor),
        others,
        others === 0 ? 'a commenté votre publication' : 'ont commenté votre publication',
      ),
      refType: 'POST',
      refId: subjectId,
      url: `/fil/${subjectId}`,
    });
  }

  // ══ Réseaux (07) ══════════════════════════════════════════════════════════

  /**
   * Annonce de réseau — la seule notification `COMMUNITY` avec push (§2.1).
   *
   * 07 §2.3 veut prévenir « tous les membres NON EN SOURDINE ».
   * `community_members.muted` n'existe pas dans le schéma figé : la sourdine par
   * réseau est INAPPLICABLE, et les annonces partent donc à tous les membres. Le
   * seul garde-fou qui reste est la préférence de catégorie `COMMUNITY`, qui coupe
   * le push pour TOUS les réseaux à la fois. Voir le rapport.
   */
  async onCommunityAnnouncement(payload: unknown): Promise<void> {
    const communityId = readString(payload, 'communityId');
    const announcementId = readString(payload, 'announcementId');
    const author = readString(payload, 'authorUserId');
    if (communityId === null || announcementId === null) return;

    const community = await this.prisma.community.findUnique({
      where: { id: communityId },
      select: { name: true },
    });
    if (community === null) return;

    const members = await this.prisma.communityMember.findMany({
      where: { communityId, ...(author === null ? {} : { userId: { not: author } }) },
      select: { userId: true },
      take: 1_000,
    });

    const recipients = author === null ? members.map((m) => m.userId) : await this.withoutSeparated(members.map((m) => m.userId), author);

    await this.notifications.deliverMany(
      recipients.map((userId) => ({
        userId,
        category: 'COMMUNITY' as const,
        type: 'community.announcement',
        title: `Annonce dans ${community.name}`,
        refType: 'COMMUNITY_ANNOUNCEMENT',
        refId: announcementId,
        url: `/reseaux/${communityId}`,
      })),
    );
  }

  /** « Adhésion acceptée » (§2.1) — le nouveau membre est prévenu. */
  async onCommunityMemberJoined(payload: unknown): Promise<void> {
    const communityId = readString(payload, 'communityId');
    const userId = readString(payload, 'userId');
    if (communityId === null || userId === null) return;

    const community = await this.prisma.community.findUnique({
      where: { id: communityId },
      select: { name: true },
    });
    if (community === null) return;

    await this.notifications.deliver({
      userId,
      category: 'COMMUNITY',
      type: 'community.member_joined',
      title: `Vous avez rejoint ${community.name}`,
      refType: 'COMMUNITY',
      refId: communityId,
      url: `/reseaux/${communityId}`,
    });
  }

  /** Invitation à un réseau d'intérêt : 07 §2.1 met les invités dans la charge. */
  async onCommunityCreated(aggregateId: string, payload: unknown): Promise<void> {
    const invited = readStringArray(payload, 'invitedUserIds');
    const owner = readString(payload, 'ownerUserId');
    if (invited.length === 0) return;

    const community = await this.prisma.community.findUnique({
      where: { id: aggregateId },
      select: { name: true },
    });
    if (community === null) return;

    const recipients = owner === null ? invited : await this.withoutSeparated(invited, owner);

    await this.notifications.deliverMany(
      recipients.map((userId) => ({
        userId,
        category: 'COMMUNITY' as const,
        type: 'community.invitation',
        title: `Vous êtes invité·e dans ${community.name}`,
        refType: 'COMMUNITY',
        refId: aggregateId,
        url: `/reseaux/${aggregateId}`,
      })),
    );
  }

  /** Archivage à 60 jours d'inactivité (07 §2.2) : le créateur est prévenu. */
  async onCommunityArchived(aggregateId: string, payload: unknown): Promise<void> {
    const owner = readString(payload, 'ownerUserId');
    if (owner === null) return;

    const community = await this.prisma.community.findUnique({
      where: { id: aggregateId },
      select: { name: true },
    });
    if (community === null) return;

    await this.notifications.deliver({
      userId: owner,
      category: 'COMMUNITY',
      type: 'community.archived',
      title: `${community.name} a été mis en sommeil`,
      body: 'Vous pouvez le réactiver depuis sa page.',
      refType: 'COMMUNITY',
      refId: aggregateId,
      url: `/reseaux/${aggregateId}`,
    });
  }

  // ══ Agenda (09) ═══════════════════════════════════════════════════════════

  /**
   * `event.updated` porte DEUX faits : une modification notable, et le rappel H−2
   * que la tâche planifiée du module 09 émet avec `reminder: 'H_MINUS_2'`.
   *
   * 09 §3 demande trois rappels — J−1, H−2, résumé organisateur — et `events` n'a
   * qu'UNE colonne `reminder_sent_at`, que le module 09 emploie pour H−2. Les deux
   * autres rappels resteraient donc sans marqueur d'envoi... sauf que la
   * dé-duplication de `deliver()` en tient lieu : une notification de type
   * `event.reminder_j1` sur le même événement ne peut exister qu'une fois, sans
   * fenêtre. C'est la table `notifications` qui sert de journal d'envoi. Voir le
   * rapport : cela marche pour l'in-app et le push, pas pour un email J−1, qui n'a
   * pas d'équivalent.
   */
  async onEventUpdated(eventId: string, payload: unknown): Promise<void> {
    const reminder = readString(payload, 'reminder');
    const notify = readBoolean(payload, 'notifyAttendees');
    if (reminder === null && notify !== true) return;

    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { title: true, startsAt: true, organizerUserId: true, status: true },
    });
    if (event === null || event.status !== 'SCHEDULED') return;

    // Un rappel ne va qu'à ceux qui viennent ; une modification concerne aussi les
    // hésitants, qui doivent pouvoir se décider sur la bonne information.
    const statuses = reminder === null ? (['GOING', 'MAYBE'] as const) : (['GOING'] as const);
    const attendees = await this.prisma.eventAttendee.findMany({
      where: { eventId, status: { in: [...statuses] } },
      select: { userId: true },
      take: 1_000,
    });

    const type = reminder === 'H_MINUS_2' ? 'event.reminder_h2' : reminder === 'J_MINUS_1' ? 'event.reminder_j1' : 'event.updated';
    const title =
      type === 'event.updated'
        ? `${event.title} a été modifié`
        : type === 'event.reminder_h2'
          ? `${event.title} commence bientôt`
          : `${event.title}, c’est demain`;

    await this.notifications.deliverMany(
      attendees.map((a) => ({
        userId: a.userId,
        category: 'EVENT' as const,
        type,
        title,
        refType: 'EVENT',
        refId: eventId,
        url: `/agenda/${eventId}`,
      })),
    );
  }

  async onEventCancelled(eventId: string, payload: unknown): Promise<void> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { title: true },
    });
    if (event === null) return;
    const reason = readString(payload, 'reason');

    const attendees = await this.prisma.eventAttendee.findMany({
      where: { eventId, status: { in: ['GOING', 'MAYBE', 'WAITLIST'] } },
      select: { userId: true },
      take: 1_000,
    });

    await this.notifications.deliverMany(
      attendees.map((a) => ({
        userId: a.userId,
        category: 'EVENT' as const,
        type: 'event.cancelled',
        title: `${event.title} est annulé`,
        body: reason,
        refType: 'EVENT',
        refId: eventId,
        url: `/agenda/${eventId}`,
      })),
    );
  }

  /** Liste d'attente : 09 §3 promeut un membre quand une place se libère. */
  async onEventRsvpChanged(eventId: string, payload: unknown): Promise<void> {
    const promoted = readString(payload, 'promotedUserId');
    if (promoted === null) return;

    const event = await this.prisma.event.findUnique({ where: { id: eventId }, select: { title: true } });
    if (event === null) return;

    await this.notifications.deliver({
      userId: promoted,
      category: 'EVENT',
      type: 'event.waitlist_promoted',
      title: `Une place s’est libérée pour ${event.title}`,
      refType: 'EVENT',
      refId: eventId,
      url: `/agenda/${eventId}`,
    });
  }

  // ══ Services (10) ═════════════════════════════════════════════════════════

  /**
   * Alertes enregistrées — `SERVICES`, la seule catégorie `SERVICES` avec push
   * (§2.1), et le troisième regroupement du §2.3 : « une par heure et par alerte ».
   *
   * DEUX protections superposées, volontairement :
   *   · `last_notified_at` + `ALERT_DISPATCH_INTERVAL_MS`, que le module 10 a
   *     préparés et qui évitent même de composer la notification ;
   *   · la fenêtre de `deliver()` sur (`user`, `type`, `SAVED_ALERT`, id d'alerte),
   *     qui tient si deux annonces arrivent dans la même seconde par deux travaux
   *     concurrents — cas où les deux liraient le même `last_notified_at`.
   *
   * `last_notified_at` N'EST ÉCRIT QUE SI une notification a réellement été créée.
   * L'écrire avant, ou inconditionnellement, ferait taire l'alerte pendant une
   * heure alors que rien n'a été envoyé — le pendant du compteur incrémenté hors du
   * `skipDuplicates`.
   */
  async onListingPublished(kind: 'HOUSING' | 'JOB', listingId: string, payload: unknown): Promise<void> {
    const author = readString(payload, 'authorUserId');
    const cityId = readString(payload, 'cityId');
    if (author === null) return;

    const cutoff = new Date(Date.now() - ALERT_DISPATCH_INTERVAL_MS);
    const alerts = await this.prisma.savedAlert.findMany({
      where: {
        kind,
        isActive: true,
        userId: { not: author },
        // `notIn`/`lt` sur une colonne NULLABLE élimine les `NULL` : une alerte
        // jamais notifiée a `last_notified_at` à NULL et doit être servie. D'où le
        // `OR` explicite, et non un simple `lt`.
        OR: [{ lastNotifiedAt: null }, { lastNotifiedAt: { lt: cutoff } }],
      },
      select: { id: true, userId: true, criteria: true },
      take: 500,
    });

    const matching = alerts.filter((alert) => this.alertMatches(alert.criteria, cityId));
    if (matching.length === 0) return;

    const recipients = await this.withoutSeparated(
      matching.map((a) => a.userId),
      author,
    );
    const allowed = new Set(recipients);

    for (const alert of matching) {
      if (!allowed.has(alert.userId)) continue;

      const result = await this.notifications.deliver({
        userId: alert.userId,
        category: 'SERVICES',
        type: 'services.alert_match',
        title:
          kind === 'HOUSING'
            ? 'Une nouvelle annonce correspond à votre alerte logement'
            : 'Une nouvelle offre correspond à votre alerte emploi',
        refType: 'SAVED_ALERT',
        refId: alert.id,
        url: kind === 'HOUSING' ? `/logement/${listingId}` : `/emploi/${listingId}`,
      });

      if (result.outcome === 'CREATED' || result.outcome === 'GROUPED') {
        await this.prisma.savedAlert.update({
          where: { id: alert.id },
          data: { lastNotifiedAt: new Date() },
        });
      }
    }
  }

  /**
   * Les critères d'une alerte, lus défensivement : `criteria` est du JSON libre.
   *
   * Seule la ville est confrontée ici. Le prix, le secteur et le type de contrat
   * demanderaient de relire l'annonce, et l'événement ne les porte pas tous — un
   * filtrage partiel enverrait des alertes fausses, ce qui est pire qu'une alerte
   * trop large. Voir le rapport.
   */
  private alertMatches(criteria: unknown, cityId: string | null): boolean {
    if (typeof criteria !== 'object' || criteria === null) return false;
    const wanted = (criteria as Record<string, unknown>)['cityId'];
    if (typeof wanted !== 'string') return true;
    return wanted === cityId;
  }

  /** Un membre a contacté mon annonce (10 §2.3). */
  async onListingContacted(kind: 'HOUSING' | 'PRO', payload: unknown): Promise<void> {
    const from = readString(payload, 'fromUserId');
    const to = readString(payload, 'toUserId');
    if (from === null || to === null || from === to) return;

    await this.notifications.deliver({
      userId: to,
      category: 'SERVICES',
      type: kind === 'HOUSING' ? 'services.listing_contacted' : 'services.pro_contacted',
      title: `${await this.displayName(from)} vous a contacté·e`,
      refType: kind === 'HOUSING' ? 'HOUSING' : 'PRO_PROFILE',
      refId: readString(payload, 'conversationId') ?? null,
    });
  }

  /** Une recommandation reçue — 10 §3.3 et §4.3 le demandent explicitement. */
  async onRecommended(kind: 'MEMBER' | 'PRO', aggregateId: string, payload: unknown): Promise<void> {
    const notify = readString(payload, 'notifyUserId');
    const from = readString(payload, 'fromUserId') ?? readString(payload, 'authorUserId');
    if (notify === null || from === null || notify === from) return;

    await this.notifications.deliver({
      userId: notify,
      category: 'SERVICES',
      type: kind === 'MEMBER' ? 'services.member_recommended' : 'services.pro_recommended',
      title:
        kind === 'MEMBER'
          ? `${await this.displayName(from)} recommande un membre pour votre offre`
          : `${await this.displayName(from)} a recommandé votre fiche`,
      refType: kind === 'MEMBER' ? 'MEMBER_RECOMMENDATION' : 'PRO_RECOMMENDATION',
      refId: aggregateId,
    });
  }

  /** Annonce expirée (10 §2.1) : l'auteur peut la renouveler. */
  async onHousingExpired(listingId: string, payload: unknown): Promise<void> {
    const author = readString(payload, 'authorUserId');
    if (author === null) return;

    await this.notifications.deliver({
      userId: author,
      category: 'SERVICES',
      type: 'services.listing_expired',
      title: 'Votre annonce de logement a expiré',
      body: 'Vous pouvez la renouveler depuis vos annonces.',
      refType: 'HOUSING',
      refId: listingId,
      url: `/logement/${listingId}`,
    });
  }

  // ══ Guides (05) ═══════════════════════════════════════════════════════════

  /** Proposition reçue — la seule notification `GUIDE` avec email (§2.1). */
  async onGuideProposalCreated(proposalId: string, payload: unknown): Promise<void> {
    const author = readString(payload, 'authorUserId');
    const proposer = readString(payload, 'proposerUserId');
    const guideId = readString(payload, 'guideId');
    if (author === null || proposer === null || author === proposer) return;

    const proposerName = await this.displayName(proposer);
    await this.notifications.deliver({
      userId: author,
      category: 'GUIDE',
      type: 'guide.proposal_received',
      title: `${proposerName} propose une mise à jour de votre guide`,
      refType: 'GUIDE_PROPOSAL',
      refId: proposalId,
      url: `/guides/${guideId ?? ''}/propositions/${proposalId}`,
      emailTemplate: 'guide_proposal_received',
      emailVariables: { proposerName, proposalId },
    });
  }

  async onGuideProposalDecided(
    decision: 'ACCEPTED' | 'REJECTED' | 'ESCALATED',
    proposalId: string,
    payload: unknown,
  ): Promise<void> {
    const proposer = readString(payload, 'proposerUserId');
    if (proposer === null) return;

    await this.notifications.deliver({
      userId: proposer,
      category: 'GUIDE',
      type: `guide.proposal_${decision.toLowerCase()}`,
      title:
        decision === 'ACCEPTED'
          ? 'Votre proposition a été intégrée au guide'
          : decision === 'REJECTED'
            ? 'Votre proposition n’a pas été retenue'
            : 'Votre proposition est passée en relecture par la modération',
      body: decision === 'REJECTED' ? readString(payload, 'reason') : null,
      refType: 'GUIDE_PROPOSAL',
      refId: proposalId,
    });
  }

  /** Guide signalé obsolète (05 §2.6) : l'auteur a jusqu'à une date pour agir. */
  async onGuideFlagged(guideId: string, payload: unknown): Promise<void> {
    const author = readString(payload, 'authorUserId');
    if (author === null) return;

    await this.notifications.deliver({
      userId: author,
      category: 'GUIDE',
      type: 'guide.flagged_outdated',
      title: 'Votre guide a été signalé comme obsolète',
      body: 'Mettez-le à jour pour qu’il reste publié.',
      refType: 'GUIDE',
      refId: guideId,
      url: `/guides/${guideId}`,
    });
  }

  // ══ Modération (13) ═══════════════════════════════════════════════════════

  /**
   * Contenu masqué ou retiré — `MODERATION`, catégorie NON DÉSACTIVABLE (§2.2).
   *
   * Le TEXTE vient de la charge utile quand elle le porte : le module 13 met
   * `notice: CONTENT_IN_REVIEW_NOTICE` dans l'événement de masquage automatique, et
   * le `reason` seulement sur un RETRAIT — §4.2 veut que l'auteur d'un contenu
   * retiré soit informé « avec motif », alors qu'un masquage ne dit que « en
   * vérification » (détailler apprendrait à contourner). On respecte cette
   * distinction plutôt que de la refaire.
   */
  async onModerationContent(
    action: 'HIDDEN' | 'REMOVED' | 'RESTORED',
    payload: unknown,
  ): Promise<void> {
    const author = readString(payload, 'authorUserId');
    const subjectId = readString(payload, 'subjectId');
    const subjectType = readString(payload, 'subjectType');
    if (author === null || subjectId === null) return;

    const title =
      action === 'HIDDEN'
        ? 'Un de vos contenus est en vérification'
        : action === 'REMOVED'
          ? 'Un de vos contenus a été retiré'
          : 'Un de vos contenus est de nouveau visible';

    await this.notifications.deliver({
      userId: author,
      category: 'MODERATION',
      type: `moderation.content_${action.toLowerCase()}`,
      title,
      body:
        action === 'HIDDEN'
          ? (readString(payload, 'notice') ?? CONTENT_IN_REVIEW_NOTICE)
          : readString(payload, 'reason'),
      refType: subjectType,
      refId: subjectId,
      emailTemplate: 'moderation',
      emailVariables: { action, subjectType },
    });
  }

  async onSanction(action: 'SUSPENDED' | 'BANNED' | 'REINSTATED', payload: unknown): Promise<void> {
    const userId = readString(payload, 'userId');
    if (userId === null) return;
    const days = readNumber(payload, 'durationDays');

    await this.notifications.deliver({
      userId,
      category: 'MODERATION',
      type: `moderation.user_${action.toLowerCase()}`,
      title:
        action === 'SUSPENDED'
          ? `Votre compte est suspendu${days === null ? '' : ` ${days} jour(s)`}`
          : action === 'BANNED'
            ? 'Votre compte a été fermé'
            : 'Votre compte est rétabli',
      body: action === 'REINSTATED' ? null : 'Vous pouvez contester cette décision.',
      refType: 'SANCTION',
      refId: readString(payload, 'sanctionId'),
      emailTemplate: 'moderation',
      emailVariables: { action, durationDays: days },
    });
  }

  /**
   * Dossier clos → le ou les SIGNALEURS sont remerciés, avec le texte que le
   * module 13 a préparé (`REPORT_RESOLVED_NOTICE`).
   *
   * La charge de `moderation.case_resolved` ne porte pas les signaleurs : on les
   * relit depuis `reports`. C'est une lecture de la table d'un autre module, ce qui
   * est permis (le client Prisma est commun) et préférable à un événement enrichi
   * qui transporterait des identifiants de signaleurs dans `domain_events`.
   */
  async onModerationCaseResolved(caseId: string): Promise<void> {
    const reports = await this.prisma.report.findMany({
      where: { caseId },
      select: { id: true, reporterUserId: true },
      take: 200,
    });
    if (reports.length === 0) return;

    await this.notifications.deliverMany(
      reports.map((report) => ({
        userId: report.reporterUserId,
        category: 'MODERATION' as const,
        type: 'moderation.report_resolved',
        title: REPORT_RESOLVED_NOTICE,
        refType: 'REPORT',
        refId: report.id,
      })),
    );
  }

  // ══ Compte (01) ═══════════════════════════════════════════════════════════

  /** Bienvenue — le modèle `welcome` du §2.5. */
  async onUserRegistered(userId: string): Promise<void> {
    await this.notifications.deliver({
      userId,
      category: 'ACCOUNT',
      type: 'account.welcome',
      title: 'Bienvenue sur la plateforme',
      refType: 'USER',
      refId: userId,
      emailTemplate: 'welcome',
    });
  }

  async onLevelChanged(userId: string, payload: unknown): Promise<void> {
    const level = readString(payload, 'to') ?? readString(payload, 'level');
    await this.notifications.deliver({
      userId,
      category: 'ACCOUNT',
      type: 'account.level_changed',
      title: level === null ? 'Votre niveau de vérification a changé' : `Votre compte est désormais ${level}`,
      refType: 'USER',
      refId: `${userId}`,
      emailTemplate: 'security',
      emailVariables: { level },
    });
  }

  async onKycStatusChanged(userId: string, payload: unknown): Promise<void> {
    const status = readString(payload, 'status') ?? readString(payload, 'to');
    if (status === null) return;

    await this.notifications.deliver({
      userId,
      category: 'ACCOUNT',
      type: 'account.kyc_status',
      title:
        status === 'APPROVED'
          ? 'Votre identité est vérifiée'
          : status === 'DECLINED'
            ? 'Votre vérification d’identité n’a pas abouti'
            : 'Votre vérification d’identité a avancé',
      refType: 'KYC',
      refId: null,
    });
  }

  /**
   * Suppression demandée — `ACCOUNT` SÉCURITÉ, donc non désactivable ET exempté des
   * heures calmes (§2.2). Quelqu'un qui n'a pas demandé cette suppression doit
   * l'apprendre tout de suite, pas à huit heures du matin.
   */
  async onDeletionRequested(userId: string): Promise<void> {
    await this.notifications.deliver({
      userId,
      category: 'ACCOUNT',
      type: 'account.deletion_requested',
      title: 'Votre compte sera supprimé',
      body: 'Si ce n’est pas vous, annulez la demande immédiatement.',
      refType: 'USER',
      refId: userId,
      emailTemplate: 'security',
    });
  }

  // ══ Monétisation (14 §9) ══════════════════════════════════════════════════

  /**
   * `subscription.changed` — l'unique événement d'abonnement, huit motifs.
   *
   * §9 donne à `subscription.changed` cinq consommateurs, dont les notifications.
   * Voici cette moitié — et c'est ce qui autorise le module 14 à émettre le type,
   * qui figurait au catalogue depuis le lot 0 sans que personne ne l'écoute.
   *
   * La catégorie est `ACCOUNT` : un abonnement est une affaire de compte, et §2.1
   * du module 12 y autorise l'in-app, le push et l'email. L'email ne partira pas
   * pour autant tant que `users.email` n'existe pas (`NoEmailAddressPort`) — le
   * canal est DÉCIDÉ, pas envoyé, et c'est visible dans `channels_sent`.
   *
   * `TRIAL_ENDING`, `RENEWAL_J7` et `RENEWAL_J1` sont des RAPPELS, pas des
   * changements : ils portent le même type d'événement parce que le tableau du §9
   * leur donne les mêmes consommateurs, et parce qu'un type par rappel aurait
   * multiplié les entrées du catalogue sans rien ajouter. Leur idempotence vient de
   * `deliver()`, qui rend `DUPLICATE` sur un rejeu — il n'y a pas de colonne
   * `reminder_sent_at` sur `subscriptions`, et le schéma est gelé.
   */
  async onSubscriptionChanged(subscriptionId: string, payload: unknown): Promise<void> {
    const userId = readString(payload, 'userId');
    const reason = readString(payload, 'reason');
    if (userId === null || reason === null) return;

    const notice = SUBSCRIPTION_NOTICES[reason];
    // Un motif que l'on ne notifie pas — `RESUMED`, `CANCEL_SCHEDULED` — n'est pas
    // une charge invalide : le membre vient de faire le geste lui-même, et le lui
    // annoncer serait du bruit. Sortir en silence est la bonne réponse.
    if (notice === undefined) return;

    await this.notifications.deliver({
      userId,
      category: 'ACCOUNT',
      type: notice.type,
      title: notice.title,
      body: notice.body,
      refType: 'SUBSCRIPTION',
      refId: subscriptionId,
      url: '/compte/abonnement',
    });
  }

  /** Carte refusée (§4.3) : trois tentatives sur sept jours, et on le dit. */
  async onPaymentFailed(payload: unknown): Promise<void> {
    const userId = readString(payload, 'userId');
    if (userId === null) return;

    await this.notifications.deliver({
      userId,
      category: 'ACCOUNT',
      type: 'billing.payment_failed',
      title: 'Votre paiement n’a pas abouti',
      body: 'Mettez à jour votre moyen de paiement pour conserver votre formule Premium.',
      refType: 'SUBSCRIPTION',
      refId: userId,
      url: '/compte/abonnement',
    });
  }

  /** Remboursement traité par l'équipe (§4.4). Le membre doit l'apprendre de nous. */
  async onPaymentRefunded(payload: unknown): Promise<void> {
    const userId = readString(payload, 'userId');
    if (userId === null) return;

    await this.notifications.deliver({
      userId,
      category: 'ACCOUNT',
      type: 'billing.payment_refunded',
      title: 'Votre paiement a été remboursé',
      body: 'Le remboursement est en route vers votre moyen de paiement.',
      refType: 'SUBSCRIPTION',
      refId: userId,
      url: '/compte/abonnement',
    });
  }

  // ══ Outils ════════════════════════════════════════════════════════════════

  /**
   * Le nom affiché d'un membre, ou un repli neutre.
   *
   * LE REPLI COUVRE LA CHAÎNE VIDE, et pas seulement l'absence de ligne. Trouvé en
   * appelant l'API : `users.display_name` est `NOT NULL` mais vaut `''` à
   * l'inscription — l'onboarding le renseigne à l'écran suivant. Un membre qui
   * répond avant d'avoir rempli son profil produisait donc le titre
   * « ␣a répondu à votre demande », et `messagePushTitle` aurait donné
   * « Nouveau message de ». Un `??` ne l'attrapait pas : la valeur n'est pas nulle,
   * elle est vide.
   */
  private async displayName(userId: string): Promise<string> {
    const row = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { displayName: true, handle: true },
    });
    if (row === null) return 'Un membre';
    const name = row.displayName.trim();
    // Le handle plutôt qu'un « Un membre » anonyme quand il existe : il est public
    // (01 §2.6) et il identifie, ce qui est tout l'objet de la notification.
    return name.length > 0 ? name : row.handle;
  }

  /**
   * Les destinataires qui ne sont pas séparés de `other`, dans un sens ou l'autre.
   *
   * UNE seule requête pour toute la liste : un `VisibilityService.isSeparated` par
   * destinataire ferait mille requêtes sur l'annonce d'un grand réseau.
   */
  private async withoutSeparated(candidates: string[], other: string): Promise<string[]> {
    if (candidates.length === 0) return [];
    const blocks = await this.prisma.block.findMany({
      where: {
        OR: [
          { blockerUserId: other, blockedUserId: { in: candidates } },
          { blockedUserId: other, blockerUserId: { in: candidates } },
        ],
      },
      select: { blockerUserId: true, blockedUserId: true },
    });

    const separated = new Set<string>();
    for (const block of blocks) {
      separated.add(block.blockerUserId === other ? block.blockedUserId : block.blockerUserId);
    }
    return candidates.filter((id) => id !== other && !separated.has(id));
  }
}

/**
 * DEUX ÉNUMÉRATIONS DE « TYPE D'AIDE », ET ELLES NE SE RECOUVRENT PAS.
 *
 * `help_requests.type` est un `HelpType2` (module 06) : PAPERWORK, SERVICE, RIDE,
 * MATERIAL, OTHER. `user_profiles.help_types` est un `HelpType[]` (module 01) :
 * PAPERWORK, HOUSING, JOB, WELCOME, OTHER.
 *
 * Passer l'un pour l'autre à PostgreSQL lève sur le cast d'énumération, avec un
 * message VIDE — c'est ce qui est arrivé sur une demande `RIDE` : le gestionnaire
 * échouait, l'événement était rejoué dix fois, et le journal ne disait que
 * « notifications a échoué ». Trouvé en publiant une demande par l'API ; un `as
 * never` dans la requête Prisma masquait le problème à la compilation.
 *
 * Cette table dit ce qui se correspond RÉELLEMENT. `SERVICE`, `RIDE` et `MATERIAL`
 * n'ont aucun équivalent côté profil : c'est une divergence de schéma à signaler,
 * pas une correspondance à inventer — associer `RIDE` à `OTHER` enverrait « vous
 * pouvez aider » à des gens qui n'ont rien demandé.
 */
const PROFILE_HELP_TYPE: Record<string, 'PAPERWORK' | 'HOUSING' | 'JOB' | 'WELCOME' | 'OTHER'> = {
  PAPERWORK: 'PAPERWORK',
  OTHER: 'OTHER',
};

/**
 * La charge d'un événement est du JSON venu de la base : son type est `unknown`, et
 * il le reste. Ces trois lecteurs sont la seule porte d'entrée.
 */
/**
 * Le texte de chaque motif de `subscription.changed` (14 §9).
 *
 * Une TABLE et non un `switch` : les textes de l'interface vivent ensemble, se
 * relisent d'un coup d'œil, et un motif absent de la table est silencieusement
 * ignoré — ce qui est le comportement voulu pour `RESUMED` et `CANCEL_SCHEDULED`,
 * que le membre vient de déclencher lui-même.
 */
const SUBSCRIPTION_NOTICES: Record<string, { type: string; title: string; body: string }> = {
  ACTIVATED: {
    type: 'billing.subscription_activated',
    title: 'Votre Premium est actif',
    body: 'Merci de soutenir la plateforme. Vos parcours sont désormais illimités.',
  },
  EXPIRED: {
    type: 'billing.subscription_expired',
    title: 'Votre Premium a pris fin',
    body: 'Rien n’est perdu : vos parcours et vos contenus restent en place.',
  },
  CANCELLED: {
    type: 'billing.subscription_cancelled',
    title: 'Votre abonnement est terminé',
    body: 'Rien n’est perdu : vos parcours et vos contenus restent en place.',
  },
  TRIAL_STARTED: {
    type: 'billing.trial_started',
    title: 'Vos 14 jours de Premium sont ouverts',
    body: 'Parcours illimités, alertes, filtres avancés. Aucun moyen de paiement demandé.',
  },
  TRIAL_ENDING: {
    type: 'billing.trial_ending',
    title: 'Votre essai se termine dans 3 jours',
    body: 'Vous reviendrez au plan gratuit, sans coupure et sans rien perdre.',
  },
  TRIAL_ENDED: {
    type: 'billing.trial_ended',
    title: 'Votre essai est terminé',
    body: 'Vous êtes revenu·e au plan gratuit. Vos parcours restent consultables.',
  },
  RENEWAL_J7: {
    type: 'billing.renewal_j7',
    title: 'Votre Premium expire dans 7 jours',
    body: 'Renouvelez en un clic depuis Compte → Abonnement.',
  },
  RENEWAL_J1: {
    type: 'billing.renewal_j1',
    title: 'Votre Premium expire demain',
    body: 'Après expiration, vous gardez 3 jours pour renouveler sans coupure.',
  },
};

function readString(payload: unknown, key: string): string | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function readStringArray(payload: unknown, key: string): string[] {
  if (typeof payload !== 'object' || payload === null) return [];
  const value = (payload as Record<string, unknown>)[key];
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string' && v.length > 0);
}

function readBoolean(payload: unknown, key: string): boolean | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === 'boolean' ? value : null;
}

function readNumber(payload: unknown, key: string): number | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
