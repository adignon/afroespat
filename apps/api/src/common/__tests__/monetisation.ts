import { MONETISATION_SETTING_KEY } from '@app/shared';

/**
 * Règle « tout gratuit » (lot A) pour les bancs d'intégration.
 *
 * Sans réglage, `monetisation_active` vaut FAUX : tous les membres ont les droits
 * Premium, et les quotas du plan gratuit ne s'appliquent plus. Les bancs qui
 * vérifient CES quotas allument donc les plans en `beforeAll` et rétablissent
 * l'état d'origine (clé absente) en `afterAll`. `actif: null` supprime la clé.
 */
export async function reglerMonetisation(
  prisma: {
    systemSetting: {
      upsert(args: unknown): Promise<unknown>;
      deleteMany(args: unknown): Promise<unknown>;
    };
  },
  actif: boolean | null,
): Promise<void> {
  if (actif === null) {
    await prisma.systemSetting.deleteMany({ where: { key: MONETISATION_SETTING_KEY } });
    return;
  }
  await prisma.systemSetting.upsert({
    where: { key: MONETISATION_SETTING_KEY },
    create: { key: MONETISATION_SETTING_KEY, value: actif },
    update: { value: actif },
  });
}
