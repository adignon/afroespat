#!/usr/bin/env node
/**
 * Génère les écrans React depuis les maquettes.
 *
 * Le JSX est TRANSCODÉ du HTML de la maquette : les styles en ligne restent
 * identiques, à la virgule près. Ce qui s'écrit à la main, c'est la donnée et
 * le comportement — jamais la forme.
 *
 * Relancer après une modification de maquette : `node tools/generate-screens.mjs`.
 * Les fichiers produits portent `.generated.tsx` et ne se modifient pas à la main.
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  adaptModalFrame,
  extractFrame,
  extractSection,
  markTriggers,
  transcode,
  MODAL_WINDOW_SOURCE,
} from './dc-to-jsx.mjs';

const ROOT = resolve(import.meta.dirname, '..');

/**
 * ADAPTATIONS DE CADRE.
 *
 * Une maquette est une IMAGE de taille fixe : 1440 × 2760 px pour l'ordinateur,
 * 390 × 844 px pour le mobile. Tout ce qui dépasse y est coupé, puisque rien ne
 * défile dans une image. Un écran réel, lui, doit défiler.
 *
 * Ces quatre adaptations sont donc nécessaires, et ce sont les SEULES : partout
 * ailleurs le style transcodé est celui de la maquette, à la virgule près. La
 * liste est courte exprès — chaque ligne ajoutée ici est une liberté prise sur
 * le design, et doit se justifier.
 */
const FRAME_ADAPTATIONS = [
  {
    why: 'Une bande horizontale — stories, onglets, rail — doit défiler, pas être coupée.',
    match: (style) =>
      style.includes('overflow: "hidden"') &&
      style.includes('display: "flex"') &&
      style.includes('gap:') &&
      !style.includes('whiteSpace') &&
      !style.includes('flexDirection: "column"') &&
      !style.includes('flex: "1"'),
    apply: (style) => style.replace('overflow: "hidden"', 'overflowX: "auto"'),
    // Une zone défilable doit être atteignable au clavier (axe-core :
    // scrollable-region-focusable). Sans cela, l'adaptation elle-même créerait
    // une régression d'accessibilité — ce qu'elle a fait, et qu'axe a vu.
    attrs: 'tabIndex={0}',
  },
  {
    why: 'Le contenu vertical du cadre mobile était borné par ses 844 px : il doit couler.',
    match: (style) =>
      style.includes('overflow: "hidden"') &&
      style.includes('flex: "1"') &&
      style.includes('minHeight: "0"'),
    apply: (style) =>
      style.replace('overflow: "hidden"', 'overflow: "visible"').replace('flex: "1", minHeight: "0", ', ''),
  },
  /**
   * Les 50 px du haut simulaient l’encoche.
   *
   * La règle était écrite pour la SEULE forme que le fil emploie,
   * `padding: 50px 16px 0`. Les maquettes 05 et 07 en ont une seconde — les
   * en-têtes de page à flèche de retour écrivent `padding: 50px 12px 10px` — et
   * elle passait à travers : la barre gardait ses 50 px en dur, donc un creux
   * sous l’encoche sur un téléphone qui n’en a pas, et un titre sous l’encoche
   * sur un téléphone qui en a une.
   *
   * Le motif est donc devenu une expression : « 50 px en haut, quelle que soit la
   * suite ». La marge du haut devient la zone sûre PLUS le remplissage latéral,
   * exactement comme la règle littérale le faisait — les autres côtés ne bougent
   * pas. Dans ces maquettes, un remplissage haut de 50 px ne sert jamais à autre
   * chose qu’à dessiner l’encoche.
   */
  {
    why: 'Les 50 px du haut simulaient l’encoche ; un écran réel lit la zone sûre.',
    match: (style) => /padding: "50px (\d+(?:\.\d+)?px) ([^"]*)"/.test(style),
    apply: (style) =>
      style.replace(
        /padding: "50px (\d+(?:\.\d+)?px) ([^"]*)"/,
        (_, side, rest) =>
          `padding: "calc(env(safe-area-inset-top, 0px) + ${side}) ${side} ${rest}"`,
      ),
  },
  /**
   * LE BOUTON FLOTTANT DE PUBLICATION, recalé sur la FENÊTRE.
   *
   * Dans la maquette il est `position: absolute` dans un cadre de 844 px : il se
   * pose donc à 108 px du bas de l’écran dessiné. Dans l’application, le cadre
   * mobile de `ScreenFrames` est `position: relative` et fait la hauteur de TOUTE
   * la page — plusieurs milliers de pixels. Le bouton se retrouvait à 108 px du
   * bas du DOCUMENT, c’est-à-dire invisible tant qu’on n’avait pas déroulé la
   * liste entière. C’est le navigateur qui l’a montré, pas la relecture.
   *
   * Un bouton flottant est, par définition, fixe par rapport à la fenêtre. Ses
   * 108 px le posent au-dessus de la barre d’onglets basse (84 px), exactement où
   * la maquette le dessine.
   */
  {
    why: 'Le bouton flottant se cale sur la fenêtre, pas sur la hauteur du document.',
    match: (style) =>
      style.includes('position: "absolute"') &&
      style.includes('right: "18px"') &&
      style.includes('bottom: "108px"'),
    apply: (style) => style.replace('position: "absolute"', 'position: "fixed"'),
  },
  /**
   * `grid-rows` N'EST PAS UNE PROPRIÉTÉ CSS, et le navigateur l'ignore.
   *
   * `06 Services` l'écrit une fois, sur la grille de photos de l'annonce S02 :
   * `display:grid;grid-rows:1fr 1fr;gap:8px`. Le nom correct est
   * `grid-template-rows` ; tel quel, la déclaration est invalide et AUCUN
   * navigateur ne l'applique — la grille tombe sur ses rangées automatiques, et
   * comme les deux photos portent leur `height:156px` en dur, le rendu est
   * exactement le même. C'est donc une faute de frappe sans effet visible.
   *
   * Transcodée, elle devient `gridRows` dans un objet de style, que `tsc` refuse
   * (TS2561) : le cadre ne compilait pas. La RETIRER reproduit exactement ce que
   * le navigateur fait de la maquette — la même logique que « une propriété
   * écrite deux fois, la dernière gagne » dans `dc-to-jsx.mjs`. Ce n'est pas une
   * décision de design, c'est la sémantique de CSS.
   *
   * La corriger en `gridTemplateRows` serait, elle, une réécriture : on
   * appliquerait une déclaration que la maquette n'a jamais appliquée. Le jour
   * où la maquette écrit le bon nom, cette entrée ne collera plus à rien et
   * pourra partir.
   */
  {
    why: '« grid-rows » n’est pas une propriété CSS : le navigateur l’ignore, le transcodage aussi.',
    match: (style) => style.includes('gridRows:'),
    apply: (style) => style.replace(/, gridRows: "[^"]*"|gridRows: "[^"]*", /, ''),
  },
  {
    why: 'La colonne de gauche reste à l’écran pendant que le fil défile.',
    match: (style) =>
      style.includes('width: "400px"') &&
      style.includes('flexShrink: "0"') &&
      style.includes('padding: "0 24px"'),
    apply: (style) =>
      `${style}, position: "sticky", top: "0", alignSelf: "flex-start", maxHeight: "100vh", overflowY: "auto"`,
  },
  {
    why: 'La barre haute — recherche et actions — reste à l’écran.',
    // `gap: 8px` la distingue de la ligne du logo, qui fait aussi 64 px mais
    // avec un gap de 10 px et vit dans la colonne de gauche.
    match: (style) =>
      style.includes('height: "64px"') &&
      style.includes('gap: "8px"') &&
      style.includes('flexShrink: "0"'),
    // Le fond est indispensable : sans lui, le fil défilerait visiblement sous
    // la barre. La maquette n'en a pas besoin — rien n'y défile.
    apply: (style) =>
      `${style}, position: "sticky", top: "0", zIndex: 20, background: "#F6F8F7"`,
  },
  {
    why: 'La colonne de contexte reste à l’écran, sous la barre haute.',
    /**
     * UNE CARTE DE 300 PX N'EST PAS UNE COLONNE DE CONTEXTE, et le journal du
     * générateur l'a dit avant que personne ne le voie à l'écran.
     *
     * La règle ne demandait qu'une largeur de 300 px, une direction en colonne et
     * `flex-shrink: 0`. `10 Administration` dessine ses trois pages de rapport
     * d'impact exactement ainsi — `width:300px; height:420px; …; flex-direction:
     * column; flex-shrink:0` — et les trois recevaient `position: sticky`,
     * `max-height: calc(100vh - 88px)` et `overflow-y: auto`. Trois aperçus de
     * rapport, posés côte à côte dans une rangée, devenaient des colonnes collantes
     * qui se mettaient à défiler toutes seules sous 508 px de hauteur de fenêtre.
     *
     * Ce qui distingue une colonne d'une carte est vérifiable dans les six maquettes
     * qui en dessinent une : la colonne de contexte n'a NI hauteur NI remplissage —
     * elle descend aussi loin que son contenu et son remplissage vit dans chacune de
     * ses cartes. Une carte a les deux. C'est la même leçon que `CITY_SEARCH` et
     * `BUTTON_ACTIONS` ont déjà apprise à ce fichier : un motif trop large produit
     * une dérive en silence.
     */
    match: (style) =>
      style.includes('width: "300px"') &&
      style.includes('flexDirection: "column"') &&
      style.includes('flexShrink: "0"') &&
      !style.includes('height:') &&
      !style.includes('padding:') &&
      !style.includes('position:'),
    // 76 px = les 64 de la barre haute + 12 de respiration. En collant à 12,
    // la colonne passerait SOUS la barre au lieu de s'arrêter dessous.
    apply: (style) =>
      `${style}, position: "sticky", top: "76px", alignSelf: "flex-start", maxHeight: "calc(100vh - 88px)", overflowY: "auto"`,
  },
  /**
   * La barre d’onglets basse doit rester visible quand la page défile.
   *
   * ELLE NE L’ÉTAIT PAS, et c’est le navigateur qui l’a dit. La règle posait
   * `position: sticky` par un `replace('position: "relative"', …)` — or seule la
   * maquette `03 Accueil v2` écrit `position:relative` sur cette barre. Dans
   * `05 Entraide` et `07 Agenda` elle ne l’écrit pas : le remplacement ne trouvait
   * rien, l’adaptation se comptait quand même comme appliquée, et la barre repartait
   * avec `bottom: 0` et `z-index: 10` sur un élément `position: static` — deux
   * déclarations sans le moindre effet. Elle défilait donc hors de l’écran sur
   * onze cadres mobiles, sans qu’aucun avertissement ne le dise.
   *
   * Le `position` est désormais POSÉ, pas remplacé : la règle ne peut plus
   * s’appliquer à moitié. C’est la leçon à retenir de ce défaut — ce qu’une
   * adaptation change doit figurer dans ce qu’elle exige (`match`), ou être écrit de
   * façon à réussir dans tous les cas.
   */
  {
    why: 'La barre d’onglets basse doit rester visible quand la page défile.',
    match: (style) => style.includes('borderTop: "1px solid #E6EBE9"') && style.includes('repeat(5,1fr)'),
    apply: (style) =>
      (/position: "[^"]*"/.test(style)
        ? style.replace(/position: "[^"]*"/, 'position: "sticky"')
        : `position: "sticky", ${style}`)
        .replace('flexShrink: "0"', 'flexShrink: "0", bottom: "0", zIndex: 10')
        .replace('padding: "6px 8px 24px"', 'padding: "6px 8px calc(env(safe-area-inset-bottom, 0px) + 24px)"'),
  },
];

/**
 * ANNOTATIONS D'ACCESSIBILITÉ.
 *
 * Une maquette est une image : elle n'a pas de noms accessibles. Un lien qui ne
 * contient qu'une icône est muet au lecteur d'écran — axe-core le relève sous
 * `link-name`, et §10.6 exige « un nom accessible sur tout élément interactif ».
 *
 * Ces annotations n'existent pas dans le design parce qu'un design ne les
 * exprime pas. Les ajouter n'est donc pas réécrire la maquette : c'est lui
 * donner ce que le HTML doit porter en plus du pixel.
 */
/**
 * LA CIBLE TACTILE DE L'INTERRUPTEUR.
 *
 * `T1` §2.3 demande 44 px ; la maquette dessine une piste de 48 × 28. WCAG 2.5.8
 * (AA) est tenu avec ses 24 px, mais pas la règle du dossier — et c'est
 * l'interrupteur qui décide si le membre reçoit des demandes d'aide : le rater
 * du pouce n'est pas anodin.
 *
 * La cible passe à 44 px SANS déplacer un pixel :
 *   · `padding: 8px 0` en `content-box` porte la boîte à 28 + 16 = 44 px ;
 *   · `background-clip: content-box` ne peint que les 28 px du milieu, donc la
 *     piste garde exactement sa taille et ses extrémités arrondies ;
 *   · le curseur est positionné par rapport à la boîte de REMPLISSAGE : ses
 *     `top: 3px` deviennent 3 px sous le bord de la cible, plus les 8 px du
 *     remplissage — d'où le décalage à 11 px, sans quoi il sortirait de la piste.
 *
 * `box-sizing` est explicite : la préparation Tailwind met tout en `border-box`,
 * où `height: 28px` avec ce remplissage laisserait 12 px de contenu.
 */
const TOUCH_TARGET_ADAPTATIONS = [
  {
    why: 'La cible de l’interrupteur passe à 44 px, la piste garde ses 28 px.',
    match: (style) =>
      style.includes('width: "48px"') &&
      style.includes('height: "28px"') &&
      style.includes('borderRadius: "999px"') &&
      style.includes('padding: "0"'),
    apply: (style) =>
      style.replace(
        'padding: "0"',
        'padding: "8px 0", boxSizing: "content-box", backgroundClip: "content-box"',
      ),
  },
  {
    why: 'Le curseur suit le remplissage de la cible : 3 px deviennent 11 px.',
    match: (style) =>
      style.includes('top: "3px"') &&
      style.includes('left: helpKnob') &&
      style.includes('height: "22px"'),
    apply: (style) => style.replace('top: "3px"', 'top: "11px"'),
  },
];

const A11Y_ANNOTATIONS = [
  {
    why: 'Le lien de réglages du rail ne contient qu’une icône : il lui faut un nom.',
    match: (tag, attrs) =>
      tag === 'a' && attrs.includes('height: "48px"') && attrs.includes('color: "#CFE3DA"'),
    attrs: 'aria-label="Réglages"',
  },
  /**
   * LES PASTILLES DE COULEUR DE A14 — sept ronds de 34 px, et RIEN dedans.
   *
   * axe les signale en `critical` (`button-name`), et il a raison : un membre au
   * lecteur d'écran choisit le fond de sa story parmi sept boutons qui n'ont aucun
   * nom. C'est la violation d'accessibilité la plus nette de ce lot, et elle vient de
   * la maquette — une image n'a pas besoin de nommer ses couleurs.
   *
   * LE NOM EST LA TEINTE, `Fond #16785E`, et ce n'est pas le nom qu'on voudrait.
   * Il est honnête, c'est tout : la maquette ne donne que l'hexadécimal, `T2
   * textes-interface` ne nomme aucune de ces sept couleurs, et en inventer les noms
   * — « vert profond », « terre cuite » — serait décider d'un texte d'interface à la
   * place du porteur. Le jour où T2 les nomme, cette table changera d'une ligne.
   *
   * `aria-pressed` dit LAQUELLE est choisie : sans lui, la sélection n'existe que
   * dans l'anneau blanc, c'est-à-dire nulle part pour qui ne le voit pas.
   */
  {
    why: 'Les sept pastilles de couleur n’ont aucun texte : leur nom accessible est leur teinte.',
    match: (tag, attrs) =>
      tag === 'button' && attrs.includes('onClick={c.onPick}') && attrs.includes('background: c.hex'),
    attrs: 'aria-label={`Fond ${c.hex}`} aria-pressed={c.on}',
  },
];

/**
 * LES CHAMPS DESSINÉS DEVIENNENT DE VRAIS CHAMPS.
 *
 * La maquette dessine ses saisies en `<div>` portant un exemple — « 97 12 34 42 »
 * pour le téléphone. C'est juste pour une image ; dans l'application, rien ne
 * s'y tape et le lecteur d'écran n'y voit aucun champ.
 *
 * Le `<div>` devient donc un `<input>`, avec EXACTEMENT les mêmes styles en
 * ligne. L'exemple ne disparaît pas : il devient le `placeholder`, c'est-à-dire
 * ce qu'il était déjà — une indication de forme attendue.
 *
 * La table est indexée sur le TEXTE D'EXEMPLE, qui est visible dans la maquette
 * et donc vérifiable. Si la maquette le change, le générateur ne trouve plus le
 * champ et le dit, au lieu de produire un écran muet.
 */
const FIELD_ADAPTATIONS = [
  {
    screens: ['P01'],
    sample: '97 12 34 42',
    why: 'Le champ de téléphone devient saisissable.',
    attrs: [
      'type="tel"',
      'name="phone"',
      'inputMode="numeric"',
      // `autoComplete="tel-national"` : l'indicatif est choisi à part, le
      // navigateur ne doit donc pas proposer un numéro international complet.
      'autoComplete="tel-national"',
      'aria-label="Votre numéro de téléphone"',
      'value={phoneValue}',
      'onChange={onPhoneChange}',
    ],
  },
  {
    screens: ['O04'],
    // Le bloc dessiné contient AUSSI une pastille de disponibilité et une coche :
    // il reste donc le contenant, et seul l'exemple devient un champ.
    inline: true,
    // L'arobase reste en TEXTE : un membre ne la tape pas, et la mettre dans le
    // champ la ferait partir vers l'API — où `handleSchema` la refuse.
    prefix: '@',
    sample: '@amina.d',
    placeholder: 'amina.d',
    why: 'Le pseudo devient saisissable.',
    attrs: [
      'type="text"',
      'name="handle"',
      // Le pseudo n'est ni un nom d'usage ni un identifiant que le navigateur
      // connaît : `off` évite qu'il propose un email ou un nom complet.
      'autoComplete="off"',
      'aria-label="Votre pseudo"',
      'value={handleValue}',
      'onChange={onHandleChange}',
    ],
  },
  {
    screens: ['O04'],
    sample: 'Amina Diallo',
    why: 'Le nom d’affichage devient saisissable.',
    attrs: [
      'type="text"',
      'name="displayName"',
      'autoComplete="name"',
      'aria-label="Votre nom d’affichage"',
      'value={displayNameValue}',
      'onChange={onDisplayNameChange}',
    ],
  },
];

