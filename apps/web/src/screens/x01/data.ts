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
 *   3. ✅ COMBLÉ — L'IDENTIFIANT D'UNE SUGGESTION. `GET /search/suggest` ne rendait
 *      que `{ title, subjectType }` : choisir une suggestion ne pouvait que
 *      relancer la recherche sur son texte. La route rend maintenant `subjectId`
 *      et `url`, et `GET /search` rend `url` par résultat — les deux composées par
 *      le serveur, parce que quatre des neuf types ne s'ouvrent pas par leur
 *      identifiant. Suggestions et cartes sont des liens.
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
  /**
   * OÙ ELLE MÈNE — et c'est nouveau.
   *
   * Le porteur : « les propositions sous l'input doivent s'afficher et permettre
   * d'ALLER DIRECTEMENT sur un élément ». `GET /search/suggest` ne rendait qu'un
   * titre et un type : il n'y avait rien à quoi accrocher un lien, et c'était
   * consigné ici comme un manque. La réponse porte maintenant `subjectId` et
   * `url`, composée par le serveur — quatre des neuf types ne s'ouvrent pas par
   * leur identifiant.
   *
   * Jamais vide : quand le serveur rend `url: null` — la source a disparu entre
   * l'indexation et la frappe — on retombe sur la page de résultats pour ce titre,
   * ce qui est encore un endroit vrai.
   */
  readonly vers: string;
}

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ UN FILTRE DE LA COLONNE DE GAUCHE — ET IL A CHANGÉ DE PLACE               ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « Lorsqu'on est sur la page du search, il faut que la left side bar
 * contienne PLUTÔT les filtres (guide, actualité, événement, etc.) avec le nombre
 * matché dans ces catégories. »
 *
 * « Plutôt » : les filtres ÉTAIENT une rangée de pastilles au-dessus des
 * résultats, et la colonne de gauche portait le menu « ACCUEIL » de la maquette —
 * six entrées mortes, qui n'avaient rien à faire sur une page de recherche. Les
 * deux ont échangé : la colonne porte les filtres, la rangée de pastilles est
 * retirée, et le menu de section revient au SURVOL DU RAIL (`components/rail/`),
 * qui est l'autre moitié de la même demande.
 *
 * ET CE SONT DE VRAIS FILTRES, pas des étiquettes : chacun est un lien vers
 * `/recherche?q=…&type=…`, et `GET /search?type=` rend alors la forme PLATE et
 * paginée du module. Une pastille qui affiche un compte sans pouvoir filtrer
 * dessus est un chiffre, pas un filtre.
 *
 *
 * Le porteur : « La recherche ne marche pas bien. Regarde l'URL, est-ce qui est
 * sur la page ? » MESURÉ sur `/recherche?q=simple` : la page affichait « Tout ·
 * 24 », « Guides · 5 » et quatre cartes sur Visale — les valeurs de la maquette.
 * `chargerX01` DEMANDAIT pourtant `GET /search?q=…` et JETAIT la réponse.
 *
 * ── LES LIBELLÉS RESTENT CEUX DE LA MAQUETTE ──────────────────────────────
 *
 * Le serveur écrit « Sujets de réseau » et « Professionnels » là où la planche
 * écrit « Sujets » et « Pros ». Prendre ceux du serveur changerait le texte
 * affiché, ce qui est une décision de produit et pas de transcodage. On lie donc
 * les COMPTEURS — qui mentaient — et on garde les mots dessinés, en les associant
 * par le TYPE. Un type que la planche ne dessine pas n'apparaît pas ; c'est
 * consigné, comme « Villes » qui n'a pas de compteur dessiné.
 */
