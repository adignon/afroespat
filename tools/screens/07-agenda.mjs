/**
 * Les écrans de `docs/template/07 Agenda.dc.html` — E01 à E04.
 *
 * Un fichier par maquette : voir l'en-tête de `01-onboarding.mjs` pour la raison.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * CETTE MAQUETTE N'EMPLOIE PAS LE DIALECTE, ET C'EST `donnees` QUI S'EN CHARGE.
 *
 * Son `renderVals()` rend `{}`, elle ne contient ni `{{ … }}` ni `<sc-for>` —
 * zéro de chacun, compté — et tout son contenu est écrit en clair. Les huit
 * cadres de ce module portaient donc une signature `(_props: AgendaData)` : le
 * souligné dit que le paramètre n'est pas lu, c'est-à-dire que ces écrans
 * recevaient des données et les IGNORAIENT.
 *
 * On ne crée pas la prise en ajoutant des `{{ }}` dans `docs/template/` : le
 * porteur a été formel, on ne réécrit pas les maquettes. On la DÉCLARE ici, avec
 * l'écran — c'est la clé `donnees`, dont `tools/generate-screens.mjs` porte le
 * raisonnement complet et les quatre contrôles. Ce qu'il faut en savoir pour lire
 * ce fichier :
 *
 *   · `noeud` est le littéral de la maquette, VERBATIM, avec ses délimiteurs
 *     (`>Lyon<`) — sans eux il attraperait « Lyon » au milieu d'une phrase ;
 *   · `fois` dit combien de fois la maquette l'écrit DANS CE CADRE, et la
 *     génération ÉCHOUE si le compte ne tombe pas juste ;
 *   · `devient` est la réécriture dans le dialecte, et rien de plus : ce qui
 *     reste de `devient` quand on en ôte les interpolations doit être dessiné
 *     dans `noeud`, dans l'ordre ;
 *   · chaque carte répétée est écrite UNE fois, en fabrique JS paramétrée par ses
 *     textes, et la même fabrique sert à `noeud` ET à `devient`. Le contrôle
 *     compare les deux : la maquette ne peut donc pas dériver sans arrêter la
 *     génération.
 *
 * Les valeurs vivent dans `apps/web/src/screens/agenda/data.ts`, et les appels
 * dans `appels.ts` à côté. Le JSX transcodé n'a pas bougé d'une virgule.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * ─── LE PANNEAU AGENDA EST DESSINÉ SUR LES QUATRE CADRES D'ORDINATEUR ───────
 *
 * Compté, pas supposé : « Septembre 2026 », « Aujourd'hui : samedi 26 · 14
 * événements ce mois-ci », les onze lignes du calendrier vertical, « 1 sur 1 ce
 * mois-ci », « AD » et « Amina » figurent UNE FOIS dans CHACUN des cadres E01,
 * E02, E03 et E04 de 1440 px. C'est le même panneau, répété quatre fois — comme
 * le bandeau de compte l'est sur les dix planches de `08 Compte`.
 *
 * D'où `panneau()` plutôt que quatre copies. Et ce n'est pas une économie de
 * frappe : laisser ce panneau figé sur E02, E03 et E04 donnerait trois écrans où
 * la moitié gauche affiche un calendrier de septembre 2026 pendant que la moitié
 * droite montre un événement réel. C'est l'argument de K02, et il vaut ici au
 * carré, puisque le panneau porte une DATE.
 *
 * ─── CE QUI RESTE DESSINÉ, ET POURQUOI ─────────────────────────────────────
 *
 * Quatre choses, chacune pour une raison nommée — et toutes remontées au porteur
 * plutôt que comblées en devinant :
 *
 *   · LES TROIS PASTILLES DE FILTRE de E01 (« Tous · Mes participations · Mes
 *     organisations ») et LES CINQ CHIPS DE TYPE de E03. Ce ne sont pas des
 *     données mais des CONTRÔLES, et la maquette les dessine en `<span>` : ils ne
 *     sont ni cliquables ni atteignables au clavier. Lier leurs couleurs
 *     laisserait croire à une sélection que rien ne peut changer. En plus, pour
 *     E03, les cinq libellés dessinés (Rencontre, Atelier, Sport, Fête,
 *     Démarches) ne recouvrent PAS les huit valeurs de `EventType` (PICNIC,
 *     SPORT, CV_WORKSHOP, COOKING, NETWORKING, OUTING, CONFERENCE, OTHER), et
 *     aucune table de `T2` ne nomme ces huit-là. Les lier demanderait d'inventer
 *     trois libellés et de deviner quatre correspondances.
 *
 *   · LES CHAMPS DU FORMULAIRE de E03 (titre, description, adresse, dates,
 *     capacité, couverture). La maquette les dessine en `<div>`, pas en `<input>`
 *     : l'écran ne peut donc RIEN envoyer, et une valeur liée y serait un
 *     affichage sans saisie. Ce qui est lié est ce qui est vraiment une donnée du
 *     membre : son quota et sa ville.
 *
 *   · « Organisatrice » sur E02. La maquette GENRE le rôle, et aucun champ de
 *     l'API ne porte le genre. Le lier obligerait à deviner le genre d'un membre
 *     à partir de son prénom. Même constat que les phases de `08 Compte`.
 *
 *   · LA COUVERTURE de E02, un aplat hachuré de 220 px. `coverUrl` existe et peut
 *     être nul ; l'afficher demanderait une `background-image` que la maquette
 *     n'écrit nulle part, donc du dessin ajouté.
 *
 * ─── CE QUE LE BACK NE SAIT PAS DIRE ───────────────────────────────────────
 *
 * `GET /events/:id` rend `communityId` — un UUID — là où la maquette écrit
 * « Réservé · Béninois en France ». Aucune route des événements ne nomme le
 * réseau, et `GET /communities/:slug` prend un SLUG. Le nom est donc résolu par
 * `GET /communities`, dans la liste `mine` : c'est honnête parce qu'un événement
 * réservé n'est VISIBLE que par les membres actifs du réseau (règle dure §10,
 * `loadVisible`) — si la fiche s'affiche, le réseau est dans ma liste. Écart
 * remonté : il manque le nom du réseau dans la projection de l'événement.
 */

import { cadresDuRail, railLitteral } from '../squelette-membre.mjs';
import { barreBasse } from '../squelette-membre.mjs';

const FILE = 'docs/template/07 Agenda.dc.html';

/**
 * ─── LE SQUELETTE MEMBRE : LE RAIL, SUR LES QUATRE CADRES D'ORDINATEUR ──────
 *
 * Les cinq entrées du rail — Accueil, Parcours, Entraide, Services, Agenda —
 * sont dessinées en `<span>` par cette maquette : ce ne sont PAS des liens, et
 * cliquer « Accueil » depuis l'agenda ne faisait rien. Le rail et sa table de
 * destinations sont déclarés une fois dans `tools/squelette-membre.mjs`, pour les
 * sept modules membre.
 *
 * `cadresDuRail` prend les cadres dont le NOM porte « Desktop », parce que le
 * rail n'est que là — mesuré : les quatre planches d'ordinateur de ce module le
 * dessinent, aucune planche mobile ne le fait. Et si la liste tombait fausse, la
 * génération S'ARRÊTERAIT en nommant l'écran : le `dans` de `markLinks` exige son
 * conteneur EXACTEMENT UNE FOIS, donc un cadre sans rail le compte à zéro et
 * refuse. Le défaut ne peut pas être silencieusement faux.
 */

