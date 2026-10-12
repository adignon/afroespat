/**
 * Les écrans de `docs/template/05 Entraide.dc.html`.
 *
 * Un fichier par maquette : voir l'en-tête de `01-onboarding.mjs` pour la raison.
 *
 * ─── CETTE MAQUETTE N'A PAS DE DIALECTE, ET C'EST `donnees` QUI S'EN CHARGE ───
 *
 * `01 Accès et Onboarding` et `03 Accueil v2` écrivent leurs valeurs dans un
 * `renderVals()` et les interpolent — `{{ p.comment }}`, `<sc-for>`. Les sept
 * autres maquettes, dont celle-ci, ne le font PAS : leur `renderVals()` rend `{}`
 * et tout le contenu est écrit en clair dans le HTML.
 *
 * L'en-tête de ce fichier disait, et c'était exact pour le lot où il a été écrit :
 * « ces quatorze cadres n'ont AUCUNE donnée à reprendre […] les composants générés
 * reçoivent `_props` ». Le souligné disait que le paramètre n'était pas lu : ces
 * écrans recevaient des données et les IGNORAIENT, faute d'avoir où les mettre.
 *
 * On ne crée PAS la prise en ajoutant des `{{ }}` dans `docs/template/` — le
 * porteur a été formel, on ne réécrit pas les maquettes — et pas davantage en
 * retouchant les `*.generated.tsx`, que la régénération suivante efface. On la
 * DÉCLARE, ici, avec l'écran : c'est la clé `donnees`, dont
 * `tools/generate-screens.mjs` porte le raisonnement complet et les quatre
 * contrôles. Ce qu'il faut en savoir pour lire ce fichier :
 *
 *   · `noeud` est le littéral de la maquette, VERBATIM, avec ses délimiteurs
 *     (`>Lyon<`) — sans eux, « Lyon » serait attrapé au milieu d'une phrase ;
 *   · `fois` dit combien de fois la maquette l'écrit DANS CE CADRE, et la
 *     génération ÉCHOUE si le compte ne tombe pas juste. Chaque nombre de ce
 *     fichier a été COMPTÉ sur les octets de la maquette, cadre par cadre, pas
 *     deviné ;
 *   · `devient` est la réécriture dans le dialecte, et rien de plus : ce qui en
 *     reste quand on ôte les interpolations doit être dessiné dans `noeud`, dans
 *     l'ordre où la maquette le dessine ;
 *   · `frames` sépare les deux cadres, qui n'ont PAS le même contenu — le mobile
 *     de H02 écrit « Studio vide à Lyon 3e, récupération samedi. » là où
 *     l'ordinateur écrit le corps entier.
 *
 * Les valeurs vivent dans le `data.ts` DE CHAQUE ÉCRAN (`screens/h01/data.ts` …
 * `screens/h10/data.ts`) —
 * un type PAR ÉCRAN, pas un type partagé par le module : sinon chaque page devrait
 * fournir les champs de toutes les autres. Les appels vivent dans
 * `apps/web/src/screens/entraide/appels.ts`. Le JSX transcodé n'a pas bougé.
 *
 * ─── LE TITRE DE CHAQUE CADRE EST DÉCLARÉ ──────────────────────────────────────
 *
 * Aucune section de cette maquette ne contient de `<h2>` : son unique `<h1>` est
 * celui de la planche de documentation, hors section. Le titre de page est donc
 * déclaré ici, avec son TEXTE VISIBLE, et le générateur promeut l'élément qui le
 * porte en `<h1>` (voir `titleFor` et `promoteTitle` : `title` répond à LEQUEL des
 * titres, son discriminant à QUEL texte promouvoir).
 *
 * Les deux cadres d'un même écran ne le disent pas toujours pareil, et c'est la
 * maquette qui en décide : H09 titre « Mes demandes » sur ordinateur, mais
 * « Fil d'entraide » sur mobile — parce que le mobile range « Mes demandes » dans
 * une pastille sous un en-tête commun. Un titre déduit aurait gommé cet écart.
 */

/** Les deux cadres que chaque section dessine, ordinateur puis mobile. */
import { railLitteral } from '../squelette-membre.mjs';
import { barreBasse } from '../squelette-membre.mjs';

const both = (desktop, mobile) => [
  { width: 1440, name: 'Desktop', title: desktop },
  { width: 390, name: 'Mobile', title: mobile },
];

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LES SEPT ENTRÉES DU PANNEAU — « LES SOUS LIENS », ET LE COMPTEUR NE LES     ║
 * ║ VOYAIT PAS                                                                 ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le récapitulatif « ── NAVIGATION ── » compte les `href="#"`. Ces sept entrées
 * n'en ont aucun : la maquette les dessine en `<span>`, exactement comme elle
 * dessinait les cinq entrées du rail. Ce ne sont donc pas des liens cassés, CE NE
 * SONT PAS DES LIENS — invisibles au compteur, et pourtant c'est précisément ce
 * sur quoi le porteur a cliqué (« Aucun sous lien aussi ne fonctionne »). Les
 * promouvoir ne fera pas bouger le chiffre d'une unité ; le gain est compté à
 * part dans le rapport.
 *
 * ── LE MARQUEUR N'EST PAS LE LIBELLÉ SEUL, ET C'EST MESURÉ ──────────────────
 *
 * `markLinks` remonte du marqueur jusqu'à la PREMIÈRE balise promouvable qui le
 * contient. Or la maquette enferme chaque libellé dans un
 * `<span style="flex:1">` À L'INTÉRIEUR de la ligne : un discriminant `texte`
 * s'arrêterait sur CE span, et promouvrait le libellé au lieu de la ligne. La
 * zone cliquable aurait alors fait la largeur du mot au lieu des 44 px de la
 * ligne, sans que rien ne le signale — c'est le défaut que
 * `tools/squelette-membre.mjs` a déjà payé sur le panneau en boucle.
 *
 * Le marqueur commence donc au `</svg>` qui précède : la remontée traverse
 * `<path>` et `<svg>`, qui ne sont pas promouvables, et atteint la LIGNE. Il
 * inclut le libellé, ce qui le rend unique dans le cadre — les tracés d'icône, eux,
 * ne le sont pas (« Toutes les demandes » et « Mes annonces » partagent le tracé
 * de la liste, et `M4 5h16v11H9l-5 4z` figure deux fois par cadre). `fois: 1`
 * recompte à chaque génération.
 *
 * ── LES SEPT DESTINATIONS SONT RECOPIÉES, PAS DÉDUITES ─────────────────────
 *
 * Chacune est la route que `T5 §5` donne à la planche correspondante, et que
 * `apps/web/src/app/(app)/` sert : les sept entrées du panneau sont exactement les
 * sept sections H de cette maquette. La correspondance n'est pas une
 * interprétation du libellé — c'est le `out:` de chaque écran de ce fichier.
 */
const ENTREES_PANNEAU_ENTRAIDE = [
  ['Toutes les demandes', '/entraide', 'H01'],
  ['Vous pouvez aider', '/entraide/aider', 'H04'],
  ['Mes demandes', '/entraide/mes-demandes', 'H09'],
  ['Mes réponses', '/entraide/mes-reponses', 'H10'],
  ['Trouver un parrain', '/parrainage', 'H05'],
  ['Mes parrainages', '/parrainage/mes-parrainages', 'H07'],
  ['Devenir parrain', '/parrainage/devenir', 'H08'],
];

/** Les sept entrées, bornées aux cadres d'ordinateur : le mobile ne les dessine pas. */
const panneauEntraide = (frames) =>
  ENTREES_PANNEAU_ENTRAIDE.map(([libelle, vers, planche]) => ({
    marqueur: `</svg><span style="flex:1">${libelle}</span>`,
    vers,
    frames,
    why:
      `L’entrée « ${libelle} » du panneau de section mène à ${vers} — la route que T5 §5 ` +
      `donne à ${planche}, et que cette maquette dessine sous ce numéro. La maquette ` +
      'l’écrit en <span> : ce n’était pas un lien cassé, ce n’était pas un lien.',
  }));

/**
 * ─── LE BANDEAU DE SECTION, LIÉ SUR LES DIX CADRES D'ORDINATEUR ─────────────
 *
 * Les dix planches d'ordinateur dessinent le même rail : la carte « MA RÉPUTATION »
 * (sombre), le panneau ENTRAIDE avec ses trois pastilles de comptage, le panneau
 * PARRAINAGE, et la barre haute avec l'avatar et le prénom.
 *
 * LES COMPTES ONT ÉTÉ RELEVÉS, cadre par cadre, et ils sont RIGOUREUSEMENT
 * réguliers : une fois chacun sur les dix planches, sans exception. C'est ce qui
 * autorise une fonction plutôt que dix copies — et le jour où le designer ajoute
 * un second avatar au rail, la génération s'arrête sur le cadre concerné en
 * nommant le fragment, au lieu de produire neuf écrans justes et un faux.
 *
 * LES QUATRE NOMBRES DU BANDEAU VIENNENT TOUS DE `stats`, et c'est une correction
 * à son propre compte : ce commentaire a d'abord affirmé que trois d'entre eux
 * « n'avaient aucune route ». C'était faux, et le vérifier coûtait une lecture de
 * `publicProfileResponseSchema` — `stats` y porte `helpValidatedCount`,
 * `guideHelpfulVotes`, `guideContributions`, `mentorshipsCompleted` et
 * `eventsOrganized`. Un écart ANNONCÉ sans être vérifié est pire qu'un écart
 * manqué : il envoie le porteur construire ce qui existe déjà.
 */
const PASTILLE = (n) =>
  '<span style="background:#E0733A;color:#fff;font-size:11px;font-weight:700;min-width:22px;height:22px;padding:0 7px;border-radius:999px;display:flex;align-items:center;justify-content:center">' +
  n +
  '</span>';

const bandeau = () => [
  {
    noeud: '<span style="font-size:34px;font-weight:800;letter-spacing:-1px">23</span>',
    devient:
      '<span style="font-size:34px;font-weight:800;letter-spacing:-1px">{{ reputation.entraides }}</span>',
    fois: 1,
    frames: ['Desktop'],
    why: 'Les entraides validées du rail, de `GET /users/{pseudo}` (`stats.helpValidatedCount`).',
  },
  {
    noeud: '>4 guides utiles · 2 parrainages · 6 événements<',
    devient:
      '>{{ reputation.guides }} guides utiles · {{ reputation.parrainages }} parrainages · {{ reputation.evenements }} événements<',
    fois: 1,
    frames: ['Desktop'],
    why: 'La ligne de réputation du rail : `guideHelpfulVotes`, `mentorshipsCompleted` et `eventsOrganized` de `stats` (`GET /users/{pseudo}`).',
  },
  {
    noeud: PASTILLE(41),
    devient:
      '<sc-if value="{{ compteurs.ouvertes }}">' +
      PASTILLE('{{ compteurs.ouvertes }}') +
      '</sc-if>',
    fois: 1,
    frames: ['Desktop'],
    why: 'La pastille « Toutes les demandes » compte les demandes ouvertes de la ville (`meta.open` de `GET /help`) ; à zéro, elle disparaît au lieu d’afficher un rond orange vide.',
  },
  {
    noeud: PASTILLE(4),
    devient:
      '<sc-if value="{{ compteurs.pouvezAider }}">' +
      PASTILLE('{{ compteurs.pouvezAider }}') +
      '</sc-if>',
    fois: 1,
    frames: ['Desktop'],
    why: 'La pastille « Vous pouvez aider » compte les suggestions de `GET /help/can-help`.',
  },
  {
    noeud: PASTILLE(1),
    devient:
      '<sc-if value="{{ compteurs.parrainages }}">' +
      PASTILLE('{{ compteurs.parrainages }}') +
      '</sc-if>',
    fois: 1,
    frames: ['Desktop'],
    why: 'La pastille « Mes parrainages » compte les parrainages en cours et les demandes en attente (`GET /me/mentorships`).',
  },
  {
    noeud: '>AD<',
    devient: '>{{ moi.initiales }}<',
    fois: 1,
    frames: ['Desktop'],
    why: 'Les initiales de l’avatar de repli de la barre haute, dérivées du nom affiché.',
  },
  {
    noeud: '>Amina<',
    devient: '>{{ moi.prenom }}<',
    fois: 1,
    frames: ['Desktop'],
    why: 'Le prénom de la barre haute, premier mot du nom affiché de `GET /me`.',
  },
];

/**
 * ─── LA COLONNE DE DROITE DE H01 ET H04 : LA MÊME CARTE DE RÉPUTATION ──────
 *
 * Deux planches sur dix la dessinent — H01 et H04, comptées — et elles la
 * dessinent dans une AUTRE forme que le rail : un `<div>` de 30 px au lieu d'un
 * `<span>` de 34, et trois mini-compteurs en grille. Les deux formes portent le
 * même nombre, et les lier séparément est la seule lecture honnête : les mêler
 * demanderait de déclarer un `motifs`, c'est-à-dire d'affirmer un remontage que la
 * maquette ne fait pas.
 *
 * H10 dessine aussi le `<div>` de 30 px, mais SANS les mini-compteurs — sa colonne
 * dit « entraides validées sur 31 réponses ». Il reprend donc la première ligne
 * seule, et c'est pour cela que `minis` est un argument.
 */
const MINI = (valeur, nom) =>
  '<div style="background:#F6F8F7;border-radius:12px;padding:8px"><div style="font-size:15px;font-weight:800">' +
  valeur +
  '</div><div style="font-size:10.5px;color:#5D6B66">' +
  nom +
  '</div></div>';

