import { createHash, createHmac, randomBytes } from 'node:crypto';
import { header, sameSecret, sendText } from '../http-util';
import type { Ctx } from './context';

/**
 * S3 — mode « path-style » (`/{seau}/{clé}`), PUT / GET / HEAD / DELETE d'objet.
 *
 * La SIGNATURE est vérifiée pour de vrai (SigV4) : un mauvais `S3_SECRET_ACCESS_KEY`
 * donne `403 SignatureDoesNotMatch`, une clé inconnue `403 InvalidAccessKeyId`, comme
 * chez AWS. Deux formes : en-tête `Authorization: AWS4-HMAC-SHA256 …` (le client) et
 * paramètres `X-Amz-*` d'URL (adresses pré-signées, avec expiration). Le corps
 * `aws-chunked` (SDK en flux) est décodé ; la somme `x-amz-content-sha256` du corps est
 * contrôlée quand elle est donnée en clair.
 *
 * Les erreurs sont du XML `<Error><Code>…</Code>…</Error>` — le SDK en tire le nom
 * (`NoSuchKey`, `NoSuchBucket`, `AccessDenied`…).
 *
 * PAS FIDÈLE : pas de listes (`ListObjectsV2`), pas de multipart, pas de versionnement,
 * pas de plages d'octets, le chiffrement `AES256` demandé est seulement renvoyé en écho.
 */
