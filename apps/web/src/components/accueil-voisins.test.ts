import { describe, expect, it } from 'vitest';
import { CONNECTION_MESSAGE_MAX, CONNECTION_MESSAGE_MIN, createConnectionRequestSchema } from '@app/shared';
import { MOT_PAR_DEFAUT } from './accueil-voisins';

/**
 * « Saluer » (A01) envoie une demande de contact : son mot d'accueil doit passer
 * `createConnectionRequestSchema`, sans quoi le bouton échouerait à tous les coups
 * en 400 (le minimum est celui de `CONNECTION_MESSAGE_MIN`, 13 §3.1).
 */
describe('« Saluer » — le mot d’accueil', () => {
  it('respecte les bornes du serveur', () => {
    expect(MOT_PAR_DEFAUT.length).toBeGreaterThanOrEqual(CONNECTION_MESSAGE_MIN);
    expect(MOT_PAR_DEFAUT.length).toBeLessThanOrEqual(CONNECTION_MESSAGE_MAX);
    expect(createConnectionRequestSchema.safeParse({ toHandle: 'amina-d', message: MOT_PAR_DEFAUT }).success).toBe(true);
  });
});
