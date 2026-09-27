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
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { extractFrame, extractSection, transcode } from './dc-to-jsx.mjs';

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
  {
    why: 'Les 50 px du haut simulaient l’encoche ; un écran réel lit la zone sûre.',
    match: (style) => style.includes('padding: "50px 16px 0"'),
    apply: (style) =>
      style.replace(
        'padding: "50px 16px 0"',
        'padding: "calc(env(safe-area-inset-top, 0px) + 16px) 16px 0"',
      ),
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
    match: (style) =>
      style.includes('width: "300px"') &&
      style.includes('flexDirection: "column"') &&
      style.includes('flexShrink: "0"') &&
      !style.includes('position:'),
    // 76 px = les 64 de la barre haute + 12 de respiration. En collant à 12,
    // la colonne passerait SOUS la barre au lieu de s'arrêter dessous.
    apply: (style) =>
      `${style}, position: "sticky", top: "76px", alignSelf: "flex-start", maxHeight: "calc(100vh - 88px)", overflowY: "auto"`,
  },
  {
    why: 'La barre d’onglets basse doit rester visible quand la page défile.',
    match: (style) => style.includes('borderTop: "1px solid #E6EBE9"') && style.includes('repeat(5,1fr)'),
    apply: (style) =>
      style
        .replace('position: "relative"', 'position: "sticky"')
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
const BUTTON_ACTIONS = [
  { label: 'Recevoir le code', attrs: ['onClick={onSubmit}', 'disabled={busy}'] },
  { label: 'Continuer', attrs: ['onClick={onContinue}', 'disabled={busy}'] },
];

/**
 * Branche les boutons. Ne touche JAMAIS un bouton qui a déjà un `onClick` :
 * « Créer mon parcours maintenant » porte celui de la maquette, et l'écraser
 * casserait l'interrupteur de l'écran O03.
 */
function adaptButtons(jsx) {
  const applied = [];
  let out = jsx;

  for (const action of BUTTON_ACTIONS) {
    const pattern = new RegExp(`<button((?:(?!onClick)[^>])*?)>(\\s*)${action.label}</button>`);
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

  for (const transform of [CITY_SEARCH, CITY_ROWS]) {
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
function promoteFirstHeading(jsx) {
  const i = jsx.indexOf('<h2');
  if (i === -1) return { jsx, promoted: false };
  const close = jsx.indexOf('</h2>', i);
  if (close === -1) return { jsx, promoted: false };

  const promoted =
    `${jsx.slice(0, i)}<h1${jsx.slice(i + 3, close)}</h1>${jsx.slice(close + 5)}`;
  return { jsx: promoted, promoted: true };
}

const ALL_ADAPTATIONS = [...FRAME_ADAPTATIONS, ...TOUCH_TARGET_ADAPTATIONS];

function adaptFrame(jsx, section) {
  const counts = ALL_ADAPTATIONS.map(() => 0);
  const roles = new Set();

  const adapted = jsx.replace(/<(\w+)([^>]*?style=\{\{ [^}]* \}\}[^>]*?)(\/?)>/g, (whole, tag, attrs, selfClose) => {
    const styleMatch = /style=\{\{ ([^}]*) \}\}/.exec(attrs);
    if (styleMatch === null) return whole;

    let style = styleMatch[1];
    const extra = [];

    ALL_ADAPTATIONS.forEach((adaptation, i) => {
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

  const heading = promoteFirstHeading(adapted);
  const fields = adaptFields(heading.jsx, section);
  const buttons = adaptButtons(fields.jsx);
  return {
    adapted: buttons.jsx,
    counts,
    promotedHeading: heading.promoted,
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
const SCREENS = [
  {
    file: 'docs/template/03 Accueil v2.dc.html',
    section: 'A01',
    out: 'apps/web/src/screens/a01',
    dataModule: './data',
    dataType: 'A01Data',
    frames: [
      { width: 1440, name: 'Desktop' },
      { width: 390, name: 'Mobile' },
    ],
  },

  // ── Lot 1 · accès et onboarding (01 Accès et Onboarding.dc.html) ──────────
  //
  // Les huit sections partagent UN SEUL jeu de données et UN SEUL état, comme
  // dans la maquette : un unique `renderVals()` les sert toutes. Les séparer
  // donnerait huit copies de `seg()` et des barres de progression qui
  // divergeraient.
  ...[
    { section: 'P01', frames: [1440, 390] },
    { section: 'P02', frames: [1440, 390] },
    // 560 px : la variante « Ressources », pas un mobile.
    { section: 'P03', frames: [1440, 560], names: ['Desktop', 'Ressources'] },
    { section: 'O01', frames: [1440, 390] },
    { section: 'O02', frames: [1440, 390] },
    { section: 'O03', frames: [1440, 390] },
    { section: 'O04', frames: [1440, 390] },
    // O05 n'a pas de cadre mobile : deux variantes de 700 px, « avec parcours »
    // et « sans parcours » — les deux atterrissages de §5, écran 6.
    { section: 'O05', frames: [700, 700], names: ['AvecParcours', 'SansParcours'] },
  ].map((s) => ({
    file: 'docs/template/01 Accès et Onboarding.dc.html',
    section: s.section,
    out: `apps/web/src/screens/${s.section.toLowerCase()}`,
    dataModule: '../onboarding/data',
    dataType: 'OnboardingVals',
    frames: s.frames.map((width, i) => ({
      width,
      name: s.names?.[i] ?? (i === 0 ? 'Desktop' : 'Mobile'),
      // Deux cadres de MÊME largeur dans une section : il faut prendre le
      // second, pas rechercher la même ouverture deux fois.
      occurrence: s.frames.indexOf(width) === i ? 0 : i,
    })),
  })),
];

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

function collectProps(sectionHtml, frameHtml, appliedFields = [], producedJsx = '') {
  const loopVars = new Set();
  for (const m of sectionHtml.matchAll(/<sc-for[^>]*\bas="([^"]+)"/g)) {
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

for (const screen of SCREENS) {
  const html = readFileSync(resolve(ROOT, screen.file), 'utf8');
  const section = extractSection(html, screen.section);

  for (const frame of screen.frames) {
    const { inner } = extractFrame(section, frame.width, frame.occurrence ?? 0);
    const { adapted: jsx, counts, promotedHeading, roles, fields, buttons, missedFields } = adaptFrame(transcode(inner), screen.section);

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
    const used = collectProps(section, inner, [...fields, ...buttons], jsx);

    // Le repère principal vit avec le CONTENU, pas dans le conteneur de mise en
    // page. La maquette du fil écrit déjà son `<main>` autour de la colonne
    // centrale ; l'envelopper d'un second serait invalide, et ferait mesurer le
    // conteneur à tout test qui cherche `main`.
    const hasLandmark = /<main[\s>]/.test(jsx);
    const wrapped = hasLandmark
      ? jsx
      : `      <main style={{ display: "contents" }}>\n${jsx}\n      </main>`;

    const destructure =
      used.length === 0
        ? ''
        : `  const { ${used.join(', ')} } = props;\n\n`;
    const signature = used.length === 0 ? `_props: ${screen.dataType}` : `props: ${screen.dataType}`;

    const body = `${HEADER(screen.section, frame.width, screen.file, screen.dataModule, screen.dataType, wrapped.includes('<Fragment'))}export function ${screen.section}${frame.name}(${signature}) {
${destructure}  return (
    <>
${wrapped}
    </>
  );
}
`;
    mkdirSync(resolve(ROOT, screen.out), { recursive: true });
    const path = resolve(ROOT, screen.out, `${frame.name.toLowerCase()}.generated.tsx`);
    writeFileSync(path, body, 'utf8');
    console.log(`  ${screen.section} ${frame.width} px → ${path.replace(ROOT + '/', '')} (${jsx.length} caractères, ${used.length} données)`);
    ALL_ADAPTATIONS.forEach((a, i) => {
      if (counts[i] > 0) console.log(`      ${counts[i]}× ${a.why}`);
    });
    for (const control of INTERACTIVE_ROLES) {
      if (roles.has(control.handler)) console.log(`      ${control.why}`);
    }
    for (const field of fields) console.log(`      ${field.why}`);
    for (const b of buttons) console.log(`      Bouton « ${b.label} » branché.`);
    for (const why of missedFields) console.log(`      ⚠ adaptation attendue introuvable : ${why}`);
    if (!hasLandmark) console.log('      Repère `main` ajouté : la maquette n’en a pas.');
    if (!promotedHeading) {
      console.log('      ⚠ aucun <h2> à promouvoir en <h1> : la page n’aura pas de titre');
    }
  }
}
