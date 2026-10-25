import { randomBytes } from 'node:crypto';
import { header, parseJsonObject, sameSecret, sendJson } from '../http-util';
import type { Ctx } from './context';

/**
 * Anthropic — API Messages (`POST /v1/messages`). Auth : `x-api-key` ; `anthropic-version`
 * est obligatoire. Erreurs : `{ type: 'error', error: { type, message } }`.
 *
 * La réponse est DÉTERMINISTE : le démo lit le texte entre `<contenu>` (ou le dernier
 * message utilisateur) et rend un JSON `{ labels, score }` selon des mots-clés, dans le
 * format de sortie structurée que demande l'adaptateur.
 *
 *   MONEY_REQUEST  envoie|envoyer|verse|versement|transfert|western union|moneygram|mandat
 *   SCAM           garantie|100 %|sans dossier|rapide et sûr|payer d'avance|acompte|arnaque
 *   HARASSMENT     connard|salope|idiot|je vais te retrouver
 *   HATE           sale race|retournez chez vous
 *   SEXUAL         porno|xxx|nudes
 *   SPAM           clique ici|gagnez|promo exclusive
 *   SELF_HARM      me suicider|en finir avec la vie
 *   OK             rien de tout cela (score 0.05) ; sinon 0.85
 * Mots de commande pour les cas d'erreur :
 *   DEMO_REFUSAL → stop_reason "refusal" · DEMO_OVERLOADED → 529 · DEMO_RATE_LIMIT → 429
 *   DEMO_BAD_JSON → texte non JSON · DEMO_UNKNOWN_LABEL → étiquette hors liste
 */
const RULES: [string, RegExp][] = [
  ['MONEY_REQUEST', /\b(?:envoie|envoyer|verse|versement|transfert|western union|moneygram|mandat)\b/],
  ['SCAM', /\b(?:garantie|100\s*%|sans dossier|rapide et sûr|payer d.avance|acompte|arnaque)\b/],
  ['HARASSMENT', /\b(?:connard|salope|idiot|je vais te retrouver)\b/],
  ['HATE', /\b(?:sale race|retournez chez vous)\b/],
  ['SEXUAL', /\b(?:porno|xxx|nudes)\b/],
  ['SPAM', /\b(?:clique ici|gagnez|promo exclusive)\b/],
  ['SELF_HARM', /\b(?:me suicider|en finir avec la vie)\b/],
];

function anthropicError(ctx: Ctx, status: number, type: string, message: string): void {
  sendJson(ctx.res, status, { type: 'error', error: { type, message } }, { 'request-id': `req_${randomBytes(8).toString('hex')}` });
}

export function anthropicMessages(ctx: Ctx): void {
  const key = header(ctx.req, 'x-api-key');
  if (key === undefined || !sameSecret(key, ctx.config.anthropicApiKey)) {
    return anthropicError(ctx, 401, 'authentication_error', 'invalid x-api-key');
  }
  if (header(ctx.req, 'anthropic-version') === undefined) {
    return anthropicError(ctx, 400, 'invalid_request_error', 'anthropic-version: header is required');
  }
  const body = parseJsonObject(ctx.body);
  if (body === null) return anthropicError(ctx, 400, 'invalid_request_error', 'The request body is not valid JSON.');
  if (typeof body['model'] !== 'string' || body['model'] === '') return anthropicError(ctx, 400, 'invalid_request_error', 'model: Field required');
  if (!Number.isInteger(body['max_tokens']) || (body['max_tokens'] as number) < 1) {
    return anthropicError(ctx, 400, 'invalid_request_error', 'max_tokens: Field required');
  }
  const messages = body['messages'];
  if (!Array.isArray(messages) || messages.length === 0) {
    return anthropicError(ctx, 400, 'invalid_request_error', 'messages: Field required');
  }
  const last = messages[messages.length - 1] as { role?: string; content?: unknown };
  const content = last.content;
  const raw =
    typeof content === 'string'
      ? content
      : Array.isArray(content)
        ? content.map((b: { type?: string; text?: string }) => (b.type === 'text' ? (b.text ?? '') : '')).join('\n')
        : '';
  if (raw === '') return anthropicError(ctx, 400, 'invalid_request_error', 'messages.0.content: Field required');
  const text = /<contenu>([\s\S]*)<\/contenu>/.exec(raw)?.[1] ?? raw;

  if (text.includes('DEMO_OVERLOADED')) return anthropicError(ctx, 529, 'overloaded_error', 'Overloaded');
  if (text.includes('DEMO_RATE_LIMIT')) return anthropicError(ctx, 429, 'rate_limit_error', 'Number of request tokens has exceeded your rate limit.');

  const lower = text.toLowerCase();
  const labels = RULES.filter(([, re]) => re.test(lower)).map(([l]) => l);
  if (text.includes('DEMO_UNKNOWN_LABEL')) labels.push('NOT_A_LABEL');
  if (labels.length === 0) labels.push('OK');
  const score = labels.length === 1 && labels[0] === 'OK' ? 0.05 : 0.85;

  const refusal = text.includes('DEMO_REFUSAL');
  const out = text.includes('DEMO_BAD_JSON') ? 'Voici mon analyse : tout va bien.' : JSON.stringify({ labels, score });
  ctx.state.record({ kind: 'moderation', provider: 'anthropic', to: String(body['model']), body: text.slice(0, 500), meta: { labels, score, refusal } });
  sendJson(
    ctx.res,
    200,
    {
      id: `msg_${randomBytes(12).toString('hex')}`,
      type: 'message',
      role: 'assistant',
      model: body['model'],
      content: refusal ? [] : [{ type: 'text', text: out }],
      stop_reason: refusal ? 'refusal' : 'end_turn',
      stop_sequence: null,
      usage: { input_tokens: Math.ceil(raw.length / 4), output_tokens: Math.ceil(out.length / 4) },
    },
    { 'request-id': `req_${randomBytes(8).toString('hex')}` },
  );
}
