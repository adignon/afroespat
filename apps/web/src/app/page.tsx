import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { publicLandingSchema, type PublicLanding } from '@app/shared';
import { lirePublic } from '@/lib/api/public';
import { DESCRIPTION_PUBLIQUE, NOM_PUBLIC, jsonLdAccueil, serialiserJsonLd } from '@/lib/seo';
import { LandingPage } from '@/screens/landing/landing-page';

// Dépend du cookie de la requête : jamais rendue à l'avance, sinon la redirection serait figée.
export const dynamic = 'force-dynamic';

const TITRE_ACCUEIL = `${NOM_PUBLIC} — la communauté des diasporas africaines en France`;

/** La page d'accueil est la seule page du site, avec `/p/:slug`, à demander l'indexation. */
export const metadata: Metadata = {
  title: { absolute: TITRE_ACCUEIL },
  description: DESCRIPTION_PUBLIQUE,
  alternates: { canonical: '/' },
  robots: { index: true, follow: true },
  openGraph: { type: 'website', locale: 'fr_FR', siteName: NOM_PUBLIC, url: '/', title: TITRE_ACCUEIL, description: DESCRIPTION_PUBLIQUE },
  twitter: { card: 'summary', title: TITRE_ACCUEIL, description: DESCRIPTION_PUBLIQUE },
};

/** Quand l'API ne répond pas, la page s'affiche quand même — sans chiffre, sans section de données. */
const VIDE: PublicLanding = {
  stats: { members: null, cities: null, countries: null, countryNames: [] },
  entraide: { medianFirstReplyMinutes: null, resolvedPercent: null, publishedGuides: null },
  events: [],
  cities: [],
  places: [],
  quotes: [],
  generatedAt: new Date(0).toISOString(),
};

/**
 * La racine. Un membre qui a déjà ouvert une session (`dp_session`, posé par `lib/api/session.ts`) va droit à
 * `/accueil` ; un visiteur voit la page d'accueil publique. L'indicateur n'est qu'un indice d'affichage, il ne vaut
 * aucun droit — s'il est périmé, `/accueil` retombe sur la garde de session comme avant.
 */
export default async function Root() {
  const jar = await cookies();
  if (jar.get('dp_session')?.value === '1') redirect('/accueil');
  let indisponible = false;
  const landing = await lirePublic('/public/landing', publicLandingSchema, { next: { revalidate: 300 } }).catch(() => {
    indisponible = true;
    return VIDE;
  });
  return (
    <>
      {jsonLdAccueil().map((donnees) => (
        <script key={String(donnees['@type'])} type="application/ld+json" dangerouslySetInnerHTML={{ __html: serialiserJsonLd(donnees) }} />
      ))}
      <LandingPage landing={landing} indisponible={indisponible} />
    </>
  );
}
