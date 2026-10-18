import type { BandeauEntraide } from '../entraide/data';

/**
 * H06 — la fiche d'un parrain (`/parrainage/:handle`), de `GET /mentors/:handle`.
 *
 * `dispo` porte le LIBELLÉ et SES DEUX COULEURS, relevées sur la planche
 * (`#E3F0EB` sur `#0F5C48`). Lier le seul libellé laisserait « Complet » sur le
 * vert de « Disponible », ce qui serait pire que de ne rien lier : la couleur dit
 * la même chose que le mot, et elle dirait le contraire.
 *
 * RÈGLE DURE (08 §3.2) : AUCUN compteur de contacts. La fiche porte les
 * parrainages menés et la note moyenne — ce que §2.2 demande pour trier — et RIEN
 * sur le réseau du parrain. `mentorCardResponseSchema` est `.strict()`, donc un
 * `connectionCount` ajouté côté serveur serait refusé et non dépouillé.
 */
export interface PastilleDispo {
  readonly libelle: string;
  readonly fond: string;
  readonly texte: string;
}

export interface EvaluationVisible {
  readonly commentaire: string;
  readonly auteur: string;
}

export interface H06Data extends BandeauEntraide {
  readonly parrain: {
    readonly handle: string;
    /** Le sujet du signalement (`USER`) : « Si on vous demande de l'argent, signalez ». */
    readonly signalement: { readonly type: string; readonly id: string };
    readonly complet: boolean;
    /** Les NOMS des types de parcours que le parrain connaît (`journeyTemplateIds` résolus). */
    readonly types: readonly string[];
    readonly nom: string;
    readonly initiales: string;
    readonly dispo: PastilleDispo;
    /**
     * La ligne « Installée depuis 2019 · Lyon 7e · Bénin » de la maquette, en UN
     * seul champ : `card()` ne rend ni l'année d'arrivée, ni le pays d'origine, ni
     * la phase. Écart signalé — la ligne porte ce que la fiche envoie.
     */
    readonly situation: string;
    readonly bio: string;
    readonly menes: number;
    /** `avgRating`, en virgule française. « — » quand le parrain n'a aucune note. */
    readonly note: string;
    /**
     * « parraine » / « parrain ». GENRÉ par la maquette, et aucun champ de l'API ne
     * porte le genre : c'est une donnée pour que l'écart soit VISIBLE plutôt que
     * deviné d'après un prénom.
     */
    readonly appellation: string;
  };
  readonly evaluations: readonly EvaluationVisible[];
}