/**
 * LES MENUS DESSINÉS DEVIENNENT DE VRAIS MENUS.
 *
 * La maquette dessine ses sélecteurs — fond, chevron, valeur — mais n'en montre
 * qu'une seule : « +229 » et « Bénin » sont des textes littéraux, et le drapeau
 * un dégradé béninois.
 *
 * Un menu NATIF transparent est posé par-dessus, à la taille du bloc dessiné.
 * C'est la solution la moins inventive : elle ne dessine aucune liste, ne choisit
 * aucune présentation, et donne pourtant un contrôle réel, au clavier comme au
 * pouce. Le chevron dessiné tient enfin sa promesse.
 *
 * Le DRAPEAU disparaît dès que le pays choisi n'est plus celui que la maquette a
 * dessiné. Afficher un drapeau béninois à côté d'un « +33 » serait un défaut que
 * n'importe qui remarque ; en inventer d'autres serait dessiner à la place du
 * porteur. Ne rien montrer est le seul choix honnête tant que les drapeaux ne
 * sont pas fournis.
 */
const BENIN_FLAG = 'background: "linear-gradient(90deg,#16785E 33%,#F2C94C 33% 66%,#E0733A 66%)"';

const DRAWN_SELECTS = [
  {
    screens: ['P01'],
    literal: '+229',
    label: 'Indicatif du pays',
    value: 'dialCode',
    selected: 'countryIso2',
    onChange: 'onCountryChange',
    options: 'countryOptions',
    flag: 'flagDisplay',
    optionLabel: '{c.nameFr} {c.dialCode}',
    why: 'Le sélecteur d’indicatif devient un menu natif, le drapeau suit le choix.',
  },
  {
    screens: ['O02'],
    literal: 'Bénin',
    label: 'Pays d’origine',
    value: 'originName',
    selected: 'originIso2',
    onChange: 'onOriginChange',
    options: 'originOptions',
    flag: 'originFlagDisplay',
    optionLabel: '{c.nameFr}',
    why: 'Le sélecteur de pays d’origine devient un menu natif.',
  },
];

function applyDrawnSelect(jsx, spec) {
  const provides = [spec.value, spec.selected, spec.onChange, spec.options, spec.flag];

  // Le bloc dessiné : un div dont le contenu porte la valeur littérale et aucun
  // div imbriqué. Les cadres n'ont pas le même contenu — le mobile de P01 n'a ni
  // drapeau ni chevron — d'où la capture du contenu tel quel.
  const pattern = new RegExp(
    `<div (style=\\{\\{ [^}]* \\}\\})>((?:(?!<div)[\\s\\S])*?${spec.literal.replace('+', '\\+')}(?:(?!<div)[\\s\\S])*?)<\\/div>`,
  );
  const m = pattern.exec(jsx);
  if (m === null) return { jsx, applied: false, provides };

  const style = m[1].replace('style={{ ', 'style={{ position: "relative", ');
  const content = m[2]
    .replace(spec.literal, `{${spec.value}}`)
    // Le drapeau ne s'affiche que pour le pays dessiné.
    .replace(BENIN_FLAG, `${BENIN_FLAG}, display: ${spec.flag}`);

  const select =
    `<select value={${spec.selected}} onChange={${spec.onChange}} aria-label="${spec.label}" ` +
    'style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", ' +
    'opacity: 0, cursor: "pointer", font: "inherit", border: "none", appearance: "none" }}>' +
    `{(${spec.options} ?? []).map((c) => (<option key={c.iso2} value={c.iso2}>${spec.optionLabel}</option>))}` +
    '</select>';

  return {
    jsx: `${jsx.slice(0, m.index)}<div ${style}>${content}${select}</div>${jsx.slice(m.index + m[0].length)}`,
    applied: true,
    provides,
  };
}

/**
 * LA RECHERCHE DE VILLE.
 *
 * La maquette dessine un champ contenant une loupe et « Ly » — une saisie en
 * cours. Le `<div>` reste le contenant, pour garder l'icône, et le texte devient
 * un `<input>` transparent qui occupe la place restante.
 */
const CITY_SEARCH = {
  // BORNÉ à O02. La loupe de la maquette a le même tracé que celle du fil : sans
  // cette borne, la barre de recherche de A01 devenait un champ « Votre ville ».
  // C'est le genre de dérive qu'un motif trop large produit en silence.
  screens: ['O02'],
  why: 'La recherche de ville devient saisissable.',
  provides: ['citySearch', 'onCitySearch'],
  apply(jsx) {
    /**
     * DEUX formes, parce que les deux cadres diffèrent : celui d'ordinateur met
     * une loupe devant le texte, celui de mobile n'en met pas. Un seul motif
     * laissait le champ mobile en `<div>` — saisie impossible, et rien pour le
     * signaler. C'est pourquoi une adaptation attendue qui ne s'applique pas est
     * désormais un avertissement.
     */
    const patterns = [
      // Avec loupe : le texte suit l'icône.
      /(<div style=\{\{ [^}]*\}\}>(?:(?!<div)[\s\S])*?m20 20-3\.5-3\.5(?:(?!<div)[\s\S])*?<\/svg>)([^<]*)<\/div>/,
      // Sans loupe : le div ne contient que l'exemple de saisie.
      /(<div style=\{\{ [^}]*\}\}>)(Ly)<\/div>/,
    ];

    let m = null;
    for (const pattern of patterns) {
      m = pattern.exec(jsx);
      if (m !== null) break;
    }
    if (m === null) return { jsx, applied: false };

    const field =
      '<input value={citySearch} onChange={onCitySearch} placeholder="Votre ville" ' +
      'aria-label="Votre ville" autoComplete="address-level2" ' +
      'style={{ flex: "1", minWidth: "0", border: "none", background: "transparent", ' +
      'font: "inherit", color: "inherit", outline: "none", padding: 0 }} />';

    return {
      jsx: `${jsx.slice(0, m.index)}${m[1]}${field}</div>${jsx.slice(m.index + m[0].length)}`,
      applied: true,
    };
  },
};

/**
 * LES LIGNES DE RÉSULTAT DEVIENNENT DES BOUTONS.
 *
 * La maquette les dessine en `<div>` — alors qu'elle emploie bien `<button>` pour
 * les cartes de phase de O01. L'incohérence est la sienne ; ici on tranche pour
 * le bouton, parce qu'une ligne qu'on clique doit être atteignable au clavier et
 * annoncée comme actionnable.
 *
 * `textAlign: "left"` et `font: "inherit"` annulent ce qu'un `<button>` impose de
 * lui-même : sans eux, le texte se centrerait et changerait de police.
 */
const CITY_ROWS = {
  screens: ['O02'],
  why: 'Les villes proposées deviennent des boutons, atteignables au clavier.',
  provides: [],
  apply(jsx) {
    const pattern = /<div (style=\{\{ [^}]*background: c\.bg[^}]* \}\})>([\s\S]*?)<\/div>/;
    const m = pattern.exec(jsx);
    if (m === null) return { jsx, applied: false };

    const style = m[1].replace(
      ' }}',
      ', border: "none", font: "inherit", textAlign: "left", cursor: "pointer", width: "100%" }}',
    );
    return {
      jsx: `${jsx.slice(0, m.index)}<button type="button" onClick={c.onPick} ${style}>${m[2]}</button>${jsx.slice(m.index + m[0].length)}`,
      applied: true,
    };
  },
};

/**
 * LA CASE DE CONSENTEMENT DEVIENT UNE VRAIE CASE.
 *
 * La maquette la dessine COCHÉE, en `<span>`. Deux problèmes, et le second est
 * juridique :
 *
 *   · un `<span>` ne se décoche pas et n'est pas annoncé comme une case ;
 *   · une case **pré-cochée n'est pas un consentement valide**. L'état que la
 *     maquette montre est une illustration, pas un défaut — et le reprendre tel
 *     quel rendrait la preuve RGPD inutilisable.
 *
 * La cible passe à 44 px (`T1` §2.3) par la même mécanique que l'interrupteur :
 * remplissage en `content-box` et peinture bornée au contenu, pour que la case
 * garde ses 22 px dessinés.
 */
const CONSENT_CHECKBOX = {
  screens: ['P01'],
  why: 'La case de consentement devient une vraie case, décochée par défaut.',
  provides: ['consentAccepted', 'consentBg', 'consentBorder', 'consentCheck', 'onToggleConsent'],
  apply(jsx) {
    const pattern =
      /<span style=\{\{ width: "22px", height: "22px", borderRadius: "7px", background: "#16785E"([^<]*?)\}\}>([\s\S]*?)<\/span>/;
    const m = pattern.exec(jsx);
    if (m === null) return { jsx, applied: false };

    const inner = m[2].replace('stroke="#fff"', 'stroke={consentCheck}');

    /**
     * Le style est recomposé par MORCEAUX joints d'une virgule, et non concaténé.
     * Deux tentatives de concaténation ont échoué en sens inverse — une virgule
     * en trop, puis une virgule manquante — parce que le reste du style capturé
     * commence par une virgule mais n'en finit pas par une. Joindre des morceaux
     * nettoyés ne laisse pas de place à cette erreur.
     */
    const rest = m[1]
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part.length > 0);

    const style = [
      'width: "22px"',
      'height: "22px"',
      'borderRadius: "7px"',
      'background: consentBg',
      'border: consentBorder',
      ...rest,
      // La cible passe à 44 px sans que la case peinte change de taille.
      'padding: "11px"',
      'boxSizing: "content-box"',
      'backgroundClip: "content-box"',
      'cursor: "pointer"',
    ].join(', ');

    const box =
      '<button type="button" role="checkbox" aria-checked={consentAccepted} ' +
      'onClick={onToggleConsent} aria-label="J’accepte les conditions d’utilisation et la politique de confidentialité" ' +
      `style={{ ${style} }}>${inner}</button>`;

    return { jsx: jsx.slice(0, m.index) + box + jsx.slice(m.index + m[0].length), applied: true };
  },
};

/**
 * LES PASTILLES DE CHOIX DEVIENNENT DES BOUTONS.
 *
 * La maquette les dessine en `<span>` — statut d'occupation, types d'aide — et
 * leur donne bien un fond « actif », donc elles SONT des choix. Un `<span>` n'est
 * ni atteignable au clavier ni annoncé comme actionnable : un membre au lecteur
 * d'écran ne peut pas remplir son profil.
 *
 * `aria-pressed` plutôt que `role="checkbox"` : ce sont des bascules de filtre,
 * et c'est l'attribut que les lecteurs d'écran annoncent le plus clairement pour
 * une pastille qui reste ou non enfoncée.
 */
const CHIP_ROWS = [
  { screens: ['O04'], list: 'statuses', item: 's', why: 'Les statuts deviennent sélectionnables.' },
  { screens: ['O04'], list: 'helpTypes', item: 'h', why: 'Les types d’aide deviennent sélectionnables.' },
];

function applyChipRow(jsx, spec) {
  /**
   * `[^<]*?` — ni `[^}]*`, ni `[\s\S]*?`.
   *
   * Pas `[^}]*` : le style de la pastille contient un gabarit,
   * `` border: `1px solid ${s.bd}` ``, donc des accolades ; une classe qui les
   * exclut s'arrête dessus et le motif ne colle jamais.
   *
   * Pas `[\s\S]*?` non plus, et c'est le piège : même paresseux, il TRAVERSE les
   * balises. Le motif partait d'un `<span` bien plus haut, sautait jusqu'au
   * `background: s.bg` de la vraie pastille, et engloutissait au passage la
   * flèche de retour et les six segments de progression — qui devenaient des
   * boutons mal fermés. Le JSX produit ne compilait plus, ce qui était une
   * chance : un motif trop large qui compile est bien plus difficile à voir.
   *
   * Un attribut `style` ne contient jamais de `<` : l'exclure borne le motif à
   * une seule balise, tout en laissant passer les accolades du gabarit.
   */
  const pattern = new RegExp(
    `<span (style=\\{\\{ [^<]*?background: ${spec.item}\\.bg[^<]*?\\}\\})>\\{${spec.item}\\.label\\}</span>`,
  );
  const m = pattern.exec(jsx);
  if (m === null) return { jsx, applied: false };

  // `font: "inherit"` et `cursor` annulent ce qu'un `<button>` impose de
  // lui-même : sans eux la pastille changerait de police et perdrait sa main.
  const style = m[1].replace(
    ' }}',
    ', font: "inherit", cursor: "pointer", lineHeight: "normal" }}',
  );
  const button =
    `<button type="button" onClick={${spec.item}.onPick} aria-pressed={${spec.item}.on} ${style}>` +
    `{${spec.item}.label}</button>`;

  return {
    jsx: `${jsx.slice(0, m.index)}${button}${jsx.slice(m.index + m[0].length)}`,
    applied: true,
  };
}

/**
 * LES BOUTONS DESSINÉS REÇOIVENT LEUR ACTION.
 *
 * La maquette dessine ses boutons sans comportement — c'est une image. La table
 * est indexée sur le LIBELLÉ VISIBLE, qui vient d'elle et se relit d'un coup
 * d'œil.
 *
 * `disabled` autant que `onClick` : un bouton d'envoi qu'on peut cliquer deux
 * fois envoie deux SMS, et c'est le membre qui les paie en délai d'attente — la
 * limite de trois par heure se consomme à la deuxième pression.
 *
 * P02 n'a volontairement aucun bouton : le code se vérifie dès le sixième
 * chiffre saisi. C'est ce que la maquette montre, et c'est le bon comportement.
 */
/**
 * CHAQUE ENTRÉE EST BORNÉE À SES ÉCRANS, et ça n'était pas le cas.
 *
 * La table était indexée sur le SEUL libellé visible, sans borne. Tant qu'il n'y
 * avait que l'onboarding, cela suffisait. Dès que la maquette du fil est arrivée, le
 * « Continuer » de l'assistant de story (A14, étape 2) a reçu `onClick={onContinue}`
 * et `disabled={busy}` — deux propriétés de l'inscription, qui n'ont aucun sens là,
 * et que le composant s'est mis à exiger de son jeu de données.
 *
 * Le défaut était SILENCIEUX au transcodage : le journal disait « Bouton “Continuer”
 * branché », ce qui ressemblait à une bonne nouvelle. Il ne s'est vu qu'à la
 * compilation du composant, et seulement parce que `AccueilData` ne porte pas ces
 * champs. Avec un jeu de données plus large, il serait passé.
 *
 * C'est la même leçon que `CITY_SEARCH` a déjà apprise à ce fichier : « c'est le
 * genre de dérive qu'un motif trop large produit en silence ».
 */
const BUTTON_ACTIONS = [
  { screens: ['P01'], label: 'Recevoir le code', attrs: ['onClick={onSubmit}', 'disabled={busy}'] },
  {
    screens: ['O01', 'O02', 'O03', 'O04'],
    label: 'Continuer',
    attrs: ['onClick={onContinue}', 'disabled={busy}'],
  },
  /**
   * Le « Continuer » de A14 fait passer à l'étape suivante, et rien d'autre : pas
   * d'appel réseau, donc pas de `disabled`. Un bouton désactivé pendant une seconde
   * pour une transition locale serait un mensonge sur ce qui se passe.
   */
  { screens: ['A14'], label: 'Continuer', attrs: ['onClick={onContinue}'] },

  /**
   * Le « Continuer » de J02 fait passer à l'étape suivante du choix de parcours :
   * pas d'appel réseau, donc pas de `disabled`. Il était branché par l'entrée de
   * l'onboarding, SANS bornage — juste par chance, et c'est exactement ce que le
   * bornage par écran existe pour empêcher.
   */
  { screens: ['J02'], label: 'Continuer', attrs: ['onClick={onContinue}'] },

  /**
   * LES TROIS VOLETS DE « JE SUIS BLOQUÉ·E » (03 §3.5).
   *
   * « Flux en quatre temps, sans jamais publier automatiquement » — et la règle
   * dure : « l'objet cible n'est créé qu'à l'appel explicite de la route de
   * publication ». Le bouton « Publier » n'existe QUE sur le troisième volet de
   * la maquette ; c'est ce qui rend la règle vérifiable à l'écran, et c'est ce
   * qu'éprouve `e2e/parcours-bloque.spec.ts`.
   */
  { screens: ['J03'], label: 'Suivant', attrs: ['onClick={onNext}'] },
  { screens: ['J03'], label: 'Voir l’aperçu', attrs: ['onClick={onNext}'] },
  { screens: ['J03'], label: 'Retour', attrs: ['onClick={onBack}'] },
  // « Annuler » → `CANCELLED` (§3.5). Côté écran, cela referme la feuille.
  { screens: ['J03'], label: 'Annuler', attrs: ['onClick={onCancel}'] },

  /**
   * « Publier » N'EST BRANCHÉ NULLE PART, et c'est délibéré.
   *
   * §3.5, règle dure : « l'objet cible n'est créé qu'à l'appel explicite de la
   * route de publication, avec le texte tel que renvoyé par le client ». Ce lot
   * ne branche aucune route — comme le composeur du fil, dont « Publier » est
   * inerte lui aussi. Un `onClick` qui refermerait la feuille ferait CROIRE au
   * membre qu'il a publié : c'est pire qu'un bouton inerte, et c'est exactement
   * ce que la règle dure cherche à empêcher.
   */


  /** §3.6 — « Publier / Plus tard » sur le partage de jalon. */
  { screens: ['J04'], label: 'Plus tard', attrs: ['onClick={onCancel}'] },
];

