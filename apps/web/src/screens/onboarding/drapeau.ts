/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LE DRAPEAU D'UN PAYS, DÉRIVÉ DE SON CODE — AUCUN ACTIF, AUCUNE LISTE       ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « qui montre tous les pays de l'Afrique avec leur drapeau
 * correctement ». La maquette, elle, n'en dessine QU'UN : un dégradé CSS
 * `linear-gradient(90deg,#16785E 33%,#F2C94C 33% 66%,#E0733A 66%)` — les trois
 * bandes du Bénin, et c'est pourquoi `data.ts` porte `DRAWN_COUNTRY = 'BJ'` et
 * MASQUE la pastille dès qu'on choisit autre chose. Un drapeau béninois à côté
 * du Sénégal serait pire que pas de drapeau.
 *
 * ── POURQUOI UNE DÉRIVATION, ET PAS CINQUANTE-QUATRE IMAGES ────────────────
 *
 * Unicode réserve `U+1F1E6`–`U+1F1FF` aux vingt-six « indicateurs régionaux ».
 * Deux d'affilée forment un drapeau : `BJ` → `🇧🇯`. La correspondance est
 * EXACTEMENT celle de l'ISO 3166-1 alpha-2, qui est déjà la clé du référentiel
 * (`Country.iso2`). Il n'y a donc ni table à écrire, ni actif à téléverser, ni
 * pays à oublier : tout code valide rend son drapeau, et un pays ajouté en base
 * demain aura le sien sans qu'on touche à ce fichier.
 *
 * ── CE QUE ÇA NE RÈGLE PAS, ET IL FAUT LE DIRE ─────────────────────────────
 *
 * Le rendu dépend de la police du système. macOS, iOS et Android dessinent ces
 * drapeaux ; Windows, lui, n'embarque aucun glyphe de drapeau et affiche les
 * DEUX LETTRES (« BJ ») à la place. Ce n'est pas un défaut qu'on peut corriger
 * ici — seul un jeu d'images l'enlèverait, et c'est un arbitrage du porteur
 * (poids, licence, 54 fichiers). Le repli reste lisible et juste : le code du
 * pays, à côté de son nom en clair.
 *
 * Le nom du pays n'est JAMAIS porté par le drapeau seul : la ligne écrit
 * `nameFr` en texte, et la pastille est `aria-hidden`. Un lecteur d'écran
 * n'entend donc ni « BJ » ni un nom de drapeau, mais « Bénin ».
 */

/** `U+1F1E6`, l'indicateur régional « A ». */
const PREMIER_INDICATEUR = 0x1f1e6;

const CODE_A = 'A'.charCodeAt(0);

/**
 * Le drapeau de `iso2`, ou une chaîne vide si le code n'est pas deux lettres.
 *
 * Le vide est volontaire : il laisse la pastille se peindre à blanc plutôt que
 * d'afficher un caractère de remplacement, et c'est la seule issue honnête pour
 * un code que la base n'aurait pas normalisé.
 */
export function drapeauDe(iso2: string): string {
  const code = iso2.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return '';
  // `charCodeAt` ne peut pas rendre `undefined` ici : l'expression ci-dessus a
  // déjà prouvé qu'il y a deux lettres.
  return String.fromCodePoint(
    PREMIER_INDICATEUR + (code.charCodeAt(0) - CODE_A),
    PREMIER_INDICATEUR + (code.charCodeAt(1) - CODE_A),
  );
}
