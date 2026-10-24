import { EmploiListeEcran } from '@/screens/services/emploi-liste-ecran';
import type { OngletEmploi } from '@/screens/s04/data';

/** Les trois onglets de S04, par `?onglet=` ; tout autre valeur retombe sur « Offres ». */
function ongletDe(valeur: string | string[] | undefined): OngletEmploi {
  return valeur === 'profils' || valeur === 'recherche' ? valeur : 'offres';
}

/** S04 — `/services/emploi` (10 §3.1, §3.2), onglet choisi par `?onglet=profils|recherche`. */
export default async function EmploiListePage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return <EmploiListeEcran onglet={ongletDe(params['onglet'])} />;
}
