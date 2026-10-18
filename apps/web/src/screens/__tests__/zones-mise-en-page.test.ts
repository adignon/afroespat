import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * LES TROIS ZONES D'UNE PAGE — les colonnes aux bords, le contenu borné.
 *
 * Le porteur : « les sidebars [sont] laissées à gauche et à droite sans
 * l'application du max width. Du coup seul le contenu de la page (contenu du
 * milieu) est contenu. Cela doit être fait sur toutes les pages (réutilisable
 * donc). » — voir `tools/adaptations/zones-mise-en-page.mjs` et `app/globals.css`.
 */
const RACINE = resolve(__dirname, '..');
const CSS = readFileSync(resolve(RACINE, '..', 'app', 'globals.css'), 'utf8');

function cadres(): { fichier: string; jsx: string }[] {
  const out: { fichier: string; jsx: string }[] = [];
  for (const d of readdirSync(RACINE, { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    for (const f of readdirSync(join(RACINE, d.name))) {
      if (f.endsWith('.generated.tsx') && f.includes('desktop')) {
        out.push({ fichier: `${d.name}/${f}`, jsx: readFileSync(join(RACINE, d.name, f), 'utf8') });
      }
    }
  }
  return out;
}

describe('les zones de mise en page', () => {
  const tous = cadres();
  const avec = tous.filter((c) => c.jsx.includes('data-zone="gauche"'));

  it('les cadres à colonnes nomment leurs rôles : gauche, centre, contenu', () => {
    expect(avec.length).toBeGreaterThanOrEqual(60);
    // La région « menu de gauche » d'A08 ne porte QUE la colonne de gauche, par construction.
    for (const c of avec.filter((x) => !x.fichier.includes('chromegauche'))) {
      for (const zone of ['gauche', 'centre', 'contenu']) {
        expect(c.jsx, `${c.fichier} : ${zone}`).toContain(`data-zone="${zone}"`);
      }
    }
  });

  it('la colonne de droite est nommée dans les 39 cadres qui en ont une', () => {
    const avecAside = avec.filter((c) => c.jsx.includes('<aside'));
    expect(avecAside.length).toBeGreaterThanOrEqual(30);
    for (const c of avecAside.filter((x) => x.jsx.includes('data-zone="rangee"'))) {
      expect(c.jsx, c.fichier).toContain('data-zone="droite"');
    }
  });

  it('un cadre sans rôles clairs garde sa borne : J01M, qui a deux colonnes de gauche', () => {
    const j01m = tous.find((c) => c.fichier === 'j01m/desktop.generated.tsx');
    expect(j01m?.jsx.includes('data-zone=')).toBe(false);
  });

  it('la règle commune : le cadre n’est plus borné, seul le contenu l’est', () => {
    expect(CSS).toMatch(
      /\[data-frame='desktop'\]:has\(\[data-zone='gauche'\]\)\s*\{\s*max-width: none;/,
    );
    expect(CSS).toMatch(
      /\[data-zone='contenu'\]\s*\{[^}]*margin-inline: auto;[^}]*max-width: 1036px;/,
    );
  });

  it('la colonne de droite d’une page de réseau est portée au bord, sans perdre son comportement collant', () => {
    expect(CSS).toContain("[data-zone='droite-collante']");
    const planche = readFileSync(join(RACINE, 'a08t', 'fil.generated.tsx'), 'utf8');
    expect(planche).toContain('<aside data-zone="droite-collante"');
  });
});
