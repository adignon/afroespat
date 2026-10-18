import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId } from '@app/db';
import { AuditService } from '../../../common/audit.service';
import { CryptoService } from '../../../common/crypto.service';
import { OutboxService } from '../../../common/outbox.service';
import { PrismaService } from '../../../common/prisma.service';
import { VisibilityService } from '../../../common/visibility.service';
import { EventHandlerRegistry } from '../../../queue/event-handlers';
import { ConnectionsService } from '../../connections/connections.service';
import { MessagingService } from '../../messaging/messaging.service';
import type { AiModerationProvider } from '../../../providers/providers';
import { ModerationService } from '../../moderation/moderation.service';
import { MentorshipMoneyGuard } from '../mentorship-money.guard';
import { MentorshipService } from '../mentorship.service';

/**
 * 08 §2.4 : « la modération marque `MONEY_REQUEST` dans la conversation de
 * parrainage avec priorité 1 ». Le commentaire de `mentorship.service.ts` le
 * promettait, rien ne le faisait. Ces tests passent par le VRAI abonnement :
 * `onModuleInit` s'inscrit au registre, et on rejoue l'événement `message.sent` que
 * `MessagingService.sendMessage` dépose réellement.
 */
describe('MONEY_REQUEST en conversation de parrainage (08 §2.4)', () => {
  let prisma: PrismaService;
  let mentorship: MentorshipService;
  let messaging: MessagingService;
  let guard: MentorshipMoneyGuard;
  let registry: EventHandlerRegistry;
  const createdUsers: string[] = [];
  let originCountryId: string;
  let cityId: string;
  let counter = 0;

  async function member(phase: 'PRE_DEPARTURE' | 'SETTLED') {
    counter += 1;
    const id = newId();
    const handle = `mon${counter}${id.slice(-8)}`;
    await prisma.user.create({
      data: {
        id,
        handle,
        displayName: `Membre ${counter}`,
        phase,
        verificationLevel: 'L2',
        originCountryId,
        cityId,
        plan: 'FREE',
        status: 'ACTIVE',
        arrivalDate: phase === 'SETTLED' ? new Date(Date.now() - 2 * 365 * 86_400_000) : null,
      },
    });
    createdUsers.push(id);
    return { id, handle };
  }

  /** Un parrainage ACTIF, avec sa conversation MENTORSHIP. */
  async function activeMentorship() {
    const mentor = await member('SETTLED');
    await mentorship.upsertProfile(mentor.id, {
      bio: 'J’accompagne les nouveaux arrivants depuis deux ans, avec plaisir.',
      journeyTemplateIds: [],
      maxMentees: 2,
      isAvailable: true,
    });
    const mentee = await member('PRE_DEPARTURE');
    const request = await mentorship.request(mentee.id, {
      mentorHandle: mentor.handle,
      message:
        'Bonjour, je prépare mon départ et je cherche quelqu’un qui connaît les démarches locales pour m’aider.',
    });
    const accepted = await mentorship.accept(request.id, mentor.id);
    return { mentor, mentee, conversationId: accepted.conversationId };
  }

  /** Envoie un message et rejoue l'événement qu'il a déposé, comme le worker le fait. */
  async function sendAndDeliver(userId: string, conversationId: string, body: string) {
    const sent = await messaging.sendMessage({ userId, level: 'L2' }, conversationId, { body });
    const event = await prisma.domainEvent.findFirstOrThrow({
      where: { type: 'message.sent', aggregateId: sent.messageId },
    });
    for (const registration of registry.for('message.sent')) {
      if (registration.module !== 'mentorship-money') continue;
      await registration.handle({
        id: event.id,
        type: 'message.sent',
        aggregateId: event.aggregateId,
        payload: event.payload,
        occurredAt: event.occurredAt.toISOString(),
      });
    }
    return sent.messageId;
  }

  const casesOn = (messageId: string) =>
    prisma.moderationCase.findMany({ where: { subjectType: 'MESSAGE', subjectId: messageId } });

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    const outbox = new OutboxService(prisma);
    const audit = new AuditService(prisma);
    const visibility = new VisibilityService(prisma);
    const crypto = new CryptoService();
    const connections = new ConnectionsService(prisma, outbox, audit, visibility);
    messaging = new MessagingService(prisma, crypto, outbox, audit, visibility, connections);
    mentorship = new MentorshipService(prisma, outbox, audit, visibility, messaging);

    // Le module n'appelle jamais l'IA : ses règles locales suffisent.
    const moderation = new ModerationService(
      prisma,
      outbox,
      audit,
      {} as AiModerationProvider,
      null,
    );
    registry = new EventHandlerRegistry();
    guard = new MentorshipMoneyGuard(registry, prisma, crypto, moderation);
    guard.onModuleInit();

    originCountryId = (
      await prisma.country.findFirstOrThrow({
        where: { isActive: true, kind: { in: ['ORIGIN', 'BOTH'] } },
        select: { id: true },
      })
    ).id;
    cityId = (await prisma.city.findFirstOrThrow({ select: { id: true } })).id;
  });

  afterAll(async () => {
    if (createdUsers.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: createdUsers } } });
    }
    await prisma.$disconnect();
  });

  it('rule: un IBAN ou une demande de versement ouvre un dossier de priorité 1', async () => {
    const { mentor, mentee, conversationId } = await activeMentorship();
    expect(conversationId).toBeTruthy();

    const iban = await sendAndDeliver(
      mentor.id,
      conversationId,
      'Pour la suite, mon IBAN est FR76 3000 6000 0112 3456 7890 189, merci.',
    );
    const [first] = await casesOn(iban);
    expect(first).toMatchObject({
      subjectType: 'MESSAGE',
      subjectId: iban,
      subjectAuthorUserId: mentor.id,
      priority: 1,
      status: 'OPEN',
      source: 'AUTO_RULE',
    });
    expect(first?.aiLabels).toContain('MONEY_REQUEST');

    const ask = await sendAndDeliver(
      mentee.id,
      conversationId,
      'Je peux vous envoyer 50 euros sur mon compte pour vous remercier ?',
    );
    expect((await casesOn(ask))[0]).toMatchObject({ priority: 1, subjectAuthorUserId: mentee.id });
  });

  it('un message ordinaire n’ouvre aucun dossier', async () => {
    const { mentor, conversationId } = await activeMentorship();
    const id = await sendAndDeliver(
      mentor.id,
      conversationId,
      'Pour la préfecture, prenez rendez-vous en ligne et apportez trois justificatifs de domicile.',
    );
    expect(await casesOn(id)).toHaveLength(0);
  });

  it('une information juste sur un coût ne déclenche rien (« il faut payer 225 € à la préfecture »)', async () => {
    const { mentor, conversationId } = await activeMentorship();
    const id = await sendAndDeliver(
      mentor.id,
      conversationId,
      'Il faut compter 225 euros de timbre fiscal à la préfecture, à acheter en ligne.',
    );
    expect(await casesOn(id)).toHaveLength(0);
  });

  it('rejouer l’événement n’empile pas de second dossier (livraison au moins une fois)', async () => {
    const { mentor, conversationId } = await activeMentorship();
    const id = await sendAndDeliver(
      mentor.id,
      conversationId,
      'Envoyez-moi 100 euros sur mon compte Wave et je vous aide avec le dossier.',
    );
    const event = await prisma.domainEvent.findFirstOrThrow({
      where: { type: 'message.sent', aggregateId: id },
    });
    expect(await guard.inspect(event.payload)).toBe(true);
    expect(await guard.inspect(event.payload)).toBe(true);
    expect(await casesOn(id)).toHaveLength(1);
  });

  it('les conversations directes ne sont pas concernées (le lot modération les étend)', async () => {
    expect(
      await guard.inspect({ kind: 'DIRECT', messageId: newId(), senderUserId: newId() }),
    ).toBe(false);
    expect(await guard.inspect(null)).toBe(false);
    expect(await guard.inspect({ kind: 'MENTORSHIP' })).toBe(false);
  });
});
