/**
 * Les écrans de `docs/template/06 Services.dc.html` — S01 à S10, dix sections.
 *
 * Un fichier par maquette : voir l'en-tête de `01-onboarding.mjs` pour la raison.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * CETTE MAQUETTE N'EMPLOIE PAS LE DIALECTE, ET C'EST `donnees` QUI S'EN CHARGE.
 *
 * Son `renderVals()` est littéralement `renderVals() { return {}; }`, et le
 * fichier ne contient ni `{{ … }}` ni `<sc-for>` — zéro de chacun, compté. Comme
 * 04, 05, 07, 08, 09 et 10 : sept maquettes sur neuf.
 *
 * La conséquence était mesurable : les vingt-cinq cadres de ce module portaient
 * une signature `(_props: ServicesData)`. Le souligné dit que le paramètre n'est
 * pas lu — ces écrans recevaient des données et les IGNORAIENT, et il n'existait
 * aucune prise où brancher l'API.
 *
 * On ne la crée PAS en ajoutant des `{{ }}` dans `docs/template/` : le porteur a
 * été formel, on ne réécrit pas les maquettes. On la DÉCLARE, ici, avec l'écran —
 * c'est la clé `donnees`, dont `tools/generate-screens.mjs` porte le raisonnement
 * complet et les quatre contrôles. Ce qu'il faut en savoir pour lire ce fichier :
 *
 *   · `noeud` est le littéral de la maquette, VERBATIM, qui devient une donnée ;
 *   · `fois` dit combien de fois la maquette l'écrit DANS CE CADRE, et la
 *     génération ÉCHOUE si le compte ne tombe pas juste. Une retouche du designer
 *     ne peut donc pas faire disparaître une donnée en silence ;
 *   · `devient` est la réécriture, dans le dialecte que `01` et `03` emploient
 *     déjà — et rien de plus : ce qui reste de `devient` quand on en ôte les
 *     interpolations doit être dessiné dans `noeud`, dans l'ordre.
 *
 * Les valeurs vivent dans `apps/web/src/screens/s01…s10/data.ts` (un type PAR
 * ÉCRAN, jamais un type partagé par tout le module) et les appels dans
 * `apps/web/src/screens/services/appels.ts`. Le JSX transcodé n'a pas bougé d'une
 * virgule.
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
 * ─── LES ROUTES D'API, LUES DANS LES CONTRÔLEURS ───────────────────────────
 *
 * Il n'existe PAS de module `alerts` côté API : `GET /me/alerts` et ses trois
 * écritures vivent dans `housing.controller.ts`, parce que §2.4 définit l'alerte
 * avec la recherche de logement et que la même table sert les deux kinds. Lire le
 * nom du dossier aurait fait chercher une route inexistante ; c'est le CONTRÔLEUR
 * qui dit la vérité.
 *
 *   · S01 `GET /housing`              · S02 `GET /housing/:id`
 *   · S04 `GET /jobs` + `GET /job-seekers`
 *   · S05 `GET /jobs/:id`             · S06 `GET /pros`
 *   · S07 `GET /pros/:id`             · S09 `GET /housing?scope=mine` + `/jobs?scope=mine`
 *   · S10 `GET /me/alerts`
 *   · les dix cadres d'ordinateur : `GET /me` + `GET /me/subscription`
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
 * Ces cinq planches de fenêtre ne consomment AUCUNE donnée : elles gardent donc
 * `ServicesData` et leur signature `_props`. Ce n'est pas un oubli — la feuille
 * « Présentez-vous » est un formulaire vide, et l'interstitiel de lien externe
 * est du texte de règle.
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
 *     décider où elles s'insèrent — ce que la maquette ne dit pas. LA DONNÉE
 *     EXISTE POURTANT : `GET /housing` rend `meta.canPublish` et
 *     `meta.publishRequirement`, et cette dernière porte EXACTEMENT la phrase de
 *     la carte (`HOUSING_L2_EXPLANATION`). Ce qui manque est l'emplacement, pas
 *     la source. Remonté au porteur.
 *   · S08 · « APRÈS ENVOI » — une carte de 380 px, « En attente de validation ».
 *     Ni voile, ni croix, ni poignée : rien n'indique une fenêtre, et `Modal` en
 *     attend un voile et un panneau. C'est le même constat que pour la feuille de
 *     demande de H06.
 */

import { cadresDuRail, railLitteral } from '../squelette-membre.mjs';

const FILE = 'docs/template/06 Services.dc.html';

/**
 * UN `dataType` PAR ÉCRAN, et un module de données par écran.
 *
 * `ServicesData` reste le défaut, et il ne sert plus qu'aux cinq planches de
 * fenêtre, qui ne consomment rien. Les dix pages déclarent le leur — `S01Data`,
 * `S02Data`… — dans `screens/s01/data.ts` et ses voisins. Un type partagé par tout
 * le module aurait obligé chaque écran à déclarer les champs des neuf autres, donc
 * à les rendre facultatifs, donc à n'exiger rien de personne.
 */
const screen = ({
  section,
  out,
  frames,
  dataType = 'ServicesData',
  dataModule = '../services/data',
  modal = false,
  squelette = !modal,
  ...rest
}) => ({
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
  ...(squelette ? { liens: railLitteral(cadresDuRail(frames)) } : {}),
  section,
  out: `apps/web/src/screens/${out}`,
  dataModule,
  dataType,
  frames,
  ...rest,
});

/** Un écran de PAGE : son type et son module de données sont les siens. */
const page$ = ({ section, out, type, ...rest }) =>
  screen({ section, out, dataType: type, dataModule: './data', ...rest });

/** Un cadre : largeur, nom, rang de la planche parmi celles de même largeur, titre. */
const f = (width, name, occurrence = 0, title = undefined) => ({ width, name, occurrence, title });

/** Titre visible d'un cadre : le texte tel que la maquette l'écrit, et son corps. */
const t = (text, size) => ({ text, size });

/**
 * ─── LE BANDEAU DE QUOTAS ET D'IDENTITÉ, SUR LES DIX CADRES D'ORDINATEUR ────
 *
 * Les dix planches d'ordinateur dessinent la même colonne de gauche et la même
 * barre haute : la carte verte « MES QUOTAS DU MOIS », les panneaux « SERVICES »
 * et « MON ESPACE », l'avatar et le prénom. Ce sont donc les mêmes cinq littéraux
 * à lier dix fois, et les compter a montré qu'ils sont RIGOUREUSEMENT réguliers —
 * une fois chacun, sur chacun des dix cadres.
 *
 * D'où cette fonction plutôt que dix copies : le jour où le designer ajoute un
 * second avatar à la barre haute, la génération s'arrête sur le cadre concerné en
 * nommant « AD » — elle ne produit pas neuf écrans justes et un faux.
 *
 * `quotas` VIENT DE `GET /me/subscription`, et son `usage.items` porte la métrique
 * `PRO_CONTACTS` avec son plafond (`3` en gratuit, `null` en illimité). C'est la
 * règle dure du §4.4, et c'est le SERVEUR qui la tient : la recalculer dans le
 * front demanderait de relire le plan du membre, ce que le socle interdit, et
 * afficherait « 2 sur 3 » à un Premium illimité.
 *
 * LA BARRE DE PROGRESSION EST LIÉE AUSSI, et ce n'est pas du zèle : la maquette
 * la dessine à `width:66%`, c'est-à-dire 2 sur 3. Lier le seul texte laisserait
 * une barre aux deux tiers au-dessus d'un « 0 contact pro sur 3 » — une interface
 * qui se contredit à l'œil est pire qu'une interface figée.
 *
 * CE QUI N'EST PAS LIÉ ICI, ET POURQUOI. Les trois pastilles de compteur du
 * panneau — « Annonces logement · 12 », « Bourses et emploi · 8 », « Mes
 * annonces · 2 » — sont dessinées sur les DIX cadres. Les lier demanderait
 * `GET /housing`, `GET /jobs` et `GET /housing?scope=mine` sur CHAQUE écran du
 * module, et surtout : `GET /jobs` n'expose AUCUN `total` dans son `meta`, là où
 * `GET /housing` en porte un. Le « 8 » n'est donc atteignable par aucune route.
 * Les lier à moitié aurait donné un panneau où un compteur sur trois est vrai.
 * Écart remonté au porteur, pas contourné en devinant.
 */
const BARRE_QUOTA = '<div style="width:66%;height:100%;background:#E0733A;border-radius:999px"></div>';

const bandeau = () => [
  {
    noeud: '>2 contacts pro sur 3<',
    devient: '>{{ quotas.contactsPro }} contacts pro sur {{ quotas.plafondPro }}<',
    fois: 1,
    frames: ['Desktop'],
    why: 'Le quota de contacts pro du mois (§4.4), de `GET /me/subscription` — `usage.items[PRO_CONTACTS]`.',
  },
  {
    noeud: BARRE_QUOTA,
    devient: BARRE_QUOTA.replace('width:66%', 'width:{{ quotas.barre }}'),
    fois: 1,
    frames: ['Desktop'],
    why: 'La barre du quota : liée pour qu’elle ne contredise pas le chiffre qu’elle illustre.',
  },
  {
    noeud: '>Réinitialisé le 1er octobre<',
    devient: '>Réinitialisé le {{ quotas.reinitialise }}<',
    fois: 1,
    frames: ['Desktop'],
    why: 'La date de remise à zéro du compteur, de `usage.resetsAt` — jamais calculée dans le front.',
  },
  {
    noeud: '>AD<',
    devient: '>{{ moi.initiales }}<',
    fois: 1,
    frames: ['Desktop'],
    why: 'Les initiales de l’avatar de repli, dérivées du nom affiché de `GET /me`.',
  },
  {
    noeud: '>Amina<',
    devient: '>{{ moi.prenom }}<',
    fois: 1,
    frames: ['Desktop'],
    why: 'Le prénom de la barre haute, premier mot du nom affiché.',
  },
];

// ─── Les cartes que la maquette répète, écrites UNE fois ─────────────────────
//
// Chaque fabrique ci-dessous reproduit une carte de la maquette à l'identique, ses
// textes en paramètres. Elle sert DEUX FOIS : à écrire le `noeud` (les cartes
// telles que la maquette les dessine, avec leurs textes d'exemple) et à écrire le
// `devient` (la même carte, une fois, avec des interpolations). Le contrôle du
// générateur compare les deux — si la maquette change d'un pixel, la génération
// s'arrête. C'est ce qui rend ces longues chaînes sûres plutôt que fragiles : rien
// ici ne peut dériver sans être dit.

