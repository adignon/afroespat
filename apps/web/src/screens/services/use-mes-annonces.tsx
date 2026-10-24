'use client';

import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { z } from 'zod';
import { useGeste } from '@/components/entraide/geste';
import { FenetreConfirmation } from '@/components/fenetre-confirmation';
import { memberApi } from '@/lib/api/index';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ S09 — MES ANNONCES : RENOUVELER, PAUSE, TROUVÉ, REPRENDRE, SUPPRIMER        ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Les puces étaient des `<span>` — « les routes existent, et les brancher demande
 * l'écran de confirmation que la maquette ne dessine pas » (ancien commentaire de
 * `screens/services/data.ts`). La confirmation est maintenant celle du dépôt
 * (`FenetreConfirmation`, dont le châssis est la fenêtre K08 de `08 Compte`), et
 * « Supprimer » ne part QU'APRÈS elle.
 *
 * Les routes sont celles de 10 §6.1 : `POST /housing/:id/renew|pause|resume|taken`
 * et `DELETE /housing/:id` ; pour l'emploi `POST /jobs/:id/renew` et `DELETE
 * /jobs/:id`. Le serveur décide : `RENEW_TOO_SOON` (une fois par 30 jours) s'écrit
 * tel quel, sans que le front recalcule la date.
 */
export interface GestesMesAnnonces {
  /** L'onglet montré : les annonces de logement ou les offres d'emploi. */
  readonly onglet: 'logement' | 'emploi';
  readonly onOnglet: (onglet: 'logement' | 'emploi') => void;
  readonly occupe: boolean;
  readonly onRenouveler: (id: string, logement: boolean) => void;
  readonly onPause: (id: string) => void;
  readonly onReprendre: (id: string) => void;
  readonly onTrouve: (id: string) => void;
  readonly onSupprimer: (id: string, logement: boolean) => void;
}

const RIEN = (): void => {};

export const gestesMesAnnoncesVides: GestesMesAnnonces = {
  onglet: 'logement',
  onOnglet: RIEN,
  occupe: false,
  onRenouveler: RIEN,
  onPause: RIEN,
  onReprendre: RIEN,
  onTrouve: RIEN,
  onSupprimer: RIEN,
};

export function useMesAnnonces(recharger: () => void): {
  readonly gestes: GestesMesAnnonces;
  readonly fenetres: ReactNode;
} {
  const { occupe, lancer, fenetre } = useGeste();
  const [aSupprimer, setASupprimer] = useState<{ id: string; logement: boolean } | null>(null);
  const [onglet, setOnglet] = useState<'logement' | 'emploi'>('logement');

  const agir = useCallback(
    (appel: () => Promise<unknown>, succes: string, echecRepli: string): void => {
      void lancer(appel, { recharger: false, succes, echecRepli }).then((ok) => {
        if (ok) recharger();
      });
    },
    [lancer, recharger],
  );

  const gestes = useMemo<GestesMesAnnonces>(
    () => ({
      onglet,
      onOnglet: setOnglet,
      occupe,
      onRenouveler: (id, logement) => {
        agir(
          () => memberApi.post(logement ? `/housing/${id}/renew` : `/jobs/${id}/renew`, z.unknown()),
          'Votre annonce est renouvelée.',
          'L’annonce n’a pas pu être renouvelée.',
        );
      },
      onPause: (id) => {
        agir(() => memberApi.post(`/housing/${id}/pause`, z.unknown()), 'Votre annonce est en pause.', 'L’annonce n’a pas pu être mise en pause.');
      },
      onReprendre: (id) => {
        agir(() => memberApi.post(`/housing/${id}/resume`, z.unknown()), 'Votre annonce est de nouveau en ligne.', 'L’annonce n’a pas pu être remise en ligne.');
      },
      onTrouve: (id) => {
        agir(() => memberApi.post(`/housing/${id}/taken`, z.unknown()), 'Bravo ! L’annonce est retirée des listes.', 'L’annonce n’a pas pu être marquée comme trouvée.');
      },
      onSupprimer: (id, logement) => {
        setASupprimer({ id, logement });
      },
    }),
    [agir, occupe, onglet],
  );

  const confirmer = useCallback((): void => {
    if (aSupprimer === null) return;
    const { id, logement } = aSupprimer;
    void lancer(
      () => memberApi.del(logement ? `/housing/${id}` : `/jobs/${id}`, z.unknown()),
      { recharger: false, succes: 'L’annonce est supprimée.', echecRepli: 'L’annonce n’a pas pu être supprimée.' },
    ).then((ok) => {
      if (ok) {
        setASupprimer(null);
        recharger();
      }
    });
  }, [aSupprimer, lancer, recharger]);

  const fenetres = (
    <>
      {fenetre}
      <FenetreConfirmation
        ouverte={aSupprimer !== null}
        nom="SUPPRESSION-ANNONCE"
        titre="Supprimer l’annonce"
        question="L’annonce disparaît des listes et ne pourra pas être rétablie."
        precision="Si vous avez trouvé, « Logement trouvé » la retire sans la supprimer."
        libelleConfirmer="Supprimer"
        occupe={occupe}
        onConfirmer={confirmer}
        onAnnuler={() => {
          setASupprimer(null);
        }}
      />
    </>
  );

  return { gestes, fenetres };
}
