import { ParcoursEcran, type EtatParcours } from './parcours-ecran';

/**
 * `/parcours/:id` — J01, et les états que la maquette dessine autour de lui.
 *
 * Composant SERVEUR : il reçoit les paramètres d'URL en propriété et n'emploie
 * donc pas `useSearchParams()`. Ce crochet force un rendu côté client et fait
 * ÉCHOUER `next build` sans frontière `Suspense` — le serveur de développement,
 * lui, l'accepte sans rien dire (voir `docs/decisions.md`).
 *
 * L'identifiant n'est pas encore lu : la maquette ne dessine qu'un parcours, et
 * en inventer d'autres serait inventer de la donnée. Il est néanmoins dans la
 * route, parce que c'est elle que `T5` fixe et qu'un changement d'URL plus tard
 * casserait les liens.
 */
const ETATS: Record<string, EtatParcours> = {
  vide: 'vide',
  abouti: 'abouti',
  parcours: 'parcours',
  edition: 'edition',
};

export default async function Page({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const demande = params['etat'];
  // Un état inconnu est IGNORÉ plutôt qu'affiché : l'URL est publique, et une
  // valeur fantaisiste ne doit pas casser la page (même règle que les motifs de
  // renvoi de l'onboarding).
  const etat = typeof demande === 'string' ? (ETATS[demande] ?? 'normal') : 'normal';
  return <ParcoursEcran etat={etat} />;
}
