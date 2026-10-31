import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MENUS_RAIL } from '../../components/rail/menus';
import { ENTREES_ACCUEIL } from '../../components/rail/entrees-accueil';
import { panelFil } from '../a01/data';

/**
 * LE VOLET DU RAIL ET LE MENU DE LA PAGE DISENT LA MÊME CHOSE.
 *
 * Le porteur : « quand on est au niveau de la page des parcours (ou un autre) et
 * qu'on fait un hover sur l'icône d'accueil, est-ce que ça affiche le même nombre
 * de liens que celui du menu sidebar de la page d'accueil ? » — et ce n'était pas
 * le cas : six entrées au survol, quatre dans la page.
 *
 * Ces tests comparent le volet de CHAQUE rubrique au menu que la page dessine, par
 * les libellés rendus : une entrée ajoutée d'un côté et pas de l'autre les fait
 * rougir.
 */
const RACINE = resolve(__dirname, '..');
const cadre = (f: string): string => readFileSync(resolve(RACINE, f), 'utf8');

/** Les libellés d'une carte de menu, dans l'ordre où la page les écrit. */
function libellesDe(jsx: string, titre: string): string[] {
  const i = jsx.indexOf(`>${titre}</div>`);
  if (i === -1) return [];
  const fin = jsx.indexOf('padding: "14px" }}>', i + 1);
  const zone = jsx.slice(i, fin === -1 ? i + 6000 : fin);
  return [...zone.matchAll(/<span style=\{\{ flex: "1" \}\}>([^<{]+)<\/span>/g)].map((m) =>
    (m[1] ?? '').trim(),
  );
}

const libellesFlyout = (rubrique: string): string[] =>
  (MENUS_RAIL[rubrique]?.entrees ?? []).map((e) => e.libelle);

describe('le volet du rail', () => {
  it('« Accueil » : la même liste que le menu de la page d’accueil — quatre entrées', () => {
    expect(libellesFlyout('Accueil')).toEqual(panelFil.map((m) => m.label));
    expect(libellesFlyout('Accueil')).toHaveLength(4);
    expect(MENUS_RAIL.Accueil?.entrees.map((e) => e.href)).toEqual(panelFil.map((m) => m.href));
  });

  it('« Accueil » : les pages Messages et Notifications ne portent plus la carte « ACCUEIL » (le menu vit au survol du rail)', () => {
    for (const f of [
      'm01/desktop',
      'm01bloque/bloquedesktop',
      'x02/desktop',
      'x02/desktoppanneau',
    ]) {
      const jsx = cadre(`${f}.generated.tsx`);
      expect(jsx.includes('>ACCUEIL</div>'), f).toBe(false);
      expect(jsx.includes('<MenuAccueil />'), f).toBe(false);
      expect(jsx.includes('Fil d’entraide'), f).toBe(false);
    }
    expect(ENTREES_ACCUEIL).toHaveLength(4);
  });

  it('« Entraide » : les sept entrées des deux cartes de la page (ENTRAIDE + PARRAINAGE)', () => {
    const jsx = cadre('h01/desktop.generated.tsx');
    const page = [...libellesDe(jsx, 'ENTRAIDE'), ...libellesDe(jsx, 'PARRAINAGE')];
    expect(libellesFlyout('Entraide')).toEqual(page);
  });

  it('« Services » : les six entrées des deux cartes de la page (SERVICES + MON ESPACE)', () => {
    const jsx = cadre('s01/desktop.generated.tsx');
    const page = [...libellesDe(jsx, 'SERVICES'), ...libellesDe(jsx, 'MON ESPACE')];
    expect(libellesFlyout('Services')).toEqual(page);
  });
});
