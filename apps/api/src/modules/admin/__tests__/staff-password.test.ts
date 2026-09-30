import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ARGON2_PRODUCTION_COST,
  ARGON2_TEST_COST,
  STAFF_PASSWORD_SCHEME,
  hashStaffPassword,
  hashWithLegacyScryptForTests,
  needsRehash,
  resolveArgon2Cost,
  verifyStaffPassword,
} from '../staff-password';

/**
 * Mot de passe d'équipe — passage de scrypt à argon2id (00 §8.3, 15 §2.1).
 *
 * Ce fichier existe pour une seule raison : prouver que le changement
 * d'algorithme est TRANSPARENT. Aucun compte invalidé, aucun secret à
 * réinitialiser, et pas un seul mauvais mot de passe accepté au passage.
 *
 * ── Plus de délai de 30 secondes ────────────────────────────────────────────
 *
 * Le fichier précédent portait `{ timeout: 30_000 }` parce qu'un hachage scrypt à
 * N = 2^17 coûtait 384 ms au repos et jusqu'à 5 002 ms sous charge. Le délai a
 * disparu, et ce n'est pas un oubli : argon2id aux paramètres de PRODUCTION coûte
 * 14 ms sur la même machine, et 0,5 ms au profil de test. Le délai par défaut de
 * vitest est redevenu confortable — mesure, pas espoir.
 *
 * Les tests qui touchent encore scrypt lui passent un `N` réduit : le format
 * PORTE ses paramètres, donc la vérification lit bien le vrai chemin de code
 * historique, simplement moins cher.
 */

/** Un N d'époque réduit : le chemin de code est le même, la facture non. */
const CHEAP_SCRYPT_N = 16_384;

const SECRET = 'un mot de passe de plus de douze';
const WRONG = 'un mot de passe de plus de douz';

describe('argon2id — paramètres et provenance', () => {
  it('emploie les valeurs OWASP annoncées, et pas un défaut de bibliothèque', async () => {
    const stored = await hashStaffPassword(SECRET);
    // Le profil actif en test est réduit ; c'est le profil de PRODUCTION qu'on
    // épingle ici, parce que c'est lui qui est une décision de sécurité.
    expect(ARGON2_PRODUCTION_COST).toEqual({ memoryCost: 19_456, timeCost: 2, parallelism: 1 });
    expect(STAFF_PASSWORD_SCHEME).toBe('argon2id');
    // …et quoi qu'il arrive, ce qui sort est de l'argon2id en version 19.
    expect(stored.startsWith('$argon2id$v=19$')).toBe(true);
  });

  /**
   * LE test de sûreté du profil réduit. Les paramètres de test sont de la paille
   * (1 Mio, une passe) ; s'ils devenaient atteignables en production, tous les
   * mots de passe d'équipe seraient cassables. Il faut DEUX conditions réunies.
   */
  it('n’offre JAMAIS le profil réduit hors NODE_ENV=test', () => {
    expect(resolveArgon2Cost({ NODE_ENV: 'test', STAFF_PASSWORD_FAST_HASH: '1' })).toBe(
      ARGON2_TEST_COST,
    );

    for (const env of [
      { NODE_ENV: 'production', STAFF_PASSWORD_FAST_HASH: '1' },
      { NODE_ENV: 'development', STAFF_PASSWORD_FAST_HASH: '1' },
      { NODE_ENV: undefined, STAFF_PASSWORD_FAST_HASH: '1' },
      { NODE_ENV: 'test', STAFF_PASSWORD_FAST_HASH: undefined },
      { NODE_ENV: 'test', STAFF_PASSWORD_FAST_HASH: 'true' },
      {},
    ]) {
      expect(resolveArgon2Cost(env)).toBe(ARGON2_PRODUCTION_COST);
    }
  });

  /**
   * `hashWithLegacyScryptForTests` sait fabriquer du scrypt. C'est indispensable
   * pour éprouver la compatibilité descendante, et ce serait un retour en arrière
   * si un chemin de production l'appelait. On le vérifie par lecture des sources
   * plutôt qu'en faisant confiance à la revue.
   */
  it('ne laisse aucun chemin de production fabriquer du scrypt', () => {
    const root = join(__dirname, '..', '..', '..');
    const offenders: string[] = [];

    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
          walk(full);
          continue;
        }
        if (!full.endsWith('.ts') || full.endsWith('.test.ts')) continue;
        if (full.endsWith(join('admin', 'staff-password.ts'))) continue;
        if (readFileSync(full, 'utf8').includes('hashWithLegacyScryptForTests')) {
          offenders.push(relative(root, full));
        }
      }
    };
    walk(root);

    expect(offenders).toEqual([]);
  });
});

