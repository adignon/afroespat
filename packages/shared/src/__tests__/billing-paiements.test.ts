import { describe, expect, it } from 'vitest';
import {
  BILLING_ERROR_CODES,
  PAID_OPTIONS_DEFAULT,
  PAYMENT_METHODS_DEFAULT,
  SETTINGS_REGISTRY,
  mySubscriptionResponseSchema,
  paidOptionsFrom,
  paidOptionsUpdateSchema,
  paymentMethodCodeOf,
  paymentMethodsFrom,
  paymentMethodsUpdateSchema,
  planEnabledSchema,
  planUpdateRouteSchema,
} from '../index.js';

/**
 * Lot D — moyens de paiement et options payantes : configuration éteinte par défaut, motif
 * obligatoire sur chaque écriture, refus de checkout nommés.
 */
describe('moyens de paiement (lot D)', () => {
  it('tout est éteint par défaut : « tout est gratuit »', () => {
    const methods = paymentMethodsFrom(undefined);
    expect(methods.map((m) => m.code)).toEqual(['CARD', 'MOBILE_MONEY_MTN', 'MOBILE_MONEY_MOOV']);
    expect(methods.every((m) => !m.enabled)).toBe(true);
    expect(PAYMENT_METHODS_DEFAULT.every((m) => !m.enabled)).toBe(true);
  });

  it('une valeur illisible retombe sur « tout éteint » plutôt que sur « tout allumé »', () => {
    expect(paymentMethodsFrom('texte').every((m) => !m.enabled)).toBe(true);
    expect(paymentMethodsFrom([{ code: 'CARD', enabled: 'oui' }]).every((m) => !m.enabled)).toBe(true);
  });

  it('un moyen absent du réglage apparaît éteint, jamais manquant', () => {
    const methods = paymentMethodsFrom([{ code: 'CARD', enabled: true, label: 'Carte', currencies: ['EUR'] }]);
    expect(methods).toHaveLength(3);
    expect(methods.find((m) => m.code === 'CARD')?.enabled).toBe(true);
    expect(methods.find((m) => m.code === 'MOBILE_MONEY_MOOV')?.enabled).toBe(false);
  });

  it('le moyen du checkout se déduit du canal et de l’opérateur', () => {
    expect(paymentMethodCodeOf({ provider: 'STRIPE' })).toBe('CARD');
    expect(paymentMethodCodeOf({ provider: 'MOBILE_MONEY', method: 'MTN_MOMO' })).toBe('MOBILE_MONEY_MTN');
    expect(paymentMethodCodeOf({ provider: 'MOBILE_MONEY', method: 'MOOV_MONEY' })).toBe('MOBILE_MONEY_MOOV');
  });

  it('les options : défauts, complétion champ par champ, valeurs illisibles ignorées', () => {
    expect(paidOptionsFrom(undefined)).toEqual(PAID_OPTIONS_DEFAULT);
    expect(PAID_OPTIONS_DEFAULT.PREMIUM_PERKS).toBe(false);
    expect(PAID_OPTIONS_DEFAULT.SPONSORED_JOBS).toBe(false);
    expect(paidOptionsFrom({ PREMIUM_PERKS: true, SPONSORED_JOBS: 'x' })).toEqual({
      ...PAID_OPTIONS_DEFAULT,
      PREMIUM_PERKS: true,
    });
  });

  it('chaque écriture exige un motif de 10 caractères', () => {
    const motif = '0123456789';
    expect(paymentMethodsUpdateSchema.safeParse({ methods: [{ code: 'CARD', enabled: true }] }).success).toBe(false);
    expect(paymentMethodsUpdateSchema.safeParse({ methods: [{ code: 'CARD', enabled: true }], reason: 'court' }).success).toBe(false);
    expect(paymentMethodsUpdateSchema.safeParse({ methods: [{ code: 'CARD', enabled: true }], reason: motif }).success).toBe(true);
    expect(paidOptionsUpdateSchema.safeParse({ options: { SPONSORED_JOBS: true } }).success).toBe(false);
    expect(paidOptionsUpdateSchema.safeParse({ options: {}, reason: motif }).success).toBe(false);
    expect(planEnabledSchema.safeParse({ isActive: false }).success).toBe(false);
    expect(planUpdateRouteSchema.safeParse({ priceCents: 500 }).success).toBe(false);
    expect(planUpdateRouteSchema.safeParse({ priceCents: 500, yearPriceCents: 5000, reason: motif }).success).toBe(true);
    expect(planUpdateRouteSchema.safeParse({ reason: motif }).success).toBe(false);
  });

  it('un moyen inconnu ou une clé en trop est refusé', () => {
    const reason = 'un motif valable';
    expect(paymentMethodsUpdateSchema.safeParse({ methods: [{ code: 'PAYPAL', enabled: true }], reason }).success).toBe(false);
    expect(paymentMethodsUpdateSchema.safeParse({ methods: [{ code: 'CARD', cvc: '123' }], reason }).success).toBe(false);
  });

  it('les deux réglages sont au registre, réservés au SUPER_ADMIN', () => {
    expect(SETTINGS_REGISTRY['billing.payment_methods'].role).toEqual(['SUPER_ADMIN']);
    expect(SETTINGS_REGISTRY['billing.paid_options'].role).toEqual(['SUPER_ADMIN']);
  });

  it('les refus de checkout ont leurs codes (409)', () => {
    expect(BILLING_ERROR_CODES.PAYMENTS_DISABLED).toBe(409);
    expect(BILLING_ERROR_CODES.PLAN_DISABLED).toBe(409);
    expect(BILLING_ERROR_CODES.PAYMENT_METHOD_DISABLED).toBe(409);
  });

  it('GET /me/subscription porte paiementsDisponibles et la liste des moyens', () => {
    const base = {
      paiementsDisponibles: false,
      moyensPaiement: [],
      items: [],
      history: [],
      trial: { used: false, active: false, endsAt: null },
      usage: {
        periodKey: '2026-11',
        resetsAt: '2026-12-01T00:00:00.000Z',
        items: [{ metric: 'SPONSORED_JOBS', used: 0, limit: 5 }],
      },
    };
    expect(mySubscriptionResponseSchema.safeParse(base).success).toBe(true);
    const { paiementsDisponibles, ...sans } = base;
    expect(paiementsDisponibles).toBe(false);
    expect(mySubscriptionResponseSchema.safeParse(sans).success).toBe(false);
  });
});
