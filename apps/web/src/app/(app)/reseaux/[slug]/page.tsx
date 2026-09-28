import { ReseauScreen } from './reseau-screen';

/**
 * A08 et ses onglets. `/reseaux/:slug`
 *
 * Composant SERVEUR, pour la raison écrite dans `(app)/villes/page.tsx`.
 * `?onglet=` choisit la planche A08T, `?vue=proprietaire` bascule en vue
 * propriétaire — deux états du même réseau, donc la même URL.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const onglet = params['onglet'];
  return (
    <ReseauScreen
      onglet={typeof onglet === 'string' ? onglet : 'sujets'}
      owner={params['vue'] === 'proprietaire'}
    />
  );
}