/**
 * Branche les boutons. Ne touche JAMAIS un bouton qui a déjà un `onClick` :
 * « Créer mon parcours maintenant » porte celui de la maquette, et l'écraser
 * casserait l'interrupteur de l'écran O03.
 */
/** `’` et les autres caractères réservés d'une expression régulière. */
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function adaptButtons(jsx, section) {
  const applied = [];
  let out = jsx;

  for (const action of BUTTON_ACTIONS) {
    if (!action.screens.includes(section)) continue;
    /**
     * Le libellé est ÉCHAPPÉ avant d'entrer dans l'expression régulière : la
     * maquette écrit « Voir l’aperçu » avec une apostrophe typographique, et
     * d'autres libellés portent des parenthèses. Sans échappement, le motif ne
     * correspond à rien — et le journal dit simplement que le bouton n'a pas été
     * branché, ce qui ressemble à une absence plutôt qu'à une erreur.
     */
    const pattern = new RegExp(`<button((?:(?!onClick)[^>])*?)>(\\s*)${escapeRe(action.label)}</button>`);
    const m = pattern.exec(out);
    if (m === null) continue;
    out =
      out.slice(0, m.index) +
      `<button${m[1]} ${action.attrs.join(' ')}>${m[2]}${action.label}</button>` +
      out.slice(m.index + m[0].length);
    applied.push(action);
  }

  return { jsx: out, applied };
}

/**
 * Remplace les champs dessinés. Travaille sur le JSX complet, et non balise par
 * balise, parce qu'il faut voir le CONTENU du `<div>` pour le reconnaître.
 */
function adaptFields(jsx, section) {
  const applied = [];
  const missed = [];

  let out = jsx;

  for (const spec of ICON_BUTTON_NAMES) {
    if (!spec.screens.includes(section)) continue;
    const result = applyIconButtonName(out, spec, section);
    if (!result.applied) continue;
    out = result.jsx;
    applied.push({ why: spec.why, provides: [] });
  }

  for (const spec of DRAWN_SELECTS) {
    if (!spec.screens.includes(section)) continue;
    const result = applyDrawnSelect(out, spec);
    if (!result.applied) continue;
    out = result.jsx;
    applied.push({ why: spec.why, provides: result.provides });
  }

  for (const spec of CHIP_ROWS) {
    if (!spec.screens.includes(section)) continue;
    const result = applyChipRow(out, spec);
    if (!result.applied) {
      missed.push(spec.why);
      continue;
    }
    out = result.jsx;
    applied.push(spec);
  }

  for (const transform of [CITY_SEARCH, CITY_ROWS, CONSENT_CHECKBOX]) {
    if (!transform.screens.includes(section)) continue;
    const result = transform.apply(out);
    if (!result.applied) {
      // Attendue sur cet écran mais introuvable : c'est un motif qui a cessé de
      // coller, pas un cadre qui n'en a pas besoin. Le dire évite un écran muet
      // qui compile parfaitement.
      missed.push(transform.why);
      continue;
    }
    out = result.jsx;
    applied.push(transform);
  }

  for (const field of FIELD_ADAPTATIONS) {
    if (!field.screens.includes(section)) continue;

    const placeholder = field.placeholder ?? field.sample;
    const escaped = field.sample.replace(/ /g, '\\s').replace('@', '@').replace('+', '\\+');

    if (field.inline === true) {
      // Le bloc dessiné porte d'autres éléments : on ne remplace que l'exemple,
      // et le champ occupe la place restante.
      const pattern = new RegExp(escaped);
      const m = pattern.exec(out);
      if (m === null) {
        missed.push(field.why);
        continue;
      }
      const inline =
        `${field.prefix ?? ''}<input placeholder="${placeholder}" ${field.attrs.join(' ')} ` +
        'style={{ flex: "1", minWidth: "0", border: "none", background: "transparent", ' +
        'font: "inherit", color: "inherit", outline: "none", padding: 0 }} />';
      out = out.slice(0, m.index) + inline + out.slice(m.index + m[0].length);
      applied.push(field);
      continue;
    }

    const pattern = new RegExp(`<div (style=\\{\\{ [^}]* \\}\\})[^>]*>${escaped}</div>`);
    const m = pattern.exec(out);
    if (m === null) {
      // Attendue sur cet écran mais introuvable : un exemple qui a changé dans la
      // maquette, et un champ qui resterait muet sans que rien ne le dise.
      missed.push(field.why);
      continue;
    }
    out =
      out.slice(0, m.index) +
      `<input ${m[1]} placeholder="${placeholder}" ${field.attrs.join(' ')} />` +
      out.slice(m.index + m[0].length);
    applied.push(field);
  }

  return { jsx: out, applied, missed };
}

/**
 * UN BOUTON QUI NE CONTIENT QU'UNE ICÔNE REÇOIT SON NOM.
 *
 * La maquette dessine certains boutons SANS AUCUN TEXTE — le « ··· » du profil
 * d'un membre (K02) n'a qu'un tracé SVG à trois points. C'est juste pour une
 * image ; dans l'application, c'est un bouton muet au lecteur d'écran, et axe le
 * relève en `critical` (`button-name`). §10.6 exige « un nom accessible sur tout
 * élément interactif ».
 *
 * `markTriggers` sait déjà nommer les boutons QU'IL CRÉE (`label`). Ceux-ci
 * existaient déjà en `<button>` dans la maquette : ils ne passent par aucun
 * déclencheur, donc rien ne les voyait.
 *
 * LE NOM EST RECOPIÉ DE LA MAQUETTE, jamais inventé : elle écrit « Menu ··· :
 * Bloquer · Signaler » en légende sous la carte, donc le contrôle s'appelle
 * « Menu ». C'est la même honnêteté que `Fond ${c.hex}` pour les pastilles de
 * couleur d'A14 — un nom mécanique vaut mieux qu'un nom décidé à la place du
 * porteur, et le jour où `T2 textes-interface` le nomme, cette table change d'une
 * ligne.
 *
 * `source` est la phrase de la maquette d'où le nom vient : le générateur refuse
 * de produire si elle en a disparu, comme pour les libellés d'`INTERACTIVE_ROLES`.
 * Sans cela, le nom accessible dériverait en silence.
 *
 * BORNÉ PAR ÉCRAN, comme tout le reste de ce fichier : un tracé SVG est un motif
 * très large, et « trois points alignés » sert ailleurs de poignée de
 * réordonnancement.
 */
const ICON_BUTTON_NAMES = [
  {
    screens: ['K02'],
    path: 'M5 12h.01M12 12h.01M19 12h.01',
    label: 'Menu',
    source: 'Menu ··· : Bloquer · Signaler',
    why: 'Le bouton « ··· » ne contient qu’une icône : son nom est celui que la maquette lui donne en légende.',
  },
  /**
   * LE DRAPEAU D'ALERTE DE S05 — le seul bouton muet de `06 Services`.
   *
   * Le cadre d'ordinateur de l'offre d'emploi range trois boutons sur une ligne :
   * « Postuler sur le site », « Recommander un membre », et un TROISIÈME qui n'a
   * que le tracé d'un drapeau. La place manquait pour son libellé, et la maquette
   * l'a laissé tomber — ce qui est sans conséquence sur une image, et `critical`
   * dans une application (`button-name`).
   *
   * LE NOM N'EST PAS INVENTÉ : la maquette écrit elle-même « Signaler » à côté du
   * MÊME tracé, deux fois — sur la fiche d'annonce (S02) et sur la fiche pro
   * (S07). C'est son mot, pas le nôtre.
   *
   * BORNÉ À S05, comme tout le reste de cette table. Le tracé se trouve sur
   * quatre cadres de cette maquette ; sur les trois autres il est dans un bouton
   * qui porte déjà son texte, ou dans un `<span>` qui n'est pas un bouton —
   * `applyIconButtonName` les laisse donc tranquilles de toute façon, mais s'en
   * remettre à cela serait compter sur un hasard plutôt que sur une borne.
   */
  {
    screens: ['S05'],
    path: 'M5 21V4h12l-2 4 2 4H5',
    label: 'Signaler',
    source: 'Signaler',
    why: 'Le bouton drapeau de S05 ne contient qu’une icône : son nom est celui que la maquette écrit à côté du même tracé.',
  },
];

function applyIconButtonName(jsx, spec, section) {
  if (!jsx.includes(spec.path)) return { jsx, applied: false };

  const pattern = /<button((?:(?!aria-label)[^>])*?)>((?:(?!<button)[\s\S])*?)<\/button>/g;
  let m;
  while ((m = pattern.exec(jsx)) !== null) {
    if (!m[2].includes(spec.path)) continue;
    // Le bouton porte-t-il déjà du texte ? S'il en a, il a un nom et on n'y touche pas.
    if (m[2].replace(/<[^>]*>/g, '').trim() !== '') continue;
    return {
      jsx:
        jsx.slice(0, m.index) +
        `<button aria-label="${spec.label}"${m[1]}>${m[2]}</button>` +
        jsx.slice(m.index + m[0].length),
      applied: true,
    };
  }
  // Le tracé est là mais pas dans un bouton muet : rien à nommer sur ce cadre.
  return { jsx, applied: false, section };
}

/**
 * RÔLES ET ÉTATS DES CONTRÔLES.
 *
 * La maquette DESSINE ses interrupteurs et ses cases à cocher — un `<button>`
 * contenant une pastille positionnée. Visuellement c'est juste ; pour un lecteur
 * d'écran c'est un bouton sans nom, dont l'état ne s'annonce pas. axe le signale
 * en `critical` (`button-name`), et il a raison : l'interrupteur de disponibilité
 * décide si le membre reçoit des demandes d'aide.
 *
 * La table est indexée sur le NOM DU GESTIONNAIRE, qui est stable et vient de la
 * maquette. Les libellés sont recopiés du texte visible à côté du contrôle : rien
 * n'est inventé, et si la maquette change son libellé, le garde-fou ci-dessous
 * refuse de générer plutôt que de laisser dériver le nom accessible.
 */
const INTERACTIVE_ROLES = [
  {
    handler: 'toggleHelp',
    role: 'switch',
    checked: 'help',
    // Texte de la maquette, dans le span frère immédiat.
    label: 'Je suis disponible pour aider',
    why: 'L’interrupteur de disponibilité annonce son nom et son état.',
  },
  {
    handler: 'toggleCreate',
    role: 'checkbox',
    checked: 'create',
    // Pas de `label` : ce bouton contient déjà son propre texte, et un
    // `aria-label` le REMPLACERAIT — on perdrait le détail qu'il affiche.
    why: 'La case « créer le parcours » annonce son état.',
  },
];

/**
 * Applique les adaptations et compte celles qui ont servi.
 *
 * Travaille sur la BALISE OUVRANTE, pas seulement sur le style : certaines
 * adaptations doivent aussi ajouter un attribut — une zone défilable a besoin
 * de `tabIndex` pour être atteignable au clavier.
 */
/**
 * Le titre principal du cadre passe de `<h2>` à `<h1>`.
 *
 * La maquette écrit ses titres d'écran en `<h2>` — elle en met plusieurs par
 * page de documentation, et un `<h1>` par section n'aurait pas de sens dans ce
 * contexte. Dans l'application, chaque cadre EST une page, et il lui faut son
 * `h1` : sans lui, un lecteur d'écran ne sait pas de quoi la page parle, et axe
 * le signale (`page-has-heading-one`).
 *
 * Aucun effet visuel : taille, graisse et `margin: 0` sont tous en ligne dans la
 * maquette, et un `h1` ne les surcharge pas. Seul le PREMIER est promu, pour ne
 * pas casser l'ordre des titres.
 */
/**
 * UN CADRE QUI A DÉJÀ SON `<h1>` NE SE FAIT PAS PROMOUVOIR UN SECOND.
 *
 * A04 — la lecture d'un guide — écrit bien un `<h1>` dans la maquette : le titre du
 * guide, en 30 px. Ses `<h2>` sont les SECTIONS du guide (« 1. Vérifier votre
 * éligibilité », « 2. Transmettre au propriétaire »). Sans cette garde, la première
 * de ces sections devenait un second `<h1>` : la page annonçait deux sujets, et le
 * plan de lecture sautait de h1 à h1 puis retombait — `page-has-heading-one` était
 * satisfait, mais `heading-order` et le sens l'étaient moins.
 *
 * Le défaut aurait été INVISIBLE à l'œil : les deux balises portent leur taille en
 * ligne, donc rien ne bouge d'un pixel. Il ne se voit qu'à l'arbre d'accessibilité.
 */
function promoteFirstHeading(jsx) {
  if (/<h1[\s>]/.test(jsx)) return { jsx, promoted: true, alreadyThere: true };

  const i = jsx.indexOf('<h2');
  if (i === -1) return { jsx, promoted: false };
  const close = jsx.indexOf('</h2>', i);
  if (close === -1) return { jsx, promoted: false };

  const promoted =
    `${jsx.slice(0, i)}<h1${jsx.slice(i + 3, close)}</h1>${jsx.slice(close + 5)}`;
  return { jsx: promoted, promoted: true };
}

const ALL_ADAPTATIONS = [...FRAME_ADAPTATIONS, ...TOUCH_TARGET_ADAPTATIONS];

/**
 * ─── L'EMPRUNT : ce qu'une planche ne dessine pas, et qu'une AUTRE dessine ───
 *
 * Trois planches manquent à `09 Messages et transverse.dc.html`, et le porteur a
 * été formel : ON NE RÉÉCRIT PAS LES MAQUETTES. La seule sortie honnête est celle
 * que `MODAL_WINDOW_SOURCE` a déjà ouverte pour le voile — EMPRUNTER, mot pour
 * mot, à une planche qui dessine déjà l'objet, et le DIRE.
 *
 * Un emprunt se déclare avec l'écran, dans `tools/screens/*.mjs`, et porte :
 *
 *   · `from`     — la maquette où le motif est DESSINÉ. C'est elle que le journal
 *                  nommera. Le journal de ce dépôt a déjà menti une fois sur la
 *                  provenance d'un voile ; cette clé existe pour que la provenance
 *                  ne puisse plus être devinée.
 *   · `patterns` — les fragments empruntés, VERBATIM. Le générateur refuse de
 *                  produire si l'un d'eux a disparu de `from`. C'est le garde-fou,
 *                  et c'est exactement celui du voile : « un emprunt silencieusement
 *                  devenu vide est pire que pas d'emprunt ».
 *                  Un fragment peut venir d'une AUTRE maquette que `from` : il
 *                  s'écrit alors `{ from: '…', pattern: '…' }`, et c'est CETTE
 *                  maquette-là que le journal nommera pour lui. Un emprunt qui
 *                  assemble deux sources se lit donc comme tel, au lieu de passer
 *                  pour un seul objet.
 *   · `anchor`   — le fragment de la planche d'ACCUEIL que l'emprunt remplace. Il
 *                  doit s'y trouver EXACTEMENT UNE FOIS, sinon on ne sait pas où
 *                  l'emprunt atterrit.
 *   · `into`     — le remplacement.
 *   · `texte`    — LE TEXTE QUI NE VIENT D'AUCUNE MAQUETTE, déclaré comme tel.
 *   · `why`      — la phrase du journal.
 *
 * ET LA RÈGLE QUI REND L'EMPRUNT VÉRIFIABLE : `into` moins `anchor`, moins les
 * `patterns`, moins le `texte` déclaré doit être VIDE. Autrement dit, le
 * remplacement n'est fait QUE de l'ancre, de ce qui a été emprunté et de ce qui a
 * été DÉCLARÉ comme non emprunté — pas un pixel, pas un mot, pas un style de plus.
 * Sans ce contrôle, « emprunter » redeviendrait « dessiner un peu », et le peu ne
 * se relit jamais.
 *
 * POURQUOI `texte` EXISTE, et pourquoi ce n'est pas une porte dérobée.
 *
 * Une maquette peut manquer d'un ÉTAT sans manquer d'une FORME : la conversation
 * avec un membre bloqué n'est dessinée nulle part, mais le bandeau qui remplace le
 * composeur l'est (« DEMANDE EN ATTENTE », section M01) et le bouton « Débloquer »
 * l'est aussi (`08 Compte`, carte « BLOQUÉS »). Il ne manquait que la PHRASE — et
 * une phrase ne s'emprunte pas : celle de la demande en attente ne parle pas d'un
 * blocage, et en écrire une autre serait inventer du texte.
 *
 * Le porteur l'a donc fournie. La faire passer pour un `pattern` serait un
 * mensonge — le garde-fou la chercherait dans une maquette où elle n'est pas, et
 * il faudrait l'y écrire pour que la génération passe. `texte` dit la vérité à sa
 * place : ce fragment vient d'une personne, pas d'une planche, et le journal le
 * signale à CHAQUE exécution, avec un ⚠. Ce qui n'y est pas déclaré reste refusé.
 *
 * SANS `anchor` NI `into`, l'emprunt est un TÉMOIN : il ne transforme rien, il
 * vérifie seulement que le motif est toujours dessiné là où on l'a dit. C'est la
 * forme que prend le garde-fou d'un emprunt fait ailleurs — le voile de repli, par
 * exemple, que `adaptModalFrame` pose sans passer par ici.
 */
const SOURCES_EMPRUNTEES = new Map();
const lireSourceEmpruntee = (file) => {
  const deja = SOURCES_EMPRUNTEES.get(file);
  if (deja !== undefined) return deja;
  const lu = readFileSync(resolve(ROOT, file), 'utf8');
  SOURCES_EMPRUNTEES.set(file, lu);
  return lu;
};

