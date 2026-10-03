import type { Moi, Quotas } from '../services/data';

/**
 * S05 — une offre d'emploi (`/services/emploi/:id · /nouveau`, 10 §3).
 *
 * Les champs viennent de `GET /jobs/:id`, que le contrôleur rend NUE — pas
 * d'enveloppe `{ items }`, pas de `meta` : c'est la même carte que la liste.
 *
 * « COMPTABLE JUNIOR » FIGURE DEUX FOIS DANS LA PLANCHE, et les deux sont liées
 * au même champ. La maquette écrit le MÊME intitulé dans le titre de l'offre et
 * dans le champ « Intitulé » du formulaire « PUBLIER UNE OFFRE », parce qu'elle
 * documente ses deux routes avec un seul exemple. Les lier ensemble garde
 * exactement ce qu'elle dessine.
 *
 * ÉCART SIGNALÉ AU PORTEUR : « 3 sur 5 ce mois-ci », le quota de mise en avant.
 * `UsageMetric` ne compte que `EVENTS_CREATED` et `PRO_CONTACTS` — il n'existe
 * aucune métrique de sponsorisation, donc aucune route ne rend ce compte.
 * `FREE_SPONSORED_JOBS_PER_MONTH` vaut bien 5 dans `@app/shared`, mais le « 3 »
 * est le compte DU MEMBRE, et il n'est nulle part.
 */
export interface S05Data {
  readonly moi: Moi;
  readonly quotas: Quotas;
  readonly offre: {
    readonly titre: string;
    readonly genre: string;
    readonly contrat: string;
    readonly secteur: string;
    readonly entreprise: string;
    /** `city.name`, ou « Télétravail » quand `city` est `null` (§3.1). */
    readonly ville: string;
    /** « il y a 3 jours », de `createdAt` — jamais une date brute. */
    readonly quand: string;
    readonly description: string;
    /** `externalUrl` — le lien que l'interstitiel « Vous quittez la plateforme » annonce. */
    readonly lien: string;
    /**
     * L'HÔTE de `externalUrl` — « arvel.fr » — que l'interstitiel nomme.
     *
     * Dérivé de `lien` par `new URL(...).hostname`, et JAMAIS écrit à part : deux
     * champs indépendants finiraient par désigner deux sites différents, et une
     * fenêtre qui annonce « vous allez sur arvel.fr » en envoyant ailleurs est
     * pire que pas de fenêtre du tout. Une URL qui ne s'analyse pas rend un tiret
     * cadratin plutôt qu'un domaine inventé.
     */
    readonly domaine: string;
  };
}
