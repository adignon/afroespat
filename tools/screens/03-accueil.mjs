/**
 * Les écrans de `docs/template/03 Accueil v2.dc.html`.
 *
 * Un fichier par maquette : voir l'en-tête de `01-onboarding.mjs` pour la raison.
 *
 * ── CE QUE MOB, MOB2, A08T ET A12T SONT VRAIMENT ──────────────────────────────
 *
 * La maquette compte vingt-deux sections, et quatre d'entre elles ne sont PAS des
 * écrans. Il faut les avoir lues pour ne pas produire quatre pages fantômes :
 *
 *   · **MOB** — « Versions mobiles ». Huit écrans de cette maquette (A03, A04, A05,
 *     A07, A08, A09, A10, A12) n'ont AUCUN cadre de 390 px dans leur propre
 *     section : leurs neuf cadres mobiles sont rassemblés ici, et la planche les
 *     annonce un par un — « A03 · Guides — liste », « A04 · Guide — lecture
 *     (lecteur) », « A04 · Guide — lecture (auteur) »… Ce sont donc les cadres
 *     mobiles de ces écrans, pas des écrans. Ils sont déclarés comme tels, par
 *     `frame.section`.
 *
 *   · **MOB2** — « Versions mobiles réseau et ville ». Même chose pour les dix-sept
 *     cadres mobiles des onglets de réseau, des onglets de fiche ville, et de la
 *     variante Carte de A11.
 *
 *   · **A08T** et **A12T** — « zone de contenu seule · menu de gauche et barre haute
 *     identiques à A08 ». Ce sont les ONGLETS de A08 et A12 : treize planches de
 *     1036 px pour le réseau (cinq en vue membre, huit en vue propriétaire), quatre
 *     pour la fiche ville. Chacune contient l'en-tête du réseau ou de la ville AVEC
 *     sa barre d'onglets, donc chacune se suffit comme zone de contenu — ce qui
 *     leur manque, c'est le rail et la barre haute, que A08 et A12 portent déjà.
 *
 *     ARBITRAGE : ce sont des VARIANTES D'ÉTAT de A08 et A12, pas des écrans. Elles
 *     sont donc générées dans `screens/a08t/` et `screens/a12t/` et montées sur la
 *     MÊME route que leur écran (`?onglet=`), à la place de sa zone de contenu.
 *     Les déclarer en écrans aurait donné dix-sept pages sans navigation, chacune
 *     avec une route inventée — et le rail aurait disparu en changeant d'onglet.
 *
 * Il ne reste donc que dix-sept ÉCRANS pour vingt-deux sections, et c'est cohérent :
 * la maquette regroupe ses cadres par forme, pas par page.
 */
const FILE = 'docs/template/03 Accueil v2.dc.html';

/**
 * Les dix-sept écrans qui restaient partagent UN SEUL jeu de données, parce que la
 * maquette n'a qu'un seul `renderVals()` pour ses vingt-deux sections. Le type est
 * donc unique lui aussi : `AccueilData`. Les cadres qui ne consomment rien — et il y
 * en a beaucoup, MOB, MOB2, A08T et A12T étant entièrement statiques dans la
 * maquette — reçoivent `_props`, ce que le générateur écrit tout seul.
 */
const DATA = { dataModule: '../accueil/data', dataType: 'AccueilData' };

/** Les deux cadres ordinaires : 1440 px et 390 px, dans la section de l'écran. */
const desktopAndMobile = [
  { width: 1440, name: 'Desktop' },
  { width: 390, name: 'Mobile' },
];

/**
 * Le cadre mobile d'un écran dont la planche « Versions mobiles » porte le dessin.
 * `occurrence` est le rang du cadre dans MOB, dans l'ordre où la planche les range.
 */
const fromMob = (occurrence, section = 'MOB', name = 'Mobile', heading = undefined) => ({
  width: 390,
  name,
  section,
  occurrence,
  ...(heading === undefined ? {} : { heading }),
});

