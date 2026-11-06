import { describe, expect, it, vi } from 'vitest';

vi.mock('../../config/env', () => ({ loadEnv: () => ({ OUTBOX_MAX_PENDING_AGE_SECONDS: 300 }) }));

import { HealthController, evaluateOutbox } from './health.controller';

describe('evaluateOutbox', () => {
  it('aucun événement en attente : pas bloqué', () => {
    expect(evaluateOutbox(null, 300)).toEqual({ oldestPendingSeconds: null, stuck: false });
  });
  it('sous le seuil : pas bloqué ; au-delà : bloqué', () => {
    expect(evaluateOutbox(120_000, 300)).toEqual({ oldestPendingSeconds: 120, stuck: false });
    expect(evaluateOutbox(301_000, 300).stuck).toBe(true);
  });
  it('seuil 0 : jamais bloqué', () => {
    expect(evaluateOutbox(99_999_000, 0).stuck).toBe(false);
  });
});

describe('GET /ready', () => {
  const build = (ageMs: number | null) => {
    const prisma = { $queryRaw: vi.fn().mockResolvedValue([1]) };
    const queues = { redis: { ping: vi.fn().mockResolvedValue('PONG') } };
    const outbox = { oldestPendingAge: vi.fn().mockResolvedValue(ageMs) };
    const res = { status: vi.fn() };
    const ctl = new HealthController(prisma as never, queues as never, outbox as never);
    return { ctl, res };
  };

  it('200 quand la boîte d’envoi est à jour', async () => {
    const { ctl, res } = build(2_000);
    const out = await ctl.ready(res as never);
    expect(out).toMatchObject({ status: 'ok', outbox: { oldestPendingSeconds: 2, stuck: false } });
    expect(res.status).not.toHaveBeenCalled();
  });
  it('503 quand le plus ancien événement dépasse le seuil', async () => {
    const { ctl, res } = build(10 * 60_000);
    const out = await ctl.ready(res as never);
    expect(out.status).toBe('degraded');
    expect(out.outbox.stuck).toBe(true);
    expect(res.status).toHaveBeenCalledWith(503);
  });
});
