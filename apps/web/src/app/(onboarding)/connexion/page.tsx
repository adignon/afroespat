import { RESUME_MESSAGES } from '@/screens/onboarding/resume';
import { suiteValide } from '@/lib/suite-connexion';
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
  // `?suite=<chemin>` : l'écran que le membre voulait avant d'être renvoyé ici. Validé comme
  // CHEMIN INTERNE avant tout usage (redirection ouverte) — voir `lib/suite-connexion`.
  const suite = parametres['suite'];

  return (
    <ConnexionScreen
      initialError={message}
      suppressionPrevue={typeof suppression === 'string' ? suppression : null}
      suite={suiteValide(typeof suite === 'string' ? suite : null)}
    />
  );
}
