import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import { phraseDeRefus, pseudoConfirme } from './confirmation-suppression';
import { jourDEcheance } from './bandeau-suppression';

/**
 * Les trois règles pures de la suppression de compte (K08, lot w5b). Le parcours entier — pseudo,
 * code, demande, déconnexion, bande « suppression programmée » — est éprouvé au navigateur par
 * `e2e/suppression-compte.spec.ts` ; ici, ce qui n'a pas besoin d'un navigateur.
 */
describe('pseudoConfirme', () => {
  it('ignore la casse, les espaces autour et le « @ » de tête', () => {
    expect(pseudoConfirme('Awa-K', 'awa-k')).toBe(true);
    expect(pseudoConfirme('  @awa-k ', 'awa-k')).toBe(true);
  });

  it('refuse un pseudo voisin, un préfixe, et le vide', () => {
    expect(pseudoConfirme('awa', 'awa-k')).toBe(false);
    expect(pseudoConfirme('awa-k2', 'awa-k')).toBe(false);
    expect(pseudoConfirme('', 'awa-k')).toBe(false);
  });

  it('ne confirme rien tant que le pseudo du membre est inconnu', () => {
    expect(pseudoConfirme('', '')).toBe(false);
    expect(pseudoConfirme('@', '@')).toBe(false);
  });
});

describe('phraseDeRefus', () => {
  const refus = (code: string, status: number, message: string, details: Record<string, unknown> = {}) =>
    new ApiError(code, message, status, details, null);

  it('dit combien d’essais restent, au singulier comme au pluriel', () => {
    expect(phraseDeRefus(refus('OTP_INVALID', 422, 'x', { attemptsLeft: 4 }))).toBe(
      'Code incorrect. Il vous reste 4 essais.',
    );
    expect(phraseDeRefus(refus('OTP_INVALID', 422, 'x', { attemptsLeft: 1 }))).toBe(
      'Code incorrect. Il vous reste 1 essai.',
    );
    expect(phraseDeRefus(refus('OTP_INVALID', 422, 'x'))).toBe('Code incorrect.');
  });

  it('explique qu’une suppression est déjà programmée, et comment l’annuler', () => {
    expect(phraseDeRefus(refus('DELETION_ALREADY_PENDING', 409, 'x'))).toMatch(/Reconnectez-vous/);
  });

  it('rend la phrase du serveur pour les autres refus, et une phrase neutre sinon', () => {
    expect(phraseDeRefus(refus('OTP_PURPOSE_MISMATCH', 422, 'Ce code ne sert pas à cela.'))).toBe(
      'Ce code ne sert pas à cela.',
    );
    expect(phraseDeRefus(new Error('Réseau coupé'))).toBe('Réseau coupé');
    expect(phraseDeRefus('?')).toMatch(/Réessayez/);
  });
});

describe('jourDEcheance', () => {
  it('écrit le jour en toutes lettres, à l’heure de Paris', () => {
    expect(jourDEcheance('2026-11-02T10:00:00.000Z')).toBe('lundi 2 novembre 2026');
  });

  it('ne dit rien d’une date illisible : la bande ne s’affiche pas', () => {
    expect(jourDEcheance('pas une date')).toBeNull();
  });
});
