import { GuideScreen } from '../../guide-screen';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ A04 — UNE PAGE D'UN GUIDE. `/guides/:slug/p/:pageSlug`                     ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « Un guide peut avoir plusieurs pages. »
 *
 * ── POURQUOI LA PREMIÈRE PAGE N'EST PAS ICI ─────────────────────────────────
 *
 * `/guides/:slug` MÈNE À LA PREMIÈRE PAGE, et ce n'est pas une commodité : §2.1
 * fige le slug d'un guide à la publication — « jamais modifié » — pour qu'un lien
 * partagé dans une conversation continue de fonctionner, et le serveur rend la
 * première page quand `?page=` est absent. Donner une adresse `/p/<slug>` à la
 * première page aurait créé DEUX adresses pour un même contenu, dont une seule
 * circule : tous les liens reçus avant les pages auraient pointé vers l'autre.
 *
 * ── POURQUOI LE SEGMENT EST `/p/` ───────────────────────────────────────────
 *
 * Par ÉLIMINATION, pas par goût. `/guides/:slug/corriger` et
 * `/guides/:slug/propositions` existent déjà sous ce même `[slug]`, donc une page
 * dont le slug serait « corriger » volerait l'adresse du panneau de correction —
 * et rien n'empêche un auteur d'intituler une page « Corriger mon dossier ». Un
 * segment de CLASSE s'interpose, et il ne peut collisionner avec aucun slug
 * puisqu'il n'est pas un nom de page.
 *
 * ── COMPOSANT SERVEUR, COMME SON VOISIN ─────────────────────────────────────
 *
 * Même raison qu'`(app)/villes/page.tsx` : lire l'URL en propriété plutôt
 * qu'avec `useSearchParams()`, qui force le rendu client — cinq pages de ce projet
 * ont déjà été servies VIDES pour cette raison. `?vue=auteur` change la VUE, pas
 * la ressource, donc il reste un paramètre de requête ici aussi.
 */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; pageSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ slug, pageSlug }, query] = await Promise.all([params, searchParams]);
  return <GuideScreen slug={slug} pageSlug={pageSlug} auteur={query['vue'] === 'auteur'} />;
}
