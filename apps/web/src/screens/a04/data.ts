/**
 * Données de l'écran A04 — la lecture d'un guide, vue LECTEUR et vue AUTEUR.
 *
 * ── CE QUE LE CADRE EXPOSE, ET CE QU'IL NE PEUT PAS EXPOSER ─────────────────
 *
 * Il faut le dire d'emblée, parce que c'est la limite du lot et non un oubli :
 * le CORPS du guide, son titre, sa catégorie et sa ligne « Mis à jour le … » sont
 * du BALISAGE STATIQUE dans la maquette. Le transcodeur les a donc écrits en dur
 * dans `*.generated.tsx`, et ces fichiers ne se modifient pas à la main — la
 * régénération les effacerait.
 *
 * Les seules prises que le cadre lit vraiment sont les trois ci-dessous :
 * `contributors`, `guideActions` et `versions`. Elles SONT branchées sur l'API.
 * Le reste demande que la maquette pose des marqueurs de données, ce qui est un
 * travail de transcodage — remonté au rapport de lot plutôt que contourné en
 * modifiant un fichier généré.
 */
import type { ReactNode } from 'react';
import { panel, rail, shortcuts } from '../a01/data';

export { panel, rail, shortcuts };

export const panelGuides = panel('Guides & Démarches');

// ─── Chemins d'icônes de la maquette ────────────────────────────────────────

const EDIT = 'M4 20h4L19 9l-4-4L4 16z';
const FLAG = 'M5 21V4h12l-2 4 2 4H5';
const ALERT = 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8v5M12 16h.01';
/**
 * LE TRACÉ DE « Ouvrir à la communauté », relevé sur la carte d'auteur de 1 440 px.
 *
 * Il n'est dessiné QUE LÀ — zéro occurrence sur `desktop`, `mobile` et
 * `auteurmobile` — et c'est pour cela qu'il est recopié ici : la feuille du « … »
 * de 390 px doit porter LE MÊME tracé que la rangée d'ordinateur, pas un tracé
 * choisi. Même marché que `EDIT`, `FLAG` et `ALERT` juste au-dessus.
 */
const PEOPLE =
  'M9 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20a6 6 0 0 1 12 0M17 11a2.5 2.5 0 1 0 0-5M16 20h5a5 5 0 0 0-4-5';

// ─── LES PRISES DU CADRE, DÉCLARÉES ─────────────────────────────────────────

/**
 * Un contributeur, réduit à sa pastille d'avatar : le cadre n'en dessine que les
 * initiales sur un fond. Le NOM n'est pas lu — la maquette écrit « Marc Koudou et
 * 3 contributeurs » en dur à côté de la rangée.
 */
export interface ContributorView {
  readonly i: string;
  readonly bg: string;
}

/**
 * Une action sur le guide : « Proposer une correction », « L'information a
 * changé », « Signaler ».
 *
 * Elles sont TOUJOURS affichées, quel que soit le niveau du membre. §7.3 le veut
 * ainsi : on tente l'action, et le serveur répond `403 LEVEL_REQUIRED` avec de
 * quoi composer l'INVITATION à monter de niveau. Griser le bouton d'après un
 * niveau lu une fois serait la faille de quinze minutes rejouée dans le front —
 * et le membre n'apprendrait même pas ce qui lui manque.
 */
export interface GuideActionView {
  readonly label: string;
  readonly icon: string;
  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LES TROIS ACTIONS ÉTAIENT DES `href="#"`                                ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur : « Les actions sur la page de détail des guides sont dessinées
   * aussi. » MESURÉ : zéro `onClick` dans les deux cadres de A04, et les trois
   * entrées de la colonne étaient des liens morts.
   *
   * Les routes existaient toutes, et `useGuide` les appelait déjà :
   * `POST /guides/:id/outdated` pour « L'information a changé », la page
   * `/guides/:slug/corriger` pour « Proposer une correction », `POST /reports`
   * pour « Signaler ».
   */
  readonly cle?: string;
  /**
   * FACULTATIVE : seule « Proposer une correction » mène à une page. Les deux
   * autres ÉCRIVENT, et un `<a>` qui écrit serait un lien qui ment — le cadre
   * rend alors un `<button>`.
   */
  readonly vers?: string;
  readonly onChoisir?: () => void;
}

/**
 * Une ligne de l'historique (§2.7).
 *
 * `dot` marque la version COURANTE en vert et les autres en gris. La maquette le
 * calcule ainsi, et c'est `meta.currentVersionId` que l'API donne qui tranche —
 * jamais « la première de la liste » : l'historique est trié par numéro
 * décroissant, mais un retour arrière crée une version PLUS RÉCENTE dont le corps
 * est ancien, et la plus haute reste la courante. Les deux coïncident presque
 * toujours, ce qui est exactement ce qui rend l'erreur invisible.
 */
