import { describe, expect, it } from 'vitest';
import { villesProposees, type CityChoice, type CountryChoice } from './data';

/**
 * LES VILLES DE L'ÉCRAN DU LIEU — W1A, phase 0.2.
 *
 * Mesuré : le sélecteur « Votre ville » mêlait les 65 villes de la base, tous pays
 * confondus (« Abomey » en tête de la liste d'un membre qui vit en France). Ces cas
 * fixent la règle : avant le départ, les villes du pays d'ORIGINE choisi ; ensuite,
 * celles des pays de DESTINATION ; jamais une liste vide qui enfermerait le membre.
 */
const pays = (id: string, iso2: string, kind: CountryChoice['kind']): CountryChoice => ({
  id,
  iso2,
  nameFr: iso2,
  dialCode: '+0',
  ...(kind === undefined ? {} : { kind }),
});
const ville = (id: string, countryId: string, name: string): CityChoice => ({
  id,
  countryId,
  name,
  region: null,
  isActive: false,
  memberCount: 0,
});

const PAYS = [pays('c-fr', 'FR', 'DESTINATION'), pays('c-bj', 'BJ', 'ORIGIN'), pays('c-tg', 'TG', 'ORIGIN')];
const VILLES = [
  ville('v-abomey', 'c-bj', 'Abomey'),
  ville('v-lome', 'c-tg', 'Lomé'),
  ville('v-lyon', 'c-fr', 'Lyon'),
  ville('v-lille', 'c-fr', 'Lille'),
];
const noms = (liste: readonly CityChoice[]) => liste.map((c) => c.name);

describe('villesProposees', () => {
  it('avant le départ : seulement les villes du pays d’origine choisi', () => {
    expect(noms(villesProposees(VILLES, PAYS, 'PRE_DEPARTURE', 'BJ'))).toEqual(['Abomey']);
    expect(noms(villesProposees(VILLES, PAYS, 'PRE_DEPARTURE', 'TG'))).toEqual(['Lomé']);
  });

  it('arrivé ou installé : seulement les villes des pays de destination', () => {
    expect(noms(villesProposees(VILLES, PAYS, 'RECENT_ARRIVAL', 'BJ'))).toEqual(['Lyon', 'Lille']);
    expect(noms(villesProposees(VILLES, PAYS, 'SETTLED', 'TG'))).toEqual(['Lyon', 'Lille']);
  });

  it('un pays « BOTH » compte comme destination', () => {
    const avecBoth = [...PAYS, pays('c-be', 'BE', 'BOTH')];
    const villes = [...VILLES, ville('v-bxl', 'c-be', 'Bruxelles')];
    expect(noms(villesProposees(villes, avecBoth, 'SETTLED', 'BJ'))).toContain('Bruxelles');
  });

  it('phase inconnue : rien n’est filtré (mieux qu’une liste vide)', () => {
    expect(villesProposees(VILLES, PAYS, null, 'BJ')).toHaveLength(4);
  });

  it('un filtre qui ne laisse rien rend le catalogue entier', () => {
    expect(villesProposees(VILLES, PAYS, 'PRE_DEPARTURE', 'CI')).toHaveLength(4);
    expect(villesProposees([ville('v-abomey', 'c-bj', 'Abomey')], PAYS, 'SETTLED', 'BJ')).toHaveLength(1);
  });
});
