import { ListeLogementEcran } from '@/screens/services/liste-logement-ecran';
import { filtreLogement } from '@/screens/services/navigation';

/** S01 — `/services/logement` (10 §2.1), filtrée par `?kind=`. */
export default async function LogementListePage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const requete = await searchParams;
  return <ListeLogementEcran kind={filtreLogement(requete['kind'])} />;
}
