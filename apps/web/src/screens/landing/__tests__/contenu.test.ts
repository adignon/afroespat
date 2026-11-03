import { describe, expect, it } from 'vitest';
import { avatarInitiales, dateEvenement, minutesDeLecture, sectionsDeMarkdown } from '../contenu';

describe('sectionsDeMarkdown', () => {
  it('découpe par titres et nettoie la mise en forme', () => {
    const s = sectionsDeMarkdown('Intro **claire**\n\n## Étape 1\nVoir [la préfecture](https://x.fr)\n- un\n- deux\n\n## Étape 2\nFin');
    expect(s.map((x) => x.h)).toEqual(['', 'Étape 1', 'Étape 2']);
    expect(s[0]?.p).toBe('Intro claire');
    expect(s[1]?.p).toBe('Voir la préfecture\n• un\n• deux');
  });
  it('ne rend rien pour un corps vide', () => {
    expect(sectionsDeMarkdown('')).toEqual([]);
  });
});

describe('minutesDeLecture', () => {
  it('compte au moins une minute', () => {
    expect(minutesDeLecture('un mot')).toBe(1);
    expect(minutesDeLecture('mot '.repeat(600))).toBe(3);
  });
});

describe('dateEvenement', () => {
  it('formate à l’heure de Paris', () => {
    expect(dateEvenement('2026-11-06T17:30:00.000Z')).toMatch(/6 nov\.? · 18 h 30/);
  });
});

describe('avatarInitiales', () => {
  it('rend une image intégrée avec les initiales', () => {
    const u = decodeURIComponent(avatarInitiales('Amina Dossou'));
    expect(u).toContain('>AD<');
  });
});
