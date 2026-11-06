import { describe, expect, it } from 'vitest';
import { cidrValide, texteVersValeur, typeSaisie, valeurAffichee, valeurVersTexte } from './reglages-saisie';

describe('saisie typée des paramètres', () => {
  it('choisit la forme d’après la valeur', () => {
    expect(typeSaisie('x', 50)).toBe('nombre');
    expect(typeSaisie('x', true)).toBe('booleen');
    expect(typeSaisie('reserved_handles', ['a'])).toBe('liste');
    expect(typeSaisie('admin_allowed_cidrs', [])).toBe('cidr');
    expect(typeSaisie('moderation.thresholds', { a: 1 })).toBe('json');
  });

  it('lit un nombre, avec virgule française, et refuse le reste', () => {
    expect(texteVersValeur('0,5', 'nombre')).toEqual({ ok: true, valeur: 0.5 });
    expect(texteVersValeur('abc', 'nombre').ok).toBe(false);
    expect(texteVersValeur('', 'nombre').ok).toBe(false);
  });

  it('lit une liste une entrée par ligne, sans doublon ni ligne vide', () => {
    expect(texteVersValeur('a\n\nb, a', 'liste')).toEqual({ ok: true, valeur: ['a', 'b'] });
    expect(valeurVersTexte(['a', 'b'], 'liste')).toBe('a\nb');
  });

  it('contrôle les CIDR', () => {
    for (const bon of ['10.0.0.0/8', '203.0.113.7', '2001:db8::/32']) expect(cidrValide(bon)).toBe(true);
    for (const mauvais of ['300.1.1.1', '10.0.0.0/33', 'abc', '10.0.0.0/8/1', '']) expect(cidrValide(mauvais)).toBe(false);
    const r = texteVersValeur('10.0.0.0/8\nnimporte', 'cidr');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erreur).toContain('nimporte');
  });

  it('dit pourquoi un JSON est refusé', () => {
    const r = texteVersValeur('{', 'json');
    expect(r.ok).toBe(false);
  });

  it('affiche la valeur entière, jamais tronquée', () => {
    const longue = Array.from({ length: 80 }, (_, i) => `h${i}`);
    expect(valeurAffichee(longue)).toBe(longue.join(', '));
    expect(valeurAffichee(longue)).not.toContain('…');
    expect(valeurAffichee([])).toBe('(liste vide)');
  });
});
