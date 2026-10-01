import type { BarreHaute } from '../messages/data';

/**
 * Données de X01 — la recherche (`/recherche`, 11 §4).
 *
 * La FORME vient du transcodage ; la DONNÉE et les appels vivent ici et dans
 * `screens/messages/appels.ts`. Le JSX transcodé n'a pas bougé.
 *
 * ── DEUX ROUTES, ET DEUX FORMES POUR L'UNE D'ELLES ──────────────────────────
 *
 * `GET /search` rend DEUX formes, et c'est le paramètre `type` qui décide : sans
 * lui la recherche est GROUPÉE (`items` est une liste de groupes, chacun portant
 * son type, son libellé, son compteur et jusqu'à trois résultats) ; avec lui elle
 * est plate et paginée. La planche d'ordinateur dessine l'onglet « Tout », donc la
 * forme groupée — c'est `groupedSearchResponseSchema` qui la valide, et il est
 * distinct de `typedSearchResponseSchema` exprès : un schéma permissif laisserait
 * croire qu'on peut lire `items[].title` sur les deux, alors qu'en groupé ce chemin
 * donne le titre d'un GROUPE, c'est-à-dire `undefined`.
 *
 * `GET /search/suggest` a une enveloppe À PART : `{ items }`, sans `nextCursor` ni
 * `meta`. Lu sur le contrôleur. Lui appliquer `pageSchema` ferait échouer tous les
 * appels, `nextCursor` y étant requis.
 *
 * ── CE QUE LA MAQUETTE DESSINE ET QUE L'API NE DIT PAS ──────────────────────
 *
 * Trois manques, signalés au porteur plutôt que comblés :
 *
 *   1. LES SOUS-LIGNES DES CARTES DE RÉSULTAT — « Mis à jour le 12 mars ·
 *      84 utiles », « Béninois en France · 14 réponses », « Ouverte · Lyon 7e »,
 *      « 620 € ». `SearchHit` porte `title`, `excerpt`, `cityId`, `countryId`,
 *      `communityId`, `rank` et `updatedAt` : ni compteur d'utiles, ni nombre de
 *      réponses, ni état, ni loyer, et ses trois identifiants sont des UUID que
 *      `GET /search` ne résout pas en noms. Les quatre cartes sont de surcroît
 *      dessinées différemment l'une de l'autre, donc une fabrique unique ne les
 *      reproduirait pas. Elles restent dessinées, et c'est consigné ;
 *   2. LES LIBELLÉS DES FACETTES — la maquette écrit « Sujets » et « Pros » là où
 *      `SEARCH_TYPE_LABELS_FR`, dont le serveur remplit `label`, écrit « Sujets de
 *      réseau » et « Professionnels ». Lier changerait le texte affiché : c'est une
 *      décision de produit. La maquette dessine en outre « Villes » SANS compteur,
 *      ce qu'un gabarit unique ne reproduit pas. Les compteurs, eux, existent bien
 *      (`items[].count`), et leur somme vaut exactement le « Tout · 24 » dessiné ;
 *   3. L'IDENTIFIANT D'UNE SUGGESTION — `GET /search/suggest` rend `{ title,
 *      subjectType }` et rien d'autre. Choisir une suggestion ne peut donc que
 *      relancer la recherche sur son texte, jamais ouvrir le contenu visé.
 *
 * ⚠ ET LE CADRE MOBILE N'A TOUJOURS PAS DE TITRE. La maquette n'y écrit que la
 * requête, dans le champ de recherche. La lier remplace une valeur de champ par une
 * autre ; la PROMOUVOIR en `<h1>` resterait un titre inventé — ce qui a coûté A01.
 * Le générateur signale l'absence à chaque exécution.
 */

/**
 * Une suggestion, découpée comme la maquette la dessine.
 *
 * `prefixe` est la part déjà saisie, que la maquette met en gras (11 §2.3,
 * « suggestions dès 3 caractères ») ; `suite` est le reste. Le découpage se fait
 * ici, sur la longueur de la requête — c'est le surlignage que la maquette dessine,
 * pas une donnée que l'API enverrait.
 */
export interface SuggestionRecherche {
  readonly prefixe: string;
  readonly suite: string;
}

/** X01 — ses deux cadres. */
export interface X01Data {
  readonly moi: BarreHaute;
  /** La requête, de `meta.q` — le serveur la rend telle qu'il l'a reçue. */
  readonly requete: string;
  readonly suggestions: readonly SuggestionRecherche[];
}
