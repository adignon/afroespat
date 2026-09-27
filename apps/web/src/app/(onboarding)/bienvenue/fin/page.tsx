import { FinScreen } from './fin-screen';

/**
 * O05 — l'atterrissage, écran 6 de §5.
 *
 * Composant SERVEUR : il reçoit les paramètres d'URL en propriété, et n'a donc
 * pas besoin de `useSearchParams()`. Ce détail n'est pas cosmétique — ce crochet
 * force un rendu côté client, et la compilation de production échoue sans
 * frontière `Suspense`. Le serveur de développement, lui, l'accepte sans rien
 * dire : le défaut n'apparaît qu'au `next build`.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  // `?parcours=non` montre la seconde variante. Elle dépendra du choix fait à
  // l'écran O03 quand le parcours sera réellement créé (module 03).
  return <FinScreen withJourney={params['parcours'] !== 'non'} />;
}