/**
 * S01 — une carte d'annonce. Les cadres d'ordinateur et mobile la dessinent à
 * l'IDENTIQUE, octet pour octet : six fois sur l'un, deux sur l'autre.
 *
 * LA PHOTO N'EST PAS LIÉE, et c'est la maquette qui le décide : elle ne dessine
 * pas d'`<img>` mais un `<div>` hachuré vide. Pointer `photos[0].url` dessus
 * demanderait d'AJOUTER une image là où elle n'en a jamais mis. Signalé.
 *
 * « L2 » RESTE DESSINÉ : §2.1 exige L2 pour publier « sans exception », donc
 * l'auteur d'une annonce est toujours L2 — `author.verificationLevel` le confirme
 * sur toutes les charges relevées. Le lier ferait croire que la pastille peut
 * varier.
 */
const CARTE_LOGEMENT = (genre, titre, prix, detail, fond, initiales, auteur) =>
  '<div style="background:#fff;border:1px solid #E6EBE9;border-radius:22px;padding:10px"><div style="position:relative"><div style="height:150px;border-radius:16px;background:repeating-linear-gradient(135deg,#E3ECE8 0 14px,#DCE6E1 14px 28px);display:flex;align-items:center;justify-content:center;font-size:11.5px;font-weight:600;color:#7C8C85;position:relative"></div><span style="position:absolute;top:10px;left:10px;background:rgba(255,255,255,.92);color:#0F5C48;font-size:11px;font-weight:700;padding:5px 11px;border-radius:999px">' +
  genre +
  '</span><span style="position:absolute;top:8px;right:8px;width:34px;height:34px;border-radius:999px;background:rgba(255,255,255,.92);display:flex;align-items:center;justify-content:center"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#16211D" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg></span></div><div style="padding:12px 8px 6px"><div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px"><span style="font-size:14.5px;font-weight:700;min-width:0">' +
  titre +
  '</span><span style="font-size:16px;font-weight:800;color:#0F5C48;white-space:nowrap">' +
  prix +
  '</span></div><div style="font-size:12px;color:#5D6B66;margin-top:4px">' +
  detail +
  '</div><div style="display:flex;align-items:center;gap:6px;margin-top:10px;padding-top:10px;border-top:1px solid #F0F3F2;font-size:12px"><span style="width:24px;height:24px;border-radius:999px;background:' +
  fond +
  ';color:#fff;font-size:8px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
  initiales +
  '</span>' +
  auteur +
  '<svg width="12" height="12" viewBox="0 0 24 24" fill="#16785E"><circle cx="12" cy="12" r="10"/><path d="m8 12 3 3 5-6" stroke="#fff" stroke-width="2.2" fill="none"/></svg><span style="background:#E3F0EB;color:#0F5C48;font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px;white-space:nowrap">L2</span></div></div></div>';

/** Les six cartes de la planche d'ordinateur, dans l'ordre où elle les dessine. */
const LOGEMENTS_DESKTOP =
  CARTE_LOGEMENT(
    'Colocation',
    'Chambre à Villeurbanne',
    '410 €',
    'Meublé · 1er oct. · 12 mois',
    '#B4581F',
    'IS',
    'Ibrahim S.',
  ) +
  CARTE_LOGEMENT(
    'Location',
    'Studio meublé Lyon 7e',
    '620 €',
    'Meublé · libre · 24 m²',
    '#0F5C48',
    'ST',
    'Sarah T.',
  ) +
  CARTE_LOGEMENT(
    'Temporaire',
    'Hébergement 2 semaines',
    'Gratuit',
    'Canapé-lit · dès le 28 sept.',
    '#2FA37D',
    'FN',
    'Fatou N.',
  ) +
  CARTE_LOGEMENT(
    'Location',
    'T2 lumineux Lyon 3e',
    '780 €',
    'Non meublé · 1er nov.',
    '#16785E',
    'YB',
    'Yasmine B.',
  ) +
  CARTE_LOGEMENT(
    'Colocation',
    'Coloc étudiante Guillotière',
    '450 €',
    'Meublé · 4 colocs',
    '#E0733A',
    'KB',
    'Kofi B.',
  ) +
  CARTE_LOGEMENT(
    'Location',
    'Studio Croix-Rousse',
    '540 €',
    'Meublé · 18 m²',
    '#0F5C48',
    'MK',
    'Marc K.',
  );

/** Les DEUX cartes de la planche mobile — la maquette en montre moins, pas d'autres. */
const LOGEMENTS_MOBILE =
  CARTE_LOGEMENT(
    'Colocation',
    'Chambre à Villeurbanne',
    '410 €',
    'Meublé · 1er oct. · 12 mois',
    '#B4581F',
    'IS',
    'Ibrahim S.',
  ) +
  CARTE_LOGEMENT(
    'Location',
    'Studio meublé Lyon 7e',
    '620 €',
    'Meublé · libre · 24 m²',
    '#0F5C48',
    'ST',
    'Sarah T.',
  );

/** La boucle qui remplace les cartes : écrite avec la MÊME fabrique que le `noeud`. */
const LOGEMENTS_LIES =
  '<sc-for list="{{ liste.annonces }}" as="a">' +
  CARTE_LOGEMENT(
    '{{ a.genre }}',
    '{{ a.titre }}',
    '{{ a.prix }}',
    '{{ a.detail }}',
    '{{ a.fond }}',
    '{{ a.initiales }}',
    '{{ a.auteur }}',
  ) +
  '</sc-for>';

/** S04 — la pastille « Sponsorisée » (règle dure §11), et elle est OPTIONNELLE. */
const PASTILLE_SPONSORISEE =
  '<span style="background:#FBE3D4;color:#B4581F;font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px;white-space:nowrap">Sponsorisée</span>';

/** S04 — une carte d'offre. Les deux cadres la dessinent à l'identique. */
const CARTE_OFFRE = (pastille, genre, titre, ou, contrat, secteur, partage) =>
  '<div style="background:#fff;border:1px solid #E6EBE9;border-radius:22px;padding:18px;flex-shrink:0;"><div style="display:flex;gap:6px;align-items:center">' +
  pastille +
  '<span style="background:#E3F0EB;color:#0F5C48;font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px;white-space:nowrap">' +
  genre +
  '</span><span style="flex:1"></span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16211D" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg></div><div style="font-size:16px;font-weight:700;margin-top:10px">' +
  titre +
  '</div><div style="font-size:13px;color:#5D6B66;margin-top:2px">' +
  ou +
  '</div><div style="display:flex;gap:6px;margin-top:10px"><span style="background:#F2F5F4;color:#5D6B66;font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px;white-space:nowrap">' +
  contrat +
  '</span><span style="background:#F2F5F4;color:#5D6B66;font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px;white-space:nowrap">' +
  secteur +
  '</span></div><div style="font-size:12px;color:#8A958F;margin-top:10px">' +
  partage +
  '</div></div>';

const OFFRE_1 = CARTE_OFFRE(
  PASTILLE_SPONSORISEE,
  'Emploi',
  'Comptable junior',
  'Cabinet Arvel · Lyon 3e',
  'CDI',
  'Finance',
  'Partagée par Sandra M.',
);
const OFFRE_2 = CARTE_OFFRE(
  '',
  'Alternance',
  'Développeur·se web',
  'Studio Kora · Télétravail',
  'Alternance',
  'Numérique',
  'Partagée par Marc K.',
);
const OFFRE_3 = CARTE_OFFRE(
  '',
  'Bourse',
  'Bourse de mobilité 2026',
  'Région AURA · Lyon',
  'Bourse',
  'Études',
  'Partagée par Aïcha D.',
);

/**
 * La boucle des offres.
 *
 * RÈGLE DURE §11 : « une offre sponsorisée porte TOUJOURS la pastille ». Les DEUX
 * états sont dessinés par la maquette — avec pastille sur la première carte, sans
 * sur les deux autres — et les deux sont donc gardés : le `<sc-if>` fait
 * apparaître la pastille quand l'offre est mise en avant, et la fait disparaître
 * sinon. Lier seulement l'un des deux aurait soit collé la pastille à toutes les
 * offres, soit effacé la règle.
 *
 * Son LIBELLÉ vient du serveur (`sponsoredLabel`), pas d'ici : un front qui le
 * posséderait pourrait l'« oublier », et la mise en avant cesserait d'être
 * signalée sans que rien ne le dise.
 */
const OFFRES_LIEES =
  '<sc-for list="{{ offres.liste }}" as="o">' +
  CARTE_OFFRE(
    '<sc-if value="{{ o.sponsorisee }}">' +
      PASTILLE_SPONSORISEE.replace('>Sponsorisée<', '>{{ o.pastille }}<') +
      '</sc-if>',
    '{{ o.genre }}',
    '{{ o.titre }}',
    '{{ o.ou }}',
    '{{ o.contrat }}',
    '{{ o.secteur }}',
    '{{ o.partage }}',
  ) +
  '</sc-for>';

/** S04 — une ligne de « PROFILS DISPONIBLES » (§3.2), sur l'ordinateur seulement. */
const LIGNE_PROFIL = (fond, initiales, nom, titre) =>
  '<div style="margin-top:12px"><div style="display:flex;align-items:center;gap:12px"><span style="width:34px;height:34px;border-radius:999px;background:' +
  fond +
  ';color:#fff;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
  initiales +
  '</span><span style="flex:1;min-width:0"><span style="display:flex;align-items:center;gap:5px;font-size:14px;font-weight:700">' +
  nom +
  '<svg width="13" height="13" viewBox="0 0 24 24" fill="#16785E"><circle cx="12" cy="12" r="10"/><path d="m8 12 3 3 5-6" stroke="#fff" stroke-width="2.2" fill="none"/></svg></span><span style="display:block;font-size:12px;color:#8A958F">' +
  titre +
  '</span></span><button style="height:44px;padding:0 18px;border-radius:14px;background:#F2F5F4;color:#16211D;border:none;font:inherit;font-size:13.5px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:8px;white-space:nowrap;flex-shrink:0;height:34px;padding:0 12px;font-size:12px">Contacter</button></div></div>';

const PROFILS_DESKTOP =
  LIGNE_PROFIL('#E0733A', 'KB', 'Kofi B.', 'Technicien réseau · CDI') +
  LIGNE_PROFIL('#2FA37D', 'FN', 'Fatou N.', 'Assistante RH · alternance');

const PROFILS_LIES =
  '<sc-for list="{{ profils.liste }}" as="p">' +
  LIGNE_PROFIL('{{ p.fond }}', '{{ p.initiales }}', '{{ p.nom }}', '{{ p.titre }}') +
  '</sc-for>';

/**
 * S06 — une fiche de l'annuaire.
 *
 * La maquette dessine DEUX cadres différents : la fiche mise en avant porte un
 * fond vert pâle, un liseré de 1,5 px et la mention « Fiche mise en avant » ; la
 * fiche ordinaire a le cadre blanc commun et pas de mention. Les deux sont
 * gardées, chacune sous son `<sc-if>` — c'est la règle dure du §4.2, « clairement
 * signalé », et en garder une seule l'aurait soit collée à toutes les fiches, soit
 * effacée.
 */
