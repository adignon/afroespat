import { MesParcoursEcran } from './mes-parcours-ecran';

/**
 * `/parcours` — J11, « Mes parcours ».
 *
 * Composant SERVEUR : les paramètres d'URL arrivent en propriété, sans
 * `useSearchParams()` — ce crochet force un rendu côté client et fait échouer
 * `next build` sans frontière `Suspense` (voir `docs/decisions.md`).
 */
export default async function Page({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  // `?etat=vide` : §6, « états communs : sans parcours (invitation) ».
  return <MesParcoursEcran vide={params['etat'] === 'vide'} />;
}
