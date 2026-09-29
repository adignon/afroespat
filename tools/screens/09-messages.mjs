/**
 * Les écrans de `docs/template/09 Messages et transverse.dc.html` — M01, X01 à X04.
 *
 * Un fichier par maquette : voir l'en-tête de `01-onboarding.mjs` pour la raison.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * CETTE MAQUETTE EST ENTIÈREMENT STATIQUE, comme 04, 05 et 07.
 *
 * Vérifié plutôt que supposé : le fichier contient **zéro** `{{ … }}`, **zéro**
 * `<sc-for>`, **zéro** `<h2>`, et son `renderVals()` rend `{}`. Il n'y a donc rien
 * à recopier dans un `data.ts` — le détail du constat, et pourquoi en inventer une
 * donnée serait pire que n'en avoir aucune, est dans
 * `apps/web/src/screens/entraide/data.ts`.
 *
 * Conséquence pratique : chaque ÉTAT est une PLANCHE, et le rôle de la page est de
 * CHOISIR la planche — pas d'alimenter un composant.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * CE QUE LA MAQUETTE DESSINE, PLANCHE PAR PLANCHE (ses propres intitulés) :
 *
 *   M01  cadre 1440         · MOBILE · LISTE · MOBILE · CONVERSATION
 *        + deux CARTES hors cadre : « MENU DE LA CONVERSATION » (300 px) et
 *          « DEMANDE EN ATTENTE » (340 px) — voir plus bas, elles ne sont pas livrées.
 *   X01  cadre 1440 (suggestions dépliées) · MOBILE · + une carte « ÉTATS / VIDE ».
 *   X02  PANNEAU DÉROULANT (1440) · PAGE COMPLÈTE (1440) · MOBILE.
 *   X03  ORDINATEUR (carte nue 480 px) · CONFIRMATION (carte nue 360 px) · MOBILE.
 *   X04  NIVEAU (480 px) · PLAN (480 px) · MOBILE — qui porte les DEUX encarts.
 */

const FILE = 'docs/template/09 Messages et transverse.dc.html';

const screen = ({ section, out, frames, ...rest }) => ({
  file: FILE,
  section,
  out: `apps/web/src/screens/${out}`,
  dataModule: '../messages/data',
  dataType: 'MessagesData',
  frames,
  ...rest,
});

/** Un cadre : largeur, nom, rang parmi les planches de même largeur, titre de page. */
const f = (width, name, occurrence = 0, title = undefined) => ({ width, name, occurrence, title });

/** Titre visible d'un cadre : le texte tel que la maquette l'écrit, et son corps. */
const t = (text, size) => ({ text, size });

