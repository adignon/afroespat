import { notFound } from 'next/navigation';
import { pageSlugSchema, staticPagePublicSchema, type StaticPagePublic } from '@app/shared';
import { FournisseurPageLegale } from '@/components/document-legal';
import { API_BASE } from '@/lib/api/base';
import { PageStatiqueScreen } from './page-screen';

/**
 * `/p/:slug` — P03, la page statique. Composant SERVEUR.
 *
 * Le slug arrive en PROPRIÉTÉ, jamais par `useSearchParams()` : ce crochet force un rendu
 * côté client et fait échouer `next build` sans frontière `Suspense`.
 *
 * ── LA PAGE VIENT DE L'API, PLUS D'UNE LISTE FERMÉE ──────────────────────────
 *
 * Avant ce lot, `SLUGS` était une liste de deux entrées : `/p/cgu` rendait 404 faute de
 * route, et la politique de confidentialité était le texte de la maquette, « Version 3 »
 * alors que la base disait 0. Le serveur lit maintenant `GET /pages/:slug` — la version EN
 * VIGUEUR de `static_pages`, publiée depuis l'administration (D12) :
 *
 *   · un slug inconnu, ou jamais publié, rend un VRAI `404` (l'API répond 404, le
 *     serveur appelle `notFound()`) — l'URL est publique, rien n'est réfléchi ;
 *   · `ressources` garde la planche de la maquette (liste de ressources, 560 px) : c'est
 *     une page de liens, pas un document, et elle n'est pas dans `static_pages`.
 *
 * Le texte part dans la PREMIÈRE réponse HTML (pas d'état de chargement) : c'est un
 * document juridique, et un moteur de recherche ou un lecteur d'écran doit le voir.
 */
export default async function Page({
  params,
}: {
  readonly params: Promise<{ readonly slug: string }>;
}) {
  const { slug } = await params;
  if (slug === 'ressources') return <PageStatiqueScreen variante="ressources" />;

  const valide = pageSlugSchema.safeParse(slug);
  if (!valide.success) notFound();

  const reponse = await fetch(`${API_BASE}/pages/${valide.data}`, { cache: 'no-store' });
  if (reponse.status === 404) notFound();
  if (!reponse.ok) throw new Error(`GET /pages/${valide.data} : ${reponse.status}`);
  const page: StaticPagePublic = staticPagePublicSchema.parse(await reponse.json());

  return (
    <FournisseurPageLegale page={page}>
      <PageStatiqueScreen variante="document" />
    </FournisseurPageLegale>
  );
}
