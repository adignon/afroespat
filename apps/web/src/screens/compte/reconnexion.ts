import { ApiError } from '@/lib/api/index';
import { adresseConnexion } from '@/lib/suite-connexion';

/**
 * « SE RECONNECTER » N'EST LA BONNE ACTION QUE POUR UN 401.
 *
 * Un `403` ne dit pas « votre session est finie » : il dit « vous n'avez pas le droit ».
 * `LEVEL_REQUIRED` (niveau de confiance insuffisant) ou un refus d'accès à un contenu :
 * se reconnecter ne change rien, et le lien renverrait le membre en boucle. Seul le `401`
 * propose donc la reconnexion ; le `403` garde la phrase du serveur (déjà adaptée).
 */
export function proposeReconnexion(erreur: unknown): boolean {
  return erreur instanceof ApiError && erreur.status === 401;
}

/** `/connexion?suite=<écran courant>` : la connexion ramène le membre là où il était. */
export function adresseReconnexion(): string {
  if (typeof window === 'undefined') return '/connexion';
  return adresseConnexion(`${window.location.pathname}${window.location.search}`);
}
