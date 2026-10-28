import { describe, expect, it } from 'vitest';
import { HAUTEUR_MAX_PANNEAU, placerPanneau } from './placement-panneau';

describe('placerPanneau', () => {
  it('s’ouvre sous le champ quand la place suffit, à la hauteur maximale', () => {
    expect(placerPanneau({ top: 500, bottom: 552 }, 1000)).toEqual({ cote: 'dessous', hauteurMax: HAUTEUR_MAX_PANNEAU });
  });

  it('borne la hauteur à la place restante sous le champ', () => {
    // 700 − 552 − 4 − 8 = 136 px : assez pour rester dessous, mais pas pour 220.
    expect(placerPanneau({ top: 500, bottom: 552 }, 700)).toEqual({ cote: 'dessous', hauteurMax: 136 });
  });

  it('passe au-dessus quand le bas est trop court et le haut plus large', () => {
    expect(placerPanneau({ top: 600, bottom: 650 }, 700)).toEqual({ cote: 'dessus', hauteurMax: HAUTEUR_MAX_PANNEAU });
  });

  it('reste dessous si le haut n’est pas plus large que le bas, même court', () => {
    const p = placerPanneau({ top: 40, bottom: 90 }, 150);
    expect(p.cote).toBe('dessous');
    expect(p.hauteurMax).toBe(48);
  });

  it('ne rend jamais de hauteur négative', () => {
    expect(placerPanneau({ top: 10, bottom: 990 }, 1000).hauteurMax).toBeGreaterThanOrEqual(0);
  });
});
