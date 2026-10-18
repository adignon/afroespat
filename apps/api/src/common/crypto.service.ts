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

/**
 * Ce que Prisma attend et rend pour une colonne `Bytes`.
 *
 * Ce n'est pas `Buffer` : un `Buffer` peut s'appuyer sur un `SharedArrayBuffer`,
 * que Prisma refuse. Le chiffrement expose donc ce type-là, pour que la
 * conversion se fasse une seule fois, ici, et non à chaque appelant.
 */
export type Sealed = Uint8Array<ArrayBuffer>;

/**
 * ── FORMAT SCELLÉ ET IDENTIFIANT DE CLÉ ────────────────────────────────────
 *
 * Ancien format (« v0 ») : `[iv 12 | tag 16 | texte]`. Il ne dit pas QUELLE clé l'a
 * scellé, donc une rotation imposait un arrêt : tout réchiffrer d'un coup, ou rien.
 *
 * Nouveau format (« v1 ») : `[0xA7 0x1D | id de clé (1 octet, 1 à 255) | iv | tag | texte]`.
 * Les trois octets d'en-tête permettent de choisir la bonne clé, donc de faire
 * COHABITER deux clés le temps que le script de réchiffrement
 * (`rotate-keys.cli.ts`) ait tout réécrit.
 *
 * RÉTROCOMPATIBLE, sans colonne de version : un blob v0 commence par un octet d'IV
 * aléatoire, il peut donc ressembler à un en-tête v1 (une chance sur 65 536 que les
 * deux premiers octets soient `A7 1D`). L'ambiguïté se lève toute seule, parce que
 * GCM authentifie : on tente la lecture v1, et si l'étiquette ne vérifie pas on
 * retombe sur v0 avec chaque clé connue. Aucun faux déchiffrement n'est possible.
 */
const MAGIC_0 = 0xa7;
const MAGIC_1 = 0x1d;
const HEADER_LENGTH = 3;

/** Un jeu de clés : celle qui chiffre, et celles encore lisibles. */
export interface KeyRing {
  readonly currentId: number;
  readonly keys: ReadonlyMap<number, Buffer>;
}

export function buildKeyRing(
  currentKeyBase64: string,
  currentId: number,
  previous: readonly { id: number; key: string }[],
): KeyRing {
  const keys = new Map<number, Buffer>();
  for (const p of previous) keys.set(p.id, Buffer.from(p.key, 'base64'));
  if (keys.has(currentId)) {
    throw new Error(`Identifiant de clé ${currentId} déjà employé par une clé précédente.`);
  }
  keys.set(currentId, Buffer.from(currentKeyBase64, 'base64'));
  return { currentId, keys };
}

function toSealed(buffer: Buffer): Sealed {
  // Recopie dans un `ArrayBuffer` bien à lui : `Buffer.concat` peut rendre une
  // vue sur un tampon partagé, et le type de Prisma l'exclut à juste titre.
  return Uint8Array.from(buffer);
}

/** Toujours écrit en v1, avec la clé courante. */
export function seal(plaintext: string, ring: KeyRing): Sealed {
  const key = ring.keys.get(ring.currentId) as Buffer;
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const header = Buffer.from([MAGIC_0, MAGIC_1, ring.currentId]);
  return toSealed(Buffer.concat([header, iv, cipher.getAuthTag(), encrypted]));
}

function decryptBody(sealed: Buffer, key: Buffer): string {
  if (sealed.length < IV_LENGTH + TAG_LENGTH) throw new Error('Texte chiffré tronqué');
  const iv = sealed.subarray(0, IV_LENGTH);
  const tag = sealed.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const body = sealed.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8');
}

/** L'identifiant de clé écrit dans le blob, ou 0 pour l'ancien format sans en-tête. */
export function keyIdOf(sealedInput: Uint8Array, ring: KeyRing): number {
  const sealed = Buffer.from(sealedInput.buffer, sealedInput.byteOffset, sealedInput.byteLength);
  if (sealed.length > HEADER_LENGTH && sealed[0] === MAGIC_0 && sealed[1] === MAGIC_1) {
    const id = sealed[2] as number;
    const key = ring.keys.get(id);
    if (key !== undefined) {
      try {
        decryptBody(sealed.subarray(HEADER_LENGTH), key);
        return id;
      } catch {
        /* pas un v1 : faux positif de l'en-tête, on retombe sur v0 */
      }
    }
  }
  return 0;
}

