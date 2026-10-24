/**
 * Les OUTILS COMMUNS aux adaptations du lot E (`agenda-vivant.mjs`,
 * `villes-vivant.mjs`, `services-vivant.mjs`).
 *
 * Trois gestes reviennent partout : changer la balise d'un élément en gardant son
 * style (un `<span>` dessiné devient un `<button>` ou un `<Link>`), repérer
 * l'ouvrante la plus proche avant un texte, et couper une expression `{ … }` en
 * COMPTANT les accolades. Les écrire une fois évite trois façons de se tromper sur
 * le piège n° 3 (une coupe compte les balises).
 */
import { finElement } from './reseau-vivant.mjs';

/** Remises à zéro d'un bouton nu : le style DESSINÉ vient après et l'emporte. */
export const NU = 'border: "none", font: "inherit", padding: 0, cursor: "pointer"';

/**
 * Change la balise de l'élément qui commence à `debut` (`<span …>…</span>`) en
 * `balise`, y ajoute `attributs` et fusionne `style` dans son style. Rend le JSX
 * entier, ou `null` quand l'élément n'est pas fermé comme il faut.
 */
export function changerBalise(jsx, debut, balise, attributs, ajoutStyle) {
  const nom = /^<([a-zA-Z][\w.]*)/.exec(jsx.slice(debut));
  if (nom === null) return null;
  const ancienne = nom[1];
  const posStyle = jsx.indexOf('style={{ ', debut);
  const finOuvrante = jsx.indexOf('>', debut);
  if (posStyle === -1 || posStyle > finOuvrante + 400) return null;
  // L'attribut `style={{ … }}` : on COMPTE les accolades, car un gabarit
  // (`1px solid ${j.bord}`) en contient.
  const debutObjet = posStyle + 'style='.length;
  const finStyle = finAccolade(jsx, debutObjet);
  if (finStyle === -1 || jsx[finStyle] !== '>') return null;
  const style = jsx.slice(posStyle + 'style={{ '.length, finStyle - ' }}'.length);
  const avant = jsx.slice(debut + 1 + ancienne.length, posStyle).trimEnd();
  const fin = finElement(jsx, debut);
  if (fin === -1) return null;
  const corps = jsx.slice(finStyle + 1, fin - `</${ancienne}>`.length);
  const total = ajoutStyle === '' ? style : `${style}, ${ajoutStyle}`;
  const neuve = `<${balise}${avant} ${attributs} style={{ ${total} }}>${corps}</${balise}>`;
  return jsx.slice(0, debut) + neuve + jsx.slice(fin);
}

/** L'indice de la balise ouvrante `<tag …>` la plus proche AVANT `indice`. */
export const ouvranteAvant = (jsx, indice, tag) => jsx.lastIndexOf(`<${tag}`, indice);

/** La fin (accolade fermante comprise) d'une expression `{ … }` qui commence à `debut`. */
export function finAccolade(jsx, debut) {
  let profondeur = 0;
  for (let i = debut; i < jsx.length; i += 1) {
    if (jsx[i] === '{') profondeur += 1;
    else if (jsx[i] === '}') {
      profondeur -= 1;
      if (profondeur === 0) return i + 1;
    }
  }
  return -1;
}

