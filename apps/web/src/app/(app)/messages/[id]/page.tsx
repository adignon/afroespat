import { EcranMessages } from '@/screens/messages/ecran';
import { feuilleDemandee } from '@/screens/messages/feuilles';
import { M01Desktop } from '@/screens/m01/desktop.generated';
import { M01MobileConversation } from '@/screens/m01/mobileconversation.generated';
import { M01BloqueDesktop } from '@/screens/m01bloque/bloquedesktop.generated';
import { M01BloqueMobileConversation } from '@/screens/m01bloque/bloquemobileconversation.generated';

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
 * TROIS FENÊTRES, et l'URL peut en demander une : le MENU DE LA CONVERSATION
 * (`?feuille=menu`, qui s'ouvre aussi au « ··· » de l'en-tête), la feuille
 * « Signaler » (`?feuille=signaler`) et sa confirmation (`?feuille=merci`). Les deux
 * dernières n'ont aucun déclencheur dans un cadre : « Signaler » ne vit que DANS le
 * menu, où la maquette le dessine en `<span>`, et aucune route ne le porte encore
 * (module 13).
 *
 * `?etat=bloque` — LA CONVERSATION AVEC UN MEMBRE BLOQUÉ.
 *
 * L'état est une PLANCHE, comme tous les états de cette maquette (voir l'en-tête de
 * `tools/screens/09-messages.mjs`) : la page CHOISIT le cadre, elle n'alimente pas
 * un composant. Les deux cadres bloqués sont ceux de la conversation, composeur en
 * moins et bandeau en plus.
 *
 * ⚠ CET ÉTAT N'EST DESSINÉ PAR AUCUNE MAQUETTE. Sa forme est empruntée — le bandeau
 * de « DEMANDE EN ATTENTE » (M01), le bouton « Débloquer » de K05 (`08 Compte`) — et
 * sa PHRASE vient du porteur, pas d'une planche. Le générateur le redit avec un ⚠ à
 * chaque exécution ; le détail est dans `CONVERSATION_BLOQUEE`.
 *
 * « Débloquer » est INERTE : débloquer quelqu'un est une écriture, et ce lot ne
 * branche aucune route (08 §5, module 13). Le rendre actif sans que rien ne parte
 * mentirait au membre — la même règle que pour « Envoyer le signalement ».
 *
 * 08 §8 : « conversation de parcours nommée par le titre du parcours ». La maquette
 * s'y tient — l'en-tête porte « Mes études à Lyon » et le sous-titre « Parcours ·
 * Aïcha (parraine), Moussa, Fanta » — et c'est ce titre qui devient le `<h1>`.
 */
export default async function ConversationPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  // Une valeur inconnue rend la conversation ORDINAIRE : l'URL est publique, et une
  // valeur fantaisiste ne doit ni casser la page ni faire croire à un blocage.
  const bloque = params['etat'] === 'bloque';

  return (
    <EcranMessages
      desktop={bloque ? <M01BloqueDesktop /> : <M01Desktop />}
      mobile={bloque ? <M01BloqueMobileConversation /> : <M01MobileConversation />}
      ouverte={feuilleDemandee(params['feuille'])}
    />
  );
}
