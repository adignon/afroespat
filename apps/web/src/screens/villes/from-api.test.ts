import { describe, expect, it } from 'vitest';
import { CITY_COUNT_PRIVACY_THRESHOLD } from '@app/shared';
import { projeter, rayon } from '@/components/carte-villes';
import { MOINS_DU_SEUIL, euros, ilYA, profilDe, titreEtSuite } from './from-api';

describe('les montants des budgets sont des centimes entiers (00 §4)', () => {
  it('un montant rond n’a pas de décimales', () => {
    expect(euros(48000)).toBe('480 €');
    expect(euros(0)).toBe('0 €');
  });

  it('un montant avec des centimes en garde deux', () => {
    expect(euros(1250)).toBe('12,50 €');
  });
});

describe('le seuil de confidentialité vient de la constante partagée (09 §2.1)', () => {
  it('« moins de 3 » est calculé, pas recopié', () => {
    expect(MOINS_DU_SEUIL).toBe(`moins de ${CITY_COUNT_PRIVACY_THRESHOLD}`);
    expect(CITY_COUNT_PRIVACY_THRESHOLD).toBe(3);
  });
});

describe('un bon plan n’a pas de titre dans le modèle : la première ligne en tient lieu', () => {
  it('une seule ligne n’a que son texte', () => {
    expect(titreEtSuite('Le marché du dimanche est moins cher')).toEqual({
      titre: '',
      texte: 'Le marché du dimanche est moins cher',
    });
  });

  it('deux lignes : la première est le titre, la suite est le texte', () => {
    expect(titreEtSuite('Marché\nLe dimanche matin, avant 10 h.')).toEqual({
      titre: 'Marché',
      texte: 'Le dimanche matin, avant 10 h.',
    });
  });
});

describe('les arrivées se disent en jours entiers', () => {
  const maintenant = Date.parse('2026-10-20T12:00:00Z');
  it('aujourd’hui, hier, il y a N jours', () => {
    expect(ilYA('2026-10-20T08:00:00Z', maintenant)).toBe('arrivé·e aujourd’hui');
    expect(ilYA('2026-10-19T08:00:00Z', maintenant)).toBe('arrivé·e hier');
    expect(ilYA('2026-10-17T08:00:00Z', maintenant)).toBe('arrivé·e il y a 3 jours');
  });
});

describe('le profil d’un membre anonyme n’a pas de lien', () => {
  it('un pseudo mène à /@pseudo, l’absence de pseudo à rien', () => {
    expect(profilDe('awa')).toBe('/@awa');
    expect(profilDe(null)).toBeUndefined();
  });
});

describe('la carte SVG locale (aucun service de carte tiers, 09 §2.1)', () => {
  it('le nord est en haut : une latitude plus haute a un y plus petit', () => {
    const lyon = projeter(4.83, 45.76);
    const lille = projeter(3.06, 50.63);
    expect(lille[1]).toBeLessThan(lyon[1]);
  });

  it('l’est est à droite : une longitude plus haute a un x plus grand', () => {
    expect(projeter(7.75, 48.58)[0]).toBeGreaterThan(projeter(-1.55, 47.21)[0]);
  });

  it('le rayon est borné et un compteur masqué a le rayon minimal', () => {
    expect(rayon(null, 100)).toBe(14);
    expect(rayon(0, 100)).toBe(14);
    expect(rayon(100, 100)).toBeLessThanOrEqual(46);
    expect(rayon(400, 100)).toBeLessThanOrEqual(46);
    expect(rayon(25, 100)).toBeGreaterThan(14);
  });
});
