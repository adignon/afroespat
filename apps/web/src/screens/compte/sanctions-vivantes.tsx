'use client';

import { useState, type ReactNode } from 'react';
import { notifyError, notifySuccess } from '@/components/notifications';
import { ApiError, memberApi } from '@/lib/api/index';
import { z } from 'zod';
import type { K09Data } from './data';
import type { Capability } from '@app/shared';
import { FenetreNiveau } from '@/components/fenetre-niveau';
import { useCapacites } from '@/lib/capacites';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ CONTESTER UNE SANCTION — LA BOÎTE ÉTAIT UN TEXTE D'EXEMPLE                ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « La page des sanctions et ses options ? »
 *
 * MESURÉ : zéro champ sur le cadre. La boîte « Expliquez votre point de vue »
 * portait la phrase d'exemple de la maquette — « Le lien renvoyait vers une
 * association gratuite, pas une publicité. » — et « Envoyer ma contestation »
 * n'avait aucun geste. `POST /sanctions/:id/appeal` répondait déjà.
 *
 * ── VINGT CARACTÈRES, ET C'EST LE SERVEUR QUI LE DIT ──────────────────────
 *
 * `appealSchema` : `min(20)`. Le bouton reste éteint en dessous. La planche écrit
 * « UNE SEULE FOIS » juste au-dessus : un refus pour texte trop court gâcherait
 * l'unique tentative dans l'esprit du membre, même si le serveur ne la compte
 * pas.
 *
 * ── SANS SANCTION, RIEN À CONTESTER ───────────────────────────────────────
 *
 * `sanctionId` vaut `null` quand `GET /me/sanctions` est vide. Le bouton est
 * alors éteint lui aussi : la planche dessine la carte de contestation en
 * permanence, et elle ne peut pas savoir qu'il n'y a rien à contester.
 */
export function SanctionsVivantes({
  donnees,
  sanctionId,
  onRecharger,
  children,
}: {
  readonly donnees: K09Data;
  readonly sanctionId: string | null;
  readonly onRecharger: () => void;
  readonly children: (enrichies: K09Data) => ReactNode;
}) {
  const [texte, setTexte] = useState('');
  const [enVol, setEnVol] = useState(false);
  const { peut } = useCapacites();
  /** La capacité refusée au dernier geste — elle ouvre l'invitation à monter. */
  const [niveauRefuse, setNiveauRefuse] = useState<Capability | null>(null);

  const enrichies: K09Data = {
    ...donnees,
    contestationTexte: texte,
    onContestationTexte: (e) => {
      setTexte(e.target.value);
    },
    contestationBloquee: enVol || sanctionId === null || texte.trim().length < 20,
    onContester: () => {
      /**
       * ── CONTESTER DEMANDE N2 DEPUIS LE 2026-10-09 ───────────────────────
       *
       * Le porteur a rangé `sanction.appeal` avec « tout le reste ». On le dit
       * avant l'envoi, après vingt caractères écrits au minimum : découvrir le
       * refus APRÈS avoir rédigé sa défense serait le pire moment.
       *
       * ⚠ CONSÉQUENCE CONSIGNÉE : un membre sanctionné avant d'atteindre N2 ne
       * peut plus contester, et selon la sanction il ne peut pas non plus monter
       * de niveau. C'est écrit dans `capabilities.ts`, sur la capacité.
       */
      if (!peut('sanction.appeal')) {
        setNiveauRefuse('sanction.appeal');
        return;
      }
      if (sanctionId === null || enVol || texte.trim().length < 20) return;
      setEnVol(true);
      memberApi
        .post(`/sanctions/${sanctionId}/appeal`, z.unknown(), { body: { text: texte.trim() } })
        .then(() => {
          setTexte('');
          notifySuccess('Contestation envoyée. Réponse d’un modérateur sous 72 h.');
          onRecharger();
        })
        .catch((cause: unknown) => {
          notifyError(
            cause instanceof ApiError
              ? cause.displayMessage
              : 'La contestation n’a pas pu être envoyée.',
          );
        })
        .finally(() => {
          setEnVol(false);
        });
    },
  };

  return (
    <>
      <FenetreNiveau
        capacite={niveauRefuse}
        onFermer={() => {
          setNiveauRefuse(null);
        }}
      />
      {children(enrichies)}
    </>
  );
}