export const screens = [
  /**
   * ── M01 · /messages et /messages/:id ───────────────────────────────────────
   *
   * TROIS PLANCHES POUR DEUX ROUTES, et c'est la maquette qui le décide.
   *
   * Sur ordinateur elle ne dessine QU'UN cadre : les deux volets côte à côte
   * (liste de 320 px + conversation), exactement ce que T5 décrit — « deux volets
   * sur ordinateur, pages séparées sur mobile ». `/messages` et `/messages/:id`
   * ont donc le MÊME cadre d'ordinateur, et les deux pages l'emploient. En
   * dessiner un second, sans conversation ouverte, serait inventer une planche.
   *
   * Sur mobile elle en dessine deux, et les nomme : « MOBILE · LISTE » puis
   * « MOBILE · CONVERSATION ». Ce sont les occurrences 0 et 1 des 390 px.
   *
   * LES DEUX CARTES DE DROITE NE SONT PAS LIVRÉES, et c'est délibéré :
   *
   *   · « MENU DE LA CONVERSATION » (300 px) — Voir le profil, Mettre en sourdine,
   *     Bloquer, Signaler. C'est le menu du « … » de l'en-tête ;
   *   · « DEMANDE EN ATTENTE » (340 px) — la bulle du premier message et l'encart
   *     « Premier message envoyé. Vous pourrez continuer quand Marc aura répondu. »
   *     (08 §5.2, T5 M01).
   *
   * Aucune des deux n'est un cadre : ce sont des cartes nues, sans voile et sans
   * panneau positionné — la même forme que la « feuille de demande » de H06, qui
   * n'a pas été montée non plus. Les transcoder en modale demanderait d'emprunter
   * un voile à la section, or M01 n'en dessine AUCUN (`adaptModalFrame` ne
   * trouverait rien : `background:rgba(…)` n'y apparaît que dans le fond du rail,
   * pas en `position:absolute;inset:0`). Et la carte du menu ne porte ni croix ni
   * poignée : la fenêtre produite ne se fermerait ni au clic ni au clavier. Leur
   * ajouter l'un ou l'autre serait dessiner à la place du porteur.
   *
   * AUCUN DÉCLENCHEUR, par voie de conséquence : « Signaler » et « Bloquer » ne
   * vivent que dans cette carte, donc dans aucun cadre. La feuille X03 s'ouvre par
   * l'URL — même choix, et pour la même raison, que le sélecteur de parcours de
   * J01M (voir `apps/web/src/screens/parcours/data.ts`).
   */
  screen({
    section: 'M01',
    out: 'm01',
    frames: [
      // « Messages » est le titre du volet de gauche, 18 px / 800. Il ne figure
      // qu'une fois dans ce cadre : ni le rail ni le panneau d'accueil ne le
      // portent, parce que 08 §5.1 l'exige — « la messagerie n'est pas une entrée
      // de navigation : icône en barre haute ».
      f(1440, 'Desktop', 0, t('Messages', '18px')),
      f(390, 'Mobile', 0, t('Messages', '21px')),
      // La conversation titre le nom de la conversation — ici celui du parcours,
      // comme 08 §8 le demande (« conversation de parcours nommée par le titre du
      // parcours »). 16 px sur l'en-tête mobile.
      f(390, 'MobileConversation', 1, t('Mes études à Lyon', '16px')),
    ],
  }),

  /**
   * ── X01 · /recherche ───────────────────────────────────────────────────────
   *
   * Le cadre d'ordinateur dessine les SUGGESTIONS DÉPLIÉES (11 §2.3, « suggestions
   * dès 3 caractères ») : une carte en `position:absolute` par-dessus la page. Elle
   * fait partie du cadre, elle est donc transcodée avec lui.
   *
   * ⚠ LE CADRE MOBILE N'A AUCUN TITRE, et aucune déclaration ne peut en fabriquer
   * un. La maquette y écrit la requête dans le champ de recherche (14 px / 600) et
   * rien d'autre : pas de « Résultats pour … », pas de compteur en gros. Promouvoir
   * le contenu du champ en `<h1>` transformerait une saisie en titre de page — ce
   * serait un titre inventé, exactement ce qui a coûté A01. Le générateur le
   * signale à chaque exécution ; c'est consigné dans le rapport plutôt que masqué.
   *
   * La carte « ÉTATS / VIDE » n'est pas un cadre : c'est l'état vide (« Aucun
   * résultat. Posez la question à la communauté ? », 11 §2.4) dessiné en composant,
   * sans planche complète autour. Même traitement que les deux cartes de M01.
   */
  screen({
    section: 'X01',
    out: 'x01',
    frames: [
      f(1440, 'Desktop', 0, t('Résultats pour « visale »', '28px')),
      f(390, 'Mobile', 0),
    ],
  }),

  /**
   * ── X02 · le panneau de la cloche et /notifications ────────────────────────
   *
   * Trois planches, et la maquette les nomme : « PANNEAU DÉROULANT », « PAGE
   * COMPLÈTE », « MOBILE ». Les deux premières font 1440 px — d'où les occurrences.
   *
   * L'ordre des occurrences est celui du DOCUMENT : le panneau déroulant vient en
   * premier. La page complète est donc l'occurrence n° 1, et c'est elle qui sert de
   * cadre par défaut à `/notifications` (12 §2.7 : « cloche en barre haute avec
   * compteur de non-lus, panneau déroulant, page complète »).
   *
   * Le panneau déroulant est un ÉTAT de n'importe quelle page, pas une route : sa
   * planche dessine d'ailleurs un contenu principal VIDE (un bloc de 600 px sans
   * rien). Il est servi par `/notifications?vue=panneau`, pour qu'il soit
   * atteignable et éprouvable — la maquette ne dessine aucune cloche cliquable dans
   * les cadres de ce lot.
   */
  screen({
    section: 'X02',
    out: 'x02',
    frames: [
      f(1440, 'Desktop', 1, t('Notifications', '28px')),
      f(390, 'Mobile', 0, t('Notifications', '21px')),
      f(1440, 'DesktopPanneau', 0, t('Notifications', '17px')),
    ],
  }),

  /**
   * ── X03 · « Signaler » — fenêtre sur ordinateur, feuille du bas sur mobile ──
   *
   * La maquette l'écrit elle-même sous la planche, et sa planche d'ordinateur est
   * une CARTE NUE de 480 px : ni voile ni positionnement, exactement comme J03 et
   * J04. `adaptModalFrame` comble l'écart sans rien inventer — le cadre devient le
   * panneau, centré avec les valeurs de `03 Accueil v2`, et le voile est emprunté à
   * la planche MOBILE de la même section, qui le dessine (`rgba(22,33,29,.55)`).
   *
   * Les six motifs sont ceux de T5 et de 13 §… : Arnaque, Demande d'argent,
   * Harcèlement, Indésirable, Inapproprié, Autre. La note « La conversation sera
   * visible des modérateurs » est celle de 08 §5.2.
   */
  screen({
    section: 'X03',
    out: 'x03',
    modal: true,
    modalTitle: 'Signaler',
    frames: [f(480, 'Desktop'), f(390, 'Mobile')],
  }),

  /**
   * La CONFIRMATION est une planche à part — « Merci. Nous regardons sous 24
   * heures. » (T5 X03). Une carte nue de 360 px, elle aussi.
   *
   * ⚠ ELLE NE DESSINE AUCUNE FERMETURE : ni croix, ni poignée. La fenêtre ne se
   * refermera donc qu'au voile et à Échap, et le générateur le dit. On ne lui
   * ajoute pas de croix : ce serait dessiner à la place du porteur. Consigné au
   * rapport.
   *
   * Elle n'a pas de planche mobile propre : la même carte sert aux deux largeurs,
   * comme la feuille d'invitation de J05 (voir le type de `Modal`).
   */
  screen({
    section: 'X03',
    out: 'x03confirmation',
    modal: true,
    modalTitle: 'Merci.',
    frames: [f(360, 'MobileConfirmation')],
  }),

  /**
   * ── X04 · les encarts de refus ─────────────────────────────────────────────
   *
   * T5 les range en « composants » et ne leur donne AUCUNE route ; ils sont livrés
   * comme tels, sans page. Le dépôt a déjà trois écrans dans ce cas (A01G, A01S,
   * P03), et leur inventer une URL serait pire que de n'en avoir pas.
   *
   * UN SEUL CADRE, et c'est celui qui porte les DEUX encarts : la planche mobile de
   * 390 px montre « NIVEAU » et « PLAN » l'un sous l'autre, sur un écran « Créer un
   * événement » dont la barre d'onglets et la flèche de retour restent en place —
   * c'est la démonstration de ce que la maquette annonce en légende, « ne bloquent
   * jamais la navigation ».
   *
   * Les deux planches de 480 px ne sont PAS extraites : la maquette y écrit
   * `background:…;width:480px`, la largeur n'ouvre donc pas l'attribut `style` et
   * `extractFrame` ne les reconnaît pas. Élargir son motif le rendrait ambigu pour
   * toutes les autres maquettes ; le cadre mobile donne déjà les deux composants,
   * au même dessin près la largeur. Consigné au rapport.
   */
  screen({
    section: 'X04',
    out: 'x04',
    frames: [f(390, 'Mobile', 0, t('Créer un événement', '16px'))],
  }),
];
