/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ UN NUMÉRO QUE LA VALIDATION ACCEPTE — POUR LES ÉPREUVES D'INTÉGRATION      ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * `AuthService.requestOtp` valide désormais le numéro avec libphonenumber, et
 * enregistre son format international. CENT POUR CENT DES BANCS D'ÉPREUVE
 * fabriquaient leur numéro à la main, chacun à sa façon — « 07 », « 06 », « 9 »
 * suivis d'un horodatage — et aucune de ces formes n'est un numéro béninois :
 * le Bénin est passé à DIX chiffres commençant par « 01 ».
 *
 * MESURÉ : 240 épreuves sur 856 tombaient dans `AuthService.fail`, dans seize
 * fichiers. Pas un seul défaut de produit — seize générateurs à réparer, ce que
 * ce fichier remplace par un seul.
 *
 * ── POURQUOI « 019… » ────────────────────────────────────────────────────────
 *
 * Cette forme est valide pour le BÉNIN (`+229 01 9…`) ET pour la FRANCE
 * (`+33 1 90…`), les deux pays dont les bancs se servent. Un seul générateur
 * suffit donc, quel que soit l'`iso2` que le cas passe à `requestOtp`.
 *
 * ── L'UNICITÉ, ET POURQUOI ELLE COMPTE ──────────────────────────────────────
 *
 * Un numéro déjà connu fait une CONNEXION là où le cas voulait une inscription :
 * la panne est alors silencieuse et à contretemps. Les sept chiffres libres
 * portent donc trois sources : le processus (deux chiffres, car vitest répartit
 * les fichiers sur plusieurs ouvriers), la milliseconde (trois), et le rang que
 * le banc appelant fait avancer (deux).
 */

let interne = 0;

/** Un numéro valide et nouveau. `rang` : le compteur du banc, s'il en tient un. */
export function numeroDEpreuve(rang?: number): string {
  const processus = String(process.pid % 100).padStart(2, '0');
  const instant = String(Date.now()).slice(-3);
  const suite = String((rang ?? interne++) % 100).padStart(2, '0');
  return `019${processus}${instant}${suite}`;
}

/**
 * Un MOBILE français valide et nouveau (lot A).
 *
 * `numeroDEpreuve` rend `019…`, qui est valide pour le Bénin ET, en forme, pour la
 * France (`+33 1 90…`) — mais c'est une LIGNE FIXE française, que le serveur
 * refuse désormais (`PHONE_NOT_MOBILE`, aucun SMS ne part vers un fixe). Les
 * épreuves qui inscrivent un membre avec le pays « FR » prennent donc celui-ci :
 * `06` suivi de huit chiffres, de la même façon unique (processus, instant, rang).
 */
export function numeroFrancaisDEpreuve(rang?: number): string {
  const processus = String(process.pid % 100).padStart(2, '0');
  const instant = String(Date.now()).slice(-3);
  const suite = String((rang ?? interne++) % 100).padStart(2, '0');
  // « 061 » : un préfixe mobile valide dans tous les cas, quels que soient les
  // chiffres qui suivent.
  return `061${processus}${instant}${suite}`;
}
