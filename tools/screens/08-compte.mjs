/**
 * Les écrans de `docs/template/08 Compte.dc.html` — K01 à K10, dix sections.
 *
 * Un fichier par maquette : voir l'en-tête de `01-onboarding.mjs` pour la raison.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * CETTE MAQUETTE EST ENTIÈREMENT STATIQUE, comme 04, 05 et 07.
 *
 * Son `renderVals()` rend `{}`, elle ne contient ni `{{ … }}` ni `<sc-for>` —
 * zéro de chacun, compté. Il n'y a donc RIEN à recopier dans un `data.ts` :
 * chaque valeur affichée est écrite en clair dans le HTML et se retrouve telle
 * quelle dans le JSX transcodé. Voir l'en-tête de `05-entraide.mjs`, qui détaille
 * la conséquence, et `apps/web/src/screens/compte/data.ts`, qui la porte.
 *
 * ELLE N'ÉCRIT NON PLUS AUCUN `<h2>` : son unique `<h1>` est celui de la planche
 * de documentation, hors section. Les titres de page sont donc DÉCLARÉS ici, avec
 * leur texte visible ET leur corps — le corps n'est pas du zèle : « Contacts »
 * figure deux fois dans le cadre d'ordinateur de K05 (l'entrée du panneau
 * « MON COMPTE » d'abord, le titre de la page ensuite), et « Enregistrés »,
 * « Notifications », « Abonnement », « Sanctions » de même. Sans discriminant on
 * promouvrait l'entrée du panneau, et le défaut serait invisible : le texte
 * affiché est le même.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * ─── LES CINQ FENÊTRES DE CE MODULE ────────────────────────────────────────
 *
 * Trois écrans ouvrent une fenêtre, et c'est la MAQUETTE qui le dit, pas une
 * interprétation : chacune de ces planches porte la CROIX DE FERMETURE — le rond
 * de 40 px au tracé `M18 6 6 18M6 6l12 12` que `markClosers` reconnaît. Une
 * carte posée dans une page ne se ferme pas ; une fenêtre, si.
 *
 *   · K02 — « Ajouter Fatou aux contacts », depuis le bouton du profil ;
 *   · K06 — « Payer avec Mobile Money », ses TROIS volets (14 §4.2) ;
 *   · K08 — « Supprimer mon compte », la confirmation détaillée (T5 K08).
 *
 * Ces planches sont des CARTES NUES : la maquette ne leur dessine ni voile ni
 * positionnement, exactement comme `04 Parcours` pour ses fenêtres d'ordinateur.
 * Le transcodeur comble l'écart sans rien inventer — voir `MODAL_WINDOW_CENTRING`
 * et `MODAL_VEIL` dans `tools/dc-to-jsx.mjs`. Ici le voile ne peut PAS être
 * emprunté aux planches mobiles de la section : cette maquette n'en dessine aucun
 * (zéro `background:rgba(…)` en `inset:0` dans tout le fichier).
 */

const FILE = 'docs/template/08 Compte.dc.html';

const screen = ({ section, out, frames, ...rest }) => ({
  file: FILE,
  section,
  out: `apps/web/src/screens/${out}`,
  dataModule: '../compte/data',
  dataType: 'CompteData',
  frames,
  ...rest,
});

/** Un cadre : largeur, nom, rang de la planche parmi celles de même largeur, titre. */
const f = (width, name, occurrence = 0, title = undefined) => ({ width, name, occurrence, title });

/** Titre visible d'un cadre : le texte tel que la maquette l'écrit, et son corps. */
const t = (text, size) => ({ text, size });

/**
 * Les deux cadres d'un écran de page, ordinateur puis mobile.
 *
 * Les corps sont ceux de la maquette et ils ne varient pas : 28 px pour le titre
 * d'ordinateur, 21 px pour l'en-tête mobile. Les écrire une fois ici évite de les
 * répéter dix fois, et un titre qui sortirait de ce moule se déclare à la main.
 */
