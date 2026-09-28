/**
 * Données des écrans E01 à E04, reprises de `docs/template/07 Agenda.dc.html`.
 *
 * ET IL N'Y EN A AUCUNE, pour la même raison que l'entraide : le `renderVals()` de
 * cette maquette rend `{}` et tout son contenu est écrit en clair. Le détail du
 * constat, et pourquoi en inventer une serait pire que n'en avoir aucune, est dans
 * `apps/web/src/screens/entraide/data.ts`.
 *
 * C'est ici que les champs arriveront quand ces écrans seront branchés sur
 * `apps/api/src/modules/events` — calendrier, RSVP, liste d'attente, présence.
 */

/** Aucun champ : les cadres générés reçoivent `_props`. */
export type AgendaData = Record<string, never>;
