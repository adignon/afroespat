import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LEGAL_PAGE_SLUGS, pageSlugSchema, staticPagePublicSchema, type StaticPagePublic } from '@app/shared';
import { FournisseurPageLegale } from '@/components/document-legal';
import { API_BASE } from '@/lib/api/base';
import { titrePageStatique } from '@/lib/seo';
import { BientotDisponible } from './bientot-disponible';
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
const estPageLegale = (slug: string): boolean => (LEGAL_PAGE_SLUGS as readonly string[]).includes(slug);

/**
 * Les métadonnées de la page : titre propre (celui du texte publié, sinon celui de la page légale), canonique, partage.
 * Une page légale pas encore publiée est `noindex` ; un slug inconnu n'a pas de métadonnées propres (le 404 les remplace).
 */
export async function generateMetadata({ params }: { readonly params: Promise<{ readonly slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  if (slug === 'ressources') return { title: 'Ressources', alternates: { canonical: '/p/ressources' }, robots: { index: true, follow: true } };
  const valide = pageSlugSchema.safeParse(slug);
  if (!valide.success) return {};

  const reponse = await fetch(`${API_BASE}/pages/${valide.data}`, { cache: 'no-store' }).catch(() => null);
  const publiee = reponse?.ok === true ? staticPagePublicSchema.safeParse(await reponse.json()) : null;
  if (publiee?.success === true) {
    const titre = titrePageStatique(valide.data, publiee.data.title) ?? valide.data;
    return {
      title: titre,
      alternates: { canonical: `/p/${valide.data}` },
      robots: { index: true, follow: true },
      openGraph: { type: 'article', url: `/p/${valide.data}`, title: titre },
      twitter: { card: 'summary', title: titre },
    };
  }
  const titre = estPageLegale(valide.data) ? titrePageStatique(valide.data) : null;
  return titre === null ? {} : { title: titre, robots: { index: false, follow: false } };
}

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
  if (reponse.status === 404) {
    // Une page légale annoncée mais pas encore publiée : un état clair plutôt qu'un 404 trompeur.
    const titre = estPageLegale(valide.data) ? titrePageStatique(valide.data) : null;
    if (titre === null) notFound();
    return <BientotDisponible titre={titre} />;
  }
  if (!reponse.ok) throw new Error(`GET /pages/${valide.data} : ${reponse.status}`);
  const page: StaticPagePublic = staticPagePublicSchema.parse(await reponse.json());

  return (
    <FournisseurPageLegale page={page}>
      <PageStatiqueScreen variante="document" />
    </FournisseurPageLegale>
  );
}
