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
import { cadresDuRail, squeletteBoucle } from '../squelette-membre.mjs';

const FILE = 'docs/template/03 Accueil v2.dc.html';

/**
 * Les dix-sept écrans qui restaient partagent UN SEUL jeu de données, parce que la
 * maquette n'a qu'un seul `renderVals()` pour ses vingt-deux sections. Le type est
 * donc unique lui aussi : `AccueilData`. Les cadres qui ne consomment rien
 * reçoivent `_props`, ce que le générateur écrit tout seul.
 *
 * CE TEXTE DISAIT QUE MOB, MOB2, A08T ET A12T ÉTAIENT « ENTIÈREMENT STATIQUES »,
 * et c'est exactement ce que ce lot a cessé d'être vrai : ce sont les cadres que
 * les blocs `donnees` ci-dessous lient, et ils destructurent aujourd'hui leurs
 * prises. Les cadres encore sans prise sont A01S et les planches dont la maquette
 * dessine le corps en dur — pas des familles entières.
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

/**
 * ════════════════════════════════════════════════════════════════════════════
 * `donnees` — LES PLANCHES DE CETTE MAQUETTE QUI N'EMPLOIENT PAS LE DIALECTE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Cette maquette est la seule, avec `01`, à employer le dialecte — 767
 * interpolations et 114 boucles, comptées. Mais elle ne l'emploie PAS PARTOUT :
 * ses quatre sections de planches (MOB, MOB2, A08T, A12T) et les colonnes de
 * documentation de A01G/A01N/A01S écrivent tout en clair. Résultat mesuré :
 * cinquante-deux cadres portaient une signature `(_props: …)`, c'est-à-dire
 * recevaient des données et les IGNORAIENT.
 *
 * Les quatre agents qui ont branché A01 à A14 ont travaillé EN PARALLÈLE du
 * mécanisme de liaison, pas après lui : ils n'ont donc pu lier que les cadres qui
 * avaient DÉJÀ des prises par le dialecte — d'où les cadres mobiles restés en
 * arrière, qui sont justement ceux que la maquette range dans MOB et MOB2.
 *
 * La prise se DÉCLARE ici, comme `tools/screens/08-compte.mjs` le fait pour les
 * vingt-cinq cadres de son module : `noeud` est le littéral VERBATIM, `fois`
 * combien de fois la maquette l'écrit DANS CE CADRE, `devient` la réécriture dans
 * le dialecte. Les quatre contrôles de `tools/generate-screens.mjs` font le reste.
 *
 * ── UN TROU DU MÉCANISME, ÉVITÉ PARTOUT DANS CE FICHIER ────────────────────
 *
 * Une interpolation posée là où va une DÉCLARATION ENTIÈRE de style est jetée en
 * silence : `style="…;{{ t.fond }}"` passe les quatre contrôles, le journal
 * annonce la liaison, et le JSX ne la porte pas. Une interpolation tient une
 * VALEUR (`background:{{ g.bg }}` fonctionne, vérifié dans le JSX produit), jamais
 * une déclaration. Partout où la maquette dessine deux APPARENCES — un onglet
 * actif qui porte `background:#fff` là où l'inactif porte `color:#5D6B66` — les
 * DEUX variantes sont écrites sous `<sc-if>`, et aucune n'est jetée.
 *
 * ── LA RÈGLE LA PLUS GRAVE DE CE MODULE, ET OÙ ELLE SE TIENT ───────────────
 *
 * « Aucune fuite entre réseaux » : un membre ne voit pas le contenu d'une
 * communauté dont il n'est pas membre. Elle se tient CÔTÉ SERVEUR — les sept
 * routes de contenu répondent `403 NOT_A_MEMBER` — et l'en-tête public ne porte
 * que quatorze champs. Les liaisons de A08T ne lisent donc QUE ces champs-là
 * (`communityPublicSchema`), et `reseau.membres` vient de `memberCount`, qui est
 * public, JAMAIS de `counters.members`, qui arrive masqué. Voir `a08t/data.ts`.
 */

// ─── L'EN-TÊTE DU RÉSEAU, répété sur vingt-et-une des vingt-cinq planches ────
//
// Les treize planches d'onglet d'ordinateur et les douze planches mobiles de
// MOB2 dessinent le même en-tête : la couverture, la pastille d'initiales, le nom
// du réseau, sa ligne de résumé et sa barre de six onglets. Quatre planches n'en
// portent pas (le formulaire d'annonce, « Gérer », l'édition du « À propos » et
// l'annonce mobile) : ce sont des formulaires pleine page, et c'est la maquette
// qui en décide.
//
// Les comptes ont été RELEVÉS cadre par cadre, pas supposés : « Public » figure
// une fois sur dix planches et DEUX fois sur celles qui montrent aussi la carte
// « À propos ». C'est exactement ce que `fois` existe pour tenir — le jour où le
// designer en retire une, la génération s'arrête en nommant le fragment.

/** La description longue du réseau, telle que l'en-tête la dessine. */
const DESC_RESEAU =
  '>Le réseau des Béninoises et Béninois installés en France. Démarches consulaires, entraide, fêtes.<';

/**
 * ── LA BARRE D'ONGLETS N'EST PAS LIÉE, ET C'EST UN ARBITRAGE ───────────────
 *
 * Les six onglets — Fil, Sujets, Événements, Membres, Album, À propos — sont les
 * MÊMES pour tout réseau : ce sont les six vues du produit, pas une donnée. Ce
 * qui varie, c'est l'onglet ALLUMÉ, et la page le sait déjà : elle le tient de
 * `?onglet=` et le passe en rang à `useReseau`.
 *
 * On a essayé de la lier quand même, et voici pourquoi on ne le fait pas. Les
 * deux apparences — allumée `font-weight:700;color:#0F5C48` + trait `#16785E`,
 * éteinte `font-weight:500;color:#5D6B66` + trait `transparent` — doivent être
 * écrites toutes les deux sous `<sc-if>`, sinon l'écran peindrait les cinq autres
 * onglets comme celui qu'on regarde. Le TROISIÈME contrôle du générateur exige
 * alors de retrouver, DANS L'ORDRE, le `<span>` allumé puis l'éteint (ou
 * l'inverse) dans le littéral de la maquette. C'est faisable quand l'onglet
 * courant n'est ni le premier ni le dernier ; sur « À propos », qui est le
 * dernier, aucune des deux moitiés ne suit l'autre, et il faudrait DÉCLARER en
 * `motifs` la moitié manquante plus ses deux fermetures — c'est-à-dire déclarer
 * presque tout le fragment, et le contrôle cesserait de protéger quoi que ce
 * soit. Un contrôle qu'on désarme pour le faire passer ne vaut rien.
 *
 * La barre reste donc DESSINÉE, exactement comme `08-compte.mjs` laisse dessinés
 * les interrupteurs de K07 et les quatre états KYC de K03, et pour la même
 * raison : les lier demanderait de redessiner. Remonté au porteur — il faudrait
 * que la maquette marque ses onglets, comme elle marque ses listes.
 *
 * ── CE QUI EST LIÉ DANS LA BARRE : LA PASTILLE DES DEMANDES ────────────────
 *
 * Les onze planches de la vue PROPRIÉTAIRE posent, sur l'onglet « Membres », un
 * rond orange qui compte les DEMANDES D'ADHÉSION en attente. C'est une vraie
 * donnée — `GET /communities/:slug/members?pending=true` — et c'est la plus
 * facile à laisser figée : « 4 » est un nombre plausible pour toujours.
 *
 * Elle est liée sous `<sc-if>` : à zéro elle DISPARAÎT, au lieu d'afficher un
 * rond orange vide. C'est le même choix, et la même forme, que la pastille
 * « Contacts » de `08-compte.mjs`.
 */
const PASTILLE_DEMANDES = (t, n) =>
  `<span style="margin-left:${t.marge};background:#E0733A;color:#fff;font-size:${t.corps};font-weight:700;min-width:${t.rond};height:${t.rond};padding:0 ${t.pad};border-radius:999px;display:flex;align-items:center;justify-content:center">${n}</span>`;

/** Les mesures RELEVÉES sur les deux largeurs — aucune déduite de l'autre. */
const TAILLE_WEB = { marge: '6px', corps: '10.5px', rond: '20px', pad: '6px' };
const TAILLE_MOBILE = { marge: '5px', corps: '10px', rond: '18px', pad: '5px' };

const pastilleDemandes = (frames, taille = TAILLE_WEB) => ({
  noeud: PASTILLE_DEMANDES(taille, '4'),
  devient:
    '<sc-if value="{{ reseau.demandes }}">' +
    PASTILLE_DEMANDES(taille, '{{ reseau.demandes }}') +
    '</sc-if>',
  fois: 1,
  frames,
  why: 'Les demandes d’adhésion en attente, de `GET /communities/:slug/members?pending=true` — à zéro, la pastille disparaît au lieu d’afficher un rond orange vide.',
});

/**
 * L'en-tête du réseau, pour un jeu de cadres.
 *
 *   · `frames` — les cadres concernés ;
 *   · `resume` — le littéral de la ligne de résumé, qui n'est PAS le même en vue
 *     membre (« vous êtes membre »), en vue propriétaire (« vous gérez ce réseau
 *     avec 2 modérateurs ») et sur mobile (« 890 membres » seul) ;
 *   · `devientResume` — sa réécriture ;
 *   · `resumeFois` — « 890 membres » figure DEUX fois sur la planche mobile
 *     « À propos » : une fois dans l'en-tête, une fois dans la carte. Les deux
 *     disent le même nombre, donc les deux sont liées ensemble ;
 *   · `pub` — combien de fois « Public » figure. Zéro quand la planche ne le
 *     dessine pas ;
 *   · `desc` — la planche porte-t-elle la description longue.
 *
 * Les comptes sont RELEVÉS planche par planche sur les octets de la maquette, par
 * un compteur lancé sur les vingt-cinq cadres — pas supposés réguliers. Ils ne le
 * sont pas : « Public » figure deux fois là où la planche montre AUSSI la carte
 * « À propos », et la description manque sur « Gérer ».
 */
const enteteReseau = ({ frames, resume, devientResume, resumeFois = 1, pub = 1, desc = true }) => [
  {
    noeud: '>BN<',
    devient: '>{{ reseau.initiales }}<',
    fois: 1,
    frames,
    why: 'Les initiales de la pastille du réseau, dérivées de son nom (`initials` de `reseaux/chrome.ts`).',
  },
  {
    noeud: '>Béninois en France<',
    devient: '>{{ reseau.nom }}<',
    fois: 1,
    frames,
    why: 'Le nom du réseau, de `GET /communities/:slug` (`name`) — et le titre de la planche.',
  },
  {
    noeud: resume,
    devient: devientResume,
    fois: resumeFois,
    frames,
    /**
     * ── UNE SEULE PRISE PAR LIGNE, ET C'EST UN DÉFAUT VU À L'ÉCRAN ──────────
     *
     * La ligne du PROPRIÉTAIRE était d'abord liée en trois morceaux autour d'un
     * texte dessiné : « {membres} · {genre} · vous gérez ce réseau avec
     * {moderateurs} modérateurs ». Ouvert dans un navigateur, l'écran affichait
     * « 99 membres · réseau de pays · vous gérez ce réseau avec 0 modérateurs ».
     *
     * Zéro n'est pas une information ici, c'est une AFFIRMATION FAUSSE : la route
     * des membres est un `pageSchema` sans `meta`, donc le nombre exact n'est
     * connu que si la liste tient dans une page, et zéro veut dire « aucun, OU
     * inconnu ». Dans une phrase dessinée, les deux se lisent pareil.
     *
     * Le texte « vous gérez ce réseau avec … modérateurs » étant du DESSIN, on ne
     * peut pas le faire disparaître depuis la donnée — sauf en liant la ligne
     * ENTIÈRE. `resumeProprietaireReseau()` n'écrit la clause des modérateurs que
     * lorsqu'elle est connue, et s'arrête avant sinon. Même raison, même forme et
     * même fonction que la ligne de A08.
     */
    why: 'La ligne de résumé : `memberCount`, qui est PUBLIC, le genre du réseau (`kind`) et mon rôle — jamais `counters.members`, qui arrive masqué à zéro pour un passant. Les séparateurs et la clause des modérateurs sont composés dans la donnée, pour qu’un nombre inconnu ne devienne pas un « 0 » affirmé.',
  },
  ...(pub === 0
    ? []
    : [
        {
          noeud: '>Public<',
          devient: '>{{ reseau.visibilite }}<',
          fois: pub,
          frames,
          why: 'La visibilité du réseau, de `visibility` — « Public », « Sur demande » ou « Privé ».',
        },
      ]),
  ...(desc
    ? [
        {
          noeud: DESC_RESEAU,
          devient: '>{{ reseau.description }}<',
          fois: 1,
          frames,
          why: 'La description du réseau (`description`) — nullable : les réseaux automatiques de ville et de pays n’en ont pas.',
        },
      ]
    : []),
];

/**
 * ─── `donnees` : LES CADRES LITTÉRAUX DE CETTE MAQUETTE ─────────────────────
 *
 * CE QUE CE BLOC CORRIGE, compté et non supposé. Cette maquette EMPLOIE le
 * dialecte — 767 interpolations, 114 boucles — mais pas partout : ses planches
 * « Versions mobiles » (MOB, MOB2) et ses planches d'onglets (A08T, A12T) sont
 * écrites EN CLAIR. Cinquante-deux cadres portaient donc une signature
 * `(_props: …Data)` : le souligné dit que le paramètre n'est pas lu, c'est-à-dire
 * que ces écrans recevaient des données et les IGNORAIENT.
 *
 * Les quatre agents qui ont branché A01 à A14 ont travaillé EN PARALLÈLE du
 * mécanisme `donnees`, pas après lui : ils n'ont donc pu lier que les cadres qui
 * avaient déjà une prise par le dialecte — les cadres d'ordinateur — et ont laissé
 * les littéraux. La MOITIÉ DE CHAQUE ÉCRAN mentait : `ScreenFrames` rend les deux
 * cadres et n'en masque qu'un, donc « Marc K. » et « 84 utiles » restaient écrits
 * en dur dans le document servi, dans ce que lit un test, un moteur de recherche
 * ou un lecteur d'écran sur téléphone.
 *
 * LE MÉCANISME EST CELUI DE `tools/screens/08-compte.mjs`, à la lettre, et aucun
 * second n'est inventé ici : `noeud` est le littéral VERBATIM avec ses
 * délimiteurs, `fois` le nombre de fois que la maquette l'écrit DANS CE CADRE,
 * `devient` la réécriture dans le dialecte, `frames` la borne, `why` la phrase du
 * journal. Les quatre contrôles de `tools/generate-screens.mjs` les vérifient.
 *
 * ── UNE INTERPOLATION TIENT UNE VALEUR, JAMAIS UNE DÉCLARATION ──────────────
 *
 * `style="…;padding:10px 0;{{ m.bord }}"` passe les quatre contrôles, le journal
 * annonce la liaison, et le JSX NE LA PORTE PAS : les attributs de style sont
 * transcodés déclaration par déclaration, donc une interpolation posée là où va
 * une déclaration entière est jetée en silence. `background:{{ p.fond }}` — une
 * VALEUR — fonctionne, et c'est vérifié dans le JSX produit.
 *
 * Conséquence tenue partout dans ce fichier : quand la maquette dessine deux
 * apparences par deux déclarations DIFFÉRENTES (l'onglet actif qui porte un fond
 * et pas de couleur, l'inactif qui porte une couleur et pas de fond), les deux
 * variantes vont sous `<sc-if>`. On n'en garde jamais une seule — ce serait un
 * mensonge sur toutes les autres lignes de la liste.
 *
 * ── LES CARTES RÉPÉTÉES SONT ÉCRITES UNE FOIS, EN FABRIQUE ─────────────────
 *
 * Chaque fabrique ci-dessous reproduit une carte de la maquette à l'identique,
 * ses textes en paramètres. Elle sert DEUX FOIS : à écrire le `noeud` (les cartes
 * telles que la maquette les dessine, avec leurs textes d'exemple) et à écrire le
 * `devient` (la même carte, une fois, avec des interpolations). Le troisième
 * contrôle du générateur compare les deux — si la maquette change d'un pixel, la
 * génération s'arrête en nommant le fragment. C'est ce qui rend ces longues
 * chaînes sûres plutôt que fragiles : rien ici ne peut dériver sans être dit.
 */

// ─── A03 · la liste des guides, cadre mobile ────────────────────────────────

/** Le bandeau « À vérifier » de §2.3 : la maquette ne le dessine que sur la 3e carte. */
const BANDEAU_A_VERIFIER =
  '<div style="background:#FDF1D8;color:#8A5A0B;font-size:11.5px;font-weight:700;padding:7px 10px;border-radius:10px;margin-bottom:10px">À vérifier</div>';

/**
 * Une carte de guide, telle que la planche mobile la dessine.
 *
 * `bandeau` est vide sur les deux premières cartes et porte le bandeau
 * « À vérifier » sur la troisième : c'est la variante que la maquette dessine, et
 * elle passe donc sous `<sc-if>` au lieu d'être gardée ou jetée.
 */
const CARTE_GUIDE_MOBILE = (
  bandeau,
  titre,
  maj,
  cat,
  portee,
  extrait,
  fond,
  initiales,
  auteur,
  utiles,
) =>
  '<div style="background:#fff;border:1px solid #E6EBE9;border-radius:20px;padding:14px;flex-shrink:0">' +
  bandeau +
  '<div style="font-size:15px;font-weight:700;letter-spacing:-0.2px">' +
  titre +
  '</div><span style="display:inline-block;margin-top:8px;font-size:12.5px;font-weight:700;color:#0F5C48;background:#E3F0EB;padding:4px 10px;border-radius:999px">' +
  maj +
  '</span><div style="display:flex;gap:6px;margin-top:8px">' +
  '<span style="background:#F2F5F4;color:#5D6B66;font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px;white-space:nowrap">' +
  cat +
  '</span><span style="background:#F2F5F4;color:#5D6B66;font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px;white-space:nowrap">' +
  portee +
  '</span></div><p style="margin:10px 0 0;font-size:13px;line-height:1.55;color:#5D6B66;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">' +
  extrait +
  '</p><div style="display:flex;align-items:center;gap:6px;margin-top:10px;font-size:12px;color:#5D6B66">' +
  '<span style="width:22px;height:22px;border-radius:999px;background:' +
  fond +
  ';color:#fff;font-size:7px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0">' +
  initiales +
  '</span>' +
  auteur +
  '<svg width="12" height="12" viewBox="0 0 24 24" fill="#16785E"><circle cx="12" cy="12" r="10"/>' +
  '<path d="m8 12 3 3 5-6" stroke="#fff" stroke-width="2.2" fill="none"/></svg><span style="flex:1"></span>' +
  '<strong style="color:#16211D">' +
  utiles +
  '</strong>&nbsp;utiles</div></div>';

