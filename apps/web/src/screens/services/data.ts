/**
 * Données des écrans S01 à S10, reprises de `docs/template/06 Services.dc.html`.
 *
 * ET IL N'Y EN A AUCUNE — ce fichier existe pour le dire, pas pour combler un vide.
 *
 * `06 Services` n'emploie pas le dialecte des maquettes `01` et `03` : son
 * `renderVals()` est littéralement `renderVals() { return {}; }`, le fichier ne
 * contient ni `{{ … }}` ni `<sc-for>` — zéro de chacun, compté — et tout le
 * contenu est écrit en clair dans le HTML. Voir l'en-tête de
 * `apps/web/src/screens/entraide/data.ts`, qui détaille la conséquence : recopier
 * un `renderVals()` vide, c'est n'écrire aucune donnée ; en écrire une serait
 * choisir une structure que la maquette n'a pas choisie.
 *
 * Le type reste, parce que le générateur en pose un en signature de chaque cadre,
 * et parce qu'il est le point d'accroche du lot suivant : quand ces écrans seront
 * branchés sur `apps/api/src/modules/{housing,jobs,pros,alerts}`, c'est ici que
 * les champs arriveront, et le JSX transcodé n'aura pas à bouger.
 *
 * AUCUN BOUTON DE CE MODULE N'EST BRANCHÉ hors ouverture de fenêtre, et c'est
 * délibéré. Quatre d'entre eux portent une conséquence pour un tiers ou pour le
 * membre lui-même :
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
 * est moins nuisible qu'un bouton qui ment.
 */

/**
 * Aucun champ : les cadres générés reçoivent `_props`.
 *
 * `Record<string, never>` plutôt qu'un alias de `{}` : `{}` accepte n'importe
 * quelle valeur non nulle en TypeScript, y compris un nombre ou une chaîne. Un
 * type qui n'interdit rien ne dirait pas que l'écran ne consomme rien.
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
 * CE QUI DÉCIDE, C'EST LE NIVEAU DU MEMBRE — et ce lot ne branche aucune route,
 * donc il ne le connaît pas. Le bouton « Contacter » ouvre la feuille L1+, qui
 * est le cas courant ; l'état L0 est atteignable par `?niveau=l0`, qui n'affirme
 * rien et se teste. C'est exactement ce que `?paiement=` fait dans le module
 * Compte et `?etat=` dans le module Parcours, pour la même raison.
 */
export const NIVEAUX_CONTACT = ['l0'] as const;

export type NiveauContact = (typeof NIVEAUX_CONTACT)[number];

/** Le niveau demandé par l'URL, ou `null` si le paramètre est absent ou inconnu. */
export function niveauContact(valeur: string | string[] | undefined): NiveauContact | null {
  if (typeof valeur !== 'string') return null;
  return (NIVEAUX_CONTACT as readonly string[]).includes(valeur) ? (valeur as NiveauContact) : null;
}