const colonneReputation = ({ minis = true } = {}) => [
  {
    noeud: '<div style="font-size:30px;font-weight:800;margin-top:6px">23</div>',
    devient:
      '<div style="font-size:30px;font-weight:800;margin-top:6px">{{ reputation.entraides }}</div>',
    fois: 1,
    frames: ['Desktop'],
    why: 'Les entraides validées de la colonne de droite — même nombre que le rail, autre forme dessinée.',
  },
  ...(minis
    ? [
        {
          noeud: MINI(4, 'guides'),
          devient: MINI('{{ reputation.guides }}', 'guides'),
          fois: 1,
          frames: ['Desktop'],
          why: 'Le mini-compteur « guides » de la colonne de droite : `stats.guideHelpfulVotes`, le même nombre que la ligne du rail.',
        },
        {
          noeud: MINI(2, 'parrainages'),
          devient: MINI('{{ reputation.parrainages }}', 'parrainages'),
          fois: 1,
          frames: ['Desktop'],
          why: 'Le mini-compteur « parrainages » : `stats.mentorshipsCompleted`.',
        },
        {
          noeud: MINI(6, 'événements'),
          devient: MINI('{{ reputation.evenements }}', 'événements'),
          fois: 1,
          frames: ['Desktop'],
          why: 'Le mini-compteur « événements » : `stats.eventsOrganized`.',
        },
      ]
    : []),
];


/**
 * ─── H10 · UNE DE MES RÉPONSES, SUR LE CADRE MOBILE ─────────────────────────
 *
 * LA SEULE DES QUATRE LISTES DE CE MODULE DONT LA ROUTE PORTE TOUT CE QUE LA
 * PLANCHE DESSINE, et c'est ce qui la distingue des trois autres.
 *
 * L'en-tête de `screens/entraide/data.ts` explique pourquoi le fil (H01), les
 * suggestions (H04) et mes demandes (H09) ne sont pas liés : leurs cartes portent
 * une ligne d'étape de parcours — « Étape 7 · Logement · parcours Études » — que
 * `helpCardSchema` NE REND PAS. Il n'y a que `fromJourney: boolean` ; le
 * `journeyContext` n'existe que sur `GET /help/:id`, une demande à la fois. Lier
 * ces listes mettrait donc un littéral dans un `<sc-for>`, et chaque ligne issue
 * d'un parcours jurerait être l'étape 7 d'un parcours Études. Cette raison tient,
 * et ces trois listes restent REMONTÉES.
 *
 * H10 n'a pas ce défaut : `helpMyResponsesResponseSchema` porte `body`,
 * `markedHelpful`, `createdAt` et la carte `request` ENTIÈRE — type, titre, auteur.
 * Les deux planches qu'elle dessine sont les deux ÉTATS d'une réponse, et rien
 * d'autre ne les distingue :
 *
 *   · MARQUÉE UTILE — pastille pleine `#16785E`, un bandeau de bilan vert, et
 *     « Écrire à <prénom> » en second bouton ;
 *   · EN ATTENTE — pastille grise `#F2F5F4`, pas de bandeau, et « Modifier ma
 *     réponse ».
 *
 * LES DEUX SONT DESSINÉES EN ENTIER sous leur `<sc-if>`, et non recousues autour
 * d'un tronc commun. Deux raisons, et la seconde est mesurée : n'en garder qu'une
 * mentirait sur l'autre ligne ; et un tronc commun obligerait à DÉCLARER en
 * `motifs` chaque fragment partagé, parce que le troisième contrôle du générateur
 * suit un curseur qui n'avance que vers l'avant — le bandeau de bilan, qui n'existe
 * que sur la première planche, serait cherché après la seconde et introuvable.
 * Dessiner les deux variantes complètes fait avancer le curseur d'une planche à
 * l'autre, dans l'ordre où la maquette les dessine.
 *
 * ÉCARTS SIGNALÉS, deux, et aucun n'est comblé en devinant :
 *
 *   · « Kofi vous a marquée » est GENRÉ au féminin par la maquette, et aucun champ
 *     de l'API ne porte le genre — c'est le même écart que les phases de H01. Seul
 *     le PRÉNOM est lié ; la phrase reste celle de la planche ;
 *   · la maquette écrit « hier », là où `ageCourt` — le formateur que H02 emploie
 *     déjà — rend « il y a 1 j ». On garde UN formateur pour le module plutôt que
 *     deux échelles qui divergeraient.
 */
const BOUTON_REPONSE_M = (texte) =>
  '<button style="height:44px;padding:0 18px;border-radius:14px;background:#F2F5F4;color:#16211D;border:none;font:inherit;font-size:13.5px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:8px;white-space:nowrap;flex-shrink:0;height:38px">' +
  texte +
  '</button>';

const PASTILLE_RONDE = (fond, couleur, texte) =>
  '<span style="background:' +
  fond +
  ';color:' +
  couleur +
  ';font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px;white-space:nowrap">' +
  texte +
  '</span>';

/** Le bandeau de bilan d'une réponse marquée. Le prénom seul est une donnée. */
const BILAN_MARQUEE = (prenom) =>
  '<div style="margin-top:12px;background:#E3F0EB;border-radius:14px;padding:10px 12px;font-size:12.5px;color:#0F5C48;font-weight:600">' +
  prenom +
  ' vous a marquée « ça m’a aidé » · +1 entraide validée</div>';

const CARTE_REPONSE_M = ({ categorie, etat, age, auteur, titre, corps, bilan = '', second }) =>
  '<div style="background:#fff;border:1px solid #E6EBE9;border-radius:22px;padding:18px;flex-shrink:0;">' +
  '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">' +
  PASTILLE_RONDE('#E3F0EB', '#0F5C48', categorie) +
  etat +
  '<span style="flex:1"></span><span style="font-size:12px;color:#8A958F">' +
  age +
  '</span></div><div style="font-size:16px;font-weight:700;margin-top:10px;">' +
  auteur +
  ' · ' +
  titre +
  '</div><div style="font-size:12.5px;color:#5D6B66;margin-top:4px">Votre réponse : « ' +
  corps +
  ' »</div>' +
  bilan +
  '<div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">' +
  BOUTON_REPONSE_M('Voir la demande') +
  BOUTON_REPONSE_M(second) +
  '</div></div>';

const MARQUEE = PASTILLE_RONDE('#16785E', '#fff', 'Marquée utile');
const EN_ATTENTE = PASTILLE_RONDE('#F2F5F4', '#5D6B66', 'En attente');

/** Le sous-titre d'un en-tête d'écran, dans la forme que les quatre partagent. */
const SOUS_TITRE = (texte) =>
  '<div style="font-size:13.5px;color:#5D6B66;margin-top:4px">' + texte + '</div>';

/**
 * ─── LE BANDEAU DE SÉCURITÉ §2.7, ET POURQUOI IL DEVIENT UNE DONNÉE ─────────
 *
 * « Chaque page de la section affiche en permanence : *Aucun versement entre
 * membres pour une démarche administrative. Si on vous demande de l'argent,
 * signalez.* » L'API la renvoie dans le `meta` de CHAQUE réponse du module, et
 * `helpMetaSchema` l'EXIGE en `z.string().min(1)` — une réponse qui cesserait de
 * l'envoyer est refusée à la frontière. Le commentaire de ce schéma dit pourquoi
 * la règle voyage avec la donnée : « une règle de sécurité qui vit dans un
 * composant disparaît au premier écran qu'on oublie de brancher ».
 *
 * ELLE VIVAIT DANS LES COMPOSANTS, et c'est mesuré : les DIX cadres d'ordinateur
 * de ce module écrivaient la phrase en dur, aucun ne la lisait. Deux planches
 * mobiles seulement la dessinent — H01 et H03 — et chacune l'ABRÈGE à sa façon.
 * L'ancre est donc le texte tel que CHAQUE planche l'écrit, et il y en a deux.
 *
 * CE QUE LA LIAISON CHANGE À L'ÉCRAN, dit franchement : la phrase affichée devient
 * la phrase ENTIÈRE du serveur, seconde partie comprise, là où la planche n'en
 * écrivait qu'un fragment. C'est la règle qui gagne contre l'abrègement, et c'est
 * le sens de « en permanence » dans §2.7. Si le porteur préfère l'abrègement, c'est
 * la constante partagée qu'il faut changer — à un seul endroit, pour l'API et pour
 * les écrans à la fois.
 *
 * LES HUIT AUTRES PLANCHES MOBILES NE LE DESSINENT PAS DU TOUT, et aucune liaison
 * ne peut y remédier : il n'y a pas d'ancre. C'est un trou de MAQUETTE, remonté au
 * porteur, et on ne le comble pas en ajoutant des pixels dans le générateur.
 */
const bandeauSecurite = (texteDeLaPlanche) => ({
  noeud: '>' + texteDeLaPlanche + '<',
  devient: '>{{ avertissement }}<',
  fois: 1,
  frames: ['Mobile'],
  why: 'Le bandeau de sécurité §2.7, tel que `meta.safetyBanner` l’écrit — la règle voyage avec la réponse au lieu de vivre dans le composant. La planche l’abrège ; la liaison rétablit la phrase entière.',
});

/**
 * ─── LA RANGÉE DE FILTRES DU CADRE MOBILE, et ce qu'elle rend lisible ───────
 *
 * Les cadres mobiles n'ont PAS de rail : le bandeau de section ne leur est donc
 * d'aucun secours, et c'est la raison que ce fichier donnait pour les laisser tous
 * sur `_props` sauf H02. Elle est juste pour le rail, et elle est incomplète pour
 * la planche : le mobile DÉPLACE deux des trois compteurs du rail dans sa rangée
 * de filtres, où la maquette les écrit « Toutes · 41 » et « Vous pouvez aider · 4 ».
 *
 * Ce sont EXACTEMENT les deux nombres que `compteurs.ouvertes` et
 * `compteurs.pouvezAider` portent déjà — `meta.open` de `GET /help` et le compte
 * de `GET /help/can-help`. Rien de neuf n'est demandé au back, rien de neuf n'est
 * ajouté au type : le même nombre, à l'autre largeur. Les laisser figés affichait
 * « 41 demandes » à une ville qui en a trois, sur la moitié de l'écran que le
 * téléphone sert — et l'ordinateur, lui, disait vrai.
 *
 * LES TROIS AUTRES PASTILLES DE LA RANGÉE RESTENT DESSINÉES, et c'est la maquette
 * qui le décide : « Mes demandes », « Mes réponses » et « Parrainage » n'y portent
 * AUCUN nombre. H09 et H10 en comptent bien un dans leur sous-titre d'ordinateur ;
 * l'écrire ici demanderait d'ajouter du dessin que la planche ne fait pas.
 *
 * DEUX CADRES S'EN SERVENT — H01 et H04 — ET LA PASTILLE ACTIVE N'EST PAS LA MÊME :
 * H01 teinte « Toutes », H04 teinte « Vous pouvez aider ». Le fond, la couleur et
 * la bordure font partie de l'ancre, donc ce sont bien QUATRE ancres et non deux —
 * et `fois` le prouve, puisqu'une ancre de H01 posée sur H04 ne s'y trouve pas et
 * arrête la génération. L'argument dit laquelle des deux est teintée, et la
 * fabrique écrit les deux états ; rien n'est deviné.
 */
const PASTILLE_FILTRE = (fond, couleur, bord, texte) =>
  '<span style="height:36px;padding:0 13px;border-radius:999px;display:flex;align-items:center;font-size:12.5px;font-weight:700;white-space:nowrap;background:' +
  fond +
  ';color:' +
  couleur +
  ';border:1px solid ' +
  bord +
  '">' +
  texte +
  '</span>';

const ACTIVE = ['#16785E', '#fff', '#16785E'];
const INACTIVE = ['#fff', '#16211D', '#E6EBE9'];

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LES SIX FILTRES DU FIL D'ENTRAIDE ÉTAIENT SIX DESSINS                     ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « Rends aussi la page, les filtres etc. dynamique. »
 *
 * « Tout · Démarches · Service · Trajet · Matériel · Autre » sont des `<span>` —
 * zéro geste, et « Tout » peint en vert pour tout le monde. `helpListQuerySchema`
 * accepte pourtant `type` depuis le premier jour : il ne manquait que la boucle
 * et le clic.
 *
 * Le gabarit est la pastille d'onglet du produit, celle des enregistrés et des
 * filtres de notification — mêmes six valeurs, mêmes deux variantes.
 */
const PASTILLE_TYPE_H01 = (fond, encre, trait, libelle) =>
  '<span style="padding:8px 13px;border-radius:999px;font-size:12.5px;font-weight:700;' +
  `white-space:nowrap;background:${fond};color:${encre};border:1px solid ${trait}">${libelle}</span>`;

const TYPES_DESSINES = ['Démarches', 'Service', 'Trajet', 'Matériel', 'Autre'];

