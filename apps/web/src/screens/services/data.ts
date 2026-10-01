/**
 * Données des écrans S01 à S10, et ce que la maquette `06 Services.dc.html` en dit.
 *
 * ── CE FICHIER A CHANGÉ DE NATURE, ET IL FAUT SAVOIR POURQUOI ───────────────
 *
 * Il disait, et c'était exact : « ET IL N'Y EN A AUCUNE — ce fichier existe pour
 * le dire, pas pour combler un vide ». `06 Services` n'emploie pas le dialecte des
 * maquettes `01` et `03` : son `renderVals()` rend `{}`, zéro `{{ … }}`, zéro
 * `<sc-for>`, comptés. Les vingt-cinq cadres recevaient donc `_props` — ils
 * IGNORAIENT leurs données, faute d'avoir où les mettre.
 *
 * Il annonçait aussi la suite : « quand ces écrans seront branchés sur
 * `apps/api/src/modules/{housing,jobs,pros,alerts}`, c'est ici que les champs
 * arriveront, et le JSX transcodé n'aura pas à bouger ». C'est exactement ce qui
 * vient d'arriver, et le JSX n'a PAS bougé : la prise a été DÉCLARÉE dans
 * `tools/screens/06-services.mjs`, sous la clé `donnees`, et le générateur a
 * produit des cadres qui lisent leurs propriétés.
 *
 * UNE RECTIFICATION À CET EN-TÊTE, parce qu'elle a coûté une recherche : il
 * n'existe PAS de module `apps/api/src/modules/alerts`. `GET /me/alerts` et ses
 * trois écritures vivent dans `housing.controller.ts` — §2.4 définit l'alerte avec
 * la recherche de logement, et la même table sert les deux kinds. Lire le nom du
 * dossier fait chercher une route qui n'existe pas ; c'est le CONTRÔLEUR qui dit
 * la vérité.
 *
 * ── LA RÉPARTITION, QUI EST LA MOITIÉ DU CONTRAT ────────────────────────────
 *
 * La FORME est transcodée de la maquette ; la DONNÉE et le COMPORTEMENT vivent
 * ici. Ce fichier ne porte plus que ce qui est COMMUN aux dix écrans — le bandeau
 * d'identité et le quota du mois, que les dix planches d'ordinateur dessinent à
 * l'identique. Le reste vit dans `screens/s01/data.ts` et ses nœufs voisins : UN
 * TYPE PAR ÉCRAN, jamais un type partagé par tout le module. Un type partagé
 * aurait obligé chaque écran à déclarer les champs des neuf autres, donc à les
 * rendre facultatifs, donc à n'exiger rien de personne.
 *
 * Les appels sont dans `screens/services/appels.ts`, et eux seuls touchent l'API.
 *
 * ── AUCUN BOUTON DE CE MODULE N'EST BRANCHÉ hors ouverture de fenêtre ───────
 *
 * C'est délibéré, et inchangé par l'arrivée de l'API. Quatre d'entre eux portent
 * une conséquence pour un tiers ou pour le membre lui-même :
 *
 *   · « Publier l'annonce » (S03) — 10 §2.1 : la publication passe par un score
 *     de risque calculé côté serveur, et une annonce à score ≥ 0,7 n'est jamais
 *     publiée sans décision humaine. Un `onClick` qui refermerait le formulaire
 *     ferait CROIRE au membre que son annonce est en ligne.
 *   · « Envoyer pour validation » (S08) — la fiche pro attend une validation
 *     humaine (§4.1) ; le justificatif ne part nulle part dans ce lot.
 *   · « Contacter » (S07) — consomme un des trois contacts pro du mois (§4.4),
 *     et le compteur vit côté serveur.
 *   · « Recommander » (S05) — écrit un avis sur un autre membre (§3.3).
 *
 * C'est la même règle que « Publier » dans le module Parcours : un bouton inerte
 * est moins nuisible qu'un bouton qui ment. Les puces d'action de S09
 * (« Renouveler », « Pause », « Logement trouvé », « Supprimer ») sont dans le
 * même cas : les routes existent (`POST /housing/:id/renew`, `/pause`, `/taken`,
 * `DELETE`), et les brancher demande l'écran de confirmation que la maquette ne
 * dessine pas.
 *
 * ── LE NIVEAU DE VÉRIFICATION NE SERT JAMAIS À AUTORISER ────────────────────
 *
 * Aucun `if (niveau >= 2)` n'existe dans ce module, et il n'en faut pas. On tente
 * l'action ; le serveur répond `403 LEVEL_REQUIRED` avec `requiredLevel`,
 * `currentLevel` et `labelFr` — de quoi afficher l'INVITATION que §7.3 exige, et
 * non une simple erreur. La raison est dans `lib/api/session.ts`, et elle vaut
 * d'être lue : un niveau lu une fois et gardé, c'est la faille de quinze minutes
 * du projet rejouée dans le front.
 */

/**
 * LE BANDEAU D'IDENTITÉ, sur les dix cadres d'ordinateur.
 *
 * Deux champs seulement, parce que la maquette n'en dessine que deux : l'avatar de
 * repli et le prénom de la barre haute. `08 Compte` en dessine cinq ; ce module
 * n'affiche ni le nom complet, ni le pseudo, ni le niveau.
 */
