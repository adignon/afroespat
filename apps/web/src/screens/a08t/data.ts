/**
 * Les PRISES des vingt-cinq planches d'onglet de A08T.
 *
 * ── POURQUOI CE FICHIER EXISTE ──────────────────────────────────────────────
 *
 * Les vingt-cinq planches lisaient `AccueilData`, le type partagé par dix-sept
 * écrans — et elles n'en lisaient RIEN : leur signature était `(_props:
 * AccueilData)`, le souligné disant que le paramètre n'est pas lu. Elles
 * écrivaient « Béninois en France », « 890 membres » et « Public » EN DUR, sur
 * les vingt-cinq. Un membre de « Sénégalais à Paris » ouvrait son onglet
 * « Membres » et lisait le nom d'un autre réseau.
 *
 * Les prises sont donc DÉCLARÉES, comme celles de `a07/data.ts` et `a08/data.ts` :
 * elles disent ce que le JSX transcodé LIT, ni plus ni moins. La liaison, elle,
 * est déclarée avec l'écran dans `tools/screens/03-accueil.mjs` — clé `donnees`.
 *
 * ── LA RÈGLE LA PLUS GRAVE DU MODULE, ET OÙ ELLE SE TIENT ICI ──────────────
 *
 * « Aucune fuite entre réseaux » : un membre ne voit pas le contenu d'une
 * communauté dont il n'est pas membre. Elle se tient CÔTÉ SERVEUR — les sept
 * routes de contenu répondent `403 NOT_A_MEMBER` — et l'en-tête public ne porte
 * que les quatorze champs de `communityPublicSchema`.
 *
 * Ce fichier ne lit QUE ces quatorze champs, et le choix de `memberCount` est la
 * raison pour laquelle cette note existe : `counters.members` arrive MASQUÉ pour
 * un passant (mesuré : `counters.topics` vaut 1 pour un membre et 0 pour un
 * passant, à la même seconde, sur le même réseau PUBLIC), là où `memberCount`
 * est public et vrai pour tout le monde. Lire `counters.members` afficherait
 * « 0 membre » sur un réseau de 890 personnes dès qu'on n'en est pas membre.
 *
 * ── CE QUE LA MAQUETTE DEMANDE ET QUE LE BACK NE SAIT PAS DIRE ─────────────
 *
 * `moderateurs` et `demandes` sont les deux seules prises sans source exacte.
 * `GET /communities/:id/members?role=MODERATOR` et `?pending=true` rendent bien
 * les LISTES, mais `communityMembersResponseSchema` est un `pageSchema` SANS
 * `meta` : le serveur ne renvoie aucun total, et le service ne le calcule pas
 * (vérifié dans `communities.service.ts`, `members()` rend `{ items, nextCursor }`
 * et rien d'autre).
 *
 * On lit donc la première page et on compte ses éléments, et c'est juste TANT QUE
 * `nextCursor` est nul — c'est-à-dire tant que la liste entière tient dans une
 * page. `complet` le dit, et `use-reseau.ts` ne remplit le nombre que dans ce
 * cas. REMONTÉ : il faudrait un `meta.count` sur cette route, comme
 * `GET /me/connections` en porte un.
 */
import {
  announcementTitleSchema,
  createAnnouncementSchema,
  type Capability,
  type CommunityDetailResponse,
} from '@app/shared';
/**
 * LE CONTRAT DE LA CARTE DU FIL, EMPRUNTÉ À A01 ET NON RECOPIÉ.
 *
 * `import type` : le lien est de TYPE seulement, donc effacé à la compilation et
 * sans cycle de modules à l'exécution — c'est la même précaution que l'en-tête de
 * `DemandeRowView` prend déjà pour `from-api.ts`. Le profil public emprunte le
 * même contrat au même endroit (`screens/compte/data.ts`).
 */
import type { FeedPostView } from '../a01/data';
import {
  actionsVides,
  aproposVide,
  colonneVide,
  composeurVide,
  filtreMembresVide,
  outilsVides,
  pilotageVide,
  videsVides,
  type AProposReseauView,
  type ActionsReseauView,
  type ColonneReseauView,
  type ComposeurReseauView,
  type FiltreMembresView,
  type OutilsReseauView,
  type PilotageReseauView,
  type VidesReseauView,
} from './vivant';

export { CHAT, I, PIN, netTabsFor, panel, panelReseaux, rail, tab } from '../reseaux/chrome';

/**
 * UNE DEMANDE D'ADHÉSION, telle que la planche « Gérer » la dessine.
 *
 * Déclarée ICI et non dans `from-api.ts`, bien que ce soit lui qui la
 * construise : `from-api` importe DÉJÀ de ce fichier (`GENRE`, `ROLE`,
 * `VISIBILITE`, `ReseauEnteteView`), et déclarer la forme là-bas rendrait le
 * cycle réciproque. Il est de type seulement aujourd'hui, donc effacé à la
 * compilation — mais un prochain lot qui importerait une VALEUR dans l'autre
 * sens le rendrait réel, et un cycle de modules ne se voit qu'à l'exécution.
 *
 * ⚠ `mot` EST UN ÉCART DE MAQUETTE, et le convertisseur le rend VIDE. La planche
 * écrit sous chaque demande une phrase de motivation entre guillemets —
 * « Je pars à Lyon en septembre pour mes études. » — et l'API n'a rien de tel :
 * ni `communityMemberSchema` (neuf champs, aucun message), ni la table
 * `community_members`. `POST /communities/:id/join` ne prend aucun corps. Le
 * cadre lie donc le nœud ENTIER, guillemets compris puisque la maquette les
 * écrit dans le même nœud de texte : rien ne s'affiche, plutôt qu'une phrase
 * inventée ou une paire de guillemets vides. REMONTÉ.
 */
export interface DemandeRowView {
  readonly userId: string;
  readonly i: string;
  readonly bg: string;
  readonly name: string;
  readonly sub: string;
  readonly mot: string;
}

/**
 * UNE LIGNE DE MEMBRE de l'onglet « Membres » — LES QUATRE PLANCHES, et non
 * les deux de la vue propriétaire.
 *
 * ⚠ CET EN-TÊTE DISAIT « de la planche « Membres — propriétaire » », ET CE
 * N'EST PLUS VRAI : les deux planches de la vue MEMBRE (1 036 px et 390 px)
 * lisent maintenant la même liste. Elles peignaient cinq et quatre membres EN
 * DUR — Aïcha Diop, Marc Koudou, Sandra M., Fatou Ndiaye, Kofi Boateng — sur
 * tous les réseaux du produit.
 *
 * ── LES DEUX VUES NE DESSINENT PAS LA MÊME LIGNE ──────────────────────────
 *
 * RELEVÉ, pas supposé : la ligne du PROPRIÉTAIRE finit par une poignée « ··· »
 * (le tracé `M5 12h.01M12 12h.01M19 12h.01`) qui ouvre le menu de rôle ; celle
 * du MEMBRE finit par un bouton « Écrire » de 36 px, et seulement à 1 036 px —
 * la planche de 390 px de la vue membre n'en dessine AUCUN. Quatre dessins, une
 * seule donnée : c'est pour cela que ce type porte à la fois `nommable` (que
 * seul le menu lit) et `handle` (que seul « Écrire » lit).
 *
 * `nommable` dit si l'entrée « Nommer modérateur·rice » du menu a un sens. Ce
 * n'est PAS une autorisation — le front prévient, il n'autorise pas (mémo §5) —
 * c'est le LIBELLÉ : nommer modérateur quelqu'un qui l'est déjà n'a aucun sens,
 * et la maquette ne dessine aucun libellé pour le geste inverse. L'entrée
 * disparaît donc plutôt que de mentir, et la RÉVOCATION d'un rôle reste non
 * branchée faute de mot dessiné. REMONTÉ.
 *
 * ⚠ LA COCHE VERTE QUI SUIT CHAQUE NOM N'A AUCUNE SOURCE, et elle reste
 * dessinée. La maquette la pose sur les NEUF lignes des quatre planches, sans
 * exception, et `communityMemberSchema` ne porte aucun champ de vérification —
 * ni `verified`, ni `verificationLevel`, ni `kyc`. On ne l'invente pas (il
 * faudrait décider qu'elle veut dire « N1 », ce qui est un arbitrage produit) et
 * on ne la retire pas (ce serait réécrire la maquette). REMONTÉ : il faudrait un
 * champ sur la route des membres, ou le retrait de la coche du dessin.
 */
export interface MembreAdminRowView {
  readonly userId: string;
  /**
   * LE PSEUDO, et non l'identifiant : `POST /conversations/direct` prend un
   * `toHandle` (`createDirectConversationSchema`), et `GET /conversations`
   * n'expose que des `handle` sur ses membres. Le `userId` sert aux gestes de
   * modération, qui passent par `/members/:userId` — les deux clés coexistent
   * parce que deux modules les demandent différemment, pas par redondance.
   */
  readonly handle: string;
  readonly i: string;
  readonly bg: string;
  readonly name: string;
  readonly sub: string;
  readonly roleNom: string;
  readonly roleBg: string;
  readonly roleFg: string;
  readonly nommable: boolean;
  /**
   * L'entrée « Retirer le rôle de modérateur » a-t-elle un sens ? Vrai sur un
   * MODÉRATEUR, et seulement là — le geste inverse de `nommable`, que la
   * maquette ne dessinait pas (l'en-tête ci-dessus le remontait). Le serveur
   * reste seul juge : `updateMember` refuse ce que le lecteur ne peut pas faire.
   */
  readonly revocable: boolean;
}

/**
 * L'en-tête du réseau, tel que les vingt-cinq planches le lisent.
 *
 * Tous les champs sont des CHAÎNES DÉJÀ FORMULÉES, sauf les deux compteurs : la
 * maquette écrit « 890 membres » et « réseau de pays », pas un nombre et un
 * `enum`. Les formuler ici — et non dans le JSX — garde le cadre transcodé
 * identique à ce que la maquette dessine.
 *
 * `moderateurs` et `demandes` sont des NOMBRES parce que le dialecte les met
 * sous `<sc-if>` : à zéro la pastille des demandes disparaît, au lieu d'afficher
 * un rond orange vide. Une chaîne vide ne serait pas fausse, mais `'0'` serait
 * vrai ET visible, ce qui est le pire des deux.
 */