const FILTRES_TYPE_H01 = {
  noeud:
    PASTILLE_TYPE_H01('#16785E', '#fff', '#16785E', 'Tout') +
    TYPES_DESSINES.map((t) => PASTILLE_TYPE_H01('#fff', '#16211D', '#E6EBE9', t)).join(''),
  devient:
    '<sc-for list="{{ typesDemande }}" as="ty">' +
    PASTILLE_TYPE_H01('{{ ty.fond }}', '{{ ty.texte }}', '{{ ty.bord }}', '{{ ty.libelle }}') +
    '</sc-for>',
  fois: 1,
  frames: ['Desktop'],
  why: 'Les six filtres de type du fil d’entraide — `helpListQuerySchema.type` les accepte, et aucun n’était cliquable.',
};

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LA MÊME RANGÉE DE TYPES À 390 px — ELLE ÉTAIT RESTÉE UN DESSIN             ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur l'a redemandé plusieurs fois : CHAQUE CORRECTION PREND SUR LES DEUX
 * PLANCHES. Le lot précédent a rendu les six filtres de type cliquables à 1440 px
 * et a laissé la rangée de 390 px en `<span>` — « Tout » peint en vert pour tout le
 * monde, et quatre pastilles qui ne filtrent rien. C'est exactement le défaut que
 * ce lot répare sur les pastilles de portée ; le réparer d'un côté seulement en
 * aurait laissé un second juste à côté.
 *
 * ── ÉCART CONSIGNÉ : LA PLANCHE DE 390 px N'EN DESSINE QUE CINQ ─────────────
 *
 * Elle écrit « Tout · Démarches · Service · Trajet · Matériel » et S'ARRÊTE LÀ —
 * « Autre » n'y est pas, compté sur les octets. La boucle, elle, rend les SIX
 * valeurs que `TYPES_FIL` porte, parce que c'est une seule liste de données pour
 * les deux cadres et que `HELP_REQUEST_TYPES` en compte cinq plus « Tout ».
 *
 * La conséquence est dite plutôt que masquée : à 390 px, une sixième pastille
 * « Autre » apparaît là où la planche n'en dessine que cinq. La rangée est en
 * `flex-wrap`, donc elle passe à la ligne sans rien déplacer. L'autre choix aurait
 * été de BORNER la boucle mobile à cinq types, c'est-à-dire de rendre « Autre »
 * injoignable au téléphone — un type de demande que le serveur accepte et que la
 * moitié des membres ne pourrait pas filtrer. Entre une pastille de plus que la
 * planche et un filtre inatteignable, on prend la pastille. REMONTÉ au porteur.
 */
const FILTRES_TYPE_H01_MOBILE = {
  noeud:
    PASTILLE_TYPE_H01('#16785E', '#fff', '#16785E', 'Tout') +
    TYPES_DESSINES.slice(0, 4)
      .map((t) => PASTILLE_TYPE_H01('#fff', '#16211D', '#E6EBE9', t))
      .join(''),
  devient: FILTRES_TYPE_H01.devient,
  fois: 1,
  frames: ['Mobile'],
  why: 'Les filtres de type du cadre de 390 px — ils étaient restés des <span>, « Tout » peint en vert pour tout le monde. La boucle rend les SIX valeurs là où la planche en dessine cinq : « Autre » serait sinon injoignable au téléphone.',
};

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LES CINQ PASTILLES DE PORTÉE ÉTAIENT DEUX NOMBRES JUSTES SOUS DES SPANS    ║
 * ║ MORTS                                                                      ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « Intègre donc. »
 *
 * CE QUE LA VERSION PRÉCÉDENTE DE CETTE FABRIQUE FAISAIT, et pourquoi ce n'était
 * qu'une moitié : elle déclarait DEUX ancres — la première et la deuxième pastille —
 * pour y poser `compteurs.ouvertes` et `compteurs.pouvezAider`. Les nombres
 * devenaient donc vrais, et le `<span>` qui les portait restait un `<span>`. C'est
 * le pire des deux états : un nombre juste sous un contrôle mort donne à croire
 * que la pastille fonctionne, et le porteur a cliqué dessus.
 *
 * LA RANGÉE DEVIENT DONC UNE BOUCLE, d'un seul coup, pour ses cinq pastilles — le
 * même remontage que `FILTRES_TYPE_H01` fait un cran plus bas dans le même écran,
 * et c'est le vocabulaire que cette planche parle déjà. Les deux compteurs ne
 * disparaissent pas : ils entrent dans le LIBELLÉ (« Toutes · 41 »), composé dans
 * `entraide/appels.ts` à partir des mêmes `meta.open` et longueur de
 * `GET /help/can-help`. Un compteur dans un libellé est une donnée exactement
 * comme un compteur dans son propre nœud ; ce qui change, c'est qu'il voyage
 * maintenant avec la prise qui le rend cliquable.
 *
 * ── DEUX CADRES, DEUX LONGUEURS DE RANGÉE, ET C'EST COMPTÉ ──────────────────
 *
 * H01 en dessine CINQ (« Toutes », « Vous pouvez aider », « Mes demandes »,
 * « Mes réponses », « Parrainage ») dans une rangée qui défile ; H04 n'en dessine
 * que TROIS, et s'arrête à « Mes demandes ». Relevé sur les octets de la maquette,
 * pas supposé — et `fois: 1` le recompte à chaque génération : une ancre de cinq
 * pastilles posée sur H04 ne s'y trouve pas et ARRÊTE la génération.
 *
 * LA PASTILLE TEINTÉE N'EST PAS LA MÊME NON PLUS : H01 teinte « Toutes », H04
 * teinte « Vous pouvez aider ». Le fond, la couleur et la bordure font partie de
 * l'ancre, donc l'argument `actif` ne décore rien — il décide des octets cherchés.
 *
 * ── LES TROIS DERNIÈRES PASTILLES NE PORTENT AUCUN NOMBRE ───────────────────
 *
 * Et c'est la maquette qui le décide : « Mes demandes », « Mes réponses » et
 * « Parrainage » sont dessinées sans compteur. H09 et H10 en comptent bien un dans
 * leur sous-titre d'ordinateur ; l'écrire ici demanderait d'ajouter du dessin que
 * la planche ne fait pas.
 */
const PORTEES_DESSINEES = [
  ['toutes', 'Toutes · 41'],
  ['aider', 'Vous pouvez aider · 4'],
  ['mes-demandes', 'Mes demandes'],
  ['mes-reponses', 'Mes réponses'],
  ['parrainage', 'Parrainage'],
];

const porteesDuFil = (actif, combien) => ({
  noeud: PORTEES_DESSINEES.slice(0, combien)
    .map(([cle, texte]) => PASTILLE_FILTRE(...(cle === actif ? ACTIVE : INACTIVE), texte))
    .join(''),
  devient:
    '<sc-for list="{{ portees }}" as="p">' +
    PASTILLE_FILTRE('{{ p.fond }}', '{{ p.texte }}', '{{ p.bord }}', '{{ p.libelle }}') +
    '</sc-for>',
  fois: 1,
  frames: ['Mobile'],
  why:
    `Les ${String(combien)} pastilles de PORTÉE du cadre de 390 px, en une boucle : « Toutes » lit ` +
    '`GET /help`, « Vous pouvez aider » lit `GET /help/can-help`, et les autres mènent aux mêmes ' +
    'adresses que le panneau de gauche du cadre de 1440 px. Les deux compteurs (`meta.open` et la ' +
    'longueur de `can-help`) entrent dans le libellé. Elles étaient des <span> : pas des liens ' +
    'cassés, PAS des contrôles.',
});

/**
 * ─── H02 · UNE RÉPONSE À UNE DEMANDE, ÉCRITE UNE FOIS ───────────────────────
 *
 * La maquette en dessine TROIS côte à côte, et elles ne diffèrent que par leurs
 * textes, la couleur de l'avatar, et LA PASTILLE « ça m'a aidé » — remplie sur la
 * réponse marquée, détourée sur les deux autres. Ce sont les DEUX VARIANTES que la
 * maquette dessine, et elles vont chacune sous son `<sc-if>` : n'en garder qu'une
 * serait un mensonge sur les autres lignes, exactement comme la pastille
 * « Actuelle » de K04 l'aurait été sur les sessions révocables.
 *
 * La fabrique sert DEUX FOIS — pour écrire le `noeud` (les trois réponses telles
 * que la maquette les dessine) et pour écrire le `devient` (la même, une fois,
 * interpolée). Le générateur compare les deux : si la maquette change d'un pixel,
 * `fois` ne tombe plus juste et la génération s'arrête en nommant le fragment.
 */
const REPONSE = (fond, initiales, nom, age, corps, pastille) =>
  '<div style="display:flex;gap:12px;padding:14px 0;border-bottom:1px solid #F0F3F2">' +
  '<span style="width:36px;height:36px;border-radius:999px;background:' +
  fond +
  ';color:#fff;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
  initiales +
  '</span><div style="flex:1;min-width:0">' +
  '<div style="display:flex;align-items:center;gap:5px;font-size:13.5px;font-weight:700">' +
  nom +
  '<svg width="12" height="12" viewBox="0 0 24 24" fill="#16785E"><circle cx="12" cy="12" r="10"/>' +
  '<path d="m8 12 3 3 5-6" stroke="#fff" stroke-width="2.2" fill="none"/></svg>' +
  '<span style="font-size:11.5px;color:#8A958F;font-weight:500">' +
  age +
  '</span></div><div style="font-size:13.5px;line-height:1.55;margin-top:4px">' +
  corps +
  '</div>' +
  pastille +
  '</div></div>';

/** La pastille d'une réponse DÉJÀ marquée : remplie, avec sa coche. */
const PASTILLE_MARQUEE =
  '<span style="display:inline-flex;margin-top:8px;align-items:center;gap:6px;background:#16785E;color:#fff;font-size:12px;font-weight:700;padding:6px 12px;border-radius:999px">' +
  '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="m5 12 4.5 4.5L19 7"/></svg>Ça m’a aidé</span>';

/**
 * H06 — une évaluation de parrain, avec sa rangée de CINQ étoiles.
 *
 * Les cinq étoiles sont dessinées cinq fois à l'identique par la maquette, sur
 * CHACUNE de ses deux évaluations : ce n'est donc pas une note variable, et la
 * fabrique les recopie telles quelles. Lier la note demanderait de dessiner une
 * rangée à longueur variable que la maquette n'a pas dessinée.
 */
const ETOILE =
  '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#E0733A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/></svg>';

const EVALUATION = (commentaire, auteur) =>
  '<div style="padding:12px 0;border-bottom:1px solid #F0F3F2"><div style="display:flex;gap:2px">' +
  ETOILE.repeat(5) +
  '</div><div style="font-size:13.5px;margin-top:4px">« ' +
  commentaire +
  ' »</div><div style="font-size:12px;color:#8A958F;margin-top:2px">' +
  auteur +
  '</div></div>';

/** La pastille d'une réponse QU'ON PEUT marquer : détourée, sans coche. */
const PASTILLE_A_MARQUER =
  '<span style="display:inline-flex;margin-top:8px;align-items:center;gap:6px;border:1.5px solid #CFE3DA;color:#0F5C48;font-size:12px;font-weight:700;padding:5px 12px;border-radius:999px">Ça m’a aidé</span>';

/** Les six sections dont le cadre mobile dessine la barre d'onglets basse. */
const BARRE_BASSE_ENTRAIDE = new Set(['H01', 'H04', 'H05', 'H07', 'H09', 'H10']);

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ H01 · LE FIL D'ENTRAIDE ÉTAIT TROIS CARTES ÉCRITES EN DUR                 ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « Corrige l'entraide. »
 *
 * MESURÉ : ZÉRO boucle dans les deux cadres de H01, et le composant ne lisait
 * que `compteurs`, `moi`, `reputation` et `ville`. Les trois demandes —
 * « Accompagner un RDV préfecture jeudi », « Un lit et une table pour
 * l'installation », « Covoiturage Lyon → Grenoble samedi » — étaient le dessin
 * de la maquette, servi à tout le monde. C'est le même défaut que les contacts
 * de K05, et il se corrige de la même façon : par déclaration.
 *
 * ── LA MAQUETTE DESSINE TROIS ÉTATS, PAS TROIS DEMANDES ─────────────────────
 *
 * C'est ce qui rend la boucle délicate, et c'est aussi ce qui la rend juste :
 *
 *   1. UNE DEMANDE ORDINAIRE — fond blanc, trait gris, pastille de catégorie,
 *      auteur, « N réponses », bouton « Répondre » ;
 *   2. UNE DEMANDE ISSUE D'UN PARCOURS — fond `#FFFBF8`, trait terre cuite de
 *      1,5 px, pastille « Depuis un parcours » EN PLUS, et une ligne d'étape
 *      (« Étape 7 · Logement · parcours Études »). Le bouton reprend la teinte ;
 *   3. UNE DEMANDE RÉSOLUE — fond `#F6F8F7`, pastilles grises, titre grisé,
 *      AUCUN bouton, et à la place l'encart vert « … a été marquée "ça m'a
 *      aidé" — contact créé ».
 *
 * Les trois tiennent dans UN gabarit : ce qui change de couleur est une donnée,
 * ce qui apparaît ou disparaît est un `<sc-if>`. Les écrire en trois boucles
 * aurait figé l'ordre que la maquette donne à ses exemples.
 *
 * ── CE QUE LE SERVEUR DONNE, ET CE QU'IL NE DONNE PAS ───────────────────────
 *
 * `GET /help` rend le titre, la catégorie, l'état, l'auteur et le nombre de
 * réponses. ⚠ IL NE REND PAS la provenance « parcours » sous la forme que la
 * maquette dessine : `helpRequestCardSchema` porte `journeyStepTitle`, mais pas
 * le NOM du parcours (« parcours Études »). La ligne d'étape est donc composée
 * de ce qui existe, et le manque est REMONTÉ plutôt que comblé.
 */