/** L'onglet de la bascule mobile de A03 : deux déclarations différentes, deux formes. */
const ONGLET_GUIDE_MOBILE = (label, fin) =>
  '<span style="flex:1;text-align:center;padding:8px 4px;border-radius:9px;font-size:12.5px;font-weight:700;white-space:nowrap;' +
  fin +
  '">' +
  label +
  '</span>';

/** Un menu de filtre de A03 mobile : le nom, puis le chevron que la maquette écrit en texte. */
const FILTRE_GUIDE_MOBILE = (nom) =>
  '<span style="padding:7px 12px;border-radius:999px;background:#fff;border:1px solid #E6EBE9;font-size:12px;font-weight:600">' +
  nom +
  ' ▾</span>';

/**
 * Les trois guides de la planche mobile, et ce que la maquette en RACCOURCIT.
 *
 * Deux écarts, tous les deux assumés et dits ici plutôt que contournés :
 *
 *   · l'EXTRAIT est tronqué par la maquette (« Voici les pièces à préparer… »)
 *     là où la planche d'ordinateur l'écrit en entier. Le cadre le coupe DÉJÀ en
 *     CSS (`-webkit-line-clamp:2`), donc `{{ g.excerpt }}` — le texte réel —
 *     s'affiche sur deux lignes comme la maquette le prévoit. Fabriquer un second
 *     champ « extrait court » demanderait au serveur une troncature qu'il n'envoie
 *     pas ;
 *   · l'AUTEUR est abrégé (« Marc K. » pour « Marc Koudou »). `{{ g.author }}` est
 *     le nom d'affichage réel, celui que la carte d'ordinateur montre déjà. Écart
 *     de DESSIN remonté au porteur : aucune route ne rend un nom abrégé, et
 *     l'abréger ici serait inventer une règle de troncature.
 */
const GUIDES_MOBILE_NOEUD =
  CARTE_GUIDE_MOBILE(
    '',
    'Obtenir la garantie Visale sans CDI',
    'Mis à jour le 12 mars',
    'Logement',
    'Universel',
    'Visale est une caution gratuite d’Action Logement. Les étudiants de 18 à 30 ans y ont droit dès la validation du VLS-TS. Voici les pièces à préparer…',
    '#0F5C48',
    'MK',
    'Marc K.',
    '84',
  ) +
  CARTE_GUIDE_MOBILE(
    '',
    'Valider son VLS-TS en ligne',
    'Mis à jour le 28 février',
    'Titre de séjour',
    'Universel',
    'Depuis 2025, la validation du VLS-TS se fait uniquement sur le site de l’ANEF, dans les trois mois après l’arrivée…',
    '#16785E',
    'AD',
    'Aïcha D.',
    '132',
  ) +
  CARTE_GUIDE_MOBILE(
    BANDEAU_A_VERIFIER,
    'Ouvrir un compte bancaire depuis Cotonou',
    'Mis à jour le 3 oct. 2025',
    'Banque',
    'Bénin',
    'Plusieurs banques proposent l’ouverture à distance avant le départ. Comparatif des frais…',
    '#B4581F',
    'IS',
    'Ibrahim S.',
    '41',
  );

const A03_MOBILE = [
  {
    noeud: GUIDES_MOBILE_NOEUD,
    devient:
      '<sc-for list="{{ guides }}" as="g">' +
      CARTE_GUIDE_MOBILE(
        '<sc-if value="{{ g.verify }}">' + BANDEAU_A_VERIFIER + '</sc-if>',
        '{{ g.title }}',
        '{{ g.updated }}',
        '{{ g.cat }}',
        '{{ g.scope }}',
        '{{ g.excerpt }}',
        '{{ g.bg }}',
        '{{ g.i }}',
        '{{ g.author }}',
        '{{ g.useful }}',
      ) +
      '</sc-for>',
    frames: ['Mobile'],
    why: 'Les guides de `GET /guides`, sur le cadre mobile — mêmes prises que la planche d’ordinateur, bandeau « À vérifier » compris (05 §2.3), et `useful` est un compteur de VOTES, jamais de vues (00 §49).',
  },
  {
    noeud:
      ONGLET_GUIDE_MOBILE('Les plus utiles', 'background:#fff') +
      ONGLET_GUIDE_MOBILE('Récents', 'color:#5D6B66') +
      ONGLET_GUIDE_MOBILE('À vérifier', 'color:#5D6B66'),
    devient:
      '<sc-for list="{{ guideTabs }}" as="t">' +
      '<sc-if value="{{ t.on }}">' +
      ONGLET_GUIDE_MOBILE('{{ t.label }}', 'background:#fff') +
      '</sc-if><sc-if value="{{ !t.on }}">' +
      ONGLET_GUIDE_MOBILE('{{ t.label }}', 'color:#5D6B66') +
      '</sc-if></sc-for>',
    frames: ['Mobile'],
    why: 'Les trois onglets de §2.3 sur mobile : l’onglet actif porte un FOND, l’inactif une COULEUR — deux déclarations différentes, donc les DEUX variantes que la maquette dessine, chacune sous sa condition.',
  },
  {
    noeud:
      FILTRE_GUIDE_MOBILE('Catégorie') + FILTRE_GUIDE_MOBILE('Pays') + FILTRE_GUIDE_MOBILE('Ville'),
    devient:
      '<sc-for list="{{ guideFilters }}" as="f">' + FILTRE_GUIDE_MOBILE('{{ f }}') + '</sc-for>',
    frames: ['Mobile'],
    why: 'Les trois menus de filtre de §2.3, mêmes libellés que la planche d’ordinateur — toujours sans options : `GET /guides` accepte `category`, `countryId` et `cityId`, mais la maquette ne dessine aucune liste à ouvrir (remonté).',
  },
];

// ─── A05 · l'éditeur de guide, cadre mobile ─────────────────────────────────

/** Un bouton de la barre d'outils Markdown, tel que la planche mobile le dessine. */
const OUTIL_MD_MOBILE = (t) =>
  '<span style="height:40px;min-width:40px;padding:0 8px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:#5D6B66;background:#F6F8F7">' +
  t +
  '</span>';

const A05_MOBILE = [
  {
    noeud:
      OUTIL_MD_MOBILE('H') +
      OUTIL_MD_MOBILE('B') +
      OUTIL_MD_MOBILE('I') +
      OUTIL_MD_MOBILE('•') +
      OUTIL_MD_MOBILE('1.') +
      OUTIL_MD_MOBILE('Lien'),
    devient: '<sc-for list="{{ mdTools }}" as="m">' + OUTIL_MD_MOBILE('{{ m }}') + '</sc-for>',
    frames: ['Mobile'],
    why: 'Les six outils du Markdown restreint (05 §2.4), mêmes prises que la barre d’outils d’ordinateur : la liste des marques AUTORISÉES est une règle, et deux copies de la même règle divergent toujours.',
  },
];

// ─── A07 · mes réseaux et la découverte, cadre mobile ───────────────────────

/** La pastille « 12 nouveaux » : la maquette ne la dessine que sur deux des trois cartes. */
const PASTILLE_NOUVEAUX = (n) =>
  '<span style="display:inline-block;margin-top:6px;font-size:10.5px;font-weight:700;color:#fff;background:#16785E;padding:3px 8px;border-radius:999px">' +
  n +
  ' nouveaux</span>';

/** Une carte de « MES RÉSEAUX » sur mobile : 130 px de large, en bande défilante. */
const CARTE_MON_RESEAU_MOBILE = (fond, initiales, nom, pastille) =>
  '<div style="width:130px;flex-shrink:0;background:#fff;border:1px solid #E6EBE9;border-radius:18px;padding:12px">' +
  '<span style="width:38px;height:38px;border-radius:12px;background:' +
  fond +
  ';color:#fff;font-size:12px;font-weight:800;display:flex;align-items:center;justify-content:center">' +
  initiales +
  '</span><div style="font-size:13px;font-weight:700;margin-top:10px;line-height:1.25">' +
  nom +
  '</div>' +
  pastille +
  '</div>';

/** Un filtre de « DÉCOUVRIR » sur mobile. Les trois déclarations sont écrites sur LES DEUX formes. */
const FILTRE_RESEAU_MOBILE = (fond, texte, bord, label) =>
  '<span style="padding:7px 12px;border-radius:999px;font-size:12px;font-weight:600;background:' +
  fond +
  ';color:' +
  texte +
  ';border:1px solid ' +
  bord +
  '">' +
  label +
  '</span>';

/** Une carte de « DÉCOUVRIR » sur mobile : couverture, catégorie, nom, phrase, compteur, geste. */
const CARTE_DECOUVRIR_MOBILE = (couverture, cat, nom, phrase, membres, fondBouton, texteBouton, cta) =>
  '<div style="background:#fff;border:1px solid #E6EBE9;border-radius:20px;padding:14px;flex-shrink:0">' +
  '<div style="display:flex;gap:12px"><div style="width:64px;height:64px;border-radius:14px;background:' +
  couverture +
  ';flex-shrink:0"></div><div style="flex:1;min-width:0">' +
  '<span style="background:#F2F5F4;color:#5D6B66;font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px;white-space:nowrap">' +
  cat +
  '</span><div style="font-size:14px;font-weight:700;margin-top:6px">' +
  nom +
  '</div><div style="font-size:12px;color:#5D6B66;margin-top:2px">' +
  phrase +
  '</div></div></div><div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px">' +
  '<span style="font-size:12px;color:#8A958F">' +
  membres +
  '</span><span style="height:36px;padding:0 14px;border-radius:999px;background:' +
  fondBouton +
  ';color:' +
  texteBouton +
  ';font-size:12.5px;font-weight:700;display:flex;align-items:center">' +
  cta +
  '</span></div></div>';

const A07_MOBILE = [
  {
    noeud:
      CARTE_MON_RESEAU_MOBILE('#16785E', 'LY', 'Lyon et Rhône', PASTILLE_NOUVEAUX('12')) +
      CARTE_MON_RESEAU_MOBILE('#E0733A', 'BN', 'Béninois en France', PASTILLE_NOUVEAUX('3')) +
      CARTE_MON_RESEAU_MOBILE('#0F5C48', 'EN', 'Entrepreneurs Lyon', ''),
    devient:
      '<sc-for list="{{ myNets }}" as="n">' +
      CARTE_MON_RESEAU_MOBILE(
        '{{ n.bg }}',
        '{{ n.i }}',
        '{{ n.name }}',
        '<sc-if value="{{ n.unread }}">' + PASTILLE_NOUVEAUX('{{ n.unread }}') + '</sc-if>',
      ) +
      '</sc-for>',
    frames: ['Mobile'],
    why: 'Mes réseaux, de `GET /me/communities`. La TROISIÈME carte de la maquette n’a pas de pastille : c’est la variante « aucun non-lu », donc elle passe sous `<sc-if>` — et `unread` reste `null` tant qu’aucun compteur de non-lus n’existe côté API (déjà remonté).',
  },
  {
    noeud:
      FILTRE_RESEAU_MOBILE('#16785E', '#fff', '#16785E', 'Ville') +
      FILTRE_RESEAU_MOBILE('#fff', '#16211D', '#E6EBE9', 'Pays') +
      FILTRE_RESEAU_MOBILE('#fff', '#16211D', '#E6EBE9', 'Intérêt') +
      FILTRE_RESEAU_MOBILE('#fff', '#16211D', '#E6EBE9', 'Catégorie'),
    devient:
      '<sc-for list="{{ netFilters }}" as="c">' +
      FILTRE_RESEAU_MOBILE('{{ c.bg }}', '{{ c.fg }}', '{{ c.bd }}', '{{ c.label }}') +
      '</sc-for>',
    frames: ['Mobile'],
    why: 'Les quatre filtres de « Découvrir ». Les deux formes écrivent LES TROIS mêmes déclarations — fond, couleur, bordure — donc trois valeurs suffisent et aucun `<sc-if>` n’est nécessaire : `chip()` les calcule déjà pour la planche d’ordinateur.',
  },
  {
    noeud:
      CARTE_DECOUVRIR_MOBILE(
        '#CFE3DA',
        'Intérêt',
        'Étudiants de Lyon 2',
        'Entraide cours, stages et campus.',
        '340 membres',
        '#16785E',
        '#fff',
        'Rejoindre',
      ) +
      CARTE_DECOUVRIR_MOBILE(
        '#FBE3D4',
        'Pays',
        'Sénégalais de Lyon',
        'Réseau des Sénégalais du Rhône.',
        '520 membres',
        '#16785E',
        '#fff',
        'Rejoindre',
      ) +
      CARTE_DECOUVRIR_MOBILE(
        '#E9F2EE',
        'Intérêt',
        'Femmes entrepreneures',
        'Sur demande.',
        '88 membres',
        '#F2F5F4',
        '#0F5C48',
        'Demander',
      ),
    devient:
      '<sc-for list="{{ discover }}" as="d">' +
      CARTE_DECOUVRIR_MOBILE(
        '{{ d.cover }}',
        '{{ d.cat }}',
        '{{ d.name }}',
        '{{ d.desc }}',
        '{{ d.members }}',
        '{{ d.btnBg }}',
        '{{ d.btnFg }}',
        '{{ d.cta }}',
      ) +
      '</sc-for>',
    frames: ['Mobile'],
    why: 'Les réseaux à découvrir, de `GET /communities`. `cta`, `btnBg` et `btnFg` voyagent ENSEMBLE : « Rejoindre » sur fond vert pour un réseau PUBLIC, « Demander » sur fond clair pour un ON_REQUEST — les deux gestes n’aboutissent pas au même état, donc la couleur n’est pas décorative.',
  },
];

// ─── A08 · un réseau, onglet Sujets, cadre mobile ───────────────────────────

/** Un onglet du réseau sur mobile : les trois déclarations sont des VALEURS, sur les deux formes. */
const ONGLET_RESEAU_MOBILE = (graisse, couleur, bord, label) =>
  '<span style="height:44px;display:flex;align-items:center;padding:0 10px;font-size:13px;font-weight:' +
  graisse +
  ';color:' +
  couleur +
  ';border-bottom:2.5px solid ' +
  bord +
  ';white-space:nowrap">' +
  label +
  '</span>';

/** Une ligne de sujet sur mobile. `fond`, `fondIcone`, `traitIcone` marquent l'épinglage. */
const LIGNE_SUJET_MOBILE = (fond, fondIcone, traitIcone, trace, titre, fondEtat, texteEtat, etat, resume) =>
  '<div style="display:flex;align-items:center;gap:12px;padding:12px;border-radius:14px;background:' +
  fond +
  '"><span style="width:34px;height:34px;border-radius:10px;background:' +
  fondIcone +
  ';display:flex;align-items:center;justify-content:center;flex-shrink:0">' +
  '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="' +
  traitIcone +
  '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="' +
  trace +
  '"/></svg></span><div style="flex:1;min-width:0">' +
  '<div style="font-size:13.5px;font-weight:700;line-height:1.3">' +
  titre +
  '</div><div style="display:flex;gap:6px;align-items:center;margin-top:4px">' +
  '<span style="background:' +
  fondEtat +
  ';color:' +
  texteEtat +
  ';font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px;white-space:nowrap">' +
  etat +
  '</span><span style="font-size:11.5px;color:#8A958F">' +
  resume +
  '</span></div></div></div>';

/** Les deux tracés d'icône que la maquette emploie : l'épingle et la bulle. */
const TRACE_EPINGLE = 'M12 17v5M9 3h6l-1 6 4 4H6l4-4z';
const TRACE_BULLE = 'M4 5h16v11H9l-5 4z';

const A08_MOBILE = [
  {
    noeud:
      ONGLET_RESEAU_MOBILE('500', '#5D6B66', 'transparent', 'Fil') +
      ONGLET_RESEAU_MOBILE('700', '#0F5C48', '#16785E', 'Sujets') +
      ONGLET_RESEAU_MOBILE('500', '#5D6B66', 'transparent', 'Événements') +
      ONGLET_RESEAU_MOBILE('500', '#5D6B66', 'transparent', 'Membres') +
      ONGLET_RESEAU_MOBILE('500', '#5D6B66', 'transparent', 'Album'),
    devient:
      '<sc-for list="{{ netTabs }}" as="t">' +
      ONGLET_RESEAU_MOBILE('{{ t.w }}', '{{ t.fg }}', '{{ t.bd }}', '{{ t.label }}') +
      '</sc-for>',
    frames: ['Mobile'],
    why: 'Les onglets du réseau, mêmes prises que la planche d’ordinateur. ÉCART DE MAQUETTE remonté : la planche mobile n’en dessine que CINQ et oublie « À propos », que la planche d’ordinateur dessine — la liste liée en rend donc six, ce qui est l’onglet réel et non un onglet inventé.',
  },
  {
    noeud:
      LIGNE_SUJET_MOBILE(
        '#FAFBFB',
        '#E3F0EB',
        '#0F5C48',
        TRACE_EPINGLE,
        'Renouveler son passeport depuis la France',
        '#E3F0EB',
        '#0F5C48',
        'Ouvert',
        '23 réponses · il y a 2 h',
      ) +
      LIGNE_SUJET_MOBILE(
        '#FAFBFB',
        '#E3F0EB',
        '#0F5C48',
        TRACE_EPINGLE,
        'Pièces pour l’acte de naissance',
        '#F2F5F4',
        '#5D6B66',
        'Résolu',
        '41 réponses · épinglé',
      ) +
      LIGNE_SUJET_MOBILE(
        'transparent',
        '#F2F5F4',
        '#5D6B66',
        TRACE_BULLE,
        'Envoyer de l’argent au pays',
        '#E3F0EB',
        '#0F5C48',
        'Ouvert',
        '17 réponses · il y a 5 h',
      ) +
      LIGNE_SUJET_MOBILE(
        'transparent',
        '#F2F5F4',
        '#5D6B66',
        TRACE_BULLE,
        'Fête de l’indépendance — 1er août',
        '#E3F0EB',
        '#0F5C48',
        'Ouvert',
        '9 réponses · hier',
      ),
    devient:
      '<sc-for list="{{ topics }}" as="t">' +
      LIGNE_SUJET_MOBILE(
        '{{ t.bg }}',
        '{{ t.iconBg }}',
        '{{ t.iconFg }}',
        '{{ t.icon }}',
        '{{ t.title }}',
        '{{ t.stBg }}',
        '{{ t.stFg }}',
        '{{ t.state }}',
        '{{ t.n }} réponses · {{ t.last }}',
      ) +
      '</sc-for>',
    frames: ['Mobile'],
    why: 'Les sujets du réseau, de `GET /communities/:slug/topics` — RÈGLE DURE : la route répond 403 `NOT_A_MEMBER` à qui n’est pas membre ACTIF, et `contenuFerme` dit « refusé » là où une liste vide dirait « rien ». L’épinglage marque DEUX fois (fond de ligne et fond d’icône) comme la maquette le fait.',
  },
];

