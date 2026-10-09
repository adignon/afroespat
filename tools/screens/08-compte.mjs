/**
 * Les écrans de `docs/template/08 Compte.dc.html` — K01 à K10, dix sections.
 *
 * Un fichier par maquette : voir l'en-tête de `01-onboarding.mjs` pour la raison.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * CETTE MAQUETTE N'EMPLOIE PAS LE DIALECTE, ET C'EST `donnees` QUI S'EN CHARGE.
 *
 * Son `renderVals()` rend `{}`, elle ne contient ni `{{ … }}` ni `<sc-for>` —
 * zéro de chacun, compté — et tout son contenu est écrit en clair. Comme 04, 05,
 * 06, 07, 09 et 10 : sept maquettes sur neuf.
 *
 * La conséquence était mesurable : les vingt-cinq cadres de ce module portaient
 * une signature `(_props: CompteData)`. Le souligné dit que le paramètre n'est pas
 * lu — ces écrans recevaient des données et les IGNORAIENT, et il n'existait aucune
 * prise où brancher l'API.
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
 * Les valeurs, elles, vivent dans `apps/web/src/screens/compte/data.ts` — comme
 * celles de `screens/a01/data.ts`. Le JSX transcodé n'a pas bougé d'une virgule.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * ELLE N'ÉCRIT AUCUN `<h2>` : son unique `<h1>` est celui de la planche de
 * documentation, hors section. Les titres de page sont donc DÉCLARÉS ici, avec
 * leur texte visible ET leur corps — le corps n'est pas du zèle : « Contacts »
 * figure deux fois dans le cadre d'ordinateur de K05 (l'entrée du panneau
 * « MON COMPTE » d'abord, le titre de la page ensuite), et « Enregistrés »,
 * « Notifications », « Abonnement », « Sanctions » de même. Sans discriminant on
 * promouvrait l'entrée du panneau, et le défaut serait invisible : le texte
 * affiché est le même.
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

import { barreBasse, cadresDeLaBarre, cadresDuRail, railLitteral } from '../squelette-membre.mjs';

const FILE = 'docs/template/08 Compte.dc.html';

const screen = ({ section, out, frames, dataType = 'CompteData', modal = false,
  squelette = !modal,
  /**
   * LES LIENS PROPRES À L'ÉCRAN S'AJOUTENT AU SQUELETTE, ILS NE LE REMPLACENT PAS.
   *
   * `liens` était ramassé par `...rest`, répandu APRÈS le squelette : un écran qui
   * aurait déclaré ses propres liens aurait EFFACÉ les cinq entrées de son rail,
   * en silence et sans qu'aucun compte ne bouge. La clé est donc nommée et
   * CONCATÉNÉE.
   */
  liens = [], ...rest }) => ({
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
  liens: [...(squelette ? railLitteral(cadresDuRail(frames)) : []), ...liens],
  section,
  out: `apps/web/src/screens/${out}`,
  dataModule: '../compte/data',
  dataType,
  frames,
  ...rest,
});

/**
 * ╔═════════════════════════════════════════════════════════════════════════╗
 * ║ LE PANNEAU « MON COMPTE » — NEUF ENTRÉES, NEUF ROUTES, ZÉRO LIEN            ║
 * ╚═════════════════════════════════════════════════════════════════════════╝
 *
 * CE N'EST PAS LE PANNEAU DÉJÀ BRANCHÉ, et c'est la confusion à lever d'abord.
 * `squelette-membre.mjs` déclare `panneauBoucle` : les SEPT entrées du panneau
 * « COMMUNAUTÉ », qui vivent dans un `<sc-for as="m">` des treize cadres de
 * `03 Accueil v2`. Le panneau « MON COMPTE » de CETTE maquette est un AUTRE
 * panneau : neuf entrées LITTÉRALES, écrites en clair, dans un `<span>` chacune.
 *
 * Il n'était donc branché nulle part, et il ne comptait dans aucun `href="#"` —
 * le récapitulatif de la génération ne l'a jamais vu. C'est pourtant le menu du
 * module Compte : neuf affordances mortes sur chacun des dix cadres d'ordinateur.
 *
 * ── LES NEUF ROUTES VIENNENT DE T5 §11, UNE PAR UNE ───────────────────────
 *
 * Et la correspondance est EXACTE — neuf entrées, neuf lignes K01…K10 de la table,
 * aucun trou et aucun arbitrage à prendre, ce qui n'arrive jamais :
 *
 *   Profil → K01 `/compte/profil`          Enregistrés   → K10 `/compte/enregistres`
 *   Vérification → K03 `/compte/verification`  Abonnement → K06 `/compte/abonnement`
 *   Sécurité → K04 `/compte/securite`      Notifications → K07 `/compte/notifications`
 *   Contacts → K05 `/compte/contacts`       Mes données   → K08 `/compte/donnees`
 *                                           Sanctions     → K09 `/compte/sanctions`
 *
 * Les neuf existent dans `app/(app)/compte/` — vérifié dossier par dossier. Le seul
 * chemin de ce module qui N'EXISTE PAS est `/compte` lui-même, et c'est pour cela
 * que l'onglet « Compte » de la barre basse reste mort (voir `squelette-membre.mjs`).
 *
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LE DISCRIMINANT EST L'ICÔNE, PAS LE LIBELLÉ — ET C'EST UNE ZONE CLIQUABLE   ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * `markLinks` remonte du marqueur jusqu'à la PREMIÈRE balise promouvable qui le
 * contient. Or chaque libellé est enfermé dans un `<span style="flex:1">` : avec
 * `texte: 'Profil'`, la remontée s'arrêterait sur CE span et promouvrait LE
 * LIBELLÉ au lieu de la rangée. La zone cliquable passerait de 44 px de haut sur
 * toute la largeur du panneau à la seule largeur du mot — un déplacement de
 * dessin silencieux, et le reste de la rangée redeviendrait mort.
 *
 * C'est exactement le piège que `squelette-membre.mjs` a déjà payé sur le panneau
 * COMMUNAUTÉ, et la parade est la même : le marqueur est le TRACÉ de l'icône,
 * posé dans un `<path>` sous un `<svg>` — deux balises non promouvables — donc la
 * remontée atteint la rangée. Les neuf tracés sont RECOPIÉS VERBATIM de la
 * maquette, et `fois: 1` les recompte à chaque génération.
 *
 * ── POURQUOI `dans` EST INDISPENSABLE ICI ─────────────────────────────────
 *
 * Le tracé de la cloche « Notifications » figure DEUX FOIS dans le cadre : dans
 * le panneau, et dans la cloche de la barre haute. Mesuré. Sans bornage, la
 * déclaration désignerait deux éléments et la génération s'arrêterait — ce qui est
 * le bon comportement, et pas celui qu'on veut tous les jours. Le conteneur est la
 * carte du panneau, en-tête « MON COMPTE » comprise : c'est ce qui le rend unique.
 *
 * ── CE QUE CE LOT N'A PAS FAIT, ET C'EST UNE DÉCISION DE PÉRIMÈTRE ─────────
 *
 * LE PANNEAU EST SUR LES DIX CADRES D'ORDINATEUR DE CETTE MAQUETTE (K01 à K10).
 * Il n'a longtemps été branché que sur UN — K04, le seul écran confié au lot qui
 * l'avait écrit — et les neuf autres gardaient leurs `<span>` morts. C'était une
 * décision de périmètre, assumée et REMONTÉE, pas un oubli.
 *
 * LE PORTEUR L'A TRANCHÉE : « les liens vérifications et autres ne marchent
 * toujours pas ». MESURÉ : `<a href="/compte/…">` ne figurait que dans K04 ; sur
 * les sept autres écrans où le panneau est dessiné, cliquer ne faisait rien. La
 * table avait été écrite pour que ça coûte UNE LIGNE par écran — c'est ce que
 * cela a coûté.
 *
 * ── ET LA SURBRILLANCE N'EST PAS TOUCHÉE ──────────────────────────────────
 *
 * La maquette peint déjà l'entrée de SA page sur chaque planche — sur K04 c'est
 * « Sécurité », en `background:#E3F0EB;color:#0F5C48;font-weight:700`. `markLinks`
 * PRÉFIXE sa neutralisation, donc ces trois déclarations gagnent. Mesuré sur le
 * cadre produit.
 */
const PANNEAU_MON_COMPTE =
  '<div style="background:#fff;border:1px solid #E6EBE9;border-radius:22px;padding:14px">' +
  '<div style="padding:0 6px 8px">' +
  '<div style="font-size:10.5px;font-weight:700;letter-spacing:1px;color:#8A958F">' +
  'MON COMPTE</div></div>';

/**
 * Les neuf entrées : le tracé de leur icône (VERBATIM de la maquette), leur
 * libellé (pour que la table se relise), et leur route (T5 §11).
 *
 * Le libellé ne sert PAS de discriminant — voir ci-dessus — mais il est écrit :
 * sans lui, cette table serait neuf tracés SVG illisibles, et la prochaine
 * personne qui la relit ne pourrait pas vérifier une seule destination.
 */
const ENTREES_MON_COMPTE = [
  ['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM5 21a7 7 0 0 1 14 0', 'Profil', '/compte/profil'],
  ['M12 3 4 6v6c0 4.5 3.5 8 8 9 4.5-1 8-4.5 8-9V6z', 'Vérification', '/compte/verification'],
  [
    'M15 7a4 4 0 1 1-3.9 4.9L4 19v2h3l1-1v-2h2v-2h2l.1-.1A4 4 0 0 1 15 7z',
    'Sécurité',
    '/compte/securite',
  ],
  [
    'M9 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20a6 6 0 0 1 12 0M17 11a2.5 2.5 0 1 0 0-5M16 20h5a5 5 0 0 0-4-5',
    'Contacts',
    '/compte/contacts',
  ],
  [
    'M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z',
    'Enregistrés',
    '/compte/enregistres',
  ],
  [
    'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
    'Abonnement',
    '/compte/abonnement',
  ],
  [
    'M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20a2 2 0 0 0 4 0',
    'Notifications',
    '/compte/notifications',
  ],
  ['M12 4v11M7 10l5 5 5-5M5 20h14', 'Mes données', '/compte/donnees'],
  ['M5 21V4h12l-2 4 2 4H5', 'Sanctions', '/compte/sanctions'],
];

/** Le panneau « MON COMPTE » : neuf `<span>` promus en neuf `<a>`. */
const panneauMonCompte = (frames) =>
  ENTREES_MON_COMPTE.map(([trace, libelle, vers]) => ({
    dans: PANNEAU_MON_COMPTE,
    marqueur: `<path d="${trace}"/>`,
    vers,
    frames,
    why:
      `L’entrée « ${libelle} » du panneau MON COMPTE mène à ${vers} (T5 §11). La maquette la ` +
      'dessine en <span> : ce n’était pas un lien cassé, ce n’était pas un lien. Le ' +
      'discriminant est le TRACÉ de son icône et non son libellé : le libellé est enfermé ' +
      'dans un <span style="flex:1"> et la promotion y déplacerait la zone cliquable.',
  }));

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

