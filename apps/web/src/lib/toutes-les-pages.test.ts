import { describe, expect, it } from 'vitest';
import { toutesLesPages } from './toutes-les-pages';

describe('toutesLesPages', () => {
  it('suit les curseurs jusqu’à la fin', async () => {
    const pages: Record<string, { items: number[]; nextCursor: string | null }> = {
      debut: { items: [1, 2], nextCursor: 'b' },
      b: { items: [3], nextCursor: null },
    };
    const r = await toutesLesPages((c) => Promise.resolve(pages[c ?? 'debut'] ?? { items: [], nextCursor: null }));
    expect(r.items).toEqual([1, 2, 3]);
    expect(r.tronquee).toBe(false);
  });
  it('s’arrête au plafond et le dit', async () => {
    let appels = 0;
    const r = await toutesLesPages(() => {
      appels += 1;
      return Promise.resolve({ items: [appels], nextCursor: 'encore' });
    }, 3);
    expect(appels).toBe(3);
    expect(r.tronquee).toBe(true);
  });
});
