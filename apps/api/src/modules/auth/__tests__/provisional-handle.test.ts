import { describe, expect, it } from 'vitest';
import { newId } from '@app/db';
import { handleSchema } from '@app/shared';
import { provisionalHandle } from '../auth.service';

/**
 * Le pseudo provisoire — 01-identite.md §2.6.
 *
 * Ce test existe à cause d'un bogue RÉEL : une version antérieure ne gardait que
 * 14 caractères de l'identifiant, en affirmant qu'il était « unique par
 * construction ». Un UUID v7 commence par 48 bits d'horodatage, soit douze
 * caractères hexadécimaux : deux comptes créés dans la même milliseconde
 * recevaient le même pseudo, et la création échouait sur la contrainte
 * d'unicité — un 500 pour le membre.
 *
 * Il a fallu deux inscriptions en parallèle pour le voir. Le test le reproduit
 * en une boucle serrée.
 */
describe('pseudo provisoire (§2.6)', () => {
  it('reste unique sur mille identifiants pris d’affilée', () => {
    const handles = new Set<string>();
    for (let i = 0; i < 1000; i += 1) handles.add(provisionalHandle(newId()));
    // Mille identifiants tirés sans attendre partagent forcément des
    // millisecondes : c'est exactement le cas qui échouait.
    expect(handles.size).toBe(1000);
  });

  it('respecte le format du §2.6', () => {
    for (let i = 0; i < 50; i += 1) {
      const handle = provisionalHandle(newId());
      expect(handle.length).toBeGreaterThanOrEqual(3);
      expect(handle.length).toBeLessThanOrEqual(30);
      // `handleSchema` est la règle du §2.6 : on l'éprouve, plutôt que de
      // recopier ici une expression qui pourrait en diverger.
      expect(handleSchema.safeParse(handle).success).toBe(true);
    }
  });

  it('ne commence jamais par un chiffre', () => {
    // Un identifiant hexadécimal commence par un chiffre une fois sur deux, et
    // §2.6 l'interdit : d'où le `m` initial.
    for (let i = 0; i < 50; i += 1) {
      expect(provisionalHandle(newId())).toMatch(/^[a-z]/);
    }
  });
});
