import { randomBytes, scrypt as scryptCallback, type ScryptOptions, timingSafeEqual } from 'node:crypto';
import { hash as argon2Hash, verify as argon2Verify } from '@node-rs/argon2';

/**
 * Hachage du mot de passe d'équipe — 15 §2.1 et 00 §8.3.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ La spec exige **argon2id**. Ce fichier emploie argon2id. L'écart signalé  │
 * │ dans `docs/decisions.md` (« argon2id absent du verrou ») est refermé.     │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ── Migration transparente ─────────────────────────────────────────────────
 *
 * Aucun compte existant n'est invalidé, et personne n'a à réinitialiser quoi que
 * ce soit. Trois faits le garantissent, et ils sont tous VÉRIFIABLES ici :
 *
 *   1. `verifyStaffPassword` lit ENCORE le format scrypt historique
 *      `scrypt$N$r$p$sel$condensé`. Un condensé écrit avant ce jour se vérifie
 *      exactement comme avant ;
 *   2. `needsRehash` rend vrai sur tout ce qui n'est pas de l'argon2id aux
 *      paramètres courants — donc sur TOUT condensé scrypt. `staff-auth.service`
 *      appelle `hashStaffPassword` juste après une vérification réussie, seul
 *      instant où le mot de passe en clair est disponible. La bascule se fait
 *      donc à la connexion suivante, une ligne à la fois, sans campagne ;
 *   3. `hashStaffPassword` ne produit PLUS JAMAIS de scrypt. Tout secret créé
 *      après ce commit est en argon2id.
 *
 * ── Format stocké : avant / après ──────────────────────────────────────────
 *
 *   avant  `scrypt$131072$8$1$<sel b64>$<condensé b64>`      (maison)
 *   après  `$argon2id$v=19$m=19456,t=2,p=1$<sel>$<condensé>` (PHC, standard)
 *
 * Les deux portent leur algorithme ET leurs paramètres — c'est ce qui rend la
 * migration possible sans deviner, et c'est pourquoi les enregistrements DÉJÀ
 * ÉCRITS n'ont besoin d'AUCUNE reprise de données : ils se décrivent eux-mêmes.
 * Le prédécesseur avait choisi ce format en prévision de ce jour ; on en profite.
 * Aucune migration SQL, aucune colonne ajoutée : `password_hash` est un `text` et
 * la chaîne PHC fait 96 caractères.
 *
 * Le discriminant est sans ambiguïté : la chaîne PHC commence par `$`, le format
 * historique par la lettre `s`. Aucun condensé ne peut être lu par la mauvaise
 * branche.
 */

// ════════════════════════════════════════════════════════════════════════════
// Paramètres argon2id — D'OÙ VIENT CHAQUE VALEUR
// ════════════════════════════════════════════════════════════════════════════

/**
 * `docs/specs/` nomme argon2id à trois endroits (00 §8.3, 00 §7.4, 15 §2.1) et
 * n'en FIXE AUCUN PARAMÈTRE — vérifié par recherche sur les 22 fichiers. Les
 * valeurs ci-dessous viennent donc de la référence publique, et chacune est
 * tracée :
 *
 *   · **OWASP Password Storage Cheat Sheet**, section « Argon2id », qui donne
 *     plusieurs réglages déclarés ÉQUIVALENTS en résistance :
 *         m=47104 (46 Mio), t=1, p=1
 *         m=19456 (19 Mio), t=2, p=1   ← retenu
 *         m=12288 (12 Mio), t=3, p=1
 *         m=9216  ( 9 Mio), t=4, p=1
 *         m=7168  ( 7 Mio), t=5, p=1
 *
 *   · le réglage retenu est celui du milieu, pour une raison d'exploitation et
 *     non de cryptographie : `p=1` et 19 Mio par hachage tiennent dans l'empreinte
 *     d'un conteneur d'API sans qu'une rafale de connexions d'équipe ne fasse
 *     grimper la mémoire résidente (cinq connexions simultanées = 95 Mio crête,
 *     contre 235 Mio avec le réglage à 46 Mio). L'équipe compte quelques dizaines
 *     de comptes, pas des dizaines de milliers : on ne gagne rien à choisir le
 *     réglage le plus gourmand, et on risque un incident mémoire.
 *
 *   · `t=2` avec `m=19456` est AUSSI le défaut de `@node-rs/argon2` et celui de
 *     la plupart des bibliothèques argon2 modernes : les valeurs sont écrites
 *     explicitement quand même, jamais héritées d'un défaut, pour qu'une montée
 *     de version de la bibliothèque ne déplace pas silencieusement la sécurité.
 *
 *   · `outputLen = 32` et un sel de 16 octets : RFC 9106 §4 (« the tag length
 *     SHOULD be 32 bytes », « the salt SHOULD be 16 bytes »). Le sel est généré
 *     par la bibliothèque avec un CSPRNG.
 *
 * Coût mesuré sur la machine de développement (Darwin x86_64, Node 24) :
 * hachage ≈ 14 ms, vérification ≈ 15 ms. Pour comparaison, le scrypt qu'on
 * remplace coûtait 384 ms au repos et jusqu'à 5 002 ms sous charge.
 */
