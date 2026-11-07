import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId } from '@app/db';
import { PUSH_MAX_FAILURES } from '@app/shared';
import { PrismaService } from '../../../common/prisma.service';
import { ProviderError } from '../../../providers/http';
import type { EmailProvider, PushProvider } from '../../../providers/providers';
import {
  type EmailAddressPort,
  type OutboundEmailJob,
  type OutboundPushJob,
  type OutboundQueuePort,
  NotificationsService,
  PushTransientError,
} from '../notifications.service';

/**
 * Étape 2 — fiabilité des notifications : résumé hebdomadaire, relance des envois en file,
 * reprise des push sur panne transitoire, comptes désactivés/supprimés.
 */

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

class StubAddresses implements EmailAddressPort {
  has(): Promise<boolean> {
    return Promise.resolve(true);
  }
  resolve(userId: string): Promise<string | null> {
    return Promise.resolve(`${userId.slice(0, 8)}@exemple.test`);
  }
}

class SpyEmailProvider implements EmailProvider {
  readonly sent: string[] = [];
  send(to: string) {
    this.sent.push(to);
    return Promise.resolve({ providerRef: 'spy' });
  }
}

/** Un push dont la réponse est scriptée endpoint par endpoint. */
class ScriptedPush implements PushProvider {
  readonly calls: string[] = [];
  readonly script = new Map<string, () => Promise<{ delivered: boolean; gone?: boolean }>>();
  send(s: { endpoint: string }) {
    this.calls.push(s.endpoint);
    const step = this.script.get(s.endpoint);
    return step === undefined ? Promise.resolve({ delivered: true }) : step();
  }
}

