import { createHmac, randomUUID } from 'node:crypto';
import { header, parseForm, parseJsonObject, sameSecret, sendJson, sendText } from '../http-util';
import type { KycSession } from '../state';
import type { Ctx } from './context';

/**
 * Didit — vérification d'identité. Auth : en-tête `x-api-key`. Erreurs : `{ detail }`
 * (ou `{ champ: [messages] }` pour une validation).
 *
 * LE NOM DÉCIDE DU VERDICT (la page hébergée du démo demande un nom, comme Didit lit
 * un document). Mots-clés, sans casse :
 *   « refus » / « decline »  → Declined (avertissement DOCUMENT_NOT_SUPPORTED)
 *   « mineur » / « minor »   → Approved mais 15 ans (majorité fausse : L1 refusé)
 *   « revue » / « review »   → In Review
 *   « abandon »              → Abandoned
 *   tout autre nom           → Approved, 34 ans
 * Le webhook signé (HMAC-SHA256 du corps brut, en-têtes `X-Signature` et `X-Timestamp`)
 * part vers `DEMO_DIDIT_WEBHOOK_URL` dès la décision.
 */
function diditError(ctx: Ctx, status: number, body: unknown): void {
  sendJson(ctx.res, status, body);
}

function authenticate(ctx: Ctx): boolean {
  const key = header(ctx.req, 'x-api-key');
  if (key === undefined || !sameSecret(key, ctx.config.diditApiKey)) {
    diditError(ctx, 401, { detail: 'Invalid or missing API key.' });
    return false;
  }
  return true;
}

export function diditCreateSession(ctx: Ctx): void {
  if (!authenticate(ctx)) return;
  const body = parseJsonObject(ctx.body);
  if (body === null) return diditError(ctx, 400, { detail: 'Invalid JSON body.' });
  const workflow = body['workflow_id'];
  if (typeof workflow !== 'string' || workflow === '') {
    return diditError(ctx, 400, { workflow_id: ['This field is required.'] });
  }
  if (workflow !== ctx.config.diditWorkflowId) return diditError(ctx, 404, { detail: 'Workflow not found.' });
  const vendor = body['vendor_data'];
  const callback = body['callback'];
  if (vendor !== undefined && typeof vendor !== 'string') return diditError(ctx, 400, { vendor_data: ['Not a valid string.'] });

  const id = randomUUID();
  const session: KycSession = {
    id,
    number: ctx.state.nextKycNumber(),
    vendorData: typeof vendor === 'string' ? vendor : null,
    callback: typeof callback === 'string' ? callback : null,
    status: 'Not Started',
    decision: null,
    createdAt: new Date().toISOString(),
    deliveries: [],
  };
  ctx.state.kyc.set(id, session);
  ctx.state.persist();
  const url = `${ctx.config.publicUrl}/__demo/kyc/${id}`;
  ctx.state.record({ kind: 'kyc', provider: 'didit', to: id, body: `session créée pour ${session.vendorData ?? '?'}`, links: [url], meta: { vendorData: session.vendorData } });
  sendJson(ctx.res, 201, {
    session_id: id,
    session_number: session.number,
    session_token: randomUUID().replace(/-/g, ''),
    vendor_data: session.vendorData,
    metadata: null,
    status: session.status,
    workflow_id: workflow,
    callback: session.callback,
    url,
  });
}

export function diditDecision(ctx: Ctx, id: string): void {
  if (!authenticate(ctx)) return;
  const session = ctx.state.kyc.get(id);
  if (session === undefined) return diditError(ctx, 404, { detail: 'Not found.' });
  sendJson(ctx.res, 200, decisionBody(ctx, session));
}

function decisionBody(ctx: Ctx, s: KycSession): Record<string, unknown> {
  return {
    session_id: s.id,
    session_number: s.number,
    session_url: `${ctx.config.publicUrl}/__demo/kyc/${s.id}`,
    status: s.status,
    workflow_id: ctx.config.diditWorkflowId,
    vendor_data: s.vendorData,
    ...(s.decision ?? {}),
  };
}

// ── La page hébergée et la décision ─────────────────────────────────────────

const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

export function diditHostedPage(ctx: Ctx, id: string): void {
  const s = ctx.state.kyc.get(id);
  if (s === undefined) return sendText(ctx.res, 404, 'Session inconnue', 'text/plain; charset=utf-8');
  const done = s.status !== 'Not Started';
  const html = `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Vérification d'identité (démo)</title>
<body style="font:16px system-ui;max-width:28rem;margin:2rem auto;padding:0 1rem">
<h1>Vérification d'identité — DÉMO</h1>
<p>Page hébergée simulée. Le nom saisi décide du verdict : « refus » → refusé, « mineur » → mineur, « revue » → en revue, sinon accepté.</p>
${done ? `<p id="result">Session terminée : <strong>${esc(s.status)}</strong></p>` : `<form method="post" action="/__demo/kyc/${esc(id)}">
<label>Nom sur le document <input name="name" value="Awa Test" required style="width:100%;padding:.5rem"></label>
<p><button type="submit" style="padding:.6rem 1rem">Envoyer le document</button></p></form>`}
</body></html>`;
  sendText(ctx.res, 200, html, 'text/html; charset=utf-8');
}