export interface FiltreRecherche {
  /** Le mot du type, au pluriel — « Guides », « Événements ». */
  readonly libelle: string;
  /** Le nombre de résultats de ce type, de `items[].count`. */
  readonly compte: number;
  /** `/recherche?q=…&type=GUIDE`, ou `/recherche?q=…` pour « Tout ». */
  readonly href: string;
  readonly active: boolean;
  /** Le glyphe du type — quatre dessinés, cinq de Feather. Voir `lib/recherche/types`. */
  readonly trace: string;
  /** L'apparence d'une LIGNE de colonne — ce que la planche peint pour une entrée. */
  readonly fond: string;
  /**
   * L'ENCRE DIT AUSSI « IL N'Y A RIEN ICI ».
   *
   * Le porteur, devant dix filtres à zéro : « on peut pas cliquer ? » Non — un
   * filtre sans résultat mène à une page vide, donc il n'est pas un lien. Mais
   * rien ne le disait : il était peint exactement comme ses voisins. Il prend
   * maintenant le gris atténué que la planche emploie partout pour un texte
   * secondaire (`#8A958F`), et le geste manquant se voit avant d'être tenté.
   */
  readonly encre: string;
  readonly poids: string;
  /**
   * ── ET L'APPARENCE D'UNE PASTILLE, POUR LE CADRE MOBILE ─────────────────
   *
   * Le téléphone n'a PAS de colonne de gauche : la planche y dessine une rangée
   * de pastilles qui défile. Ce sont les mêmes filtres, dans une autre forme, et
   * les deux formes n'ont pas la même grammaire de couleur — la ligne de colonne
   * est un fond vert pâle sans bordure, la pastille est un fond vert PLEIN avec
   * bordure. Réemployer les trois mêmes valeurs peindrait une pastille blanche sur
   * blanc pour le filtre retenu.
   *
   * MESURÉ : le cadre mobile affichait encore « Tout · 24 », « Guides · 5 »,
   * « Sujets · 7 », « Entraide · 4 » — les quatre exemples de la maquette, en dur.
   * La correction de la colonne ne l'avait pas touché, parce que son conteneur n'a
   * rien à voir avec celui de l'ordinateur.
   */
  readonly piluleFond: string;
  readonly piluleEncre: string;
  readonly piluleBordure: string;
}

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ UN RÉSULTAT — ET CE QUE L'API N'EN DIT PAS                                ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * `SearchHit` porte `title`, `excerpt`, `rank`, `updatedAt` et trois identifiants
 * que `GET /search` ne résout pas en noms.
 *
 * La maquette, elle, dessine sous chaque titre une ligne qui N'EXISTE PAS côté
 * serveur : « Mis à jour le 12 mars · 84 utiles », « Béninois en France ·
 * 14 réponses », « Ouverte · Lyon 7e », « 620 € ». Aucun compteur d'utiles, aucun
 * nombre de réponses, aucun état, aucun loyer.
 *
 * On affiche donc `excerpt` — l'extrait que le serveur rend VRAIMENT — plutôt que
 * d'inventer ces lignes ou de les laisser dessinées, ce qui ferait croire que la
 * carte parle du résultat alors qu'elle parlerait d'un exemple. L'écart est
 * REMONTÉ : ces quatre sous-lignes demandent des champs que l'API ne sert pas.
 */
