import { notFound } from 'next/navigation';
import { PageStatiqueScreen, type PageStatique } from './page-screen';

/**
 * `/p/:slug` — P03, la page statique. Composant SERVEUR.
 *
 * Le slug arrive en PROPRIÉTÉ, jamais par `useSearchParams()` : ce crochet force
 * un rendu côté client et fait échouer `next build` sans frontière `Suspense`. Le
 * serveur de développement l'accepte sans rien dire, et cinq pages de ce dépôt
 * ont déjà été servies blanches pour cette raison exacte.
 *
 * ── LES SLUGS SONT UNE LISTE FERMÉE ─────────────────────────────────────────
 *
 * L'URL est publique. Un slug inconnu rend `404` au lieu d'afficher une page
 * vide ou, pire, de réfléchir la valeur reçue : `/p/<script>…` ne doit pas faire
 * de cet écran un panneau d'affichage, et c'est la même règle que le `?reprise=`
 * de `/connexion` applique déjà.
 *
 * ── POURQUOI `cgu` N'EST PAS DANS LA TABLE, ALORS QU'IL EXISTE EN BASE ──────
 *
 * `static_pages` porte bien deux lignes publiées, `cgu` et `confidentialite`,
 * mais AUCUNE ROUTE ne les sert (voir `page-screen.tsx`). Le seul document que la
 * maquette dessine est la politique de confidentialité. Brancher `cgu` sur cette
 * planche afficherait donc « Politique de confidentialité » à qui demande les
 * conditions d'utilisation — un document faux, avec son titre et ses pastilles de
 * version, sur un écran que le membre consulte avant d'accepter.
 *
 * Un `404` est honnête ; le mauvais document ne l'est pas. Le slug reviendra avec
 * la route, et c'est elle qu'il faut demander — pas une seconde planche inventée.
 */
const SLUGS: Readonly<Record<string, PageStatique>> = {
  confidentialite: 'document',
  ressources: 'ressources',
};

export default async function Page({
  params,
}: {
  readonly params: Promise<{ readonly slug: string }>;
}) {
  const { slug } = await params;
  const variante = SLUGS[slug];
  if (variante === undefined) notFound();

  return <PageStatiqueScreen variante={variante} />;
}
