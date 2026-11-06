import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { remplacerRailAdmin } from '../rail-admin.mjs';

/**
 * La substitution du rail d'administration : elle remplace le rail à plat des écrans D02 à D17 par `<RailAdmin />`,
 * rend le HTML sémantique (`<main>` = colonne de contenu), est IDEMPOTENTE et refuse une forme inattendue.
 */
const MODELE = `import { BarreAdmin } from '@/components/admin/barre-admin';

export function D99Desktop() {
  return (
    <>

      <main style={{ display: "contents" }}>
<div data-admin-rail="" style={{ width: "240px" }}><div>logo</div><nav><a href="/admin">Tableau de bord</a></nav></div><div data-admin-main="" style={{ flex: "1" }}><BarreAdmin /><div><Contenu /></div></div>
      </main>
    </>
  );
}
`;

const sortie = remplacerRailAdmin(MODELE);
assert.ok(sortie.includes('<RailAdmin />'), 'le rail est remplacé');
assert.ok(sortie.includes("import { RailAdmin } from '@/components/admin/rail-admin';"), "l'import est ajouté");
assert.ok(!sortie.includes('data-admin-rail'), 'plus de rail dessiné');
assert.ok(sortie.includes('<main id="contenu-admin" tabIndex={-1} data-admin-main=""'), 'la colonne de contenu devient le <main>');
assert.equal((sortie.match(/<main/g) ?? []).length, 1, 'un seul <main>');
assert.equal((sortie.match(/<\/main>/g) ?? []).length, 1, 'un seul </main>');
assert.ok(sortie.includes('<div style={{ display: "contents" }}>'), "l'enveloppe n'est plus un <main>");
assert.ok(sortie.indexOf('</main>') < sortie.lastIndexOf('</div>'), 'le <main> se ferme avant l’enveloppe');

// Idempotente.
assert.equal(remplacerRailAdmin(sortie), sortie, 'rejouer ne change rien');

// Fins de ligne CRLF : même résultat.
assert.equal(remplacerRailAdmin(MODELE.replace(/\n/g, '\r\n')).replace(/\r\n/g, '\n'), sortie, 'CRLF accepté');

// Un écran sans rail (la connexion) est rendu tel quel.
const sansRail = "export const x = 1;\n";
assert.equal(remplacerRailAdmin(sansRail), sansRail);

// Une forme inattendue fait échouer plutôt que de produire un rail à moitié remplacé.
assert.throws(() => remplacerRailAdmin(MODELE.replace('</nav></div><div data-admin-main=""', '</nav><div data-admin-main=""')), /forme attendue/);

// Sur les fichiers réels : les 16 écrans D02 à D17 portent le rail partagé et aucun ne dessine plus le sien.
for (let n = 2; n <= 17; n++) {
  const f = resolve(import.meta.dirname, '..', '..', 'apps/web/src/screens', `d${String(n).padStart(2, '0')}`, 'desktop.generated.tsx');
  const t = readFileSync(f, 'utf8');
  assert.ok(t.includes('<RailAdmin />'), `D${n} porte le rail partagé`);
  assert.ok(!t.includes('data-admin-rail'), `D${n} ne dessine plus son rail`);
}
console.log('rail-admin : OK');
