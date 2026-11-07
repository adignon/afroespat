import { describe, expect, it } from 'vitest';
import { contient } from './referentiels-listes';
import { sanctionEnCours } from './membres';

describe('référentiels : la recherche', () => {
  it('ne tient compte ni des accents ni de la casse', () => {
    expect(contient('Côte d’Ivoire', 'cote')).toBe(true);
    expect(contient('Sénégal', ' SENEGAL ')).toBe(true);
    expect(contient('Mali', 'bénin')).toBe(false);
  });
});

describe('fiche membre : sanction en cours', () => {
  const maintenant = Date.parse('2026-11-07T12:00:00Z');
  it('un bannissement non levé est en cours, levé il ne l’est plus', () => {
    expect(sanctionEnCours({ type: 'BAN', endsAt: null, liftedAt: null }, maintenant)).toBe(true);
    expect(sanctionEnCours({ type: 'BAN', endsAt: null, liftedAt: '2026-11-01T00:00:00Z' }, maintenant)).toBe(false);
  });
  it('une suspension l’est jusqu’à sa fin', () => {
    expect(sanctionEnCours({ type: 'SUSPENSION', endsAt: '2026-11-08T00:00:00Z', liftedAt: null }, maintenant)).toBe(true);
    expect(sanctionEnCours({ type: 'SUSPENSION', endsAt: '2026-11-06T00:00:00Z', liftedAt: null }, maintenant)).toBe(false);
  });
  it('un avertissement est de l’historique, jamais « en cours »', () => {
    expect(sanctionEnCours({ type: 'WARNING', endsAt: null, liftedAt: null }, maintenant)).toBe(false);
  });
});
