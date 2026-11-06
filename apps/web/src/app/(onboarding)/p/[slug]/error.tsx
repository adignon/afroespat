'use client';

import { PageErreurMembre } from '@/components/page-erreur-membre';

/**
 * UNE PAGE PUBLIQUE QUE L'API N'A PAS PU SERVIR (5xx, coupure).
 *
 * `page.tsx` lève sur une réponse non-404 : plutôt que la page d'erreur de Next, un état
 * clair qui propose de réessayer. Un 404, lui, a son propre traitement (`notFound()`).
 */
export default function ErreurPagePublique({ reset }: { readonly error: Error; readonly reset: () => void }) {
  return (
    <PageErreurMembre titre="Cette page est momentanément indisponible" onReessayer={reset}>
      Nous n’avons pas pu la charger pour l’instant. Réessayez dans un instant.
    </PageErreurMembre>
  );
}
