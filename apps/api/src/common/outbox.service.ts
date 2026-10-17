import { Injectable, Logger } from '@nestjs/common';
import { newId, type Prisma } from '@app/db';
import { PrismaService } from './prisma.service';

/**
 * Boîte d'envoi transactionnelle — 00-fondations.md §9.1.
 *
 * « Un service qui modifie l'état écrit, DANS LA MÊME TRANSACTION, une ligne
 * dans `domain_events`. Un relais (tâche toutes les secondes) publie ces
 * événements dans la file `events` et les marque publiés. Cela garantit qu'aucun
 * effet de bord n'est perdu ni exécuté pour une écriture annulée. »
 *
 * Le problème que ce patron résout, et qu'une publication directe ne résout
 * pas : si l'on publiait dans Redis juste après le COMMIT, une panne entre les
 * deux perdrait l'événement — un parrainage accepté sans notification, une
 * réputation jamais créditée. Et si l'on publiait AVANT, une transaction annulée
 * déclencherait des effets pour une écriture qui n'a jamais eu lieu.
 *
 * Écrire l'événement dans la même transaction que la donnée élimine les deux
 * cas : soit les deux existent, soit aucun.
 *
 * RÈGLE (§3.3) : « Les effets de bord (notifications, indexation, réputation)
 * passent par des événements de domaine, JAMAIS par des appels directs. » Un
 * service qui appellerait NotificationService en direct recréerait le couplage
 * que ce patron existe pour défaire.
 */

