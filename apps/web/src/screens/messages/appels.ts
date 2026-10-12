'use client';

import {
  CATEGORY_LABELS_FR,
  conversationsResponseSchema,
  FREE_EVENTS_PER_MONTH,
  mySubscriptionResponseSchema,
  groupedSearchResponseSchema,
  typedSearchResponseSchema,
  searchSubjectTypeSchema,
  messagesResponseSchema,
  notificationsResponseSchema,
  suggestResponseSchema,
  SEARCH_MIN_QUERY_LENGTH,
  SUGGEST_MIN_QUERY_LENGTH,
  mediaAssetSchema,
  uuidSchema,
  type Conversation,
  type MediaAssetView,
  type MeResponse,
  type Message,
  type Notification,
  type SearchSubjectType,
  type SuggestResponse,
  type NotificationCategory,
} from '@app/shared';
import { z } from 'zod';
import { fetchMe, memberApi } from '@/lib/api/index';
import { urlMedia } from '@/lib/api/base';
import { photoFondFor } from '../a14/data';
import {
  cartesGroupees,
  cartesPlates,
  filtresDe,
  suggestionsDe,
  videDe,
} from '../x01/from-api';
import type { BarreHaute } from './data';
import type {
  BulleMessage,
  EnteteConversation,
  M01Data,
  RangeeConversation,
} from '../m01/data';
import type { M01BloqueData } from '../m01bloque/data';
import type { X01Data } from '../x01/data';
import {
  GLYPHES_X02,
  type FiltreNotification,
  type LigneNotification,
  type X02Data,
} from '../x02/data';
import type { X04Data } from '../x04/data';
import { fondAvatar } from '@/lib/avatar';
import { avatarColor } from '../accueil/from-api';

/**
 * LES APPELS DES ÉCRANS M01, X01 ET X02 — un chargeur par écran, et rien d'autre.
 *
 * ── CE QUE CE FICHIER NE FAIT PAS ───────────────────────────────────────────
 *
 * Il n'a AUCUN `fetch`, aucun en-tête, aucun jeton, aucun rejeu. Le socle
 * (`lib/api/`) porte tout cela, et sa consigne est à lire avant d'ajouter une
 * ligne ici. Quatre de ses règles se voient dans ce fichier :
 *
 *   1. `memberApi` SEULEMENT. `staffApi` n'est pas importé, et ne pourrait pas
 *      l'être utilement : sa base est `/v1/admin` et il n'a aucun moyen
 *      d'exprimer `/conversations`.
 *   2. UN SCHÉMA PAR APPEL. Il n'existe pas de variante sans, et les schémas
 *      viennent de `@app/shared` — six ont été ÉCRITS LÀ pour ce lot, à côté des
 *      schémas de requête de leur module, parce qu'un schéma de réponse recopié
 *      dans le front est une deuxième source qui divergera. C'est d'autant plus
 *      vrai ici qu'il n'existe AUCUN intercepteur de validation de réponse côté
 *      API — compté : zéro `APP_INTERCEPTOR` dans `app.module.ts`. Ces schémas sont
 *      le SEUL endroit où la forme des réponses est vérifiée.
 *   3. AUCUN TYPE DE RÉPONSE ÉCRIT À LA MAIN : `z.infer` partout.
 *   4. LE NIVEAU NE SERT JAMAIS À AUTORISER. Aucun `if (niveau >= 1)` n'existe
 *      ici, et il n'en faut pas : `POST /conversations/direct` exige `message.send`
 *      (L1), on tente l'action, et le serveur répond `403 LEVEL_REQUIRED` avec de
 *      quoi afficher l'invitation du §7.3. Ce lot n'écrit d'ailleurs rien.
 *
 * ── AUCUN REJEU, ET SURTOUT PAS D'UN `429` ──────────────────────────────────
 *
 * Aucun chargeur ici ne réessaie. Le socle rejoue ce qui doit l'être — un `401`
 * après rafraîchissement, une fois, partagé en vol — et ne rejoue JAMAIS un `429`.
 * `POST /conversations/:id/messages` est chiffré à 60/minute et
 * `POST /conversations/direct` à 20, mais ce sont des écritures ; en lecture, un
 * chargeur qui réessaierait de lui-même transformerait une attente en boucle.
 *
 * ── LA SESSION, ET POURQUOI ON NE LA REPREND PAS À LA MAIN ──────────────────
 *
 * Le piège est réel et vaut d'être nommé : une route `@PublicRead` ne provoque
 * AUCUN `401`. Un appel parti avant la reprise de session y arrive sans jeton, le
 * serveur répond `200` avec la vue visiteur, le socle ne rejoue rien — et l'écran
 * CHANGE D'AVIS au rechargement, quand le jeton est là.
 *
 * AUCUNE DES CINQ ROUTES LUES ICI N'EST `@PublicRead`. Vérifié sur les
 * CONTRÔLEURS, pas supposé : `GET /conversations`,
 * `GET /conversations/:id/messages`, `GET /search`, `GET /search/suggest` et
 * `GET /notifications` portent toutes `@RequiresCapability('content.read')` et
 * aucun `@PublicRead`. Le header de `search.controller.ts` écrit même pourquoi :
 * « AUCUNE route n'est `@PublicRead()`, et c'est la règle dure du §2.1 ». Les deux
 * seules routes publiques de ces quatre modules sont `GET /unsubscribe` et
 * `GET /scam-alerts`, et aucun écran de ce lot ne les appelle.
 *
 * Un appel sans jeton prend donc un vrai `401`, que le TRANSPORT rafraîchit par le
 * cookie `httpOnly` puis rejoue. Appeler `resumeSession()` ici ajouterait un
 * aller-retour au chargement de chaque page pour refaire ce que le socle fait
 * déjà, et deux rotations simultanées du jeton de rafraîchissement sont exactement
 * ce que `refreshOnce` existe pour empêcher — le jeton TOURNE, et reposer le même
 * cookie deux fois est un rejeu qui RÉVOQUE la chaîne.
 */

// ─── Mise en forme ───────────────────────────────────────────────────────────

