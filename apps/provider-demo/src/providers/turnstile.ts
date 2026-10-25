import { parseForm, sendJson } from '../http-util';
import type { Ctx } from './context';

/**
 * Cloudflare Turnstile — `siteverify`. Réponse toujours en 200 : l'échec est
 * `success: false` + `error-codes`.
 *
 * Clés secrètes de TEST officielles de Cloudflare, reprises à l'identique :
 *   1x0000000000000000000000000000000AA  accepte tout
 *   2x0000000000000000000000000000000AA  refuse tout (invalid-input-response)
 *   3x0000000000000000000000000000000AA  jeton déjà utilisé (timeout-or-duplicate)
 * Toute autre clé doit être celle du démo (`TURNSTILE_SECRET_KEY`), sinon `invalid-input-secret`.
 *
 * Avec la clé du démo : le jeton `XXXX.DUMMY.TOKEN.XXXX` (celui du front sans clé de
 * site) passe ; un jeton qui commence par `fail` est refusé.
 */
export function turnstileVerify(ctx: Ctx): void {
  const form = parseForm(ctx.body);
  const secret = form.get('secret') ?? '';
  const token = form.get('response') ?? '';
  const result = (success: boolean, errors: string[]): void => {
    ctx.state.record({ kind: 'captcha', provider: 'turnstile', to: form.get('remoteip') ?? '-', body: success ? 'ok' : errors.join(','), meta: { success } });
    sendJson(ctx.res, 200, {
      success,
      'error-codes': errors,
      ...(success ? { challenge_ts: new Date().toISOString(), hostname: 'localhost', action: '', cdata: '' } : {}),
    });
  };

  if (secret === '') return result(false, ['missing-input-secret']);
  if (token === '') return result(false, ['missing-input-response']);
  if (token.length > 2048) return result(false, ['invalid-input-response']);
  if (secret === '2x0000000000000000000000000000000AA') return result(false, ['invalid-input-response']);
  if (secret === '3x0000000000000000000000000000000AA') return result(false, ['timeout-or-duplicate']);
  if (secret !== '1x0000000000000000000000000000000AA' && secret !== ctx.config.turnstileSecretKey) {
    return result(false, ['invalid-input-secret']);
  }
  if (token.startsWith('fail')) return result(false, ['invalid-input-response']);
  return result(true, []);
}
