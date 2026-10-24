import type { ReactNode } from 'react';
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
 *   3. ✅ COMBLÉ — la vignette d'image. `kind: 'IMAGE'` et `mediaId` arrivaient
 *      bien, mais aucune route ne résolvait un média en URL, et la vignette
 *      dessinée portait `align-self:flex-end`, donc elle était figée du côté de
 *      l'expéditeur. `mediaUrl` est maintenant rendue par le serveur, et la
 *      vignette est posée DANS la colonne de la bulle — qui aligne déjà sur
 *      `m.cote`. Voir `image` ci-dessous ;
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
  /**
   * L'ADRESSE DE LA CONVERSATION — `/messages/<id>`.
   *
   * MESURÉ : la ligne était un `<div>`, donc cliquer dessus ne faisait rien et
   * l'URL ne bougeait pas. Aucune conversation ne pouvait être ouverte depuis la
   * liste, ni sur l'ordinateur ni sur le téléphone.
   */
  readonly href: string;
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
  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ L'IMAGE JOINTE — LA VIGNETTE EST REVENUE                                ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur : « quand on envoie un message dans le contexte d'une story, il
   * faudrait que la story soit capturée comme une image et ajoutée au message juste
   * un peu sous le message ».
   *
   * Le manque n°3 de l'en-tête de ce fichier est donc levé : `GET
   * /conversations/:id/messages` rend maintenant `mediaUrl`, composée par le
   * serveur. Il le fallait de toute façon — le module ACCEPTAIT `mediaId` à
   * l'écriture depuis le début, donc une image envoyée partait en base et n'était
   * jamais montrée.
   *
   * C'EST UNE VALEUR CSS DE FOND, et non une adresse : `url("…") center/cover
   * no-repeat`, comme `photoFond` sur la story et sur les annonces. La maquette
   * dessine cet emplacement en `<div>` hachuré, jamais en `<img>` — il n'y a pas un
   * seul `<img>` dans les 250 cadres produits — donc on peint le fond plutôt que
   * d'introduire une balise que le transcodeur n'a jamais émise.
   *
   * VIDE quand le message n'a pas d'image : le `<sc-if>` de la maquette ne rend
   * alors rien, et aucun rectangle ne s'ajoute au fil.
   */
  readonly image: string;
  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LA VIGNETTE MÈNE À LA STORY — OU DIT QU'ELLE A EXPIRÉ                   ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur : « Il faut qu'on puisse cliquer sur ça et aller vers la story si
   * toujours en ligne. Sinon ça affirme que la story a expiré. »
   *
   * `onImage` ABSENT = une image ordinaire, pas une story : la vignette reste un
   * `<div>`. Le transcodeur branche là-dessus, et c'est voulu — rendre cliquable
   * une photo qui ne vient d'aucune story promettrait une destination inexistante.
   *
   * LE GESTE EST DANS LA PAGE, PAS ICI : « encore en ligne » se lit sur
   * `storyAlive`, que le serveur calcule (une story vit vingt-quatre heures), et
   * la page choisit alors entre la navigation et le message d'expiration. Le cadre
   * ne connaît qu'un clic.
   */
  readonly onImage?: () => void;
  /** Le nom accessible de la vignette — « Voir la story de Fatim », ou l'image seule. */
  readonly imageNom?: string;
  /**
   * LE GESTE PAR BULLE — « Supprimer » (la mienne) ou « Signaler » (celle de
   * l'autre). Posé par `ConversationVivante`, qui a la confirmation et la feuille ;
   * le cadre le rend après l'heure (adaptation `MV_BULLE_ACTIONS`). Absent sur un
   * message supprimé : il n'y a plus rien à supprimer ni à signaler.
   */
  readonly actions?: ReactNode | undefined;
}

/** L'en-tête de la conversation ouverte. */
export interface EnteteConversation {
  /** Le titre du parcours (§8), ou le nom de l'interlocuteur. */
  readonly nom: string;
  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ L'AVATAR DE L'INTERLOCUTEUR, EN HAUT DE LA CONVERSATION                 ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur : « l'avatar de la personne n'est pas affichée en haut de la
   * conversation. »
   *
   * MESURÉ : la planche d'ordinateur dessine à cet endroit un carré de 44 px au
   * rayon 14, aplat `#FBE3D4`, portant le glyphe d'un PARCOURS — parce que
   * l'exemple de la maquette est une conversation de parcours (08 §8). La planche
   * de téléphone, elle, ne dessine rien du tout : chevron, titre, menu.
   *
   * `estParcours` DISTINGUE LES DEUX CAS, et il le faut : remplacer le glyphe par
   * un avatar sur une conversation de groupe de parcours effacerait ce que la
   * maquette dit — « Mes études à Lyon » n'est pas une personne. On garde donc le
   * dessin pour un parcours, et on peint l'interlocuteur pour une conversation
   * directe.
   *
   * `photo` est une valeur CSS de fond, pas une adresse — même recette que
   * partout ailleurs (`fondAvatar`). `null` quand le membre n'en a pas : le rond
   * reprend alors `fond` et écrit `initiales`.
   */
  readonly estParcours: boolean;
  readonly photo: string | null;
  readonly initiales: string;
  /** La teinte stable de l'interlocuteur, dérivée de son handle. */
  readonly fond: string;
  /** `/<handle>` — le profil public, vers lequel mène « Voir le profil ». */
  readonly profil: string | null;
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
  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ QUELLE CONVERSATION EST RÉELLEMENT OUVERTE                              ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * `/messages` ne porte AUCUN identifiant dans son URL, et le cadre
   * d'ordinateur y montre pourtant les deux volets : la liste ET une
   * conversation — celle de repli que le chargeur choisit (la plus récente).
   *
   * Le composeur a besoin de savoir LAQUELLE. Sans ce champ il se fiait au
   * paramètre d'URL, donc à `null` sur `/messages`, donc il se bloquait
   * lui-même : champ grisé, émojis grisés, trombone grisé, flèche grise. C'est
   * exactement ce que le porteur décrit — « l'envoi de message, la saisie,
   * l'ajout d'image et d'emojis ne marche toujours pas ».
   *
   * `null` quand il n'y a aucune conversation du tout : le composeur reste alors
   * inerte, et c'est juste.
   */
  readonly conversationOuverte?: string | null;
  /**
   * C'EST MOI QUI AI BLOQUÉ L'INTERLOCUTEUR de la conversation ouverte (lot F2),
   * dérivé de `Conversation.blockedByMe` et non de l'URL : c'est ce qui choisit les
   * cadres M01BLOQUE à la place de M01.
   */
  readonly conversationBloquee?: boolean;
  /** « Débloquer » (`DELETE /blocks/:userId`), posé sur le bouton du bandeau bloqué. */
  readonly onDebloquer?: () => void;
  /** Vrai pendant le déblocage : le bouton ne repart pas deux fois. */
  readonly debloquerBloque?: boolean;
  /** L'état de sourdine de la conversation ouverte — le menu en lit le libellé. */
  readonly conversationSourdine?: boolean;
  /** `/<handle>` de l'interlocuteur, ou `null` sur une conversation de parcours. */
  readonly conversationHandle?: string | null;
  /**
   * L'IDENTIFIANT de l'interlocuteur — `POST /reports` prend un `subjectId`, pas
   * un handle, là où `POST /blocks` prend l'inverse. Les deux sont donc portés.
   */
  readonly conversationUserId?: string | null;
  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LE COMPOSEUR — « L'ENVOI DE MESSAGE NE MARCHE PAS »                     ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Le module avait été livré en LECTURE SEULE, et l'en-tête de
   * `app/(app)/messages/[id]/page.tsx` le disait : « ce lot ne branche aucune
   * écriture ». Les trois contrôles de la barre basse étaient donc DESSINÉS — un
   * `<span>`, un `<div>`, un `<span>`. Le porteur demande l'écriture ; la voici.
   *
   * TOUTES FACULTATIVES : les quatre cadres de ce module se partagent ce type, et
   * les deux cadres BLOQUÉS n'ont pas de composeur du tout (la maquette l'ôte).
   * Les rendre obligatoires forcerait la page à inventer des gestes pour un écran
   * qui n'en dessine aucun.
   */
  readonly composeurTexte?: string;
  readonly onComposeurTexte?: (e: { readonly target: { readonly value: string } }) => void;
  readonly onComposeurTouche?: (e: {
    readonly key: string;
    readonly shiftKey: boolean;
    preventDefault: () => void;
  }) => void;
  readonly onEnvoyer?: () => void;
  /**
   * VRAI pendant l'envoi, pendant le dépôt d'une image, ou quand il n'y a rien à
   * envoyer. Le bouton passe au gris de l'inactif plutôt que de disparaître : la
   * planche le dessine en permanence, et le faire sauter à chaque frappe ferait
   * bouger la barre sous le doigt.
   */
  readonly envoiBloque?: boolean;
  /**
   * VRAI quand le composeur n'accepte RIEN — pas de conversation ouverte, ou un
   * dépôt d'image en cours. À distinguer d'`envoiBloque`, qui dit seulement qu'il
   * n'y a rien à envoyer à cet instant : mesuré, les confondre désactive le champ
   * tant qu'il est vide, c'est-à-dire exactement quand il faut pouvoir y taper.
   */
  readonly composeurBloque?: boolean;
  readonly onJoindreImage?: () => void;
  readonly onEmoji?: (emoji: string) => void;
  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LES PIÈCES JOINTES DU MESSAGE — PLUSIEURS, ET DANS L'INPUT              ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur : « Pour l'image dans l'input lors de l'envoi du message il faut
   * faire comme on a fait avec l'input de publication. Déjà il faut permettre
   * plusieurs images ensuite tu le mets dans l'input. »
   *
   * MÊME FORME QUE `A01_PIECES_JOINTES` sur le composeur du fil, délibérément :
   * deux formes voisines pour la même chose divergeraient au premier changement,
   * et le défaut ne se verrait que sur l'un des deux composeurs.
   *
   * `fond` est une valeur CSS — l'aperçu local du fichier (`blob:`) peint en
   * « couvrir », ou l'aplat de la maquette tant qu'il n'y a rien à montrer.
   * `apercu` dit laquelle des deux : sans lui, le nom du fichier s'écrirait
   * PAR-DESSUS la vignette.
   */
  readonly composeurImages?: readonly {
    readonly fond: string;
    readonly nom: string;
    readonly apercu: boolean;
    readonly retirer: string;
    readonly onRetirer: () => void;
  }[];
  /** Vrai à la borne : au-delà, le dépôt écarterait le fichier en silence. */
  readonly composeurAjoutBloque?: boolean;
  /**
   * LE CLAVIER D'ÉMOJIS EST OUVERT.
   *
   * Le porteur : « un highlight du bouton d'emoji qui se transforme en bouton
   * close pour montrer que c'est ça qui est ouvert et un second clic va fermer ».
   * L'état vit donc DANS LA PAGE et non dans un composant replié sur lui-même :
   * le cadre en a besoin à deux endroits — l'aplat du bouton, et la section qu'il
   * monte sous la barre.
   */
  readonly emojisOuverts?: boolean;
  readonly onBasculerEmojis?: () => void;
  /**
   * LE PIED DU FIL, entre les bulles et le composeur : la demande de conversation
   * à accepter ou ignorer, l'attente de réponse, et « écrit… ». AJOUT hors maquette
   * (`components/messagerie/pied-conversation.tsx`), posé par l'adaptation
   * `MV_FIL`.
   */
  readonly pied?: ReactNode | undefined;
  /**
   * L'état de la conversation OUVERTE vis-à-vis de la règle du premier message
   * (08 §5.2) : `recue` = on m'écrit pour la première fois, à moi d'accepter ou
   * d'ignorer ; `envoyee` = j'ai écrit, j'attends ; `null` = conversation normale.
   */
  readonly conversationDemande?: 'recue' | 'envoyee' | null;
  /** Le prénom de l'interlocuteur, pour « Marc écrit… » et les bandeaux. */
  readonly conversationPrenom?: string | null;
}
