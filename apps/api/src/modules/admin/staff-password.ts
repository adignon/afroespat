import { randomBytes, scrypt as scryptCallback, type ScryptOptions, timingSafeEqual } from 'node:crypto';

/**
 * `promisify` ne convient pas ici : ses surcharges ne couvrent que la forme à
 * trois arguments de `scrypt`, et la forme AVEC options — dont on a besoin, car
 * les paramètres de coût sont tout l'intérêt — ne passe pas le typage. Le
 * enveloppement manuel est plus court que les contorsions de types.
 */
function scrypt(
  password: string,
  salt: Buffer,
  keyLength: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keyLength, options, (error, derived) => {
      if (error !== null) reject(error);
      else resolve(derived);
    });
  });
}

/**
 * Hachage du mot de passe d'équipe — 15 §2.1 et 00 §8.3.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ ÉCART ASSUMÉ ET SIGNALÉ : la spec exige **argon2id**. Ce fichier emploie  │
 * │ **scrypt**.                                                              │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * La raison est matérielle : argon2id n'existe pour Node que sous forme de
 * module natif (`argon2`, `@node-rs/argon2`), aucun n'est dans le lockfile, et
 * l'environnement s'installe en `--frozen-lockfile`. L'ajouter demande une
 * décision de dépendance qui n'est pas la mienne à prendre — c'est remonté dans
 * le rapport de livraison.
 *
 * scrypt est le bon repli, et non un pis-aller quelconque : c'est la seule
 * fonction à coût mémoire de `node:crypto`, donc la seule qui résiste comme
 * argon2 au calcul massivement parallèle. PBKDF2 et bcrypt ne le font pas. Le
 * format stocké porte SON NOM et SES paramètres, précisément pour que la
 * migration vers argon2id se fasse en réhachant à la connexion suivante, sans
 * invalider aucun mot de passe :
 *
 *     scrypt$N$r$p$<sel base64>$<condensé base64>
 *
 * `needsRehash()` est là pour ce jour-là. Elle rend vrai sur tout format qui
 * n'est pas exactement le format courant — y compris un futur `argon2id$…` lu
 * par un ancien binaire, cas où l'on préfère refuser (voir `verify`).
 */

/** Paramètres OWASP 2024 pour scrypt : N = 2^17, r = 8, p = 1. */
const N = 131_072;
const R = 8;
const P = 1;
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;
const PREFIX = 'scrypt';

/**
 * `maxmem` doit être relevé : la valeur par défaut de Node (32 Mio) est
 * inférieure à ce que N = 2^17 demande (≈ 128 Mio · r), et scrypt échoue alors
 * avec un `ERR_CRYPTO_INVALID_SCRYPT_PARAMS` qui ne dit rien de la cause.
 */
const MAXMEM = 256 * 1024 * 1024;

export async function hashStaffPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const derived = await scrypt(password.normalize('NFKC'), salt, KEY_LENGTH, {
    N,
    r: R,
    p: P,
    maxmem: MAXMEM,
  });
  return [PREFIX, N, R, P, salt.toString('base64'), derived.toString('base64')].join('$');
}

/**
 * Vérifie un mot de passe. Rend `false` sur tout format non reconnu — JAMAIS une
 * exception, et jamais `true` : un condensé illisible est un refus, pas un
 * incident, et surtout pas un laissez-passer.
 */
export async function verifyStaffPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6) return false;
  const [prefix, n, r, p, salt, digest] = parts as [string, string, string, string, string, string];
  if (prefix !== PREFIX) return false;

  const cost = { N: Number(n), r: Number(r), p: Number(p) };
  if (!Number.isInteger(cost.N) || !Number.isInteger(cost.r) || !Number.isInteger(cost.p)) {
    return false;
  }
  // Un `N` absurde venu d'une ligne corrompue ferait allouer des gigaoctets.
  if (cost.N < 1024 || cost.N > 1 << 21) return false;

  const expected = Buffer.from(digest, 'base64');
  let derived: Buffer;
  try {
    derived = await scrypt(password.normalize('NFKC'), Buffer.from(salt, 'base64'), expected.length, {
      ...cost,
      maxmem: MAXMEM,
    });
  } catch {
    return false;
  }
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

/** Le condensé a-t-il été produit avec les paramètres courants ? */
export function needsRehash(stored: string): boolean {
  return !stored.startsWith(`${PREFIX}$${N}$${R}$${P}$`);
}

export { PREFIX as STAFF_PASSWORD_SCHEME };