function applyBorrows(inner, borrows, section) {
  let out = inner;
  const applied = [];

  for (const borrow of borrows ?? []) {
    /**
     * Un motif dit d'où il vient quand ce n'est pas de `from` — même discipline que
     * `frame.section`, qui dit d'où vient un cadre quand ce n'est pas de la section
     * de son écran.
     */
    const motifs = borrow.patterns.map((p) =>
      typeof p === 'string' ? { from: borrow.from, pattern: p } : p,
    );

    // LE GARDE-FOU, sur le modèle de celui du voile : le motif doit être encore
    // dessiné dans la maquette d'où on le tire, sinon on refuse de produire.
    for (const motif of motifs) {
      if (lireSourceEmpruntee(motif.from).includes(motif.pattern)) continue;
      throw new Error(
        `${section} : le motif emprunté « ${motif.pattern.slice(0, 80)}… » ne figure plus dans ` +
          `${motif.from}. Mettre l’emprunt à jour dans sa déclaration d’écran.`,
      );
    }

    // Un témoin ne transforme rien : il a fait son travail en ne levant pas.
    if (borrow.anchor === undefined) {
      applied.push({ ...borrow, motifs, temoin: true });
      continue;
    }

    const occurrences = out.split(borrow.anchor).length - 1;
    if (occurrences !== 1) {
      throw new Error(
        `${section} : l’ancre de l’emprunt « ${borrow.anchor.slice(0, 80)}… » figure ` +
          `${occurrences} fois dans le cadre ; il en faut exactement une.`,
      );
    }

    /**
     * RIEN D'INVENTÉ : ce qui reste de `into` quand on en retire l'ancre, chaque
     * motif emprunté et chaque texte DÉCLARÉ non emprunté doit être la chaîne vide.
     *
     * Le texte déclaré est retiré EN DERNIER, exprès : s'il figurait par hasard
     * dans un motif, c'est le motif qui compte, et la déclaration deviendrait
     * inutile — le journal cesserait alors de la signaler, ce qui serait le pire
     * des deux mondes.
     */
    let residu = borrow.into.replace(borrow.anchor, '');
    for (const motif of motifs) residu = residu.replace(motif.pattern, '');
    for (const phrase of borrow.texte ?? []) residu = residu.replace(phrase, '');
    if (residu !== '') {
      throw new Error(
        `${section} : l’emprunt ajoute du dessin qui n’est emprunté à personne — ` +
          `« ${residu.slice(0, 120)} ». Un emprunt est fait de l’ancre, des motifs et du texte ` +
          'DÉCLARÉ (« texte »), et de rien d’autre.',
      );
    }

    out = out.replace(borrow.anchor, borrow.into);
    applied.push({ ...borrow, motifs, temoin: false });
  }

  return { html: out, applied };
}

/**
 * ─── `donnees` : LA PRISE OÙ BRANCHER L'API SUR UNE MAQUETTE STATIQUE ────────
 *
 * LE DÉFAUT QUE CETTE CLÉ CORRIGE, mesuré et non supposé. Sur les neuf maquettes
 * produit, DEUX emploient le dialecte (`01 Accès et Onboarding` : 120
 * interpolations, 24 boucles ; `03 Accueil v2` : 767 et 114). Les SEPT autres —
 * 04, 05, 06, 07, 08, 09, 10 — écrivent tout leur contenu en clair : zéro `{{ }}`,
 * zéro `<sc-for>`, comptés. Conséquence sur les cadres produits : 198 sur 250
 * portaient une signature `(_props: XData)`. Le souligné dit que le paramètre
 * n'est pas lu. Ces écrans recevaient des données et les IGNORAIENT — il n'existait
 * aucune prise où brancher l'API sur 79 % des cadres.
 *
 * On ne peut pas la créer en ajoutant des `{{ }}` dans `docs/template/` : le
 * porteur a été formel, ON NE RÉÉCRIT PAS LES MAQUETTES. Et on ne peut pas non plus
 * la créer en retouchant les `*.generated.tsx` : la régénération suivante les
 * efface. La prise doit donc se DÉCLARER, avec l'écran, dans `tools/screens/*.mjs` —
 * exactement là où vivent déjà l'emprunt, le déclencheur et le titre.
 *
 * ── CE QUE C'EST : `applyBorrows`, APPLIQUÉ À LA DONNÉE ─────────────────────
 *
 * Aucun second mécanisme n'est inventé ici. Un emprunt remplace un fragment de la
 * maquette par un autre fragment DESSINÉ ailleurs ; une donnée remplace un fragment
 * de la maquette par le MÊME fragment où une valeur littérale devient une
 * interpolation. Ce sont les mêmes trois contrôles, et le troisième — « ce qu'on
 * injecte, moins l'ancre, moins les motifs, doit être vide » — est le modèle suivi
 * ici, parce que sans lui « lier une donnée » redeviendrait « redessiner un peu ».
 *
 *   · `noeud`   — LE LITTÉRAL DE LA MAQUETTE, verbatim, qui devient une donnée.
 *                 Texte affiché (« Amina Diallo ») ou fragment de HTML entier (les
 *                 trois cartes de session dessinées côte à côte).
 *   · `fois`    — combien de fois la maquette l'écrit DANS CE CADRE. Défaut 1.
 *                 C'EST LE GARDE-FOU : si le compte ne tombe pas juste, la
 *                 génération ÉCHOUE en nommant le fragment. Un designer qui retire
 *                 « Amina Diallo » d'une planche ne produit donc pas un écran où la
 *                 donnée ne s'affiche plus en silence — il produit un arrêt qui la
 *                 nomme. C'est la même famille de défaut que `cities.member_count`,
 *                 écrit par personne, qui faisait trier la carte par ordre
 *                 alphabétique sans que rien ne le dise.
 *   · `devient` — la réécriture, DANS LE DIALECTE de la maquette : `{{ … }}` pour
 *                 une valeur, `<sc-for>` pour une liste, `<sc-if>` pour un état.
 *                 Pas de nouveau langage : celui que `01` et `03` emploient déjà, et
 *                 que `transcode` sait lire. C'est ce qui fait converger la forme
 *                 des sept maquettes statiques vers celle de `screens/a01` — un seul
 *                 chemin de code, `collectProps` déduit la signature du cadre, et
 *                 rien n'est ajouté à l'émetteur de JSX.
 *   · `motifs`  — les fragments que `devient` réemploie mais que `noeud` ne contient
 *                 pas : ils viennent d'ailleurs dans la maquette, ou d'une autre
 *                 maquette (`{ from, pattern }`). Vérifiés comme ceux d'un emprunt.
 *   · `texte`   — LE TEXTE QUI NE VIENT D'AUCUNE MAQUETTE, déclaré comme tel et
 *                 annoncé par un `⚠` à chaque exécution. Même clé, même sens et même
 *                 exigence d'honnêteté que pour un emprunt.
 *   · `why`     — la phrase du journal. Une donnée qui remplace un texte de maquette
 *                 se LIT à chaque exécution : elle n'est jamais silencieuse.
 *
 * ── LE TROISIÈME CONTRÔLE, SHARPENED POUR LA DONNÉE ─────────────────────────
 *
 * Un emprunt vérifie que `into` moins l'ancre moins les motifs est vide. Ici l'ancre
 * n'est pas recopiée dans `devient` — on ne colle pas la carte deux fois — donc le
 * contrôle est formulé à l'endroit : ce qui reste de `devient` quand on en retire
 * les interpolations, les balises du dialecte, les motifs déclarés et le `texte`
 * déclaré doit être fait de fragments DESSINÉS DANS `noeud`, ET DANS L'ORDRE OÙ LA
 * MAQUETTE LES DESSINE.
 *
 * Ce contrôle attrape trois dérives que rien d'autre ne verrait :
 *   · un mot inventé — il n'est dans aucun fragment, donc introuvable ;
 *   · une couleur retouchée — `#0F5C48` devenu `#0A4234` n'est plus dessiné là, et
 *     la génération s'arrête. La règle « ne pas assombrir les couleurs » devient
 *     exécutable, au lieu d'être une consigne ;
 *   · un remontage — deux fragments recollés dans l'autre sens ne passent pas le
 *     curseur, et il faut alors les DÉCLARER en `motifs`, c'est-à-dire le dire.
 *
 * ── CE QUE CETTE CLÉ NE FAIT PAS ────────────────────────────────────────────
 *
 * Elle ne décide rien. `devient` nomme une expression ; c'est le `data.ts` du
 * module qui dit d'où elle vient, et lui seul appelle l'API. C'est le contrat que
 * l'en-tête de `screens/services/data.ts` a écrit d'avance : « c'est ici que les
 * champs arriveront, et le JSX transcodé n'aura pas à bouger ».
 */

/** Les balises du dialecte et les interpolations : l'échafaudage, jamais du dessin. */
const ECHAFAUDAGE = [
  /\{\{[\s\S]*?\}\}/g,
  /<sc-for\b[^>]*>/g,
  /<\/sc-for>/g,
  /<sc-if\b[^>]*>/g,
  /<\/sc-if>/g,
];

/** Séparateur de fragments : un caractère qu'aucune maquette n'écrit. */
const COUPE = '\u0000';

/**
 * LES FRAGMENTS DE DESSIN que `devient` contient, une fois l'échafaudage ôté.
 *
 * Chacun devra être retrouvé dans `noeud`, dans l'ordre. Le `texte` déclaré est
 * retiré EN DERNIER, exprès, et pour la raison qu'`applyBorrows` a déjà écrite :
 * s'il figurait par hasard dans un motif, c'est le motif qui compte, et la
 * déclaration cesserait d'être signalée — le pire des deux mondes.
 */
function fragmentsDeDessin(devient, motifs, textes) {
  let reste = devient;
  for (const motif of motifs) reste = reste.replace(motif.pattern, COUPE);
  for (const re of ECHAFAUDAGE) reste = reste.replace(re, COUPE);
  for (const phrase of textes) reste = reste.replace(phrase, COUPE);
  return reste.split(COUPE).filter((f) => f !== '');
}

/**
 * Lie les données déclarées d'un cadre. Rend le HTML de la maquette où les
 * littéraux liés sont devenus des interpolations du dialecte.
 *
 * `frameName` entre dans chaque message : les deux cadres d'un écran n'ont pas le
 * même contenu — le mobile de K04 écrit « Dernier numéro, non retirable » là où
 * l'ordinateur laisse un bouton — et un compte qui tombe faux doit dire LEQUEL des
 * deux cadres il a lu, sinon on cherche le défaut dans le mauvais.
 */
function applyData(inner, donnees, section, frameName) {
  let out = inner;
  const applied = [];

  for (const lien of donnees ?? []) {
    const attendu = lien.fois ?? 1;
    const motifs = (lien.motifs ?? []).map((p) =>
      typeof p === 'string' ? { from: lien.from, pattern: p } : p,
    );

    /**
     * PREMIER CONTRÔLE — le fragment est-il toujours dessiné, et autant de fois ?
     *
     * C'est celui pour lequel cette clé existe. Une retouche du designer qui retire
     * ou dédouble le littéral ARRÊTE la génération en le nommant, au lieu de
     * produire un écran où la donnée ne s'affiche plus — défaut qu'aucun `tsc`,
     * aucun lint et aucun test de forme ne verrait, puisque le JSX compile.
     */
    const trouve = out.split(lien.noeud).length - 1;
    if (trouve !== attendu) {
      throw new Error(
        `${section} ${frameName} : le fragment lié à une donnée « ${lien.noeud.slice(0, 90)}… » ` +
          `figure ${trouve} fois dans ce cadre, et la déclaration en attend ${attendu}. ` +
          'Si la maquette a changé, mettre « donnees » à jour dans sa déclaration d’écran ; ' +
          'ne jamais laisser la donnée disparaître en silence.',
      );
    }

    // DEUXIÈME CONTRÔLE — un motif venu d'ailleurs doit y être encore dessiné.
    // Même garde-fou, même message que pour un emprunt : voir `applyBorrows`.
    for (const motif of motifs) {
      if (motif.from === undefined) {
        if (inner.includes(motif.pattern)) continue;
        throw new Error(
          `${section} ${frameName} : le motif « ${motif.pattern.slice(0, 80)}… » réemployé par ` +
            'une donnée ne figure pas dans ce cadre. Déclarer « from » s’il vient d’une autre maquette.',
        );
      }
      if (lireSourceEmpruntee(motif.from).includes(motif.pattern)) continue;
      throw new Error(
        `${section} ${frameName} : le motif « ${motif.pattern.slice(0, 80)}… » réemployé par une ` +
          `donnée ne figure plus dans ${motif.from}. Mettre « donnees » à jour dans sa déclaration.`,
      );
    }

    /**
     * TROISIÈME CONTRÔLE — RIEN D'INVENTÉ, ET RIEN DE REMONTÉ.
     *
     * Le modèle est celui d'`applyBorrows`, à l'endroit : ce qui reste de `devient`
     * quand on retire l'échafaudage du dialecte, les motifs déclarés et le `texte`
     * déclaré doit être fait de fragments dessinés DANS `noeud`, dans l'ordre.
     */
    const fragments = fragmentsDeDessin(lien.devient, motifs, lien.texte ?? []);
    let curseur = 0;
    for (const fragment of fragments) {
      const at = lien.noeud.indexOf(fragment, curseur);
      if (at < 0) {
        throw new Error(
          `${section} ${frameName} : la donnée ajoute du dessin que la maquette n’écrit pas là — ` +
            `« ${fragment.slice(0, 120)} ». Une donnée est faite du fragment de la maquette, des ` +
            'interpolations du dialecte, des « motifs » déclarés et du « texte » DÉCLARÉ, et de ' +
            'rien d’autre — dans l’ordre où la maquette le dessine.',
        );
      }
      curseur = at + fragment.length;
    }

    /**
     * QUATRIÈME CONTRÔLE — une donnée doit VRAIMENT en être une.
     *
     * Un `devient` sans aucune interpolation ne lie rien : il recopierait le
     * fragment à l'identique, le journal annoncerait une donnée, et l'écran
     * continuerait d'afficher la valeur de la maquette. C'est précisément le
     * mensonge que ce mécanisme existe pour empêcher.
     */
    if (!/\{\{[\s\S]*?\}\}/.test(lien.devient)) {
      throw new Error(
        `${section} ${frameName} : la donnée déclarée sur « ${lien.noeud.slice(0, 60)}… » ne porte ` +
          'aucune interpolation `{{ … }}` : elle ne lie rien et l’écran garderait la valeur de la maquette.',
      );
    }

    out = out.split(lien.noeud).join(lien.devient);
    applied.push({ ...lien, motifs, fois: attendu });
  }

  return { html: out, applied };
}

/**
 * EXPORTÉE POUR ÊTRE ÉPROUVÉE DE L'EXTÉRIEUR, sur les octets réels des maquettes.
 *
 * Le garde-fou de cette clé ne se démontre qu'en RETIRANT un fragment d'une
 * maquette et en vérifiant que la génération refuse. Or `docs/` ne se modifie pas —
 * le porteur l'a interdit, et `git status docs/` doit rester vide. La mutation se
 * fait donc sur une COPIE EN MÉMOIRE du fichier, ce qui exige d'appeler cette
 * fonction depuis ailleurs que ce module.
 *
 * ATTENTION : importer ce fichier DÉCLENCHE la génération, qui vit au niveau du
 * module. C'est sans danger — elle est idempotente, vérifiée — mais l'appelant doit
 * s'attendre à son journal.
 */
export { applyData };

/** `{{ x }}` → `{x}` : la règle de texte de `transcode`, pour relire un titre lié. */
const dialecteEnJsx = (s) => s.replace(/\{\{\s*([\s\S]+?)\s*\}\}/g, '{$1}');

/**
 * UN TITRE PEUT ÊTRE UNE DONNÉE, et il doit rester promu en `<h1>`.
 *
 * K02 titre la page avec le NOM DU MEMBRE — « Fatou Ndiaye » — et c'est exactement
 * le genre de littéral qui devient une donnée. Sans cette reprise, la liaison
 * faisait disparaître le texte que `promoteTitle` cherche : la page perdait son
 * `<h1>`, le journal criait « titre déclaré introuvable », et la cause était à deux
 * mécanismes de distance. On remplace donc le texte attendu par sa forme LIÉE, et
 * le journal le dit.
 */
function retitrerSurDonnees(spec, applied) {
  if (spec === undefined) return { spec, lie: null };
  /**
   * Le `noeud` d'une liaison de texte s'écrit avec ses DÉLIMITEURS — `>Fatou
   * Ndiaye<` — parce que c'est ce qui le rend non ambigu dans le HTML : « Lyon »
   * seul figure aussi au milieu d'une autre phrase. Un titre déclaré, lui, est le
   * texte nu. On compare donc les deux dépouillés, sinon la reprise ne déclenche
   * jamais et l'avertissement accuse la déclaration de titre — ce qui est
   * exactement ce qui est arrivé la première fois.
   */
  const nu = (s) => s.replace(/^>/, '').replace(/<$/, '');
  const lien = applied.find((d) => nu(d.noeud) === spec.text);
  if (lien === undefined) return { spec, lie: null };
  const texte = dialecteEnJsx(nu(lien.devient));
  return { spec: { ...spec, text: texte, label: `${spec.label} → ${texte}` }, lie: texte };
}

/**
 * ADAPTATIONS D'UNE MODALE — elles REMPLACENT celle du contenu qui coule.
 *
 * L'adaptation « le contenu vertical était borné par ses 844 px : il doit
 * couler » est juste pour un écran plein : la page défile, donc rien ne doit être
 * coupé. Appliquée au corps d'une modale, elle est FAUSSE, et activement nuisible :
 * elle retire `flex: 1` et `min-height: 0`, alors qu'un panneau de modale est
 * borné PAR DESSEIN (`top: 40px; bottom: 40px` sur l'ordinateur, `height: 88%` sur
 * le mobile). Sans eux, le corps déborde du panneau et va se dessiner par-dessus
 * le voile — la modale paraît cassée alors que le transcodage est fidèle.
 *
 * Ce qu'il faut ici est l'inverse : GARDER les bornes et faire défiler à
 * l'intérieur. C'est ce que fait cette table, et elle ne contient rien d'autre.
 */
