import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId } from '@app/db';
import { AuditService } from '../../../common/audit.service';
import { CryptoService } from '../../../common/crypto.service';
import { OutboxService } from '../../../common/outbox.service';
import { PrismaService } from '../../../common/prisma.service';
import { VisibilityService } from '../../../common/visibility.service';
import { ConnectionsService } from '../../connections/connections.service';
import type { RealtimeEvent } from '../../realtime/realtime.channel';
import type { RealtimeRelayService } from '../../realtime/realtime.relay';
import { MessagingService } from '../messaging.service';

/**
 * Lot F — ce que la messagerie dit au temps réel, « Vu », et « ignorer ».
 *
 * Un faux relais enregistre les poussées : on éprouve CE QUI EST PUBLIÉ ET À QUI,
 * sans socket (la livraison de bout en bout est dans `realtime-socket.int.test.ts`).
 */
interface Poussee { readonly userId: string; readonly event: RealtimeEvent; readonly payload: Record<string, unknown> }

describe('messagerie : temps réel, « Vu » et demandes ignorées (08 §5.2, §7.3)', () => {
  let prisma: PrismaService;
  let messaging: MessagingService;
  const poussees: Poussee[] = [];
  const users: string[] = [];
  let countryId = '';
  let cityId = '';
  let n = 0;

  async function member(level: 'L0' | 'L1' | 'L2' = 'L1') {
    n += 1;
    const id = newId();
    const handle = `tr${n}${id.slice(-8)}`;
    await prisma.user.create({
      data: {
        id, handle, displayName: `Membre ${n}`, phase: 'SETTLED', verificationLevel: level,
        originCountryId: countryId, cityId, plan: 'FREE', status: 'ACTIVE',
      },
    });
    users.push(id);
    return { id, handle, level };
  }

  const vers = (userId: string, event: RealtimeEvent): Poussee[] =>
    poussees.filter((p) => p.userId === userId && p.event === event);

  /** `push` est lancé sans attente (`void`) : on laisse la microtâche passer. */
  const laisser = (): Promise<void> => new Promise((r) => setTimeout(r, 30));

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    const outbox = new OutboxService(prisma);
    const audit = new AuditService(prisma);
    const visibility = new VisibilityService(prisma);
    const connections = new ConnectionsService(prisma, outbox, audit, visibility);
    const relais = {
      publish: (userId: string, event: RealtimeEvent, payload: Record<string, unknown>) => {
        poussees.push({ userId, event, payload });
        return Promise.resolve();
      },
    } as unknown as RealtimeRelayService;
    messaging = new MessagingService(prisma, new CryptoService(), outbox, audit, visibility, connections, relais);
    countryId = (await prisma.country.findFirstOrThrow({ where: { isActive: true, kind: { in: ['ORIGIN', 'BOTH'] } }, select: { id: true } })).id;
    cityId = (await prisma.city.findFirstOrThrow({ select: { id: true } })).id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    await prisma.$disconnect();
  });

  it('« Vu » : seenAt est null tant que l’autre n’a rien lu, puis la lecture de l’autre', async () => {
    const a = await member();
    const b = await member();
    const opened = await messaging.openDirect({ userId: a.id, level: 'L1' }, { toHandle: b.handle, firstMessage: 'Bonjour' });
    await messaging.acceptDirect(b.id, opened.conversationId);

    // L'acceptation matérialise une lecture de B : A voit « Vu » sur son premier message.
    const avant = await messaging.listMessages(a.id, opened.conversationId, { limit: 20 });
    expect(avant.meta.seenAt).not.toBeNull();

    const reponse = await messaging.sendMessage({ userId: b.id, level: 'L1' }, opened.conversationId, { body: 'Salut' });
    // A n'a pas encore lu la réponse : B voit seenAt (lecture de A) ANTÉRIEUR à la réponse de B.
    const chezB = await messaging.listMessages(b.id, opened.conversationId, { limit: 20 });
    expect(new Date(chezB.meta.seenAt as string).getTime()).toBeLessThan(reponse.sentAt.getTime());

    await messaging.listMessages(a.id, opened.conversationId, { limit: 20 });
    const apres = await messaging.listMessages(b.id, opened.conversationId, { limit: 20 });
    expect(new Date(apres.meta.seenAt as string).getTime()).toBeGreaterThanOrEqual(reponse.sentAt.getTime());
  });

  it('lire pousse message.read à l’AUTRE et conversation.updated à moi ; relire sans rien de neuf ne pousse rien', async () => {
    const a = await member();
    const b = await member();
    const opened = await messaging.openDirect({ userId: a.id, level: 'L1' }, { toHandle: b.handle, firstMessage: 'Coucou' });
    await messaging.acceptDirect(b.id, opened.conversationId);
    await messaging.sendMessage({ userId: a.id, level: 'L1' }, opened.conversationId, { body: 'Tu es là ?' });
    await laisser();
    poussees.length = 0;

    await messaging.listMessages(b.id, opened.conversationId, { limit: 20 });
    await laisser();
    const lus = vers(a.id, 'message.read');
    expect(lus).toHaveLength(1);
    expect(lus[0]?.payload).toMatchObject({ conversationId: opened.conversationId, readerUserId: b.id });
    expect(vers(b.id, 'conversation.updated')).toHaveLength(1);
    // Aucun corps, jamais.
    expect(JSON.stringify(poussees)).not.toContain('Tu es là');

    poussees.length = 0;
    await messaging.listMessages(b.id, opened.conversationId, { limit: 20 });
    await laisser();
    expect(poussees).toHaveLength(0);
  });

  it('accepter prévient l’initiateur (conversation.updated + message.read)', async () => {
    const a = await member();
    const b = await member();
    const opened = await messaging.openDirect({ userId: a.id, level: 'L1' }, { toHandle: b.handle, firstMessage: 'Demande' });
    poussees.length = 0;
    await messaging.acceptDirect(b.id, opened.conversationId);
    await laisser();
    expect(vers(a.id, 'conversation.updated')[0]?.payload).toMatchObject({ reason: 'accepted' });
    expect(vers(a.id, 'message.read')).toHaveLength(1);
  });

  it('supprimer son message prévient les membres, et lui seul peut le faire', async () => {
    const a = await member();
    const b = await member();
    const opened = await messaging.openDirect({ userId: a.id, level: 'L1' }, { toHandle: b.handle, firstMessage: 'À effacer' });
    poussees.length = 0;
    await expect(messaging.deleteMessage(b.id, opened.messageId)).rejects.toMatchObject({ status: 404 });
    await messaging.deleteMessage(a.id, opened.messageId);
    await laisser();
    expect(vers(b.id, 'conversation.updated')[0]?.payload).toMatchObject({ reason: 'deleted' });
    expect(vers(a.id, 'conversation.updated')).toHaveLength(1);
  });

  it('[RÈGLE DURE] ignorer une demande : elle quitte ma liste, l’initiateur reste bloqué, rien ne lui est annoncé', async () => {
    const a = await member();
    const b = await member();
    const opened = await messaging.openDirect({ userId: a.id, level: 'L1' }, { toHandle: b.handle, firstMessage: 'Je me présente' });
    const avant = await messaging.listConversations(b.id, { limit: 20 });
    expect(avant.items.some((c) => c.id === opened.conversationId)).toBe(true);

    poussees.length = 0;
    expect(await messaging.ignoreDirect(b.id, opened.conversationId)).toEqual({ ignored: true });
    await laisser();
    const apres = await messaging.listConversations(b.id, { limit: 20 });
    expect(apres.items.some((c) => c.id === opened.conversationId)).toBe(false);

    // L'initiateur : toujours « en attente », second message refusé (§12), aucune poussée vers lui.
    await expect(
      messaging.sendMessage({ userId: a.id, level: 'L1' }, opened.conversationId, { body: 'Relance' }),
    ).rejects.toMatchObject({ code: 'PENDING_CONVERSATION' });
    expect(poussees.filter((p) => p.userId === a.id)).toHaveLength(0);

    // Idempotent.
    expect(await messaging.ignoreDirect(b.id, opened.conversationId)).toEqual({ ignored: true });
  });

  it('on n’ignore pas une conversation acceptée, ni la sienne, ni celle d’un autre', async () => {
    const a = await member();
    const b = await member();
    const c = await member();
    const opened = await messaging.openDirect({ userId: a.id, level: 'L1' }, { toHandle: b.handle, firstMessage: 'Salut' });
    expect(await messaging.ignoreDirect(a.id, opened.conversationId)).toEqual({ ignored: false });
    await expect(messaging.ignoreDirect(c.id, opened.conversationId)).rejects.toMatchObject({ status: 404 });
    await messaging.acceptDirect(b.id, opened.conversationId);
    expect(await messaging.ignoreDirect(b.id, opened.conversationId)).toEqual({ ignored: false });
  });
});
