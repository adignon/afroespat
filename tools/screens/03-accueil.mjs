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
import { barreBasse, barreBasseBoucle, cadresDuRail, squeletteBoucle } from '../squelette-membre.mjs';

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
/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LES LIGNES DE MEMBRES DE L'ONGLET « MEMBRES — VUE PROPRIÉTAIRE »           ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Elles étaient cinq noms peints en dur — Aïcha Diop, Marc Koudou, Sandra M.,
 * Fatou Ndiaye, Kofi Boateng — sur TOUS les réseaux. C'est le dernier endroit où
 * ça ne pouvait pas rester : l'arbitrage du porteur sur « retirer » et « bannir »
 * demande deux gestes qui portent sur UNE PERSONNE, et un geste de modération
 * posé sur un nom de maquette n'est pas un demi-branchement, c'est un piège.
 *
 * ⚠ LES DEUX PLANCHES NE DESSINENT PAS LA MÊME LIGNE, et c'est le piège nº 1 du
 * mémo : 40 px d'avatar contre 38, 12 px d'écart contre 10, `font-size:11px`
 * contre 10,5 sur la pastille de rôle, un `<div>` de texte contre un `<span>`, et
 * la poignée « ··· » dans un rond de 36 px sur l'ordinateur contre un SVG nu sur
 * le téléphone. Deux gabarits, donc, et aucune mesure partagée.
 *
 * ⚠ ET LES SOUS-TITRES NE DISENT PAS LA MÊME CHOSE : « Installée · Lyon 7e » sur
 * l'ordinateur, « Lyon 7e » seul sur le téléphone. Deux prises (`sub`, `subM`)
 * plutôt qu'une, parce que c'est la maquette qui en décide.
 *
 * ── CE QUI RESTE DESSINÉ, ET POURQUOI ─────────────────────────────────────
 *
 * LA COCHE VERTE à côté de chaque nom. `communityMemberSchema` ne porte AUCUN
 * champ de vérification — c'est écrit dans son en-tête, et c'est voulu : « rien
 * dans cette liste ne dit le niveau de vérification ». La coche reste donc le
 * dessin de la maquette sur toutes les lignes. La lier à une donnée qui n'existe
 * pas serait inventer ; la retirer serait redessiner. REMONTÉ.
 *
 * Les DEUX PASTILLES de rôle, en revanche, sont des états : la maquette dessine
 * « Propriétaire » sur la première ligne et « Modérateur » sur les deux
 * suivantes, et les deux dernières n'en portent aucune. Ce sont ses trois cas,
 * rendus par deux `<sc-if>` — le mot reste celui qu'elle écrit.
 */
const BADGE_PROPRIETAIRE_WEB =
  '<span style="background:#0F5C48;color:#fff;font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px;white-space:nowrap">Propriétaire</span>';
const BADGE_MODERATEUR_WEB =
  '<span style="background:#E3F0EB;color:#0F5C48;font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px;white-space:nowrap">Modérateur</span>';

const LIGNE_MEMBRE_WEB = (bg, initiales, nom, sous, pastille) =>
  '<div style="display:flex;align-items:center;gap:12px;padding:12px 4px;border-bottom:1px solid #F0F3F2">' +
  '<span style="width:40px;height:40px;border-radius:999px;background:' +
  bg +
  ';color:#fff;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0">' +
  initiales +
  '</span><div style="flex:1;min-width:0">' +
  '<div style="display:flex;align-items:center;gap:6px;font-size:14px;font-weight:700">' +
  nom +
  '<svg width="13" height="13" viewBox="0 0 24 24" fill="#16785E"><circle cx="12" cy="12" r="10"/>' +
  '<path d="m8 12 3 3 5-6" stroke="#fff" stroke-width="2.2" fill="none"/></svg></div>' +
  '<div style="font-size:12px;color:#8A958F">' +
  sous +
  '</div></div>' +
  pastille +
  '<span style="width:36px;height:36px;border-radius:999px;background:#F2F5F4;display:flex;align-items:center;justify-content:center">' +
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16211D" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M5 12h.01M12 12h.01M19 12h.01"/></svg></span></div>';

const BADGE_PROPRIETAIRE_MOB =
  '<span style="background:#0F5C48;color:#fff;font-size:10.5px;font-weight:700;padding:3px 9px;border-radius:999px;white-space:nowrap">Propriétaire</span>';
const BADGE_MODERATEUR_MOB =
  '<span style="background:#E3F0EB;color:#0F5C48;font-size:10.5px;font-weight:700;padding:3px 9px;border-radius:999px;white-space:nowrap">Modérateur</span>';

const LIGNE_MEMBRE_MOB = (bg, initiales, nom, sous, pastille) =>
  '<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #F0F3F2">' +
  '<span style="width:38px;height:38px;border-radius:999px;background:' +
  bg +
  ';color:#fff;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0">' +
  initiales +
  '</span><span style="flex:1;min-width:0">' +
  '<span style="display:flex;align-items:center;gap:5px;font-size:13.5px;font-weight:700">' +
  nom +
  '<svg width="12" height="12" viewBox="0 0 24 24" fill="#16785E"><circle cx="12" cy="12" r="10"/>' +
  '<path d="m8 12 3 3 5-6" stroke="#fff" stroke-width="2.2" fill="none"/></svg></span>' +
  '<span style="display:block;font-size:11.5px;color:#8A958F">' +
  sous +
  '</span></span>' +
  pastille +
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16211D" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M5 12h.01M12 12h.01M19 12h.01"/></svg></div>';

/** Les deux pastilles sous `<sc-if>` : les trois cas que la maquette dessine. */
const PASTILLES_ROLE = (proprietaire, moderateur) =>
  '<sc-if value="{{ m.proprietaire }}">' +
  proprietaire +
  '</sc-if><sc-if value="{{ m.moderateur }}">' +
  moderateur +
  '</sc-if>';

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

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ L'ICÔNE D'IMAGE N'EST DESSINÉE QUE SUR LE TÉLÉPHONE                        ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * COMPTÉ sur les octets de la maquette : la barre d'outils d'ORDINATEUR de A05
 * (ligne 757) n'écrit que la boucle des six marques. L'icône d'image figure une
 * seule fois dans tout le fichier, dans la barre basse du cadre de 390 px
 * (ligne 1372) — et c'est elle qu'on emprunte.
 *
 * POURQUOI L'EMPRUNTER PLUTÔT QUE DE S'EN PASSER : les images d'un guide marchent
 * depuis cette session (`POST /media` avec `kind=GUIDE`, et `guideBodyMediaKeys`
 * valide `/media/<clé>` comme la SEULE forme acceptée). Laisser l'ordinateur sans
 * bouton de dépôt aurait fait un éditeur où l'on peut mettre une image sur un
 * téléphone et pas sur un clavier — le demi-branchement que le porteur refuse.
 *
 * ⚠ CE QUE L'EMPRUNT COÛTE, ET IL FAUT LE DIRE : la géométrie de ce bouton est
 * celle du TÉLÉPHONE — 40 px de côté, fond `#E3F0EB`, tracé de 17 px — posée au
 * milieu d'une barre que l'ordinateur dessine à 34 px et sans fond. Le bouton
 * emprunté se reconnaît, et c'est préférable à une taille choisie par un agent :
 * ce fichier ne fige aucune valeur de dessin, et la planche d'ordinateur ne dit
 * rien de ce bouton-là. REMONTÉ au porteur.
 *
 * L'ANCRE EST LA BOUCLE DES SIX MARQUES, et l'emprunt se pose APRÈS elle : c'est
 * la place que la maquette lui donne sur le téléphone — dernier de la barre.
 */
const BOUTON_IMAGE_MOBILE =
  '<span style="height:40px;min-width:40px;border-radius:10px;display:flex;' +
  'align-items:center;justify-content:center;background:#E3F0EB">' +
  '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#0F5C48" ' +
  'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M3 4h18v16H3zM8.5 11a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2zM21 16l-5-5-9 9"/></svg></span>';

/**
 * L'ANCRE : la FERMETURE de la barre d'outils d'ordinateur, suivie de l'ouverture
 * du `<pre>` du corps.
 *
 * ⚠ CE N'EST PAS `</sc-for></div>`, et la génération l'a dit : ce fragment figure
 * DEUX FOIS dans le cadre — la barre d'outils, et la carte « AVANT DE PUBLIER »
 * qui boucle sur ses trois règles. `applyBorrows` a refusé de produire (« figure
 * 2 fois dans le cadre ; il en faut exactement une »), ce qui est exactement le
 * comportement voulu.
 *
 * L'ancre commence donc APRÈS `</sc-for>` : l'emprunt se pose entre la fermeture
 * de la boucle et celle de la barre, c'est-à-dire en DERNIER de la barre et HORS
 * de la boucle. L'y poser dedans aurait dessiné six boutons d'image.
 */
const FIN_BARRE_OUTILS_WEB =
  '</div><pre style="margin:0;flex:1;padding:18px 20px;font-family:ui-monospace,Menlo,monospace';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LA CARTE DES PAGES DE L'ÉDITEUR — EMPRUNTÉE AU « MODE MODIFIER LES ÉTAPES » ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « dans le processus de création "Créer un guide" il faut au niveau
 * de la side bar la possibilité d'ajouter les pages ou d'en retirer, pour l'auteur
 * bien sûr. »
 *
 * ⚠ AUCUN DES DEUX CADRES DE A05 NE DESSINE CELA. Sa colonne latérale porte deux
 * cartes — « À PARTIR DE MON PARCOURS » (ambre, conditionnelle) et « AVANT DE
 * PUBLIER » — et son cadre de 390 px n'a pas de colonne du tout.
 *
 * CE QUE LA MAQUETTE DESSINE AILLEURS, et qui est exactement la forme demandée :
 * le bloc « MODE “MODIFIER LES ÉTAPES” » de `docs/template/04 Parcours.dc.html`
 * (ligne 49) — une carte blanche, une liste de lignes bordées portant chacune son
 * libellé et SA CORBEILLE (`M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13`), et un lien vert
 * « + Ajouter une étape personnelle » (`M12 5v14M5 12h14`). On reprend la forme,
 * la donnée change les libellés.
 *
 * ── CE QUI EST EMPRUNTÉ, ET CE QUI NE L'EST PAS ────────────────────────────
 *
 * ⚠ LA POIGNÉE DE GLISSEMENT N'EST PAS REPRISE, et c'est un choix, pas un oubli.
 * La maquette la dessine (`M9 6h.01M9 12h.01…`) parce que son mode « modifier les
 * étapes » se réordonne À LA SOURIS. `PATCH /guides/:id/pages/:pageId` accepte bien
 * `position`, mais un glisser-déposer ne marche pas au doigt sur 390 px sans
 * inventer une seconde interaction — et la règle du porteur est que toute
 * correction prenne sur les DEUX planches. Emprunter la poignée sans la rendre
 * vivante aurait posé une prise morte de plus. LE RÉORDONNANCEMENT N'EST DONC PAS
 * FAIT, et il est REMONTÉ : la route attend un contrôle dessiné qui fonctionne aux
 * deux largeurs (deux chevrons par ligne, par exemple).
 *
 * ⚠ LA RANGÉE EST CELLE DE LA PLANCHE D'ORDINATEUR DU PARCOURS, sur les DEUX
 * cadres de A05. La planche mobile du parcours en dessine une variante d'un cran
 * plus petite (`gap:10px`, `padding:12px`, 13,5 px) mais SANS `margin-top` : ses
 * lignes vivent dans un conteneur à `gap:8px` que A05 n'a pas, et elles se
 * colleraient les unes aux autres dans la carte. On emprunte donc la rangée qui
 * porte son propre écart. REMONTÉ.
 */
const PARCOURS = 'docs/template/04 Parcours.dc.html';

/**
 * L'ANCRE DU CADRE DE 390 px : le segment « Écrire / Aperçu », que seule la
 * planche mobile dessine (l'ordinateur montre les deux côte à côte). Figure une
 * fois dans ce cadre, compté.
 */
const SEGMENT_ECRIRE_APERCU =
  '<div style="display:flex;gap:4px;background:#EEF2F0;border-radius:12px;padding:4px;' +
  'flex-shrink:0">';

/** La carte blanche du bloc « MODE MODIFIER » — noter le `;` final, il est dans la maquette. */
const CARTE_PARCOURS =
  '<div style="background:#fff;border:1px solid #E6EBE9;border-radius:22px;padding:18px;">';

/** Le titre en petites capitales des cartes de la colonne de A05. */
const TITRE_CARTE_A05 =
  '<div style="font-size:10.5px;font-weight:700;letter-spacing:1px;color:#8A958F">';

/**
 * L'ANCRE DU CADRE DE 1 440 px : la carte « AVANT DE PUBLIER », OUVERTURE COMPRISE.
 *
 * ⚠ L'OUVERTURE FAIT PARTIE DE L'ANCRE, et c'est la correction d'un défaut
 * MESURÉ sur le cadre produit : ancrée sur le seul titre, l'emprunt se posait
 * ENTRE l'ouverture de la carte et son titre — donc une carte DANS une carte, deux
 * bordures et deux remplissages de 18 px imbriqués. L'ancre inclut donc la balise
 * ouvrante, et l'emprunt devient un FRÈRE de cette carte, au-dessus d'elle.
 */
const ANCRE_AVANT_PUBLIER =
  '<div style="background:#fff;border:1px solid #E6EBE9;border-radius:22px;padding:18px">' +
  TITRE_CARTE_A05 +
  'AVANT DE PUBLIER</div>';

/** Une ligne d'étape, SANS sa poignée de glissement : conteneur, libellé, corbeille. */
const LIGNE_ETAPE_CONTENEUR =
  '<div style="display:flex;align-items:center;gap:12px;margin-top:8px;padding:12px 14px;' +
  'border-radius:16px;background:#fff;border:1px solid #E6EBE9;">';

const LIGNE_ETAPE_LIBELLE =
  '<span style="flex:1;font-size:14px;font-weight:600">Étape 8 · Assurance habitation</span>';

const LIGNE_ETAPE_CORBEILLE =
  '<span style="width:32px;height:32px;border-radius:999px;background:#F2F5F4;display:flex;' +
  'align-items:center;justify-content:center"><svg width="14" height="14" viewBox="0 0 24 24" ' +
  'fill="none" stroke="#5D6B66" stroke-width="1.8" stroke-linecap="round" ' +
  'stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg></span>';

const LIEN_AJOUTER_ETAPE =
  '<span style="display:flex;align-items:center;gap:8px;margin-top:12px;font-size:13.5px;' +
  'font-weight:700;color:#16785E"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" ' +
  'stroke="#16785E" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M12 5v14M5 12h14"/></svg>Ajouter une étape personnelle</span>';

/**
 * LA CARTE TELLE QUE L'EMPRUNT LA POSE — une ligne, et la liaison en fait la liste.
 *
 * Le titre emprunté est « AVANT DE PUBLIER », celui de la carte voisine : un
 * emprunt pose du DESSIN, et le dessin d'un titre en petites capitales est ce
 * `<div>`-là. Son TEXTE est remplacé par la donnée juste après — même partage que
 * `FEUILLE_ACTIONS`, dont la rangée empruntée porte « Nommer modératrice » jusqu'à
 * ce que la liaison lui donne `{{ a.label }}`.
 */
const CARTE_PAGES_A05 =
  CARTE_PARCOURS +
  TITRE_CARTE_A05 +
  'AVANT DE PUBLIER</div>' +
  LIGNE_ETAPE_CONTENEUR +
  LIGNE_ETAPE_LIBELLE +
  LIGNE_ETAPE_CORBEILLE +
  '</div>' +
  LIEN_AJOUTER_ETAPE +
  '</div>';

/** Les morceaux empruntés, dans l'ordre où le contrôle de résidu les retire. */
const MOTIFS_CARTE_PAGES_A05 = [
  { from: PARCOURS, pattern: CARTE_PARCOURS },
  { from: FILE, pattern: TITRE_CARTE_A05 + 'AVANT DE PUBLIER</div>' },
  { from: PARCOURS, pattern: LIGNE_ETAPE_CONTENEUR },
  { from: PARCOURS, pattern: LIGNE_ETAPE_LIBELLE },
  { from: PARCOURS, pattern: LIGNE_ETAPE_CORBEILLE },
  { from: PARCOURS, pattern: LIEN_AJOUTER_ETAPE },
  { from: PARCOURS, pattern: '</div>' },
  { from: PARCOURS, pattern: '</div>' },
];

/**
 * LA LIAISON DE LA CARTE DES PAGES : son titre, sa liste, son lien d'ajout.
 *
 * `p.bord` SUBSTITUE UNE VALEUR DESSINÉE PAR UNE DONNÉE, et les deux valeurs
 * qu'elle prend sont celles que la MÊME carte du parcours dessine : `1px solid
 * #E6EBE9` au repos, `1.5px solid #16785E` sur la ligne que la planche montre
 * saisie. La page en cours d'écriture porte donc le bord vert, et aucune couleur
 * n'est inventée. ⚠ La ROTATION que la planche met sur cette ligne (`rotate(-1deg)
 * translateX(8px)`) N'EST PAS reprise : c'est un retour de GLISSEMENT, pas une
 * marque de sélection.
 */
const A05_PAGES_DONNEES = {
  noeud: CARTE_PAGES_A05,
  devient:
    CARTE_PARCOURS +
    TITRE_CARTE_A05 +
    '{{ editeur.pagesTitre }}</div>' +
    '<sc-for list="{{ editeur.pages }}" as="p">' +
    LIGNE_ETAPE_CONTENEUR.replace('border:1px solid #E6EBE9;', 'border:{{ p.bord }};') +
    LIGNE_ETAPE_LIBELLE.replace('>Étape 8 · Assurance habitation<', '>{{ p.titre }}<') +
    LIGNE_ETAPE_CORBEILLE +
    '</div>' +
    '</sc-for>' +
    LIEN_AJOUTER_ETAPE.replace(
      '>Ajouter une étape personnelle<',
      '>{{ editeur.ajouterLibelle }}<',
    ) +
    '</div>',
  motifs: MOTIFS_CARTE_PAGES_A05,
  fois: 1,
  frames: ['Desktop', 'Mobile'],
  why: 'La carte des pages de l’éditeur — empruntée au « MODE MODIFIER LES ÉTAPES » du parcours : une ligne par page, son titre modifiable, sa corbeille, et le lien d’ajout. La page en cours porte le bord vert que la même carte dessine.',
};

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

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ CET ONGLET EST PROMU PAR `markLinks` ET RÉÉCRIT PAR `donnees` : LE `noeud` ║
 * ║ EST DONC LA FORME DÉJÀ PROMUE, ET IL FAUT DIRE POURQUOI                    ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * La barre d'onglets du cadre MOBILE de A08 est le seul endroit du module où les
 * deux mécanismes se croisent, et l'ordre de la génération tranche :
 *
 *   `markLinks` → `applyData`, et l'en-tête de `generate-screens.mjs` le motive :
 *   les discriminants de `liens` sont des TEXTES DE LA MAQUETTE, donc ils doivent
 *   passer avant que la liaison ne les change en `{{ … }}`.
 *
 * Or cette barre est écrite EN CLAIR dans la maquette, et c'est `donnees` qui en
 * fait une boucle sur `netTabs`. Donc :
 *
 *   · `markLinks` voit cinq `<span>` littéraux et les promeut en cinq `<a>`, un
 *     par onglet, avec leur destination déclarée (`liens` de A08, cadre Mobile) ;
 *   · `applyData` passe ENSUITE et doit retrouver son littéral. Celui-ci n'est
 *     donc plus le `<span>` de la maquette mais le `<a>` promu — d'où la forme
 *     ci-dessous, qui recopie EXACTEMENT ce que `markLinks` écrit, neutralisation
 *     du soulignement comprise et dans le même ordre.
 *
 * CE QUE ÇA COÛTE, et c'est la raison de ce pavé : ce `noeud` est désormais couplé
 * au format de sortie de `markLinks`. Si ce format change, la génération S'ARRÊTE
 * en nommant le fragment introuvable — bruyamment, jamais en silence — et c'est ce
 * qui rend le couplage tenable. Essayer l'inverse a été mesuré : poser le lien dans
 * `devient` est REFUSÉ par le troisième contrôle d'`applyData` (« la donnée ajoute
 * du dessin que la maquette n'écrit pas là — <a href=" »), et c'est juste : une
 * donnée n'a pas à inventer du balisage.
 *
 * @param vers la destination : littérale pour `noeud` (ce que `markLinks` a posé),
 *             en dialecte pour `devient` (`{{ t.href }}`, une par onglet au rendu).
 */
const ONGLET_RESEAU_MOBILE = (graisse, couleur, bord, label, vers) =>
  `<a href="${vers}" style="color:inherit;text-decoration:none;cursor:pointer;` +
  'height:44px;display:flex;align-items:center;padding:0 10px;font-size:13px;font-weight:' +
  graisse +
  ';color:' +
  couleur +
  ';border-bottom:2.5px solid ' +
  bord +
  ';white-space:nowrap">' +
  label +
  '</a>';

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
      ONGLET_RESEAU_MOBILE('500', '#5D6B66', 'transparent', 'Fil', '?onglet=fil') +
      ONGLET_RESEAU_MOBILE('700', '#0F5C48', '#16785E', 'Sujets', '?onglet=sujets') +
      ONGLET_RESEAU_MOBILE('500', '#5D6B66', 'transparent', 'Événements', '?onglet=evenements') +
      ONGLET_RESEAU_MOBILE('500', '#5D6B66', 'transparent', 'Membres', '?onglet=membres') +
      ONGLET_RESEAU_MOBILE('500', '#5D6B66', 'transparent', 'Album', '?onglet=album'),
    devient:
      '<sc-for list="{{ netTabs }}" as="t">' +
      ONGLET_RESEAU_MOBILE('{{ t.w }}', '{{ t.fg }}', '{{ t.bd }}', '{{ t.label }}', '{{ t.href }}') +
      '</sc-for>',
    frames: ['Mobile'],
    why: 'Les onglets du réseau, mêmes prises que la planche d’ordinateur, ET LEUR DESTINATION (`t.href` = `?onglet=…`, posée par `netTabsFor`) : la maquette les dessine en <span> sur ce cadre, ce n’étaient pas des liens. ÉCART DE MAQUETTE remonté : la planche mobile n’en dessine que CINQ et oublie « À propos », que la planche d’ordinateur dessine — la liste liée en rend donc six, ce qui est l’onglet réel et non un onglet inventé.',
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

/** Le chevron du fil d'Ariane de A09, recopié de la maquette au caractère près. */
const CHEVRON_FIL_A09 =
  '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m15 18-6-6 6-6"/></svg>';

/** La pastille « Épinglé » d'ordinateur : elle porte son icône, celle de mobile non. */
const PASTILLE_EPINGLE_A09 =
  '<span style="display:flex;align-items:center;gap:5px;background:#F2F5F4;color:#5D6B66;font-size:11.5px;font-weight:700;padding:5px 11px;border-radius:999px">' +
  '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 17v5M9 3h6l-1 6 4 4H6l4-4z"/></svg>Épinglé</span>';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ A09 · LA TÊTE DU SUJET ÉTAIT PEINTE EN DUR, SUR LES DEUX PLANCHES         ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * MESURÉ avant ce lot : `A09Data` ne portait QUE `comments`. Le titre, le corps,
 * l'auteur, la pastille d'état, celle d'épinglage et le fil d'Ariane étaient des
 * littéraux — donc n'importe quel sujet de n'importe quel réseau s'ouvrait sur
 * « Renouveler son passeport béninois depuis la France », de « Marc Koudou »,
 * dans « Béninois en France », AVEC LES VRAIES RÉPONSES EN DESSOUS. Le bas de la
 * page disait la vérité et le haut non, ce qui est pire que les deux faux.
 *
 * ── POURQUOI CES LIAISONS SONT DANS LE LOT DES GESTES ──────────────────────
 *
 * « Marquer résolu » n'est VISIBLE que par elles : le geste réussit, le serveur
 * renvoie `status: 'RESOLVED'`, et une pastille dessinée continue d'afficher
 * « Ouvert ». Du point de vue de qui s'en sert, le bouton ne ferait rien — c'est
 * exactement la forme de défaut que le porteur a rapportée ailleurs.
 *
 * ── CE QUE LA MAQUETTE DESSINE ET QUE L'API NE PORTE PAS ───────────────────
 *
 * Sous le nom de l'auteur, les deux planches écrivent « Installé · Paris · il y
 * a 3 j » (1 440 px) et « Paris · 3 j » (390 px). `communityAuthorSchema` n'a que
 * `id`, `handle` et `displayName` : NI phase, NI ville, NI avatar. La ligne est
 * donc liée à la seule chose connue — la durée écoulée — et les deux autres
 * morceaux sont REMONTÉS plutôt qu'inventés. C'est le même écart que
 * `from-api.ts` note déjà pour l'avatar d'un auteur de sujet.
 *
 * Les apostrophes du corps du sujet sont DROITES dans cette maquette, pas
 * typographiques (piège 10 du mémo) : les deux littéraux concernés sont donc en
 * guillemets doubles, et le premier contrôle d'`applyData` attraperait une copie
 * fautive en nommant le fragment.
 */
