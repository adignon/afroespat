import { describe, expect, it } from 'vitest';
import { PILOT_CITY_COUNTRY_ISO2, PILOT_CITY_SLUG } from '@app/shared';
import { CITIES, COUNTRIES } from '../seed/referentials.js';
import { resolvePilotCityActivation } from '../seed/pilot-city.js';

/**
 * LÀ OÙ LA DÉCISION RENCONTRE LA DONNÉE.
 *
 * Le test frère, dans `@app/shared`, ne fait que recopier la constante : il
 * rougit si on la change, et c'est tout ce qu'il prétend. CELUI-CI confronte
 * l'arbitrage au référentiel — la pilote doit EXISTER, être dans le bon pays, et
 * porter ce que la France exige pour une ville (région et coordonnées, qui
 * servent au tri par proximité et au compteur « à moins de 30 km »).
 *
 * D'où la mutation qui compte : reposer `PILOT_CITY_SLUG` sur une ville absente
 * du référentiel, ou sur une ville d'un pays d'origine, fait tomber ce fichier
 * sans qu'on ait touché à une ligne de données.
 */
describe('la ville pilote au référentiel des villes', () => {
  const pilot = CITIES.find((c) => c.slug === PILOT_CITY_SLUG);

  it('existe dans les données de départ', () => {
    expect(pilot, `Aucune ville au slug « ${PILOT_CITY_SLUG} » dans CITIES.`).toBeDefined();
  });

  /**
   * `countryIso2` absent vaut France — c'est la convention de `CitySeed`, qui
   * évite de répéter `'FR'` quarante-trois fois. Le test la relit telle quelle.
   */
  it('est rattachée au pays attendu, et ce pays est une DESTINATION active', () => {
    expect(pilot?.countryIso2 ?? 'FR').toBe(PILOT_CITY_COUNTRY_ISO2);

    const country = COUNTRIES.find((c) => c.iso2 === PILOT_CITY_COUNTRY_ISO2);
    expect(country?.isActive).toBe(true);
    /**
     * `DESTINATION` et non `BOTH`, et ce n'est PAS la même règle que la ville.
     *
     * `kind` décide aussi du niveau L2 par `phone_numbers.is_destination` (01
     * §2.5) : passer un pays en `BOTH` pour lui donner des villes ferait prouver
     * une présence en France à un numéro qui n'y est pas. Ce test garde le pays
     * de la pilote, pas la règle des niveaux — mais il tombera si quelqu'un
     * confond encore les deux en touchant à la France.
     */
    expect(country?.kind).toBe('DESTINATION');
  });

  it('porte la région et les coordonnées qu’une ville de France exige', () => {
    expect(pilot?.region).toBeTruthy();
    expect(typeof pilot?.latitude).toBe('number');
    expect(typeof pilot?.longitude).toBe('number');
    // Métropole : la boîte englobante, large, refuse un zéro oublié ou une
    // inversion latitude/longitude.
    expect(pilot?.latitude).toBeGreaterThan(41);
    expect(pilot?.latitude).toBeLessThan(52);
    expect(pilot?.longitude).toBeGreaterThan(-6);
    expect(pilot?.longitude).toBeLessThan(10);
  });

  /**
   * Le référentiel n'est PAS un classement. Nommer la pilote n'a retiré aucune
   * ville, Cotonou comprise — elle est au Bénin, elle y reste.
   */
  it('n’a évincé aucune ville du référentiel', () => {
    expect(CITIES.find((c) => c.slug === 'cotonou')?.countryIso2).toBe('BJ');
    expect(CITIES.filter((c) => c.countryIso2 === 'BJ').length).toBeGreaterThan(0);
    expect(CITIES.filter((c) => c.countryIso2 === 'TG').length).toBeGreaterThan(0);
  });
});

/**
 * CE QUE LE SEED OUVRE — et surtout, quand il n'ouvre rien.
 */
describe('l’activation de la ville pilote par le seed', () => {
  it('n’ouvre RIEN sans qu’on le demande', () => {
    expect(resolvePilotCityActivation({})).toBeNull();
    expect(resolvePilotCityActivation({ SEED_ACTIVATE_PILOT_CITY: 'false' })).toBeNull();
    expect(resolvePilotCityActivation({ SEED_PILOT_CITY_SLUG: '   ' })).toBeNull();
  });

  /**
   * LE TEST QUI COMPTE : l'opt-in ne nomme AUCUNE ville, et le seed ouvre malgré
   * tout la bonne. C'est la preuve que la constante est LUE là où elle sert —
   * changer `PILOT_CITY_SLUG` change ce que cette ligne renvoie.
   */
  it('ouvre la ville pilote nommée, sans que l’environnement la désigne', () => {
    expect(resolvePilotCityActivation({ SEED_ACTIVATE_PILOT_CITY: 'true' })).toEqual({
      slug: PILOT_CITY_SLUG,
      overridden: false,
    });
  });

  it('laisse le développement ouvrir une AUTRE ville, en le signalant', () => {
    expect(resolvePilotCityActivation({ SEED_PILOT_CITY_SLUG: 'lyon' })).toEqual({
      slug: 'lyon',
      overridden: true,
    });
  });

  it('refuse d’ouvrir quoi que ce soit en production', () => {
    expect(() =>
      resolvePilotCityActivation({ SEED_ACTIVATE_PILOT_CITY: 'true', NODE_ENV: 'production' }),
    ).toThrow(/production/);
    expect(() =>
      resolvePilotCityActivation({ SEED_PILOT_CITY_SLUG: 'lyon', NODE_ENV: 'production' }),
    ).toThrow(/production/);
    // Sans demande, la production passe sans lever : c'est le cas nominal.
    expect(resolvePilotCityActivation({ NODE_ENV: 'production' })).toBeNull();
  });
});