// ─── A09 · un sujet et ses réponses, cadre mobile ───────────────────────────

/**
 * Une réponse sur mobile. `decalage` est le retrait du niveau de réponse.
 *
 * ÉCART ASSUMÉ : la maquette dessine ce retrait à 42 px sur A09 et à 34 px sur
 * A02, pour la même donnée — le retrait du niveau de réponse. `indentM` ne peut
 * pas valoir les deux ; c'est 34 px qui est lié ici, la valeur que l'autre cadre
 * mobile emploie déjà. Remonté : la maquette n'est pas d'accord avec elle-même.
 */
const REPONSE_MOBILE = (decalage, fond, initiales, nom, texte) =>
  '<div style="display:flex;gap:10px;padding-left:' +
  decalage +
  ';flex-shrink:0"><span style="width:32px;height:32px;border-radius:999px;background:' +
  fond +
  ';color:#fff;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0">' +
  initiales +
  '</span><div style="flex:1;background:#fff;border:1px solid #EAEEEC;border-radius:14px;padding:10px 12px">' +
  '<div style="display:flex;align-items:center;gap:5px;font-size:13px;font-weight:700">' +
  nom +
  '<svg width="12" height="12" viewBox="0 0 24 24" fill="#16785E"><circle cx="12" cy="12" r="10"/>' +
  '<path d="m8 12 3 3 5-6" stroke="#fff" stroke-width="2.2" fill="none"/></svg></div>' +
  '<div style="font-size:13px;line-height:1.5;margin-top:2px">' +
  texte +
  '</div></div></div>';

const A09_MOBILE = [
  {
    noeud:
      REPONSE_MOBILE(
        '0px',
        '#0F5C48',
        'SM',
        'Sandra M.',
        'Le Dr Mensah m’a conseillé de prendre RDV en ligne, 6 semaines de délai.',
      ) +
      REPONSE_MOBILE(
        '42px',
        '#0F5C48',
        'MK',
        'Marc Koudou',
        'Merci ! Tu avais un acte de naissance récent ?',
      ) +
      REPONSE_MOBILE('0px', '#E0733A', 'KB', 'Kofi Boateng', 'Oui, moins de 3 mois exigé.'),
    devient:
      '<sc-for list="{{ comments }}" as="c">' +
      REPONSE_MOBILE('{{ c.indentM }}', '{{ c.bg }}', '{{ c.i }}', '{{ c.name }}', '{{ c.text }}') +
      '</sc-for>',
    frames: ['Mobile'],
    why: 'Les réponses du sujet, de `GET /topics/:id/replies`. Le retrait vient de `parentCommentId` — un seul niveau est autorisé (`DEPTH_EXCEEDED`) — et non d’un rang dans la liste.',
  },
];

// ─── A10 · créer un réseau, cadre mobile ────────────────────────────────────

/** Une visibilité dans la bascule mobile : deux déclarations différentes, deux formes. */
const VISIBILITE_MOBILE = (label, fin) =>
  '<span style="flex:1;text-align:center;padding:8px 4px;border-radius:9px;font-size:12.5px;font-weight:700;white-space:nowrap;' +
  fin +
  '">' +
  label +
  '</span>';

/** Une ligne d'invitation sur mobile. Les trois déclarations du bouton sont des valeurs. */
const LIGNE_INVITE_MOBILE = (fond, initiales, nom, sous, fondBouton, texteBouton, bouton) =>
  '<div style="display:flex;align-items:center;gap:10px;flex-shrink:0">' +
  '<span style="width:36px;height:36px;border-radius:999px;background:' +
  fond +
  ';color:#fff;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0">' +
  initiales +
  '</span><span style="flex:1;min-width:0">' +
  '<span style="display:flex;align-items:center;gap:5px;font-size:13.5px;font-weight:700">' +
  nom +
  '<svg width="12" height="12" viewBox="0 0 24 24" fill="#16785E"><circle cx="12" cy="12" r="10"/>' +
  '<path d="m8 12 3 3 5-6" stroke="#fff" stroke-width="2.2" fill="none"/></svg></span>' +
  '<span style="display:block;font-size:11.5px;color:#8A958F">' +
  sous +
  '</span></span><span style="height:32px;padding:0 12px;border-radius:999px;font-size:12px;font-weight:700;display:flex;align-items:center;background:' +
  fondBouton +
  ';color:' +
  texteBouton +
  '">' +
  bouton +
  '</span></div>';

const A10_MOBILE = [
  {
    noeud:
      VISIBILITE_MOBILE('Public', 'background:#fff') +
      VISIBILITE_MOBILE('Sur demande', 'color:#5D6B66') +
      VISIBILITE_MOBILE('Invitation', 'color:#5D6B66'),
    devient:
      '<sc-for list="{{ visibility }}" as="v">' +
      '<sc-if value="{{ v.on }}">' +
      VISIBILITE_MOBILE('{{ v.t }}', 'background:#fff') +
      '</sc-if><sc-if value="{{ !v.on }}">' +
      VISIBILITE_MOBILE('{{ v.t }}', 'color:#5D6B66') +
      '</sc-if></sc-for>',
    frames: ['Mobile'],
    why: 'Les trois visibilités de 08 §7. La forme active porte un FOND, l’inactive une COULEUR : deux déclarations différentes, donc les deux variantes sous `<sc-if>`. Le libellé est celui de la prise — « Sur invitation », que la maquette raccourcit en « Invitation » faute de place.',
  },
  {
    noeud:
      LIGNE_INVITE_MOBILE('#0F5C48', 'SM', 'Sandra M.', 'Lyon 3e', '#E3F0EB', '#0F5C48', 'Invité·e') +
      LIGNE_INVITE_MOBILE('#E0733A', 'KB', 'Kofi Boateng', 'Lyon 3e', '#E3F0EB', '#0F5C48', 'Invité·e') +
      LIGNE_INVITE_MOBILE('#2FA37D', 'FN', 'Fatou Ndiaye', 'Lyon 7e', '#E3F0EB', '#0F5C48', 'Invité·e') +
      LIGNE_INVITE_MOBILE('#B4581F', 'IS', 'Ibrahim S.', 'Bordeaux', '#16785E', '#fff', 'Inviter'),
    devient:
      '<sc-for list="{{ invitees }}" as="i">' +
      LIGNE_INVITE_MOBILE(
        '{{ i.bg }}',
        '{{ i.i }}',
        '{{ i.name }}',
        '{{ i.sub }}',
        '{{ i.btnBg }}',
        '{{ i.btnFg }}',
        '{{ i.btn }}',
      ) +
      '</sc-for>',
    frames: ['Mobile'],
    why: 'Les membres à inviter, de `GET /communities/:slug/members`. « Invité·e » et « Inviter » sont les DEUX états que la maquette dessine, et ils voyagent avec leurs deux couleurs — un geste déjà fait et un geste à faire ne se ressemblent pas.',
  },
];

// ─── A12 · la fiche d'une ville, cadre mobile ───────────────────────────────

/** Une barre de pays sur mobile : le nom, la barre proportionnelle, le compte. */
const BARRE_PAYS_MOBILE = (pays, largeur, n) =>
  '<div style="display:flex;align-items:center;gap:10px;font-size:12px">' +
  '<span style="width:92px;color:#CFE3DA">' +
  pays +
  '</span><span style="flex:1;height:7px;border-radius:999px;background:rgba(255,255,255,.14);overflow:hidden">' +
  '<span style="display:block;height:100%;width:' +
  largeur +
  ';background:#fff"></span></span>' +
  '<span style="font-weight:700;width:30px;text-align:right">' +
  n +
  '</span></div>';

/** Un onglet de la fiche ville sur mobile : une PASTILLE, pas un onglet souligné. */
const PASTILLE_VILLE_MOBILE = (fond, texte, bord, label) =>
  '<span style="padding:8px 12px;border-radius:999px;font-size:12px;font-weight:700;white-space:nowrap;background:' +
  fond +
  ';color:' +
  texte +
  ';border:1px solid ' +
  bord +
  '">' +
  label +
  '</span>';

/** Une ligne de budget sur mobile. La PREMIÈRE n'a pas de filet : c'est la variante du rang 0. */
const LIGNE_BUDGET_MOBILE = (filet, poste, valeur, utiles) =>
  '<div style="display:flex;align-items:center;gap:10px;padding:10px 0;' +
  filet +
  '"><span style="flex:1;font-size:13.5px;font-weight:600">' +
  poste +
  '</span><span style="font-size:14px;font-weight:800">' +
  valeur +
  '</span><span style="font-size:11.5px;color:#8A958F">' +
  utiles +
  ' utiles</span></div>';

const FILET_BUDGET = 'border-top:1px solid #F0F3F2';

const A12_MOBILE = [
  {
    noeud:
      BARRE_PAYS_MOBILE('Sénégal', '82%', '312') +
      BARRE_PAYS_MOBILE('Côte d’Ivoire', '64%', '246') +
      BARRE_PAYS_MOBILE('Bénin', '46%', '178'),
    devient:
      '<sc-for list="{{ countryBars }}" as="b">' +
      BARRE_PAYS_MOBILE('{{ b.c }}', '{{ b.w }}', '{{ b.n }}') +
      '</sc-for>',
    frames: ['Mobile'],
    why: 'La répartition par pays d’origine de la ville. RÈGLE DURE : ces compteurs ne sortent qu’au-dessus du SEUIL DE CONFIDENTIALITÉ que le serveur applique — le front n’en recalcule aucun, il affiche ce qui lui est envoyé.',
  },
  {
    noeud:
      PASTILLE_VILLE_MOBILE('#fff', '#16211D', '#E6EBE9', 'Bons plans') +
      PASTILLE_VILLE_MOBILE('#fff', '#16211D', '#E6EBE9', 'Produits du pays') +
      PASTILLE_VILLE_MOBILE('#16785E', '#fff', '#16785E', 'Budgets réels') +
      PASTILLE_VILLE_MOBILE('#fff', '#16211D', '#E6EBE9', 'Témoignages'),
    devient:
      '<sc-for list="{{ cityPills }}" as="c">' +
      PASTILLE_VILLE_MOBILE('{{ c.bg }}', '{{ c.fg }}', '{{ c.bd }}', '{{ c.label }}') +
      '</sc-for>',
    frames: ['Mobile'],
    why: 'Les quatre onglets de la fiche ville. La planche mobile les dessine en PASTILLES — fond, couleur et bordure, comme `chip()` — et non en onglets soulignés comme la planche d’ordinateur : d’où `cityPills` à côté de `cityTabs`, et non un onglet recoloré à la main.',
  },
  {
    noeud:
      LIGNE_BUDGET_MOBILE('', 'Chambre en coloc', '480 €', '24') +
      LIGNE_BUDGET_MOBILE(FILET_BUDGET, 'Studio meublé', '620 €', '19') +
      LIGNE_BUDGET_MOBILE(FILET_BUDGET, 'Courses mensuelles', '220 €', '31'),
    devient:
      '<sc-for list="{{ budgets }}" as="b">' +
      '<sc-if value="{{ bIndex === 0 }}">' +
      LIGNE_BUDGET_MOBILE('', '{{ b.l }}', '{{ b.v }}', '{{ b.u }}') +
      '</sc-if><sc-if value="{{ bIndex > 0 }}">' +
      LIGNE_BUDGET_MOBILE(FILET_BUDGET, '{{ b.l }}', '{{ b.v }}', '{{ b.u }}') +
      '</sc-if></sc-for>',
    frames: ['Mobile'],
    why: 'Les postes de budget médians de la ville (`GET /cities/:slug/budgets`). La PREMIÈRE ligne n’a pas de filet et les suivantes en ont un : c’est une déclaration de style, pas une valeur, donc les deux variantes que la maquette dessine passent sous `<sc-if>` sur le rang — une interpolation à la place d’une déclaration serait jetée en silence.',
  },
];

// ─── A12T · les onglets de la fiche ville, SIX planches ─────────────────────
//
// Trois planches d'ordinateur de 1036 px et trois planches mobiles de MOB2, qui
// partagent leur en-tête (le nom de la ville, sa ligne de résumé, sa bascule
// d'onglets) et diffèrent par leur contenu. Les six étaient littérales.
//
// LE SOUS-TITRE EST IDENTIQUE SUR LES SIX, compté : « Auvergne-Rhône-Alpes ·
// 1 400 membres · 212 contributions », une fois par cadre. Il est donc lié d'une
// seule déclaration, et le jour où le designer en retire un la génération
// s'arrête en le nommant au lieu de produire cinq cadres justes et un faux.

/** Les trois textes de l'en-tête de ville, liés sur les six planches d'onglet. */
const ENTETE_VILLE = [
  {
    noeud: '>Lyon<',
    devient: '>{{ ville.nom }}<',
    fois: 1,
    why: 'Le nom de la ville, de `GET /cities/:slug` — et le titre de la planche, que `retitrerSurDonnees` reprend sur sa forme liée.',
  },
  {
    noeud: '>Auvergne-Rhône-Alpes · 1 400 membres · 212 contributions<',
    devient: '>{{ ville.region }} · {{ ville.membres }} · {{ ville.contributions }}<',
    fois: 1,
    why: 'La région, le nombre de membres et le nombre de contributions. Les compteurs sortent du serveur DÉJÀ filtrés par le seuil de confidentialité (`CITY_COUNT_PRIVACY_THRESHOLD` = 3) : le front n’en recalcule aucun.',
  },
];

/** Le lien vers le réseau automatique de la ville : seules les planches web le dessinent. */
const RESEAU_DE_LA_VILLE = {
  noeud: '>Réseau Lyon et Rhône<',
  devient: '>{{ ville.reseau }}<',
  fois: 1,
  why: 'Le réseau automatique de la ville (08 §2) — son nom vient de la fiche, jamais composé à partir de celui de la ville.',
};

/** Un onglet de la fiche ville sur ordinateur : souligné, trois valeurs. */
const ONGLET_VILLE_WEB = (graisse, couleur, bord, label) =>
  '<span style="height:52px;display:flex;align-items:center;padding:0 12px;font-size:13.5px;font-weight:' +
  graisse +
  ';color:' +
  couleur +
  ';border-bottom:2.5px solid ' +
  bord +
  '">' +
  label +
  '</span>';

/** Un onglet de la fiche ville sur mobile : une pastille, trois valeurs. */
const ONGLET_VILLE_MOBILE = (fond, texte, bord, label) =>
  '<span style="height:36px;padding:0 13px;border-radius:999px;display:flex;align-items:center;font-size:12.5px;font-weight:700;white-space:nowrap;background:' +
  fond +
  ';color:' +
  texte +
  ';border:1px solid ' +
  bord +
  '">' +
  label +
  '</span>';

const ongletsVilleWeb = (actif) => ({
  noeud: ['Bons plans', 'Produits du pays', 'Budgets réels', 'Témoignages']
    .map((l, i) =>
      i === actif
        ? ONGLET_VILLE_WEB('700', '#0F5C48', '#16785E', l)
        : ONGLET_VILLE_WEB('500', '#5D6B66', 'transparent', l),
    )
    .join(''),
  devient:
    '<sc-for list="{{ cityTabs }}" as="t">' +
    ONGLET_VILLE_WEB('{{ t.w }}', '{{ t.fg }}', '{{ t.bd }}', '{{ t.label }}') +
    '</sc-for>',
  fois: 1,
  why: 'Les quatre onglets de la fiche ville. Les deux apparences écrivent LES TROIS mêmes déclarations — graisse, couleur, trait — donc trois valeurs suffisent, et l’onglet allumé vient du rang que la page tient de `?onglet=`.',
});

const ongletsVilleMobile = (actif) => ({
  noeud: ['Bons plans', 'Produits du pays', 'Budgets réels', 'Témoignages']
    .map((l, i) =>
      i === actif
        ? ONGLET_VILLE_MOBILE('#16785E', '#fff', '#16785E', l)
        : ONGLET_VILLE_MOBILE('#fff', '#16211D', '#E6EBE9', l),
    )
    .join(''),
  devient:
    '<sc-for list="{{ cityPills }}" as="c">' +
    ONGLET_VILLE_MOBILE('{{ c.bg }}', '{{ c.fg }}', '{{ c.bd }}', '{{ c.label }}') +
    '</sc-for>',
  fois: 1,
  why: 'Les mêmes quatre onglets, en PASTILLES : la planche mobile les dessine avec un fond et une bordure, pas un soulignement — d’où `cityPills`, calculé du même rang que `cityTabs`.',
});

