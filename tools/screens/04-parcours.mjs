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
 * LA PRISE SE DÉCLARE DONC ICI, sous la clé `donnees`, exactement comme
 * `tools/screens/08-compte.mjs` l'a fait pour les vingt-cinq cadres du module
 * Compte. On ne réécrit pas la maquette (le porteur l'a interdit) et on ne
 * retouche pas les `*.generated.tsx` (la régénération suivante les efface) :
 * `tools/generate-screens.mjs` porte le raisonnement complet et les quatre
 * contrôles. Ce qu'il faut en savoir pour lire ce fichier :
 *
 *   · `noeud`   est le littéral de la maquette, VERBATIM, qui devient une donnée ;
 *   · `fois`    dit combien de fois la maquette l'écrit DANS CE CADRE, et la
 *               génération ÉCHOUE si le compte ne tombe pas juste ;
 *   · `devient` est la réécriture dans le dialecte, et RIEN DE PLUS : ce qui reste
 *               de `devient` quand on en ôte les interpolations doit être dessiné
 *               dans `noeud`, dans l'ordre ;
 *   · `motifs`  nomme les fragments que `devient` réemploie mais que `noeud` ne
 *               dessine pas À CET ENDROIT — c'est-à-dire un remontage, qui doit se
 *               DIRE ;
 *   · `why`     est la phrase du journal : une donnée liée n'est jamais silencieuse.
 *
 * Les valeurs vivent dans `apps/web/src/screens/parcours/data.ts`, et leurs appels
 * dans `apps/web/src/screens/parcours/appels.ts`. Le JSX transcodé n'a pas bougé
 * d'une virgule.
 *
 * ── CE QUE CE LOT A BRANCHÉ, ET CE QU'IL N'A PAS BRANCHÉ ────────────────────
 *
 * J02, J03 et J04 étaient DÉJÀ branchés par leurs `onClick` (création d'un
 * parcours, brouillon de blocage, refus de partage) : ils ne sont pas touchés, et
 * leur `dataType` reste `ParcoursData`.
 *
 * Vingt-huit des trente-deux cadres de J01 et J05 à J11 lisent désormais leurs
 * données. Les quatre qui ne lisent rien ne le peuvent pas, et c'est DIT :
 *
 *   · `J01 MobileEdition` — la planche montre un GLISSEMENT EN COURS
 *     (`transform:rotate(-1.2deg) translateX(6px)` sur la carte saisie). C'est un
 *     état d'interaction, pas une donnée, et `PUT /journeys/:id/steps/order` n'a
 *     aucune prise dans le cadre transcodé. Lier les six lignes demanderait de
 *     choisir laquelle est « saisie », donc d'inventer l'interaction ;
 *   · `J05 MobileInvitation` — ses deux suggestions sont des CONTACTS
 *     (`GET /me/connections`), pas des membres de parcours, et les trois libellés
 *     de rôle sont du texte de règle. Aucune route de `journeys` ne les porte ;
 *   · `J07 MobileExport` — trois phrases de RÈGLE sur l'export Premium (T5 J07).
 *     La planche n'affiche aucune donnée du parcours ;
 *   · `J11 MobileVide` — l'état « aucun parcours ». Il n'y a rien à lire ; c'est le
 *     propre d'un état vide.
 *
 * Les colonnes de DROITE des planches d'ordinateur ne sont pas liées non plus, et
 * pour une raison nette : « RAPPELS » vient de l'agenda, « 12 annonces à Lyon » et
 * « Partenaire » des services, « Guide : obtenir Visale » des guides, et les
 * pastilles de non-lu de la messagerie. Aucune route de `journeys` ne les rend.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Les noms de cadre ne sont pas décoratifs : ils deviennent le nom du fichier
 * (`desktop.generated.tsx`) et le nom du composant (`J01Desktop`). Ils reprennent
 * donc le libellé que la maquette écrit AU-DESSUS de chaque planche — « MOBILE ·
 * MODIFIER LES ÉTAPES » devient `MobileEdition` — pour qu'on puisse toujours
 * remonter du composant à la planche.
 */

/** Les quinze sections ; `docs/specs/T5-pages-et-prompts.md` §5 donne les routes. */
import { cadresDuRail, railLitteral } from '../squelette-membre.mjs';
import { barreBasse } from '../squelette-membre.mjs';

const FILE = 'docs/template/04 Parcours.dc.html';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LES SEPT ENTRÉES DU PANNEAU « MON PARCOURS » — ET POURQUOI CE SONT DES      ║
 * ║ BOUTONS ET NON DES LIENS                                                   ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * La maquette dessine sept lignes de 44 px — Vue d'ensemble, Étape en cours,
 * Discussion, Équipe, Checklist de documents, Historique, Réglages — en `<span>`.
 * Aucun `href="#"`, donc le récapitulatif « ── NAVIGATION ── » n'en voit AUCUNE,
 * et c'est pourtant la sous-navigation du parcours : ce que le porteur appelle
 * « les sous liens ».
 *
 * ── LA MAQUETTE DONNE ELLE-MÊME LA CORRESPONDANCE, ET ELLE A ÉTÉ MESURÉE ────
 *
 * Elle PEINT l'entrée qui désigne la planche, cadre par cadre. Relevé sur les
 * onze cadres d'ordinateur qui dessinent ce panneau (`background:#E3F0EB`) :
 *
 *     J01  → Vue d’ensemble            J06  → Checklist de documents
 *     J01S → Étape en cours            J07  → Historique
 *     J01D → Discussion                J08  → Réglages
 *     J05  → Équipe                    J01M → Vue d’ensemble
 *     J02, J09, J11 → AUCUNE entrée peinte
 *
 * Les sept destinations ne sont donc PAS lues dans le libellé : elles sont la
 * route de la planche que la maquette désigne, c'est-à-dire exactement
 * `/parcours/:id`, `…/etapes`, `…/discussion`, `…/equipe`, `…/documents`,
 * `…/historique`, `…/reglages` — toutes servies par `app/(app)/parcours/[id]/`,
 * et J05 à J08 sont dans la table de `T5 §5`.
 *
 * ── CE QUI MANQUE AU MÉCANISME, ET POURQUOI CE SONT DONC DES BOUTONS ────────
 *
 * La destination a besoin de `:id`, qui est dans l'URL. `markLinks` sait poser une
 * destination calculée — `vers: '{{ r.href }}'` — mais son garde-fou EXIGE qu'une
 * interpolation soit englobée par un `<sc-for as="r">`, et ce panneau n'est pas
 * une boucle : il est écrit sept fois en clair. Un `vers` interpolé ARRÊTERAIT
 * donc la génération, à juste titre selon la règle écrite.
 *
 * La seule clé disponible pour une cible qui dépend de la route est donc
 * `action` — déjà employée par le dépôt pour le « Renvoyer » de l'écran du code —
 * et elle produit un `<button>`. Conséquence assumée et DITE : ces sept entrées
 * cliquent et changent l'URL, mais elles ne s'ouvrent pas dans un nouvel onglet et
 * un clic du milieu n'y fait rien. Le manque est remonté : il faudrait que
 * `markLinks` accepte une destination interpolée HORS boucle, sur une racine
 * déclarée, pour que ce panneau devienne sept vrais `<a>`.
 *
 * ── J02, J09 ET J11 N'EN REÇOIVENT AUCUNE, ET C'EST UN REFUS ────────────────
 *
 * Ces trois planches dessinent le même panneau (`/parcours/nouveau`,
 * `/parcours/publics`, `/parcours`) et la maquette n'y peint AUCUNE entrée : il
 * n'y a pas de parcours courant, donc pas de `:id`. Choisir lequel serait inventer
 * la donnée. Leurs vingt-une lignes restent inertes, et c'est remonté.
 *
 * ── LE MARQUEUR COMMENCE AU `</svg>` ───────────────────────────────────────
 *
 * `markLinks` remonte du marqueur jusqu'à la première balise promouvable. Le
 * libellé est enfermé dans un `<span style="flex:1">` : un discriminant `texte`
 * promouvrait CE span, et la zone cliquable ferait la largeur du mot au lieu des
 * 44 px de la ligne. En partant du `</svg>`, la remontée traverse `<path>` et
 * `<svg>` — non promouvables — et atteint la ligne. Le libellé est dans le
 * marqueur, donc il est unique ; les tracés d'icône ne le sont pas (le tracé de
 * « Discussion » figure deux fois par cadre).
 */
const ENTREES_PANNEAU_PARCOURS = [
  ['Vue d’ensemble', 'onPanneauVue', '/parcours/:id', 'J01'],
  ['Étape en cours', 'onPanneauEtape', '/parcours/:id/etapes', 'J01S'],
  ['Discussion', 'onPanneauDiscussion', '/parcours/:id/discussion', 'J01D'],
  ['Équipe', 'onPanneauEquipe', '/parcours/:id/equipe', 'J05'],
  ['Checklist de documents', 'onPanneauDocuments', '/parcours/:id/documents', 'J06'],
  ['Historique', 'onPanneauHistorique', '/parcours/:id/historique', 'J07'],
  ['Réglages', 'onPanneauReglages', '/parcours/:id/reglages', 'J08'],
];

/** Les sept entrées du panneau, sur le seul cadre d'ordinateur qui le dessine. */
const panneauParcours = () =>
  ENTREES_PANNEAU_PARCOURS.map(([libelle, action, route, planche]) => ({
    marqueur: `</svg><span style="flex:1">${libelle}</span>`,
    action,
    frames: ['Desktop'],
    why:
      `L’entrée « ${libelle} » du panneau mène à ${route} — la planche ${planche}, celle que ` +
      'la maquette PEINT quand elle est ouverte. La destination dépend du `:id` de la route, ' +
      'donc elle passe par un gestionnaire : `markLinks` n’accepte un `vers` interpolé que ' +
      'dans une boucle, et ce panneau n’en est pas une.',
  }));

/**
 * ─── LES DEUX DESTINATIONS QUE LA MAQUETTE BALISE MAIS N'ADRESSE PAS ────────
 *
 * Elles portent bien un `<a>`, donc elles COMPTENT dans le récapitulatif
 * « ── NAVIGATION ── » — contrairement au panneau ci-dessus. Les deux sont dans
 * la table de `T5 §5`, mot pour mot : J02 `/parcours/nouveau`, J09
 * `/parcours/publics`, J11 `/parcours`.
 *
 * « VOIR TOUS » EST ÉCRIT DEUX FOIS DANS LE CADRE DE J01S, et les deux ne mènent
 * pas au même endroit : celui de la carte « PARCOURS PUBLICS » (13 cadres) et
 * celui de « ILS ONT FRANCHI CETTE ÉTAPE À LYON · 8 » (un seul). Le texte ne les
 * distingue pas ; LE CORPS, oui — 12 px pour le premier, 12,5 px pour le second,
 * compté sur les octets de la maquette. Le discriminant est donc un fragment
 * VERBATIM du balisage, et il commence DANS la balise ouvrante pour que la
 * remontée de `markLinks` trouve bien ce `<a>`-là et non le précédent.
 *
 * Le second « Voir tous » n'est PAS posé : aucune route ne liste les membres qui
 * ont franchi une étape. Remonté.
 */
const NOUVEAU_PARCOURS = (frames, fois = 1) => ({
  texte: 'Nouveau parcours',
  vers: '/parcours/nouveau',
  frames,
  fois,
  why:
    'Le bouton pointillé du panneau mène à J02 « Créer un parcours » — ' +
    '`/parcours/nouveau` (T5 §5). La maquette le balise en <a> sans l’adresser.',
});

/**
 * LA MÊME DESTINATION, MAIS SUR LA PLANCHE « ABOUTI », OÙ LE TEXTE NE SUFFIT PAS.
 *
 * `DesktopAbouti` écrit « Nouveau parcours » DEUX FOIS : une fois dans le bouton
 * pointillé du panneau (`<a href="#">`), une fois dans le `<button>` vert de la
 * carte « Aider le suivant ». Le compte de `markLinks` l'a refusé, et il avait
 * raison : avec `fois: 2`, il aurait transformé LE BOUTON EN LIEN — un changement
 * de dessin et de sémantique, sur un contrôle que la maquette dessine en vert
 * plein. Le discriminant est donc un fragment du balisage du seul lien : son
 * pointillé.
 */
const NOUVEAU_PARCOURS_POINTILLE = (frames) => ({
  marqueur: 'border:1.5px dashed #9FB3AB;background:#fff',
  vers: '/parcours/nouveau',
  frames,
  why:
    'Le bouton pointillé du panneau mène à `/parcours/nouveau` (T5 §5). Le texte ne peut ' +
    'pas servir de discriminant ici : la planche écrit « Nouveau parcours » aussi dans un ' +
    '<button> que l’on ne doit PAS promouvoir en lien.',
});

const VOIR_TOUS_PUBLICS = (frames) => ({
  marqueur: 'font-size:12px;font-weight:700">Voir tous',
  vers: '/parcours/publics',
  frames,
  why:
    'Le « Voir tous » de la carte PARCOURS PUBLICS mène à J09 — `/parcours/publics` ' +
    '(T5 §5). Le corps de 12 px le distingue du « Voir tous » de 12,5 px de J01S, qui ' +
    'liste les membres ayant franchi l’étape et n’a aucune route.',
});

