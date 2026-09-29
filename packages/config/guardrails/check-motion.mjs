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
 *
 * ── CE CONTRÔLE A MENTI, ET VOICI POURQUOI ────────────────────────────────────
 *
 * Il lit `packages/ui/src` et `apps/web/src` — des fichiers HORS de son propre
 * paquet, donc hors de l'empreinte que Turbo calcule pour décider s'il peut
 * rejouer un cache. Résultat : `pnpm guardrails` rendait **0** avec une vraie
 * violation en place, pendant que ce script, lancé directement, rendait **1**.
 *
 * Mesuré, pas supposé : une règle `transition: width 900ms` ajoutée à
 * `packages/ui/src/styles.css` → `pnpm guardrails` sortie 0, `node
 * packages/config/guardrails/check-motion.mjs` sortie 1.
 *
 * L'étape « garde-fous » de la barre de qualité était donc inopérante sur
 * EXACTEMENT les fichiers qu'un lot fait changer. Un contrôle qui dit toujours oui
 * vaut moins qu'un contrôle absent : on cesse de le regarder.
 *
 * Corrigé par `"cache": false` sur la tâche `guardrails` de `turbo.json` — que
 * JSON ne permet pas de commenter, d'où cette note ici.
 *
 * C'est la deuxième fois que ce dépôt voit un garde-fou mentir. La première, une
 * clé `guardrails` dupliquée dans `package.json` faisait que le second écrasait le
 * premier et que le contrôle ne tournait jamais. Le motif est le même : la mesure
 * existe, le chemin qui y mène est cassé. **Éprouver un garde-fou en lui donnant
 * une vraie violation est la seule façon de savoir qu'il fonctionne.**
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { easing, moments, MAX_DURATION_MS } = require(resolve(here, '..', 'motion.js'));

/**
 * LES MOMENTS EXEMPTÉS, et comment on les reconnaît.
 *
 * `motion.js` marque `journeyProgress` — 600 ms — d'un `exempt: true`, et explique
 * pourquoi : « on doit VOIR le chemin parcouru, c'est la raison d'être du produit,
 * et 300 ms ne suffisent pas à la rendre sensible ». Ce contrôle ne lisait pas ce
 * marqueur : il aurait refusé le seul mouvement que le système autorise
 * volontairement au-delà du plafond, le jour où une barre de progression bougerait.
 *
 * L'EXEMPTION EST DÉCLARÉE AU POINT D'USAGE, et c'est le point. Autoriser toute
 * durée de 600 ms laisserait passer n'importe quelle animation lente qui tomberait
 * sur ce chiffre — et l'exception, écrite une fois dans `motion.js`, deviendrait une
 * porte ouverte. La ligne doit donc NOMMER le moment :
 *
 *     transition: width 600ms cubic-bezier(0.16, 1, 0.3, 1);  // motion:journeyProgress
 *
 * C'est la même discipline que partout ailleurs ici : déclaré, jamais deviné. Et le
 * nom écrit à côté de la valeur est ce qui permettra, plus tard, de retrouver d'un
 * `grep` tous les endroits qui emploient ce moment.
 */
const EXEMPT = new Map(
  Object.entries(moments)
    .filter(([, m]) => m.exempt === true)
    .map(([name, m]) => [name, Number.parseInt(m.duration, 10)]),
);

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
        if (ms <= MAX_DURATION_MS || ms <= 1) continue;

        // Le moment nommé sur la ligne, s'il y en a un, et si sa durée correspond.
        const named = /motion:(\w+)/.exec(line);
        const allowed = named !== null && EXEMPT.get(named[1]) === ms;
        if (allowed) continue;

        violations.push(
          named === null
            ? `${where} — ${raw} dépasse le plafond de ${MAX_DURATION_MS} ms`
            : `${where} — ${raw} dépasse le plafond, et « ${named[1]} » ne l’autorise pas` +
              (EXEMPT.has(named[1])
                ? ` (il vaut ${EXEMPT.get(named[1])} ms)`
                : ' (ce moment n’est pas exempté dans motion.js)'),
        );
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
