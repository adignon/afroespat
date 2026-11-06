import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Chaque `package.json` de workspace (apps/*, packages/*) doit être copié dans l'étape `deps` du Dockerfile :
 * le lockfile les référence, et `pnpm install --frozen-lockfile` échoue sinon (cas vécu : apps/provider-demo).
 */
const racine = resolve(import.meta.dirname, '..', '..');
const dockerfile = readFileSync(resolve(racine, 'Dockerfile'), 'utf8');
const etapeDeps = dockerfile.split(/^FROM .* AS deps$/m)[1]?.split(/^FROM /m)[0] ?? '';
assert.ok(etapeDeps.length > 0, "étape `deps` introuvable dans le Dockerfile");

const manquants = [];
for (const groupe of ['apps', 'packages']) {
  for (const nom of readdirSync(resolve(racine, groupe))) {
    const manifeste = `${groupe}/${nom}/package.json`;
    if (!existsSync(resolve(racine, manifeste))) continue;
    if (!etapeDeps.includes(`COPY ${manifeste} ${groupe}/${nom}/`)) manquants.push(manifeste);
  }
}
assert.deepEqual(manquants, [], `Dockerfile, étape deps : COPY manquant pour ${manquants.join(', ')}`);
console.log('dockerfile-workspaces : ok');
