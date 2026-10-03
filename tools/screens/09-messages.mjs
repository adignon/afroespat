/**
 * Les écrans de `docs/template/09 Messages et transverse.dc.html` — M01, X01 à X04.
 *
 * Un fichier par maquette : voir l'en-tête de `01-onboarding.mjs` pour la raison.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * CETTE MAQUETTE EST ENTIÈREMENT STATIQUE, comme 04, 05 et 07.
 *
 * Vérifié plutôt que supposé : le fichier contient **zéro** `{{ … }}`, **zéro**
 * `<sc-for>`, **zéro** `<h2>`, et son `renderVals()` rend `{}`. Il n'y a donc rien
 * à recopier dans un `data.ts` — le détail du constat, et pourquoi en inventer une
 * donnée serait pire que n'en avoir aucune, est dans
 * `apps/web/src/screens/entraide/data.ts`.
 *
 * Conséquence pratique : chaque ÉTAT est une PLANCHE, et le rôle de la page est de
 * CHOISIR la planche — pas d'alimenter un composant.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * CE QUE LA MAQUETTE DESSINE, PLANCHE PAR PLANCHE (ses propres intitulés) :
 *
 *   M01  cadre 1440         · MOBILE · LISTE · MOBILE · CONVERSATION
 *        + deux CARTES hors cadre : « MENU DE LA CONVERSATION » (300 px, livrée
 *          depuis, voir `VOILE_DE_M01`) et « DEMANDE EN ATTENTE » (340 px, qui
 *          n'est toujours pas livrée — voir plus bas).
 *   X01  cadre 1440 (suggestions dépliées) · MOBILE · + une carte « ÉTATS / VIDE ».
 *   X02  PANNEAU DÉROULANT (1440) · PAGE COMPLÈTE (1440) · MOBILE.
 *   X03  ORDINATEUR (carte nue 480 px) · CONFIRMATION (carte nue 360 px) · MOBILE.
 *   X04  NIVEAU (480 px) · PLAN (480 px) · MOBILE — qui porte les DEUX encarts.
 */

import { MODAL_WINDOW_SOURCE } from '../dc-to-jsx.mjs';

import { cadresDuRail, railLitteral } from '../squelette-membre.mjs';

const FILE = 'docs/template/09 Messages et transverse.dc.html';

/**
 * ────────────────────────────────────────────────────────────────────────────
 * TROIS PLANCHES MANQUENT À CETTE MAQUETTE, et on ne les dessine pas.
 *
 * La règle du porteur ne souffre aucune exception : on TRANSCODE, on n'invente ni
 * dessin, ni couleur, ni texte. Mais trois états manquaient vraiment, et deux
 * d'entre eux laissaient une fenêtre qu'aucun contrôle ne referme — ce qui n'est
 * pas un manque de dessin, c'est un écran cassé.
 *
 * La sortie est celle que `MODAL_WINDOW_SOURCE` a ouverte pour le voile :
 * EMPRUNTER, mot pour mot, à une planche qui dessine déjà l'objet, et le DIRE.
 * `applyBorrows` (`tools/generate-screens.mjs`) vérifie trois choses à chaque
 * exécution — que le motif est toujours dessiné dans sa maquette source, que
 * l'ancre est unique dans le cadre, et que le remplacement n'est fait QUE de
 * l'ancre et des motifs empruntés. Un emprunt qui dérive fait échouer la
 * génération, au lieu de devenir silencieusement vide.
 *
 *   1. LA CROIX DE LA CONFIRMATION X03 — empruntée, voir `CROIX_DE_X03`.
 *   2. LE VOILE DU MENU DE M01 — emprunté, voir `VOILE_DE_M01`.
 *   3. UN MEMBRE BLOQUÉ — NON RÉSOLU, et on n'invente pas. Le détail du constat,
 *      et ce qu'il faudrait que le porteur tranche, est sous M01 au point
 *      « MEMBRE BLOQUÉ ».
 * ────────────────────────────────────────────────────────────────────────────
 */

/**
 * ── EMPRUNT 1 · LA CROIX DE FERMETURE DE LA CONFIRMATION X03 ────────────────
 *
 * MAQUETTE SOURCE : `docs/template/09 Messages et transverse.dc.html`, section
 * X03 — la MÊME maquette et la MÊME section que la planche qui en manque. C'est
 * l'emprunt le plus court qui soit : la fenêtre « Signaler » et sa confirmation
 * sont dessinées côte à côte, dans le même bloc, même fond, même trait `#DDE3E0`,
 * même rayon de 28 px, même remplissage de 24 px. L'une porte une croix, l'autre
 * non — et rien dans la maquette ne dit que c'est délibéré.
 *
 * CE QUI EST EMPRUNTÉ, verbatim et rien de plus :
 *   · la RANGÉE D'EN-TÊTE — `display:flex;align-items:center` avec un `flex:1`
 *     autour du titre : c'est elle qui pousse la croix à droite ;
 *   · la CROIX — le rond de 40 px sur `#F2F5F4` et son tracé de 17 px.
 *
 * Ce que le générateur en fait ensuite n'est PAS un emprunt mais une adaptation
 * qui existait déjà : `markClosers` reconnaît ce rond de 40 px à sa géométrie et
 * le promeut en `<button type="button" aria-label="Fermer" data-modal-close>`.
 * Même chemin que pour la fenêtre « Signaler », au caractère près.
 *
 * POURQUOI PAS « ON LAISSE COMME C'EST » : la confirmation n'avait AUCUN élément
 * focalisable. `Modal` a dû recevoir une garde spéciale pour que la tabulation
 * n'en sorte pas (voir `apps/web/src/components/modal.tsx`), et un membre au
 * clavier n'avait aucun contrôle ANNONCÉ pour refermer — seulement une touche
 * qu'aucun lecteur d'écran ne nomme. La croix voisine règle cela sans qu'un pixel
 * soit inventé.
 */
const CROIX_DE_X03 = {
  from: FILE,
  patterns: [
    '<div style="display:flex;align-items:center"><div style="flex:1">',
    '</div><span style="width:40px;height:40px;border-radius:999px;background:#F2F5F4;display:flex;align-items:center;justify-content:center">' +
      '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#16211D" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M18 6 6 18M6 6l12 12"/></svg></span></div>',
  ],
  why:
    'la rangée d’en-tête et la croix de 40 px de la fenêtre « Signaler » (section X03, ' +
    'même maquette) ; la planche de confirmation n’en dessine aucune.',
};

/**
 * ── EMPRUNT 2 · LE VOILE DU MENU DE LA CONVERSATION (M01) ───────────────────
 *
 * MAQUETTE SOURCE : `docs/template/03 Accueil v2.dc.html` — écrit ici en toutes
 * lettres, parce que le journal de ce dépôt a déjà menti une fois sur la
 * provenance d'un voile et qu'il a fallu le réparer.
 *
 * LE VOILE N'EST PAS POSÉ PAR CETTE DÉCLARATION : il l'est par `adaptModalFrame`,
 * qui le fait déjà pour toute CARTE NUE dont la section ne dessine aucun voile —
 * c'est le mécanisme `MODAL_WINDOW_SOURCE.veil`, dont le garde-fou lève si le
 * motif disparaît de `03 Accueil v2`. La carte « MENU DE LA CONVERSATION » est
 * exactement ce cas : 300 px, fond blanc, rayon 28, remplissage 24, ni voile ni
 * positionnement — la même forme que la fenêtre « Signaler » de X03.
 *
 * COMPTÉ, PAS SUPPOSÉ : la section M01 ne contient pas un seul
 * `position:absolute;inset:0;background:rgba(…)`. Zéro.
 *
 * CE TÉMOIN AJOUTE LE GARDE-FOU QUI MANQUAIT, et il dit ce que celui de
 * `MODAL_WINDOW_SOURCE` ne dit pas : la valeur empruntée — `rgba(22,33,29,.55)` —
 * est CELLE QUE CETTE MAQUETTE-CI ÉCRIT DÉJÀ, dans la planche mobile de X03, au
 * caractère près. L'emprunt ne fait donc pas entrer une teinte étrangère dans
 * `09 Messages` : il rend au menu le voile que sa propre maquette dessine trois
 * sections plus loin. Le jour où X03 changera de teinte, ce témoin lèvera et
 * forcera à rouvrir la question au lieu de laisser les deux diverger en silence.
 */
const VOILE_DE_M01 = {
  from: FILE,
  patterns: [MODAL_WINDOW_SOURCE.veil],
  why:
    `le voile de repli vient de ${MODAL_WINDOW_SOURCE.file} ; cette maquette écrit la MÊME ` +
    'valeur dans la planche mobile de X03, et c’est cela que le témoin vérifie.',
};

