import { describe, expect, it, vi } from 'vitest';
import type { Prisma } from '@app/db';
import { bumpUserStat } from '../user-stats';

function fakeTx() {
  const upsert = vi.fn().mockResolvedValue({});
  const updateMany = vi.fn().mockResolvedValue({ count: 1 });
  const tx = { userStats: { upsert, updateMany } } as unknown as Prisma.TransactionClient;
  return { tx, upsert, updateMany };
}

describe('compteurs de réputation (user_stats)', () => {
  it('ne fait rien quand aucune ligne n’a bougé (rejeu)', async () => {
    const { tx, upsert, updateMany } = fakeTx();
    await bumpUserStat(tx, 'u', 'guideHelpfulVotes', 0);
    expect(upsert).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('crée la ligne si besoin et incrémente du nombre de lignes créées', async () => {
    const { tx, upsert } = fakeTx();
    await bumpUserStat(tx, 'u', 'eventsOrganized', 1);
    const call = upsert.mock.calls[0]?.[0] as { create: Record<string, unknown>; update: Record<string, unknown> };
    expect(call.create.eventsOrganized).toBe(1);
    expect(call.update.eventsOrganized).toEqual({ increment: 1 });
  });

  it('décrémente sans jamais passer sous zéro', async () => {
    const { tx, updateMany } = fakeTx();
    await bumpUserStat(tx, 'u', 'guideContributions', -1);
    const call = updateMany.mock.calls[0]?.[0] as { where: Record<string, unknown>; data: Record<string, unknown> };
    expect(call.where.guideContributions).toEqual({ gte: 1 });
    expect(call.data.guideContributions).toEqual({ decrement: 1 });
  });
});