export interface ResultatRecherche {
  readonly id: string;
  readonly pastille: string;
  readonly titre: string;
  readonly extrait: string;
  /** Le tracé de l'icône, choisi sur le type. Voir `lib/recherche/types`. */
  readonly trace: string;
  /**
   * OÙ LA CARTE MÈNE, ou `null`.
   *
   * La carte dessine un chevron depuis le début : elle PROMETTAIT d'ouvrir quelque
   * chose, et n'ouvrait rien. `GET /search` rend maintenant `url` par résultat,
   * composée côté serveur. `null` quand la source a disparu entre l'indexation et
   * la lecture : la carte reste alors affichée et N'EST PAS cliquable, ce qui est
   * préférable à un lien vers une page absente.
   */
  readonly url: string | null;
  /** Le fait écrit sous le titre — « 84 utiles », « 620 € · Lyon » (serveur). */
  readonly sousLigne?: string | null;
}

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ L'ÉTAT VIDE — LA PAGE NE DISAIT RIEN QUAND ELLE NE TROUVAIT RIEN          ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur, capture à l'appui sur `/recherche?q=siple` : « ça ne met pas qu'il
 * n'a rien trouvé ». MESURÉ : dix filtres à zéro, aucune carte, et AUCUNE phrase.
 * Une page blanche sous un titre — on ne sait pas si la recherche a échoué, si
 * elle tourne encore, ou s'il n'y a vraiment rien.
 *
 * Et c'était consigné comme non fait : « l'état vide est dessiné par la maquette en
 * COMPOSANT, dans une carte "ÉTATS" posée à côté des planches, sans écran autour.
 * Il n'est donc pas monté ici ». C'était une raison de ne pas DEVINER où le mettre,
 * pas une raison de laisser la page muette — la carte est dessinée, à l'octet près,
 * et elle est maintenant montée là où les résultats auraient été.
 *
 * ── LES MOTS VIENNENT DU SERVEUR QUAND IL A PARLÉ ─────────────────────────
 *
 * §2.4 : `meta.zeroResult` porte `prompt`, `cta` et `helpTitle`. Le serveur ne les
 * rend QUE si la requête porte des termes utiles — « de la » ne dit rien d'un
 * contenu manquant, et l'enregistrer polluerait la revue hebdomadaire. Quand il se
 * tait, la carte garde son titre dessiné et perd son bouton : on ne propose pas de
 * poser une question dont on ne sait pas l'intitulé.
 *
 * ── ET QUAND LA REQUÊTE EST TROP COURTE ───────────────────────────────────
 *
 * Le porteur, seconde capture : « La recherche n'affiche rien avec "s" ? » C'est
 * un défaut ET une limite. Le défaut : le chargeur attendait TROIS caractères
 * avant d'appeler `GET /search`, alors que c'est le seuil des SUGGESTIONS
 * (`SUGGEST_MIN_QUERY_LENGTH`, §2.3) ; la recherche, elle, en demande DEUX
 * (`SEARCH_MIN_QUERY_LENGTH`). Une requête de deux lettres était donc jetée sans
 * raison. La limite : à UNE lettre, le serveur refuse — et il doit refuser, un
 * `%s%` sur `search_documents` balaierait l'index entier.
 *
 * ⚠ LA PHRASE DE CE CAS EST ÉCRITE, PAS DESSINÉE. La maquette ne prévoit aucun
 * état « requête trop courte » ; la carte « VIDE » est le seul état qu'elle
 * dessine. Je compose donc une phrase à partir de la borne PARTAGÉE, pour que la
 * page dise pourquoi elle ne cherche pas au lieu de rester blanche. C'est un texte
 * de produit ajouté sans maquette, et il est REMONTÉ.
 */
export interface EtatVideRecherche {
  /** « Aucun résultat » — le titre que la planche dessine. */
  readonly titre: string;
  /** La seconde ligne : la proposition du serveur, ou la raison du refus. */
  readonly invite: string;
  /** Le libellé du bouton, ou vide — il n'y a alors rien à proposer. */
  readonly bouton: string;
  readonly href: string;
}

/** X01 — ses deux cadres. */
/**
 * Les filtres de la recherche, tels que l'URL les porte (voir `./filtres.ts`).
 * `periode` et `etat` reprennent les valeurs du serveur (`SEARCH_PERIODS`,
 * `SEARCH_STATES`).
 */
export interface ValeursFiltresRecherche {
  readonly ville: string | null;
  readonly rayon: number | null;
  readonly pays: string | null;
  readonly periode: string;
  readonly etat: string | null;
}

export interface X01Data {
  readonly moi: BarreHaute;
  /** La requête, de `meta.q` — le serveur la rend telle qu'il l'a reçue. */
  readonly requete: string;
  readonly suggestions: readonly SuggestionRecherche[];
  readonly filtres: readonly FiltreRecherche[];
  readonly resultats: readonly ResultatRecherche[];
  /** L'état vide, ou `null` quand il y a des résultats à montrer. */
  readonly vide: EtatVideRecherche | null;
  /** Les filtres posés (ville, rayon, pays, période, état) et le type retenu. */
  readonly filtresAvances?: ValeursFiltresRecherche;
  readonly typeActif?: string | null;
}