/**
 * SEUL E01 DESSINE LA BARRE D'ONGLETS BASSE, et c'est compté : E02 (la fiche d'un
 * événement), E03 (la création) et E04 (la présence) n'en ont pas — on y entre
 * depuis l'agenda et on en sort par le retour de l'en-tête. Une règle sur le nom
 * « Mobile » les aurait toutes les quatre, et la génération aurait refusé sur les
 * trois dernières en les nommant.
 */
const BARRE_BASSE_AGENDA = new Set(['E01']);

const screen = ({ section, out, frames, dataType, squelette = true, ...rest }) => ({
  file: FILE,
  ...(squelette
    ? {
        liens: [
          ...railLitteral(cadresDuRail(frames)),
          ...(BARRE_BASSE_AGENDA.has(section) ? barreBasse(['Mobile']) : []),
        ],
      }
    : {}),
  section,
  out: `apps/web/src/screens/${out}`,
  dataModule: '../agenda/data',
  dataType,
  frames,
  ...rest,
});

/** Les deux cadres d'un écran : l'ordinateur et le téléphone, avec leurs titres. */
const both = (desktop, mobile) => [
  { width: 1440, name: 'Desktop', title: desktop },
  { width: 390, name: 'Mobile', title: mobile },
];

// ─── Le panneau Agenda, dessiné sur les quatre cadres d'ordinateur ───────────

/**
 * UNE LIGNE DE JOUR DU CALENDRIER VERTICAL, écrite une fois.
 *
 * Les trois variantes que la maquette dessine sont toutes dans ses paramètres :
 *
 *   · jour VIDE — `background:transparent`, `opacity:.45`, aucun point ;
 *   · jour AVEC événements — même fond, pas d'opacité, point vert `#16785E` ;
 *   · jour SÉLECTIONNÉ — fond `#E3F0EB`, numéro en `#0F5C48`, titre en 700, et
 *     point terre cuite `#E0733A` quand j'y participe (§3.5).
 *
 * `opacite` est interpolé plutôt que l'étiquette entière : la maquette écrit
 * `opacity:.45` sur un jour vide et RIEN sur les autres, et `opacity:1` rend
 * exactement le même pixel que l'absence de la propriété. L'alternative —
 * faire porter à la donnée la chaîne « opacity:.45 » — mettrait du CSS dans
 * `data.ts` au lieu d'une valeur.
 */
const LIGNE_JOUR = (fond, opacite, couleur, abbr, numero, poids, titre, point) =>
  '<div style="display:flex;align-items:center;gap:10px;height:40px;padding:0 10px;border-radius:12px;background:' +
  fond +
  ';' +
  opacite +
  '"><span style="width:30px;font-size:10.5px;font-weight:700;color:#8A958F">' +
  abbr +
  '</span><span style="width:22px;font-size:14px;font-weight:800;color:' +
  couleur +
  '">' +
  numero +
  '</span><span style="flex:1;min-width:0;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:' +
  poids +
  '">' +
  titre +
  '</span>' +
  point +
  '</div>';

/** Le point d'une ligne de calendrier : vert « près de moi », terre cuite « j'y vais ». */
const POINT = (couleur) =>
  '<span style="width:8px;height:8px;border-radius:999px;background:' + couleur + '"></span>';

/** L'intitulé d'une semaine. La maquette donne DEUX remplissages : 1re semaine, puis les autres. */
const ENTETE_SEMAINE = (marge, libelle) =>
  '<div style="font-size:10.5px;font-weight:700;color:#8A958F;padding:' +
  marge +
  '">' +
  libelle +
  '</div>';

/** Un jour vide : la variante la plus fréquente du calendrier. */
const JOUR_VIDE = (abbr, numero) =>
  LIGNE_JOUR('transparent', 'opacity:.45', '#16211D', abbr, numero, '500', '', '');

/** Un jour qui porte des événements près de moi. */
const JOUR_PLEIN = (abbr, numero, titre) =>
  LIGNE_JOUR('transparent', '', '#16211D', abbr, numero, '500', titre, POINT('#16785E'));

/**
 * LES ONZE LIGNES DU CALENDRIER, exactement comme la maquette les dessine.
 *
 * Les deux semaines sont liées EN BLOC par une boucle imbriquée — semaines, puis
 * jours — et non ligne par ligne : le calendrier glissant de §3.5 compte six
 * semaines, pas deux, et une liaison ligne par ligne figerait leur nombre.
 */
const CALENDRIER_MAQUETTE =
  ENTETE_SEMAINE('6px 10px', 'SEMAINE 38') +
  JOUR_VIDE('LUN', '16') +
  JOUR_PLEIN('MAR', '17', 'Permanence CAF') +
  JOUR_VIDE('MER', '18') +
  JOUR_PLEIN('JEU', '19', 'Atelier CV') +
  JOUR_VIDE('VEN', '20') +
  LIGNE_JOUR('#E3F0EB', '', '#0F5C48', 'SAM', '21', '700', 'Repas partagé', POINT('#E0733A')) +
  JOUR_PLEIN('DIM', '22', 'Match amical') +
  ENTETE_SEMAINE('10px 10px 6px', 'SEMAINE 39') +
  JOUR_VIDE('LUN', '23') +
  LIGNE_JOUR('transparent', '', '#16211D', 'MAR', '24', '500', 'Apéro Diaspora', POINT('#E0733A')) +
  JOUR_VIDE('MER', '25') +
  JOUR_PLEIN('JEU', '26', 'Permanence consulaire');

/** Le même calendrier, piloté : une semaine, un jour, et les deux variantes de point. */
const CALENDRIER_LIE =
  '<sc-for list="{{ panneau.semaines }}" as="sem">' +
  ENTETE_SEMAINE('{{ sem.marge }}', 'SEMAINE {{ sem.numero }}') +
  '<sc-for list="{{ sem.jours }}" as="j">' +
  LIGNE_JOUR(
    '{{ j.fond }}',
    'opacity:{{ j.opacite }}',
    '{{ j.couleur }}',
    '{{ j.abbr }}',
    '{{ j.numero }}',
    '{{ j.poids }}',
    '{{ j.titre }}',
    '<sc-if value="{{ j.point }}">' + POINT('{{ j.point }}') + '</sc-if>',
  ) +
  '</sc-for>' +
  '</sc-for>';

/**
 * Les six liaisons du panneau, à répéter sur les quatre cadres d'ordinateur.
 *
 * `moi` est l'identité du membre connecté (barre haute), `panneau` le mois, le
 * jour courant, le calendrier et le quota. Le niveau de vérification n'y figure
 * pas : la maquette ne l'écrit pas ici, et il ne servirait de toute façon jamais
 * à autoriser quoi que ce soit.
 */
