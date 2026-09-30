/**
 * Les écrans de `docs/template/06 Services.dc.html` — S01 à S10, dix sections.
 *
 * Un fichier par maquette : voir l'en-tête de `01-onboarding.mjs` pour la raison.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * CETTE MAQUETTE EST ENTIÈREMENT STATIQUE, comme 04, 05, 07 et 08.
 *
 * Son `renderVals()` est littéralement `renderVals() { return {}; }`, et le
 * fichier ne contient ni `{{ … }}` ni `<sc-for>` — zéro de chacun, compté. Tout
 * le contenu est écrit en clair dans le HTML et se retrouve tel quel dans le JSX
 * transcodé. Il n'y a donc RIEN à recopier dans un `data.ts` : voir l'en-tête de
 * `05-entraide.mjs`, qui détaille la conséquence, et
 * `apps/web/src/screens/services/data.ts`, qui la porte.
 *
 * ELLE N'ÉCRIT NON PLUS AUCUN `<h2>` : son unique `<h1>` est celui de la planche
 * de documentation, hors section (`grep -c '<h2' → 0`). Les titres de page sont
 * donc DÉCLARÉS ici, avec leur texte visible ET leur corps.
 *
 * LE CORPS N'EST PAS DU ZÈLE. « Annonces logement », « Mes annonces » et
 * « Mes alertes » figurent DEUX FOIS dans chaque cadre d'ordinateur : une fois
 * comme entrée du panneau de gauche (« SERVICES », « MON ESPACE »), une fois
 * comme titre de la page — et l'entrée du panneau vient en premier dans le
 * document. Sans discriminant on promouvrait l'entrée du panneau, et le défaut
 * serait invisible : le texte affiché est le même.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * ─── LES ROUTES VIENNENT DE LA MAQUETTE ────────────────────────────────────
 *
 * Chaque planche porte sa route en légende, à côté de son titre : `/services/
 * logement`, `/services/logement/:id`, `/services/logement/nouveau`, `/services/
 * emploi`, `/services/emploi/:id · /nouveau`, `/services/annuaire`, `/services/
 * annuaire/:id`, `/services/annuaire/ma-fiche`, `/services/mes-annonces ·
 * aucun compteur de vues`, `/services/alertes`. Rien n'a été déduit de la spec.
 *
 * S05 en porte DEUX (`:id` et `/nouveau`) sur une seule planche : la maquette y
 * dessine le détail de l'offre ET le formulaire de publication côte à côte. Une
 * seule route dynamique est donc créée, et `/services/emploi/nouveau` y tombe —
 * ce qui affiche exactement ce que la maquette dessine. En fabriquer deux pages
 * pour un seul dessin serait inventer un écart qu'elle n'a pas.
 *
 * ─── LES QUATRE FENÊTRES DE CE MODULE ──────────────────────────────────────
 *
 * Deux écrans en ouvrent, et c'est la MAQUETTE qui le dit :
 *
 *   · S02 — « Présentez-vous » (planche de 480 px + feuille mobile sur voile) et
 *     « Contacter Sarah » (feuille mobile sur voile), les deux états que la
 *     maquette intitule « MOBILE · L1+ » et « MOBILE · L0 » ;
 *   · S05 — « Vous quittez la plateforme » (440 px) et « Recommander un membre »
 *     (440 px), toutes deux avec la croix de fermeture `M18 6 6 18M6 6l12 12`.
 *
 * Les planches de 480 et 440 px sont des CARTES NUES : la maquette ne leur
 * dessine ni voile ni positionnement, exactement comme `04 Parcours` et
 * `08 Compte` pour leurs fenêtres d'ordinateur. Le transcodeur comble l'écart
 * sans rien inventer — voir `MODAL_WINDOW_CENTRING` dans `tools/dc-to-jsx.mjs`.
 * Pour S02 le voile est emprunté aux planches MOBILES DE LA MÊME SECTION, qui en
 * dessinent un ; S05 n'en dessine aucun, et le sien vient donc de la maquette du
 * fil — le journal du générateur le dit à chaque passage.
 *
 * ─── CE QUE LA MAQUETTE DESSINE ET QUI N'EST PAS TRANSCODÉ ─────────────────
 *
 * Deux planches de documentation restent de côté, et c'est signalé plutôt que
 * monté à moitié :
 *
 *   · S01 · « ÉTATS » — quatre cartes de 16 px de remplissage qui montrent l'état
 *     « PUBLIER · SOUS L2 » (l'explication de 10 §2.1, mot pour mot), le
 *     chargement, le vide et l'erreur. Ce ne sont pas des cadres d'écran : elles
 *     n'ont ni largeur de planche ni coquille, et les monter demanderait de
 *     décider où elles s'insèrent — ce que la maquette ne dit pas.
 *   · S08 · « APRÈS ENVOI » — une carte de 380 px, « En attente de validation ».
 *     Ni voile, ni croix, ni poignée : rien n'indique une fenêtre, et `Modal` en
 *     attend un voile et un panneau. C'est le même constat que pour la feuille de
 *     demande de H06.
 */