export interface VersionRowView {
  readonly t: string;
  readonly s: string;
  readonly dot: string;
}

/**
 * L'EN-TÊTE DU GUIDE, et pourquoi cette prise n'existait pas.
 *
 * L'en-tête de ce fichier disait, jusqu'à ce lot : « le CORPS du guide, son titre,
 * sa catégorie et sa ligne “Mis à jour le …” sont du BALISAGE STATIQUE dans la
 * maquette. Le transcodeur les a donc écrits en dur ». C'était vrai, et ce n'est
 * plus une fatalité : la clé `donnees` de `tools/screens/03-accueil.mjs` DÉCLARE la
 * prise avec l'écran, là où vivent déjà l'emprunt et le titre, sans toucher ni à la
 * maquette ni aux fichiers générés.
 *
 * Les quatre cadres de A04 affichaient donc « Obtenir la garantie Visale sans CDI »
 * quel que soit le guide demandé. Ce n'est pas un défaut de dessin : c'est l'écran
 * qui mentait sur ce qu'il montre.
 *
 * ── CE QUI RESTE HORS DE PORTÉE, ET POURQUOI ───────────────────────────────
 *
 * Le CORPS du guide reste dessiné. La maquette l'écrit en HTML riche — titres de
 * section, listes, passage surligné, légende d'image, infobulle « Proposer une
 * correction sur ce passage » — alors que l'API rend un seul `body` en Markdown
 * restreint (`currentVersion.body`). Le lier demanderait de RENDRE ce Markdown,
 * c'est-à-dire d'écrire un composant, pas de déclarer une prise. Remonté au
 * porteur : c'est le prochain lot de cet écran, et il est de transcodage.
 *
 * `community` est `maintainedByCommunity`, et il passe sous `<sc-if>` : à faux, le
 * bandeau DISPARAÎT au lieu d'affirmer un entretien communautaire qui n'existe pas.
 *
 * `useful` est `helpfulCount` — un compteur de VOTES d'utilité. Jamais de vues :
 * `guides.view_count` existe en base et la règle dure 00 §49 interdit qu'il sorte ;
 * le schéma `.strict()` de `@app/shared` le refuse à la frontière.
 */
export interface GuideHeadView {
  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LES TROIS PHRASES QUI RESTAIENT ÉCRITES EN DUR                          ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur : « tout ça est dessiné ». « 84 membres ont trouvé utile »,
   * « Marc Koudou et 3 contributeurs » et « 14 COMMENTAIRES » étaient les
   * nombres de la planche, affichés sur tous les guides. Les trois ont une
   * source dans `GET /guides/:slug`.
   */
  readonly utiles: string;
  readonly contributeurs: string;
  /** La même ligne, raccourcie : le cadre de 390 px manque de place. */
  readonly contributeursCourt: string;
  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ « — » TOUT SEUL SOUS LE TITRE D'UN GUIDE TOUT NEUF                      ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur, capture à l'appui : sous le titre s'affichait un tiret cadratin
   * seul, sans avatars. MESURÉ : c'est `contributeursCourt`, que
   * `phraseContributeurs(…, court = true)` rend `'—'` quand le guide n'a aucun
   * contributeur — et `'Aucun contributeur'` sur la planche d'ordinateur, qui a
   * le même défaut sous une autre forme.
   *
   * Les deux occupent la place d'une information qui n'existe pas : un tiret seul
   * se lit comme un défaut d'affichage, et « Aucun contributeur » dit à l'auteur
   * d'un guide fraîchement publié qu'il n'y est pour rien. LA LIGNE TOMBE donc —
   * rangée de pastilles comprise — et ce booléen est sa condition.
   *
   * IL EST CALCULÉ PAR `guideHeadFrom`, à côté des deux phrases qu'il gouverne :
   * une condition écrite dans le cadre aurait divergé d'elles au premier
   * changement de règle. Les DEUX PHRASES RESTENT, et ce n'est pas une
   * contradiction : elles servent encore dès qu'il y a au moins un contributeur,
   * et leur repli sans contributeur reste là pour quiconque les lirait ailleurs.
   */
  readonly aContributeurs: boolean;
  /**
   * « 14 COMMENTAIRES ».
   *
   * CE QUI A CHANGÉ : cette ligne disait « COMMENTAIRES » sans nombre, et
   * `from-api.ts` l'avouait — « ⚠ LE COMPTE DES COMMENTAIRES N'A PAS DE SOURCE sur
   * cette route : `guideDetailResponseSchema` ne le porte pas ». Il le porte
   * maintenant : `guide.commentCount`, un entier, et il compte CE QUE LA LISTE
   * AFFICHE (même critère de visibilité que le fil), donc il ne peut pas annoncer
   * douze commentaires pour un fil qui en montre neuf.
   */
  readonly commentaires: string;