const PASTILLE_H01 = (fond, encre, texte) =>
  `<span style="background:${fond};color:${encre};font-size:11px;font-weight:700;` +
  `padding:4px 10px;border-radius:999px;white-space:nowrap">${texte}</span>`;

const SIGNET_H01 =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16211D" ' +
  'stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>';

const COCHE_H01 =
  '<svg width="12" height="12" viewBox="0 0 24 24" fill="#16785E"><circle cx="12" cy="12" r="10"/>' +
  '<path d="m8 12 3 3 5-6" stroke="#fff" stroke-width="2.2" fill="none"/></svg>';

/** Le pied d'une demande ouverte : auteur, niveau, nombre de réponses, « Répondre ». */
const PIED_DEMANDE = (fondAvatar, initiales, auteur, phase, reponses, fondBouton) =>
  '<div style="display:flex;align-items:center;gap:10px;margin-top:14px">' +
  `<span style="width:28px;height:28px;border-radius:999px;background:${fondAvatar};color:#fff;` +
  'font-size:9px;font-weight:700;display:flex;align-items:center;justify-content:center;' +
  `flex-shrink:0;">${initiales}</span>` +
  `<span style="font-size:12.5px;font-weight:700">${auteur}</span>${COCHE_H01}` +
  `<span style="font-size:12px;color:#8A958F">${phase}</span><span style="flex:1"></span>` +
  `<span style="font-size:12.5px;color:#5D6B66">${reponses}</span>` +
  '<button style="height:44px;padding:0 18px;border-radius:14px;background:' +
  `${fondBouton};color:#fff;border:none;font:inherit;font-size:13.5px;font-weight:700;` +
  'display:flex;align-items:center;justify-content:center;gap:8px;white-space:nowrap;' +
  'flex-shrink:0;height:38px">Répondre</button></div>';

/**
 * UNE CARTE DE DEMANDE, telle que la maquette la dessine trois fois.
 *
 * Tout ce qui varie est un paramètre ; `avant` et `apres` portent les blocs que
 * seules certaines variantes montrent — la pastille « Depuis un parcours », la
 * ligne d'étape, le pied ou l'encart de résolution.
 */
const CARTE_DEMANDE = ({
  fond,
  trait,
  avantCategorie = '',
  pastilleFond,
  pastilleEncre,
  categorie,
  /** La pastille d'ÉTAT — « Résolue » — que seule la variante close porte. */
  apresCategorie = '',
  delai,
  etape = '',
  titreCouleur,
  titre,
  extrait,
  pied,
}) =>
  `<div style="background:${fond};border:${trait};border-radius:22px;padding:18px;flex-shrink:0">` +
  '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">' +
  avantCategorie +
  PASTILLE_H01(pastilleFond, pastilleEncre, categorie) +
  apresCategorie +
  '<span style="flex:1"></span>' +
  `<span style="font-size:12px;color:#8A958F">${delai}</span>${SIGNET_H01}</div>` +
  etape +
  '<div style="font-size:16px;font-weight:700;letter-spacing:-0.2px;margin-top:10px;' +
  `${titreCouleur}">${titre}</div>` +
  '<p style="margin:6px 0 0;font-size:13.5px;line-height:1.55;color:#5D6B66;' +
  'display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">' +
  `${extrait}</p>` +
  pied +
  '</div>';

/** La ligne « Étape 7 · Logement · parcours Études », que seule la variante parcours porte. */
const LIGNE_ETAPE = (texte) =>
  `<div style="font-size:12px;font-weight:700;color:#B4581F;margin-top:8px">${texte}</div>`;

/** L'encart vert d'une demande résolue — il remplace le pied. */
const ENCART_RESOLUE = (texte) =>
  '<div style="margin-top:12px;background:#E3F0EB;border-radius:14px;padding:10px 12px;' +
  `font-size:12.5px;color:#0F5C48;font-weight:600">${texte}</div>`;

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ L'ÉTAT VIDE — LA MAQUETTE LE DESSINE, ET AUCUN CADRE NE LE MONTAIT        ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * TROUVÉ EN CHERCHANT, ET C'EST LE POINT : `GET /help/can-help` rend une liste
 * VIDE avec `meta.reason = 'NO_CRITERIA'` au membre qui n'a déclaré aucun type
 * d'aide et franchi aucune étape. Un fil vide sans un mot lui apprend le
 * contraire de ce qu'il faut faire — il conclurait que la ville est calme, et
 * n'irait jamais remplir son profil.
 *
 * On n'a RIEN eu à dessiner. H01 range, à côté de ses deux cadres, une colonne
 * « ÉTATS » de 320 px où la maquette dessine CHARGEMENT, VIDE et ERREUR. Son
 * état VIDE porte exactement trois choses :
 *
 *   · un titre de 14 px en 700 — « Aucune demande ouverte à Lyon » ;
 *   · une phrase de 12,5 px en `#5D6B66` — « Vous avez besoin d'un coup de main ? » ;
 *   · une pastille verte `#16785E` — « Publier une demande ».
 *
 * ── POURQUOI C'EST UN `motifs` ET PAS UN `noeud` ────────────────────────────
 *
 * Cette colonne est DEHORS : le générateur ne transcode que les conteneurs de
 * 1440 et de 390 px, et la colonne d'états est leur sœur, pas leur contenu. Le
 * dessin est donc réemployé par `motifs`, avec son `from` — c'est le mécanisme
 * prévu pour un fragment dessiné ailleurs dans la maquette, et le DEUXIÈME
 * contrôle refuse de produire le jour où le designer retire cet état.
 *
 * ── LES QUATRE TEXTES NE SONT PAS DANS LA PLANCHE, ET CE SONT DES DONNÉES ───
 *
 * La maquette n'écrit qu'un des quatre cas. Les trois autres — la portée
 * « Vous pouvez aider » sans critère, la même avec critères mais sans
 * correspondance, le fil filtré sur un type sans résultat — se composent dans
 * `entraide/appels.ts` (voir `videDuFil`). Ce sont des DONNÉES, au même titre
 * que « Demande issue d'un parcours » : aucune n'est ajoutée au dessin, toutes
 * passent par l'unique interpolation que la planche porte déjà.
 *
 * LA PASTILLE DEVIENT UN VRAI LIEN, et la maquette l'écrit en `<div>` — comme
 * elle écrivait les sept entrées du panneau de section. Ce n'était pas un lien
 * cassé : ce n'était pas un lien. La promotion est faite par l'adaptation
 * `H01_PORTEES`, qui est le mécanisme prévu pour ça.
 */
const SOURCE_ENTRAIDE = 'docs/template/05 Entraide.dc.html';

const VIDE_OUVERTURE =
  '<div style="text-align:center"><div style="font-size:14px;font-weight:700">';
const VIDE_PHRASE = '</div><div style="font-size:12.5px;color:#5D6B66;margin-top:4px">';
const VIDE_PASTILLE =
  '</div><div style="margin-top:10px;display:inline-block;background:#16785E;color:#fff;' +
  'font-size:12.5px;font-weight:700;padding:8px 14px;border-radius:999px">';
const VIDE_FERMETURE = '</div></div>';

const ETAT_VIDE =
  '<sc-if value="{{ vide }}">' +
  VIDE_OUVERTURE +
  '{{ vide.titre }}' +
  VIDE_PHRASE +
  '{{ vide.phrase }}' +
  VIDE_PASTILLE +
  '{{ vide.lien }}' +
  VIDE_FERMETURE +
  '</sc-if>';

/**
 * Les quatre fragments du dessin, DANS L'ORDRE où la colonne d'états les écrit.
 *
 * Ils sont déclarés APRÈS les motifs de la carte dans chaque entrée, et l'ordre
 * compte : `fragmentsDeDessin` retire chaque motif avec `String.replace`, qui ne
 * coupe que la PREMIÈRE occurrence. `</div></div>` figure dans la carte autant
 * que dans l'état vide — il n'est juste pour ce dernier que parce que l'état vide
 * est écrit AVANT la boucle dans `devient`, et que les trois fragments qui le
 * précèdent ont déjà été retirés. Le dépôt a déjà payé ce piège une fois.
 */
const MOTIFS_VIDE = [VIDE_OUVERTURE, VIDE_PHRASE, VIDE_PASTILLE, VIDE_FERMETURE].map(
  (pattern) => ({ from: SOURCE_ENTRAIDE, pattern }),
);

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ H04 · LES DEUX SUGGESTIONS ÉTAIENT DEUX CARTES SERVIES À TOUT LE MONDE    ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur, sur la cohérence des deux planches : « si les deux divergent,
 * aligne-les. »
 *
 * MESURÉ AU NAVIGATEUR, aux deux largeurs, après que la portée « Vous pouvez
 * aider » du fil a commencé à lire la vraie route : `GET /help/can-help` rendait
 * SEPT suggestions au membre de mesure, le fil en affichait sept à 390 px, et
 * `/entraide/aider` affichait « Dossier Visale refusé, que faire ? » et « Relire
 * une lettre de motivation » — les deux cartes de la planche, à 1440 ET à 390.
 * Le lot qui a rendu la pastille vivante venait donc d'ÉLARGIR l'écart : la même
 * liste, deux réponses différentes selon le chemin pris.
 *
 * ── CE QUI BLOQUAIT, ET CE QUI LE DÉBLOQUE ──────────────────────────────────
 *
 * La raison écrite jusqu'ici — dans `app/(app)/entraide/aider/page.tsx` — était
 * exacte sur le fait et trop large sur la conclusion : « les deux cartes portent
 * chacune une pastille de MOTIF que l'API ne renvoie pas ». C'est vrai —
 * `helpCardSchema` ne porte que `fromJourney` — mais le `where` du service dit
 * davantage que le schéma :
 *
 *   · `fromJourney === false` ⇒ `originJourneyStep` est nul ⇒ le critère « étape
 *     franchie » NE PEUT PAS avoir joué, donc la correspondance vient des TYPES
 *     D'AIDE DÉCLARÉS. « Correspond à vos types d'aide » — les mots de la
 *     planche — est alors DÉMONTRÉ, pas supposé ;
 *   · `fromJourney === true` reste ambigu : la demande a pu correspondre par son
 *     type autant que par sa définition d'étape. On n'écrit donc PAS « Vous avez
 *     franchi l'étape Logement », qui nommerait une étape que la réponse ne
 *     contient pas. On écrit « Demande issue d'un parcours » — la même phrase que
 *     `ligneDemande` emploie déjà pour le même manque, à un seul endroit du
 *     module.
 *
 * ⚠ CE QUE LA PLANCHE PERD : son « Vous avez franchi l'étape Logement ». REMONTÉ.
 * Le combler demanderait que `GET /help/can-help` dise POURQUOI chaque demande
 * correspond — un champ `matchedBy` dans `helpCardSchema`, ou un `meta` par ligne.
 * C'est une décision de porteur, pas une déduction de front.
 *
 * ── UNE SEULE DÉCLARATION POUR LES DEUX CADRES, ET C'EST COMPTÉ ─────────────
 *
 * Les deux cartes sont dessinées OCTET POUR OCTET à l'identique à 1440 et à 390 px
 * — relevé, pas supposé : la paire figure exactement une fois dans chaque cadre.
 * D'où l'absence de clé `frames`, et `fois: 1` qui le recompte à chaque
 * génération. H04 est donc le second cadre mobile de ce module à lire ses données,
 * après H02.
 */
const MOTIF_SUGGESTION = (texte) =>
  '<span style="background:#FBE3D4;color:#B4581F;font-size:11px;font-weight:700;' +
  `padding:4px 10px;border-radius:999px;white-space:nowrap">${texte}</span>`;

const CARTE_SUGGESTION = ({ categorie, motif, delai, titre, extrait, pied }) =>
  CARTE_DEMANDE({
    fond: '#fff',
    trait: '1px solid #E6EBE9',
    pastilleFond: '#E3F0EB',
    pastilleEncre: '#0F5C48',
    categorie,
    apresCategorie: MOTIF_SUGGESTION(motif),
    delai,
    titreCouleur: '',
    titre,
    extrait,
    pied,
  });

/**
 * LE FOND DE LA PASTILLE DE CATÉGORIE RESTE UNE DONNÉE, et le bouton NON.
 *
 * La planche de H04 ne dessine QUE des demandes ouvertes — `can-help` ne rend que
 * `status: 'OPEN'`, et c'est le service qui le garantit, pas une convention. Les
 * deux teintes grises de la variante résolue n'ont donc rien à faire ici, et le
 * bouton « Répondre » garde le `#16785E` que la planche écrit sur les deux cartes :
 * en faire une donnée réclamerait une variante que ni la planche ni la route ne
 * produisent.
 */
