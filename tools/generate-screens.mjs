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
import { readFileSync, writeFileSync } from 'node:fs';
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
const A11Y_ANNOTATIONS = [
  {
    why: 'Le lien de réglages du rail ne contient qu’une icône : il lui faut un nom.',
    match: (tag, attrs) =>
      tag === 'a' && attrs.includes('height: "48px"') && attrs.includes('color: "#CFE3DA"'),
    attrs: 'aria-label="Réglages"',
  },
];

/**
 * Applique les adaptations et compte celles qui ont servi.
 *
 * Travaille sur la BALISE OUVRANTE, pas seulement sur le style : certaines
 * adaptations doivent aussi ajouter un attribut — une zone défilable a besoin
 * de `tabIndex` pour être atteignable au clavier.
 */
function adaptFrame(jsx) {
  const counts = FRAME_ADAPTATIONS.map(() => 0);

  const adapted = jsx.replace(/<(\w+)([^>]*?style=\{\{ [^}]* \}\}[^>]*?)(\/?)>/g, (whole, tag, attrs, selfClose) => {
    const styleMatch = /style=\{\{ ([^}]*) \}\}/.exec(attrs);
    if (styleMatch === null) return whole;

    let style = styleMatch[1];
    const extra = [];

    FRAME_ADAPTATIONS.forEach((adaptation, i) => {
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

    const newAttrs = attrs.replace(/style=\{\{ [^}]* \}\}/, `style={{ ${style} }}`);
    const suffix = extra.length === 0 ? '' : ` ${extra.join(' ')}`;
    return `<${tag}${newAttrs}${suffix}${selfClose}>`;
  });

  return { adapted, counts };
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
    frames: [
      { width: 1440, name: 'Desktop', props: 'A01Data' },
      { width: 390, name: 'Mobile', props: 'A01Data' },
    ],
  },
];

const HEADER = (section, width, file) => `/* eslint-disable */
// GÉNÉRÉ depuis ${file}, section ${section}, cadre ${width} px.
// Ne pas modifier à la main : relancer \`node tools/generate-screens.mjs\`.
//
// Les styles en ligne sont ceux de la maquette, à l'identique. Le conteneur
// extérieur, lui, est fluide : la maquette le fige à ${width} px, ce qui ne
// serait pas responsive.
import { Fragment } from 'react';
import type { A01Data } from './data';

`;

for (const screen of SCREENS) {
  const html = readFileSync(resolve(ROOT, screen.file), 'utf8');
  const section = extractSection(html, screen.section);

  for (const frame of screen.frames) {
    const { inner } = extractFrame(section, frame.width);
    const { adapted: jsx, counts } = adaptFrame(transcode(inner));

    const body = `${HEADER(screen.section, frame.width, screen.file)}export function ${screen.section}${frame.name}(props: ${frame.props}) {
  const {
    rail, panelFil, shortcuts, stories, storyFilters, postTypes, feedPosts,
    events, arrivals, online, mTabs, mBottom,
  } = props;

  return (
    <>
${jsx}
    </>
  );
}
`;
    const path = resolve(ROOT, screen.out, `${frame.name.toLowerCase()}.generated.tsx`);
    writeFileSync(path, body, 'utf8');
    console.log(`  ${screen.section} ${frame.width} px → ${path.replace(ROOT + '/', '')} (${jsx.length} caractères)`);
    FRAME_ADAPTATIONS.forEach((a, i) => {
      if (counts[i] > 0) console.log(`      ${counts[i]}× ${a.why}`);
    });
  }
}
