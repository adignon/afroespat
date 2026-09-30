/**
 * Les écrans de `docs/template/04 Parcours.dc.html` — J01 à J11, quinze sections.
 *
 * Un fichier par maquette : voir l'en-tête de `01-onboarding.mjs` pour la raison.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * CETTE MAQUETTE EST ENTIÈREMENT STATIQUE, et c'est la chose à savoir avant de
 * lire le reste.
 *
 * `01 Accès et Onboarding` porte 120 interpolations `{{ … }}` et 54 `<sc-for>` ;
 * `03 Accueil v2` en porte 767 et 328. `04 Parcours` en porte **zéro**, et son
 * `renderVals()` rend `{}`. Il n'y a donc RIEN à recopier dans un `data.ts` : la
 * maquette n'y calcule aucune valeur d'affichage, elle écrit chaque valeur en
 * clair dans le HTML.
 *
 * Conséquence directe, et elle est structurante : les composants produits ne
 * consomment aucune donnée (`_props`), et chaque ÉTAT du produit est une PLANCHE
 * distincte — « aucun parcours », « un parcours abouti », « plan atteint »,
 * « variante Régulariser », « sélecteur ouvert ». Le rôle de la page n'est donc
 * pas d'alimenter un composant, c'est de CHOISIR la planche qui correspond à
 * l'état. C'est ce que fait `apps/web/src/screens/parcours/data.ts`, qui nomme
 * ces états au lieu d'inventer des valeurs que la maquette ne donne pas.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Les noms de cadre ne sont pas décoratifs : ils deviennent le nom du fichier
 * (`desktop.generated.tsx`) et le nom du composant (`J01Desktop`). Ils reprennent
 * donc le libellé que la maquette écrit AU-DESSUS de chaque planche — « MOBILE ·
 * MODIFIER LES ÉTAPES » devient `MobileEdition` — pour qu'on puisse toujours
 * remonter du composant à la planche.
 */

/** Les quinze sections ; `docs/specs/T5-pages-et-prompts.md` §5 donne les routes. */
const FILE = 'docs/template/04 Parcours.dc.html';

const screen = ({ section, out, frames, ...rest }) => ({
  file: FILE,
  section,
  out: `apps/web/src/screens/${out}`,
  dataModule: '../parcours/data',
  dataType: 'ParcoursData',
  frames,
  ...rest,
});

/**
 * Un cadre : largeur, nom, rang de la planche parmi celles de même largeur, et
 * TITRE DE LA PAGE.
 *
 * Le titre est déclaré avec son CORPS, et ce n'est pas du zèle : « Checklist de
 * documents » figure deux fois dans le cadre d'ordinateur de J06 — l'entrée du
 * panneau de gauche d'abord, le titre de la page ensuite. Le corps est ce qui
 * les distingue, et si la maquette le change, le générateur le DIT au lieu de
 * promouvoir l'entrée du panneau en titre de page.
 */
const f = (width, name, occurrence = 0, title = undefined) => ({ width, name, occurrence, title });

/** Titre visible d'un cadre : le texte tel que la maquette l'écrit, et son corps. */
const t = (text, size) => ({ text, size });

