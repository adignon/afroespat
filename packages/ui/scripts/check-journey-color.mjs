#!/usr/bin/env node
/**
 * Garde-fou : le terre cuite est RÉSERVÉ.
 *
 * RÈGLE DURE (T1 §2.1) : « La couleur parcours n'est utilisée que pour les usages
 * listés. Un contrôle automatique signale tout autre emploi. » Ce fichier est ce
 * contrôle.
 *
 * Deux régimes, parce que deux choses différentes se passent dans le code :
 *
 *  1. DÉFINIR une variante terre cuite dans une table de tons (`journey: '…'`) est
 *     autorisé partout. La variante est nommée, donc un relecteur la voit au point
 *     d'appel — `<Pill tone="journey">` se lit. Ce qu'il faut empêcher, c'est le
 *     terre cuite invisible.
 *  2. ÉCRIRE le terre cuite en dur n'est autorisé qu'aux entrées de la liste
 *     blanche, qui désigne soit un composant par son nom — `ScamAlert` —, soit
 *     une déclaration précise par `fichier:déclaration` — `PostCard.tsx:TYPE_STYLE`.
 *     La seconde forme existe parce qu'une table de styles vit au niveau du
 *     module, hors du composant : autoriser le composant entier serait plus
 *     large que nécessaire, et autoriser toute constante nommée TYPE_STYLE le
 *     serait dans tous les fichiers à la fois.
 *
 * La liste blanche vit dans packages/config/tokens.js : l'étendre est une décision,
 * pas un réflexe.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = resolve(here, '..', 'src');
const require = createRequire(import.meta.url);
const { journeyColorAllowlist } = require(resolve(here, '..', '..', 'config', 'tokens.js'));

const ALLOWED = new Set(journeyColorAllowlist);

const JOURNEY_PATTERN =
  /\b(?:bg|text|border|ring|from|to|via|fill|stroke)-journey(?:-\w+)?\b|--c-journey|#E0733A|#B4581F|#FBE3D4|#FFFBF8/i;

/** Une ligne qui DÉFINIT la variante : la clé est `journey` ou `terracotta`. */
const VARIANT_DEFINITION = /^\s*(?:journey|terracotta)\s*:/;

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.tsx?$/.test(full) && !/\.test\.tsx?$/.test(full)) out.push(full);
  }
  return out;
}

/**
 * Découpe en déclarations de premier niveau — `function`, `const`, `class`, avec ou
 * sans `export`. Sans cela, une constante de module est comptée dans le composant
 * qui la précède, ce qui rend le rapport faux.
 */
function splitTopLevel(source) {
  const re = /^(?:export\s+)?(?:default\s+)?(?:async\s+)?(function|const|let|class)\s+(\w+)/gm;
  const marks = [];
  let m;
  while ((m = re.exec(source)) !== null) {
    marks.push({ kind: m[1], name: m[2], index: m.index });
  }

  const lineOf = (index) => source.slice(0, index).split('\n').length;
  const blocks = [];

  if (marks.length === 0 || marks[0].index > 0) {
    blocks.push({ kind: 'preamble', name: '(préambule)', body: source.slice(0, marks[0]?.index ?? source.length), line: 1 });
  }
  for (let i = 0; i < marks.length; i += 1) {
    const start = marks[i].index;
    const end = i + 1 < marks.length ? marks[i + 1].index : source.length;
    blocks.push({
      kind: marks[i].kind,
      name: marks[i].name,
      body: source.slice(start, end),
      line: lineOf(start),
    });
  }
  return blocks;
}

/** Retire les commentaires : citer la règle dure dans un commentaire est légitime. */
function stripComments(code) {
  return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

const violations = [];
let definitions = 0;

for (const file of walk(srcDir)) {
  const source = readFileSync(file, 'utf8');

  for (const block of splitTopLevel(source)) {
    const isComponent = block.kind === 'function' && /^[A-Z]/.test(block.name);

    const fileName = file.split('/').pop() ?? file;
    const qualified = `${fileName}:${block.name}`;

    block.body.split('\n').forEach((line, i) => {
      const code = stripComments(line);
      if (!JOURNEY_PATTERN.test(code)) return;

      // Régime 1 : définir la variante, autorisé partout.
      if (VARIANT_DEFINITION.test(code)) {
        definitions += 1;
        return;
      }

      // Régime 2 : entrée de la liste blanche, par composant ou par déclaration.
      if (isComponent && ALLOWED.has(block.name)) return;
      if (ALLOWED.has(qualified)) return;

      violations.push(
        `${relative(process.cwd(), file)}:${block.line + i} — ${block.name} : ${code.trim().slice(0, 88)}`,
      );
    });
  }
}

if (violations.length > 0) {
  console.error('Garde-fou terre cuite — échec (règle dure T1 §2.1) :');
  for (const v of violations) console.error(`  · ${v}`);
  console.error(
    `\nComposants autorisés : ${[...ALLOWED].sort().join(', ')}.\n` +
      'Un usage légitime de plus s’ajoute à journeyColorAllowlist dans\n' +
      'packages/config/tokens.js — donc se discute, ne se glisse pas.',
  );
  process.exit(1);
}

console.log(
  `Garde-fou terre cuite : ${ALLOWED.size} composants autorisés, ${definitions} définitions de variante, aucun emploi hors liste.`,
);