/**
 * ─── LE BANDEAU DE COMPTE, LIÉ SUR LES DIX CADRES D'ORDINATEUR ──────────────
 *
 * Les dix planches d'ordinateur de cette maquette dessinent le même bandeau : le
 * rail, le panneau « MON COMPTE », la carte d'identité du membre et la barre
 * haute. Ce sont donc les mêmes quatre littéraux à lier dix fois, et les compter
 * a montré qu'ils sont RIGOUREUSEMENT réguliers — « Amina Diallo » une fois,
 * « AD » deux fois, le pseudo-et-niveau une fois, le prénom une fois — SAUF sur
 * K01, où la page parle du membre lui-même et les répète (3 et 4).
 *
 * D'où cette fonction plutôt que dix copies : les deux nombres sont l'argument, et
 * ce qu'ils valent est VÉRIFIÉ à chaque génération. Le jour où le designer ajoute
 * un avatar au bandeau, la génération s'arrête sur le cadre concerné en nommant
 * « AD » — elle ne produit pas neuf écrans justes et un faux.
 *
 * `moi.demandes` est la pastille orange du panneau, à côté de « Contacts ». Elle
 * compte les demandes de contact REÇUES (08 §3.1), et c'est la donnée la plus
 * facile à laisser figée : « 2 » est un nombre plausible pour toujours. Son ancre
 * porte la fin du style du rond, parce que « 2 » seul figure ailleurs.
 */
const PASTILLE_DEMANDES =
  '<span style="background:#E0733A;color:#fff;font-size:11px;font-weight:700;min-width:22px;height:22px;padding:0 7px;border-radius:999px;display:flex;align-items:center;justify-content:center">2</span>';