export function open(sealedInput: Uint8Array, ring: KeyRing): string {
  const sealed = Buffer.from(sealedInput.buffer, sealedInput.byteOffset, sealedInput.byteLength);
  if (sealed.length < IV_LENGTH + TAG_LENGTH) {
    throw new Error('Texte chiffré tronqué');
  }

  if (sealed.length > HEADER_LENGTH && sealed[0] === MAGIC_0 && sealed[1] === MAGIC_1) {
    const key = ring.keys.get(sealed[2] as number);
    if (key !== undefined) {
      try {
        return decryptBody(sealed.subarray(HEADER_LENGTH), key);
      } catch {
        /* v0 qui ressemble à un en-tête : on essaie l'ancien format ci-dessous */
      }
    }
  }

  // v0 : la clé n'est pas écrite, on essaie la courante d'abord (cas de loin le
  // plus fréquent), puis les précédentes.
  const order = [ring.currentId, ...[...ring.keys.keys()].filter((id) => id !== ring.currentId)];
  let last: unknown;
  for (const id of order) {
    try {
      return decryptBody(sealed, ring.keys.get(id) as Buffer);
    } catch (error) {
      last = error;
    }
  }
  throw last instanceof Error ? last : new Error('Déchiffrement impossible');
}

@Injectable()
export class CryptoService {
  private readonly phoneRing: KeyRing;
  private readonly phoneHmacKey: string;
  private readonly contentRing: KeyRing;

  constructor() {
    const env = loadEnv();
    this.phoneRing = buildKeyRing(
      env.PHONE_ENCRYPTION_KEY,
      env.PHONE_ENCRYPTION_KEY_ID,
      env.PHONE_ENCRYPTION_KEYS_PREVIOUS,
    );
    this.phoneHmacKey = env.PHONE_HMAC_KEY;
    this.contentRing = buildKeyRing(
      env.CONTENT_ENCRYPTION_KEY,
      env.CONTENT_ENCRYPTION_KEY_ID,
      env.CONTENT_ENCRYPTION_KEYS_PREVIOUS,
    );
  }

  // ── Téléphone ─────────────────────────────────────────────────────────────

  /**
   * Chiffre un numéro au format E.164 (`+22997000000`).
   *
   * ROTATION POSSIBLE : le blob porte l'identifiant de la clé qui l'a scellé (voir
   * « format scellé » plus haut). Le script `rotate-keys.cli.ts` réécrit les anciens
   * blobs avec la clé courante, sans arrêt de service. L'ancien « jamais rotée »
   * décrivait un format qui ne savait pas dire quelle clé l'avait scellé.
   */
  encryptPhone(e164: string): Sealed {
    return seal(e164, this.phoneRing);
  }

  decryptPhone(sealed: Uint8Array): string {
    return open(sealed, this.phoneRing);
  }

  // ── Adresse email ─────────────────────────────────────────────────────────

  /**
   * « Chiffrée comme le téléphone » (12 §3) : même clé, même format, mêmes règles —
   * jamais renvoyée en clair après sa saisie, seulement masquée.
   */
  encryptEmail(email: string): Sealed {
    return seal(email, this.phoneRing);
  }

  decryptEmail(sealed: Uint8Array): string {
    return open(sealed, this.phoneRing);
  }

  /** `jean.dupont@gmail.com` → `j•••••••@gmail.com` : le domaine aide à reconnaître sa boîte. */
  maskEmail(email: string): string {
    const at = email.lastIndexOf('@');
    if (at < 1) return '•••';
    return `${email[0]}${'•'.repeat(Math.min(7, Math.max(3, at - 1)))}${email.slice(at)}`;
  }

  // ── Rotation ──────────────────────────────────────────────────────────────

  /** Identifiant de la clé téléphone/email d'un blob (0 = ancien format). */
  phoneKeyId(sealed: Uint8Array): number {
    return keyIdOf(sealed, this.phoneRing);
  }

  contentKeyId(sealed: Uint8Array): number {
    return keyIdOf(sealed, this.contentRing);
  }

  get currentPhoneKeyId(): number {
    return this.phoneRing.currentId;
  }

  get currentContentKeyId(): number {
    return this.contentRing.currentId;
  }

  /** Relit puis réécrit avec la clé courante. */
  rewrapPhone(sealed: Uint8Array): Sealed {
    return seal(open(sealed, this.phoneRing), this.phoneRing);
  }

  rewrapContent(sealed: Uint8Array): Sealed {
    return seal(open(sealed, this.contentRing), this.contentRing);
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
  encryptContent(plaintext: string): Sealed {
    return seal(plaintext, this.contentRing);
  }

  decryptContent(sealed: Uint8Array): string {
    return open(sealed, this.contentRing);
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
