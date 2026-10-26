/**
 * Les PRISES de l'écran A09 — « un sujet du réseau ».
 *
 * Déclarées et non déduites d'un exemple : voir l'en-tête de `a07/data.ts`.
 *
 * ── LA PORTE DE DERRIÈRE ───────────────────────────────────────────────────
 *
 * Cet écran lit `GET /topics/:id`, qui atteint un sujet par son identifiant
 * propre SANS passer par son réseau. C'est le chemin qu'une fuite emprunte,
 * parce qu'il ne ressemble pas à une lecture de réseau — et c'est justement
 * celui-là qu'on oublie de garder.
 *
 * Il EST gardé : mesuré, à un non-membre d'un réseau `PUBLIC`, la route répond
 * `403 FORBIDDEN` / `NOT_A_MEMBER`, comme les sept routes de contenu. L'écran ne
 * doit donc jamais s'en servir pour afficher un sujet qu'il n'a pas pu obtenir
 * par la liste du réseau, et `use-sujet.ts` laisse remonter le refus au lieu de
 * le convertir en page vide.
 */
export { EYE, I, LOCK, PIN, panel, panelReseaux, rail } from '../reseaux/chrome';
import { EYE, LOCK, PIN, panel, panelReseaux, rail } from '../reseaux/chrome';

/**
 * Une réponse au sujet.
 *
 * `indent` / `indentM` portent l'unique niveau de réponse autorisé — 48 px sur
 * ordinateur, 34 px sur mobile. Ils se lisent de `parentCommentId`, que le
 * service renvoie ; les réponses arrivent À PLAT et l'imbrication n'est pas
 * donnée.
 *
 * `canReply` suit la PROFONDEUR et non un droit : on répond à une racine, jamais
 * à une réponse.
 *
 * `guide` est `null` partout. La maquette dessine la prise d'un guide lié sous
 * une réponse, mais aucune réponse de sujet n'en porte dans aucune charge
 * relevée. Remonté plutôt que rempli d'un guide inventé.
 */
export interface CommentRowView {
  /**
   * L'ADRESSE DU PROFIL PUBLIC — `/@handle`, ou absente.
   *
   * Le porteur : « ajoute l'accès au profil public d'un utilisateur à partir des
   * publications (quand on clique sur son nom […]) partout où le nom est
   * affiché ». Les trente-sept noms dessinés dans les cadres étaient des `<span>`
   * et aucun ne menait au profil.
   *
   * FACULTATIVE, ET C'EST LA GARDE : tous les noms ne sont pas des membres — un
   * réseau, une ville, un partenaire en portent un aussi — et le cadre ne pose le
   * lien que si la ligne porte une adresse. Sans elle, le nom reste nu, c'est-à-
   * dire exactement le dessin d'avant.
   */
  readonly profil?: string;
  readonly i: string;
  readonly bg: string;
  readonly name: string;
  readonly text: string;
  readonly time: string;
  readonly indent: string;
  readonly indentM: string;
  readonly canReply: boolean;
  readonly guide: null;
  readonly commentId: string;
}

/**
 * Les trois actions de modération, telles que la maquette les dessine.
 *
 * Elles sont MONTRÉES d'après `canPin` et `canResolve`, que le serveur recalcule
 * à chaque lecture du sujet — jamais d'après un rôle que l'écran aurait gardé.
 * Et le geste est TENTÉ : si le droit a changé entre-temps, c'est le serveur qui
 * refuse, pas une copie périmée.
 *
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LE LIBELLÉ EST UNE DONNÉE — ET C'EST CE QUI PERMET « REMETTRE »            ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * La maquette dessine cette carte avec un `<sc-for>` : `label` et `icon` sont
 * déjà des prises, et le dessin n'écrit aucun des trois mots en dur. L'entrée de
 * masquage peut donc dire la vérité de l'état sans qu'on redessine quoi que ce
 * soit — « Masquer » sur un sujet visible, « Remettre dans le réseau » sur un
 * sujet masqué.
 *
 * C'est exactement ce que `M01_MENU` fait déjà pour la sourdine d'une
 * conversation, et pour la même raison, écrite là-bas : « une entrée qui dit
 * "Mettre en sourdine" sur une conversation DÉJÀ en sourdine ment ». Un sujet
 * masqué dont l'entrée dit encore « Masquer » ment de la même façon.
 *
 * `onClick` est FACULTATIF, et c'est la garde : les trois entrées n'ont pas
 * toutes un geste branché (voir `use-sujet.ts` — il n'existe pas d'état « clos »
 * dans `TopicStatus`, et « Épingler » ne dit pas LEQUEL des trois `pin_kind`).
 * Sans geste, le contrôle s'éteint et dit pourquoi, au lieu de rester le
 * `href="#"` mort qu'il était.
 */
export interface ModActionView {
  readonly label: string;
  /** Le tracé SVG dessiné par la maquette. */
  readonly icon: string;
  readonly onClick?: (() => void) | undefined;
}

