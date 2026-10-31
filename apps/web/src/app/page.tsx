import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

// Dépend du cookie de la requête : jamais rendue à l'avance, sinon la redirection serait figée.
export const dynamic = 'force-dynamic';

/**
 * La racine. Un visiteur qui n'a jamais ouvert de session (`dp_session`, posé par
 * `lib/api/session.ts`) va droit à la connexion : l'envoyer sur `/accueil` lui montrait
 * le fil quelques instants avant que la garde de session ne le renvoie. L'indicateur n'est
 * qu'un indice d'affichage, il ne vaut aucun droit — s'il est périmé, `/accueil` retombe
 * sur la garde de session comme avant.
 */
export default async function Root() {
  const jar = await cookies();
  redirect(jar.get('dp_session')?.value === '1' ? '/accueil' : '/connexion');
}
