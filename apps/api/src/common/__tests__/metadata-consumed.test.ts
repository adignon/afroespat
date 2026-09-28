import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

/**
 * Toute métadonnée de décorateur est LUE par quelqu'un.
 *
 * Ce test ne protège pas une règle métier : il protège contre une CLASSE de
 * défaut, celle qui a coûté le plus cher dans ce projet.
 *
 * `@RateLimit(n)` a vécu longtemps sans rien limiter. Le décorateur posait
 * `app:rateLimit`, émettait `x-rate-limit` dans l'OpenAPI — donc la documentation
 * affirmait la protection — et aucun garde ne lisait la clé. Quinze contrôleurs la
 * déclaraient, dont l'envoi d'un code par SMS, qui coûte de l'argent à chaque
 * appel. Rien ne pouvait le révéler : un décorateur muet ne casse aucun test, et
 * la seule preuve était un `grep` qui rendait une unique occurrence — sa propre
 * déclaration.
 *
 * D'où ce contrôle : pour chaque clé de métadonnée déclarée dans `common/`, il
 * exige qu'au moins un garde, intercepteur ou filtre la lise. Une déclaration qui
 * ne sert à rien devient alors visible tout de suite, au lieu d'attendre qu'on
 * s'aperçoive que la protection annoncée n'existe pas.
 *
 * PORTÉE. Il vérifie que la clé est LUE, pas qu'elle est CORRECTEMENT appliquée.
 * Un garde qui lirait la clé pour l'ignorer passerait. Contre cela, la défense
 * reste le test de comportement et sa mutation — `rate-limit.int.test.ts` en est
 * l'exemple. Les deux sont nécessaires : celui-ci attrape l'oubli complet, l'autre
 * attrape l'erreur d'application.
 */
describe('métadonnées de décorateur : aucune n’est déclarée pour rien', () => {
  const root = resolve(__dirname, '..', '..', '..', '..', '..');
  const commonDir = resolve(__dirname, '..');

  /** Les fichiers qui ont le DROIT de consommer une métadonnée. */
  const CONSUMERS = /\.(guard|interceptor|filter)\.ts$/;

  it('[RÈGLE DURE] chaque clé déclarée est lue par un garde, un intercepteur ou un filtre', () => {
    const declarations: { key: string; file: string }[] = [];
    for (const file of readdirSync(commonDir)) {
      if (!file.endsWith('.ts')) continue;
      const source = readFileSync(resolve(commonDir, file), 'utf8');
      // `export const XXX_KEY = 'app:xxx';`
      for (const match of source.matchAll(/export const (\w*_KEY)\s*=\s*'([^']+)'/g)) {
        const name = match[1];
        if (name !== undefined) declarations.push({ key: name, file });
      }
    }

    // Si ce compte tombe à zéro, c'est le contrôle qui est cassé, pas le code.
    expect(declarations.length).toBeGreaterThan(3);

    const files = execSync(
      'git ls-files --cached --others --exclude-standard "apps/api/src/**/*.ts"',
      { cwd: root, encoding: 'utf8' },
    )
      .split('\n')
      .filter((f) => f.length > 0 && !f.includes('/__tests__/'));

    const orphans: string[] = [];
    for (const declaration of declarations) {
      const readers = files.filter((f) => {
        if (f.endsWith(`common/${declaration.file}`)) return false;
        if (!CONSUMERS.test(f)) return false;
        return readFileSync(resolve(root, f), 'utf8').includes(declaration.key);
      });
      if (readers.length === 0) orphans.push(`${declaration.key} (déclarée dans common/${declaration.file})`);
    }

    expect(
      orphans,
      `Ces métadonnées sont posées et personne ne les lit — la protection qu’elles\n` +
        `annoncent n’existe pas :\n${orphans.join('\n')}`,
    ).toEqual([]);
  });
});