/** Un filtre de contenu de la fiche ville, sur ordinateur. */
const FILTRE_VILLE_WEB = (fond, texte, bord, label) =>
  '<span style="padding:8px 13px;border-radius:999px;font-size:12.5px;font-weight:700;background:' +
  fond +
  ';color:' +
  texte +
  ';border:1px solid ' +
  bord +
  '">' +
  label +
  '</span>';

const filtresVilleWeb = (labels, prise) => ({
  noeud: labels
    .map((l, i) =>
      i === 0
        ? FILTRE_VILLE_WEB('#16785E', '#fff', '#16785E', l)
        : FILTRE_VILLE_WEB('#fff', '#16211D', '#E6EBE9', l),
    )
    .join(''),
  devient:
    `<sc-for list="{{ ${prise} }}" as="f">` +
    FILTRE_VILLE_WEB('{{ f.bg }}', '{{ f.fg }}', '{{ f.bd }}', '{{ f.label }}') +
    '</sc-for>',
  fois: 1,
  why: `Les filtres de l’onglet (\`${prise}\`). La maquette allume « Tout » : le rang actif est un état de la page, pas une donnée, et c’est pour cela qu’il est l’unique argument de la fabrique.`,
});

/** Le pied d'une contribution sur ordinateur : auteur, vote d'utilité, enregistrer, signaler. */
const PIED_CONTRIBUTION_WEB = (fond, initiales, auteur, sous, fondUtile, texteUtile, utile) =>
  '<div style="display:flex;align-items:center;gap:8px;margin-top:12px;padding-top:12px;border-top:1px solid #F0F3F2">' +
  '<span style="width:26px;height:26px;border-radius:999px;background:' +
  fond +
  ';color:#fff;font-size:8px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0">' +
  initiales +
  '</span><span style="font-size:12.5px;font-weight:700">' +
  auteur +
  '</span><svg width="12" height="12" viewBox="0 0 24 24" fill="#16785E"><circle cx="12" cy="12" r="10"/>' +
  '<path d="m8 12 3 3 5-6" stroke="#fff" stroke-width="2.2" fill="none"/></svg>' +
  '<span style="font-size:11.5px;color:#8A958F">' +
  sous +
  '</span><span style="flex:1"></span>' +
  '<span style="height:32px;padding:0 12px;border-radius:999px;background:' +
  fondUtile +
  ';color:' +
  texteUtile +
  ';display:flex;align-items:center;gap:6px;font-size:12px;font-weight:700">' +
  '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M7 11v9M7 11l4-7c1.5 0 2.5 1 2.5 2.5V10h5a2 2 0 0 1 2 2l-1.5 6a2 2 0 0 1-2 2H7"/></svg>' +
  utile +
  '</span><span style="width:32px;height:32px;border-radius:999px;background:#F2F5F4;display:flex;align-items:center;justify-content:center">' +
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16211D" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg></span>' +
  '<span title="Signaler" style="width:32px;height:32px;border-radius:999px;background:#F2F5F4;display:flex;align-items:center;justify-content:center">' +
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5D6B66" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M5 21V4h12l-2 4 2 4H5"/></svg></span></div>';

/** Le même pied sur mobile : plus serré, et SANS la ligne « Installée · Lyon 3e ». */
const PIED_CONTRIBUTION_MOBILE = (fond, initiales, auteur, fondUtile, texteUtile, utile) =>
  '<div style="display:flex;align-items:center;gap:6px;margin-top:10px;padding-top:10px;border-top:1px solid #F0F3F2">' +
  '<span style="width:24px;height:24px;border-radius:999px;background:' +
  fond +
  ';color:#fff;font-size:8px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0">' +
  initiales +
  '</span><span style="font-size:12px;font-weight:700">' +
  auteur +
  '</span><svg width="11" height="11" viewBox="0 0 24 24" fill="#16785E"><circle cx="12" cy="12" r="10"/>' +
  '<path d="m8 12 3 3 5-6" stroke="#fff" stroke-width="2.2" fill="none"/></svg>' +
  '<span style="flex:1"></span>' +
  '<span style="height:30px;padding:0 10px;border-radius:999px;background:' +
  fondUtile +
  ';color:' +
  texteUtile +
  ';display:flex;align-items:center;gap:5px;font-size:11.5px;font-weight:700">' +
  '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M7 11v9M7 11l4-7c1.5 0 2.5 1 2.5 2.5V10h5a2 2 0 0 1 2 2l-1.5 6a2 2 0 0 1-2 2H7"/></svg>' +
  utile +
  '</span><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#16211D" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>' +
  '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8A958F" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M5 21V4h12l-2 4 2 4H5"/></svg></div>';

/** Une carte de bon plan, sur ordinateur. */
const CARTE_BON_PLAN_WEB = (cat, titre, texte, pied) =>
  '<div style="background:#fff;border:1px solid #E6EBE9;border-radius:22px;padding:18px">' +
  '<div style="display:flex;gap:8px"><span style="background:#E3F0EB;color:#0F5C48;font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px;white-space:nowrap">' +
  cat +
  '</span></div><div style="font-size:15.5px;font-weight:700;margin-top:10px">' +
  titre +
  '</div><div style="font-size:13.5px;line-height:1.55;color:#16211D;margin-top:4px">' +
  texte +
  '</div>' +
  pied +
  '</div>';

/** Une carte de bon plan, sur mobile. */
const CARTE_BON_PLAN_MOBILE = (cat, titre, texte, pied) =>
  '<div style="background:#fff;border:1px solid #E6EBE9;border-radius:20px;padding:14px;flex-shrink:0">' +
  '<span style="background:#E3F0EB;color:#0F5C48;font-size:10.5px;font-weight:700;padding:3px 9px;border-radius:999px;white-space:nowrap">' +
  cat +
  '</span><div style="font-size:14.5px;font-weight:700;margin-top:8px">' +
  titre +
  '</div><div style="font-size:12.5px;line-height:1.5;margin-top:3px;color:#5D6B66">' +
  texte +
  '</div>' +
  pied +
  '</div>';

/** Une étiquette de lieu, sur ordinateur puis sur mobile. */
const TAG_LIEU_WEB = (t) =>
  '<span style="background:#F2F5F4;color:#5D6B66;font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px;white-space:nowrap">' +
  t +
  '</span>';
const TAG_LIEU_MOBILE = (t) =>
  '<span style="background:#F2F5F4;color:#5D6B66;font-size:10.5px;font-weight:700;padding:3px 9px;border-radius:999px;white-space:nowrap">' +
  t +
  '</span>';

/** Une carte de lieu, sur ordinateur. */
const CARTE_LIEU_WEB = (nom, adresse, tags, fondVenu, bordVenu, venu, texte, pied) =>
  '<div style="background:#fff;border:1px solid #E6EBE9;border-radius:22px;padding:18px">' +
  '<div style="display:flex;gap:14px"><div style="width:76px;height:76px;border-radius:16px;background:repeating-linear-gradient(135deg,#E3ECE8 0 10px,#DCE6E1 10px 20px);flex-shrink:0"></div>' +
  '<div style="flex:1;min-width:0"><div style="font-size:15.5px;font-weight:700">' +
  nom +
  '</div><div style="display:flex;align-items:center;gap:6px;font-size:12.5px;color:#5D6B66;margin-top:3px">' +
  '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#5D6B66" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"/></svg>' +
  adresse +
  '</div><div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">' +
  tags +
  '</div></div><span style="align-self:flex-start;height:34px;padding:0 12px;border-radius:999px;background:' +
  fondVenu +
  ';border:1px solid ' +
  bordVenu +
  ';color:#0F5C48;font-size:12px;font-weight:700;display:flex;align-items:center;white-space:nowrap">' +
  venu +
  '</span></div><div style="font-size:13px;line-height:1.55;margin-top:10px">' +
  texte +
  '</div>' +
  pied +
  '</div>';

/** Une carte de lieu, sur mobile : la pastille « allé·e » passe SOUS le bloc. */
const CARTE_LIEU_MOBILE = (nom, adresse, tags, bordVenu, fondVenu, venu, pied) =>
  '<div style="background:#fff;border:1px solid #E6EBE9;border-radius:20px;padding:14px;flex-shrink:0">' +
  '<div style="display:flex;gap:12px"><div style="width:58px;height:58px;border-radius:14px;background:repeating-linear-gradient(135deg,#E3ECE8 0 8px,#DCE6E1 8px 16px);flex-shrink:0"></div>' +
  '<div style="flex:1;min-width:0"><div style="font-size:14.5px;font-weight:700">' +
  nom +
  '</div><div style="display:flex;align-items:center;gap:4px;font-size:11.5px;color:#5D6B66;margin-top:2px">' +
  '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#5D6B66" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11z"/></svg>' +
  adresse +
  '</div><div style="display:flex;gap:4px;margin-top:6px">' +
  tags +
  '</div></div></div><span style="display:inline-block;margin-top:10px;height:32px;line-height:30px;padding:0 12px;border-radius:999px;border:1px solid ' +
  bordVenu +
  ';background:' +
  fondVenu +
  ';color:#0F5C48;font-size:12px;font-weight:700">' +
  venu +
  '</span>' +
  pied +
  '</div>';

/** Le guillemet ouvrant d'un témoignage, dessiné en SVG dans un carré clair. */
const GUILLEMET = (taille, rayon, icone) =>
  '<span style="width:' +
  taille +
  ';height:' +
  taille +
  ';border-radius:' +
  rayon +
  ';background:#E3F0EB;display:flex;align-items:center;justify-content:center">' +
  '<svg width="' +
  icone +
  '" height="' +
  icone +
  '" viewBox="0 0 24 24" fill="none" stroke="#0F5C48" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M7 7h4v4c0 3-2 5-4 5M14 7h4v4c0 3-2 5-4 5"/></svg></span>';

/** Une carte de témoignage, sur ordinateur. */
const CARTE_TEMOIGNAGE_WEB = (texte, parcours, pied) =>
  '<div style="background:#fff;border:1px solid #E6EBE9;border-radius:22px;padding:18px">' +
  GUILLEMET('34px', '12px', '17') +
  '<div style="font-size:15px;line-height:1.65;margin-top:10px">' +
  texte +
  '</div><div style="margin-top:10px"><span style="background:#FBE3D4;color:#B4581F;font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px;white-space:nowrap">' +
  parcours +
  '</span></div>' +
  pied +
  '</div>';

/** Une carte de témoignage, sur mobile. */
const CARTE_TEMOIGNAGE_MOBILE = (texte, parcours, pied) =>
  '<div style="background:#fff;border:1px solid #E6EBE9;border-radius:20px;padding:14px;flex-shrink:0">' +
  GUILLEMET('30px', '10px', '15') +
  '<div style="font-size:14px;line-height:1.6;margin-top:8px">' +
  texte +
  '</div><div style="margin-top:8px"><span style="background:#FBE3D4;color:#B4581F;font-size:10.5px;font-weight:700;padding:3px 9px;border-radius:999px;white-space:nowrap">' +
  parcours +
  '</span></div>' +
  pied +
  '</div>';

/** Une ligne de « NOUVEAUX ARRIVANTS », telle que les planches A12T la dessinent. */
const LIGNE_ARRIVANT_VILLE = (fond, initiales, nom, sous) =>
  '<div style="display:flex;align-items:center;gap:10px;margin-top:12px">' +
  '<span style="width:36px;height:36px;border-radius:999px;background:' +
  fond +
  ';color:#fff;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0">' +
  initiales +
  '</span><span style="flex:1"><span style="display:block;font-size:13px;font-weight:700">' +
  nom +
  '</span><span style="display:block;font-size:11.5px;color:#8A958F">' +
  sous +
  '</span></span><span style="height:32px;padding:0 12px;border-radius:999px;background:#0F5C48;color:#fff;font-size:12px;font-weight:700;display:flex;align-items:center">Saluer</span></div>';

const ARRIVANTS_VILLE = {
  noeud:
    LIGNE_ARRIVANT_VILLE('#E0733A', 'KB', 'Kofi Boateng', 'Arrivé il y a 3 jours') +
    LIGNE_ARRIVANT_VILLE('#16785E', 'ST', 'Sarah Traoré', 'Arrivée cette semaine'),
  devient:
    '<sc-for list="{{ arrivals }}" as="a">' +
    LIGNE_ARRIVANT_VILLE('{{ a.bg }}', '{{ a.i }}', '{{ a.name }}', '{{ a.sub }}') +
    '</sc-for>',
  fois: 1,
  why: 'Les nouveaux arrivants de la ville (`NEWCOMER_WINDOW_DAYS` = 14) — la MÊME prise que la colonne de contexte de A01 et de A12, pas une seconde liste pour le même contenu.',
};