const bandeau = ({ nom = 1, initiales = 2 } = {}) => [
  {
    noeud: '>Amina Diallo<',
    devient: '>{{ moi.nom }}<',
    fois: nom,
    frames: ['Desktop'],
    why: 'Le nom affiché du membre connecté, de `GET /me`.',
  },
  {
    noeud: '>AD<',
    devient: '>{{ moi.initiales }}<',
    fois: initiales,
    frames: ['Desktop'],
    why: 'Les initiales de l’avatar de repli, dérivées du nom affiché.',
  },
  {
    noeud: '>@amina.d · niveau 2<',
    devient: '>{{ moi.pseudo }} · niveau {{ moi.niveau }}<',
    fois: 1,
    frames: ['Desktop'],
    why: 'Pseudo et niveau de vérification, de `GET /me` — affichés, jamais employés pour autoriser.',
  },
  {
    noeud: '>Amina<',
    devient: '>{{ moi.prenom }}<',
    fois: 1,
    frames: ['Desktop'],
    why: 'Le prénom de la barre haute, premier mot du nom affiché.',
  },
  {
    noeud: PASTILLE_DEMANDES,
    devient:
      '<sc-if value="{{ moi.demandes }}">' +
      PASTILLE_DEMANDES.replace('>2</span>', '>{{ moi.demandes }}</span>') +
      '</sc-if>',
    fois: 1,
    frames: ['Desktop'],
    why: 'La pastille « Contacts » compte les demandes reçues (`GET /me/connection-requests`) ; à zéro, elle disparaît au lieu d’afficher un rond orange vide.',
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
 * K04 — le bouton « Retirer » d'une ligne de téléphone, et la mention qui le
 * REMPLACE sur la première ligne du cadre mobile.
 *
 * L'écart est celui que l'en-tête de K04 signale déjà : le cadre mobile écrit
 * « Dernier numéro, non retirable » là où le cadre d'ordinateur laisse un bouton
 * sur les deux lignes. Ce sont donc les DEUX variantes que la maquette dessine, et
 * le cadre mobile les porte toutes les deux sous `<sc-if>` — en lier une seule
 * mentirait sur l'autre ligne, exactement comme pour les sessions.
 */
const BOUTON_RETIRER =
  '<button style="height:44px;padding:0 18px;border-radius:14px;background:#F2F5F4;color:#16211D;border:none;font:inherit;font-size:13.5px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:8px;white-space:nowrap;flex-shrink:0;height:36px">Retirer</button>';

const MENTION_DERNIER =
  '<span style="font-size:12px;color:#8A958F">Dernier numéro, non retirable</span>';

/**
 * K04 — une ligne de téléphone. `fin` est le bouton « Retirer » (le défaut, et ce
 * que les DEUX lignes d'ordinateur dessinent) ou la mention du cadre mobile.
 */
const CARTE_TELEPHONE = (masque, role, fin = BOUTON_RETIRER) =>
  '<div style="display:flex;align-items:center;gap:12px;padding:14px 0;border-bottom:1px solid #F0F3F2">' +
  '<span style="width:38px;height:38px;border-radius:12px;background:#E3F0EB;display:flex;align-items:center;justify-content:center">' +
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0F5C48" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg></span>' +
  '<div style="flex:1"><div style="font-size:14px;font-weight:700">' +
  masque +
  '</div><div style="font-size:12px;color:#8A958F">' +
  role +
  '</div></div>' +
  fin +
  '</div>';

/** K04 — une ligne de session. `fin` est la pastille « Actuelle » ou le bouton. */
const CARTE_SESSION = (appareil, vu, fin) =>
  '<div style="display:flex;align-items:center;gap:12px;padding:14px 0;border-bottom:1px solid #F0F3F2">' +
  '<span style="width:38px;height:38px;border-radius:12px;background:#F2F5F4;display:flex;align-items:center;justify-content:center">' +
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16211D" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M5 3h14v18H5zM11 18h2"/></svg></span>' +
  '<div style="flex:1"><div style="font-size:14px;font-weight:700">' +
  appareil +
  '</div><div style="font-size:12px;color:#8A958F">' +
  vu +
  '</div></div>' +
  fin +
  '</div>';

const PASTILLE_ACTUELLE =
  '<span style="background:#E3F0EB;color:#0F5C48;font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px;white-space:nowrap">Actuelle</span>';

/**
 * K03 — la pastille d'état d'un niveau, et le libellé qui la précède.
 *
 * Le libellé entre dans l'ancre et n'en sort jamais : « Acquis » est écrit DEUX
 * FOIS sur la planche d'ordinateur (N0 et N1) et le rond de « À faire » est
 * dessiné à l'identique dans d'autres cartes. Sans le libellé, `fois` ne pourrait
 * pas distinguer le niveau dont on parle — et c'est précisément le défaut que
 * `fois` existe pour empêcher.
 *
 * LES DEUX COULEURS SONT DES DONNÉES, pas seulement le mot : lier le seul libellé
 * laisserait « Acquis » sur le fond orange d'un niveau à faire, ce qui serait pire
 * que la maquette figée. Les deux paires viennent de la maquette — `#E3F0EB` sur
 * `#0F5C48` pour un acquis, `#FBE3D4` sur `#B4581F` pour un reste-à-faire — et
 * aucune n'est retouchée : le troisième contrôle du générateur arrêterait la
 * génération si elle l'était.
 */
const PASTILLE_NIVEAU = (libelle, fond, texte, etat) =>
  '>' +
  libelle +
  '</div></div><span style="background:' +
  fond +
  ';color:' +
  texte +
  ';font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px;white-space:nowrap">' +
  etat +
  '</span>';

/** Le niveau `n`, dans le dialecte : les trois champs de `PastilleNiveau`. */
const PASTILLE_NIVEAU_LIEE = (libelle, n) =>
  PASTILLE_NIVEAU(
    libelle,
    `{{ niveaux.${n}.fond }}`,
    `{{ niveaux.${n}.texte }}`,
    `{{ niveaux.${n}.etat }}`,
  );

const ACQUIS = ['#E3F0EB', '#0F5C48', 'Acquis'];
const A_FAIRE = ['#FBE3D4', '#B4581F', 'À faire'];

const BOUTON_REVOQUER =
  '<button style="height:44px;padding:0 18px;border-radius:14px;background:#F2F5F4;color:#16211D;border:none;font:inherit;font-size:13.5px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:8px;white-space:nowrap;flex-shrink:0;height:36px">Révoquer</button>';

/** K05 — une ligne de contact. Les trois planches ne diffèrent que par leurs textes. */
/**
 * UNE LIGNE DE CONTACT — demande, suggestion ou blocage.
 *
 * Les trois sections de K05 dessinent EXACTEMENT la même ligne : un rond de
 * 40 px, le nom suivi de la pastille de vérification, une seconde ligne grise, et
 * à droite un ou deux boutons. Une fabrique plutôt que trois copies : la première
 * retouche les ferait diverger.
 *
 * LES BOUTONS SONT UN ARGUMENT, ET LA LIGNE SE REFERME ICI. Une première version
 * s'arrêtait avant eux : le `<sc-for>` enveloppait une ligne OUVERTE, et le JSX
 * produit ne compilait plus — « Expected corresponding JSX closing tag for
 * 'div' ». Une boucle doit contenir des éléments entiers.
 */
const BOUTON_K05 = (fond, encre, texte) =>
  `<button style="height:44px;padding:0 18px;border-radius:14px;background:${fond};color:${encre};border:none;font:inherit;font-size:13.5px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:8px;white-space:nowrap;flex-shrink:0;height:36px">${texte}</button>`;

const LIGNE_CONTACT = (fond, initiales, nom, sous, boutons) =>
  `<div style="padding:12px 0;border-bottom:1px solid #F0F3F2"><div style="display:flex;align-items:center;gap:12px"><span style="width:40px;height:40px;border-radius:999px;background:${fond};color:#fff;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${initiales}</span><span style="flex:1;min-width:0"><span style="display:flex;align-items:center;gap:5px;font-size:14px;font-weight:700">${nom}<svg width="13" height="13" viewBox="0 0 24 24" fill="#16785E"><circle cx="12" cy="12" r="10"/><path d="m8 12 3 3 5-6" stroke="#fff" stroke-width="2.2" fill="none"/></svg></span><span style="display:block;font-size:12px;color:#8A958F">${sous}</span></span><span style="display:flex;gap:8px;align-items:center">${boutons}</span></div></div>`;

/**
 * ── LA MATRICE DE NOTIFICATIONS ÉTAIT SIX RANGS DESSINÉS ───────────────────
 *
 * Le porteur : « Les configurations des notifications ? »
 *
 * La planche dessine SIX catégories en dur — « Sécurité et compte », « Mon
 * parcours », « Entraide »… — avec leurs dix-huit interrupteurs. C'est un
 * exemple, pas une liste : `GET /me/notification-preferences` rend les catégories
 * que le serveur décide, avec leur libellé français composé par lui
 * (`CATEGORY_LABELS_FR`), et aucun de ces interrupteurs ne répondait.
 *
 * L'INTERRUPTEUR GARDE SES TROIS ÉTATS DESSINÉS : allumé (`#16785E`, bouton à
 * droite), éteint (`#CBD5D1`, bouton à gauche), et verrouillé (allumé à
 * `opacity: .5` — ce que la planche met sur « Non désactivable »). Les trois
 * valeurs voyagent en données plutôt que d'être recalculées dans le cadre.
 */
const INTERRUPTEUR_K07 = (fond, gauche, opacite) =>
  `<span style="width:40px;height:24px;border-radius:999px;background:${fond};position:relative;display:inline-block;opacity:${opacite}"><span style="position:absolute;top:3px;left:${gauche};width:18px;height:18px;border-radius:999px;background:#fff"></span></span>`;

const RANG_K07 = (titre, sous, appli, push, email) =>
  `<div style="display:grid;grid-template-columns:1fr 80px 80px 80px;align-items:center;padding:12px 0;border-bottom:1px solid #F0F3F2"><div><div style="font-size:13.5px;font-weight:700">${titre}</div><div style="font-size:11.5px;color:#8A958F">${sous}</div></div><div style="text-align:center">${appli}</div><div style="text-align:center">${push}</div><div style="text-align:center">${email}</div></div>`;

const CARTE_CONTACT = (fond, initiales, nom, sousTitre, origine) =>
  '<div style="padding:12px 0;border-bottom:1px solid #F0F3F2"><div style="display:flex;align-items:center;gap:12px">' +
  '<span style="width:40px;height:40px;border-radius:999px;background:' +
  fond +
  ';color:#fff;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
  initiales +
  '</span><span style="flex:1;min-width:0"><span style="display:flex;align-items:center;gap:5px;font-size:14px;font-weight:700">' +
  nom +
  '<svg width="13" height="13" viewBox="0 0 24 24" fill="#16785E"><circle cx="12" cy="12" r="10"/>' +
  '<path d="m8 12 3 3 5-6" stroke="#fff" stroke-width="2.2" fill="none"/></svg></span>' +
  '<span style="display:block;font-size:12px;color:#8A958F">' +
  sousTitre +
  '</span></span><span style="display:flex;gap:8px;align-items:center">' +
  '<span style="background:#F2F5F4;color:#5D6B66;font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px;white-space:nowrap">' +
  origine +
  '</span><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#16211D" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M4 5h16v11H9l-5 4z"/></svg></span></div></div>';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ K10 · LES ENREGISTRÉS — LE DESSIN DEVIENT UNE LISTE                       ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « Finalise les routes bookmarks et branche-les. »
 *
 * Les quatre routes de §2.9 existent maintenant (`apps/api/src/modules/bookmarks/
 * bookmarks.controller.ts`), et elles répondent — mesuré, pas supposé :
 *
 *     PUT    /me/bookmarks            → { id, state: "AVAILABLE" }   ×4
 *     GET    /me/bookmarks            → 4 items, meta.parType { GUIDE: 2, … }
 *     GET    /me/bookmarks/states     → { items: [{ subjectId, state }] }
 *     DELETE /me/bookmarks/GUIDE/:id  → 204, puis meta.total 4 → 3
 *
 * L'en-tête de ce fichier et celui de la page portaient tous deux le constat
 * inverse — « AUCUNE ROUTE N'EXISTE POUR CET ÉCRAN » — et il était juste au jour
 * où il a été écrit. Il ne l'est plus, et les six lignes de la planche cessent
 * d'attendre.
 *
 * ── L'ICÔNE EST UNE DONNÉE, PARCE QUE LA MAQUETTE EN DESSINE SIX ─────────────
 *
 * Les six lignes ne portent pas le même tracé : un livre pour le guide, une
 * étoile pour la story, un cœur pour l'entraide, un calendrier pour l'événement,
 * un toit pour l'annonce, une bulle pour la publication. Ce n'est pas de la
 * décoration — c'est le TYPE du contenu, et c'est la seule chose qui le dise une
 * fois la pastille d'état posée. Le tracé voyage donc dans la ligne
 * (`{{ l.icone }}`), et le dictionnaire type → tracé est transcrit de ces six
 * dessins, pas inventé.
 *
 * ── LA PASTILLE D'ÉTAT DISPARAÎT QUAND L'ÉTAT EST `AVAILABLE` ───────────────
 *
 * `BookmarkState` le dit dans sa propre documentation de schéma : « `AVAILABLE`
 * n'a PAS de libellé : c'est l'absence de pastille, le cas normal ». Les six
 * lignes dessinées portent toutes un état — la maquette ne dessine donc JAMAIS le
 * cas normal, qui sera pourtant le plus fréquent. `sc-if` sur le libellé, et la
 * ligne se referme sur « enregistré hier ». Le type reste lisible : c'est l'icône
 * qui le porte.
 *
 * ── LE VIDE EST DESSINÉ, et il est dessiné À CÔTÉ ───────────────────────────
 *
 * La planche de 320 px « ÉTATS · VIDE » n'est pas un cadre d'écran — c'est une
 * note de documentation — mais elle dessine le bloc vide AU MOT PRÈS : « Vous
 * n'avez rien enregistré » / « Touchez le signet sur un contenu pour le retrouver
 * ici. » Un compte neuf n'a aucun signet, donc c'est le PREMIER état que le
 * porteur verra. Il est emprunté à la note par `motifs` + `from`, ce qui garde le
 * contrôle : le jour où le designer réécrit la note, la génération s'arrête.
 */
const SIGNET_RETIRER =
  '<span title="Retirer"><svg width="18" height="18" viewBox="0 0 24 24" fill="#16785E" ' +
  'stroke="#16785E" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg></span>';

/** Une ligne d'enregistré, telle que la maquette la dessine six fois. */
const LIGNE_ENREGISTREE = (opacite, icone, titre, etatFond, etatTexte, etat, depuis) =>
  '<div style="display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:18px;' +
  `background:#fff;border:1px solid #E6EBE9;${opacite}">` +
  '<span style="width:44px;height:44px;border-radius:12px;background:#E3F0EB;display:flex;' +
  'align-items:center;justify-content:center;flex-shrink:0">' +
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0F5C48" ' +
  `stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${icone}"/></svg></span>` +
  '<div style="flex:1;min-width:0">' +
  '<div style="font-size:14px;font-weight:700;white-space:nowrap;overflow:hidden;' +
  `text-overflow:ellipsis">${titre}</div>` +
  '<div style="display:flex;gap:6px;align-items:center;margin-top:4px">' +
  `<span style="background:${etatFond};color:${etatTexte};font-size:11px;font-weight:700;` +
  `padding:4px 10px;border-radius:999px;white-space:nowrap">${etat}</span>` +
  `<span style="font-size:11.5px;color:#8A958F">${depuis}</span>` +
  '</div></div>' +
  SIGNET_RETIRER +
  '</div>';

/** La ligne bouclée : tout ce qui change vient de `l`. */
const LIGNE_BOUCLEE =
  '<sc-for list="{{ lignes }}" as="l">' +
  LIGNE_ENREGISTREE(
    'opacity:{{ l.opacite }}',
    '{{ l.icone }}',
    '{{ l.titre }}',
    '{{ l.etatFond }}',
    '{{ l.etatTexte }}',
    '{{ l.etat }}',
    '{{ l.depuis }}',
  )
    // La pastille ne s'affiche que si l'état porte un libellé — voir l'en-tête.
    .replace(
      '<span style="background:{{ l.etatFond }}',
      '<sc-if value="{{ l.etat }}"><span style="background:{{ l.etatFond }}',
    )
    .replace('{{ l.etat }}</span>', '{{ l.etat }}</span></sc-if>') +
  '</sc-for>';

/** Le bloc vide, emprunté à la planche de documentation « ÉTATS · VIDE ». */
const BLOC_VIDE =
  '<div style="text-align:center"><div style="font-size:14px;font-weight:700">' +
  'Vous n’avez rien enregistré</div><div style="font-size:12.5px;color:#5D6B66;' +
  'margin-top:4px">Touchez le signet sur un contenu pour le retrouver ici.</div></div>';

const VIDE_SI_RIEN = `<sc-if value="{{ vide }}">${BLOC_VIDE}</sc-if>`;

/** Une pastille d'onglet, telle que la maquette la dessine dix fois (quatre à 390 px). */
const ONGLET_ENREGISTRES = (fond, texte, bord, libelle) =>
  '<span style="padding:8px 13px;border-radius:999px;font-size:12.5px;font-weight:700;' +
  `white-space:nowrap;background:${fond};color:${texte};border:1px solid ${bord}">${libelle}</span>`;

const ONGLET_ACTIF = (libelle) => ONGLET_ENREGISTRES('#16785E', '#fff', '#16785E', libelle);
const ONGLET_INACTIF = (libelle) => ONGLET_ENREGISTRES('#fff', '#16211D', '#E6EBE9', libelle);

const ONGLETS_BOUCLES =
  '<sc-for list="{{ onglets }}" as="o">' +
  ONGLET_ENREGISTRES('{{ o.fond }}', '{{ o.texte }}', '{{ o.bord }}', '{{ o.libelle }}') +
  '</sc-for>';

/** Les dix onglets d'ordinateur, et les quatre que le téléphone dessine. */
const ONGLETS_ORDINATEUR =
  ONGLET_ACTIF('Tout') +
  ['Stories', 'Guides', 'Entraide', 'Événements', 'Annonces', 'Parrains', 'Membres', 'Réseaux', 'Villes']
    .map(ONGLET_INACTIF)
    .join('');

const ONGLETS_MOBILE =
  ONGLET_ACTIF('Tout') + ['Stories', 'Guides', 'Entraide'].map(ONGLET_INACTIF).join('');

/** Le fichier d'où le bloc vide est emprunté — la note posée à côté des deux cadres. */
const MAQUETTE_COMPTE = 'docs/template/08 Compte.dc.html';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ K02 · « GUIDES PUBLIÉS » DEVIENT « CE QUE CE MEMBRE A PUBLIÉ »            ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur, en deux temps : « la liste des guides aussi ? », puis « je propose
 * qu'il y ait des tabs (guides, fil d'actualités, stories, entraides, services,
 * évènements, parcours publics) qui montrent ce que l'utilisateur a publié ».
 *
 * MESURÉ : la carte dessine DEUX lignes écrites en dur — « Déclarer son médecin
 * traitant », « Monter son dossier CAF » — affichées sur le profil de tout le
 * monde, y compris d'un membre qui n'a jamais écrit un guide. Et pour cause :
 * aucune route ne savait filtrer par auteur. `GET /users/:handle/content` le
 * sait maintenant, pour les SEPT espèces.
 *
 * ── LE TITRE DE LA CARTE SUIT L'ONGLET ──────────────────────────────────────
 *
 * « GUIDES PUBLIÉS » devient `{{ contenuTitre }}` : sous l'onglet « Stories » la
 * carte doit dire « STORIES », sinon elle annonce des guides et montre autre
 * chose. C'est le même raisonnement que le compte des enregistrés.
 *
 * ── LA LIGNE EST UN LIEN, ET LE CHEVRON LE PROMETTAIT DÉJÀ ─────────────────
 *
 * La maquette dessine un chevron au bout de chaque ligne : elle promet
 * d'ouvrir. `href` est composée par le serveur, qui seul sait qu'un guide
 * s'ouvre par son `slug` et une publication par son identifiant.
 */
const LIGNE_CONTENU = (titre) =>
  '<div style="display:flex;justify-content:space-between;padding:12px 0;' +
  `border-bottom:1px solid #F0F3F2;font-size:13.5px;font-weight:600">${titre}` +
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8A958F" stroke-width="2" ' +
  'stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg></div>';

const CONTENUS_K02 = [
  {
    noeud: '>GUIDES PUBLIÉS<',
    devient: '>{{ contenuTitre }}<',
    frames: ['Desktop'],
    why: 'Le titre de la carte suit l’onglet choisi : « GUIDES PUBLIÉS » annonçait des guides quelle que soit l’espèce affichée.',
  },
  {
    noeud: LIGNE_CONTENU('Déclarer son médecin traitant') + LIGNE_CONTENU('Monter son dossier CAF'),
    devient:
      '<sc-for list="{{ contenus }}" as="ct">' + LIGNE_CONTENU('{{ ct.titre }}') + '</sc-for>',
    frames: ['Desktop'],
    why: 'Ce que ce membre a publié, de `GET /users/:handle/content` — les deux titres étaient ceux de la maquette, servis à tout le monde.',
  },
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
   *
   * BRANCHÉ SUR `GET /me` ET `GET /users/{pseudo}`, et les DEUX sont nécessaires.
   * `/me` rend `cityId` et `originCountryId` — des UUID — là où la planche écrit
   * « Lyon » et « Bénin ». Aucune route du domaine MEMBRE ne les résout : les deux
   * référentiels sont des routes d'ÉQUIPE. Le profil public de son propre pseudo
   * est donc le seul chemin honnête vers les noms. Écart remonté au porteur, pas
   * contourné en devinant.
   */
  screen({
    section: 'K01',
    out: 'k01',
    /**
     * ─── LA BARRE D'ONGLETS BASSE, SUR LES HUIT CADRES MOBILES DE CE MODULE ───
     *
     * Quatre `<div>` promus en quatre `<a>` — la seule navigation d'un téléphone, et
     * elle ne comptait dans aucun `href="#"`. Mesuré : HUIT des cadres mobiles de
     * cette maquette la dessinent (K01, K03, K04, K05, K07, K08, K09, K10) ; les
     * mobiles de K02 et de K06 n'en ont pas, et les planches de fenêtre non plus.
     *
     * ⚠ ET LA CINQUIÈME ENTRÉE, « COMPTE », DÉSIGNE CE MODULE-CI et reste pourtant
     * morte : il n'existe aucune route `/compte`, seulement les neuf sous-pages que
     * le panneau « MON COMPTE » de K04 adresse désormais une par une. Le trou est
     * donc ici plus visible qu'ailleurs, et il est REMONTÉ plutôt que comblé : voir
     * `tools/squelette-membre.mjs`.
     */
    liens: [...barreBasse(['Mobile']), ...panneauMonCompte(['Desktop'])],
    dataType: 'K01Data',
    frames: page('Mon profil', 'Compte'),
    donnees: [
      ...bandeau({ nom: 3, initiales: 4 }),
      {
        noeud: '>@amina.d<',
        devient: '>{{ moi.pseudo }}<',
        fois: 1,
        frames: ['Desktop'],
        why: 'Le champ « Pseudo » du formulaire, de `GET /me`.',
      },
      {
        noeud: '>Étudiante · Lyon · Bénin<',
        devient: '>{{ profil.statut }} · {{ profil.ville }} · {{ profil.pays }}<',
        frames: ['Desktop'],
        why: 'La ligne de l’aperçu public : statut, ville, pays d’origine.',
      },
      {
        noeud: '>Étudiante en gestion à Lyon 3, arrivée de Cotonou en septembre.<',
        devient: '>{{ profil.bio }}<',
        frames: ['Desktop'],
        why: 'La bio, de `GET /me` (`profile.bio`).',
      },
      {
        noeud: '>Je viens d’arriver<',
        devient: '>{{ profil.phase }}<',
        frames: ['Desktop'],
        why: 'La phase du membre (§2.2), de `GET /me`.',
      },
      {
        noeud: '>Lyon<',
        devient: '>{{ profil.ville }}<',
        why: 'La ville de résidence, résolue par `GET /users/{pseudo}`.',
      },
      {
        noeud: '>Bénin<',
        devient: '>{{ profil.pays }}<',
        frames: ['Desktop'],
        why: 'Le pays d’origine, résolu par `GET /users/{pseudo}` — verrouillé après un changement.',
      },
      {
        noeud: '>Comptabilité, Excel<',
        devient: '>{{ profil.competences }}<',
        frames: ['Desktop'],
        why: 'Les compétences du membre, nommées par `GET /users/{pseudo}`.',
      },
      {
        noeud: '>Français, Fon, Anglais<',
        devient: '>{{ profil.langues }}<',
        frames: ['Desktop'],
        why: 'Les langues du membre, nommées par `GET /users/{pseudo}`.',
      },
      {
        noeud: '>Démarches, relecture de CV<',
        devient: '>{{ profil.aides }}<',
        frames: ['Desktop'],
        why: 'Les types d’aide proposés (`profile.helpTypes`).',
      },
      {
        noeud: '>Amina Diallo<',
        devient: '>{{ moi.nom }}<',
        frames: ['Mobile'],
        why: 'Le nom affiché, sur le cadre mobile.',
      },
      {
        noeud: '>AD<',
        devient: '>{{ moi.initiales }}<',
        frames: ['Mobile'],
        why: 'Les initiales de l’avatar, sur le cadre mobile.',
      },
      {
        noeud: '>@amina.d<',
        devient: '>{{ moi.pseudo }}<',
        frames: ['Mobile'],
        why: 'Le pseudo, sur le cadre mobile.',
      },
    ],
  }),

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
   *
   * CE TITRE EST UNE DONNÉE, et c'est le cas qui a fait écrire
   * `retitrerSurDonnees` : lier « Fatou Ndiaye » faisait disparaître le texte que
   * la promotion cherche, la page perdait son `<h1>` et le journal accusait la
   * déclaration de titre. Le générateur reprend donc le titre sur sa forme liée,
   * et le dit.
   */
  screen({
    section: 'K02',
    out: 'k02',
    dataType: 'K02Data',
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
    /**
     * LE PANNEAU « MON COMPTE » EST DESSINÉ ICI AUSSI, et c'est le panneau DU
     * LECTEUR — pas du membre visité. Il mène donc aux mêmes dix routes que
     * partout ailleurs : K02 est l'écran d'un AUTRE membre, mais la colonne de
     * gauche reste la sienne.
     */
    liens: panneauMonCompte(['Desktop']),
    donnees: [
      ...bandeau(),
      {
        noeud: '>Fatou Ndiaye<',
        devient: '>{{ membre.nom }}<',
        frames: ['Desktop'],
        why: 'Le nom du membre visité, de `GET /users/{pseudo}` — et le titre de la page.',
      },
      {
        noeud: '>Niveau 2<',
        devient: '>Niveau {{ membre.niveau }}<',
        frames: ['Desktop'],
        why: 'Le niveau de vérification du membre visité, affiché et non employé pour autoriser.',
      },
      {
        noeud: '>@fatou.n · Installée · Lyon 7e · Sénégal · membre depuis 2024<',
        devient:
          '>{{ membre.pseudo }} · {{ membre.phase }} · {{ membre.ville }} · {{ membre.pays }} · membre depuis {{ membre.depuis }}<',
        frames: ['Desktop'],
        why: 'La ligne d’identité du profil visité, cinq champs de `GET /users/{pseudo}`.',
      },
      {
        noeud: ">Assistante RH, j'aide volontiers sur le CV, la CAF et les premiers mois.<",
        devient: '>{{ membre.bio }}<',
        frames: ['Desktop'],
        why: 'La bio du membre visité.',
      },
      {
        noeud: '>Disponible pour aider · Démarches, CV<',
        devient: '>Disponible pour aider · {{ membre.aides }}<',
        frames: ['Desktop'],
        why: 'Les types d’aide du membre visité (`helpTypes`).',
      },
      ...CONTENUS_K02,
      {
        noeud: '>18<',
        devient: '>{{ membre.entraides }}<',
        why: 'Le compteur d’entraides validées, de `stats.helpValidatedCount`.',
      },
      /**
       * ╔══════════════════════════════════════════════════════════════════════╗
       * ║ LES TROIS AUTRES CHIFFRES AVAIENT UNE SOURCE, ET PERSONNE NE LA LISAIT║
       * ╚══════════════════════════════════════════════════════════════════════╝
       *
       * Le porteur : « la page desktop marche ? » MESURÉ : sur les quatre cartes
       * de chiffres, UNE SEULE était liée. « 3 guides utiles », « 2 parrainages »
       * et « 9 événements » étaient les nombres de la maquette, servis pour tout
       * le monde — un membre inscrit du jour affichait neuf événements organisés.
       *
       * `publicProfileResponseSchema.stats` les porte TOUS LES QUATRE depuis le
       * début : `guideHelpfulVotes`, `mentorshipsCompleted`, `eventsOrganized`.
       * Il n'y avait rien à écrire côté serveur.
       *
       * LE DISCRIMINANT EST LE LIBELLÉ QUI SUIT, pas le nombre : « 3 » et « 2 »
       * figurent ailleurs dans ce cadre (niveau, compteurs du panneau), et un
       * `noeud` de `>3<` seul en attraperait un autre. On lie donc la PAIRE.
       */
      {
        noeud: '>3</div><div style="font-size:12px;color:#5D6B66;margin-top:2px">guides utiles<',
        devient:
          '>{{ membre.guides }}</div><div style="font-size:12px;color:#5D6B66;margin-top:2px">guides utiles<',
        frames: ['Desktop'],
        why: 'Le compteur de guides utiles, de `stats.guideHelpfulVotes` — il affichait 3 pour tout le monde.',
      },
      {
        noeud: '>2</div><div style="font-size:12px;color:#5D6B66;margin-top:2px">parrainages<',
        devient:
          '>{{ membre.parrainages }}</div><div style="font-size:12px;color:#5D6B66;margin-top:2px">parrainages<',
        frames: ['Desktop'],
        why: 'Le compteur de parrainages menés à terme, de `stats.mentorshipsCompleted` — il affichait 2 pour tout le monde.',
      },
      {
        noeud: '>9</div><div style="font-size:12px;color:#5D6B66;margin-top:2px">événements<',
        devient:
          '>{{ membre.evenements }}</div><div style="font-size:12px;color:#5D6B66;margin-top:2px">événements<',
        frames: ['Desktop'],
        why: 'Le compteur d’événements organisés, de `stats.eventsOrganized` — il affichait 9 pour tout le monde.',
      },
      /**
       * LE CADRE MOBILE DESSINE LA MÊME CARTE « guides », et elle était figée à 3
       * elle aussi. Le porteur : « veille toujours à ce que toutes les
       * corrections soient aussi faites sur mobile ».
       */
      {
        noeud: '>3</div><div style="font-size:12px;color:#5D6B66;margin-top:2px">guides<',
        devient:
          '>{{ membre.guides }}</div><div style="font-size:12px;color:#5D6B66;margin-top:2px">guides<',
        frames: ['Mobile'],
        why: 'Le compteur de guides du cadre mobile, de `stats.guideHelpfulVotes` — figé à 3.',
      },
      /**
       * LE CADRE MOBILE AUSSI, et pas par symétrie décorative : `ScreenFrames` rend
       * les DEUX cadres et n'en masque qu'un. Lier le nom sur l'ordinateur seulement
       * laisserait « Fatou Ndiaye » écrit en dur dans le document servi, donc dans
       * ce que lit un test, un moteur de recherche ou un lecteur d'écran sur
       * téléphone. La moitié de l'écran mentirait.
       */
      {
        noeud: '>FN<',
        devient: '>{{ membre.initiales }}<',
        frames: ['Mobile'],
        why: 'Les initiales de l’avatar du membre visité.',
      },
      {
        noeud: '>Fatou Ndiaye<',
        devient: '>{{ membre.nom }}<',
        frames: ['Mobile'],
        why: 'Le nom du membre visité — et le titre du cadre mobile.',
      },
      {
        noeud: '>Installée · Lyon 7e · Sénégal<',
        devient: '>{{ membre.phase }} · {{ membre.ville }} · {{ membre.pays }}<',
        frames: ['Mobile'],
        why: 'La ligne d’identité, raccourcie par la maquette sur mobile.',
      },
    ],
  }),
  /**
   * La feuille « Ajouter Fatou aux contacts » n'a qu'UNE planche, de 420 px : la
   * maquette ne la dessine pas en mobile. On ne lui en invente pas une — la même
   * fenêtre sert aux deux largeurs, ce que `Modal` prévoit dans son type.
   *
   * T5 K02 : « Ajouter aux contacts (avec motif) ». Le motif est le choix
   * Entraide · Parrainage · Rencontre · Réseau que la planche dessine.
   *
   * SON TITRE EST UNE DONNÉE, et c'est la SEULE de cette planche : « Ajouter
   * Fatou aux contacts » nomme le membre qu'on visite. Figé, il disait « Fatou »
   * sur le profil de Kofi — la fenêtre d'un écran déjà lié aurait menti pendant
   * que l'écran derrière elle disait vrai.
   *
   * C'est le second cas de `retitrerSurDonnees` (le premier est le `<h1>` de K02) :
   * la liaison fait disparaître le texte que la promotion cherche, et le générateur
   * reprend le titre sur sa forme LIÉE. Le `<h2 id="k02-titre">` reste donc en
   * place, et `aria-labelledby` continue de le désigner.
   *
   * LES QUATRE MOTIFS RESTENT DESSINÉS : la planche les montre tous les quatre
   * côte à côte, comme un choix à faire, pas comme un état du membre. Les piloter
   * demanderait de décider lequel est sélectionné, donc de redessiner la ligne.
   */
  screen({
    section: 'K02',
    out: 'k02contact',
    modal: true,
    dataType: 'K02Data',
    modalTitle: 'Ajouter Fatou aux contacts',
    frames: [f(420, 'Ajout')],
    donnees: [
      {
        noeud: '>Ajouter Fatou aux contacts<',
        devient: '>Ajouter {{ membre.prenom }} aux contacts<',
        why: 'Le prénom du membre visité, premier mot de son nom affiché (`GET /users/{pseudo}`) — et le titre de la fenêtre.',
      },
    ],
  }),

  /**
   * ── K03 · /compte/verification ─────────────────────────────────────────────
   *
   * 01 §3 — les trois niveaux, et les quatre états KYC que la planche liste
   * (en cours, en revue, refusée, mineur). L'en-tête mobile titre la section.
   *
   * CE QUI EST LIÉ ICI, ET CE QUI NE PEUT PAS L'ÊTRE. Les trois pastilles
   * « Acquis » / « À faire » sont la seule donnée de cette planche : elles disent
   * où en est LE MEMBRE, et elles se déduisent de `verificationLevel`. Leur
   * libellé ET leurs deux couleurs deviennent donc des données — lier le seul
   * libellé laisserait un « À faire » sur fond vert d'acquis, ce qui serait pire
   * que la maquette figée.
   *
   * Les quatre états KYC, eux, restent dessinés : la maquette les montre TOUS LES
   * QUATRE côte à côte, dans une colonne intitulée « ÉTATS KYC ». C'est une
   * planche de documentation des états, pas l'état du membre — les piloter
   * demanderait de choisir lequel afficher, donc de redessiner la colonne.
   * Signalé au porteur.
   */
  screen({
    section: 'K03',
    out: 'k03',
    // La barre basse du cadre mobile — voir K01 pour le pourquoi et le refus de
    // « Compte ».
    liens: [...barreBasse(['Mobile']), ...panneauMonCompte(['Desktop'])],
    dataType: 'K03Data',
    frames: page('Vérification et niveaux', 'Compte'),
    donnees: [
      ...bandeau(),
      {
        noeud: PASTILLE_NIVEAU('Compte créé', ...ACQUIS),
        devient: PASTILLE_NIVEAU_LIEE('Compte créé', 'n0'),
        frames: ['Desktop'],
        why: 'La pastille du niveau N0 : acquise dès la création du compte.',
      },
      {
        noeud: PASTILLE_NIVEAU('Identité vérifiée', ...ACQUIS),
        devient: PASTILLE_NIVEAU_LIEE('Identité vérifiée', 'n1'),
        frames: ['Desktop'],
        why: 'La pastille du niveau N1, selon `verificationLevel` de `GET /me`.',
      },
      /**
       * LE N2 D'ORDINATEUR PORTE MAINTENANT SES DEUX COULEURS, et c'est un défaut
       * corrigé, pas un embellissement : seul le mot « À faire » était lié, donc
       * un membre AYANT acquis le N2 voyait « Acquis » écrit sur le fond orange du
       * reste-à-faire. Le commentaire de cet écran décrit exactement ce défaut
       * trois lignes plus haut — il manquait de s'appliquer à son dernier niveau.
       */
      {
        noeud: PASTILLE_NIVEAU('Présence en France vérifiée', ...A_FAIRE),
        devient: PASTILLE_NIVEAU_LIEE('Présence en France vérifiée', 'n2'),
        frames: ['Desktop'],
        why: 'La pastille du niveau N2 — présence en France vérifiée (01 §3).',
      },
      /**
       * LE CADRE MOBILE NE DESSINE QUE DEUX CARTES — N1 et N2, pas N0 : la planche
       * de 390 px laisse tomber « Compte créé », que l'ordinateur montre. On lie
       * donc ce qu'elle dessine, et le libellé du N2 n'y est pas le même
       * (« Présence en France », sans « vérifiée ») : deux ancres, pas une.
       */
      {
        noeud: PASTILLE_NIVEAU('Identité vérifiée', ...ACQUIS),
        devient: PASTILLE_NIVEAU_LIEE('Identité vérifiée', 'n1'),
        frames: ['Mobile'],
        why: 'La pastille du niveau N1, sur le cadre mobile.',
      },
      {
        noeud: PASTILLE_NIVEAU('Présence en France', ...A_FAIRE),
        devient: PASTILLE_NIVEAU_LIEE('Présence en France', 'n2'),
        frames: ['Mobile'],
        why: 'La pastille du niveau N2, sur le cadre mobile.',
      },
    ],
  }),

  /**
   * ── K04 · /compte/securite ─────────────────────────────────────────────────
   *
   * 01 §2.1, RÈGLE DURE : aucun numéro en clair. La maquette la tient par le
   * DESSIN — « +229 •• •• •• 42 », « +33 6 •• •• •• 18 » — et le transcodage la
   * conserve par construction, puisqu'il ne réécrit rien.
   *
   * ELLE NE SE TIENT PLUS PAR LE DESSIN DÈS QUE L'API ARRIVE, et c'est la
   * décision la plus importante de cet écran : `{{ t.masque }}` reçoit ce que
   * l'API envoie. Le rempart est donc ailleurs, et il est à DEUX étages :
   *
   *   · côté serveur, `meResponseSchema` ne décrit AUCUN champ de numéro en
   *     clair — `phones[].masked` est le seul, et un `e164` qui apparaîtrait
   *     serait dépouillé à la validation de réponse avant d'atteindre l'écran ;
   *   · côté écran, `e2e/compte.spec.ts` éprouve la règle SUR LES DONNÉES RÉELLES
   *     de l'API, et non plus seulement sur celles de la maquette.
   *
   * LES DEUX CADRES NE DISENT PAS LA MÊME CHOSE du numéro principal, et c'est la
   * maquette : le cadre mobile écrit « Dernier numéro, non retirable » à sa droite
   * — ce que T5 K04 demande — là où le cadre d'ordinateur lui laisse un bouton
   * « Retirer ». L'écart est transcodé tel quel et signalé au porteur.
   */
  screen({
    section: 'K04',
    out: 'k04',
    dataType: 'K04Data',
    /**
     * ╔══════════════════════════════════════════════════════════════════════════╗
     * ║ LA NAVIGATION DE K04 — UN REFUS, QUATRE PROMOTIONS INVISIBLES AU COMPTEUR║
     * ╚══════════════════════════════════════════════════════════════════════════╝
     *
     * L'UNIQUE `href="#"` DE CET ÉCRAN N'EST PAS UNE DESTINATION. La maquette écrit
     * « Révoquer toutes les autres » en `<a href="#">`, en tête du bloc « SESSIONS
     * ACTIVES ». C'est une ÉCRITURE DESTRUCTRICE — elle ferme toutes les sessions
     * sauf celle-ci — et il n'existe aucune page où elle mènerait.
     *
     * Il faudrait donc `action`, que `markLinks` refuse par conception sur une
     * balise `<a>` (« “action” n’a pas de sens dessus. Déclarer “vers” »), et
     * `BUTTON_ACTIONS` ne regarde que les `<button>`. Le lien reste donc mort, et
     * c'est le refus le moins coûteux des trois possibles : lui donner un `vers`
     * serait transformer une révocation de sessions en navigation.
     *
     * ⚠ ET LE BOUTON « RÉVOQUER » DES LIGNES INDIVIDUELLES EST DANS LE MÊME CAS —
     * il est déjà un `<button>` dessiné sans `onClick`, donc il ne compte dans
     * aucun `href="#"` non plus. Les deux sont REMONTÉS ENSEMBLE au porteur : cet
     * écran montre les sessions (`GET /auth/sessions` est lu, voir `donnees`) mais
     * n'en révoque aucune.
     *
     * CE QUE LE COMPTEUR NE VOYAIT PAS, ET QUI EST BRANCHÉ : les QUATRE onglets de
     * la barre basse du cadre mobile, dessinés en `<div>`. Le cinquième, « Compte »,
     * n'a pas de route — et il désigne précisément CE module, ce qui rend le trou
     * d'autant plus visible. Voir `tools/squelette-membre.mjs`.
     */
    liens: [...barreBasse(['Mobile']), ...panneauMonCompte(['Desktop'])],
    frames: page('Téléphones et sessions', 'Compte'),
    donnees: [
      ...bandeau(),
      {
        noeud:
          CARTE_TELEPHONE('+229 •• •• •• 42', 'Bénin · principal') +
          CARTE_TELEPHONE('+33 6 •• •• •• 18', 'France · destination'),
        devient:
          '<sc-for list="{{ telephones }}" as="t">' +
          CARTE_TELEPHONE('{{ t.masque }}', '{{ t.role }}') +
          '</sc-for>',
        frames: ['Desktop'],
        why: 'Les numéros du membre, MASQUÉS par le serveur (`phones[].masked`) — jamais en clair.',
      },
      {
        noeud:
          CARTE_SESSION('MacBook · Chrome · cet appareil', 'Lyon · maintenant', PASTILLE_ACTUELLE) +
          CARTE_SESSION('iPhone · application', 'Lyon · il y a 2 h', BOUTON_REVOQUER) +
          CARTE_SESSION(
            'Android · Chrome',
            'Cotonou (approx.) · il y a 3 semaines',
            BOUTON_REVOQUER,
          ),
        devient:
          '<sc-for list="{{ sessions }}" as="s">' +
          CARTE_SESSION(
            '{{ s.appareil }}',
            '{{ s.vu }}',
            '<sc-if value="{{ s.courante }}">' +
              PASTILLE_ACTUELLE +
              '</sc-if><sc-if value="{{ s.revocable }}">' +
              BOUTON_REVOQUER +
              '</sc-if>',
          ) +
          '</sc-for>',
        frames: ['Desktop'],
        why: 'Les sessions actives, de `GET /auth/sessions` : la pastille « Actuelle » et le bouton « Révoquer » sont les DEUX variantes que la maquette dessine, chacune sous sa condition.',
      },
      /**
       * ── LE CADRE MOBILE, et il ne dit pas la même chose ────────────────────
       *
       * Trois écarts, tous dessinés par la maquette et aucun inventé ici :
       *
       *   · les masques sont PLUS COURTS (« +229 •• 42 » contre
       *     « +229 •• •• •• 42 ») : la place manque à 390 px. Ce sont donc deux
       *     ancres distinctes, pas la même écrite deux fois ;
       *   · la PREMIÈRE ligne porte « Dernier numéro, non retirable » au lieu du
       *     bouton — les deux variantes sont donc dessinées sous `<sc-if>`, comme
       *     la pastille « Actuelle » des sessions. Une seule variante gardée
       *     mentirait sur l'autre ligne ;
       *   · le cadre mobile ne dessine que DEUX sessions, et la courante y est
       *     l'iPhone, non le MacBook. L'ordre vient du serveur dans les deux cas.
       */
      {
        noeud:
          CARTE_TELEPHONE('+229 •• 42', 'Bénin · principal', MENTION_DERNIER) +
          CARTE_TELEPHONE('+33 •• 18', 'France · destination'),
        devient:
          '<sc-for list="{{ telephones }}" as="t">' +
          CARTE_TELEPHONE(
            '{{ t.masque }}',
            '{{ t.role }}',
            '<sc-if value="{{ t.dernier }}">' +
              MENTION_DERNIER +
              '</sc-if><sc-if value="{{ t.retirable }}">' +
              BOUTON_RETIRER +
              '</sc-if>',
          ) +
          '</sc-for>',
        frames: ['Mobile'],
        why: 'Les numéros du membre sur le cadre mobile, MASQUÉS par le serveur — et « Dernier numéro, non retirable » est la variante que la maquette dessine pour le seul numéro restant (01 §2.1).',
      },
      {
        noeud:
          CARTE_SESSION('iPhone · cet appareil', 'Lyon · maintenant', PASTILLE_ACTUELLE) +
          CARTE_SESSION('MacBook', 'Lyon · 2 h', BOUTON_REVOQUER),
        devient:
          '<sc-for list="{{ sessions }}" as="s">' +
          CARTE_SESSION(
            '{{ s.appareil }}',
            '{{ s.vu }}',
            '<sc-if value="{{ s.courante }}">' +
              PASTILLE_ACTUELLE +
              '</sc-if><sc-if value="{{ s.revocable }}">' +
              BOUTON_REVOQUER +
              '</sc-if>',
          ) +
          '</sc-for>',
        frames: ['Mobile'],
        why: 'Les sessions actives sur le cadre mobile, de `GET /auth/sessions` — mêmes deux variantes, sous les mêmes conditions.',
      },
    ],
  }),

  /**
   * ── K05 · /compte/contacts ─────────────────────────────────────────────────
   *
   * LES QUATRE ONGLETS SONT DESSINÉS CÔTE À CÔTE, pas pilotés : la planche
   * d'ordinateur montre « Mes contacts · 12 » ET les demandes reçues, les
   * suggestions et les bloqués, chacun dans sa carte.
   *
   * LE SOUS-TITRE D'UN CONTACT EST UN ÉCART À REMONTER. La maquette écrit
   * « Installée · Lyon 3e » — la phase et la ville. `GET /me/connections` ne rend
   * ni l'une ni l'autre : son `MEMBER_SELECT` s'arrête à l'identifiant, au pseudo,
   * au nom et à l'avatar. On y met donc la date de mise en relation, qui est une
   * donnée RÉELLE de la même route, et on le signale — plutôt que de composer une
   * phase et une ville que personne n'a envoyées.
   */
  screen({
    section: 'K05',
    out: 'k05',
    // La barre basse du cadre mobile — voir K01 pour le pourquoi et le refus de
    // « Compte ».
    liens: [...barreBasse(['Mobile']), ...panneauMonCompte(['Desktop'])],
    dataType: 'K05Data',
    frames: page('Contacts', 'Contacts'),
    donnees: [
      ...bandeau(),
      {
        noeud: '>Mes contacts · 12<',
        devient: '>Mes contacts · {{ contacts.total }}<',
        frames: ['Desktop'],
        why: 'Mon nombre de contacts (`meta.count`) — jamais celui d’un autre (08 §3.2).',
      },
      {
        noeud: '>Demandes · 2<',
        devient: '>Demandes · {{ contacts.demandes }}<',
        why: 'Le nombre de demandes de contact reçues, de `GET /me/connection-requests`.',
      },
      {
        noeud:
          CARTE_CONTACT('#0F5C48', 'SM', 'Sandra M.', 'Installée · Lyon 3e', 'Entraide') +
          CARTE_CONTACT('#16785E', 'AI', 'Aïcha Diop', 'Installée · Lyon 7e', 'Parrainage') +
          CARTE_CONTACT('#E0733A', 'KB', 'Kofi Boateng', 'Arrivé · Lyon 3e', 'Rencontre'),
        devient:
          '<sc-for list="{{ contacts.liste }}" as="c">' +
          CARTE_CONTACT(
            '{{ c.fond }}',
            '{{ c.initiales }}',
            '{{ c.nom }}',
            '{{ c.depuis }}',
            '{{ c.origine }}',
          ) +
          '</sc-for>',
        frames: ['Desktop'],
        why: 'Mes contacts, de `GET /me/connections` — nom, initiales, couleur d’avatar et origine de la mise en relation.',
      },
      /**
       * ── LES TROIS SECTIONS ÉTAIENT DES LIGNES UNIQUES ────────────────────
       *
       * Le porteur : « La page des contacts est faite ? Les demandes,
       * suggestions et bloqués ? »
       *
       * La maquette dessine UNE ligne par section — « Yasmine Benali », « Théo
       * Adjovi », « Paul A. ». C'est un exemple, pas une liste : un membre avec
       * trois demandes n'en voyait qu'une, et toujours la même.
       *
       * Les trois deviennent des boucles sur ce que les routes rendent déjà :
       * `GET /me/connection-requests`, `GET /me/connection-suggestions`,
       * `GET /me/blocks`.
       */
      {
        noeud: LIGNE_CONTACT(
          '#B4581F',
          'YB',
          'Yasmine Benali',
          '« On s’est croisées à l’atelier CV »',
          BOUTON_K05('#16785E', '#fff', 'Accepter') + BOUTON_K05('#F2F5F4', '#5D6B66', 'Refuser'),
        ),
        devient:
          '<sc-for list="{{ demandesRecues }}" as="d">' +
          LIGNE_CONTACT(
            '{{ d.fond }}',
            '{{ d.initiales }}',
            '{{ d.nom }}',
            '{{ d.message }}',
            BOUTON_K05('#16785E', '#fff', 'Accepter') + BOUTON_K05('#F2F5F4', '#5D6B66', 'Refuser'),
          ) +
          '</sc-for>',
        frames: ['Desktop'],
        why: 'Les demandes de contact reçues, de `GET /me/connection-requests` (08 §3.1).',
      },
      {
        noeud: LIGNE_CONTACT(
          '#0F5C48',
          'TA',
          'Théo Adjovi',
          'Vous étiez à la même rencontre',
          BOUTON_K05('#F2F5F4', '#16211D', 'Ajouter'),
        ),
        devient:
          '<sc-for list="{{ suggestions }}" as="g">' +
          LIGNE_CONTACT(
            '{{ g.fond }}',
            '{{ g.initiales }}',
            '{{ g.nom }}',
            '{{ g.raison }}',
            BOUTON_K05('#F2F5F4', '#16211D', 'Ajouter'),
          ) +
          '</sc-for>',
        frames: ['Desktop'],
        why: 'Les suggestions de mise en relation, de `GET /me/connection-suggestions` (08 §3.3).',
      },
      {
        noeud: LIGNE_CONTACT(
          '#8A958F',
          'PA',
          'Paul A.',
          'Bloqué le 3 mars',
          BOUTON_K05('#F2F5F4', '#16211D', 'Débloquer'),
        ),
        devient:
          '<sc-for list="{{ bloques }}" as="b">' +
          LIGNE_CONTACT(
            '{{ b.fond }}',
            '{{ b.initiales }}',
            '{{ b.nom }}',
            '{{ b.date }}',
            BOUTON_K05('#F2F5F4', '#16211D', 'Débloquer'),
          ) +
          '</sc-for>',
        frames: ['Desktop'],
        why: 'Les membres bloqués, de `GET /me/blocks` (08 §4).',
      },
    ],
  }),

  /**
   * ── K06 · /compte/abonnement et /premium ───────────────────────────────────
   *
   * L'en-tête mobile titre « Premium » : la planche mobile ne montre QUE le
   * comparatif, pas le plan courant ni les factures. C'est ce que la maquette
   * dessine, et le titre le dit.
   *
   * 14 §4.1, RÈGLE DURE : aucune donnée de carte ne transite par le serveur. Les
   * routes lues ici — `/plans`, `/me/subscription`, `/me/payments` — n'en portent
   * aucune, et `myPaymentsResponseSchema` en fait une preuve exécutable : ni
   * numéro, ni empreinte, ni quatre derniers chiffres, ni date d'expiration. Une
   * API qui se mettrait à en joindre verrait sa réponse REFUSÉE à la frontière.
   *
   * LE PRIX ANNUEL N'EST PAS LIÉ, et c'est délibéré : la maquette écrit
   * « Annuel · −20 % » comme un ONGLET, sans montant. Lier un montant là
   * demanderait d'en dessiner un.
   */
  screen({
    section: 'K06',
    out: 'k06',
    dataType: 'K06Data',
    triggers: [{ marker: 'Passer à Premium</button>', modal: 'K06M', all: true }],
    frames: page('Abonnement et Premium', 'Premium'),
    /**
     * K06 N'AVAIT AUCUNE CLÉ `liens`, et c'est le seul écran du module dans ce cas :
     * les sept autres déclaraient déjà la barre basse du téléphone. Son panneau
     * « MON COMPTE » est pourtant dessiné comme partout ailleurs — vérifié sur le
     * cadre produit — et ses neuf entrées étaient donc mortes.
     */
    liens: panneauMonCompte(['Desktop']),
    donnees: [
      ...bandeau(),
      {
        noeud: '<div style="font-size:20px;font-weight:800">Gratuit</div>',
        devient: '<div style="font-size:20px;font-weight:800">{{ abonnement.plan }}</div>',
        frames: ['Desktop'],
        why: 'Le plan courant, de `GET /me/subscription` — le nom français vient de `GET /plans`.',
      },
      {
        noeud: '>Essai Premium : 5 jours restants<',
        devient: '>Essai Premium : {{ abonnement.essai }} jours restants<',
        frames: ['Desktop'],
        why: 'Les jours d’essai restants (14 §4.6), de `trial.endsAt`.',
      },
      {
        noeud: '>2 / 3<',
        devient: '>{{ abonnement.contactsPro }}<',
        frames: ['Desktop'],
        why: 'Le compteur de contacts pro du mois et son plafond (`usage.items`).',
      },
      {
        noeud: '>4 €/mois<',
        devient: '>{{ premium.prixMois }}<',
        why: 'Le prix mensuel de Premium en euros, de `GET /plans` — jamais figé dans le front.',
      },
      {
        noeud: '>Au Bénin : 2 600 F/mois · MTN ou Moov<',
        devient: '>Au Bénin : {{ premium.prixXof }} · MTN ou Moov<',
        frames: ['Desktop'],
        why: 'Le même prix en francs CFA, calculé par le serveur — les deux devises arrivent toujours ensemble.',
      },
      {
        noeud: '>Août 2026 · 4 €<',
        devient: '>{{ factures.derniere }}<',
        frames: ['Desktop'],
        why: 'La dernière facture, de `GET /me/payments` (14 §4.4).',
      },
      {
        noeud: '>Juillet 2026 · 4 €<',
        devient: '>{{ factures.precedente }}<',
        frames: ['Desktop'],
        why: 'La facture précédente, de `GET /me/payments`.',
      },
    ],
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
   *
   * ─── CE QUE CES TROIS VOLETS ONT À LIRE, ET CE QU'ILS N'ONT PAS ────────────
   *
   * UN SEUL des trois lit une donnée, et il faut le dire plutôt que d'en inventer
   * deux :
   *
   *   · « Numéro » porte LE MONTANT — « Payer 2 600 F ». C'est le prix de Premium
   *     en francs, celui que `GET /plans` calcule (`month.xof`), et c'est le
   *     montant sur lequel le membre S'ENGAGE. Le figer dans le front est la faute
   *     que l'en-tête d'`abonnement-ecran.tsx` décrit déjà : la table `plans` est
   *     modifiable depuis l'administration, et un prix figé afficherait 2 600 F le
   *     jour où le porteur passe à 3 000. C'est le seul littéral de la planche qui
   *     soit une donnée du serveur ;
   *   · « Attente » écrit « Composez *880# et confirmez. Temps restant : 4:12 ».
   *     Le code USSD est celui de l'OPÉRATEUR et aucune route du dépôt ne le rend
   *     (`grep` sur `*880`, `ussd`, `shortCode` : rien hors de cette maquette) ; le
   *     compte à rebours est une horloge, pas une donnée — 14 §4.2 fixe le délai à
   *     cinq minutes, et personne ne l'ENVOIE. Ce volet n'a rien à lire ;
   *   · « Succès » écrit « Premium activé » et « Merci ! Votre reçu est dans
   *     Factures. » — une confirmation, vraie pour tout le monde. Rien à lire.
   *
   * LE NUMÉRO DE LA PLANCHE RESTE CE QU'IL EST, et c'est une non-décision assumée :
   * « +229 97 12 34 42 » est l'EXEMPLE du champ de saisie. Le lier demanderait
   * d'afficher le numéro Mobile Money du membre en clair, ce que 01 §2.1 interdit
   * et qu'aucune route ne rend de toute façon (`phones[].masked` est le seul champ
   * de numéro du contrat). Écart signalé : le transcodeur ne fait pas de ce champ
   * un `<input>`, donc l'exemple reste du TEXTE dans le document servi.
   */
  screen({
    section: 'K06',
    out: 'k06momo',
    modal: true,
    dataType: 'K06Data',
    modalTitle: 'Payer avec Mobile Money',
    frames: [f(380, 'Numero', 0), f(380, 'Attente', 1), f(380, 'Succes', 2)],
    donnees: [
      {
        noeud: '>Payer 2 600 F<',
        devient: '>Payer {{ premium.montantXof }}<',
        frames: ['Numero'],
        why: 'Le montant du paiement Mobile Money, en francs, calculé par le serveur (`GET /plans`, `month.xof`) — jamais figé dans le front, sur l’écran où le membre s’engage.',
      },
    ],
  }),

  /**
   * ── K07 · /compte/notifications ────────────────────────────────────────────
   *
   * LES INTERRUPTEURS DE LA GRILLE RESTENT DESSINÉS, et c'est délibéré — comme
   * avant l'arrivée de l'API, et pour une raison qui n'a pas changé. La maquette
   * dessine, pour CHAQUE case de la grille, un `<span>` de 46 × 26 px dont la
   * pastille est positionnée en dur. Lier ces positions demanderait une ancre par
   * case, et les cases de deux catégories sont dessinées à l'identique : rien ne
   * distinguerait « Mon parcours · push » de « Messages · push ». Les lier au
   * hasard serait exactement le défaut que `fois` existe pour empêcher. Remonté au
   * porteur : il faudrait que la maquette distingue ses cases.
   *
   * CE QUI EST LIÉ, en revanche, l'est complètement : l'adresse email, la plage
   * des heures calmes et le jour du résumé viennent de
   * `GET /me/notification-preferences`.
   */
  screen({
    section: 'K07',
    out: 'k07',
    // La barre basse du cadre mobile — voir K01 pour le pourquoi et le refus de
    // « Compte ».
    liens: [...barreBasse(['Mobile']), ...panneauMonCompte(['Desktop'])],
    dataType: 'K07Data',
    frames: page('Notifications', 'Notifications'),
    donnees: [
      ...bandeau(),
      {
        noeud:
          '<div style="display:grid;grid-template-columns:1fr 80px 80px 80px;align-items:center;padding:12px 0;border-bottom:1px solid #F0F3F2"><div><div style="font-size:13.5px;font-weight:700">Sécurité et compte</div><div style="font-size:11.5px;color:#8A958F">Non désactivable</div></div><div style="text-align:center"><span style="width:40px;height:24px;border-radius:999px;background:#16785E;position:relative;display:inline-block;opacity:.5"><span style="position:absolute;top:3px;left:19px;width:18px;height:18px;border-radius:999px;background:#fff"></span></span></div><div style="text-align:center"><span style="width:40px;height:24px;border-radius:999px;background:#16785E;position:relative;display:inline-block;opacity:.5"><span style="position:absolute;top:3px;left:19px;width:18px;height:18px;border-radius:999px;background:#fff"></span></span></div><div style="text-align:center"><span style="width:40px;height:24px;border-radius:999px;background:#16785E;position:relative;display:inline-block;opacity:.5"><span style="position:absolute;top:3px;left:19px;width:18px;height:18px;border-radius:999px;background:#fff"></span></span></div></div><div style="display:grid;grid-template-columns:1fr 80px 80px 80px;align-items:center;padding:12px 0;border-bottom:1px solid #F0F3F2"><div><div style="font-size:13.5px;font-weight:700">Mon parcours</div><div style="font-size:11.5px;color:#8A958F">Échéances, étapes</div></div><div style="text-align:center"><span style="width:40px;height:24px;border-radius:999px;background:#16785E;position:relative;display:inline-block;"><span style="position:absolute;top:3px;left:19px;width:18px;height:18px;border-radius:999px;background:#fff"></span></span></div><div style="text-align:center"><span style="width:40px;height:24px;border-radius:999px;background:#16785E;position:relative;display:inline-block;"><span style="position:absolute;top:3px;left:19px;width:18px;height:18px;border-radius:999px;background:#fff"></span></span></div><div style="text-align:center"><span style="width:40px;height:24px;border-radius:999px;background:#CBD5D1;position:relative;display:inline-block;"><span style="position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:999px;background:#fff"></span></span></div></div><div style="display:grid;grid-template-columns:1fr 80px 80px 80px;align-items:center;padding:12px 0;border-bottom:1px solid #F0F3F2"><div><div style="font-size:13.5px;font-weight:700">Entraide</div><div style="font-size:11.5px;color:#8A958F">Réponses, demandes pour vous</div></div><div style="text-align:center"><span style="width:40px;height:24px;border-radius:999px;background:#16785E;position:relative;display:inline-block;"><span style="position:absolute;top:3px;left:19px;width:18px;height:18px;border-radius:999px;background:#fff"></span></span></div><div style="text-align:center"><span style="width:40px;height:24px;border-radius:999px;background:#16785E;position:relative;display:inline-block;"><span style="position:absolute;top:3px;left:19px;width:18px;height:18px;border-radius:999px;background:#fff"></span></span></div><div style="text-align:center"><span style="width:40px;height:24px;border-radius:999px;background:#CBD5D1;position:relative;display:inline-block;"><span style="position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:999px;background:#fff"></span></span></div></div><div style="display:grid;grid-template-columns:1fr 80px 80px 80px;align-items:center;padding:12px 0;border-bottom:1px solid #F0F3F2"><div><div style="font-size:13.5px;font-weight:700">Messages</div></div><div style="text-align:center"><span style="width:40px;height:24px;border-radius:999px;background:#16785E;position:relative;display:inline-block;"><span style="position:absolute;top:3px;left:19px;width:18px;height:18px;border-radius:999px;background:#fff"></span></span></div><div style="text-align:center"><span style="width:40px;height:24px;border-radius:999px;background:#16785E;position:relative;display:inline-block;"><span style="position:absolute;top:3px;left:19px;width:18px;height:18px;border-radius:999px;background:#fff"></span></span></div><div style="text-align:center"><span style="width:40px;height:24px;border-radius:999px;background:#CBD5D1;position:relative;display:inline-block;"><span style="position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:999px;background:#fff"></span></span></div></div><div style="display:grid;grid-template-columns:1fr 80px 80px 80px;align-items:center;padding:12px 0;border-bottom:1px solid #F0F3F2"><div><div style="font-size:13.5px;font-weight:700">Réseaux</div><div style="font-size:11.5px;color:#8A958F">Annonces, sujets</div></div><div style="text-align:center"><span style="width:40px;height:24px;border-radius:999px;background:#16785E;position:relative;display:inline-block;"><span style="position:absolute;top:3px;left:19px;width:18px;height:18px;border-radius:999px;background:#fff"></span></span></div><div style="text-align:center"><span style="width:40px;height:24px;border-radius:999px;background:#CBD5D1;position:relative;display:inline-block;"><span style="position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:999px;background:#fff"></span></span></div><div style="text-align:center"><span style="width:40px;height:24px;border-radius:999px;background:#CBD5D1;position:relative;display:inline-block;"><span style="position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:999px;background:#fff"></span></span></div></div><div style="display:grid;grid-template-columns:1fr 80px 80px 80px;align-items:center;padding:12px 0;border-bottom:1px solid #F0F3F2"><div><div style="font-size:13.5px;font-weight:700">Événements</div><div style="font-size:11.5px;color:#8A958F">Rappels, nouveautés</div></div><div style="text-align:center"><span style="width:40px;height:24px;border-radius:999px;background:#16785E;position:relative;display:inline-block;"><span style="position:absolute;top:3px;left:19px;width:18px;height:18px;border-radius:999px;background:#fff"></span></span></div><div style="text-align:center"><span style="width:40px;height:24px;border-radius:999px;background:#16785E;position:relative;display:inline-block;"><span style="position:absolute;top:3px;left:19px;width:18px;height:18px;border-radius:999px;background:#fff"></span></span></div><div style="text-align:center"><span style="width:40px;height:24px;border-radius:999px;background:#16785E;position:relative;display:inline-block;"><span style="position:absolute;top:3px;left:19px;width:18px;height:18px;border-radius:999px;background:#fff"></span></span></div></div></div>',
        devient:
          '<sc-for list="{{ categories }}" as="c">' +
          RANG_K07(
            '{{ c.titre }}',
            '{{ c.sous }}',
            INTERRUPTEUR_K07('{{ c.appliFond }}', '{{ c.appliGauche }}', '{{ c.appliOpacite }}'),
            INTERRUPTEUR_K07('{{ c.pushFond }}', '{{ c.pushGauche }}', '{{ c.pushOpacite }}'),
            INTERRUPTEUR_K07('{{ c.emailFond }}', '{{ c.emailGauche }}', '{{ c.emailOpacite }}'),
          ) +
          /**
           * UNE FERMETURE EST RENDUE EN PLUS. Le nœud capturé va jusqu'à
           * `</div></div></div>` : les deux premières ferment le dernier rang —
           * sa cellule « email » puis sa grille — et la TROISIÈME ferme la carte
           * qui les porte. La fabrique n'émet que le rang, donc il manquait
           * celle-là. Deux en rendait une de trop, et le compilateur a dit les
           * deux fois ce qu'il manquait ou ce qui dépassait.
           */
          '</sc-for></div>',
        frames: ['Desktop'],
        why: 'Les catégories de notification, de `GET /me/notification-preferences` — six rangs dessinés en dur devenaient la liste de tout le monde.',
      },
      {
        noeud: '<strong>Email</strong> · amina.d@mail.com ',
        devient: '<strong>Email</strong> · {{ prefs.email }} ',
        frames: ['Desktop'],
        why: 'L’adresse email du membre, de `GET /me/notification-preferences`.',
      },
      {
        noeud: '>Aucune notification push de 22 h à 7 h<',
        devient: '>Aucune notification push de {{ prefs.calmeDebut }} à {{ prefs.calmeFin }}<',
        frames: ['Desktop'],
        why: 'Les heures calmes du membre (12 §2), bornes réelles et non les valeurs par défaut.',
      },
      {
        noeud: '>Chaque lundi par email<',
        devient: '>{{ prefs.resume }}<',
        frames: ['Desktop'],
        why: 'L’état du résumé hebdomadaire (`weeklyDigest`).',
      },
      /**
       * LE CADRE MOBILE N'ÉCRIT QUE LES HEURES CALMES, et la maquette les écrit
       * autrement : « 22 h – 7 h », un tiret demi-cadratin, là où l'ordinateur
       * écrit la phrase « Aucune notification push de 22 h à 7 h ». Deux ancres,
       * les mêmes deux bornes.
       *
       * NI L'EMAIL NI LE RÉSUMÉ ne sont dessinés sur cette planche : elle s'arrête
       * à la grille d'interrupteurs et aux heures calmes. On ne lie donc que ce
       * qu'elle montre — et ses interrupteurs restent dessinés pour la raison
       * écrite plus haut, qui vaut aux deux largeurs.
       */
      {
        noeud: '>22 h – 7 h<',
        devient: '>{{ prefs.calmeDebut }} – {{ prefs.calmeFin }}<',
        frames: ['Mobile'],
        why: 'Les heures calmes du membre sur le cadre mobile (12 §2) — mêmes bornes réelles.',
      },
    ],
  }),

  /**
   * ── K08 · /compte/donnees ──────────────────────────────────────────────────
   *
   * Le bouton « Supprimer » n'existe QUE sur la planche d'ordinateur : le cadre
   * mobile dessine les trois blocs mais ne donne un bouton qu'au premier
   * (« Demander »). Le déclencheur est donc borné à `Desktop`, et c'est la
   * maquette qui le décide, pas un oubli de déclaration.
   *
   * CETTE PLANCHE NE DESSINE AUCUNE DONNÉE, et il faut le dire plutôt que d'en
   * inventer une. Ses trois blocs sont du TEXTE DE RÈGLE — « Préparé sous 48 h.
   * Lien valable 7 jours. », « Reconnectez-vous dans les 6 mois », « Définitif
   * après 7 jours. » — c'est-à-dire les bornes de 01 §2.7 et §2.8, vraies pour
   * tout le monde et en tout temps. `GET /me/export/latest` sait dire où en est
   * l'archive du membre ; la maquette n'a nulle part où l'écrire. Lui faire une
   * place serait redessiner la planche, donc : signalé au porteur, et cet écran ne
   * lit que le bandeau de compte.
   */
  screen({
    section: 'K08',
    out: 'k08',
    // La barre basse du cadre mobile — voir K01 pour le pourquoi et le refus de
    // « Compte ».
    liens: [...barreBasse(['Mobile']), ...panneauMonCompte(['Desktop'])],
    dataType: 'K08Data',
    triggers: [{ marker: 'Supprimer</button>', modal: 'K08S', frames: ['Desktop'] }],
    frames: page('Mes données', 'Mes données'),
    donnees: [...bandeau()],
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

  /**
   * ── K09 · /compte/sanctions ────────────────────────────────────────────────
   *
   * La contestation est une carte DANS LA PAGE sur ordinateur (« CONTESTER ·
   * UNE SEULE FOIS »), et la maquette n'en dessine pas sur mobile. Aucun
   * déclencheur, donc : on n'ouvre pas une fenêtre par-dessus une carte qui dit
   * déjà la même chose, et on n'en invente pas une là où il n'y en a pas.
   *
   * `active` et `appealable` NE SONT PAS RECALCULÉS ICI : le serveur les dérive
   * (13 §4.3, « contester une fois »), et comparer `endsAt` à l'horloge du
   * navigateur afficherait « suspendu » à un membre libre dès que sa machine est
   * décalée.
   */
  screen({
    section: 'K09',
    out: 'k09',
    // La barre basse du cadre mobile — voir K01 pour le pourquoi et le refus de
    // « Compte ».
    liens: [...barreBasse(['Mobile']), ...panneauMonCompte(['Desktop'])],
    dataType: 'K09Data',
    frames: page('Sanctions', 'Sanctions'),
    donnees: [
      ...bandeau(),
      {
        noeud: '>Publication masquée<',
        devient: '>{{ sanction.type }}<',
        why: 'Le type de la sanction, de `GET /me/sanctions`.',
      },
      {
        noeud: '>Règle : Coordonnées personnelles · 12 janvier 2026<',
        devient: '>Règle : {{ sanction.regle }} · {{ sanction.date }}<',
        frames: ['Desktop'],
        why: 'La règle enfreinte telle que le modérateur l’a écrite (13 §4.2), et la date.',
      },
      {
        noeud: '>Contestation en cours<',
        devient: '>{{ sanction.etat }}<',
        frames: ['Desktop'],
        why: 'L’état de la contestation, dérivé par le serveur (`appealable`).',
      },
    ],
  }),



  /**
   * ── K10 · /compte/enregistres ──────────────────────────────────────────────
   *
   * La planche de 320 px « ÉTATS · VIDE » n'est PAS un cadre d'écran : c'est une
   * note de documentation, caption comprise, posée à côté des deux cadres. La
   * transcoder produirait une page dont le titre serait le mot « ÉTATS ».
   *
   * AUCUNE ROUTE N'EXISTE POUR CET ÉCRAN, et c'est le seul des dix dans ce cas.
   * `apps/api/src/modules/bookmarks/` ne contient qu'un `bookmarks.service.ts` :
   * il n'y a NI contrôleur, NI route `GET /me/bookmarks`, et le mot n'apparaît
   * dans aucun `*.controller.ts` du dépôt. Les six lignes de la planche —
   * « Obtenir la garantie Visale sans CDI », « Story de Aïcha », leurs états
   * « Expiré, gardé pour vous », « Contenu retiré » — attendent donc une route
   * qui n'est pas écrite. Signalé au porteur ; cet écran ne lit que le bandeau de
   * compte, et on ne lui fabrique pas une source.
   */
  screen({
    section: 'K10',
    out: 'k10',
    // La barre basse du cadre mobile — voir K01 pour le pourquoi et le refus de
    // « Compte ».
    liens: [...barreBasse(['Mobile']), ...panneauMonCompte(['Desktop'])],
    dataType: 'K10Data',
    frames: page('Enregistrés', 'Enregistrés'),
    donnees: [
      ...bandeau(),
      {
        noeud: '>14 enregistrés<',
        devient: '>{{ compte }}<',
        frames: ['Desktop'],
        why: 'Le nombre d’enregistrés, de `meta.total` — la maquette en écrit quatorze, le membre en a ce qu’il en a.',
      },
      {
        noeud: ONGLETS_ORDINATEUR,
        devient: ONGLETS_BOUCLES,
        frames: ['Desktop'],
        why: 'Les dix onglets, bouclés sur `meta.parType` : le fond, la couleur et la bordure disent LEQUEL est choisi, et la maquette dessine les deux variantes.',
      },
      {
        noeud: LIGNE_ENREGISTREE(
          '',
          'M12 7v14M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z',
          'Obtenir la garantie Visale sans CDI',
          '#E3F0EB',
          '#0F5C48',
          'Mis à jour le 12 mars',
          'enregistré hier',
        ) +
          LIGNE_ENREGISTREE(
            '',
            'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
            'Story de Aïcha · Visale en 48 h',
            '#F2F5F4',
            '#5D6B66',
            'Expiré, gardé pour vous',
            'enregistré il y a 3 j',
          ) +
          LIGNE_ENREGISTREE(
            '',
            'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z',
            'Accompagner un RDV préfecture',
            '#F2F5F4',
            '#5D6B66',
            'Résolue',
            'enregistré il y a 1 sem.',
          ) +
          LIGNE_ENREGISTREE(
            '',
            'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
            'Repas partagé béninois',
            '#F2F5F4',
            '#5D6B66',
            'Passé',
            'enregistré il y a 2 sem.',
          ) +
          LIGNE_ENREGISTREE(
            '',
            'M4 11 12 4l8 7v9H4z',
            'Studio meublé Lyon 7e',
            '#F2F5F4',
            '#5D6B66',
            'Plus disponible',
            'enregistré il y a 3 sem.',
          ) +
          LIGNE_ENREGISTREE(
            'opacity:.55',
            'M4 5h16v11H9l-5 4z',
            'Publication retirée',
            '#F2F5F4',
            '#8A958F',
            'Contenu retiré',
            'enregistré il y a 1 mois',
          ),
        devient: LIGNE_BOUCLEE + VIDE_SI_RIEN,
        motifs: [{ from: MAQUETTE_COMPTE, pattern: BLOC_VIDE }],
        frames: ['Desktop'],
        why: 'Les six lignes dessinées deviennent `GET /me/bookmarks` — icône, titre, état et date viennent de la ligne, et le bloc vide de la planche « ÉTATS » prend la place quand il n’y a rien.',
      },
      {
        noeud: ONGLETS_MOBILE,
        devient: ONGLETS_BOUCLES,
        frames: ['Mobile'],
        why: 'Les onglets du cadre mobile — le téléphone n’en dessine que quatre faute de place, la boucle les porte tous et la rangée les enroule (`flex-wrap`).',
      },
      {
        noeud: LIGNE_ENREGISTREE(
          '',
          'M12 7v14M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z',
          'Garantie Visale sans CDI',
          '#E3F0EB',
          '#0F5C48',
          'Mis à jour',
          'enregistré hier',
        ) +
          LIGNE_ENREGISTREE(
            '',
            'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
            'Story · Visale 48 h',
            '#F2F5F4',
            '#5D6B66',
            'Expiré, gardé',
            'enregistré 3 j',
          ) +
          LIGNE_ENREGISTREE(
            '',
            'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
            'Repas partagé',
            '#F2F5F4',
            '#5D6B66',
            'Passé',
            'enregistré 2 sem.',
          ),
        devient: LIGNE_BOUCLEE + VIDE_SI_RIEN,
        /**
         * L'ATTÉNUATION EST EMPRUNTÉE À LA PLANCHE D'ORDINATEUR, qui la dessine
         * sur « Publication retirée ». Le cadre de 390 px ne dessine aucune ligne
         * retirée — ses trois exemples sont tous vivants — mais la même liste y
         * est servie, et le porteur veut chaque correction sur les deux planches :
         * une ligne dont le contenu a disparu doit s'y atténuer comme ailleurs.
         */
        motifs: [
          { from: MAQUETTE_COMPTE, pattern: BLOC_VIDE },
          { from: MAQUETTE_COMPTE, pattern: 'background:#fff;border:1px solid #E6EBE9;opacity:' },
        ],
        frames: ['Mobile'],
        why: 'Les trois lignes du cadre mobile, même source et même boucle — le porteur veut chaque correction sur les deux planches.',
      },
    ],
  }),
];
