import { describe, expect, it } from 'vitest';
import { cibleDuPiege, termeDeCategorie } from '../data';
import { CATEGORIES } from '../contenu';

const el = (nom: string) => ({ nom }) as unknown as HTMLElement;

describe('cibleDuPiege (le focus ne quitte pas la fenêtre)', () => {
  const [a, b, c] = [el('a'), el('b'), el('c')];
  const tous = [a, b, c];

  it('ne fait rien au milieu de la fenêtre', () => {
    expect(cibleDuPiege(tous, b, false)).toBeNull();
    expect(cibleDuPiege(tous, b, true)).toBeNull();
  });
  it('boucle du dernier contrôle au premier, et inversement avec Maj+Tab', () => {
    expect(cibleDuPiege(tous, c, false)).toBe(a);
    expect(cibleDuPiege(tous, a, true)).toBe(c);
  });
  it('ramène un focus sorti de la fenêtre', () => {
    expect(cibleDuPiege(tous, null, false)).toBe(a);
    expect(cibleDuPiege(tous, el('dehors'), true)).toBe(c);
  });
  it('laisse faire le navigateur quand la fenêtre n’a aucun contrôle', () => {
    expect(cibleDuPiege([], null, false)).toBeNull();
  });
});

describe('termeDeCategorie', () => {
  it('donne un mot de recherche à chaque rubrique de la page', () => {
    for (const c of CATEGORIES) expect(termeDeCategorie(c.t).length).toBeGreaterThanOrEqual(2);
    expect(termeDeCategorie('Démarches et titres')).toBe('démarches');
  });
  it('retombe sur le libellé en minuscules', () => {
    expect(termeDeCategorie('Autre')).toBe('autre');
  });
});