const panneau = () => [
  {
    noeud: '>AD<',
    devient: '>{{ moi.initiales }}<',
    fois: 1,
    frames: ['Desktop'],
    why: 'Les initiales de l’avatar de la barre haute, dérivées du nom affiché de `GET /me`.',
  },
  {
    noeud: '>Amina<',
    devient: '>{{ moi.prenom }}<',
    fois: 1,
    frames: ['Desktop'],
    why: 'Le prénom de la barre haute, premier mot du nom affiché (`GET /me`).',
  },
  {
    noeud: '>Septembre 2026<',
    devient: '>{{ panneau.mois }}<',
    fois: 1,
    frames: ['Desktop'],
    why: 'Le mois affiché par le panneau, celui de l’intervalle demandé à `GET /events/calendar`.',
  },
  {
    noeud: '>Aujourd\'hui : samedi 26 · 14 événements ce mois-ci<',
    devient:
      '>Aujourd\'hui : {{ panneau.aujourdhui }} · {{ panneau.totalMois }} événements ce mois-ci<',
    fois: 1,
    frames: ['Desktop'],
    why: 'Le jour courant dans le fuseau que `meta.timeZone` annonce, et la somme des `total` du mois.',
  },
  {
    noeud: CALENDRIER_MAQUETTE,
    devient: CALENDRIER_LIE,
    fois: 1,
    frames: ['Desktop'],
    why: 'Le calendrier vertical, de `GET /events/calendar` : un objet par jour, les vides compris (§3.5) — point vert « près de moi », terre cuite « j’y participe ».',
  },
  {
    noeud: '>1 sur 1 ce mois-ci<',
    devient: '>{{ panneau.quota.utilise }} sur {{ panneau.quota.plafond }} ce mois-ci<',
    fois: 1,
    frames: ['Desktop'],
    why: 'Le quota d’événements du mois, de `GET /me/subscription` (`usage.items`, métrique EVENTS_CREATED) — jamais un nombre figé dans le front.',
  },
];

// ─── Les cartes que la maquette répète, écrites UNE fois ─────────────────────

/** Une pastille, telle que la maquette la dessine partout dans ce module. */
const PASTILLE = (fond, texte, libelle) =>
  '<span style="background:' +
  fond +
  ';color:' +
  texte +
  ';font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px;white-space:nowrap">' +
  libelle +
  '</span>';

/** E01 — une carte d'événement du jour. Les deux cadres la dessinent à l'identique. */
const CARTE_JOUR = (fondDate, numero, abbr, pastilles, titre, meta) =>
  '<div style="background:#fff;border:1px solid #E6EBE9;border-radius:22px;padding:16px;flex-shrink:0;">' +
  '<div style="display:flex;gap:14px;align-items:center">' +
  '<div style="width:60px;height:60px;border-radius:18px;background:' +
  fondDate +
  ';display:flex;flex-direction:column;align-items:center;justify-content:center;flex-shrink:0">' +
  '<span style="font-size:10px;font-weight:800;color:#B4581F">' +
  numero +
  '</span><span style="font-size:21px;font-weight:800;line-height:1;color:#16211D">' +
  abbr +
  '</span></div><div style="flex:1;min-width:0"><div style="display:flex;gap:6px;flex-wrap:wrap">' +
  pastilles +
  '</div><div style="font-size:15.5px;font-weight:700;margin-top:6px">' +
  titre +
  '</div><div style="font-size:12.5px;color:#5D6B66;margin-top:2px">' +
  meta +
  '</div></div>' +
  '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#16211D" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg></div></div>';

/**
 * Les pastilles d'une carte, en version PILOTÉE.
 *
 * Les deux variantes que la maquette dessine passent sous `<sc-if>` : la pastille
 * terre cuite « Vous y allez » (§3.5 : « celles où je participe en tête, marquées
 * d'une pastille ») et la pastille verte du réseau quand l'événement lui est
 * réservé. Garder une seule des deux donnerait un écran qui marque tout le monde,
 * ou plus personne.
 */
const PASTILLES_LIEES = (avecReseau) =>
  '<sc-if value="{{ ev.jyVais }}">' +
  PASTILLE('#E0733A', '#fff', 'Vous y allez') +
  '</sc-if>' +
  PASTILLE('#F2F5F4', '#5D6B66', '{{ ev.type }}') +
  (avecReseau
    ? '<sc-if value="{{ ev.reseau }}">' + PASTILLE('#E3F0EB', '#0F5C48', '{{ ev.reseau }}') + '</sc-if>'
    : '');

/** E01 mobile — une pastille de date de la bande horizontale défilante (§3.5). */
const DATE_BANDE = (fond, bord, couleur, opacite, abbr, numero, point) =>
  '<div style="width:50px;flex-shrink:0;height:64px;border-radius:16px;background:' +
  fond +
  ';border:1px solid ' +
  bord +
  ';color:' +
  couleur +
  ';display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;' +
  opacite +
  '"><span style="font-size:10px;font-weight:700">' +
  abbr +
  '</span><span style="font-size:17px;font-weight:800">' +
  numero +
  '</span><span style="width:6px;height:6px;border-radius:999px;background:' +
  point +
  '"></span></div>';

/** E01 — une ligne de la carte « CE WEEK-END » de la colonne de contexte. */
const LIGNE_WEEKEND = (titre, quand) =>
  '<div style="padding:10px 0;border-bottom:1px solid #F0F3F2">' +
  '<div style="font-size:13px;font-weight:700">' +
  titre +
  '</div><div style="font-size:11.5px;color:#8A958F">' +
  quand +
  '</div></div>';

/** E02 — un avatar empilé de la file des participants. */
const AVATAR_EMPILE = (fond, initiales) =>
  '<span style="width:30px;height:30px;border-radius:999px;background:' +
  fond +
  ';color:#fff;font-size:9px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;border:2px solid #fff;margin-left:-8px">' +
  initiales +
  '</span>';

/** E02 — un des trois boutons de RSVP (§3.2). Le fond et le texte disent lequel est actif. */
const BOUTON_RSVP = (fond, texte, libelle) =>
  '<span style="height:46px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:13.5px;font-weight:700;background:' +
  fond +
  ';color:' +
  texte +
  '">' +
  libelle +
  '</span>';

/** E02 — la carte d'état « COMPLET » de la colonne de droite (§3.2). */
const CARTE_COMPLET =
  '<div style="background:#fff;border:1px solid #E6EBE9;border-radius:22px;padding:18px;flex-shrink:0;"><div style="font-size:10.5px;font-weight:700;letter-spacing:1px;color:#8A958F">COMPLET</div><div style="margin-top:10px"><button style="height:44px;padding:0 18px;border-radius:14px;background:#F2F5F4;color:#16211D;border:none;font:inherit;font-size:13.5px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:8px;white-space:nowrap;flex-shrink:0;width:100%">Rejoindre la liste d’attente</button></div><div style="font-size:11.5px;color:#8A958F;margin-top:6px">Vous êtes 3e sur la liste</div></div>';

