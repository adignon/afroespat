import { notFound } from 'next/navigation';

/**
 * Toute adresse sous /admin qui ne correspond à aucun écran : on déclenche le « introuvable » de l'administration
 * (`../not-found.tsx`), qui reste dans la coque, au lieu de la page 404 générale du site.
 */
export default function AdminInconnu() {
  notFound();
}