/** « Amina Diallo » → « AD ». Deux initiales au plus, comme la maquette les dessine. */
function initialesDe(nom: string): string {
  const mots = nom.trim().split(/\s+/).filter((m) => m !== '');
  return mots
    .slice(0, 2)
    .map((m) => [...m][0]?.toUpperCase() ?? '')
    .join('');
}

/** « Amina Diallo » → « Amina ». */
function prenomDe(nom: string): string {
  return nom.trim().split(/\s+/)[0] ?? nom;
}

const MINUTE = 60_000;
const HEURE = 60 * MINUTE;
const JOUR = 24 * HEURE;

/**
 * L'HEURE RELATIVE, DANS LES MOTS QUE LA MAQUETTE EMPLOIE.
 *
 * Relevés sur ses planches, et pas inventés : « 10:42 » pour aujourd'hui, « 5 min »
 * et « 1 h » dans les notifications, « hier », « lun. » pour la semaine,
 * « 12 sept. » au-delà. Deux échelles cohabitent donc dans la maquette — la liste
 * de conversations commence à l'heure du jour, le panneau de notifications aux
 * minutes écoulées — et `depuis` dit laquelle on veut.
 *
 * ⚠ CETTE FONCTION LIT L'HORLOGE DU NAVIGATEUR, et c'est le seul endroit du module
 * qui le fasse. C'est acceptable ici — se tromper d'une minute sur « il y a 5 min »
 * n'induit personne en erreur — mais cela ne vaudrait PAS pour un état : comparer
 * une échéance à une horloge locale décalée afficherait « expiré » à qui ne l'est
 * pas. Les états de ce module viennent tous du serveur (`pendingForMe`,
 * `awaitingReply`, `unreadCount`, `readAt`), et aucun n'est recalculé ici.
 */
function heureRelative(iso: string, depuis: 'minutes' | 'heure-du-jour'): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const ecart = Date.now() - date.getTime();

  if (ecart < HEURE && depuis === 'minutes') {
    return `${Math.max(1, Math.floor(ecart / MINUTE))} min`;
  }
  if (ecart < JOUR) {
    return depuis === 'minutes'
      ? `${Math.floor(ecart / HEURE)} h`
      : date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }
  if (ecart < 2 * JOUR) return 'hier';
  if (ecart < 7 * JOUR) return date.toLocaleDateString('fr-FR', { weekday: 'short' });
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

/** La barre haute, des quatre cadres d'ordinateur. */
function barreHauteDe(me: MeResponse): BarreHaute {
  return {
    initiales: initialesDe(me.user.displayName),
    photo: fondAvatar(me.user.avatarUrl),
    prenom: prenomDe(me.user.displayName),
  };
}

// ─── M01 · la messagerie ─────────────────────────────────────────────────────

/**
 * Les trois couleurs d'avatar de la maquette M01, dans son ordre. Cyclées par rang,
 * exactement comme K05 cycle les siennes. Aucune n'est retouchée.
 */
const FONDS_AVATAR = ['#E0733A', '#0F5C48', '#B4581F'] as const;

/** Les deux jeux d'encre de l'aperçu, relevés sur la maquette. */
const APERCU_NON_LU = { encre: '#16211D', graisse: '600' } as const;
const APERCU_LU = { encre: '#8A958F', graisse: '400' } as const;

/** Les deux fonds de rangée, relevés sur la maquette. */
const RANGEE_OUVERTE = '#E3F0EB';
const RANGEE_FERMEE = 'transparent';

/**
 * LE NOM D'UNE CONVERSATION.
 *
 * §8 : « conversation de parcours nommée par le titre du parcours ». Le serveur
 * renseigne `title` pour les conversations qu'il sait NOMMER — celle d'un parcours,
 * et depuis le lot « Contacter les modérateurs » celle de MODÉRATION D'UN RÉSEAU,
 * nommée par le nom du réseau. Il rend `null` pour une conversation directe, et
 * c'est au front de la nommer par son interlocuteur, ce que la maquette dessine
 * d'ailleurs (« Sandra M. », « Kofi Boateng »).
 *
 * ⚠ LA PRISE S'APPELLE ENCORE `estParcours` ET NE DÉSIGNE PLUS QUE LES PARCOURS.
 * Elle vaut `title !== null`, c'est-à-dire « conversation de GROUPE nommée par son
 * objet » — donc vraie aussi pour un fil de modération, où elle produit exactement
 * le bon dessin : le glyphe de groupe plutôt qu'un avatar, et les membres en
 * sous-titre. Le nom est resté celui du premier cas rencontré ; le renommer touche
 * `ecran-donnees.tsx`, `ecran.tsx` et les cadres M01, et ce n'était pas le lot.
 * REMONTÉ plutôt que laissé à deviner.
 *
 * Un membre masqué (§4, séparation mutuelle) n'est pas nommé : le serveur a déjà
 * posé `hidden`, et afficher son nom contredirait le masquage qu'il vient de faire.
 */
function nomDeConversation(c: Conversation): string {
  if (c.title !== null) return c.title;
  const visibles = c.members.filter((m) => !m.hidden).map((m) => m.displayName);
  return visibles.length === 0 ? 'Conversation' : visibles.join(', ');
}

/**
 * UNE RANGÉE DE LA LISTE.
 *
 * L'APERÇU EST PRÉFIXÉ DE SON AUTEUR, parce que la maquette le dessine ainsi —
 * « Aïcha : Tu veux que je relise ? », « Vous : parfait, merci ». L'API rend le
 * corps NU (`lastMessagePreview`), déjà DÉSCELLÉ et déjà coupé à 120 caractères par
 * le serveur. Le préfixe est donc de la mise en forme, pas une donnée inventée.
 *
 * ⚠ ET LE PRÉFIXE N'EST PAS TOUJOURS CALCULABLE : `GET /conversations` ne dit PAS
 * qui a écrit le dernier message. Il rend `lastMessagePreview` et `members[]`, sans
 * champ d'auteur. On ne peut donc pas distinguer « Aïcha : » de « Vous : », et
 * deviner serait pire que se taire. L'aperçu reste NU, et c'est consigné au rapport
 * — il manque à cette route un `lastMessageSenderUserId`.
 */
