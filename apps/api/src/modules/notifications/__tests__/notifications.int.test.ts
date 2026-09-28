import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId } from '@app/db';
import {
  DEFAULT_QUIET_HOURS,
  PUSH_DEFERRED,
  PUSH_MAX_FAILURES,
  channelAllowed,
  groupingRuleFor,
  isWithinQuietHours,
  messagePushTitle,
} from '@app/shared';
import { PrismaService } from '../../../common/prisma.service';
import { EventHandlerRegistry, type DomainEventJob } from '../../../queue/event-handlers';
import { registerNotificationSubscriptions } from '../../../queue/event-subscriptions.service';
import type { EmailProvider, PushProvider } from '../../../providers/providers';
import { NotificationEventsService } from '../notifications.events';
import {
  type EmailAddressPort,
  type OutboundEmailJob,
  type OutboundPushJob,
  type OutboundQueuePort,
  NotificationsService,
} from '../notifications.service';

/**
 * Notifications — 12-notifications.md §8.
 *
 * ── LA CHAÎNE EST ÉPROUVÉE PAR L'ÉVÉNEMENT ───────────────────────────────────
 *
 * Presque aucun test n'appelle un gestionnaire à la main : ils posent les VRAIS
 * abonnements (`registerNotificationSubscriptions`, la fonction que
 * `EventSubscriptionsService.onModuleInit` appelle) sur un registre neuf, puis
 * dispatchent un `DomainEventJob` comme le ferait le consommateur du worker.
 *
 * C'est le chemin réel, et cela change ce que les tests attrapent : un abonnement
 * oublié, une charge utile lue sous le mauvais nom, un gestionnaire qui meurt sur
 * une clé étrangère parce que le destinataire n'existe plus. Aucun de ces défauts
 * n'apparaît si l'on appelle `deliver()` directement.
 *
 * ── LES DOUBLURES, ET CE QU'ELLES NE MASQUENT PAS ────────────────────────────
 *
 * `RecordingQueue` note ce qui est mis en file, mais AUCUNE assertion de règle dure
 * n'en dépend : la décision « quels canaux » est écrite en base, dans
 * `outbound_messages` et `notifications.channels_sent`, AVANT toute mise en file.
 * Les tests lisent donc la base. La file ne sert qu'à vérifier la charge du push.
 *
 * `StubAddresses` rend une adresse email pour tout le monde. C'est INDISPENSABLE à
 * la règle dure du §2.1 : le fournisseur réel (`NoEmailAddressPort`) n'a aucune
 * adresse, faute de colonne `users.email`, donc « aucun email pour SOCIAL » serait
 * vrai pour la mauvaise raison — aucun email pour personne. Avec une adresse
 * disponible, le test prouve que c'est bien la CATÉGORIE qui bloque.
 *
 * ── MUTATIONS APPLIQUÉES ─────────────────────────────────────────────────────
 *
 * Chaque règle dure a été cassée dans le code, le test devait tomber, la règle a
 * été restaurée :
 *   · `channelAllowed` : retrait du garde `SOCIAL && EMAIL` → le test d'email
 *     SOCIAL tombe (un `outbound_messages` EMAIL apparaît) ;
 *   · `groupingRuleFor` : retour `null` inconditionnel → le test de regroupement
 *     tombe (cinq notifications au lieu d'une) ;
 *   · `isMandatory` : retour `false` inconditionnel → le test de non-désactivation
 *     tombe (l'email MODERATION disparaît) ;
 *   · `deliver` : `mandatory ||` retiré du calcul du push → le test des heures
 *     calmes sur `ACCOUNT` sécurité tombe ;
 *   · `isWithinQuietHours` : branche « traverse minuit » supprimée → le test du
 *     push différé tombe.
 */

/** La file, en mémoire : les tests lisent ce qui y est déposé. */
class RecordingQueue implements OutboundQueuePort {
  readonly emails: OutboundEmailJob[] = [];
  readonly pushes: OutboundPushJob[] = [];

  enqueueEmail(job: OutboundEmailJob): Promise<void> {
    this.emails.push(job);
    return Promise.resolve();
  }

  enqueuePush(job: OutboundPushJob): Promise<void> {
    this.pushes.push(job);
    return Promise.resolve();
  }
}

/** Une adresse pour tout le monde — voir l'en-tête. */
class StubAddresses implements EmailAddressPort {
  has(): Promise<boolean> {
    return Promise.resolve(true);
  }
  resolve(userId: string): Promise<string | null> {
    return Promise.resolve(`${userId.slice(0, 8)}@exemple.test`);
  }
}

class SpyEmailProvider implements EmailProvider {
  readonly sent: { to: string; template: string; variables: Record<string, unknown> }[] = [];
  send(to: string, template: string, variables: Record<string, unknown>) {
    this.sent.push({ to, template, variables });
    return Promise.resolve({ providerRef: `spy-${this.sent.length}` });
  }
}

