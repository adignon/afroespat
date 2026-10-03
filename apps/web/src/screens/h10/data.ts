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
/**
 * Une de mes réponses, telle que la PLANCHE MOBILE la dessine.
 *
 * `marquee` et `attente` sont les DEUX ÉTATS que la maquette dessine, chacun en
 * entier sous son `<sc-if>` : la pastille pleine et son bandeau de bilan d'un
 * côté, la pastille grise de l'autre. Deux champs et non un booléen nié, pour la
 * même raison que `LigneTelephone` de K04 — le cadre porte deux variantes, chacune
 * avec SA condition, et c'est `markedHelpful` qui les tranche côté serveur.
 *
 * `prenom` est celui de l'AUTEUR DE LA DEMANDE, pas le mien : la planche écrit
 * « Kofi vous a marquée … » et « Écrire à Kofi ».
 *
 * ÉCART SIGNALÉ : la phrase du bandeau est GENRÉE au féminin par la maquette
 * (« marquée »), et aucun champ de l'API ne porte le genre. Seul le prénom est une
 * donnée ; la phrase reste celle de la planche, comme les phases de H01.
 */
export interface MaReponse {
  readonly categorie: string;
  readonly age: string;
  readonly auteur: string;
  readonly titre: string;
  readonly corps: string;
  readonly prenom: string;
  readonly marquee: boolean;
  readonly attente: boolean;
}

export interface H10Data extends BandeauEntraide {
  readonly mesReponses: {
    readonly total: number;
    readonly utiles: number;
    readonly liste: readonly MaReponse[];
  };
}