const SUGGESTIONS_H04 = {
  noeud:
    CARTE_SUGGESTION({
      categorie: 'Démarches',
      motif: 'Vous avez franchi l’étape Logement',
      delai: 'échéance dans 2 j',
      titre: 'Dossier Visale refusé, que faire ?',
      extrait: 'On me demande un document que je n’ai pas.',
      pied: PIED_DEMANDE('#B4581F', 'YB', 'Yasmine B.', 'Arrivée', '0 réponses', '#16785E'),
    }) +
    CARTE_SUGGESTION({
      categorie: 'Service',
      motif: 'Correspond à vos types d’aide',
      delai: 'échéance dans 5 j',
      titre: 'Relire une lettre de motivation',
      extrait: 'Candidature en alternance, en français.',
      pied: PIED_DEMANDE('#0F5C48', 'TA', 'Théo A.', 'Arrivé', '1 réponses', '#16785E'),
    }),
  devient:
    ETAT_VIDE +
    '<sc-for list="{{ suggestions }}" as="s">' +
    CARTE_SUGGESTION({
      categorie: '{{ s.categorie }}',
      motif: '{{ s.motif }}',
      delai: '{{ s.delai }}',
      titre: '{{ s.titre }}',
      extrait: '{{ s.extrait }}',
      pied: PIED_DEMANDE(
        '{{ s.auteurFond }}',
        '{{ s.auteurInitiales }}',
        '{{ s.auteur }}',
        '{{ s.auteurPhase }}',
        '{{ s.reponses }}',
        '#16785E',
      ),
    }) +
    '</sc-for>',
  motifs: [...MOTIFS_VIDE],
  fois: 1,
  why: 'Les suggestions de `GET /help/can-help` (§2.6) — les deux cartes étaient le dessin de la planche, servi à tout le monde aux DEUX largeurs, alors que la portée « Vous pouvez aider » du fil lisait déjà la vraie route.',
};

