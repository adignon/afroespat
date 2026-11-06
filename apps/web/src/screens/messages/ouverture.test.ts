import { describe, expect, it } from 'vitest';
import { choisirOuverte, lirePages } from './ouverture';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const C = '33333333-3333-4333-8333-333333333333';
const conv = (id: string, extra: Partial<{ blockedByMe: boolean; pendingForMe: boolean }> = {}) => ({
  id,
  blockedByMe: false,
  pendingForMe: false,
  ...extra,
});

describe('choisirOuverte', () => {
  it('sans identifiant : la première conversation ni bloquée ni en attente', () => {
    const r = choisirOuverte([conv(A, { blockedByMe: true }), conv(B, { pendingForMe: true }), conv(C)], null);
    expect(r).toEqual({ etat: 'ouverte', conversation: conv(C) });
  });

  it('sans identifiant et sans conversation : ouverte vide', () => {
    expect(choisirOuverte([], null)).toEqual({ etat: 'ouverte', conversation: null });
  });

  it('avec identifiant présent : celle-là', () => {
    expect(choisirOuverte([conv(A), conv(B)], B)).toEqual({ etat: 'ouverte', conversation: conv(B) });
  });

  it('identifiant absent de la liste : introuvable, jamais la première', () => {
    expect(choisirOuverte([conv(A), conv(B)], C)).toEqual({ etat: 'introuvable' });
  });

  it('identifiant fantaisiste : introuvable', () => {
    expect(choisirOuverte([conv(A)], '../etc')).toEqual({ etat: 'introuvable' });
  });
});

describe('lirePages', () => {
  const pages = [
    { items: [1, 2], nextCursor: 'a' },
    { items: [3, 4], nextCursor: 'b' },
    { items: [5], nextCursor: null },
  ];
  const lire = (curseur: string | null) => {
    const rang = curseur === null ? 0 : curseur === 'a' ? 1 : 2;
    return Promise.resolve(pages[rang]!);
  };

  it('lit le nombre de pages demandé et garde le curseur suivant', async () => {
    expect(await lirePages(lire, { pages: 2 })).toMatchObject({ items: [1, 2, 3, 4], nextCursor: 'b' });
  });

  it('continue jusqu\'à trouver, dans la limite du plafond', async () => {
    const r = await lirePages(lire, { pages: 1, plafond: 5, assez: (xs) => xs.includes(5) });
    expect(r).toMatchObject({ items: [1, 2, 3, 4, 5], nextCursor: null });
  });

  it('respecte le plafond quand rien n\'est trouvé', async () => {
    const r = await lirePages(lire, { pages: 1, plafond: 2, assez: () => false });
    expect(r.items).toEqual([1, 2, 3, 4]);
    expect(r.nextCursor).toBe('b');
  });
});
