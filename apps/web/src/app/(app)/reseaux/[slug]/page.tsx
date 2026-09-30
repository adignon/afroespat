import { ReseauScreen } from './reseau-screen';

/**
 * A08 et ses onglets. `/reseaux/:slug`
 *
 * Composant SERVEUR, pour la raison écrite dans `(app)/villes/page.tsx`.
 * `?onglet=` choisit la planche A08T, `?vue=proprietaire` bascule en vue
 * propriétaire — deux états du même réseau, donc la même URL.
 *
 * Le `slug` de la route descend jusqu'au client : c'est lui qui identifie le
 * réseau auprès de l'API. La fiche accepte indifféremment un slug ou un
 * identifiant (`load()` normalise), donc on passe ce que l'URL porte.
 */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ readonly slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const onglet = query['onglet'];
  return (
    <ReseauScreen
      slug={slug}
      onglet={typeof onglet === 'string' ? onglet : 'sujets'}
      owner={query['vue'] === 'proprietaire'}
    />
  );
}