const MODAL_ADAPTATIONS = [
  {
    why: 'Le corps d’une modale défile DANS son panneau : le panneau est borné par dessein.',
    match: (style) =>
      style.includes('overflow: "hidden"') &&
      style.includes('flex: "1"') &&
      style.includes('minHeight: "0"'),
    apply: (style) => style.replace('overflow: "hidden"', 'overflowY: "auto"'),
  },
];

/**
 * ─── LE TITRE D'UN CADRE : UN SEUL MÉCANISME, DEUX QUESTIONS ─────────────────
 *
 * Trois mécanismes vivaient ici, arrivés par accumulation de lots parallèles :
 * `heading` déclaré par écran, `title` déclaré par cadre, et `promoteTextTo` avec
 * son `requires` pour les fenêtres. Deux lots récents y ont ajouté
 * `frame.modalTitle` — un titre par CADRE pour une fenêtre à plusieurs volets — et
 * `screen.modalTitleRequires` — une surcharge du discriminant. Chacun marchait sur
 * ses propres déclarations ; ensemble ils faisaient trois chemins de code, DEUX
 * positions dans le pipeline et cinq branches de journal pour une seule idée.
 *
 * Ce qui les distinguait n'était pas trois idées mais DEUX, et les aplatir en une
 * casse des titres. Le mécanisme unifié les garde donc séparées, chacune dans sa
 * fonction :
 *
 *   LEQUEL des titres — quel titre vaut pour CE cadre.
 *     Un cadre porte le sien (`frame.…`) ou, à défaut, celui de l'écran
 *     (`screen.…`). Les quatre planches de la fenêtre « Contribuer » de A12C sont
 *     UNE SEULE fenêtre et portent QUATRE titres : « Contribuer à la fiche Lyon »
 *     sur l'étape 1 d'ordinateur, « Produit du pays » et « Budget réel » sur
 *     l'étape 2, « Contribuer à Lyon » sur la feuille mobile. C'est `titleFor`,
 *     et elle ne lit QUE des déclarations — jamais la maquette.
 *
 *   QUEL texte promouvoir — quel élément de la maquette porte ce titre.
 *     Le texte ne suffit pas : « Checklist de documents » figure DEUX FOIS dans le
 *     cadre d'ordinateur de J06, et c'est l'entrée du panneau de gauche qui vient
 *     en premier dans le document. Il faut un discriminant. C'est `promoteTitle`,
 *     et elle ne lit QUE la maquette — elle ignore d'où le titre vient.
 *
 * Aucune des deux ne peut répondre pour l'autre. `modalTitleRequires` le montre :
 * il ne dit pas LEQUEL des titres mais QUEL texte, et il se surcharge donc sur
 * l'axe du discriminant, pas sur celui de la provenance.
 */

/**
 * LE DISCRIMINANT — la moitié « QUEL », et il a TROIS valeurs, pas deux.
 *
 * Les deux qui ne sont pas un fragment de style ne sont pas des commodités :
 * chacune est la seule réponse juste pour une famille de déclarations, et la
 * mesure a été faite en régénérant.
 *
 *   · un FRAGMENT DE STYLE déclaré (`'fontSize: "30px"'`, `'fontWeight: "700"'`)
 *     — le cas des titres ambigus, où la maquette écrit deux fois le même texte et
 *     où seule la taille ou la graisse les sépare ;
 *
 *   · `SHAPED` — l'élément doit RESSEMBLER à un titre : au moins 16 px et une
 *     graisse d'au moins 700. C'est ce qui distingue « Parrainage » le titre de
 *     H05 de « Parrainage » la pastille de filtre du même cadre, et ce qui permet
 *     de ne pas relire la taille de quarante-quatre titres sans ambiguïté ;
 *
 *   · `WHOLE` — aucun style exigé, mais l'élément doit contenir le titre ET RIEN
 *     D'AUTRE. C'est un discriminant de CONTENU, et il est indispensable : les
 *     en-têtes mobiles de A01N, A05 et A10 titrent en 15 et 15,5 px, SOUS le
 *     plancher de `SHAPED`. Leur imposer la mesure leur retire leur `<h1>` —
 *     trois cadres, mesuré en régénérant, pas supposé. C'est aussi lui qui évite
 *     que « Lyon » attrape le début de « Lyon et Rhône » dans la colonne de
 *     contexte de la fiche ville.
 *
 * Il n'y a PAS de quatrième valeur, et surtout pas de « n'importe quoi » : sans
 * borne, promouvoir tout ce qui ressemble à une étiquette ferait remonter
 * « COMPOSANTS » ou « BLOQUÉS » en titre de fenêtre.
 */
const SHAPED = Symbol('titre reconnu à sa forme : au moins 16 px et graisse ≥ 700');
const WHOLE = Symbol('titre reconnu à ce que l’élément ne contient rien d’autre');

/**
 * LEQUEL DES TITRES vaut pour ce cadre — et rien d'autre.
 *
 * La fonction rend une DÉCLARATION RÉSOLUE, jamais du JSX : `{ text, tag, id,
 * requires, key, label }`. Elle ne touche pas à la maquette, donc elle ne peut pas
 * se tromper d'élément ; c'est le travail de `promoteTitle`, et la séparation est
 * ce qui rend chacune des deux vérifiable seule.
 *
 * `key` nomme la clé de déclaration employée, pour que l'avertissement dise quoi
 * corriger. Le journal a déjà accusé la mauvaise déclaration une fois.
 *
 * LA PRÉCÉDENCE EST UNIQUE, et c'était l'autre moitié de la dette : `heading` était
 * un repli de la maquette, `title` s'appliquait INCONDITIONNELLEMENT après elle.
 * Un cadre qui aurait balisé son titre ET déclaré un `title` recevait donc DEUX
 * `<h1>` en silence. Aucun ne le fait aujourd'hui — vérifié, zéro fichier produit
 * n'a deux `<h1>` — mais la forme unifiée le rend impossible plutôt que improbable.
 */
function titleFor(screen, frame) {
  if (screen.modal === true) {
    const text = frame.modalTitle ?? screen.modalTitle;
    if (text === undefined) return undefined;
    return {
      text,
      tag: 'h2',
      /**
       * L'`id` est celui de l'ÉCRAN, jamais du cadre, même quand le titre vient du
       * cadre. `ScreenFrames` ne rend qu'une planche à la fois : un seul
       * `a12c-titre` existe dans le document, et `aria-labelledby` le désigne sans
       * ambiguïté quel que soit le volet ouvert.
       */
      id: `${screen.section.toLowerCase()}-titre`,
      /**
       * `fontWeight: "800"` est le bon défaut : les huit fenêtres du dépôt titrent
       * toutes en 800. Le MENU DE LA CONVERSATION de M01 n'en fait pas partie — la
       * maquette le nomme par l'étiquette de sa carte, en 10,5 px / 700, comme elle
       * nomme « BLOQUÉS » dans `08 Compte`. La surcharge est DÉCLARÉE, jamais
       * devinée, et elle porte sur le discriminant seul.
       */
      requires: frame.modalTitleRequires ?? screen.modalTitleRequires ?? 'fontWeight: "800"',
      key: 'modalTitle',
      label: text,
    };
  }

  /**
   * `heading` — le titre d'une PAGE que la maquette écrit dans un `<div>`.
   *
   * Trente cadres de `04 Parcours` et six de `03 Accueil v2` n'ont ni `<h1>` ni
   * `<h2>` : une planche de documentation n'a pas de plan de lecture à tenir. Une
   * page en a un, et sans `<h1>` un lecteur d'écran ne sait pas de quoi elle parle
   * (`page-has-heading-one`).
   *
   * Aucun `id` n'est posé, à la différence d'une fenêtre : `ScreenFrames` rend LES
   * DEUX cadres et en masque un, donc un `id` y serait deux fois dans le document.
   * Un `<h1>` n'en a pas besoin.
   */
  const declared = frame.heading ?? screen.heading;
  if (declared !== undefined) {
    return { text: declared, tag: 'h1', requires: WHOLE, key: 'heading', label: declared };
  }

  const title = frame.title;
  if (title === undefined) return undefined;
  /**
   * `title` accepte DEUX FORMES, et la plus simple reste légitime : une chaîne (le
   * texte visible, reconnu à sa forme) ou `{ text, size }` qui déclare la taille
   * quand deux éléments portent le même texte. Exiger l'objet partout obligerait à
   * relire la taille de quarante-quatre titres sans ambiguïté.
   */
  if (typeof title === 'string') {
    return { text: title, tag: 'h1', requires: SHAPED, key: 'title', label: title };
  }
  return {
    text: title.text,
    tag: 'h1',
    requires: `fontSize: "${title.size}"`,
    key: 'title',
    label: `${title.text} (${title.size})`,
  };
}

/**
 * QUEL TEXTE PROMOUVOIR — et rien d'autre. `spec` vient de `titleFor`.
 *
 * On PARCOURT toutes les occurrences du texte et on retient la première qui passe
 * le discriminant. Une seule était examinée à l'origine, et c'était un piège : sur
 * ces maquettes la première occurrence est souvent l'entrée du panneau de gauche —
 * « Mes demandes », « Checklist de documents » figurent deux fois — donc le titre
 * promu était le mauvais, invisiblement, puisque le texte affiché est le même.
 *
 * `margin: 0` est AJOUTÉ, et c'est la seule liberté prise sur la maquette : un
 * titre arrive avec les marges par défaut du navigateur, que le `<span>` ou le
 * `<div>` d'origine n'avait pas. Sans cette ligne, changer la balise déplacerait le
 * titre — sur un `<h1>` la marge par défaut fait 0,67 em, une vingtaine de pixels à
 * 30 px de corps. Le design ne serait plus celui de la maquette, pour une raison
 * invisible à la lecture du code.
 */
function promoteTitle(jsx, spec) {
  if (spec === undefined) return { jsx, promoted: false, id: null };
  const { text, tag: as, id, requires } = spec;

  // `WHOLE` exige que l'élément s'arrête au titre : son marqueur porte la fermeture.
  const marker = requires === WHOLE ? `>${text}<` : `>${text}`;

  for (let at = jsx.indexOf(marker); at >= 0; at = jsx.indexOf(marker, at + 1)) {
    // Remonter à l'ouverture de la balise qui contient ce texte.
    const open = jsx.lastIndexOf('<', at);
    const tagMatch = /^<(span|div)( [^>]*)>$/.exec(jsx.slice(open, at + 1));
    if (tagMatch === null) continue;
    const [, tag, attrs] = tagMatch;

    if (requires === WHOLE) {
      // Le `<` du marqueur doit être CELUI DE LA FERMETURE. S'il ouvre une balise
      // imbriquée, l'élément contient autre chose que le titre : ce n'est pas lui.
      if (!jsx.startsWith(`</${tag}>`, at + 1 + text.length)) continue;
    } else if (requires === SHAPED) {
      const size = /fontSize: "([\d.]+)px"/.exec(attrs);
      const weight = /fontWeight: "(\d+)"/.exec(attrs);
      if (size === null || Number(size[1]) < 16) continue;
      if (weight === null || Number(weight[1]) < 700) continue;
    } else if (!attrs.includes(requires)) {
      continue;
    }

    // La fermeture correspondante, imbrication comprise — « Commentaires · 8 » a
    // un `<span>` dedans.
    let depth = 1;
    let i = at + 1;
    const openRe = new RegExp(`<${tag}[\\s>]`, 'g');
    const closeRe = new RegExp(`</${tag}>`, 'g');
    for (;;) {
      openRe.lastIndex = i;
      closeRe.lastIndex = i;
      const nextOpen = openRe.exec(jsx);
      const nextClose = closeRe.exec(jsx);
      if (nextClose === null) return { jsx, promoted: false, id: null };
      if (nextOpen !== null && nextOpen.index < nextClose.index) {
        depth += 1;
        i = nextOpen.index + 1;
        continue;
      }
      depth -= 1;
      if (depth === 0) {
        const newAttrs = attrs.replace(/style=\{\{ /, 'style={{ margin: "0", ');
        const idAttr = id === undefined ? '' : ` id="${id}"`;
        const out =
          jsx.slice(0, open) +
          `<${as}${idAttr}${newAttrs}>` +
          jsx.slice(at + 1, nextClose.index) +
          `</${as}>` +
          jsx.slice(nextClose.index + nextClose[0].length);
        return { jsx: out, promoted: true, id: id ?? null };
      }
      i = nextClose.index + 1;
    }
  }
  return { jsx, promoted: false, id: null };
}

/** La table à employer : celle des modales exclut l'adaptation du contenu qui coule. */
function adaptationsFor(modal) {
  if (!modal) return ALL_ADAPTATIONS;
  const flowing = FRAME_ADAPTATIONS.findIndex((a) => a.why.includes('doit couler'));
  const kept = FRAME_ADAPTATIONS.filter((_, i) => i !== flowing);
  return [...MODAL_ADAPTATIONS, ...kept, ...TOUCH_TARGET_ADAPTATIONS];
}

function adaptFrame(jsx, section, modal = false) {
  const ADAPTATIONS = adaptationsFor(modal);
  const counts = ADAPTATIONS.map(() => 0);
  const roles = new Set();

  const adapted = jsx.replace(/<(\w+)([^>]*?style=\{\{ [^}]* \}\}[^>]*?)(\/?)>/g, (whole, tag, attrs, selfClose) => {
    const styleMatch = /style=\{\{ ([^}]*) \}\}/.exec(attrs);
    if (styleMatch === null) return whole;

    let style = styleMatch[1];
    const extra = [];

    ADAPTATIONS.forEach((adaptation, i) => {
      if (!adaptation.match(style)) return;
      style = adaptation.apply(style);
      counts[i] += 1;
      if (adaptation.attrs !== undefined && !attrs.includes(adaptation.attrs)) {
        extra.push(adaptation.attrs);
      }
    });

    for (const annotation of A11Y_ANNOTATIONS) {
      if (annotation.match(tag, attrs) && !attrs.includes('aria-label')) {
        extra.push(annotation.attrs);
      }
    }

    for (const control of INTERACTIVE_ROLES) {
      if (!attrs.includes(`onClick={${control.handler}}`)) continue;
      extra.push(`role="${control.role}"`, `aria-checked={${control.checked}}`);
      if (control.label !== undefined) extra.push(`aria-label="${control.label}"`);
      roles.add(control.handler);
    }

    const newAttrs = attrs.replace(/style=\{\{ [^}]* \}\}/, `style={{ ${style} }}`);
    const suffix = extra.length === 0 ? '' : ` ${extra.join(' ')}`;
    return `<${tag}${newAttrs}${suffix}${selfClose}>`;
  });

  /**
   * LE `<h2>` QUE LA MAQUETTE BALISE DÉJÀ — la SOURCE la plus sûre, et la seule
   * que `adaptFrame` connaisse.
   *
   * Le titre DÉCLARÉ est un repli, et il est promu ailleurs : une seule fois, après
   * `adaptFields` et `adaptButtons`, par `promoteTitle`. Il était promu ICI pour
   * `heading` et LÀ-BAS pour `title` — deux positions dans le pipeline pour la même
   * opération. Le déplacement a été mesuré : les 250 cadres sortent identiques,
   * octet pour octet.
   */
  const fromMarkup = promoteFirstHeading(adapted);
  const fields = adaptFields(fromMarkup.jsx, section);
  const buttons = adaptButtons(fields.jsx, section);
  return {
    adapted: buttons.jsx,
    counts,
    promotedHeading: fromMarkup.promoted,
    headingAlreadyThere: fromMarkup.alreadyThere === true,
    roles,
    fields: fields.applied,
    missedFields: fields.missed ?? [],
    buttons: buttons.applied,
  };
}

/**
 * Le conteneur extérieur du cadre est retiré : c'est lui qui portait la taille
 * fixe. Les colonnes internes, elles, restent telles quelles — panneau 400 px,
 * contenu flex:1 borné à 660, colonne de contexte 300 px — et s'adaptent seules
 * entre 1024 et 1920 px.
 */
/**
 * Les écrans à produire, LUS DANS `tools/screens/`, un fichier par maquette.
 *
 * Ils vivaient dans un tableau unique ici même. Les quatre-vingt-sept sections
 * qui restent seront transcodées en parallèle, et tant que les déclarations
 * partageaient un fichier, chaque contribution se disputait le même tableau : la
 * fusion demandait une résolution à la main, à chaque fois, pour des blocs qui ne
 * se recouvrent jamais. Un fichier par maquette supprime le conflit plutôt que de
 * le résoudre.
 *
 * L'ordre est celui des noms de fichier, donc celui des numéros de maquette —
 * stable d'une machine à l'autre, ce que `readdir` ne garantit pas seul.
 */
const SCREENS = (
  await Promise.all(
    readdirSync(resolve(ROOT, 'tools', 'screens'))
      .filter((f) => f.endsWith('.mjs'))
      .sort()
      .map(async (f) => {
        const module = await import(pathToFileURL(resolve(ROOT, 'tools', 'screens', f)).href);
        if (!Array.isArray(module.screens)) {
          throw new Error(`tools/screens/${f} doit exporter « screens », un tableau.`);
        }
        return module.screens;
      }),
  )
).flat();

/**
 * Les identifiants que le cadre consomme, DÉDUITS de la maquette.
 *
 * Écrits à la main, ils dérivent : une donnée ajoutée à la maquette manque au
 * composant, et l'erreur ne se voit qu'à l'exécution.
 *
 * La lecture se fait sur le HTML SOURCE, pas sur le JSX produit. Le dialecte
 * `{{ … }}` marque les données sans ambiguïté, alors que le JSX mêle les
 * expressions aux objets de style (`style={{ background: … }}`) et enveloppe
 * les boucles de parenthèses (`{(rail ?? []).map(`) — deux formes qui font
 * échouer une extraction naïve, silencieusement et dans les deux sens.
 */
