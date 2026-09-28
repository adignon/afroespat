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
 *
 * `--self-test` éprouve cette portée AUTOMATIQUEMENT, sur des fragments écrits
 * plus bas : ce que l'outil doit signaler, ce qu'il doit taire. Un garde-fou qui
 * affirme sa portée dans un commentaire ne la garantit pas — j'ai déjà eu une
 * clé `guardrails` dupliquée dans un package.json qui faisait qu'un contrôle ne
 * tournait jamais, et son « OK » ne mesurait rien.
 *
 * DEUX FAUX POSITIFS CORRIGÉS, tous deux venus de l'outil et non du code :
 *
 *   · un COMMENTAIRE qui cite le motif pour l'expliquer était lu comme du code.
 *     Les commentaires et les chaînes sont désormais blanchis avant l'analyse —
 *     remplacés par des espaces, pour que les numéros de ligne restent justes.
 *   · deux conditions EXCLUSIVES sur la même valeur (`s === 'A'` puis
 *     `s === 'B'`) ne peuvent pas s'écraser : la seconde ne s'applique jamais
 *     quand la première s'applique. Elles sont désormais reconnues et tues.
 *
 * La deuxième exemption est étroite À DESSEIN : elle ne vaut que pour deux
 * comparaisons `===` de la MÊME expression à deux littéraux DIFFÉRENTS. Toute
 * autre forme d'exclusivité — `a` puis `!a`, deux `in`, deux bornes numériques —
 * reste signalée, parce que la prouver demanderait de raisonner sur le programme
 * et qu'un garde-fou qui se trompe dans ce sens-là laisse passer le bogue.
 */
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');

/**
 * Blanchit commentaires et chaînes : chaque caractère est remplacé par une
 * espace, jamais supprimé, pour que les index — donc les numéros de ligne —
 * restent ceux du fichier d'origine.
 *
 * Nécessaire parce qu'un commentaire qui EXPLIQUE ce motif le contient
 * forcément, et que l'outil signalait alors sa propre documentation.
 */
function blankNonCode(source) {
  const out = source.split('');
  let i = 0;
  const blank = (from, to) => {
    for (let k = from; k < to && k < out.length; k += 1) {
      if (out[k] !== '\n') out[k] = ' ';
    }
  };

  while (i < source.length) {
    const two = source.slice(i, i + 2);
    if (two === '//') {
      const end = source.indexOf('\n', i);
      const stop = end === -1 ? source.length : end;
      blank(i, stop);
      i = stop;
    } else if (two === '/*') {
      const end = source.indexOf('*/', i + 2);
      const stop = end === -1 ? source.length : end + 2;
      blank(i, stop);
      i = stop;
    } else if (source[i] === "'" || source[i] === '"' || source[i] === '`') {
      const quote = source[i];
      let j = i + 1;
      while (j < source.length) {
        if (source[j] === '\\') j += 2;
        else if (source[j] === quote) break;
        else j += 1;
      }
      // Le contenu est blanchi, les délimiteurs restent : un littéral de chaîne
      // demeure visible comme littéral, ce dont l'exclusivité a besoin.
      blank(i + 1, j);
      i = j + 1;
    } else {
      i += 1;
    }
  }

  return out.join('');
}

/**
 * Deux conditions ne peuvent-elles JAMAIS être vraies ensemble ?
 *
 * On ne répond `true` que dans un seul cas, volontairement étroit : deux
 * comparaisons `===` de la même expression à deux littéraux différents. C'est la
 * forme qu'on rencontre réellement (`status === 'COMPLETED'` puis
 * `status === 'ACTIVE'`), et c'est la seule qu'on puisse affirmer sans raisonner
 * sur le reste du programme.
 */
function provablyExclusive(a, b) {
  const shape = /^(.+?)\s*===\s*('[^']*'|"[^"]*"|[0-9]+|null|undefined|true|false)$/;
  const ma = shape.exec(a.trim());
  const mb = shape.exec(b.trim());
  if (ma === null || mb === null) return false;
  return ma[1].trim() === mb[1].trim() && ma[2] !== mb[2];
}

/** La condition d'une diffusion conditionnelle : le texte entre `...(` et son `?`. */
function conditionOf(source, start) {
  let depth = 0;
  for (let i = start + 4; i < source.length; i += 1) {
    const c = source[i];
    if (c === '(' || c === '[' || c === '{') depth += 1;
    else if (c === ')' || c === ']' || c === '}') {
      if (depth === 0) return null;
      depth -= 1;
    } else if (c === '?' && depth === 0) {
      return source.slice(start + 4, i);
    }
  }
  return null;
}

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
  // clé → { index, condition } de la PREMIÈRE diffusion qui l'a posée.
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
      const rest = source.slice(i, i + 400);
      /**
       * La première clé que la diffusion pose.
       *
       * Le `[:}]` final accepte aussi la forme ABRÉGÉE `{ status }`, que la
       * version précédente ignorait entièrement — deux diffusions posant la même
       * clé abrégée passaient donc inaperçues.
       *
       * L'objet peut être dans l'une ou l'autre branche : `cond ? { x } : {}` ou
       * `cond ? {} : { x }`. Le `{}` vide ne satisfait pas le motif, la
       * recherche paresseuse poursuit, et c'est bien la clé POSÉE qui est lue.
       */
      const key = /^\.\.\.\([^)]*?\{\s*([A-Za-z_$][\w$]*)\s*[:}]/.exec(rest);
      if (key !== null) {
        const condition = conditionOf(source, i) ?? '';
        const first = seen.get(key[1]);
        if (first === undefined) {
          seen.set(key[1], { index: i, condition });
        } else if (!provablyExclusive(first.condition, condition)) {
          duplicates.push({ key: key[1], index: i });
        }
      }
    }

    i += 1;
  }

  return duplicates;
}

