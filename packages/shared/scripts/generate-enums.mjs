#!/usr/bin/env node
/**
 * Génère packages/shared/src/enums/generated.ts depuis prisma/schema/*.prisma.
 *
 * Pourquoi générer plutôt que recopier : le modèle relationnel compte 95 enums.
 * Recopiés à la main, ils dérivent — et une dérive d'enum entre la base et le
 * front est un bogue silencieux. 00-fondations.md §6.1 demande d'ailleurs que les
 * enums PostgreSQL natifs soient « réexportés vers le code partagé » : ceci est
 * cette réexportation, sans intervention humaine.
 *
 * Le front n'a ainsi aucune dépendance au client Prisma : il importe @app/shared.
 *
 * La CI relance ce script et échoue si le fichier produit diffère de celui
 * commité (`pnpm --filter @app/shared generate:check`).
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const schemaDir = resolve(here, '..', '..', 'db', 'prisma', 'schema');
const outFile = resolve(here, '..', 'src', 'enums', 'generated.ts');

/** Extrait `enum Name { A B C }` en tolérant les commentaires /// et //. */
function parseEnums(source) {
  const found = [];
  const re = /(?:^|\n)enum\s+(\w+)\s*\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(source)) !== null) {
    const [, name, body] = m;
    const values = body
      .split('\n')
      .map((line) => line.replace(/\/\/.*$/, '').trim())
      .filter((line) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(line));
    if (values.length > 0) found.push({ name, values });
  }
  return found;
}

const files = readdirSync(schemaDir)
  .filter((f) => f.endsWith('.prisma'))
  .sort();

const enums = [];
for (const file of files) {
  const source = readFileSync(join(schemaDir, file), 'utf8');
  for (const e of parseEnums(source)) enums.push({ ...e, file });
}
enums.sort((a, b) => a.name.localeCompare(b.name));

const duplicates = enums
  .map((e) => e.name)
  .filter((name, i, all) => all.indexOf(name) !== i);
if (duplicates.length > 0) {
  console.error(`Enums déclarés deux fois dans le schéma : ${duplicates.join(', ')}`);
  process.exit(1);
}

const lines = [
  '/* eslint-disable */',
  '// GÉNÉRÉ depuis packages/db/prisma/schema/*.prisma — ne pas modifier à la main.',
  '// Régénérer : pnpm --filter @app/shared generate',
  '//',
  `// ${enums.length} enums, ${files.length} fichiers de schéma.`,
  '',
];

for (const { name, values, file } of enums) {
  lines.push(`/** Module ${file.replace(/\.prisma$/, '')}. */`);
  lines.push(`export const ${name} = [`);
  for (const v of values) lines.push(`  '${v}',`);
  lines.push('] as const;');
  lines.push(`export type ${name} = (typeof ${name})[number];`);
  lines.push('');
}

lines.push('/** Toutes les listes de valeurs, indexées par nom d’enum. */');
lines.push('export const ALL_ENUMS = {');
for (const { name } of enums) lines.push(`  ${name},`);
lines.push('} as const;');
lines.push('');

writeFileSync(outFile, lines.join('\n'), 'utf8');
console.log(`${enums.length} enums générés dans src/enums/generated.ts`);
