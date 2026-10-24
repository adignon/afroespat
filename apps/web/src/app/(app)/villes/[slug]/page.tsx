import { VilleScreen } from './ville-screen';
import { ongletDeUrl } from '@/screens/villes/onglets';
import { voletContribution } from '@/screens/accueil/data';

/**
 * A12, ses onglets et sa fenêtre de contribution. `/villes/:slug`
 *
 * Composant SERVEUR, pour la raison écrite dans `(app)/villes/page.tsx`.
 *
 * LE SLUG EST LU : il part dans `GET /cities/:slug`. L'ancienne page ignorait
 * `params` et rendait la fiche de « Lyon » pour toute adresse. Une ville
 * inexistante, fusionnée ou inactive répond 404 / `CITY_INACTIVE`, et l'écran
 * l'affiche tel quel.
 *
 * `?onglet=bons-plans|produits|budgets|temoignages` choisit l'onglet (« budgets »
 * par défaut, comme la maquette) ; `?contribution=type|produit|budget` ouvre la
 * fenêtre de contribution dès l'arrivée.
 */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ slug }, requete] = await Promise.all([params, searchParams]);
  const onglet = requete['onglet'];
  return (
    <VilleScreen
      slug={slug}
      onglet={ongletDeUrl(typeof onglet === 'string' ? onglet : null)}
      contribution={voletContribution(requete['contribution'])}
    />
  );
}