export const modActions: readonly ModActionView[] = [
  { label: 'Épingler', icon: PIN },
  { label: 'Clore le sujet', icon: LOCK },
  { label: 'Masquer', icon: EYE },
];

export const comments: readonly CommentRowView[] = [];

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LA TÊTE DU SUJET ÉTAIT PEINTE EN DUR — LES DEUX CADRES NOMMAIENT LE MÊME  ║
 * ║ SUJET, QUEL QUE SOIT CELUI DE L'URL                                        ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * MESURÉ, et c'est la raison d'être de cette prise : avant ce lot, `A09Data` ne
 * portait QUE `comments`. Le titre (« Renouveler son passeport béninois depuis la
 * France »), le corps, l'auteur (« Marc Koudou », « MK »), la pastille d'état
 * (« Ouvert »), celle d'épinglage et le fil d'Ariane (« Béninois en France ·
 * Sujets ») étaient des littéraux du transcodage, sur les DEUX planches. Ouvrir
 * n'importe quel sujet de n'importe quel réseau affichait ce même sujet-là, avec
 * les vraies réponses en dessous — le pire des deux, puisque le bas de la page
 * disait la vérité et le haut non.
 *
 * ── POURQUOI C'EST DANS LE MÊME LOT QUE LES GESTES ─────────────────────────
 *
 * « Marquer résolu » est inutile sans cette prise : le geste réussit, le serveur
 * renvoie `status: 'RESOLVED'`, et la pastille continue d'afficher « Ouvert »
 * parce qu'elle est dessinée. Du point de vue de qui s'en sert, le bouton ne
 * fait rien. `etat` / `etatBg` / `etatFg` sont donc ce qui rend le geste VISIBLE.
 *
 * ── CE QUE L'API NE DIT PAS, ET QU'ON NE FABRIQUE PAS ──────────────────────
 *
 * La maquette écrit sous le nom de l'auteur « Installé · Paris · il y a 3 j »
 * (1 440 px) et « Paris · 3 j » (390 px). `communityAuthorSchema` ne porte que
 * `id`, `handle` et `displayName` : NI la phase, NI la ville, NI d'avatar. On
 * n'écrit donc que ce qu'on sait — la durée écoulée — et les deux autres morceaux
 * sont REMONTÉS plutôt qu'inventés.
 *
 * Pas de `profil` non plus sur l'auteur du sujet, alors que `handle` est là :
 * `NOM_VERS_PROFIL` ne s'accroche qu'aux vues de boucle (`{c.name}`), et un lien
 * sur la tête demanderait sa propre déclaration. Remonté.
 */
export interface SujetTeteView {
  /** `title`. */
  readonly titre: string;
  /** `body`. */
  readonly corps: string;
  /** « Ouvert » · « Résolu » · « Archivé » — de `status`, par `TOPIC_STATE`. */
  readonly etat: string;
  /**
   * Les deux couleurs de la pastille d'état.
   *
   * Ce ne sont pas des couleurs nouvelles : ce sont `stBg` / `stFg` de
   * `topicRowTint`, celles que les lignes de sujets de A08 emploient déjà pour le
   * même `status`. Deux tables de couleurs pour la même donnée divergeraient au
   * premier ajout, et aucune n'est assombrie.
   */
  readonly etatBg: string;
  readonly etatFg: string;
  /**
   * `pinKind !== 'NONE'`. La pastille « Épinglé » passe sous `<sc-if>` : la
   * maquette la dessine toujours, et un sujet non épinglé l'affichait donc.
   */
  readonly epingle: boolean;
  /** Une ou deux majuscules du nom de l'auteur (`initials`). */
  readonly auteurI: string;
  readonly auteurNom: string;
  /** La couleur du rond, DÉRIVÉE du `handle` — stable, jamais tirée au hasard. */
  readonly auteurBg: string;
  /**
   * « il y a 3 j », de `createdAt`.
   *
   * C'est TOUT ce que la ligne peut dire : voir l'en-tête de cette interface pour
   * ce que la maquette dessine en plus et que l'API ne porte pas.
   */
  readonly auteurQuand: string;
  /** Le nom du réseau — fil d'Ariane sur ordinateur, en-tête sur mobile. */
  readonly reseauNom: string;
  /** `/reseaux/:slug` — le fil d'Ariane était un `<a href="#">`. */
  readonly reseauHref: string;
}

/**
 * LA TÊTE D'ATTENTE, et elle est VIDE À DESSEIN.
 *
 * Un repli qui écrirait « Renouveler son passeport béninois depuis la France »
 * referait exactement le défaut que ce lot corrige, de façon intermittente donc
 * invisible aux tests. `etat` est vide — pas « Ouvert » : affirmer qu'un sujet
 * est ouvert avant de l'avoir lu est une affirmation, pas un chargement.
 *
 * `etatBg` / `etatFg` gardent les couleurs de la pastille neutre pour que la
 * forme ne saute pas quand la donnée arrive ; `page.tsx` n'affiche de toute façon
 * ce repli que le temps de l'appel.
 */