export interface Argon2Cost {
  /** `m=` de la chaîne PHC, en kibioctets. */
  readonly memoryCost: number;
  /** `t=` : nombre de passes. */
  readonly timeCost: number;
  /** `p=` : degré de parallélisme. */
  readonly parallelism: number;
}

export const ARGON2_PRODUCTION_COST: Argon2Cost = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
};

/**
 * Profil de test — DÉLIBÉRÉMENT DISTINCT de la production.
 *
 * Le dépôt a déjà payé la leçon avec scrypt : les tests portaient un délai de
 * 30 secondes parce qu'un hachage coûtait des secondes sous charge, et ils
 * rougissaient sans qu'une ligne ait changé. La règle qu'on en tire est que le
 * COÛT DE LA SÉCURITÉ NE SE NÉGOCIE PAS AVEC LE DÉLAI D'UN TEST : on ne baisse
 * pas les paramètres de production pour faire passer une suite, on donne à la
 * suite ses propres paramètres.
 *
 * 1 Mio et une passe : environ 0,5 ms. C'est un mot de passe de PAILLE, et c'est
 * exactement pour cela que `resolveArgon2Cost` refuse de le servir ailleurs qu'en
 * `NODE_ENV=test`.
 */
export const ARGON2_TEST_COST: Argon2Cost = {
  memoryCost: 1_024,
  timeCost: 1,
  parallelism: 1,
};

/**
 * Choisit le profil. **Fonction pure**, pour qu'elle soit éprouvable sans
 * bidouiller `process.env` — et notamment le cas qui compte : en production, le
 * profil réduit est INATTEIGNABLE, même si quelqu'un pose la variable.
 *
 * Il faut DEUX conditions, pas une : `NODE_ENV=test` ET l'aveu explicite
 * `STAFF_PASSWORD_FAST_HASH=1`. Une variable oubliée dans un `.env` de
 * production ne suffit donc pas, et `NODE_ENV` seul non plus.
 */
export function resolveArgon2Cost(env: {
  readonly NODE_ENV?: string | undefined;
  readonly STAFF_PASSWORD_FAST_HASH?: string | undefined;
}): Argon2Cost {
  if (env.NODE_ENV === 'test' && env.STAFF_PASSWORD_FAST_HASH === '1') return ARGON2_TEST_COST;
  return ARGON2_PRODUCTION_COST;
}

function activeCost(): Argon2Cost {
  return resolveArgon2Cost(process.env);
}

/** Longueur du condensé, RFC 9106 §4. */
const OUTPUT_LENGTH = 32;

const ARGON2ID_PREFIX = '$argon2id$';

/**
 * En-tête PHC d'un condensé argon2id : `$argon2id$v=19$m=…,t=…,p=…$`.
 *
 * On lit les paramètres à la main plutôt qu'avec `parseOptions()` de la
 * bibliothèque, pour une raison de typage qui a une conséquence réelle :
 * `parseOptions` rend un `Algorithm`, qui est un `const enum` AMBIANT, et
 * `isolatedModules` (activé dans `packages/config/tsconfig/base.json`) interdit
 * d'y accéder — `error TS2748`, vérifié. Une expression régulière sur un format
 * normalisé et figé est de toute façon plus lisible qu'une comparaison d'énumérés.
 *
 * `v=19` est ancré : un condensé en version 16 (argon2 d'avant 2016) doit être
 * réhaché, pas accepté comme courant.
 */
const ARGON2ID_HEADER = /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$/;

// ════════════════════════════════════════════════════════════════════════════
// scrypt — LECTURE SEULE, format historique
// ════════════════════════════════════════════════════════════════════════════

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

const SCRYPT_PREFIX = 'scrypt';

/**
 * `maxmem` doit être relevé : la valeur par défaut de Node (32 Mio) est
 * inférieure à ce que N = 2^17 demande (≈ 128 Mio · r), et scrypt échoue alors
 * avec un `ERR_CRYPTO_INVALID_SCRYPT_PARAMS` qui ne dit rien de la cause.
 */
const SCRYPT_MAXMEM = 256 * 1024 * 1024;

/** Paramètres du format historique, conservés pour fabriquer des condensés d'époque. */
const SCRYPT_LEGACY_N = 131_072;
const SCRYPT_LEGACY_R = 8;
const SCRYPT_LEGACY_P = 1;
const SCRYPT_SALT_LENGTH = 16;

/**
 * Fabrique un condensé au FORMAT HISTORIQUE scrypt.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ RÉSERVÉ AUX TESTS. Aucun chemin de production ne doit l'appeler — c'est   │
 * │ vérifié par `staff-password.test.ts`, qui échoue si un fichier hors tests │
 * │ l'importe.                                                               │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Elle existe parce qu'on ne peut pas prouver qu'un vieux condensé reste
 * vérifiable sans savoir en fabriquer un. `n` est réglable pour que les tests ne
 * paient pas les 384 ms du paramètre d'époque à chaque appel — la vérification,
 * elle, lit N dans la chaîne, donc le chemin éprouvé est bien le vrai.
 */
