import { adminDashboardOverviewSchema, type AdminDashboardOverview } from '@app/shared';
import { staffApi } from '@/lib/api/index';

/**
 * L'ÉTAT « À TRAITER », LU UNE FOIS POUR TOUTE LA PAGE.
 *
 * Le rail (pastilles de comptage) et le tableau de bord lisent la même route, `GET /admin/dashboard/overview`.
 * Sans partage, chaque page d'administration la demandait deux fois. Ici : une requête en vol est réutilisée, et un
 * succès reste valable `DUREE_MS`. Un ÉCHEC n'est jamais gardé : « Réessayer » relit vraiment.
 */
const DUREE_MS = 30_000;

let courant: { readonly promesse: Promise<AdminDashboardOverview>; readonly a: number } | null = null;

export function lireOverview(maintenant: number = Date.now()): Promise<AdminDashboardOverview> {
  if (courant !== null && maintenant - courant.a < DUREE_MS) return courant.promesse;
  const promesse = staffApi.get('/dashboard/overview', adminDashboardOverviewSchema);
  const entree = { promesse, a: maintenant };
  courant = entree;
  promesse.catch(() => {
    if (courant === entree) courant = null;
  });
  return promesse;
}

/** Oublie la lecture gardée (après une action qui change les comptes). */
export function oublierOverview(): void {
  courant = null;
}

/** Les comptes affichés en pastille sur le rail, tirés de l'overview — jamais inventés. */
export function compteursDuRail(o: AdminDashboardOverview): Readonly<Record<'moderation' | 'alertesEquipe' | 'justificatifsPro' | 'villesAActiver', number>> {
  return {
    moderation: o.moderation.queue,
    alertesEquipe: o.alerts.unreadStaffAlerts,
    justificatifsPro: o.alerts.proPending.count,
    villesAActiver: o.alerts.citiesToActivate.count,
  };
}