const A09_TETE = [
  {
    noeud:
      '<a href="#" style="display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:700">' +
      CHEVRON_FIL_A09 +
      'Béninois en France · Sujets</a>',
    devient:
      '<a href="{{ sujet.reseauHref }}" style="display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:700">' +
      CHEVRON_FIL_A09 +
      '{{ sujet.reseauNom }} · Sujets</a>',
    fois: 1,
    frames: ['Desktop'],
    why: 'Le fil d’Ariane nomme le réseau du sujet ET y mène : la maquette l’écrit « Béninois en France · Sujets » dans un `href="#"`, donc il nommait un AUTRE réseau que celui du sujet ouvert et n’allait nulle part. Le slug est celui que `GET /topics/:id` renvoie dans `community`, et non celui de l’URL — la route accepte aussi un identifiant, et le fil d’Ariane doit mener à l’adresse canonique.',
  },
  {
    noeud:
      '<span style="font-size:15.5px;font-weight:700;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Béninois en France</span>',
    devient:
      '<span style="font-size:15.5px;font-weight:700;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{{ sujet.reseauNom }}</span>',
    fois: 1,
    frames: ['Mobile'],
    why: 'L’en-tête du téléphone nomme le réseau du sujet. MÊME DONNÉE que le fil d’Ariane d’ordinateur, deux dessins : la correction prend sur les deux planches.',
  },
  {
    noeud:
      '<span style="background:#E3F0EB;color:#0F5C48;font-size:11.5px;font-weight:700;padding:5px 11px;border-radius:999px">Ouvert</span>',
    devient:
      '<span style="background:{{ sujet.etatBg }};color:{{ sujet.etatFg }};font-size:11.5px;font-weight:700;padding:5px 11px;border-radius:999px">{{ sujet.etat }}</span>',
    fois: 1,
    frames: ['Desktop'],
    why: 'L’état du sujet — `status`, par la table `TOPIC_STATE` (« Ouvert » · « Résolu » · « Archivé », et PAS de « clos » : l’enum n’en a pas). Les deux couleurs sont `stBg`/`stFg` de `topicRowTint`, celles que les lignes de A08 emploient déjà pour le même `status` : une seule table de couleurs pour une seule donnée, et aucune n’est assombrie. SANS cette liaison, « Marquer résolu » réussit et la pastille continue d’afficher « Ouvert ».',
  },
  {
    noeud:
      '<span style="background:#E3F0EB;color:#0F5C48;font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px;white-space:nowrap">Ouvert</span>',
    devient:
      '<span style="background:{{ sujet.etatBg }};color:{{ sujet.etatFg }};font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px;white-space:nowrap">{{ sujet.etat }}</span>',
    fois: 1,
    frames: ['Mobile'],
    why: 'Le même état à 390 px. La planche mobile ne dessine PAS les mêmes mesures que celle de 1 440 px — 11 px contre 11,5, `padding: 4px 10px` contre `5px 11px`, un `white-space` de plus — donc deux déclarations, et non un motif commun qui ne décrirait qu’un seul cadre (piège 1 du mémo).',
  },
  {
    noeud: PASTILLE_EPINGLE_A09,
    devient: '<sc-if value="{{ sujet.epingle }}">' + PASTILLE_EPINGLE_A09 + '</sc-if>',
    fois: 1,
    frames: ['Desktop'],
    why: 'La pastille « Épinglé » n’apparaît que si le sujet l’est — `pinKind !== NONE`. La maquette la dessine toujours : tout sujet se disait donc épinglé, y compris celui qu’un modérateur venait de désépingler.',
  },
  {
    noeud:
      '<span style="background:#F2F5F4;color:#5D6B66;font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px;white-space:nowrap">Épinglé</span>',
    devient:
      '<sc-if value="{{ sujet.epingle }}"><span style="background:#F2F5F4;color:#5D6B66;font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px;white-space:nowrap">Épinglé</span></sc-if>',
    fois: 1,
    frames: ['Mobile'],
    why: 'La même pastille à 390 px — sans l’icône que la planche d’ordinateur met devant le mot, et c’est la maquette qui en décide.',
  },
  {
    noeud: '>Renouveler son passeport béninois depuis la France</h2>',
    devient: '>{{ sujet.titre }}</h2>',
    fois: 1,
    frames: ['Desktop'],
    why: 'Le titre du sujet — `title`. C’est le `<h2>` que `promoteFirstHeading` promeut en `<h1>` : la page annonçait donc le titre d’un AUTRE sujet, y compris à un lecteur d’écran.',
  },
  {
    /**
     * LES DÉLIMITEURS NUS, ET C'EST OBLIGATOIRE ICI — pas un raccourci.
     *
     * Ce titre est le `heading` DÉCLARÉ du cadre mobile (`fromMob(…, '…depuis la
     * France')`), parce que la maquette l'écrit en `<div>` et qu'une page a besoin
     * de son `<h1>`. `retitrerSurDonnees` sait suivre un titre devenu donnée —
     * c'est ce qui sauve K02, qui titre avec le nom d'un membre — mais il compare
     * le `noeud` DÉPOUILLÉ de ses deux délimiteurs au texte déclaré. Un `noeud`
     * qui porte la balise entière ne correspond donc à rien, la reprise ne
     * déclenche pas, et la page perd son `<h1>` avec pour seul indice un
     * « titre déclaré introuvable » à l'autre bout du journal. Mesuré : c'est
     * exactement ce qui est arrivé au premier essai.
     */
    noeud: '>Renouveler son passeport béninois depuis la France<',
    devient: '>{{ sujet.titre }}<',
    fois: 1,
    frames: ['Mobile'],
    why: 'Le même titre à 390 px. La maquette l’écrit en `<div>` ici et en `<h2>` sur l’ordinateur : sur mobile c’est le `heading` déclaré qui le promeut en `<h1>`, et `retitrerSurDonnees` suit la liaison.',
  },
  {
    noeud:
      '<span style="width:32px;height:32px;border-radius:999px;background:#0F5C48;color:#fff;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center">MK</span><span style="font-size:13px;font-weight:700">Marc Koudou</span>',
    devient:
      '<span style="width:32px;height:32px;border-radius:999px;background:{{ sujet.auteurBg }};color:#fff;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center">{{ sujet.auteurI }}</span><span style="font-size:13px;font-weight:700">{{ sujet.auteurNom }}</span>',
    fois: 1,
    frames: ['Desktop'],
    why: 'L’auteur du sujet. La couleur du rond est DÉRIVÉE du `handle` — stable, donc le même membre garde sa couleur d’un écran à l’autre — et jamais tirée au hasard.',
  },
  {
    noeud:
      '<span style="width:28px;height:28px;border-radius:999px;background:#0F5C48;color:#fff;font-size:9px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0">MK</span><span style="font-size:12.5px;font-weight:700">Marc Koudou</span>',
    devient:
      '<span style="width:28px;height:28px;border-radius:999px;background:{{ sujet.auteurBg }};color:#fff;font-size:9px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0">{{ sujet.auteurI }}</span><span style="font-size:12.5px;font-weight:700">{{ sujet.auteurNom }}</span>',
    fois: 1,
    frames: ['Mobile'],
    why: 'Le même auteur à 390 px — rond de 28 px et non 32, initiales en 9 px et non 10, et un `flex-shrink` que l’ordinateur n’a pas.',
  },
  {
    noeud: '<span style="font-size:12px;color:#8A958F">Installé · Paris · il y a 3 j</span>',
    devient: '<span style="font-size:12px;color:#8A958F">{{ sujet.auteurQuand }}</span>',
    fois: 1,
    frames: ['Desktop'],
    why: 'ÉCART ASSUMÉ ET REMONTÉ : la maquette écrit « Installé · Paris · il y a 3 j », et `communityAuthorSchema` ne porte NI la phase NI la ville de l’auteur d’un sujet — seulement `id`, `handle`, `displayName`. On n’écrit donc que la durée écoulée, de `createdAt`. Les deux morceaux manquants demanderaient d’élargir la réponse du serveur ; les fabriquer mettrait à l’écran une ville inventée.',
  },
  {
    noeud: '<span style="font-size:11.5px;color:#8A958F">Paris · 3 j</span>',
    devient: '<span style="font-size:11.5px;color:#8A958F">{{ sujet.auteurQuand }}</span>',
    fois: 1,
    frames: ['Mobile'],
    why: 'La même ligne à 390 px, où la maquette abrège en « Paris · 3 j ». Même écart, même source : seule la durée est connue.',
  },
  {
    noeud:
      "<p style=\"margin:14px 0 0;font-size:15px;line-height:1.62\">Quelqu'un a déjà fait la démarche à l'ambassade de Paris cette année ? Délais, pièces demandées, rendez-vous en ligne ou non ?</p>",
    devient: '<p style="margin:14px 0 0;font-size:15px;line-height:1.62">{{ sujet.corps }}</p>',
    fois: 1,
    frames: ['Desktop'],
    why: 'Le corps du sujet — `body`.',
  },
  {
    noeud:
      "<p style=\"margin:10px 0 0;font-size:14px;line-height:1.58\">Quelqu'un a fait la démarche à l'ambassade cette année ? Délais, pièces, rendez-vous ?</p>",
    devient: '<p style="margin:10px 0 0;font-size:14px;line-height:1.58">{{ sujet.corps }}</p>',
    fois: 1,
    frames: ['Mobile'],
    why: 'Le même corps à 390 px, où la maquette l’abrège dans son dessin — raison de plus pour le lier : les deux planches montraient deux textes DIFFÉRENTS pour un seul et même sujet.',
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
const PASTILLE_VILLE_MOBILE = (fond, texte, bord, label, vers) =>
  `<a href="${vers}" style="color:inherit;text-decoration:none;cursor:pointer;` +
  'padding:8px 12px;border-radius:999px;font-size:12px;font-weight:700;white-space:nowrap;background:' +
  fond +
  ';color:' +
  texte +
  ';border:1px solid ' +
  bord +
  '">' +
  label +
  '</a>';

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
      PASTILLE_VILLE_MOBILE('#fff', '#16211D', '#E6EBE9', 'Bons plans', '?onglet=bons-plans') +
      PASTILLE_VILLE_MOBILE('#fff', '#16211D', '#E6EBE9', 'Produits du pays', '?onglet=produits') +
      PASTILLE_VILLE_MOBILE('#16785E', '#fff', '#16785E', 'Budgets réels', '?onglet=budgets') +
      PASTILLE_VILLE_MOBILE('#fff', '#16211D', '#E6EBE9', 'Témoignages', '?onglet=temoignages'),
    devient:
      '<sc-for list="{{ cityPills }}" as="c">' +
      PASTILLE_VILLE_MOBILE('{{ c.bg }}', '{{ c.fg }}', '{{ c.bd }}', '{{ c.label }}', '{{ c.href }}') +
      '</sc-for>',
    frames: ['Mobile'],
    why: 'Les quatre onglets de la fiche ville, AVEC leur destination (`c.href` = `?onglet=…`). La planche mobile les dessine en PASTILLES — fond, couleur et bordure, comme `chip()` — et non en onglets soulignés comme la planche d’ordinateur : d’où `cityPills` à côté de `cityTabs`, et non un onglet recoloré à la main. Le `noeud` est la forme DÉJÀ PROMUE par `markLinks` : voir l’en-tête de `ONGLET_RESEAU_MOBILE`, qui dit pourquoi les deux mécanismes se croisent ici.',
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

/**
 * Un onglet de la fiche ville sur ordinateur : souligné, trois valeurs, et sa
 * DESTINATION. Comme `ONGLET_RESEAU_MOBILE`, le `noeud` est la forme déjà promue
 * par `markLinks` — les deux mécanismes se croisent sur ces barres, et c'est
 * l'ordre de la génération qui l'impose.
 */
const ONGLET_VILLE_WEB = (graisse, couleur, bord, label, vers) =>
  `<a href="${vers}" style="color:inherit;text-decoration:none;cursor:pointer;` +
  'height:52px;display:flex;align-items:center;padding:0 12px;font-size:13.5px;font-weight:' +
  graisse +
  ';color:' +
  couleur +
  ';border-bottom:2.5px solid ' +
  bord +
  '">' +
  label +
  '</a>';

/** Un onglet de la fiche ville sur mobile : une pastille, trois valeurs, sa destination. */
const ONGLET_VILLE_MOBILE = (fond, texte, bord, label, vers) =>
  `<a href="${vers}" style="color:inherit;text-decoration:none;cursor:pointer;` +
  'height:36px;padding:0 13px;border-radius:999px;display:flex;align-items:center;font-size:12.5px;font-weight:700;white-space:nowrap;background:' +
  fond +
  ';color:' +
  texte +
  ';border:1px solid ' +
  bord +
  '">' +
  label +
  '</a>';

/**
 * Les quatre onglets de la fiche ville et leur nom dans l'URL, dans l'ordre que
 * la planche dessine. Recopiés de `SLUGS` dans
 * `app/(app)/villes/[slug]/ville-screen.tsx`, qui est ce que la page lit.
 */
const ONGLETS_VILLE = [
  ['Bons plans', 'bons-plans'],
  ['Produits du pays', 'produits'],
  ['Budgets réels', 'budgets'],
  ['Témoignages', 'temoignages'],
];

const ongletsVilleWeb = (actif) => ({
  noeud: ONGLETS_VILLE.map(([l, onglet], i) =>
    i === actif
      ? ONGLET_VILLE_WEB('700', '#0F5C48', '#16785E', l, `?onglet=${onglet}`)
      : ONGLET_VILLE_WEB('500', '#5D6B66', 'transparent', l, `?onglet=${onglet}`),
  ).join(''),
  devient:
    '<sc-for list="{{ cityTabs }}" as="t">' +
    ONGLET_VILLE_WEB('{{ t.w }}', '{{ t.fg }}', '{{ t.bd }}', '{{ t.label }}', '{{ t.href }}') +
    '</sc-for>',
  fois: 1,
  why: 'Les quatre onglets de la fiche ville, AVEC leur destination (`t.href` = `?onglet=…`). Les deux apparences écrivent LES TROIS mêmes déclarations — graisse, couleur, trait — donc trois valeurs suffisent, et l’onglet allumé vient du rang que la page tient de `?onglet=`.',
});

const ongletsVilleMobile = (actif) => ({
  noeud: ONGLETS_VILLE.map(([l, onglet], i) =>
    i === actif
      ? ONGLET_VILLE_MOBILE('#16785E', '#fff', '#16785E', l, `?onglet=${onglet}`)
      : ONGLET_VILLE_MOBILE('#fff', '#16211D', '#E6EBE9', l, `?onglet=${onglet}`),
  ).join(''),
  devient:
    '<sc-for list="{{ cityPills }}" as="c">' +
    ONGLET_VILLE_MOBILE('{{ c.bg }}', '{{ c.fg }}', '{{ c.bd }}', '{{ c.label }}', '{{ c.href }}') +
    '</sc-for>',
  fois: 1,
  why: 'Les mêmes quatre onglets, en PASTILLES et AVEC leur destination (`c.href`) : la planche mobile les dessine avec un fond et une bordure, pas un soulignement — d’où `cityPills`, calculé du même rang que `cityTabs`.',
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

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LE BANDEAU D'AVERTISSEMENT D'UN GUIDE, VERBATIM — ET SA SEULE OCCURRENCE   ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « Lier le bandeau du guide aux banners du serveur. »
 *
 * CE QUE LE SERVEUR CALCULE (`guides.service.ts`, `bannersFor()`) : trois
 * bandeaux, dans CET ordre — `TO_VERIFY` (contenu immobile depuis plus de
 * `GUIDE_STALE_MONTHS`, et le seul à porter `months`), `OUTDATED_REPORTED`
 * (`status === 'FLAGGED'`), `COMMUNITY_MAINTAINED` (`maintainedByCommunity`).
 *
 * CE QUE LA MAQUETTE DESSINE, et c'est là que le compte tombe juste :
 *
 *   · le bandeau VERT « Maintenu par la communauté » est dessiné DANS les cadres
 *     de A04 (ligne 667 pour l'ordinateur, et une variante propre au mobile) —
 *     c'est `BANDEAU_COMMUNAUTE_WEB` / `BANDEAU_COMMUNAUTE_MOBILE` ci-dessous ;
 *   · le bandeau AMBRE d'avertissement n'est dessiné dans AUCUN cadre de A04. Il
 *     l'est UNE SEULE FOIS dans tout le fichier (compté : une occurrence), à la
 *     ligne 611 — sur la CARTE DE LISTE de A03, sous `<sc-if value="{{ g.verify }}">`.
 *     C'est ce nœud-ci, et c'est lui qu'on emprunte ;
 *   · la rangée de spécification des lignes 740-742 dessine les trois en PASTILLES
 *     DE LÉGENDE (rayon 16, retrait 12px 18px, 13px). On y prend les TEXTES et les
 *     paires de couleurs, jamais la géométrie — c'est écrit dans la déclaration qui
 *     les emploie.
 *
 * ⚠ CE QUE L'EMPRUNT COÛTE : la géométrie de ce nœud est celle de la CARTE DE A03
 * — `padding:9px 20px`, `font-size:12.5px`. Elle n'est donc pas exactement celle
 * du bandeau vert de A04, que les trois cadres n'écrivent d'ailleurs pas pareil :
 * `padding:10px 28px` / `12.5px` sur les deux planches d'ordinateur, `padding:9px
 * 16px` / `12px` et SANS icône sur celle de 390 px. Relevé sur les octets, cadre
 * par cadre — c'est précisément le piège que ce dépôt a payé quatre fois, et la
 * raison pour laquelle ce fichier ne fige aucune de ces valeurs. L'avertissement
 * garde donc la sienne : un bandeau emprunté se reconnaît, et c'est préférable à
 * une géométrie choisie par un agent. REMONTÉ au porteur.
 */
const BANDEAU_AVERTISSEMENT =
  '<div style="background:#FDF1D8;color:#8A5A0B;font-size:12.5px;font-weight:700;' +
  'padding:9px 20px;display:flex;align-items:center;gap:8px">' +
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
  'stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/>' +
  '<path d="M12 8v5M12 16h.01"/></svg>' +
  "À vérifier — des membres signalent que l'information a changé</div>";

/**
 * Le conteneur de contenu de la planche MOBILE DE LA VUE AUTEUR — l'ancre de son
 * emprunt, et la seule disponible.
 *
 * POURQUOI CE CADRE A BESOIN D'UNE ANCRE À PART : les trois autres cadres de A04
 * dessinent le bandeau vert, donc l'avertissement se pose juste au-dessus de lui.
 * CELUI-CI N'EN DESSINE AUCUN — sa barre haute écrit « Votre guide » là où la
 * planche d'ordinateur de la même vue garde « Maintenu par la communauté ». C'est
 * un ÉCART DE MAQUETTE déjà remonté par la déclaration du bandeau vert, quelques
 * lignes plus bas.
 *
 * L'avertissement s'ancre donc sur le conteneur qui suit la barre haute, c'est-à-dire
 * exactement là où les autres cadres mettent leur bande : sous la barre, au-dessus
 * du titre. Figure une fois dans ce cadre, compté.
 */
const CORPS_AUTEUR_MOBILE =
  '<div style="flex:1;min-height:0;overflow:hidden;padding:16px 18px;' +
  'display:flex;flex-direction:column;gap:12px">';

/**
 * L'EN-TÊTE « 14 COMMENTAIRES », VERBATIM, tel que les DEUX planches
 * d'ordinateur de A04 l'écrivent (lignes 678 et 728 de la maquette).
 *
 * C'est le seul nœud de commentaires que la maquette dessine sur un guide : il
 * n'y a RIEN après lui, l'article se referme. Il sert ici à deux choses, et les
 * deux sont déclarées à côté : la liaison du compte (`A04_DONNEES`) et l'emprunt
 * vers les deux planches mobiles (`borrows` de A04).
 */
const EN_TETE_COMMENTAIRES =
  '<div style="margin-top:28px;padding-top:18px;border-top:1px solid #EAEEEC;' +
  'font-size:11px;font-weight:700;letter-spacing:1px;color:#8A958F">14 COMMENTAIRES</div>';

/**
 * Les deux barres basses des planches MOBILES de A04, précédées du `</div>` qui
 * ferme la zone défilante — ce sont les ancres de l'emprunt ci-dessus.
 *
 * Le `</div>` fait PARTIE de l'ancre, et c'est lui qui place l'emprunt : sans
 * lui, l'en-tête deviendrait un frère de la barre basse (donc toujours visible,
 * collé au-dessus d'elle) au lieu d'être le dernier enfant de l'article qui
 * défile. Chacune figure EXACTEMENT UNE FOIS dans son cadre, et zéro fois dans
 * l'autre — compté sur les octets de la section `MOB`.
 */
const BARRE_BASSE_LECTURE_MOBILE =
  '</div><div style="flex-shrink:0;background:#fff;border-top:1px solid #E6EBE9;' +
  'padding:12px 16px 28px;display:flex;gap:8px;align-items:center">';

const BARRE_BASSE_AUTEUR_MOBILE =
  '</div><div style="flex-shrink:0;background:#fff;border-top:1px solid #E6EBE9;' +
  'padding:12px 16px 28px;display:flex;flex-direction:column;gap:8px">';

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

/**
 * LA RANGÉE « Signalements “a changé” » DE LA CARTE D'AUTEUR, à 1 440 px.
 *
 * Le libellé ET sa valeur, parce que c'est le libellé qui identifie la rangée :
 * la carte en dessine trois de style identique (« Propositions reçues »,
 * celle-ci, « Ouvrir à la communauté »), et un motif indexé sur le seul nombre
 * aurait été un motif qui ne dit pas de quoi il parle.
 *
 * ⚠ LE `<a href="#">` QUI L'ENVELOPPE N'EST PAS DANS CE MOTIF, et c'est le bon
 * partage : la donnée pose le NOMBRE, et `A04_SIGNALEMENTS` retire le lien mort.
 * Une donnée qui changerait la balise ajouterait du dessin que la maquette n'écrit
 * pas là, ce que le troisième contrôle d'`applyData` refuse.
 */
const RANGEE_SIGNALEMENTS_WEB = (n) =>
  '<span style="flex:1">Signalements « a changé »</span>' +
  '<span style="font-size:12px;color:#8A958F;font-weight:700">' +
  n +
  '</span>';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ « LE BOUTON BACK SUR MOBILE ET LES ICON DU HEADER NE MARCHENT PAS »        ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur, capture à l'appui. MESURÉ dans les deux cadres produits de 390 px,
 * avant ce lot : la barre haute est une rangée de `<span>` inertes — aucun
 * `onClick`, aucun `href`, aucun rôle. Quatre ronds de 40 px sur le cadre du
 * LECTEUR (chevron, signet, partage, « … »), TROIS sur celui de l'AUTEUR, qui
 * écrit « Votre guide » et NE DESSINE PAS LE SIGNET. Compté sur les octets de la
 * maquette (lignes 1370 et 1371), pas supposé symétrique : une transformation
 * écrite pour quatre ronds aurait échoué en silence sur le cadre d'auteur.
 *
 * ── LE PARTAGE DES RÔLES, ET POURQUOI IL EST COUPÉ EN DEUX ─────────────────
 *
 * Deux des quatre gestes OUVRENT une surface, et `markTriggers` sait déjà faire
 * cela : il promeut le `<span>` en `<button>` et lui pose `data-modal-open`, que
 * la page écoute par délégation — le même chemin que « Commenter » sur le fil.
 * Ce sont le PARTAGE (feuille A01P) et le « … » (la feuille d'actions ci-dessous).
 *
 * Les deux autres appellent une fonction : le RETOUR (`router.back()`) et le
 * SIGNET (`PUT`/`DELETE /me/bookmarks`). Ils passent donc par une adaptation
 * JSX, `A04_ENTETE_MOBILE` dans `generate-screens.mjs`, parce qu'un `onClick` ne
 * s'écrit pas dans le dialecte de la maquette.
 */

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LA FEUILLE D'ACTIONS DU « … » — EMPRUNTÉE, PAS DESSINÉE                    ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * CE QUI MANQUE : la colonne d'ordinateur de A04 porte DÉJÀ les trois actions du
 * guide — « Proposer une correction », « L'information a changé », « Signaler » —
 * et `A04_ACTIONS` les rend vivantes depuis un lot précédent. Sur les deux cadres
 * de 390 px, elles n'ont AUCUN accès : la barre basse de lecture porte « Ce guide
 * vous a aidé ? », Oui, Non et le crayon ; celle d'auteur porte « Modifier » et
 * « Propositions ». Le « … » de la barre haute est leur seule porte, et il était
 * inerte.
 *
 * CE QUE LA MAQUETTE DESSINE, et c'est elle qu'on emprunte : la même maquette
 * `03 Accueil v2` dessine une FEUILLE DU BAS AVEC UNE LISTE D'ACTIONS, à la
 * planche « ADMIN · MEMBRES — menu de rôle » (ligne 1400) : un voile
 * `rgba(22,33,29,.5)`, une feuille `28px 28px 0 0` au retrait `10px 16px 30px` et
 * à l'écart de 4 px, sa poignée de 40 × 5, puis des rangées de 50 px — icône de
 * 17 px, écart de 12, retrait `0 6px`, 14 px / 600. Les quatre morceaux sont
 * repris VERBATIM, et le garde-fou d'`applyBorrows` refuse de produire le jour où
 * le designer les retire.
 *
 * ── CE QUI N'EST PAS EMPRUNTÉ, ET POURQUOI ────────────────────────────────
 *
 * La planche du menu de rôle porte, sous sa poignée, une RANGÉE D'EN-TÊTE —
 * rond d'avatar et nom du membre, séparée par un filet. Elle n'est PAS reprise :
 * elle nomme une PERSONNE, et le sujet de cette feuille-ci est un DOCUMENT. Y
 * mettre le titre du guide demanderait de redessiner la rangée (un titre n'a pas
 * de rond d'avatar), donc d'inventer. ⚠ CONSÉQUENCE REMONTÉE : la feuille n'a
 * pas de titre, donc pas de nom accessible de boîte de dialogue. Chaque rangée
 * est un `<button>` nommé et le voile est un `<button>` « Fermer », ce qui la
 * rend utilisable au clavier et au lecteur d'écran — mais un lecteur n'entendra
 * pas « Actions du guide » en entrant. C'est au designer de trancher la forme de
 * cet en-tête.
 *
 * ⚠ UNE SEULE RANGÉE EST EMPRUNTÉE, et c'est voulu : la maquette en dessine
 * quatre, toutes identiques au libellé et au tracé près. `A04_FEUILLE_ACTIONS`
 * en fait une boucle sur `menu.actions`, donc la feuille rend EXACTEMENT les
 * actions que la page lui donne — trois aujourd'hui, et ni plus ni moins.
 * Emprunter les quatre aurait figé un compte que l'écran ne tient pas.
 */
const VOILE_FEUILLE_ACTIONS =
  '<div style="position:absolute;inset:0;background:rgba(22,33,29,.5)"></div>';

const OUVERTURE_FEUILLE_ACTIONS =
  '<div style="position:absolute;left:0;right:0;bottom:0;background:#fff;' +
  'border-radius:28px 28px 0 0;padding:10px 16px 30px;display:flex;' +
  'flex-direction:column;gap:4px">';

const POIGNEE_FEUILLE_ACTIONS =
  '<span style="align-self:center;width:40px;height:5px;border-radius:999px;' +
  'background:#DDE3E0;margin-bottom:8px"></span>';

/**
 * UNE RANGÉE D'ACTION, VERBATIM — libellé et tracé compris.
 *
 * Le tracé emprunté est celui de « Nommer modératrice ». Il ne reste pas : la
 * liaison juste dessous le remplace par `{{ a.icon }}`, c'est-à-dire par le MÊME
 * tracé que la colonne d'ordinateur emploie pour la même action (`guideActions`
 * les porte). Un emprunt pose du DESSIN ; la donnée pose le reste.
 */
const RANGEE_FEUILLE_ACTIONS =
  '<span style="height:50px;display:flex;align-items:center;gap:12px;padding:0 6px;' +
  'font-size:14px;font-weight:600;color:#16211D">' +
  '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#16211D" ' +
  'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM5 21a7 7 0 0 1 14 0"/></svg>' +
  'Nommer modératrice</span>';

const FEUILLE_ACTIONS =
  VOILE_FEUILLE_ACTIONS +
  OUVERTURE_FEUILLE_ACTIONS +
  POIGNEE_FEUILLE_ACTIONS +
  RANGEE_FEUILLE_ACTIONS +
  '</div>';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LA FEUILLE DU « … » DE L'AUTEUR NE PORTE PLUS LES ACTIONS DU LECTEUR       ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * ── LE DÉFAUT, MESURÉ SUR LE CADRE PRODUIT ─────────────────────────────────
 *
 * `auteurmobile.generated.tsx` montait la MÊME feuille que le cadre du lecteur,
 * donc les TROIS actions du lecteur, et les trois sont fausses sur son propre
 * guide :
 *
 *   · « Proposer une correction » — l'API la REFUSE (`OWN_GUIDE`, §2.4) ;
 *   · « L'information a changé » — absurde : un auteur qui sait que l'info a
 *     changé corrige, il ne se signale pas à lui-même ;
 *   · « Signaler » — un recours contre AUTRUI.
 *
 * L'écart était déjà écrit, et avec sa demande de planche : « REMONTÉ : il manque
 * une planche “feuille d'actions, vue auteur” pour trancher ce que ce “…” doit
 * offrir » (`guide-screen.tsx`).
 *
 * ── CE QUE LA MAQUETTE PRESCRIT, ET POURQUOI ON NE L'APPLIQUE PAS TEL QUEL ──
 *
 * Sous ses planches (ligne 689) : « VUE AUTEUR — “Proposer une correction” laisse
 * place à Modifier et aux propositions reçues ».
 *
 * MESURÉ : la barre basse de ce même cadre porte DÉJÀ « Modifier », et son voisin
 * porte « Propositions » avec sa pastille. Appliquer la consigne à la lettre
 * aurait donc fait une feuille qui RÉPÈTE les deux boutons situés à quelques
 * pixels au-dessus d'elle — c'est-à-dire un dessin que personne n'a dessiné, pour
 * obéir à une légende écrite pour la planche de 1 440 px, dont la colonne de
 * droite n'a pas de barre basse.
 *
 * ── CE QU'ELLE PORTE À LA PLACE, ET POURQUOI C'EST LE SEUL CHOIX HONNÊTE ────
 *
 * « HISTORIQUE DES VERSIONS », qui est ce que 390 px n'offre NULLE PART ailleurs.
 * Trois faits, tous comptés :
 *
 *   · LE LIBELLÉ EST DESSINÉ, deux fois, et aux deux endroits qui comptent : sur
 *     la planche `Desktop` (ligne 684) ET sur `AuteurDesktop` (ligne 734). Il
 *     n'est donc pas réservé au lecteur, et il n'est pas inventé ;
 *   · IL N'EST SUR AUCUN CADRE MOBILE : zéro occurrence de « HISTORIQUE » dans la
 *     section `MOB` de la maquette. Un auteur de téléphone ne pouvait pas voir
 *     l'historique de son propre guide ;
 *   · LA CARTE D'ORDINATEUR EST VIVANTE : `GET /guides/:slug/versions` la nourrit
 *     par `fetchVersions`, et `guide-screen.tsx` retombe sur le dessin de la
 *     maquette quand la liste est vide. Rien à brancher, donc : la prise
 *     `versions` existe déjà, et l'emprunt la rend lisible sur 390 px.
 *
 * ── LA FORME EST CELLE DE L'AUTRE FEUILLE, AU CARACTÈRE PRÈS ───────────────
 *
 * Le voile, l'ouverture et la poignée sont les TROIS MÊMES fragments que
 * `FEUILLE_ACTIONS` emprunte à la planche « ADMIN · MEMBRES — menu de rôle ».
 * Seule la RANGÉE change : au lieu d'une liste d'actions, le titre de section et
 * sa boucle de versions, pris tels quels à la colonne d'ordinateur de A04.
 *
 * ⚠ LA CARTE BLANCHE N'EST PAS EMPRUNTÉE, et c'est délibéré : le nœud
 * d'ordinateur est un `<div>` blanc à bordure et rayon 22, posé sur le gris
 * `#F6F8F7` de la colonne. Dans une feuille du bas — déjà blanche, déjà arrondie
 * à 28 — il aurait dessiné une carte blanche dans une carte blanche, avec une
 * bordure flottante au milieu. On emprunte donc son CONTENU (le titre de section
 * et la boucle), ce qui est exactement ce que la feuille d'actions fait déjà de la
 * planche du menu de rôle : la coquille vient de la feuille, le contenu de la
 * carte.
 *
 * ⚠ « DÉPUBLIER » N'EST PROPOSÉ NULLE PART, et c'est un relevé : le mot
 * n'apparaît dans AUCUNE maquette de `docs/template/`. Il n'a donc pas de dessin,
 * et une feuille d'auteur n'était pas l'endroit pour en inventer un.
 */
const TITRE_VERSIONS_WEB =
  '<div style="font-size:10.5px;font-weight:700;letter-spacing:1px;color:#8A958F">' +
  'HISTORIQUE DES VERSIONS</div>';

const BOUCLE_VERSIONS_WEB =
  '<sc-for list="{{ versions }}" as="v" hint-placeholder-count="3">' +
  '<div style="display:flex;gap:10px;margin-top:12px;align-items:flex-start">' +
  '<span style="width:8px;height:8px;border-radius:999px;background:{{ v.dot }};' +
  'margin-top:6px;flex-shrink:0"></span>' +
  '<span><span style="display:block;font-size:13px;font-weight:600">{{ v.t }}</span>' +
  '<span style="display:block;font-size:11.5px;color:#8A958F">{{ v.s }}</span></span>' +
  '</div></sc-for>';

const FEUILLE_VERSIONS =
  VOILE_FEUILLE_ACTIONS +
  OUVERTURE_FEUILLE_ACTIONS +
  POIGNEE_FEUILLE_ACTIONS +
  TITRE_VERSIONS_WEB +
  BOUCLE_VERSIONS_WEB +
  '</div>';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LA FEUILLE DE L'AUTEUR GAGNE SES DEUX GESTES — ET C'EST LE SEUL ENDROIT    ║
 * ║ OÙ 390 px PEUT LES PORTER                                                  ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Deux gestes de la carte d'auteur de 1 440 px n'existaient NULLE PART sur le
 * téléphone. Compté sur les octets de la maquette, section `MOB` :
 *
 *   · « Ouvrir à la communauté » — ZÉRO occurrence. Le porteur a signalé que le
 *     bouton ne marchait pas ; sur 390 px, il n'était même pas dessiné ;
 *   · « Signalements “a changé” » — le COMPTE vit dans la rangée de statistiques
 *     de la barre basse (`A04_SIGNALEMENTS`), mais il n'y a aucun chemin vers la
 *     LISTE que l'auteur doit maintenant voir.
 *
 * ── POURQUOI CETTE FEUILLE-LÀ, ET PAS UNE AUTRE SURFACE ───────────────────
 *
 * Le porteur, pour le second point : la feuille du « … » de l'auteur « existe
 * désormais et porte “Historique des versions” : c'est son foyer naturel ». Elle
 * est en effet la seule surface de 390 px qui porte déjà ce qui n'est pas dans la
 * barre basse — et sa barre basse est pleine (« Modifier » et « Propositions »).
 *
 * ── CE QUE L'EMPRUNT AJOUTE, ET CE QU'IL NE RÉÉCRIT PAS ───────────────────
 *
 * UNE SEULE RANGÉE de plus, celle de `FEUILLE_ACTIONS` — le tracé de « Nommer
 * modératrice » de la planche « ADMIN · MEMBRES — menu de rôle ». La liaison qui
 * suit en fait une BOUCLE sur `menu.actions`, donc la feuille rend exactement les
 * actions que la page lui donne : DEUX pour l'auteur, et ni plus ni moins.
 * Emprunter deux rangées aurait figé un compte que l'écran ne tient pas.
 *
 * ⚠ LES LIBELLÉS SONT EMPRUNTÉS À LA PLANCHE D'ORDINATEUR, pas inventés : les
 * deux sont dessinés sur `AuteurDesktop` (lignes 735 et 736 de la maquette), et la
 * page les passe tels quels. Le seul mot qui n'est dans aucune maquette est
 * « Reprendre la main », l'autre sens de la bascule — remonté là où il est écrit,
 * dans `guides/from-api.ts`.
 *
 * ⚠ `menu.actions` ÉTAIT PASSÉ À CE CADRE SANS ÊTRE LU depuis le lot qui a retiré
 * les trois actions du LECTEUR de cette feuille (elles étaient fausses sur son
 * propre guide : l'API refuse « Proposer une correction » en `OWN_GUIDE`). La
 * prise reprend donc son emploi, avec une AUTRE liste — celle de l'auteur. C'est
 * `guide-screen.tsx` qui choisit laquelle, puisque c'est lui qui sait s'il monte
 * la vue auteur ou celle du lecteur.
 *
 * L'ORDRE : les gestes D'ABORD, l'historique ensuite. Une feuille qu'on ouvre pour
 * agir met l'action sous le pouce ; la liste des versions est de la consultation,
 * et elle peut défiler.
 */
const FEUILLE_VERSIONS_AUTEUR =
  VOILE_FEUILLE_ACTIONS +
  OUVERTURE_FEUILLE_ACTIONS +
  POIGNEE_FEUILLE_ACTIONS +
  RANGEE_FEUILLE_ACTIONS +
  TITRE_VERSIONS_WEB +
  BOUCLE_VERSIONS_WEB +
  '</div>';

/**
 * L'ANCRE DE L'EMPRUNT : la barre haute des DEUX cadres mobiles de A04, que la
 * maquette écrit à l'identique sur le cadre du lecteur et sur celui de l'auteur
 * (compté : une fois dans chacun).
 *
 * LA FEUILLE EST POSÉE AVANT ELLE, donc en PREMIER ENFANT du cadre, et le choix
 * se justifie : une fois `position: fixed` (voir `A04_FEUILLE_ACTIONS`), la place
 * dans l'arbre ne décide plus du dessin — c'est le `zIndex` qui le fait — et
 * l'ancrer en tête évite de la glisser DANS la barre basse, ce que `into =
 * ancre + feuille` aurait fait d'une ancre posée en fin de cadre (l'ancre est une
 * balise OUVRANTE : tout ce qui la suit en devient l'enfant).
 */
const ENTETE_MOBILE_A04 =
  '<div style="padding:50px 12px 10px;display:flex;align-items:center;gap:8px;' +
  'background:#fff;border-bottom:1px solid #E6EBE9;flex-shrink:0">';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LA LIGNE DES CONTRIBUTEURS DISPARAÎT QUAND IL N'Y EN A AUCUN               ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur, capture à l'appui : sous le titre d'un guide fraîchement publié
 * s'affiche un tiret cadratin « — » seul, sans avatars.
 *
 * MESURÉ : c'est `phraseContributeurs(…, court = true)`, qui rend `'—'` sans
 * contributeur (`guides/from-api.ts`), et `'Aucun contributeur'` sur la planche
 * d'ordinateur. Les deux occupent la place d'une information qui n'existe pas :
 * un tiret seul se lit comme un défaut d'affichage, et « Aucun contributeur » dit
 * à l'auteur d'un guide tout neuf qu'il n'y est pour rien.
 *
 * LA LIGNE ENTIÈRE TOMBE, pas seulement sa phrase — la rangée de pastilles avec
 * elle. Vider la seule phrase aurait laissé deux `<span>` vides et l'écart de
 * 8 px (14 sur l'ordinateur) que leur conteneur en flex leur donne : un trou à
 * droite de la date, sans rien dedans. `<sc-if>` les retire tous les deux.
 *
 * `guide.aContributeurs` est un BOOLÉEN, et il vient du même convertisseur que
 * les deux phrases (`guideHeadFrom`) : une condition calculée ici, dans le
 * cadre, aurait divergé de la phrase au premier changement de règle.
 */
const LIGNE_CONTRIBUTEURS = (pastilles, taille, phrase) =>
  '<span style="display:flex;padding-left:6px">' +
  pastilles +
  '</span><span style="font-size:' +
  taille +
  ';color:#5D6B66">' +
  phrase +
  '</span>';

/** Les pastilles de la planche d'ordinateur : la maquette les écrit DÉJÀ en boucle. */
const PASTILLES_CONTRIBUTEURS_WEB =
  '<sc-for list="{{ contributors }}" as="s" hint-placeholder-count="4">' +
  '<span style="width:28px;height:28px;border-radius:999px;background:{{ s.bg }};' +
  'color:#fff;border:2px solid #fff;margin-left:-6px;font-size:9.5px;font-weight:700;' +
  'display:flex;align-items:center;justify-content:center">{{ s.i }}</span></sc-for>';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LE PLAN DES PAGES D'UN GUIDE — EMPRUNTÉ TROIS FOIS, DESSINÉ ZÉRO FOIS      ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « Un guide peut avoir plusieurs pages. […] Ajoute une section à
 * droite en haut de "Ce guide vous a intéressé" qui va lister les pages, leur
 * titre, et un highlight pour la page active, et on peut aussi cliquer sur les
 * pages non actives pour les afficher. À droite des tags en haut à droite aussi
 * des icônes chevron left/right et au milieu le nom de la page, cliquable aussi. »
 *
 * ⚠ AUCUNE DES QUATRE PLANCHES DE A04 NE DESSINE CELA. Compté sur les octets :
 * zéro occurrence de « page » hors du mot « pages » d'un texte de corps, zéro
 * carte de sommaire, zéro rangée de chevrons. Les trois surfaces sont donc
 * EMPRUNTÉES, chacune à un nœud que la même maquette dessine déjà :
 *
 *   1. LE PANNEAU DE PAGES (colonne de droite, 1 440 px) → la carte du PANNEAU DE
 *      SECTION « COMMUNAUTÉ » (ligne 652-655). C'est une carte blanche titrée en
 *      petites capitales dont la liste de rangées porte DÉJÀ sa surbrillance en
 *      donnée — `background:{{ m.bg }};color:{{ m.fg }};font-weight:{{ m.w }}` —
 *      avec les deux teintes que `panel(active)` lui donne : fond `#E3F0EB`, encre
 *      `#0F5C48`, graisse 700 pour l'entrée active. C'est exactement ce que le
 *      porteur décrit, et aucune couleur n'est inventée. Elle porte en plus la
 *      pastille de compteur (`{{ m.count }}`), qui dit où la conversation a lieu —
 *      `guidePageRefSchema.commentCount` existe pour cela.
 *   2. LA RANGÉE DE CHEVRONS (les deux largeurs) → les DEUX tracés que la maquette
 *      écrit déjà (`m15 18-6-6 6-6`, 26 fois ; `m9 18 6-6-6-6`, 3 fois), posés
 *      dans le rond d'icône de 32 px `#F2F5F4` qu'elle dessine sept fois, séparés
 *      par la PASTILLE VERTE de la ligne « Mis à jour le … » — la seule pastille
 *      « active » de ce cadre, et la même paire de teintes que la rangée active du
 *      panneau. Le ressort `<span style="flex:1"></span>` (50 occurrences) la
 *      pousse à droite des étiquettes, là où le porteur la demande.
 *   3. LA FEUILLE DES PAGES (390 px) → la feuille du bas du « menu de rôle »
 *      (`ADMIN · MEMBRES`, ligne 1400), celle-là même que `FEUILLE_ACTIONS`
 *      emprunte déjà pour le « … ». Sur 390 px la colonne de droite n'existe pas :
 *      le nom au milieu de la rangée de chevrons est la seule porte vers la liste,
 *      et c'est cette feuille qu'il ouvre.
 *
 * ── CE QUE L'EMPRUNT COÛTE, ET QU'IL FAUT SAVOIR ───────────────────────────
 *
 * ⚠ LES RONDS DE CHEVRON FONT 32 px SUR LES DEUX PLANCHES. La maquette ne dessine
 * ce rond qu'à cette taille avec cette encre (`#16211D`, tracé de 14 px) ; les
 * ronds de 40 px de la barre haute mobile portent, eux, `flex-shrink:0` et une
 * autre taille de tracé. Choisir 40 pour le téléphone et 32 pour l'ordinateur
 * aurait demandé d'écrire une valeur qu'aucune planche ne dessine à cet endroit.
 * La cible tactile est portée à 44 px par le remplissage en `content-box`, sans
 * déplacer un pixel — voir `cibleTactileRonde32` dans le générateur. REMONTÉ.
 *
 * ⚠ LA RANGÉE DE CHEVRONS N'EST PAS AU MÊME ENDROIT AUX DEUX LARGEURS, et c'est
 * la maquette qui l'impose : à 1 440 px les étiquettes vivent dans un
 * `<div style="display:flex;gap:8px">`, donc le ressort y pousse les chevrons à
 * l'extrémité DROITE DE LA MÊME LIGNE — ce que le porteur demande. À 390 px les
 * deux étiquettes sont des `<span>` en flux dans un `<div>` SANS `display:flex` :
 * un ressort n'y pousse rien, et des ronds en `display:flex` y passeraient à la
 * ligne un par un. La rangée y prend donc son propre conteneur — celui de la ligne
 * « Mis à jour le … », que ce cadre dessine (`gap:8px;margin-top:10px;flex-wrap`)
 * — et se place JUSTE SOUS les étiquettes, alignée à droite. REMONTÉ : il manque à
 * la planche de 390 px une ligne d'étiquettes en flex.
 */

/** La carte du panneau de section, VERBATIM — ses quatre morceaux. */
const CARTE_PANNEAU =
  '<div style="background:#fff;border:1px solid #E6EBE9;border-radius:22px;padding:14px">';

const TITRE_PANNEAU =
  '<div style="font-size:10.5px;font-weight:700;letter-spacing:1px;color:#8A958F;padding:0 6px 8px">';

const LISTE_PANNEAU = '<div style="display:flex;flex-direction:column;gap:2px">';

/**
 * UNE RANGÉE DU PANNEAU DE SECTION, VERBATIM — interpolations comprises.
 *
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LA BOUCLE DU PLAN EMPLOIE LE MÊME ALIAS `m` QUE LE PANNEAU DE SECTION      ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Ce n'est pas une négligence, c'est la condition pour que la rangée soit reprise
 * MOT POUR MOT. Le troisième contrôle d'`applyData` exige que tout ce qui n'est ni
 * échafaudage, ni motif déclaré, ni texte déclaré se retrouve dans le fragment de
 * la maquette ; une rangée réécrite en `{{ p.bg }}` ne serait plus le motif
 * `{{ m.bg }}` que la maquette dessine, et il faudrait alors déclarer en morceaux
 * les six fragments de dessin qui séparent ses interpolations — dont `;color:` et
 * `;font-weight:`, qui figurent aussi dans le titre de la carte juste au-dessus et
 * s'y feraient retirer d'abord. Un seul motif exact vaut mieux que six approximatifs.
 *
 * Les deux boucles sont SŒURS et non imbriquées : `(m, mIndex)` est déclaré dans
 * deux fonctions fléchées distinctes, ce qui ne masque rien et compile.
 */
const RANGEE_PANNEAU =
  '<a href="#" style="height:44px;display:flex;align-items:center;gap:11px;padding:0 12px;' +
  'border-radius:14px;background:{{ m.bg }};color:{{ m.fg }};font-weight:{{ m.w }};' +
  'font-size:13.5px"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" ' +
  'stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="{{ m.icon }}"/></svg><span style="flex:1;min-width:0;white-space:nowrap;' +
  'overflow:hidden;text-overflow:ellipsis">{{ m.label }}</span>' +
  '<sc-if value="{{ m.count }}" hint-placeholder-val="{{ false }}">' +
  '<span style="background:#E0733A;color:#fff;font-size:11px;font-weight:700;min-width:22px;' +
  'height:22px;padding:0 7px;border-radius:999px;display:flex;align-items:center;' +
  'justify-content:center">{{ m.count }}</span></sc-if></a>';

/**
 * L'ANCRE DU PANNEAU DE PAGES : la colonne de droite des deux cadres de 1 440 px.
 *
 * ELLE EST LA MÊME POUR LES DEUX VUES, et c'est ce qui place le panneau là où le
 * porteur le demande : la balise est OUVRANTE, donc l'emprunt posé APRÈS elle fait
 * du panneau le PREMIER enfant de la colonne — au-dessus de « Ce guide vous a-t-il
 * aidé ? » sur la vue lecteur, au-dessus de la carte « VOUS ÊTES L'AUTEUR » sur
 * celle de l'auteur, qui ne dessine pas la carte de vote. Figure une fois dans
 * chacun des deux cadres, compté.
 */
const COLONNE_DROITE_A04 =
  '<aside style="width:300px;display:flex;flex-direction:column;gap:12px">';

/** La carte VIDE, telle que l'emprunt la pose : la liaison lui donne sa liste. */
const CARTE_PAGES_VIDE =
  CARTE_PANNEAU + TITRE_PANNEAU + 'COMMUNAUTÉ</div>' + LISTE_PANNEAU + '</div></div>';

// ─── La rangée de chevrons, morceau par morceau ─────────────────────────────

/** Le rond d'icône de 32 px, tel que la maquette l'écrit sept fois. */
const ROND_CHEVRON =
  '<span style="width:32px;height:32px;border-radius:999px;background:#F2F5F4;display:flex;' +
  'align-items:center;justify-content:center"><svg width="14" height="14" viewBox="0 0 24 24" ' +
  'fill="none" stroke="#16211D" stroke-width="1.8" stroke-linecap="round" ' +
  'stroke-linejoin="round">';

const CHEVRON_GAUCHE = '<path d="m15 18-6-6 6-6"/>';
const CHEVRON_DROIT = '<path d="m9 18 6-6-6-6"/>';
const FIN_ROND = '</svg></span>';
const RESSORT = '<span style="flex:1"></span>';

/** La pastille verte de la ligne « Mis à jour le … », aux deux largeurs. */
const PASTILLE_VERTE_WEB =
  '<span style="font-size:14px;font-weight:700;color:#0F5C48;background:#E3F0EB;' +
  'padding:6px 12px;border-radius:999px">';

const PASTILLE_VERTE_MOBILE =
  '<span style="font-size:13px;font-weight:700;color:#0F5C48;background:#E3F0EB;' +
  'padding:5px 11px;border-radius:999px">';

/** Le texte que la pastille empruntée porte dans la maquette. */
const DATE_MAQUETTE = 'Mis à jour le 12 mars 2026';

/**
 * Le conteneur de la ligne « Mis à jour le … » des deux cadres de 390 px — celui
 * que la rangée de chevrons réemploie faute d'une ligne d'étiquettes en flex.
 */
const LIGNE_FLEX_MOBILE =
  '<div style="display:flex;align-items:center;gap:8px;margin-top:10px;flex-wrap:wrap">';

/** Chevron gauche · nom de la page · chevron droit, poussés à droite par le ressort. */
const RANG_CHEVRONS = (pastille) =>
  RESSORT +
  ROND_CHEVRON +
  CHEVRON_GAUCHE +
  FIN_ROND +
  pastille +
  DATE_MAQUETTE +
  '</span>' +
  ROND_CHEVRON +
  CHEVRON_DROIT +
  FIN_ROND;

/** Les morceaux empruntés de la rangée, dans l'ordre où le résidu les retire. */
const MOTIFS_CHEVRONS = (pastille) => [
  RESSORT,
  ROND_CHEVRON,
  CHEVRON_GAUCHE,
  FIN_ROND,
  pastille + DATE_MAQUETTE + '</span>',
  ROND_CHEVRON,
  CHEVRON_DROIT,
  FIN_ROND,
];

/**
 * UNE RANGÉE DE LA FEUILLE DE PAGES, VERBATIM — celle de « Écrire » du menu de
 * rôle, et NON celle de « Nommer modératrice » que `FEUILLE_ACTIONS` emprunte.
 *
 * LA DIFFÉRENCE EST STRUCTURELLE, pas cosmétique : les deux feuilles atterrissent
 * sur la MÊME ancre dans les mêmes cadres, et si leurs nœuds étaient identiques à
 * l'octet, le `fois: 1` de la liaison de `FEUILLE_ACTIONS` compterait deux
 * occurrences et la génération s'arrêterait. Emprunter une AUTRE des quatre
 * rangées que la planche dessine distingue les deux feuilles sans rien inventer.
 */
const RANGEE_FEUILLE_PAGES =
  '<span style="height:50px;display:flex;align-items:center;gap:12px;padding:0 6px;' +
  'font-size:14px;font-weight:600;color:#16211D">' +
  '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#16211D" ' +
  'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M4 5h16v11H9l-5 4z"/></svg>Écrire</span>';

const FEUILLE_PAGES =
  VOILE_FEUILLE_ACTIONS +
  OUVERTURE_FEUILLE_ACTIONS +
  POIGNEE_FEUILLE_ACTIONS +
  RANGEE_FEUILLE_PAGES +
  '</div>';

const A04_DONNEES = [
  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LA RANGÉE DE CHEVRONS — SA CONDITION ET LE NOM DE LA PAGE                ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * ⚠ CES DEUX LIAISONS SONT EN TÊTE DE LA LISTE, ET L'ORDRE EST OBLIGATOIRE.
   * `applyData` parcourt la liste dans l'ordre, et la pastille empruntée porte le
   * MÊME texte que celle de la ligne « Mis à jour le … » — `Mis à jour le 12 mars
   * 2026` figure donc DEUX fois dans chaque cadre après l'emprunt. La liaison de
   * la date, plus bas, est à `fois: 1` : si elle passait d'abord, elle compterait
   * deux occurrences et ARRÊTERAIT la génération. En passant ici, chacune de ces
   * deux liaisons consomme la pastille de SA rangée de chevrons — qui est unique,
   * ressort et ronds compris — et laisse à la date l'occurrence qui lui revient.
   *
   * `plan.visible` DÉCIDE DE LA RANGÉE ENTIÈRE : un guide d'UNE page n'a pas de
   * navigation, et deux chevrons éteints de part et d'autre de son unique titre
   * seraient du mobilier. `guideDetailResponseSchema` le dit d'avance : « le front
   * dessine le plan quand `pages.length > 1` et ne change rien sinon ».
   */
  {
    noeud: RANG_CHEVRONS(PASTILLE_VERTE_WEB),
    devient:
      '<sc-if value="{{ plan.visible }}">' +
      RESSORT +
      ROND_CHEVRON +
      CHEVRON_GAUCHE +
      FIN_ROND +
      PASTILLE_VERTE_WEB +
      '{{ plan.titre }}' +
      '</span>' +
      ROND_CHEVRON +
      CHEVRON_DROIT +
      FIN_ROND +
      '</sc-if>',
    fois: 1,
    frames: ['Desktop', 'AuteurDesktop'],
    why: 'Le nom de la page lue, au milieu des deux chevrons de la rangée empruntée — et la rangée entière DISPARAÎT sur un guide d’une seule page, où elle ne mènerait nulle part.',
  },
  {
    /**
     * LA MÊME RANGÉE SUR 390 px, CONTENEUR COMPRIS. Il est dans le nœud parce
     * qu'il doit disparaître avec elle : laissé seul, le conteneur en flex garderait
     * son `margin-top:10px` et son écart de 8 px — un trou sous les étiquettes,
     * sans rien dedans. C'est le défaut que la ligne des contributeurs a déjà
     * coûté, corrigé ici d'avance.
     */
    noeud: LIGNE_FLEX_MOBILE + RANG_CHEVRONS(PASTILLE_VERTE_MOBILE) + '</div>',
    devient:
      '<sc-if value="{{ plan.visible }}">' +
      LIGNE_FLEX_MOBILE +
      RESSORT +
      ROND_CHEVRON +
      CHEVRON_GAUCHE +
      FIN_ROND +
      PASTILLE_VERTE_MOBILE +
      '{{ plan.titre }}' +
      '</span>' +
      ROND_CHEVRON +
      CHEVRON_DROIT +
      FIN_ROND +
      '</div></sc-if>',
    fois: 1,
    frames: ['Mobile', 'AuteurMobile'],
    why: 'La même rangée de chevrons sur les deux cadres de 390 px, où elle est le SEUL accès aux pages : la colonne de droite n’y existe pas.',
  },
  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LE PANNEAU DE PAGES : SA CONDITION, SON TITRE ET SA LISTE                ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * L'emprunt a posé la carte VIDE — carte, titre, conteneur de liste — et rien
   * d'autre. C'est le partage que `FEUILLE_ACTIONS` applique déjà : l'emprunt pose
   * du DESSIN, la donnée pose la CONDITION et la LISTE.
   *
   * ⚠ ET IL LE FAUT, parce que `markLinks` passe AVANT `applyData` : la rangée du
   * panneau de section est adressée par `marqueur: '{{ m.icon }}'` à `fois: 1`
   * (voir `panneauBoucle`). Emprunter la rangée AVEC la carte en aurait mis deux
   * dans le cadre, et la génération se serait arrêtée sur ce compte — en nommant
   * le rail, à deux mécanismes de la vraie cause. La rangée arrive donc ici, après
   * `markLinks`, en MOTIF vérifié contre la maquette (`from`), et son `href="#"`
   * est adressé par l'adaptation `A04_PLAN`.
   *
   * `plan.libelle` plutôt que « PAGES DU GUIDE » écrit ici : le titre de cette
   * carte est du TEXTE DE PRODUIT, et il vit avec les autres dans
   * `screens/guides/from-api.ts` — pas dans le transcodeur, qui n'écrit pas
   * d'interface.
   */
  {
    noeud: COLONNE_DROITE_A04 + CARTE_PAGES_VIDE,
    devient:
      COLONNE_DROITE_A04 +
      '<sc-if value="{{ plan.visible }}">' +
      CARTE_PANNEAU +
      TITRE_PANNEAU +
      '{{ plan.libelle }}</div>' +
      LISTE_PANNEAU +
      '<sc-for list="{{ plan.pages }}" as="m">' +
      RANGEE_PANNEAU +
      '</sc-for>' +
      '</div></div></sc-if>',
    motifs: [{ from: FILE, pattern: RANGEE_PANNEAU }],
    fois: 1,
    frames: ['Desktop', 'AuteurDesktop'],
    why: 'Le plan des pages, en tête de la colonne de droite : la page lue est teintée par la MÊME paire que l’entrée active du panneau de section (fond #E3F0EB, encre #0F5C48), et sa pastille de compteur dit où la conversation a lieu.',
  },
  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LA FEUILLE DES PAGES SUR 390 px : SA CONDITION ET SA LISTE               ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Même partage, même raison que pour la feuille d'actions juste en dessous : la
   * condition et la liste sont des données, le dessin reste celui de la planche
   * empruntée au caractère près.
   *
   * ⚠ LA PAGE LUE EST MARQUÉE AUTREMENT QUE PAR SA SEULE COULEUR, et c'est voulu :
   * son TRACÉ devient celui de la coche (`m5 12 4.5 4.5L19 7`, 19 occurrences dans
   * la maquette) là où les autres portent celui de la liste de lignes
   * (`M4 6h16M7 12h10M5 18h14`). La rangée empruntée n'écrit AUCUN `background` —
   * en ajouter un serait dessiner — donc la couleur seule n'aurait pas suffi.
   */
  {
    noeud: FEUILLE_PAGES,
    devient:
      '<sc-if value="{{ plan.feuilleOuverte }}">' +
      VOILE_FEUILLE_ACTIONS +
      OUVERTURE_FEUILLE_ACTIONS +
      POIGNEE_FEUILLE_ACTIONS +
      '<sc-for list="{{ plan.pages }}" as="m">' +
      RANGEE_FEUILLE_PAGES.replace('<path d="M4 5h16v11H9l-5 4z"/>', '<path d="{{ m.icon }}"/>')
        .replace('stroke="#16211D" ', 'stroke="{{ m.fg }}" ')
        .replace('color:#16211D"', 'color:{{ m.fg }}"')
        .replace('>Écrire<', '>{{ m.label }}<') +
      '</sc-for>' +
      '</div>' +
      '</sc-if>',
    fois: 1,
    frames: ['Mobile', 'AuteurMobile'],
    why: 'La feuille des pages du téléphone — empruntée au « menu de rôle » de la même maquette, comme celle du « … » — porte une rangée par page, la page lue marquée par la coche et par l’encre verte du panneau.',
  },
  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LES TROIS DERNIÈRES LIGNES ÉCRITES EN DUR DU DÉTAIL                     ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur : « tout ça est dessiné ». Le CORPS est traité par l'adaptation
   * `A04_CORPS` — c'est une région de longueur inconnue, pas une donnée à lier
   * mot par mot. Restaient trois phrases, et les trois ont une source :
   *
   *   « 84 membres ont trouvé utile »   → `guide.helpfulCount`
   *   « Marc Koudou et 3 contributeurs » → la liste `contributors`
   *   « 14 COMMENTAIRES »                → le compte des commentaires du guide
   */
  {
    noeud: '>84 membres ont trouvé utile<',
    devient: '>{{ guide.utiles }}<',
    fois: 1,
    frames: ['Desktop'],
    why: 'Le compteur d’utilité du guide (`helpfulCount`) — il affichait 84 pour tous les guides.',
  },
  {
    /**
     * LA LIGNE ENTIÈRE, pastilles comprises — voir `LIGNE_CONTRIBUTEURS` pour
     * le pourquoi. La liaison portait auparavant sur le seul littéral
     * `>Marc Koudou et 3 contributeurs<` ; elle porte maintenant sur la paire de
     * `<span>` que la maquette dessine, pour pouvoir les retirer TOUS LES DEUX.
     *
     * `AuteurDesktop` EST DANS LA LISTE, et c'était un défaut mesuré : la planche
     * d'auteur dessine EXACTEMENT la même ligne (compté sur les octets de la
     * maquette — elle figure une fois dans chacun des deux cadres de 1 440 px),
     * et elle n'était liée que sur le premier. L'auteur d'un guide lisait donc le
     * nom de Marc Koudou sous SON guide.
     *
     * `fois: 1` se vérifie PAR CADRE, donc élargir `frames` n'affaiblit pas le
     * garde-fou : le jour où la planche d'auteur dédouble ou retire la ligne, la
     * génération s'arrête en la nommant.
     */
    noeud: LIGNE_CONTRIBUTEURS(
      PASTILLES_CONTRIBUTEURS_WEB,
      '12.5px',
      'Marc Koudou et 3 contributeurs',
    ),
    devient:
      '<sc-if value="{{ guide.aContributeurs }}">' +
      LIGNE_CONTRIBUTEURS(PASTILLES_CONTRIBUTEURS_WEB, '12.5px', '{{ guide.contributeurs }}') +
      '</sc-if>',
    fois: 1,
    frames: ['Desktop', 'AuteurDesktop'],
    why: 'La ligne des contributeurs, composée de la liste que `GET /guides/:slug` rend — elle nommait Marc Koudou sur tous les guides, et la planche d’AUTEUR la dessine aussi. Elle DISPARAÎT quand le guide n’a aucun contributeur, au lieu d’écrire « Aucun contributeur » sous le titre d’un guide tout neuf.',
  },
  {
    /**
     * LA MÊME LIGNE SUR LES DEUX CADRES DE 390 px, où la maquette la raccourcit
     * faute de place — et où elle dessine SES TROIS PASTILLES EN DUR, là où la
     * planche d'ordinateur les écrit déjà en boucle. Les deux liaisons qui
     * existaient ici — le littéral `>Marc K. et 3<` et la rangée de pastilles —
     * sont FONDUES EN UNE, pour la même raison que sur l'ordinateur : il faut
     * pouvoir retirer la paire de `<span>` d'un seul `<sc-if>`.
     *
     * `AuteurMobile` A ÉTÉ AJOUTÉ APRÈS COUP sur la liaison d'origine, et c'était
     * le troisième littéral de cette planche pris au même piège : une liaison
     * écrite pour le cadre du LECTEUR laisse celui de l'AUTEUR peindre la valeur
     * de la maquette, sans qu'aucune erreur ne sorte — la génération réussit, le
     * contrôle « fois: 1 » est satisfait sur le cadre nommé, et c'est l'écran qui
     * ment. Les deux autres étaient « 14 COMMENTAIRES » et « Marc Koudou et 3
     * contributeurs » sur AuteurDesktop. À RETENIR : quand la maquette dessine
     * quatre cadres pour un écran, une liaison qui n'en nomme qu'un est une
     * liaison à vérifier sur les trois autres.
     */
    noeud: LIGNE_CONTRIBUTEURS(
      PASTILLE_CONTRIBUTEUR_MOBILE('#0F5C48', 'MK') +
        PASTILLE_CONTRIBUTEUR_MOBILE('#16785E', 'AD') +
        PASTILLE_CONTRIBUTEUR_MOBILE('#2FA37D', 'FN'),
      '12px',
      'Marc K. et 3',
    ),
    devient:
      '<sc-if value="{{ guide.aContributeurs }}">' +
      LIGNE_CONTRIBUTEURS(
        '<sc-for list="{{ contributors }}" as="s">' +
          PASTILLE_CONTRIBUTEUR_MOBILE('{{ s.bg }}', '{{ s.i }}') +
          '</sc-for>',
        '12px',
        '{{ guide.contributeursCourt }}',
      ) +
      '</sc-if>',
    fois: 1,
    frames: ['Mobile', 'AuteurMobile'],
    why: 'La ligne des contributeurs sur les deux cadres de 390 px — pastilles comprises, de `GET /guides/:slug`. Elle DISPARAÎT quand le guide n’a aucun contributeur, au lieu d’afficher un tiret cadratin seul sous le titre (défaut remonté par le porteur, capture à l’appui).',
  },
  {
    noeud: '>14 COMMENTAIRES<',
    devient: '>{{ guide.commentaires }}<',
    fois: 1,
    /**
     * ╔══════════════════════════════════════════════════════════════════════╗
     * ║ LES QUATRE CADRES, ALORS QUE LA MAQUETTE N'EN DESSINE QUE DEUX       ║
     * ╚══════════════════════════════════════════════════════════════════════╝
     *
     * CE QUI EST COMPTÉ, sur les octets de `03 Accueil v2.dc.html` :
     * `>14 COMMENTAIRES<` figure DEUX fois dans tout le fichier — une fois dans
     * chacun des deux cadres de 1 440 px de A04 (lecteur, ligne 678 ; auteur,
     * ligne 728). ZÉRO fois dans la section `MOB`, d'où viennent les deux cadres
     * de 390 px : la planche mobile du guide NE DESSINE PAS la ligne des
     * commentaires, ni rien qui y mène — sa barre basse de lecture porte « Ce
     * guide vous a aidé ? », Oui, Non et le crayon de correction ; celle d'auteur
     * porte les deux compteurs, « Modifier » et « Propositions ».
     *
     * La liaison ne portait que sur `Desktop`, et la planche d'AUTEUR affichait
     * donc « 14 COMMENTAIRES » sur tous les guides — le même mensonge que la
     * ligne des contributeurs juste au-dessus.
     *
     * LES DEUX CADRES MOBILES SONT LÀ parce que `borrows` leur a posé LE MÊME
     * NŒUD, emprunté mot pour mot à la planche d'ordinateur (voir la déclaration
     * `borrows` de A04). L'emprunt tourne AVANT `applyData` dans le tuyau de
     * `generate-screens.mjs`, donc le littéral est bien présent quand la liaison
     * cherche son nœud — et si l'emprunt cessait de s'appliquer, `fois: 1`
     * ARRÊTERAIT la génération ici au lieu de laisser un cadre muet.
     */
    frames: ['Desktop', 'AuteurDesktop', 'Mobile', 'AuteurMobile'],
    why: 'Le compte des commentaires du guide — il affichait 14 partout, et seule la planche LECTEUR d’ordinateur était liée.',
  },
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
    frames: ['Mobile', 'AuteurMobile'],
    why: 'Le même bandeau sur les DEUX cadres de 390 px. ÉCART DE MAQUETTE, comblé par emprunt dans ce lot : la planche mobile de la vue AUTEUR ne dessine AUCUN bandeau — sa barre haute met « Votre guide » à la place — alors que la planche d’ordinateur de la même vue garde « Maintenu par la communauté ». Un auteur de téléphone qui ouvre son guide à la communauté doit en voir la confirmation.',
  },
  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LE BANDEAU D'AVERTISSEMENT PORTE SA CONDITION ET SON TEXTE               ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Le nœud vient de l'EMPRUNT déclaré plus haut (il n'est dessiné dans aucun
   * cadre de A04) ; cette liaison lui pose les deux seules choses qu'un emprunt
   * ne peut pas poser : la CONDITION et le TEXTE.
   *
   * `guide.avertissement` est un booléen, et il décide de la BANDE ENTIÈRE.
   * `guide.avertissementTexte` porte la phrase, parce que les deux
   * avertissements du serveur ne disent PAS la même chose — voir
   * `guides/from-api.ts`, qui les compose et qui écrit pourquoi.
   *
   * UN SEUL NŒUD POUR DEUX ÉTATS, et ce n'est pas une économie : la maquette
   * dessine les deux avertissements avec LA MÊME paire de couleurs
   * (#FDF1D8 / #8A5A0B, relevé sur les pastilles de légende des lignes 740-741)
   * et la même icône d'alerte. Seule la phrase change, donc seule la phrase est
   * une donnée. Deux nœuds auraient dédoublé un dessin identique.
   *
   * LES QUATRE CADRES, parce que les quatre doivent avertir. C'est le même
   * raisonnement que pour l'en-tête des commentaires, et l'emprunt couvre les
   * quatre — y compris la planche mobile d'auteur, qui n'avait aucune bande.
   */
  {
    noeud: BANDEAU_AVERTISSEMENT,
    devient:
      '<sc-if value="{{ guide.avertissement }}">' +
      BANDEAU_AVERTISSEMENT.replace(
        "À vérifier — des membres signalent que l'information a changé",
        '{{ guide.avertissementTexte }}',
      ) +
      '</sc-if>',
    fois: 1,
    frames: ['Desktop', 'AuteurDesktop', 'Mobile', 'AuteurMobile'],
    why: 'Les deux avertissements du serveur — `TO_VERIFY` et `OUTDATED_REPORTED` — s’affichent enfin sur la page du guide : le serveur les calculait, l’écran ne les lisait pas, et un guide périmé depuis trois ans se lisait comme un guide à jour.',
  },
  /**
   * LES PASTILLES DE CONTRIBUTEURS DES DEUX CADRES MOBILES NE SONT PLUS LIÉES
   * ICI : elles le sont avec la LIGNE ENTIÈRE, plus haut, sous le même `<sc-if>`
   * que la phrase. Deux liaisons sur deux moitiés de la même ligne ne pouvaient
   * pas la faire disparaître d'un bloc — et une rangée de pastilles vide
   * au-dessus d'une phrase vide laissait l'écart de son conteneur en flex.
   */
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
  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LA FEUILLE D'ACTIONS : SA CONDITION ET SA LISTE                         ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Le nœud vient de l'EMPRUNT déclaré avec l'écran (voir `FEUILLE_ACTIONS`).
   * Cette liaison lui pose les deux seules choses qu'un emprunt ne peut pas
   * poser — la CONDITION et la LISTE — et rien d'autre : le dessin, lui, reste
   * celui de la planche du menu de rôle, au caractère près.
   *
   * `menu.ouvert` DÉCIDE DE LA FEUILLE ENTIÈRE, voile compris. Sans condition,
   * un voile `inset: 0` recouvrirait la page du guide en permanence — c'est-à-dire
   * exactement le défaut qu'on vient corriger, retourné.
   *
   * `menu.actions` EST LA MÊME LISTE QUE LA COLONNE D'ORDINATEUR (`guideActions`),
   * et c'est tout l'enjeu : les trois actions du guide ont déjà un libellé, un
   * tracé et un geste, et `A04_ACTIONS` les rend vivantes à 1 440 px. En recopier
   * une seconde liste pour 390 px aurait fait diverger trois libellés et trois
   * gestes au premier changement. ⚠ C'est une PRISE DISTINCTE (`menu`) parce que
   * la feuille porte en plus son état d'ouverture, que la colonne n'a pas.
   */
  {
    noeud: FEUILLE_ACTIONS,
    devient:
      '<sc-if value="{{ menu.ouvert }}">' +
      VOILE_FEUILLE_ACTIONS +
      OUVERTURE_FEUILLE_ACTIONS +
      POIGNEE_FEUILLE_ACTIONS +
      '<sc-for list="{{ menu.actions }}" as="a">' +
      RANGEE_FEUILLE_ACTIONS.replace(
        '<path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM5 21a7 7 0 0 1 14 0"/>',
        '<path d="{{ a.icon }}"/>',
      ).replace('Nommer modératrice', '{{ a.label }}') +
      '</sc-for>' +
      '</div>' +
      '</sc-if>',
    fois: 1,
    frames: ['Mobile'],
    why: 'La feuille d’actions du « … » mobile — empruntée au « menu de rôle » de la même maquette — porte les TROIS actions du guide, celles-là mêmes que la colonne d’ordinateur rend vivantes. Sur 390 px elles n’avaient aucun accès.',
  },
  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LA FEUILLE DE L'AUTEUR : LA MÊME CONDITION, UN AUTRE CONTENU             ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * ⚠ `frames: ['AuteurMobile']` SEUL, et la liaison ci-dessus est passée à
   * `['Mobile']` seul : les deux cadres ne montent plus la même feuille, donc une
   * liaison qui nommerait les deux arrêterait la génération sur « figure 0 fois »
   * — ce qui est exactement le garde-fou voulu, et c'est lui qui a dicté la coupe.
   *
   * `menu.ouvert` EST LA MÊME PRISE que pour la feuille du lecteur, et c'est
   * voulu : c'est le même « … » de la même barre haute, et `guide-screen.tsx` ne
   * monte qu'un cadre à la fois (`vueAuteur ? … : …`). Un second état d'ouverture
   * aurait été deux vérités à tenir d'accord pour un seul bouton.
   *
   * ⚠ `menu.actions` N'EST PLUS LU PAR CE CADRE, et la prise RESTE dans `A04Data` :
   * le cadre du lecteur la lit toujours, et les quatre cadres partagent une seule
   * forme de données. Conséquence à savoir : sur la vue auteur, les trois actions
   * composées par `guide-screen.tsx` ne sont plus atteignables à 390 px — ce qui
   * EST la correction, pas un effet de bord.
   *
   * ⚠ RIEN N'EST LIÉ DANS LA BOUCLE : `{{ versions }}`, `{{ v.dot }}`, `{{ v.t }}`
   * et `{{ v.s }}` sont le DIALECTE DE LA MAQUETTE, pas des prises posées ici. La
   * colonne d'ordinateur les emploie déjà depuis le transcodage d'origine, et
   * `guide-screen.tsx` nourrit `versions` de `GET /guides/:slug/versions`. Cette
   * liaison ne pose donc QUE la condition d'ouverture.
   */
  {
    noeud: FEUILLE_VERSIONS_AUTEUR,
    devient:
      '<sc-if value="{{ menu.ouvert }}">' +
      VOILE_FEUILLE_ACTIONS +
      OUVERTURE_FEUILLE_ACTIONS +
      POIGNEE_FEUILLE_ACTIONS +
      '<sc-for list="{{ menu.actions }}" as="a">' +
      RANGEE_FEUILLE_ACTIONS.replace(
        '<path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM5 21a7 7 0 0 1 14 0"/>',
        '<path d="{{ a.icon }}"/>',
      ).replace('Nommer modératrice', '{{ a.label }}') +
      '</sc-for>' +
      TITRE_VERSIONS_WEB +
      BOUCLE_VERSIONS_WEB +
      '</div>' +
      '</sc-if>',
    fois: 1,
    frames: ['AuteurMobile'],
    why: 'La feuille du « … » de la vue AUTEUR porte ses DEUX gestes puis l’historique des versions, et elle ne s’ouvre que sur `menu.ouvert` : sans condition, son voile `inset:0` recouvrirait la page en permanence. Les deux gestes — la liste des signalements et « Ouvrir à la communauté » — ne sont dessinés QUE sur la planche de 1 440 px, et n’avaient aucun accès à 390 px.',
  },
  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ « SIGNALEMENTS “A CHANGÉ” · 0 » — UN ZÉRO PEINT, DANS UN LIEN MORT       ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * MESURÉ sur le cadre produit, avant ce lot : la carte d'actions de l'auteur à
   * 1 440 px portait `<a href="#">Signalements « a changé » … 0</a>` — un nombre
   * PEINT EN DUR dans une rangée qui ne menait NULLE PART. Le compte existait
   * pourtant dans la réponse depuis le début (`guide.outdatedFlagCount`, entier,
   * `guideDetailResponseSchema`).
   *
   * CETTE LIAISON NE POSE QUE LE NOMBRE. La rangée cesse d'être un lien dans
   * `A04_SIGNALEMENTS`, parce que c'est une transformation de STRUCTURE et qu'une
   * donnée n'a pas le droit d'en faire (le troisième contrôle d'`applyData` le
   * refuserait, à juste titre).
   *
   * LE LIBELLÉ ENTRE DANS LE NŒUD, et ce n'est pas du remplissage : le nombre seul
   * (`>0<` dans sa paire gris-700) tiendrait aussi, mais une retouche du designer
   * qui déplacerait ce `0` sous un autre libellé serait alors liée en silence. Le
   * garde-fou ne vaut que s'il est ancré sur ce qui identifie la rangée.
   */
  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ « OUVRIR À LA COMMUNAUTÉ » DIT CE QU'ELLE FERA                          ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur : « le bouton ouvrir à la communauté ne marche pas. » MESURÉ : un
   * `<a href="#">` mort, dessiné sur CE SEUL CADRE (zéro occurrence sur
   * `desktop`, `mobile`, `auteurmobile`).
   *
   * CETTE LIAISON NE POSE QUE LE LIBELLÉ. La rangée devient un `<button>` dans
   * `A04_COMMUNAUTE`, parce que c'est une transformation de STRUCTURE et qu'une
   * donnée n'a pas le droit d'en faire.
   *
   * ET LE LIBELLÉ EST UNE DONNÉE PARCE QUE L'ACTION A DEUX SENS : §2.5 veut le
   * geste « réversible », donc la rangée doit dire si elle OUVRE ou si elle rend
   * la main. Un guide déjà ouvert affiche le bandeau « Maintenu par la
   * communauté » ; une rangée qui proposerait encore « Ouvrir » serait un bouton
   * qui contredit le bandeau situé au-dessus de lui.
   */
  {
    noeud: '>Ouvrir à la communauté<',
    devient: '>{{ guide.communauteLabel }}<',
    fois: 1,
    frames: ['AuteurDesktop'],
    why: 'Le libellé de la bascule « maintenu par la communauté » (§2.5, réversible) : la maquette ne dessine que le sens « ouvrir », et l’écran doit aussi savoir dire « reprendre la main ».',
  },
  {
    noeud: RANGEE_SIGNALEMENTS_WEB('0'),
    devient: RANGEE_SIGNALEMENTS_WEB('{{ guide.signalements }}'),
    fois: 1,
    frames: ['AuteurDesktop'],
    why: 'Le compte des signalements « a changé » vient de `guide.outdatedFlagCount` : la maquette y peignait un « 0 » en dur, affiché sur tous les guides de tous les auteurs.',
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

/** Une option de sondage, telle que le cadre de 390 px la dessine trois fois. */
const OPTION_BROUILLON = (texte) =>
  '<span style="padding:6px 10px;border-radius:10px;background:#F2F5F4;font-size:12px;' +
  `font-weight:600">${texte}</span>`;

/** La pastille d'un guide lié, telle que le cadre de 390 px la dessine une fois. */
const PASTILLE_GUIDE_BROUILLON = (titre) =>
  '<span style="display:flex;align-items:center;gap:6px;background:#EFF7F3;color:#0F5C48;' +
  'font-size:12px;font-weight:700;padding:6px 8px 6px 12px;border-radius:999px">' +
  '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0F5C48" stroke-width="2" ' +
  'stroke-linecap="round" stroke-linejoin="round"><path d="M12 7v14M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/></svg>' +
  `${titre}` +
  '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#0F5C48" stroke-width="2.6" ' +
  'stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg></span>';

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
  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LA CARTE DE SONDAGE ÉTAIT L'EXEMPLE DE LA MAQUETTE, SERVI À TOUT LE MONDE║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur : « La page pour la publication d'une actualité sur mobile n'est
   * pas dynamique, pas d'input, l'ajout de sondage ne marche pas. »
   *
   * « Quelle date pour le repas partagé ? », « Samedi 22 mars », « 3 jours ·
   * résultats après le vote · anonyme » : trois textes de la planche, affichés à
   * qui n'a créé aucun sondage. Le cadre d'ordinateur, lui, lit déjà
   * `composeurSondage` — c'est la MÊME donnée, et elle existait.
   *
   * LA CARTE ENTIÈRE DISPARAÎT SANS SONDAGE (`sc-if`) : une carte vide au milieu
   * du brouillon dirait qu'il y a un sondage sans question.
   */
  {
    noeud: '>Quelle date pour le repas partagé ?<',
    devient: '>{{ composeurSondage.question }}<',
    fois: 1,
    why: 'La question du sondage en cours de composition — `composeurSondage.question`, la même donnée que le cadre d’ordinateur lit déjà.',
  },
  {
    noeud:
      OPTION_BROUILLON('Samedi 22 mars') +
      OPTION_BROUILLON('Dimanche 23 mars') +
      OPTION_BROUILLON('Samedi 29 mars'),
    devient:
      '<sc-for list="{{ composeurSondage.options }}" as="op">' +
      OPTION_BROUILLON('{{ op }}') +
      '</sc-for>',
    fois: 1,
    why: 'Les options du sondage : la LISTE, jamais trois dates écrites à côté d’elle. RÈGLE DURE 04 §2.2 — « 2 à 5 options ».',
  },
  {
    noeud: '>3 jours · résultats après le vote · anonyme<',
    devient: '>{{ composeurSondage.meta }}<',
    fois: 1,
    why: 'La ligne de réglages du sondage — durée, moment des résultats, anonymat — composée là où l’ordinateur la compose.',
  },
  /**
   * LE GUIDE LIÉ — même histoire. « Repas pas cher à Lyon » était écrit en dur,
   * et la fenêtre « Lier un guide » existe déjà sur les deux largeurs.
   */
  /**
   * LES DEUX COMPTEURS DU PIED ÉTAIENT DES « 1 » ÉCRITS À LA MAIN.
   *
   * Celui des images lit déjà `brouillon.photos.length` ; ceux du sondage et des
   * guides affichaient « 1 » à qui n'avait ni l'un ni l'autre — mesuré à l'écran
   * sur un brouillon vide : « 0 1 1 ». Ils lisent maintenant la même source que
   * les blocs qu'ils comptent.
   */
  {
    noeud: 'M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>1</span>',
    devient: 'M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>{{ composeurSondageCompte }}</span>',
    fois: 1,
    why: 'Le compteur de sondage du pied : 1 quand un sondage est composé, 0 sinon — il affichait 1 pour tout le monde.',
  },
  {
    noeud:
      'M12 7v14M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/></svg>1</span>',
    devient:
      'M12 7v14M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/></svg>{{ composeurGuidesCompte }}</span>',
    fois: 1,
    why: 'Le compteur de guides liés du pied : la longueur de `composeurGuides`, dérivée là où la liste est tenue — jamais un nombre écrit à côté d’elle.',
  },
  {
    noeud: PASTILLE_GUIDE_BROUILLON('Repas pas cher à Lyon'),
    devient:
      '<sc-for list="{{ composeurGuides }}" as="g">' +
      PASTILLE_GUIDE_BROUILLON('{{ g.titre }}') +
      '</sc-for>',
    fois: 1,
    why: 'Les guides liés au brouillon — `composeurGuides`, que la fenêtre A01G remplit et que le cadre d’ordinateur lit déjà. UNE BOUCLE et non un titre : 04 §2.5 en autorise trois, et la planche n’en dessine qu’un.',
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

/**
 * La pastille d'avatar d'un proposant, sur la planche de 1 440 px.
 *
 * ⚠ CE N'EST PAS CELLE DE 390 px, ET C'EST LE PIÈGE 1 DU MÉMO : l'ordinateur
 * dessine 34 × 34 à 10,5 px, le téléphone 30 × 30 à 10 px. Deux helpers, parce que
 * ce sont deux dessins — un seul aurait figé les mesures d'un cadre sur l'autre.
 */
const AVATAR_PROPOSANT_WEB = (fond, initiales) =>
  '<span style="width:34px;height:34px;border-radius:999px;background:' +
  fond +
  ';color:#fff;font-size:10.5px;font-weight:700;display:flex;align-items:center;justify-content:center">' +
  initiales +
  '</span>';

// ─── A06 · LA PLANCHE 2 RÉEMPLOYÉE POUR LES SIGNALEMENTS « A CHANGÉ » ───────
//
// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║ LA MAQUETTE NE DESSINE AUCUNE PAGE DE SIGNALEMENTS — ON EMPRUNTE CELLE-CI    ║
// ╚══════════════════════════════════════════════════════════════════════════════╝
//
// Le porteur, revenant sur son arbitrage de la veille : « Il faut faire ceci,
// l'auteur doit voir les signalements "a changé". » VÉRIFIÉ sur les octets de
// `docs/template/` : aucune `data-screen-label` ne nomme une page de signalements,
// et aucun cadre n'en dessine une.
//
// LE CANDIDAT EST A06 « PROPOSITIONS REÇUES », et ce n'est pas un pis-aller : c'est
// LA MÊME PAGE, au sens du produit — celle où l'AUTEUR relit ce que les lecteurs
// lui disent de son guide. Même rôle, même fil d'Ariane, même colonne de contexte,
// et elle est déjà transcodée. Deux cadres de plus sont donc déclarés sur la MÊME
// occurrence de la maquette (`occurrence: 1`), et les liaisons ci-dessous les
// retournent vers les signalements.
//
// ── CE QUI EST REMPLACÉ, ET PAR QUOI — RIEN N'EST DESSINÉ ICI ───────────────
//
// La planche dessine EXACTEMENT DEUX cartes de proposition, en balisage statique :
// une dépliée (AVANT / APRÈS / Motif / trois boutons) et une repliée avec son
// formulaire de refus. Ce ne peut pas être une liste de signalements — ni par le
// nombre (§2.6 fait basculer un guide à TROIS signalements), ni par la forme (un
// signalement n'a ni avant, ni après, ni décision à prendre).
//
// Les deux cartes sont donc remplacées par LA CARTE DE SECTION À BOUCLE que la
// maquette dessine déjà DEUX fois dans la même section — « HISTORIQUE DES
// VERSIONS » de A04, à 1 440 px, sur la planche du lecteur (ligne 684) ET sur
// celle de l'auteur (ligne 734). C'est, dans tout ce dossier, le seul dessin de
// « titre de section + liste de lignes à deux niveaux, avec une pastille de
// couleur » — c'est-à-dire exactement « une date, et ce qui a été dit ». Chacun de
// ses sept fragments est déclaré en `motifs`, donc vérifié présent dans la maquette
// à chaque génération : si le designer le retouche, la génération s'arrête.
//
// ⚠ LE MÊME EMPRUNT A DÉJÀ ÉTÉ FAIT, et c'est le précédent qui le rend acceptable
// à 390 px : `FEUILLE_VERSIONS` porte ces mêmes fragments de 1 440 px dans la
// feuille du bas de `AuteurMobile`. Les valeurs de dessin (rayon 8 de la pastille,
// 13 px et 11,5 px des deux lignes, écart de 10) sont donc celles de l'ordinateur
// sur les deux planches — relevé, assumé, et remonté : la maquette ne dessine cette
// rangée QU'À 1 440 px, et le piège de ce dépôt (« un motif qui fige une valeur de
// dessin ne décrit qu'un seul cadre ») ne peut pas être évité sans une planche.
// SEULE LA COQUILLE DE CARTE CHANGE de largeur : rayon 22 / retrait 18 à 1 440 px
// (la carte de A04), rayon 20 / retrait 16 à 390 px (la carte que CE cadre dessine
// lui-même, ligne 924).
//
// ⚠ CE QUI RESTE DESSINÉ, ET CE N'EST PAS UN OUBLI : « Mis à jour le 12 mars · 84
// ont trouvé utile » dans la carte « VOTRE GUIDE » de la colonne de droite. Les
// deux valeurs existent (`lastContentUpdateAt`, `helpfulCount`) mais la phrase les
// SOUDE dans un seul nœud avec un format que la maquette n'écrit nulle part
// ailleurs (« 12 mars », sans année, et « 84 ont trouvé utile » au lieu de « 84
// membres ont trouvé utile » de A04). La lier demanderait d'inventer un second
// format de date ; remonté. Elle est aussi dessinée ainsi sur la page
// « Propositions reçues », qui n'est pas de ce lot.

/** La rangée des TROIS onglets de la planche de 1 440 px, verbatim (ligne 891). */
const A06_ONGLETS_WEB = "          <div style=\"display:flex;gap:4px;background:#EEF2F0;border-radius:14px;padding:4px;align-self:flex-start\"><span style=\"padding:9px 16px;border-radius:11px;font-size:13px;font-weight:700;background:#fff\">En attente · 2</span><span style=\"padding:9px 16px;border-radius:11px;font-size:13px;font-weight:700;color:#5D6B66\">Acceptées · 7</span><span style=\"padding:9px 16px;border-radius:11px;font-size:13px;font-weight:700;color:#5D6B66\">Refusées · 1</span></div>";

/** La rangée des trois pastilles d'onglet du cadre de 390 px, verbatim (ligne 922). */
const A06_ONGLETS_MOB = "<div style=\"display:flex;gap:6px;margin-top:12px\"><span style=\"padding:8px 13px;border-radius:999px;background:#16785E;color:#fff;font-size:12.5px;font-weight:700\">En attente · 2</span><span style=\"padding:8px 13px;border-radius:999px;background:#fff;border:1px solid #E6EBE9;font-size:12.5px;font-weight:700\">Acceptées · 7</span><span style=\"padding:8px 13px;border-radius:999px;background:#fff;border:1px solid #E6EBE9;font-size:12.5px;font-weight:700\">Refusées</span></div>";

/**
 * LES DEUX CARTES DE PROPOSITION DE 1 440 px, verbatim, LIGNE BLANCHE COMPRISE.
 *
 * La ligne vide entre les deux cartes fait PARTIE du nœud : `applyData` compte des
 * octets, pas des éléments, et un nœud qui s'arrêterait à la première carte
 * laisserait la seconde sur la page. C'est le premier contrôle d'`applyData` qui le
 * dirait — « figure 0 fois » — et c'est pour cela qu'on l'écrit en entier.
 */
const A06_CARTES_WEB = [
    "            <div style=\"background:#fff;border:1px solid #E6EBE9;border-radius:22px;padding:20px\">",
    "              <div style=\"display:flex;align-items:center;gap:10px\"><span style=\"width:34px;height:34px;border-radius:999px;background:#2FA37D;color:#fff;font-size:10.5px;font-weight:700;display:flex;align-items:center;justify-content:center\">FN</span><span style=\"font-size:14px;font-weight:700\">Fatou Ndiaye</span><svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"#16785E\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"m8 12 3 3 5-6\" stroke=\"#fff\" stroke-width=\"2.2\" fill=\"none\"/></svg><span style=\"font-size:12px;color:#8A958F\">Section 1 · Vérifier votre éligibilité</span><span style=\"flex:1\"></span><span style=\"background:#FBE3D4;color:#B4581F;font-size:11.5px;font-weight:700;padding:5px 11px;border-radius:999px\">11 jours restants</span></div>",
    "              <div style=\"display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px\">",
    "                <div style=\"background:#F6F8F7;border-radius:16px;padding:14px\"><div style=\"font-size:10.5px;font-weight:700;letter-spacing:1px;color:#8A958F\">AVANT</div><div style=\"font-size:14px;line-height:1.6;margin-top:6px\">quel que soit leur pays d'origine, dès <span style=\"background:#EDF1EF;text-decoration:line-through;color:#5D6B66\">l'obtention</span> du VLS-TS</div></div>",
    "                <div style=\"background:#EFF7F3;border-radius:16px;padding:14px\"><div style=\"font-size:10.5px;font-weight:700;letter-spacing:1px;color:#16785E\">APRÈS</div><div style=\"font-size:14px;line-height:1.6;margin-top:6px\">quel que soit leur pays d'origine, dès <span style=\"background:#CFE3DA;border-radius:3px\">la validation</span> du VLS-TS <span style=\"background:#CFE3DA;border-radius:3px\">sur le site de l'ANEF</span></div></div>",
    "              </div>",
    "              <div style=\"font-size:13px;color:#5D6B66;margin-top:12px\"><strong style=\"color:#16211D\">Motif :</strong> La validation en ligne est obligatoire depuis 2025.</div>",
    "              <div style=\"display:flex;gap:8px;margin-top:16px\"><button style=\"height:44px;padding:0 18px;border-radius:14px;background:#16785E;color:#fff;border:none;font:inherit;font-size:13.5px;font-weight:700\">Accepter</button><button style=\"height:44px;padding:0 18px;border-radius:14px;background:#fff;color:#0F5C48;border:1.5px solid #CFE3DA;font:inherit;font-size:13.5px;font-weight:700\">Accepter en modifiant</button><button style=\"height:44px;padding:0 18px;border-radius:14px;background:#F2F5F4;color:#5D6B66;border:none;font:inherit;font-size:13.5px;font-weight:700\">Refuser</button></div>",
    "            </div>",
    "",
    "            <div style=\"background:#fff;border:1px solid #E6EBE9;border-radius:22px;padding:20px\">",
    "              <div style=\"display:flex;align-items:center;gap:10px\"><span style=\"width:34px;height:34px;border-radius:999px;background:#E0733A;color:#fff;font-size:10.5px;font-weight:700;display:flex;align-items:center;justify-content:center\">KB</span><span style=\"font-size:14px;font-weight:700\">Kofi Boateng</span><svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"#16785E\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"m8 12 3 3 5-6\" stroke=\"#fff\" stroke-width=\"2.2\" fill=\"none\"/></svg><span style=\"font-size:12px;color:#8A958F\">Section 1 · Vérifier votre éligibilité</span><span style=\"flex:1\"></span><span style=\"background:#FBE3D4;color:#B4581F;font-size:11.5px;font-weight:700;padding:5px 11px;border-radius:999px\">3 jours restants</span></div>",
    "              <div style=\"display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px\">",
    "                <div style=\"background:#F6F8F7;border-radius:16px;padding:14px\"><div style=\"font-size:10.5px;font-weight:700;letter-spacing:1px;color:#8A958F\">AVANT</div><div style=\"font-size:14px;line-height:1.6;margin-top:6px\">Déposer votre VLS-TS et votre certificat de scolarité<span style=\"background:#EDF1EF;text-decoration:line-through;color:#5D6B66\"> ou votre contrat de travail</span></div></div>",
    "                <div style=\"background:#EFF7F3;border-radius:16px;padding:14px\"><div style=\"font-size:10.5px;font-weight:700;letter-spacing:1px;color:#16785E\">APRÈS</div><div style=\"font-size:14px;line-height:1.6;margin-top:6px\">Déposer votre VLS-TS et votre certificat de scolarité</div></div>",
    "              </div>",
    "              <div style=\"font-size:13px;color:#5D6B66;margin-top:12px\"><strong style=\"color:#16211D\">Motif :</strong> Le contrat de travail ne suffit plus pour un étudiant.</div>",
    "              <div style=\"margin-top:14px;background:#F6F8F7;border-radius:16px;padding:14px\"><div style=\"font-size:12.5px;font-weight:700\">Motif du refus <span style=\"color:#B4581F\">*</span></div><div style=\"margin-top:8px;border:1.5px solid #16785E;border-radius:12px;background:#fff;padding:12px;font-size:13.5px;min-height:60px\">Les deux documents restent acceptés, je préfère garder la liste courte.</div><div style=\"display:flex;gap:8px;margin-top:10px\"><button style=\"height:40px;padding:0 16px;border-radius:12px;background:#16211D;color:#fff;border:none;font:inherit;font-size:13px;font-weight:700\">Confirmer le refus</button><button style=\"height:40px;padding:0 16px;border-radius:12px;background:#fff;border:1px solid #E6EBE9;font:inherit;font-size:13px;font-weight:700\">Annuler</button></div></div>",
    "            </div>",
  ].join('\n');

/** Les deux cartes de proposition du cadre de 390 px, verbatim. */
const A06_CARTES_MOB = [
    "        <div style=\"background:#fff;border:1px solid #E6EBE9;border-radius:20px;padding:16px\">",
    "          <div style=\"display:flex;align-items:center;gap:8px\"><span style=\"width:30px;height:30px;border-radius:999px;background:#2FA37D;color:#fff;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center\">FN</span><span style=\"font-size:13.5px;font-weight:700;flex:1\">Fatou Ndiaye</span><span style=\"background:#FBE3D4;color:#B4581F;font-size:11px;font-weight:700;padding:4px 9px;border-radius:999px\">11 j</span></div>",
    "          <div style=\"background:#F6F8F7;border-radius:14px;padding:12px;margin-top:12px\"><div style=\"font-size:10px;font-weight:700;letter-spacing:1px;color:#8A958F\">AVANT</div><div style=\"font-size:13.5px;line-height:1.55;margin-top:4px\">quel que soit leur pays d'origine, dès <span style=\"background:#EDF1EF;text-decoration:line-through;color:#5D6B66\">l'obtention</span> du VLS-TS</div></div>",
    "          <div style=\"background:#EFF7F3;border-radius:14px;padding:12px;margin-top:8px\"><div style=\"font-size:10px;font-weight:700;letter-spacing:1px;color:#16785E\">APRÈS</div><div style=\"font-size:13.5px;line-height:1.55;margin-top:4px\">quel que soit leur pays d'origine, dès <span style=\"background:#CFE3DA;border-radius:3px\">la validation</span> du VLS-TS <span style=\"background:#CFE3DA;border-radius:3px\">sur le site de l'ANEF</span></div></div>",
    "          <div style=\"font-size:12.5px;color:#5D6B66;margin-top:10px\"><strong style=\"color:#16211D\">Motif :</strong> La validation en ligne est obligatoire depuis 2025.</div>",
    "          <div style=\"display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px\"><button style=\"height:44px;border-radius:12px;background:#16785E;color:#fff;border:none;font:inherit;font-size:13.5px;font-weight:700\">Accepter</button><button style=\"height:44px;border-radius:12px;background:#F2F5F4;border:none;font:inherit;font-size:13.5px;font-weight:700;color:#5D6B66\">Refuser</button></div>",
    "          <button style=\"width:100%;height:42px;margin-top:8px;border-radius:12px;background:#fff;border:1.5px solid #CFE3DA;color:#0F5C48;font:inherit;font-size:13px;font-weight:700\">Accepter en modifiant</button>",
    "        </div>",
    "        <div style=\"background:#fff;border:1px solid #E6EBE9;border-radius:20px;padding:16px\"><div style=\"display:flex;align-items:center;gap:8px\"><span style=\"width:30px;height:30px;border-radius:999px;background:#E0733A;color:#fff;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center\">KB</span><span style=\"font-size:13.5px;font-weight:700;flex:1\">Kofi Boateng</span><span style=\"background:#FBE3D4;color:#B4581F;font-size:11px;font-weight:700;padding:4px 9px;border-radius:999px\">3 j</span></div><div style=\"font-size:12.5px;color:#5D6B66;margin-top:8px\">Section 1 · retrait « ou votre contrat de travail »</div></div>",
  ].join('\n');

/**
 * LES SEPT FRAGMENTS DE LA CARTE À BOUCLE DE A04, déclarés un par un.
 *
 * Ils sont découpés ainsi — et pas en un seul bloc — parce que `fragmentsDeDessin`
 * RETIRE chaque motif de `devient` par une substitution littérale : un motif qui
 * contiendrait les interpolations de la maquette (`{{ v.dot }}`, `{{ v.t }}`) ne se
 * retrouverait pas dans un `devient` où elles sont devenues `{{ f.dot }}` et
 * `{{ f.quand }}`. On déclare donc les morceaux de DESSIN, et l'échafaudage du
 * dialecte est retiré par le mécanisme.
 */
const CARTE_SECTION_WEB =
  '<div style="background:#fff;border:1px solid #E6EBE9;border-radius:22px;padding:18px">';
const CARTE_SECTION_MOB =
  '<div style="background:#fff;border:1px solid #E6EBE9;border-radius:20px;padding:16px">';
const TITRE_SECTION_A04 =
  '<div style="font-size:10.5px;font-weight:700;letter-spacing:1px;color:#8A958F">';
const RANGEE_A04_1 =
  '<div style="display:flex;gap:10px;margin-top:12px;align-items:flex-start">' +
  '<span style="width:8px;height:8px;border-radius:999px;background:';
const RANGEE_A04_2 =
  ';margin-top:6px;flex-shrink:0"></span><span>' +
  '<span style="display:block;font-size:13px;font-weight:600">';
const RANGEE_A04_3 = '</span><span style="display:block;font-size:11.5px;color:#8A958F">';
const RANGEE_A04_4 = '</span></span></div>';

/**
 * LA CARTE DES SIGNALEMENTS, assemblée des fragments ci-dessus.
 *
 * `as="f"` et non `as="s"` : la boucle des RACCOURCIS du rail emploie déjà `s` dans
 * le même cadre (`<sc-for list="{{ shortcuts }}" as="s">`), et deux boucles de même
 * alias dans un cadre donnent deux variables du même nom dans le JSX produit.
 * Relevé sur le cadre, pas supposé.
 *
 * `f.quand` est la DATE du signalement, `f.dit` ce qui a été écrit — et `f.dot` la
 * pastille. Jamais de nom, jamais d'initiales, jamais d'avatar : voir
 * `guideOutdatedFlagsResponseSchema`, qui ne rend que deux colonnes.
 */
const CARTE_SIGNALEMENTS = (coquille) =>
  coquille +
  TITRE_SECTION_A04 +
  '{{ signalements.libelle }}</div>' +
  '<sc-for list="{{ signalements.items }}" as="f" hint-placeholder-count="3">' +
  RANGEE_A04_1 +
  '{{ f.dot }}' +
  RANGEE_A04_2 +
  '{{ f.quand }}' +
  RANGEE_A04_3 +
  '{{ f.dit }}' +
  RANGEE_A04_4 +
  '</sc-for></div>';

/** Les motifs, DANS L'ORDRE où `fragmentsDeDessin` les retirera. */
const MOTIFS_CARTE_SIGNALEMENTS = (coquille) => [
  coquille,
  TITRE_SECTION_A04,
  '</div>',
  RANGEE_A04_1,
  RANGEE_A04_2,
  RANGEE_A04_3,
  RANGEE_A04_4,
  '</div>',
];

/**
 * LA PASTILLE D'ONGLET DEVIENT UN COMPTE, et c'est le seul emploi honnête qu'on
 * puisse lui donner ici.
 *
 * La planche dessine TROIS onglets — « En attente · 2 », « Acceptées · 7 »,
 * « Refusées · 1 » — qui sont les trois états d'une PROPOSITION (§2.4). Un
 * signalement d'obsolescence n'a pas d'état : il est posé, ou retiré par son
 * auteur. Garder trois onglets aurait été trois filtres qui ne filtrent rien.
 *
 * La PREMIÈRE pastille reste, avec son dessin (fond blanc à 1 440 px, fond vert à
 * 390 px — relevé, les deux planches ne la dessinent pas pareil), et son texte
 * devient le compte. Les deux autres tombent : `fragmentsDeDessin` ne peut pas s'en
 * plaindre — ce qui reste de `devient` est fait de fragments de `noeud` — et le
 * premier contrôle garantit que la rangée entière est bien celle qu'on croit.
 */
const ONGLET_COMPTE = (onglets) => {
  const fin = onglets.indexOf('>En attente · 2<');
  return onglets.slice(0, fin + 1) + '{{ signalements.compte }}</span></div>';
};

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


  // ── LE CADRE DE 1 440 px — IL NE LISAIT QUE LA NAVIGATION ────────────────
  //
  // MESURÉ avant ce lot sur `a06/desktop.generated.tsx` : sa ligne de
  // destructuration était `{ guide, panelGuides, rail, shortcuts }`. Donc, sur la
  // page « Propositions reçues » de n'importe quel auteur, l'ordinateur affichait
  // « Fatou Ndiaye · 11 jours restants », « Kofi Boateng · 3 jours restants », le
  // titre de la maquette dans son fil d'Ariane ET dans sa carte « VOTRE GUIDE », et
  // « En attente · 2 / Acceptées · 7 ». Les prises existaient, et ce cadre-là ne les
  // lisait pas — c'est exactement le piège 5 du mémo (« une liaison qui ne nomme
  // qu'un cadre laisse les autres mentir »), payé une fois de plus.
  //
  // Les huit liaisons qui suivent sont les SŒURS de celles de `Mobile`, relevées
  // sur LE CADRE DE 1 440 px : rien n'est recopié d'un cadre à l'autre, parce que
  // les deux planches ne dessinent ni les mêmes pastilles (34 px contre 30), ni le
  // même délai (« 11 jours restants » contre « 11 j »), ni le même motif sur la
  // seconde carte.
  {
    noeud: '>Obtenir la garantie Visale sans CDI<',
    devient: '>{{ guide.title }}<',
    fois: 2,
    frames: ['Desktop'],
    why: 'Le titre du guide dont on relit les propositions — écrit DEUX fois sur cette planche (fil d’Ariane et carte « VOTRE GUIDE »), et les deux étaient le titre de la maquette.',
  },
  {
    noeud: '>En attente · 2<',
    devient: '>En attente · {{ propositionsCompte.attente }}<',
    fois: 1,
    frames: ['Desktop'],
    why: 'Les propositions en attente — `PENDING` et `ESCALATED`, les deux seuls états qui attendent une décision (§2.4). Le compte est DÉRIVÉ de la liste : la réponse ne porte aucun `meta` de comptage.',
  },
  {
    noeud: '>Acceptées · 7<',
    devient: '>Acceptées · {{ propositionsCompte.acceptees }}<',
    fois: 1,
    frames: ['Desktop'],
    why: 'Les propositions acceptées (`ACCEPTED` et `AMENDED`), dérivées du même statut.',
  },
  {
    noeud: AVATAR_PROPOSANT_WEB('#2FA37D', 'FN'),
    devient: AVATAR_PROPOSANT_WEB('{{ propositionDepliee.bg }}', '{{ propositionDepliee.i }}'),
    fois: 1,
    frames: ['Desktop'],
    why: 'L’avatar du proposant de la PREMIÈRE carte, de `GET /guides/:id/proposals`.',
  },
  {
    noeud: '>Fatou Ndiaye<',
    devient: '>{{ propositionDepliee.proposant }}<',
    fois: 1,
    frames: ['Desktop'],
    why: 'Le nom du proposant de la première carte.',
  },
  {
    noeud: '>11 jours restants<',
    devient: '>{{ propositionDepliee.delaiLong }}<',
    fois: 1,
    frames: ['Desktop'],
    why: 'Le délai avant escalade AU LONG — la planche de 1 440 px écrit « 11 jours restants » là où celle de 390 px abrège « 11 j ». Deux dessins, une seule arithmétique (`joursAvantEscalade`).',
  },
  {
    noeud: ' La validation en ligne est obligatoire depuis 2025.<',
    devient: ' {{ propositionDepliee.motif }}<',
    fois: 1,
    frames: ['Desktop'],
    why: 'Le motif de la proposition (`reason`) — obligatoire, au moins `GUIDE_PROPOSAL_REASON_MIN` caractères.',
  },
  {
    noeud: AVATAR_PROPOSANT_WEB('#E0733A', 'KB'),
    devient: AVATAR_PROPOSANT_WEB('{{ propositionRepliee.bg }}', '{{ propositionRepliee.i }}'),
    fois: 1,
    frames: ['Desktop'],
    why: 'L’avatar du proposant de la SECONDE carte.',
  },
  {
    noeud: '>Kofi Boateng<',
    devient: '>{{ propositionRepliee.proposant }}<',
    fois: 1,
    frames: ['Desktop'],
    why: 'Le nom du proposant de la seconde carte.',
  },
  {
    noeud: '>3 jours restants<',
    devient: '>{{ propositionRepliee.delaiLong }}<',
    fois: 1,
    frames: ['Desktop'],
    why: 'Son délai avant escalade, au long comme son voisin.',
  },
  {
    noeud: ' Le contrat de travail ne suffit plus pour un étudiant.<',
    devient: ' {{ propositionRepliee.motif }}<',
    fois: 1,
    frames: ['Desktop'],
    why: 'Le motif de la seconde proposition. ⚠ RELEVÉ, PAS SUPPOSÉ : à 390 px la carte repliée écrit un RÉSUMÉ de section à cette place, pas un motif — les deux cadres lisent la même prise, qui porte `reason`.',
  },

  // ── LES DEUX CADRES « SIGNALEMENTS » — voir le grand en-tête ci-dessus ────
  {
    noeud: '>Propositions reçues<',
    devient: '>{{ signalements.titre }}<',
    fois: 1,
    frames: ['SignalementsDesktop', 'SignalementsMobile'],
    why: 'Le titre de la page empruntée. Le libellé est celui de la carte d’auteur de A04 à 1 440 px (« Signalements « a changé » ») — emprunté, pas rédigé.',
  },
  {
    noeud: '>Obtenir la garantie Visale sans CDI<',
    devient: '>{{ guide.title }}<',
    fois: 2,
    frames: ['SignalementsDesktop'],
    why: 'Le guide dont on relit les signalements : son titre est écrit DEUX fois sur cette planche — dans le fil d’Ariane et dans la carte « VOTRE GUIDE » — et les deux étaient le titre de la maquette.',
  },
  {
    noeud: A06_ONGLETS_WEB,
    devient: ONGLET_COMPTE(A06_ONGLETS_WEB),
    fois: 1,
    frames: ['SignalementsDesktop'],
    why: 'Les trois onglets sont les trois états d’une PROPOSITION (§2.4) ; un signalement d’obsolescence n’a pas d’état. La première pastille garde son dessin et porte le compte.',
  },
  {
    noeud: A06_ONGLETS_MOB,
    devient: ONGLET_COMPTE(A06_ONGLETS_MOB),
    fois: 1,
    frames: ['SignalementsMobile'],
    why: 'La même rangée sur 390 px, où la maquette dessine la pastille active en VERT et non en blanc — relevé sur les octets, pas supposé régulier.',
  },
  {
    noeud: A06_CARTES_WEB,
    devient: CARTE_SIGNALEMENTS(CARTE_SECTION_WEB),
    motifs: MOTIFS_CARTE_SIGNALEMENTS(CARTE_SECTION_WEB),
    from: 'docs/template/03 Accueil v2.dc.html',
    fois: 1,
    frames: ['SignalementsDesktop'],
    why: 'Les deux cartes de proposition laissent place à la carte de section À BOUCLE que la maquette dessine deux fois dans cette même section (« HISTORIQUE DES VERSIONS » de A04) : c’est le seul dessin de « date + ce qui a été dit » du dossier.',
  },
  {
    noeud: A06_CARTES_MOB,
    devient: CARTE_SIGNALEMENTS(CARTE_SECTION_MOB),
    motifs: MOTIFS_CARTE_SIGNALEMENTS(CARTE_SECTION_MOB),
    from: 'docs/template/03 Accueil v2.dc.html',
    fois: 1,
    frames: ['SignalementsMobile'],
    why: 'La même liste à 390 px. Seule la COQUILLE change — rayon 20, retrait 16, celle que ce cadre dessine lui-même — parce que la carte de 1 440 px (rayon 22, retrait 18) n’est pas celle du téléphone.',
  },
  {
    noeud:
      '>Vous avez 14 jours pour répondre à chaque proposition. Sans réponse, elle est transmise à la modération. Chaque proposition acceptée crédite son auteur comme contributeur.<',
    devient: '>{{ signalements.aide }}<',
    fois: 1,
    frames: ['SignalementsDesktop'],
    why: 'La carte « COMMENT ÇA MARCHE » explique le délai de 14 jours des PROPOSITIONS (§2.4) ; sur la page des signalements elle doit expliquer le seuil de trois et le délai de dépublication (§2.6). Le texte vient de `guides/from-api.ts`, pas d’ici.',
  },
];

/**
 * ════════════════════════════════════════════════════════════════════════════
 * `liens` — LA MOITIÉ DE LA NAVIGATION QUE LE COMPTEUR NE VOIT PAS
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Le récapitulatif « ── NAVIGATION ── » compte les `href="#"`. Il en comptait
 * QUATRE-VINGT-CINQ sur ce module. C'est la moitié du problème, et pas la plus
 * grosse : sur les dix-sept cadres MOBILES de cette maquette, le compteur
 * annonçait ZÉRO lien mort — parce que ces cadres ne portent pas UNE SEULE balise
 * `<a>`. Compté : `grep -c '<a ' a01/mobile.generated.tsx` → 0.
 *
 * Or c'est là que vit toute la navigation du téléphone :
 *
 *   · LA BARRE D'ONGLETS BASSE — Accueil · Parcours · Entraide · Services ·
 *     Compte — dessinée en `<div>`, DIX-SEPT FOIS dans cette maquette (une par
 *     cadre mobile qui la porte), soit 85 affordances. Le porteur a cliqué là.
 *   · LA BARRE D'ONGLETS DE SECTION du fil — sept pastilles en `<span>`.
 *   · LES BARRES D'ONGLETS DU RÉSEAU ET DE LA FICHE VILLE — vingt-et-une barres,
 *     toutes en `<span>`, sur l'ordinateur comme sur le téléphone.
 *
 * Ce ne sont pas des liens cassés : CE NE SONT PAS DES LIENS. Le compteur ne
 * bougera donc pas d'une unité pour la plupart de ce qui suit, et c'est le signe
 * que la mesure du compteur était la mauvaise.
 */

/**
 * ─── LA BARRE D'ONGLETS BASSE, ET POURQUOI SA TABLE N'EST PAS ICI ───────────
 *
 * `barreBasse` et `barreBasseBoucle` viennent de `tools/squelette-membre.mjs` :
 * la barre est RIGOUREUSEMENT la même sur les 54 cadres mobiles des sept modules
 * membre, et une table par module aurait donné sept endroits où corriger une
 * route. Le lot de Parcours, Entraide, Services et Agenda l'avait posée dans un
 * `tools/barre-basse.mjs` à part pour ne pas collisionner avec ce lot-ci, en
 * écrivant lui-même qu'elle appartenait au squelette ; la fusion est faite, et le
 * fichier intermédiaire a disparu.
 *
 * CETTE MAQUETTE EST LA SEULE À L'ÉCRIRE DE DEUX FAÇONS, et c'est pour cela que le
 * squelette exporte deux fonctions :
 *
 *   · le cadre mobile de A01 la construit en BOUCLE (`<sc-for list="{{ mBottom }}"
 *     as="b">`) : une entrée de maquette, cinq lignes au rendu, donc AUCUN libellé
 *     à distinguer. La destination voyage avec la donnée (`b.href`), comme pour le
 *     rail en boucle de cette même maquette → `barreBasseBoucle` ;
 *   · les seize autres cadres mobiles de ce module l'écrivent EN CLAIR, comme les
 *     53 autres cadres du dépôt → `barreBasse`, dont le marqueur est
 *     `</svg>Libellé</div>`.
 *
 * Compté sur la maquette : 18 barres, 1 en boucle et 17 littérales, dont 16 dans
 * des cadres que ce module déclare.
 */

/**
 * ─── LA BARRE D'ONGLETS DE SECTION DU FIL (mobile de A01) ───────────────────
 *
 * Sept pastilles en `<span>`, en boucle (`<sc-for list="{{ mTabs }}" as="t">`).
 * Ce sont les SEPT MÊMES PAGES que le panneau « COMMUNAUTÉ » de l'ordinateur ;
 * les routes sont dans `screens/a01/data.ts`, reprises de `PANEL_ITEMS`.
 *
 * Le marqueur est le LIBELLÉ et non l'icône, parce que ces pastilles n'ont pas
 * d'icône : la maquette n'y dessine qu'un texte et un compteur. `{{ t.label }}`
 * est enfermé directement dans le `<span>` de la pastille, donc la remontée s'y
 * arrête — ce qui est exactement la cible voulue. Vérifié UNE SEULE occurrence
 * dans ce cadre (`postTypes`, l'autre boucle en `as="t"` de cette section, n'est
 * que sur le cadre d'ordinateur, et ses contrôles sont déjà des `<button>`).
 */
const ONGLETS_SECTION_MOBILE = [
  {
    marqueur: '{{ t.label }}',
    vers: '{{ t.href }}',
    frames: ['Mobile'],
    why:
      'Les sept onglets de section du téléphone sont UNE entrée de maquette dans ' +
      '`<sc-for as="t">`. Même raison que le rail : la destination est une donnée ' +
      '(`t.href`), et ce sont les sept routes du panneau COMMUNAUTÉ.',
  },
];

/**
 * ─── LES ONGLETS DU RÉSEAU : UNE DESTINATION RELATIVE, ET POURQUOI ──────────
 *
 * `/reseaux/:slug` choisit son onglet par `?onglet=` — c'est la page qui le lit
 * (`app/(app)/reseaux/[slug]/page.tsx`), et `SLUGS` dans `reseau-screen.tsx`
 * donne les six noms : `fil`, `sujets`, `evenements`, `membres`, `album`,
 * `a-propos`. Les six libellés de la barre sont dans le même ordre
 * (`NET_TABS`, `screens/reseaux/chrome.ts`).
 *
 * LA DESTINATION EST ÉCRITE RELATIVE — `?onglet=fil` — et ce n'est pas une
 * commodité : le SLUG DU RÉSEAU n'est dessiné nulle part dans ces planches, et il
 * n'est pas dans leur prise (`A08TData` ne porte que l'en-tête). Une destination
 * absolue demanderait donc de l'INVENTER. Une requête seule se résout contre
 * l'URL courante en gardant son chemin : depuis `/reseaux/pays-bj?onglet=fil`,
 * `?onglet=membres` donne `/reseaux/pays-bj?onglet=membres`. C'est la destination
 * que la maquette dessine, sans rien ajouter.
 *
 * ── « SUJETS » NE PORTE PAS `&vue=proprietaire`, ET C'EST MESURÉ ────────────
 *
 * `PROPRIETAIRE` (dans `reseau-screen.tsx`) n'a AUCUNE entrée `sujets` : la
 * maquette ne dessine pas de planche « Sujets — propriétaire ». Avec
 * `?onglet=sujets&vue=proprietaire`, `tab` vaut `undefined`, `plain` est faux
 * parce qu'on est propriétaire, et l'écran rend `null` — une page BLANCHE. Le lien
 * mène donc à `?onglet=sujets` tout court, qui est la seule vue « Sujets » que la
 * maquette dessine (A08 lui-même). Le passage en vue membre est le prix de ce
 * manque de maquette, et il est REMONTÉ plutôt que caché.
 */
const ONGLETS_RESEAU = [
  ['Fil', 'fil'],
  ['Sujets', 'sujets'],
  ['Événements', 'evenements'],
  ['Membres', 'membres'],
  ['Album', 'album'],
  ['À propos', 'a-propos'],
];

/** La barre d'onglets du réseau sur les planches d'ordinateur de A08T. */
const BARRE_ONGLETS_RESEAU_WEB =
  '<div style="display:flex;gap:2px;padding:0 16px;border-top:1px solid #EAEEEC">';

/** La même barre sur les planches mobiles de MOB2. */
const BARRE_ONGLETS_RESEAU_MOBILE =
  '<div style="display:flex;gap:2px;padding:0 10px;margin-top:10px;' +
  'border-bottom:1px solid #E6EBE9;overflow:hidden;flex-shrink:0">';

/**
 * @param dans   le conteneur de la barre, pour borner la recherche du libellé
 * @param frames les cadres concernés
 * @param vue    'proprietaire' quand la planche est une vue propriétaire
 */
const ongletsReseau = (dans, frames, vue = null) =>
  ONGLETS_RESEAU.map(([texte, onglet]) => {
    // Voir l'en-tête : « Sujets » n'existe pas en vue propriétaire, et un lien qui
    // mène à une page blanche est pire qu'un lien mort.
    const garderLaVue = vue !== null && onglet !== 'sujets';
    const vers = garderLaVue ? `?onglet=${onglet}&vue=${vue}` : `?onglet=${onglet}`;
    return {
      dans,
      texte,
      vers,
      frames,
      why:
        `L’onglet « ${texte} » du réseau mène à ${vers} — la page lit la requête et choisit ` +
        'la planche (`reseau-screen.tsx`). Destination RELATIVE : le slug du réseau n’est ni ' +
        'dessiné ni dans la prise de ces planches, et l’inventer serait décider du réseau. ' +
        'La maquette dessine ces onglets en <span> : ce n’étaient pas des liens.',
    };
  });

/**
 * ─── LES ONGLETS DU RÉSEAU EN BOUCLE (A08, les deux largeurs) ───────────────
 *
 * A08 est le seul écran du module à construire cette barre par une boucle
 * (`<sc-for list="{{ netTabs }}" as="t">`) : la destination voyage donc avec la
 * donnée (`t.href`, posé par `netTabsFor` dans `screens/reseaux/chrome.ts`), comme
 * pour le rail. Les deux conteneurs diffèrent — la planche d'ordinateur écrit
 * `gap:4px;padding:0 20px`, la mobile `gap:4px;padding:0 12px` — donc un `dans`
 * par cadre.
 *
 * `topics`, l'autre boucle en `as="t"` de ces cadres, emploie `{{ t.title }}` et
 * non `{{ t.label }}` : le marqueur reste univoque, et le `dans` le borne de toute
 * façon.
 */
const ONGLETS_RESEAU_BOUCLE = [
  {
    dans: '<div style="display:flex;gap:4px;padding:0 20px;border-top:1px solid #EAEEEC">',
    marqueur: '{{ t.label }}',
    vers: '{{ t.href }}',
    frames: ['Desktop'],
    why:
      'Les six onglets du réseau sont UNE entrée de maquette dans `<sc-for as="t">` sur A08 : ' +
      'la destination est une donnée (`t.href` = `?onglet=…`, posée par `netTabsFor`).',
  },
  /**
   * LE CADRE MOBILE DE A08 ÉCRIT SA BARRE EN CLAIR, et seulement CINQ onglets :
   * « À propos » y manque, écart de maquette déjà relevé avec le bloc `donnees`
   * de A08. Les cinq libellés sont donc promus un par un ICI, et c'est leur forme
   * PROMUE que le `noeud` de ce bloc retrouve ensuite — voir l'en-tête de
   * `ONGLET_RESEAU_MOBILE`.
   */
  ...ONGLETS_RESEAU.filter(([, onglet]) => onglet !== 'a-propos').map(([texte, onglet]) => ({
    dans:
      '<div style="display:flex;gap:4px;padding:0 12px;margin-top:12px;' +
      'border-bottom:1px solid #E6EBE9;overflow:hidden;flex-shrink:0">',
    texte,
    vers: `?onglet=${onglet}`,
    frames: ['Mobile'],
    why:
      `L’onglet « ${texte} » du réseau sur le cadre mobile de A08, écrit EN CLAIR par la ` +
      'maquette : destination relative, pour la raison dite plus haut — le slug du réseau ' +
      'n’est pas dessiné.',
  })),
];

/**
 * ─── LES ONGLETS DE LA FICHE VILLE ──────────────────────────────────────────
 *
 * Quatre onglets, et la page lit `?onglet=` exactement comme celle du réseau
 * (`app/(app)/villes/[slug]/page.tsx`). Trois formes de dessin, donc trois
 * conteneurs, et c'est la maquette qui en décide :
 *
 *   · A12 Desktop — une BOUCLE native (`<sc-for list="{{ cityTabs }}" as="t">`) :
 *     la destination voyage avec la donnée, comme le rail ;
 *   · A12 Mobile — quatre PASTILLES écrites en clair ;
 *   · les trois planches A12T — quatre onglets soulignés sur l'ordinateur, quatre
 *     pastilles sur le téléphone, tous écrits en clair.
 *
 * Les formes écrites en clair sont promues ICI, et c'est leur forme PROMUE que les
 * blocs `donnees` retrouvent ensuite : voir l'en-tête de `ONGLET_RESEAU_MOBILE`.
 */
const ongletsVille = (dans, frames) =>
  ONGLETS_VILLE.map(([texte, onglet]) => ({
    dans,
    texte,
    vers: `?onglet=${onglet}`,
    frames,
    why:
      `L’onglet « ${texte} » de la fiche ville mène à ?onglet=${onglet} — la page lit la ` +
      'requête et choisit la planche (`ville-screen.tsx`). Destination RELATIVE : le slug de ' +
      'la ville n’est pas dessiné sur ces planches. La maquette les dessine en <span> : ce ' +
      'n’étaient pas des liens.',
  }));

/** Le conteneur des quatre onglets soulignés, sur les planches A12T d'ordinateur. */
const BARRE_ONGLETS_VILLE_WEB =
  '<div style="background:#fff;border:1px solid #E6EBE9;border-radius:22px;' +
  'display:flex;align-items:center;gap:4px;padding:0 12px 0 20px">';

/** Le conteneur des quatre pastilles, sur les planches A12T mobiles. */
const BARRE_ONGLETS_VILLE_MOBILE =
  '<div style="display:flex;gap:6px;padding:10px 16px;overflow:hidden;flex-shrink:0">';

/** Celui du cadre mobile de A12 : la maquette ne lui met aucun remplissage. */
const BARRE_ONGLETS_VILLE_A12_MOBILE =
  '<div style="display:flex;gap:6px;overflow:hidden;flex-shrink:0">';

/** Les cinq planches d'onglet du réseau en VUE MEMBRE, sur l'ordinateur. */
const A08T_MEMBRE_WEB = ['Fil', 'Evenements', 'Membres', 'Album', 'APropos'];

/** Les sept planches en VUE PROPRIÉTAIRE qui portent la barre d'onglets. */
const A08T_PROPRIETAIRE_WEB = [
  'AdminFil',
  'AdminMembres',
  'AdminEvenements',
  'AdminAlbum',
  'AdminAPropos',
  'AdminAProposEdition',
  'AdminGerer',
];

/** Les planches mobiles qui portent la barre d'onglets, par vue. */
const A08T_MEMBRE_MOBILE = [
  'FilMobile',
  'EvenementsMobile',
  'MembresMobile',
  'AlbumMobile',
  'AProposMobile',
];
const A08T_PROPRIETAIRE_MOBILE = [
  'AdminFilMobile',
  'AdminMembresMobile',
  'AdminEvenementsMobile',
  'AdminAlbumMobile',
];

/**
 * Les planches mobiles de A08T qui portent la BARRE BASSE. Ce n'est pas la même
 * liste que celles qui portent la barre d'onglets : « Membres — propriétaire » a
 * la barre d'onglets et pas la barre basse, et c'est la maquette qui en décide.
 * Mesuré planche par planche ; le `dans` de `markLinks` recompte à chaque
 * génération et arrêterait tout si la liste tombait fausse.
 */
const A08T_BARRE_BASSE = [
  'FilMobile',
  'EvenementsMobile',
  'MembresMobile',
  'AlbumMobile',
  'AProposMobile',
  'AdminFilMobile',
  'AdminEvenementsMobile',
  'AdminAlbumMobile',
];

/**
 * ─── CE QUE CHAQUE ÉCRAN AJOUTE AU SQUELETTE ────────────────────────────────
 *
 * Les clés sont les sections, et chaque entrée est la navigation PROPRE à cet
 * écran : sa barre basse, ses onglets, et ses liens nommés un par un.
 *
 * CE QUI N'Y EST PAS, ET QU'IL FAUT LIRE COMME UN MANQUE REMONTÉ :
 *
 *   · « Réglages » (bas du rail), « Compte » (barre basse) — aucune route
 *     `/compte` n'existe. Déjà remonté par le lot du squelette ;
 *   · « Voir mon profil public » — la route est `/@:handle` et la maquette
 *     n'écrit AUCUN handle sur cette carte ; le cadre n'en a pas de prise ;
 *   · « Continuer » de la carte MON PARCOURS — `/parcours/:id` demande un
 *     identifiant que la maquette ne dessine pas (elle écrit « Mes études à
 *     Lyon », un nom, pas une adresse) ;
 *   · « Modifier » de VOS RACCOURCIS et les trois raccourcis eux-mêmes — T5 §0
 *     dit « mes réseaux », donc `/reseaux/:slug`, mais aucun slug n'est dessiné
 *     ni porté par la donnée (`shortcuts` n'a que `name`, `sub`, `i`, `bg`) ;
 *   · « Répondre », « Signaler », « Voir 3 autres commentaires » (A01C, A02) —
 *     ce sont des ACTIONS dans la page, pas des destinations, et aucune route ne
 *     leur correspond ;
 *   · « Lire le guide » (A03), « Voir le guide » (A06), « Propositions reçues »
 *     et « Signalements » (A04), le fil d'Ariane de A06 et de A09, « Réseau Lyon
 *     et Rhône » (A12) — la destination EST dessinée (`/guides/:slug`,
 *     `/reseaux/:slug`…) mais le SLUG n'est ni dessiné ni porté par la prise du
 *     cadre. Deux de ces liens sont branchés ci-dessous, ceux dont la donnée
 *     porte déjà l'identifiant ; les autres sont REMONTÉS.
 */
const LIENS_PAR_ECRAN = {
  A01: [
    ...barreBasseBoucle(['Mobile']),
    ...ONGLETS_SECTION_MOBILE,
    {
      texte: 'Voir tout',
      vers: '/agenda',
      frames: ['Desktop'],
      why:
        'Le « Voir tout » de la carte « ÉVÉNEMENTS À LYON » mène à /agenda : c’est la page des ' +
        'événements, celle-là même que l’entrée « Événements » du panneau COMMUNAUTÉ adresse ' +
        'déjà (T5 §0). Écrit une seule fois dans ce cadre, vérifié.',
    },

    /**
     * ╔══════════════════════════════════════════════════════════════════════════╗
     * ║ « CRÉER UNE STORY » — LE LIEN QUE LE COMPTEUR NE VOYAIT PAS              ║
     * ╚══════════════════════════════════════════════════════════════════════════╝
     *
     * C'est la demande du porteur, capture en main : « Sur la création du stories
     * et ça envoie vers la section A14 ». La destination est `/stories/nouvelle`,
     * la route qui sert A14 (`app/(app)/stories/nouvelle/page.tsx`).
     *
     * IL N'A JAMAIS FIGURÉ DANS LES 129 LIENS MORTS, et c'est la raison pour
     * laquelle il avait survécu à tous les lots de navigation : la maquette ne le
     * dessine pas en `<a href="#">` mais en `<span>`. Ce n'est donc pas un lien
     * cassé — CE N'EST PAS UN LIEN. Le compteur de `href="#"` est aveugle à ces
     * cas, exactement comme il l'était aux cinq `<span>` du rail littéral.
     *
     * ── DEUX LIENS PAR CADRE, ET NON UN : C'EST LA REMONTÉE QUI L'IMPOSE ──────
     *
     * La tuile dessinée contient DEUX éléments frères : le rond pointillé qui porte
     * le « + », et le libellé en dessous. `markLinks` remonte du marqueur jusqu'au
     * PREMIER élément promouvable qui le contient — donc il atteint l'un ou l'autre
     * de ces deux `<span>`, jamais le `<div>` de la tuile qui les englobe : les
     * spans interceptent la remontée. Le `<div>` est pourtant promouvable ; il est
     * simplement INATTEIGNABLE par ce mécanisme.
     *
     * Ne promouvoir que le libellé laisserait le ROND inerte — or le rond est
     * l'affordance principale, c'est lui que le porteur a montré dans sa capture et
     * c'est lui qu'on clique. Les deux sont donc déclarés, et la tuile entière
     * répond.
     *
     * CE QUE ÇA COÛTE, et qui est assumé : un lecteur d'écran annonce DEUX liens
     * vers la même adresse là où un seul suffirait. Ce n'est aucune violation (axe
     * n'a pas de règle là-dessus) et c'est le prix d'une tuile dont la maquette
     * sépare l'icône du texte. L'alternative — un seul lien sur le libellé, et un
     * rond mort — est ce que le porteur vient précisément de signaler.
     *
     * LE MARQUEUR DU ROND EST SON POINTILLÉ, et c'est mesuré : le tracé « + »
     * (`M12 5v14M5 12h14`) figure DEUX fois dans le cadre d'ordinateur, et la tuile
     * de 92 px aussi — les stories de la bande sont dessinées avec la même
     * géométrie, dans une boucle. `border:1.5px dashed #9FB3AB` ne figure qu'UNE
     * fois par cadre : il n'y a qu'un rond à créer, les autres portent des photos.
     * Le marqueur tombe dans le style du `<span>` lui-même, donc la remontée
     * s'arrête sur ce span — le rond.
     */
    {
      marqueur: 'border:1.5px dashed #9FB3AB',
      vers: '/stories/nouvelle',
      nom: 'Créer une story',
      frames: ['Desktop'],
      why:
        'Le rond « + » de la bande STORIES DU JOUR mène au composeur, /stories/nouvelle. Il ne ' +
        'contient qu’un tracé SVG : son nom accessible est DÉCLARÉ, et il est recopié du libellé ' +
        'que la maquette écrit juste dessous (« Créer une story »), jamais inventé.',
    },
    /**
     * LE DISCRIMINANT EST CHEVRONNÉ, ET C'EST LE GARDE-FOU QUI L'A EXIGÉ.
     *
     * Déclaré `texte: 'Créer une story'`, ce lien a fait REFUSER la génération :
     * « désigne 2 élément(s) promouvable(s) […] et la déclaration en attend 1 ».
     * La cause est le lien du rond, juste au-dessus : il pose
     * `aria-label="Créer une story"`, et cette chaîne contient donc le texte
     * cherché. Le second lien remontait alors aussi bien depuis le libellé que
     * depuis l'attribut du premier.
     *
     * `>Créer une story<` borne le discriminant au NŒUD DE TEXTE. C'est la même
     * précaution que `>Créer<` sur le cadre mobile, et elle vaut d'être notée : un
     * mécanisme qui pose des noms accessibles crée des cibles pour celui qui
     * cherche des textes. Le garde-fou de comptage l'a vu tout seul — c'est
     * exactement ce pour quoi il existe.
     */
    {
      texte: '>Créer une story<',
      vers: '/stories/nouvelle',
      frames: ['Desktop'],
      why:
        'Le libellé de la même tuile, promu lui aussi pour que toute la tuile réponde et pas ' +
        'seulement le rond. Écrit une seule fois dans ce cadre, vérifié.',
    },

    /**
     * LE MÊME GESTE SUR LE CADRE MOBILE, et il avait été manqué par mon diagnostic
     * comme par le compteur.
     *
     * Le cadre de 390 px dessine la MÊME tuile de création dans sa bande de
     * stories — rond pointillé de 60 px et libellé — mais son libellé est
     * « Créer » et non « Créer une story » : la maquette le raccourcit à cette
     * largeur, comme elle raccourcit « politique de confidentialité » en
     * « confidentialité » sur P01. Un lot qui n'aurait regardé que le texte long
     * aurait laissé le mobile inerte.
     *
     * Le discriminant est `>Créer<` et non `Créer` : le mot seul figure TROIS fois
     * dans ce cadre (il est contenu dans d'autres libellés), les chevrons le
     * bornent au nœud de texte complet, et il n'y figure alors qu'une fois.
     */
    {
      marqueur: 'border:1.5px dashed #9FB3AB',
      vers: '/stories/nouvelle',
      nom: 'Créer une story',
      frames: ['Mobile'],
      why:
        'Le rond « + » de la bande de stories du cadre mobile, même destination. Le nom ' +
        'accessible reprend le libellé long de la planche d’ordinateur : « Créer » seul ne dirait ' +
        'pas créer QUOI, et c’est un texte que la maquette écrit bien, ailleurs, pour ce geste.',
    },
    {
      texte: '>Créer<',
      vers: '/stories/nouvelle',
      frames: ['Mobile'],
      why:
        'Le libellé raccourci de la tuile de création, à 390 px. Les chevrons bornent le ' +
        'discriminant au nœud de texte : « Créer » seul figure trois fois dans ce cadre.',
    },
  ],
  A02: [
    {
      texte: "Fil d'actualité",
      vers: '/accueil',
      frames: ['Desktop'],
      why:
        'Le fil d’Ariane de la publication remonte au fil d’actualité, /accueil — la même page ' +
        'que l’entrée homonyme du panneau COMMUNAUTÉ. Écrit une seule fois en clair dans ce ' +
        'cadre : le panneau, lui, écrit `{{ m.label }}`.',
    },
  ],
  A03: [
    ...barreBasse(['Mobile']),
    {
      texte: 'Lire le guide',
      vers: '{{ g.href }}',
      frames: ['Desktop'],
      why:
        'Le « Lire le guide » d’une carte mène à /guides/:slug. Le slug n’est pas DESSINÉ — la ' +
        'maquette écrit un titre, pas une adresse — mais il est RENDU par `GET /guides`, donc ' +
        'la destination voyage avec la donnée (`g.href`, posée par `guideCardFrom`). Écrit une ' +
        'seule fois : il est DANS la boucle des cartes, et la maquette ne l’écrit qu’une fois. ' +
        'LE CADRE MOBILE N’EST PAS CONCERNÉ : il ne dessine aucun libellé, la carte ENTIÈRE est ' +
        'l’affordance, et `markLinks` ne sait pas promouvoir un conteneur — sa remontée s’arrête ' +
        'au premier élément promouvable, qui est le titre. REMONTÉ.',
    },
  ],
  A07: barreBasse(['Mobile']),
  A08: [...barreBasse(['Mobile']), ...ONGLETS_RESEAU_BOUCLE],
  A11: barreBasse(['MobileCarte']),
  A12: [
    ...barreBasse(['Mobile']),
    {
      dans: '<div style="display:flex;gap:4px;padding:0 20px;border-bottom:1px solid #EAEEEC">',
      marqueur: '{{ t.label }}',
      vers: '{{ t.href }}',
      frames: ['Desktop'],
      why:
        'Les quatre onglets de la fiche ville sont UNE entrée de maquette dans ' +
        '`<sc-for as="t">` sur la planche d’ordinateur de A12 : la destination est une donnée ' +
        '(`t.href` = `?onglet=…`, posée par `cityTabsFor`).',
    },
    ...ongletsVille(BARRE_ONGLETS_VILLE_A12_MOBILE, ['Mobile']),
  ],
  A08T: [
    ...barreBasse(A08T_BARRE_BASSE),
    ...ongletsReseau(BARRE_ONGLETS_RESEAU_WEB, A08T_MEMBRE_WEB),
    ...ongletsReseau(BARRE_ONGLETS_RESEAU_WEB, A08T_PROPRIETAIRE_WEB, 'proprietaire'),
    ...ongletsReseau(BARRE_ONGLETS_RESEAU_MOBILE, A08T_MEMBRE_MOBILE),
    ...ongletsReseau(BARRE_ONGLETS_RESEAU_MOBILE, A08T_PROPRIETAIRE_MOBILE, 'proprietaire'),
  ],
  A12T: [
    ...barreBasse(['BonsPlansMobile', 'ProduitsMobile', 'TemoignagesMobile']),
    ...ongletsVille(BARRE_ONGLETS_VILLE_WEB, ['BonsPlans', 'Produits', 'Temoignages']),
    ...ongletsVille(BARRE_ONGLETS_VILLE_MOBILE, [
      'BonsPlansMobile',
      'ProduitsMobile',
      'TemoignagesMobile',
    ]),
  ],
};

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

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ A14 — CE QUE LE COMPOSEUR DE STORY AFFICHAIT EN DUR                        ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le corps de la story est dessiné CINQ fois dans cette section, et seulement
 * DEUX de ces cinq fois sont des champs de saisie (le téléphone de l'étape 1 et la
 * boîte « Texte » du panneau d'ordinateur ; plus deux fois le calque de la variante
 * photo). Les trois autres sont des RÉCAPITULATIFS, et c'est ici qu'elles sont
 * liées :
 *
 *   · l'étape 2 le rappelle en grisé, TRONQUÉ par la maquette elle-même
 *     (« …sa validation… ») ;
 *   · l'étape 3 le montre dans sa carte d'aperçu de 132 px ;
 *   · le cadre d'ordinateur le montre dans son téléphone sombre.
 *
 * POURQUOI ICI ET NON DANS LE TRANSCODEUR : `donnees` tourne AVANT `transcode`, sur
 * le dialecte. Les récapitulatifs cessent donc de porter le littéral avant que les
 * transformations de saisie ne cherchent leurs cibles — c'est ce qui permet à
 * celles-ci de se borner par un style sans risquer d'attraper un récapitulatif.
 *
 * ── « UN RÉCAPITULATIF QUI MENT EST PIRE QU'UN RÉCAPITULATIF ABSENT » ───────
 *
 * C'est le dernier écran avant publication. La carte d'aperçu peignait son fond en
 * `#16785E` en dur et annonçait « CONSEIL » quel que soit le type choisi : un
 * membre qui composait une DÉCOUVERTE sur fond violet voyait un conseil vert juste
 * avant d'appuyer sur « Publier ». Les trois prises de cette carte — fond, type,
 * corps — sont celles que l'écran envoie vraiment.
 */
const A14_DONNEES = [
  // ── Le corps, là où il est RAPPELÉ et non saisi ────────────────────────────
  {
    frames: ['MobileRattacher'],
    noeud:
      '<div style="padding:70px 30px 0;color:rgba(255,255,255,.4);font-size:22px;font-weight:800;' +
      'line-height:1.2">Pour Visale, déposez votre VLS-TS dès sa validation…</div>',
    devient:
      '<div style="padding:70px 30px 0;color:rgba(255,255,255,.4);font-size:22px;font-weight:800;' +
      'line-height:1.2">{{ storyBodyRecap }}</div>',
    why:
      'Le rappel du texte à l’étape 2. La maquette le TRONQUE elle-même (« …sa validation… », ' +
      'suivi de points de suspension) : la prise reprend ce parti et coupe le corps saisi, ' +
      'au lieu de laisser 280 caractères déborder d’une zone dessinée pour une ligne et demie.',
  },
  {
    frames: ['MobilePublier'],
    noeud:
      '<span style="font-size:13px;font-weight:800;line-height:1.2">Pour Visale, déposez votre ' +
      "VLS-TS dès sa validation sur l'ANEF. Réponse en 48 h.</span>",
    devient:
      '<span style="font-size:13px;font-weight:800;line-height:1.2">{{ storyBody }}</span>',
    why: 'Le corps dans la carte d’aperçu de l’étape 3 — ce qui va réellement partir.',
  },
  {
    frames: ['Desktop'],
    noeud:
      '<div style="font-size:30px;font-weight:800;line-height:1.2;letter-spacing:-0.6px;' +
      "margin-top:14px\">Pour Visale, déposez votre VLS-TS dès sa validation sur l'ANEF. Réponse en 48 h.",
    devient:
      '<div style="font-size:30px;font-weight:800;line-height:1.2;letter-spacing:-0.6px;' +
      'margin-top:14px">{{ storyBody }}',
    why:
      'Le corps dans le téléphone sombre du cadre d’ordinateur. C’est un APERÇU et non un champ : ' +
      'la saisie d’ordinateur est la boîte « Texte » du panneau de droite, que la maquette ' +
      'étiquette et dote de son propre compteur. Le `margin-top:14px` est ce qui distingue cette ' +
      'occurrence de celle du cadre mobile, qui est bien un champ.',
  },

  // ── Le compteur de caractères, dessiné trois fois et mort trois fois ───────
  /**
   * LES TROIS COMPTEURS DEVIENNENT VIVANTS.
   *
   * La maquette écrit « 118 / 280 » en dur, et le nombre de gauche ne compte RIEN :
   * le littéral qu'il accompagne fait 80 caractères, pas 118. C'est donc une valeur
   * d'exemple — ce qui est en soi la preuve que la zone au-dessus est un champ.
   *
   * Le plafond ne figure pas dans ces déclarations : `{{ bodyCount }}` porte les
   * deux nombres, et l'écran les calcule depuis `FEED_LIMITS.storyBodyMax`. Écrire
   * 280 ici en ferait une seconde source, et le jour où la borne du serveur
   * changerait, l'écran afficherait l'ancienne.
   */
  {
    frames: ['Mobile'],
    noeud:
      '<div style="font-size:12.5px;font-weight:700;color:rgba(255,255,255,.7)">118 / 280</div>',
    devient:
      '<div style="font-size:12.5px;font-weight:700;color:rgba(255,255,255,.7)">{{ bodyCount }}</div>',
    why: 'Le compteur de caractères du cadre mobile, calculé sur ce qui est tapé.',
  },
  {
    frames: ['Desktop'],
    noeud:
      '<div style="font-size:12.5px;font-weight:700;color:rgba(255,255,255,.7);margin-top:12px">118 / 280</div>',
    devient:
      '<div style="font-size:12.5px;font-weight:700;color:rgba(255,255,255,.7);margin-top:12px">{{ bodyCount }}</div>',
    why: 'Le compteur sous le téléphone sombre du cadre d’ordinateur.',
  },
  {
    frames: ['Desktop'],
    noeud: '<span style="font-weight:700">118 / 280</span>',
    devient: '<span style="font-weight:700">{{ bodyCount }}</span>',
    why: 'Le compteur du champ « Texte » du panneau d’ordinateur.',
  },

  // ── La carte d'aperçu de l'étape 3 : fond et type ──────────────────────────
  {
    frames: ['MobilePublier'],
    noeud:
      '<div style="width:132px;height:234px;flex-shrink:0;border-radius:18px;background:#16785E;' +
      'color:#fff;padding:12px;display:flex;flex-direction:column;justify-content:center;gap:6px">' +
      '<span style="font-size:7.5px;font-weight:800;letter-spacing:1px;opacity:.75">CONSEIL</span>',
    devient:
      '<div style="width:132px;height:234px;flex-shrink:0;border-radius:18px;background:{{ writeBg }};' +
      'color:#fff;padding:12px;display:flex;flex-direction:column;justify-content:center;gap:6px">' +
      '<span style="font-size:7.5px;font-weight:800;letter-spacing:1px;opacity:.75">{{ webKind }}</span>',
    why:
      'La carte d’aperçu peignait son fond en #16785E et annonçait « CONSEIL » en dur, quel que ' +
      'soit le type et la couleur choisis aux étapes précédentes. `writeBg` est la couleur de la ' +
      'palette qui est VRAIMENT sélectionnée — la même prise qui peint déjà le cadre de l’étape 1 ' +
      '— et `webKind` le type en capitales, la même prise que la pastille du cadre d’ordinateur. ' +
      'Aucune couleur n’est inventée ni assombrie : ce sont les sept teintes de la palette dessinée.',
  },

  // ══ CE QUE LE PORTEUR A TROUVÉ MORT DANS SON NAVIGATEUR ══════════════════════
  //
  // « Les actions sur la texte et photo ne marche pas. Centré, gras, Changer,
  // Recadrer, Assombrir le bas. Sur l'écran 3, la recherche, les étapes et sujet. »
  //
  // Les transformations qui rendent ces contrôles actionnables vivent dans le
  // transcodeur (`A14_ALIGNEMENT`, `A14_STYLE_TEXTE`, `A14_OUTILS_PHOTO`,
  // `A14_RECHERCHE`, `A14_ETAPES`, `A14_SUJETS`). Ce qu'elles ne peuvent pas faire,
  // c'est transformer un LITTÉRAL en donnée : c'est le travail de cette table, et
  // c'est elle qui tient le garde-fou du compte.

  /**
   * LE LIBELLÉ DU STYLE DE TEXTE DEVIENT UNE DONNÉE.
   *
   * La maquette écrit « Aa · Gras », et le gras EST ce qu'elle dessine
   * (`font-weight:800` sur les quatre zones). Mais `StoryTextStyle` en compte TROIS
   * — `BOLD | SERIF | MONO` — et `createStorySchema.textStyle` les exige : le bouton
   * tourne donc sur les trois, et son libellé doit suivre. Un bouton qui afficherait
   * « Gras » en servant du monospace serait pire qu'un bouton inerte.
   *
   * Les deux autres mots sont les valeurs du SERVEUR mises en capitale initiale
   * (`Serif`, `Mono`), pas des mots d'interface inventés : voir `STORY_TEXT_STYLES`
   * dans `screens/a14/data.ts`, qui le dit et le borne. REMONTÉ : le jour où
   * `T2 textes-interface` nomme ces deux styles, c'est là que ça se corrige.
   */
  {
    frames: ['Desktop'],
    noeud:
      '<span style="height:40px;padding:0 14px;border-radius:12px;background:#F2F5F4;' +
      'display:flex;align-items:center;font-size:13px;font-weight:800">Aa · Gras</span>',
    devient:
      '<span style="height:40px;padding:0 14px;border-radius:12px;background:#F2F5F4;' +
      'display:flex;align-items:center;font-size:13px;font-weight:800">{{ textStyleLabel }}</span>',
    why:
      'Le bouton de style de texte annonce le style COURANT. Il était un <span> inerte affichant ' +
      '« Gras » en dur, alors que le champ `textStyle` du serveur accepte trois valeurs.',
  },

  /**
   * LES TROIS OUTILS PHOTO DEVIENNENT DES OBJETS, et non plus des mots.
   *
   * `photoTools` était `['Changer', 'Recadrer', 'Assombrir le bas']` : trois chaînes,
   * donc trois pastilles sans gestionnaire possible. Elles portent maintenant leur
   * action et leur état (`t.onPick`, `t.on`), ce que `A14_OUTILS_PHOTO` branche.
   *
   * DEUX ENTRÉES, parce que la maquette dessine cette rangée DEUX fois et pas
   * pareil : en `#fff` bordé dans le panneau d'ordinateur, en `rgba(0,0,0,.35)` posée
   * sur la photo du téléphone. Une seule déclaration aurait raté l'un des deux cadres
   * en silence — c'est exactement ce que `fois` existe pour empêcher.
   */
  {
    frames: ['Desktop'],
    noeud:
      '<span style="height:36px;padding:0 13px;border-radius:999px;background:#fff;' +
      'border:1px solid #E6EBE9;display:flex;align-items:center;font-size:12.5px;' +
      'font-weight:700">{{ t }}</span>',
    devient:
      '<span style="height:36px;padding:0 13px;border-radius:999px;background:#fff;' +
      'border:1px solid #E6EBE9;display:flex;align-items:center;font-size:12.5px;' +
      'font-weight:700">{{ t.label }}</span>',
    why: 'Les outils photo du panneau d’ordinateur portent leur libellé en donnée, pour porter aussi leur action.',
  },
  {
    frames: ['MobilePhoto'],
    noeud:
      '<span style="height:38px;padding:0 14px;border-radius:999px;background:rgba(0,0,0,.35);' +
      'display:flex;align-items:center;font-size:12.5px;font-weight:700">{{ t }}</span>',
    devient:
      '<span style="height:38px;padding:0 14px;border-radius:999px;background:rgba(0,0,0,.35);' +
      'display:flex;align-items:center;font-size:12.5px;font-weight:700">{{ t.label }}</span>',
    why: 'Les outils photo posés sur la photo du téléphone portent leur libellé en donnée, pour porter aussi leur action.',
  },

  /**
   * ╔════════════════════════════════════════════════════════════════════════════╗
   * ║ LA PHOTO DU MEMBRE REMPLACE LE HACHURAGE DE LA MAQUETTE                    ║
   * ╚════════════════════════════════════════════════════════════════════════════╝
   *
   * `repeating-linear-gradient(135deg,#46564F 0 14px,#3E4D47 14px 28px)` est le
   * hachurage que cette maquette emploie partout pour dire « ici il y a une image »
   * — elle le réemploie à l'identique sur la story de A13. Ce n'est donc pas une
   * couleur de produit : c'est un EMPLACEMENT D'IMAGE, et le lier est la seule façon
   * d'y faire entrer la photo que le membre choisit.
   *
   * `coque: true` sur le cadre mobile : la variante photo peint son hachurage dans
   * la BALISE OUVRANTE du cadre, pas dans son contenu. Sans cette clé la donnée
   * serait hors de portée d'`applyData` — voir son bloc dans `generate-screens.mjs`.
   *
   * TANT QU'AUCUNE PHOTO N'EST CHOISIE, `photoFond` REND LE HACHURAGE, mot pour mot.
   * L'écran ne dessine donc rien de neuf : il rend ce que la maquette dessine, et le
   * remplace par l'image quand il y en a une.
   */
  {
    frames: ['MobilePhoto'],
    coque: true,
    noeud: 'background:repeating-linear-gradient(135deg,#46564F 0 14px,#3E4D47 14px 28px)',
    devient: 'background:{{ photoFond }}',
    why:
      'La variante photo du téléphone affiche la PHOTO CHOISIE. Le hachurage de la maquette est ' +
      'son emplacement d’image, et il reste la valeur servie tant que rien n’est choisi.',
  },
  {
    frames: ['Desktop'],
    noeud:
      '<div style="position:absolute;inset:0;background:repeating-linear-gradient(135deg,' +
      '#46564F 0 14px,#3E4D47 14px 28px)"></div>',
    devient:
      '<div style="position:absolute;inset:0;background:{{ photoFond }}"></div>',
    why:
      'Le téléphone sombre du cadre d’ordinateur montre la MÊME photo choisie — sans cela, ' +
      'l’aperçu d’ordinateur mentirait sur ce qui va partir.',
  },

  /**
   * « ASSOMBRIR LE BAS » A DÉJÀ SON DESSIN, ET C'EST CE VOILE-LÀ.
   *
   * La maquette dessine en tête de la variante photo un
   * `linear-gradient(180deg,rgba(0,0,0,0),rgba(0,0,0,.72))` sur 60 % de la hauteur :
   * c'est LITTÉRALEMENT « le bas assombri ». Le bouton n'avait donc rien à inventer
   * — il lui manquait seulement de pouvoir l'éteindre.
   *
   * `<sc-if>` et non une opacité liée : l'état est binaire, et c'est la balise du
   * dialecte que `transcode` sait déjà rendre. Rien n'est ajouté à l'émetteur.
   * Le voile est ALLUMÉ par défaut, parce que c'est l'état que la maquette dessine.
   */
  {
    frames: ['MobilePhoto'],
    noeud:
      '<div style="position:absolute;left:0;right:0;bottom:0;height:60%;' +
      'background:linear-gradient(180deg,rgba(0,0,0,0),rgba(0,0,0,.72))"></div>',
    devient:
      '<sc-if value="{{ assombri }}"><div style="position:absolute;left:0;right:0;bottom:0;' +
      'height:60%;background:linear-gradient(180deg,rgba(0,0,0,0),rgba(0,0,0,.72))"></div></sc-if>',
    why:
      'Le bouton « Assombrir le bas » éteint et rallume le voile que la maquette dessine déjà. ' +
      'Aucun champ en base ne le conserve : c’est de la composition, et c’est REMONTÉ.',
  },

  /**
   * LE MÊME VOILE, SUR LE CADRE D'ORDINATEUR — et il ne s'écrit pas pareil.
   *
   * La fenêtre sombre dessine son voile en `rgba(0,0,0,.75)` là où le téléphone
   * l'écrit en `.72`. Deux littéraux, donc DEUX déclarations : une seule aurait
   * laissé l'aperçu d'ordinateur sourd au bouton, en silence — ce que le compte de
   * `fois` n'aurait pas vu, puisqu'il ne cherche que ce qu'on lui a nommé.
   *
   * Aucune des deux valeurs n'est touchée. C'est le point : « assombrir » ne change
   * pas l'intensité de l'assombrissement, il l'allume ou l'éteint.
   */
  {
    frames: ['Desktop'],
    noeud:
      '<div style="position:absolute;left:0;right:0;bottom:0;height:60%;' +
      'background:linear-gradient(180deg,rgba(0,0,0,0),rgba(0,0,0,.75))"></div>',
    devient:
      '<sc-if value="{{ assombri }}"><div style="position:absolute;left:0;right:0;bottom:0;' +
      'height:60%;background:linear-gradient(180deg,rgba(0,0,0,0),rgba(0,0,0,.75))"></div></sc-if>',
    why:
      'Le voile de l’aperçu d’ordinateur suit le même bouton « Assombrir le bas » que celui du ' +
      'téléphone — sans quoi les deux largeurs montreraient deux états différents.',
  },

  /**
   * ╔════════════════════════════════════════════════════════════════════════════╗
   * ║ LE SÉLECTEUR DE PARCOURS, QUE LE PORTEUR A DEMANDÉ NOMMÉMENT                ║
   * ╚════════════════════════════════════════════════════════════════════════════╝
   *
   * « Aussi normalement les étapes viennent du backend notamment les étapes des
   * parcours. Avant les étapes des parcours, il faut ajouter une en haut des étapes,
   * les différents type de parcours. En fait il faut un bouton sélectionner un
   * parcours (avec un chevron right à la fin qui affiche un modal dans la page avec
   * les parcours et leur description et on peut sélectionner) qui va afficher la
   * liste des parcours disponible et il sélectionne un, ainsi les étapes par rapport
   * à ce parcours s'affiche dans la liste des étapes. »
   *
   * LA MAQUETTE NE DESSINE NI CE BOUTON NI CETTE FENÊTRE. Ils sont donc une PRISE —
   * `{{ parcoursSelecteur }}`, un nœud React — et le dessin vit dans
   * `screens/a14/selecteur-parcours.tsx`, où CHAQUE valeur porte en commentaire la
   * ligne de maquette d'où elle est recopiée. Les mettre ici serait écrire du dessin
   * dans une déclaration de donnée, ce que le troisième contrôle d'`applyData`
   * refuse — à raison.
   *
   * ET « MON PARCOURS · ÉTUDES » DEVIENT UNE DONNÉE. C'est le titre de la liste
   * d'étapes, et il annonçait « ÉTUDES » quel que soit le parcours : choisir
   * « Travailler » aurait rempli la liste des étapes du travail sous un titre qui dit
   * « études ». Le parcours choisi le nomme maintenant.
   */
  {
    frames: ['Desktop', 'MobileRattacher'],
    noeud:
      '<div style="font-size:10.5px;font-weight:700;letter-spacing:1px;color:#8A958F">' +
      'MON PARCOURS · ÉTUDES</div>',
    devient:
      '{{ parcoursSelecteur }}' +
      '<div style="font-size:10.5px;font-weight:700;letter-spacing:1px;color:#8A958F">' +
      '{{ parcoursLabel }}</div>',
    why:
      'Le sélecteur de parcours que le porteur a demandé se pose AU-DESSUS de la liste d’étapes, ' +
      'et le titre de cette liste nomme le parcours choisi au lieu d’annoncer « ÉTUDES » en dur.',
  },

  /**
   * LES SUJETS DEVIENNENT DES OBJETS SÉLECTIONNABLES.
   *
   * `attachTopics` était cinq chaînes (« Visale · Garant · CAF · Colocation ·
   * Banque »), donc cinq pastilles sans gestionnaire possible. Elles portent
   * maintenant leur libellé, leur état et leur action.
   *
   * LES DEUX VALEURS DE L'ÉTAT SONT CELLES DE LA MAQUETTE, et c'est mesurable : son
   * propre `renderVals()` écrit, pour la ligne d'étape juste au-dessus,
   * `bg: a.on?'#E3F0EB':'#fff'` et `bd: a.on?'1.5px solid #16785E':'1px solid #E6EBE9'`.
   * C'est SON vocabulaire de sélection, dans CE panneau, et il est réemployé tel quel
   * — déclaré en `motifs`, donc vérifié : si la maquette cessait de l'écrire, la
   * génération s'arrêterait au lieu de laisser une couleur orpheline.
   */
  {
    frames: ['Desktop', 'MobileRattacher'],
    noeud:
      '<span style="padding:8px 13px;border-radius:999px;background:#fff;' +
      'border:1px solid #E6EBE9;font-size:12.5px;font-weight:600">{{ t }}</span>',
    devient:
      '<span style="padding:8px 13px;border-radius:999px;background:{{ t.bg }};' +
      'border:{{ t.bd }};font-size:12.5px;font-weight:600">{{ t.label }}</span>',
    /**
     * TÉMOINS, et non fragments réemployés : ces deux motifs ne figurent pas dans
     * `devient` — ils vivent dans le `renderVals()` de la maquette, pas dans son
     * balisage. Les déclarer ici ne change rien au JSX produit ; cela rend
     * VÉRIFIABLE l'affirmation « ces deux valeurs sont celles de la maquette », et
     * ARRÊTE la génération le jour où elle cesse de les écrire.
     */
    motifs: [
      { from: 'docs/template/03 Accueil v2.dc.html', pattern: "bg: a.on?'#E3F0EB':'#fff'" },
      {
        from: 'docs/template/03 Accueil v2.dc.html',
        pattern: "bd: a.on?'1.5px solid #16785E':'1px solid #E6EBE9'",
      },
    ],
    why:
      'Les sujets deviennent sélectionnables et renseignent `category`. Leur apparence « choisi » ' +
      'est celle que la maquette donne déjà à la ligne d’étape du même panneau.',
  },
];

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ A13 — L'EMPLACEMENT PHOTO REÇOIT LA PHOTO, AU LIEU DU HACHURAGE           ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * TROUVÉ EN TRAVERSANT LA CHAÎNE ENTIÈRE DANS UN SEUL NAVIGATEUR, et trouvé
 * seulement comme ça : deux moitiés vertes mesurées séparément ne font pas une
 * chaîne verte. Le composeur envoyait bien la photo, le serveur la stockait et la
 * servait — et l'écran de LECTURE peignait un rectangle rayé. La story était
 * composée, publiée, servie, et jamais vue.
 *
 * `repeating-linear-gradient(135deg,#46564F …)` est le motif que cette maquette
 * emploie partout pour dire « ici il y a une image ». A13 le réemploie à
 * l'identique — ce n'est donc pas une couleur de produit, c'est un EMPLACEMENT
 * D'IMAGE, et le lier est la seule façon d'y faire entrer la photo du membre.
 * C'est exactement le raisonnement déjà tenu pour la variante photo du composeur,
 * et c'est délibérément le même : deux façons de peindre le même emplacement
 * finiraient par diverger.
 *
 * SANS PHOTO, `photoFond` REND LE HACHURAGE MOT POUR MOT (`HACHURAGE_PHOTO`,
 * importé de `a14/data.ts` et non recopié). L'écran ne dessine donc rien de neuf.
 *
 * SEUL LE CADRE MOBILE est lié, parce que seul lui dessine cet emplacement : le
 * cadre d'ordinateur d'A13 n'en dessine AUCUN — compté, zéro occurrence. Une story
 * à fond photo n'a donc pas d'aperçu photo sur ordinateur, et ce n'est pas un
 * oubli de ce lot : la maquette ne le dessine pas. REMONTÉ au porteur.
 */
const A13_DONNEES = [
  {
    frames: ['Mobile'],
    noeud:
      '<div style="position:absolute;inset:0;background:repeating-linear-gradient(135deg,' +
      '#46564F 0 14px,#3E4D47 14px 28px)">',
    devient: '<div style="position:absolute;inset:0;background:{{ st.photoFond }}">',
    why:
      'L’écran de lecture peint la PHOTO de la story. Le hachurage de la maquette est son ' +
      'emplacement d’image, et il reste la valeur servie tant qu’il n’y a pas de photo.',
  },
];

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ A01C · « AUCUN COMMENTAIRE · Soyez la première personne à réagir »         ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur, mot pour mot : « "AUCUN COMMENTAIRE · Soyez la première personne à
 * réagir" : extrais. »
 *
 * La maquette le dessine dans la colonne « ÉTATS » de A01C (lignes 280-283,
 * largeur 340 px), à côté des deux cadres. Jusqu'ici la feuille de commentaires
 * d'un guide ou d'une publication sans commentaire affichait une zone VIDE entre
 * la carte du sujet et le champ de saisie — rien ne disait au lecteur qu'il
 * pouvait être le premier, ni que son mot compterait.
 *
 * ── CE QUI EST DU PRODUIT, ET CE QUI EST DE LA DOCUMENTATION ───────────────
 *
 * L'ÉTIQUETTE « AUCUN COMMENTAIRE » N'EST PAS TRANSCODÉE, et ce n'est pas un
 * oubli : c'est un arbitrage, et il est DÉMONTRÉ plutôt que supposé. Les trois
 * cartes de cette colonne portent chacune une étiquette de 11px/700 avec
 * `letter-spacing:1px` en `#8A958F` — « AUCUN COMMENTAIRE », « NIVEAU L0 »,
 * « COMMENTAIRE MASQUÉ ». La PREUVE est la deuxième : aucune interface de produit
 * ne coiffe une carte du mot « NIVEAU L0 ». Ces étiquettes NOMMENT l'état pour le
 * lecteur de la spécification, exactement comme le titre « ÉTATS » de la colonne
 * qui les contient — et ce titre porte la même typographie, au pixel près. La
 * CARTE et son CONTENU, en revanche, sont du produit, et c'est eux qu'on monte.
 *
 * ⚠ LE `margin-top:14px` DE LA PREMIÈRE LIGNE EST RETIRÉ, ET IL FAUT LE DIRE.
 *
 * La maquette écrit `<div style="font-size:15px;font-weight:700;margin-top:14px">`
 * sur « Soyez la première personne à réagir. » Cette marge existait pour UNE
 * raison : écarter la phrase de l'étiquette posée juste au-dessus. L'étiquette
 * n'étant pas du produit, la marge n'a plus de cause — et la recopier aurait donné
 * une carte de 22px de remplissage dont la première ligne commence à 36px du
 * haut et dont la dernière s'arrête à 22px du bas. C'est-à-dire une carte
 * visiblement désaxée, par héritage d'un espacement dont l'objet a disparu.
 *
 * Le retrait passe par le mécanisme PRÉVU : le fragment est DÉCOUPÉ en deux motifs
 * déclarés (`VIDE_TITRE` et la suite), ce que le troisième contrôle d'`applyData`
 * nomme explicitement — « un remontage […] il faut alors les DÉCLARER en motifs,
 * c'est-à-dire le dire ». Le journal de chaque génération les affiche, avec leur
 * provenance. Rien n'est inventé : les trois morceaux sont des sous-chaînes
 * EXACTES de la maquette, comptées (1, 7 et 1 occurrences dans le fichier).
 *
 * ── POURQUOI UN `motifs` AVEC SON `from`, ET PAS UN NŒUD ÉCRIT ICI ─────────
 *
 * Cette colonne est DEHORS : le générateur ne transcode que les conteneurs de 1440
 * et de 390 px, et la colonne d'états est leur sœur, pas leur contenu. Le dessin
 * est donc réemployé par `motifs`, avec son `from` — le mécanisme prévu pour un
 * fragment dessiné ailleurs dans la maquette, et le DEUXIÈME contrôle d'`applyData`
 * refuse de produire le jour où le designer retire cet état. C'est le précédent
 * EXACT de `ETAT_VIDE` / `MOTIFS_VIDE` dans `tools/screens/05-entraide.mjs`, posé
 * pour l'état vide de H01, et il est suivi à la lettre.
 *
 * ── L'ANCRE EST LA FERMETURE DE LA BOUCLE, ET C'EST MESURÉ ────────────────
 *
 * `</sc-for>` figure EXACTEMENT UNE FOIS dans chaque cadre de A01C — relevé, deux
 * occurrences dans la section, une par planche. Une seule déclaration sert donc
 * les DEUX, sans clé `frames`, et `fois: 1` le recompte à chaque génération : le
 * jour où un cadre perdrait sa boucle, la génération s'arrête en le nommant au
 * lieu de livrer une feuille sans état vide.
 *
 * ⚠ APRÈS LA BOUCLE ET NON AVANT, ET CE N'EST PAS INDIFFÉRENT — MESURÉ.
 *
 * Les deux places sont équivalentes À L'ÉCRAN : quand `filVide` est vrai le fil
 * est vide, donc la boucle ne rend rien, et la carte se retrouve au même endroit.
 * Elles ne sont pas équivalentes pour le GÉNÉRATEUR. L'adaptation qui rend un nom
 * de membre cliquable (`A01_NOM_PROFIL`) cherche l'avatar de ce membre dans les
 * 1 500 caractères QUI PRÉCÈDENT `{c.name}` — et son propre commentaire relève que
 * sur A01C cet écart vaut déjà 1 400. Poser la carte AVANT la boucle ajoutait
 * ~470 caractères dans cet intervalle : MESURÉ, le cadre d'ordinateur a perdu son
 * `data-nom-profil`, le nom de l'auteur d'un commentaire a cessé de mener à son
 * profil, et `Link` a disparu des imports. Le défaut compilait sans un mot.
 *
 * On pose donc la carte APRÈS `</sc-for>`, ce qui laisse l'intervalle intact. La
 * FRAGILITÉ de cette marge de cent caractères est REMONTÉE : elle n'est pas de ce
 * lot — la réparer demande que l'adaptation reconnaisse l'avatar dont la taille
 * est une DONNÉE (`width: c.av`) et non un littéral, ce qui changerait les liens
 * de profil sur plusieurs modules à la fois.
 *
 * ⚠ CE QUE CETTE DÉCLARATION NE VÉRIFIE PAS : l'ancre étant de l'ÉCHAFAUDAGE
 * (`<sc-for>`), le troisième contrôle n'a aucun fragment à retrouver dans `noeud`.
 * Ce sont donc le PREMIER contrôle (la boucle est toujours là, une fois par cadre)
 * et le DEUXIÈME (chaque morceau de la carte est toujours dessiné dans la colonne
 * d'états) qui portent la garantie ici. Les deux sont durs, et ils suffisent :
 * aucun pixel de cette carte n'est écrit dans ce fichier.
 *
 * ── LA TROISIÈME CARTE DE LA COLONNE N'EST PAS MONTÉE, ET C'EST MESURÉ ─────
 *
 * ⚠ « NIVEAU L0 » dessine « Commenter demande une identité vérifiée » avec un
 * bouton « Vérifier mon identité ». C'ÉTAIT VRAI quand `comment.create` exigeait
 * L1 ; le porteur a refondu les niveaux — « N0 : commenter des publications » — et
 * `comment.create` est déclarée `{ minLevel: 'L0' }` dans
 * `packages/shared/src/capabilities/capabilities.ts`, ligne 122. MESURÉ pendant le
 * lot précédent : un lecteur L0 a commenté un guide, réponse 201. Cette carte dit
 * donc le CONTRAIRE de la règle en vigueur, et la monter barrerait un geste que le
 * serveur accepte. ÉCART DE MAQUETTE PÉRIMÉ PAR UN ARBITRAGE DU PORTEUR, remonté
 * au rapport de lot et non transcodé.
 */
const VIDE_CARTE =
  '<div style="background:#fff;border:1px solid #E6EBE9;border-radius:22px;' +
  'padding:22px;text-align:center">';

/** Sans son `;margin-top:14px` — voir l'en-tête : la marge n'a plus de cause. */
const VIDE_TITRE = '<div style="font-size:15px;font-weight:700';

const VIDE_PHRASES =
  '">Soyez la première personne à réagir.</div>' +
  '<div style="font-size:12.5px;color:#5D6B66;margin-top:4px">' +
  // L'APOSTROPHE EST DROITE, et c'est la maquette qui le décide : « Un mot
  // d'encouragement compte. » est écrit avec `'` et non `’` dans
  // `03 Accueil v2.dc.html` — relevé, une occurrence. Une apostrophe typographique
  // a fait échouer le deuxième contrôle au premier essai, ce qui est exactement ce
  // que ce contrôle existe pour attraper.
  "Un mot d'encouragement compte.</div></div>";

const FIN_BOUCLE_FIL_A01C = '</sc-for>';

const A01C_DONNEES = [
  {
    noeud: FIN_BOUCLE_FIL_A01C,
    devient:
      FIN_BOUCLE_FIL_A01C +
      '<sc-if value="{{ filVide }}">' +
      VIDE_CARTE +
      VIDE_TITRE +
      VIDE_PHRASES +
      '</sc-if>',
    motifs: [VIDE_CARTE, VIDE_TITRE, VIDE_PHRASES].map((pattern) => ({ from: FILE, pattern })),
    fois: 1,
    why: 'L’état VIDE de la feuille de commentaires, emprunté à la colonne « ÉTATS » de A01C (lignes 280-283) : un guide ou une publication sans commentaire montrait une zone vide, sur les DEUX planches. L’étiquette « AUCUN COMMENTAIRE » n’est pas transcodée — c’est de la documentation, la preuve étant « NIVEAU L0 » sur la carte voisine. Posée APRÈS la boucle : avant, elle écartait de 470 caractères le nom de son avatar et faisait perdre au cadre d’ordinateur le lien vers le profil de l’auteur (mesuré).',
  },
];

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ « ALBUM — SÉLECTION » (390 px) N'A NI PASTILLES NI BOUTON D'AJOUT          ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur veut les trois onglets par défaut et le bouton « Ajouter » SUR LES
 * QUATRE CADRES — « toutes les corrections sont aussi faites sur mobile ».
 *
 * MESURÉ, cadre par cadre, sur les octets de la maquette :
 *
 *   · `Album` (1 036 px)            — 3 pastilles, bouton vert « Ajouter des photos » ;
 *   · `AdminAlbum` (1 036 px)       — les mêmes, plus un voile « Masquer · Couverture »
 *                                     sur la troisième tuile ;
 *   · `AlbumMobile` (390 px)        — 3 pastilles, bouton flottant à l'appareil photo ;
 *   · `AdminAlbumMobile` (390 px)   — **AUCUNE pastille, AUCUN bouton flottant**.
 *     À leur place, une bande de sélection « 1 photo sélectionnée · Couverture ·
 *     Masquer », et une tuile cochée.
 *
 * Le quatrième cadre EMPRUNTE donc les deux fragments manquants à son frère
 * `AlbumMobile` — même maquette, même section MOB2, MÊME LARGEUR, donc aucune
 * mesure à transposer (c'est précisément le piège n° 1 que l'emprunt évite ici :
 * les pastilles de 390 px s'écrivent `7px 12px` / 12 px, celles de 1 036 px
 * `8px 14px` / 12,5 px — emprunter au cadre d'ordinateur aurait rétréci ou
 * grossi la rangée).
 *
 * ⚠ CE QUI N'EST PAS EMPRUNTÉ, ET C'EST UN RELEVÉ : la bande de sélection et la
 * tuile cochée RESTENT, inertes. « Couverture » n'a aucune colonne où se poser
 * (le modèle `Album` n'en porte pas) et « Masquer » n'a pas de dessin séparé de
 * la sélection. Les brancher demanderait de dessiner une case à cocher par tuile
 * et une colonne de couverture. REMONTÉ ; elles étaient déjà inertes avant ce
 * lot, et ce lot ne les retire pas.
 */
const PASTILLES_ALBUM_MOBILE =
  '<div style="display:flex;gap:6px;flex-shrink:0">' +
  '<span style="padding:7px 12px;border-radius:999px;font-size:12px;font-weight:700;' +
  'background:#16785E;color:#fff;border:1px solid #16785E">Tout</span>' +
  '<span style="padding:7px 12px;border-radius:999px;font-size:12px;font-weight:700;' +
  'background:#fff;color:#16211D;border:1px solid #E6EBE9">F\u00eate 2025</span>' +
  '<span style="padding:7px 12px;border-radius:999px;font-size:12px;font-weight:700;' +
  'background:#fff;color:#16211D;border:1px solid #E6EBE9">Repas</span></div>';

/** Le bouton flottant de l'album mobile — l'appareil photo, pas le crayon. */
const BOUTON_FLOTTANT_ALBUM_MOBILE =
  '<span style="position:absolute;right:18px;bottom:108px;width:56px;height:56px;' +
  'border-radius:18px;background:#16785E;display:flex;align-items:center;' +
  'justify-content:center"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" ' +
  'stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M3 4h18v16H3zM8.5 11a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2zM21 16l-5-5-9 9"/>' +
  '</svg></span>';

/** L'ancre : la bande de sélection, le seul n\u0153ud que ce cadre-l\u00e0 dessine seul. */
const BANDE_SELECTION_ALBUM_MOBILE =
  '<div style="display:flex;align-items:center;gap:8px;background:#16211D;color:#fff;' +
  'border-radius:14px;padding:10px 12px;flex-shrink:0">';

export const screens = [
  {
    file: 'docs/template/03 Accueil v2.dc.html',
    section: 'A01',
    out: 'apps/web/src/screens/a01',
    dataModule: './data',
    dataType: 'A01Data',
    /**
     * ╔══════════════════════════════════════════════════════════════════════════╗
     * ║ LA CARTE DE PUBLICATION SORT DE SON CADRE                               ║
     * ╚══════════════════════════════════════════════════════════════════════════╝
     *
     * Le porteur, capture à l'appui : « Sur le profil, le fil d'actualité devrait
     * s'afficher comme ceci. Pareil pour les autres, ils doivent prendre leur
     * design respectif. »
     *
     * La carte était dessinée DANS la boucle du fil : il n'existait aucun
     * composant à monter sur le profil, et la recopier aurait fait deux cartes
     * qui auraient divergé au premier changement de maquette. `composants`
     * l'extrait dans son propre fichier généré — même source, deux emplois.
     *
     * LES DEUX PLANCHES SONT EXTRAITES : elles ne dessinent pas la même carte
     * (rayons, écarts et tailles diffèrent), et le profil doit montrer celle de
     * la largeur où on le regarde.
     */
    composants: [
      {
        nom: 'CartePublication',
        depuis: 'feedPosts',
        as: 'p',
        type: 'FeedPostView',
        cadres: ['Desktop', 'Mobile'],
      },
    ],
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
    /**
     * ── LES DEUX ICÔNES DU COMPOSEUR, ET LA DETTE QU'ELLES PAIENT ─────────────
     *
     * « Lier un guide » et « Créer un sondage » ouvrent A01G et A01S. Le lot
     * précédent avait branché la PREMIÈRE sans passer par ici, en s'accrochant
     * dans l'écouteur de la page à l'attribut `title` que la maquette écrit — et
     * il a dit pourquoi, et ce que ça coûtait : « LIMITE ASSUMÉE ET REMONTÉE : un
     * `<span>` n'est pas atteignable au clavier. Ce déclencheur est à la souris et
     * au doigt seulement, jusqu'à ce que le lot de navigation le promeuve en
     * `<button>` — c'est là que ce travail appartient, et `markTriggers` sait déjà
     * le faire (`label` donne le nom accessible). »
     *
     * C'est fait ici. Les deux icônes deviennent de vrais `<button>`, donc
     * tabulables et actionnables à Entrée et à Espace, et l'écouteur de la page ne
     * regarde plus que `data-modal-open`.
     *
     * LE MARQUEUR EST L'ATTRIBUT `title`, et c'est la maquette qui l'écrit : il
     * n'y a rien à deviner, et c'est le seul discriminant disponible — ces
     * contrôles ne contiennent qu'un `<svg>`, sans texte. Compté UNE SEULE fois
     * dans chacun des deux cadres de A01 (les trois autres occurrences du fichier
     * sont dans les colonnes de documentation de A01G, A01N et A01S, qui ne sont
     * pas ces cadres).
     *
     * `label` RECOPIE ce `title` — même mot, même source. C'est la discipline de
     * `ICON_BUTTON_NAMES` : le nom se recopie de la maquette, jamais ne s'invente.
     *
     * ── CE QUI RESTE DESSINÉ, ET POURQUOI ────────────────────────────────────
     *
     * `title="Ajouter une image"` est la TROISIÈME icône du composeur, et elle
     * n'est PAS déclarée : la maquette ne dessine AUCUNE fenêtre pour elle. Ses
     * quatre sections de modale sont A01C, A01P, A01G et A01S, et la seule qui
     * parle de pièces jointes est A01S — dont les deux cadres sont le formulaire
     * de SONDAGE (`data-screen-label="A01 Sondage et pièces jointes"`, mais la
     * planche écrit « Créer un sondage » et ne dessine aucun choisisseur de
     * fichier). Lui ouvrir A01S serait décider que « Ajouter une image » et
     * « Créer un sondage » sont le même geste. REMONTÉ, pas comblé.
     */
    triggers: [
      { marker: '</svg>{{ p.comment }}', modal: 'A01C', subject: 'p.postId' },
      { marker: '</svg>Partager', modal: 'A01P', subject: 'p.postId' },
      { marker: 'title="Lier un guide"', modal: 'A01G', label: 'Lier un guide' },
      { marker: 'title="Créer un sondage"', modal: 'A01S', label: 'Créer un sondage' },
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
    {
      section: 'A01C',
      modalTitle: 'Commentaires',
      donnees: A01C_DONNEES,
      data: './data',
      type: 'A01CData',
    },
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
    /**
     * `A01SData` ET NON `A01Data` — un TYPE PLUS ÉTROIT, et c'est ce qui rend
     * cette fenêtre réutilisable.
     *
     * Elle ne lit QUE le sondage : question, options, durées, trois
     * interrupteurs, validation. Lui demander `A01Data` entier obligeait tout
     * appelant à fournir le fil, les stories, les raccourcis et vingt autres
     * prises qu'elle n'ouvre jamais — c'est exactement ce qui a empêché
     * `/publications/nouvelle` de la monter, alors que le porteur l'attendait :
     * « Sondage et guides liés : sur mobile ça ne marche pas aussi. »
     *
     * `A01Data` ÉTEND `A01SData`, donc la page du fil continue de la nourrir en
     * s'étalant comme avant, sans une ligne de changement.
     */
    { section: 'A01S', modalTitle: 'Créer un sondage', type: 'A01SData' },
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
  {
    section: 'A13',
    dataModule: './data',
    dataType: 'A13Data',
    frames: desktopAndMobile,
    /**
     * ╔══════════════════════════════════════════════════════════════════════╗
     * ║ LA PLANCHE DE A13 CENTRE SES TROIS COLONNES — ON LES JETAIT          ║
     * ╚══════════════════════════════════════════════════════════════════════╝
     *
     * Le porteur : « La page d'un story ne s'affiche pas du tout bien et n'est
     * pas bien aligné. »
     *
     * Sa planche écrit `position:relative;display:flex;align-items:center;
     * justify-content:center;gap:40px`. L'écran pose SIX enfants à plat — le
     * logo, le voisin de gauche, un chevron, la story de 430 px, un chevron, le
     * voisin de droite — et SANS ce style ils retombaient en colonne, collés en
     * haut à gauche. C'est exactement ce que la capture montre.
     *
     * `position: relative` compte autant que le reste : le logo est posé en
     * `position: absolute; top: 24px; left: 28px`, et sans ancêtre positionné il
     * se calait sur la page entière.
     */
    keepFrameStyle: true,
    coqueRemplitLaHauteur: ['Desktop', 'Mobile'],
    /**
     * LE FOND DE LA COQUE DEVIENT UNE DONNÉE — « Le background n'est pas
     * transparent […] il doit couvrir toute la page et être transparent pour voir
     * le contenu derrière. »
     *
     * `#101A17` est juste pour une PAGE entière, et faux pour une FENÊTRE : posé
     * par-dessus le fil, cet aplat recouvre le voile et donc la page. L'écran
     * décide — `story-ecran.tsx`, prise `fondEcran`.
     */
    coqueRemplace: ['background: "#101A17"', 'background: fondEcran'],
    donnees: A13_DONNEES,
  },


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
    /**
     * ╔══════════════════════════════════════════════════════════════════════════╗
     * ║ LES QUATRE CADRES DE TÉLÉPHONE REMPLISSENT L'ÉCRAN                       ║
     * ╚══════════════════════════════════════════════════════════════════════════╝
     *
     * « ça ne s'affiche pas bien », a écrit le porteur en ouvrant cet écran — avant
     * même de parler des contrôles morts. MESURÉ AU NAVIGATEUR : la feuille du bas de
     * l'étape 2 faisait 55 px de haut dans une fenêtre de 844 px, soit 6 % au lieu des
     * 78 % que la maquette dessine. Tout le dessin de l'étape 2 était tassé.
     *
     * La raison est expliquée là où la clé agit (`generate-screens.mjs`, bloc « LA
     * COQUE REMPLIT LA HAUTEUR ») : `keepFrameStyle` garde le style de la planche mais
     * en retire la hauteur fixe — à raison — et les hauteurs en POURCENTAGE dessinées
     * à l'intérieur n'ont alors plus rien contre quoi se résoudre.
     *
     * LES QUATRE, et pas seulement celui de l'étape 2 : `MobileRattacher` porte la
     * feuille à 78 %, `MobilePhoto` le voile à 60 %, et les deux autres sont les mêmes
     * téléphones pleine hauteur — leur donner une hauteur différente ferait sauter le
     * fond coloré d'un état à l'autre.
     *
     * LE CADRE D'ORDINATEUR N'Y EST PAS : ses pourcentages se résolvent contre le
     * téléphone sombre qu'il dessine lui-même, qui a sa propre hauteur. Il n'en a pas
     * besoin, et l'ajouter changerait une géométrie que personne n'a demandé de
     * changer.
     */
    /**
     * ── « DESKTOP » S'AJOUTE, ET IL REMPLIT LA LARGEUR ──────────────────────
     *
     * Le porteur : « La page de création se plaque toujours à gauche sur une
     * partie de la page. »
     *
     * MESURÉ : la surface sombre de A14 fait 908 px dans un cadre de 1384 — elle
     * est un ÉLÉMENT FLEX du cadre, donc dimensionnée sur son contenu, et le vert
     * de l'écran se voit sur les 476 px restants. C'est exactement ce que la
     * capture montre.
     *
     * Le trio `flexGrow/Shrink/Basis` joue sur l'AXE PRINCIPAL, quel qu'il soit :
     * en colonne il remplit la hauteur — d'où le nom de la clé — et en RANGÉE,
     * ce qu'est le cadre d'ordinateur, il remplit la largeur. Un seul mécanisme,
     * deux effets, et c'est celui que la planche décrit : sa surface sombre fait
     * toute la largeur de l'image.
     */
    coqueRemplitLaHauteur: [
      'Desktop',
      'Mobile',
      'MobilePhoto',
      'MobileRattacher',
      'MobilePublier',
    ],
    donnees: A14_DONNEES,
    /**
     * ╔══════════════════════════════════════════════════════════════════════════╗
     * ║ LA FLÈCHE DE L'ÉTAPE 1 SUR MOBILE — LE FLUX MOBILE ÉTAIT UN CUL-DE-SAC   ║
     * ╚══════════════════════════════════════════════════════════════════════════╝
     *
     * MESURÉ AU NAVIGATEUR, et c'est ce qui l'a fait apparaître : la suite de tests
     * ne pouvait pas quitter l'étape 1 sur mobile. La maquette y dessine son seul
     * contrôle d'avancement en `<span>` — un rond blanc de 58 px portant une flèche
     * — donc ce n'est NI un bouton NI un lien. `BUTTON_ACTIONS` ne peut rien pour
     * lui : il ne branche que des `<button>` existants. Et le compteur de liens
     * morts ne le voyait pas davantage que le « Créer une story » de A01, pour la
     * même raison — un `<span>` n'est pas un `href="#"`.
     *
     * Conséquence avant ce lot : sur un téléphone, on écrivait sa story et on ne
     * pouvait plus avancer. Les étapes 2 et 3 n'étaient atteignables que par l'URL.
     *
     * `action` plutôt que `vers` : avancer d'une étape n'est pas une destination,
     * c'est un geste dans la page. `markLinks` en fait alors un
     * `<button type="button" onClick={onContinue}>` — le MÊME gestionnaire que le
     * « Continuer » de l'étape 2, donc il n'y a qu'une façon d'avancer.
     *
     * LE MARQUEUR EST LE TRACÉ DE LA FLÈCHE, et la remontée est vérifiée : le
     * `<path>` et le `<svg>` ne sont pas promouvables, donc elle atteint le `<span>`
     * du rond — la cible dessinée, pas l'icône.
     *
     * LE NOM EST RECOPIÉ, jamais inventé : le rond ne contient qu'un tracé, donc il
     * serait muet au lecteur d'écran et `markLinks` refuse de générer sans `nom`.
     * « Suivant » est le mot que la maquette écrit elle-même pour CE geste, sur le
     * bouton équivalent de son cadre d'ordinateur à la même étape (`webFrameFor` :
     * `next = ['Suivant', 'Continuer', 'Publier'][step]`).
     */
    liens: [
      {
        marqueur: 'M5 12h14m-6-6 6 6-6 6',
        action: 'onContinue',
        nom: 'Suivant',
        frames: ['Mobile', 'MobilePhoto'],
        why:
          'Le rond fléché de l’étape 1 mobile fait passer à l’étape 2. La maquette le dessine en ' +
          '<span> : ce n’était ni un bouton ni un lien, et le flux mobile s’arrêtait là. Même ' +
          'gestionnaire que le « Continuer » de l’étape 2.',
      },
      /**
       * LA PASTILLE « PHOTO » DE L'ÉTAPE 1 MOBILE — mesurée inerte, elle aussi.
       *
       * Le cadre d'ORDINATEUR dessine ce contrôle en `<button>`, et il est branché
       * depuis un lot précédent (`w.onPhoto`). Le cadre MOBILE le dessine en
       * `<span>` : même geste, autre balise, et donc rien ne répondait. C'est ce
       * qui rendait la VARIANTE PHOTO — le calque de texte déplaçable que le
       * porteur a photographié — INATTEIGNABLE sur téléphone, alors que c'est
       * précisément la largeur où il a dit « comme avec whatsapp ».
       *
       * LE MARQUEUR EST `</svg>Photo`, et il faut le dire : le mot « Photo » seul
       * figure dix fois dans cette maquette (le composeur du fil, les pièces
       * jointes, la fiche ville…). Collé à la fermeture du `<svg>` de son icône, il
       * ne désigne que cette pastille — et la remontée traverse le `<path>` et le
       * `<svg>`, qui ne sont pas promouvables, pour atteindre le `<span>` de la
       * pastille elle-même.
       */
      {
        marqueur: '</svg>Photo',
        action: 'onPhoto',
        frames: ['Mobile'],
        why:
          'La pastille « Photo » de l’étape 1 mobile bascule vers la variante photo — le calque ' +
          'de texte déplaçable. La maquette la dessine en <span> alors que le cadre ' +
          'd’ordinateur en fait un <button> déjà branché : le même geste n’existait que sur une ' +
          'des deux largeurs.',
      },
    ],
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
    /**
     * LA CARTE SORT DE SON CADRE — voir `composants` sur A01 pour le pourquoi.
     *
     * Le porteur : « pour tous les tabs il reprend le design des éléments
     * présentés de la façon dont ils sont présentés sur les pages d'origine ».
     * Le profil public monte donc CETTE carte-ci, pas une copie.
     */
    composants: [
      {
        nom: 'CarteGuide',
        depuis: 'guides',
        as: 'g',
        type: 'GuideCardView',
        cadres: ['Desktop', 'Mobile'],
      },
    ],
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
    /**
     * ╔════════════════════════════════════════════════════════════════════════╗
     * ║ « COMMENT COMMENTER UN GUIDE, C'EST PAS DANS LES DESIGN ? »            ║
     * ╚════════════════════════════════════════════════════════════════════════╝
     *
     * Le porteur a raison, et il faut dire exactement ce qui manque, parce que ce
     * n'est pas « tout » :
     *
     *   · la maquette dessine l'EN-TÊTE « 14 COMMENTAIRES » sur les deux planches
     *     d'ORDINATEUR de A04 (lignes 678 et 728), et RIEN dessous — après ce
     *     `<div>` vient `</div></article>`. Il n'y a donc AUCUNE section de
     *     commentaires à transcoder sur la page du guide ;
     *   · elle dessine en revanche une FEUILLE DE COMMENTAIRES complète, A01C
     *     (`data-screen-label="A01 Commentaires"`), avec son fil, ses deux onglets
     *     de tri, sa suite, son champ d'envoi et sa bande de réponse. Elle est
     *     transcodée depuis des mois (`apps/web/src/screens/a01c/`) et l'API la
     *     sert déjà pour un guide : `GET /comments` résume « Commentaires d'un
     *     sujet (POST · TOPIC · GUIDE · EVENT) », et `POST /comments` est à la
     *     capacité `comment.create` — N0, donc tout membre commente un guide ;
     *   · les deux planches MOBILES ne dessinent NI l'en-tête NI quoi que ce soit
     *     qui mène aux commentaires. Compté sur les octets : zéro occurrence de
     *     « COMMENTAIRE » dans la section `MOB`.
     *
     * On n'invente donc pas un geste mobile : ON EMPRUNTE celui que la maquette
     * dessine à 1 440 px, mot pour mot, et le journal le dit à chaque exécution.
     * C'est la sortie qu'`applyBorrows` a ouverte pour les trois planches
     * manquantes de `09 Messages`, et la règle « `into` moins l'ancre moins les
     * motifs doit être VIDE » tient ici sans `texte` : l'emprunt n'ajoute pas un
     * mot, pas un pixel, pas un style.
     *
     * ⚠ CE QUE L'EMPRUNT COÛTE, ET QU'IL FAUT SAVOIR : le nœud emprunté porte les
     * MESURES DE LA PLANCHE D'ORDINATEUR — `margin-top:28px`, `padding-top:18px`,
     * `font-size:11px`. La planche mobile du guide écrit ses propres libellés en
     * 12 px et ses marges en 16/18 px ; l'en-tête des commentaires y est donc un
     * cran plus petit que ses voisins. C'est le prix de « ne rien dessiner », et
     * il est préférable à une valeur choisie par un agent. REMONTÉ au porteur :
     * si la planche mobile gagne un jour sa propre ligne de commentaires, elle
     * remplace cet emprunt et la déclaration disparaît.
     *
     * ── POURQUOI DEUX DÉCLARATIONS ET NON UNE ────────────────────────────────
     *
     * Les deux barres basses mobiles NE SONT PAS LE MÊME NŒUD : celle du LECTEUR
     * est `display:flex;gap:8px;align-items:center` (« Ce guide vous a aidé ? »,
     * Oui, Non, crayon), celle de l'AUTEUR est `display:flex;flex-direction:column;
     * gap:8px` (les deux compteurs, Modifier, Propositions). Relevé sur les
     * octets, pas supposé régulier — une ancre partagée n'aurait trouvé qu'une
     * planche sur deux, et `applyBorrows` aurait arrêté la génération sur l'autre
     * en disant « figure 0 fois ». C'est exactement la raison pour laquelle A06
     * déclare deux fois son voile.
     *
     * ── OÙ L'EN-TÊTE ATTERRIT, ET POURQUOI LÀ ───────────────────────────────
     *
     * L'ancre est le `</div>` qui FERME la zone défilante, suivi de la barre
     * basse. `into` pose le nœud AVANT ce `</div>`, donc l'en-tête est le dernier
     * enfant de la zone qui défile — c'est-à-dire à la fin de l'article, comme la
     * planche d'ordinateur le dessine, et non collé au-dessus d'une barre qui ne
     * défile pas.
     */
    borrows: [
      /**
       * ╔════════════════════════════════════════════════════════════════════╗
       * ║ LE BANDEAU D'AVERTISSEMENT — EMPRUNTÉ À LA CARTE DE A03            ║
       * ╚════════════════════════════════════════════════════════════════════╝
       *
       * Le porteur : « Lier le bandeau du guide aux banners du serveur. »
       *
       * CE QUI MANQUAIT, et ce qui ne manquait pas — il faut séparer les deux,
       * parce que la moitié du travail était faite :
       *
       *   · le bandeau VERT était DÉJÀ conditionnel. `A04_DONNEES` le met sous
       *     `<sc-if value="{{ guide.community }}">` depuis un lot précédent, et
       *     MESURÉ sur les cadres produits : `desktop`, `mobile` et
       *     `auteurdesktop` rendent `{guide.community ? (<>…</>) : null}`. La
       *     phrase ne s'affichait donc PAS sur tous les guides ;
       *   · les DEUX AVERTISSEMENTS n'apparaissaient nulle part sur cette page.
       *     Le serveur les calcule, l'écran ne les lisait pas : un guide
       *     immobile depuis trois ans, ou signalé par assez de membres pour
       *     passer en `FLAGGED`, se lisait comme un guide à jour. C'EST LE
       *     DÉFAUT, et c'est celui-ci qu'on corrige.
       *
       * L'emprunt pose le nœud AMBRE de A03 juste AU-DESSUS du bandeau vert,
       * donc à la place exacte qu'une bande occupe dans ce cadre. Les deux
       * passent ensuite chacun sous son `<sc-if>` (voir `A04_DONNEES`), et la
       * PRIORITÉ fait qu'un seul peut être vrai — la maquette n'en dessine
       * jamais deux à la fois, ni sur la carte de A03 ni dans le cadre de A04.
       *
       * `patterns` plutôt qu'un nœud écrit ici : le garde-fou d'`applyBorrows`
       * refuse de produire le jour où le designer retire ce bandeau de A03, au
       * lieu de laisser A04 avec une bande fantôme.
       *
       * ⚠ L'EMPRUNT N'AJOUTE PAS LE `<sc-if>`, et il ne peut pas : la règle
       * « `into` moins l'ancre moins les motifs doit être VIDE » le refuserait,
       * à juste titre. C'est `A04_DONNEES` qui l'enveloppe, et c'est le bon
       * partage — l'emprunt pose du DESSIN, la donnée pose la CONDITION. Les
       * deux tournent dans cet ordre dans `generate-screens.mjs`.
       */
      {
        from: 'docs/template/03 Accueil v2.dc.html',
        patterns: [BANDEAU_AVERTISSEMENT],
        anchor: BANDEAU_COMMUNAUTE_WEB,
        into: BANDEAU_AVERTISSEMENT + BANDEAU_COMMUNAUTE_WEB,
        frames: ['Desktop', 'AuteurDesktop'],
        why: 'Le bandeau « À vérifier » est emprunté à la CARTE DE LISTE de A03 (ligne 611, seule occurrence du fichier) : aucun cadre de A04 ne le dessine, alors que le serveur calcule TO_VERIFY et OUTDATED_REPORTED pour ce guide-là.',
      },
      {
        from: 'docs/template/03 Accueil v2.dc.html',
        patterns: [BANDEAU_AVERTISSEMENT],
        anchor: BANDEAU_COMMUNAUTE_MOBILE,
        into: BANDEAU_AVERTISSEMENT + BANDEAU_COMMUNAUTE_MOBILE,
        frames: ['Mobile'],
        why: 'Le même emprunt sur la planche de 390 px de la vue LECTEUR, dont le bandeau vert n’est pas le même nœud que celui d’ordinateur (12 px, retrait 9px 16px, sans icône) — d’où une ancre à part.',
      },
      {
        from: 'docs/template/03 Accueil v2.dc.html',
        patterns: [BANDEAU_AVERTISSEMENT],
        anchor: CORPS_AUTEUR_MOBILE,
        into: BANDEAU_AVERTISSEMENT + CORPS_AUTEUR_MOBILE,
        frames: ['AuteurMobile'],
        why: 'La planche mobile de la vue AUTEUR ne dessine AUCUN bandeau — sa barre haute écrit « Votre guide ». L’avertissement s’y ancre sous cette barre, parce que c’est l’auteur qui peut mettre son guide à jour : lui cacher que le contenu est périmé ou signalé serait le pire des quatre cadres.',
      },
      /**
       * ── LE BANDEAU VERT MANQUAIT AUSSI SUR CE CADRE, ET ÇA SE MESURE ─────
       *
       * MESURÉ sur les cadres produits : `grep -c 'guide.community'` → 1 sur
       * `desktop`, 1 sur `mobile`, 1 sur `auteurdesktop`, **0 sur
       * `auteurmobile`**. L'écart était déjà remonté par la liaison du bandeau
       * (« la planche mobile de la vue AUTEUR met “Votre guide” à sa place »),
       * mais il n'était pas comblé — et le lot qui branche « Ouvrir à la
       * communauté » le rend visible : l'auteur de téléphone pouvait ouvrir son
       * guide à la communauté sans qu'AUCUN écran ne le lui confirme.
       *
       * C'est le porteur qui tranche cette famille d'écarts, et il l'a tranchée
       * plusieurs fois : « Veille toujours à ce que toutes les corrections soient
       * aussi faites sur mobile. »
       *
       * ⚠ LE NŒUD EMPRUNTÉ EST CELUI DE 390 px, pas celui d'ordinateur — `12px`,
       * retrait `9px 16px`, SANS icône. C'est la seule version juste pour ce cadre,
       * et c'est précisément le piège que ce fichier a payé cinq fois : un bandeau
       * emprunté à la planche de 1 440 px aurait porté `padding:10px 28px`, `12.5px`
       * et une icône que 390 px ne dessine pas.
       *
       * ⚠ IL SE POSE APRÈS L'AVERTISSEMENT, dans cet ordre-là, parce que c'est
       * celui des trois autres cadres : l'ambre d'abord, le vert ensuite. Les deux
       * ne peuvent pas être vrais en même temps (le serveur n'en rend qu'un, et
       * `guideHeadFrom` ne lève qu'un drapeau), donc l'ordre ne décide que de la
       * lecture du code — mais une divergence entre cadres serait un piège de
       * relecture.
       *
       * L'ANCRE EST LA MÊME que celle de l'avertissement, et elle figure toujours
       * EXACTEMENT UNE FOIS après son emprunt : `into` la recopie. L'emprunt
       * ci-dessous atterrit donc entre l'avertissement et le corps.
       */
      {
        from: 'docs/template/03 Accueil v2.dc.html',
        patterns: [BANDEAU_COMMUNAUTE_MOBILE],
        anchor: CORPS_AUTEUR_MOBILE,
        into: BANDEAU_COMMUNAUTE_MOBILE + CORPS_AUTEUR_MOBILE,
        frames: ['AuteurMobile'],
        why: 'Le bandeau vert « Maintenu par la communauté » n’était dessiné sur AUCUN cadre mobile de la vue AUTEUR (compté : 0 occurrence) — donc un auteur de téléphone qui ouvrait son guide à la communauté n’en voyait nulle part la confirmation. Emprunté au cadre de 390 px de la vue LECTEUR, qui le dessine à SA géométrie.',
      },
      {
        from: 'docs/template/03 Accueil v2.dc.html',
        patterns: [EN_TETE_COMMENTAIRES],
        anchor: BARRE_BASSE_LECTURE_MOBILE,
        into: EN_TETE_COMMENTAIRES + BARRE_BASSE_LECTURE_MOBILE,
        frames: ['Mobile'],
        why: 'L’en-tête « 14 COMMENTAIRES » est emprunté à la planche d’ORDINATEUR de A04, que la maquette dessine (lignes 678 et 728) : la planche mobile du guide n’en dessine aucune, et c’est le seul chemin vers la feuille A01C sur 390 px.',
      },
      {
        from: 'docs/template/03 Accueil v2.dc.html',
        patterns: [EN_TETE_COMMENTAIRES],
        anchor: BARRE_BASSE_AUTEUR_MOBILE,
        into: EN_TETE_COMMENTAIRES + BARRE_BASSE_AUTEUR_MOBILE,
        frames: ['AuteurMobile'],
        why: 'Le même emprunt sur la planche mobile de la VUE AUTEUR, dont la barre basse n’est pas le même nœud que celle de lecture (colonne et non rangée) — d’où une seconde déclaration plutôt qu’une ancre partagée qui n’aurait trouvé qu’un cadre.',
      },
      /**
       * ── LA FEUILLE D'ACTIONS DU « … », SUR LES DEUX CADRES DE 390 px ──────
       *
       * UNE DÉCLARATION PAR CADRE, et non une seule à `frames: ['Mobile',
       * 'AuteurMobile']` : l'ancre doit figurer EXACTEMENT UNE FOIS dans le cadre
       * visé, et `applyBorrows` tourne cadre par cadre — une déclaration unique
       * aurait marché, mais `into` et `why` auraient été partagés alors que les
       * deux cadres n'offrent pas les mêmes actions (le lecteur en a trois, et la
       * vue auteur n'a pas « Proposer une correction »). Les deux sont donc
       * écrites côte à côte, ce qui laisse la liberté de les faire diverger le jour
       * où le designer dessine la feuille d'auteur.
       */
      {
        from: 'docs/template/03 Accueil v2.dc.html',
        patterns: [
          VOILE_FEUILLE_ACTIONS,
          OUVERTURE_FEUILLE_ACTIONS,
          POIGNEE_FEUILLE_ACTIONS,
          RANGEE_FEUILLE_ACTIONS,
          '</div>',
        ],
        anchor: ENTETE_MOBILE_A04,
        into: FEUILLE_ACTIONS + ENTETE_MOBILE_A04,
        frames: ['Mobile'],
        why: 'La feuille du bas du « … » est empruntée à la planche « ADMIN · MEMBRES — menu de rôle » de la MÊME maquette (ligne 1400), la seule qui dessine une feuille du bas avec une liste d’actions : aucun cadre de A04 n’en dessine, et les trois actions du guide n’avaient aucun accès à 390 px.',
      },
      /**
       * ── LA FEUILLE DU « … » DE L'AUTEUR : L'HISTORIQUE, PAS LES ACTIONS ──
       *
       * Le pourquoi — les trois actions du lecteur étaient fausses sur son propre
       * guide, et la consigne de la maquette aurait répété sa barre basse — est
       * écrit une fois, à `FEUILLE_VERSIONS`.
       *
       * DEUX SOURCES DANS UN SEUL EMPRUNT, et c'est ce que `patterns` sert à
       * déclarer : le voile, l'ouverture et la poignée viennent de la planche
       * « ADMIN · MEMBRES — menu de rôle » (comme pour la feuille du lecteur), le
       * titre de section et la boucle viennent de la COLONNE DE DROITE de A04 à
       * 1 440 px. Les cinq sont dans la MÊME maquette, donc un seul `from`.
       */
      {
        from: 'docs/template/03 Accueil v2.dc.html',
        patterns: [
          VOILE_FEUILLE_ACTIONS,
          OUVERTURE_FEUILLE_ACTIONS,
          POIGNEE_FEUILLE_ACTIONS,
          RANGEE_FEUILLE_ACTIONS,
          TITRE_VERSIONS_WEB,
          BOUCLE_VERSIONS_WEB,
          '</div>',
        ],
        anchor: ENTETE_MOBILE_A04,
        into: FEUILLE_VERSIONS_AUTEUR + ENTETE_MOBILE_A04,
        frames: ['AuteurMobile'],
        why: 'La feuille du « … » de la VUE AUTEUR porte « HISTORIQUE DES VERSIONS » et non les trois actions du lecteur : l’API refuse « Proposer une correction » sur son propre guide (OWN_GUIDE, §2.4), les deux autres n’ont pas de sens pour lui, et sa barre basse porte DÉJÀ « Modifier » et « Propositions ». L’historique, lui, est dessiné sur les DEUX planches de 1 440 px et sur AUCUN cadre mobile — compté.',
      },
      /**
       * ╔════════════════════════════════════════════════════════════════════╗
       * ║ LES TROIS EMPRUNTS DU PLAN DES PAGES                               ║
       * ╚════════════════════════════════════════════════════════════════════╝
       *
       * Le pourquoi, le quoi et ce que chacun coûte sont écrits une fois, au
       * grand en-tête « LE PLAN DES PAGES D'UN GUIDE » de ce fichier. Ici, les
       * trois ancres et ce qu'elles placent.
       */
      {
        from: 'docs/template/03 Accueil v2.dc.html',
        patterns: [
          CARTE_PANNEAU,
          TITRE_PANNEAU + 'COMMUNAUTÉ</div>',
          LISTE_PANNEAU,
          '</div>',
          '</div>',
        ],
        anchor: COLONNE_DROITE_A04,
        into: COLONNE_DROITE_A04 + CARTE_PAGES_VIDE,
        frames: ['Desktop', 'AuteurDesktop'],
        why: 'Le panneau de pages est emprunté à la CARTE DU PANNEAU DE SECTION « COMMUNAUTÉ » de la même maquette (ligne 652) : aucun cadre de A04 ne dessine de sommaire, et c’est la seule carte dont la liste de rangées porte déjà sa surbrillance en donnée (fond #E3F0EB, encre #0F5C48). Elle est posée VIDE — sa rangée arrive par « donnees », après `markLinks`, pour ne pas dédoubler le `{{ m.icon }}` du rail.',
      },
      {
        from: 'docs/template/03 Accueil v2.dc.html',
        patterns: MOTIFS_CHEVRONS(PASTILLE_VERTE_WEB),
        anchor: '>Universel</span>',
        into: '>Universel</span>' + RANG_CHEVRONS(PASTILLE_VERTE_WEB),
        frames: ['Desktop', 'AuteurDesktop'],
        why: 'La rangée « chevron · nom de la page · chevron » est posée DANS la ligne d’étiquettes de 1 440 px, que la maquette dessine en flex : le ressort `<span style="flex:1"></span>` (50 occurrences) la pousse à l’extrémité droite, là où le porteur la demande. Les deux tracés et le rond de 32 px sont ceux de la même maquette.',
      },
      {
        from: 'docs/template/03 Accueil v2.dc.html',
        patterns: [LIGNE_FLEX_MOBILE, ...MOTIFS_CHEVRONS(PASTILLE_VERTE_MOBILE), '</div>'],
        anchor: '>Universel</span>',
        into: '>Universel</span>' + LIGNE_FLEX_MOBILE + RANG_CHEVRONS(PASTILLE_VERTE_MOBILE) + '</div>',
        frames: ['Mobile', 'AuteurMobile'],
        why: 'La même rangée sur les deux cadres de 390 px, où elle est le SEUL accès aux pages. ÉCART DE MAQUETTE : les deux étiquettes y sont en flux dans un conteneur SANS `display:flex`, donc la rangée prend celui de la ligne « Mis à jour le … » que ce cadre dessine, et se place juste SOUS les étiquettes au lieu d’à leur droite.',
      },
      {
        from: 'docs/template/03 Accueil v2.dc.html',
        patterns: [
          VOILE_FEUILLE_ACTIONS,
          OUVERTURE_FEUILLE_ACTIONS,
          POIGNEE_FEUILLE_ACTIONS,
          RANGEE_FEUILLE_PAGES,
          '</div>',
        ],
        anchor: ENTETE_MOBILE_A04,
        into: FEUILLE_PAGES + ENTETE_MOBILE_A04,
        frames: ['Mobile', 'AuteurMobile'],
        why: 'La feuille des pages du téléphone est empruntée à la MÊME planche « ADMIN · MEMBRES — menu de rôle » que celle du « … », mais à une AUTRE de ses quatre rangées : les deux feuilles atterrissent sur la même ancre, et des nœuds identiques à l’octet feraient compter deux occurrences au `fois: 1` de l’autre liaison.',
      },
    ],
    /**
     * ── LES DEUX GESTES QUI OUVRENT UNE SURFACE ─────────────────────────────
     *
     * `markTriggers` promeut le `<span>` en `<button>` et lui pose
     * `data-modal-open` ; la page écoute par délégation, exactement comme
     * « Commenter » sur le fil. Les marqueurs sont des TRACÉS, pas des libellés :
     * la maquette n'écrit aucun mot sur ces ronds, et `label` donne donc leur nom
     * accessible — sans quoi axe-core relève `button-name` en `critical`.
     *
     * CHAQUE TRACÉ FIGURE UNE FOIS PAR CADRE, compté sur les octets de la
     * section `MOB` : quatre ronds sur le cadre du lecteur, trois sur celui de
     * l'auteur (pas de signet). Les deux cadres d'ORDINATEUR sont hors de portée
     * — ils n'ont pas de barre haute de ce genre, et leur colonne d'actions porte
     * déjà les trois gestes.
     */
    triggers: [
      {
        marker: '<path d="M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>',
        modal: 'A01P',
        label: 'Partager ce guide',
        frames: ['Mobile', 'AuteurMobile'],
      },
      {
        marker: '<path d="M5 12h.01M12 12h.01M19 12h.01"/>',
        modal: 'A04MENU',
        label: 'Actions du guide',
        frames: ['Mobile', 'AuteurMobile'],
      },
    ],
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
    donnees: [...A05_MOBILE, A05_PAGES_DONNEES],
    borrows: [
      {
        from: 'docs/template/03 Accueil v2.dc.html',
        patterns: [BOUTON_IMAGE_MOBILE, FIN_BARRE_OUTILS_WEB],
        anchor: FIN_BARRE_OUTILS_WEB,
        into: BOUTON_IMAGE_MOBILE + FIN_BARRE_OUTILS_WEB,
        frames: ['Desktop'],
        why: 'Le bouton de dépôt d’image est emprunté à la barre basse du cadre de 390 px (seule occurrence du fichier) : la barre d’outils d’ORDINATEUR ne dessine que les six marques, et `POST /media` avec `kind=GUIDE` fonctionne depuis cette session.',
      },
      /**
       * ── LA CARTE DES PAGES, SUR LES DEUX CADRES — DEUX ANCRES ────────────
       *
       * Le POURQUOI et les deux écarts assumés sont écrits une fois, au-dessus de
       * `CARTE_PAGES_A05`. Ici, où elle atterrit :
       *
       *   · à 1 440 px, EN TÊTE DE LA COLONNE LATÉRALE, juste au-dessus de « AVANT
       *     DE PUBLIER » — c'est la « side bar » que le porteur nomme, et l'autre
       *     carte de cette colonne (« À PARTIR DE MON PARCOURS ») disparaît quand
       *     il n'y a pas de parcours de départ, c'est-à-dire toujours aujourd'hui ;
       *   · à 390 px, IL N'Y A PAS DE COLONNE. La carte se pose entre la rangée des
       *     trois pastilles et le segment « Écrire / Aperçu », c'est-à-dire au même
       *     rang qu'à 1 440 px — ce qui décrit le guide avant ce qui l'écrit.
       *     ⚠ ELLE PREND DE LA HAUTEUR SUR UN ÉCRAN QUI EN MANQUE : trois pages
       *     coûtent environ 150 px sur 844, repris au champ de corps (`flex: 1`).
       *     REMONTÉ : la planche de 390 px n'offre pas d'autre place, et une
       *     feuille du bas y demanderait un déclencheur que personne n'a dessiné.
       */
      {
        from: PARCOURS,
        patterns: MOTIFS_CARTE_PAGES_A05,
        anchor: ANCRE_AVANT_PUBLIER,
        into: CARTE_PAGES_A05 + ANCRE_AVANT_PUBLIER,
        frames: ['Desktop'],
        why: 'La carte des pages est empruntée au « MODE MODIFIER LES ÉTAPES » de `04 Parcours` (ligne 49), la seule planche du produit qui dessine une liste de lignes avec une corbeille par ligne et un lien vert d’ajout : aucun cadre de A05 ne dessine de pages.',
      },
      {
        from: PARCOURS,
        patterns: MOTIFS_CARTE_PAGES_A05,
        anchor: SEGMENT_ECRIRE_APERCU,
        into: CARTE_PAGES_A05 + SEGMENT_ECRIRE_APERCU,
        frames: ['Mobile'],
        why: 'Le même emprunt sur le cadre de 390 px, qui n’a PAS de colonne latérale : la carte s’ancre avant le segment « Écrire / Aperçu », donc au même rang que sur l’ordinateur.',
      },
    ],
    dataModule: './data',
    dataType: 'A05Data',
    frames: [
      /**
       * « Nouveau guide » EST DÉCLARÉ SUR LE CADRE, PAS SUR L'ÉCRAN, et il le
       * fallait : un titre d'écran vaut pour TOUS ses cadres, et celui de 390 px
       * ne l'écrit nulle part — la génération le signalait à chaque exécution
       * (« titre déclaré introuvable dans ce cadre »).
       */
      { width: 1440, name: 'Desktop', heading: 'Nouveau guide' },
      /**
       * ⚠ LE CADRE MOBILE N'A PLUS DE TITRE DÉCLARÉ, et ce n'est pas un oubli.
       *
       * Il portait `'Mon arrivée étudiante à Lyon'` — le nom du brouillon — avec
       * ce commentaire : « “Nouveau guide” est le titre du cadre d'ORDINATEUR
       * seul. Le cadre mobile met à sa place le nom du brouillon en cours ; on ne
       * lui impose pas un titre qu'il ne dessine pas. »
       *
       * CE QUE LA MESURE A MONTRÉ, et pourquoi le choix ne tient plus : ce texte
       * n'est pas un titre, c'est LE CONTENU D'UNE BOÎTE DE SAISIE — 48 px de
       * haut, bord vert de 1,5 px, celui que cette maquette dessine sur un champ
       * actif. `A05_EDITEUR` en fait un `<input>`, et un `<h1>` autour d'un champ
       * vide serait un titre sans texte, qu'axe relève en `empty-heading` : pire
       * que pas de titre.
       *
       * CONSÉQUENCE ASSUMÉE : la planche de 390 px de l'éditeur n'a PAS de `<h1>`,
       * comme celle de X01 et comme `/admin` et `/admin/membres` — la maquette n'y
       * écrit aucun titre hors du champ. `page-has-heading-one` est une règle
       * « best-practice » d'axe-core, hors du périmètre de `e2e/a11y.spec.ts`, et
       * `e2e/accueil-lot2.spec.ts` l'épingle explicitement (`h1Mobile: null`). Le
       * jour où la maquette donne un titre à cette planche, c'est ici qu'il se
       * déclare.
       */
      fromMob(3, 'MOB', 'Mobile'),
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
   *
   * ── CE QUE `regions` CHANGE, ET CE QU'IL NE CHANGE PAS ────────────────────
   *
   * Le porteur, en voyant la page : « Ça affiche une page mais c'est un modal qui
   * s'affiche à droite. » L'arbitrage ci-dessus reste JUSTE sur son propre terrain
   * — ce n'est pas une modale au sens d'`adaptModalFrame`, et le cadre d'A06 n'a
   * pas à être redécoupé — mais il laissait le geste au mauvais endroit : la seule
   * façon d'arriver au panneau était d'ouvrir une PAGE.
   *
   * `regions` sort le voile et le panneau dans leur propre fichier, SANS toucher au
   * cadre : `/guides/:slug/corriger` continue de dessiner la page entière (c'est
   * une adresse partageable, et elle garde un sens), et la page du guide (A04)
   * monte la MÊME source par-dessus elle. Une source, deux emplois — exactement le
   * marché de `composants` sur la carte de publication.
   */
  {
    section: 'A06',
    dataModule: './data',
    dataType: 'A06Data',
    donnees: A06_DONNEES,
    /**
     * ── LES DEUX FRÈRES, ET POURQUOI ILS SE COMPTENT ────────────────────────
     *
     * La région fait DEUX frères sur les deux planches : le voile, puis le panneau
     * (ou la feuille). Ils sont posés côte à côte à la fin de la colonne de
     * contenu, et `freres: 2` est donc le compte, pas une approximation — le
     * mécanisme vérifie ensuite que la coupe referme tout ce qu'elle ouvre.
     *
     * LES DEUX VOILES NE SONT PAS DE LA MÊME TEINTE : `.45` sur l'ordinateur,
     * `.5` sur le mobile. C'est relevé sur les octets de la maquette, et c'est
     * précisément pourquoi il y a deux déclarations et non une : un `debut`
     * partagé n'aurait trouvé qu'une planche sur deux, et le journal aurait dit
     * « introuvable » sur l'autre.
     */
    regions: [
      {
        nom: 'PanneauCorrection',
        cadres: ['CorrigerDesktop'],
        as: 'correction',
        type: 'CorrectionPanneauView',
        freres: 2,
        why: 'Le panneau latéral « Proposer une correction » se monte PAR-DESSUS la page du guide (A04), là où la maquette dit que le geste vit.',
        debut:
          '<div style={{ position: "absolute", inset: "0", background: "rgba(22,33,29,.45)" }}></div>',
        /**
         * ── CE QUE LA MAQUETTE NE PEUT PAS DIRE, ÉTANT UNE IMAGE DE 960 px ──
         *
         * Son panneau est `position: absolute` dans un cadre qui ne défile pas.
         * Sur une vraie page de guide — qui défile sur plusieurs milliers de
         * pixels — ce même panneau part vers le haut au premier tour de molette,
         * et le voile ne couvre que la hauteur du DOCUMENT, pas celle de l'écran.
         * MESURÉ : sur un guide de six sections, le voile faisait 3 100 px de haut
         * et le panneau se terminait hors de l'écran.
         *
         * `fixed` est la seule valeur qui rende le dessin de la maquette sur une
         * page qui défile ; tout le reste — la teinte, la largeur de 480 px, le
         * retrait de 28, l'écart de 16 — est celui de la planche, au caractère
         * près. `maxWidth: 100vw` borne le panneau sur une fenêtre plus étroite
         * que lui, et `overflowY: auto` fait défiler le formulaire DANS le
         * panneau — exactement ce que `MODAL_ADAPTATIONS` fait pour les fenêtres
         * de ce dépôt.
         */
        ajustements: [
          /**
           * ── LE VOILE DEVIENT UNE FERMETURE, ET IL FAUT QU'IL LE DEVIENNE ──
           *
           * Sur la PAGE de A06 le voile n'a rien à fermer : la page EST le
           * panneau ouvert. Monté par-dessus un guide, c'est l'inverse — et la
           * planche mobile ne dessine AUCUNE croix (elle a sa poignée, qui est un
           * dessin, pas un contrôle). Sans ce geste, la feuille ne se referme
           * qu'en envoyant : mesuré à 390 px, zéro sortie.
           *
           * C'est le même choix que `adaptModalFrame` fait pour les huit fenêtres
           * de ce dépôt — « fermeture(s) promue(s) en bouton » — appliqué ici au
           * voile. Un `<div>` à `onClick` serait le défaut d'accessibilité que ce
           * dépôt traque ; un `<button>` est annoncé, atteint au clavier, et son
           * dessin ne change pas d'un pixel.
           */
          [
            '<div style={{ position: "absolute", inset: "0", background: "rgba(22,33,29,.45)" }}></div>',
            '<button type="button" onClick={correction.onFermer} aria-label="Fermer sans envoyer" data-correction-voile="" style={{ position: "fixed", inset: "0", background: "rgba(22,33,29,.45)", border: "none", padding: "0", zIndex: 70, cursor: "pointer" }}></button>',
          ],
          [
            'position: "absolute", top: "0", right: "0", bottom: "0", width: "480px"',
            'position: "fixed", top: "0", right: "0", bottom: "0", width: "480px", maxWidth: "100vw", overflowY: "auto", zIndex: 71',
          ],
        ],
      },
      {
        nom: 'PanneauCorrection',
        cadres: ['CorrigerMobile'],
        as: 'correction',
        type: 'CorrectionPanneauView',
        freres: 2,
        why: 'La feuille du bas « Proposer une correction » se monte PAR-DESSUS la page du guide à 390 px — la même correction sur les deux planches.',
        debut:
          '<div style={{ position: "absolute", inset: "0", background: "rgba(22,33,29,.5)" }}></div>',
        /**
         * La feuille garde SES valeurs de maquette : 86 % de hauteur, rayon
         * `28px 28px 0 0`, retrait `10px 18px 26px`, poignée de 40 × 5. Seule
         * l'ancre change — `fixed` au lieu d'`absolute` — et le défilement
         * interne arrive, sans quoi les quatre blocs du formulaire débordent de
         * la feuille sur un téléphone court (mesuré à 844 px : le bouton
         * « Envoyer » tombait sous le pli).
         */
        ajustements: [
          /** Le même voile-fermeture. Voir le pourquoi sur la planche d'ordinateur. */
          [
            '<div style={{ position: "absolute", inset: "0", background: "rgba(22,33,29,.5)" }}></div>',
            '<button type="button" onClick={correction.onFermer} aria-label="Fermer sans envoyer" data-correction-voile="" style={{ position: "fixed", inset: "0", background: "rgba(22,33,29,.5)", border: "none", padding: "0", zIndex: 70, cursor: "pointer" }}></button>',
          ],
          [
            'position: "absolute", left: "0", right: "0", bottom: "0", height: "86%"',
            'position: "fixed", left: "0", right: "0", bottom: "0", height: "86%", overflowY: "auto", zIndex: 71',
          ],
        ],
      },
    ],
    frames: [
      { width: 1440, name: 'Desktop', occurrence: 1 },
      { width: 390, name: 'Mobile', occurrence: 1, heading: 'Propositions reçues' },
      /**
       * LES DEUX CADRES EMPRUNTÉS, SUR LA MÊME OCCURRENCE QUE « Propositions
       * reçues » — c'est-à-dire la MÊME planche, lue une seconde fois. Voir le
       * grand en-tête « LA MAQUETTE NE DESSINE AUCUNE PAGE DE SIGNALEMENTS ».
       *
       * `heading` est celui que la maquette ÉCRIT, pas celui qu'on affichera : le
       * cadre de 390 px n'a pas de `<h2>`, donc `promoteTitle` cherche le texte
       * déclaré — et `retitrerSurDonnees` le reprend ensuite sur sa forme LIÉE
       * (`{signalements.titre}`), parce qu'une liaison porte le même nœud. Déclarer
       * directement le nouveau titre l'aurait rendu introuvable.
       */
      { width: 1440, name: 'SignalementsDesktop', occurrence: 1 },
      {
        width: 390,
        name: 'SignalementsMobile',
        occurrence: 1,
        heading: 'Propositions reçues',
      },
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
      {
        /**
         * ╔══════════════════════════════════════════════════════════════════╗
         * ║ LA PLANCHE DE 390 px MENTAIT ENCORE — piège n° 5, pris sur le   ║
         * ║ fait                                                            ║
         * ╚══════════════════════════════════════════════════════════════════╝
         *
         * La liaison au-dessus porte `frames: ['Desktop']`, et le mémo le dit
         * en toutes lettres : « une liaison qui ne nomme qu'un cadre laisse les
         * autres mentir ». C'est arrivé.
         *
         * MESURÉ au navigateur, fenêtre de 390 px, sur `/reseaux/pays-bj` : le
         * cadre d'ordinateur écrivait « 2 571 membres · réseau de pays · vous
         * êtes membre » et le cadre mobile, au même instant, « 890 membres ·
         * vous êtes membre ». Le second est le littéral de la maquette, intact.
         * Aucun test ne le voyait : `reseau-entete.spec.ts` se SAUTE lui-même à
         * 390 px, et son en-tête dit pourquoi (« la planche de 390 px ne dessine
         * pas le nombre de membres ») — ce qui était vrai de la planche A08T et
         * faux de celle-ci.
         *
         * ⚠ LA PRISE N'EST PAS LA MÊME QUE SUR L'AUTRE CADRE, et c'est la
         * maquette qui le décide : elle n'écrit PAS le genre du réseau ici
         * (« 890 membres · vous êtes membre », deux morceaux contre trois).
         * `resumeCourt` compose ces deux-là et leur séparateur, exactement comme
         * `resume` compose les trois — réemployer `resume` aurait ajouté
         * « réseau de pays » à un dessin qui ne le porte pas.
         */
        noeud: '>890 membres · vous êtes membre<',
        devient: '>{{ reseau.resumeCourt }}<',
        fois: 1,
        frames: ['Mobile'],
        why: 'La ligne de résumé de la planche de 390 px écrivait encore « 890 membres » — le littéral de la maquette — pendant que celle de 1 440 px disait la vérité. MESURÉ au navigateur.',
      },
    ],
    dataModule: './data',
    dataType: 'A08Data',
    frames: [{ width: 1440, name: 'Desktop' }, fromMob(5)],
    /**
     * ╔════════════════════════════════════════════════════════════════════════╗
     * ║ LE MENU DE GAUCHE ET LA BARRE HAUTE, EXTRAITS POUR LES VINGT-CINQ      ║
     * ║ PLANCHES D'ONGLET                                                      ║
     * ╚════════════════════════════════════════════════════════════════════════╝
     *
     * Le porteur, capture à l'appui : « la page de fil d'actualité N'A PAS DE
     * MENU DE GAUCHE ».
     *
     * ── CE QUE LA MAQUETTE DESSINE, MESURÉ AVANT DE CONCLURE ────────────────
     *
     * La section A08T porte sa propre légende, et elle tranche la question :
     * « zone de contenu seule · MENU DE GAUCHE ET BARRE HAUTE IDENTIQUES À A08 ».
     * Ce n'est donc pas un manque de la maquette — c'est une consigne : les
     * vingt-cinq planches d'onglet ne REDESSINENT pas le menu parce qu'il est
     * déjà dessiné, une fois, sur A08. Relevé à l'appui : `grep RailSurvol` rend
     * zéro sur les vingt-cinq cadres d'onglet et trois sur A08.
     *
     * On EMPRUNTE donc, au lieu de redessiner — et `regions` est le mécanisme qui
     * existe pour ça : une seule source, deux emplois. A08 garde son cadre
     * entier, inchangé au caractère près, et `reseau-screen.tsx` monte les deux
     * morceaux autour de la planche d'onglet.
     *
     * ── DEUX RÉGIONS ET NON UNE, PARCE QUE LA MAQUETTE LES SÉPARE ───────────
     *
     * La colonne de gauche et la barre de recherche ne sont PAS frères : la
     * première est le premier enfant du cadre, la seconde vit DANS la colonne de
     * droite, au-dessus du contenu. Une coupe unique aurait emporté le contenu de
     * A08 — ses sujets — avec elles.
     *
     * ⚠ RIEN N'EST EXTRAIT DU CADRE MOBILE, et c'est mesuré : à 390 px les
     * planches MOB2 sont des téléphones COMPLETS, barre basse comprise (relevé :
     * le lien « Accueil » de la barre basse est à y = 766 sur l'onglet « Fil »).
     * Il n'y manque rien, donc il n'y a rien à emprunter.
     */
    regions: [
      {
        nom: 'ChromeGauche',
        cadres: ['Desktop'],
        prises: ['rail', 'panelReseaux'],
        type: 'A08Data',
        freres: 1,
        why: 'Le menu de gauche de A08, monté autour des vingt-cinq planches d’onglet — la maquette dit « menu de gauche identique à A08 », et c’est donc un emprunt, pas un dessin.',
        debut:
          '<div data-zone="gauche" style={{ width: "400px", flexShrink: "0", display: "flex", flexDirection: "column", padding: "0 24px", position: "sticky", top: "0", alignSelf: "flex-start", maxHeight: "100vh", overflowY: "auto" }}>',
      },
      {
        nom: 'BarreHaute',
        cadres: ['Desktop'],
        /**
         * AUCUNE PRISE, et ce n'est pas un oubli : les quatre contrôles de cette
         * barre — créer, messages, notifications, pastille du membre — sont des
         * COMPOSANTS qui vont chercher leur état eux-mêmes, et le seul texte
         * dessiné (« Rechercher dans la diaspora ») est un libellé de maquette.
         * La région ne lit donc rien, et sa fonction ne prend aucun paramètre.
         */
        prises: [],
        type: 'A08Data',
        freres: 1,
        why: 'La barre haute de A08 — recherche, créer, messages, notifications, pastille — montée au-dessus des planches d’onglet, qui ne la dessinent pas.',
        /**
         * LA BARRE EST MAINTENANT L'EN-TÊTE GLOBAL (`adaptations/entete-global.mjs`) :
         * un `<header>` fixe sur toute la largeur — logo, recherche centrée, contrôles —
         * et non plus la rangée de 64 px de la colonne de droite. La région en prend
         * donc l'élément entier. Elle ne laisse plus de place dans le flux : l'écran qui
         * la monte (`reseau-screen.tsx`) pose lui-même l'espace de 64 px sous la barre.
         */
        debut: '<header data-entete-globale="" ',
      },
    ],
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
    /**
     * L'EMPRUNT DE « ALBUM — SÉLECTION » : voir l'en-tête de
     * `PASTILLES_ALBUM_MOBILE`. Le quatrième cadre de l'onglet « Album » est le
     * seul des quatre à ne dessiner ni la rangée de pastilles ni le bouton
     * flottant ; les deux lui viennent de son frère de MÊME LARGEUR.
     *
     * UN SEUL EMPRUNT POUR LES DEUX FRAGMENTS, et une seule ancre : la bande de
     * sélection est le seul nœud que ce cadre dessine et que ses frères n'ont
     * pas, donc le seul qui figure EXACTEMENT UNE FOIS — ce que `applyBorrows`
     * exige. Les deux fragments sont posés AVANT elle, donc en tête du conteneur
     * de contenu, là où `AlbumMobile` dessine sa rangée.
     *
     * ⚠ LE BOUTON FLOTTANT SE MOQUE DE SA PLACE DANS L'ARBRE : la règle de style
     * « Le bouton flottant se cale sur la fenêtre » (`generate-screens.mjs`) le
     * passe en `position: fixed` dès qu'elle voit `right: 18px` et
     * `bottom: 108px`, et le conteneur de contenu est lui-même passé en
     * `overflow: visible` par une autre règle. Il se peint donc au coin de la
     * fenêtre, exactement comme celui de `AlbumMobile`.
     */
    borrows: [
      {
        from: 'docs/template/03 Accueil v2.dc.html',
        patterns: [PASTILLES_ALBUM_MOBILE, BOUTON_FLOTTANT_ALBUM_MOBILE],
        anchor: BANDE_SELECTION_ALBUM_MOBILE,
        into:
          PASTILLES_ALBUM_MOBILE +
          BOUTON_FLOTTANT_ALBUM_MOBILE +
          BANDE_SELECTION_ALBUM_MOBILE,
        frames: ['AdminAlbumMobile'],
        why: 'La planche « Album — sélection » (390 px) ne dessine NI la rangée de pastilles NI le bouton d’ajout — compté sur les octets de la maquette. Les deux sont empruntés à « Album » de la MÊME section MOB2 et de la MÊME largeur, donc sans aucune mesure transposée : le porteur veut les trois onglets par défaut et le bouton « Ajouter » sur les quatre cadres, et une correction qui ne prendrait pas sur mobile est l’oubli le plus fréquent de ce dépôt.',
      },
    ],
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
     * ⚠ CE PARAGRAPHE DISAIT QUE LE CONTENU DES ONGLETS N'ÉTAIT PAS LIÉ — « les
     * photos de l'album, les événements, les publications du fil, les lignes de
     * membres […] `use-reseau.ts` n'en appelle aujourd'hui que deux ». C'est
     * PÉRIMÉ : les quatre sont branchés, par quatre adaptations de
     * `generate-screens.mjs` (`A08T_FIL_PUBLICATIONS`,
     * `A08T_MEMBRES_VUE_MEMBRE`, `A08T_EVENEMENTS`, `A08T_ALBUM`) et par autant
     * d'effets par onglet dans `use-reseau.ts`, qui appelle maintenant
     * `GET /communities/:id/{members,topics,albums,...}`, `GET /feed?communityId=`
     * et `GET /events?communityId=`.
     *
     * Ce que la clé `donnees` lie ici reste l'EN-TÊTE : le contenu d'un onglet
     * demande une BOUCLE sur une liste, ce qu'une liaison de nœud ne sait pas
     * faire — d'où les adaptations.
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
      // ══ LES COMPTEURS DE LA GESTION, et les trois qui n'ont pas de source ══
      //
      // « 4 » était peint en dur QUATRE fois sur la planche « Gérer » — le titre
      // de la carte, l'entrée du rail, la tuile, et la pastille de l'onglet
      // « Membres » (celle-ci était déjà liée). Un propriétaire sans aucune
      // demande en attente lisait donc « DEMANDES D'ADHÉSION · 4 » au-dessus
      // d'une liste vide, et quatre affirmations fausses au même endroit.
      //
      // ⚠ DEUX COMPTEURS DE CETTE PLANCHE RESTENT DESSINÉS, et il faut le dire
      // plutôt que de les inventer :
      //   · « 61 % actifs sur 30 jours » — aucune route ne le calcule ;
      //   · « +34 ce mois » — idem.
      // REMONTÉS : il faudrait une route de tableau de bord du réseau.
      //
      // ⚠ « SIGNALEMENTS · 2 » ÉTAIT LE TROISIÈME DE CETTE LISTE, et il n'y est
      // plus. Le constat était juste : le module de modération n'exposait aucune
      // route rendant les signalements d'un réseau. `GET /communities/:id/reports`
      // existe depuis ce lot, avec son `meta.open`, et les CINQ endroits où la
      // maquette écrit ce nombre le lisent maintenant — le titre de la carte,
      // l'entrée du rail, la tuile de la vue d'ensemble, et les deux jumelles
      // mobiles. Les rangées, elles, sont mises en boucle par
      // `A08T_GERER_SIGNALEMENTS`.
      {
        noeud: '>DEMANDES D’ADHÉSION · 4<',
        devient: '>DEMANDES D’ADHÉSION · {{ reseau.demandes }}<',
        fois: 1,
        frames: ['AdminGerer'],
        why: 'Le titre de la carte des demandes, de `GET /communities/:slug/members?pending=true` — le même nombre que la pastille de l’onglet « Membres », donc la même prise.',
      },
      {
        noeud: '>Demandes d’adhésion · 4<',
        devient: '>Demandes d’adhésion · {{ reseau.demandes }}<',
        fois: 1,
        frames: ['AdminGerer'],
        why: 'L’entrée « Demandes d’adhésion » du rail de gestion porte le même nombre que la carte : une seule prise pour les deux.',
      },
      {
        noeud:
          '<div style="font-size:24px;font-weight:800;letter-spacing:-0.6px;color:#B4581F">4</div><div style="font-size:12px;color:#5D6B66;margin-top:2px">demandes en attente</div>',
        devient:
          '<div style="font-size:24px;font-weight:800;letter-spacing:-0.6px;color:#B4581F">{{ reseau.demandes }}</div><div style="font-size:12px;color:#5D6B66;margin-top:2px">demandes en attente</div>',
        fois: 1,
        frames: ['AdminGerer'],
        /**
         * L'ANCRE PORTE LES DEUX LIGNES DE LA TUILE, comme celle des membres :
         * « 4 » seul figure aussi dans le titre de la carte et dans l'entrée du
         * rail, et une ancre sur le chiffre nu lierait la première occurrence
         * venue. Le libellé « demandes en attente » est le discriminant, et sa
         * couleur `#B4581F` distingue cette tuile de celle des signalements, qui
         * affiche « 2 » dans le même orange.
         */
        why: 'La tuile « demandes en attente » de la vue de gestion — même source que le titre de la carte.',
      },
      // ══ LES CINQ ENDROITS OÙ LA PLANCHE ÉCRIT LE NOMBRE DE SIGNALEMENTS ══
      //
      // Ils disent tous `gerer.signalementsOuverts`, c'est-à-dire `meta.open` de
      // `GET /communities/:id/reports` — JAMAIS la longueur de la liste rendue,
      // qui est bornée à cinquante rangées. C'est le défaut que cette maquette a
      // déjà payé quatre fois sur « DEMANDES D'ADHÉSION · 4 » : un compte déduit
      // d'une page tronquée est une affirmation fausse affichée comme un compte.
      {
        noeud: '>SIGNALEMENTS · 2<',
        devient: '>SIGNALEMENTS · {{ gerer.signalementsOuverts }}<',
        fois: 1,
        frames: ['AdminGerer'],
        why: 'Le titre de la carte des signalements, de `meta.open` de `GET /communities/:id/reports` — un nombre qui ne venait de NULLE PART avant ce lot.',
      },
      {
        noeud: '>Signalements · 2<',
        devient: '>Signalements · {{ gerer.signalementsOuverts }}<',
        fois: 1,
        frames: ['AdminGerer', 'AdminGererMobile'],
        /**
         * LE MÊME TEXTE SUR LES DEUX PLANCHES, et les deux cadres l'écrivent à
         * l'identique — c'est l'entrée du rail de gestion à 1 036 px et la
         * pastille de l'onglet à 390 px. Les styles diffèrent (44 px contre
         * 36 px, `transparent` contre `#fff`), mais l'ancre ne porte que le
         * TEXTE : c'est précisément ce que le piège n° 1 recommande, ancrer sur
         * la structure et non sur une mesure.
         */
        why: 'L’entrée « Signalements » du rail de gestion et sa pastille mobile — le même nombre que le titre de la carte, donc la même prise.',
      },
      {
        noeud:
          '<div style="font-size:24px;font-weight:800;letter-spacing:-0.6px;color:#B4581F">2</div><div style="font-size:12px;color:#5D6B66;margin-top:2px">signalements ouverts</div>',
        devient:
          '<div style="font-size:24px;font-weight:800;letter-spacing:-0.6px;color:#B4581F">{{ gerer.signalementsOuverts }}</div><div style="font-size:12px;color:#5D6B66;margin-top:2px">signalements ouverts</div>',
        fois: 1,
        frames: ['AdminGerer'],
        /**
         * L'ANCRE PORTE LES DEUX LIGNES DE LA TUILE, comme celle des demandes :
         * « 2 » seul figure aussi dans le titre de la carte et dans l'entrée du
         * rail, et une ancre sur le chiffre nu lierait la première occurrence
         * venue. Le libellé « signalements ouverts » est le discriminant — et
         * c'est le MÊME orange `#B4581F` que la tuile des demandes, donc la
         * couleur ne distingue rien ici.
         */
        why: 'La tuile « signalements ouverts » de la vue de gestion — même source que le titre de la carte.',
      },
      {
        noeud:
          '<div style="font-size:20px;font-weight:800;color:#B4581F">2</div><div style="font-size:11.5px;color:#5D6B66">signalements</div>',
        devient:
          '<div style="font-size:20px;font-weight:800;color:#B4581F">{{ gerer.signalementsOuverts }}</div><div style="font-size:11.5px;color:#5D6B66">signalements</div>',
        fois: 1,
        frames: ['AdminGererMobile'],
        why: 'La même tuile aux mesures du téléphone — la correction prend sur les DEUX planches.',
      },
      {
        noeud:
          '<div style="font-size:20px;font-weight:800;color:#B4581F">4</div><div style="font-size:11.5px;color:#5D6B66">demandes</div>',
        devient:
          '<div style="font-size:20px;font-weight:800;color:#B4581F">{{ reseau.demandes }}</div><div style="font-size:11.5px;color:#5D6B66">demandes</div>',
        fois: 1,
        frames: ['AdminGererMobile'],
        why: 'La même tuile aux mesures du téléphone — la correction prend sur les DEUX planches.',
      },
      {
        /**
         * ╔══════════════════════════════════════════════════════════════════════╗
         * ║ UNE PHRASE DE LA MAQUETTE EST DEVENUE FAUSSE                         ║
         * ╚══════════════════════════════════════════════════════════════════════╝
         *
         * Sous l'interrupteur « Notifier », la planche écrit « Une seule
         * notification, même pour les membres en sourdine. » C'était vrai quand
         * la sourdine n'existait pas. §2.3 veut prévenir « tous les membres NON
         * EN SOURDINE », et le filtre existe : la phrase affirme donc
         * exactement l'inverse de ce que le produit fait.
         *
         * ON NE TOUCHE PAS À LA MAQUETTE — `docs/` est en lecture seule, et c'est
         * l'ÉCRAN qui doit dire vrai. La phrase devient donc une donnée, comme
         * tout le reste de ce fichier, et sa valeur est dans `a08t/data.ts`.
         *
         * ⚠ LA PLANCHE DE 390 px NE DESSINE PAS CETTE PHRASE : son formulaire
         * d'annonce s'arrête à l'interrupteur « Notifier les 890 membres ». Il n'y
         * a donc rien à corriger là, et rien à ajouter — l'ajouter serait dessiner
         * à la place du porteur. REMONTÉ.
         */
        noeud: '>Une seule notification, même pour les membres en sourdine.<',
        devient: '>{{ notifierSourdine }}<',
        fois: 1,
        frames: ['AdminAnnonce'],
        why: 'La précision sous l’interrupteur « Notifier » : depuis que le filtre de sourdine existe, « même pour les membres en sourdine » est faux (§2.3 — « tous les membres non en sourdine »). La phrase est liée pour pouvoir dire la vérité sans retoucher la maquette.',
      },
    ],
  },

  /** A09 — un sujet du réseau. `/reseaux/:slug/sujets/:id` */
  {
    section: 'A09',
    donnees: [...A09_MOBILE, ...A09_TETE],
    dataModule: './data',
    dataType: 'A09Data',
    frames: [
      { width: 1440, name: 'Desktop' },
      fromMob(6, 'MOB', 'Mobile', 'Renouveler son passeport béninois depuis la France'),
    ],
  },

  /**
   * A10 — créer un réseau. `/reseaux/nouveau`
   *
   * ── LE COMPTEUR D'INVITATIONS MENTAIT SUR LES DEUX PLANCHES ───────────────
   *
   * Mesuré sur les cadres produits, avant ce lot : « 3 sur 5 » en pastille, une
   * barre remplie à 60 % et « Invitez encore 2 membres » — les trois peints en
   * dur, sur un écran où AUCUNE invitation n'était choisie. C'est le défaut que
   * ce fichier a déjà payé trois fois sur A04 : la génération réussit, le cadre
   * compile, et c'est l'écran qui ment.
   *
   * Les trois morceaux sont liés SÉPARÉMENT par planche quand leur dessin diffère,
   * et c'est la règle du piège 1 : la barre de l'ordinateur écrit
   * `border-radius:999px` et celle du téléphone non ; la phrase d'ordinateur dit
   * « pour créer le réseau » et celle du téléphone s'arrête avant. Une seule
   * liaison ancrée sur l'une des deux formes n'aurait décrit qu'un cadre.
   *
   * « Invitez au moins 5 membres » RESTE DESSINÉ, et c'est volontaire : c'est la
   * RÈGLE (`COMMUNITY_MIN_INVITES`), pas une donnée du formulaire. Le lier ferait
   * croire qu'elle varie. Même arbitrage que le « / 500 » de A08T.
   */
  {
    section: 'A10',
    donnees: [
      ...A10_MOBILE,
      {
        noeud: '>3 sur 5<',
        devient: '>{{ invitesTexte }}<',
        fois: 1,
        why: 'La pastille de progression des invitations — comptée sur les handles DÉDOUBLONNÉS, comme `createCommunitySchema` les compte avant de refuser. Les deux cadres l’écrivent à l’identique.',
      },
      {
        noeud:
          '<div style="width:60%;height:100%;background:#E0733A;border-radius:999px"></div>',
        devient:
          '<div style="width:{{ invitesBarre }};height:100%;background:#E0733A;border-radius:999px"></div>',
        fois: 1,
        frames: ['Desktop'],
        why: 'La barre de progression des invitations. Le rayon n’est écrit QUE sur la planche d’ordinateur : deux dessins, donc deux liaisons.',
      },
      {
        noeud: '<div style="width:60%;height:100%;background:#E0733A"></div>',
        devient: '<div style="width:{{ invitesBarre }};height:100%;background:#E0733A"></div>',
        fois: 1,
        frames: ['Mobile'],
        why: 'La même barre sur la planche de 390 px, qui ne dessine pas de rayon.',
      },
      {
        noeud: '>Invitez encore 2 membres pour créer le réseau.<',
        devient: '>{{ invitesReste }}<',
        fois: 1,
        frames: ['Desktop'],
        /**
         * LA PHRASE ENTIÈRE, séparateurs et point compris — et non le seul nombre.
         * Quand les cinq invitations sont réunies, il n'y a plus rien à demander :
         * une liaison sur « 2 » seul laisserait « Invitez encore 0 membres pour
         * créer le réseau. » à l'écran au moment précis où le bouton s'allume.
         * C'est le même arbitrage que `reseau.resume` sur A08.
         */
        why: 'Ce qu’il reste à faire avant de créer, ou rien quand le compte est atteint — la phrase entière, pour qu’elle puisse disparaître.',
      },
      {
        noeud: '>Invitez encore 2 membres.<',
        devient: '>{{ invitesResteCourt }}<',
        fois: 1,
        frames: ['Mobile'],
        why: 'La même phrase, dans la forme RACCOURCIE que la planche de 390 px écrit faute de place.',
      },
    ],
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
].map((s) => {
  /**
   * LA NAVIGATION SE COMPOSE, elle ne se remplace pas.
   *
   * Trois sources, et chacune a sa raison d'exister séparément :
   *
   *   · le SQUELETTE — rail et panneau de section — commun aux onze écrans qui le
   *     dessinent, déclaré une fois dans `tools/squelette-membre.mjs` ;
   *   · ce que l'ÉCRAN ajoute — sa barre basse, ses onglets, ses liens nommés
   *     (`LIENS_PAR_ECRAN`) ;
   *   · ce que la déclaration porte elle-même (`s.liens`), pour un cas isolé.
   *
   * L'ancienne forme écrivait `liens` AVANT `...s` : une déclaration qui aurait
   * posé son propre `liens` aurait donc EFFACÉ le squelette en silence, et le rail
   * serait redevenu mort sur cet écran sans qu'aucun compte ne bouge. On concatène.
   */
  const liens = [
    ...(SQUELETTE_EN_BOUCLE.has(s.section) ? squeletteBoucle(cadresDuRail(s.frames)) : []),
    ...(LIENS_PAR_ECRAN[s.section] ?? []),
    ...(s.liens ?? []),
  ];
  return {
    // Les déclarations du lot 1 portent déjà leur fichier, leur sortie et leur module
    // de données ; celles du lot 2 les prennent par défaut, pour que la déclaration
    // ne dise que ce qui la distingue.
    file: FILE,
    ...DATA,
    out: `apps/web/src/screens/${s.section.toLowerCase()}`,
    ...s,
    ...(liens.length === 0 ? {} : { liens }),
  };
});
