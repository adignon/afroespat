import type { IncomingMessage, ServerResponse } from 'node:http';

/** Corps maximal accepté : 60 Mio (un peu plus que le plus gros média de l'API). */
const MAX_BODY = 60 * 1024 * 1024;

export function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error('corps trop volumineux'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export function sendJson(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}): void {
  const payload = Buffer.from(JSON.stringify(body));
  res.writeHead(status, { 'content-type': 'application/json', 'content-length': payload.length, ...headers });
  res.end(payload);
}

export function sendText(
  res: ServerResponse,
  status: number,
  body: string | Buffer,
  contentType = 'text/plain; charset=utf-8',
  headers: Record<string, string> = {},
): void {
  const payload = typeof body === 'string' ? Buffer.from(body) : body;
  res.writeHead(status, { 'content-type': contentType, 'content-length': payload.length, ...headers });
  res.end(payload);
}

export function header(req: IncomingMessage, name: string): string | undefined {
  const v = req.headers[name.toLowerCase()];
  return Array.isArray(v) ? v[0] : v;
}

/** `Authorization: Basic base64(user:pass)` → `{ user, pass }`. */
export function parseBasic(req: IncomingMessage): { user: string; pass: string } | null {
  const raw = header(req, 'authorization');
  if (raw === undefined || !/^basic /i.test(raw)) return null;
  const decoded = Buffer.from(raw.slice(6).trim(), 'base64').toString('utf8');
  const i = decoded.indexOf(':');
  if (i < 0) return null;
  return { user: decoded.slice(0, i), pass: decoded.slice(i + 1) };
}

export function parseForm(body: Buffer): URLSearchParams {
  return new URLSearchParams(body.toString('utf8'));
}

export function parseJsonObject(body: Buffer): Record<string, unknown> | null {
  try {
    const v: unknown = JSON.parse(body.toString('utf8'));
    return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Comparaison en temps constant de deux chaînes (clés d'accès). */
export function sameSecret(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i += 1) diff |= (x[i] as number) ^ (y[i] as number);
  return diff === 0;
}
