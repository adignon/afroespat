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

/**
 * LE TITRE DE PAGE D'UN CADRE QUI N'EN DESSINE PAS, déclaré par l'écran.
 *
 * Six cadres de « 03 Accueil v2 » n'ont ni `<h1>` ni `<h2>` : A05 (l'éditeur), A08
 * (un réseau), A12 (une fiche ville), A02, A13, A14. La maquette y écrit pourtant
 * un titre bien visible — « Nouveau guide », « Béninois en France », « Lyon » — mais
 * dans un `<div>`, parce qu'une planche de documentation n'a pas de plan de lecture
 * à tenir. Une PAGE en a un : sans `<h1>`, un lecteur d'écran ne sait pas de quoi
 * elle parle, et axe le signale (`page-has-heading-one`).
 *
 * Le texte est DÉCLARÉ avec l'écran, jamais deviné par un motif de style : les six
 * cadres ne le dessinent pas de la même façon (16 px pour A05, 24 px pour A08,
 * 30 px pour A12), et un motif assez large pour les couvrir attraperait aussi
 * « 1 050 € » — la médiane de budget de la fiche ville, qui fait aussi 30 px et
 * gras. Déclarer le texte visible le rend vérifiable d'un coup d'œil, et si la
 * maquette le change, l'outil ne trouve plus rien et LE DIT.
 *
 * `margin: 0` est ajouté pour la même raison que dans `promoteModalTitle` : un
 * `<h1>` arrive avec les marges du navigateur que le `<div>` n'avait pas, et sans
 * cette ligne le titre se déplacerait de quelques pixels.
 */
