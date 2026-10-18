import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * LA COLONNE DE GAUCHE, VIVANTE SUR TOUTES LES PAGES.
 *
 * Le porteur : « la sidebar n'est pas dynamique ? Aussi sur toutes les autres pages
 * c'est pas réglé aussi ? » — voir `tools/adaptations/chrome-gauche-vivant.mjs`.
 */
const RACINE = resolve(__dirname, '..');

function cadres(): { fichier: string; jsx: string }[] {
  const out: { fichier: string; jsx: string }[] = [];
  for (const d of readdirSync(RACINE, { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    for (const f of readdirSync(join(RACINE, d.name))) {
      if (f.endsWith('.generated.tsx'))
        out.push({ fichier: `${d.name}/${f}`, jsx: readFileSync(join(RACINE, d.name, f), 'utf8') });
    }
  }
  return out;
}

describe('la colonne de gauche', () => {
  const tous = cadres();

  it('« Vos raccourcis » liste mes réseaux, jamais trois noms écrits en dur', () => {
    const avec = tous.filter((c) => c.jsx.includes('VOS RACCOURCIS'));
    expect(avec.length).toBeGreaterThanOrEqual(15);
    for (const c of avec) {
      expect(c.jsx, c.fichier).toContain('<RaccourcisReseaux />');
      expect(c.jsx.includes('(shortcuts ?? [])'), c.fichier).toBe(false);
      // « Modifier » mène à la page Réseaux, plus à `#`.
      expect(c.jsx, c.fichier).toMatch(/VOS RACCOURCIS<\/span><a href="\/reseaux"/);
    }
  });

  it('la barre d’avancement du panneau « Parcours » lit l’avancement, pas 58 %', () => {
    // « PARCOURS ABOUTI » : la barre pleine à 100 % est le dessin voulu d'un parcours terminé.
    const avec = tous.filter(
      (c) => c.jsx.includes('{panneau.avancement}%') && !c.jsx.includes('PARCOURS ABOUTI'),
    );
    expect(avec.length).toBeGreaterThanOrEqual(11);
    for (const c of avec) {
      expect(c.jsx.includes('width: "58%"'), c.fichier).toBe(false);
      expect(c.jsx, c.fichier).toContain('String(panneau.avancement)');
    }
  });
});
