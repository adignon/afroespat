import { createCipheriv, randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId } from '@app/db';
import { PrismaService } from '../prisma.service';
import { buildKeyRing, keyIdOf, open, seal } from '../crypto.service';
import { rotateKeys } from '../rotate-keys';
import { CryptoService } from '../crypto.service';

/** Rotation des clés : format à identifiant, rétrocompatibilité, réécriture en base. */
const K1 = Buffer.alloc(32, 11).toString('base64');
const K2 = Buffer.alloc(32, 22).toString('base64');

function legacySeal(plaintext: string, keyB64: string): Uint8Array {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', Buffer.from(keyB64, 'base64'), iv);
  const ct = Buffer.concat([c.update(plaintext, 'utf8'), c.final()]);
  return new Uint8Array(Buffer.concat([iv, c.getAuthTag(), ct]));
}

describe('format scellé à identifiant de clé', () => {
  const ring1 = buildKeyRing(K1, 1, []);
  const ring12 = buildKeyRing(K2, 2, [{ id: 1, key: K1 }]);

  it('écrit l’identifiant et le relit', () => {
    const blob = seal('secret', ring1);
    expect(keyIdOf(blob, ring1)).toBe(1);
    expect(open(blob, ring1)).toBe('secret');
  });
  it('lit l’ANCIEN format (sans en-tête) avec la clé courante, puis avec une précédente', () => {
    const old = legacySeal('+22997000042', K1);
    expect(keyIdOf(old, ring1)).toBe(0);
    expect(open(old, ring1)).toBe('+22997000042');
    expect(open(old, ring12)).toBe('+22997000042');
  });
  it('pendant la rotation : ancien blob v1 lisible, nouveau écrit avec la clé 2', () => {
    const before = seal('x', ring1);
    expect(open(before, ring12)).toBe('x');
    expect(keyIdOf(seal('y', ring12), ring12)).toBe(2);
  });
  it('une clé retirée trop tôt LÈVE au lieu de rendre n’importe quoi', () => {
    expect(() => open(seal('x', ring1), buildKeyRing(K2, 2, []))).toThrow();
    expect(() => open(legacySeal('x', K1), buildKeyRing(K2, 2, []))).toThrow();
  });
  it('un ancien blob dont les deux premiers octets imitent l’en-tête reste lisible', () => {
    // On force un IV commençant par A7 1D 01 : le faux positif d'en-tête doit retomber sur v0.
    const iv = Buffer.concat([Buffer.from([0xa7, 0x1d, 0x01]), randomBytes(9)]);
    const c = createCipheriv('aes-256-gcm', Buffer.from(K1, 'base64'), iv);
    const ct = Buffer.concat([c.update('piège', 'utf8'), c.final()]);
    const blob = new Uint8Array(Buffer.concat([iv, c.getAuthTag(), ct]));
    expect(open(blob, ring1)).toBe('piège');
    expect(keyIdOf(blob, ring1)).toBe(0);
  });
  it('altération détectée (GCM)', () => {
    const blob = Buffer.from(seal('x', ring1));
    blob[blob.length - 1] = (blob[blob.length - 1] as number) ^ 1;
    expect(() => open(new Uint8Array(blob), ring1)).toThrow();
  });
});

describe('script de réchiffrement', () => {
  let prisma: PrismaService;
  let crypto: CryptoService;
  const users: string[] = [];

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    crypto = new CryptoService();
  });
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    await prisma.$disconnect();
  });

  it('réécrit un blob à l’ancien format, ignore un blob à jour, ne perd rien', async () => {
    const country = await prisma.country.findFirstOrThrow({ select: { id: true } });
    const mk = async (blob: Uint8Array) => {
      const id = newId();
      users.push(id);
      await prisma.user.create({
        data: {
          id, handle: `rot${id.slice(-10).replace("-", "")}`, displayName: 'R', phase: 'PRE_DEPARTURE', verificationLevel: 'L0',
          originCountryId: country.id, plan: 'FREE', status: 'ACTIVE', emailEncrypted: Uint8Array.from(blob),
        },
      });
      return id;
    };
    // « Ancien format » avec la clé courante de l'environnement de test.
    const env = process.env['PHONE_ENCRYPTION_KEY'] as string;
    const oldId = await mk(legacySeal('ancien@example.org', env));
    const freshId = await mk(crypto.encryptEmail('neuf@example.org'));

    const cols = [{ table: 'users', column: 'email_encrypted', ring: 'phone' as const }];
    const dry = await rotateKeys(prisma, crypto, { dryRun: true, columns: cols });
    expect(dry[0]?.rewritten).toBeGreaterThanOrEqual(1);
    expect(crypto.phoneKeyId((await prisma.user.findUniqueOrThrow({ where: { id: oldId } })).emailEncrypted as Uint8Array)).toBe(0);

    const [report] = await rotateKeys(prisma, crypto, { columns: cols });
    expect(report?.failed).toBe(0);
    const oldRow = await prisma.user.findUniqueOrThrow({ where: { id: oldId } });
    expect(crypto.phoneKeyId(oldRow.emailEncrypted as Uint8Array)).toBe(crypto.currentPhoneKeyId);
    expect(crypto.decryptEmail(oldRow.emailEncrypted as Uint8Array)).toBe('ancien@example.org');
    const freshRow = await prisma.user.findUniqueOrThrow({ where: { id: freshId } });
    expect(crypto.decryptEmail(freshRow.emailEncrypted as Uint8Array)).toBe('neuf@example.org');

    const [again] = await rotateKeys(prisma, crypto, { columns: cols });
    expect(again?.rewritten).toBe(0);
  });
});