const CADRE_FICHE_AVANT =
  '<div style="background:#EFF7F3;border:1.5px solid #16785E;border-radius:22px;padding:16px;flex-shrink:0"><div style="margin-bottom:10px"><span style="background:#16785E;color:#fff;font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px;white-space:nowrap">Fiche mise en avant</span></div>';

const CADRE_FICHE_SIMPLE =
  '<div style="background:#fff;border:1px solid #E6EBE9;border-radius:22px;padding:16px;flex-shrink:0">';

const CORPS_FICHE = (fond, initiales, nom, metier, lieux, recos) =>
  '<div style="display:flex;align-items:center;gap:12px"><span style="width:48px;height:48px;border-radius:999px;background:' +
  fond +
  ';color:#fff;font-size:15px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
  initiales +
  '</span><div style="flex:1;min-width:0"><div style="display:flex;align-items:center;gap:6px;font-size:15px;font-weight:700">' +
  nom +
  '<svg width="13" height="13" viewBox="0 0 24 24" fill="#16785E"><circle cx="12" cy="12" r="10"/><path d="m8 12 3 3 5-6" stroke="#fff" stroke-width="2.2" fill="none"/></svg></div><div style="font-size:13px;color:#16211D;font-weight:600">' +
  metier +
  '</div><div style="font-size:12px;color:#8A958F">' +
  lieux +
  '</div></div><div style="text-align:right"><div style="font-size:12px;color:#5D6B66">Recommandé·e par <strong style="color:#16211D">' +
  recos +
  '</strong></div><button style="height:44px;padding:0 18px;border-radius:14px;background:#16785E;color:#fff;border:none;font:inherit;font-size:13.5px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:8px;white-space:nowrap;flex-shrink:0;height:36px;margin-top:6px;margin-left:auto">Voir</button></div></div></div>';

const FICHE = (cadre, fond, initiales, nom, metier, lieux, recos) =>
  cadre + CORPS_FICHE(fond, initiales, nom, metier, lieux, recos);

const FICHES_DESKTOP =
  FICHE(
    CADRE_FICHE_AVANT,
    '#0F5C48',
    'MB',
    'Me Mariam Bah',
    'Avocate en droit des étrangers',
    'Lyon, Villeurbanne · Français, Peul',
    '14',
  ) +
  FICHE(
    CADRE_FICHE_AVANT,
    '#16785E',
    'JK',
    'Jean Kouassi',
    'Traducteur assermenté',
    'Lyon, Grenoble · Français, Anglais',
    '9',
  ) +
  FICHE(
    CADRE_FICHE_SIMPLE,
    '#B4581F',
    'SL',
    'Me Serge Loko',
    'Avocat · titres de séjour',
    'Lyon · Français, Fon',
    '7',
  );

const FICHES_MOBILE =
  FICHE(
    CADRE_FICHE_AVANT,
    '#0F5C48',
    'MB',
    'Me Mariam Bah',
    'Avocate · étrangers',
    'Lyon · Peul',
    '14',
  ) +
  FICHE(CADRE_FICHE_SIMPLE, '#B4581F', 'SL', 'Me Serge Loko', 'Avocat', 'Lyon · Fon', '7');

const FICHES_LIEES = (() => {
  const corps = CORPS_FICHE(
    '{{ p.fond }}',
    '{{ p.initiales }}',
    '{{ p.nom }}',
    '{{ p.metier }}',
    '{{ p.lieux }}',
    '{{ p.recos }}',
  );
  return (
    '<sc-for list="{{ annuaire.fiches }}" as="p">' +
    '<sc-if value="{{ p.enAvant }}">' +
    CADRE_FICHE_AVANT.replace('>Fiche mise en avant<', '>{{ p.mention }}<') +
    corps +
    '</sc-if>' +
    '<sc-if value="{{ p.ordinaire }}">' +
    CADRE_FICHE_SIMPLE +
    corps +
    '</sc-if>' +
    '</sc-for>'
  );
})();

/** S07 — une recommandation (§4.3 : « affichées avec le handle du recommandeur »). */
const RECOMMANDATION = (fond, initiales, nom, mot) =>
  '<div style="display:flex;gap:10px;margin-top:14px"><span style="width:34px;height:34px;border-radius:999px;background:' +
  fond +
  ';color:#fff;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
  initiales +
  '</span><span><span style="display:block;font-size:13.5px;font-weight:700">' +
  nom +
  '</span><span style="display:block;font-size:13px;color:#5D6B66">' +
  mot +
  '</span></span></div>';

const RECOMMANDATIONS_DESKTOP =
  RECOMMANDATION('#2FA37D', 'FN', 'Fatou N.', '« Très claire, m’a évité un refus. »') +
  RECOMMANDATION('#E0733A', 'KB', 'Kofi B.', '« Réactive et à l’écoute. »');

const RECOMMANDATIONS_LIEES =
  '<sc-for list="{{ pro.recommandations }}" as="r">' +
  RECOMMANDATION('{{ r.fond }}', '{{ r.initiales }}', '{{ r.nom }}', '{{ r.mot }}') +
  '</sc-for>';

/** S09 — la pastille d'état d'une annonce. Son libellé ET ses deux couleurs varient. */
const PASTILLE_ETAT = (fond, texte, libelle) =>
  '<span style="background:' +
  fond +
  ';color:' +
  texte +
  ';font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px;white-space:nowrap">' +
  libelle +
  '</span>';

/** S09 — une puce d'action. Inerte dans ce lot : aucune route n'est branchée. */
const PUCE = (libelle) =>
  '<span style="height:34px;padding:0 12px;border-radius:999px;background:#F2F5F4;font-size:12px;font-weight:700;display:flex;align-items:center">' +
  libelle +
  '</span>';

const LIGNE_MES_ANNONCES = (pastille, titre, sous, actions) =>
  '<div style="background:#fff;border:1px solid #E6EBE9;border-radius:22px;padding:16px;flex-shrink:0;"><div style="display:flex;gap:14px;align-items:center"><div style="width:84px;height:70px;border-radius:14px;background:repeating-linear-gradient(135deg,#E3ECE8 0 10px,#DCE6E1 10px 20px);flex-shrink:0"></div><div style="flex:1;min-width:0">' +
  pastille +
  '<div style="font-size:15px;font-weight:700;margin-top:6px">' +
  titre +
  '</div><div style="font-size:12px;color:#8A958F;margin-top:2px">' +
  sous +
  '</div></div></div><div style="display:flex;gap:6px;margin-top:12px;flex-wrap:wrap">' +
  actions +
  '</div></div>';

/**
 * S09 — les QUATRE états que la planche d'ordinateur dessine, avec leurs jeux
 * d'actions. Ils diffèrent : quatre puces sur une annonce active, deux sur une
 * annonce en vérification, une sur une annonce trouvée, deux sur une expirée.
 *
 * Les quatre sont donc gardés, chacun sous son `<sc-if>`. En garder un seul aurait
 * fait proposer « Logement trouvé » sur une annonce expirée.
 */
const MES_ANNONCES_DESKTOP =
  LIGNE_MES_ANNONCES(
    PASTILLE_ETAT('#E3F0EB', '#0F5C48', 'Active'),
    'Chambre à Villeurbanne',
    '6 contacts · expire dans 12 jours',
    PUCE('Renouveler') + PUCE('Pause') + PUCE('Logement trouvé') + PUCE('Supprimer'),
  ) +
  LIGNE_MES_ANNONCES(
    PASTILLE_ETAT('#FBE3D4', '#B4581F', 'En vérification'),
    'Studio Croix-Rousse',
    'Envoyée il y a 2 h',
    PUCE('Modifier') + PUCE('Supprimer'),
  ) +
  LIGNE_MES_ANNONCES(
    PASTILLE_ETAT('#F2F5F4', '#5D6B66', 'Trouvé'),
    'Coloc Guillotière',
    'Clôturée le 2 septembre',
    PUCE('Republier'),
  ) +
  LIGNE_MES_ANNONCES(
    PASTILLE_ETAT('#F2F5F4', '#8A958F', 'Expirée'),
    'T2 Lyon 3e',
    'Expirée le 14 août',
    PUCE('Renouveler') + PUCE('Supprimer'),
  );

const MES_ANNONCES_DESKTOP_LIEES =
  '<sc-for list="{{ mesAnnonces.liste }}" as="a">' +
  '<sc-if value="{{ a.active }}">' +
  LIGNE_MES_ANNONCES(
    PASTILLE_ETAT('#E3F0EB', '#0F5C48', 'Active'),
    '{{ a.titre }}',
    '{{ a.sousTitre }}',
    PUCE('Renouveler') + PUCE('Pause') + PUCE('Logement trouvé') + PUCE('Supprimer'),
  ) +
  '</sc-if>' +
  '<sc-if value="{{ a.enVerification }}">' +
  LIGNE_MES_ANNONCES(
    PASTILLE_ETAT('#FBE3D4', '#B4581F', 'En vérification'),
    '{{ a.titre }}',
    '{{ a.sousTitre }}',
    PUCE('Modifier') + PUCE('Supprimer'),
  ) +
  '</sc-if>' +
  '<sc-if value="{{ a.trouvee }}">' +
  LIGNE_MES_ANNONCES(
    PASTILLE_ETAT('#F2F5F4', '#5D6B66', 'Trouvé'),
    '{{ a.titre }}',
    '{{ a.sousTitre }}',
    PUCE('Republier'),
  ) +
  '</sc-if>' +
  '<sc-if value="{{ a.expiree }}">' +
  LIGNE_MES_ANNONCES(
    PASTILLE_ETAT('#F2F5F4', '#8A958F', 'Expirée'),
    '{{ a.titre }}',
    '{{ a.sousTitre }}',
    PUCE('Renouveler') + PUCE('Supprimer'),
  ) +
  '</sc-if>' +
  '</sc-for>';

/** S09 mobile — DEUX états seulement, et ce ne sont pas les mêmes : active et en pause. */
const MES_ANNONCES_MOBILE =
  LIGNE_MES_ANNONCES(
    PASTILLE_ETAT('#E3F0EB', '#0F5C48', 'Active'),
    'Chambre à Villeurbanne',
    '6 contacts',
    PUCE('Renouveler') + PUCE('Pause') + PUCE('Trouvé'),
  ) +
  LIGNE_MES_ANNONCES(
    PASTILLE_ETAT('#F2F5F4', '#5D6B66', 'En pause'),
    'Studio Croix-Rousse',
    'Reprendre quand vous voulez',
    PUCE('Reprendre'),
  );

