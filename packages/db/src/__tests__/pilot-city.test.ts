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

/**
 * LE NIVEAU DE VÉRIFICATION NE SE DÉPLACE PAS PAR UN CHANGEMENT DE RÉFÉRENTIEL.
 *
 * 00 §7.2 : L2 = « un numéro d'un pays de DESTINATION actif vérifié par OTP
 * (`phone_numbers.is_destination`) », c'est-à-dire « personne réelle PRÉSENTE SUR
 * LE TERRITOIRE ». `is_destination` est posé à la vérification du numéro, depuis
 * `countries.kind` (`auth.service.ts` : `kind === 'DESTINATION' || kind === 'BOTH'`).
 *
 * ── LE PIÈGE QUE CE TEST EXISTE POUR ATTRAPER ───────────────────────────────
 *
 * Régler le Bénin et le Togo sur `BOTH` pour leur donner des villes a déplacé le
 * niveau L2 : un numéro béninois s'est mis à prouver une présence en France. Six
 * tests dans quatre fichiers l'ont attrapé — mais TOUS À L'EXÉCUTION, contre une
 * base et une API qui tournent. Mesuré en reposant le piège : l'`UPDATE countries
 * SET kind='BOTH'` fait tomber trois tests d'`account.int.test.ts` et un de
 * `kyc.int.test.ts`, et rien d'autre. Sept minutes de suites d'intégration pour
 * apprendre ce qu'une lecture des données de départ dit en quinze millisecondes.
 *
 * Et le piège sous sa forme la plus probable — le changer dans le SEED plutôt
 * qu'en base — ne faisait tomber RIEN de rapide : ce fichier ne gardait que la
 * moitié destination (la pilote est dans un pays `DESTINATION`), pas la moitié
 * origine. Vérifié en mutant les deux lignes du seed : les huit tests d'alors
 * restaient verts.
 *
 * ── CE QUE CE TEST DIT, ET CE QU'IL NE DIT PAS ──────────────────────────────
 *
 * Il ne dit PAS « le Bénin est ORIGIN » — ce serait recopier la donnée, et un
 * dix-huitième pays échapperait à la règle. Il dit : AUCUN pays ne peut compter
 * comme destination sans être le pays de destination du produit. La règle de
 * VILLE reste libre : un pays d'origine peut avoir autant de villes qu'il veut, et
 * `referentials.int.test.ts` le garde de son côté (« accepte une ville sous un pays
 * ORIGIN, SANS toucher au niveau de vérification »). Les deux règles sont
 * distinctes, et ce fichier ne garde que celle du niveau.
 */
describe('le niveau L2 et le référentiel des pays (00 §7.2)', () => {
  /** Les `kind` qui font poser `phone_numbers.is_destination = true`. */
  const COMPTENT_COMME_DESTINATION: readonly string[] = ['DESTINATION', 'BOTH'];

  const attestentUnePresence = COUNTRIES.filter((c) => COMPTENT_COMME_DESTINATION.includes(c.kind));

  it('SEUL le pays de destination du produit peut attester une présence', () => {
    expect(
      attestentUnePresence.map((c) => c.iso2).sort(),
      'Un pays dont `kind` vaut DESTINATION ou BOTH rend `is_destination = true` sur ' +
        'les numéros à son indicatif, donc L2 — « personne présente sur le territoire ». ' +
        'Passer un pays d’ORIGINE en BOTH pour lui donner des villes déplace le niveau : ' +
        'un numéro béninois se met à prouver une présence en France. La règle de ville ' +
        'et la règle de niveau sont deux choses distinctes.',
    ).toEqual([PILOT_CITY_COUNTRY_ISO2]);
  });

  it('et ce pays est bien celui de la ville pilote, actif', () => {
    const destination = attestentUnePresence[0];
    expect(destination?.iso2).toBe(PILOT_CITY_COUNTRY_ISO2);
    // Inactif, il n'attesterait plus rien : `levelFor` rejoint `countries` et
    // exige `isActive`. Le seed doit donc l'ouvrir.
    expect(destination?.isActive).toBe(true);
  });

  /**
   * LE TÉMOIN DE CE FICHIER, et sa première version était FAUSSE.
   *
   * Elle affirmait « au moins un pays d'ORIGINE est actif ». Or le piège met le
   * Bénin ET le Togo en `BOTH` — les deux seuls pays d'origine ouverts — donc le
   * témoin tombait AVEC la règle. Un témoin qui rougit sur la mutation qu'il doit
   * ignorer ne témoigne de rien : il double la règle au lieu de la cerner.
   *
   * Celui-ci ne regarde pas `kind` du tout. Il tient quel que soit le classement
   * des pays, et c'est ce qui rend le test au-dessus lisible : ce fichier ne
   * mesure pas « il y a dix-sept pays bien remplis », il mesure QUI peut attester
   * une présence.
   */
  it('ne dit rien du classement des pays : chacun garde son indicatif', () => {
    expect(COUNTRIES.length).toBeGreaterThan(1);
    for (const pays of COUNTRIES) {
      expect(pays.iso2, `Un pays sans iso2 : ${pays.nameFr}`).toMatch(/^[A-Z]{2}$/);
      expect(pays.dialCode, `Un pays sans indicatif : ${pays.iso2}`).toMatch(/^\+\d{1,4}$/);
    }
  });
});
