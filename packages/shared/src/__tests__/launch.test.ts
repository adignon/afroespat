import { describe, expect, it } from 'vitest';
import {
  PILOT_CITY_COUNTRY_ISO2,
  PILOT_CITY_SLUG,
  isPilotCitySlug,
} from '../constants/launch.js';

/**
 * L'ARBITRAGE, FIGÉ.
 *
 * Une première réponse avait dit Cotonou ; elle a été ANNULÉE. La ville pilote
 * est Paris. Ce fichier ne prouve pas grand-chose à lui seul — il recopie une
 * constante — mais il rend le changement BRUYANT : personne ne repose une autre
 * ville sans passer devant ce test et devant le suivant, qui lui confronte la
 * décision au référentiel.
 */
describe('la ville pilote', () => {
  it('est Paris', () => {
    expect(PILOT_CITY_SLUG).toBe('paris');
  });

  it('est en France — un réseau CITY s’ouvre là où les membres arrivent', () => {
    expect(PILOT_CITY_COUNTRY_ISO2).toBe('FR');
  });

  /**
   * COTONOU N'EST PAS LA PILOTE — et reste une ville du référentiel.
   *
   * Les deux moitiés comptent. La première garde contre le retour de la version
   * annulée ; la seconde dit pourquoi ce test ne va pas jusqu'à effacer quoi que
   * ce soit : le référentiel des villes est une liste de faits géographiques, et
   * Cotonou en est un.
   */
  it('n’est pas Cotonou', () => {
    expect(isPilotCitySlug('cotonou')).toBe(false);
  });

  it('se reconnaît quels que soient la casse et les espaces', () => {
    expect(isPilotCitySlug('  Paris ')).toBe(true);
    expect(isPilotCitySlug('lyon')).toBe(false);
  });
});
