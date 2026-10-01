import type { M01Data } from '../m01/data';

/**
 * Données de M01BLOQUE — la conversation dont l'interlocuteur est bloqué.
 *
 * ── LA MÊME FORME QUE M01, ET UN TYPE À PART ────────────────────────────────
 *
 * Une conversation bloquée reste une conversation : on lit la liste, les demandes,
 * l'en-tête et le fil exactement comme ailleurs. Ce qui change, c'est qu'on ne peut
 * plus écrire — et cela se joue dans le COMPOSEUR, que l'emprunt remplace par un
 * bandeau (voir `CONVERSATION_BLOQUEE` dans `tools/screens/09-messages.mjs`).
 *
 * D'où un type distinct pour une forme identique, et c'est volontaire : un écran,
 * un type. Le jour où cet état portera une donnée de plus — la date du blocage, par
 * exemple, que `GET /me/blocks` sait rendre — elle n'apparaîtra pas dans la
 * signature des cadres de M01, qui n'en ont pas l'usage.
 *
 * ⚠ CET ÉTAT N'EST DESSINÉ PAR AUCUNE MAQUETTE. Sa forme est EMPRUNTÉE — le
 * bandeau de « DEMANDE EN ATTENTE » (M01), le bouton « Débloquer » de la carte
 * « BLOQUÉS » de K05 (`08 Compte`) — et sa PHRASE vient du PORTEUR, pas d'une
 * planche. Le générateur l'annonce avec un `⚠` à chaque exécution, et
 * `applyBorrows` lève si l'un des motifs disparaît de sa source. Ne pas casser ce
 * mécanisme : c'est lui qui garde l'emprunt honnête.
 *
 * ── CE QUI N'EST PAS BRANCHÉ ICI, ET POURQUOI ───────────────────────────────
 *
 * « DÉBLOQUER » RESTE INERTE. Débloquer quelqu'un est une ÉCRITURE —
 * `DELETE /v1/blocks/:userId`, qui existe et répond `204` — et ce lot ne branche
 * aucune écriture. Le rendre actif sans que rien ne parte mentirait au membre, et
 * c'est la même règle que pour « Envoyer le signalement » et pour le « Publier »
 * de J03 : un bouton inerte est moins nuisible qu'un bouton qui ment.
 *
 * ET L'ÉTAT N'EST PAS DÉDUIT DE L'API. La page le reçoit par `?etat=bloque`, pas
 * d'un champ : `GET /conversations` rend bien `members[].hidden`, mais ce drapeau
 * dit « séparé mutuellement » (§4) et non « c'est MOI qui ai bloqué », et c'est
 * cette seconde chose seule qui justifie un bouton « Débloquer ». La distinction
 * demanderait de croiser `GET /me/blocks` avec les membres de la conversation.
 * Faisable, non fait : la maquette ne dessine pas cet écran, et l'URL le rend
 * atteignable sans rien affirmer. Signalé au porteur.
 */
export type M01BloqueData = M01Data;
