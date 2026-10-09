'use client';

import { DonneesEcran } from './donnees-ecran';

/**
 * K08 — « Mes données » (`/compte/donnees`, 01 §5).
 *
 * Trois blocs, transcodés de `docs/template/08 Compte.dc.html` : télécharger ses
 * données, désactiver son compte (réversible six mois), le supprimer (définitif
 * après sept jours). Le troisième ouvre la fenêtre de confirmation.
 */
export default function DonneesPage() {
  return <DonneesEcran />;
}
