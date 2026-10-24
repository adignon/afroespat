import { describe, expect, it } from 'vitest';
import { centimesDe } from '@/lib/centimes';
import { filtreLogement, filtresLogement, ongletsServices } from './navigation';

describe('un montant saisi devient des centimes entiers (00 §4)', () => {
  it('accepte les entiers, les décimales françaises et le symbole €', () => {
    expect(centimesDe('620')).toBe(62000);
    expect(centimesDe('620 €')).toBe(62000);
    expect(centimesDe('12,5')).toBe(1250);
    expect(centimesDe('12.50')).toBe(1250);
    expect(centimesDe(' 1 050 € ')).toBe(105000);
  });

  it('refuse tout ce qui n’est pas un montant', () => {
    expect(centimesDe('')).toBeNull();
    expect(centimesDe('abc')).toBeNull();
    expect(centimesDe('-5')).toBeNull();
    expect(centimesDe('1,234')).toBeNull();
  });
});

describe('la bande d’onglets du module Services', () => {
  it('un seul onglet est actif, celui de la page', () => {
    const onglets = ongletsServices('annuaire');
    expect(onglets.filter((o) => o.actif).map((o) => o.libelle)).toEqual(['Annuaire']);
    expect(onglets.map((o) => o.href)).toEqual([
      '/services/logement',
      '/services/emploi',
      '/services/annuaire',
      '/services/mes-annonces',
      '/services/alertes',
    ]);
  });

  it('« Logement » et « Emploi » portent leur total, et seulement quand la page l’a lu', () => {
    const c = { logement: 12, emploi: 8 };
    expect(ongletsServices('logement', c).map((o) => o.libelle)).toEqual([
      'Logement · 12',
      'Emploi · 8',
      'Annuaire',
      'Mes annonces',
      'Alertes',
    ]);
    expect(ongletsServices('logement')[0]?.libelle).toBe('Logement');
    // Un compteur que l'appel n'a pas pu lire disparaît : jamais « · 0 » par défaut.
    expect(ongletsServices('emploi', { logement: null, emploi: null }).map((o) => o.libelle)).toEqual([
      'Logement',
      'Emploi',
      'Annuaire',
      'Mes annonces',
      'Alertes',
    ]);
    // Zéro est un vrai total : il s'affiche.
    expect(ongletsServices('emploi', { logement: 0, emploi: 0 })[1]?.libelle).toBe('Emploi · 0');
  });
});

describe('les puces de genre de S01 sont des liens ?kind=', () => {
  it('un genre inconnu retombe sur « Tout »', () => {
    expect(filtreLogement('FLATSHARE')).toBe('FLATSHARE');
    expect(filtreLogement('SEEKING_HOUSING')).toBeNull();
    expect(filtreLogement(undefined)).toBeNull();
    expect(filtreLogement(['RENT'])).toBeNull();
  });

  it('la puce active suit le genre demandé', () => {
    const puces = filtresLogement('RENT');
    expect(puces.find((p) => p.actif)?.libelle).toBe('Location');
    expect(puces[0]?.href).toBe('/services/logement');
    expect(puces[1]?.href).toBe('/services/logement?kind=FLATSHARE');
  });
});
