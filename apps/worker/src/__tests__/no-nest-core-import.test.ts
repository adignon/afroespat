import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * [RÈGLE DURE] Le worker n'importe JAMAIS `@nestjs/core` lui-même.
 *
 * CE QUE CE TEST GARDE, et pourquoi il porte sur les IMPORTS plutôt que sur la
 * résolution des paquets.
 *
 * Le worker ne démarrait pas, dans un worktree fraîchement installé, sur :
 *
 *     Nest can't resolve dependencies of the AuthGuard (?, TokenService,
 *     PrismaService) — Reflector at index [0]
 *
 * Le lockfile porte DEUX variantes de `@nestjs/core` : une nue, une décorée du
 * pair `@nestjs/platform-express`. Laquelle chaque paquet reçoit dépend de
 * l'installation — dans l'arbre principal elles coïncident aujourd'hui, sur une
 * installation propre (CI, image Docker, worktree neuf) elles peuvent scinder.
 * Quand elles scindent, `Reflector` est deux classes différentes : celle
 * qu'enregistre la `NestFactory` du worker, et celle que réclame `AuthGuard`,
 * compilée dans `apps/api`. Le worker meurt alors entièrement — ni relais de
 * boîte d'envoi, ni tâches planifiées, ni files — en accusant les gardes.
 *
 * POURQUOI PAS UN TEST SUR LA RÉSOLUTION. On pourrait comparer
 * `require.resolve('@nestjs/core')` depuis les deux paquets et exiger l'égalité.
 * Ce serait un mauvais test, pour deux raisons :
 *
 *   · il éprouverait l'ARBRE INSTALLÉ, pas le code. Il rougirait sur une
 *     installation qui scinde MÊME UNE FOIS LE DÉFAUT CORRIGÉ — puisque la
 *     correction ne fait pas converger la résolution, elle la rend sans objet ;
 *   · il garderait le SYMPTÔME (deux instances) au lieu de l'invariant (le worker
 *     ne dépend d'aucune des deux).
 *
 * L'invariant que la correction établit, lui, est vérifiable sans ambiguïté et ne
 * dépend d'aucun environnement : aucun fichier de `apps/worker/src` n'importe
 * `@nestjs/core`. Le contexte applicatif est construit par `createWorkerContext`,
 * exportée par `@app/api`, donc par la même instance que celle qui a compilé les
 * gardes — quelle que soit la variante retenue à l'installation.
 *
 * `@nestjs/common` reste autorisé : le lockfile n'en porte qu'une variante, et
 * `Logger` n'est pas un jeton d'injection résolu par l'arbre.
 */

const WORKER_SRC = join(__dirname, '..');

function sourceFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      // Les tests eux-mêmes sont hors règle : ils ne construisent aucun contexte
      // applicatif, et CE fichier-ci cite `@nestjs/core` dans son propre
      // préambule — il se dénoncerait lui-même.
      if (entry === '__tests__') continue;
      found.push(...sourceFiles(full));
    } else if (full.endsWith('.ts')) {
      found.push(full);
    }
  }
  return found;
}

describe('le worker et l’instance de @nestjs/core (00 §3.1)', () => {
  it('[RÈGLE DURE] aucun fichier de apps/worker/src n’importe @nestjs/core', () => {
    const offenders: string[] = [];

    for (const file of sourceFiles(WORKER_SRC)) {
      const source = readFileSync(file, 'utf8');
      // `import … from '@nestjs/core'`, `import '@nestjs/core'`, et
      // `require('@nestjs/core')` — les trois formes, sous-chemins compris.
      if (/(?:from\s*|require\(\s*)['"]@nestjs\/core(?:\/[^'"]*)?['"]/.test(source)) {
        offenders.push(file.slice(WORKER_SRC.length + 1));
      }
    }

    expect(offenders).toEqual([]);
  });

  /**
   * La moitié POSITIVE.
   *
   * Sans elle, supprimer le bootstrap entier rendrait le premier test vert : plus
   * aucun fichier n'importerait `@nestjs/core`, et la règle serait « respectée »
   * par un worker qui ne démarre rien. Un test qui ne peut rougir que dans un sens
   * ne garde qu'une moitié de la règle.
   */
  it('le contexte est bien construit via `createWorkerContext` de @app/api', () => {
    const main = readFileSync(join(WORKER_SRC, 'main.ts'), 'utf8');

    expect(main).toMatch(/import\s*\{[^}]*\bcreateWorkerContext\b[^}]*\}\s*from\s*['"]@app\/api['"]/);
    expect(main).toMatch(/await\s+createWorkerContext\s*\(/);
  });
});
