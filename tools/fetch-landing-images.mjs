// Télécharge les photos de la page d'accueil dans apps/web/public/landing/ (la CSP interdit les images externes).
// Lit les `/landing/<id>-<largeur>.jpg` du fichier généré et du composant de données ; ne retélécharge pas l'existant.
// Usage : node tools/fetch-landing-images.mjs
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const sortie = join(racine, 'apps/web/public/landing');
mkdirSync(sortie, { recursive: true });

const sources = ['apps/web/src/screens/landing/landing.generated.tsx', 'apps/web/src/screens/landing/data.ts'];
const fichiers = new Set();
for (const s of sources) {
  for (const m of readFileSync(join(racine, s), 'utf8').matchAll(/\/landing\/([0-9a-z]+-[0-9a-z]+|[0-9]+-[0-9a-f]+)-(\d+)\.jpg/g)) {
    fichiers.add(m[0]);
  }
}

let ko = 0;
for (const f of [...fichiers].sort()) {
  const [, id, largeur] = /\/landing\/(.+)-(\d+)\.jpg$/.exec(f);
  const cible = join(sortie, f.replace('/landing/', ''));
  if (existsSync(cible)) continue;
  const url = `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${largeur}&q=70`;
  const r = await fetch(url);
  if (!r.ok) {
    console.error(`ÉCHEC ${r.status} ${url}`);
    ko++;
    continue;
  }
  writeFileSync(cible, Buffer.from(await r.arrayBuffer()));
  console.log('ok', f);
}
process.exit(ko === 0 ? 0 : 1);
