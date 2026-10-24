import type { RsvpResponse } from '@app/shared';
import { rangFr } from '@/lib/rang';

/**
 * La phrase affichée après un RSVP. Sur la liste d'attente, la POSITION renvoyée par
 * le serveur est dite : « Complet : vous êtes 2e sur la liste d'attente. »
 */
export function phraseRsvp(
  demande: 'GOING' | 'MAYBE' | 'DECLINED',
  reponse: Pick<RsvpResponse, 'status' | 'waitlistPosition'> | null,
): string {
  if (reponse?.status === 'WAITLIST') {
    return reponse.waitlistPosition === null
      ? 'Complet : vous êtes sur la liste d’attente.'
      : `Complet : vous êtes ${rangFr(reponse.waitlistPosition)} sur la liste d’attente.`;
  }
  return demande === 'GOING'
    ? 'Votre réponse est enregistrée.'
    : demande === 'MAYBE'
      ? 'Noté : peut-être.'
      : 'Noté : vous ne venez pas.';
}