  /**
   * L'AUTEUR, ABRÉGÉ — « Marc K. », comme la maquette l'écrit sous ses images et
   * dans son accusé d'envoi. `null` sur un guide anonymisé (§8) : on ne nomme pas
   * une absence, et la ligne qui s'en sert tombe alors.
   *
   * C'est l'auteur de la VERSION COURANTE quand il est connu, sinon celui du
   * guide. ⚠ ÉCART REMONTÉ : ce n'est pas « qui a ajouté CETTE image » — personne
   * ne le sait, voir l'en-tête de `CorpsGuide`.
   */
  readonly auteurCourt: string | null;

  readonly title: string;
  readonly cat: string;
  readonly scope: string;
  readonly updated: string;
  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LE BANDEAU DU GUIDE VIENT DE `banners`, ET UN SEUL S'AFFICHE             ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur : « Le "Maintenu par la communauté" est correct et dynamique ? »
   * puis « Lier le bandeau du guide aux banners du serveur. »
   *
   * `community` NE VEUT PLUS DIRE `maintainedByCommunity`. Il veut dire : « c'est
   * le bandeau VERT qu'il faut dessiner ». La nuance n'est pas cosmétique — un
   * guide peut être maintenu par la communauté ET périmé, et dans ce cas c'est
   * l'avertissement qui s'affiche, pas le confort. Voir `guideHeadFrom`, qui
   * tranche et qui écrit pourquoi.
   *
   * `avertissement` dit qu'il faut dessiner le bandeau AMBRE, et
   * `avertissementTexte` ce qu'il dit — les deux avertissements du serveur ne
   * disent pas la même chose. Les deux prises sont FACULTATIVES dans les faits
   * (la maquette d'exemple ci-dessous les met à faux) mais DÉCLARÉES
   * obligatoires : un cadre qui cesserait de les recevoir doit faire échouer
   * `tsc`, pas disparaître en silence.
   *
   * ⚠ LES DEUX NE PEUVENT PAS ÊTRE VRAIS EN MÊME TEMPS, et c'est garanti à la
   * composition, pas par le dessin : les cadres rendent deux `<sc-if>` frères,
   * donc deux bandes superposées si les deux arrivaient vrais.
   */
  readonly community: boolean;
  readonly avertissement: boolean;
  readonly avertissementTexte: string;
  readonly useful: number;
  /**
   * Le NOMBRE de contributeurs, et non `contributors.length` : la rangée de
   * pastilles est TRONQUÉE par le dessin (la maquette en montre quatre sur
   * l'ordinateur et trois sur le mobile) alors que ce compteur est celui que la
   * planche écrit sous « VOUS ÊTES L'AUTEUR ». Les déduire l'un de l'autre ferait
   * afficher « 3 contributeurs » à un guide qui en a douze.
   */
  readonly contributorCount: number;
  /** Les propositions de correction EN ATTENTE (§2.4) — la pastille orange. */
  readonly proposals: number;
  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LES SIGNALEMENTS « A CHANGÉ » : LE COMPTE, ET RIEN QUE LE COMPTE         ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ CE QUE CE BLOC DISAIT, ET CE QUE LE PORTEUR A RETOURNÉ                  ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Il disait : « C'est pourquoi il n'y a ici qu'un NOMBRE, et pourquoi la rangée
   * qui le porte sur 1 440 px N'EST PLUS UN LIEN : il n'existe aucune page de
   * signalements. »
   *
   * LE PORTEUR : « Il faut faire ceci, l'auteur doit voir les signalements "a
   * changé". » La page existe (`/guides/:slug/signalements`), la route de lecture
   * aussi, et la rangée y mène — voir `hrefSignalements` plus bas.
   *
   * CE QUI SURVIT DE L'ARBITRAGE PRÉCÉDENT, C'EST L'ANONYMAT : « Les signalants
   * resteront anonymes » était la réponse à « faut-il NOMMER les signalants à
   * l'auteur ? ». L'auteur voit donc CE QUI a été signalé — date et commentaire —
   * et jamais PAR QUI. `signalements` reste un NOMBRE ici parce que c'est tout ce
   * que la carte d'auteur et la barre basse dessinent ; la liste, elle, vit sur sa
   * page (`SignalementsView` dans `a06/data.ts`).
   *
   * `signalementsMot` PORTE L'ACCORD — « 1 signalement », « 3 signalements » — et
   * il est séparé du nombre parce que le DESSIN les sépare : la barre basse de
   * 390 px met le nombre en `<strong>` et laisse le mot en encre normale. Une seule
   * prise portant « 3 signalements » aurait mis le mot en gras avec lui.
   *
   * ⚠ LE MOT EST RELEVÉ, PAS RÉDIGÉ : la maquette l'écrit en bas de casse sous un
   * nombre, dans la pastille de statistiques de sa planche « ADMIN · GÉRER » de
   * 390 px (« 2 / signalements », ligne 1399). C'est le même usage — un compte et
   * son mot — et c'est le seul endroit du dossier `docs/template/` qui l'écrive
   * ainsi.
   *
   * À ZÉRO, LE COMPTEUR MOBILE DISPARAÎT (`<sc-if>`, comme la pastille des
   * propositions juste au-dessus) : « 0 signalement » sur un guide que personne ne
   * conteste est du bruit. ⚠ LA RANGÉE DE 1 440 px, ELLE, GARDE SON « 0 » : la
   * maquette le dessine en clair à côté de son libellé, et un libellé sans valeur
   * se lirait comme un chargement qui n'a pas abouti. L'écart est voulu et remonté.
   */
  readonly signalements: number;
  readonly signalementsMot: string;
  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ OÙ MÈNENT LES DEUX BOUTONS « MODIFIER » DE LA VUE AUTEUR                 ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * `/guides/:slug/modifier`. UNE ADRESSE et non un geste, parce que c'en est une :
   * `A04_MODIFIER` rend donc un `<Link>` — un `<button>` qui appellerait
   * `router.push` perdrait le clic milieu, l'ouverture dans un onglet et l'aperçu
   * de la destination dans la barre d'état.
   *
   * ⚠ CE N'EST PAS UNE AUTORISATION. Les deux boutons ne sont dessinés que sur les
   * cadres AUTEUR, que `guide-screen.tsx` ne monte que si le SERVEUR a dit
   * `isAuthor` — et même alors, c'est `GET /guides/:slug/editor` (capacité
   * `guide.write`, N2, `loadOwned`) qui tranche. Un lien ne protège rien.
   *
   * ⚠ ET CE N'EST PAS LE « Modifier » DU RAIL. Celui-là (« VOS RACCOURCIS ·
   * Modifier ») est dessiné sur toutes les planches du module, vue LECTEUR
   * comprise : il parle des raccourcis du membre. Voir l'en-tête de
   * `A04_MODIFIER`.
   */
  readonly hrefModifier: string;
  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ OÙ MÈNE LA RANGÉE « SIGNALEMENTS “A CHANGÉ” »                            ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * `/guides/:slug/signalements`. UNE ADRESSE, donc `A04_SIGNALEMENTS` rend un
   * `<Link>` — même raison que `hrefModifier` juste au-dessus : un `<button>` qui
   * appellerait `router.push` perdrait le clic milieu et l'aperçu de la
   * destination.
   *
   * ⚠ CE N'EST PAS UNE AUTORISATION. La rangée n'est dessinée que sur les cadres
   * AUTEUR, et c'est `GET /guides/:id/outdated` — capacité `guide.write`, N2,
   * `loadOwned` — qui tranche. Un lien ne protège rien.
   */
  readonly hrefSignalements: string;
  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ OÙ MÈNE « PROPOSITIONS REÇUES » — LE DERNIER LIEN MORT DES GUIDES        ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * MESURÉ avant ce lot, sur les cadres produits :
   *
   *   · `auteurdesktop.generated.tsx` — `<a href="#">Propositions reçues</a>`,
   *     avec sa pastille `{guide.proposals}` DÉJÀ branchée, dans une rangée qui ne
   *     menait nulle part. La page existait pourtant depuis plusieurs lots
   *     (`/guides/:slug/propositions`) ;
   *   · `auteurmobile.generated.tsx` — le bouton « Propositions » de la barre
   *     basse, avec la même pastille branchée, et `<button>` SANS `onClick`. Le
   *     même défaut, sur l'autre planche : compté, pas supposé.
   *
   * `/guides/:slug/propositions`, par le SLUG comme `hrefModifier` et
   * `hrefSignalements` (§2.1 le fige à la publication, précisément pour que
   * l'adresse reste bonne).
   *
   * UN `<Link>` ET NON UN `<button>`, SUR LES DEUX PLANCHES : c'est une ADRESSE.
   * La règle est écrite à côté de `hrefModifier` — un `<button>` qui appellerait
   * `router.push` perdrait le clic milieu, l'ouverture dans un onglet et l'aperçu
   * de la destination dans la barre d'état. Voir `A04_PROPOSITIONS`.
   *
   * ⚠ CE N'EST PAS UNE AUTORISATION. La rangée et le bouton ne sont dessinés que
   * sur les cadres AUTEUR, et c'est le SERVEUR qui tranche à l'arrivée :
   * `GET /guides/:id/proposals` ne montre les propositions en attente qu'à
   * l'auteur, et les trois décisions exigent `guide.write` (N2) plus `loadOwned`.
   * Un lien ne protège rien.
   */
  readonly hrefPropositions: string;
  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ « OUVRIR À LA COMMUNAUTÉ » — LE LIBELLÉ EST UNE DONNÉE, ET IL LE FAUT    ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur : « le bouton ouvrir à la communauté ne marche pas. » MESURÉ : un
   * `<a href="#">` mort dans la carte d'auteur de 1 440 px, dessiné sur CE SEUL
   * cadre (zéro occurrence sur `desktop`, `mobile`, `auteurmobile`), et AUCUNE
   * route derrière.
   *
   * §2.5 : « Réversible si l'auteur revient et le demande. » L'action a donc DEUX
   * sens, et elle doit dire lequel elle fera. Un guide déjà ouvert affiche le
   * bandeau « Maintenu par la communauté » ; une rangée qui proposerait encore
   * « Ouvrir » contredirait le bandeau situé au-dessus d'elle.
   *
   * ⚠ L'AUTRE LIBELLÉ N'EST DANS AUCUNE MAQUETTE : voir `guideHeadFrom`, qui le
   * pose et le remonte.
   */
  readonly communauteLabel: string;
  /**
   * LE GESTE, ET POURQUOI IL N'EST PAS DANS `guideHeadFrom`.
   *
   * Il demande une CONFIRMATION — §2.4 ligne 52 : ouvrir, c'est renoncer à valider
   * les corrections de son propre guide — donc un état d'ouverture de fenêtre, qui
   * vit dans la page. C'est le même partage que `GuidePlanView` : la fabrique
   * compose ce qui se DÉDUIT de la réponse, la page apporte ce qui se CLIQUE.
   */
  readonly onCommunaute: () => void;
}

