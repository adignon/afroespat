import type { CaptchaProvider } from './providers';
import { callProviderJson, type HttpOptions } from './http';

/**
 * Captcha réel — Cloudflare Turnstile, vérification SERVEUR (01 §2.1 : « captcha
 * obligatoire avant tout envoi d'OTP »).
 *
 * `POST https://challenges.cloudflare.com/turnstile/v0/siteverify`, en formulaire :
 * `secret`, `response` (le jeton du widget), `remoteip` quand on l'a.
 *
 * UNE PANNE DE CLOUDFLARE REFUSE, elle n'ouvre pas. C'est le choix inverse de la
 * commodité, et il est voulu : le captcha est ce qui borne le coût des SMS. Un
 * vérificateur qui laisserait passer en cas d'erreur réseau ferait d'une coupure
 * Cloudflare une fenêtre d'envoi illimitée de SMS payants. Le membre lit « vérification
 * impossible, réessayez » (`CAPTCHA_FAILED`), et la file n'a rien envoyé.
 *
 * Les jetons de TEST officiels de Cloudflare fonctionnent avec ce vérificateur :
 * secret `1x0000000000000000000000000000000AA` (accepte tout) et jeton factice
 * `XXXX.DUMMY.TOKEN.XXXX` — c'est ce que le front envoie quand aucune clé de site
 * n'est configurée (`apps/web/src/components/captcha.tsx`).
 */
export class TurnstileCaptchaProvider implements CaptchaProvider {
  constructor(
    private readonly secretKey: string,
    private readonly http: HttpOptions = {},
  ) {}

  async verify(token: string, ip?: string): Promise<boolean> {
    if (token.trim() === '' || token.length > 2048) return false;
    const form = new URLSearchParams({ secret: this.secretKey, response: token });
    if (ip !== undefined) form.set('remoteip', ip);
    try {
      const result = await callProviderJson<{ success?: boolean }>(
        'turnstile',
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: form.toString(),
        },
        { timeoutMs: 5_000, ...this.http },
      );
      return result.success === true;
    } catch {
      return false;
    }
  }
}