export const screens = [
  /**
   * ── H01 · /entraide — le fil ───────────────────────────────────────────────
   *
   * Le sous-titre porte les DEUX compteurs que `GET /help` renvoie dans son
   * `meta` : `open` et `resolvedThisMonth`. Ils sont comptés par le serveur sur la
   * ville entière, et c'est ce qui compte : les compter sur la page courante
   * afficherait « 20 » là où la ville en a deux cents.
   */
  {
    section: 'H01',
    frames: both('Fil d’entraide', 'Fil d’entraide'),
    donnees: [
      ...bandeau(),
      ...colonneReputation(),
      /**
       * ╔══════════════════════════════════════════════════════════════════════╗
       * ║ LES TROIS DEMANDES DESSINÉES DEVIENNENT LA LISTE                    ║
       * ╚══════════════════════════════════════════════════════════════════════╝
       *
       * Voir l'en-tête de `CARTE_DEMANDE` pour les trois états que la maquette
       * dessine et pour ce que le serveur ne donne pas.
       */
      {
        noeud:
          CARTE_DEMANDE({
            fond: '#fff',
            trait: '1px solid #E6EBE9',
            pastilleFond: '#E3F0EB',
            pastilleEncre: '#0F5C48',
            categorie: 'Démarches',
            delai: '35 min',
            titreCouleur: '',
            titre: 'Accompagner un RDV préfecture jeudi',
            extrait:
              'Première convocation, je cherche quelqu’un qui connaît la procédure pour m’accompagner au guichet.',
            pied: PIED_DEMANDE('#2FA37D', 'FN', 'Fatou N.', 'Installée', '3 réponses', '#16785E'),
          }) +
          CARTE_DEMANDE({
            fond: '#FFFBF8',
            trait: '1.5px solid #E0733A',
            avantCategorie: PASTILLE_H01('#E0733A', '#fff', 'Depuis un parcours'),
            pastilleFond: '#E3F0EB',
            pastilleEncre: '#0F5C48',
            categorie: 'Matériel',
            delai: '2 h',
            etape: LIGNE_ETAPE('Étape 7 · Logement · parcours Études'),
            titreCouleur: '',
            titre: 'Un lit et une table pour l’installation',
            extrait:
              'Demande issue de mon parcours. Récupération possible en camionnette samedi.',
            pied: PIED_DEMANDE('#E0733A', 'KB', 'Kofi B.', 'Arrivé', '1 réponses', '#E0733A'),
          }) +
          CARTE_DEMANDE({
            fond: '#F6F8F7',
            trait: '1px solid #E6EBE9',
            pastilleFond: '#EDF1EF',
            pastilleEncre: '#8A958F',
            categorie: 'Trajet',
            avantCategorie: '',
            apresCategorie: PASTILLE_H01('#EDF1EF', '#5D6B66', 'Résolue'),
            delai: 'hier',
            titreCouleur: 'color:#5D6B66',
            titre: 'Covoiturage Lyon → Grenoble samedi',
            extrait: '',
            pied: ENCART_RESOLUE('Sandra M. a été marquée « ça m’a aidé » — contact créé'),
          }),
        devient:
          ETAT_VIDE +
          '<sc-for list="{{ demandes }}" as="d">' +
          CARTE_DEMANDE({
            fond: '{{ d.fond }}',
            trait: '{{ d.trait }}',
            avantCategorie:
              '<sc-if value="{{ d.deParcours }}">' +
              PASTILLE_H01('#E0733A', '#fff', 'Depuis un parcours') +
              '</sc-if>',
            pastilleFond: '{{ d.categorieFond }}',
            pastilleEncre: '{{ d.categorieEncre }}',
            categorie: '{{ d.categorie }}',
            apresCategorie:
              '<sc-if value="{{ d.etat }}">' +
              PASTILLE_H01('#EDF1EF', '#5D6B66', '{{ d.etat }}') +
              '</sc-if>',
            delai: '{{ d.delai }}',
            etape: '<sc-if value="{{ d.etape }}">' + LIGNE_ETAPE('{{ d.etape }}') + '</sc-if>',
            titreCouleur: 'color:{{ d.titreCouleur }}',
            titre: '{{ d.titre }}',
            extrait: '{{ d.extrait }}',
            pied:
              '<sc-if value="{{ d.ouverte }}">' +
              PIED_DEMANDE(
                '{{ d.auteurFond }}',
                '{{ d.auteurInitiales }}',
                '{{ d.auteur }}',
                '{{ d.auteurPhase }}',
                '{{ d.reponses }}',
                '{{ d.boutonFond }}',
              ) +
              '</sc-if><sc-if value="{{ d.resolution }}">' +
              ENCART_RESOLUE('{{ d.resolution }}') +
              '</sc-if>',
          }) +
          '</sc-for>',
        /**
         * ╔══════════════════════════════════════════════════════════════════╗
         * ║ DEUX MOTIFS, PARCE QU'UN GABARIT NE SE LIT PAS EN UNE PASSE      ║
         * ╚══════════════════════════════════════════════════════════════════╝
         *
         * Le troisième contrôle de `donnees` parcourt `noeud` AVEC UN SEUL
         * CURSEUR : chaque fragment de `devient` doit s'y trouver APRÈS le
         * précédent. C'est ce qui garantit qu'une donnée n'invente pas de dessin.
         *
         * Ici les trois variantes sont dessinées L'UNE APRÈS L'AUTRE, et le
         * gabarit les réunit : la pastille « Résolue » n'existe que dans la
         * TROISIÈME carte, la ligne d'étape que dans la DEUXIÈME. Le curseur
         * sautait donc à la troisième pour la pastille, puis ne retrouvait plus
         * la ligne d'étape — restée derrière lui.
         *
         * Les déclarer en `motifs` les retire du parcours sans rien relâcher :
         * le DEUXIÈME contrôle vérifie qu'ils sont bien dessinés dans ce cadre,
         * et la génération s'arrête si le designer les retire. On échange un
         * ordre que la maquette n'a pas contre une présence qu'elle garantit.
         */
        motifs: [
          '<span style="background:#E0733A;color:#fff;font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px;white-space:nowrap">Depuis un parcours</span>',
          '<span style="background:#EDF1EF;color:#5D6B66;font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px;white-space:nowrap">',
          '<div style="font-size:12px;font-weight:700;color:#B4581F;margin-top:8px">',
          'margin-top:10px;color:',
          ...MOTIFS_VIDE,
        ],
        fois: 1,
        frames: ['Desktop'],
        why: 'Les demandes d’entraide, de `GET /help` — les trois cartes étaient le dessin de la maquette, servi à tout le monde.',
      },
      {
        noeud:
          CARTE_DEMANDE({
            fond: '#fff',
            trait: '1px solid #E6EBE9',
            pastilleFond: '#E3F0EB',
            pastilleEncre: '#0F5C48',
            categorie: 'Démarches',
            delai: '35 min',
            titreCouleur: '',
            titre: 'Accompagner un RDV préfecture jeudi',
            extrait:
              'Première convocation, je cherche quelqu’un qui connaît la procédure pour m’accompagner au guichet.',
            pied: PIED_DEMANDE('#2FA37D', 'FN', 'Fatou N.', 'Installée', '3 réponses', '#16785E'),
          }) +
          CARTE_DEMANDE({
            fond: '#FFFBF8',
            trait: '1.5px solid #E0733A',
            avantCategorie: PASTILLE_H01('#E0733A', '#fff', 'Depuis un parcours'),
            pastilleFond: '#E3F0EB',
            pastilleEncre: '#0F5C48',
            categorie: 'Matériel',
            delai: '2 h',
            etape: LIGNE_ETAPE('Étape 7 · Logement · parcours Études'),
            titreCouleur: '',
            titre: 'Un lit et une table pour l’installation',
            extrait:
              'Demande issue de mon parcours. Récupération possible en camionnette samedi.',
            pied: PIED_DEMANDE('#E0733A', 'KB', 'Kofi B.', 'Arrivé', '1 réponses', '#E0733A'),
          }),
        devient:
          ETAT_VIDE +
          '<sc-for list="{{ demandes }}" as="d">' +
          CARTE_DEMANDE({
            fond: '{{ d.fond }}',
            trait: '{{ d.trait }}',
            avantCategorie:
              '<sc-if value="{{ d.deParcours }}">' +
              PASTILLE_H01('#E0733A', '#fff', 'Depuis un parcours') +
              '</sc-if>',
            pastilleFond: '{{ d.categorieFond }}',
            pastilleEncre: '{{ d.categorieEncre }}',
            categorie: '{{ d.categorie }}',
            apresCategorie:
              '<sc-if value="{{ d.etat }}">' +
              PASTILLE_H01('#EDF1EF', '#5D6B66', '{{ d.etat }}') +
              '</sc-if>',
            delai: '{{ d.delai }}',
            etape: '<sc-if value="{{ d.etape }}">' + LIGNE_ETAPE('{{ d.etape }}') + '</sc-if>',
            titreCouleur: 'color:{{ d.titreCouleur }}',
            titre: '{{ d.titre }}',
            extrait: '{{ d.extrait }}',
            pied:
              '<sc-if value="{{ d.ouverte }}">' +
              PIED_DEMANDE(
                '{{ d.auteurFond }}',
                '{{ d.auteurInitiales }}',
                '{{ d.auteur }}',
                '{{ d.auteurPhase }}',
                '{{ d.reponses }}',
                '{{ d.boutonFond }}',
              ) +
              '</sc-if>',
          }) +
          '</sc-for>',
        /**
         * ╔══════════════════════════════════════════════════════════════════╗
         * ║ DEUX MOTIFS, PARCE QU'UN GABARIT NE SE LIT PAS EN UNE PASSE      ║
         * ╚══════════════════════════════════════════════════════════════════╝
         *
         * Le troisième contrôle de `donnees` parcourt `noeud` AVEC UN SEUL
         * CURSEUR : chaque fragment de `devient` doit s'y trouver APRÈS le
         * précédent. C'est ce qui garantit qu'une donnée n'invente pas de dessin.
         *
         * Ici les trois variantes sont dessinées L'UNE APRÈS L'AUTRE, et le
         * gabarit les réunit : la pastille « Résolue » n'existe que dans la
         * TROISIÈME carte, la ligne d'étape que dans la DEUXIÈME. Le curseur
         * sautait donc à la troisième pour la pastille, puis ne retrouvait plus
         * la ligne d'étape — restée derrière lui.
         *
         * Les déclarer en `motifs` les retire du parcours sans rien relâcher :
         * le DEUXIÈME contrôle vérifie qu'ils sont bien dessinés dans ce cadre,
         * et la génération s'arrête si le designer les retire. On échange un
         * ordre que la maquette n'a pas contre une présence qu'elle garantit.
         */
        /**
         * ── CE QUE LE CADRE DE 390 px NE DESSINE PAS ──────────────────────
         *
         * Il ne montre que DEUX demandes : une ordinaire et une issue d'un
         * parcours. De la variante RÉSOLUE il ne dessine que les COULEURS —
         * pastille grise, titre grisé — qui sont ici déclarées `from`, puisque
         * seul le cadre d'ordinateur les écrit.
         *
         * L'ENCART « ça m'a aidé », lui, ne passe PAS par `donnees` : il
         * ajouterait au gabarit une fermeture que ce cadre n'a pas à offrir, et
         * le troisième contrôle a raison de la refuser. Il est posé par
         * l'adaptation `H01_RESOLUE_MOBILE`, qui est le mécanisme prévu pour un
         * dessin présent sur une planche et absent de l'autre.
         */
        motifs: [
          '<span style="background:#E0733A;color:#fff;font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px;white-space:nowrap">Depuis un parcours</span>',
          '<div style="font-size:12px;font-weight:700;color:#B4581F;margin-top:8px">',
          {
            from: 'docs/template/05 Entraide.dc.html',
            pattern:
              '<span style="background:#EDF1EF;color:#5D6B66;font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px;white-space:nowrap">',
          },
          { from: 'docs/template/05 Entraide.dc.html', pattern: 'margin-top:10px;color:' },
          ...MOTIFS_VIDE,
        ],
        fois: 1,
        frames: ['Mobile'],
        why: 'Les demandes d’entraide sur le cadre de 390 px — le porteur veut chaque correction sur les deux planches. Il n’en dessine que DEUX (il n’y a pas de demande résolue à 390 px), d’où un `noeud` plus court et la variante résolue EMPRUNTÉE au cadre d’ordinateur de la même maquette.',
      },
      {
        noeud: SOUS_TITRE('41 demandes ouvertes à Lyon · 178 résolues ce mois-ci'),
        devient: SOUS_TITRE(
          '{{ compteurs.ouvertes }} demandes ouvertes à {{ ville }} · {{ compteurs.resoluesCeMois }} résolues ce mois-ci',
        ),
        fois: 1,
        frames: ['Desktop'],
        why: 'Les deux compteurs de ville du `meta` de `GET /help` (`open`, `resolvedThisMonth`) et le nom de la ville.',
      },
      FILTRES_TYPE_H01,
      FILTRES_TYPE_H01_MOBILE,
      porteesDuFil('toutes', 5),
      bandeauSecurite('Aucun versement entre membres pour une démarche.'),
    ],
  },

  /**
   * Le titre d'un détail est celui de la demande affichée — la maquette n'en met
   * pas d'autre, et en ajouter un (« Demande ») serait exactement le titre inventé
   * qui a coûté A01.
   *
   * L'apostrophe de « l'installation » est DROITE ici, alors que « Fil d’entraide »
   * porte la courbe. C'est la maquette qui mélange les deux ; la déclaration la
   * recopie sans la corriger, sans quoi le titre ne serait plus trouvé.
   */
  {
    section: 'H02',
    frames: both("Un lit et une table pour l'installation", "Un lit et une table pour l'installation"),
    donnees: [
      ...bandeau(),
      {
        noeud:
          '<div style="font-size:12.5px;font-weight:700;color:#B4581F;margin-top:10px">Étape 7 · Logement · parcours Études · échéance dans 9 jours</div>',
        devient:
          '<sc-if value="{{ demande.parcours }}">' +
          '<div style="font-size:12.5px;font-weight:700;color:#B4581F;margin-top:10px">Étape {{ demande.parcours.etape }} · parcours {{ demande.parcours.type }} · échéance dans {{ demande.parcours.jours }} jours</div>' +
          '</sc-if>',
        fois: 1,
        frames: ['Desktop'],
        why: 'Le contexte de parcours de `journeyContext` (§2.5) : l’étape et le TYPE de parcours, jamais son titre personnel. Absent, la ligne disparaît au lieu d’afficher « Étape undefined ». LE « 7 » DISPARAÎT : `journeyContext` ne porte aucun RANG d’étape, et en composer un serait inventer un numéro — mieux vaut « Étape Logement » que « Étape 1 » faux.',
      },
      /**
       * LE `noeud` DE CE TITRE S'ÉCRIT `>texte<` ET PAS AUTREMENT, et c'est une
       * contrainte du générateur qu'il a fallu rencontrer pour la voir.
       *
       * Écrit avec son `<div>` entier, la liaison marchait — le titre s'affichait
       * bien depuis les données — mais `retitrerSurDonnees` ne la reconnaissait
       * plus : il compare `nu(noeud)` au texte déclaré, et `nu` ne dépouille qu'un
       * `>` initial et un `<` final. Le journal a crié « ⚠ titre déclaré
       * introuvable : la page n'aura pas de <h1> », et la cause était à deux
       * mécanismes de distance — exactement ce que l'en-tête de
       * `retitrerSurDonnees` raconte de K02.
       */
      {
        noeud: ">Un lit et une table pour l'installation<",
        devient: '>{{ demande.titre }}<',
        fois: 1,
        frames: ['Desktop'],
        why: 'Le titre de la demande, de `GET /help/:id` — et c’est AUSSI le titre de la page, repris par `retitrerSurDonnees`.',
      },
      {
        noeud:
          '<p style="margin:8px 0 0;font-size:14.5px;line-height:1.6">J\'emménage le 1er octobre dans un studio vide à Lyon 3e. Je cherche un lit et une petite table. Récupération possible en camionnette samedi.</p>',
        devient:
          '<p style="margin:8px 0 0;font-size:14.5px;line-height:1.6">{{ demande.corps }}</p>',
        fois: 1,
        frames: ['Desktop'],
        why: 'Le corps ENTIER de la demande (`request.body`) — la carte de liste, elle, reçoit l’extrait tronqué à 280 caractères.',
      },
      {
        noeud:
          '<span style="width:40px;height:40px;border-radius:999px;background:#E0733A;color:#fff;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">KB</span>',
        devient:
          '<span style="width:40px;height:40px;border-radius:999px;background:{{ demande.auteur.fond }};color:#fff;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">{{ demande.auteur.initiales }}</span>',
        fois: 1,
        frames: ['Desktop'],
        why: 'L’avatar de repli de l’auteur. La COULEUR est une donnée parce que la maquette en dessine trois (#E0733A, #0F5C48, #2FA37D) : n’en garder qu’une teindrait tous les membres de la même.',
      },
      {
        noeud: '>Kofi Boateng<',
        devient: '>{{ demande.auteur.nom }}<',
        fois: 1,
        frames: ['Desktop'],
        why: 'Le nom affiché de l’auteur, de `request.author.displayName`.',
      },
      {
        noeud:
          '<span style="display:block;font-size:12px;color:#8A958F">Arrivé · Lyon 3e</span>',
        devient:
          '<span style="display:block;font-size:12px;color:#8A958F">{{ demande.auteur.phase }} · {{ demande.auteur.ville }}</span>',
        fois: 1,
        frames: ['Desktop'],
        why: 'La phase et la ville de l’auteur (`author.phase`, `author.cityName`). ÉCART : la maquette GENRE la phase (« Arrivé »), et aucun champ de l’API ne porte le genre — les formes inclusives de `01` sont employées.',
      },
      /**
       * ── LE BANDEAU « APRÈS RÉSOLUTION » — TROUVÉ AU NAVIGATEUR ────────────
       *
       * Cette liaison n'existait pas, et c'est l'EXERCICE qui l'a réclamée, pas une
       * relecture. Un test affirmait que le nom dessiné « Sandra M. » avait disparu
       * de H02 une fois l'écran branché ; il a rougi sur un texte que personne
       * n'avait regardé : la planche dessine, SOUS la liste des réponses, un bandeau
       * « APRÈS RÉSOLUTION · Demande résolue — Sandra M. a été marquée “ça m'a
       * aidé” ».
       *
       * Un nom de membre écrit en dur, affiché à tous les lecteurs de toutes les
       * demandes. Lier les réponses sans lier ce bandeau laissait donc l'écran
       * nommer une personne qui n'a rien à voir avec la demande affichée — et le
       * défaut aurait survécu à tous les contrôles du générateur, puisque chacun ne
       * vérifie que ce qui est DÉCLARÉ. C'est exactement la raison pour laquelle la
       * méthode exige un navigateur et pas seulement un `tsc`.
       *
       * Le bandeau passe sous `<sc-if>` : il ne se dessine que sur une demande
       * RÉSOLUE. Sans la condition, une demande ouverte annoncerait sa propre
       * résolution.
       */
      {
        noeud:
          '<div style="font-size:14.5px;font-weight:700;margin-top:6px">Demande résolue — Sandra M. a été marquée « ça m\'a aidé »</div>',
        devient:
          '<sc-if value="{{ demande.resolue }}">' +
          '<div style="font-size:14.5px;font-weight:700;margin-top:6px">Demande résolue — {{ demande.resolue.aidant }} a été marquée « ça m\'a aidé »</div>' +
          '</sc-if>',
        fois: 1,
        frames: ['Desktop'],
        why: 'Le bandeau « APRÈS RÉSOLUTION » nomme l’aidant dont la réponse a été marquée (`resolvedByResponseId`). TROUVÉ AU NAVIGATEUR : il affichait « Sandra M. » en dur à tous les lecteurs de toutes les demandes.',
      },
      {
        noeud:
          '<span style="flex:1;font-size:13.5px;font-weight:600">Marquer l\'étape Logement comme franchie ?</span>',
        devient:
          '<sc-if value="{{ demande.parcours }}">' +
          '<span style="flex:1;font-size:13.5px;font-weight:600">Marquer l\'étape {{ demande.parcours.etape }} comme franchie ?</span>' +
          '</sc-if>',
        fois: 1,
        frames: ['Desktop'],
        why: 'La proposition de §2.4 nomme l’ÉTAPE de la demande, pas « Logement » en dur. Sous `<sc-if>` : une demande qui ne vient pas d’un parcours n’a aucune étape à franchir.',
      },
      {
        noeud: '>3 RÉPONSES · VUE AUTEUR<',
        devient: '>{{ demande.nbReponses }} RÉPONSES · VUE AUTEUR<',
        fois: 1,
        frames: ['Desktop'],
        why: 'Le nombre de réponses VISIBLES — celles d’un membre bloqué sont déjà retirées par le serveur, donc ce compte est celui de la liste rendue, pas `responseCount`.',
      },
      {
        noeud:
          REPONSE('#0F5C48', 'SM', 'Sandra M.', '· il y a 1 h', 'J’ai une table pliante à donner, Lyon 7e.', PASTILLE_MARQUEE) +
          REPONSE('#0F5C48', 'MD', 'Moussa D.', '· il y a 40 min', 'Emmaüs Villeurbanne a des lits à 30 €.', PASTILLE_A_MARQUER) +
          REPONSE('#2FA37D', 'FN', 'Fatou N.', '· il y a 10 min', 'Je peux prêter ma camionnette samedi matin.', PASTILLE_A_MARQUER),
        devient:
          '<sc-for list="{{ reponses }}" as="r">' +
          REPONSE(
            '{{ r.fond }}',
            '{{ r.initiales }}',
            '{{ r.nom }}',
            '{{ r.age }}',
            '{{ r.corps }}',
            '<sc-if value="{{ r.marquee }}">' +
              PASTILLE_MARQUEE +
              '</sc-if><sc-if value="{{ r.peutMarquer }}">' +
              PASTILLE_A_MARQUER +
              '</sc-if>',
          ) +
          '</sc-for>',
        fois: 1,
        frames: ['Desktop'],
        why: 'Les réponses publiques de `GET /help/:id` : la pastille REMPLIE marque celle qui a aidé, la DÉTOURÉE celles que l’auteur peut encore marquer (`canMarkHelpful`) — les deux variantes que la maquette dessine.',
      },

      /**
       * ── LE CADRE MOBILE DE H02, LIÉ LUI AUSSI ─────────────────────────────
       *
       * C'EST LE SEUL CADRE MOBILE DE CE MODULE QUI SOIT BRANCHÉ, et il faut dire
       * pourquoi les neuf autres ne le sont pas : le mobile ne dessine pas le même
       * contenu que l'ordinateur. Il n'a PAS de rail, donc pas de bandeau à lier ;
       * ce qu'il dessine à la place, ce sont les LISTES de cartes — et ce sont
       * exactement les listes que `screens/entraide/data.ts` remonte plutôt que de
       * monter à moitié.
       *
       * H02 est l'exception parce que son mobile dessine un DÉTAIL, pas une liste :
       * un titre, un corps, et des réponses qui emploient la MÊME carte que
       * l'ordinateur — la fabrique `REPONSE` les reproduit toutes les deux sans une
       * ligne de plus, ce qui est la preuve que la maquette les dessine pareil.
       *
       * LE MOBILE ÉCRIT UN CORPS PLUS COURT — « Studio vide à Lyon 3e, récupération
       * samedi. » contre le paragraphe entier de l'ordinateur. La maquette abrège à
       * la main ; l'API ne rend qu'UN corps et un extrait tronqué à 280 caractères.
       * Le mobile reçoit donc l'EXTRAIT, qui est la donnée faite pour la place
       * disponible — pas le corps entier, qui déborderait.
       */
      {
        noeud: '>Un lit et une table pour l\'installation<',
        devient: '>{{ demande.titre }}<',
        fois: 1,
        frames: ['Mobile'],
        why: 'Le titre de la demande sur mobile — et c’est aussi le `<h1>` que ce cadre promeut.',
      },
      {
        noeud:
          '<p style="margin:6px 0 0;font-size:13.5px;line-height:1.55">Studio vide à Lyon 3e, récupération samedi.</p>',
        devient:
          '<p style="margin:6px 0 0;font-size:13.5px;line-height:1.55">{{ demande.extrait }}</p>',
        fois: 1,
        frames: ['Mobile'],
        why: 'L’EXTRAIT tronqué par le serveur (`excerpt`, 280 caractères) et non le corps entier : le mobile abrège, et c’est la donnée faite pour cette place.',
      },
      {
        noeud:
          '<div style="font-size:12px;font-weight:700;color:#B4581F;margin-top:8px">Étape 7 · Logement</div>',
        devient:
          '<sc-if value="{{ demande.parcours }}">' +
          '<div style="font-size:12px;font-weight:700;color:#B4581F;margin-top:8px">Étape {{ demande.parcours.etape }}</div>' +
          '</sc-if>',
        fois: 1,
        frames: ['Mobile'],
        why: 'Le contexte de parcours sur mobile, réduit à l’étape — et le « 7 » disparaît pour la même raison que sur l’ordinateur : aucun rang n’est envoyé.',
      },
      {
        noeud:
          REPONSE('#0F5C48', 'SM', 'Sandra M.', '· 1 h', 'Table pliante à donner.', PASTILLE_MARQUEE) +
          REPONSE('#2FA37D', 'FN', 'Fatou N.', '· 10 min', 'Je prête ma camionnette.', PASTILLE_A_MARQUER),
        devient:
          '<sc-for list="{{ reponses }}" as="r">' +
          REPONSE(
            '{{ r.fond }}',
            '{{ r.initiales }}',
            '{{ r.nom }}',
            '{{ r.age }}',
            '{{ r.corps }}',
            '<sc-if value="{{ r.marquee }}">' +
              PASTILLE_MARQUEE +
              '</sc-if><sc-if value="{{ r.peutMarquer }}">' +
              PASTILLE_A_MARQUER +
              '</sc-if>',
          ) +
          '</sc-for>',
        fois: 1,
        frames: ['Mobile'],
        why: 'Les mêmes réponses sur mobile : la fabrique `REPONSE` reproduit les DEUX cartes du mobile sans une ligne de plus, ce qui prouve que la maquette les dessine comme celles de l’ordinateur.',
      },
    ],
  },

  /**
   * ── H03 · /entraide/nouveau — le composeur ─────────────────────────────────
   *
   * CE N'EST PAS UN ÉCRAN DE LECTURE, et presque rien n'y est une donnée : les
   * libellés, les cinq types et la phrase « Pour un logement ou un emploi,
   * utilisez Services. » sont du TEXTE DE RÈGLE, vrai pour tout le monde — et
   * cette dernière est d'ailleurs `HELP_USE_SERVICES_HINT` dans `@app/shared`,
   * donc déjà une source unique.
   *
   * Les deux seules vraies données sont la VILLE prérenseignée — `GET /me` rend
   * `cityId`, un UUID, et seul `GET /users/{pseudo}` en donne le nom — et les
   * exemples des champs, qui deviennent des `placeholder` au transcodage.
   *
   * L'ENCART « OFFRE · NIVEAU L0 » reste tel quel, et c'est une décision : le
   * niveau est AFFICHÉ, jamais employé pour autoriser (00 §7.3). On tente la
   * publication, et c'est le serveur qui répond `403 LEVEL_REQUIRED` avec de quoi
   * afficher l'invitation. Lier cet encart au niveau du jeton reviendrait à
   * décider côté écran ce que le serveur décide.
   */
  {
    section: 'H03',
    frames: both('Publier une demande', 'Publier une demande'),
    /**
     * LE COMPOSEUR N'A QU'UNE DONNÉE, et c'est son bandeau de sécurité.
     *
     * Tout le reste de la planche mobile est du FORMULAIRE : les deux onglets
     * « Demande » / « Offre », les quatre catégories, les libellés « Titre »,
     * « Votre demande », « Échéance », et leurs exemples de saisie
     * (« Accompagner un RDV préfecture », « Première convocation… », « Jeudi »).
     * Un exemple de champ n'est pas une donnée du membre : le lier afficherait sa
     * propre demande à la place de l'invite, sur l'écran où il la rédige.
     *
     * Son bandeau, lui, est la règle dure §2.7, et il l'ABRÈGE encore plus que
     * H01 — « Aucun versement entre membres. », sans la démarche ni la seconde
     * phrase. Deux planches, deux abrègements, une seule règle.
     */
    donnees: [...bandeau(), bandeauSecurite('Aucun versement entre membres.')],
  },

  /**
   * ── H04 · /entraide/aider — « Vous pouvez aider » ──────────────────────────
   *
   * Le sous-titre compte les suggestions de `GET /help/can-help`, et c'est le
   * nombre que la pastille du rail porte aussi : UNE donnée, deux endroits.
   */
  {
    section: 'H04',
    frames: both('Vous pouvez aider', 'Vous pouvez aider'),
    donnees: [
      ...bandeau(),
      ...colonneReputation(),
      {
        noeud: SOUS_TITRE('4 demandes correspondent à votre expérience'),
        devient: SOUS_TITRE('{{ compteurs.pouvezAider }} demandes correspondent à votre expérience'),
        fois: 1,
        frames: ['Desktop'],
        why: 'Le nombre de demandes suggérées, compté sur `GET /help/can-help` (§2.6).',
      },
      /**
       * LES TROIS PASTILLES DE PORTÉE DE H04, et pourquoi elles deviennent des
       * contrôles ici aussi.
       *
       * H04 EST LA MÊME RANGÉE, à trois pastilles au lieu de cinq. La laisser en
       * `<span>` aurait créé, à deux routes de distance, le défaut exact que ce lot
       * répare : le membre qui tape « Vous pouvez aider » sur H01 arrive sur une
       * page où la rangée redevient un dessin, et où « Toutes » ne le ramène pas.
       */
      porteesDuFil('aider', 3),
      SUGGESTIONS_H04,
    ],
  },

  /**
   * ── H05 · /parrainage — la liste des parrains ──────────────────────────────
   *
   * La ville du filtre est la SEULE donnée scalaire de cet écran : les trois
   * autres sélecteurs (« Langue », « Type de parcours », « Pays ») n'affichent que
   * leur libellé, sans valeur choisie.
   *
   * ET ELLE EST MAINTENANT LIÉE — SUR LES DEUX CADRES. Ce commentaire l'annonçait
   * comme une donnée et la laissait figée : « Lyon » était écrit en dur dans les
   * deux planches. C'est la ville pilote, donc c'était juste par accident, et ça
   * cessait de l'être au premier jour d'une seconde ville. Le fragment est le MÊME
   * à 1440 et à 390 px — la pastille active du filtre, une occurrence dans chaque
   * cadre, comptée — donc une seule déclaration sans clé `frames`, et c'est ce qui
   * fait du cadre mobile de H05 un cadre qui lit ses données sans que sa planche
   * dessine le moindre rail.
   */
  {
    section: 'H05',
    frames: both('Parrainage', 'Parrainage'),
    donnees: [
      ...bandeau(),
      {
        noeud:
          '<span style="padding:8px 13px;border-radius:999px;font-size:12.5px;font-weight:700;white-space:nowrap;background:#16785E;color:#fff;border:1px solid #16785E">Lyon</span>',
        devient:
          '<span style="padding:8px 13px;border-radius:999px;font-size:12.5px;font-weight:700;white-space:nowrap;background:#16785E;color:#fff;border:1px solid #16785E">{{ ville }}</span>',
        fois: 1,
        why: 'La ville du filtre de parrainage, résolue par `GET /users/{pseudo}` — `GET /me` ne rend que `cityId`, un UUID (même écart que K01).',
      },
    ],
  },

  /**
   * H06 N'A PAS DE CADRE MOBILE, et ce n'est pas un oubli de déclaration.
   *
   * La section dessine quatre planches : la FICHE (cadre de 1440 px), la FEUILLE DE
   * DEMANDE (carte nue de 540 px), APRÈS ENVOI (carte de 420 px) et MOBILE — qui
   * n'est pas la fiche sur téléphone, mais la FEUILLE DE DEMANDE posée sur un voile.
   *
   * Autrement dit, la maquette ne dessine pas la fiche du parrain sur mobile, et
   * elle ne dessine pas la feuille de demande sur ordinateur avec son voile. La
   * feuille n'est donc pas transcodable en modale ici : son cadre d'ordinateur est
   * une carte sans voile et sans panneau marqué, et `extractFrame` en retirerait de
   * surcroît la boîte blanche elle-même, puisque c'est le conteneur extérieur.
   *
   * La fiche est donc livrée seule, sur son unique cadre — `ScreenFrames` la sert
   * alors à toutes les largeurs, comme il le fait pour O05. La feuille de demande
   * est signalée dans le rapport plutôt que d'être à moitié montée.
   */
  /**
   * ── H06 · /parrainage/:handle — la fiche d'un parrain ──────────────────────
   *
   * BRANCHÉE SUR `GET /mentors/{handle}`, et le titre de la page EST le nom du
   * parrain : c'est une donnée, et `retitrerSurDonnees` la reprend.
   *
   * TROIS LITTÉRAUX DE CETTE PLANCHE NE SONT PAS LIÉS, et chacun pour une raison
   * mesurée plutôt que par fatigue :
   *
   *   · LES CINQ ÉTOILES. La maquette dessine CINQ étoiles sur CHACUNE de ses
   *     deux évaluations — compté. Ce n'est donc pas une note variable qu'elle
   *     dessine, c'est une rangée fixe. L'API rend bien `reviews[].rating` de 1 à
   *     5, mais le lier demanderait de dessiner une rangée à longueur variable que
   *     la maquette n'a pas dessinée. Écart signalé.
   *   · « 3 mois · durée habituelle ». C'est la DURÉE DE RÈGLE du §2.3
   *     (`MENTORSHIP_DURATION_DAYS = 90`), vraie pour tous les parrainages, pas une
   *     statistique de ce parrain. Aucun champ de `GET /mentors/:handle` ne la
   *     porte, et c'est juste : elle est déjà une source unique dans
   *     `@app/shared`.
   *   · « Réponse sous 7 jours ». Même nature : c'est
   *     `MENTORSHIP_REQUEST_EXPIRY_DAYS`, le délai au bout duquel une demande
   *     expire — pas le temps de réponse observé de ce parrain.
   *
   * ET UNE ABSENCE DE L'API, remontée : la ligne « Installée depuis 2019 · Lyon 7e
   * · Bénin » veut l'année d'arrivée et le pays d'origine. `MENTOR_SELECT`
   * sélectionne bien `arrivalDate` et `originCountryId` côté service, mais
   * `card()` n'en rend AUCUN des deux — ni l'année, ni le pays, ni même la phase.
   * La ligne est donc liée sur ce que la fiche ENVOIE : la ville, et rien d'autre
   * n'est inventé à côté.
   */
  {
    section: 'H06',
    frames: [{ width: 1440, name: 'Desktop', title: 'Aïcha Diop' }],
    donnees: [
      ...bandeau(),
      {
        noeud: '>AI<',
        devient: '>{{ parrain.initiales }}<',
        fois: 1,
        frames: ['Desktop'],
        why: 'Les initiales de l’avatar de repli du parrain, dérivées de `displayName`.',
      },
      {
        noeud:
          '<span style="background:#E3F0EB;color:#0F5C48;font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px;white-space:nowrap">Disponible</span>',
        devient:
          '<span style="background:{{ parrain.dispo.fond }};color:{{ parrain.dispo.texte }};font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px;white-space:nowrap">{{ parrain.dispo.libelle }}</span>',
        fois: 1,
        frames: ['Desktop'],
        why: 'La pastille « Disponible » / « Complet » (`availability`). Le LIBELLÉ et les DEUX couleurs sont des données : lier le seul libellé laisserait « Complet » sur le vert de « Disponible ».',
      },
      {
        noeud: '>Aïcha Diop<',
        devient: '>{{ parrain.nom }}<',
        fois: 1,
        frames: ['Desktop'],
        why: 'Le nom du parrain, de `GET /mentors/{handle}` — et c’est le titre de la page.',
      },
      {
        noeud:
          '<div style="font-size:13.5px;color:#8A958F;margin-top:4px">Installée depuis 2019 · Lyon 7e · Bénin</div>',
        devient:
          '<div style="font-size:13.5px;color:#8A958F;margin-top:4px">{{ parrain.situation }}</div>',
        fois: 1,
        frames: ['Desktop'],
        why: 'La ligne de situation. UN SEUL CHAMP et non trois : `card()` ne rend ni l’année d’arrivée, ni le pays d’origine, ni la phase — seule la ville arrive. Écart signalé, pas comblé en devinant.',
      },
      {
        noeud:
          '<p style="margin:14px 0 0;max-width:520px;font-size:14.5px;line-height:1.65">Arrivée comme étudiante, aujourd\'hui comptable. J\'aide surtout pour le logement, la CAF et les premiers mois à Lyon.</p>',
        devient:
          '<p style="margin:14px 0 0;max-width:520px;font-size:14.5px;line-height:1.65">{{ parrain.bio }}</p>',
        fois: 1,
        frames: ['Desktop'],
        why: 'La présentation du parrain (`bio`), nullable côté API.',
      },
      {
        noeud:
          '<div style="font-size:24px;font-weight:800;letter-spacing:-0.6px;color:#16211D">4</div><div style="font-size:12px;color:#5D6B66;margin-top:2px">parrainages menés</div>',
        devient:
          '<div style="font-size:24px;font-weight:800;letter-spacing:-0.6px;color:#16211D">{{ parrain.menes }}</div><div style="font-size:12px;color:#5D6B66;margin-top:2px">parrainages menés</div>',
        fois: 1,
        frames: ['Desktop'],
        why: 'Les parrainages menés (`completedCount`). §3.2 : la fiche porte cela et la note, et RIEN sur le réseau du parrain.',
      },
      {
        noeud:
          '<div style="font-size:24px;font-weight:800;letter-spacing:-0.6px;color:#16211D">4,8</div><div style="font-size:12px;color:#5D6B66;margin-top:2px">note moyenne</div>',
        devient:
          '<div style="font-size:24px;font-weight:800;letter-spacing:-0.6px;color:#16211D">{{ parrain.note }}</div><div style="font-size:12px;color:#5D6B66;margin-top:2px">note moyenne</div>',
        fois: 1,
        frames: ['Desktop'],
        why: 'La note moyenne (`avgRating`), nullable : un parrain sans évaluation n’en a pas, et la virgule décimale est celle du français.',
      },
      /**
       * LES ÉVALUATIONS, EN `<sc-for>` — ET PAS EN LIAISONS INDEXÉES.
       *
       * Première tentative : deux liaisons, `{{ evaluations.0.commentaire }}` et
       * `{{ evaluations.1.commentaire }}`. Le générateur l'a acceptée — rien dans
       * ses quatre contrôles ne s'y oppose — et le JSX émis était
       * `{evaluations.0.commentaire}`, qui n'est PAS du JavaScript valide. Le
       * défaut ne se voyait qu'au `tsc`, deux étapes plus loin, et il aurait pu se
       * voir seulement à la construction du front : quinze minutes.
       *
       * Une liaison indexée n'a donc pas de forme valide ici, et c'est tant mieux —
       * figer deux emplacements aurait de toute façon menti sur la troisième
       * évaluation.
       *
       * Les deux items de la maquette sont RIGOUREUSEMENT identiques à leurs
       * textes près, cinq étoiles comprises : la fabrique les reproduit tous les
       * deux, et le `fois: 1` le vérifie.
       */
      {
        noeud:
          EVALUATION('Disponible et très claire sur la CAF.', 'Fatou') +
          EVALUATION('M’a aidé à trouver ma coloc.', 'Kofi'),
        devient:
          '<sc-for list="{{ evaluations }}" as="e">' +
          EVALUATION('{{ e.commentaire }}', '{{ e.auteur }}') +
          '</sc-for>',
        fois: 1,
        frames: ['Desktop'],
        why: 'Les évaluations visibles de `GET /mentors/{handle}`. ÉCART MESURÉ : la liste reste VIDE pendant 14 jours — `visibleReviewsFor` exige deux évaluations sur le MÊME sujet, ce qu’un parrainage ne produit jamais. Les CINQ ÉTOILES restent dessinées : la maquette en met cinq sur chacune, donc elle ne dessine pas une note variable.',
      },
      {
        noeud: '>Demander comme parraine<',
        devient: '>Demander comme {{ parrain.appellation }}<',
        fois: 1,
        frames: ['Desktop'],
        why: 'Le bouton de demande. « parraine » est GENRÉ par la maquette et aucun champ de l’API ne porte le genre : l’appellation est une donnée pour que l’écart soit visible, pas deviné d’après le prénom.',
      },
    ],
  },

  /**
   * ── H07 · /parrainage/mes-parrainages ──────────────────────────────────────
   *
   * LE CADRE MOBILE N'A RIEN QU'IL PUISSE LIRE, et c'est une ligne de sa carte qui
   * l'interdit — pas un manque de temps.
   *
   * Ses deux planches sont les deux ÉTATS d'un parrainage : un ACTIF (avatar de
   * 44 px, pastille de rôle, « Fin dans 42 jours », trois boutons) et une DEMANDE
   * REÇUE (avatar de 40 px, « Demande reçue », un bouton). Les deux viennent du
   * même `items` de `GET /me/mentorships`, et presque tout y est : `other.displayName`,
   * `role`, `status`, `endsAt`.
   *
   * PRESQUE. La carte active écrit « Mes études à Lyon » sous le nom — LE TITRE DU
   * PARCOURS du filleul. `myMentorshipsResponseSchema` ne rend que `journeyId`, un
   * UUID, et rien dans ce module ne le résout : lire le parcours d'un autre membre
   * demande `GET /journeys/:id`, que §3.4 réserve à son équipe. Lier la carte
   * laisserait donc ce littéral DANS une boucle, et chacun de mes filleuls
   * jurerait suivre « Mes études à Lyon ». C'est exactement le défaut que les
   * quatre listes de ce module évitent déjà (voir l'en-tête de
   * `screens/entraide/data.ts`), et il ne devient pas acceptable parce que la
   * liste est plus courte.
   *
   * Le reste de la planche est une barre d'onglets — « Filleul·e », « Parrain » —
   * sans aucun nombre. Remonté au porteur : il faudrait que `GET /me/mentorships`
   * nomme le parcours (son TYPE suffirait, et §2.5 n'autorise que le type), ou que
   * la planche cesse de l'écrire.
   */
  {
    section: 'H07',
    frames: both('Mes parrainages', 'Mes parrainages'),
    donnees: [...bandeau()],
  },

  /**
   * ── H08 · /parrainage/devenir ──────────────────────────────────────────────
   *
   * LES TROIS CONDITIONS SONT DU TEXTE DE RÈGLE — « Identité vérifiée », « Numéro
   * français vérifié », « Parcours abouti ou 12 mois d'installation » — et elles
   * sont vraies pour tout le monde (§2.1). Elles ne sont donc PAS liées : l'API
   * dit si le membre est éligible en REFUSANT `PUT /me/mentor-profile` avec
   * `MENTOR_NOT_ELIGIBLE`, et il n'existe aucune route qui réponde « voici
   * lesquelles des trois vous manquent ». Lier des pastilles d'état ici
   * demanderait d'inventer ce diagnostic. Écart signalé.
   */
  {
    section: 'H08',
    frames: both('Devenir parrain', 'Devenir parrain'),
    donnees: [...bandeau()],
  },

  // H09 et H10 ne figurent pas dans T5 ; la maquette et l'API les portent
  // (`/help/mine`, `/help/my-responses`, §5 « Panneau Entraide »). Leurs routes
  // sont celles que la maquette écrit sous leur numéro de planche.
  /**
   * ── H09 · LE CADRE MOBILE NE LIT RIEN, ET TROIS LITTÉRAUX L'EXPLIQUENT ─────
   *
   * Sa rangée de filtres — « Toutes », « Ouvertes », « Résolues » — ne porte AUCUN
   * nombre, contrairement à celle de H01 et H04 : il n'y a donc pas de compteur à
   * lier. Reste la liste de MES demandes, et elle bute sur trois littéraux dont
   * aucune réponse ne porte la source :
   *
   *   · « Étape 7 · Logement · échéance dans 9 jours » — `helpCardSchema` ne rend
   *     que `fromJourney: boolean` ; le `journeyContext` n'existe que sur
   *     `GET /help/:id`, une demande à la fois ;
   *   · « 3 réponses · 2 nouvelles » — `responseCount` existe, « nouvelles » non.
   *     Aucun champ ne dit « vue depuis », l'écart est déjà écrit dans
   *     `screens/h09/data.ts` ;
   *   · « visible jusqu'au 10 octobre » — aucune date d'expiration dans la carte.
   *     `S09` a le même besoin et l'API le sert là-bas (`expiresAt` de
   *     `housingCardSchema`) ; `help` n'en a pas.
   *
   * Lier la liste mettrait ces trois phrases DANS un `<sc-for>`, donc sur chacune
   * de mes demandes. Trois mensonges par ligne valent moins qu'un cadre qui ne lit
   * rien, et la raison de fond est celle qu'écrit l'en-tête de
   * `screens/entraide/data.ts` : « ce n'est pas un travail qu'on fait à moitié ».
   * Remonté au porteur, avec les trois champs qui manquent.
   */
  {
    section: 'H09',
    frames: both('Mes demandes', 'Fil d’entraide'),
    donnees: [
      ...bandeau(),
      {
        noeud: SOUS_TITRE('4 demandes · 1 avec de nouvelles réponses'),
        devient: SOUS_TITRE(
          '{{ mesDemandes.total }} demandes · {{ mesDemandes.avecNouvelles }} avec de nouvelles réponses',
        ),
        fois: 1,
        frames: ['Desktop'],
        why: 'Le nombre de MES demandes, compté sur `GET /help/mine`.',
      },
    ],
  },

  /**
   * ── H10 · /entraide/mes-reponses ───────────────────────────────────────────
   *
   * Le sous-titre et la carte de bilan portent les MÊMES deux nombres, et la
   * colonne de droite les répète : « 23 » deux fois, « 31 » deux fois. Les deux
   * formes du « 23 » ont été comptées séparément, parce que la maquette les
   * dessine dans deux balises différentes.
   */
  {
    section: 'H10',
    frames: both('Mes réponses', 'Fil d’entraide'),
    donnees: [
      ...bandeau(),
      ...colonneReputation({ minis: false }),
      {
        noeud: SOUS_TITRE('31 réponses · 23 marquées utiles'),
        devient: SOUS_TITRE(
          '{{ mesReponses.total }} réponses · {{ mesReponses.utiles }} marquées utiles',
        ),
        fois: 1,
        frames: ['Desktop'],
        why: 'Mes réponses et celles marquées « ça m’a aidé », comptées sur `GET /help/my-responses`.',
      },
      {
        noeud: '>entraides validées sur 31 réponses<',
        devient: '>entraides validées sur {{ mesReponses.total }} réponses<',
        fois: 1,
        frames: ['Desktop'],
        why: 'La légende de la carte de bilan : le même total que le sous-titre.',
      },
      {
        noeud:
          CARTE_REPONSE_M({
            categorie: 'Matériel',
            etat: MARQUEE,
            age: 'hier',
            auteur: 'Kofi B.',
            titre: 'Un lit et une table',
            corps: 'J’ai une table pliante à donner, Lyon 7e.',
            bilan: BILAN_MARQUEE('Kofi'),
            second: 'Écrire à Kofi',
          }) +
          CARTE_REPONSE_M({
            categorie: 'Démarches',
            etat: EN_ATTENTE,
            age: 'il y a 3 h',
            auteur: 'Fatou N.',
            titre: 'Accompagner un RDV préfecture',
            corps: 'Je connais la procédure, je peux venir jeudi.',
            second: 'Modifier ma réponse',
          }),
        devient:
          '<sc-for list="{{ mesReponses.liste }}" as="r">' +
          '<sc-if value="{{ r.marquee }}">' +
          CARTE_REPONSE_M({
            categorie: '{{ r.categorie }}',
            etat: MARQUEE,
            age: '{{ r.age }}',
            auteur: '{{ r.auteur }}',
            titre: '{{ r.titre }}',
            corps: '{{ r.corps }}',
            bilan: BILAN_MARQUEE('{{ r.prenom }}'),
            second: 'Écrire à {{ r.prenom }}',
          }) +
          '</sc-if><sc-if value="{{ r.attente }}">' +
          CARTE_REPONSE_M({
            categorie: '{{ r.categorie }}',
            etat: EN_ATTENTE,
            age: '{{ r.age }}',
            auteur: '{{ r.auteur }}',
            titre: '{{ r.titre }}',
            corps: '{{ r.corps }}',
            second: 'Modifier ma réponse',
          }) +
          '</sc-if></sc-for>',
        fois: 1,
        frames: ['Mobile'],
        why: 'Mes réponses, de `GET /help/my-responses` : la réponse, la demande qui la porte, son auteur et son état. LES DEUX VARIANTES de la maquette sont dessinées en entier sous `<sc-if>` — marquée utile avec son bandeau de bilan, en attente sans — parce qu’en garder une seule mentirait sur l’autre ligne.',
      },
    ],
  },
].map((s) => ({
  file: 'docs/template/05 Entraide.dc.html',
  section: s.section,
  out: `apps/web/src/screens/${s.section.toLowerCase()}`,
  /**
   * UN TYPE PAR ÉCRAN, dans le `data.ts` de l'écran lui-même.
   *
   * Un `EntraideData` partagé par les dix obligerait CHAQUE page à fournir les
   * champs de toutes les autres : H03, qui ne lit qu'un référentiel de villes,
   * devrait inventer des parrains et des réponses. Le type par écran dit
   * exactement ce que la page charge, et `tsc` le vérifie.
   */
  dataModule: './data',
  dataType: `${s.section}Data`,
  frames: s.frames,
  /**
   * ─── LE SQUELETTE MEMBRE : LE RAIL, SUR LES DIX CADRES D'ORDINATEUR ───────
   *
   * Les dix planches d'ordinateur de ce module dessinent le rail en `<span>` —
   * Accueil, Parcours, Entraide, Services, Agenda — donc cliquer n'y changeait
   * pas l'URL. Les cinq destinations sont déclarées une fois pour les sept
   * modules membre dans `tools/squelette-membre.mjs`.
   *
   * AUCUNE EXCEPTION ICI, et c'est vérifié : les dix écrans ont un cadre
   * d'ordinateur, les dix le dessinent, et aucun cadre mobile ne le dessine.
   * La surbrillance est déjà juste — la maquette peint « Entraide » sur les dix.
   */
  /**
   * LE RAIL *ET* LE PANNEAU DE SECTION. Les deux sont dessinés en `<span>` sur les
   * dix cadres d'ordinateur, et les deux sont des « sous liens » au sens du
   * porteur. Le rail est déclaré une fois pour les sept modules membre
   * (`tools/squelette-membre.mjs`) ; le panneau est propre à cette maquette, donc
   * il est déclaré ici.
   */
  liens: [
    ...railLitteral(s.frames.map((f) => f.name).filter((n) => n.includes('Desktop'))),
    ...panneauEntraide(s.frames.map((f) => f.name).filter((n) => n.includes('Desktop'))),
    /**
     * LA BARRE BASSE N'EST QUE SUR SIX DES DIX CADRES MOBILES, et c'est MESURÉ,
     * pas déduit d'un nom : H01, H04, H05, H07, H09 et H10 la dessinent ; H02,
     * H03, H06 et H08 ne la dessinent pas — H06 n'a même pas de cadre mobile. Une
     * règle sur le nom « Mobile » l'aurait appliquée aux quatre autres, et le
     * compte serait tombé à zéro : la génération aurait refusé en les nommant,
     * donc le défaut n'aurait pas été silencieux. La liste est écrite quand même,
     * parce qu'un refus coûte un aller-retour et qu'une liste comptée n'en coûte
     * aucun.
     */
    ...(BARRE_BASSE_ENTRAIDE.has(s.section) ? barreBasse(['Mobile']) : []),
  ],
  ...(s.donnees === undefined ? {} : { donnees: s.donnees }),
}));