/** Nommage imposé : `<entité>.<verbe_passé>` (§9.1). */
export type DomainEventType =
  | 'journey.created'
  | 'journey.step_completed'
  | 'journey.step_started'
  | 'journey.completed'
  | 'blocker.published'
  // ── 04-fil.md §6 ──────────────────────────────────────────────────────────
  //
  // `post.created` et `story.created` sont RETIRÉS : §6 ne les nomme pas, et
  // personne ne les émettait ni ne les écoutait. Même traitement que
  // `help_request.created` et `event.created` avant eux — un type inventé finit
  // par faire croire la chaîne branchée.
  | 'post.published'
  | 'post.reacted'
  | 'post.commented'
  | 'post.moved_to_topic'
  | 'story.published'
  | 'story.expired'
  | 'story.reacted'
  | 'story.converted'
  // ── 08-parrainage-messagerie.md §9 ────────────────────────────────────────
  | 'mentorship.declined'
  | 'mentorship.extended'
  | 'connection.requested'
  | 'message.sent'
  | 'journey.member_joined'
  // §7 du module 03 : consommateur `messaging`, qui recalcule l'appartenance à la
  // conversation du parcours. Sans ce type, un accompagnant retiré de l'équipe
  // resterait indéfiniment dans la discussion — `journey.member_joined` est le
  // seul événement auquel la messagerie se réabonne, et le réutiliser pour un
  // retrait serait un mensonge sur le nom. Les autres états du §7
  // (`step_paused`, `paused`, `abandoned`, `member_invited`,
  // `template_version_published`) restent ABSENTS faute de consommateur livré.
  | 'journey.member_removed'
  | 'guide.voted'
  | 'guide.published'
  // Le reste du §6 du module 05. Chacun a son consommateur nommé : search et
  // journeys pour les changements d'état (le lien d'étape doit cesser de pointer
  // un guide retiré), reputation pour les votes et les contributions,
  // notifications et moderation pour les propositions.
  | 'guide.unpublished'
  | 'guide.flagged'
  | 'guide.restored'
  | 'guide.vote_removed'
  | 'guide.version_created'
  | 'guide.proposal_created'
  | 'guide.proposal_accepted'
  | 'guide.proposal_rejected'
  | 'guide.proposal_escalated'
  /**
   * UNE PAGE A ÉTÉ RETIRÉE D'UN GUIDE (05 `GuidePage`).
   *
   * SON CONSOMMATEUR EST NOMMÉ, comme l'exige ce catalogue : `search`, qui
   * réindexe le guide. C'est NÉCESSAIRE et pas décoratif — l'index porte le corps
   * de TOUTES les pages (`search.service.ts`, cas `GUIDE`), donc retirer une page
   * RÉTRÉCIT le document indexé. Sans cet événement, le texte de la page retirée
   * resterait cherchable et mènerait vers une page qu'aucune route ne rend.
   *
   * L'AJOUT d'une page n'a PAS d'événement à lui : quand elle arrive avec un
   * corps, `appendVersion` émet déjà `guide.version_created`, auquel `search` est
   * abonné ; quand elle arrive vide, rien n'a changé pour personne. Le
   * RENOMMAGE et le DÉPLACEMENT n'en ont pas non plus — ni l'index ni aucune
   * notification ne portent le titre d'une page, et ce catalogue refuse les
   * événements sans consommateur.
   */
  | 'guide.page_removed'
  // Les quatre événements de 06 §6. `published` et non `created` : c'est le nom
  // que la spec donne, et celui que search, moderation et les notifications
  // « Vous pouvez aider » attendent. `help_request.created` était une invention
  // de ce catalogue, sans consommateur — retiré plutôt que gardé en doublon.
  | 'help_request.published'
  | 'help_request.responded'
  | 'help_request.resolved'
  | 'help_request.reopened'
  | 'mentorship.requested'
  | 'mentorship.accepted'
  | 'mentorship.ended'
  // Module 09 §7. `event.created` et `event.attended` figuraient ici depuis le
  // lot 0 et ne correspondent à AUCUNE ligne du §7 : c'étaient des inventions de
  // ce catalogue, sans consommateur. Retirées plutôt que gardées en doublon, comme
  // `help_request.created` l'avait été.
  | 'event.published'
  | 'event.updated'
  | 'event.cancelled'
  | 'event.done'
  | 'event.rsvp_changed'
  | 'event.checked_in'
  | 'city_tip.published'
  | 'city_tip.voted'
  | 'connection.created'
  // CONSOMMÉ par l'annuaire professionnel : 10 §4.3 conditionne une recommandation
  // pro à l'existence d'une `connection`, donc la recommandation doit disparaître
  // avec le contact. Le producteur est le module 08, non encore livré —
  // l'abonnement l'attend plutôt que d'être oublié le jour où il arrivera.
  | 'connection.removed'
  // ── 10-services.md §8 ─────────────────────────────────────────────────────
  //
  // `pro.approved` et `pro.rejected` ONT désormais leur producteur : la validation
  // humaine du §4.1, livrée par le module 15 (`AdminService.approveProProfile`).
  // Ils sont donc ajoutés — c'est ce qui débloque l'annuaire, qui restait vide
  // faute de pouvoir passer une fiche en `APPROVED`.
  //
  // Leurs consommateurs déclarés par 10 §8 — indexation de recherche, notification
  // au membre — n'existent pas encore, et rien n'est câblé pour eux dans
  // `event-subscriptions.service.ts` : un abonnement vide serait une chaîne qu'on
  // croirait branchée. La trace de la décision, elle, est dans `audit_logs`, donc
  // rien n'est perdu en attendant.
  | 'pro.approved'
  | 'pro.rejected'
  // Absent faute de PRODUCTEUR : `pro.tier_changed` (facturation, module 14). Un
  // type sans producteur est une file que personne ne remplit, et l'on croirait la
  // chaîne branchée.
  | 'housing.published'
  | 'housing.updated'
  | 'housing.expired'
  | 'housing.taken'
  | 'housing.contacted'
  | 'job.published'
  | 'job.sponsored'
  | 'pro.registered'
  | 'pro.contacted'
  | 'pro.recommended'
  // §3.3 exige de notifier l'auteur de l'offre d'une recommandation de membre, mais
  // le tableau du §8 ne nomme pas l'événement. On l'ajoute plutôt que de détourner
  // `job.published`, qui déclencherait une indexation d'offre inexistante.
  | 'member.recommended'
  // Consommé par presque tous les modules de contenu — fil, guides, entraide,
  // réseaux, agenda, services — pour leurs règles de visibilité.
  | 'user.blocked'
  | 'kyc.status_changed'
  | 'phone.added'
  | 'phone.removed'
  | 'user.level_changed'
  | 'user.registered'
  // Le reste du §7 du module 01. Chacun a un consommateur nommé dans la spec :
  // un type sans consommateur créerait une file que personne ne lit.
  | 'user.onboarded'
  | 'user.onboarded_location'
  | 'user.phase_changed'
  | 'user.deactivated'
  | 'user.reactivated'
  | 'user.deletion_requested'
  | 'user.deleted'
  /**
   * 01 §2.8 : « génération ASYNCHRONE d'une archive ».
   *
   * C'est ce mot qui impose un événement plutôt qu'un appel. Rassembler les
   * données d'un membre traverse une vingtaine de tables ; le faire dans la
   * requête HTTP ferait expirer la demande d'un membre ancien, et §3.3 interdit
   * de toute façon l'appel direct. Le producteur est `POST /me/export`, le
   * consommateur est le module `users` dans le worker — les deux existent, ce
   * que ce catalogue exige de tout type déclaré.
   */
  | 'user.export_requested'
  /**
   * ── 02-referentiels.md §2.2 et §4.2 ──────────────────────────────────────
   *
   * L'activation d'une ville ou d'un pays. §2.2 : « À l'activation : création du
   * `community` CITY. Les membres déjà rattachés y sont inscrits PAR ÉVÉNEMENT. »
   *
   * Le réseau, lui, est créé par le service dans la foulée — il en a besoin
   * immédiatement pour le rendre dans sa réponse. Ce qui passe par l'événement,
   * c'est l'INSCRIPTION des membres déjà rattachés, qui peut en concerner des
   * centaines et n'a aucune raison de tenir la transaction d'activation.
   *
   * `city.merged` suit la même logique : les membres sont déplacés dans la
   * transaction — c'est une écriture bornée sur `users` — et le recalcul de leurs
   * réseaux, qui ne l'est pas, se fait après.
   *
   * Consommateur : `communities`, qui recalcule les adhésions automatiques.
   */
  | 'city.activated'
  | 'country.activated'
  | 'city.merged'
  // 07-reseaux.md §6. Consommateurs nommés : search et notifications pour la vie
  // du réseau, notifications et cities pour les adhésions.
  //
  // `community.activity` du §6 n'est PAS ici : son unique consommateur déclaré
  // est « met à jour last_activity_at », que le service fait lui-même dans la
  // transaction. Un événement pour se le renvoyer à soi-même ouvrirait une
  // fenêtre où l'activité existe mais où la date d'archivage est encore vieille,
  // et la tâche quotidienne pourrait endormir un réseau qui vient de vivre.
  //
  // `community.topic_replied` non plus : aucune route ne crée de réponse
  // aujourd'hui, donc rien ne peut l'émettre.
  | 'community.created'
  | 'community.archived'
  // L'avertissement d'archivage à 45 jours (§2.2, §7). Il a attendu la colonne
  // `communities.warning_sent_at` : sans elle, la tâche QUOTIDIENNE l'aurait
  // émis les quinze jours qui séparent le 45e du 60e. Consommateur :
  // `notifications` (`onCommunityArchiveWarning`).
  | 'community.archive_warning'
  | 'community.reactivated'
  // La visibilité d'un réseau a changé (« Gérer · Paramètres · Visibilité ») :
  // la recherche réindexe ses sujets et ses événements, comme sur l'archivage,
  // pour qu'un réseau passé « Sur invitation » ne laisse plus rien filtrer.
  | 'community.visibility_changed'
  | 'community.member_joined'
  | 'community.member_left'
  | 'community.member_banned'
  | 'community.topic_created'
  | 'community.topic_resolved'
  | 'community.announcement_published'
  // ── 14-monetisation.md §9 ─────────────────────────────────────────────────
  //
  // `subscription.changed` était dans ce catalogue depuis le lot 0 SANS aucun
  // consommateur : le module 14 n'existait pas, et personne ne l'écoutait. Il a
  // désormais les deux moitiés — producteur (BillingService, pour l'activation,
  // l'expiration, l'essai et les rappels) et consommateur (les notifications du
  // module 12, `NotificationEventsService.onSubscriptionChanged`).
  //
  // UN SEUL type porte les huit faits du §9, distingués par `payload.reason` :
  // huit types en auraient laissé sept sans consommateur propre, et le tableau du
  // §9 leur donne de toute façon les MÊMES consommateurs. C'est la forme déjà
  // employée par `event.updated` + `reminder: 'H_MINUS_2'` (module 09).
  | 'subscription.changed'
  // Les deux autres événements de paiement du §9 qui ont un consommateur réel :
  // un refus de carte et un remboursement doivent être DITS au membre, et aucun
  // autre événement ne les porte. `payment.succeeded` n'est PAS ici : l'activation
  // qu'il annoncerait est déjà portée par `subscription.changed`, et deux
  // notifications pour un seul acte valent moins qu'une.
  //
  // `affiliate.clicked` / `affiliate.converted` (§9) ne sont pas ici non plus :
  // leur unique consommateur déclaré est « analytics », qui n'existe pas. Les
  // clics et conversions sont en base, donc rien n'est perdu.
  | 'payment.failed'
  | 'payment.refunded'
  | 'report.created'
  | 'content.flagged'
  // ── 13-moderation.md §6 ───────────────────────────────────────────────────
  //
  // `restored` couvre UNHIDE et DISMISS : du point de vue d'un module de contenu,
  // le contenu redevient visible, et le motif qui l'a rendu ne le concerne pas.
  //
  // Chaque module de contenu doit s'abonner à `content_hidden` / `restored` /
  // `removed` pour appliquer l'effet sur SA table : le service de modération n'y
  // écrit jamais, hormis `users.status` que §4.2 exige mot pour mot.
  | 'moderation.content_hidden'
  | 'moderation.content_restored'
  | 'moderation.content_removed'
  | 'moderation.user_suspended'
  | 'moderation.user_banned'
  | 'moderation.user_reinstated'
  | 'moderation.case_opened'
  | 'moderation.case_resolved'
  | 'scam_alert.published';

