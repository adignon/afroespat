import { NouvelEvenementEcran } from './nouveau-ecran';

/**
 * E03 — Créer (ou modifier) un événement (`/agenda/nouveau`, 09 §3.1).
 *
 * Composant SERVEUR qui délègue à l'écran client : `?modifier=<id>` arrive en
 * propriété, sans `useSearchParams()` (ce crochet forcerait le rendu client de la
 * page entière et le HTML servi arriverait vide — voir `(app)/villes/page.tsx`).
 * Le détail du procédé et des règles est dans `nouveau-ecran.tsx`.
 */
export default async function NewEventPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const modifier = params['modifier'];
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return (
    <NouvelEvenementEcran
      modifier={typeof modifier === 'string' && uuid.test(modifier) ? modifier : null}
    />
  );
}
