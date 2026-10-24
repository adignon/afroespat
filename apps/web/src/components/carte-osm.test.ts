import { describe, expect, it } from 'vitest';
import { diametre, libelleDe, repere } from './carte-osm';
import type { PointCarte } from '@/screens/villes/data';

const point = (p: Partial<PointCarte>): PointCarte => ({
  id: 'v1',
  slug: 'lyon',
  nom: 'Lyon',
  region: null,
  latitude: 45.76,
  longitude: 4.83,
  compte: 340,
  souslesSeuil: false,
  ...p,
});

describe('carte OpenStreetMap — les repères', () => {
  it('le diamètre suit la racine du compteur, borné', () => {
    expect(diametre(null, 100)).toBe(26);
    expect(diametre(0, 100)).toBe(26);
    expect(diametre(1, 10_000)).toBeGreaterThanOrEqual(26);
    expect(diametre(100, 100)).toBe(68);
    expect(diametre(25, 100)).toBeLessThan(diametre(100, 100));
    expect(diametre(1_000_000, 100)).toBe(68);
  });

  it('le libellé dit « moins de 3 » sous le seuil, jamais le nombre', () => {
    expect(libelleDe(point({ compte: 340 }))).toBe('Lyon · 340');
    const sous = libelleDe(point({ compte: null }));
    expect(sous).toContain('Lyon · ');
    expect(sous).toMatch(/moins de 3/);
    expect(sous).not.toMatch(/\d{2,}/);
  });

  it('le repère reprend les couleurs de la maquette, terre cuite pour ma ville', () => {
    expect(repere(point({}), 340, false, false).html).toContain('#16785E');
    expect(repere(point({}), 340, true, false).html).toContain('#E0733A');
    expect(repere(point({}), 340, false, true).html).toContain('border:4px solid');
    expect(repere(point({}), 340, false, false).html).toContain('border:2px solid');
  });

  it('le nom d’une ville ne peut pas injecter de HTML', () => {
    const html = repere(point({ nom: '<img src=x onerror=alert(1)>' }), 10, false, false).html;
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });
});
