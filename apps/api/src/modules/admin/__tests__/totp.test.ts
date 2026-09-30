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

/**
 * TOTP — tests unitaires, sans base. Le mot de passe d'équipe a son propre
 * fichier : `staff-password.test.ts`.
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
