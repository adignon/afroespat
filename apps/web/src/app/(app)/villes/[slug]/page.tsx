import { VilleScreen } from './ville-screen';

/**
 * A12 et ses onglets. `/villes/:slug`
 *
 * Composant SERVEUR, pour la raison écrite dans `(app)/villes/page.tsx`.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const onglet = params['onglet'];
  return <VilleScreen onglet={typeof onglet === 'string' ? onglet : 'budgets'} />;
}
