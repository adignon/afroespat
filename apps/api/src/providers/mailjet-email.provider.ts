import type { EmailProvider } from './providers';
import { renderEmail } from './email-templates';
import { callProviderJson, ProviderError, type HttpOptions } from './http';

/**
 * Email réel — Mailjet, API **Send v3.1** (`POST https://api.mailjet.com/v3.1/send`).
 *
 * Même contrat que Brevo : le corps est composé par `renderEmail` (texte ET HTML),
 * aucun modèle n'est tenu chez Mailjet. L'authentification est un Basic
 * `clé publique : clé secrète`.
 *
 * `List-Unsubscribe` est posé quand le lien existe (voir `brevo-email.provider.ts`
 * pour la raison). `MessageID` est la référence que citent les webhooks de rebond
 * de Mailjet : elle va dans `outbound_messages.provider_ref`.
 *
 * Mailjet répond 200 même quand un message est refusé : le statut se lit dans
 * `Messages[0].Status`, d'où le contrôle explicite plus bas.
 */
export interface MailjetConfig {
  readonly apiKey: string;
  readonly secretKey: string;
  readonly fromAddress: string;
  readonly fromName: string;
  readonly appName: string;
  readonly baseUrl?: string | undefined;
}

interface MailjetResponse {
  readonly Messages?: ReadonlyArray<{
    readonly Status?: string;
    readonly Errors?: ReadonlyArray<{ readonly ErrorMessage?: string }>;
    readonly To?: ReadonlyArray<{ readonly MessageID?: number | string }>;
  }>;
}

export class MailjetEmailProvider implements EmailProvider {
  constructor(
    private readonly config: MailjetConfig,
    private readonly http: HttpOptions = {},
  ) {}

  async send(
    to: string,
    template: string,
    variables: Record<string, unknown>,
  ): Promise<{ providerRef: string }> {
    const rendered = renderEmail(template, variables, this.config.appName);
    const unsubscribe = typeof variables['unsubscribeUrl'] === 'string' ? variables['unsubscribeUrl'] : null;
    const auth = Buffer.from(`${this.config.apiKey}:${this.config.secretKey}`).toString('base64');

    const result = await callProviderJson<MailjetResponse>(
      'mailjet',
      `${this.config.baseUrl ?? 'https://api.mailjet.com'}/v3.1/send`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          Messages: [
            {
              From: { Email: this.config.fromAddress, Name: this.config.fromName },
              To: [{ Email: to }],
              Subject: rendered.subject,
              TextPart: rendered.text,
              HTMLPart: rendered.html,
              // L'étiquette permet de filtrer les statistiques par modèle chez Mailjet.
              CustomCampaign: template,
              ...(unsubscribe === null ? {} : { Headers: { 'List-Unsubscribe': `<${unsubscribe}>` } }),
            },
          ],
        }),
      },
      this.http,
    );

    const message = result.Messages?.[0];
    if (message?.Status !== undefined && message.Status !== 'success') {
      // Aucun destinataire dans l'erreur (§8.1) : seulement le motif donné par Mailjet.
      throw new ProviderError(
        'mailjet',
        null,
        `message refusé (${message.Errors?.[0]?.ErrorMessage ?? message.Status})`,
        false,
      );
    }
    const id = message?.To?.[0]?.MessageID;
    return { providerRef: id === undefined ? 'mailjet-sans-reference' : String(id) };
  }
}