const A12T_DONNEES = [
  ...ENTETE_VILLE.map((d) => ({
    ...d,
    frames: [
      'BonsPlans',
      'Produits',
      'Temoignages',
      'BonsPlansMobile',
      'ProduitsMobile',
      'TemoignagesMobile',
    ],
  })),
  { ...RESEAU_DE_LA_VILLE, frames: ['BonsPlans', 'Produits', 'Temoignages'] },
  { ...ongletsVilleWeb(0), frames: ['BonsPlans'] },
  { ...ongletsVilleWeb(1), frames: ['Produits'] },
  { ...ongletsVilleWeb(3), frames: ['Temoignages'] },
  { ...ongletsVilleMobile(0), frames: ['BonsPlansMobile'] },
  { ...ongletsVilleMobile(1), frames: ['ProduitsMobile'] },
  { ...ongletsVilleMobile(3), frames: ['TemoignagesMobile'] },
  { ...ARRIVANTS_VILLE, frames: ['BonsPlans', 'Produits', 'Temoignages'] },
  {
    ...filtresVilleWeb(
      ['Tout', 'Transport', 'Administration', 'Sorties', 'Économies'],
      'cityTipFilters',
    ),
    frames: ['BonsPlans'],
  },
  {
    ...filtresVilleWeb(
      ['Tout', 'Épiceries', 'Restaurants', 'Tissus', 'Coiffure'],
      'cityPlaceFilters',
    ),
    frames: ['Produits'],
  },
  {
    ...filtresVilleWeb(['Tout', 'Études', 'Travail', 'Famille'], 'cityStoryFilters'),
    frames: ['Temoignages'],
  },

  // ── Les bons plans ────────────────────────────────────────────────────────
  {
    noeud:
      CARTE_BON_PLAN_WEB(
        'Transport',
        'Abonnement TCL à 25 € pour les moins de 26 ans',
        'Demandez-le en agence avec votre carte étudiante, il n’est pas proposé en ligne pour les étudiants étrangers.',
        PIED_CONTRIBUTION_WEB(
          '#0F5C48',
          'SM',
          'Sandra M.',
          'Installée · Lyon 3e',
          '#16785E',
          '#fff',
          'Utile · 48',
        ),
      ) +
      CARTE_BON_PLAN_WEB(
        'Administration',
        'Préfecture : arriver avant 8 h le mardi',
        'Les files sont plus courtes le mardi matin pour les retraits de titre. Pensez à la photocopie du récépissé.',
        PIED_CONTRIBUTION_WEB(
          '#0F5C48',
          'MK',
          'Marc K.',
          'Installé',
          '#F2F5F4',
          '#16211D',
          'Utile · 31',
        ),
      ) +
      CARTE_BON_PLAN_WEB(
        'Économies',
        'Too Good To Go autour de la Guillotière',
        'Les boulangeries de la place Gabriel-Péri mettent leurs paniers en ligne vers 19 h.',
        PIED_CONTRIBUTION_WEB(
          '#2FA37D',
          'FN',
          'Fatou N.',
          'Installée · Lyon 7e',
          '#F2F5F4',
          '#16211D',
          'Utile · 22',
        ),
      ),
    devient:
      '<sc-for list="{{ cityTips }}" as="t">' +
      CARTE_BON_PLAN_WEB(
        '{{ t.cat }}',
        '{{ t.titre }}',
        '{{ t.texte }}',
        PIED_CONTRIBUTION_WEB(
          '{{ t.bg }}',
          '{{ t.i }}',
          '{{ t.auteur }}',
          '{{ t.sous }}',
          '{{ t.utileBg }}',
          '{{ t.utileFg }}',
          'Utile · {{ t.utiles }}',
        ),
      ) +
      '</sc-for>',
    fois: 1,
    frames: ['BonsPlans'],
    why: 'Les bons plans de la ville (`GET /cities/:slug/tips`). `utileBg`/`utileFg` disent si LE LECTEUR a déjà voté — vert plein quand oui — et `utiles` est un compteur de VOTES, jamais de vues (00 §49).',
  },
  {
    noeud:
      CARTE_BON_PLAN_MOBILE(
        'Transport',
        'Abonnement TCL à 25 € pour les moins de 26 ans',
        'Demandez-le en agence avec votre carte étudiante.',
        PIED_CONTRIBUTION_MOBILE('#0F5C48', 'SM', 'Sandra M.', '#16785E', '#fff', '48'),
      ) +
      CARTE_BON_PLAN_MOBILE(
        'Administration',
        'Préfecture : arriver avant 8 h le mardi',
        'Files plus courtes le mardi matin.',
        PIED_CONTRIBUTION_MOBILE('#0F5C48', 'MK', 'Marc K.', '#F2F5F4', '#16211D', '31'),
      ) +
      CARTE_BON_PLAN_MOBILE(
        'Économies',
        'Too Good To Go à la Guillotière',
        'Paniers en ligne vers 19 h.',
        PIED_CONTRIBUTION_MOBILE('#2FA37D', 'FN', 'Fatou N.', '#F2F5F4', '#16211D', '22'),
      ),
    devient:
      '<sc-for list="{{ cityTips }}" as="t">' +
      CARTE_BON_PLAN_MOBILE(
        '{{ t.cat }}',
        '{{ t.titre }}',
        '{{ t.texte }}',
        PIED_CONTRIBUTION_MOBILE(
          '{{ t.bg }}',
          '{{ t.i }}',
          '{{ t.auteur }}',
          '{{ t.utileBg }}',
          '{{ t.utileFg }}',
          '{{ t.utiles }}',
        ),
      ) +
      '</sc-for>',
    fois: 1,
    frames: ['BonsPlansMobile'],
    why: 'Les MÊMES bons plans sur mobile. La maquette y RACCOURCIT le titre et le texte (« Too Good To Go à la Guillotière », « Paniers en ligne vers 19 h. ») : ce sont ses abréviations de dessin, et la prise rend le texte réel — remonté plutôt que tronqué par une règle inventée.',
  },

  // ── Les lieux du pays ─────────────────────────────────────────────────────
  {
    noeud:
      CARTE_LIEU_WEB(
        'Wax et Saveurs',
        '12 rue Paul-Bert, Lyon 3e',
        TAG_LIEU_WEB('Épicerie') + TAG_LIEU_WEB('Bénin') + TAG_LIEU_WEB('Sénégal'),
        '#E3F0EB',
        '#E3F0EB',
        'Vous y êtes allé·e',
        'Attiéké frais le samedi matin, gari, piment. Paiement carte.',
        PIED_CONTRIBUTION_WEB(
          '#E0733A',
          'KB',
          'Kofi B.',
          'Arrivé · Lyon 3e',
          '#F2F5F4',
          '#16211D',
          'Utile · 36',
        ),
      ) +
      CARTE_LIEU_WEB(
        'Chez Mama Adjo',
        '5 cours Gambetta, Lyon 7e',
        TAG_LIEU_WEB('Restaurant') + TAG_LIEU_WEB('Bénin'),
        '#fff',
        '#E6EBE9',
        'J’y suis allé·e',
        'Amiwo et sauce feuille le vendredi. Petites portions à 8 €.',
        PIED_CONTRIBUTION_WEB(
          '#16785E',
          'AD',
          'Aïcha D.',
          'Installée · Lyon 7e',
          '#F2F5F4',
          '#16211D',
          'Utile · 27',
        ),
      ),
    devient:
      '<sc-for list="{{ cityPlaces }}" as="p">' +
      CARTE_LIEU_WEB(
        '{{ p.nom }}',
        '{{ p.adresse }}',
        '<sc-for list="{{ p.tags }}" as="g">' + TAG_LIEU_WEB('{{ g }}') + '</sc-for>',
        '{{ p.beenBg }}',
        '{{ p.beenBd }}',
        '{{ p.been }}',
        '{{ p.texte }}',
        PIED_CONTRIBUTION_WEB(
          '{{ p.bg }}',
          '{{ p.i }}',
          '{{ p.auteur }}',
          '{{ p.sous }}',
          '{{ p.utileBg }}',
          '{{ p.utileFg }}',
          'Utile · {{ p.utiles }}',
        ),
      ) +
      '</sc-for>',
    fois: 1,
    frames: ['Produits'],
    why: 'Les lieux du pays de la ville. Le NOMBRE d’étiquettes varie — trois sur le premier lieu, deux sur le second — donc c’est une boucle imbriquée et non trois champs, et « Vous y êtes allé·e » / « J’y suis allé·e » voyage avec ses deux couleurs : un geste déjà fait et un geste à faire ne se ressemblent pas.',
  },
  {
    noeud:
      CARTE_LIEU_MOBILE(
        'Wax et Saveurs',
        '12 rue Paul-Bert, Lyon 3e',
        TAG_LIEU_MOBILE('Épicerie') + TAG_LIEU_MOBILE('Bénin'),
        '#E3F0EB',
        '#E3F0EB',
        'Vous y êtes allé·e',
        PIED_CONTRIBUTION_MOBILE('#E0733A', 'KB', 'Kofi B.', '#F2F5F4', '#16211D', '36'),
      ) +
      CARTE_LIEU_MOBILE(
        'Chez Mama Adjo',
        '5 cours Gambetta, Lyon 7e',
        TAG_LIEU_MOBILE('Restaurant') + TAG_LIEU_MOBILE('Bénin'),
        '#E6EBE9',
        '#fff',
        'J’y suis allé·e',
        PIED_CONTRIBUTION_MOBILE('#16785E', 'AD', 'Aïcha D.', '#F2F5F4', '#16211D', '27'),
      ),
    devient:
      '<sc-for list="{{ cityPlaces }}" as="p">' +
      CARTE_LIEU_MOBILE(
        '{{ p.nom }}',
        '{{ p.adresse }}',
        '<sc-for list="{{ p.tags }}" as="g">' + TAG_LIEU_MOBILE('{{ g }}') + '</sc-for>',
        '{{ p.beenBd }}',
        '{{ p.beenBg }}',
        '{{ p.been }}',
        PIED_CONTRIBUTION_MOBILE(
          '{{ p.bg }}',
          '{{ p.i }}',
          '{{ p.auteur }}',
          '{{ p.utileBg }}',
          '{{ p.utileFg }}',
          '{{ p.utiles }}',
        ),
      ) +
      '</sc-for>',
    fois: 1,
    frames: ['ProduitsMobile'],
    why: 'Les mêmes lieux sur mobile — où la maquette n’écrit que DEUX étiquettes sur « Wax et Saveurs » et déclare la bordure AVANT le fond. La boucle imbriquée rend donc les trois étiquettes réelles, ce qui est la donnée et non l’abréviation.',
  },

  // ── Les témoignages ───────────────────────────────────────────────────────
  {
    noeud:
      CARTE_TEMOIGNAGE_WEB(
        '« J’ai trouvé ma coloc en deux semaines grâce au réseau. Le plus dur a été le garant, Visale m’a sauvé. Venez tôt aux événements du jeudi, c’est là que tout se passe. »',
        'Parcours Études · 7 étapes franchies',
        PIED_CONTRIBUTION_WEB(
          '#B4581F',
          'AD',
          'Amina D.',
          'Étudiante · Lyon',
          '#16785E',
          '#fff',
          'Utile · 54',
        ),
      ) +
      CARTE_TEMOIGNAGE_WEB(
        '« Arrivé en plein hiver sans connaître personne. Trois mois après, j’ai un CDI et des amis. Le parrainage change tout. »',
        'Parcours Travail · abouti',
        PIED_CONTRIBUTION_WEB(
          '#E0733A',
          'KB',
          'Kofi B.',
          'Arrivé · Lyon 3e',
          '#F2F5F4',
          '#16211D',
          'Utile · 41',
        ),
      ),
    devient:
      '<sc-for list="{{ cityStories }}" as="s">' +
      CARTE_TEMOIGNAGE_WEB(
        '{{ s.texte }}',
        '{{ s.parcours }}',
        PIED_CONTRIBUTION_WEB(
          '{{ s.bg }}',
          '{{ s.i }}',
          '{{ s.auteur }}',
          '{{ s.sous }}',
          '{{ s.utileBg }}',
          '{{ s.utileFg }}',
          'Utile · {{ s.utiles }}',
        ),
      ) +
      '</sc-for>',
    fois: 1,
    frames: ['Temoignages'],
    why: 'Les témoignages de la ville. Le bandeau « Parcours Études · 7 étapes franchies » est le parcours RATTACHÉ, pas un titre : il vient de la contribution, et non d’un parcours deviné à partir de la phase du membre.',
  },
  {
    noeud:
      CARTE_TEMOIGNAGE_MOBILE(
        '« J’ai trouvé ma coloc en deux semaines grâce au réseau. Visale m’a sauvé. »',
        'Parcours Études · 7 étapes',
        PIED_CONTRIBUTION_MOBILE('#B4581F', 'AD', 'Amina D.', '#16785E', '#fff', '54'),
      ) +
      CARTE_TEMOIGNAGE_MOBILE(
        '« Arrivé en plein hiver sans connaître personne. Trois mois après, un CDI et des amis. »',
        'Parcours Travail · abouti',
        PIED_CONTRIBUTION_MOBILE('#E0733A', 'KB', 'Kofi B.', '#F2F5F4', '#16211D', '41'),
      ),
    devient:
      '<sc-for list="{{ cityStories }}" as="s">' +
      CARTE_TEMOIGNAGE_MOBILE(
        '{{ s.texte }}',
        '{{ s.parcours }}',
        PIED_CONTRIBUTION_MOBILE(
          '{{ s.bg }}',
          '{{ s.i }}',
          '{{ s.auteur }}',
          '{{ s.utileBg }}',
          '{{ s.utileFg }}',
          '{{ s.utiles }}',
        ),
      ) +
      '</sc-for>',
    fois: 1,
    frames: ['TemoignagesMobile'],
    why: 'Les mêmes témoignages sur mobile, où la maquette abrège la citation et le bandeau de parcours. La prise rend le texte réel.',
  },
];

// ─── A04 · la lecture d'un guide, les deux cadres mobiles ───────────────────
//
// LES QUATRE CADRES affichaient « Obtenir la garantie Visale sans CDI » quel que
// soit le guide demandé : le titre, la catégorie, la portée et la date étaient du
// littéral. Les quatre littéraux figurent UNE FOIS dans chacun des quatre cadres
// (compté sur les octets de la maquette), donc une seule déclaration les lie tous
// — et le jour où le designer en dédouble un, la génération s'arrête en le nommant.
//
// Les deux cadres d'ORDINATEUR sont liés ici aussi, bien qu'ils lisaient déjà
// `contributors` par le dialecte. La raison n'est pas la symétrie : lier le titre
// sur le seul mobile aurait donné un écran qui montre le bon guide sur téléphone et
// le guide de la maquette sur ordinateur — c'est-à-dire le même mensonge, déplacé.

const BANDEAU_COMMUNAUTE_WEB =
  '<div style="background:#E3F0EB;color:#0F5C48;font-size:12.5px;font-weight:700;padding:10px 28px;display:flex;align-items:center;gap:8px">' +
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">' +
  '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7"/></svg>Maintenu par la communauté</div>';

const BANDEAU_COMMUNAUTE_MOBILE =
  '<div style="background:#E3F0EB;color:#0F5C48;font-size:12px;font-weight:700;padding:9px 16px;flex-shrink:0">Maintenu par la communauté</div>';

/** Une pastille de contributeur, telle que les deux planches MOBILES la dessinent. */
const PASTILLE_CONTRIBUTEUR_MOBILE = (fond, initiales) =>
  '<span style="width:24px;height:24px;border-radius:999px;background:' +
  fond +
  ';color:#fff;border:2px solid #F6F8F7;margin-left:-6px;font-size:8.5px;font-weight:700;display:flex;align-items:center;justify-content:center">' +
  initiales +
  '</span>';

/**
 * La pastille orange des propositions en attente, sur la vue auteur.
 *
 * `milieu` est ce que la maquette écrit ENTRE la taille et le rayon, et les deux
 * planches ne l'écrivent pas pareil : l'ordinateur porte `font-weight:700` ET
 * `padding:0 7px`, le mobile ni l'un ni l'autre. Relevé sur les octets, pas
 * supposé régulier — et c'est le premier contrôle de `donnees` qui l'a dit, en
 * arrêtant la génération sur un fragment qui figurait « 0 fois ».
 */
const PASTILLE_PROPOSITIONS = (milieu, n) =>
  '<span style="background:#E0733A;color:#fff;font-size:11px;' +
  milieu +
  'min-width:22px;height:22px;' +
  'border-radius:999px;display:flex;align-items:center;justify-content:center">' +
  n +
  '</span>';

/** Les deux milieux relevés : celui de la planche d'ordinateur, celui du mobile. */
const MILIEU_PASTILLE_MOBILE = '';

/**
 * La pastille d'ordinateur, qui porte EN PLUS un remplissage latéral après la
 * hauteur. Elle ne se déduit donc pas de la mobile par un seul paramètre, et
 * essayer de le faire a produit l'arrêt de génération qui l'a révélé.
 */
const PASTILLE_PROPOSITIONS_WEB = (n) =>
  '<span style="background:#E0733A;color:#fff;font-size:11px;font-weight:700;min-width:22px;height:22px;padding:0 7px;border-radius:999px;display:flex;align-items:center;justify-content:center">' +
  n +
  '</span>';

const A04_DONNEES = [
  {
    noeud: '>Obtenir la garantie Visale sans CDI<',
    devient: '>{{ guide.title }}<',
    fois: 1,
    why: 'Le titre du guide, de `GET /guides/:slug` — et le titre de la page, que `retitrerSurDonnees` reprend sur sa forme liée.',
  },
  {
    noeud: '>Logement<',
    devient: '>{{ guide.cat }}<',
    fois: 1,
    why: 'La catégorie du guide (§2.1). Le libellé français vient de `CATEGORY_LABEL` dans `guides/from-api.ts` : l’API rend l’énumération brute, et AUCUNE étiquette ne contient « certifié » — c’est une règle dure.',
  },
  {
    noeud: '>Universel<',
    devient: '>{{ guide.scope }}<',
    fois: 1,
    why: 'La portée du guide : « Universel », ou le NOM DU PAYS quand elle est nationale — ce que la maquette écrit déjà sur sa troisième carte de A03.',
  },
  {
    noeud: '>Mis à jour le 12 mars 2026<',
    devient: '>{{ guide.updated }}<',
    fois: 1,
    why: 'RÈGLE DURE (05 §9, T1 §6) : la date de mise à jour est « aussi visible que le titre », sur chaque guide. Elle passe par le MÊME convertisseur que les cartes de A03 — deux formats pour une même donnée finissent par se contredire.',
  },
  {
    noeud: BANDEAU_COMMUNAUTE_WEB,
    devient:
      '<sc-if value="{{ guide.community }}">' + BANDEAU_COMMUNAUTE_WEB + '</sc-if>',
    fois: 1,
    frames: ['Desktop', 'AuteurDesktop'],
    why: 'Le bandeau « Maintenu par la communauté » suit `maintainedByCommunity` : à faux il DISPARAÎT, au lieu d’affirmer un entretien communautaire que personne n’assure.',
  },
  {
    noeud: BANDEAU_COMMUNAUTE_MOBILE,
    devient:
      '<sc-if value="{{ guide.community }}">' + BANDEAU_COMMUNAUTE_MOBILE + '</sc-if>',
    fois: 1,
    frames: ['Mobile'],
    why: 'Le même bandeau sur le cadre mobile de la vue LECTEUR. ÉCART DE MAQUETTE remonté : la planche mobile de la vue AUTEUR met « Votre guide » à sa place, là où la planche d’ordinateur de la même vue garde « Maintenu par la communauté » — les deux ne disent pas la même chose.',
  },
  {
    noeud:
      PASTILLE_CONTRIBUTEUR_MOBILE('#0F5C48', 'MK') +
      PASTILLE_CONTRIBUTEUR_MOBILE('#16785E', 'AD') +
      PASTILLE_CONTRIBUTEUR_MOBILE('#2FA37D', 'FN'),
    devient:
      '<sc-for list="{{ contributors }}" as="s">' +
      PASTILLE_CONTRIBUTEUR_MOBILE('{{ s.bg }}', '{{ s.i }}') +
      '</sc-for>',
    fois: 1,
    frames: ['Mobile', 'AuteurMobile'],
    why: 'Les pastilles de contributeurs, de `GET /guides/:slug` — la MÊME prise que les planches d’ordinateur, qui la lisaient déjà par le dialecte. La maquette en dessine trois sur mobile et quatre sur ordinateur : la liste liée rend les contributeurs réels.',
  },
  // ── Les trois compteurs de la VUE AUTEUR ─────────────────────────────────
  {
    noeud: '>84</strong> ont trouvé utile',
    devient: '>{{ guide.useful }}</strong> ont trouvé utile',
    fois: 1,
    frames: ['AuteurMobile'],
    why: 'Les votes d’utilité du guide (`helpfulCount`) — un compteur de VOTES, jamais de vues (00 §49), et `NOT_HELPFUL` ne le bouge pas.',
  },
  {
    noeud: '>3</strong> contributeurs',
    devient: '>{{ guide.contributorCount }}</strong> contributeurs',
    fois: 1,
    frames: ['AuteurMobile'],
    why: 'Le nombre de contributeurs. Il vient du compteur, PAS de la longueur de la rangée de pastilles : la rangée est tronquée par le dessin.',
  },
  {
    noeud:
      '>84</span><span style="font-size:11.5px;color:#CFE3DA">ont trouvé utile<',
    devient:
      '>{{ guide.useful }}</span><span style="font-size:11.5px;color:#CFE3DA">ont trouvé utile<',
    fois: 1,
    frames: ['AuteurDesktop'],
    why: 'Le même compteur de votes, sur la carte « VOUS ÊTES L’AUTEUR » de la planche d’ordinateur.',
  },
  {
    noeud: '>3</span><span style="font-size:11.5px;color:#CFE3DA">contributeurs<',
    devient:
      '>{{ guide.contributorCount }}</span><span style="font-size:11.5px;color:#CFE3DA">contributeurs<',
    fois: 1,
    frames: ['AuteurDesktop'],
    why: 'Le même nombre de contributeurs, sur la planche d’ordinateur.',
  },
  {
    noeud: PASTILLE_PROPOSITIONS_WEB('2'),
    devient:
      '<sc-if value="{{ guide.proposals }}">' +
      PASTILLE_PROPOSITIONS_WEB('{{ guide.proposals }}') +
      '</sc-if>',
    fois: 1,
    frames: ['AuteurDesktop'],
    why: 'Les propositions de correction EN ATTENTE (§2.4 : `PENDING` et `ESCALATED`, les deux seuls états qui attendent une décision) — à zéro, la pastille disparaît au lieu d’afficher un rond orange vide.',
  },
  {
    noeud: PASTILLE_PROPOSITIONS(MILIEU_PASTILLE_MOBILE, '2'),
    devient:
      '<sc-if value="{{ guide.proposals }}">' +
      PASTILLE_PROPOSITIONS(MILIEU_PASTILLE_MOBILE, '{{ guide.proposals }}') +
      '</sc-if>',
    fois: 1,
    frames: ['AuteurMobile'],
    why: 'La même pastille sur le cadre mobile, où la maquette n’écrit PAS `font-weight` — relevé, pas supposé régulier.',
  },
];