const JS_GLOBALS = new Set([
  'true', 'false', 'null', 'undefined',
  'Math', 'String', 'Number', 'Array', 'Object', 'JSON', 'Date',
]);

/**
 * Les variables de boucle se lisent dans le CADRE, pas dans la section.
 *
 * Elles se lisaient dans la section, et c'était faux dès qu'un `<sc-for>` enveloppe
 * un cadre au lieu d'être dedans. A14 est exactement ce cas : la maquette répète son
 * cadre d'ordinateur quatre fois, `<sc-for list="{{ webFrames }}" as="w">` ENTOURANT
 * le `<div style="width:1440px…">`. Le cadre extrait référence donc `w.photoBg`,
 * `w.steps`, `w.next` — sans que la boucle qui lie `w` en fasse partie.
 *
 * En lisant la section, `w` passait pour une variable de boucle et n'était pas
 * déclaré : le composant produit lisait un identifiant qui n'existe pas. Le défaut
 * s'est vu à la compilation, ce qui est une chance — mais la cause était invisible,
 * puisque la boucle EST bien dans la section.
 *
 * En lisant le cadre, une boucle interne reste exclue (elle lie sa variable sur
 * place) et une boucle externe devient une donnée à fournir, ce qu'elle est.
 */
function collectProps(frameHtml, appliedFields = [], producedJsx = '') {
  const loopVars = new Set();
  for (const m of frameHtml.matchAll(/<sc-for[^>]*\bas="([^"]+)"/g)) {
    loopVars.add(m[1]);
    // `<sc-for as="x">` expose aussi `xIndex`, produit par le transcodeur.
    loopVars.add(`${m[1]}Index`);
  }

  const names = new Set();
  for (const m of frameHtml.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g)) {
    // La RACINE de l'expression : `r.hours` dépend de `r`, `seg(1)` de `seg`.
    const root = /^[A-Za-z_$][\w$]*/.exec(m[1].trim())?.[0];
    if (root === undefined) continue;
    if (loopVars.has(root) || JS_GLOBALS.has(root)) continue;
    names.add(root);
  }

  // Les identifiants introduits par une adaptation de champ : ils ne figurent
  // pas dans le dialecte de la maquette, puisque c'est nous qui les posons.
  for (const field of appliedFields) {
    // Une adaptation ANNONCE ce qu'elle peut fournir, mais les deux cadres n'ont
    // pas le même contenu — le mobile de P01 n'a pas de drapeau. On ne retient
    // donc que ce qui figure réellement dans le JSX produit, sinon le composant
    // déclare une variable qu'il n'emploie pas, et le lint la refuse.
    for (const provided of field.provides ?? []) {
      if (new RegExp(`\\b${provided}\\b`).test(producedJsx)) names.add(provided);
    }
    for (const attr of field.attrs ?? []) {
      const bound = /\{([A-Za-z_$][\w$]*)\}/.exec(attr);
      if (bound !== null) names.add(bound[1]);
    }
  }

  return [...names].sort();
}

/**
 * `Fragment` n'est importé que si le cadre contient une boucle : le transcodeur
 * l'emploie pour porter la clé de `map()`, et un cadre sans `<sc-for>` n'en a
 * aucun besoin. Un import inutile est une erreur de lint, et un fichier généré
 * ne doit pas avoir besoin qu'on désactive le lint pour passer.
 */
const HEADER = (section, width, file, dataModule, dataType, needsFragment) => `// GÉNÉRÉ depuis ${file}, section ${section}, cadre ${width} px.
// Ne pas modifier à la main : relancer \`node tools/generate-screens.mjs\`.
//
// Les styles en ligne sont ceux de la maquette, à l'identique. Le conteneur
// extérieur, lui, est fluide : la maquette le fige à ${width} px, ce qui ne
// serait pas responsive.
${needsFragment ? "import { Fragment } from 'react';\n" : ''}import type { ${dataType} } from '${dataModule}';

`;

/**
 * ─── ÉPREUVE DU MÉCANISME DE TITRE ET DU SÉLECTEUR DE PLANCHE ────────────────
 *
 * `node tools/generate-screens.mjs --self-test` — branché sur `pnpm guardrails`,
 * comme le `--self-test` de `check-duplicate-spread-keys.mjs`.
 *
 * Chaque cas porte LE DÉFAUT RÉEL d'où il vient. Un test qui ne meurt pas quand on
 * casse la règle qu'il prétend garder est un test creux : ceux-ci ont tous été
 * éprouvés en cassant la règle et en vérifiant que le cas rougit.
 *
 * Les fragments sont écrits dans le dialecte que `transcode` produit — `style={{ … }}`
 * — parce que c'est sur CELUI-LÀ que `promoteTitle` travaille, jamais sur le HTML.
 */

/** Deux volets d'une même fenêtre, chacun avec SON titre. Voir A12C. */
const VOLET_PRODUIT =
  '<div style={{ padding: "24px" }}>' +
  '<span style={{ fontSize: "11px", fontWeight: "700", letterSpacing: "1px" }}>ÉTAPE 2 SUR 2</span>' +
  '<span style={{ fontSize: "20px", fontWeight: "800" }}>Produit du pays</span>' +
  '</div>';

/** L'en-tête d'une carte de conversation : 10,5 px / 700, comme M01. */
const MENU_CONVERSATION =
  '<div style={{ padding: "8px" }}>' +
  '<span style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: "1px", color: "#8A958F" }}>MENU DE LA CONVERSATION</span>' +
  '<span style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: "1px", color: "#8A958F" }}>BLOQUÉS</span>' +
  '</div>';

/** L'en-tête mobile de A01N : le titre fait 15,5 px — SOUS le plancher de `SHAPED`. */
const ENTETE_MOBILE =
  '<div style={{ display: "flex" }}>' +
  '<span style={{ fontSize: "15.5px", fontWeight: "700", flex: "1" }}>Nouvelle publication</span>' +
  '</div>';

/** Une pastille de filtre PUIS le vrai titre, même mot. Cas réel de H05. */
const PASTILLE_PUIS_TITRE =
  '<div>' +
  '<span style={{ padding: "8px 12px", fontSize: "12.5px", fontWeight: "600" }}>Parrainage</span>' +
  '<span style={{ fontSize: "28px", fontWeight: "800" }}>Parrainage</span>' +
  '</div>';

/** « Lyon » le titre, et « Lyon et Rhône » la colonne de contexte. Cas réel de A12. */
const LYON_ET_RHONE =
  '<div>' +
  '<div style={{ fontSize: "13px", fontWeight: "600" }}>Lyon et Rhône</div>' +
  '<div style={{ fontSize: "30px", fontWeight: "800" }}>Lyon</div>' +
  '</div>';

/** « Checklist de documents » deux fois : l'entrée du panneau d'abord. Cas réel de J06. */
const CHECKLIST_DEUX_FOIS =
  '<div>' +
  '<span style={{ fontSize: "14px", fontWeight: "700" }}>Checklist de documents</span>' +
  '<span style={{ fontSize: "26px", fontWeight: "800" }}>Checklist de documents</span>' +
  '</div>';

/** « Commentaires · 8 » : le compteur est un `<span>` IMBRIQUÉ dans le titre. */
const COMMENTAIRES =
  '<div><span style={{ fontSize: "18px", fontWeight: "800" }}>Commentaires<span style={{ color: "#8A958F" }}> · 8</span></span></div>';

const TITLE_TESTS = [
  // ── LEQUEL des titres ────────────────────────────────────────────────────
  {
    name: 'LEQUEL · le titre du CADRE passe devant celui de l’écran (A12C, 4 volets 1 fenêtre)',
    run: () => {
      const spec = titleFor(
        { section: 'A12C', modal: true, modalTitle: 'Contribuer à la fiche Lyon' },
        { modalTitle: 'Produit du pays' },
      );
      return `${spec.text}|${spec.id}|${spec.tag}`;
    },
    expect: 'Produit du pays|a12c-titre|h2',
  },
  {
    name: 'LEQUEL · l’écran fournit le titre quand le cadre n’en déclare pas',
    run: () => titleFor({ section: 'A01C', modal: true, modalTitle: 'Commentaires' }, {}).text,
    expect: 'Commentaires',
  },
  {
    name: 'LEQUEL · quatre volets, quatre titres, UN SEUL id — et c’est promu sur la maquette',
    run: () => {
      const a12c = SCREENS.find((s) => s.section === 'A12C');
      const titres = a12c.frames.map((f) => titleFor(a12c, f));
      const textes = new Set(titres.map((t) => t.text));
      const ids = new Set(titres.map((t) => t.id));
      // Et le titre de chaque volet est bien PROMU dans le JSX de CE volet-là.
      const promus = a12c.frames.map((frame) => {
        const section = extractSection(readFileSync(resolve(ROOT, a12c.file), 'utf8'), frame.section);
        const raw = extractFrame(section, frame.width, frame.occurrence ?? 0, frame.requires ?? '');
        const { adapted } = adaptFrame(transcode(raw.inner), a12c.section, true);
        return promoteTitle(adapted, titleFor(a12c, frame)).promoted;
      });
      return `${textes.size} titres · ${ids.size} id · promus ${promus.filter(Boolean).length}/${promus.length}`;
    },
    expect: '4 titres · 1 id · promus 4/4',
  },
  // ── QUEL texte promouvoir ────────────────────────────────────────────────
  {
    name: 'QUEL · surcharge DÉCLARÉE du discriminant : 700 promeut « MENU DE LA CONVERSATION »',
    run: () => {
      const spec = titleFor(
        { section: 'M01', modal: true, modalTitle: 'MENU DE LA CONVERSATION', modalTitleRequires: 'fontWeight: "700"' },
        {},
      );
      const out = promoteTitle(MENU_CONVERSATION, spec);
      return `${out.promoted}|${out.jsx.includes('<h2 id="m01-titre"') ? 'h2' : 'rien'}`;
    },
    expect: 'true|h2',
  },
  {
    name: 'QUEL · sans la surcharge, le défaut 800 ne le promeut PAS — et ne se rabat sur rien',
    run: () => {
      const spec = titleFor({ section: 'M01', modal: true, modalTitle: 'MENU DE LA CONVERSATION' }, {});
      return String(promoteTitle(MENU_CONVERSATION, spec).promoted);
    },
    expect: 'false',
  },
  {
    name: 'QUEL · un intitulé de section NE MÉRITE PAS d’être promu : « BLOQUÉS » reste un span',
    run: () => {
      // La surcharge de M01 est en place : le discriminant seul ne suffit donc plus,
      // c'est le TEXTE DÉCLARÉ qui borne. « BLOQUÉS » n'est déclaré nulle part.
      const spec = titleFor({ section: 'K05', modal: true, modalTitle: 'BLOQUÉS' }, {});
      const avec700 = titleFor(
        { section: 'K05', modal: true, modalTitle: 'BLOQUÉS', modalTitleRequires: 'fontWeight: "700"' },
        {},
      );
      return `defaut=${promoteTitle(MENU_CONVERSATION, spec).promoted} declare=${promoteTitle(MENU_CONVERSATION, avec700).promoted}`;
    },
    expect: 'defaut=false declare=true',
  },
  {
    name: 'QUEL · `WHOLE` promeut un en-tête mobile de 15,5 px que `SHAPED` refuse (A01N, A05, A10)',
    run: () => {
      const whole = promoteTitle(ENTETE_MOBILE, { text: 'Nouvelle publication', tag: 'h1', requires: WHOLE });
      const shaped = promoteTitle(ENTETE_MOBILE, { text: 'Nouvelle publication', tag: 'h1', requires: SHAPED });
      return `whole=${whole.promoted} shaped=${shaped.promoted}`;
    },
    expect: 'whole=true shaped=false',
  },
  {
    name: 'QUEL · `SHAPED` saute la pastille de filtre et prend le titre (H05)',
    run: () => {
      const out = promoteTitle(PASTILLE_PUIS_TITRE, { text: 'Parrainage', tag: 'h1', requires: SHAPED });
      return `${out.promoted}|${/<h1 style=\{\{ margin: "0", fontSize: "28px"/.test(out.jsx)}`;
    },
    expect: 'true|true',
  },
  {
    name: 'QUEL · `WHOLE` ne prend pas le préfixe d’un texte plus long (« Lyon » ≠ « Lyon et Rhône »)',
    run: () => {
      const out = promoteTitle(LYON_ET_RHONE, { text: 'Lyon', tag: 'h1', requires: WHOLE });
      return `${out.promoted}|${/<h1 style=\{\{ margin: "0", fontSize: "30px"/.test(out.jsx)}`;
    },
    expect: 'true|true',
  },
  {
    name: 'QUEL · un discriminant de taille déclaré saute la PREMIÈRE occurrence (J06)',
    run: () => {
      const out = promoteTitle(CHECKLIST_DEUX_FOIS, {
        text: 'Checklist de documents',
        tag: 'h1',
        requires: 'fontSize: "26px"',
      });
      return `${out.promoted}|${/<h1 style=\{\{ margin: "0", fontSize: "26px"/.test(out.jsx)}`;
    },
    expect: 'true|true',
  },
  {
    name: 'QUEL · la fermeture est la BONNE malgré un span imbriqué (« Commentaires · 8 »)',
    run: () => {
      const out = promoteTitle(COMMENTAIRES, {
        text: 'Commentaires',
        tag: 'h2',
        id: 'a01c-titre',
        requires: 'fontWeight: "800"',
      });
      return out.jsx.includes('> · 8</span></h2>') ? 'fermeture juste' : `fermeture fausse : ${out.jsx}`;
    },
    expect: 'fermeture juste',
  },
  {
    name: 'QUEL · `margin: "0"` est ajouté, sinon le titre se déplace en changeant de balise',
    run: () => String(promoteTitle(ENTETE_MOBILE, { text: 'Nouvelle publication', tag: 'h1', requires: WHOLE }).jsx.includes('<h1 style={{ margin: "0", fontSize: "15.5px"')),
    expect: 'true',
  },
  {
    name: 'LEQUEL · aucune déclaration, aucune promotion — et pas d’exception',
    run: () => `${titleFor({ section: 'A01' }, {}) === undefined}|${promoteTitle(ENTETE_MOBILE, undefined).promoted}`,
    expect: 'true|false',
  },
];

/** La planche de J01M et la colonne de mise en page qui la porte, même largeur. */
const PLANCHE_ET_COLONNE =
  '<div style="display:flex;flex-direction:column;gap:10px;width:390px">' +
  '<span>MOBILE · FEUILLE</span>' +
  '<div style="width:390px;height:844px;border-radius:40px;overflow:hidden">le téléphone</div>' +
  '</div>';

const FRAME_TESTS = [
  {
    name: 'la largeur est reconnue où qu’elle soit DÉCLARÉE (`position:relative;width:760px`, A12T)',
    run: () => extractFrame('<div style="position:relative;width:760px;height:820px">volet</div>', 760).inner,
    expect: 'volet',
  },
  {
    name: 'la largeur peut n’être PAS en pixels (`width:100%`, la carte du composeur de A01S)',
    run: () => extractFrame('<div style="width:100%;background:#fff;border-radius:22px">carte</div>', '100%').inner,
    expect: 'carte',
  },
  {
    name: 'la largeur peut être déclarée EN DERNIER (`background:…;width:480px`, X04)',
    run: () => extractFrame('<div style="background:#E3F0EB;border-radius:22px;width:480px">encart</div>', 480).inner,
    expect: 'encart',
  },
  {
    name: '`width:` doit OUVRIR une déclaration : `min-width` et `max-width` ne sont pas des planches',
    run: () => {
      try {
        extractFrame('<div style="min-width:760px"><div style="max-width:760px">x</div></div>', 760);
        return 'attrapé à tort';
      } catch (e) {
        return e.message.startsWith('Cadre de 760px n° 1 introuvable') ? 'refusé' : `autre erreur : ${e.message}`;
      }
    },
    expect: 'refusé',
  },
  {
    name: '`requires` désigne la PLANCHE et non la colonne de même largeur (J01M)',
    run: () => extractFrame(PLANCHE_ET_COLONNE, 390, 0, 'height:844px').inner,
    expect: 'le téléphone',
  },
  {
    name: 'sans `requires`, c’est la colonne qui vient en premier — la règle est bien ACTIVE',
    run: () => extractFrame(PLANCHE_ET_COLONNE, 390, 0).inner.startsWith('<span>MOBILE') ? 'la colonne' : 'autre',
    expect: 'la colonne',
  },
  {
    name: '`occurrence` ne compte que les candidats qui passent `requires`',
    run: () => {
      const html =
        '<div style="width:700px">colonne A</div>' +
        '<div style="width:700px;height:600px">planche A</div>' +
        '<div style="width:700px">colonne B</div>' +
        '<div style="width:700px;height:600px">planche B</div>';
      return `${extractFrame(html, 700, 0, 'height:600px').inner}/${extractFrame(html, 700, 1, 'height:600px').inner}`;
    },
    expect: 'planche A/planche B',
  },
  {
    name: 'la maquette elle-même : les trois volets « Contribuer » de A12T, SANS préfixe déclaré',
    run: () => {
      const section = extractSection(
        readFileSync(resolve(ROOT, 'docs/template/03 Accueil v2.dc.html'), 'utf8'),
        'A12T',
      );
      // Chaque volet porte SON titre : c'est ce qui prouve qu'on a bien les trois,
      // et dans l'ordre que la maquette leur donne.
      const attendus = ['Contribuer à la fiche Lyon', 'Produit du pays', 'Budget réel'];
      return attendus.map((t, o) => extractFrame(section, 760, o).inner.includes(t)).join(',');
    },
    expect: 'true,true,true',
  },
  {
    name: 'la maquette elle-même : la carte du composeur de A01S est atteignable et transcodable',
    run: () => {
      const section = extractSection(
        readFileSync(resolve(ROOT, 'docs/template/03 Accueil v2.dc.html'), 'utf8'),
        'A01S',
      );
      const col = extractFrame(section, 760);
      const card = extractFrame(col.inner, '100%');
      return `${card.inner.includes('repas partagé')}|${transcode(card.inner).startsWith('<div style={{')}`;
    },
    expect: 'true|true',
  },
];

