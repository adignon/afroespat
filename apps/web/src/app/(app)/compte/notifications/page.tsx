import { ScreenFrames } from '@/screens/frames';
import { K07Desktop } from '@/screens/k07/desktop.generated';
import { K07Mobile } from '@/screens/k07/mobile.generated';

/**
 * K07 — « Réglages des notifications » (`/compte/notifications`, T5 §9).
 *
 * Le JSX vient du TRANSCODAGE de `docs/template/08 Compte.dc.html`. Rien n'est
 * réécrit ; la page ne fait que servir les deux cadres de la maquette.
 *
 * LES INTERRUPTEURS DE LA GRILLE RESTENT DESSINÉS, et c'est délibéré. La maquette
 * les écrit en `<span>` — 46 × 26 px, pastille positionnée — sans aucun
 * gestionnaire : elle n'emploie pas le dialecte, donc elle ne donne ni état ni
 * action. Les promouvoir en `role="switch"` demanderait d'inventer, pour chacune
 * des cases de la grille, un état que la maquette ne fournit pas. C'est
 * exactement le choix qu'a fait le module Parcours pour les cases de J06 et les
 * interrupteurs de J08. Ils deviendront opérables quand l'API les alimentera.
 *
 * Ce que la planche porte et qui vient du dossier : la catégorie « Sécurité et
 * compte » est grisée et marquée « Non désactivable », les heures calmes
 * (22 h – 7 h), le résumé hebdomadaire, et l'encart « PUSH DÉSACTIVÉES » quand le
 * navigateur bloque les notifications.
 */
export default function NotificationsPage() {
  return <ScreenFrames screen="K07" desktop={<K07Desktop />} mobile={<K07Mobile />} />;
}
