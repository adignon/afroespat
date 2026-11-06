/**
 * Suit `nextCursor` jusqu'au bout (ou jusqu'au plafond) et rend tous les éléments.
 *
 * Pour les écrans qui COMPTENT sur la liste (« 12 demandes, 3 résolues ») : compter
 * la seule première page donnait des nombres faux au-delà de la limite du serveur.
 * Le plafond protège contre une liste sans fin ; `tronquee` dit qu'il a été atteint.
 */
export async function toutesLesPages<T>(
  lire: (curseur: string | null) => Promise<{ readonly items: readonly T[]; readonly nextCursor: string | null }>,
  plafondPages = 10,
): Promise<{ readonly items: readonly T[]; readonly tronquee: boolean }> {
  const items: T[] = [];
  let curseur: string | null = null;
  for (let page = 0; page < plafondPages; page += 1) {
    const reponse = await lire(curseur);
    items.push(...reponse.items);
    curseur = reponse.nextCursor;
    if (curseur === null) return { items, tronquee: false };
  }
  return { items, tronquee: true };
}
