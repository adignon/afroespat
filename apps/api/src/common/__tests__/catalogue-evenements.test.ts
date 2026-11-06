import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { JOURNAL_ONLY_EVENT_TYPES } from '../outbox.service';

/**
 * Cohérence du catalogue d'événements : un type sans lecteur est une file que
 * personne ne vide, et l'on croit la chaîne branchée. Chaque type est soit ABONNÉ
 * (`queue/event-subscriptions.service.ts`), soit déclaré « journal seul ».
 */
const read = (relative: string): string => readFileSync(resolve(__dirname, '..', '..', relative), 'utf8');

function catalogueTypes(): string[] {
  const source = read('common/outbox.service.ts');
  const start = source.indexOf('export type DomainEventType');
  const end = source.indexOf('export const JOURNAL_ONLY_EVENT_TYPES');
  const body = source.slice(start, end);
  return [...body.matchAll(/^\s*\|\s*'([a-z_]+\.[a-z_]+)'/gm)].map((m) => m[1]!);
}

describe('catalogue des événements de domaine', () => {
  const subscriptions = read('queue/event-subscriptions.service.ts');
  const subscribed = (type: string): boolean => subscriptions.includes(`'${type}'`);

  it('tout type a un abonné ou est déclaré « journal seul »', () => {
    const orphans = catalogueTypes().filter((t) => !subscribed(t) && !JOURNAL_ONLY_EVENT_TYPES.includes(t));
    expect(orphans).toEqual([]);
  });

  it('la liste « journal seul » ne contient ni type inconnu ni type désormais abonné', () => {
    const known = new Set(catalogueTypes());
    for (const type of JOURNAL_ONLY_EVENT_TYPES) {
      expect(known.has(type), `${type} absent du catalogue`).toBe(true);
      expect(subscribed(type), `${type} est abonné : le retirer de la liste`).toBe(false);
    }
  });

  it('les chaînes câblées dans ce lot sont bien abonnées', () => {
    for (const type of [
      'pro.approved',
      'pro.rejected',
      'scam_alert.published',
      'moderation.case_opened',
      'connection.created',
      'mentorship.extended',
    ]) {
      expect(subscribed(type), type).toBe(true);
    }
  });
});
