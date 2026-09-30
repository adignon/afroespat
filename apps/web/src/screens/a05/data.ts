/**
 * Données de l'écran A05 — l'éditeur de guide.
 *
 * ── CE CADRE N'A QUE DEUX PRISES, ET IL FAUT DIRE POURQUOI ──────────────────
 *
 * L'éditeur de la maquette dessine son brouillon dans un `<pre>` dont le contenu
 * est ÉCRIT EN DUR. Le transcodeur l'a donc reproduit tel quel dans
 * `*.generated.tsx` : ni le titre, ni le corps, ni la catégorie, ni la portée ne
 * sont des prises. Les deux seules que le cadre lit sont la barre d'outils
 * Markdown et le rappel des règles — c'est-à-dire l'habillage, pas le texte.
 *
 * Brancher l'éditeur demande donc que la maquette pose des marqueurs de données
 * sur son `<pre>` et sur ses champs, puis une régénération. C'est du transcodage,
 * pas du branchement, et un fichier `*.generated.tsx` ne se modifie pas à la main :
 * la régénération l'effacerait. Remonté au rapport de lot.
 *
 * Ce qui EST fait ici : le module d'appel (`screens/guides/api.ts`) porte déjà
 * `createDraft`, `updateGuide` et `publishGuide`, validés par les schémas de
 * `@app/shared` — de sorte que le jour où le cadre expose ses champs, il ne reste
 * qu'à les relier.
 */

// ─── LES PRISES DU CADRE, DÉCLARÉES ─────────────────────────────────────────

/**
 * La barre d'outils Markdown. Des CHAÎNES : le cadre écrit `{t}` directement.
 *
 * Elle correspond au Markdown RESTREINT de §2.1 — gras, italique, listes, liens,
 * et `H` pour les titres de niveau 2 et 3. Pas d'image : `restrictedMarkdownIssue`
 * les refuse, les guides n'ayant pas de table de médias. La barre ne propose donc
 * rien que l'API rejetterait ensuite.
 */
export const mdTools: readonly string[] = ['H', 'B', 'I', '•', '1.', 'Lien'];

/**
 * Les trois règles d'écriture, rappelées à l'endroit où l'on écrit.
 *
 * Ce ne sont pas des décorations. La première est une RÈGLE DURE (§2.1) que le
 * serveur applique avec un code d'erreur propre, `FORBIDDEN_WORD` : le mot
 * « certifié » est rejeté dans un titre, parce que la plateforme ne vérifie aucun
 * dossier administratif et qu'un guide « certifié » le laisserait croire.
 *
 * Elles restent des CHAÎNES de la maquette et non des libellés d'API : aucune
 * route ne les renvoie. Si le produit changeait une de ces règles, l'écran ne le
 * saurait pas — remonté.
 */
export const rules: readonly string[] = [
  'Pas de mot « certifié »',
  'Pas de numéro, email ou adresse personnelle',
  'Citez vos sources quand c’est possible',
];

/** Ce que les deux cadres générés de A05 consomment. */
export interface A05Data {
  mdTools: readonly string[];
  rules: readonly string[];
}