const page = (desktop, mobile) => [
  f(1440, 'Desktop', 0, t(desktop, '28px')),
  f(390, 'Mobile', 0, t(mobile, '21px')),
];

export const screens = [
  /**
   * ── K01 · /compte/profil ───────────────────────────────────────────────────
   *
   * L'en-tête mobile titre « Compte », pas « Mon profil » : la maquette range les
   * huit onglets sous un en-tête commun, et c'est la SECTION qu'elle nomme. On
   * recopie ce qu'elle écrit — c'est le même écart qu'entre « Mes demandes » et
   * « Fil d'entraide » sur H09.
   *
   * 01 §2.1 — AUCUN NUMÉRO EN CLAIR : ce cadre n'en affiche aucun, vérifié plutôt
   * que supposé. Le seul téléphone du module est masqué, sur K04.
   */
  screen({ section: 'K01', out: 'k01', frames: page('Mon profil', 'Compte') }),

  /**
   * ── K02 · /@:handle — le profil d'un autre membre ──────────────────────────
   *
   * Le titre est le NOM DU MEMBRE, comme H02 titre sa demande : la maquette n'en
   * écrit pas d'autre, et « Profil d'un membre » serait le titre inventé qui a
   * déjà coûté A01.
   *
   * L'élément qui le porte contient AUSSI la pastille « Niveau 2 » : c'est la
   * maquette qui les met dans le même `<div>`, et le `<h1>` promu les garde tous
   * les deux. Les séparer serait redessiner.
   */
  screen({
    section: 'K02',
    out: 'k02',
    /**
     * DEUX LIBELLÉS POUR UNE MÊME FENÊTRE : « Ajouter aux contacts » sur
     * ordinateur, « Ajouter » sur mobile — la maquette raccourcit le bouton
     * quand la place manque. Deux déclencheurs, donc, chacun borné à son cadre.
     */
    triggers: [
      { marker: 'Ajouter aux contacts</button>', modal: 'K02C', frames: ['Desktop'] },
      { marker: 'Ajouter</button>', modal: 'K02C', frames: ['Mobile'] },
    ],
    frames: [
      f(1440, 'Desktop', 0, t('Fatou Ndiaye', '24px')),
      f(390, 'Mobile', 0, t('Fatou Ndiaye', '20px')),
    ],
  }),
  /**
   * La feuille « Ajouter Fatou aux contacts » n'a qu'UNE planche, de 420 px : la
   * maquette ne la dessine pas en mobile. On ne lui en invente pas une — la même
   * fenêtre sert aux deux largeurs, ce que `Modal` prévoit dans son type.
   *
   * T5 K02 : « Ajouter aux contacts (avec motif) ». Le motif est le choix
   * Entraide · Parrainage · Rencontre · Réseau que la planche dessine.
   */
  screen({
    section: 'K02',
    out: 'k02contact',
    modal: true,
    modalTitle: 'Ajouter Fatou aux contacts',
    frames: [f(420, 'Ajout')],
  }),

  // ── K03 · /compte/verification ─────────────────────────────────────────────
  //
  // 01 §3 — les trois niveaux, et les quatre états KYC que la planche liste
  // (en cours, en revue, refusée, mineur). L'en-tête mobile titre la section.
  screen({ section: 'K03', out: 'k03', frames: page('Vérification et niveaux', 'Compte') }),

  /**
   * ── K04 · /compte/securite ─────────────────────────────────────────────────
   *
   * 01 §2.1, RÈGLE DURE : aucun numéro en clair. La maquette la tient par le
   * DESSIN — « +229 •• •• •• 42 », « +33 6 •• •• •• 18 » — et le transcodage la
   * conserve par construction, puisqu'il ne réécrit rien. C'est la propriété la
   * plus facile à perdre d'un module qui parle de téléphones, et c'est celle que
   * `e2e/compte.spec.ts` éprouve en premier.
   */
  screen({ section: 'K04', out: 'k04', frames: page('Téléphones et sessions', 'Compte') }),

  // ── K05 · /compte/contacts ─────────────────────────────────────────────────
  screen({ section: 'K05', out: 'k05', frames: page('Contacts', 'Contacts') }),

  /**
   * ── K06 · /compte/abonnement et /premium ───────────────────────────────────
   *
   * L'en-tête mobile titre « Premium » : la planche mobile ne montre QUE le
   * comparatif, pas le plan courant ni les factures. C'est ce que la maquette
   * dessine, et le titre le dit.
   */
  screen({
    section: 'K06',
    out: 'k06',
    triggers: [{ marker: 'Passer à Premium</button>', modal: 'K06M', all: true }],
    frames: page('Abonnement et Premium', 'Premium'),
  }),
  /**
   * ── K06 · le flux Mobile Money, TROIS VOLETS (14 §4.2) ─────────────────────
   *
   * « Flux : choix du plan → saisie du numéro → notification USSD/push de
   * l'opérateur → webhook de confirmation → activation. Timeout 5 minutes,
   * statut `PENDING` visible. » La maquette en dessine les trois volets visibles
   * — numéro, attente, succès — et chacun est une planche de 380 px à part, avec
   * sa propre croix de fermeture et son compteur « Étape N sur 3 ».
   *
   * Aucune planche mobile : la fenêtre sert aux deux largeurs.
   *
   * 14 §4.1, RÈGLE DURE : « aucune donnée de carte ne transite par le serveur ».
   * Ces trois planches ne dessinent aucun champ de carte — seulement un numéro
   * Mobile Money et le choix de l'opérateur. Vérifié, pas supposé.
   */
  screen({
    section: 'K06',
    out: 'k06momo',
    modal: true,
    modalTitle: 'Payer avec Mobile Money',
    frames: [f(380, 'Numero', 0), f(380, 'Attente', 1), f(380, 'Succes', 2)],
  }),

  // ── K07 · /compte/notifications ────────────────────────────────────────────
  screen({ section: 'K07', out: 'k07', frames: page('Notifications', 'Notifications') }),

  /**
   * ── K08 · /compte/donnees ──────────────────────────────────────────────────
   *
   * Le bouton « Supprimer » n'existe QUE sur la planche d'ordinateur : le cadre
   * mobile dessine les trois blocs mais ne donne un bouton qu'au premier
   * (« Demander »). Le déclencheur est donc borné à `Desktop`, et c'est la
   * maquette qui le décide, pas un oubli de déclaration.
   */
  screen({
    section: 'K08',
    out: 'k08',
    triggers: [{ marker: 'Supprimer</button>', modal: 'K08S', frames: ['Desktop'] }],
    frames: page('Mes données', 'Mes données'),
  }),
  /**
   * La confirmation détaillée, planche de 440 px (T5 K08 : « ce qui est supprimé,
   * ce qui est conservé sans nom, délai de 7 jours, confirmation par code SMS »).
   */
  screen({
    section: 'K08',
    out: 'k08suppression',
    modal: true,
    modalTitle: 'Supprimer mon compte',
    frames: [f(440, 'Confirmation')],
  }),

  // ── K09 · /compte/sanctions ────────────────────────────────────────────────
  //
  // La contestation est une carte DANS LA PAGE sur ordinateur (« CONTESTER ·
  // UNE SEULE FOIS »), et la maquette n'en dessine pas sur mobile. Aucun
  // déclencheur, donc : on n'ouvre pas une fenêtre par-dessus une carte qui dit
  // déjà la même chose, et on n'en invente pas une là où il n'y en a pas.
  screen({ section: 'K09', out: 'k09', frames: page('Sanctions', 'Sanctions') }),

  // ── K10 · /compte/enregistres ──────────────────────────────────────────────
  //
  // La planche de 320 px « ÉTATS · VIDE » n'est PAS un cadre d'écran : c'est une
  // note de documentation, caption comprise, posée à côté des deux cadres. La
  // transcoder produirait une page dont le titre serait le mot « ÉTATS ».
  screen({ section: 'K10', out: 'k10', frames: page('Enregistrés', 'Enregistrés') }),
];