function promoteDeclaredHeading(jsx, title) {
  if (title === undefined) return { jsx, promoted: false };

  /**
   * Le marqueur inclut la FERMETURE : `>Lyon<`, et non `>Lyon`.
   *
   * La fiche ville écrit « Lyon » en 30 px, mais aussi « Réseau Lyon et Rhône » dans
   * sa colonne de contexte. Sans le `<` final, le titre déclaré « Lyon » collait au
   * préfixe du second et la page s'appelait « Lyon et Rhône ». Le `<` exige que
   * l'élément contienne le titre ET RIEN D'AUTRE, ce qui est vérifiable à l'œil dans
   * la maquette.
   */
  const marker = `>${title}<`;
  const at = jsx.indexOf(marker);
  if (at < 0) return { jsx, promoted: false };

  const open = jsx.lastIndexOf('<', at);
  const tagMatch = /^<(span|div)( [^>]*)>$/.exec(jsx.slice(open, at + 1));
  if (tagMatch === null) return { jsx, promoted: false };
  const [, tag, attrs] = tagMatch;

  const close = jsx.indexOf(`</${tag}>`, at);
  if (close === -1) return { jsx, promoted: false };
  // Le titre déclaré est un texte SIMPLE : s'il y a une balise entre lui et la
  // fermeture, le motif a attrapé autre chose et on refuse plutôt que de deviner.
  if (jsx.slice(at + 1, close).includes('<')) return { jsx, promoted: false };

  const newAttrs = attrs.replace(/style=\{\{ /, 'style={{ margin: "0", ');
  return {
    jsx: `${jsx.slice(0, open)}<h1${newAttrs}>${jsx.slice(at + 1, close)}</h1>${jsx.slice(close + tag.length + 3)}`,
    promoted: true,
  };
}

const ALL_ADAPTATIONS = [...FRAME_ADAPTATIONS, ...TOUCH_TARGET_ADAPTATIONS];

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
 * LE TITRE D'UNE MODALE est DÉCLARÉ PAR L'ÉCRAN, pas deviné, et pas dans une table
 * globale.
 *
 * Une modale ne prend PAS le `<h1>` de la page : le `<h1>` appartient à l'écran qui
 * est derrière, et il ne disparaît pas parce qu'une fenêtre s'ouvre par-dessus. Ce
 * qu'il faut, c'est que la boîte de dialogue porte un nom accessible — c'est
 * `aria-labelledby` qui le lui donne, et il lui faut donc un élément à désigner.
 *
 * Le titre est déclaré avec l'écran (`modalTitle`), texte visible compris, et non
 * déduit d'un motif de style. Les modales ne le dessinent pas de la même façon :
 * `<span>` de 18 px pour les commentaires (avec un compteur imbriqué), `<span>` de
 * 20 px pour le partage et le sondage, `<div>` de 20 px pour le guide. Un motif qui
 * couvrirait les quatre attraperait aussi des sous-titres, en silence. Et si la
 * maquette change son texte, la déclaration ne correspond plus et l'outil le DIT.
 *
 * Il vivait dans une table indexée par section, ici même. La sortir de ce fichier
 * est la même décision que pour les déclarations d'écran : cinquante-sept modales
 * restent à transcoder, et une table partagée serait un conflit de fusion à chaque
 * contribution.
 */
/**
 * Promeut l'élément qui porte le titre en `<h2 id="…">`, style inchangé.
 *
 * `margin: 0` est AJOUTÉ, et c'est la seule liberté : un `<h2>` arrive avec des
 * marges par défaut du navigateur que le `<span>` ou le `<div>` d'origine n'avait
 * pas. Sans cette ligne, changer la balise déplacerait le titre de quelques pixels
 * — le design ne serait plus celui de la maquette, pour une raison invisible à la
 * lecture du code.
 */
/**
 * Promeut en `tag` l'élément dont le contenu COMMENCE par `text`.
 *
 * `requires` est le fragment de style qui LÈVE L'AMBIGUÏTÉ, et il est
 * indispensable : « Checklist de documents » figure DEUX FOIS dans le cadre
 * d'ordinateur de J06 — une fois comme entrée du panneau de gauche, une fois
 * comme titre de la page. Le premier des deux dans l'ordre du document est
 * l'entrée du panneau. Sans discriminant, c'est elle qu'on promouvrait en titre
 * de page, et le défaut serait invisible : le texte affiché est le même.
 *
 * On PARCOURT donc toutes les occurrences et on retient la première qui porte
 * ce style. Une seule occurrence était examinée auparavant ; les quatre modales
 * déjà transcodées tombaient sur la bonne du premier coup, la régénération le
 * confirme.
 */
function promoteTextTo(jsx, { text, tag: as, id, requires }) {
  const marker = `>${text}`;
  for (let at = jsx.indexOf(marker); at >= 0; at = jsx.indexOf(marker, at + 1)) {
    // Remonter à l'ouverture de la balise qui contient ce texte.
    const open = jsx.lastIndexOf('<', at);
    const tagMatch = /^<(span|div)( [^>]*)>$/.exec(jsx.slice(open, at + 1));
    if (tagMatch === null) continue;
    const [, tag, attrs] = tagMatch;
    /**
     * SANS DISCRIMINANT, ON EN FABRIQUE UN — et ce n'est pas un raffinement.
     *
     * `attrs.includes(undefined)` compare littéralement la chaîne « undefined » :
     * aucun candidat ne passe, et le titre est déclaré introuvable. C'est ce qui
     * est arrivé à la fusion — vingt-sept cadres d'entraide et d'agenda, déjà
     * livrés, ont perdu leur `<h1>` d'un coup, avec un avertissement qui accusait
     * la déclaration alors que le défaut était ici.
     *
     * Mais se contenter de sauter le contrôle serait pire : on prendrait la
     * PREMIÈRE occurrence du texte, et sur ces maquettes la première est souvent
     * l'entrée du panneau de gauche — « Mes demandes », « Checklist de documents »
     * figurent deux fois. Le titre promu serait le mauvais, et invisiblement,
     * puisque le texte affiché est le même.
     *
     * À défaut de discriminant déclaré, on demande donc à l'élément de RESSEMBLER
     * à un titre : au moins 16 px et une graisse d'au moins 700. C'est la règle
     * qu'un lot parallèle avait trouvée de son côté, et elle distingue un titre
     * d'écran d'une pastille de filtre portant le même mot.
     */
    if (requires === undefined) {
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
        /**
         * `margin: 0` est AJOUTÉ, et c'est la seule liberté : un titre arrive avec
         * les marges par défaut du navigateur, que le `<span>` ou le `<div>`
         * d'origine n'avait pas. Sans cette ligne, changer la balise déplacerait le
         * titre — le design ne serait plus celui de la maquette, pour une raison
         * invisible à la lecture du code. Sur un `<h1>` la marge par défaut fait
         * 0,67 em, soit une vingtaine de pixels à 30 px de corps.
         */
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

function promoteModalTitle(jsx, section, title) {
  if (title === undefined) return { jsx, promoted: false, id: null };
  return promoteTextTo(jsx, {
    text: title,
    tag: 'h2',
    id: `${section.toLowerCase()}-titre`,
    requires: 'fontWeight: "800"',
  });
}

/**
 * LE TITRE D'UNE PAGE, quand la maquette n'écrit aucun `<h2>`.
 *
 * `04 Parcours` n'en contient pas un seul — `01 Accès` en a seize, `03 Accueil`
 * onze. Ses trente cadres de page arrivaient donc SANS AUCUN TITRE : rien à
 * promouvoir en `<h1>`, et un lecteur d'écran qui arrive sur `/parcours/:id` ne
 * sait pas de quoi la page parle.
 *
 * Le titre est donc DÉCLARÉ avec le cadre — son texte visible et son corps —
 * exactement comme celui d'une modale, et pour la même raison : la maquette les
 * dessine tous différemment (30 px sur J01, 18 px sur J01D, 16 px sur les
 * en-têtes mobiles), et un motif qui couvrirait les trente attraperait aussi des
 * sous-titres, en silence.
 *
 * Le CORPS est ce qui distingue le titre de son homonyme du panneau de gauche.
 *
 * Aucun `id` n'est posé, à la différence d'une modale : `ScreenFrames` rend LES
 * DEUX cadres et en masque un — deux fois le même identifiant dans le document.
 * Un `<h1>` n'a besoin d'aucun identifiant, donc on n'en met pas.
 */
/** Le libellé d'un titre, qu'il soit une chaîne ou un objet `{ text, size }`. */
function titleLabel(title) {
  if (title === undefined) return '(non déclaré)';
  return typeof title === 'string' ? title : `${title.text} (${title.size})`;
}

function promoteScreenTitle(jsx, title) {
  if (title === undefined) return { jsx, promoted: false, id: null };
  /**
   * `title` ACCEPTE DEUX FORMES, parce que deux lots l'ont inventée séparément :
   * une simple chaîne (le texte visible) ou un objet `{ text, size }` qui ajoute
   * un discriminant de taille.
   *
   * Le discriminant n'est pas un raffinement : « Checklist de documents » figure
   * DEUX FOIS dans un cadre de parcours — une fois comme entrée du panneau de
   * gauche, une fois comme titre de page — et c'est l'entrée du panneau qui vient
   * en premier dans le document. Sans lui, on promeut la mauvaise, et le défaut
   * est invisible : le texte affiché est le même.
   *
   * Là où une chaîne suffit, elle suffit. Exiger l'objet partout obligerait à
   * relire la taille de quarante-quatre titres qui n'ont aucune ambiguïté.
   */
  if (typeof title === 'string') {
    return promoteTextTo(jsx, { text: title, tag: 'h1' });
  }
  return promoteTextTo(jsx, { text: title.text, tag: 'h1', requires: `fontSize: "${title.size}"` });
}


/** La table à employer : celle des modales exclut l'adaptation du contenu qui coule. */
function adaptationsFor(modal) {
  if (!modal) return ALL_ADAPTATIONS;
  const flowing = FRAME_ADAPTATIONS.findIndex((a) => a.why.includes('doit couler'));
  const kept = FRAME_ADAPTATIONS.filter((_, i) => i !== flowing);
  return [...MODAL_ADAPTATIONS, ...kept, ...TOUCH_TARGET_ADAPTATIONS];
}

function adaptFrame(jsx, section, modal = false, heading = undefined) {
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

  // Le `<h2>` de la maquette d'abord — c'est le cas courant. Le titre DÉCLARÉ n'est
  // une solution de repli que pour les cadres qui n'écrivent aucun titre balisé.
  const fromMarkup = promoteFirstHeading(adapted);
  const title = fromMarkup.promoted ? fromMarkup : promoteDeclaredHeading(fromMarkup.jsx, heading);
  const fields = adaptFields(title.jsx, section);
  const buttons = adaptButtons(fields.jsx, section);
  return {
    adapted: buttons.jsx,
    counts,
    promotedHeading: title.promoted,
    headingAlreadyThere: fromMarkup.alreadyThere === true,
    headingDeclared: !fromMarkup.promoted && title.promoted,
    headingDeclaredMissed: !fromMarkup.promoted && !title.promoted && heading !== undefined,
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
    const raw = extractFrame(section, frame.width, frame.occurrence ?? 0);
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
    const inner = triggered.html;
    const {
      adapted: jsx, counts, promotedHeading, headingAlreadyThere, headingDeclared,
      headingDeclaredMissed, roles, fields, buttons, missedFields,
    } = adaptFrame(
      transcode(inner),
      screen.section,
      screen.modal === true,
      // Le titre déclaré peut l'être par le CADRE — A14 dessine quatre étapes, donc
      // quatre titres différents — ou par l'écran quand ses cadres le partagent.
      frame.heading ?? screen.heading,
    );

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
    const screenTitle = isModal ? { jsx, promoted: false } : promoteScreenTitle(jsx, frame.title);
    const titled = isModal
      ? promoteModalTitle(jsx, screen.section, screen.modalTitle)
      : { jsx: screenTitle.jsx, promoted: false, id: null };
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
    if (isModal) {
      if (titled.promoted) {
        console.log(`      Titre promu en <h2 id="${titled.id}"> : la boîte de dialogue le désignera par aria-labelledby.`);
      } else {
        console.log(
          `      ⚠ titre « ${screen.modalTitle ?? '(non déclaré)'} » introuvable : la modale n’aura pas de nom accessible. Corriger « modalTitle » dans sa déclaration.`,
        );
      }
    } else if (!hasLandmark) {
      console.log('      Repère `main` ajouté : la maquette n’en a pas.');
    }
    /**
     * DEUX MÉCANISMES DE TITRE COHABITENT ICI, et c'est une dette assumée.
     *
     * Deux lots parallèles ont eu le même besoin — aucune de ces maquettes n'a de
     * `<h2>` à promouvoir — et l'ont résolu séparément : `heading` déclaré par écran
     * d'un côté, `title` déclaré par cadre de l'autre. Les deux marchent, chacun sur
     * ses déclarations, et les fusionner pendant l'intégration de trente-et-un
     * écrans aurait été le meilleur moyen de casser les deux.
     *
     * Ce qu'ils apportent séparément, et qu'une version unifiée devra garder :
     *   · `heading` garde le `<h1>` que la maquette écrit DÉJÀ — c'est lui qui a
     *     révélé un second `<h1>` sur la politique de confidentialité, présent
     *     depuis le début ;
     *   · `title` reconnaît le titre par une MESURE (≥ 16 px, graisse ≥ 700) et
     *     parcourt toutes les occurrences, ce qui le distingue d'une pastille de
     *     filtre portant le même mot — cas réel sur H05.
     *
     * À unifier dans un lot qui ne fait que cela.
     */
    /**
     * UNE SEULE CHAÎNE, et non deux journaux côte à côte.
     *
     * Les deux mécanismes réunis plus haut avertissaient chacun pour les écrans que
     * l'autre avait traités : le compte est passé de 10 à 47 « aucun titre » d'un
     * coup, tous faux. Un avertissement qui crie à tort en cache un vrai — c'est
     * exactement ce que ce journal existe pour éviter.
     *
     * Chaque cadre est donc jugé UNE fois, par le mécanisme qu'il emploie.
     */
    if (!isModal) {
      if (headingAlreadyThere) {
        console.log('      <h1> déjà dans la maquette : aucun <h2> promu (ses <h2> sont les sections du contenu).');
      } else if (headingDeclared) {
        console.log(`      Titre déclaré « ${frame.heading ?? screen.heading} » promu en <h1> : ce cadre n’en balise aucun.`);
      } else if (screenTitle.promoted) {
        console.log(`      Titre « ${titleLabel(frame.title)} » promu en <h1>.`);
      } else if (headingDeclaredMissed) {
        console.log(
          `      ⚠ titre déclaré « ${frame.heading ?? screen.heading} » introuvable : la page n’aura pas de titre. Corriger « heading » dans sa déclaration.`,
        );
      } else if (frame.title !== undefined) {
        console.log(
          `      ⚠ titre déclaré « ${titleLabel(frame.title)} » introuvable dans ce cadre : la page n’aura pas de <h1>. ` +
            'Corriger « title » dans la déclaration du cadre.',
        );
      } else if (!promotedHeading) {
        console.log('      ⚠ aucun <h2> à promouvoir en <h1> : la page n’aura pas de titre');
      }
    }
  }
}
