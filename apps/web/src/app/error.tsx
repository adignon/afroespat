'use client';

import { PageErreurMembre } from '@/components/page-erreur-membre';

/**
 * L'ERREUR D'UNE PAGE — le filet de toute l'application hors administration (qui a la sienne).
 *
 * Sans lui, une exception de rendu laissait la page blanche du dispositif de Next. Les
 * données du membre n'ont pas été touchées : un rendu qui échoue n'écrit rien.
 */
export default function ErreurPage({ reset }: { readonly error: Error; readonly reset: () => void }) {
  return (
    <PageErreurMembre titre="Cette page n’a pas pu s’afficher" onReessayer={reset}>
      Un problème est survenu en préparant cet écran. Vos données n’ont pas été modifiées. Réessayez, ou revenez à l’accueil.
    </PageErreurMembre>
  );
}
