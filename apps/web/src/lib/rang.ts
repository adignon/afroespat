/**
 * Le rang en lettres françaises : 1 → « 1re », 2 → « 2e », 12 → « 12e ».
 *
 * Servait de « {n}e » collé à la main (« 1e » est fautif). Le rang vient du serveur
 * (`waitlistPosition`) ; ce fichier ne fait que l'écrire.
 */
export function rangFr(n: number): string {
  return n === 1 ? '1re' : `${n}e`;
}