export async function hashWithLegacyScryptForTests(
  password: string,
  n: number = SCRYPT_LEGACY_N,
): Promise<string> {
  const salt = randomBytes(SCRYPT_SALT_LENGTH);
  const derived = await scrypt(password.normalize('NFKC'), salt, OUTPUT_LENGTH, {
    N: n,
    r: SCRYPT_LEGACY_R,
    p: SCRYPT_LEGACY_P,
    maxmem: SCRYPT_MAXMEM,
  });
  return [SCRYPT_PREFIX, n, SCRYPT_LEGACY_R, SCRYPT_LEGACY_P, salt.toString('base64'), derived.toString('base64')].join(
    '$',
  );
}

/** Vérifie un condensé `scrypt$N$r$p$sel$condensé`. Rend faux sur tout doute. */
async function verifyLegacyScrypt(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6) return false;
  const [prefix, n, r, p, salt, digest] = parts as [string, string, string, string, string, string];
  if (prefix !== SCRYPT_PREFIX) return false;

  const cost = { N: Number(n), r: Number(r), p: Number(p) };
  if (!Number.isInteger(cost.N) || !Number.isInteger(cost.r) || !Number.isInteger(cost.p)) {
    return false;
  }
  // Un `N` absurde venu d'une ligne corrompue ferait allouer des gigaoctets.
  if (cost.N < 1024 || cost.N > 1 << 21) return false;

  const expected = Buffer.from(digest, 'base64');
  if (expected.length === 0) return false;
  let derived: Buffer;
  try {
    derived = await scrypt(password.normalize('NFKC'), Buffer.from(salt, 'base64'), expected.length, {
      ...cost,
      maxmem: SCRYPT_MAXMEM,
    });
  } catch {
    return false;
  }
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

// ════════════════════════════════════════════════════════════════════════════
// API publique
// ════════════════════════════════════════════════════════════════════════════

/** Hache en argon2id. C'est le SEUL producteur de condensés du produit. */
export async function hashStaffPassword(password: string): Promise<string> {
  const cost = activeCost();
  const stored = await argon2Hash(password.normalize('NFKC'), {
    memoryCost: cost.memoryCost,
    timeCost: cost.timeCost,
    parallelism: cost.parallelism,
    outputLen: OUTPUT_LENGTH,
  });

  /**
   * L'algorithme n'est PAS passé en option, et c'est délibéré : `Algorithm` est
   * un `const enum` ambiant qu'`isolatedModules` interdit d'importer (TS2748).
   * Le défaut de `@node-rs/argon2` est argon2id — mais un défaut n'est pas une
   * garantie, alors on VÉRIFIE ce qui sort. Si une montée de version changeait ce
   * défaut, ce serait une panne bruyante au premier hachage, jamais un produit
   * qui stocke silencieusement de l'argon2d.
   */
  if (!stored.startsWith(ARGON2ID_PREFIX)) {
    throw new Error(
      `argon2 a produit un condensé qui n'est pas de l'argon2id : ${stored.slice(0, 16)}…`,
    );
  }
  return stored;
}

/**
 * Vérifie un mot de passe, DANS LES DEUX FORMATS.
 *
 * Rend `false` sur tout format non reconnu — JAMAIS une exception, et jamais
 * `true` : un condensé illisible est un refus, pas un incident, et surtout pas un
 * laissez-passer. Même règle pour un condensé argon2 malformé : la bibliothèque
 * lève, on transforme en refus.
 */
export async function verifyStaffPassword(password: string, stored: string): Promise<boolean> {
  if (stored.startsWith(ARGON2ID_PREFIX)) {
    try {
      return await argon2Verify(stored, password.normalize('NFKC'));
    } catch {
      return false;
    }
  }
  if (stored.startsWith(`${SCRYPT_PREFIX}$`)) {
    return verifyLegacyScrypt(password, stored);
  }
  return false;
}

/**
 * Le condensé a-t-il été produit par l'algorithme ET les paramètres courants ?
 *
 * Vrai — donc « à réhacher » — dans tous les cas suivants :
 *   · condensé scrypt, quels que soient ses paramètres (c'est LA migration) ;
 *   · argon2id en version 16, ou argon2i / argon2d ;
 *   · argon2id aux bons algorithme et version mais à des paramètres différents,
 *     ce qui couvre une montée de coût future — et aussi un condensé fabriqué
 *     avec le profil de test qui atterrirait en production ;
 *   · n'importe quoi d'illisible : on préfère réhacher pour rien que laisser
 *     traîner un format qu'on ne comprend pas.
 */
export function needsRehash(stored: string): boolean {
  const header = ARGON2ID_HEADER.exec(stored);
  if (header === null) return true;

  const [, memory, time, parallelism] = header;
  const cost = activeCost();
  return (
    Number(memory) !== cost.memoryCost ||
    Number(time) !== cost.timeCost ||
    Number(parallelism) !== cost.parallelism
  );
}

/** Nom de l'algorithme courant, tel qu'il apparaît dans la chaîne PHC. */
export const STAFF_PASSWORD_SCHEME = 'argon2id';
