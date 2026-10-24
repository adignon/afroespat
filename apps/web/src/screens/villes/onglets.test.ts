import { describe, expect, it } from 'vitest';
import { ONGLETS_VILLE, ongletDeUrl } from './onglets';

describe('l’onglet de la fiche ville, lu côté SERVEUR (A12)', () => {
  it('chaque onglet connu se lit, un inconnu retombe sur « budgets »', () => {
    for (const o of ONGLETS_VILLE) expect(ongletDeUrl(o)).toBe(o);
    expect(ongletDeUrl(null)).toBe('budgets');
    expect(ongletDeUrl('inconnu')).toBe('budgets');
  });
});
