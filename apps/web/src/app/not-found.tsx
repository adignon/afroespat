import type { Metadata } from 'next';
import { PageErreurMembre } from '@/components/page-erreur-membre';

export const metadata: Metadata = { title: 'Page introuvable' };

/** 404 de toute l'application (l'administration a la sienne, `(admin)/admin/not-found.tsx`). */
export default function Introuvable() {
  return (
    <PageErreurMembre titre="Page introuvable">
      Cette page n’existe pas ou n’existe plus. Vérifiez l’adresse, ou revenez à l’accueil pour retrouver ce que vous cherchez.
    </PageErreurMembre>
  );
}