export const screens = [
  {
    file: 'docs/template/03 Accueil v2.dc.html',
    section: 'A01',
    out: 'apps/web/src/screens/a01',
    dataModule: './data',
    dataType: 'A01Data',
    /**
     * Les deux fenêtres que le fil ouvre, et que la maquette nomme sous ses
     * planches : « Commentaires — ouverts depuis « Commenter » » et « Partager ».
     *
     * Le libellé du bouton de commentaire est une DONNÉE (`p.comment`), pas un
     * texte en dur : le marqueur porte donc l'interpolation du dialecte, telle
     * qu'elle est dans la maquette.
     */
    triggers: [
      { marker: '</svg>{{ p.comment }}', modal: 'A01C' },
      { marker: '</svg>Partager', modal: 'A01P' },
    ],
    frames: [
      { width: 1440, name: 'Desktop' },
      { width: 390, name: 'Mobile' },
    ],
  },

  /**
   * ── Lot 1 · les quatre modales du fil (03 Accueil v2.dc.html) ──────────────
   *
   * La maquette les annonce elle-même : « fenêtre sur web, feuille sur mobile ».
   * Elle DESSINE les deux formes — fenêtre centrée de 720 px sur ordinateur,
   * feuille du bas à 88 % avec sa poignée sur mobile — donc il n'y a aucune forme
   * à inventer, seulement le comportement à brancher (`Modal`).
   *
   * Elles partagent les données de A01, parce que la maquette les met dans le
   * MÊME `renderVals()` : le fil de commentaires et les contacts de partage
   * cohabitent avec les stories et le fil. Les séparer donnerait deux sources
   * pour un seul écran.
   */
  ...[
    { section: 'A01C', modalTitle: 'Commentaires' },
    { section: 'A01P', modalTitle: 'Partager' },
    { section: 'A01G', modalTitle: 'Lier un guide' },
    { section: 'A01S', modalTitle: 'Créer un sondage' },
  ].map((m) => ({
    file: 'docs/template/03 Accueil v2.dc.html',
    section: m.section,
    out: `apps/web/src/screens/${m.section.toLowerCase()}`,
    dataModule: '../a01/data',
    dataType: 'A01Data',
    modal: true,
    modalTitle: m.modalTitle,
    frames: [
      { width: 1440, name: 'Desktop' },
      { width: 390, name: 'Mobile' },
    ],
  })),

  /**
   * A01N — « Nouvelle publication », le composeur en plein écran. MOBILE SEUL.
   *
   * C'est le SECOND cadre de 390 px de A01S, et il avait été manqué : la
   * déclaration des modales ne prend que l'occurrence 0 (la fenêtre « Créer un
   * sondage »), et rien ne signalait qu'il y en avait une deuxième.
   *
   * CE CADRE N'A AUCUN PENDANT D'ORDINATEUR, et ce n'est pas un oubli de
   * déclaration : la maquette ne dessine le composeur rempli, côté web, que dans une
   * COLONNE DE DOCUMENTATION de 760 px. Voir la note ci-dessous — elle vaut pour le
   * lot qui unifiera les mécanismes de sélection.
   *
   * La maquette fait loi : elle a décidé que cet écran est mobile, il est donc livré
   * tel quel. C'est le miroir exact de O05, qui n'a pas de cadre mobile et dont le
   * cadre unique sert aux deux largeurs (`docs/decisions.md`) — sauf qu'ici le cadre
   * unique est celui du téléphone.
   *
   * ── CE QU'IL NE FAUT PAS TRANSCODER, ET POURQUOI ─────────────────────────────
   *
   * Le bloc de 760 px de la même section n'est PAS un écran. C'est une colonne de
   * documentation à sept enfants : la légende « COMPOSEUR AVEC PIÈCES JOINTES —
   * WEB », la carte du composeur rempli, la légende « COMPOSANTS », la grille des
   * trois règles, la phrase sur l'icône, la légende « ÉTAT VIDE », puis le composeur
   * vide. Le transcoder mettrait « COMPOSANTS » et « ÉTAT VIDE » dans l'application.
   *
   * La seule partie utile — la carte du composeur rempli — est un
   * `<div style="width:100%…">` : `extractFrame` sélectionne par largeur EN PIXELS
   * et ne peut pas la désigner. L'atteindre demanderait un mécanisme de sélection
   * par autre chose que la largeur, qui n'a pas sa place dans ce lot ; il est laissé
   * au lot qui unifiera les trois mécanismes de titre, où la question est déjà posée.
   *
   * Les trois règles que cette colonne énonce sont, elles, FIGÉES par
   * `apps/web/src/screens/accueil/composeur.test.ts`.
   */
  {
    section: 'A01N',
    out: 'apps/web/src/screens/a01n',
    // Ce cadre ne consomme AUCUNE donnée — la maquette l'écrit entièrement en dur,
    // zéro `{{ }}`, compté. Il prend donc le type par défaut du fichier
    // (`AccueilData`) plutôt que celui des modales voisines : c'est celui qui a déjà
    // une fabrique (`accueilData()`), et le composant n'en lit rien de toute façon.
    heading: 'Nouvelle publication',
    frames: [{ section: 'A01S', width: 390, name: 'Mobile', occurrence: 1 }],
  },

  // ══ Lot 2 · les dix-sept sections restantes ═════════════════════════════════

  /**
   * A02 — une publication et son fil de réponses. `/publications/:id`
   *
   * AUCUN `heading` déclaré, et c'est délibéré : ce cadre ne dessine pas de titre.
   * Son contenu est la publication elle-même, dont le texte fait cinq lignes. En
   * inventer un — « Publication de Fatou Ndiaye » — serait exactement la faute que
   * l'en-tête de `dc-to-jsx.mjs` raconte. Le générateur le signale, et c'est bien :
   * c'est un manque de la MAQUETTE, pas du transcodage.
   */
  { section: 'A02', frames: desktopAndMobile },

  /**
   * A13 — une story en lecture plein écran. `/stories/:id`
   *
   * « un composant, trois types · AUCUN COMPTEUR DE VUES », écrit la maquette sous
   * sa planche. Elle tient la règle dure §1.2 d'elle-même : rien à signaler.
   */
  { section: 'A13', frames: desktopAndMobile },

  /**
   * A14 — création d'une story, en trois étapes. `/stories/nouvelle`
   *
   * Quatre cadres de 390 px, qui sont les ÉTATS d'un même écran et non quatre
   * écrans : « 1 · Écrire », sa variante photo, « 2 · Rattacher », « 3 · Publier ».
   * Le cadre de 1440 px montre les trois étapes côte à côte sur un fond sombre.
   *
   * `keepFrameStyle` : SEUL écran de cette maquette à en avoir besoin. Ses cadres
   * mettent de la vraie mise en page dans le conteneur que le générateur retire —
   * `padding: 48px 16px 26px`, `color: #fff`, et un fond qui est une DONNÉE
   * (`background: {{ writeBg }}`, la couleur choisie dans la palette). Sans cela le
   * texte blanc se retrouvait sur fond clair, collé aux bords.
   */
  {
    section: 'A14',
    keepFrameStyle: true,
    frames: [
      { width: 1440, name: 'Desktop' },
      // Les deux premières étapes mobiles n'écrivent AUCUN titre : l'écran est le
      // champ de saisie lui-même, sur fond de couleur. Rien à déclarer, et rien à
      // inventer — l'avertissement du générateur dit le manque de la maquette.
      { width: 390, name: 'Mobile', occurrence: 0 },
      { width: 390, name: 'MobilePhoto', occurrence: 1 },
      { width: 390, name: 'MobileRattacher', occurrence: 2, heading: 'Ce conseil concerne…' },
      { width: 390, name: 'MobilePublier', occurrence: 3, heading: 'Prêt à publier' },
    ],
  },

  // ── Guides · A03 à A06 ──────────────────────────────────────────────────────

  /** A03 — la liste des guides. `/guides` */
  { section: 'A03', frames: [{ width: 1440, name: 'Desktop' }, fromMob(0, 'MOB', 'Mobile', 'Guides et Démarches')] },

  /**
   * A04 — la lecture d'un guide. `/guides/:slug`
   *
   * DEUX vues, que la maquette nomme sous ses planches : « VUE LECTEUR » et « VUE
   * AUTEUR — “Proposer une correction” laisse place à Modifier et aux propositions
   * reçues ; le passage visé par une proposition est souligné en pointillé ». Ce
   * sont deux états du même écran, pas deux pages.
   *
   * Cet écran est le SEUL de la maquette à écrire son `<h1>` lui-même — le titre du
   * guide, en 30 px. Ses `<h2>` sont les sections du guide. Voir la garde de
   * `promoteFirstHeading` : sans elle, « 1. Vérifier votre éligibilité » devenait un
   * second `<h1>`.
   */
  {
    section: 'A04',
    frames: [
      { width: 1440, name: 'Desktop', occurrence: 0 },
      // Le cadre mobile ne BALISE pas son titre, alors que celui d'ordinateur le
      // fait : c'est le même texte, le nom du guide, en 24 px au lieu de 30.
      fromMob(1, 'MOB', 'Mobile', 'Obtenir la garantie Visale sans CDI'),
      { width: 1440, name: 'AuteurDesktop', occurrence: 1 },
      fromMob(2, 'MOB', 'AuteurMobile', 'Obtenir la garantie Visale sans CDI'),
    ],
  },

  /**
   * A05 — l'éditeur de guide. `/guides/nouveau`
   *
   * À SAVOIR POUR LA PAGE : la maquette met `flex-direction: column` dans le
   * conteneur du cadre, que le générateur retire parce qu'il portait aussi la taille
   * fixe. C'est le seul cadre d'ordinateur de cette maquette en colonne — tous les
   * autres sont en rangée, rail à gauche. Sa page passe donc `direction="column"` à
   * `ScreenFrames` ; sans cela, sa barre d'outils se retrouve À CÔTÉ du corps du
   * guide au lieu d'être au-dessus.
   */
  {
    section: 'A05',
    heading: 'Nouveau guide',
    frames: [
      { width: 1440, name: 'Desktop' },
      // « Nouveau guide » est le titre du cadre d'ORDINATEUR seul. Le cadre mobile
      // met à sa place le nom du brouillon en cours ; on ne lui impose pas un titre
      // qu'il ne dessine pas.
      fromMob(3, 'MOB', 'Mobile', 'Mon arrivée étudiante à Lyon'),
    ],
  },

  /**
   * A06 — les propositions de correction. Deux planches, deux écrans.
   *
   *   · « 1 · PROPOSER UNE CORRECTION — PANNEAU LATÉRAL SUR LA PAGE DU GUIDE (WEB)
   *     · FEUILLE DU BAS (MOBILE) » → `Corriger*`, route `/guides/:slug/corriger`.
   *   · « 2 · page “Propositions reçues” de l'auteur » → `Desktop`/`Mobile`,
   *     route `/guides/:slug/propositions`.
   *
   * ARBITRAGE — pourquoi « Corriger » N'EST PAS déclaré `modal: true`, alors que
   * c'est un panneau par-dessus une page :
   *
   * Sur ORDINATEUR la maquette ne dessine pas une modale. Le voile et le panneau ne
   * sont pas les enfants directs du cadre : ils sont IMBRIQUÉS dans la colonne de
   * contenu, à droite du rail. C'est un panneau latéral sur la page du guide, et la
   * maquette l'écrit — le rail et la barre haute restent utilisables. `adaptModalFrame`
   * ne travaille que sur les enfants directs (à dessein : le panneau d'une modale
   * contient des dizaines de `position: absolute` internes qui sont du design), donc
   * il ne les trouverait pas.
   *
   * Sur MOBILE c'est bien une feuille du bas, avec son voile — mais son fantôme est
   * à `opacity: .6`, pas `.5`, donc `adaptModalFrame` ne le retirerait pas non plus.
   *
   * Les deux cadres sont donc transcodés tels quels, comme la maquette les dessine :
   * une PAGE qui contient son panneau ouvert. Ce qu'on perd, et qu'il faut savoir :
   * sur mobile le contenu derrière la feuille est l'esquisse de la maquette, pas le
   * vrai guide. C'est à brancher quand la lecture et la correction partageront un
   * état — pas quelque chose que le transcodage puisse deviner.
   */
  {
    section: 'A06',
    frames: [
      { width: 1440, name: 'Desktop', occurrence: 1 },
      { width: 390, name: 'Mobile', occurrence: 1, heading: 'Propositions reçues' },
      { width: 1440, name: 'CorrigerDesktop', occurrence: 0 },
      // Le même titre que sur l'ordinateur : la PAGE est le guide, la correction est
      // le panneau qui s'ouvre par-dessus.
      { width: 390, name: 'CorrigerMobile', occurrence: 0, heading: 'Obtenir la garantie Visale sans CDI' },
    ],
  },

  // ── Réseaux · A07 à A10 ─────────────────────────────────────────────────────

  /** A07 — mes réseaux et la découverte. `/reseaux` */
  { section: 'A07', frames: [{ width: 1440, name: 'Desktop' }, fromMob(4, 'MOB', 'Mobile', 'Réseaux')] },

  /**
   * A08 — un réseau, onglet Sujets. `/reseaux/:slug`
   *
   * `heading` déclaré : ce cadre écrit « Béninois en France » en 24 px dans un
   * `<div>`, comme toute la maquette. C'est le nom du réseau, donc le sujet de la
   * page — il devient son `<h1>`.
   */
  {
    section: 'A08',
    heading: 'Béninois en France',
    frames: [{ width: 1440, name: 'Desktop' }, fromMob(5)],
  },

  /**
   * A08T — les treize onglets du réseau, vue membre et vue propriétaire.
   *
   * Ce ne sont pas des écrans : voir l'en-tête de ce fichier. Chaque planche est la
   * ZONE DE CONTENU de A08 pour un onglet, en-tête du réseau et barre d'onglets
   * comprises, et elle porte son propre `<h1>` par le même titre déclaré que A08.
   *
   * Le cadre mobile de « À propos — propriétaire » MANQUE dans MOB2 : la planche
   * mobile passe directement de « Album — sélection » à « À propos — édition ». Ce
   * n'est pas un oubli de déclaration, c'est la maquette qui ne le dessine pas ; sur
   * mobile cet onglet retombe donc sur la vue membre, qui existe.
   */
  {
    section: 'A08T',
    out: 'apps/web/src/screens/a08t',
    heading: 'Béninois en France',
    frames: [
      { width: 1036, name: 'Fil', occurrence: 0 },
      { width: 1036, name: 'Evenements', occurrence: 1 },
      { width: 1036, name: 'Membres', occurrence: 2 },
      { width: 1036, name: 'Album', occurrence: 3 },
      { width: 1036, name: 'APropos', occurrence: 4 },
      { width: 1036, name: 'AdminFil', occurrence: 5 },
      { width: 1036, name: 'AdminGerer', occurrence: 6 },
      { width: 1036, name: 'AdminMembres', occurrence: 7 },
      { width: 1036, name: 'AdminEvenements', occurrence: 8 },
      { width: 1036, name: 'AdminAlbum', occurrence: 9 },
      { width: 1036, name: 'AdminAPropos', occurrence: 10 },
      { width: 1036, name: 'AdminAProposEdition', occurrence: 11 },
      // Quatre planches ne montrent PAS le nom du réseau : ce sont des formulaires
      // pleine page (annonce, gestion, édition du « À propos »), où le titre est
      // celui de la tâche. C'est la maquette qui en décide, pas nous.
      { width: 1036, name: 'AdminAnnonce', occurrence: 12, heading: 'Nouvelle annonce' },
      fromMob(0, 'MOB2', 'FilMobile'),
      fromMob(1, 'MOB2', 'EvenementsMobile'),
      fromMob(2, 'MOB2', 'MembresMobile'),
      fromMob(3, 'MOB2', 'AlbumMobile'),
      fromMob(4, 'MOB2', 'AProposMobile'),
      fromMob(5, 'MOB2', 'AdminFilMobile'),
      fromMob(6, 'MOB2', 'AdminGererMobile', 'Gérer le réseau'),
      fromMob(7, 'MOB2', 'AdminMembresMobile'),
      fromMob(8, 'MOB2', 'AdminEvenementsMobile'),
      fromMob(9, 'MOB2', 'AdminAlbumMobile'),
      fromMob(10, 'MOB2', 'AdminAProposEditionMobile', 'Modifier « À propos »'),
      fromMob(11, 'MOB2', 'AdminAnnonceMobile', 'Nouvelle annonce'),
    ],
  },

  /** A09 — un sujet du réseau. `/reseaux/:slug/sujets/:id` */
  {
    section: 'A09',
    frames: [
      { width: 1440, name: 'Desktop' },
      fromMob(6, 'MOB', 'Mobile', 'Renouveler son passeport béninois depuis la France'),
    ],
  },

  /** A10 — créer un réseau. `/reseaux/nouveau` */
  {
    section: 'A10',
    frames: [{ width: 1440, name: 'Desktop' }, fromMob(7, 'MOB', 'Mobile', "Nouveau réseau d'intérêt")],
  },

  // ── Villes · A11 et A12 ─────────────────────────────────────────────────────

  /**
   * A11 — villes et membres. `/villes`
   *
   * « Carte (ordinateur) et Annuaire (mobile) », dit la maquette. Le cadre mobile de
   * la section est l'Annuaire ; la Carte mobile est dans MOB2, en dernière planche.
   */
  {
    section: 'A11',
    frames: [
      { width: 1440, name: 'Desktop' },
      { width: 390, name: 'Mobile', heading: 'Villes et Membres' },
      fromMob(16, 'MOB2', 'MobileCarte', 'Villes et Membres'),
    ],
  },

  /**
   * A12 — la fiche d'une ville, onglet Budgets réels. `/villes/:slug`
   *
   * `heading: 'Lyon'` et pas un motif de style : « 1 050 € », la médiane de budget,
   * fait aussi 30 px et gras dans ce cadre. Un motif qui promeut « le premier texte
   * de 30 px » aurait pris l'un ou l'autre selon l'ordre du DOM.
   */
  {
    section: 'A12',
    heading: 'Lyon',
    // Le bouton « Contribuer » de la barre d'onglets ouvre A12C. La maquette le dit
    // sous ses planches : « CONTRIBUER — DEPUIS LE BOUTON DE LA BARRE D'ONGLETS OU
    // "AJOUTER MON BUDGET" ». Dans ce cadre il est dessiné en `<span>` sans icône,
    // d'où un marqueur sur le texte seul ; les planches A12T, elles, le dessinent
    // derrière un « + » et ont leur propre marqueur.
    triggers: [
      // Borné au cadre d'ordinateur : la planche mobile ne dessine pas ce bouton-là,
      // et un avertissement permanent finit par ne plus être lu.
      { marker: 'Contribuer</span>', modal: 'A12C', frames: ['Desktop'] },
      /**
       * LE MÊME BOUTON, EN ICÔNE SEULE, sur la planche mobile : le « + » flottant.
       * La maquette ne lui écrit aucun texte, d'où `label` — et ce nom n'est PAS
       * inventé, c'est celui que le MÊME écran donne à la même action dans sa barre
       * d'onglets d'ordinateur (« Contribuer »).
       *
       * Le tracé `M12 5v14M5 12h14` est le « + » générique, donc un motif très
       * large : il est borné au cadre mobile par `frames`, où il ne figure qu'une
       * fois (compté). Sans cette borne il aurait aussi visé les « + » des autres
       * planches.
       */
      { marker: 'M12 5v14M5 12h14', modal: 'A12C', frames: ['Mobile'], label: 'Contribuer' },
    ],
    frames: [{ width: 1440, name: 'Desktop' }, fromMob(8)],
  },

  /**
   * A12C — « Contribuer à la fiche Lyon », la fenêtre de contribution de A12.
   *
   * CETTE FENÊTRE A ÉTÉ MANQUÉE PAR LE LOT PRÉCÉDENT, et la raison mérite d'être
   * écrite parce qu'elle peut se reproduire : `extractFrame` ancre son motif sur le
   * DÉBUT du style (`<div style="width:760px…`), et les trois planches d'ordinateur
   * de cette fenêtre écrivent `position:relative;width:760px…` — leur voile et leur
   * panneau se calent sur elles. Elles étaient donc invisibles à l'inventaire, sans
   * qu'aucune erreur ne le signale. D'où `stylePrefix`, déclaré ici et nulle part
   * ailleurs. La feuille mobile, elle, est un cadre ordinaire de 390 px.
   *
   * Les quatre planches sont UNE SEULE fenêtre, en deux étapes, et la maquette les
   * range sous la légende « CONTRIBUER — DEPUIS LE BOUTON DE LA BARRE D'ONGLETS OU
   * « AJOUTER MON BUDGET » » :
   *
   *   · ordinateur, étape 1 — « Contribuer à la fiche Lyon », le choix du type
   *     (Bon plan · Produit du pays · Budget réel · Témoignage) ;
   *   · ordinateur, étape 2 — « Produit du pays », le formulaire du lieu ;
   *   · ordinateur, étape 2 — « Budget réel », les lignes de dépenses ;
   *   · mobile — « Contribuer à Lyon », une feuille unique qui met le choix du type
   *     ET les champs du bon plan sur la même vue.
   *
   * CE QUE LA MAQUETTE NE DESSINE PAS, et qu'on n'invente donc pas : l'étape 2 du
   * « Bon plan » et celle du « Témoignage » sur ordinateur. Deux des quatre types
   * n'ont pas de second volet dessiné. Sur ordinateur, choisir l'un des deux laisse
   * donc l'étape 1 affichée — c'est un manque de la MAQUETTE, pas du transcodage, et
   * il est visible plutôt que masqué par un formulaire inventé.
   *
   * `modalTitle` est porté par CHAQUE CADRE : les quatre planches écrivent quatre
   * titres différents. L'`id` reste celui de l'écran (`a12c-titre`) — une seule
   * planche est rendue à la fois, donc `aria-labelledby` ne peut pas être ambigu.
   */
  {
    section: 'A12C',
    out: 'apps/web/src/screens/a12c',
    modal: true,
    frames: [
      // La feuille du bas, avec son voile `rgba(22,33,29,.5)` DESSINÉ PAR LA
      // MAQUETTE — rien n'est emprunté ici, contrairement aux fenêtres de 08 Compte.
      { section: 'A12T', width: 390, name: 'Mobile', occurrence: 0, modalTitle: 'Contribuer à Lyon' },
      {
        section: 'A12T', width: 760, name: 'Desktop', occurrence: 0,
        stylePrefix: 'position:relative;', modalTitle: 'Contribuer à la fiche Lyon',
      },
      {
        section: 'A12T', width: 760, name: 'DesktopProduit', occurrence: 1,
        stylePrefix: 'position:relative;', modalTitle: 'Produit du pays',
      },
      {
        section: 'A12T', width: 760, name: 'DesktopBudget', occurrence: 2,
        stylePrefix: 'position:relative;', modalTitle: 'Budget réel',
      },
    ],
  },

  /**
   * A12T — les onglets de la fiche ville. Variantes de A12, pas des écrans.
   *
   * La planche en compte QUATRE, et seulement TROIS sont déclarées. « Budgets réels »
   * manque exprès : c'est l'onglet que A12 dessine déjà dans son cadre complet
   * (« /villes/:slug · onglet Budgets réels »), rail et barre haute compris. Le
   * transcoder une seconde fois donnerait deux composants pour un seul contenu, dont
   * l'un sans navigation — et c'est le moins bon des deux qu'on aurait généré.
   *
   * A08T n'a pas ce doublon : sa planche ne contient aucune vue « Sujets », parce
   * que A08 la porte déjà.
   */
  {
    section: 'A12T',
    out: 'apps/web/src/screens/a12t',
    heading: 'Lyon',
    // Le même déclencheur que A12, mais sur la forme que CES planches dessinent :
    // un « + » suivi du texte. Le `</svg>` est indispensable — sans lui le marqueur
    // attraperait aussi le « Contribuer » de la colonne de contexte.
    triggers: [
      { marker: '</svg>Contribuer', modal: 'A12C', frames: ['BonsPlans', 'Produits', 'Temoignages'] },
      // Le « + » flottant des trois planches mobiles — voir la note de A12.
      {
        marker: 'M12 5v14M5 12h14',
        modal: 'A12C',
        frames: ['BonsPlansMobile', 'ProduitsMobile', 'TemoignagesMobile'],
        label: 'Contribuer',
      },
    ],
    frames: [
      { width: 1036, name: 'BonsPlans', occurrence: 0 },
      { width: 1036, name: 'Produits', occurrence: 1 },
      { width: 1036, name: 'Temoignages', occurrence: 3 },
      fromMob(12, 'MOB2', 'BonsPlansMobile'),
      fromMob(13, 'MOB2', 'ProduitsMobile'),
      fromMob(15, 'MOB2', 'TemoignagesMobile'),
    ],
  },
].map((s) => ({
  // Les déclarations du lot 1 portent déjà leur fichier, leur sortie et leur module
  // de données ; celles du lot 2 les prennent par défaut, pour que la déclaration
  // ne dise que ce qui la distingue.
  file: FILE,
  ...DATA,
  out: `apps/web/src/screens/${s.section.toLowerCase()}`,
  ...s,
}));
