import {
  BILLING_PAID_OPTIONS_SETTING_KEY,
  BILLING_PAYMENT_METHODS_SETTING_KEY,
  MONETISATION_ACTIVE_DEFAULT,
  MONETISATION_SETTING_KEY,
  paidOptionsFrom,
  paymentMethodsFrom,
  type PaidOptionCode,
  type PaymentMethodConfig,
  type UserPlan,
} from '@app/shared';

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
  /** Facultatif : absent d'un client de test minimal, et alors l'activation du plan n'est pas vérifiée. */
  readonly plan?: {
    findUnique(args: { where: { code: 'PREMIUM' }; select: { isActive: true } }): Promise<{ isActive: boolean } | null>;
    count?(args: { where: { isActive: true; code: { in: ('PREMIUM' | 'PRO' | 'PRO_PLUS')[] } } }): Promise<number>;
  };
}

async function lireReglage(db: ClientReglages, key: string): Promise<unknown> {
  const ligne = await db.systemSetting.findUnique({ where: { key }, select: { value: true } });
  return ligne?.value;
}

/** Vrai quand les plans s'appliquent ; faux (défaut) quand tout est gratuit. */
export async function monetisationActive(db: ClientReglages): Promise<boolean> {
  const valeur = await lireReglage(db, MONETISATION_SETTING_KEY);
  return typeof valeur === 'boolean' ? valeur : MONETISATION_ACTIVE_DEFAULT;
}

/** Les moyens de paiement effectifs (tous éteints tant que l'équipe n'en a allumé aucun). */
export async function moyensDePaiement(db: ClientReglages): Promise<PaymentMethodConfig[]> {
  return paymentMethodsFrom(await lireReglage(db, BILLING_PAYMENT_METHODS_SETTING_KEY));
}

/** Une option payante est-elle allumée ? */
export async function optionPayanteActive(db: ClientReglages, option: PaidOptionCode): Promise<boolean> {
  return paidOptionsFrom(await lireReglage(db, BILLING_PAID_OPTIONS_SETTING_KEY))[option];
}

/**
 * Le plan Premium est-il proposé ? Une ligne absente (table non amorcée) ou un client sans
 * `plan` ne coupe rien : seule une désactivation EXPLICITE (`is_active = false`) compte.
 */
export async function premiumPropose(db: ClientReglages): Promise<boolean> {
  if (db.plan === undefined) return true;
  const ligne = await db.plan.findUnique({ where: { code: 'PREMIUM' }, select: { isActive: true } });
  return ligne === null ? true : ligne.isActive;
}

/**
 * Peut-on payer aujourd'hui ? Monétisation allumée, au moins un moyen de paiement allumé ET
 * au moins une formule payante proposée. C'est le `paiementsDisponibles` que les écrans
 * lisent (`GET /me`, `GET /me/subscription`) : faux, aucun écran ne propose de payer.
 */
export async function paiementsDisponibles(db: ClientReglages): Promise<boolean> {
  if (!(await monetisationActive(db))) return false;
  if (!(await moyensDePaiement(db)).some((m) => m.enabled)) return false;
  if (db.plan?.count === undefined) return false;
  const proposes = await db.plan.count({ where: { isActive: true, code: { in: ['PREMIUM', 'PRO', 'PRO_PLUS'] } } });
  return proposes > 0;
}

/**
 * Les limites d'un plan s'appliquent-elles, pour cette option ? Il faut que la monétisation
 * soit allumée, que le plan Premium soit proposé ET que l'option soit allumée : une offre
 * qu'on ne peut pas acheter ne peut pas non plus servir à rationner.
 */
export async function quotasApplicables(
  db: ClientReglages,
  option: PaidOptionCode = 'PREMIUM_PERKS',
): Promise<boolean> {
  if (!(await monetisationActive(db))) return false;
  if (!(await optionPayanteActive(db, option))) return false;
  return premiumPropose(db);
}

/**
 * Le plan que les règles doivent LIRE : celui du membre quand les limites s'appliquent,
 * PREMIUM pour tout le monde sinon. `users.plan` reste intact (la facturation le tient) ;
 * seul le contrôle des droits passe par ici.
 */
export async function planEffectif(
  db: ClientReglages,
  plan: string,
  option: PaidOptionCode = 'PREMIUM_PERKS',
): Promise<UserPlan> {
  if (!(await quotasApplicables(db, option))) return 'PREMIUM';
  return plan === 'PREMIUM' ? 'PREMIUM' : 'FREE';
}
