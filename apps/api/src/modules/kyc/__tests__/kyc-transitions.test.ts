import { describe, expect, it } from 'vitest';
import { isKycEventStale, isKycTransitionAllowed } from '../kyc-transitions';

describe('transitions de statut KYC', () => {
  it('un APPROVED ne peut être dégradé que vers DECLINED', () => {
    expect(isKycTransitionAllowed('APPROVED', 'IN_REVIEW')).toBe(false);
    expect(isKycTransitionAllowed('APPROVED', 'EXPIRED')).toBe(false);
    expect(isKycTransitionAllowed('APPROVED', 'ABANDONED')).toBe(false);
    expect(isKycTransitionAllowed('APPROVED', 'DECLINED')).toBe(true);
  });

  it('EXPIRED et ABANDONED sont terminaux : ils ne redeviennent jamais APPROVED', () => {
    expect(isKycTransitionAllowed('EXPIRED', 'APPROVED')).toBe(false);
    expect(isKycTransitionAllowed('ABANDONED', 'APPROVED')).toBe(false);
  });

  it('IN_PROGRESS mène à tous les états de décision', () => {
    for (const to of ['APPROVED', 'DECLINED', 'IN_REVIEW', 'ABANDONED', 'EXPIRED'] as const) {
      expect(isKycTransitionAllowed('IN_PROGRESS', to)).toBe(true);
    }
  });

  it('un message plus ancien que la dernière décision est périmé', () => {
    const decided = new Date('2026-01-01T10:00:00Z');
    expect(isKycEventStale(new Date('2026-01-01T09:00:00Z'), decided)).toBe(true);
    expect(isKycEventStale(new Date('2026-01-01T11:00:00Z'), decided)).toBe(false);
    expect(isKycEventStale(null, decided)).toBe(false);
    expect(isKycEventStale(new Date(), null)).toBe(false);
  });
});
