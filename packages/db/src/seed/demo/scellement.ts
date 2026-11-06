import { createCipheriv, randomBytes } from 'node:crypto';

/**
 * LE CHIFFREMENT DES MESSAGES, identique à `apps/api/src/common/crypto.service.ts` (`seal`) : AES-256-GCM, en-tête de
 * trois octets (deux octets magiques + l'identifiant de clé), IV de 12 octets, étiquette de 16 octets, puis le texte.
 *
 * Recopié ici (et non importé) parce que `@app/db` ne dépend pas de l'API. Un test (`scellement.test.ts`) fige le
 * format ; si l'API change de format, il faut changer les deux.
 */
const MAGIC_0 = 0xa7;
const MAGIC_1 = 0x1d;

export interface CleContenu {
  readonly id: number;
  readonly cle: Buffer;
}

/** Lit `CONTENT_ENCRYPTION_KEY` (base64, 32 octets) et `CONTENT_ENCRYPTION_KEY_ID` ; `null` si la clé est absente. */
export function cleDepuisEnv(env: Readonly<Record<string, string | undefined>>): CleContenu | null {
  const brute = env['CONTENT_ENCRYPTION_KEY']?.trim();
  if (brute === undefined || brute === '') return null;
  const cle = Buffer.from(brute, 'base64');
  if (cle.length !== 32) throw new Error('CONTENT_ENCRYPTION_KEY doit être une clé de 32 octets en base64.');
  const id = Number(env['CONTENT_ENCRYPTION_KEY_ID'] ?? '1');
  if (!Number.isInteger(id) || id < 1 || id > 255) throw new Error('CONTENT_ENCRYPTION_KEY_ID invalide.');
  return { id, cle };
}

export function sceller(texte: string, cle: CleContenu): Uint8Array<ArrayBuffer> {
  const iv = randomBytes(12);
  const chiffre = createCipheriv('aes-256-gcm', cle.cle, iv);
  const corps = Buffer.concat([chiffre.update(texte, 'utf8'), chiffre.final()]);
  return Uint8Array.from(Buffer.concat([Buffer.from([MAGIC_0, MAGIC_1, cle.id]), iv, chiffre.getAuthTag(), corps]));
}
