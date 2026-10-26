import { RESUME_MESSAGES } from '@/screens/onboarding/resume';
import { ConnexionScreen } from './connexion-screen';

/**
 * Composant SERVEUR : il lit `?reprise=…` en propriété.
 *
 * Pas de `useSearchParams()` — ce crochet force un rendu côté client et fait
 * échouer `next build` sans frontière `Suspense`, ce que le serveur de
 * développement accepte sans rien dire.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parametres = await searchParams;
  const reason = parametres['reprise'];
  const message = typeof reason === 'string' ? (RESUME_MESSAGES[reason] ?? null) : null;
  // `?suppression=<échéance ISO>` : le membre vient de demander la suppression de son compte
  // (K08, lot w5b). La bande l'annonce ; l'écran de connexion reste celui d'un visiteur.
  const suppression = parametres['suppression'];

  return (
    <ConnexionScreen
      initialError={message}
      suppressionPrevue={typeof suppression === 'string' ? suppression : null}
    />
  );
}
