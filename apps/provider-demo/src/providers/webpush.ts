import { createECDH, createPublicKey, createVerify, hkdfSync, createDecipheriv, randomBytes, randomUUID } from 'node:crypto';
import { header, parseJsonObject, sendJson, sendText } from '../http-util';
import type { PushSubscriptionRecord } from '../state';
import type { Ctx } from './context';

/**
 * Service push (ce que Mozilla/Google/Apple font) + vérification VAPID (RFC 8292) +
 * déchiffrement de la charge `aes128gcm` (RFC 8188/8291).
 *
 * Un « appareil » est créé par `POST /__demo/push/subscriptions` : le démo tire sa paire
 * ECDH et son secret d'authentification, et rend un abonnement `{ endpoint, keys }` que
 * l'API enregistre comme n'importe quel abonnement de navigateur. (Un vrai navigateur
 * ne peut pas s'abonner auprès du démo : l'abonnement réel vient de son propre service.)
 *
 * Contrôles, dans l'ordre d'un service push réel :
 *   404  abonnement inconnu · 410  abonnement révoqué (`/__demo/push/:id/revoke`)
 *   401  `Authorization: vapid t=<JWT ES256>, k=<clé publique>` absent ou signature fausse,
 *        audience ≠ origine de l'endpoint, JWT expiré ou valable plus de 24 h
 *   403  clé VAPID ≠ celle qui a créé l'abonnement (ou ≠ `VAPID_PUBLIC_KEY` si posée)
 *   400  `TTL` absent ou `Content-Encoding` ≠ aes128gcm · 413  charge > 4096 octets
 *   201  accepté, `Location` rendu ; la charge déchiffrée entre dans l'inbox (kind=push).
 */
const b64u = (buf: Buffer): string => buf.toString('base64url');

export function createSubscription(ctx: Ctx): void {
  const body = parseJsonObject(ctx.body) ?? {};
  const ecdh = createECDH('prime256v1');
  ecdh.generateKeys();
  const auth = randomBytes(16);
  const id = randomUUID();
  const pub = ecdh.getPublicKey();
  const privateJwk = {
    kty: 'EC',
    crv: 'P-256',
    x: b64u(pub.subarray(1, 33)),
    y: b64u(pub.subarray(33, 65)),
    d: b64u(ecdh.getPrivateKey()),
  };
  const record: PushSubscriptionRecord = {
    id,
    privateJwk,
    p256dh: b64u(ecdh.getPublicKey()),
    auth: b64u(auth),
    vapidKey: typeof body['vapidPublicKey'] === 'string' ? body['vapidPublicKey'] : ctx.config.vapidPublicKey || null,
    revoked: false,
  };
  ctx.state.push.set(id, record);
  ctx.state.persist();
  sendJson(ctx.res, 201, {
    id,
    endpoint: `${ctx.config.publicUrl}/push/${id}`,
    expirationTime: null,
    keys: { p256dh: record.p256dh, auth: record.auth },
  });
}

export function revokeSubscription(ctx: Ctx, id: string): void {
  const sub = ctx.state.push.get(id);
  if (sub === undefined) return sendJson(ctx.res, 404, { error: 'abonnement inconnu' });
  sub.revoked = true;
  ctx.state.persist();
  sendJson(ctx.res, 200, { id, revoked: true });
}

function verifyVapid(ctx: Ctx, endpointOrigin: string): { ok: true; key: string } | { ok: false; status: number; message: string } {
  const auth = header(ctx.req, 'authorization') ?? '';
  const m = /^vapid\s+t=([\w-]+\.[\w-]+\.[\w-]+),\s*k=([\w-]+)$/i.exec(auth);
  if (m === null) return { ok: false, status: 401, message: 'missing or malformed VAPID Authorization' };
  const [, jwt, key] = m as unknown as [string, string, string];
  const [h, p, s] = jwt.split('.') as [string, string, string];
  try {
    const head = JSON.parse(Buffer.from(h, 'base64url').toString('utf8')) as { alg?: string };
    const claims = JSON.parse(Buffer.from(p, 'base64url').toString('utf8')) as { aud?: string; exp?: number; sub?: string };
    if (head.alg !== 'ES256') return { ok: false, status: 401, message: 'VAPID alg must be ES256' };
    const raw = Buffer.from(key, 'base64url');
    if (raw.length !== 65 || raw[0] !== 4) return { ok: false, status: 401, message: 'invalid VAPID public key' };
    const pub = createPublicKey({
      key: { kty: 'EC', crv: 'P-256', x: b64u(raw.subarray(1, 33)), y: b64u(raw.subarray(33, 65)) } as import('node:crypto').JsonWebKey,
      format: 'jwk',
    });
    const valid = createVerify('SHA256').update(`${h}.${p}`).verify({ key: pub, dsaEncoding: 'ieee-p1363' }, Buffer.from(s, 'base64url'));
    if (!valid) return { ok: false, status: 401, message: 'VAPID signature invalid' };
    if (claims.aud !== endpointOrigin) return { ok: false, status: 401, message: 'VAPID aud does not match the push service origin' };
    const now = Math.floor(Date.now() / 1000);
    if (typeof claims.exp !== 'number' || claims.exp < now) return { ok: false, status: 401, message: 'VAPID token expired' };
    if (claims.exp > now + 24 * 3600 + 60) return { ok: false, status: 401, message: 'VAPID exp must be within 24 hours' };
    if (typeof claims.sub !== 'string' || !/^(mailto:|https:)/.test(claims.sub)) {
      return { ok: false, status: 401, message: 'VAPID sub must be a mailto: or https: URL' };
    }
    return { ok: true, key };
  } catch {
    return { ok: false, status: 401, message: 'VAPID token unreadable' };
  }
}

