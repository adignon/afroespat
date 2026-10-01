import type { BandeauEntraide } from '../entraide/data';

/**
 * H09 — mes demandes (`/entraide/mes-demandes`), de `GET /help/mine`.
 *
 * `avecNouvelles` compte MES demandes dont une réponse est arrivée depuis ma
 * dernière visite. ÉCART SIGNALÉ : aucun champ de `GET /help/mine` ne dit « vue
 * depuis ». La carte de liste porte `responseCount` et `createdAt`, rien qui
 * distingue une réponse lue d'une réponse neuve. Le nombre est donc celui des
 * demandes qui ONT des réponses — ce qui est une donnée réelle de la route — et
 * l'écart est remonté plutôt que comblé par une heuristique.
 */
export interface H09Data extends BandeauEntraide {
  readonly mesDemandes: {
    readonly total: number;
    readonly avecNouvelles: number;
  };
}
