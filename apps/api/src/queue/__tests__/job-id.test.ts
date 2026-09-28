import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { jobIdOf } from '../job-id';

/**
 * La règle des `jobId` — éprouvée, pas supposée.
 *
 * Le comportement de BullMQ a été mesuré contre un vrai Redis (voir le préambule
 * de `job-id.ts`) : « : » est refusé, SAUF à exactement trois segments. C'est
 * cette tolérance qui rend la règle dangereuse — une forme fautive peut
 * fonctionner par chance, et cesser de fonctionner à la première retouche.
 *
 * Le dernier test est le seul qui protège vraiment : il interdit au dépôt entier
 * de reconstruire un `jobId` à la main. Sans lui, ces tests ne prouvent que le
 * bon comportement d'une fonction que personne n'est obligé d'employer.
 */
describe('jobId BullMQ (queue/job-id.ts)', () => {
  it('assemble avec un tiret, jamais avec « : »', () => {
    expect(jobIdOf('analyze', 'POST', '01a0-abc')).toBe('analyze-POST-01a0-abc');
    expect(jobIdOf('push', 'abc')).not.toContain(':');
  });

  it('lève sur un segment contenant « : » plutôt que d’échouer à la mise en file', () => {
    // Échouer ici est visible ; échouer dans `add()` était journalisé puis oublié,
    // et la ligne `outbound_messages` restait éternellement en `QUEUED`.
    expect(() => jobIdOf('push', 'a:b')).toThrow(/refuse/);
  });

  it('un seul segment reste un identifiant valide', () => {
    expect(jobIdOf('abc')).toBe('abc');
  });

  /**
   * PORTÉE DE CE CONTRÔLE, et il faut la connaître.
   *
   * Il ne signale que la construction LITTÉRALE — `` jobId: `push-${id}` `` ou
   * `jobId: 'fixe'`. C'est la forme du bogue : les quatre sites fautifs
   * l'employaient tous.
   *
   * Il ne voit PAS un identifiant assemblé dans une variable en amont
   * (`const id = ...; jobId: id`). Le rattraper demanderait de suivre le flot des
   * valeurs, et un contrôle qui essaie et se trompe finit ignoré.
   *
   * Ma première version cherchait tout `jobId:` et signalait huit lignes sans
   * aucun rapport : les paramètres `jobId: string` du module EMPLOI — où
   * « jobId » désigne une annonce, pas un travail de file — et `jobId: e.id` du
   * relais d'outbox, qui passe un UUID déjà valide. Deux sens du même mot dans un
   * seul dépôt : la leçon est que le contrôle doit porter sur la FORME de la
   * valeur, jamais sur le nom de la clé.
   */
  it('[RÈGLE DURE] aucun fichier ne construit un jobId littéral à la main', () => {
    // `__dirname`, pas `import.meta` : le paquet compile en CommonJS (voir
    // `apps/api/tsconfig.json`), et `import.meta` y est refusé par tsc — alors que
    // SWC l'accepte à l'exécution. L'erreur n'apparaît donc qu'au typecheck.
    const root = resolve(__dirname, '..', '..', '..', '..', '..');
    /**
     * `--others --exclude-standard` en plus de `--cached`, et ce n'est pas un
     * détail : sans eux, `git ls-files` ne liste que les fichiers SUIVIS, donc
     * aucun fichier neuf. Or un fichier neuf est précisément celui qui a le plus
     * de chances de porter l'erreur. Constaté en réintroduisant le bogue dans un
     * module pas encore commité : le contrôle restait vert.
     */
    const files = execSync('git ls-files --cached --others --exclude-standard "apps/**/*.ts"', {
      cwd: root,
      encoding: 'utf8',
    })
      .split('\n')
      .filter((f) => f.length > 0 && !f.includes('/__tests__/') && !f.endsWith('queue/job-id.ts'));

    const offenders: string[] = [];
    for (const file of files) {
      const source = readFileSync(resolve(root, file), 'utf8');
      for (const [index, line] of source.split('\n').entries()) {
        // Un `jobId` dont la valeur est une CHAÎNE ou un GABARIT : la seule
        // forme que ce contrôle prétend attraper.
        const match = /\bjobId:\s*([`'"])/.exec(line);
        if (match === null) continue;
        offenders.push(`${file}:${index + 1} — ${line.trim()}`);
      }
    }

    expect(offenders, `à construire par jobIdOf() :\n${offenders.join('\n')}`).toEqual([]);
  });
});
