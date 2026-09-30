/**
 * Les fenêtres de la messagerie, et la lecture du paramètre `?feuille=`.
 *
 * CE FICHIER N'EST PAS UN MODULE CLIENT, et c'est la raison de son existence.
 *
 * `feuilleDemandee` est appelée par `app/(app)/messages/[id]/page.tsx`, qui est un
 * composant SERVEUR. Déclarée dans `ecran.tsx` — qui porte `'use client'` — elle
 * n'arrivait pas au serveur comme une fonction mais comme une RÉFÉRENCE client :
 * l'appeler pendant le rendu jetait, et la route répondait 500. Le symptôme ne
 * nommait pas la cause — on voyait « aucune boîte de dialogue » sur des tests qui
 * ne parlent pas de rendu serveur.
 *
 * Tout ce qui doit traverser la frontière vit donc ici, et `ecran.tsx` l'importe.
 */

/** Les trois fenêtres que les routes de messagerie savent ouvrir. */
export type FeuilleMessages = 'menu' | 'signaler' | 'merci';

/**
 * L'`id` du titre que chaque fenêtre donne à `aria-labelledby`.
 *
 * Les deux feuilles X03 portent LE MÊME : le générateur le dérive de la SECTION de
 * la maquette (`x03-titre`), et les deux planches sont dessinées dans la section
 * X03. Le menu vient de M01, donc `m01-titre`. Deux fenêtres ne sont jamais
 * ouvertes en même temps — `Modal` ne rend rien quand elle est fermée — donc chaque
 * identifiant reste unique dans le document, ce qu'`aria-labelledby` exige.
 */
export const TITRES_DE_FEUILLE: Readonly<Record<FeuilleMessages, string>> = {
  menu: 'm01-titre',
  signaler: 'x03-titre',
  merci: 'x03-titre',
};

/**
 * La valeur du paramètre `?feuille=` — ou `null`.
 *
 * Une valeur inconnue est IGNORÉE plutôt qu'affichée : l'URL est publique, et une
 * valeur fantaisiste ne doit pas casser la page.
 */
export function feuilleDemandee(valeur: string | string[] | undefined): FeuilleMessages | null {
  if (typeof valeur !== 'string') return null;
  return valeur in TITRES_DE_FEUILLE ? (valeur as FeuilleMessages) : null;
}
