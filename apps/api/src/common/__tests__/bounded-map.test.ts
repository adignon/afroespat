import { describe, expect, it } from 'vitest';
import { BoundedMap } from '../bounded-map';

describe('BoundedMap (caches en mémoire bornés)', () => {
  it('n’excède jamais sa taille maximale et évince la plus ancienne clé', () => {
    const cache = new BoundedMap<string, number>(3);
    for (let i = 0; i < 100; i += 1) cache.set(`k${i}`, i);
    expect(cache.size).toBe(3);
    expect([...cache.keys()]).toEqual(['k97', 'k98', 'k99']);
  });

  it('réécrire une clé existante ne déclenche aucune éviction et la rend la plus récente', () => {
    const cache = new BoundedMap<string, number>(2);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('a', 3);
    expect([...cache.keys()]).toEqual(['b', 'a']);
    cache.set('c', 4);
    expect([...cache.keys()]).toEqual(['a', 'c']);
    expect(cache.get('a')).toBe(3);
  });
});
