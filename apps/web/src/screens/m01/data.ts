import type { BarreHaute } from '../messages/data';

/**
 * Données de M01 — la liste des conversations et le fil (`/messages`, `/messages/:id`).
 *
 * La FORME vient du transcodage de `docs/template/09 Messages et transverse.dc.html` ;
 * la DONNÉE et le COMPORTEMENT vivent ici et dans `screens/messages/appels.ts`.
 * Le JSX transcodé n'a pas bougé : la prise est déclarée dans
 * `tools/screens/09-messages.mjs`, sous la clé `donnees`.
 *
 * ── LA RÈGLE LA PLUS GRAVE DE CE MODULE, ET OÙ ELLE EST TENUE ───────────────
 *
 * LE CORPS DES MESSAGES EST CHIFFRÉ. Il l'est AU REPOS, pas de bout en bout
 * (00 §8.1) : `messages.body_encrypted` est scellé par `CryptoService`, et la
 * modération doit pouvoir lire une conversation signalée. Le service DESCELLE donc
 * avant de répondre, en un seul endroit (`MessagingService.bodyOf`), et ce qui
 * arrive ici est du TEXTE CLAIR — vérifié sur le service, pas supposé :
 *
 *   · `GET /conversations` → `lastMessagePreview`, le corps déscellé puis coupé à
 *     120 caractères par le serveur ;
 *   · `GET /conversations/:id/messages` → `body`, le corps déscellé.
 *
 * AUCUNE ROUTE DE CE DÉPÔT NE REND DE CRYPTOGRAMME. Cet écran n'a donc rien à
 * déchiffrer, et il ne doit RIEN pouvoir déchiffrer : lui en donner les moyens
 * reviendrait à poser une clé de contenu dans le navigateur.
 *
 * Le rempart est donc ailleurs, et à deux étages :
 *
 *   · `conversationSchema` et `messageSchema` (dans `packages/shared`) sont
 *     `.strict()`. Le jour où la réponse porterait un `bodyEncrypted`, un
 *     `bodyCipher` ou un `lastMessageBody` non coupé, elle serait REFUSÉE à la
 *     frontière, sur l'appel, en nommant le champ de trop. Sans `.strict()`, zod
 *     DÉPOUILLE EN SILENCE : les octets auraient quitté le serveur, traversé le
 *     réseau et atteint le navigateur sans que rien ne le dise ;
 *   · et pour la notification de message — qui ne doit JAMAIS porter le corps
 *     (12 §2.4) — c'est `notificationSchema` qui refuse, côté X02.
 *
 * ── CE QUE LA MAQUETTE DESSINE ET QUE L'API NE DIT PAS ──────────────────────
 *
 * Quatre manques, tous signalés au porteur plutôt que comblés par une invention :
 *
 *   1. « Vu » — la maquette l'écrit sous la dernière bulle envoyée.
 *      `GET /conversations/:id/messages` ne rend AUCUN accusé de lecture par
 *      message : `lastReadAt` existe sur `conversation_members` mais n'est pas
 *      exposé. `mention` porte donc l'heure, jamais « Vu » ;
 *   2. la ligne système « Aïcha a rejoint le parcours » — aucune route ne produit
 *      de message `SYSTEM` (la colonne `kind` n'existe pas, le kind est déduit).
 *      Elle est retirée du gabarit : la laisser l'afficherait en tête de CHAQUE
 *      conversation, pour toujours ;
 *   3. la vignette d'image — `kind: 'IMAGE'` et `mediaId` arrivent bien, mais
 *      aucune route de ce lot ne résout un média en URL, et la vignette dessinée
 *      est toujours du côté de l'expéditeur ;
 *   4. le préfixe d'auteur de l'aperçu (« Aïcha : », « Vous : ») — l'API rend le
 *      corps NU. Il est composé ici, à partir de l'auteur que `members[]` nomme :
 *      c'est de la mise en forme, pas une donnée inventée.
 */

