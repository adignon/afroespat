import type { HELP_REQUEST_TYPES } from '@app/shared';

/**
 * Ce que les gestes de H02 lisent, composé par `chargerH02` depuis `GET /help/:id`.
 *
 * TOUS les drapeaux viennent du SERVEUR (`canEdit`, `canReopen`, `isAuthor`,
 * `canMarkHelpful`…) : le front éteint ou masque un bouton sur eux, il ne recalcule
 * ni les 7 jours de la réouverture ni « tant que la demande est ouverte ». Le serveur
 * refuse de toute façon.
 */
export interface ActionDemande {
  readonly id: string;
  readonly kind: 'REQUEST' | 'OFFER';
  readonly statut: 'OPEN' | 'RESOLVED' | 'ARCHIVED';
  readonly estAuteur: boolean;
  readonly peutModifier: boolean;
  readonly peutRouvrir: boolean;
  readonly titre: string;
  readonly corps: string;
  readonly type: (typeof HELP_REQUEST_TYPES)[number];
  readonly categorie: string;
  /** `AAAA-MM-JJ`, ou `''` : une demande SANS échéance existe (H04). */
  readonly echeance: string;
  readonly deParcours: boolean;
  /** Les identifiants du parcours — pour l'AUTEUR seul (le serveur les masque aux autres). */
  readonly parcours: { readonly journeyId: string; readonly stepId: string; readonly fait: boolean; readonly etape: string } | null;
  /** Le sujet du signalement de cette demande. */
  readonly signalement: { readonly type: string; readonly id: string };
  /** Une réponse marquée « ça m'a aidé » existe (sinon : « Résolu sans réponse »). */
  readonly aidant: string | null;
}

export interface ActionReponse {
  readonly id: string;
  readonly demandeId: string;
  readonly corps: string;
  readonly marquee: boolean;
  readonly peutMarquer: boolean;
  readonly estMienne: boolean;
  readonly peutModifier: boolean;
  readonly signalement: { readonly type: string; readonly id: string };
}
