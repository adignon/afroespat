import { uuidSchema } from '@app/shared';
import { AnnuaireEcran } from '@/screens/services/annuaire-ecran';

/** S06 — `/services/annuaire` (10 §4.2), recherché par `?q=` et filtré par `?ville=`. */
export default async function AnnuaireListePage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const q = params['q'];
  const ville = params['ville'];
  // Une ville qui n'est pas un identifiant est ignorée : le serveur la refuserait en 400.
  const villeValide = typeof ville === 'string' && uuidSchema.safeParse(ville).success ? ville : '';
  const metier = params['metier'];
  const metierValide = typeof metier === 'string' && uuidSchema.safeParse(metier).success ? metier : '';
  return (
    <AnnuaireEcran
      recherche={typeof q === 'string' ? q : ''}
      ville={villeValide}
      metier={metierValide}
      plus={params['plus'] === '1'}
    />
  );
}
