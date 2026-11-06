import { describe, expect, it } from 'vitest';
import { ADMIN_CONTENT_CAPACITES, ADMIN_CONTENT_EDIT_FIELDS, ADMIN_CONTENT_TYPES, validateAdminContentChanges } from '../validation/admin-content.js';

describe('validateAdminContentChanges', () => {
  it('un type est modifiable si et seulement si il déclare des champs', () => {
    for (const type of ADMIN_CONTENT_TYPES) {
      expect(ADMIN_CONTENT_CAPACITES[type].modifier).toBe(ADMIN_CONTENT_EDIT_FIELDS[type].length > 0);
    }
  });

  it('un type sans champ refuse toute modification', () => {
    expect(validateAdminContentChanges('LANGUAGE', { nameFr: 'x' })).toMatchObject({ ok: false });
  });

  it('accepte un titre et le rogne', () => {
    const r = validateAdminContentChanges('GUIDE', { title: '  Ouvrir un compte  ' });
    expect(r).toEqual({ ok: true, data: { title: 'Ouvrir un compte' } });
  });

  it('refuse un champ qui ne se modifie pas', () => {
    const r = validateAdminContentChanges('EVENT', { organizerUserId: 'x' });
    expect(r).toMatchObject({ ok: false, field: 'organizerUserId' });
  });

  it('refuse de vider un champ obligatoire, accepte de vider un champ facultatif', () => {
    expect(validateAdminContentChanges('EVENT', { title: '' })).toMatchObject({ ok: false, field: 'title' });
    expect(validateAdminContentChanges('EVENT', { venueName: null })).toEqual({ ok: true, data: { venueName: null } });
  });

  it('borne la longueur, les nombres, les listes et les dates', () => {
    expect(validateAdminContentChanges('POST', { body: 'x'.repeat(5001) })).toMatchObject({ ok: false });
    expect(validateAdminContentChanges('EVENT', { capacity: -3 })).toMatchObject({ ok: false });
    expect(validateAdminContentChanges('EVENT', { status: 'INCONNU' })).toMatchObject({ ok: false });
    expect(validateAdminContentChanges('EVENT', { startsAt: 'pas une date' })).toMatchObject({ ok: false });
    const ok = validateAdminContentChanges('EVENT', { startsAt: '2026-12-01T18:30:00.000Z', status: 'CANCELLED' });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.data['startsAt']).toBeInstanceOf(Date);
  });
});
