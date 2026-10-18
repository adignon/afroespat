import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId } from '@app/db';
import { SEARCH_RATE_LIMITS } from '@app/shared';
import { AppModule } from '../../../app.module';
import { ApiErrorFilter } from '../../../common/error.filter';
import { PrismaService } from '../../../common/prisma.service';
import { RATE_LIMIT_CONFIG } from '../../../common/rate-limit.guard';
import { TokenService } from '../../../common/token.service';
import { QueueService } from '../../../queue/queue.service';

/**
 * Lot F, par HTTP : les routes et les gardes que les services ne montrent pas.
 *   · POST /conversations/:id/ignore ;
 *   · GET /conversations/:id/messages → meta.seenAt ;
 *   · POST /reports sur UN message précis (garde d'appartenance, 08 §5.2) ;
 *   · le budget de débit dédié de GET /search.
 */
describe('lot F — routes HTTP : ignorer, Vu, signaler un message, débit de /search', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokens: TokenService;
  const users: string[] = [];
  let countryId = '';
  let cityId = '';
  const server = (): Server => app.getHttpServer() as Server;

  async function member(level: 'L1' | 'L2' = 'L2'): Promise<{ id: string; handle: string; token: string }> {
    const id = newId();
    const handle = `hf${id.slice(-10)}`;
    await prisma.user.create({
      data: { id, handle, displayName: `Membre ${handle}`, phase: 'SETTLED', verificationLevel: level, originCountryId: countryId, cityId, plan: 'FREE', status: 'ACTIVE' },
    });
    users.push(id);
    const token = tokens.sign({ sub: id, sid: newId(), level, plan: 'FREE', status: 'ACTIVE', exp: Math.floor(Date.now() / 1000) + 900 });
    return { id, handle, token };
  }
  const auth = (m: { token: string }): [string, string] => ['Authorization', `Bearer ${m.token}`];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(RATE_LIMIT_CONFIG)
      .useValue({ enabled: true, requestsPerMinute: 1000, writesPerMinute: 1000 })
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('v1');
    app.useGlobalFilters(new ApiErrorFilter());
    await app.init();
    prisma = app.get(PrismaService);
    tokens = app.get(TokenService);
    countryId = (await prisma.country.findFirstOrThrow({ where: { isActive: true, kind: { in: ['ORIGIN', 'BOTH'] } }, select: { id: true } })).id;
    cityId = (await prisma.city.findFirstOrThrow({ select: { id: true } })).id;
  });

  afterAll(async () => {
    await prisma.report.deleteMany({ where: { reporterUserId: { in: users } } });
    await prisma.moderationCase.deleteMany({ where: { subjectAuthorUserId: { in: users } } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    const redis = app.get(QueueService).redis;
    const keys = await redis.keys('rl-*');
    if (keys.length > 0) await redis.del(...keys);
    await app.close();
  });

  async function opened(a: { handle: string; token: string }, b: { handle: string }) {
    const r = await request(server()).post('/v1/conversations/direct').set(...auth(a)).send({ toHandle: b.handle, firstMessage: 'Bonjour, on peut échanger ?' });
    expect(r.status).toBe(201);
    return r.body as { conversationId: string; messageId: string };
  }

  it('POST /conversations/:id/ignore : le destinataire ignore, un tiers a 404, l’initiateur n’ignore pas', async () => {
    const a = await member();
    const b = await member();
    const c = await member();
    const { conversationId } = await opened(a, b);

    expect((await request(server()).post(`/v1/conversations/${conversationId}/ignore`).set(...auth(c))).status).toBe(404);
    const initiateur = await request(server()).post(`/v1/conversations/${conversationId}/ignore`).set(...auth(a));
    expect(initiateur.body).toEqual({ ignored: false });

    const ok = await request(server()).post(`/v1/conversations/${conversationId}/ignore`).set(...auth(b));
    expect(ok.status).toBe(200);
    expect(ok.body).toEqual({ ignored: true });
    const liste = await request(server()).get('/v1/conversations').set(...auth(b));
    expect((liste.body as { items: { id: string }[] }).items.some((i) => i.id === conversationId)).toBe(false);
  });

  it('GET /conversations/:id/messages rend meta.seenAt (null puis la lecture de l’autre)', async () => {
    const a = await member();
    const b = await member();
    const { conversationId } = await opened(a, b);
    const avant = await request(server()).get(`/v1/conversations/${conversationId}/messages`).set(...auth(a));
    expect(avant.body.meta.seenAt).toBeNull();

    await request(server()).post(`/v1/conversations/${conversationId}/accept`).set(...auth(b)).expect(201);
    const apres = await request(server()).get(`/v1/conversations/${conversationId}/messages`).set(...auth(a));
    expect(typeof apres.body.meta.seenAt).toBe('string');
  });

  it('POST /reports { subjectType: MESSAGE } : un membre de la conversation oui, un étranger 404, son propre message non', async () => {
    const a = await member();
    const b = await member();
    const intrus = await member();
    const { messageId } = await opened(a, b);
    const corps = { subjectType: 'MESSAGE', subjectId: messageId, reason: 'HARASSMENT' };

    expect((await request(server()).post('/v1/reports').set(...auth(intrus)).send(corps)).status).toBe(404);
    const propre = await request(server()).post('/v1/reports').set(...auth(a)).send(corps);
    expect(propre.status).toBeGreaterThanOrEqual(400);
    expect(propre.body.error?.code ?? propre.body.code).toBeDefined();

    const ok = await request(server()).post('/v1/reports').set(...auth(b)).send(corps);
    expect(ok.status).toBe(201);
    const deja = await request(server()).post('/v1/reports').set(...auth(b)).send(corps);
    expect(deja.status).toBe(409);
  });

  it('GET /search a son budget propre : l’appel suivant le budget est refusé en 429, les suggestions ont le leur', async () => {
    const a = await member();
    const statuses: number[] = [];
    for (let i = 0; i < SEARCH_RATE_LIMITS.search + 1; i += 1) {
      statuses.push((await request(server()).get('/v1/search').query({ q: 'logement' }).set(...auth(a))).status);
    }
    expect(statuses.slice(0, SEARCH_RATE_LIMITS.search)).not.toContain(429);
    expect(statuses[SEARCH_RATE_LIMITS.search]).toBe(429);
    // Un autre budget : les suggestions ne sont pas épuisées par la recherche.
    expect((await request(server()).get('/v1/search/suggest').query({ q: 'logement' }).set(...auth(a))).status).toBe(200);
  });
});
