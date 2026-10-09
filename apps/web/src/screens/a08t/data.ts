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
import type { CommunityDetailResponse } from '@app/shared';

export { CHAT, I, PIN, netTabsFor, panel, panelReseaux, rail, tab } from '../reseaux/chrome';

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

/** Ce que les vingt-cinq planches d'onglet consomment. */
export interface A08TData {
  readonly reseau: ReseauEnteteView;
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
  resumeProprietaire: '',
  monAppartenance: '—',
  monRole: '—',
  visibilite: '',
  description: '',
  descriptionLongueur: 0,
  moderateurs: 0,
  demandes: 0,
};

export const a08tFallback: A08TData = { reseau: enteteVide };

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