export interface ReseauEnteteView {
  /** `name`. */
  readonly nom: string;
  /** Une ou deux majuscules, dérivées du nom (`initials`). */
  readonly initiales: string;
  /** « 890 membres », de `memberCount` — PUBLIC, jamais `counters.members`. */
  readonly membres: string;
  /**
   * Le même nombre SANS son mot, pour la tuile de « Gérer » qui met « 890 » en
   * 20 px et « membres » en 11,5 px sur deux lignes. C'est la même donnée, mise
   * en forme deux fois par la maquette — pas deux données.
   */
  readonly membresNombre: string;
  /** « réseau de ville » · « réseau de pays » · « réseau d'intérêt », de `kind`. */
  readonly genre: string;
  /**
   * Le même genre EN UN MOT — « Ville », « Pays », « Intérêt » — pour la tuile
   * « catégorie » de la carte « À propos ».
   *
   * Ce ne sont pas des mots nouveaux : ce sont ceux que `a07/data.ts` met déjà
   * sur les pastilles de la découverte (`KIND_LABEL`). Deux tables de mots pour
   * le même `kind` divergeraient au premier ajout.
   */
  readonly genreCourt: string;
  /**
   * L'année de création, pour la tuile « créé en ».
   *
   * Découpée sur la chaîne ISO que le serveur envoie, JAMAIS calculée depuis
   * l'horloge du navigateur : c'est le même principe que `active` et
   * `appealable` sur K09. Une machine décalée afficherait une autre année, et le
   * 31 décembre à 23 h elle en afficherait une autre pour tout le monde.
   */
  readonly creeEn: string;
  /**
   * LA LIGNE DE RÉSUMÉ ENTIÈRE, séparateurs compris — et c'est la seule prise de
   * ce fichier dont la forme a été décidée EN REGARDANT l'écran.
   *
   * A08 est le seul écran du module qu'un PASSANT peut ouvrir, et `myRole` y est
   * nul. Le cadre de A08 dessine « 890 membres · réseau de pays · vous êtes
   * membre » : lié en trois interpolations, comme sur les planches A08T, il
   * laisserait sur l'écran d'un passant « 99 membres · réseau de pays · » — un
   * séparateur orphelin en bout de ligne. Pire, le repli de chargement donnait
   * « · · » tout seuls, à côté d'une pastille contenant un point.
   *
   * Les séparateurs sont du DESSIN : ils sont dans le JSX transcodé, pas dans la
   * donnée, et on ne peut donc pas les faire disparaître depuis ici — à moins de
   * lier la ligne entière, ce que fait cette prise. `resumeReseau()` ne joint que
   * les morceaux PRÉSENTS.
   */
  readonly resume: string;
  /**
   * LA MÊME LIGNE SANS LE GENRE — la planche de 390 px de A08, et elle seule.
   *
   * Ce n'est pas une variante de confort : la maquette n'y écrit QUE deux
   * morceaux, « 890 membres · vous êtes membre ». Lui servir `resume`
   * ajouterait « réseau de pays » à un dessin qui ne le porte pas, c'est-à-dire
   * redessinerait la planche depuis la donnée.
   *
   * ⚠ POURQUOI ELLE EXISTE : le cadre de 390 px écrivait encore le littéral
   * « 890 membres · vous êtes membre » pendant que celui de 1 440 px disait la
   * vérité — la liaison d'origine portait `frames: ['Desktop']`. C'est le
   * piège n° 5 du mémo d'amorçage, pris sur le fait, et il n'est jamais remonté
   * parce que le seul test de cet en-tête se SAUTE à 390 px.
   */
  readonly resumeCourt: string;
  /**
   * La même ligne pour la VUE PROPRIÉTAIRE, où la maquette ajoute « vous gérez ce
   * réseau avec N modérateurs ».
   *
   * Une prise à part et non un paramètre, parce que les deux cadres sont deux
   * cadres : la planche membre et la planche propriétaire ne dessinent pas le
   * même texte, et le transcodage ne choisit pas — il rend les deux.
   *
   * La clause des modérateurs n'est écrite QUE si le nombre est connu. Vu à
   * l'écran : avec trois interpolations autour d'un texte dessiné, un nombre
   * inconnu donnait « vous gérez ce réseau avec 0 modérateurs », c'est-à-dire une
   * affirmation fausse là où il n'y avait qu'une ignorance.
   */
  readonly resumeProprietaire: string;
  /**
   * La PHRASE d'appartenance de la vue membre : « vous êtes membre ».
   *
   * Distincte de `monRole` et ce n'est pas du zèle : la maquette écrit la phrase
   * entière sur les planches d'ordinateur de la vue membre, et le NOM seul
   * (« propriétaire ») sur les planches mobiles de la vue propriétaire. Une prise
   * unique obligerait l'une des deux à mentir sur la forme.
   */
  readonly monAppartenance: string;
  /** Le nom du rôle seul : « propriétaire » · « modérateur » · « membre ». */
  readonly monRole: string;
  /** « Public » · « Sur demande » · « Privé », de `visibility`. */
  readonly visibilite: string;
  /**
   * L'adresse ABSOLUE de la couverture (`coverUrl` passé par `urlMedia`), ou
   * `null`. Le bandeau la pose en `backgroundImage` PAR-DESSUS sa teinte
   * dessinée (`#CFE3DA`) : sans couverture, c'est exactement la maquette.
   */
  readonly couverture: string | null;
  /**
   * L'adresse ABSOLUE du logo (`logoUrl` par `urlMedia`), ou `null` : le carré
   * garde alors ses initiales, comme la maquette le dessine.
   */
  readonly logo: string | null;
  /** `description`, qui est NULLABLE : les réseaux automatiques n'en ont pas. */
  readonly description: string;
  /**
   * La longueur de la description, pour le compteur « 184 / 500 » de la planche
   * d'édition. Comptée sur le texte MÊME, et non reçue du serveur : deux façons
   * de compteriez divergeraient au premier caractère combiné.
   *
   * Le plafond de 500 reste DESSINÉ dans la maquette : c'est celui de
   * `communityDescriptionSchema`, une règle du contrat partagé, pas une donnée
   * du réseau.
   */
  readonly descriptionLongueur: number;
  /** Les modérateurs. Zéro quand le compte n'est pas connu — voir l'en-tête. */
  readonly moderateurs: number;
  /** Les demandes d'adhésion en attente. Zéro masque la pastille. */
  readonly demandes: number;
}

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LA SOURDINE — UNE PRISE À PART, ET POURQUOI ELLE N'EST PAS DANS `reseau`   ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * §2.5 : « Un membre peut mettre un réseau en sourdine : plus de notifications,
 * le réseau reste dans sa liste. » La maquette dessine SEPT boutons
 * « Sourdine » — six sur les planches d'ordinateur (A08 et les cinq onglets de
 * la vue membre) et un sur la planche mobile de A08 — et aucun ne faisait rien.
 *
 * ── POURQUOI PAS DANS `ReseauEnteteView` ─────────────────────────────────
 *
 * Parce que `ReseauEnteteView` est ce que `enteteReseauFrom()` CONVERTIT depuis
 * la réponse du serveur : un objet de chaînes déjà formulées, sans aucune
 * fonction. Y glisser un `onSourdine` obligerait le convertisseur — qui est pur
 * et testé comme tel dans `from-api.test.ts` — à recevoir un geste qu'il n'a
 * aucun moyen de fabriquer. La prise est donc séparée, comme `gerer` l'est.
 *
 * ── `active` VIENT DU SERVEUR, JAMAIS D'UN ÉTAT LOCAL ────────────────────
 *
 * `myMuted` est dans `GET /communities/:slug`, et c'est lui qu'on lit. Un
 * booléen tenu côté écran divergerait du serveur dès qu'un autre onglet
 * bascule la sourdine — et le bouton dirait alors le contraire de ce que la
 * base porte.
 */
export interface SourdineView {
  /** `myMuted` — le réseau est silencieux POUR MOI. */
  readonly active: boolean;
  /**
   * Le bouton est-il seulement atteignable ?
   *
   * `false` quand le lecteur n'a AUCUNE adhésion : la route a besoin d'une
   * ligne dans `community_members` pour y écrire, et elle répond `404` sans. Le
   * bouton s'éteint donc plutôt que de provoquer un refus — le front PRÉVIENT,
   * il n'autorise pas : c'est l'absence de ligne qui est connue de la fiche
   * (`myStatus === null`), pas un droit qu'on arbitrerait.
   */
  readonly disponible: boolean;
  /** Un appel est en vol : le bouton s'éteint plutôt que de partir deux fois. */
  readonly occupe: boolean;
  readonly onBasculer: () => void;
}

/**
 * UN CONTENU SIGNALÉ, tel que la carte « SIGNALEMENTS » le dessine.
 *
 * ── UNE RANGÉE PAR CONTENU, PAS PAR SIGNALEMENT ─────────────────────────
 *
 * La planche écrit sur UNE rangée « Publication de Joël K. · « Vends
 * attestation d'hébergement » » puis « Demande d'argent · 5 signalements ·
 * transmis à la modération de la plateforme », avec UNE paire « Masquer » /
 * « Conserver ». Cinq rangées identiques auraient donné cinq paires de boutons
 * dont le premier clic rendrait les quatre autres sans objet.
 *
 * `titre` et `sous` sont des CHAÎNES DÉJÀ COMPOSÉES, comme les champs de
 * `ReseauEnteteView` : la maquette écrit des phrases avec des points médians, et
 * les composer ici garde le cadre transcodé identique à ce qu'elle dessine. Un
 * morceau manquant disparaît avec son séparateur, au lieu de laisser un « · »
 * orphelin — c'est l'arbitrage de `resume` sur A08, et il vaut ici aussi.
 *
 * `href` est VIDE quand le contenu n'a pas de page.
 * ⚠ ÉCART REMONTÉ : seul un SUJET en a une (`/reseaux/:slug/sujets/:id`). Il
 * n'existe aucune page de publication ni de commentaire dans ce produit —
 * vérifié sur l'arborescence de `app/(app)` — donc « Voir » n'a nulle part où
 * aller pour deux des trois genres. Le bouton s'éteint alors au lieu de mener à
 * une page inexistante.
 */
