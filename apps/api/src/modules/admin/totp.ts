import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { TOTP_DIGITS, TOTP_SECRET_BYTES, TOTP_STEP_SECONDS, TOTP_WINDOW_STEPS } from '@app/shared';

/**
 * TOTP — RFC 6238, second facteur OBLIGATOIRE de l'équipe (15 §2.1, 00 §7.4).
 *
 * Écrit à la main, comme `token.service.ts` et pour la même raison : l'algorithme
 * tient en quinze lignes de `node:crypto`, et c'est une dépendance de moins sur
 * le chemin de l'authentification. La contrepartie — il faut le tester — est
 * assumée : les vecteurs de l'annexe B de la RFC 6238 sont dans
 * `__tests__/totp.test.ts`, ce qui est plus de garantie qu'un paquet dont on lit
 * le nom.
 *
 * HMAC-**SHA1**, et non SHA-256. Ce n'est pas un oubli : SHA1 est l'algorithme
 * que Google Authenticator, Aegis, 1Password et FreeOTP emploient sans qu'on
 * puisse le leur dire, et l'URI `otpauth://` n'a pas de moyen fiable de négocier
 * autre chose. Un TOTP en SHA-256 produit des codes que l'application de l'équipe
 * n'affichera jamais. La faiblesse de SHA1 en collision n'a par ailleurs aucune
 * portée ici : on l'emploie en HMAC, sur un secret de 160 bits, pour un code qui
 * vit trente secondes.
 */

/** Le secret, en base32 sans remplissage — le seul encodage que les applications lisent. */
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateTotpSecret(): string {
  return base32Encode(randomBytes(TOTP_SECRET_BYTES));
}

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(secret: string): Buffer {
  const cleaned = secret.replace(/=+$/, '').replace(/\s+/g, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of cleaned) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) throw new Error('Secret TOTP invalide');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** Le compteur de pas, seul état du protocole. Exporté : il sert à refuser un rejeu. */
export function totpCounter(at: Date = new Date()): number {
  return Math.floor(at.getTime() / 1000 / TOTP_STEP_SECONDS);
}

/** Le code à `TOTP_DIGITS` chiffres pour un compteur donné. */
export function totpCodeFor(secretBase32: string, counter: number): string {
  const key = base32Decode(secretBase32);
  const message = Buffer.alloc(8);
  // Un compteur de pas reste largement sous 2^53 ; `writeBigUInt64BE` évite
  // malgré tout d'avoir à découper le nombre à la main.
  message.writeBigUInt64BE(BigInt(counter));

  const digest = createHmac('sha1', key).update(message).digest();
  // Troncature dynamique de la RFC 4226 §5.4 : les quatre derniers bits du
  // condensé désignent l'octet de départ.
  const offset = (digest[digest.length - 1] as number) & 0x0f;
  const binary =
    (((digest[offset] as number) & 0x7f) << 24) |
    (((digest[offset + 1] as number) & 0xff) << 16) |
    (((digest[offset + 2] as number) & 0xff) << 8) |
    ((digest[offset + 3] as number) & 0xff);

  return String(binary % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, '0');
}

/**
 * Le code est-il valide, et pour quel pas ?
 *
 * Rend le COMPTEUR retenu, et non un booléen. C'est ce qui permet à l'appelant de
 * refuser un rejeu : RFC 6238 §5.2 impose qu'un code accepté ne le soit qu'une
 * fois, et sans le compteur on ne peut pas dire « celui-ci a déjà servi ». Rendre
 * `true` obligerait à le recalculer, donc à réimplémenter la fenêtre ailleurs.
 *
 * La fenêtre est de ±1 pas (`TOTP_WINDOW_STEPS`) : les horloges des téléphones
 * dérivent de quelques secondes, et une fenêtre nulle produit des refus que
 * l'utilisateur ne peut pas comprendre ni corriger. Plus large, elle allongerait
 * d'autant la durée de vie d'un code intercepté.
 *
 * La comparaison est à TEMPS CONSTANT. Un code à six chiffres n'a que un million
 * de valeurs : une comparaison qui fuit la longueur du préfixe commun réduit
 * l'espace de recherche bien en dessous de ce que la limite de débit couvre.
 */
export function verifyTotp(
  secretBase32: string,
  code: string,
  at: Date = new Date(),
): { readonly counter: number } | null {
  if (!/^\d+$/.test(code) || code.length !== TOTP_DIGITS) return null;
  const current = totpCounter(at);
  for (let delta = -TOTP_WINDOW_STEPS; delta <= TOTP_WINDOW_STEPS; delta += 1) {
    const counter = current + delta;
    if (counter < 0) continue;
    if (constantTimeEquals(totpCodeFor(secretBase32, counter), code)) return { counter };
  }
  return null;
}

function constantTimeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * L'URI `otpauth://` que l'application d'authentification scanne.
 *
 * Le secret y apparaît EN CLAIR — c'est la nature du protocole, et c'est pourquoi
 * cette chaîne ne sort qu'une fois, dans la réponse à `/auth/totp/enroll`, sur
 * une requête déjà authentifiée par le premier facteur, et n'est JAMAIS
 * journalisée (`totpSecret` est dans la liste des clés masquées de
 * `audit.service.ts`).
 */
export function totpUri(options: {
  readonly secretBase32: string;
  readonly accountEmail: string;
  readonly issuer: string;
}): string {
  const label = `${encodeURIComponent(options.issuer)}:${encodeURIComponent(options.accountEmail)}`;
  const params = new URLSearchParams({
    secret: options.secretBase32,
    issuer: options.issuer,
    algorithm: 'SHA1',
    digits: String(TOTP_DIGITS),
    period: String(TOTP_STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
