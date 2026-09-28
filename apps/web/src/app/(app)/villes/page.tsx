import { VillesScreen } from './villes-screen';

/**
 * A11 — Villes et Membres. `/villes`
 *
 * Composant SERVEUR : il reçoit les paramètres d'URL en propriété, et n'a donc pas
 * besoin de `useSearchParams()`. Ce détail n'est pas cosmétique, et le dépôt l'a
 * déjà payé une fois (voir `(onboarding)/bienvenue/fin/page.tsx`) : ce crochet force
 * le rendu côté client de tout ce qu'il enveloppe. Sur une page STATIQUE, le HTML
 * envoyé au navigateur est alors VIDE — pas de titre, pas de contenu tant que le
 * JavaScript n'a pas tourné. C'est exactement ce qui est arrivé ici, et ça ne s'est
 * vu qu'en lisant la réponse du serveur : la page s'affichait parfaitement dans un
 * navigateur.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return <VillesScreen carte={params['vue'] === 'carte'} />;
}
