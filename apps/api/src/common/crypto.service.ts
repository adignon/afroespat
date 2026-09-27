import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { loadEnv } from '../config/env';

/**
 * Chiffrement au repos — 00-fondations.md §8.1.
 *
 * Trois données sont chiffrées, pour trois raisons différentes :
 *
 *   · le NUMÉRO DE TÉLÉPHONE, parce qu'il identifie une personne et qu'une fuite
 *     de la base exposerait tous les membres. RÈGLE DURE : il n'est jamais
 *     renvoyé en clair par l'API après sa saisie, seulement masqué, et seulement
 *     à son propriétaire.
 *   · les NOTES PERSONNELLES d'étape, parce qu'elles peuvent contenir une
 *     situation administrative précaire.
 *   · les MESSAGES privés, chiffrés au repos mais PAS de bout en bout : la
 *     modération doit pouvoir traiter un signalement (décision T4).
 *
 * AES-256-GCM : chiffrement authentifié. Une altération du texte chiffré est
 * détectée au déchiffrement plutôt que de produire des octets faux et
 * silencieux.
 *
 * Le numéro porte EN PLUS une empreinte HMAC-SHA256, parce qu'on doit pouvoir
 * chercher « ce numéro existe-t-il ? » sans déchiffrer toute la table. Le
 * chiffrement seul ne le permet pas : GCM produit un texte différent à chaque
 * appel, par construction.
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits, la taille recommandée pour GCM
const TAG_LENGTH = 16;

/** Format stocké : [iv | tag | texte chiffré], en un seul `bytea`. */
function seal(plaintext: string, key: Buffer): Buffer {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]);
}

function open(sealed: Buffer, key: Buffer): string {
  if (sealed.length < IV_LENGTH + TAG_LENGTH) {
    throw new Error('Texte chiffré tronqué');
  }
  const iv = sealed.subarray(0, IV_LENGTH);
  const tag = sealed.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const body = sealed.subarray(IV_LENGTH + TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8');
}

@Injectable()
export class CryptoService {
  private readonly phoneKey: Buffer;
  private readonly phoneHmacKey: string;
  private readonly contentKey: Buffer;

  constructor() {
    const env = loadEnv();
    this.phoneKey = Buffer.from(env.PHONE_ENCRYPTION_KEY, 'base64');
    this.phoneHmacKey = env.PHONE_HMAC_KEY;
    this.contentKey = Buffer.from(env.CONTENT_ENCRYPTION_KEY, 'base64');
  }

  // ── Téléphone ─────────────────────────────────────────────────────────────

  /**
   * Chiffre un numéro au format E.164 (`+22997000000`).
   *
   * La clé n'est JAMAIS rotée : une rotation impose de réchiffrer toute la table
   * (runbook §7, procédure en deux passes). C'est un choix assumé — la
   * disponibilité du service prime ici sur la rotation périodique.
   */
  encryptPhone(e164: string): Buffer {
    return seal(e164, this.phoneKey);
  }

  decryptPhone(sealed: Buffer): string {
    return open(sealed, this.phoneKey);
  }

  /**
   * Empreinte déterministe d'un numéro : sert à l'unicité et à la recherche.
   *
   * Déterministe donc vulnérable à une attaque par dictionnaire si la clé fuit —
   * l'espace des numéros est petit. C'est le prix de la recherche, et c'est
   * pourquoi la clé HMAC est un secret distinct de la clé de chiffrement : il
   * faut les deux fuites pour remonter aux numéros.
   */
  phoneFingerprint(e164: string): string {
    return createHmac('sha256', this.phoneHmacKey).update(e164).digest('hex');
  }

  /**
   * Masque affiché au propriétaire — et à lui seul (règle dure 01 §2.1).
   * `+229 97 00 00 42` devient `+229 •• •• •• 42`.
   */
  maskPhone(e164: string, dialCode: string): string {
    const national = e164.startsWith(dialCode) ? e164.slice(dialCode.length) : e164;
    const lastTwo = national.slice(-2);
    const hiddenPairs = Math.max(0, Math.ceil((national.length - 2) / 2));
    return `${dialCode} ${'•• '.repeat(hiddenPairs)}${lastTwo}`.replace(/\s+/g, ' ').trim();
  }

  // ── Contenus ──────────────────────────────────────────────────────────────

  /** Notes d'étape et messages privés. Clé rotée tous les 12 mois (runbook §1). */
  encryptContent(plaintext: string): Buffer {
    return seal(plaintext, this.contentKey);
  }

  decryptContent(sealed: Buffer): string {
    return open(sealed, this.contentKey);
  }

  // ── Jetons ────────────────────────────────────────────────────────────────

  /**
   * Empreinte d'un jeton de session ou d'un code OTP. SHA-256 avec la clé HMAC :
   * on stocke l'empreinte, jamais le jeton — une fuite de la base ne donne alors
   * aucune session utilisable.
   */
  hashToken(token: string): string {
    return createHmac('sha256', this.phoneHmacKey).update(token).digest('hex');
  }

  /** Comparaison en temps constant : une comparaison naïve fuit la longueur du préfixe commun. */
  verifyToken(token: string, expectedHash: string): boolean {
    const a = Buffer.from(this.hashToken(token));
    const b = Buffer.from(expectedHash);
    return a.length === b.length && timingSafeEqual(a, b);
  }
}
