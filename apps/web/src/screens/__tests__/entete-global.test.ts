import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * L'EN-TÊTE GLOBAL — la barre haute sur toute la largeur, hors du contenu borné.
 *
 * Le porteur : « le header doit être en fullwidth sur tout l'écran et ne pas être
 * lié à une section du contenu […] la search bar centrée […] c'est uniquement le
 * contenu de la page qui doit avoir un max width, et non le header. »
 *
 * Ces tests lisent les cadres GÉNÉRÉS : la règle vit dans l'adaptation
 * `tools/adaptations/entete-global.mjs`, et ce qui compte est ce qu'elle a produit.
 */
const RACINE = resolve(__dirname, '..');

function cadresDOrdinateur(): { fichier: string; jsx: string }[] {
  const out: { fichier: string; jsx: string }[] = [];
  for (const dossier of readdirSync(RACINE, { withFileTypes: true })) {
    if (!dossier.isDirectory()) continue;
    for (const f of readdirSync(join(RACINE, dossier.name))) {
      if (!f.endsWith('.generated.tsx') || !f.includes('desktop')) continue;
      out.push({ fichier: `${dossier.name}/${f}`, jsx: readFileSync(join(RACINE, dossier.name, f), 'utf8') });
    }
  }
  return out;
}

describe("l'en-tête global", () => {
  const cadres = cadresDOrdinateur();
  const avec = cadres.filter((c) => c.jsx.includes('data-entete-globale'));

  it('existe sur les cadres d’ordinateur qui dessinent la barre haute', () => {
    expect(avec.length).toBeGreaterThanOrEqual(50);
  });

  it('est fixe, sur toute la largeur, à trois zones dont la recherche au centre', () => {
    for (const c of avec) {
      const m = /<header data-entete-globale="" style=\{\{ ([^}]*) \}\}>/.exec(c.jsx);
      expect(m, c.fichier).not.toBeNull();
      const style = m?.[1] ?? '';
      expect(style, c.fichier).toContain('position: "fixed"');
      expect(style, c.fichier).toContain('left: "0", right: "0"');
      expect(style, c.fichier).toContain('minmax(0, 1fr) minmax(0, 560px) minmax(0, 1fr)');
    }
  });

  it('ne laisse plus de rangée de 64 px avec recherche dans une colonne', () => {
    for (const c of avec) {
      // La boîte de recherche n'est plus bornée à 420 px : elle remplit sa zone.
      expect(c.jsx.includes('maxWidth: "420px"'), c.fichier).toBe(false);
      // Un seul en-tête par cadre.
      expect(c.jsx.split('data-entete-globale').length - 1, c.fichier).toBe(1);
    }
  });

  it('rend la recherche de la barre vivante partout où la barre existe', () => {
    for (const c of avec) expect(c.jsx, c.fichier).toContain('<ChampRecherche');
  });

  it('laisse deux espaces de 64 px à la place des deux rangées, pour que rien ne bouge', () => {
    // La région « BarreHaute » d'A08 ne porte QUE la barre : les espaces sont dans la page qui la monte.
    for (const c of avec.filter((x) => !x.fichier.includes('barrehaute'))) {
      const espaces = c.jsx.split('<div style={{ height: "64px", flexShrink: "0" }}></div>').length - 1;
      expect(espaces, c.fichier).toBeGreaterThanOrEqual(2);
    }
  });

  it('épargne l’administration (le logo « Admin » n’est pas la barre de l’application)', () => {
    for (const c of cadres.filter((x) => x.fichier.startsWith('d'))) {
      expect(c.jsx.includes('data-entete-globale'), c.fichier).toBe(false);
    }
  });

  it('A08 monte la barre comme région : un en-tête entier, pas une rangée', () => {
    const region = readFileSync(join(RACINE, 'a08', 'barrehaute-desktop.generated.tsx'), 'utf8');
    expect(region).toContain('<header data-entete-globale=""');
  });
});
