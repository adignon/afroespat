import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * L'ONGLET « MEMBRES » — LES QUATRE PLANCHES PORTENT LE PANNEAU (`RV_MEMBRES_PANNEAU`).
 *
 * Le porteur : « les membres s'affichent sur le côté droit sur PC et le clic affiche leur profil avec l'option
 * back […] la liste ne doit pas être aussi longue, il faut une pagination. » Les planches sont générées : ce
 * test lit leur sortie et vérifie que l'adaptation s'est appliquée sur chacune, et que ce que `RV_MEMBRES` y avait
 * posé (recherche, filtres, menu de rôle, « Écrire ») est toujours là.
 */
const A08T = resolve(__dirname, '..', 'a08t');
const lire = (nom: string): string => readFileSync(resolve(A08T, `${nom}.generated.tsx`), 'utf8');
const compte = (texte: string, motif: string): number => texte.split(motif).length - 1;

const PLANCHES = [
  { nom: 'membres', variante: 'ordinateur', menu: false },
  { nom: 'adminmembres', variante: 'ordinateur', menu: true },
  { nom: 'membresmobile', variante: 'mobile', menu: false },
  { nom: 'adminmembresmobile', variante: 'mobile', menu: true },
] as const;

describe('les planches de l’onglet « Membres »', () => {
  for (const p of PLANCHES) {
    it(`${p.nom} : panneau, « Voir plus » et rangée cliquable`, () => {
      const jsx = lire(p.nom);
      expect(compte(jsx, '<PanneauMembres'), 'un seul panneau').toBe(1);
      expect(jsx).toContain(`variante="${p.variante}"`);
      expect(compte(jsx, '<VoirPlus plus={filtreMembres.plus}'), '« Voir plus » une fois').toBe(1);
      // L'identité de la rangée ouvre l'aperçu ; le bouton est fermé (autant de fermetures que d'ouvertures).
      expect(compte(jsx, 'data-membre-ligne={m.handle}')).toBe(1);
      expect(jsx).toContain('filtreMembres.choix.onOuvrir(m.handle)');
      // Rien n'a été retiré de ce qui y était branché.
      expect(jsx).toContain('data-membres-recherche=""');
      expect(jsx).toContain('data-membres-filtre="moderateurs"');
      if (p.menu) expect(jsx).toContain('data-membre-options=""');
      // La planche de téléphone de la vue membre ne dessine aucun « Écrire » (la maquette, pas un oubli).
      if (p.nom !== 'membresmobile') expect(jsx).toContain('data-membre-ecrire=""');
    });
  }

  it('sur ordinateur la rangée est inversée : la liste à droite, « RÔLES · À PROPOS » à gauche', () => {
    for (const nom of ['membres', 'adminmembres']) {
      const jsx = lire(nom);
      expect(jsx, nom).toContain('flexDirection: "row-reverse"');
      expect(jsx, nom).not.toContain('<aside style={{ width: "300px"');
      expect(jsx.indexOf('<PanneauMembres'), `${nom} : la liste précède la colonne dans le DOM`).toBeLessThan(
        jsx.indexOf('<aside'),
      );
    }
  });

  it('le mouvement est celui de la table (panelAdvance, 240 ms) et il est coupé sous reduced-motion', () => {
    const css = readFileSync(resolve(__dirname, '..', '..', 'app', 'globals.css'), 'utf8');
    expect(css).toMatch(/\[data-membres-vue='profil'\]\s*\{\s*animation: dp-panel-advance 240ms cubic-bezier\(0\.16, 1, 0\.3, 1\) both;/);
    const ui = readFileSync(resolve(__dirname, '..', '..', '..', '..', '..', 'packages', 'ui', 'src', 'styles.css'), 'utf8');
    expect(ui).toMatch(/prefers-reduced-motion: reduce[\s\S]*animation-duration: 0\.01ms !important/);
  });
});
