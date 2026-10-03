import { CorrigerScreen } from './corriger-screen';

/**
 * A06 · planche 1 — proposer une correction. `/guides/:slug/corriger`
 *
 * Composant SERVEUR, pour la raison écrite dans `(app)/guides/[slug]/page.tsx`.
 * LE SLUG EST PASSÉ AU COMPOSANT : c'est lui qui nomme le guide que la feuille
 * vise, et sans lui la feuille annonçait le guide de la maquette.
 */
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <CorrigerScreen slug={slug} />;
}
