import { describe, expect, it } from 'vitest';
import { cibleDuPiege, photoDeVille, termeDeCategorie } from '../data';
import { CATEGORIES, visuelVille } from '../contenu';

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

describe('photoDeVille (photo hébergée, sinon visuel de repli)', () => {
  it('rend la photo hébergée des villes qui en ont une, avec son crédit', () => {
    const lyon = photoDeVille('lyon', 'Lyon');
    expect(lyon.src).toMatch(/^\/landing\/.+\.jpg$/);
    expect(lyon.credit).toContain('Unsplash');
  });
  it('rend un visuel de repli propre, sans crédit, pour les autres', () => {
    const v = photoDeVille('bordeaux', 'Bordeaux');
    expect(v.src.startsWith('data:image/svg+xml')).toBe(true);
    expect(decodeURIComponent(v.src)).toContain('>B</text>');
    expect(v.credit).toBe('');
  });
  it('est stable d’un appel à l’autre et varie d’une ville à l’autre', () => {
    expect(visuelVille('nantes', 'Nantes')).toBe(visuelVille('nantes', 'Nantes'));
    expect(visuelVille('nantes', 'Nantes')).not.toBe(visuelVille('lille', 'Lille'));
  });
  it('neutralise un nom qui casserait le SVG', () => {
    expect(decodeURIComponent(visuelVille('x', '<script>'))).not.toContain('<script');
    expect(visuelVille('x', '')).toContain(encodeURIComponent('>?</text>'));
  });
});
