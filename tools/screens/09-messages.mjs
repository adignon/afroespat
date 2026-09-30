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

const screen = ({ section, out, frames, ...rest }) => ({
  file: FILE,
  section,
  out: `apps/web/src/screens/${out}`,
  dataModule: '../messages/data',
  dataType: 'MessagesData',
  frames,
  ...rest,
});

/** Un cadre : largeur, nom, rang parmi les planches de même largeur, titre de page. */
const f = (width, name, occurrence = 0, title = undefined) => ({ width, name, occurrence, title });

/** Titre visible d'un cadre : le texte tel que la maquette l'écrit, et son corps. */
const t = (text, size) => ({ text, size });

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
    frames: [
      f(1440, 'BloqueDesktop', 0, t('Messages', '18px')),
      f(390, 'BloqueMobileConversation', 1, t('Mes études à Lyon', '16px')),
    ],
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
   * par défaut de `promoteModalTitle` exige 800 ; il est donc surchargé ici, et
   * seulement ici. Sans nom accessible, `aria-labelledby` pointerait dans le vide
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
  screen({
    section: 'X01',
    out: 'x01',
    frames: [
      f(1440, 'Desktop', 0, t('Résultats pour « visale »', '28px')),
      f(390, 'Mobile', 0),
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
  screen({
    section: 'X02',
    out: 'x02',
    frames: [
      f(1440, 'Desktop', 1, t('Notifications', '28px')),
      f(390, 'Mobile', 0, t('Notifications', '21px')),
      f(1440, 'DesktopPanneau', 0, t('Notifications', '17px')),
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
   * Les deux planches de 480 px ne sont PAS extraites : la maquette y écrit
   * `background:…;width:480px`, la largeur n'ouvre donc pas l'attribut `style` et
   * `extractFrame` ne les reconnaît pas. Élargir son motif le rendrait ambigu pour
   * toutes les autres maquettes ; le cadre mobile donne déjà les deux composants,
   * au même dessin près la largeur. Consigné au rapport.
   */
  screen({
    section: 'X04',
    out: 'x04',
    frames: [f(390, 'Mobile', 0, t('Créer un événement', '16px'))],
  }),
];