/** E02 — la carte d'état « VUE ORGANISATEUR » (§3.2 : Modifier, Annuler, Cocher). */
const CARTE_ORGANISATEUR =
  '<div style="background:#fff;border:1px solid #E6EBE9;border-radius:22px;padding:18px;flex-shrink:0;"><div style="font-size:10.5px;font-weight:700;letter-spacing:1px;color:#8A958F">VUE ORGANISATEUR</div><div style="display:flex;flex-direction:column;gap:8px;margin-top:10px"><button style="height:44px;padding:0 18px;border-radius:14px;background:#16785E;color:#fff;border:none;font:inherit;font-size:13.5px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:8px;white-space:nowrap;flex-shrink:0;width:100%"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 4.5 4.5L19 7"/></svg>Cocher les présents</button><button style="height:44px;padding:0 18px;border-radius:14px;background:#F2F5F4;color:#16211D;border:none;font:inherit;font-size:13.5px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:8px;white-space:nowrap;flex-shrink:0;width:100%"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#16211D" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>Modifier</button><button style="height:44px;padding:0 18px;border-radius:14px;background:#fff;color:#16211D;border:none;font:inherit;font-size:13.5px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:8px;white-space:nowrap;flex-shrink:0;width:100%;border:1px solid #E6EBE9">Annuler l’événement</button></div></div>';

/**
 * E04 — une ligne de la feuille de présence.
 *
 * `case` porte les DEUX variantes que la maquette dessine : la case cochée (fond
 * `#16785E`, avec son chevron) et la case vide (fond blanc, bord `#CBD5D1`).
 */
const LIGNE_PRESENCE = (fond, initiales, nom, boite) =>
  '<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid #F0F3F2">' +
  '<span style="width:36px;height:36px;border-radius:999px;background:' +
  fond +
  ';color:#fff;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
  initiales +
  '</span><span style="flex:1;font-size:14px;font-weight:600">' +
  nom +
  '</span><span style="display:flex;align-items:center;gap:8px;font-size:12.5px;color:#5D6B66">Présent·e' +
  boite +
  '</span></div>';

const CASE_COCHEE =
  '<span style="width:24px;height:24px;border-radius:8px;background:#16785E;border:none;display:flex;align-items:center;justify-content:center">' +
  '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="m5 12 4.5 4.5L19 7"/></svg></span>';

const CASE_VIDE =
  '<span style="width:24px;height:24px;border-radius:8px;background:#fff;border:1.5px solid #CBD5D1;display:flex;align-items:center;justify-content:center"></span>';

/**
 * LES DEUX CASES SOUS CONDITION, ET LA TROISIÈME POSSIBILITÉ : AUCUNE.
 *
 * `coche` et `vide` sont FAUX tous les deux quand la présence est INCONNUE — ce
 * qui arrive dès que le lecteur n'est pas l'organisateur, puisque §5 ne lui
 * envoie alors ni `userId` ni `checkedIn`. La ligne ne dessine alors aucune case,
 * plutôt qu'une case vide qui affirmerait « absent ». C'est la différence entre
 * ne pas savoir et dire non.
 */
const CASES_LIEES =
  '<sc-if value="{{ p.coche }}">' +
  CASE_COCHEE +
  '</sc-if><sc-if value="{{ p.vide }}">' +
  CASE_VIDE +
  '</sc-if>';

