import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId } from '@app/db';
import { OutboxService } from '../outbox.service';
import { PrismaService } from '../prisma.service';

/**
 * Boîte d'envoi transactionnelle — §9.1.
 *
 * Ce que ce test vérifie est précisément ce que le patron existe pour garantir,
 * et qu'aucune relecture de code ne démontre : qu'une transaction ANNULÉE ne
 * laisse aucun événement derrière elle.
 */
describe('boîte d’envoi (§9.1)', () => {
  let prisma: PrismaService;
  let outbox: OutboxService;
  const marker = `test.${Date.now()}`;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    outbox = new OutboxService(prisma);
  });

  afterAll(async () => {
    await prisma.domainEvent.deleteMany({ where: { type: { startsWith: 'test.' } } });
    await prisma.$disconnect();
  });

  it('écrit l’événement dans la même transaction que la donnée', async () => {
    const aggregateId = newId();

    await prisma.$transaction(async (tx) => {
      await outbox.emit(tx, {
        type: marker as never,
        aggregateId,
        payload: { ok: true },
      });
    });

    const found = await prisma.domainEvent.findFirst({ where: { aggregateId } });
    expect(found).not.toBeNull();
    expect(found?.publishedAt).toBeNull();
  });

  /**
   * LE test du patron. Sans la boîte d'envoi, un effet de bord publié avant le
   * commit survivrait à une annulation : un parrainage refusé qui notifie
   * quand même, une réputation créditée pour une action défaite.
   */
  it('une transaction annulée ne laisse AUCUN événement', async () => {
    const aggregateId = newId();

    await expect(
      prisma.$transaction(async (tx) => {
        await outbox.emit(tx, { type: marker as never, aggregateId, payload: {} });
        // L'écriture métier échoue après coup : tout doit être défait.
        throw new Error('échec métier simulé');
      }),
    ).rejects.toThrow('échec métier simulé');

    const found = await prisma.domainEvent.findFirst({ where: { aggregateId } });
    expect(found, 'un événement a survécu à une transaction annulée').toBeNull();
  });

  it('réclame les non publiés puis les marque, sans les rendre deux fois', async () => {
    /**
     * La file est VIDÉE d'abord.
     *
     * `claimUnpublished(100)` rend les cent plus ANCIENS en attente, et les autres
     * suites d'intégration en laissent des centaines derrière elles — les
     * événements n'ont pas de clé étrangère vers `users`, donc la suppression d'un
     * compte de test ne les emporte pas. Le test cherchait alors ses trois
     * événements dans une fenêtre où ils ne pouvaient pas être.
     *
     * Ce qu'on éprouve ici est le MÉCANISME de réclamation, pas le contenu de la
     * file : dans une base de test, ce qui traîne est du débris.
     */
    await prisma.domainEvent.updateMany({
      where: { publishedAt: null },
      data: { publishedAt: new Date() },
    });

    const ids = [newId(), newId(), newId()];
    await prisma.$transaction(async (tx) => {
      await outbox.emitMany(
        tx,
        ids.map((id) => ({ type: marker as never, aggregateId: id, payload: {} })),
      );
    });

    const claimed = await outbox.claimUnpublished(100);
    const mine = claimed.filter((e) => ids.includes(e.aggregateId));
    expect(mine).toHaveLength(3);

    await outbox.markPublished(mine.map((e) => e.id));

    const again = await outbox.claimUnpublished(100);
    expect(again.filter((e) => ids.includes(e.aggregateId))).toHaveLength(0);
  });

  it('expose l’âge du plus ancien en attente — la métrique d’alerte du runbook §4', async () => {
    await prisma.domainEvent.deleteMany({ where: { type: { startsWith: 'test.' } } });
    const before = await outbox.oldestPendingAge();

    await prisma.$transaction(async (tx) => {
      await outbox.emit(tx, { type: marker as never, aggregateId: newId(), payload: {} });
    });

    const after = await outbox.oldestPendingAge();
    expect(after).not.toBeNull();
    expect(after).toBeGreaterThanOrEqual(0);
    // Avant l'insertion il pouvait ne rien y avoir : on vérifie surtout que la
    // métrique répond, pas sa valeur exacte.
    expect(typeof before === 'number' || before === null).toBe(true);
  });
});
