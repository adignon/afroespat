import { describe, expect, it, vi } from 'vitest';
import { signalerSessionPerdue, suiteValide, surSessionPerdue, urlConnexion } from '../staff-session';

describe('suiteValide', () => {
  it('accepte un chemin interne de l’administration', () => {
    expect(suiteValide('/admin/membres?q=a')).toBe('/admin/membres?q=a');
    expect(suiteValide('/admin')).toBe('/admin');
  });
  it('refuse URL externe, double barre, remontée, boucle de connexion', () => {
    for (const s of ['https://evil.com', '//evil.com', '/admin/../me', '/membres', '/admin/connexion', '/admin' + String.fromCharCode(92) + 'x', null, '', 'javascript:1'])
      expect(suiteValide(s)).toBeNull();
  });
});

describe('urlConnexion', () => {
  it('pose suite et expiree', () => {
    expect(urlConnexion('/admin/membres', true)).toBe('/admin/connexion?suite=%2Fadmin%2Fmembres&expiree=1');
    expect(urlConnexion('https://x', false)).toBe('/admin/connexion');
  });
});

describe('signalerSessionPerdue', () => {
  it('ne redirige qu’une fois et ignore /auth/*', () => {
    const g = vi.fn();
    const stop = surSessionPerdue(g);
    signalerSessionPerdue('/auth/login');
    expect(g).not.toHaveBeenCalled();
    signalerSessionPerdue('/members');
    signalerSessionPerdue('/members');
    expect(g).toHaveBeenCalledTimes(1);
    stop();
  });
});