/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LE SURLIGNAGE SUIVAIT LE RANG, PAS LA CONVERSATION OUVERTE                ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « la conversation active n'est pas highlighted. Ça reste sur le
 * premier. »
 *
 * MESURÉ : `fond: rang === 0 ? …` — la première ligne de la liste était peinte,
 * toujours, quelle que soit la conversation ouverte. C'est ce que la MAQUETTE
 * dessine : sa planche montre la première ligne sélectionnée, parce qu'il faut
 * bien en dessiner une. Le transcodage l'avait pris pour une règle.
 *
 * On compare donc à l'identifiant de la conversation RÉELLEMENT ouverte. Les
 * demandes, elles, n'en ouvrent aucune : `ouverteId` y vaut `null` et aucune
 * ligne n'est peinte — ce qui est juste, une demande en attente n'est pas la
 * conversation affichée.
 */
function rangeeDe(
  c: Conversation,
  rang: number,
  fondOuverte: string,
  ouverteId: string | null,
): RangeeConversation {
  const nom = nomDeConversation(c);
  const apercu = c.unreadCount > 0 ? APERCU_NON_LU : APERCU_LU;
  return {
    fond: c.id === ouverteId ? fondOuverte : RANGEE_FERMEE,
    fondAvatar: FONDS_AVATAR[rang % FONDS_AVATAR.length] ?? FONDS_AVATAR[0],
    initiales: initialesDe(nom),
    nom,
    quand: c.lastMessageAt === null ? '' : heureRelative(c.lastMessageAt, 'heure-du-jour'),
    encre: apercu.encre,
    graisse: apercu.graisse,
    apercu: c.lastMessagePreview ?? '',
    nonLus: c.unreadCount,
    /** La ligne devient un lien : voir `RangeeConversation.href`. */
    href: `/messages/${c.id}`,
  };
}

/** Les deux bulles de la maquette, valeurs relevées sur ses planches. */
const BULLE_MIENNE = {
  cote: 'flex-end',
  rayon: '18px 18px 6px 18px',
  fond: '#16785E',
  encre: '#fff',
  trait: 'none',
} as const;

const BULLE_SIENNE = {
  cote: 'flex-start',
  rayon: '18px 18px 18px 6px',
  fond: '#fff',
  encre: '#16211D',
  trait: '1px solid #E6EBE9',
} as const;

/**
 * UNE BULLE DU FIL.
 *
 * `corps` ARRIVE DÉSCELLÉ. Il peut valoir « Message supprimé » ou « Message d'un
 * membre supprimé » — les deux substituts que le SERVEUR écrit (§5.3, §11) — et
 * l'écran les affiche tels quels : ce sont des textes de produit, pas des erreurs.
 * `null` veut dire masqué (§4), et la bulle reste vide plutôt que de porter un
 * substitut composé ici.
 *
 * `mention` PORTE L'HEURE, JAMAIS « Vu ». La maquette écrit « Vu » sous la dernière
 * bulle envoyée, et aucun accusé de lecture par message n'est exposé :
 * `conversation_members.last_read_at` existe en base, la réponse ne le rend pas.
 * Inventer un « Vu » dirait au membre que son message a été lu, ce que personne ne
 * sait ici. Signalé au porteur.
 */
/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LA BULLE PORTE LA STORY, MAIS PAS ENCORE LE GESTE                         ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le chargement est une fonction PURE : elle ne sait ni router, ni annoncer. Les
 * deux valeurs du serveur descendent donc telles quelles, et c'est
 * `ConversationVivante` — un composant, qui a le routeur et les annonces — qui
 * pose `onImage`. Mettre la navigation ici obligerait le chargeur à connaître
 * `next/navigation`, et il est appelé depuis des épreuves qui n'ont pas de
 * routeur.
 */
export interface BulleAvecStory extends BulleMessage {
  readonly storyId: string | null;
  readonly storyVivante: boolean;
}

function bulleDe(m: Message, nomsParHandle: ReadonlyMap<string, string>): BulleAvecStory {
  const style = m.mine ? BULLE_MIENNE : BULLE_SIENNE;
  return {
    cote: style.cote,
    rayon: style.rayon,
    fond: style.fond,
    encre: style.encre,
    trait: style.trait,
    auteur: m.mine ? '' : (nomsParHandle.get(m.senderHandle) ?? m.senderHandle),
    corps: m.body ?? '',
    mention: heureRelative(m.sentAt, 'heure-du-jour'),
    /**
     * L'IMAGE JOINTE — `photoFondFor` et non une recette de plus.
     *
     * C'est la fonction que le composeur de story et l'écran de lecture emploient
     * tous deux pour le même emplacement. La première version d'un fond d'image
     * dans ce dépôt écrivait `url("…")` tout nu : sans `center/cover no-repeat`, le
     * navigateur pose l'image à sa TAILLE NATURELLE et la répète — une photo de
     * téléphone remplissait la carte d'un coin agrandi, une petite image s'y
     * répétait en damier. On ne refait pas la recette.
     *
     * `recadre: false` — « couvrir » : la vignette d'un fil n'a pas de bouton de
     * recadrage, comme la carte de lecture n'en a pas.
     *
     * `mediaUrl` PEUT ÊTRE NULLE alors que `mediaId` ne l'est pas : le média a été
     * supprimé en douceur. La bulle garde alors son texte et ne montre aucun
     * rectangle — ce qui est vrai — au lieu d'une vignette vide.
     */
    image: m.mediaUrl === null ? '' : photoFondFor(urlMedia(m.mediaUrl), false),
    storyId: m.storyId,
    storyVivante: m.storyAlive,
  };
}