export interface SignalementRowView {
  /** `POST`, `COMMENT` ou `TOPIC` — les trois seuls genres d'un réseau. */
  readonly subjectType: 'POST' | 'COMMENT' | 'TOPIC';
  readonly subjectId: string;
  /** « Publication de Joël K. · « Vends attestation d’hébergement » ». */
  readonly titre: string;
  /** « Demande d’argent · 5 signalements · transmis à la modération ». */
  readonly sous: string;
  /** La page du contenu, ou `''` quand il n'en a pas. Voir l'en-tête. */
  readonly href: string;
  /** Déjà masqué : « Masquer » n'a plus rien à faire et s'éteint. */
  readonly masque: boolean;
}

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LES PRISES DE LA GESTION ET DE LA MODÉRATION — TRENTE-TROIS CADRES, ZÉRO   ║
 * ║ GESTE                                                                      ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Relevé avant d'écrire une ligne : sur les trente-trois cadres transcodés de
 * A08 et A08T, PAS UN `onClick`, PAS UN `<button type=`, PAS UN champ. Les
 * trente routes du module existaient, `screens/reseaux/api.ts` les appelait
 * presque toutes — et rien ne les déclenchait. Tout était dessin.
 *
 * Ce type porte ce que les planches de GESTION lisent : les deux listes, les
 * destinations, et les gestes. Il est à part de `ReseauEnteteView` pour la même
 * raison que celle-ci est à part de `A08Data` — une planche membre n'a aucune
 * de ces prises, et lui faire déclarer un menu de modération serait exactement
 * le piège que `A08TData` évite.
 *
 * ── CE QUI EST UNE DESTINATION, ET CE QUI EST UN GESTE ─────────────────────
 *
 * `hrefGerer` et `hrefRetour` sont des DESTINATIONS, donc des liens — clic
 * droit, nouvel onglet, annonce par un lecteur d'écran. C'est ce que les sept
 * boutons « Gérer le réseau » sont vraiment, et il a fallu REGARDER ce que la
 * maquette dessine derrière eux pour le savoir : la planche qu'ils ouvrent est
 * « Gérer », celle du rail « VUE D'ENSEMBLE · DEMANDES D'ADHÉSION ·
 * SIGNALEMENTS · RÔLES ET ÉQUIPE · PARAMÈTRES », c'est-à-dire l'onglet
 * `?onglet=gerer&vue=proprietaire` que `reseau-screen.tsx` monte déjà. Ils ne
 * modifient RIEN : il n'y a aucun `PATCH /communities/:id` derrière ce bouton.
 * Le seul `PATCH` dessiné du module est l'« Enregistrer » de la planche
 * « À propos — édition ».
 *
 * Le reste CHANGE quelque chose : des boutons.
 *
 * ── LE FRONT PRÉVIENT, IL N'AUTORISE PAS ──────────────────────────────────
 *
 * Aucun de ces gestes ne regarde `myRole` pour décider s'il part. On tente, le
 * serveur refuse en `403` (`MODERATOR_REQUIRED`, `OWNER_IMMUTABLE`,
 * `LEVEL_REQUIRED`), et c'est sa réponse qui s'affiche. `occupe` n'éteint les
 * boutons que le temps d'un appel EN VOL — pour ne pas l'envoyer deux fois, pas
 * pour arbitrer un droit.
 */
export interface GestionReseauView {
  /** `?onglet=gerer&vue=proprietaire` — la planche que le bouton ouvre. */
  readonly hrefGerer: string;
  /** Le retour de la planche mobile « Gérer », qui dessine une flèche de retour. */
  readonly hrefRetour: string;
  /** Les demandes d'adhésion en attente. VIDE tant qu'on n'est pas modérateur. */
  readonly demandes: readonly DemandeRowView[];
  /**
   * LES MEMBRES DE L'ONGLET « MEMBRES » — LES QUATRE PLANCHES.
   *
   * ⚠ ELLE NE SERVAIT QU'AUX DEUX PLANCHES PROPRIÉTAIRE, et c'est ce que ce lot
   * change : les deux planches de la vue MEMBRE lisent la MÊME liste. Elles
   * peignaient leurs lignes en dur.
   *
   * ELLE VIT DANS `gerer` ET NON À LA RACINE, et c'est délibéré : il n'y a
   * qu'UNE liste de membres dans ce crochet, un seul convertisseur
   * (`membreAdminRowFrom`), et `membreMenu` comme `bannirNom` s'y cherchent
   * déjà. En poser une seconde à la racine pour la vue membre aurait donné deux
   * vérités sur la même route — exactement le défaut que « SIGNALEMENTS · N »
   * a déjà payé dans ce fichier.
   *
   * ⚠ ELLE N'EST PLUS VIDE POUR UN MEMBRE ORDINAIRE.
   * `GET /communities/:id/members` n'exige qu'`assertMember` — relevé dans
   * `communities.service.ts`, il n'y a pas d'`assertModerator` sur cette route
   * (seul `?pending=true` en pose un). C'est pourquoi `useReseau` la charge
   * maintenant dans son propre effet, hors de la garde de rôle. Elle reste vide
   * pour un PASSANT, à qui le serveur répond `403 NOT_A_MEMBER`.
   */
  readonly membres: readonly MembreAdminRowView[];
  /** Un appel est en vol : les boutons s'éteignent plutôt que de partir deux fois. */
  readonly occupe: boolean;
  /** L'identifiant du membre dont le menu est ouvert, `null` si aucun. */
  readonly menu: string | null;
  /** La ligne correspondante : la feuille mobile NOMME le membre dans son en-tête. */
  readonly membreMenu: MembreAdminRowView | null;
  /** Le sujet du signalement en cours — `null` = fenêtre fermée. */
  readonly signalement: { readonly type: string; readonly id: string } | null;
  readonly onMenu: (userId: string) => void;
  readonly onFermerMenu: () => void;
  readonly onAccepter: (userId: string) => void;
  readonly onRefuser: (userId: string) => void;
  readonly onToutAccepter: () => void;
  /**
   * LES DEUX GESTES DU MENU NE PRENNENT AUCUN ARGUMENT, et ce n'est pas une
   * économie : c'est ce que le DESSIN impose.
   *
   * La maquette dessine UN seul menu, posé à côté de la liste et non dans la
   * ligne — `position: absolute; right: 30px; top: 240px` sur la planche
   * d'ordinateur, une feuille basse sur celle de 390 px. Il est donc hors de la
   * boucle des membres : aucune variable de rang n'est à sa portée, et c'est
   * `menu` qui dit sur qui il est ouvert.
   *
   * Un `(userId) => void` obligerait le cadre à écrire
   * `gerer.onBannir(gerer.membreMenu.userId)`, donc à prouver au compilateur que
   * `membreMenu` n'est pas nul À L'INTÉRIEUR d'une fonction fléchée — ce que
   * TypeScript ne retient pas pour une propriété, même `readonly`. Le geste lit
   * donc l'état du menu là où il vit, dans le hook.
   */
  readonly onNommerModerateur: () => void;
  /** Le geste inverse : `role: MEMBER` sur un modérateur. Voir `revocable`. */
  readonly onRevoquerModerateur: () => void;
  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ « ÉCRIRE » — DEUX PRISES POUR UN GESTE, PARCE QUE DEUX DESSINS            ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur : « on ne peut pas écrire aux membres ». RELEVÉ : « Écrire » est
   * dessiné à SIX endroits dans les quatre planches de l'onglet, et aucun ne
   * faisait rien — cinq boutons sur les lignes de la vue membre à 1 036 px, une
   * entrée dans le menu de rôle de la vue propriétaire, une dans sa feuille
   * mobile. (La vue membre de 390 px n'en dessine aucun : compté, et c'est la
   * maquette, pas un oubli.)
   *
   * `onEcrire` prend le membre en argument : les boutons de ligne sont DANS la
   * boucle, donc ils connaissent leur rangée. `onEcrireMenu` n'en prend aucun,
   * pour la raison déjà écrite au-dessus de `onNommerModerateur` : le menu est
   * dessiné HORS de la boucle, et `menu` dit seul sur qui il est ouvert. Les
   * deux appellent le même chemin — on ne peut pas n'en garder qu'une, parce
   * qu'une fonction passée nue à `onClick` reçoit l'événement de React en
   * premier argument.
   *
   * ⚠ ELLES N'ENVOIENT PAS DE MESSAGE : elles OUVRENT `FenetreEcrire`, parce que
   * `POST /conversations/direct` exige un `firstMessage` (§5.2 — il n'existe
   * aucune conversation vide dans ce produit). Et si un fil existe déjà avec
   * cette personne, on y va directement, sans rien demander. C'est exactement ce
   * que fait le bouton « Écrire » du profil public, et c'est le même code :
   * `components/ecrire.ts`.
   */
  readonly onEcrire: (userId: string) => void;
  readonly onEcrireMenu: () => void;
  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ « RETIRER DU RÉSEAU » ET « BANNIR DU RÉSEAU » SONT LE MÊME GESTE         ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * La maquette dessine DEUX entrées dans le menu de rôle. §2.4 n'en définit
   * qu'UNE : « retirer un membre (`BANNED` : ne peut plus rejoindre) ». Il n'y a
   * pas deux pouvoirs — il y en a un, et la spécification le nomme deux fois.
   *
   * Les deux entrées appellent donc `onBannir`, qui ouvre la CONFIRMATION. Et
   * c'est la confirmation qui dit la vérité que les libellés ne disent pas :
   * c'est définitif, la personne ne pourra plus rejoindre le réseau.
   *
   * ⚠ ÉCART DE MAQUETTE REMONTÉ : deux entrées pour un geste est une invitation
   * à croire que « Retirer » est plus doux que « Bannir ». Le dessin est en
   * lecture seule ici ; au porteur de supprimer l'une des deux rangées. Ne pas
   * brancher la première aurait laissé un contrôle mort, ce qui est pire.
   */
  readonly onBannir: () => void;
  /**
   * « RETIRER DU RÉSEAU » — et ce n'est PLUS le bannissement.
   *
   * Le porteur a tranché (relevé sur `BANNED_FROM_COMMUNITY`) : « Retirer, il
   * peut rejoindre à nouveau. Mais banni, il ne peut plus rejoindre. » Retirer
   * appelle donc `DELETE /communities/:id/members/:userId` — la ligne disparaît
   * et la personne peut redemander —, et passe lui aussi par une confirmation,
   * parce qu'il fait sortir quelqu'un du réseau.
   */
  readonly onRetirer: () => void;
  readonly retirerOuverte: boolean;
  readonly retirerNom: string;
  readonly onConfirmerRetirer: () => void;
  readonly onAnnulerRetirer: () => void;
  /**
   * ── LA CONFIRMATION, ET POURQUOI LE RETRAIT EST LE SEUL GESTE QUI EN A UNE ──
   *
   * `fenetre-confirmation.tsx` est réservée à ce qui NE SE DÉFAIT PAS. Retirer
   * un membre pose `BANNED`, et §2.4 dit « ne peut plus rejoindre » : ni le
   * membre ni le modérateur ne peuvent revenir en arrière — `updateMemberSchema`
   * accepte bien `ACTIVE`, mais `invite()` refuse de réinviter un banni et
   * `join()` répond `403 BANNED_FROM_COMMUNITY`.
   *
   * Les autres gestes du menu n'en ont pas, et c'est cohérent : nommer
   * modérateur se révoque, masquer un contenu se démasque (13 §2 : « le pipeline
   * masque, il ne supprime jamais »), mettre en sourdine se rallume d'un second
   * clic.
   *
   * `bannirNom` est le nom du membre, parce qu'une question qui ne nomme personne
   * ne peut pas être vérifiée avant de répondre oui.
   */
  readonly bannirOuverte: boolean;
  readonly bannirNom: string;
  readonly onConfirmerBannir: () => void;
  readonly onAnnulerBannir: () => void;
  readonly onSignaler: () => void;
  readonly onFermerSignalement: () => void;

