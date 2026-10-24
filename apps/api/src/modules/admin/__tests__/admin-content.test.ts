import { describe, expect, it } from 'vitest';
import { evaluateFlag, rolloutBucket } from '../../../common/feature-flag.service';
import { hasDependencyCycle } from '../admin-journeys.service';

describe('feature flags — la règle d’évaluation (15 §4.3)', () => {
  const base = { key: 'section.x', isEnabled: true, rolloutPct: 100, conditions: null };
  it('un drapeau éteint est faux, quoi que disent les autres champs', () => {
    expect(evaluateFlag({ ...base, isEnabled: false }, { userId: 'u' })).toBe(false);
  });
  it('sans membre, seul un drapeau ouvert à 100 % et sans condition est vrai', () => {
    expect(evaluateFlag(base, null)).toBe(true);
    expect(evaluateFlag({ ...base, rolloutPct: 50 }, null)).toBe(false);
    expect(evaluateFlag({ ...base, conditions: { cityIds: ['c'] } }, null)).toBe(false);
  });
  it('chaque dimension non vide doit contenir la valeur du membre', () => {
    const f = { ...base, conditions: { cityIds: ['c1'], phases: ['SETTLED' as const] } };
    expect(evaluateFlag(f, { userId: 'u', cityId: 'c1', phase: 'SETTLED' })).toBe(true);
    expect(evaluateFlag(f, { userId: 'u', cityId: 'c2', phase: 'SETTLED' })).toBe(false);
    expect(evaluateFlag(f, { userId: 'u', cityId: 'c1', phase: 'ARRIVAL' })).toBe(false);
  });
  it('le pourcentage est stable et croissant : élargir ne retire personne', () => {
    const users = Array.from({ length: 400 }, (_, i) => `user-${i}`);
    const at = (pct: number) => users.filter((u) => evaluateFlag({ ...base, rolloutPct: pct }, { userId: u }));
    const ten = at(10);
    const thirty = at(30);
    expect(ten.every((u) => thirty.includes(u))).toBe(true);
    expect(ten.length).toBeGreaterThan(10);
    expect(ten.length).toBeLessThan(80);
    expect(rolloutBucket('k', 'u')).toBe(rolloutBucket('k', 'u'));
  });
});

describe('dépendances d’un modèle (03 §5.2)', () => {
  it('détecte une boucle, directe ou lointaine', () => {
    expect(hasDependencyCycle(3, [{ step: 0, dependsOn: 1 }, { step: 1, dependsOn: 2 }, { step: 2, dependsOn: 0 }])).toBe(true);
    expect(hasDependencyCycle(2, [{ step: 0, dependsOn: 0 }])).toBe(true);
  });
  it('accepte un graphe sans boucle, même en losange', () => {
    expect(hasDependencyCycle(4, [{ step: 3, dependsOn: 1 }, { step: 3, dependsOn: 2 }, { step: 1, dependsOn: 0 }, { step: 2, dependsOn: 0 }])).toBe(false);
    expect(hasDependencyCycle(0, [])).toBe(false);
  });
});