/** L'en-tête telle que la maquette la dessine, jusqu'à ce que l'API réponde. */
export const guide: GuideHeadView = {
  title: 'Obtenir la garantie Visale sans CDI',
  cat: 'Logement',
  scope: 'Universel',
  updated: 'Mis à jour le 12 mars 2026',
  community: true,
  /**
   * La planche d'exemple ne dessine PAS d'avertissement sur A04 — elle dessine le
   * bandeau vert. Le faux est donc la valeur de la maquette, pas un repli choisi.
   */
  avertissement: false,
  avertissementTexte: '',
  useful: 84,
  contributorCount: 3,
  proposals: 2,
  /** La valeur de la planche : sa carte d'auteur dessine « 0 » en clair. */
  signalements: 0,
  signalementsMot: 'signalements',
  /** Les valeurs de la planche, pour l'instant servi avant la réponse de l'API. */
  utiles: '84 membres ont trouvé utile',
  contributeurs: 'Marc Koudou et 3 contributeurs',
  contributeursCourt: 'Marc K. et 3',
  /** La planche DESSINE la ligne — quatre pastilles et son nom — donc vrai. */
  aContributeurs: true,
  commentaires: '14 COMMENTAIRES',
  auteurCourt: 'Marc K.',
  /**
   * LE SLUG DE LA MAQUETTE, dérivé de son propre titre — la valeur de la planche,
   * comme les onze au-dessus. Elle n'atteint l'écran que si `GET /guides/:slug`
   * n'a pas encore répondu, ce qui ne peut pas arriver sur les cadres AUTEUR :
   * `isAuthor` vient de cette réponse, et sans elle la vue auteur n'est pas montée.
   */
  hrefModifier: '/guides/obtenir-la-garantie-visale-sans-cdi/modifier',
  hrefSignalements: '/guides/obtenir-la-garantie-visale-sans-cdi/signalements',
  hrefPropositions: '/guides/obtenir-la-garantie-visale-sans-cdi/propositions',
  /** Le seul sens que la planche dessine : elle montre un guide pas encore ouvert. */
  communauteLabel: 'Ouvrir à la communauté',
  onCommunaute: () => undefined,
};