/** Un identifiant de conversation est un UUID, et rien d'autre n'entre dans un chemin. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * M01 — la liste, les demandes, l'en-tête et le fil.
 *
 * DEUX ROUTES, ET LA SECONDE A BESOIN DE LA PREMIÈRE. `GET /conversations/:id/messages`
 * ne rend que `senderHandle` ; les NOMS affichables vivent dans `members[]` de
 * `GET /conversations`. C'est pour cela que les deux sont lues, même sur la page
 * d'une seule conversation — et non par confort.
 *
 * `conversationId` VIENT DE L'URL, donc du public, et il entre dans un CHEMIN
 * d'API. Il est donc vérifié comme UUID avant d'être interpolé : `assertSafePath`
 * du socle attrape les remontées de répertoire, mais le filet qui compte est de ne
 * jamais mettre dans un chemin une valeur dont on n'a pas vérifié la forme. Un
 * identifiant fantaisiste rend la conversation par défaut au lieu d'un appel
 * malformé.
 *
 * ⚠ LA CONVERSATION PAR DÉFAUT EST UN CHOIX, ET IL EST DÉCLARÉ : `/messages` (sans
 * identifiant) rend sur ordinateur le cadre à DEUX VOLETS, donc un fil doit être
 * affiché alors que l'URL n'en nomme aucun. La maquette dessine la première
 * conversation de la liste ouverte (fond `#E3F0EB`) : on ouvre donc la première qui
 * n'est pas une demande en attente. C'est ce que la planche montre, pas une
 * préférence.
 *
 * `MESSAGE_POLL_INTERVAL_MS` (15 s) existe dans `packages/shared` pour le repli en
 * polling de §5.3, et il n'est PAS employé : ce lot charge une fois, au montage.
 * Rafraîchir en boucle sans que la maquette dessine d'état de rafraîchissement
 * ferait clignoter le fil sans le dire.
 */
export async function chargerM01(conversationId: string | null): Promise<M01Data> {
  const [me, page] = await Promise.all([
    fetchMe(),
    memberApi.get('/conversations', conversationsResponseSchema),
  ]);

  // §5.2 : le premier message EST la demande. Les deux listes de la maquette.
  const conversations = page.items.filter((c) => !c.pendingForMe);
  const demandes = page.items.filter((c) => c.pendingForMe);

  const demande = conversationId !== null && UUID.test(conversationId);
  const ouverte =
    (demande ? page.items.find((c) => c.id === conversationId) : undefined) ??
    conversations[0] ??
    null;

  const fil =
    ouverte === null
      ? null
      : await memberApi.get(`/conversations/${ouverte.id}/messages`, messagesResponseSchema);

  const nomsParHandle = new Map(
    (ouverte?.members ?? [])
      .filter((m) => !m.hidden)
      .map((m) => [m.handle, m.displayName] as const),
  );

  return {
    moi: barreHauteDe(me),
    conversations: conversations.map((c, rang) =>
      rangeeDe(c, rang, RANGEE_OUVERTE, ouverte?.id ?? null),
    ),
    demandes: {
      total: demandes.length,
      liste: demandes.map((c, rang) => rangeeDe(c, rang, RANGEE_FERMEE, null)),
    },
    entete: enteteDe(ouverte, me.user.id),
    /**
     * LE FIL ARRIVE À L'ENVERS, et il faut le retourner.
     *
     * `GET /conversations/:id/messages` trie `id` DESC — du plus récent au plus
     * ancien — parce que c'est ce qu'une pagination par curseur exige. La maquette
     * dessine le fil dans l'ordre de lecture, du plus ancien en haut au plus récent
     * en bas. L'afficher tel quel inverserait la conversation, et le défaut serait
     * discret : les bulles alterneraient toujours de côté, et seul le sens des
     * phrases trahirait l'inversion.
     */
    messages: fil === null ? [] : [...fil.items].reverse().map((m) => bulleDe(m, nomsParHandle)),
    /**
     * CELLE QU'ON A RÉELLEMENT OUVERTE, et pas celle que l'URL demandait.
     *
     * `/messages` n'en demande aucune : `ouverte` est alors la conversation de
     * repli, et c'est la sienne que le composeur doit écrire. Voir
     * `M01Data.conversationOuverte`.
     */
    conversationOuverte: ouverte?.id ?? null,
    conversationSourdine: ouverte?.muted ?? false,
    /**
     * LE HANDLE DE L'INTERLOCUTEUR, pour `POST /blocks` — qui prend un handle et
     * non un identifiant (08 §7.2). `null` sur une conversation de parcours : on
     * n'y bloque personne en particulier, et l'entrée du menu reste alors muette.
     */
    conversationHandle:
      ouverte === null || ouverte.title !== null
        ? null
        : (ouverte.members.find((m) => m.userId !== me.user.id && !m.hidden)?.handle ?? null),
    conversationUserId:
      ouverte === null || ouverte.title !== null
        ? null
        : (ouverte.members.find((m) => m.userId !== me.user.id && !m.hidden)?.userId ?? null),
  };
}

/**
 * L'en-tête : le nom de la conversation ouverte et ses membres.
 *
 * ⚠ LE SOUS-TITRE EST VIDE SUR UNE CONVERSATION DIRECTE, et ce n'est pas un oubli :
 * c'est un défaut vu À L'ÉCRAN, en ouvrant la page, et qu'aucun test n'aurait
 * relevé. La maquette écrit « Parcours · Aïcha (parraine), Moussa, Fanta » — un
 * TYPE suivi des membres —, ce qui a du sens pour une conversation de parcours où
 * le titre est celui du parcours et les membres sont une information de plus. Sur
 * une conversation directe, le titre EST déjà le nom de l'interlocuteur
 * (`title` vaut `null`, voir `nomDeConversation`) : y répéter la liste des membres
 * affichait « Kofi Boateng » sous « Kofi Boateng ».
 *
 * Le sous-titre ne porte donc les membres que lorsqu'il ajoute quelque chose. Et le
 * préfixe de TYPE de la maquette (« Parcours · ») n'est pas repris : `kind` vaut
 * `DIRECT`, `JOURNEY`, `MENTORSHIP` ou `COMMUNITY_MODERATION`, et aucune table de ce
 * dépôt ne donne le mot français de ces QUATRE valeurs. En inventer quatre serait
 * écrire du texte d'interface — signalé au porteur plutôt que deviné.
 *
 * Le quatrième est arrivé avec « Contacter les modérateurs » : son titre est le NOM
 * DU RÉSEAU, et le sous-titre y porte donc les membres de l'équipe, ce qui est
 * exactement l'information utile — on voit À QUI l'on écrit.
 */