/**
 * ─── ÉPREUVE DE `donnees`, LA PRISE OÙ SE BRANCHE L'API ──────────────────────
 *
 * Chaque cas porte le DÉFAUT RÉEL qu'il prévient, et chacun a été éprouvé en
 * cassant la règle qu'il garde : on retire le contrôle, on vérifie que le cas
 * ROUGIT, on remet. Un test qui survit à la suppression de sa règle est creux.
 *
 * Le dernier cas est une MUTATION TÉMOIN — il change un endroit qui ne décide de
 * rien et vérifie que le résultat ne bouge PAS. Sans lui, un contrôle pourrait
 * s'appuyer sur la mauvaise occurrence et les autres cas passeraient quand même.
 */
const DATA_TESTS = [
  {
    name: 'le fragment déclaré est lié, et le dialecte de la maquette en sort',
    run: () => {
      const cadre = '<div><span>Amina Diallo</span></div>';
      const out = applyData(
        cadre,
        [{ noeud: '>Amina Diallo<', devient: '>{{ moi.nom }}<', why: '' }],
        'T',
        'Desktop',
      );
      return out.html;
    },
    expect: '<div><span>{{ moi.nom }}</span></div>',
  },
  {
    /**
     * LE GARDE-FOU. Une retouche du designer qui retire le fragment ne doit PAS
     * produire un écran où la donnée ne s'affiche plus en silence : elle doit
     * arrêter la génération, EN NOMMANT le fragment. C'est le défaut de la même
     * famille que `cities.member_count`, écrit par personne, qui faisait trier la
     * carte par ordre alphabétique sans que rien ne le dise.
     */
    name: 'le fragment RETIRÉ de la maquette fait ÉCHOUER la génération, en le nommant',
    run: () => {
      try {
        applyData(
          '<div><span>Aminata Sow</span></div>',
          [{ noeud: '>Amina Diallo<', devient: '>{{ moi.nom }}<', why: '' }],
          'K01',
          'Desktop',
        );
        return 'aucune erreur — le défaut passerait en silence';
      } catch (e) {
        const nomme = e.message.includes('Amina Diallo');
        const situe = e.message.includes('K01') && e.message.includes('Desktop');
        return `refus:${nomme}:${situe}`;
      }
    },
    expect: 'refus:true:true',
  },
  {
    /** Un fragment DÉDOUBLÉ est aussi une dérive : on n'en lie pas deux au hasard. */
    name: 'un fragment qui apparaît DEUX fois là où on en déclare une fait échouer',
    run: () => {
      try {
        applyData(
          '<b>Lyon</b><i>Lyon</i>',
          [{ noeud: '>Lyon<', devient: '>{{ ville }}<', why: '' }],
          'T',
          'Mobile',
        );
        return 'aucune erreur';
      } catch (e) {
        return e.message.includes('figure 2 fois') ? 'refus' : `autre : ${e.message}`;
      }
    },
    expect: 'refus',
  },
  {
    /**
     * LE TROISIÈME CONTRÔLE, celui d'`applyBorrows`. Un mot inventé n'est dessiné
     * nulle part dans le fragment qu'il remplace : sans ce contrôle, « lier une
     * donnée » redeviendrait « redessiner un peu », et le peu ne se relit jamais.
     */
    name: 'un mot AJOUTÉ que la maquette n’écrit pas là fait échouer',
    run: () => {
      try {
        applyData(
          '<span>Lyon</span>',
          [{ noeud: '>Lyon<', devient: '>Ville de {{ ville }}<', why: '' }],
          'T',
          'Desktop',
        );
        return 'aucune erreur';
      } catch (e) {
        return e.message.includes('Ville de') ? 'refus' : `autre : ${e.message}`;
      }
    },
    expect: 'refus',
  },
  {
    /**
     * LA RÈGLE « NE PAS ASSOMBRIR LES COULEURS » DEVIENT EXÉCUTABLE. Huit paires
     * de ce projet passent sous le seuil AA, et c'est une décision assumée du
     * porteur. Une liaison qui en profiterait pour corriger une teinte en passant
     * est refusée par le même contrôle, sans qu'il ait fallu l'écrire pour ça.
     */
    name: 'une couleur RETOUCHÉE au passage est refusée par le même contrôle',
    run: () => {
      try {
        applyData(
          '<span style="color:#5D6B66">Lyon</span>',
          [
            {
              noeud: '<span style="color:#5D6B66">Lyon</span>',
              devient: '<span style="color:#2A3330">{{ ville }}</span>',
              why: '',
            },
          ],
          'T',
          'Desktop',
        );
        return 'aucune erreur';
      } catch (e) {
        return e.message.includes('#2A3330') ? 'refus' : `autre : ${e.message}`;
      }
    },
    expect: 'refus',
  },
  {
    /**
     * UN REMONTAGE DOIT SE DÉCLARER. Deux fragments recollés dans l'autre sens ne
     * passent pas le curseur : il faut alors les DÉCLARER en `motifs`, c'est-à-dire
     * le dire. C'est la même discipline que celle d'un emprunt qui assemble deux
     * sources et doit se lire comme tel.
     */
    name: 'deux fragments REMONTÉS à l’envers sont refusés tant qu’ils ne sont pas déclarés',
    run: () => {
      const cadre = '<b>Un</b><i>Deux</i>';
      const lien = {
        noeud: '<b>Un</b><i>Deux</i>',
        devient: '<i>Deux</i><b>{{ x }}</b>',
        why: '',
      };
      let sansMotif = 'aucune erreur';
      try {
        applyData(cadre, [lien], 'T', 'Desktop');
      } catch {
        sansMotif = 'refus';
      }
      const avecMotif = applyData(
        cadre,
        [{ ...lien, motifs: ['<i>Deux</i>'] }],
        'T',
        'Desktop',
      ).html;
      return `${sansMotif}|${avecMotif}`;
    },
    expect: 'refus|<i>Deux</i><b>{{ x }}</b>',
  },
  {
    /**
     * UNE DONNÉE DOIT EN ÊTRE UNE. Un `devient` sans interpolation recopierait le
     * fragment à l'identique : le journal annoncerait une donnée et l'écran
     * garderait la valeur de la maquette. C'est le mensonge le plus difficile à
     * repérer, puisque tout compile et que l'écran a l'air juste.
     */
    name: 'une liaison SANS interpolation est refusée : elle ne lierait rien',
    run: () => {
      try {
        applyData('<span>Lyon</span>', [{ noeud: '>Lyon<', devient: '>Lyon<', why: '' }], 'T', 'D');
        return 'aucune erreur';
      } catch (e) {
        return e.message.includes('aucune interpolation') ? 'refus' : `autre : ${e.message}`;
      }
    },
    expect: 'refus',
  },
  {
    /** Un titre lié reste promu : c'est le cas K02, « Fatou Ndiaye » devenue donnée. */
    name: 'un titre devenu donnée est repris sur sa forme liée, et le dit',
    run: () => {
      const applied = [{ noeud: '>Fatou Ndiaye<', devient: '>{{ membre.nom }}<', why: '' }];
      const spec = { text: 'Fatou Ndiaye', tag: 'h1', requires: SHAPED, key: 'title', label: 'F' };
      const { spec: repris, lie } = retitrerSurDonnees(spec, applied);
      return `${repris.text}|${lie}`;
    },
    expect: '{membre.nom}|{membre.nom}',
  },
  {
    /**
     * MUTATION TÉMOIN. On change ce qui NE DÉCIDE DE RIEN — la phrase du journal —
     * et le résultat doit être IDENTIQUE. Si ce cas rougissait, un contrôle
     * s'appuierait sur `why`, c'est-à-dire sur de la prose.
     */
    name: 'témoin : changer la phrase du journal ne change RIEN au HTML produit',
    run: () => {
      const cadre = '<span>Lyon</span>';
      const lien = { noeud: '>Lyon<', devient: '>{{ ville }}<' };
      const a = applyData(cadre, [{ ...lien, why: 'une phrase' }], 'T', 'Desktop').html;
      const b = applyData(cadre, [{ ...lien, why: 'une TOUTE AUTRE phrase' }], 'T', 'Desktop').html;
      return a === b ? `identique:${a}` : `divergent:${a}≠${b}`;
    },
    expect: 'identique:<span>{{ ville }}</span>',
  },
  {
    /**
     * LA MAQUETTE ELLE-MÊME, et non un fragment fabriqué pour le test : les
     * déclarations de `08 Compte` doivent s'appliquer sur les vrais cadres. C'est
     * le cas qui casse le jour où le designer retouche la planche.
     */
    name: 'la maquette elle-même : les deux listes de K04 se lient sur le vrai cadre',
    run: () => {
      const compte = SCREENS.find((s) => s.section === 'K04' && s.donnees !== undefined);
      const section = extractSection(readFileSync(resolve(ROOT, compte.file), 'utf8'), 'K04');
      const inner = extractFrame(section, 1440).inner;
      const liens = compte.donnees.filter((d) => d.frames?.includes('Desktop') === true);
      const out = applyData(inner, liens, 'K04', 'Desktop');
      return [
        out.html.includes('<sc-for list="{{ telephones }}" as="t">'),
        out.html.includes('<sc-for list="{{ sessions }}" as="s">'),
        out.html.includes('<sc-if value="{{ s.courante }}">'),
        // Les numéros d'exemple de la maquette ont DISPARU du cadre lié : c'est ce
        // qui prouve que l'écran affichera ceux de l'API, et non les siens.
        out.html.includes('+229 •• •• •• 42'),
      ].join(',');
    },
    expect: 'true,true,true,false',
  },
];

if (process.argv.includes('--self-test')) {
  let failed = 0;
  for (const t of [...TITLE_TESTS, ...FRAME_TESTS, ...DATA_TESTS]) {
    let got;
    try {
      got = t.run();
    } catch (e) {
      got = `exception : ${e.message}`;
    }
    const ok = got === t.expect;
    if (!ok) failed += 1;
    console.log(`  ${ok ? '✓' : '✗'} ${t.name}`);
    if (!ok) console.log(`      attendu « ${t.expect} », obtenu « ${got} »`);
  }
  const total = TITLE_TESTS.length + FRAME_TESTS.length + DATA_TESTS.length;
  if (failed > 0) {
    console.error(`\n${failed} cas sur ${total} ne se comporte(nt) pas comme documenté.\n`);
    process.exit(1);
  }
  console.log(
    `\n  ${total} cas : LEQUEL des titres et QUEL texte promouvoir restent deux questions,\n` +
      '  une planche est désignée par ce qu’elle est, et une donnée liée à un fragment\n' +
      '  disparu de la maquette ARRÊTE la génération au lieu de s’effacer en silence.\n',
  );
  process.exit(0);
}

/**
 * UN CADRE PEUT VENIR D'UNE AUTRE SECTION QUE SON ÉCRAN, et c'est la maquette
 * « 03 Accueil v2 » qui l'impose, pas un confort d'outillage.
 *
 * Huit de ses écrans — A03, A04, A05, A07, A08, A09, A10, A12 — n'ont AUCUN cadre
 * de 390 px dans leur propre section. Leurs cadres mobiles sont rassemblés dans
 * deux planches à part, que la maquette intitule « Versions mobiles » (MOB) et
 * « Versions mobiles réseau et ville » (MOB2), et qui les annoncent une par une :
 * « A03 · Guides — liste », « A04 · Guide — lecture (lecteur) »…
 *
 * Autrement dit, MOB et MOB2 NE SONT PAS des écrans : ce sont les cadres mobiles
 * des écrans voisins, regroupés pour la lecture de la planche. Les déclarer comme
 * des écrans à part produirait huit pages mobiles orphelines, sans route et sans
 * rapport avec leur cadre d'ordinateur — exactement la dérive que le transcodage
 * cherche à éviter.
 *
 * D'où `frame.section` : un cadre dit d'où il vient quand ce n'est pas de la
 * section de son écran. C'est une ligne dans la déclaration, et elle rend le lien
 * LISIBLE là où la maquette l'écrit en prose sous ses planches.
 */
