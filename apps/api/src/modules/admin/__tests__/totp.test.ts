import { describe, expect, it } from 'vitest';
import { TOTP_STEP_SECONDS } from '@app/shared';
import {
  base32Decode,
  base32Encode,
  generateTotpSecret,
  totpCodeFor,
  totpCounter,
  totpUri,
  verifyTotp,
} from '../totp';
import { hashStaffPassword, needsRehash, verifyStaffPassword } from '../staff-password';

/**
 * TOTP et mot de passe d'équipe — tests unitaires, sans base.
 *
 * Le TOTP est écrit à la main (voir `totp.ts`), donc il DOIT être confronté aux
 * vecteurs officiels : c'est la seule chose qui distingue « j'ai implémenté la RFC
 * 6238 » de « j'ai écrit du code qui produit six chiffres ». Les vecteurs sont
 * ceux de l'annexe B, cas SHA1.
 *
 * Ils sont donnés sur 8 chiffres et l'on en produit 6 : la troncature de la RFC
 * 4226 étant un modulo 10^n, les six chiffres attendus sont les six derniers des
 * huit. Ce n'est pas une approximation, c'est la définition.
 */

/** Le secret de l'annexe B : les vingt octets ASCII « 12345678901234567890 ». */
const RFC_SECRET_ASCII = '12345678901234567890';
const RFC_SECRET_BASE32 = base32Encode(Buffer.from(RFC_SECRET_ASCII, 'ascii'));

describe('TOTP (RFC 6238)', () => {
  it('encode le secret de l’annexe B en base32 canonique', () => {
    // La valeur connue de ce secret. Si l'encodage dérive, tous les vecteurs qui
    // suivent deviennent faux pour une raison qui n'a rien à voir avec HMAC.
    expect(RFC_SECRET_BASE32).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
  });

  it('décode ce qu’il encode, pour des longueurs qui ne tombent pas juste', () => {
    for (const length of [1, 2, 5, 10, 16, 20, 32]) {
      const bytes = Buffer.alloc(length, 0xa7);
      expect(base32Decode(base32Encode(bytes))).toEqual(bytes);
    }
  });

  it.each([
    [59, '287082'],
    [1_111_111_109, '081804'],
    [1_111_111_111, '050471'],
    [1_234_567_890, '005924'],
    [2_000_000_000, '279037'],
    [20_000_000_000, '353130'],
  ])('produit le code de l’annexe B à T = %i', (unixSeconds, expected) => {
    const counter = Math.floor(unixSeconds / TOTP_STEP_SECONDS);
    expect(totpCodeFor(RFC_SECRET_BASE32, counter)).toBe(expected);
  });

  it('accepte le code du pas courant et rend son compteur', () => {
    const at = new Date(1_111_111_109_000);
    const counter = totpCounter(at);
    const verified = verifyTotp(RFC_SECRET_BASE32, totpCodeFor(RFC_SECRET_BASE32, counter), at);
    expect(verified).toEqual({ counter });
  });

  /**
   * La fenêtre de ±1 pas. Elle existe pour les horloges qui dérivent, et elle
   * doit s'arrêter là : un test qui ne vérifierait que l'acceptation laisserait
   * passer une fenêtre de dix pas, donc un code valable cinq minutes.
   */
  it('tolère un pas d’écart, et pas deux', () => {
    const at = new Date(1_111_111_109_000);
    const counter = totpCounter(at);
    expect(verifyTotp(RFC_SECRET_BASE32, totpCodeFor(RFC_SECRET_BASE32, counter - 1), at)).not.toBeNull();
    expect(verifyTotp(RFC_SECRET_BASE32, totpCodeFor(RFC_SECRET_BASE32, counter + 1), at)).not.toBeNull();
    expect(verifyTotp(RFC_SECRET_BASE32, totpCodeFor(RFC_SECRET_BASE32, counter - 2), at)).toBeNull();
    expect(verifyTotp(RFC_SECRET_BASE32, totpCodeFor(RFC_SECRET_BASE32, counter + 2), at)).toBeNull();
  });

  it('refuse ce qui n’est pas six chiffres, sans lever', () => {
    for (const bad of ['', '12345', '1234567', 'abcdef', '12 34 56', '000000x']) {
      expect(verifyTotp(RFC_SECRET_BASE32, bad)).toBeNull();
    }
  });

  it('rend un secret différent à chaque appel, de 32 caractères base32', () => {
    const a = generateTotpSecret();
    const b = generateTotpSecret();
    expect(a).not.toBe(b);
    // 20 octets → 32 caractères base32, sans remplissage.
    expect(a).toMatch(/^[A-Z2-7]{32}$/);
  });

  /**
   * L'URI annonce SHA1 explicitement. Sans cela, une application qui choisirait
   * SHA-256 par défaut afficherait des codes que le serveur refuse, et le compte
   * serait inutilisable sans que rien n'explique pourquoi.
   */
  it('écrit une URI otpauth que les applications savent lire', () => {
    const uri = totpUri({
      secretBase32: RFC_SECRET_BASE32,
      accountEmail: 'equipe@exemple.test',
      issuer: 'DisaporyPlus',
    });
    expect(uri.startsWith('otpauth://totp/DisaporyPlus:equipe%40exemple.test?')).toBe(true);
    expect(uri).toContain('algorithm=SHA1');
    expect(uri).toContain('digits=6');
    expect(uri).toContain('period=30');
    expect(uri).toContain(`secret=${RFC_SECRET_BASE32}`);
  });
});