function enteteDe(ouverte: Conversation | null, moiId: string): EnteteConversation {
  const vide = {
    estParcours: false,
    photo: null,
    initiales: '',
    fond: FONDS_AVATAR[0],
    profil: null,
  } as const;
  if (ouverte === null) return { nom: 'Messages', sousTitre: '', ...vide };

  const autres = ouverte.members.filter((m) => !m.hidden).map((m) => m.displayName);
  const estParcours = ouverte.title !== null;

  /**
   * ── L'INTERLOCUTEUR EST CELUI QUI N'EST PAS MOI ──────────────────────────
   *
   * `GET /conversations` rend `members[]` SANS le lecteur — c'est écrit dans le
   * service (`others`). On filtre quand même sur `moiId` : la route pourrait
   * changer, et un en-tête qui afficherait MA propre photo au-dessus de la
   * conversation serait un défaut silencieux, de ceux qu'on ne remarque qu'après
   * avoir changé d'avatar.
   *
   * `hidden` est exclu (§4) : un membre séparé du lecteur ne doit pas être
   * identifiable par son avatar alors que ses contenus sont masqués.
   */
  const lui = ouverte.members.find((m) => m.userId !== moiId && !m.hidden) ?? null;
  const nom = nomDeConversation(ouverte);

  return {
    nom,
    sousTitre: estParcours ? autres.join(', ') : '',
    estParcours,
    /**
     * UNE CONVERSATION DE PARCOURS GARDE SON GLYPHE. La maquette dessine à cet
     * endroit l'icône d'un parcours, et « Mes études à Lyon » n'est pas une
     * personne : y mettre un avatar effacerait ce que l'écran dit.
     */
    photo: estParcours || lui === null ? null : fondAvatar(lui.avatarUrl),
    initiales: estParcours ? '' : initialesDe(nom),
    fond: avatarColor(lui?.handle ?? nom),
    /**
     * `/@<handle>` ET NON `/<handle>`.
     *
     * Le porteur : « La page voir le profil ne s'affiche pas. »
     *
     * MESURÉ : la route `(app)/[handle]` EXIGE l'arobase — son segment commence
     * par `@`, et `pseudo()` rend `null` sans elle, donc `notFound()`. L'adresse
     * sans arobase répondait 404, en silence. C'est la même règle que partout
     * ailleurs dans le dépôt, et c'est consigné dans l'en-tête de
     * `components/barre-haute/membre.tsx` : « L'arobase n'est pas une décoration
     * — sans elle, le lien rend 404 ».
     */
    profil: estParcours || lui === null ? null : `/@${lui.handle}`,
  };
}

/**
 * M01BLOQUE — les mêmes données.
 *
 * L'état bloqué n'est pas une donnée de l'API mais un paramètre d'URL
 * (`?etat=bloque`) : la raison est dans `screens/m01bloque/data.ts`, et elle vaut
 * d'être lue avant de « brancher » cet écran. Ce chargeur existe pour que la page
 * bloquée ait son propre point d'entrée nommé, et non pour faire autre chose.
 */
export async function chargerM01Bloque(conversationId: string | null): Promise<M01BloqueData> {
  return chargerM01(conversationId);
}

// ─── X01 · la recherche ──────────────────────────────────────────────────────

/**
 * X01 — la requête et les suggestions.
 *
 * DEUX ROUTES, ET LA SECONDE A UN SEUIL. `GET /search/suggest` exige
 * `SUGGEST_MIN_QUERY_LENGTH` caractères (3, §2.3 « suggestions dès 3 caractères ») ;
 * en dessous, le serveur REFUSE la requête. On ne l'appelle donc pas — et c'est la
 * borne PARTAGÉE qui le dit, pas un `3` écrit ici : une borne recopiée à la main
 * devient fausse dès que la spécification bouge, et quatre l'ont déjà fait dans ce
 * dépôt.
 *
 * `GET /search` est appelée SANS `type`, donc dans sa forme GROUPÉE — c'est l'onglet
 * « Tout » que la planche dessine. `groupedSearchResponseSchema` est le schéma de
 * cette forme, et il est distinct de celui de la forme plate : voir
 * `screens/x01/data.ts`.
 *
 * ON NE LIT PAS `meta.q` POUR AFFICHER LA REQUÊTE QUAND ELLE EST VIDE : une requête
 * trop courte n'atteint pas le serveur, donc il n'y a pas de `meta` — l'écran
 * affiche alors ce que le membre a saisi, et c'est tout ce qu'il peut faire
 * honnêtement.
 */