const FILE = 'docs/template/06 Services.dc.html';

const screen = ({ section, out, frames, ...rest }) => ({
  file: FILE,
  section,
  out: `apps/web/src/screens/${out}`,
  dataModule: '../services/data',
  dataType: 'ServicesData',
  frames,
  ...rest,
});

/** Un cadre : largeur, nom, rang de la planche parmi celles de même largeur, titre. */
const f = (width, name, occurrence = 0, title = undefined) => ({ width, name, occurrence, title });

/** Titre visible d'un cadre : le texte tel que la maquette l'écrit, et son corps. */
const t = (text, size) => ({ text, size });

export const screens = [
  /**
   * ── S01 · `/services/logement` — la liste (10 §7) ──────────────────────────
   *
   * RÈGLE DURE 10 §2.2 : le bandeau « Aucun versement avant visite ou
   * vérification. Ne payez jamais une réservation à distance. » est affiché en
   * permanence. La maquette l'écrit sur le cadre d'ordinateur ; le cadre mobile
   * le RACCOURCIT en « Aucun versement avant visite. » — c'est elle qui abrège,
   * et on ne la réécrit pas. `e2e/services.spec.ts` épingle les deux formes.
   *
   * L'encart partenaire de bas de liste est celui que 14 §17 autorise : « en pied
   * de la section Logement », et nulle part ailleurs. Le test le vérifie dans les
   * deux sens — présent ici, absent des neuf autres écrans.
   */
  screen({
    section: 'S01',
    out: 's01',
    frames: [
      f(1440, 'Desktop', 0, t('Annonces logement', '28px')),
      f(390, 'Mobile', 0, t('Services', '21px')),
    ],
  }),

  /**
   * ── S02 · `/services/logement/:id` — l'annonce (10 §2.3) ───────────────────
   *
   * Le titre est celui de l'ANNONCE — « Studio meublé Lyon 7e » — comme H02 titre
   * sa demande : la maquette n'en écrit pas d'autre, et « Annonce » serait le
   * titre inventé qui a déjà coûté A01.
   *
   * « Contacter » ouvre la feuille « Présentez-vous », qui est l'état L1+.
   * L'état L0 — « Contacter demande une identité vérifiée » — est dessiné DEUX
   * FOIS par la maquette : en feuille mobile sur voile, et EN PLACE dans la
   * colonne de contexte du cadre d'ordinateur (planche « ÉTAT L0 · APRÈS
   * “CONTACTER” »). La feuille est donc déclarée `mobileOnly` côté page : sur
   * grand écran, cet état a une autre forme, déjà dessinée dans l'écran.
   */
  screen({
    section: 'S02',
    out: 's02',
    triggers: [
      { marker: '</svg>Contacter</button>', modal: 'S02C', frames: ['Desktop'] },
      { marker: '>Contacter</button>', modal: 'S02C', frames: ['Mobile'] },
    ],
    frames: [
      f(1440, 'Desktop', 0, t('Studio meublé Lyon 7e', '26px')),
      f(390, 'Mobile', 0, t('Studio meublé Lyon 7e', '19px')),
    ],
  }),
  /**
   * La feuille « Présentez-vous » a DEUX planches : une carte nue de 480 px pour
   * l'ordinateur et une feuille mobile posée sur un voile. Les deux sont
   * transcodées, `Modal` choisit selon la largeur.
   */
  screen({
    section: 'S02',
    out: 's02contact',
    modal: true,
    modalTitle: 'Présentez-vous',
    // Le nom du cadre porte la VARIANTE, pas seulement la largeur : sans cela ce
    // composant s'appellerait `S02Mobile`, comme celui de la page.
    frames: [f(480, 'DesktopContact'), f(390, 'MobileContact', 1)],
  }),
  /**
   * La feuille de l'état L0 n'a qu'UNE planche, mobile. On ne lui en invente pas
   * une pour l'ordinateur : la maquette y dessine cet état dans la colonne de
   * contexte de l'écran lui-même.
   */
  screen({
    section: 'S02',
    out: 's02verification',
    modal: true,
    modalTitle: 'Contacter Sarah',
    frames: [f(390, 'MobileVerification', 2)],
  }),

  /**
   * ── S03 · `/services/logement/nouveau` — publier (10 §2.1) ─────────────────
   *
   * L'APERÇU DU SCORE DE RISQUE N'EST PAS AFFICHÉ, et c'est 10 §7 qui l'exige
   * (« aperçu du score de risque non affiché (interne) »). La maquette s'y tient :
   * aucun chiffre de risque nulle part, seulement « Votre annonce est en
   * vérification » dans la colonne APRÈS ENVOI. Vérifié plutôt que supposé.
   *
   * Le corps du titre mobile est 16 px, pas 21 : cet écran n'a pas l'en-tête de
   * section mais une barre à croix de fermeture, plus basse.
   */
  screen({
    section: 'S03',
    out: 's03',
    frames: [
      f(1440, 'Desktop', 0, t('Publier une annonce', '28px')),
      f(390, 'Mobile', 0, t('Publier une annonce', '16px')),
    ],
  }),

  /**
   * ── S04 · `/services/emploi` — offres et profils (10 §3) ───────────────────
   *
   * 10 §3.1 : la pastille « Sponsorisée » est TOUJOURS VISIBLE. La maquette la
   * dessine sur les deux cadres, en tête de liste — et une seule fois, ce qui
   * respecte aussi la borne de deux emplacements de tête.
   */
  screen({
    section: 'S04',
    out: 's04',
    frames: [
      f(1440, 'Desktop', 0, t('Bourses et emploi', '28px')),
      f(390, 'Mobile', 0, t('Services', '21px')),
    ],
  }),

  /**
   * ── S05 · `/services/emploi/:id` — l'offre et sa publication ───────────────
   *
   * Le titre est celui de l'OFFRE. Le cadre d'ordinateur porte aussi le
   * formulaire « PUBLIER UNE OFFRE » dans sa colonne de droite : c'est la même
   * planche, et la maquette lui donne les deux routes.
   *
   * Le bouton d'alerte — un drapeau SANS AUCUN TEXTE — est le seul bouton muet de
   * toute la maquette. Son nom est recopié de la maquette elle-même, qui écrit
   * « Signaler » à côté du même tracé sur S02 et S07 (voir `ICON_BUTTON_NAMES`).
   */
  screen({
    section: 'S05',
    out: 's05',
    triggers: [
      { marker: 'Postuler sur le site</button>', modal: 'S05L', frames: ['Desktop'] },
      { marker: 'Recommander un membre</button>', modal: 'S05R', frames: ['Desktop'] },
      { marker: '>Postuler</button>', modal: 'S05L', frames: ['Mobile'] },
      { marker: '>Recommander</button>', modal: 'S05R', frames: ['Mobile'] },
    ],
    frames: [
      f(1440, 'Desktop', 0, t('Comptable junior', '26px')),
      f(390, 'Mobile', 0, t('Comptable junior', '21px')),
    ],
  }),
  /**
   * « Vous quittez la plateforme » — l'interstitiel du lien externe. Une seule
   * planche de 440 px : la même fenêtre sert aux deux largeurs, ce que `Modal`
   * prévoit dans son type.
   */
  screen({
    section: 'S05',
    out: 's05lien',
    modal: true,
    modalTitle: 'Vous quittez la plateforme',
    frames: [f(440, 'LienExterne', 0)],
  }),
  /** « Recommander un membre » (10 §3.3). Une seule planche, de 440 px aussi. */
  screen({
    section: 'S05',
    out: 's05recommander',
    modal: true,
    modalTitle: 'Recommander un membre',
    frames: [f(440, 'Recommander', 1)],
  }),

  /**
   * ── S06 · `/services/annuaire` — la liste des pros (10 §4.2) ───────────────
   *
   * « Fiche mise en avant » est écrite en toutes lettres au-dessus des fiches
   * payantes, DEUX fois au plus sur le cadre d'ordinateur — exactement la borne
   * de §4.2. Le test l'épingle dans les deux sens.
   */
  screen({
    section: 'S06',
    out: 's06',
    frames: [
      f(1440, 'Desktop', 0, t('Annuaire professionnel', '28px')),
      f(390, 'Mobile', 0, t('Services', '21px')),
    ],
  }),

  /**
   * ── S07 · `/services/annuaire/:id` — la fiche pro (10 §4.4) ────────────────
   *
   * Le titre est le NOM DU PRO. L'élément qui le porte contient AUSSI la pastille
   * « Pro » : c'est la maquette qui les met dans le même bloc, et le `<h1>` promu
   * les garde tous les deux. Les séparer serait redessiner.
   *
   * 10 §4.1, règle dure : le téléphone n'est JAMAIS affiché sur une fiche pro.
   * La maquette s'y tient sur les deux cadres — aucun numéro, et la méthode de
   * contact est « Messagerie de la plateforme » sur S08.
   */
  screen({
    section: 'S07',
    out: 's07',
    frames: [
      f(1440, 'Desktop', 0, t('Me Mariam Bah', '24px')),
      f(390, 'Mobile', 0, t('Me Mariam Bah', '18px')),
    ],
  }),

  /**
   * ── S08 · `/services/annuaire/ma-fiche` — créer sa fiche (10 §4.1) ─────────
   *
   * L'ordinateur titre « Créer ma fiche pro », le mobile « Ma fiche pro » : c'est
   * la maquette qui abrège son en-tête, comme H09 dit « Fil d'entraide » là où
   * l'ordinateur dit « Mes demandes ». Un titre uniformisé aurait gommé l'écart.
   */
  screen({
    section: 'S08',
    out: 's08',
    frames: [
      f(1440, 'Desktop', 0, t('Créer ma fiche pro', '28px')),
      f(390, 'Mobile', 0, t('Ma fiche pro', '16px')),
    ],
  }),

  /**
   * ── S09 · `/services/mes-annonces` (10 §7) ─────────────────────────────────
   *
   * RÈGLE DURE 00 §49 : « Aucun compteur de vues n'est exposé à personne, sur
   * aucun contenu. » `T5 S09` demande pourtant « compteur de vues et contacts » —
   * et la maquette TRANCHE pour la règle dure, en écrivant dans sa propre légende
   * de route : « /services/mes-annonces · aucun compteur de vues ». Elle
   * n'affiche que « 6 contacts ». Le test fige cet arbitrage.
   */
  screen({
    section: 'S09',
    out: 's09',
    frames: [
      f(1440, 'Desktop', 0, t('Mes annonces', '28px')),
      f(390, 'Mobile', 0, t('Mes annonces', '21px')),
    ],
  }),

  /**
   * ── S10 · `/services/alertes` — les alertes Premium (10 §2.4) ──────────────
   *
   * Les alertes SONT réservées à Premium (§2.4), et la maquette le dit sans
   * fermer le reste : « Réservées à Premium, le reste des Services reste
   * gratuit. » C'est le seul écran de ce module qui porte une mention de plan
   * dans son contenu — la barre latérale, elle, en porte une sur les dix.
   */
  screen({
    section: 'S10',
    out: 's10',
    frames: [
      f(1440, 'Desktop', 0, t('Mes alertes', '28px')),
      f(390, 'Mobile', 0, t('Mes alertes', '21px')),
    ],
  }),
];
