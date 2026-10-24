'use client';

import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { cancelEventSchema, rsvpResponseSchema, type RsvpResponse } from '@app/shared';
import { useGeste } from '@/components/entraide/geste';
import { FenetreConfirmation } from '@/components/fenetre-confirmation';
import { FenetreSignalement } from '@/components/fenetre-signalement';
import { memberApi } from '@/lib/api/index';
import { rangFr } from '@/lib/rang';
import type { ActionsEvenement } from './data';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LES GESTES DE E02 — RSVP, « JE SUIS LÀ », ANNULER, SIGNALER (09 §3.2–§3.4)  ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Chaque geste est UN appel, et c'est le serveur qui décide :
 *
 *   · `PUT /events/:id/rsvp` — si la capacité est atteinte, il répond
 *     `WAITLIST` de lui-même (§3.2). Le front ne calcule pas « complet » pour
 *     choisir : il demande « je viens » et affiche ce qui revient ;
 *   · `DELETE /events/:id/rsvp` — retire la participation et promeut la file ;
 *   · `POST /events/:id/check-in` sans corps — « Je suis là ». La fenêtre de H−0 à
 *     H+6 est la règle du serveur (`CHECKIN_WINDOW_CLOSED`), dont la phrase est
 *     affichée telle quelle ;
 *   · `POST /events/:id/cancel` — l'organisateur, avec un motif facultatif de
 *     500 caractères au plus, BORNE LUE sur `cancelEventSchema` ;
 *   · le signalement passe par la feuille commune (`EVENT`).
 *
 * `LEVEL_REQUIRED` n'est jamais deviné : `useGeste` ouvre la fenêtre de niveau sur
 * le `403` du serveur (participer est réservé aux profils L2, table des capacités).
 *
 * Après un geste réussi, `recharger` relit l'écran : le compteur, la place dans
 * la file et les boutons viennent du serveur, jamais d'un calcul local.
 */
const MOTIF_MAX = cancelEventSchema.shape.reason.unwrap().maxLength ?? 500;

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

export function useActionsEvenement(
  eventId: string,
  recharger: () => void,
): { readonly actions: ActionsEvenement; readonly fenetres: ReactNode } {
  const router = useRouter();
  const { occupe, lancer, fenetre } = useGeste();
  const [retour, setRetour] = useState('');
  const [annulation, setAnnulation] = useState(false);
  const [motif, setMotif] = useState('');
  const [signalement, setSignalement] = useState(false);

  const terminer = useCallback(
    (ok: boolean, phrase: string): void => {
      setRetour(ok ? phrase : '');
      if (ok) recharger();
    },
    [recharger],
  );

  const onRsvp = useCallback(
    (statut: 'GOING' | 'MAYBE' | 'DECLINED'): void => {
      // La réponse du serveur dit le statut RÉEL : un « Je viens » sur un événement
      // complet revient en `WAITLIST` avec la position dans la file. On l'annonce
      // telle quelle plutôt que de laisser croire à une place confirmée.
      let reel: RsvpResponse | null = null;
      void lancer(
        async () => {
          reel = await memberApi.put(`/events/${eventId}/rsvp`, rsvpResponseSchema, {
            body: { status: statut },
          });
        },
        { recharger: false, echecRepli: 'Votre réponse n’a pas pu être enregistrée.' },
      ).then((ok) => {
        terminer(ok, phraseRsvp(statut, reel));
      });
    },
    [eventId, lancer, terminer],
  );

  const onRetirer = useCallback((): void => {
    void lancer(() => memberApi.del(`/events/${eventId}/rsvp`, z.unknown()), {
      recharger: false,
      echecRepli: 'Votre participation n’a pas pu être retirée.',
    }).then((ok) => {
      terminer(ok, 'Votre participation est retirée.');
    });
  }, [eventId, lancer, terminer]);

  const onPresent = useCallback((): void => {
    void lancer(() => memberApi.post(`/events/${eventId}/check-in`, z.unknown(), { body: {} }), {
      recharger: false,
      echecRepli: 'Votre présence n’a pas pu être enregistrée.',
    }).then((ok) => {
      terminer(ok, 'Votre présence est enregistrée. Merci d’être venu·e !');
    });
  }, [eventId, lancer, terminer]);

  const confirmerAnnulation = useCallback((): void => {
    const corps = motif.trim() === '' ? {} : { reason: motif.trim() };
    void lancer(() => memberApi.post(`/events/${eventId}/cancel`, z.unknown(), { body: corps }), {
      recharger: false,
      echecRepli: 'L’événement n’a pas pu être annulé.',
    }).then((ok) => {
      if (ok) {
        setAnnulation(false);
        setMotif('');
      }
      terminer(ok, 'L’événement est annulé ; les inscrits sont prévenus.');
    });
  }, [eventId, lancer, motif, terminer]);

  const actions = useMemo<ActionsEvenement>(
    () => ({
      occupe,
      retour,
      onRsvp,
      onRetirer,
      onPresent,
      onSignaler: () => {
        setSignalement(true);
      },
      onAnnuler: () => {
        setAnnulation(true);
      },
      onModifier: () => {
        router.push(`/agenda/nouveau?modifier=${eventId}`);
      },
      presenceHref: `/agenda/${eventId}/presence`,
    }),
    [eventId, occupe, onPresent, onRetirer, onRsvp, retour, router],
  );

  const fenetres = (
    <>
      {fenetre}
      <FenetreConfirmation
        ouverte={annulation}
        nom="ANNULATION-EVENEMENT"
        titre="Annuler l’événement"
        question="Les personnes inscrites seront prévenues. Vous pouvez leur dire pourquoi."
        precision="Un événement annulé reste visible, barré, pendant sept jours, puis disparaît."
        champ={{ libelle: 'Motif (facultatif)', valeur: motif, onChange: setMotif, max: MOTIF_MAX }}
        libelleConfirmer="Annuler l’événement"
        occupe={occupe}
        onConfirmer={confirmerAnnulation}
        onAnnuler={() => {
          setAnnulation(false);
        }}
      />
      <FenetreSignalement
        sujet={signalement ? { type: 'EVENT', id: eventId } : null}
        onFermer={() => {
          setSignalement(false);
        }}
      />
    </>
  );

  return { actions, fenetres };
}