class SpyPushProvider implements PushProvider {
  readonly sent: { title: string; body: string; url?: string }[] = [];
  deliver = true;
  send(_s: { endpoint: string; p256dh: string; auth: string }, payload: { title: string; body: string; url?: string }) {
    this.sent.push(payload);
    return Promise.resolve({ delivered: this.deliver });
  }
}

/** Le corps d'un message privé, qui ne doit JAMAIS sortir (§2.4). */
const SECRET_BODY = 'Mon numéro de dossier est 4711 et je pars mardi.';

describe('notifications (12)', () => {
  let prisma: PrismaService;
  let notifications: NotificationsService;
  let events: NotificationEventsService;
  let registry: EventHandlerRegistry;
  let queue: RecordingQueue;
  let email: SpyEmailProvider;
  let push: SpyPushProvider;

  const createdUsers: string[] = [];
  const createdPosts: string[] = [];
  const createdAlerts: string[] = [];

  let originCountryId: string;
  let cityId: string;

  const run = Math.random().toString(36).slice(2, 8);
  let counter = 0;

  async function member(timezone = 'Europe/Paris'): Promise<string> {
    counter += 1;
    const id = newId();
    await prisma.user.create({
      data: {
        id,
        handle: `nt${run}${counter}${id.slice(-6)}`,
        displayName: `Membre ${counter}`,
        phase: 'PRE_DEPARTURE',
        verificationLevel: 'L1',
        originCountryId,
        cityId,
        plan: 'FREE',
        status: 'ACTIVE',
        timezone,
      },
    });
    createdUsers.push(id);
    return id;
  }

  /**
   * Un membre HORS heures calmes, quelle que soit l'heure d'exécution.
   *
   * CE PIÈGE A ÉTÉ TROUVÉ EN LANÇANT LES TESTS, à deux heures du matin : la plage
   * par défaut est 22 h–8 h (§2.2), donc tout push y est DIFFÉRÉ — et deux tests
   * qui attendaient `PUSH` voyaient `PUSH_DEFERRED`. Ils passaient le jour et
   * échouaient la nuit, ce qui est la pire espèce de test.
   *
   * Une plage `00:00 → 00:00` est VIDE (`start === end`), donc les heures calmes
   * sont désactivées pour ce membre. Le comportement nocturne, lui, est vérifié
   * explicitement par le test des heures calmes, avec des horaires écrits.
   */
  async function awakeMember(): Promise<string> {
    const id = await member();
    await prisma.notificationPreferences.create({
      data: {
        userId: id,
        push: {},
        email: {},
        weeklyDigest: true,
        quietHours: { start: '00:00', end: '00:00' },
      },
    });
    return id;
  }

  async function post(authorUserId: string): Promise<string> {
    const id = newId();
    await prisma.post.create({
      data: {
        id,
        authorUserId,
        type: 'QUESTION',
        body: 'Une question sur la préfecture.',
        cityId,
        status: 'PUBLISHED',
        moderationStatus: 'CLEARED',
      },
    });
    createdPosts.push(id);
    return id;
  }

  /** Le chemin RÉEL : un travail de la file `events`, distribué par le registre. */
  async function emit(type: string, aggregateId: string, payload: unknown): Promise<void> {
    await registry.dispatch({
      id: newId(),
      type: type as DomainEventJob['type'],
      aggregateId,
      payload,
      occurredAt: new Date().toISOString(),
    });
  }

  async function notificationsOf(userId: string) {
    return prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
  }

  async function outboundOf(userId: string) {
    return prisma.outboundMessage.findMany({ where: { userId } });
  }

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();

    queue = new RecordingQueue();
    email = new SpyEmailProvider();
    push = new SpyPushProvider();
    notifications = new NotificationsService(prisma, email, push, new StubAddresses(), queue);
    events = new NotificationEventsService(prisma, notifications);

    registry = new EventHandlerRegistry();
    // LE VRAI câblage. Si un abonnement manque, les tests ci-dessous échouent.
    registerNotificationSubscriptions(registry, notifications, events);

    const country = await prisma.country.findFirstOrThrow({
      where: { isActive: true, kind: { in: ['ORIGIN', 'BOTH'] } },
      select: { id: true },
    });
    originCountryId = country.id;
        // Sans filtre `is_active` : aucune ville n'est active dans la base de
    // développement, et l'indexation des villes n'est pas ce qui se joue ici.
    cityId = (await prisma.city.findFirstOrThrow({ select: { id: true } })).id;
  });

  afterAll(async () => {
    if (createdAlerts.length > 0) {
      await prisma.savedAlert.deleteMany({ where: { id: { in: createdAlerts } } });
    }
    if (createdPosts.length > 0) {
      await prisma.postReaction.deleteMany({ where: { postId: { in: createdPosts } } });
      await prisma.post.deleteMany({ where: { id: { in: createdPosts } } });
    }
    if (createdUsers.length > 0) {
      await prisma.outboundMessage.deleteMany({ where: { userId: { in: createdUsers } } });
      await prisma.notification.deleteMany({ where: { userId: { in: createdUsers } } });
      await prisma.notificationPreferences.deleteMany({ where: { userId: { in: createdUsers } } });
      await prisma.pushSubscription.deleteMany({ where: { userId: { in: createdUsers } } });
      await prisma.block.deleteMany({ where: { blockerUserId: { in: createdUsers } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUsers } } });
    }
    await prisma.$disconnect();
  });

  // ══ RÈGLE DURE §2.1 · aucun email pour SOCIAL ═════════════════════════════

  describe('rule: aucun email n’est envoyé pour une notification SOCIAL', () => {
    it('une réaction ne produit AUCUN envoi email, là où une demande de parrainage en produit un', async () => {
      const author = await member();
      const reactor = await member();
      const postId = await post(author);
      await prisma.postReaction.create({
        data: { id: newId(), postId, userId: reactor, kind: 'BRAVO' },
      });

      await emit('post.reacted', postId, { userId: reactor, authorUserId: author, kind: 'BRAVO' });

      const [social] = await notificationsOf(author);
      expect(social?.category).toBe('SOCIAL');
      // Le canal n'est même pas DÉCIDÉ : `channels_sent` ne porte pas EMAIL…
      expect(social?.channelsSent).toEqual(['IN_APP']);
      // …et aucune trace d'envoi n'existe.
      expect(await outboundOf(author)).toHaveLength(0);
      expect(queue.emails.filter((j) => j.userId === author)).toHaveLength(0);

      // LE TÉMOIN : avec la MÊME adresse disponible, une catégorie qui autorise
      // l'email en produit bien un. Sans ce second volet, le test passerait aussi
      // si l'email était cassé pour tout le monde.
      const mentor = await member();
      const mentee = await member();
      const mentorshipId = newId();
      await emit('mentorship.requested', mentorshipId, {
        mentorshipId,
        mentorUserId: mentor,
        menteeUserId: mentee,
        journeyId: null,
      });

      const mentorOutbound = await outboundOf(mentor);
      expect(mentorOutbound.filter((o) => o.channel === 'EMAIL')).toHaveLength(1);
      expect(mentorOutbound.find((o) => o.channel === 'EMAIL')?.template).toBe(
        'mentorship_request_received',
      );
    });

    /**
     * CE TEST EXISTE À CAUSE D'UNE MUTATION QUI N'A RIEN CASSÉ.
     *
     * Le test précédent passe encore quand on retire le garde `SOCIAL && EMAIL` ET
     * qu'on met `email: true` sur la ligne SOCIAL de la matrice — parce que le
     * gestionnaire de `post.reacted` ne demande AUCUN modèle d'email, donc
     * `emailWanted` est faux pour une raison qui n'a rien à voir avec la règle.
     *
     * Il ne prouvait donc que « ce gestionnaire-là n'envoie pas d'email », pas
     * « aucun email n'est jamais envoyé pour SOCIAL ». Celui-ci demande
     * explicitement un email sur une notification SOCIAL, ce qu'un gestionnaire
     * futur pourrait très bien faire par erreur — et c'est exactement le cas que la
     * règle dure existe pour arrêter.
     */
    it('refuse l’email SOCIAL même quand l’appelant en demande un', async () => {
      const user = await member();
      const result = await notifications.deliver({
        userId: user,
        category: 'SOCIAL',
        type: 'social.post_reacted',
        title: 'Quelqu’un a réagi',
        refType: 'POST',
        refId: newId(),
        // Un modèle est DEMANDÉ. Seule la règle dure peut encore l'arrêter.
        emailTemplate: 'welcome',
        emailVariables: { piege: true },
      });

      expect(result.outcome).toBe('CREATED');
      expect(result.channels).toEqual(['IN_APP']);
      expect((await outboundOf(user)).filter((o) => o.channel === 'EMAIL')).toHaveLength(0);
      expect(queue.emails.filter((j) => j.userId === user)).toHaveLength(0);
    });

    it('la matrice elle-même refuse l’email SOCIAL, quelle que soit la préférence', async () => {
      const user = await member();
      // Même en DEMANDANT l'email SOCIAL, la préférence ne peut pas l'ouvrir : une
      // préférence ne fait qu'ôter un canal (§2.2).
      await notifications.updatePreferences(user, { categories: { SOCIAL: { email: true } } });
      const stored = await prisma.notificationPreferences.findUniqueOrThrow({ where: { userId: user } });
      expect((stored.email as Record<string, boolean>)['SOCIAL']).toBeUndefined();
      expect(channelAllowed('SOCIAL', 'social.post_reacted', 'EMAIL')).toBe(false);
    });
  });

  /**
   * CE TEST EXISTE À CAUSE D'UN BOGUE TROUVÉ AU `curl`, PAS EN RELISANT LE CODE.
   *
   * `users.display_name` est `NOT NULL` mais vaut `''` juste après l'inscription :
   * l'onboarding le renseigne à l'écran suivant. Un membre qui répond à une demande
   * avant d'avoir rempli son profil produisait le titre « ␣a répondu à votre
   * demande », avec une espace en tête et personne dedans — et le push d'un message
   * aurait dit « Nouveau message de ». Le `??` ne l'attrapait pas : la valeur n'est
   * pas nulle, elle est vide.
   */
  describe('le nom affiché', () => {
    it('retombe sur le handle quand le profil n’est pas encore rempli', async () => {
      const author = await member();
      const fresh = await member();
      await prisma.user.update({ where: { id: fresh }, data: { displayName: '' } });
      const handle = (
        await prisma.user.findUniqueOrThrow({ where: { id: fresh }, select: { handle: true } })
      ).handle;

      await emit('help_request.responded', newId(), {
        responseId: newId(),
        responderUserId: fresh,
        authorUserId: author,
      });

      const rows = await notificationsOf(author);
      expect(rows[0]?.title).toBe(`${handle} a répondu à votre demande`);
      expect(rows[0]?.title.startsWith(' ')).toBe(false);
    });
  });

  // ══ RÈGLE DURE §2.3 · le regroupement ═════════════════════════════════════

  describe('rule: dix réactions ne font pas dix notifications', () => {
    it('regroupe en UNE ligne par publication et par heure, et compte les autres', async () => {
      const author = await member();
      const postId = await post(author);

      const reactors: string[] = [];
      for (let i = 0; i < 5; i += 1) reactors.push(await member());

      for (const reactor of reactors) {
        await prisma.postReaction.create({
          data: { id: newId(), postId, userId: reactor, kind: 'BRAVO' },
        });
        await emit('post.reacted', postId, { userId: reactor, authorUserId: author, kind: 'BRAVO' });
      }

      const rows = await notificationsOf(author);
      // UNE seule ligne pour cinq réactions. C'est la règle du §2.3.
      expect(rows).toHaveLength(1);
      expect(rows[0]?.refId).toBe(postId);
      // « Sandra et 4 autres ont réagi » : le compte vient de `post_reactions`, pas
      // d'un `+1` — donc il est juste même après un rejeu.
      expect(rows[0]?.title).toMatch(/et 4 autres ont réagi/);

      // REJEU du dernier événement : le titre ne bouge pas, et aucune ligne ne naît.
      await emit('post.reacted', postId, {
        userId: reactors.at(-1),
        authorUserId: author,
        kind: 'BRAVO',
      });
      const after = await notificationsOf(author);
      expect(after).toHaveLength(1);
      expect(after[0]?.title).toBe(rows[0]?.title);
    });

    it('la fenêtre est par PUBLICATION : deux publications font deux notifications', async () => {
      const author = await member();
      const reactor = await member();
      const first = await post(author);
      const second = await post(author);

      for (const postId of [first, second]) {
        await prisma.postReaction.create({
          data: { id: newId(), postId, userId: reactor, kind: 'BRAVO' },
        });
        await emit('post.reacted', postId, { userId: reactor, authorUserId: author, kind: 'BRAVO' });
      }

      const rows = await notificationsOf(author);
      expect(rows).toHaveLength(2);
      expect(new Set(rows.map((r) => r.refId))).toEqual(new Set([first, second]));
    });

    it('« vous pouvez aider » est au plus une par jour, quelle que soit la demande', () => {
      // La fenêtre est de portée USER : deux demandes différentes retombent sur la
      // même clé. La vérifier ici plutôt qu'en base est délibéré — c'est la RÈGLE
      // qui se vérifie, et elle est déclarative.
      const rule = groupingRuleFor('HELP', 'help.can_help');
      expect(rule).toEqual({ windowMs: 24 * 60 * 60 * 1000, scope: 'USER' });
      expect(groupingRuleFor('HELP', 'help.response_received')).toBeNull();
    });
  });

  // ══ RÈGLE DURE §2.2 · préférences et non-désactivables ════════════════════

  describe('rule: les préférences retirent un canal, et certaines catégories ne se coupent pas', () => {
    it('couper le push HELP laisse l’in-app et supprime l’envoi push', async () => {
      const author = await awakeMember();
      const responder = await member();

      // Témoin : par défaut, la réponse d'entraide produit un push (§2.1).
      const withPush = newId();
      await emit('help_request.responded', newId(), {
        responseId: withPush,
        responderUserId: responder,
        authorUserId: author,
      });
      const before = await notificationsOf(author);
      expect(before[0]?.channelsSent).toContain('PUSH');
      expect((await outboundOf(author)).filter((o) => o.channel === 'PUSH')).toHaveLength(1);

      await notifications.updatePreferences(author, { categories: { HELP: { push: false } } });

      const withoutPush = newId();
      await emit('help_request.responded', newId(), {
        responseId: withoutPush,
        responderUserId: responder,
        authorUserId: author,
      });

      const after = await prisma.notification.findFirstOrThrow({
        where: { userId: author, refId: withoutPush },
      });
      expect(after.channelsSent).toEqual(['IN_APP']);
      expect((await outboundOf(author)).filter((o) => o.channel === 'PUSH')).toHaveLength(1);
    });

    it('MODERATION reste notifiée par email même si le membre a tout coupé', async () => {
      const user = await member();
      // On écrit la préférence DIRECTEMENT en base : `updatePreferences` la refuse
      // déjà, et le test doit prouver que la LIVRAISON l'ignore aussi — c'est la
      // seule défense qui compte si une ligne arrive par une migration ou un script.
      await prisma.notificationPreferences.create({
        data: {
          userId: user,
          push: { MODERATION: false, ACCOUNT: false },
          email: { MODERATION: false, ACCOUNT: false },
          weeklyDigest: false,
          quietHours: DEFAULT_QUIET_HOURS,
        },
      });

      await emit('moderation.content_hidden', newId(), {
        subjectType: 'HELP_REQUEST',
        subjectId: newId(),
        authorUserId: user,
        caseId: newId(),
        automatic: true,
        notice: 'Ce contenu est en vérification.',
      });

      const rows = await notificationsOf(user);
      expect(rows).toHaveLength(1);
      expect(rows[0]?.category).toBe('MODERATION');
      expect(rows[0]?.channelsSent).toContain('EMAIL');
      expect((await outboundOf(user)).filter((o) => o.channel === 'EMAIL')).toHaveLength(1);
    });

    it('ACCOUNT sécurité passe les heures calmes, un ACCOUNT ordinaire non', async () => {
      // Un fuseau où il est certainement 22 h–8 h serait fragile ; on écrit donc une
      // plage calme qui COUVRE tout le nycthémère moins une minute. Le test ne
      // dépend alors plus de l'heure à laquelle il tourne.
      const user = await member();
      await prisma.notificationPreferences.create({
        data: {
          userId: user,
          push: {},
          email: {},
          weeklyDigest: false,
          quietHours: { start: '00:00', end: '23:59' },
        },
      });
      await prisma.pushSubscription.create({
        data: { id: newId(), userId: user, endpoint: `https://push.test/${user}`, p256dh: 'k', auth: 'a' },
      });

      // Sécurité : le push part TOUT DE SUITE (§2.2, la seule exception).
      await emit('user.deletion_requested', user, {});
      const security = await prisma.notification.findFirstOrThrow({
        where: { userId: user, type: 'account.deletion_requested' },
      });
      expect(security.channelsSent).toContain('PUSH');
      expect(security.channelsSent).not.toContain(PUSH_DEFERRED);

      // Niveau changé : `ACCOUNT` ordinaire, donc DIFFÉRÉ.
      await emit('user.level_changed', user, { to: 'L2' });
      const ordinary = await prisma.notification.findFirstOrThrow({
        where: { userId: user, type: 'account.level_changed' },
      });
      expect(ordinary.channelsSent).toContain(PUSH_DEFERRED);
      expect(ordinary.channelsSent).not.toContain('PUSH');
      // Aucun envoi push n'a été tracé pour le différé : il n'existe pas encore.
      expect(queue.pushes.filter((p) => p.userId === user)).toHaveLength(1);

      // La tâche horaire le vide dès que la plage est passée.
      await prisma.notificationPreferences.update({
        where: { userId: user },
        data: { quietHours: { start: '00:00', end: '00:00' } },
      });
      const flushed = await notifications.flushQuietHours();
      expect(flushed.sent).toBeGreaterThanOrEqual(1);

      const afterFlush = await prisma.notification.findUniqueOrThrow({ where: { id: ordinary.id } });
      expect(afterFlush.channelsSent).toContain('PUSH');
      expect(afterFlush.channelsSent).not.toContain(PUSH_DEFERRED);
      expect(push.sent.some((p) => p.title.includes('L2'))).toBe(true);
    });

    it('la plage 22 h–8 h traverse minuit, et le calcul le prend en compte', () => {
      // 23 h et 3 h sont DEDANS, 12 h est dehors. Un test `start <= h < end`
      // naïf rendrait faux pour les trois.
      const at = (h: number) => new Date(Date.UTC(2026, 0, 15, h, 0, 0));
      expect(isWithinQuietHours(at(23), 'UTC', DEFAULT_QUIET_HOURS)).toBe(true);
      expect(isWithinQuietHours(at(3), 'UTC', DEFAULT_QUIET_HOURS)).toBe(true);
      expect(isWithinQuietHours(at(12), 'UTC', DEFAULT_QUIET_HOURS)).toBe(false);
    });
  });

  // ══ RÈGLE DURE §2.4 · le push d'un message ════════════════════════════════

  describe('rule: un push MESSAGE ne contient jamais le corps du message', () => {
    it('ne porte que « Nouveau message de … », et le corps n’est nulle part', async () => {
      const sender = await member();
      const recipient = await awakeMember();
      const messageId = newId();
      const conversationId = newId();

      await emit('message.sent', messageId, {
        messageId,
        conversationId,
        kind: 'DIRECT',
        senderUserId: sender,
        // Une charge PIÉGÉE : même si un producteur ajoutait le corps un jour, le
        // gestionnaire ne le lit pas. C'est ce que ce champ vérifie.
        body: SECRET_BODY,
        recipientUserIds: [recipient],
      });

      const rows = await notificationsOf(recipient);
      expect(rows).toHaveLength(1);
      expect(rows[0]?.title).toBe(messagePushTitle(await name(sender)));
      expect(rows[0]?.body).toBeNull();
      expect(JSON.stringify(rows[0])).not.toContain('4711');

      const pushJob = queue.pushes.find((j) => j.userId === recipient);
      expect(pushJob).toBeDefined();
      expect(pushJob?.title).toMatch(/^Nouveau message de /);
      expect(pushJob?.body).toBe('');
      expect(JSON.stringify(pushJob)).not.toContain('4711');
    });
  });

  async function name(userId: string): Promise<string> {
    const row = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { displayName: true },
    });
    return row.displayName;
  }

  // ══ RÈGLE DURE §8 · le désabonnement sans connexion ═══════════════════════

  describe('rule: le lien de désabonnement fonctionne sans connexion', () => {
    it('un jeton signé coupe l’email de la catégorie, sans aucun contexte de session', async () => {
      const user = await member();
      const token = notifications.unsubscribeToken(user, 'MENTORSHIP');

      // Aucun `AuthContext`, aucun jeton d'accès : le seul argument est le jeton du
      // lien, comme dans un email ouvert six semaines plus tard.
      const result = await notifications.unsubscribe(token);
      expect(result.category).toBe('MENTORSHIP');

      const prefs = await prisma.notificationPreferences.findUniqueOrThrow({ where: { userId: user } });
      expect((prefs.email as Record<string, boolean>)['MENTORSHIP']).toBe(false);

      // Et la demande de parrainage suivante n'envoie plus d'email — mais reste
      // visible en in-app : se désabonner d'un email n'est pas se rendre sourd.
      const mentee = await member();
      const mentorshipId = newId();
      await emit('mentorship.requested', mentorshipId, {
        mentorshipId,
        mentorUserId: user,
        menteeUserId: mentee,
      });
      const rows = await notificationsOf(user);
      expect(rows).toHaveLength(1);
      expect(rows[0]?.channelsSent).toContain('IN_APP');
      expect(rows[0]?.channelsSent).not.toContain('EMAIL');
    });

    it('refuse un jeton altéré', async () => {
      const user = await member();
      const token = notifications.unsubscribeToken(user, 'HELP');
      const [data] = token.split('.');
      await expect(notifications.unsubscribe(`${data}.signature-bidon`)).rejects.toThrow();
      await expect(notifications.unsubscribe('n-importe-quoi')).rejects.toThrow();
    });

    it('un lien MODERATION est accepté mais ne coupe rien (§2.2)', async () => {
      const user = await member();
      await notifications.unsubscribe(notifications.unsubscribeToken(user, 'MODERATION'));
      const prefs = await prisma.notificationPreferences.findUnique({ where: { userId: user } });
      expect(prefs === null || (prefs.email as Record<string, boolean>)['MODERATION'] !== false).toBe(true);
    });
  });

  // ══ Idempotence et destinataire disparu ═══════════════════════════════════

  describe('la livraison « au moins une fois »', () => {
    it('rejouer un événement ne crée pas deux notifications', async () => {
      const mentor = await member();
      const mentee = await member();
      const mentorshipId = newId();
      const payload = { mentorshipId, mentorUserId: mentor, menteeUserId: mentee };

      await emit('mentorship.requested', mentorshipId, payload);
      await emit('mentorship.requested', mentorshipId, payload);
      await emit('mentorship.requested', mentorshipId, payload);

      expect(await notificationsOf(mentor)).toHaveLength(1);
      // Et un seul envoi email : le doublon ne remet rien en file.
      expect((await outboundOf(mentor)).filter((o) => o.channel === 'EMAIL')).toHaveLength(1);
    });

    it('un destinataire supprimé ne fait pas échouer le gestionnaire', async () => {
      // LE DÉFAUT QUE CECI ATTRAPE : une notification pour un membre disparu
      // violerait la clé étrangère `notifications.user_id`, le gestionnaire
      // lèverait, et l'événement serait rejoué dix fois avant d'être abandonné.
      const ghost = newId();
      const result = await notifications.deliver({
        userId: ghost,
        category: 'HELP',
        type: 'help.response_received',
        title: 'Peu importe',
        refType: 'HELP_RESPONSE',
        refId: newId(),
      });
      expect(result.outcome).toBe('SKIPPED');

      // Et par l'événement, la même chose : aucune exception ne remonte.
      await expect(
        emit('help_request.responded', newId(), {
          responseId: newId(),
          responderUserId: ghost,
          authorUserId: ghost,
        }),
      ).resolves.toBeUndefined();
    });
  });

  // ══ Alertes services : le regroupement horaire et le compteur ═════════════

  describe('alertes enregistrées (10 §2.4 et 12 §2.3)', () => {
    it('une par heure et par alerte, et `last_notified_at` n’est posé qu’en cas d’envoi', async () => {
      const seeker = await member();
      const publisher = await member();
      const alertId = newId();
      await prisma.savedAlert.create({
        data: { id: alertId, userId: seeker, kind: 'HOUSING', criteria: { cityId }, isActive: true },
      });
      createdAlerts.push(alertId);

      await emit('housing.published', newId(), {
        authorUserId: publisher,
        kind: 'RENT',
        cityId,
        priceCents: 60_000,
        riskScore: 0,
      });

      const first = await notificationsOf(seeker);
      expect(first).toHaveLength(1);
      expect(first[0]?.type).toBe('services.alert_match');
      const alertAfterFirst = await prisma.savedAlert.findUniqueOrThrow({ where: { id: alertId } });
      expect(alertAfterFirst.lastNotifiedAt).not.toBeNull();

      // Une seconde annonce dans l'heure : l'alerte est en sourdine par
      // `last_notified_at`, donc aucune ligne nouvelle.
      await emit('housing.published', newId(), {
        authorUserId: publisher,
        kind: 'RENT',
        cityId,
        priceCents: 70_000,
        riskScore: 0,
      });
      expect(await notificationsOf(seeker)).toHaveLength(1);

      // Une annonce dans une AUTRE ville ne touche pas l'alerte — et ne doit donc
      // pas non plus faire avancer `last_notified_at`.
      const otherCity = await prisma.city.findFirstOrThrow({
        where: { id: { not: cityId } },
        select: { id: true },
      });
      await prisma.savedAlert.update({ where: { id: alertId }, data: { lastNotifiedAt: null } });
      await emit('housing.published', newId(), {
        authorUserId: publisher,
        kind: 'RENT',
        cityId: otherCity.id,
        priceCents: 50_000,
        riskScore: 0,
      });
      const untouched = await prisma.savedAlert.findUniqueOrThrow({ where: { id: alertId } });
      expect(untouched.lastNotifiedAt).toBeNull();
      expect(await notificationsOf(seeker)).toHaveLength(1);
    });

    it('ne notifie jamais l’auteur de l’annonce de sa propre alerte', async () => {
      const author = await member();
      const alertId = newId();
      await prisma.savedAlert.create({
        data: { id: alertId, userId: author, kind: 'JOB', criteria: { cityId }, isActive: true },
      });
      createdAlerts.push(alertId);

      await emit('job.published', newId(), {
        authorUserId: author,
        kind: 'JOB',
        cityId,
        sector: null,
        scamTermsDetected: false,
      });
      expect(await notificationsOf(author)).toHaveLength(0);
    });
  });

  // ══ Lecture, marquage et pagination ═══════════════════════════════════════

  describe('la cloche et la page (§2.7)', () => {
    it('liste, compte les non-lues, marque lu, et pagine sans répéter de ligne', async () => {
      const user = await member();
      const responder = await member();

      // Dix notifications distinctes, par l'événement.
      for (let i = 0; i < 10; i += 1) {
        await emit('help_request.responded', newId(), {
          responseId: newId(),
          responderUserId: responder,
          authorUserId: user,
        });
      }

      const firstPage = await notifications.list(user, { limit: 4 });
      expect(firstPage.items).toHaveLength(4);
      expect(firstPage.nextCursor).not.toBeNull();
      expect(firstPage.meta.unread).toBe(10);

      // LE DÉFAUT QUE CECI ATTRAPE : un `buildPage` sans `sortOf` sur un tri par
      // date répète des lignes d'une page à l'autre, donc en perd d'autres.
      const seen = new Set(firstPage.items.map((i) => i.id));
      let cursor = firstPage.nextCursor;
      let pages = 0;
      while (cursor !== null && pages < 10) {
        const next = await notifications.list(user, { limit: 4, cursor });
        for (const item of next.items) {
          expect(seen.has(item.id)).toBe(false);
          seen.add(item.id);
        }
        cursor = next.nextCursor;
        pages += 1;
      }
      expect(seen.size).toBe(10);

      const someIds = [...seen].slice(0, 3);
      const marked = await notifications.markRead(user, { ids: someIds });
      expect(marked.updated).toBe(3);
      expect(marked.unread).toBe(7);

      const all = await notifications.markRead(user, { all: true });
      expect(all.updated).toBe(7);
      expect(all.unread).toBe(0);

      const unreadOnly = await notifications.list(user, { limit: 20, unread: true });
      expect(unreadOnly.items).toHaveLength(0);
    });

    it('filtre par catégorie', async () => {
      const user = await member();
      const other = await member();
      await emit('help_request.responded', newId(), {
        responseId: newId(),
        responderUserId: other,
        authorUserId: user,
      });
      await emit('connection.requested', newId(), {
        requestId: newId(),
        fromUserId: other,
        toUserId: user,
      });

      const help = await notifications.list(user, { limit: 20, category: 'HELP' });
      expect(help.items).toHaveLength(1);
      expect(help.items[0]?.category).toBe('HELP');

      const social = await notifications.list(user, { limit: 20, category: 'SOCIAL' });
      expect(social.items).toHaveLength(1);
    });
  });

  // ══ Abonnements push et tâches (§2.4 et §6) ═══════════════════════════════

  describe('abonnements push et tâches planifiées', () => {
    it('réenregistrer le même appareil met à jour au lieu de dupliquer', async () => {
      const user = await member();
      const endpoint = `https://push.test/dup-${run}-${user}`;
      const first = await notifications.registerPushSubscription(user, {
        endpoint,
        keys: { p256dh: 'a', auth: 'b' },
      });
      const second = await notifications.registerPushSubscription(user, {
        endpoint,
        keys: { p256dh: 'c', auth: 'd' },
      });
      expect(first.created).toBe(true);
      expect(second.created).toBe(false);
      expect(second.id).toBe(first.id);
      expect(await prisma.pushSubscription.count({ where: { userId: user } })).toBe(1);
    });

    it('un abonnement qui échoue cinq fois disparaît', async () => {
      const user = await member();
      await prisma.pushSubscription.create({
        data: {
          id: newId(),
          userId: user,
          endpoint: `https://push.test/dead-${run}-${user}`,
          p256dh: 'k',
          auth: 'a',
          failureCount: PUSH_MAX_FAILURES - 1,
        },
      });

      push.deliver = false;
      const outboundId = newId();
      await prisma.outboundMessage.create({
        data: { id: outboundId, channel: 'PUSH', userId: user, template: 'test', status: 'QUEUED' },
      });
      const result = await notifications.sendPush({ outboundId, userId: user, title: 'T', body: '' });
      push.deliver = true;

      expect(result.removed).toBe(1);
      expect(await prisma.pushSubscription.count({ where: { userId: user } })).toBe(0);
      const trace = await prisma.outboundMessage.findUniqueOrThrow({ where: { id: outboundId } });
      expect(trace.status).toBe('FAILED');
    });

    it('la suppression de compte efface tout et anonymise la trace d’envoi', async () => {
      const user = await member();
      await emit('mentorship.requested', newId(), {
        mentorshipId: newId(),
        mentorUserId: user,
        menteeUserId: await member(),
      });
      await notifications.registerPushSubscription(user, {
        endpoint: `https://push.test/gone-${run}-${user}`,
        keys: { p256dh: 'a', auth: 'b' },
      });
      await notifications.updatePreferences(user, { weeklyDigest: false });

      const outboundBefore = await outboundOf(user);
      expect(outboundBefore.length).toBeGreaterThan(0);

      await emit('user.deleted', user, {});

      expect(await notificationsOf(user)).toHaveLength(0);
      expect(await prisma.pushSubscription.count({ where: { userId: user } })).toBe(0);
      expect(await prisma.notificationPreferences.count({ where: { userId: user } })).toBe(0);
      // ANONYMISÉE, pas supprimée : §7 conserve 90 jours.
      expect(await outboundOf(user)).toHaveLength(0);
      const stillThere = await prisma.outboundMessage.findMany({
        where: { id: { in: outboundBefore.map((o) => o.id) } },
      });
      expect(stillThere).toHaveLength(outboundBefore.length);
      expect(stillThere.every((o) => o.userId === null)).toBe(true);
      await prisma.outboundMessage.deleteMany({ where: { id: { in: stillThere.map((o) => o.id) } } });
    });

    it('la grille des réglages dit ce qui est disponible et ce qui est verrouillé', async () => {
      const user = await member();
      const grid = await notifications.preferences(user);

      const social = grid.categories.find((c) => c.category === 'SOCIAL');
      expect(social?.email.available).toBe(false);
      expect(social?.push.available).toBe(false);

      const moderation = grid.categories.find((c) => c.category === 'MODERATION');
      expect(moderation?.email.available).toBe(true);
      expect(moderation?.email.locked).toBe(true);
      expect(moderation?.push.available).toBe(false);

      const digest = grid.categories.find((c) => c.category === 'DIGEST');
      expect(digest?.inApp).toBe(false);

      expect(grid.quietHours).toEqual(DEFAULT_QUIET_HOURS);
      expect(grid.weeklyDigest).toBe(true);

      const updated = await notifications.updatePreferences(user, { quietHours: null });
      expect(updated.quietHours).toBeNull();
    });
  });
});
