import { describe, expect, it } from 'vitest';
import { DisjoncteurTempsReel } from '../disjoncteur-temps-reel';

describe('DisjoncteurTempsReel', () => {
  it('s’ouvre après trois connexions trop brèves de suite, et suspend la socket', () => {
    const d = new DisjoncteurTempsReel(3, 10_000, 300_000);
    let t = 1_000;
    for (let i = 0; i < 2; i += 1) {
      d.etabli(t);
      t += 900;
      expect(d.perdu(t)).toBe(false);
      t += 1_000;
    }
    d.etabli(t);
    t += 900;
    expect(d.perdu(t)).toBe(true);
    expect(d.suspendu(t)).toBe(true);
    expect(d.restant(t)).toBe(300_000);
    expect(d.suspendu(t + 300_000)).toBe(false);
  });

  it('une connexion qui tient remet le compte à zéro', () => {
    const d = new DisjoncteurTempsReel(3, 10_000, 300_000);
    d.etabli(0);
    d.perdu(500);
    d.etabli(1_000);
    d.perdu(1_500);
    d.etabli(2_000);
    expect(d.perdu(60_000)).toBe(false); // elle a tenu 58 s : le compte repart de zéro
    d.etabli(61_000);
    d.perdu(61_500);
    d.etabli(62_000);
    expect(d.perdu(62_500)).toBe(false);
    expect(d.suspendu(62_500)).toBe(false);
  });

  it('une coupure sans connexion préalable n’est pas comptée', () => {
    const d = new DisjoncteurTempsReel(1, 10_000, 300_000);
    expect(d.perdu(100)).toBe(false);
    expect(d.suspendu(100)).toBe(false);
  });
});