export function s3Error(ctx: Ctx, status: number, code: string, message: string, extra = ''): void {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<Error><Code>${code}</Code><Message>${message}</Message>${extra}<RequestId>${randomBytes(8).toString('hex').toUpperCase()}</RequestId><HostId>demo</HostId></Error>`;
  sendText(ctx.res, status, ctx.req.method === 'HEAD' ? '' : xml, 'application/xml', { 'x-amz-request-id': 'DEMO' });
}

const sha256 = (data: string | Buffer): string => createHash('sha256').update(data).digest('hex');
const hmac = (key: string | Buffer, data: string): Buffer => createHmac('sha256', key).update(data).digest();

const rfc3986 = (s: string): string =>
  encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

function canonicalQuery(url: URL, skip?: string): string {
  const pairs: [string, string][] = [];
  for (const [k, v] of url.searchParams) if (k !== skip) pairs.push([rfc3986(k), rfc3986(v)]);
  pairs.sort((a, b) => (a[0] === b[0] ? (a[1] < b[1] ? -1 : 1) : a[0] < b[0] ? -1 : 1));
  return pairs.map(([k, v]) => `${k}=${v}`).join('&');
}

function canonicalPaths(rawPath: string): string[] {
  const normalized = rawPath
    .split('/')
    .map((seg) => {
      try {
        return rfc3986(decodeURIComponent(seg));
      } catch {
        return seg;
      }
    })
    .join('/');
  return [...new Set([rawPath, normalized])];
}

interface Parsed {
  accessKey: string;
  date: string; // AAAAMMJJ
  region: string;
  amzDate: string;
  signedHeaders: string[];
  signature: string;
  payloadHash: string;
  presigned: boolean;
  expires?: number;
}

function parseAuth(ctx: Ctx): Parsed | { error: [number, string, string] } {
  const { url, req } = ctx;
  const q = url.searchParams;
  if (q.has('X-Amz-Signature')) {
    const cred = (q.get('X-Amz-Credential') ?? '').split('/');
    return {
      accessKey: cred[0] ?? '',
      date: cred[1] ?? '',
      region: cred[2] ?? '',
      amzDate: q.get('X-Amz-Date') ?? '',
      signedHeaders: (q.get('X-Amz-SignedHeaders') ?? 'host').split(';'),
      signature: q.get('X-Amz-Signature') ?? '',
      payloadHash: q.get('X-Amz-Content-Sha256') ?? 'UNSIGNED-PAYLOAD',
      presigned: true,
      expires: Number(q.get('X-Amz-Expires') ?? '0'),
    };
  }
  const auth = header(req, 'authorization');
  if (auth === undefined) return { error: [403, 'AccessDenied', 'Access Denied'] };
  const m = /^AWS4-HMAC-SHA256\s+Credential=([^,\s]+),\s*SignedHeaders=([^,\s]+),\s*Signature=([0-9a-f]+)$/.exec(auth);
  if (m === null) return { error: [400, 'AuthorizationHeaderMalformed', 'The authorization header is malformed.'] };
  const cred = (m[1] as string).split('/');
  return {
    accessKey: cred[0] ?? '',
    date: cred[1] ?? '',
    region: cred[2] ?? '',
    amzDate: header(req, 'x-amz-date') ?? '',
    signedHeaders: (m[2] as string).split(';'),
    signature: m[3] as string,
    payloadHash: header(req, 'x-amz-content-sha256') ?? 'UNSIGNED-PAYLOAD',
    presigned: false,
  };
}

/** Rend `true` si la requête est authentique ; sinon a déjà répondu. */
function verify(ctx: Ctx, bodyForHash: Buffer): boolean {
  const parsed = parseAuth(ctx);
  if ('error' in parsed) {
    s3Error(ctx, ...parsed.error);
    return false;
  }
  const p = parsed;
  if (!sameSecret(p.accessKey, ctx.config.s3AccessKeyId)) {
    s3Error(ctx, 403, 'InvalidAccessKeyId', 'The AWS Access Key Id you provided does not exist in our records.');
    return false;
  }
  const t = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(p.amzDate);
  if (t === null) {
    s3Error(ctx, 400, 'AuthorizationHeaderMalformed', 'Invalid X-Amz-Date.');
    return false;
  }
  const signedAt = Date.UTC(+t[1]!, +t[2]! - 1, +t[3]!, +t[4]!, +t[5]!, +t[6]!);
  if (p.presigned) {
    if (Date.now() > signedAt + (p.expires ?? 0) * 1000) {
      s3Error(ctx, 403, 'AccessDenied', 'Request has expired');
      return false;
    }
  } else if (Math.abs(Date.now() - signedAt) > 15 * 60 * 1000) {
    s3Error(ctx, 403, 'RequestTimeTooSkewed', 'The difference between the request time and the current time is too large.');
    return false;
  }

  const headersBlock = p.signedHeaders
    .map((name) => `${name}:${(header(ctx.req, name) ?? '').trim().replace(/\s+/g, ' ')}\n`)
    .join('');
  const scope = `${p.date}/${p.region}/s3/aws4_request`;
  const kDate = hmac(`AWS4${ctx.config.s3SecretAccessKey}`, p.date);
  const key = hmac(hmac(hmac(kDate, p.region), 's3'), 'aws4_request');
  const query = canonicalQuery(ctx.url, p.presigned ? 'X-Amz-Signature' : undefined);

  let matched = false;
  for (const path of canonicalPaths(ctx.url.pathname)) {
    const canonical = [ctx.req.method, path, query, headersBlock, p.signedHeaders.join(';'), p.payloadHash].join('\n');
    const toSign = ['AWS4-HMAC-SHA256', p.amzDate, scope, sha256(canonical)].join('\n');
    const expected = createHmac('sha256', key).update(toSign).digest('hex');
    if (sameSecret(expected, p.signature)) {
      matched = true;
      break;
    }
  }
  if (!matched) {
    s3Error(ctx, 403, 'SignatureDoesNotMatch', 'The request signature we calculated does not match the signature you provided. Check your key and signing method.');
    return false;
  }
  if (/^[0-9a-f]{64}$/.test(p.payloadHash) && sha256(bodyForHash) !== p.payloadHash) {
    s3Error(ctx, 400, 'XAmzContentSHA256Mismatch', 'The provided \'x-amz-content-sha256\' header does not match what was computed.');
    return false;
  }
  return true;
}

/** Décode un corps `aws-chunked` (`<hex>;chunk-signature=…\r\n<octets>\r\n … 0;…\r\n`). */
export function decodeAwsChunked(raw: Buffer): Buffer {
  const out: Buffer[] = [];
  let pos = 0;
  while (pos < raw.length) {
    const eol = raw.indexOf('\r\n', pos);
    if (eol < 0) break;
    const size = parseInt(raw.toString('latin1', pos, eol).split(';')[0] ?? '', 16);
    if (!Number.isFinite(size) || size === 0) break;
    out.push(raw.subarray(eol + 2, eol + 2 + size));
    pos = eol + 2 + size + 2;
  }
  return Buffer.concat(out);
}

export function s3Handle(ctx: Ctx): void {
  const parts = ctx.url.pathname.split('/').filter((p) => p !== '');
  const bucket = decodeURIComponent(parts[0] ?? '');
  const key = parts
    .slice(1)
    .map((p) => decodeURIComponent(p))
    .join('/');
  const method = ctx.req.method ?? 'GET';

  const streaming = (header(ctx.req, 'x-amz-content-sha256') ?? '').startsWith('STREAMING-') ||
    (header(ctx.req, 'content-encoding') ?? '').includes('aws-chunked');
  if (!verify(ctx, streaming ? Buffer.alloc(0) : ctx.body)) return;

  if (bucket !== ctx.config.s3Bucket) {
    return s3Error(ctx, 404, 'NoSuchBucket', 'The specified bucket does not exist', `<BucketName>${bucket}</BucketName>`);
  }
  if (key === '') return s3Error(ctx, 501, 'NotImplemented', 'Opérations sur le seau non émulées (voir docs/provider-demo.md).');
  const store = `${bucket}/${key}`;

  if (method === 'PUT') {
    if (header(ctx.req, 'x-amz-copy-source') !== undefined) return s3Error(ctx, 501, 'NotImplemented', 'CopyObject non émulé.');
    const body = streaming ? decodeAwsChunked(ctx.body) : ctx.body;
    const etag = `"${createHash('md5').update(body).digest('hex')}"`;
    const encryption = header(ctx.req, 'x-amz-server-side-encryption');
    ctx.state.objects.set(store, {
      body,
      mime: header(ctx.req, 'content-type') ?? 'binary/octet-stream',
      etag,
      lastModified: new Date().toUTCString(),
      ...(encryption === undefined ? {} : { encryption }),
    });
    ctx.state.persist();
    return sendText(ctx.res, 200, '', 'application/xml', {
      etag,
      ...(encryption === undefined ? {} : { 'x-amz-server-side-encryption': encryption }),
    });
  }
  if (method === 'DELETE') {
    ctx.state.objects.delete(store);
    ctx.state.persist();
    ctx.res.writeHead(204);
    return void ctx.res.end();
  }
  if (method === 'GET' || method === 'HEAD') {
    const object = ctx.state.objects.get(store);
    if (object === undefined) {
      return s3Error(ctx, 404, 'NoSuchKey', 'The specified key does not exist.', `<Key>${key}</Key>`);
    }
    const headers: Record<string, string> = {
      'content-type': object.mime,
      etag: object.etag,
      'last-modified': object.lastModified,
      'accept-ranges': 'bytes',
      ...(object.encryption === undefined ? {} : { 'x-amz-server-side-encryption': object.encryption }),
    };
    if (method === 'HEAD') {
      ctx.res.writeHead(200, { ...headers, 'content-length': object.body.length });
      return void ctx.res.end();
    }
    return sendText(ctx.res, 200, object.body, object.mime, headers);
  }
  return s3Error(ctx, 405, 'MethodNotAllowed', 'The specified method is not allowed against this resource.');
}