// ─── A12C · la fenêtre de contribution, QUATRE planches ─────────────────────
//
// CE QUE CES QUATRE CADRES ONT, ET CE QU'ILS N'ONT PAS. Ce sont des FORMULAIRES :
// « Wax et Saveurs », « 12 rue Paul-Bert, Lyon 3e », « Loyer 480 € » sont des
// EXEMPLES DE SAISIE — ce que le champ montrera en `placeholder` — et non des
// données du serveur. Les lier serait pré-remplir le formulaire d'un membre avec
// le contenu d'un autre, ce qui est exactement le genre de défaut qu'un écran
// branché « pour la forme » introduit.
//
// Ce qui EST une donnée, et qui était faux sur les quatre : LE NOM DE LA VILLE. La
// fenêtre annonçait « Contribuer à la fiche Lyon » depuis n'importe quelle fiche,
// y compris son titre accessible (`aria-labelledby`). C'est la seule liaison de ces
// quatre cadres, et c'est celle qui manquait.
//
// Les quatre catégories de lieu — Épicerie · Restaurant · Tissus · Coiffure — sont
// un RÉFÉRENTIEL et resteront dessinées jusqu'à ce qu'une route les rende : la
// maquette les écrit au SINGULIER dans le formulaire et au PLURIEL dans le filtre
// de l'onglet (« Épiceries »), donc les deux listes ne sont pas la même donnée et
// réemployer `cityPlaceFilters` ici afficherait le mauvais libellé. Signalé.

const A12C_DONNEES = [
  {
    noeud: '>Contribuer à la fiche Lyon<',
    devient: '>Contribuer à la fiche {{ ville.nom }}<',
    fois: 1,
    frames: ['Desktop'],
    why: 'La ville de la fiche qu’on contribue — et le titre de la fenêtre, que `retitrerSurDonnees` reprend sur sa forme liée.',
  },
  {
    noeud: '>Étape 2 sur 2 · Lyon<',
    devient: '>Étape 2 sur 2 · {{ ville.nom }}<',
    fois: 1,
    frames: ['DesktopProduit', 'DesktopBudget'],
    why: 'Le second volet nomme la ville dans son fil d’Ariane : le compteur d’étapes est du dessin, la ville est la donnée.',
  },
  {
    noeud: '>Contribuer à Lyon<',
    devient: '>Contribuer à {{ ville.nom }}<',
    fois: 1,
    frames: ['Mobile'],
    why: 'La même ville sur la feuille mobile, que la maquette raccourcit — et le titre de la feuille.',
  },
];

// ─── A01N · le composeur en plein écran (mobile) ────────────────────────────
//
// CE QUI EST LIÉ ICI EST BORNÉ PAR CE QUE `POST /posts` ACCEPTE, et c'est le point
// de la déclaration. `createPostSchema` est `.strict()` et porte `type`, `body`,
// `mediaIds`, `communityId`, `journeyId` — NI sondage, NI guide lié. L'aperçu de
// sondage et l'étiquette de guide que la maquette dessine restent donc DESSINÉS :
// leur fabriquer une prise serait inventer une route. Voir l'en-tête de
// `screens/accueil/data.ts`, et c'est remonté au porteur.

/** Un onglet de type du composeur mobile : les trois déclarations, sur les deux formes. */
const TYPE_BROUILLON = (fond, texte, bord, label) =>
  '<span style="height:34px;padding:0 12px;border-radius:999px;font-size:12px;font-weight:700;display:flex;align-items:center;background:' +
  fond +
  ';color:' +
  texte +
  ';border:1px solid ' +
  bord +
  '">' +
  label +
  '</span>';

/** Une miniature d'image du brouillon, croix de retrait comprise. */
const MINIATURE_BROUILLON = (nom) =>
  '<div style="position:relative;width:92px;height:92px;border-radius:14px;background:repeating-linear-gradient(135deg,#E3ECE8 0 10px,#DCE6E1 10px 20px);display:flex;align-items:center;justify-content:center;font-size:10.5px;font-weight:600;color:#7C8C85;flex-shrink:0">' +
  nom +
  '<span style="position:absolute;top:6px;right:6px;width:24px;height:24px;border-radius:999px;background:rgba(22,33,29,.7);display:flex;align-items:center;justify-content:center">' +
  '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M18 6 6 18M6 6l12 12"/></svg></span></div>';

const A01N_DONNEES = [
  {
    noeud:
      TYPE_BROUILLON('#fff', '#5D6B66', '#E6EBE9', 'Victoire') +
      TYPE_BROUILLON('#fff', '#5D6B66', '#E6EBE9', 'Question') +
      TYPE_BROUILLON('#fff', '#5D6B66', '#E6EBE9', 'Info') +
      TYPE_BROUILLON('#0F5C48', '#fff', '#0F5C48', 'Discussion'),
    devient:
      '<sc-for list="{{ draftTypes }}" as="t">' +
      TYPE_BROUILLON('{{ t.bg }}', '{{ t.fg }}', '{{ t.bd }}', '{{ t.label }}') +
      '</sc-for>',
    fois: 1,
    why: 'Les quatre types de publication (04 §2.1 : le type est choisi AVANT la rédaction et n’est plus modifiable). Les deux formes écrivent les TROIS mêmes déclarations, donc trois valeurs suffisent.',
  },
  {
    noeud:
      '>On organise un repas partagé pour les nouveaux arrivants. Votez pour la date !<',
    devient: '>{{ brouillon.texte }}<',
    fois: 1,
    why: 'Le corps du brouillon — `body` de `createPostSchema`, borné de 1 à 3 000 caractères par `FEED_LIMITS`.',
  },
  {
    noeud: MINIATURE_BROUILLON('Photo 1') + MINIATURE_BROUILLON('Photo 2'),
    devient:
      '<sc-for list="{{ brouillon.photos }}" as="ph">' +
      MINIATURE_BROUILLON('{{ ph }}') +
      '</sc-for>',
    fois: 1,
    why: 'RÈGLE DURE (04 §2.4) : « jusqu’à 4 images ». Les miniatures sont maintenant la LISTE, et le compteur juste dessous est sa longueur — le défaut que `composeur.test.ts` décrit (une pastille « 2 images » qui ne bouge pas quand on dessine la cinquième miniature) ne peut plus arriver.',
  },
  {
    noeud:
      '</svg>2</span>',
    devient: '</svg>{{ brouillon.photos.length }}</span>',
    fois: 1,
    why: 'Le compteur d’images du pied : la LONGUEUR de la liste, jamais un nombre écrit à côté d’elle. La borne, elle, est `FEED_LIMITS.postMediaMax` et vient de `@app/shared`.',
  },
  {
    noeud: '>Visible par Béninois en France<',
    devient: '>{{ brouillon.cible }}<',
    fois: 1,
    why: 'Le réseau où l’on publie — `communityId` de `createPostSchema` (04 §2.3 : renseigné, la publication est visible de ses membres SEULS). C’est la portée de la publication, et elle était écrite en dur.',
  },
];

// ─── A01G · « Lier un guide » ───────────────────────────────────────────────
//
// Les deux cadres dessinaient quatre cartes de guide en dur. Les cartes sont des
// DONNÉES (`GET /guides`) ; le champ de recherche et la notion de « suggéré » ne
// le sont pas — ni `q` ni suggestion n'existent dans `guideListQuerySchema`, et la
// fenêtre n'a de toute façon aucune route où envoyer son résultat, puisque
// `createPostSchema` n'a pas de `guideIds`. Les deux manques sont remontés ;
// « 3 guides maximum » et « Lier 2 guides » restent donc dessinés : ce sont des
// compteurs d'une SÉLECTION qui ne va nulle part.

/** L'icône de livre que les quatre cartes de A01G portent à l'identique. */
const ICONE_GUIDE_LIABLE =
  '<span style="width:36px;height:36px;border-radius:12px;background:#E3F0EB;display:flex;align-items:center;justify-content:center;flex-shrink:0">' +
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0F5C48" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M12 7v14M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/></svg></span>';

/**
 * Le corps d'une carte de A01G : le titre, puis sa ligne de contexte.
 *
 * Le `fin` est ce que la maquette met APRÈS le contexte — la pastille « Suggéré »
 * sur une carte suggérée, rien sur un résultat — et la `case` est la case à cocher,
 * pleine ou vide. Les deux ont été RELEVÉES, pas déduites l'une de l'autre.
 */
const CARTE_GUIDE_LIABLE = (cadre, titre, meta, fin, caseACocher) =>
  '<div style="display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:16px;' +
  cadre +
  '">' +
  ICONE_GUIDE_LIABLE +
  '<span style="flex:1;min-width:0">' +
  '<span style="display:block;font-size:13.5px;font-weight:700;line-height:1.3">' +
  titre +
  '</span><span style="display:flex;align-items:center;gap:6px;font-size:11.5px;color:#8A958F;margin-top:2px">' +
  meta +
  fin +
  '</span></span>' +
  caseACocher +
  '</div>';

const PASTILLE_SUGGERE =
  '<span style="background:#FBE3D4;color:#B4581F;font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px">Suggéré</span>';

const CASE_COCHEE =
  '<span style="width:24px;height:24px;border-radius:7px;background:#16785E;border:none;display:flex;align-items:center;justify-content:center;flex-shrink:0">' +
  '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round">' +
  '<path d="m5 12 4.5 4.5L19 7"/></svg></span>';

const CASE_VIDE =
  '<span style="width:24px;height:24px;border-radius:7px;background:#fff;border:1.5px solid #CBD5D1;display:flex;align-items:center;justify-content:center;flex-shrink:0"></span>';

/**
 * CE QUI SÉPARE DEUX CARTES DANS LA MAQUETTE : un retour à la ligne et dix
 * espaces d'indentation. Ce n'est pas du dessin — l'espacement vient du
 * `gap:12px` du conteneur — mais c'est dans les octets, donc le `noeud` le porte.
 * C'est le premier contrôle de `donnees` qui l'a dit, en refusant un fragment
 * reconstruit sans lui.
 */
const ENTRE_CARTES_A01G = '\n          ';

/** Une carte SUGGÉRÉE : fond vert, pastille « Suggéré », case cochée. */
const CARTE_GUIDE_SUGGERE = (titre, meta) =>
  CARTE_GUIDE_LIABLE(
    'background:#EFF7F3;border:1.5px solid #16785E',
    titre,
    meta,
    PASTILLE_SUGGERE,
    CASE_COCHEE,
  );

/** Une carte de RÉSULTAT : fond blanc, case vide. */
const CARTE_GUIDE_TROUVE = (titre, meta) =>
  CARTE_GUIDE_LIABLE(
    'background:#fff;border:1px solid #E6EBE9',
    titre,
    meta,
    '',
    CASE_VIDE,
  );

const A01G_DONNEES = [
  {
    noeud:
      CARTE_GUIDE_SUGGERE('Déclarer son médecin traitant', 'Santé · mis à jour le 2 février') +
      ENTRE_CARTES_A01G +
      CARTE_GUIDE_SUGGERE('Carte Vitale : premiers pas', 'Santé · mis à jour le 18 janvier'),
    devient:
      '<sc-for list="{{ guidesSuggeres }}" as="g">' +
      CARTE_GUIDE_SUGGERE('{{ g.titre }}', '{{ g.meta }}') +
      '</sc-for>',
    fois: 1,
    why: 'Les guides SUGGÉRÉS. ÉCART REMONTÉ : aucune route ne rend des guides « suggérés pour cette publication » — la liste est remplie de cartes réelles de `GET /guides`, dans l’ordre que l’API donne.',
  },
  {
    noeud:
      CARTE_GUIDE_TROUVE(
        'Trouver un médecin qui accepte de nouveaux patients',
        'Santé · Lyon · 57 utiles',
      ) +
      ENTRE_CARTES_A01G +
      CARTE_GUIDE_TROUVE('Complémentaire santé solidaire', 'Santé · Universel · 34 utiles'),
    devient:
      '<sc-for list="{{ guidesTrouves }}" as="g">' +
      CARTE_GUIDE_TROUVE('{{ g.titre }}', '{{ g.meta }}') +
      '</sc-for>',
    fois: 1,
    why: 'Les RÉSULTATS de la recherche de guides. ÉCART REMONTÉ : `guideListQuerySchema` n’accepte PAS de `q` — le champ « médecin » que la maquette dessine n’a aucune route à appeler, et il reste dessiné.',
  },
];

// ─── A06 · les deux cadres mobiles ──────────────────────────────────────────
//
// Le cadre « Corriger » annonçait « Obtenir la garantie Visale sans CDI » quelle
// que soit la correction proposée : c'est le GUIDE derrière la feuille, et c'était
// un littéral.
//
// Le cadre « Propositions reçues » dessine DEUX cartes structurellement
// différentes — une dépliée, une repliée — donc deux prises nommées et non une
// boucle : voir l'arbitrage écrit dans `screens/a06/data.ts`. Les blocs AVANT et
// APRÈS restent dessinés, parce que la maquette y dessine un DIFF (mot barré, mots
// surlignés) là où l'API rend deux chaînes nues : les lier ferait DISPARAÎTRE la
// différence, c'est-à-dire la seule chose que ces blocs montrent. Remonté.

/** La pastille d'avatar d'un proposant, sur la planche mobile de A06. */
const AVATAR_PROPOSANT = (fond, initiales) =>
  '<span style="width:30px;height:30px;border-radius:999px;background:' +
  fond +
  ';color:#fff;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center">' +
  initiales +
  '</span>';

const A06_DONNEES = [
  {
    noeud: '>Obtenir la garantie Visale sans CDI<',
    devient: '>{{ guide.title }}<',
    fois: 1,
    frames: ['CorrigerMobile'],
    why: 'Le titre du guide que la correction vise : la PAGE derrière la feuille est le guide, et la feuille le nommait en dur.',
  },
  {
    noeud: '>En attente · 2<',
    devient: '>En attente · {{ propositionsCompte.attente }}<',
    fois: 1,
    frames: ['Mobile'],
    why: 'Les propositions en attente — `PENDING` et `ESCALATED`, les deux seuls états qui attendent une décision (§2.4). Le compte est DÉRIVÉ de la liste : `guideProposalsResponseSchema` ne porte aucun `meta` de comptage, vérifié.',
  },
  {
    noeud: '>Acceptées · 7<',
    devient: '>Acceptées · {{ propositionsCompte.acceptees }}<',
    fois: 1,
    frames: ['Mobile'],
    why: 'Les propositions acceptées, dérivées du même statut. « Refusées » n’a PAS de compteur dans la maquette : on ne lui en invente pas un.',
  },
  {
    noeud: AVATAR_PROPOSANT('#2FA37D', 'FN'),
    devient: AVATAR_PROPOSANT('{{ propositionDepliee.bg }}', '{{ propositionDepliee.i }}'),
    fois: 1,
    frames: ['Mobile'],
    why: 'L’avatar du proposant de la carte DÉPLIÉE, de `GET /guides/:id/proposals`.',
  },
  {
    noeud: '>Fatou Ndiaye<',
    devient: '>{{ propositionDepliee.proposant }}<',
    fois: 1,
    frames: ['Mobile'],
    why: 'Le nom du proposant de la carte dépliée.',
  },
  {
    noeud: '>11 j<',
    devient: '>{{ propositionDepliee.delai }}<',
    fois: 1,
    frames: ['Mobile'],
    why: 'Le délai avant escalade (§2.4 : `created_at + 14 jours`), arrondi au jour SUPÉRIEUR par `delaiAvantEscalade` — un arrondi vers le bas afficherait « 0 jour » pendant les vingt-trois dernières heures.',
  },
  {
    noeud: ' La validation en ligne est obligatoire depuis 2025.<',
    devient: ' {{ propositionDepliee.motif }}<',
    fois: 1,
    frames: ['Mobile'],
    why: 'Le motif de la proposition (`reason`) — obligatoire, au moins 20 caractères (`GUIDE_PROPOSAL_REASON_MIN`).',
  },
  {
    noeud: AVATAR_PROPOSANT('#E0733A', 'KB'),
    devient: AVATAR_PROPOSANT('{{ propositionRepliee.bg }}', '{{ propositionRepliee.i }}'),
    fois: 1,
    frames: ['Mobile'],
    why: 'L’avatar du proposant de la carte REPLIÉE.',
  },
  {
    noeud: '>Kofi Boateng<',
    devient: '>{{ propositionRepliee.proposant }}<',
    fois: 1,
    frames: ['Mobile'],
    why: 'Le nom du proposant de la carte repliée.',
  },
  {
    noeud: '>3 j<',
    devient: '>{{ propositionRepliee.delai }}<',
    fois: 1,
    frames: ['Mobile'],
    why: 'Son délai avant escalade.',
  },
  {
    noeud: '>Section 1 · retrait « ou votre contrat de travail »<',
    devient: '>{{ propositionRepliee.motif }}<',
    fois: 1,
    frames: ['Mobile'],
    why: 'Le résumé de la carte repliée : c’est le MOTIF de la proposition, la seule phrase que la carte repliée montre.',
  },
];

/**
 * ─── LES ONZE ÉCRANS QUI DESSINENT LE SQUELETTE EN BOUCLE ───────────────────
 *
 * CETTE MAQUETTE EST LA SEULE DES SEPT À CONSTRUIRE SON RAIL PAR UNE BOUCLE, et
 * c'est elle qui rendait le problème insoluble avec les discriminants de texte :
 * `<sc-for list="{{ rail }}" as="r">` n'écrit QU'UN `<a href="#">` pour cinq
 * entrées au rendu, et son libellé est `{{ r.label }}`. Il n'y a donc aucun texte
 * à distinguer — la destination doit voyager avec la DONNÉE (`r.href`).
 *
 * Le panneau de section « COMMUNAUTÉ » est dans le même cas (`as="m"`,
 * `m.href`), et ses sept entrées ne sont dessinées QUE par ces onze écrans.
 *
 * LA LISTE EST POSITIVE, ET NON DÉDUITE, parce que `modal` ne suffit pas ici :
 * A13, A14 et A12C sont des écrans PLEIN CADRE qui ne dessinent aucun rail — une
 * story et une fiche de ville en onglets — et A08T comme A12T sont des jeux
 * d'onglets sans cadre d'application. Les nommer un par un est ce qui tient ; et
 * si la liste tombait fausse, le `dans` de `markLinks` arrêterait la génération
 * en comptant zéro conteneur, au lieu de produire un rail mort.
 */