describe('notifications : fiabilité (étape 2)', () => {
  let prisma: PrismaService;
  let notifications: NotificationsService;
  let queue: RecordingQueue;
  let email: SpyEmailProvider;
  let push: ScriptedPush;
  const users: string[] = [];
  const communities: string[] = [];
  const events: string[] = [];
  let countryId = '';
  let cityId = '';
  const run = Math.random().toString(36).slice(2, 8);
  let counter = 0;

  async function member(
    options: { status?: 'ACTIVE' | 'DEACTIVATED' | 'DELETED'; verified?: boolean; deletedAt?: Date } = {},
  ): Promise<string> {
    counter += 1;
    const id = newId();
    await prisma.user.create({
      data: {
        id, handle: `n2${run}${counter}${id.slice(-6)}`, displayName: `Membre ${counter}`, phase: 'SETTLED',
        verificationLevel: 'L1', originCountryId: countryId, cityId, plan: 'FREE', timezone: 'UTC',
        status: options.status ?? 'ACTIVE',
        ...(options.deletedAt === undefined ? {} : { deletedAt: options.deletedAt }),
        ...(options.verified === false ? {} : { emailEncrypted: new Uint8Array([1, 2, 3]), emailVerifiedAt: new Date() }),
      },
    });
    users.push(id);
    return id;
  }

  async function outbound(
    userId: string,
    channel: 'EMAIL' | 'PUSH',
    template: string,
    ageMinutes: number,
  ): Promise<string> {
    const id = newId();
    await prisma.outboundMessage.create({
      data: {
        id, channel, userId, template, status: 'QUEUED',
        createdAt: new Date(Date.now() - ageMinutes * 60_000),
      },
    });
    return id;
  }

  async function notif(userId: string, type: string, title: string, ageMinutes: number): Promise<void> {
    await prisma.notification.create({
      data: {
        id: newId(), userId, category: 'MENTORSHIP', type, title, body: `corps ${title}`, channelsSent: ['IN_APP'],
        createdAt: new Date(Date.now() - ageMinutes * 60_000),
      },
    });
  }

  async function subscription(userId: string, tag: string, failureCount = 0): Promise<string> {
    const endpoint = `https://push.test/${run}-${tag}-${userId.slice(0, 6)}`;
    await prisma.pushSubscription.create({
      data: { id: newId(), userId, endpoint, p256dh: 'k', auth: 'a', failureCount },
    });
    return endpoint;
  }

  const statusOf = (id: string) => prisma.outboundMessage.findUniqueOrThrow({ where: { id } });

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    queue = new RecordingQueue();
    email = new SpyEmailProvider();
    push = new ScriptedPush();
    notifications = new NotificationsService(prisma, email, push, new StubAddresses(), queue);
    countryId = (await prisma.country.findFirstOrThrow({ where: { isActive: true, kind: { in: ['ORIGIN', 'BOTH'] } }, select: { id: true } })).id;
    cityId = (await prisma.city.findFirstOrThrow({ select: { id: true } })).id;
  });

  afterAll(async () => {
    await prisma.event.deleteMany({ where: { id: { in: events } } });
    await prisma.community.deleteMany({ where: { id: { in: communities } } });
    await prisma.outboundMessage.deleteMany({ where: { userId: { in: users } } });
    await prisma.notification.deleteMany({ where: { userId: { in: users } } });
    await prisma.pushSubscription.deleteMany({ where: { userId: { in: users } } });
    await prisma.notificationPreferences.deleteMany({ where: { userId: { in: users } } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    await prisma.$disconnect();
  });

  // ── Résumé hebdomadaire ───────────────────────────────────────────────────

  describe('résumé hebdomadaire', () => {
    /** Un lundi, 8 h UTC : l'heure du résumé pour un fuseau UTC. */
    const monday = new Date('2026-11-09T08:00:00Z');

    async function event(title: string, organizer: string, communityId: string | null): Promise<void> {
      const id = newId();
      await prisma.event.create({
        data: {
          id, organizerUserId: organizer, communityId, type: 'OTHER', title, cityId,
          startsAt: new Date('2026-11-11T18:00:00Z'), status: 'SCHEDULED',
        },
      });
      events.push(id);
    }

    async function privateNetwork(): Promise<string> {
      const id = newId();
      await prisma.community.create({
        data: {
          id, kind: 'INTEREST', name: `Privé ${run}`, slug: `prv-${run}-${id.slice(-6)}`, visibility: 'INVITE_ONLY',
          status: 'ACTIVE', lastActivityAt: new Date(), cityId,
        },
      });
      communities.push(id);
      return id;
    }

    it('exclut les événements d’un réseau dont le destinataire n’est pas membre, garde les siens, et n’écrit qu’à une adresse vérifiée', async () => {
      const organizer = await member({ verified: false });
      const outsider = await member();
      const insider = await member();
      const unverified = await member({ verified: false });
      const network = await privateNetwork();
      await prisma.communityMember.create({
        data: { id: newId(), communityId: network, userId: insider, role: 'MEMBER', status: 'ACTIVE', joinedAt: new Date() },
      });
      await event(`Public ${run}`, organizer, null);
      await event(`Secret ${run}`, organizer, network);

      // Pages de DEUX candidats : tout le monde est servi à travers les pages (curseur sur l'id).
      await notifications.weeklyDigest(monday, { pageSize: 2 });

      const titlesFor = (userId: string): string[] => {
        const job = queue.emails.find((j) => j.userId === userId && j.template === 'weekly_digest');
        const list = (job?.variables['cityEvents'] ?? []) as { title: string }[];
        return list.map((e) => e.title);
      };
      expect(titlesFor(outsider)).toContain(`Public ${run}`);
      expect(titlesFor(outsider)).not.toContain(`Secret ${run}`);
      expect(titlesFor(insider)).toEqual(expect.arrayContaining([`Public ${run}`, `Secret ${run}`]));

      // Adresse non vérifiée : ni envoi ni ligne sortante.
      expect(queue.emails.some((j) => j.userId === unverified)).toBe(false);
      expect(await prisma.outboundMessage.count({ where: { userId: unverified } })).toBe(0);
    });

    it('n’écrit pas aux comptes désactivés ou supprimés', async () => {
      const desactive = await member({ status: 'DEACTIVATED' });
      const supprime = await member({ status: 'ACTIVE', deletedAt: new Date() });
      await notifications.weeklyDigest(monday);
      expect(queue.emails.some((j) => j.userId === desactive || j.userId === supprime)).toBe(false);
    });
  });

  // ── Relance des envois restés en file ─────────────────────────────────────

  describe('relance des envois en file', () => {
    it('relance un push et un e-mail anciens depuis leur notification, laisse les récents, abandonne les trop vieux', async () => {
      const u = await member();
      await notif(u, 'mentorship.request_received', `Demande ${run}`, 30);
      const pushOld = await outbound(u, 'PUSH', 'mentorship.request_received', 30);
      const emailOld = await outbound(u, 'EMAIL', 'mentorship_request_received', 30);
      const recent = await outbound(u, 'PUSH', 'mentorship.request_received', 1);

      const v = await member();
      const tooOld = await outbound(v, 'PUSH', 'x', 60 * 30);

      const result = await notifications.requeueStale(new Date());
      expect(result.requeued).toBeGreaterThanOrEqual(2);

      expect(queue.pushes.find((j) => j.outboundId === pushOld)).toMatchObject({ userId: u, title: `Demande ${run}` });
      expect(queue.emails.find((j) => j.outboundId === emailOld)).toMatchObject({
        userId: u, template: 'mentorship_request_received', variables: { title: `Demande ${run}` },
      });
      expect(queue.pushes.some((j) => j.outboundId === recent)).toBe(false);
      expect((await statusOf(recent)).status).toBe('QUEUED');

      expect(await statusOf(tooOld)).toMatchObject({ status: 'FAILED', error: 'STALE_EXPIRED' });
      expect(queue.pushes.some((j) => j.outboundId === tooOld)).toBe(false);
    });

    it('n’envoie rien à un compte devenu inactif et marque l’envoi irrécupérable quand la notification a disparu', async () => {
      const inactive = await member({ status: 'DEACTIVATED' });
      await notif(inactive, 'x.y', 'Titre', 30);
      const rowInactive = await outbound(inactive, 'PUSH', 'x.y', 30);
      const orphan = await member();
      const rowOrphan = await outbound(orphan, 'PUSH', 'sans.notification', 30);

      await notifications.requeueStale(new Date());
      expect(await statusOf(rowInactive)).toMatchObject({ status: 'FAILED', error: 'ACCOUNT_INACTIVE' });
      expect(await statusOf(rowOrphan)).toMatchObject({ status: 'FAILED', error: 'STALE_NOT_RECOVERABLE' });
      expect(queue.pushes.some((j) => j.outboundId === rowInactive || j.outboundId === rowOrphan)).toBe(false);
    });
  });

  // ── Push : reprise sur panne transitoire ──────────────────────────────────

  describe('push : reprise sur panne transitoire', () => {
    const job = (outboundId: string, userId: string): OutboundPushJob => ({ outboundId, userId, title: 'T', body: 'B' });
    const transient = () => Promise.reject(new ProviderError('webpush', 503, 'HTTP 503', true));

    it('une panne 5xx lève (la file rejoue), sans compter l’échec ni clore la ligne ; à la dernière tentative la ligne passe en FAILED', async () => {
      const u = await member();
      const endpoint = await subscription(u, 'a');
      push.script.set(endpoint, transient);
      const out = await outbound(u, 'PUSH', 't', 0);

      await expect(notifications.sendPush(job(out, u), { finalAttempt: false })).rejects.toBeInstanceOf(PushTransientError);
      expect((await statusOf(out)).status).toBe('QUEUED');
      expect((await prisma.pushSubscription.findUniqueOrThrow({ where: { endpoint } })).failureCount).toBe(0);

      const last = await notifications.sendPush(job(out, u), { finalAttempt: true });
      expect(last.delivered).toBe(0);
      expect((await statusOf(out)).status).toBe('FAILED');
      expect((await prisma.pushSubscription.findUniqueOrThrow({ where: { endpoint } })).failureCount).toBe(1);
    });

    it('une panne transitoire guérie à la tentative suivante envoie et remet le compteur à zéro', async () => {
      const u = await member();
      const endpoint = await subscription(u, 'b', 2);
      let attempts = 0;
      push.script.set(endpoint, () => {
        attempts += 1;
        return attempts === 1 ? transient() : Promise.resolve({ delivered: true });
      });
      const out = await outbound(u, 'PUSH', 't', 0);

      await expect(notifications.sendPush(job(out, u), { finalAttempt: false })).rejects.toBeInstanceOf(PushTransientError);
      const second = await notifications.sendPush(job(out, u), { finalAttempt: false });
      expect(second.delivered).toBe(1);
      expect((await statusOf(out)).status).toBe('SENT');
      expect((await prisma.pushSubscription.findUniqueOrThrow({ where: { endpoint } })).failureCount).toBe(0);
    });

    it('un 4xx définitif ne se rejoue pas (même hors dernière tentative) et compte contre l’abonnement', async () => {
      const u = await member();
      const endpoint = await subscription(u, 'c');
      push.script.set(endpoint, () => Promise.reject(new ProviderError('webpush', 400, 'HTTP 400', false)));
      const out = await outbound(u, 'PUSH', 't', 0);

      const result = await notifications.sendPush(job(out, u), { finalAttempt: false });
      expect(result.delivered).toBe(0);
      expect((await statusOf(out)).status).toBe('FAILED');
      expect((await prisma.pushSubscription.findUniqueOrThrow({ where: { endpoint } })).failureCount).toBe(1);
    });

    it('un abonnement expiré (404/410, « gone ») est supprimé tout de suite, sans rejeu', async () => {
      const u = await member();
      const endpoint = await subscription(u, 'd');
      push.script.set(endpoint, () => Promise.resolve({ delivered: false, gone: true }));
      const out = await outbound(u, 'PUSH', 't', 0);

      const result = await notifications.sendPush(job(out, u), { finalAttempt: false });
      expect(result.removed).toBe(1);
      expect(await prisma.pushSubscription.count({ where: { endpoint } })).toBe(0);
    });

    it('un succès partiel ne rejoue pas (pas de doublon) ; la panne transitoire de l’autre appareil est comptée', async () => {
      const u = await member();
      const ok = await subscription(u, 'e');
      const ko = await subscription(u, 'f');
      push.script.set(ko, transient);
      push.script.delete(ok);
      const out = await outbound(u, 'PUSH', 't', 0);

      const result = await notifications.sendPush(job(out, u), { finalAttempt: false });
      expect(result.delivered).toBe(1);
      expect((await statusOf(out)).status).toBe('SENT');
      expect((await prisma.pushSubscription.findUniqueOrThrow({ where: { endpoint: ko } })).failureCount).toBe(1);
    });

    it('le compteur d’échecs atteint PUSH_MAX_FAILURES : l’abonnement est retiré à la dernière tentative', async () => {
      const u = await member();
      const endpoint = await subscription(u, 'g', PUSH_MAX_FAILURES - 1);
      push.script.set(endpoint, transient);
      const out = await outbound(u, 'PUSH', 't', 0);
      const result = await notifications.sendPush(job(out, u), { finalAttempt: true });
      expect(result.removed).toBe(1);
      expect(await prisma.pushSubscription.count({ where: { endpoint } })).toBe(0);
    });
  });

  // ── Comptes désactivés / supprimés ────────────────────────────────────────

  describe('comptes désactivés ou supprimés', () => {
    it('deliver() ignore un compte désactivé, supprimé ou à deleted_at posé', async () => {
      for (const options of [
        { status: 'DEACTIVATED' as const },
        { status: 'DELETED' as const },
        { status: 'ACTIVE' as const, deletedAt: new Date() },
      ]) {
        const u = await member(options);
        const result = await notifications.deliver({
          userId: u, category: 'MENTORSHIP', type: 'mentorship.request_received', title: 'Bonjour',
        });
        expect(result.outcome).toBe('SKIPPED');
        expect(await prisma.notification.count({ where: { userId: u } })).toBe(0);
      }
    });

    it('sendEmail et sendPush n’envoient rien à un compte désactivé et clôturent la ligne', async () => {
      const u = await member({ status: 'DEACTIVATED' });
      await subscription(u, 'h');
      const calls = push.calls.length;
      const mails = email.sent.length;
      const outPush = await outbound(u, 'PUSH', 't', 0);
      const outMail = await outbound(u, 'EMAIL', 'moderation', 0);

      await notifications.sendPush({ outboundId: outPush, userId: u, title: 'T', body: 'B' });
      expect(await notifications.sendEmail({ outboundId: outMail, userId: u, template: 'moderation', variables: {} })).toBe('FAILED');

      expect(push.calls.length).toBe(calls);
      expect(email.sent.length).toBe(mails);
      expect(await statusOf(outPush)).toMatchObject({ status: 'FAILED', error: 'ACCOUNT_INACTIVE' });
      expect(await statusOf(outMail)).toMatchObject({ status: 'FAILED', error: 'ACCOUNT_INACTIVE' });
    });

    it('la reprise des push différés saute un compte désactivé', async () => {
      const u = await member({ status: 'DEACTIVATED' });
      await prisma.notification.create({
        data: {
          id: newId(), userId: u, category: 'MENTORSHIP', type: 'x.y', title: 'Différé',
          channelsSent: ['IN_APP', 'PUSH_DEFERRED'],
        },
      });
      await notifications.flushQuietHours(new Date());
      expect(await prisma.outboundMessage.count({ where: { userId: u } })).toBe(0);
    });
  });
});
