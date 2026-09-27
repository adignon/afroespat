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

function adaptFrame(jsx) {
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
  return { adapted: heading.jsx, counts, promotedHeading: heading.promoted, roles };
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

function collectProps(sectionHtml, frameHtml) {
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
    const { adapted: jsx, counts, promotedHeading, roles } = adaptFrame(transcode(inner));

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
    const used = collectProps(section, inner);

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
    if (!hasLandmark) console.log('      Repère `main` ajouté : la maquette n’en a pas.');
    if (!promotedHeading) {
      console.log('      ⚠ aucun <h2> à promouvoir en <h1> : la page n’aura pas de titre');
    }
  }
}