export const teteVide: SujetTeteView = {
  // `'—'` et non `''` (lot w5b) : le titre du sujet est un `<h1>` ; vide, c'est `empty-heading`.
  // Un tiret n'affirme aucun titre — voir l'en-tête de réseau, `a08t/data.ts`.
  titre: '—',
  corps: '',
  etat: '',
  etatBg: '#F2F5F4',
  etatFg: '#5D6B66',
  epingle: false,
  auteurI: '',
  auteurNom: '',
  auteurBg: '#F2F5F4',
  auteurQuand: '',
  reseauNom: '',
  reseauHref: '/reseaux',
};

export interface A09Data {
  rail: typeof rail;
  shortcuts: readonly { name: string; sub: string; i: string; bg: string }[];
  panelReseaux: ReturnType<typeof panel>;
  comments: readonly CommentRowView[];
  modActions: readonly ModActionView[];
  /** La tête du sujet — voir `SujetTeteView`. */
  sujet: SujetTeteView;

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ ON POUVAIT LIRE UN SUJET, PAS Y RÉPONDRE                                ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * MESURÉ : les deux planches dessinent une barre de réponse — « Répondre au
   * sujet… » puis « Envoyer » (1 440 px) ou un rond vert fléché (390 px). La
   * ligne d'invite était un `<div>` portant ce texte en dur, et le bouton n'avait
   * aucun `onClick`. Trente-trois cadres du module, zéro champ.
   *
   * ── LA ROUTE N'EST PAS SOUS `/topics` ──────────────────────────────────────
   *
   * Il n'existe AUCUN `POST /topics/:id/replies` : vérifié route par route dans
   * `communities.controller.ts`, qui n'a que `GET`, `PATCH` et `DELETE` sur
   * `topics/:id`. Les réponses d'un sujet sont des `Comment` de la table
   * polymorphe — `communities.service.ts` les lit en
   * `{ subjectType: 'TOPIC', subjectId: topic.id }` — et on les écrit donc par
   * `POST /comments`, la route que `screens/accueil/api.ts` appelle déjà pour les
   * commentaires d'une publication. On l'IMITE, on ne la réécrit pas.
   *
   * ── ET C'EST UNE CAPACITÉ N0, PAS N1 ──────────────────────────────────────
   *
   * `comment.create` est en N0 (table `capabilities.ts`, et le contrôleur le
   * déclare : « §2.5 : Capacité `comment.create` (L0) — un pré-départ
   * participe »). Aucune `FenetreNiveau` n'est donc ouverte ici : ce serait
   * refuser au front ce que le serveur accepte. `post.create` (N1) concerne
   * OUVRIR un sujet, pas y répondre.
   */
  reponseTexte: string;
  onReponseTexte: (event: { target: { value: string } }) => void;
  onEnvoyerReponse: () => void;
  /** Éteint tant qu'il n'y a rien à envoyer, et pendant l'envoi. */
  reponseBloquee: boolean;

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ « MARQUER RÉSOLU » — DEUX BOUTONS DESSINÉS, AUCUN BRANCHÉ               ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * `PATCH /topics/:id` avec `{ status: 'RESOLVED' }`, et `use-sujet.ts` portait
   * déjà `resoudre()` depuis le branchement du module : il manquait le fil entre
   * le bouton et lui, sur les deux planches.
   *
   * `resoudreVisible` suit `canResolve`, que le SERVEUR recalcule à chaque
   * `GET /topics/:id` — « l'auteur marque résolu, un modérateur clôt ». Ce n'est
   * pas une autorisation que le front s'accorde : c'est le droit tel que le
   * serveur vient de le dire, et le geste est tenté de toute façon — s'il a
   * changé entre-temps, c'est le serveur qui refuse.
   *
   * ⚠ DISTINCT DU NIVEAU. On ÉTEINT un bouton d'après un RÔLE, jamais d'après un
   * niveau : `content.read` est en N0, et cacher ce bouton à un N0 serait
   * remplacer la garde du serveur par une garde du front (mémo §5).
   *
   * `resoudreBloque` vaut pendant l'envoi ET quand le sujet n'est plus `OPEN` :
   * repatcher `RESOLVED` sur un sujet résolu est un appel qui ne dit rien.
   */
  resoudreVisible: boolean;
  resoudreBloque: boolean;
  onResoudre: () => void;
}

export const shortcuts: readonly { name: string; sub: string; i: string; bg: string }[] = [];

export const a09Fallback: A09Data = {
  rail,
  shortcuts,
  panelReseaux,
  comments,
  modActions,
  sujet: teteVide,
  reponseTexte: '',
  onReponseTexte: () => undefined,
  onEnvoyerReponse: () => undefined,
  reponseBloquee: true,
  resoudreVisible: false,
  resoudreBloque: true,
  onResoudre: () => undefined,
};
