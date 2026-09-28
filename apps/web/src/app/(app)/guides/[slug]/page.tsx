import { GuideScreen } from './guide-screen';

/**
 * A04 — la lecture d'un guide. `/guides/:slug`
 *
 * Composant SERVEUR, pour la raison écrite dans `(app)/villes/page.tsx` : lire l'URL
 * en propriété plutôt qu'avec `useSearchParams()`, qui force le rendu client.
 *
 * `?vue=auteur` change la VUE, pas la ressource — c'est le même guide, lu par deux
 * personnes différentes, donc la même URL.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return <GuideScreen auteur={params['vue'] === 'auteur'} />;
}
