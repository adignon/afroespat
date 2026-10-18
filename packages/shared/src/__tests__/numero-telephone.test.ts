import { describe, expect, it } from 'vitest';
import {
  analyserNumero,
  enFormatInternational,
  formaterSaisieNumero,
  messageRefusNumero,
  numeroValide,
} from '../validation/referentials.js';
import { AUTH_ERROR_MESSAGES } from '../validation/auth.js';

/**
 * Lot A — le numéro doit appartenir au pays choisi et être un mobile.
 *
 * Le contournement mesuré : `+2290190000000` saisi avec « FR » était accepté et
 * comptait comme destination française (niveau L2 sans numéro de destination).
 */
describe('analyserNumero', () => {
  it('refuse un numéro béninois international saisi avec la France', () => {
    expect(analyserNumero('+2290190000000', 'FR')).toEqual({
      ok: false,
      code: 'PHONE_COUNTRY_MISMATCH',
    });
    expect(numeroValide('+2290190000000', 'FR')).toBe(false);
    expect(enFormatInternational('+2290190000000', 'FR')).toBeNull();
  });

  it('refuse un numéro français saisi avec le Bénin', () => {
    expect(analyserNumero('+33612345678', 'BJ').ok).toBe(false);
  });

  it('accepte un mobile national ou international du bon pays', () => {
    expect(analyserNumero('06 12 34 56 78', 'FR')).toEqual({ ok: true, e164: '+33612345678' });
    expect(analyserNumero('+33 6 12 34 56 78', 'FR')).toEqual({ ok: true, e164: '+33612345678' });
    expect(analyserNumero('0190000000', 'BJ')).toEqual({ ok: true, e164: '+2290190000000' });
  });

  it('refuse une ligne fixe (aucun SMS ne peut y arriver)', () => {
    expect(analyserNumero('01 45 67 89 01', 'FR')).toEqual({
      ok: false,
      code: 'PHONE_NOT_MOBILE',
    });
  });

  it('accepte FIXED_LINE_OR_MOBILE (plan nord-américain)', () => {
    expect(analyserNumero('202 555 0123', 'US').ok).toBe(true);
  });

  it('refuse un numéro mal formé', () => {
    expect(analyserNumero('12345', 'FR')).toEqual({ ok: false, code: 'PHONE_INVALID' });
  });

  it('le message de l’écran est celui du serveur', () => {
    expect(messageRefusNumero('PHONE_COUNTRY_MISMATCH')).toBe(
      AUTH_ERROR_MESSAGES.PHONE_COUNTRY_MISMATCH,
    );
    expect(messageRefusNumero('PHONE_NOT_MOBILE')).toBe(AUTH_ERROR_MESSAGES.PHONE_NOT_MOBILE);
  });
});

describe('formaterSaisieNumero', () => {
  it('met en forme à la frappe et retire ce qui n’est pas un numéro', () => {
    expect(formaterSaisieNumero('0612345678', 'FR')).toBe('06 12 34 56 78');
    expect(formaterSaisieNumero('06abc12', 'FR')).toBe('06 12');
    expect(formaterSaisieNumero('+33612', 'FR').startsWith('+33')).toBe(true);
  });
});
