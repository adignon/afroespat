import { describe, expect, it } from 'vitest';
import { newId, newIdAt, timestampOf } from '../uuid.js';

describe('UUID v7', () => {
  it('respecte la forme canonique', () => {
    expect(newId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('porte la version 7 et la variante RFC', () => {
    for (let i = 0; i < 200; i += 1) {
      const id = newId();
      expect(id[14]).toBe('7');
      expect(['8', '9', 'a', 'b']).toContain(id[19]);
    }
  });

  it('est triable chronologiquement — c’est la raison de le préférer à v4', () => {
    const ids = Array.from({ length: 5000 }, () => newId());
    expect([...ids].sort()).toEqual(ids);
  });

  it('reste monotone quand des milliers d’identifiants tombent dans la même milliseconde', () => {
    const ids = Array.from({ length: 10_000 }, () => newId());
    expect(new Set(ids).size).toBe(10_000);
    expect([...ids].sort()).toEqual(ids);
  });

  it('encode l’horodatage de façon relisible', () => {
    const when = new Date('2026-09-27T04:00:00.000Z');
    expect(timestampOf(newIdAt(when)).getTime()).toBe(when.getTime());
  });
});
