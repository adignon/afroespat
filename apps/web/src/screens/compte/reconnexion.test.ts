import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/api/index';
import { proposeReconnexion } from './reconnexion';

const erreur = (status: number, code: string) => new ApiError(code, 'x', status, {}, null);

describe('proposeReconnexion', () => {
  it('propose de se reconnecter sur un 401', () => {
    expect(proposeReconnexion(erreur(401, 'UNAUTHENTICATED'))).toBe(true);
  });

  it('ne le propose pas sur un 403 (niveau requis, accès refusé)', () => {
    expect(proposeReconnexion(erreur(403, 'LEVEL_REQUIRED'))).toBe(false);
    expect(proposeReconnexion(erreur(403, 'FORBIDDEN'))).toBe(false);
  });

  it('ne le propose pas sur une panne ou une erreur inconnue', () => {
    expect(proposeReconnexion(erreur(500, 'INTERNAL'))).toBe(false);
    expect(proposeReconnexion(new Error('réseau'))).toBe(false);
    expect(proposeReconnexion(null)).toBe(false);
  });
});
