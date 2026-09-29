import { ScreenFrames } from '@/screens/frames';
import { M01Desktop } from '@/screens/m01/desktop.generated';
import { M01MobileConversation } from '@/screens/m01/mobileconversation.generated';
import { FeuillesSignalement, type FeuilleSignalement } from '@/screens/messages/feuilles';

/**
 * M01 — une conversation (`/messages/:id`, 08 §5, T5 §10).
 *
 * Composant SERVEUR : il reçoit les paramètres d'URL en propriété et n'emploie donc
 * pas `useSearchParams()`. Ce crochet force un rendu côté client et fait ÉCHOUER
 * `next build` sans frontière `Suspense` — le serveur de développement, lui,
 * l'accepte sans rien dire (voir `docs/decisions.md`).
 *
 * L'identifiant n'est pas encore lu : la maquette ne dessine qu'une conversation, et
 * en inventer d'autres serait inventer de la donnée. Il est néanmoins dans la route,
 * parce que c'est elle que T5 fixe.
 *
 * LE CADRE D'ORDINATEUR EST LE MÊME QUE CELUI DE `/messages` : la maquette n'en
 * dessine qu'un, avec ses deux volets. C'est le cadre MOBILE qui change — « MOBILE ·
 * CONVERSATION » au lieu de « MOBILE · LISTE ».
 *
 * 08 §8 : « conversation de parcours nommée par le titre du parcours ». La maquette
 * s'y tient — l'en-tête porte « Mes études à Lyon » et le sous-titre « Parcours ·
 * Aïcha (parraine), Moussa, Fanta » — et c'est ce titre qui devient le `<h1>`.
 */
const FEUILLES: Record<string, FeuilleSignalement> = {
  signaler: 'signaler',
  merci: 'merci',
};

export default async function ConversationPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const demande = params['feuille'];
  // Une valeur inconnue est IGNORÉE plutôt qu'affichée : l'URL est publique, et une
  // valeur fantaisiste ne doit pas casser la page.
  const feuille = typeof demande === 'string' ? (FEUILLES[demande] ?? null) : null;

  return (
    <>
      <ScreenFrames screen="M01" desktop={<M01Desktop />} mobile={<M01MobileConversation />} />
      <FeuillesSignalement ouverte={feuille} />
    </>
  );
}
