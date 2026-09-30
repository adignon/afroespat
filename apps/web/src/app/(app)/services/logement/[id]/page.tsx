import { AnnonceEcran } from '@/screens/services/annonce-ecran';
import { niveauContact } from '@/screens/services/data';

/**
 * S02 — une annonce de logement (`/services/logement/:id`, 10 §2.3).
 *
 * Transcodé de `docs/template/06 Services.dc.html`. Voir `/services/logement/
 * page.tsx` pour le détail du procédé.
 *
 * L'identifiant de route n'est pas lu : la maquette montre UNE annonce, écrite en
 * clair. Le brancher sur `:id` sans API afficherait la même annonce pour tous les
 * identifiants — une promesse que l'écran ne tient pas. Le segment existe pour
 * que la route soit celle de la maquette ; il sera lu au branchement de
 * `GET /housing/:id`.
 *
 * Composant SERVEUR : les paramètres d'URL arrivent en propriété, sans
 * `useSearchParams()` — ce crochet force un rendu côté client et la page servie
 * arriverait VIDE, invisible tant qu'on ne lit pas la réponse du serveur.
 *
 * `?niveau=l0` ouvre l'état L0 de « Contacter » ; voir
 * `@/screens/services/annonce-ecran` pour la raison.
 */
export default async function AnnonceLogementPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return <AnnonceEcran niveau={niveauContact(params['niveau'])} />;
}