const screen = ({ section, out, frames, dataType = 'ParcoursData', modal = false,
  squelette = !modal, panneauDuParcours = false, liensPlus = [], ...rest }) => ({
  file: FILE,
  /**
   * ─── LE SQUELETTE MEMBRE : LE RAIL ──────────────────────────────────────────
   *
   * La maquette dessine les cinq entrées — Accueil, Parcours, Entraide,
   * Services, Agenda — en `<span>`. Ce ne sont pas des liens cassés : CE NE SONT
   * PAS DES LIENS, et c'est la phrase du porteur (« Aucun sous lien aussi ne
   * fonctionne »). Les cinq destinations sont déclarées UNE fois pour les sept
   * modules membre dans `tools/squelette-membre.mjs`.
   *
   * `cadresDuRail` retient les cadres dont le nom porte « Desktop » ; les écrans
   * d'ordinateur qui ne dessinent PAS de rail posent `squelette: false`, et un
   * oubli ne passerait pas en silence — le `dans` de `markLinks` exige son
   * conteneur une fois, donc un cadre sans rail ARRÊTE la génération.
   *
   *
   * LE DÉFAUT SUIT `modal`, et ce n'est pas un raccourci : une planche de FENÊTRE
   * ne dessine pas le squelette de l'application — elle se pose PAR-DESSUS. Les
   * cadres de modale d'ordinateur sont donc hors rail par construction, et c'est
   * mesuré sur chacun. Un écran plein cadre qui n'en dessine pas non plus doit
   * poser `squelette: false` à la main, en disant pourquoi.
   *
   * LA SURBRILLANCE N'EST PAS TOUCHÉE : dans ces navs littéraux, la maquette
   * peint déjà l'entrée qui désigne la page, planche par planche.
   */
  ...(modal ? { modal } : {}),
  /**
   * TROIS FAMILLES DE LIENS, CONCATÉNÉES : le rail (déclaré une fois pour les sept
   * modules membre), le panneau « MON PARCOURS » quand l'écran porte un `:id`, et
   * les destinations propres à l'écran (`liensPlus`). Les trois sont des « sous
   * liens » au sens du porteur, et les deux premières sont INVISIBLES au compteur
   * de `href="#"`.
   */
  liens: [
    ...(squelette ? railLitteral(cadresDuRail(frames)) : []),
    ...(panneauDuParcours ? panneauParcours() : []),
    ...liensPlus,
  ],
  section,
  out: `apps/web/src/screens/${out}`,
  dataModule: '../parcours/data',
  dataType,
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

/**
 * ─── LE PANNEAU DE GAUCHE, LIÉ SUR LES DIX PLANCHES D'ORDINATEUR ────────────
 *
 * Dix planches de 1440 px dessinent la même carte de parcours en haut du panneau :
 * le titre, l'étiquette du type, l'avancement, la ligne d'étape en cours, et le
 * compteur d'équipe à côté de « Équipe ». Ce sont donc les mêmes cinq littéraux à
 * lier dix fois.
 *
 * LES COMPTES NE SONT PAS RÉGULIERS, et c'est pour cela qu'ils sont des arguments
 * vérifiés à chaque génération plutôt qu'une valeur par défaut :
 *
 *   · le titre figure DEUX fois sur J01 (carte du panneau + `<h1>` de la page),
 *     deux fois sur J01S, deux fois sur J08 (le champ « Nom » des réglages le
 *     réécrit), une seule sur les six autres ;
 *   · l'étiquette « PARCOURS ÉTUDES » figure deux fois sur J01 et J01M ;
 *   · « 58% » figure deux fois sur J01M (le panneau et la ligne du sélecteur).
 *
 * Le jour où le designer ajoute ou retire une occurrence, la génération S'ARRÊTE
 * sur le cadre concerné en nommant le fragment. Elle ne produit pas neuf écrans
 * justes et un faux.
 *
 * ORDRE DE DÉCLARATION : sur J01M et J11, les LISTES de la page réemploient
 * exactement ces littéraux (le sélecteur montre le parcours courant, la liste de
 * J11 aussi). Elles sont donc déclarées AVANT le panneau, qui ne voit plus que ses
 * propres occurrences — `applyData` applique les liaisons dans l'ordre, sur le HTML
 * déjà réécrit.
 */
const panneau = ({ titre = 1, type = 1, pourcent = 1, equipe = true } = {}) => [
  {
    noeud: '>Mes études à Lyon<',
    devient: '>{{ panneau.titre }}<',
    fois: titre,
    frames: ['Desktop'],
    why: 'Le titre PERSONNEL du parcours, de `GET /journeys/:id` (`journey.title`) — il ne sort jamais du parcours (§3.7).',
  },
  {
    noeud: '>PARCOURS ÉTUDES<',
    devient: '>PARCOURS {{ panneau.type }}<',
    fois: type,
    frames: ['Desktop'],
    why: 'Le nom du TYPE de parcours (`journey.template.nameFr`), le seul nom qui circule hors du parcours.',
  },
  {
    noeud: '>58%<',
    devient: '>{{ panneau.avancement }}%<',
    fois: pourcent,
    frames: ['Desktop'],
    why: 'L’avancement calculé par le serveur (`journey.progressPct`) — jamais recalculé côté écran.',
  },
  {
    noeud: '>Étape 7 : Logement · échéance dans 9 jours<',
    devient:
      '>Étape {{ panneau.rang }} : {{ panneau.etape }} · échéance {{ panneau.echeance }}<',
    frames: ['Desktop'],
    why: 'L’étape EN COURS que le serveur déclare (`journey.currentStepId`), son rang, et `journey.nextDueDate`.',
  },
  /**
   * `equipe: false` SUR J02, ET C'EST UN COMPTE QUI L'A DÉCIDÉ, pas un goût.
   *
   * Le compteur « Équipe » est le littéral `>3<`, et il est UNIQUE sur les dix
   * planches qui dessinent ce panneau — sauf sur celle de J02, où l'« APERÇU DES
   * ÉTAPES » numérote ses lignes et écrit `>3<` une SECONDE fois. `fois: 1` y
   * tombait faux, et la génération s'arrêtait en nommant le fragment : c'est
   * exactement le travail que ce garde-fou existe pour faire. Lier la mauvaise
   * occurrence aurait mis le nombre de membres de l'équipe dans la frise des
   * étapes, et rien ne l'aurait signalé — le texte affiché est le même.
   */
  ...(equipe
    ? [
        {
          noeud: '>3<',
          devient: '>{{ panneau.equipe }}<',
          frames: ['Desktop'],
          why: 'Le nombre de membres de l’équipe, de `members` (§3.4) — le plafond est `meta.maxMembers`.',
        },
      ]
    : []),
];

// ─── LES CARTES QUE LA MAQUETTE RÉPÈTE, ÉCRITES UNE FOIS ─────────────────────
//
// Chaque fabrique ci-dessous reproduit une carte de la maquette à l'identique, ses
// textes en paramètres. Elle sert DEUX FOIS : à écrire le `noeud` (les cartes
// telles que la maquette les dessine, avec leurs textes d'exemple) et à écrire le
// `devient` (la même carte, une fois, avec des interpolations). Le troisième
// contrôle du générateur compare les deux — si la maquette change d'un pixel, la
// génération s'arrête. C'est ce qui rend ces longues chaînes sûres plutôt que
// fragiles : rien ici ne peut dériver sans être dit.
//
// LES COULEURS SONT PARFOIS DES DONNÉES, et elles viennent toujours de la maquette.
// C'est le précédent de K03 dans `08-compte.mjs` : lier le seul libellé d'une
// pastille laisserait « En pause » sur le fond vert d'un parcours actif, ce qui
// serait pire que la maquette figée. Aucune teinte n'est assombrie — le contrôle de
// contraste s'en assurerait, et un hexadécimal retouché arrête la génération.

/** J01 — une ligne du panneau « ÉQUIPE ». Quatre lignes identiques. */
const LIGNE_EQUIPE_PANNEAU = (fond, initiales, nom, badgeFond, badgeTexte, role) =>
  '<div style="display:flex;align-items:center;gap:10px;margin-top:12px">' +
  '<span style="width:34px;height:34px;border-radius:999px;background:' +
  fond +
  ';color:#fff;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
  initiales +
  '</span><span style="flex:1;font-size:13px;font-weight:700">' +
  nom +
  '</span><span style="background:' +
  badgeFond +
  ';color:' +
  badgeTexte +
  ';font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px;white-space:nowrap">' +
  role +
  '</span></div>';

/**
 * Une étape FRANCHIE de la frise, avec sa durée réelle.
 *
 * DEUX FABRIQUES POUR UNE MÊME LIGNE, et c'est la maquette qui le décide : J01
 * écarte l'icône du titre de 16 px, les deux planches « parcours abouti » de
 * J01E de 14 px. Un seul `gap` aurait fait échouer la génération sur l'un des
 * deux cadres — ce qu'elle a fait, d'ailleurs, et c'est ainsi que l'écart a été
 * trouvé plutôt que supposé.
 */
const LIGNE_FRANCHIE_GAP = (gap) => (titre, duree) =>
  '<div style="display:flex;gap:' +
  gap +
  'px;align-items:center;padding:8px 0">' +
  '<span style="width:20px;height:20px;border-radius:999px;background:#16785E;display:flex;align-items:center;justify-content:center;flex-shrink:0">' +
  '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="m5 12 4.5 4.5L19 7"/></svg></span>' +
  '<span style="flex:1;font-size:13.5px;font-weight:600">' +
  titre +
  '</span><span style="font-size:12px;color:#8A958F">' +
  duree +
  '</span></div>';

const LIGNE_FRANCHIE = LIGNE_FRANCHIE_GAP(16);
const LIGNE_FRANCHIE_ABOUTI = LIGNE_FRANCHIE_GAP(14);

/** J05 (ordinateur) — une ligne d'équipe. `fin` est le contrôle de droite. */
const LIGNE_EQUIPE_D = (fond, initiales, nom, depuis, badgeFond, badgeTexte, role, fin) =>
  '<div style="display:flex;align-items:center;gap:12px;padding:14px 0;border-bottom:1px solid #F0F3F2">' +
  '<span style="width:42px;height:42px;border-radius:999px;background:' +
  fond +
  ';color:#fff;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
  initiales +
  '</span><div style="flex:1;min-width:0"><div style="display:flex;align-items:center;gap:6px;font-size:14px;font-weight:700">' +
  nom +
  '<svg width="13" height="13" viewBox="0 0 24 24" fill="#16785E"><circle cx="12" cy="12" r="10"/>' +
  '<path d="m8 12 3 3 5-6" stroke="#fff" stroke-width="2.2" fill="none"/></svg></div>' +
  '<div style="font-size:12px;color:#8A958F">' +
  depuis +
  '</div></div><span style="background:' +
  badgeFond +
  ';color:' +
  badgeTexte +
  ';font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px;white-space:nowrap">' +
  role +
  '</span>' +
  fin +
  '</div>';

const MENU_MEMBRE =
  '<span style="width:34px;height:34px;border-radius:999px;background:#F2F5F4;display:flex;align-items:center;justify-content:center">' +
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16211D" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M5 12h.01M12 12h.01M19 12h.01"/></svg></span>';

const BOUTON_RETIRER =
  '<span style="height:34px;padding:0 12px;border-radius:999px;background:#F2F5F4;font-size:12px;font-weight:700;display:flex;align-items:center">Retirer</span>';

/**
 * J05 (mobile) — une ligne d'équipe. `bord` sépare les lignes SUIVANTES.
 *
 * ── UN PIÈGE PAYÉ, ET IL VAUT D'ÊTRE ÉCRIT ─────────────────────────────────
 *
 * La première version passait `bord` en INTERPOLATION dans l'attribut de style :
 * `style="…;padding:10px 0;{{ m.bord }}"`. Les quatre contrôles de `donnees` l'ont
 * acceptée — tous les fragments étaient bien dessinés dans `noeud`, dans l'ordre —
 * et le JSX produit avait PERDU le filet : zéro `borderTop` dans le cadre.
 *
 * La cause est dans `transcode` : son analyseur de style découpe l'attribut en
 * déclarations `clé:valeur`, et `{{ m.bord }}` n'en est pas une. Il l'a jetée SANS
 * un mot. Une interpolation peut donc tenir une VALEUR de style
 * (`background:{{ p.fond }}` marche, c'est vérifié dans le JSX produit) mais pas
 * une déclaration entière.
 *
 * On dessine donc les DEUX variantes en entier, chacune sous son `<sc-if>` —
 * exactement comme la checklist de J06 pour une autre raison. C'est plus long et
 * c'est juste, et le filet est de nouveau là.
 */
const LIGNE_EQUIPE_M = (bord) => (fond, initiales, nom, badgeFond, badgeTexte, role) =>
  '<div style="display:flex;align-items:center;gap:10px;padding:10px 0;' +
  bord +
  '"><span style="width:38px;height:38px;border-radius:999px;background:' +
  fond +
  ';color:#fff;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0">' +
  initiales +
  '</span><span style="flex:1;min-width:0;display:flex;align-items:center;gap:5px;font-size:13.5px;font-weight:700">' +
  nom +
  '<svg width="12" height="12" viewBox="0 0 24 24" fill="#16785E"><circle cx="12" cy="12" r="10"/>' +
  '<path d="m8 12 3 3 5-6" stroke="#fff" stroke-width="2.2" fill="none"/></svg></span>' +
  '<span style="background:' +
  badgeFond +
  ';color:' +
  badgeTexte +
  ';font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px;white-space:nowrap">' +
  role +
  '</span></div>';

const LIGNE_EQUIPE_M_PREMIERE = LIGNE_EQUIPE_M('');
const LIGNE_EQUIPE_M_SUIVANTE = LIGNE_EQUIPE_M('border-top:1px solid #F0F3F2');

/**
 * J06 — une ligne de checklist, DANS SON ENTIER et par variante.
 *
 * POURQUOI LA VARIANTE ENTIÈRE plutôt que deux ou trois interpolations : cochée et
 * à faire diffèrent en DEUX endroits — la case (verte avec sa coche / vide avec sa
 * bordure) et le style du libellé (gris barré / normal). Le troisième contrôle du
 * générateur exige que les fragments de `devient` se retrouvent dans `noeud` DANS
 * L'ORDRE ; deux variantes entrelacées ne le peuvent pas, puisque la maquette
 * dessine d'abord les trois cochées, puis les trois à faire. Dessiner chaque
 * variante en entier, sous son `<sc-if>`, respecte l'ordre sans rien remonter.
 */
const DOC_POUBELLE =
  '<span style="color:#B7C0BC;display:flex"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg></span>';

const DOC_COCHE_D = (libelle) =>
  '<div style="display:flex;align-items:center;gap:12px;padding:10px 0">' +
  '<span style="width:22px;height:22px;border-radius:7px;background:#16785E;border:none;display:flex;align-items:center;justify-content:center;flex-shrink:0">' +
  '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="m5 12 4.5 4.5L19 7"/></svg></span>' +
  '<span style="flex:1;font-size:14px;color:#8A958F;text-decoration:line-through">' +
  libelle +
  '</span>' +
  DOC_POUBELLE +
  '</div>';

const DOC_A_FAIRE_D = (libelle) =>
  '<div style="display:flex;align-items:center;gap:12px;padding:10px 0">' +
  '<span style="width:22px;height:22px;border-radius:7px;background:#fff;border:1.5px solid #CBD5D1;display:flex;align-items:center;justify-content:center;flex-shrink:0"></span>' +
  '<span style="flex:1;font-size:14px;">' +
  libelle +
  '</span>' +
  DOC_POUBELLE +
  '</div>';

const DOC_COCHE_M = (libelle) =>
  '<div style="display:flex;align-items:center;gap:12px;padding:9px 0">' +
  '<span style="width:22px;height:22px;border-radius:7px;background:#16785E;border:none;display:flex;align-items:center;justify-content:center;flex-shrink:0">' +
  '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="m5 12 4.5 4.5L19 7"/></svg></span>' +
  '<span style="flex:1;font-size:13.5px;color:#8A958F;text-decoration:line-through">' +
  libelle +
  '</span></div>';

const DOC_A_FAIRE_M = (libelle) =>
  '<div style="display:flex;align-items:center;gap:12px;padding:9px 0">' +
  '<span style="width:22px;height:22px;border-radius:7px;background:#fff;border:1.5px solid #CBD5D1;display:flex;align-items:center;justify-content:center;flex-shrink:0"></span>' +
  '<span style="flex:1;font-size:13.5px;">' +
  libelle +
  '</span></div>';

/** J06 (ordinateur) — l'en-tête replié d'un autre groupe d'étape. */
const GROUPE_REPLIE_D = (titre, compte, teinteCompte, barre, teinteBarre) =>
  '<div style="background:#fff;border:1px solid #E6EBE9;border-radius:22px;padding:18px;">' +
  '<div style="display:flex;align-items:center;gap:12px"><span style="flex:1;font-size:15px;font-weight:700">' +
  titre +
  '</span><span style="font-size:12.5px;font-weight:700;color:' +
  teinteCompte +
  '">' +
  compte +
  '</span><span style="width:80px"><div style="height:6px;border-radius:999px;background:#EEF2F0;overflow:hidden">' +
  '<div style="width:' +
  barre +
  ';height:100%;background:' +
  teinteBarre +
  ';border-radius:999px"></div></div></span>' +
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5D6B66" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="m6 9 6 6 6-6"/></svg></div></div>';

/** J06 (mobile) — l'en-tête replié d'un autre groupe d'étape. */
const GROUPE_REPLIE_M = (titre, compte, teinteCompte, barre, teinteBarre) =>
  '<div style="background:#fff;border:1px solid #E6EBE9;border-radius:20px;padding:14px;flex-shrink:0">' +
  '<div style="display:flex;align-items:center;gap:10px"><span style="flex:1;font-size:14px;font-weight:700">' +
  titre +
  '</span><span style="font-size:12px;font-weight:700;color:' +
  teinteCompte +
  '">' +
  compte +
  '</span><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#5D6B66" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="m6 9 6 6 6-6"/></svg></div><div style="margin-top:8px">' +
  '<div style="height:6px;border-radius:999px;background:#EEF2F0;overflow:hidden">' +
  '<div style="width:' +
  barre +
  ';height:100%;background:' +
  teinteBarre +
  ';border-radius:999px"></div></div></div></div>';

/**
 * J01M — une ligne du sélecteur de parcours.
 *
 * Deux fabriques, parce que la maquette dessine DEUX formes : la feuille mobile
 * pose `color:#16211D` sur le titre et le pourcentage, la planche d'ordinateur ne
 * le pose pas. Les fusionner demanderait de choisir laquelle est la vraie.
 */
const CHOIX_PARCOURS_M = (fond, titre, pFond, pTexte, etat, sousTitre, barre, teinte, pourcent, fin) =>
  '<div style="display:flex;gap:12px;align-items:center;padding:12px;border-radius:14px;background:' +
  fond +
  '"><div style="flex:1;min-width:0"><div style="display:flex;align-items:center;gap:6px">' +
  '<span style="font-size:13.5px;font-weight:700;color:#16211D">' +
  titre +
  '</span><span style="background:' +
  pFond +
  ';color:' +
  pTexte +
  ';font-size:10.5px;font-weight:700;padding:3px 9px;border-radius:999px;white-space:nowrap">' +
  etat +
  '</span></div><div style="font-size:11.5px;color:#8A958F;margin-top:2px">' +
  sousTitre +
  '</div><div style="margin-top:8px;display:flex;align-items:center;gap:8px"><div style="flex:1">' +
  '<div style="height:5px;border-radius:999px;background:#EEF2F0;overflow:hidden"><div style="width:' +
  barre +
  ';height:100%;background:' +
  teinte +
  ';border-radius:999px"></div></div></div>' +
  '<span style="font-size:11.5px;font-weight:800;color:#16211D">' +
  pourcent +
  '</span></div></div>' +
  fin +
  '</div>';

const CHOIX_PARCOURS_D = (fond, titre, pFond, pTexte, etat, sousTitre, barre, teinte, pourcent, fin) =>
  '<div style="display:flex;gap:12px;align-items:center;padding:12px;border-radius:14px;background:' +
  fond +
  '"><div style="flex:1;min-width:0"><div style="display:flex;align-items:center;gap:6px">' +
  '<span style="font-size:13.5px;font-weight:700">' +
  titre +
  '</span><span style="background:' +
  pFond +
  ';color:' +
  pTexte +
  ';font-size:10.5px;font-weight:700;padding:3px 9px;border-radius:999px;white-space:nowrap">' +
  etat +
  '</span></div><div style="font-size:11.5px;color:#8A958F;margin-top:2px">' +
  sousTitre +
  '</div><div style="margin-top:8px;display:flex;align-items:center;gap:8px"><div style="flex:1">' +
  '<div style="height:5px;border-radius:999px;background:#EEF2F0;overflow:hidden"><div style="width:' +
  barre +
  ';height:100%;background:' +
  teinte +
  ';border-radius:999px"></div></div></div>' +
  '<span style="font-size:11.5px;font-weight:800">' +
  pourcent +
  '</span></div></div>' +
  fin +
  '</div>';

const COCHE_SELECTEUR =
  '<span style="width:22px;height:22px;border-radius:999px;background:#16785E;display:flex;align-items:center;justify-content:center;flex-shrink:0">' +
  '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="m5 12 4.5 4.5L19 7"/></svg></span>';

const VIDE_SELECTEUR = '<span style="width:22px"></span>';

/** J11 (ordinateur) — une carte de « Mes parcours ». */
const CARTE_PARCOURS_D = (type, pastille, titre, sousTitre, pourcent, barre, teinte) =>
  '<div style="background:#fff;border:1px solid #E6EBE9;border-radius:22px;padding:18px;">' +
  '<div style="display:flex;align-items:center;gap:12px"><div style="flex:1;min-width:0">' +
  '<div style="display:flex;gap:6px;align-items:center"><div style="font-size:10.5px;font-weight:700;letter-spacing:1px;color:#16785E">' +
  type +
  '</div>' +
  pastille +
  '</div><div style="font-size:17px;font-weight:700;margin-top:6px">' +
  titre +
  '</div><div style="font-size:12.5px;color:#8A958F;margin-top:2px">' +
  sousTitre +
  '</div></div><span style="font-size:22px;font-weight:800">' +
  pourcent +
  '</span></div><div style="margin-top:12px"><div style="height:8px;border-radius:999px;background:#EEF2F0;overflow:hidden">' +
  '<div style="width:' +
  barre +
  ';height:100%;background:' +
  teinte +
  ';border-radius:999px"></div></div></div></div>';

/** J11 (mobile) — une carte de parcours ACTIF : titre et pourcentage sur la même ligne. */
const CARTE_PARCOURS_M = (type, pastille, titre, pourcent, barre, teinte, sousTitre) =>
  '<div style="background:#fff;border:1px solid #E6EBE9;border-radius:20px;padding:14px;flex-shrink:0">' +
  '<div style="display:flex;gap:6px;align-items:center"><div style="font-size:10.5px;font-weight:700;letter-spacing:1px;color:#16785E">' +
  type +
  '</div>' +
  pastille +
  '</div><div style="display:flex;align-items:baseline;margin-top:6px">' +
  '<span style="flex:1;font-size:16px;font-weight:700">' +
  titre +
  '</span><span style="font-size:18px;font-weight:800">' +
  pourcent +
  '</span></div><div style="margin-top:10px"><div style="height:7px;border-radius:999px;background:#EEF2F0;overflow:hidden">' +
  '<div style="width:' +
  barre +
  ';height:100%;background:' +
  teinte +
  ';border-radius:999px"></div></div></div>' +
  '<div style="font-size:11.5px;color:#8A958F;margin-top:8px">' +
  sousTitre +
  '</div></div>';

/** J11 (mobile) — une carte de parcours ABOUTI : ni pourcentage, ni sous-titre. */
const CARTE_ABOUTI_M = (type, pastille, titre, barre, teinte) =>
  '<div style="background:#fff;border:1px solid #E6EBE9;border-radius:20px;padding:14px;flex-shrink:0">' +
  '<div style="display:flex;gap:6px;align-items:center"><div style="font-size:10.5px;font-weight:700;letter-spacing:1px;color:#16785E">' +
  type +
  '</div>' +
  pastille +
  '</div><div style="font-size:16px;font-weight:700;margin-top:6px">' +
  titre +
  '</div><div style="margin-top:10px"><div style="height:7px;border-radius:999px;background:#EEF2F0;overflow:hidden">' +
  '<div style="width:' +
  barre +
  ';height:100%;background:' +
  teinte +
  ';border-radius:999px"></div></div></div></div>';

const PASTILLE = (fond, texte, libelle) =>
  '<span style="background:' +
  fond +
  ';color:' +
  texte +
  ';font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px;white-space:nowrap">' +
  libelle +
  '</span>';

const PASTILLE_ACTIF = PASTILLE('#E3F0EB', '#0F5C48', 'Actif');
const PASTILLE_PAUSE = PASTILLE('#F2F5F4', '#5D6B66', 'En pause');
const PASTILLE_ABOUTI = PASTILLE('#16785E', '#fff', 'Abouti');

/** J01E (ordinateur) — une carte de type de parcours, avec sa phrase. */
const CARTE_MODELE_D = (nom, etapes, phrase) =>
  '<div style="padding:16px;border-radius:20px;background:#fff;border:1px solid #E6EBE9;display:flex;flex-direction:column;gap:6px">' +
  '<span style="font-size:15px;font-weight:700">' +
  nom +
  '</span><span style="font-size:12px;font-weight:700;color:#16785E">' +
  etapes +
  '</span><span style="font-size:12.5px;color:#5D6B66;line-height:1.45">' +
  phrase +
  '</span></div>';

/** J01E (mobile) — une ligne de type de parcours, sans phrase. */
const CARTE_MODELE_M = (nom, etapes) =>
  '<div style="display:flex;align-items:center;justify-content:space-between;background:#fff;border:1px solid #E6EBE9;border-radius:16px;padding:14px">' +
  '<span style="font-size:14px;font-weight:700">' +
  nom +
  '</span><span style="font-size:12px;font-weight:700;color:#16785E">' +
  etapes +
  '</span></div>';

/**
 * ─── J02 — LES CARTES DE TYPE DE PARCOURS, SUR SES DEUX PLANCHES MOBILES ────
 *
 * Même donnée que J01E — `GET /journey-templates` — et trois dessins différents,
 * parce que la maquette en dessine trois. Les deux planches mobiles sont
 * BOUCLABLES et celle d'ordinateur ne l'est PAS, et c'est l'icône qui tranche :
 *
 *   · à 390 px, les quatre cartes portent LA MÊME icône (le tracé
 *     `M5 5h6a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h10`, compté quatre fois). Elle entre
 *     donc dans la fabrique comme le reste du dessin ;
 *   · à 1440 px, CHAQUE carte a SON icône — toque, mallette, deux personnes,
 *     document. Ce sont quatre tracés différents, et `GET /journey-templates` ne
 *     rend qu'un `icon` NOMMÉ (`z.string().nullable()`), pas un tracé. Boucler
 *     demanderait une table nom → tracé que la maquette ne dessine pas, et un
 *     cinquième modèle n'aurait aucune icône. Les quatre cartes d'ordinateur
 *     restent donc dessinées, et l'écart est REMONTÉ : il faudrait soit que la
 *     maquette dessine une icône neutre, soit que le dossier fixe la table.
 *
 * LA PREMIÈRE CARTE EST SÉLECTIONNÉE, et c'est un état d'INTERACTION que la
 * maquette montre sur sa première ligne : fond `#EFF7F3`, bordure de 2 px, fond
 * d'icône blanc et une coche en fin de ligne. Les DEUX variantes sont dessinées
 * sous `<sc-if>` — en garder une seule mentirait sur les trois autres lignes,
 * c'est le précédent des sessions de K04. Ce qui décide est `choisi`, et
 * `parcours/appels.ts` dit exactement ce qu'il vaut et pourquoi.
 */
const COCHE_CHOIX =
  '<span style="width:22px;height:22px;border-radius:999px;background:#16785E;display:flex;align-items:center;justify-content:center">' +
  '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="m5 12 4.5 4.5L19 7"/></svg></span>';

const CARTE_TYPE_M = (carte, fondIcone, nom, etapes, fin) =>
  '<div style="display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:16px;' +
  carte +
  ';flex-shrink:0"><span style="width:38px;height:38px;border-radius:12px;background:' +
  fondIcone +
  ';display:flex;align-items:center;justify-content:center">' +
  '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#0F5C48" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M5 5h6a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h10"/></svg></span>' +
  '<span style="flex:1"><span style="display:block;font-size:14.5px;font-weight:700">' +
  nom +
  '</span><span style="display:block;font-size:12px;color:#16785E;font-weight:700">' +
  etapes +
  '</span></span>' +
  fin +
  '</div>';

/** La carte CHOISIE et la carte simple, telles que la maquette les dessine. */
const CARTE_TYPE_M_CHOISIE = (nom, etapes) =>
  CARTE_TYPE_M('background:#EFF7F3;border:2px solid #16785E', '#fff', nom, etapes, COCHE_CHOIX);
const CARTE_TYPE_M_SIMPLE = (nom, etapes) =>
  CARTE_TYPE_M('background:#fff;border:1px solid #E6EBE9', '#E3F0EB', nom, etapes, '');

/**
 * J02 « plan atteint » — une ligne de type, grisée.
 *
 * `opacity:.7` est dans le DESSIN et non dans la donnée : §3.1 veut que la limite
 * du plan « ne bloque pas la lecture », et c'est ce que l'estompe dit. Les lignes
 * restent lisibles, et leur nombre d'étapes reste celui du serveur.
 */
const LIGNE_TYPE_PLAN = (texte) =>
  '<div style="background:#fff;border:1px solid #E6EBE9;border-radius:16px;padding:14px;font-size:14px;font-weight:700;opacity:.7">' +
  texte +
  '</div>';

/**
 * J07 — une entrée du journal. Les SIX icônes sont celles de la maquette.
 *
 * Une icône par type d'activité, et c'est la maquette qui les dessine : drapeau
 * pour une étape commencée, cœur pour une demande d'entraide, coche pour une étape
 * franchie, trophée pour un jalon partagé, silhouettes pour l'arrivée d'un membre,
 * lignes pour une note. `JourneyActivityType` en compte HUIT : `STEP_PAUSED` et
 * `HELP_RECEIVED` n'ont pas d'icône dessinée, et `data.ts` les range sous celle de
 * la famille la plus proche plutôt que d'en inventer une.
 */
const IC = (tailleSvg, trace) =>
  '<svg width="' +
  tailleSvg +
  '" height="' +
  tailleSvg +
  '" viewBox="0 0 24 24" fill="none" stroke="#0F5C48" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="' +
  trace +
  '"/></svg>';

const TRACE_ETAPE = 'M5 21V4h12l-2 4 2 4H5';
const TRACE_ENTRAIDE = 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z';
const TRACE_FRANCHIE = 'm5 12 4.5 4.5L19 7';
const TRACE_JALON = 'M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 21h8';
const TRACE_EQUIPE = 'M9 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20a6 6 0 0 1 12 0M17 11a2.5 2.5 0 1 0 0-5M16 20h5a5 5 0 0 0-4-5';
const TRACE_NOTE = 'M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01';

const LIGNE_JOURNAL_D = (icone, titre, detail, quand, fin) =>
  '<div style="display:flex;gap:14px;padding:14px 0;border-bottom:1px solid #F0F3F2">' +
  '<span style="width:38px;height:38px;border-radius:12px;background:#E3F0EB;display:flex;align-items:center;justify-content:center;flex-shrink:0">' +
  icone +
  '</span><div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:600;line-height:1.4">' +
  titre +
  '</div><div style="font-size:12px;color:#8A958F;margin-top:2px">' +
  detail +
  '</div></div><span style="font-size:12px;color:#8A958F;white-space:nowrap">' +
  quand +
  '</span>' +
  fin +
  '</div>';

const LIEN_VOIR = '<a href="#" style="font-size:12.5px;font-weight:700;white-space:nowrap">Voir</a>';

const LIGNE_JOURNAL_M = (icone, titre, detail) =>
  '<div style="display:flex;gap:12px;padding:12px 0;border-bottom:1px solid #F0F3F2;flex-shrink:0">' +
  '<span style="width:34px;height:34px;border-radius:11px;background:#E3F0EB;display:flex;align-items:center;justify-content:center;flex-shrink:0">' +
  icone +
  '</span><div style="flex:1;min-width:0"><div style="font-size:13.5px;font-weight:600;line-height:1.35">' +
  titre +
  '</div><div style="font-size:11.5px;color:#8A958F;margin-top:2px">' +
  detail +
  '</div></div></div>';

/**
 * J09 — un segment de la frise d'un parcours public (ordinateur).
 *
 * `teinteTitre` est une DONNÉE, et la maquette l'impose : le dernier segment de la
 * seconde carte — une étape pas encore atteinte — écrit son libellé en `#8A958F`
 * là où les étapes franchies et l'étape en cours l'écrivent en `#16211D`. Le
 * figer aurait fait échouer la génération, et c'est ce qui est arrivé : l'écart a
 * été trouvé par le troisième contrôle, pas en relisant la planche.
 */
const SEGMENT_D = (teinte, teinteTitre, titre, duree) =>
  '<div style="flex:1;min-width:0"><div style="height:6px;border-radius:999px;background:' +
  teinte +
  '"></div><div style="font-size:10.5px;font-weight:700;margin-top:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:' +
  teinteTitre +
  '">' +
  titre +
  '</div><div style="font-size:10px;color:#8A958F">' +
  duree +
  '</div></div>';

/**
 * LES DEUX BOUTONS QUE LA MAQUETTE DESSINE SOUS UNE CARTE PUBLIQUE.
 *
 * ELLE N'EN DESSINE PAS LES MÊMES SUR LES DEUX CARTES : la première porte
 * « Écrire » ET « Proposer comme parrain », la seconde « Écrire » seule. Les deux
 * variantes vont donc sous `<sc-if>` — n'en garder qu'une proposerait le
 * parrainage à tout le monde ou à personne, et la maquette ne dit ni l'un ni
 * l'autre.
 *
 * CE QUI DISTINGUE LES DEUX, la maquette ne le dit pas. Le seul champ de la vue
 * publique qui parle de la capacité d'un membre à accompagner est
 * `member.verificationLevel` (§3.7 n'en expose aucun autre), et c'est lui que
 * `data.ts` emploie. CHOIX À CONFIRMER PAR LE PORTEUR : il est nommé plutôt que
 * caché, et il ne décide de rien côté serveur — c'est le parrainage qui refusera
 * une proposition qu'il n'accepte pas.
 */
const BOUTON_ECRIRE_D =
  '<button style="height:44px;padding:0 18px;border-radius:14px;background:#F2F5F4;color:#16211D;border:none;font:inherit;font-size:13.5px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:8px;white-space:nowrap;height:40px">' +
  '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#16211D" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M4 5h16v11H9l-5 4z"/></svg>Écrire</button>';

const BOUTON_PARRAIN_D =
  '<button style="height:44px;padding:0 18px;border-radius:14px;background:#16785E;color:#fff;border:none;font:inherit;font-size:13.5px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:8px;white-space:nowrap;height:40px">Proposer comme parrain</button>';

/** J09 — la carte d'un parcours public (ordinateur). */
const CARTE_PUBLIQUE_D = (fond, initiales, nom, sousTitre, pourcent, enCours, segments, actions) =>
  '<div style="background:#fff;border:1px solid #E6EBE9;border-radius:22px;padding:18px;">' +
  '<div style="display:flex;align-items:center;gap:12px"><span style="width:44px;height:44px;border-radius:999px;background:' +
  fond +
  ';color:#fff;font-size:14px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
  initiales +
  '</span><div style="flex:1;min-width:0"><div style="display:flex;align-items:center;gap:6px;font-size:15px;font-weight:700">' +
  nom +
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="#16785E"><circle cx="12" cy="12" r="10"/>' +
  '<path d="m8 12 3 3 5-6" stroke="#fff" stroke-width="2.2" fill="none"/></svg></div>' +
  '<div style="font-size:12.5px;color:#8A958F">' +
  sousTitre +
  '</div></div><span style="font-size:20px;font-weight:800">' +
  pourcent +
  '</span></div><div style="display:flex;gap:8px;align-items:center;margin-top:12px">' +
  '<span style="background:#FBE3D4;color:#B4581F;font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px;white-space:nowrap">' +
  enCours +
  '</span></div><div style="display:flex;gap:4px;margin-top:12px">' +
  segments +
  '</div><div style="display:flex;gap:8px;margin-top:14px">' +
  BOUTON_ECRIRE_D +
  actions +
  '</div></div>';

/** J09 — un segment de la frise d'un parcours public (mobile) : la barre seule. */
const SEGMENT_M = (teinte) =>
  '<span style="flex:1;height:6px;border-radius:999px;background:' + teinte + '"></span>';

/** J09 — la carte d'un parcours public (mobile). */
const CARTE_PUBLIQUE_M = (fond, initiales, nom, sousTitre, pourcent, segments, enCours, actions) =>
  '<div style="background:#fff;border:1px solid #E6EBE9;border-radius:20px;padding:14px;flex-shrink:0">' +
  '<div style="display:flex;align-items:center;gap:10px"><span style="width:40px;height:40px;border-radius:999px;background:' +
  fond +
  ';color:#fff;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0">' +
  initiales +
  '</span><span style="flex:1;min-width:0"><span style="display:flex;align-items:center;gap:5px;font-size:14px;font-weight:700">' +
  nom +
  '<svg width="12" height="12" viewBox="0 0 24 24" fill="#16785E"><circle cx="12" cy="12" r="10"/>' +
  '<path d="m8 12 3 3 5-6" stroke="#fff" stroke-width="2.2" fill="none"/></svg></span>' +
  '<span style="display:block;font-size:11.5px;color:#8A958F">' +
  sousTitre +
  '</span></span><span style="font-size:18px;font-weight:800">' +
  pourcent +
  '</span></div><div style="display:flex;gap:3px;margin-top:12px">' +
  segments +
  '</div><div style="font-size:12px;color:#B4581F;font-weight:700;margin-top:8px">' +
  enCours +
  '</div><div style="display:flex;gap:8px;margin-top:10px">' +
  BOUTON_ECRIRE_M +
  actions +
  '</div></div>';

const BOUTON_ECRIRE_M =
  '<button style="height:48px;padding:0 16px;border-radius:14px;background:#F2F5F4;color:#16211D;border:none;font:inherit;font-size:14px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:8px;flex-shrink:0;height:40px;flex:1;font-size:13px">Écrire</button>';

/** Même variante que sur l'ordinateur : la seconde carte ne la dessine pas. */
const BOUTON_PARRAIN_M =
  '<button style="height:48px;padding:0 16px;border-radius:14px;background:#16785E;color:#fff;border:none;font:inherit;font-size:14px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:8px;flex-shrink:0;height:40px;flex:1.6;font-size:12.5px">Proposer comme parrain</button>';

/** J09 (fiche mobile) — une étape franchie du parcours d'un autre membre. */
const ETAPE_PUBLIQUE_FICHE = (titre, duree) =>
  '<div style="display:flex;gap:12px;align-items:center;padding:6px 0">' +
  '<span style="width:18px;height:18px;border-radius:999px;background:#16785E;display:flex;align-items:center;justify-content:center;flex-shrink:0">' +
  '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="m5 12 4.5 4.5L19 7"/></svg></span>' +
  '<span style="flex:1;font-size:13px;font-weight:600">' +
  titre +
  '</span><span style="font-size:11.5px;color:#8A958F">' +
  duree +
  '</span></div>';

export const screens = [
  /**
   * ── J01 · /parcours/:id — vue d'ensemble ──────────────────────────────────
   *
   * Trois planches : la page, son équivalent mobile, et le mode « Modifier les
   * étapes » du mobile — qui n'est pas une modale (aucun voile) mais un ÉTAT de
   * l'écran, avec sa propre croix de sortie et son bouton « Terminer ».
   *
   * BRANCHÉ SUR `GET /journeys/:id`, et sur elle seule : la route rend le parcours,
   * ses quinze étapes, sa checklist et son équipe en un appel.
   *
   * DEUX ÉCARTS DE LA MAQUETTE, relevés et non contournés :
   *
   *   · elle écrit « 7 / 12 étapes » en haut et « 6 étapes franchies » au-dessus de
   *     la frise — six et sept pour le même parcours. Les deux sont liées à
   *     `journey.doneCount`, donc elles s'accordent à l'écran. C'est une correction,
   *     et elle est dite ;
   *   · « Cotonou → Lyon » nomme une ville d'ORIGINE. `GET /journeys/:id` rend
   *     `originCountry` — le pays — et aucune route du parcours ne porte la ville de
   *     départ. La donnée liée est donc le PAYS, ce qui est ce que le serveur sait.
   */
  screen({
    section: 'J01',
    out: 'j01',
    liensPlus: [...barreBasse(['Mobile', 'MobileEdition']), NOUVEAU_PARCOURS(['Desktop', 'Mobile']), VOIR_TOUS_PUBLICS(['Desktop'])],
    panneauDuParcours: true,
    dataType: 'J01Data',
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
    donnees: [
      {
        noeud:
          LIGNE_EQUIPE_PANNEAU('#B4581F', 'AD', 'Amina (vous)', '#F2F5F4', '#5D6B66', 'Propriétaire') +
          LIGNE_EQUIPE_PANNEAU('#16785E', 'AI', 'Aïcha Diop', '#FBE3D4', '#B4581F', 'Parraine') +
          LIGNE_EQUIPE_PANNEAU('#0F5C48', 'MD', 'Moussa Diallo', '#F2F5F4', '#5D6B66', 'Accompagnant') +
          LIGNE_EQUIPE_PANNEAU('#2FA37D', 'FD', 'Fanta Diallo', '#F2F5F4', '#5D6B66', 'Observatrice'),
        devient:
          '<sc-for list="{{ equipe }}" as="m">' +
          LIGNE_EQUIPE_PANNEAU(
            '{{ m.fond }}',
            '{{ m.initiales }}',
            '{{ m.nom }}',
            '{{ m.badgeFond }}',
            '{{ m.badgeTexte }}',
            '{{ m.role }}',
          ) +
          '</sc-for>',
        frames: ['Desktop'],
        why: 'L’équipe du parcours (§3.4) : le propriétaire de `journey.owner`, puis `members` — un seul appel, `GET /journeys/:id`.',
      },
      {
        noeud:
          LIGNE_FRANCHIE('Admission Campus France', '3 mois') +
          LIGNE_FRANCHIE('Visa étudiant', '4 sem.') +
          LIGNE_FRANCHIE('Caution bancaire et AVI', '2 sem.'),
        devient:
          '<sc-for list="{{ frise }}" as="e">' +
          LIGNE_FRANCHIE('{{ e.titre }}', '{{ e.duree }}') +
          '</sc-for>',
        frames: ['Desktop'],
        why: 'Les étapes FRANCHIES et leur durée réelle (`steps[].durationDays`) — la durée vient du serveur, jamais d’un calcul d’écran.',
      },
      ...panneau({ titre: 2, type: 2 }),
      {
        noeud: '>PRIVÉ<',
        devient: '>{{ parcours.visibilite }}<',
        frames: ['Desktop'],
        why: 'La visibilité du parcours (`journey.visibility`, §3.7) — PRIVÉ, PARTAGÉ ou PUBLIC.',
      },
      {
        noeud: '>Cotonou → Lyon · départ prévu le 12 septembre<',
        devient:
          '>{{ parcours.origine }} → {{ parcours.destination }} · départ prévu le {{ parcours.depart }}<',
        frames: ['Desktop'],
        why: 'Pays d’origine, ville de destination et date cible, NOMMÉS par `GET /journeys/:id` (la maquette écrit une ville de départ que l’API ne porte pas).',
      },
      {
        noeud: '>7 / 12 étapes<',
        devient: '>{{ parcours.franchies }} / {{ parcours.total }} étapes<',
        frames: ['Desktop'],
        why: '`journey.doneCount` sur `journey.totalCount` — lequel EXCLUT les étapes facultatives (§3.2), contrairement à `steps.length`.',
      },
      {
        noeud: '>6 étapes franchies<',
        devient: '>{{ parcours.franchies }} étapes franchies<',
        frames: ['Desktop'],
        why: 'Le même `doneCount` que la ligne au-dessus : la maquette écrit six d’un côté et sept de l’autre, l’écran ne peut pas.',
      },
      {
        noeud: '>Étape 7 · Trouver un logement pérenne<',
        devient: '>Étape {{ etape.rang }} · {{ etape.titre }}<',
        frames: ['Desktop'],
        why: 'L’étape en cours : son rang (`position`) et son titre, de `steps[]`.',
      },
      {
        noeud: '>EN COURS<',
        devient: '>{{ etape.etat }}<',
        frames: ['Desktop'],
        why: 'L’état de l’étape (`steps[].status`) — et le vocabulaire n’a aucun état d’échec (§3.2).',
      },
      {
        noeud: '>Échéance dans 9 jours<',
        devient: '>Échéance {{ etape.echeance }}<',
        frames: ['Desktop'],
        why: 'L’échéance de l’étape en cours (`steps[].dueDate`), rendue au propriétaire seul (§3.4).',
      },
      {
        noeud:
          '>Constituez votre dossier (garant, justificatifs, attestation d\'hébergement) avant les visites.<',
        devient: '>{{ etape.description }}<',
        frames: ['Desktop'],
        why: 'La description de l’étape, écrite par le MODÈLE (`steps[].description`) — pas un texte d’écran.',
      },
      {
        noeud: '>Projet privé<',
        devient: '>{{ parcours.visibiliteTitre }}<',
        frames: ['Desktop'],
        why: 'Le titre du bloc « VISIBILITÉ », dérivé de `journey.visibility` (§3.7).',
      },
      {
        noeud: '>vous et 3 invités<',
        devient: '>vous et {{ panneau.equipe }} invités<',
        frames: ['Desktop'],
        why: 'Qui voit le parcours : le nombre d’invités est celui de `members` (§3.4).',
      },

      // ── Le cadre mobile : la même donnée, les littéraux de sa planche ──────
      {
        noeud: '>PARCOURS ÉTUDES<',
        devient: '>PARCOURS {{ panneau.type }}<',
        frames: ['Mobile'],
        why: 'Le type de parcours, sur l’en-tête mobile.',
      },
      {
        noeud: '>PRIVÉ<',
        devient: '>{{ parcours.visibilite }}<',
        frames: ['Mobile'],
        why: 'La visibilité, sur l’en-tête mobile.',
      },
      {
        noeud: '>Mes études à Lyon<',
        devient: '>{{ panneau.titre }}<',
        frames: ['Mobile'],
        why: 'Le titre personnel du parcours, sur l’en-tête mobile.',
      },
      {
        noeud: '>7 / 12<',
        devient: '>{{ parcours.franchies }} / {{ parcours.total }}<',
        frames: ['Mobile'],
        why: 'Étapes franchies sur étapes comptées, sur le cadre mobile.',
      },
      {
        noeud: '>6 étapes franchies<',
        devient: '>{{ parcours.franchies }} étapes franchies<',
        frames: ['Mobile'],
        why: 'Le compte d’étapes franchies, sur le cadre mobile.',
      },
      {
        noeud: '>Étape 7 · Logement<',
        devient: '>Étape {{ etape.rang }} · {{ etape.titre }}<',
        frames: ['Mobile'],
        why: 'L’étape en cours, sur le cadre mobile (la maquette l’abrège, l’API en donne le titre entier).',
      },
      {
        noeud: '>EN COURS<',
        devient: '>{{ etape.etat }}<',
        frames: ['Mobile'],
        why: 'L’état de l’étape, sur le cadre mobile.',
      },
      {
        noeud: '>Échéance dans 9 jours<',
        devient: '>Échéance {{ etape.echeance }}<',
        frames: ['Mobile'],
        why: 'L’échéance de l’étape en cours, sur le cadre mobile.',
      },
      {
        noeud: '>Constituez votre dossier avant les visites.<',
        devient: '>{{ etape.description }}<',
        frames: ['Mobile'],
        why: 'La description de l’étape, sur le cadre mobile.',
      },
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
   *
   * BRANCHÉ SUR `GET /journeys` POUR LA LISTE et `GET /journeys/:id` pour le
   * panneau. La liste est la forme de la LISTE — `currentStep { id, title }`,
   * `stepCount`, `isOwner` — et PAS celle du détail : les deux schémas existent
   * dans `@app/shared` et ne se confondent pas.
   */
  screen({
    section: 'J01M',
    out: 'j01m',
    liensPlus: [NOUVEAU_PARCOURS(['Desktop'], 2), VOIR_TOUS_PUBLICS(['Desktop']),
      {
        texte: 'Voir tous mes parcours',
        vers: '/parcours',
        frames: ['Desktop'],
        why:
          'Le pied du sélecteur mène à J11 « Mes parcours » — `/parcours` (T5 §5).',
      },],
    panneauDuParcours: true,
    dataType: 'J01MData',
    triggers: [{ marker: 'Je suis bloqué·e', modal: 'J03', all: true }],
    frames: [f(1440, 'Desktop', 0, t('Mes études à Lyon', '30px'))],
    donnees: [
      {
        noeud:
          CHOIX_PARCOURS_D(
            '#EFF7F3',
            'Mes études à Lyon',
            '#E3F0EB',
            '#0F5C48',
            'Actif',
            'Études · Étape 7 : Logement',
            '58%',
            '#E0733A',
            '58%',
            COCHE_SELECTEUR,
          ) +
          CHOIX_PARCOURS_D(
            'transparent',
            'Faire venir ma sœur',
            '#E3F0EB',
            '#0F5C48',
            'Actif',
            'Famille · Étape 3 : Dossier OFII',
            '22%',
            '#E0733A',
            '22%',
            VIDE_SELECTEUR,
          ) +
          CHOIX_PARCOURS_D(
            'transparent',
            'Changer de statut',
            '#F2F5F4',
            '#5D6B66',
            'En pause',
            'Régulariser · depuis le 3 mars',
            '0%',
            '#CBD5D1',
            '0%',
            VIDE_SELECTEUR,
          ),
        devient:
          '<sc-for list="{{ mesParcours }}" as="p">' +
          CHOIX_PARCOURS_D(
            '{{ p.fond }}',
            '{{ p.titre }}',
            '{{ p.pastilleFond }}',
            '{{ p.pastilleTexte }}',
            '{{ p.etat }}',
            '{{ p.sousTitre }}',
            '{{ p.barre }}',
            '{{ p.teinte }}',
            '{{ p.pourcent }}',
            '<sc-if value="{{ p.courant }}">' +
              COCHE_SELECTEUR +
              '</sc-if><sc-if value="{{ p.autre }}">' +
              VIDE_SELECTEUR +
              '</sc-if>',
          ) +
          '</sc-for>',
        frames: ['Desktop'],
        why: 'Mes parcours, de `GET /journeys` (§5.1) : la coche désigne celui que l’URL nomme — les DEUX variantes que la maquette dessine sont gardées.',
      },
      ...panneau({ titre: 2, type: 2 }),
    ],
  }),
  screen({
    section: 'J01M',
    out: 'j01mfeuille',
    liensPlus: [NOUVEAU_PARCOURS(['Mobile'])],
    dataType: 'J01MData',
    modal: true,
    // Le titre VISIBLE de la feuille, compteur compris — c'est lui qui donnera
    // son nom accessible à la boîte de dialogue. Il est DEVENU UNE DONNÉE, et
    // `retitrerSurDonnees` reprend le titre sur sa forme liée (cas K02).
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
    donnees: [
      {
        noeud: '>Mes parcours · 3<',
        devient: '>Mes parcours · {{ total }}<',
        why: 'Le nombre de mes parcours, de `GET /journeys` — titre de la feuille, donc nom accessible de la boîte de dialogue.',
      },
      {
        noeud:
          CHOIX_PARCOURS_M(
            '#EFF7F3',
            'Mes études à Lyon',
            '#E3F0EB',
            '#0F5C48',
            'Actif',
            'Études · Étape 7 : Logement',
            '58%',
            '#E0733A',
            '58%',
            COCHE_SELECTEUR,
          ) +
          CHOIX_PARCOURS_M(
            'transparent',
            'Faire venir ma sœur',
            '#E3F0EB',
            '#0F5C48',
            'Actif',
            'Famille · Étape 3 : Dossier OFII',
            '22%',
            '#E0733A',
            '22%',
            VIDE_SELECTEUR,
          ) +
          CHOIX_PARCOURS_M(
            'transparent',
            'Changer de statut',
            '#F2F5F4',
            '#5D6B66',
            'En pause',
            'Régulariser · En pause depuis le 3 mars',
            '0%',
            '#CBD5D1',
            '0%',
            VIDE_SELECTEUR,
          ),
        devient:
          '<sc-for list="{{ mesParcours }}" as="p">' +
          CHOIX_PARCOURS_M(
            '{{ p.fond }}',
            '{{ p.titre }}',
            '{{ p.pastilleFond }}',
            '{{ p.pastilleTexte }}',
            '{{ p.etat }}',
            '{{ p.sousTitre }}',
            '{{ p.barre }}',
            '{{ p.teinte }}',
            '{{ p.pourcent }}',
            '<sc-if value="{{ p.courant }}">' +
              COCHE_SELECTEUR +
              '</sc-if><sc-if value="{{ p.autre }}">' +
              VIDE_SELECTEUR +
              '</sc-if>',
          ) +
          '</sc-for>',
        why: 'Mes parcours dans la feuille du bas, de `GET /journeys` — même donnée que la planche d’ordinateur, autre dessin.',
      },
    ],
  }),

  /**
   * ── J01E · les deux états sans parcours actif ──────────────────────────────
   *
   * « Aucun parcours » et « un parcours abouti, aucun actif ». Deux paires
   * complètes, dans cet ordre dans la maquette.
   *
   * DEUX DÉCLARATIONS POUR UNE SECTION, et ce n'est pas un dédoublement gratuit :
   * les deux états ne lisent pas la même route. L'état VIDE lit
   * `GET /journey-templates` (les types proposés) ; l'état ABOUTI lit
   * `GET /journeys/:id`. Or `dataType` vaut pour tout un écran — une seule
   * déclaration aurait obligé la page « aucun parcours » à fabriquer un parcours
   * qu'elle n'a pas, pour satisfaire un type.
   */
  screen({
    section: 'J01E',
    out: 'j01e',
    dataType: 'J01EVideData',
    liensPlus: [...barreBasse(['MobileVide']), VOIR_TOUS_PUBLICS(['DesktopVide'])],
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
    ],
    donnees: [
      {
        noeud:
          CARTE_MODELE_D('Étudier', '12 étapes', 'De l’admission au VLS-TS validé.') +
          CARTE_MODELE_D('Travailler', '10 étapes', 'Contrat, visa salarié, installation.') +
          CARTE_MODELE_D('Rejoindre ma famille', '9 étapes', 'Regroupement familial et arrivée.'),
        devient:
          '<sc-for list="{{ modeles }}" as="m">' +
          CARTE_MODELE_D('{{ m.nom }}', '{{ m.etapes }} étapes', '{{ m.phrase }}') +
          '</sc-for>',
        frames: ['DesktopVide'],
        why: 'Les types de parcours proposés pour MON pays, de `GET /journey-templates` (§2.1) — le nombre d’étapes vient de `version.stepCount`, jamais de la maquette.',
      },
      {
        noeud:
          CARTE_MODELE_M('Étudier', '12 étapes') +
          CARTE_MODELE_M('Travailler', '10 étapes') +
          CARTE_MODELE_M('Rejoindre ma famille', '9 étapes') +
          CARTE_MODELE_M('Régulariser ma situation', '8 étapes'),
        devient:
          '<sc-for list="{{ modeles }}" as="m">' +
          CARTE_MODELE_M('{{ m.nom }}', '{{ m.etapes }} étapes') +
          '</sc-for>',
        frames: ['MobileVide'],
        why: 'Les mêmes types de parcours, sur le cadre mobile — quatre lignes contiguës, donc une seule liaison.',
      },
    ],
  }),
  screen({
    section: 'J01E',
    out: 'j01e',
    dataType: 'J01EAboutiData',
    liensPlus: [...barreBasse(['MobileAbouti']), 
      NOUVEAU_PARCOURS_POINTILLE(['DesktopAbouti']),
      NOUVEAU_PARCOURS(['MobileAbouti']),
      VOIR_TOUS_PUBLICS(['DesktopAbouti']),
    ],
    frames: [
      f(1440, 'DesktopAbouti', 1, t('Mes études à Lyon', '30px')),
      f(390, 'MobileAbouti', 1, t('Mes études à Lyon', '22px')),
    ],
    donnees: [
      {
        noeud: '>Mes études à Lyon<',
        devient: '>{{ panneau.titre }}<',
        fois: 2,
        frames: ['DesktopAbouti'],
        why: 'Le titre du parcours abouti (`journey.title`) — carte du panneau et titre de la page.',
      },
      {
        noeud: '>PARCOURS ÉTUDES<',
        devient: '>PARCOURS {{ panneau.type }}<',
        frames: ['DesktopAbouti'],
        why: 'Le type du parcours abouti.',
      },
      {
        noeud: '>100%<',
        devient: '>{{ panneau.avancement }}%<',
        frames: ['DesktopAbouti'],
        why: 'L’avancement du parcours abouti, de `journey.progressPct` — pas un 100 écrit en dur.',
      },
      {
        noeud: '>12 / 12 étapes<',
        devient: '>{{ parcours.franchies }} / {{ parcours.total }} étapes<',
        frames: ['DesktopAbouti'],
        why: '`doneCount` sur `totalCount` — hors étapes facultatives (§3.2).',
      },
      {
        noeud: '>12 étapes franchies en 11 mois<',
        devient: '>{{ parcours.franchies }} étapes franchies en {{ parcours.duree }}<',
        frames: ['DesktopAbouti'],
        why: 'Le récapitulatif : `doneCount` et la durée entre la création et `journey.completedAt`.',
      },
      {
        noeud: '>Cotonou → Lyon · abouti le 14 juillet 2027<',
        devient: '>{{ parcours.origine }} → {{ parcours.destination }} · abouti le {{ parcours.aboutiLe }}<',
        frames: ['DesktopAbouti'],
        why: 'Pays d’origine, ville de destination et `journey.completedAt`.',
      },
      {
        noeud:
          LIGNE_FRANCHIE_ABOUTI('Admission Campus France', '3 mois') +
          LIGNE_FRANCHIE_ABOUTI('Visa étudiant', '4 sem.') +
          LIGNE_FRANCHIE_ABOUTI('Logement pérenne', '5 sem.') +
          LIGNE_FRANCHIE_ABOUTI('Valider le VLS-TS', '2 sem.'),
        devient:
          '<sc-for list="{{ frise }}" as="e">' +
          LIGNE_FRANCHIE_ABOUTI('{{ e.titre }}', '{{ e.duree }}') +
          '</sc-for>',
        frames: ['DesktopAbouti'],
        why: 'Les étapes franchies du parcours abouti et leur durée réelle (`steps[].durationDays`).',
      },
      {
        noeud: '>12 ÉTAPES FRANCHIES<',
        devient: '>{{ parcours.franchies }} ÉTAPES FRANCHIES<',
        frames: ['DesktopAbouti'],
        why: 'L’étiquette du bloc de frise, sur le même `doneCount`.',
      },
      {
        noeud: '>11 mois<',
        devient: '>{{ parcours.duree }}<',
        frames: ['DesktopAbouti'],
        why: 'La durée totale du parcours, calculée entre sa création et `journey.completedAt`.',
      },

      // ── Le cadre mobile ───────────────────────────────────────────────────
      {
        noeud: '>PARCOURS ÉTUDES<',
        devient: '>PARCOURS {{ panneau.type }}<',
        frames: ['MobileAbouti'],
        why: 'Le type du parcours abouti, sur le cadre mobile.',
      },
      {
        noeud: '>Mes études à Lyon<',
        devient: '>{{ panneau.titre }}<',
        frames: ['MobileAbouti'],
        why: 'Le titre du parcours abouti, sur le cadre mobile.',
      },
      {
        noeud: '>12 / 12<',
        devient: '>{{ parcours.franchies }} / {{ parcours.total }}<',
        frames: ['MobileAbouti'],
        why: 'Étapes franchies sur étapes comptées, sur le cadre mobile.',
      },
      {
        noeud: '>11 mois<',
        devient: '>{{ parcours.duree }}<',
        frames: ['MobileAbouti'],
        why: 'La durée totale, sur le cadre mobile.',
      },
      {
        noeud:
          LIGNE_FRANCHIE_ABOUTI('Admission Campus France', '3 mois') +
          LIGNE_FRANCHIE_ABOUTI('Visa étudiant', '4 sem.') +
          LIGNE_FRANCHIE_ABOUTI('Logement pérenne', '5 sem.'),
        devient:
          '<sc-for list="{{ frise }}" as="e">' +
          LIGNE_FRANCHIE_ABOUTI('{{ e.titre }}', '{{ e.duree }}') +
          '</sc-for>',
        frames: ['MobileAbouti'],
        why: 'Les étapes franchies, sur le cadre mobile — la maquette en montre trois, l’API en donne autant qu’il y en a.',
      },
    ],
  }),

  /**
   * ── J01S · /parcours/:id/etapes/:etape — l'étape en cours ──────────────────
   *
   * BRANCHÉ SUR `GET /journeys/:id`. L'étape affichée est celle que l'URL nomme si
   * le segment est un identifiant, et l'étape EN COURS du serveur sinon :
   * `/parcours/1/etapes/7` est l'URL des planches d'illustration, et « 7 » n'est
   * pas le rang d'une ligne de base.
   */
  screen({
    section: 'J01S',
    out: 'j01s',
    liensPlus: [...barreBasse(['Mobile']), NOUVEAU_PARCOURS(['Desktop']), VOIR_TOUS_PUBLICS(['Desktop'])],
    panneauDuParcours: true,
    dataType: 'J01SData',
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
    donnees: [
      ...panneau({ titre: 2 }),
      {
        noeud: '>Étape 7 sur 12<',
        devient: '>Étape {{ etape.rang }} sur {{ parcours.total }}<',
        frames: ['Desktop'],
        why: 'Le rang de l’étape et le nombre d’étapes comptées — `steps[].position` et `journey.totalCount`.',
      },
      {
        noeud: '>Trouver un logement pérenne<',
        devient: '>{{ etape.titre }}<',
        frames: ['Desktop'],
        why: 'Le titre de l’étape, de `steps[].title` — c’est aussi le titre de la page.',
      },
      {
        noeud: '>EN COURS<',
        devient: '>{{ etape.etat }}<',
        frames: ['Desktop'],
        why: 'L’état de l’étape (`steps[].status`), sans vocabulaire d’échec (§3.2).',
      },
      {
        noeud:
          '>Constituez votre dossier (garant, justificatifs, attestation d\'hébergement) avant les visites. À Lyon, les studios partent en quelques jours : visitez vite, dossier en main.<',
        devient: '>{{ etape.description }}<',
        frames: ['Desktop'],
        why: 'La description de l’étape, écrite par le modèle (`steps[].description`).',
      },
      {
        noeud: '>3 / 6 actions<',
        devient: '>{{ etape.cochees }} / {{ etape.actions }} actions<',
        frames: ['Desktop'],
        why: 'La checklist de l’étape : cochées sur total (§3.3), rendue au PROPRIÉTAIRE seul (§3.4).',
      },
      {
        noeud: '>Mes études à Lyon · Étape 7 sur 12<',
        devient: '>{{ panneau.titre }} · Étape {{ etape.rang }} sur {{ parcours.total }}<',
        frames: ['Mobile'],
        why: 'Titre du parcours, rang de l’étape et nombre d’étapes, sur l’en-tête mobile.',
      },
      {
        noeud: '>Trouver un logement pérenne<',
        devient: '>{{ etape.titre }}<',
        frames: ['Mobile'],
        why: 'Le titre de l’étape, sur le cadre mobile.',
      },
      {
        noeud: '>EN COURS<',
        devient: '>{{ etape.etat }}<',
        frames: ['Mobile'],
        why: 'L’état de l’étape, sur le cadre mobile.',
      },
      {
        noeud: '>Échéance dans 9 jours<',
        devient: '>Échéance {{ etape.echeance }}<',
        frames: ['Mobile'],
        why: 'L’échéance de l’étape, sur le cadre mobile.',
      },
      {
        noeud: '>3 / 6<',
        devient: '>{{ etape.cochees }} / {{ etape.actions }}<',
        frames: ['Mobile'],
        why: 'La checklist de l’étape, sur le cadre mobile.',
      },
    ],
  }),

  /**
   * ── J01D · /parcours/:id/discussion ────────────────────────────────────────
   *
   * BRANCHÉ SUR `GET /journeys/:id` POUR SON CADRE, ET PAS POUR SES MESSAGES.
   * La conversation de groupe appartient à la messagerie : `journey.
   * groupConversationId` en donne l'identifiant — `null` pour un OBSERVATEUR, que
   * §3.4 n'autorise pas à écrire — et les messages se lisent sur les routes de
   * `conversations`, hors de ce périmètre. Les bulles de la planche restent donc
   * celles de la maquette, et c'est dit.
   */
  screen({
    section: 'J01D',
    out: 'j01d',
    liensPlus: [NOUVEAU_PARCOURS(['Desktop']), VOIR_TOUS_PUBLICS(['Desktop'])],
    panneauDuParcours: true,
    dataType: 'J01DData',
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
    donnees: [
      ...panneau(),
      {
        noeud: '>Mes études à Lyon · 4 membres · privée<',
        devient: '>{{ panneau.titre }} · {{ panneau.equipe }} membres · privée<',
        frames: ['Desktop'],
        why: 'Le parcours et son équipe (§3.4) — la discussion est privée par construction, ce n’est pas une donnée.',
      },
      {
        noeud: '>Discussion · Mes études<',
        devient: '>Discussion · {{ panneau.titre }}<',
        frames: ['Mobile'],
        why: 'Le titre du parcours dans l’en-tête mobile de la discussion.',
      },
    ],
  }),

  // ── J02 · /parcours/nouveau ────────────────────────────────────────────────
  //
  // Le mobile a trois planches : le choix de type, la variante « Régulariser »
  // (§3.1 et T5 — trois sous-situations), et l'état « plan atteint » que §3.1
  // impose (`PLAN_LIMIT_REACHED`) sans bloquer la lecture.
  //
  // BRANCHÉ SUR `GET /journey-templates` ET SUR MON PARCOURS ACTIF.
  //
  // Ce commentaire disait « déjà branché (ses `onClick`), et laissé tel quel ».
  // C'était vrai des GESTES et faux de la LECTURE : les quatre cadres recevaient
  // `ParcoursData`, c'est-à-dire des fonctions et pas une donnée, et les trois qui
  // affichent des types de parcours écrivaient « 12 étapes » en dur.
  //
  // Or `journeyTemplateVersionSchema` porte précisément là-dessus l'avertissement
  // le plus net du dossier : « La maquette de O03 écrit "12 étapes" sous
  // "Étudier" : c'est une ILLUSTRATION. L'API répond 15 pour `STUDIES`, parce que
  // le modèle a été rechargé en version 3. Recopier le nombre de la maquette
  // afficherait un engagement faux au moment précis où le membre choisit son
  // parcours. » J01E lisait déjà ces modèles ; J02, l'écran qui s'appelle « Créer
  // un parcours », ne les lisait pas.
  //
  // LE PANNEAU DU CADRE D'ORDINATEUR EST LIÉ AUSSI, et sans son compteur d'équipe :
  // voir `panneau({ equipe: false })` et la raison comptée qui s'y trouve. Sur un
  // membre sans parcours, il se remplit de vide — ce qui est le cas NORMAL de cet
  // écran, et honnête : la carte reste dessinée, ses valeurs sont absentes, et
  // elle n'annonce plus un « Mes études à Lyon · 58% » que personne n'a créé.
  screen({
    section: 'J02',
    out: 'j02',
    liensPlus: [NOUVEAU_PARCOURS(['Desktop']), VOIR_TOUS_PUBLICS(['Desktop'])],
    dataType: 'J02Data',
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
    donnees: [
      ...panneau({ titre: 2, equipe: false }),
      {
        noeud:
          CARTE_TYPE_M_CHOISIE('Étudier', '12 étapes') +
          CARTE_TYPE_M_SIMPLE('Travailler', '10 étapes') +
          CARTE_TYPE_M_SIMPLE('Rejoindre ma famille', '9 étapes') +
          CARTE_TYPE_M_SIMPLE('Régulariser ma situation', '8 étapes'),
        devient:
          '<sc-for list="{{ modeles }}" as="m">' +
          '<sc-if value="{{ m.choisi }}">' +
          CARTE_TYPE_M_CHOISIE('{{ m.nom }}', '{{ m.etapes }} étapes') +
          '</sc-if><sc-if value="{{ m.autre }}">' +
          CARTE_TYPE_M_SIMPLE('{{ m.nom }}', '{{ m.etapes }} étapes') +
          '</sc-if></sc-for>',
        fois: 1,
        frames: ['Mobile'],
        why: 'Les types de parcours proposés pour MON pays, de `GET /journey-templates` (§2.1) — `version.stepCount` et jamais le nombre de la maquette, qui est une illustration. Les DEUX variantes de carte sont dessinées, chacune sous sa condition.',
      },
      {
        noeud:
          LIGNE_TYPE_PLAN('Étudier · 12 étapes') +
          LIGNE_TYPE_PLAN('Travailler · 10 étapes') +
          LIGNE_TYPE_PLAN('Rejoindre ma famille · 9 étapes'),
        devient:
          '<sc-for list="{{ modeles }}" as="m">' +
          LIGNE_TYPE_PLAN('{{ m.nom }} · {{ m.etapes }} étapes') +
          '</sc-for>',
        fois: 1,
        frames: ['MobilePlanAtteint'],
        why: 'Les mêmes types, sur la planche « plan atteint » — §3.1 veut que la limite du plan NE BLOQUE PAS LA LECTURE, donc leurs nombres d’étapes doivent être vrais eux aussi.',
      },
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

  /**
   * ── J05 · /parcours/:id/equipe ─────────────────────────────────────────────
   *
   * BRANCHÉ SUR `GET /journeys/:id` — `members` et `journey.owner`.
   *
   * ÉCART DE LA MAQUETTE, SIGNALÉ ET NON COMBLÉ : elle dessine QUATRE rôles —
   * Propriétaire, Parraine, Accompagnant, Observatrice. `JourneyMemberRole` n'en
   * connaît que DEUX, `SUPPORTER` et `OBSERVER` ; le propriétaire n'est pas un
   * membre (il n'est pas dans `members`), et « parrain » est un rôle du PARRAINAGE,
   * que les routes de parcours ne portent pas. `data.ts` rend donc trois libellés
   * — Propriétaire, Accompagnant, Observateur — et la pastille orange « Parraine »
   * de la maquette n'a pas de donnée qui la déclenche.
   */
  screen({
    section: 'J05',
    out: 'j05',
    liensPlus: [...barreBasse(['Mobile']), NOUVEAU_PARCOURS(['Desktop']), VOIR_TOUS_PUBLICS(['Desktop'])],
    panneauDuParcours: true,
    dataType: 'J05Data',
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
    donnees: [
      {
        noeud:
          LIGNE_EQUIPE_D(
            '#B4581F',
            'AD',
            'Amina Diallo (vous)',
            'depuis le 2 janvier',
            '#0F5C48',
            '#fff',
            'Propriétaire',
            '',
          ) +
          LIGNE_EQUIPE_D(
            '#16785E',
            'AI',
            'Aïcha Diop',
            'Parraine · depuis le 14 février',
            '#FBE3D4',
            '#B4581F',
            'Parraine',
            MENU_MEMBRE,
          ) +
          LIGNE_EQUIPE_D(
            '#0F5C48',
            'MD',
            'Moussa Diallo',
            'depuis le 3 janvier',
            '#E3F0EB',
            '#0F5C48',
            'Accompagnant',
            BOUTON_RETIRER,
          ) +
          LIGNE_EQUIPE_D(
            '#2FA37D',
            'FD',
            'Fanta Diallo',
            'depuis le 3 janvier',
            '#F2F5F4',
            '#5D6B66',
            'Observatrice',
            BOUTON_RETIRER,
          ),
        devient:
          '<sc-for list="{{ equipe }}" as="m">' +
          LIGNE_EQUIPE_D(
            '{{ m.fond }}',
            '{{ m.initiales }}',
            '{{ m.nom }}',
            '{{ m.depuis }}',
            '{{ m.badgeFond }}',
            '{{ m.badgeTexte }}',
            '{{ m.role }}',
            '<sc-if value="{{ m.menu }}">' +
              MENU_MEMBRE +
              '</sc-if><sc-if value="{{ m.retirable }}">' +
              BOUTON_RETIRER +
              '</sc-if>',
          ) +
          '</sc-for>',
        frames: ['Desktop'],
        why: 'L’équipe du parcours (§3.4) : le propriétaire puis `members`. Le propriétaire n’a ni menu ni retrait — on ne se retire pas de son propre parcours.',
      },
      ...panneau(),
      {
        noeud: '>Les personnes qui suivent « Mes études à Lyon »<',
        devient: '>Les personnes qui suivent « {{ panneau.titre }} »<',
        frames: ['Desktop'],
        why: 'Le sous-titre de la page nomme le parcours (`journey.title`).',
      },
      {
        noeud:
          LIGNE_EQUIPE_M_PREMIERE('#B4581F', 'AD', 'Amina (vous)', '#0F5C48', '#fff', 'Propriétaire') +
          LIGNE_EQUIPE_M_SUIVANTE('#16785E', 'AI', 'Aïcha Diop', '#FBE3D4', '#B4581F', 'Parraine') +
          LIGNE_EQUIPE_M_SUIVANTE('#0F5C48', 'MD', 'Moussa Diallo', '#E3F0EB', '#0F5C48', 'Accompagnant') +
          LIGNE_EQUIPE_M_SUIVANTE('#2FA37D', 'FD', 'Fanta Diallo', '#F2F5F4', '#5D6B66', 'Observatrice'),
        devient:
          '<sc-for list="{{ equipe }}" as="m">' +
          '<sc-if value="{{ m.premiere }}">' +
          LIGNE_EQUIPE_M_PREMIERE(
            '{{ m.fond }}',
            '{{ m.initiales }}',
            '{{ m.nom }}',
            '{{ m.badgeFond }}',
            '{{ m.badgeTexte }}',
            '{{ m.role }}',
          ) +
          '</sc-if><sc-if value="{{ m.suivante }}">' +
          LIGNE_EQUIPE_M_SUIVANTE(
            '{{ m.fond }}',
            '{{ m.initiales }}',
            '{{ m.nom }}',
            '{{ m.badgeFond }}',
            '{{ m.badgeTexte }}',
            '{{ m.role }}',
          ) +
          '</sc-if></sc-for>',
        frames: ['Mobile'],
        why: 'La même équipe sur le cadre mobile. DEUX variantes dessinées en entier : la maquette ne trace pas de filet au-dessus de la première ligne, et une interpolation posée là où va une déclaration de style entière est JETÉE EN SILENCE par `transcode` — mesuré, voir le commentaire de `LIGNE_EQUIPE_M`.',
      },
    ],
  }),
  /**
   * La feuille « Inviter dans l'équipe » n'a PAS de planche d'ordinateur : la
   * maquette ne la dessine qu'en mobile. On ne lui en invente pas une — la même
   * feuille sert aux deux largeurs, et `Modal` le dit dans son type.
   *
   * AUCUNE DONNÉE LIÉE, et ce n'est pas un renoncement : ses deux suggestions sont
   * des CONTACTS du membre (`GET /me/connections`, module Compte) et ses trois
   * libellés de rôle sont du texte de règle. Aucune route de `journeys` ne les
   * porte. Signalé.
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

  /**
   * ── J06 · /parcours/:id/documents ──────────────────────────────────────────
   *
   * §3.3 : aucun fichier en V1 — « Cochez ce que vous avez réuni. Les documents
   * restent chez vous. » La maquette ne dessine aucun dépôt de fichier, et le
   * schéma de `@app/shared` est `.strict()` pour que l'ajout d'un `fileKey` côté
   * serveur soit un ÉCHEC bruyant plutôt qu'un champ dépouillé en silence.
   *
   * LA PHRASE DU BANDEAU VIENT DU SERVEUR (`meta.checklistNotice`) et non d'un
   * texte d'écran : c'est la règle dure de §3.3, et elle est écrite UNE fois, côté
   * API, pour toutes les routes de parcours.
   */
  screen({
    section: 'J06',
    out: 'j06',
    liensPlus: [...barreBasse(['Mobile']), NOUVEAU_PARCOURS(['Desktop']), VOIR_TOUS_PUBLICS(['Desktop'])],
    panneauDuParcours: true,
    dataType: 'J06Data',
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
    donnees: [
      ...panneau(),
      {
        noeud: '>Cochez ce que vous avez réuni. Les documents restent chez vous.<',
        devient: '>{{ bandeau }}<',
        frames: ['Desktop'],
        why: 'La phrase de §3.3, servie par `meta.checklistNotice` — elle appartient à l’API, pas à l’écran.',
      },
      {
        noeud: '>Étape 7 · Logement<',
        devient: '>Étape {{ etape.rang }} · {{ etape.titre }}<',
        frames: ['Desktop'],
        why: 'L’étape dont la checklist est dépliée : rang et titre, de `steps[]`.',
      },
      {
        noeud: '>3 / 6<',
        devient: '>{{ etape.cochees }} / {{ etape.actions }}<',
        frames: ['Desktop'],
        why: 'Documents cochés sur documents listés, de `steps[].checklist` — rendu au PROPRIÉTAIRE seul (§3.4).',
      },
      {
        noeud:
          DOC_COCHE_D('Pièce d’identité') +
          DOC_COCHE_D('Attestation Visale') +
          DOC_COCHE_D('Certificat de scolarité') +
          DOC_A_FAIRE_D('Trois dernières quittances') +
          DOC_A_FAIRE_D('Attestation de bourse') +
          DOC_A_FAIRE_D('RIB français'),
        devient:
          '<sc-for list="{{ documents }}" as="d">' +
          '<sc-if value="{{ d.coche }}">' +
          DOC_COCHE_D('{{ d.libelle }}') +
          '</sc-if><sc-if value="{{ d.aFaire }}">' +
          DOC_A_FAIRE_D('{{ d.libelle }}') +
          '</sc-if></sc-for>',
        frames: ['Desktop'],
        why: 'La checklist de l’étape (§3.3) : les DEUX variantes dessinées sont gardées, cochée et à faire — n’en garder qu’une laisserait tout coché.',
      },
      {
        noeud:
          GROUPE_REPLIE_D('Étape 6 · Caution bancaire et AVI', '4 / 4', '#16785E', '100%', '#16785E') +
          GROUPE_REPLIE_D('Étape 8 · Assurance habitation', '0 / 3', '#B4581F', '0%', '#E0733A'),
        devient:
          '<sc-for list="{{ autresEtapes }}" as="g">' +
          GROUPE_REPLIE_D(
            '{{ g.titre }}',
            '{{ g.compte }}',
            '{{ g.teinteCompte }}',
            '{{ g.barre }}',
            '{{ g.teinteBarre }}',
          ) +
          '</sc-for>',
        frames: ['Desktop'],
        why: 'Les autres étapes qui ont une checklist, repliées. Les deux teintes sont des DONNÉES parce que la maquette distingue une checklist complète (vert) d’une incomplète (orange).',
      },
      {
        noeud: '>Cochez ce que vous avez réuni. Les documents restent chez vous.<',
        devient: '>{{ bandeau }}<',
        frames: ['Mobile'],
        why: 'La phrase de §3.3, sur le cadre mobile.',
      },
      {
        noeud: '>Étape 7 · Logement<',
        devient: '>Étape {{ etape.rang }} · {{ etape.titre }}<',
        frames: ['Mobile'],
        why: 'L’étape dépliée, sur le cadre mobile.',
      },
      {
        noeud: '>3/6<',
        devient: '>{{ etape.cochees }}/{{ etape.actions }}<',
        frames: ['Mobile'],
        why: 'Documents cochés sur listés, sur le cadre mobile (la maquette y écrit « 3/6 » sans espaces).',
      },
      {
        noeud:
          DOC_COCHE_M('Pièce d’identité') +
          DOC_COCHE_M('Attestation Visale') +
          DOC_COCHE_M('Certificat de scolarité') +
          DOC_A_FAIRE_M('Trois quittances') +
          DOC_A_FAIRE_M('RIB français'),
        devient:
          '<sc-for list="{{ documents }}" as="d">' +
          '<sc-if value="{{ d.coche }}">' +
          DOC_COCHE_M('{{ d.libelle }}') +
          '</sc-if><sc-if value="{{ d.aFaire }}">' +
          DOC_A_FAIRE_M('{{ d.libelle }}') +
          '</sc-if></sc-for>',
        frames: ['Mobile'],
        why: 'La checklist de l’étape sur le cadre mobile, avec ses deux variantes.',
      },
      {
        noeud:
          GROUPE_REPLIE_M('Étape 6 · AVI', '4/4', '#16785E', '100%', '#16785E') +
          GROUPE_REPLIE_M('Étape 8 · Assurance', '0/3', '#B4581F', '0%', '#E0733A'),
        devient:
          '<sc-for list="{{ autresEtapes }}" as="g">' +
          GROUPE_REPLIE_M(
            '{{ g.titre }}',
            '{{ g.compteCourt }}',
            '{{ g.teinteCompte }}',
            '{{ g.barre }}',
            '{{ g.teinteBarre }}',
          ) +
          '</sc-for>',
        frames: ['Mobile'],
        why: 'Les autres étapes repliées, sur le cadre mobile.',
      },
    ],
  }),

  /**
   * ── J07 · /parcours/:id/historique ─────────────────────────────────────────
   *
   * BRANCHÉ SUR `GET /journeys/:id/activities` (§3.8) — la SEULE liste paginée par
   * curseur de ce module, et réservée au PROPRIÉTAIRE : §3.4 donne aux
   * accompagnants les étapes et la progression, pas le journal.
   */
  screen({
    section: 'J07',
    out: 'j07',
    liensPlus: [...barreBasse(['Mobile']), NOUVEAU_PARCOURS(['Desktop']), VOIR_TOUS_PUBLICS(['Desktop'])],
    panneauDuParcours: true,
    dataType: 'J07Data',
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
    donnees: [
      {
        noeud:
          LIGNE_JOURNAL_D(
            IC('17', TRACE_ETAPE),
            'Étape 7 · Logement commencée',
            'Échéance fixée au 30 septembre',
            'hier',
            '',
          ) +
          LIGNE_JOURNAL_D(
            IC('17', TRACE_ENTRAIDE),
            'Demande d’entraide publiée : garant pour un studio',
            '3 réponses',
            'il y a 2 j',
            LIEN_VOIR,
          ) +
          LIGNE_JOURNAL_D(
            IC('17', TRACE_FRANCHIE),
            'Étape 6 · Caution bancaire et AVI franchie',
            'en 2 semaines',
            'il y a 3 sem.',
            '',
          ) +
          LIGNE_JOURNAL_D(
            IC('17', TRACE_JALON),
            'Jalon partagé : Visa étudiant',
            '42 félicitations',
            'il y a 1 mois',
            LIEN_VOIR,
          ) +
          LIGNE_JOURNAL_D(
            IC('17', TRACE_EQUIPE),
            'Aïcha Diop a rejoint votre équipe comme parraine',
            '',
            '14 février',
            '',
          ),
        devient:
          '<sc-for list="{{ journal }}" as="a">' +
          LIGNE_JOURNAL_D(
            '<sc-if value="{{ a.icEtape }}">' +
              IC('17', TRACE_ETAPE) +
              '</sc-if><sc-if value="{{ a.icEntraide }}">' +
              IC('17', TRACE_ENTRAIDE) +
              '</sc-if><sc-if value="{{ a.icFranchie }}">' +
              IC('17', TRACE_FRANCHIE) +
              '</sc-if><sc-if value="{{ a.icJalon }}">' +
              IC('17', TRACE_JALON) +
              '</sc-if><sc-if value="{{ a.icEquipe }}">' +
              IC('17', TRACE_EQUIPE) +
              '</sc-if>',
            '{{ a.titre }}',
            '{{ a.detail }}',
            '{{ a.quand }}',
            '<sc-if value="{{ a.lien }}">' + LIEN_VOIR + '</sc-if>',
          ) +
          '</sc-for>',
        motifs: [LIEN_VOIR],
        frames: ['Desktop'],
        why: 'Le journal du parcours (§3.8), de `GET /journeys/:id/activities`. CINQ icônes dessinées, une par famille d’activité — `LIEN_VOIR` est déclaré en « motifs » parce que la maquette ne le dessine qu’aux deuxième et quatrième lignes, donc après la dernière icône.',
      },
      ...panneau(),
      {
        noeud:
          LIGNE_JOURNAL_M(IC('15', TRACE_ETAPE), 'Étape 7 · Logement commencée', 'hier') +
          LIGNE_JOURNAL_M(IC('15', TRACE_ENTRAIDE), 'Demande d’entraide publiée', 'il y a 2 j · 3 réponses') +
          LIGNE_JOURNAL_M(IC('15', TRACE_FRANCHIE), 'Étape 6 · AVI franchie', 'il y a 3 sem. · en 2 sem.') +
          LIGNE_JOURNAL_M(IC('15', TRACE_JALON), 'Jalon partagé : Visa étudiant', 'il y a 1 mois · 42 félicitations') +
          LIGNE_JOURNAL_M(IC('15', TRACE_EQUIPE), 'Aïcha a rejoint votre équipe', '14 février'),
        devient:
          '<sc-for list="{{ journal }}" as="a">' +
          LIGNE_JOURNAL_M(
            '<sc-if value="{{ a.icEtape }}">' +
              IC('15', TRACE_ETAPE) +
              '</sc-if><sc-if value="{{ a.icEntraide }}">' +
              IC('15', TRACE_ENTRAIDE) +
              '</sc-if><sc-if value="{{ a.icFranchie }}">' +
              IC('15', TRACE_FRANCHIE) +
              '</sc-if><sc-if value="{{ a.icJalon }}">' +
              IC('15', TRACE_JALON) +
              '</sc-if><sc-if value="{{ a.icEquipe }}">' +
              IC('15', TRACE_EQUIPE) +
              '</sc-if>',
            '{{ a.titre }}',
            '{{ a.ligneMobile }}',
          ) +
          '</sc-for>',
        frames: ['Mobile'],
        why: 'Le même journal sur le cadre mobile, qui replie la date et le détail sur une seule ligne.',
      },
    ],
  }),
  /**
   * AUCUNE DONNÉE LIÉE : les trois phrases de cette feuille sont des RÈGLES
   * (« Réservé à Premium », « Un PDF avec vos étapes, durées et documents
   * cochés. »), vraies pour tout le monde. T5 J07. Signalé.
   */
  screen({
    section: 'J07',
    out: 'j07export',
    modal: true,
    modalTitle: 'Exporter mon parcours',
    frames: [f(390, 'MobileExport', 1)],
  }),

  /**
   * ── J08 · /parcours/:id/reglages ───────────────────────────────────────────
   *
   * BRANCHÉ SUR `GET /journeys/:id`. L'écriture — `PATCH /journeys/:id` — n'est PAS
   * câblée : le générateur ne reconnaît ni « Mettre à jour », ni « Mettre en
   * pause », ni « Arrêter », donc aucun `onClick` n'est posé sur ces boutons. Un
   * bouton inerte est moins nuisible qu'un bouton qui ment, et « Arrêter » est
   * irréversible (§3.9). Signalé.
   */
  screen({
    section: 'J08',
    out: 'j08',
    liensPlus: [...barreBasse(['Mobile']), NOUVEAU_PARCOURS(['Desktop']), VOIR_TOUS_PUBLICS(['Desktop'])],
    panneauDuParcours: true,
    dataType: 'J08Data',
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
    donnees: [
      ...panneau({ titre: 2 }),
      {
        noeud: '>12 septembre 2026<',
        devient: '>{{ parcours.depart }}<',
        frames: ['Desktop'],
        why: 'La date d’arrivée cible (`journey.targetArrivalDate`), §3.1.',
      },
      {
        noeud: '>Parcours Études · version 2026<',
        devient: '>Parcours {{ panneau.typeNom }} · version {{ parcours.version }}<',
        frames: ['Desktop'],
        why: 'Le modèle et sa version (`journey.template.nameFr`, `journey.templateVersion`) — §2.4, le bandeau « nouvelle version » en dépend.',
      },
      {
        noeud: '>Arrêter « Mes études à Lyon » ?<',
        devient: '>Arrêter « {{ panneau.titre }} » ?<',
        frames: ['Desktop'],
        why: 'La confirmation d’arrêt nomme le parcours — §3.9, « sans vocabulaire d’échec ».',
      },
      {
        noeud:
          '>Votre projet a évolué, c\'est normal. Vos 6 étapes franchies restent dans votre historique et vous pourrez créer un autre parcours.<',
        devient:
          '>Votre projet a évolué, c\'est normal. Vos {{ parcours.franchies }} étapes franchies restent dans votre historique et vous pourrez créer un autre parcours.<',
        frames: ['Desktop'],
        why: 'Le nombre d’étapes franchies conservées (`journey.doneCount`) : l’arrêt archive, il ne supprime pas (§3.9).',
      },
      {
        noeud: '>Mes études à Lyon<',
        devient: '>{{ panneau.titre }}<',
        frames: ['Mobile'],
        why: 'Le champ « Nom » des réglages, sur le cadre mobile.',
      },
    ],
  }),
  screen({
    section: 'J08',
    out: 'j08arret',
    dataType: 'J08ArretData',
    modal: true,
    // §3.9 : « confirmation sans vocabulaire d'échec ». Le titre de la maquette
    // s'y tient, et il est recopié tel quel — guillemets français compris. Il est
    // DEVENU UNE DONNÉE : `retitrerSurDonnees` le reprend sur sa forme liée.
    modalTitle: 'Arrêter « Mes études à Lyon » ?',
    frames: [f(390, 'MobileArret', 1)],
    donnees: [
      {
        noeud: '>Arrêter « Mes études à Lyon » ?<',
        devient: '>Arrêter « {{ panneau.titre }} » ?<',
        why: 'Le titre de la feuille nomme le parcours (`journey.title`) : on ne demande pas d’arrêter « un parcours ».',
      },
      {
        noeud:
          '>Votre projet a évolué, c\'est normal. Vos 6 étapes franchies restent dans votre historique.<',
        devient:
          '>Votre projet a évolué, c\'est normal. Vos {{ parcours.franchies }} étapes franchies restent dans votre historique.<',
        why: 'Le nombre d’étapes franchies conservées (`journey.doneCount`), §3.9.',
      },
    ],
  }),

  /**
   * ── J09 · /parcours/publics et /parcours/publics/:id ───────────────────────
   *
   * La maquette donne UNE planche d'ordinateur (la liste) et DEUX planches
   * mobiles : la liste, puis la vue d'un parcours public. Cette seconde vue n'a
   * donc pas de forme d'ordinateur dessinée ; la page le dit et n'en invente pas.
   *
   * DEUX DÉCLARATIONS, parce que les deux états lisent DEUX ROUTES :
   * `GET /journeys/public` pour la liste, `GET /journeys/public/:id` pour la fiche.
   * Et elles n'ont PAS la même forme — la fiche porte `currentStep`, la liste non.
   *
   * AUCUNE DE CES ROUTES N'EST `@PublicRead` : le contrôleur le dit, et §3.7 avec
   * lui — « un parcours public n'est jamais visible hors connexion ni indexé ».
   * « Public » veut dire « visible des MEMBRES CONNECTÉS ». La page s'assure donc de
   * la session AVANT de lire, sinon le premier appel part sans jeton.
   */
  screen({
    section: 'J09',
    out: 'j09',
    dataType: 'J09Data',
    liensPlus: [...barreBasse(['Mobile']), NOUVEAU_PARCOURS(['Desktop']), VOIR_TOUS_PUBLICS(['Desktop'])],
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
    ],
    donnees: [
      {
        noeud:
          CARTE_PUBLIQUE_D(
            '#2FA37D',
            'FN',
            'Fatou Ndiaye',
            'Études · Lyon 7e',
            '82%',
            'En cours : Valider le VLS-TS',
            SEGMENT_D('#16785E', '#16211D', 'Admission', '3 mois') +
              SEGMENT_D('#16785E', '#16211D', 'Visa', '5 sem.') +
              SEGMENT_D('#16785E', '#16211D', 'AVI', '1 sem.') +
              SEGMENT_D('#16785E', '#16211D', 'Logement', '3 sem.') +
              SEGMENT_D('#E0733A', '#16211D', 'VLS-TS', ''),
            BOUTON_PARRAIN_D,
          ) +
          CARTE_PUBLIQUE_D(
            '#B4581F',
            'IS',
            'Ibrahim Sow',
            'Études · Bordeaux',
            '64%',
            'En cours : Logement',
            SEGMENT_D('#16785E', '#16211D', 'Admission', '3 mois') +
              SEGMENT_D('#16785E', '#16211D', 'Visa', '4 sem.') +
              SEGMENT_D('#16785E', '#16211D', 'AVI', '2 sem.') +
              SEGMENT_D('#E0733A', '#16211D', 'Logement', '') +
              SEGMENT_D('#E6EBE9', '#8A958F', 'CAF', ''),
            '',
          ),
        devient:
          '<sc-for list="{{ publics }}" as="p">' +
          CARTE_PUBLIQUE_D(
            '{{ p.fond }}',
            '{{ p.initiales }}',
            '{{ p.nom }}',
            '{{ p.sousTitre }}',
            '{{ p.pourcent }}',
            '{{ p.enCours }}',
            '<sc-for list="{{ p.segments }}" as="s">' +
              SEGMENT_D('{{ s.teinte }}', '{{ s.teinteTitre }}', '{{ s.titre }}', '{{ s.duree }}') +
              '</sc-for>',
            '<sc-if value="{{ p.parrainable }}">' + BOUTON_PARRAIN_D + '</sc-if>',
          ) +
          '</sc-for>',
        frames: ['Desktop'],
        why: 'Les parcours publics d’autres membres (§3.7), de `GET /journeys/public` : handle, type, ville, étapes franchies avec leur durée. Jamais le titre personnel — le schéma est `.strict()` pour que l’inverse soit un échec bruyant.',
      },
      ...panneau(),
      {
        noeud: '>14 membres suivent un parcours Études vers Lyon<',
        devient:
          '>{{ compte }} membres suivent un parcours {{ filtre.type }} vers {{ filtre.ville }}<',
        frames: ['Desktop'],
        why: 'Le nombre de parcours publics rendus et les deux filtres actifs — `items.length` et la requête, pas un nombre de maquette.',
      },
      {
        noeud:
          CARTE_PUBLIQUE_M(
            '#2FA37D',
            'FN',
            'Fatou Ndiaye',
            'Études · Lyon 7e',
            '82%',
            SEGMENT_M('#16785E') +
              SEGMENT_M('#16785E') +
              SEGMENT_M('#16785E') +
              SEGMENT_M('#16785E') +
              SEGMENT_M('#E0733A') +
              SEGMENT_M('#E6EBE9'),
            'En cours : VLS-TS',
            BOUTON_PARRAIN_M,
          ) +
          CARTE_PUBLIQUE_M(
            '#B4581F',
            'IS',
            'Ibrahim Sow',
            'Études · Bordeaux',
            '64%',
            SEGMENT_M('#16785E') +
              SEGMENT_M('#16785E') +
              SEGMENT_M('#16785E') +
              SEGMENT_M('#16785E') +
              SEGMENT_M('#E0733A') +
              SEGMENT_M('#E6EBE9'),
            'En cours : Logement',
            '',
          ),
        devient:
          '<sc-for list="{{ publics }}" as="p">' +
          CARTE_PUBLIQUE_M(
            '{{ p.fond }}',
            '{{ p.initiales }}',
            '{{ p.nom }}',
            '{{ p.sousTitre }}',
            '{{ p.pourcent }}',
            '<sc-for list="{{ p.segments }}" as="s">' + SEGMENT_M('{{ s.teinte }}') + '</sc-for>',
            '{{ p.enCours }}',
            '<sc-if value="{{ p.parrainable }}">' + BOUTON_PARRAIN_M + '</sc-if>',
          ) +
          '</sc-for>',
        frames: ['Mobile'],
        why: 'Les mêmes parcours publics sur le cadre mobile, dont la frise ne garde que les barres.',
      },
      {
        noeud: '>14 membres suivent un parcours Études vers Lyon<',
        devient:
          '>{{ compte }} membres suivent un parcours {{ filtre.type }} vers {{ filtre.ville }}<',
        frames: ['Mobile'],
        why: 'Le compte et les filtres, sur le cadre mobile.',
      },
    ],
  }),
  screen({
    section: 'J09',
    out: 'j09',
    dataType: 'J09FicheData',
    modal: false,
    frames: [f(390, 'MobileFiche', 1, t('Parcours de Fatou', '16px'))],
    donnees: [
      {
        noeud: '>Parcours de Fatou<',
        devient: '>Parcours de {{ membre.prenom }}<',
        frames: ['MobileFiche'],
        why: 'L’en-tête nomme le membre par son nom affiché (`member.displayName`) — jamais son identifiant interne (§3.7).',
      },
      {
        noeud: '>Fatou Ndiaye<',
        devient: '>{{ membre.nom }}<',
        frames: ['MobileFiche'],
        why: 'Le nom affiché du membre, de `GET /journeys/public/:id`.',
      },
      {
        noeud: '>FN<',
        devient: '>{{ membre.initiales }}<',
        frames: ['MobileFiche'],
        why: 'Les initiales de l’avatar de repli, dérivées du nom affiché.',
      },
      {
        noeud: '>Parcours Études · Lyon<',
        devient: '>Parcours {{ membre.type }} · {{ membre.ville }}<',
        frames: ['MobileFiche'],
        why: 'Le type de parcours et la ville de destination — les seuls noms que §3.7 autorise à sortir.',
      },
      {
        noeud: '>82%<',
        devient: '>{{ membre.pourcent }}<',
        frames: ['MobileFiche'],
        why: 'L’avancement du parcours public (`progressPct`).',
      },
      {
        noeud:
          ETAPE_PUBLIQUE_FICHE('Admission Campus France', '3 mois') +
          ETAPE_PUBLIQUE_FICHE('Visa étudiant', '5 sem.') +
          ETAPE_PUBLIQUE_FICHE('Caution bancaire et AVI', '1 sem.') +
          ETAPE_PUBLIQUE_FICHE('Logement', '3 sem.'),
        devient:
          '<sc-for list="{{ franchies }}" as="e">' +
          ETAPE_PUBLIQUE_FICHE('{{ e.titre }}', '{{ e.duree }}') +
          '</sc-for>',
        frames: ['MobileFiche'],
        why: 'Les étapes franchies et leur durée (`completedSteps[]`) — la liste FERMÉE de §3.7, sans notes, checklist, équipe ni discussion.',
      },
      {
        noeud: '>Valider le VLS-TS<',
        devient: '>{{ membre.enCours }}<',
        frames: ['MobileFiche'],
        why: 'L’étape en cours, que la FICHE rend (`currentStep.title`) et que la LISTE ne rend pas — deux formes, deux schémas.',
      },
      {
        noeud: '>Écrire à Fatou<',
        devient: '>Écrire à {{ membre.prenom }}<',
        frames: ['MobileFiche'],
        why: 'Le bouton nomme le membre : son prénom vient du nom affiché.',
      },
    ],
  }),

  /**
   * ── J10 · /parcours/:id/abouti ─────────────────────────────────────────────
   *
   * « Plein écran calme » : cette planche d'ordinateur n'a ni rail ni `<main>`,
   * contrairement aux autres. Le générateur pose donc le repère lui-même.
   *
   * BRANCHÉ SUR `GET /journeys/:id`. « 9 aides reçues » n'est PAS lié : aucune
   * route de parcours ne compte les aides reçues — `GET /journeys/:id/activities`
   * porte un type `HELP_RECEIVED`, mais le journal est paginé et son total n'est
   * pas rendu. Signalé plutôt que deviné.
   */
  screen({
    section: 'J10',
    out: 'j10',
    dataType: 'J10Data',
    /**
     * PAS DE RAIL SUR J10, et ce n'est pas une modale : c'est la planche « Vous y
     * êtes arrivé·e ! », que la maquette dessine en PLEIN CADRE, sans rail ni
     * panneau — un parcours abouti se fête sans menu autour. Compté sur le cadre :
     * zéro `<nav>` de 76 px. Sans cette exception, la génération s'arrêterait en
     * nommant J10, ce qui est le bon comportement mais pas la bonne réponse.
     */
    squelette: false,
    frames: [
      f(1440, 'Desktop', 0, t('Vous y êtes arrivé·e !', '38px')),
      f(390, 'Mobile', 0, t('Vous y êtes arrivé·e !', '28px')),
    ],
    donnees: [
      {
        noeud: '>Mes études à Lyon · parcours Études abouti<',
        devient: '>{{ panneau.titre }} · parcours {{ panneau.typeNom }} abouti<',
        frames: ['Desktop'],
        why: 'Le titre personnel et le type du parcours abouti.',
      },
      {
        noeud: '>11 mois<',
        devient: '>{{ parcours.duree }}<',
        frames: ['Desktop'],
        why: 'La durée totale, entre la création et `journey.completedAt`.',
      },
      {
        noeud: '>12 / 12<',
        devient: '>{{ parcours.franchies }} / {{ parcours.total }}<',
        frames: ['Desktop'],
        why: '`doneCount` sur `totalCount` — hors étapes facultatives (§3.2).',
      },
      {
        noeud: '>Mes études à Lyon · abouti<',
        devient: '>{{ panneau.titre }} · abouti<',
        frames: ['Mobile'],
        why: 'Le titre du parcours abouti, sur le cadre mobile.',
      },
      {
        noeud: '>11 mois<',
        devient: '>{{ parcours.duree }}<',
        frames: ['Mobile'],
        why: 'La durée totale, sur le cadre mobile.',
      },
      {
        noeud: '>12/12<',
        devient: '>{{ parcours.franchies }}/{{ parcours.total }}<',
        frames: ['Mobile'],
        why: 'Étapes franchies sur étapes comptées, sur le cadre mobile.',
      },
    ],
  }),

  /**
   * ── J11 · /parcours — mes parcours ─────────────────────────────────────────
   *
   * BRANCHÉ SUR `GET /journeys` — la forme de la LISTE, et pas celle du détail.
   *
   * LA LIMITE DU PLAN EST UNE DONNÉE ICI, et c'est la règle dure de §3.1 rendue
   * VISIBLE : « 1 parcours actif sur 1 avec le plan gratuit ». Le dénominateur
   * vient de `JOURNEY_FREE_ACTIVE_LIMIT` dans `@app/shared` — la même constante que
   * le serveur applique avant de répondre `422 PLAN_LIMIT_REACHED`. Une borne
   * écrite à la main dans l'écran aurait divergé le jour où le plan change, et
   * l'écran aurait annoncé une limite que le serveur n'applique plus.
   */
  screen({
    section: 'J11',
    /**
     * LA CARTE SORT DE SON CADRE — voir `composants` sur A01 pour le pourquoi.
     *
     * Le porteur : « pour tous les tabs il reprend le design des éléments
     * présentés de la façon dont ils sont présentés sur les pages d'origine ».
     * Le profil public monte donc CETTE carte-ci, pas une copie.
     */
    composants: [
      {
        nom: 'CarteParcours',
        depuis: 'actifs',
        as: 'p',
        type: 'CarteParcours',
        cadres: ['Desktop', 'Mobile'],
      },
    ],
    out: 'j11',
    liensPlus: [...barreBasse(['Mobile', 'MobileVide']), NOUVEAU_PARCOURS(['Desktop']), VOIR_TOUS_PUBLICS(['Desktop'])],
    dataType: 'J11Data',
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
    donnees: [
      {
        noeud:
          CARTE_PARCOURS_D(
            'PARCOURS ÉTUDES',
            PASTILLE_ACTIF,
            'Mes études à Lyon',
            'Dernière activité hier · étape 7 Logement',
            '58%',
            '58%',
            '#E0733A',
          ) +
          CARTE_PARCOURS_D(
            'PARCOURS FAMILLE',
            PASTILLE_PAUSE,
            'Faire venir ma sœur',
            'En pause depuis le 3 mars',
            '22%',
            '22%',
            '#CBD5D1',
          ),
        devient:
          '<sc-for list="{{ actifs }}" as="p">' +
          CARTE_PARCOURS_D(
            'PARCOURS {{ p.type }}',
            '<sc-if value="{{ p.actif }}">' +
              PASTILLE_ACTIF +
              '</sc-if><sc-if value="{{ p.enPause }}">' +
              PASTILLE_PAUSE +
              '</sc-if>',
            '{{ p.titre }}',
            '{{ p.sousTitre }}',
            '{{ p.pourcent }}',
            '{{ p.barre }}',
            '{{ p.teinte }}',
          ) +
          '</sc-for>',
        frames: ['Desktop'],
        why: 'Mes parcours en cours, de `GET /journeys` (§5.1) — les DEUX pastilles dessinées sont gardées, « Actif » et « En pause ».',
      },
      {
        noeud: CARTE_PARCOURS_D(
          'PARCOURS ÉTUDES',
          PASTILLE_ABOUTI,
          'Obtenir mon visa',
          'Abouti le 20 août 2025 · en 5 mois',
          '100%',
          '100%',
          '#16785E',
        ),
        devient:
          '<sc-for list="{{ aboutis }}" as="p">' +
          CARTE_PARCOURS_D(
            'PARCOURS {{ p.type }}',
            PASTILLE_ABOUTI,
            '{{ p.titre }}',
            '{{ p.sousTitre }}',
            '{{ p.pourcent }}',
            '{{ p.barre }}',
            '{{ p.teinte }}',
          ) +
          '</sc-for>',
        frames: ['Desktop'],
        why: 'Mes parcours ABOUTIS, de `GET /journeys` filtré sur `status: COMPLETED`. Une seule pastille ici : « Abouti » n’est pas une variante, c’est le seul état de cette section.',
      },
      ...panneau(),
      {
        noeud: '>1 parcours actif sur 1<',
        devient: '>{{ plan.actifs }} parcours actif sur {{ plan.limite }}<',
        frames: ['Desktop'],
        why: 'RÈGLE DURE §3.1 rendue visible : le plafond vient de `JOURNEY_FREE_ACTIVE_LIMIT` (`@app/shared`), la même constante que le serveur applique avant `PLAN_LIMIT_REACHED`.',
      },
      {
        noeud:
          CARTE_PARCOURS_M(
            'PARCOURS ÉTUDES',
            PASTILLE_ACTIF,
            'Mes études à Lyon',
            '58%',
            '58%',
            '#E0733A',
            'Hier · étape 7 Logement',
          ) +
          CARTE_PARCOURS_M(
            'PARCOURS FAMILLE',
            PASTILLE_PAUSE,
            'Faire venir ma sœur',
            '22%',
            '22%',
            '#CBD5D1',
            'En pause depuis le 3 mars',
          ),
        devient:
          '<sc-for list="{{ actifs }}" as="p">' +
          CARTE_PARCOURS_M(
            'PARCOURS {{ p.type }}',
            '<sc-if value="{{ p.actif }}">' +
              PASTILLE_ACTIF +
              '</sc-if><sc-if value="{{ p.enPause }}">' +
              PASTILLE_PAUSE +
              '</sc-if>',
            '{{ p.titre }}',
            '{{ p.pourcent }}',
            '{{ p.barre }}',
            '{{ p.teinte }}',
            '{{ p.sousTitreCourt }}',
          ) +
          '</sc-for>',
        frames: ['Mobile'],
        why: 'Mes parcours en cours sur le cadre mobile, qui pose le pourcentage sur la ligne du titre.',
      },
      {
        noeud: CARTE_ABOUTI_M('PARCOURS ÉTUDES', PASTILLE_ABOUTI, 'Obtenir mon visa', '100%', '#16785E'),
        devient:
          '<sc-for list="{{ aboutis }}" as="p">' +
          CARTE_ABOUTI_M('PARCOURS {{ p.type }}', PASTILLE_ABOUTI, '{{ p.titre }}', '{{ p.barre }}', '{{ p.teinte }}') +
          '</sc-for>',
        frames: ['Mobile'],
        why: 'Mes parcours aboutis sur le cadre mobile : la maquette y retire le pourcentage et le sous-titre.',
      },
      {
        noeud: '>1 parcours actif sur 1<',
        devient: '>{{ plan.actifs }} parcours actif sur {{ plan.limite }}<',
        frames: ['Mobile'],
        why: 'La limite du plan gratuit (§3.1), sur le cadre mobile.',
      },
    ],
  }),
];