export const screens = [
  /**
   * ── E01 · /agenda ──────────────────────────────────────────────────────────
   *
   * L'ordinateur titre le JOUR SÉLECTIONNÉ — « Samedi 21 septembre » — et le
   * mobile la section, « Agenda ». C'est exactement ce que la spec décrit
   * (09 §3.5 : « titre du jour sélectionné » sur la page, « bande horizontale de
   * dates défilante sous le titre » sur mobile) : le mobile porte son sélecteur de
   * date en bande, donc son titre ne peut pas être la date.
   *
   * LE TITRE D'ORDINATEUR EST DONC UNE DONNÉE, et le générateur le reprend sur sa
   * forme liée — voir `retitrerSurDonnees`.
   *
   * BRANCHÉ SUR TROIS ROUTES DE LECTURE, et chacune pour ce qu'elle sait dire :
   *   · `GET /events/calendar?from&to` — le panneau de gauche, un objet par jour ;
   *   · `GET /events?date=` — les cartes du jour, « mes participations en tête »
   *     étant un tri du SERVEUR (§3.5) que le front ne refait pas ;
   *   · `GET /events?from&to` sur le week-end — la carte « CE WEEK-END », qui a
   *     besoin des HEURES que le calendrier ne porte pas.
   *
   * Plus `GET /me/subscription` pour le quota et `GET /users/{pseudo}` pour le nom
   * de ma ville : `GET /me` ne rend que `cityId`. C'est l'écart déjà remonté par
   * K01, et le même chemin honnête est repris ici plutôt qu'un second inventé.
   */
  screen({
    section: 'E01',
    /**
     * LA CARTE SORT DE SON CADRE — voir `composants` sur A01 pour le pourquoi.
     *
     * Le porteur : « pour tous les tabs il reprend le design des éléments
     * présentés de la façon dont ils sont présentés sur les pages d'origine ».
     * Le profil public monte donc CETTE carte-ci, pas une copie.
     */
    composants: [
      {
        nom: 'CarteEvenement',
        depuis: 'evenements',
        as: 'ev',
        type: 'CarteEvenement',
        cadres: ['Desktop', 'Mobile'],
      },
    ],
    out: 'e01',
    dataType: 'E01Data',
    frames: both('Samedi 21 septembre', 'Agenda'),
    donnees: [
      ...panneau(),
      {
        noeud: '>Samedi 21 septembre<',
        devient: '>{{ jour }}<',
        fois: 1,
        frames: ['Desktop'],
        why: 'Le jour sélectionné, titre de la page — « aujourd’hui, ou le prochain jour avec événement » (§3.5).',
      },
      {
        noeud: '>3 événements près de chez vous<',
        /**
         * LE « s » EST UNE DONNÉE, et c'est la seule façon honnête de le faire.
         *
         * La maquette écrit « 3 événements » : lier le seul nombre produirait
         * « 1 événements » dès qu'il n'y en a qu'un, ce qui arrive tous les jours.
         * Composer la phrase entière dans `data.ts` ferait sortir « événements » et
         * « près de chez vous » de la maquette. On lie donc le nombre ET la marque
         * du pluriel, et le reste de la phrase reste dessiné.
         */
        devient: '>{{ nombre }} événement{{ pluriel }} près de chez vous<',
        fois: 1,
        frames: ['Desktop'],
        why: 'Le nombre d’événements du jour sélectionné, compté sur la réponse de `GET /events?date=`.',
      },
      {
        noeud:
          CARTE_JOUR(
            '#FBE3D4',
            '21',
            'SAM',
            PASTILLE('#E0733A', '#fff', 'Vous y allez') +
              PASTILLE('#F2F5F4', '#5D6B66', 'Rencontre') +
              PASTILLE('#E3F0EB', '#0F5C48', 'Béninois en France'),
            'Repas partagé béninois',
            'Maison des Assos, Lyon 7e · 12 h · 27 participants',
          ) +
          CARTE_JOUR(
            '#E3F0EB',
            '21',
            'SAM',
            PASTILLE('#F2F5F4', '#5D6B66', 'Atelier'),
            'Atelier budget étudiant',
            'Bibliothèque Part-Dieu · 14 h · 18 participants',
          ) +
          CARTE_JOUR(
            '#E3F0EB',
            '21',
            'SAM',
            PASTILLE('#F2F5F4', '#5D6B66', 'Sport'),
            'Foot entre membres',
            'Parc de Gerland · 16 h · 22 participants',
          ),
        devient:
          '<sc-for list="{{ evenements }}" as="ev">' +
          CARTE_JOUR(
            '{{ ev.fondDate }}',
            '{{ ev.numero }}',
            '{{ ev.abbr }}',
            PASTILLES_LIEES(true),
            '{{ ev.titre }}',
            '{{ ev.lieu }} · {{ ev.heure }} · {{ ev.participants }} participant{{ ev.pluriel }}',
          ) +
          '</sc-for>',
        fois: 1,
        frames: ['Desktop'],
        why: 'Les événements du jour, de `GET /events?date=` : bloc de date, pastilles, titre, lieu, heure et compteur (§3.5).',
      },
      {
        noeud:
          LIGNE_WEEKEND('Repas partagé béninois', 'samedi 12 h') +
          LIGNE_WEEKEND('Match amical', 'dimanche 10 h'),
        devient:
          '<sc-for list="{{ weekEnd }}" as="w">' +
          LIGNE_WEEKEND('{{ w.titre }}', '{{ w.quand }}') +
          '</sc-for>',
        fois: 1,
        frames: ['Desktop'],
        why: 'La carte « CE WEEK-END » de la colonne de contexte, de `GET /events?from&to` sur le prochain samedi et dimanche.',
      },
      {
        noeud: '>LYON<',
        devient: '>{{ ville }}<',
        fois: 1,
        frames: ['Desktop'],
        why: 'Ma ville, celle dont l’agenda est affiché — résolue par `GET /users/{pseudo}`, `GET /me` ne rendant que `cityId`.',
      },
      /**
       * LE CADRE MOBILE AUSSI, et pas par symétrie décorative : `ScreenFrames`
       * rend LES DEUX cadres et n'en masque qu'un. Lier la bande de dates sur le
       * seul ordinateur laisserait « SAM 21 » écrit en dur dans le document servi
       * au téléphone — donc dans ce que lit un test, un moteur de recherche ou un
       * lecteur d'écran. La moitié de l'écran mentirait.
       */
      {
        noeud:
          DATE_BANDE('#fff', '#E6EBE9', '#16211D', '', 'JEU', '19', '#16785E') +
          DATE_BANDE('#fff', '#E6EBE9', '#16211D', 'opacity:.5', 'VEN', '20', 'transparent') +
          DATE_BANDE('#16785E', '#16785E', '#fff', '', 'SAM', '21', '#E0733A') +
          DATE_BANDE('#fff', '#E6EBE9', '#16211D', '', 'DIM', '22', '#16785E') +
          DATE_BANDE('#fff', '#E6EBE9', '#16211D', 'opacity:.5', 'LUN', '23', 'transparent') +
          DATE_BANDE('#fff', '#E6EBE9', '#16211D', '', 'MAR', '24', '#E0733A') +
          DATE_BANDE('#fff', '#E6EBE9', '#16211D', 'opacity:.5', 'MER', '25', 'transparent'),
        devient:
          '<sc-for list="{{ bande }}" as="j">' +
          DATE_BANDE(
            '{{ j.fond }}',
            '{{ j.bord }}',
            '{{ j.couleur }}',
            'opacity:{{ j.opacite }}',
            '{{ j.abbr }}',
            '{{ j.numero }}',
            '{{ j.point }}',
          ) +
          '</sc-for>',
        fois: 1,
        frames: ['Mobile'],
        why: 'La bande horizontale de dates du mobile (§3.5), des mêmes jours de `GET /events/calendar` que le calendrier vertical.',
      },
      {
        noeud: '>Samedi 21 septembre<',
        devient: '>{{ jour }}<',
        fois: 1,
        frames: ['Mobile'],
        why: 'Le jour sélectionné, écrit dans le corps sur mobile puisque l’en-tête porte la section.',
      },
      {
        noeud:
          CARTE_JOUR(
            '#FBE3D4',
            '21',
            'SAM',
            PASTILLE('#E0733A', '#fff', 'Vous y allez') + PASTILLE('#F2F5F4', '#5D6B66', 'Rencontre'),
            'Repas partagé béninois',
            'Lyon 7e · 27 participants',
          ) +
          CARTE_JOUR(
            '#E3F0EB',
            '21',
            'SAM',
            PASTILLE('#F2F5F4', '#5D6B66', 'Atelier'),
            'Atelier budget étudiant',
            'Part-Dieu · 18 participants',
          ),
        devient:
          '<sc-for list="{{ evenements }}" as="ev">' +
          CARTE_JOUR(
            '{{ ev.fondDate }}',
            '{{ ev.numero }}',
            '{{ ev.abbr }}',
            PASTILLES_LIEES(false),
            '{{ ev.titre }}',
            '{{ ev.lieuCourt }} · {{ ev.participants }} participant{{ ev.pluriel }}',
          ) +
          '</sc-for>',
        fois: 1,
        frames: ['Mobile'],
        why: 'Les mêmes événements, avec le sous-titre court que la maquette écrit sur mobile — et sans la pastille de réseau, qu’elle n’y dessine pas.',
      },
    ],
  }),

  /**
   * ── E02 · /agenda/:id ──────────────────────────────────────────────────────
   *
   * Le titre est le NOM DE L'ÉVÉNEMENT, aux deux largeurs, et c'est une donnée :
   * la maquette n'écrit pas d'autre titre, et « Détail d’un événement » serait le
   * titre inventé qui a déjà coûté A01.
   *
   * BRANCHÉ SUR `GET /events/:id`. Les trois cartes de la colonne de droite sont
   * des ÉTATS, et chacune passe sous sa condition — c'est la maquette qui les
   * dessine toutes les trois côte à côte, en planche de documentation :
   *
   *   · « PENDANT L'ÉVÉNEMENT » reste affichée, et ses heures sont liées. La
   *     fenêtre de « Je suis là » (H−0 à H+6, §3.3) n'est PAS recalculée ici :
   *     c'est le serveur qui la tient (`CHECKIN_WINDOW_CLOSED`), et comparer
   *     `startsAt` à l'horloge du navigateur afficherait le bouton ouvert ou fermé
   *     selon le réglage de la machine du membre ;
   *   · « COMPLET » n'apparaît que si la capacité est atteinte, et sa ligne « Vous
   *     êtes 3e sur la liste » seulement si je suis vraiment sur la liste
   *     d'attente — deux conditions imbriquées, parce que ce sont deux faits
   *     différents ;
   *   · « VUE ORGANISATEUR » n'apparaît que pour l'organisateur, et c'est le
   *     SERVEUR qui le dit (`isOrganizer`).
   *
   * AUCUN DES TROIS BOUTONS DE RSVP N'EST BRANCHÉ, et c'est délibéré : la maquette
   * les dessine en `<span>`, donc ils ne sont ni cliquables ni atteignables au
   * clavier. Ce qui EST lié, c'est lequel est actif — `myStatus` décide, et les
   * deux paires de couleurs sont celles que la maquette dessine. Un bouton inerte
   * est moins nuisible qu'un bouton qui ment, et `PUT /events/:id/rsvp` attend.
   */
  screen({
    section: 'E02',
    out: 'e02',
    dataType: 'E02Data',
    frames: both('Repas partagé béninois', 'Repas partagé béninois'),
    donnees: [
      ...panneau(),
      {
        noeud: PASTILLE('#E3F0EB', '#0F5C48', 'Réservé · Béninois en France'),
        devient:
          '<sc-if value="{{ evenement.reseau }}">' +
          PASTILLE('#E3F0EB', '#0F5C48', 'Réservé · {{ evenement.reseau }}') +
          '</sc-if>',
        fois: 1,
        frames: ['Desktop'],
        why: 'La pastille de réseau réservé (règle dure §10) : le nom vient de `GET /communities` (`mine`), l’événement ne portant que `communityId`.',
      },
      {
        noeud: PASTILLE('#F2F5F4', '#5D6B66', 'Rencontre'),
        devient: PASTILLE('#F2F5F4', '#5D6B66', '{{ evenement.type }}'),
        fois: 1,
        frames: ['Desktop'],
        why: 'Le type de l’événement, de `GET /events/:id`.',
      },
      {
        noeud: '>Repas partagé béninois<',
        devient: '>{{ evenement.titre }}<',
        fois: 1,
        frames: ['Desktop'],
        why: 'Le titre de l’événement — et le titre de la page.',
      },
      {
        noeud: '>Samedi 21 septembre · 12 h – 16 h<',
        devient: '>{{ evenement.quand }}<',
        fois: 1,
        frames: ['Desktop'],
        why: 'La date et les heures, formatées dans le fuseau de la VILLE de l’événement (`timeZone`), jamais celui du navigateur.',
      },
      {
        noeud: '>Maison des Associations · 28 rue Denfert-Rochereau, Lyon 7e<',
        devient: '>{{ evenement.lieu }} · {{ evenement.adresse }}<',
        fois: 1,
        frames: ['Desktop'],
        why: 'Le nom du lieu et l’adresse en TEXTE LIBRE (`addressText`) : rien n’est géocodé (règle dure §10).',
      },
      {
        noeud: '>AI<',
        devient: '>{{ evenement.organisateur.initiales }}<',
        fois: 1,
        frames: ['Desktop'],
        why: 'Les initiales de l’organisateur, dérivées de son nom affiché.',
      },
      {
        noeud: '>Aïcha Diop<',
        devient: '>{{ evenement.organisateur.nom }}<',
        fois: 1,
        frames: ['Desktop'],
        why: 'Le nom affiché de l’organisateur, de `GET /events/:id`.',
      },
      {
        noeud:
          '<p style="margin:14px 0 0;font-size:14.5px;line-height:1.65">Chacun apporte un plat du pays. Pensez aux boîtes pour repartir avec les restes !</p>',
        devient:
          '<sc-if value="{{ evenement.description }}"><p style="margin:14px 0 0;font-size:14.5px;line-height:1.65">{{ evenement.description }}</p></sc-if>',
        fois: 1,
        frames: ['Desktop'],
        why: 'La description, facultative dans `createEventSchema` : absente, le paragraphe disparaît au lieu de laisser un blanc.',
      },
      {
        noeud:
          AVATAR_EMPILE('#2FA37D', 'FN') +
          AVATAR_EMPILE('#E0733A', 'KB') +
          AVATAR_EMPILE('#0F5C48', 'SM') +
          AVATAR_EMPILE('#8A958F', '+24'),
        devient:
          '<sc-for list="{{ evenement.avatars }}" as="a">' +
          AVATAR_EMPILE('{{ a.fond }}', '{{ a.initiales }}') +
          '</sc-for><sc-if value="{{ evenement.reste }}">' +
          AVATAR_EMPILE('#8A958F', '+{{ evenement.reste }}') +
          '</sc-if>',
        fois: 1,
        frames: ['Desktop'],
        why: 'Les avatars des participants `GOING` (§3.2), de `attendees` ; le rond gris ne compte le reste que s’il y en a un.',
      },
      {
        noeud: '<strong style="color:#16211D">27</strong> sur 40 places',
        /**
         * L'ESPACE RESTE HORS DU `<sc-if>`, et c'est une mesure, pas un goût :
         * `transcode` applique `.trim()` au corps d'un `<sc-if>`, donc une
         * condition qui commencerait par « ␣sur » rendrait « 2sur 40 places ». Vu
         * au navigateur, corrigé en déplaçant l'espace dans le texte du parent —
         * sans toucher au générateur, qui est partagé.
         */
        devient:
          '<strong style="color:#16211D">{{ evenement.inscrits }}</strong> <sc-if value="{{ evenement.places }}">sur {{ evenement.places }} place{{ evenement.plurielPlaces }}</sc-if>',
        fois: 1,
        frames: ['Desktop'],
        why: 'Le compteur de participants et la capacité — `capacity` étant facultative, « sur N places » disparaît quand il n’y a pas de limite.',
      },
      {
        noeud: BOUTON_RSVP('#16785E', '#fff', 'Je viens'),
        devient: BOUTON_RSVP('{{ choix.vient.fond }}', '{{ choix.vient.texte }}', 'Je viens'),
        fois: 1,
        frames: ['Desktop'],
        why: 'L’état du bouton « Je viens » : actif quand `myStatus` vaut GOING ou WAITLIST, dans les deux couleurs que la maquette dessine.',
      },
      {
        noeud: BOUTON_RSVP('#F2F5F4', '#16211D', 'Peut-être'),
        devient: BOUTON_RSVP('{{ choix.peutEtre.fond }}', '{{ choix.peutEtre.texte }}', 'Peut-être'),
        fois: 1,
        frames: ['Desktop'],
        why: 'L’état du bouton « Peut-être », sur `myStatus` = MAYBE.',
      },
      {
        noeud: BOUTON_RSVP('#F2F5F4', '#16211D', 'Je ne viens pas'),
        devient: BOUTON_RSVP('{{ choix.refuse.fond }}', '{{ choix.refuse.texte }}', 'Je ne viens pas'),
        fois: 1,
        frames: ['Desktop'],
        why: 'L’état du bouton « Je ne viens pas », sur `myStatus` = DECLINED.',
      },
      {
        noeud: '>Actif de 12 h à 16 h<',
        devient: '>Actif de {{ presence.debut }} à {{ presence.fin }}<',
        fois: 1,
        frames: ['Desktop'],
        why: 'La fenêtre de « Je suis là », bornée par les heures RÉELLES de l’événement (§3.3) — jamais par l’horloge du navigateur.',
      },
      /**
       * LES DEUX CARTES D'ÉTAT DE LA COLONNE DE DROITE, chacune sous sa condition.
       *
       * DÉFAUT TROUVÉ PAR LE TEST DE BOUT EN BOUT, pas par relecture : ces deux
       * cartes n'étaient PAS liées, et « VUE ORGANISATEUR » s'affichait donc à
       * n'importe quel membre — avec ses boutons « Cocher les présents » et
       * « Annuler l'événement ». La maquette les dessine côte à côte parce qu'elle
       * documente des ÉTATS ; un écran, lui, doit en choisir un.
       *
       * La carte entière passe sous `<sc-if>`, et non son intitulé : une condition
       * porte sur un ÉLÉMENT. La ligne « Vous êtes 3e sur la liste » garde ensuite
       * sa propre condition, imbriquée — être COMPLET et être SUR LA LISTE sont
       * deux faits différents, et la maquette ne dessine que le second.
       */
      {
        noeud: CARTE_COMPLET,
        devient: '<sc-if value="{{ complet }}">' + CARTE_COMPLET + '</sc-if>',
        fois: 1,
        frames: ['Desktop'],
        why: 'La carte « COMPLET » n’apparaît que si la capacité est atteinte (§3.2) — `attendeeCount >= capacity`, les deux venant du serveur.',
      },
      {
        noeud: CARTE_ORGANISATEUR,
        devient: '<sc-if value="{{ organisateur }}">' + CARTE_ORGANISATEUR + '</sc-if>',
        fois: 1,
        frames: ['Desktop'],
        why: 'La carte « VUE ORGANISATEUR » n’apparaît qu’à l’organisateur, et c’est le SERVEUR qui le dit (`isOrganizer`) — jamais une comparaison faite dans le front.',
      },
      /**
       * LE NŒUD EST LA LIGNE ENTIÈRE, PAS SON TEXTE, et c'est une correction que
       * le compilateur a imposée : `>texte<` enveloppé d'un `<sc-if>` produit un
       * `>` et un `<` posés HORS de toute balise, donc du JSX qui ne compile pas
       * (« JSX fragment has no corresponding closing tag »). Une condition porte
       * sur un ÉLÉMENT ; elle ne peut pas porter sur un fragment de texte.
       */
      {
        noeud:
          '<div style="font-size:11.5px;color:#8A958F;margin-top:6px">Vous êtes 3e sur la liste</div>',
        devient:
          '<sc-if value="{{ attente }}"><div style="font-size:11.5px;color:#8A958F;margin-top:6px">Vous êtes {{ attente }}e sur la liste</div></sc-if>',
        fois: 1,
        frames: ['Desktop'],
        why: 'Ma position sur la liste d’attente (`myWaitlistPosition`, décidée par le serveur) : la ligne disparaît quand je n’y suis pas.',
      },
      /**
       * LE CADRE MOBILE AUSSI — même raison que sur E01 : les deux cadres sont
       * dans le document, et un titre d'événement écrit en dur dans la moitié
       * mobile serait lu par un test, un moteur de recherche et un lecteur
       * d'écran sur téléphone.
       *
       * La maquette RACCOURCIT tout sur mobile : « Réservé » sans le nom du
       * réseau, « Samedi 21 sept. » et « Maison des Assos, Lyon 7e » sur deux
       * lignes. On lie donc des champs COURTS, et c'est `data.ts` qui les forme.
       */
      {
        noeud: PASTILLE('#E3F0EB', '#0F5C48', 'Réservé'),
        devient:
          '<sc-if value="{{ evenement.reseau }}">' +
          PASTILLE('#E3F0EB', '#0F5C48', 'Réservé') +
          '</sc-if>',
        fois: 1,
        frames: ['Mobile'],
        why: 'La pastille « Réservé » du mobile : la maquette n’y écrit pas le nom du réseau, donc seule sa PRÉSENCE est pilotée.',
      },
      {
        noeud: PASTILLE('#F2F5F4', '#5D6B66', 'Rencontre'),
        devient: PASTILLE('#F2F5F4', '#5D6B66', '{{ evenement.type }}'),
        fois: 1,
        frames: ['Mobile'],
        why: 'Le type de l’événement, sur le cadre mobile.',
      },
      {
        noeud: '>Repas partagé béninois<',
        devient: '>{{ evenement.titre }}<',
        fois: 1,
        frames: ['Mobile'],
        why: 'Le titre de l’événement — et le titre du cadre mobile.',
      },
      {
        noeud: '>Samedi 21 sept. · 12 h – 16 h<br>Maison des Assos, Lyon 7e<',
        devient: '>{{ evenement.quandCourt }}<br>{{ evenement.lieuCourt }}<',
        fois: 1,
        frames: ['Mobile'],
        why: 'La date abrégée et le lieu court, sur les deux lignes que la maquette dessine en mobile.',
      },
      {
        noeud: '>AI<',
        devient: '>{{ evenement.organisateur.initiales }}<',
        fois: 1,
        frames: ['Mobile'],
        why: 'Les initiales de l’organisateur, sur le cadre mobile.',
      },
      {
        noeud: '>Aïcha Diop<',
        devient: '>{{ evenement.organisateur.nom }}<',
        fois: 1,
        frames: ['Mobile'],
        why: 'Le nom affiché de l’organisateur, sur le cadre mobile.',
      },
      {
        noeud: '<strong style="color:#16211D">27</strong> sur 40 places',
        devient:
          '<strong style="color:#16211D">{{ evenement.inscrits }}</strong> <sc-if value="{{ evenement.places }}">sur {{ evenement.places }} place{{ evenement.plurielPlaces }}</sc-if>',
        fois: 1,
        frames: ['Mobile'],
        why: 'Le compteur et la capacité, sur le cadre mobile.',
      },
      {
        noeud: BOUTON_RSVP('#16785E', '#fff', 'Je viens'),
        devient: BOUTON_RSVP('{{ choix.vient.fond }}', '{{ choix.vient.texte }}', 'Je viens'),
        fois: 1,
        frames: ['Mobile'],
        why: 'L’état du bouton « Je viens », sur le cadre mobile.',
      },
      {
        noeud: BOUTON_RSVP('#F2F5F4', '#16211D', 'Peut-être'),
        devient: BOUTON_RSVP('{{ choix.peutEtre.fond }}', '{{ choix.peutEtre.texte }}', 'Peut-être'),
        fois: 1,
        frames: ['Mobile'],
        why: 'L’état du bouton « Peut-être », sur le cadre mobile.',
      },
      {
        noeud: BOUTON_RSVP('#F2F5F4', '#16211D', 'Je ne viens pas'),
        devient: BOUTON_RSVP('{{ choix.refuse.fond }}', '{{ choix.refuse.texte }}', 'Je ne viens pas'),
        fois: 1,
        frames: ['Mobile'],
        why: 'L’état du bouton « Je ne viens pas », sur le cadre mobile.',
      },
    ],
  }),

  /**
   * ── E03 · /agenda/nouveau ──────────────────────────────────────────────────
   *
   * L'ENCART DE QUOTA EST LÉGITIME ICI, contrairement à ce qu'il serait dans
   * l'entraide. La maquette affiche « 1 événement sur 1 ce mois-ci · Réinitialisé
   * le 1er octobre » et un bouton « Découvrir Premium » : c'est exactement 09 §3.1
   * — « 1 par mois en gratuit (`usage_counters` EVENTS_CREATED), illimité en
   * Premium » — et T5 le demande explicitement. La règle dure de 14 §2 qui interdit
   * toute mention de plan porte sur l'ENTRAIDE, pas sur l'agenda.
   *
   * L'adresse est en texte libre, avec la note « Adresse en texte libre, jamais
   * géolocalisée » que la maquette écrit — la règle dure de 09 §3.1. Elle n'est pas
   * liée : c'est du texte de règle, vrai pour tout le monde et en tout temps.
   *
   * CE QUI N'EST PAS LIÉ ET POURQUOI : voir l'en-tête de ce fichier. Un formulaire
   * dessiné en `<div>` ne peut rien envoyer ; `POST /events` et `createEventSchema`
   * sont prêts et attendent des champs de saisie que la maquette ne dessine pas.
   * Le sélecteur « Réservé à un réseau » en est le cas le plus net : `GET
   * /communities` sait lister mes réseaux, mais la maquette dessine une ligne
   * fermée, pas une liste. Remonté au porteur.
   */
  screen({
    section: 'E03',
    out: 'e03',
    dataType: 'E03Data',
    frames: both('Créer un événement', 'Créer un événement'),
    donnees: [
      ...panneau(),
      {
        noeud: '>1 événement sur 1 ce mois-ci<',
        devient:
          '>{{ panneau.quota.utilise }} événement sur {{ panneau.quota.plafond }} ce mois-ci<',
        fois: 1,
        frames: ['Desktop'],
        why: 'Le quota du mois dans l’encart (§3.1), de `GET /me/subscription` — la même source que la ligne du panneau.',
      },
      {
        noeud: '>Réinitialisé le 1er octobre.<',
        devient: '>Réinitialisé le {{ panneau.quota.reset }}.<',
        fois: 1,
        frames: ['Desktop'],
        why: 'La date de remise à zéro du compteur, de `usage.resetsAt` — jamais calculée dans le front.',
      },
      {
        noeud:
          '<div style="min-height:48px;border-radius:14px;border:1px solid #E6EBE9;background:#fff;padding:13px 14px;font-size:14px;line-height:1.5;">Lyon</div>',
        devient:
          '<div style="min-height:48px;border-radius:14px;border:1px solid #E6EBE9;background:#fff;padding:13px 14px;font-size:14px;line-height:1.5;">{{ ville }}</div>',
        fois: 1,
        frames: ['Desktop'],
        why: 'Ma ville, proposée par défaut au champ « Ville » — résolue par `GET /users/{pseudo}`, `GET /me` ne rendant que `cityId`.',
      },
      {
        noeud: '>1 événement sur 1 ce mois-ci<',
        devient:
          '>{{ panneau.quota.utilise }} événement sur {{ panneau.quota.plafond }} ce mois-ci<',
        fois: 1,
        frames: ['Mobile'],
        why: 'Le même quota, sur le cadre mobile qui l’écrit en terre cuite sous les champs.',
      },
    ],
  }),

  /**
   * ── E04 · /agenda/:id/presence ─────────────────────────────────────────────
   *
   * Le cadre mobile titre « Présence · 18 / 23 » : le compteur est DANS le titre,
   * faute de place pour le sous-titre que l'ordinateur affiche à côté. Le titre
   * déclaré le reprend tel quel plutôt que de le raccourcir — et puisqu'il devient
   * une donnée, le générateur le reprend sur sa forme liée.
   *
   * BRANCHÉ SUR DEUX ROUTES, DANS CET ORDRE, et l'ordre est la garde :
   * `GET /events/:id` d'abord — il dit `isOrganizer` —, puis
   * `GET /events/:id/attendees` validé avec le contrat qui correspond. §5 ne
   * renvoie `userId` et `checkedIn` QU'À L'ORGANISATEUR, et
   * `publicAttendeesResponseSchema` les REFUSE : le jour où la route les joindrait
   * à la vue publique, l'écran refuserait la réponse au lieu de laisser transiter
   * l'identifiant d'un participant.
   *
   * CE QUI DÉCIDE LA CASE COCHÉE EST `checkedIn`, PAS LE RSVP. Les deux se
   * ressemblent et ne disent pas la même chose : un inscrit `GOING` n'est pas un
   * présent, et c'est `checked_in` qui alimente l'indicateur clé de la plateforme
   * (§3.3) comme le crédit `EVENT_ORGANIZED` (≥ 3 présents cochés). Un test de ce
   * périmètre avait déjà été écrit sur le mauvais champ.
   *
   * LES DÉCLINÉS NE SONT PAS DANS LA FEUILLE : `POST /check-in` n'accepte que
   * GOING, MAYBE et WAITLIST, donc une ligne `DECLINED` serait une case que
   * personne ne peut cocher. « 23 inscrits » compte donc les inscrits COCHABLES.
   */
  screen({
    section: 'E04',
    out: 'e04',
    dataType: 'E04Data',
    frames: both('Présence', 'Présence · 18 / 23'),
    donnees: [
      ...panneau(),
      {
        noeud: '>Repas partagé béninois · samedi 21 septembre<',
        devient: '>{{ evenement.titre }} · {{ evenement.quand }}<',
        fois: 1,
        frames: ['Desktop'],
        why: 'Le sous-titre : le nom de l’événement et son jour, de `GET /events/:id`.',
      },
      {
        noeud: PASTILLE('#E3F0EB', '#0F5C48', '18 présents sur 23 inscrits'),
        devient:
          '<sc-if value="{{ compteur }}">' +
          PASTILLE(
            '#E3F0EB',
            '#0F5C48',
            '{{ presents }} présent{{ plurielPresents }} sur {{ inscrits }} inscrit{{ plurielInscrits }}',
          ) +
          '</sc-if>',
        fois: 1,
        frames: ['Desktop'],
        why: 'Le compteur de présence (`meta.checkedIn`) : il DISPARAÎT pour qui n’est pas l’organisateur, au lieu d’afficher un zéro que le serveur n’a pas envoyé.',
      },
      {
        noeud:
          LIGNE_PRESENCE('#2FA37D', 'FN', 'Fatou Ndiaye', CASE_COCHEE) +
          LIGNE_PRESENCE('#E0733A', 'KB', 'Kofi Boateng', CASE_COCHEE) +
          LIGNE_PRESENCE('#0F5C48', 'SM', 'Sandra M.', CASE_COCHEE) +
          LIGNE_PRESENCE('#B4581F', 'YB', 'Yasmine Benali', CASE_VIDE) +
          LIGNE_PRESENCE('#0F5C48', 'TA', 'Théo Adjovi', CASE_VIDE),
        devient:
          '<sc-for list="{{ participants }}" as="p">' +
          LIGNE_PRESENCE('{{ p.fond }}', '{{ p.initiales }}', '{{ p.nom }}', CASES_LIEES) +
          '</sc-for>',
        fois: 1,
        frames: ['Desktop'],
        why: 'La feuille de présence, de `GET /events/:id/attendees` : la case cochée se décide sur `checkedIn`, jamais sur le statut de RSVP.',
      },
      {
        noeud: '>Présence · 18 / 23<',
        devient: '>Présence · {{ presents }} / {{ inscrits }}<',
        fois: 1,
        frames: ['Mobile'],
        why: 'L’en-tête mobile porte le compteur dans son titre, faute de place pour un sous-titre.',
      },
      {
        noeud:
          LIGNE_PRESENCE('#2FA37D', 'FN', 'Fatou Ndiaye', CASE_COCHEE) +
          LIGNE_PRESENCE('#E0733A', 'KB', 'Kofi Boateng', CASE_COCHEE) +
          LIGNE_PRESENCE('#B4581F', 'YB', 'Yasmine B.', CASE_VIDE),
        devient:
          '<sc-for list="{{ participants }}" as="p">' +
          LIGNE_PRESENCE('{{ p.fond }}', '{{ p.initiales }}', '{{ p.nom }}', CASES_LIEES) +
          '</sc-for>',
        fois: 1,
        frames: ['Mobile'],
        why: 'La même feuille sur le cadre mobile — trois lignes dessinées, autant que l’API en renvoie.',
      },
    ],
  }),
];
