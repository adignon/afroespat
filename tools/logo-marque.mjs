/**
 * LE LOGO DIASPORYPLUS (variante 4a de `docs/template/Logo diasporyplus.dc.html`) — « Vert + orange ».
 *
 * La marque : deux pièces décalées, tournées de −35°, l'une dans le blanc (sur pastille verte) ou le vert, l'autre
 * orange #E0733A. Le nom : « Diaspory » (vert, ou blanc sur fond sombre) puis « plus » en orange (#F0C3A4 sur sombre).
 *
 * Les maquettes dessinent encore l'ancien logo (cercles concentriques + « Diaspora »). Plutôt que de modifier plus de
 * quatre-vingts écrans à la main, ce module remplace l'ancien dessin dans le JSX GÉNÉRÉ ; le générateur l'appelle à
 * l'écriture de chaque fichier, donc une régénération garde le nouveau logo.
 *
 * Usage direct (applique à tous les `.generated.tsx` existants) : node tools/logo-marque.mjs
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const MARQUE_VERTE = '#16785E';
export const MARQUE_ORANGE = '#E0733A';
const PIECE_A = 'M0 0H10V14H34V24H0Z';
const PIECE_B = 'M14 0H48V24H38V10H14Z';

/** L'ancienne pastille (trois cercles, tracé blanc) → la marque 4a, un quart plus grande (elle remplit la pastille). */
const ANCIENNE_MARQUE =
  /<svg width="(\d+)" height="(\d+)" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1\.7"([^>]*)><circle cx="12" cy="12" r="9" ?\/><circle cx="12" cy="12" r="4" ?\/><circle cx="16\.5" cy="7\.5" r="1\.6" fill="#E0733A" stroke="none" ?\/><\/svg>/g;

/** « Diaspora » en gras 800 → « Diaspory » + « plus » orange, graisse 600 comme la référence. */
const ANCIEN_NOM = /<span style=\{\{ fontSize: "(\d+)px", fontWeight: "800", color: "(#0F5C48|#fff)"([^}]*)\}\}>Diaspora<\/span>/g;

export function remplacerLogo(source) {
  return source
    .replace(ANCIENNE_MARQUE, (_, w, h, reste) => {
      const W = Math.round(Number(w) * 1.25);
      const H = Math.round(Number(h) * 1.25);
      return `<svg width="${W}" height="${H}" viewBox="-6 -18 60 60"${reste}><g transform="rotate(-35 24 12)"><path d="${PIECE_A}" fill="#fff" /><path d="${PIECE_B}" fill="${MARQUE_ORANGE}" /></g></svg>`;
    })
    .replace(
      ANCIEN_NOM,
      (_, taille, couleur, reste) =>
        `<span style={{ fontSize: "${taille}px", fontWeight: "600", color: "${couleur}"${reste}}}>Diaspory<span style={{ color: "${couleur === '#fff' ? '#F0C3A4' : MARQUE_ORANGE}" }}>plus</span></span>`,
    );
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
    const apres = remplacerLogo(avant);
    if (apres !== avant) {
      writeFileSync(f, apres, 'utf8');
      touches++;
    }
  }
  console.log(`${touches} fichiers mis à jour`);
}
