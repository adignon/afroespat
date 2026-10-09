'use client';

import { useCallback, useState, type ReactNode } from 'react';
import { notifyError, notifySuccess } from '@/components/notifications';
import { ApiError, memberApi } from '@/lib/api/index';
import { z } from 'zod';
import type { K05Data, LigneContact } from './data';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LES QUATRE GESTES DE « CONTACTS »                                         ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « La page des contacts est faite ? Les demandes, suggestions et
 * bloqués ? »
 *
 * MESURÉ, deux défauts l'un sur l'autre : les trois sections étaient des LIGNES
 * UNIQUES — la maquette en dessine une par section, et le transcodage l'avait
 * prise pour la liste — et les quatre boutons n'avaient aucun geste.
 *
 * ── LES ROUTES EXISTAIENT TOUTES LES QUATRE ───────────────────────────────
 *
 *   · `POST /connection-requests/:id/accept` — accepter ;
 *   · `POST /connection-requests/:id/decline` — refuser, et §3.1 précise « sans
 *     notification » : on n'annonce donc rien à l'autre, et l'écran ne promet
 *     rien non plus ;
 *   · `POST /connection-suggestions/accept` — qui prend `{ origin, toHandle }`,
 *     pas l'identifiant de la suggestion ;
 *   · `DELETE /blocks/:userId` — débloquer.
 *
 * ⚠ DÉBLOQUER NE RESTAURE PAS LES CONTACTS (§4), et l'écran le dit dans son
 * annonce : c'est la seule conséquence qu'on ne peut pas défaire, et la taire
 * laisserait croire que le blocage était réversible.
 */
export function ContactsVivants({
  donnees,
  onRecharger,
  children,
}: {
  readonly donnees: K05Data;
  readonly onRecharger: () => void;
  readonly children: (enrichies: K05Data) => ReactNode;
}) {
  const [enVol, setEnVol] = useState(false);

  const appeler = useCallback(
    (promesse: Promise<unknown>, reussite: string, echec: string) => {
      setEnVol(true);
      promesse
        .then(() => {
          notifySuccess(reussite);
          onRecharger();
        })
        .catch((cause: unknown) => {
          notifyError(cause instanceof ApiError ? cause.displayMessage : echec);
        })
        .finally(() => {
          setEnVol(false);
        });
    },
    [onRecharger],
  );

  const enrichies: K05Data = {
    ...donnees,
    contactsOccupe: enVol,
    demandesRecues: donnees.demandesRecues.map(
      (d): LigneContact => ({
        ...d,
        onPrincipal: () => {
          appeler(
            memberApi.post(`/connection-requests/${d.cle}/accept`, z.unknown(), { body: {} }),
            `${d.nom} fait maintenant partie de vos contacts.`,
            'La demande n’a pas pu être acceptée.',
          );
        },
        onSecondaire: () => {
          appeler(
            memberApi.post(`/connection-requests/${d.cle}/decline`, z.unknown(), { body: {} }),
            'Demande refusée.',
            'La demande n’a pas pu être refusée.',
          );
        },
      }),
    ),
    suggestions: donnees.suggestions.map(
      (g): LigneContact => ({
        ...g,
        onPrincipal: () => {
          /**
           * `origin` ET `toHandle`, pas l'identifiant : `acceptSuggestionSchema`
           * ne porte que ces deux-là. Une suggestion n'est pas une ressource
           * qu'on accepte, c'est une demande qu'on envoie à partir d'elle.
           */
          appeler(
            memberApi.post('/connection-suggestions/accept', z.unknown(), {
              body: { origin: g.origine ?? 'SAME_CITY', toHandle: g.handle },
            }),
            `Demande envoyée à ${g.nom}.`,
            'La demande n’a pas pu être envoyée.',
          );
        },
      }),
    ),
    bloques: donnees.bloques.map(
      (b): LigneContact => ({
        ...b,
        onPrincipal: () => {
          appeler(
            memberApi.del(`/blocks/${b.cle}`, z.unknown()),
            `${b.nom} est débloqué. Vos anciens contacts ne sont pas restaurés.`,
            'Le déblocage n’a pas pu être fait.',
          );
        },
      }),
    ),
  };

  return <>{children(enrichies)}</>;
}