export async function chargerX01(requete: string, type: string | null = null): Promise<X01Data> {
  const q = requete.trim();
  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ DEUX SEUILS, ET LES CONFONDRE JETAIT DES RECHERCHES VALIDES              ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur : « La recherche n'affiche rien avec "s" ? »
   *
   * MESURÉ : ce chargeur attendait `SUGGEST_MIN_QUERY_LENGTH` — TROIS caractères —
   * avant d'appeler `GET /search`. C'est le seuil des SUGGESTIONS (§2.3,
   * « suggestions dès 3 caractères »). La RECHERCHE, elle, en demande DEUX :
   * `searchQuerySchema` borne `q` à `SEARCH_MIN_QUERY_LENGTH`. Une requête de deux
   * lettres — « RH », « CV », « L1 » — était donc jetée par le front alors que le
   * serveur l'aurait servie.
   *
   * Les deux bornes viennent de `@app/shared`, là où les schémas de requête les
   * lisent : un `2` et un `3` écrits ici deviendraient faux au premier ajustement,
   * et le symptôme serait exactement celui-ci — une recherche qui ne part pas.
   */
  const assezPourChercher = q.length >= SEARCH_MIN_QUERY_LENGTH;
  const assezPourSuggerer = q.length >= SUGGEST_MIN_QUERY_LENGTH;

  /**
   * LE TYPE VIENT DE L'URL, DONC IL EST VALIDÉ ICI.
   *
   * `/recherche?type=nimportequoi` est une adresse que n'importe qui peut forger.
   * L'envoyer tel quel ferait répondre `400` au serveur, et l'écran afficherait une
   * panne pour une faute de frappe. Le schéma de `@app/shared` — celui-là même qui
   * borne le paramètre côté serveur — tranche : un type inconnu est traité comme
   * « Tout », ce qui est la lecture la plus charitable d'une URL cassée.
   */
  const filtre = searchSubjectTypeSchema.safeParse(type);
  const typeRetenu: SearchSubjectType | null = filtre.success ? filtre.data : null;

  const [me, suggestions] = await Promise.all([
    fetchMe(),
    assezPourSuggerer
      ? memberApi.get(
          `/search/suggest?q=${encodeURIComponent(q)}`,
          suggestResponseSchema,
        )
      : Promise.resolve({ items: [] as SuggestResponse['items'] }),
  ]);

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ DEUX APPELS QUAND UN FILTRE EST POSÉ, ET CE N'EST PAS UN GASPILLAGE      ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * La forme GROUPÉE (`GET /search?q=`) porte LES COMPTES DE TOUS LES TYPES, et
   * c'est la seule chose qui les porte : c'est elle qui remplit la colonne de
   * filtres. Mais elle ne rend que TROIS résultats par groupe — un plafond du
   * module, pas une pagination.
   *
   * La forme PLATE (`GET /search?q=&type=`) rend la liste complète d'UN type, et
   * aucun compte des autres.
   *
   * Un filtre posé a donc besoin des deux : les comptes pour que la colonne
   * continue de dire « Guides · 5 · Sujets · 3 » pendant qu'on regarde les guides,
   * et la liste plate pour montrer plus que trois guides. Ne demander que la plate
   * viderait la colonne dès le premier clic — le filtre se détruirait lui-même.
   * Les deux partent EN PARALLÈLE, donc le coût est une requête, pas deux attentes.
   */
  const [groupes, plats] = assezPourChercher
    ? await Promise.all([
        memberApi.get(`/search?q=${encodeURIComponent(q)}`, groupedSearchResponseSchema),
        typeRetenu === null
          ? Promise.resolve(null)
          : memberApi.get(
              `/search?q=${encodeURIComponent(q)}&type=${typeRetenu}`,
              typedSearchResponseSchema,
            ),
      ])
    : [null, null];

  const resultats = plats === null ? cartesGroupees(groupes) : cartesPlates(plats, typeRetenu);

  return {
    moi: barreHauteDe(me),
    requete: groupes?.meta.q ?? q,
    suggestions: suggestionsDe(suggestions.items, q),
    filtres: filtresDe(groupes, q, typeRetenu),
    resultats,
    vide: videDe(groupes, q, resultats),
  };
}

// ─── X02 · les notifications ─────────────────────────────────────────────────

/** Les cinq glyphes de la maquette, par categorie. Voir `x02/data.ts`. */

/** Les deux jeux de fond d'une ligne, relevés sur la maquette. */
const LIGNE_NON_LUE = { fond: '#E3F0EB', fondIcone: '#fff' } as const;
const LIGNE_LUE = { fond: '#F6F8F7', fondIcone: '#F2F5F4' } as const;

/**
 * UNE LIGNE DE NOTIFICATION.
 *
 * ⚠ `corps` PEUT ÊTRE VIDE, ET IL DOIT POUVOIR L'ÊTRE. 12 §2.4, règle dure : « un
 * push MESSAGE ne contient jamais le corps du message ». Le serveur écrit donc
 * `body: null` sur toute notification de catégorie `MESSAGE`, et
 * `notificationSchema` REFUSE la réponse si ce n'est pas le cas. Composer ici une
 * seconde ligne — « Nouveau message », « Il vous a écrit » — écrirait côté front le
 * texte que le serveur a délibérément laissé nul, et ferait de cette fonction
 * l'endroit où la règle se contourne.
 *
 * L'espace devant le corps vient de la maquette, qui écrit
 * `<strong>titre</strong> reste` : le `<strong>` ne la contient pas.
 */
function ligneDe(n: Notification): LigneNotification {
  const lu = n.readAt !== null;
  const fonds = lu ? LIGNE_LUE : LIGNE_NON_LUE;
  return {
    fond: fonds.fond,
    fondIcone: fonds.fondIcone,
    glyphe: GLYPHES_X02[n.category] ?? '',
    titre: n.title,
    corps: n.body === null ? '' : ` ${n.body}`,
    quand: heureRelative(n.createdAt, 'minutes'),
    nonLu: !lu,
  };
}

/**
 * X02 — les notifications du membre.
 *
 * `meta.unread` est lu et validé, puis N'EST AFFICHÉ NULLE PART : aucune des trois
 * planches ne dessine le compteur que 12 §2.7 demande. La raison complète est dans
 * `screens/x02/data.ts` ; elle est signalée au porteur plutôt que contournée.
 *
/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LES FILTRES ENVOIENT MAINTENANT — ET UN LIBELLÉ VAUT PARFOIS DEUX          ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « Les filtres sur la page notification marchent ? » Ils ne
 * marchaient pas, et ce commentaire disait pourquoi : « aucune n'est un bouton ».
 * Elles sont maintenant des liens, et ce chargeur reçoit ce qu'elles portent.
 *
 * LE LIBELLÉ DESSINÉ N'EST PAS UNE CATÉGORIE, et c'est le point délicat.
 * `NOTIFICATION_CATEGORIES` en compte quatorze, la maquette dessine sept
 * pastilles : « Parcours » couvre à lui seul `JOURNEY_DEADLINE` ET
 * `JOURNEY_TEAM`. La correspondance est donc une TABLE, et elle est écrite ici
 * plutôt que devinée à l'écran.
 *
 * ── UNE CATÉGORIE : LE SERVEUR FILTRE. PLUSIEURS : ON TRIE ICI ──────────────
 *
 * `notificationListQuerySchema.category` prend UNE catégorie. Pour « Parcours »,
 * demander deux pages et les recoudre donnerait un ordre faux au premier
 * `nextCursor` ; on demande donc la page SANS filtre et on garde les lignes des
 * deux catégories. C'est le même arbitrage que l'onglet « Annonces » des
 * enregistrés, et il porte la même limite : au-delà d'une page, une catégorie
 * rare peut tomber hors de la fenêtre lue. Signalé plutôt que caché — la vraie
 * correction serait un `category` répétable côté serveur.
 */