/**
 * UN DÉLAI EXPLICITE, et la raison est le cœur du sujet.
 *
 * `hashStaffPassword` emploie scrypt à N=2¹⁷ : la fonction est LENTE PAR DESSEIN,
 * c'est exactement ce qu'on lui demande — un attaquant qui essaie des millions de
 * mots de passe paie ce coût à chaque essai. Un hachage prend ici près de deux
 * secondes, et plusieurs de ces tests en enchaînent deux ou trois.
 *
 * Avec le délai par défaut de cinq secondes, ils passaient sur une machine au
 * repos et échouaient sur une machine chargée — c'est ainsi qu'ils sont arrivés
 * verts et qu'ils ont rougi ensuite, sans qu'une ligne ait changé. Un test qui
 * dépend de la charge apprend à ignorer le rouge, ce qui coûte plus cher que le
 * test ne rapporte.
 *
 * Le délai est donc aligné sur le COÛT DES PARAMÈTRES, pas l'inverse : on
 * n'abaisse pas N pour faire passer un test, on dit au test combien coûte la
 * sécurité qu'on a choisie.
 */
describe('mot de passe d’équipe', { timeout: 30_000 }, () => {
  it('vérifie le mot de passe qu’il a haché, et refuse les autres', async () => {
    const hash = await hashStaffPassword('un mot de passe de plus de douze');
    expect(await verifyStaffPassword('un mot de passe de plus de douze', hash)).toBe(true);
    expect(await verifyStaffPassword('un mot de passe de plus de douz', hash)).toBe(false);
    expect(await verifyStaffPassword('', hash)).toBe(false);
  });

  it('produit un sel différent à chaque hachage', async () => {
    const a = await hashStaffPassword('le meme mot de passe ici');
    const b = await hashStaffPassword('le meme mot de passe ici');
    expect(a).not.toBe(b);
    expect(await verifyStaffPassword('le meme mot de passe ici', b)).toBe(true);
  });

  /**
   * Un condensé illisible doit rendre FAUX, jamais lever et surtout jamais vrai.
   * C'est le comportement qui décide de ce qui se passe le jour où une ligne est
   * corrompue, ou écrite par un autre outil : on refuse la connexion.
   */
  it('refuse tout format inconnu au lieu de lever', async () => {
    for (const stored of [
      '',
      'argon2id$v=19$m=65536,t=3,p=4$sel$condense',
      'scrypt$abc$8$1$sel$condense',
      'scrypt$1$8$1$sel$condense',
      'pas-du-tout-un-condense',
      '$$$$$',
    ]) {
      expect(await verifyStaffPassword('un mot de passe quelconque', stored)).toBe(false);
    }
  });

  it('signale les formats à réhacher, et pas le format courant', async () => {
    expect(needsRehash(await hashStaffPassword('un mot de passe de plus'))).toBe(false);
    expect(needsRehash('argon2id$v=19$m=65536$sel$condense')).toBe(true);
    expect(needsRehash('scrypt$16384$8$1$sel$condense')).toBe(true);
  });
});
