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
 * ── CE QUI EST BRANCHÉ (lot F2) ─────────────────────────────────────────────
 *
 * « DÉBLOQUER » EST VIVANT : `DELETE /v1/blocks/:userId` (204). Le serveur rouvre la
 * conversation DIRECT que le blocage avait fermée ; l'écran relit et retombe sur le
 * cadre ordinaire. Les contacts, eux, ne reviennent pas (08 §4).
 *
 * ET L'ÉTAT EST DÉDUIT DE L'API, plus de `?etat=bloque` : `GET /conversations` rend
 * `blockedByMe` (c'est MOI qui ai bloqué, et non « séparés dans un sens ou dans
 * l'autre » comme `members[].hidden`). Voir `M01Data.conversationBloquee`.
 */
export type M01BloqueData = M01Data;