const CATEGORIES_DU_FILTRE: Readonly<Record<string, readonly NotificationCategory[]>> = {
  Parcours: ['JOURNEY_DEADLINE', 'JOURNEY_TEAM'],
  Entraide: ['HELP'],
  Réseaux: ['COMMUNITY'],
  Événements: ['EVENT'],
  Messages: ['MESSAGE'],
  Compte: ['ACCOUNT'],
};

/** L'ordre des pastilles est celui de la maquette ; « Tout » d'abord. */
const FILTRES_NOTIFICATIONS: readonly string[] = [
  'Tout',
  ...Object.keys(CATEGORIES_DU_FILTRE),
];

export function filtresNotifications(choisi: string): readonly FiltreNotification[] {
  return FILTRES_NOTIFICATIONS.map((libelle) => {
    const cle = libelle === 'Tout' ? '*' : libelle;
    const actif = cle === choisi;
    return {
      cle,
      libelle,
      href: cle === '*' ? '/notifications' : `/notifications?type=${encodeURIComponent(cle)}`,
      fond: actif ? '#16785E' : '#fff',
      texte: actif ? '#fff' : '#16211D',
      bord: actif ? '#16785E' : '#E6EBE9',
      actif,
    };
  });
}

export async function chargerX02(filtre: string = '*'): Promise<X02Data> {
  const categories = CATEGORIES_DU_FILTRE[filtre] ?? [];
  const requete =
    categories.length === 1 ? `?category=${categories[0] ?? ''}&limit=50` : '?limit=50';

  const [me, page] = await Promise.all([
    fetchMe(),
    memberApi.get(`/notifications${requete}`, notificationsResponseSchema),
  ]);

  const retenues =
    categories.length > 1
      ? page.items.filter((n) => categories.includes(n.category))
      : page.items;

  return {
    moi: barreHauteDe(me),
    lignes: retenues.map(ligneDe),
    nonLusTotal: page.meta.unread,
    filtres: filtresNotifications(categories.length === 0 ? '*' : filtre),
  };
}

/** « 1er octobre » — le `1er` que `Intl` écrit « 1 », corrigé comme la maquette l'écrit. */
const jourMoisLong = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' });

function jourMoisEcrit(iso: string): string {
  const d = new Date(iso);
  const brut = jourMoisLong.format(d);
  return d.getDate() === 1 ? brut.replace(/^1 /, '1er ') : brut;
}

/**
 * X04 — le quota d'événements de l'encart « PLAN » (14 §4.5).
 *
 * LA MÉTRIQUE PEUT ÊTRE ABSENTE, et c'est le cas d'un membre qui n'a encore créé
 * aucun événement ce mois-ci : `usage.items` ne porte alors pas `EVENTS_CREATED`.
 * On affiche zéro sur le plafond GRATUIT de `FREE_EVENTS_PER_MONTH` — la constante
 * que le serveur applique — plutôt qu'un tiret qui laisserait croire à une panne.
 * C'est exactement ce que `quotasDe` fait dans le module Services pour
 * `PRO_CONTACTS`, et la raison est la même.
 *
 * `limit: null` VEUT DIRE ILLIMITÉ, jamais zéro : §4.4 est explicite — « l'écran
 * affiche illimité, jamais 0 sur null ». Un Premium verrait « 3 événements sur 0 »
 * si on confondait les deux.
 *
 * ⚠ CE CHARGEUR N'A PAS ENCORE DE PAGE, et c'est dit plutôt que caché : aucune
 * page ne monte `X04Mobile` (T5 range ces encarts en « composants » sans route).
 * Il existe pour que le cadre lise un quota VRAI le jour où une page l'affichera,
 * au lieu du « 1 événement sur 1 » de la maquette.
 */
export async function chargerX04(): Promise<X04Data> {
  const abonnement = await memberApi.get('/me/subscription', mySubscriptionResponseSchema);
  const compteur = abonnement.usage.items.find((u) => u.metric === 'EVENTS_CREATED');
  const plafond = compteur === undefined ? FREE_EVENTS_PER_MONTH : compteur.limit;

  return {
    quota: {
      utilises: compteur?.used ?? 0,
      plafond: plafond === null ? 'illimité' : String(plafond),
      reinitialise: jourMoisEcrit(abonnement.usage.resetsAt),
    },
  };
}

/**
 * LES LIBELLÉS DE CATÉGORIE, RÉEXPORTÉS POUR N'ÊTRE PAS RECOPIÉS.
 *
 * `CATEGORY_LABELS_FR` est la source unique (00 §4), et il n'est PAS employé par
 * les cadres de ce lot : la maquette écrit « Messages » et « Compte » là où il écrit
 * « Messages privés » et « Mon compte ». L'écart est consigné, et cette
 * réexportation existe pour que le lot qui branchera les filtres parte de la table
 * partagée au lieu d'en écrire une seconde.
 */
export { CATEGORY_LABELS_FR };

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ ÉCRIRE DANS UNE CONVERSATION — LES DEUX ÉCRITURES QUI MANQUAIENT          ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « L'envoi de message aussi ne marche pas ainsi que les images dans
 * une conversation. »
 *
 * MESURÉ sur le cadre produit : la barre basse était faite de trois éléments
 * MORTS — un `<span>` pour le trombone, un `<div>` portant le texte dessiné
 * « Écrire un message… », un `<span>` vert pour la flèche. Le module avait été
 * livré en lecture seule, et son en-tête le disait.
 *
 * Les deux routes existaient depuis le début (`POST /conversations/:id/messages`
 * et `POST /media`) : il n'y avait rien à ajouter côté serveur, seulement à
 * brancher.
 *
 * `kind: 'MESSAGE'` sur le dépôt, comme la capture de story : c'est le genre que
 * `assertOwnedMedia` exige d'une pièce jointe de message, et déposer en `POST`
 * refuserait le rattachement ensuite.
 */
