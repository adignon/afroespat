import { readFileSync, statSync } from 'node:fs';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LIRE LE CODE OTP DU JOURNAL — SANS LIRE CELUI DE QUELQU'UN D'AUTRE        ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le fournisseur de SMS fictif écrit le code dans le journal de l'API, et c'est
 * la seule façon qu'un test a de le connaître. Deux pièges, et les deux ont mordu.
 *
 * ── 1. LE NUMÉRO EST MASQUÉ ────────────────────────────────────────────────
 *
 * La ligne dit « SMS fictif vers …5778 », pas le numéro entier : le journal ne
 * publie pas un numéro de téléphone, et c'est très bien. Un test ne peut donc
 * reconnaître SON message qu'aux QUATRE DERNIERS CHIFFRES — dix mille valeurs.
 *
 * ── 2. LE JOURNAL N'OUBLIE RIEN ────────────────────────────────────────────
 *
 * Il grossit depuis le premier lancement de la journée. Chercher « …5778 » dedans
 * trouve donc aussi les codes envoyés il y a une heure à un autre membre dont le
 * numéro finissait pareil. MESURÉ : `codesSentTo(numéro)` a rendu DEUX codes pour
 * une inscription neuve, et le test a échoué en accusant l'écran.
 *
 * Le générateur de numéros n'y pouvait rien : sa part d'horodatage repasse sur
 * les mêmes valeurs toutes les cent secondes, alors que le journal, lui, garde
 * tout. Agrandir la plage ne ferait que rendre la collision plus rare, donc plus
 * difficile à comprendre le jour où elle revient.
 *
 * ── CE QU'ON FAIT À LA PLACE ───────────────────────────────────────────────
 *
 * On prend la TAILLE du journal AVANT de demander le code, et on ne lit que ce
 * qui a été écrit après. La fenêtre de confusion tombe de « toute la journée » à
 * « le temps d'un aller-retour », où le compteur de `numeroNational` garantit
 * déjà que deux numéros du même processus diffèrent.
 */
const API_LOG = process.env['API_LOG'] ?? '';

/** La taille du journal MAINTENANT. À prendre avant de demander un code. */
export function marqueDuJournal(): number {
  if (API_LOG === '') return 0;
  try {
    return statSync(API_LOG).size;
  } catch {
    return 0;
  }
}

/** Les codes envoyés à ce numéro DEPUIS la marque — et eux seuls. */
export function codesDepuis(phone: string, marque: number): string[] {
  if (API_LOG === '') return [];
  const quatre = phone.slice(-4);
  try {
    // `latin1` : le journal porte des couleurs ANSI et des accents, et on ne
    // cherche que des chiffres — décoder en UTF-8 déplacerait les offsets.
    const octets = readFileSync(API_LOG);
    const texte = octets.subarray(Math.min(marque, octets.length)).toString('latin1');
    const motif = new RegExp(
      `SMS fictif vers [^:]*${quatre} : Votre code de connexion : (\\d{6})`,
      'g',
    );
    return [...texte.matchAll(motif)].map((m) => m[1] as string);
  } catch {
    return [];
  }
}
