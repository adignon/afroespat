import { NouveauEcran, type EtapeCreation } from './nouveau-ecran';

/** `/parcours/nouveau` — J02, et ses trois planches mobiles. */
const ETAPES: Record<string, EtapeCreation> = {
  regulariser: 'regulariser',
  plan: 'plan',
};

export default async function Page({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const demande = params['etape'];
  // Une valeur inconnue retombe sur le choix du type : l'URL est publique, et
  // une valeur fantaisiste ne doit pas casser la page.
  const etape = typeof demande === 'string' ? (ETAPES[demande] ?? 'type') : 'type';
  return <NouveauEcran etape={etape} />;
}
