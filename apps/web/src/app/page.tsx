import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { publicLandingSchema, type PublicLanding } from '@app/shared';
import { lirePublic } from '@/lib/api/public';
import { LandingPage } from '@/screens/landing/landing-page';

// Dépend du cookie de la requête : jamais rendue à l'avance, sinon la redirection serait figée.
export const dynamic = 'force-dynamic';

/** Quand l'API ne répond pas, la page s'affiche quand même — sans chiffre, sans section de données. */
const VIDE: PublicLanding = {
  stats: { members: null, cities: null, countries: null, countryNames: [] },
  entraide: { medianFirstReplyMinutes: null, resolvedPercent: null, publishedGuides: null },
  events: [],
  cities: [],
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
  const landing = await lirePublic('/public/landing', publicLandingSchema, { next: { revalidate: 300 } }).catch(() => VIDE);
  return <LandingPage landing={landing} />;
}
