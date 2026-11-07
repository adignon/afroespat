import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { newId } from '@app/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../../../app.module';
import { PrismaService } from '../../../common/prisma.service';
import { creerMembre, purgerMembres } from '../../../common/__tests__/membres-s2b';
import { ConnectionsService } from '../connections.service';

/**
 * Étape 2 — `acceptRequest` est CONDITIONNEL : seule la transition PENDING -> ACCEPTED compte.
 *
 * Deux acceptations simultanées de la même demande ne créent qu'un contact et qu'un
 * événement `connection.created` ; la seconde reçoit 409.
 */
describe('acceptation concurrente d’une demande de contact (étape 2)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let connections: ConnectionsService;
  const users: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    connections = app.get(ConnectionsService);
  });

  afterAll(async () => {
    await purgerMembres(prisma, users);
    await app.close();
  });

  async function demande(): Promise<{ id: string; from: string; to: string }> {
    const from = await creerMembre(prisma);
    const to = await creerMembre(prisma);
    users.push(from, to);
    const id = newId();
    await prisma.connectionRequest.create({
      data: { id, fromUserId: from, toUserId: to, message: 'Bonjour, on se connaît ?', status: 'PENDING' },
    });
    return { id, from, to };
  }

  it('une seule des deux acceptations simultanées réussit, l’autre reçoit 409', async () => {
    const { id, from, to } = await demande();

    const results = await Promise.allSettled([
      connections.acceptRequest(id, to),
      connections.acceptRequest(id, to),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
    expect(rejected?.reason).toMatchObject({ code: 'CONFLICT', status: 409 });

    expect(await prisma.connection.count({ where: { OR: [{ userAId: from, userBId: to }, { userAId: to, userBId: from }] } })).toBe(1);
    expect(await prisma.domainEvent.count({ where: { type: 'connection.created', aggregateId: id } })).toBe(1);
  });

  it('refuse d’accepter une demande déjà refusée (état non PENDING)', async () => {
    const { id, to } = await demande();
    await connections.declineRequest(id, to);
    await expect(connections.acceptRequest(id, to)).rejects.toMatchObject({ status: 404 });
  });
});
