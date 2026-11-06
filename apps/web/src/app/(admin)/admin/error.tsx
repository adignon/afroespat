'use client';

import { PageErreur } from '@/components/admin/page-erreur';

/** Un écran d'administration qui plante : la coque reste, la personne peut relire ou revenir au tableau de bord. */
export default function ErreurAdmin({ reset }: { readonly error: Error; readonly reset: () => void }) {
  return (
    <PageErreur
      titre="Cet écran n’a pas pu s’afficher"
      action={
        <button
          type="button"
          onClick={reset}
          className="admin-bouton"
          style={{ height: '44px', padding: '0 18px', borderRadius: '14px', border: 'none', background: '#16785E', color: '#fff', font: 'inherit', fontSize: '13.5px', fontWeight: 700, cursor: 'pointer' }}
        >
          Réessayer
        </button>
      }
    >
      Un problème est survenu en préparant cette page. Vos données n’ont pas été modifiées. Réessayez, ou revenez au tableau de bord.
    </PageErreur>
  );
}