const MES_ANNONCES_MOBILE_LIEES =
  '<sc-for list="{{ mesAnnonces.liste }}" as="a">' +
  '<sc-if value="{{ a.active }}">' +
  LIGNE_MES_ANNONCES(
    PASTILLE_ETAT('#E3F0EB', '#0F5C48', 'Active'),
    '{{ a.titre }}',
    '{{ a.sousTitre }}',
    PUCE('Renouveler') + PUCE('Pause') + PUCE('Trouvé'),
  ) +
  '</sc-if>' +
  '<sc-if value="{{ a.enPause }}">' +
  LIGNE_MES_ANNONCES(
    PASTILLE_ETAT('#F2F5F4', '#5D6B66', 'En pause'),
    '{{ a.titre }}',
    '{{ a.sousTitre }}',
    PUCE('Reprendre'),
  ) +
  '</sc-if>' +
  '</sc-for>';

/** S10 — l'interrupteur d'une alerte, dans ses DEUX états dessinés. */
const INTERRUPTEUR_ACTIF =
  '<span style="width:46px;height:26px;border-radius:999px;background:#16785E;position:relative"><span style="position:absolute;top:3px;left:23px;width:20px;height:20px;border-radius:999px;background:#fff"></span></span>';

const INTERRUPTEUR_PAUSE =
  '<span style="width:46px;height:26px;border-radius:999px;background:#CBD5D1;position:relative"><span style="position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:999px;background:#fff"></span></span>';

const LIGNE_ALERTE = (titre, criteres, etat, interrupteur) =>
  '<div style="background:#fff;border:1px solid #E6EBE9;border-radius:22px;padding:16px;flex-shrink:0;"><div style="display:flex;align-items:center;gap:12px"><span style="width:38px;height:38px;border-radius:12px;background:#E3F0EB;display:flex;align-items:center;justify-content:center"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#0F5C48" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20a2 2 0 0 0 4 0"/></svg></span><div style="flex:1"><div style="font-size:14.5px;font-weight:700">' +
  titre +
  '</div><div style="font-size:12.5px;color:#5D6B66;margin-top:2px">' +
  criteres +
  '</div><div style="font-size:11.5px;color:#8A958F;margin-top:2px">' +
  etat +
  '</div></div>' +
  interrupteur +
  '</div></div>';

const alertesLiees = () =>
  '<sc-for list="{{ alertes.liste }}" as="al">' +
  LIGNE_ALERTE(
    '{{ al.titre }}',
    '{{ al.criteres }}',
    '{{ al.etat }}',
    '<sc-if value="{{ al.active }}">' +
      INTERRUPTEUR_ACTIF +
      '</sc-if><sc-if value="{{ al.enPause }}">' +
      INTERRUPTEUR_PAUSE +
      '</sc-if>',
  ) +
  '</sc-for>';

/** S10 — l'encart « Sans Premium » de la colonne de contexte (§2.4). */
const ENCART_SANS_PREMIUM =
  '<div style="background:#FBE3D4;border-radius:22px;padding:18px;flex-shrink:0"><span style="background:#fff;color:#B4581F;font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px;white-space:nowrap">PREMIUM</span><div style="font-size:14px;font-weight:700;margin-top:10px">Sans Premium</div><div style="font-size:12.5px;line-height:1.55;margin-top:4px">Les alertes vous préviennent dès qu\'une annonce correspond. Réservées à Premium, le reste des Services reste gratuit.</div><button style="height:44px;padding:0 18px;border-radius:14px;background:#E0733A;color:#fff;border:none;font:inherit;font-size:13.5px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:8px;white-space:nowrap;flex-shrink:0;width:100%;margin-top:12px;height:40px">Découvrir Premium</button></div>';

/** S02 — la carte « ANNONCE À RISQUE MOYEN », la TRANCHE et jamais le chiffre. */
const CARTE_RISQUE_MOYEN =
  '<div style="background:#fff;border:1px solid #E6EBE9;border-radius:22px;padding:16px;flex-shrink:0;"><div style="font-size:10.5px;font-weight:700;letter-spacing:1px;color:#8A958F">ANNONCE À RISQUE MOYEN</div><div style="margin-top:10px;background:#FBE3D4;border-radius:14px;padding:12px;font-size:12.5px;color:#B4581F;font-weight:700;line-height:1.5">Soyez particulièrement prudent·e avec cette annonce.</div></div>';

