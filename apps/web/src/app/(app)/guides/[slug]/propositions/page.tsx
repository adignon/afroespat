import { PropositionsScreen } from './propositions-screen';

/**
 * A06 · planche 2 — « Propositions reçues » de l'auteur. `/guides/:slug/propositions`
 *
 * C'est la page où l'auteur d'un guide accepte ou refuse les corrections proposées
 * par les membres. La planche 1 de la même section est la feuille de proposition
 * elle-même : voir `/guides/:slug/corriger`.
 *
 * Composant SERVEUR, pour la raison écrite dans `(app)/guides/[slug]/page.tsx` :
 * lire l'URL en propriété plutôt qu'avec `useSearchParams()`, qui force le rendu
 * client. LE SLUG EST PASSÉ AU COMPOSANT — sans lui, la page affichait les
 * propositions de la maquette quelle que soit l'adresse demandée.
 */
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <PropositionsScreen slug={slug} />;
}
