import { describe, expect, it } from 'vitest';
import type { Message } from '@app/shared';
import { bullesDuFil } from './appels';

/**
 * Les lignes système d'un parcours (lot F2) : « X a rejoint le parcours ».
 * Centrées, dans le vert pâle du bandeau de M01, sans auteur, et JAMAIS « Vu ».
 */
const base = {
  senderHandle: 'amina',
  mediaId: null,
  mediaUrl: null,
  storyId: null,
  storyAlive: false,
  deletedAt: null,
} as const;

function msg(id: string, over: Partial<Message>): Message {
  return { ...base, kind: 'TEXT', id, senderUserId: 'moi', body: `corps ${id}`, sentAt: '2026-10-18T10:00:00.000Z', mine: true, ...over };
}

describe('la ligne système du fil', () => {
  it('est centrée, sans auteur, aux couleurs du bandeau de demande', () => {
    const [b] = bullesDuFil(
      { items: [msg('s', { kind: 'SYSTEM', mine: false, body: 'Aïcha a rejoint le parcours' })], meta: { seenAt: null } },
      new Map([['amina', 'Aïcha']]),
    );
    expect(b).toMatchObject({
      systeme: true,
      cote: 'center',
      auteur: '',
      corps: 'Aïcha a rejoint le parcours',
      fond: '#F3F7F5',
      encre: '#0F5C48',
    });
  });

  it('« Vu » reste sous MA dernière bulle de membre, jamais sous une ligne système qui me nomme', () => {
    const fil = [
      msg('sys', { kind: 'SYSTEM', mine: true, sentAt: '2026-10-18T10:20:00.000Z', body: 'Moi a terminé l’étape' }),
      msg('mien', { sentAt: '2026-10-18T10:10:00.000Z' }),
    ];
    const bulles = bullesDuFil({ items: fil, meta: { seenAt: '2026-10-18T10:30:00.000Z' } }, new Map());
    expect(bulles.map((b) => b.mention.includes('Vu'))).toEqual([true, false]);
  });

  it('un message ordinaire n’est pas système', () => {
    const [b] = bullesDuFil({ items: [msg('o', {})], meta: { seenAt: null } }, new Map());
    expect(b?.systeme).toBe(false);
  });
});