export interface DomainEventInput {
  readonly type: DomainEventType;
  /** L'entité concernée : parcours, publication, membre… */
  readonly aggregateId: string;
  readonly payload: Prisma.InputJsonValue;
  /** Par défaut maintenant. Explicite quand l'événement décrit un fait passé. */
  readonly occurredAt?: Date;
}

/** Le client Prisma, ou la transaction en cours. */
type Writer = PrismaService | Prisma.TransactionClient;

@Injectable()
export class OutboxService {
  private readonly logger = new Logger(OutboxService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Écrit un événement. À appeler AVEC le client de transaction, jamais sans —
   * c'est toute la garantie du patron.
   *
   *   await this.prisma.$transaction(async (tx) => {
   *     const journey = await tx.journey.create({ ... });
   *     await this.outbox.emit(tx, { type: 'journey.created', aggregateId: journey.id, payload: {} });
   *   });
   */
  async emit(writer: Writer, event: DomainEventInput): Promise<void> {
    await writer.domainEvent.create({
      data: {
        id: newId(),
        type: event.type,
        aggregateId: event.aggregateId,
        payload: event.payload,
        occurredAt: event.occurredAt ?? new Date(),
      },
    });
  }

  /** Plusieurs événements d'une même transaction. */
  async emitMany(writer: Writer, events: readonly DomainEventInput[]): Promise<void> {
    if (events.length === 0) return;
    const now = new Date();
    await writer.domainEvent.createMany({
      data: events.map((e) => ({
        id: newId(),
        type: e.type,
        aggregateId: e.aggregateId,
        payload: e.payload,
        occurredAt: e.occurredAt ?? now,
      })),
    });
  }

  /**
   * Récupère un lot d'événements non publiés, pour le relais.
   *
   * `FOR UPDATE SKIP LOCKED` : plusieurs workers peuvent tourner en parallèle
   * sans se marcher dessus ni traiter deux fois la même ligne. Sans `SKIP
   * LOCKED`, ils s'attendraient l'un l'autre et le relais deviendrait
   * séquentiel ; sans `FOR UPDATE`, ils publieraient deux fois.
   */
  async claimUnpublished(limit = 100): Promise<
    { id: string; type: string; aggregateId: string; payload: unknown; occurredAt: Date }[]
  > {
    return this.prisma.$queryRaw`
      SELECT id, type, aggregate_id AS "aggregateId", payload, occurred_at AS "occurredAt"
      FROM domain_events
      WHERE published_at IS NULL
      ORDER BY created_at ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    `;
  }

  /**
   * Marque publié. Appelé APRÈS la mise en file, jamais avant : en cas de panne
   * entre les deux, l'événement sera republié. Les abonnés doivent donc être
   * idempotents — c'est une livraison « au moins une fois », et la contrainte
   * d'unicité de `reputation_events` est justement là pour ça (§9.4).
   */
  async markPublished(ids: readonly string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.prisma.domainEvent.updateMany({
      where: { id: { in: [...ids] } },
      data: { publishedAt: new Date() },
    });
  }

  /** Supervision : la file d'attente de la boîte d'envoi (runbook §4). */
  async pendingCount(): Promise<number> {
    return this.prisma.domainEvent.count({ where: { publishedAt: null } });
  }

  /**
   * Le plus ancien événement en attente. Une valeur qui grimpe signale un relais
   * arrêté — l'alerte du runbook §4 (« file `events` > 10 000 ou job > 10 min »)
   * se branche ici.
   */
  async oldestPendingAge(): Promise<number | null> {
    const oldest = await this.prisma.domainEvent.findFirst({
      where: { publishedAt: null },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    });
    if (oldest === null) return null;
    return Date.now() - oldest.createdAt.getTime();
  }
}
