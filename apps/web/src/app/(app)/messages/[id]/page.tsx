import { EcranMessagerie } from '@/screens/messages/ecran-donnees';
import { feuilleDemandee } from '@/screens/messages/feuilles';

/**
 * M01 — une conversation (`/messages/:id`, 08 §5, T5 §10).
 *
 * Composant SERVEUR : il reçoit les paramètres d'URL en propriété et n'emploie donc
 * pas `useSearchParams()`. Ce crochet force un rendu côté client et fait ÉCHOUER
 * `next build` sans frontière `Suspense` — le serveur de développement, lui,
 * l'accepte sans rien dire (voir `docs/decisions.md`).
 *
 * ET IL N'APPELLE AUCUNE FONCTION CLIENTE. `feuilleDemandee` vient de
 * `./feuilles.ts`, qui n'est PAS un module `'use client'`, et c'est toute la raison
 * de l'existence de ce fichier-là : déclarée dans `ecran.tsx`, cette fonction
 * n'arrivait pas au serveur comme une fonction mais comme une RÉFÉRENCE client,
 * l'appeler jetait, et la route répondait `500`. Le symptôme visible — « aucune
 * boîte de dialogue » — ne nommait pas la cause. Le chargement des données suit la
 * même règle : la page REND `EcranMessagerie`, elle ne l'appelle pas.
 *
 * L'IDENTIFIANT EST MAINTENANT LU, et il désigne la conversation à ouvrir.
 * `chargerM01` le vérifie comme UUID avant de le mettre dans un chemin d'API — il
 * vient de l'URL, donc du public — et un identifiant fantaisiste retombe sur la
 * conversation par défaut plutôt que sur un appel malformé. L'URL est publique : une
 * valeur inventée ne doit ni casser la page ni faire croire à autre chose.
 *
 * LE CADRE D'ORDINATEUR EST LE MÊME QUE CELUI DE `/messages` : la maquette n'en
 * dessine qu'un, avec ses deux volets. C'est le cadre MOBILE qui change — « MOBILE ·
 * CONVERSATION » au lieu de « MOBILE · LISTE ».
 *
 * QUATRE FENÊTRES, et l'URL peut en demander une : le MENU DE LA CONVERSATION
 * (`?feuille=menu`, qui s'ouvre aussi au « ··· » de l'en-tête), la feuille
 * « Signaler » (`?feuille=signaler`) et sa confirmation (`?feuille=merci`), plus la
 * confirmation de suppression d'un message (état local, sans URL). « Signaler »
 * s'ouvre aussi depuis le lien sous une bulle, qui vise alors CE message
 * (`POST /reports`, `subjectType: MESSAGE`) et non le membre.
 *
 * `?etat=bloque` — LA CONVERSATION AVEC UN MEMBRE BLOQUÉ.
 *
 * L'état est une PLANCHE, comme tous les états de cette maquette (voir l'en-tête de
 * `tools/screens/09-messages.mjs`) : la page CHOISIT le cadre. Les deux cadres
 * bloqués sont ceux de la conversation, composeur en moins et bandeau en plus — et
 * ils lisent EXACTEMENT les mêmes données, parce qu'une conversation bloquée reste
 * une conversation.
 *
 * ⚠ CET ÉTAT N'EST DESSINÉ PAR AUCUNE MAQUETTE. Sa forme est empruntée — le bandeau
 * de « DEMANDE EN ATTENTE » (M01), le bouton « Débloquer » de K05 (`08 Compte`) — et
 * sa PHRASE vient du porteur, pas d'une planche. Le générateur le redit avec un ⚠ à
 * chaque exécution ; le détail est dans `CONVERSATION_BLOQUEE`.
 *
 * ET IL N'EST PAS DÉDUIT DE L'API, délibérément : `members[].hidden` dit « séparé
 * mutuellement » (§4), pas « c'est MOI qui ai bloqué », et seule la seconde chose
 * justifie un bouton « Débloquer ». La distinction demanderait de croiser
 * `GET /me/blocks` avec les membres de la conversation. Signalé au porteur.
 *
 * « Débloquer » est INERTE : `DELETE /v1/blocks/:userId` existe et répond `204`,
 * mais débloquer est une ÉCRITURE et ce lot n'en branche aucune. Le rendre actif
 * sans que rien ne parte mentirait au membre — la même règle que pour « Envoyer le
 * signalement ».
 *
 * 08 §8 : « conversation de parcours nommée par le titre du parcours ». La maquette
 * s'y tient — l'en-tête porte « Mes études à Lyon » et le sous-titre « Parcours ·
 * Aïcha (parraine), Moussa, Fanta » — et c'est ce titre qui devient le `<h1>`, sur
 * sa forme LIÉE : le générateur le dit à chaque exécution (« Titre lié à une
 * donnée : il sera promu sur {entete.nom} »).
 */
export default async function ConversationPage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ readonly id: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, recherche] = await Promise.all([params, searchParams]);
  // Une valeur inconnue rend la conversation ORDINAIRE : l'URL est publique, et une
  // valeur fantaisiste ne doit ni casser la page ni faire croire à un blocage.
  const bloque = recherche['etat'] === 'bloque';

  return (
    <EcranMessagerie
      vue={bloque ? 'bloque' : 'conversation'}
      conversationId={id}
      ouverte={feuilleDemandee(recherche['feuille'])}
    />
  );
}
