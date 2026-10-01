import type { BandeauEntraide } from '../entraide/data';

/**
 * H10 — mes réponses (`/entraide/mes-reponses`), de `GET /help/my-responses`.
 *
 * `total` et `utiles` sont comptés sur la PAGE RENDUE, et il faut le dire :
 * `GET /help/my-responses` ne porte aucun `meta.count`. Sur un membre qui a plus de
 * réponses que la page n'en rend, le sous-titre dira donc « 20 réponses » là où il
 * en a deux cents. C'est un écart REMONTÉ, pas une approximation assumée : la route
 * devrait porter son total comme `GET /me/connections` le fait.
 */
export interface H10Data extends BandeauEntraide {
  readonly mesReponses: {
    readonly total: number;
    readonly utiles: number;
  };
}
