/**
 * OÙ OUVRIR UN PANNEAU DE CHOIX RATTACHÉ À UN CHAMP.
 *
 * Le panneau s'ouvre SOUS le champ, à sa largeur. Il ne peut pas dépasser le bas de la
 * fenêtre : s'il n'y a pas la place de montrer au moins `HAUTEUR_UTILE` pixels dessous
 * et qu'il y en a davantage au-dessus, il s'ouvre au-dessus du champ. Dans les deux cas
 * sa hauteur est bornée (`maxHeight`) et la liste défile à l'intérieur.
 *
 * Fonction pure : le navigateur lui donne le rectangle du champ et la hauteur de la
 * fenêtre, elle rend où poser le panneau. C'est ce qui se teste sans navigateur.
 */
export const HAUTEUR_MAX_PANNEAU = 220;
/** Sous cette hauteur, une liste de deux lignes n'est plus lisible : on cherche mieux ailleurs. */
export const HAUTEUR_UTILE = 120;
export const ECART_PANNEAU = 4;
const MARGE_FENETRE = 8;

export interface PlacementPanneau {
  readonly cote: 'dessous' | 'dessus';
  readonly hauteurMax: number;
}

export function placerPanneau(champ: { readonly top: number; readonly bottom: number }, hauteurFenetre: number): PlacementPanneau {
  const dessous = hauteurFenetre - champ.bottom - ECART_PANNEAU - MARGE_FENETRE;
  const dessus = champ.top - ECART_PANNEAU - MARGE_FENETRE;
  if (dessous >= Math.min(HAUTEUR_UTILE, HAUTEUR_MAX_PANNEAU) || dessous >= dessus) {
    return { cote: 'dessous', hauteurMax: Math.max(0, Math.min(HAUTEUR_MAX_PANNEAU, dessous)) };
  }
  return { cote: 'dessus', hauteurMax: Math.max(0, Math.min(HAUTEUR_MAX_PANNEAU, dessus)) };
}