/**
 * ── EMPRUNT 3 · LA CONVERSATION AVEC UN MEMBRE BLOQUÉ ───────────────────────
 *
 * AUCUNE DES DIX MAQUETTES NE DESSINE CET ÉTAT. Cherché, pas supposé : `09` écrit
 * « Bloquer » (une entrée du menu, donc l'ACTION), `08 Compte` dessine un membre
 * bloqué dans une LISTE DE CONTACTS (K05, carte « BLOQUÉS »), et
 * `docs/specs/08-parrainage-messagerie.md` §3.2 et §5 décrivent le blocage en prose
 * sans jamais décrire l'écran. Aucune planche ne montre ce que devient le composeur.
 *
 * L'ÉTAT MANQUAIT ; LES FORMES, NON. C'est toute la différence, et c'est ce qui
 * rend cette planche livrable sans rien dessiner :
 *
 *   · le BANDEAU qui remplace le composeur est dessiné dans la section M01
 *     elle-même — la carte « DEMANDE EN ATTENTE » est déjà une conversation dont le
 *     composeur est remplacé par une phrase encadrée
 *     (`background:#F3F7F5;border-radius:14px;padding:12px;font-size:12.5px;color:#0F5C48;line-height:1.5`) ;
 *   · le BOUTON « Débloquer » est dessiné dans `08 Compte`, carte « BLOQUÉS » de
 *     K05 — c'est le seul bouton de déblocage que ce produit dessine.
 *
 * DEUX MAQUETTES POUR UN OBJET, ce qui mérite d'être justifié : le commentaire de
 * `MODAL_WINDOW_SOURCE` avertit qu'« en mélanger deux sources serait recomposer une
 * fenêtre qui n'existe nulle part ». L'avertissement vise le cas où l'on
 * RECONSTITUE UN MÊME OBJET à partir de deux dessins — un voile pris ici, son
 * centrage pris là. Ce n'est pas le cas ici : le bandeau et le bouton sont deux
 * objets DISTINCTS, chacun emprunté entier à la planche qui le dessine, et posés
 * l'un dans l'autre comme la carte « BLOQUÉS » pose déjà « Débloquer » à côté de
 * « Bloqué le 3 mars ». Le journal nomme les DEUX maquettes, pour qu'on puisse en
 * juger sans relire ce commentaire.
 *
 * ── CE QUI NE VIENT D'AUCUNE MAQUETTE : LA PHRASE ───────────────────────────
 *
 *     « Vous avez bloqué ce membre. Débloquez-le pour reprendre la conversation. »
 *
 * ELLE VIENT DU PORTEUR, pas d'une planche. Elle est déclarée dans `texte` et non
 * dans `patterns`, et c'est délibéré : la faire passer pour un motif obligerait à
 * l'écrire dans une maquette pour que le garde-fou la trouve — autrement dit à
 * maquiller en transcodage ce qui est une décision. `texte` dit la vérité à sa
 * place, et le générateur l'annonce avec un ⚠ à CHAQUE exécution.
 *
 * Ce lot avait d'abord livré cette planche comme NON RÉSOLUE, faute de cette
 * phrase. C'était le bon réflexe, et il reste le bon : la forme s'emprunte, le mot
 * se demande.
 *
 * ── CE QUI N'A PAS ÉTÉ FAIT, ET POURQUOI ────────────────────────────────────
 *
 * LA RANGÉE GRISE DE K05 N'EST PAS REPORTÉE DANS LA LISTE. La carte « BLOQUÉS »
 * marque un membre bloqué par une pastille `#8A958F` au lieu de `#0F5C48` ou
 * `#E0733A`. Mais ses rangées et celles de la liste de conversations de M01 ne sont
 * PAS le même objet — K05 aligne avatar, nom, sous-ligne et bouton d'action ; M01
 * aligne avatar, nom, aperçu du dernier message, heure et pastille de non-lus. N'en
 * prendre que la couleur reviendrait à REPEINDRE une rangée que la maquette dessine,
 * et c'est exactement ce que la règle 1 interdit : repeindre n'est pas emprunter.
 * Il faudrait pour cela que `09` dessine une rangée de conversation bloquée. Au
 * porteur de trancher s'il la veut ; l'état de la CONVERSATION, lui, se tient tout
 * seul, puisque c'est en l'ouvrant qu'on découvre qu'on ne peut plus écrire.
 */

/** Le bandeau que M01 dessine déjà pour « DEMANDE EN ATTENTE ». */
const BANDEAU_M01 =
  '<div style="background:#F3F7F5;border-radius:14px;padding:12px;font-size:12.5px;color:#0F5C48;line-height:1.5">';

/** Le bouton « Débloquer » de la carte « BLOQUÉS » de K05, mot pour mot. */
const BOUTON_DEBLOQUER =
  '<button style="height:44px;padding:0 18px;border-radius:14px;background:#F2F5F4;color:#16211D;border:none;' +
  'font:inherit;font-size:13.5px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:8px;' +
  'white-space:nowrap;flex-shrink:0;height:36px">Débloquer</button>';

/** La phrase du porteur. Déclarée comme NON empruntée — voir `texte`. */
const PHRASE_DU_PORTEUR =
  'Vous avez bloqué ce membre. Débloquez-le pour reprendre la conversation.';

const COMPTE = 'docs/template/08 Compte.dc.html';

/**
 * Le remplaçant du composeur, identique aux deux largeurs : le bandeau de M01, la
 * phrase du porteur, le bouton de K05, et la fermeture du bandeau.
 *
 * `</div>` figure dans `patterns` parce que le contrôle « rien d'inventé » ne laisse
 * rien passer, pas même une balise fermante. C'est celle du bandeau emprunté, elle
 * vient avec lui ; elle ne dessine rien et ne garde rien — le garde-fou qui compte
 * est celui de la balise OUVRANTE, qui porte toutes les valeurs.
 */
const BANDEAU_BLOQUE = `${BANDEAU_M01}${PHRASE_DU_PORTEUR}${BOUTON_DEBLOQUER}</div>`;

const CONVERSATION_BLOQUEE = {
  from: FILE,
  patterns: [BANDEAU_M01, '</div>', { from: COMPTE, pattern: BOUTON_DEBLOQUER }],
  texte: [PHRASE_DU_PORTEUR],
  into: BANDEAU_BLOQUE,
  why:
    'le bandeau de la carte « DEMANDE EN ATTENTE » (section M01) prend la place du ' +
    'composeur, et porte le bouton « Débloquer » de la carte « BLOQUÉS » (K05). ' +
    'Aucune maquette ne dessine cet état.',
};

/**
 * L'ANCRE EST LE COMPOSEUR, et c'est SON CONTENU qui est remplacé, pas sa bande.
 *
 * La bande du bas — fond blanc, filet supérieur, remplissage — est du dessin de
 * M01 et reste : c'est elle qui tient le bandeau au bas de la conversation, avec
 * sa marge de zone sûre sur le téléphone (`padding:12px 16px 28px`). Ce qui
 * disparaît, ce sont les trois CONTRÔLES : le trombone, la zone de saisie et le
 * rond d'envoi. Un membre bloqué ne doit pouvoir ni écrire ni envoyer, et la seule
 * façon d'en être sûr est qu'ils ne soient pas là.
 *
 * Les deux largeurs ne dessinent pas le même composeur — 46 px et « Écrire un
 * message… » sur l'ordinateur, 44 px et « Message… » sur le téléphone — donc deux
 * ancres, chacune bornée à son cadre. C'est la maquette qui le décide.
 */
const COMPOSEUR_ORDINATEUR =
  '<span style="width:40px;height:40px;border-radius:999px;background:#EEF2F0;display:flex;align-items:center;' +
  'justify-content:center;flex-shrink:0;"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" ' +
  'stroke="#16211D" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M3 4h18v16H3zM8.5 11a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2zM21 16l-5-5-9 9"/></svg></span>' +
  '<div style="flex:1;height:46px;border-radius:999px;background:#F2F5F4;padding:0 18px;display:flex;' +
  'align-items:center;font-size:13.5px;color:#8A958F">Écrire un message…</div>' +
  '<span style="width:46px;height:46px;border-radius:999px;background:#16785E;display:flex;align-items:center;' +
  'justify-content:center"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" ' +
  'stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14m-6-6 6 6-6 6"/></svg></span>';

const COMPOSEUR_TELEPHONE =
  '<span style="width:40px;height:40px;border-radius:999px;background:#EEF2F0;display:flex;align-items:center;' +
  'justify-content:center;flex-shrink:0;"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" ' +
  'stroke="#16211D" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M3 4h18v16H3zM8.5 11a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2zM21 16l-5-5-9 9"/></svg></span>' +
  '<div style="flex:1;height:44px;border-radius:999px;background:#F2F5F4;padding:0 16px;display:flex;' +
  'align-items:center;font-size:13.5px;color:#8A958F">Message…</div>' +
  '<span style="width:44px;height:44px;border-radius:999px;background:#16785E;display:flex;align-items:center;' +
  'justify-content:center"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" ' +
  'stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14m-6-6 6 6-6 6"/></svg></span>';

/**
 * UN `dataType` PAR ÉCRAN, ET SON MODULE À CÔTÉ DE SES CADRES.
 *
 * Les quinze cadres de cette maquette partageaient un seul `MessagesData`, qui
 * était `Record<string, never>` : un type commun n'avait aucun coût tant qu'il
 * ne portait RIEN. Il en aurait un dès la première donnée — un champ ajouté pour
 * la recherche apparaîtrait dans la signature des cadres de la messagerie, et un
 * cadre qui ne lit pas ce champ ne dirait plus lequel il lit.
 *
 * Chaque écran a donc son type, dans un `data.ts` posé À CÔTÉ de ses cadres
 * (`screens/x02/data.ts` pour les trois cadres de X02). Les écrans qui ne lisent
 * rien — le menu, les deux feuilles de signalement, les encarts de refus —
 * gardent `MessagesData` de `../messages/data`, et c'est ce partage qui dit qu'ils
 * ne lisent rien : voir la raison sous chacun.
 */
