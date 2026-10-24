import { describe, expect, it } from 'vitest';
import { abbrJour, hrefAgenda, numeroJour, pluriel, scopeDeUrl } from './data';

describe('l’URL de l’agenda porte le jour, le mois et le filtre (09 §3.5)', () => {
  it('un paramètre de filtre inconnu retombe sur « tous »', () => {
    expect(scopeDeUrl('mine')).toBe('mine');
    expect(scopeDeUrl('organized')).toBe('organized');
    expect(scopeDeUrl('nimporte-quoi')).toBe('all');
    expect(scopeDeUrl(null)).toBe('all');
  });

  it('l’état par défaut est /agenda tout court', () => {
    expect(hrefAgenda({})).toBe('/agenda');
    expect(hrefAgenda({ scope: 'all' })).toBe('/agenda');
  });

  it('le jour, le mois et le filtre se partagent par l’adresse', () => {
    expect(hrefAgenda({ jour: '2026-10-21' })).toBe('/agenda?jour=2026-10-21');
    expect(hrefAgenda({ jour: '2026-10-21', mois: '2026-10', scope: 'mine' })).toBe(
      '/agenda?jour=2026-10-21&mois=2026-10&scope=mine',
    );
    expect(hrefAgenda({ jour: null, mois: null })).toBe('/agenda');
  });
});

describe('les libellés de jour ne dépendent pas du fuseau du navigateur', () => {
  it('un jour civil garde son numéro et son abréviation', () => {
    expect(numeroJour('2026-10-01')).toBe('1');
    expect(numeroJour('2026-10-31')).toBe('31');
    expect(abbrJour('2026-10-24')).toBe('SAM');
    expect(abbrJour('2026-10-25')).toBe('DIM');
  });

  it('le pluriel français commence à deux', () => {
    expect(pluriel(0)).toBe('');
    expect(pluriel(1)).toBe('');
    expect(pluriel(2)).toBe('s');
  });
});
