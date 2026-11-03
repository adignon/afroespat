import { describe, expect, it } from 'vitest';
import {
  LANDING_MIN_MEMBERS,
  median,
  publicCommunityAboutSchema,
  publicLandingSchema,
  publicSearchQuerySchema,
  shortName,
} from '../validation/public-landing';

describe('la page d’accueil publique — fonctions pures et contrats', () => {
  it('le seuil d’affichage des chiffres est de 100 membres', () => {
    expect(LANDING_MIN_MEMBERS).toBe(100);
  });

  it('« Prénom N. » : jamais le nom entier d’un membre', () => {
    expect(shortName('Aïcha Diop')).toBe('Aïcha D.');
    expect(shortName('Marie de la Fontaine')).toBe('Marie F.');
    expect(shortName('  Kofi  ')).toBe('Kofi');
    expect(shortName('')).toBe('');
  });

  it('la médiane, arrondie ; nulle sur une liste vide', () => {
    expect(median([])).toBeNull();
    expect(median([5])).toBe(5);
    expect(median([30, 10, 20])).toBe(20);
    expect(median([10, 20])).toBe(15);
    expect(median([1, 2])).toBe(2); // 1,5 arrondi
  });

  it('la recherche exige deux caractères et refuse les champs inconnus', () => {
    expect(publicSearchQuerySchema.safeParse({ q: 'a' }).success).toBe(false);
    expect(publicSearchQuerySchema.safeParse({ q: 'visale' }).success).toBe(true);
    expect(publicSearchQuerySchema.safeParse({ q: 'visale', autre: 1 }).success).toBe(false);
  });

  it('la fiche « À propos » ne porte ni liste de membres ni fil : le schéma refuse un champ de plus', () => {
    const base = {
      id: '0192b0a4-0000-7000-8000-000000000001',
      name: 'Lyon',
      cityName: 'Lyon',
      description: null,
      memberCount: null,
      foundedYear: 2026,
      moderators: [{ name: 'Aïcha D.', role: 'OWNER' }],
    };
    expect(publicCommunityAboutSchema.safeParse(base).success).toBe(true);
    expect(publicCommunityAboutSchema.safeParse({ ...base, members: [] }).success).toBe(false);
  });

  it('la page d’accueil accepte des compteurs nuls (sous le seuil)', () => {
    const l = {
      stats: { members: null, cities: null, countries: null, countryNames: [] },
      entraide: { medianFirstReplyMinutes: null, resolvedPercent: null, publishedGuides: null },
      events: [],
      cities: [],
      quotes: [],
      generatedAt: new Date().toISOString(),
    };
    expect(publicLandingSchema.safeParse(l).success).toBe(true);
  });
});
