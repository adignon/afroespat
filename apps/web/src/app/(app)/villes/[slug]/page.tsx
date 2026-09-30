import { VilleScreen } from './ville-screen';
import { voletContribution } from '@/screens/accueil/data';

/**
 * A12, ses onglets et sa fenêtre de contribution. `/villes/:slug`
 *
 * Composant SERVEUR, pour la raison écrite dans `(app)/villes/page.tsx`.
 *
 * `?contribution=type|produit|budget` ouvre A12C dès l'arrivée — même motif que
 * `?paiement=` sur `/compte/abonnement`.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const onglet = params['onglet'];
  return (
    <VilleScreen
      onglet={typeof onglet === 'string' ? onglet : 'budgets'}
      contribution={voletContribution(params['contribution'])}
    />
  );
}