export const screens = [
  // ── J01 · /parcours/:id — vue d'ensemble ───────────────────────────────────
  //
  // Trois planches : la page, son équivalent mobile, et le mode « Modifier les
  // étapes » du mobile — qui n'est pas une modale (aucun voile) mais un ÉTAT de
  // l'écran, avec sa propre croix de sortie et son bouton « Terminer ».
  screen({
    section: 'J01',
    out: 'j01',
    /**
     * TROIS FENÊTRES S'OUVRENT DEPUIS CET ÉCRAN, et aucune depuis le cadre mobile
     * sauf la première : la maquette ne dessine « Inviter » et « Partager » que
     * dans la colonne de droite, qui n'existe pas sur téléphone. Le générateur
     * le dit à chaque cadre — c'est une information exacte, pas du bruit.
     */
    triggers: [
      // Pas sur `MobileEdition` : en mode « Modifier les étapes », la maquette
      // ne montre que « Terminer ». On ne réordonne pas et on ne bute pas en
      // même temps.
      { marker: 'Je suis bloqué·e', modal: 'J03', all: true, frames: ['Desktop', 'Mobile'] },
      // §3.6 — « Partager un jalon (si une étape majeure non partagée) », T5 J01.
      { marker: 'Partager</button>', modal: 'J04', frames: ['Desktop'] },
      { marker: '</svg>Inviter', modal: 'J05I', frames: ['Desktop'] },
    ],
    frames: [
      f(1440, 'Desktop', 0, t('Mes études à Lyon', '30px')),
      f(390, 'Mobile', 0, t('Mes études à Lyon', '22px')),
      f(390, 'MobileEdition', 1, t('Modifier les étapes', '16px')),
    ],
  }),

  /**
   * ── J01M · le sélecteur de parcours ────────────────────────────────────────
   *
   * DEUX FORMES POUR UNE MÊME FONCTION, et la maquette les dessine différemment :
   * sur ordinateur le sélecteur s'ouvre EN PLACE dans la carte du panneau (la
   * planche est une page complète, sélecteur déplié), sur mobile il s'ouvre en
   * FEUILLE DU BAS par-dessus l'écran (voile + panneau).
   *
   * Deux déclarations, donc, et non une : le drapeau `modal` vaut pour tout un
   * écran. La page rend la première comme page et la seconde comme modale — ce
   * qui est exactement ce que la maquette montre.
   */
  screen({
    section: 'J01M',
    out: 'j01m',
    triggers: [{ marker: 'Je suis bloqué·e', modal: 'J03', all: true }],
    frames: [f(1440, 'Desktop', 0, t('Mes études à Lyon', '30px'))],
  }),
  screen({
    section: 'J01M',
    out: 'j01mfeuille',
    modal: true,
    // Le titre VISIBLE de la feuille, compteur compris — c'est lui qui donnera
    // son nom accessible à la boîte de dialogue.
    modalTitle: 'Mes parcours · 3',
    /**
     * `requires` — LA PLANCHE, PAS LA COLONNE QUI LA PORTE.
     *
     * J01M range son téléphone dans une colonne de mise en page qui déclare la MÊME
     * largeur (`display:flex;flex-direction:column;gap:10px;width:390px`) et qui
     * contient l'étiquette de planche « MOBILE · FEUILLE “MES PARCOURS” » en plus du
     * téléphone. C'est le seul endroit des dix maquettes où cela arrive — mesuré sur
     * les 248 sélections déclarées.
     *
     * `height:844px` désigne le téléphone par CE QU'IL EST. Un `occurrence: 1`
     * l'aurait désigné par son rang, ce qui ne dit rien et se décale dès qu'une
     * planche est insérée avant.
     */
    frames: [{ ...f(390, 'Mobile'), requires: 'height:844px' }],
  }),

  // ── J01E · les deux états sans parcours actif ──────────────────────────────
  //
  // « Aucun parcours » et « un parcours abouti, aucun actif ». Deux paires
  // complètes, dans cet ordre dans la maquette.
  screen({
    section: 'J01E',
    out: 'j01e',
    /**
     * AUCUN DÉCLENCHEUR, et c'est le générateur qui l'a montré.
     *
     * J'avais déclaré « Je suis bloqué·e » sur la planche « parcours abouti »,
     * en supposant qu'elle portait la carte du panneau comme les autres. Le
     * journal a répondu « déclencheur introuvable » : la maquette REMPLACE cette
     * carte par un récapitulatif — durée totale, étapes, aides reçues. C'est
     * juste, d'ailleurs : sans parcours actif, il n'y a aucune étape où l'on bute.
     */
    frames: [
      f(1440, 'DesktopVide', 0, t('Commencez votre parcours', '28px')),
      // Le cadre mobile titre la SECTION, « Parcours », et garde « Commencez votre
      // parcours » en sous-titre de sa carte. On recopie ce que la maquette écrit.
      f(390, 'MobileVide', 0, t('Parcours', '22px')),
      f(1440, 'DesktopAbouti', 1, t('Mes études à Lyon', '30px')),
      f(390, 'MobileAbouti', 1, t('Mes études à Lyon', '22px')),
    ],
  }),

  // ── J01S · /parcours/:id/etapes/:etape — l'étape en cours ──────────────────
  screen({
    section: 'J01S',
    out: 'j01s',
    /**
     * §3.6 : « à `step_completed` … proposition de partage » sur une étape
     * majeure. Marquer l'étape franchie OUVRE donc le partage de jalon — c'est
     * la règle du dossier, pas une invention de l'écran. La maquette nomme le
     * bouton « Marquer comme franchie » sur ordinateur et « Franchie » sur
     * mobile : deux déclencheurs pour une seule fenêtre.
     */
    triggers: [
      { marker: 'Je suis bloqué·e', modal: 'J03', all: true },
      { marker: '</svg>Marquer comme franchie', modal: 'J04', frames: ['Desktop'] },
      { marker: 'Franchie</button>', modal: 'J04', frames: ['Mobile'] },
    ],
    frames: [
      f(1440, 'Desktop', 0, t('Trouver un logement pérenne', '28px')),
      f(390, 'Mobile', 0, t('Trouver un logement pérenne', '21px')),
    ],
  }),

  // ── J01D · /parcours/:id/discussion ────────────────────────────────────────
  screen({
    section: 'J01D',
    out: 'j01d',
    /**
     * « Je suis bloqué·e » est dessiné DEUX FOIS dans le cadre d'ordinateur —
     * carte du panneau et carte de l'étape en cours — d'où `all`. Le cadre
     * mobile n'en porte qu'un, et le journal du générateur donne le compte.
     */
    triggers: [
      // La carte du panneau — donc son bouton — n'existe que sur la planche
      // d'ordinateur : sur mobile, le panneau devient une barre d'onglets.
      { marker: 'Je suis bloqué·e', modal: 'J03', all: true, frames: ['Desktop'] },
    ],
    frames: [
      f(1440, 'Desktop', 0, t('Discussion du parcours', '18px')),
      f(390, 'Mobile', 0, t('Discussion · Mes études', '16px')),
    ],
  }),

  // ── J02 · /parcours/nouveau ────────────────────────────────────────────────
  //
  // Le mobile a trois planches : le choix de type, la variante « Régulariser »
  // (§3.1 et T5 — trois sous-situations), et l'état « plan atteint » que §3.1
  // impose (`PLAN_LIMIT_REACHED`) sans bloquer la lecture.
  screen({
    section: 'J02',
    out: 'j02',
    /**
     * « Je suis bloqué·e » est dessiné DEUX FOIS dans le cadre d'ordinateur —
     * carte du panneau et carte de l'étape en cours — d'où `all`. Le cadre
     * mobile n'en porte qu'un, et le journal du générateur donne le compte.
     */
    triggers: [
      // La carte du panneau — donc son bouton — n'existe que sur la planche
      // d'ordinateur : sur mobile, le panneau devient une barre d'onglets.
      { marker: 'Je suis bloqué·e', modal: 'J03', all: true, frames: ['Desktop'] },
    ],
    frames: [
      f(1440, 'Desktop', 0, t('Créer un parcours', '26px')),
      f(390, 'Mobile', 0, t('Créer un parcours', '16px')),
      f(390, 'MobileRegulariser', 1, t('Régulariser ma situation', '16px')),
      f(390, 'MobilePlanAtteint', 2, t('Créer un parcours', '16px')),
    ],
  }),

  /**
   * ── J03 · « Je suis bloqué·e » — TROIS VOLETS ──────────────────────────────
   *
   * 03 §3.5 : « flux en quatre temps, sans jamais publier automatiquement ».
   * La maquette en dessine les trois volets visibles — message, portée, aperçu —
   * et chacun est une planche à part, sur les deux formes. Six cadres donc, et
   * c'est la page qui les enchaîne : le volet est un ÉTAT, pas une donnée.
   *
   * ⚠ Les planches d'ORDINATEUR de J03 et J04 sont des CARTES NUES de 540 px :
   * la maquette ne leur dessine ni voile ni positionnement, alors que son propre
   * texte annonce « modale sur ordinateur, feuille du bas sur mobile ». Le
   * transcodeur comble l'écart sans rien inventer — voir `MODAL_WINDOW_CENTRING`
   * dans `tools/dc-to-jsx.mjs`.
   */
  screen({
    section: 'J03',
    out: 'j03',
    modal: true,
    modalTitle: 'Je suis bloqué·e',
    frames: [
      f(540, 'Desktop1'),
      f(390, 'Mobile1'),
      f(540, 'Desktop2', 1),
      f(390, 'Mobile2', 1),
      f(540, 'Desktop3', 2),
      f(390, 'Mobile3', 2),
    ],
  }),

  // ── J04 · « Partager un jalon » ────────────────────────────────────────────
  //
  // §3.6 : champ de texte VIDE, jamais de texte pré-rédigé. La maquette le
  // respecte — « Racontez-la avec vos mots… » est un indice, pas une valeur.
  screen({
    section: 'J04',
    out: 'j04',
    modal: true,
    modalTitle: 'Partager un jalon',
    frames: [f(540, 'Desktop'), f(390, 'Mobile')],
  }),

  // ── J05 · /parcours/:id/equipe ─────────────────────────────────────────────
  screen({
    section: 'J05',
    out: 'j05',
    /**
     * Sur ordinateur le bouton « Inviter » porte son texte ; sur mobile la
     * maquette ne dessine qu'un « + » dans l'en-tête, SANS texte. Le déclencheur
     * mobile vise donc le TRACÉ de l'icône — c'est ce que la maquette écrit, et
     * c'est unique dans ce cadre (le cadre d'ordinateur en compte trois, d'où
     * deux marqueurs distincts plutôt qu'un seul avec `all`).
     */
    triggers: [
      { marker: 'Je suis bloqué·e', modal: 'J03', all: true, frames: ['Desktop'] },
      { marker: '</svg>Inviter', modal: 'J05I', frames: ['Desktop'] },
      /**
       * Le « + » n'a AUCUN TEXTE : le bouton créé autour de lui serait muet au
       * lecteur d'écran, et axe-core l'a relevé en `critical` — mais seulement à
       * la largeur mobile, où ce contrôle existe. Le nom est recopié du titre de
       * la feuille qu'il ouvre, donc rien n'est inventé.
       */
      {
        marker: 'M12 5v14M5 12h14',
        modal: 'J05I',
        frames: ['Mobile'],
        label: "Inviter dans l'équipe",
      },
    ],
    frames: [f(1440, 'Desktop', 0, t('Équipe', '24px')), f(390, 'Mobile', 0, t('Équipe', '16px'))],
  }),
  /**
   * La feuille « Inviter dans l'équipe » n'a PAS de planche d'ordinateur : la
   * maquette ne la dessine qu'en mobile. On ne lui en invente pas une — la même
   * feuille sert aux deux largeurs, et `Modal` le dit dans son type.
   */
  screen({
    section: 'J05',
    out: 'j05invitation',
    modal: true,
    modalTitle: "Inviter dans l'équipe",
    // Le nom du cadre porte la VARIANTE, pas seulement la largeur : sans cela ce
    // composant s'appellerait `J05Mobile`, comme celui de la page Équipe, et
    // toute page qui emploie les deux devrait en renommer un à l'import.
    frames: [f(390, 'MobileInvitation', 1)],
  }),

  // ── J06 · /parcours/:id/documents ──────────────────────────────────────────
  //
  // §3.3 : aucun fichier en V1 — « Cochez ce que vous avez réuni. Les documents
  // restent chez vous. » La maquette ne dessine aucun dépôt de fichier.
  screen({
    section: 'J06',
    out: 'j06',
    /**
     * « Je suis bloqué·e » est dessiné DEUX FOIS dans le cadre d'ordinateur —
     * carte du panneau et carte de l'étape en cours — d'où `all`. Le cadre
     * mobile n'en porte qu'un, et le journal du générateur donne le compte.
     */
    triggers: [
      // La carte du panneau — donc son bouton — n'existe que sur la planche
      // d'ordinateur : sur mobile, le panneau devient une barre d'onglets.
      { marker: 'Je suis bloqué·e', modal: 'J03', all: true, frames: ['Desktop'] },
    ],
    frames: [
      f(1440, 'Desktop', 0, t('Checklist de documents', '26px')),
      f(390, 'Mobile', 0, t('Checklist de documents', '16px')),
    ],
  }),

  // ── J07 · /parcours/:id/historique ─────────────────────────────────────────
  screen({
    section: 'J07',
    out: 'j07',
    /**
     * L'export est réservé à Premium (T5 J07). La maquette dessine « Exporter en
     * PDF » sur ordinateur et, sur mobile, un encart « Export PDF réservé à
     * Premium. » avec un lien « Découvrir » — deux chemins vers la même feuille.
     */
    triggers: [
      { marker: 'Je suis bloqué·e', modal: 'J03', all: true, frames: ['Desktop'] },
      { marker: '</svg>Exporter en PDF', modal: 'J07X', frames: ['Desktop'] },
      { marker: 'Découvrir<', modal: 'J07X', frames: ['Mobile'] },
    ],
    frames: [f(1440, 'Desktop', 0, t('Historique', '24px')), f(390, 'Mobile', 0, t('Historique', '16px'))],
  }),
  screen({
    section: 'J07',
    out: 'j07export',
    modal: true,
    modalTitle: 'Exporter mon parcours',
    frames: [f(390, 'MobileExport', 1)],
  }),

  // ── J08 · /parcours/:id/reglages ───────────────────────────────────────────
  screen({
    section: 'J08',
    out: 'j08',
    /**
     * La confirmation d'arrêt est une FEUILLE sur mobile et une carte DANS LA
     * PAGE sur ordinateur : la planche de 1440 px dessine « Arrêter « Mes études
     * à Lyon » ? » en ligne, avec ses boutons Garder et Arrêter. Le déclencheur
     * n'existe donc que sur mobile, et c'est voulu — on n'ouvre pas une fenêtre
     * par-dessus une carte qui dit déjà la même chose.
     */
    triggers: [
      { marker: 'Je suis bloqué·e', modal: 'J03', all: true, frames: ['Desktop'] },
      { marker: 'Arrêter ce parcours', modal: 'J08A', frames: ['Mobile'] },
    ],
    frames: [
      f(1440, 'Desktop', 0, t('Réglages du parcours', '24px')),
      f(390, 'Mobile', 0, t('Réglages', '16px')),
    ],
  }),
  screen({
    section: 'J08',
    out: 'j08arret',
    modal: true,
    // §3.9 : « confirmation sans vocabulaire d'échec ». Le titre de la maquette
    // s'y tient, et il est recopié tel quel — guillemets français compris.
    modalTitle: 'Arrêter « Mes études à Lyon » ?',
    frames: [f(390, 'MobileArret', 1)],
  }),

  /**
   * ── J09 · /parcours/publics et /parcours/publics/:id ───────────────────────
   *
   * La maquette donne UNE planche d'ordinateur (la liste) et DEUX planches
   * mobiles : la liste, puis la vue d'un parcours public. Cette seconde vue n'a
   * donc pas de forme d'ordinateur dessinée ; la page le dit et n'en invente pas.
   */
  screen({
    section: 'J09',
    out: 'j09',
    /**
     * « Je suis bloqué·e » est dessiné DEUX FOIS dans le cadre d'ordinateur —
     * carte du panneau et carte de l'étape en cours — d'où `all`. Le cadre
     * mobile n'en porte qu'un, et le journal du générateur donne le compte.
     */
    triggers: [
      // La carte du panneau — donc son bouton — n'existe que sur la planche
      // d'ordinateur : sur mobile, le panneau devient une barre d'onglets.
      { marker: 'Je suis bloqué·e', modal: 'J03', all: true, frames: ['Desktop'] },
    ],
    frames: [
      f(1440, 'Desktop', 0, t('Parcours publics', '26px')),
      f(390, 'Mobile', 0, t('Parcours publics', '16px')),
      f(390, 'MobileFiche', 1, t('Parcours de Fatou', '16px')),
    ],
  }),

  // ── J10 · /parcours/:id/abouti ─────────────────────────────────────────────
  //
  // « Plein écran calme » : cette planche d'ordinateur n'a ni rail ni `<main>`,
  // contrairement aux autres. Le générateur pose donc le repère lui-même.
  screen({
    section: 'J10',
    out: 'j10',
    frames: [
      f(1440, 'Desktop', 0, t('Vous y êtes arrivé·e !', '38px')),
      f(390, 'Mobile', 0, t('Vous y êtes arrivé·e !', '28px')),
    ],
  }),

  // ── J11 · /parcours — mes parcours ─────────────────────────────────────────
  screen({
    section: 'J11',
    out: 'j11',
    /**
     * « Je suis bloqué·e » est dessiné DEUX FOIS dans le cadre d'ordinateur —
     * carte du panneau et carte de l'étape en cours — d'où `all`. Le cadre
     * mobile n'en porte qu'un, et le journal du générateur donne le compte.
     */
    triggers: [
      // La carte du panneau — donc son bouton — n'existe que sur la planche
      // d'ordinateur : sur mobile, le panneau devient une barre d'onglets.
      { marker: 'Je suis bloqué·e', modal: 'J03', all: true, frames: ['Desktop'] },
    ],
    frames: [
      f(1440, 'Desktop', 0, t('Mes parcours', '26px')),
      f(390, 'Mobile', 0, t('Mes parcours', '21px')),
      f(390, 'MobileVide', 1, t('Mes parcours', '21px')),
    ],
  }),
];