export function pushReceive(ctx: Ctx, id: string): void {
  const sub = ctx.state.push.get(id);
  if (sub === undefined) return sendJson(ctx.res, 404, { error: 'NotFound', message: 'no such subscription' });
  if (sub.revoked) return sendJson(ctx.res, 410, { error: 'Gone', message: 'subscription has unsubscribed or expired' });

  const vapid = verifyVapid(ctx, new URL(ctx.config.publicUrl).origin);
  if (!vapid.ok) return sendJson(ctx.res, vapid.status, { error: 'Unauthorized', message: vapid.message });
  if (sub.vapidKey !== null && sub.vapidKey !== vapid.key) {
    return sendJson(ctx.res, 403, { error: 'Forbidden', message: 'VAPID key does not match the subscription' });
  }
  if (sub.vapidKey === null) {
    sub.vapidKey = vapid.key; // premier envoi : l'abonnement se lie à cette clé
    ctx.state.persist();
  }
  if (!/^\d+$/.test(header(ctx.req, 'ttl') ?? '')) return sendJson(ctx.res, 400, { error: 'BadRequest', message: 'TTL header is required' });
  if ((header(ctx.req, 'content-encoding') ?? '') !== 'aes128gcm') {
    return sendJson(ctx.res, 400, { error: 'BadRequest', message: 'Content-Encoding must be aes128gcm' });
  }
  if (ctx.body.length > 4096) return sendJson(ctx.res, 413, { error: 'PayloadTooLarge', message: 'payload exceeds 4096 bytes' });

  let plaintext: string;
  try {
    plaintext = decryptAes128gcm(ctx.body, sub);
  } catch (error) {
    return sendJson(ctx.res, 400, { error: 'BadRequest', message: `payload cannot be decrypted: ${error instanceof Error ? error.message : 'unknown'}` });
  }
  let title = '';
  let text = plaintext;
  let url: string | undefined;
  try {
    const p = JSON.parse(plaintext) as { title?: string; body?: string; url?: string };
    title = p.title ?? '';
    text = p.body ?? '';
    url = p.url;
  } catch {
    /* charge non JSON : gardée telle quelle */
  }
  ctx.state.record({
    kind: 'push',
    provider: 'webpush',
    to: id,
    subject: title,
    body: text,
    links: url === undefined ? [] : [url],
    meta: { raw: plaintext, ttl: header(ctx.req, 'ttl'), urgency: header(ctx.req, 'urgency') ?? 'normal' },
  });
  sendText(ctx.res, 201, '', 'text/plain', { location: `${ctx.config.publicUrl}/push/${id}/message/${randomUUID()}` });
}

function hkdf(ikm: Buffer, salt: Buffer, info: Buffer, length: number): Buffer {
  return Buffer.from(hkdfSync('sha256', ikm, salt, info, length));
}

/** RFC 8291 : déchiffre un enregistrement `aes128gcm` unique pour l'appareil `sub`. */
export function decryptAes128gcm(body: Buffer, sub: PushSubscriptionRecord): string {
  if (body.length < 21 + 16) throw new Error('corps trop court');
  const salt = body.subarray(0, 16);
  const idlen = body[20] as number;
  const asPublic = body.subarray(21, 21 + idlen);
  const cipher = body.subarray(21 + idlen);
  if (asPublic.length !== 65) throw new Error('clé publique de l’émetteur invalide');

  const ecdh = createECDH('prime256v1');
  ecdh.setPrivateKey(Buffer.from(sub.privateJwk.d as string, 'base64url'));
  const shared = ecdh.computeSecret(asPublic);
  const uaPublic = Buffer.from(sub.p256dh, 'base64url');
  const prk = hkdf(shared, Buffer.from(sub.auth, 'base64url'), Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic]), 32);
  const cek = hkdf(prk, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16);
  const nonce = hkdf(prk, salt, Buffer.from('Content-Encoding: nonce\0'), 12);
  const decipher = createDecipheriv('aes-128-gcm', cek, nonce);
  decipher.setAuthTag(cipher.subarray(cipher.length - 16));
  const padded = Buffer.concat([decipher.update(cipher.subarray(0, cipher.length - 16)), decipher.final()]);
  let end = padded.length;
  while (end > 0 && padded[end - 1] === 0) end -= 1;
  if (end === 0 || padded[end - 1] !== 2) throw new Error('délimiteur de remplissage absent');
  return padded.subarray(0, end - 1).toString('utf8');
}
