import { PageErreur } from '@/components/admin/page-erreur';

/** Une page d'administration qui n'existe pas (ou un dossier qui a disparu). */
export default function AdminIntrouvable() {
  return (
    <PageErreur titre="Page introuvable">
      Cette page d’administration n’existe pas ou n’existe plus. Utilisez le menu à gauche pour retrouver ce que vous cherchez.
    </PageErreur>
  );
}
