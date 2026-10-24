/**
 * « 480 », « 480,50 », « 480 € » → des centimes ENTIERS, ou `null` si la saisie n'est
 * pas un montant. Jamais de flottant stocké ni envoyé : un montant voyage en centimes
 * (10 §4 : `price_cents`, `amount_cents`).
 */
export function centimesDe(saisie: string): number | null {
  const propre = saisie.replace(/[€\s]/g, '').replace(',', '.');
  if (propre === '' || !/^\d+(\.\d{1,2})?$/.test(propre)) return null;
  return Math.round(Number(propre) * 100);
}