export function deposerImageDeMessage(
  fichier: File,
  signal?: AbortSignal,
): Promise<MediaAssetView> {
  const corps = new FormData();
  corps.append('file', fichier);
  corps.append('kind', 'MESSAGE');
  return memberApi.post('/media', mediaAssetSchema, {
    body: corps,
    ...(signal === undefined ? {} : { signal }),
  });
}

/**
 * LA FORME DE LA RÉPONSE EST DÉCLARÉE ICI, parce que `packages/shared` ne la
 * publie pas : la route rend `{ messageId, conversationId, sentAt }` et aucun
 * schéma de sortie ne la décrit. On la décrit donc au point d'appel, comme
 * `ecrireAAuteur` le fait déjà pour `POST /conversations/direct` — et avec
 * `.strict()`, pour que la frontière reste aussi serrée que partout ailleurs.
 */
const reponseEnvoiSchema = z
  .object({
    messageId: uuidSchema,
    conversationId: uuidSchema,
    sentAt: z.string(),
  })
  .strict();

/**
 * `body` N'EST ENVOYÉ QUE S'IL Y EN A UN.
 *
 * `sendMessageSchema` accepte maintenant un message sans corps quand il porte une
 * image — il le fallait pour envoyer plusieurs photos sans écrire autant de
 * phrases. Mais le schéma est `.strict()` ET le champ est `.optional()` : envoyer
 * `body: ''` serait refusé pour chaîne vide, alors que l'OMETTRE passe. La
 * différence entre « vide » et « absent » compte ici.
 */
export function envoyerMessage(
  conversationId: string,
  texte: string,
  mediaId?: string,
): Promise<{ readonly messageId: string }> {
  return memberApi.post(`/conversations/${conversationId}/messages`, reponseEnvoiSchema, {
    body: {
      ...(texte === '' ? {} : { body: texte }),
      ...(mediaId === undefined ? {} : { mediaId }),
    },
  });
}

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LES DEUX ÉCRITURES DU MENU DE CONVERSATION                                ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « Les options voir le profil, mettre en sourdine, bloquer et
 * signaler ne marchent pas. Intègre tout ça. »
 *
 * Deux des quatre sont des NAVIGATIONS — le profil public et la feuille de
 * signalement — et le cadre les porte en liens. Les deux autres écrivent, et les
 * voici.
 *
 * `PATCH /conversations/:id/mute` est NEUF : la colonne
 * `conversation_members.is_muted` existait dans le schéma figé depuis le début et
 * aucune route ne l'écrivait. Aucune migration, donc.
 *
 * `POST /blocks` existait déjà, et prend un HANDLE — pas un identifiant. C'est
 * `08 §7.2`, et c'est cohérent avec le reste du module : on bloque quelqu'un
 * qu'on voit, et ce qu'on voit c'est son arobase.
 */
export function mettreEnSourdine(
  conversationId: string,
  muted: boolean,
): Promise<{ readonly muted: boolean }> {
  return memberApi.patch(
    `/conversations/${conversationId}/mute`,
    z.object({ muted: z.boolean() }).strict(),
    { body: { muted } },
  );
}

export function bloquerMembre(handle: string): Promise<unknown> {
  /**
   * LA RÉPONSE N'EST PAS LUE, et le schéma le dit : `POST /blocks` rend la ligne
   * de blocage créée, dont l'écran n'a besoin d'aucun champ. `z.unknown()` plutôt
   * qu'une forme recopiée : une forme qu'on n'utilise pas finirait par diverger
   * du serveur sans que personne ne s'en aperçoive, et ferait alors échouer un
   * blocage parfaitement réussi.
   */
  return memberApi.post('/blocks', z.unknown(), { body: { handle } });
}

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ SIGNALER — LA ROUTE EXISTAIT, RIEN N'Y MENAIT                             ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « le modal n'est pas du tout dynamique (pas d'input, les choix ne
 * marchent pas ainsi que la soumission) ».
 *
 * `POST /reports` répond depuis le début ; l'en-tête de la page de messagerie le
 * disait en toutes lettres — « "Envoyer le signalement" est inerte : `POST
 * /reports` existe mais ce lot ne branche aucune écriture ». Il ne manquait que
 * le branchement.
 *
 * `subjectType: 'USER'` ET `subjectId` = L'INTERLOCUTEUR. On signale la PERSONNE,
 * pas un message précis : le menu s'ouvre depuis l'en-tête de la conversation, pas
 * depuis une bulle, et la planche écrit « La conversation sera visible des
 * modérateurs » — ce qui est la règle attachée au signalement d'un membre avec
 * qui on converse. Signaler un message demanderait un déclencheur par bulle, que
 * la maquette ne dessine pas.
 *
 * `details` N'EST ENVOYÉ QUE S'IL Y EN A : `createReportSchema.details` est
 * `.optional()` avec un `min(1)`. Une chaîne vide serait refusée, alors que
 * l'omettre passe — la même distinction que sur le corps d'un message.
 */
export function signaler(
  /**
   * LE GENRE DU SUJET EST UN PARAMÈTRE, et plus `'USER'` en dur.
   *
   * Le porteur : « sur les publications le signalement des commentaires ne
   * marche pas non plus. » La même fenêtre sert donc à deux sujets —
   * `USER` depuis le menu d'une conversation, `COMMENT` depuis un commentaire —
   * et `ReportSubjectType` en nomme douze. Figer le genre ici aurait obligé à
   * écrire une seconde fonction par sujet branché.
   */
  subjectType: string,
  subjectId: string,
  reason: string,
  details: string,
): Promise<unknown> {
  return memberApi.post('/reports', z.unknown(), {
    body: {
      subjectType,
      subjectId,
      reason,
      ...(details.trim() === '' ? {} : { details: details.trim() }),
    },
  });
}
