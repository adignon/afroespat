import { AnnonceEcran } from '@/screens/services/annonce-ecran';
import { niveauContact } from '@/screens/services/data';

/**
 * S02 — une annonce de logement (`/services/logement/:id`, 10 §2.3).
 *
 * Transcodé de `docs/template/06 Services.dc.html`. Voir `/services/logement/
 * page.tsx` pour le détail du procédé.
 *
 * L'IDENTIFIANT DE ROUTE EST MAINTENANT LU, et c'est tout l'objet de ce lot : il
 * part dans `GET /housing/:id`. Le commentaire précédent disait l'inverse, et
 * disait pourquoi — « le brancher sur `:id` sans API afficherait la même annonce
 * pour tous les identifiants, une promesse que l'écran ne tient pas ». La promesse
 * est tenue.
 *
 * `404` REMONTE TEL QUEL : §6.1 veut qu'une annonce retirée, non publiée ou dont
 * l'auteur est séparé du lecteur soit indiscernable d'une annonce qui n'existe
 * pas. `displayMessageFor` dit « introuvable » dans les quatre cas, ce qui est le
 * but, et `EcranDonnees` l'affiche en `role="alert"`.
 *
 * CETTE PAGE RESTE UN COMPOSANT SERVEUR, et c'est l'écran qui est client : les
 * paramètres d'URL arrivent en propriété, sans `useSearchParams()` — ce crochet
 * force un rendu côté client de la PAGE et le document servi arriverait vide.
 *
 * `?niveau=l0` ouvre l'état L0 de « Contacter » ; voir
 * `@/screens/services/annonce-ecran` pour la raison.
 */
export default async function AnnonceLogementPage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ readonly id: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, requete] = await Promise.all([params, searchParams]);
  return <AnnonceEcran id={id} niveau={niveauContact(requete['niveau'])} />;
}
