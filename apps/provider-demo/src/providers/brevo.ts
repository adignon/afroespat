import { randomBytes } from 'node:crypto';
import { header, parseJsonObject, sameSecret, sendJson } from '../http-util';
import { extractCode, extractLinks } from '../state';
import type { Ctx } from './context';

/**
 * Brevo — API transactionnelle v3. Erreurs : `{ code, message }`.
 *
 * ADRESSES DE TEST (partie locale du destinataire) :
 *   fail@…      400 invalid_parameter  (adresse refusée)
 *   ratelimit@… 429 too_many_requests
 *   down@…      503 service_unavailable (réessayable)
 */
function brevoError(ctx: Ctx, status: number, code: string, message: string): void {
  sendJson(ctx.res, status, { code, message });
}

function authenticate(ctx: Ctx): boolean {
  const key = header(ctx.req, 'api-key');
  if (key === undefined || !sameSecret(key, ctx.config.brevoApiKey)) {
    brevoError(ctx, 401, 'unauthorized', 'Key not found');
    return false;
  }
  return true;
}

export function brevoSend(ctx: Ctx): void {
  if (!authenticate(ctx)) return;
  if (!(header(ctx.req, 'content-type') ?? '').includes('application/json')) {
    return brevoError(ctx, 400, 'invalid_parameter', 'Content-Type must be application/json');
  }
  const body = parseJsonObject(ctx.body);
  if (body === null) return brevoError(ctx, 400, 'malformed_json', 'Request body is not valid JSON');

  const sender = body['sender'] as { email?: unknown; name?: unknown } | undefined;
  if (typeof sender?.email !== 'string' || !sender.email.includes('@')) {
    return brevoError(ctx, 400, 'missing_parameter', 'sender.email is required');
  }
  const toList = body['to'];
  if (!Array.isArray(toList) || toList.length === 0) return brevoError(ctx, 400, 'missing_parameter', 'to is required');
  const recipients: string[] = [];
  for (const r of toList) {
    const email = (r as { email?: unknown } | null)?.email;
    if (typeof email !== 'string' || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return brevoError(ctx, 400, 'invalid_parameter', 'Invalid recipient email');
    }
    recipients.push(email);
  }
  const subject = body['subject'];
  const html = body['htmlContent'];
  const text = body['textContent'];
  if (typeof subject !== 'string' || subject === '') return brevoError(ctx, 400, 'missing_parameter', 'subject is required');
  if (typeof html !== 'string' && typeof text !== 'string') {
    return brevoError(ctx, 400, 'missing_parameter', 'htmlContent or textContent is required');
  }

  for (const email of recipients) {
    const local = email.split('@')[0]?.toLowerCase() ?? '';
    if (local === 'fail') return brevoError(ctx, 400, 'invalid_parameter', 'Recipient address rejected');
    if (local === 'ratelimit') return brevoError(ctx, 429, 'too_many_requests', 'The expected rate limit is exceeded.');
    if (local === 'down') return brevoError(ctx, 503, 'service_unavailable', 'Service unavailable');
  }

  const messageId = `<${Date.now()}.${randomBytes(6).toString('hex')}@smtp-relay.demo>`;
  const content = typeof text === 'string' ? text : (html as string);
  const code = extractCode(content);
  for (const email of recipients) {
    ctx.state.record({
      kind: 'email',
      provider: 'brevo',
      to: email,
      subject,
      body: content,
      links: extractLinks(`${typeof text === 'string' ? text : ''}\n${typeof html === 'string' ? html : ''}`),
      ...(code === undefined ? {} : { code }),
      meta: {
        messageId,
        sender,
        tags: body['tags'] ?? [],
        headers: body['headers'] ?? {},
        html: typeof html === 'string' ? html : null,
      },
    });
  }
  sendJson(ctx.res, 201, { messageId });
}

export function brevoAccount(ctx: Ctx): void {
  if (!authenticate(ctx)) return;
  sendJson(ctx.res, 200, {
    email: 'demo@provider-demo.test',
    firstName: 'Démo',
    lastName: 'Fournisseurs',
    companyName: 'provider-demo',
    plan: [{ type: 'free', credits: 300, creditsType: 'sendLimit' }],
  });
}
