// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { clearSession, markSessionDead, setAccessToken } from '../session';
import { fakeToken } from './harness';

/**
 * L'indicateur `dp_session` existe AUSSI en cookie : c'est lui que lit la racine (`app/page.tsx`)
 * pour envoyer un visiteur sans session droit à la connexion, sans lui montrer le fil.
 * Il naît et meurt avec l'indicateur du stockage local.
 */
describe('indicateur de session en cookie', () => {
  const present = (): boolean => document.cookie.split('; ').includes('dp_session=1');

  afterEach(() => {
    clearSession();
    localStorage.clear();
  });

  it('posé à l’obtention d’un jeton', () => {
    expect(present()).toBe(false);
    setAccessToken(fakeToken('neuf'));
    expect(present()).toBe(true);
  });

  it('retiré à la déconnexion', () => {
    setAccessToken(fakeToken('neuf'));
    clearSession();
    expect(present()).toBe(false);
  });

  it('retiré quand la session est déclarée morte', () => {
    setAccessToken(fakeToken('neuf'));
    markSessionDead();
    expect(present()).toBe(false);
  });
});
