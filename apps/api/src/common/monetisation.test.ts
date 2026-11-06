import { describe, expect, it } from 'vitest';
import {
  BILLING_PAID_OPTIONS_SETTING_KEY,
  BILLING_PAYMENT_METHODS_SETTING_KEY,
  MONETISATION_SETTING_KEY,
} from '@app/shared';
import { moyensDePaiement, planEffectif, quotasApplicables } from './monetisation';

/** Un client minimal : des réglages et, facultativement, l'état du plan Premium. */
function client(reglages: Record<string, unknown>, premiumActif?: boolean) {
  return {
    systemSetting: {
      findUnique: ({ where }: { where: { key: string } }) =>
        Promise.resolve(where.key in reglages ? { value: reglages[where.key] } : null),
    },
    ...(premiumActif === undefined
      ? {}
      : { plan: { findUnique: () => Promise.resolve({ isActive: premiumActif }) } }),
  };
}

const TOUT_ALLUME = {
  [MONETISATION_SETTING_KEY]: true,
  [BILLING_PAID_OPTIONS_SETTING_KEY]: { SPONSORED_JOBS: true, PARTNER_PLACEMENTS: true, PREMIUM_PERKS: true },
};

describe('quotas : monétisation, plan et option (lot D)', () => {
  it('sans réglage : tout est gratuit, tout le monde a les droits Premium', async () => {
    const db = client({});
    expect(await quotasApplicables(db)).toBe(false);
    expect(await planEffectif(db, 'FREE')).toBe('PREMIUM');
  });

  it('monétisation allumée mais option éteinte : les quotas ne s’appliquent pas', async () => {
    const db = client({ [MONETISATION_SETTING_KEY]: true });
    expect(await quotasApplicables(db, 'PREMIUM_PERKS')).toBe(false);
    expect(await planEffectif(db, 'FREE')).toBe('PREMIUM');
  });

  it('monétisation + option allumées : le plan du membre s’applique', async () => {
    const db = client(TOUT_ALLUME, true);
    expect(await planEffectif(db, 'FREE')).toBe('FREE');
    expect(await planEffectif(db, 'PREMIUM')).toBe('PREMIUM');
  });

  it('plan Premium désactivé : on ne rationne pas avec une offre qu’on ne peut pas acheter', async () => {
    const db = client(TOUT_ALLUME, false);
    expect(await quotasApplicables(db)).toBe(false);
    expect(await planEffectif(db, 'FREE')).toBe('PREMIUM');
  });

  it('les offres sponsorisées ont leur propre option', async () => {
    const db = client({
      ...TOUT_ALLUME,
      [BILLING_PAID_OPTIONS_SETTING_KEY]: { SPONSORED_JOBS: false, PARTNER_PLACEMENTS: true, PREMIUM_PERKS: true },
    });
    expect(await planEffectif(db, 'FREE', 'SPONSORED_JOBS')).toBe('PREMIUM');
    expect(await planEffectif(db, 'FREE', 'PREMIUM_PERKS')).toBe('FREE');
  });

  it('les moyens de paiement sont tous éteints tant que l’équipe n’en a pas allumé', async () => {
    expect((await moyensDePaiement(client({}))).some((m) => m.enabled)).toBe(false);
    const db = client({
      [BILLING_PAYMENT_METHODS_SETTING_KEY]: [
        { code: 'MOBILE_MONEY_MTN', enabled: true, label: 'MTN', currencies: ['XOF'] },
      ],
    });
    const actifs = (await moyensDePaiement(db)).filter((m) => m.enabled).map((m) => m.code);
    expect(actifs).toEqual(['MOBILE_MONEY_MTN']);
  });
});
