/**
 * LES TRANSITIONS DE STATUT KYC AUTORISÉES — 01-identite.md §2.3.
 *
 * Un webhook peut arriver en retard, en double ou dans le désordre. Sans table, un `IN_REVIEW`
 * tardif dégradait un `APPROVED` (le membre retombait en L0), et un `EXPIRED` / `ABANDONED` pouvait
 * redevenir `APPROVED`. Les états finals de la tâche et du membre (`EXPIRED`, `ABANDONED`) sont
 * TERMINAUX : une nouvelle tentative ouvre une NOUVELLE ligne.
 *
 * `APPROVED → DECLINED` reste permis : retrait par le fournisseur ou rétrogradation d'équipe.
 */
export type KycStatusName =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'APPROVED'
  | 'DECLINED'
  | 'IN_REVIEW'
  | 'ABANDONED'
  | 'EXPIRED';

const ALLOWED: Readonly<Record<KycStatusName, readonly KycStatusName[]>> = {
  NOT_STARTED: ['IN_PROGRESS', 'APPROVED', 'DECLINED', 'IN_REVIEW', 'ABANDONED', 'EXPIRED'],
  IN_PROGRESS: ['APPROVED', 'DECLINED', 'IN_REVIEW', 'ABANDONED', 'EXPIRED'],
  IN_REVIEW: ['APPROVED', 'DECLINED'],
  APPROVED: ['DECLINED'],
  // Un refus peut être renversé par une revue manuelle du fournisseur (événement plus récent exigé).
  DECLINED: ['APPROVED'],
  ABANDONED: [],
  EXPIRED: [],
};

export function isKycTransitionAllowed(from: KycStatusName, to: KycStatusName): boolean {
  return ALLOWED[from].includes(to);
}

/**
 * Faut-il appliquer ce message ? Un message plus ANCIEN que la dernière décision connue est périmé,
 * quel que soit son statut. `eventAt` vient d'un horodatage SIGNÉ (voir `KycService.applyWebhook`).
 */
export function isKycEventStale(eventAt: Date | null, decidedAt: Date | null): boolean {
  if (eventAt === null || decidedAt === null) return false;
  return eventAt.getTime() < decidedAt.getTime();
}
