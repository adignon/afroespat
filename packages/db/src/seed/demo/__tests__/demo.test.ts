import { createDecipheriv, randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { dernierTrimestreClos } from '../activite.js';
import { creerRng, dansJours, ilYa } from '../prng.js';
import { cleDepuisEnv, sceller } from '../scellement.js';
import { paquets } from '../types.js';
import { pseudoDemo } from '../membres.js';

describe('creerRng', () => {
  it('rejoue la même suite avec la même graine, et une autre suite avec une autre', () => {
    const a = creerRng(42);
    const b = creerRng(42);
    const c = creerRng(43);
    const suiteA = Array.from({ length: 8 }, () => a.next());
    expect(Array.from({ length: 8 }, () => b.next())).toEqual(suiteA);
    expect(Array.from({ length: 8 }, () => c.next())).not.toEqual(suiteA);
  });

  it('respecte les bornes de int et ne répète pas dans sample', () => {
    const rng = creerRng(7);
    for (let i = 0; i < 200; i++) {
      const n = rng.int(3, 9);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(9);
    }
    const tirage = rng.sample([1, 2, 3, 4, 5, 6], 4);
    expect(new Set(tirage).size).toBe(4);
    expect(rng.sample([1, 2], 5)).toHaveLength(2);
  });

  it('weighted ne rend jamais une valeur de poids nul', () => {
    const rng = creerRng(1);
    for (let i = 0; i < 200; i++) expect(rng.weighted([['a', 0], ['b', 5]] as const)).toBe('b');
  });
});

describe('dates relatives', () => {
  it('ilYa recule, dansJours avance', () => {
    const now = new Date('2026-11-06T12:00:00.000Z');
    const rng = creerRng(1);
    expect(ilYa(now, 10, rng).getTime()).toBeLessThan(now.getTime());
    expect(dansJours(now, 10, 18).getTime()).toBeGreaterThan(now.getTime());
    expect(dansJours(now, 10, 18, 30).getUTCMinutes()).toBe(30);
  });
});

describe('dernierTrimestreClos', () => {
  it('rend le trimestre précédent, au format « AAAA-Tn »', () => {
    expect(dernierTrimestreClos(new Date('2026-11-06T00:00:00Z'))).toBe('2026-T3');
    expect(dernierTrimestreClos(new Date('2026-02-01T00:00:00Z'))).toBe('2025-T4');
    expect(dernierTrimestreClos(new Date('2026-04-15T00:00:00Z'))).toBe('2026-T1');
  });
});

describe('sceller — le format des messages', () => {
  it('produit en-tête (a7 1d id) + IV + étiquette + texte, relisible avec la même clé', () => {
    const cle = { id: 3, cle: randomBytes(32) };
    const scelle = Buffer.from(sceller('Bonjour, ça va ?', cle));
    expect([scelle[0], scelle[1], scelle[2]]).toEqual([0xa7, 0x1d, 3]);
    const corps = scelle.subarray(3);
    const dec = createDecipheriv('aes-256-gcm', cle.cle, corps.subarray(0, 12));
    dec.setAuthTag(corps.subarray(12, 28));
    expect(Buffer.concat([dec.update(corps.subarray(28)), dec.final()]).toString('utf8')).toBe('Bonjour, ça va ?');
  });

  it('cleDepuisEnv : absente → null, invalide → erreur', () => {
    expect(cleDepuisEnv({})).toBeNull();
    expect(() => cleDepuisEnv({ CONTENT_ENCRYPTION_KEY: Buffer.from('court').toString('base64') })).toThrow(/32 octets/);
    const ok = cleDepuisEnv({ CONTENT_ENCRYPTION_KEY: randomBytes(32).toString('base64'), CONTENT_ENCRYPTION_KEY_ID: '2' });
    expect(ok?.id).toBe(2);
  });
});

describe('paquets', () => {
  it('coupe sans perdre ni répéter', () => {
    expect(paquets([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(paquets([], 2)).toEqual([]);
  });
});

describe('pseudoDemo', () => {
  it('rend toujours un pseudo valide (jamais de point), et départage les homonymes', () => {
    const regle = /^[a-z0-9](?:[a-z0-9]|[_-](?![_-]))*[a-z0-9]$/;
    const pris = new Set<string>();
    for (const [p, n] of [['Hortense', 'Biyong'], ['Hortense', 'Biyong'], ['Aïcha', "N'Diaye"], ['Jean-Marc', 'Ouédraogo']] as const) {
      const h = pseudoDemo(p, n, pris);
      expect(h).toMatch(regle);
      expect(h.length).toBeGreaterThanOrEqual(3);
      expect(h.length).toBeLessThanOrEqual(30);
      expect(pris.has(h)).toBe(false);
      pris.add(h);
    }
  });
});
