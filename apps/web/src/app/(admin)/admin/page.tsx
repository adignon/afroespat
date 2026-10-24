import { ScreenFrames } from '@/screens/frames';
import { D02Desktop } from '@/screens/d02/desktop.generated';

/**
 * D02 — le tableau de bord d'équipe. `/admin` (15 §5.1, T5 D02).
 *
 * Le châssis (rail, barre haute) est celui de la planche transcodée ; la zone de contenu
 * est le composant `ContenuTableauDeBord`, posé par l'adaptation `ADMIN_CONTENU`
 * (`tools/adaptations/administration-vivante.mjs`). Il lit DEUX routes ouvertes aux quatre
 * rôles — `GET /admin/dashboard` et `GET /admin/dashboard/overview` : instantanés, alertes,
 * indicateur clé (objectif, écart en points, courbe, villes), file et SLA de modération,
 * parrainage, événements du mois, réseaux. La session d'équipe est gardée par
 * `(admin)/layout.tsx` ; le composant est client parce que le cookie `dp_staff` est
 * `HttpOnly` / `SameSite=Strict` et que seul le navigateur le joint.
 *
 * UNE MESURE ABSENTE EST « — » ET « PAS ENCORE DE MESURE », jamais un nombre inventé ; les
 * revenus restent à « — » (le paiement est hors périmètre).
 *
 * CETTE PAGE N'A PAS DE `<h1>`, et c'est la maquette qui en décide : le seul endroit où
 * « Tableau de bord » est écrit dans ce cadre, c'est l'entrée ACTIVE du menu latéral.
 * Promouvoir un élément de `<nav>` en titre de page dirait que la page parle de son menu.
 */
export default function Page() {
  return <ScreenFrames screen="D02" desktop={<D02Desktop />} />;
}
