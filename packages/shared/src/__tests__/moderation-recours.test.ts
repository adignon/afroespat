import { describe, expect, it } from 'vitest';
import {
  APPEAL_RESPONSE_HOURS,
  APPEAL_TEXT_MAX,
  APPEAL_TEXT_MIN,
  appealSchema,
  mySanctionsResponseSchema,
} from '../validation/moderation';

/**
 * Le recours (13 §4.3) : les bornes que le formulaire de K09 ET le serveur
 * partagent, et l'état du recours que `GET /me/sanctions` dérive.
 */
describe('recours contre une sanction', () => {
  it('borne le texte de 20 à 1 000 caractères, après trim', () => {
    expect(appealSchema.safeParse({ text: 'x'.repeat(APPEAL_TEXT_MIN - 1) }).success).toBe(false);
    expect(appealSchema.safeParse({ text: `  ${'x'.repeat(APPEAL_TEXT_MIN - 1)}  ` }).success).toBe(false);
    expect(appealSchema.safeParse({ text: 'x'.repeat(APPEAL_TEXT_MIN) }).success).toBe(true);
    expect(appealSchema.safeParse({ text: 'x'.repeat(APPEAL_TEXT_MAX) }).success).toBe(true);
    expect(appealSchema.safeParse({ text: 'x'.repeat(APPEAL_TEXT_MAX + 1) }).success).toBe(false);
    expect(APPEAL_TEXT_MIN).toBe(20);
    expect(APPEAL_TEXT_MAX).toBe(1000);
    expect(APPEAL_RESPONSE_HOURS).toBe(72);
  });

  it('refuse un champ inconnu (le schéma est strict)', () => {
    expect(appealSchema.safeParse({ text: 'x'.repeat(30), sanctionId: 'a' }).success).toBe(false);
  });

  const ligne = {
    id: '01a16f3e-6a7e-7000-ad66-5403becd2ae7',
    type: 'WARNING',
    rule: 'Pas de publicité sans accord',
    startsAt: '2026-10-21T10:00:00.000Z',
    endsAt: null,
    liftedAt: null,
    active: true,
    appealable: true,
  } as const;

  it('exige l’état du recours sur chaque sanction', () => {
    const sans = mySanctionsResponseSchema.safeParse({ items: [ligne], nextCursor: null });
    expect(sans.success).toBe(false);
    for (const appeal of ['NONE', 'PENDING', 'DECIDED']) {
      const ok = mySanctionsResponseSchema.safeParse({ items: [{ ...ligne, appeal }], nextCursor: null });
      expect(ok.success, appeal).toBe(true);
    }
    const inconnu = mySanctionsResponseSchema.safeParse({ items: [{ ...ligne, appeal: 'OPEN' }], nextCursor: null });
    expect(inconnu.success).toBe(false);
  });
});
