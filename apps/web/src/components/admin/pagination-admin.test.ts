import { describe, expect, it } from 'vitest';
import { fusionnerPages } from './pagination-admin';

describe('fusionnerPages', () => {
  const premiere = { items: [1, 2], nextCursor: 'c1' };
  it('rend la première page seule tant que rien n’est ajouté', () => {
    expect(fusionnerPages(premiere, null)).toEqual({ items: [1, 2], curseur: 'c1' });
  });
  it('ajoute les pages suivantes et reprend le dernier curseur', () => {
    expect(fusionnerPages(premiere, { base: premiere, items: [3, 4], curseur: null })).toEqual({ items: [1, 2, 3, 4], curseur: null });
  });
  it('ignore les pages ajoutées à une première page périmée (rechargement)', () => {
    const rechargee = { items: [9], nextCursor: null };
    expect(fusionnerPages(rechargee, { base: premiere, items: [3], curseur: 'x' })).toEqual({ items: [9], curseur: null });
  });
});
