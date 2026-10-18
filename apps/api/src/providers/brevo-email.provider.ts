import type { EmailProvider } from './providers';
import { renderEmail } from './email-templates';
import { callProviderJson, type HttpOptions } from './http';

/**
 * Email réel — Brevo, API transactionnelle (`POST https://api.brevo.com/v3/smtp/email`),
 * 12 §2.5.
 *
 * Le corps est composé par `renderEmail` (texte ET HTML) et envoyé en
 * `htmlContent` + `textContent` : aucun modèle n'est tenu chez Brevo.
 *
 * `List-Unsubscribe` est posé quand le lien existe. C'est l'en-tête que lisent les
 * messageries pour afficher leur propre bouton « se désabonner » — sans lui, le
 * membre qui ne veut plus d'email clique « indésirable », ce qui abîme la
 * délivrabilité de TOUS les envois (le souci exact de 12 §2.1).
 *
 * `messageId` est la référence que Brevo rend et que ses webhooks de rebond
 * citent : elle va dans `outbound_messages.provider_ref`.
 */
export interface BrevoConfig {
  readonly apiKey: string;
  readonly fromAddress: string;
  readonly fromName: string;
  readonly appName: string;
  readonly baseUrl?: string | undefined;
}

export class BrevoEmailProvider implements EmailProvider {
  constructor(
    private readonly config: BrevoConfig,
    private readonly http: HttpOptions = {},
  ) {}

  async send(
    to: string,
    template: string,
    variables: Record<string, unknown>,
  ): Promise<{ providerRef: string }> {
    const rendered = renderEmail(template, variables, this.config.appName);
    const unsubscribe = typeof variables['unsubscribeUrl'] === 'string' ? variables['unsubscribeUrl'] : null;

    const result = await callProviderJson<{ messageId?: string }>(
      'brevo',
      `${this.config.baseUrl ?? 'https://api.brevo.com'}/v3/smtp/email`,
      {
        method: 'POST',
        headers: {
          'api-key': this.config.apiKey,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          sender: { email: this.config.fromAddress, name: this.config.fromName },
          to: [{ email: to }],
          subject: rendered.subject,
          htmlContent: rendered.html,
          textContent: rendered.text,
          // L'étiquette permet de filtrer les statistiques par modèle chez Brevo.
          tags: [template],
          ...(unsubscribe === null ? {} : { headers: { 'List-Unsubscribe': `<${unsubscribe}>` } }),
        }),
      },
      this.http,
    );
    return { providerRef: result.messageId ?? 'brevo-sans-reference' };
  }
}