describe('compatibilité descendante — un condensé scrypt reste vérifiable', () => {
  /**
   * LA promesse de la migration. Un membre de l'équipe dont le secret dort en
   * scrypt depuis des mois se connecte comme avant.
   */
  it('vérifie encore un condensé au format historique scrypt', async () => {
    const legacy = await hashWithLegacyScryptForTests(SECRET, CHEAP_SCRYPT_N);
    expect(legacy.startsWith('scrypt$')).toBe(true);
    expect(await verifyStaffPassword(SECRET, legacy)).toBe(true);
  });

  /**
   * Le SEUL test qui paie encore le prix fort, et il porte donc son délai.
   *
   * Mesuré ici : 812 ms machine au repos, 4 765 ms machine chargée — à 235 ms du
   * délai par défaut de vitest. C'est précisément la façon dont la suite scrypt
   * arrivait verte et rougissait ensuite. On ne baisse pas N : ce serait éprouver
   * un paramètre que la base ne contient pas. On dit au test ce que coûte le
   * paramètre qui EST en base.
   */
  it('accepte aussi le paramètre d’époque N = 2^17, tel qu’il est en base', { timeout: 30_000 }, async () => {
    const legacy = await hashWithLegacyScryptForTests(SECRET);
    expect(legacy.startsWith('scrypt$131072$8$1$')).toBe(true);
    expect(await verifyStaffPassword(SECRET, legacy)).toBe(true);
  });
});

describe('tout nouveau secret est en argon2id', () => {
  it('ne produit plus jamais de scrypt', async () => {
    const stored = await hashStaffPassword(SECRET);
    expect(stored.startsWith('$argon2id$')).toBe(true);
    expect(stored.includes('scrypt')).toBe(false);
    expect(await verifyStaffPassword(SECRET, stored)).toBe(true);
  });

  it('produit un sel différent à chaque hachage', async () => {
    const a = await hashStaffPassword('le meme mot de passe ici');
    const b = await hashStaffPassword('le meme mot de passe ici');
    expect(a).not.toBe(b);
    expect(await verifyStaffPassword('le meme mot de passe ici', b)).toBe(true);
  });
});

