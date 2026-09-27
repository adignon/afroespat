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
  const reason = (await searchParams)['reprise'];
  const message = typeof reason === 'string' ? (RESUME_MESSAGES[reason] ?? null) : null;

  return <ConnexionScreen initialError={message} />;
}