const SQUELETTE_EN_BOUCLE = new Set([
  'A01', // /accueil — le fil
  'A02', // /publications/:id
  'A03', // /guides
  'A04', // /guides/:slug          (deux cadres : Desktop et AuteurDesktop)
  'A06', // /guides/:slug/propositions (Desktop et CorrigerDesktop)
  'A07', // /reseaux
  'A08', // /reseaux/:slug
  'A09', // /reseaux/:slug/sujets/:id
  'A10', // /reseaux/nouveau
  'A11', // /villes
  'A12', // /villes/:slug
]);

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
     *
     * ── `subject` : SANS LUI, LES CINQ PUBLICATIONS OUVRAIENT LA MÊME FENÊTRE ──
     *
     * Les deux boutons sont DANS la boucle `sc-for` des publications — la maquette
     * ne les écrit qu'une fois. Le nom de la fenêtre suffisait donc à dire QUOI
     * ouvrir, jamais SUR QUOI : l'écouteur délégué de `/accueil` recevait le même
     * `data-modal-open="A01C"` pour n'importe quelle carte, et servait toujours le
     * même fil de commentaires.
     *
     * `p.postId` est l'identifiant que `feedPostFrom` fait déjà voyager avec la
     * carte (`screens/accueil/from-api.ts`). Il est évalué DANS la boucle, donc une
     * valeur par publication. C'est la seule chose qui manquait : `threadFrom` est
     * écrit et éprouvé depuis le lot précédent.
     */
    triggers: [
      { marker: '</svg>{{ p.comment }}', modal: 'A01C', subject: 'p.postId' },
      { marker: '</svg>Partager', modal: 'A01P', subject: 'p.postId' },
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
   *
   * ── DEUX CARTES DE DOCUMENTATION, ATTEIGNABLES ET NON MONTÉES ──────────────
   *
   * Ces sections portent aussi, à côté de leurs deux planches, une COLONNE DE
   * DOCUMENTATION qui dessine une carte utile :
   *
   *   · A01S, colonne de 760 px — « COMPOSEUR AVEC PIÈCES JOINTES — WEB », la carte
   *     du composeur rempli. Voir la note de A01N, qui la décrit en détail ;
   *   · A01G, colonne de 640 px — « COMPOSEUR APRÈS LIAISON — L'ICÔNE DEVIENT
   *     “2 GUIDES LIÉS” », la même carte après liaison d'un guide.
   *
   * Les deux étaient DOUBLEMENT hors de portée de l'ancien sélecteur : leur largeur
   * n'est pas en pixels (`width:100%`), et celle de A01G est déclarée EN DERNIER
   * (`background:…;width:100%`), donc même un sélecteur acceptant les pourcentages
   * l'aurait manquée tant qu'il restait ancré. Elles sont maintenant atteignables ;
   * les MONTER est un autre lot, avec ses routes et ses données.
   *
   * ── TROIS DES QUATRE ONT MAINTENANT LEUR PROPRE CONTRAT ───────────────────
   *
   * A01C ne lit qu'UNE prise (`thread`), A01P six, A01G deux. Les quatre
   * déclaraient pourtant `A01Data` — les vingt prises du fil entier. Cela
   * obligeait la page à passer tout A01 à une fenêtre de commentaires, et surtout
   * RIEN NE DISAIT ce que ces fenêtres consomment : au moment de les brancher sur
   * `GET /comments`, il faut savoir quoi remplir, et `A01Data` répond pour A01,
   * pas pour A01C.
   *
   * A01G A CESSÉ D'ÊTRE STATIQUE, et c'est ce qui manquait au lot précédent : ses
   * quatre cartes de guide sont des DONNÉES (`GET /guides`), déclarées dans
   * `A01G_DONNEES` ci-dessus. La liaison était écrite, le contrat ne l'avait pas
   * suivie — les deux cadres destructuraient donc `guidesSuggeres` et
   * `guidesTrouves` sur un `A01Data` qui ne les porte pas, et `tsc` refusait les
   * deux fichiers. Son contrat est maintenant `A01GData` (`screens/a01g/data.ts`),
   * sur le modèle exact de A01C et A01P.
   *
   * A01S reste seule sur `A01Data` : elle ne consomme AUCUNE donnée — son balisage
   * est entièrement statique, faute de route — donc le transcodeur la génère avec
   * `_props`, et lui donner un type à elle n'apporterait rien.
   *
   * La DONNÉE, elle, ne bouge pas : elle reste là où le `renderVals()` unique de la
   * maquette la met — `screens/a01/data.ts` pour le fil, `screens/accueil/data.ts`
   * pour les deux listes de guides liables. Seul le CONTRAT est déplacé.
   */
  ...[
    { section: 'A01C', modalTitle: 'Commentaires', data: './data', type: 'A01CData' },
    { section: 'A01P', modalTitle: 'Partager', data: './data', type: 'A01PData' },
    {
      section: 'A01G',
      modalTitle: 'Lier un guide',
      donnees: A01G_DONNEES,
      data: './data',
      type: 'A01GData',
    },
    /**
     * A01S — « Créer un sondage » RESTE ENTIÈREMENT DESSINÉE, et il faut l'écrire
     * plutôt que de lui fabriquer une prise.
     *
     * Ses deux cadres sont un FORMULAIRE, et le formulaire d'une fonction qui n'a
     * pas de route : `createPostSchema` est `.strict()` et ne porte AUCUN champ de
     * sondage, donc `POST /posts` refuserait ce que cette fenêtre compose. Le seul
     * sondage du produit vit sur les RÉSEAUX (`createPollSchema`), pas sur le fil.
     *
     * Ses textes sont par ailleurs des EXEMPLES DE SAISIE — « Quelle date pour le
     * repas partagé ? », « Samedi 22 mars » — et les lier pré-remplirait le
     * formulaire d'un membre avec le contenu d'un autre.
     *
     * ET LA MAQUETTE CONTREDIT LA SPEC sur la seule borne qu'elle écrit : elle
     * annonce « Options · 2 à 5 » là où `createPollSchema` accepte DEUX À HUIT
     * options (08 §2.3, `.min(2).max(8)`, relevé). Lier ce libellé demanderait de
     * choisir lequel des deux a raison, ce qui n'est pas une décision de
     * transcodage. Les deux écarts sont REMONTÉS AU PORTEUR.
     */
    { section: 'A01S', modalTitle: 'Créer un sondage' },
  ].map((m) => ({
    file: 'docs/template/03 Accueil v2.dc.html',
    section: m.section,
    out: `apps/web/src/screens/${m.section.toLowerCase()}`,
    dataModule: m.data ?? '../a01/data',
    dataType: m.type ?? 'A01Data',
    ...(m.donnees === undefined ? {} : { donnees: m.donnees }),
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
   * `<div style="width:100%…">`. `extractFrame` ne savait sélectionner qu'une
   * largeur EN PIXELS et ne pouvait donc pas la désigner. ELLE EST MAINTENANT
   * ATTEIGNABLE : `frame.width` accepte toute valeur CSS, et
   * `extractFrame(colonne760, '100%')` rend exactement cette carte — éprouvé par
   * `node tools/generate-screens.mjs --self-test`, qui la transcode aussi.
   *
   * ELLE N'EST PAS MONTÉE POUR AUTANT, et c'est délibéré : la monter est un lot de
   * transcodage, avec sa route, ses données et ses tests. Le lot qui a réparé la
   * sélection s'est arrêté au recensement.
   *
   * Les trois règles que cette colonne énonce sont, elles, FIGÉES par
   * `apps/web/src/screens/accueil/composeur.test.ts`.
   */
  {
    section: 'A01N',
    out: 'apps/web/src/screens/a01n',
    donnees: A01N_DONNEES,
    // Ce cadre ne consomme AUCUNE donnée — la maquette l'écrit entièrement en dur,
    // zéro `{{ }}`, compté. Il prend donc le type par défaut du fichier
    // (`AccueilData`) plutôt que celui des modales voisines : c'est celui qui a déjà
    // une fabrique (`accueilData()`), et le composant n'en lit rien de toute façon.
    heading: 'Nouvelle publication',
    frames: [{ section: 'A01S', width: 390, name: 'Mobile', occurrence: 1 }],
  },

  // ══ Lot 2 · les dix-sept sections restantes ═════════════════════════════════

  /**
   * ── POURQUOI A02, A13 ET A14 NE PARTAGENT PLUS `AccueilData` ───────────────
   *
   * `AccueilData` décrit les CINQUANTE prises des dix-sept écrans de cette
   * maquette, parce qu'elle n'a qu'un `renderVals()`. C'était le bon défaut tant
   * que rien n'était branché : un écran statique n'a pas besoin de savoir ce qu'il
   * consomme. Au branchement, cela devient un piège — on ne sait pas quoi remplir,
   * et une page qui rend A13 déclare les prises de A08.
   *
   * Les trois écrans branchés sur `feed`/`stories` déclarent donc leur contrat :
   * `A02Data` (commentaires et guides rattachés), `A13Data` (la story lue),
   * `A14Data` (l'état de composition). La DONNÉE de la maquette reste dans
   * `screens/accueil/data.ts` — les contrats la réexportent — parce qu'elle y est
   * écrite une fois pour tous les cadres, et que la dupliquer donnerait deux
   * endroits où corriger une faute de frappe.
   *
   * Les quatorze autres écrans gardent `AccueilData` : ils ne sont pas de ce lot.
   */

  /**
   * A02 — une publication et son fil de réponses. `/publications/:id`
   *
   * AUCUN `heading` déclaré, et c'est délibéré : ce cadre ne dessine pas de titre.
   * Son contenu est la publication elle-même, dont le texte fait cinq lignes. En
   * inventer un — « Publication de Fatou Ndiaye » — serait exactement la faute que
   * l'en-tête de `dc-to-jsx.mjs` raconte. Le générateur le signale, et c'est bien :
   * c'est un manque de la MAQUETTE, pas du transcodage.
   */
  { section: 'A02', dataModule: './data', dataType: 'A02Data', frames: desktopAndMobile },

  /**
   * A13 — une story en lecture plein écran. `/stories/:id`
   *
   * « un composant, trois types · AUCUN COMPTEUR DE VUES », écrit la maquette sous
   * sa planche. Elle tient la règle dure §1.2 d'elle-même : rien à signaler.
   */
  { section: 'A13', dataModule: './data', dataType: 'A13Data', frames: desktopAndMobile },

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
    dataModule: './data',
    dataType: 'A14Data',
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

  /**
   * A03 — la liste des guides. `/guides`
   *
   * `dataModule` PROPRE, et c'est le changement de fond du lot : A03 lisait
   * `AccueilData`, dont les guides étaient décrits par `typeof guides` — donc par
   * les TROIS cartes d'exemple de la maquette. `cat` n'y était pas `string` mais
   * l'union des trois catégories écrites à la main, et aucune donnée venue de
   * l'API ne pouvait satisfaire ce contrat. Voir l'en-tête de `a03/data.ts`.
   */
  {
    section: 'A03',
    dataModule: './data',
    dataType: 'A03Data',
    donnees: A03_MOBILE,
    frames: [{ width: 1440, name: 'Desktop' }, fromMob(0, 'MOB', 'Mobile', 'Guides et Démarches')],
  },

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
    dataModule: './data',
    dataType: 'A04Data',
    donnees: A04_DONNEES,
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
    donnees: A05_MOBILE,
    heading: 'Nouveau guide',
    dataModule: './data',
    dataType: 'A05Data',
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
    dataModule: './data',
    dataType: 'A06Data',
    donnees: A06_DONNEES,
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
  {
    section: 'A07',
    donnees: A07_MOBILE,
    // Branché sur `GET /communities` : ses prises sont DÉCLARÉES dans son propre
    // fichier de données, et non déduites d'un jeu d'exemple partagé.
    dataModule: './data',
    dataType: 'A07Data',
    frames: [{ width: 1440, name: 'Desktop' }, fromMob(4, 'MOB', 'Mobile', 'Réseaux')],
  },

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
    /**
     * ── L'ONGLET PAR DÉFAUT CONTREDISAIT LES CINQ AUTRES ────────────────────
     *
     * TROUVÉ EN REGARDANT. `/reseaux/pays-bj?onglet=sujets` — l'onglet par
     * DÉFAUT, celui qu'on voit en arrivant — affichait « BN · Béninois en
     * France · 890 membres · réseau de pays · vous êtes membre », et juste
     * dessous, dans la même page : « Rejoignez ce réseau pour voir ses sujets
     * et ses membres. » Le même écran disait à la fois que le lecteur est
     * membre et qu'il ne l'est pas, et nommait un réseau qui n'est pas celui de
     * l'URL. Les cinq autres onglets, eux, affichaient « Bénin · 99 membres ».
     *
     * A08 n'était pas dans le lot des cadres sourds — il LIT déjà ses prises
     * (rail, panneau, onglets, sujets) — mais son en-tête de réseau, lui,
     * restait écrit en dur. C'est le même littéral, la même prise et le même
     * convertisseur que les vingt-cinq planches A08T : deux déclarations.
     *
     * « vous êtes membre » n'est PAS lié sur ce cadre et c'est volontaire : sur
     * A08 la phrase est fausse pour un passant, et `monAppartenance` rend la
     * chaîne vide quand `myRole` est nul — ce qui laisserait un « · » orphelin.
     * C'est le défaut que la note de `reseau-screen.tsx` décrit. On lie donc la
     * ligne ENTIÈRE à une seule prise, `reseau.resume`, qui compose ses
     * séparateurs dans la donnée et peut donc les faire disparaître.
     */
    donnees: [
      ...A08_MOBILE,
      {
        noeud: '>Béninois en France<',
        devient: '>{{ reseau.nom }}<',
        fois: 1,
        why: 'Le nom du réseau ouvert, de `GET /communities/:slug` — et le titre de la page. Les deux cadres : le mobile l’écrit aussi.',
      },
      {
        noeud: '>BN<',
        devient: '>{{ reseau.initiales }}<',
        fois: 1,
        why: 'Les initiales de la pastille du réseau, dérivées de son nom.',
      },
      {
        noeud: '>890 membres · réseau de pays · vous êtes membre<',
        devient: '>{{ reseau.resume }}<',
        fois: 1,
        frames: ['Desktop'],
        /**
         * UNE SEULE PRISE POUR TOUTE LA LIGNE, et non trois comme sur A08T.
         *
         * Sur A08T les trois morceaux sont toujours connus : on n'y arrive qu'en
         * étant membre. Ici non — A08 est le SEUL écran du module qu'un passant
         * peut ouvrir, et `myRole` y est nul. Avec trois interpolations, les deux
         * « · » du dessin resteraient orphelins autour d'un vide. En liant la
         * ligne entière, les séparateurs passent dans la donnée, où
         * `resumeReseau()` ne les écrit que entre deux morceaux présents.
         */
        why: 'La ligne de résumé du réseau — nombre de membres PUBLIC (`memberCount`), genre, et appartenance quand elle est connue ; les séparateurs sont composés dans la donnée, jamais laissés orphelins.',
      },
    ],
    dataModule: './data',
    dataType: 'A08Data',
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
    /**
     * SON PROPRE CONTRAT, et c'est le changement de fond de ce lot pour A08T.
     *
     * Les vingt-cinq planches déclaraient `AccueilData` — les cinquante prises
     * des dix-sept écrans de cette maquette — et n'en lisaient AUCUNE. Au
     * branchement, cela devient un piège : on ne sait pas quoi remplir, et la
     * page qui monte un onglet déclare les prises de A01. `A08TData` dit
     * exactement ce que ces planches lisent, c'est-à-dire l'en-tête du réseau.
     */
    dataModule: './data',
    dataType: 'A08TData',
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
    /**
     * ── LES VINGT-CINQ PLANCHES LISENT MAINTENANT LEUR RÉSEAU ───────────────
     *
     * Elles écrivaient « Béninois en France » et « 890 membres » EN DUR, sur les
     * vingt-cinq. Un membre de « Sénégalais à Paris » ouvrait son onglet
     * « Membres » et lisait le nom d'un autre réseau — le défaut était visible à
     * l'œil et aucun test ne le voyait, puisque le JSX compile.
     *
     * CE QUI N'EST PAS LIÉ ICI, et pourquoi il faut le dire plutôt qu'inventer :
     * le CONTENU de chaque onglet — les photos de l'album, les événements, les
     * publications du fil, les lignes de membres. Chacun demande sa propre route
     * et son propre état (`GET /communities/:id/{members,events,albums,feed}`),
     * c'est-à-dire un hook par onglet, et ce n'est pas du branchement de cadre.
     * `use-reseau.ts` n'en appelle aujourd'hui que deux. Remonté au rapport de
     * lot ; les onglets gardent donc le contenu de la maquette, et leur EN-TÊTE
     * dit la vérité.
     *
     * Les comptes de `fois` sont RELEVÉS, planche par planche, par un compteur
     * lancé sur les octets de la maquette — pas supposés. Les groupes ci-dessous
     * sont exactement ceux que ce relevé dessine.
     */
    donnees: [
      // ── Vue MEMBRE, cinq planches d'ordinateur ────────────────────────────
      ...enteteReseau({
        frames: ['Fil', 'Evenements', 'Membres', 'Album'],
        resume: '>890 membres · réseau de pays · vous êtes membre<',
        devientResume: '>{{ reseau.membres }} · {{ reseau.genre }} · {{ reseau.monAppartenance }}<',
      }),
      // « À propos » montre AUSSI la carte de description : « Public » y figure
      // DEUX fois, et les deux disent la même visibilité.
      ...enteteReseau({
        frames: ['APropos'],
        resume: '>890 membres · réseau de pays · vous êtes membre<',
        devientResume: '>{{ reseau.membres }} · {{ reseau.genre }} · {{ reseau.monAppartenance }}<',
        pub: 2,
      }),
      // ── Vue PROPRIÉTAIRE, huit planches ─────────────────────────────────
      //
      // La ligne de résumé compte les modérateurs, et « Gérer » est la seule
      // planche de la vue à ne PAS porter la description longue : c'est un
      // formulaire, et la maquette ne l'y dessine pas. Compté, pas supposé.
      ...enteteReseau({
        frames: ['AdminFil', 'AdminMembres', 'AdminEvenements', 'AdminAlbum'],
        resume: '>890 membres · réseau de pays · vous gérez ce réseau avec 2 modérateurs<',
        devientResume: '>{{ reseau.resumeProprietaire }}<',
      }),
      ...enteteReseau({
        frames: ['AdminGerer'],
        resume: '>890 membres · réseau de pays · vous gérez ce réseau avec 2 modérateurs<',
        devientResume: '>{{ reseau.resumeProprietaire }}<',
        desc: false,
      }),
      ...enteteReseau({
        frames: ['AdminAPropos', 'AdminAProposEdition'],
        resume: '>890 membres · réseau de pays · vous gérez ce réseau avec 2 modérateurs<',
        devientResume: '>{{ reseau.resumeProprietaire }}<',
        pub: 2,
      }),
      // Le composeur des deux planches « Fil » nomme le réseau dans son invite :
      // « Publier dans Béninois en France… ». La planche MOBILE écrit « Publier
      // dans le réseau… » — sans le nom — donc elle n'a rien à lier là, et on ne
      // lui impose pas un nom qu'elle ne dessine pas.
      {
        noeud: '>Publier dans Béninois en France…<',
        devient: '>Publier dans {{ reseau.nom }}…<',
        fois: 1,
        frames: ['Fil', 'AdminFil'],
        why: 'L’invite du composeur nomme le réseau où l’on publie — c’est la seule chose qui distingue ce champ d’un autre.',
      },
      // La pastille des demandes d'adhésion, sur l'onglet « Membres » des sept
      // planches d'ordinateur de la vue propriétaire. Voir sa note.
      pastilleDemandes([
        'AdminFil',
        'AdminGerer',
        'AdminMembres',
        'AdminEvenements',
        'AdminAlbum',
        'AdminAPropos',
        'AdminAProposEdition',
      ]),
      // ── Les planches MOBILES de MOB2 ────────────────────────────────────
      //
      // L'en-tête mobile ne dessine QUE le nombre de membres — ni le genre du
      // réseau, ni mon rôle : la maquette raccourcit, comme elle le fait sur K02.
      ...enteteReseau({
        frames: ['FilMobile', 'EvenementsMobile', 'MembresMobile', 'AlbumMobile'],
        resume: '>890 membres<',
        devientResume: '>{{ reseau.membres }}<',
        pub: 0,
        desc: false,
      }),
      // « À propos » mobile écrit « 890 membres » DEUX fois — l'en-tête et la
      // carte — et les deux sont le même nombre, donc liées ensemble.
      ...enteteReseau({
        frames: ['AProposMobile'],
        resume: '>890 membres<',
        devientResume: '>{{ reseau.membres }}<',
        resumeFois: 2,
        pub: 1,
        desc: false,
      }),
      ...enteteReseau({
        frames: ['AdminFilMobile', 'AdminMembresMobile', 'AdminEvenementsMobile', 'AdminAlbumMobile'],
        resume: '>890 membres · propriétaire<',
        devientResume: '>{{ reseau.membres }} · {{ reseau.monRole }}<',
        pub: 0,
        desc: false,
      }),
      // La même pastille, aux mesures du téléphone : la maquette la dessine en
      // 9.5 px dans un rond de 18 px. Relevé, pas déduit du cadre d'ordinateur.
      pastilleDemandes(
        ['AdminFilMobile', 'AdminMembresMobile', 'AdminEvenementsMobile', 'AdminAlbumMobile'],
        TAILLE_MOBILE,
      ),
      // ── Les quatre planches SANS en-tête de réseau ───────────────────────
      //
      // Ce sont les trois formulaires pleine page (annonce ×2, édition du
      // « À propos ») et la vue « Gérer » mobile. La maquette ne leur dessine ni
      // couverture ni barre d'onglets, donc rien du bandeau ne s'y lie — mais
      // elles portent chacune d'AUTRES données, et c'est ce qui les faisait rester
      // en `(_props: …)` alors qu'elles avaient de quoi lire.
      {
        noeud: '>Notifier les 890 membres<',
        devient: '>Notifier les {{ reseau.membres }}<',
        fois: 1,
        frames: ['AdminAnnonce', 'AdminAnnonceMobile'],
        why: 'Le formulaire d’annonce dit COMBIEN de membres la notification touchera (07 §3.3) — et la limite de deux annonces par semaine se compte sur ce nombre-là.',
      },
      {
        noeud: '>Demandes · 4<',
        devient: '>Demandes · {{ reseau.demandes }}<',
        fois: 1,
        frames: ['AdminGererMobile'],
        why: 'L’onglet « Demandes » de la vue de gestion, de `GET /communities/:slug/members?pending=true`.',
      },
      {
        noeud:
          '<div style="font-size:20px;font-weight:800;color:#16211D">890</div><div style="font-size:11.5px;color:#5D6B66">membres</div>',
        devient:
          '<div style="font-size:20px;font-weight:800;color:#16211D">{{ reseau.membresNombre }}</div><div style="font-size:11.5px;color:#5D6B66">membres</div>',
        fois: 1,
        frames: ['AdminGererMobile'],
        /**
         * L'ANCRE PORTE LES DEUX LIGNES DE LA TUILE, exprès. « 890 » seul figure
         * aussi dans la ligne de résumé du bandeau sur d'autres planches, et un
         * jour sur celle-ci : une ancre sur le nombre nu lierait la première
         * occurrence venue, ce qui est précisément le défaut que `fois` existe
         * pour empêcher. Le mot « membres » est le discriminant.
         */
        why: 'Le nombre de membres de la tuile de gestion — `memberCount`, PUBLIC, et non `counters.members` qui arrive masqué.',
      },
      {
        noeud:
          '>Le réseau des Béninoises et Béninois installés en France. Entraide consulaire, bons plans et fêtes.<',
        devient: '>{{ reseau.description }}<',
        fois: 1,
        frames: ['AdminAProposEditionMobile'],
        /**
         * CE N'EST PAS LE MÊME TEXTE QUE L'EN-TÊTE, et il ne faut pas le lier au
         * même endroit par étourderie : la planche d'édition écrit « Entraide
         * consulaire, bons plans et fêtes. » là où l'en-tête écrit « Démarches
         * consulaires, entraide, fêtes. ». Deux rédactions de la même donnée dans
         * la même maquette — signalé au porteur. Les deux pointent `description`,
         * qui est la seule que le serveur connaisse.
         */
        why: 'La description en cours d’édition, de `GET /communities/:slug` (`description`).',
      },
      // ── CE QUE LES CAPTURES ONT MONTRÉ, ET QUE LE JOURNAL NE DISAIT PAS ──
      //
      // L'onglet « À propos » affichait « 890 / membres » et « Pays / catégorie »
      // à côté d'une visibilité LIÉE : trois tuiles côte à côte, dont une seule
      // disait la vérité. Et l'onglet « Membres » proposait « Rechercher parmi
      // 890 membres » sur un réseau qui en compte 99. Aucun test ne l'avait vu,
      // parce qu'aucun test ne regardait l'écran.
      {
        noeud:
          '<div style="font-size:18px;font-weight:800">890</div><div style="font-size:12px;color:#5D6B66">membres</div>',
        devient:
          '<div style="font-size:18px;font-weight:800">{{ reseau.membresNombre }}</div><div style="font-size:12px;color:#5D6B66">membres</div>',
        fois: 1,
        frames: ['APropos', 'AdminAPropos'],
        /**
         * L'ANCRE PORTE LES DEUX LIGNES DE LA TUILE. « 890 » seul figure ailleurs
         * dans ces mêmes cadres — dans la ligne de résumé de l'en-tête — et une
         * ancre sur le nombre nu lierait la première occurrence venue. Le mot
         * « membres » et les deux corps de police sont le discriminant.
         */
        why: 'La tuile « membres » de la carte « À propos » — `memberCount`, PUBLIC, et non `counters.members` qui arrive masqué.',
      },
      {
        noeud:
          '<div style="font-size:18px;font-weight:800">Pays</div><div style="font-size:12px;color:#5D6B66">catégorie</div>',
        devient:
          '<div style="font-size:18px;font-weight:800">{{ reseau.genreCourt }}</div><div style="font-size:12px;color:#5D6B66">catégorie</div>',
        fois: 1,
        frames: ['APropos', 'AdminAPropos'],
        why: 'La tuile « catégorie » : « Ville », « Pays » ou « Intérêt », de `kind` — le même mot que les pastilles de A07 emploient déjà, et non un mot nouveau.',
      },
      {
        noeud:
          '<div style="font-size:18px;font-weight:800">2023</div><div style="font-size:12px;color:#5D6B66">créé en</div>',
        devient:
          '<div style="font-size:18px;font-weight:800">{{ reseau.creeEn }}</div><div style="font-size:12px;color:#5D6B66">créé en</div>',
        fois: 1,
        frames: ['APropos', 'AdminAPropos'],
        /**
         * L'ANNÉE VIENT DE `createdAt`, QUE LE SERVEUR ENVOIE — jamais d'une
         * soustraction faite ici. Le même principe que `active`/`appealable` sur
         * K09 : comparer à l'horloge du navigateur donnerait une année fausse dès
         * qu'une machine est décalée, et le 31 décembre à 23 h pour tout le monde.
         */
        why: 'La tuile « créé en » : l’année de `createdAt`, découpée sur la chaîne ISO que le serveur envoie.',
      },
      // « Gérer » dessine SES PROPRES tuiles — 24 px au lieu de 18, avec un
      // troisième étage (« +34 ce mois ») que les cartes « À propos » n'ont pas.
      // Ce n'est donc pas le même fragment, et la génération l'a dit : le compte
      // est tombé à zéro sur ce cadre, et c'est exactement le garde-fou de `fois`
      // qui a parlé. Sa tuile est déclarée à part.
      {
        noeud:
          '<div style="font-size:24px;font-weight:800;letter-spacing:-0.6px;color:#16211D">890</div><div style="font-size:12px;color:#5D6B66;margin-top:2px">membres</div>',
        devient:
          '<div style="font-size:24px;font-weight:800;letter-spacing:-0.6px;color:#16211D">{{ reseau.membresNombre }}</div><div style="font-size:12px;color:#5D6B66;margin-top:2px">membres</div>',
        fois: 1,
        frames: ['AdminGerer'],
        why: 'La tuile « membres » de la vue de gestion — `memberCount`, PUBLIC.',
      },
      {
        noeud: '>Rechercher parmi 890 membres<',
        devient: '>Rechercher parmi {{ reseau.membres }}<',
        fois: 1,
        frames: ['Membres', 'AdminMembres', 'MembresMobile', 'AdminMembresMobile'],
        why: 'L’invite du champ de recherche de l’onglet « Membres » dit COMBIEN de membres elle fouille — et c’est le compte du réseau ouvert.',
      },
      {
        noeud: '>184 / 500<',
        devient: '>{{ reseau.descriptionLongueur }} / 500<',
        fois: 1,
        frames: ['AdminAProposEdition', 'AdminAProposEditionMobile'],
        /**
         * 500 RESTE DESSINÉ, et c'est volontaire : c'est le plafond de
         * `communityDescriptionSchema` (`.max(500)`), une règle du contrat partagé
         * et non une donnée du réseau. Le lier ferait croire qu'il peut varier par
         * réseau, et il ne peut pas.
         */
        why: 'La longueur de la description en cours d’édition, comptée sur le texte même — le plafond de 500 est celui de `communityDescriptionSchema`.',
      },
    ],
  },

  /** A09 — un sujet du réseau. `/reseaux/:slug/sujets/:id` */
  {
    section: 'A09',
    donnees: A09_MOBILE,
    dataModule: './data',
    dataType: 'A09Data',
    frames: [
      { width: 1440, name: 'Desktop' },
      fromMob(6, 'MOB', 'Mobile', 'Renouveler son passeport béninois depuis la France'),
    ],
  },

  /** A10 — créer un réseau. `/reseaux/nouveau` */
  {
    section: 'A10',
    donnees: A10_MOBILE,
    dataModule: './data',
    dataType: 'A10Data',
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
    /**
     * `MobileCarte` NE LIT AUCUNE DONNÉE, et ce n'est pas un oubli de déclaration.
     *
     * La planche ne contient que trois choses : son en-tête, la bascule
     * « Carte / Annuaire » — qui est un état de vue, pas une donnée — et
     * `<iframe src="Carte Villes.html" title="Carte des membres">`. Toute la carte
     * est DANS cette page externe : il n'y a pas un littéral de donnée à lier dans
     * ce cadre, et lui en fabriquer un serait un mensonge.
     *
     * DEUX CHOSES À REMONTER, vues en ouvrant l'écran :
     *   · `Carte Villes.html` est un chemin RELATIF vers un fichier de
     *     `docs/template/`. Servi par l'application, cet `iframe` demande
     *     `/villes/Carte%20Villes.html` et reçoit un 404 : le cadre Carte est donc
     *     VIDE en pratique, et il ne le dit pas ;
     *   · la bascule « Carte / Annuaire » est dessinée en `<span>` et ne change
     *     rien au clic — c'est la navigation, qui n'est pas de ce lot.
     *
     * Le cadre `Mobile` de la même section, lui, EST l'annuaire et lit déjà
     * `dirFilters` et `directory` par le dialecte de la maquette.
     */
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
    donnees: A12_MOBILE,
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
   * CETTE FENÊTRE A ÉTÉ MANQUÉE PAR DEUX LOTS SUCCESSIFS, et la raison mérite d'être
   * écrite parce qu'elle explique la forme actuelle de `extractFrame` : le motif
   * était ANCRÉ sur le début du style (`<div style="width:760px…`), et les trois
   * planches d'ordinateur de cette fenêtre écrivent `position:relative;width:760px…`
   * — leur voile et leur panneau se calent sur elles. Elles étaient donc invisibles
   * à l'inventaire, sans qu'aucune erreur ne le signale.
   *
   * Un premier correctif les a rendues joignables en déclarant le préfixe de leur
   * style (`stylePrefix`) — c'est-à-dire en déclarant LA FORME de leur déclaration.
   * `extractFrame` reconnaît maintenant la largeur où qu'elle soit déclarée dans le
   * style, donc ces trois cadres se déclarent comme tous les autres, et le préfixe a
   * disparu. La feuille mobile, elle, a toujours été un cadre ordinaire de 390 px.
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
    donnees: A12C_DONNEES,
    frames: [
      // La feuille du bas, avec son voile `rgba(22,33,29,.5)` DESSINÉ PAR LA
      // MAQUETTE — rien n'est emprunté ici, contrairement aux fenêtres de 08 Compte.
      { section: 'A12T', width: 390, name: 'Mobile', occurrence: 0, modalTitle: 'Contribuer à Lyon' },
      { section: 'A12T', width: 760, name: 'Desktop', occurrence: 0, modalTitle: 'Contribuer à la fiche Lyon' },
      { section: 'A12T', width: 760, name: 'DesktopProduit', occurrence: 1, modalTitle: 'Produit du pays' },
      { section: 'A12T', width: 760, name: 'DesktopBudget', occurrence: 2, modalTitle: 'Budget réel' },
    ],
    /**
     * ── LES QUATRE PLANCHES NOMMENT LA VILLE, ET LA NOMMAIENT EN DUR ────────
     *
     * « Contribuer à Lyon », « Contribuer à la fiche Lyon », « Étape 2 sur 2 ·
     * Lyon » : la ville est dans le TITRE de chacune des quatre planches, et le
     * titre est ce que `aria-labelledby` annonce au lecteur d'écran. Ouvrir la
     * contribution depuis la fiche de Marseille disait « Contribuer à Lyon ».
     *
     * Les deux premiers titres sont AUSSI les `modalTitle` déclarés ci-dessus :
     * `retitrerSurDonnees` reprend le titre sur sa forme LIÉE, exactement comme
     * pour « Fatou Ndiaye » sur K02, et le journal le dit. Sans cette reprise la
     * liaison ferait disparaître le texte que la promotion cherche.
     *
     * Les deux derniers (« Produit du pays », « Budget réel ») ne portent PAS le
     * nom de la ville : la maquette le met dans un surtitre, « Étape 2 sur 2 ·
     * Lyon », au-dessus. C'est donc ce surtitre qui est lié, pas le titre.
     */
    donnees: [
      {
        noeud: '>Contribuer à Lyon<',
        devient: '>Contribuer à {{ ville.nom }}<',
        fois: 1,
        frames: ['Mobile'],
        why: 'Le titre de la feuille mobile nomme la ville à laquelle on contribue — et c’est ce que le lecteur d’écran annonce.',
      },
      {
        noeud: '>Contribuer à la fiche Lyon<',
        devient: '>Contribuer à la fiche {{ ville.nom }}<',
        fois: 1,
        frames: ['Desktop'],
        why: 'Le titre de la fenêtre d’ordinateur, étape 1 — la maquette l’écrit plus long que sur mobile.',
      },
      {
        noeud: '>Étape 2 sur 2 · Lyon<',
        devient: '>Étape 2 sur 2 · {{ ville.nom }}<',
        fois: 1,
        frames: ['DesktopProduit', 'DesktopBudget'],
        /**
         * « Étape 2 sur 2 » RESTE DESSINÉ, et il le doit : la maquette ne dessine
         * que DEUX des quatre seconds volets (le produit et le budget ; le bon
         * plan et le témoignage n'en ont pas). Lier le compteur d'étapes ferait
         * croire qu'il varie, alors que c'est la maquette qui en décide.
         */
        why: 'Le surtitre du second volet nomme la ville ; le compteur d’étapes, lui, est du dessin.',
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
    donnees: A12T_DONNEES,
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
  ...(SQUELETTE_EN_BOUCLE.has(s.section) ? { liens: squeletteBoucle(cadresDuRail(s.frames)) } : {}),
  ...s,
}));
