import { createHmac, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { Prisma, newId } from '@app/db';
import {
  ACCOUNT_SECURITY_TYPES,
  CATEGORY_CHANNELS,
  CATEGORY_LABELS_FR,
  DEFAULT_QUIET_HOURS,
  DIGEST_GUIDES_COUNT,
  DIGEST_LOCAL_HOUR,
  DIGEST_NEWCOMERS_COUNT,
  DIGEST_WEEKDAY,
  type EmailTemplate,
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_RETENTION_DAYS,
  type NotificationCategory,
  type NotificationPreferencesInput,
  OUTBOUND_RETENTION_DAYS,
  PUSH_BODY_MAX,
  PUSH_DEFERRED,
  PUSH_MAX_FAILURES,
  type QuietHours,
  UNSUBSCRIBE_CONFIRMATION_FR,
  UNSUBSCRIBE_TOKEN_TTL_DAYS,
  channelAllowed,
  groupingRuleFor,
  isMandatory,
  isWithinQuietHours,
  notificationCategorySchema,
  quietHoursSchema,
} from '@app/shared';
import { z } from 'zod';
import { ApiError } from '../../common/api-error';
import { buildPage, decodeCursor } from '../../common/cursor';
import { PrismaService } from '../../common/prisma.service';
import { loadEnv } from '../../config/env';
import { EMAIL_PROVIDER, PUSH_PROVIDER, type EmailProvider, type PushProvider } from '../../providers/providers';

/**
 * Notifications — 12-notifications.md.
 *
 * ── CE QUE CE SERVICE EST ────────────────────────────────────────────────────
 *
 * La moitié « consommateur » de toutes les chaînes d'événements du produit. Huit
 * modules émettent correctement et aucun ne notifiait : `deliver()` est le point
 * où un événement de domaine devient quelque chose qu'un membre voit.
 *
 * Il n'est JAMAIS appelé directement par un service métier (00 §3.3) : seuls les
 * gestionnaires d'événements de `queue/event-subscriptions.service.ts` l'appellent,
 * et les tâches planifiées du §6.
 *
 * ── LES DEUX RÈGLES DURES, ET OÙ ELLES VIVENT ────────────────────────────────
 *
 * 1. LE REGROUPEMENT (§2.3). « Ne pas envoyer dix notifications pour dix
 *    réactions. » Il est tenu par `groupingRuleFor` (la fenêtre) et par un VERROU
 *    CONSULTATIF PostgreSQL pris au début de la transaction.
 *
 *    Le verrou n'est pas une précaution théorique : le consommateur d'événements
 *    tourne avec `concurrency: 5`, et dix réactions arrivent en dix travaux
 *    simultanés. Sans sérialisation, cinq d'entre eux ne trouvent aucune ligne
 *    existante et en créent cinq — le regroupement passerait tous les tests
 *    séquentiels et échouerait en production. La spec propose « une fenêtre
 *    Redis » ; un verrou consultatif la remplace parce qu'il est dans la MÊME
 *    transaction que l'écriture, donc rien ne peut se glisser entre les deux.
 *
 *    La colonne `notifications.group_key` que §3 annonce N'EXISTE PAS dans le
 *    schéma figé. La clé de regroupement est donc calculée et non stockée :
 *    (`user_id`, `type`, `ref_type`, `ref_id`) dans une fenêtre sur `created_at`.
 *    C'est suffisant pour les trois regroupements du §2.3, mais cela interdit un
 *    index unique — d'où le verrou. Voir le rapport.
 *
 * 2. LES PRÉFÉRENCES ET LA SOURDINE (§2.2). Une préférence ne peut QU'ÔTER un
 *    canal : `channelAllowed` décide d'abord ce que la spec autorise, la
 *    préférence s'applique ensuite. L'inverse — partir des préférences — ferait
 *    qu'une préférence `{ SOCIAL: { email: true } }` écrite à la main en base
 *    enverrait un email SOCIAL, que §2.1 interdit absolument.
 *
 *    La SOURDINE PAR RÉSEAU est INAPPLICABLE : `community_members.muted` n'existe
 *    pas dans le schéma figé, alors que 07 §2.3 demande de prévenir « tous les
 *    membres non en sourdine ». Les annonces partent donc à tous les membres. Ce
 *    n'est pas un oubli, c'est une colonne manquante — voir le rapport.
 *
 * ── CE QU'UN GESTIONNAIRE PEUT ATTENDRE ──────────────────────────────────────
 *
 * `deliver()` est IDEMPOTENT et ne lève pas sur un destinataire disparu : un
 * membre supprimé entre l'émission et la consommation rendrait `SKIPPED`, et non
 * une violation de clé étrangère qui ferait rejouer l'événement dix fois avant de
 * l'abandonner.
 */

// ── Ports ────────────────────────────────────────────────────────────────────

/**
 * Le port des files sortantes. `@Optional()` dans le service : une suite
 * d'intégration n'a pas à exiger Redis pour vérifier QUELS canaux ont été
 * décidés — cette décision est écrite dans `outbound_messages` et dans
 * `notifications.channels_sent`, en base, avant toute mise en file.
 */
export interface OutboundQueuePort {
  enqueueEmail(job: OutboundEmailJob): Promise<void>;
  enqueuePush(job: OutboundPushJob): Promise<void>;
}

export const OUTBOUND_QUEUE = Symbol('OutboundQueue');

export interface OutboundEmailJob {
  readonly outboundId: string;
  readonly userId: string;
  readonly template: EmailTemplate;
  readonly variables: Record<string, unknown>;
}

export interface OutboundPushJob {
  readonly outboundId: string;
  readonly userId: string;
  readonly title: string;
  readonly body: string;
  readonly url?: string;
}

/**
 * L'adresse email d'un membre.
 *
 * DÉPENDANCE NON SATISFAITE, et ce port existe pour la nommer : §3 annonce
 * `users.email` « ajoutée au module 01 », et la colonne N'EXISTE PAS dans le
 * schéma figé. Aucune table ne peut donc porter l'adresse d'un membre, ce qui
 * rend `POST /me/email`, `/me/email/verify` et l'envoi réel impossibles.
 *
 * Le port est là plutôt qu'un `TODO` pour trois raisons : la décision « email ou
 * pas » reste testable (une doublure rend une adresse, et la règle dure SOCIAL se
 * vérifie vraiment) ; le jour où la colonne arrive, un seul fournisseur change ;
 * et `has()` traduit littéralement la règle du §3 — « sans email, pas de canal
 * email ».
 */
export interface EmailAddressPort {
  has(userId: string): Promise<boolean>;
  resolve(userId: string): Promise<string | null>;
}

export const EMAIL_ADDRESS = Symbol('EmailAddress');

/** Le fournisseur par défaut : aucune adresse, parce qu'aucune colonne. */
export class NoEmailAddressPort implements EmailAddressPort {
  has(): Promise<boolean> {
    return Promise.resolve(false);
  }
  resolve(): Promise<string | null> {
    return Promise.resolve(null);
  }
}

// ── Entrée de `deliver` ──────────────────────────────────────────────────────

export interface NotificationInput {
  readonly userId: string;
  readonly category: NotificationCategory;
  /** `help.response_received`, `event.reminder_h2`… (§3 du schéma). */
  readonly type: string;
  readonly title: string;
  readonly body?: string | null;
  /** `POST`, `EVENT`, `MENTORSHIP`… Sert la clé de regroupement et le lien. */
  readonly refType?: string | null;
  readonly refId?: string | null;
  /**
   * Titre du push quand il doit DIFFÉRER du titre in-app.
   *
   * C'est par là que passe la règle dure du §2.4 : le gestionnaire de
   * `message.sent` compose « Nouveau message de Sandra » avec `messagePushTitle`,
   * et le corps du message n'entre jamais dans ce champ.
   */
  readonly pushTitle?: string;
  readonly pushBody?: string | null;
  readonly url?: string | null;
  readonly emailTemplate?: EmailTemplate;
  readonly emailVariables?: Record<string, unknown>;
}

export type DeliveryOutcome = 'CREATED' | 'GROUPED' | 'DUPLICATE' | 'SKIPPED';

export interface DeliveryResult {
  readonly outcome: DeliveryOutcome;
  readonly notificationId: string | null;
  /** Ce qui a été décidé — `IN_APP`, `PUSH`, `PUSH_DEFERRED`, `EMAIL`. */
  readonly channels: readonly string[];
}

interface PreferenceState {
  readonly push: Record<string, boolean>;
  readonly email: Record<string, boolean>;
  readonly weeklyDigest: boolean;
  readonly quietHours: QuietHours | null;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly cursorSecret = loadEnv().CURSOR_SECRET;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(EMAIL_PROVIDER) private readonly emailProvider: EmailProvider,
    @Inject(PUSH_PROVIDER) private readonly pushProvider: PushProvider,
    @Optional() @Inject(EMAIL_ADDRESS) private readonly addresses: EmailAddressPort = new NoEmailAddressPort(),
    @Optional() @Inject(OUTBOUND_QUEUE) private readonly queue: OutboundQueuePort | null = null,
  ) {}

  // ══ Le cœur : livrer une notification ═════════════════════════════════════

  /**
   * Crée, regroupe ou ignore une notification, et décide de ses canaux.
   *
   * L'ORDRE des étapes porte les règles :
   *   1. le destinataire existe-t-il encore (sinon `SKIPPED`, jamais d'échec) ;
   *   2. verrou consultatif sur la clé de regroupement ;
   *   3. regroupement ou doublon ;
   *   4. canaux autorisés par la spec, puis ôtés par les préférences ;
   *   5. heures calmes : le push est différé, pas perdu ;
   *   6. écriture en base — notification + traces sortantes — dans UNE transaction ;
   *   7. mise en file, après validation.
   */
  async deliver(input: NotificationInput): Promise<DeliveryResult> {
    const user = await this.prisma.user.findUnique({
      where: { id: input.userId },
      select: { id: true, status: true, timezone: true, deletedAt: true },
    });

    // Un membre supprimé entre l'émission et la consommation est le cas NORMAL
    // d'une livraison « au moins une fois » retardée. Lever ici ferait échouer
    // dix tentatives sur une clé étrangère — un agent l'a trouvé ainsi sur un
    // autre module, et c'est exactement ce qu'on évite.
    if (user === null || user.deletedAt !== null || user.status === 'DELETED') {
      return { outcome: 'SKIPPED', notificationId: null, channels: [] };
    }

    const now = new Date();
    const prefs = await this.preferenceState(input.userId);
    const rule = groupingRuleFor(input.category, input.type);
    const mandatory = isMandatory(input.category, input.type);

    // ── Canaux (§2.1 et §2.2) ───────────────────────────────────────────────
    const channels: string[] = [];
    if (channelAllowed(input.category, input.type, 'IN_APP')) channels.push('IN_APP');
    if (channels.length === 0) {
      // `DIGEST` est le seul cas : il n'a pas d'in-app, et il passe par
      // `weeklyDigest()`, qui n'écrit que dans `outbound_messages`.
      this.logger.warn(`deliver() appelé sur ${input.category}, qui n’a pas d’in-app`);
      return { outcome: 'SKIPPED', notificationId: null, channels: [] };
    }

    const pushWanted =
      channelAllowed(input.category, input.type, 'PUSH') &&
      (mandatory || prefs.push[input.category] !== false);

    const deferPush =
      pushWanted &&
      prefs.quietHours !== null &&
      !this.isSecurityCritical(input.category, input.type) &&
      isWithinQuietHours(now, user.timezone, prefs.quietHours);

    if (pushWanted) channels.push(deferPush ? PUSH_DEFERRED : 'PUSH');

    const emailWanted =
      input.emailTemplate !== undefined &&
      channelAllowed(input.category, input.type, 'EMAIL') &&
      (mandatory || prefs.email[input.category] !== false) &&
      (await this.addresses.has(input.userId));

    if (emailWanted) channels.push('EMAIL');

    // ── Écriture ────────────────────────────────────────────────────────────
    const groupKey = this.groupKey(input, rule?.scope ?? 'SUBJECT');
    const jobs: { email?: OutboundEmailJob; push?: OutboundPushJob } = {};

    const result = await this.prisma.$transaction(async (tx) => {
      // Le verrou est pris DANS la transaction et tombe à son terme : deux
      // travaux concurrents sur la même clé se suivent au lieu de créer deux
      // lignes. `hashtextextended` donne le bigint qu'attend la fonction.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${groupKey}, 0))`;

      const existing = await this.findExisting(tx, input, rule, now);

      if (existing !== null) {
        if (rule === null) {
          // Pas de règle de regroupement : c'est un REJEU du même événement.
          return { outcome: 'DUPLICATE' as const, id: existing.id, channels: existing.channelsSent };
        }

        // Regroupement : la ligne est réécrite avec le titre agrégé fourni par le
        // gestionnaire (« Sandra et 4 autres ont réagi »), et redevient non lue.
        // `created_at` n'est PAS touché : la fenêtre est ancrée sur la première
        // notification, sinon une réaction par cinquante minutes la ferait
        // glisser indéfiniment et l'heure du §2.3 ne serait jamais atteinte.
        await tx.notification.update({
          where: { id: existing.id },
          data: {
            title: input.title,
            body: input.body ?? null,
            readAt: null,
            channelsSent: this.mergeChannels(existing.channelsSent, channels),
          },
        });
        return { outcome: 'GROUPED' as const, id: existing.id, channels };
      }

      const id = newId();
      await tx.notification.create({
        data: {
          id,
          userId: input.userId,
          category: input.category,
          type: input.type,
          title: input.title,
          body: input.body ?? null,
          refType: input.refType ?? null,
          refId: input.refId ?? null,
          channelsSent: channels,
        },
      });

      if (emailWanted && input.emailTemplate !== undefined) {
        const outboundId = newId();
        await tx.outboundMessage.create({
          data: {
            id: outboundId,
            channel: 'EMAIL',
            userId: input.userId,
            template: input.emailTemplate,
            status: 'QUEUED',
          },
        });
        jobs.email = {
          outboundId,
          userId: input.userId,
          template: input.emailTemplate,
          variables: { ...(input.emailVariables ?? {}), title: input.title },
        };
      }

      if (pushWanted && !deferPush) {
        const outboundId = newId();
        await tx.outboundMessage.create({
          data: {
            id: outboundId,
            channel: 'PUSH',
            userId: input.userId,
            template: input.type,
            status: 'QUEUED',
          },
        });
        jobs.push = this.pushJob(outboundId, input);
      }

      return { outcome: 'CREATED' as const, id, channels };
    });

    if (result.outcome === 'CREATED') await this.enqueue(jobs);
    return { outcome: result.outcome, notificationId: result.id, channels: result.channels };
  }

  /** Plusieurs destinataires. INDÉPENDANTS : l'échec de l'un n'arrête pas les autres. */
  async deliverMany(inputs: readonly NotificationInput[]): Promise<number> {
    let delivered = 0;
    const failures: string[] = [];
    for (const input of inputs) {
      try {
        const result = await this.deliver(input);
        if (result.outcome === 'CREATED' || result.outcome === 'GROUPED') delivered += 1;
      } catch (error) {
        failures.push(`${input.userId}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    // Lever À LA FIN : la file rejoue, et `deliver` étant idempotent, les
    // destinataires déjà servis ne le seront pas deux fois.
    if (failures.length > 0) {
      throw new Error(`${failures.length} destinataire(s) en échec : ${failures.join(' · ')}`);
    }
    return delivered;
  }

  /**
   * La ligne à regrouper, ou le doublon d'un rejeu.
   *
   * Sans règle de regroupement, la clé est (`user_id`, `type`, `ref_type`,
   * `ref_id`) SANS fenêtre : un `mentorship.request_received` rejoué un mois plus
   * tard reste le même fait. Quand `ref_id` est absent, on retombe sur une fenêtre
   * de 24 h avec le titre — c'est moins précis, mais une clé sans référence ne
   * peut pas mieux faire, et elle ne concerne que les notifications sans objet.
   */
  private async findExisting(
    tx: Prisma.TransactionClient,
    input: NotificationInput,
    rule: { windowMs: number; scope: 'SUBJECT' | 'USER' } | null,
    now: Date,
  ): Promise<{ id: string; channelsSent: string[] } | null> {
    const base: Prisma.NotificationWhereInput = { userId: input.userId, type: input.type };

    if (rule !== null) {
      const since = new Date(now.getTime() - rule.windowMs);
      return tx.notification.findFirst({
        where:
          rule.scope === 'SUBJECT'
            ? { ...base, refType: input.refType ?? null, refId: input.refId ?? null, createdAt: { gte: since } }
            : { ...base, createdAt: { gte: since } },
        orderBy: { createdAt: 'desc' },
        select: { id: true, channelsSent: true },
      });
    }

    if (input.refId !== undefined && input.refId !== null) {
      return tx.notification.findFirst({
        where: { ...base, refType: input.refType ?? null, refId: input.refId },
        select: { id: true, channelsSent: true },
      });
    }

    const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    return tx.notification.findFirst({
      where: { ...base, title: input.title, createdAt: { gte: since } },
      select: { id: true, channelsSent: true },
    });
  }

  private groupKey(input: NotificationInput, scope: 'SUBJECT' | 'USER'): string {
    return scope === 'USER'
      ? `${input.userId}|${input.type}`
      : `${input.userId}|${input.type}|${input.refType ?? ''}|${input.refId ?? ''}`;
  }

  private mergeChannels(existing: readonly string[], added: readonly string[]): string[] {
    return [...new Set([...existing, ...added])];
  }

  private pushJob(outboundId: string, input: NotificationInput): OutboundPushJob {
    const body = (input.pushBody ?? input.body ?? '').slice(0, PUSH_BODY_MAX);
    return {
      outboundId,
      userId: input.userId,
      title: input.pushTitle ?? input.title,
      body,
      ...(input.url === undefined || input.url === null ? {} : { url: input.url }),
    };
  }

  /**
   * Mise en file — après le COMMIT, et volontairement NON BLOQUANTE.
   *
   * Un échec est journalisé et non levé : la décision d'envoyer est déjà en base
   * (`outbound_messages` en `QUEUED`), et lever ferait rejouer l'événement, dont
   * la dé-duplication rendrait alors `DUPLICATE` sans jamais remettre en file.
   * La ligne `QUEUED` qui vieillit est la trace, et l'alerte du runbook §4 s'y
   * branche.
   *
   * Un renvoi automatique demanderait `outbound_messages.payload` et
   * `outbound_messages.notification_id`, absents du schéma figé — voir le rapport.
   */
  private async enqueue(jobs: { email?: OutboundEmailJob; push?: OutboundPushJob }): Promise<void> {
    if (this.queue === null) return;
    try {
      if (jobs.email !== undefined) await this.queue.enqueueEmail(jobs.email);
      if (jobs.push !== undefined) await this.queue.enqueuePush(jobs.push);
    } catch (error) {
      this.logger.error(
        `mise en file impossible : ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /** §2.2 : la seule exception aux heures calmes — `ACCOUNT` sécurité. */
  private isSecurityCritical(category: NotificationCategory, type: string): boolean {
    return category === 'ACCOUNT' && (ACCOUNT_SECURITY_TYPES as readonly string[]).includes(type);
  }

  // ══ Envois effectifs (appelés par le consommateur du worker) ═══════════════

  /**
   * Envoie un email et met à jour sa trace.
   *
   * L'adresse est résolue ICI, au dernier moment : entre la décision et l'envoi,
   * le membre a pu se désabonner ou supprimer son adresse.
   */
  async sendEmail(job: OutboundEmailJob): Promise<'SENT' | 'FAILED'> {
    const to = await this.addresses.resolve(job.userId);
    if (to === null) {
      await this.prisma.outboundMessage.update({
        where: { id: job.outboundId },
        data: { status: 'FAILED', error: 'NO_EMAIL_ADDRESS' },
      });
      return 'FAILED';
    }

    try {
      const { providerRef } = await this.emailProvider.send(to, job.template, {
        ...job.variables,
        // Le lien de désabonnement en pied de chaque email (§2.5), signé et
        // valable sans connexion (§8).
        unsubscribeUrl: this.unsubscribeUrl(job.userId, this.categoryOfTemplate(job.template)),
      });
      await this.prisma.outboundMessage.update({
        where: { id: job.outboundId },
        data: { status: 'SENT', providerRef, sentAt: new Date() },
      });
      return 'SENT';
    } catch (error) {
      await this.prisma.outboundMessage.update({
        where: { id: job.outboundId },
        data: { status: 'FAILED', error: error instanceof Error ? error.message.slice(0, 500) : 'erreur' },
      });
      // Lever : les cinq tentatives d'`OUTBOUND_JOB_OPTIONS` sont faites pour ça.
      throw error;
    }
  }

  /**
   * Envoie un push à tous les appareils du membre.
   *
   * §2.4 : « Un abonnement qui échoue 5 fois est supprimé. » Le compteur est
   * remis à zéro par un succès — sinon un abonnement vivant finirait supprimé au
   * bout de cinq coupures réseau étalées sur un an.
   */
  async sendPush(job: OutboundPushJob): Promise<{ delivered: number; removed: number }> {
    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: { userId: job.userId },
      select: { id: true, endpoint: true, p256dh: true, auth: true, failureCount: true },
    });

    let delivered = 0;
    let removed = 0;

    for (const sub of subscriptions) {
      try {
        const result = await this.pushProvider.send(
          { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
          { title: job.title, body: job.body, ...(job.url === undefined ? {} : { url: job.url }) },
        );
        if (result.gone === true) {
          // 404/410 du service push : l'abonnement est mort, on ne l'essaie pas
          // quatre fois de plus (§2.4 compte cinq échecs pour les pannes
          // transitoires, pas pour une révocation explicite).
          await this.prisma.pushSubscription.delete({ where: { id: sub.id } });
          removed += 1;
          continue;
        }
        if (!result.delivered) throw new Error('non délivré');
        delivered += 1;
        await this.prisma.pushSubscription.update({
          where: { id: sub.id },
          data: { lastSuccessAt: new Date(), failureCount: 0 },
        });
      } catch {
        const failures = sub.failureCount + 1;
        if (failures >= PUSH_MAX_FAILURES) {
          await this.prisma.pushSubscription.delete({ where: { id: sub.id } });
          removed += 1;
        } else {
          await this.prisma.pushSubscription.update({
            where: { id: sub.id },
            data: { failureCount: failures },
          });
        }
      }
    }

    await this.prisma.outboundMessage.update({
      where: { id: job.outboundId },
      data:
        delivered > 0
          ? { status: 'SENT', sentAt: new Date() }
          : { status: 'FAILED', error: subscriptions.length === 0 ? 'NO_SUBSCRIPTION' : 'PUSH_FAILED' },
    });

    return { delivered, removed };
  }

  // ══ Lecture in-app (§2.7 et §4) ═══════════════════════════════════════════

  async list(
    userId: string,
    query: { cursor?: string | undefined; limit: number; unread?: boolean | undefined; category?: NotificationCategory | undefined },
  ) {
    const scope = `notifications:${userId}:${query.unread === true ? 'unread' : 'all'}:${query.category ?? '*'}`;
    const cursor = query.cursor === undefined ? null : decodeCursor(query.cursor, this.cursorSecret, scope);

    const conditions: Prisma.NotificationWhereInput[] = [{ userId }];
    if (query.unread === true) conditions.push({ readAt: null });
    if (query.category !== undefined) conditions.push({ category: query.category });

    // Keyset sur (`created_at`, `id`) : le tri n'est PAS l'identifiant, donc
    // `buildPage` reçoit un `sortOf`. Sans lui, une notification regroupée — dont
    // `created_at` reste celui de la première — ferait répéter des lignes et en
    // perdre d'autres, silencieusement.
    if (cursor !== null) {
      const at = new Date(String(cursor.sort));
      conditions.push({
        OR: [{ createdAt: { lt: at } }, { createdAt: at, id: { lt: cursor.id } }],
      });
    }

    const rows = await this.prisma.notification.findMany({
      where: { AND: conditions },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      select: {
        id: true,
        createdAt: true,
        category: true,
        type: true,
        title: true,
        body: true,
        refType: true,
        refId: true,
        readAt: true,
        channelsSent: true,
      },
    });

    const page = buildPage(rows, query.limit, scope, this.cursorSecret, (row) =>
      row.createdAt.toISOString(),
    );

    return { ...page, meta: { unread: await this.unreadCount(userId) } };
  }

  async unreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, readAt: null } });
  }

  /** `POST /notifications/read` : `ids[]` ou `all` (§4). */
  async markRead(userId: string, input: { ids?: string[] | undefined; all?: true | undefined }): Promise<{ updated: number; unread: number }> {
    const where: Prisma.NotificationWhereInput =
      input.all === true
        ? { userId, readAt: null }
        : { userId, readAt: null, id: { in: input.ids ?? [] } };

    const { count } = await this.prisma.notification.updateMany({
      where,
      data: { readAt: new Date() },
    });
    return { updated: count, unread: await this.unreadCount(userId) };
  }

  // ══ Préférences (§2.2 et §4) ══════════════════════════════════════════════

  /**
   * La grille du §5, construite par le SERVEUR.
   *
   * Elle dit pour chaque catégorie quels canaux existent et lesquels sont
   * verrouillés. Le front ne doit pas recalculer la matrice : c'est la raison
   * d'être de `CATEGORY_CHANNELS` dans `@app/shared`, et un écran qui proposerait
   * de couper `MODERATION` mentirait.
   */
  async preferences(userId: string) {
    const state = await this.preferenceState(userId);

    return {
      categories: NOTIFICATION_CATEGORIES.map((category) => {
        const row = CATEGORY_CHANNELS[category];
        return {
          category,
          label: CATEGORY_LABELS_FR[category],
          inApp: row.inApp,
          push: {
            available: row.push !== false,
            enabled: row.push !== false && state.push[category] !== false,
            locked: isMandatory(category, ''),
          },
          email: {
            available: row.email !== false,
            enabled: row.email !== false && state.email[category] !== false,
            locked: isMandatory(category, ''),
          },
        };
      }),
      weeklyDigest: state.weeklyDigest,
      quietHours: state.quietHours,
      /** §3 : sans email, pas de canal email — l'interface le propose au moment utile. */
      emailAvailable: await this.addresses.has(userId),
    };
  }

  /**
   * `PUT /me/notification-preferences`.
   *
   * Une tentative de désactiver une catégorie non désactivable est NORMALISÉE, pas
   * refusée : la grille est servie par le serveur, donc le front n'offre pas le
   * réglage, et un 422 sur un champ que l'écran n'affiche pas serait indébogable.
   * La réponse dit l'état effectif.
   */
  async updatePreferences(userId: string, input: NotificationPreferencesInput) {
    const state = await this.preferenceState(userId);
    const push = { ...state.push };
    const email = { ...state.email };

    for (const [rawCategory, value] of Object.entries(input.categories ?? {})) {
      const category = rawCategory as NotificationCategory;
      if (isMandatory(category, '')) continue;
      if (value.push !== undefined) push[category] = value.push;
      if (value.email !== undefined) email[category] = value.email;
    }

    // RÈGLE DURE (§2.1) : aucune préférence ne peut ouvrir l'email SOCIAL. Le
    // filtre de `channelAllowed` suffirait, mais laisser `{ SOCIAL: true }` en
    // base ferait croire, en lisant la table, que l'email partira.
    delete email['SOCIAL'];

    const quietHours =
      input.quietHours === undefined
        ? state.quietHours
        : input.quietHours === null
          ? null
          : quietHoursSchema.parse(input.quietHours);

    const weeklyDigest = input.weeklyDigest ?? state.weeklyDigest;

    await this.prisma.notificationPreferences.upsert({
      where: { userId },
      create: { userId, push, email, weeklyDigest, quietHours: quietHours ?? Prisma.DbNull },
      update: { push, email, weeklyDigest, quietHours: quietHours ?? Prisma.DbNull },
    });

    return this.preferences(userId);
  }

  /**
   * L'état effectif des préférences, défauts compris.
   *
   * L'ABSENCE d'une clé vaut ACTIVÉ : le tableau du §2.1 est une liste de canaux
   * « par défaut », donc tout ce qu'il coche est actif jusqu'à ce que le membre
   * le coupe. Écrire les quatorze catégories à l'inscription aurait figé la
   * matrice du jour de l'inscription — un canal ajouté plus tard serait resté
   * éteint pour tous les membres existants.
   */
  private async preferenceState(userId: string): Promise<PreferenceState> {
    const row = await this.prisma.notificationPreferences.findUnique({
      where: { userId },
      select: { push: true, email: true, weeklyDigest: true, quietHours: true },
    });

    if (row === null) {
      return { push: {}, email: {}, weeklyDigest: true, quietHours: { ...DEFAULT_QUIET_HOURS } };
    }

    const parsed = quietHoursSchema.safeParse(row.quietHours);
    return {
      push: asBoolMap(row.push),
      email: asBoolMap(row.email),
      weeklyDigest: row.weeklyDigest,
      // `null` en base = heures calmes DÉSACTIVÉES par le membre. Retomber sur
      // le défaut dans ce cas empêcherait de les couper.
      quietHours: row.quietHours === null ? null : parsed.success ? parsed.data : { ...DEFAULT_QUIET_HOURS },
    };
  }

  // ══ Abonnements push (§2.4 et §4) ═════════════════════════════════════════

  /**
   * `POST /me/push-subscriptions`.
   *
   * La ROUTE n'est appelée qu'après une action explicite du membre (§2.4) : la
   * règle « jamais au premier chargement » se tient côté client, puisque c'est le
   * navigateur qui demande la permission. Ce que le serveur peut garantir, et
   * qu'il garantit, c'est qu'AUCUN push ne part vers un membre sans abonnement
   * enregistré par cette route — donc sans geste de sa part.
   */
  async registerPushSubscription(
    userId: string,
    input: { endpoint: string; keys: { p256dh: string; auth: string }; userAgent?: string | undefined },
  ) {
    const existing = await this.prisma.pushSubscription.findUnique({
      where: { endpoint: input.endpoint },
      select: { id: true, userId: true },
    });

    // Un même `endpoint` peut avoir changé de main (appareil partagé, compte
    // recréé) : on le réaffecte plutôt que de refuser, sinon le nouveau membre ne
    // recevrait jamais de push sur cet appareil.
    if (existing !== null) {
      await this.prisma.pushSubscription.update({
        where: { id: existing.id },
        data: {
          userId,
          p256dh: input.keys.p256dh,
          auth: input.keys.auth,
          userAgent: input.userAgent ?? null,
          failureCount: 0,
        },
      });
      return { id: existing.id, created: false };
    }

    const id = newId();
    await this.prisma.pushSubscription.create({
      data: {
        id,
        userId,
        endpoint: input.endpoint,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        userAgent: input.userAgent ?? null,
      },
    });
    return { id, created: true };
  }

  async removePushSubscription(userId: string, id: string): Promise<void> {
    const { count } = await this.prisma.pushSubscription.deleteMany({ where: { id, userId } });
    if (count === 0) throw ApiError.notFound();
  }

  // ══ Désabonnement en un clic (§2.2 et §8) ═════════════════════════════════

  /**
   * Un jeton signé, lisible sans connexion.
   *
   * La clé est DÉRIVÉE de `CURSOR_SECRET` par HMAC, avec une étiquette de domaine :
   * une variable d'environnement de plus demanderait de toucher la configuration,
   * et employer `JWT_ACCESS_SECRET` tel quel exposerait le secret des jetons
   * d'accès dans des liens qui vivent quatre-vingt-dix jours.
   */
  unsubscribeToken(userId: string, category: NotificationCategory): string {
    const expiresAt = Date.now() + UNSUBSCRIBE_TOKEN_TTL_DAYS * 86_400_000;
    const data = Buffer.from(JSON.stringify({ u: userId, c: category, e: expiresAt })).toString('base64url');
    return `${data}.${this.signUnsubscribe(data)}`;
  }

  unsubscribeUrl(userId: string, category: NotificationCategory): string {
    return `${loadEnv().WEB_ORIGIN}/unsubscribe?token=${this.unsubscribeToken(userId, category)}`;
  }

  /**
   * `GET /unsubscribe?token` — route PUBLIQUE (§4).
   *
   * Elle coupe l'EMAIL de la catégorie, jamais l'in-app : un membre qui ne veut
   * plus d'email ne demande pas à ne plus être prévenu.
   */
  async unsubscribe(token: string): Promise<{ category: NotificationCategory; message: string }> {
    const parts = token.split('.');
    if (parts.length !== 2) throw ApiError.validation([{ path: 'token', code: 'MALFORMED' }]);
    const [data, signature] = parts as [string, string];

    const expected = this.signUnsubscribe(data);
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw ApiError.validation([{ path: 'token', code: 'INVALID_SIGNATURE' }]);
    }

    // Le contenu est VALIDÉ, pas seulement désérialisé : la signature prouve
    // l'origine, pas la forme. Un jeton signé par une version antérieure du code
    // pourrait porter autre chose, et un `as` le laisserait passer jusqu'à un
    // `upsert` sur un `user_id` indéfini.
    const parsed = unsubscribePayloadSchema.safeParse(readJson(data));
    if (!parsed.success) throw ApiError.validation([{ path: 'token', code: 'MALFORMED' }]);
    const payload = parsed.data;
    if (payload.e < Date.now()) throw ApiError.validation([{ path: 'token', code: 'EXPIRED' }]);

    // `MODERATION` ne se désabonne pas (§2.2). Le lien est tout de même valide :
    // on confirme sans rien changer, plutôt que d'afficher une erreur à quelqu'un
    // qui a simplement cliqué.
    if (!isMandatory(payload.c, '')) {
      const state = await this.preferenceState(payload.u);
      await this.prisma.notificationPreferences.upsert({
        where: { userId: payload.u },
        create: {
          userId: payload.u,
          push: state.push,
          email: { ...state.email, [payload.c]: false },
          weeklyDigest: payload.c === 'DIGEST' ? false : state.weeklyDigest,
          quietHours: state.quietHours ?? Prisma.DbNull,
        },
        update: {
          email: { ...state.email, [payload.c]: false },
          ...(payload.c === 'DIGEST' ? { weeklyDigest: false } : {}),
        },
      });
    }

    return { category: payload.c, message: UNSUBSCRIBE_CONFIRMATION_FR };
  }

  private signUnsubscribe(data: string): string {
    const key = createHmac('sha256', this.cursorSecret).update('notifications:unsubscribe').digest();
    return createHmac('sha256', key).update(data).digest('base64url');
  }

  /** Quel réglage un modèle d'email dessert — pour le lien de désabonnement. */
  private categoryOfTemplate(template: EmailTemplate): NotificationCategory {
    switch (template) {
      case 'weekly_digest':
        return 'DIGEST';
      case 'mentorship_request_received':
        return 'MENTORSHIP';
      case 'guide_proposal_received':
        return 'GUIDE';
      case 'journey_deadline_j1':
        return 'JOURNEY_DEADLINE';
      case 'moderation':
        return 'MODERATION';
      default:
        return 'ACCOUNT';
    }
  }

  // ══ Tâches planifiées (§6) ════════════════════════════════════════════════

  /**
   * `notifications.quiet_hours_flush` — horaire. « Envoie les push différés. »
   *
   * Les push différés sont retrouvés par le marqueur `PUSH_DEFERRED` de
   * `channels_sent`, et la notification porte déjà titre, corps et référence —
   * c'est ce qui permet de composer le push une heure plus tard sans colonne de
   * charge utile.
   */
  async flushQuietHours(now = new Date()): Promise<{ sent: number; stillQuiet: number }> {
    const pending = await this.prisma.notification.findMany({
      where: { channelsSent: { has: PUSH_DEFERRED } },
      select: {
        id: true,
        userId: true,
        type: true,
        category: true,
        title: true,
        body: true,
        refType: true,
        refId: true,
        channelsSent: true,
        user: { select: { timezone: true, status: true, deletedAt: true } },
      },
      take: 500,
    });

    let sent = 0;
    let stillQuiet = 0;

    for (const row of pending) {
      if (row.user.deletedAt !== null || row.user.status === 'DELETED') continue;
      const prefs = await this.preferenceState(row.userId);
      if (
        prefs.quietHours !== null &&
        isWithinQuietHours(now, row.user.timezone, prefs.quietHours)
      ) {
        stillQuiet += 1;
        continue;
      }

      const outboundId = newId();
      await this.prisma.outboundMessage.create({
        data: { id: outboundId, channel: 'PUSH', userId: row.userId, template: row.type, status: 'QUEUED' },
      });

      // Le marqueur est remplacé AVANT l'envoi : si l'envoi échoue, la trace
      // `outbound_messages` le dit, alors qu'un marqueur laissé en place ferait
      // renvoyer le même push à chaque exécution horaire.
      await this.prisma.notification.update({
        where: { id: row.id },
        data: { channelsSent: [...row.channelsSent.filter((c) => c !== PUSH_DEFERRED), 'PUSH'] },
      });

      await this.sendPush({
        outboundId,
        userId: row.userId,
        title: row.title,
        body: (row.body ?? '').slice(0, PUSH_BODY_MAX),
      });
      sent += 1;
    }

    return { sent, stillQuiet };
  }

  /** `notifications.purge` — quotidienne. §2.7 : « Conservation 90 jours. » */
  async purge(now = new Date()): Promise<{ notifications: number; outbound: number }> {
    const notificationsBefore = new Date(now.getTime() - NOTIFICATION_RETENTION_DAYS * 86_400_000);
    const outboundBefore = new Date(now.getTime() - OUTBOUND_RETENTION_DAYS * 86_400_000);

    const notifications = await this.prisma.notification.deleteMany({
      where: { createdAt: { lt: notificationsBefore } },
    });
    const outbound = await this.prisma.outboundMessage.deleteMany({
      where: { createdAt: { lt: outboundBefore } },
    });

    return { notifications: notifications.count, outbound: outbound.count };
  }

  /** `push.cleanup` — quotidienne. §2.4 : cinq échecs et l'abonnement disparaît. */
  async cleanupPushSubscriptions(): Promise<number> {
    const { count } = await this.prisma.pushSubscription.deleteMany({
      where: { failureCount: { gte: PUSH_MAX_FAILURES } },
    });
    return count;
  }

  /**
   * `notifications.weekly_digest` — « lundi 8 h par fuseau (exécutions horaires
   * avec filtre de fuseau) ».
   *
   * §2.6 : « Pas de résumé si rien à dire. » C'est la règle qui compte : un email
   * hebdomadaire vide est la meilleure façon de se faire marquer indésirable.
   *
   * Le résumé n'écrit AUCUNE notification in-app — le tableau du §2.1 laisse la
   * colonne vide pour `DIGEST`. Sa seule trace est `outbound_messages`, ce qui
   * sert aussi de dé-duplication : un membre déjà servi cette semaine est ignoré.
   */
  async weeklyDigest(now = new Date()): Promise<{ sent: number; skipped: number }> {
    const candidates = await this.prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        deletedAt: null,
        // `notIn` sur une colonne NULLABLE élimine aussi les `NULL`. Ici la
        // relation est optionnelle, donc l'absence de ligne de préférences doit
        // valoir « résumé activé » (défaut oui, §2.6) : d'où le `OR`.
        OR: [{ notificationPreferences: null }, { notificationPreferences: { weeklyDigest: true } }],
      },
      select: { id: true, timezone: true, cityId: true },
      take: 2_000,
    });

    let sent = 0;
    let skipped = 0;
    const weekStart = new Date(now.getTime() - 7 * 86_400_000);

    for (const user of candidates) {
      if (!this.isDigestHour(now, user.timezone)) {
        skipped += 1;
        continue;
      }

      const already = await this.prisma.outboundMessage.findFirst({
        where: { userId: user.id, template: 'weekly_digest', createdAt: { gte: weekStart } },
        select: { id: true },
      });
      if (already !== null) {
        skipped += 1;
        continue;
      }

      const content = await this.digestContent(user.id, user.cityId, now);
      if (!content.hasSomethingToSay) {
        skipped += 1;
        continue;
      }

      const outboundId = newId();
      await this.prisma.outboundMessage.create({
        data: { id: outboundId, channel: 'EMAIL', userId: user.id, template: 'weekly_digest', status: 'QUEUED' },
      });
      await this.enqueue({
        email: { outboundId, userId: user.id, template: 'weekly_digest', variables: { ...content } },
      });
      sent += 1;
    }

    return { sent, skipped };
  }

  private isDigestHour(now: Date, timezone: string): boolean {
    try {
      const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: timezone,
        weekday: 'short',
        hour: '2-digit',
        hour12: false,
      }).formatToParts(now);
      const weekday = parts.find((p) => p.type === 'weekday')?.value ?? '';
      const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '-1');
      return weekday === 'Mon' && hour === DIGEST_LOCAL_HOUR;
    } catch {
      return now.getUTCDay() === DIGEST_WEEKDAY && now.getUTCHours() === DIGEST_LOCAL_HOUR;
    }
  }

  /**
   * Le contenu du §2.6, moins ce que le schéma ne permet pas.
   *
   * ABSENT : « mon parcours (prochaine échéance) ». Le module 03 n'est pas livré,
   * donc aucune étape ne peut être lue — inventer une requête sur des tables vides
   * donnerait l'illusion d'une chaîne branchée. Voir le rapport.
   */
  private async digestContent(userId: string, cityId: string | null, now: Date) {
    const weekAhead = new Date(now.getTime() + 7 * 86_400_000);
    const weekBehind = new Date(now.getTime() - 7 * 86_400_000);

    const [openRequests, cityEvents, guides, newcomers] = await Promise.all([
      this.prisma.helpRequest.count({ where: { authorUserId: userId, status: 'OPEN', deletedAt: null } }),
      cityId === null
        ? Promise.resolve([])
        : this.prisma.event.findMany({
            where: { cityId, status: 'SCHEDULED', startsAt: { gte: now, lt: weekAhead } },
            select: { id: true, title: true, startsAt: true },
            orderBy: { startsAt: 'asc' },
            take: 5,
          }),
      this.prisma.guide.findMany({
        // `guides` n'a pas de `published_at` : la date de contenu la plus récente
        // est ce que le schéma offre, et c'est elle qui fait « publié cette
        // semaine » pour un guide révisé comme pour un guide neuf.
        where: { status: 'PUBLISHED', deletedAt: null, lastContentUpdateAt: { gte: weekBehind } },
        select: { id: true, title: true, helpfulCount: true },
        orderBy: [{ helpfulCount: 'desc' }, { lastContentUpdateAt: 'desc' }],
        take: DIGEST_GUIDES_COUNT,
      }),
      cityId === null
        ? Promise.resolve([])
        : this.prisma.user.findMany({
            where: {
              cityId,
              status: 'ACTIVE',
              deletedAt: null,
              id: { not: userId },
              createdAt: { gte: weekBehind },
            },
            select: { id: true, displayName: true, handle: true },
            orderBy: { createdAt: 'desc' },
            take: DIGEST_NEWCOMERS_COUNT,
          }),
    ]);

    return {
      openRequests,
      cityEvents,
      guides,
      newcomers,
      hasSomethingToSay:
        openRequests > 0 || cityEvents.length > 0 || guides.length > 0 || newcomers.length > 0,
    };
  }

  // ══ Suppression de compte (§7) ════════════════════════════════════════════

  /**
   * §7 : « Notifications, préférences, abonnements push, email : supprimés.
   * `outbound_messages` : conservés 90 jours anonymisés puis purgés. »
   *
   * IDEMPOTENT : `deleteMany` sur rien ne fait rien, et l'anonymisation d'une
   * ligne déjà anonyme est un `UPDATE` sans effet. Un rejeu ne coûte donc rien.
   */
  async handleUserDeleted(userId: string): Promise<void> {
    await this.prisma.notification.deleteMany({ where: { userId } });
    await this.prisma.notificationPreferences.deleteMany({ where: { userId } });
    await this.prisma.pushSubscription.deleteMany({ where: { userId } });
    // ANONYMISÉS, pas supprimés : la trace des envois sert la délivrabilité et
    // les rebonds, et `user_id` est en `SetNull`.
    await this.prisma.outboundMessage.updateMany({ where: { userId }, data: { userId: null } });
  }
}

/** La charge d'un jeton de désabonnement : membre, catégorie, expiration. */
const unsubscribePayloadSchema = z.object({
  u: z.string().uuid(),
  c: notificationCategorySchema,
  e: z.number().int().positive(),
});

function readJson(base64url: string): unknown {
  try {
    return JSON.parse(Buffer.from(base64url, 'base64url').toString('utf8')) as unknown;
  } catch {
    return null;
  }
}

/** Un json `{ catégorie: bool }` lu défensivement : la colonne est du JSON libre. */
function asBoolMap(value: unknown): Record<string, boolean> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  const out: Record<string, boolean> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === 'boolean') out[key] = raw;
  }
  return out;
}
