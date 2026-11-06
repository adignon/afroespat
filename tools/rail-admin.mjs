/**
 * LE RAIL ET LA COQUE DE L'ADMINISTRATION — substitution reproductible dans les écrans D02 à D17.
 *
 * La maquette (`docs/template/10 Administration.dc.html`) dessine, dans chaque écran, un rail de quinze liens à plat
 * (`<div data-admin-rail …>…</nav></div>`), puis la colonne de contenu (`<div data-admin-main …>`), le tout sous un
 * `<main style="display: contents">`. Cette substitution, appliquée À L'ÉCRITURE de chaque fichier généré (voir
 * `generate-screens.mjs`, comme `logo-marque.mjs`), fait trois choses :
 *
 *   1. le rail à plat devient `<RailAdmin />` (`components/admin/rail-admin.tsx`) : groupes par métier, rôle,
 *      pastilles « à traiter », page courante ;
 *   2. le HTML devient sémantique : le `<main>` ne contenait pas que le contenu (il enveloppait aussi le rail). Il
 *      redevient un simple conteneur, et c'est la colonne de contenu qui est le `<main id="contenu-admin">`, cible
 *      du lien d'évitement « Aller au contenu » ;
 *   3. l'import de `RailAdmin` est ajouté.
 *
 * IDEMPOTENTE : un fichier qui porte déjà `<RailAdmin />` n'est pas retouché. Un écran sans rail (D01, la connexion)
 * n'est pas concerné et rendu tel quel. Un écran qui porte le rail mais pas la forme attendue fait ÉCHOUER (mieux
 * qu'un rail à moitié remplacé).
 *
 * Usage direct (applique à tous les `.generated.tsx` d'administration existants) : node tools/rail-admin.mjs
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const IMPORT_BARRE = "import { BarreAdmin } from '@/components/admin/barre-admin';";
const IMPORT_RAIL = "import { RailAdmin } from '@/components/admin/rail-admin';";
const DEBUT_RAIL = '<div data-admin-rail=""';
const DEBUT_MAIN = '<div data-admin-main=""';
const FIN_RAIL = '</nav></div>';
const MAIN_ENVELOPPE = '<main style={{ display: "contents" }}>';

export function remplacerRailAdmin(source) {
  if (!source.includes(DEBUT_RAIL)) return source;
  if (source.includes('<RailAdmin />')) return source;

  const debut = source.indexOf(DEBUT_RAIL);
  const finNav = source.indexOf(FIN_RAIL, debut);
  const debutMain = source.indexOf(DEBUT_MAIN, debut);
  if (finNav < 0 || debutMain < 0 || finNav + FIN_RAIL.length !== debutMain) {
    throw new Error("rail-admin : le rail n'a pas la forme attendue (« <div data-admin-rail>…</nav></div><div data-admin-main> »)");
  }
  if (!source.includes(IMPORT_BARRE) || !source.includes(MAIN_ENVELOPPE) || !source.includes('</main>')) {
    throw new Error('rail-admin : import de la barre ou enveloppe <main> introuvable');
  }

  let sortie = source.slice(0, debut) + '<RailAdmin />' + source.slice(debutMain);
  // La colonne de contenu devient le <main> de la page.
  sortie = sortie.replace(DEBUT_MAIN, '<main id="contenu-admin" tabIndex={-1} data-admin-main=""');
  // La dernière « </div> » avant « </main> » ferme la colonne de contenu (fins de ligne LF ou CRLF).
  let derniere = null;
  for (const m of sortie.matchAll(/<\/div>(\r?\n\s*)<\/main>/g)) derniere = m;
  if (derniere === null) throw new Error('rail-admin : fermeture de la colonne de contenu introuvable');
  sortie = sortie.slice(0, derniere.index) + '</main>' + derniere[1] + '</div>' + sortie.slice(derniere.index + derniere[0].length);
  sortie = sortie.replace(MAIN_ENVELOPPE, '<div style={{ display: "contents" }}>');
  sortie = sortie.replace(IMPORT_BARRE, `${IMPORT_BARRE}\n${IMPORT_RAIL}`);
  return sortie;
}

function* fichiers(dossier) {
  for (const nom of readdirSync(dossier)) {
    const p = join(dossier, nom);
    if (statSync(p).isDirectory()) yield* fichiers(p);
    else if (p.endsWith('.generated.tsx')) yield p;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const racine = join(dirname(fileURLToPath(import.meta.url)), '..', 'apps/web/src');
  let touches = 0;
  for (const f of fichiers(racine)) {
    const avant = readFileSync(f, 'utf8');
    const apres = remplacerRailAdmin(avant);
    if (apres !== avant) {
      writeFileSync(f, apres, 'utf8');
      touches++;
    }
  }
  console.log(`${touches} fichiers mis à jour`);
}
