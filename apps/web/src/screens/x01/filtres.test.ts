import { describe, expect, it } from 'vitest';
import { FILTRES_VIDES, aDesFiltres, adresseRecherche, filtresDeLUrl } from './filtres';

const VILLE = '01a15133-67da-7000-9cb3-d257eaeb9a34';

describe('filtres de la recherche (11 §2.3) : lus de l’URL, validés, recomposés', () => {
  it('une URL sans filtre donne les valeurs vides', () => {
    expect(filtresDeLUrl({ q: 'logement' })).toEqual(FILTRES_VIDES);
    expect(aDesFiltres(FILTRES_VIDES)).toBe(false);
  });

  it('les valeurs valides passent, les forgées sont ignorées', () => {
    expect(
      filtresDeLUrl({ ville: VILLE, rayon: '50', pays: 'pas-un-uuid', periode: '7d', etat: 'open' }),
    ).toEqual({ ville: VILLE, rayon: 50, pays: null, periode: '7d', etat: 'open' });
    expect(filtresDeLUrl({ periode: 'hier', etat: 'peut-etre', ville: '../..' })).toEqual(FILTRES_VIDES);
  });

  it('un rayon sans ville est ignoré, un rayon absurde aussi', () => {
    expect(filtresDeLUrl({ rayon: '30' }).rayon).toBeNull();
    expect(filtresDeLUrl({ ville: VILLE, rayon: '9999' }).rayon).toBeNull();
    expect(filtresDeLUrl({ ville: VILLE, rayon: '3.5' }).rayon).toBeNull();
  });

  it('un paramètre répété (tableau) est ignoré plutôt que deviné', () => {
    expect(filtresDeLUrl({ periode: ['7d', '30d'] }).periode).toBe('all');
  });

  it('l’adresse recomposée garde la requête, le type et les filtres — et rien de superflu', () => {
    expect(adresseRecherche({ requete: 'visa', type: null, valeurs: FILTRES_VIDES })).toBe('/recherche?q=visa');
    expect(adresseRecherche({ requete: '', type: null, valeurs: FILTRES_VIDES })).toBe('/recherche');
    const url = adresseRecherche({
      requete: 'visa',
      type: 'GUIDE',
      valeurs: { ville: VILLE, rayon: 10, pays: null, periode: '30d', etat: 'resolved' },
    });
    expect(url).toBe(`/recherche?q=visa&type=GUIDE&ville=${VILLE}&rayon=10&periode=30d&etat=resolved`);
    // Un rayon sans ville ne ressort pas.
    expect(
      adresseRecherche({ requete: 'a', type: null, valeurs: { ...FILTRES_VIDES, rayon: 10 } }),
    ).toBe('/recherche?q=a');
  });
});