/**
 * Une rangée de la liste — une conversation, ou une demande en attente.
 *
 * TOUT EST DÉJÀ MIS EN FORME : la couleur, l'heure relative, la graisse. Le cadre
 * transcodé ne décide rien, et n'a surtout pas d'horloge — comparer une date à
 * celle du navigateur afficherait « hier » à contretemps sur une machine décalée.
 *
 * LES COULEURS SONT CELLES DE LA MAQUETTE, relevées sur ses propres planches, et
 * aucune n'est assombrie : `#E3F0EB` pour la rangée ouverte et `transparent` pour
 * les autres ; `#E0733A`, `#0F5C48`, `#B4581F` pour les avatars, cyclées par rang
 * comme K05 cycle les siennes ; `#16211D` / `600` pour un aperçu qui porte des
 * non-lus, `#8A958F` / `400` sinon. Les deux paires d'aperçu sont dessinées, et ne
 * lier que la pastille laisserait un aperçu en gras sombre sur une conversation
 * entièrement lue.
 *
 * ⚠ `fond` NE DOIT JAMAIS VALOIR `#E3F0EB` SUR LE CADRE MOBILE DE LA LISTE. La
 * planche « MOBILE · LISTE » donne `transparent` à ses trois rangées : sur
 * téléphone la liste est une page à part, et aucune conversation n'y est ouverte —
 * c'est « MOBILE · CONVERSATION » qui est l'écran suivant. Le chargeur le sait.
 */
export interface RangeeConversation {
  readonly fond: string;
  readonly fondAvatar: string;
  readonly initiales: string;
  /** Le titre du parcours (§8), ou le nom de l'interlocuteur pour une conversation directe. */
  readonly nom: string;
  /** L'heure relative : « 10:42 », « hier », « lun. », « 12 sept. ». */
  readonly quand: string;
  readonly encre: string;
  readonly graisse: string;
  /**
   * La dernière ligne, préfixée de son auteur comme la maquette le dessine.
   *
   * Le corps vient DÉSCELLÉ et DÉJÀ COUPÉ par le serveur (120 caractères). Vide
   * quand `lastMessagePreview` est nul — conversation sans message, ou auteur
   * séparé du lecteur (§4) — et la maquette laisse alors la place vide plutôt
   * qu'un substitut inventé ici.
   */
  readonly apercu: string;
  /** Le compteur de non-lus. `0` fait disparaître la pastille (`<sc-if>`). */
  readonly nonLus: number;
}

/**
 * Une bulle du fil.
 *
 * Les cinq premières valeurs sont celles des DEUX bulles que la maquette dessine —
 * la mienne à droite en `#16785E`, la sienne à gauche en `#fff` cernée de
 * `#E6EBE9`. Ce sont des données parce que la maquette dessine les deux : lier le
 * seul corps donnerait des messages reçus affichés en vert à droite, c'est-à-dire
 * un fil où l'on ne sait plus qui parle.
 */
export interface BulleMessage {
  /** `flex-end` pour mes messages, `flex-start` pour les siens. */
  readonly cote: string;
  readonly rayon: string;
  readonly fond: string;
  readonly encre: string;
  readonly trait: string;
  /** Le nom de l'auteur, en gras au-dessus du corps — vide sur mes propres bulles. */
  readonly auteur: string;
  /**
   * Le corps, DÉSCELLÉ par le serveur.
   *
   * Peut valoir « Message supprimé » ou « Message d'un membre supprimé » : ce sont
   * les deux substituts de `packages/shared`, écrits par le SERVEUR, et l'écran les
   * affiche tels quels. Vide quand l'auteur est séparé du lecteur (§4).
   */
  readonly corps: string;
  /**
   * L'heure sous la bulle, ou vide (`<sc-if>`).
   *
   * JAMAIS « Vu » : la maquette l'écrit, mais aucun accusé de lecture par message
   * n'est exposé par l'API. Voir l'en-tête.
   */
  readonly mention: string;
}

/** L'en-tête de la conversation ouverte. */
export interface EnteteConversation {
  /** Le titre du parcours (§8), ou le nom de l'interlocuteur. */
  readonly nom: string;
  /** Les membres, tels que `members[].displayName` les nomme. */
  readonly sousTitre: string;
}

/** M01 — les trois cadres, chacun lisant ce que sa planche dessine. */
export interface M01Data {
  readonly moi: BarreHaute;
  readonly conversations: readonly RangeeConversation[];
  readonly demandes: {
    /** Le nombre de demandes en attente (§5.2), compté sur `pendingForMe`. */
    readonly total: number;
    readonly liste: readonly RangeeConversation[];
  };
  readonly entete: EnteteConversation;
  readonly messages: readonly BulleMessage[];
}
