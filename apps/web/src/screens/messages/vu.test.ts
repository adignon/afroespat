import { describe, expect, it } from 'vitest';
import type { Message } from '@app/shared';
import { bullesDuFil } from './appels';

const base = {
  senderHandle: 'amina',
  kind: 'TEXT',
  mediaId: null,
  mediaUrl: null,
  storyId: null,
  storyAlive: false,
  deletedAt: null,
} as const;

function msg(id: string, mine: boolean, sentAt: string, over: Partial<Message> = {}): Message {
  return { ...base, id, senderUserId: mine ? 'moi' : 'lui', body: `corps ${id}`, sentAt, mine, ...over } as Message;
}

// L'API rend du plus récent au plus ancien.
const FIL = [
  msg('c', true, '2026-10-18T10:20:00.000Z'),
  msg('b', false, '2026-10-18T10:10:00.000Z'),
  msg('a', true, '2026-10-18T10:00:00.000Z'),
];

describe('« Vu » (08 §7.3) : sous MA dernière bulle, quand l’autre l’a lue', () => {
  const mentions = (seenAt: string | null) =>
    bullesDuFil({ items: FIL, meta: { seenAt } }, new Map()).map((b) => b.mention.includes('Vu'));

  it('rien tant que l’autre n’a rien lu', () => {
    expect(mentions(null)).toEqual([false, false, false]);
  });

  it('pas si l’autre a lu AVANT ma dernière bulle', () => {
    expect(mentions('2026-10-18T10:15:00.000Z')).toEqual([false, false, false]);
  });

  it('une seule bulle porte « Vu » : la dernière des miennes, lue', () => {
    expect(mentions('2026-10-18T10:30:00.000Z')).toEqual([false, false, true]);
  });

  it('une dernière bulle supprimée laisse « Vu » à la précédente des miennes', () => {
    const fil = [msg('c', true, '2026-10-18T10:20:00.000Z', { deletedAt: '2026-10-18T10:21:00.000Z' }), FIL[1] as Message, FIL[2] as Message];
    const vus = bullesDuFil({ items: fil, meta: { seenAt: '2026-10-18T10:30:00.000Z' } }, new Map()).map((b) => b.mention.includes('Vu'));
    // Ordre de lecture : a (la mienne), b (l'autre), c (supprimée).
    expect(vus).toEqual([true, false, false]);
  });

  it('le fil est remis dans l’ordre de lecture', () => {
    expect(bullesDuFil({ items: FIL, meta: { seenAt: null } }, new Map()).map((b) => b.id)).toEqual(['a', 'b', 'c']);
  });
});
