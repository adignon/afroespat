import { GuideScreen } from './guide-screen';

/**
 * A04 — la lecture d'un guide. `/guides/:slug`
 *
 * Composant SERVEUR, pour la raison écrite dans `(app)/villes/page.tsx` : lire
 * l'URL en propriété plutôt qu'avec `useSearchParams()`, qui force le rendu
 * client — cinq pages de ce projet ont déjà été servies VIDES pour cette raison.
 *
 * `?vue=auteur` change la VUE, pas la ressource — c'est le même guide, lu par
 * deux personnes différentes, donc la même URL.
 *
 * ── CETTE ADRESSE EST CELLE DE LA PREMIÈRE PAGE, ET ELLE LE RESTE ───────────
 *
 * Depuis que les guides ont des pages, `pageSlug` est OMIS ici : c'est le SERVEUR
 * qui choisit la première page quand `?page=` est absent, et c'est ce qui garantit
 * que tous les liens partagés avant la fonctionnalité continuent d'ouvrir le
 * guide. Les autres pages vivent sous `p/[pageSlug]/page.tsx`, à côté.
 *
 * LE SLUG EST PASSÉ AU COMPOSANT, ce qu'il n'était pas : la page affichait le
 * guide de la maquette quelle que soit l'adresse demandée. C'est LUI la clé de
 * lecture, et §2.1 le fige à la publication — « jamais modifié » — précisément
 * pour qu'un lien partagé dans une conversation continue de fonctionner.
 */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  return <GuideScreen slug={slug} auteur={query['vue'] === 'auteur'} />;
}