  // ── §2.4 — LA FILE DE SIGNALEMENTS ET SES DEUX DÉCISIONS ─────────────────
  /**
   * Les contenus signalés du réseau. VIDE tant qu'on n'est pas modérateur : la
   * route répond `403 MODERATOR_REQUIRED`, et le hook ne l'appelle pas.
   */
  readonly signalements: readonly SignalementRowView[];
  /**
   * LE NOMBRE QUE LA PLANCHE AFFICHE CINQ FOIS — titre de la carte, entrée du
   * rail, tuile de la vue d'ensemble, et leurs deux jumelles mobiles.
   *
   * Il vient de `meta.open`, jamais de `signalements.length` : la réponse est
   * bornée à cinquante rangées, et un compte déduit d'une page bornée est une
   * affirmation fausse affichée comme un compte. C'est le défaut que cette
   * maquette a déjà payé quatre fois sur « DEMANDES D'ADHÉSION · 4 ».
   */
  readonly signalementsOuverts: number;
  /** « Masquer » : le contenu disparaît du réseau, les signalements sont clos. */
  readonly onMasquer: (subjectType: string, subjectId: string) => void;
  /** « Conserver » : les signalements sont classés sans suite, rien n'est masqué. */
  readonly onConserver: (subjectType: string, subjectId: string) => void;

  // ── Désépingler l'annonce du haut du fil — arbitrage du 2026-10-11 ───────
  /**
   * L'annonce ÉPINGLÉE du réseau, ou `null` quand il n'y en a pas.
   *
   * Les trois champs sont lus par la carte verte du haut des deux planches
   * « Fil » : elle écrivait « Permanence consulaire à Lyon le 14 mars » en dur,
   * c'est-à-dire l'annonce d'un autre réseau. Brancher le GESTE sans brancher le
   * TEXTE aurait donné le pire des deux : un bouton qui désépingle réellement
   * une annonce, sous un titre inventé.
   */
  readonly annonce: {
    readonly id: string;
    readonly titre: string;
    readonly corps: string;
    /** « Aïcha D. · épinglée » — l'auteur abrégé comme la planche l'écrit. */
    readonly auteur: string;
  } | null;
  /**
   * « Désépingler ». DESSINÉ sur la planche d'ordinateur de « Fil —
   * propriétaire » (un `<span>` « Désépingler »), et sur sa jumelle mobile sous
   * la forme d'un « … » — relevé : la carte de la vue MEMBRE n'en porte pas,
   * celle de la vue propriétaire oui. C'est donc bien le contrôle du
   * propriétaire sur cette carte, et le seul que la maquette y dessine.
   */
  readonly onDesepingler: () => void;
}

/** Ce que les vingt-cinq planches d'onglet consomment. */
/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LE FORMULAIRE D'ANNONCE — LES QUATRE CONTRÔLES QUE LA PLANCHE DESSINE     ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « L'annonce : tous les champs doivent être branchés. »
 *
 * MESURÉ, et ce n'était PAS un oubli de branchement d'écran : la planche
 * « ADMIN · ANNONCE » dessine quatre contrôles sur les DEUX largeurs — un titre,
 * un corps, « Épingler en haut du fil », « Notifier les 890 membres » — et
 * `createAnnouncementSchema` n'acceptait que `{ body }`, la table
 * `community_announcements` ne portant ni titre ni épinglage. Deux des quatre
 * n'avaient nulle part où s'écrire. L'écart est fermé de la base à l'écran par ce
 * lot (migration `annonce_titre_et_epinglage`), et ces prises sont le dernier
 * maillon.
 *
 * ── CE QUE LA PLANCHE DE 390 PX DESSINE, ET CE QU'ELLE NE DESSINE PAS ──────
 *
 * ELLE DESSINE LES QUATRE CONTRÔLES, relevé dans la maquette et non supposé :
 * champ de titre bordé de vert (46 px contre 48), corps (86 px de haut contre
 * 96), les deux interrupteurs avec leur piste de 46×26, et « Publier l'annonce ».
 *
 * Deux choses lui manquent, et aucune n'est ajoutée :
 *   · les SOUS-TITRES des interrupteurs — « Jusqu'au 14 mars » et « Une seule
 *     notification, même pour les membres en sourdine. » — que seule la planche
 *     de 1 036 px écrit. Le téléphone n'a que les deux libellés ;
 *   · le bouton « ANNULER », que seule la planche de 1 036 px dessine. Sur le
 *     téléphone la feuille se ferme en glissant, et `onAnnonceAnnuler` n'a donc
 *     aucune prise mobile. REMONTÉ plutôt que comblé.
 *
 * ── CE QUE CES PRISES NE PORTENT PAS ──────────────────────────────────────
 *
 * La date « Jusqu'au 14 mars » sous « Épingler » est du TEXTE DESSINÉ : la
 * planche ne montre aucun sélecteur de date, et la colonne ajoutée est un
 * `pinned_at` (depuis quand), pas un `pinned_until` (jusqu'à quand). Lier cette
 * ligne demanderait un contrôle que la maquette ne dessine pas. Elle reste donc
 * telle quelle, et c'est REMONTÉ.
 */
export interface AnnonceComposeurView {
  readonly titreValue: string;
  readonly onTitre: (event: { readonly target: { readonly value: string } }) => void;
  /** La borne du serveur, lue sur `announcementTitleSchema`. Jamais recopiée. */
  readonly titreMax: number;
  readonly corpsValue: string;
  readonly onCorps: (event: { readonly target: { readonly value: string } }) => void;
  readonly corpsMax: number;
  /**
   * LES DEUX INTERRUPTEURS PARTENT ALLUMÉS, parce que c'est ce que la planche
   * dessine — piste `#16785E`, pastille à droite, sur les deux largeurs.
   *
   * ⚠ CE N'EST PAS LE DÉFAUT DU SCHÉMA, et l'écart est volontaire :
   * `createAnnouncementSchema` pose `pinned: false` / `notify: true`, c'est-à-dire
   * l'ancien comportement au bit près, pour qu'un appel direct qui ne passe rien
   * n'épingle pas soudainement. C'est l'ÉCRAN qui suit le dessin, pas le contrat.
   */
  readonly epingler: boolean;
  readonly onEpingler: () => void;
  readonly notifier: boolean;
  readonly onNotifier: () => void;
  /**
   * Le bouton « Publier l'annonce » est-il allumé ?
   *
   * `false` l'éteint, et c'est une commodité d'ÉCRITURE : la règle est dans
   * `createAnnouncementSchema` (corps 1–2 000) et dans le service (deux annonces
   * par semaine, modérateur seulement), que le serveur applique. Éteindre évite
   * un aller-retour dont la seule issue serait un refus — le front PRÉVIENT, il
   * n'autorise pas (mémo §5).
   */
  readonly pret: boolean;
  readonly onPublier: () => void;
  readonly onAnnuler: () => void;
}

/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║ UNE CARTE DE L'ONGLET « ÉVÉNEMENTS » D'UN RÉSEAU                            ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « Le contenu de l'onglet événement aussi est dessiné (événements
 * passés et à venir). Le bouton "Je viens" et "Voir" aussi ne marchent pas. »
 *
 * ── POURQUOI UN CONTRAT PROPRE, ET PAS `CarteEvenement` DE L'AGENDA ─────────
 *
 * C'est la question qu'il fallait poser, puisque `A08T_FIL_PUBLICATIONS` a
 * tranché l'inverse pour le fil — il MONTE la carte de A01 plutôt que d'en
 * recopier une. La différence est dans le DESSIN, relevé sur les deux maquettes :
 *
 *   · la carte de l'agenda (E01) porte une pastille de date qui écrit le JOUR DE
 *     LA SEMAINE (« 21 / SAM »), une HEURE, un nom de réseau, et aucun bouton ;
 *   · la carte de l'onglet de réseau écrit le MOIS (« 14 / MARS »), pas d'heure,
 *     et porte UN bouton — « Je viens » ou « Voir ».
 *
 * Ce ne sont pas deux états d'une même carte, ce sont deux cartes. Monter celle
 * de l'agenda ici aurait voulu dire la REDESSINER pour qu'elle porte un bouton
 * et un mois — c'est-à-dire réécrire une maquette, ce que le dépôt ne fait
 * jamais. Les FORMATEURS, eux, sont bien empruntés : `numeroJour`, `abbrMois`,
 * `TYPES_FR` et `pluriel` viennent de `screens/agenda/data.ts`, pour qu'un mois
 * ou un libellé de type ne s'écrive pas de deux façons dans l'application.
 */
