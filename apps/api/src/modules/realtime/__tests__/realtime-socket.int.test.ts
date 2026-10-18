import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { AddressInfo } from 'node:net';
import IORedis from 'ioredis';
import { io, type Socket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId } from '@app/db';
import { PrismaService } from '../../../common/prisma.service';
import { TokenService } from '../../../common/token.service';
import { loadEnv } from '../../../config/env';
import { RealtimeAdmissionService } from '../realtime.admission';
import { REALTIME_CHANNEL } from '../realtime.channel';
import { RealtimeGateway } from '../realtime.gateway';

/**
 * LE TEMPS RÉEL DE BOUT EN BOUT — 08 §7.3, T4 §7. Une VRAIE passerelle sur un vrai
 * port, deux VRAIS clients socket.io, et le vrai canal Redis.
 *
 * `realtime-admission.int.test.ts` éprouve les refus sans jamais ouvrir de socket.
 * Ce fichier éprouve ce qui manquait : qu'un événement publié sur le canal ARRIVE
 * au bon navigateur et à lui seul, et que la frappe — seul événement qui naît
 * d'un socket — respecte l'appartenance à la conversation.
 */
describe('passerelle temps réel : livraison et frappe', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokens: TokenService;
  let publisher: IORedis;
  let url = '';
  const users: string[] = [];
  const sockets: Socket[] = [];
  const conversations: string[] = [];
  let countryId = '';

  async function member(): Promise<{ id: string; token: string }> {
    const id = newId();
    await prisma.user.create({
      data: {
        id, handle: `rt${id.slice(-10)}`, displayName: 'Membre RT', phase: 'SETTLED',
        verificationLevel: 'L1', originCountryId: countryId, plan: 'FREE', status: 'ACTIVE',
      },
    });
    users.push(id);
    const sid = newId();
    await prisma.authSession.create({
      data: { id: sid, userId: id, refreshTokenHash: `h-${sid}`, chainId: newId(), expiresAt: new Date(Date.now() + 86_400_000) },
    });
    const token = tokens.sign({
      sub: id, sid, level: 'L1', plan: 'FREE', status: 'ACTIVE', exp: Math.floor(Date.now() / 1000) + 900,
    });
    return { id, token };
  }

  async function connect(token: string): Promise<Socket> {
    const socket = io(url, { path: '/ws', auth: { token }, transports: ['websocket'], reconnection: false });
    sockets.push(socket);
    await new Promise<void>((resolve, reject) => {
      socket.once('ready', () => { resolve(); });
      socket.once('refused', (e: { code: string }) => { reject(new Error(e.code)); });
      socket.once('connect_error', reject);
    });
    return socket;
  }

  /** Attend un événement, ou `null` après `ms` : l'ABSENCE d'événement est un résultat. */
  function next(socket: Socket, event: string, ms = 1500): Promise<unknown> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => { socket.off(event); resolve(null); }, ms);
      socket.once(event, (payload: unknown) => { clearTimeout(timer); resolve(payload); });
    });
  }

  async function conversationOf(...ids: string[]): Promise<string> {
    const id = newId();
    await prisma.conversation.create({ data: { id, kind: 'DIRECT' } });
    for (const userId of ids) {
      await prisma.conversationMember.create({ data: { conversationId: id, userId, joinedAt: new Date() } });
    }
    conversations.push(id);
    return id;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [RealtimeGateway, RealtimeAdmissionService, TokenService, PrismaService],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.listen(0);
    url = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
    prisma = app.get(PrismaService);
    tokens = app.get(TokenService);
    publisher = new IORedis(loadEnv().REDIS_URL);
    countryId = (await prisma.country.findFirstOrThrow({ select: { id: true } })).id;
  });

  afterAll(async () => {
    for (const s of sockets) s.close();
    await publisher.quit();
    await prisma.conversation.deleteMany({ where: { id: { in: conversations } } });
    await prisma.authSession.deleteMany({ where: { userId: { in: users } } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    await app.close();
  });

  it('un événement publié sur le canal n’arrive qu’au membre visé, pour les quatre noms de 08 §7.3 et T4 §7', async () => {
    const a = await member();
    const b = await member();
    const sa = await connect(a.token);
    const sb = await connect(b.token);

    for (const event of ['message.new', 'message.read', 'conversation.updated', 'notification.new']) {
      const pourA = next(sa, event);
      const pourB = next(sb, event, 400);
      await publisher.publish(REALTIME_CHANNEL, JSON.stringify({ userId: a.id, event, payload: { n: event } }));
      expect(await pourA).toEqual({ n: event });
      expect(await pourB).toBeNull();
    }
  });

  it('un nom d’événement inconnu du canal n’est JAMAIS poussé à un navigateur', async () => {
    const a = await member();
    const sa = await connect(a.token);
    const recu = next(sa, 'secret.interne', 500);
    await publisher.publish(REALTIME_CHANNEL, JSON.stringify({ userId: a.id, event: 'secret.interne', payload: {} }));
    expect(await recu).toBeNull();
  });

  it('la frappe d’un membre arrive aux AUTRES membres de la conversation, pas à lui', async () => {
    const a = await member();
    const b = await member();
    const conv = await conversationOf(a.id, b.id);
    const sa = await connect(a.token);
    const sb = await connect(b.token);

    const chezB = next(sb, 'conversation.typing');
    const chezA = next(sa, 'conversation.typing', 500);
    sa.emit('typing', { conversationId: conv });

    expect(await chezB).toEqual({ conversationId: conv, userId: a.id });
    expect(await chezA).toBeNull();
  });

  it('la frappe d’un NON-membre dans une conversation est ignorée en silence', async () => {
    const a = await member();
    const b = await member();
    const intrus = await member();
    const conv = await conversationOf(a.id, b.id);
    const sb = await connect(b.token);
    const si = await connect(intrus.token);

    const recu = next(sb, 'conversation.typing', 600);
    si.emit('typing', { conversationId: conv });
    expect(await recu).toBeNull();
  });

  it('une charge de frappe mal formée, ou en rafale, ne passe pas', async () => {
    const a = await member();
    const b = await member();
    const conv = await conversationOf(a.id, b.id);
    const sa = await connect(a.token);
    const sb = await connect(b.token);

    const mauvaise = next(sb, 'conversation.typing', 500);
    sa.emit('typing', { conversationId: 'pas-un-uuid' });
    sa.emit('typing', 'n’importe quoi');
    expect(await mauvaise).toBeNull();

    let recus = 0;
    sb.on('conversation.typing', () => { recus += 1; });
    for (let i = 0; i < 5; i += 1) sa.emit('typing', { conversationId: conv });
    await new Promise((r) => setTimeout(r, 800));
    expect(recus).toBe(1);
  });
});
