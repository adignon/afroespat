'use client';

import { conversationsResponseSchema, openDirectConversationResponseSchema } from '@app/shared';
import { memberApi } from '@/lib/api/index';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ « ÉCRIRE À QUELQU'UN » — LES DEUX APPELS, À UN SEUL ENDROIT                ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur, capture à l'appui : « on ne peut pas écrire aux membres » (onglet
 * « Membres » d'un réseau). Le geste existait déjà sur le profil public —
 * `screens/compte/profil-contact-vivant.tsx`, branché par `K02_ECRIRE` — et
 * c'est le MÊME geste : chercher un fil existant avec cette personne, y aller
 * s'il y en a un, sinon demander le premier message et ouvrir.
 *
 * ── POURQUOI CE FICHIER EXISTE PLUTÔT QU'UNE SECONDE COPIE ────────────────
 *
 * Parce que la connaissance qu'il porte n'est pas du dessin, c'est du CONTRAT :
 *
 *   1. `POST /conversations/direct` exige `firstMessage`
 *      (`createDirectConversationSchema`, min `MESSAGE_BODY_MIN`). Il n'existe
 *      aucune conversation vide dans ce produit — §5.2 — donc un lien vers
 *      `/messages` n'ouvrirait rien ;
 *   2. la route est UNIQUE PAR PAIRE : la rappeler sur un fil existant y
 *      enverrait un message de plus pour rien. On regarde donc d'abord ;
 *   3. le pseudo voyage SANS arobase dans la charge (`handleSchema` refuse le
 *      `@`), alors que les URL du produit l'écrivent `/@fatou`. L'oubli a déjà
 *      coûté un 400 sur l'ajout de numéro et une page blanche sur « Voir le
 *      profil » — c'est `handleNu` qui le retient, une fois.
 *
 * Recopié dans le module des réseaux, ce savoir aurait divergé du profil au
 * premier ajustement, et le symptôme aurait été un 400 affiché comme une panne.
 *
 * ── CE QUI N'EST PAS ICI, ET C'EST VOULU ──────────────────────────────────
 *
 * Aucun état, aucun `useState`, aucune fenêtre, aucune navigation. Les deux
 * écrans n'ont pas le même état autour de ce geste — le profil partage un seul
 * `enVol` entre « Écrire », « Ajouter aux contacts » et « Recommander » ; les
 * réseaux portent en plus la cible du menu de rôle. Remonter leur état commun
 * ici aurait forcé l'un des deux à plier. Ce fichier ne porte que les APPELS.
 */

/** Le pseudo tel que la charge l'exige : `/@fatou` et `fatou` donnent `fatou`. */
export function handleNu(pseudo: string): string {
  return pseudo.startsWith('@') ? pseudo.slice(1) : pseudo;
}

/**
 * Le fil existant avec cette personne, ou `null`.
 *
 * ⚠ IL NE REGARDE QUE LA PREMIÈRE PAGE — cinquante conversations, la borne que
 * le profil public employait déjà. Au-delà, on retombe sur `null` et la fenêtre
 * s'ouvre : le pire cas est un message de plus dans un fil existant, ce qui est
 * très loin devant un bouton qui ne répond pas. REMONTÉ : il faudrait que
 * `GET /conversations` accepte un filtre par pseudo.
 */
export async function conversationAvec(pseudo: string): Promise<string | null> {
  const handle = handleNu(pseudo);
  const page = await memberApi.get('/conversations?limit=50', conversationsResponseSchema);
  return page.items.find((c) => c.members.some((m) => m.handle === handle))?.id ?? null;
}

/** Ouvre le fil direct et rend son identifiant. Le message est OBLIGATOIRE. */
export async function ouvrirConversation(pseudo: string, premierMessage: string): Promise<string> {
  /**
   * `openDirectConversationResponseSchema` et NON `conversationSchema` : la route
   * rend `{ conversationId, messageId, pending }`. L'ancien schéma refusait cette
   * réponse valide — le message était créé, l'écran annonçait un échec.
   */
  const reponse = await memberApi.post(
    '/conversations/direct',
    openDirectConversationResponseSchema,
    {
      body: { toHandle: handleNu(pseudo), firstMessage: premierMessage },
    },
  );
  return reponse.conversationId;
}

/**
 * Le PRÉNOM que `FenetreEcrire` met dans son titre (« Écrire à Aïcha »).
 *
 * Le premier mot du nom affiché, et le nom entier s'il n'en a qu'un. La fenêtre
 * ne peut pas recevoir une chaîne vide — son titre serait « Écrire à », ce qui
 * est un nom accessible tronqué (§10.6) — donc un nom vide retombe sur le
 * pseudo, exactement comme `membreAdminRowFrom` et `demandeRowFrom` le font déjà
 * pour les lignes de membres.
 */
export function prenomDe(nomAffiche: string, pseudo: string): string {
  const nom = nomAffiche.trim();
  if (nom === '') return `@${handleNu(pseudo)}`;
  return nom.split(/\s+/)[0] ?? nom;
}