export interface Moi {
  /** Deux lettres au plus, dérivées du nom affiché de `GET /me`. */
  readonly initiales: string;
  /** Le premier mot du nom affiché. */
  readonly prenom: string;
}

/**
 * LE QUOTA DU MOIS — la carte verte « MES QUOTAS DU MOIS », dix fois dessinée.
 *
 * §4.4, RÈGLE DURE : « 3 contacts distincts par mois en gratuit », illimité en
 * Premium. Les trois champs viennent de `GET /me/subscription` et AUCUN n'est
 * recalculé ici : le serveur décide, le front affiche. Un front qui relirait
 * `users.plan` afficherait « 2 sur 3 » à un Premium illimité.
 *
 * `barre` est une LARGEUR CSS (« 66% »), parce que la maquette dessine une barre
 * de progression et que lier le seul texte laisserait une barre aux deux tiers
 * au-dessus d'un « 0 contact pro sur 3 ».
 *
 * `plafondPro` est une CHAÎNE : le plafond vaut `null` pour « illimité », et la
 * maquette écrit « sur 3 » en toutes lettres. « sur illimité » est la phrase que
 * `mySubscriptionResponseSchema` annonce déjà — « l'écran affiche illimité, jamais
 * 0 sur null ».
 */
export interface Quotas {
  readonly contactsPro: number;
  readonly plafondPro: string;
  readonly barre: string;
  /** « 1er octobre », de `usage.resetsAt` — jamais calculée par l'horloge locale. */
  readonly reinitialise: string;
}

/**
 * Les cadres qui ne consomment RIEN — les cinq planches de fenêtre.
 *
 * `Record<string, never>` plutôt qu'un alias de `{}` : `{}` accepte n'importe
 * quelle valeur non nulle en TypeScript, y compris un nombre ou une chaîne. Un
 * type qui n'interdit rien ne dirait pas que le cadre ne consomme rien.
 *
 * Les cinq sont « Présentez-vous » (deux planches), « Contacter Sarah », « Vous
 * quittez la plateforme » et « Recommander un membre » : un formulaire vide et du
 * texte de règle. Rien à lier.
 */
export type ServicesData = Record<string, never>;

/**
 * LES FENÊTRES QUE CE MODULE OUVRE.
 *
 * Le nom est celui que le transcodeur pose en `data-modal-open` sur le bouton
 * déclencheur, et que `Modal` reçoit en `name`. L'identifiant de titre est celui
 * que le transcodeur dérive de la SECTION de la maquette — d'où `s02-titre` pour
 * les DEUX fenêtres dessinées dans la section S02, et `s05-titre` pour les deux
 * de la section S05.
 *
 * DEUX FENÊTRES PARTAGENT DONC UN IDENTIFIANT, et ce n'est pas une collision :
 * `Modal` ne rend que la fenêtre ouverte (`if (!open) return null`), et l'état
 * d'un écran n'en porte qu'une à la fois. Il n'y a jamais deux `s02-titre` dans
 * le document. Le jour où deux fenêtres d'une même section devraient s'ouvrir
 * ensemble, c'est le transcodeur qu'il faudra reprendre, pas cette table.
 */
export const MODALES = {
  /** S02 — « Présentez-vous », la feuille de contact d'une annonce (état L1+). */
  S02C: { titleId: 's02-titre' },
  /** S02 — « Contacter Sarah », l'état L0 : identité à vérifier (10 §2.3). */
  S02V: { titleId: 's02-titre' },
  /** S05 — « Vous quittez la plateforme », l'interstitiel du lien externe. */
  S05L: { titleId: 's05-titre' },
  /** S05 — « Recommander un membre » (10 §3.3). */
  S05R: { titleId: 's05-titre' },
} as const;

export type NomModale = keyof typeof MODALES;

/**
 * LES DEUX ÉTATS DE « CONTACTER » UNE ANNONCE, et pourquoi ils passent par l'URL.
 *
 * 10 §2.3 : « L1 minimum pour écrire — un L0 pré-départ peut lire les annonces
 * mais doit passer par un parrain ou un accompagnant pour contacter ; l'interface
 * le dit et propose de demander un parrain. » La maquette dessine les deux, et
 * les nomme elle-même : « MOBILE · L1+ » et « MOBILE · L0 ».
 *
 * CE QUI DÉCIDE, C'EST LE NIVEAU DU MEMBRE — ET ON NE LE LIT PAS POUR DÉCIDER.
 * La règle du socle est sans exception : on tente l'action, et le serveur répond
 * `403 LEVEL_REQUIRED`. Or ce lot ne branche AUCUN bouton de contact, donc il n'y
 * a pas d'action à tenter : le bouton « Contacter » ouvre la feuille L1+, qui est
 * le cas courant, et l'état L0 reste atteignable par `?niveau=l0`, qui n'affirme
 * rien et se teste. Lire le niveau de `GET /me` pour choisir la feuille aurait
 * été précisément l'interdit — une décision d'autorisation prise dans le front.
 */
export const NIVEAUX_CONTACT = ['l0'] as const;

export type NiveauContact = (typeof NIVEAUX_CONTACT)[number];

/** Le niveau demandé par l'URL, ou `null` si le paramètre est absent ou inconnu. */
export function niveauContact(valeur: string | string[] | undefined): NiveauContact | null {
  if (typeof valeur !== 'string') return null;
  return (NIVEAUX_CONTACT as readonly string[]).includes(valeur) ? (valeur as NiveauContact) : null;
}
