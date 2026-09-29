/**
 * Données des écrans K01 à K10, reprises de `docs/template/08 Compte.dc.html`.
 *
 * ET IL N'Y EN A AUCUNE — ce fichier existe pour le dire, pas pour combler un vide.
 *
 * `08 Compte` ne emploie pas le dialecte des maquettes `01` et `03` : son
 * `renderVals()` est littéralement `renderVals() { return {}; }`, le fichier ne
 * contient ni `{{ … }}` ni `<sc-for>` — zéro de chacun, compté — et tout le
 * contenu est écrit en clair dans le HTML. Voir l'en-tête de
 * `apps/web/src/screens/entraide/data.ts`, qui détaille la conséquence.
 *
 * Le type reste, parce que le générateur en pose un en signature de chaque cadre,
 * et parce qu'il est le point d'accroche du lot suivant : quand ces écrans seront
 * branchés sur `apps/api/src/modules/{users,auth,kyc,consents,blocks,billing}`,
 * c'est ici que les champs arriveront, et le JSX transcodé n'aura pas à bouger.
 *
 * AUCUN BOUTON DE CE MODULE N'EST BRANCHÉ, et c'est délibéré. Trois d'entre eux
 * portent une conséquence irréversible ou financière :
 *
 *   · « Confirmer la suppression » (K08) — 01 §5 : suppression définitive après
 *     7 jours, confirmée par un code SMS. Un `onClick` qui refermerait la fenêtre
 *     ferait CROIRE au membre que son compte est supprimé.
 *   · « Payer 2 600 F » (K06) — 14 §4.2 : le paiement part chez l'agrégateur, et
 *     rien ne part ici. Faire avancer la fenêtre au volet « attente » annoncerait
 *     un paiement qui n'a pas été demandé.
 *   · « Envoyer la demande » (K02) — une demande de contact est un message à un
 *     autre membre.
 *
 * C'est la même règle que « Publier » dans le module Parcours : un bouton inerte
 * est moins nuisible qu'un bouton qui ment. Les volets de K06 restent atteignables
 * par l'URL, qui n'affirme rien.
 */

/**
 * Aucun champ : les cadres générés reçoivent `_props`.
 *
 * `Record<string, never>` plutôt qu'un alias de `{}` : `{}` accepte n'importe
 * quelle valeur non nulle en TypeScript, y compris un nombre ou une chaîne. Un
 * type qui n'interdit rien ne dirait pas que l'écran ne consomme rien.
 */
export type CompteData = Record<string, never>;

/**
 * LES FENÊTRES QUE CE MODULE OUVRE.
 *
 * Le nom est celui que le transcodeur pose en `data-modal-open` sur le bouton
 * déclencheur, et que `Modal` reçoit en `name`. L'identifiant de titre est celui
 * que le transcodeur dérive de la SECTION de la maquette — `k02-titre` pour la
 * fenêtre d'ajout aux contacts, parce qu'elle est dessinée dans la section K02.
 */
export const MODALES = {
  /** K02 — « Ajouter Fatou aux contacts », avec le motif (T5 K02). */
  K02C: { titleId: 'k02-titre' },
  /** K06 — « Payer avec Mobile Money », trois volets (14 §4.2). */
  K06M: { titleId: 'k06-titre' },
  /** K08 — « Supprimer mon compte », la confirmation détaillée (T5 K08). */
  K08S: { titleId: 'k08-titre' },
} as const;

export type NomModale = keyof typeof MODALES;

/**
 * LES TROIS VOLETS DU PAIEMENT MOBILE MONEY, et pourquoi ils passent par l'URL.
 *
 * 14 §4.2 : « choix du plan → saisie du numéro → notification USSD/push de
 * l'opérateur → webhook de confirmation → activation. Timeout 5 minutes ». Les
 * deux derniers volets n'ont AUCUN contrôle dans la maquette : « attente » est un
 * sablier, « succès » une confirmation. Ce qui les fait avancer, c'est le réseau —
 * et ce lot ne branche aucune route.
 *
 * Le paramètre d'URL les rend atteignables sans rien affirmer, exactement comme
 * `?etat=` le fait dans le module Parcours pour les états dont la maquette ne
 * dessine pas le contrôle. Il n'ajoute aucun pixel et se teste.
 *
 * L'ordre est celui de la maquette — « Étape 1 sur 3 », « 2 · ATTENTE »,
 * « 3 · SUCCÈS » — et l'index sert aussi de `phase` à `Modal` : la feuille AVANCE
 * d'un cran au lieu de se rouvrir.
 */
export const VOLETS_PAIEMENT = ['numero', 'attente', 'succes'] as const;

export type VoletPaiement = (typeof VOLETS_PAIEMENT)[number];

/** Le volet demandé par l'URL, ou `null` si le paramètre est absent ou inconnu. */
export function voletPaiement(valeur: string | string[] | undefined): VoletPaiement | null {
  if (typeof valeur !== 'string') return null;
  return (VOLETS_PAIEMENT as readonly string[]).includes(valeur) ? (valeur as VoletPaiement) : null;
}