const screen = ({
  section,
  out,
  frames,
  dataType = 'MessagesData',
  dataModule = '../messages/data',
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

/** Un cadre : largeur, nom, rang parmi les planches de même largeur, titre de page. */
const f = (width, name, occurrence = 0, title = undefined) => ({ width, name, occurrence, title });

// ─── Les cartes que la maquette répète, écrites UNE fois ─────────────────────
//
// Même procédé que `08 Compte` : chaque fabrique reproduit une carte de la
// maquette à l'identique, ses textes en paramètres, et sert DEUX FOIS — à écrire
// le `noeud` (les cartes telles que la maquette les dessine, avec leurs textes
// d'exemple) et le `devient` (la même carte, une fois, avec des interpolations).
// `applyData` compare les deux à chaque exécution : si la maquette change d'un
// octet, la génération s'arrête en nommant le fragment.

/**
 * ── X02 · UNE LIGNE DE NOTIFICATION ────────────────────────────────────────
 *
 * Les cinq lignes des trois planches sont RIGOUREUSEMENT régulières — compté sur
 * les octets, pas supposé : même rangée, même pastille de 38 px, même corps de
 * 13,5 px, même heure de 11,5 px. Elles ne diffèrent que par ce que cette fabrique
 * prend en paramètres, et chacun de ces paramètres est une VARIANTE QUE LA
 * MAQUETTE DESSINE :
 *
 *   · `fond` et `fondIcone` — `#E3F0EB` sur `#fff` pour une ligne non lue,
 *     `#F6F8F7` sur `#F2F5F4` pour une ligne lue. Les deux paires sont dessinées,
 *     et lier le seul point de non-lu laisserait un fond vert sur une ligne lue ;
 *   · `icone` — le `<path>` de la catégorie, cinq fois dessiné (voir plus bas) ;
 *   · `texte` — la maquette l'écrit en DEUX morceaux, `<strong>` puis le reste, et
 *     c'est exactement le découpage `title` / `body` de `GET /notifications` ;
 *   · `quand` — l'heure relative ;
 *   · `point` — le rond vert de 8 px, dessiné sur les deux premières lignes
 *     seulement. C'est la marque du non-lu.
 */
const LIGNE_X02 = (fond, fondIcone, icone, texte, quand, point) =>
  '<div style="display:flex;gap:12px;align-items:center;padding:12px 14px;border-radius:14px;background:' +
  fond +
  '"><span style="width:38px;height:38px;border-radius:12px;background:' +
  fondIcone +
  ';display:flex;align-items:center;justify-content:center;flex-shrink:0">' +
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0F5C48" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
  icone +
  '</svg></span><div style="flex:1;min-width:0;font-size:13.5px;line-height:1.4">' +
  texte +
  '</div><span style="font-size:11.5px;color:#8A958F;white-space:nowrap">' +
  quand +
  '</span>' +
  point +
  '</div>';

/** Le rond vert de 8 px : la marque du non-lu, dessinée sur deux des cinq lignes. */
const POINT_NON_LU =
  '<span style="width:8px;height:8px;border-radius:999px;background:#16785E"></span>';

/** Un glyphe de catégorie, tel que la maquette l'écrit dans la pastille. */
const GLYPHE = (d) => `<path d="${d}"/>`;

/**
 * LES CINQ LIGNES DE LA MAQUETTE, dans son ordre, textes compris.
 *
 * Elles servent de `noeud` aux trois planches — la page complète, le panneau
 * déroulant et le cadre mobile les dessinent à l'identique, octet pour octet
 * (vérifié : la seule différence entre les trois planches est ce qui les entoure).
 */
const LIGNES_X02 =
  LIGNE_X02(
    '#E3F0EB',
    '#fff',
    GLYPHE('M7 11v9M7 11l4-7c1.5 0 2.5 1 2.5 2.5V10h5a2 2 0 0 1 2 2l-1.5 6a2 2 0 0 1-2 2H7'),
    '<strong>Sandra et 4 autres</strong> ont trouvé votre conseil utile',
    '5 min',
    POINT_NON_LU,
  ) +
  LIGNE_X02(
    '#E3F0EB',
    '#fff',
    GLYPHE('M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z'),
    '<strong>3 nouvelles réponses</strong> à votre demande « Un lit et une table »',
    '1 h',
    POINT_NON_LU,
  ) +
  LIGNE_X02(
    '#F6F8F7',
    '#F2F5F4',
    GLYPHE('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2'),
    'Échéance <strong>Logement</strong> dans 9 jours',
    '9 h',
    '',
  ) +
  LIGNE_X02(
    '#F6F8F7',
    '#F2F5F4',
    GLYPHE('M4 6h16v14H4zM4 10h16M8 3v4M16 3v4'),
    '<strong>Repas partagé</strong> demain à 12 h',
    'hier',
    '',
  ) +
  LIGNE_X02(
    '#F6F8F7',
    '#F2F5F4',
    GLYPHE('M9 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20a6 6 0 0 1 12 0M17 11a2.5 2.5 0 1 0 0-5M16 20h5a5 5 0 0 0-4-5'),
    '<strong>Aïcha</strong> a accepté d’être votre parraine',
    'lun.',
    '',
  );

/**
 * LA LIGNE LIÉE — une fois, pilotée par `GET /notifications`.
 *
 * ⚠ DEUX ÉCARTS SONT ASSUMÉS ICI, et il faut les lire avant de s'y fier.
 *
 * 1. L'EMPHASE SE DÉPLACE SUR UNE LIGNE SUR CINQ. La maquette écrit quatre lignes
 *    en `<strong>titre</strong> reste` et une — l'échéance — en
 *    `Échéance <strong>Logement</strong> dans 9 jours`, le gras AU MILIEU. L'API
 *    ne rend que `title` et `body` : le gabarit ne peut mettre le gras qu'au
 *    début. Une échéance s'affichera donc avec son titre entier en gras. C'est le
 *    dessin de la maquette qui n'est pas reproductible depuis ces deux champs,
 *    pas une donnée inventée — signalé au porteur.
 *
 * 2. LE GLYPHE EST UNE DONNÉE, SOUS CONDITION. La maquette dessine CINQ glyphes
 *    pour cinq catégories (réactions, entraide, échéance, événement, parrainage) ;
 *    `NOTIFICATION_CATEGORIES` en compte QUATORZE. Les neuf autres n'ont de glyphe
 *    dans AUCUNE planche. Deux issues, et une seule est honnête :
 *      · ne pas lier le glyphe : les quatorze catégories porteraient alors le
 *        pouce de la première ligne, donc treize lignes sur quatorze mentiraient ;
 *      · le lier et le laisser ABSENT là où la maquette n'en dessine aucun — le
 *        `<sc-if>` ci-dessous. La pastille reste, vide, et le manque se VOIT.
 *    La seconde est prise. Inventer neuf glyphes serait dessiner, ce que la
 *    règle 1 interdit ; en recycler un serait décider qu'une modération ressemble
 *    à un repas partagé. Les cinq valeurs liées sont RELEVÉES sur la maquette,
 *    aucune n'est retouchée (voir `screens/x02/data.ts`).
 */
const LIGNE_X02_LIEE =
  '<sc-for list="{{ lignes }}" as="n">' +
  LIGNE_X02(
    '{{ n.fond }}',
    '{{ n.fondIcone }}',
    '<sc-if value="{{ n.glyphe }}">' + GLYPHE('{{ n.glyphe }}') + '</sc-if>',
    '<strong>{{ n.titre }}</strong>{{ n.corps }}',
    '{{ n.quand }}',
    '<sc-if value="{{ n.nonLu }}">' + POINT_NON_LU + '</sc-if>',
  ) +
  '</sc-for>';

/** La donnée des trois planches de X02 : la même liste, au même endroit. */
const LISTE_X02 = (frame) => ({
  noeud: LIGNES_X02,
  devient: LIGNE_X02_LIEE,
  frames: [frame],
  why: 'Les notifications du membre, de `GET /notifications` — titre, corps, heure, catégorie et non-lu.',
});

/**
 * ── LA BARRE HAUTE, SUR LES QUATRE CADRES D'ORDINATEUR DE CETTE MAQUETTE ────
 *
 * M01, M01BLOQUE, X01 et X02 dessinent la même barre haute que `08 Compte` : la
 * pastille d'initiales et le prénom du membre connecté. Les compter a montré
 * qu'ils sont réguliers — une fois chacun, sur chacun des quatre cadres de 1440 px
 * (X02 en a deux, la page et le panneau, et tous deux les portent).
 *
 * POURQUOI LES LIER PLUTÔT QUE DE LES LAISSER : c'est l'argument que `08 Compte`
 * écrit sous K02, et il vaut ici. `ScreenFrames` rend les DEUX cadres et n'en
 * masque qu'un : « Amina » laissé en dur reste écrit dans le document SERVI, donc
 * dans ce que lit un test, un moteur de recherche ou un lecteur d'écran. La moitié
 * de l'écran mentirait sur l'identité de qui le regarde.
 *
 * Les cadres MOBILES n'en portent pas : la maquette y met un en-tête de page et
 * une barre d'onglets, sans identité. Compté sur les cinq cadres de 390 px.
 */
const BARRE_HAUTE = [
  {
    noeud: '>AD<',
    devient: '>{{ moi.initiales }}<',
    frames: ['Desktop'],
    why: 'Les initiales de l’avatar de la barre haute, dérivées du nom affiché de `GET /me`.',
  },
  {
    noeud: '>Amina<',
    devient: '>{{ moi.prenom }}<',
    frames: ['Desktop'],
    why: 'Le prénom de la barre haute, premier mot du nom affiché de `GET /me`.',
  },
];

/** La même barre, sur un cadre nommé autrement (M01BLOQUE, X02 panneau). */
const barreHauteDe = (frame) => BARRE_HAUTE.map((lien) => ({ ...lien, frames: [frame] }));

/**
 * ── M01 · UNE RANGÉE DE LA LISTE DE CONVERSATIONS ──────────────────────────
 *
 * Les CINQ rangées des deux planches de liste — quatre conversations et la demande
 * en attente — sont rigoureusement régulières, octets comptés. Chaque paramètre est
 * une VARIANTE QUE LA MAQUETTE DESSINE, et aucun n'est un choix fait ici :
 *
 *   · `fond` — `#E3F0EB` sur la rangée ouverte, `transparent` sur les autres ;
 *   · `fondAvatar` — `#E0733A`, `#0F5C48`, `#E0733A`, `#0F5C48` puis `#B4581F` :
 *     trois teintes cyclées par rang, comme K05 cycle les siennes ;
 *   · `encre` et `graisse` de l'aperçu — `#16211D` / `600` quand il reste des
 *     non-lus, `#8A958F` / `400` quand tout est lu. Les DEUX paires sont
 *     dessinées, et ne lier que la pastille laisserait un aperçu en gras sombre
 *     sur une conversation entièrement lue ;
 *   · `pastille` — le rond vert du compteur de non-lus, dessiné sur deux rangées
 *     sur cinq.
 */
const RANGEE_M01 = (fond, fondAvatar, initiales, nom, quand, encre, graisse, apercu, pastille) =>
  '<div style="display:flex;gap:12px;align-items:center;padding:12px;border-radius:16px;background:' +
  fond +
  '"><span style="width:44px;height:44px;border-radius:999px;background:' +
  fondAvatar +
  ';color:#fff;font-size:14px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
  initiales +
  '</span><div style="flex:1;min-width:0"><div style="display:flex;justify-content:space-between">' +
  '<span style="font-size:14px;font-weight:700">' +
  nom +
  '</span><span style="font-size:11.5px;color:#8A958F">' +
  quand +
  '</span></div><div style="display:flex;align-items:center;gap:8px">' +
  '<span style="flex:1;min-width:0;font-size:12.5px;color:' +
  encre +
  ';font-weight:' +
  graisse +
  ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' +
  apercu +
  '</span>' +
  pastille +
  '</div></div></div>';

/** Le compteur de non-lus d'une rangée : le rond vert de 20 px. */
const PASTILLE_M01 = (n) =>
  '<span style="background:#16785E;color:#fff;font-size:10.5px;font-weight:700;min-width:20px;' +
  'height:20px;border-radius:999px;display:flex;align-items:center;justify-content:center">' +
  n +
  '</span>';

/** Les deux jeux d'encre de l'aperçu, tels que la maquette les dessine. */
const APERCU_NON_LU = ['#16211D', '600'];
const APERCU_LU = ['#8A958F', '400'];

/**
 * Les conversations, dans l'ordre de la maquette.
 *
 * ⚠ LES DEUX CADRES N'EN DESSINENT PAS LE MÊME NOMBRE, et c'est le garde-fou de
 * `fois` qui l'a dit : déclarée avec quatre rangées sur les deux cadres, la
 * génération a refusé — « figure 0 fois dans ce cadre » sur M01 Mobile. Vérifié
 * ensuite sur les octets : la planche d'ordinateur dessine QUATRE conversations
 * (jusqu'à « Marc Koudou »), la planche mobile en dessine TROIS. La maquette
 * raccourcit, comme elle raccourcit déjà « Yasmine Benali » en « Yasmine B. ».
 *
 * `avecQuatrieme` dit donc lequel des deux cadres on décrit. Sans ce paramètre, la
 * liste mobile n'aurait pas été liée du tout — et c'est exactement le défaut que
 * `fois` existe pour empêcher : une donnée qui disparaît en silence.
 */
const CONVERSATIONS_M01 = (
  titrePremier,
  apercuPremier,
  nomDemande,
  apercuDemande,
  avecQuatrieme = true,
  fondPremier = '#E3F0EB',
) => ({
  liste:
    RANGEE_M01(
      fondPremier,
      '#E0733A',
      'PE',
      titrePremier,
      '10:42',
      ...APERCU_NON_LU,
      apercuPremier,
      PASTILLE_M01('4'),
    ) +
    RANGEE_M01(
      'transparent',
      '#0F5C48',
      'SM',
      'Sandra M.',
      'hier',
      ...APERCU_LU,
      'Merci pour la table !',
      '',
    ) +
    RANGEE_M01(
      'transparent',
      '#E0733A',
      'KB',
      'Kofi Boateng',
      'lun.',
      ...APERCU_NON_LU,
      'Samedi ça marche',
      PASTILLE_M01('1'),
    ) +
    (avecQuatrieme
      ? RANGEE_M01(
          'transparent',
          '#0F5C48',
          'MK',
          'Marc Koudou',
          '12 sept.',
          ...APERCU_LU,
          'Vous : parfait, merci',
          '',
        )
      : ''),
  /** La demande en attente (§5.2) : la maquette la range sous « DEMANDES · 2 ». */
  demande: RANGEE_M01(
    'transparent',
    '#B4581F',
    'YB',
    nomDemande,
    '2 h',
    ...APERCU_LU,
    apercuDemande,
    '',
  ),
});

/**
 * LA RANGÉE LIÉE — une fois, pilotée par `GET /conversations`.
 *
 * ⚠ L'APERÇU EST LA DONNÉE LA PLUS SENSIBLE DE CE MODULE, et il faut savoir ce
 * qu'il est. `lastMessagePreview` est le corps du dernier message DÉSCELLÉ par le
 * serveur et coupé à `CONVERSATION_PREVIEW_MAX` : le chiffrement de 00 §8.1 est AU
 * REPOS, pas de bout en bout, et aucune route de ce dépôt ne rend de cryptogramme
 * — vérifié sur le service, pas supposé. L'écran n'a donc rien à déchiffrer, et
 * c'est `conversationSchema` (dans `packages/shared`) qui tient la frontière :
 * `.strict()`, pour qu'un `bodyEncrypted` greffé soit REFUSÉ au lieu d'être
 * dépouillé en silence.
 *
 * LA MAQUETTE PRÉFIXE L'APERÇU PAR L'AUTEUR — « Aïcha : Tu veux que je relise ? »,
 * « Vous : parfait, merci » — et l'API ne le fait PAS : `lastMessagePreview` est le
 * corps nu. Le préfixe est donc composé côté front, à partir de l'auteur que
 * `members[]` nomme ; c'est de la mise en forme, pas de la donnée inventée, et
 * c'est dit dans `screens/m01/data.ts`.
 */
const RANGEE_M01_LIEE = (liste, as, pastille) =>
  `<sc-for list="{{ ${liste} }}" as="${as}">` +
  RANGEE_M01(
    `{{ ${as}.fond }}`,
    `{{ ${as}.fondAvatar }}`,
    `{{ ${as}.initiales }}`,
    `{{ ${as}.nom }}`,
    `{{ ${as}.quand }}`,
    `{{ ${as}.encre }}`,
    `{{ ${as}.graisse }}`,
    `{{ ${as}.apercu }}`,
    pastille ? `<sc-if value="{{ ${as}.nonLus }}">${PASTILLE_M01(`{{ ${as}.nonLus }}`)}</sc-if>` : '',
  ) +
  '</sc-for>';

/**
 * LA RANGÉE D'UNE DEMANDE N'A PAS DE PASTILLE, ET C'EST LE CONTRÔLE QUI L'A DIT.
 *
 * Déclarée d'abord avec la même rangée liée que les conversations, la génération a
 * REFUSÉ : « la donnée ajoute du dessin que la maquette n'écrit pas là », en
 * nommant le rond de non-lus. C'est exact — la maquette ne dessine aucune pastille
 * sur la rangée « DEMANDES », sur aucun des deux cadres de liste.
 *
 * Et c'est juste au-delà du dessin : §5.2 fait du premier message LA demande
 * elle-même. Une demande en attente a donc toujours exactement un message non lu,
 * et une pastille y afficherait « 1 » pour toutes, tout le temps — un compteur qui
 * ne compte rien. Le garde-fou a attrapé un dessin de trop et, ce faisant, une
 * donnée qui n'aurait rien dit.
 */
const RANGEE_DEMANDE_LIEE = RANGEE_M01_LIEE('demandes.liste', 'd', false);

/**
 * ── M01 · UNE BULLE DU FIL ──────────────────────────────────────────────────
 *
 * La maquette dessine DEUX bulles, et c'est pour cela que tout ce qui les distingue
 * devient une donnée plutôt qu'une branche de JSX : la mienne (à droite, verte,
 * sans auteur) et la sienne (à gauche, blanche, cernée, précédée de l'auteur en
 * gras). Lier le seul corps donnerait des messages reçus affichés en vert à
 * droite, c'est-à-dire un fil où l'on ne sait plus qui parle.
 *
 * Les cinq valeurs liées sont RELEVÉES sur les deux bulles, aucune n'est retouchée.
 */
const BULLE_M01 = (cote, rayon, fond, encre, trait, auteur, corps, mention) =>
  '<div style="display:flex;flex-direction:column;align-items:' +
  cote +
  ';gap:4px"><div style="max-width:70%;padding:11px 14px;border-radius:' +
  rayon +
  ';background:' +
  fond +
  ';color:' +
  encre +
  ';border:' +
  trait +
  ';font-size:14px;line-height:1.5">' +
  auteur +
  corps +
  '</div>' +
  mention +
  '</div>';

/** Les valeurs des deux bulles, relevées sur la maquette. */
const BULLE_MIENNE = ['flex-end', '18px 18px 6px 18px', '#16785E', '#fff', 'none'];
const BULLE_SIENNE = ['flex-start', '18px 18px 18px 6px', '#fff', '#16211D', '1px solid #E6EBE9'];

/** L'auteur en gras, tel que la maquette le pose sur la bulle reçue. */
const AUTEUR_M01 = (nom) => `<strong>${nom}</strong><br>`;

/** L'heure sous la bulle — ou « Vu », que la maquette écrit aussi. */
const MENTION_M01 = (texte) => `<span style="font-size:11px;color:#8A958F">${texte}</span>`;

/**
 * LE FIL TEL QUE LA MAQUETTE LE DESSINE, et il porte DEUX objets de plus.
 *
 * `image` n'est dessiné que sur la planche d'ordinateur : le cadre mobile n'en a
 * pas. D'où le paramètre, plutôt que deux copies de ce fil.
 */
const FIL_M01 = (premier, sienne, dernier, image) =>
  '<div style="align-self:center;background:#EEF2F0;color:#5D6B66;font-size:12px;font-weight:600;' +
  'padding:6px 12px;border-radius:999px">Aïcha a rejoint le parcours</div>' +
  BULLE_M01(...BULLE_MIENNE, '', premier, '') +
  BULLE_M01(...BULLE_SIENNE, AUTEUR_M01('Aïcha'), sienne, MENTION_M01('10:42')) +
  image +
  BULLE_M01(...BULLE_MIENNE, '', dernier, MENTION_M01('Vu'));

/** La vignette rayée de la planche d'ordinateur : un message IMAGE. */
const IMAGE_M01 =
  '<div style="max-width:220px;height:140px;border-radius:18px;' +
  'background:repeating-linear-gradient(135deg,#E3ECE8 0 12px,#DCE6E1 12px 24px);' +
  'align-self:flex-end"></div>';

/**
 * LE FIL LIÉ — une bulle, pilotée par `GET /conversations/:id/messages`.
 *
 * ⚠ DEUX OBJETS DE LA MAQUETTE DISPARAISSENT, et c'est le contraire d'une perte :
 *
 * 1. LA LIGNE SYSTÈME « Aïcha a rejoint le parcours ». Elle ne peut PAS être liée,
 *    et pas faute de place : `MESSAGE_KINDS` déclare `SYSTEM`, mais l'en-tête de
 *    `packages/shared/src/validation/messaging.ts` dit que la colonne `kind`
 *    N'EXISTE PAS en base et que le kind est déduit — `IMAGE` si `media_asset_id`,
 *    `TEXT` sinon. AUCUNE route ne produit de `SYSTEM`. La laisser dessinée
 *    afficherait « Aïcha a rejoint le parcours » en tête de CHAQUE conversation,
 *    pour toujours et pour tout le monde : un mensonge permanent. La retirer dit
 *    la vérité — le produit ne sait pas encore poser de message système.
 *
 * 2. LA VIGNETTE D'IMAGE. L'API rend bien `kind: 'IMAGE'` et `mediaId`, mais AUCUNE
 *    route de ce lot ne résout un `mediaId` en URL affichable, et la vignette que
 *    la maquette dessine porte `align-self:flex-end` — elle est toujours DU CÔTÉ
 *    DE L'EXPÉDITEUR. La réemployer pour une image reçue la mettrait du mauvais
 *    côté du fil, c'est-à-dire dessinerait un état faux. Un message image garde
 *    donc sa bulle et son texte : `sendMessageSchema` exige un `body` de 1 à 4 000
 *    caractères MÊME avec un `mediaId`, donc aucune image n'arrive sans légende et
 *    aucun message ne disparaît du fil. L'image, elle, ne s'affiche pas.
 *
 * Les deux manques sont signalés au porteur. Ce qu'il faudrait : une planche avec
 * une image REÇUE, et une route qui résolve un média.
 */
const FIL_M01_LIE =
  '<sc-for list="{{ messages }}" as="m">' +
  BULLE_M01(
    '{{ m.cote }}',
    '{{ m.rayon }}',
    '{{ m.fond }}',
    '{{ m.encre }}',
    '{{ m.trait }}',
    `<sc-if value="{{ m.auteur }}">${AUTEUR_M01('{{ m.auteur }}')}</sc-if>`,
    '{{ m.corps }}',
    `<sc-if value="{{ m.mention }}">${MENTION_M01('{{ m.mention }}')}</sc-if>`,
  ) +
  '</sc-for>';

/** Le fil d'un cadre : son `noeud` dépend des textes et de la vignette. */
const LIEN_FIL = (frame, premier, sienne, dernier, image) => ({
  noeud: FIL_M01(premier, sienne, dernier, image),
  devient: FIL_M01_LIE,
  frames: [frame],
  why: 'Les messages de la conversation, de `GET /conversations/:id/messages` — corps DÉSCELLÉ par le serveur, auteur, heure et côté de la bulle.',
});

/**
 * ── X01 · UNE SUGGESTION ────────────────────────────────────────────────────
 *
 * Les trois suggestions sont régulières, et la maquette écrit chacune en DEUX
 * morceaux : la part déjà saisie en gras, puis la suite. C'est le surlignage de la
 * requête (11 §2.3, « suggestions dès 3 caractères »), et le découper ainsi est ce
 * que la maquette dessine — pas une invention.
 */
const SUGGESTION_X01 = (prefixe, suite) =>
  '<div style="height:42px;display:flex;align-items:center;gap:10px;padding:0 12px;' +
  'border-radius:12px;font-size:13.5px">' +
  '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8A958F" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zm9 2-4-4"/></svg>' +
  '<span><strong>' +
  prefixe +
  '</strong>' +
  suite +
  '</span></div>';

/** Titre visible d'un cadre : le texte tel que la maquette l'écrit, et son corps. */
const t = (text, size) => ({ text, size });

/**
 * ─── LES DONNÉES DE LA MESSAGERIE, DÉCLARÉES UNE FOIS POUR DEUX ÉCRANS ──────
 *
 * M01 et M01BLOQUE transcodent LES MÊMES PLANCHES : la conversation bloquée est
 * la conversation, composeur en moins et bandeau en plus (voir
 * `CONVERSATION_BLOQUEE`). Leurs cadres lisent donc exactement les mêmes données,
 * et seuls leurs NOMS diffèrent — « BloqueDesktop » plutôt que « Desktop », pour
 * que deux composants ne portent pas le même nom d'export.
 *
 * D'où cette fonction plutôt que deux copies : recopier dix liaisons laisserait
 * les deux écrans diverger au premier ajustement, et c'est le cadre bloqué —
 * celui qu'on regarde le moins — qui aurait silencieusement gardé l'ancienne
 * version.
 *
 * `liste` est FACULTATIF : il nomme le cadre mobile de la LISTE, que M01 possède
 * (« MOBILE · LISTE ») et que M01BLOQUE ne reprend pas — rien n'y change, puisque
 * la rangée grise de K05 n'est pas reportée.
 *
 * ── L'ORDRE DE CES LIAISONS COMPTE, et ce n'est pas du style ────────────────
 *
 * `applyData` les applique l'une après l'autre sur le HTML qu'elle vient de
 * réécrire, et « Mes études à Lyon » figure DEUX fois dans le cadre
 * d'ordinateur : une fois dans la première rangée de la liste, une fois dans
 * l'en-tête de la conversation. La liste est donc liée D'ABORD — elle consomme la
 * première occurrence — et l'en-tête ensuite, avec `fois: 1`. Déclarées dans
 * l'autre sens, les deux occurrences seraient remplacées d'un coup et le nom de
 * l'en-tête vaudrait celui de la première conversation de la liste.
 */
const donneesMessagerie = ({ desktop, conversation, liste = null }) => [
  ...barreHauteDe(desktop),
  {
    noeud: CONVERSATIONS_M01(
      'Mes études à Lyon',
      'Aïcha : Tu veux que je relise ?',
      'Yasmine Benali',
      'Bonjour, je vous écris pour…',
    ).liste,
    devient: RANGEE_M01_LIEE('conversations', 'c', true),
    frames: [desktop],
    why: 'Mes conversations, de `GET /conversations` — nom, dernière ligne DÉSCELLÉE par le serveur, heure et non-lus.',
  },
  {
    noeud: CONVERSATIONS_M01('', '', 'Yasmine Benali', 'Bonjour, je vous écris pour…').demande,
    devient: RANGEE_DEMANDE_LIEE,
    frames: [desktop],
    why: 'Les demandes de conversation en attente, de `GET /conversations` (`pendingForMe`) — §5.2, « l’autre accepte ou ignore ».',
  },
  ...(liste === null
    ? []
    : [
        {
          noeud: CONVERSATIONS_M01(
            'Mes études à Lyon',
            'Aïcha : Tu veux que je relise ?',
            'Yasmine B.',
            'Bonjour, je vous écris…',
            false,
            // ⚠ AUCUNE RANGÉE OUVERTE SUR MOBILE, et c'est encore `fois` qui l'a
            // dit. La planche mobile de la liste donne `transparent` à ses TROIS
            // rangées : sur téléphone la liste est une page à part, et aucune
            // conversation n'y est ouverte — « MOBILE · CONVERSATION » est l'écran
            // suivant. Le fond reste une donnée (les deux valeurs sont dessinées
            // dans la section), mais le chargeur de ce cadre ne doit jamais rendre
            // `#E3F0EB` : voir `screens/m01/data.ts`.
            'transparent',
          ).liste,
          devient: RANGEE_M01_LIEE('conversations', 'c', true),
          frames: [liste],
          why: 'Les mêmes conversations, sur le cadre mobile — la maquette n’en dessine que trois et raccourcit les textes.',
        },
        {
          noeud: CONVERSATIONS_M01('', '', 'Yasmine B.', 'Bonjour, je vous écris…').demande,
          devient: RANGEE_DEMANDE_LIEE,
          frames: [liste],
          why: 'Les mêmes demandes, sur le cadre mobile.',
        },
      ]),
  {
    noeud: '>DEMANDES · 2<',
    devient: '>DEMANDES · {{ demandes.total }}<',
    frames: liste === null ? [desktop] : [desktop, liste],
    why: 'Le nombre de demandes de conversation en attente (§5.2), compté sur `pendingForMe`.',
  },
  {
    noeud: '>Mes études à Lyon<',
    devient: '>{{ entete.nom }}<',
    fois: 1,
    frames: [desktop, conversation],
    why: 'Le nom de la conversation ouverte — le titre du parcours (§8) ou l’interlocuteur pour une conversation directe.',
  },
  {
    noeud: '>Parcours · Aïcha (parraine), Moussa, Fanta<',
    devient: '>{{ entete.sousTitre }}<',
    frames: [desktop],
    why: 'Les membres de la conversation, de `members[].displayName` — le cadre mobile ne dessine pas cette ligne.',
  },
  LIEN_FIL(
    desktop,
    'J’ai visité le studio de la rue Garibaldi, ils demandent un garant.',
    'Avec Visale ça passe. Tu veux que je relise ton dossier ce soir ?',
    'Oui avec plaisir, je t’envoie tout.',
    IMAGE_M01,
  ),
  LIEN_FIL(
    conversation,
    'Ils demandent un garant.',
    'Avec Visale ça passe.',
    'Je t’envoie tout.',
    '',
  ),
];

export const screens = [
  /**
   * ── M01 · /messages et /messages/:id ───────────────────────────────────────
   *
   * TROIS PLANCHES POUR DEUX ROUTES, et c'est la maquette qui le décide.
   *
   * Sur ordinateur elle ne dessine QU'UN cadre : les deux volets côte à côte
   * (liste de 320 px + conversation), exactement ce que T5 décrit — « deux volets
   * sur ordinateur, pages séparées sur mobile ». `/messages` et `/messages/:id`
   * ont donc le MÊME cadre d'ordinateur, et les deux pages l'emploient. En
   * dessiner un second, sans conversation ouverte, serait inventer une planche.
   *
   * Sur mobile elle en dessine deux, et les nomme : « MOBILE · LISTE » puis
   * « MOBILE · CONVERSATION ». Ce sont les occurrences 0 et 1 des 390 px.
   *
   * DES DEUX CARTES DE DROITE, UNE SEULE EST LIVRÉE :
   *
   *   · « MENU DE LA CONVERSATION » (300 px) — Voir le profil, Mettre en sourdine,
   *     Bloquer, Signaler. C'est le menu du « ··· » de l'en-tête. LIVRÉE : voir
   *     l'écran `m01menu` plus bas, et `VOILE_DE_M01` pour l'emprunt du voile ;
   *   · « DEMANDE EN ATTENTE » (340 px) — la bulle du premier message et l'encart
   *     « Premier message envoyé. Vous pourrez continuer quand Marc aura répondu. »
   *     (08 §5.2, T5 M01). TOUJOURS PAS LIVRÉE, et le test qui fige son absence
   *     reste dans `e2e/messages-transverse.spec.ts` : c'est un ÉTAT DE
   *     CONVERSATION, pas une fenêtre, et rien dans la maquette ne dit à quel
   *     moment du fil il remplace le composeur. L'inventer serait dessiner.
   *
   * CE QUI A CHANGÉ POUR LE MENU, et pourquoi c'est licite : la carte est une
   * CARTE NUE — sans voile ni panneau positionné — ce qui est EXACTEMENT la forme
   * que `adaptModalFrame` sait traiter, et qu'il traite déjà pour la fenêtre
   * « Signaler » de X03 (480 px) comme pour les trois fenêtres de `08 Compte`. Le
   * cadre devient le panneau, centré avec les valeurs de `03 Accueil v2`, et le
   * voile lui est emprunté puisque M01 n'en dessine aucun. Rien de neuf n'a été
   * écrit pour cela : c'est le chemin existant, appliqué à une carte de plus.
   *
   * LE MENU N'A NI CROIX NI POIGNÉE, et on ne lui en dessine pas. Il se referme au
   * VOILE et à Échap — ce qui est précisément ce que le voile emprunté apporte, et
   * ce qu'un menu contextuel fait partout ailleurs. Le générateur signale « aucune
   * fermeture promue » à chaque exécution ; l'avertissement reste, il est juste.
   *
   * ── MEMBRE BLOQUÉ · NON RÉSOLU, ET ON N'INVENTE PAS ─────────────────────────
   *
   * Cherché dans les DIX maquettes de `docs/template/`. Ce qui existe :
   *
   *   · `08 Compte.dc.html`, section K05 « Contacts », carte « BLOQUÉS » — une
   *     RANGÉE de membre bloqué : pastille `#8A958F` (grise, là où les autres
   *     rangées portent `#0F5C48`, `#16785E`, `#B4581F`), nom « Paul A. »,
   *     sous-ligne « Bloqué le 3 mars », bouton « Débloquer ». C'est la seule
   *     chose que ce produit dessine d'un membre bloqué, et c'est une LISTE de
   *     contacts, pas une conversation ;
   *   · `09` lui-même écrit « Bloquer » — une entrée du menu de la conversation,
   *     donc l'action, jamais son résultat.
   *
   * Ce qui N'EXISTE NULLE PART : une conversation dont l'interlocuteur est bloqué.
   * Aucune planche ne montre ce que devient le composeur (« Message… », le rond
   * d'envoi, le trombone), et AUCUNE maquette n'écrit la phrase qui l'expliquerait.
   * `docs/specs/08-parrainage-messagerie.md` §3.2 et §5 décrivent le blocage en
   * prose et rangent la liste des bloqués dans Compte → Confidentialité, sans
   * jamais décrire cet écran.
   *
   * CE QU'ON POURRAIT EMPRUNTER — et pourquoi on ne l'a pas fait : la forme du
   * bandeau explicatif existe, dans cette section même, sur la carte « DEMANDE EN
   * ATTENTE » (`background:#F3F7F5;border-radius:14px;padding:12px;font-size:12.5px;
   * color:#0F5C48`) ; c'est déjà une conversation dont le composeur est remplacé par
   * une phrase. Mais la PHRASE, elle, ne s'emprunte pas : « Premier message envoyé.
   * Vous pourrez continuer quand Marc aura répondu. » ne parle pas d'un blocage, et
   * en écrire une autre serait inventer du texte — ce que la règle 1 interdit, et
   * ce qui a déjà coûté A01.
   *
   * CE QU'IL FAUDRAIT AU PORTEUR : soit une planche « M01 · CONVERSATION BLOQUÉE »,
   * soit simplement la phrase à afficher — le reste (bandeau `#F3F7F5` à la place
   * du composeur, rangée grise de K05 dans la liste) se transcode alors sans qu'un
   * pixel soit inventé. Consigné au rapport.
   *
   * LE DÉCLENCHEUR DU MENU EST LE « ··· » DE L'EN-TÊTE DE CONVERSATION, et il
   * n'existe que là : le cadre « MOBILE · LISTE » ne le dessine pas (son en-tête
   * porte un crayon). Le déclencheur est donc borné à ses deux cadres, et c'est la
   * maquette qui le décide, pas un oubli.
   *
   * « Signaler » et « Bloquer » vivent DANS ce menu, donc la feuille X03 reste
   * servie par l'URL : le menu ne branche aucune de ses quatre entrées, parce
   * qu'aucune des quatre n'est un bouton dans la maquette et qu'aucune route ne les
   * porte encore (module 13). Ce qui change, c'est que le menu est désormais
   * ATTEIGNABLE, et refermable.
   */
  screen({
    section: 'M01',
    out: 'm01',
    /**
     * Le marqueur est le TRACÉ du « ··· », pas son libellé : la maquette n'en
     * écrit aucun. Il figure deux fois dans la section — une fois par en-tête de
     * conversation — et une seule fois dans chacun des deux cadres visés.
     *
     * `label` DONNE SON NOM AU BOUTON. Sans lui, `markTriggers` créerait un
     * `<button>` qui ne contient qu'un `<svg>` : muet au lecteur d'écran, et
     * relevé par axe-core en `critical` (`button-name`). Le texte est celui que la
     * maquette écrit sur la carte — « MENU DE LA CONVERSATION » — rendu en casse
     * de phrase, parce qu'un nom accessible tout en capitales s'épelle lettre par
     * lettre chez plusieurs lecteurs d'écran. C'est la seule retouche, et elle ne
     * touche aucun pixel.
     */
    triggers: [
      {
        marker: '<path d="M5 12h.01M12 12h.01M19 12h.01"/>',
        modal: 'M01MENU',
        label: 'Menu de la conversation',
        frames: ['Desktop', 'MobileConversation'],
      },
    ],
    dataType: 'M01Data',
    dataModule: './data',
    frames: [
      // « Messages » est le titre du volet de gauche, 18 px / 800. Il ne figure
      // qu'une fois dans ce cadre : ni le rail ni le panneau d'accueil ne le
      // portent, parce que 08 §5.1 l'exige — « la messagerie n'est pas une entrée
      // de navigation : icône en barre haute ».
      f(1440, 'Desktop', 0, t('Messages', '18px')),
      f(390, 'Mobile', 0, t('Messages', '21px')),
      // La conversation titre le nom de la conversation — ici celui du parcours,
      // comme 08 §8 le demande (« conversation de parcours nommée par le titre du
      // parcours »). 16 px sur l'en-tête mobile.
      f(390, 'MobileConversation', 1, t('Mes études à Lyon', '16px')),
    ],
    /**
     * BRANCHÉ SUR \`GET /conversations\` (la liste, les non-lus, la dernière ligne) et
     * \`GET /conversations/:id/messages\` (le fil). Les deux routes portent
     * \`@RequiresCapability('content.read')\` et AUCUN \`@PublicRead\` — lu sur le
     * CONTRÔLEUR, pas supposé. Un appel parti sans jeton prend donc un vrai \`401\`,
     * que le socle rafraîchit et rejoue une fois ; cet écran ne peut pas « changer
     * d'avis au rechargement » comme le ferait une route publique.
     *
     * Le détail des liaisons, et pourquoi leur ordre compte, est sur
     * \`donneesMessagerie\` — M01BLOQUE lit exactement les mêmes.
     */
    donnees: donneesMessagerie({
      desktop: 'Desktop',
      conversation: 'MobileConversation',
      liste: 'Mobile',
    }),
  }),

  /**
   * ── M01 · LA CONVERSATION AVEC UN MEMBRE BLOQUÉ ────────────────────────────
   *
   * Servie par `/messages/:id?etat=bloque`. Les DEUX cadres de conversation sont
   * repris tels quels — le fil, l'en-tête, le « ··· » qui ouvre le menu — et seul
   * le composeur change de contenu. Voir `CONVERSATION_BLOQUEE` pour ce qui est
   * emprunté, à quelle maquette, et pour la phrase qui vient du porteur.
   *
   * Le cadre mobile de la LISTE n'est pas repris : rien n'y change, puisque la
   * rangée grise de K05 n'est pas reportée (la raison est avec l'emprunt).
   */
  screen({
    section: 'M01',
    out: 'm01bloque',
    /**
     * LES CADRES SONT NOMMÉS « Bloque… », et ce n'est pas cosmétique : le nom de
     * l'export est `section + nom du cadre`, donc des cadres nommés « Desktop »
     * auraient produit un second `M01Desktop`. Deux composants du même nom, dans
     * deux fichiers, sont une confusion qui se paie à la première relecture.
     */
    triggers: [
      {
        marker: '<path d="M5 12h.01M12 12h.01M19 12h.01"/>',
        modal: 'M01MENU',
        label: 'Menu de la conversation',
        frames: ['BloqueDesktop', 'BloqueMobileConversation'],
      },
    ],
    borrows: [
      { ...CONVERSATION_BLOQUEE, anchor: COMPOSEUR_ORDINATEUR, frames: ['BloqueDesktop'] },
      {
        ...CONVERSATION_BLOQUEE,
        anchor: COMPOSEUR_TELEPHONE,
        frames: ['BloqueMobileConversation'],
      },
    ],
    dataType: 'M01BloqueData',
    dataModule: './data',
    frames: [
      f(1440, 'BloqueDesktop', 0, t('Messages', '18px')),
      f(390, 'BloqueMobileConversation', 1, t('Mes études à Lyon', '16px')),
    ],
    /**
     * LES MÊMES DONNÉES QUE M01, et c'est le point : une conversation bloquée
     * reste une conversation. On lit la liste, les demandes, l'en-tête et le fil
     * exactement comme ailleurs — ce qui change, c'est qu'on ne peut plus écrire,
     * et cela se joue dans le composeur, que l'EMPRUNT remplace.
     *
     * Le type est distinct (`M01BloqueData`) alors que sa forme est identique, et
     * c'est volontaire : un écran, un type. Le jour où cet état portera une donnée
     * de plus — la date du blocage, par exemple, que `GET /me/blocks` sait rendre
     * et que la maquette ne dessine nulle part — elle n'apparaîtra pas dans la
     * signature des cadres de M01.
     */
    donnees: donneesMessagerie({
      desktop: 'BloqueDesktop',
      conversation: 'BloqueMobileConversation',
    }),
  }),

  /**
   * ── M01 · LE MENU DE LA CONVERSATION ───────────────────────────────────────
   *
   * La carte de 300 px, telle que la maquette la dessine : quatre entrées de
   * 44 px — Voir le profil, Mettre en sourdine, Bloquer, Signaler — sous
   * l'étiquette « MENU DE LA CONVERSATION ». Elle figure une seule fois dans la
   * section (compté : un `width:300px`), d'où l'occurrence 0.
   *
   * CARTE NUE, donc `adaptModalFrame` fait tout : le cadre devient le panneau,
   * centré comme les fenêtres de `03 Accueil v2`, et le voile est emprunté à la
   * même maquette faute d'en trouver un dans la section. Voir `VOILE_DE_M01` pour
   * la provenance exacte et pour le témoin qui la garde.
   *
   * LE TITRE EST L'ÉTIQUETTE DE LA CARTE, pas un titre inventé. La maquette nomme
   * ce bloc « MENU DE LA CONVERSATION », en 10,5 px / 700 — exactement comme elle
   * nomme « BLOQUÉS » ou « DEMANDES REÇUES » dans `08 Compte`. Le discriminant
   * par défaut de `titleFor` exige 800 ; `modalTitleRequires` le surcharge ici, et
   * seulement ici. La surcharge porte sur QUEL texte promouvoir, pas sur LEQUEL des
   * titres : les deux questions restent séparées. Sans nom accessible, `aria-labelledby` pointerait dans le vide
   * et axe-core le relèverait.
   *
   * AUCUNE DES QUATRE ENTRÉES N'EST BRANCHÉE : la maquette les dessine en
   * `<span>`, aucune route ne les porte dans ce lot, et en faire des boutons qui
   * ne font rien serait mentir au membre. Elles restent du texte, ce qu'elles sont.
   */
  screen({
    section: 'M01',
    out: 'm01menu',
    modal: true,
    modalTitle: 'MENU DE LA CONVERSATION',
    modalTitleRequires: 'fontWeight: "700"',
    borrows: [VOILE_DE_M01],
    frames: [f(300, 'Menu')],
    /**
     * CETTE CARTE N'A RIEN À LIRE, et il faut le dire : elle n'écrit que son titre
     * et les QUATRE ACTIONS du menu — « Voir le profil », « Mettre en sourdine »,
     * « Bloquer », « Signaler ». Ce sont des gestes, pas des données, et aucun ne
     * porte le nom de l'autre membre : la maquette dessine « Bloquer » et non
     * « Bloquer Fatou ». Il n'y a donc aucune ancre où mettre un nom, et en ajouter
     * une serait redessiner la carte.
     *
     * ⚠ ÉCART SIGNALÉ, et il touche la règle dure de ce module : 08 §4 veut qu'un
     * blocage soit RÉCIPROQUE et immédiat, et cette carte est le seul endroit de la
     * maquette où un membre le déclenche. Aucun de ses cinq items n'est un bouton —
     * la maquette les dessine en `<div>` — donc le transcodeur n'y pose aucun
     * `onClick`, et « Bloquer » ne bloque rien. Ce n'est pas une liaison manquante,
     * c'est un geste manquant, et il est consigné plutôt que branché à la hâte :
     * un bouton « Bloquer » qui ne bloque pas est pire qu'un menu inerte.
     */
  }),

  /**
   * ── X01 · /recherche ───────────────────────────────────────────────────────
   *
   * Le cadre d'ordinateur dessine les SUGGESTIONS DÉPLIÉES (11 §2.3, « suggestions
   * dès 3 caractères ») : une carte en `position:absolute` par-dessus la page. Elle
   * fait partie du cadre, elle est donc transcodée avec lui.
   *
   * ⚠ LE CADRE MOBILE N'A AUCUN TITRE, et aucune déclaration ne peut en fabriquer
   * un. La maquette y écrit la requête dans le champ de recherche (14 px / 600) et
   * rien d'autre : pas de « Résultats pour … », pas de compteur en gros. Promouvoir
   * le contenu du champ en `<h1>` transformerait une saisie en titre de page — ce
   * serait un titre inventé, exactement ce qui a coûté A01. Le générateur le
   * signale à chaque exécution ; c'est consigné dans le rapport plutôt que masqué.
   *
   * La carte « ÉTATS / VIDE » n'est pas un cadre : c'est l'état vide (« Aucun
   * résultat. Posez la question à la communauté ? », 11 §2.4) dessiné en composant,
   * sans planche complète autour. Même traitement que les deux cartes de M01.
   */
  /**
   * ── CE QUE X01 LIT, ET LES TROIS CHOSES QU'IL NE PEUT PAS LIRE ─────────────
   *
   * BRANCHÉ SUR `GET /search` et `GET /search/suggest` (11 §3). Les deux portent
   * `@RequiresCapability('content.read')` et AUCUN `@PublicRead` — lu sur le
   * contrôleur.
   *
   * ⚠ `GET /search` REND DEUX FORMES, et c'est `type` qui décide : sans lui,
   * `items` est une liste de GROUPES (type, libellé, compteur, aperçu) ; avec lui,
   * une liste de résultats plats. La planche d'ordinateur dessine l'onglet
   * « Tout » — donc la forme GROUPÉE. C'est écrit, et vérifié, sur
   * `groupedSearchResponseSchema` dans `packages/shared`.
   *
   * ── CE QUI N'EST PAS LIÉ, ET POURQUOI ──────────────────────────────────────
   *
   * 1. LES DIX PASTILLES DE FACETTES — « Tout · 24 », « Guides · 5 », « Sujets ·
   *    7 »… Les compteurs existent (`items[].count`) et le total aussi (leur
   *    somme : 5+7+4+3+0+1+2+0+2 = 24, ce que la maquette écrit exactement). Mais
   *    les LIBELLÉS divergent : la maquette écrit « Sujets » et « Pros » là où
   *    `SEARCH_TYPE_LABELS_FR` — que le serveur emploie pour remplir `label` —
   *    écrit « Sujets de réseau » et « Professionnels ». Lier la pastille
   *    changerait donc le texte affiché, et la maquette dessine en plus « Villes »
   *    SANS compteur, ce qu'un gabarit unique ne reproduit pas. Deux décisions de
   *    produit, pas une liaison : signalées au porteur.
   *
   * 2. LES QUATRE CARTES DE RÉSULTAT. Leur titre et leur type viennent bien de
   *    `SearchHit`, mais leur SOUS-LIGNE n'a aucune source : « Mis à jour le
   *    12 mars · 84 utiles », « Béninois en France · 14 réponses », « Ouverte ·
   *    Lyon 7e », « 620 € ». `SearchHit` porte `title`, `excerpt`, `cityId`,
   *    `countryId`, `communityId`, `rank` et `updatedAt` — ni compteur d'utiles, ni
   *    nombre de réponses, ni état, ni loyer, et ses trois identifiants sont des
   *    UUID que `GET /search` ne résout pas en noms. Les quatre cartes sont de
   *    surcroît DESSINÉES DIFFÉREMMENT l'une de l'autre (une par type), donc une
   *    fabrique unique ne les reproduirait pas. Lier le seul titre laisserait
   *    quatre sous-lignes figées sous des titres qui changent — pire que la
   *    maquette figée. Signalé : il manque à `GET /search` les champs d'affichage
   *    que la maquette dessine.
   *
   * 3. L'ÉTAT VIDE. `meta.zeroResult` porte sa phrase et son bouton, de l'API et
   *    non du front (`SEARCH_ZERO_PROMPT_FR`) — mais la maquette ne dessine cet
   *    état que dans une carte « ÉTATS » posée à côté des planches, sans cadre
   *    autour. Il n'y a nulle part où le poser.
   *
   * CE QUI EST LIÉ l'est donc complètement : la requête, sur les deux cadres, et
   * les trois suggestions dépliées de la planche d'ordinateur.
   */
  screen({
    section: 'X01',
    out: 'x01',
    dataType: 'X01Data',
    dataModule: './data',
    frames: [
      f(1440, 'Desktop', 0, t('Résultats pour « visale »', '28px')),
      f(390, 'Mobile', 0),
    ],
    donnees: [
      ...BARRE_HAUTE,
      {
        noeud: '>Résultats pour « visale »<',
        devient: '>Résultats pour « {{ requete }} »<',
        frames: ['Desktop'],
        why: 'La requête, de `meta.q` — et le titre de la page, que `retitrerSurDonnees` reprend sur sa forme liée.',
      },
      {
        /**
         * ⚠ LE CADRE MOBILE N'A TOUJOURS PAS DE TITRE, et cette liaison n'en
         * fabrique pas un. La maquette écrit la requête DANS LE CHAMP de
         * recherche, en 14 px / 600 ; la lier remplace une valeur de champ par
         * une autre valeur de champ. Promouvoir ce champ en `<h1>` resterait un
         * titre inventé — c'est ce qui a coûté A01 — et le générateur continue de
         * signaler l'absence à chaque exécution. Consigné, pas masqué.
         */
        noeud: '>visale<',
        devient: '>{{ requete }}<',
        frames: ['Mobile'],
        why: 'La requête telle qu’elle est saisie, de `meta.q` — le cadre mobile l’écrit dans le champ.',
      },
      {
        noeud:
          SUGGESTION_X01('vis', 'ale étudiant') +
          SUGGESTION_X01('vis', 'a long séjour') +
          SUGGESTION_X01('vis', 'ite préfecture Lyon'),
        devient:
          '<sc-for list="{{ suggestions }}" as="s">' +
          SUGGESTION_X01('{{ s.prefixe }}', '{{ s.suite }}') +
          '</sc-for>',
        frames: ['Desktop'],
        why: 'Les suggestions de `GET /search/suggest` (11 §2.3, dès 3 caractères) — la part saisie en gras, puis la suite.',
      },
    ],
  }),

  /**
   * ── X02 · le panneau de la cloche et /notifications ────────────────────────
   *
   * Trois planches, et la maquette les nomme : « PANNEAU DÉROULANT », « PAGE
   * COMPLÈTE », « MOBILE ». Les deux premières font 1440 px — d'où les occurrences.
   *
   * L'ordre des occurrences est celui du DOCUMENT : le panneau déroulant vient en
   * premier. La page complète est donc l'occurrence n° 1, et c'est elle qui sert de
   * cadre par défaut à `/notifications` (12 §2.7 : « cloche en barre haute avec
   * compteur de non-lus, panneau déroulant, page complète »).
   *
   * Le panneau déroulant est un ÉTAT de n'importe quelle page, pas une route : sa
   * planche dessine d'ailleurs un contenu principal VIDE (un bloc de 600 px sans
   * rien). Il est servi par `/notifications?vue=panneau`, pour qu'il soit
   * atteignable et éprouvable — la maquette ne dessine aucune cloche cliquable dans
   * les cadres de ce lot.
   */
  /**
   * ── CE QUE X02 LIT, ET CE QU'IL NE PEUT PAS LIRE ───────────────────────────
   *
   * BRANCHÉ SUR `GET /notifications` (12 §4), ses CINQ lignes liées sur les TROIS
   * planches. Voir `LIGNE_X02_LIEE` pour les deux écarts assumés — l'emphase de
   * l'échéance et le glyphe des neuf catégories que la maquette ne dessine pas.
   *
   * `meta.unread` EST RENDU PAR L'API ET N'A NULLE PART OÙ ALLER. La réponse porte
   * le compteur de non-lus, et 12 §2.7 le demande (« cloche en barre haute avec
   * compteur de non-lus ») — mais AUCUNE des trois planches ne dessine ce
   * compteur : la cloche de la barre haute est un `<span>` d'icône nu, sans
   * pastille, et le panneau déroulant n'en met pas davantage. Compté sur les trois
   * cadres. Lui faire une place serait dessiner la pastille manquante. Signalé au
   * porteur ; la donnée est lue, validée, et volontairement non affichée.
   *
   * LES PASTILLES DE FILTRE NE SONT PAS LIÉES. La page écrit « Tout · Messages ·
   * Compte » et le cadre mobile « Tout · Parcours · Entraide · Réseaux » : quatre
   * libellés sur sept ne correspondent à aucune valeur de `CATEGORY_LABELS_FR`
   * (qui écrit « Messages privés », « Mon compte », « Réactions et
   * commentaires »…), et la maquette n'en dessine jamais les quatorze. Les lier
   * demanderait de choisir lesquelles montrer, donc de redessiner la rangée.
   * Signalé.
   */
  screen({
    section: 'X02',
    out: 'x02',
    dataType: 'X02Data',
    dataModule: './data',
    frames: [
      f(1440, 'Desktop', 1, t('Notifications', '28px')),
      f(390, 'Mobile', 0, t('Notifications', '21px')),
      f(1440, 'DesktopPanneau', 0, t('Notifications', '17px')),
    ],
    donnees: [
      ...BARRE_HAUTE,
      ...barreHauteDe('DesktopPanneau'),
      LISTE_X02('Desktop'),
      LISTE_X02('Mobile'),
      LISTE_X02('DesktopPanneau'),
    ],
  }),

  /**
   * ── X03 · « Signaler » — fenêtre sur ordinateur, feuille du bas sur mobile ──
   *
   * La maquette l'écrit elle-même sous la planche, et sa planche d'ordinateur est
   * une CARTE NUE de 480 px : ni voile ni positionnement, exactement comme J03 et
   * J04. `adaptModalFrame` comble l'écart sans rien inventer — le cadre devient le
   * panneau, centré avec les valeurs de `03 Accueil v2`, et le voile est emprunté à
   * la planche MOBILE de la même section, qui le dessine (`rgba(22,33,29,.55)`).
   *
   * Les six motifs sont ceux de T5 et de 13 §… : Arnaque, Demande d'argent,
   * Harcèlement, Indésirable, Inapproprié, Autre. La note « La conversation sera
   * visible des modérateurs » est celle de 08 §5.2.
   *
   * ─── SES DEUX CADRES N'ONT RIEN À LIRE, ET C'EST UNE RÉPONSE ───────────────
   *
   * Compté sur ses octets, cette fenêtre n'écrit que quatre sortes de choses, et
   * aucune n'est une donnée de membre :
   *
   *   · LES SIX MOTIFS sont l'énumération `ReportReason` dessinée EN ENTIER, côte
   *     à côte, comme un choix à faire. C'est le cas de K03 (les quatre états KYC)
   *     et de K02 (les quatre motifs de contact) : piloter une liste que la
   *     maquette montre complète demanderait de décider lequel est sélectionné,
   *     donc de redessiner la rangée ;
   *   · L'EXEMPLE du champ « Détails (facultatif) » devient un `placeholder` au
   *     transcodage — « Il me demande 150 € pour "accélérer" mon dossier. » est une
   *     invite, pas le signalement de quelqu'un ;
   *   · LA NOTE « La conversation sera visible des modérateurs. » est la règle de
   *     08 §5.2, vraie de tout signalement et de tout membre ;
   *   · le titre « Signaler » et le bouton d'envoi.
   *
   * CE QU'ELLE NE DESSINE PAS, et c'est l'écart à signaler : rien n'identifie CE
   * QUI est signalé. Une fenêtre ouverte depuis une conversation, un profil ou une
   * publication est la même planche, sans un mot sur la cible. C'est au porteur de
   * dire si elle doit la nommer ; tant qu'elle ne la dessine pas, il n'y a pas
   * d'ancre où lier `targetType` et `targetId`.
   */
  screen({
    section: 'X03',
    out: 'x03',
    modal: true,
    modalTitle: 'Signaler',
    frames: [f(480, 'Desktop'), f(390, 'Mobile')],
  }),

  /**
   * La CONFIRMATION est une planche à part — « Merci. Nous regardons sous 24
   * heures. » (T5 X03). Une carte nue de 360 px, elle aussi.
   *
   * ⚠ ELLE NE DESSINE AUCUNE FERMETURE : ni croix, ni poignée — et c'est un
   * manque de la maquette, pas un choix qu'elle affirme. La croix lui est donc
   * EMPRUNTÉE à sa voisine immédiate : la fenêtre « Signaler » de la MÊME section
   * de la MÊME maquette, qui en porte une. Voir `CROIX_DE_X03` pour ce qui est
   * emprunté au caractère près, et `applyBorrows` pour le garde-fou qui lève si ce
   * motif disparaît de X03.
   *
   * L'ANCRE EST LE TITRE : « Merci. », en 19 px / 800, unique dans ce cadre. Il
   * entre dans la rangée d'en-tête empruntée, à la place qu'occupe « Signaler »
   * dans la fenêtre voisine ; la croix se pose à sa droite, comme là-bas. Son corps
   * reste à 19 px — c'est le dessin de cette planche-ci, et on n'y touche pas.
   *
   * Elle n'a pas de planche mobile propre : la même carte sert aux deux largeurs,
   * comme la feuille d'invitation de J05 (voir le type de `Modal`).
   *
   * ─── ELLE NE LIT RIEN, ET LA RAISON EST PIRE QU'UN CHAMP MANQUANT ─────────
   *
   * Elle n'écrit que deux textes : « Merci. » (son titre) et « Nous regardons sous
   * 24 heures. »
   *
   * CETTE SECONDE PHRASE A UNE SOURCE, et il faut le dire exactement :
   * `POST /reports` rend `{ id, caseId, message }`, et `message` est
   * `REPORT_CONFIRMATION` de `@app/shared` — « Merci. Notre équipe examine votre
   * signalement ; vous serez informé·e de sa clôture. » Ce n'est donc PAS un champ
   * qui manque, et le « sous 24 heures » de la maquette est une promesse de délai
   * que le serveur ne fait pas (son SLA de 24 h existe, mais dans la file
   * d'ADMINISTRATION — `slaDueAt`, `slaState` — et jamais dans la réponse au
   * membre qui signale).
   *
   * ⚠ CE QUI EMPÊCHE DE LA LIER EST AILLEURS, ET C'EST À REMONTER EN PRIORITÉ :
   * RIEN N'APPELLE `POST /reports`. Vérifié — `screens/messages/appels.ts` ne
   * contient pas le mot, et `screens/messages/ecran.tsx` ouvre cette carte sur un
   * simple état (`courante === 'merci'`). La fenêtre « Signaler » recueille six
   * motifs et un texte, le bouton n'envoie rien, et cette carte dit ensuite
   * « Merci » pour un signalement qui n'existe pas. Lier `message` demanderait de
   * fabriquer une réponse qu'aucun appel n'a reçue — ce qui serait le mensonge que
   * `donnees` existe pour empêcher, à l'endroit le plus grave : un membre qui
   * signale une arnaque et croit l'avoir fait.
   *
   * C'est un geste manquant, pas une liaison manquante. Consigné au rapport.
   */
  screen({
    section: 'X03',
    out: 'x03confirmation',
    modal: true,
    modalTitle: 'Merci.',
    borrows: [
      {
        ...CROIX_DE_X03,
        anchor: '<div style="font-size:19px;font-weight:800">Merci.</div>',
        into:
          '<div style="display:flex;align-items:center"><div style="flex:1">' +
          '<div style="font-size:19px;font-weight:800">Merci.</div>' +
          '</div><span style="width:40px;height:40px;border-radius:999px;background:#F2F5F4;display:flex;align-items:center;justify-content:center">' +
          '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#16211D" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="M18 6 6 18M6 6l12 12"/></svg></span></div>',
      },
    ],
    frames: [f(360, 'MobileConfirmation')],
  }),

  /**
   * ── X04 · les encarts de refus ─────────────────────────────────────────────
   *
   * T5 les range en « composants » et ne leur donne AUCUNE route ; ils sont livrés
   * comme tels, sans page. Le dépôt a déjà trois écrans dans ce cas (A01G, A01S,
   * P03), et leur inventer une URL serait pire que de n'en avoir pas.
   *
   * UN SEUL CADRE, et c'est celui qui porte les DEUX encarts : la planche mobile de
   * 390 px montre « NIVEAU » et « PLAN » l'un sous l'autre, sur un écran « Créer un
   * événement » dont la barre d'onglets et la flèche de retour restent en place —
   * c'est la démonstration de ce que la maquette annonce en légende, « ne bloquent
   * jamais la navigation ».
   *
   * Les deux planches de 480 px — « NIVEAU » et « PLAN » — écrivent
   * `background:…;width:480px` : la largeur n'ouvre pas l'attribut `style`, et
   * `extractFrame` les ancrait sur son début. Elles étaient donc introuvables.
   * ELLES SONT MAINTENANT ATTEIGNABLES : la largeur est reconnue où qu'elle soit
   * déclarée, et `extractFrame(section, 480, 0)` / `(…, 480, 1)` les rend.
   *
   * ELLES NE SONT PAS MONTÉES : le cadre mobile donne déjà les deux composants, au
   * dessin près la largeur, et les monter serait un lot de transcodage. Recensées
   * par le lot qui a réparé la sélection, laissées à celui qui les montera.
   *
   * ─── CE CADRE LIT MAINTENANT SON QUOTA, ET PAS SON NIVEAU ──────────────────
   *
   * La raison écrite jusqu'ici était « les encarts de refus n'ont aucune route »,
   * et elle est juste pour UN des deux encarts seulement. Elle a été vérifiée des
   * deux côtés :
   *
   *   · L'ENCART « NIVEAU » attend bien un REFUS. Ses deux phrases — « Cette
   *     action demande une identité vérifiée », « Deux minutes avec votre pièce
   *     d'identité. Elle n'est jamais conservée par la plateforme. » — sont le
   *     `labelFr` et le texte de §7.3 que `403 LEVEL_REQUIRED` porte, et une
   *     écriture refusée est la SEULE chose qui les produise. Aucune lecture ne
   *     les rend, et ce lot ne tente aucune écriture. Il reste dessiné ;
   *   · L'ENCART « PLAN », lui, est un COMPTEUR, et il se lit en tout temps.
   *     « 1 événement sur 1 ce mois-ci » est la métrique `EVENTS_CREATED` de
   *     `GET /me/subscription` (`usage.items`), et « Réinitialisé le 1er
   *     octobre. » est son `usage.resetsAt`. Les deux champs existent, sont
   *     validés, et le module Services lit DÉJÀ le second pour sa propre barre de
   *     quota (`Quotas.reinitialise`). Il n'y avait donc rien à attendre.
   *
   * CE QUE LA DATE NE DOIT PAS ÊTRE : le premier du mois suivant calculé par
   * l'horloge du NAVIGATEUR. `resetsAt` est l'instant que le serveur annonce
   * (14 §4.5), et un navigateur décalé d'un fuseau afficherait « Réinitialisé le
   * 30 septembre » à un membre dont le quota repart le 1er octobre.
   *
   * ⚠ ET CE CADRE N'EST MONTÉ PAR AUCUNE PAGE — vérifié : son composant est généré
   * et importé par personne. Lier son quota ne le fait pas apparaître ; cela
   * garantit qu'il ne mentira pas le jour où une page l'affichera. Consigné au
   * rapport : T5 range ces encarts en « composants » sans leur donner de route.
   */
  screen({
    section: 'X04',
    out: 'x04',
    dataType: 'X04Data',
    dataModule: '../x04/data',
    frames: [f(390, 'Mobile', 0, t('Créer un événement', '16px'))],
    donnees: [
      {
        noeud:
          '<div style="font-size:15.5px;font-weight:700;color:#B4581F">1 événement sur 1 ce mois-ci</div>',
        devient:
          '<div style="font-size:15.5px;font-weight:700;color:#B4581F">{{ quota.utilises }} événement sur {{ quota.plafond }} ce mois-ci</div>',
        fois: 1,
        why: 'Le compteur d’événements du mois et son plafond, de `GET /me/subscription` (`usage.items`, métrique `EVENTS_CREATED`) — jamais la valeur de la maquette.',
      },
      {
        noeud:
          '<div style="font-size:13px;line-height:1.55;margin-top:4px">Réinitialisé le 1er octobre.</div>',
        devient:
          '<div style="font-size:13px;line-height:1.55;margin-top:4px">Réinitialisé le {{ quota.reinitialise }}.</div>',
        fois: 1,
        why: 'La date de réinitialisation du quota, de `usage.resetsAt` (14 §4.5) — annoncée par le serveur, jamais déduite de l’horloge du navigateur.',
      },
    ],
  }),
];
