'use client';

import type { CSSProperties, ReactNode } from 'react';
import { notifyError, notifySuccess } from '@/components/notifications';

/**
 * AJOUT — le rond « partager » de la fiche d'annonce (S02, cadre de 390 px).
 *
 * La maquette le dessine en `<span>` sans geste. Il partage le lien de la page avec
 * le panneau natif quand le navigateur le sait (`navigator.share`), et le copie
 * sinon. Le lien est celui de la page courante : rien du membre n'y est ajouté.
 */
export function BoutonPartager({
  titre,
  style,
  children,
}: {
  readonly titre: string;
  readonly style: CSSProperties;
  readonly children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label="Partager"
      data-partager=""
      onClick={() => {
        const url = window.location.href;
        if (typeof navigator.share === 'function') {
          void navigator.share({ title: titre, url }).catch(() => {
            /* l'annulation du panneau n'est pas une erreur */
          });
          return;
        }
        void navigator.clipboard
          .writeText(url)
          .then(() => {
            notifySuccess('Lien copié.');
          })
          .catch(() => {
            notifyError('Le lien n’a pas pu être copié.');
          });
      }}
      style={style}
    >
      {children}
    </button>
  );
}
