#!/usr/bin/env node
/**
 * Garde-fou : deux clés identiques posées par deux diffusions conditionnelles
 * dans le même littéral d'objet.
 *
 * Ce motif est partout dans le dépôt, et il est légitime :
 *
 *   { ...(a ? { x: 1 } : {}), ...(b ? { y: 2 } : {}) }
 *
 * Il devient un bogue dès que deux diffusions posent la MÊME clé : en
 * JavaScript la seconde écrase la première, sans erreur, sans avertissement de
 * `tsc`, et sans que `no-dupe-keys` d'ESLint ne voie quoi que ce soit — la règle
 * ne regarde que les clés écrites littéralement.
 *
 * Ce n'est pas une hypothèse. Le motif a produit deux vrais défauts, dans deux
 * modules écrits séparément :
 *
 *   · entraide — deux clés `author:` dans un `where` Prisma : le filtre de phase
 *     écrasait le filtre de visibilité, et les comptes désactivés ou supprimés
 *     revenaient dans la liste dès qu'on filtrait par phase ;
 *   · villes — deux clés `profile:` : un visiteur anonyme qui filtrait par statut
 *     d'occupation perdait la condition `isPublic: true`, et l'annuaire lui
 *     rendait des profils que leurs propriétaires avaient choisi de ne pas
 *     publier.
 *
 * Les deux ne se voient que sur la COMBINAISON de deux filtres. Chacun pris
 * seul fonctionne, ce qui explique qu'ils aient passé la relecture.
 *
 * CE QU'IL N'ATTRAPE PAS, et il faut le savoir.
 *
 * Le contrôle lit des LITTÉRAUX. Il voit `...(cond ? { author: … } : {})`, il ne
 * voit pas `...(await this.baseWhere(…))` — il ne peut pas savoir quelles clés une
 * fonction renvoie. Or c'est exactement la forme du bogue de l'entraide : le
 * filtre de visibilité arrivait d'un appel, et la clé `author` du filtre de phase
 * l'écrasait. Ce garde-fou ne l'aurait pas vu.
 *
 * Il couvre donc le cas littéral-contre-littéral, celui de l'annuaire des villes.
 * Contre l'autre, la défense reste le test : **éprouver la COMBINAISON de deux
 * filtres, jamais chacun seul**. C'est la leçon commune aux deux défauts, et elle
 * vaut plus que cet outil.
 *
 * Vérifié en réintroduisant les deux bogues : celui des villes est signalé, celui
 * de l'entraide ne l'est pas. Un garde-fou dont on ne connaît pas la portée donne
 * une fausse assurance.
 */
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');

/**
 * Les clés posées DIRECTEMENT dans un littéral par une diffusion conditionnelle.
 *
 * « Directement » est tout l'enjeu, et ma première version l'a manqué : elle
 * comptait les clés à toutes les profondeurs, et signalait donc deux objets
 * imbriqués distincts qui emploient chacun `notIn` ou `OR`. Dix faux positifs
 * pour deux vrais défauts — un garde-fou qu'on apprend à ignorer ne sert plus à
 * rien.
 *
 * On suit donc la profondeur des accolades depuis l'ouverture du littéral, et on
 * ne retient que les clés introduites au premier niveau.
 */
function duplicateSpreadKeysAt(source, open) {
  const seen = new Map();
  const duplicates = [];

  let depth = 0;
  let i = open;

  while (i < source.length) {
    const c = source[i];

    if (c === '{') depth += 1;
    else if (c === '}') {
      depth -= 1;
      if (depth === 0) break;
    }

    // Une diffusion conditionnelle ouverte au premier niveau du littéral.
    if (depth === 1 && source.startsWith('...(', i)) {
      // La première clé qu'elle pose : `...(cond ? { clé: … } : {})`.
      const rest = source.slice(i, i + 400);
      const key = /^\.\.\.\([^)]*?\{\s*([A-Za-z_$][\w$]*)\s*:/.exec(rest);
      if (key !== null) {
        const count = (seen.get(key[1]) ?? 0) + 1;
        seen.set(key[1], count);
        if (count === 2) duplicates.push(key[1]);
      }
    }

    i += 1;
  }

  return duplicates;
}

function lineOf(source, index) {
  return source.slice(0, index).split('\n').length;
}

const files = execSync('git ls-files "apps/**/*.ts" "packages/**/*.ts"', {
  cwd: ROOT,
  encoding: 'utf8',
})
  .split('\n')
  .filter((f) => f.length > 0 && !f.endsWith('.generated.tsx') && !f.includes('/dist/'));

const problems = [];

for (const file of files) {
  const source = readFileSync(resolve(ROOT, file), 'utf8');

  // Chaque `{` est un littéral candidat : on n'essaie pas de deviner lesquels
  // comptent, on les regarde tous au premier niveau.
  for (let i = 0; i < source.length; i += 1) {
    if (source[i] !== '{') continue;
    for (const key of duplicateSpreadKeysAt(source, i)) {
      problems.push({ file, line: lineOf(source, i), key });
    }
  }
}

if (problems.length === 0) {
  console.log('  aucune clé posée deux fois par deux diffusions conditionnelles.');
  process.exit(0);
}

console.error('\nDeux diffusions conditionnelles posent la MÊME clé — la seconde écrase la première :\n');
for (const p of problems) {
  console.error(`  ${p.file}:${p.line} — clé « ${p.key} » posée deux fois`);
}
console.error(
  '\nFusionnez les deux conditions en un seul objet. Ce motif a déjà produit deux\n' +
    'défauts réels : un filtre de visibilité écrasé dans l’entraide, et une fuite de\n' +
    'profils privés dans l’annuaire des villes. Les deux ne se voyaient que sur la\n' +
    'COMBINAISON de deux filtres.\n',
);
process.exit(1);
