import { describe, expect, it } from 'vitest';
import { FEED_ERROR_MESSAGES, STORY_ATTACHMENT_MESSAGES, messageDeRattachement } from '../index.js';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ UN REFUS QUI NE NOMME PAS LE CHAMP NE SERT À RIEN                         ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur, devant « Ce type de story demande un rattachement que vous n'avez
 * pas indiqué » : « Ceci est lié à quoi ? Qu'est-ce qui manque ? » La question est
 * la preuve du défaut — la phrase dit qu'il manque quelque chose, et le membre n'a
 * aucun moyen de savoir quoi.
 *
 * Le serveur le sait : il met le motif dans `details.reason`. Ce fichier éprouve
 * les deux moitiés de la réponse — chaque motif que le service peut produire a sa
 * phrase, et un motif inconnu retombe sur la générique plutôt que sur du vide.
 */
describe('le refus de rattachement nomme ce qui manque', () => {
  /**
   * LES MOTIFS SONT RELEVÉS DANS `feed.service.ts`, un par un : ce sont les seuls
   * que `resolveStoryAttachment` et `resolveMediaAttachment` passent à `fail`.
   * Un motif ajouté là-bas et oublié ici fait rougir ce cas — c'est tout son objet.
   */
  const MOTIFS = [
    'CONSEIL_NEEDS_STEP_OR_SUBJECT',
    'CONSEIL_CATEGORY_MUST_BE_SUBJECT',
    'DECOUVERTE_NEEDS_CATEGORY',
    'DECOUVERTE_NEEDS_PLACE',
    'DECOUVERTE_HAS_NO_STEP',
    'INFORMATION_NEEDS_SUBJECT',
    'INFORMATION_HAS_NO_STEP',
    'VALID_UNTIL_INFORMATION_ONLY',
    'VALID_UNTIL_IN_PAST',
    'CITY_REQUIRED',
    'MEDIA_NOT_READY',
    'EXIF_NOT_STRIPPED',
  ] as const;

  it('chaque motif du service a sa phrase', () => {
    for (const motif of MOTIFS) {
      const phrase = STORY_ATTACHMENT_MESSAGES[motif];
      expect(phrase, motif).toBeDefined();
      // Une phrase, pas une étiquette : elle doit se lire.
      expect((phrase ?? '').length, motif).toBeGreaterThan(30);
      expect(phrase, motif).not.toBe(FEED_ERROR_MESSAGES.INVALID_ATTACHMENT);
    }
  });

  it('la phrase du lieu NOMME le lieu — c\u2019est le refus que le porteur a rencontré', () => {
    expect(messageDeRattachement('DECOUVERTE_NEEDS_PLACE')).toContain('lieu');
  });

  it('un motif inconnu retombe sur la phrase générique, jamais sur du vide', () => {
    for (const inconnu of ['QUELQUE_CHOSE_DE_NEUF', '', undefined, null, 42]) {
      expect(messageDeRattachement(inconnu)).toBe(FEED_ERROR_MESSAGES.INVALID_ATTACHMENT);
    }
  });
});
