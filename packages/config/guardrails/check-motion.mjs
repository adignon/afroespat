#!/usr/bin/env node
/**
 * Garde-fou : le mouvement reste pauvre.
 *
 * T1 §1 veut une interface « plus calme » — les membres sont souvent en
 * situation de stress administratif. Une animation de trop va contre le produit,
 * et les animations de trop arrivent une par une, chacune paraissant anodine.
 *
 * Ce contrôle refuse :
 *   · toute durée supérieure à 300 ms ;
 *   · toute courbe hors des deux autorisées ;
 *   · les animations décoratives — rebond, pulsation, rotation, ping.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { easing, MAX_DURATION_MS } = require(resolve(here, '..', 'motion.js'));

const ROOTS = [
  resolve(here, '..', '..', 'ui', 'src'),
  resolve(here, '..', '..', '..', 'apps', 'web', 'src'),
];

const ALLOWED_EASINGS = new Set([...Object.values(easing), 'ease', 'ease-out', 'ease-in-out']);

/** Classes Tailwind d'animation décorative, et leurs équivalents bruts. */
const DECORATIVE = /\banimate-(?:bounce|ping|pulse|spin)\b|animation:\s*[a-z-]*(?:bounce|pulse|spin|shake)/i;

function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    // Les tests citent les animations interdites pour vérifier leur ABSENCE :
    // les scanner reviendrait à sanctionner le contrôle qui protège la règle.
    else if (/\.(tsx?|css)$/.test(full) && !/\.test\.|__tests__|\/e2e\/|\/visual\//.test(full)) {
      out.push(full);
    }
  }
  return out;
}

const violations = [];
let durations = 0;

for (const root of ROOTS) {
  for (const file of walk(root)) {
    const source = readFileSync(file, 'utf8');

    source.split('\n').forEach((line, i) => {
      const where = `${relative(process.cwd(), file)}:${i + 1}`;

      // Le squelette de chargement a droit à sa pulsation : c'est le seul
      // mouvement qui DIT quelque chose — « ça arrive » — plutôt que de décorer.
      // T1 §5 l'exige d'ailleurs : « squelettes, jamais de spinner central ».
      const isSkeleton = /skeleton/i.test(line) || /skeleton/i.test(file);
      if (DECORATIVE.test(line) && !isSkeleton) {
        violations.push(`${where} — animation décorative : ${line.trim().slice(0, 70)}`);
      }

      for (const m of line.matchAll(/(\d+(?:\.\d+)?)m?s\b/g)) {
        const raw = m[0];
        if (!/duration|transition|animation/i.test(line)) continue;
        const ms = raw.endsWith('ms') ? Number(m[1]) : Number(m[1]) * 1000;
        durations += 1;
        if (ms > MAX_DURATION_MS && ms > 1) {
          violations.push(`${where} — ${raw} dépasse le plafond de ${MAX_DURATION_MS} ms`);
        }
      }

      for (const m of line.matchAll(/cubic-bezier\([^)]*\)/g)) {
        if (!ALLOWED_EASINGS.has(m[0])) {
          violations.push(`${where} — courbe hors table : ${m[0]}`);
        }
      }
    });
  }
}

if (violations.length > 0) {
  console.error('Garde-fou mouvement — échec (T1 §1 : l’interface rassure, elle ne stimule pas) :');
  for (const v of violations) console.error(`  · ${v}`);
  console.error('\nLes cinq mouvements autorisés vivent dans packages/config/motion.js.');
  process.exit(1);
}

console.log(`Garde-fou mouvement : ${durations} durées vérifiées, aucune au-delà de ${MAX_DURATION_MS} ms.`);
