'use client';

import { useCallback, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { conversationAvec, ouvrirConversation } from '@/components/ecrire';
import { FenetreEcrire } from '@/components/fenetre-ecrire';
import { notifyError } from '@/components/notifications';
import { ApiError } from '@/lib/api/index';

/**
 * S04 — « Contacter » un profil disponible (10 §3.2).
 *
 * Le bouton de chaque profil écrivait à personne. Une conversation existante est
 * rouverte ; sinon la fenêtre d'écriture demande le premier message (une
 * conversation ne naît jamais vide : 08 §5.2), puis l'écran suit vers
 * `/messages/:id`. Le niveau n'est pas lu : un `403 LEVEL_REQUIRED` du serveur
 * s'affiche avec sa phrase.
 */
export interface VivantProfils {
  readonly occupe: boolean;
  readonly onContacter: (handle: string, prenom: string) => void;
}

export const vivantProfilsVide: VivantProfils = { occupe: false, onContacter: (): void => {} };

export function useContacterMembre(): { readonly vivant: VivantProfils; readonly fenetre: ReactNode } {
  const router = useRouter();
  const [cible, setCible] = useState<{ handle: string; prenom: string } | null>(null);
  const [occupe, setOccupe] = useState(false);

  const onContacter = useCallback(
    (handle: string, prenom: string): void => {
      if (occupe) return;
      setOccupe(true);
      conversationAvec(handle)
        .then((existante) => {
          if (existante === null) setCible({ handle, prenom });
          else router.push(`/messages/${existante}`);
        })
        .catch(() => {
          setCible({ handle, prenom });
        })
        .finally(() => {
          setOccupe(false);
        });
    },
    [occupe, router],
  );

  const envoyer = useCallback(
    (message: string): void => {
      if (cible === null) return;
      setOccupe(true);
      ouvrirConversation(cible.handle, message)
        .then((id) => {
          setCible(null);
          router.push(`/messages/${id}`);
        })
        .catch((cause: unknown) => {
          notifyError(cause instanceof ApiError ? cause.displayMessage : 'Le message n’a pas pu partir.');
        })
        .finally(() => {
          setOccupe(false);
        });
    },
    [cible, router],
  );

  const fenetre = (
    <FenetreEcrire
      ouverte={cible !== null}
      prenom={cible?.prenom ?? ''}
      occupe={occupe}
      onEnvoyer={envoyer}
      onFermer={() => {
        setCible(null);
      }}
    />
  );

  return { vivant: { occupe, onContacter }, fenetre };
}