export interface EvenementReseauView {
  readonly id: string;
  /** « 14 » — le numéro du jour, dans le fuseau de la VILLE de l'événement. */
  readonly numero: string;
  /** « MARS » — voir `abbrMois`. */
  readonly mois: string;
  /**
   * Les deux paires de couleurs de la pastille de date, telles que la maquette
   * les dessine : terre cuite sur sable quand j'y vais, vert sur vert sinon.
   * Relevées sur la planche, jamais choisies ici.
   */
  readonly fondDate: string;
  readonly couleurDate: string;
  /** Le type, dans les mots de `TYPES_FR` — « Rencontre », « Sport ». */
  readonly type: string;
  /** La pastille « Vous y allez » : `GOING` ou `WAITLIST`. */
  readonly jyVais: boolean;
  /**
   * La pastille « Réservé au réseau ».
   *
   * ⚠ ELLE SERA VRAIE SUR TOUTES LES CARTES DE CET ONGLET, et c'est la donnée
   * qui le dit : un événement listé par `?communityId=` a forcément un
   * `communityId`. La maquette ne la dessine que sur la première carte — c'est
   * un dessin, pas une règle, et la lier à la donnée est ce qui dit vrai. Le
   * jour où l'onglet montrera autre chose, la pastille suivra.
   */
  readonly reserve: boolean;
  readonly titre: string;
  /** « Mairie du 3e, Lyon » — lieu et ville, comme la planche de 1036 px. */
  readonly lieu: string;
  /** « Mairie du 3e » — le cadre de 390 px n'écrit pas la ville. */
  readonly lieuCourt: string;
  readonly participants: number;
  /** La marque du pluriel : « 1 participant », « 27 participants ». */
  readonly pluriel: string;
  /** `/agenda/:id` — la page que « Voir » ouvre. */
  readonly href: string;
}

