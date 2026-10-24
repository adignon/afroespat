import { AnnuaireEcran } from '@/screens/services/annuaire-ecran';

/** S06 — `/services/annuaire` (10 §4.2), recherchée par `?q=`. */
export default async function AnnuaireListePage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const q = (await searchParams)['q'];
  return <AnnuaireEcran recherche={typeof q === 'string' ? q : ''} />;
}
