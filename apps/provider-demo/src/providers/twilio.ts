import { randomBytes } from 'node:crypto';
import { parseBasic, parseForm, sameSecret, sendJson } from '../http-util';
import { extractCode, extractLinks, type TwilioMessage } from '../state';
import type { Ctx } from './context';

/**
 * Twilio — API Messages (`2010-04-01`). Formats d'erreur de l'API REST :
 * `{ code, message, more_info, status }`.
 *
 * NUMÉROS DE TEST (calqués sur les « magic numbers » de Twilio, qui valent pour `To`) :
 *   +15005550001  21211  numéro invalide                      (400)
 *   +15005550002  21612  routage impossible                   (400)
 *   +15005550003  21408  pas de permission pour cette région  (400)
 *   +15005550004  21610  destinataire désabonné (STOP)        (400)
 *   +15005550429  20429  trop de requêtes                     (429, réessayable)
 *   +15005550500  20500  erreur interne                       (503, réessayable)
 *   +15005559999  accepté, puis `undelivered` (code 30003) au premier GET de statut
 * `From` = +15005550001 → 21212 (expéditeur invalide).
 */
const FAILING: Record<string, { status: number; code: number; message: (to: string) => string }> = {
  '+15005550001': { status: 400, code: 21211, message: (to) => `The 'To' number ${to} is not a valid phone number.` },
  '+15005550002': { status: 400, code: 21612, message: (to) => `The 'To' phone number: ${to}, is not currently reachable using the 'From' phone number via SMS.` },
  '+15005550003': { status: 400, code: 21408, message: () => 'Permission to send an SMS has not been enabled for the region indicated by the \'To\' number.' },
  '+15005550004': { status: 400, code: 21610, message: () => 'Attempt to send to unsubscribed recipient' },
  '+15005550429': { status: 429, code: 20429, message: () => 'Too Many Requests' },
  '+15005550500': { status: 503, code: 20500, message: () => 'Service Unavailable' },
};

function twilioError(ctx: Ctx, status: number, code: number, message: string): void {
  sendJson(
    ctx.res,
    status,
    { code, message, more_info: `https://www.twilio.com/docs/errors/${code}`, status },
    status === 401 ? { 'www-authenticate': 'Basic realm="Twilio API"' } : {},
  );
}

function authenticate(ctx: Ctx, sid: string): boolean {
  const basic = parseBasic(ctx.req);
  const ok =
    basic !== null &&
    sameSecret(basic.user, ctx.config.twilioAccountSid) &&
    sameSecret(basic.pass, ctx.config.twilioAuthToken) &&
    sameSecret(sid, ctx.config.twilioAccountSid);
  if (!ok) twilioError(ctx, 401, 20003, 'Authenticate');
  return ok;
}

export function twilioSend(ctx: Ctx, sid: string): void {
  if (!authenticate(ctx, sid)) return;
  const form = parseForm(ctx.body);
  const to = form.get('To') ?? '';
  const body = form.get('Body') ?? '';
  const from = form.get('From');
  const service = form.get('MessagingServiceSid');

  if (to === '') return twilioError(ctx, 400, 21201, "No 'To' number is specified");
  if (body === '') return twilioError(ctx, 400, 21602, 'Message body is required.');
  if (from === null && service === null) {
    return twilioError(ctx, 400, 21603, "A 'From' or 'MessagingServiceSid' parameter is required to send a message.");
  }
  if (from === '+15005550001') return twilioError(ctx, 400, 21212, `The 'From' number ${from} is not a valid, SMS-capable Twilio phone number.`);
  const failing = FAILING[to];
  if (failing !== undefined) return twilioError(ctx, failing.status, failing.code, failing.message(to));
  if (!/^\+[1-9]\d{6,14}$/.test(to)) return twilioError(ctx, 400, 21211, `The 'To' number ${to} is not a valid phone number.`);
  if (body.length > 1600) return twilioError(ctx, 400, 21617, 'The concatenated message body exceeds the 1600 character limit');

  const msid = `SM${randomBytes(16).toString('hex')}`;
  const message: TwilioMessage = {
    sid: msid,
    to,
    from,
    messagingServiceSid: service,
    body,
    status: 'queued',
    errorCode: null,
    createdAt: new Date().toUTCString(),
  };
  ctx.state.twilio.set(msid, message);
  const code = extractCode(body);
  ctx.state.record({
    kind: 'sms',
    provider: 'twilio',
    to,
    body,
    links: extractLinks(body),
    ...(code === undefined ? {} : { code }),
    meta: { sid: msid, from, messagingServiceSid: service },
  });
  sendJson(ctx.res, 201, messageResource(ctx, message), { location: messageUri(ctx, msid) });
}

export function twilioStatus(ctx: Ctx, sid: string, msid: string): void {
  if (!authenticate(ctx, sid)) return;
  const message = ctx.state.twilio.get(msid);
  if (message === undefined) {
    return twilioError(ctx, 404, 20404, `The requested resource /2010-04-01/Accounts/${sid}/Messages/${msid}.json was not found`);
  }
  // Le statut final s'établit à la première lecture : « delivered », sauf numéro de test.
  if (message.status === 'queued') {
    if (message.to.endsWith('5559999')) {
      message.status = 'undelivered';
      message.errorCode = 30003;
    } else {
      message.status = 'delivered';
    }
  }
  sendJson(ctx.res, 200, messageResource(ctx, message));
}

function messageUri(ctx: Ctx, msid: string): string {
  return `/2010-04-01/Accounts/${ctx.config.twilioAccountSid}/Messages/${msid}.json`;
}

function messageResource(ctx: Ctx, m: TwilioMessage): Record<string, unknown> {
  return {
    sid: m.sid,
    account_sid: ctx.config.twilioAccountSid,
    api_version: '2010-04-01',
    body: m.body,
    date_created: m.createdAt,
    date_updated: m.createdAt,
    date_sent: null,
    direction: 'outbound-api',
    error_code: m.errorCode,
    error_message: m.errorCode === null ? null : 'Unreachable destination handset',
    from: m.from,
    messaging_service_sid: m.messagingServiceSid,
    num_media: '0',
    num_segments: String(Math.max(1, Math.ceil(m.body.length / 160))),
    price: null,
    price_unit: null,
    status: m.status,
    subresource_uris: { media: `${messageUri(ctx, m.sid).replace('.json', '')}/Media.json` },
    to: m.to,
    uri: messageUri(ctx, m.sid),
  };
}