export const screens = [
  /**
   * ── S01 · `/services/logement` — la liste (10 §7) ──────────────────────────
   *
   * BRANCHÉ SUR `GET /housing` (+ `GET /me` et `GET /me/subscription` pour le
   * bandeau). Le contrôleur la déclare `@PublicRead()` — §2.3 : « un L0
   * pré-départ peut LIRE les annonces » — mais l'écran a besoin d'une session
   * pour son bandeau de quotas, et c'est la maquette qui le dessine.
   *
   * RÈGLE DURE 10 §2.2 : le bandêau « Aucun versement avant visite ou
   * vérification. » est affiché en permanence, ET « renvoyé par l'API sur chaque
   * liste et chaque annonce ». LE TEXTE VIENT DONC DU SERVEUR sur le cadre
   * d'ordinateur, où la maquette écrit la phrase complète : c'est la seule forme
   * de la règle qui survive à un déploiement front, puisqu'un texte que le front
   * possède, le front peut le faire disparaître.
   *
   * LE CADRE MOBILE GARDE LE SIEN, et c'est un écart assumé : la maquette l'y
   * ABRÈGE en « Aucun versement avant visite. » — treize caractères dans une
   * pastille de 390 px de large. Y poser la phrase du serveur, deux fois plus
   * longue, changerait la mise en page que la maquette a dessinée. Le détecteur
   * de `e2e/services.spec.ts` couvre les deux formes.
   *
   * L'encart partenaire de bas de liste est celui que 14 §17 autorise : « en pied
   * de la section Logement », et nulle part ailleurs. Il n'est PAS lié — aucune
   * route de ce module ne rend de placement partenaire, et `GET /partners` est un
   * autre domaine. Signalé.
   */
  page$({
    section: 'S01',
    out: 's01',
    type: 'S01Data',
    frames: [
      f(1440, 'Desktop', 0, t('Annonces logement', '28px')),
      f(390, 'Mobile', 0, t('Services', '21px')),
    ],
    donnees: [
      ...bandeau(),
      {
        noeud: '>12 annonces à Lyon · publication réservée aux profils vérifiés<',
        devient:
          '>{{ liste.total }} annonces à {{ liste.ville }} · publication réservée aux profils vérifiés<',
        fois: 1,
        frames: ['Desktop'],
        why: 'Le compte d’annonces et la ville cherchée, de `meta.total` et du filtre de ville.',
      },
      {
        noeud:
          '>Aucun versement avant visite ou vérification. Ne payez jamais une réservation à distance.<',
        devient: '>{{ liste.bandeau }}<',
        fois: 1,
        frames: ['Desktop'],
        why: 'RÈGLE DURE §2.2 : le bandeau de non-paiement vient de `meta.safetyBanner`, jamais du front.',
      },
      {
        noeud: LOGEMENTS_DESKTOP,
        devient: LOGEMENTS_LIES,
        fois: 1,
        frames: ['Desktop'],
        why: 'Les annonces de `GET /housing` : genre, titre, loyer, détail, auteur et son avatar.',
      },
      {
        noeud: LOGEMENTS_MOBILE,
        devient: LOGEMENTS_LIES,
        fois: 1,
        frames: ['Mobile'],
        why: 'Les mêmes annonces sur le cadre mobile — la maquette en dessine deux, pas six.',
      },
    ],
  }),

  /**
   * ── S02 · `/services/logement/:id` — l'annonce (10 §2.3) ───────────────────
   *
   * Le titre est celui de l'ANNONCE — « Studio meublé Lyon 7e » — comme H02 titre
   * sa demande : la maquette n'en écrit pas d'autre, et « Annonce » serait le
   * titre inventé qui a déjà coûté A01. CE TITRE EST UNE DONNÉE, et le générateur
   * reprend sa promotion sur la forme liée (`retitrerSurDonnees`).
   *
   * « Contacter » ouvre la feuille « Présentez-vous », qui est l'état L1+.
   * L'état L0 — « Contacter demande une identité vérifiée » — est dessiné DEUX
   * FOIS par la maquette : en feuille mobile sur voile, et EN PLACE dans la
   * colonne de contexte du cadre d'ordinateur (planche « ÉTAT L0 · APRÈS
   * “CONTACTER” »). La feuille est donc déclarée `mobileOnly` côté page : sur
   * grand écran, cet état a une autre forme, déjà dessinée dans l'écran.
   *
   * ─── RÈGLE DURE 10 §7, SUR CET ÉCRAN ──────────────────────────────────────
   *
   * « Aperçu du score de risque NON AFFICHÉ (interne). » La carte « ANNONCE À
   * RISQUE MOYEN » est la seule chose que la maquette dise du risque, et c'est la
   * TRANCHE de §2.2 (0,4–0,7), pas le chiffre. Elle passe sous un `<sc-if>` piloté
   * par `cautionLevel`, qui ne connaît que deux valeurs — donc l'écran ne peut
   * PAS afficher un nombre, même si le serveur en envoyait un : le schéma
   * `.strict()` de `housingDetailResponseSchema` refuse la réponse avant.
   *
   * ─── CE QUE L'API NE DONNE PAS, ET QU'ON NE COMPOSE PAS ───────────────────
   *
   *   · la SURFACE (« 24 m² ») et le DÉPÔT (« 1 240 € ») : aucun champ de
   *     `HousingCard` ne les porte, et le schéma figé n'a pas de colonne. Les
   *     deux tuiles restent dessinées ;
   *   · « Installée · Lyon 7e » sous le nom de l'auteur — sa phase et sa ville.
   *     `HOUSING_SELECT` s'arrête au pseudo, au nom, à l'avatar et au niveau.
   *
   * Écarts remontés au porteur, pas comblés en devinant.
   */
  page$({
    section: 'S02',
    out: 's02',
    type: 'S02Data',
    triggers: [
      { marker: '</svg>Contacter</button>', modal: 'S02C', frames: ['Desktop'] },
      { marker: '>Contacter</button>', modal: 'S02C', frames: ['Mobile'] },
    ],
    frames: [
      f(1440, 'Desktop', 0, t('Studio meublé Lyon 7e', '26px')),
      f(390, 'Mobile', 0, t('Studio meublé Lyon 7e', '19px')),
    ],
    donnees: [
      ...bandeau(),
      {
        noeud: '>Studio meublé Lyon 7e<',
        devient: '>{{ annonce.titre }}<',
        fois: 1,
        frames: ['Desktop'],
        why: 'Le titre de l’annonce, de `GET /housing/:id` — et le titre de la page.',
      },
      {
        noeud: '>620 €<',
        devient: '>{{ annonce.prix }}<',
        fois: 1,
        frames: ['Desktop'],
        why: 'Le loyer, en centimes côté API (`priceCents`), mis en forme par `Intl`.',
      },
      {
        noeud: '>+ 4 photos<',
        devient: '>+ {{ annonce.autresPhotos }} photos<',
        fois: 1,
        frames: ['Desktop'],
        why: 'Le nombre de photos restantes, de `photos.length` — la maquette ne dessine aucune image.',
      },
      {
        noeud: '>Location<',
        devient: '>{{ annonce.genre }}<',
        fois: 1,
        frames: ['Desktop'],
        why: 'Le kind de l’annonce (§2.1), dans les mots de la maquette.',
      },
      {
        noeud: '>Lyon 7e · Jean Macé<',
        devient: '>{{ annonce.quartier }}<',
        fois: 1,
        frames: ['Desktop'],
        why: 'La ville et le quartier (`city.name`, `district`) — jamais d’adresse (§8.1).',
      },
      {
        noeud: '>1er oct.<',
        devient: '>{{ annonce.disponible }}<',
        fois: 1,
        frames: ['Desktop'],
        why: 'La date de disponibilité, de `availableFrom` — un jour civil, sans fuseau.',
      },
      {
        noeud: '>12 mois<',
        devient: '>{{ annonce.duree }}<',
        fois: 1,
        frames: ['Desktop'],
        why: 'La durée proposée, de `durationMonths`.',
      },
      {
        noeud:
          '>Studio au 3e étage avec ascenseur, cuisine équipée, à 5 minutes du métro Jean Macé. Visale accepté. Idéal étudiant·e.<',
        devient: '>{{ annonce.description }}<',
        fois: 1,
        frames: ['Desktop'],
        why: 'La description de l’annonce.',
      },
      {
        noeud: '>ST<',
        devient: '>{{ annonce.initiales }}<',
        fois: 1,
        frames: ['Desktop'],
        why: 'Les initiales de l’auteur, dérivées de `author.displayName`.',
      },
      {
        noeud: '>Sarah Traoré<',
        devient: '>{{ annonce.auteur }}<',
        fois: 1,
        frames: ['Desktop'],
        why: 'Le nom de l’auteur de l’annonce.',
      },
      {
        noeud: '>Connectée à 2 de vos contacts<',
        devient: '>Connectée à {{ annonce.contactsCommuns }} de vos contacts<',
        fois: 1,
        frames: ['Desktop'],
        why: 'Les contacts en commun (§7), de `mutualConnectionCount` — calculé par le serveur.',
      },
      {
        noeud: CARTE_RISQUE_MOYEN,
        devient:
          '<sc-if value="{{ annonce.prudenceRenforcee }}">' + CARTE_RISQUE_MOYEN + '</sc-if>',
        fois: 1,
        frames: ['Desktop'],
        why: 'RÈGLE DURE §7 : le rappel renforcé suit `cautionLevel` — la TRANCHE de §2.2, jamais le score.',
      },
      {
        noeud: '>Studio meublé Lyon 7e<',
        devient: '>{{ annonce.titre }}<',
        fois: 1,
        frames: ['Mobile'],
        why: 'Le titre, sur le cadre mobile : sans lui, le document servi garderait le texte de la maquette.',
      },
      {
        noeud: '>620 €<',
        devient: '>{{ annonce.prix }}<',
        fois: 1,
        frames: ['Mobile'],
        why: 'Le loyer, sur le cadre mobile.',
      },
      {
        noeud: '>Location<',
        devient: '>{{ annonce.genre }}<',
        fois: 1,
        frames: ['Mobile'],
        why: 'Le kind de l’annonce, sur le cadre mobile.',
      },
      {
        noeud: '>1er oct.<',
        devient: '>{{ annonce.disponible }}<',
        fois: 1,
        frames: ['Mobile'],
        why: 'La disponibilité, sur le cadre mobile.',
      },
      {
        noeud: '>Cuisine équipée, 5 min du métro Jean Macé. Visale accepté.<',
        devient: '>{{ annonce.description }}<',
        fois: 1,
        frames: ['Mobile'],
        why: 'La description, que la maquette raccourcit sur mobile — c’est la même donnée.',
      },
      {
        noeud: '>ST<',
        devient: '>{{ annonce.initiales }}<',
        fois: 1,
        frames: ['Mobile'],
        why: 'Les initiales de l’auteur, sur le cadre mobile.',
      },
      {
        noeud: '>Sarah Traoré<',
        devient: '>{{ annonce.auteur }}<',
        fois: 1,
        frames: ['Mobile'],
        why: 'Le nom de l’auteur, sur le cadre mobile.',
      },
      {
        noeud: '>Connectée à 2 de vos contacts<',
        devient: '>Connectée à {{ annonce.contactsCommuns }} de vos contacts<',
        fois: 1,
        frames: ['Mobile'],
        why: 'Les contacts en commun, sur le cadre mobile.',
      },
    ],
  }),
  /**
   * La feuille « Présentez-vous » a DEUX planches : une carte nue de 480 px pour
   * l'ordinateur et une feuille mobile posée sur un voile. Les deux sont
   * transcodées, `Modal` choisit selon la largeur.
   */
  /**
   * ─── CE QUE CES DEUX PLANCHES LISENT, ET CE QU'ELLES NE PEUVENT PAS LIRE ───
   *
   * Elles parlent de L'ANNONCE QU'ON VIENT DE QUITTER, donc elles reçoivent
   * `S02Data` : la même charge que l'écran, par le même appel, sans un
   * aller-retour de plus. Trois littéraux en sortent :
   *
   *   · le suréacrit « Studio meublé Lyon 7e · Sarah T. » — le titre de l'annonce
   *     et le nom ABRÉGÉ de son auteur, que la maquette écrit « Sarah T. » là où
   *     l'écran écrit « Sarah Traoré ». C'est une mise en forme du même
   *     `author.displayName`, de la même famille que les initiales « ST » que cet
   *     écran dérive déjà ;
   *   · la phrase de pied, « Ce message ouvre votre conversation avec Sarah. » —
   *     le PRÉNOM de l'auteur ;
   *   · le titre de la feuille L0, « Contacter Sarah » — le même prénom, et c'est
   *     donc `retitrerSurDonnees` qui reprend la promotion sur la forme liée.
   *
   * CE QUI RESTE DESSINÉ, et aucune de ces raisons n'est de la fatigue :
   *
   *   · les quatre tuiles de pré-remplissage — « Emménagement · 1er octobre »,
   *     « Durée · 12 mois », « Budget · jusqu'à 650 € CC », « Situation ·
   *     Étudiante · Lyon 3 · Visale » — et la ligne « Pré-rempli depuis votre
   *     parcours « Mes études à Lyon » ». AUCUNE route ne les rend : `grep` sur
   *     `prefill` dans `apps/api` et `packages/shared` ne trouve rien, et
   *     `docs/specs/10-services.md` ne décrit nulle part ce pré-remplissage.
   *     Composer un budget et une date d'emménagement à partir d'un parcours que
   *     personne n'envoie serait inventer la donnée la plus engageante de l'écran.
   *     Remonté au porteur : la maquette promet un pré-remplissage que l'API ne
   *     sait pas faire ;
   *   · l'exemple du champ « Votre message », qui devient un `placeholder`.
   *
   * RÈGLE DURE 10 §7 ET 01 §2.1 SUR CES DEUX PLANCHES : ni score de risque ni
   * téléphone. Compté sur leurs octets — zéro chiffre de risque, zéro numéro, et
   * le seul chemin de contact que la maquette dessine est un MESSAGE, pas un
   * numéro à appeler.
   */
  screen({
    section: 'S02',
    out: 's02contact',
    modal: true,
    dataType: 'S02Data',
    dataModule: '../s02/data',
    modalTitle: 'Présentez-vous',
    // Le nom du cadre porte la VARIANTE, pas seulement la largeur : sans cela ce
    // composant s'appellerait `S02Mobile`, comme celui de la page.
    frames: [f(480, 'DesktopContact'), f(390, 'MobileContact', 1)],
    donnees: [
      {
        noeud:
          '<div style="font-size:12px;font-weight:700;color:#8A958F">Studio meublé Lyon 7e · Sarah T.</div>',
        devient:
          '<div style="font-size:12px;font-weight:700;color:#8A958F">{{ annonce.titre }} · {{ annonce.auteurCourt }}</div>',
        fois: 1,
        why: 'Le suréacrit de la feuille : le titre de l’annonce et le nom abrégé de son auteur, de `GET /housing/:id`.',
      },
      {
        noeud:
          '<div style="font-size:11.5px;color:#8A958F;text-align:center">Ce message ouvre votre conversation avec Sarah.</div>',
        devient:
          '<div style="font-size:11.5px;color:#8A958F;text-align:center">Ce message ouvre votre conversation avec {{ annonce.prenomAuteur }}.</div>',
        fois: 1,
        why: 'La phrase de pied nomme l’auteur de l’annonce par son prénom (08 §5 : écrire ouvre une conversation).',
      },
    ],
  }),
  /**
   * La feuille de l'état L0 n'a qu'UNE planche, mobile. On ne lui en invente pas
   * une pour l'ordinateur : la maquette y dessine cet état dans la colonne de
   * contexte de l'écran lui-même.
   *
   * SON TITRE EST UNE DONNÉE — « Contacter Sarah » nomme l'auteur de l'annonce.
   * Les trois phrases qui suivent sont du TEXTE DE RÈGLE (10 §2.3 : « L1 minimum
   * pour écrire […] l'interface le dit et propose de demander un parrain »), vrai
   * pour tout le monde et pour toute annonce : elles restent dessinées.
   */
  screen({
    section: 'S02',
    out: 's02verification',
    modal: true,
    dataType: 'S02Data',
    dataModule: '../s02/data',
    modalTitle: 'Contacter Sarah',
    frames: [f(390, 'MobileVerification', 2)],
    donnees: [
      {
        noeud: '<div style="font-size:18px;font-weight:800">Contacter Sarah</div>',
        devient:
          '<div style="font-size:18px;font-weight:800">Contacter {{ annonce.prenomAuteur }}</div>',
        fois: 1,
        why: 'Le prénom de l’auteur de l’annonce — et le titre de la feuille, repris sur sa forme liée.',
      },
    ],
  }),

  /**
   * ── S03 · `/services/logement/nouveau` — publier (10 §2.1) ─────────────────
   *
   * L'APERÇU DU SCORE DE RISQUE N'EST PAS AFFICHÉ, et c'est 10 §7 qui l'exige
   * (« aperçu du score de risque non affiché (interne) »). La maquette s'y tient :
   * aucun chiffre de risque nulle part, seulement « Votre annonce est en
   * vérification » dans la colonne APRÈS ENVOI. Vérifié plutôt que supposé.
   *
   * CET ÉCRAN NE LIT QUE LE BANDEAU ET SON RAPPEL, et il faut le dire plutôt que
   * d'inventer une liaison. Ses champs sont un FORMULAIRE VIDE : « Studio meublé
   * Lyon 7e », « 620 € », « Lyon » sont des exemples de saisie, pas des valeurs
   * d'un objet existant. Les lier à `GET /housing/:id` reviendrait à transformer
   * l'écran « Publier » en écran « Modifier », ce que la maquette ne dessine pas.
   *
   * LE FORMULAIRE GRISÉ DE §2.1 MANQUE À LA MAQUETTE. L'API le sert pourtant :
   * `meta.canPublish` et `meta.publishRequirement` (relevés `false` + la phrase,
   * avec un membre L0). La planche « ÉTATS » de S01 en porte le texte mot pour
   * mot, mais ce n'est pas un cadre d'écran et rien ne dit où il s'insère. Remonté
   * au porteur ; il n'est pas ajouté ici, ce serait réécrire la maquette.
   *
   * LE CADRE MOBILE NE LIT RIEN DU TOUT, et la raison est pire que la précédente :
   * la planche de 390 px ne dessine PAS le bandeau de sécurité. Le cadre
   * d'ordinateur l'écrit — « Aucun versement avant visite ou vérification. Ne payez
   * jamais une réservation à distance. » — et il est lié à `meta.safetyBanner`
   * trois lignes plus bas. Le mobile s'arrête aux champs du formulaire.
   *
   * §2.2 ne fait pas d'exception de largeur, et la liaison ne peut rien y faire :
   * sans ancre, il n'y a rien à lier. C'est un trou de MAQUETTE sur l'écran où le
   * membre publie, donc sur celui où la mise en garde compte le plus. Remonté au
   * porteur, et non comblé en ajoutant un bandeau que la planche ne dessine pas.
   *
   * Le corps du titre mobile est 16 px, pas 21 : cet écran n'a pas l'en-tête de
   * section mais une barre à croix de fermeture, plus basse.
   */
  page$({
    section: 'S03',
    out: 's03',
    type: 'S03Data',
    frames: [
      f(1440, 'Desktop', 0, t('Publier une annonce', '28px')),
      f(390, 'Mobile', 0, t('Publier une annonce', '16px')),
    ],
    donnees: [
      ...bandeau(),
      {
        noeud:
          '>Aucun versement avant visite ou vérification. Ne payez jamais une réservation à distance.<',
        devient: '>{{ publication.bandeau }}<',
        fois: 1,
        frames: ['Desktop'],
        why: 'RÈGLE DURE §2.2 : le bandeau vient de `meta.safetyBanner` de `GET /housing`.',
      },
    ],
  }),

  /**
   * ── S04 · `/services/emploi` — offres et profils (10 §3) ───────────────────
   *
   * BRANCHÉ SUR `GET /jobs` ET `GET /job-seekers` : la planche d'ordinateur montre
   * les deux côte à côte — les offres au centre, « PROFILS DISPONIBLES » dans la
   * colonne de contexte — et ce ne sont pas deux onglets mais deux cartes.
   *
   * 10 §3.1, RÈGLE DURE : la pastille « Sponsorisée » est TOUJOURS VISIBLE. Elle
   * est liée dans ses DEUX états dessinés (voir `OFFRES_LIEES`), et son libellé
   * vient du serveur. §11 borne aussi la TÊTE à deux emplacements : c'est
   * `GET /jobs` qui la rend, dans un champ `sponsored` à part de `items`.
   *
   * ÉCART SIGNALÉ : « 8 offres à Lyon et en télétravail » n'est pas lié. Le `meta`
   * de `GET /jobs` ne porte AUCUN `total`, là où `GET /housing` en porte un. Le
   * nombre n'est atteignable par aucune route, et le composer côté front en
   * comptant `items` donnerait le compte de la PAGE, pas celui de la recherche.
   */
  page$({
    section: 'S04',
    out: 's04',
    type: 'S04Data',
    frames: [
      f(1440, 'Desktop', 0, t('Bourses et emploi', '28px')),
      f(390, 'Mobile', 0, t('Services', '21px')),
    ],
    donnees: [
      ...bandeau(),
      {
        noeud: OFFRE_1 + OFFRE_2 + OFFRE_3,
        devient: OFFRES_LIEES,
        fois: 1,
        frames: ['Desktop'],
        why: 'Les offres de `GET /jobs` — la tête sponsorisée d’abord, pastille comprise (§3.1, §11).',
      },
      {
        noeud: PROFILS_DESKTOP,
        devient: PROFILS_LIES,
        fois: 1,
        frames: ['Desktop'],
        why: 'Les profils de recherche de `GET /job-seekers` (§3.2) — aucun CV n’est stocké.',
      },
      {
        noeud: OFFRE_1 + OFFRE_2,
        devient: OFFRES_LIEES,
        fois: 1,
        frames: ['Mobile'],
        why: 'Les mêmes offres sur le cadre mobile — la maquette en dessine deux.',
      },
    ],
  }),

  /**
   * ── S05 · `/services/emploi/:id` — l'offre et sa publication ───────────────
   *
   * Le titre est celui de l'OFFRE. Le cadre d'ordinateur porte aussi le
   * formulaire « PUBLIER UNE OFFRE » dans sa colonne de droite : c'est la même
   * planche, et la maquette lui donne les deux routes.
   *
   * « COMPTABLE JUNIOR » FIGURE DEUX FOIS, et les deux sont liées — `fois: 2`.
   * Ce n'est pas une approximation : la maquette écrit le MÊME intitulé dans le
   * titre de l'offre et dans le champ « Intitulé » du formulaire, parce que la
   * planche documente les deux routes avec un seul exemple. Les lier ensemble
   * garde exactement ce qu'elle dessine ; n'en lier qu'une aurait demandé une
   * ancre portant le style du titre, ce qui aurait cassé la promotion du `<h1>` —
   * `retitrerSurDonnees` compare le texte NU du `noeud` au titre déclaré.
   *
   * ÉCART SIGNALÉ : « 3 sur 5 ce mois-ci », le quota de mise en avant du mois.
   * `UsageMetric` ne compte que `EVENTS_CREATED` et `PRO_CONTACTS` — il n'existe
   * aucune métrique de sponsorisation, donc aucune route ne rend ce compte.
   * `FREE_SPONSORED_JOBS_PER_MONTH` vaut bien 5 dans `@app/shared`, mais le « 3 »
   * est le compte du membre, et il n'est nulle part.
   *
   * Le bouton d'alerte — un drapeau SANS AUCUN TEXTE — est le seul bouton muet de
   * toute la maquette. Son nom est recopié de la maquette elle-même, qui écrit
   * « Signaler » à côté du même tracé sur S02 et S07 (voir `ICON_BUTTON_NAMES`).
   */
  page$({
    section: 'S05',
    out: 's05',
    type: 'S05Data',
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
    donnees: [
      ...bandeau(),
      {
        noeud: '>Comptable junior<',
        devient: '>{{ offre.titre }}<',
        fois: 2,
        frames: ['Desktop'],
        why: 'L’intitulé de l’offre, de `GET /jobs/:id` — titre de la page ET exemple du formulaire.',
      },
      {
        noeud: '>Emploi<',
        devient: '>{{ offre.genre }}<',
        fois: 1,
        frames: ['Desktop'],
        why: 'Le kind de l’offre (§3.1), dans les mots de la maquette.',
      },
      {
        noeud: '>CDI<',
        devient: '>{{ offre.contrat }}<',
        fois: 1,
        frames: ['Desktop'],
        why: 'Le type de contrat, texte libre côté API (`contractType`).',
      },
      {
        noeud: '>Finance<',
        devient: '>{{ offre.secteur }}<',
        fois: 1,
        frames: ['Desktop'],
        why: 'Le secteur de l’offre.',
      },
      {
        noeud: '>Cabinet Arvel · Lyon 3e · publiée il y a 3 jours<',
        devient: '>{{ offre.entreprise }} · {{ offre.ville }} · publiée {{ offre.quand }}<',
        fois: 1,
        frames: ['Desktop'],
        why: 'L’entreprise, la ville et l’ancienneté — `city` est NULLABLE (§3.1, télétravail).',
      },
      {
        noeud:
          '>Cabinet de 12 personnes. Tenue comptable, déclarations, relation clients. Diplôme bac+3, débutant accepté. Salaire 28 à 31 k€.<',
        devient: '>{{ offre.description }}<',
        fois: 1,
        frames: ['Desktop'],
        why: 'La description de l’offre.',
      },
      {
        noeud: '>Cabinet Arvel<',
        devient: '>{{ offre.entreprise }}<',
        fois: 1,
        frames: ['Desktop'],
        why: 'Le champ « Entreprise » du formulaire, que la maquette remplit du même exemple.',
      },
      {
        noeud: '>https://arvel.fr/emploi<',
        devient: '>{{ offre.lien }}<',
        fois: 1,
        frames: ['Desktop'],
        why: 'Le lien de candidature (`externalUrl`) — celui que l’interstitiel de §3.1 annonce.',
      },
      {
        noeud: '>Comptable junior<',
        devient: '>{{ offre.titre }}<',
        fois: 1,
        frames: ['Mobile'],
        why: 'L’intitulé de l’offre, sur le cadre mobile.',
      },
      {
        noeud: '>Emploi<',
        devient: '>{{ offre.genre }}<',
        fois: 1,
        frames: ['Mobile'],
        why: 'Le kind de l’offre, sur le cadre mobile.',
      },
      {
        noeud: '>CDI<',
        devient: '>{{ offre.contrat }}<',
        fois: 1,
        frames: ['Mobile'],
        why: 'Le type de contrat, sur le cadre mobile.',
      },
      {
        noeud: '>Cabinet Arvel · Lyon 3e<',
        devient: '>{{ offre.entreprise }} · {{ offre.ville }}<',
        fois: 1,
        frames: ['Mobile'],
        why: 'Entreprise et ville, que la maquette raccourcit sur mobile.',
      },
      {
        noeud: '>Tenue comptable, déclarations. Débutant accepté.<',
        devient: '>{{ offre.description }}<',
        fois: 1,
        frames: ['Mobile'],
        why: 'La description, raccourcie par la maquette sur mobile — c’est la même donnée.',
      },
    ],
  }),
  /**
   * « Vous quittez la plateforme » — l'interstitiel du lien externe. Une seule
   * planche de 440 px : la même fenêtre sert aux deux largeurs, ce que `Modal`
   * prévoit dans son type.
   *
   * ELLE NOMME LE DOMAINE OÙ L'ON PART, et c'est la seule donnée de la planche —
   * mais c'en est une qui compte : une fenêtre qui dit « vous allez sur arvel.fr »
   * en envoyant ailleurs est pire que pas de fenêtre du tout. Le domaine est
   * l'hôte de `externalUrl`, que l'écran lit déjà sous `offre.lien` (§3.1).
   *
   * LA PHRASE DE PRUDENCE RESTE DESSINÉE : « Ne communiquez jamais de coordonnées
   * bancaires pour une candidature » est vraie pour toute offre et pour tout
   * membre — c'est la mise en garde de §3.1, pas un fait de cette offre-ci.
   */
  screen({
    section: 'S05',
    out: 's05lien',
    modal: true,
    dataType: 'S05Data',
    dataModule: '../s05/data',
    modalTitle: 'Vous quittez la plateforme',
    frames: [f(440, 'LienExterne', 0)],
    donnees: [
      {
        noeud: '<strong style="color:#16211D">arvel.fr</strong>',
        devient: '<strong style="color:#16211D">{{ offre.domaine }}</strong>',
        fois: 1,
        why: 'Le DOMAINE de `externalUrl` — l’hôte réel où le bouton envoie, pas un domaine recopié de la maquette.',
      },
    ],
  }),
  /**
   * « Recommander un membre » (10 §3.3). Une seule planche, de 440 px aussi.
   *
   * CETTE PLANCHE N'A RIEN À LIRE, et il faut le dire plutôt que d'inventer une
   * liaison. C'est un SÉLECTEUR : un champ « Rechercher un membre », UN résultat
   * d'exemple (« Fatou Ndiaye · Assistante RH · Lyon 7e ») et un commentaire. Le
   * membre affiché n'est pas une donnée de l'offre ni du membre connecté — c'est
   * ce que la recherche RENDRA quand on tapera, et `GET /search` n'est appelée par
   * personne au chargement de cette fenêtre. Lier cette ligne à un membre choisi
   * d'avance afficherait quelqu'un que personne n'a cherché.
   *
   * L'exemple du champ « Commentaire » devient un `placeholder` au transcodage.
   */
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
   * BRANCHÉ SUR `GET /pros` (+ le bandeau). « Fiche mise en avant » est écrite en
   * toutes lettres au-dessus des fiches payantes, DEUX fois au plus sur le cadre
   * d'ordinateur — exactement la borne de §4.2, que `meta.featuredSlots` porte.
   *
   * LA TÊTE EST UN CHAMP À PART : `GET /pros` rend `featured` à côté d'`items`,
   * qui l'exclut. Un schéma qui n'aurait décrit qu'`items` aurait fait disparaître
   * les deux fiches signalées — donc la mention, donc la règle. C'est la charge
   * relevée qui l'a appris, pas la lecture du service.
   *
   * 10 §4.1, RÈGLE DURE : aucun téléphone. Cette liste n'en affiche aucun, et
   * `proCardSchema` est `.strict()` — un champ de numéro greffé un jour ferait
   * REFUSER la réponse au lieu d'être dépouillé en silence.
   *
   * « 2 contacts sur 3 ce mois-ci » est lié au MÊME quota que la barre latérale
   * (`usage.items[PRO_CONTACTS]`) : §4.4 n'en compte qu'un, et deux sources pour
   * un seul compteur finiraient par ne plus dire la même chose.
   */
  page$({
    section: 'S06',
    out: 's06',
    type: 'S06Data',
    frames: [
      f(1440, 'Desktop', 0, t('Annuaire professionnel', '28px')),
      f(390, 'Mobile', 0, t('Services', '21px')),
    ],
    donnees: [
      ...bandeau(),
      {
        noeud: '>2 contacts sur 3 ce mois-ci<',
        devient: '>{{ quotas.contactsPro }} contacts sur {{ quotas.plafondPro }} ce mois-ci<',
        fois: 1,
        frames: ['Desktop'],
        why: 'Le même quota de contacts pro que la barre latérale (§4.4) — une seule source.',
      },
      {
        noeud: FICHES_DESKTOP,
        devient: FICHES_LIEES,
        fois: 1,
        frames: ['Desktop'],
        why: 'Les fiches de `GET /pros` — la tête mise en avant d’abord, mention comprise (§4.2).',
      },
      {
        noeud: '>2 contacts sur 3 ce mois-ci<',
        devient: '>{{ quotas.contactsPro }} contacts sur {{ quotas.plafondPro }} ce mois-ci<',
        fois: 1,
        frames: ['Mobile'],
        why: 'Le quota de contacts pro, sur le cadre mobile.',
      },
      {
        noeud: FICHES_MOBILE,
        devient: FICHES_LIEES,
        fois: 1,
        frames: ['Mobile'],
        why: 'Les mêmes fiches sur le cadre mobile — la maquette en dessine deux.',
      },
    ],
  }),

  /**
   * ── S07 · `/services/annuaire/:id` — la fiche pro (10 §4.4) ────────────────
   *
   * BRANCHÉ SUR `GET /pros/:id`. Le titre est le NOM DU PRO. L'élément qui le
   * porte contient AUSSI la pastille de palier : c'est la maquette qui les met
   * dans le même bloc, et le `<h1>` promu les garde tous les deux. Les séparer
   * serait redessiner.
   *
   * ─── RÈGLE DURE 10 §4.1, SUR CET ÉCRAN ────────────────────────────────────
   *
   * « Le téléphone n'est JAMAIS stocké ici ni affiché. » La maquette s'y tenait
   * par le dessin ; l'API s'y tient par le CONTRAT, à deux étages : `proCardSchema`
   * ne décrit AUCUN champ de numéro, et il est `.strict()`, donc une réponse qui
   * en porterait un est refusée avant d'atteindre cet écran. Aucune donnée liée
   * ici n'est un numéro — `contactMethod` est un canal, `contactHint` la phrase de
   * §4.1 qui dit justement que la plateforme ne stocke rien.
   *
   * `contactQuota` VIENT DU SERVEUR (§4.4) et n'est pas recalculé : le front qui
   * relirait le plan du membre afficherait « 3 sur 3 » à un Premium illimité.
   */
  page$({
    section: 'S07',
    out: 's07',
    type: 'S07Data',
    frames: [
      f(1440, 'Desktop', 0, t('Me Mariam Bah', '24px')),
      f(390, 'Mobile', 0, t('Me Mariam Bah', '18px')),
    ],
    donnees: [
      ...bandeau(),
      {
        noeud: '>MB<',
        devient: '>{{ pro.initiales }}<',
        fois: 1,
        frames: ['Desktop'],
        why: 'Les initiales du pro, dérivées de `displayName`.',
      },
      {
        noeud: '>Me Mariam Bah<',
        devient: '>{{ pro.nom }}<',
        fois: 1,
        frames: ['Desktop'],
        why: 'Le nom du pro, de `GET /pros/:id` — et le titre de la page.',
      },
      {
        noeud: '>Pro<',
        devient: '>{{ pro.palier }}<',
        fois: 1,
        frames: ['Desktop'],
        why: 'Le palier EFFECTIF de la fiche (`tier`, §4.1) — `FREE` dès que l’abonnement est échu.',
      },
      {
        noeud: '>Avocate en droit des étrangers · Lyon, Villeurbanne<',
        devient: '>{{ pro.metier }} · {{ pro.villes }}<',
        fois: 1,
        frames: ['Desktop'],
        why: 'Le métier du référentiel (`profession.nameFr`) et les villes couvertes (1 à 10, §4.1).',
      },
      {
        noeud:
          '>Titres de séjour, recours contre les OQTF, regroupement familial. Premier rendez-vous de 30 minutes offert aux membres.<',
        devient: '>{{ pro.description }}<',
        fois: 1,
        frames: ['Desktop'],
        why: 'La description de la fiche — jamais le mot « certifié » (00 §47), que le service refuse.',
      },
      {
        noeud: '>dès 80 €<',
        devient: '>{{ pro.tarif }}<',
        fois: 1,
        frames: ['Desktop'],
        why: 'Les tarifs indicatifs (`priceHint`), texte libre saisi par le pro.',
      },
      {
        noeud: '>Français, Peul<',
        devient: '>{{ pro.langues }}<',
        fois: 1,
        frames: ['Desktop'],
        why: 'Les langues de la fiche, nommées par le référentiel.',
      },
      {
        noeud: '>14<',
        devient: '>{{ pro.recos }}<',
        fois: 1,
        frames: ['Desktop'],
        why: 'Le compteur de recommandations (`recommendationCount`, §4.3).',
      },
      {
        noeud: RECOMMANDATIONS_DESKTOP,
        devient: RECOMMANDATIONS_LIEES,
        fois: 1,
        frames: ['Desktop'],
        why: 'Les recommandations reçues, avec le handle de leur auteur (§4.3).',
      },
      {
        noeud: '>Connectée à 3 de vos contacts<',
        devient: '>Connectée à {{ pro.contactsCommuns }} de vos contacts<',
        fois: 1,
        frames: ['Desktop'],
        why: 'Les contacts en commun (§7), de `mutualConnectionCount`.',
      },
      {
        noeud: '>Utilise 1 de vos 3 contacts du mois<',
        devient: '>Utilise 1 de vos {{ pro.contactsRestants }} contacts du mois<',
        fois: 1,
        frames: ['Desktop'],
        why: 'Le quota du §4.4, de `contactQuota` — décidé par le serveur, jamais recalculé ici.',
      },
      {
        noeud: '>MB<',
        devient: '>{{ pro.initiales }}<',
        fois: 1,
        frames: ['Mobile'],
        why: 'Les initiales du pro, sur le cadre mobile.',
      },
      {
        noeud: '>Me Mariam Bah<',
        devient: '>{{ pro.nom }}<',
        fois: 1,
        frames: ['Mobile'],
        why: 'Le nom du pro — et le titre du cadre mobile.',
      },
      {
        noeud: '>Pro<',
        devient: '>{{ pro.palier }}<',
        fois: 1,
        frames: ['Mobile'],
        why: 'Le palier de la fiche, sur le cadre mobile.',
      },
      {
        noeud: '>Avocate · droit des étrangers<',
        devient: '>{{ pro.metier }}<',
        fois: 1,
        frames: ['Mobile'],
        why: 'Le métier, que la maquette raccourcit sur mobile.',
      },
      {
        noeud: '>Titres de séjour, recours, regroupement familial.<',
        devient: '>{{ pro.description }}<',
        fois: 1,
        frames: ['Mobile'],
        why: 'La description, raccourcie par la maquette sur mobile.',
      },
      {
        noeud: '>dès 80 €<',
        devient: '>{{ pro.tarif }}<',
        fois: 1,
        frames: ['Mobile'],
        why: 'Les tarifs indicatifs, sur le cadre mobile.',
      },
      {
        noeud: '>14<',
        devient: '>{{ pro.recos }}<',
        fois: 1,
        frames: ['Mobile'],
        why: 'Le compteur de recommandations, sur le cadre mobile.',
      },
      {
        noeud: '>Contacter · 1/3<',
        devient: '>Contacter · {{ pro.quotaCourt }}<',
        fois: 1,
        frames: ['Mobile'],
        why: 'Le quota de contacts pro, dans la forme courte du bouton mobile.',
      },
    ],
  }),

  /**
   * ── S08 · `/services/annuaire/ma-fiche` — créer sa fiche (10 §4.1) ─────────
   *
   * L'ordinateur titre « Créer ma fiche pro », le mobile « Ma fiche pro » : c'est
   * la maquette qui abrège son en-tête, comme H09 dit « Fil d'entraide » là où
   * l'ordinateur dit « Mes demandes ». Un titre uniformisé aurait gommé l'écart.
   *
   * CET ÉCRAN NE LIT QUE LE BANDEAU, et c'est un choix qu'il faut défendre plutôt
   * que cacher. `GET /me/pro-profile` existe, son schéma est écrit et éprouvé —
   * mais il rend `null` tant que la fiche n'existe pas, et c'est LE CAS PRINCIPAL
   * de cet écran, qui s'appelle « Créer ma fiche pro ». La planche, elle, dessine
   * un formulaire REMPLI (« Avocate », « Cabinet Bah », « Consultation dès 80 € »)
   * et ne dessine PAS l'état vide. Lier ses champs viderait l'écran pour tous ceux
   * qui viennent le remplir. Remonté au porteur : il manque à la maquette l'état
   * « aucune fiche » que la route rend déjà.
   *
   * ÉCART SIGNALÉ, relevé sur deux charges du MÊME objet : `GET /me/pro-profile`
   * rend `tier: "FREE"` et `isFeatured: false` sur une fiche dont `GET /pros` dit
   * `tier: "PRO"`. `ProsService.myProfile` appelle `toCard(rest, userId)` sans son
   * troisième argument, celui qui porte la mise en avant. Le palier affiché sur
   * « Ma fiche pro » serait donc faux pour un pro payant — une raison de plus de
   * ne pas lier ces champs avant correction.
   */
  page$({
    section: 'S08',
    out: 's08',
    type: 'S08Data',
    frames: [
      f(1440, 'Desktop', 0, t('Créer ma fiche pro', '28px')),
      f(390, 'Mobile', 0, t('Ma fiche pro', '16px')),
    ],
    donnees: [
      ...bandeau(),
      /**
       * ─── LA CARTE D'OFFRE PRO, ET POURQUOI ELLE SE LIE QUAND LE FORMULAIRE NON ──
       *
       * Le raisonnement ci-dessus porte sur les CHAMPS DE LA FICHE, et il tient :
       * les lier viderait l'écran pour qui vient le remplir. Il ne porte PAS sur la
       * carte d'offre que la planche mobile dessine en bas — « Pro · 9 €/mois ·
       * Badge Pro, 10 villes ». Celle-là ne décrit pas la fiche du membre, elle
       * décrit LE PLAN, et le plan vient de `GET /plans` (§7.1), la route que K06
       * lit déjà.
       *
       * UN PRIX FIGÉ DANS LE FRONT EST LE DÉFAUT QUE `donnees` EXISTE POUR TUER :
       * la table `plans` se modifie depuis l'administration (`PATCH /admin/plans/:code`
       * porte `priceCents` et `nameFr`), et cet écran afficherait 9 € le jour où le
       * porteur passe à 12 €. C'est exactement l'argument écrit pour « 4 €/mois »
       * sur K06, et il ne vaut pas moins ici parce que l'écran s'appelle « Ma fiche ».
       *
       * « BADGE PRO, 10 VILLES » RESTE DESSINÉ, et c'est mesuré : `planLimitsSchema`
       * porte `multiCity` et `featuredInDirectory` — des BOOLÉENS — et AUCUN champ
       * ne dit « dix ». Le nombre de villes de la maquette n'a pas de source ; le
       * composer à partir d'un booléen serait inventer la limite. Remonté au
       * porteur : il faudrait un `maxCities` dans les limites du plan, ou retirer le
       * nombre de la planche. La planche d'ordinateur écrit en plus
       * « statistiques », qui n'a pas davantage de champ.
       */
      {
        noeud:
          '<div style="padding:16px;border-radius:18px;background:#EFF7F3;border:2px solid #16785E">' +
          '<div style="font-size:15px;font-weight:700">Pro</div>' +
          '<div style="font-size:20px;font-weight:800;margin-top:6px">9 €/mois</div>',
        devient:
          '<div style="padding:16px;border-radius:18px;background:#EFF7F3;border:2px solid #16785E">' +
          '<div style="font-size:15px;font-weight:700">{{ offrePro.nom }}</div>' +
          '<div style="font-size:20px;font-weight:800;margin-top:6px">{{ offrePro.prix }}</div>',
        fois: 1,
        frames: ['Mobile'],
        why: 'Le plan Pro et son prix mensuel, de `GET /plans` (`nameFr`, `month.eur`) — jamais figés dans le front, puisque l’administration les modifie.',
      },
    ],
  }),

  /**
   * ── S09 · `/services/mes-annonces` (10 §7) ─────────────────────────────────
   *
   * BRANCHÉ SUR `GET /housing?scope=mine` ET `GET /jobs?scope=mine` : les deux
   * onglets « Logement · 2 » et « Emploi · 1 » comptent deux listes différentes, et
   * `scope=mine` est exactement ce que `housingQuerySchema` prévoit pour cet écran
   * (« l'auteur y voit aussi ses annonces en pause »).
   *
   * RÈGLE DURE 00 §49 : « Aucun compteur de vues n'est exposé à personne, sur
   * aucun contenu. » `T5 S09` demande pourtant « compteur de vues et contacts » —
   * et la maquette TRANCHE pour la règle dure, en écrivant dans sa propre légende
   * de route : « /services/mes-annonces · aucun compteur de vues ». Le service
   * INCRÉMENTE bien `viewCount` à chaque lecture — c'est un compteur interne de
   * modération — et aucune réponse ne le porte : `housingCardSchema` est
   * `.strict()`, donc il serait refusé s'il sortait un jour.
   *
   * ÉCART SIGNALÉ : « 6 contacts », que la règle AUTORISE, n'existe dans aucun
   * champ de `HousingCard`. Le sous-titre porte donc l'expiration seule, qui est
   * une donnée réelle de la même réponse (`expiresAt`) — composer un nombre de
   * contacts que personne n'a envoyé serait pire qu'un sous-titre plus court.
   */
  page$({
    section: 'S09',
    out: 's09',
    type: 'S09Data',
    frames: [
      f(1440, 'Desktop', 0, t('Mes annonces', '28px')),
      f(390, 'Mobile', 0, t('Mes annonces', '21px')),
    ],
    donnees: [
      ...bandeau(),
      {
        noeud: '>Logement · 2<',
        devient: '>Logement · {{ mesAnnonces.logement }}<',
        fois: 1,
        frames: ['Desktop'],
        why: 'Mes annonces de logement, de `meta.total` de `GET /housing?scope=mine`.',
      },
      {
        noeud: '>Emploi · 1<',
        devient: '>Emploi · {{ mesAnnonces.emploi }}<',
        fois: 1,
        frames: ['Desktop'],
        why: 'Mes offres d’emploi, comptées sur `items` — `GET /jobs` n’expose aucun `total`.',
      },
      {
        noeud: MES_ANNONCES_DESKTOP,
        devient: MES_ANNONCES_DESKTOP_LIEES,
        fois: 1,
        frames: ['Desktop'],
        why: 'Mes annonces et leur état, de `status` et `reviewState` — les quatre états dessinés.',
      },
      {
        noeud: '>Logement · 2<',
        devient: '>Logement · {{ mesAnnonces.logement }}<',
        fois: 1,
        frames: ['Mobile'],
        why: 'Mes annonces de logement, sur le cadre mobile.',
      },
      {
        noeud: '>Emploi · 1<',
        devient: '>Emploi · {{ mesAnnonces.emploi }}<',
        fois: 1,
        frames: ['Mobile'],
        why: 'Mes offres d’emploi, sur le cadre mobile.',
      },
      {
        noeud: MES_ANNONCES_MOBILE,
        devient: MES_ANNONCES_MOBILE_LIEES,
        fois: 1,
        frames: ['Mobile'],
        why: 'Mes annonces sur le cadre mobile — la maquette y dessine DEUX états : active et en pause.',
      },
    ],
  }),

  /**
   * ── S10 · `/services/alertes` — les alertes Premium (10 §2.4) ──────────────
   *
   * BRANCHÉ SUR `GET /me/alerts`, qui vit dans `housing.controller.ts` et non dans
   * un module `alerts` — celui-ci n'existe pas. §2.4 définit l'alerte avec la
   * recherche de logement, et la même table sert les deux kinds.
   *
   * LES ALERTES SONT RÉSERVÉES À PREMIUM (§2.4), et c'est le SERVEUR qui le dit :
   * `meta.isPremium`. L'encart « Sans Premium » passe donc sous un `<sc-if>` et
   * disparaît pour un membre Premium — relire `users.plan` dans le front se
   * tromperait le jour où un essai ou une grâce Mobile Money change la réponse.
   *
   * La maquette dit la règle sans fermer le reste : « Réservées à Premium, le
   * reste des Services reste gratuit. » C'est le seul écran de ce module qui porte
   * une mention de plan dans son contenu — la barre latérale, elle, en porte une
   * sur les dix.
   *
   * LE FORMULAIRE « NOUVELLE ALERTE » N'EST PAS LIÉ : ses champs sont des exemples
   * de saisie, pas les critères d'un objet existant. Même raison que S03.
   */
  page$({
    section: 'S10',
    out: 's10',
    type: 'S10Data',
    frames: [
      f(1440, 'Desktop', 0, t('Mes alertes', '28px')),
      f(390, 'Mobile', 0, t('Mes alertes', '21px')),
    ],
    donnees: [
      ...bandeau(),
      {
        noeud:
          LIGNE_ALERTE(
            'Logement · Colocation',
            'Lyon 7e, 3e · jusqu’à 500 € · meublé',
            'Dernier envoi : hier',
            INTERRUPTEUR_ACTIF,
          ) +
          LIGNE_ALERTE(
            'Emploi · Alternance',
            'Numérique · Lyon ou télétravail',
            'En pause',
            INTERRUPTEUR_PAUSE,
          ),
        devient: alertesLiees(),
        fois: 1,
        frames: ['Desktop'],
        why: 'Mes alertes, de `GET /me/alerts` : kind, critères relus par leur propre schéma, et état.',
      },
      {
        noeud: ENCART_SANS_PREMIUM,
        devient: '<sc-if value="{{ alertes.sansPremium }}">' + ENCART_SANS_PREMIUM + '</sc-if>',
        fois: 1,
        frames: ['Desktop'],
        why: '§2.4 : l’encart ne s’affiche qu’aux membres sans Premium, selon `meta.isPremium` du SERVEUR.',
      },
      {
        noeud:
          LIGNE_ALERTE(
            'Logement · Colocation',
            'Lyon 7e · 500 €',
            'Hier',
            INTERRUPTEUR_ACTIF,
          ) +
          LIGNE_ALERTE('Emploi · Alternance', 'Numérique', 'En pause', INTERRUPTEUR_PAUSE),
        devient: alertesLiees(),
        fois: 1,
        frames: ['Mobile'],
        why: 'Les mêmes alertes sur le cadre mobile, où la maquette abrège les critères.',
      },
    ],
  }),
];
