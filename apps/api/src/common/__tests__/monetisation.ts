import {
  BILLING_PAID_OPTIONS_SETTING_KEY,
  BILLING_PAYMENT_METHODS_SETTING_KEY,
  MONETISATION_SETTING_KEY,
  PAID_OPTION_CODES,
  PAYMENT_METHODS_DEFAULT,
} from '@app/shared';

/**
 * Règle « tout gratuit » (lot A) pour les bancs d'intégration.
 *
 * Sans réglage, `monetisation_active` vaut FAUX : tous les membres ont les droits
 * Premium, et les quotas du plan gratuit ne s'appliquent plus. Les bancs qui
 * vérifient CES quotas allument donc les plans en `beforeAll` et rétablissent
 * l'état d'origine (clé absente) en `afterAll`. `actif: null` supprime la clé.
 *
 * LOT D : allumer les plans allume AUSSI les trois moyens de paiement et toutes les options
 * payantes (avantages à quota, offres sponsorisées, encarts) — sans quoi les quotas ne
 * s'appliqueraient pas et le checkout refuserait. Les bancs qui testent l'extinction d'un
 * moyen ou d'une option la règlent eux-mêmes après cet appel.
 */
export async function reglerMonetisation(
  prisma: {
    systemSetting: {
      upsert(args: unknown): Promise<unknown>;
      deleteMany(args: unknown): Promise<unknown>;
    };
    plan?: { updateMany(args: unknown): Promise<unknown> };
  },
  actif: boolean | null,
): Promise<void> {
  if (actif === null) {
    await prisma.systemSetting.deleteMany({
      where: {
        key: {
          in: [MONETISATION_SETTING_KEY, BILLING_PAYMENT_METHODS_SETTING_KEY, BILLING_PAID_OPTIONS_SETTING_KEY],
        },
      },
    });
    return;
  }
  const ecrire = (key: string, value: unknown) =>
    prisma.systemSetting.upsert({ where: { key }, create: { key, value }, update: { value } });
  // Le seed livre les formules payantes éteintes (tout gratuit) : un banc qui teste le payant les allume.
  if (actif && prisma.plan !== undefined) await prisma.plan.updateMany({ data: { isActive: true } });
  await ecrire(MONETISATION_SETTING_KEY, actif);
  await ecrire(
    BILLING_PAYMENT_METHODS_SETTING_KEY,
    PAYMENT_METHODS_DEFAULT.map((m) => ({ ...m, enabled: actif })),
  );
  await ecrire(
    BILLING_PAID_OPTIONS_SETTING_KEY,
    Object.fromEntries(PAID_OPTION_CODES.map((c) => [c, true])),
  );
}
