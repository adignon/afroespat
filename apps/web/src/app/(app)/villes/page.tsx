import { VillesScreen } from './villes-screen';

/**
 * A11 — Villes et Membres. `/villes`
 *
 * Composant SERVEUR : il reçoit les paramètres d'URL en propriété, et n'a donc pas
 * besoin de `useSearchParams()`. Ce détail n'est pas cosmétique, et le dépôt l'a
 * déjà payé une fois (voir `(onboarding)/bienvenue/fin/page.tsx`) : ce crochet force
 * le rendu côté client de tout ce qu'il enveloppe. Sur une page STATIQUE, le HTML
 * envoyé au navigateur est alors VIDE — pas de titre, pas de contenu tant que le
 * JavaScript n'a pas tourné.
 *
 * `?vue=carte|annuaire` et `?pays=<uuid>` : toute autre valeur est ignorée plutôt
 * que transmise au serveur.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const vue = params['vue'];
  const pays = params['pays'];
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return (
    <VillesScreen
      vue={vue === 'carte' || vue === 'annuaire' ? vue : null}
      pays={typeof pays === 'string' && uuid.test(pays) ? pays : ''}
    />
  );
}
