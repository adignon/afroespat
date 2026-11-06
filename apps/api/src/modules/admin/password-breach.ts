import { createHash } from 'node:crypto';

/**
 * MOTS DE PASSE COMPROMIS — k-anonymat « Pwned Passwords » (HIBP), 15 §2.1.
 *
 * On n'envoie JAMAIS le mot de passe, ni son empreinte entière : seulement les 5 premiers caractères hexadécimaux
 * du SHA-1 (`GET https://api.pwnedpasswords.com/range/XXXXX`). Le service répond la liste des suffixes qui
 * partagent ce préfixe, avec leur nombre d'apparitions ; la comparaison se fait ICI. `Add-Padding: true` ajoute des
 * lignes factices (compte 0) pour que la taille de la réponse ne révèle rien.
 *
 * ── REPLI SÛR HORS LIGNE ───────────────────────────────────────────────────
 * Si le service est injoignable (délai, erreur réseau, statut ≠ 200), le résultat est `inconnu`, pas `propre` :
 * l'appelant retombe sur la liste locale (`staffPasswordIsAllowed`, déjà appliquée par le schéma) et ne bloque pas
 * la création d'un compte faute de réseau. Un mot de passe trouvé dans la liste, lui, est refusé.
 */

export type VerdictMotDePasse = 'compromis' | 'propre' | 'inconnu';

export type FetchLike = (
  url: string,
  init: { headers: Record<string, string>; signal: AbortSignal },
) => Promise<{ ok: boolean; status: number; text: () => Promise<string> }>;

export const HIBP_RANGE_URL = 'https://api.pwnedpasswords.com/range/';
export const HIBP_TIMEOUT_MS = 3000;

export function sha1Hex(valeur: string): string {
  return createHash('sha1').update(valeur, 'utf8').digest('hex').toUpperCase();
}

/** Lit la réponse `SUFFIXE:COMPTE` ligne à ligne ; les lignes de bourrage (compte 0) ne comptent pas. */
export function suffixePresent(corps: string, suffixe: string): boolean {
  for (const ligne of corps.split(/\r?\n/)) {
    const [s, n] = ligne.trim().split(':');
    if (s !== undefined && s.toUpperCase() === suffixe && Number(n ?? '0') > 0) return true;
  }
  return false;
}

export async function verifierMotDePasseCompromis(
  motDePasse: string,
  fetchImpl: FetchLike = (url, init) => fetch(url, init),
  timeoutMs: number = HIBP_TIMEOUT_MS,
): Promise<VerdictMotDePasse> {
  const empreinte = sha1Hex(motDePasse);
  const prefixe = empreinte.slice(0, 5);
  const suffixe = empreinte.slice(5);
  const controleur = new AbortController();
  const minuteur = setTimeout(() => controleur.abort(), timeoutMs);
  try {
    const reponse = await fetchImpl(`${HIBP_RANGE_URL}${prefixe}`, {
      headers: { 'Add-Padding': 'true', 'User-Agent': 'DiasporyPlus-admin' },
      signal: controleur.signal,
    });
    if (!reponse.ok) return 'inconnu';
    return suffixePresent(await reponse.text(), suffixe) ? 'compromis' : 'propre';
  } catch {
    return 'inconnu';
  } finally {
    clearTimeout(minuteur);
  }
}

/**
 * La vérification en ligne est coupée sous `NODE_ENV=test` (aucun appel réseau dans les tests d'intégration), sauf
 * si un test fournit sa propre `fetch`. Ailleurs elle est active.
 */
export async function motDePasseCompromis(
  motDePasse: string,
  options: { readonly fetchImpl?: FetchLike; readonly env?: Readonly<Record<string, string | undefined>> } = {},
): Promise<boolean> {
  const env = options.env ?? process.env;
  if (options.fetchImpl === undefined && env.NODE_ENV === 'test') return false;
  return (await verifierMotDePasseCompromis(motDePasse, options.fetchImpl)) === 'compromis';
}
