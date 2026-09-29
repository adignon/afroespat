import { ScreenFrames } from '@/screens/frames';
import { D14Desktop } from '@/screens/d14/desktop.generated';

/**
 * D14 — abonnements et revenus. `/admin/revenus` (T5 D14, 15 §5.1 bloc Revenus).
 *
 * MRR, part Mobile Money, affiliation du mois, puis les plans (EUR / XOF) et la
 * liste des abonnés avec leur statut, leur fournisseur et leurs échecs.
 *
 * LES PLANS SONT MARQUÉS « SUPER-ADMIN » PAR LA MAQUETTE, et c'est la table de
 * rôles de 15 §2.2 : « prix, plans, paramètres de paiement → SUPER_ADMIN »
 * seulement. L'écran affiche la contrainte ; le garde de rôle côté API la tient.
 *
 * Aucun rouge sur l'abonné « Impayé » ni sur le « Remboursé » : la règle dure de
 * 00 §1.2 vaut aussi dans l'administration, et la maquette s'y tient.
 */
export default function Page() {
  return <ScreenFrames screen="D14" desktop={<D14Desktop />} />;
}