/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║ L'ONGLET « ÉVÉNEMENTS » ENTIER — LES DEUX PASTILLES, LA LISTE, LE RSVP      ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 *
 * ── LES DEUX PASTILLES SONT UN FILTRE DE REQUÊTE, PAS UN TRI D'ÉCRAN ───────
 *
 * « À venir » et « Passés » étaient deux `<span>` inertes au-dessus d'une seule
 * liste de trois cartes, toutes à venir. Elles choisissent maintenant ce que la
 * liste MONTRE, et elles le font en changeant la REQUÊTE — `?to=hier` pour les
 * passés, aucune borne pour les à venir — et non en triant après coup : sans
 * filtre, `GET /events` part de MAINTENANT, donc l'écran n'a jamais reçu un
 * seul événement passé à trier. C'est la même raison qu'au filtre de réseau
 * lui-même.
 *
 * ── « JE VIENS » ET « VOIR » SONT LE MÊME BOUTON, DANS DEUX ÉTATS ──────────
 *
 * RELEVÉ sur la planche de 1036 px, et c'est ce qui a décidé de la forme : la
 * première carte — celle qui porte la pastille « Vous y allez » — dessine un
 * bouton GRIS « Voir » (`#F2F5F4` / `#16211D`) ; les deux autres, sans pastille,
 * dessinent un bouton VERT « Je viens » (`#16785E` / `#fff`). La maquette dessine
 * donc les DEUX ÉTATS du même bouton sur des cartes voisines, et c'est pour cela
 * qu'« un membre déjà inscrit ne lit pas "Je viens" » sans qu'on invente quoi
 * que ce soit : l'état suit `jyVais`.
 *
 * Aucune carte n'en dessine deux. En poser deux aurait été redessiner.
 *
 * ⚠ ET LA PLANCHE DE 390 px N'EN DESSINE AUCUN — compté : zéro « Je viens »,
 * zéro « Voir » sur les deux cadres mobiles. On ne les invente pas. Le cadre
 * mobile reçoit seulement son ADRESSE, par `CadreCliquable`, qui ne dessine rien
 * et rend la carte entière cliquable — c'est ce que le porteur a demandé pour
 * les cartes du fil (« c'est bon aussi pour les autres ? ») et ce que les cartes
 * de guide, d'événement, d'annonce et de parcours font déjà. REMONTÉ : s'il
 * veut un bouton sur le téléphone, c'est la maquette qui doit le dessiner.
 */
export interface EvenementsReseauView {
  /** La pastille active. Les deux seules que la maquette dessine. */
  readonly onglet: 'avenir' | 'passes';
  readonly onAVenir: () => void;
  readonly onPasses: () => void;
  readonly liste: readonly EvenementReseauView[];
  /**
   * Un RSVP est en vol : TOUS les boutons s'éteignent.
   *
   * Même arbitrage que `gerer.occupe` et sa note : la planche dessine un bouton
   * par carte, et s'inscrire à deux événements se fait l'un après l'autre.
   */
  readonly occupe: boolean;
  /**
   * « Je viens » → `PUT /events/:id/rsvp` avec `{ status: 'GOING' }`.
   *
   * ⚠ AUCUN CONTRÔLE DE NIVEAU ICI. `event.attend` est en N2 et le front
   * PRÉVIENT sans autoriser (00 §5) : on tente, le serveur refuse en
   * `403 LEVEL_REQUIRED`, et `components/fenetre-niveau.tsx` explique — voir
   * `niveauRefuse` juste en dessous.
   */
  readonly onJeViens: (eventId: string) => void;
  /**
   * La capacité refusée au dernier geste, ou `null`. Elle ouvre l'invitation à
   * monter de niveau, que l'ÉCRAN pose — une seule fois, hors des deux cadres,
   * pour la raison déjà mesurée sur `FenetreConfirmation` (deux copies
   * portalisées s'ouvriraient ensemble et se voleraient les clics).
   */
  readonly niveauRefuse: Capability | null;
  readonly onFermerNiveau: () => void;
  /** Le refus de CE geste seul, déjà traduit en français. `null` sinon. */
  readonly echec: string | null;
}

/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║ UNE TUILE DE L'ALBUM — ET ELLE NE VIENT PAS TOUJOURS D'UN ALBUM             ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 *
 * Le contrat est le même pour les trois onglets par défaut et pour les albums de
 * modérateur, et c'est VOULU : « Partagés » n'est pas une ligne de la table
 * `albums` — ce sont les images des publications du fil, qui vivent dans
 * `PostMedia` et arrivent par `postCardSchema.media` (`{ id, position, url }`).
 * Un second contrat aurait fait deux grilles qui divergent.
 *
 * `legende` est le TEXTE que la maquette écrit dans sa première tuile (« Fête
 * 2025 ») et laisse vide sur les onze autres. Il porte donc la légende de la
 * photo quand il y en a une, et la chaîne VIDE sinon — jamais un mot inventé,
 * jamais le titre de l'album répété douze fois.
 */
export interface PhotoAlbumView {
  /**
   * L'identifiant de la PHOTO (`album_photos.id`) ou, dans « Partagés », celui
   * de l'actif média de la publication. Il ne sert qu'à la clé de boucle : les
   * deux espaces d'identifiants sont des UUID distincts, et aucun geste de cet
   * onglet ne s'en sert pour appeler quoi que ce soit.
   */
  readonly id: string;
  /** Le chemin RELATIF rendu par le serveur (`/media/<clé>`). */
  readonly url: string;
  /** La légende, ou la chaîne vide. Voir l'en-tête. */
  readonly legende: string;
  /**
   * L'ALBUM de la photo — présent pour une photo d'album seulement. Les images
   * « Partagés » (celles des publications) n'en ont pas : elles ne se
   * sélectionnent pas, car « Couverture » et « Masquer » n'ont de sens que dans
   * un album.
   */
  readonly albumId?: string;
}

/**
 * Une pastille de la rangée de filtres de l'album.
 *
 * ── LES TROIS PREMIÈRES SONT DES ONGLETS PAR DÉFAUT, DÉRIVÉS ───────────────
 *
 * Le porteur : « tous, Partagés (les images partagées par les membres dans les
 * publications dans le fil), Événements — qui sont des tabs par défaut ou des
 * albums par défaut. »
 *
 * MESURÉ AVANT D'AJOUTER QUOI QUE CE SOIT EN BASE : le modèle `Album`
 * (`07-communities.prisma`) porte `communityId`, `eventId?`, `title` et
 * `createdByUserId`, et AUCUN champ de genre. Les trois onglets se dérivent donc
 * sans migration :
 *
 *   · « Événements » = les albums dont `eventId` n'est pas nul ;
 *   · « Partagés »  = les médias des publications du fil du réseau — PAS un
 *     album, donc pas une ligne à créer ;
 *   · « Tout »      = l'ensemble des deux, plus les albums de modérateur.
 *
 * ⚠ LE LIBELLÉ DE LA PREMIÈRE EST « Tout » ET NON « Tous » : c'est le mot que la
 * maquette dessine sur les trois cadres qui portent cette rangée. Le porteur a
 * écrit « tous » ; on transcode le dessin plutôt que de le réécrire. REMONTÉ.
 */
export interface AlbumPastilleView {
  /** `tout`, `partages`, `evenements`, ou l'identifiant d'un album. */
  readonly clef: string;
  readonly libelle: string;
}

/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║ L'ONGLET « ALBUM » ENTIER — SES PASTILLES, SA GRILLE, SON BOUTON « AJOUTER » ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 *
 * ── LE BOUTON « AJOUTER » ET SON MENU, TELS QUE LE PORTEUR LES DÉCRIT ──────
 *
 * « Donc les administrateurs ont seul le bouton ajouté (qui remplace le bouton
 * ajouter une image) qui a un chevron à droite ; quand on hover alors ça
 * affiche […] le bouton en menu de contexte Ajouter une image (désactivé dans
 * les albums partagés et événements, qui sont des albums automatiques remplis
 * par les publications et les images ajoutées lors de la publication des
 * événements) et ajouter un album. »
 *
 * Trois prises portent ces trois phrases : `moderateur` fait paraître le bouton,
 * `menuOuvert` ouvre le menu, `imageDisponible` ÉTEINT la première entrée dans
 * « Partagés » et « Événements ».
 *
 * ⚠ « AU SURVOL » NE SUFFIT PAS AU DOIGT, et la planche de 390 px n'a pas de
 * survol du tout. Le menu s'ouvre donc de DEUX façons : `onSurvol` au passage du
 * pointeur (ce que le porteur demande) et `onBasculer` au clic ou au toucher.
 * Un menu qui n'existerait qu'au survol serait inatteignable sur téléphone.
 */
/**
 * Une rangée de la carte « ALBUMS » de la colonne de droite, à 1 036 px.
 *
 * La maquette y dessine trois rangées — « Fête 2025 · 48 photos », « Repas
 * partagé · 16 photos », « Permanence 2024 · 9 photos » — avec une vignette
 * hachurée de 44 px. Les trois étaient peintes en dur, donc FAUSSES sur tout
 * réseau, et c'est le même défaut que les douze tuiles de la grille.
 *
 * ── TOUT CE QU'ELLE PORTE EXISTE DÉJÀ DANS LA RÉPONSE ─────────────────────
 *
 * MESURÉ sur `albumSchema` avant de demander quoi que ce soit à l'API :
 * `photoCount` donne le nombre, `photos[0].url` donne la couverture, `title`
 * donne le nom. Il n'y avait donc RIEN à ajouter côté serveur — ni colonne de
 * couverture, ni compteur.
 *
 * `couverture` est `null` quand l'album est vide ou que ses images sont encore
 * en traitement : la vignette garde alors le hachuré de la maquette, qui est
 * exactement ce qu'elle dessine.
 */
export interface AlbumVignetteView {
  readonly id: string;
  readonly titre: string;
  /** « 48 photos », « 1 photo », « Aucune photo » — la phrase entière. */
  readonly compte: string;
  readonly couverture: string | null;
}

export interface AlbumReseauView {
  /** Les pastilles, dans l'ordre : Tout, Partagés, Événements, puis les albums. */
  readonly pastilles: readonly AlbumPastilleView[];
  /** Les rangées de la carte « ALBUMS » de la colonne de droite. */
  readonly vignettes: readonly AlbumVignetteView[];
  /** La `clef` de la pastille active. */
  readonly onglet: string;
  readonly onPastille: (clef: string) => void;
  readonly photos: readonly PhotoAlbumView[];
  /**
   * La liste est arrivée (ou a échoué). Comme `evenementsPrets` : une grille
   * vide pendant le chargement dirait « aucune photo » d'un réseau qui en a.
   */
  readonly prete: boolean;
  /**
   * Le bouton « Ajouter » paraît-il ? Propriétaire et modérateurs seulement.
   *
   * ⚠ C'EST UN AVERTISSEMENT, PAS UNE AUTORISATION (00 §5) : la règle est dans
   * `createAlbum`, qui exige `MODERATOR_REQUIRED` depuis ce lot. Cacher le
   * bouton évite de proposer un geste qui finirait en refus.
   */
  readonly moderateur: boolean;
  /**
   * « Ajouter un album » paraît-il ? L'équipe seulement — même quand l'album est
   * ouvert aux membres, `moderateur` (ci-dessus) ne parle plus que du bouton
   * « Ajouter » : depuis le paramètre « Album ouvert aux membres », un membre
   * peut garnir un album existant, pas en créer un.
   */
  readonly peutCreerAlbum: boolean;
  readonly menuOuvert: boolean;
  /**
   * OUVRE, et n'est PAS une bascule — c'est ce que le bouton d'ordinateur lit au
   * CLIC autant qu'au survol.
   *
   * ⚠ MESURÉ, ET C'EST POURQUOI LES DEUX GESTES SONT SÉPARÉS : avec une bascule
   * sur le clic, un vrai clic de souris ouvrait puis refermait le menu dans le
   * même geste — le pointeur ENTRE d'abord sur le bouton (`onMouseEnter`, qui
   * ouvre), et le clic qui suit basculait vers « fermé ». Relevé au navigateur :
   * `[data-album-menu]` restait à zéro élément après un clic.
   */
  readonly onOuvrirMenu: () => void;
  /**
   * BASCULE — pour le bouton flottant de 390 px, et pour lui seul : il n'y a pas
   * de survol au doigt, donc pas de conflit, et un second appui doit refermer
   * (la planche ne dessine aucun voile qui pourrait le faire).
   */
  readonly onBasculer: () => void;
  readonly onFermerMenu: () => void;
  /**
   * La touche relevée sur le conteneur du bouton : `Escape` referme le menu.
   *
   * Sans elle, un lecteur au clavier ouvrait le menu par Entrée et n'avait aucun
   * moyen de le refermer sans choisir une entrée — le survol, lui, n'existe pas
   * au clavier.
   */
  readonly onTouche: (e: { readonly key: string }) => void;
  /**
   * « Ajouter une image » est-elle allumée ?
   *
   * FAUX dans « Tout », « Partagés » et « Événements » : les deux derniers sont
   * des vues automatiques — la première n'est même pas une table — et « Tout »
   * ne désigne aucun album où poser l'image. Il faut avoir choisi un album de
   * modérateur.
   */
  readonly imageDisponible: boolean;
  /**
   * LE CHOISISSEUR DE FICHIER EST DANS L'ENTRÉE DU MENU, et c'est le chemin que
   * A05 a déjà établi : l'entrée devient un `<label>` qui contient un
   * `<input type="file">` caché, et `onImage` reçoit son `change`. Rien à
   * cliquer en JavaScript, rien à monter hors du cadre, et le geste marche au
   * clavier comme au doigt.
   *
   * ⚠ ET C'EST POURQUOI IL N'Y A PAS DE `onAjouterImage()` : un bouton qui
   * appellerait `ref.current.click()` demanderait un `ref` dans une prise de
   * planche, c'est-à-dire du DOM dans un contrat de dessin.
   */
  readonly onImage: (e: { target: { files: FileList | null; value: string } }) => void;
  readonly onAjouterAlbum: () => void;
  /** Un dépôt ou une création est en vol : les deux entrées s'éteignent. */
  readonly occupe: boolean;
  /** Le refus de CE geste seul, déjà traduit en français. `null` sinon. */
  readonly echec: string | null;
  // ── La fenêtre « Nouvel album » ──────────────────────────────────────────
  readonly albumOuvert: boolean;
  readonly onCreerAlbum: (titre: string) => void;
  readonly onFermerAlbum: () => void;
  /** Les bornes du serveur, lues sur `albumTitleSchema`. Jamais recopiées. */
  readonly titreMin: number;
  readonly titreMax: number;
  // ── La sélection d'une photo (équipe) : « Couverture » et « Masquer » ────
  /**
   * La photo sélectionnée, ou `null`. La planche de 390 px dessinait la barre
   * « 1 photo sélectionnée · Couverture · Masquer » EN PERMANENCE, inerte. Elle
   * n'apparaît plus qu'avec une sélection : un membre de l'équipe touche une
   * photo d'album pour la sélectionner, la touche à nouveau pour la relâcher.
   */
  readonly selection: string | null;
  /** L'ÉQUIPE seule sélectionne : pour un membre, une tuile reste une image. */
  readonly selectionnable: boolean;
  readonly onSelectionner: (photoId: string) => void;
  /** « Couverture » — ou « Retirer la couverture » si c'est déjà elle. */
  readonly couvertureLibelle: string;
  readonly onCouvertureAlbum: () => void;
  /** « Masquer » — retire la photo de l'album, après confirmation. */
  readonly onMasquerPhoto: () => void;
}

export interface A08TData {
  readonly reseau: ReseauEnteteView;
  // ── Le lot « réseau vivant » — voir `./vivant.ts` ───────────────────────
  readonly actions: ActionsReseauView;
  readonly outils: OutilsReseauView;
  readonly composeur: ComposeurReseauView;
  readonly colonne: ColonneReseauView;
  readonly filtreMembres: FiltreMembresView;
  readonly apropos: AProposReseauView;
  readonly pilotage: PilotageReseauView;
  readonly vides: VidesReseauView;
  /**
   * LE COMPOSEUR D'ANNONCE, sur les vingt-cinq planches pour la même raison que
   * `gerer` : `reseau-screen.tsx` passe le MÊME objet à toutes, et les planches
   * qui n'en lisent rien ne le déstructurent pas.
   */
  readonly annonce: AnnonceComposeurView;
  /**
   * LA GESTION, sur les vingt-cinq planches et non sur les huit de la vue
   * propriétaire.
   *
   * Une prise par planche serait plus étroite, mais `reseau-screen.tsx` passe
   * le MÊME objet aux vingt-cinq (`tab.desktop(enteteOnglet)`), et ce fichier
   * n'a pas le droit de décider pour lui. Les planches qui n'en lisent rien ne
   * la déstructurent pas : le générateur ne déclare que ce que le JSX produit
   * emploie, donc `const { reseau }` reste `const { reseau }` sur les vingt
   * planches sans geste.
   */
  readonly gerer: GestionReseauView;
  /**
   * LA SOURDINE, sur les vingt-cinq planches pour la même raison que `gerer` et
   * `annonce` : `reseau-screen.tsx` passe le MÊME objet à toutes. Seules cinq la
   * lisent — les planches d'onglet de la vue MEMBRE, qui sont les seules où la
   * maquette dessine le bouton ; les huit planches de la vue propriétaire ne
   * l'ont pas, et c'est la maquette qui en décide, pas nous.
   */
  readonly sourdine: SourdineView;
  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ UNE PHRASE DE LA MAQUETTE EST DEVENUE FAUSSE — ET ELLE EST DEVENUE DONNÉE ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Sous l'interrupteur « Notifier » du formulaire d'annonce, la planche écrit :
   * « Une seule notification, même pour les membres en sourdine. »
   *
   * C'était vrai tant que `community_members.muted` n'existait pas. La colonne a
   * été ajoutée, le filtre est posé dans `notifications.events.ts`, et §2.3 l'exige
   * en toutes lettres : « notification à tous les membres NON EN SOURDINE ». La
   * phrase dessinée affirme donc exactement le contraire de ce que le code fait.
   *
   * ⚠ LA MAQUETTE N'EST PAS RETOUCHÉE — `docs/` est en lecture seule, et de toute
   * façon le dépôt ne corrige jamais un dessin : il le transcode et LIE ce qui doit
   * dire la vérité. C'est donc l'écran qui dit vrai, pas la planche.
   */
  readonly notifierSourdine: string;
  /**
   * ╔════════════════════════════════════════════════════════════════════════╗
   * ║ « CONTACTER LES MODÉRATEURS » — LE BOUTON N'AVAIT AUCUNE ROUTE         ║
   * ╚════════════════════════════════════════════════════════════════════════╝
   *
   * Dessiné sur DEUX planches et sur les deux seulement : « À propos » à
   * 1036 px, où la maquette écrit « Contacter les modérateurs », et sa jumelle
   * de 390 px, où elle raccourcit en « Contacter » faute de place. Les
   * vingt-trois autres planches d'onglet ne le dessinent pas.
   *
   * Il ouvre — ou ROUVRE — un fil de groupe avec le propriétaire et les
   * modérateurs actifs du réseau, puis mène à `/messages/:id`.
   *
   * ⚠ CE N'EST PAS « SIGNALER LE RÉSEAU », le bouton dessiné JUSTE À CÔTÉ.
   * Celui-là appelle `POST /reports`, qui va à l'équipe de la PLATEFORME et
   * ouvre un dossier de modération ; celui-ci parle aux bénévoles d'un seul
   * réseau. « Signaler le réseau » reste inerte sur ces deux planches — ce lot
   * ne le branche pas, et le dire valait mieux que le brancher à la hâte sur la
   * route voisine.
   *
   * LES DEUX PRISES SONT OBLIGATOIRES ET NON FACULTATIVES, bien que
   * vingt-trois planches ne les emploient pas : `collectProps` ne déstructure
   * un nom que s'il figure dans le JSX produit, donc les planches qui ne
   * dessinent pas le bouton ne le lisent pas — et un type facultatif
   * obligerait chaque appelant à écrire `?.()`, c'est-à-dire à prévoir un
   * bouton sans geste, qui est exactement ce que ce lot corrige.
   */
  readonly onContacterModerateurs: () => void;
  /**
   * Un appel est en cours : le bouton s'éteint.
   *
   * Deux appuis rapides ne CRÉERAIENT pas deux fils — l'index unique en base
   * l'interdit, et la route rend le même identifiant — mais ils lanceraient deux
   * navigations, et la seconde annulerait la première. Éteindre dit aussi au
   * membre que son clic a été pris.
   */
  readonly contactEnCours: boolean;
  /**
   * ╔═══════════════════════════════════════════════════════════════════════════╗
   * ║ LES PUBLICATIONS DU FIL DU RÉSEAU — LA CARTE DU FIL, PAS UNE COPIE      ║
   * ╚═══════════════════════════════════════════════════════════════════════════╝
   *
   * `FeedPostView` est le contrat de la carte de A01, et c'est délibérément lui :
   * les planches « Fil » montent `CartePublicationDesktop` et
   * `CartePublicationMobile`, extraites du cadre du fil par le générateur. Un
   * contrat propre à ce module aurait fait une SECONDE carte de publication, et
   * la seconde aurait divergé de celle du fil au premier changement de maquette.
   *
   * ⚠ ELLE VIENT DE `GET /feed?communityId=…`, ET NON DE
   * `GET /communities/:id/feed`. La seconde existe et paraît faite pour cela,
   * mais `communityFeedPostSchema` ne porte que SEPT champs bruts contre seize :
   * ni `typeLabel`, ni `counter.word`, ni `reaction.actionLabel`, ni `context`,
   * ni `media`, ni `poll`. Le front n'a pas le droit de les recomposer — « le
   * vocabulaire de réaction renvoyé correspond au type de publication » est une
   * règle dure, et deux tables de vocabulaire divergent toujours. On filtre donc
   * LE FIL LUI-MÊME, exactement comme l'onglet « Fil » du profil public le fait
   * avec `?authorHandle=`.
   *
   * VIDE sur les vingt et une planches qui ne dessinent pas de fil : le
   * générateur ne déstructure que ce que le JSX emploie, donc elles ne la lisent
   * pas — c'est le même arbitrage que `gerer`, `annonce` et `sourdine`.
   */
  readonly publications: readonly FeedPostView[];
  /**
   * L'ONGLET « ÉVÉNEMENTS » DU RÉSEAU — les deux pastilles, la liste, le RSVP.
   *
   * Sur les vingt-cinq planches, pour la même raison que `gerer`, `annonce` et
   * `sourdine` : `reseau-screen.tsx` passe le MÊME objet à toutes. Quatre la
   * lisent — « Événements » et « Événements — propriétaire », aux deux largeurs ;
   * les vingt et une autres ne la déstructurent pas, puisque le générateur ne
   * déclare que ce que le JSX produit emploie.
   */
  readonly evenements: EvenementsReseauView;
  /**
   * L'ONGLET « ALBUM » DU RÉSEAU — ses pastilles, sa grille, son « Ajouter ».
   *
   * Sur les vingt-cinq planches, pour la même raison que `gerer`, `annonce`,
   * `sourdine` et `evenements` : `reseau-screen.tsx` passe le MÊME objet à
   * toutes. Quatre la lisent — « Album » et « Album — propriétaire », aux deux
   * largeurs ; les vingt et une autres ne la déstructurent pas, puisque le
   * générateur ne déclare que ce que le JSX produit emploie.
   */
  readonly album: AlbumReseauView;
}

/**
 * L'en-tête VIDE, le temps que l'appel revienne ou s'il échoue.
 *
 * Aucune valeur inventée, et surtout aucun nom de réseau : un repli qui écrirait
 * « Béninois en France » ferait exactement ce que ce lot corrige — afficher le
 * nom d'un réseau à qui regarde un autre. Un en-tête vide se voit ; un en-tête
 * faux ne se voit pas.
 *
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LE NOM EST UN TIRET CADRATIN, PAS LA CHAÎNE VIDE                           ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Il ÉTAIT la chaîne vide, et la doctrine ci-dessus restait juste — mais le
 * dessin produit l'était moins. Les vingt-quatre planches qui lisent
 * `{reseau.nom}` le posent dans le TITRE de la page : servir la chaîne vide
 * servait un `<h1></h1>`, mesuré tel quel par Playwright (« locator resolved to
 * <h1></h1> … unexpected value "hidden" », six cas sur A08 et A08T). Un titre
 * qui s'annonce sans nom est une violation `empty-heading` d'axe-core, et §10.6
 * exige un nom accessible sur tout élément qui en porte un.
 *
 * Et ce n'est pas un chemin rare : `reseau-screen.tsx` ne peint ce repli que si
 * `pret` est vrai ET `echec` non nul — c'est-à-dire exactement quand l'appel a
 * ÉCHOUÉ. Le filet devenait l'écran au pire moment.
 *
 * Le tiret cadratin n'invente aucun nom — il ne ressemble à aucun réseau — et
 * c'est déjà la marque d'attente que `screens/compte/ecran-donnees.tsx` et sa
 * jumelle d'administration emploient, pour la même raison : « Inscrits 0 » est
 * faux et se lit comme vrai, « Inscrits — » dit qu'on ne sait pas encore.
 *
 * `initiales` reste le point médian : c'est ce que `initials()` rend, et le
 * repli doit dire la même chose que le convertisseur.
 */
export const enteteVide: ReseauEnteteView = {
  nom: '—',
  /**
   * UN POINT MÉDIAN, et non la chaîne vide : c'est ce que `initials()` rend pour
   * un nom vide, donc le repli dit la même chose que le convertisseur plutôt
   * qu'une seconde version de « je ne sais pas ».
   *
   * Il reste VISIBLE pendant le chargement — une pastille orange contenant « · ».
   * C'est pour cela que `reseau-screen.tsx` ne peint plus l'en-tête avant que
   * l'appel soit revenu : le repli est un filet, pas un écran.
   */
  initiales: '·',
  /**
   * ╔════════════════════════════════════════════════════════════════════════╗
   * ║ LES QUATRE CHAMPS ASSIS ENTRE DES SÉPARATEURS PORTENT LA MARQUE        ║
   * ║ D'ATTENTE, PAS LA CHAÎNE VIDE                                          ║
   * ╚════════════════════════════════════════════════════════════════════════╝
   *
   * `membres`, `genre`, `monAppartenance` et `monRole` sont les SEULS que la
   * maquette encadre de points médians écrits en dur — mesuré sur les cadres
   * produits, il n'existe que deux motifs : `{reseau.membres} · {reseau.genre}`
   * (suivi de `· {reseau.monAppartenance}`) et `{reseau.membres} ·
   * {reseau.monRole}`. Les autres champs se rendent seuls : la chaîne vide y est
   * invisible et reste donc le bon repli.
   *
   * C'ÉTAIT LA CAUSE D'UN DÉFAUT PLUS GRAVE QUE CELUI QU'ELLE ÉVITAIT. Avec
   * trois valeurs vides, la ligne de résumé laissait deux points médians
   * orphelins — « · · » — et c'est pour ne pas les montrer que
   * `reseau-screen.tsx` avait cessé de peindre le cadre avant le retour de
   * l'appel. Mais ne rien peindre a un prix qui ne se voyait pas à l'œil : le
   * SERVEUR, lui, n'a jamais la donnée, donc il ne servait plus que quatre mots
   * — « DisaporyPlus Chargement du réseau… ». Mesuré au `curl` sur
   * `/reseaux/beninois-en-france?onglet=fil` : une COQUILLE VIDE, le défaut même
   * que ce dépôt a déjà corrigé sur seize routes membre et six routes d'équipe.
   *
   * Le tiret cadratin règle la cause plutôt que le symptôme : la ligne lit
   * « — · — · — », qui est la marque d'attente employée par
   * `screens/compte/ecran-donnees.tsx`, et le cadre peut donc être peint tout de
   * suite, rail et panneau compris. Aucun nom n'est emprunté à la maquette : un
   * tiret ne ressemble à aucun réseau.
   */
  membres: '—',
  membresNombre: '',
  genre: '—',
  genreCourt: '',
  creeEn: '',
  resume: '',
  resumeCourt: '',
  resumeProprietaire: '',
  monAppartenance: '—',
  monRole: '—',
  visibilite: '',
  couverture: null,
  logo: null,
  description: '',
  descriptionLongueur: 0,
  moderateurs: 0,
  demandes: 0,
};

/**
 * La gestion VIDE, le temps que les appels reviennent — et sur les planches qui
 * n'en lisent rien.
 *
 * LES GESTES SONT DES FONCTIONS QUI NE FONT RIEN, et non `undefined` : le JSX
 * transcodé les pose en `onClick`, et un `onClick={undefined}` laisse un bouton
 * qui a l'air vivant et ne fait rien — c'est-à-dire exactement le défaut que ce
 * lot corrige. Avec `occupe: true`, les boutons de ce repli sont ÉTEINTS, ce qui
 * dit la vérité : rien n'est encore chargé.
 *
 * Les deux destinations, elles, sont réelles dès le premier rendu : elles ne
 * dépendent d'aucune donnée du réseau, seulement de la planche visée, et le
 * SERVEUR les rend donc telles quelles — un lien de navigation qui n'attend pas
 * un appel client est un lien qui marche sans JavaScript.
 */
const gestionVide: GestionReseauView = {
  hrefGerer: '?onglet=gerer&vue=proprietaire',
  hrefRetour: '?onglet=fil&vue=proprietaire',
  demandes: [],
  membres: [],
  occupe: true,
  menu: null,
  membreMenu: null,
  signalement: null,
  onMenu: () => {},
  onFermerMenu: () => {},
  onAccepter: () => {},
  onRefuser: () => {},
  onToutAccepter: () => {},
  onNommerModerateur: () => {},
  onRevoquerModerateur: () => {},
  onEcrire: () => {},
  onEcrireMenu: () => {},
  onBannir: () => {},
  onRetirer: () => {},
  retirerOuverte: false,
  retirerNom: '',
  onConfirmerRetirer: () => {},
  onAnnulerRetirer: () => {},
  bannirOuverte: false,
  bannirNom: '',
  onConfirmerBannir: () => {},
  onAnnulerBannir: () => {},
  onSignaler: () => {},
  onFermerSignalement: () => {},
  signalements: [],
  signalementsOuverts: 0,
  onMasquer: () => {},
  onConserver: () => {},
  annonce: null,
  onDesepingler: () => {},
};

export { gestionVide };

/**
 * LE COMPOSEUR VIDE — et son bouton est ÉTEINT, ce qui dit la vérité.
 *
 * Les bornes sont lues sur les schémas partagés et non recopiées : `.maxLength`
 * les expose, et c'est la même source que l'API applique. Les deux interrupteurs
 * partent ALLUMÉS, comme la planche les dessine.
 */
const annonceVide: AnnonceComposeurView = {
  titreValue: '',
  onTitre: () => {},
  titreMax: announcementTitleSchema.maxLength ?? 0,
  corpsValue: '',
  onCorps: () => {},
  corpsMax: createAnnouncementSchema.shape.body.maxLength ?? 0,
  epingler: true,
  onEpingler: () => {},
  notifier: true,
  onNotifier: () => {},
  pret: false,
  onPublier: () => {},
  onAnnuler: () => {},
};

export { annonceVide };

/**
 * LA SOURDINE VIDE — ÉTEINTE, ET ELLE DIT LA VÉRITÉ.
 *
 * `occupe: true` et `disponible: false` tant que la fiche n'est pas revenue :
 * on ne sait pas encore si le lecteur a une adhésion où écrire, et un bouton
 * allumé sur une ignorance est précisément ce que ce lot corrige. `active:
 * false` parce que c'est la valeur que `myMuted` porte pour tout le monde sauf
 * ceux qui l'ont demandée — et parce que le repli ne doit pas afficher
 * « En sourdine » sur un réseau qui ne l'est pas.
 */
/**
 * L'ONGLET « ÉVÉNEMENTS » VIDE — ÉTEINT, ET IL DIT LA VÉRITÉ.
 *
 * `occupe: true` tant que l'appel n'est pas revenu : un bouton « Je viens »
 * allumé sur une liste qu'on ne connaît pas encore est précisément le défaut que
 * ce lot corrige. `onglet: 'avenir'` parce que c'est la pastille que la maquette
 * dessine ACTIVE sur les quatre cadres — fond `#16785E`, texte blanc — et le
 * repli doit montrer le même état que le dessin.
 *
 * Les gestes sont des fonctions qui ne font rien, et non `undefined` : même
 * raison que `gestionVide` et sa note — un `onClick={undefined}` laisse un
 * bouton qui a l'air vivant et n'agit pas.
 *
 * AUCUN ÉVÉNEMENT INVENTÉ : les trois cartes de la maquette (« Permanence
 * consulaire », « Repas partagé béninois », « Fête de l'indépendance ») sont
 * exactement ce que ce lot retire. S'inscrire à l'une d'elles aurait voulu dire
 * s'inscrire à un événement qui n'existe dans aucune base.
 */
const evenementsVides: EvenementsReseauView = {
  onglet: 'avenir',
  onAVenir: () => {},
  onPasses: () => {},
  liste: [],
  occupe: true,
  onJeViens: () => {},
  niveauRefuse: null,
  onFermerNiveau: () => {},
  echec: null,
};

export { evenementsVides };

/**
 * L'ALBUM VIDE, le temps que l'appel revienne ou s'il échoue.
 *
 * ⚠ AUCUNE PHOTO INVENTÉE, et c'est la même doctrine que `enteteVide` et que
 * `publications: []` : une grille vide se voit, une grille fausse ne se voit
 * pas. Les douze tuiles hachurées de la maquette sont précisément ce que ce lot
 * retire.
 *
 * LES TROIS PASTILLES PAR DÉFAUT SONT LÀ MÊME ICI : elles ne dépendent d'aucun
 * appel — ce sont des vues dérivées, pas des lignes de table — et la rangée
 * resterait sinon vide pendant tout le chargement, ce qui ferait disparaître la
 * rangée entière que la maquette dessine.
 *
 * `occupe: true` et `prete: false` : rien n'est cliquable avant que la liste
 * soit là, exactement comme `evenementsVides`.
 */
const albumVide: AlbumReseauView = {
  pastilles: [
    { clef: 'tout', libelle: 'Tout' },
    { clef: 'partages', libelle: 'Partagés' },
    { clef: 'evenements', libelle: 'Événements' },
  ],
  vignettes: [],
  onglet: 'tout',
  onPastille: () => {},
  photos: [],
  prete: false,
  moderateur: false,
  peutCreerAlbum: false,
  menuOuvert: false,
  onOuvrirMenu: () => {},
  onBasculer: () => {},
  onFermerMenu: () => {},
  onTouche: () => {},
  imageDisponible: false,
  onImage: () => {},
  onAjouterAlbum: () => {},
  occupe: true,
  echec: null,
  albumOuvert: false,
  onCreerAlbum: () => {},
  onFermerAlbum: () => {},
  titreMin: 0,
  titreMax: 0,
  selection: null,
  selectionnable: false,
  onSelectionner: () => {},
  couvertureLibelle: 'Couverture',
  onCouvertureAlbum: () => {},
  onMasquerPhoto: () => {},
};

export { albumVide };

const sourdineVide: SourdineView = {
  active: false,
  disponible: false,
  occupe: true,
  onBasculer: () => {},
};

export { sourdineVide };

/**
 * CE QUE L'ÉCRAN ÉCRIT SOUS « Notifier », à la place de la phrase devenue fausse.
 *
 * Elle dit la règle de §2.3 telle qu'elle s'applique vraiment, et elle reprend le
 * vocabulaire de la planche — « sourdine », pas « notifications désactivées ».
 */
export const NOTIFIER_SOURDINE = 'Les membres en sourdine ne sont pas notifiés.';

export const a08tFallback: A08TData = {
  reseau: enteteVide,
  actions: actionsVides,
  outils: outilsVides,
  composeur: composeurVide,
  colonne: colonneVide,
  filtreMembres: filtreMembresVide,
  apropos: aproposVide,
  pilotage: pilotageVide,
  vides: videsVides,
  notifierSourdine: NOTIFIER_SOURDINE,
  annonce: annonceVide,
  gerer: gestionVide,
  sourdine: sourdineVide,
  onContacterModerateurs: () => {},
  contactEnCours: true,
  /**
   * AUCUNE PUBLICATION tant que l'appel n'est pas revenu, et surtout aucune
   * publication INVENTÉE : c'est la même doctrine que `enteteVide` — un fil vide
   * se voit, un fil faux ne se voit pas. Les trois cartes de la maquette
   * (« Aïcha Diop », « Marc Koudou », « Fatou Ndiaye ») sont précisément ce que
   * ce lot retire.
   */
  publications: [],
  evenements: evenementsVides,
  album: albumVide,
};

/** Le genre du réseau, tel que la maquette l'écrit dans sa ligne de résumé. */
const GENRE: Record<CommunityDetailResponse['kind'], string> = {
  CITY: 'réseau de ville',
  COUNTRY: 'réseau de pays',
  INTEREST: "réseau d'intérêt",
};

/**
 * La visibilité, telle que la maquette la nomme en pastille.
 *
 * « Public » est le seul mot que la maquette dessine — les deux autres réseaux
 * ne sont jamais montrés sur ces planches. Les mots sont donc ceux que
 * `a07/data.ts` emploie déjà pour les mêmes états, et non des mots nouveaux.
 */
const VISIBILITE: Record<CommunityDetailResponse['visibility'], string> = {
  PUBLIC: 'Public',
  ON_REQUEST: 'Sur demande',
  INVITE_ONLY: 'Privé',
};

const ROLE: Record<NonNullable<CommunityDetailResponse['myRole']>, string> = {
  OWNER: 'propriétaire',
  MODERATOR: 'modérateur',
  MEMBER: 'membre',
};

const APPARTENANCE: Record<NonNullable<CommunityDetailResponse['myRole']>, string> = {
  OWNER: 'vous gérez ce réseau',
  MODERATOR: 'vous êtes modérateur',
  MEMBER: 'vous êtes membre',
};

export { APPARTENANCE, GENRE, ROLE, VISIBILITE };