for (const screen of SCREENS) {
  const html = readFileSync(resolve(ROOT, screen.file), 'utf8');

  for (const frame of screen.frames) {
    const section = extractSection(html, frame.section ?? screen.section);
    /**
     * `frame.width` est la largeur que la planche DÉCLARE — un nombre de pixels, ou
     * une chaîne pour toute autre valeur CSS (`'100%'`). `frame.requires` est le
     * discriminant de style, pour une planche qu'une autre de même largeur imite.
     * Voir `extractFrame` : la place de `width:` dans le style n'entre plus en jeu,
     * et `stylePrefix` a disparu avec elle.
     */
    const raw = extractFrame(section, frame.width, frame.occurrence ?? 0, frame.requires ?? '');
    /**
     * L'EMPRUNT PASSE AVANT TOUT LE RESTE, et il le doit : `adaptModalFrame`
     * promeut les fermetures en boutons, et une croix empruntée qui arriverait
     * après lui resterait un `<span>` mort. Voir `applyBorrows`.
     */
    const borrowsForFrame = (screen.borrows ?? []).filter(
      (b) => b.frames === undefined || b.frames.includes(frame.name),
    );
    const borrowed = applyBorrows(raw.inner, borrowsForFrame, screen.section);
    raw.inner = borrowed.html;
    /**
     * Une MODALE n'est pas un écran : elle se superpose à celui qui est déjà là.
     * Deux artifices de planche doivent donc tomber — le fond fantôme qui esquisse
     * l'écran sous-jacent, et le `position: absolute` qui se cale sur le cadre de
     * 1440 px au lieu de la fenêtre. Voir `adaptModalFrame`.
     */
    const modal = screen.modal === true ? adaptModalFrame(raw.inner, raw.openTag, section) : null;
    /**
     * UN DÉCLENCHEUR PEUT NE VALOIR QUE POUR CERTAINS CADRES.
     *
     * La maquette ne dessine pas le même contrôle aux deux largeurs : « Inviter »
     * porte son texte sur ordinateur et se réduit à un « + » sans texte dans
     * l'en-tête mobile. Un marqueur visant le tracé de cette icône est juste sur
     * la planche mobile et AMBIGU sur celle d'ordinateur, qui en compte trois.
     *
     * Sans `frames`, le déclencheur vaut pour tous les cadres — c'est le cas
     * courant, et celui des quatre modales du fil.
     */
    const triggersForFrame = (screen.triggers ?? []).filter(
      (t) => t.frames === undefined || t.frames.includes(frame.name),
    );
    const triggered = markTriggers(modal === null ? raw.inner : modal.inner, triggersForFrame);
    /**
     * LA LIAISON DES DONNÉES PASSE EN DERNIER SUR LE HTML, et l'ordre se justifie
     * aux deux bouts.
     *
     * APRÈS `markTriggers` et `adaptModalFrame` : leurs marqueurs sont des textes de
     * la maquette (« Ajouter aux contacts</button> »), et une liaison posée avant eux
     * les ferait chercher un texte qui n'existe plus — la fenêtre deviendrait
     * inatteignable, avec pour seul indice un `⚠` à l'autre bout du journal.
     *
     * AVANT `transcode` : c'est là toute l'idée. Le dialecte injecté suit le chemin
     * DÉJÀ existant — `transcode` en fait du JSX, `collectProps` en déduit la
     * signature du cadre — donc aucune ligne n'est ajoutée à l'émetteur, et la forme
     * produite est celle de `screens/a01`, pas une seconde forme à côté.
     */
    const donneesForFrame = (screen.donnees ?? []).filter(
      (d) => d.frames === undefined || d.frames.includes(frame.name),
    );
    const bound = applyData(triggered.html, donneesForFrame, screen.section, frame.name);
    const inner = bound.html;
    const {
      adapted: jsx, counts, promotedHeading, headingAlreadyThere,
      roles, fields, buttons, missedFields,
    } = adaptFrame(transcode(inner), screen.section, screen.modal === true);

    // Le libellé accessible est recopié du texte visible : s'il a changé dans la
    // maquette, on refuse de générer plutôt que de laisser dériver un nom que
    // personne ne relit.
    for (const control of INTERACTIVE_ROLES) {
      if (!roles.has(control.handler) || control.label === undefined) continue;
      if (!inner.includes(control.label)) {
        throw new Error(
          `${screen.section} : « ${control.label} » (nom accessible de ${control.handler}) ` +
            `ne figure plus dans la maquette. Mettre INTERACTIVE_ROLES à jour.`,
        );
      }
    }
    // La COQUE du cadre porte parfois une donnée — `background: {{ writeBg }}` sur
    // l'étape 1 de A14 — et elle ne figure pas dans `inner`, qui s'arrête au `>` de
    // la balise ouvrante. Sans cette ligne, le composant lisait une variable qu'il
    // n'avait pas déclarée : erreur à la compilation, et non pas en silence.
    const scanned = screen.keepFrameStyle === true ? raw.openTag + inner : inner;
    const used = collectProps(scanned, [...fields, ...buttons], jsx);

    // Le repère principal vit avec le CONTENU, pas dans le conteneur de mise en
    // page. La maquette du fil écrit déjà son `<main>` autour de la colonne
    // centrale ; l'envelopper d'un second serait invalide, et ferait mesurer le
    // conteneur à tout test qui cherche `main`.
    /**
     * UNE MODALE N'EST PAS UN REPÈRE `main`, et ne doit surtout pas en porter un.
     *
     * `<main>` désigne le contenu principal de la page — il y en a exactement un,
     * et c'est celui de l'écran qui est DERRIÈRE la modale. En envelopper une
     * seconde donnerait deux `main` dans le document dès qu'une fenêtre s'ouvre,
     * ce qu'aucun lecteur d'écran ne sait interpréter. Le rôle correct est
     * `dialog`, et c'est le composant `Modal` qui le pose, avec le piège au
     * clavier et `aria-labelledby` — voir `apps/web/src/components/modal.tsx`.
     */
    const isModal = screen.modal === true;
    /**
     * L'UNIQUE POINT DE PROMOTION D'UN TITRE DÉCLARÉ.
     *
     * Deux questions, deux fonctions, un seul appel : `titleFor` dit LEQUEL des
     * titres vaut pour ce cadre, `promoteTitle` dit QUEL élément le porte. Voir le
     * bloc « LE TITRE D'UN CADRE » — il explique pourquoi les deux axes ne peuvent
     * pas se confondre, et ce qu'il en coûte de les aplatir.
     *
     * Le titre balisé par la maquette PASSE DEVANT : quand `promoteFirstHeading` a
     * déjà donné son `<h1>` au cadre, la déclaration ne s'applique pas. C'est ce qui
     * interdit STRUCTURELLEMENT le second `<h1>` qu'une promotion inconditionnelle
     * rendait possible. Une fenêtre, elle, n'a pas de `<h1>` à disputer : son titre
     * est un `<h2>` que `aria-labelledby` désigne, et il est toujours promu.
     */
    const retitre = retitrerSurDonnees(titleFor(screen, frame), bound.applied);
    const spec = retitre.spec;
    const titled = isModal || !promotedHeading
      ? promoteTitle(jsx, spec)
      : { jsx, promoted: false, id: null };
    const hasLandmark = /<main[\s>]/.test(titled.jsx);
    const wrapped = isModal
      ? titled.jsx
      : hasLandmark
        ? titled.jsx
        : `      <main style={{ display: "contents" }}>\n${titled.jsx}\n      </main>`;

    /**
     * LA COQUE DU CADRE, gardée seulement quand l'écran la réclame.
     *
     * Le conteneur extérieur d'un cadre est RETIRÉ par défaut : c'est lui qui porte
     * la taille fixe de la planche, et `ScreenFrames` fournit tout le reste — fond,
     * `display: flex`, position relative. Vingt-et-un cadres sur vingt-deux n'y
     * mettent rien d'autre.
     *
     * A14 fait exception, et le retrait y était destructeur : ses quatre étapes
     * mettent dans ce conteneur leur remplissage (`48px 16px 26px`), leur couleur de
     * texte (`#fff`) et un fond qui est une DONNÉE — `background: {{ writeBg }}`,
     * la couleur choisie dans la palette. Sans la coque, du texte blanc se dessinait
     * sur un fond clair, collé aux bords de l'écran.
     *
     * Ce qui est retiré de la coque est exactement ce qui appartenait à la PLANCHE :
     * la taille fixe, le rayon du téléphone dessiné, son cadre et le `overflow` qui
     * coupait ce qui dépasse. Le reste est du design, et reste.
     */
    /**
     * UNE CARTE N'EST PAS UNE PLANCHE, et `frameIsCard` est la différence.
     *
     * Tout ce qui précède suppose que le conteneur extérieur d'un cadre DESSINE LA
     * PLANCHE : le rectangle de 1440 × 760 px, le téléphone de 390 × 844 px, leur
     * rayon, leur trait `#DDE3E0` et le `overflow: hidden` qui coupe ce qui dépasse.
     * Retirer tout cela est juste, et c'est le cas de tous les cadres transcodés
     * jusqu'ici.
     *
     * D01 est le premier où cette supposition est FAUSSE. La maquette n'y dessine
     * aucune planche : elle pose directement les trois cartes de connexion, 420 px
     * de large, fond blanc, bordure `#DDE3E0`, rayon 28 px, remplissage 24 px. Ce
     * conteneur EST la carte — le retirer laissait un bloc blanc sans bord, sans
     * coin arrondi et étalé sur toute la largeur de la fenêtre. Le défaut se voit à
     * l'œil, mais rien ne l'aurait dit : le JSX compile parfaitement.
     *
     * Ce qui reste retiré ici, c'est exactement ce qui est INCOMPATIBLE avec un
     * écran réel :
     *   · `height`, qui figerait la carte à la hauteur de l'image ;
     *   · la largeur fixe, qui devient `width: 100%` borné par `maxWidth` — c'est
     *     la même adaptation que celle appliquée aux planches, « une maquette est
     *     une image de taille fixe », sauf qu'ici la borne est GARDÉE : 420 px est
     *     la largeur voulue de la carte, pas celle de l'écran qui la porte.
     */
    const PLANK_ONLY = new Set(['width', 'height', 'borderRadius', 'overflow', 'flexShrink']);
    const CARD_DROPPED = new Set(['height']);
    const asCard = screen.frameIsCard === true;
    const shell =
      screen.keepFrameStyle !== true && !asCard
        ? null
        : (() => {
            const style = /style=\{\{ ([^}]*) \}\}/.exec(transcode(raw.openTag));
            if (style === null) return null;
            const kept = style[1]
              .split(/, (?=[A-Za-z'-]+:)/)
              .filter((entry) => {
                const key = entry.slice(0, entry.indexOf(':'));
                if (asCard) return !CARD_DROPPED.has(key);
                // La bordure de la planche est `1px solid #DDE3E0` — le trait qui
                // dessine le téléphone. Une bordure d'une AUTRE valeur serait du
                // design, donc on ne retire que celle-là.
                if (key === 'border') return !entry.includes('#DDE3E0');
                return !PLANK_ONLY.has(key);
              })
              .map((entry) =>
                asCard && entry.startsWith('width:')
                  ? `width: "100%", maxWidth: "${frame.width}px"`
                  : entry,
              );
            return kept.length === 0 ? null : kept.join(', ');
          })();

    const shelled =
      shell === null ? wrapped : `      <div style={{ ${shell} }}>\n${wrapped}\n      </div>`;

    const destructure =
      used.length === 0
        ? ''
        : `  const { ${used.join(', ')} } = props;\n\n`;
    const signature = used.length === 0 ? `_props: ${screen.dataType}` : `props: ${screen.dataType}`;

    const body = `${HEADER(frame.section ?? screen.section, frame.width, screen.file, screen.dataModule, screen.dataType, shelled.includes('<Fragment'))}export function ${screen.section}${frame.name}(${signature}) {
${destructure}  return (
    <>
${shelled}
    </>
  );
}
`;
    mkdirSync(resolve(ROOT, screen.out), { recursive: true });
    const path = resolve(ROOT, screen.out, `${frame.name.toLowerCase()}.generated.tsx`);
    writeFileSync(path, body, 'utf8');
    // La section d'origine est dite quand ce n'est pas celle de l'écran : les cadres
    // mobiles de huit écrans vivent dans les planches MOB et MOB2.
    const origin = frame.section === undefined ? '' : ` [section ${frame.section} n° ${(frame.occurrence ?? 0) + 1}]`;
    console.log(`  ${screen.section} ${frame.width} px${origin} → ${path.replace(ROOT + '/', '')} (${jsx.length} caractères, ${used.length} données)`);
    if (asCard) {
      console.log(
        shell === null
          ? '      ⚠ cadre déclaré « carte » mais son conteneur ne porte aucun style : rien à garder.'
          : `      Conteneur gardé : ce cadre est une CARTE, pas une planche ; sa largeur de ${frame.width} px devient une borne.`,
      );
    }
    adaptationsFor(screen.modal === true).forEach((a, i) => {
      if (counts[i] > 0) console.log(`      ${counts[i]}× ${a.why}`);
    });
    for (const control of INTERACTIVE_ROLES) {
      if (roles.has(control.handler)) console.log(`      ${control.why}`);
    }
    for (const field of fields) console.log(`      ${field.why}`);
    /**
     * L'EMPRUNT SE LIT DANS LE JOURNAL, AVEC SA MAQUETTE SOURCE.
     *
     * Une liberté prise sur la maquette doit se lire — et se lire JUSTE. Le
     * journal de ce dépôt a déjà affirmé qu'un voile venait « des planches mobiles
     * de la section » alors qu'il venait d'une autre maquette ; la ligne ci-dessous
     * nomme le fichier que le générateur a réellement lu, pas celui qu'on croyait.
     */
    for (const b of borrowed.applied) {
      // TOUTES les maquettes d'où l'emprunt tire quelque chose, pas seulement la
      // principale : un emprunt qui assemble deux sources doit se lire comme tel.
      const sources = [...new Set(b.motifs.map((m) => m.from))].join(' + ');
      console.log(
        b.temoin === true
          ? `      Témoin d’emprunt : le motif est toujours dessiné dans ${sources}. ${b.why}`
          : `      Emprunt à ${sources} : ${b.why}`,
      );
      /**
       * LE TEXTE QUI NE VIENT D'AUCUNE MAQUETTE EST DIT, à chaque exécution.
       *
       * C'est la seule chose d'un écran transcodé qui n'ait pas été dessinée. Un
       * relecteur qui tombe dessus six mois plus tard doit pouvoir le savoir sans
       * remonter à cette discussion — sinon il le prendra pour du transcodage, et
       * cherchera dans la maquette une phrase qui n'y est pas.
       */
      for (const phrase of b.texte ?? []) {
        console.log(
          `      ⚠ texte fourni par le porteur, aucune maquette ne l’écrit : « ${phrase} »`,
        );
      }
    }
    /**
     * UNE DONNÉE QUI REMPLACE UN TEXTE DE MAQUETTE SE LIT, à chaque exécution.
     *
     * C'est la même exigence que pour le `texte` d'un emprunt, et pour la même
     * raison : un relecteur qui tombe six mois plus tard sur un écran où « Amina
     * Diallo » a disparu doit pouvoir savoir que c'est une LIAISON, pas une
     * maquette qui aurait changé. Le journal nomme le littéral de la maquette et
     * l'expression qui le remplace — la liaison n'est jamais silencieuse.
     */
    for (const d of bound.applied) {
      const exprs = [...new Set([...d.devient.matchAll(/\{\{\s*([\s\S]+?)\s*\}\}/g)].map((m) => m[1]))];
      const combien = d.fois === 1 ? '' : ` (${d.fois} occurrences)`;
      const abrege = d.noeud.length > 70 ? `${d.noeud.slice(0, 70)}…` : d.noeud;
      console.log(
        `      Donnée « ${exprs.join(' · ')} » ← « ${abrege} »${combien} : ${d.why}`,
      );
      for (const motif of d.motifs) {
        console.log(
          `        motif réemployé, dessiné dans ${motif.from ?? 'ce cadre'} : « ${motif.pattern.slice(0, 60)}… »`,
        );
      }
      for (const phrase of d.texte ?? []) {
        console.log(
          `      ⚠ texte fourni par le porteur, aucune maquette ne l’écrit : « ${phrase} »`,
        );
      }
    }
    if (retitre.lie !== null) {
      console.log(`      Titre lié à une donnée : il sera promu sur « ${retitre.lie} ».`);
    }
    for (const b of buttons) console.log(`      Bouton « ${b.label} » branché.`);
    for (const why of missedFields) console.log(`      ⚠ adaptation attendue introuvable : ${why}`);
    if (modal !== null) {
      // Les comptes sont rapportés parce que l'absence est licite : deux des huit
      // cadres de modale n'ont pas de fond fantôme. C'est donc le CHIFFRE qui
      // signale une maquette qui aurait changé de forme, jamais une exception.
      console.log(
        `      Modale : ${modal.ghosts} fantôme(s) retiré(s), ${modal.scenery} décor(s) de l’écran de dessous retiré(s), ${modal.overlays} voile et ${modal.panels} panneau marqués, ${modal.fixed} en position: fixed, ${modal.closers} fermeture(s) promue(s) en bouton.`,
      );
      if (modal.borrowedVeil) {
        /**
         * La planche d'ordinateur de cette modale est une CARTE NUE : ni voile ni
         * positionnement. Le cadre devient le panneau, centré avec les valeurs que
         * `03 Accueil` écrit pour ses propres fenêtres, et le voile est emprunté aux
         * planches mobiles de la MÊME section. On refuse de produire si le motif
         * recopié a disparu de sa maquette d'origine : sans cette vérification, la
         * recopie dériverait en silence.
         */
        const source = readFileSync(resolve(ROOT, MODAL_WINDOW_SOURCE.file), 'utf8');
        if (!source.includes(MODAL_WINDOW_SOURCE.pattern)) {
          throw new Error(
            `${screen.section} : le centrage de fenêtre « ${MODAL_WINDOW_SOURCE.pattern} » ` +
              `ne figure plus dans ${MODAL_WINDOW_SOURCE.file}. Mettre MODAL_WINDOW_CENTRING à jour.`,
          );
        }
                /**
         * LE VOILE DE REPLI EST VÉRIFIÉ COMME LE CENTRAGE, et pour la même raison.
         *
         * Une maquette qui ne dessine aucun voile — `08 Compte` n'en a pas un seul —
         * reçoit celui des quatre fenêtres du fil. Sans cette vérification, la
         * recopie dériverait en silence le jour où ces planches changent de teinte,
         * et le défaut ne se verrait que sur la maquette qui n'en a pas.
         */
        if (modal.veilFrom === 'source' && !source.includes(MODAL_WINDOW_SOURCE.veil)) {
          throw new Error(
            `${screen.section} : le voile de fenêtre « ${MODAL_WINDOW_SOURCE.veil} » ` +
              `ne figure plus dans ${MODAL_WINDOW_SOURCE.file}. Mettre MODAL_WINDOW_SOURCE.veil à jour.`,
          );
        }
        /**
         * D'OÙ VIENT LE VOILE, dit dans le journal. Un emprunt hors maquette est une
         * liberté, et une liberté se lit. Le journal affirmait « emprunté aux planches
         * mobiles de la section » même quand il venait d'ailleurs.
         */
        const origineVoile =
          modal.veilFrom === 'section'
            ? 'voile emprunté aux planches mobiles de la section'
            : `voile emprunté à ${MODAL_WINDOW_SOURCE.file} — cette maquette n’en dessine aucun`;
        console.log(
          `      Carte nue : le cadre devient le panneau, centré comme les fenêtres de ${MODAL_WINDOW_SOURCE.file} ; ${origineVoile}.`,
        );
      }
      if (modal.closers === 0) {
        console.log(
          '      ⚠ aucune fermeture promue : ni croix ni poignée reconnue. La modale ne se fermera qu’au voile et à Échap.',
        );
      }
      if (modal.overlays !== 1 || modal.panels !== 1) {
        console.log(
          `      ⚠ ${modal.overlays} voile et ${modal.panels} panneau : « Modal » attend exactement un de chaque. Un clic hors panneau ne fermera pas ce qu’on croit.`,
        );
      }
    }
    for (const t of triggered.applied) {
      console.log(
        `      Déclencheur de ${t.modal} branché sur « ${t.marker.replace('</svg>', '')} » (${t.count} bouton${t.count > 1 ? 's' : ''})${t.label === undefined ? '' : `, nommé « ${t.label} »`}.`,
      );
      if (t.silent > 0) {
        /**
         * axe-core relève ce cas en `critical` (`button-name`), et §10.6 exige
         * « un nom accessible sur tout élément interactif ». Le générateur le dit
         * AVANT le contrôle, parce qu'il est le seul à savoir que le bouton
         * qu'il vient de créer ne contient qu'une icône.
         */
        console.log(
          `      ⚠ ${t.silent} bouton(s) créé(s) autour d’une ICÔNE SEULE, sans nom accessible : ajouter « label » au déclencheur de ${t.modal}.`,
        );
      }
    }
    for (const t of triggered.missed) {
      console.log(
        `      ⚠ déclencheur de ${t.modal} introuvable (« ${t.marker} ») : la modale sera inatteignable depuis cet écran.`,
      );
    }
    /**
     * UNE SEULE CHAÎNE DE JUGEMENT, et non trois journaux côte à côte.
     *
     * Les mécanismes réunis plus haut avertissaient chacun pour les cadres que
     * l'autre avait traités : le compte est passé de 10 à 47 « aucun titre » d'un
     * coup, tous faux. Un avertissement qui crie à tort en cache un vrai — c'est
     * exactement ce que ce journal existe pour éviter.
     *
     * Chaque cadre est donc jugé UNE fois. `spec.key` nomme la clé à corriger, pour
     * que l'avertissement ne puisse plus accuser la mauvaise déclaration.
     */
    if (isModal) {
      if (titled.promoted) {
        console.log(`      Titre promu en <h2 id="${titled.id}"> : la boîte de dialogue le désignera par aria-labelledby.`);
      } else {
        console.log(
          `      ⚠ titre « ${spec?.label ?? '(non déclaré)'} » introuvable : la modale n’aura pas de nom accessible. ` +
            `Corriger « ${spec?.key ?? 'modalTitle'} » dans sa déclaration.`,
        );
      }
    } else {
      if (!hasLandmark) console.log('      Repère `main` ajouté : la maquette n’en a pas.');
      if (headingAlreadyThere) {
        console.log('      <h1> déjà dans la maquette : aucun <h2> promu (ses <h2> sont les sections du contenu).');
      } else if (titled.promoted) {
        console.log(`      Titre déclaré « ${spec.label} » promu en <h1> : ce cadre n’en balise aucun.`);
      } else if (spec !== undefined && !promotedHeading) {
        console.log(
          `      ⚠ titre déclaré « ${spec.label} » introuvable dans ce cadre : la page n’aura pas de <h1>. ` +
            `Corriger « ${spec.key} » dans sa déclaration.`,
        );
      } else if (!promotedHeading) {
        console.log('      ⚠ aucun <h2> à promouvoir en <h1> : la page n’aura pas de titre');
      }
    }
  }
}