export const contributors: readonly ContributorView[] = [
  { i: 'MK', bg: '#0F5C48' },
  { i: 'AD', bg: '#16785E' },
  { i: 'FN', bg: '#2FA37D' },
  { i: 'IS', bg: '#B4581F' },
];

export const guideActions: readonly GuideActionView[] = [
  { label: 'Proposer une correction', icon: EDIT },
  { label: "L'information a changé", icon: ALERT },
  { label: 'Signaler', icon: FLAG },
];

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LES DEUX ACTIONS DE L'AUTEUR, POUR LA FEUILLE DU « … » DE 390 px           ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Ce ne sont PAS les trois actions du lecteur : celles-là sont fausses sur son
 * propre guide (l'API refuse « Proposer une correction » en `OWN_GUIDE`, §2.4, et
 * un auteur qui sait que l'information a changé corrige au lieu de se signaler).
 *
 * CE SONT LES DEUX GESTES DE SA CARTE DE 1 440 px, et les deux libellés comme les
 * deux tracés sont RELEVÉS sur cette carte — pas rédigés, pas choisis. Compté :
 * ni l'un ni l'autre n'est dessiné sur un cadre de 390 px, donc l'auteur de
 * téléphone ne pouvait ni voir ses signalements, ni ouvrir son guide.
 *
 * ⚠ « Propositions reçues », la TROISIÈME rangée de cette carte, n'y est pas : la
 * barre basse de `auteurmobile` porte DÉJÀ son bouton, avec sa pastille. L'ajouter
 * ici aurait répété un bouton situé à quelques pixels au-dessus de la feuille —
 * c'est l'arbitrage déjà écrit à `FEUILLE_VERSIONS` pour « Modifier ».
 *
 * `label` et `onChoisir` sont POSÉS PAR LA PAGE : le libellé de la bascule change
 * de sens (§2.5, réversible) et les deux gestes demandent le routeur ou une
 * fenêtre de confirmation. Voir `guide-screen.tsx`.
 */
export const guideActionsAuteur: readonly GuideActionView[] = [
  { label: 'Signalements « a changé »', icon: ALERT },
  { label: 'Ouvrir à la communauté', icon: PEOPLE },
];

export const versions: readonly VersionRowView[] = [
  { t: 'Version 6 — Délais mis à jour', s: '12 mars · Marc K.', dot: '#16785E' },
  { t: 'Version 5 — Section propriétaire', s: '2 février · Fatou N.', dot: '#CBD5D1' },
  { t: 'Version 4', s: '10 janvier · Aïcha D.', dot: '#CBD5D1' },
];

/** Ce que les quatre cadres générés de A04 consomment. */
export interface A04Data {
  rail: typeof rail;
  panelGuides: typeof panelGuides;
  shortcuts: typeof shortcuts;
  guide: GuideHeadView;
  contributors: readonly ContributorView[];
  guideActions: readonly GuideActionView[];
  /**
   * LE CORPS DU GUIDE, RENDU.
   *
   * Ce n'est PAS une donnée à lier mot par mot : c'est une région de longueur et
   * de structure inconnues — deux sections dessinées ne peuvent pas accueillir
   * un guide qui en a sept. La page le rend avec `CorpsGuide`, qui suit la
   * grammaire que le serveur impose (`restrictedMarkdownIssue`) et les styles de
   * la planche.
   */
  corpsGuide?: ReactNode;
  /**
   * LE MÊME CORPS, DESSINÉ POUR LA PLANCHE DE 390 px.
   *
   * DEUX PRISES ET NON UNE, et ce n'est pas une symétrie gratuite : `ScreenFrames`
   * rend les DEUX cadres et masque l'un par CSS, donc un seul nœud serait rendu
   * deux fois — ce qui allait tant que le corps n'était que du texte. L'IMAGE,
   * elle, n'a pas le même dessin aux deux largeurs : à 1 440 px la légende est
   * sous le bloc dans un `<figcaption>` suivie de « · Image ajoutée par … » ; à
   * 390 px elle est DANS le bloc et l'attribution occupe sa propre ligne, en
   * 11,5 px. Relevé sur les octets de la maquette.
   *
   * `A04_CORPS` pose la prise d'après la BORNE qui a servi à couper, donc d'après
   * la planche elle-même — jamais d'après une devinette.
   */
  corpsGuideMobile?: ReactNode;
  /**
   * « CE GUIDE VOUS A-T-IL AIDÉ ? » — les deux boutons étaient sans geste.
   *
   * `POST /guides/:id/vote` et `DELETE` pour défaire : revoter la même valeur
   * retire le vote, ce que `useGuide().voter()` fait déjà. L'état vient du
   * serveur (`myVote`), jamais d'une bascule locale.
   */
  voteUtile?: boolean;
  votePasUtile?: boolean;
  onVoteUtile?: () => void;
  onVotePasUtile?: () => void;
  /** Vrai pendant l'appel : les deux boutons s'éteignent plutôt que de partir deux fois. */
  voteOccupe?: boolean;
  versions: readonly VersionRowView[];
  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LA BARRE HAUTE DES DEUX CADRES DE 390 px                                ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur : « Le bouton back sur mobile et les icon du header ne marchent
   * pas. » MESURÉ : quatre `<span>` inertes sur le cadre du LECTEUR, trois sur
   * celui de l'AUTEUR (qui ne dessine pas le signet).
   *
   * DEUX DES QUATRE GESTES NE SONT PAS ICI, et c'est voulu : le PARTAGE et le
   * « … » ouvrent une surface, donc ils portent `data-modal-open` et la page les
   * écoute par délégation — le même chemin que « Commenter » sur le fil. Faire
   * voyager une fonction jusqu'à un bouton enfoui dans du JSX généré est
   * précisément ce que ce dépôt évite.
   *
   * Restent les deux qui APPELLENT : le retour et le signet.
   */
  /**
   * ⚠ ELLE N'EST PAS FACULTATIVE, contrairement aux prises de vote juste
   * au-dessus, et la raison est dans le JSX produit : les cadres lisent
   * `entete.onRetour` et `entete.signet`, c'est-à-dire qu'ils DÉRÉFÉRENCENT. Une
   * prise facultative obligerait le cadre généré à écrire `entete?.onRetour` —
   * un bouton sans geste, silencieusement, le jour où une page oublie la prise.
   * `voteUtile?` peut rester facultative parce qu'elle est LUE, pas déréférencée.
   */
  entete: GuideEnTeteMobileView;
  /**
   * LA FEUILLE D'ACTIONS DU « … », sur les deux cadres de 390 px.
   *
   * Elle est EMPRUNTÉE à la planche « ADMIN · MEMBRES — menu de rôle » de la même
   * maquette : aucun cadre de A04 ne dessine de feuille d'actions, et les trois
   * actions du guide — que la colonne d'ordinateur porte depuis un lot précédent
   * — n'avaient AUCUN accès à 390 px.
   */
  menu: GuideMenuView;
  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LE PLAN DES PAGES — LES TROIS SURFACES DE LA NAVIGATION DU LECTEUR       ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur : « Un guide peut avoir plusieurs pages. […] Ajoute une section à
   * droite en haut de "Ce guide vous a intéressé" qui va lister les pages, leur
   * titre, et un highlight pour la page active, et on peut aussi cliquer sur les
   * pages non actives pour les afficher. À droite des tags en haut à droite aussi
   * des icônes chevron left/right et au milieu le nom de la page, cliquable aussi. »
   *
   * ⚠ ELLE N'EST PAS FACULTATIVE, comme `entete` et `menu` : les quatre cadres
   * DÉRÉFÉRENCENT `plan.visible` et `plan.titre`. Une prise facultative aurait
   * obligé le cadre généré à écrire `plan?.visible` — c'est-à-dire un panneau qui
   * disparaît en silence le jour où une page oublie la prise.
   */
  plan: GuidePlanView;
}

/**
 * UNE PAGE DU PLAN, telle que les trois surfaces la rendent.
 *
 * ── POURQUOI LES NOMS SONT CEUX DU PANNEAU DE SECTION ──────────────────────
 *
 * `bg`, `fg`, `w`, `icon`, `label`, `count`, `href` : ce sont EXACTEMENT les
 * champs qu'une entrée de `panel(active)` porte, parce que le panneau de pages est
 * la carte « COMMUNAUTÉ » empruntée mot pour mot — rangée comprise. Les renommer
 * aurait demandé de réécrire la rangée, donc de la redessiner, donc de sortir de
 * l'emprunt. Voir `RANGEE_PANNEAU` dans `tools/screens/03-accueil.mjs`.
 *
 * `bg`/`fg`/`w` portent la SURBRILLANCE : fond `#E3F0EB`, encre `#0F5C48`,
 * graisse 700 sur la page lue — les trois valeurs que `panel()` donne déjà à son
 * entrée active, et aucune autre.
 *
 * `count` EST LE COMPTE DE COMMENTAIRES DE CETTE PAGE (`guidePageRefSchema`), et
 * `false` quand il est nul : la pastille orange de la rangée est sous `<sc-if>`, et
 * un rond vide ne dit rien. C'est ce qui permet au plan d'annoncer OÙ la
 * conversation a lieu.
 *
 * `icon` DIT LA PAGE LUE AUTREMENT QUE PAR LA COULEUR — la coche sur elle, la
 * liste de lignes sur les autres. La feuille de 390 px n'a pas de fond de rangée à
 * teinter (la planche empruntée n'en dessine pas), donc sans le tracé, la page lue
 * ne s'y distinguerait que par son encre.
 */
export interface GuidePlanPageView {
  readonly label: string;
  readonly href: string;
  readonly slug: string;
  readonly icon: string;
  readonly count: string | false;
  readonly bg: string;
  readonly fg: string;
  readonly w: number;
  readonly actif: boolean;
  /** La feuille de 390 px : ses rangées sont des `<button>`, pas des liens. */
  readonly onChoisir: () => void;
}

/**
 * LE PLAN DU GUIDE, et les quatre gestes de sa navigation.
 *
 * `visible` EST FAUX SUR UN GUIDE D'UNE SEULE PAGE, et c'est ce que le contrat
 * annonce d'avance (`guideDetailResponseSchema` : « le front dessine le plan quand
 * `pages.length > 1` et ne change rien sinon »). Ni le panneau, ni la rangée de
 * chevrons, ni la feuille ne se dessinent alors : deux chevrons éteints autour d'un
 * titre unique seraient du mobilier.
 *
 * `aPrecedent` / `aSuivant` DISENT L'EXTRÉMITÉ, et le cadre en fait un `disabled`
 * + un `aria-disabled` + un `title` qui le nomme (« Première page »). L'extinction
 * ne tient donc PAS qu'à la couleur.
 */
export interface GuidePlanView {
  readonly visible: boolean;
  /** Le titre en petites capitales de la carte — du texte de produit. */
  readonly libelle: string;
  /** Le titre de la page LUE : ce que la pastille du milieu affiche. */
  readonly titre: string;
  readonly pages: readonly GuidePlanPageView[];
  readonly aPrecedent: boolean;
  readonly aSuivant: boolean;
  readonly onPrecedent: () => void;
  readonly onSuivant: () => void;
  /**
   * LE NOM DU MILIEU, CLIQUABLE.
   *
   * Sur 390 px il OUVRE la feuille des pages — c'est le seul accès à la liste,
   * puisque la colonne de droite n'existe pas. À 1 440 px la liste est déjà à
   * l'écran : la page décide ce que le geste y fait, et `guide-screen.tsx` écrit
   * son arbitrage.
   */
  readonly onNom: () => void;
  readonly feuilleOuverte: boolean;
  readonly onFermerFeuille: () => void;
}

/**
 * Les deux gestes de la barre haute mobile qui appellent une fonction.
 *
 * ⚠ `signet` ET `signetOccupe` NE SONT LUS QUE PAR LE CADRE DU LECTEUR : la
 * planche de l'AUTEUR ne dessine pas le signet (elle écrit « Votre guide » et ne
 * porte que trois ronds). Compté sur les octets de la maquette, pas supposé
 * symétrique.
 */
export interface GuideEnTeteMobileView {
  /**
   * REVENIR D'OÙ L'ON VIENT.
   *
   * ⚠ LA PAGE DOIT PRÉVOIR L'ABSENCE D'HISTORIQUE, et c'est elle qui le fait :
   * `router.back()` ne fait RIEN quand l'onglet s'est ouvert directement sur
   * l'adresse d'un guide — ce qui est le cas normal d'un lien partagé, que §2.1
   * protège en figeant le slug « jamais modifié ». Un `back()` qui ne mène nulle
   * part serait un bouton mort d'une autre façon.
   */
  readonly onRetour: () => void;
  /** Vrai quand le guide est dans « Enregistrés » (`GET /me/bookmarks/states`). */
  readonly signet: boolean;
  readonly onSignet: () => void;
  /** Vrai pendant l'appel : le signet s'éteint plutôt que de partir deux fois. */
  readonly signetOccupe: boolean;
}

/** La feuille du bas du « … » : son état d'ouverture et sa liste d'actions. */
export interface GuideMenuView {
  readonly ouvert: boolean;
  readonly onFermer: () => void;
  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ DEUX LISTES, UNE SEULE PRISE — ET CE N'EST PAS UNE CONTRADICTION         ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * CE QUE CE COMMENTAIRE DISAIT : « LA MÊME LISTE QUE LA COLONNE D'ORDINATEUR
   * (`guideActions`) […] en recopier une seconde aurait fait diverger trois
   * libellés, trois tracés et trois gestes. » C'est toujours vrai POUR LE LECTEUR,
   * et c'est toujours ce qui se passe sur son cadre de 390 px.
   *
   * CE QUI A CHANGÉ : la feuille du « … » de l'AUTEUR porte maintenant des rangées
   * de geste, et ce ne sont pas celles du lecteur — ce sont les deux gestes de sa
   * carte de 1 440 px, que 390 px ne dessinait NULLE PART : la liste des
   * signalements et « Ouvrir à la communauté ». Les trois actions du lecteur, elles,
   * sont fausses sur son propre guide (l'API refuse « Proposer une correction » en
   * `OWN_GUIDE`, §2.4).
   *
   * C'EST DONC `guide-screen.tsx` QUI CHOISIT LA LISTE, et lui seul le peut : c'est
   * lui qui sait s'il monte la vue auteur ou celle du lecteur (`isAuthor`, recalculé
   * par le serveur à chaque requête). Une prise de plus aurait demandé aux deux
   * cadres de lire deux prises dont l'une serait toujours vide.
   */
  readonly actions: readonly GuideActionView[];
}