/**
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ LE test qu'on oublie, et celui qui attrape une vérification court-        │
 * │ circuitée : un mauvais mot de passe doit être refusé DANS LES DEUX        │
 * │ FORMATS. Un `return true` posé au début de `verifyStaffPassword` passe    │
 * │ tous les tests « le bon mot de passe marche » et ne tombe QUE ici.        │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
describe('un mauvais secret est refusé — dans les deux formats', () => {
  it('refuse le mauvais mot de passe sur un condensé argon2id', async () => {
    const stored = await hashStaffPassword(SECRET);
    expect(await verifyStaffPassword(WRONG, stored)).toBe(false);
    expect(await verifyStaffPassword('', stored)).toBe(false);
    expect(await verifyStaffPassword(`${SECRET} `, stored)).toBe(false);
    expect(await verifyStaffPassword(SECRET.toUpperCase(), stored)).toBe(false);
  });

  it('refuse le mauvais mot de passe sur un condensé scrypt historique', async () => {
    const legacy = await hashWithLegacyScryptForTests(SECRET, CHEAP_SCRYPT_N);
    expect(await verifyStaffPassword(WRONG, legacy)).toBe(false);
    expect(await verifyStaffPassword('', legacy)).toBe(false);
    expect(await verifyStaffPassword(`${SECRET} `, legacy)).toBe(false);
    expect(await verifyStaffPassword(SECRET.toUpperCase(), legacy)).toBe(false);
  });

  /**
   * Le condensé d'un AUTRE mot de passe, dans chaque format : un test de sel et
   * de comparaison, pas seulement de longueur.
   */
  it('ne confond pas deux secrets dont les condensés se ressemblent', async () => {
    const argon = await hashStaffPassword('premier mot de passe long');
    const legacy = await hashWithLegacyScryptForTests('premier mot de passe long', CHEAP_SCRYPT_N);
    expect(await verifyStaffPassword('second mot de passe long', argon)).toBe(false);
    expect(await verifyStaffPassword('second mot de passe long', legacy)).toBe(false);
  });

  /**
   * Un condensé illisible doit rendre FAUX, jamais lever et surtout jamais vrai.
   * C'est le comportement qui décide de ce qui se passe le jour où une ligne est
   * corrompue, ou écrite par un autre outil : on refuse la connexion.
   */
  it('refuse tout format inconnu au lieu de lever', async () => {
    for (const stored of [
      '',
      '$argon2id$v=19$m=19456,t=2,p=1$pas-du-base64-valide$nimporte-quoi',
      '$argon2id$',
      '$argon2i$v=19$m=19456,t=2,p=1$c2VsY2VzdGRlbGE$Y29uZGVuc2VmYWJyaXF1ZQ',
      'argon2id$v=19$m=65536,t=3,p=4$sel$condense',
      'scrypt$abc$8$1$sel$condense',
      'scrypt$1$8$1$sel$condense',
      'scrypt$16384$8$1$sel$',
      'pas-du-tout-un-condense',
      '$$$$$',
    ]) {
      expect(await verifyStaffPassword('un mot de passe quelconque', stored)).toBe(false);
    }
  });
});

describe('needsRehash — c’est lui qui déclenche la migration', () => {
  it('réclame le réhachage de TOUT condensé scrypt', async () => {
    expect(needsRehash(await hashWithLegacyScryptForTests(SECRET, CHEAP_SCRYPT_N))).toBe(true);
    expect(needsRehash('scrypt$131072$8$1$sel$condense')).toBe(true);
    expect(needsRehash('scrypt$16384$8$1$sel$condense')).toBe(true);
  });

  it('laisse tranquille un condensé argon2id aux paramètres courants', async () => {
    expect(needsRehash(await hashStaffPassword(SECRET))).toBe(false);
  });

  it('réclame le réhachage d’un argon2id d’autres paramètres, d’une autre version ou d’un autre variant', () => {
    const { memoryCost, timeCost, parallelism } = resolveArgon2Cost(process.env);
    expect(needsRehash(`$argon2id$v=19$m=${memoryCost * 2},t=${timeCost},p=${parallelism}$s$h`)).toBe(true);
    expect(needsRehash(`$argon2id$v=19$m=${memoryCost},t=${timeCost + 1},p=${parallelism}$s$h`)).toBe(true);
    expect(needsRehash(`$argon2id$v=19$m=${memoryCost},t=${timeCost},p=${parallelism + 1}$s$h`)).toBe(true);
    expect(needsRehash(`$argon2id$v=16$m=${memoryCost},t=${timeCost},p=${parallelism}$s$h`)).toBe(true);
    expect(needsRehash(`$argon2i$v=19$m=${memoryCost},t=${timeCost},p=${parallelism}$s$h`)).toBe(true);
    expect(needsRehash(`$argon2d$v=19$m=${memoryCost},t=${timeCost},p=${parallelism}$s$h`)).toBe(true);
  });

  it('réclame le réhachage de l’illisible plutôt que de le laisser passer', () => {
    expect(needsRehash('')).toBe(true);
    expect(needsRehash('pas-du-tout-un-condense')).toBe(true);
  });
});
