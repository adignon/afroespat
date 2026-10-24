import { PublierLogementEcran } from '@/screens/services/publier-logement-ecran';

/** S03 — `/services/logement/nouveau` (10 §2.1) ; `?modifier=<id>` ouvre la modification. */
export default async function PublierLogementPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const modifier = (await searchParams)['modifier'];
  return <PublierLogementEcran modifier={typeof modifier === 'string' && modifier !== '' ? modifier : null} />;
}
