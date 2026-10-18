'use client';

import { useCallback, useState, type ReactNode } from 'react';
import type { Capability } from '@app/shared';
import { FenetreNiveau } from '@/components/fenetre-niveau';
import { notifyError, notifySuccess } from '@/components/notifications';
import { ApiError, ApiFailure } from '@/lib/api/index';
import { rechargerEntraide } from '@/lib/entraide-recharge';

/**
 * AJOUT — le geste d'écriture de l'entraide et du parrainage, en un seul endroit.
 *
 * Tous les boutons de ces deux modules font la même chose autour de leur appel :
 * empêcher le double clic, montrer le refus du serveur avec sa phrase française,
 * ouvrir la fenêtre de niveau sur un `403 LEVEL_REQUIRED` (le front prévient, il
 * n'autorise pas — AMORCAGE §5), et relire l'écran au succès. Le répéter dans
 * quinze composants donnerait quinze façons de se tromper sur le `429`.
 *
 * `fenetre` doit être RENDU par le composant qui appelle `useGeste` : c'est la
 * fenêtre d'explication du niveau, et elle n'a de sens que posée par-dessus la page.
 */
export function useGeste(): {
  readonly occupe: boolean;
  readonly fenetre: ReactNode;
  readonly lancer: (
    appel: () => Promise<unknown>,
    options?: { readonly succes?: string; readonly echecRepli?: string; readonly recharger?: boolean },
  ) => Promise<boolean>;
} {
  const [occupe, setOccupe] = useState(false);
  const [capacite, setCapacite] = useState<Capability | null>(null);

  const lancer = useCallback(
    async (
      appel: () => Promise<unknown>,
      options: { readonly succes?: string; readonly echecRepli?: string; readonly recharger?: boolean } = {},
    ): Promise<boolean> => {
      setOccupe(true);
      try {
        await appel();
        if (options.succes !== undefined) notifySuccess(options.succes);
        if (options.recharger !== false) rechargerEntraide();
        return true;
      } catch (cause: unknown) {
        const capaciteRefusee =
          cause instanceof ApiError && cause.code === 'LEVEL_REQUIRED'
            ? cause.details['capability']
            : undefined;
        if (typeof capaciteRefusee === 'string') {
          setCapacite(capaciteRefusee as Capability);
        } else {
          notifyError(
            cause instanceof ApiFailure
              ? cause.displayMessage
              : (options.echecRepli ?? 'Cette action n’a pas pu aboutir. Réessayez dans un instant.'),
          );
        }
        return false;
      } finally {
        setOccupe(false);
      }
    },
    [],
  );

  return {
    occupe,
    lancer,
    fenetre: (
      <FenetreNiveau
        capacite={capacite}
        onFermer={() => {
          setCapacite(null);
        }}
      />
    ),
  };
}
