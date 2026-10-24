import { describe, expect, it } from 'vitest';
import { rsvpResponseSchema } from '@app/shared';
import { phraseRsvp } from './rsvp';

describe('la phrase affichée après un RSVP (09 §3.2)', () => {
  it('sur la liste d’attente, elle dit la POSITION renvoyée par le serveur', () => {
    expect(phraseRsvp('GOING', { status: 'WAITLIST', waitlistPosition: 1 })).toBe(
      'Complet : vous êtes 1re sur la liste d’attente.',
    );
    expect(phraseRsvp('GOING', { status: 'WAITLIST', waitlistPosition: 3 })).toBe(
      'Complet : vous êtes 3e sur la liste d’attente.',
    );
    expect(phraseRsvp('GOING', { status: 'WAITLIST', waitlistPosition: null })).toBe(
      'Complet : vous êtes sur la liste d’attente.',
    );
  });

  it('sinon elle suit le choix du membre, jamais « enregistrée » à tort', () => {
    expect(phraseRsvp('GOING', { status: 'GOING', waitlistPosition: null })).toBe('Votre réponse est enregistrée.');
    expect(phraseRsvp('MAYBE', { status: 'MAYBE', waitlistPosition: null })).toBe('Noté : peut-être.');
    expect(phraseRsvp('DECLINED', null)).toBe('Noté : vous ne venez pas.');
  });

  it('la charge relevée de PUT /events/:id/rsvp passe le schéma partagé, un champ en trop est refusé', () => {
    const charge = { status: 'WAITLIST', waitlistPosition: 2, attendeeCount: 4 };
    expect(rsvpResponseSchema.safeParse(charge).success).toBe(true);
    expect(rsvpResponseSchema.safeParse({ ...charge, extra: 1 }).success).toBe(false);
    expect(rsvpResponseSchema.safeParse({ ...charge, waitlistPosition: 0 }).success).toBe(false);
  });
});