function lineOf(source, index) {
  return source.slice(0, index).split('\n').length;
}

/**
 * Ce que l'outil DOIT dire, et ce qu'il doit taire.
 *
 * Chaque cas porte le défaut réel ou le faux positif d'où il vient. Le dernier
 * est celui de l'entraide : l'outil ne l'attrape PAS, et le test l'affirme —
 * connaître le trou vaut mieux que le croire bouché.
 */
const SELF_TESTS = [
  {
    name: 'villes — deux clés `profile:` (défaut réel, doit être signalé)',
    source: "const w = { ...(anon ? { profile: { isPublic: true } } : {}), ...(occ ? { profile: { occupancyStatus: occ } } : {}) };",
    expect: ['profile'],
  },
  {
    name: 'clés différentes — le motif légitime, doit être tu',
    source: "const w = { ...(a ? { x: 1 } : {}), ...(b ? { y: 2 } : {}) };",
    expect: [],
  },
  {
    name: 'conditions exclusives sur la même valeur (faux positif corrigé)',
    source: "const d = { ...(s === 'COMPLETED' ? { completedAt: now } : {}), ...(s === 'ACTIVE' ? { completedAt: null } : {}) };",
    expect: [],
  },
  {
    name: 'exclusivité NON prouvable — `a` puis `!a`, doit rester signalé',
    source: "const d = { ...(a ? { k: 1 } : {}), ...(!a ? { k: 2 } : {}) };",
    expect: ['k'],
  },
  {
    name: 'motif cité dans un COMMENTAIRE (faux positif corrigé)',
    source: "// ...(from ? { createdAt: { gte: from } } : {}) puis ...(to ? { createdAt: { lte: to } } : {})\nconst w = { id: 1 };",
    expect: [],
  },
  {
    name: 'motif cité dans une CHAÎNE, doit être tu',
    source: "const msg = '...(a ? { k: 1 } : {}) ...(b ? { k: 2 } : {})';",
    expect: [],
  },
  {
    name: 'forme abrégée `{ status }` posée deux fois, doit être signalée',
    source: "const d = { ...(p ? { status } : {}), ...(q ? { status } : {}) };",
    expect: ['status'],
  },
  {
    name: 'objets IMBRIQUÉS distincts employant chacun `notIn` (10 faux positifs d’origine)',
    source: "const w = { a: { ...(x ? { notIn: u } : {}) }, b: { ...(y ? { notIn: v } : {}) } };",
    expect: [],
  },
  {
    name: 'entraide — clé venue d’un APPEL : l’outil ne peut PAS le voir',
    source: "const w = { ...(await this.baseWhere(me)), ...(phase ? { author: { phase } } : {}) };",
    expect: [],
  },
];

function scan(source) {
  const code = blankNonCode(source);
  const found = [];
  for (let i = 0; i < code.length; i += 1) {
    if (code[i] !== '{') continue;
    for (const d of duplicateSpreadKeysAt(code, i)) {
      found.push({ key: d.key, line: lineOf(code, d.index) });
    }
  }
  return found;
}

if (process.argv.includes('--self-test')) {
  let failed = 0;
  for (const t of SELF_TESTS) {
    const keys = [...new Set(scan(t.source).map((f) => f.key))].sort();
    const want = [...t.expect].sort();
    const ok = keys.length === want.length && keys.every((k, n) => k === want[n]);
    if (!ok) failed += 1;
    console.log(`  ${ok ? '✓' : '✗'} ${t.name}`);
    if (!ok) console.log(`      attendu [${want.join(', ')}], obtenu [${keys.join(', ')}]`);
  }
  if (failed > 0) {
    console.error(`\n${failed} cas sur ${SELF_TESTS.length} ne se comporte(nt) pas comme documenté.\n`);
    process.exit(1);
  }
  console.log(`\n  ${SELF_TESTS.length} cas : la portée du garde-fou est celle que son préambule décrit.\n`);
  process.exit(0);
}

/**
 * `--others --exclude-standard` autant que `--cached` : sans eux, seuls les
 * fichiers SUIVIS sont lus, et un module qui n'est pas encore commité échappe
 * entièrement au contrôle — alors que c'est le plus susceptible d'avoir le
 * défaut. Trouvé sur le contrôle jumeau des `jobId`, qui restait vert avec le
 * bogue réintroduit dans un fichier neuf.
 */
const files = execSync(
  'git ls-files --cached --others --exclude-standard "apps/**/*.ts" "packages/**/*.ts"',
  { cwd: ROOT, encoding: 'utf8' },
)
  .split('\n')
  .filter((f) => f.length > 0 && !f.endsWith('.generated.tsx') && !f.includes('/dist/'));

const problems = [];

for (const file of files) {
  const source = readFileSync(resolve(ROOT, file), 'utf8');
  for (const found of scan(source)) {
    problems.push({ file, line: found.line, key: found.key });
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