export async function diditHostedSubmit(ctx: Ctx, id: string): Promise<void> {
  const s = ctx.state.kyc.get(id);
  if (s === undefined) return sendText(ctx.res, 404, 'Session inconnue');
  const ct = header(ctx.req, 'content-type') ?? '';
  const jsonName = parseJsonObject(ctx.body)?.['name'];
  const name = ct.includes('json') ? (typeof jsonName === 'string' ? jsonName : '') : (parseForm(ctx.body).get('name') ?? '');
  await decide(ctx, s, { name });
  const back = s.callback;
  if (ct.includes('json')) return sendJson(ctx.res, 200, { status: s.status, deliveries: s.deliveries });
  ctx.res.writeHead(303, { location: back ?? `${ctx.config.publicUrl}/__demo/kyc/${id}` });
  ctx.res.end();
}

/** `POST /__demo/kyc/:id/decide` — `{ name }` ou `{ status: 'Approved'|'Declined'|… , age? }`. */
export async function diditDecide(ctx: Ctx, id: string): Promise<void> {
  const s = ctx.state.kyc.get(id);
  if (s === undefined) return sendJson(ctx.res, 404, { detail: 'Not found.' });
  const body = parseJsonObject(ctx.body) ?? {};
  await decide(ctx, s, {
    name: typeof body['name'] === 'string' ? body['name'] : '',
    status: typeof body['status'] === 'string' ? body['status'] : undefined,
    age: typeof body['age'] === 'number' ? body['age'] : undefined,
  });
  sendJson(ctx.res, 200, { status: s.status, deliveries: s.deliveries });
}

export async function diditRedeliver(ctx: Ctx, id: string): Promise<void> {
  const s = ctx.state.kyc.get(id);
  if (s === undefined) return sendJson(ctx.res, 404, { detail: 'Not found.' });
  await deliver(ctx, s);
  sendJson(ctx.res, 200, { status: s.status, deliveries: s.deliveries });
}

interface Decision { name: string; status?: string | undefined; age?: number | undefined }

async function decide(ctx: Ctx, s: KycSession, input: Decision): Promise<void> {
  const n = input.name.toLowerCase();
  let status = input.status ?? 'Approved';
  let age = input.age ?? 34;
  const warnings: { risk: string; short_description: string }[] = [];
  if (input.status === undefined) {
    if (/refus|decline/.test(n)) status = 'Declined';
    else if (/mineur|minor/.test(n)) age = 15;
    else if (/revue|review/.test(n)) status = 'In Review';
    else if (/abandon/.test(n)) status = 'Abandoned';
  }
  if (status === 'Declined') warnings.push({ risk: 'DOCUMENT_NOT_SUPPORTED', short_description: 'Document not supported' });
  const born = new Date();
  born.setUTCFullYear(born.getUTCFullYear() - age - 1);
  s.status = status;
  s.decision = {
    id_verification: {
      status,
      full_name: input.name === '' ? 'Test Demo' : input.name,
      age,
      date_of_birth: born.toISOString().slice(0, 10),
      document_type: 'Identity Card',
      issuing_state: 'FRA',
    },
    warnings,
  };
  ctx.state.record({ kind: 'kyc', provider: 'didit', to: s.id, body: `décision : ${status}`, meta: { age } });
  await deliver(ctx, s);
}

/** Poste le webhook signé. Le résultat (statut HTTP ou erreur) est gardé sur la session. */
async function deliver(ctx: Ctx, s: KycSession): Promise<void> {
  const payload = JSON.stringify({
    session_id: s.id,
    status: s.status,
    webhook_type: 'status.updated',
    vendor_data: s.vendorData,
    workflow_id: ctx.config.diditWorkflowId,
    timestamp: Math.floor(Date.now() / 1000),
    decision: s.decision,
  });
  const signature = createHmac('sha256', ctx.config.diditWebhookSecret).update(payload).digest('hex');
  try {
    const response = await fetch(ctx.config.diditWebhookUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-signature': signature,
        'x-timestamp': String(Math.floor(Date.now() / 1000)),
      },
      body: payload,
      signal: AbortSignal.timeout(8000),
    });
    s.deliveries.push({ at: new Date().toISOString(), status: response.status });
  } catch (error) {
    s.deliveries.push({ at: new Date().toISOString(), status: null, error: error instanceof Error ? error.message : String(error) });
  }
  ctx.state.persist();
}
