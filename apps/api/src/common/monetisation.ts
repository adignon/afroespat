import { MONETISATION_ACTIVE_DEFAULT, MONETISATION_SETTING_KEY, type UserPlan } from '@app/shared';

/**
 * L'interrupteur « TOUT GRATUIT » — voir `MONETISATION_SETTING_KEY` (shared).
 *
 * Des FONCTIONS sur le client Prisma passé (instance ou transaction) plutôt qu'un
 * service injecté : une dizaine de services (événements, parcours, annuaire pro,
 * emploi, logement, partenaires) sont construits à la main dans les bancs
 * d'intégration, et leur ajouter un paramètre de constructeur les aurait tous
 * cassés. Sans état et sans cache : une lecture par clé primaire, aux seuls
 * endroits où un plan est consulté, et un réglage basculé agit à la requête
 * suivante sur toutes les instances.
 */
interface ClientReglages {
  readonly systemSetting: {
    findUnique(args: { where: { key: string }; select: { value: true } }): Promise<{ value: unknown } | null>;
  };
}

/** Vrai quand les plans s'appliquent ; faux (défaut) quand tout est gratuit. */
export async function monetisationActive(db: ClientReglages): Promise<boolean> {
  const ligne = await db.systemSetting.findUnique({
    where: { key: MONETISATION_SETTING_KEY },
    select: { value: true },
  });
  return typeof ligne?.value === 'boolean' ? ligne.value : MONETISATION_ACTIVE_DEFAULT;
}

/**
 * Le plan que les règles doivent LIRE : celui du membre quand les plans
 * s'appliquent, PREMIUM pour tout le monde sinon. `users.plan` reste intact (la
 * facturation le tient) ; seul le contrôle des droits passe par ici.
 */
export async function planEffectif(db: ClientReglages, plan: string): Promise<UserPlan> {
  if (!(await monetisationActive(db))) return 'PREMIUM';
  return plan === 'PREMIUM' ? 'PREMIUM' : 'FREE';
}
